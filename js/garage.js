import { balance } from './balance.js';
import { CLASS_NAMES } from './constants.js';
import { mountPaintPreview } from './paint-preview.js';

// Index into careerState.ownedCars currently displayed in the carousel.
// Persists across renderGarage calls (prev/next swap) but resets to the
// "current" car each time renderGarage is called from outside.
let _carouselIdx = 0;

/**
 * Show the carousel for the player's owned cars. The viewer shows ONE car
 * at a time as a rotating 3D preview; ‹ › buttons cycle through the list.
 *
 * onCarPick(carId) is invoked when the player taps CUSTOMIZE — that's the
 * hand-off into the cardetail screen (parts/tune/paint/sell).
 */
export function renderGarage(careerState, onCarPick) {
  const owned = careerState.ownedCars;
  const previewParent = document.getElementById('garage-preview');
  const info = document.getElementById('garage-car-info');
  const prevBtn = document.getElementById('garage-prev');
  const nextBtn = document.getElementById('garage-next');
  const customizeBtn = document.getElementById('btn-garage-customize');
  const nextRaceBtn = document.getElementById('btn-garage-next-race');

  if (owned.length === 0) {
    previewParent.innerHTML = '<div class="empty">No cars yet — buy one to get started.</div>';
    info.innerHTML = '';
    if (prevBtn) prevBtn.disabled = true;
    if (nextBtn) nextBtn.disabled = true;
    if (customizeBtn) customizeBtn.classList.add('hidden');
    if (nextRaceBtn) nextRaceBtn.classList.add('hidden');
    return;
  }

  // On entry from outside, prefer the current car so the player sees their
  // active ride first. Bound the index in case ownedCars shrunk (e.g. sold).
  if (_carouselIdx >= owned.length) {
    const curIdx = owned.findIndex(c => c.carId === careerState.currentCarId);
    _carouselIdx = curIdx >= 0 ? curIdx : 0;
  }

  _renderCurrent(careerState, onCarPick);
}

function _renderCurrent(careerState, onCarPick) {
  const owned = careerState.ownedCars;
  const ownedCar = owned[_carouselIdx];
  const car = balance.cars.find(c => c.id === ownedCar.carId);

  // Mount the 3D preview. mountPaintPreview reuses the existing renderer
  // if its canvas is still attached to this parent (it almost always is) —
  // critical on mobile Safari, where every fresh WebGLRenderer chews through
  // the per-process WebGL-context cap and a few prev/next taps OOM the tab.
  // Only clear stale non-canvas content (e.g. the "no cars yet" empty div).
  const previewParent = document.getElementById('garage-preview');
  for (let i = previewParent.children.length - 1; i >= 0; i--) {
    const c = previewParent.children[i];
    if (c.tagName !== 'CANVAS') c.remove();
  }
  mountPaintPreview(previewParent, car.archetype, ownedCar.paint);

  const isCurrent = careerState.currentCarId === ownedCar.carId;
  const info = document.getElementById('garage-car-info');
  info.innerHTML = `
    <h3>${car.name}</h3>
    <div class="meta">CLASS ${CLASS_NAMES[car.classIndex]} · ${car.archetype} · ${_carouselIdx + 1}/${owned.length}</div>
    ${isCurrent ? '<div class="current-tag">CURRENT</div>' : ''}
  `;

  const prevBtn = document.getElementById('garage-prev');
  const nextBtn = document.getElementById('garage-next');
  const single = owned.length <= 1;
  prevBtn.disabled = single;
  nextBtn.disabled = single;
  // Use direct onclick assignment so re-rendering replaces the previous
  // handler — addEventListener would stack handlers and fire multiple times.
  prevBtn.onclick = () => {
    _carouselIdx = (_carouselIdx - 1 + owned.length) % owned.length;
    _renderCurrent(careerState, onCarPick);
  };
  nextBtn.onclick = () => {
    _carouselIdx = (_carouselIdx + 1) % owned.length;
    _renderCurrent(careerState, onCarPick);
  };

  const customizeBtn = document.getElementById('btn-garage-customize');
  customizeBtn.classList.remove('hidden');
  customizeBtn.onclick = () => onCarPick(ownedCar.carId);

  const nextRaceBtn = document.getElementById('btn-garage-next-race');
  if (nextRaceBtn) {
    const canRace = !!careerState.currentCarId;
    nextRaceBtn.classList.toggle('hidden', !canRace);
  }
}

/** Reset carousel index — call when the careerState identity changes
 *  (new career, load, etc.) so we don't surface a stale index. */
export function resetGarageCarousel() { _carouselIdx = 0; }

export function renderCarDetail(careerState, ownedCar) {
  const car = balance.cars.find(c => c.id === ownedCar.carId);
  document.getElementById('cardetail-name').textContent = car.name;
  document.getElementById('cardetail-class').textContent =
    'CLASS ' + CLASS_NAMES[car.classIndex] + ' · ' + car.archetype;

  // SET AS CURRENT visibility — hide if already current
  const setBtn = document.getElementById('btn-cardetail-set-current');
  setBtn.classList.toggle('hidden', careerState.currentCarId === car.id);
}
