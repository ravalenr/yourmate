import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  deleteTestData,
  get,
  PASSWORD,
  post,
  postRaw,
  startTestServer,
  stopTestServer,
  testEmail,
} from './helpers';

const SCOPE = 'auth';
const EMAIL = testEmail(SCOPE, 'smoke');

before(async () => {
  await startTestServer();
  await deleteTestData(SCOPE);
});

after(async () => {
  await deleteTestData(SCOPE);
  await stopTestServer();
});

describe('health', () => {
  it('reports ok when the database is reachable', async () => {
    const response = await get('/health');
    assert.equal(response.status, 200);
    assert.equal(response.body.status, 'ok');
  });
});

describe('POST /auth/signup', () => {
  it('creates an account and returns a token', async () => {
    const response = await post('/auth/signup', {
      email: EMAIL,
      password: PASSWORD,
      displayName: 'Smoke Tester',
    });

    assert.equal(response.status, 201);
    assert.equal(typeof response.body.token, 'string');
    assert.equal(typeof response.body.user.id, 'string');
    assert.equal(response.body.user.email, EMAIL);
    assert.equal(response.body.user.displayName, 'Smoke Tester');
    assert.equal(response.body.user.holidayMode, false);
  });

  it('never exposes the password hash', async () => {
    const response = await post('/auth/signup', {
      email: testEmail(SCOPE, 'hash-check'),
      password: PASSWORD,
      displayName: 'Hash Check',
    });
    assert.ok(!JSON.stringify(response.body).includes('password'));
  });

  it('lower-cases the email so addresses are not case-sensitive', async () => {
    const response = await post('/auth/signup', {
      email: testEmail(SCOPE, 'mixed').toUpperCase(),
      password: PASSWORD,
      displayName: 'Case Test',
    });
    assert.equal(response.body.user.email, testEmail(SCOPE, 'mixed'));
  });

  it('rejects an email that is already registered', async () => {
    const response = await post('/auth/signup', {
      email: EMAIL,
      password: PASSWORD,
      displayName: 'Someone Else',
    });
    assert.equal(response.status, 409);
  });

  it('rejects a password under 8 characters', async () => {
    const response = await post('/auth/signup', {
      email: testEmail(SCOPE, 'short'),
      password: 'short',
      displayName: 'Short',
    });
    assert.equal(response.status, 400);
  });

  it('rejects a malformed email address', async () => {
    const response = await post('/auth/signup', {
      email: 'not-an-email',
      password: PASSWORD,
      displayName: 'X',
    });
    assert.equal(response.status, 400);
  });

  it('rejects a missing display name', async () => {
    const response = await post('/auth/signup', {
      email: testEmail(SCOPE, 'nodisplay'),
      password: PASSWORD,
    });
    assert.equal(response.status, 400);
  });
});

describe('POST /auth/login', () => {
  it('returns a token for correct credentials', async () => {
    const response = await post('/auth/login', { email: EMAIL, password: PASSWORD });
    assert.equal(response.status, 200);
    assert.equal(typeof response.body.token, 'string');
  });

  it('accepts the email in any case', async () => {
    const response = await post('/auth/login', {
      email: EMAIL.toUpperCase(),
      password: PASSWORD,
    });
    assert.equal(response.status, 200);
  });

  it('rejects a wrong password', async () => {
    const response = await post('/auth/login', { email: EMAIL, password: 'wrong-password' });
    assert.equal(response.status, 401);
  });

  it('gives an identical response for an unknown email and a wrong password', async () => {
    // Otherwise this endpoint could be used to discover which emails have accounts.
    const wrongPassword = await post('/auth/login', { email: EMAIL, password: 'wrong' });
    const unknownEmail = await post('/auth/login', {
      email: testEmail(SCOPE, 'nobody'),
      password: 'wrong',
    });

    assert.equal(wrongPassword.status, unknownEmail.status);
    assert.deepEqual(wrongPassword.body, unknownEmail.body);
  });
});

describe('authentication middleware', () => {
  it('returns the signed-in user from /me', async () => {
    const login = await post('/auth/login', { email: EMAIL, password: PASSWORD });
    const response = await get('/me', login.body.token);

    assert.equal(response.status, 200);
    assert.equal(response.body.user.email, EMAIL);
  });

  it('rejects a request with no token', async () => {
    assert.equal((await get('/me')).status, 401);
  });

  it('rejects a token that is not valid', async () => {
    assert.equal((await get('/me', 'not-a-real-token')).status, 401);
  });
});

describe('error handling', () => {
  it('returns 404 for an unknown path', async () => {
    assert.equal((await get('/no-such-route')).status, 404);
  });

  it('treats malformed JSON as the caller’s error, not a server error', async () => {
    const response = await postRaw('/auth/login', '{not valid json');
    assert.equal(response.status, 400);
  });
});
