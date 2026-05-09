import { PLAYER_CAR_IDX } from './constants.js';

/**
 * Wire button DOM elements to gameData input flags.
 * Supports both pointer (touch/mouse) and keyboard (Space = gas, ShiftLeft = shift).
 */
export function initInput(gameData) {
  const gasBtn   = document.getElementById('gas-button');
  const shiftBtn = document.getElementById('shift-button');
  if (!gasBtn || !shiftBtn) {
    console.warn('input.js: gas-button or shift-button not found');
    return;
  }

  function bind(btn, holdSetter, edgeSetter) {
    // Track the active pointerId so a phantom 'pointerup' or 'pointercancel'
    // for a different pointer (e.g., the second touch on the OTHER race
    // button) can't end this button's press. The previous wiring would
    // release on any of pointerup / pointercancel / lostpointercapture
    // without checking the id, which is what was producing the
    // "I'm holding both, but the game thinks I let go" stuck-input bug.
    let activeId = -1;
    btn.addEventListener('pointerdown', e => {
      e.preventDefault();
      try { btn.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
      activeId = e.pointerId;
      btn.classList.add('held');
      holdSetter(1);
      if (edgeSetter) edgeSetter(1);
    });
    function end(e) {
      if (e && e.pointerId !== activeId) return;
      activeId = -1;
      btn.classList.remove('held');
      holdSetter(0);
    }
    btn.addEventListener('pointerup', end);
    btn.addEventListener('pointercancel', end);
    // 'lostpointercapture' intentionally NOT bound: it fires on any capture
    // release, including the implicit one immediately after pointerup, and
    // can fire spuriously when the browser revokes capture during multi-
    // touch heuristics. pointerup + pointercancel cover the genuine cases.
  }

  bind(gasBtn,
    v => { gameData.inputGas[PLAYER_CAR_IDX] = v; },
    null);

  bind(shiftBtn,
    v => { gameData.inputShift[PLAYER_CAR_IDX] = v; },
    v => { gameData.inputShiftPressEdge[PLAYER_CAR_IDX] = v; });

  // --- Keyboard input: Space = gas, ShiftLeft = shift ---
  const keyHeld = {};  // track currently-held keys to suppress repeat

  window.addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT') return;
    if (e.code === 'Space') {
      e.preventDefault();
      if (keyHeld['Space']) return;  // ignore key repeat
      keyHeld['Space'] = true;
      gasBtn.classList.add('held');
      gameData.inputGas[PLAYER_CAR_IDX] = 1;
    } else if (e.code === 'ShiftLeft') {
      if (keyHeld['ShiftLeft']) return;
      keyHeld['ShiftLeft'] = true;
      shiftBtn.classList.add('held');
      gameData.inputShift[PLAYER_CAR_IDX] = 1;
      gameData.inputShiftPressEdge[PLAYER_CAR_IDX] = 1;
    }
  });

  window.addEventListener('keyup', e => {
    if (e.code === 'Space') {
      keyHeld['Space'] = false;
      gasBtn.classList.remove('held');
      gameData.inputGas[PLAYER_CAR_IDX] = 0;
    } else if (e.code === 'ShiftLeft') {
      keyHeld['ShiftLeft'] = false;
      shiftBtn.classList.remove('held');
      gameData.inputShift[PLAYER_CAR_IDX] = 0;
    }
  });
}
