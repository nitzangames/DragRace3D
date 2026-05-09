import { balance } from './balance.js';
import { CLASS_NAMES, NUM_CLASSES } from './constants.js';
import { formatGold } from './career-flow.js';
import { mountPaintPreview } from './paint-preview.js';

// Per-class car index, persisted between class swaps so each tab remembers
// where the player was. Reset on entry to a class with fewer cars than the
// stored index (handled per-render).
const _idxByClass = new Array(NUM_CLASSES).fill(0);
let _activeClass = 0;

export function renderBuyShop(careerState, onBuy) {
  const tabBar = document.getElementById('buyshop-class-tabs');
  tabBar.innerHTML = '';

  for (let cls = 0; cls < NUM_CLASSES; cls++) {
    const btn = document.createElement('button');
    btn.className = 'tab' + (cls === careerState.classIndex ? ' active' : '');
    btn.textContent = CLASS_NAMES[cls];
    btn.dataset.cls = cls;
    btn.addEventListener('click', () => _switchClass(cls, careerState, onBuy));
    tabBar.appendChild(btn);
  }

  _switchClass(careerState.classIndex, careerState, onBuy);
}

function _switchClass(cls, careerState, onBuy) {
  _activeClass = cls;
  document.querySelectorAll('#buyshop-class-tabs .tab').forEach((b) => {
    b.classList.toggle('active', +b.dataset.cls === cls);
  });
  // Bound the per-class index in case the class roster changed.
  const carsInClass = balance.cars.filter((c) => c.classIndex === cls);
  if (_idxByClass[cls] >= carsInClass.length) _idxByClass[cls] = 0;
  _renderCurrent(careerState, onBuy);
}

function _renderCurrent(careerState, onBuy) {
  const cls = _activeClass;
  const cars = balance.cars.filter((c) => c.classIndex === cls);
  const previewParent = document.getElementById('buyshop-preview');
  const info = document.getElementById('buyshop-car-info');
  const prevBtn = document.getElementById('buyshop-prev');
  const nextBtn = document.getElementById('buyshop-next');
  const buyBtn = document.getElementById('btn-buyshop-buy');

  if (cars.length === 0) {
    previewParent.innerHTML = '<div class="empty">No cars available in this class.</div>';
    info.innerHTML = '';
    prevBtn.disabled = true;
    nextBtn.disabled = true;
    buyBtn.classList.add('hidden');
    return;
  }

  const car = cars[_idxByClass[cls]];
  const ownedIds = new Set(careerState.ownedCars.map((o) => o.carId));
  const owned = ownedIds.has(car.id);
  const affordable = !owned && careerState.gold >= car.price;

  // Preview uses the car's stock paint colors. Preserve any existing canvas
  // so mountPaintPreview's reuse path keeps the WebGL context alive across
  // cycle taps (mobile-Safari context-cap fix).
  for (let i = previewParent.children.length - 1; i >= 0; i--) {
    const c = previewParent.children[i];
    if (c.tagName !== 'CANVAS') c.remove();
  }
  mountPaintPreview(previewParent, car.archetype, {
    primary: car.color1,
    secondary: car.color2,
    stripe: 'none',
  });

  info.innerHTML = `
    <h3>${car.name}${owned ? '  (owned)' : ''}</h3>
    <div class="meta">CLASS ${CLASS_NAMES[car.classIndex]} · ${car.archetype} · ${car.torquePeakNm}Nm · ${car.mass}kg · ${_idxByClass[cls] + 1}/${cars.length}</div>
    <div class="meta" style="margin-top:6px;font-size:18px;color:#ffd14a;font-weight:700;">${formatGold(car.price)}g</div>
  `;

  const single = cars.length <= 1;
  prevBtn.disabled = single;
  nextBtn.disabled = single;
  prevBtn.onclick = () => {
    _idxByClass[cls] = (_idxByClass[cls] - 1 + cars.length) % cars.length;
    _renderCurrent(careerState, onBuy);
  };
  nextBtn.onclick = () => {
    _idxByClass[cls] = (_idxByClass[cls] + 1) % cars.length;
    _renderCurrent(careerState, onBuy);
  };

  // BUY button — disabled if owned or unaffordable. Label changes accordingly.
  buyBtn.classList.remove('hidden');
  if (owned) {
    buyBtn.textContent = 'OWNED';
    buyBtn.disabled = true;
  } else if (!affordable) {
    buyBtn.textContent = `NEED ${formatGold(car.price - careerState.gold)}g MORE`;
    buyBtn.disabled = true;
  } else {
    buyBtn.textContent = `BUY (${formatGold(car.price)}g)`;
    buyBtn.disabled = false;
  }
  buyBtn.onclick = () => {
    if (!affordable || owned) return;
    onBuy(car.id);
  };
}
