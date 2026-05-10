import { SHOP_PACKS } from './balance.js';
import { spendNbucks, addGold } from './career.js';

/** Pure: would buying this pack succeed given current state? */
export function canAffordPack(state, pack) {
  return state && pack && state.nbucks >= pack.cost;
}

/** Pure: returns new state with pack applied. Throws on insufficient nbucks. */
export function applyPurchase(state, pack) {
  if (!canAffordPack(state, pack)) throw new Error('insufficient nbucks');
  let after = spendNbucks(state, pack.cost);
  after = addGold(after, pack.gold);
  return after;
}

/**
 * Render shop tiles. onPurchase(packId) is called when player taps an
 * affordable tile. Caller is responsible for confirm-modal + state save.
 */
export function renderShop(state, onPurchase) {
  const balanceEl = document.getElementById('shop-balance');
  if (balanceEl) {
    balanceEl.innerHTML = `<span class="nb">ⓝ ${state.nbucks.toLocaleString()}</span> &nbsp;·&nbsp; <span class="g">${state.gold.toLocaleString()}g</span>`;
  }
  const grid = document.getElementById('shop-packs');
  if (!grid) return;
  grid.innerHTML = '';
  for (const pack of SHOP_PACKS) {
    // Don't gate the tile by the local nbucks cache: PlaySDK is the source
    // of truth for the player's NBucks balance and will reject the spend
    // (with code: 'insufficient_balance') if they actually can't afford.
    // The visual hint stays for cached-balance mismatches.
    const afford = canAffordPack(state, pack);
    const tile = document.createElement('button');
    tile.className = 'pack-tile ' + (afford ? 'affordable' : 'unaffordable');
    tile.innerHTML = `
      <h3>${pack.id.toUpperCase()}</h3>
      <div class="gold-amt">${pack.gold.toLocaleString()}g</div>
      <div class="cost">ⓝ ${pack.cost.toLocaleString()}</div>
    `;
    tile.addEventListener('click', () => onPurchase(pack.id));
    grid.appendChild(tile);
  }
}
