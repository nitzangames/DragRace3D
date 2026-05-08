import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeRaceReward } from '../js/economy.js';

test('career win at class E pays class_base × 1.0 = 100', () => {
  assert.equal(computeRaceReward({ classIndex: 0, won: true, mode: 'career', perfectRT: false }), 100);
});

test('career loss at class E pays class_base × 0.20 = 20', () => {
  assert.equal(computeRaceReward({ classIndex: 0, won: false, mode: 'career', perfectRT: false }), 20);
});

test('career win with perfect RT adds 10% bonus', () => {
  // class_base × (1.0 + 0.10) = 100 × 1.10 = 110
  assert.equal(computeRaceReward({ classIndex: 0, won: true, mode: 'career', perfectRT: true }), 110);
});

test('quick race win pays class_base × 0.50 (no bonus stack with quick)', () => {
  assert.equal(computeRaceReward({ classIndex: 1, won: true, mode: 'quick', perfectRT: false }), 125); // 250 * 0.5
});

test('class B win pays 1500g', () => {
  assert.equal(computeRaceReward({ classIndex: 3, won: true, mode: 'career', perfectRT: false }), 1500);
});

test('class Pro win pays 10000g', () => {
  assert.equal(computeRaceReward({ classIndex: 5, won: true, mode: 'career', perfectRT: false }), 10000);
});
