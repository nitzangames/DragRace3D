/* Raised chase camera that follows the player car along the strip.
 * Plan-1: chase only. Cockpit/side/cinematic deferred to v2.
 *
 * Convention: cars travel in -Z. Camera trails behind in +Z.
 */

import { LANE_OFFSET_X, PLAYER_CAR_IDX } from './constants.js';

export function createChaseCamera(canvas) {
  const T = window.THREE;
  const cam = new T.PerspectiveCamera(65, canvas.clientWidth / canvas.clientHeight, 0.1, 800);
  return cam;
}

// Module-level effect state. Mutated in place each frame; never re-allocated.
const _shift = {
  shakeT: 0,      // seconds remaining of post-shift shake
  lagZ: 0,        // current extra trail-behind distance (smoothed toward target)
  lagTarget: 0,   // target the lagZ chases; set high on shift, then decays
};

const SHAKE_DURATION_S  = 0.22;
const SHAKE_AMP_M       = 0.18;  // peak random offset on x/y
const LAG_BURST_M       = 3.5;   // peak extra +Z (further behind)
const LAG_RISE_PER_S    = 15;    // how fast lagZ chases lagTarget (high → fast)
const LAG_DECAY_PER_S   = 1.75;  // how fast lagTarget decays back to 0

/** Trigger the post-shift camera jolt: a brief shake plus a smooth pull-
 *  back that rises in ~0.15s and decays back to the baseline over ~2s. */
export function triggerShiftJolt() {
  _shift.shakeT = SHAKE_DURATION_S;
  _shift.lagTarget = LAG_BURST_M;
}

/** Position the chase camera given player car's current Z. */
export function updateChaseCamera(cam, gameData, dt) {
  const T = window.THREE;
  const playerZ = gameData.posZ[PLAYER_CAR_IDX];
  const _dt = dt > 0 ? dt : 0;

  // Two-stage smoothing:
  //  - lagTarget decays exponentially toward 0 (the slow "catch-up" phase).
  //  - lagZ chases lagTarget with a much faster approach rate so the initial
  //    trigger reads as a quick-but-smooth pull-back (no one-frame snap).
  // Together: ~0.15s smooth rise to peak, ~2s smooth decay back to zero.
  _shift.lagTarget -= _shift.lagTarget * Math.min(1, _dt * LAG_DECAY_PER_S);
  if (_shift.lagTarget < 0.001) _shift.lagTarget = 0;
  const lagDelta = _shift.lagTarget - _shift.lagZ;
  _shift.lagZ += lagDelta * Math.min(1, _dt * LAG_RISE_PER_S);
  if (_shift.lagZ < 0.001 && _shift.lagTarget === 0) _shift.lagZ = 0;
  if (_shift.shakeT > 0) {
    _shift.shakeT -= _dt;
    if (_shift.shakeT < 0) _shift.shakeT = 0;
  }

  let posX = LANE_OFFSET_X + 1.0;
  let posY = 2.8;
  let posZ = playerZ + 9.0 + _shift.lagZ;

  if (_shift.shakeT > 0) {
    const tn = _shift.shakeT / SHAKE_DURATION_S; // 1 → 0
    const amp = SHAKE_AMP_M * tn;
    posX += (Math.random() - 0.5) * 2 * amp;
    posY += (Math.random() - 0.5) * 2 * amp;
  }

  // Raised chase: camera sits a bit RIGHT of the player lane and well behind,
  // looking toward a point LEFT of center so both cars fit: player on the
  // right of frame, opponent (in the -X lane) clearly visible on the left.
  cam.position.set(posX, posY, posZ);
  if (!cam.userData._lookAt) cam.userData._lookAt = new T.Vector3();
  cam.userData._lookAt.set(-2.5, 1.0, playerZ - 18);
  cam.lookAt(cam.userData._lookAt);
}
