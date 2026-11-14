/**
 * inventRecipe.js — helpers for "Invent a recipe" in the Recipe Lab.
 *
 * The panel (InventRecipe.jsx) asks for a dish type, then a main, then lets
 * the cook build the dish slot by slot (dishSkeletons.js, inventBuild.js).
 * This module holds what that flow shares with the rest of the app:
 *   - cuisine chips: cuisineOptions, kitchenCuisines (the cuisines a kitchen leans toward)
 *   - pairStrength: the strength of a pair in a pairing index
 *   - recipeRoles: which balance roles (main, vegetable, starch, aromatic,
 *     acid or richness, herb or spice) a set of ingredients fills
 *   - isBasicLike: oils, salt, pepper and the like, assumed to be in the kitchen
 *   - inventionName(s): a title for a set of ingredients
 *   - inventionHandoff: the recipeHandoff that writes a built dish to the Notebook
 *
 * The finished-idea generator that used to live here (inventRecipes, Shuffle
 * and its scoring terms) was retired on 2026-11-14.
 */
import { isBasic } from './myKitchen.js';
import { dishTypeOf } from './dishType.js';

export const INVENT_ALPHA = 0;     // no popularity discount: it promotes rare oddities here

// Oils, fats and seasonings read as "basics" even when the name is longer.
// Pepper only as the spice: "red pepper" / "bell pepper" are vegetables.
const BASIC_LIKE = /\boil\b|\bsalt\b|^((ground |cracked )?(black|white) |ground )?pepper(corns?)?$|^water$|^sugar$|^flour$|\bshortening\b|\bmargarine\b|\bcooking spray\b/;

// Names that tell little about a dish: they go last in its name.
const QUIET_NAME = /^(milk|whole milk|skim milk|water|stock|broth|chicken stock|chicken broth|beef stock|beef broth|vegetable stock|vegetable broth)$/;

const lower = (s) => String(s || '').toLowerCase().trim();

/** Cuisine chips: the model's title-case cuisines, first spelling only, no "Global". */
export function cuisineOptions(cuisineVocab) {
  const seen = new Set();
  const out = [];
  for (const c of cuisineVocab || []) {
    if (typeof c !== 'string' || !/^[A-Z]/.test(c) || c === 'Global') continue;
    const k = c.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(c);
  }
  return out;
}

/**
 * The cuisines a kitchen leans toward: each item's node cuisines, weighted
 * by position (its first-listed cuisine counts most), resolved against the
 * model's vocab. Most-leaned first.
 */
export function kitchenCuisines(kitchen, nodes, cuisineVocab, n = 3) {
  if (!Array.isArray(kitchen) || !nodes || typeof nodes.get !== 'function') return [];
  const canon = new Map();
  for (const c of cuisineOptions(cuisineVocab)) canon.set(c.toLowerCase(), c);
  const tally = new Map();
  for (const item of kitchen) {
    const cs = nodes.get(item)?.cuisines;
    if (!Array.isArray(cs)) continue;
    cs.forEach((raw, i) => {
      const hit = canon.get(lower(raw).replace(/ cuisine$/, '').trim());
      if (hit) tally.set(hit, (tally.get(hit) || 0) + 1 / (i + 1));
    });
  }
  return [...tally.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([c]) => c);
}

export function pairStrength(index, a, b) {
  return index?.strength?.get(`${a}|${b}`) || 0;
}

/** Basics, plus longer names for the same thing ("extra-virgin olive oil"). */
export function isBasicLike(name) {
  const n = String(name || '').toLowerCase().trim();
  return isBasic(n) || BASIC_LIKE.test(n);
}

const AROMATIC = /^(garlic|onion|shallot|red onion|yellow onion|white onion)$/;

const ASIAN_WOK = new Set(['Chinese', 'Japanese', 'Korean', 'Thai', 'Vietnamese', 'Indonesian', 'Malaysian', 'Filipino']);
const CURRY_LANDS = new Set(['Indian', 'Pakistani', 'Sri Lankan']);
const SAVOURY = new Set(['protein', 'aromatic', 'vegetable', 'grain', 'umami']);
const TYPE_WORD = {
  soup: 'Soup', noodles: 'Noodles', pasta: 'Pasta', rice: 'Rice', curry: 'Curry', salad: 'Salad',
  taco: 'Tacos', wrap: 'Wraps', sandwich: 'Sandwich', bake: 'Bake', dessert: 'Dessert',
};
// The ingredient that already says the dish word (no "Rice & Chicken Rice").
const WORD_INGREDIENT = { Rice: /\brice\b/, Pasta: /pasta|spaghetti|penne|linguine|macaroni|fettuccine/, Noodles: /noodle|udon|soba|ramen/, Tacos: /tortilla|taco/, Wraps: /tortilla|pita|lavash/ };

const titleCase = (s) => String(s).replace(/\b([a-z])/g, (m) => m.toUpperCase());

/**
 * Candidate names for a dish, best first: two telling ingredients + what
 * kind of dish it looks like + the cuisine ("Chicken & Lemon Rice,
 * Italian-style"), then the same with a different second ingredient,
 * then "… with X". The first is the plain name; the rest keep names
 * unique when two dishes would collapse to one.
 * @returns {{ name: string, names: string[], dishType: string, word: string }}
 */
export function inventionNames(names, { cuisine = null, nodes = null, index = null } = {}) {
  const type = dishTypeOf({ name: '', cluster: '', ingredients: names });
  let word = TYPE_WORD[type] || null;
  let dishType = type;
  const cats = names.map((n) => nodes?.get?.(n)?.category).filter(Boolean);
  if (!word && cats.length && !cats.some((c) => SAVOURY.has(c))) { word = 'Dessert'; dishType = 'dessert'; }
  if (!word) {
    if (cuisine && ASIAN_WOK.has(cuisine)) { word = 'Stir-fry'; dishType = 'wok'; }
    else if (cuisine && CURRY_LANDS.has(cuisine)) { word = 'Curry'; dishType = 'curry'; }
    else { word = 'Skillet'; dishType = 'skillet'; }
  }
  const wordRe = WORD_INGREDIENT[word];
  const tellers = names.filter((n) => !(wordRe && wordRe.test(n)));
  // Lead with a protein if there is one ("Chicken & Lemon", not "Lemon & Chicken"),
  // else a vegetable or starch ("Potato & Carrot", not "Thyme & Carrot"), else
  // the seed; then what pairs best with the lead; aromatics and plain
  // liquids (milk, stock) last.
  const cat = (n) => nodes?.get?.(n)?.category;
  const quiet = (n) => AROMATIC.test(n) || cat(n) === 'liquid' || QUIET_NAME.test(n);
  const protein = tellers.find((n) => cat(n) === 'protein');
  const body = tellers.find((n) => ['vegetable', 'grain'].includes(cat(n)) && !quiet(n));
  const anchor = protein || body || (tellers.includes(names[0]) ? names[0] : tellers[0]);
  const ordered = [
    ...tellers.filter((n) => n === anchor),
    ...tellers.filter((n) => n !== anchor && !quiet(n))
      .sort((a, b) => pairStrength(index, b, anchor) - pairStrength(index, a, anchor)),
    ...tellers.filter((n) => n !== anchor && quiet(n)),
  ];
  const style = (base) => (cuisine ? `${base}, ${cuisine}-style` : base);
  // Telling ingredients first; aromatics and plain liquids only when nothing else is left.
  const T = ordered.map(titleCase);
  const loud = ordered.map((n, i) => (i === 0 || !quiet(n) ? i : -1)).filter((i) => i >= 0);
  const soft = ordered.map((n, i) => (i > 0 && quiet(n) ? i : -1)).filter((i) => i >= 0);
  const out = [];
  const push = (base) => { const nm = style(base); if (!out.includes(nm)) out.push(nm); };
  if (T.length === 0) push(word);
  if (T.length === 1) push(`${T[0]} ${word}`);
  // The lead (the protein, say) stays in the name as long as it can.
  for (const j of loud.slice(1)) push(`${T[0]} & ${T[j]} ${word}`);
  if (loud.length >= 3) for (const j of loud.slice(2)) push(`${T[0]} & ${T[loud[1]]} ${word} with ${T[j]}`);
  for (const j of soft) push(`${T[0]} & ${T[j]} ${word}`);
  if (loud.length >= 2) for (const j of soft) push(`${T[0]} & ${T[loud[1]]} ${word} with ${T[j]}`);
  if (loud.length >= 3) for (const j of loud.slice(2)) push(`${T[loud[1]]} & ${T[j]} ${word}`);
  return { name: out[0], names: out, dishType, word };
}

/** The plain name of a dish (the first of inventionNames). */
export function inventionName(names, opts = {}) {
  const { name, dishType, word } = inventionNames(names, opts);
  return { name, dishType, word };
}

const LEGUME = /\b(beans?|lentils?|chickpeas?|garbanzos?|tofu|tempeh|edamame|split peas?)\b/;
const STARCHY = /\b(potato(es)?|yams?|cassava|plantains?|gnocchi|tortillas?|bread|noodles?|pasta|rice|couscous|quinoa|polenta)\b/;
const ACID = /vinegar|\bwine\b|lemon|lime|yogurt|sour cream/;

/** Which balance roles a set of ingredients fills. */
export function recipeRoles(names, { nodes = null, main = null } = {}) {
  const cat = (n) => nodes?.get?.(n)?.category;
  const roles = { main: false, vegetable: false, starch: false, aromatic: false, acidRich: false, herbSpice: false };
  for (const n of names) {
    const c = cat(n);
    if (n === main || c === 'protein' || LEGUME.test(n)) roles.main = true;
    if (c === 'grain' || (STARCHY.test(n) && c !== 'protein')) roles.starch = true;
    else if (c === 'vegetable') roles.vegetable = true;
    if (c === 'aromatic' || AROMATIC.test(n)) roles.aromatic = true;
    if (['citrus', 'acid', 'dairy', 'umami', 'fat', 'nut'].includes(c) || ACID.test(n)) roles.acidRich = true;
    if (['herb', 'spice', 'chili', 'seasoning'].includes(c)) roles.herbSpice = true;
  }
  return roles;
}

/** The recipeHandoff for an invention (amounts from quantityRuntime, if any). */
export function inventionHandoff(inv, { amounts = null, closest = null } = {}) {
  return {
    source: 'make-invent',
    mode: 'recipe',
    ingredients: inv.ingredients.map((i) => ({ ingredient: i.name, amount: amounts?.get?.(i.name) || null })),
    title: inv.name,
    steps: closest?.steps || [],
    stepsFrom: closest?.title || '',
    recipeType: null,
    image: null,
    ts: Date.now(),
  };
}
