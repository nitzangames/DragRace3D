import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  newCareer, addOwnedCar, removeOwnedCar, setCurrentCar,
  recordWin, recordLoss, addGold, spendGold,
  getCurrentClassWins, isClassComplete,
  spendNbucks, addNbucks, unlockEnv,
} from '../js/career.js';
import { balance } from '../js/balance.js';
import { CLASS_WINS_REQUIRED } from '../js/constants.js';

test('newCareer starts at class E with no cars and starting gold', () => {
  const c = newCareer();
  assert.equal(c.classIndex, 0);
  assert.equal(c.classWins, 0);
  assert.deepEqual(c.ownedCars, []);
  assert.equal(c.currentCarId, null);
  assert.ok(c.gold > 0);
});

test('addOwnedCar adds to ownedCars + sets as current if first', () => {
  let c = newCareer();
  c = addOwnedCar(c, { carId: 'e1', parts: {}, tune: {}, paint: {} });
  assert.equal(c.ownedCars.length, 1);
  assert.equal(c.currentCarId, 'e1');
});

test('addOwnedCar does NOT change currentCarId if already set', () => {
  let c = newCareer();
  c = addOwnedCar(c, { carId: 'e1', parts: {}, tune: {}, paint: {} });
  c = addOwnedCar(c, { carId: 'e2', parts: {}, tune: {}, paint: {} });
  assert.equal(c.currentCarId, 'e1');
  assert.equal(c.ownedCars.length, 2);
});

test('recordWin increments classWins and gold', () => {
  let c = newCareer();
  c = addGold(c, 0);
  const startGold = c.gold;
  c = recordWin(c, { gold: 100 });
  assert.equal(c.classWins, 1);
  assert.equal(c.gold, startGold + 100);
});

test('isClassComplete true when classWins >= CLASS_WINS_REQUIRED', () => {
  let c = newCareer();
  for (let i = 0; i < CLASS_WINS_REQUIRED; i++) {
    c = recordWin(c, { gold: 100 });
  }
  assert.ok(isClassComplete(c));
});

test('recordWin advances class once threshold met (resets classWins)', () => {
  let c = newCareer();
  for (let i = 0; i < CLASS_WINS_REQUIRED; i++) {
    c = recordWin(c, { gold: 100 });
  }
  c = recordWin(c, { gold: 100 });
  assert.equal(c.classIndex, 1);
  assert.equal(c.classWins, 1);
});

test('spendGold deducts gold; throws if insufficient', () => {
  let c = newCareer();
  const startGold = c.gold;
  c = spendGold(c, 50);
  assert.equal(c.gold, startGold - 50);
  assert.throws(() => spendGold(c, c.gold + 1));
});

test('removeOwnedCar removes from ownedCars (and clears current if it was)', () => {
  let c = newCareer();
  c = addOwnedCar(c, { carId: 'e1', parts: {}, tune: {}, paint: {} });
  c = addOwnedCar(c, { carId: 'e2', parts: {}, tune: {}, paint: {} });
  c = removeOwnedCar(c, 'e1');
  assert.equal(c.ownedCars.length, 1);
  assert.equal(c.currentCarId, 'e2');
});

test('newCareer starts with nbucks=0 and bleachers as the sole starter track', () => {
  const s = newCareer();
  assert.equal(s.nbucks, 0);
  assert.deepEqual(s.unlockedEnvs, ['bleachers']);
});

test('spendNbucks deducts; throws when insufficient', () => {
  const s = { ...newCareer(), nbucks: 10 };
  const after = spendNbucks(s, 4);
  assert.equal(after.nbucks, 6);
  assert.throws(() => spendNbucks(s, 11), /insufficient nbucks/);
});

test('addNbucks adds (no cap)', () => {
  const s = { ...newCareer(), nbucks: 3 };
  assert.equal(addNbucks(s, 7).nbucks, 10);
});

test('unlockEnv adds id; idempotent', () => {
  let s = newCareer();
  s = unlockEnv(s, 'industrial');
  assert.deepEqual(s.unlockedEnvs, ['bleachers', 'industrial']);
  s = unlockEnv(s, 'industrial');
  assert.deepEqual(s.unlockedEnvs, ['bleachers', 'industrial']);
});

test('recordWin unlocks env when class advances', () => {
  // Start at class E with 5 wins → next win advances to class D (idx 1),
  // which unlocks the two D-class urban tracks (industrial + junkyard).
  let s = { ...newCareer(), classIndex: 0, classWins: 5 };
  s = recordWin(s, { gold: 100 });
  assert.equal(s.classIndex, 1);
  assert.ok(s.unlockedEnvs.includes('industrial'));
  assert.ok(s.unlockedEnvs.includes('junkyard'));
});
