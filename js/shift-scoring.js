/**
 * Classify a shift tap by RPM at the moment of tap.
 * @param {number} rpm  current engine RPM
 * @param {number} redline  car's redline RPM
 * @param {number} band  width (RPM) of the green window before redline
 * @returns {'early' | 'green' | 'past'}
 */
export function shiftQuality(rpm, redline, band) {
  if (rpm > redline) return 'past';
  if (rpm >= redline - band) return 'green';
  return 'early';
}

/**
 * Compute the ET (elapsed time) bonus from reaction time.
 * @param {number} rtS  reaction time in seconds (negative = jump-start)
 * @returns {number}  seconds to add to ET (negative = bonus)
 */
export function rtBonus(rtS) {
  if (rtS < 0) return 0;
  if (rtS < 0.100) return -0.020;
  return 0;
}

/**
 * @param {number} timeAtLimiterS  cumulative time the car has spent at redline
 * @param {number} thresholdS  configured threshold from constants
 * @returns {boolean}
 */
export function blowThresholdReached(timeAtLimiterS, thresholdS) {
  return timeAtLimiterS >= thresholdS;
}
