import { allocGameData, resetRace } from '../js/gameData.js';
import { tickRace } from '../js/race-logic.js';
import { applyPartsToCar } from '../js/parts.js';
import { applyTuningToCar } from '../js/tuning.js';
import { balance } from '../js/balance.js';
import { FIXED_DT } from '../js/constants.js';

// Run a full race scenario with a given player car spec; return ET.
function runRace(playerCarSpec) {
  const opp = balance.cars.find(c => c.id === 'b1');
  const localBalance = { ...balance, cars: [playerCarSpec, opp] };
  const gd = allocGameData(localBalance);
  resetRace(gd, localBalance, 12345);
  let shiftsLeft = 3, lastRpmAtTap = playerCarSpec.redlineRpm - 200;
  let t = 0;
  while (t < 30 && gd.raceState !== 'finished') {
    if (gd.raceState === 'staging' || gd.raceState === 'tree') {
      gd.inputGas[0] = 1; gd.inputShift[0] = 1;
    } else if (gd.raceState === 'launching') {
      if (gd.raceTimeS - gd.treeGreenAtS >= 0.30) gd.inputShift[0] = 0;
    } else if (gd.raceState === 'racing') {
      gd.inputGas[0] = 1;
      if (shiftsLeft > 0 && gd.velMs[0] > 4 && gd.rpm[0] >= lastRpmAtTap) {
        gd.inputShiftPressEdge[0] = 1; shiftsLeft--;
      }
    }
    tickRace(gd, localBalance, FIXED_DT);
    t += FIXED_DT;
  }
  return gd.finished[0] ? gd.finishTimeS[0] : null;
}

const baseCar = balance.cars.find(c => c.id === 'b1');

const setups = [
  { name: 'Stock',           parts: { engine: 0, turbo: 0, transmission: 0, tires: 0, weight: 0 } },
  { name: 'Engine T2',       parts: { engine: 2, turbo: 0, transmission: 0, tires: 0, weight: 0 } },
  { name: 'Engine T2 + Tires T2', parts: { engine: 2, turbo: 0, transmission: 0, tires: 2, weight: 0 } },
  { name: 'Full T2',         parts: { engine: 2, turbo: 2, transmission: 2, tires: 2, weight: 2 } },
  { name: 'Full T3+Carbon',  parts: { engine: 3, turbo: 3, transmission: 3, tires: 3, weight: 3 } },
  { name: 'Maxed',           parts: { engine: 4, turbo: 4, transmission: 4, tires: 4, weight: 3 } },
];

console.log('Setup'.padEnd(28) + 'ET (s)' + '   Δ from stock');
let stockET = null;
for (const s of setups) {
  const car = applyTuningToCar(applyPartsToCar(baseCar, s.parts, balance.parts), balance.defaultTune(baseCar));
  const et = runRace(car);
  if (stockET === null) stockET = et;
  const delta = et === null ? '—' : ((et - stockET).toFixed(2)).padStart(6) + 's';
  console.log(s.name.padEnd(28) + (et?.toFixed(3) ?? '— ').padEnd(10) + delta);
}
