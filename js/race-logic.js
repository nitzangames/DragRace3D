import {
  TREE_AMBER_INTERVAL_S, TREE_AMBER_COUNT,
  NUM_CARS, PLAYER_CAR_IDX,
  BLOW_THRESHOLD_S, FINISH_LINE_M,
} from './constants.js';
import { blowThresholdReached } from './shift-scoring.js';

const INTRO_DURATION_S = 2.0;
const STAGING_HOLD_DURATION_S = 0.5; // player must hold both for 0.5s before tree
const G_MS2 = 9.81;                  // gravitational acceleration (m/s^2), used for normal-force calcs
const LIMITER_OVERSHOOT = 1.02;      // hard cap sits 2% above redline so cars can spend a brief moment at the limiter without instantly blowing (the BLOW_THRESHOLD_S timer governs blow-up)

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
  for (let i = 0; i < NUM_CARS; i++) {
    if (gd.finished[i] || gd.blown[i]) continue;
    stepCar(gd, balance, i, dt);
  }
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

function pickWinner(gd) {
  let bestI = 0, bestT = Infinity;
  for (let i = 0; i < NUM_CARS; i++) {
    const t = gd.finished[i] ? gd.finishTimeS[i] : Infinity;
    if (t < bestT) { bestT = t; bestI = i; }
  }
  return bestT === Infinity ? -1 : bestI;
}

function stepCar(gd, balance, i, dt) {
  const car = balance.cars[i];
  const wheelRps = gd.velMs[i] / (2 * Math.PI * car.wheelRadius);
  const wheelTargetRpm = wheelRps * 60 * car.gearRatios[gd.gear[i] - 1] * car.finalDrive;
  // Gas pedal holds the engine in the power band; wheel speed may demand higher RPM (no drop below power band when gas is on)
  const gasTarget = gd.inputGas[i] ? car.torquePeakRpm : car.idleRpm;
  const targetRpm = Math.max(wheelTargetRpm, gasTarget);
  gd.rpm[i] += (targetRpm - gd.rpm[i]) * Math.min(1, car.engineResponse * dt);
  if (gd.rpm[i] < car.idleRpm) gd.rpm[i] = car.idleRpm;
  const limiterRpm = car.redlineRpm * LIMITER_OVERSHOOT;
  if (gd.rpm[i] > limiterRpm) gd.rpm[i] = limiterRpm;
  // Reset on any sub-redline tick: in current physics RPM moves smoothly via lerp
  // so this won't oscillate, but if balance ever introduces a model that bounces
  // in/out of redline rapidly, this could mask blow-ups — revisit then.
  if (gd.rpm[i] >= car.redlineRpm) gd.timeAtLimiterS[i] += dt;
  else gd.timeAtLimiterS[i] = 0;
  if (blowThresholdReached(gd.timeAtLimiterS[i], BLOW_THRESHOLD_S)) {
    gd.blown[i] = 1;
    return;
  }
  const torque = torqueAt(car, gd.rpm[i]);
  let force = torque * car.gearRatios[gd.gear[i] - 1] * car.finalDrive / car.wheelRadius;
  const fMax = car.grip * car.mass * G_MS2;
  if (force > fMax) {
    gd.slip[i] = 1;
    force = fMax;
  } else {
    gd.slip[i] = 0;
  }
  force -= car.dragCoef * gd.velMs[i] * gd.velMs[i];
  force -= car.rollingResistance * car.mass * G_MS2;
  gd.velMs[i] += (force / car.mass) * dt;
  if (gd.velMs[i] < 0) gd.velMs[i] = 0;
  gd.posZ[i] -= gd.velMs[i] * dt;  // -Z is forward
}

function torqueAt(car, rpm) {
  const dx = (rpm - car.torquePeakRpm) / car.torqueWidth;
  return car.torquePeakNm * Math.exp(-dx * dx);
}

function tickCoast(gd, balance, dt) {
  // Stub — Plan 1 reaches 'finished' from racing directly; coast may be used in
  // Plan 2/3 for parachute / decel between finish line and full stop.
}
