import { CLASS_WINS_REQUIRED, NUM_CLASSES, CLASS_ENV_TABLE, ENV_UNLOCK_CLASS } from './constants.js';

const STARTING_GOLD = 2700;  // covers any E-class car (max price 2700g) so the
                             // first-car pick is a real choice: spend it all
                             // on the top E or grab the cheap one and start
                             // upgrading.

/** Create an initial career state. */
export function newCareer() {
  return {
    version: 1,
    classIndex: 0,
    classWins: 0,
    gold: STARTING_GOLD,
    ownedCars: [],     // [{ carId, parts, tune, paint }]
    currentCarId: null,
    nbucks: 0,
    // Bleachers is the only class-0 starter; higher-class tracks unlock
    // via recordWin / class advance. Amphitheater is the championship
    // venue and is intentionally the very last unlock (class Pro).
    unlockedEnvs: ['bleachers'],
    audio: { muted: false, volume: 0.7 },
    haptics: { enabled: true },
    shadows: { enabled: true },
    // First-race tutorial overlay shows on the very first career race; flips
    // true the moment the player dismisses it.
    tutorialDone: false,
  };
}

/** Returns NEW state with the car added. If first car, set as current. */
export function addOwnedCar(state, carInstance) {
  const ownedCars = [...state.ownedCars, carInstance];
  return {
    ...state,
    ownedCars,
    currentCarId: state.currentCarId || carInstance.carId,
  };
}

/** Returns NEW state with car removed; promotes another car to current if needed. */
export function removeOwnedCar(state, carId) {
  const ownedCars = state.ownedCars.filter(c => c.carId !== carId);
  let currentCarId = state.currentCarId;
  if (currentCarId === carId) {
    currentCarId = ownedCars.length > 0 ? ownedCars[0].carId : null;
  }
  return { ...state, ownedCars, currentCarId };
}

/** Returns NEW state with currentCarId set (must be in ownedCars). */
export function setCurrentCar(state, carId) {
  if (!state.ownedCars.some(c => c.carId === carId)) {
    throw new Error('cannot set current to unowned car: ' + carId);
  }
  return { ...state, currentCarId: carId };
}

/**
 * Record a win in the current class. Awards gold. If classWins exceeds
 * threshold AFTER this win, advance to next class and reset classWins to 1.
 * On class advance, unlock the env for the new class.
 */
export function recordWin(state, { gold }) {
  const newWins = state.classWins + 1;
  let classIndex = state.classIndex;
  let classWins = newWins;
  let unlockedEnvs = state.unlockedEnvs;
  if (newWins > CLASS_WINS_REQUIRED) {
    classIndex = Math.min(NUM_CLASSES - 1, classIndex + 1);
    classWins = 1;
    // Unlock the env associated with the new class (idempotent if already unlocked)
    for (const [envId, unlockAtClass] of Object.entries(ENV_UNLOCK_CLASS)) {
      if (classIndex >= unlockAtClass && !unlockedEnvs.includes(envId)) {
        unlockedEnvs = [...unlockedEnvs, envId];
      }
    }
  }
  return {
    ...state,
    classIndex,
    classWins,
    gold: state.gold + gold,
    unlockedEnvs,
  };
}

export function recordLoss(state, { gold }) {
  return { ...state, gold: state.gold + gold };
}

export function addGold(state, n) {
  return { ...state, gold: state.gold + n };
}

export function spendGold(state, n) {
  if (state.gold < n) throw new Error('insufficient gold');
  return { ...state, gold: state.gold - n };
}

export function isClassComplete(state) {
  return state.classWins >= CLASS_WINS_REQUIRED;
}

export function getCurrentClassWins(state) {
  return state.classWins;
}

export function addNbucks(state, n) {
  return { ...state, nbucks: state.nbucks + n };
}

export function spendNbucks(state, n) {
  if (state.nbucks < n) throw new Error('insufficient nbucks');
  return { ...state, nbucks: state.nbucks - n };
}

/** Add envId to unlockedEnvs if absent. Idempotent. */
export function unlockEnv(state, envId) {
  if (state.unlockedEnvs.includes(envId)) return state;
  return { ...state, unlockedEnvs: [...state.unlockedEnvs, envId] };
}
