import { SAVE_KEY } from './constants.js';

// Storage adapter — defaults to PlaySDK if available, falls back to localStorage,
// or a mock injected by tests.
let storage = null;

function getStorage() {
  if (storage) return storage;
  if (typeof window !== 'undefined' && window.PlaySDK && window.PlaySDK.save) {
    return {
      save: (k, v) => window.PlaySDK.save(k, v),
      load: (k) => window.PlaySDK.load(k),
      remove: (k) => window.PlaySDK.remove ? window.PlaySDK.remove(k) : Promise.resolve(),
    };
  }
  if (typeof window !== 'undefined' && window.localStorage) {
    return {
      save: (k, v) => { window.localStorage.setItem(k, v); return Promise.resolve(); },
      load: (k) => Promise.resolve(window.localStorage.getItem(k)),
      remove: (k) => { window.localStorage.removeItem(k); return Promise.resolve(); },
    };
  }
  // Fallback no-op storage (e.g., Node without injected mock)
  return {
    save: () => Promise.resolve(),
    load: () => Promise.resolve(null),
    remove: () => Promise.resolve(),
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
  try {
    return JSON.parse(raw);
  } catch (_) {
    return null;
  }
}

export async function clearCareer() {
  await getStorage().remove(SAVE_KEY);
}
