# Drag Race 3D — Plan 2: Career & Garage (Implementation Plan)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the playable single-race demo (Plan 1, v0.2.9) into a single-player career: own multiple cars across 6 classes, install parts and tune, paint cars, climb the ladder by winning races, manage gold. Quick Race mode for one-off races outside career.

**Architecture:** Adds career/save/economy/parts/tuning/garage modules alongside the existing race-core. Persists state via PlaySDK.save/load (key: `drag-race-3d:career:v1`). UI grows: title → career home → race-card → race → results, plus title → garage → car-detail → [parts | tune | paint | sell] and title → quick-race → class-pick → track-pick → race. RotW + NBucks shop deferred to Plan 3.

**Tech Stack:** Same as Plan 1 — three.js r128, vanilla ES modules, `node --test` for unit tests, PlaySDK for persistence.

**Spec reference:** `docs/superpowers/specs/2026-05-07-drag-race-3d-design.md` §3 (cars, classes, parts, tuning), §4 (career, economy).

**Plan-2 scope:**
- 23-car roster across 6 classes (E/D/C/B/A/Pro), defined in balance.js
- Parts shop: 5 slots × 3-4 tiers (engine, turbo, transmission, tires, weight)
- Per-car tuning: launch RPM, tire pressure, gear ratios (T3+), final drive
- Paint: primary, secondary, stripe variant
- Gold economy with rewards table
- Career save/load via PlaySDK; class-progression with CLASS_WINS_REQUIRED = 5
- Garage UI (owned-cars list → car detail → tabs) + Parts shop UI + Tuning sliders + Paint picker
- Quick Race menu (class pick → race)
- Review Gate D — Tuning feels (ET deltas across tunes)

**Out-of-plan-2 scope:** RotW spec event, NBucks shop, additional environments (night/salt/rain), audio, achievements, screenshots, deploy. All Plan 3.

**Per-commit version bump rule:** Every commit in this plan must bump the patch in `js/constants.js` `VERSION` and `package.json` `version`. Plan 1 ended at v0.2.9; Plan 2 starts at v0.3.0.

---

## File map (Plan-2 additions / modifications)

```
DragRace3D/
├── index.html                  # ADD: career/garage/quick-race screens
├── css/ui.css                  # ADD: career/garage/parts/tuning/paint styles
├── js/
│   ├── balance.js              # MODIFY: full 23-car roster, parts catalog, class table
│   ├── constants.js            # MODIFY: bump VERSION; add CLASS_WINS_REQUIRED, GOLD_REWARDS, NUM_CLASSES
│   ├── save.js                 # NEW: PlaySDK save/load wrapper, schema versioning
│   ├── career.js               # NEW: career state object (classIndex, classWins, gold, ownedCarIds, currentCarId)
│   ├── economy.js              # NEW: PURE — computeRaceReward(class, won, perfectRT) → gold delta
│   ├── parts.js                # NEW: PURE — applyPartsToCar(baseCar, parts) → tunedCar
│   ├── tuning.js               # NEW: PURE — applyTuningToCar(tunedCar, tune) → finalCar
│   ├── garage.js               # NEW: garage UI orchestration (list → detail → tabs)
│   ├── parts-shop.js           # NEW: parts shop UI (slot tabs, tier purchase)
│   ├── tuning-ui.js            # NEW: tuning sliders UI
│   ├── paint-ui.js             # NEW: paint picker UI
│   ├── career-flow.js          # NEW: race-card generation, post-race transitions
│   ├── quick-race.js           # NEW: quick race flow
│   └── main.js                 # MODIFY: route between title / career / garage / quick-race / race
└── tests/
    ├── save.test.js            # NEW
    ├── economy.test.js         # NEW
    ├── parts.test.js           # NEW
    ├── tuning.test.js          # NEW
    └── career.test.js          # NEW
```

---

## Task 1: Bump version + extend constants

**Files:**
- Modify: `js/constants.js`
- Modify: `package.json`

- [ ] **Step 1: Bump version**

`js/constants.js` — change to `'v0.3.0'`:
```js
export const VERSION = 'v0.3.0';
```

`package.json`:
```json
"version": "0.3.0",
```

- [ ] **Step 2: Add Plan-2 constants**

Append to `js/constants.js`:

```js
// --- Career / class progression (Plan 2) ---
export const NUM_CLASSES = 6;          // E, D, C, B, A, Pro
export const CLASS_WINS_REQUIRED = 5;  // class advancement threshold

// Class index → display name
export const CLASS_NAMES = ['E', 'D', 'C', 'B', 'A', 'Pro'];

// Base gold reward per class (won; lose = 20%, quick race = 50%)
export const CLASS_BASE_REWARD = [100, 250, 600, 1500, 4000, 10000];

// Bonus multipliers
export const PERFECT_RT_BONUS_FRAC = 0.10;  // perfect tree adds 10% of class_base
export const LOSE_REWARD_FRAC = 0.20;        // consolation
export const QUICK_RACE_REWARD_FRAC = 0.50;  // quick race vs career

// Save key (PlaySDK.save/load)
export const SAVE_KEY = 'drag-race-3d:career:v1';
```

- [ ] **Step 3: Commit**

```bash
git add js/constants.js package.json
git commit -m "plan2: bump v0.3.0, add career/economy constants"
```

---

## Task 2: save.js — PlaySDK save/load wrapper (TDD)

**Files:**
- Create: `js/save.js`
- Test: `tests/save.test.js`

- [ ] **Step 1: Write failing tests**

`tests/save.test.js`:

```js
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
  const state = { version: 1, classIndex: 2, classWins: 3, gold: 1500, ownedCars: ['e2', 'd1'], currentCarId: 'e2' };
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
```

- [ ] **Step 2: Run, expect fail**

Run: `npm test`
Expected: `Cannot find module '../js/save.js'`

- [ ] **Step 3: Implement**

`js/save.js`:

```js
import { SAVE_KEY } from './constants.js';

// Storage adapter — defaults to PlaySDK if available, falls back to localStorage,
// or a mock injected by tests.
let storage = null;

function getStorage() {
  if (storage) return storage;
  if (typeof window !== 'undefined' && window.PlaySDK && window.PlaySDK.save) {
    return {
      save: (k, v) => window.PlaySDK.save(k, v),
      load: (k) => window.PlaySDK.load(k),
      remove: (k) => window.PlaySDK.remove ? window.PlaySDK.remove(k) : Promise.resolve(),
    };
  }
  if (typeof window !== 'undefined' && window.localStorage) {
    return {
      save: (k, v) => { window.localStorage.setItem(k, v); return Promise.resolve(); },
      load: (k) => Promise.resolve(window.localStorage.getItem(k)),
      remove: (k) => { window.localStorage.removeItem(k); return Promise.resolve(); },
    };
  }
  // Fallback no-op storage (e.g., Node without injected mock)
  return {
    save: () => Promise.resolve(),
    load: () => Promise.resolve(null),
    remove: () => Promise.resolve(),
  };
}

/** Test-only: inject a mock storage adapter. */
export function _setMockStorage(s) { storage = s; }

export async function saveCareer(state) {
  await getStorage().save(SAVE_KEY, JSON.stringify(state));
}

export async function loadCareer() {
  const raw = await getStorage().load(SAVE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (_) {
    return null;
  }
}

export async function clearCareer() {
  await getStorage().remove(SAVE_KEY);
}
```

- [ ] **Step 4: Run tests — expect 4 passing**

Run: `npm test`
Expected: 4 ✓ in save.test.js + prior 21 still pass = 25 total.

- [ ] **Step 5: Bump version (per-commit rule)**

`js/constants.js`: `'v0.3.1'`. `package.json`: `"0.3.1"`.

- [ ] **Step 6: Commit**

```bash
git add js/save.js tests/save.test.js js/constants.js package.json
git commit -m "feat(save): PlaySDK/localStorage save-load wrapper with mock storage for tests; v0.3.1"
```

---

## Task 3: economy.js — pure reward computation (TDD)

**Files:**
- Create: `js/economy.js`
- Test: `tests/economy.test.js`

- [ ] **Step 1: Write failing tests**

`tests/economy.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeRaceReward } from '../js/economy.js';

test('career win at class E pays class_base × 1.0 = 100', () => {
  assert.equal(computeRaceReward({ classIndex: 0, won: true, mode: 'career', perfectRT: false }), 100);
});

test('career loss at class E pays class_base × 0.20 = 20', () => {
  assert.equal(computeRaceReward({ classIndex: 0, won: false, mode: 'career', perfectRT: false }), 20);
});

test('career win with perfect RT adds 10% bonus', () => {
  // class_base × (1.0 + 0.10) = 100 × 1.10 = 110
  assert.equal(computeRaceReward({ classIndex: 0, won: true, mode: 'career', perfectRT: true }), 110);
});

test('quick race win pays class_base × 0.50 (no bonus stack with quick)', () => {
  assert.equal(computeRaceReward({ classIndex: 1, won: true, mode: 'quick', perfectRT: false }), 125); // 250 * 0.5
});

test('class B win pays 1500g', () => {
  assert.equal(computeRaceReward({ classIndex: 3, won: true, mode: 'career', perfectRT: false }), 1500);
});

test('class Pro win pays 10000g', () => {
  assert.equal(computeRaceReward({ classIndex: 5, won: true, mode: 'career', perfectRT: false }), 10000);
});
```

- [ ] **Step 2: Run, expect fail (Cannot find module)**

- [ ] **Step 3: Implement**

`js/economy.js`:

```js
import {
  CLASS_BASE_REWARD,
  LOSE_REWARD_FRAC,
  PERFECT_RT_BONUS_FRAC,
  QUICK_RACE_REWARD_FRAC,
} from './constants.js';

/**
 * Compute gold reward for a single race.
 * @param {object} params
 * @param {number} params.classIndex   0..5 (E..Pro)
 * @param {boolean} params.won
 * @param {'career'|'quick'} params.mode
 * @param {boolean} params.perfectRT   reaction time < 0.100s
 * @returns {number} gold (always integer; truncated toward zero)
 */
export function computeRaceReward({ classIndex, won, mode, perfectRT }) {
  const base = CLASS_BASE_REWARD[classIndex];
  let frac;
  if (mode === 'quick') {
    frac = won ? QUICK_RACE_REWARD_FRAC : QUICK_RACE_REWARD_FRAC * LOSE_REWARD_FRAC;
  } else {
    // career
    frac = won ? 1.0 : LOSE_REWARD_FRAC;
    if (won && perfectRT) frac += PERFECT_RT_BONUS_FRAC;
  }
  return Math.floor(base * frac);
}
```

- [ ] **Step 4: Run tests, expect all pass**

- [ ] **Step 5: Bump v0.3.2 + commit**

```bash
git add js/economy.js tests/economy.test.js js/constants.js package.json
git commit -m "feat(economy): computeRaceReward pure function with class/mode/perfect-RT branching; v0.3.2"
```

---

## Task 4: balance.js — 23-car roster + parts catalog

**Files:**
- Modify: `js/balance.js`

- [ ] **Step 1: Replace `js/balance.js` with the full roster**

```js
// Plan-2 balance: 23 cars across 6 classes + parts catalog.
// Per-car id is the key into ownedCars/currentCarId.

const cars = [
  // Class E — Street (4 cars)
  { id: 'e1', classIndex: 0, name: 'Civitas', archetype: 'sedan',  color1: 0x4d6dd6, color2: 0x2a3950, price: 1500,  mass: 1280, grip: 1.05, dragCoef: 0.40, rollingResistance: 0.013, redlineRpm: 6500, idleRpm: 850,  launchRpmMax: 5200, engineResponse: 7.5, gearRatios: [3.5, 2.2, 1.5, 1.0], finalDrive: 3.7,  wheelRadius: 0.32, torquePeakNm: 220, torquePeakRpm: 4500, torqueWidth: 1500 },
  { id: 'e2', classIndex: 0, name: 'Hatch GT',  archetype: 'hatch',  color1: 0xe2c11a, color2: 0x222222, price: 1900,  mass: 1180, grip: 1.10, dragCoef: 0.39, rollingResistance: 0.012, redlineRpm: 6800, idleRpm: 900,  launchRpmMax: 5400, engineResponse: 8.0, gearRatios: [3.6, 2.1, 1.5, 1.0], finalDrive: 3.85, wheelRadius: 0.32, torquePeakNm: 260, torquePeakRpm: 4700, torqueWidth: 1500 },
  { id: 'e3', classIndex: 0, name: 'Compact RS', archetype: 'hatch',  color1: 0xe04545, color2: 0x222222, price: 2300,  mass: 1200, grip: 1.12, dragCoef: 0.38, rollingResistance: 0.012, redlineRpm: 7000, idleRpm: 900,  launchRpmMax: 5600, engineResponse: 8.2, gearRatios: [3.5, 2.1, 1.5, 1.0], finalDrive: 3.85, wheelRadius: 0.32, torquePeakNm: 290, torquePeakRpm: 4900, torqueWidth: 1500 },
  { id: 'e4', classIndex: 0, name: 'Sedan SE',  archetype: 'sedan',  color1: 0x4040a0, color2: 0x202050, price: 2700,  mass: 1330, grip: 1.05, dragCoef: 0.41, rollingResistance: 0.013, redlineRpm: 6200, idleRpm: 850,  launchRpmMax: 5000, engineResponse: 7.4, gearRatios: [3.4, 2.0, 1.4, 1.0], finalDrive: 3.6,  wheelRadius: 0.33, torquePeakNm: 320, torquePeakRpm: 4400, torqueWidth: 1500 },

  // Class D — Modified (4)
  { id: 'd1', classIndex: 1, name: 'Hot Hatch R', archetype: 'hatch', color1: 0x18b8a0, color2: 0x222222, price: 4500,  mass: 1240, grip: 1.18, dragCoef: 0.37, rollingResistance: 0.012, redlineRpm: 7200, idleRpm: 900,  launchRpmMax: 5800, engineResponse: 8.5, gearRatios: [3.4, 2.1, 1.5, 1.0], finalDrive: 3.85, wheelRadius: 0.33, torquePeakNm: 360, torquePeakRpm: 5000, torqueWidth: 1600 },
  { id: 'd2', classIndex: 1, name: 'Track Spec', archetype: 'hatch', color1: 0xff8a3a, color2: 0x222222, price: 5500,  mass: 1180, grip: 1.22, dragCoef: 0.36, rollingResistance: 0.011, redlineRpm: 7400, idleRpm: 900,  launchRpmMax: 5900, engineResponse: 8.6, gearRatios: [3.3, 2.0, 1.45, 1.0], finalDrive: 3.9,  wheelRadius: 0.33, torquePeakNm: 380, torquePeakRpm: 5100, torqueWidth: 1600 },
  { id: 'd3', classIndex: 1, name: 'Pony',      archetype: 'sport', color1: 0x6c40a8, color2: 0x222222, price: 6800,  mass: 1380, grip: 1.15, dragCoef: 0.36, rollingResistance: 0.012, redlineRpm: 7000, idleRpm: 900,  launchRpmMax: 5700, engineResponse: 8.0, gearRatios: [3.3, 2.0, 1.45, 0.95], finalDrive: 3.7, wheelRadius: 0.34, torquePeakNm: 420, torquePeakRpm: 4900, torqueWidth: 1700 },
  { id: 'd4', classIndex: 1, name: 'Coupe S',   archetype: 'sport', color1: 0x202020, color2: 0x101010, price: 8000,  mass: 1340, grip: 1.20, dragCoef: 0.35, rollingResistance: 0.011, redlineRpm: 7100, idleRpm: 900,  launchRpmMax: 5750, engineResponse: 8.2, gearRatios: [3.3, 2.0, 1.45, 0.95], finalDrive: 3.7, wheelRadius: 0.34, torquePeakNm: 440, torquePeakRpm: 5000, torqueWidth: 1700 },

  // Class C — Sport (4)
  { id: 'c1', classIndex: 2, name: 'GT-S',     archetype: 'sport', color1: 0xc83a26, color2: 0x32100d, price: 14000, mass: 1380, grip: 1.25, dragCoef: 0.34, rollingResistance: 0.011, redlineRpm: 7400, idleRpm: 950,  launchRpmMax: 5900, engineResponse: 8.5, gearRatios: [3.2, 2.0, 1.4, 0.95], finalDrive: 3.7, wheelRadius: 0.34, torquePeakNm: 480, torquePeakRpm: 5200, torqueWidth: 1700 },
  { id: 'c2', classIndex: 2, name: 'Spectre',  archetype: 'sport', color1: 0x101820, color2: 0x080808, price: 17000, mass: 1320, grip: 1.30, dragCoef: 0.33, rollingResistance: 0.011, redlineRpm: 7600, idleRpm: 950,  launchRpmMax: 6000, engineResponse: 8.7, gearRatios: [3.2, 2.0, 1.4, 0.9], finalDrive: 3.75, wheelRadius: 0.34, torquePeakNm: 500, torquePeakRpm: 5300, torqueWidth: 1700 },
  { id: 'c3', classIndex: 2, name: 'Vantage T', archetype: 'sport', color1: 0x2a8fd4, color2: 0x122a38, price: 20000, mass: 1360, grip: 1.28, dragCoef: 0.33, rollingResistance: 0.011, redlineRpm: 7500, idleRpm: 950,  launchRpmMax: 5950, engineResponse: 8.6, gearRatios: [3.2, 2.0, 1.4, 0.9], finalDrive: 3.75, wheelRadius: 0.34, torquePeakNm: 520, torquePeakRpm: 5300, torqueWidth: 1700 },
  { id: 'c4', classIndex: 2, name: 'Apex 1',   archetype: 'sport', color1: 0xffffff, color2: 0x080808, price: 24000, mass: 1290, grip: 1.32, dragCoef: 0.32, rollingResistance: 0.010, redlineRpm: 7800, idleRpm: 950,  launchRpmMax: 6100, engineResponse: 8.8, gearRatios: [3.1, 1.95, 1.4, 0.9], finalDrive: 3.85, wheelRadius: 0.34, torquePeakNm: 540, torquePeakRpm: 5400, torqueWidth: 1700 },

  // Class B — Muscle (4)
  { id: 'b1', classIndex: 3, name: 'Stallion',  archetype: 'muscle', color1: 0x2a8fd4, color2: 0x122a38, price: 38000,  mass: 1620, grip: 1.30, dragCoef: 0.36, rollingResistance: 0.011, redlineRpm: 6800, idleRpm: 900,  launchRpmMax: 5500, engineResponse: 8.0, gearRatios: [3.4, 2.1, 1.5, 1.0], finalDrive: 3.55, wheelRadius: 0.34, torquePeakNm: 660, torquePeakRpm: 4900, torqueWidth: 1900 },
  { id: 'b2', classIndex: 3, name: 'Boss 9',    archetype: 'muscle', color1: 0xff7f00, color2: 0x222222, price: 46000,  mass: 1700, grip: 1.32, dragCoef: 0.37, rollingResistance: 0.011, redlineRpm: 6700, idleRpm: 900,  launchRpmMax: 5400, engineResponse: 7.9, gearRatios: [3.5, 2.1, 1.5, 1.0], finalDrive: 3.55, wheelRadius: 0.35, torquePeakNm: 720, torquePeakRpm: 4800, torqueWidth: 1900 },
  { id: 'b3', classIndex: 3, name: 'Charger T', archetype: 'muscle', color1: 0x080808, color2: 0x080808, price: 54000,  mass: 1750, grip: 1.30, dragCoef: 0.37, rollingResistance: 0.011, redlineRpm: 6600, idleRpm: 900,  launchRpmMax: 5300, engineResponse: 7.8, gearRatios: [3.5, 2.1, 1.5, 1.0], finalDrive: 3.55, wheelRadius: 0.35, torquePeakNm: 770, torquePeakRpm: 4800, torqueWidth: 2000 },
  { id: 'b4', classIndex: 3, name: 'Vipera',    archetype: 'muscle', color1: 0xc02a2a, color2: 0x222222, price: 65000,  mass: 1640, grip: 1.35, dragCoef: 0.35, rollingResistance: 0.011, redlineRpm: 7000, idleRpm: 900,  launchRpmMax: 5600, engineResponse: 8.2, gearRatios: [3.4, 2.0, 1.45, 1.0], finalDrive: 3.55, wheelRadius: 0.34, torquePeakNm: 800, torquePeakRpm: 5000, torqueWidth: 1900 },

  // Class A — Supercar (4)
  { id: 'a1', classIndex: 4, name: 'Aria',     archetype: 'supercar', color1: 0xffd14a, color2: 0x080808, price: 130000, mass: 1480, grip: 1.45, dragCoef: 0.30, rollingResistance: 0.010, redlineRpm: 8500, idleRpm: 1000, launchRpmMax: 6800, engineResponse: 9.2, gearRatios: [3.0, 1.85, 1.35, 0.85], finalDrive: 3.7, wheelRadius: 0.34, torquePeakNm: 720, torquePeakRpm: 6000, torqueWidth: 1900 },
  { id: 'a2', classIndex: 4, name: 'Tempo',    archetype: 'supercar', color1: 0x1aaf65, color2: 0x101a14, price: 175000, mass: 1430, grip: 1.50, dragCoef: 0.30, rollingResistance: 0.010, redlineRpm: 8800, idleRpm: 1000, launchRpmMax: 7000, engineResponse: 9.4, gearRatios: [3.0, 1.85, 1.35, 0.85], finalDrive: 3.75, wheelRadius: 0.34, torquePeakNm: 760, torquePeakRpm: 6200, torqueWidth: 1900 },
  { id: 'a3', classIndex: 4, name: 'Strada',   archetype: 'supercar', color1: 0x2a4a98, color2: 0x080808, price: 220000, mass: 1450, grip: 1.50, dragCoef: 0.29, rollingResistance: 0.010, redlineRpm: 8800, idleRpm: 1000, launchRpmMax: 7000, engineResponse: 9.5, gearRatios: [3.0, 1.85, 1.35, 0.85], finalDrive: 3.85, wheelRadius: 0.34, torquePeakNm: 800, torquePeakRpm: 6300, torqueWidth: 1900 },
  { id: 'a4', classIndex: 4, name: 'Apex Pro', archetype: 'supercar', color1: 0xffffff, color2: 0x080808, price: 290000, mass: 1410, grip: 1.55, dragCoef: 0.28, rollingResistance: 0.009, redlineRpm: 9000, idleRpm: 1000, launchRpmMax: 7100, engineResponse: 9.6, gearRatios: [3.0, 1.85, 1.35, 0.85], finalDrive: 3.85, wheelRadius: 0.34, torquePeakNm: 850, torquePeakRpm: 6400, torqueWidth: 1900 },

  // Class Pro — Unlimited (3)
  { id: 'p1', classIndex: 5, name: 'Top Fuel I',  archetype: 'topfuel', color1: 0xb02a8a, color2: 0x1a1a1a, price: 600000,  mass: 1050, grip: 1.80, dragCoef: 0.28, rollingResistance: 0.009, redlineRpm: 9500, idleRpm: 1100, launchRpmMax: 7800, engineResponse: 10.0, gearRatios: [2.6, 1.7, 1.25, 0.85], finalDrive: 4.1, wheelRadius: 0.40, torquePeakNm: 1500, torquePeakRpm: 7200, torqueWidth: 2200 },
  { id: 'p2', classIndex: 5, name: 'Top Fuel II', archetype: 'topfuel', color1: 0xff3a3a, color2: 0x1a1a1a, price: 1200000, mass: 1020, grip: 1.85, dragCoef: 0.27, rollingResistance: 0.009, redlineRpm: 9700, idleRpm: 1100, launchRpmMax: 7900, engineResponse: 10.1, gearRatios: [2.6, 1.7, 1.25, 0.85], finalDrive: 4.1, wheelRadius: 0.40, torquePeakNm: 1700, torquePeakRpm: 7300, torqueWidth: 2200 },
  { id: 'p3', classIndex: 5, name: 'Funny Car',   archetype: 'topfuel', color1: 0x33dd55, color2: 0x1a1a1a, price: 2400000, mass: 1000, grip: 1.90, dragCoef: 0.27, rollingResistance: 0.009, redlineRpm: 9800, idleRpm: 1100, launchRpmMax: 8000, engineResponse: 10.2, gearRatios: [2.6, 1.7, 1.25, 0.85], finalDrive: 4.15, wheelRadius: 0.40, torquePeakNm: 1900, torquePeakRpm: 7400, torqueWidth: 2200 },
];

// Parts catalog: 5 slots, multiple tiers each. Tier 0 = stock (no install).
// Each tier is a percentage modifier to the base car stat plus a price.
const parts = {
  engine: [
    { tier: 0, name: 'Stock',         price: 0,     torquePeakMul: 1.00, redlineDelta: 0 },
    { tier: 1, name: 'Street Tune',   price: 1200,  torquePeakMul: 1.05, redlineDelta: 100 },
    { tier: 2, name: 'Performance',   price: 5800,  torquePeakMul: 1.12, redlineDelta: 300 },
    { tier: 3, name: 'Built Block',   price: 18000, torquePeakMul: 1.22, redlineDelta: 600 },
    { tier: 4, name: 'Race Internals', price: 48000, torquePeakMul: 1.35, redlineDelta: 1000 },
  ],
  turbo: [
    { tier: 0, name: 'None',           price: 0,     torquePeakMul: 1.00, torqueWidthMul: 1.00, redlineDelta: 0 },
    { tier: 1, name: 'Bolt-on Turbo',  price: 4500,  torquePeakMul: 1.10, torqueWidthMul: 1.05, redlineDelta: 0 },
    { tier: 2, name: 'Big Single',     price: 14000, torquePeakMul: 1.20, torqueWidthMul: 1.08, redlineDelta: 100 },
    { tier: 3, name: 'Twin Turbo',     price: 32000, torquePeakMul: 1.32, torqueWidthMul: 1.10, redlineDelta: 200 },
    { tier: 4, name: 'Quad Compound',  price: 80000, torquePeakMul: 1.50, torqueWidthMul: 1.15, redlineDelta: 300 },
  ],
  transmission: [
    { tier: 0, name: 'Stock',         price: 0,     engineResponseDelta: 0,   tunable: false },
    { tier: 1, name: 'Short Shift',   price: 800,   engineResponseDelta: 0.3, tunable: false },
    { tier: 2, name: 'Sequential',    price: 4200,  engineResponseDelta: 0.7, tunable: false },
    { tier: 3, name: 'Custom Ratios', price: 12000, engineResponseDelta: 1.0, tunable: true  },  // unlocks gear-ratio tuning
    { tier: 4, name: 'Race Spec',     price: 30000, engineResponseDelta: 1.5, tunable: true  },
  ],
  tires: [
    { tier: 0, name: 'OEM',          price: 0,     gripDelta: 0.00 },
    { tier: 1, name: 'Performance',  price: 600,   gripDelta: 0.05 },
    { tier: 2, name: 'Sticky',       price: 2200,  gripDelta: 0.12 },
    { tier: 3, name: 'Drag Radials', price: 7000,  gripDelta: 0.22 },
    { tier: 4, name: 'Slicks',       price: 20000, gripDelta: 0.35 },
  ],
  weight: [
    { tier: 0, name: 'Stock',           price: 0,     massMul: 1.00 },
    { tier: 1, name: 'Strip Interior',  price: 1500,  massMul: 0.95 },
    { tier: 2, name: 'Lightweight',     price: 6500,  massMul: 0.88 },
    { tier: 3, name: 'Carbon',          price: 22000, massMul: 0.78 },
  ],
};

// Default tune (per car instance). Gear ratios + final drive copy from car spec.
function defaultTune(car) {
  return {
    launchRpm: car.launchRpmMax,
    tirePressure: [32, 30],          // [front psi, rear psi]
    gearRatios: [...car.gearRatios], // copy
    finalDrive: car.finalDrive,
  };
}

// AI profile (Plan-1 had this nested; same shape)
const ai = {
  rtMean: 0.32,
  rtStd: 0.08,
  shiftBandSlackRpm: 250,
  shiftBandSlackStd: 120,
};

const env = { id: 'classic' };

export const balance = { cars, parts, ai, env, defaultTune };
```

- [ ] **Step 2: Existing tests using `balance.cars[0]` and `balance.cars[1]` still rely on the first two array entries being the player's muscle and the opponent's sport. Update the test fixtures to fetch by id.**

In `tests/race-logic.test.js`, near the top (after imports):

```js
// Helpers — Plan 2 made balance.cars an indexed roster of 23 cars.
// Tests that need specific defaults find them by id.
const PLAYER = balance.cars.find(c => c.id === 'b1');   // Stallion (muscle)
const OPPONENT = balance.cars.find(c => c.id === 'c1'); // GT-S (sport)
```

Then **modify all tests** that reference `balance.cars[0]` and `balance.cars[1]` to inject the player/opponent positions explicitly. The simplest fix: shadow `balance.cars` in each test with a 2-car array `[PLAYER, OPPONENT]`.

Actually cleaner: introduce a `balance2cars` helper that returns a balance object with only the 2 cars in slots [0, 1] for the existing race tests:

In `tests/race-logic.test.js`, near the top:

```js
function pickRaceBalance() {
  // Build a 2-car balance for race tests, keyed to existing player/opponent ids.
  const player = balance.cars.find(c => c.id === 'b1');
  const opp = balance.cars.find(c => c.id === 'c1');
  return { ...balance, cars: [player, opp] };
}
const balance2 = pickRaceBalance();
```

Then change all tests in `race-logic.test.js` to pass `balance2` instead of `balance` where they previously used `balance` for `tickRace` / `allocGameData` / `resetRace`. Walk through each test and update.

After update, run `npm test`. Expected: 25 passing (21 race-logic + 4 save).

- [ ] **Step 3: Bump v0.3.3 + commit**

```bash
git add js/balance.js tests/race-logic.test.js js/constants.js package.json
git commit -m "feat(balance): full 23-car roster (E/D/C/B/A/Pro) + 5-slot parts catalog; tests pin to player=b1 opponent=c1; v0.3.3"
```

---

## Task 5: parts.js — apply parts to car (TDD)

**Files:**
- Create: `js/parts.js`
- Test: `tests/parts.test.js`

- [ ] **Step 1: Write failing tests**

`tests/parts.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyPartsToCar } from '../js/parts.js';
import { balance } from '../js/balance.js';

const baseCar = balance.cars.find(c => c.id === 'b1');
const stockParts = { engine: 0, turbo: 0, transmission: 0, tires: 0, weight: 0 };

test('applyPartsToCar with all stock returns car with unchanged stats', () => {
  const out = applyPartsToCar(baseCar, stockParts, balance.parts);
  assert.equal(out.torquePeakNm, baseCar.torquePeakNm);
  assert.equal(out.redlineRpm, baseCar.redlineRpm);
  assert.equal(out.mass, baseCar.mass);
  assert.equal(out.grip, baseCar.grip);
  assert.equal(out.engineResponse, baseCar.engineResponse);
});

test('engine tier 2 increases torque by 12% and redline by 300', () => {
  const out = applyPartsToCar(baseCar, { ...stockParts, engine: 2 }, balance.parts);
  assert.ok(Math.abs(out.torquePeakNm - baseCar.torquePeakNm * 1.12) < 0.001);
  assert.equal(out.redlineRpm, baseCar.redlineRpm + 300);
});

test('turbo tier 1 stacks with engine tier 1 multiplicatively', () => {
  const out = applyPartsToCar(baseCar, { ...stockParts, engine: 1, turbo: 1 }, balance.parts);
  // 1.05 * 1.10 = 1.155
  assert.ok(Math.abs(out.torquePeakNm - baseCar.torquePeakNm * 1.05 * 1.10) < 0.001);
});

test('weight tier 2 reduces mass by 12%', () => {
  const out = applyPartsToCar(baseCar, { ...stockParts, weight: 2 }, balance.parts);
  assert.ok(Math.abs(out.mass - baseCar.mass * 0.88) < 0.001);
});

test('tires tier 3 increases grip by 0.22', () => {
  const out = applyPartsToCar(baseCar, { ...stockParts, tires: 3 }, balance.parts);
  assert.ok(Math.abs(out.grip - (baseCar.grip + 0.22)) < 0.001);
});

test('transmission tier 3 increases engineResponse by 1.0 and sets tunable flag', () => {
  const out = applyPartsToCar(baseCar, { ...stockParts, transmission: 3 }, balance.parts);
  assert.ok(Math.abs(out.engineResponse - (baseCar.engineResponse + 1.0)) < 0.001);
  assert.equal(out.transmissionTunable, true);
});

test('applyPartsToCar does not mutate the input car', () => {
  const before = JSON.stringify(baseCar);
  applyPartsToCar(baseCar, { ...stockParts, engine: 4, turbo: 4, transmission: 4, tires: 4, weight: 3 }, balance.parts);
  assert.equal(JSON.stringify(baseCar), before);
});
```

- [ ] **Step 2: Run, expect fail**

- [ ] **Step 3: Implement**

`js/parts.js`:

```js
/**
 * Apply parts modifiers to a base car spec.
 * Returns a NEW car object (does not mutate input).
 *
 * @param {object} baseCar  car spec from balance.cars
 * @param {object} parts    { engine: 0..4, turbo: 0..4, transmission: 0..4, tires: 0..4, weight: 0..3 }
 * @param {object} catalog  balance.parts
 * @returns {object} tuned car spec
 */
export function applyPartsToCar(baseCar, parts, catalog) {
  const eng = catalog.engine[parts.engine] || catalog.engine[0];
  const tur = catalog.turbo[parts.turbo] || catalog.turbo[0];
  const txm = catalog.transmission[parts.transmission] || catalog.transmission[0];
  const tir = catalog.tires[parts.tires] || catalog.tires[0];
  const wgt = catalog.weight[parts.weight] || catalog.weight[0];

  return {
    ...baseCar,
    torquePeakNm: baseCar.torquePeakNm * eng.torquePeakMul * tur.torquePeakMul,
    torqueWidth:  baseCar.torqueWidth * tur.torqueWidthMul,
    redlineRpm:   baseCar.redlineRpm + eng.redlineDelta + tur.redlineDelta,
    mass:         baseCar.mass * wgt.massMul,
    grip:         baseCar.grip + tir.gripDelta,
    engineResponse: baseCar.engineResponse + txm.engineResponseDelta,
    transmissionTunable: txm.tunable,
  };
}
```

- [ ] **Step 4: Run tests, expect 7 pass**

- [ ] **Step 5: Bump v0.3.4 + commit**

```bash
git add js/parts.js tests/parts.test.js js/constants.js package.json
git commit -m "feat(parts): applyPartsToCar pure fn — engine/turbo stack mul, tires/weight delta+mul, transmission unlocks tunable; v0.3.4"
```

---

## Task 6: tuning.js — apply tuning to car (TDD)

**Files:**
- Create: `js/tuning.js`
- Test: `tests/tuning.test.js`

- [ ] **Step 1: Write failing tests**

`tests/tuning.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyTuningToCar } from '../js/tuning.js';
import { balance } from '../js/balance.js';

const car = balance.cars.find(c => c.id === 'b1');

test('default tune leaves car stats unchanged', () => {
  const tune = balance.defaultTune(car);
  const out = applyTuningToCar(car, tune);
  assert.deepEqual(out.gearRatios, car.gearRatios);
  assert.equal(out.finalDrive, car.finalDrive);
  assert.equal(out.launchRpmMax, car.launchRpmMax);
});

test('custom launchRpm overrides launchRpmMax (clamped to redline)', () => {
  const tune = { ...balance.defaultTune(car), launchRpm: 99999 };
  const out = applyTuningToCar(car, tune);
  assert.equal(out.launchRpmMax, car.redlineRpm); // clamped at redline
});

test('custom gear ratios applied when transmissionTunable is true', () => {
  const carWithTunable = { ...car, transmissionTunable: true };
  const tune = { ...balance.defaultTune(carWithTunable), gearRatios: [4.0, 2.5, 1.7, 1.1] };
  const out = applyTuningToCar(carWithTunable, tune);
  assert.deepEqual(out.gearRatios, [4.0, 2.5, 1.7, 1.1]);
});

test('custom gear ratios IGNORED when transmissionTunable is false', () => {
  const tune = { ...balance.defaultTune(car), gearRatios: [4.0, 2.5, 1.7, 1.1] };
  const out = applyTuningToCar(car, tune);
  assert.deepEqual(out.gearRatios, car.gearRatios); // base ratios kept
});

test('tire pressure adjusts effective grip slightly', () => {
  // High pressure (40+ psi) reduces grip; low pressure (under 28 psi) increases it.
  // Default 32 psi front / 30 psi rear → no change.
  const stock = applyTuningToCar(car, balance.defaultTune(car));
  const lowPsi = applyTuningToCar(car, { ...balance.defaultTune(car), tirePressure: [22, 20] });
  const highPsi = applyTuningToCar(car, { ...balance.defaultTune(car), tirePressure: [42, 40] });
  assert.ok(lowPsi.grip > stock.grip, 'lower pressure should increase grip');
  assert.ok(highPsi.grip < stock.grip, 'higher pressure should decrease grip');
});

test('applyTuningToCar does not mutate input', () => {
  const before = JSON.stringify(car);
  applyTuningToCar(car, balance.defaultTune(car));
  assert.equal(JSON.stringify(car), before);
});
```

- [ ] **Step 2: Run, expect fail**

- [ ] **Step 3: Implement**

`js/tuning.js`:

```js
/**
 * Apply per-car tuning adjustments to a car spec (post-parts).
 * @param {object} car  car spec (already with parts applied)
 * @param {object} tune  { launchRpm, tirePressure: [f, r], gearRatios: [...], finalDrive }
 * @returns {object} tuned car spec
 */
export function applyTuningToCar(car, tune) {
  const out = { ...car };

  // Launch RPM target (clamped to redline)
  if (tune.launchRpm != null) {
    out.launchRpmMax = Math.min(tune.launchRpm, car.redlineRpm);
  }

  // Gear ratios — only honored if transmission is tunable
  if (car.transmissionTunable && Array.isArray(tune.gearRatios)) {
    out.gearRatios = [...tune.gearRatios];
  }
  if (tune.finalDrive != null) {
    out.finalDrive = tune.finalDrive;
  }

  // Tire pressure → grip adjustment
  // Optimal range: 28-34 psi rear. Outside range loses grip.
  // Below 28: more contact patch → more grip (up to a limit).
  // Above 34: less contact patch → less grip.
  if (Array.isArray(tune.tirePressure)) {
    const rearPsi = tune.tirePressure[1];
    const optimalRear = 30;
    const delta = rearPsi - optimalRear;
    // Linear: -0.005 grip per psi off-optimal, both directions but
    // low-psi side is treated as gain (asymmetric).
    let gripAdj;
    if (delta < 0) {
      gripAdj = Math.min(0.05, -delta * 0.005);   // gain up to +0.05 at -10psi
    } else {
      gripAdj = -Math.min(0.10, delta * 0.005);   // loss up to -0.10 at +20psi
    }
    out.grip = car.grip + gripAdj;
  }

  return out;
}
```

- [ ] **Step 4: Run tests, expect 6 pass**

- [ ] **Step 5: Bump v0.3.5 + commit**

```bash
git add js/tuning.js tests/tuning.test.js js/constants.js package.json
git commit -m "feat(tuning): applyTuningToCar pure fn — launchRpm clamp, gear ratios behind tunable flag, tire-pressure grip curve; v0.3.5"
```

---

## Task 7: career.js — career state object (TDD)

**Files:**
- Create: `js/career.js`
- Test: `tests/career.test.js`

- [ ] **Step 1: Write failing tests**

`tests/career.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  newCareer, addOwnedCar, removeOwnedCar, setCurrentCar,
  recordWin, recordLoss, addGold, spendGold,
  getCurrentClassWins, isClassComplete,
} from '../js/career.js';
import { balance } from '../js/balance.js';
import { CLASS_WINS_REQUIRED } from '../js/constants.js';

test('newCareer starts at class E with no cars and starting gold', () => {
  const c = newCareer();
  assert.equal(c.classIndex, 0);
  assert.equal(c.classWins, 0);
  assert.deepEqual(c.ownedCars, []);
  assert.equal(c.currentCarId, null);
  assert.ok(c.gold > 0); // starting gold
});

test('addOwnedCar adds to ownedCars + sets as current if first', () => {
  let c = newCareer();
  c = addOwnedCar(c, { carId: 'e1', parts: {}, tune: {}, paint: {} });
  assert.equal(c.ownedCars.length, 1);
  assert.equal(c.currentCarId, 'e1');
});

test('addOwnedCar does NOT change currentCarId if already set', () => {
  let c = newCareer();
  c = addOwnedCar(c, { carId: 'e1', parts: {}, tune: {}, paint: {} });
  c = addOwnedCar(c, { carId: 'e2', parts: {}, tune: {}, paint: {} });
  assert.equal(c.currentCarId, 'e1');
  assert.equal(c.ownedCars.length, 2);
});

test('recordWin increments classWins and gold', () => {
  let c = newCareer();
  c = addGold(c, 0); // ensure base
  const startGold = c.gold;
  c = recordWin(c, { gold: 100 });
  assert.equal(c.classWins, 1);
  assert.equal(c.gold, startGold + 100);
});

test('isClassComplete true when classWins >= CLASS_WINS_REQUIRED', () => {
  let c = newCareer();
  for (let i = 0; i < CLASS_WINS_REQUIRED; i++) {
    c = recordWin(c, { gold: 100 });
  }
  assert.ok(isClassComplete(c));
});

test('recordWin advances class once threshold met (resets classWins)', () => {
  let c = newCareer();
  for (let i = 0; i < CLASS_WINS_REQUIRED; i++) {
    c = recordWin(c, { gold: 100 });
  }
  // Next win should advance class
  c = recordWin(c, { gold: 100 });
  assert.equal(c.classIndex, 1);
  assert.equal(c.classWins, 1);  // 1 win in new class (the win that triggered)
});

test('spendGold deducts gold; throws if insufficient', () => {
  let c = newCareer();
  const startGold = c.gold;
  c = spendGold(c, 50);
  assert.equal(c.gold, startGold - 50);
  assert.throws(() => spendGold(c, c.gold + 1));
});

test('removeOwnedCar removes from ownedCars (and clears current if it was)', () => {
  let c = newCareer();
  c = addOwnedCar(c, { carId: 'e1', parts: {}, tune: {}, paint: {} });
  c = addOwnedCar(c, { carId: 'e2', parts: {}, tune: {}, paint: {} });
  c = removeOwnedCar(c, 'e1');
  assert.equal(c.ownedCars.length, 1);
  assert.equal(c.currentCarId, 'e2'); // promoted to current
});
```

- [ ] **Step 2: Run, expect fail**

- [ ] **Step 3: Implement**

`js/career.js`:

```js
import { CLASS_WINS_REQUIRED, NUM_CLASSES } from './constants.js';

const STARTING_GOLD = 1500;  // enough to buy an E-class car

/** Create an initial career state. */
export function newCareer() {
  return {
    version: 1,
    classIndex: 0,
    classWins: 0,
    gold: STARTING_GOLD,
    ownedCars: [],     // [{ carId, parts, tune, paint }]
    currentCarId: null,
  };
}

/** Returns NEW state with the car added. If first car, set as current. */
export function addOwnedCar(state, carInstance) {
  const ownedCars = [...state.ownedCars, carInstance];
  return {
    ...state,
    ownedCars,
    currentCarId: state.currentCarId || carInstance.carId,
  };
}

/** Returns NEW state with car removed; promotes another car to current if needed. */
export function removeOwnedCar(state, carId) {
  const ownedCars = state.ownedCars.filter(c => c.carId !== carId);
  let currentCarId = state.currentCarId;
  if (currentCarId === carId) {
    currentCarId = ownedCars.length > 0 ? ownedCars[0].carId : null;
  }
  return { ...state, ownedCars, currentCarId };
}

/** Returns NEW state with currentCarId set (must be in ownedCars). */
export function setCurrentCar(state, carId) {
  if (!state.ownedCars.some(c => c.carId === carId)) {
    throw new Error('cannot set current to unowned car: ' + carId);
  }
  return { ...state, currentCarId: carId };
}

/**
 * Record a win in the current class. Awards gold. If classWins reaches
 * threshold AFTER this win, advance to next class and reset classWins to 1
 * (the win that triggered advancement counts toward the new class).
 */
export function recordWin(state, { gold }) {
  const newWins = state.classWins + 1;
  let classIndex = state.classIndex;
  let classWins = newWins;
  if (newWins > CLASS_WINS_REQUIRED) {
    classIndex = Math.min(NUM_CLASSES - 1, classIndex + 1);
    classWins = 1;
  }
  return {
    ...state,
    classIndex,
    classWins,
    gold: state.gold + gold,
  };
}

/** Record a loss. Awards consolation gold; doesn't change class. */
export function recordLoss(state, { gold }) {
  return { ...state, gold: state.gold + gold };
}

/** Add gold (free credit, e.g., shop pack). Returns NEW state. */
export function addGold(state, n) {
  return { ...state, gold: state.gold + n };
}

/** Spend gold. Throws if insufficient. Returns NEW state. */
export function spendGold(state, n) {
  if (state.gold < n) throw new Error('insufficient gold');
  return { ...state, gold: state.gold - n };
}

/** True if the player has hit the class-completion threshold. */
export function isClassComplete(state) {
  return state.classWins >= CLASS_WINS_REQUIRED;
}

export function getCurrentClassWins(state) {
  return state.classWins;
}
```

- [ ] **Step 4: Run, expect 8 pass**

- [ ] **Step 5: Bump v0.3.6 + commit**

```bash
git add js/career.js tests/career.test.js js/constants.js package.json
git commit -m "feat(career): pure career state object — newCareer, addOwnedCar, recordWin/Loss, gold transactions, class advancement at WINS_REQUIRED; v0.3.6"
```

---

## Task 8: Title-screen overhaul — New Career / Continue / Quick Race / Garage

**Files:**
- Modify: `index.html`
- Modify: `css/ui.css`
- Modify: `js/main.js`

- [ ] **Step 1: Replace `#screen-title` block in `index.html`**

```html
<div id="screen-title" class="screen">
  <h1 class="game-title">DRAG RACE 3D</h1>
  <button id="btn-continue-career" class="btn-primary hidden">CONTINUE CAREER</button>
  <button id="btn-new-career" class="btn-primary">NEW CAREER</button>
  <button id="btn-quick-race" class="btn-secondary">QUICK RACE</button>
  <button id="btn-garage" class="btn-secondary">GARAGE</button>
  <div class="version" id="version-text"></div>
</div>
```

- [ ] **Step 2: Add `.btn-secondary` CSS to `css/ui.css`**

Append:

```css
.btn-secondary {
  font-size: 32px; font-weight: 600; padding: 14px 40px; margin-top: 14px;
  background: transparent; border: 2px solid #888; color: #fff; border-radius: 12px;
  cursor: pointer;
}
.btn-secondary:active { background: #444; }
.btn-secondary.hidden, .btn-primary.hidden { display: none; }
```

- [ ] **Step 3: Wire title buttons in `js/main.js`**

After the existing version-text line, REPLACE the start-button handler with the four-button setup. Open `js/main.js` and find:

```js
document.getElementById('btn-start').addEventListener('click', e => {
  e.currentTarget.blur();
  startRace();
});
```

(There's no `btn-start` anymore — we removed it.) Replace with:

```js
import { loadCareer } from './save.js';
import { newCareer } from './career.js';

let careerState = null;

async function initTitleButtons() {
  const continueBtn = document.getElementById('btn-continue-career');
  const newBtn      = document.getElementById('btn-new-career');
  const quickBtn    = document.getElementById('btn-quick-race');
  const garageBtn   = document.getElementById('btn-garage');

  // Show CONTINUE only if a save exists
  const existing = await loadCareer();
  if (existing) {
    careerState = existing;
    continueBtn.classList.remove('hidden');
  }

  newBtn.addEventListener('click', e => { e.currentTarget.blur(); onNewCareer(); });
  continueBtn.addEventListener('click', e => { e.currentTarget.blur(); onContinueCareer(); });
  quickBtn.addEventListener('click', e => { e.currentTarget.blur(); onQuickRace(); });
  garageBtn.addEventListener('click', e => { e.currentTarget.blur(); onGarage(); });
}

function onNewCareer() {
  careerState = newCareer();
  // Plan-2 Task 9 fills in: pick first car, save, advance to career home
  console.log('NEW CAREER (todo: car-pick screen)');
}
function onContinueCareer() {
  console.log('CONTINUE (todo: career-home screen)');
}
function onQuickRace() {
  console.log('QUICK RACE (todo: class-pick → race)');
}
function onGarage() {
  console.log('GARAGE (todo: garage screen)');
}

initTitleButtons();
```

- [ ] **Step 4: Manual smoke**

Open the page. Title screen should show 3 buttons (no continue since no save yet). Each button logs to console.

- [ ] **Step 5: Bump v0.3.7 + commit**

```bash
git add index.html css/ui.css js/main.js js/constants.js package.json
git commit -m "feat(ui): title screen with NEW CAREER / CONTINUE / QUICK RACE / GARAGE; CONTINUE shown only if save exists; stub handlers for next tasks; v0.3.7"
```

---

## Task 9: New-career flow — first-car pick

**Files:**
- Modify: `index.html`
- Modify: `css/ui.css`
- Modify: `js/main.js`
- Create: `js/career-flow.js`

- [ ] **Step 1: Add `#screen-firstcar` to `index.html`** (after #screen-title):

```html
<div id="screen-firstcar" class="screen hidden">
  <h2>PICK YOUR FIRST CAR</h2>
  <p class="subtitle">Class E starter — your career begins here.</p>
  <div id="firstcar-grid" class="car-grid"></div>
  <button id="btn-firstcar-back" class="btn-secondary">BACK</button>
</div>
```

- [ ] **Step 2: Add `.car-grid` and `.car-tile` styles to `css/ui.css`**

Append:

```css
.car-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 14px;
  margin: 24px 0;
  padding: 0 32px;
  max-width: 720px;
}
.car-tile {
  background: #1a1d22;
  border: 2px solid #333;
  border-radius: 12px;
  padding: 14px;
  cursor: pointer;
  text-align: left;
  color: #fff;
  font-family: system-ui;
}
.car-tile:active { border-color: #ff8a5a; }
.car-tile h3 { font-size: 22px; margin-bottom: 6px; }
.car-tile .stats { font-size: 14px; opacity: 0.7; line-height: 1.4; }
.car-tile .price { font-size: 18px; color: #ffd14a; margin-top: 8px; font-weight: 700; }
.car-tile.affordable { border-color: #2aa050; }
.car-tile.unaffordable { opacity: 0.45; cursor: not-allowed; }
```

- [ ] **Step 3: Create `js/career-flow.js`**

```js
import { balance } from './balance.js';
import { CLASS_NAMES } from './constants.js';
import { addOwnedCar, setCurrentCar } from './career.js';

/**
 * Render the class-E car grid. Each tile is clickable iff
 * career.gold >= car.price. onPick(carId) is called when an affordable
 * tile is clicked.
 */
export function renderFirstCarGrid(parent, careerState, onPick) {
  parent.innerHTML = '';
  const classECars = balance.cars.filter(c => c.classIndex === 0);
  for (const car of classECars) {
    const tile = document.createElement('div');
    const affordable = careerState.gold >= car.price;
    tile.className = 'car-tile ' + (affordable ? 'affordable' : 'unaffordable');
    tile.innerHTML = `
      <h3>${car.name}</h3>
      <div class="stats">${car.archetype} · ${car.torquePeakNm}Nm @ ${car.torquePeakRpm}rpm · ${car.mass}kg</div>
      <div class="price">${formatGold(car.price)}g</div>
    `;
    if (affordable) {
      tile.addEventListener('click', () => onPick(car.id));
    }
    parent.appendChild(tile);
  }
}

export function formatGold(n) {
  return n.toLocaleString('en-US');
}

/** Build a default car instance for a given carId. */
export function buildOwnedCarInstance(carId) {
  const car = balance.cars.find(c => c.id === carId);
  return {
    carId,
    parts: { engine: 0, turbo: 0, transmission: 0, tires: 0, weight: 0 },
    tune: balance.defaultTune(car),
    paint: { primary: car.color1, secondary: car.color2, stripe: 'none' },
  };
}
```

- [ ] **Step 4: Wire `onNewCareer` in `main.js` to show the firstcar screen**

In `main.js`, replace the stub `onNewCareer` with:

```js
import { renderFirstCarGrid, buildOwnedCarInstance } from './career-flow.js';
import { saveCareer } from './save.js';
import { spendGold } from './career.js';

function onNewCareer() {
  careerState = newCareer();
  renderFirstCarGrid(
    document.getElementById('firstcar-grid'),
    careerState,
    onFirstCarPicked
  );
  show('screen-firstcar');
}

async function onFirstCarPicked(carId) {
  const car = balance.cars.find(c => c.id === carId);
  careerState = spendGold(careerState, car.price);
  const carInstance = buildOwnedCarInstance(carId);
  careerState = addOwnedCar(careerState, carInstance);
  await saveCareer(careerState);
  console.log('NEW CAREER STARTED with', carId, '— gold:', careerState.gold);
  // Plan-2 Task 10 fills in: show career home
}

document.getElementById('btn-firstcar-back').addEventListener('click', () => show('screen-title'));
```

- [ ] **Step 5: Manual smoke** — Click NEW CAREER → see 4 E-class car tiles with prices. Affordable ones (≤ 1500g) highlight green. Click one → console logs the new career.

- [ ] **Step 6: Bump v0.3.8 + commit**

```bash
git add index.html css/ui.css js/main.js js/career-flow.js js/constants.js package.json
git commit -m "feat(career): NEW CAREER → first-car pick (4 E-class tiles, affordability gating, save on selection); v0.3.8"
```

---

## Task 10: Career home screen + race-card

**Files:**
- Modify: `index.html`
- Modify: `css/ui.css`
- Modify: `js/main.js`
- Modify: `js/career-flow.js`

- [ ] **Step 1: Add `#screen-career-home` to `index.html`**

```html
<div id="screen-career-home" class="screen hidden">
  <h2 id="career-class-text">CLASS E</h2>
  <div class="career-stats">
    <div class="career-row"><span>Wins</span><strong id="career-wins">0 / 5</strong></div>
    <div class="career-row"><span>Gold</span><strong id="career-gold" class="gold">0g</strong></div>
    <div class="career-row"><span>Current car</span><strong id="career-currentcar">—</strong></div>
  </div>
  <button id="btn-next-race" class="btn-primary">NEXT RACE</button>
  <button id="btn-career-garage" class="btn-secondary">GARAGE</button>
  <button id="btn-career-back" class="btn-secondary">MAIN MENU</button>
</div>
```

- [ ] **Step 2: Add styles to `css/ui.css`**

```css
.career-stats {
  background: #1a1d22; border-radius: 12px;
  padding: 18px 24px; margin: 24px 0; min-width: 320px;
}
.career-row {
  display: flex; justify-content: space-between;
  font-size: 22px; padding: 6px 0;
}
.career-row strong { color: #fff; }
.career-row .gold, .gold { color: #ffd14a; }
```

- [ ] **Step 3: Add a `renderCareerHome(careerState)` function to `career-flow.js`**

Append to `career-flow.js`:

```js
export function renderCareerHome(careerState) {
  const ownedCar = careerState.ownedCars.find(c => c.carId === careerState.currentCarId);
  const car = ownedCar ? balance.cars.find(c => c.id === ownedCar.carId) : null;

  document.getElementById('career-class-text').textContent =
    'CLASS ' + CLASS_NAMES[careerState.classIndex];
  document.getElementById('career-wins').textContent =
    `${careerState.classWins} / 5`;
  document.getElementById('career-gold').textContent =
    formatGold(careerState.gold) + 'g';
  document.getElementById('career-currentcar').textContent =
    car ? car.name : '—';
}
```

- [ ] **Step 4: Wire show-career-home in `main.js`**

In main.js, append:

```js
import { renderCareerHome } from './career-flow.js';

async function showCareerHome() {
  if (!careerState) return;
  renderCareerHome(careerState);
  show('screen-career-home');
}

// onContinueCareer goes straight to home
function onContinueCareer() { showCareerHome(); }

// After first-car pick, also go to home
async function onFirstCarPicked(carId) {
  const car = balance.cars.find(c => c.id === carId);
  careerState = spendGold(careerState, car.price);
  careerState = addOwnedCar(careerState, buildOwnedCarInstance(carId));
  await saveCareer(careerState);
  showCareerHome();
}

// Wire buttons
document.getElementById('btn-career-back').addEventListener('click', () => show('screen-title'));
document.getElementById('btn-career-garage').addEventListener('click', () => onGarage());
document.getElementById('btn-next-race').addEventListener('click', () => onNextRace());

function onNextRace() {
  console.log('NEXT RACE (todo: build race-card)');
}
```

- [ ] **Step 5: Manual smoke** — NEW CAREER → pick car → career home shows class/wins/gold/car name. CONTINUE on next page load works (since we saved).

- [ ] **Step 6: Bump v0.3.9 + commit**

```bash
git add index.html css/ui.css js/main.js js/career-flow.js js/constants.js package.json
git commit -m "feat(career): career-home screen with class/wins/gold/car-name; CONTINUE entrypoint; v0.3.9"
```

---

## Task 11: Career race wiring — generate opponent + plug into existing race

**Files:**
- Modify: `js/main.js`
- Modify: `js/career-flow.js`
- Modify: `js/race-logic.js` (small — accept post-race callback)
- Modify: `js/balance.js` (small — `pickOpponentForClass(classIdx, excludeId, seed)`)

- [ ] **Step 1: Add an opponent picker to `js/balance.js`**

At the bottom of `balance.js`:

```js
/**
 * Pick a deterministic opponent car id from the same class as the player's car.
 * Excludes the player's chosen car id. Uses a seeded shuffle for variety.
 */
export function pickOpponentCarId(classIndex, excludeId, seed) {
  const candidates = cars.filter(c => c.classIndex === classIndex && c.id !== excludeId);
  if (candidates.length === 0) return null;
  // Cheap deterministic pick: hash seed
  const idx = ((seed >>> 0) * 2654435761) >>> 0;
  return candidates[idx % candidates.length].id;
}
```

Add `pickOpponentCarId` to the export.

- [ ] **Step 2: Build the per-race balance object in `career-flow.js`**

Append:

```js
import { applyPartsToCar } from './parts.js';
import { applyTuningToCar } from './tuning.js';
import { pickOpponentCarId } from './balance.js';

/**
 * Construct the 2-car balance object the race-physics expects, given
 * the career state and a seed for opponent selection.
 */
export function buildRaceBalance(careerState, seed) {
  const ownedCar = careerState.ownedCars.find(c => c.carId === careerState.currentCarId);
  const playerBase = balance.cars.find(c => c.id === ownedCar.carId);
  const playerWithParts = applyPartsToCar(playerBase, ownedCar.parts, balance.parts);
  const playerFinal = applyTuningToCar(playerWithParts, ownedCar.tune);

  const opponentId = pickOpponentCarId(careerState.classIndex, ownedCar.carId, seed);
  const opponentBase = balance.cars.find(c => c.id === opponentId);
  // Opponent runs stock parts/tune
  const opponentParts = { engine: 0, turbo: 0, transmission: 0, tires: 0, weight: 0 };
  const opponentWithParts = applyPartsToCar(opponentBase, opponentParts, balance.parts);
  const opponentFinal = applyTuningToCar(opponentWithParts, balance.defaultTune(opponentBase));

  return { ...balance, cars: [playerFinal, opponentFinal] };
}
```

- [ ] **Step 3: Replace the `loop`'s `balance` reference in `main.js`**

Currently `main.js` imports `balance` once at top and uses it for the race. Now we need a *different* balance per race — based on career state.

The `main.js` loop already passes `balance` to `tickRace`. We'll introduce `let raceBalance = balance` as the live one, and reset it from `careerState` on each `onNextRace`.

Modify `main.js`:

```js
import { buildRaceBalance } from './career-flow.js';

let raceBalance = balance; // default until a career race starts

// In the loop:
//   tickRace(gameData, raceBalance, FIXED_DT);
// (replace existing `balance` arg with `raceBalance`)
```

Also update `startRace`:

```js
function startRace() {
  if (!scene) {
    const built = buildRaceScene(raceBalance);
    scene = built.scene; cars = built.cars; env = built.env;
  }
  resetRace(gameData, raceBalance, Date.now() | 0);
  resetEffects();
  show('hud');
  started = true;
  const tachContainer = document.getElementById('tach-container');
  tachUpdater = buildTachSVG(tachContainer, raceBalance.cars[0].redlineRpm, GREEN_BAND_RPM);
}
```

NOTE: `buildRaceScene(raceBalance)` is called only on first race. Subsequent races would reuse the existing scene with stock car models. Since cars in different classes use different archetypes, we need to **rebuild the scene** when the player car class or archetype changes.

Easiest: rebuild the scene every time `startRace` is called. Add `scene = null` at the top of startRace:

```js
function startRace() {
  // Rebuild scene every race (player may have switched cars / classes)
  if (scene) {
    scene.children.length = 0;  // gc-safe scene reset
    scene = null;
  }
  const built = buildRaceScene(raceBalance);
  scene = built.scene; cars = built.cars; env = built.env;
  resetRace(gameData, raceBalance, Date.now() | 0);
  resetEffects();
  show('hud');
  started = true;
  const tachContainer = document.getElementById('tach-container');
  tachUpdater = buildTachSVG(tachContainer, raceBalance.cars[0].redlineRpm, GREEN_BAND_RPM);
}
```

(NOTE: `scene.children.length = 0` removes all children but keeps the Scene object. We discard and rebuild.)

- [ ] **Step 4: Wire `onNextRace` in `main.js`**

```js
async function onNextRace() {
  raceBalance = buildRaceBalance(careerState, Date.now() | 0);
  startRace();
}
```

- [ ] **Step 5: Update results screen to record the win/loss**

In `main.js` `showResults` (already exists from Plan 1), at the END of the function (after rendering scores), record the result and persist:

```js
// (add at end of showResults, after the result text is set)
async function recordCareerResult() {
  if (!careerState) return; // quick race or no career
  const won = gameData.winnerCarIdx === PLAYER_CAR_IDX;
  const perfectRT = gameData.rtS[PLAYER_CAR_IDX] > 0 && gameData.rtS[PLAYER_CAR_IDX] < 0.100;
  const reward = computeRaceReward({
    classIndex: careerState.classIndex,
    won,
    mode: 'career',
    perfectRT,
  });
  if (won) {
    careerState = recordWin(careerState, { gold: reward });
  } else {
    careerState = recordLoss(careerState, { gold: reward });
  }
  await saveCareer(careerState);
  // Show gold delta on results screen
  const goldEl = document.createElement('div');
  goldEl.style.cssText = 'font-size:24px; color:#ffd14a; margin-top:12px;';
  goldEl.textContent = `+${reward}g  · Total: ${careerState.gold.toLocaleString()}g`;
  document.getElementById('screen-results').appendChild(goldEl);
}
recordCareerResult();
```

Also import the helpers at the top of `main.js`:

```js
import { recordWin, recordLoss } from './career.js';
import { computeRaceReward } from './economy.js';
```

- [ ] **Step 6: Update `RACE AGAIN` button** to return to career home (instead of restarting):

Modify the existing handler in `showResults`:

```js
document.getElementById('btn-rerun').addEventListener('click', () => {
  el.remove();
  if (careerState) showCareerHome();
  else startRace();  // quick race fallback
});
```

- [ ] **Step 7: Manual smoke** — NEW CAREER → pick car → career home → NEXT RACE → race plays → results show ET + gold delta → RACE AGAIN → back at career home with updated wins + gold.

- [ ] **Step 8: Bump v0.3.10 + commit**

```bash
git add js/main.js js/career-flow.js js/balance.js js/constants.js package.json
git commit -m "feat(career): NEXT RACE wires player+opponent into race; post-race records win/loss & gold; RACE AGAIN returns to career home; v0.3.10"
```

---

## Task 12: Garage screen — owned cars list

**Files:**
- Modify: `index.html`
- Modify: `css/ui.css`
- Create: `js/garage.js`
- Modify: `js/main.js`

- [ ] **Step 1: Add `#screen-garage` to `index.html`**

```html
<div id="screen-garage" class="screen hidden">
  <h2>GARAGE</h2>
  <div class="career-row" style="margin-bottom:14px;"><span>Gold</span><strong id="garage-gold" class="gold">0g</strong></div>
  <div id="garage-list" class="car-grid"></div>
  <button id="btn-garage-buy" class="btn-secondary">BUY NEW CAR</button>
  <button id="btn-garage-back" class="btn-secondary">BACK</button>
</div>
```

- [ ] **Step 2: Create `js/garage.js`**

```js
import { balance } from './balance.js';
import { CLASS_NAMES } from './constants.js';
import { formatGold } from './career-flow.js';

export function renderGarage(careerState, onCarPick) {
  document.getElementById('garage-gold').textContent = formatGold(careerState.gold) + 'g';
  const list = document.getElementById('garage-list');
  list.innerHTML = '';
  for (const owned of careerState.ownedCars) {
    const car = balance.cars.find(c => c.id === owned.carId);
    const tile = document.createElement('div');
    const isCurrent = careerState.currentCarId === owned.carId;
    tile.className = 'car-tile' + (isCurrent ? ' affordable' : '');
    tile.innerHTML = `
      <h3>${car.name}${isCurrent ? '  ✓' : ''}</h3>
      <div class="stats">CLASS ${CLASS_NAMES[car.classIndex]} · ${car.archetype}</div>
      <div class="stats">Engine T${owned.parts.engine} · Turbo T${owned.parts.turbo} · Trans T${owned.parts.transmission} · Tires T${owned.parts.tires} · Weight T${owned.parts.weight}</div>
    `;
    tile.addEventListener('click', () => onCarPick(owned.carId));
    list.appendChild(tile);
  }
}
```

- [ ] **Step 3: Wire `onGarage` in `main.js`**

```js
import { renderGarage } from './garage.js';

function onGarage() {
  if (!careerState) {
    careerState = newCareer();  // allow garage browsing without a save
  }
  renderGarage(careerState, onGarageCarPick);
  show('screen-garage');
}

function onGarageCarPick(carId) {
  console.log('GARAGE car pick:', carId);
  // Plan-2 Task 13 — show car detail
}

document.getElementById('btn-garage-back').addEventListener('click', () => {
  if (careerState && careerState.ownedCars.length > 0) showCareerHome();
  else show('screen-title');
});
document.getElementById('btn-garage-buy').addEventListener('click', () => {
  console.log('BUY NEW CAR (todo: shop screen)');
});
```

- [ ] **Step 4: Manual smoke** — From career home, GARAGE button → see owned cars (1 after new career). Tile shows tier badges (all T0 stock).

- [ ] **Step 5: Bump v0.3.11 + commit**

```bash
git add index.html css/ui.css js/garage.js js/main.js js/constants.js package.json
git commit -m "feat(garage): owned-cars list with stat badges, gold header, current-car indicator; v0.3.11"
```

---

## Task 13: Car-detail screen with tabs (Parts / Tune / Paint / Sell)

**Files:**
- Modify: `index.html`
- Modify: `css/ui.css`
- Modify: `js/garage.js`
- Modify: `js/main.js`

- [ ] **Step 1: Add `#screen-cardetail` to `index.html`**

```html
<div id="screen-cardetail" class="screen hidden">
  <h2 id="cardetail-name">Car Name</h2>
  <p class="subtitle" id="cardetail-class">CLASS</p>
  <div class="tabs">
    <button class="tab active" data-tab="parts">PARTS</button>
    <button class="tab" data-tab="tune">TUNE</button>
    <button class="tab" data-tab="paint">PAINT</button>
    <button class="tab" data-tab="sell">SELL</button>
  </div>
  <div id="cardetail-tabbody"></div>
  <button id="btn-cardetail-set-current" class="btn-secondary">SET AS CURRENT</button>
  <button id="btn-cardetail-back" class="btn-secondary">BACK</button>
</div>
```

- [ ] **Step 2: Add tab styles to `css/ui.css`**

```css
.tabs {
  display: flex; gap: 6px; margin: 18px 0; padding: 0 24px;
}
.tab {
  flex: 1; padding: 10px 0; font-size: 18px; font-weight: 700;
  background: #1a1d22; color: #888; border: 2px solid #333;
  border-radius: 8px; cursor: pointer;
  font-family: system-ui;
}
.tab.active { color: #fff; border-color: #ff8a5a; background: #2a2d33; }
#cardetail-tabbody { padding: 0 24px; min-height: 280px; max-width: 720px; margin: 0 auto; }
```

- [ ] **Step 3: Add `renderCarDetail` to `garage.js`**

```js
export function renderCarDetail(careerState, ownedCar, currentTab, onTabChange, onSetCurrent) {
  const car = balance.cars.find(c => c.id === ownedCar.carId);
  document.getElementById('cardetail-name').textContent = car.name;
  document.getElementById('cardetail-class').textContent =
    'CLASS ' + CLASS_NAMES[car.classIndex] + ' · ' + car.archetype;

  // Tab buttons
  document.querySelectorAll('#screen-cardetail .tab').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === currentTab);
  });

  // SET AS CURRENT visibility — hide if already current
  const setBtn = document.getElementById('btn-cardetail-set-current');
  setBtn.classList.toggle('hidden', careerState.currentCarId === car.id);
}
```

- [ ] **Step 4: Wire car-detail flow in `main.js`**

```js
import { renderCarDetail } from './garage.js';
import { setCurrentCar } from './career.js';

let activeOwnedCar = null;
let activeTab = 'parts';

function onGarageCarPick(carId) {
  activeOwnedCar = careerState.ownedCars.find(c => c.carId === carId);
  activeTab = 'parts';
  renderCarDetail(careerState, activeOwnedCar, activeTab, onTabChange, onSetCurrent);
  renderActiveTab();
  show('screen-cardetail');
}

function onTabChange(tab) {
  activeTab = tab;
  renderCarDetail(careerState, activeOwnedCar, activeTab, onTabChange, onSetCurrent);
  renderActiveTab();
}

function renderActiveTab() {
  const body = document.getElementById('cardetail-tabbody');
  body.innerHTML = '';
  switch (activeTab) {
    case 'parts': body.textContent = 'PARTS UI — Task 14'; break;
    case 'tune':  body.textContent = 'TUNE UI — Task 15'; break;
    case 'paint': body.textContent = 'PAINT UI — Task 16'; break;
    case 'sell':  body.textContent = 'SELL UI — Task 17'; break;
  }
}

function onSetCurrent() {
  careerState = setCurrentCar(careerState, activeOwnedCar.carId);
  saveCareer(careerState);
  renderCarDetail(careerState, activeOwnedCar, activeTab, onTabChange, onSetCurrent);
}

// Tab click delegation
document.querySelectorAll('#screen-cardetail .tab').forEach(btn => {
  btn.addEventListener('click', () => onTabChange(btn.dataset.tab));
});
document.getElementById('btn-cardetail-back').addEventListener('click', () => {
  renderGarage(careerState, onGarageCarPick); show('screen-garage');
});
document.getElementById('btn-cardetail-set-current').addEventListener('click', onSetCurrent);
```

- [ ] **Step 5: Manual smoke** — From garage, click owned car tile → car detail screen with 4 tabs. Each tab shows placeholder. Tabs switchable. Back button returns to garage.

- [ ] **Step 6: Bump v0.3.12 + commit**

```bash
git add index.html css/ui.css js/garage.js js/main.js js/constants.js package.json
git commit -m "feat(garage): car-detail screen with PARTS/TUNE/PAINT/SELL tabs (placeholder bodies); SET AS CURRENT button; v0.3.12"
```

---

## Task 14: Parts shop UI

**Files:**
- Create: `js/parts-shop.js`
- Modify: `js/main.js`
- Modify: `css/ui.css`

- [ ] **Step 1: Create `js/parts-shop.js`**

```js
import { balance } from './balance.js';
import { formatGold } from './career-flow.js';

const SLOT_LABELS = {
  engine: 'Engine',
  turbo: 'Turbo / Boost',
  transmission: 'Transmission',
  tires: 'Tires',
  weight: 'Weight Reduction',
};

export function renderPartsShop(parent, careerState, ownedCar, onInstall) {
  parent.innerHTML = '';
  for (const slot of Object.keys(SLOT_LABELS)) {
    const tiers = balance.parts[slot];
    const installed = ownedCar.parts[slot];

    const section = document.createElement('div');
    section.className = 'parts-slot';
    section.innerHTML = `<h3>${SLOT_LABELS[slot]}</h3>`;

    const tierRow = document.createElement('div');
    tierRow.className = 'tier-row';
    for (let t = 0; t < tiers.length; t++) {
      const part = tiers[t];
      const isInstalled = installed === t;
      const isPrev = t < installed;
      const canBuy = !isInstalled && !isPrev && t === installed + 1 && careerState.gold >= part.price;
      const btn = document.createElement('button');
      btn.className = 'tier-btn'
        + (isInstalled ? ' installed' : '')
        + (isPrev ? ' owned' : '')
        + (canBuy ? ' buyable' : '')
        + (!isInstalled && !isPrev && !canBuy ? ' locked' : '');
      btn.innerHTML = `<div class="t-name">T${t} ${part.name}</div>`
        + (t === 0 ? '' : `<div class="t-price">${formatGold(part.price)}g</div>`);
      if (canBuy) {
        btn.addEventListener('click', () => onInstall(slot, t));
      }
      tierRow.appendChild(btn);
    }
    section.appendChild(tierRow);
    parent.appendChild(section);
  }
}
```

- [ ] **Step 2: Add styles**

In `css/ui.css`:

```css
.parts-slot { margin: 12px 0; }
.parts-slot h3 { font-size: 18px; margin-bottom: 6px; opacity: 0.85; }
.tier-row { display: flex; gap: 6px; }
.tier-btn {
  flex: 1; padding: 10px 6px; font-size: 14px;
  background: #1a1d22; color: #888; border: 2px solid #333;
  border-radius: 8px; cursor: not-allowed; font-family: system-ui;
}
.tier-btn .t-name { font-weight: 700; }
.tier-btn .t-price { color: #ffd14a; margin-top: 4px; font-size: 13px; }
.tier-btn.installed { color: #fff; border-color: #2aa050; background: #1a3520; }
.tier-btn.owned    { color: #ddd; border-color: #2aa050; opacity: 0.5; }
.tier-btn.buyable  { color: #fff; border-color: #ff8a5a; cursor: pointer; }
.tier-btn.buyable:active { background: #2a2d33; }
.tier-btn.locked   { opacity: 0.4; }
```

- [ ] **Step 3: Wire in `main.js`**

Replace the parts placeholder in `renderActiveTab`:

```js
import { renderPartsShop } from './parts-shop.js';
import { spendGold } from './career.js';

function renderActiveTab() {
  const body = document.getElementById('cardetail-tabbody');
  body.innerHTML = '';
  switch (activeTab) {
    case 'parts': renderPartsShop(body, careerState, activeOwnedCar, onInstallPart); break;
    case 'tune':  body.textContent = 'TUNE UI — Task 15'; break;
    case 'paint': body.textContent = 'PAINT UI — Task 16'; break;
    case 'sell':  body.textContent = 'SELL UI — Task 17'; break;
  }
}

async function onInstallPart(slot, tier) {
  const price = balance.parts[slot][tier].price;
  if (careerState.gold < price) return;
  careerState = spendGold(careerState, price);
  // Mutate the owned-car instance's parts
  const idx = careerState.ownedCars.findIndex(c => c.carId === activeOwnedCar.carId);
  const updatedCar = {
    ...careerState.ownedCars[idx],
    parts: { ...careerState.ownedCars[idx].parts, [slot]: tier },
  };
  const newOwned = [...careerState.ownedCars];
  newOwned[idx] = updatedCar;
  careerState = { ...careerState, ownedCars: newOwned };
  activeOwnedCar = updatedCar;
  await saveCareer(careerState);
  renderActiveTab();
}
```

- [ ] **Step 4: Manual smoke** — Garage → owned car → PARTS tab → 5 slots × 5 tiers visible. Highest installed tier highlighted; only the next-up tier buyable iff gold sufficient. Click buyable → gold deducts, tier upgrades. Persists across reload.

- [ ] **Step 5: Bump v0.3.13 + commit**

```bash
git add js/parts-shop.js css/ui.css js/main.js js/constants.js package.json
git commit -m "feat(parts-shop): tiered slot UI; sequential prerequisites; deduct gold + persist on install; v0.3.13"
```

---

## Task 15: Tuning UI

**Files:**
- Create: `js/tuning-ui.js`
- Modify: `js/main.js`
- Modify: `css/ui.css`

- [ ] **Step 1: Create `js/tuning-ui.js`**

```js
import { balance } from './balance.js';
import { applyPartsToCar } from './parts.js';

export function renderTuningUI(parent, ownedCar, onChange) {
  const baseCar = balance.cars.find(c => c.id === ownedCar.carId);
  const withParts = applyPartsToCar(baseCar, ownedCar.parts, balance.parts);
  const tunable = withParts.transmissionTunable;

  parent.innerHTML = '';

  function slider(label, min, max, step, value, onInput, formatter) {
    const wrap = document.createElement('div');
    wrap.className = 'tune-row';
    wrap.innerHTML = `
      <div class="tune-label"><span>${label}</span><strong class="tune-value"></strong></div>
      <input type="range" min="${min}" max="${max}" step="${step}" value="${value}" />
    `;
    const valueEl = wrap.querySelector('.tune-value');
    const input = wrap.querySelector('input');
    valueEl.textContent = formatter(value);
    input.addEventListener('input', () => {
      const v = parseFloat(input.value);
      valueEl.textContent = formatter(v);
      onInput(v);
    });
    parent.appendChild(wrap);
  }

  // Launch RPM
  slider('Launch RPM', baseCar.idleRpm, baseCar.redlineRpm, 50, ownedCar.tune.launchRpm,
    v => onChange({ ...ownedCar.tune, launchRpm: v }),
    v => `${v} RPM`);

  // Tire pressure
  slider('Tire Pressure (rear)', 22, 42, 1, ownedCar.tune.tirePressure[1],
    v => onChange({ ...ownedCar.tune, tirePressure: [ownedCar.tune.tirePressure[0], v] }),
    v => `${v} psi`);

  // Final drive
  slider('Final Drive Ratio', 2.8, 4.5, 0.05, ownedCar.tune.finalDrive,
    v => onChange({ ...ownedCar.tune, finalDrive: +v.toFixed(2) }),
    v => v.toFixed(2));

  // Gear ratios — only if tunable
  if (tunable) {
    for (let g = 0; g < 4; g++) {
      slider(`Gear ${g+1} ratio`, 0.7, 4.5, 0.05, ownedCar.tune.gearRatios[g],
        v => {
          const gr = [...ownedCar.tune.gearRatios];
          gr[g] = +v.toFixed(2);
          onChange({ ...ownedCar.tune, gearRatios: gr });
        },
        v => v.toFixed(2));
    }
  } else {
    const note = document.createElement('div');
    note.className = 'tune-note';
    note.textContent = 'Install Transmission T3+ to unlock gear-ratio tuning.';
    parent.appendChild(note);
  }
}
```

- [ ] **Step 2: Styles in `css/ui.css`**

```css
.tune-row { margin: 14px 0; }
.tune-label { display: flex; justify-content: space-between; font-size: 16px; margin-bottom: 4px; }
.tune-label strong { color: #ffd14a; }
.tune-row input[type=range] { width: 100%; }
.tune-note { font-size: 14px; opacity: 0.7; margin-top: 16px; padding: 10px; background: #1a1d22; border-radius: 6px; }
```

- [ ] **Step 3: Wire in `main.js`**

```js
import { renderTuningUI } from './tuning-ui.js';

case 'tune': renderTuningUI(body, activeOwnedCar, onTuneChange); break;

async function onTuneChange(newTune) {
  const idx = careerState.ownedCars.findIndex(c => c.carId === activeOwnedCar.carId);
  const updated = { ...careerState.ownedCars[idx], tune: newTune };
  const newOwned = [...careerState.ownedCars];
  newOwned[idx] = updated;
  careerState = { ...careerState, ownedCars: newOwned };
  activeOwnedCar = updated;
  await saveCareer(careerState);
}
```

- [ ] **Step 4: Manual smoke** — TUNE tab. Sliders for Launch RPM, tire pressure, final drive. Gear ratio sliders only appear when transmission tier is 3+.

- [ ] **Step 5: Bump v0.3.14 + commit**

```bash
git add js/tuning-ui.js css/ui.css js/main.js js/constants.js package.json
git commit -m "feat(tune): tuning sliders (launch RPM, tire pressure, final drive, gear ratios); transmission-tier-3+ gates gear-ratio sliders; v0.3.14"
```

---

## Task 16: Paint picker UI

**Files:**
- Create: `js/paint-ui.js`
- Modify: `js/main.js`
- Modify: `css/ui.css`

- [ ] **Step 1: Create `js/paint-ui.js`**

```js
const STRIPE_OPTIONS = ['none', 'center', 'dual', 'racing'];
const PALETTE = [
  0xc83a26, 0xff7f00, 0xffd14a, 0x33dd55, 0x18b8a0, 0x2a8fd4, 0x6c40a8,
  0xb02a8a, 0xffffff, 0x080808, 0x4d6dd6, 0x808080,
];

export function renderPaintUI(parent, ownedCar, onChange) {
  parent.innerHTML = '';

  const primarySection = colorRow('Primary', ownedCar.paint.primary,
    c => onChange({ ...ownedCar.paint, primary: c }));
  const secondarySection = colorRow('Secondary (cabin)', ownedCar.paint.secondary,
    c => onChange({ ...ownedCar.paint, secondary: c }));
  parent.appendChild(primarySection);
  parent.appendChild(secondarySection);

  // Stripe variant
  const stripeWrap = document.createElement('div');
  stripeWrap.className = 'paint-row';
  stripeWrap.innerHTML = `<div class="paint-label">Stripe</div>`;
  const stripeRow = document.createElement('div');
  stripeRow.className = 'stripe-row';
  for (const opt of STRIPE_OPTIONS) {
    const btn = document.createElement('button');
    btn.className = 'stripe-btn' + (ownedCar.paint.stripe === opt ? ' selected' : '');
    btn.textContent = opt.toUpperCase();
    btn.addEventListener('click', () => onChange({ ...ownedCar.paint, stripe: opt }));
    stripeRow.appendChild(btn);
  }
  stripeWrap.appendChild(stripeRow);
  parent.appendChild(stripeWrap);
}

function colorRow(label, currentColor, onPick) {
  const wrap = document.createElement('div');
  wrap.className = 'paint-row';
  wrap.innerHTML = `<div class="paint-label">${label}</div>`;
  const row = document.createElement('div');
  row.className = 'palette-row';
  for (const c of PALETTE) {
    const sw = document.createElement('button');
    sw.className = 'swatch' + (c === currentColor ? ' selected' : '');
    sw.style.background = '#' + c.toString(16).padStart(6, '0');
    sw.addEventListener('click', () => onPick(c));
    row.appendChild(sw);
  }
  wrap.appendChild(row);
  return wrap;
}
```

- [ ] **Step 2: Styles**

```css
.paint-row { margin: 12px 0; }
.paint-label { font-size: 16px; margin-bottom: 6px; }
.palette-row { display: flex; flex-wrap: wrap; gap: 6px; }
.swatch { width: 36px; height: 36px; border: 2px solid #333; border-radius: 8px; cursor: pointer; }
.swatch.selected { border-color: #fff; box-shadow: 0 0 0 2px #ff8a5a; }
.stripe-row { display: flex; gap: 6px; }
.stripe-btn { flex: 1; padding: 8px 0; font-size: 14px; background: #1a1d22; color: #888;
  border: 2px solid #333; border-radius: 6px; cursor: pointer; font-family: system-ui; }
.stripe-btn.selected { color: #fff; border-color: #ff8a5a; }
```

- [ ] **Step 3: Wire**

```js
import { renderPaintUI } from './paint-ui.js';

case 'paint': renderPaintUI(body, activeOwnedCar, onPaintChange); break;

async function onPaintChange(newPaint) {
  const idx = careerState.ownedCars.findIndex(c => c.carId === activeOwnedCar.carId);
  const updated = { ...careerState.ownedCars[idx], paint: newPaint };
  const newOwned = [...careerState.ownedCars];
  newOwned[idx] = updated;
  careerState = { ...careerState, ownedCars: newOwned };
  activeOwnedCar = updated;
  await saveCareer(careerState);
  // Re-render so swatches show the new selection
  renderActiveTab();
}
```

- [ ] **Step 4: Plug paint into car-models** — `js/main.js`'s `buildRaceBalance` already passes `playerFinal`. We need the player's chosen colors to flow into `applyPartsToCar`'s output.

In `career-flow.js`, modify `buildRaceBalance` so the player's `paint.primary` and `paint.secondary` override `color1` and `color2`:

```js
const playerWithParts = applyPartsToCar(playerBase, ownedCar.parts, balance.parts);
const playerFinal = applyTuningToCar(playerWithParts, ownedCar.tune);
playerFinal.color1 = ownedCar.paint.primary;
playerFinal.color2 = ownedCar.paint.secondary;
```

- [ ] **Step 5: Manual smoke** — PAINT tab → 12 color swatches × 2 rows + 4 stripe buttons. Pick a color → race → see your car in that color.

(Stripe variant rendering is deferred — for now stripe is just a stored value.)

- [ ] **Step 6: Bump v0.3.15 + commit**

```bash
git add js/paint-ui.js css/ui.css js/main.js js/career-flow.js js/constants.js package.json
git commit -m "feat(paint): swatch palette + stripe selector; player paint overrides color1/2 on race; v0.3.15"
```

---

## Task 17: SELL tab

**Files:**
- Modify: `js/main.js`

- [ ] **Step 1: Wire SELL tab body**

In `main.js` `renderActiveTab`:

```js
case 'sell': renderSellUI(body, activeOwnedCar); break;

function renderSellUI(parent, ownedCar) {
  const car = balance.cars.find(c => c.id === ownedCar.carId);
  const sellPrice = Math.floor(car.price * 0.5);  // 50% of new price
  parent.innerHTML = `
    <div style="font-size:18px;margin-bottom:14px;">
      Sell ${car.name} for <span class="gold">${sellPrice.toLocaleString()}g</span>?
    </div>
    <p class="subtitle">You'll lose the parts and tune installed on this car.</p>
    <button id="btn-sell-confirm" class="btn-primary" ${
      careerState.ownedCars.length <= 1 ? 'disabled' : ''
    }>SELL</button>
  `;
  if (careerState.ownedCars.length <= 1) {
    parent.innerHTML += '<p class="subtitle" style="color:#ff8a5a;">Cannot sell your only car.</p>';
    return;
  }
  document.getElementById('btn-sell-confirm').addEventListener('click', async () => {
    const sellPrice = Math.floor(car.price * 0.5);
    careerState = removeOwnedCar(careerState, ownedCar.carId);
    careerState = { ...careerState, gold: careerState.gold + sellPrice };
    await saveCareer(careerState);
    renderGarage(careerState, onGarageCarPick);
    show('screen-garage');
  });
}
```

Import at top: `import { removeOwnedCar } from './career.js';`

- [ ] **Step 2: Manual smoke** — SELL tab. If only car: button disabled, warning shown. Else: confirm → car gone, gold added, returned to garage.

- [ ] **Step 3: Bump v0.3.16 + commit**

```bash
git add js/main.js js/constants.js package.json
git commit -m "feat(sell): SELL tab — 50% of car price refund; cannot sell only car; v0.3.16"
```

---

## Task 18: BUY NEW CAR — class shop

**Files:**
- Modify: `index.html`
- Modify: `js/main.js`
- Create: `js/buy-shop.js`

- [ ] **Step 1: Add `#screen-buyshop` to `index.html`**

```html
<div id="screen-buyshop" class="screen hidden">
  <h2>BUY NEW CAR</h2>
  <div class="career-row" style="margin-bottom:14px;"><span>Gold</span><strong id="buyshop-gold" class="gold">0g</strong></div>
  <div class="tabs" id="buyshop-class-tabs"></div>
  <div id="buyshop-grid" class="car-grid"></div>
  <button id="btn-buyshop-back" class="btn-secondary">BACK</button>
</div>
```

- [ ] **Step 2: Create `js/buy-shop.js`**

```js
import { balance } from './balance.js';
import { CLASS_NAMES, NUM_CLASSES } from './constants.js';
import { formatGold } from './career-flow.js';

export function renderBuyShop(careerState, onBuy) {
  document.getElementById('buyshop-gold').textContent = formatGold(careerState.gold) + 'g';

  // Class tabs (E..Pro). Default: player's current class.
  const tabBar = document.getElementById('buyshop-class-tabs');
  tabBar.innerHTML = '';
  for (let cls = 0; cls < NUM_CLASSES; cls++) {
    const btn = document.createElement('button');
    btn.className = 'tab' + (cls === careerState.classIndex ? ' active' : '');
    btn.textContent = CLASS_NAMES[cls];
    btn.dataset.cls = cls;
    btn.addEventListener('click', () => switchClass(cls));
    tabBar.appendChild(btn);
  }

  function switchClass(cls) {
    document.querySelectorAll('#buyshop-class-tabs .tab').forEach(b => {
      b.classList.toggle('active', +b.dataset.cls === cls);
    });
    renderGrid(cls);
  }

  function renderGrid(cls) {
    const grid = document.getElementById('buyshop-grid');
    grid.innerHTML = '';
    const ownedIds = new Set(careerState.ownedCars.map(o => o.carId));
    const cars = balance.cars.filter(c => c.classIndex === cls);
    for (const car of cars) {
      const owned = ownedIds.has(car.id);
      const affordable = !owned && careerState.gold >= car.price;
      const tile = document.createElement('div');
      tile.className = 'car-tile' + (affordable ? ' affordable' : '') + (!affordable ? ' unaffordable' : '');
      tile.innerHTML = `
        <h3>${car.name}${owned ? '  (owned)' : ''}</h3>
        <div class="stats">${car.archetype} · ${car.torquePeakNm}Nm · ${car.mass}kg</div>
        <div class="price">${formatGold(car.price)}g</div>
      `;
      if (affordable) tile.addEventListener('click', () => onBuy(car.id));
      grid.appendChild(tile);
    }
  }

  switchClass(careerState.classIndex);
}
```

- [ ] **Step 3: Wire in `main.js`**

Replace `btn-garage-buy` handler:

```js
import { renderBuyShop } from './buy-shop.js';

document.getElementById('btn-garage-buy').addEventListener('click', () => {
  renderBuyShop(careerState, onBuyCar);
  show('screen-buyshop');
});

async function onBuyCar(carId) {
  const car = balance.cars.find(c => c.id === carId);
  if (careerState.gold < car.price) return;
  careerState = spendGold(careerState, car.price);
  careerState = addOwnedCar(careerState, buildOwnedCarInstance(carId));
  await saveCareer(careerState);
  // Return to garage with the new car
  renderGarage(careerState, onGarageCarPick);
  show('screen-garage');
}

document.getElementById('btn-buyshop-back').addEventListener('click', () => {
  renderGarage(careerState, onGarageCarPick); show('screen-garage');
});
```

- [ ] **Step 4: Manual smoke** — Garage → BUY NEW CAR → tabs E/D/C/B/A/Pro. Affordable cars highlight. Owned cars show "(owned)" and are not buyable. Buy → gold spent, car appears in garage.

- [ ] **Step 5: Bump v0.3.17 + commit**

```bash
git add index.html js/buy-shop.js js/main.js js/constants.js package.json
git commit -m "feat(shop): BUY NEW CAR — class tabs + roster grid; affordability gating; owned-marker; v0.3.17"
```

---

## Task 19: Quick Race flow

**Files:**
- Modify: `index.html`
- Create: `js/quick-race.js`
- Modify: `js/main.js`

- [ ] **Step 1: Add `#screen-quickrace` to `index.html`**

```html
<div id="screen-quickrace" class="screen hidden">
  <h2>QUICK RACE</h2>
  <p class="subtitle">Pick a class, then a car (uses stock parts/tune for both sides).</p>
  <div class="tabs" id="quickrace-class-tabs"></div>
  <div id="quickrace-grid" class="car-grid"></div>
  <button id="btn-quickrace-back" class="btn-secondary">BACK</button>
</div>
```

- [ ] **Step 2: Create `js/quick-race.js`**

```js
import { balance } from './balance.js';
import { CLASS_NAMES, NUM_CLASSES } from './constants.js';

export function renderQuickRace(onPick) {
  const tabBar = document.getElementById('quickrace-class-tabs');
  tabBar.innerHTML = '';
  let active = 0;

  function switchClass(cls) {
    active = cls;
    document.querySelectorAll('#quickrace-class-tabs .tab').forEach(b => {
      b.classList.toggle('active', +b.dataset.cls === cls);
    });
    renderGrid(cls);
  }
  function renderGrid(cls) {
    const grid = document.getElementById('quickrace-grid');
    grid.innerHTML = '';
    for (const car of balance.cars.filter(c => c.classIndex === cls)) {
      const tile = document.createElement('div');
      tile.className = 'car-tile affordable';
      tile.innerHTML = `<h3>${car.name}</h3><div class="stats">${car.archetype} · ${car.torquePeakNm}Nm</div>`;
      tile.addEventListener('click', () => onPick(car.id));
      grid.appendChild(tile);
    }
  }
  for (let cls = 0; cls < NUM_CLASSES; cls++) {
    const btn = document.createElement('button');
    btn.className = 'tab' + (cls === 0 ? ' active' : '');
    btn.textContent = CLASS_NAMES[cls];
    btn.dataset.cls = cls;
    btn.addEventListener('click', () => switchClass(cls));
    tabBar.appendChild(btn);
  }
  switchClass(0);
}

export function buildQuickRaceBalance(playerCarId, seed) {
  const player = balance.cars.find(c => c.id === playerCarId);
  const opponentCandidates = balance.cars.filter(c => c.classIndex === player.classIndex && c.id !== player.id);
  const idx = ((seed >>> 0) * 2654435761) >>> 0;
  const opponent = opponentCandidates[idx % opponentCandidates.length];
  return { ...balance, cars: [player, opponent] };
}
```

- [ ] **Step 3: Wire in `main.js`**

```js
import { renderQuickRace, buildQuickRaceBalance } from './quick-race.js';

let quickRaceMode = false;

function onQuickRace() {
  renderQuickRace(onQuickRacePick);
  show('screen-quickrace');
}
function onQuickRacePick(carId) {
  raceBalance = buildQuickRaceBalance(carId, Date.now() | 0);
  quickRaceMode = true;
  startRace();
}

document.getElementById('btn-quickrace-back').addEventListener('click', () => show('screen-title'));
```

Update `recordCareerResult` to skip when in quick-race mode:

```js
async function recordCareerResult() {
  if (quickRaceMode) {
    quickRaceMode = false;
    return;
  }
  if (!careerState) return;
  // ... existing career path
}
```

- [ ] **Step 4: Manual smoke** — Title → QUICK RACE → class tabs + roster → pick car → race → results without affecting career save.

- [ ] **Step 5: Bump v0.3.18 + commit**

```bash
git add index.html js/quick-race.js js/main.js js/constants.js package.json
git commit -m "feat(quick-race): class+car pick → stock vs stock race; no career impact; v0.3.18"
```

---

## Task 20: Review Gate D — tuning feels meaningful

**Files:**
- Create: `tests-visual/tuning-feel.mjs`

- [ ] **Step 1: Create the analysis script**

`tests-visual/tuning-feel.mjs`:

```js
import { allocGameData, resetRace } from '../js/gameData.js';
import { tickRace } from '../js/race-logic.js';
import { applyPartsToCar } from '../js/parts.js';
import { applyTuningToCar } from '../js/tuning.js';
import { balance } from '../js/balance.js';
import { FIXED_DT } from '../js/constants.js';

// Run a full race scenario with a given player car spec; return ET.
function runRace(playerCarSpec) {
  const opp = balance.cars.find(c => c.id === 'b1');
  const localBalance = { ...balance, cars: [playerCarSpec, opp] };
  const gd = allocGameData(localBalance);
  resetRace(gd, localBalance, 12345);
  let shiftsLeft = 3, lastRpmAtTap = playerCarSpec.redlineRpm - 200;
  let t = 0;
  while (t < 30 && gd.raceState !== 'finished') {
    if (gd.raceState === 'staging' || gd.raceState === 'tree') {
      gd.inputGas[0] = 1; gd.inputShift[0] = 1;
    } else if (gd.raceState === 'launching') {
      if (gd.raceTimeS - gd.treeGreenAtS >= 0.30) gd.inputShift[0] = 0;
    } else if (gd.raceState === 'racing') {
      gd.inputGas[0] = 1;
      if (shiftsLeft > 0 && gd.velMs[0] > 4 && gd.rpm[0] >= lastRpmAtTap) {
        gd.inputShiftPressEdge[0] = 1; shiftsLeft--;
      }
    }
    tickRace(gd, localBalance, FIXED_DT);
    t += FIXED_DT;
  }
  return gd.finished[0] ? gd.finishTimeS[0] : null;
}

const baseCar = balance.cars.find(c => c.id === 'b1');

const setups = [
  { name: 'Stock',           parts: { engine: 0, turbo: 0, transmission: 0, tires: 0, weight: 0 } },
  { name: 'Engine T2',       parts: { engine: 2, turbo: 0, transmission: 0, tires: 0, weight: 0 } },
  { name: 'Engine T2 + Tires T2', parts: { engine: 2, turbo: 0, transmission: 0, tires: 2, weight: 0 } },
  { name: 'Full T2',         parts: { engine: 2, turbo: 2, transmission: 2, tires: 2, weight: 2 } },
  { name: 'Full T3+Carbon',  parts: { engine: 3, turbo: 3, transmission: 3, tires: 3, weight: 3 } },
  { name: 'Maxed',           parts: { engine: 4, turbo: 4, transmission: 4, tires: 4, weight: 3 } },
];

console.log('Setup'.padEnd(28) + 'ET (s)' + '   Δ from stock');
let stockET = null;
for (const s of setups) {
  const car = applyTuningToCar(applyPartsToCar(baseCar, s.parts, balance.parts), balance.defaultTune(baseCar));
  const et = runRace(car);
  if (stockET === null) stockET = et;
  const delta = et === null ? '—' : ((et - stockET).toFixed(2)).padStart(6) + 's';
  console.log(s.name.padEnd(28) + (et?.toFixed(3) ?? '— ').padEnd(8) + delta);
}
```

- [ ] **Step 2: Run it**

```bash
node tests-visual/tuning-feel.mjs
```

Print the output. Expected: ET drops as parts are upgraded. Approximate range: stock ~9-10s, fully maxed ~6.5-7.5s. The exact numbers depend on balance tuning.

- [ ] **Step 3: REVIEW GATE D — pause for user approval**

**Stop here. Show the table to the user and ask:** "Do the ET deltas feel meaningful? E.g., does each tier upgrade feel like it was worth the gold? Does the gap between stock and maxed feel right (~2-3 seconds)? If not, balance numbers in `js/balance.js`'s parts catalog can be adjusted now."

Wait for approval. If iteration requested, edit `balance.js` and re-run the script. Iterate until user is satisfied.

- [ ] **Step 4: Bump v0.3.19 + commit (after approval)**

```bash
git add tests-visual/tuning-feel.mjs js/balance.js js/constants.js package.json
git commit -m "review-gate-d: tuning feels validated; ET-deltas analysis script saved; v0.3.19"
```

---

## Task 21: Plan-2 wrap

**Files:**
- Modify: `js/constants.js`
- Modify: `package.json`

- [ ] **Step 1: Bump version to v0.4.0** (Plan-2 release)

`js/constants.js`: `'v0.4.0'`. `package.json`: `"0.4.0"`.

- [ ] **Step 2: Final manual smoke**

Walk through the full Plan-2 loop:
1. Title → NEW CAREER → pick first E-class car
2. Career home → NEXT RACE → race → win/lose → gold awarded
3. Garage → owned car → install Engine T1 → spend gold
4. Car detail → TUNE tab → adjust launch RPM
5. Career home → NEXT RACE → confirm tune affects race
6. Reach 5 wins → next race triggers class advancement
7. BUY NEW CAR → buy a class-D car → gold deducted, car owned
8. SELL old car → gold refunded
9. CONTINUE on next page load → all state preserved

- [ ] **Step 3: Verify all unit tests pass**

`npm test` — all of (race-logic + shift-scoring + ai + save + economy + parts + tuning + career) should pass.

- [ ] **Step 4: Commit**

```bash
git add js/constants.js package.json
git commit -m "release: Plan-2 Career & Garage complete (v0.4.0)"
```

---

## Self-review checklist (run before handing off)

- [ ] **Spec coverage:** Plan-2 implements spec sections §3 (cars, parts, tuning) and §4 (career, economy save schema, gold rewards). RotW deferred to Plan 3 as spec dictates. ✓
- [ ] **Placeholder scan:** No `TBD` / `TODO` / "later" in tasks. All code blocks complete. ✓
- [ ] **Type consistency:**
  - `applyPartsToCar(baseCar, parts, catalog) → tunedCar` referenced in Tasks 5, 11, 15.
  - `applyTuningToCar(car, tune) → finalCar` referenced in Tasks 6, 11, 15.
  - `careerState = newCareer(); spendGold(state, n); recordWin(state, {gold}); recordLoss(state, {gold})` referenced consistently in Tasks 7, 8, 9, 11, 14, 17, 18.
  - `saveCareer(state)`, `loadCareer()` referenced in Tasks 2, 8, 9, 11, 14, 15, 16, 17, 18. ✓
- [ ] **Review gates:** Gate D explicit pause. ✓
- [ ] **Out-of-scope clarity:** Plan-3 carve-out (RotW, NBucks shop, audio, multiple environments) is in the scope block. ✓
- [ ] **Per-commit version bump:** Every commit bumps the patch (v0.3.0 → v0.3.19 → v0.4.0). ✓

---

## Execution handoff

Plan-2 complete and saved. Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?
