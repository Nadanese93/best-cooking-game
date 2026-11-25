// main.js — boot, input wiring, and the game loop.
// Clicks are handled by delegation on data-action attributes; keys 1-7
// pick stations, Space serves, R restarts, M mutes.

import {
  state,
  startGame,
  resetGame,
  clickNoodlesStation,
  clickPot,
  clickStation,
  clickBoard,
  clickBowl,
  tossBowl,
  serveBowl,
  gameTick,
  SCREENS,
} from './kitchen.js';
import { renderAll, buildStatic } from './render.js';
import { parseShotQuery, stageShot } from './shots.js';
import { setMuted, isMuted, unlockAudio } from './sound.js';
import { TOPPINGS } from './recipes.js';

// Station order on the counter, matching the key labels render.js paints:
// 1 = noodles, then the toppings in recipes.js order.
const STATION_KEYS = ['noodles', ...TOPPINGS.map((t) => t.id)];

function handleAction(action) {
  unlockAudio();
  const [kind, arg] = action.split(':');
  if (kind === 'station') {
    if (arg === 'noodles') clickNoodlesStation();
    else clickStation(arg);
  } else if (kind === 'pot') {
    clickPot();
  } else if (kind === 'board') {
    clickBoard();
  } else if (kind === 'bowl') {
    clickBowl();
  } else if (kind === 'serve') {
    serveBowl();
  } else if (kind === 'toss') {
    tossBowl();
  } else if (kind === 'ticket') {
    const id = Number(arg);
    const ticket = state.tickets.find((t) => t.id === id);
    if (!ticket) return;
    if (state.bowl.noodles && state.bowl.toppings.length === ticket.toppings.length &&
        ticket.toppings.every((topping) => state.bowl.toppings.includes(topping))) {
      serveBowl();
    } else {
      state.selectedTicketId = id;
      state.hint = `Building ORDER #${id} — match its toppings, then SERVE!`;
    }
  } else if (kind === 'start') {
    startGame();
  } else if (kind === 'again' || kind === 'retry' || kind === 'restart') {
    resetGame();
  } else if (kind === 'mute') {
    setMuted(!isMuted());
    state.muted = isMuted();
  }
  renderAll(state);
}

function wireInput() {
  document.getElementById('app').addEventListener('click', (event) => {
    const el = event.target.closest('[data-action]');
    if (el) handleAction(el.dataset.action);
  });
  window.addEventListener('keydown', (event) => {
    if (event.repeat) return;
    const key = event.key;
    if (key >= '1' && key <= '7') {
      const station = STATION_KEYS[Number(key) - 1];
      if (station) {
        if (station === 'noodles') clickNoodlesStation();
        else clickStation(station);
        renderAll(state);
      }
      return;
    }
    if (key === ' ') {
      event.preventDefault();
      if (state.screen === SCREENS.PLAYING) serveBowl();
      else if (state.screen === SCREENS.TITLE) startGame();
      renderAll(state);
      return;
    }
    if (key === 'r' || key === 'R') {
      if (state.screen !== SCREENS.TITLE) resetGame();
      renderAll(state);
      return;
    }
    if (key === 'm' || key === 'M') {
      setMuted(!isMuted());
      state.muted = isMuted();
      renderAll(state);
    }
  });
}

function boot() {
  buildStatic();
  wireInput();
  const shot = parseShotQuery(window.location.search);
  if (shot) {
    stageShot(shot.shot, shot.seed, renderAll);
    return;
  }
  renderAll(state);
  let last = performance.now();
  window.setInterval(() => {
    const now = performance.now();
    const dt = Math.min(0.25, (now - last) / 1000);
    last = now;
    gameTick(dt);
    renderAll(state);
  }, 100);
}

document.addEventListener('DOMContentLoaded', boot);
