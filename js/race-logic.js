import {
  TREE_AMBER_INTERVAL_S, TREE_AMBER_COUNT,
  NUM_CARS, PLAYER_CAR_IDX,
  BLOW_THRESHOLD_S, FINISH_LINE_M,
} from './constants.js';
import { blowThresholdReached } from './shift-scoring.js';
import { aiSample } from './ai.js';

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

function ensureAiPlan(gd, balance) {
  if (!gd._aiPlan) {
    gd._aiPlan = aiSample(1, 0, gd.seed, balance);
  }
}

function tickStaging(gd, balance, dt) {
  ensureAiPlan(gd, balance);
  gd.inputGas[1] = 1;
  gd.inputShift[1] = 1;
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

// RPM rates while staging (no engine load — pure throttle-vs-pedal-off response).
// Cap is the redline limiter, not launchRpmMax. The "ideal launch RPM" is
// implicit in the bell-curve torque: revving too high reduces launch torque
// and increases wheelspin via the grip cap in stepCar.
const STAGING_REV_UP_RATE   = 8000;  // RPM/s when gas held
const STAGING_REV_DOWN_RATE = 6000;  // RPM/s when gas released
function revToward(gd, balance, i, dt) {
  const car = balance.cars[i];
  const limiter = car.redlineRpm * LIMITER_OVERSHOOT;
  if (gd.inputGas[i]) {
    gd.rpm[i] = clamp(gd.rpm[i] + STAGING_REV_UP_RATE * dt, car.idleRpm, limiter);
  } else {
    gd.rpm[i] = clamp(gd.rpm[i] - STAGING_REV_DOWN_RATE * dt, car.idleRpm, limiter);
  }
}

function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

function tickTree(gd, balance, dt) {
  // AI continues to hold throughout the tree (until launch)
  gd.inputGas[1] = 1;
  gd.inputShift[1] = 1;
  // Light an amber every TREE_AMBER_INTERVAL_S, then green at TREE_AMBER_COUNT * interval.
  for (let i = 0; i < NUM_CARS; i++) revToward(gd, balance, i, dt);
  const t = gd.raceTimeS - gd.treeStartTimeS;
  const ambers = Math.min(TREE_AMBER_COUNT, Math.floor(t / TREE_AMBER_INTERVAL_S));
  gd.treeAmbersLit = ambers;
  // Only the player can jump (AI is forced-held by tickStaging/tickTree)
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

function tickLaunching(gd, balance, dt) {
  ensureAiPlan(gd, balance);
  // AI: release SHIFT after rt elapses
  const aiRt = gd._aiPlan.rt;
  if (gd.raceTimeS - gd.treeGreenAtS >= aiRt && gd.inputShift[1] === 1) {
    gd.inputShift[1] = 0;
  }
  // Record RT for any car that has released
  for (let i = 0; i < NUM_CARS; i++) {
    if (gd.rtS[i] === 0 && !gd.inputShift[i]) {
      gd.rtS[i] = Math.max(0, gd.raceTimeS - gd.treeGreenAtS);
    }
  }
  // Per-car physics: launched cars (rtS > 0) get stepCar; unlaunched continue
  // to rev. The faster reactor starts moving FIRST — that's the head-start
  // earned by reaction time. Without this, both cars sat still until both
  // released, throwing away the player's RT advantage.
  for (let i = 0; i < NUM_CARS; i++) {
    if (gd.rtS[i] > 0) {
      stepCar(gd, balance, i, dt);
    } else {
      revToward(gd, balance, i, dt);
    }
  }
  // Transition to 'racing' as soon as the player launches — chase camera and
  // race-time HUD start at that moment for the player.
  if (gd.rtS[PLAYER_CAR_IDX] > 0) {
    gd.raceState = 'racing';
    // ET reference: tree-green light. Lower ET = won (RT included naturally).
    gd.racingStartS = gd.treeGreenAtS;
    gd.inputGas[1] = 1; // AI keeps gas held throughout race
  } else if ((gd.raceTimeS - gd.treeGreenAtS) > 2.0) {
    // Safety timeout: auto-launch player if they haven't released after 2s.
    gd.rtS[PLAYER_CAR_IDX] = 2.0;
    gd.raceState = 'racing';
    gd.racingStartS = gd.treeGreenAtS;
    gd.inputGas[1] = 1;
  }
}

function handleShiftTap(gd, balance, i) {
  const car = balance.cars[i];
  if (gd.gear[i] >= 4) return;
  const oldGear = gd.gear[i];
  const newGear = oldGear + 1;
  const ratioOld = car.gearRatios[oldGear - 1];
  const ratioNew = car.gearRatios[newGear - 1];
  gd.rpm[i] = gd.rpm[i] * (ratioNew / ratioOld);
  if (gd.rpm[i] < car.idleRpm) gd.rpm[i] = car.idleRpm;
  gd.gear[i] = newGear;
  gd.timeAtLimiterS[i] = 0;
}

function tickRacing(gd, balance, dt) {
  ensureAiPlan(gd, balance);
  // AI may still need to launch (player launched first, transition fired).
  const aiRt = gd._aiPlan.rt;
  if (gd.inputShift[1] === 1 && (gd.raceTimeS - gd.treeGreenAtS) >= aiRt) {
    gd.inputShift[1] = 0;
  }
  for (let i = 0; i < NUM_CARS; i++) {
    if (gd.rtS[i] === 0 && !gd.inputShift[i]) {
      gd.rtS[i] = Math.max(0, gd.raceTimeS - gd.treeGreenAtS);
    }
  }
  // AI shift logic — synthesize an edge tap when wheel-driven RPM crosses
  // the target (only if launched + moving).
  if (gd.rtS[1] > 0 && !gd.finished[1] && !gd.blown[1] && gd.gear[1] < 4 && gd.velMs[1] > 4) {
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
  // Per-car physics: launched cars (rtS > 0) step; unlaunched cars rev.
  for (let i = 0; i < NUM_CARS; i++) {
    if (gd.finished[i] || gd.blown[i]) continue;
    if (gd.rtS[i] > 0) {
      stepCar(gd, balance, i, dt);
    } else {
      revToward(gd, balance, i, dt);
    }
  }
  // Finish detection — ET measured from tree green so RT is part of ET.
  for (let i = 0; i < NUM_CARS; i++) {
    if (!gd.finished[i] && -gd.posZ[i] >= FINISH_LINE_M) {
      gd.finished[i] = 1;
      gd.finishTimeS[i] = gd.raceTimeS - gd.treeGreenAtS;
    }
  }
  // End the race the moment a car crosses the finish line (no need to wait
  // for the opponent — first to cross wins). Also end if both cars are
  // blown.
  let anyFinished = false;
  let allBlown = true;
  for (let i = 0; i < NUM_CARS; i++) {
    if (gd.finished[i]) anyFinished = true;
    if (!gd.blown[i]) allBlown = false;
  }
  if (anyFinished || allBlown) {
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
  const gearRatio = car.gearRatios[gd.gear[i] - 1];
  const wheelTargetRpm = wheelRps * 60 * gearRatio * car.finalDrive;
  // Clutch-slip blend: at v=0 with gas held, the engine wants to spin at the
  // torque peak (good launch). As v grows, the clutch progressively engages,
  // until at the velocity where the wheels can sustain torque-peak RPM in
  // the current gear, the wheels drive RPM directly. Tall gears have a wider
  // slip taper (clutch holds engine high longer); short gears engage quickly.
  // This avoids both (a) RPM pinning after an upshift (no more "stuck at 3.5")
  // and (b) cars stalling at low v in tall gears.
  const vAtPeakRpm = (car.torquePeakRpm / 60 / gearRatio / car.finalDrive)
                     * 2 * Math.PI * car.wheelRadius;
  const slipBlend = gd.inputGas[i] && vAtPeakRpm > 0
    ? Math.max(0, 1 - gd.velMs[i] / vAtPeakRpm)
    : 0;
  const blended = car.torquePeakRpm * slipBlend + wheelTargetRpm * (1 - slipBlend);
  const targetRpm = Math.max(blended, car.idleRpm);
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
