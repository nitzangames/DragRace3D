import { GHOST_SAMPLE_HZ, GHOST_DURATION_S, GHOST_FLOATS_PER_SAMPLE } from './constants.js';

/**
 * Pre-allocated 30 Hz sampler that records [worldZ, rpm, gear] for the
 * player's run. Buffer is sized once for the maximum race duration and
 * never resized. Caller drives via tick(t, dt, worldZ, rpm, gear).
 */
export function createGhostRecorder() {
  const samples = GHOST_SAMPLE_HZ * GHOST_DURATION_S;
  const buf = new Float32Array(samples * GHOST_FLOATS_PER_SAMPLE);
  return {
    buf,
    sampleCount: 0,
    lastSampleTime: 0,
    start() {
      this.sampleCount = 0;
      this.lastSampleTime = 0;
    },
    tick(t, _dt, worldZ, rpm, gear) {
      const cap = GHOST_SAMPLE_HZ * GHOST_DURATION_S;
      if (this.sampleCount >= cap) return;
      // Sample at t=0 always; afterward gate at 1/HZ intervals.
      if (this.sampleCount > 0 && (t - this.lastSampleTime) < (1 / GHOST_SAMPLE_HZ - 1e-6)) return;
      const i = this.sampleCount * GHOST_FLOATS_PER_SAMPLE;
      this.buf[i + 0] = worldZ;
      this.buf[i + 1] = rpm;
      this.buf[i + 2] = gear;
      this.sampleCount++;
      this.lastSampleTime = t;
    },
    /** Returns Uint8Array of recorded sample bytes (truncated to actual samples). */
    finalize() {
      const usedFloats = this.sampleCount * GHOST_FLOATS_PER_SAMPLE;
      const view = new Float32Array(this.buf.buffer, this.buf.byteOffset, usedFloats);
      // Copy into a fresh Uint8Array of exact byte length so the leaderboard
      // attachment isn't an over-sized view of the long-lived recorder buffer.
      const out = new Uint8Array(usedFloats * 4);
      out.set(new Uint8Array(view.buffer, view.byteOffset, view.byteLength));
      return out;
    },
  };
}

/** Decode bytes from a leaderboard attachment back into a Float32Array. */
export function decodeGhost(uint8) {
  if (!uint8 || uint8.byteLength === 0) return null;
  // Make a copy so the underlying buffer isn't tied to caller's lifetime.
  const copy = new Uint8Array(uint8);
  return new Float32Array(copy.buffer, copy.byteOffset, copy.byteLength / 4);
}
