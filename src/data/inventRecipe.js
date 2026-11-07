/**
 * inventRecipe.js — "Invent a recipe" in the Recipe Lab (KITCHEN-2, WEAK-5).
 * The food counterpart of cocktailInvent.js.
 *
 * Seed = kitchen items (the chosen main, or up to five likely centres).
 * The FM-P2 set-completion model (recipeRuntime.suggestIngredients,
 * cuisine-aware) grows a dish one ingredient at a time, restricted to the
 * kitchen (`candidateNames`). A candidate joins only when the model rates
 * it a plausible member of the dish (logit >= FIT_LOGIT), so a kitchen of
 * chicken and chocolate does not become one dish. Each seed is grown four
 * ways (the 1st–4th best first partner), and every grown dish gives a few
 * candidates: its model-ordered prefixes, and each of those plus one or
 * two common ingredients from outside the kitchen (MAX_OUTSIDE, flagged
 * `needed`: "you'd need"). Something to buy needs evidence: the model
 * places it and it pairs with the dish in real recipes.
 *
 * Why the model gates and not the pairing graph: the observed-pairing
 * index is sparse between hub ingredients, so "pairs with half the dish"
 * rejected obvious partners. The panel passes the curated graph blended
 * with the everyday pairs (everydayPairs.js, WEAK-A).
 *
 * Score (WEAK-5; mean pair strength alone favoured 3–4 ingredient dishes):
 *   coherence    — a quarter mean pair strength, three quarters each
 *                  ingredient's best partner in the dish; basics never count
 *   size         — flat top for 5–8 ingredients (sizeTerm)
 *   role balance — a main (protein / legume / the chosen main), a
 *                  vegetable, a starch (full weight where the cuisine
 *                  expects one), an aromatic, an acid or richness, a herb
 *                  or spice
 *   fit          — mean model probability of the members (tie-break)
 *   − buying     — cheap while it brings a thin dish up to DISH_MIN,
 *                  dearer beyond that, so kitchen-only dishes lead
 * A savoury dish needs a centre (a main, a starch or a non-aromatic
 * vegetable): no more "onion + oregano + parmesan + thyme".
 *
 * Which ideas are shown: maximal marginal relevance (inventVariety.js), so
 * Shuffle finds new dishes until the pool runs out, then says so. Names
 * are given in that order and kept unique (a different second ingredient,
 * then "with …").
 *
 * Generation is always driven by seed ingredients plus a cuisine:
 * generating from a flavour profile alone is a documented dead end.
 *
 * `suggest` is injected — (observed, opts) => Promise<[{name, score}]> —
 * so this module stays pure and testable without onnxruntime.
 */
import { isBasic, haveIngredient } from './myKitchen.js';
import { dishTypeOf } from './dishType.js';
import { mmrOrder, assignUniqueNames, nextIdeas, dropThinSubsets, EXHAUSTED_RECIPE } from './inventVariety.js';

export { EXHAUSTED_RECIPE };

export const INVENT_ALPHA = 0;     // no popularity discount: it promotes rare oddities here
export const FIT_LOGIT = -3.5;     // model logit an ingredient needs to join (p ≈ 0.03)
export const DISH_MAX = 8;         // ingredients in a dish, at most
export const DISH_MIN = 5;         // below this a dish may buy to fill out cheaply
export const MAX_OUTSIDE = 2;      // "you'd need" ingredients, at most
export const OUTSIDE_MIN_DEGREE = 50; // outside picks must be common (pairing-graph degree)
export const OUTSIDE_FILL_COST = 0.05;  // per bought ingredient that brings a dish up to DISH_MIN
export const OUTSIDE_EXTRA_COST = 0.09; // per bought ingredient beyond that
export const FIT_BONUS = 0.1;      // weight of the mean model probability in the score
export const VARIANTS = 4;         // ways to grow each seed (1st–4th best first partner)
export const OUTSIDE_PER_DISH = 5; // outside candidates tried per grown dish
export const POOL_FLOOR = 0.3;     // ideas scoring further below the best are dropped
export const PANTRY_USE = 0.12;    // × share of the kitchen the dish uses
export const ROLE_WEIGHTS = { main: 0.1, vegetable: 0.05, starch: 0.05, aromatic: 0.04, acidRich: 0.04, herbSpice: 0.04 };

// Oils, fats and seasonings read as "basics" even when the name is longer.
// Pepper only as the spice: "red pepper" / "bell pepper" are vegetables.
const BASIC_LIKE = /\boil\b|\bsalt\b|^((ground |cracked )?(black|white) |ground )?pepper(corns?)?$|^water$|^sugar$|^flour$|\bshortening\b|\bmargarine\b|\bcooking spray\b/;
// Shop-bought shortcuts are not "an ingredient to buy" for an invented dish.
const OUTSIDE_EXCLUDE = /\bsoup\b|\bmix\b|\bcake\b|frosting|whipped topping|cool whip|bisquick|velveeta|\bdressing\b/;

// Names that tell little about a dish: they go last in its name.
const AROMATIC_PAIR = /^(garlic|onions?|shallots?|red onion|yellow onion|white onion|green onions?|scallions?|ginger)$/;
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

// ── Scoring terms (WEAK-5) ─────────────────────────────────────────────

/**
 * Size term: flat top for DISH_MIN..DISH_MAX (5–8), falling by `step` per
 * ingredient outside it. Mean pair strength alone rewards small sets.
 */
export function sizeTerm(n, { min = DISH_MIN, max = DISH_MAX, peak = 0.15, step = 0.1 } = {}) {
  if (n >= min && n <= max) return peak;
  return peak - step * (n < min ? min - n : n - max);
}

/**
 * Coherence of a dish, assumed basics left out: a quarter the mean strength
 * over every pair, three quarters the mean of each ingredient's best partner
 * (so a bigger dish is not punished just for having more, weaker pairs).
 * @returns {{ score: number, pairs: Array<{a, b, s}>, unlinked: number }}
 */
export function coherence(names, index) {
  const xs = names.filter((n) => !isBasicLike(n));
  const pairs = [];
  const best = new Map(xs.map((n) => [n, 0]));
  let sum = 0;
  for (let i = 0; i < xs.length; i++) {
    for (let j = i + 1; j < xs.length; j++) {
      const s = pairStrength(index, xs[i], xs[j]);
      pairs.push({ a: xs[i], b: xs[j], s });
      sum += s;
      if (s > best.get(xs[i])) best.set(xs[i], s);
      if (s > best.get(xs[j])) best.set(xs[j], s);
    }
  }
  const meanPair = pairs.length ? sum / pairs.length : 0;
  const bests = [...best.values()];
  const meanBest = bests.length ? bests.reduce((a, b) => a + b, 0) / bests.length : 0;
  return { score: 0.25 * meanPair + 0.75 * meanBest, pairs, unlinked: bests.filter((b) => b === 0).length };
}

const LEGUME = /\b(beans?|lentils?|chickpeas?|garbanzos?|tofu|tempeh|edamame|split peas?)\b/;
const STARCHY = /\b(potato(es)?|yams?|cassava|plantains?|gnocchi|tortillas?|bread|noodles?|pasta|rice|couscous|quinoa|polenta)\b/;
const ACID = /vinegar|\bwine\b|lemon|lime|yogurt|sour cream/;
// Cuisines whose plates usually carry a starch (rice, bread, noodles, potatoes …).
const STARCH_CUISINES = new Set(['Indian', 'Pakistani', 'Sri Lankan', 'Chinese', 'Japanese', 'Korean', 'Thai', 'Vietnamese',
  'Indonesian', 'Malaysian', 'Filipino', 'Italian', 'Mexican', 'Spanish', 'Middle Eastern', 'Lebanese', 'Turkish', 'Moroccan',
  'Persian', 'Ethiopian', 'Caribbean', 'Cajun', 'Southern', 'American', 'British', 'Irish', 'German', 'Polish', 'Russian']);

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

/** Role-balance term; the starch counts in full only where the cuisine expects one. */
export function roleBalance(roles, { cuisine = null } = {}) {
  let t = 0;
  for (const [r, w] of Object.entries(ROLE_WEIGHTS)) {
    if (!roles[r]) continue;
    t += r === 'starch' && !(cuisine && STARCH_CUISINES.has(cuisine)) ? w / 2 : w;
  }
  return t;
}

/** A savoury dish needs something to be the dish: a main, a starch or a real vegetable. */
export function hasCentre(names, { nodes = null, main = null } = {}) {
  const cats = names.map((n) => nodes?.get?.(n)?.category).filter(Boolean);
  if (cats.length && !cats.some((c) => SAVOURY.has(c))) return true; // a sweet set (dessert) is its own centre
  const r = recipeRoles(names, { nodes, main });
  return r.main || r.starch || r.vegetable;
}

/**
 * The kitchen's mains and starches (chicken, beef, lentils, rice, pasta,
 * potato). When it has any, every dish is built around one of them: a
 * pasta kitchen's ideas are pasta dishes, not a tomato skillet without it.
 */
export function kitchenCentres(pantry, nodes) {
  return pantry.filter((n) => {
    const r = recipeRoles([n], { nodes });
    return r.main || r.starch;
  });
}

/** Bought-ingredient charge: cheap while it fills a dish up to DISH_MIN, dearer beyond. */
export function buyingCost(kitchenCount, outsideCount) {
  let cost = 0;
  for (let i = 0; i < outsideCount; i++) cost += kitchenCount + i < DISH_MIN ? OUTSIDE_FILL_COST : OUTSIDE_EXTRA_COST;
  return cost;
}

/** The whole score of a dish, with its parts. */
export function scoreDish(all, {
  kitchenCount = all.length, pantrySize = kitchenCount, fit = [], index = null, nodes = null, main = null, cuisine = null,
} = {}) {
  const coh = coherence(all, index);
  const roles = recipeRoles(all, { nodes, main });
  const meanFit = fit.length ? fit.reduce((x, y) => x + y, 0) / fit.length : 0;
  const parts = {
    coherence: coh.score,
    size: sizeTerm(all.length),
    roles: roleBalance(roles, { cuisine }),
    fit: FIT_BONUS * meanFit,
    buying: -buyingCost(kitchenCount, all.length - kitchenCount),
    // Using more of what the cook has (as Invent a sauce rewards it).
    kitchen: PANTRY_USE * (kitchenCount / Math.max(1, Math.min(pantrySize, DISH_MAX))),
  };
  const score = Object.values(parts).reduce((a, b) => a + b, 0);
  return { score, parts, pairs: coh.pairs, roles };
}

/**
 * The "why" line: the two strongest pairs, assumed basics left out. Two
 * aromatics together (onion + garlic) go in every savoury dish, so such a
 * pair is cited only when nothing else pairs.
 */
export function whyLine(pairs) {
  const bothAromatic = (p) => AROMATIC_PAIR.test(p.a) && AROMATIC_PAIR.test(p.b);
  const ranked = (pairs || []).filter((p) => p.s > 0 && !isBasicLike(p.a) && !isBasicLike(p.b))
    .sort((x, y) => (bothAromatic(x) ? 1 : 0) - (bothAromatic(y) ? 1 : 0) || y.s - x.s);
  // The second pair names two other ingredients when one pairs, so the
  // line tells more of the dish than "tomato + onion, tomato + garlic".
  const first = ranked[0];
  const second = first
    ? ranked.find((p) => p !== first && ![first.a, first.b].includes(p.a) && ![first.a, first.b].includes(p.b))
      || ranked.find((p) => p !== first)
    : null;
  const strong = [first, second].filter(Boolean);
  return strong.length
    ? `Pairs well in real recipes: ${strong.map((p) => `${p.a} + ${p.b}`).join(', ')}.`
    : 'Put together by the recipe model from what usually goes with these; no single pairing stands out.';
}

const inventionKeys = (inv) => inv.ingredients.map((i) => i.name);

/**
 * The next ideas to show in this session (MMR over the pool, never one
 * already shown). [] means the pool is exhausted: show EXHAUSTED_RECIPE.
 */
export function nextInventions(pool, shown = [], n = 3) {
  return nextIdeas(pool, shown, n, { keysOf: inventionKeys });
}

/**
 * Invent dishes from the kitchen.
 * @param {object} o
 *   kitchen — kitchen items; cuisine — model cuisine or null; main — optional item;
 *   suggest — async (observed, {cuisine, alpha, k, candidateNames?}) => [{name, score}];
 *   pairingIndex — buildPairingIndex(); nodes — graph nodes (category, cuisines);
 *   names — Set of graph names (outside ingredients must be one); limit — dishes in `inventions`.
 * @returns {Promise<{ ok: true, inventions: Invention[], pool: Invention[] } | { ok: false, reason: string }>}
 *   Invention = { name, dishType, cuisine, ingredients: [{ name, needed, main }], score, parts, why }
 *   `pool` is every idea in session (MMR) order; `inventions` its first `limit`.
 */
export async function inventRecipes({
  kitchen = [], cuisine = null, main = null, suggest, pairingIndex = null, nodes = null, names = null, limit = 12,
} = {}) {
  if (typeof suggest !== 'function') return { ok: false, reason: 'The recipe model is unavailable.' };
  const pantry = [...new Set(kitchen.map(lower))].filter((x) => x && !isBasicLike(x));
  if (pantry.length === 0) return { ok: false, reason: 'Add a few things to your kitchen first (salt, oil and the like are assumed).' };
  const kitchenSet = new Set(kitchen.map(lower));
  const chosen = main ? lower(main) : null;
  const anchors = chosen ? [chosen] : anchorOrder(pantry, nodes).slice(0, 5);
  const degree = pairingIndex?.degree;
  const common = (n) => !degree || degree.size === 0 || (degree.get(n) || 0) >= OUTSIDE_MIN_DEGREE;

  // The same question reaches the model many times across variants.
  const memo = new Map();
  const ask = (observed, opts) => {
    const key = `${observed.join('|')}#${opts.k}#${opts.candidateNames ? opts.candidateNames.slice().sort().join('|') : '*'}`;
    if (!memo.has(key)) {
      memo.set(key, Promise.resolve().then(() => suggest(observed, { cuisine, alpha: INVENT_ALPHA, ...opts })).catch(() => []));
    }
    return memo.get(key);
  };

  /** Common outside ingredients the model places in this dish, with evidence. */
  const outsideFor = async (members) => {
    const sugg = await ask(members, { k: 40 });
    const out = [];
    for (const s of sugg || []) {
      if (out.length >= OUTSIDE_PER_DISH) break;
      const nm = lower(s.name);
      if (!nm || isBasicLike(nm) || OUTSIDE_EXCLUDE.test(nm) || s.score < FIT_LOGIT) continue;
      if (members.includes(nm) || out.some((o) => o.name === nm)) continue;
      if (haveIngredient(nm, kitchenSet, { assumeBasics: true }).covered) continue; // lemon juice ≈ lemon
      if (names && names.size && !names.has(nm)) continue;
      if (!common(nm)) continue;
      // Something to buy needs evidence: an observed pairing with the dish.
      if (pairingIndex?.strength?.size && !members.some((m) => pairStrength(pairingIndex, nm, m) > 0)) continue;
      out.push({ name: nm, fit: sigmoid(s.score) });
    }
    return out;
  };

  const centres = kitchenCentres(pantry, nodes);
  const found = new Map(); // ingredient-set key → candidate
  const add = (kitchenPart, kitchenFit, outside, anchor) => {
    const all = [...kitchenPart, ...outside.map((o) => o.name)];
    if (all.length < 2 || all.length > DISH_MAX) return;
    if (chosen && !all.includes(chosen)) return;
    if (!hasCentre(all, { nodes, main: chosen })) return;
    if (centres.length && !centres.some((c) => all.includes(c))) return;
    const key = [...all].sort().join('|');
    if (found.has(key)) return;
    const fit = [...kitchenFit, ...outside.map((o) => o.fit)];
    const s = scoreDish(all, { kitchenCount: kitchenPart.length, pantrySize: pantry.length, fit, index: pairingIndex, nodes, main: chosen, cuisine });
    found.set(key, { all, outside: outside.map((o) => o.name), anchor, ...s });
  };

  for (const anchor of anchors) {
    for (let variant = 0; variant < VARIANTS; variant++) {
      const members = [anchor];
      const fit = [];
      let skip = false;
      while (members.length < DISH_MAX) {
        const cands = pantry.filter((x) => !members.includes(x));
        if (cands.length === 0) break;
        const sugg = await ask(members, { k: 8, candidateNames: cands });
        const ok = (sugg || []).filter((s) => cands.includes(s.name) && s.score >= FIT_LOGIT);
        // Variants 1..3 take the 2nd–4th best first partner, for different dishes.
        const pick = members.length === 1 ? ok[variant] : ok[0];
        if (!pick) { if (variant > 0 && members.length === 1) skip = true; break; }
        members.push(pick.name);
        fit.push(sigmoid(pick.score));
      }
      if (skip) continue;

      // The grown dish and its shorter prefixes (the model's order), each
      // alone and with one or two things to buy.
      const shortest = Math.max(1, members.length - 3);
      for (let len = members.length; len >= shortest; len--) {
        const part = members.slice(0, len);
        const partFit = fit.slice(0, len - 1);
        add(part, partFit, [], anchor);
        if (len >= DISH_MAX) continue;
        const outs = await outsideFor(part);
        for (let i = 0; i < outs.length; i++) {
          add(part, partFit, [outs[i]], anchor);
          if (len + 2 > DISH_MAX || MAX_OUTSIDE < 2) continue;
          for (let j = i + 1; j < Math.min(outs.length, 4); j++) add(part, partFit, [outs[i], outs[j]], anchor);
        }
      }
    }
  }

  if (found.size === 0) {
    return { ok: false, reason: 'Nothing in your kitchen goes together well enough to build a dish yet — add a few more things.' };
  }
  const ranked = [...found.values()].sort((a, b) => b.score - a.score);
  const floor = ranked[0].score - POOL_FLOOR;
  const kept = dropThinSubsets(ranked.filter((f) => f.score >= floor), { keysOf: (f) => f.all, minSize: DISH_MIN });

  const asInvention = (f) => ({
    name: '',
    dishType: null,
    cuisine,
    ingredients: f.all.map((n) => ({ name: n, needed: f.outside.includes(n), main: chosen ? n === chosen : n === f.anchor })),
    score: f.score,
    parts: f.parts,
    why: whyLine(f.pairs),
  });
  const ordered = mmrOrder(kept.map(asInvention), { keysOf: inventionKeys });
  const nameOpts = { cuisine, nodes, index: pairingIndex };
  const named = assignUniqueNames(ordered, (inv) => inventionNames(inventionKeys(inv), nameOpts).names);
  const pool = named.map(({ idea, name }) => ({ ...idea, name, dishType: inventionNames(inventionKeys(idea), nameOpts).dishType }));
  return { ok: true, inventions: pool.slice(0, limit), pool };
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
