import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canAffordPack, applyPurchase } from '../js/shop-screen.js';
import { newCareer } from '../js/career.js';
import { SHOP_PACKS } from '../js/balance.js';

test('SHOP_PACKS has 5 tiers with ascending cost and gold', () => {
  assert.equal(SHOP_PACKS.length, 5);
  for (let i = 1; i < SHOP_PACKS.length; i++) {
    assert.ok(SHOP_PACKS[i].cost > SHOP_PACKS[i - 1].cost);
    assert.ok(SHOP_PACKS[i].gold > SHOP_PACKS[i - 1].gold);
  }
});

test('canAffordPack=false at 0 nbucks for cheapest pack', () => {
  const s = newCareer(); // nbucks: 0
  assert.equal(canAffordPack(s, SHOP_PACKS[0]), false);
});

test('canAffordPack=true when nbucks >= cost', () => {
  const s = { ...newCareer(), nbucks: 500 };
  assert.equal(canAffordPack(s, SHOP_PACKS[0]), true);  // cost 100
  assert.equal(canAffordPack(s, SHOP_PACKS[1]), true);  // cost 500
  assert.equal(canAffordPack(s, SHOP_PACKS[2]), false); // cost 1000
});

test('applyPurchase deducts nbucks and grants gold', () => {
  const s = { ...newCareer(), nbucks: 5000, gold: 100 };
  const after = applyPurchase(s, SHOP_PACKS.find(p => p.id === 'medium')); // 500 → 1500
  assert.equal(after.nbucks, 4500);
  assert.equal(after.gold, 1600);
});

test('applyPurchase throws when unaffordable (state guard)', () => {
  const s = { ...newCareer(), nbucks: 0 };
  assert.throws(() => applyPurchase(s, SHOP_PACKS[0]), /insufficient nbucks/);
});
