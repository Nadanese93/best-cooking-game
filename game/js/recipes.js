// recipes.js — the topping list and the bowl recipes (data only).
// No logic here: kitchen.js decides what a bowl may hold, orders.js
// decides what a ticket asks for.

export const SHIFT_SECONDS = 150;
export const TARGET_COINS = 120;
export const MAX_FAILED = 3;
export const BASE_BOWL_COINS = 10;
export const COINS_PER_TOPPING = 2;
export const MAX_TIP_COINS = 8;

// How long noodles cook, in seconds. The green zone is the perfect window.
export const POT_COOK_SECONDS = 6;
export const POT_GREEN_START = 3.5;
export const POT_GREEN_END = 5.5;
export const POT_BURN_SECONDS = 7;

// Chopping board: how many clicks turn a raw topping into a ready one.
export const CHOPS_TO_READY = 3;

// Every topping a ticket can ask for. `needsChop` toppings must visit the
// chopping board before they can go in the bowl; the rest are ready at once.
export const TOPPINGS = [
  { id: 'egg', name: 'Egg', color: '#ffd94d', textColor: '#5a3a00', needsChop: false },
  { id: 'chicken', name: 'Chicken', color: '#e8a04c', textColor: '#4a2400', needsChop: true },
  { id: 'chilli', name: 'Chilli', color: '#e33f2f', textColor: '#ffffff', needsChop: false },
  { id: 'greens', name: 'Greens', color: '#4caf50', textColor: '#ffffff', needsChop: true },
  { id: 'meatball', name: 'Meatball', color: '#8d5a2b', textColor: '#ffffff', needsChop: false },
  { id: 'tofu', name: 'Tofu', color: '#f5e9c8', textColor: '#5a3a00', needsChop: false },
];

export function toppingById(id) {
  return TOPPINGS.find((t) => t.id === id) || null;
}

// A bowl recipe: noodles plus a set of topping ids. Two recipes match when
// both hold noodles and the same topping ids in any order.
export function recipesMatch(a, b) {
  if (!a || !b) return false;
  if (a.noodles !== b.noodles) return false;
  if (a.toppings.length !== b.toppings.length) return false;
  const sortedA = [...a.toppings].sort();
  const sortedB = [...b.toppings].sort();
  return sortedA.every((id, i) => id === sortedB[i]);
}
