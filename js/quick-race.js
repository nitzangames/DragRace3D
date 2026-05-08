import { balance } from './balance.js';
import { CLASS_NAMES, NUM_CLASSES } from './constants.js';

export function renderQuickRace(onPick) {
  const tabBar = document.getElementById('quickrace-class-tabs');
  tabBar.innerHTML = '';

  function switchClass(cls) {
    document.querySelectorAll('#quickrace-class-tabs .tab').forEach(b => {
      b.classList.toggle('active', +b.dataset.cls === cls);
    });
    renderGrid(cls);
  }
  function renderGrid(cls) {
    const grid = document.getElementById('quickrace-grid');
    grid.innerHTML = '';
    for (const car of balance.cars.filter(c => c.classIndex === cls)) {
      const tile = document.createElement('div');
      tile.className = 'car-tile affordable';
      tile.innerHTML = `<h3>${car.name}</h3><div class="stats">${car.archetype} · ${car.torquePeakNm}Nm</div>`;
      tile.addEventListener('click', () => onPick(car.id));
      grid.appendChild(tile);
    }
  }
  for (let cls = 0; cls < NUM_CLASSES; cls++) {
    const btn = document.createElement('button');
    btn.className = 'tab' + (cls === 0 ? ' active' : '');
    btn.textContent = CLASS_NAMES[cls];
    btn.dataset.cls = cls;
    btn.addEventListener('click', () => switchClass(cls));
    tabBar.appendChild(btn);
  }
  switchClass(0);
}

export function buildQuickRaceBalance(playerCarId, seed) {
  const player = balance.cars.find(c => c.id === playerCarId);
  const opponentCandidates = balance.cars.filter(c => c.classIndex === player.classIndex && c.id !== player.id);
  const idx = ((seed >>> 0) * 2654435761) >>> 0;
  const opponent = opponentCandidates[idx % opponentCandidates.length];
  return { ...balance, cars: [player, opponent] };
}
