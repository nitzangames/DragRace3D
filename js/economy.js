import {
  CLASS_BASE_REWARD,
  LOSE_REWARD_FRAC,
  PERFECT_RT_BONUS_FRAC,
  QUICK_RACE_REWARD_FRAC,
} from './constants.js';

/**
 * Compute gold reward for a single race.
 * @param {object} params
 * @param {number} params.classIndex   0..5 (E..Pro)
 * @param {boolean} params.won
 * @param {'career'|'quick'} params.mode
 * @param {boolean} params.perfectRT   reaction time < 0.100s
 * @returns {number} gold (always integer; truncated toward zero)
 */
export function computeRaceReward({ classIndex, won, mode, perfectRT }) {
  const base = CLASS_BASE_REWARD[classIndex];
  let frac;
  if (mode === 'quick') {
    frac = won ? QUICK_RACE_REWARD_FRAC : QUICK_RACE_REWARD_FRAC * LOSE_REWARD_FRAC;
  } else {
    // career
    frac = won ? 1.0 : LOSE_REWARD_FRAC;
    if (won && perfectRT) frac += PERFECT_RT_BONUS_FRAC;
  }
  return Math.floor(base * frac);
}
