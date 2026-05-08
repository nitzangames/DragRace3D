import {
  TREE_AMBER_INTERVAL_S, TREE_AMBER_COUNT,
  NUM_CARS, PLAYER_CAR_IDX,
} from './constants.js';

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
  for (let i = 0; i < NUM_CARS; i++) revToward(gd, balance, i, dt);
  if (gd.rtS[PLAYER_CAR_IDX] > 0) {
    gd.raceState = 'racing';
    gd.racingStartS = gd.raceTimeS;
  }
}

function tickRacing(gd, balance, dt) {
  // Stub for now — Task 5 fills in physics + shifts + finish detection.
}

function tickCoast(gd, balance, dt) {
  // Stub — same as racing for now until physics added.
}
