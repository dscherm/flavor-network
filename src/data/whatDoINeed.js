/**
 * whatDoINeed.js — "What do I need?" for any recipe card: which of its
 * ingredients the cook already has (the shared kitchen list, myKitchen.js)
 * and which to buy, with amounts, plus a plain-text shopping list.
 *
 * Cocktails use My bar instead (myBar.js coverCocktail) and are converted
 * to the same shape by `needsFromBarCoverage`.
 */
import { haveIngredient, isBasic } from './myKitchen.js';

const FINISHING_MEASURE = /\b(pinch|dash|to taste|garnish|optional|for serving)\b/i;

/**
 * @param {Array<string|{name:string, measure?:string}>} ingredients
 * @param {string[]|Set<string>} kitchen
 * @param {{ assumeBasics?: boolean, names?: Set<string>|null, amounts?: Record<string,string> }} opts
 * @returns {{
 *   have: { name: string, amount: string, via?: string }[],
 *   missing: { name: string, amount: string }[],
 *   optional: { name: string, amount: string }[],   // missing, but only a pinch / garnish
 *   basics: string[],                                // assumed on hand
 *   total: number,                                   // have + missing (not basics or optional)
 * }}
 */
export function needsFromKitchen(ingredients, kitchen, { assumeBasics = true, names = null, amounts = {} } = {}) {
  const kitchenSet = kitchen instanceof Set ? kitchen : new Set(kitchen || []);
  const out = { have: [], missing: [], optional: [], basics: [], total: 0 };
  const seen = new Set();
  for (const raw of ingredients || []) {
    const name = typeof raw === 'string' ? raw : raw?.name;
    if (!name || seen.has(name)) continue;
    seen.add(name);
    const amount = (typeof raw === 'object' && raw?.measure) || amounts?.[name] || '';
    const c = haveIngredient(name, kitchenSet, { assumeBasics, names });
    if (c.covered && c.basic) { out.basics.push(name); continue; }
    if (c.covered) { out.have.push({ name, amount, ...(c.via && c.via !== name ? { via: c.via } : {}) }); continue; }
    if (FINISHING_MEASURE.test(amount)) { out.optional.push({ name, amount }); continue; }
    out.missing.push({ name, amount });
  }
  out.total = out.have.length + out.missing.length;
  return out;
}

/**
 * Convert myBar.coverCocktail output to the same shape. Substitutions
 * ("rye for bourbon") count as have; the one-missing stand-in suggestion
 * becomes a hint on that missing line. `lines` = myBar.countedLines(cocktail).
 */
export function needsFromBarCoverage(cov, lines = null) {
  const out = { have: [], missing: [], optional: [], basics: [], total: 0 };
  if (!cov) return out;
  const subs = new Map((cov.substitutions || []).map((s) => [s.from, s.to]));
  const missingKeys = new Set((cov.missing || []).map((m) => m.key));
  for (const line of lines || cov.lines || []) {
    if (missingKeys.has(line.key)) continue;
    out.have.push({ name: line.name || line.key, amount: line.measure || '', ...(subs.has(line.key) ? { via: subs.get(line.key) } : {}) });
  }
  for (const m of cov.missing || []) {
    const hint = cov.suggestion && cov.suggestion.for === m.key ? `or use your ${cov.suggestion.use}` : '';
    out.missing.push({ name: m.name || m.key, amount: m.measure || '', ...(hint ? { hint } : {}) });
  }
  out.total = out.have.length + out.missing.length;
  return out;
}

/** "Shopping list for Beef Bolognese:\n- 500 g beef\n- …" */
export function shoppingListText(title, missing, optional = []) {
  const line = (x) => `- ${x.amount ? `${x.amount} ` : ''}${x.name}`;
  const parts = [`Shopping list${title ? ` for ${title}` : ''}:`, ...missing.map(line)];
  if (optional.length) parts.push('', 'Nice to have:', ...optional.map(line));
  return parts.join('\n');
}

export { isBasic };
