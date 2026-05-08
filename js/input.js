import { PLAYER_CAR_IDX } from './constants.js';

/**
 * Wire button DOM elements to gameData input flags.
 * The buttons must already exist in index.html (gas-button, shift-button).
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
    function end(e) {
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
}
