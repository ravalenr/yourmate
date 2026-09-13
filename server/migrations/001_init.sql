-- yourmate initial schema
-- See docs/ARCHITECTURE.md section 3 for the reasoning behind each table.

CREATE EXTENSION IF NOT EXISTS pgcrypto;   -- provides gen_random_uuid()

-- ─── users ────────────────────────────────────────────────────────────────
CREATE TABLE users (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email          TEXT NOT NULL UNIQUE,
  password_hash  TEXT NOT NULL,
  display_name   TEXT NOT NULL,
  bio            TEXT,
  avatar_data    BYTEA,
  avatar_mime    TEXT,
  holiday_mode   BOOLEAN NOT NULL DEFAULT FALSE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── environments (households) ────────────────────────────────────────────
CREATE TABLE environments (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT NOT NULL,
  invite_code  TEXT NOT NULL UNIQUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── memberships (which users are in which environments) ──────────────────
CREATE TABLE memberships (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  environment_id  UUID NOT NULL REFERENCES environments(id) ON DELETE CASCADE,
  role            TEXT NOT NULL CHECK (role IN ('owner', 'member')),
  joined_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, environment_id)
);

CREATE INDEX idx_memberships_environment ON memberships(environment_id, joined_at);

-- ─── tasks ────────────────────────────────────────────────────────────────
CREATE TABLE tasks (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  environment_id      UUID NOT NULL REFERENCES environments(id) ON DELETE CASCADE,
  short_description   TEXT NOT NULL,
  long_description    TEXT,
  deadline            DATE NOT NULL,
  frequency           TEXT NOT NULL
                        CHECK (frequency IN ('one_off','daily','weekly','monthly')),
  frequency_interval  INT NOT NULL DEFAULT 1,
  assignment_type     TEXT NOT NULL
                        CHECK (assignment_type IN ('rotational','manual','unassigned')),
  assigned_user_id    UUID REFERENCES users(id) ON DELETE SET NULL,
  status              TEXT NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending','done')),
  completed_at        TIMESTAMPTZ,
  completed_by        UUID REFERENCES users(id) ON DELETE SET NULL,
  created_by          UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_tasks_environment ON tasks(environment_id, status, deadline);

-- ─── notifications ────────────────────────────────────────────────────────
-- One row per recipient, so "read" status is tracked per person.
CREATE TABLE notifications (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  environment_id  UUID NOT NULL REFERENCES environments(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  actor_id        UUID REFERENCES users(id) ON DELETE SET NULL,
  task_id         UUID REFERENCES tasks(id) ON DELETE CASCADE,
  type            TEXT NOT NULL CHECK (type IN (
                    'task_created','task_completed','task_claimed',
                    'task_reassigned','member_joined','member_left')),
  message         TEXT NOT NULL,
  read_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_user
  ON notifications(user_id, environment_id, created_at DESC);
