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

  // Opponent races the SAME car as the player but with a parts loadout that
  // scales with classWins. Race 1 (0 wins) → AI all stock — pure RT/shift
  // match. Race 2 (1 win) → AI has 1 mod. Race N → AI has N-1 mods. The
  // player must keep their car upgraded one mod ahead to stay competitive.
  // This keeps every race winnable but makes upgrades feel essential.
  const opponentBase = playerBase;
  const opponentParts = aiPartsForWins(careerState.classWins);
  const opponentWithParts = applyPartsToCar(opponentBase, opponentParts, balance.parts);
  const opponentFinal = applyTuningToCar(opponentWithParts, balance.defaultTune(opponentBase));

  return { ...balance, cars: [playerFinal, opponentFinal] };
}

/**
 * Distribute `wins` "mod points" across the AI's 5 part slots. Adds tier 1 to
 * each slot in order before bumping any to tier 2, etc. Caps at the highest
 * tier each slot allows (weight has 4 tiers; others 5).
 */
function aiPartsForWins(wins) {
  const slots = ['engine', 'tires', 'weight', 'turbo', 'transmission'];
  const parts = { engine: 0, turbo: 0, transmission: 0, tires: 0, weight: 0 };
  let remaining = wins;
  let tier = 1;
  while (remaining > 0 && tier <= 4) {
    for (const slot of slots) {
      if (remaining <= 0) break;
      const maxTier = (slot === 'weight') ? 3 : 4;
      if (parts[slot] < tier && parts[slot] < maxTier) {
        parts[slot] = tier;
        remaining--;
      }
    }
    tier++;
  }
  return parts;
}
