/**
 * Best-effort haptics via the Vibration API. Silently no-ops on platforms
 * that don't support it (iOS Safari) or when disabled by the user.
 */

let _enabled = true;

export function setHapticsEnabled(on) { _enabled = !!on; }
export function hapticsEnabled() { return _enabled; }

function vib(pattern) {
  if (!_enabled) return;
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    try { navigator.vibrate(pattern); } catch (_) { /* ignore */ }
  }
}

export function hapticShift()    { vib(15); }
export function hapticBlow()     { vib([0, 80, 60, 80]); }
export function hapticFinish()   { vib(40); }
export function hapticJumpStart(){ vib(60); }
