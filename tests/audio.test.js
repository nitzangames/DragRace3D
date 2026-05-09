import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initAudio, getAudioState, setMuted, setVolume, suspendAudio, resumeAudio, _setAudioContextFactory, startEngine, stopEngine, updateEngine } from '../js/audio.js';

// Lightweight WebAudio mock — captures construction calls and gain values.
function makeMockCtx() {
  const ctx = {
    state: 'suspended',
    currentTime: 0,
    destination: { __id: 'dest' },
    suspend: function() { this.state = 'suspended'; return Promise.resolve(); },
    resume:  function() { this.state = 'running';   return Promise.resolve(); },
    close:   function() { this.state = 'closed';    return Promise.resolve(); },
    createGain: function() {
      const node = {
        gain: { value: 1, setValueAtTime: function(v, t) { this.value = v; }, linearRampToValueAtTime: function(v, t) { this.value = v; } },
        connect: function(_) {},
        disconnect: function() {},
      };
      return node;
    },
    createOscillator: function() {
      const node = {
        type: 'sine', frequency: { value: 440, setValueAtTime: function(v, t) { this.value = v; }, linearRampToValueAtTime: function(v, t) { this.value = v; } },
        detune: { value: 0, setValueAtTime: function(v, t) { this.value = v; } },
        connect: function(_) {}, disconnect: function() {},
        start: function(_) {}, stop: function(_) {},
      };
      return node;
    },
    createBiquadFilter: function() {
      return {
        type: 'lowpass', frequency: { value: 1000, setValueAtTime: function(v, t) { this.value = v; } },
        Q: { value: 1 }, connect: function(_) {}, disconnect: function() {},
      };
    },
    createBufferSource: function() {
      return { buffer: null, connect: function(_) {}, disconnect: function() {}, start: function(_) {}, stop: function(_) {} };
    },
    createBuffer: function(_c, len, _sr) {
      return { length: len, getChannelData: () => new Float32Array(len) };
    },
  };
  return ctx;
}

test('initAudio is idempotent and creates context lazily', async () => {
  const ctx = makeMockCtx();
  _setAudioContextFactory(() => ctx);
  await initAudio();
  await initAudio();
  const s = getAudioState();
  assert.equal(s.context, ctx);
  assert.equal(s.context.state, 'running');
});

test('setMuted=true zeroes master gain; setMuted=false restores volume', async () => {
  const ctx = makeMockCtx();
  _setAudioContextFactory(() => ctx);
  await initAudio();
  setVolume(0.5);
  setMuted(true);
  assert.equal(getAudioState().masterGain.gain.value, 0);
  setMuted(false);
  assert.equal(getAudioState().masterGain.gain.value, 0.5);
});

test('setVolume clamps to [0,1]', async () => {
  const ctx = makeMockCtx();
  _setAudioContextFactory(() => ctx);
  await initAudio();
  setVolume(2.0);
  assert.equal(getAudioState().masterGain.gain.value, 1);
  setVolume(-1);
  assert.equal(getAudioState().masterGain.gain.value, 0);
});

test('suspend/resume toggles context state', async () => {
  const ctx = makeMockCtx();
  _setAudioContextFactory(() => ctx);
  await initAudio();
  await suspendAudio();
  assert.equal(ctx.state, 'suspended');
  await resumeAudio();
  assert.equal(ctx.state, 'running');
});

test('startEngine creates oscillators wired through filter to master', async () => {
  const ctx = makeMockCtx();
  _setAudioContextFactory(() => ctx);
  await initAudio();
  const car = { idleRpm: 800, redlineRpm: 7000 };
  startEngine(car);
  const s = getAudioState();
  assert.ok(s.engine, 'engine object should exist');
  assert.ok(s.engine.sawOsc, 'sawtooth oscillator');
  assert.ok(s.engine.subOsc, 'sub oscillator');
  assert.ok(s.engine.filter, 'biquad filter');
  assert.ok(s.engine.gain, 'gain node');
});

test('updateEngine maps rpm to frequency and gain', async () => {
  const ctx = makeMockCtx();
  _setAudioContextFactory(() => ctx);
  await initAudio();
  const car = { idleRpm: 800, redlineRpm: 7000 };
  startEngine(car);
  // At idle: gain low, freq base
  updateEngine(800, 0);
  const s1 = getAudioState();
  const idleGain = s1.engine.gain.gain.value;
  const idleFreq = s1.engine.sawOsc.frequency.value;
  // At redline with throttle: gain higher, freq higher
  updateEngine(7000, 1);
  const s2 = getAudioState();
  assert.ok(s2.engine.gain.gain.value > idleGain, 'gain rises with rpm+throttle');
  assert.ok(s2.engine.sawOsc.frequency.value > idleFreq, 'freq rises with rpm');
});

test('stopEngine disconnects and clears state', async () => {
  const ctx = makeMockCtx();
  _setAudioContextFactory(() => ctx);
  await initAudio();
  startEngine({ idleRpm: 800, redlineRpm: 7000 });
  stopEngine();
  assert.equal(getAudioState().engine, null);
});

import { playShift, playBlow, playTreeBeep, playLimiterTick } from '../js/audio.js';

test('playShift creates a one-shot chain (no throw, returns truthy)', async () => {
  const ctx = makeMockCtx();
  _setAudioContextFactory(() => ctx);
  await initAudio();
  const r = playShift();
  assert.ok(r); // returned the chain handle
});

test('playBlow / playTreeBeep / playLimiterTick are safe no-throws', async () => {
  const ctx = makeMockCtx();
  _setAudioContextFactory(() => ctx);
  await initAudio();
  playBlow(); playTreeBeep(); playLimiterTick();
  assert.ok(true);
});

test('one-shots no-op safely when audio not initialized', () => {
  _setAudioContextFactory(() => null);
  playShift();
  playBlow();
  playTreeBeep();
  playLimiterTick();
  assert.ok(true);
});
