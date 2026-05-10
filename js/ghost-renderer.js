import { GHOST_FLOATS_PER_SAMPLE, GHOST_SAMPLE_HZ, FINISH_LINE_M } from './constants.js';

/**
 * Compute when the recorded ghost crossed the finish line, in seconds since
 * the green light. Returns null when the ghost never crossed (which can
 * happen for a blown / DNF run). Used by RotW to set the opponent's
 * finishTimeS exactly to the ghost's recorded time, so "did you beat it?"
 * is decided by the ghost's actual run instead of the local AI's physics.
 */
export function computeGhostFinishTime(ghostFloats) {
  if (!ghostFloats || ghostFloats.length < GHOST_FLOATS_PER_SAMPLE * 2) return null;
  const fps = GHOST_FLOATS_PER_SAMPLE;
  const sampleCount = ghostFloats.length / fps;
  for (let i = 1; i < sampleCount; i++) {
    const cur = ghostFloats[i * fps];
    if (cur <= -FINISH_LINE_M) {
      const prev = ghostFloats[(i - 1) * fps];
      const denom = cur - prev;
      // Linear-interpolate the exact crossing fraction within this sample.
      const f = denom !== 0 ? (-FINISH_LINE_M - prev) / denom : 0;
      return ((i - 1) + f) / GHOST_SAMPLE_HZ;
    }
  }
  return null;
}

/**
 * Drive a translucent third-car mesh from a recorded ghost buffer.
 * Caller supplies `mesh` (a THREE.Mesh or Group reused across races) and
 * `ghostFloats` (Float32Array of [worldZ, rpm, gear, ...]). Each frame call
 * updateGhost(time) and the mesh's z position is lerped between adjacent
 * samples.
 */
export function createGhostPlayer(mesh, ghostFloats) {
  if (!ghostFloats || ghostFloats.length < GHOST_FLOATS_PER_SAMPLE * 2) {
    return { active: false, update: () => {} };
  }
  const sampleCount = ghostFloats.length / GHOST_FLOATS_PER_SAMPLE;
  const dtSample = 1 / GHOST_SAMPLE_HZ;
  return {
    active: true,
    update(time) {
      // Find sample bracket
      const idxF = time / dtSample;
      let i0 = Math.floor(idxF);
      if (i0 < 0) i0 = 0;
      if (i0 >= sampleCount - 1) i0 = sampleCount - 2;
      const f = idxF - i0;
      const a = ghostFloats[i0 * GHOST_FLOATS_PER_SAMPLE + 0];
      const b = ghostFloats[(i0 + 1) * GHOST_FLOATS_PER_SAMPLE + 0];
      const z = a + (b - a) * Math.max(0, Math.min(1, f));
      mesh.position.z = z;
    },
    setMeshVisible(v) { if (mesh) mesh.visible = !!v; },
  };
}

/**
 * Build a translucent ghost car mesh that mirrors opponent body geometry.
 * Caller passes the THREE namespace and a base-color hex.
 */
export function buildGhostMesh(T, opponentBodyGeometry, color = 0xffffff) {
  const mat = new T.MeshBasicMaterial({ color, transparent: true, opacity: 0.45 });
  const mesh = new T.Mesh(opponentBodyGeometry, mat);
  mesh.visible = false; // hidden until activated
  return mesh;
}
