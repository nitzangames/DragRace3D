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
  assert.deepEqual(out.gearRatios, car.gearRatios);
});

test('tire pressure adjusts effective grip slightly', () => {
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
