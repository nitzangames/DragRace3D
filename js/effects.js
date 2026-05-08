/* Wheelspin VFX: smoke puffs from rear wheels + dark tire marks on the strip.
 * Pre-allocated InstancedMesh pools per platform GAME_DEV_NOTES rule —
 * no per-frame allocations.
 *
 * - Smoke spawned every slip frame and on each upshift (small burst).
 * - Tire marks spawned at the same moments, but stay on the ground until
 *   resetEffects().
 */

import { NUM_CARS } from './constants.js';

const SMOKE_POOL = 240;
const MARKS_POOL = 400;

// ---- Smoke per-particle state (TypedArrays) ----
const smokeActive     = new Uint8Array(SMOKE_POOL);
const smokeLife       = new Float32Array(SMOKE_POOL);
const smokeStartLife  = new Float32Array(SMOKE_POOL);
const smokePosX       = new Float32Array(SMOKE_POOL);
const smokePosY       = new Float32Array(SMOKE_POOL);
const smokePosZ       = new Float32Array(SMOKE_POOL);
const smokeVelX       = new Float32Array(SMOKE_POOL);
const smokeVelY       = new Float32Array(SMOKE_POOL);
const smokeVelZ       = new Float32Array(SMOKE_POOL);
const smokeMaxScale   = new Float32Array(SMOKE_POOL);
let smokeWriteIdx = 0;

// ---- Tire marks per-particle state ----
const marksActive = new Uint8Array(MARKS_POOL);
let marksWriteIdx = 0;

// ---- THREE objects (built once at init) ----
let smokeMesh = null;
let marksMesh = null;

// ---- Scratch (allocated once) ----
let _scratchMat = null;
let _scratchPos = null;
let _scratchScale = null;
let _scratchQuat = null;
let _hideMat = null;
let _markFlatQuat = null;

// Per-car bookkeeping for shift detection
const prevGear = new Uint8Array(NUM_CARS);

// Wheel positions (in scene-Z terms, relative to car center). Cars travel in
// scene -Z, so "behind the car" = scene +Z relative to the car. The drive
// wheels that leave smoke + marks are the ones at scene +Z. Hardcoded for
// the muscle/sport archetypes used in Plan-1.
const REAR_X = 0.97;       // lateral inset
const REAR_Y = 0.30;       // ground-level (slightly below tire center)
const REAR_Z = 1.6;        // scene +Z offset from car center

export function initEffects(scene) {
  const T = window.THREE;

  // ---- Smoke: low-poly sphere puffs ----
  const smokeGeo = new T.SphereGeometry(0.5, 8, 6);
  const smokeMat = new T.MeshLambertMaterial({
    color: 0xeeeeee,
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
  });
  smokeMesh = new T.InstancedMesh(smokeGeo, smokeMat, SMOKE_POOL);
  smokeMesh.frustumCulled = false;
  smokeMesh.count = SMOKE_POOL;
  scene.add(smokeMesh);

  // ---- Tire marks: thin dark plane lying flat on the strip ----
  // polygonOffset pushes the marks slightly toward the camera in depth so
  // they don't z-fight with the asphalt at y≈0. Higher opacity + pure black
  // so they read clearly on the dark-grey asphalt.
  const marksGeo = new T.PlaneGeometry(0.28, 0.9);
  const marksMat = new T.MeshBasicMaterial({
    color: 0x000000,
    transparent: true,
    opacity: 0.85,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -2,
  });
  marksMesh = new T.InstancedMesh(marksGeo, marksMat, MARKS_POOL);
  marksMesh.frustumCulled = false;
  marksMesh.count = MARKS_POOL;
  scene.add(marksMesh);

  _scratchMat = new T.Matrix4();
  _scratchPos = new T.Vector3();
  _scratchScale = new T.Vector3();
  _scratchQuat = new T.Quaternion();
  _hideMat = new T.Matrix4().makeScale(0, 0, 0);
  _markFlatQuat = new T.Quaternion().setFromEuler(new T.Euler(-Math.PI / 2, 0, 0));

  // Hide all instances initially
  for (let i = 0; i < SMOKE_POOL; i++) smokeMesh.setMatrixAt(i, _hideMat);
  for (let i = 0; i < MARKS_POOL; i++) marksMesh.setMatrixAt(i, _hideMat);
  smokeMesh.instanceMatrix.needsUpdate = true;
  marksMesh.instanceMatrix.needsUpdate = true;
}

/** Reset all VFX. Call when starting a new race. */
export function resetEffects() {
  if (!smokeMesh) return;
  for (let i = 0; i < SMOKE_POOL; i++) {
    smokeActive[i] = 0;
    smokeMesh.setMatrixAt(i, _hideMat);
  }
  for (let i = 0; i < MARKS_POOL; i++) {
    marksActive[i] = 0;
    marksMesh.setMatrixAt(i, _hideMat);
  }
  for (let i = 0; i < NUM_CARS; i++) prevGear[i] = 1;
  smokeMesh.instanceMatrix.needsUpdate = true;
  marksMesh.instanceMatrix.needsUpdate = true;
}

/** Tick particles + react to slip / shift events. Reads gameData; never mutates it. */
export function updateEffects(gameData, dt) {
  if (!smokeMesh) return;

  // Trigger spawns from gameData state
  for (let i = 0; i < NUM_CARS; i++) {
    const cx = gameData.posX[i];
    const cz = gameData.posZ[i];
    // Shift up burst
    if (gameData.gear[i] > prevGear[i]) {
      shiftBurst(cx, cz);
    }
    prevGear[i] = gameData.gear[i];
    // Continuous slip puff
    if (gameData.slip[i]) {
      slipPuff(cx, cz);
    }
  }

  // Tick smoke
  let smokeDirty = false;
  for (let i = 0; i < SMOKE_POOL; i++) {
    if (!smokeActive[i]) continue;
    smokeLife[i] -= dt;
    if (smokeLife[i] <= 0) {
      smokeActive[i] = 0;
      smokeMesh.setMatrixAt(i, _hideMat);
      smokeDirty = true;
      continue;
    }
    smokePosX[i] += smokeVelX[i] * dt;
    smokePosY[i] += smokeVelY[i] * dt;
    smokePosZ[i] += smokeVelZ[i] * dt;
    smokeVelY[i] += 0.6 * dt;            // mild rise
    smokeVelX[i] *= 1 - dt * 0.6;        // damp lateral
    smokeVelZ[i] *= 1 - dt * 0.4;
    // Scale curve: pop in fast, grow slowly, shrink at end (fakes fade)
    const lifeFrac = smokeLife[i] / smokeStartLife[i];  // 1.0 at spawn → 0
    const ageFrac = 1 - lifeFrac;                       // 0 at spawn → 1
    const popIn = Math.min(1, ageFrac / 0.12);
    const fadeOut = lifeFrac < 0.25 ? lifeFrac / 0.25 : 1;
    const s = smokeMaxScale[i] * (0.4 + ageFrac * 0.8) * popIn * fadeOut;
    _scratchPos.set(smokePosX[i], smokePosY[i], smokePosZ[i]);
    _scratchScale.set(s, s, s);
    _scratchQuat.identity();
    _scratchMat.compose(_scratchPos, _scratchQuat, _scratchScale);
    smokeMesh.setMatrixAt(i, _scratchMat);
    smokeDirty = true;
  }
  if (smokeDirty) smokeMesh.instanceMatrix.needsUpdate = true;
}

function spawnSmoke(x, y, z, vx, vy, vz, life, maxScale) {
  const i = smokeWriteIdx;
  smokeWriteIdx = (smokeWriteIdx + 1) % SMOKE_POOL;
  smokeActive[i] = 1;
  smokeStartLife[i] = life;
  smokeLife[i] = life;
  smokePosX[i] = x; smokePosY[i] = y; smokePosZ[i] = z;
  smokeVelX[i] = vx; smokeVelY[i] = vy; smokeVelZ[i] = vz;
  smokeMaxScale[i] = maxScale;
}

function spawnMark(x, z) {
  const i = marksWriteIdx;
  marksWriteIdx = (marksWriteIdx + 1) % MARKS_POOL;
  marksActive[i] = 1;
  _scratchPos.set(x, 0.03, z);  // 3cm above strip + polygonOffset to avoid z-fighting
  _scratchScale.set(1, 1, 1);
  _scratchMat.compose(_scratchPos, _markFlatQuat, _scratchScale);
  marksMesh.setMatrixAt(i, _scratchMat);
  marksMesh.instanceMatrix.needsUpdate = true;
}

// One small puff per frame at each rear wheel + tire marks
function slipPuff(carX, carZ) {
  for (const sx of [-1, 1]) {
    const x = carX + sx * REAR_X;
    const z = carZ + REAR_Z;  // scene +Z = behind the car in motion frame
    spawnSmoke(
      x, REAR_Y, z,
      (Math.random() - 0.5) * 1.2,   // small lateral
      0.4 + Math.random() * 0.4,     // up
      0.6 + Math.random() * 1.4,     // backward (cars travel -Z, so smoke drifts +Z relative to motion)
      1.4,
      0.85
    );
    spawnMark(x, z);
  }
}

// Bigger burst on each upshift
function shiftBurst(carX, carZ) {
  for (const sx of [-1, 1]) {
    const x = carX + sx * REAR_X;
    const z = carZ - REAR_Z;
    for (let p = 0; p < 5; p++) {
      spawnSmoke(
        x + (Math.random() - 0.5) * 0.4,
        REAR_Y + Math.random() * 0.2,
        z,
        (Math.random() - 0.5) * 2,
        0.6 + Math.random() * 0.8,
        1.0 + Math.random() * 2.5,
        1.6,
        1.1
      );
    }
    // Two marks per wheel for the shift bump
    spawnMark(x, z);
    spawnMark(x, z + 0.5);
  }
}
