import { VERSION, FIXED_DT, MAX_DT, GREEN_BAND_RPM, PLAYER_CAR_IDX } from './constants.js';
import { balance } from './balance.js';
import { allocGameData, resetRace } from './gameData.js';
import { tickRace } from './race-logic.js';
import { initInput } from './input.js';
import { buildRaceScene, rebuildCarsInScene, renderFrame } from './renderer3d.js';
import { createChaseCamera, updateChaseCamera } from './camera3d.js';
import { buildTachSVG } from './tach.js';
import { resetEffects, updateEffects } from './effects.js';
import { loadCareer, saveCareer, clearCareer } from './save.js';
import { initAudio, setMuted, setVolume, suspendAudio, resumeAudio, startEngine, stopEngine, updateEngine } from './audio.js';
import { setHapticsEnabled, hapticTap, hapticPurchase } from './haptics.js';
import { newCareer, addOwnedCar, removeOwnedCar, spendGold, addGold, recordWin, recordLoss, setCurrentCar } from './career.js';
import { renderFirstCarPicker, resetFirstCarPicker, buildOwnedCarInstance, renderCareerHome, buildRaceBalance, buildCareerQuickRaceBalance, pickEnvForCareerRace } from './career-flow.js';
import { applyEnvPreset } from './env-builder.js';
import { renderGarage, renderCarDetail } from './garage.js';
import { renderPartsShop } from './parts-shop.js';
import { renderBuyShop } from './buy-shop.js';
import { renderTuningUI } from './tuning-ui.js';
import { renderPaintUI } from './paint-ui.js';
import { cleanupPaintPreview, mountPaintPreview } from './paint-preview.js';
import { mountPreracePreview, cleanupPreracePreview, pausePreracePreview } from './prerace-preview.js';
import { CLASS_BASE_REWARD, PERFECT_RT_BONUS_FRAC, LOSE_REWARD_FRAC, CLASS_NAMES } from './constants.js';
import { computeRaceReward } from './economy.js';
import { renderQuickRace, buildQuickRaceBalance, renderTrackPicker } from './quick-race.js';
import { createGhostRecorder, decodeGhost } from './ghost-recorder.js';
import { createGhostPlayer } from './ghost-renderer.js';
import { renderRotwScreen, buildRotwBalance, fetchCurrentGhost, submitRotwResult } from './rotw-screen.js';
import { fetchTop } from './leaderboard.js';
import { renderShop, applyPurchase } from './shop-screen.js';
import { SHOP_PACKS } from './balance.js';

const canvas = document.getElementById('game-canvas');
const T = window.THREE;
// Mobile-Safari memory budget: the canvas attr is already 1080x1920, so
// applying device-pixel-ratio on top would balloon the framebuffer to
// ~16M pixels (and antialias quadruples that with MSAA). On phones the
// tab gets OOM-killed before the first frame. Force DPR=1 and disable
// MSAA — the canvas's own resolution is high enough for crisp edges,
// and shadows / lighting do most of the visual work anyway.
const _isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent || '');
const renderer = new T.WebGLRenderer({ canvas, antialias: !_isMobile });
renderer.setPixelRatio(_isMobile ? 1 : Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(canvas.width, canvas.height, false);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = T.PCFSoftShadowMap;

/** Enable/disable real-time shadows. Materials need to be flagged dirty
 *  on toggle so three.js recompiles their shaders without shadow uniforms. */
function setShadowsEnabled(on) {
  renderer.shadowMap.enabled = !!on;
  if (scene) {
    scene.traverse((c) => { if (c.material) c.material.needsUpdate = true; });
  }
}

const camera = createChaseCamera(canvas);

let gameData = allocGameData(balance);
let scene, cars, env, tachUpdater;
let acc = 0; let lastT = performance.now();
let started = false;

const ghostRecorder = createGhostRecorder();
let ghostPlayer = null;
let activeGhostFloats = null; // set by RotW screen before startRace

// Debug handle (used by tests-visual probes; harmless in prod)
if (typeof window !== 'undefined') window.__dr3d_gd = gameData;

// Title shown in the global top bar per screen. null = hide top bar.
const TOP_BAR_TITLES = {
  'screen-title': null,
  'hud': 'RACE',
  'screen-results': 'RESULTS',
  'screen-firstcar': 'PICK YOUR FIRST CAR',
  'screen-career-home': 'CAREER',
  'screen-garage': 'GARAGE',
  'screen-cardetail': 'CAR DETAIL',
  'screen-buyshop': 'BUY CAR',
  'screen-prerace': 'PRE-RACE',
  'screen-quickrace': 'PICK CAR',
  'quick-race-track': 'PICK TRACK',
  'rotw': 'RACE OF THE WEEK',
  'shop': 'GOLD SHOP',
  'settings': 'SETTINGS',
};

let _prevScreenForPause = null;

// Per-screen back-button handler. The top-bar BACK arrow on the left runs
// the matching function for whichever screen is currently visible. null
// (or absent) hides the back button. The hud and screen-results don't get
// a back button — they have their own race-specific exit flows.
const SCREEN_BACK = {
  'screen-firstcar':    () => { cleanupPaintPreview(); show('screen-title'); },
  'screen-career-home': () => show('screen-title'),
  'screen-garage':      () => {
    cleanupPaintPreview();
    if (careerState && careerState.ownedCars.length > 0) showCareerHome();
    else show('screen-title');
  },
  'screen-cardetail': () => {
    cleanupPaintPreview();
    renderGarage(careerState, onGarageCarPick);
    show('screen-garage');
  },
  'screen-buyshop': () => {
    cleanupPaintPreview();
    renderGarage(careerState, onGarageCarPick);
    show('screen-garage');
  },
  'screen-prerace': () => { pausePreracePreview(); showCareerHome(); },
  'screen-quickrace':  () => show('quick-race-track'),
  'quick-race-track':  () => show('screen-title'),
  'rotw':              () => show('screen-title'),
  'shop':              () => show('screen-title'),
  'settings': () => {
    if (_prevScreenForPause) {
      const prev = _prevScreenForPause; _prevScreenForPause = null;
      show(prev);
    } else {
      show('screen-title');
    }
  },
};

function updateTopBar(id) {
  const bar = document.getElementById('top-bar');
  if (!bar) return;
  const title = TOP_BAR_TITLES[id];
  if (!title) { bar.classList.add('hidden'); return; }
  bar.classList.remove('hidden');
  document.getElementById('top-bar-title').textContent = title;
  const gold = (careerState && typeof careerState.gold === 'number') ? careerState.gold : 0;
  document.getElementById('top-bar-gold').textContent = gold.toLocaleString() + 'g';

  const backBtn = document.getElementById('top-bar-back');
  const backFn = SCREEN_BACK[id];
  if (backFn) {
    backBtn.classList.remove('hidden');
    backBtn.onclick = backFn;
  } else {
    backBtn.classList.add('hidden');
    backBtn.onclick = null;
  }
}

function show(id) {
  document.querySelectorAll('#ui .screen').forEach(s => s.classList.add('hidden'));
  const el = document.getElementById(id);
  if (el) el.classList.remove('hidden');
  updateTopBar(id);
}

/** Re-read careerState.gold into the top bar without changing the screen.
 *  Call after any in-screen mutation that affects the player's balance
 *  (parts purchase, paint pick that costs nothing — well, just parts/cars). */
function refreshTopBar() {
  const visible = document.querySelector('#ui .screen:not(.hidden)');
  if (visible) updateTopBar(visible.id);
}

/** Walk a three.js scene graph and free every Geometry / Material /
 *  Texture / shadow-map. Three.js doesn't auto-dispose when a node is
 *  removed; without this the GPU buffers stick around until the JS
 *  garbage collector decides to run, which on mobile can be never.
 *  Called between races so each rebuild starts from a clean GPU state. */
function disposeScene(root) {
  root.traverse((obj) => {
    if (obj.geometry) obj.geometry.dispose();
    if (obj.material) {
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      for (const m of mats) {
        if (m.map) m.map.dispose();
        if (m.envMap) m.envMap.dispose();
        m.dispose();
      }
    }
    // Directional/spot lights ship with their own shadow render target +
    // shadow camera — release those textures too.
    if (obj.shadow && obj.shadow.map) {
      obj.shadow.map.dispose();
      obj.shadow.map = null;
    }
  });
  // Clear children pointers so any lingering refs can't keep the tree alive.
  while (root.children.length > 0) root.remove(root.children[0]);
}

// Diagnostic: log when the WebGL context is lost or restored. Mobile
// Safari can drop the context under memory pressure, after which all
// renderer.render() calls silently fail. If a player reports a crash,
// these logs in the console (or a remote debug session) will tell us.
canvas.addEventListener('webglcontextlost', (e) => {
  e.preventDefault();
  console.warn('[dr3d] WebGL context LOST', e);
}, false);
canvas.addEventListener('webglcontextrestored', (e) => {
  console.warn('[dr3d] WebGL context restored', e);
}, false);

// Track which env the cached scene currently has loaded so we only rebuild
// the scenery sub-group when the env actually changes between races.
let _currentEnvId = null;

function startRace() {
  // Cache the race scene across races. The first call builds everything;
  // subsequent calls keep the same THREE.Scene + lights + strip + tree +
  // gantry alive and only swap out the cars (different archetype/colors)
  // and the env scenery (only if the env id changed). Was: full rebuild
  // every race, allocating ~1000+ mesh objects + freshly-allocated shadow
  // maps. Mobile Safari was OOM-killing the tab after a few races.
  const envId = quickRaceMode ? quickRaceEnvId : pickEnvForCareerRace(careerState || { classIndex: 0 });
  if (!scene) {
    const built = buildRaceScene(raceBalance, envId);
    scene = built.scene; cars = built.cars; env = built.env;
    env.ghostMesh = built.ghostMesh;
    _currentEnvId = envId;
  } else {
    // Re-use existing scene; swap cars + ghost (different car each race)
    // and only rebuild scenery if the track changed.
    const swapped = rebuildCarsInScene(scene, raceBalance, cars, env.ghostMesh);
    cars = swapped.cars;
    env.ghostMesh = swapped.ghostMesh;
    if (envId !== _currentEnvId) {
      applyEnvPreset(env, envId);
      _currentEnvId = envId;
    }
  }
  resetRace(gameData, raceBalance, Date.now() | 0);
  resetEffects();
  _rotwSubmitted = false;
  show('hud');
  started = true;
  const tachContainer = document.getElementById('tach-container');
  tachUpdater = buildTachSVG(tachContainer, raceBalance.cars[0].redlineRpm, GREEN_BAND_RPM);
  startEngine(raceBalance.cars[0]);
  ghostRecorder.start();
  if (activeGhostFloats && env.ghostMesh) {
    ghostPlayer = createGhostPlayer(env.ghostMesh, activeGhostFloats);
    env.ghostMesh.visible = true;
  } else {
    ghostPlayer = null;
    if (env.ghostMesh) env.ghostMesh.visible = false;
  }
}

document.getElementById('version-text').textContent = VERSION;

// Initial input wiring needs gameData reference; must be after gameData allocated.
initInput(gameData);

let careerState = null;
let raceBalance = balance; // current race's balance — reset by each race entrypoint
let quickRaceMode = false;
let quickRaceEnvId = 'day';
// Distinguishes career-context quick races (grind for gold using the player's
// tuned career car) from standalone quick races started off the title screen.
// Both set quickRaceMode = true; the flag below decides whether to award gold
// at career-quick-race rates and whether RACE AGAIN re-rolls the same flow.
let _careerQuickRace = false;
let activeOwnedCar = null;
let activeTab = 'parts';
let rotwActive = false;
let rotwChallenge = null;
let _rotwSubmitted = false;

// Audio lifecycle
let _audioInitDone = false;
async function ensureAudioInit() {
  if (_audioInitDone) return;
  _audioInitDone = true;
  await initAudio();
  if (careerState && careerState.audio) {
    setMuted(careerState.audio.muted);
    setVolume(careerState.audio.volume);
  }
  if (careerState && careerState.haptics) {
    setHapticsEnabled(careerState.haptics.enabled !== false);
  }
  if (careerState && careerState.shadows) {
    setShadowsEnabled(careerState.shadows.enabled !== false);
  }
}
window.addEventListener('pointerdown', ensureAudioInit, { once: true });
window.addEventListener('keydown', ensureAudioInit, { once: true });

// Top-bar pause button → settings (remembers prev screen)
document.getElementById('top-bar-pause').addEventListener('click', () => {
  const visible = document.querySelector('#ui .screen:not(.hidden)');
  if (visible && visible.id !== 'settings') _prevScreenForPause = visible.id;
  show('settings');
  const muted = !!(careerState && careerState.audio && careerState.audio.muted);
  document.getElementById('opt-sfx').checked = !muted;
  document.getElementById('opt-volume').value = Math.round((careerState && careerState.audio ? careerState.audio.volume : 0.7) * 100);
  const hapticsOn = !(careerState && careerState.haptics && careerState.haptics.enabled === false);
  document.getElementById('opt-haptics').checked = hapticsOn;
});

// PlaySDK pause/resume hooks
if (typeof window !== 'undefined' && window.PlaySDK) {
  if (window.PlaySDK.onPause) window.PlaySDK.onPause(() => { suspendAudio(); stopEngine(); });
  if (window.PlaySDK.onResume) window.PlaySDK.onResume(() => { resumeAudio(); });
}

async function initTitleButtons() {
  const continueBtn = document.getElementById('btn-continue-career');
  const newBtn      = document.getElementById('btn-new-career');
  const quickBtn    = document.getElementById('btn-quick-race');

  // Show CONTINUE if a save exists, otherwise NEW. Never both — once the
  // player has a career, NEW CAREER is hidden because the only way to
  // start over is the explicit RESET CAREER PROGRESS button in settings.
  const existing = await loadCareer();
  if (existing) {
    careerState = existing;
    continueBtn.classList.remove('hidden');
  } else {
    newBtn.classList.remove('hidden');
  }

  newBtn.addEventListener('click', e => { e.currentTarget.blur(); onNewCareer(); });
  continueBtn.addEventListener('click', e => { e.currentTarget.blur(); onContinueCareer(); });
  quickBtn.addEventListener('click', e => { e.currentTarget.blur(); onQuickRace(); });

  const rotwBtn = document.getElementById('btn-rotw');
  if (rotwBtn) {
    rotwBtn.addEventListener('click', async () => {
      show('rotw');
      rotwChallenge = await renderRotwScreen();
    });
  }
  function openShop() {
    show('shop');
    renderShop(careerState, async (packId) => {
      const pack = SHOP_PACKS.find(p => p.id === packId);
      if (!pack) return;
      const ok = window.confirm(`Buy ${pack.gold.toLocaleString()}g for ${pack.cost.toLocaleString()} NBucks?`);
      if (!ok) return;
      careerState = applyPurchase(careerState, pack);
      hapticPurchase();
      await saveCareer(careerState);
      refreshTopBar();
      openShop(); // re-render with updated balance
    });
  }
  const shopBtn = document.getElementById('btn-shop');
  if (shopBtn) shopBtn.addEventListener('click', openShop);

  function openSettings() {
    show('settings');
    const muted = !!(careerState && careerState.audio && careerState.audio.muted);
    document.getElementById('opt-sfx').checked = !muted;
    document.getElementById('opt-volume').value = Math.round((careerState && careerState.audio ? careerState.audio.volume : 0.7) * 100);
    const hapticsOn = !(careerState && careerState.haptics && careerState.haptics.enabled === false);
    document.getElementById('opt-haptics').checked = hapticsOn;
    const shadowsOn = !(careerState && careerState.shadows && careerState.shadows.enabled === false);
    document.getElementById('opt-shadows').checked = shadowsOn;
  }
  const settingsBtn = document.getElementById('btn-settings');
  if (settingsBtn) settingsBtn.addEventListener('click', openSettings);
  document.getElementById('opt-sfx').addEventListener('change', async (e) => {
    if (!careerState) return;
    const muted = !e.target.checked;
    careerState = { ...careerState, audio: { ...careerState.audio, muted } };
    setMuted(muted);
    await saveCareer(careerState);
  });
  document.getElementById('opt-haptics').addEventListener('change', async (e) => {
    const enabled = !!e.target.checked;
    setHapticsEnabled(enabled);
    if (!careerState) return;
    careerState = { ...careerState, haptics: { enabled } };
    await saveCareer(careerState);
  });
  document.getElementById('opt-shadows').addEventListener('change', async (e) => {
    const enabled = !!e.target.checked;
    setShadowsEnabled(enabled);
    if (!careerState) return;
    careerState = { ...careerState, shadows: { enabled } };
    await saveCareer(careerState);
  });

  // Reset career — wipes the save, hides CONTINUE, returns to title.
  document.getElementById('btn-reset-career').addEventListener('click', async () => {
    const ok = window.confirm('Reset career progress? This will delete your owned cars, gold, NBucks, and class progress. Settings (sound/haptics) will be lost too.');
    if (!ok) return;
    await clearCareer();
    careerState = null;
    _prevScreenForPause = null;
    document.getElementById('btn-continue-career').classList.add('hidden');
    document.getElementById('btn-new-career').classList.remove('hidden');
    show('screen-title');
  });
  document.getElementById('opt-volume').addEventListener('input', async (e) => {
    if (!careerState) return;
    const v = (+e.target.value) / 100;
    careerState = { ...careerState, audio: { ...careerState.audio, volume: v } };
    setVolume(v);
  });
  document.getElementById('opt-volume').addEventListener('change', async () => {
    if (careerState) await saveCareer(careerState);
  });

  document.getElementById('rotw-race').addEventListener('click', async () => {
    if (!rotwChallenge) rotwChallenge = await renderRotwScreen();
    raceBalance = buildRotwBalance(rotwChallenge);
    activeGhostFloats = await fetchCurrentGhost(rotwChallenge.week);
    rotwActive = true;
    quickRaceMode = false;
    startRace();
    // Force amphitheater env for RotW so all players race the same scene
    applyEnvPreset(env, 'amphitheater');
  });
}

function onNewCareer() {
  careerState = newCareer();
  resetFirstCarPicker();
  renderFirstCarPicker(careerState, onFirstCarPicked);
  show('screen-firstcar');
}

async function onFirstCarPicked(carId) {
  cleanupPaintPreview();
  const car = balance.cars.find(c => c.id === carId);
  careerState = spendGold(careerState, car.price);
  const carInstance = buildOwnedCarInstance(carId);
  careerState = addOwnedCar(careerState, carInstance);
  await saveCareer(careerState);
  showCareerHome();
}

function showCareerHome() {
  quickRaceMode = false;
  if (!careerState) return;
  renderCareerHome(careerState);
  show('screen-career-home');
}

function onContinueCareer() { showCareerHome(); }
function onQuickRace() {
  show('quick-race-track');
  renderTrackPicker(careerState, (envId) => {
    quickRaceEnvId = envId;
    renderQuickRace((carId) => {
      raceBalance = buildQuickRaceBalance(carId, Date.now() | 0);
      quickRaceMode = true;
      _careerQuickRace = false;
      startRace();
    });
    show('screen-quickrace');
  });
}

/** Quick race from inside career — uses the player's customized career car
 *  against an identical AI car (different colors). Awards gold at the
 *  quick-race rate (50% of class base) but doesn't advance the class. */
function onCareerQuickRace() {
  if (!careerState || !careerState.currentCarId) return;
  show('quick-race-track');
  renderTrackPicker(careerState, (envId) => {
    quickRaceEnvId = envId;
    quickRaceMode = true;
    _careerQuickRace = true;
    raceBalance = buildCareerQuickRaceBalance(careerState, Date.now() | 0);
    startRace();
  });
}

function onGarage() {
  if (!careerState) {
    careerState = newCareer();  // allow garage browsing without a save (no persistence yet)
  }
  renderGarage(careerState, onGarageCarPick);
  show('screen-garage');
}

function onGarageCarPick(carId) {
  cleanupPaintPreview();  // tear down the garage carousel preview before swapping screens
  activeOwnedCar = careerState.ownedCars.find(c => c.carId === carId);
  activeTab = 'parts';
  // Reset visual tab state to PARTS
  document.querySelectorAll('#screen-cardetail .tab').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === activeTab);
  });
  renderCarDetail(careerState, activeOwnedCar);
  renderActiveTab();
  show('screen-cardetail');
  // Mount the persistent 3D preview pinned at the top of the cardetail
  // screen. Stays through tab switches; paint controls update it in place
  // via updateActivePaintPreview so the rotation angle is preserved.
  const carDef = balance.cars.find(c => c.id === activeOwnedCar.carId);
  if (carDef) {
    mountPaintPreview(
      document.getElementById('cardetail-preview'),
      carDef.archetype,
      activeOwnedCar.paint
    );
  }
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
  // Do NOT cleanupPaintPreview here. The preview is mounted persistently
  // at the top of the cardetail screen (in onGarageCarPick) and must
  // survive tab switches and parts purchases — buying a part triggers
  // renderActiveTab(), which previously was destroying the preview's
  // WebGL context.
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
  hapticPurchase();
  refreshTopBar();
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
  // Don't re-render the paint UI here — the swatch click handlers update
  // their own .selected state inline, and paint-ui.js already updates the
  // 3D preview directly. A full re-render would dispose+remount the
  // preview and reset its rotation angle on every color tap.
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

// Global tap haptic — fires on any UI button press, except the in-race
// GAS / SHIFT controls (which have their own race-specific feedback). We
// listen on pointerdown rather than click so the buzz lines up with the
// finger-down moment, which feels noticeably more responsive on touch.
document.body.addEventListener('pointerdown', (e) => {
  const btn = e.target && e.target.closest && e.target.closest('button, .tab');
  if (!btn) return;
  if (btn.id === 'gas-button' || btn.id === 'shift-button') return;
  hapticTap();
}, true);

document.getElementById('btn-career-garage').addEventListener('click', () => onGarage());
document.getElementById('btn-next-race').addEventListener('click', () => onNextRace());
document.getElementById('btn-career-quick-race').addEventListener('click', () => onCareerQuickRace());
document.getElementById('btn-prerace-race').addEventListener('click', () => {
  // Just pause the prerace preview's render loop; keeping the WebGL
  // context alive across race transitions avoids a context churn that
  // was OOM-killing the tab on mobile Safari right at race-start.
  pausePreracePreview();
  startRace();
});

document.getElementById('btn-garage-next-race').addEventListener('click', () => {
  if (!careerState || !careerState.currentCarId) return;
  cleanupPaintPreview();
  onNextRace();
});
document.getElementById('btn-garage-buy').addEventListener('click', () => {
  cleanupPaintPreview();
  renderBuyShop(careerState, onBuyCar);
  show('screen-buyshop');
});

async function onBuyCar(carId) {
  const car = balance.cars.find(c => c.id === carId);
  if (careerState.gold < car.price) return;
  careerState = spendGold(careerState, car.price);
  careerState = addOwnedCar(careerState, buildOwnedCarInstance(carId));
  hapticPurchase();
  await saveCareer(careerState);
  renderGarage(careerState, onGarageCarPick);
  show('screen-garage');
}

document.querySelectorAll('#screen-cardetail .tab').forEach(btn => {
  btn.addEventListener('click', () => onTabChange(btn.dataset.tab));
});
document.getElementById('btn-cardetail-set-current').addEventListener('click', onSetCurrent);

// Build the next career-race balance and route the player through the
// pre-race info screen (opponent + prize + track + 3D preview). The
// actual race fires from the prerace RACE button.
async function onNextRace() {
  quickRaceMode = false;
  _careerQuickRace = false;
  raceBalance = buildRaceBalance(careerState, Date.now() | 0);
  if (typeof window !== 'undefined') window.__dr3d_raceBalance = raceBalance;
  console.log(`[dr3d] prerace | classWins=${careerState.classWins} | AI rtMean=${raceBalance.ai.rtMean.toFixed(2)}s | AI shiftSlack=${raceBalance.ai.shiftBandSlackRpm.toFixed(0)}rpm`);
  show('screen-prerace');
  renderPreRaceScreen();
}

function renderPreRaceScreen() {
  const envId = pickEnvForCareerRace(careerState);
  const previewParent = document.getElementById('prerace-preview');
  // Preserve any existing canvas so mountPreracePreview's reuse path keeps
  // the WebGL context alive across visits (mobile-Safari context cap).
  for (let i = previewParent.children.length - 1; i >= 0; i--) {
    const c = previewParent.children[i];
    if (c.tagName !== 'CANVAS') c.remove();
  }
  mountPreracePreview(previewParent, raceBalance, envId);

  const opp = raceBalance.cars[1];
  const oppPartsTotal =
    opp.appliedParts ? Object.values(opp.appliedParts).reduce((a, b) => a + b, 0) : 0;
  const oppMods = oppPartsTotal === 0 ? 'Stock' : `${oppPartsTotal} mod${oppPartsTotal > 1 ? 's' : ''} installed`;
  document.getElementById('prerace-opponent').innerHTML = `
    <div class="strong">${opp.name}</div>
    <div class="meta">CLASS ${CLASS_NAMES[careerState.classIndex]} · ${opp.archetype}</div>
    <div class="meta">${oppMods}</div>
  `;

  const baseReward = CLASS_BASE_REWARD[careerState.classIndex];
  const perfectBonus = Math.floor(baseReward * PERFECT_RT_BONUS_FRAC);
  const lossReward = Math.floor(baseReward * LOSE_REWARD_FRAC);
  document.getElementById('prerace-prize').innerHTML = `
    <div><span class="strong">Win:</span> <span class="gold">+${baseReward.toLocaleString()}g</span></div>
    <div class="meta">Perfect RT: <span class="gold">+${perfectBonus}g</span></div>
    <div class="meta">Lose: <span class="gold">+${lossReward}g</span></div>
  `;

  const trackName = envId.charAt(0).toUpperCase() + envId.slice(1);
  document.getElementById('prerace-track').innerHTML = `
    <div class="strong">${trackName}</div>
    <div class="meta">¼ mile · timing tree start</div>
  `;
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
    // Sample ghost during racing only; raceTime since green = elapsed
    if (gameData.raceState === 'racing' || gameData.raceState === 'launching') {
      const t = Math.max(0, gameData.raceTimeS - gameData.treeGreenAtS);
      const playerWorldZ = gameData.posZ[0]; // posZ is negative as car moves forward
      ghostRecorder.tick(t, 1/60, playerWorldZ, gameData.rpm[0], gameData.gear[0]);
      if (ghostPlayer && ghostPlayer.active) ghostPlayer.update(t);
    }
    const throttle = gameData.inputGas[0] ? 1 : 0;
    updateEngine(gameData.rpm[0], throttle);
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
    renderFrame(renderer, scene, camera, cars, env, gameData, dt);
    // Results screen appears the moment the PLAYER is done (finished, blown,
    // or jump-started). Opponent may still be racing — their ET updates live
    // below.
    const playerDone = gameData.finished[PLAYER_CAR_IDX] || gameData.blown[PLAYER_CAR_IDX] || gameData.jumped[PLAYER_CAR_IDX];
    if (playerDone && !document.getElementById('screen-results')) {
      showResults();
    } else if (playerDone && document.getElementById('screen-results')) {
      refreshOpponentResult();
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

/** Update the ET line in the results card. Called per-frame after results
 *  are shown so the opponent's ET fills in once they cross. */
function refreshOpponentResult() {
  const detail = document.getElementById('res-detail');
  if (!detail) return;
  const pFinTime = gameData.finished[PLAYER_CAR_IDX] ? gameData.finishTimeS[PLAYER_CAR_IDX].toFixed(3) + 's'
    : gameData.blown[PLAYER_CAR_IDX] ? 'BLOWN' : '—';
  const aFinTime = gameData.finished[1] ? gameData.finishTimeS[1].toFixed(3) + 's'
    : gameData.blown[1] ? 'BLOWN' : 'racing…';
  detail.textContent = `Your ET: ${pFinTime}   Opponent: ${aFinTime}`;
}

/** Paint the top-10 RotW board into the results screen's leaderboard slot.
 *  Called after submitting the player's run, so the just-submitted entry
 *  is visible (with the `me` highlight class). */
function renderRotwResultsBoard(top) {
  const board = document.getElementById('rotw-results-board');
  if (!board) return;
  if (!top || !top.entries || top.entries.length === 0) {
    board.innerHTML = '<div class="empty">No times yet — yours might be the first!</div>';
    return;
  }
  board.innerHTML = top.entries.map((e, i) => {
    const meCls = e.isMe ? 'row me' : 'row';
    const name = (e.metadata && e.metadata.name) || ('user-' + (e.user_id || '?'));
    return `<div class="${meCls}"><span>${i + 1}. ${name}</span><span>${e.value.toFixed(3)}s</span></div>`;
  }).join('');
}

function showResults() {
  let el = document.getElementById('screen-results');
  if (!el) {
    stopEngine();
    el = document.createElement('div');
    el.id = 'screen-results'; el.className = 'screen';
    if (rotwActive) {
      // Race-of-the-week post-race screen: leaderboard front and center,
      // RETRY (re-runs the same RotW with a fresh ghost) and MAIN MENU.
      el.innerHTML = `
        <h2 id="res-headline" style="font-size:60px;margin-bottom:14px"></h2>
        <div id="res-detail" style="font-size:24px;margin-bottom:12px"></div>
        <div id="res-rt" style="font-size:20px;opacity:0.8;margin-bottom:14px"></div>
        <div id="rotw-results-board" class="rotw-board" style="margin-bottom:18px;">
          <div class="empty">Submitting your time…</div>
        </div>
        <button id="btn-rotw-retry" class="btn-primary btn-buy">RETRY</button>
        <button id="btn-rotw-mainmenu" class="btn-secondary">MAIN MENU</button>
      `;
    } else {
      // Quick races (both standalone and career-context) get a TRACK
      // SELECTION secondary button instead of GARAGE — the player's natural
      // next move is to pick a different track, not to manage cars.
      const isQuickRace = quickRaceMode || _careerQuickRace;
      const secondaryLabel = isQuickRace ? 'TRACK SELECTION' : 'GARAGE';
      const secondaryId = isQuickRace ? 'btn-results-tracks' : 'btn-results-garage';
      el.innerHTML = `
        <h2 id="res-headline" style="font-size:96px;margin-bottom:32px"></h2>
        <div id="res-detail" style="font-size:32px;margin-bottom:16px"></div>
        <div id="res-rt" style="font-size:24px;opacity:0.8;margin-bottom:16px"></div>
        <div id="res-gold" style="font-size:28px;color:#ffd14a;font-weight:700;margin-bottom:24px;min-height:34px"></div>
        <button id="btn-rerun" class="btn-primary btn-buy"></button>
        <button id="${secondaryId}" class="btn-secondary">${secondaryLabel}</button>
      `;
    }
    document.getElementById('ui').appendChild(el);
    if (rotwActive) {
      document.getElementById('btn-rotw-retry').addEventListener('click', async () => {
        started = false;
        el.remove();
        // Rebuild the RotW balance and re-fetch the current top ghost so a
        // fresh race uses the latest leader (which may now be the player).
        if (!rotwChallenge) rotwChallenge = await renderRotwScreen();
        raceBalance = buildRotwBalance(rotwChallenge);
        activeGhostFloats = await fetchCurrentGhost(rotwChallenge.week);
        rotwActive = true;
        _rotwSubmitted = false;
        quickRaceMode = false;
        startRace();
      });
      document.getElementById('btn-rotw-mainmenu').addEventListener('click', () => {
        started = false;
        el.remove();
        rotwActive = false;
        activeGhostFloats = null;
        show('screen-title');
      });
    } else {
      document.getElementById('btn-rerun').textContent =
        (careerState && !quickRaceMode) ? 'NEXT RACE' : 'RACE AGAIN';
      document.getElementById('btn-rerun').addEventListener('click', () => {
        started = false;
        el.remove();
        if (_careerQuickRace) {
          raceBalance = buildCareerQuickRaceBalance(careerState, Date.now() | 0);
          startRace();
        } else if (careerState && !quickRaceMode) {
          onNextRace();
        } else {
          startRace();
        }
      });
      const isQuickRaceMode = quickRaceMode || _careerQuickRace;
      if (isQuickRaceMode) {
        document.getElementById('btn-results-tracks').addEventListener('click', () => {
          started = false;
          el.remove();
          // Re-enter the same flow the race came from so the player can pick
          // a fresh track and (for standalone) car. Clears prior balance via
          // the entry function rebuilding it on selection.
          if (_careerQuickRace) onCareerQuickRace();
          else onQuickRace();
        });
      } else {
        document.getElementById('btn-results-garage').addEventListener('click', () => {
          started = false;
          el.remove();
          if (!careerState) careerState = newCareer();
          renderGarage(careerState, onGarageCarPick);
          show('screen-garage');
        });
      }
    }
  }
  show('screen-results');
  // Decide winner at the moment the player is done. If player crossed first,
  // they win — AI's eventual ET can only be higher (slower across the line).
  // If player blew, AI wins (they're still racing or already crossed).
  // Jump-start: tickTree already set winnerCarIdx = opponent — honor that.
  const pJumped = gameData.jumped[PLAYER_CAR_IDX] === 1;
  const pFin = gameData.finished[PLAYER_CAR_IDX];
  const pBlown = gameData.blown[PLAYER_CAR_IDX];
  const aFin = gameData.finished[1];
  let winnerIdx;
  if (pJumped) winnerIdx = gameData.winnerCarIdx;  // already 1-PLAYER_CAR_IDX
  else if (pBlown && gameData.blown[1]) winnerIdx = -1;
  else if (pBlown) winnerIdx = 1;
  else if (pFin && aFin) winnerIdx = gameData.finishTimeS[PLAYER_CAR_IDX] < gameData.finishTimeS[1] ? PLAYER_CAR_IDX : 1;
  else winnerIdx = PLAYER_CAR_IDX; // player crossed first, AI still racing
  gameData.winnerCarIdx = winnerIdx;

  const won = winnerIdx === PLAYER_CAR_IDX;
  document.getElementById('res-headline').textContent =
    pJumped ? 'JUMPED START' : pBlown ? 'ENGINE BLOWN' : (won ? 'YOU WIN' : 'YOU LOSE');
  document.getElementById('res-rt').textContent =
    `RT: ${gameData.rtS[PLAYER_CAR_IDX].toFixed(3)}s`;
  refreshOpponentResult();

  // Race telemetry — log everything that affects who won so it's diagnosable
  // when something feels off ("AI keeps beating me even with the same car").
  console.group(`[dr3d] race summary (${gameData.winnerCarIdx === PLAYER_CAR_IDX ? 'YOU WIN' : 'YOU LOSE'})`);
  console.log('Player:',
    `RT ${gameData.rtS[PLAYER_CAR_IDX].toFixed(3)}s`,
    `· ET ${gameData.finished[PLAYER_CAR_IDX] ? gameData.finishTimeS[PLAYER_CAR_IDX].toFixed(3)+'s' : '—'}`,
    `· final v ${gameData.velMs[PLAYER_CAR_IDX].toFixed(1)} m/s`,
    `· final gear ${gameData.gear[PLAYER_CAR_IDX]}`,
    gameData.blown[PLAYER_CAR_IDX] ? '· BLOWN' : '');
  console.log('Player shifts:', gameData._shiftLog?.[0] ?? []);
  console.log('AI:',
    `RT ${gameData.rtS[1].toFixed(3)}s`,
    `· ET ${gameData.finished[1] ? gameData.finishTimeS[1].toFixed(3)+'s' : '—'}`,
    `· final v ${gameData.velMs[1].toFixed(1)} m/s`,
    `· final gear ${gameData.gear[1]}`,
    gameData.blown[1] ? '· BLOWN' : '');
  console.log('AI shifts:', gameData._shiftLog?.[1] ?? []);
  console.log('AI plan:', gameData._aiPlan);
  console.groupEnd();

  // Record career result if we're in career mode (not quick race)
  recordCareerResult();

  // Submit RotW result if this was a RotW race (one-shot guard).
  // Note: rotwActive stays TRUE until the user leaves the results screen
  // (RETRY keeps it on; MAIN MENU clears it), so the post-race UI reads
  // as a RotW screen and the leaderboard refresh below sees rotwActive.
  if (rotwActive && !_rotwSubmitted && gameData.finished[PLAYER_CAR_IDX]) {
    _rotwSubmitted = true;
    const etS = gameData.finishTimeS[PLAYER_CAR_IDX];
    const ghostBytes = ghostRecorder.finalize();
    submitRotwResult(rotwChallenge.week, etS, ghostBytes).then(async () => {
      // Pull the fresh top-10 (now including the just-submitted run) and
      // paint it into the post-race board.
      const top = await fetchTop(rotwChallenge.week, 10);
      renderRotwResultsBoard(top);
    });
  } else if (rotwActive) {
    // Already-submitted (e.g. RETRY → second result paints) — fetch + render
    fetchTop(rotwChallenge.week, 10).then(renderRotwResultsBoard);
  }

  async function recordCareerResult() {
    if (!careerState) return;
    // Standalone quick race (off the title screen) doesn't pay career gold.
    if (quickRaceMode && !_careerQuickRace) return;
    // Race-of-the-week is its own track with its own results UI (no res-gold
    // element) and doesn't pay career gold either.
    if (rotwActive) return;
    const won = gameData.winnerCarIdx === PLAYER_CAR_IDX;
    const perfectRT = gameData.rtS[PLAYER_CAR_IDX] > 0 && gameData.rtS[PLAYER_CAR_IDX] < 0.100;
    const reward = computeRaceReward({
      classIndex: careerState.classIndex,
      won,
      // Career quick race uses the lower 'quick' rate (50% of class base)
      // and doesn't count toward classWins / advancement.
      mode: _careerQuickRace ? 'quick' : 'career',
      perfectRT,
    });
    if (_careerQuickRace) {
      careerState = addGold(careerState, reward);
    } else if (won) {
      careerState = recordWin(careerState, { gold: reward });
    } else {
      careerState = recordLoss(careerState, { gold: reward });
    }
    await saveCareer(careerState);
    // Write gold delta only — the total is shown in the top bar.
    document.getElementById('res-gold').textContent = `+${reward}g`;
    // Top bar was rendered before the gold update — refresh so its total
    // reflects the new balance instead of the pre-race number.
    updateTopBar('screen-results');
  }
}
