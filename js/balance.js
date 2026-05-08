// Plan-2 balance: 23 cars across 6 classes + parts catalog.
// Per-car id is the key into ownedCars/currentCarId.

const cars = [
  // Class E — Street (4 cars)
  // E-class tuning: keep wide gear-ratio spread (gear 4 ≈ 1.0 is needed for
  // top speed without redlining), but widen the torque curve substantially so
  // post-shift RPM stays in the power band regardless of where in the green
  // zone the player shifts. Force drop on shift stays under ~15%.
  { id: 'e1', classIndex: 0, name: 'Civitas', archetype: 'sedan',  color1: 0x4d6dd6, color2: 0x2a3950, price: 1500,  mass: 1280, grip: 1.05, dragCoef: 0.40, rollingResistance: 0.013, redlineRpm: 6500, idleRpm: 850,  launchRpmMax: 5200, engineResponse: 7.5, gearRatios: [3.5, 2.2, 1.5, 1.0], finalDrive: 3.7,  wheelRadius: 0.32, torquePeakNm: 220, torquePeakRpm: 4500, torqueWidth: 2200 },
  { id: 'e2', classIndex: 0, name: 'Hatch GT',  archetype: 'hatch',  color1: 0xe2c11a, color2: 0x222222, price: 1900,  mass: 1180, grip: 1.10, dragCoef: 0.39, rollingResistance: 0.012, redlineRpm: 6800, idleRpm: 900,  launchRpmMax: 5400, engineResponse: 8.0, gearRatios: [3.6, 2.1, 1.5, 1.0], finalDrive: 3.85, wheelRadius: 0.32, torquePeakNm: 260, torquePeakRpm: 4700, torqueWidth: 2200 },
  { id: 'e3', classIndex: 0, name: 'Compact RS', archetype: 'hatch',  color1: 0xe04545, color2: 0x222222, price: 2300,  mass: 1200, grip: 1.12, dragCoef: 0.38, rollingResistance: 0.012, redlineRpm: 7000, idleRpm: 900,  launchRpmMax: 5600, engineResponse: 8.2, gearRatios: [3.5, 2.1, 1.5, 1.0], finalDrive: 3.85, wheelRadius: 0.32, torquePeakNm: 290, torquePeakRpm: 4900, torqueWidth: 2200 },
  { id: 'e4', classIndex: 0, name: 'Sedan SE',  archetype: 'sedan',  color1: 0x4040a0, color2: 0x202050, price: 2700,  mass: 1330, grip: 1.05, dragCoef: 0.41, rollingResistance: 0.013, redlineRpm: 6200, idleRpm: 850,  launchRpmMax: 5000, engineResponse: 7.4, gearRatios: [3.4, 2.0, 1.4, 1.0], finalDrive: 3.6,  wheelRadius: 0.33, torquePeakNm: 320, torquePeakRpm: 4400, torqueWidth: 2200 },

  // Class D — Modified (4)
  { id: 'd1', classIndex: 1, name: 'Hot Hatch R', archetype: 'hatch', color1: 0x18b8a0, color2: 0x222222, price: 4500,  mass: 1240, grip: 1.18, dragCoef: 0.37, rollingResistance: 0.012, redlineRpm: 7200, idleRpm: 900,  launchRpmMax: 5800, engineResponse: 8.5, gearRatios: [3.4, 2.1, 1.5, 1.0], finalDrive: 3.85, wheelRadius: 0.33, torquePeakNm: 360, torquePeakRpm: 5000, torqueWidth: 1600 },
  { id: 'd2', classIndex: 1, name: 'Track Spec', archetype: 'hatch', color1: 0xff8a3a, color2: 0x222222, price: 5500,  mass: 1180, grip: 1.22, dragCoef: 0.36, rollingResistance: 0.011, redlineRpm: 7400, idleRpm: 900,  launchRpmMax: 5900, engineResponse: 8.6, gearRatios: [3.3, 2.0, 1.45, 1.0], finalDrive: 3.9,  wheelRadius: 0.33, torquePeakNm: 380, torquePeakRpm: 5100, torqueWidth: 1600 },
  { id: 'd3', classIndex: 1, name: 'Pony',      archetype: 'sport', color1: 0x6c40a8, color2: 0x222222, price: 6800,  mass: 1380, grip: 1.15, dragCoef: 0.36, rollingResistance: 0.012, redlineRpm: 7000, idleRpm: 900,  launchRpmMax: 5700, engineResponse: 8.0, gearRatios: [3.3, 2.0, 1.45, 0.95], finalDrive: 3.7, wheelRadius: 0.34, torquePeakNm: 420, torquePeakRpm: 4900, torqueWidth: 1700 },
  { id: 'd4', classIndex: 1, name: 'Coupe S',   archetype: 'sport', color1: 0x202020, color2: 0x101010, price: 8000,  mass: 1340, grip: 1.20, dragCoef: 0.35, rollingResistance: 0.011, redlineRpm: 7100, idleRpm: 900,  launchRpmMax: 5750, engineResponse: 8.2, gearRatios: [3.3, 2.0, 1.45, 0.95], finalDrive: 3.7, wheelRadius: 0.34, torquePeakNm: 440, torquePeakRpm: 5000, torqueWidth: 1700 },

  // Class C — Sport (4)
  { id: 'c1', classIndex: 2, name: 'GT-S',     archetype: 'sport', color1: 0xc83a26, color2: 0x32100d, price: 14000, mass: 1380, grip: 1.25, dragCoef: 0.34, rollingResistance: 0.011, redlineRpm: 7400, idleRpm: 950,  launchRpmMax: 5900, engineResponse: 8.5, gearRatios: [3.2, 2.0, 1.4, 0.95], finalDrive: 3.7, wheelRadius: 0.34, torquePeakNm: 480, torquePeakRpm: 5200, torqueWidth: 1700 },
  { id: 'c2', classIndex: 2, name: 'Spectre',  archetype: 'sport', color1: 0x101820, color2: 0x080808, price: 17000, mass: 1320, grip: 1.30, dragCoef: 0.33, rollingResistance: 0.011, redlineRpm: 7600, idleRpm: 950,  launchRpmMax: 6000, engineResponse: 8.7, gearRatios: [3.2, 2.0, 1.4, 0.9], finalDrive: 3.75, wheelRadius: 0.34, torquePeakNm: 500, torquePeakRpm: 5300, torqueWidth: 1700 },
  { id: 'c3', classIndex: 2, name: 'Vantage T', archetype: 'sport', color1: 0x2a8fd4, color2: 0x122a38, price: 20000, mass: 1360, grip: 1.28, dragCoef: 0.33, rollingResistance: 0.011, redlineRpm: 7500, idleRpm: 950,  launchRpmMax: 5950, engineResponse: 8.6, gearRatios: [3.2, 2.0, 1.4, 0.9], finalDrive: 3.75, wheelRadius: 0.34, torquePeakNm: 520, torquePeakRpm: 5300, torqueWidth: 1700 },
  { id: 'c4', classIndex: 2, name: 'Apex 1',   archetype: 'sport', color1: 0xffffff, color2: 0x080808, price: 24000, mass: 1290, grip: 1.32, dragCoef: 0.32, rollingResistance: 0.010, redlineRpm: 7800, idleRpm: 950,  launchRpmMax: 6100, engineResponse: 8.8, gearRatios: [3.1, 1.95, 1.4, 0.9], finalDrive: 3.85, wheelRadius: 0.34, torquePeakNm: 540, torquePeakRpm: 5400, torqueWidth: 1700 },

  // Class B — Muscle (4)
  { id: 'b1', classIndex: 3, name: 'Stallion',  archetype: 'muscle', color1: 0x2a8fd4, color2: 0x122a38, price: 38000,  mass: 1620, grip: 1.30, dragCoef: 0.36, rollingResistance: 0.011, redlineRpm: 6800, idleRpm: 900,  launchRpmMax: 5500, engineResponse: 8.0, gearRatios: [3.4, 2.1, 1.5, 1.0], finalDrive: 3.55, wheelRadius: 0.34, torquePeakNm: 660, torquePeakRpm: 4900, torqueWidth: 1900 },
  { id: 'b2', classIndex: 3, name: 'Boss 9',    archetype: 'muscle', color1: 0xff7f00, color2: 0x222222, price: 46000,  mass: 1700, grip: 1.32, dragCoef: 0.37, rollingResistance: 0.011, redlineRpm: 6700, idleRpm: 900,  launchRpmMax: 5400, engineResponse: 7.9, gearRatios: [3.5, 2.1, 1.5, 1.0], finalDrive: 3.55, wheelRadius: 0.35, torquePeakNm: 720, torquePeakRpm: 4800, torqueWidth: 1900 },
  { id: 'b3', classIndex: 3, name: 'Charger T', archetype: 'muscle', color1: 0x080808, color2: 0x080808, price: 54000,  mass: 1750, grip: 1.30, dragCoef: 0.37, rollingResistance: 0.011, redlineRpm: 6600, idleRpm: 900,  launchRpmMax: 5300, engineResponse: 7.8, gearRatios: [3.5, 2.1, 1.5, 1.0], finalDrive: 3.55, wheelRadius: 0.35, torquePeakNm: 770, torquePeakRpm: 4800, torqueWidth: 2000 },
  { id: 'b4', classIndex: 3, name: 'Vipera',    archetype: 'muscle', color1: 0xc02a2a, color2: 0x222222, price: 65000,  mass: 1640, grip: 1.35, dragCoef: 0.35, rollingResistance: 0.011, redlineRpm: 7000, idleRpm: 900,  launchRpmMax: 5600, engineResponse: 8.2, gearRatios: [3.4, 2.0, 1.45, 1.0], finalDrive: 3.55, wheelRadius: 0.34, torquePeakNm: 800, torquePeakRpm: 5000, torqueWidth: 1900 },

  // Class A — Supercar (4)
  { id: 'a1', classIndex: 4, name: 'Aria',     archetype: 'supercar', color1: 0xffd14a, color2: 0x080808, price: 130000, mass: 1480, grip: 1.45, dragCoef: 0.30, rollingResistance: 0.010, redlineRpm: 8500, idleRpm: 1000, launchRpmMax: 6800, engineResponse: 9.2, gearRatios: [3.0, 1.85, 1.35, 0.85], finalDrive: 3.7, wheelRadius: 0.34, torquePeakNm: 720, torquePeakRpm: 6000, torqueWidth: 1900 },
  { id: 'a2', classIndex: 4, name: 'Tempo',    archetype: 'supercar', color1: 0x1aaf65, color2: 0x101a14, price: 175000, mass: 1430, grip: 1.50, dragCoef: 0.30, rollingResistance: 0.010, redlineRpm: 8800, idleRpm: 1000, launchRpmMax: 7000, engineResponse: 9.4, gearRatios: [3.0, 1.85, 1.35, 0.85], finalDrive: 3.75, wheelRadius: 0.34, torquePeakNm: 760, torquePeakRpm: 6200, torqueWidth: 1900 },
  { id: 'a3', classIndex: 4, name: 'Strada',   archetype: 'supercar', color1: 0x2a4a98, color2: 0x080808, price: 220000, mass: 1450, grip: 1.50, dragCoef: 0.29, rollingResistance: 0.010, redlineRpm: 8800, idleRpm: 1000, launchRpmMax: 7000, engineResponse: 9.5, gearRatios: [3.0, 1.85, 1.35, 0.85], finalDrive: 3.85, wheelRadius: 0.34, torquePeakNm: 800, torquePeakRpm: 6300, torqueWidth: 1900 },
  { id: 'a4', classIndex: 4, name: 'Apex Pro', archetype: 'supercar', color1: 0xffffff, color2: 0x080808, price: 290000, mass: 1410, grip: 1.55, dragCoef: 0.28, rollingResistance: 0.009, redlineRpm: 9000, idleRpm: 1000, launchRpmMax: 7100, engineResponse: 9.6, gearRatios: [3.0, 1.85, 1.35, 0.85], finalDrive: 3.85, wheelRadius: 0.34, torquePeakNm: 850, torquePeakRpm: 6400, torqueWidth: 1900 },

  // Class Pro — Unlimited (3)
  { id: 'p1', classIndex: 5, name: 'Top Fuel I',  archetype: 'topfuel', color1: 0xb02a8a, color2: 0x1a1a1a, price: 600000,  mass: 1050, grip: 1.80, dragCoef: 0.28, rollingResistance: 0.009, redlineRpm: 9500, idleRpm: 1100, launchRpmMax: 7800, engineResponse: 10.0, gearRatios: [2.6, 1.7, 1.25, 0.85], finalDrive: 4.1, wheelRadius: 0.40, torquePeakNm: 1500, torquePeakRpm: 7200, torqueWidth: 2200 },
  { id: 'p2', classIndex: 5, name: 'Top Fuel II', archetype: 'topfuel', color1: 0xff3a3a, color2: 0x1a1a1a, price: 1200000, mass: 1020, grip: 1.85, dragCoef: 0.27, rollingResistance: 0.009, redlineRpm: 9700, idleRpm: 1100, launchRpmMax: 7900, engineResponse: 10.1, gearRatios: [2.6, 1.7, 1.25, 0.85], finalDrive: 4.1, wheelRadius: 0.40, torquePeakNm: 1700, torquePeakRpm: 7300, torqueWidth: 2200 },
  { id: 'p3', classIndex: 5, name: 'Funny Car',   archetype: 'topfuel', color1: 0x33dd55, color2: 0x1a1a1a, price: 2400000, mass: 1000, grip: 1.90, dragCoef: 0.27, rollingResistance: 0.009, redlineRpm: 9800, idleRpm: 1100, launchRpmMax: 8000, engineResponse: 10.2, gearRatios: [2.6, 1.7, 1.25, 0.85], finalDrive: 4.15, wheelRadius: 0.40, torquePeakNm: 1900, torquePeakRpm: 7400, torqueWidth: 2200 },
];

// Parts catalog: 5 slots, multiple tiers each. Tier 0 = stock (no install).
const parts = {
  engine: [
    { tier: 0, name: 'Stock',         price: 0,     torquePeakMul: 1.00, redlineDelta: 0 },
    { tier: 1, name: 'Street Tune',   price: 100,   torquePeakMul: 1.05, redlineDelta: 100 },
    { tier: 2, name: 'Performance',   price: 5800,  torquePeakMul: 1.12, redlineDelta: 300 },
    { tier: 3, name: 'Built Block',   price: 18000, torquePeakMul: 1.22, redlineDelta: 600 },
    { tier: 4, name: 'Race Internals', price: 48000, torquePeakMul: 1.35, redlineDelta: 1000 },
  ],
  turbo: [
    { tier: 0, name: 'None',           price: 0,     torquePeakMul: 1.00, torqueWidthMul: 1.00, redlineDelta: 0 },
    { tier: 1, name: 'Bolt-on Turbo',  price: 100,   torquePeakMul: 1.10, torqueWidthMul: 1.05, redlineDelta: 0 },
    { tier: 2, name: 'Big Single',     price: 14000, torquePeakMul: 1.20, torqueWidthMul: 1.08, redlineDelta: 100 },
    { tier: 3, name: 'Twin Turbo',     price: 32000, torquePeakMul: 1.32, torqueWidthMul: 1.10, redlineDelta: 200 },
    { tier: 4, name: 'Quad Compound',  price: 80000, torquePeakMul: 1.50, torqueWidthMul: 1.15, redlineDelta: 300 },
  ],
  transmission: [
    { tier: 0, name: 'Stock',         price: 0,     engineResponseDelta: 0,   tunable: false },
    { tier: 1, name: 'Short Shift',   price: 100,   engineResponseDelta: 0.3, tunable: false },
    { tier: 2, name: 'Sequential',    price: 4200,  engineResponseDelta: 0.7, tunable: false },
    { tier: 3, name: 'Custom Ratios', price: 12000, engineResponseDelta: 1.0, tunable: true  },
    { tier: 4, name: 'Race Spec',     price: 30000, engineResponseDelta: 1.5, tunable: true  },
  ],
  tires: [
    { tier: 0, name: 'OEM',          price: 0,     gripDelta: 0.00 },
    { tier: 1, name: 'Performance',  price: 100,   gripDelta: 0.05 },
    { tier: 2, name: 'Sticky',       price: 2200,  gripDelta: 0.12 },
    { tier: 3, name: 'Drag Radials', price: 7000,  gripDelta: 0.22 },
    { tier: 4, name: 'Slicks',       price: 20000, gripDelta: 0.35 },
  ],
  weight: [
    { tier: 0, name: 'Stock',           price: 0,     massMul: 1.00 },
    { tier: 1, name: 'Strip Interior',  price: 100,   massMul: 0.95 },
    { tier: 2, name: 'Lightweight',     price: 6500,  massMul: 0.88 },
    { tier: 3, name: 'Carbon',          price: 22000, massMul: 0.78 },
  ],
};

function defaultTune(car) {
  return {
    launchRpm: car.launchRpmMax,
    tirePressure: [32, 30],
    gearRatios: [...car.gearRatios],
    finalDrive: car.finalDrive,
  };
}

const ai = {
  rtMean: 0.32,
  rtStd: 0.08,
  shiftBandSlackRpm: 250,
  shiftBandSlackStd: 120,
};

const env = { id: 'classic' };

/**
 * Pick a deterministic opponent car id from the same class as the player's car.
 * Excludes the player's chosen car id. Uses a seeded shuffle for variety.
 */
export function pickOpponentCarId(classIndex, excludeId, seed) {
  const candidates = cars.filter(c => c.classIndex === classIndex && c.id !== excludeId);
  if (candidates.length === 0) return null;
  const idx = ((seed >>> 0) * 2654435761) >>> 0;
  return candidates[idx % candidates.length].id;
}

export const balance = { cars, parts, ai, env, defaultTune };
