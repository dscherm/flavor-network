/**
 * cocktailInvent.js — "Invent a cocktail": build a new drink from a family
 * skeleton, filling each role from the user's bar (or, with an empty bar,
 * from the whole cocktail role pool), choosing the combination whose
 * ingredients pair best in real recipes.
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
 * proportions, not tested recipes, and the UI says so.
 *
 * Guard rails: one base spirit (the Aperitivo skeleton has none: the
 * aperitif is the base), never two sours, no ingredient twice, and a
 * required role the pool cannot fill is reported, not invented.
 *
 * Pairing score of a combination = mean co-occurrence strength over every
 * pair of its lines (buildPairingIndex strength), plus a small bonus for
 * ingredients common in cocktails, so a whole-pool draw prefers bottles
 * people own.
 */
import { SLOT_DEFAULT_AMOUNT } from './cocktailAmounts.js';
import { roleOf, familyKey, ROLE_LABEL } from './cocktailRiff.js';

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

/**
 * Invent drinks for a family.
 * @param {object} opts
 *   familyId — codex family id (0–5); base — optional base spirit key;
 *   bar — array of bar keys (empty → whole pool); pool — buildRolePool();
 *   roles — slot dictionary; pairingIndex — buildPairingIndex(); limit — max drinks.
 * @returns {{ ok: true, drinks: Drink[] } | { ok: false, missing: string[], reason: string }}
 *   Drink = { name, family, lines: [{ key, role, slot, label, amount }], build, glass,
 *             why, score, base }
 */
export function inventCocktails({ familyId, base = null, bar = [], pool = null, roles = {}, pairingIndex = null, limit = 12, perSlot = 6 } = {}) {
  const skel = FAMILY_SKELETONS[familyId];
  if (!skel) return { ok: false, missing: [], reason: 'Unknown family' };
  const cands = candidatePool(bar, pool, roles);
  const maxCommon = Math.max(1, ...[...cands.values()].flatMap((m) => [...m.values()]));
  const commonness = (c) => Math.log1p(c) / Math.log1p(maxCommon);

  const baseSlot = skel.slots.find((s) => s.base);
  let bases = [null];
  if (baseSlot) {
    let list = slotCandidates(baseSlot, cands, roles);
    if (base) {
      const want = list.filter((c) => c.key === base);
      // The chosen base is used even when it is not in the bar / pool lists.
      list = want.length ? want : (isBaseSpirit(base, roles) || !Object.keys(roles).length ? [{ key: base, common: 1 }] : []);
    }
    if (list.length === 0) {
      return { ok: false, missing: [baseSlot.label], reason: base ? `${base} can't be a base spirit` : 'No base spirit in your bar' };
    }
    bases = list.sort((a, b) => b.common - a.common).slice(0, base ? 1 : 5);
  }

  const otherSlots = skel.slots.filter((s) => !s.base);
  const missing = new Set();
  const combos = [];
  for (const b of bases) {
    const anchor = b?.key;
    // Per slot: candidates ranked by pairing with the base (or commonness), top perSlot.
    const lists = otherSlots.map((slot) => {
      const list = slotCandidates(slot, cands, roles).filter((c) => c.key !== anchor);
      return list
        .map((c) => ({ ...c, pre: (anchor ? strengthOf(pairingIndex, c.key, anchor) : 0) + 0.15 * commonness(c.common) }))
        .sort((x, y) => y.pre - x.pre)
        .slice(0, perSlot);
    });
    otherSlots.forEach((slot, i) => { if (slot.required && lists[i].length === 0) missing.add(slot.label); });
    if (otherSlots.some((slot, i) => slot.required && lists[i].length === 0)) continue;
    // Cartesian product; optional slots may stay empty.
    const choices = lists.map((l, i) => (otherSlots[i].required ? l : [...l, null]));
    const walk = (i, picked) => {
      if (i === choices.length) {
        const keys = [anchor, ...picked.map((p) => p?.key)].filter(Boolean);
        if (new Set(keys).size !== keys.length) return; // no ingredient twice
        combos.push({ base: b, picked: [...picked] });
        return;
      }
      for (const c of choices[i]) { picked.push(c); walk(i + 1, picked); picked.pop(); }
    };
    walk(0, []);
  }
  if (combos.length === 0) {
    return { ok: false, missing: [...missing], reason: missing.size ? `Your bar has nothing for: ${[...missing].join(', ')}` : 'Nothing to build with' };
  }

  const scored = combos.map(({ base: b, picked }) => {
    const members = [b, ...picked].filter(Boolean);
    let sum = 0; let n = 0; const pairs = [];
    for (let i = 0; i < members.length; i++) {
      for (let j = i + 1; j < members.length; j++) {
        const s = strengthOf(pairingIndex, members[i].key, members[j].key);
        sum += s; n += 1;
        pairs.push({ a: members[i].key, b: members[j].key, s });
      }
    }
    const pairing = n ? sum / n : 0;
    // An optional slot earns its place only by pairing: empty optional is fine.
    const common = members.reduce((s, m) => s + commonness(m.common), 0) / members.length;
    return { b, picked, pairs, score: pairing + 0.1 * common };
  }).sort((x, y) => y.score - x.score);

  const drinks = scored.slice(0, limit).map((c) => buildDrink(familyId, skel, c, roles));
  return { ok: true, drinks };
}

const titleCase = (s) => String(s).replace(/\b([a-z])/g, (m) => m.toUpperCase());
const short = (k) => titleCase(String(k).replace(/ juice$/, '').replace(/^fresh /, ''));
const GENERIC_NAME = /^(simple |sugar )?syrup$|^(soda|carbonated|sparkling) water$|^club soda$|^seltzer$|bitters$/;

function buildDrink(familyId, skel, { b, picked, pairs, score }, roles) {
  const filled = [];
  if (b) filled.push({ slot: skel.slots.find((s) => s.base), key: b.key, role: 'spirit' });
  skel.slots.filter((s) => !s.base).forEach((slot, i) => { if (picked[i]) filled.push({ slot, key: picked[i].key, role: roleOf(picked[i].key, roles) }); });
  const amounts = scaleAmounts(filled, skel.volume);
  const lines = filled.map((f, i) => ({
    key: f.key,
    slot: f.slot.id,
    label: f.slot.label,
    role: roleOf(f.key, roles) || f.slot.roles[0],
    amount: amounts[i],
  }));
  const lead = filled.find((f) => f.slot.base || f.slot.primary);
  // The name's second word is the most telling modifier: the family's key
  // slot unless it is plain syrup, soda or bitters, then the next line.
  const telling = filled.filter((f) => f !== lead && !GENERIC_NAME.test(f.key));
  const keyLine = telling.find((f) => f.slot.key) || telling[0] || null;
  let word = skel.word;
  if (familyId === 1 && filled.some((f) => f.slot.id === 'sour')) word = 'Fizz';
  const name = `${[lead && short(lead.key), keyLine && short(keyLine.key)].filter(Boolean).join(' & ')} ${word}`;
  const strong = pairs.filter((p) => p.s > 0).sort((x, y) => y.s - x.s).slice(0, 2);
  const why = strong.length
    ? `Strongest pairings in real recipes: ${strong.map((p) => `${p.a} + ${p.b}`).join(', ')}.`
    : `Follows the ${skel.name} proportions; no recipe pairing data links these ingredients.`;
  return {
    name,
    family: skel.name,
    familyId,
    base: lead?.key || null,
    lines,
    build: skel.build,
    glass: skel.glass,
    why,
    score,
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
