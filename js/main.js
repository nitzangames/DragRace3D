import { VERSION, FIXED_DT, MAX_DT, GREEN_BAND_RPM, PLAYER_CAR_IDX } from './constants.js';
import { balance } from './balance.js';
import { allocGameData, resetRace } from './gameData.js';
import { tickRace } from './race-logic.js';
import { initInput } from './input.js';
import { buildRaceScene, renderFrame } from './renderer3d.js';
import { createChaseCamera, updateChaseCamera } from './camera3d.js';
import { buildTachSVG } from './tach.js';
import { resetEffects, updateEffects } from './effects.js';
import { loadCareer, saveCareer } from './save.js';
import { newCareer, addOwnedCar, removeOwnedCar, spendGold, recordWin, recordLoss, setCurrentCar } from './career.js';
import { renderFirstCarGrid, buildOwnedCarInstance, renderCareerHome, buildRaceBalance } from './career-flow.js';
import { renderGarage, renderCarDetail } from './garage.js';
import { renderPartsShop } from './parts-shop.js';
import { renderBuyShop } from './buy-shop.js';
import { renderTuningUI } from './tuning-ui.js';
import { renderPaintUI } from './paint-ui.js';
import { computeRaceReward } from './economy.js';

const canvas = document.getElementById('game-canvas');
const T = window.THREE;
const renderer = new T.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(canvas.width, canvas.height, false);

const camera = createChaseCamera(canvas);

let gameData = allocGameData(balance);
let scene, cars, env, tachUpdater;
let acc = 0; let lastT = performance.now();
let started = false;

// Debug handle (used by tests-visual probes; harmless in prod)
if (typeof window !== 'undefined') window.__dr3d_gd = gameData;

function show(id) {
  document.querySelectorAll('#ui .screen').forEach(s => s.classList.add('hidden'));
  const el = document.getElementById(id);
  if (el) el.classList.remove('hidden');
}

function startRace() {
  // Rebuild scene every race — player may have switched cars / classes.
  if (scene) {
    while (scene.children.length > 0) scene.remove(scene.children[0]);
    scene = null;
  }
  const built = buildRaceScene(raceBalance);
  scene = built.scene; cars = built.cars; env = built.env;
  resetRace(gameData, raceBalance, Date.now() | 0);
  resetEffects();
  show('hud');
  started = true;
  const tachContainer = document.getElementById('tach-container');
  tachUpdater = buildTachSVG(tachContainer, raceBalance.cars[0].redlineRpm, GREEN_BAND_RPM);
}

document.getElementById('version-text').textContent = VERSION;

// Initial input wiring needs gameData reference; must be after gameData allocated.
initInput(gameData);

let careerState = null;
let raceBalance = balance; // current race's balance — reset by each race entrypoint
let quickRaceMode = false;
let activeOwnedCar = null;
let activeTab = 'parts';

async function initTitleButtons() {
  const continueBtn = document.getElementById('btn-continue-career');
  const newBtn      = document.getElementById('btn-new-career');
  const quickBtn    = document.getElementById('btn-quick-race');
  const garageBtn   = document.getElementById('btn-garage');

  // Show CONTINUE only if a save exists
  const existing = await loadCareer();
  if (existing) {
    careerState = existing;
    continueBtn.classList.remove('hidden');
  }

  newBtn.addEventListener('click', e => { e.currentTarget.blur(); onNewCareer(); });
  continueBtn.addEventListener('click', e => { e.currentTarget.blur(); onContinueCareer(); });
  quickBtn.addEventListener('click', e => { e.currentTarget.blur(); onQuickRace(); });
  garageBtn.addEventListener('click', e => { e.currentTarget.blur(); onGarage(); });
}

function onNewCareer() {
  careerState = newCareer();
  renderFirstCarGrid(
    document.getElementById('firstcar-grid'),
    careerState,
    onFirstCarPicked
  );
  show('screen-firstcar');
}

async function onFirstCarPicked(carId) {
  const car = balance.cars.find(c => c.id === carId);
  careerState = spendGold(careerState, car.price);
  const carInstance = buildOwnedCarInstance(carId);
  careerState = addOwnedCar(careerState, carInstance);
  await saveCareer(careerState);
  showCareerHome();
}

function showCareerHome() {
  if (!careerState) return;
  renderCareerHome(careerState);
  show('screen-career-home');
}

document.getElementById('btn-firstcar-back').addEventListener('click', () => show('screen-title'));

function onContinueCareer() { showCareerHome(); }
function onQuickRace() {
  console.log('QUICK RACE (todo: class-pick → race)');
}
function onGarage() {
  if (!careerState) {
    careerState = newCareer();  // allow garage browsing without a save (no persistence yet)
  }
  renderGarage(careerState, onGarageCarPick);
  show('screen-garage');
}

function onGarageCarPick(carId) {
  activeOwnedCar = careerState.ownedCars.find(c => c.carId === carId);
  activeTab = 'parts';
  // Reset visual tab state to PARTS
  document.querySelectorAll('#screen-cardetail .tab').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === activeTab);
  });
  renderCarDetail(careerState, activeOwnedCar);
  renderActiveTab();
  show('screen-cardetail');
}

function onTabChange(tab) {
  activeTab = tab;
  document.querySelectorAll('#screen-cardetail .tab').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === activeTab);
  });
  renderCarDetail(careerState, activeOwnedCar);
  renderActiveTab();
}

function renderActiveTab() {
  const body = document.getElementById('cardetail-tabbody');
  body.innerHTML = '';
  switch (activeTab) {
    case 'parts': renderPartsShop(body, careerState, activeOwnedCar, onInstallPart); break;
    case 'tune':  renderTuningUI(body, activeOwnedCar, onTuneChange); break;
    case 'paint': renderPaintUI(body, activeOwnedCar, onPaintChange); break;
    case 'sell':  renderSellUI(body, activeOwnedCar); break;
  }
}

async function onInstallPart(slot, tier) {
  const price = balance.parts[slot][tier].price;
  if (careerState.gold < price) return;
  careerState = spendGold(careerState, price);
  // Update the owned-car instance's parts
  const idx = careerState.ownedCars.findIndex(c => c.carId === activeOwnedCar.carId);
  const updatedCar = {
    ...careerState.ownedCars[idx],
    parts: { ...careerState.ownedCars[idx].parts, [slot]: tier },
  };
  const newOwned = [...careerState.ownedCars];
  newOwned[idx] = updatedCar;
  careerState = { ...careerState, ownedCars: newOwned };
  activeOwnedCar = updatedCar;
  await saveCareer(careerState);
  renderActiveTab();  // re-render with new state
}

async function onTuneChange(newTune) {
  const idx = careerState.ownedCars.findIndex(c => c.carId === activeOwnedCar.carId);
  const updated = { ...careerState.ownedCars[idx], tune: newTune };
  const newOwned = [...careerState.ownedCars];
  newOwned[idx] = updated;
  careerState = { ...careerState, ownedCars: newOwned };
  activeOwnedCar = updated;
  await saveCareer(careerState);
}

async function onPaintChange(newPaint) {
  const idx = careerState.ownedCars.findIndex(c => c.carId === activeOwnedCar.carId);
  const updated = { ...careerState.ownedCars[idx], paint: newPaint };
  const newOwned = [...careerState.ownedCars];
  newOwned[idx] = updated;
  careerState = { ...careerState, ownedCars: newOwned };
  activeOwnedCar = updated;
  await saveCareer(careerState);
  // Re-render so swatches show the new selection
  renderActiveTab();
}

function renderSellUI(parent, ownedCar) {
  const car = balance.cars.find(c => c.id === ownedCar.carId);
  const sellPrice = Math.floor(car.price * 0.5);  // 50% of new price
  parent.innerHTML = `
    <div style="font-size:18px;margin-bottom:14px;">
      Sell ${car.name} for <span class="gold">${sellPrice.toLocaleString()}g</span>?
    </div>
    <p class="subtitle">You'll lose the parts and tune installed on this car.</p>
    <button id="btn-sell-confirm" class="btn-primary" ${
      careerState.ownedCars.length <= 1 ? 'disabled' : ''
    }>SELL</button>
    ${careerState.ownedCars.length <= 1 ? '<p class="subtitle" style="color:#ff8a5a;">Cannot sell your only car.</p>' : ''}
  `;
  if (careerState.ownedCars.length <= 1) return;
  document.getElementById('btn-sell-confirm').addEventListener('click', async () => {
    careerState = removeOwnedCar(careerState, ownedCar.carId);
    careerState = { ...careerState, gold: careerState.gold + sellPrice };
    await saveCareer(careerState);
    renderGarage(careerState, onGarageCarPick);
    show('screen-garage');
  });
}

async function onSetCurrent() {
  careerState = setCurrentCar(careerState, activeOwnedCar.carId);
  await saveCareer(careerState);
  renderCarDetail(careerState, activeOwnedCar);
}

initTitleButtons();

document.getElementById('btn-career-back').addEventListener('click', () => show('screen-title'));
document.getElementById('btn-career-garage').addEventListener('click', () => onGarage());
document.getElementById('btn-next-race').addEventListener('click', () => onNextRace());

document.getElementById('btn-garage-back').addEventListener('click', () => {
  if (careerState && careerState.ownedCars.length > 0) showCareerHome();
  else show('screen-title');
});
document.getElementById('btn-garage-buy').addEventListener('click', () => {
  renderBuyShop(careerState, onBuyCar);
  show('screen-buyshop');
});

async function onBuyCar(carId) {
  const car = balance.cars.find(c => c.id === carId);
  if (careerState.gold < car.price) return;
  careerState = spendGold(careerState, car.price);
  careerState = addOwnedCar(careerState, buildOwnedCarInstance(carId));
  await saveCareer(careerState);
  renderGarage(careerState, onGarageCarPick);
  show('screen-garage');
}

document.getElementById('btn-buyshop-back').addEventListener('click', () => {
  renderGarage(careerState, onGarageCarPick);
  show('screen-garage');
});

document.querySelectorAll('#screen-cardetail .tab').forEach(btn => {
  btn.addEventListener('click', () => onTabChange(btn.dataset.tab));
});
document.getElementById('btn-cardetail-back').addEventListener('click', () => {
  renderGarage(careerState, onGarageCarPick);
  show('screen-garage');
});
document.getElementById('btn-cardetail-set-current').addEventListener('click', onSetCurrent);

async function onNextRace() {
  raceBalance = buildRaceBalance(careerState, Date.now() | 0);
  startRace();
}

function loop(now) {
  // Battery: respect platform pause
  if (window.PlaySDK && window.PlaySDK.isPaused) {
    requestAnimationFrame(loop);
    lastT = now;
    return;
  }
  let dt = (now - lastT) / 1000;
  lastT = now;
  if (dt > MAX_DT) dt = MAX_DT;
  if (started) {
    acc += dt;
    while (acc >= FIXED_DT) {
      tickRace(gameData, raceBalance, FIXED_DT);
      acc -= FIXED_DT;
    }
    if (tachUpdater) tachUpdater.update(gameData.rpm[0], gameData.gear[0], gameData.slip[0]);
    updateButtonHints(gameData);
    document.getElementById('hud-gear').textContent = 'GEAR ' + gameData.gear[0];
    document.getElementById('hud-time').textContent =
      ((gameData.raceState === 'racing' || gameData.raceState === 'finished')
        ? (gameData.raceTimeS - gameData.racingStartS).toFixed(2)
        : '0.00') + 's';
    document.getElementById('hud-speed').textContent =
      Math.round(gameData.velMs[0] * 2.237) + ' mph';
    updateEffects(gameData, dt);
    updateChaseCamera(camera, gameData);
    renderFrame(renderer, scene, camera, cars, env, gameData);
    if (gameData.raceState === 'finished' && !document.getElementById('screen-results')) {
      showResults();
    }
  }
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// Dynamic prompt above each button. Walks the race-state machine and tach
// state to tell the player what to do next.
const shiftHintEl = document.getElementById('shift-hint');
const gasHintEl   = document.getElementById('gas-hint');
function updateButtonHints(gd) {
  let leftHint = '', rightHint = '';
  let leftFlash = false;
  const state = gd.raceState;
  if (state === 'staging' || state === 'tree') {
    leftHint = rightHint = 'HOLD';
  } else if (state === 'launching' && gd.treeGreenAtS > 0) {
    leftHint = 'LET GO';
    rightHint = 'HOLD';
    leftFlash = true;  // green light: flash the LET GO prompt
  } else if (state === 'racing') {
    rightHint = 'HOLD';
    const rpm = gd.rpm[PLAYER_CAR_IDX];
    const playerRedline = raceBalance.cars[PLAYER_CAR_IDX].redlineRpm;
    const inGreen = rpm >= playerRedline - GREEN_BAND_RPM && rpm < playerRedline;
    if (inGreen && gd.gear[PLAYER_CAR_IDX] < 4) {
      leftHint = 'PRESS!';
      leftFlash = true;
    }
  }
  if (shiftHintEl.textContent !== leftHint) shiftHintEl.textContent = leftHint;
  shiftHintEl.classList.toggle('flash', leftFlash);
  if (gasHintEl.textContent !== rightHint) gasHintEl.textContent = rightHint;
}

function showResults() {
  let el = document.getElementById('screen-results');
  if (!el) {
    el = document.createElement('div');
    el.id = 'screen-results'; el.className = 'screen';
    el.innerHTML = `
      <h2 id="res-headline" style="font-size:96px;margin-bottom:32px"></h2>
      <div id="res-detail" style="font-size:32px;margin-bottom:16px"></div>
      <div id="res-rt" style="font-size:24px;opacity:0.8;margin-bottom:32px"></div>
      <button id="btn-rerun" class="btn-primary">RACE AGAIN</button>
    `;
    document.getElementById('ui').appendChild(el);
    document.getElementById('btn-rerun').addEventListener('click', () => {
      el.remove();
      if (careerState && !quickRaceMode) {
        showCareerHome();
      } else {
        startRace();  // quick race fallback / no career
      }
    });
  }
  show('screen-results');
  const won = gameData.winnerCarIdx === PLAYER_CAR_IDX;
  const jumped = gameData.jumped[PLAYER_CAR_IDX] === 1;
  document.getElementById('res-headline').textContent =
    jumped ? 'JUMPED START' : (won ? 'YOU WIN' : 'YOU LOSE');
  const playerET = gameData.finished[PLAYER_CAR_IDX] ? gameData.finishTimeS[PLAYER_CAR_IDX] : null;
  const oppET = gameData.finished[1] ? gameData.finishTimeS[1] : null;
  document.getElementById('res-detail').textContent =
    `Your ET: ${playerET == null ? '—' : playerET.toFixed(3) + 's'}   Opponent: ${oppET == null ? '—' : oppET.toFixed(3) + 's'}`;
  document.getElementById('res-rt').textContent =
    `RT: ${gameData.rtS[PLAYER_CAR_IDX].toFixed(3)}s`;

  // Record career result if we're in career mode (not quick race)
  recordCareerResult();

  async function recordCareerResult() {
    if (!careerState || quickRaceMode) return;
    const won = gameData.winnerCarIdx === PLAYER_CAR_IDX;
    const perfectRT = gameData.rtS[PLAYER_CAR_IDX] > 0 && gameData.rtS[PLAYER_CAR_IDX] < 0.100;
    const reward = computeRaceReward({
      classIndex: careerState.classIndex,
      won,
      mode: 'career',
      perfectRT,
    });
    if (won) {
      careerState = recordWin(careerState, { gold: reward });
    } else {
      careerState = recordLoss(careerState, { gold: reward });
    }
    await saveCareer(careerState);
    // Append gold delta to results screen
    const goldEl = document.createElement('div');
    goldEl.style.cssText = 'font-size:24px; color:#ffd14a; margin-top:12px;';
    goldEl.textContent = `+${reward}g  · Total: ${careerState.gold.toLocaleString()}g`;
    document.getElementById('screen-results').appendChild(goldEl);
  }
}
