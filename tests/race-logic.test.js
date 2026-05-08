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
