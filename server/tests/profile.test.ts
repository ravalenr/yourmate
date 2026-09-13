import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  del,
  deleteTestData,
  get,
  getRaw,
  patch,
  put,
  signUp,
  startTestServer,
  stopTestServer,
  type TestUser,
} from './helpers';

const SCOPE = 'profile';

let alice: TestUser;
let bob: TestUser;

// A 1x1 transparent PNG, the smallest valid image to prove uploads round-trip.
const TINY_PNG =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

before(async () => {
  await startTestServer();
  await deleteTestData(SCOPE);
  alice = await signUp(SCOPE, 'alice');
  bob = await signUp(SCOPE, 'bob');
});

after(async () => {
  await deleteTestData(SCOPE);
  await stopTestServer();
});

describe('GET /me', () => {
  it('returns the signed-in user', async () => {
    const response = await get('/me', alice.token);
    assert.equal(response.status, 200);
    assert.equal(response.body.user.email, alice.email);
  });

  it('requires a token', async () => {
    assert.equal((await get('/me')).status, 401);
  });
});

describe('PATCH /me', () => {
  it('updates the display name', async () => {
    const response = await patch('/me', { displayName: 'Alice Renamed' }, alice.token);
    assert.equal(response.status, 200);
    assert.equal(response.body.user.displayName, 'Alice Renamed');
  });

  it('sets and clears the bio', async () => {
    const set = await patch('/me', { bio: 'Lives for a tidy kitchen' }, alice.token);
    assert.equal(set.body.user.bio, 'Lives for a tidy kitchen');

    const cleared = await patch('/me', { bio: null }, alice.token);
    assert.equal(cleared.body.user.bio, null);
  });

  it('toggles holiday mode', async () => {
    assert.equal((await patch('/me', { holidayMode: true }, alice.token)).body.user.holidayMode, true);
    assert.equal(
      (await patch('/me', { holidayMode: false }, alice.token)).body.user.holidayMode,
      false,
    );
  });

  it('rejects an empty update', async () => {
    assert.equal((await patch('/me', {}, alice.token)).status, 400);
  });

  it('rejects a bio beyond the length limit', async () => {
    const response = await patch('/me', { bio: 'x'.repeat(281) }, alice.token);
    assert.equal(response.status, 400);
  });

  it('rejects a non-boolean holiday mode', async () => {
    assert.equal((await patch('/me', { holidayMode: 'yes' }, alice.token)).status, 400);
  });

  it('never lets one user edit another', async () => {
    // There is no route that takes someone else's id: /me is always the caller.
    await patch('/me', { displayName: 'Bob Only' }, bob.token);
    const aliceNow = await get('/me', alice.token);
    assert.notEqual(aliceNow.body.user.displayName, 'Bob Only');
  });
});

describe('avatars', () => {
  it('reports no avatar to begin with', async () => {
    assert.equal((await get('/me', bob.token)).body.user.hasAvatar, false);
  });

  it('returns 404 for a user who has no picture', async () => {
    assert.equal((await getRaw(`/users/${alice.userId}/avatar`, bob.token)).status, 404);
  });

  it('accepts an upload and serves it back as a real image', async () => {
    const uploaded = await put('/me/avatar', { data: TINY_PNG, mimeType: 'image/png' }, bob.token);
    assert.equal(uploaded.status, 200);
    assert.equal(uploaded.body.user.hasAvatar, true);

    const served = await getRaw(`/users/${bob.userId}/avatar`, bob.token);
    assert.equal(served.status, 200);
    assert.equal(served.contentType, 'image/png');
    assert.equal(served.bytes, Buffer.from(TINY_PNG, 'base64').length);
  });

  it('lets a housemate fetch someone else’s picture', async () => {
    assert.equal((await getRaw(`/users/${bob.userId}/avatar`, alice.token)).status, 200);
  });

  it('rejects an image type that is not allowed', async () => {
    const response = await put(
      '/me/avatar',
      { data: TINY_PNG, mimeType: 'image/gif' },
      bob.token,
    );
    assert.equal(response.status, 400);
  });

  it('rejects a picture over the size limit', async () => {
    const tooBig = Buffer.alloc(1_000_001, 1).toString('base64');
    const response = await put('/me/avatar', { data: tooBig, mimeType: 'image/png' }, bob.token);
    assert.equal(response.status, 400);
  });

  it('refuses an avatar request with no token', async () => {
    assert.equal((await getRaw(`/users/${bob.userId}/avatar`)).status, 401);
  });

  it('returns 404 for an id that is not a UUID', async () => {
    assert.equal((await getRaw('/users/not-a-uuid/avatar', bob.token)).status, 404);
  });

  it('removes the picture again', async () => {
    const removed = await del('/me/avatar', bob.token);
    assert.equal(removed.status, 200);
    assert.equal(removed.body.user.hasAvatar, false);
    assert.equal((await getRaw(`/users/${bob.userId}/avatar`, bob.token)).status, 404);
  });
});
