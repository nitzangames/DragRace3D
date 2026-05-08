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

test('blowThresholdReached: under 1.0s at limiter is fine', () => {
  assert.equal(blowThresholdReached(0.5, 1.0), false);
  assert.equal(blowThresholdReached(0.999, 1.0), false);
});

test('blowThresholdReached: 1.0s+ at limiter blows engine', () => {
  assert.equal(blowThresholdReached(1.0, 1.0), true);
  assert.equal(blowThresholdReached(1.5, 1.0), true);
});
