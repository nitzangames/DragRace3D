import { GHOST_FLOATS_PER_SAMPLE, GHOST_SAMPLE_HZ } from './constants.js';

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
