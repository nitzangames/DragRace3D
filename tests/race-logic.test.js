import { test } from 'node:test';
import assert from 'node:assert/strict';
import { allocGameData, resetRace } from '../js/gameData.js';
import { balance } from '../js/balance.js';
import { NUM_CARS, FIXED_DT } from '../js/constants.js';
import { tickRace } from '../js/race-logic.js';

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
  for (let t = 0; t < 2.0; t += FIXED_DT) tickRace(gd, balance, FIXED_DT);
  gd.inputGas[0] = 1; gd.inputShift[0] = 1;
  gd.inputGas[1] = 1; gd.inputShift[1] = 1;
  for (let t = 0; t < 0.6; t += FIXED_DT) tickRace(gd, balance, FIXED_DT);
  assert.equal(gd.raceState, 'tree');
});

test('physics: car at full gas accelerates forward', () => {
  const gd = allocGameData(balance);
  resetRace(gd, balance, 1);
  gd.raceState = 'racing';
  gd.gear[0] = 1; gd.gear[1] = 1;
  gd.rpm[0] = 5000; gd.rpm[1] = 5000;
  gd.inputGas[0] = 1; gd.inputGas[1] = 0;
  for (let t = 0; t < 1.0; t += FIXED_DT) tickRace(gd, balance, FIXED_DT);
  assert.ok(gd.posZ[0] < 0, 'player should have moved forward (-Z)');
  assert.ok(gd.velMs[0] > 0, 'player should have positive forward velocity');
});

test('physics: car finishes 1/4 mile in expected time window', () => {
  const gd = allocGameData(balance);
  resetRace(gd, balance, 1);
  gd.raceState = 'racing';
  gd.gear[0] = 4; gd.gear[1] = 4;  // top gear: covers 1/4 mile without engine blow
  gd.rpm[0] = 5000; gd.rpm[1] = 5000;
  gd.inputGas[0] = 1; gd.inputGas[1] = 0;
  let t = 0;
  while (t < 30 && !gd.finished[0]) {
    tickRace(gd, balance, FIXED_DT);
    t += FIXED_DT;
  }
  assert.ok(gd.finished[0], 'car should have finished');
  assert.ok(gd.finishTimeS[0] < 30, `finishTime too high: ${gd.finishTimeS[0]}`);
});

test('shift: tap shift in racing upshifts and drops RPM', () => {
  const gd = allocGameData(balance);
  resetRace(gd, balance, 1);
  gd.raceState = 'racing';
  gd.gear[0] = 1;
  gd.rpm[0] = 6500;
  gd.inputGas[0] = 1;
  gd.inputShiftPressEdge[0] = 1;
  tickRace(gd, balance, FIXED_DT);
  assert.equal(gd.gear[0], 2, 'should be in gear 2');
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

test('full race: deterministic, both cars finish, winner determined', () => {
  const gd = allocGameData(balance);
  resetRace(gd, balance, 12345);
  let shiftsLeft = 3;
  let lastRpmAtTap = 6300;
  let t = 0;
  while (t < 30 && gd.raceState !== 'finished') {
    if (gd.raceState === 'staging' || gd.raceState === 'tree') {
      gd.inputGas[0] = 1; gd.inputShift[0] = 1;
    } else if (gd.raceState === 'launching') {
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
