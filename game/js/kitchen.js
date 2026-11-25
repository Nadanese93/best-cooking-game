// kitchen.js — game state and rules: bowl assembly, the pot timer,
// serving, scoring, combo, and win/lose. No DOM here: render.js draws
// whatever this file reports.

import {
  TOPPINGS,
  SHIFT_SECONDS,
  TARGET_COINS,
  MAX_FAILED,
  BASE_BOWL_COINS,
  COINS_PER_TOPPING,
  MAX_TIP_COINS,
  POT_GREEN_START,
  POT_GREEN_END,
  POT_BURN_SECONDS,
  CHOPS_TO_READY,
  toppingById,
  recipesMatch,
} from './recipes.js';
import {
  makeRng,
  createTicket,
  tickTicket,
  nextArrivalDelay,
  resetTicketNumbers,
  MAX_TICKETS_ON_BOARD,
} from './orders.js';
import { playDing, playBuzz, playPop, startSizzle, stopSizzle } from './sound.js';

export const SCREENS = { TITLE: 'title', PLAYING: 'playing', WIN: 'win', LOSE: 'lose' };

// The one game state. resetGame() rebuilds it from scratch so Restart and
// Play Again always start clean.
export function freshState() {
  return {
    screen: SCREENS.TITLE,
    coins: 0,
    timeLeft: SHIFT_SECONDS,
    elapsed: 0,
    failed: 0,
    streak: 0, // consecutive serves without a mistake
    combo: 1, // 1, 2 or 3 — the coin multiplier
    bestCombo: 1,
    served: 0,
    tickets: [],
    nextArrivalIn: 0,
    selectedTicketId: null,
    // The pot: empty | cooking | burnt, with its cook clock.
    pot: { status: 'empty', t: 0 },
    // The chopping board: the topping on it and chops done so far.
    board: { item: null, chops: 0 },
    // Ready ingredients waiting to go in the bowl, in the order they finished.
    readyQueue: [],
    // The bowl being built: noodles in or not, soggy or not, and its toppings.
    bowl: { noodles: false, soggy: false, toppings: [] },
    hint: '',
    loseReason: '',
    // Rush hour: the last 30 seconds — orders flood in, tips double.
    rushHour: false,
    // True while a ?shot= scene is staged, so the clock never advances.
    staging: false,
    muted: false,
    rng: makeRng(1),
  };
}

export let state = freshState();

export function resetGame(seed) {
  resetTicketNumbers();
  state = freshState();
  state.rng = makeRng(typeof seed === 'number' ? seed : (Date.now() % 2147483647));
  state.screen = SCREENS.PLAYING;
  state.hint = 'Click NOODLES to start a pot, then build the ticket!';
  spawnTicket(state);
  spawnTicket(state);
  state.nextArrivalIn = nextArrivalDelay(0);
}

export function startGame(seed) {
  resetGame(seed);
}

// The ticket the bowl is being built for: the selected one, else the oldest.
export function targetTicket() {
  if (state.selectedTicketId !== null) {
    const picked = state.tickets.find((t) => t.id === state.selectedTicketId);
    if (picked) return picked;
  }
  return state.tickets[0] || null;
}

export function spawnTicket() {
  if (state.tickets.length >= MAX_TICKETS_ON_BOARD) return null;
  const toppingIds = TOPPINGS.map((t) => t.id);
  const ticket = createTicket(state.elapsed, state.rng, toppingIds);
  state.tickets.push(ticket);
  if (state.selectedTicketId === null) state.selectedTicketId = ticket.id;
  return ticket;
}

function setHint(text) {
  state.hint = text;
}

// --- Pot ---------------------------------------------------------------

export function clickNoodlesStation() {
  if (state.screen !== SCREENS.PLAYING) return;
  if (state.pot.status === 'cooking') {
    setHint('Noodles already cooking — watch the pot timer!');
    return;
  }
  if (state.pot.status === 'burnt') {
    setHint('Burnt! Click the pot to toss the noodles, then start again.');
    return;
  }
  state.pot = { status: 'cooking', t: 0 };
  startSizzle();
  playPop();
  setHint('Noodles cooking! Click the pot when the marker is in the GREEN zone.');
}

// Clicking the pot takes noodles out when they are perfect, or tosses them
// when they have burnt. Clicking too early leaves them cooking.
export function clickPot() {
  if (state.screen !== SCREENS.PLAYING) return;
  const pot = state.pot;
  if (pot.status === 'empty') {
    setHint('Pot is empty — click NOODLES to start cooking.');
    return;
  }
  if (pot.status === 'cooking') {
    if (pot.t >= POT_GREEN_START && pot.t <= POT_GREEN_END) {
      state.pot = { status: 'empty', t: 0 };
      state.readyQueue.push('noodles');
      stopSizzle();
      playPop();
      setHint('Perfect noodles! Click the BOWL to add them.');
    } else if (pot.t < POT_GREEN_START) {
      setHint('Too early — noodles are still hard. Wait for the green zone!');
    } else {
      // Late but not burnt yet: rescued, but soggy — this bowl earns no tip.
      state.pot = { status: 'empty', t: 0 };
      state.readyQueue.push('soggy-noodles');
      stopSizzle();
      playPop();
      setHint('Overcooked! Still servable, but this bowl earns no speed tip.');
    }
    return;
  }
  if (pot.status === 'burnt') {
    state.pot = { status: 'empty', t: 0 };
    stopSizzle();
    playBuzz();
    setHint('Burnt noodles tossed. Start a fresh pot!');
  }
}

// --- Toppings and chopping ----------------------------------------------

export function clickStation(toppingId) {
  if (state.screen !== SCREENS.PLAYING) return;
  const topping = toppingById(toppingId);
  if (!topping) return;
  if (topping.needsChop) {
    if (state.board.item !== null) {
      setHint('Chopping board is busy — finish chopping first!');
      return;
    }
    state.board = { item: toppingId, chops: 0 };
    playPop();
    setHint(`Chop the ${topping.name}! Click the chopping board ${CHOPS_TO_READY} times.`);
    return;
  }
  state.readyQueue.push(toppingId);
  playPop();
  setHint(`${topping.name} ready! Click the BOWL to add it.`);
}

export function clickBoard() {
  if (state.screen !== SCREENS.PLAYING) return;
  if (state.board.item === null) {
    setHint('Nothing to chop — click CHICKEN or GREENS first.');
    return;
  }
  state.board.chops += 1;
  playPop();
  if (state.board.chops >= CHOPS_TO_READY) {
    const done = state.board.item;
    state.board = { item: null, chops: 0 };
    state.readyQueue.push(done);
    const topping = toppingById(done);
    setHint(`${topping.name} chopped! Click the BOWL to add it.`);
  } else {
    setHint(`Chop! ${CHOPS_TO_READY - state.board.chops} more to go.`);
  }
}

// --- Bowl ---------------------------------------------------------------

// Clicking the bowl adds the next ready ingredient to it.
export function clickBowl() {
  if (state.screen !== SCREENS.PLAYING) return;
  if (state.readyQueue.length === 0) {
    setHint('Nothing ready — cook noodles or pick a topping first.');
    return;
  }
  const next = state.readyQueue[0];
  if (next === 'noodles' || next === 'soggy-noodles') {
    if (state.bowl.noodles) {
      setHint('Noodles already in the bowl!');
      return;
    }
    state.readyQueue.shift();
    state.bowl.noodles = true;
    state.bowl.soggy = next === 'soggy-noodles';
    playPop();
    setHint(
      state.bowl.soggy
        ? 'Soggy noodles in — this bowl earns no speed tip.'
        : 'Noodles in the bowl! Now add the toppings.',
    );
    return;
  }
  if (!state.bowl.noodles) {
    setHint('Noodles first! Cook noodles and add them before toppings.');
    return;
  }
  // A topping that no open ticket wants is a mistake: failed order, bowl dumped.
  const wanted = state.tickets.some((t) => t.toppings.includes(next));
  if (!wanted) {
    state.readyQueue.shift();
    registerMistake(`Wrong topping! No ticket wants ${toppingById(next).name}. Bowl dumped.`);
    return;
  }
  if (state.bowl.toppings.includes(next)) {
    setHint(`${toppingById(next).name} is already in the bowl.`);
    return;
  }
  state.readyQueue.shift();
  state.bowl.toppings.push(next);
  playPop();
  setHint(`${toppingById(next).name} added. Match the ticket, then SERVE!`);
}

// Toss the whole bowl (also used after a mistake). No penalty by itself.
export function tossBowl() {
  if (state.screen !== SCREENS.PLAYING) return;
  if (!state.bowl.noodles && state.bowl.toppings.length === 0) {
    setHint('Bowl is already empty.');
    return;
  }
  state.bowl = { noodles: false, soggy: false, toppings: [] };
  playPop();
  setHint('Bowl tossed. Start a fresh one!');
}

// --- Serving, scoring, combo --------------------------------------------

export function bowlMatchesTicket(ticket) {
  return recipesMatch(state.bowl, { noodles: true, toppings: ticket.toppings });
}

function comboForStreak(streak) {
  if (streak >= 6) return 3;
  if (streak >= 3) return 2;
  return 1;
}

function registerMistake(message) {
  state.failed += 1;
  state.streak = 0;
  state.combo = 1;
  state.bowl = { noodles: false, soggy: false, toppings: [] };
  playBuzz();
  setHint(message);
  if (state.failed >= MAX_FAILED) {
    endGame(false, '3 failed orders — too many unhappy customers!');
  }
}

export function serveBowl() {
  if (state.screen !== SCREENS.PLAYING) return;
  if (!state.bowl.noodles && state.bowl.toppings.length === 0) {
    setHint('Bowl is empty — build a bowl first!');
    return;
  }
  // The bowl may match any open ticket, not only the selected one.
  const match = state.tickets.find((t) => bowlMatchesTicket(t));
  if (!match) {
    registerMistake('Wrong bowl! That does not match any ticket. Order failed.');
    return;
  }
  const tip = (state.bowl.soggy ? 0 : Math.round(MAX_TIP_COINS * match.fraction)) * (state.rushHour ? 2 : 1);
  const base = BASE_BOWL_COINS + COINS_PER_TOPPING * match.toppings.length + tip;
  const earned = base * state.combo;
  state.coins += earned;
  state.served += 1;
  state.streak += 1;
  state.combo = comboForStreak(state.streak);
  if (state.combo > state.bestCombo) state.bestCombo = state.combo;
  state.tickets = state.tickets.filter((t) => t.id !== match.id);
  if (state.selectedTicketId === match.id) state.selectedTicketId = null;
  state.bowl = { noodles: false, soggy: false, toppings: [] };
  playDing();
  setHint(
    `Served! +${earned} coins${tip > 0 ? ` (includes ${tip} speed tip)` : ''}` +
      (state.combo > 1 ? ` — COMBO x${state.combo}!` : ''),
  );
  if (state.coins >= TARGET_COINS) {
    endGame(true, '');
  }
}

function endGame(won, reason) {
  stopSizzle();
  state.screen = won ? SCREENS.WIN : SCREENS.LOSE;
  state.loseReason = reason;
  if (won) playDing();
  else playBuzz();
}

// --- Clock ---------------------------------------------------------------

export function gameTick(dt) {
  if (state.screen !== SCREENS.PLAYING || state.staging) return;
  state.elapsed += dt;
  state.timeLeft = Math.max(0, SHIFT_SECONDS - state.elapsed);

  // Rush hour: the last 30 seconds. Announce it once, then orders flood in.
  const wasRush = state.rushHour;
  state.rushHour = state.timeLeft <= 30 && state.timeLeft > 0;
  if (state.rushHour && !wasRush) {
    setHint('RUSH HOUR! Orders flood in — speed tips DOUBLED for the last 30 seconds!');
  }

  // Pot timer: cooking noodles cross the green zone, then burn.
  if (state.pot.status === 'cooking') {
    state.pot.t += dt;
    if (state.pot.t >= POT_BURN_SECONDS) {
      state.pot = { status: 'burnt', t: POT_BURN_SECONDS };
      stopSizzle();
      playBuzz();
      setHint('The noodles BURNT! Click the pot to toss them.');
    }
  }

  // Tickets arrive faster as the shift goes on — twice as fast in rush hour.
  state.nextArrivalIn -= dt;
  if (state.nextArrivalIn <= 0) {
    if (spawnTicket()) {
      state.nextArrivalIn = nextArrivalDelay(state.elapsed) * (state.rushHour ? 0.5 : 1);
    } else {
      state.nextArrivalIn = 3; // board full — try again soon
    }
  }

  // Patience drains; in rush hour it drains 1.5x as fast. An empty bar
  // is a failed order.
  for (const ticket of [...state.tickets]) {
    if (tickTicket(ticket, dt * (state.rushHour ? 1.5 : 1))) {
      state.tickets = state.tickets.filter((t) => t.id !== ticket.id);
      if (state.selectedTicketId === ticket.id) state.selectedTicketId = null;
      state.failed += 1;
      state.streak = 0;
      state.combo = 1;
      playBuzz();
      setHint(`Ticket #${ticket.id} walked out! Order failed.`);
      if (state.failed >= MAX_FAILED) {
        endGame(false, '3 failed orders — too many unhappy customers!');
        return;
      }
    }
  }

  if (state.timeLeft <= 0) {
    if (state.coins >= TARGET_COINS) endGame(true, '');
    else endGame(false, `Shift over — ${state.coins} coins, short of the ${TARGET_COINS} target.`);
  }
}
