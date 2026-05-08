# Drag Race 3D — Plan 1: Race Core (Implementation Plan)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a playable single-race demo: player holds GAS+SHIFT to stage, releases SHIFT at green to launch, taps SHIFT to upshift through 4 gears against one AI opponent on the classic-strip environment, sees ET and RT on a results screen.

**Architecture:** Vanilla JS ES modules, no bundler. three.js r128 from CDN. Strict `balance / gameData / logic` separation per platform `GAME_DEV_NOTES`. Pure-logic modules (no three.js imports) are unit-tested via `node --test`; visual modules are validated with Puppeteer screenshots. Fixed-timestep physics at 1/120s, pre-allocated pools.

**Tech Stack:** three.js r128 (global `THREE` from CDN), PlaySDK (cdn-play.nitzan.games), Node built-in test runner, Puppeteer (system-installed at `/usr/local/lib/node_modules/puppeteer`), bash dev-server.

**Spec reference:** `docs/superpowers/specs/2026-05-07-drag-race-3d-design.md`

**Plan-1 scope (everything else is Plan 2/3):**
- Project skeleton, dev-server, version stamp
- Pure race-physics + state machine + shift scoring (TDD)
- Classic Strip environment only
- 6 car archetype builders (no class roster yet)
- Raised chase camera
- HUD (tach, gas/shift buttons, time, gear, speed) — DOM overlay over canvas
- One AI opponent with deterministic per-seed sampler
- Results card (ET, RT, win/loss, restart)
- Review Gate A (cars) and Review Gate C (in-race HUD) **block** task completion until user approves

**Out of plan-1 scope:** career save, garage, parts shop, tuning, paint, multiple environments, RotW, NBucks shop, audio, screenshot mode, deploy. All in Plans 2/3.

---

## File map (Plan-1)

```
DragRace3D/
├── package.json              # type:module, test script
├── index.html                # canvas + DOM HUD + screen overlays
├── dev-server.sh             # local server on port 8084
├── .zipignore                # exclude dev/test files from deploy
├── css/
│   └── ui.css                # HUD + screens styling
├── js/
│   ├── constants.js          # FIXED_DT, FINISH_LINE_M, GREEN_BAND_RPM, BLOW_THRESHOLD_S, VERSION
│   ├── balance.js            # car definitions, AI profiles, env params
│   ├── gameData.js           # allocGameData(balance) — TypedArrays + pools
│   ├── shift-scoring.js      # PURE: shiftQuality, rtBonus, blowThresholdReached
│   ├── race-logic.js         # PURE: tickRace(gameData, balance, dt) — physics + state machine
│   ├── ai.js                 # PURE: aiSample(carIdx, classIdx, seed) → {rt, shiftTaps}
│   ├── input.js              # canvas/DOM pointer → gameData input flags
│   ├── tach.js               # buildTachSVG(rpm, redline) → string; updateTach(el, rpm, redline)
│   ├── car-models.js         # buildCar(archetype, color1, color2) → THREE.Group (6 archetypes)
│   ├── env-builder.js        # buildClassicEnv(scene) — strip, dirt, grandstands, tree
│   ├── camera3d.js           # raised chase cam follows playerCar
│   ├── renderer3d.js         # buildRaceScene; renderFrame(gameData) — read-only
│   └── main.js               # rAF loop, screen routing, init
└── tests/
    ├── shift-scoring.test.js
    ├── race-logic.test.js
    └── ai.test.js
```

---

## Task 1: Project scaffold

**Files:**
- Create: `package.json`
- Create: `dev-server.sh`
- Create: `.zipignore`
- Create: `index.html`
- Create: `js/constants.js`
- Create: `css/ui.css`

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "drag-race-3d",
  "version": "0.1.0",
  "type": "module",
  "private": true,
  "scripts": {
    "test": "node --test tests/*.test.js",
    "dev": "./dev-server.sh"
  }
}
```

- [ ] **Step 2: Create `dev-server.sh` and make executable**

```bash
#!/bin/bash
cd "$(dirname "$0")"
PORT=${PORT:-8084}
echo "Drag Race 3D dev server: http://localhost:$PORT"
python3 -m http.server "$PORT"
```

Run: `chmod +x dev-server.sh`

- [ ] **Step 3: Create `.zipignore`**

```
.git/*
.superpowers/*
docs/*
tests/*
node_modules/*
.DS_Store
dev-server.sh
package.json
.zipignore
*.log
ss-*.png
screenshot-*.png
thumbnail.html
render-thumbnail.js
```

- [ ] **Step 4: Create `js/constants.js`**

```js
export const VERSION = 'v0.1.0';

export const FIXED_DT = 1 / 120;
export const MAX_DT = 1 / 30;

export const FINISH_LINE_M = 402.336;          // 1/4 mile in meters
export const GREEN_BAND_RPM = 800;              // top of tach colored green for shift target
export const BLOW_THRESHOLD_S = 1.0;            // RPM at limiter for this long → engine blown
export const LAUNCH_RPM_OPTIMAL_LOW = 0.50;     // fraction of car redline for ideal launch
export const LAUNCH_RPM_OPTIMAL_HIGH = 0.65;    // fraction of car redline for ideal launch (upper bound)
export const TREE_AMBER_INTERVAL_S = 0.4;       // delay between christmas-tree amber bulbs
export const TREE_AMBER_COUNT = 3;

export const NUM_CARS = 2;                      // player + opponent (Plan-1)
export const PLAYER_CAR_IDX = 0;
export const OPPONENT_CAR_IDX = 1;

export const LANE_OFFSET_X = 2.5;               // meters from strip centerline to lane center
export const STRIP_LENGTH_M = 700;              // visual extent
```

- [ ] **Step 5: Create `index.html` (initial shell)**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>Drag Race 3D</title>
  <link rel="stylesheet" href="css/ui.css">
  <script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
  <script src="https://cdn-play.nitzan.games/lib/play-sdk.js"></script>
</head>
<body>
  <canvas id="game-canvas" width="1080" height="1920"></canvas>
  <div id="ui">
    <div id="screen-title" class="screen">
      <h1 class="game-title">DRAG RACE 3D</h1>
      <button id="btn-start" class="btn-primary">START RACE</button>
      <div class="version" id="version-text"></div>
    </div>
  </div>
  <script type="module" src="js/main.js"></script>
</body>
</html>
```

- [ ] **Step 6: Create `css/ui.css` (minimal title + version)**

```css
* { box-sizing: border-box; margin: 0; padding: 0; }
html, body {
  width: 100%; height: 100%; overflow: hidden;
  display: flex; align-items: center; justify-content: center;
  background: #0a0e14; color: #fff;
  font-family: system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
}
canvas#game-canvas {
  display: block;
  max-width: 100%; max-height: 100%;
  object-fit: contain;
  touch-action: none;
  -webkit-touch-callout: none;
  -webkit-user-select: none;
  -webkit-tap-highlight-color: transparent;
}
#ui {
  position: absolute; inset: 0;
  pointer-events: none;
}
#ui .screen {
  position: absolute; inset: 0;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  pointer-events: auto;
  background: rgba(8, 12, 20, 0.85);
}
#ui .screen.hidden { display: none; }
.game-title { font-size: 84px; font-weight: 800; letter-spacing: 0.04em; margin-bottom: 48px; }
.btn-primary {
  font-size: 44px; font-weight: 700; padding: 18px 56px;
  background: #d65a3a; border: 3px solid #ff8a5a; color: #fff; border-radius: 14px;
  cursor: pointer; touch-action: manipulation;
}
.btn-primary:active { background: #b04020; }
.version { position: absolute; bottom: 24px; font-size: 14px; opacity: 0.5; }
```

- [ ] **Step 7: Create `js/main.js` (renders version on title screen)**

```js
import { VERSION } from './constants.js';

function init() {
  const versionEl = document.getElementById('version-text');
  if (versionEl) versionEl.textContent = VERSION;
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
```

- [ ] **Step 8: Verify the dev server runs and renders the title**

Run: `./dev-server.sh` (in one terminal) then open `http://localhost:8084` in a browser.
Expected: dark page with "DRAG RACE 3D" headline, "START RACE" button, and `v0.1.0` at the bottom.

- [ ] **Step 9: Commit**

```bash
git add package.json dev-server.sh .zipignore index.html js/constants.js js/main.js css/ui.css
git commit -m "scaffold: project skeleton, title screen, version stamp v0.1.0"
```

---

## Task 2: balance.js + gameData.js skeleton

**Files:**
- Create: `js/balance.js`
- Create: `js/gameData.js`
- Test: `tests/race-logic.test.js` (only the alloc check for now)

- [ ] **Step 1: Create `js/balance.js`**

```js
// Plan-1 balance: 2 sample cars (one per side) on the classic strip.
// Real per-class roster comes in Plan 2.

export const balance = {
  cars: [
    {
      id: 'plan1-player',
      archetype: 'muscle',          // matches car-models.js builders
      color1: 0x2a8fd4, color2: 0x122a38,
      mass: 1450,                   // kg
      grip: 1.2,                    // tire grip coefficient (Plan-1 default)
      dragCoef: 0.42,
      rollingResistance: 0.012,
      redlineRpm: 6800,
      idleRpm: 900,
      launchRpmMax: 5500,
      engineResponse: 8.0,          // 1/s — how fast rpm tracks target_rpm
      gearRatios: [3.4, 2.1, 1.5, 1.0],
      finalDrive: 3.55,
      wheelRadius: 0.34,
      torquePeakNm: 600,            // peak engine torque
      torquePeakRpm: 5000,
      torqueWidth: 1800,            // RPM half-width of torque bell curve
    },
    {
      id: 'plan1-opponent',
      archetype: 'sport',
      color1: 0xc83a26, color2: 0x32100d,
      mass: 1380,
      grip: 1.15,
      dragCoef: 0.40,
      rollingResistance: 0.012,
      redlineRpm: 7200,
      idleRpm: 950,
      launchRpmMax: 5800,
      engineResponse: 8.5,
      gearRatios: [3.2, 2.0, 1.45, 0.95],
      finalDrive: 3.7,
      wheelRadius: 0.33,
      torquePeakNm: 540,
      torquePeakRpm: 5400,
      torqueWidth: 1700,
    },
  ],
  ai: {
    rtMean: 0.32,
    rtStd: 0.08,
    shiftBandSlackRpm: 250,         // AI may shift this many RPM short of redline
    shiftBandSlackStd: 120,
  },
  env: { id: 'classic' },
};
```

- [ ] **Step 2: Create `js/gameData.js`**

```js
import { NUM_CARS, PLAYER_CAR_IDX, LANE_OFFSET_X } from './constants.js';

/**
 * Allocate the single mutable gameData object. Pre-allocates all per-car
 * TypedArrays and the input-flag/staging-state fields. Never re-allocates
 * during gameplay.
 */
export function allocGameData(balance) {
  const N = NUM_CARS;
  return {
    // ---- per-car state (parallel arrays, indexed 0..N-1) ----
    posX:   new Float32Array(N),    // lane offset along X
    posZ:   new Float32Array(N),    // distance along strip (z is the racing axis; +Z = backward, -Z = forward)
    velMs:  new Float32Array(N),    // forward speed in m/s
    rpm:    new Float32Array(N),    // current engine RPM
    gear:   new Uint8Array(N),      // 1..4
    finished: new Uint8Array(N),    // 1 if crossed finish line
    blown:    new Uint8Array(N),    // 1 if engine blown
    jumped:   new Uint8Array(N),    // 1 if jump-start latched
    finishTimeS: new Float32Array(N),
    rtS:        new Float32Array(N), // reaction time per car
    timeAtLimiterS: new Float32Array(N), // cumulative time at redline (for blow detection)

    // ---- per-car inputs (set by input.js or ai.js) ----
    inputGas:    new Uint8Array(N),
    inputShift:  new Uint8Array(N),
    // Each frame, input.js may set inputShiftTapped[i] = 1 once when the
    // SHIFT button transitions held->released-then-held? No — see input.js:
    // we use a "consumed" pattern. inputShiftReleasedAt[i] is the time of the
    // most recent release (or -1 if never). race-logic consumes it.
    inputShiftReleasedAt: new Float32Array(N),
    // tap edge — input.js sets to 1 once on each press; race-logic clears.
    inputShiftPressEdge:  new Uint8Array(N),

    // ---- race-wide state ----
    raceState: 'intro',  // 'intro' | 'staging' | 'tree' | 'launching' | 'racing' | 'coast' | 'finished'
    raceTimeS: 0,
    introTimeS: 0,
    treeStartTimeS: 0,
    treeAmbersLit: 0,    // 0..3
    treeGreenAtS: 0,     // when green light came on
    racingStartS: 0,     // when the player launched
    winnerCarIdx: -1,

    // ---- per-frame scratch (filled by render, NOT mutated by logic) ----
    slip: new Uint8Array(N),  // 1 if wheelspin frame (for VFX)

    // ---- meta ----
    seed: 0,                    // RNG seed for AI determinism
    startingLanes: new Float32Array(N), // pre-computed X positions
  };
}

/** Initialize starting positions for a new race. Call after allocGameData. */
export function resetRace(gameData, balance, seed) {
  const N = gameData.posX.length;
  for (let i = 0; i < N; i++) {
    gameData.startingLanes[i] = (i === PLAYER_CAR_IDX) ? +LANE_OFFSET_X : -LANE_OFFSET_X;
    gameData.posX[i] = gameData.startingLanes[i];
    gameData.posZ[i] = 0;
    gameData.velMs[i] = 0;
    gameData.rpm[i] = balance.cars[i].idleRpm;
    gameData.gear[i] = 1;
    gameData.finished[i] = 0;
    gameData.blown[i] = 0;
    gameData.jumped[i] = 0;
    gameData.finishTimeS[i] = 0;
    gameData.rtS[i] = 0;
    gameData.timeAtLimiterS[i] = 0;
    gameData.inputGas[i] = 0;
    gameData.inputShift[i] = 0;
    gameData.inputShiftReleasedAt[i] = -1;
    gameData.inputShiftPressEdge[i] = 0;
    gameData.slip[i] = 0;
  }
  gameData.raceState = 'intro';
  gameData.raceTimeS = 0;
  gameData.introTimeS = 0;
  gameData.treeStartTimeS = 0;
  gameData.treeAmbersLit = 0;
  gameData.treeGreenAtS = 0;
  gameData.racingStartS = 0;
  gameData.winnerCarIdx = -1;
  gameData.seed = seed;
}
```

- [ ] **Step 3: Create `tests/race-logic.test.js` with alloc test**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { allocGameData, resetRace } from '../js/gameData.js';
import { balance } from '../js/balance.js';
import { NUM_CARS } from '../js/constants.js';

test('allocGameData allocates parallel arrays of the right size', () => {
  const gd = allocGameData(balance);
  assert.equal(gd.posX.length, NUM_CARS);
  assert.equal(gd.velMs.length, NUM_CARS);
  assert.equal(gd.rpm.length, NUM_CARS);
  assert.equal(gd.gear.length, NUM_CARS);
});

test('resetRace puts cars in lanes and at idle RPM', () => {
  const gd = allocGameData(balance);
  resetRace(gd, balance, 42);
  assert.equal(gd.posX[0], 2.5);   // player +lane
  assert.equal(gd.posX[1], -2.5);  // opponent -lane
  assert.equal(gd.posZ[0], 0);
  assert.equal(gd.gear[0], 1);
  assert.equal(gd.rpm[0], balance.cars[0].idleRpm);
  assert.equal(gd.raceState, 'intro');
  assert.equal(gd.seed, 42);
});
```

- [ ] **Step 4: Run tests — expect both to pass**

Run: `npm test`
Expected:
```
✔ allocGameData allocates parallel arrays of the right size
✔ resetRace puts cars in lanes and at idle RPM
```

- [ ] **Step 5: Commit**

```bash
git add js/balance.js js/gameData.js tests/race-logic.test.js
git commit -m "data: balance + gameData allocation with reset"
```

---

## Task 3: shift-scoring.js (pure functions, full TDD)

**Files:**
- Create: `js/shift-scoring.js`
- Test: `tests/shift-scoring.test.js`

- [ ] **Step 1: Write failing test for `shiftQuality`**

`tests/shift-scoring.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { shiftQuality, rtBonus, blowThresholdReached } from '../js/shift-scoring.js';

const REDLINE = 7000;
const BAND = 800;

test('shiftQuality: tap inside green window returns "green"', () => {
  assert.equal(shiftQuality(6500, REDLINE, BAND), 'green');
  assert.equal(shiftQuality(REDLINE - 1, REDLINE, BAND), 'green');
});

test('shiftQuality: tap below green returns "early"', () => {
  assert.equal(shiftQuality(5000, REDLINE, BAND), 'early');
  assert.equal(shiftQuality(REDLINE - BAND - 1, REDLINE, BAND), 'early');
});

test('shiftQuality: tap above redline returns "past"', () => {
  assert.equal(shiftQuality(REDLINE + 100, REDLINE, BAND), 'past');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: `Error: Cannot find module '../js/shift-scoring.js'`

- [ ] **Step 3: Write minimal implementation**

`js/shift-scoring.js`:

```js
/**
 * Classify a shift tap by RPM at the moment of tap.
 * @param {number} rpm  current engine RPM
 * @param {number} redline  car's redline RPM
 * @param {number} band  width (RPM) of the green window before redline
 * @returns {'early' | 'green' | 'past'}
 */
export function shiftQuality(rpm, redline, band) {
  if (rpm > redline) return 'past';
  if (rpm >= redline - band) return 'green';
  return 'early';
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: 3 ✔ for shiftQuality.

- [ ] **Step 5: Add failing tests for `rtBonus`**

Append to `tests/shift-scoring.test.js`:

```js
test('rtBonus: perfect RT gives -0.020s ET advantage', () => {
  assert.equal(rtBonus(0.050), -0.020);
  assert.equal(rtBonus(0.099), -0.020);
});

test('rtBonus: out-of-perfect-window gives 0', () => {
  assert.equal(rtBonus(0.100), 0);
  assert.equal(rtBonus(0.500), 0);
  assert.equal(rtBonus(1.234), 0);
});

test('rtBonus: pre-green RT (negative) returns 0', () => {
  assert.equal(rtBonus(-0.05), 0);
});
```

- [ ] **Step 6: Run tests — expect rtBonus tests to fail**

Run: `npm test`
Expected: `rtBonus is not a function`

- [ ] **Step 7: Implement `rtBonus`**

Append to `js/shift-scoring.js`:

```js
/**
 * Compute the ET (elapsed time) bonus from reaction time.
 * @param {number} rtS  reaction time in seconds (negative = jump-start)
 * @returns {number}  seconds to add to ET (negative = bonus)
 */
export function rtBonus(rtS) {
  if (rtS < 0) return 0;
  if (rtS < 0.100) return -0.020;
  return 0;
}
```

- [ ] **Step 8: Run tests — expect all pass**

Run: `npm test`
Expected: all shift-scoring tests pass.

- [ ] **Step 9: Add failing tests for `blowThresholdReached`**

Append to `tests/shift-scoring.test.js`:

```js
test('blowThresholdReached: under 1.0s at limiter is fine', () => {
  assert.equal(blowThresholdReached(0.5, 1.0), false);
  assert.equal(blowThresholdReached(0.999, 1.0), false);
});

test('blowThresholdReached: 1.0s+ at limiter blows engine', () => {
  assert.equal(blowThresholdReached(1.0, 1.0), true);
  assert.equal(blowThresholdReached(1.5, 1.0), true);
});
```

- [ ] **Step 10: Implement `blowThresholdReached`**

Append to `js/shift-scoring.js`:

```js
/**
 * @param {number} timeAtLimiterS  cumulative time the car has spent at redline
 * @param {number} thresholdS  configured threshold from constants
 * @returns {boolean}
 */
export function blowThresholdReached(timeAtLimiterS, thresholdS) {
  return timeAtLimiterS >= thresholdS;
}
```

- [ ] **Step 11: Run all tests, expect all pass**

Run: `npm test`
Expected: 8 passing across `shift-scoring.test.js` (3 + 3 + 2).

- [ ] **Step 12: Commit**

```bash
git add js/shift-scoring.js tests/shift-scoring.test.js
git commit -m "feat: shift-scoring pure functions (shiftQuality, rtBonus, blowThresholdReached) with TDD"
```

---

## Task 4: race-logic.js — state machine skeleton (TDD)

**Files:**
- Create: `js/race-logic.js`
- Modify: `tests/race-logic.test.js`

- [ ] **Step 1: Write failing test for state-machine staging→tree transition**

Append to `tests/race-logic.test.js`:

```js
import { tickRace } from '../js/race-logic.js';
import { FIXED_DT } from '../js/constants.js';

test('race state: intro elapses then enters staging', () => {
  const gd = allocGameData(balance);
  resetRace(gd, balance, 1);
  // Run 2 seconds of intro (intro lasts 2s by spec)
  for (let t = 0; t < 2.0; t += FIXED_DT) tickRace(gd, balance, FIXED_DT);
  assert.equal(gd.raceState, 'staging');
});

test('race state: staging → tree begins when player presses both buttons', () => {
  const gd = allocGameData(balance);
  resetRace(gd, balance, 1);
  // skip past intro
  for (let t = 0; t < 2.0; t += FIXED_DT) tickRace(gd, balance, FIXED_DT);
  // player holds both
  gd.inputGas[0] = 1; gd.inputShift[0] = 1;
  // also opponent holds (AI driver — we'll add that later; for now just set flags)
  gd.inputGas[1] = 1; gd.inputShift[1] = 1;
  // run 0.6s
  for (let t = 0; t < 0.6; t += FIXED_DT) tickRace(gd, balance, FIXED_DT);
  assert.equal(gd.raceState, 'tree');
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: `Cannot find module '../js/race-logic.js'`

- [ ] **Step 3: Create minimal `js/race-logic.js` for intro→staging→tree**

```js
import {
  FIXED_DT, BLOW_THRESHOLD_S, GREEN_BAND_RPM,
  TREE_AMBER_INTERVAL_S, TREE_AMBER_COUNT,
  FINISH_LINE_M, NUM_CARS, PLAYER_CAR_IDX,
} from './constants.js';
import { shiftQuality, blowThresholdReached } from './shift-scoring.js';

const INTRO_DURATION_S = 2.0;
const STAGING_HOLD_DURATION_S = 0.5; // player must hold both for 0.5s before tree

/**
 * Single fixed-timestep tick. Mutates gameData in place.
 * Pure: only reads {gameData, balance, dt}.
 */
export function tickRace(gameData, balance, dt) {
  gameData.raceTimeS += dt;
  switch (gameData.raceState) {
    case 'intro':       return tickIntro(gameData, balance, dt);
    case 'staging':     return tickStaging(gameData, balance, dt);
    case 'tree':        return tickTree(gameData, balance, dt);
    case 'launching':   return tickLaunching(gameData, balance, dt);
    case 'racing':      return tickRacing(gameData, balance, dt);
    case 'coast':       return tickCoast(gameData, balance, dt);
    case 'finished':    return; // terminal
  }
}

function tickIntro(gd, balance, dt) {
  gd.introTimeS += dt;
  if (gd.introTimeS >= INTRO_DURATION_S) {
    gd.raceState = 'staging';
  }
}

function tickStaging(gd, balance, dt) {
  // Both player and opponent must hold both buttons for STAGING_HOLD_DURATION_S
  // before the tree begins. While staging, RPM rises with held gas.
  for (let i = 0; i < NUM_CARS; i++) revToward(gd, balance, i, dt);
  const allReady = (gd.inputGas[0] && gd.inputShift[0]
                    && gd.inputGas[1] && gd.inputShift[1]);
  if (!allReady) {
    gd.treeStartTimeS = gd.raceTimeS;  // reset stage timer if anyone lifts
    return;
  }
  if (gd.raceTimeS - gd.treeStartTimeS >= STAGING_HOLD_DURATION_S) {
    gd.raceState = 'tree';
    gd.treeStartTimeS = gd.raceTimeS;
    gd.treeAmbersLit = 0;
  }
}

function revToward(gd, balance, i, dt) {
  const car = balance.cars[i];
  if (gd.inputGas[i]) {
    gd.rpm[i] = clamp(gd.rpm[i] + 5000 * dt, car.idleRpm, car.launchRpmMax);
  } else {
    gd.rpm[i] = clamp(gd.rpm[i] - 4000 * dt, car.idleRpm, car.launchRpmMax);
  }
}

function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

function tickTree(gd, balance, dt) {
  // Light an amber every TREE_AMBER_INTERVAL_S, then green at TREE_AMBER_COUNT * interval.
  for (let i = 0; i < NUM_CARS; i++) revToward(gd, balance, i, dt);
  const t = gd.raceTimeS - gd.treeStartTimeS;
  const ambers = Math.min(TREE_AMBER_COUNT, Math.floor(t / TREE_AMBER_INTERVAL_S));
  gd.treeAmbersLit = ambers;
  // jump-start detection: any car releases SHIFT before green
  if (gd.treeGreenAtS === 0) {
    for (let i = 0; i < NUM_CARS; i++) {
      if (gd.jumped[i]) continue;
      if (!gd.inputShift[i]) {
        // SHIFT released before green — latch jump
        gd.jumped[i] = 1;
        if (i === PLAYER_CAR_IDX) {
          // Per spec: false start ends race as a loss
          gd.raceState = 'finished';
          gd.winnerCarIdx = 1 - PLAYER_CAR_IDX;
          return;
        }
      }
    }
  }
  if (ambers >= TREE_AMBER_COUNT && gd.treeGreenAtS === 0) {
    gd.treeGreenAtS = gd.raceTimeS;
    gd.raceState = 'launching';
  }
}

function tickLaunching(gd, balance, dt) {
  // Player & opponent each compute RT once when SHIFT goes from held->released
  for (let i = 0; i < NUM_CARS; i++) {
    if (gd.rtS[i] === 0 && !gd.inputShift[i]) {
      gd.rtS[i] = Math.max(0, gd.raceTimeS - gd.treeGreenAtS);
    }
  }
  // Once player has launched (released SHIFT) move to racing.
  // Wait up to 1.5s for opponent to launch, then force them.
  for (let i = 0; i < NUM_CARS; i++) revToward(gd, balance, i, dt);
  if (gd.rtS[PLAYER_CAR_IDX] > 0) {
    gd.raceState = 'racing';
    gd.racingStartS = gd.raceTimeS;
  }
}

function tickRacing(gd, balance, dt) {
  // Stub for now — Task 5 fills in physics + shifts + finish detection.
  // Just hold position so tests can wire up incrementally.
}

function tickCoast(gd, balance, dt) {
  // Stub — same as racing for now until physics added.
}
```

- [ ] **Step 4: Run tests — expect both staging tests to pass**

Run: `npm test`
Expected: intro→staging and staging→tree tests pass.

- [ ] **Step 5: Commit**

```bash
git add js/race-logic.js tests/race-logic.test.js
git commit -m "feat: race state machine — intro/staging/tree transitions with jump-start latch"
```

---

## Task 5: race-logic.js — physics step (TDD)

**Files:**
- Modify: `js/race-logic.js`
- Modify: `tests/race-logic.test.js`

- [ ] **Step 1: Write failing test for forward-motion physics**

Append to `tests/race-logic.test.js`:

```js
test('physics: car at full gas accelerates forward', () => {
  const gd = allocGameData(balance);
  resetRace(gd, balance, 1);
  // jump straight to racing
  gd.raceState = 'racing';
  gd.gear[0] = 1; gd.gear[1] = 1;
  gd.rpm[0] = 5000; gd.rpm[1] = 5000;
  gd.inputGas[0] = 1; gd.inputGas[1] = 0;
  // run 1 second
  for (let t = 0; t < 1.0; t += FIXED_DT) tickRace(gd, balance, FIXED_DT);
  assert.ok(gd.posZ[0] < 0, 'player should have moved forward (-Z)'); // -Z = forward
  assert.ok(gd.velMs[0] > 0, 'player should have positive forward velocity');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: posZ[0] is still 0 (the racing tick is a stub).

- [ ] **Step 3: Implement physics in `tickRacing`**

Replace the `tickRacing` body and add helpers:

```js
function tickRacing(gd, balance, dt) {
  for (let i = 0; i < NUM_CARS; i++) {
    if (gd.finished[i] || gd.blown[i]) continue;
    stepCar(gd, balance, i, dt);
  }
  // Finish detection
  for (let i = 0; i < NUM_CARS; i++) {
    if (!gd.finished[i] && -gd.posZ[i] >= FINISH_LINE_M) {
      gd.finished[i] = 1;
      gd.finishTimeS[i] = gd.raceTimeS - gd.racingStartS;
    }
  }
  // Race ends when both cars finished or both stopped
  let allDone = true;
  for (let i = 0; i < NUM_CARS; i++) {
    if (!gd.finished[i] && !gd.blown[i]) { allDone = false; break; }
  }
  if (allDone) {
    gd.raceState = 'finished';
    gd.winnerCarIdx = pickWinner(gd);
  }
}

function pickWinner(gd) {
  // Lower finishTimeS wins; blown/unfinished = +Infinity
  let bestI = 0, bestT = Infinity;
  for (let i = 0; i < NUM_CARS; i++) {
    const t = gd.finished[i] ? gd.finishTimeS[i] : Infinity;
    if (t < bestT) { bestT = t; bestI = i; }
  }
  return bestT === Infinity ? -1 : bestI;
}

function stepCar(gd, balance, i, dt) {
  const car = balance.cars[i];
  // wheel angular speed (rad/s) → rps (rev/s)
  const wheelRps = gd.velMs[i] / (2 * Math.PI * car.wheelRadius);
  const targetRpm = wheelRps * 60 * car.gearRatios[gd.gear[i] - 1] * car.finalDrive;
  // engine inertia: rpm chases targetRpm but is also pumped up by gas
  const gasRpmPump = gd.inputGas[i] ? 12000 * dt : -8000 * dt;
  // blend toward target plus gas pump
  gd.rpm[i] += (targetRpm - gd.rpm[i]) * Math.min(1, car.engineResponse * dt) + gasRpmPump;
  // clamp to [idle, redline*1.02] (limiter; over-redline tracked separately)
  if (gd.rpm[i] < car.idleRpm) gd.rpm[i] = car.idleRpm;
  const limiterRpm = car.redlineRpm * 1.02;
  if (gd.rpm[i] > limiterRpm) gd.rpm[i] = limiterRpm;
  // Track time at limiter for blow detection
  if (gd.rpm[i] >= car.redlineRpm) gd.timeAtLimiterS[i] += dt;
  else gd.timeAtLimiterS[i] = 0;
  if (blowThresholdReached(gd.timeAtLimiterS[i], BLOW_THRESHOLD_S)) {
    gd.blown[i] = 1;
    return;
  }
  // tractive force = torque * gear * final / wheelRadius
  const torque = torqueAt(car, gd.rpm[i]);
  let force = torque * car.gearRatios[gd.gear[i] - 1] * car.finalDrive / car.wheelRadius;
  // grip cap (simple: F_max = grip * mass * g)
  const fMax = car.grip * car.mass * 9.81;
  if (force > fMax) {
    gd.slip[i] = 1;
    force = fMax;
  } else {
    gd.slip[i] = 0;
  }
  // drag + rolling resistance
  force -= car.dragCoef * gd.velMs[i] * gd.velMs[i];
  force -= car.rollingResistance * car.mass * 9.81;
  // integrate
  gd.velMs[i] += (force / car.mass) * dt;
  if (gd.velMs[i] < 0) gd.velMs[i] = 0;
  gd.posZ[i] -= gd.velMs[i] * dt;  // -Z is forward
}

function torqueAt(car, rpm) {
  // Bell curve centered on torquePeakRpm with half-width torqueWidth
  const dx = (rpm - car.torquePeakRpm) / car.torqueWidth;
  return car.torquePeakNm * Math.exp(-dx * dx);
}
```

- [ ] **Step 4: Run tests — expect physics test to pass**

Run: `npm test`
Expected: ✔ physics: car at full gas accelerates forward

- [ ] **Step 5: Add deterministic-finish test**

Append to `tests/race-logic.test.js`:

```js
test('physics: car finishes 1/4 mile in expected time window', () => {
  const gd = allocGameData(balance);
  resetRace(gd, balance, 1);
  gd.raceState = 'racing';
  gd.gear[0] = 1; gd.gear[1] = 1;
  gd.rpm[0] = 5000; gd.rpm[1] = 5000;
  gd.inputGas[0] = 1; gd.inputGas[1] = 0;
  // simulate up to 30s (way over even a slow car)
  let t = 0;
  while (t < 30 && !gd.finished[0]) {
    tickRace(gd, balance, FIXED_DT);
    t += FIXED_DT;
  }
  assert.ok(gd.finished[0], 'car should have finished');
  // muscle car in only gear 1 with no shifts will be slow but should finish in < 30s
  assert.ok(gd.finishTimeS[0] < 30, `finishTime too high: ${gd.finishTimeS[0]}`);
});
```

- [ ] **Step 6: Run tests — expect pass**

Run: `npm test`
Expected: ✔ physics: car finishes 1/4 mile in expected time window

- [ ] **Step 7: Commit**

```bash
git add js/race-logic.js tests/race-logic.test.js
git commit -m "feat: race-logic physics step (engine, traction, drag, finish detection)"
```

---

## Task 6: race-logic.js — gear shift handling (TDD)

**Files:**
- Modify: `js/race-logic.js`
- Modify: `tests/race-logic.test.js`

- [ ] **Step 1: Write failing test for upshift**

Append to `tests/race-logic.test.js`:

```js
test('shift: tap shift in racing upshifts and drops RPM', () => {
  const gd = allocGameData(balance);
  resetRace(gd, balance, 1);
  gd.raceState = 'racing';
  gd.gear[0] = 1;
  gd.rpm[0] = 6500;  // near redline
  gd.inputGas[0] = 1;
  gd.inputShiftPressEdge[0] = 1; // simulate tap
  tickRace(gd, balance, FIXED_DT);
  assert.equal(gd.gear[0], 2, 'should be in gear 2');
  // RPM after upshift should drop to gear ratio ratio (2.1/3.4 of 6500)
  const expected = 6500 * (balance.cars[0].gearRatios[1] / balance.cars[0].gearRatios[0]);
  assert.ok(Math.abs(gd.rpm[0] - expected) < 200,
    `RPM after upshift expected ~${expected.toFixed(0)} got ${gd.rpm[0].toFixed(0)}`);
});

test('shift: tap shift in gear 4 does nothing', () => {
  const gd = allocGameData(balance);
  resetRace(gd, balance, 1);
  gd.raceState = 'racing';
  gd.gear[0] = 4;
  gd.rpm[0] = 6500;
  gd.inputShiftPressEdge[0] = 1;
  tickRace(gd, balance, FIXED_DT);
  assert.equal(gd.gear[0], 4);
});
```

- [ ] **Step 2: Run tests — expect them to fail**

Run: `npm test`
Expected: gear[0] still 1 (no shift handling yet).

- [ ] **Step 3: Add shift handling to `tickRacing`**

In `tickRacing`, before the per-car physics loop, add:

```js
function tickRacing(gd, balance, dt) {
  // Process shift taps (consume the edge flag)
  for (let i = 0; i < NUM_CARS; i++) {
    if (gd.inputShiftPressEdge[i]) {
      gd.inputShiftPressEdge[i] = 0;
      handleShiftTap(gd, balance, i);
    }
  }
  for (let i = 0; i < NUM_CARS; i++) {
    if (gd.finished[i] || gd.blown[i]) continue;
    stepCar(gd, balance, i, dt);
  }
  // ... (finish detection unchanged)
```

Add `handleShiftTap` function:

```js
function handleShiftTap(gd, balance, i) {
  const car = balance.cars[i];
  if (gd.gear[i] >= 4) return;          // already top gear
  const oldGear = gd.gear[i];
  const newGear = oldGear + 1;
  // RPM transitions: target = current * (ratio_new / ratio_old)
  const ratioOld = car.gearRatios[oldGear - 1];
  const ratioNew = car.gearRatios[newGear - 1];
  gd.rpm[i] = gd.rpm[i] * (ratioNew / ratioOld);
  // Clamp at idle floor
  if (gd.rpm[i] < car.idleRpm) gd.rpm[i] = car.idleRpm;
  gd.gear[i] = newGear;
  // Reset limiter timer when shifting away from limiter
  gd.timeAtLimiterS[i] = 0;
  // Note: shift quality scoring (early/green/past) is computed in shift-scoring.js
  // and used by results screen + ET adjustments. We don't apply ET deltas here —
  // we let the natural physics dictate the cost, and only rtBonus modifies ET.
}
```

- [ ] **Step 4: Run tests — expect both pass**

Run: `npm test`
Expected: shift tests pass.

- [ ] **Step 5: Commit**

```bash
git add js/race-logic.js tests/race-logic.test.js
git commit -m "feat: gear-shift logic with RPM transition; gear-4 cap"
```

---

## Task 7: ai.js — deterministic AI sampler (TDD)

**Files:**
- Create: `js/ai.js`
- Test: `tests/ai.test.js`

- [ ] **Step 1: Write failing test for determinism**

`tests/ai.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { aiSample } from '../js/ai.js';
import { balance } from '../js/balance.js';

test('aiSample: same seed produces same outputs', () => {
  const a = aiSample(1 /*carIdx*/, 0 /*classIdx*/, 12345 /*seed*/, balance);
  const b = aiSample(1, 0, 12345, balance);
  assert.equal(a.rt, b.rt);
  assert.deepEqual(a.shiftAtRpm, b.shiftAtRpm);
});

test('aiSample: different seeds produce different outputs', () => {
  const a = aiSample(1, 0, 1, balance);
  const b = aiSample(1, 0, 2, balance);
  assert.notEqual(a.rt, b.rt);
});

test('aiSample: rt is non-negative and within plausible range', () => {
  for (let s = 1; s < 50; s++) {
    const a = aiSample(1, 0, s, balance);
    assert.ok(a.rt >= 0 && a.rt < 1.5, `rt out of range for seed ${s}: ${a.rt}`);
  }
});

test('aiSample: produces 3 shift target RPMs (shifts 1->2, 2->3, 3->4)', () => {
  const a = aiSample(1, 0, 7, balance);
  assert.equal(a.shiftAtRpm.length, 3);
  for (const rpm of a.shiftAtRpm) {
    assert.ok(rpm > 0 && rpm < 10000);
  }
});
```

- [ ] **Step 2: Run tests — expect fail (no module)**

Run: `npm test`
Expected: `Cannot find module '../js/ai.js'`

- [ ] **Step 3: Implement `js/ai.js`**

```js
// Tiny deterministic PRNG (mulberry32). Seed-driven so a given seed always
// yields identical AI behavior — important for ghost replay and testing.
function mulberry32(seed) {
  let s = seed >>> 0;
  return function () {
    s |= 0; s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Box-Muller — turn two uniform randoms into one normally-distributed sample
function gaussian(rng) {
  const u = Math.max(1e-12, rng());
  const v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/**
 * Sample a deterministic AI driver profile for a single race.
 * @param {number} carIdx       index of the AI car in balance.cars
 * @param {number} classIdx     class index (0=E, 5=Pro) — Plan 1 ignores; just for seed mixing
 * @param {number} seed         32-bit unsigned seed
 * @param {object} balance      from balance.js
 * @returns {{ rt: number, shiftAtRpm: number[] }}
 */
export function aiSample(carIdx, classIdx, seed, balance) {
  const rng = mulberry32(seed ^ ((carIdx + 1) * 0x9E3779B9) ^ ((classIdx + 1) * 0xBF58476D));
  const ai = balance.ai;
  const car = balance.cars[carIdx];

  const rt = Math.max(0, ai.rtMean + gaussian(rng) * ai.rtStd);

  const shiftAtRpm = [];
  for (let s = 0; s < 3; s++) {
    const slack = Math.max(0, ai.shiftBandSlackRpm + gaussian(rng) * ai.shiftBandSlackStd);
    shiftAtRpm.push(car.redlineRpm - slack);
  }
  return { rt, shiftAtRpm };
}
```

- [ ] **Step 4: Run tests — expect all 4 pass**

Run: `npm test`
Expected: 4 ✔ in ai.test.js.

- [ ] **Step 5: Commit**

```bash
git add js/ai.js tests/ai.test.js
git commit -m "feat: deterministic AI sampler with seeded PRNG"
```

---

## Task 8: AI driver — wire AI samples into gameData per frame

**Files:**
- Modify: `js/race-logic.js`
- Modify: `tests/race-logic.test.js`

- [ ] **Step 1: Add AI execution to race-logic**

Add to top of `race-logic.js`:

```js
import { aiSample } from './ai.js';
```

Add a per-race AI plan stored on gameData. We'll store it on the gameData scratch field:

```js
// helper to ensure aiPlan is present (lazy-initialized)
function ensureAiPlan(gd, balance) {
  if (!gd._aiPlan) {
    gd._aiPlan = aiSample(1, 0, gd.seed, balance);
  }
}
```

In `tickStaging`, AI always holds both buttons (no jump-start):

```js
function tickStaging(gd, balance, dt) {
  ensureAiPlan(gd, balance);
  gd.inputGas[1] = 1;
  gd.inputShift[1] = 1;
  // ... rest of staging logic
```

In `tickTree`, AI continues holding (no jump). After green, AI counts down their RT, then releases:

```js
function tickTree(gd, balance, dt) {
  for (let i = 0; i < NUM_CARS; i++) revToward(gd, balance, i, dt);
  const t = gd.raceTimeS - gd.treeStartTimeS;
  const ambers = Math.min(TREE_AMBER_COUNT, Math.floor(t / TREE_AMBER_INTERVAL_S));
  gd.treeAmbersLit = ambers;
  // jump detection only for the player; AI doesn't jump
  if (gd.treeGreenAtS === 0) {
    if (!gd.inputShift[PLAYER_CAR_IDX] && !gd.jumped[PLAYER_CAR_IDX]) {
      gd.jumped[PLAYER_CAR_IDX] = 1;
      gd.raceState = 'finished';
      gd.winnerCarIdx = 1 - PLAYER_CAR_IDX;
      return;
    }
  }
  if (ambers >= TREE_AMBER_COUNT && gd.treeGreenAtS === 0) {
    gd.treeGreenAtS = gd.raceTimeS;
    gd.raceState = 'launching';
  }
}
```

In `tickLaunching`, AI releases SHIFT when its RT elapses:

```js
function tickLaunching(gd, balance, dt) {
  // AI: release SHIFT after rt elapses
  const aiRt = gd._aiPlan.rt;
  if (gd.raceTimeS - gd.treeGreenAtS >= aiRt && gd.inputShift[1] === 1) {
    gd.inputShift[1] = 0;
  }
  // record RT for any car that has released
  for (let i = 0; i < NUM_CARS; i++) {
    if (gd.rtS[i] === 0 && !gd.inputShift[i]) {
      gd.rtS[i] = Math.max(0, gd.raceTimeS - gd.treeGreenAtS);
    }
  }
  for (let i = 0; i < NUM_CARS; i++) revToward(gd, balance, i, dt);
  // launch when both have RT recorded (or after a 1.5s timeout to be safe)
  const allLaunched = gd.rtS[0] > 0 && gd.rtS[1] > 0;
  if (allLaunched || (gd.raceTimeS - gd.treeGreenAtS) > 1.5) {
    gd.raceState = 'racing';
    gd.racingStartS = gd.raceTimeS;
    // AI keeps gas held throughout race
    gd.inputGas[1] = 1;
  }
}
```

In `tickRacing`, AI tries to upshift when its RPM crosses each `shiftAtRpm[g-1]` target:

```js
function tickRacing(gd, balance, dt) {
  // AI shift logic
  if (!gd.finished[1] && !gd.blown[1] && gd.gear[1] < 4) {
    const targetRpm = gd._aiPlan.shiftAtRpm[gd.gear[1] - 1];
    if (gd.rpm[1] >= targetRpm) {
      handleShiftTap(gd, balance, 1);
    }
  }
  // Process player shift edge
  if (gd.inputShiftPressEdge[0]) {
    gd.inputShiftPressEdge[0] = 0;
    handleShiftTap(gd, balance, 0);
  }
  // physics
  for (let i = 0; i < NUM_CARS; i++) {
    if (gd.finished[i] || gd.blown[i]) continue;
    stepCar(gd, balance, i, dt);
  }
  // finish detection (unchanged)
  for (let i = 0; i < NUM_CARS; i++) {
    if (!gd.finished[i] && -gd.posZ[i] >= FINISH_LINE_M) {
      gd.finished[i] = 1;
      gd.finishTimeS[i] = gd.raceTimeS - gd.racingStartS;
    }
  }
  let allDone = true;
  for (let i = 0; i < NUM_CARS; i++) {
    if (!gd.finished[i] && !gd.blown[i]) { allDone = false; break; }
  }
  if (allDone) {
    gd.raceState = 'finished';
    gd.winnerCarIdx = pickWinner(gd);
  }
}
```

- [ ] **Step 2: Add a deterministic full-race test**

Append to `tests/race-logic.test.js`:

```js
test('full race: deterministic, both cars finish, winner determined', () => {
  const gd = allocGameData(balance);
  resetRace(gd, balance, 12345);
  // Player: hold both, then release SHIFT after 0.5s of green, then tap shift at 6300 rpm
  let phase = 'wait';
  let shiftsLeft = 3;
  let t = 0;
  let lastRpmAtTap = 6300;
  while (t < 30 && gd.raceState !== 'finished') {
    if (gd.raceState === 'staging' || gd.raceState === 'tree') {
      gd.inputGas[0] = 1; gd.inputShift[0] = 1;
    } else if (gd.raceState === 'launching') {
      // release shift just after green (300ms RT)
      if (gd.raceTimeS - gd.treeGreenAtS >= 0.30 && gd.inputShift[0]) {
        gd.inputShift[0] = 0;
      }
    } else if (gd.raceState === 'racing') {
      gd.inputGas[0] = 1;
      if (shiftsLeft > 0 && gd.rpm[0] >= lastRpmAtTap) {
        gd.inputShiftPressEdge[0] = 1;
        shiftsLeft--;
      }
    }
    tickRace(gd, balance, FIXED_DT);
    t += FIXED_DT;
  }
  assert.equal(gd.raceState, 'finished');
  assert.ok(gd.finished[0] || gd.blown[0], 'player race should resolve');
  assert.ok(gd.finished[1] || gd.blown[1], 'opponent race should resolve');
  assert.ok(gd.winnerCarIdx === 0 || gd.winnerCarIdx === 1, 'a winner should be set');
});
```

- [ ] **Step 3: Run tests — expect pass**

Run: `npm test`
Expected: full-race test passes; all prior tests still green.

- [ ] **Step 4: Commit**

```bash
git add js/race-logic.js tests/race-logic.test.js
git commit -m "feat: AI driver wired into race state machine; deterministic 1v1 race"
```

---

## Task 9: env-builder.js — classic strip

**Files:**
- Create: `js/env-builder.js`

- [ ] **Step 1: Create `js/env-builder.js`**

```js
/* Builds the classic-strip environment as a THREE.Group + ancillary objects.
 * Reads window.THREE (loaded via CDN <script>). All other env builders are
 * deferred to Plan 3.
 */

export function buildClassicEnv(scene) {
  const T = window.THREE;

  scene.background = new T.Color(0x9bb8d8);
  scene.fog = new T.Fog(0x9bb8d8, 80, 400);

  scene.add(new T.AmbientLight(0xa8b8d8, 0.55));
  scene.add(new T.HemisphereLight(0xa8c8ff, 0x3a3020, 0.35));
  const sun = new T.DirectionalLight(0xfff0d0, 1.1);
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

  const strip = new T.Mesh(
    new T.PlaneGeometry(15, 700),
    new T.MeshLambertMaterial({ map: stripTex })
  );
  strip.rotation.x = -Math.PI / 2;
  strip.position.set(0, 0, -300);
  scene.add(strip);

  // Dirt run-off
  const dirt = new T.Mesh(
    new T.PlaneGeometry(300, 700),
    new T.MeshLambertMaterial({ color: 0x6a5a3c })
  );
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
  const treeColors = [0x554000, 0x554000, 0x554000, 0x551100, 0x115522]; // dim defaults
  const ambers = []; let green = null;
  for (let i = 0; i < 5; i++) {
    for (const sx of [-1, 1]) {
      const bulb = new T.Mesh(
        new T.SphereGeometry(0.22, 12, 8),
        new T.MeshBasicMaterial({ color: treeColors[i] })
      );
      bulb.position.set(sx * 0.5, 5.5 - i * 0.9, 0);
      tree.add(bulb);
      if (i < 3) ambers.push(bulb);
      if (i === 4) green = bulb;
    }
  }
  tree.position.set(0, 0, -1.5);
  scene.add(tree);

  // Finish gantry
  const gantry = new T.Group();
  const left = new T.Mesh(
    new T.BoxGeometry(0.6, 9, 0.6),
    new T.MeshLambertMaterial({ color: 0x444444 })
  );
  left.position.set(-7.5, 4.5, 0); gantry.add(left);
  const right = left.clone(); right.position.x = 7.5; gantry.add(right);
  const cross = new T.Mesh(
    new T.BoxGeometry(15.6, 1.2, 0.6),
    new T.MeshLambertMaterial({ color: 0xc04020 })
  );
  cross.position.set(0, 9, 0); gantry.add(cross);
  // Finish line is 402.336m down strip (1/4 mile). Use that as Z.
  gantry.position.set(0, 0, -402.336);
  scene.add(gantry);

  return { strip, tree, ambers, green };
}

/** Update christmas tree bulb materials given current race state. */
export function updateTreeFromGameData(envObjects, gameData) {
  const T = window.THREE;
  // Amber colors: bright if lit
  const amberOn  = 0xffaa00, amberOff = 0x554000;
  const greenOn  = 0x22ee48, greenOff = 0x115522;
  for (let i = 0; i < envObjects.ambers.length; i++) {
    const lit = (i < gameData.treeAmbersLit * 2);   // 2 bulbs per row
    envObjects.ambers[i].material.color.setHex(lit ? amberOn : amberOff);
  }
  if (envObjects.green) {
    const greenLit = gameData.treeGreenAtS > 0;
    envObjects.green.material.color.setHex(greenLit ? greenOn : greenOff);
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add js/env-builder.js
git commit -m "feat: classic-strip env builder + christmas-tree state update helper"
```

---

## Task 10: car-models.js — 6 archetype builders

**Files:**
- Create: `js/car-models.js`

- [ ] **Step 1: Create `js/car-models.js`**

Port the archetype builders from the brainstorming mockup. The mockup file is at `.superpowers/brainstorm/*/content/car-archetypes.html` for reference; here we expose them as a module:

```js
/* Procedural low-poly car archetypes. Each takes (color1, color2) and
 * returns a THREE.Group oriented with +Z = forward (drag-strip convention).
 * Shared helpers at the bottom.
 *
 * The archetype names match balance.cars[i].archetype.
 */

const ARCHETYPES = {};

ARCHETYPES.sedan = function (color1, color2) {
  const T = window.THREE;
  const g = new T.Group();
  const body = new T.Mesh(
    new T.BoxGeometry(1.7, 0.9, 4.0),
    new T.MeshLambertMaterial({ color: color1 })
  ); body.position.y = 0.55; g.add(body);
  const cabin = new T.Mesh(
    new T.BoxGeometry(1.55, 0.95, 2.0),
    new T.MeshLambertMaterial({ color: color2 })
  ); cabin.position.set(0, 1.45, -0.05); g.add(cabin);
  addWheels(g, 0.36, 1.5, 1.2, 0.36, 1.5, 0.95);
  addBumpers(g, 1.7, 4.0, 0.55);
  return g;
};

ARCHETYPES.hatch = function (color1, color2) {
  const T = window.THREE;
  const g = new T.Group();
  const body = new T.Mesh(
    new T.BoxGeometry(1.85, 0.8, 3.6),
    new T.MeshLambertMaterial({ color: color1 })
  ); body.position.y = 0.5; g.add(body);
  const cabin = new T.Mesh(
    new T.BoxGeometry(1.7, 0.85, 2.1),
    new T.MeshLambertMaterial({ color: color2 })
  ); cabin.position.set(0, 1.3, -0.2); g.add(cabin);
  // wide arch flares
  for (const px of [-0.95, 0.95]) for (const pz of [-1.2, 1.2]) {
    const f = new T.Mesh(new T.BoxGeometry(0.18, 0.3, 0.85),
      new T.MeshLambertMaterial({ color: 0x1a1a1a }));
    f.position.set(px, 0.55, pz); g.add(f);
  }
  addWing(g, 1.3, 0.06, 0.32, 0.5, 1.2, -1.7, 0x111111);
  addWheels(g, 0.4, 1.55, 1.25, 0.4, 1.55, 0.95);
  return g;
};

ARCHETYPES.sport = function (color1, color2) {
  const T = window.THREE;
  const g = new T.Group();
  const body = new T.Mesh(
    new T.BoxGeometry(1.85, 0.7, 4.6),
    new T.MeshLambertMaterial({ color: color1 })
  ); body.position.y = 0.45; g.add(body);
  const cabin = new T.Mesh(
    new T.BoxGeometry(1.7, 0.7, 2.4),
    new T.MeshLambertMaterial({ color: color2 })
  ); cabin.position.set(0, 1.05, -0.4); cabin.rotation.x = -0.05; g.add(cabin);
  const hoodRidge = new T.Mesh(
    new T.BoxGeometry(1.5, 0.06, 1.4),
    new T.MeshLambertMaterial({ color: color1 })
  ); hoodRidge.position.set(0, 0.83, 1.4); g.add(hoodRidge);
  addWing(g, 1.5, 0.06, 0.3, 0.5, 1.0, -2.15, 0x111111);
  addWheels(g, 0.4, 1.6, 1.7, 0.4, 1.6, 1.35);
  return g;
};

ARCHETYPES.muscle = function (color1, color2) {
  const T = window.THREE;
  const g = new T.Group();
  const body = new T.Mesh(
    new T.BoxGeometry(1.95, 0.85, 4.9),
    new T.MeshLambertMaterial({ color: color1 })
  ); body.position.y = 0.55; g.add(body);
  const cabin = new T.Mesh(
    new T.BoxGeometry(1.75, 0.7, 1.9),
    new T.MeshLambertMaterial({ color: color2 })
  ); cabin.position.set(0, 1.3, -0.6); g.add(cabin);
  const scoop = new T.Mesh(
    new T.BoxGeometry(0.85, 0.25, 0.9),
    new T.MeshLambertMaterial({ color: 0x111111 })
  ); scoop.position.set(0, 1.12, 1.2); g.add(scoop);
  for (const sx of [-0.55, 0.55]) {
    const exh = new T.Mesh(
      new T.CylinderGeometry(0.09, 0.09, 0.3, 10),
      new T.MeshLambertMaterial({ color: 0x444444 })
    );
    exh.rotation.x = Math.PI / 2;
    exh.position.set(sx, 0.4, -2.6); g.add(exh);
  }
  addWheels(g, 0.46, 1.65, 1.8, 0.5, 1.7, 1.5);
  return g;
};

ARCHETYPES.supercar = function (color1, color2) {
  const T = window.THREE;
  const g = new T.Group();
  const body = new T.Mesh(
    new T.BoxGeometry(2.05, 0.55, 4.5),
    new T.MeshLambertMaterial({ color: color1 })
  ); body.position.y = 0.4; g.add(body);
  const cabin = new T.Mesh(
    new T.BoxGeometry(1.4, 0.5, 1.6),
    new T.MeshLambertMaterial({ color: color2 })
  ); cabin.position.set(0, 0.92, -0.2); cabin.rotation.x = -0.08; g.add(cabin);
  for (const sx of [-1.0, 1.0]) {
    const scoop = new T.Mesh(
      new T.BoxGeometry(0.18, 0.4, 1.2),
      new T.MeshLambertMaterial({ color: 0x111111 })
    );
    scoop.position.set(sx, 0.65, -0.7); g.add(scoop);
  }
  addWing(g, 2.0, 0.08, 0.45, 0.55, 1.05, -2.0, 0x111111);
  for (const sx of [-1.0, 1.0]) {
    const haunch = new T.Mesh(
      new T.BoxGeometry(0.25, 0.35, 1.5),
      new T.MeshLambertMaterial({ color: color1 })
    );
    haunch.position.set(sx, 0.55, -0.8); g.add(haunch);
  }
  addWheels(g, 0.42, 1.7, 1.7, 0.48, 1.85, 1.4);
  return g;
};

ARCHETYPES.topfuel = function (color1, color2) {
  const T = window.THREE;
  const g = new T.Group();
  const chassis = new T.Mesh(
    new T.BoxGeometry(0.35, 0.18, 7.0),
    new T.MeshLambertMaterial({ color: color1 })
  ); chassis.position.y = 0.42; g.add(chassis);
  const shroud = new T.Mesh(
    new T.BoxGeometry(1.2, 0.6, 1.8),
    new T.MeshLambertMaterial({ color: color1 })
  ); shroud.position.set(0, 0.55, -2.2); g.add(shroud);
  const bubble = new T.Mesh(
    new T.SphereGeometry(0.32, 12, 8),
    new T.MeshLambertMaterial({ color: color2 })
  ); bubble.position.set(0, 1.1, -1.4); g.add(bubble);
  const block = new T.Mesh(
    new T.BoxGeometry(0.65, 0.7, 0.95),
    new T.MeshLambertMaterial({ color: 0x222222 })
  ); block.position.set(0, 0.95, -0.3); g.add(block);
  const sc = new T.Mesh(
    new T.BoxGeometry(0.55, 0.4, 0.55),
    new T.MeshLambertMaterial({ color: 0x666666 })
  ); sc.position.set(0, 1.42, -0.2); g.add(sc);
  // skinny fronts
  addWheelAt(g,  0.5, 0.2, 3.0, 0.22, 0.22, 0.2);
  addWheelAt(g, -0.5, 0.2, 3.0, 0.22, 0.22, 0.2);
  // fat rear slicks
  addWheelAt(g,  0.95, 0.55, -2.6, 0.6, 0.6, 0.6);
  addWheelAt(g, -0.95, 0.55, -2.6, 0.6, 0.6, 0.6);
  addWing(g, 1.6, 0.08, 0.45, 0.6, 1.55, -2.85, 0x111111);
  return g;
};

/** Build a car given an archetype name and two colors. */
export function buildCar(archetype, color1, color2) {
  const fn = ARCHETYPES[archetype];
  if (!fn) throw new Error('unknown archetype: ' + archetype);
  return fn(color1, color2);
}

// ---------- helpers ----------
function addWheels(g, frontR, frontX, frontZ, rearR, rearX, rearZ) {
  rearR = rearR || frontR; rearX = rearX || frontX; rearZ = rearZ || frontZ;
  addWheelAt(g,  frontX, frontR,  frontZ, frontR, frontR, 0.32);
  addWheelAt(g, -frontX, frontR,  frontZ, frontR, frontR, 0.32);
  addWheelAt(g,  rearX,  rearR,  -rearZ,  rearR,  rearR,  0.36);
  addWheelAt(g, -rearX,  rearR,  -rearZ,  rearR,  rearR,  0.36);
}
function addWheelAt(g, x, y, z, rTop, rBot, w) {
  const T = window.THREE;
  const wm = new T.MeshLambertMaterial({ color: 0x0a0a0a });
  const wheel = new T.Mesh(new T.CylinderGeometry(rTop, rBot, w, 16), wm);
  wheel.position.set(x, y, z); wheel.rotation.z = Math.PI / 2;
  g.add(wheel);
}
function addWing(g, w, h, d, postH, y, z, color) {
  const T = window.THREE;
  const mat = new T.MeshLambertMaterial({ color });
  const post1 = new T.Mesh(new T.BoxGeometry(0.06, postH, 0.06), mat);
  post1.position.set(-w * 0.4, y - postH * 0.5, z); g.add(post1);
  const post2 = post1.clone(); post2.position.x = w * 0.4; g.add(post2);
  const wing = new T.Mesh(new T.BoxGeometry(w, h, d), mat);
  wing.position.set(0, y, z); g.add(wing);
}
function addBumpers(g, w, l, y) {
  const T = window.THREE;
  const m = new T.MeshLambertMaterial({ color: 0x222222 });
  const front = new T.Mesh(new T.BoxGeometry(w * 0.95, 0.18, 0.18), m);
  front.position.set(0, y - 0.25, l * 0.5); g.add(front);
  const rear = front.clone(); rear.position.z = -l * 0.5; g.add(rear);
}

export const ARCHETYPE_NAMES = Object.keys(ARCHETYPES);
```

- [ ] **Step 2: Commit**

```bash
git add js/car-models.js
git commit -m "feat: 6 procedural car archetype builders (sedan, hatch, sport, muscle, supercar, topfuel)"
```

---

## Task 11: Review Gate A — present all 6 car archetypes

**Files:**
- Create: `tests-visual/cars-gate.html` (a one-off render harness, NOT a deploy file)
- Create: `tests-visual/cars-gate-screenshot.cjs`

This is a **review-gate task**: presents all archetypes to the user and pauses for approval before proceeding.

- [ ] **Step 1: Create `tests-visual/cars-gate.html` (harness)**

```html
<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Cars Gate</title>
<style>
  body { margin: 0; background: #0a0e14; color: #fff; font-family: system-ui; }
  .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; padding: 12px; }
  .card { background: #20262e; border-radius: 12px; overflow: hidden; }
  .card canvas { width: 100%; aspect-ratio: 4/3; display: block; }
  .card .body { padding: 8px 12px; }
  .card h3 { margin: 0; font-size: 16px; }
</style>
</head>
<body>
<div class="grid">
  <div class="card"><canvas id="c-sedan" width="400" height="300"></canvas><div class="body"><h3>sedan</h3></div></div>
  <div class="card"><canvas id="c-hatch" width="400" height="300"></canvas><div class="body"><h3>hatch</h3></div></div>
  <div class="card"><canvas id="c-sport" width="400" height="300"></canvas><div class="body"><h3>sport</h3></div></div>
  <div class="card"><canvas id="c-muscle" width="400" height="300"></canvas><div class="body"><h3>muscle</h3></div></div>
  <div class="card"><canvas id="c-supercar" width="400" height="300"></canvas><div class="body"><h3>supercar</h3></div></div>
  <div class="card"><canvas id="c-topfuel" width="400" height="300"></canvas><div class="body"><h3>topfuel</h3></div></div>
</div>
<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
<script type="module">
  import { buildCar, ARCHETYPE_NAMES } from '../js/car-models.js';
  const colors = {
    sedan:   [0x4d6dd6, 0x2a3950],
    hatch:   [0xe2c11a, 0x222222],
    sport:   [0xc83a26, 0x32100d],
    muscle:  [0x2a8fd4, 0x122a38],
    supercar:[0x1aaf65, 0x101a14],
    topfuel: [0xb02a8a, 0x1a1a1a],
  };
  const dist = { topfuel: 1.7 };
  ARCHETYPE_NAMES.forEach(name => {
    const canvas = document.getElementById('c-' + name);
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x20262e);
    scene.add(new THREE.AmbientLight(0x556070, 0.5));
    const k = new THREE.DirectionalLight(0xffffff, 1.2); k.position.set(4, 6, 5); scene.add(k);
    const r = new THREE.DirectionalLight(0x88aaff, 0.7); r.position.set(-3, 4, -4); scene.add(r);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(24, 24), new THREE.MeshLambertMaterial({ color: 0x2a2d33 }));
    floor.rotation.x = -Math.PI/2; scene.add(floor);
    const grid = new THREE.GridHelper(24, 24, 0x40464e, 0x303640);
    grid.material.transparent = true; grid.material.opacity = 0.6; scene.add(grid);
    const car = buildCar(name, colors[name][0], colors[name][1]);
    car.rotation.y = -0.45; scene.add(car);
    const dm = dist[name] || 1;
    const cam = new THREE.PerspectiveCamera(34, canvas.width/canvas.height, 0.1, 100);
    cam.position.set(5.5*dm, 2.5*dm, 5.5*dm); cam.lookAt(0, 0.7, 0);
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(canvas.width, canvas.height, false);
    renderer.render(scene, cam);
  });
</script>
</body></html>
```

- [ ] **Step 2: Create `tests-visual/cars-gate-screenshot.cjs`**

```js
const puppeteer = require('/usr/local/lib/node_modules/puppeteer');
const path = require('path');

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  page.on('pageerror', err => console.error('[pageerror]', err.message));
  page.on('console', msg => { if (msg.type() === 'error') console.error('[console]', msg.text()); });
  await page.setViewport({ width: 1280, height: 1000, deviceScaleFactor: 2 });
  // The harness imports js/car-models.js with ../js/, so URL must be /tests-visual/cars-gate.html
  await page.goto('http://localhost:8084/tests-visual/cars-gate.html', { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 600));
  const out = path.join('/tmp', 'dr3d-cars-gate.png');
  await page.screenshot({ path: out, fullPage: true });
  console.log('screenshot:', out);
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
```

- [ ] **Step 3: Verify locally**

In one terminal: `./dev-server.sh`
In another: `node tests-visual/cars-gate-screenshot.cjs`
Open `/tmp/dr3d-cars-gate.png` and confirm all 6 archetypes render correctly.

- [ ] **Step 4: REVIEW GATE A — pause for user approval**

**Stop here. Show the screenshot to the user and ask:** "Are the 6 car archetypes ready as-is, or do any silhouettes need iteration before we wire them into the real game?" Wait for explicit go/no-go. If iteration is requested, edit `js/car-models.js` and re-screenshot before proceeding.

- [ ] **Step 5: Commit (after approval)**

```bash
git add tests-visual/cars-gate.html tests-visual/cars-gate-screenshot.cjs
git commit -m "review-gate-a: car archetypes approved; harness saved"
```

---

## Task 12: camera3d.js — raised chase camera

**Files:**
- Create: `js/camera3d.js`

- [ ] **Step 1: Create `js/camera3d.js`**

```js
/* Raised chase camera that follows the player car along the strip.
 * Plan-1: chase only. Cockpit/side/cinematic deferred to v2.
 *
 * Convention: cars travel in -Z. Camera trails behind in +Z.
 */

import { LANE_OFFSET_X, PLAYER_CAR_IDX } from './constants.js';

export function createChaseCamera(canvas) {
  const T = window.THREE;
  const cam = new T.PerspectiveCamera(58, canvas.clientWidth / canvas.clientHeight, 0.1, 800);
  return cam;
}

/** Position the chase camera given player car's current Z. */
export function updateChaseCamera(cam, gameData) {
  const T = window.THREE;
  const playerZ = gameData.posZ[PLAYER_CAR_IDX];
  // raised chase: 6.5m behind, 2.4m up, look ~18m ahead at chest height
  cam.position.set(LANE_OFFSET_X, 2.4, playerZ + 6.5);
  // lookAt creates a fresh Vector3 — to keep this allocation-free, use a cached scratch:
  if (!cam.userData._lookAt) cam.userData._lookAt = new T.Vector3();
  cam.userData._lookAt.set(LANE_OFFSET_X * 0.8, 1.0, playerZ - 18);
  cam.lookAt(cam.userData._lookAt);
}
```

- [ ] **Step 2: Commit**

```bash
git add js/camera3d.js
git commit -m "feat: raised chase camera that follows player car"
```

---

## Task 13: renderer3d.js — scene assembly + frame draw

**Files:**
- Create: `js/renderer3d.js`

- [ ] **Step 1: Create `js/renderer3d.js`**

```js
import { buildClassicEnv, updateTreeFromGameData } from './env-builder.js';
import { buildCar } from './car-models.js';
import { LANE_OFFSET_X, PLAYER_CAR_IDX, OPPONENT_CAR_IDX, NUM_CARS } from './constants.js';

/** Build the race scene (classic strip + 2 cars). Returns { scene, cars, env }. */
export function buildRaceScene(balance) {
  const T = window.THREE;
  const scene = new T.Scene();
  const env = buildClassicEnv(scene);
  const cars = [];
  for (let i = 0; i < NUM_CARS; i++) {
    const car = buildCar(balance.cars[i].archetype, balance.cars[i].color1, balance.cars[i].color2);
    scene.add(car);
    cars.push(car);
  }
  return { scene, cars, env };
}

/**
 * Pure-read frame draw. Reads gameData; never mutates it.
 * Mutates THREE objects' positions only.
 */
export function renderFrame(renderer, scene, camera, cars, env, gameData) {
  // Place each car
  for (let i = 0; i < NUM_CARS; i++) {
    cars[i].position.set(gameData.posX[i], 0, gameData.posZ[i]);
  }
  // Tree state
  updateTreeFromGameData(env, gameData);
  renderer.render(scene, camera);
}
```

- [ ] **Step 2: Commit**

```bash
git add js/renderer3d.js
git commit -m "feat: renderer3d — scene assembly and read-only frame draw"
```

---

## Task 14: input.js — gas/shift button handling

**Files:**
- Create: `js/input.js`

- [ ] **Step 1: Create `js/input.js`**

```js
import { PLAYER_CAR_IDX } from './constants.js';

/**
 * Wire button DOM elements to gameData input flags.
 * The buttons must already exist in index.html (gas-button, shift-button).
 */
export function initInput(gameData) {
  const gasBtn   = document.getElementById('gas-button');
  const shiftBtn = document.getElementById('shift-button');
  if (!gasBtn || !shiftBtn) {
    console.warn('input.js: gas-button or shift-button not found');
    return;
  }

  function bind(btn, holdSetter, edgeSetter) {
    btn.addEventListener('pointerdown', e => {
      e.preventDefault();
      btn.setPointerCapture(e.pointerId);
      btn.classList.add('held');
      holdSetter(1);
      if (edgeSetter) edgeSetter(1);
    });
    function end(e) {
      btn.classList.remove('held');
      holdSetter(0);
    }
    btn.addEventListener('pointerup', end);
    btn.addEventListener('pointercancel', end);
    btn.addEventListener('lostpointercapture', end);
  }

  bind(gasBtn,
    v => { gameData.inputGas[PLAYER_CAR_IDX] = v; },
    null);

  bind(shiftBtn,
    v => { gameData.inputShift[PLAYER_CAR_IDX] = v; },
    v => { gameData.inputShiftPressEdge[PLAYER_CAR_IDX] = v; });
}
```

- [ ] **Step 2: Commit**

```bash
git add js/input.js
git commit -m "feat: input.js — pointerdown/up button handling for gas + shift"
```

---

## Task 15: tach.js + HUD DOM

**Files:**
- Create: `js/tach.js`
- Modify: `index.html` (add HUD overlays)
- Modify: `css/ui.css` (style HUD)

- [ ] **Step 1: Create `js/tach.js`**

```js
/**
 * Updates a circular tachometer SVG. The SVG markup is owned by index.html;
 * this module updates the needle, RPM digits, gear text, and green/red zones.
 */

const SVG_NS = 'http://www.w3.org/2000/svg';

/** Re-build the tach SVG inside the given parent element. */
export function buildTachSVG(parentEl, redline, greenBand) {
  parentEl.innerHTML = '';
  const W = 400, H = 400, cx = 200, cy = 200, r = 170;
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.setAttribute('xmlns', SVG_NS);
  svg.style.width = '100%';
  svg.style.height = '100%';
  parentEl.appendChild(svg);

  // outer ring
  const back = document.createElementNS(SVG_NS, 'circle');
  back.setAttribute('cx', cx); back.setAttribute('cy', cy);
  back.setAttribute('r', r + 8); back.setAttribute('fill', '#0e1116');
  back.setAttribute('stroke', '#33383f'); back.setAttribute('stroke-width', 3);
  svg.appendChild(back);

  // arc helpers (270° sweep starting bottom-left at -135°)
  function polar(deg, rad) {
    const a = (deg - 135) * Math.PI / 180;
    return [cx + Math.cos(a) * rad, cy + Math.sin(a) * rad];
  }
  function arcPath(a0, a1, rad) {
    const [x0, y0] = polar(a0, rad), [x1, y1] = polar(a1, rad);
    const large = (a1 - a0) > 180 ? 1 : 0;
    return `M ${x0.toFixed(1)} ${y0.toFixed(1)} A ${rad} ${rad} 0 ${large} 1 ${x1.toFixed(1)} ${y1.toFixed(1)}`;
  }
  // sweep represents 0..redline (degrees 0..270)
  // green = last greenBand RPM before redline; we need redline+10% as max so we map
  // 0..(redline*1.1) → 0..270.
  const maxRpm = redline * 1.1;
  const redDeg = redline / maxRpm * 270;
  const greenStart = (redline - greenBand) / maxRpm * 270;

  function appendArc(d, color, w) {
    const p = document.createElementNS(SVG_NS, 'path');
    p.setAttribute('d', d); p.setAttribute('stroke', color);
    p.setAttribute('stroke-width', w); p.setAttribute('fill', 'none');
    p.setAttribute('stroke-linecap', 'round');
    svg.appendChild(p);
    return p;
  }
  appendArc(arcPath(0, 270, r), '#1a1d22', 28);
  appendArc(arcPath(0, redDeg, r), '#cdd2da', 18);
  appendArc(arcPath(greenStart, redDeg, r), '#22ee48', 18);
  appendArc(arcPath(redDeg, 270, r), '#ff2a18', 18);

  // needle line (will be transformed each frame)
  const needle = document.createElementNS(SVG_NS, 'line');
  needle.setAttribute('x1', cx); needle.setAttribute('y1', cy);
  needle.setAttribute('x2', cx); needle.setAttribute('y2', cy - (r - 18));
  needle.setAttribute('stroke', '#fff'); needle.setAttribute('stroke-width', 6);
  needle.setAttribute('stroke-linecap', 'round');
  needle.setAttribute('transform-origin', `${cx} ${cy}`);
  svg.appendChild(needle);

  const hub = document.createElementNS(SVG_NS, 'circle');
  hub.setAttribute('cx', cx); hub.setAttribute('cy', cy);
  hub.setAttribute('r', 14); hub.setAttribute('fill', '#222');
  hub.setAttribute('stroke', '#fff'); hub.setAttribute('stroke-width', 3);
  svg.appendChild(hub);

  const rpmDigits = textNode(svg, cx, cy - 30, '0', 56, '#fff', 'bold');
  textNode(svg, cx, cy + 8, 'RPM', 22, '#aaa');
  const gearDigit = textNode(svg, cx, cy + 60, '1', 64, '#fff', 'bold');
  textNode(svg, cx, cy + 88, 'GEAR', 18, '#aaa');

  return {
    update(rpm, gear) {
      const deg = Math.max(0, Math.min(270, rpm / maxRpm * 270));
      // needle pivot: pointing at -135° at deg=0; +135° at deg=270
      // needle base is straight up; rotate by (-135 + deg) degrees.
      needle.setAttribute('transform', `rotate(${-135 + deg} ${cx} ${cy})`);
      rpmDigits.textContent = String(Math.round(rpm));
      gearDigit.textContent = String(gear);
    },
  };
}

function textNode(svg, x, y, text, size, color, weight) {
  const t = document.createElementNS(SVG_NS, 'text');
  t.setAttribute('x', x); t.setAttribute('y', y);
  t.setAttribute('text-anchor', 'middle');
  t.setAttribute('fill', color);
  t.setAttribute('font-size', size);
  if (weight) t.setAttribute('font-weight', weight);
  t.setAttribute('font-family', 'system-ui');
  t.textContent = text;
  svg.appendChild(t);
  return t;
}
```

- [ ] **Step 2: Add HUD overlays to `index.html`**

Modify `index.html` — add inside `<div id="ui">`:

```html
<div id="hud" class="screen hidden hud-overlay">
  <div id="hud-time" class="hud-chip top-left">0.00s</div>
  <div id="hud-speed" class="hud-chip top-right">0 mph</div>
  <div id="tach-container"></div>
  <button id="shift-button" class="race-button shift-button">SHIFT</button>
  <button id="gas-button" class="race-button gas-button">GAS</button>
</div>
```

- [ ] **Step 3: Add HUD CSS to `css/ui.css`**

Append:

```css
.hud-overlay {
  background: transparent !important;
  pointer-events: none;
}
.hud-overlay > * { pointer-events: auto; }

.hud-chip {
  position: absolute;
  color: #fff;
  font-size: 22px;
  font-weight: 600;
  background: rgba(0,0,0,0.45);
  padding: 6px 12px;
  border-radius: 8px;
}
.hud-chip.top-left { top: 24px; left: 24px; }
.hud-chip.top-right { top: 24px; right: 24px; }

#tach-container {
  position: absolute;
  top: 12%;
  left: 50%; transform: translateX(-50%);
  width: 65%; aspect-ratio: 1/1;
  pointer-events: none;
}

.race-button {
  position: absolute; bottom: 0;
  height: 220px; width: 50%;
  border: none; cursor: pointer; touch-action: manipulation;
  font-family: system-ui; font-weight: 800; letter-spacing: 4px;
  font-size: 64px; color: #fff;
  display: flex; align-items: center; justify-content: center;
}
.shift-button {
  left: 0;
  background: linear-gradient(180deg, #3a4858, #1c2530);
  border-top: 4px solid #5a6878;
  border-right: 4px solid #5a6878;
}
.shift-button.held { background: #5a7090; }
.gas-button {
  right: 0;
  background: linear-gradient(180deg, #d65a3a, #7a2010);
  border-top: 4px solid #ff8a5a;
  border-left: 4px solid #ff8a5a;
}
.gas-button.held { background: #ff5a3a; }
```

- [ ] **Step 4: Commit**

```bash
git add js/tach.js index.html css/ui.css
git commit -m "feat: tach.js + HUD overlays (gas/shift buttons, time/speed chips, tach container)"
```

---

## Task 16: main.js — wire it all together for a playable race

**Files:**
- Modify: `js/main.js`

- [ ] **Step 1: Replace `js/main.js` with the full game wiring**

```js
import { VERSION, FIXED_DT, MAX_DT, GREEN_BAND_RPM, PLAYER_CAR_IDX } from './constants.js';
import { balance } from './balance.js';
import { allocGameData, resetRace } from './gameData.js';
import { tickRace } from './race-logic.js';
import { initInput } from './input.js';
import { buildRaceScene } from './renderer3d.js';
import { createChaseCamera, updateChaseCamera } from './camera3d.js';
import { renderFrame } from './renderer3d.js';
import { buildTachSVG } from './tach.js';

const canvas = document.getElementById('game-canvas');
const T = window.THREE;
const renderer = new T.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(canvas.width, canvas.height, false);

const camera = createChaseCamera(canvas);

let gameData = allocGameData(balance);
let scene, cars, env, tachUpdater;
let acc = 0; let lastT = performance.now();
let started = false;

function show(id) {
  document.querySelectorAll('#ui .screen').forEach(s => s.classList.add('hidden'));
  const el = document.getElementById(id);
  if (el) el.classList.remove('hidden');
}

function startRace() {
  if (!scene) {
    const built = buildRaceScene(balance);
    scene = built.scene; cars = built.cars; env = built.env;
  }
  resetRace(gameData, balance, Date.now() | 0);
  show('hud');
  started = true;
  // build tach (red zones use redline of player's car)
  const tachContainer = document.getElementById('tach-container');
  tachUpdater = buildTachSVG(tachContainer, balance.cars[0].redlineRpm, GREEN_BAND_RPM);
}

document.getElementById('btn-start').addEventListener('click', () => startRace());
document.getElementById('version-text').textContent = VERSION;

// Initial input wiring needs gameData reference; must be after gameData allocated.
initInput(gameData);

function loop(now) {
  // Battery: respect platform pause
  if (window.PlaySDK && window.PlaySDK.isPaused) {
    requestAnimationFrame(loop);
    lastT = now;
    return;
  }
  let dt = (now - lastT) / 1000;
  lastT = now;
  if (dt > MAX_DT) dt = MAX_DT;
  if (started) {
    acc += dt;
    while (acc >= FIXED_DT) {
      tickRace(gameData, balance, FIXED_DT);
      acc -= FIXED_DT;
    }
    // HUD updates
    if (tachUpdater) tachUpdater.update(gameData.rpm[0], gameData.gear[0]);
    document.getElementById('hud-time').textContent =
      ((gameData.raceState === 'racing' || gameData.raceState === 'finished')
        ? (gameData.raceTimeS - gameData.racingStartS).toFixed(2)
        : '0.00') + 's';
    document.getElementById('hud-speed').textContent =
      Math.round(gameData.velMs[0] * 2.237) + ' mph';
    // 3D
    updateChaseCamera(camera, gameData);
    renderFrame(renderer, scene, camera, cars, env, gameData);
    if (gameData.raceState === 'finished' && !document.getElementById('screen-results')) {
      showResults();
    }
  }
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

function showResults() {
  // Build results overlay if absent
  let el = document.getElementById('screen-results');
  if (!el) {
    el = document.createElement('div');
    el.id = 'screen-results'; el.className = 'screen';
    el.innerHTML = `
      <h2 id="res-headline" style="font-size:96px;margin-bottom:32px"></h2>
      <div id="res-detail" style="font-size:32px;margin-bottom:16px"></div>
      <div id="res-rt" style="font-size:24px;opacity:0.8;margin-bottom:32px"></div>
      <button id="btn-rerun" class="btn-primary">RACE AGAIN</button>
    `;
    document.getElementById('ui').appendChild(el);
    document.getElementById('btn-rerun').addEventListener('click', () => {
      el.remove();
      startRace();
    });
  }
  show('screen-results');
  const won = gameData.winnerCarIdx === PLAYER_CAR_IDX;
  const jumped = gameData.jumped[PLAYER_CAR_IDX] === 1;
  document.getElementById('res-headline').textContent =
    jumped ? 'JUMPED START' : (won ? 'YOU WIN' : 'YOU LOSE');
  const playerET = gameData.finished[PLAYER_CAR_IDX] ? gameData.finishTimeS[PLAYER_CAR_IDX] : null;
  const oppET = gameData.finished[1] ? gameData.finishTimeS[1] : null;
  document.getElementById('res-detail').textContent =
    `Your ET: ${playerET == null ? '—' : playerET.toFixed(3) + 's'}   Opponent: ${oppET == null ? '—' : oppET.toFixed(3) + 's'}`;
  document.getElementById('res-rt').textContent =
    `RT: ${gameData.rtS[PLAYER_CAR_IDX].toFixed(3)}s`;
}
```

- [ ] **Step 2: Manual playthrough**

Run `./dev-server.sh`, open `http://localhost:8084`. Press START, hold both buttons, release SHIFT at green, tap SHIFT to upshift. Verify a race plays through to results.

- [ ] **Step 3: Commit**

```bash
git add js/main.js
git commit -m "feat: end-to-end race wiring (rAF loop, HUD updates, results screen, restart)"
```

---

## Task 17: Review Gate C — in-race screenshot for HUD approval

**Files:**
- Create: `tests-visual/race-gate.cjs`

- [ ] **Step 1: Create `tests-visual/race-gate.cjs`**

```js
const puppeteer = require('/usr/local/lib/node_modules/puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  page.on('pageerror', err => console.error('[pageerror]', err.message));
  await page.setViewport({ width: 540, height: 960, deviceScaleFactor: 2 });
  await page.goto('http://localhost:8084', { waitUntil: 'networkidle0' });
  // Click start
  await page.click('#btn-start');
  // Hold both buttons by dispatching pointerdown
  await page.evaluate(() => {
    function pd(id) {
      const e = document.getElementById(id);
      const r = e.getBoundingClientRect();
      e.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 1, clientX: r.left + 10, clientY: r.top + 10 }));
    }
    pd('gas-button'); pd('shift-button');
  });
  // wait until racing
  await page.waitForFunction(() => {
    // polling — gameData isn't on window; check that the time chip > 0.10s
    const el = document.getElementById('hud-time');
    return el && parseFloat(el.textContent) > 0.10;
  }, { timeout: 8000 });
  // Mid-race screenshot
  await new Promise(r => setTimeout(r, 1500));
  await page.screenshot({ path: '/tmp/dr3d-race-gate.png' });
  console.log('saved /tmp/dr3d-race-gate.png');
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
```

NOTE: For `pointerdown` to keep the SHIFT held, the page would need `pointermove` and `pointerup` not to fire. In headless Puppeteer the dispatched event flow works because we're not using mouse simulation. In practice the `pointerup` listener might still fire when the touch event ends — if the screenshot looks wrong (no tach activity), invoke `page.evaluate` to set the gameData inputs directly via `window.__test_gameData` (add a debug global behind `?test=1` if needed).

- [ ] **Step 2: Run with dev server up**

In one terminal: `./dev-server.sh`
In another: `node tests-visual/race-gate.cjs`

- [ ] **Step 3: REVIEW GATE C — pause for user approval**

**Stop here. Show `/tmp/dr3d-race-gate.png` to the user and ask:** "Does the in-race HUD layout look right (tach legibility, button proportions, road visibility)? Any tweaks before we wire Plan 2?" Wait for go/no-go. Iterate `js/tach.js` / `css/ui.css` and re-shoot if needed.

- [ ] **Step 4: Commit (after approval)**

```bash
git add tests-visual/race-gate.cjs
git commit -m "review-gate-c: in-race HUD approved; harness saved"
```

---

## Task 18: Plan-1 wrap — version bump & smoke

**Files:**
- Modify: `js/constants.js` (bump VERSION)
- Modify: `package.json` (bump version)

- [ ] **Step 1: Bump version**

In `js/constants.js`:
```js
export const VERSION = 'v0.2.0';
```
In `package.json`:
```json
"version": "0.2.0",
```

- [ ] **Step 2: Final smoke — full playthrough**

Run `./dev-server.sh` and play through one race manually. Confirm:
- Title screen shows v0.2.0 (bottom)
- Race starts when START pressed
- Holding both buttons rises RPM
- Christmas tree counts down to green
- Releasing SHIFT launches; RT is recorded
- Tapping SHIFT upshifts; gear and RPM update on tach
- Crossing finish line shows results
- Restart button works

- [ ] **Step 3: Commit**

```bash
git add js/constants.js package.json
git commit -m "release: Plan-1 Race Core complete (v0.2.0)"
```

---

## Self-review checklist (run before handing off)

- [ ] **Spec coverage:** Plan-1 implements the spec sections it scopes (race state machine §2, single env §5 partial, chase cam §5, HUD §5, AI opponent §3 partial, results card §1). Sections deferred to Plan 2/3 are marked explicit in the plan-1 scope block above. ✓
- [ ] **Placeholder scan:** No `TBD` / `TODO` / "later" markers in tasks. All code blocks complete. ✓
- [ ] **Type consistency:** `tickRace(gameData, balance, dt)`, `aiSample(carIdx, classIdx, seed, balance)`, `buildCar(archetype, color1, color2)`, `buildTachSVG(parentEl, redline, greenBand) → { update(rpm, gear) }` are referenced consistently across tasks. ✓
- [ ] **Review gates:** Gates A and C are explicit pause-for-approval steps. ✓
- [ ] **Out-of-scope clarity:** The plan-1 scope block lists what's deferred. ✓

---

## Execution handoff

Plan-1 saved. Next: choose how to execute.

**Plan 2 (Career & Garage)** and **Plan 3 (Polish & Online)** will be written after Plan-1 ships, when we know more about pacing and any architecture surprises.
