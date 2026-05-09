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
// Christmas-tree countdown — short tick on each amber, longer pulse on GREEN.
export function hapticAmber()    { vib(10); }
export function hapticGreen()    { vib(50); }
// Soft pulse while the player is sitting on the rev limiter. Designed to
// be called repeatedly (every ~150ms while held); keeps the buzz short so
// it reads as "warning" not "engine destroyed."
export function hapticLimiter()  { vib(12); }
// UI feedback. hapticTap is the generic short click for any button; the
// purchase variant is a touch longer so confirming a buy feels distinct.
export function hapticTap()      { vib(8); }
export function hapticPurchase() { vib(30); }
