import { balance } from './balance.js';
import { formatGold } from './career-flow.js';

const SLOT_LABELS = {
  engine: 'Engine',
  turbo: 'Turbo / Boost',
  transmission: 'Transmission',
  tires: 'Tires',
  weight: 'Weight Reduction',
};

export function renderPartsShop(parent, careerState, ownedCar, onInstall) {
  parent.innerHTML = '';
  for (const slot of Object.keys(SLOT_LABELS)) {
    const tiers = balance.parts[slot];
    const installed = ownedCar.parts[slot];

    const section = document.createElement('div');
    section.className = 'parts-slot';
    section.innerHTML = `<h3>${SLOT_LABELS[slot]}</h3>`;

    const tierRow = document.createElement('div');
    tierRow.className = 'tier-row';
    for (let t = 0; t < tiers.length; t++) {
      const part = tiers[t];
      const isInstalled = installed === t;
      const isPrev = t < installed;
      const canBuy = !isInstalled && !isPrev && t === installed + 1 && careerState.gold >= part.price;
      const btn = document.createElement('button');
      btn.className = 'tier-btn'
        + (isInstalled ? ' installed' : '')
        + (isPrev ? ' owned' : '')
        + (canBuy ? ' buyable' : '')
        + (!isInstalled && !isPrev && !canBuy ? ' locked' : '');
      btn.innerHTML = `<div class="t-name">T${t} ${part.name}</div>`
        + (t === 0 ? '' : `<div class="t-price">${formatGold(part.price)}g</div>`);
      if (canBuy) {
        btn.addEventListener('click', () => onInstall(slot, t));
      }
      tierRow.appendChild(btn);
    }
    section.appendChild(tierRow);
    parent.appendChild(section);
  }
}
