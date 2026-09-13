# yourmate

A mobile app that helps housemates/flatmates share the responsibility for recurring
household tasks — cleaning shared spaces, putting the bins out, submitting meter
readings, and anything else that needs doing around a shared home.

Each household is an **environment** that members join with an invite code. Inside an
environment, members create tasks with a deadline and a repeat schedule (one-off,
daily, weekly, or monthly), and assign them so no one person gets stuck doing
everything:

- **Rotational** — automatically passes to the next housemate each time it's completed.
- **Manual** — always assigned to the same person.
- **Unassigned** — up for grabs until someone claims it.

Members get an in-app notification feed for what's happening in their household, and
can set a **holiday mode** on their profile to mute notifications and skip their turn
in task rotations while away.

## Status

This project is in active MVP development.

- [docs/REQUIREMENTS.md](docs/REQUIREMENTS.md) — what the MVP does, and what's
  deliberately out of scope.
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — database schema, API endpoints,
  screen flow, and build order.

## Tech Stack

- **App**: React Native + Expo, TypeScript, React Navigation
- **Backend**: Node.js + Express, TypeScript, raw SQL via `pg`
- **Database**: PostgreSQL
- **Auth**: JWT bearer tokens with bcrypt-hashed passwords

## Getting Started

**Prerequisites:** Node.js 22+ and a running PostgreSQL server.

```bash
cd server
npm install
cp .env.example .env    # then fill in DATABASE_URL and JWT_SECRET
npm run db:setup        # creates the database and applies all migrations
npm run dev             # API on http://localhost:3000
```

### Commands

| Command | What it does |
|---|---|
| `npm run dev` | Start the API, reloading on file changes |
| `npm test` | Run the test suite |
| `npm run typecheck` | Check types without emitting anything |
| `npm run migrate` | Apply any migrations that haven't run yet |
| `npm run db:create` | Create the database named in `DATABASE_URL` |
| `npm run build` | Compile TypeScript to `dist/` |

The mobile app isn't scaffolded yet — it'll live in `app/`.
