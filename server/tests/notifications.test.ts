import { after, before, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  del,
  deleteTestData,
  get,
  patch,
  post,
  setHolidayMode,
  signUp,
  startTestServer,
  stopTestServer,
  type TestUser,
} from './helpers';

const SCOPE = 'notif';

let alice: TestUser;
let bob: TestUser;
let carol: TestUser;
let outsider: TestUser;

function isoDate(offsetDays = 0): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

before(async () => {
  await startTestServer();
  await deleteTestData(SCOPE);
  alice = await signUp(SCOPE, 'alice');
  bob = await signUp(SCOPE, 'bob');
  carol = await signUp(SCOPE, 'carol');
  outsider = await signUp(SCOPE, 'outsider');
});

after(async () => {
  await deleteTestData(SCOPE);
  await stopTestServer();
});

beforeEach(async () => {
  await Promise.all([
    setHolidayMode(alice.userId, false),
    setHolidayMode(bob.userId, false),
    setHolidayMode(carol.userId, false),
  ]);
});

async function createHousehold(members: TestUser[] = [bob, carol]) {
  const created = await post('/environments', { name: 'Flat 2B' }, alice.token);
  const household = created.body.environment;
  for (const member of members) {
    await post('/environments/join', { inviteCode: household.inviteCode }, member.token);
  }
  return household;
}

async function createTask(householdId: string, overrides: Record<string, unknown> = {}) {
  return post(
    `/environments/${householdId}/tasks`,
    {
      shortDescription: 'Take the bins out',
      deadline: isoDate(),
      frequency: 'one_off',
      assignmentType: 'unassigned',
      ...overrides,
    },
    alice.token,
  );
}

async function feedOf(user: TestUser, householdId: string) {
  const response = await get(`/environments/${householdId}/notifications`, user.token);
  assert.equal(response.status, 200);
  return response.body;
}

describe('who gets notified', () => {
  it('tells the other housemates when a task is added', async () => {
    const household = await createHousehold();
    await createTask(household.id, { shortDescription: 'Clean the oven' });

    const feed = await feedOf(bob, household.id);
    const added = feed.notifications.find((n: any) => n.type === 'task_created');

    assert.ok(added, 'bob should have been told about the new task');
    assert.match(added.message, /alice/i);
    assert.match(added.message, /Clean the oven/);
  });

  it('does not notify the person who did it', async () => {
    const household = await createHousehold();
    await createTask(household.id);

    const feed = await feedOf(alice, household.id);
    assert.equal(
      feed.notifications.filter((n: any) => n.type === 'task_created').length,
      0,
      'alice created the task, so should not be notified about it',
    );
  });

  it('reaches every other member, not just one', async () => {
    const household = await createHousehold();
    await createTask(household.id);

    for (const member of [bob, carol]) {
      const feed = await feedOf(member, household.id);
      assert.ok(feed.notifications.some((n: any) => n.type === 'task_created'));
    }
  });

  it('links the notification back to the task it is about', async () => {
    const household = await createHousehold();
    const task = await createTask(household.id);

    const feed = await feedOf(bob, household.id);
    const added = feed.notifications.find((n: any) => n.type === 'task_created');
    assert.equal(added.taskId, task.body.task.id);
  });
});

describe('events that generate notifications', () => {
  it('announces a completed task', async () => {
    const household = await createHousehold();
    const task = await createTask(household.id);
    await post(`/tasks/${task.body.task.id}/complete`, {}, bob.token);

    const feed = await feedOf(carol, household.id);
    const done = feed.notifications.find((n: any) => n.type === 'task_completed');

    assert.ok(done);
    assert.match(done.message, /bob/i);
  });

  it('announces a claimed task', async () => {
    const household = await createHousehold();
    const task = await createTask(household.id, { assignmentType: 'unassigned' });
    await post(`/tasks/${task.body.task.id}/claim`, {}, carol.token);

    const feed = await feedOf(bob, household.id);
    const claimed = feed.notifications.find((n: any) => n.type === 'task_claimed');

    assert.ok(claimed);
    assert.match(claimed.message, /carol/i);
  });

  it('announces a task changing hands, naming who now has it', async () => {
    const household = await createHousehold();
    const task = await createTask(household.id, {
      assignmentType: 'manual',
      assignedUserId: bob.userId,
    });

    await patch(`/tasks/${task.body.task.id}`, { assignedUserId: carol.userId }, alice.token);

    const feed = await feedOf(bob, household.id);
    const reassigned = feed.notifications.find((n: any) => n.type === 'task_reassigned');

    assert.ok(reassigned);
    assert.match(reassigned.message, /carol/i);
  });

  it('stays quiet about edits that do not change who is responsible', async () => {
    const household = await createHousehold();
    const task = await createTask(household.id);
    await patch(`/tasks/${task.body.task.id}`, { shortDescription: 'Reworded' }, alice.token);

    const feed = await feedOf(bob, household.id);
    assert.equal(feed.notifications.filter((n: any) => n.type === 'task_reassigned').length, 0);
  });

  it('announces someone joining', async () => {
    const household = await createHousehold([bob]);
    await post('/environments/join', { inviteCode: household.inviteCode }, carol.token);

    const feed = await feedOf(bob, household.id);
    const joined = feed.notifications.find((n: any) => n.type === 'member_joined');

    assert.ok(joined);
    assert.match(joined.message, /carol/i);
  });

  it('announces someone leaving, without telling the person who left', async () => {
    const household = await createHousehold();
    await del(`/environments/${household.id}/members/${carol.userId}`, carol.token);

    const remaining = await feedOf(bob, household.id);
    assert.ok(remaining.notifications.some((n: any) => n.type === 'member_left'));

    // Carol is no longer a member, so the feed isn't hers to read any more.
    const response = await get(`/environments/${household.id}/notifications`, carol.token);
    assert.equal(response.status, 404);
  });

  it('announces the owner removing someone', async () => {
    const household = await createHousehold();
    await del(`/environments/${household.id}/members/${carol.userId}`, alice.token);

    const feed = await feedOf(bob, household.id);
    const removed = feed.notifications.find((n: any) => n.type === 'member_left');

    assert.ok(removed);
    assert.match(removed.message, /carol/i);
  });
});

describe('the feed itself', () => {
  it('returns newest first', async () => {
    const household = await createHousehold();
    await createTask(household.id, { shortDescription: 'First task' });
    await createTask(household.id, { shortDescription: 'Second task' });

    const feed = await feedOf(bob, household.id);
    const created = feed.notifications.filter((n: any) => n.type === 'task_created');

    assert.ok(created.length >= 2);
    assert.ok(created[0].createdAt >= created[1].createdAt);
  });

  it('only shows notifications from the household being viewed', async () => {
    const first = await createHousehold();
    const second = await createHousehold();
    await createTask(first.id, { shortDescription: 'Only in the first flat' });

    const feed = await feedOf(bob, second.id);
    assert.equal(
      feed.notifications.filter((n: any) => n.message.includes('Only in the first flat')).length,
      0,
    );
  });

  it('refuses the feed to someone outside the household', async () => {
    const household = await createHousehold();
    const response = await get(`/environments/${household.id}/notifications`, outsider.token);
    assert.equal(response.status, 404);
  });
});

describe('unread count', () => {
  it('counts new notifications', async () => {
    const household = await createHousehold();
    await createTask(household.id);

    const feed = await feedOf(bob, household.id);
    assert.ok(feed.unreadCount > 0);
  });

  it('drops to zero once the feed is marked read', async () => {
    const household = await createHousehold();
    await createTask(household.id);

    const marked = await post(`/environments/${household.id}/notifications/read`, {}, bob.token);
    assert.equal(marked.status, 200);

    const feed = await feedOf(bob, household.id);
    assert.equal(feed.unreadCount, 0);
    assert.ok(feed.notifications.length > 0, 'marking read must not empty the feed');
  });

  it('counts again when something new happens', async () => {
    const household = await createHousehold();
    await createTask(household.id);
    await post(`/environments/${household.id}/notifications/read`, {}, bob.token);
    await createTask(household.id, { shortDescription: 'Something newer' });

    assert.equal((await feedOf(bob, household.id)).unreadCount, 1);
  });
});

describe('holiday mode', () => {
  it('silences the badge without losing the notifications', async () => {
    const household = await createHousehold();
    await setHolidayMode(bob.userId, true);
    await createTask(household.id, { shortDescription: 'Happened while away' });

    const feed = await feedOf(bob, household.id);

    assert.equal(feed.unreadCount, 0, 'badge should be silent on holiday');
    assert.equal(feed.holidayMode, true);
    assert.ok(
      feed.notifications.some((n: any) => n.message.includes('Happened while away')),
      'the notification should still be recorded so it can be caught up on',
    );
  });

  it('shows what was missed once holiday mode is switched off', async () => {
    const household = await createHousehold();
    await setHolidayMode(bob.userId, true);
    await createTask(household.id, { shortDescription: 'Missed while away' });

    assert.equal((await feedOf(bob, household.id)).unreadCount, 0);

    await setHolidayMode(bob.userId, false);
    const afterReturning = await feedOf(bob, household.id);

    assert.ok(afterReturning.unreadCount > 0, 'coming back should reveal what was missed');
    assert.equal(afterReturning.holidayMode, false);
  });

  it('does not silence other housemates', async () => {
    const household = await createHousehold();
    await setHolidayMode(bob.userId, true);
    await createTask(household.id);

    assert.ok((await feedOf(carol, household.id)).unreadCount > 0);
  });
});
