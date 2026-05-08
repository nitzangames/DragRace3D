import { balance } from './balance.js';
import { CLASS_NAMES, NUM_CLASSES } from './constants.js';
import { formatGold } from './career-flow.js';

export function renderBuyShop(careerState, onBuy) {
  document.getElementById('buyshop-gold').textContent = formatGold(careerState.gold) + 'g';

  const tabBar = document.getElementById('buyshop-class-tabs');
  tabBar.innerHTML = '';

  for (let cls = 0; cls < NUM_CLASSES; cls++) {
    const btn = document.createElement('button');
    btn.className = 'tab' + (cls === careerState.classIndex ? ' active' : '');
    btn.textContent = CLASS_NAMES[cls];
    btn.dataset.cls = cls;
    btn.addEventListener('click', () => switchClass(cls));
    tabBar.appendChild(btn);
  }

  function switchClass(cls) {
    document.querySelectorAll('#buyshop-class-tabs .tab').forEach(b => {
      b.classList.toggle('active', +b.dataset.cls === cls);
    });
    renderGrid(cls);
  }

  function renderGrid(cls) {
    const grid = document.getElementById('buyshop-grid');
    grid.innerHTML = '';
    const ownedIds = new Set(careerState.ownedCars.map(o => o.carId));
    const cars = balance.cars.filter(c => c.classIndex === cls);
    for (const car of cars) {
      const owned = ownedIds.has(car.id);
      const affordable = !owned && careerState.gold >= car.price;
      const tile = document.createElement('div');
      tile.className = 'car-tile' + (affordable ? ' affordable' : '') + (!affordable ? ' unaffordable' : '');
      tile.innerHTML = `
        <h3>${car.name}${owned ? '  (owned)' : ''}</h3>
        <div class="stats">${car.archetype} · ${car.torquePeakNm}Nm · ${car.mass}kg</div>
        <div class="price">${formatGold(car.price)}g</div>
      `;
      if (affordable) tile.addEventListener('click', () => onBuy(car.id));
      grid.appendChild(tile);
    }
  }

  switchClass(careerState.classIndex);
}
