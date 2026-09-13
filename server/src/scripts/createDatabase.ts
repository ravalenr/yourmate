import { Client } from 'pg';
import { env } from '../env';

/**
 * Creates the database named in DATABASE_URL if it doesn't exist yet.
 *
 * "CREATE DATABASE" can't run against the database it's creating, so this connects
 * to the always-present `postgres` maintenance database first. Using the pg library
 * means this works without the psql command-line tools being on your PATH.
 */
async function createDatabase() {
  const url = new URL(env.databaseUrl);
  const databaseName = decodeURIComponent(url.pathname.replace(/^\//, ''));

  if (!/^[A-Za-z0-9_]+$/.test(databaseName)) {
    throw new Error(`Unsupported database name in DATABASE_URL: ${databaseName}`);
  }

  const adminUrl = new URL(url.toString());
  adminUrl.pathname = '/postgres';

  const client = new Client({ connectionString: adminUrl.toString() });
  await client.connect();

  try {
    const existing = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [
      databaseName,
    ]);

    if (existing.rowCount) {
      console.log(`- Database "${databaseName}" already exists.`);
    } else {
      await client.query(`CREATE DATABASE "${databaseName}"`);
      console.log(`✓ Created database "${databaseName}".`);
    }
  } finally {
    await client.end();
  }
}

createDatabase().catch((error) => {
  console.error('\nCould not create the database:\n', error.message);
  console.error('\nIs Postgres running? Check the Postgres.app icon in your menu bar.');
  process.exit(1);
});
