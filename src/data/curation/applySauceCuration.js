/**
 * applySauceCuration.js — the correction layer over the hand-curated sauce list (DATA-7).
 *
 * public/data/sauce_augment.json tags 27 of its 77 sauces motherSauce 'Independent', a catch-all. The file is not edited;
 * src/data/curation/sauceGroups.json says, per sauce, which group it belongs to and why, and this applies it on every load.
 * Pure and idempotent: applying the result again changes nothing.
 *
 *   applySauceCuration(augment, table) -> copy of augment with motherSauce replaced for each sauce the table names
 *   sauceGroupFamilies(table, firstId) -> the table's groups as Sauce Lab families ({ id, name, color, blurb })
 *   validateSauceCuration(augment, table) -> list of problems (empty when the table is sound)
 *
 * A payload without a sauces list (a test stub) comes back unchanged.
 */
import SAUCE_GROUPS from './sauceGroups.json' with { type: 'json' };

export const CATCH_ALL = 'Independent';
export const MIN_GROUP_SIZE = 3;

export function applySauceCuration(augment, table = SAUCE_GROUPS) {
  if (!augment || !Array.isArray(augment.sauces) || !table?.assign) return augment;
  return {
    ...augment,
    sauces: augment.sauces.map((s) => {
      const hit = table.assign[s.name];
      return hit ? { ...s, motherSauce: hit.group } : s;
    }),
  };
}

/** The bundled table applied to a loaded sauce_augment.json. Every loader and script goes through here. */
export const curateSauceAugment = (augment) => applySauceCuration(augment, SAUCE_GROUPS);

/** The groups as Sauce Lab families, numbered from `firstId` in table order (the catch-all last). */
export function sauceGroupFamilies(table = SAUCE_GROUPS, firstId = 10) {
  return (table.groups || []).map((g, i) => ({ id: firstId + i, name: g.name, color: g.color, blurb: g.blurb }));
}

/** Names of the mother families the lab already has; a table entry may point a sauce at one of them. */
const BASE_FAMILIES = ['Béchamel', 'Velouté', 'Espagnole', 'Hollandaise', 'Tomato', 'Curry', 'Stir-fry', 'Mole', 'Salsa', 'Nut Sauce'];

export function validateSauceCuration(augment, table = SAUCE_GROUPS) {
  const problems = [];
  const sauces = augment?.sauces || [];
  const names = new Set(sauces.map((s) => s.name));
  const groupNames = new Set((table.groups || []).map((g) => g.name));
  const known = new Set([...BASE_FAMILIES, ...groupNames]);
  for (const [name, a] of Object.entries(table.assign || {})) {
    if (!names.has(name)) problems.push(`${name}: no such sauce`);
    if (!known.has(a.group)) problems.push(`${name}: unknown group '${a.group}'`);
    if (!String(a.reason || '').trim()) problems.push(`${name}: no reason`);
  }
  for (const s of sauces) {
    if (s.motherSauce === CATCH_ALL && !table.assign?.[s.name]) problems.push(`${s.name}: 'Independent' with no entry in the table`);
  }
  const curated = applySauceCuration(augment, table).sauces;
  for (const g of table.groups || []) {
    if (g.name === CATCH_ALL) continue;
    const n = curated.filter((s) => s.motherSauce === g.name).length;
    if (n < MIN_GROUP_SIZE) problems.push(`group '${g.name}' has ${n} sauces, needs at least ${MIN_GROUP_SIZE}`);
  }
  for (const g of table.groups || []) if (!g.color || !g.blurb) problems.push(`group '${g.name}': colour and blurb are required`);
  return problems;
}
