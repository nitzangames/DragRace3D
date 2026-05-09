import { balance } from './balance.js';
import { CLASS_NAMES, NUM_CLASSES, ENV_PRESET_IDS, ENV_UNLOCK_CLASS } from './constants.js';
import { pickRandomPaint } from './paint-ui.js';

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
  // Same car for both — pure skill match (RT + shift timing). Picking
  // a different same-class opponent meant the player on the cheapest car
  // raced one of the more expensive (objectively faster) siblings, which
  // felt unfair.
  const opponent = { ...player };
  const oppPaint = pickRandomPaint(seed, player.color1);
  opponent.color1 = oppPaint.primary;
  opponent.color2 = oppPaint.secondary;
  return { ...balance, cars: [player, opponent] };
}

/**
 * Render the track-picker grid. Calls onPick(envId) when player picks an
 * unlocked track. Disabled tiles for locked tracks (informative).
 */
export function renderTrackPicker(careerState, onPick) {
  const grid = document.getElementById('quick-track-grid');
  if (!grid) return;
  grid.innerHTML = '';
  for (const envId of ENV_PRESET_IDS) {
    const unlocked = careerState && careerState.unlockedEnvs.includes(envId);
    const tile = document.createElement('button');
    tile.className = 'track-tile ' + (unlocked ? 'unlocked' : 'locked');
    tile.disabled = !unlocked;
    const unlockClass = ENV_UNLOCK_CLASS[envId];
    const unlockNote = unlocked
      ? '✓ unlocked'
      : `unlock at class ${['E','D','C','B','A','Pro'][unlockClass]}`;
    tile.innerHTML = `
      <h3>${envId.toUpperCase()}</h3>
      <div class="meta">${unlockNote}</div>
    `;
    if (unlocked) tile.addEventListener('click', () => onPick(envId));
    grid.appendChild(tile);
  }
}
