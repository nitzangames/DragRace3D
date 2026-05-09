import { balance } from './balance.js';
import { CLASS_NAMES, CLASS_ENV_TABLE } from './constants.js';
import { applyPartsToCar } from './parts.js';
import { applyTuningToCar } from './tuning.js';
import { pickOpponentCarId } from './balance.js';
import { pickRandomPaint } from './paint-ui.js';
import { mountPaintPreview } from './paint-preview.js';

let _firstCarIdx = 0;

/**
 * Render the class-E first-car picker as a 3D carousel: one car at a time,
 * with prev/next arrows and a BUY button. Reuses the same preview machinery
 * the garage / buy-shop carousels use.
 */
export function renderFirstCarPicker(careerState, onPick) {
  const cars = balance.cars.filter(c => c.classIndex === 0);
  if (_firstCarIdx >= cars.length) _firstCarIdx = 0;
  _renderFirstCarCurrent(cars, careerState, onPick);
}

function _renderFirstCarCurrent(cars, careerState, onPick) {
  const car = cars[_firstCarIdx];
  const previewParent = document.getElementById('firstcar-preview');
  const info = document.getElementById('firstcar-info');
  const prevBtn = document.getElementById('firstcar-prev');
  const nextBtn = document.getElementById('firstcar-next');
  const buyBtn = document.getElementById('btn-firstcar-buy');

  // Preserve any existing canvas so mountPaintPreview's reuse path keeps
  // the WebGL context alive across cycle taps (mobile-Safari context cap).
  for (let i = previewParent.children.length - 1; i >= 0; i--) {
    const c = previewParent.children[i];
    if (c.tagName !== 'CANVAS') c.remove();
  }
  mountPaintPreview(previewParent, car.archetype, {
    primary: car.color1, secondary: car.color2, stripe: 'none',
  });

  const affordable = careerState.gold >= car.price;
  info.innerHTML = `
    <h3>${car.name}</h3>
    <div class="meta">${car.archetype} · ${car.torquePeakNm}Nm @ ${car.torquePeakRpm}rpm · ${car.mass}kg · ${_firstCarIdx + 1}/${cars.length}</div>
    <div class="meta" style="margin-top:6px;font-size:18px;color:#ffd14a;font-weight:700;">${formatGold(car.price)}g</div>
  `;

  const single = cars.length <= 1;
  prevBtn.disabled = single;
  nextBtn.disabled = single;
  prevBtn.onclick = () => {
    _firstCarIdx = (_firstCarIdx - 1 + cars.length) % cars.length;
    _renderFirstCarCurrent(cars, careerState, onPick);
  };
  nextBtn.onclick = () => {
    _firstCarIdx = (_firstCarIdx + 1) % cars.length;
    _renderFirstCarCurrent(cars, careerState, onPick);
  };

  if (affordable) {
    buyBtn.textContent = `BUY (${formatGold(car.price)}g)`;
    buyBtn.disabled = false;
  } else {
    buyBtn.textContent = `NEED ${formatGold(car.price - careerState.gold)}g MORE`;
    buyBtn.disabled = true;
  }
  buyBtn.onclick = () => {
    if (!affordable) return;
    onPick(car.id);
  };
}

export function resetFirstCarPicker() { _firstCarIdx = 0; }

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
  playerFinal.stripe = ownedCar.paint.stripe || 'none';

  // Opponent races the SAME car as the player but with a parts loadout that
  // scales with classWins. Race 1 (0 wins) → AI all stock — pure RT/shift
  // match. Race 2 (1 win) → AI has 1 mod. Race N → AI has N-1 mods. The
  // player must keep their car upgraded one mod ahead to stay competitive.
  // This keeps every race winnable but makes upgrades feel essential.
  const opponentBase = playerBase;
  const opponentParts = aiPartsForWins(careerState.classWins);
  const opponentWithParts = applyPartsToCar(opponentBase, opponentParts, balance.parts);
  const opponentFinal = applyTuningToCar(opponentWithParts, balance.defaultTune(opponentBase));
  const oppPaint = pickRandomPaint(seed, playerFinal.color1);
  opponentFinal.color1 = oppPaint.primary;
  opponentFinal.color2 = oppPaint.secondary;

  // Early-career AI handicap: slower reaction time and earlier (suboptimal)
  // shift point. This decays to zero by classWins=5. Combined with the parts
  // scaling above, it makes the first 5 races progressively harder rather
  // than uniformly hard. Numbers chosen so race 1 is winnable even with
  // poor RT (~0.6s human) and bad shift timing.
  const handicapTaper = Math.max(0, (5 - careerState.classWins) / 5);
  const handicappedAi = {
    ...balance.ai,
    // Race 1: AI rtMean ≈ 0.62s (player ~0.30s → 0.3s off-line edge).
    // Tapers to 0.32 by classWins=5 (no handicap → tight race).
    rtMean: balance.ai.rtMean + 0.30 * handicapTaper,
    // Race 1: AI shifts ~800 RPM before redline (slightly suboptimal).
    // Tapers to ~250 by classWins=5 (near-optimal AI).
    shiftBandSlackRpm: balance.ai.shiftBandSlackRpm + 600 * handicapTaper,
  };

  return { ...balance, cars: [playerFinal, opponentFinal], ai: handicappedAi };
}

/**
 * Quick-race balance using the player's customized career car against an
 * identical (same parts + tune) AI car with different colors. No handicap,
 * no class scaling — pure shift-and-launch skill match. Used by the
 * "QUICK RACE" button on the career home screen for grinding gold.
 */
export function buildCareerQuickRaceBalance(careerState, seed) {
  const ownedCar = careerState.ownedCars.find(c => c.carId === careerState.currentCarId);
  if (!ownedCar) throw new Error('career quick race needs a current car');
  const playerBase = balance.cars.find(c => c.id === ownedCar.carId);
  const playerWithParts = applyPartsToCar(playerBase, ownedCar.parts, balance.parts);
  const playerFinal = applyTuningToCar(playerWithParts, ownedCar.tune);
  playerFinal.color1 = ownedCar.paint.primary;
  playerFinal.color2 = ownedCar.paint.secondary;
  playerFinal.stripe = ownedCar.paint.stripe || 'none';

  // Opponent: identical parts loadout (so the cars are truly equal), default
  // tune (no player-specific tuning advantage), random palette colors.
  const opponentFinal = applyTuningToCar(playerWithParts, balance.defaultTune(playerBase));
  const oppPaint = pickRandomPaint(seed, playerFinal.color1);
  opponentFinal.color1 = oppPaint.primary;
  opponentFinal.color2 = oppPaint.secondary;
  opponentFinal.stripe = 'none';

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

/** Pick env preset id for the next career race based on classIndex. */
export function pickEnvForCareerRace(careerState) {
  return CLASS_ENV_TABLE[careerState.classIndex] || 'day';
}
