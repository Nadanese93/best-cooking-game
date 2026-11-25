// shots.js — the ?shot= staging scenes for screenshots.
// Each scene is built through the real game rules (real tickets, a real
// bowl, the real pot timer), then frozen so the clock never advances
// while the screenshot is taken. Called once at boot when the URL
// carries ?shot=title|play|win|lose and an optional &seed=.

import { state, resetGame, SCREENS } from './kitchen.js';
import { makeRng, createTicket, resetTicketNumbers } from './orders.js';
import { TARGET_COINS } from './recipes.js';

export function parseShotQuery(search) {
  const params = new URLSearchParams(search);
  const shot = params.get('shot');
  if (!shot || !['title', 'play', 'win', 'lose'].includes(shot)) return null;
  const seedRaw = params.get('seed');
  const seed = seedRaw === null ? 1 : Number(seedRaw) || 1;
  return { shot, seed };
}

// Stage one scene, then paint twice and flag window.__shotReady.
export function stageShot(scene, seed, renderAll) {
  if (scene === 'title') {
    state.screen = SCREENS.TITLE;
    state.staging = true;
    state.hint = 'Click NOODLES, watch the green zone, match the ticket, SERVE!';
  } else if (scene === 'play') {
    stagePlayScene(seed);
  } else if (scene === 'win') {
    stageWinScene();
  } else if (scene === 'lose') {
    stageLoseScene();
  }
  renderAll(state);
  requestAnimationFrame(() => {
    renderAll(state);
    requestAnimationFrame(() => {
      window.__shotReady = true;
    });
  });
}

function stagePlayScene(seed) {
  resetGame(seed);
  resetTicketNumbers();
  const rng = makeRng(seed);
  // Three tickets on the board, with patience part-drained like mid-shift.
  state.tickets = [];
  const first = createTicket(40, rng, ['egg', 'chicken', 'chilli', 'greens', 'meatball', 'tofu']);
  const second = createTicket(40, rng, ['egg', 'chicken', 'chilli', 'greens', 'meatball', 'tofu']);
  const third = createTicket(40, rng, ['egg', 'chicken', 'chilli', 'greens', 'meatball', 'tofu']);
  // Force the classic mid-game look: ticket 1 wants egg + chicken.
  first.toppings = ['egg', 'chicken'];
  first.patience = first.patienceMax * 0.55;
  first.fraction = 0.55;
  second.patience = second.patienceMax * 0.8;
  second.fraction = 0.8;
  third.patience = third.patienceMax * 0.92;
  third.fraction = 0.92;
  state.tickets = [first, second, third];
  state.selectedTicketId = first.id;
  // A bowl half-assembled: noodles in, egg and chicken added.
  state.bowl = { noodles: false, soggy: false, toppings: [] };
  state.bowl.noodles = true;
  state.bowl.toppings = ['egg'];
  // One more topping chopped and waiting, plus the pot mid-cook.
  state.readyQueue = ['chicken'];
  state.pot = { status: 'cooking', t: 4.2 };
  state.coins = 46;
  state.elapsed = 52;
  state.timeLeft = 98;
  state.streak = 2;
  state.combo = 1;
  state.failed = 0;
  state.nextArrivalIn = 6;
  state.hint = 'Bowl nearly matches ORDER #1 — add Chicken, then SERVE!';
  state.staging = true;
}

function stageWinScene() {
  resetGame(1);
  state.screen = SCREENS.WIN;
  state.coins = TARGET_COINS + 14;
  state.bestCombo = 5;
  state.combo = 3;
  state.served = 9;
  state.failed = 1;
  state.timeLeft = 14;
  state.elapsed = 136;
  state.staging = true;
}

function stageLoseScene() {
  resetGame(1);
  state.screen = SCREENS.LOSE;
  state.coins = 71;
  state.failed = 3;
  state.bestCombo = 2;
  state.served = 5;
  state.timeLeft = 63;
  state.elapsed = 87;
  state.loseReason = '3 failed orders — too many unhappy customers!';
  state.staging = true;
}
