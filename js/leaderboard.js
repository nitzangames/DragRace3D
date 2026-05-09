import { ROTW_BOARD_PREFIX, WEEK_MS, NUM_CLASSES } from './constants.js';
import { balance } from './balance.js';

let _sdk = null; // injected by _setMockSDK or resolved from window.PlaySDK

function getSDK() {
  if (_sdk !== null) return _sdk;
  if (typeof window !== 'undefined' && window.PlaySDK) return window.PlaySDK;
  return null;
}

/** Test-only: inject a mock SDK or null to force "no SDK" mode. */
export function _setMockSDK(sdk) { _sdk = sdk; }

export function currentWeek() {
  return Math.floor(Date.now() / WEEK_MS);
}

/** Deterministic car/class pick for a given week. */
export function weeklyChallenge(week) {
  // Mulberry32-ish hash: deterministic, week-keyed, well-mixed.
  let h = (week * 2654435761) >>> 0;
  h ^= h >>> 16; h = (Math.imul(h, 0x85ebca6b) >>> 0);
  h ^= h >>> 13; h = (Math.imul(h, 0xc2b2ae35) >>> 0);
  h ^= h >>> 16;
  const carIdx = (h >>> 0) % balance.cars.length;
  const classIndex = ((h >>> 4) >>> 0) % NUM_CLASSES;
  return { week, carIdx, classIndex };
}

export function boardKey(week) { return ROTW_BOARD_PREFIX + week; }

export async function submitRun(week, etS, ghostBytes) {
  const sdk = getSDK();
  if (!sdk || !sdk.submitScore) return null;
  try {
    return await sdk.submitScore(boardKey(week), etS, ghostBytes || null);
  } catch (_) { return null; }
}

export async function fetchTop(week, limit) {
  const sdk = getSDK();
  if (!sdk || !sdk.getLeaderboard) return { entries: [], total: 0, has_top_attachment: false };
  try {
    return await sdk.getLeaderboard(boardKey(week), limit || 10);
  } catch (_) { return { entries: [], total: 0, has_top_attachment: false }; }
}

export async function fetchTopGhost(week) {
  const sdk = getSDK();
  if (!sdk || !sdk.getTopAttachment) return null;
  try {
    const ab = await sdk.getTopAttachment(boardKey(week));
    if (!ab) return null;
    // ab is ArrayBuffer; wrap in Float32Array
    const u8 = ab instanceof ArrayBuffer ? new Uint8Array(ab) : new Uint8Array(ab.buffer || ab);
    if (u8.byteLength === 0) return null;
    const copy = new Uint8Array(u8); // ensure aligned + owned
    return new Float32Array(copy.buffer, copy.byteOffset, copy.byteLength / 4);
  } catch (_) { return null; }
}
