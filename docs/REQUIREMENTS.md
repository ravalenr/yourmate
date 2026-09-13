# yourmate — MVP Requirements

## 1. Overview

**yourmate** is a mobile app that helps housemates/flatmates share responsibility for
recurring household tasks (cleaning shared spaces, putting the bins out, submitting
meter readings, etc.). Each household is represented by an **environment**. Users can
belong to one or more environments, create tasks within them, and see who is
responsible for what and by when.

This document defines the scope for the **first MVP** only. Anything not listed here
is explicitly out of scope for this phase (see Section 6).

## 2. Tech Stack

Chosen for a beginner-friendly, single-language-where-possible learning project:

| Layer | Choice | Why |
|---|---|---|
| Mobile app | **React Native + Expo** | One codebase for iOS and Android, JavaScript/TypeScript, large beginner community, runs directly in the iOS Simulator. |
| Backend | **Node.js + Express** | Same language as the frontend (JS/TS) — no context-switching while learning. Custom-built, not a backend-as-a-service. |
| Database | **PostgreSQL** | Relational fit for naturally relational data (users, environments, tasks, memberships). |
| Auth | Custom email/password auth on the Express backend (hashed passwords, session/JWT token) | No third-party auth provider, consistent with "custom backend" choice. |
| Notifications | **In-app notification feed only** | No push notification infrastructure (FCM/APNs) in the MVP. |
| Image storage (profile pictures) | Stored as image data associated with the user row in Postgres (small size limit enforced) | Avoids requiring a separate cloud storage account (e.g. AWS S3) for the MVP. **Assumption — flag if you'd rather use a cloud storage service from day one.** |

## 3. User Roles

- **Owner**: the user who created an environment. Can rename the environment, remove
  members, regenerate the invite code, and delete the environment. Can also do
  everything a member can do.
- **Member**: any other user who joined via invite code. Can create, edit, complete,
  and delete tasks, and manage their own profile.

A user's role is scoped per-environment (a user could be an owner of one household and
a member of another).

## 4. Functional Requirements

### 4.1 Authentication
- Sign up with email + password.
- Log in with email + password.
- Log out.
- No email verification and no "forgot password" flow in the MVP.

### 4.2 Environments (households)
- A logged-in user with **no environments** sees a screen offering two actions:
  **Create an environment** or **Join an environment** (via invite code).
- **Create environment**: user provides a name; they become its Owner; an invite code
  is generated automatically.
- **Join environment**: user enters an invite code; on success they're added as a
  Member.
- A user with **one or more environments** sees a **dashboard** listing all their
  environments (name + maybe a quick task summary, e.g. "3 tasks due this week").
- Tapping an environment opens its **task list** (Section 4.3).
- Owner-only actions: regenerate invite code, remove a member, delete the environment.
- Any member can view the member list and leave an environment voluntarily.

### 4.3 Tasks

Each task belongs to exactly one environment and has:

| Field | Notes |
|---|---|
| Short description | Shown in the task summary/list view. |
| Long description | Shown only when viewing/editing task details. |
| Deadline | A date (and optionally time) the task is due. |
| Date added | Set automatically when the task is created. |
| Frequency | One of: **One-off** (no repeat), **Daily**, **Weekly** (every N weeks), **Monthly** (same day each month). |
| Assignment type | **Rotational**, **Manual (fixed)**, or **Unassigned ("to be defined")** — see below. |
| Assigned user | The current member responsible (empty if Unassigned). |
| Status | Pending or Done. |

**Assignment types:**
- **Rotational**: cycles through the environment's members in the order they joined.
  When the current assignee marks it done, it automatically reassigns to the next
  member in that order (wrapping back to the start).
- **Manual (fixed)**: always assigned to the same, specifically chosen member.
- **Unassigned**: published with no owner; any member can "claim" it, after which it
  becomes a fixed Manual assignment to whoever claimed it (confirmed).

**Task actions:**
- Create a task (all fields above).
- Edit a task (any field).
- Mark a task as done:
  - **One-off task** → status becomes Done and is shown greyed out in the list until
    the end of the current week, then is **automatically deleted** when the next week
    starts. "Week" is treated as Monday–Sunday (ISO calendar week) — flag if you meant
    a different week boundary (e.g. Sunday–Saturday).
  - **Recurring task** → status resets to Pending, deadline advances to the next
    occurrence per its frequency, and (if Rotational) the assignee advances to the
    next member.
- Delete a task (manual, at any time — separate from the automatic cleanup above).

### 4.4 Notifications
- An in-app notification feed, scoped per environment, that a user can view (e.g. a
  bell icon with a list).
- Events that generate a notification for other environment members: a task is
  created, a task is completed, a task is reassigned/claimed, and a member
  joins/leaves the environment (confirmed).
- **Holiday mode** (Section 4.5) suppresses notification delivery for that user from
  that environment while active.

### 4.5 Profile
- View/edit display name.
- Add or change a profile picture.
- Add/edit a short bio (free text).
- **Holiday mode** toggle:
  - While ON: notifications from all of the user's environments are muted, **and**
    the user's turn in any Rotational task rotation is skipped (passed to the next
    member) until they turn it back off.
  - While OFF: normal behavior resumes.

## 5. Non-Functional Requirements
- Platform: iOS and Android (via React Native/Expo), targeting a phone form factor
  first (tablet layout not a priority for MVP).
- Passwords must be hashed (never stored in plaintext) on the backend.
- Basic input validation on both app and backend (e.g. required fields, valid email
  format).
- No offline mode required for MVP — app assumes an active internet connection to
  reach the backend.
- The backend needs a scheduled job (e.g. a weekly cron task) that deletes completed
  one-off tasks at the start of each new week, per Section 4.3.

## 6. Out of Scope for this MVP
- Real push notifications (FCM/APNs) — in-app feed only.
- Password reset / email verification.
- Fully custom recurrence rules (arbitrary intervals, specific weekdays).
- Manually reorderable rotation order (rotation always follows join order).
- Full task completion history/audit log (only current status + last completed info
  is tracked, not a permanent log of every past completion).
- In-app chat or comments on tasks.
- Multiple simultaneous device sessions / "remember me" nuances.
- Tablet-optimized or web/desktop layouts.
