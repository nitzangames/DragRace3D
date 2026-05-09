import { MASTER_VOLUME_DEFAULT, ENGINE_BASE_FREQ_HZ } from './constants.js';

let _ctx = null;
let _masterGain = null;
let _muted = false;
let _volume = MASTER_VOLUME_DEFAULT;
let _ctxFactory = null;
let _engine = null;

/** Test hook: inject a mock AudioContext factory before initAudio. */
export function _setAudioContextFactory(fn) { _ctxFactory = fn; _ctx = null; _masterGain = null; _engine = null; }

function defaultFactory() {
  if (typeof window === 'undefined') return null;
  const Ctor = window.AudioContext || window.webkitAudioContext;
  return Ctor ? new Ctor() : null;
}

export async function initAudio() {
  if (_ctx) return;
  const factory = _ctxFactory || defaultFactory;
  const ctx = factory();
  if (!ctx) return; // No audio support — no-op
  _ctx = ctx;
  _masterGain = ctx.createGain();
  _masterGain.gain.value = _muted ? 0 : _volume;
  _masterGain.connect(ctx.destination);
  if (ctx.state === 'suspended' && ctx.resume) {
    try { await ctx.resume(); } catch (_) { /* user-gesture-required */ }
  }
}

export function getAudioState() {
  return { context: _ctx, masterGain: _masterGain, muted: _muted, volume: _volume, engine: _engine };
}

export function setMuted(muted) {
  _muted = !!muted;
  if (_masterGain) _masterGain.gain.value = _muted ? 0 : _volume;
}

export function setVolume(v) {
  _volume = Math.max(0, Math.min(1, v));
  if (_masterGain && !_muted) _masterGain.gain.value = _volume;
}

export async function suspendAudio() {
  if (_ctx && _ctx.suspend) await _ctx.suspend();
}

export async function resumeAudio() {
  if (_ctx && _ctx.resume) await _ctx.resume();
}

/** Start a continuous engine drone for a given car. Idempotent: replaces prior. */
export function startEngine(car) {
  if (!_ctx || !_masterGain) return;
  if (_engine) stopEngine();
  const sawOsc = _ctx.createOscillator();
  const subOsc = _ctx.createOscillator();
  const filter = _ctx.createBiquadFilter();
  const gain   = _ctx.createGain();
  sawOsc.type = 'sawtooth';
  subOsc.type = 'square';
  subOsc.detune.setValueAtTime((car.audio && car.audio.subDetune) || -1200, _ctx.currentTime);
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime((car.audio && car.audio.filterCutoff) || 1400, _ctx.currentTime);
  filter.Q.value = 0.7;
  gain.gain.value = 0;
  sawOsc.connect(filter);
  subOsc.connect(filter);
  filter.connect(gain);
  gain.connect(_masterGain);
  sawOsc.start(_ctx.currentTime);
  subOsc.start(_ctx.currentTime);
  _engine = { sawOsc, subOsc, filter, gain, car };
}

/**
 * Update engine pitch + gain based on RPM and throttle (0..1).
 * Pitch = base × (rpm/idleRpm). Gain = small idle hum + scales with rpm and throttle.
 */
export function updateEngine(rpm, throttle) {
  if (!_engine || !_ctx) return;
  const car = _engine.car;
  const rpmFrac = (rpm - car.idleRpm) / Math.max(1, car.redlineRpm - car.idleRpm); // 0..1
  const freq = ENGINE_BASE_FREQ_HZ * (rpm / Math.max(1, car.idleRpm));
  const t = _ctx.currentTime;
  _engine.sawOsc.frequency.setValueAtTime(freq, t);
  _engine.subOsc.frequency.setValueAtTime(freq * 0.5, t);
  // Gain: 0.06 idle hum + 0.30 × rpmFrac × (0.4 + 0.6 × throttle), clamped 0..0.6
  const tCl = Math.max(0, Math.min(1, throttle));
  let g = 0.06 + 0.30 * Math.max(0, Math.min(1, rpmFrac)) * (0.4 + 0.6 * tCl);
  if (g > 0.6) g = 0.6;
  _engine.gain.gain.setValueAtTime(g, t);
}

export function stopEngine() {
  if (!_engine) return;
  try { _engine.sawOsc.stop(); _engine.subOsc.stop(); } catch (_) {}
  try {
    _engine.sawOsc.disconnect(); _engine.subOsc.disconnect();
    _engine.filter.disconnect(); _engine.gain.disconnect();
  } catch (_) {}
  _engine = null;
}

function _noiseBuffer(ctx, durationS) {
  const sr = ctx.sampleRate || 48000;
  const len = Math.floor(sr * durationS);
  const buf = ctx.createBuffer(1, len, sr);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  return buf;
}

function _envelopedNoise(ctx, dest, { dur = 0.10, peak = 0.5, freq = 600, q = 4 } = {}) {
  const src = ctx.createBufferSource();
  src.buffer = _noiseBuffer(ctx, dur);
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass'; bp.frequency.setValueAtTime(freq, ctx.currentTime); bp.Q.value = q;
  const g = ctx.createGain();
  const t = ctx.currentTime;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(peak, t + 0.005);
  g.gain.linearRampToValueAtTime(0, t + dur);
  src.connect(bp); bp.connect(g); g.connect(dest);
  src.start(t); src.stop(t + dur + 0.05);
  return { src, bp, g };
}

/** Brief broadband chunk for an upshift "clunk". */
export function playShift() {
  if (!_ctx || !_masterGain) return null;
  return _envelopedNoise(_ctx, _masterGain, { dur: 0.09, peak: 0.35, freq: 700, q: 6 });
}

/** Low-frequency rumble + noise sweep for engine blow. */
export function playBlow() {
  if (!_ctx || !_masterGain) return null;
  // Low-freq sine sweep
  const osc = _ctx.createOscillator(); osc.type = 'sine';
  const og  = _ctx.createGain();
  const t = _ctx.currentTime;
  osc.frequency.setValueAtTime(180, t); osc.frequency.linearRampToValueAtTime(40, t + 0.6);
  og.gain.setValueAtTime(0, t); og.gain.linearRampToValueAtTime(0.5, t + 0.02); og.gain.linearRampToValueAtTime(0, t + 0.6);
  osc.connect(og); og.connect(_masterGain);
  osc.start(t); osc.stop(t + 0.7);
  // Noise burst on top
  _envelopedNoise(_ctx, _masterGain, { dur: 0.5, peak: 0.4, freq: 320, q: 2 });
  return true;
}

/** Short sine pip for christmas-tree amber. */
export function playTreeBeep() {
  if (!_ctx || !_masterGain) return null;
  const osc = _ctx.createOscillator(); osc.type = 'sine';
  const g = _ctx.createGain();
  const t = _ctx.currentTime;
  osc.frequency.setValueAtTime(880, t);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(0.25, t + 0.005);
  g.gain.linearRampToValueAtTime(0, t + 0.10);
  osc.connect(g); g.connect(_masterGain);
  osc.start(t); osc.stop(t + 0.12);
  return true;
}

/** Distinct higher-pitched, longer beep for the green light — gives the
 *  player an unambiguous "GO" cue separate from the amber count-down. */
export function playGreenBeep() {
  if (!_ctx || !_masterGain) return null;
  const osc = _ctx.createOscillator(); osc.type = 'sine';
  const g = _ctx.createGain();
  const t = _ctx.currentTime;
  osc.frequency.setValueAtTime(1320, t); // perfect-fifth above the amber tone
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(0.32, t + 0.005);
  g.gain.linearRampToValueAtTime(0, t + 0.22);
  osc.connect(g); g.connect(_masterGain);
  osc.start(t); osc.stop(t + 0.24);
  return true;
}

/** Quick crunch for at-limiter tick. */
export function playLimiterTick() {
  if (!_ctx || !_masterGain) return null;
  return _envelopedNoise(_ctx, _masterGain, { dur: 0.04, peak: 0.20, freq: 1800, q: 8 });
}
