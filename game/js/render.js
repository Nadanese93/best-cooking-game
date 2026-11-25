// render.js — DOM rendering of the board, counter, bowl, HUD and screens.
// It only draws what kitchen.js reports; it never changes game state.

import { TOPPINGS, TARGET_COINS, MAX_FAILED, POT_BURN_SECONDS, POT_GREEN_START, POT_GREEN_END, CHOPS_TO_READY, toppingById } from './recipes.js';
import { SCREENS } from './kitchen.js';

const $ = (id) => document.getElementById(id);

function fmtTime(seconds) {
  const s = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function chipHtml(toppingId) {
  const t = toppingById(toppingId);
  if (!t) return '';
  return `<span class="chip" style="background:${t.color};color:${t.textColor}">${t.name}</span>`;
}

function readyLabel(itemId) {
  if (itemId === 'noodles') return 'Noodles';
  if (itemId === 'soggy-noodles') return 'Noodles (soggy)';
  const t = toppingById(itemId);
  return t ? t.name : itemId;
}

// --- HUD -----------------------------------------------------------------

function renderHud(state) {
  $('hud-coins').textContent = String(state.coins);
  $('hud-time').textContent = fmtTime(state.timeLeft);
  $('hud-time').classList.toggle('urgent', state.timeLeft <= 30 && state.screen === SCREENS.PLAYING);
  $('hud-target').textContent = `${Math.min(state.coins, TARGET_COINS)} / ${TARGET_COINS}`;
  $('hud-failed').textContent = `${state.failed}/${MAX_FAILED}`;
  $('hud-combo').textContent = `x${state.combo}`;
  $('hud-combo').parentElement.classList.toggle('combo-hot', state.combo > 1);
  $('hud-served').textContent = String(state.served);
  $('hint-bar').textContent = state.hint;
  $('rush-banner').classList.toggle('hidden', !state.rushHour);
}

// --- Order board ----------------------------------------------------------

function renderBoard(state) {
  const board = $('board');
  if (state.tickets.length === 0) {
    board.innerHTML = '<div class="board-empty">No orders — take a breath!</div>';
    return;
  }
  board.innerHTML = state.tickets
    .map((ticket) => {
      const selected = state.selectedTicketId === ticket.id;
      const matches = state.bowl.noodles && ticket.toppings.length === state.bowl.toppings.length &&
        ticket.toppings.every((id) => state.bowl.toppings.includes(id));
      const pct = Math.round(ticket.fraction * 100);
      const barClass = pct > 50 ? 'patience-good' : pct > 25 ? 'patience-warn' : 'patience-bad';
      return `<div class="ticket${selected ? ' selected' : ''}${matches ? ' match' : ''}" data-action="ticket:${ticket.id}">
        <div class="ticket-head"><span class="ticket-num">ORDER #${ticket.id}</span>${matches ? '<span class="ticket-serve">READY — CLICK TO SERVE</span>' : ''}</div>
        <div class="ticket-toppings"><span class="chip chip-noodles">Noodles</span>${ticket.toppings.map(chipHtml).join('')}</div>
        <div class="patience"><div class="patience-fill ${barClass}" style="width:${pct}%"></div></div>
        <div class="patience-label">Patience ${Math.ceil(ticket.patience)}s</div>
      </div>`;
    })
    .join('');
}

// --- Pot -------------------------------------------------------------------

function renderPot(state) {
  const pot = state.pot;
  const el = $('pot');
  el.classList.remove('pot-empty', 'pot-cooking', 'pot-burnt');
  el.classList.add(`pot-${pot.status}`);
  const pct = Math.min(100, (pot.t / POT_BURN_SECONDS) * 100);
  const greenStart = (POT_GREEN_START / POT_BURN_SECONDS) * 100;
  const greenEnd = (POT_GREEN_END / POT_BURN_SECONDS) * 100;
  let label = 'EMPTY POT';
  if (pot.status === 'cooking') {
    label = pot.t < POT_GREEN_START ? 'COOKING…' : pot.t <= POT_GREEN_END ? 'PERFECT — CLICK NOW!' : 'OVERCOOKING — CLICK!';
  } else if (pot.status === 'burnt') {
    label = 'BURNT! CLICK TO TOSS';
  }
  el.querySelector('.pot-label').textContent = label;
  el.querySelector('.pot-marker').style.left = `${pct}%`;
  el.querySelector('.pot-green').style.left = `${greenStart}%`;
  el.querySelector('.pot-green').style.width = `${greenEnd - greenStart}%`;
}

// --- Chopping board --------------------------------------------------------

function renderChoppingBoard(state) {
  const el = $('chopping-board');
  const item = state.board.item;
  if (!item) {
    el.querySelector('.board-label').textContent = 'CHOPPING BOARD — empty';
    el.querySelector('.board-chops').textContent = 'Click CHICKEN or GREENS to chop';
    el.classList.remove('busy');
    return;
  }
  const t = toppingById(item);
  el.classList.add('busy');
  el.querySelector('.board-label').textContent = `CHOPPING: ${t.name.toUpperCase()}`;
  el.querySelector('.board-chops').textContent =
    `Chops done: ${state.board.chops}/${CHOPS_TO_READY} — click ${CHOPS_TO_READY - state.board.chops} more time${CHOPS_TO_READY - state.board.chops === 1 ? '' : 's'}`;
}

// --- Bowl, ready tray, stations --------------------------------------------

function renderBowl(state) {
  const bowl = $('bowl');
  const chips = [];
  if (state.bowl.noodles) {
    chips.push(`<span class="chip chip-noodles">${state.bowl.soggy ? 'Noodles (soggy)' : 'Noodles'}</span>`);
  }
  for (const id of state.bowl.toppings) chips.push(chipHtml(id));
  $('bowl-contents').innerHTML = chips.length > 0
    ? chips.join('')
    : '<span class="bowl-empty">Empty bowl — click the bowl to add ready food</span>';
  bowl.classList.toggle('has-noodles', state.bowl.noodles);
  const target = state.tickets[0];
  const canServe = state.bowl.noodles && target && state.bowl.toppings.length === target.toppings.length;
  $('serve-btn').classList.toggle('ready', Boolean(canServe));
}

function renderTray(state) {
  const tray = $('tray');
  if (state.readyQueue.length === 0) {
    tray.innerHTML = '<span class="tray-empty">Ready tray is empty</span>';
    return;
  }
  tray.innerHTML = `<span class="tray-label">READY — click the bowl to add:</span>` +
    state.readyQueue.map((id) => `<span class="chip tray-chip">${readyLabel(id)}</span>`).join('');
}

function renderStations() {
  const counter = $('counter');
  const stationHtml = TOPPINGS.map((t, i) => {
    const key = i + 1; // keys 1-6 pick stations; noodles is its own big button
    return `<button class="station" data-action="station:${t.id}" style="--swatch:${t.color};--swatch-text:${t.textColor}">
      <span class="station-key">${key}</span>
      <span class="station-swatch">${t.name.slice(0, 1)}</span>
      <span class="station-name">${t.name}</span>
      <span class="station-note">${t.needsChop ? 'needs chopping' : 'ready at once'}</span>
    </button>`;
  }).join('');
  counter.innerHTML = `<button class="station station-noodles" data-action="station:noodles">
      <span class="station-key">1</span>
      <span class="station-swatch">~</span>
      <span class="station-name">Noodles</span>
      <span class="station-note">starts the pot</span>
    </button>` + stationHtml;
  // Renumber keys: noodles is 1, toppings are 2-7; fix the labels above.
  const keys = counter.querySelectorAll('.station-key');
  keys.forEach((el, i) => { el.textContent = String(i + 1); });
}

// --- Screens ----------------------------------------------------------------

function renderScreens(state) {
  const show = (id, visible) => { $(id).classList.toggle('hidden', !visible); };
  show('screen-title', state.screen === SCREENS.TITLE);
  show('screen-win', state.screen === SCREENS.WIN);
  show('screen-lose', state.screen === SCREENS.LOSE);
  if (state.screen === SCREENS.WIN) {
    $('win-coins').textContent = String(state.coins);
    $('win-combo').textContent = `x${state.bestCombo}`;
    $('win-served').textContent = String(state.served);
  }
  if (state.screen === SCREENS.LOSE) {
    $('lose-reason').textContent = state.loseReason;
    $('lose-coins').textContent = String(state.coins);
    $('lose-served').textContent = String(state.served);
  }
  $('mute-btn').textContent = state.muted ? 'SOUND OFF' : 'SOUND ON';
}

// --- All ----------------------------------------------------------------------

export function renderAll(state) {
  renderHud(state);
  renderBoard(state);
  renderPot(state);
  renderChoppingBoard(state);
  renderBowl(state);
  renderTray(state);
  renderScreens(state);
}

export function buildStatic() {
  renderStations();
}
