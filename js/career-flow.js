import { balance } from './balance.js';
import { CLASS_NAMES } from './constants.js';

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
