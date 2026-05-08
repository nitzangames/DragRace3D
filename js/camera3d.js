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

/** Position the chase camera given player car's current Z. */
export function updateChaseCamera(cam, gameData) {
  const T = window.THREE;
  const playerZ = gameData.posZ[PLAYER_CAR_IDX];
  // Raised chase: camera sits a bit RIGHT of the player lane and well behind,
  // looking toward a point LEFT of center so both cars fit: player on the
  // right of frame, opponent (in the -X lane) clearly visible on the left.
  cam.position.set(LANE_OFFSET_X + 1.0, 2.8, playerZ + 9.0);
  if (!cam.userData._lookAt) cam.userData._lookAt = new T.Vector3();
  cam.userData._lookAt.set(-2.5, 1.0, playerZ - 18);
  cam.lookAt(cam.userData._lookAt);
}
