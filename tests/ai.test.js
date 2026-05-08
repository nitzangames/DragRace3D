import { test } from 'node:test';
import assert from 'node:assert/strict';
import { aiSample } from '../js/ai.js';
import { balance } from '../js/balance.js';

test('aiSample: same seed produces same outputs', () => {
  const a = aiSample(1, 0, 12345, balance);
  const b = aiSample(1, 0, 12345, balance);
  assert.equal(a.rt, b.rt);
  assert.deepEqual(a.shiftAtRpm, b.shiftAtRpm);
});

test('aiSample: different seeds produce different outputs', () => {
  const a = aiSample(1, 0, 1, balance);
  const b = aiSample(1, 0, 2, balance);
  assert.notEqual(a.rt, b.rt);
});

test('aiSample: rt is non-negative and within plausible range', () => {
  for (let s = 1; s < 50; s++) {
    const a = aiSample(1, 0, s, balance);
    assert.ok(a.rt >= 0 && a.rt < 1.5, `rt out of range for seed ${s}: ${a.rt}`);
  }
});

test('aiSample: produces 3 shift target RPMs (shifts 1->2, 2->3, 3->4)', () => {
  const a = aiSample(1, 0, 7, balance);
  assert.equal(a.shiftAtRpm.length, 3);
  for (const rpm of a.shiftAtRpm) {
    assert.ok(rpm > 0 && rpm < 10000);
  }
});
