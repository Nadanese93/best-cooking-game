// orders.js — ticket generation, patience, and arrival pacing.
// A ticket is one customer's order: noodles plus 2-4 toppings, with a
// patience bar that drains until the order is served or fails.

// Seeded random generator (mulberry32) so screenshot staging is repeatable.
export function makeRng(seed) {
  let a = seed >>> 0;
  return function rng() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pickRandom(rng, list) {
  return list[Math.floor(rng() * list.length)];
}

// How many toppings a ticket asks for, growing as the shift goes on.
export function toppingCountFor(elapsedSeconds) {
  if (elapsedSeconds >= 110) return 4;
  if (elapsedSeconds >= 55) return 3;
  return 2;
}

// Patience in seconds: long early, shorter late so the end of the shift bites.
export function patienceFor(elapsedSeconds) {
  return Math.max(26, 48 - elapsedSeconds * 0.14);
}

// Seconds until the next ticket arrives. Tickets come faster late in the shift.
export function nextArrivalDelay(elapsedSeconds) {
  return Math.max(7, 17 - elapsedSeconds * 0.06);
}

export const MAX_TICKETS_ON_BOARD = 4;

let nextTicketNumber = 1;

export function resetTicketNumbers() {
  nextTicketNumber = 1;
}

// Build one ticket: a random set of distinct toppings, full patience.
export function createTicket(elapsedSeconds, rng, toppingIds) {
  const count = toppingCountFor(elapsedSeconds);
  const pool = [...toppingIds];
  const toppings = [];
  while (toppings.length < count && pool.length > 0) {
    const i = Math.floor(rng() * pool.length);
    toppings.push(pool.splice(i, 1)[0]);
  }
  const patience = patienceFor(elapsedSeconds);
  const ticket = {
    id: nextTicketNumber++,
    toppings,
    patience,
    patienceMax: patience,
    // Patience fraction left, 1 at arrival, 0 when the customer walks out.
    fraction: 1,
  };
  return ticket;
}

// Drain one ticket's patience by dt seconds. Returns true when it just ran out.
export function tickTicket(ticket, dt) {
  ticket.patience -= dt;
  ticket.fraction = Math.max(0, ticket.patience / ticket.patienceMax);
  return ticket.patience <= 0;
}
