/**
 * validateCuration.js — the rules every curation table must satisfy before it is applied.
 * Pure. Returns a list of problem strings; empty means valid.
 *
 * Table shapes (one entry per line, each with a `reason`):
 *   aliases            { "<variant>": { to, reason } }
 *   hidden             { "<name>": { reason } }
 *   packaged           { "<name>": { reason } }
 *   categoryOverrides  { "<name>": { category, reason } }
 *   tasteOverrides     { "<name>": { taste, reason } }
 *   additions          { "<name>": { category, taste, reason } }
 *   categoryRenames    { "<old category>": { to, reason } }   (every ingredient filed under the old word moves)
 *   vocabulary         { categories: { "<word>": {reason} }, tastes: { "<word>": {reason} } }
 *
 * Options (all optional; the data-dependent checks are skipped when absent):
 *   ingredientNames  Set of names in the raw data (alias targets must exist, or be additions)
 *   categories       Set of category words currently in the data
 *   tastes           Set of taste words currently in the data
 */
import { curationKey } from './normalize.js';

export const TABLE_NAMES = ['aliases', 'hidden', 'packaged', 'categoryOverrides', 'tasteOverrides', 'additions'];

const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
const nonEmpty = (v) => typeof v === 'string' && v.trim() !== '';

export function validateCuration(tables, opts = {}) {
  const problems = [];
  const t = {};
  for (const name of TABLE_NAMES) {
    if (tables?.[name] === undefined) { t[name] = {}; continue; }
    if (!isObj(tables[name])) { problems.push(`${name}: must be an object`); t[name] = {}; continue; }
    t[name] = tables[name];
  }
  const vocab = isObj(tables?.vocabulary) ? tables.vocabulary : {};
  const extraCategories = new Set(Object.keys(isObj(vocab.categories) ? vocab.categories : {}));
  const extraTastes = new Set(Object.keys(isObj(vocab.tastes) ? vocab.tastes : {}));
  for (const [kind, group] of [['categories', vocab.categories], ['tastes', vocab.tastes]]) {
    for (const [w, e] of Object.entries(isObj(group) ? group : {})) {
      if (!isObj(e) || !nonEmpty(e.reason)) problems.push(`vocabulary.${kind} "${w}": missing reason`);
    }
  }

  for (const name of TABLE_NAMES) {
    for (const [key, entry] of Object.entries(t[name])) {
      const at = `${name} "${key}"`;
      if (key !== curationKey(key) || !key) problems.push(`${at}: key must be lowercase, accent-free, single-spaced and non-empty`);
      if (!isObj(entry)) { problems.push(`${at}: entry must be an object`); continue; }
      if (!nonEmpty(entry.reason)) problems.push(`${at}: missing reason`);
    }
  }

  const aliasKeys = new Set(Object.keys(t.aliases));
  const hiddenKeys = new Set(Object.keys(t.hidden));
  const additionKeys = new Set(Object.keys(t.additions));
  const names = opts.ingredientNames;

  for (const [variant, entry] of Object.entries(t.aliases)) {
    if (!isObj(entry)) continue;
    const at = `aliases "${variant}"`;
    if (!nonEmpty(entry.to)) { problems.push(`${at}: missing "to"`); continue; }
    if (entry.to === variant) problems.push(`${at}: aliases itself`);
    if (aliasKeys.has(entry.to)) problems.push(`${at}: target "${entry.to}" is itself an alias (no chains: point at the final canonical name)`);
    if (hiddenKeys.has(entry.to)) problems.push(`${at}: target "${entry.to}" is hidden`);
    if (names && !names.has(entry.to) && !additionKeys.has(entry.to)) {
      problems.push(`${at}: target "${entry.to}" is not in the data and not in additions`);
    }
  }

  // A name may live in one table only (a category override on the canonical name is a different name).
  const owners = new Map();
  for (const name of TABLE_NAMES) {
    for (const key of Object.keys(t[name])) {
      if (!owners.has(key)) owners.set(key, []);
      owners.get(key).push(name);
    }
  }
  for (const [key, tablesFor] of owners) {
    if (tablesFor.length > 1) problems.push(`"${key}" appears in contradictory tables: ${tablesFor.join(', ')}`);
  }

  const renames = isObj(tables?.categoryRenames) ? tables.categoryRenames : {};
  if (tables?.categoryRenames !== undefined && !isObj(tables.categoryRenames)) problems.push('categoryRenames: must be an object');

  const categories = opts.categories ? new Set([...opts.categories, ...extraCategories]) : null;
  const tastes = opts.tastes ? new Set([...opts.tastes, ...extraTastes]) : null;
  const checkCategory = (at, c) => {
    if (!nonEmpty(c)) problems.push(`${at}: missing category`);
    else if (categories && !categories.has(c)) problems.push(`${at}: unknown category "${c}" (add it to vocabulary.categories with a reason if it is new)`);
  };
  const checkTaste = (at, s) => {
    if (!nonEmpty(s)) { problems.push(`${at}: missing taste`); return; }
    if (tastes) for (const w of s.trim().split(/\s+/)) if (!tastes.has(w)) problems.push(`${at}: unknown taste word "${w}" (add it to vocabulary.tastes with a reason if it is new)`);
  };
  for (const [from, e] of Object.entries(renames)) {
    const at = `categoryRenames "${from}"`;
    if (!isObj(e)) { problems.push(`${at}: entry must be an object`); continue; }
    if (!nonEmpty(e.reason)) problems.push(`${at}: missing reason`);
    checkCategory(at, e.to);
    if (e.to === from) problems.push(`${at}: renames itself`);
    if (Object.hasOwn(renames, e.to)) problems.push(`${at}: target "${e.to}" is itself renamed (no chains: point at the final category)`);
  }
  for (const [k, e] of Object.entries(t.categoryOverrides)) if (isObj(e)) checkCategory(`categoryOverrides "${k}"`, e.category);
  for (const [k, e] of Object.entries(t.tasteOverrides)) if (isObj(e)) checkTaste(`tasteOverrides "${k}"`, e.taste);
  for (const [k, e] of Object.entries(t.additions)) {
    if (!isObj(e)) continue;
    checkCategory(`additions "${k}"`, e.category);
    checkTaste(`additions "${k}"`, e.taste);
    if (names && names.has(k)) problems.push(`additions "${k}": already in the data (use an override instead)`);
  }
  return problems;
}

/** Category and taste words present in an ingredients object (the vocabularies the validator checks against). */
export function vocabulariesOf(ingredients) {
  const categories = new Set();
  const tastes = new Set();
  for (const [name, info] of Object.entries(ingredients || {})) {
    if (name.startsWith('_') || !info) continue;
    if (info.category) categories.add(info.category);
    if (info.taste) for (const w of String(info.taste).split(/\s+/)) if (w) tastes.add(w);
  }
  return { categories, tastes };
}
