import { buildClassicEnv, updateTreeFromGameData } from './env-builder.js';
import { buildCar } from './car-models.js';
import { initEffects } from './effects.js';
import { NUM_CARS } from './constants.js';

/** Build the race scene (classic strip + 2 cars + effect pools). Returns { scene, cars, env }. */
export function buildRaceScene(balance) {
  const T = window.THREE;
  const scene = new T.Scene();
  const env = buildClassicEnv(scene);
  const cars = [];
  for (let i = 0; i < NUM_CARS; i++) {
    const car = buildCar(balance.cars[i].archetype, balance.cars[i].color1, balance.cars[i].color2);
    scene.add(car);
    cars.push(car);
  }
  initEffects(scene);
  return { scene, cars, env };
}

/**
 * Pure-read frame draw. Reads gameData; never mutates it.
 * Mutates THREE objects' positions only.
 */
export function renderFrame(renderer, scene, camera, cars, env, gameData) {
  for (let i = 0; i < NUM_CARS; i++) {
    cars[i].position.set(gameData.posX[i], 0, gameData.posZ[i]);
  }
  updateTreeFromGameData(env, gameData);
  renderer.render(scene, camera);
}
