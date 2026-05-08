import { VERSION, FIXED_DT, MAX_DT, GREEN_BAND_RPM, PLAYER_CAR_IDX } from './constants.js';
import { balance } from './balance.js';
import { allocGameData, resetRace } from './gameData.js';
import { tickRace } from './race-logic.js';
import { initInput } from './input.js';
import { buildRaceScene, renderFrame } from './renderer3d.js';
import { createChaseCamera, updateChaseCamera } from './camera3d.js';
import { buildTachSVG } from './tach.js';

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

function show(id) {
  document.querySelectorAll('#ui .screen').forEach(s => s.classList.add('hidden'));
  const el = document.getElementById(id);
  if (el) el.classList.remove('hidden');
}

function startRace() {
  if (!scene) {
    const built = buildRaceScene(balance);
    scene = built.scene; cars = built.cars; env = built.env;
  }
  resetRace(gameData, balance, Date.now() | 0);
  show('hud');
  started = true;
  const tachContainer = document.getElementById('tach-container');
  tachUpdater = buildTachSVG(tachContainer, balance.cars[0].redlineRpm, GREEN_BAND_RPM);
}

document.getElementById('btn-start').addEventListener('click', () => startRace());
document.getElementById('version-text').textContent = VERSION;

// Initial input wiring needs gameData reference; must be after gameData allocated.
initInput(gameData);

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
      tickRace(gameData, balance, FIXED_DT);
      acc -= FIXED_DT;
    }
    if (tachUpdater) tachUpdater.update(gameData.rpm[0], gameData.gear[0]);
    document.getElementById('hud-time').textContent =
      ((gameData.raceState === 'racing' || gameData.raceState === 'finished')
        ? (gameData.raceTimeS - gameData.racingStartS).toFixed(2)
        : '0.00') + 's';
    document.getElementById('hud-speed').textContent =
      Math.round(gameData.velMs[0] * 2.237) + ' mph';
    updateChaseCamera(camera, gameData);
    renderFrame(renderer, scene, camera, cars, env, gameData);
    if (gameData.raceState === 'finished' && !document.getElementById('screen-results')) {
      showResults();
    }
  }
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

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
      startRace();
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
}
