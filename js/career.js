import { CLASS_WINS_REQUIRED, NUM_CLASSES } from './constants.js';

const STARTING_GOLD = 1500;  // enough to buy an E-class car

/** Create an initial career state. */
export function newCareer() {
  return {
    version: 1,
    classIndex: 0,
    classWins: 0,
    gold: STARTING_GOLD,
    ownedCars: [],     // [{ carId, parts, tune, paint }]
    currentCarId: null,
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
 */
export function recordWin(state, { gold }) {
  const newWins = state.classWins + 1;
  let classIndex = state.classIndex;
  let classWins = newWins;
  if (newWins > CLASS_WINS_REQUIRED) {
    classIndex = Math.min(NUM_CLASSES - 1, classIndex + 1);
    classWins = 1;
  }
  return {
    ...state,
    classIndex,
    classWins,
    gold: state.gold + gold,
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
