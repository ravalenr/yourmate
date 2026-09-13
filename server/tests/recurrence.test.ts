import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { nextDeadline } from '../src/services/recurrence';

// These are pure functions: no server, no database, no clock. Every test passes an
// explicit "today" so the results can never drift with the calendar.

describe('nextDeadline — daily', () => {
  it('moves to the next day', () => {
    assert.equal(nextDeadline('2026-09-13', 'daily', 1, '2026-09-13'), '2026-09-14');
  });

  it('crosses a month boundary', () => {
    assert.equal(nextDeadline('2026-09-30', 'daily', 1, '2026-09-30'), '2026-10-01');
  });

  it('crosses a year boundary', () => {
    assert.equal(nextDeadline('2026-12-31', 'daily', 1, '2026-12-31'), '2027-01-01');
  });
});

describe('nextDeadline — weekly', () => {
  it('moves forward seven days', () => {
    assert.equal(nextDeadline('2026-09-13', 'weekly', 1, '2026-09-13'), '2026-09-20');
  });

  it('honours an interval of more than one week', () => {
    assert.equal(nextDeadline('2026-09-13', 'weekly', 2, '2026-09-13'), '2026-09-27');
  });
});

describe('nextDeadline — monthly', () => {
  it('keeps the same day of the month', () => {
    assert.equal(nextDeadline('2026-01-15', 'monthly', 1, '2026-01-15'), '2026-02-15');
  });

  it('clamps 31 January to the end of February rather than overflowing into March', () => {
    assert.equal(nextDeadline('2026-01-31', 'monthly', 1, '2026-01-31'), '2026-02-28');
  });

  it('clamps to 29 February in a leap year', () => {
    assert.equal(nextDeadline('2028-01-31', 'monthly', 1, '2028-01-31'), '2028-02-29');
  });

  it('stays on the clamped day afterwards instead of jumping back to the 31st', () => {
    assert.equal(nextDeadline('2026-02-28', 'monthly', 1, '2026-02-28'), '2026-03-28');
  });
});

describe('nextDeadline — overdue tasks', () => {
  it('keeps advancing until the new deadline is in the future', () => {
    // Due three weeks ago. Adding a single week would still leave it overdue.
    const result = nextDeadline('2026-08-25', 'weekly', 1, '2026-09-13');
    assert.ok(result > '2026-09-13', `expected a future date, got ${result}`);
  });

  it('preserves the original rhythm rather than restarting from today', () => {
    // 25 Aug + 21 days = 15 Sep: still the same weekday, three whole weeks on.
    assert.equal(nextDeadline('2026-08-25', 'weekly', 1, '2026-09-13'), '2026-09-15');
  });

  it('does not fall due again on the same day it was completed', () => {
    const result = nextDeadline('2026-09-06', 'weekly', 1, '2026-09-13');
    assert.notEqual(result, '2026-09-13');
    assert.equal(result, '2026-09-20');
  });

  it('catches up a long-overdue daily task', () => {
    assert.equal(nextDeadline('2026-09-01', 'daily', 1, '2026-09-13'), '2026-09-14');
  });
});

describe('nextDeadline — one-off', () => {
  it('refuses to produce a next deadline', () => {
    assert.throws(() => nextDeadline('2026-09-13', 'one_off', 1, '2026-09-13'));
  });
});
