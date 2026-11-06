/**
 * cocktailAmounts.js — split a cocktail ingredient line into amount + name,
 * and suggest an amount when the source recipe gives none.
 *
 * About half the codex (217 of 441 cocktails) lists ingredients without
 * quantities. Rather than invent numbers into the data file, the card
 * shows a per-slot house default and labels it as suggested:
 *   spirit 2 oz · sour ¾ oz · sweet ¾ oz · vermouth 1 oz · amaro/liqueur
 *   ¾ oz · modifier (juice, soda, cream) 2 oz · bitter 2 dashes ·
 *   aromatic 1 dash
 * These are the proportions of the sour and old-fashioned skeletons, not
 * the recipe's own numbers — the UI must say so.
 */

const AMOUNT_RE = /^\s*((?:[0-9]+\s+)?[0-9]+\/[0-9]+|[0-9]+(?:[.,][0-9]+)?|[¼½¾⅓⅔⅛⅜⅝⅞]|[0-9]+\s*[¼½¾⅓⅔⅛⅜⅝⅞])\s*(ounces?|oz|cl|ml|dashes?|dash|drops?|drop|teaspoons?|tsp|tablespoons?|tbsp|parts?|part|cups?|cup|cubes?|cube|splash(?:es)?|barspoons?|bar spoons?|shots?|l)?\.?\s+(.+)$/i;
const WORD_AMOUNT_RE = /^\s*(a |one |two |three |half a |dash of |splash of |pinch of |twist of |top with |fill with )(.+)$/i;

/** "1 1/2 oz Gin" → { amount: '1 1/2 oz', name: 'Gin' }; "Gin" → { amount: '', name: 'Gin' }. */
export function splitAmount(raw) {
  const s = String(raw ?? '').trim();
  const m = AMOUNT_RE.exec(s);
  if (m) {
    const unit = m[2] ? ` ${m[2]}` : '';
    return { amount: `${m[1].trim()}${unit}`.trim(), name: m[3].trim() };
  }
  const w = WORD_AMOUNT_RE.exec(s);
  if (w) return { amount: w[1].trim().replace(/ of$| with$/, ''), name: w[2].trim() };
  return { amount: '', name: s };
}

export const SLOT_DEFAULT_AMOUNT = Object.freeze({
  spirit: '2 oz',
  sour: '¾ oz',
  sweet: '¾ oz',
  vermouth: '1 oz',
  amaro_liqueur: '¾ oz',
  modifier: '2 oz',
  bitter: '2 dashes',
  aromatic: '1 dash',
});

/**
 * @param {Array<{raw?: string}|string>} ingredientsRaw
 * @param {(name: string) => string|null} slotOf — slot for a normalised ingredient name
 * @param {(raw: string) => string} normalize — raw line → normalised name used by slotOf
 * @returns {{ items: Array<{ name, measure, suggested }>, anySuggested: boolean }}
 */
export function suggestAmounts(ingredientsRaw, slotOf, normalize = (x) => String(x).toLowerCase()) {
  const rows = (ingredientsRaw || []).map((r) => {
    const raw = typeof r === 'string' ? r : (r?.raw || r?.name || '');
    const { amount, name } = splitAmount(raw);
    if (amount) return { name, measure: amount, suggested: false, slot: null };
    const key = String(normalize(name)).normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const slot = slotOf?.(key) || slotOf?.(key.split(' ').slice(-1)[0]) || null;
    return { name, measure: '', suggested: false, slot };
  }).filter((i) => i.name);
  // A split base (two or more spirits with no given amount) is 1 oz each,
  // not 2 oz each.
  const suggestedSpirits = rows.filter((i) => i.slot === 'spirit').length;
  let anySuggested = false;
  const items = rows.map(({ slot, ...i }) => {
    if (i.measure || !slot) return i;
    const def = slot === 'spirit' && suggestedSpirits >= 2 ? '1 oz' : SLOT_DEFAULT_AMOUNT[slot];
    if (!def) return i;
    anySuggested = true;
    return { ...i, measure: `~${def}`, suggested: true };
  });
  return { items, anySuggested };
}
