// Tiny deterministic PRNG (mulberry32). Seed-driven so a given seed always
// yields identical AI behavior — important for ghost replay and testing.
function mulberry32(seed) {
  let s = seed >>> 0;
  return function () {
    s |= 0; s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Box-Muller — turn two uniform randoms into one normally-distributed sample
function gaussian(rng) {
  const u = Math.max(1e-12, rng());
  const v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/**
 * Sample a deterministic AI driver profile for a single race.
 * @param {number} carIdx       index of the AI car in balance.cars
 * @param {number} classIdx     class index (0=E, 5=Pro) — Plan 1 ignores; just for seed mixing
 * @param {number} seed         32-bit unsigned seed
 * @param {object} balance      from balance.js
 * @returns {{ rt: number, shiftAtRpm: number[] }}
 */
export function aiSample(carIdx, classIdx, seed, balance) {
  const rng = mulberry32(seed ^ ((carIdx + 1) * 0x9E3779B9) ^ ((classIdx + 1) * 0xBF58476D));
  const ai = balance.ai;
  const car = balance.cars[carIdx];

  const rt = Math.max(0, ai.rtMean + gaussian(rng) * ai.rtStd);

  const shiftAtRpm = [];
  for (let s = 0; s < 3; s++) {
    const slack = Math.max(0, ai.shiftBandSlackRpm + gaussian(rng) * ai.shiftBandSlackStd);
    shiftAtRpm.push(car.redlineRpm - slack);
  }
  return { rt, shiftAtRpm };
}
