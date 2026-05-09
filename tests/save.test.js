import { test } from 'node:test';
import assert from 'node:assert/strict';
import { saveCareer, loadCareer, clearCareer, _setMockStorage } from '../js/save.js';

// Inject a fake storage so tests don't require PlaySDK
test.beforeEach(() => {
  const store = new Map();
  _setMockStorage({
    save: (k, v) => { store.set(k, v); return Promise.resolve(); },
    load: (k) => Promise.resolve(store.has(k) ? store.get(k) : null),
    remove: (k) => { store.delete(k); return Promise.resolve(); },
  });
});

test('saveCareer/loadCareer roundtrips a state object', async () => {
  const state = { version: 1, classIndex: 2, classWins: 3, gold: 1500, ownedCars: ['e2', 'd1'], currentCarId: 'e2', nbucks: 0, unlockedEnvs: ['bleachers'], audio: { muted: false, volume: 0.7 }, haptics: { enabled: true }, shadows: { enabled: true } };
  await saveCareer(state);
  const loaded = await loadCareer();
  assert.deepEqual(loaded, state);
});

test('loadCareer returns null when no save exists', async () => {
  const loaded = await loadCareer();
  assert.equal(loaded, null);
});

test('clearCareer removes save', async () => {
  await saveCareer({ version: 1, classIndex: 0, classWins: 0, gold: 100, ownedCars: [], currentCarId: null });
  await clearCareer();
  assert.equal(await loadCareer(), null);
});

test('loadCareer returns null on corrupt JSON (graceful)', async () => {
  _setMockStorage({
    save: () => Promise.resolve(),
    load: () => Promise.resolve('not json {{{'),
    remove: () => Promise.resolve(),
  });
  assert.equal(await loadCareer(), null);
});

test('loadCareer migrates legacy save without nbucks/unlockedEnvs/audio', async () => {
  const legacy = { version: 1, classIndex: 0, classWins: 0, gold: 1500, ownedCars: [], currentCarId: null };
  _setMockStorage({
    save: () => Promise.resolve(),
    load: () => Promise.resolve(JSON.stringify(legacy)),
    remove: () => Promise.resolve(),
  });
  const loaded = await loadCareer();
  assert.equal(loaded.nbucks, 0);
  // Legacy save had no unlockedEnvs field → migration seeds the sole
  // starter track (bleachers).
  assert.deepEqual(loaded.unlockedEnvs, ['bleachers']);
  assert.deepEqual(loaded.audio, { muted: false, volume: 0.7 });
  assert.deepEqual(loaded.haptics, { enabled: true });
  assert.deepEqual(loaded.shadows, { enabled: true });
});

test('saveCareer/loadCareer roundtrips the new fields', async () => {
  const store = new Map();
  _setMockStorage({
    save: (k, v) => { store.set(k, v); return Promise.resolve(); },
    load: (k) => Promise.resolve(store.has(k) ? store.get(k) : null),
    remove: (k) => { store.delete(k); return Promise.resolve(); },
  });
  const state = {
    version: 1,
    classIndex: 1,
    classWins: 2,
    gold: 500,
    ownedCars: [],
    currentCarId: null,
    nbucks: 7,
    unlockedEnvs: ['bleachers', 'industrial', 'tokyo'],
    audio: { muted: true, volume: 0.4 },
    haptics: { enabled: false },
    shadows: { enabled: false },
  };
  await saveCareer(state);
  const loaded = await loadCareer();
  assert.deepEqual(loaded, state);
});
