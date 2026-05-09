import { SAVE_KEY, ENV_PRESET_IDS, LEGACY_ENV_MAP } from './constants.js';

// Storage adapter. We write to BOTH PlaySDK (when available — drives the
// cloud sync on the platform) AND our own localStorage in parallel. Reads
// prefer PlaySDK so cloud-synced data wins on the platform, but fall back
// to our localStorage when PlaySDK has no data (e.g. running on localhost
// where the PlaySDK can't detect its slug and silently no-ops).
//
// Tests inject a mock via _setMockStorage(); when set, the mock takes over
// completely and the real adapters are skipped.
let storage = null;

function hasPlaySDK() {
  return typeof window !== 'undefined' && window.PlaySDK && typeof window.PlaySDK.save === 'function';
}
function hasLocalStorage() {
  if (typeof window === 'undefined' || !window.localStorage) return false;
  // Some browsers (Safari private mode) expose localStorage but throw on
  // setItem — probe once to make sure it actually works.
  try {
    const probe = '__dr3d_probe__';
    window.localStorage.setItem(probe, '1');
    window.localStorage.removeItem(probe);
    return true;
  } catch (_) { return false; }
}

function getStorage() {
  if (storage) return storage;
  const sdk = hasPlaySDK();
  const ls = hasLocalStorage();

  if (!sdk && !ls) {
    return {
      save: () => Promise.resolve(),
      load: () => Promise.resolve(null),
      remove: () => Promise.resolve(),
    };
  }

  return {
    async save(k, v) {
      if (ls) { try { window.localStorage.setItem(k, v); } catch (_) {} }
      if (sdk) { try { await window.PlaySDK.save(k, v); } catch (_) {} }
    },
    async load(k) {
      // PlaySDK first — on the platform this returns cloud-synced data.
      // On localhost (no slug) it returns null and we fall through.
      if (sdk) {
        try {
          const v = await window.PlaySDK.load(k);
          if (v != null) return v;
        } catch (_) { /* fall through to localStorage */ }
      }
      if (ls) {
        try { return window.localStorage.getItem(k); } catch (_) {}
      }
      return null;
    },
    async remove(k) {
      if (ls) { try { window.localStorage.removeItem(k); } catch (_) {} }
      if (sdk && window.PlaySDK.remove) {
        try { await window.PlaySDK.remove(k); } catch (_) {}
      }
    },
  };
}

/** Test-only: inject a mock storage adapter. */
export function _setMockStorage(s) { storage = s; }

export async function saveCareer(state) {
  await getStorage().save(SAVE_KEY, JSON.stringify(state));
}

export async function loadCareer() {
  const raw = await getStorage().load(SAVE_KEY);
  if (!raw) return null;
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (_) {
    return null;
  }
  // Migrate Plan-3 fields if missing (legacy saves from Plan 2)
  if (typeof parsed.nbucks !== 'number') parsed.nbucks = 0;
  if (!Array.isArray(parsed.unlockedEnvs)) {
    parsed.unlockedEnvs = ['bleachers'];
  } else {
    // Legacy day/night/salt/rain ids → new track ids; drop anything that
    // isn't in the current preset list. Always seeds bleachers so the
    // player has at least one starter track.
    const validSet = new Set(ENV_PRESET_IDS);
    const migrated = parsed.unlockedEnvs
      .map((id) => LEGACY_ENV_MAP[id] || id)
      .filter((id) => validSet.has(id));
    if (!migrated.includes('bleachers')) migrated.unshift('bleachers');
    parsed.unlockedEnvs = migrated;
  }
  if (!parsed.audio || typeof parsed.audio !== 'object') {
    parsed.audio = { muted: false, volume: 0.7 };
  } else {
    if (typeof parsed.audio.muted !== 'boolean') parsed.audio.muted = false;
    if (typeof parsed.audio.volume !== 'number') parsed.audio.volume = 0.7;
  }
  if (!parsed.haptics || typeof parsed.haptics !== 'object') {
    parsed.haptics = { enabled: true };
  } else if (typeof parsed.haptics.enabled !== 'boolean') {
    parsed.haptics.enabled = true;
  }
  if (!parsed.shadows || typeof parsed.shadows !== 'object') {
    parsed.shadows = { enabled: true };
  } else if (typeof parsed.shadows.enabled !== 'boolean') {
    parsed.shadows.enabled = true;
  }
  // tutorialDone added in v0.5.58. Old saves predate the tutorial — those
  // players already know how to drag race, so default to true on migration.
  // newCareer() sets it false for fresh careers so the overlay fires once.
  if (typeof parsed.tutorialDone !== 'boolean') parsed.tutorialDone = true;
  return parsed;
}

export async function clearCareer() {
  await getStorage().remove(SAVE_KEY);
}
