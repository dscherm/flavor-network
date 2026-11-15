/**
 * sharedSave.js — turning a shared (normalised) recipe into something the cook can
 * keep. Pure: no React, no storage. The profile writer (useUserProfile.saveInvention)
 * does the writing; this builds its input and tells whether the copy is already there.
 *
 *   sharedFromFor(recipe)        '<kind>/<slug>'   what a saved copy remembers it came from
 *   sharedSaveInput(recipe)      the input for saveInvention: { kind, id, name, category, lines, method, glass?, cuisine?, sharedFrom }
 *   savedKindFor(kind)           'cocktail' | 'sauce' | 'recipe'   the profile kind (a shared 'dish' is a Cookbook recipe)
 *   saveLabel(kind) / savedNoun(kind)   "Save to my cocktails" / "cocktails"
 *   profileListFor(profile, kind)       the profile array a copy lands in
 *   alreadySaved(list, sharedFrom)      true when an entry of the list carries that sharedFrom
 *
 * The saved id is derived from sharedFrom, so saving twice rewrites the same entry
 * and can never duplicate it, even when the list check is skipped.
 */
const KIND = Object.freeze({ cocktail: 'cocktail', sauce: 'sauce', dish: 'recipe' });
const LIST = Object.freeze({ cocktail: 'cocktails', sauce: 'sauces', dish: 'recipes' });
const LABEL = Object.freeze({ cocktail: 'Save to my cocktails', sauce: 'Save to my sauces', dish: 'Save to my cookbook' });
const NOUN = Object.freeze({ cocktail: 'cocktails', sauce: 'sauces', dish: 'cookbook' });

export const savedKindFor = (kind) => KIND[kind] || null;
export const saveLabel = (kind) => LABEL[kind] || 'Save';
export const savedNoun = (kind) => NOUN[kind] || 'list';
export const sharedFromFor = (recipe) => (recipe?.kind && recipe?.slug ? `${recipe.kind}/${recipe.slug}` : '');

export function profileListFor(profile, kind) {
  const field = LIST[kind];
  const list = field ? profile?.[field] : null;
  return Array.isArray(list) ? list : [];
}

export function alreadySaved(list, sharedFrom) {
  if (!sharedFrom || !Array.isArray(list)) return false;
  return list.some((it) => it && it.sharedFrom === sharedFrom);
}

export function sharedSaveInput(recipe) {
  const kind = savedKindFor(recipe?.kind);
  const sharedFrom = sharedFromFor(recipe);
  if (!kind || !sharedFrom) return null;
  return {
    kind,
    id: `shared-${recipe.kind}-${recipe.slug}`,
    name: recipe.name,
    category: recipe.categoryId ?? null,
    lines: (recipe.lines || []).map((l) => ({ key: l.key, amount: l.amount || '', role: null })),
    method: recipe.method || '',
    ...(recipe.glass ? { glass: recipe.glass } : {}),
    ...(kind === 'recipe' && recipe.category ? { cuisine: recipe.category } : {}),
    sharedFrom,
  };
}
