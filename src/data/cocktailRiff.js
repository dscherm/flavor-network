/**
 * cocktailRiff.js — "Riff on a classic": swap one structural role at a time
 * and see which real cocktail the riff now resembles.
 *
 * - Every ingredient line gets a role (spirit / sour / sweet / vermouth /
 *   amaro_liqueur / modifier / bitter / aromatic) from the cocktail slot
 *   dictionary (public/data/cocktail_roles.json), else guessSlot().
 * - Swap candidates for a line are ingredients that play the SAME role in
 *   other cocktails, normalised to graph names, ranked by how strongly they
 *   co-occur with the rest of the drink (src/data/recipePairingMatch.js
 *   pairing index) plus how common they are in cocktails.
 * - After any change, nearestCocktails() names the existing drinks the
 *   riff is closest to by shared ingredients (Jaccard), so a riff that has
 *   turned into a Boulevardier says so.
 */
import { resolveIngredientName, isTrivialIngredient } from './recipePairingMatch.js';
import { guessSlot } from './cocktailFacets.js';
import { splitAmount, SLOT_DEFAULT_AMOUNT } from './cocktailAmounts.js';
import { normalizeIngredient } from './normalizeIngredient.js';

export const SWAPPABLE_ROLES = ['spirit', 'sour', 'sweet', 'vermouth', 'amaro_liqueur', 'modifier', 'bitter', 'aromatic'];
export const ROLE_LABEL = {
  spirit: 'base spirit', sour: 'sour', sweet: 'sweetener', vermouth: 'vermouth / aperitif wine',
  amaro_liqueur: 'liqueur / amaro', modifier: 'lengthener / modifier', bitter: 'bitters', aromatic: 'garnish / aromatic',
};

const stripAccents = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '');

// The slot dictionary is noisy at the edges (a maraschino CHERRY filed as a
// liqueur, a peach as a sweetener). Candidates must also look the part.
const GARNISH = /\b(cherry|cherries|olive|peel|twist|wheel|slice|wedge|sprig|leaves|leaf|spiral)\b/;
const SWEETENER = /\b(syrup|sugar|honey|agave|grenadine|orgeat|falernum|cordial|molasses|nectar|maple|liqueur)\b/;
function fitsRole(name, role) {
  if (role !== 'aromatic' && GARNISH.test(name)) return false;
  if (role === 'sweet' && !SWEETENER.test(name)) return false;
  return true;
}

/** Role for one ingredient line. */
export function roleOf(raw, roles = {}) {
  const n = normalizeIngredient(stripAccents(raw));
  return roles[n]?.role || roles[n.split(' ').slice(-1)[0]]?.role || guessSlot(n) || null;
}

/** Parse a cocktail into editable rows: { raw, name, measure, role, key }. */
export function riffRows(cocktail, roles, names) {
  return (cocktail?.ingredients_raw || [])
    .map((r) => (typeof r === 'string' ? r : r?.raw || ''))
    .filter((raw) => raw && !/^garnish:/i.test(raw))
    .map((raw) => {
      const { amount, name } = splitAmount(raw);
      const role = roleOf(raw, roles);
      return {
        raw,
        name,
        // "~" marks a house amount for the role when the source gives none.
        measure: amount || (SLOT_DEFAULT_AMOUNT[role] ? `~${SLOT_DEFAULT_AMOUNT[role]}` : ''),
        role,
        key: resolveIngredientName(raw, names) || normalizeIngredient(stripAccents(name)) || name.toLowerCase(),
        // Water and ice stay put (sugar and soda are fair game in a riff).
        swappable: !/^(splash |dash )?(cold )?(water|ice|crushed ice|cubes ice|ice cubes?)$/.test(normalizeIngredient(stripAccents(name)) || name.toLowerCase()),
      };
    });
}

/**
 * Candidate pool per role, built once from the slot dictionary: clean
 * names (no measures), resolved to the pairing graph so they can be
 * scored, de-duplicated, with how many dictionary spellings map to each
 * (a rough "how common in cocktails" count).
 */
export function buildRolePool(roles, names) {
  const pool = new Map(SWAPPABLE_ROLES.map((r) => [r, new Map()]));
  for (const [raw, info] of Object.entries(roles || {})) {
    if (!pool.has(info?.role) || /\d/.test(raw) || raw.length > 28 || isTrivialIngredient(raw)) continue;
    if (/infused|house|solution|tincture|batter|\bmix\b/.test(raw)) continue; // bar prep, not a bottle you can buy
    const key = resolveIngredientName(raw, names);
    if (!key || !fitsRole(key, info.role)) continue;
    const m = pool.get(info.role);
    m.set(key, (m.get(key) || 0) + 1);
  }
  return pool;
}

/**
 * Ranked swaps for row `index`: same role, not already in the drink,
 * scored by co-occurrence with the rest of the drink.
 * @returns {Array<{ name, score, reason }>}
 */
export function swapCandidates(rows, index, pool, pairingIndex, k = 6) {
  const row = rows[index];
  if (!row?.role || !row.swappable || !pool.has(row.role)) return [];
  const inDrink = new Set(rows.map((r) => r.key));
  const rest = rows.filter((_, i) => i !== index).map((r) => r.key).filter((x) => pairingIndex?.names?.has(x));
  const maxCommon = Math.max(1, ...pool.get(row.role).values());
  const out = [];
  for (const [cand, common] of pool.get(row.role)) {
    if (inDrink.has(cand)) continue;
    let best = 0; let bestWith = null; let sum = 0;
    for (const r of rest) {
      const s = pairingIndex?.strength?.get(`${cand}|${r}`) || 0;
      sum += s;
      if (s > best) { best = s; bestWith = r; }
    }
    const pairing = rest.length ? (0.6 * best + 0.4 * (sum / rest.length)) : 0;
    const score = pairing + 0.15 * Math.log1p(common) / Math.log1p(maxCommon);
    out.push({ name: cand, score, reason: bestWith && best > 0 ? `pairs with ${bestWith}` : 'a common choice in this role' });
  }
  return out.sort((a, b) => b.score - a.score).slice(0, k);
}

/** Replace row `index` with `name`, keeping its measure and role. */
export function applySwap(rows, index, name) {
  return rows.map((r, i) => (i === index ? { ...r, name, key: name, swappedFrom: r.swappedFrom || r.name } : r));
}

/**
 * Existing cocktails closest to the riff by shared ingredients.
 * @returns {Array<{ cocktail, similarity, shared: string[] }>}
 */
// Spirits compared by family, so a whiskey Negroni finds the (bourbon) Boulevardier.
const SPIRIT_FAMILY = [
  [/\b(bourbon|rye|scotch|whiskey|whisky|irish whiskey)\b/, 'whiskey'],
  [/\b(rum|rhum|cachaca)\b/, 'rum'],
  [/\b(brandy|cognac|armagnac|calvados|pisco|apple brandy)\b/, 'brandy'],
  [/\b(tequila|mezcal)\b/, 'agave spirit'],
  [/\b(gin|genever)\b/, 'gin'],
  [/\bvodka\b/, 'vodka'],
];
export function familyKey(key) {
  for (const [rx, fam] of SPIRIT_FAMILY) if (rx.test(key)) return fam;
  return key;
}
const SPIRIT_FAMILIES = new Set(SPIRIT_FAMILY.map(([, f]) => f));

export function nearestCocktails(rows, cocktails, names, { exclude = null, k = 3 } = {}) {
  const riff = new Set(rows.filter((r) => r.swappable !== false).map((r) => familyKey(r.key)).filter(Boolean));
  if (riff.size === 0) return [];
  // The base spirit defines a drink more than any other line: it counts double.
  const weight = (x) => (SPIRIT_FAMILIES.has(x) ? 2 : 1);
  const mass = (set) => [...set].reduce((s, x) => s + weight(x), 0);
  return (cocktails || [])
    .filter((c) => c.name !== exclude)
    .map((c) => {
      const keys = new Set((c.ingredients_raw || [])
        .map((r) => (typeof r === 'string' ? r : r?.raw || ''))
        .filter((raw) => raw && !/^garnish:/i.test(raw) && !isTrivialIngredient(raw))
        .map((raw) => familyKey(resolveIngredientName(raw, names) || normalizeIngredient(stripAccents(splitAmount(raw).name)))));
      const shared = [...riff].filter((x) => keys.has(x));
      const union = mass(new Set([...riff, ...keys]));
      return { cocktail: c, similarity: union ? mass(new Set(shared)) / union : 0, shared };
    })
    .filter((x) => x.shared.length > 0)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, k);
}
