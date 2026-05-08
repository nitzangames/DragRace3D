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
