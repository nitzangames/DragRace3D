import { test } from 'node:test';
import assert from 'node:assert/strict';
import { weeklyChallenge, boardKey, _setMockSDK, submitRun, fetchTop, fetchTopGhost } from '../js/leaderboard.js';
import { balance } from '../js/balance.js';

const N_CARS = balance.cars.length;

test('weeklyChallenge returns deterministic car/class for a given week', () => {
  const a = weeklyChallenge(1234);
  const b = weeklyChallenge(1234);
  assert.deepEqual(a, b);
  assert.equal(a.week, 1234);
  assert.ok(a.carIdx >= 0 && a.carIdx < N_CARS);
  assert.ok(a.classIndex >= 0 && a.classIndex < 6);
});

test('weeklyChallenge varies across consecutive weeks', () => {
  const a = weeklyChallenge(1000);
  const b = weeklyChallenge(1001);
  // At least one of (carIdx, classIndex) should differ — otherwise hash is broken.
  assert.ok(a.carIdx !== b.carIdx || a.classIndex !== b.classIndex);
});

test('boardKey is week-isolated', () => {
  assert.equal(boardKey(42), 'rotw-week-42');
  assert.notEqual(boardKey(42), boardKey(43));
});

test('submitRun calls SDK with score + attachment; tolerates missing SDK', async () => {
  let capturedScore = null;
  let capturedAttachment = null;
  _setMockSDK({
    submitScore: (board, value, direction, metadata, attachment) => {
      capturedScore = { board, value };
      capturedAttachment = attachment;
      return Promise.resolve({ ok: true });
    },
  });
  const ghost = new Uint8Array([1, 2, 3, 4]);
  const r = await submitRun(99, 12.345, ghost);
  assert.equal(capturedScore.board, 'rotw-week-99');
  assert.equal(capturedScore.value, 12.345);
  assert.equal(capturedAttachment.byteLength, 4);
  assert.ok(r);
});

test('fetchTop returns entries; empty when SDK absent', async () => {
  _setMockSDK(null);
  const top = await fetchTop(7, 5);
  assert.deepEqual(top, { entries: [], total: 0, has_top_attachment: false });
});

test('fetchTopGhost returns Float32Array when attachment present', async () => {
  _setMockSDK({
    getTopAttachment: () => Promise.resolve(new Uint8Array([0, 0, 0x80, 0x3f]).buffer), // float32 1.0 little-endian
  });
  const f = await fetchTopGhost(1);
  assert.ok(f instanceof Float32Array);
  assert.equal(f.length, 1);
  assert.ok(Math.abs(f[0] - 1.0) < 1e-6);
});

test('fetchTopGhost returns null when no attachment', async () => {
  _setMockSDK({ getTopAttachment: () => Promise.resolve(null) });
  const f = await fetchTopGhost(1);
  assert.equal(f, null);
});
