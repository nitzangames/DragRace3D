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
    btn.addEventListener('pointerdown', e => {
      e.preventDefault();
      btn.setPointerCapture(e.pointerId);
      btn.classList.add('held');
      holdSetter(1);
      if (edgeSetter) edgeSetter(1);
    });
    function end() {
      btn.classList.remove('held');
      holdSetter(0);
    }
    btn.addEventListener('pointerup', end);
    btn.addEventListener('pointercancel', end);
    btn.addEventListener('lostpointercapture', end);
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
