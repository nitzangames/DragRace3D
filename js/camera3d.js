/* Raised chase camera that follows the player car along the strip.
 * Plan-1: chase only. Cockpit/side/cinematic deferred to v2.
 *
 * Convention: cars travel in -Z. Camera trails behind in +Z.
 */

import { LANE_OFFSET_X, PLAYER_CAR_IDX } from './constants.js';

export function createChaseCamera(canvas) {
  const T = window.THREE;
  const cam = new T.PerspectiveCamera(58, canvas.clientWidth / canvas.clientHeight, 0.1, 800);
  return cam;
}

/** Position the chase camera given player car's current Z. */
export function updateChaseCamera(cam, gameData) {
  const T = window.THREE;
  const playerZ = gameData.posZ[PLAYER_CAR_IDX];
  // raised chase: 6.5m behind, 2.4m up, look ~18m ahead at chest height
  cam.position.set(LANE_OFFSET_X, 2.4, playerZ + 6.5);
  if (!cam.userData._lookAt) cam.userData._lookAt = new T.Vector3();
  cam.userData._lookAt.set(LANE_OFFSET_X * 0.8, 1.0, playerZ - 18);
  cam.lookAt(cam.userData._lookAt);
}
