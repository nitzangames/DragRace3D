import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGhostRecorder } from '../js/ghost-recorder.js';
import { GHOST_SAMPLE_HZ, GHOST_DURATION_S, GHOST_FLOATS_PER_SAMPLE } from '../js/constants.js';

test('createGhostRecorder pre-allocates buffer of expected size', () => {
  const r = createGhostRecorder();
  const expectedSamples = GHOST_SAMPLE_HZ * GHOST_DURATION_S;
  assert.equal(r.buf.length, expectedSamples * GHOST_FLOATS_PER_SAMPLE);
  assert.equal(r.sampleCount, 0);
});

test('start resets sampleCount and lastSampleTime', () => {
  const r = createGhostRecorder();
  r.sampleCount = 5; r.lastSampleTime = 99;
  r.start();
  assert.equal(r.sampleCount, 0);
  assert.equal(r.lastSampleTime, 0);
});

test('tick samples at GHOST_SAMPLE_HZ; ignores faster updates', () => {
  const r = createGhostRecorder();
  r.start();
  const dtFrame = 1 / 60; // 60 Hz frames
  // Run 1 second of frames; should yield ~30 samples (sample rate 30Hz)
  for (let t = 0; t < 1.0; t += dtFrame) r.tick(t, dtFrame, -t * 50, 4000, 2);
  assert.ok(r.sampleCount >= 29 && r.sampleCount <= 31, `expected ~30 samples, got ${r.sampleCount}`);
});

test('tick stores [worldZ, rpm, gear] per sample', () => {
  const r = createGhostRecorder();
  r.start();
  // First tick at t=0 always samples
  r.tick(0, 1/60, -10, 5000, 3);
  assert.equal(r.buf[0], -10);
  assert.equal(r.buf[1], 5000);
  assert.equal(r.buf[2], 3);
  assert.equal(r.sampleCount, 1);
});

test('tick does not exceed buffer bounds (capped at GHOST_DURATION_S)', () => {
  const r = createGhostRecorder();
  r.start();
  const cap = GHOST_SAMPLE_HZ * GHOST_DURATION_S;
  // Run far longer than cap
  for (let i = 0; i < cap + 50; i++) {
    const t = i / GHOST_SAMPLE_HZ;
    r.tick(t, 1 / GHOST_SAMPLE_HZ, -t, 4000, 2);
  }
  assert.equal(r.sampleCount, cap);
});

test('finalize returns a Uint8Array containing only the recorded samples', () => {
  const r = createGhostRecorder();
  r.start();
  r.tick(0, 1/60, -10, 5000, 3);
  r.tick(1/30, 1/60, -20, 6000, 4);
  const bytes = r.finalize();
  // 2 samples × 3 floats × 4 bytes = 24 bytes
  assert.equal(bytes.byteLength, 24);
  // Decode back: first sample worldZ
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  assert.equal(view.getFloat32(0, true), -10);
  assert.equal(view.getFloat32(4, true), 5000);
  assert.equal(view.getFloat32(8, true), 3);
});
