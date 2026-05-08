// Plan-1 balance: 2 sample cars (one per side) on the classic strip.
// Real per-class roster comes in Plan 2.

export const balance = {
  cars: [
    {
      id: 'plan1-player',
      archetype: 'muscle',          // matches car-models.js builders
      color1: 0x2a8fd4, color2: 0x122a38,
      mass: 1450,                   // kg
      grip: 1.2,                    // tire grip coefficient (Plan-1 default)
      dragCoef: 0.42,
      rollingResistance: 0.012,
      redlineRpm: 6800,
      idleRpm: 900,
      launchRpmMax: 5500,
      engineResponse: 8.0,          // 1/s — how fast rpm tracks target_rpm
      gearRatios: [3.4, 2.1, 1.5, 1.0],
      finalDrive: 3.55,
      wheelRadius: 0.34,
      torquePeakNm: 600,            // peak engine torque
      torquePeakRpm: 5000,
      torqueWidth: 1800,            // RPM half-width of torque bell curve
    },
    {
      id: 'plan1-opponent',
      archetype: 'sport',
      color1: 0xc83a26, color2: 0x32100d,
      mass: 1380,
      grip: 1.15,
      dragCoef: 0.40,
      rollingResistance: 0.012,
      redlineRpm: 7200,
      idleRpm: 950,
      launchRpmMax: 5800,
      engineResponse: 8.5,
      gearRatios: [3.2, 2.0, 1.45, 0.95],
      finalDrive: 3.7,
      wheelRadius: 0.33,
      torquePeakNm: 540,
      torquePeakRpm: 5400,
      torqueWidth: 1700,
    },
  ],
  ai: {
    rtMean: 0.32,
    rtStd: 0.08,
    shiftBandSlackRpm: 250,         // AI may shift this many RPM short of redline
    shiftBandSlackStd: 120,
  },
  env: { id: 'classic' },
};
