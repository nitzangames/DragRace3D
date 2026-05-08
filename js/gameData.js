import { NUM_CARS, PLAYER_CAR_IDX, LANE_OFFSET_X } from './constants.js';

/**
 * Allocate the single mutable gameData object. Pre-allocates all per-car
 * TypedArrays and the input-flag/staging-state fields. Never re-allocates
 * during gameplay.
 *
 * The `balance` parameter isn't read at alloc time today (NUM_CARS comes
 * from constants), but call sites already pass it because Plan 2 / Plan 3
 * pool sizes (smoke, sparks, ghost-replay buffers) will depend on balance
 * data. Keeping the signature stable now avoids touching every caller later.
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
    inputShiftReleasedAt: new Float32Array(N), // timestamp of most recent SHIFT release (-1 if never)
    inputShiftPressEdge:  new Uint8Array(N),   // 1 once on each press; race-logic clears

    // ---- race-wide state ----
    raceState: 'intro',  // 'intro' | 'staging' | 'tree' | 'launching' | 'racing' | 'coast' | 'finished'
    raceTimeS: 0,
    introTimeS: 0,
    treeStartTimeS: 0,
    treeAmbersLit: 0,    // 0..3
    treeGreenAtS: 0,     // when green light came on
    racingStartS: 0,     // when the player launched
    winnerCarIdx: -1,

    // ---- per-frame logic output (set by race-logic, read by renderer for VFX) ----
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
