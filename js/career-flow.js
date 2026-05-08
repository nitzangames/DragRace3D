import { balance } from './balance.js';
import { CLASS_NAMES } from './constants.js';
import { applyPartsToCar } from './parts.js';
import { applyTuningToCar } from './tuning.js';
import { pickOpponentCarId } from './balance.js';

/**
 * Render the class-E car grid. Each tile is clickable iff
 * career.gold >= car.price. onPick(carId) is called when an affordable
 * tile is clicked.
 */
export function renderFirstCarGrid(parent, careerState, onPick) {
  parent.innerHTML = '';
  const classECars = balance.cars.filter(c => c.classIndex === 0);
  for (const car of classECars) {
    const tile = document.createElement('div');
    const affordable = careerState.gold >= car.price;
    tile.className = 'car-tile ' + (affordable ? 'affordable' : 'unaffordable');
    tile.innerHTML = `
      <h3>${car.name}</h3>
      <div class="stats">${car.archetype} · ${car.torquePeakNm}Nm @ ${car.torquePeakRpm}rpm · ${car.mass}kg</div>
      <div class="price">${formatGold(car.price)}g</div>
    `;
    if (affordable) {
      tile.addEventListener('click', () => onPick(car.id));
    }
    parent.appendChild(tile);
  }
}

export function formatGold(n) {
  return n.toLocaleString('en-US');
}

/** Build a default car instance for a given carId. */
export function buildOwnedCarInstance(carId) {
  const car = balance.cars.find(c => c.id === carId);
  return {
    carId,
    parts: { engine: 0, turbo: 0, transmission: 0, tires: 0, weight: 0 },
    tune: balance.defaultTune(car),
    paint: { primary: car.color1, secondary: car.color2, stripe: 'none' },
  };
}

export function renderCareerHome(careerState) {
  const ownedCar = careerState.ownedCars.find(c => c.carId === careerState.currentCarId);
  const car = ownedCar ? balance.cars.find(c => c.id === ownedCar.carId) : null;

  document.getElementById('career-class-text').textContent =
    'CLASS ' + CLASS_NAMES[careerState.classIndex];
  document.getElementById('career-wins').textContent =
    `${careerState.classWins} / 5`;
  document.getElementById('career-gold').textContent =
    formatGold(careerState.gold) + 'g';
  document.getElementById('career-currentcar').textContent =
    car ? car.name : '—';
}

/**
 * Construct the 2-car balance object the race-physics expects, given
 * the career state and a seed for opponent selection.
 */
export function buildRaceBalance(careerState, seed) {
  const ownedCar = careerState.ownedCars.find(c => c.carId === careerState.currentCarId);
  const playerBase = balance.cars.find(c => c.id === ownedCar.carId);
  const playerWithParts = applyPartsToCar(playerBase, ownedCar.parts, balance.parts);
  const playerFinal = applyTuningToCar(playerWithParts, ownedCar.tune);
  playerFinal.color1 = ownedCar.paint.primary;
  playerFinal.color2 = ownedCar.paint.secondary;

  // Opponent races the SAME stock car as the player. This makes the early
  // career fair (skill match on RT + shift quality) and lets the player's
  // upgrades (engine/turbo/tires/weight) translate cleanly into a winning
  // edge as they progress. A different-car opponent disadvantaged the player
  // on day one because cheaper starter cars are objectively slower than
  // their pricier classmates. (The opponent picker is still exported for
  // future use — e.g. Plan-3 RotW or championship modes.)
  const opponentBase = playerBase;
  const opponentParts = { engine: 0, turbo: 0, transmission: 0, tires: 0, weight: 0 };
  const opponentWithParts = applyPartsToCar(opponentBase, opponentParts, balance.parts);
  const opponentFinal = applyTuningToCar(opponentWithParts, balance.defaultTune(opponentBase));

  return { ...balance, cars: [playerFinal, opponentFinal] };
}
