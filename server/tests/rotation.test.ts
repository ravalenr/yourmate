import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { nextAssignee, type RotationMember } from '../src/services/rotation';

// Members are given in join order, because that ordering *is* the rotation.
const alice: RotationMember = { id: 'alice', holidayMode: false };
const bob: RotationMember = { id: 'bob', holidayMode: false };
const carol: RotationMember = { id: 'carol', holidayMode: false };

const away = (member: RotationMember): RotationMember => ({ ...member, holidayMode: true });

describe('nextAssignee — everyone available', () => {
  it('passes the task to the next person in join order', () => {
    const result = nextAssignee([alice, bob, carol], 'alice');
    assert.equal(result.assigneeId, 'bob');
    assert.equal(result.covering, false);
  });

  it('wraps around from the last person back to the first', () => {
    assert.equal(nextAssignee([alice, bob, carol], 'carol').assigneeId, 'alice');
  });
});

describe('nextAssignee — some people away', () => {
  it('skips a housemate who is on holiday', () => {
    const result = nextAssignee([alice, away(bob), carol], 'alice');
    assert.equal(result.assigneeId, 'carol');
    assert.equal(result.covering, false);
  });

  it('skips several in a row', () => {
    const result = nextAssignee([alice, away(bob), away(carol)], 'alice');
    assert.equal(result.assigneeId, 'alice');
  });

  it('flags it as covering when the task comes back to the only person at home', () => {
    // Alice just did it, Bob and Carol are away, so it returns to Alice. She keeps
    // it — chores shouldn't stall — but the app should say she's covering.
    const result = nextAssignee([alice, away(bob), away(carol)], 'alice');
    assert.equal(result.assigneeId, 'alice');
    assert.equal(result.covering, true);
  });
});

describe('nextAssignee — everyone away', () => {
  it('passes it on rather than handing it back to whoever just did it', () => {
    const result = nextAssignee([away(alice), away(bob), away(carol)], 'alice');
    assert.equal(result.assigneeId, 'bob');
    assert.equal(result.covering, false);
  });

  it('wraps around when the last person completes it', () => {
    const result = nextAssignee([away(alice), away(bob), away(carol)], 'carol');
    assert.equal(result.assigneeId, 'alice');
  });
});

describe('nextAssignee — edge cases', () => {
  it('returns the task to the only member of a one-person household', () => {
    const result = nextAssignee([alice], 'alice');
    assert.equal(result.assigneeId, 'alice');
    // Nobody to cover for, so this isn't "covering".
    assert.equal(result.covering, false);
  });

  it('returns the sole member even when they are on holiday', () => {
    assert.equal(nextAssignee([away(alice)], 'alice').assigneeId, 'alice');
  });

  it('starts from the first member when the task has no current holder', () => {
    assert.equal(nextAssignee([alice, bob, carol], null).assigneeId, 'alice');
  });

  it('starts from the first member when the holder has left the household', () => {
    assert.equal(nextAssignee([alice, bob, carol], 'someone-who-left').assigneeId, 'alice');
  });

  it('refuses to rotate in an empty household', () => {
    assert.throws(() => nextAssignee([], 'alice'));
  });
});
