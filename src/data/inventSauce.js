/**
 * inventSauce.js — "Invent a sauce": build a new sauce from one of the
 * Sauce Lab's technique skeletons (SAUCE_TEMPLATES, sauceScoring.js),
 * filling each role from the cook's pantry first, choosing the combination
 * whose ingredients pair best with each other and with the protein it will
 * be served with. The sauce counterpart of cocktailInvent.js.
 *
 * Each style keeps its template's required roles as required slots, and
 * narrows them by KIND where the chemistry demands it:
 *   Emulsion (Hollandaise) = fat + EGG YOLK (the emulsifier: its lecithin
 *                            holds fat droplets in water) + acid
 *   Roux (Béchamel/Velouté) = fat + FLOUR (cornstarch is not a roux) + liquid
 *                            (milk/cream, or stock)
 *   Brown reduction         = fat + flour + stock + aromatic
 *   Tomato                  = fat + tomato + aromatic
 *   Curry base              = fat + aromatic + spice (+ chili, liquid)
 *   Stir-fry                = soy / fish sauce / ferment paste + aromatic
 *   Mole                    = fat + dried chili + spice + chocolate/nut/sweet
 *   Salsa                   = tomato / tomatillo / fruit + aromatic
 *   Nut sauce               = nut or seed (tahini, peanut) (+ acid, seasoning)
 * A required slot is never left empty: it is filled from the pantry, or —
 * unless `pantryOnly` — from the ingredients most used for that role in
 * the sauce list, marked `need` ("you'd need"). With `pantryOnly` an
 * unfillable required slot is reported as missing, never invented around:
 * no hollandaise without egg yolk, no béchamel without a liquid.
 *
 * Optional slots take pantry ingredients only (nobody should shop for a
 * garnish), except with an empty pantry, where the whole sauce list is the
 * pool (as Invent a cocktail does with an empty bar).
 *
 * Score of a combination (WEAK-5) = coherence of its non-basic
 * ingredients (a quarter mean pair strength, three quarters each one's best partner,
 * each strength capped at PAIR_CAP;
 * pairStrength: recipe co-occurrence + curated sauce pairings; butter,
 * oil, flour and the like fill their slots but never count, so they cannot
 * carry a sauce or its "why" line) + mean strength with the protein + a
 * size term that peaks at 5–7 ingredients + a bonus for using what the cook
 * has + a small bonus for common ingredients − a charge for an optional
 * ingredient that pairs with nothing else in the sauce. Required slots are
 * always filled; optional ones from the pantry when they cohere.
 *
 * Which sauces are shown: maximal marginal relevance over the beam's
 * complete sauces (inventVariety.js), names kept unique in that order;
 * Shuffle walks the pool and then says it is exhausted.
 *
 * Amounts are a house table per kind, for about 1½–2 cups of sauce; the
 * UI says they are an idea from what pairs, not a tested recipe.
 */
import { SAUCE_TEMPLATES } from './sauceScoring.js';
import { sauceRoleOf, sauceKind, pairStrength } from './saucePantry.js';
import { isBasic, haveIngredient } from './myKitchen.js';
import { proteinIngredient } from './sauceWines.js';
import { mmrOrder, assignUniqueNames, nextIdeas, dropThinSubsets, EXHAUSTED_SAUCE } from './inventVariety.js';

export { EXHAUSTED_SAUCE };

export const SAUCE_SIZE = { min: 5, max: 7 };
export const LONELY_COST = 0.08;   // an optional ingredient that pairs with nothing else in the sauce
export const SAUCE_POOL_FLOOR = 0.45; // sauces scoring further below the best are not offered
// Pair strength counts up to PAIR_CAP ("a real pairing") and no further:
// one very strong pair (tomato + garlic) must not outweigh a fuller sauce
// whose every ingredient pairs well.
export const PAIR_CAP = 0.5;
const capped = (s) => Math.min(s, PAIR_CAP) / PAIR_CAP;

const norm = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const tmpl = (name) => SAUCE_TEMPLATES.find((t) => t.name === name);

// Prepared sauces and compounds are never offered as an ingredient to buy.
const COMPOUND = /\broux\b|beurre blanc|beurre monte|veloute|demi.glace|aioli|pesto|chimichurri|remoulade|toum|mayonnaise|meat glaze|nuoc cham|nam jim|ponzu|ketchup|worcestershire|curry paste|hoisin/;
const BODY_FRUIT = /mango|pineapple|peach|papaya|avocado/;

/** Basics a cook is assumed to have (myKitchen PANTRY_BASICS, as sauce lines). */
const BASIC_LINES = ['butter', 'olive oil', 'vegetable oil', 'flour', 'black pepper', 'sugar', 'water'];

/** Assumed basics (and any oil): they fill a slot but never carry the score or the "why". */
export function isSauceBasic(key) {
  const k = norm(key);
  return BASIC_LINES.includes(k) || isBasic(k) || /\boil\b/.test(k);
}

/** Size term: flat top for 5–7 ingredients, falling by `step` per ingredient outside it. */
export function sauceSizeTerm(n, { min = SAUCE_SIZE.min, max = SAUCE_SIZE.max, peak = 0.15, step = 0.1 } = {}) {
  if (n >= min && n <= max) return peak;
  return peak - step * (n < min ? min - n : n - max);
}

/**
 * slot: { id, label, roles, kinds?, test?(name, role, kind), required, key? }
 * `key` slots name the sauce.
 */
export const INVENT_STYLES = [
  {
    id: 'Béchamel', label: 'Roux & milk', word: 'Béchamel', familyId: 0, template: tmpl('Béchamel'),
    chemistry: 'A roux sauce needs fat, flour and a liquid: the flour’s starch swells and thickens at 60–70 °C.',
    slots: [
      { id: 'fat', label: 'fat', roles: ['Fat'], kinds: ['butter', 'oil'], required: true },
      { id: 'roux', label: 'flour (for the roux)', roles: ['Thickener'], kinds: ['flour'], required: true },
      { id: 'liquid', label: 'milk or cream', roles: ['Liquid'], kinds: ['milk', 'cream'], required: true },
      { id: 'aromatic', label: 'aromatic', roles: ['Aromatic'], kinds: ['onion', 'garlic'], required: false, key: true },
      { id: 'cheese', label: 'cheese', roles: ['Protein'], kinds: ['cheese'], required: false, key: true },
      { id: 'spice', label: 'spice', roles: ['Seasoning'], kinds: ['warm spice', 'paprika'], required: false, key: true },
      { id: 'herb', label: 'herb', roles: ['Herb'], required: false, key: true },
    ],
  },
  {
    id: 'Velouté', label: 'Roux & stock', word: 'Velouté', familyId: 1, template: tmpl('Velouté'),
    chemistry: 'A roux sauce needs fat, flour and a liquid — here a stock, simmered until the roux loses its raw taste.',
    slots: [
      { id: 'fat', label: 'fat', roles: ['Fat'], kinds: ['butter', 'oil'], required: true },
      { id: 'roux', label: 'flour (for the roux)', roles: ['Thickener'], kinds: ['flour'], required: true },
      { id: 'liquid', label: 'stock', roles: ['Liquid'], kinds: ['stock'], required: true, key: true },
      { id: 'wine', label: 'wine', roles: ['Liquid'], kinds: ['wine'], required: false, key: true },
      { id: 'aromatic', label: 'aromatic', roles: ['Aromatic'], kinds: ['onion', 'garlic', 'vegetable'], required: false, key: true },
      { id: 'cream', label: 'cream (to enrich)', roles: ['Liquid'], kinds: ['cream'], required: false },
      { id: 'acid', label: 'acid (to finish)', roles: ['Acid'], kinds: ['citrus'], required: false, key: true },
      { id: 'herb', label: 'herb', roles: ['Herb'], required: false, key: true },
    ],
  },
  {
    id: 'Espagnole', label: 'Brown reduction', word: 'Brown Sauce', familyId: 2, template: tmpl('Espagnole'),
    chemistry: 'A brown sauce needs fat, flour, stock and aromatics; browning the roux and vegetables (Maillard, 150 °C and up) builds the flavour.',
    slots: [
      { id: 'fat', label: 'fat', roles: ['Fat'], required: true },
      { id: 'roux', label: 'flour (for a brown roux)', roles: ['Thickener'], kinds: ['flour'], required: true },
      { id: 'liquid', label: 'stock', roles: ['Liquid'], kinds: ['stock'], required: true },
      { id: 'aromatic', label: 'aromatic', roles: ['Aromatic'], kinds: ['onion', 'vegetable', 'garlic'], required: true, key: true },
      { id: 'wine', label: 'wine (to deglaze)', roles: ['Liquid'], kinds: ['wine'], required: false, key: true },
      { id: 'tomato', label: 'tomato', roles: ['Acid', 'Other'], test: (n) => /tomat/.test(n), required: false },
      { id: 'meat', label: 'cured meat', roles: ['Protein'], kinds: ['meat'], required: false, key: true },
      { id: 'herb', label: 'herb', roles: ['Herb'], kinds: ['woody herb'], required: false, key: true },
    ],
  },
  {
    id: 'Hollandaise', label: 'Emulsion', word: 'Butter Sauce', familyId: 3, template: tmpl('Hollandaise'),
    // Oil + yolk + acid, whisked cold, is a mayonnaise (aïoli with garlic).
    wordFor: (lines) => (lines.some((l) => l.slot === 'fat' && /\boil\b/.test(l.key))
      ? (lines.some((l) => /garlic/.test(l.key)) ? 'Aïoli' : 'Mayonnaise') : 'Butter Sauce'),
    chemistry: 'An emulsion needs fat, an emulsifier and an acid: egg yolk’s lecithin holds the fat in tiny droplets; the acid steadies the yolk proteins.',
    slots: [
      // Toasted sesame and coconut oil overwhelm as the whole fat of an emulsion.
      { id: 'fat', label: 'fat', roles: ['Fat'], kinds: ['butter', 'oil'], test: (n) => !/sesame|coconut|palm/.test(n), required: true },
      { id: 'emulsifier', label: 'egg yolk (the emulsifier)', roles: ['Thickener'], kinds: ['egg'], required: true },
      { id: 'acid', label: 'acid', roles: ['Acid'], kinds: ['citrus', 'vinegar'], required: true, key: true },
      { id: 'aromatic', label: 'aromatic', roles: ['Aromatic'], kinds: ['onion', 'garlic'], required: false, key: true },
      { id: 'herb', label: 'herb', roles: ['Herb'], kinds: ['soft herb'], required: false, key: true },
      { id: 'spice', label: 'spice', roles: ['Seasoning', 'Chili'], kinds: ['paprika', 'pepper', 'dried chili', 'chili paste'], required: false, key: true },
    ],
  },
  {
    id: 'Tomato', label: 'Tomato simmer', word: 'Tomato Sauce', familyId: 4, template: tmpl('Tomato'),
    chemistry: 'A tomato sauce needs fat, tomato and aromatics; simmering drives off water and mellows the acid.',
    slots: [
      { id: 'fat', label: 'fat', roles: ['Fat'], required: true },
      { id: 'tomato', label: 'tomato', roles: ['Acid'], kinds: ['tomato'], required: true },
      { id: 'aromatic', label: 'aromatic', roles: ['Aromatic'], kinds: ['onion', 'garlic'], required: true, key: true },
      { id: 'aromatic2', label: 'second aromatic', roles: ['Aromatic'], kinds: ['onion', 'garlic'], required: false },
      { id: 'herb', label: 'herb', roles: ['Herb'], required: false, key: true },
      { id: 'chili', label: 'chili', roles: ['Chili'], required: false, key: true },
      { id: 'umami', label: 'umami', roles: ['Protein'], kinds: ['fish', 'cheese', 'meat'], required: false, key: true },
      { id: 'wine', label: 'wine', roles: ['Liquid'], kinds: ['wine'], required: false },
    ],
  },
  {
    id: 'Curry', label: 'Curry base', word: 'Curry', familyId: 5, template: tmpl('Curry'),
    chemistry: 'A curry base needs fat, aromatics and spice: whole and ground spices bloom in hot fat, where their aroma compounds dissolve.',
    slots: [
      { id: 'fat', label: 'fat', roles: ['Fat'], required: true },
      { id: 'aromatic', label: 'aromatic', roles: ['Aromatic'], kinds: ['onion', 'garlic', 'root', 'lemongrass'], required: true, key: true },
      { id: 'spice', label: 'spice', roles: ['Seasoning'], kinds: ['earthy spice', 'warm spice', 'paprika'], required: true, key: true },
      { id: 'aromatic2', label: 'second aromatic', roles: ['Aromatic'], kinds: ['garlic', 'root', 'lemongrass', 'onion'], required: false },
      { id: 'chili', label: 'chili', roles: ['Chili'], required: false, key: true },
      { id: 'liquid', label: 'liquid', roles: ['Liquid'], kinds: ['coconut', 'stock', 'cultured dairy', 'cream'], required: false, key: true },
      { id: 'acid', label: 'acid', roles: ['Acid'], kinds: ['tomato', 'citrus', 'sour'], required: false },
      { id: 'herb', label: 'herb', roles: ['Herb'], kinds: ['soft herb', 'aromatic leaf'], required: false, key: true },
    ],
  },
  {
    id: 'Stir-fry', label: 'Stir-fry', word: 'Stir-fry Sauce', familyId: 6, template: tmpl('Stir-fry'),
    chemistry: 'A stir-fry sauce is salt-and-umami led (soy, fish sauce or a fermented paste) with fast-cooked aromatics; a starch slurry glosses it at about 90 °C.',
    slots: [
      { id: 'umami', label: 'soy, fish sauce or paste', roles: ['Protein'], kinds: ['soy', 'fish', 'ferment paste'], required: true, key: true },
      { id: 'aromatic', label: 'aromatic', roles: ['Aromatic'], kinds: ['garlic', 'root', 'onion', 'lemongrass'], required: true, key: true },
      { id: 'aromatic2', label: 'second aromatic', roles: ['Aromatic'], kinds: ['garlic', 'root', 'onion'], required: false },
      { id: 'sweet', label: 'sweetener', roles: ['Other'], kinds: ['sweet'], required: false },
      { id: 'acid', label: 'acid', roles: ['Acid'], kinds: ['vinegar', 'citrus'], required: false },
      { id: 'chili', label: 'chili', roles: ['Chili'], required: false, key: true },
      { id: 'fat', label: 'oil', roles: ['Fat'], kinds: ['oil'], test: (n) => !/olive/.test(n), required: false },
      { id: 'starch', label: 'starch (for a slurry)', roles: ['Thickener'], kinds: ['starch'], required: false },
    ],
  },
  {
    id: 'Mole', label: 'Mole', word: 'Mole', familyId: 7, template: tmpl('Mole'),
    chemistry: 'A mole needs fat, dried chilies, spice and a rich body (chocolate, nuts or fruit); frying the purée in fat deepens and darkens it.',
    slots: [
      { id: 'fat', label: 'fat', roles: ['Fat'], required: true },
      { id: 'chili', label: 'dried chili', roles: ['Chili'], kinds: ['dried chili'], test: (n) => !/flake|powder|gochugaru|cayenne/.test(n), required: true, key: true },
      { id: 'spice', label: 'spice', roles: ['Seasoning'], kinds: ['warm spice', 'earthy spice'], required: true },
      { id: 'body', label: 'chocolate, nuts or fruit', roles: ['Other'], test: (n, r, k) => /chocolate|cocoa|plantain|raisin/.test(n) || k === 'nut', required: true, key: true },
      { id: 'sweet', label: 'sweetener', roles: ['Other'], kinds: ['sweet'], required: false },
      { id: 'aromatic', label: 'aromatic', roles: ['Aromatic'], kinds: ['onion', 'garlic'], required: false },
      { id: 'tomato', label: 'tomato', roles: ['Acid'], kinds: ['tomato'], required: false },
      { id: 'liquid', label: 'stock', roles: ['Liquid'], kinds: ['stock'], required: false },
    ],
  },
  {
    id: 'Salsa', label: 'Salsa', word: 'Salsa', familyId: 8, template: tmpl('Salsa'),
    chemistry: 'A salsa needs a juicy body (tomato, tomatillo or fruit) and aromatics; salt draws out the juices that become the sauce.',
    slots: [
      { id: 'body', label: 'tomato, tomatillo or fruit', roles: ['Acid', 'Other'], test: (n, r, k) => (r === 'Acid' && k === 'tomato') || BODY_FRUIT.test(n), required: true, key: true },
      { id: 'aromatic', label: 'aromatic', roles: ['Aromatic'], kinds: ['onion', 'garlic'], required: true, key: true },
      { id: 'aromatic2', label: 'second aromatic', roles: ['Aromatic'], kinds: ['onion', 'garlic'], required: false },
      { id: 'chili', label: 'chili', roles: ['Chili'], kinds: ['fresh chili', 'dried chili'], required: false, key: true },
      { id: 'herb', label: 'herb', roles: ['Herb'], kinds: ['soft herb'], required: false, key: true },
      { id: 'acid', label: 'citrus or vinegar', roles: ['Acid'], kinds: ['citrus', 'vinegar'], required: false },
    ],
  },
  {
    id: 'Nut Sauce', label: 'Nut sauce', word: 'Nut Sauce', familyId: 9, template: tmpl('Nut Sauce'),
    chemistry: 'A nut sauce needs a nut or seed paste; it seizes at first, then loosens to a pourable sauce as water goes in.',
    slots: [
      { id: 'nut', label: 'nut or seed', roles: ['Other'], kinds: ['nut'], required: true, key: true },
      { id: 'acid', label: 'acid', roles: ['Acid'], kinds: ['citrus', 'vinegar', 'sour'], required: false, key: true },
      { id: 'umami', label: 'soy or fish sauce', roles: ['Protein'], kinds: ['soy', 'fish', 'ferment paste'], required: false },
      { id: 'aromatic', label: 'aromatic', roles: ['Aromatic'], kinds: ['garlic', 'root'], required: false, key: true },
      { id: 'chili', label: 'chili', roles: ['Chili'], required: false, key: true },
      { id: 'sweet', label: 'sweetener', roles: ['Other'], kinds: ['sweet'], required: false },
      { id: 'liquid', label: 'liquid (to loosen)', roles: ['Liquid'], kinds: ['water', 'coconut', 'cultured dairy', 'stock'], required: false },
    ],
  },
];

export const INVENT_STYLE_BY_ID = new Map(INVENT_STYLES.map((s) => [s.id, s]));

/** Does an ingredient fit a slot? */
export function fitsSlot(name, slot, catMap) {
  const n = norm(name);
  const role = sauceRoleOf(n, catMap);
  if (!role || !slot.roles.includes(role)) return false;
  const kind = sauceKind(n, role);
  if (slot.kinds && !slot.kinds.includes(kind)) return false;
  if (slot.test && !slot.test(n, role, kind)) return false;
  return true;
}

/** Ingredient → number of sauces using it (catalogue-only names count 0). */
export function buildSaucePool(meta, sauces) {
  const pool = new Map();
  for (const i of meta || []) if (i?.name) pool.set(norm(i.name), 0);
  for (const s of sauces || []) {
    for (const x of new Set((s.ingredients || []).map((i) => norm(typeof i === 'string' ? i : i?.name)))) {
      if (x) pool.set(x, (pool.get(x) || 0) + 1);
    }
  }
  return pool;
}

// ── Amounts ───────────────────────────────────────────────────────────
/** A sensible amount for one line, by kind (house table, ~1½–2 cups of sauce). */
export function amountFor(name, slot, styleId, catMap) {
  const n = norm(name);
  const role = sauceRoleOf(n, catMap);
  const kind = sauceKind(n, role);
  const optional = !slot.required;
  switch (kind) {
    case 'butter':
      if (styleId === 'Hollandaise') return '½ cup (115 g), melted';
      return '3 tbsp';
    case 'oil':
      if (styleId === 'Hollandaise') return '¾ cup';
      if (styleId === 'Stir-fry') return '1 tbsp';
      return '2 tbsp';
    case 'animal fat': return '2 tbsp';
    case 'flour': return styleId === 'Espagnole' ? '3 tbsp' : '2 tbsp';
    case 'starch': return '1 tsp, in 1 tbsp cold water';
    case 'egg': return /yolk/.test(n) ? '3' : '3, yolks only';
    case 'milk': return '2 cups, warm';
    case 'cream': return optional ? '¼ cup' : '2 cups, warm';
    case 'cultured dairy': return '½ cup';
    case 'coconut': return '1 can (400 ml)';
    case 'stock': return styleId === 'Mole' || styleId === 'Nut Sauce' || styleId === 'Curry' ? '1 cup' : '2 cups';
    case 'wine': return /mirin|sake|shaoxing/.test(n) ? '2 tbsp' : '½ cup';
    case 'water': return 'as needed';
    case 'onion':
      if (/shallot/.test(n)) return '1 shallot, minced';
      if (/scallion|green onion|spring onion|chive/.test(n)) return '2, sliced';
      if (/leek/.test(n)) return '1 leek, sliced';
      return styleId === 'Salsa' ? '½ onion, finely diced' : '1 small onion, diced';
    case 'garlic': return '2 cloves, minced';
    case 'root': return '1 tbsp, grated';
    case 'lemongrass': return '1 stalk, bruised';
    case 'vegetable': return '1 small, diced';
    case 'citrus':
      if (/zest/.test(n)) return '1 tsp';
      if (/juice/.test(n)) return styleId === 'Salsa' || styleId === 'Nut Sauce' ? '2 tbsp' : '1 tbsp';
      return styleId === 'Salsa' || styleId === 'Nut Sauce' ? '1, juiced' : '½, juiced';
    case 'vinegar': return '1 tbsp';
    case 'tomato':
      if (/paste/.test(n)) return '1 tbsp';
      if (styleId === 'Salsa') return '4 ripe, diced';
      if (styleId === 'Tomato') return '1 can (400 g), or 4 ripe';
      return '1, chopped';
    case 'sour': return '1 tbsp';
    case 'dipping sauce': return '2 tbsp';
    case 'pepper': return '¼ tsp';
    case 'warm spice': return /nutmeg|mace|clove/.test(n) ? 'a pinch' : '½ tsp';
    case 'earthy spice': return '1 tsp';
    case 'paprika': return /cayenne/.test(n) ? 'a pinch' : '1 tsp';
    case 'salt': return 'to taste';
    case 'soft herb': return '2 tbsp, chopped';
    case 'woody herb': return /bay/.test(n) ? '1 leaf' : '1 tsp leaves';
    case 'aromatic leaf': return '2 leaves';
    case 'soy': return '3 tbsp';
    case 'fish': return /anchov/.test(n) ? '2 fillets' : '1 tbsp';
    case 'ferment paste': return '1 tbsp';
    case 'cheese': return '½ cup, grated';
    case 'meat': return '2 oz (60 g), diced';
    case 'fresh chili': return '1, minced';
    case 'dried chili': return /flake|powder|gochugaru|cayenne/.test(n) ? '½ tsp' : '3, toasted and soaked';
    case 'chili paste': return '1 tsp';
    case 'sweet': return styleId === 'Mole' ? '1 tbsp' : '1 tsp';
    case 'nut': return /tahini|butter|paste/.test(n) ? '⅓ cup' : '½ cup, toasted';
    case 'brine': return '1 tbsp';
    default:
      if (/chocolate|cocoa/.test(n)) return '1 oz (30 g)';
      if (BODY_FRUIT.test(n)) return '1, diced';
      return '1 tbsp';
  }
}

// ── Method text ───────────────────────────────────────────────────────
const and = (xs) => {
  const a = xs.filter(Boolean);
  if (a.length <= 1) return a[0] || '';
  return `${a.slice(0, -1).join(', ')} and ${a[a.length - 1]}`;
};

/** The method, from the style's technique, naming the actual ingredients. */
export function methodFor(styleId, lines) {
  const at = (id) => lines.find((l) => l.slot === id)?.key || null;
  const fat = at('fat');
  const herb = at('herb');
  const finish = (xs) => { const t = and(xs); return t ? ` Finish with the ${t}.` : ''; };
  switch (styleId) {
    case 'Béchamel':
      return `Melt the ${fat}${at('aromatic') ? ` and soften the ${at('aromatic')} in it` : ''}. Whisk in the ${at('roux')} and cook 2 minutes without browning (a white roux). Whisk in the warm ${at('liquid')} a little at a time and simmer 5–10 minutes until it coats a spoon — the starch thickens at 60–70 °C.${at('cheese') ? ` Off the heat, stir in the ${at('cheese')} until it melts.` : ''}${finish([at('spice'), herb])} Season with salt.`;
    case 'Velouté':
      return `Melt the ${fat}${at('aromatic') ? ` and sweat the ${at('aromatic')} in it` : ''}. Whisk in the ${at('roux')} and cook to a pale blond roux, about 3 minutes.${at('wine') ? ` Add the ${at('wine')} and let it bubble off.` : ''} Whisk in the hot ${at('liquid')} gradually and simmer 15–20 minutes, skimming, until smooth and lightly thick.${at('cream') ? ` Stir in the ${at('cream')}.` : ''}${finish([at('acid'), herb])} Season with salt.`;
    case 'Espagnole':
      return `Brown the ${and([at('meat'), at('aromatic')])} in the ${fat}. Stir in the ${at('roux')} and cook, stirring, until nut-brown — that browning is the flavour.${at('tomato') ? ` Add the ${at('tomato')} and let it darken.` : ''}${at('wine') ? ` Deglaze with the ${at('wine')} and reduce by half.` : ''} Whisk in the ${at('liquid')}${herb ? `, add the ${herb},` : ''} and simmer gently 30–45 minutes, skimming, until reduced by about a third. Strain and season.`;
    case 'Hollandaise': {
      const acid = at('acid');
      const arom = at('aromatic');
      const cold = lines.some((l) => l.slot === 'fat' && /\boil\b/.test(l.key));
      // Béarnaise-style (warm, butter): shallot reduced in vinegar, strained.
      // Garlic, and anything in a cold oil emulsion, is folded in instead.
      const reduce = !cold && arom && /vinegar/.test(acid) && !/garlic/.test(arom);
      const pre = reduce ? `Simmer the ${arom} in the ${acid} with a splash of water until almost dry, then strain. ` : '';
      const extras = [reduce ? null : arom, herb, at('spice')];
      if (cold) {
        return `With everything at room temperature, whisk the ${at('emulsifier')} with the ${acid}. Whisk in the ${fat} drop by drop, then in a thin stream as it thickens: the yolk’s lecithin holds the oil in tiny droplets (a mayonnaise). If it splits, start again with a fresh yolk and whisk the broken sauce into it.${finish(extras)} Season with salt.`;
      }
      return `${pre}Whisk the ${at('emulsifier')} with ${reduce ? 'the reduction' : `the ${acid}`} and a spoon of water over barely simmering water until thick and pale — keep it under 70 °C or the yolk sets. Off the heat, whisk in the warm ${fat} drop by drop, then in a thin stream: the yolk’s lecithin holds the fat in tiny droplets.${finish(extras)} Season; if it gets too thick, loosen with warm water.`;
    }
    case 'Tomato':
      return `Warm the ${fat} and soften the ${and([at('aromatic'), at('aromatic2')])} 8–10 minutes without colour${at('chili') ? `, adding the ${at('chili')} for the last minute` : ''}.${at('umami') ? ` Stir in the ${at('umami')}.` : ''}${at('wine') ? ` Add the ${at('wine')} and reduce by half.` : ''} Add the ${at('tomato')} and simmer 20–30 minutes until thick — the water cooks off and the acid mellows.${finish([herb])} Season with salt.`;
    case 'Curry':
      return `Heat the ${fat} and fry the ${and([at('aromatic'), at('aromatic2')])} until soft and golden. Add the ${and([at('spice'), at('chili')])} and fry 1 minute until fragrant — spices bloom in hot fat.${at('acid') ? ` Add the ${at('acid')} and cook it down.` : ''}${at('liquid') ? ` Pour in the ${at('liquid')} and simmer 10–15 minutes.` : ' Add a splash of water and simmer 10 minutes.'}${finish([herb])} Season with salt.`;
    case 'Stir-fry':
      return `Stir together the ${and([at('umami'), at('sweet'), at('acid')])}${at('starch') ? ` and the ${at('starch')} slurry` : ''}. In a very hot wok, flash the ${and([at('aromatic'), at('aromatic2'), at('chili')])} in ${at('fat') ? `the ${at('fat')}` : 'a little oil'} for 30 seconds, then add the sauce and toss until glossy${at('starch') ? ' — the starch sets at about 90 °C' : ''}.`;
    case 'Mole':
      return `Toast the ${at('chili')} in a dry pan, then soak in hot ${at('liquid') || 'water'} for 20 minutes. Toast the ${at('spice')}${at('body') ? ` and the ${at('body')}` : ''}. Blend everything${at('aromatic') || at('tomato') ? ` with the ${and([at('aromatic'), at('tomato')])}` : ''} until smooth. Fry the purée in the hot ${fat} 5–10 minutes, stirring, until it darkens, then simmer, loosening with liquid, until it coats a spoon. Season with salt.`;
    case 'Salsa':
      return `Finely chop the ${and([at('body'), at('aromatic'), at('aromatic2'), at('chili'), herb])}. Toss with ${at('acid') ? `the ${at('acid')} and ` : ''}a good pinch of salt and rest 15 minutes so the salt draws out the juices. Taste and adjust.`;
    case 'Nut Sauce':
      return `Whisk the ${at('nut')} with ${and([at('acid'), at('umami'), at('aromatic'), at('chili'), at('sweet')]) || 'a pinch of salt'}, then add ${at('liquid') ? `the ${at('liquid')}` : 'warm water'} a spoon at a time — it seizes at first, then loosens to a pourable sauce. Season.`;
    default:
      return '';
  }
}

// ── Inventing ─────────────────────────────────────────────────────────
const titleCase = (s) => String(s).replace(/\b([a-z])/g, (m) => m.toUpperCase());
const shortName = (k) => titleCase(String(k).replace(/ juice$/, '').replace(/^fresh /, '').replace(/ (sauce|leaf|leaves)$/, (m) => (/fish|soy|oyster/.test(k) ? m : '')));

/**
 * Candidates for each slot.
 * @returns {{ lists: Array<Array<{key, have, common}>>, missing: string[] }}
 */
function slotLists(style, { kitchen, assumeBasics, catMap, pool, pantryOnly, names, perSlot }) {
  const kitchenSet = new Set((kitchen || []).map(norm));
  const pantry = [...kitchenSet];
  if (assumeBasics) for (const b of BASIC_LINES) if (!kitchenSet.has(b)) pantry.push(b);
  const emptyPantry = kitchenSet.size === 0;
  const maxCommon = Math.max(1, ...pool.values());
  const commonness = (k) => Math.log1p(pool.get(k) || 0) / Math.log1p(maxCommon);
  const has = (k) => kitchenSet.has(k) || haveIngredient(k, kitchenSet, { assumeBasics, names }).covered;

  const missing = [];
  const lists = style.slots.map((slot) => {
    const fromPantry = pantry.filter((k) => fitsSlot(k, slot, catMap))
      .map((key) => ({ key, have: true, common: commonness(key) }));
    let list = fromPantry;
    const useFallback = emptyPantry || (slot.required && fromPantry.length === 0);
    if (useFallback && !pantryOnly) {
      const seen = new Set(fromPantry.map((c) => c.key));
      const extra = [...pool.keys()]
        .filter((k) => !seen.has(k) && !COMPOUND.test(k) && fitsSlot(k, slot, catMap))
        .map((key) => ({ key, have: has(key), common: commonness(key) }));
      list = [...fromPantry, ...extra];
    }
    list.sort((a, b) => (b.have ? 1 : 0) - (a.have ? 1 : 0) || b.common - a.common || a.key.localeCompare(b.key));
    list = list.slice(0, perSlot);
    if (slot.required && list.length === 0) missing.push(slot.label);
    return list;
  });
  return { lists, missing };
}

/**
 * Invent sauces in a style.
 * @param {object} opts
 *   styleId — INVENT_STYLES id (a SAUCE_TEMPLATES name); protein — optional label ("chicken");
 *   kitchen — the shared kitchen list; assumeBasics; pantryOnly — never fall back;
 *   meta — sauce catalogue ({name, category}[]); sauces — the sauce list (for the pool);
 *   catMap — buildCategoryMap(meta) (optional, built from meta);
 *   pairingIndex / sauceIndex — buildPairingIndex() results; names — for kitchen equivalents;
 *   limit — max inventions returned.
 * @returns {{ ok: true, sauces: Invention[] } | { ok: false, missing: string[], reason: string }}
 *   Invention = { name, styleId, familyId, lines: [{ key, slot, label, amount, have }],
 *                 need: string[], method, technique, description, why, score }
 */
export function inventSauces({
  styleId, protein = null, kitchen = [], assumeBasics = true, pantryOnly = false,
  meta = [], sauces = [], catMap = null, pairingIndex = null, sauceIndex = null, names = null,
  limit = 12, perSlot = 5, beam = 60,
} = {}) {
  const style = INVENT_STYLE_BY_ID.get(styleId);
  if (!style) return { ok: false, missing: [], reason: 'Unknown style' };
  const cats = catMap || new Map((meta || []).filter((i) => i?.name && i.category).map((i) => [norm(i.name), i.category]));
  const pool = buildSaucePool(meta, sauces);
  const { lists, missing } = slotLists(style, { kitchen, assumeBasics, catMap: cats, pool, pantryOnly, names, perSlot });
  if (missing.length) {
    return {
      ok: false,
      missing,
      reason: pantryOnly
        ? `${style.chemistry} Your pantry has nothing for: ${missing.join('; ')}.`
        : `Nothing in the sauce list can be the ${missing.join('; ')}.`,
    };
  }
  const prot = protein ? proteinIngredient(protein) : null;
  const ctx = { pairingIndex, sauceIndex };
  const scoreOf = (members, optional = new Set()) => {
    // Basics fill their slots but do not count: butter + cream must not carry a sauce.
    const xs = members.filter((m) => !isSauceBasic(m.key));
    const best = xs.map(() => 0);
    let sum = 0; let n = 0;
    for (let i = 0; i < xs.length; i++) {
      for (let j = i + 1; j < xs.length; j++) {
        const s = capped(pairStrength(xs[i].key, xs[j].key, ctx));
        sum += s; n += 1;
        if (s > best[i]) best[i] = s;
        if (s > best[j]) best[j] = s;
      }
    }
    const meanBest = xs.length ? best.reduce((a, b) => a + b, 0) / xs.length : 0;
    const pairing = 0.25 * (n ? sum / n : 0) + 0.75 * meanBest;
    const protS = prot ? xs.map((m) => capped(pairStrength(m.key, prot, ctx))) : [];
    const withProtein = protS.length ? protS.reduce((a, b) => a + b, 0) / protS.length : 0;
    // An optional ingredient that pairs with nothing in the sauce (or the
    // protein) does not cohere: it is there only to make up the numbers.
    let lonely = 0;
    xs.forEach((m, i) => { if (optional.has(m) && best[i] === 0 && !(protS[i] > 0)) lonely += 1; });
    // Using what the cook has earns a little per ingredient.
    const have = members.filter((m) => m.have).length;
    const common = members.length ? members.reduce((s, m) => s + m.common, 0) / members.length : 0;
    return pairing + withProtein + sauceSizeTerm(members.length) + 0.06 * have + 0.1 * common - LONELY_COST * lonely;
  };

  // Beam search over the slots; optional slots may stay empty.
  let partial = [{ picked: [], score: 0 }];
  style.slots.forEach((slot, i) => {
    const choices = slot.required ? lists[i] : [...lists[i], null];
    const next = [];
    for (const p of partial) {
      for (const c of choices) {
        if (c && p.picked.some((q) => q && q.key === c.key)) continue; // no ingredient twice
        const picked = [...p.picked, c];
        const optional = new Set(picked.filter((q, j) => q && !style.slots[j].required));
        next.push({ picked, score: scoreOf(picked.filter(Boolean), optional) });
      }
    }
    next.sort((a, b) => b.score - a.score);
    partial = next.slice(0, beam);
  });
  if (!partial.length || !partial[0].picked.length) return { ok: false, missing: [], reason: 'Nothing to build with' };

  // Session order by MMR (penalise overlap with sauces already shown), then
  // unique names in that order. `pool` is everything Shuffle can reach.
  const top = partial[0].score;
  const built = dropThinSubsets(
    partial.filter((p) => p.score >= top - SAUCE_POOL_FLOOR).map((p) => buildInvention(style, p, { catMap: cats, protein, ctx })),
    { keysOf: sauceKeys, minSize: SAUCE_SIZE.min },
  );
  const ordered = mmrOrder(built, { keysOf: sauceKeys });
  const ideas = assignUniqueNames(ordered, (inv) => inv.names).map(({ idea, name }) => ({ ...idea, name }));
  return { ok: true, sauces: ideas.slice(0, limit), pool: ideas };
}

const sauceKeys = (inv) => inv.lines.map((l) => l.key);

/**
 * The next sauces to show in this session (MMR over the pool, never one
 * already shown). [] means the pool is exhausted: show EXHAUSTED_SAUCE.
 */
export function nextSauces(pool, shown = [], n = 3) {
  return nextIdeas(pool, shown, n, { keysOf: sauceKeys });
}

function buildInvention(style, { picked, score }, { catMap, protein, ctx }) {
  const lines = [];
  style.slots.forEach((slot, i) => {
    const c = picked[i];
    if (!c) return;
    lines.push({ key: c.key, slot: slot.id, label: slot.label, amount: amountFor(c.key, slot, style.id, catMap), have: !!c.have });
  });
  const telling = style.slots
    .filter((s) => s.key)
    .map((s) => lines.find((l) => l.slot === s.id))
    .filter((l) => l && !isBasic(l.key));
  const word = style.wordFor ? style.wordFor(lines) : style.word;
  // Candidate names, best first: the first two telling ingredients, then
  // other pairs of them, then one alone, then "House …" (unique per session).
  const W = [...new Set(telling.map((l) => shortName(l.key)))];
  const names = [];
  for (let i = 0; i < W.length; i++) for (let j = i + 1; j < W.length; j++) names.push(`${W[i]} & ${W[j]} ${word}`);
  for (const w of W) names.push(`${w} ${word}`);
  names.push(`House ${word}`);
  const name = names[0];
  const prot = protein ? proteinIngredient(protein) : null;
  const pairs = [];
  for (let i = 0; i < lines.length; i++) {
    for (let j = i + 1; j < lines.length; j++) pairs.push({ a: lines[i].key, b: lines[j].key, s: pairStrength(lines[i].key, lines[j].key, ctx) });
    if (prot) pairs.push({ a: lines[i].key, b: protein, s: pairStrength(lines[i].key, prot, ctx) });
  }
  // Basics (butter, oil, flour …) never make the "why".
  const strong = pairs.filter((p) => p.s > 0 && !isSauceBasic(p.a) && !isSauceBasic(p.b))
    .sort((x, y) => y.s - x.s).slice(0, 2);
  const why = strong.length
    ? `Strongest pairings: ${strong.map((p) => `${p.a} + ${p.b}`).join(', ')}.`
    : `Follows the ${style.label.toLowerCase()} skeleton; no pairing data links these ingredients.`;
  return {
    name,
    names,
    styleId: style.id,
    familyId: style.familyId,
    lines,
    need: lines.filter((l) => !l.have).map((l) => l.key),
    method: methodFor(style.id, lines),
    technique: style.template?.technique || '',
    description: style.template?.description || '',
    chemistry: style.chemistry,
    why,
    score,
  };
}

/** Protein labels used in the sauce list, most common first. */
export function proteinVocabulary(sauces) {
  const counts = new Map();
  for (const s of sauces || []) for (const p of s.proteins || []) counts.set(p, (counts.get(p) || 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([p]) => p);
}
