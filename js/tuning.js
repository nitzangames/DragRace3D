/**
 * Apply per-car tuning adjustments to a car spec (post-parts).
 * @param {object} car  car spec (already with parts applied)
 * @param {object} tune  { launchRpm, tirePressure: [f, r], gearRatios: [...], finalDrive }
 * @returns {object} tuned car spec
 */
export function applyTuningToCar(car, tune) {
  const out = { ...car };

  // Launch RPM target (clamped to redline)
  if (tune.launchRpm != null) {
    out.launchRpmMax = Math.min(tune.launchRpm, car.redlineRpm);
  }

  // Gear ratios — only honored if transmission is tunable
  if (car.transmissionTunable && Array.isArray(tune.gearRatios)) {
    out.gearRatios = [...tune.gearRatios];
  }
  if (tune.finalDrive != null) {
    out.finalDrive = tune.finalDrive;
  }

  // Tire pressure → grip adjustment
  // Optimal range: 28-34 psi rear. Outside range loses grip.
  // Below 28: more contact patch → more grip (up to a limit).
  // Above 34: less contact patch → less grip.
  if (Array.isArray(tune.tirePressure)) {
    const rearPsi = tune.tirePressure[1];
    const optimalRear = 30;
    const delta = rearPsi - optimalRear;
    let gripAdj;
    if (delta < 0) {
      gripAdj = Math.min(0.05, -delta * 0.005);
    } else {
      gripAdj = -Math.min(0.10, delta * 0.005);
    }
    out.grip = car.grip + gripAdj;
  }

  return out;
}
