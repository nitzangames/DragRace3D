import { weeklyChallenge, currentWeek, fetchTop, fetchTopGhost, submitRun } from './leaderboard.js';
import { balance } from './balance.js';
import { CLASS_NAMES } from './constants.js';

/** Render the RotW info panel + leaderboard rows. Returns the challenge. */
export async function renderRotwScreen() {
  const week = currentWeek();
  const ch = weeklyChallenge(week);
  const car = balance.cars[ch.carIdx];

  const info = document.getElementById('rotw-info');
  if (info) {
    info.innerHTML = `
      <div><span class="label">Week:</span> <span class="value">#${week}</span></div>
      <div><span class="label">Car:</span> <span class="value">${car.name}</span></div>
      <div><span class="label">Class:</span> <span class="value">${CLASS_NAMES[ch.classIndex]}</span></div>
    `;
  }

  const board = document.getElementById('rotw-leaderboard');
  if (board) {
    board.innerHTML = '<div class="empty">Loading…</div>';
    const top = await fetchTop(week, 10);
    if (!top.entries || top.entries.length === 0) {
      board.innerHTML = '<div class="empty">No times yet — set the first!</div>';
    } else {
      board.innerHTML = top.entries.map((e, i) => {
        const meCls = e.isMe ? 'row me' : 'row';
        const name = (e.metadata && e.metadata.name) || ('user-' + (e.user_id || '?'));
        return `<div class="${meCls}"><span>${i + 1}. ${name}</span><span>${e.value.toFixed(3)}s</span></div>`;
      }).join('');
    }
  }
  return ch;
}

/** Build a 2-car balance: player + (none — ghost replaces opponent visually). */
export function buildRotwBalance(challenge) {
  const car = balance.cars[challenge.carIdx];
  // Player and slot-1 (ghost slot) both use the same car. Slot-1's physics is
  // ignored by main.js since ghost render takes over its lane.
  return { ...balance, cars: [car, car] };
}

/** Fetch top ghost for this week; null if none. */
export async function fetchCurrentGhost(week) {
  return await fetchTopGhost(week);
}

/** Submit player's run after race finishes. */
export async function submitRotwResult(week, etS, ghostBytes) {
  return await submitRun(week, etS, ghostBytes);
}
