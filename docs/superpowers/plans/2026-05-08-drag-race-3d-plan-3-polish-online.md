# Drag Race 3D — Plan 3: Polish & Online (Implementation Plan)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add audio (procedural engine + one-shots), 3 environment presets (night/salt/rain), an online weekly leaderboard with ghost replay, and a NBucks gold shop. Defer screenshot mode, thumbnail render, and platform deploy to post-Plan-3 testing.

**Architecture:** New modules sit alongside existing race-core: `audio.js`, `env-presets.js`, `ghost-recorder.js`, `ghost-renderer.js`, `leaderboard.js`, `rotw-screen.js`, `shop-screen.js`. Audio is a WebAudio singleton, lazily initialized on first user gesture. Environments swap material/light parameters in place (no scene rebuild). Ghost replay records 30 Hz position samples (~5 KB) attached to leaderboard score submissions; playback lerps a translucent third car. Shop is local-only NBucks decrement granting gold (PlaySDK has no purchase API).

**Tech Stack:** Same as Plan 1/2 — three.js r128 (CDN), vanilla ES modules, `node --test` for unit tests, PlaySDK for save + leaderboard. Adds Web Audio API.

**Spec reference:** `docs/superpowers/specs/2026-05-08-drag-race-3d-plan-3-polish-online.md`

**Plan-3 scope:**
- Audio: procedural engine drone (RPM-driven), procedural one-shots (shift / blow / tree beep / limiter)
- 4 environment presets: day (existing), night, salt, rain — class-gated unlock (Night=D, Salt=B, Rain=Pro)
- Quick race track picker filtered by `unlockedEnvs`
- RotW: weekly fixed car+class, ET wins, top-10 list, top-time ghost replay (30 Hz position sampling)
- NBucks shop: 5 gold-pack tiers (250/1500/3500/10000/25000 g for $1/$5/$10/$25/$50)
- Pause-menu mute toggle + master volume slider

**Out-of-plan-3 scope:** Screenshot mode, thumbnail render, deploy to platform CDN, cross-week ghost archive, weather VFX, music, voice-over.

**Per-commit version bump rule:** Every commit in this plan must bump the patch in `js/constants.js` `VERSION` and `package.json` `version`. Plan 2 ended at v0.4.19. Plan 3 starts at v0.5.0 and ends at ≥v0.5.12.

---

## File map (Plan-3 additions / modifications)

```
DragRace3D/
├── index.html                  # ADD: screens for rotw, shop, track-picker, settings (mute)
├── css/ui.css                  # ADD: rotw / shop / track-picker / settings styles
├── js/
│   ├── audio.js                # NEW: WebAudio singleton — engine drone + one-shots + lifecycle
│   ├── env-presets.js          # NEW: PURE data — day/night/salt/rain configs
│   ├── env-builder.js          # MODIFY: applyEnvPreset(envObjects, presetId) — mutates in place
│   ├── ghost-recorder.js       # NEW: pre-allocated 30 Hz sampler over race
│   ├── ghost-renderer.js       # NEW: translucent third car, position lerp from buffer
│   ├── leaderboard.js          # NEW: PlaySDK wrapper + weekly seed
│   ├── rotw-screen.js          # NEW: RotW menu + race lifecycle (submit ET+ghost on finish)
│   ├── shop-screen.js          # NEW: NBucks gold-pack picker UI + purchase logic
│   ├── balance.js              # MODIFY: add SHOP_PACKS table; optional audio params per car
│   ├── career.js               # MODIFY: newCareer adds nbucks/unlockedEnvs; spendNbucks/addGold helpers; recordWin unlocks env on class advance
│   ├── career-flow.js          # MODIFY: pick env per career race from class table
│   ├── quick-race.js           # MODIFY: track-picker step before class-pick
│   ├── save.js                 # MODIFY: persist nbucks/unlockedEnvs/audio settings; migration for legacy saves
│   ├── race-logic.js           # MODIFY: emit shift/blow event callbacks for audio + ghost recorder
│   ├── renderer3d.js           # MODIFY: build ghost mesh once; expose for ghost-renderer to drive
│   ├── main.js                 # MODIFY: audio lifecycle, title-screen rotw+shop entries, settings screen, ghost recorder/renderer wiring
│   └── constants.js            # MODIFY: bump VERSION; add ENV_PRESET_NAMES, GHOST_SAMPLE_HZ, GHOST_DURATION_S, MASTER_VOLUME_DEFAULT
└── tests/
    ├── audio.test.js           # NEW
    ├── env-presets.test.js     # NEW
    ├── ghost-recorder.test.js  # NEW
    ├── leaderboard.test.js     # NEW
    └── shop.test.js            # NEW
```

---

## Task 1: Bump v0.5.0 + extend constants + balance shop packs

**Files:**
- Modify: `js/constants.js`
- Modify: `js/balance.js`
- Modify: `package.json`

- [ ] **Step 1: Bump version**

`js/constants.js` — change to `'v0.5.0'`:
```js
export const VERSION = 'v0.5.0';
```

`package.json`:
```json
"version": "0.5.0",
```

- [ ] **Step 2: Add Plan-3 constants**

Append to `js/constants.js`:

```js
// --- Plan 3: Polish & Online ---

// Env presets: ids in the order they appear in env-presets.js
export const ENV_PRESET_IDS = ['day', 'night', 'salt', 'rain'];

// Class index → env preset id used for that class's career races.
// E (0) and D (1) use 'day'; D's final race (classWins===5 → advance) uses 'night';
// in practice the env applied per career race is picked by career-flow.js below.
export const CLASS_ENV_TABLE = ['day', 'day', 'day', 'night', 'salt', 'rain'];

// Class index at which each env unlocks for quick-race
// (day always unlocked; night unlocks at class D = idx 1; salt at B = 3; rain at Pro = 5)
export const ENV_UNLOCK_CLASS = { day: 0, night: 1, salt: 3, rain: 5 };

// Ghost replay
export const GHOST_SAMPLE_HZ = 30;          // samples/sec
export const GHOST_DURATION_S = 12;         // max race duration to size buffer
export const GHOST_FLOATS_PER_SAMPLE = 3;   // [worldZ, rpm, gear]

// Audio
export const MASTER_VOLUME_DEFAULT = 0.7;   // 0..1
export const ENGINE_BASE_FREQ_HZ = 60;      // pitch at idleRpm; scaled by rpm/redline at runtime

// Leaderboard
export const ROTW_BOARD_PREFIX = 'rotw-week-';
export const WEEK_MS = 7 * 86400 * 1000;
```

- [ ] **Step 3: Add SHOP_PACKS table to balance**

Append to `js/balance.js` (export at the bottom of the existing module):

```js
// Plan-3 NBucks shop. cost is in NBucks (1 NBuck = $1 USD platform-side).
export const SHOP_PACKS = [
  { id: 'small',  cost: 1,  gold: 250 },
  { id: 'medium', cost: 5,  gold: 1500 },
  { id: 'large',  cost: 10, gold: 3500 },
  { id: 'mega',   cost: 25, gold: 10000 },
  { id: 'whale',  cost: 50, gold: 25000 },
];
```

- [ ] **Step 4: Run existing tests to confirm no regressions**

Run: `npm test`
Expected: all prior tests pass (constants additions are additive).

- [ ] **Step 5: Commit**

```bash
git add js/constants.js js/balance.js package.json
git commit -m "plan3: bump v0.5.0; add env/audio/ghost/leaderboard constants + SHOP_PACKS table"
```

---

## Task 2: Extend save schema and career state (TDD)

**Files:**
- Modify: `js/save.js`
- Modify: `js/career.js`
- Modify: `tests/save.test.js`
- Modify: `tests/career.test.js`

- [ ] **Step 1: Write failing tests for save migration**

Append to `tests/save.test.js`:

```js
test('loadCareer migrates legacy save without nbucks/unlockedEnvs/audio', async () => {
  const legacy = { version: 1, classIndex: 0, classWins: 0, gold: 1500, ownedCars: [], currentCarId: null };
  _setMockStorage({
    save: () => Promise.resolve(),
    load: () => Promise.resolve(JSON.stringify(legacy)),
    remove: () => Promise.resolve(),
  });
  const loaded = await loadCareer();
  assert.equal(loaded.nbucks, 0);
  assert.deepEqual(loaded.unlockedEnvs, ['day']);
  assert.deepEqual(loaded.audio, { muted: false, volume: 0.7 });
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
    unlockedEnvs: ['day', 'night'],
    audio: { muted: true, volume: 0.4 },
  };
  await saveCareer(state);
  const loaded = await loadCareer();
  assert.deepEqual(loaded, state);
});
```

- [ ] **Step 2: Run, expect 2 failing**

Run: `npm test -- --test-name-pattern='migrates legacy|roundtrips the new fields'`
Expected: FAIL (assertions about `nbucks`/`unlockedEnvs`/`audio` fail because loadCareer returns the legacy object as-is).

- [ ] **Step 3: Implement migration in save.js**

Replace the body of `loadCareer` in `js/save.js`:

```js
export async function loadCareer() {
  const raw = await getStorage().load(SAVE_KEY);
  if (!raw) return null;
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (_) {
    return null;
  }
  // Migrate Plan-3 fields if missing (legacy saves from Plan 2)
  if (typeof parsed.nbucks !== 'number') parsed.nbucks = 0;
  if (!Array.isArray(parsed.unlockedEnvs)) parsed.unlockedEnvs = ['day'];
  if (!parsed.audio || typeof parsed.audio !== 'object') {
    parsed.audio = { muted: false, volume: 0.7 };
  } else {
    if (typeof parsed.audio.muted !== 'boolean') parsed.audio.muted = false;
    if (typeof parsed.audio.volume !== 'number') parsed.audio.volume = 0.7;
  }
  return parsed;
}
```

- [ ] **Step 4: Run save tests — expect green**

Run: `npm test -- --test-name-pattern='save'`
Expected: all save.test.js tests pass.

- [ ] **Step 5: Write failing tests for career state extensions**

Append to `tests/career.test.js`:

```js
import { spendNbucks, addNbucks, unlockEnv } from '../js/career.js';

test('newCareer starts with nbucks=0 and unlockedEnvs=[day]', () => {
  const s = newCareer();
  assert.equal(s.nbucks, 0);
  assert.deepEqual(s.unlockedEnvs, ['day']);
});

test('spendNbucks deducts; throws when insufficient', () => {
  const s = { ...newCareer(), nbucks: 10 };
  const after = spendNbucks(s, 4);
  assert.equal(after.nbucks, 6);
  assert.throws(() => spendNbucks(s, 11), /insufficient nbucks/);
});

test('addNbucks adds (no cap)', () => {
  const s = { ...newCareer(), nbucks: 3 };
  assert.equal(addNbucks(s, 7).nbucks, 10);
});

test('unlockEnv adds id; idempotent', () => {
  let s = newCareer();
  s = unlockEnv(s, 'night');
  assert.deepEqual(s.unlockedEnvs, ['day', 'night']);
  s = unlockEnv(s, 'night');
  assert.deepEqual(s.unlockedEnvs, ['day', 'night']);
});

test('recordWin unlocks env when class advances', () => {
  // Start at class E with 5 wins → next win advances to class D, unlocking night
  let s = { ...newCareer(), classIndex: 0, classWins: 5 };
  s = recordWin(s, { gold: 100 });
  assert.equal(s.classIndex, 1);
  assert.deepEqual(s.unlockedEnvs, ['day', 'night']);
});
```

- [ ] **Step 6: Run, expect failures (functions undefined / unlockedEnvs missing)**

Run: `npm test -- --test-name-pattern='career'`
Expected: FAIL (Cannot find spendNbucks etc.)

- [ ] **Step 7: Implement career state additions**

Modify `js/career.js`:

Replace `newCareer()`:

```js
export function newCareer() {
  return {
    version: 1,
    classIndex: 0,
    classWins: 0,
    gold: STARTING_GOLD,
    ownedCars: [],     // [{ carId, parts, tune, paint }]
    currentCarId: null,
    nbucks: 0,
    unlockedEnvs: ['day'],
  };
}
```

Append exports at end of file:

```js
export function addNbucks(state, n) {
  return { ...state, nbucks: state.nbucks + n };
}

export function spendNbucks(state, n) {
  if (state.nbucks < n) throw new Error('insufficient nbucks');
  return { ...state, nbucks: state.nbucks - n };
}

/** Add envId to unlockedEnvs if absent. Idempotent. */
export function unlockEnv(state, envId) {
  if (state.unlockedEnvs.includes(envId)) return state;
  return { ...state, unlockedEnvs: [...state.unlockedEnvs, envId] };
}
```

Modify `recordWin` to unlock env when class advances. Replace the existing function with:

```js
import { CLASS_WINS_REQUIRED, NUM_CLASSES, CLASS_ENV_TABLE } from './constants.js';
// ... existing imports above

export function recordWin(state, { gold }) {
  const newWins = state.classWins + 1;
  let classIndex = state.classIndex;
  let classWins = newWins;
  let unlockedEnvs = state.unlockedEnvs;
  if (newWins > CLASS_WINS_REQUIRED) {
    classIndex = Math.min(NUM_CLASSES - 1, classIndex + 1);
    classWins = 1;
    // Unlock the new class's env (idempotent if already unlocked)
    const newEnv = CLASS_ENV_TABLE[classIndex];
    if (newEnv && !unlockedEnvs.includes(newEnv)) {
      unlockedEnvs = [...unlockedEnvs, newEnv];
    }
  }
  return {
    ...state,
    classIndex,
    classWins,
    gold: state.gold + gold,
    unlockedEnvs,
  };
}
```

(Keep the existing import line; just add `CLASS_ENV_TABLE` to it.)

- [ ] **Step 8: Run all tests — expect green**

Run: `npm test`
Expected: all save + career tests pass; prior tests still pass.

- [ ] **Step 9: Bump v0.5.1 and commit**

`js/constants.js`: `'v0.5.1'`. `package.json`: `"0.5.1"`.

```bash
git add js/save.js js/career.js js/constants.js package.json tests/save.test.js tests/career.test.js
git commit -m "feat(save+career): nbucks, unlockedEnvs, audio settings; recordWin unlocks env on class advance; v0.5.1"
```

---

## Task 3: audio.js skeleton — lifecycle + master gain + mute (TDD)

**Files:**
- Create: `js/audio.js`
- Test: `tests/audio.test.js`

- [ ] **Step 1: Write failing tests with WebAudio mocks**

`tests/audio.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initAudio, getAudioState, setMuted, setVolume, suspendAudio, resumeAudio, _setAudioContextFactory } from '../js/audio.js';

// Lightweight WebAudio mock — captures construction calls and gain values.
function makeMockCtx() {
  const ctx = {
    state: 'suspended',
    currentTime: 0,
    destination: { __id: 'dest' },
    suspend: function() { this.state = 'suspended'; return Promise.resolve(); },
    resume:  function() { this.state = 'running';   return Promise.resolve(); },
    close:   function() { this.state = 'closed';    return Promise.resolve(); },
    createGain: function() {
      const node = {
        gain: { value: 1, setValueAtTime: function(v, t) { this.value = v; }, linearRampToValueAtTime: function(v, t) { this.value = v; } },
        connect: function(_) {},
        disconnect: function() {},
      };
      return node;
    },
    createOscillator: function() {
      const node = {
        type: 'sine', frequency: { value: 440, setValueAtTime: function(v, t) { this.value = v; } },
        detune: { value: 0, setValueAtTime: function(v, t) { this.value = v; } },
        connect: function(_) {}, disconnect: function() {},
        start: function(_) {}, stop: function(_) {},
      };
      return node;
    },
    createBiquadFilter: function() {
      return {
        type: 'lowpass', frequency: { value: 1000, setValueAtTime: function(v, t) { this.value = v; } },
        Q: { value: 1 }, connect: function(_) {}, disconnect: function() {},
      };
    },
    createBufferSource: function() {
      return { buffer: null, connect: function(_) {}, disconnect: function() {}, start: function(_) {}, stop: function(_) {} };
    },
    createBuffer: function(_c, len, _sr) {
      return { length: len, getChannelData: () => new Float32Array(len) };
    },
  };
  return ctx;
}

test('initAudio is idempotent and creates context lazily', async () => {
  const ctx = makeMockCtx();
  _setAudioContextFactory(() => ctx);
  await initAudio();
  await initAudio();
  const s = getAudioState();
  assert.equal(s.context, ctx);
  assert.equal(s.context.state, 'running');
});

test('setMuted=true zeroes master gain; setMuted=false restores volume', async () => {
  const ctx = makeMockCtx();
  _setAudioContextFactory(() => ctx);
  await initAudio();
  setVolume(0.5);
  setMuted(true);
  assert.equal(getAudioState().masterGain.gain.value, 0);
  setMuted(false);
  assert.equal(getAudioState().masterGain.gain.value, 0.5);
});

test('setVolume clamps to [0,1]', async () => {
  const ctx = makeMockCtx();
  _setAudioContextFactory(() => ctx);
  await initAudio();
  setVolume(2.0);
  assert.equal(getAudioState().masterGain.gain.value, 1);
  setVolume(-1);
  assert.equal(getAudioState().masterGain.gain.value, 0);
});

test('suspend/resume toggles context state', async () => {
  const ctx = makeMockCtx();
  _setAudioContextFactory(() => ctx);
  await initAudio();
  await suspendAudio();
  assert.equal(ctx.state, 'suspended');
  await resumeAudio();
  assert.equal(ctx.state, 'running');
});
```

- [ ] **Step 2: Run, expect fail**

Run: `npm test -- --test-name-pattern='Audio|audio'`
Expected: FAIL (Cannot find module ../js/audio.js).

- [ ] **Step 3: Implement audio.js skeleton**

`js/audio.js`:

```js
import { MASTER_VOLUME_DEFAULT } from './constants.js';

let _ctx = null;
let _masterGain = null;
let _muted = false;
let _volume = MASTER_VOLUME_DEFAULT;
let _ctxFactory = null;

/** Test hook: inject a mock AudioContext factory before initAudio. */
export function _setAudioContextFactory(fn) { _ctxFactory = fn; _ctx = null; _masterGain = null; }

function defaultFactory() {
  if (typeof window === 'undefined') return null;
  const Ctor = window.AudioContext || window.webkitAudioContext;
  return Ctor ? new Ctor() : null;
}

export async function initAudio() {
  if (_ctx) return;
  const factory = _ctxFactory || defaultFactory;
  const ctx = factory();
  if (!ctx) return; // No audio support — no-op
  _ctx = ctx;
  _masterGain = ctx.createGain();
  _masterGain.gain.value = _muted ? 0 : _volume;
  _masterGain.connect(ctx.destination);
  if (ctx.state === 'suspended' && ctx.resume) {
    try { await ctx.resume(); } catch (_) { /* user-gesture-required */ }
  }
}

export function getAudioState() {
  return { context: _ctx, masterGain: _masterGain, muted: _muted, volume: _volume };
}

export function setMuted(muted) {
  _muted = !!muted;
  if (_masterGain) _masterGain.gain.value = _muted ? 0 : _volume;
}

export function setVolume(v) {
  _volume = Math.max(0, Math.min(1, v));
  if (_masterGain && !_muted) _masterGain.gain.value = _volume;
}

export async function suspendAudio() {
  if (_ctx && _ctx.suspend) await _ctx.suspend();
}

export async function resumeAudio() {
  if (_ctx && _ctx.resume) await _ctx.resume();
}
```

- [ ] **Step 4: Run audio tests — expect green**

Run: `npm test -- --test-name-pattern='audio|Audio'`
Expected: all 4 audio tests pass.

- [ ] **Step 5: Bump v0.5.2 and commit**

`js/constants.js`: `'v0.5.2'`. `package.json`: `"0.5.2"`.

```bash
git add js/audio.js tests/audio.test.js js/constants.js package.json
git commit -m "feat(audio): WebAudio singleton with init/mute/volume/suspend; mock-tested; v0.5.2"
```

---

## Task 4: audio.js — procedural engine drone

**Files:**
- Modify: `js/audio.js`
- Modify: `tests/audio.test.js`

- [ ] **Step 1: Write failing test for engine drone**

Append to `tests/audio.test.js`:

```js
import { startEngine, stopEngine, updateEngine } from '../js/audio.js';

test('startEngine creates oscillators wired through filter to master', async () => {
  const ctx = makeMockCtx();
  _setAudioContextFactory(() => ctx);
  await initAudio();
  const car = { idleRpm: 800, redlineRpm: 7000 };
  startEngine(car);
  const s = getAudioState();
  assert.ok(s.engine, 'engine object should exist');
  assert.ok(s.engine.sawOsc, 'sawtooth oscillator');
  assert.ok(s.engine.subOsc, 'sub oscillator');
  assert.ok(s.engine.filter, 'biquad filter');
  assert.ok(s.engine.gain, 'gain node');
});

test('updateEngine maps rpm to frequency and gain', async () => {
  const ctx = makeMockCtx();
  _setAudioContextFactory(() => ctx);
  await initAudio();
  const car = { idleRpm: 800, redlineRpm: 7000 };
  startEngine(car);
  // At idle: gain low, freq base
  updateEngine(800, 0);
  const s1 = getAudioState();
  const idleGain = s1.engine.gain.gain.value;
  const idleFreq = s1.engine.sawOsc.frequency.value;
  // At redline with throttle: gain higher, freq higher
  updateEngine(7000, 1);
  const s2 = getAudioState();
  assert.ok(s2.engine.gain.gain.value > idleGain, 'gain rises with rpm+throttle');
  assert.ok(s2.engine.sawOsc.frequency.value > idleFreq, 'freq rises with rpm');
});

test('stopEngine disconnects and clears state', async () => {
  const ctx = makeMockCtx();
  _setAudioContextFactory(() => ctx);
  await initAudio();
  startEngine({ idleRpm: 800, redlineRpm: 7000 });
  stopEngine();
  assert.equal(getAudioState().engine, null);
});
```

- [ ] **Step 2: Run, expect 3 failing**

Run: `npm test -- --test-name-pattern='engine'`
Expected: FAIL (startEngine undefined).

- [ ] **Step 3: Implement engine drone**

Append to `js/audio.js`:

```js
import { ENGINE_BASE_FREQ_HZ } from './constants.js';

let _engine = null;

/** Start a continuous engine drone for a given car. Idempotent: replaces prior. */
export function startEngine(car) {
  if (!_ctx || !_masterGain) return;
  if (_engine) stopEngine();
  const sawOsc = _ctx.createOscillator();
  const subOsc = _ctx.createOscillator();
  const filter = _ctx.createBiquadFilter();
  const gain   = _ctx.createGain();
  sawOsc.type = 'sawtooth';
  subOsc.type = 'square';
  subOsc.detune.setValueAtTime((car.audio && car.audio.subDetune) || -1200, _ctx.currentTime);
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime((car.audio && car.audio.filterCutoff) || 1400, _ctx.currentTime);
  filter.Q.value = 0.7;
  gain.gain.value = 0;
  sawOsc.connect(filter);
  subOsc.connect(filter);
  filter.connect(gain);
  gain.connect(_masterGain);
  sawOsc.start(_ctx.currentTime);
  subOsc.start(_ctx.currentTime);
  _engine = { sawOsc, subOsc, filter, gain, car };
}

/**
 * Update engine pitch + gain based on RPM and throttle (0..1).
 * Pitch = base × (rpm/idleRpm). Gain = small idle hum + scales with rpm and throttle.
 */
export function updateEngine(rpm, throttle) {
  if (!_engine || !_ctx) return;
  const car = _engine.car;
  const rpmFrac = (rpm - car.idleRpm) / Math.max(1, car.redlineRpm - car.idleRpm); // 0..1
  const freq = ENGINE_BASE_FREQ_HZ * (rpm / Math.max(1, car.idleRpm));
  const t = _ctx.currentTime;
  _engine.sawOsc.frequency.setValueAtTime(freq, t);
  _engine.subOsc.frequency.setValueAtTime(freq * 0.5, t);
  // Gain: 0.06 idle hum + 0.30 × rpmFrac × (0.4 + 0.6 × throttle), clamped 0..0.6
  const tCl = Math.max(0, Math.min(1, throttle));
  let g = 0.06 + 0.30 * Math.max(0, Math.min(1, rpmFrac)) * (0.4 + 0.6 * tCl);
  if (g > 0.6) g = 0.6;
  _engine.gain.gain.setValueAtTime(g, t);
}

export function stopEngine() {
  if (!_engine) return;
  try { _engine.sawOsc.stop(); _engine.subOsc.stop(); } catch (_) {}
  try {
    _engine.sawOsc.disconnect(); _engine.subOsc.disconnect();
    _engine.filter.disconnect(); _engine.gain.disconnect();
  } catch (_) {}
  _engine = null;
}
```

Modify `getAudioState()` to expose the engine:

```js
export function getAudioState() {
  return { context: _ctx, masterGain: _masterGain, muted: _muted, volume: _volume, engine: _engine };
}
```

- [ ] **Step 4: Run engine tests — expect green**

Run: `npm test -- --test-name-pattern='engine'`
Expected: 3 ✓.

- [ ] **Step 5: Bump v0.5.3 and commit**

`js/constants.js`: `'v0.5.3'`. `package.json`: `"0.5.3"`.

```bash
git add js/audio.js tests/audio.test.js js/constants.js package.json
git commit -m "feat(audio): procedural engine drone — sawtooth+sub through LP, RPM-driven freq/gain; v0.5.3"
```

---

## Task 5: audio.js — procedural one-shots (shift, blow, tree beep, limiter)

**Files:**
- Modify: `js/audio.js`
- Modify: `tests/audio.test.js`

- [ ] **Step 1: Write failing test for one-shots**

Append to `tests/audio.test.js`:

```js
import { playShift, playBlow, playTreeBeep, playLimiterTick } from '../js/audio.js';

test('playShift creates a one-shot chain (no throw, returns truthy)', async () => {
  const ctx = makeMockCtx();
  _setAudioContextFactory(() => ctx);
  await initAudio();
  const r = playShift();
  assert.ok(r); // returned the chain handle
});

test('playBlow / playTreeBeep / playLimiterTick are safe no-throws', async () => {
  const ctx = makeMockCtx();
  _setAudioContextFactory(() => ctx);
  await initAudio();
  playBlow(); playTreeBeep(); playLimiterTick();
  // Reaching here implies no throw.
  assert.ok(true);
});

test('one-shots no-op safely when audio not initialized', () => {
  _setAudioContextFactory(() => null);
  // Reset by calling _setAudioContextFactory; one-shots must guard on _ctx
  playShift();
  playBlow();
  playTreeBeep();
  playLimiterTick();
  assert.ok(true);
});
```

- [ ] **Step 2: Run, expect failures**

Run: `npm test -- --test-name-pattern='one-shot|playShift|playBlow'`
Expected: FAIL.

- [ ] **Step 3: Implement one-shots**

Append to `js/audio.js`:

```js
function _noiseBuffer(ctx, durationS) {
  const sr = ctx.sampleRate || 48000;
  const len = Math.floor(sr * durationS);
  const buf = ctx.createBuffer(1, len, sr);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  return buf;
}

function _envelopedNoise(ctx, dest, { dur = 0.10, peak = 0.5, freq = 600, q = 4 } = {}) {
  const src = ctx.createBufferSource();
  src.buffer = _noiseBuffer(ctx, dur);
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass'; bp.frequency.setValueAtTime(freq, ctx.currentTime); bp.Q.value = q;
  const g = ctx.createGain();
  const t = ctx.currentTime;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(peak, t + 0.005);
  g.gain.linearRampToValueAtTime(0, t + dur);
  src.connect(bp); bp.connect(g); g.connect(dest);
  src.start(t); src.stop(t + dur + 0.05);
  return { src, bp, g };
}

/** Brief broadband chunk for an upshift "clunk". */
export function playShift() {
  if (!_ctx || !_masterGain) return null;
  return _envelopedNoise(_ctx, _masterGain, { dur: 0.09, peak: 0.35, freq: 700, q: 6 });
}

/** Low-frequency rumble + noise sweep for engine blow. */
export function playBlow() {
  if (!_ctx || !_masterGain) return null;
  // Low-freq sine sweep
  const osc = _ctx.createOscillator(); osc.type = 'sine';
  const og  = _ctx.createGain();
  const t = _ctx.currentTime;
  osc.frequency.setValueAtTime(180, t); osc.frequency.linearRampToValueAtTime(40, t + 0.6);
  og.gain.setValueAtTime(0, t); og.gain.linearRampToValueAtTime(0.5, t + 0.02); og.gain.linearRampToValueAtTime(0, t + 0.6);
  osc.connect(og); og.connect(_masterGain);
  osc.start(t); osc.stop(t + 0.7);
  // Noise burst on top
  _envelopedNoise(_ctx, _masterGain, { dur: 0.5, peak: 0.4, freq: 320, q: 2 });
  return true;
}

/** Short sine pip for christmas-tree amber. */
export function playTreeBeep() {
  if (!_ctx || !_masterGain) return null;
  const osc = _ctx.createOscillator(); osc.type = 'sine';
  const g = _ctx.createGain();
  const t = _ctx.currentTime;
  osc.frequency.setValueAtTime(880, t);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(0.25, t + 0.005);
  g.gain.linearRampToValueAtTime(0, t + 0.10);
  osc.connect(g); g.connect(_masterGain);
  osc.start(t); osc.stop(t + 0.12);
  return true;
}

/** Quick crunch for at-limiter tick. */
export function playLimiterTick() {
  if (!_ctx || !_masterGain) return null;
  return _envelopedNoise(_ctx, _masterGain, { dur: 0.04, peak: 0.20, freq: 1800, q: 8 });
}
```

- [ ] **Step 4: Run audio tests — expect green**

Run: `npm test -- --test-name-pattern='audio|engine|one-shot|playShift|playBlow'`
Expected: all audio tests pass.

- [ ] **Step 5: Wire one-shots into race-logic**

Modify `js/race-logic.js` — at the top, add the import:

```js
import { playShift, playBlow, playTreeBeep } from './audio.js';
```

In `handleShiftTap`, after `gd.gear[i] = newGear;` add:

```js
  if (i === PLAYER_CAR_IDX) playShift();
```

In `tickRacing` and any place where blow is set on a car, add a one-shot when player blows. Search for `gd.blown[i] = 1` — there is one in shift-scoring's blowThresholdReached path; the actual setter is in tickRacing's stepCar → blow logic. Find the line that sets `gd.blown[i] = 1` and add immediately after, guarded by `i === PLAYER_CAR_IDX`:

```js
      if (i === PLAYER_CAR_IDX) playBlow();
```

In `tickTree`, after the line `gd.treeAmbersLit = ambers;` add:

```js
  // Beep on each new amber the player sees light up
  if (ambers > (gd._lastAmbersBeeped | 0) && ambers <= TREE_AMBER_COUNT) {
    playTreeBeep();
    gd._lastAmbersBeeped = ambers;
  }
```

After `gd.treeGreenAtS = gd.raceTimeS;` (the green-light setter) add:

```js
    playTreeBeep(); // green: same beep, slightly brighter feel via repetition (tone variation deferred)
```

In `gameData.js#resetRace` add:

```js
  gd._lastAmbersBeeped = 0;
```

near the other gd.\_\* clears (after `gd._aiPlan = null;`).

- [ ] **Step 6: Run all tests**

Run: `npm test`
Expected: all pass (race-logic tests don't require audio context — `playShift()` etc. no-op when `_ctx` is null).

- [ ] **Step 7: Bump v0.5.4 and commit**

`js/constants.js`: `'v0.5.4'`. `package.json`: `"0.5.4"`.

```bash
git add js/audio.js tests/audio.test.js js/race-logic.js js/gameData.js js/constants.js package.json
git commit -m "feat(audio): procedural one-shots (shift/blow/tree-beep/limiter); wired into race-logic; v0.5.4"
```

---

## Task 6: env-presets.js + env-builder.js applyEnvPreset (TDD)

**Files:**
- Create: `js/env-presets.js`
- Modify: `js/env-builder.js`
- Test: `tests/env-presets.test.js`

- [ ] **Step 1: Write failing test for env-presets**

`tests/env-presets.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ENV_PRESETS } from '../js/env-presets.js';
import { ENV_PRESET_IDS } from '../js/constants.js';

test('all preset ids are present', () => {
  for (const id of ENV_PRESET_IDS) {
    assert.ok(ENV_PRESETS[id], 'missing preset: ' + id);
  }
});

test('each preset has all required fields', () => {
  const required = ['sun', 'ambient', 'ground', 'sky', 'fog', 'lightIntensity'];
  for (const id of ENV_PRESET_IDS) {
    for (const f of required) {
      assert.ok(f in ENV_PRESETS[id], `${id} missing ${f}`);
    }
    assert.equal(ENV_PRESETS[id].sky.length, 2, `${id} sky must be [top,bottom]`);
  }
});

test('night and rain are darker than day (lightIntensity)', () => {
  assert.ok(ENV_PRESETS.night.lightIntensity < ENV_PRESETS.day.lightIntensity);
  assert.ok(ENV_PRESETS.rain.lightIntensity < ENV_PRESETS.day.lightIntensity);
});

test('salt is brighter than day', () => {
  assert.ok(ENV_PRESETS.salt.lightIntensity > ENV_PRESETS.day.lightIntensity);
});
```

- [ ] **Step 2: Run, expect fail**

Run: `npm test -- --test-name-pattern='preset'`
Expected: FAIL (Cannot find ../js/env-presets.js).

- [ ] **Step 3: Implement env-presets.js**

`js/env-presets.js`:

```js
/**
 * Plan-3 environment presets. Pure data. Consumed by env-builder.applyEnvPreset.
 * Colors are 0xRRGGBB integers (not strings — matches three.js Color.setHex).
 *
 * sky: [topHex, bottomHex] used for vertical gradient via fog + background blend
 * fog: linear-fog density-ish factor (used as 1/distance scaling in env-builder)
 * lightIntensity: directional sun multiplier
 */
export const ENV_PRESETS = Object.freeze({
  day: {
    sun: 0xfff0d0, ambient: 0xa8b8d8, ground: 0x6a5a3c,
    sky: [0x9bb8d8, 0xd0e0f0], fog: { near: 80, far: 400, color: 0x9bb8d8 },
    lightIntensity: 1.1,
  },
  night: {
    sun: 0xa0b8d6, ambient: 0x1a2030, ground: 0x15181d,
    sky: [0x0a0e18, 0x1a2436], fog: { near: 60, far: 300, color: 0x0a0e18 },
    lightIntensity: 0.5,
  },
  salt: {
    sun: 0xfff8e0, ambient: 0xa0a8b0, ground: 0xdadcd8,
    sky: [0xa0c0d8, 0xe0e8ec], fog: { near: 120, far: 500, color: 0xc0d0d8 },
    lightIntensity: 1.4,
  },
  rain: {
    sun: 0x9aa6b6, ambient: 0x3a4250, ground: 0x1c2028,
    sky: [0x3a424c, 0x5a6068], fog: { near: 40, far: 220, color: 0x3a424c },
    lightIntensity: 0.65,
  },
});
```

- [ ] **Step 4: Run, expect green**

Run: `npm test -- --test-name-pattern='preset'`
Expected: 4 ✓.

- [ ] **Step 5: Modify env-builder.js to track refs + implement applyEnvPreset**

Replace `buildClassicEnv` body to capture references to ambient/sun/strip/dirt material and store them on the returned object. Replace the existing function (in `js/env-builder.js`) so it returns these refs:

```js
import { ENV_PRESETS } from './env-presets.js';

export function buildClassicEnv(scene) {
  const T = window.THREE;

  const initial = ENV_PRESETS.day;
  scene.background = new T.Color(initial.fog.color);
  scene.fog = new T.Fog(initial.fog.color, initial.fog.near, initial.fog.far);

  const ambient = new T.AmbientLight(initial.ambient, 0.55);
  scene.add(ambient);
  const hemi = new T.HemisphereLight(0xa8c8ff, 0x3a3020, 0.35);
  scene.add(hemi);
  const sun = new T.DirectionalLight(initial.sun, initial.lightIntensity);
  sun.position.set(60, 90, 40);
  scene.add(sun);

  // Asphalt strip texture (canvas, repeated)
  const stripCanvas = document.createElement('canvas');
  stripCanvas.width = 256; stripCanvas.height = 1024;
  const sc = stripCanvas.getContext('2d');
  sc.fillStyle = '#2d2d31'; sc.fillRect(0, 0, 256, 1024);
  for (let i = 0; i < 1500; i++) {
    sc.fillStyle = 'rgba(255,255,255,' + (Math.random() * 0.06).toFixed(3) + ')';
    sc.fillRect(Math.random() * 256, Math.random() * 1024, 2, 2);
  }
  sc.fillStyle = '#d6b22f'; sc.fillRect(126, 0, 4, 1024);
  sc.fillStyle = '#dddddd'; sc.fillRect(8, 0, 4, 1024); sc.fillRect(244, 0, 4, 1024);
  const stripTex = new T.CanvasTexture(stripCanvas);
  stripTex.wrapS = T.RepeatWrapping; stripTex.wrapT = T.RepeatWrapping;
  stripTex.repeat.set(1, 60); stripTex.anisotropy = 4;

  const stripMat = new T.MeshLambertMaterial({ map: stripTex });
  const strip = new T.Mesh(new T.PlaneGeometry(15, 700), stripMat);
  strip.rotation.x = -Math.PI / 2;
  strip.position.set(0, 0, -300);
  scene.add(strip);

  const dirtMat = new T.MeshLambertMaterial({ color: initial.ground });
  const dirt = new T.Mesh(new T.PlaneGeometry(300, 700), dirtMat);
  dirt.rotation.x = -Math.PI / 2; dirt.position.set(0, -0.05, -300);
  scene.add(dirt);

  // Grandstands
  const standMat = new T.MeshLambertMaterial({ color: 0x556677 });
  for (let s = 0; s < 8; s++) {
    const stand = new T.Mesh(new T.BoxGeometry(15, 6, 4), standMat);
    stand.position.set(-14 + (s % 2) * 28, 3, -20 - s * 18);
    scene.add(stand);
  }

  // Christmas tree (returned for state-driven bulb updates)
  const tree = new T.Group();
  const post = new T.Mesh(
    new T.BoxGeometry(0.4, 6, 0.4),
    new T.MeshLambertMaterial({ color: 0x202020 })
  );
  post.position.y = 3; tree.add(post);
  const treeColors = [0x554000, 0x554000, 0x554000, 0x551100, 0x115522];
  const ambers = []; const greens = [];
  for (let i = 0; i < 5; i++) {
    for (const sx of [-1, 1]) {
      const bulb = new T.Mesh(
        new T.SphereGeometry(0.22, 12, 8),
        new T.MeshBasicMaterial({ color: treeColors[i] })
      );
      bulb.position.set(sx * 0.5, 5.5 - i * 0.9, 0);
      tree.add(bulb);
      if (i < 3) ambers.push(bulb);
      if (i === 4) greens.push(bulb);
    }
  }
  tree.position.set(0, 0, -1.5);
  scene.add(tree);

  // Finish gantry
  const gantry = new T.Group();
  const left = new T.Mesh(new T.BoxGeometry(0.6, 9, 0.6),
    new T.MeshLambertMaterial({ color: 0x444444 }));
  left.position.set(-7.5, 4.5, 0); gantry.add(left);
  const right = left.clone(); right.position.x = 7.5; gantry.add(right);
  const cross = new T.Mesh(new T.BoxGeometry(15.6, 1.2, 0.6),
    new T.MeshLambertMaterial({ color: 0xc04020 }));
  cross.position.set(0, 9, 0); gantry.add(cross);
  gantry.position.set(0, 0, -402.336);
  scene.add(gantry);

  return { strip, tree, ambers, greens, ambient, sun, dirtMat, scene };
}

/**
 * Mutate scene/lights/materials to match a preset. Caller provides envObjects
 * returned from buildClassicEnv. No reallocation — safe to call between races.
 */
export function applyEnvPreset(envObjects, presetId) {
  const T = window.THREE;
  const p = ENV_PRESETS[presetId] || ENV_PRESETS.day;
  if (envObjects.scene) {
    envObjects.scene.background = new T.Color(p.fog.color);
    envObjects.scene.fog = new T.Fog(p.fog.color, p.fog.near, p.fog.far);
  }
  if (envObjects.ambient) envObjects.ambient.color.setHex(p.ambient);
  if (envObjects.sun) {
    envObjects.sun.color.setHex(p.sun);
    envObjects.sun.intensity = p.lightIntensity;
  }
  if (envObjects.dirtMat) envObjects.dirtMat.color.setHex(p.ground);
}
```

(Keep the existing `updateTreeFromGameData` export at the bottom of the file unchanged.)

- [ ] **Step 6: Run all tests**

Run: `npm test`
Expected: all tests pass.

- [ ] **Step 7: Bump v0.5.5 and commit**

`js/constants.js`: `'v0.5.5'`. `package.json`: `"0.5.5"`.

```bash
git add js/env-presets.js js/env-builder.js tests/env-presets.test.js js/constants.js package.json
git commit -m "feat(env): 4 env presets + applyEnvPreset mutating in place; v0.5.5"
```

---

## Task 7: Track-picker UI in quick-race + career-flow env picker

**Files:**
- Modify: `js/quick-race.js`
- Modify: `js/career-flow.js`
- Modify: `js/main.js`
- Modify: `index.html`
- Modify: `css/ui.css`

- [ ] **Step 1: Add track-picker screen markup to index.html**

Inside `<div id="ui">`, add a new screen above the `quick-race-class` screen (search for `id="quick-race-class"` to locate the right spot):

```html
<div id="quick-race-track" class="screen hidden">
  <h2 class="game-title">PICK TRACK</h2>
  <div id="quick-track-grid" class="track-grid"></div>
  <button class="btn-secondary" id="quick-race-track-back">BACK</button>
</div>
```

- [ ] **Step 2: Add track-grid CSS**

Append to `css/ui.css`:

```css
.track-grid {
  display: grid; grid-template-columns: repeat(2, 1fr); gap: 14px;
  margin: 24px 0; padding: 0 32px; max-width: 720px;
}
.track-tile {
  background: #1a1d22; border: 2px solid #333; border-radius: 12px;
  padding: 18px; cursor: pointer; text-align: center;
  color: #fff; font-family: system-ui;
}
.track-tile h3 { font-size: 22px; margin-bottom: 6px; }
.track-tile .meta { font-size: 14px; opacity: 0.7; }
.track-tile.unlocked { border-color: #2aa050; }
.track-tile.locked { opacity: 0.45; cursor: not-allowed; }
```

- [ ] **Step 3: Update quick-race.js to render the track picker**

In `js/quick-race.js`, export a new function `renderTrackPicker`:

```js
import { ENV_PRESET_IDS, ENV_UNLOCK_CLASS } from './constants.js';

/**
 * Render the track-picker grid. Calls onPick(envId) when player picks an
 * unlocked track. Disabled tiles for locked tracks (informative).
 */
export function renderTrackPicker(careerState, onPick) {
  const grid = document.getElementById('quick-track-grid');
  if (!grid) return;
  grid.innerHTML = '';
  for (const envId of ENV_PRESET_IDS) {
    const unlocked = careerState && careerState.unlockedEnvs.includes(envId);
    const tile = document.createElement('button');
    tile.className = 'track-tile ' + (unlocked ? 'unlocked' : 'locked');
    tile.disabled = !unlocked;
    const unlockClass = ENV_UNLOCK_CLASS[envId];
    const unlockNote = unlocked
      ? '✓ unlocked'
      : `unlock at class ${['E','D','C','B','A','Pro'][unlockClass]}`;
    tile.innerHTML = `
      <h3>${envId.toUpperCase()}</h3>
      <div class="meta">${unlockNote}</div>
    `;
    if (unlocked) tile.addEventListener('click', () => onPick(envId));
    grid.appendChild(tile);
  }
}
```

- [ ] **Step 4: Wire track-picker into main.js quick-race flow**

The current quick-race flow in `main.js` is title → `quick-race-class` (via `renderQuickRace(onCarPick)`). Insert the track picker BEFORE the class picker so the flow becomes: title → `quick-race-track` → `quick-race-class` → race.

Add `renderTrackPicker` to the existing quick-race import and add a module-level env var (place near the other module-level lets like `quickRaceMode`):

```js
import { renderQuickRace, buildQuickRaceBalance, renderTrackPicker } from './quick-race.js';
let quickRaceEnvId = 'day';
```

Find the existing title-screen "Quick Race" button handler (it currently does something like `show('quick-race-class'); renderQuickRace((carId) => { ... });`). Replace that handler with:

```js
const quickBtn = document.getElementById('btn-quick-race');
quickBtn.addEventListener('click', () => {
  show('quick-race-track');
  renderTrackPicker(careerState, (envId) => {
    quickRaceEnvId = envId;
    show('quick-race-class');
    renderQuickRace((carId) => {
      raceBalance = buildQuickRaceBalance(carId, Date.now() | 0);
      quickRaceMode = true;
      startRace();
      applyEnvPreset(env, quickRaceEnvId);
    });
  });
});
```

Wire the track-picker BACK button:

```js
document.getElementById('quick-race-track-back').addEventListener('click', () => show('title'));
```

If the previous quick-race click handler was registered earlier in `initTitleButtons` (or similar), remove the old registration so the new handler doesn't double-fire.

After race-balance is built for quick-race, before `startRace()`, apply the env preset:

```js
import { applyEnvPreset } from './env-builder.js';
// inside startRace, after `env = built.env;`:
applyEnvPreset(env, quickRaceEnvId);
```

- [ ] **Step 5: Update career-flow.js env picker**

Modify `js/career-flow.js` — find `buildRaceBalance` (or the function that creates per-race balance from career state). Add an export `pickEnvForCareerRace`:

```js
import { CLASS_ENV_TABLE } from './constants.js';

/** Pick env preset id for the next career race based on classIndex. */
export function pickEnvForCareerRace(careerState) {
  return CLASS_ENV_TABLE[careerState.classIndex] || 'day';
}
```

In `main.js`, where the career-race scene is built (next to `startRace()` in the career path), apply:

```js
import { pickEnvForCareerRace } from './career-flow.js';
// ...
const envId = pickEnvForCareerRace(careerState);
applyEnvPreset(env, envId);
```

- [ ] **Step 6: Test in browser**

Run: `./dev-server.sh` (port 8083)
Open: http://localhost:8083
- Verify Quick Race button shows the track picker
- Verify only `day` is unlocked initially; other tiles say "unlock at class D/B/Pro"
- Verify back button returns to title
- Pick `day` → goes to class picker → race renders day env
- Reset save (clear localStorage), advance class via dev-tools or a test save, confirm `night` unlocks at class D

(No automated test for UI; logic is exercised in subsequent ghost/leaderboard tasks.)

- [ ] **Step 7: Bump v0.5.6 and commit**

`js/constants.js`: `'v0.5.6'`. `package.json`: `"0.5.6"`.

```bash
git add js/quick-race.js js/career-flow.js js/main.js index.html css/ui.css js/constants.js package.json
git commit -m "feat(env): track picker for quick race + per-class env in career; v0.5.6"
```

---

## Task 8: ghost-recorder.js — pre-allocated 30 Hz sampler (TDD)

**Files:**
- Create: `js/ghost-recorder.js`
- Test: `tests/ghost-recorder.test.js`

- [ ] **Step 1: Write failing tests**

`tests/ghost-recorder.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGhostRecorder } from '../js/ghost-recorder.js';
import { GHOST_SAMPLE_HZ, GHOST_DURATION_S, GHOST_FLOATS_PER_SAMPLE } from '../js/constants.js';

test('createGhostRecorder pre-allocates buffer of expected size', () => {
  const r = createGhostRecorder();
  const expectedSamples = GHOST_SAMPLE_HZ * GHOST_DURATION_S;
  assert.equal(r.buf.length, expectedSamples * GHOST_FLOATS_PER_SAMPLE);
  assert.equal(r.sampleCount, 0);
});

test('start resets sampleCount and lastSampleTime', () => {
  const r = createGhostRecorder();
  r.sampleCount = 5; r.lastSampleTime = 99;
  r.start();
  assert.equal(r.sampleCount, 0);
  assert.equal(r.lastSampleTime, 0);
});

test('tick samples at GHOST_SAMPLE_HZ; ignores faster updates', () => {
  const r = createGhostRecorder();
  r.start();
  const dtFrame = 1 / 60; // 60 Hz frames
  // Run 1 second of frames; should yield ~30 samples (sample rate 30Hz)
  for (let t = 0; t < 1.0; t += dtFrame) r.tick(t, dtFrame, -t * 50, 4000, 2);
  assert.ok(r.sampleCount >= 29 && r.sampleCount <= 31, `expected ~30 samples, got ${r.sampleCount}`);
});

test('tick stores [worldZ, rpm, gear] per sample', () => {
  const r = createGhostRecorder();
  r.start();
  // First tick at t=0 always samples
  r.tick(0, 1/60, -10, 5000, 3);
  assert.equal(r.buf[0], -10);
  assert.equal(r.buf[1], 5000);
  assert.equal(r.buf[2], 3);
  assert.equal(r.sampleCount, 1);
});

test('tick does not exceed buffer bounds (capped at GHOST_DURATION_S)', () => {
  const r = createGhostRecorder();
  r.start();
  const cap = GHOST_SAMPLE_HZ * GHOST_DURATION_S;
  // Run far longer than cap
  for (let i = 0; i < cap + 50; i++) {
    const t = i / GHOST_SAMPLE_HZ;
    r.tick(t, 1 / GHOST_SAMPLE_HZ, -t, 4000, 2);
  }
  assert.equal(r.sampleCount, cap);
});

test('finalize returns a Uint8Array containing only the recorded samples', () => {
  const r = createGhostRecorder();
  r.start();
  r.tick(0, 1/60, -10, 5000, 3);
  r.tick(1/30, 1/60, -20, 6000, 4);
  const bytes = r.finalize();
  // 2 samples × 3 floats × 4 bytes = 24 bytes
  assert.equal(bytes.byteLength, 24);
  // Decode back: first sample worldZ
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  assert.equal(view.getFloat32(0, true), -10);
  assert.equal(view.getFloat32(4, true), 5000);
  assert.equal(view.getFloat32(8, true), 3);
});
```

- [ ] **Step 2: Run, expect fail**

Run: `npm test -- --test-name-pattern='ghost'`
Expected: FAIL.

- [ ] **Step 3: Implement ghost-recorder.js**

`js/ghost-recorder.js`:

```js
import { GHOST_SAMPLE_HZ, GHOST_DURATION_S, GHOST_FLOATS_PER_SAMPLE } from './constants.js';

/**
 * Pre-allocated 30 Hz sampler that records [worldZ, rpm, gear] for the
 * player's run. Buffer is sized once for the maximum race duration and
 * never resized. Caller drives via tick(t, dt, worldZ, rpm, gear).
 */
export function createGhostRecorder() {
  const samples = GHOST_SAMPLE_HZ * GHOST_DURATION_S;
  const buf = new Float32Array(samples * GHOST_FLOATS_PER_SAMPLE);
  return {
    buf,
    sampleCount: 0,
    lastSampleTime: 0,
    start() {
      this.sampleCount = 0;
      this.lastSampleTime = 0;
    },
    tick(t, _dt, worldZ, rpm, gear) {
      const cap = GHOST_SAMPLE_HZ * GHOST_DURATION_S;
      if (this.sampleCount >= cap) return;
      // Sample at t=0 always; afterward gate at 1/HZ intervals.
      if (this.sampleCount > 0 && (t - this.lastSampleTime) < (1 / GHOST_SAMPLE_HZ - 1e-6)) return;
      const i = this.sampleCount * GHOST_FLOATS_PER_SAMPLE;
      this.buf[i + 0] = worldZ;
      this.buf[i + 1] = rpm;
      this.buf[i + 2] = gear;
      this.sampleCount++;
      this.lastSampleTime = t;
    },
    /** Returns Uint8Array of recorded sample bytes (truncated to actual samples). */
    finalize() {
      const usedFloats = this.sampleCount * GHOST_FLOATS_PER_SAMPLE;
      const view = new Float32Array(this.buf.buffer, this.buf.byteOffset, usedFloats);
      // Copy into a fresh Uint8Array of exact byte length so the leaderboard
      // attachment isn't an over-sized view of the long-lived recorder buffer.
      const out = new Uint8Array(usedFloats * 4);
      out.set(new Uint8Array(view.buffer, view.byteOffset, view.byteLength));
      return out;
    },
  };
}

/** Decode bytes from a leaderboard attachment back into a Float32Array. */
export function decodeGhost(uint8) {
  if (!uint8 || uint8.byteLength === 0) return null;
  // Make a copy so the underlying buffer isn't tied to caller's lifetime.
  const copy = new Uint8Array(uint8);
  return new Float32Array(copy.buffer, copy.byteOffset, copy.byteLength / 4);
}
```

- [ ] **Step 4: Run ghost tests — expect green**

Run: `npm test -- --test-name-pattern='ghost'`
Expected: 6 ✓.

- [ ] **Step 5: Bump v0.5.7 and commit**

`js/constants.js`: `'v0.5.7'`. `package.json`: `"0.5.7"`.

```bash
git add js/ghost-recorder.js tests/ghost-recorder.test.js js/constants.js package.json
git commit -m "feat(ghost): pre-allocated 30 Hz sampler + finalize/decode; v0.5.7"
```

---

## Task 9: ghost-renderer.js + renderer/main wiring

**Files:**
- Create: `js/ghost-renderer.js`
- Modify: `js/renderer3d.js`
- Modify: `js/main.js`

- [ ] **Step 1: Implement ghost-renderer.js**

`js/ghost-renderer.js`:

```js
import { GHOST_FLOATS_PER_SAMPLE, GHOST_SAMPLE_HZ } from './constants.js';

/**
 * Drive a translucent third-car mesh from a recorded ghost buffer.
 * Caller supplies `mesh` (a THREE.Mesh or Group reused across races) and
 * `ghostFloats` (Float32Array of [worldZ, rpm, gear, ...]). Each frame call
 * updateGhost(time) and the mesh's z position is lerped between adjacent
 * samples.
 */
export function createGhostPlayer(mesh, ghostFloats) {
  if (!ghostFloats || ghostFloats.length < GHOST_FLOATS_PER_SAMPLE * 2) {
    return { active: false, update: () => {} };
  }
  const sampleCount = ghostFloats.length / GHOST_FLOATS_PER_SAMPLE;
  const dtSample = 1 / GHOST_SAMPLE_HZ;
  return {
    active: true,
    update(time) {
      // Find sample bracket
      const idxF = time / dtSample;
      let i0 = Math.floor(idxF);
      if (i0 < 0) i0 = 0;
      if (i0 >= sampleCount - 1) i0 = sampleCount - 2;
      const f = idxF - i0;
      const a = ghostFloats[i0 * GHOST_FLOATS_PER_SAMPLE + 0];
      const b = ghostFloats[(i0 + 1) * GHOST_FLOATS_PER_SAMPLE + 0];
      const z = a + (b - a) * Math.max(0, Math.min(1, f));
      mesh.position.z = z;
    },
    setMeshVisible(v) { if (mesh) mesh.visible = !!v; },
  };
}

/**
 * Build a translucent ghost car mesh that mirrors opponent body geometry.
 * Caller passes the THREE namespace and a base-color hex.
 */
export function buildGhostMesh(T, opponentBodyGeometry, color = 0xffffff) {
  const mat = new T.MeshBasicMaterial({ color, transparent: true, opacity: 0.45 });
  const mesh = new T.Mesh(opponentBodyGeometry, mat);
  mesh.visible = false; // hidden until activated
  return mesh;
}
```

- [ ] **Step 2: Expose ghost mount point in renderer3d.js**

In `js/renderer3d.js`, find where `buildRaceScene` returns. After the cars/env build, also build the ghost mesh in lane 1 position (replacing the opponent visually when ghost is active). Modify `buildRaceScene` so its return value includes a `ghostMesh` reference. Concretely, after the loop that builds the per-car body meshes, append:

```js
import { buildGhostMesh } from './ghost-renderer.js';
// ... later, after car meshes are built:
let ghostMesh = null;
if (cars.length >= 2 && cars[1].body && cars[1].body.geometry) {
  ghostMesh = buildGhostMesh(T, cars[1].body.geometry);
  ghostMesh.position.x = cars[1].group.position.x;
  scene.add(ghostMesh);
}

return { scene, cars, env, ghostMesh };
```

(Keep prior return fields intact — only add `ghostMesh`.)

- [ ] **Step 3: Wire ghost recorder/player into main.js**

In `js/main.js`, near top imports:

```js
import { createGhostRecorder, decodeGhost } from './ghost-recorder.js';
import { createGhostPlayer } from './ghost-renderer.js';
```

Add module-level state:

```js
const ghostRecorder = createGhostRecorder();
let ghostPlayer = null;
let activeGhostFloats = null; // set by RotW screen before startRace
```

In `startRace`, after `tachUpdater = ...`:

```js
ghostRecorder.start();
if (activeGhostFloats && env.ghostMesh) {
  ghostPlayer = createGhostPlayer(env.ghostMesh, activeGhostFloats);
  env.ghostMesh.visible = true;
} else {
  ghostPlayer = null;
  if (env.ghostMesh) env.ghostMesh.visible = false;
}
```

Note: `env` in main.js is what `buildRaceScene` returns wrapped — verify in current main.js whether ghostMesh is exposed there. If `built.ghostMesh` is the path, adapt accordingly. Assign at scene-build site:

```js
const built = buildRaceScene(raceBalance);
scene = built.scene; cars = built.cars; env = built.env;
env.ghostMesh = built.ghostMesh;
```

In the render-loop tick (search for `tickRace(`), AFTER the physics tick and BEFORE rendering, add:

```js
// Sample ghost during racing only; raceTime since green = elapsed
if (gameData.raceState === 'racing' || gameData.raceState === 'launching') {
  const t = Math.max(0, gameData.raceTimeS - gameData.treeGreenAtS);
  const playerWorldZ = gameData.posZ[0]; // posZ is negative as car moves forward
  ghostRecorder.tick(t, /*dt*/ 1/60, playerWorldZ, gameData.rpm[0], gameData.gear[0]);
  if (ghostPlayer && ghostPlayer.active) ghostPlayer.update(t);
}
```

- [ ] **Step 4: Test in browser**

Run: `./dev-server.sh`
Verify a normal race still runs (no ghost loaded). Confirm no console errors.

- [ ] **Step 5: Bump v0.5.8 and commit**

`js/constants.js`: `'v0.5.8'`. `package.json`: `"0.5.8"`.

```bash
git add js/ghost-renderer.js js/renderer3d.js js/main.js js/constants.js package.json
git commit -m "feat(ghost): translucent third-car renderer + recorder wiring (no upload yet); v0.5.8"
```

---

## Task 10: leaderboard.js wrapper + weekly seed (TDD)

**Files:**
- Create: `js/leaderboard.js`
- Test: `tests/leaderboard.test.js`

- [ ] **Step 1: Write failing tests**

`tests/leaderboard.test.js`:

```js
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
    submitScore: (board, value, attachment) => {
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
```

- [ ] **Step 2: Run, expect fail**

Run: `npm test -- --test-name-pattern='leaderboard|weekly|boardKey|submitRun|fetchTop'`
Expected: FAIL.

- [ ] **Step 3: Implement leaderboard.js**

`js/leaderboard.js`:

```js
import { ROTW_BOARD_PREFIX, WEEK_MS, NUM_CLASSES } from './constants.js';
import { balance } from './balance.js';

let _sdk = null; // injected by _setMockSDK or resolved from window.PlaySDK

function getSDK() {
  if (_sdk !== null) return _sdk;
  if (typeof window !== 'undefined' && window.PlaySDK) return window.PlaySDK;
  return null;
}

/** Test-only: inject a mock SDK or null to force "no SDK" mode. */
export function _setMockSDK(sdk) { _sdk = sdk; }

export function currentWeek() {
  return Math.floor(Date.now() / WEEK_MS);
}

/** Deterministic car/class pick for a given week. */
export function weeklyChallenge(week) {
  // Mulberry32-ish hash: deterministic, week-keyed, well-mixed.
  let h = (week * 2654435761) >>> 0;
  h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b) >>> 0;
  h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35) >>> 0;
  h ^= h >>> 16;
  const carIdx = h % balance.cars.length;
  const classIndex = (h >>> 4) % NUM_CLASSES;
  return { week, carIdx, classIndex };
}

export function boardKey(week) { return ROTW_BOARD_PREFIX + week; }

export async function submitRun(week, etS, ghostBytes) {
  const sdk = getSDK();
  if (!sdk || !sdk.submitScore) return null;
  try {
    return await sdk.submitScore(boardKey(week), etS, ghostBytes || null);
  } catch (_) { return null; }
}

export async function fetchTop(week, limit) {
  const sdk = getSDK();
  if (!sdk || !sdk.getLeaderboard) return { entries: [], total: 0, has_top_attachment: false };
  try {
    return await sdk.getLeaderboard(boardKey(week), limit || 10);
  } catch (_) { return { entries: [], total: 0, has_top_attachment: false }; }
}

export async function fetchTopGhost(week) {
  const sdk = getSDK();
  if (!sdk || !sdk.getTopAttachment) return null;
  try {
    const ab = await sdk.getTopAttachment(boardKey(week));
    if (!ab) return null;
    // ab is ArrayBuffer; wrap in Float32Array
    const u8 = ab instanceof ArrayBuffer ? new Uint8Array(ab) : new Uint8Array(ab.buffer || ab);
    if (u8.byteLength === 0) return null;
    const copy = new Uint8Array(u8); // ensure aligned + owned
    return new Float32Array(copy.buffer, copy.byteOffset, copy.byteLength / 4);
  } catch (_) { return null; }
}
```

- [ ] **Step 4: Run leaderboard tests — expect green**

Run: `npm test -- --test-name-pattern='leaderboard|weekly|boardKey|submitRun|fetchTop'`
Expected: 7 ✓.

- [ ] **Step 5: Bump v0.5.9 and commit**

`js/constants.js`: `'v0.5.9'`. `package.json`: `"0.5.9"`.

```bash
git add js/leaderboard.js tests/leaderboard.test.js js/constants.js package.json
git commit -m "feat(leaderboard): PlaySDK wrapper + deterministic weekly seed; v0.5.9"
```

---

## Task 11: RotW screen — UI + race lifecycle

**Files:**
- Create: `js/rotw-screen.js`
- Modify: `js/main.js`
- Modify: `index.html`
- Modify: `css/ui.css`

- [ ] **Step 1: Add RotW screen markup to index.html**

Inside `<div id="ui">`, add:

```html
<div id="rotw" class="screen hidden">
  <h2 class="game-title">RACE OF THE WEEK</h2>
  <div id="rotw-info" class="rotw-info"></div>
  <div id="rotw-leaderboard" class="rotw-board"></div>
  <button class="btn-primary" id="rotw-race">RACE</button>
  <button class="btn-secondary" id="rotw-back">BACK</button>
</div>
```

Add a button on the title screen (search for the existing nav block):

```html
<button class="btn-secondary" id="btn-rotw">RACE OF THE WEEK</button>
```

- [ ] **Step 2: Add RotW CSS**

Append to `css/ui.css`:

```css
.rotw-info {
  background: #1a1d22; border-radius: 12px;
  padding: 18px 24px; margin: 18px 0; min-width: 320px; max-width: 460px;
  font-size: 20px; font-family: system-ui;
}
.rotw-info .label { color: #888; }
.rotw-info .value { color: #fff; font-weight: 700; }
.rotw-board {
  background: #1a1d22; border-radius: 12px;
  padding: 14px 18px; margin: 12px 0; width: 420px; max-width: 85vw;
  font-family: system-ui; color: #fff; font-size: 16px;
  max-height: 240px; overflow-y: auto;
}
.rotw-board .row { display: flex; justify-content: space-between; padding: 4px 0; }
.rotw-board .row.me { color: #ffd14a; font-weight: 700; }
.rotw-board .empty { opacity: 0.6; font-style: italic; padding: 6px 0; }
```

- [ ] **Step 3: Implement rotw-screen.js**

`js/rotw-screen.js`:

```js
import { weeklyChallenge, currentWeek, fetchTop, fetchTopGhost, submitRun } from './leaderboard.js';
import { balance, SHOP_PACKS } from './balance.js';
import { CLASS_NAMES } from './constants.js';

/** Render the RotW info panel + leaderboard rows. Returns the challenge. */
export async function renderRotwScreen() {
  const week = currentWeek();
  const ch = weeklyChallenge(week);
  const car = balance.cars[ch.carIdx];

  const info = document.getElementById('rotw-info');
  if (info) {
    info.innerHTML = `
      <div><span class="label">Week:</span> <span class="value">#${week}</span></div>
      <div><span class="label">Car:</span> <span class="value">${car.name}</span></div>
      <div><span class="label">Class:</span> <span class="value">${CLASS_NAMES[ch.classIndex]}</span></div>
    `;
  }

  const board = document.getElementById('rotw-leaderboard');
  if (board) {
    board.innerHTML = '<div class="empty">Loading…</div>';
    const top = await fetchTop(week, 10);
    if (!top.entries || top.entries.length === 0) {
      board.innerHTML = '<div class="empty">No times yet — set the first!</div>';
    } else {
      board.innerHTML = top.entries.map((e, i) => {
        const meCls = e.isMe ? 'row me' : 'row';
        const name = (e.metadata && e.metadata.name) || ('user-' + (e.user_id || '?'));
        return `<div class="${meCls}"><span>${i + 1}. ${name}</span><span>${e.value.toFixed(3)}s</span></div>`;
      }).join('');
    }
  }
  return ch;
}

/** Build a 2-car balance: player + (none — ghost replaces opponent visually). */
export function buildRotwBalance(challenge) {
  const car = balance.cars[challenge.carIdx];
  // Player and slot-1 (ghost slot) both use the same car. Slot-1's physics is
  // ignored by main.js since ghost render takes over its lane.
  return { ...balance, cars: [car, car] };
}

/** Fetch top ghost for this week; null if none. */
export async function fetchCurrentGhost(week) {
  return await fetchTopGhost(week);
}

/** Submit player's run after race finishes. */
export async function submitRotwResult(week, etS, ghostBytes) {
  return await submitRun(week, etS, ghostBytes);
}
```

- [ ] **Step 4: Wire RotW into main.js**

In `js/main.js` near top:

```js
import { renderRotwScreen, buildRotwBalance, fetchCurrentGhost, submitRotwResult } from './rotw-screen.js';
```

(`ghostRecorder` is already a module-level const declared in main.js from Task 9 — no import needed.)

Add module-level state:

```js
let rotwActive = false;
let rotwChallenge = null;
```

Wire button handlers:

```js
document.getElementById('btn-rotw').addEventListener('click', async () => {
  show('rotw');
  rotwChallenge = await renderRotwScreen();
});
document.getElementById('rotw-back').addEventListener('click', () => show('title'));
document.getElementById('rotw-race').addEventListener('click', async () => {
  if (!rotwChallenge) rotwChallenge = await renderRotwScreen();
  raceBalance = buildRotwBalance(rotwChallenge);
  activeGhostFloats = await fetchCurrentGhost(rotwChallenge.week);
  rotwActive = true;
  startRace();
  // Apply day env for RotW (could be tied to challenge later)
  applyEnvPreset(env, 'day');
});
```

In the post-race results path (search for where `gameData.finished[PLAYER_CAR_IDX]` is used to show results), at the moment results are computed, if `rotwActive`:

```js
if (rotwActive) {
  const etS = gameData.finishTimeS[0];
  const ghostBytes = ghostRecorder.finalize();
  await submitRotwResult(rotwChallenge.week, etS, ghostBytes);
  rotwActive = false;
  activeGhostFloats = null;
}
```

- [ ] **Step 5: Test in browser**

Run: `./dev-server.sh`
- Tap "RACE OF THE WEEK" — verify info panel shows current week + car + class
- Verify leaderboard shows "No times yet" or current top
- Tap RACE — verify scene loads with the displayed car. Race to finish.
- After race, return to title and re-enter RotW — verify own time appears.
- (Ghost only visible from week 2 onward; first run has no prior #1 to play.)

- [ ] **Step 6: Bump v0.5.10 and commit**

`js/constants.js`: `'v0.5.10'`. `package.json`: `"0.5.10"`.

```bash
git add js/rotw-screen.js js/main.js index.html css/ui.css js/constants.js package.json
git commit -m "feat(rotw): weekly leaderboard screen + ghost playback wiring; v0.5.10"
```

---

## Task 12: shop-screen.js — NBucks → gold packs (TDD)

**Files:**
- Create: `js/shop-screen.js`
- Test: `tests/shop.test.js`
- Modify: `index.html`
- Modify: `css/ui.css`
- Modify: `js/main.js`

- [ ] **Step 1: Write failing tests for shop logic**

`tests/shop.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canAffordPack, applyPurchase } from '../js/shop-screen.js';
import { newCareer } from '../js/career.js';
import { SHOP_PACKS } from '../js/balance.js';

test('SHOP_PACKS has 5 tiers with ascending cost and gold', () => {
  assert.equal(SHOP_PACKS.length, 5);
  for (let i = 1; i < SHOP_PACKS.length; i++) {
    assert.ok(SHOP_PACKS[i].cost > SHOP_PACKS[i - 1].cost);
    assert.ok(SHOP_PACKS[i].gold > SHOP_PACKS[i - 1].gold);
  }
});

test('canAffordPack=false at 0 nbucks for cheapest pack', () => {
  const s = newCareer(); // nbucks: 0
  assert.equal(canAffordPack(s, SHOP_PACKS[0]), false);
});

test('canAffordPack=true when nbucks >= cost', () => {
  const s = { ...newCareer(), nbucks: 5 };
  assert.equal(canAffordPack(s, SHOP_PACKS[0]), true);  // cost 1
  assert.equal(canAffordPack(s, SHOP_PACKS[1]), true);  // cost 5
  assert.equal(canAffordPack(s, SHOP_PACKS[2]), false); // cost 10
});

test('applyPurchase deducts nbucks and grants gold', () => {
  const s = { ...newCareer(), nbucks: 50, gold: 100 };
  const after = applyPurchase(s, SHOP_PACKS.find(p => p.id === 'medium')); // 5 → 1500
  assert.equal(after.nbucks, 45);
  assert.equal(after.gold, 1600);
});

test('applyPurchase throws when unaffordable (state guard)', () => {
  const s = { ...newCareer(), nbucks: 0 };
  assert.throws(() => applyPurchase(s, SHOP_PACKS[0]), /insufficient nbucks/);
});
```

- [ ] **Step 2: Run, expect fail**

Run: `npm test -- --test-name-pattern='shop|PACKS|Purchase|canAfford'`
Expected: FAIL.

- [ ] **Step 3: Add shop screen markup**

In `index.html` inside `<div id="ui">`:

```html
<div id="shop" class="screen hidden">
  <h2 class="game-title">GOLD SHOP</h2>
  <div id="shop-balance" class="shop-balance"></div>
  <div id="shop-packs" class="shop-packs"></div>
  <div class="shop-foot">Get more NBucks at play.nitzan.games</div>
  <button class="btn-secondary" id="shop-back">BACK</button>
</div>
```

Add a title-screen button:

```html
<button class="btn-secondary" id="btn-shop">SHOP</button>
```

- [ ] **Step 4: Add shop CSS**

Append to `css/ui.css`:

```css
.shop-balance {
  font-size: 22px; margin: 8px 0 16px; color: #fff; font-family: system-ui;
}
.shop-balance .nb { color: #4a9fe0; font-weight: 700; }
.shop-balance .g  { color: #ffd14a; font-weight: 700; }
.shop-packs {
  display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px;
  margin: 14px 0; padding: 0 24px; max-width: 720px; width: 100%;
  box-sizing: border-box;
}
.pack-tile {
  background: #1a1d22; border: 2px solid #333; border-radius: 12px;
  padding: 18px 14px; text-align: center; cursor: pointer; color: #fff;
  font-family: system-ui;
}
.pack-tile h3 { font-size: 22px; margin-bottom: 4px; }
.pack-tile .gold-amt { color: #ffd14a; font-size: 24px; font-weight: 700; margin-top: 6px; }
.pack-tile .cost { color: #4a9fe0; font-size: 16px; margin-top: 6px; font-weight: 700; }
.pack-tile.affordable { border-color: #2aa050; }
.pack-tile.unaffordable { opacity: 0.45; cursor: not-allowed; }
.shop-foot {
  font-size: 14px; opacity: 0.6; margin: 14px 0 8px; font-family: system-ui;
}
```

- [ ] **Step 5: Implement shop-screen.js**

`js/shop-screen.js`:

```js
import { SHOP_PACKS } from './balance.js';
import { spendNbucks, addGold } from './career.js';

/** Pure: would buying this pack succeed given current state? */
export function canAffordPack(state, pack) {
  return state && pack && state.nbucks >= pack.cost;
}

/** Pure: returns new state with pack applied. Throws on insufficient nbucks. */
export function applyPurchase(state, pack) {
  if (!canAffordPack(state, pack)) throw new Error('insufficient nbucks');
  let after = spendNbucks(state, pack.cost);
  after = addGold(after, pack.gold);
  return after;
}

/**
 * Render shop tiles. onPurchase(packId) is called when player taps an
 * affordable tile. Caller is responsible for confirm-modal + state save.
 */
export function renderShop(state, onPurchase) {
  const balanceEl = document.getElementById('shop-balance');
  if (balanceEl) {
    balanceEl.innerHTML = `<span class="nb">ⓝ ${state.nbucks}</span> &nbsp;·&nbsp; <span class="g">★ ${state.gold}</span>`;
  }
  const grid = document.getElementById('shop-packs');
  if (!grid) return;
  grid.innerHTML = '';
  for (const pack of SHOP_PACKS) {
    const afford = canAffordPack(state, pack);
    const tile = document.createElement('button');
    tile.className = 'pack-tile ' + (afford ? 'affordable' : 'unaffordable');
    tile.disabled = !afford;
    tile.innerHTML = `
      <h3>${pack.id.toUpperCase()}</h3>
      <div class="gold-amt">${pack.gold.toLocaleString()} ★</div>
      <div class="cost">ⓝ ${pack.cost}  ($${pack.cost})</div>
    `;
    if (afford) tile.addEventListener('click', () => onPurchase(pack.id));
    grid.appendChild(tile);
  }
}
```

- [ ] **Step 6: Wire shop into main.js**

Add imports near the top of `main.js`:

```js
import { renderShop, applyPurchase } from './shop-screen.js';
import { SHOP_PACKS } from './balance.js';
```

(`saveCareer` is already imported in main.js.)

Add the open-shop function and button handlers. The function calls itself after a purchase to re-render with updated balance — simple and correct.

```js
function openShop() {
  show('shop');
  renderShop(careerState, async (packId) => {
    const pack = SHOP_PACKS.find(p => p.id === packId);
    if (!pack) return;
    const ok = window.confirm(`Buy ${pack.gold} gold for ${pack.cost} NBucks ($${pack.cost})?`);
    if (!ok) return;
    careerState = applyPurchase(careerState, pack);
    await saveCareer(careerState);
    openShop(); // re-render with updated balance
  });
}
document.getElementById('btn-shop').addEventListener('click', openShop);
document.getElementById('shop-back').addEventListener('click', () => show('title'));
```

- [ ] **Step 7: Run all tests — expect green**

Run: `npm test`
Expected: shop tests pass; all prior tests pass.

- [ ] **Step 8: Test in browser**

Run: `./dev-server.sh`
- Tap SHOP — verify tiles, all locked at nbucks=0
- (Use dev-tools to inject `careerState.nbucks = 50` and call `openShop()` to see affordable state)
- Confirm purchase — verify gold goes up and nbucks goes down

- [ ] **Step 9: Bump v0.5.11 and commit**

`js/constants.js`: `'v0.5.11'`. `package.json`: `"0.5.11"`.

```bash
git add js/shop-screen.js tests/shop.test.js index.html css/ui.css js/main.js js/constants.js package.json
git commit -m "feat(shop): NBucks gold-pack shop with confirm modal + persistence; v0.5.11"
```

---

## Task 13: Pause-menu mute toggle + final integration pass

**Files:**
- Modify: `index.html`
- Modify: `css/ui.css`
- Modify: `js/main.js`
- Modify: `js/save.js` (no further code changes; just make sure audio settings are persisted on toggle)

- [ ] **Step 1: Add settings overlay markup**

In `index.html` inside `<div id="ui">`:

```html
<div id="settings" class="screen hidden">
  <h2 class="game-title">SETTINGS</h2>
  <div class="settings-row">
    <label><input type="checkbox" id="opt-mute"> Mute audio</label>
  </div>
  <div class="settings-row">
    <label>Volume <input type="range" id="opt-volume" min="0" max="100" value="70"></label>
  </div>
  <button class="btn-secondary" id="settings-back">BACK</button>
</div>
```

Add a title-screen "SETTINGS" button:

```html
<button class="btn-secondary" id="btn-settings">SETTINGS</button>
```

- [ ] **Step 2: Add settings CSS**

Append to `css/ui.css`:

```css
.settings-row {
  margin: 12px 0; font-family: system-ui; font-size: 20px; color: #fff;
}
.settings-row label { display: flex; align-items: center; gap: 12px; }
.settings-row input[type=range] { width: 220px; }
```

- [ ] **Step 3: Wire audio init + settings in main.js**

Near the top, add imports (some already present from earlier tasks):

```js
import { initAudio, setMuted, setVolume, suspendAudio, resumeAudio, startEngine, stopEngine, updateEngine } from './audio.js';
```

Bind one-time audio init on first user gesture (right after careerState is set up; place after the existing input init):

```js
let _audioInitDone = false;
async function ensureAudioInit() {
  if (_audioInitDone) return;
  _audioInitDone = true;
  await initAudio();
  if (careerState && careerState.audio) {
    setMuted(careerState.audio.muted);
    setVolume(careerState.audio.volume);
  }
}
window.addEventListener('pointerdown', ensureAudioInit, { once: true });
window.addEventListener('keydown', ensureAudioInit, { once: true });
```

Hook PlaySDK pause/resume:

```js
if (typeof window !== 'undefined' && window.PlaySDK) {
  if (window.PlaySDK.onPause) window.PlaySDK.onPause(() => { suspendAudio(); stopEngine(); });
  if (window.PlaySDK.onResume) window.PlaySDK.onResume(() => { resumeAudio(); });
}
```

In `startRace`, after `tachUpdater = ...`, start the engine for the player car:

```js
startEngine(raceBalance.cars[0]);
```

After race ends (where results are shown), stop the engine:

```js
stopEngine();
```

In the render-loop tick, after the physics tick and before `renderFrame`, drive the engine sound:

```js
const throttle = gameData.inputGas[0] ? 1 : 0;
updateEngine(gameData.rpm[0], throttle);
```

Settings screen handlers:

```js
function openSettings() {
  show('settings');
  document.getElementById('opt-mute').checked = !!(careerState && careerState.audio && careerState.audio.muted);
  document.getElementById('opt-volume').value = Math.round((careerState && careerState.audio ? careerState.audio.volume : 0.7) * 100);
}
document.getElementById('btn-settings').addEventListener('click', openSettings);
document.getElementById('settings-back').addEventListener('click', () => show('title'));
document.getElementById('opt-mute').addEventListener('change', async (e) => {
  if (!careerState) return;
  careerState = { ...careerState, audio: { ...careerState.audio, muted: e.target.checked } };
  setMuted(e.target.checked);
  await saveCareer(careerState);
});
document.getElementById('opt-volume').addEventListener('input', async (e) => {
  if (!careerState) return;
  const v = (+e.target.value) / 100;
  careerState = { ...careerState, audio: { ...careerState.audio, volume: v } };
  setVolume(v);
});
document.getElementById('opt-volume').addEventListener('change', async () => {
  if (careerState) await saveCareer(careerState);
});
```

- [ ] **Step 4: Manual integration test**

Run: `./dev-server.sh`
Verify:
- Title screen has CONTINUE/NEW/QUICK/GARAGE/ROTW/SHOP/SETTINGS buttons
- First click anywhere starts audio
- Race plays engine sound; one-shots play on shifts/blow/tree
- Tab away → audio suspends; return → audio resumes
- Settings: mute toggle silences engine; volume slider scales loudness
- Settings persist across reload
- Quick race track picker filters by unlockedEnvs
- Career race picks env per class
- Shop deducts nbucks and grants gold; persists
- RotW shows weekly car/class; running submits ET; subsequent open shows your time on board; ghost plays back if a top run exists

- [ ] **Step 5: Run full test suite**

Run: `npm test`
Expected: all green.

- [ ] **Step 6: Bump v0.5.12 and commit**

`js/constants.js`: `'v0.5.12'`. `package.json`: `"0.5.12"`.

```bash
git add index.html css/ui.css js/main.js js/constants.js package.json
git commit -m "feat(audio+settings): engine drive in render loop, pause/resume hooks, mute/volume settings; v0.5.12"
```

---

## Done

After Task 13, the branch `plan-3-polish-online` contains the full Plan 3 polish & online feature set. Merge to `main` after manual play-through. Post-Plan-3 follow-ups (separate plans):

- Screenshot mode (key-bound HUD-less capture)
- `thumbnail.png` render task for the play.nitzan.games tile
- Production deploy (per `deploy-gating` memory rule, gated on user-led local verification first)
- Cross-week ghost archive
- Weather VFX (rain particles, neon signs)
- Music / voice
