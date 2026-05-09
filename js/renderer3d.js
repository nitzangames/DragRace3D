import { buildClassicEnv, updateTreeFromGameData } from './env-builder.js';
import { buildCar } from './car-models.js';
import { initEffects } from './effects.js';
import { NUM_CARS, LANE_OFFSET_X } from './constants.js';
import { buildGhostMesh } from './ghost-renderer.js';

/** Build the race scene (classic strip + 2 cars + effect pools). Returns { scene, cars, env }. */
export function buildRaceScene(balance, envId) {
  const T = window.THREE;
  const scene = new T.Scene();
  const env = buildClassicEnv(scene, envId);
  const { cars, ghostMesh } = rebuildCarsInScene(scene, balance, null, null);
  initEffects(scene);
  return { scene, cars, env, ghostMesh };
}

/**
 * Swap the player + opponent + ghost meshes in an existing scene without
 * touching the strip / lights / scenery. Disposes the previous cars'
 * geometries and materials before adding the new ones. Used by main.js
 * when it caches the race scene across races (huge win on mobile —
 * skips ~1000 mesh allocations per restart).
 *
 * Pass oldCars/oldGhostMesh = null on the very first call.
 */
export function rebuildCarsInScene(scene, balance, oldCars, oldGhostMesh) {
  const T = window.THREE;
  if (oldCars) {
    for (const c of oldCars) {
      scene.remove(c);
      c.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) {
          const ms = Array.isArray(o.material) ? o.material : [o.material];
          for (const m of ms) {
            if (m.map) m.map.dispose();
            m.dispose();
          }
        }
      });
    }
  }
  if (oldGhostMesh) {
    scene.remove(oldGhostMesh);
    if (oldGhostMesh.geometry) oldGhostMesh.geometry.dispose();
    if (oldGhostMesh.material) oldGhostMesh.material.dispose();
  }
  const cars = [];
  for (let i = 0; i < NUM_CARS; i++) {
    const cd = balance.cars[i];
    const car = buildCar(cd.archetype, cd.color1, cd.color2, cd.stripe);
    car.traverse((m) => { if (m.isMesh) m.castShadow = true; });
    scene.add(car);
    cars.push(car);
  }
  let ghostMesh = null;
  if (cars.length >= 2 && cars[1].children && cars[1].children[0] && cars[1].children[0].geometry) {
    ghostMesh = buildGhostMesh(T, cars[1].children[0].geometry);
    ghostMesh.position.x = -LANE_OFFSET_X;
    scene.add(ghostMesh);
  }
  return { cars, ghostMesh };
}

// Drift constants for the at-speed wobble. Cars sway gently side-to-side as
// if buffeted by wind; gives the visual a sense of motion that pure z-axis
// translation lacks. Visual only — gameData is not mutated.
const WOBBLE_AMP_X     = 0.10;   // peak side-to-side displacement (m)
const WOBBLE_FREQ_HZ_1 = 1.2;    // primary sway frequency
const WOBBLE_FREQ_HZ_2 = 0.4;    // slower modulating frequency for un-canned feel
const WOBBLE_SPEED_REF = 30;     // m/s at which wobble reaches full amplitude

/**
 * Pure-read frame draw. Reads gameData; never mutates it.
 * Mutates THREE objects' positions only. `dt` is the wall-clock seconds
 * since the previous renderFrame call; used to drive scenery animation
 * (e.g. chimney smoke) independently of the fixed physics step.
 */
export function renderFrame(renderer, scene, camera, cars, env, gameData, dt) {
  const t = gameData.raceTimeS;
  for (let i = 0; i < NUM_CARS; i++) {
    let wobbleX = 0;
    const v = gameData.velMs[i];
    if (v > 1) {
      // Per-car phase offset so player and opponent never sync up.
      const phase = i * 1.7;
      const w1 = Math.sin(t * 2 * Math.PI * WOBBLE_FREQ_HZ_1 + phase) * 0.65;
      const w2 = Math.sin(t * 2 * Math.PI * WOBBLE_FREQ_HZ_2 + phase * 1.3) * 0.35;
      const speedScale = Math.min(1, v / WOBBLE_SPEED_REF);
      wobbleX = (w1 + w2) * WOBBLE_AMP_X * speedScale;
    }
    cars[i].position.set(gameData.posX[i] + wobbleX, 0, gameData.posZ[i]);
    // Tiny body roll into the sway — kept subtle (was 0.4, halved to 0.2)
    // so the lateral position drift dominates the visual instead of the
    // car visibly leaning side-to-side.
    cars[i].rotation.z = -wobbleX * 0.2;
  }
  updateTreeFromGameData(env, gameData);
  if (env.sceneryTick && dt > 0) env.sceneryTick(dt);
  // Slide the sun's shadow target along with the player so the orthographic
  // shadow frustum keeps the action in view as the car runs down the strip.
  if (env.sun && env.sun.target) {
    env.sun.target.position.set(0, 0, gameData.posZ[0] - 30);
    env.sun.target.updateMatrixWorld();
    env.sun.position.set(60, 90, gameData.posZ[0] + 40);
  }
  renderer.render(scene, camera);
}
