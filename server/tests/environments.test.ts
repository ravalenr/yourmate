import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  del,
  deleteTestData,
  get,
  patch,
  post,
  signUp,
  startTestServer,
  stopTestServer,
  type TestUser,
} from './helpers';

const SCOPE = 'env';

let owner: TestUser;
let housemate: TestUser;
let outsider: TestUser;

before(async () => {
  await startTestServer();
  await deleteTestData(SCOPE);
  owner = await signUp(SCOPE, 'owner');
  housemate = await signUp(SCOPE, 'housemate');
  outsider = await signUp(SCOPE, 'outsider');
});

after(async () => {
  await deleteTestData(SCOPE);
  await stopTestServer();
});

/** Creates a household owned by `owner` and returns it. */
async function createHousehold(name = 'Flat 2B') {
  const response = await post('/environments', { name }, owner.token);
  assert.equal(response.status, 201);
  return response.body.environment;
}

describe('POST /environments', () => {
  it('creates a household with the creator as owner', async () => {
    const environment = await createHousehold('Test Creation');

    assert.equal(environment.name, 'Test Creation');
    assert.equal(environment.role, 'owner');
    assert.equal(environment.memberCount, 1);
    assert.equal(environment.pendingTaskCount, 0);
  });

  it('generates a 6-character invite code with no look-alike characters', async () => {
    const environment = await createHousehold();
    assert.match(environment.inviteCode, /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/);
  });

  it('gives each household a different invite code', async () => {
    const a = await createHousehold();
    const b = await createHousehold();
    assert.notEqual(a.inviteCode, b.inviteCode);
  });

  it('rejects a missing name', async () => {
    assert.equal((await post('/environments', {}, owner.token)).status, 400);
  });

  it('requires a signed-in user', async () => {
    assert.equal((await post('/environments', { name: 'Nope' })).status, 401);
  });
});

describe('GET /environments', () => {
  it('lists only the households the user belongs to', async () => {
    const mine = await createHousehold('Mine');
    const response = await get('/environments', owner.token);

    assert.equal(response.status, 200);
    const ids = response.body.environments.map((e: any) => e.id);
    assert.ok(ids.includes(mine.id));
  });

  it('returns an empty list for someone with no households', async () => {
    const response = await get('/environments', outsider.token);
    assert.deepEqual(response.body.environments, []);
  });
});

describe('POST /environments/join', () => {
  it('adds the user as a member', async () => {
    const household = await createHousehold();
    const response = await post(
      '/environments/join',
      { inviteCode: household.inviteCode },
      housemate.token,
    );

    assert.equal(response.status, 201);
    assert.equal(response.body.environment.id, household.id);
    assert.equal(response.body.environment.role, 'member');
    assert.equal(response.body.environment.memberCount, 2);
  });

  it('accepts the code in lower case and with stray spaces', async () => {
    const household = await createHousehold();
    const messyCode = `  ${household.inviteCode.toLowerCase()} `;
    const response = await post('/environments/join', { inviteCode: messyCode }, housemate.token);

    assert.equal(response.status, 201);
  });

  it('rejects an unknown invite code', async () => {
    const response = await post('/environments/join', { inviteCode: 'ZZZZZZ' }, housemate.token);
    assert.equal(response.status, 404);
  });

  it('rejects joining a household twice', async () => {
    const household = await createHousehold();
    await post('/environments/join', { inviteCode: household.inviteCode }, housemate.token);
    const second = await post(
      '/environments/join',
      { inviteCode: household.inviteCode },
      housemate.token,
    );

    assert.equal(second.status, 409);
  });
});

describe('GET /environments/:id', () => {
  it('returns the household with its members in join order', async () => {
    const household = await createHousehold();
    await post('/environments/join', { inviteCode: household.inviteCode }, housemate.token);

    const response = await get(`/environments/${household.id}`, owner.token);

    assert.equal(response.status, 200);
    assert.equal(response.body.members.length, 2);
    assert.equal(response.body.members[0].id, owner.userId);
    assert.equal(response.body.members[0].role, 'owner');
    assert.equal(response.body.members[1].id, housemate.userId);
    assert.equal(response.body.members[1].role, 'member');
  });

  it('never exposes housemates’ email addresses', async () => {
    const household = await createHousehold();
    await post('/environments/join', { inviteCode: household.inviteCode }, housemate.token);

    const response = await get(`/environments/${household.id}`, owner.token);
    assert.ok(!JSON.stringify(response.body.members).includes('@'));
  });

  it('answers "not found" to a non-member rather than revealing it exists', async () => {
    const household = await createHousehold();
    const response = await get(`/environments/${household.id}`, outsider.token);
    assert.equal(response.status, 404);
  });

  it('returns 404 for an id that is not a valid UUID', async () => {
    assert.equal((await get('/environments/not-a-uuid', owner.token)).status, 404);
  });
});

describe('PATCH /environments/:id', () => {
  it('lets the owner rename the household', async () => {
    const household = await createHousehold();
    const response = await patch(
      `/environments/${household.id}`,
      { name: 'Renamed Flat' },
      owner.token,
    );

    assert.equal(response.status, 200);
    assert.equal(response.body.environment.name, 'Renamed Flat');
  });

  it('stops a plain member from renaming it', async () => {
    const household = await createHousehold();
    await post('/environments/join', { inviteCode: household.inviteCode }, housemate.token);

    const response = await patch(
      `/environments/${household.id}`,
      { name: 'Hijacked' },
      housemate.token,
    );
    assert.equal(response.status, 403);
  });
});

describe('POST /environments/:id/invite-code', () => {
  it('replaces the code and invalidates the old one', async () => {
    const household = await createHousehold();
    const oldCode = household.inviteCode;

    const response = await post(`/environments/${household.id}/invite-code`, {}, owner.token);
    assert.equal(response.status, 200);
    assert.notEqual(response.body.environment.inviteCode, oldCode);

    const joinWithOld = await post('/environments/join', { inviteCode: oldCode }, housemate.token);
    assert.equal(joinWithOld.status, 404);
  });

  it('stops a plain member from regenerating it', async () => {
    const household = await createHousehold();
    await post('/environments/join', { inviteCode: household.inviteCode }, housemate.token);

    const response = await post(`/environments/${household.id}/invite-code`, {}, housemate.token);
    assert.equal(response.status, 403);
  });
});

describe('DELETE /environments/:id', () => {
  it('lets the owner delete the household', async () => {
    const household = await createHousehold();
    assert.equal((await del(`/environments/${household.id}`, owner.token)).status, 204);
    assert.equal((await get(`/environments/${household.id}`, owner.token)).status, 404);
  });

  it('stops a plain member from deleting it', async () => {
    const household = await createHousehold();
    await post('/environments/join', { inviteCode: household.inviteCode }, housemate.token);

    assert.equal((await del(`/environments/${household.id}`, housemate.token)).status, 403);
  });
});

describe('DELETE /environments/:id/members/:userId', () => {
  it('lets the owner remove a member', async () => {
    const household = await createHousehold();
    await post('/environments/join', { inviteCode: household.inviteCode }, housemate.token);

    const response = await del(
      `/environments/${household.id}/members/${housemate.userId}`,
      owner.token,
    );

    assert.equal(response.status, 204);
    assert.equal((await get(`/environments/${household.id}`, housemate.token)).status, 404);
  });

  it('lets a member leave of their own accord', async () => {
    const household = await createHousehold();
    await post('/environments/join', { inviteCode: household.inviteCode }, housemate.token);

    const response = await del(
      `/environments/${household.id}/members/${housemate.userId}`,
      housemate.token,
    );
    assert.equal(response.status, 204);
  });

  it('stops a member removing someone else', async () => {
    const household = await createHousehold();
    await post('/environments/join', { inviteCode: household.inviteCode }, housemate.token);

    const response = await del(
      `/environments/${household.id}/members/${owner.userId}`,
      housemate.token,
    );
    assert.equal(response.status, 403);
  });

  it('hands ownership to the longest-standing member when the owner leaves', async () => {
    const household = await createHousehold();
    await post('/environments/join', { inviteCode: household.inviteCode }, housemate.token);

    const leave = await del(`/environments/${household.id}/members/${owner.userId}`, owner.token);
    assert.equal(leave.status, 204);

    const response = await get(`/environments/${household.id}`, housemate.token);
    assert.equal(response.body.environment.role, 'owner');
    assert.equal(response.body.members.length, 1);
  });

  it('refuses to let a sole owner leave, since it would strand the household', async () => {
    const household = await createHousehold();

    const response = await del(
      `/environments/${household.id}/members/${owner.userId}`,
      owner.token,
    );
    assert.equal(response.status, 400);
  });
});
