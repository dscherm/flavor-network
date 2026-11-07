/**
 * saucePantry.js — "What can I make from my pantry?" for the Sauce Lab.
 * The sauce counterpart of myBar.js, on the shared kitchen list
 * (myKitchen.js, localStorage `fn-my-kitchen`) that the Make flow edits too.
 *
 * Coverage is myKitchen's: exact name, a plain-language equivalent (lemon
 * covers lemon juice), or an assumed basic (salt, pepper, oil, butter,
 * sugar, flour) when the cook leaves "assume basics" on.
 *
 * Stand-ins: when a sauce is exactly one ingredient away, we look in the
 * pantry for something that plays the SAME ROLE and is the SAME KIND —
 * lime for lemon, shallot for onion, cream for crème fraîche — and never
 * across roles or kinds: no flour for egg yolk (a starch cannot emulsify),
 * no milk for cream (it will not reduce), no garlic for onion. Ties are
 * broken by how well the stand-in pairs with the rest of the sauce.
 *
 * Roles are the sauce-ingredient categories of public/data/sauce_augment.json
 * (Fat, Liquid, Thickener, Aromatic, Acid, Seasoning, Herb, Protein, Chili,
 * Other); kinds are finer groups within a role (sauceKind below).
 */
import { coverIngredients, whatCanICook, isBasic } from './myKitchen.js';

export const SAUCE_ROLES = ['Fat', 'Liquid', 'Thickener', 'Aromatic', 'Acid', 'Seasoning', 'Herb', 'Protein', 'Chili', 'Other'];

const stripAccents = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '');
const norm = (s) => stripAccents(s).toLowerCase().trim();

// Dairy and eggs are classified by name before the catalogue: the
// catalogue files sour cream and buttermilk under "Other", but for a
// stand-in they are dairy liquids like cream.
const DAIRY = /\b(milk|cream|creme fraiche|half and half|yogh?urt|buttermilk|mascarpone|kefir|labneh)\b/;
const EGG = /\begg( yolks?)?s?\b|\byolks?\b/;

// Fallback when an ingredient is not in the sauce catalogue.
const ROLE_RULES = [
  [/peanut butter|almond butter|beurre blanc/, 'Other'],
  [/\b(butter|ghee|oil|lard|schmaltz|tallow|duck fat|bacon fat|beurre)\b/, 'Fat'],
  [/\b(stock|broth|dashi|fumet|demi|bouillon|wine|sake|mirin|vermouth|sherry|madeira|cider|beer|cognac|brandy|water)\b/, 'Liquid'],
  [/\b(flour|cornstarch|corn starch|arrowroot|tapioca|potato starch|roux)\b/, 'Thickener'],
  [/\b(vinegar|lemon|lime|yuzu|orange|grapefruit|tamarind|tomatillo|tomato(es)?|verjus|sumac)\b/, 'Acid'],
  [/\b(onion|shallot|scallion|leek|garlic|ginger|galangal|lemongrass|celery|carrot|chive)s?\b/, 'Aromatic'],
  [/\b(jalapeno|habanero|serrano|chipotle|ancho|guajillo|pasilla|arbol|chil[ie]|chilli|sriracha|sambal|harissa|gochugaru|scotch bonnet|cayenne|pepper flakes)\b/, 'Chili'],
  [/\b(parsley|thyme|basil|oregano|cilantro|coriander leaf|mint|dill|tarragon|chervil|rosemary|sage|bay|marjoram|epazote|curry leaf)\b/, 'Herb'],
  [/\b(salt|pepper|peppercorns?|nutmeg|cumin|coriander|turmeric|paprika|cinnamon|clove|cardamom|allspice|anise|fenugreek|caraway|garam masala|mace)\b/, 'Seasoning'],
  [/\b(soy|tamari|fish sauce|anchov|miso|parmesan|pecorino|gruyere|cheddar|cheese|pancetta|guanciale|bacon|shrimp paste|oyster sauce)\b/, 'Protein'],
];

/** name → category, from the sauce catalogue ({name, category}[]). */
export function buildCategoryMap(meta) {
  const m = new Map();
  for (const i of meta || []) if (i?.name && i.category) m.set(norm(i.name), i.category);
  return m;
}

/** The sauce role (catalogue category) of an ingredient, or null. */
export function sauceRoleOf(name, catMap = new Map()) {
  const n = norm(name);
  if (!n) return null;
  if (EGG.test(n) && !/eggplant/.test(n)) return 'Thickener';
  if (DAIRY.test(n) && !/coconut|peanut|cream of|ice cream/.test(n)) return 'Liquid';
  if (catMap.has(n)) return catMap.get(n);
  for (const [rx, role] of ROLE_RULES) if (rx.test(n)) return role;
  return null;
}

/**
 * The kind of an ingredient within its role. Two ingredients may stand in
 * for each other only when role AND kind match. "Other" falls back to the
 * name itself, so ketchup never stands in for tahini.
 */
export function sauceKind(name, role) {
  const n = norm(name);
  switch (role) {
    case 'Fat':
      if (/butter|ghee|beurre|clarified/.test(n)) return 'butter';
      if (/\boil\b/.test(n)) return 'oil';
      return 'animal fat';
    case 'Liquid':
      if (/coconut/.test(n)) return 'coconut';
      if (/yogh?urt|sour cream|buttermilk|kefir|labneh/.test(n)) return 'cultured dairy';
      if (/cream|creme fraiche|mascarpone|half and half/.test(n)) return 'cream';
      if (/milk/.test(n)) return 'milk';
      if (/stock|broth|dashi|fumet|demi|bouillon|glace|veloute/.test(n)) return 'stock';
      if (/wine|sake|mirin|vermouth|sherry|madeira|port|shaoxing|cider|beer|cognac|brandy/.test(n)) return 'wine';
      return n;
    case 'Thickener':
      if (EGG.test(n)) return 'egg';
      if (/flour|roux/.test(n)) return 'flour';
      return 'starch';
    case 'Aromatic':
      if (/garlic/.test(n)) return 'garlic';
      if (/onion|shallot|scallion|leek|chive/.test(n)) return 'onion';
      if (/ginger|galangal/.test(n)) return 'root';
      if (/lemongrass/.test(n)) return 'lemongrass';
      return 'vegetable';
    case 'Acid':
      if (/vinegar/.test(n)) return 'vinegar';
      if (/lemon|lime|yuzu|orange|grapefruit|citrus/.test(n)) return 'citrus';
      if (/tomat/.test(n)) return 'tomato';
      if (/ponzu|nuoc cham|nam jim/.test(n)) return 'dipping sauce';
      return 'sour';
    case 'Seasoning':
      if (/salt/.test(n)) return 'salt';
      if (/pepper/.test(n)) return 'pepper';
      if (/nutmeg|mace|cinnamon|clove|allspice|cardamom|anise|five.spice/.test(n)) return 'warm spice';
      if (/paprika|cayenne|chili powder/.test(n)) return 'paprika';
      return 'earthy spice';
    case 'Herb':
      if (/thyme|rosemary|sage|oregano|bay|marjoram|savory/.test(n)) return 'woody herb';
      if (/leaf|leaves|epazote/.test(n)) return 'aromatic leaf';
      return 'soft herb';
    case 'Protein':
      if (/soy|tamari|shoyu|oyster sauce/.test(n)) return 'soy';
      if (/fish sauce|anchov|shrimp|bonito|katsuobushi|crayfish/.test(n)) return 'fish';
      if (/miso|doenjang|doubanjiang|gochujang|black bean/.test(n)) return 'ferment paste';
      if (/parmesan|pecorino|gruyere|cheddar|cheese|comte|grana/.test(n)) return 'cheese';
      return 'meat';
    case 'Chili':
      if (/sriracha|sambal|harissa|shito|paste|sauce|oil|amarillo/.test(n)) return 'chili paste';
      if (/dried|ancho|guajillo|pasilla|chipotle|arbol|flake|gochugaru|kashmiri|aleppo|cayenne/.test(n)) return 'dried chili';
      return 'fresh chili';
    case 'Other':
      if (/honey|sugar|jaggery|maple|molasses|syrup|agave/.test(n)) return 'sweet';
      if (/peanut|almond|cashew|tahini|sesame|walnut|pine nut|hazelnut|pistachio/.test(n)) return 'nut';
      if (/caper|olive|cornichon|pickle|gherkin/.test(n)) return 'brine';
      return n;
    default:
      return null;
  }
}

/** Same role and kind (both known)? */
export function sameRoleAndKind(a, b, catMap) {
  const ra = sauceRoleOf(a, catMap);
  const rb = sauceRoleOf(b, catMap);
  if (!ra || ra !== rb) return false;
  const ka = sauceKind(a, ra);
  return ka != null && ka === sauceKind(b, rb);
}

const strengthOf = (index, a, b) => index?.strength?.get(`${a}|${b}`) || 0;

/**
 * Pair strength used across the pantry + Invent panels: the main
 * ingredient graph (recipe co-occurrence) plus half the curated
 * sauce-ingredient pairing strength. Both are optional.
 */
export function pairStrength(a, b, { pairingIndex = null, sauceIndex = null } = {}) {
  return strengthOf(pairingIndex, a, b) + 0.5 * strengthOf(sauceIndex, a, b);
}

const nameOf = (i) => (typeof i === 'string' ? i : i?.name || '');

/**
 * A same-role, same-kind stand-in from the pantry for one missing
 * ingredient of a sauce, or null.
 * @returns {{ for: string, use: string, role: string, kind: string } | null}
 */
export function standInFor(missing, sauce, kitchen, { catMap = new Map(), pairingIndex = null, sauceIndex = null } = {}) {
  const role = sauceRoleOf(missing, catMap);
  if (!role) return null;
  const kind = sauceKind(missing, role);
  const inSauce = new Set((sauce?.ingredients || []).map((i) => norm(nameOf(i))));
  const others = (sauce?.ingredients || []).map(nameOf).filter((n) => n && norm(n) !== norm(missing));
  let best = null;
  for (const k of kitchen || []) {
    const key = norm(k);
    if (!key || inSauce.has(key) || key === norm(missing)) continue;
    if (sauceRoleOf(key, catMap) !== role || sauceKind(key, role) !== kind) continue;
    const score = others.reduce((s, o) => s + pairStrength(key, o, { pairingIndex, sauceIndex }), 0);
    if (!best || score > best.score || (score === best.score && key < best.use)) best = { for: missing, use: k, role, kind, score };
  }
  if (!best) return null;
  const { score, ...out } = best;
  return out;
}

/**
 * Coverage of one sauce by the pantry, plus a stand-in when exactly one
 * ingredient is missing.
 */
export function coverSauce(sauce, kitchen, { assumeBasics = true, names = null, catMap = new Map(), pairingIndex = null, sauceIndex = null } = {}) {
  const list = sauce?.ingredientsDetailed?.length ? sauce.ingredientsDetailed : sauce?.ingredients;
  const c = coverIngredients(list, kitchen, { assumeBasics, names });
  const standIn = c.missing.length === 1
    ? standInFor(c.missing[0], sauce, kitchen, { catMap, pairingIndex, sauceIndex })
    : null;
  return { item: sauce, ...c, standIn };
}

/**
 * Every sauce the pantry covers (`make`) and every sauce one or two
 * ingredients away (`nearly`, naming what is missing). Sauces one away
 * with a stand-in in the pantry come first. An empty pantry gives nothing:
 * basics alone do not make a sauce.
 */
export function whatSauceCanIMake(sauces, kitchen, { maxMissing = 2, assumeBasics = true, names = null, catMap = new Map(), pairingIndex = null, sauceIndex = null } = {}) {
  if (!kitchen || (kitchen.size ?? kitchen.length) === 0) return { make: [], nearly: [] };
  const base = whatCanICook(sauces, kitchen, { maxMissing, assumeBasics, names });
  const ctx = { catMap, pairingIndex, sauceIndex };
  const make = base.make.map((e) => ({ ...e, standIn: null }));
  const nearly = base.nearly.map((e) => ({
    ...e,
    standIn: e.missing.length === 1 ? standInFor(e.missing[0], e.item, kitchen, ctx) : null,
  }));
  nearly.sort((a, b) => a.missing.length - b.missing.length
    || (b.standIn ? 1 : 0) - (a.standIn ? 1 : 0)
    || b.covered - a.covered
    || String(a.item.name).localeCompare(String(b.item.name)));
  return { make, nearly };
}

/** The n ingredients used by the most sauces, basics excluded (quick-add chips). */
export function commonSauceIngredients(sauces, n = 20) {
  const counts = new Map();
  for (const s of sauces || []) {
    for (const i of new Set((s.ingredients || []).map((x) => norm(nameOf(x))))) {
      if (!i || isBasic(i)) continue;
      counts.set(i, (counts.get(i) || 0) + 1);
    }
  }
  return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, n).map(([k]) => k);
}

/** Every ingredient name the Sauce Lab knows (catalogue + every sauce line). */
export function sauceIngredientNames(meta, sauces) {
  const out = new Set();
  const lower = (s) => String(s || '').toLowerCase().trim(); // accents kept, as written
  for (const i of meta || []) if (i?.name) out.add(lower(i.name));
  for (const s of sauces || []) for (const x of s.ingredients || []) { const n = lower(nameOf(x)); if (n) out.add(n); }
  return out;
}
