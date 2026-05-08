import { balance } from './balance.js';
import { CLASS_NAMES } from './constants.js';
import { formatGold } from './career-flow.js';

export function renderGarage(careerState, onCarPick) {
  document.getElementById('garage-gold').textContent = formatGold(careerState.gold) + 'g';
  const list = document.getElementById('garage-list');
  list.innerHTML = '';
  for (const owned of careerState.ownedCars) {
    const car = balance.cars.find(c => c.id === owned.carId);
    const tile = document.createElement('div');
    const isCurrent = careerState.currentCarId === owned.carId;
    tile.className = 'car-tile' + (isCurrent ? ' affordable' : '');
    tile.innerHTML = `
      <h3>${car.name}${isCurrent ? '  ✓' : ''}</h3>
      <div class="stats">CLASS ${CLASS_NAMES[car.classIndex]} · ${car.archetype}</div>
      <div class="stats">Engine T${owned.parts.engine} · Turbo T${owned.parts.turbo} · Trans T${owned.parts.transmission} · Tires T${owned.parts.tires} · Weight T${owned.parts.weight}</div>
    `;
    tile.addEventListener('click', () => onCarPick(owned.carId));
    list.appendChild(tile);
  }
}
