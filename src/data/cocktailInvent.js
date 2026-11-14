/**
 * cocktailInvent.js — what the "Invent a cocktail" panel builds on: the
 * codex v2 family skeletons (an optional style, applied only when the cook
 * accepts it), the liquor choices for step 1, the ranking of suggestions (for
 * one part of a style, or for the whole list with the noise left out), and the
 * drink (amounts, name, "why") a list makes. The list starts empty: the cook
 * adds every ingredient (inventBuild.js); suggestions draw on the bar first or,
 * with an empty bar, on the whole cocktail role pool. Nothing is filled in.
 *
 * Skeletons follow the codex v2 families' dominant slots
 * (docs/cocktail-codex-v2/findings.md, public/data/cocktail_codex_v2.json):
 *   Sour Family      = spirit + sour + sweet (syrup or a sweet liqueur)
 *   Aromatic Stirred = spirit + vermouth (+ amaro / liqueur, + bitters)
 *   Highballs        = spirit + lengthener (+ sour + sweet makes it a fizz)
 *   Aperitivos       = amaro / aperitif + bubbles (+ vermouth)
 *   Tropical Sours   = spirit + sour + juice + liqueur or syrup
 *   Boozy Sippers    = spirit + sweet (syrup or liqueur) + bitters
 * Build method and glass are each family's most common in the codex.
 *
 * Amounts start from SLOT_DEFAULT_AMOUNT (src/data/cocktailAmounts.js),
 * times a per-slot multiple, then are scaled so the liquid total lands in
 * the family's volume range and rounded to ¼ oz. They are house
 * proportions, not tested recipes, and the UI says so. Extras added beyond
 * the skeleton get a small pour by role, or a plain amount for a herb or fruit.
 *
 * Guard rails (cocktailAdviceRules): a second base spirit and a second sour
 * are ADVICE (split base, check the balance), never refused; only an
 * ingredient twice is refused. A required slot the pool cannot fill is
 * reported missing, not invented around.
 *
 * rankCocktailSlot scores a candidate as its mean co-occurrence strength
 * with the rest of the build (buildPairingIndex strength) plus a small bonus
 * for ingredients common in cocktails, so an empty-bar draw prefers bottles
 * people own.
 */
import { SLOT_DEFAULT_AMOUNT } from './cocktailAmounts.js';
import { roleOf, familyKey, ROLE_LABEL } from './cocktailRiff.js';
import { GENERIC_BOTTLE_KEYS } from './myBar.js';
import { oneOf } from './inventBuild.js';

const SOUR_RE = /\b(lemon|lime|grapefruit|yuzu|citrus|sour mix|sweet and sour)\b/;
const BITTER_APERITIF = /campari|aperol|amaro|fernet|cynar|averna|montenegro|suze|gentian|bitter|chartreuse|absinthe/;
const SWEET_LIQUEUR = /liqueur|triple sec|curacao|cointreau|maraschino|benedictine|amaretto|creme de|grand marnier|falernum|galliano|drambuie|kahlua|elderflower|st germain|chambord|frangelico|sambuca|schnapp/;
const SOFT_AMARO = /\bamaro\b|montenegro|averna|nonino|ramazzotti|cynar/;
const BUBBLES =/prosecco|champagne|sparkling|cava|soda water|club soda|tonic|seltzer|carbonated water/;
const LENGTHENER = /soda water|club soda|tonic|ginger beer|ginger ale|seltzer|carbonated water|lemonade|cola|sparkling|prosecco|champagne|cider|beer/;
const TROPICAL_JUICE = /pineapple|coconut|passion fruit|mango|guava|orange juice|cranberry juice|apple juice/;
const NOT_A_BASE = /sloe|sherry|madeira|caraway|absinthe|port|wine|apricot brandy|cherry brandy|liqueur|cream|schnapp/;
const SPIRIT_FAMILIES = new Set(['whiskey', 'rum', 'brandy', 'agave spirit', 'gin', 'vodka']);

/**
 * What kind of thing an ingredient is, within its role — finer than the
 * role, so a substitute "looks the part": bubbles for bubbles, citrus for
 * citrus, one sweet liqueur for another, never soda for egg white.
 */
export function ingredientKind(key, role) {
  const k = String(key || '');
  if (SOUR_RE.test(k)) return 'citrus';
  if (BUBBLES.test(k) || LENGTHENER.test(k)) return 'bubbles';
  if (/egg|cream|milk|yolk|butter|ice cream/.test(k)) return 'dairy';
  if (/juice|nectar|puree|water/.test(k)) return 'juice';
  if (/wine|port|sherry|madeira/.test(k)) return 'wine';
  if (role === 'amaro_liqueur' || role === 'bitter') return BITTER_APERITIF.test(k) ? 'bitter' : 'sweet liqueur';
  return role || 'other';
}

/** Can this key be a drink's base spirit? */
export function isBaseSpirit(key, roles = {}) {
  return roleOf(key, roles) === 'spirit' && SPIRIT_FAMILIES.has(familyKey(key)) && !NOT_A_BASE.test(key);
}

/**
 * slot: { id, label, roles, test?(key)→bool, required, parts (× SLOT_DEFAULT_AMOUNT of `amountRole`) }
 */
export const FAMILY_SKELETONS = Object.freeze({
  2: {
    word: 'Sour', name: 'Sour Family', volume: [3, 3.75], build: 'Shake hard with ice, strain', glass: 'Coupe or cocktail glass',
    slots: [
      { id: 'base', label: 'base spirit', roles: ['spirit'], base: true, required: true, amountRole: 'spirit' },
      { id: 'sour', label: 'sour', roles: ['sour'], test: (k) => SOUR_RE.test(k), required: true, amountRole: 'sour' },
      // Syrup, a sweet liqueur, or a sweeter amaro (an amaro sour); not Campari or Fernet.
      { id: 'sweet', label: 'sweetener', roles: ['sweet', 'amaro_liqueur'], test: (k, r) => r === 'sweet' || (SWEET_LIQUEUR.test(k) && !BITTER_APERITIF.test(k)) || SOFT_AMARO.test(k), required: true, amountRole: 'sweet', key: true },
    ],
  },
  4: {
    word: 'Stirred', name: 'Aromatic Stirred', volume: [3, 3.5], build: 'Stir with ice, strain', glass: 'Cocktail glass or Nick & Nora',
    slots: [
      { id: 'base', label: 'base spirit', roles: ['spirit'], base: true, required: true, amountRole: 'spirit' },
      { id: 'vermouth', label: 'vermouth / aperitif wine', roles: ['vermouth'], required: true, amountRole: 'vermouth' },
      { id: 'modifier', label: 'liqueur / amaro', roles: ['amaro_liqueur'], test: (k) => !BUBBLES.test(k) && !/wine|port/.test(k), required: false, amountRole: 'amaro_liqueur', parts: 2 / 3, key: true },
      { id: 'bitters', label: 'bitters', roles: ['bitter'], required: false, amountRole: 'bitter' },
    ],
  },
  1: {
    word: 'Highball', name: 'Highballs & Fizzes', volume: [5, 7], build: 'Build over ice in the glass, top up and stir once', glass: 'Highball or Collins glass',
    slots: [
      { id: 'base', label: 'base spirit', roles: ['spirit'], base: true, required: true, amountRole: 'spirit' },
      { id: 'long', label: 'lengthener', roles: ['modifier', 'amaro_liqueur'], test: (k) => LENGTHENER.test(k), required: true, amountRole: 'modifier', parts: 2, key: true },
      { id: 'sour', label: 'sour', roles: ['sour'], test: (k) => SOUR_RE.test(k), required: false, amountRole: 'sour', parts: 2 / 3 },
    ],
  },
  5: {
    word: 'Spritz', name: 'Aperitivos', volume: [4.5, 6], build: 'Build over ice in the glass, top with the bubbles', glass: 'Wine glass or highball',
    slots: [
      { id: 'aperitif', label: 'liqueur / amaro (the base)', roles: ['amaro_liqueur'], test: (k) => BITTER_APERITIF.test(k) && !/absinthe|chartreuse/.test(k), required: true, amountRole: 'amaro_liqueur', parts: 2, primary: true },
      { id: 'bubbles', label: 'bubbles', roles: ['amaro_liqueur', 'modifier'], test: (k) => BUBBLES.test(k), required: true, amountRole: 'modifier', parts: 1.5, key: true },
      { id: 'vermouth', label: 'vermouth / aperitif wine', roles: ['vermouth'], required: false, amountRole: 'vermouth' },
    ],
  },
  0: {
    word: 'Tropical', name: 'Tropical Sours', volume: [4.5, 5.5], build: 'Shake (or flash-blend) with crushed ice', glass: 'Hurricane or Collins glass',
    slots: [
      { id: 'base', label: 'base spirit', roles: ['spirit'], base: true, required: true, amountRole: 'spirit' },
      { id: 'juice', label: 'juice', roles: ['modifier', 'sour'], test: (k) => TROPICAL_JUICE.test(k) && !SOUR_RE.test(k), required: true, amountRole: 'modifier', parts: 1, key: true },
      { id: 'sour', label: 'sour', roles: ['sour'], test: (k) => SOUR_RE.test(k), required: true, amountRole: 'sour' },
      { id: 'sweet', label: 'sweetener', roles: ['sweet', 'amaro_liqueur'], test: (k, r) => r === 'sweet' || (SWEET_LIQUEUR.test(k) && !BITTER_APERITIF.test(k)), required: true, amountRole: 'sweet', parts: 2 / 3 },
    ],
  },
  3: {
    word: 'Sipper', name: 'Boozy Sippers', volume: [2.5, 3], build: 'Stir with ice, strain over a large cube', glass: 'Old-fashioned glass',
    slots: [
      { id: 'base', label: 'base spirit', roles: ['spirit'], base: true, required: true, amountRole: 'spirit' },
      { id: 'sweet', label: 'sweetener', roles: ['sweet', 'amaro_liqueur'], test: (k, r) => (r === 'sweet' && !/juice/.test(k)) || (r === 'amaro_liqueur' && !BUBBLES.test(k) && !/wine|port/.test(k)), required: true, amountRole: 'sweet', parts: 1 / 3, partsByRole: { amaro_liqueur: 1 }, key: true },
      { id: 'bitters', label: 'bitters', roles: ['bitter'], required: false, amountRole: 'bitter' },
    ],
  },
});

/**
 * Family ids in the order the Invent panel shows them (most familiar first).
 * Also the tie-break when a search fits several families equally.
 */
export const INVENT_FAMILY_ORDER = Object.freeze([2, 4, 1, 5, 0, 3]);

/** "¾ oz" → 0.75; "2 dashes" → null (not a pour). */
export function ozOf(amount) {
  const m = /^\s*([0-9.]+)?\s*([¼½¾])?\s*oz/.exec(String(amount || ''));
  if (!m) return null;
  const frac = { '¼': 0.25, '½': 0.5, '¾': 0.75 }[m[2]] || 0;
  return (m[1] ? parseFloat(m[1]) : 0) + frac;
}

/** 1.75 → "1¾ oz"; rounds to the nearest ¼, never below ¼. */
export function formatOz(x) {
  const q = Math.max(0.25, Math.round(x * 4) / 4);
  const whole = Math.floor(q);
  const frac = { 0.25: '¼', 0.5: '½', 0.75: '¾' }[q - whole] || '';
  return `${whole || ''}${frac} oz`.replace(/^ /, '');
}

/** Amount strings for the filled slots, scaled into the family's volume range. */
export function scaleAmounts(filled, volume) {
  const base = filled.map(({ slot, role }) => {
    const def = SLOT_DEFAULT_AMOUNT[slot.amountRole];
    const oz = ozOf(def);
    return oz == null ? { text: def } : { oz: oz * (slot.partsByRole?.[role] ?? slot.parts ?? 1) };
  });
  const total = base.reduce((s, b) => s + (b.oz || 0), 0);
  const [lo, hi] = volume || [0, Infinity];
  const target = total < lo ? lo : total > hi ? hi : total;
  const k = total > 0 ? target / total : 1;
  return base.map((b) => (b.oz == null ? b.text : formatOz(b.oz * k)));
}

/** Candidate keys per role: from the bar, or from the whole role pool. */
export function candidatePool(bar, pool, roles) {
  const out = new Map();
  const add = (role, key, common) => {
    if (!out.has(role)) out.set(role, new Map());
    out.get(role).set(key, common);
  };
  if (bar && bar.length) {
    for (const key of bar) {
      const role = roleOf(key, roles);
      if (role) add(role, key, pool?.get(role)?.get(key) || 1);
    }
  } else if (pool) {
    for (const [role, m] of pool) for (const [key, common] of m) add(role, key, common);
  }
  return out;
}

function slotCandidates(slot, cands, roles) {
  const list = [];
  for (const role of slot.roles) {
    for (const [key, common] of cands.get(role) || []) {
      if (slot.base && !isBaseSpirit(key, roles)) continue;
      if (slot.test && !slot.test(key, role)) continue;
      // Never a second sour by the back door (a lime cordial as "sweetener").
      if (slot.id !== 'sour' && SOUR_RE.test(key)) continue;
      list.push({ key, common });
    }
  }
  const seen = new Set();
  return list.filter((c) => (seen.has(c.key) ? false : seen.add(c.key)));
}

const strengthOf = (index, a, b) => index?.strength?.get(`${a}|${b}`) || 0;

const titleCase = (s) => String(s).replace(/\b([a-z])/g, (m) => m.toUpperCase());
const short = (k) => titleCase(String(k).replace(/ juice$/, '').replace(/^fresh /, ''));
const GENERIC_NAME = /^(simple |sugar )?syrup$|^(soda|carbonated|sparkling) water$|^club soda$|^seltzer$|bitters$/;

/** Name and "why" for a drink made of `filled` ({ slot, key, role }) lines. */
function describeDrink(familyId, skel, filled, pairs) {
  const lead = filled.find((f) => f.slot.base || f.slot.primary);
  // The name's second word is the most telling modifier: the family's key
  // slot unless it is plain syrup, soda or bitters, then the next line.
  const telling = filled.filter((f) => f !== lead && !GENERIC_NAME.test(f.key));
  const keyLine = telling.find((f) => f.slot.key) || telling[0] || null;
  let word = skel.word;
  if (familyId === 1 && filled.some((f) => f.slot.id === 'sour')) word = 'Fizz';
  const name = `${[lead && short(lead.key), keyLine && short(keyLine.key)].filter(Boolean).join(' & ')} ${word}`.trim();
  const strong = pairs.filter((p) => p.s > 0).sort((x, y) => y.s - x.s).slice(0, 2);
  const why = strong.length
    ? `Strongest pairings in real recipes: ${strong.map((p) => `${p.a} + ${p.b}`).join(', ')}.`
    : `Follows the ${skel.name} proportions; no recipe pairing data links these ingredients.`;
  return { lead, name, why };
}

// ── The build model: skeleton, slot ranking, drink from a build ──

export const FAMILY_BLURB = Object.freeze({
  2: 'bright, shaken, citrus-forward',
  4: 'spirit-forward, silky',
  1: 'long, bubbly, easy',
  5: 'low-proof, bittersweet, bubbly',
  0: 'fruity, shaken, crushed ice',
  3: 'strong, stirred, slow',
});

function slotAccepts(slot, roles) {
  return (key) => {
    if (slot.base) return isBaseSpirit(key, roles);
    const role = roleOf(key, roles);
    if (role ? !slot.roles.includes(role) : !slot.test) return false;
    if (slot.test && !slot.test(key, role)) return false;
    // Never a second sour by the back door (a lime cordial as "sweetener").
    if (slot.id !== 'sour' && SOUR_RE.test(key)) return false;
    return true;
  };
}

/** The liquors a cook reaches for first, in the order a bar shelf lists them. */
export const COMMON_LIQUORS = Object.freeze([
  'gin', 'vodka', 'rum', 'tequila', 'mezcal', 'bourbon', 'rye', 'scotch', 'brandy', 'cognac', 'whiskey',
]);

/**
 * Step 1 choices, "Which liquor?": the bar's own base spirits first (have: true),
 * then COMMON_LIQUORS the roles know as a base spirit, no key twice.
 * -> [{ key, have }]
 */
export function liquorChoices({ stock = [], roles = {} } = {}) {
  const mine = [...new Set(stock)].filter((k) => isBaseSpirit(k, roles));
  const rest = COMMON_LIQUORS.filter((k) => !mine.includes(k) && isBaseSpirit(k, roles));
  return [...mine.map((key) => ({ key, have: true })), ...rest.map((key) => ({ key, have: false }))];
}

/**
 * The guard rails as ADVICE, never a refusal: a second base spirit is a split
 * base, a second sour wants a balance check. Only a duplicate is refused (built
 * into inventBuild). Also used by a build that has no style chosen yet.
 */
export function cocktailAdviceRules(roles = {}) {
  return [
    oneOf((k) => isBaseSpirit(k, roles), () => "Two base spirits: that's a split base. Fine, just know it.", { advise: true, kind: 'split-base' }),
    oneOf((k) => SOUR_RE.test(k), () => 'Two sours: check the balance.', { advise: true, kind: 'two-sours' }),
  ];
}

/**
 * A family's skeleton in the shape inventBuild.applyCategory / seedBuild want:
 * its slots (each with accepts(key)) plus the guard rails as advice rules.
 */
export function cocktailSkeleton(familyId, { roles = {} } = {}) {
  const skel = FAMILY_SKELETONS[familyId];
  if (!skel) return { slots: [], rules: [] };
  return {
    slots: skel.slots.map((slot) => ({ ...slot, accepts: slotAccepts(slot, roles) })),
    rules: cocktailAdviceRules(roles),
  };
}

const KITCHEN_NOISE = /^(salt|sea salt|kosher salt|water|ice|(black |white |ground |cracked )?pepper|peppercorns?)$/;
const BITTERS_KEY = /\bbitters?$/;
const SYRUPY = /\b(syrup|honey|agave|nectar)\b/;

/**
 * Should a no-slot suggestion be left out of the list? True for a generic catch-all
 * key (GENERIC_BOTTLE_KEYS and the bare "bitters" / "liqueur"), a second base spirit,
 * another bitters when one is in the list, and kitchen basics: salt, pepper, water,
 * ice, and sugar once a syrup (or honey, agave) is in the list.
 */
export function isSuggestionNoise(key, currentKeys = [], roles = {}) {
  const k = String(key).toLowerCase();
  if (GENERIC_BOTTLE_KEYS.has(k) || k === 'bitters' || k === 'liqueur' || k === 'spirit') return true;
  if (KITCHEN_NOISE.test(k)) return true;
  if (k === 'sugar' && currentKeys.some((c) => SYRUPY.test(c))) return true;
  if (isBaseSpirit(k, roles) && currentKeys.some((c) => isBaseSpirit(c, roles))) return true;
  if ((BITTERS_KEY.test(k) || roleOf(k, roles) === 'bitter') && currentKeys.some((c) => BITTERS_KEY.test(c) || roleOf(c, roles) === 'bitter')) return true;
  return false;
}

/**
 * Ranked candidates for one slot: [{ key, have, score }]. Bar items first
 * (have: true), then the rest of the codex pool; with an empty bar, the whole
 * pool. score = mean pairing strength with currentKeys + a small bonus for
 * ingredients common in cocktails.
 *
 * With NO slot (null) it ranks the whole pool, every role, the same way:
 * "what goes with what the cook has", bar first, minus isSuggestionNoise().
 */
export function rankCocktailSlot({ slot, currentKeys = [], bar = [], pool = null, roles = {}, pairingIndex = null } = {}) {
  const all = candidatePool([], pool, roles);
  const mine = bar && bar.length ? candidatePool(bar, pool, roles) : null;
  const maxCommon = Math.max(1, ...[...all.values(), ...(mine ? mine.values() : [])].flatMap((m) => [...m.values()]));
  const commonness = (c) => Math.log1p(c) / Math.log1p(maxCommon);
  const pair = (a, b) => strengthOf(pairingIndex, a, b) || strengthOf(pairingIndex, b, a);
  const skip = new Set(currentKeys);
  const candidatesOf = (cands) => (slot ? slotCandidates(slot, cands, roles) : [...cands.values()].flatMap((m) => [...m].map(([key, common]) => ({ key, common }))));
  const scored = (cands, have) => candidatesOf(cands)
    .filter((c) => !skip.has(c.key) && (slot || !isSuggestionNoise(c.key, currentKeys, roles)))
    .map((c) => {
      const mean = currentKeys.length ? currentKeys.reduce((s, k) => s + pair(c.key, k), 0) / currentKeys.length : 0;
      return { key: c.key, have, score: mean + 0.15 * commonness(c.common) };
    })
    .sort((x, y) => y.score - x.score || x.key.localeCompare(y.key));
  if (!mine) return scored(all, false);
  const own = scored(mine, true);
  const ownKeys = new Set(own.map((c) => c.key));
  return [...own, ...scored(all, false).filter((c) => !ownKeys.has(c.key))];
}

const EXTRA_AMOUNT = { bitter: '2 dashes', spirit: '¼ oz', amaro_liqueur: '¼ oz', vermouth: '¼ oz', sweet: '¼ oz', sour: '¼ oz', modifier: '½ oz' };
const HERB_EXTRA = /\b(mint|basil|rosemary|thyme|sage|cilantro|parsley|dill|tarragon|lavender|shiso)\b/;
const SMALL_FRUIT_EXTRA = /\b(cherry|cherries|olive|olives|berry|berries|grape|grapes|onion|onions)\b/;
const SOLID_EXTRA = /\b(cucumber|orange|lemon|lime|grapefruit|apple|pear|peach|melon|pineapple|ginger|jalapeno|jalapeño|chili|celery|peel|twist|zest|slice|wedge|fruit)\b/;
const LIQUID_AROMATIC = /\b(water|tincture|saline|extract|essence|absinthe|vanilla|smoke|rinse)\b/;

/**
 * A plain amount for an extra beyond the skeleton. Herbs, fruit and other
 * solids are not poured: a sprig, a few slices. Only a liquid aromatic gets a
 * dash; anything else with no role is "to taste".
 */
export function extraAmount(key, role) {
  const k = String(key || '').toLowerCase();
  if (!role || role === 'aromatic') {
    if (HERB_EXTRA.test(k)) return /leaves?$/.test(k) ? 'a few leaves' : 'a sprig';
    if (SMALL_FRUIT_EXTRA.test(k)) return 'a few';
    if (SOLID_EXTRA.test(k)) return 'a few slices';
    return role === 'aromatic' && LIQUID_AROMATIC.test(k) ? '1 dash' : 'to taste';
  }
  return EXTRA_AMOUNT[role] || 'to taste';
}

/**
 * The drink a build makes, in the shape the card, drinkAsCocktail and
 * drinkRows read. Amounts are re-run on every call (scaleAmounts over the
 * filled slots); extras get a small default pour by role.
 * opts: { familyId, familyName, roles, pairingIndex }
 */
export function drinkFromBuild(build, { familyId, familyName, roles = {}, pairingIndex = null } = {}) {
  const skel = FAMILY_SKELETONS[familyId];
  const filled = build.slots.filter((s) => s.line).map((slot) => ({ slot, key: slot.line.key, role: roleOf(slot.line.key, roles) || slot.roles?.[0] }));
  const amounts = scaleAmounts(filled, skel.volume);
  const lines = filled.map((f, i) => ({
    key: f.key, slot: f.slot.id, label: f.slot.label, role: f.role, amount: amounts[i], source: f.slot.line.source, locked: !!f.slot.locked,
  }));
  for (const x of build.extras) {
    const role = roleOf(x.key, roles);
    lines.push({ key: x.key, slot: 'extra', label: 'extra', role, amount: extraAmount(x.key, role), source: x.source, locked: false });
  }
  const keys = lines.map((l) => l.key);
  const pairs = [];
  const pair = (a, b) => strengthOf(pairingIndex, a, b) || strengthOf(pairingIndex, b, a);
  for (let i = 0; i < keys.length; i++) for (let j = i + 1; j < keys.length; j++) pairs.push({ a: keys[i], b: keys[j], s: pair(keys[i], keys[j]) });
  const { lead, name, why } = describeDrink(familyId, skel, filled, pairs);
  return {
    name,
    family: familyName || skel.name,
    familyId,
    base: lead?.key || null,
    lines,
    build: skel.build,
    glass: skel.glass,
    why,
  };
}

/** The drink as a codex-shaped cocktail, for the riff panel and nearestCocktails. */
export function drinkAsCocktail(drink) {
  return {
    name: drink.name,
    family_id: drink.familyId,
    ingredients_raw: drink.lines.map((l) => ({ raw: `${l.amount} ${l.key}` })),
  };
}

/** Rows shaped like riffRows() output, for nearestCocktails(). */
export function drinkRows(drink) {
  return drink.lines.map((l) => ({ raw: `${l.amount} ${l.key}`, name: l.key, key: l.key, role: l.role, measure: l.amount, swappable: true }));
}

export { ROLE_LABEL };
