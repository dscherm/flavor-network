/**
 * inventRecipe.js — "Invent a recipe" in the Recipe Lab (KITCHEN-2).
 * The food counterpart of cocktailInvent.js.
 *
 * Seed = kitchen items (the chosen main first). The FM-P2 set-completion
 * model (recipeRuntime.suggestIngredients, cuisine-aware) grows the dish
 * one ingredient at a time, restricted to the kitchen (`candidateNames`).
 * A candidate joins only when the model rates it a plausible member of
 * the dish (logit >= FIT_LOGIT), so a kitchen of chicken and chocolate
 * does not become one dish. If the dish is still thin (< DISH_MIN), the
 * model may add at most MAX_OUTSIDE common ingredients from outside the
 * kitchen; they are flagged `needed` ("you'd need").
 *
 * Why the model gates and not the pairing graph: the observed-pairing
 * index is sparse between hub ingredients (no chicken|garlic edge at
 * all), so "pairs with half the dish" rejected the obvious partners.
 *
 * Generation is always driven by seed ingredients plus a cuisine:
 * generating from a flavour profile alone is a documented dead end.
 *
 * Score = mean pairwise co-occurrence strength (buildPairingIndex), as in
 * inventCocktails, plus a small bonus for how surely the model placed
 * each ingredient (the cocktail version's commonness bonus plays the same
 * tie-breaking role), minus a small charge per ingredient to buy.
 *
 * `suggest` is injected — (observed, opts) => Promise<[{name, score}]> —
 * so this module stays pure and testable without onnxruntime.
 */
import { isBasic, haveIngredient } from './myKitchen.js';
import { dishTypeOf } from './dishType.js';

export const INVENT_ALPHA = 0;     // no popularity discount: it promotes rare oddities here
export const FIT_LOGIT = -2.5;     // model logit an ingredient needs to join (p ≈ 0.08)
export const DISH_TARGET = 5;      // ingredients taken from the kitchen, at most
export const DISH_MIN = 4;         // thinner than this → may add from outside
export const MAX_OUTSIDE = 2;      // "you'd need" ingredients, at most
export const OUTSIDE_MIN_DEGREE = 50; // outside picks must be common (pairing-graph degree)
export const OUTSIDE_COST = 0.02;  // score charge per bought ingredient
export const FIT_BONUS = 0.1;      // weight of the mean model probability in the score

// Oils, fats and seasonings read as "basics" even when the name is longer.
// Pepper only as the spice: "red pepper" / "bell pepper" are vegetables.
const BASIC_LIKE = /\boil\b|\bsalt\b|^((ground |cracked )?(black|white) |ground )?pepper(corns?)?$|^water$|^sugar$|^flour$|\bshortening\b|\bmargarine\b|\bcooking spray\b/;

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

/** Mean pairwise strength of a set, with every pair listed. */
export function meanPairing(names, index) {
  let sum = 0; let n = 0; const pairs = [];
  for (let i = 0; i < names.length; i++) {
    for (let j = i + 1; j < names.length; j++) {
      const s = pairStrength(index, names[i], names[j]);
      sum += s; n += 1;
      pairs.push({ a: names[i], b: names[j], s });
    }
  }
  return { score: n ? sum / n : 0, pairs };
}

const sigmoid = (x) => 1 / (1 + Math.exp(-x));

/** Basics, plus longer names for the same thing ("extra-virgin olive oil"). */
export function isBasicLike(name) {
  const n = String(name || '').toLowerCase().trim();
  return isBasic(n) || BASIC_LIKE.test(n);
}

const CATEGORY_RANK = { protein: 0, grain: 1, vegetable: 1, umami: 2, dairy: 2, fruit: 3, citrus: 4, aromatic: 5, herb: 5 };
const AROMATIC = /^(garlic|onion|shallot|red onion|yellow onion|white onion)$/;

/** Kitchen items in the order they make a good centre of a dish: proteins first. */
export function anchorOrder(items, nodes) {
  const rank = (x) => CATEGORY_RANK[nodes?.get?.(x)?.category] ?? 3.5;
  return [...items].sort((a, b) => rank(a) - rank(b) || (AROMATIC.test(a) ? 1 : 0) - (AROMATIC.test(b) ? 1 : 0));
}

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
 * A simple, honest name: two telling ingredients + what kind of dish it
 * looks like + the cuisine. "Chicken & Lemon Rice, Italian-style".
 * @returns {{ name: string, dishType: string, word: string }}
 */
export function inventionName(names, { cuisine = null, nodes = null, index = null } = {}) {
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
  // else the seed; then what pairs best with the lead; aromatics last.
  const protein = tellers.find((n) => nodes?.get?.(n)?.category === 'protein');
  const anchor = protein || (tellers.includes(names[0]) ? names[0] : tellers[0]);
  const ordered = [
    ...tellers.filter((n) => n === anchor),
    ...tellers.filter((n) => n !== anchor && !AROMATIC.test(n))
      .sort((a, b) => pairStrength(index, b, anchor) - pairStrength(index, a, anchor)),
    ...tellers.filter((n) => n !== anchor && AROMATIC.test(n)),
  ];
  const lead = ordered.slice(0, 2).map(titleCase).join(' & ');
  const base = lead ? `${lead} ${word}` : word;
  return { name: cuisine ? `${base}, ${cuisine}-style` : base, dishType, word };
}

/**
 * Invent dishes from the kitchen.
 * @param {object} o
 *   kitchen — kitchen items; cuisine — model cuisine or null; main — optional item;
 *   suggest — async (observed, {cuisine, alpha, k, candidateNames?}) => [{name, score}];
 *   pairingIndex — buildPairingIndex(); nodes — graph nodes (category, cuisines);
 *   names — Set of graph names (outside ingredients must be one); limit — max dishes.
 * @returns {Promise<{ ok: true, inventions: Invention[] } | { ok: false, reason: string }>}
 *   Invention = { name, dishType, cuisine, ingredients: [{ name, needed, main }], score, why }
 */
export async function inventRecipes({
  kitchen = [], cuisine = null, main = null, suggest, pairingIndex = null, nodes = null, names = null, limit = 12,
} = {}) {
  if (typeof suggest !== 'function') return { ok: false, reason: 'The recipe model is unavailable.' };
  const pantry = [...new Set(kitchen.map(lower))].filter((x) => x && !isBasicLike(x));
  if (pantry.length === 0) return { ok: false, reason: 'Add a few things to your kitchen first (salt, oil and the like are assumed).' };
  const kitchenSet = new Set(kitchen.map(lower));
  const anchors = main ? [lower(main)] : anchorOrder(pantry, nodes).slice(0, 5);
  const degree = pairingIndex?.degree;
  const common = (n) => !degree || degree.size === 0 || (degree.get(n) || 0) >= OUTSIDE_MIN_DEGREE;
  const seen = new Set();
  const found = [];

  for (const anchor of anchors) {
    for (const variant of [0, 1, 2]) {
      const members = [anchor];
      const fit = [];
      let skip = false;
      for (let step = 0; members.length < DISH_TARGET; step++) {
        const cands = pantry.filter((x) => !members.includes(x));
        if (cands.length === 0) break;
        const sugg = await suggest(members, { cuisine, alpha: INVENT_ALPHA, k: 6, candidateNames: cands });
        const ok = (sugg || []).filter((s) => cands.includes(s.name) && s.score >= FIT_LOGIT);
        // Variants 1 and 2 take the 2nd / 3rd-best first partner, for different dishes.
        const pick = step === 0 ? ok[variant] : ok[0];
        if (!pick) { if (variant > 0 && step === 0) skip = true; break; }
        members.push(pick.name);
        fit.push(sigmoid(pick.score));
      }
      if (skip) continue;

      const outside = [];
      if (members.length < DISH_MIN) {
        const sugg = await suggest(members, { cuisine, alpha: INVENT_ALPHA, k: 30 });
        for (const s of sugg || []) {
          if (members.length + outside.length >= DISH_MIN || outside.length >= MAX_OUTSIDE) break;
          const nm = lower(s.name);
          if (!nm || outside.includes(nm) || isBasicLike(nm) || s.score < FIT_LOGIT) continue;
          if (haveIngredient(nm, kitchenSet, { assumeBasics: true }).covered) continue; // lemon juice ≈ lemon
          if (names && names.size && !names.has(nm)) continue;
          if (!common(nm)) continue;
          // Something to buy needs evidence: an observed pairing with the dish.
          if (pairingIndex?.strength?.size && !members.some((m) => pairStrength(pairingIndex, nm, m) > 0)) continue;
          outside.push(nm);
          fit.push(sigmoid(s.score));
        }
      }

      const all = [...members, ...outside];
      if (all.length < 2) continue;
      const key = [...all].sort().join('|');
      if (seen.has(key)) continue;
      seen.add(key);
      const { score, pairs } = meanPairing(all, pairingIndex);
      const meanFit = fit.length ? fit.reduce((x, y) => x + y, 0) / fit.length : 0;
      found.push({ all, outside, anchor, pairs, score: score + FIT_BONUS * meanFit - OUTSIDE_COST * outside.length });
    }
  }

  if (found.length === 0) {
    return { ok: false, reason: 'Nothing in your kitchen goes together well enough to build a dish yet — add a few more things.' };
  }
  found.sort((a, b) => b.score - a.score);
  // Two sets that differ by an aromatic get the same name; keep the better one.
  const named = new Set();
  const unique = [];
  for (const f of found) {
    const nm = inventionName(f.all, { cuisine, nodes, index: pairingIndex });
    if (named.has(nm.name)) continue;
    named.add(nm.name);
    unique.push({ ...f, nm });
  }
  const inventions = unique.slice(0, limit).map((f) => {
    const { name, dishType } = f.nm;
    const strong = f.pairs.filter((p) => p.s > 0).sort((x, y) => y.s - x.s).slice(0, 2);
    return {
      name,
      dishType,
      cuisine,
      ingredients: f.all.map((n) => ({ name: n, needed: f.outside.includes(n), main: n === f.anchor })),
      score: f.score,
      why: strong.length
        ? `Pairs well in real recipes: ${strong.map((p) => `${p.a} + ${p.b}`).join(', ')}.`
        : 'Put together by the recipe model from what usually goes with these; no single pairing stands out.',
    };
  });
  return { ok: true, inventions };
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
