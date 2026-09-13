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

const SCOPE = 'task';

let alice: TestUser;
let bob: TestUser;
let carol: TestUser;
let outsider: TestUser;

/** A date offset from today, as 'YYYY-MM-DD' in UTC — the same basis the server uses. */
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
  // Rotation depends on holiday mode, so never let one test leak into the next.
  await Promise.all([
    setHolidayMode(alice.userId, false),
    setHolidayMode(bob.userId, false),
    setHolidayMode(carol.userId, false),
  ]);
});

/** A household with alice as owner, then bob, then carol — that is the rotation order. */
async function createHousehold(members: TestUser[] = [bob, carol]) {
  const created = await post('/environments', { name: 'Flat 2B' }, alice.token);
  const household = created.body.environment;

  for (const member of members) {
    const joined = await post(
      '/environments/join',
      { inviteCode: household.inviteCode },
      member.token,
    );
    assert.equal(joined.status, 201, `${member.displayName} failed to join`);
  }
  return household;
}

async function createTask(householdId: string, overrides: Record<string, unknown> = {}) {
  const response = await post(
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
  return response;
}

describe('POST /environments/:id/tasks', () => {
  it('creates a task with all its fields', async () => {
    const household = await createHousehold();
    const response = await createTask(household.id, {
      shortDescription: 'Clean the kitchen',
      longDescription: 'Including the oven and the bin under the sink',
      deadline: '2026-12-01',
      frequency: 'weekly',
      frequencyInterval: 2,
      assignmentType: 'manual',
      assignedUserId: bob.userId,
    });

    assert.equal(response.status, 201);
    const task = response.body.task;
    assert.equal(task.shortDescription, 'Clean the kitchen');
    assert.equal(task.longDescription, 'Including the oven and the bin under the sink');
    assert.equal(task.deadline, '2026-12-01');
    assert.equal(task.frequency, 'weekly');
    assert.equal(task.frequencyInterval, 2);
    assert.equal(task.assignmentType, 'manual');
    assert.equal(task.assignedUserId, bob.userId);
    assert.equal(task.status, 'pending');
    assert.equal(task.createdBy, alice.userId);
  });

  it('returns the deadline as a plain date, with no time or timezone', async () => {
    const household = await createHousehold();
    const response = await createTask(household.id, { deadline: '2026-12-01' });
    assert.equal(response.body.task.deadline, '2026-12-01');
  });

  it('gives a rotational task its first turn to whoever created it', async () => {
    const household = await createHousehold();
    const response = await createTask(household.id, {
      frequency: 'weekly',
      assignmentType: 'rotational',
    });
    assert.equal(response.body.task.assignedUserId, alice.userId);
  });

  it('lets a rotational task name who starts', async () => {
    const household = await createHousehold();
    const response = await createTask(household.id, {
      frequency: 'weekly',
      assignmentType: 'rotational',
      assignedUserId: carol.userId,
    });
    assert.equal(response.body.task.assignedUserId, carol.userId);
  });

  it('leaves an unassigned task with nobody', async () => {
    const household = await createHousehold();
    const response = await createTask(household.id, { assignmentType: 'unassigned' });
    assert.equal(response.body.task.assignedUserId, null);
  });

  it('rejects a manual task with no assignee', async () => {
    const household = await createHousehold();
    const response = await createTask(household.id, { assignmentType: 'manual' });
    assert.equal(response.status, 400);
  });

  it('rejects an unassigned task that names an assignee', async () => {
    const household = await createHousehold();
    const response = await createTask(household.id, {
      assignmentType: 'unassigned',
      assignedUserId: bob.userId,
    });
    assert.equal(response.status, 400);
  });

  it('rejects assigning a task to someone outside the household', async () => {
    const household = await createHousehold();
    const response = await createTask(household.id, {
      assignmentType: 'manual',
      assignedUserId: outsider.userId,
    });
    assert.equal(response.status, 400);
  });

  it('rejects a missing description', async () => {
    const household = await createHousehold();
    const response = await createTask(household.id, { shortDescription: '' });
    assert.equal(response.status, 400);
  });

  it('rejects a deadline that is not a real date', async () => {
    const household = await createHousehold();
    assert.equal((await createTask(household.id, { deadline: '2026-02-31' })).status, 400);
    assert.equal((await createTask(household.id, { deadline: '01/12/2026' })).status, 400);
  });

  it('rejects an unknown frequency', async () => {
    const household = await createHousehold();
    assert.equal((await createTask(household.id, { frequency: 'fortnightly' })).status, 400);
  });

  it('stops someone outside the household creating tasks in it', async () => {
    const household = await createHousehold();
    const response = await post(
      `/environments/${household.id}/tasks`,
      {
        shortDescription: 'Sneaky',
        deadline: isoDate(),
        frequency: 'one_off',
        assignmentType: 'unassigned',
      },
      outsider.token,
    );
    assert.equal(response.status, 404);
  });
});

describe('GET /environments/:id/tasks', () => {
  it('lists the household’s tasks with pending ones first', async () => {
    const household = await createHousehold();
    const finished = await createTask(household.id, { shortDescription: 'Already done' });
    await post(`/tasks/${finished.body.task.id}/complete`, {}, alice.token);
    await createTask(household.id, { shortDescription: 'Still to do' });

    const response = await get(`/environments/${household.id}/tasks`, alice.token);

    assert.equal(response.status, 200);
    assert.equal(response.body.tasks.length, 2);
    assert.equal(response.body.tasks[0].shortDescription, 'Still to do');
    assert.equal(response.body.tasks[1].shortDescription, 'Already done');
  });

  it('hides tasks from people outside the household', async () => {
    const household = await createHousehold();
    await createTask(household.id);
    assert.equal((await get(`/environments/${household.id}/tasks`, outsider.token)).status, 404);
  });
});

describe('PATCH /tasks/:id', () => {
  it('updates the fields it is given and leaves the rest alone', async () => {
    const household = await createHousehold();
    const created = await createTask(household.id, { shortDescription: 'Original' });

    const response = await patch(
      `/tasks/${created.body.task.id}`,
      { shortDescription: 'Updated', deadline: '2027-01-15' },
      bob.token,
    );

    assert.equal(response.status, 200);
    assert.equal(response.body.task.shortDescription, 'Updated');
    assert.equal(response.body.task.deadline, '2027-01-15');
    assert.equal(response.body.task.frequency, 'one_off');
  });

  it('can hand a task to a different housemate', async () => {
    const household = await createHousehold();
    const created = await createTask(household.id, {
      assignmentType: 'manual',
      assignedUserId: bob.userId,
    });

    const response = await patch(
      `/tasks/${created.body.task.id}`,
      { assignedUserId: carol.userId },
      alice.token,
    );
    assert.equal(response.body.task.assignedUserId, carol.userId);
  });

  it('rejects an empty update', async () => {
    const household = await createHousehold();
    const created = await createTask(household.id);
    assert.equal((await patch(`/tasks/${created.body.task.id}`, {}, alice.token)).status, 400);
  });

  it('stops someone outside the household editing a task', async () => {
    const household = await createHousehold();
    const created = await createTask(household.id);
    const response = await patch(
      `/tasks/${created.body.task.id}`,
      { shortDescription: 'Hijacked' },
      outsider.token,
    );
    assert.equal(response.status, 404);
  });
});

describe('DELETE /tasks/:id', () => {
  it('removes the task', async () => {
    const household = await createHousehold();
    const created = await createTask(household.id);

    assert.equal((await del(`/tasks/${created.body.task.id}`, bob.token)).status, 204);
    assert.equal((await get(`/tasks/${created.body.task.id}`, bob.token)).status, 404);
  });
});

describe('POST /tasks/:id/complete — one-off tasks', () => {
  it('marks the task done and records who did it', async () => {
    const household = await createHousehold();
    const created = await createTask(household.id, { frequency: 'one_off' });

    const response = await post(`/tasks/${created.body.task.id}/complete`, {}, bob.token);

    assert.equal(response.status, 200);
    assert.equal(response.body.task.status, 'done');
    assert.equal(response.body.task.completedBy, bob.userId);
    assert.ok(response.body.task.completedAt);
  });

  it('refuses to complete the same one-off task twice', async () => {
    const household = await createHousehold();
    const created = await createTask(household.id, { frequency: 'one_off' });

    await post(`/tasks/${created.body.task.id}/complete`, {}, alice.token);
    const second = await post(`/tasks/${created.body.task.id}/complete`, {}, alice.token);

    assert.equal(second.status, 409);
  });
});

describe('POST /tasks/:id/complete — repeating tasks', () => {
  it('moves a daily task to tomorrow and keeps it pending', async () => {
    const household = await createHousehold();
    const created = await createTask(household.id, {
      frequency: 'daily',
      deadline: isoDate(),
    });

    const response = await post(`/tasks/${created.body.task.id}/complete`, {}, alice.token);

    assert.equal(response.body.task.status, 'pending');
    assert.equal(response.body.task.deadline, isoDate(1));
    assert.ok(response.body.task.completedAt);
  });

  it('catches an overdue weekly task up to a future date', async () => {
    const household = await createHousehold();
    const created = await createTask(household.id, {
      frequency: 'weekly',
      deadline: isoDate(-20),
    });

    const response = await post(`/tasks/${created.body.task.id}/complete`, {}, alice.token);
    assert.ok(
      response.body.task.deadline > isoDate(),
      `expected a future deadline, got ${response.body.task.deadline}`,
    );
  });

  it('leaves a manually assigned task with the same person', async () => {
    const household = await createHousehold();
    const created = await createTask(household.id, {
      frequency: 'weekly',
      assignmentType: 'manual',
      assignedUserId: bob.userId,
    });

    const response = await post(`/tasks/${created.body.task.id}/complete`, {}, bob.token);
    assert.equal(response.body.task.assignedUserId, bob.userId);
  });
});

describe('POST /tasks/:id/complete — rotation', () => {
  it('passes the task to the next housemate in join order', async () => {
    const household = await createHousehold();
    const created = await createTask(household.id, {
      frequency: 'weekly',
      assignmentType: 'rotational',
    });
    const taskId = created.body.task.id;

    // alice → bob → carol → alice
    let response = await post(`/tasks/${taskId}/complete`, {}, alice.token);
    assert.equal(response.body.task.assignedUserId, bob.userId);

    response = await post(`/tasks/${taskId}/complete`, {}, bob.token);
    assert.equal(response.body.task.assignedUserId, carol.userId);

    response = await post(`/tasks/${taskId}/complete`, {}, carol.token);
    assert.equal(response.body.task.assignedUserId, alice.userId);
  });

  it('skips a housemate who is on holiday', async () => {
    const household = await createHousehold();
    const created = await createTask(household.id, {
      frequency: 'weekly',
      assignmentType: 'rotational',
    });
    await setHolidayMode(bob.userId, true);

    const response = await post(`/tasks/${created.body.task.id}/complete`, {}, alice.token);
    assert.equal(response.body.task.assignedUserId, carol.userId);
  });

  it('returns the task to the only person home, flagged as covering', async () => {
    const household = await createHousehold();
    const created = await createTask(household.id, {
      frequency: 'weekly',
      assignmentType: 'rotational',
    });
    await setHolidayMode(bob.userId, true);
    await setHolidayMode(carol.userId, true);

    const response = await post(`/tasks/${created.body.task.id}/complete`, {}, alice.token);

    assert.equal(response.body.task.assignedUserId, alice.userId);
    assert.equal(response.body.task.assignedWhileCovering, true);
  });

  it('clears the covering flag once housemates are back', async () => {
    const household = await createHousehold();
    const created = await createTask(household.id, {
      frequency: 'weekly',
      assignmentType: 'rotational',
    });
    const taskId = created.body.task.id;

    await setHolidayMode(bob.userId, true);
    await setHolidayMode(carol.userId, true);
    const covering = await post(`/tasks/${taskId}/complete`, {}, alice.token);
    assert.equal(covering.body.task.assignedWhileCovering, true);

    await setHolidayMode(bob.userId, false);
    await setHolidayMode(carol.userId, false);
    const back = await post(`/tasks/${taskId}/complete`, {}, alice.token);

    assert.equal(back.body.task.assignedUserId, bob.userId);
    assert.equal(back.body.task.assignedWhileCovering, false);
  });

  it('passes the task on rather than back when the whole household is away', async () => {
    const household = await createHousehold();
    const created = await createTask(household.id, {
      frequency: 'weekly',
      assignmentType: 'rotational',
    });
    await setHolidayMode(alice.userId, true);
    await setHolidayMode(bob.userId, true);
    await setHolidayMode(carol.userId, true);

    const response = await post(`/tasks/${created.body.task.id}/complete`, {}, alice.token);

    assert.equal(response.body.task.assignedUserId, bob.userId);
    assert.equal(response.body.task.assignedWhileCovering, false);
  });
});

describe('POST /tasks/:id/claim', () => {
  it('gives an unassigned task to whoever claims it', async () => {
    const household = await createHousehold();
    const created = await createTask(household.id, { assignmentType: 'unassigned' });

    const response = await post(`/tasks/${created.body.task.id}/claim`, {}, carol.token);

    assert.equal(response.status, 200);
    assert.equal(response.body.task.assignedUserId, carol.userId);
    // Claiming fixes it to that person, per the requirements.
    assert.equal(response.body.task.assignmentType, 'manual');
  });

  it('refuses to claim a task that already has an owner', async () => {
    const household = await createHousehold();
    const created = await createTask(household.id, { assignmentType: 'unassigned' });

    await post(`/tasks/${created.body.task.id}/claim`, {}, bob.token);
    const second = await post(`/tasks/${created.body.task.id}/claim`, {}, carol.token);

    assert.equal(second.status, 409);
  });
});

describe('tasks left behind when someone leaves', () => {
  it('unassigns their tasks so nothing is owned by a former housemate', async () => {
    const household = await createHousehold();
    const created = await createTask(household.id, {
      assignmentType: 'manual',
      assignedUserId: bob.userId,
    });

    await del(`/environments/${household.id}/members/${bob.userId}`, bob.token);

    const response = await get(`/tasks/${created.body.task.id}`, alice.token);
    assert.equal(response.body.task.assignedUserId, null);
  });
});
