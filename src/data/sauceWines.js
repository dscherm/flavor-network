/**
 * sauceWines.js — wines for a sauce, by the protein it is served with.
 *
 * A sauce on its own is not a dish: Béarnaise on steak wants a red,
 * Béarnaise on salmon a white. So each protein in the sauce's hand-written
 * `proteins` list (public/data/sauce_augment.json) is scored with the
 * sauce's ingredients through the Wine Lab engine (rankWinesForRecipe),
 * and the top wine per protein is kept. Proteins that land on the same
 * wine are grouped: "Rioja — with beef, lamb".
 */
import { rankWinesForRecipe } from './winePairing.js';

// Protein label (as shown) → ingredient name the pairing data knows.
const PROTEIN_INGREDIENT = {
  eggs: 'egg',
  clams: 'clam',
  mussels: 'mussel',
  scallops: 'scallop',
  game: 'bison',
};

/** The ingredient name a protein label is scored as. */
export function proteinIngredient(protein) {
  const p = String(protein || '').toLowerCase().trim();
  return PROTEIN_INGREDIENT[p] || p;
}

/**
 * @param {{ ingredients: string[], proteins?: string[], cuisine?: string }} sauce
 * @param {object[]} wines  wine styles (public/data/wine_styles.json → wines)
 * @param {object} ctx      passed to the engine (categoryOf, …)
 * @returns {{ wine: object, proteins: string[], reason: string }[]}  best wine per protein, grouped, in protein order
 */
export function winesForSauce(sauce, wines, ctx = {}, { maxProteins = 4 } = {}) {
  const proteins = (sauce?.proteins || []).slice(0, maxProteins);
  if (!proteins.length || !wines?.length) return [];
  const base = (sauce.ingredients || []).map((i) => (typeof i === 'string' ? i : i?.name)).filter(Boolean);
  const groups = new Map();
  for (const protein of proteins) {
    const ranked = rankWinesForRecipe([...base, proteinIngredient(protein)], wines, {
      ...ctx,
      cuisine: sauce.cuisine || ctx.cuisine || null,
    }, 1);
    const wine = ranked[0]?.item;
    if (!wine?.id) continue;
    if (!groups.has(wine.id)) groups.set(wine.id, { wine, proteins: [], reason: ranked[0].reasons?.[0] || '' });
    groups.get(wine.id).proteins.push(protein);
  }
  return [...groups.values()];
}
