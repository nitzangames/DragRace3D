/**
 * Apply parts modifiers to a base car spec.
 * Returns a NEW car object (does not mutate input).
 *
 * @param {object} baseCar  car spec from balance.cars
 * @param {object} parts    { engine: 0..4, turbo: 0..4, transmission: 0..4, tires: 0..4, weight: 0..3 }
 * @param {object} catalog  balance.parts
 * @returns {object} tuned car spec
 */
export function applyPartsToCar(baseCar, parts, catalog) {
  const eng = catalog.engine[parts.engine] || catalog.engine[0];
  const tur = catalog.turbo[parts.turbo] || catalog.turbo[0];
  const txm = catalog.transmission[parts.transmission] || catalog.transmission[0];
  const tir = catalog.tires[parts.tires] || catalog.tires[0];
  const wgt = catalog.weight[parts.weight] || catalog.weight[0];

  return {
    ...baseCar,
    torquePeakNm: baseCar.torquePeakNm * eng.torquePeakMul * tur.torquePeakMul,
    torqueWidth:  baseCar.torqueWidth * tur.torqueWidthMul,
    redlineRpm:   baseCar.redlineRpm + eng.redlineDelta + tur.redlineDelta,
    mass:         baseCar.mass * wgt.massMul,
    grip:         baseCar.grip + tir.gripDelta,
    engineResponse: baseCar.engineResponse + txm.engineResponseDelta,
    transmissionTunable: txm.tunable,
  };
}
