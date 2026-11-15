/**
 * aromaAgreement.js — AROMA-2. Compares the hand-tuned aroma table (flavorAromas.js) with the app's SECOND, independently
 * produced set of aroma labels (public/proDataset/flavor_profiles_distilled.json: 304 chef-sourced entries, the rest an
 * AI labelling pass). The second source is a second opinion, never ground truth. Pure: no file access.
 *
 * A line AGREES when its strongest aroma (any axis tied for strongest) is among the second source's aromas, once those
 * words are mapped to the axis set in use (aromaWordMap.js). A word with no home on the axis set is reported
 * (`homeless`), not scored: the difference may exist only because the right axis does not exist yet.
 */
import { AROMA_WORD_MAP, AROMAS_SIX, AROMAS_ELEVEN } from './aromaWordMap.js';
import { curationKey } from './curation/normalize.js';

export const AXIS_SETS = { six: AROMAS_SIX, eleven: AROMAS_ELEVEN };

/** Table axis keys are written fruity..spicy; the aroma sets say spice. */
const TABLE_TO_SET = { fruity: 'fruity', floral: 'floral', green: 'green', woody: 'woody', spicy: 'spice', fatty: 'fatty' };

/** The second source's entry for a table name: the name itself, its merged-into name, or a variant merged into it. */
export function resolveSecond(name, ingredients, aliases = new Map()) {
  const k = curationKey(name);
  const tries = [k];
  const to = aliases.get(k);
  if (to) tries.push(to);
  for (const [variant, target] of aliases) if (target === k) tries.push(variant);
  const byKey = new Map(Object.keys(ingredients).map((n) => [curationKey(n), n]));
  for (const t of tries) {
    const hit = byKey.get(t);
    if (hit) return { key: hit, entry: ingredients[hit] };
  }
  return null;
}

/** A table line's aromas, strongest first (ties kept together): [{ axis, v }] with v > 0. */
export function tableRanking(line) {
  return Object.entries(TABLE_TO_SET)
    .map(([k, axis]) => ({ axis, v: line[k] || 0 }))
    .filter((x) => x.v > 0)
    .sort((a, b) => b.v - a.v);
}

/** The second source's words -> { mapped: distinct axis names on `axes`, homeless: words with no home there }. */
export function secondAromas(words = [], axes = AROMAS_SIX) {
  const mapped = [];
  const homeless = [];
  const col = axes === AROMAS_ELEVEN ? 0 : 1;
  for (const w of words) {
    if (!AROMA_WORD_MAP[w]) continue;
    const home = AROMA_WORD_MAP[w][col];
    if (home && axes.includes(home)) { if (!mapped.includes(home)) mapped.push(home); } else homeless.push(w);
  }
  return { mapped, homeless };
}

/**
 * compareAromaTable(table, distilled, { aliases, axes }) -> { rows, summary }
 *  table      { name: line }  (flavorAromas.AROMAS)
 *  distilled  parsed flavor_profiles_distilled.json
 *  aliases    Map(curationKey(variant) -> curationKey(canonical))
 * rows: one per table line with aroma of its own: { name, second, chef, tableTop, tableTopTwo, secondWords, secondMapped,
 *   homeless, status: 'agree' | 'disagree' | 'no-counterpart' | 'no-expressible', top2Overlap }
 */
export function compareAromaTable(table, distilled, { aliases = new Map(), axes = AROMAS_SIX } = {}) {
  const ingredients = distilled?.ingredients || {};
  const rows = [];
  let aromaless = 0;
  for (const [name, line] of Object.entries(table)) {
    const rank = tableRanking(line);
    if (!rank.length || !(line.potency > 0)) { aromaless += 1; continue; }
    const topV = rank[0].v;
    const tableTop = rank.filter((x) => x.v === topV).map((x) => x.axis);
    const tableTopTwo = rank.slice(0, 2).map((x) => x.axis);
    const hit = resolveSecond(name, ingredients, aliases);
    if (!hit) { rows.push({ name, status: 'no-counterpart', tableTop, tableTopTwo, line }); continue; }
    const words = hit.entry.aromas || [];
    const { mapped, homeless } = secondAromas(words, axes);
    const base = { name, second: hit.key, chef: hit.entry.source === 'chef', tableTop, tableTopTwo, secondWords: words, secondMapped: mapped, homeless, line };
    if (!mapped.length) { rows.push({ ...base, status: 'no-expressible', top2Overlap: false }); continue; }
    rows.push({
      ...base,
      status: tableTop.some((a) => mapped.includes(a)) ? 'agree' : 'disagree',
      top2Overlap: tableTopTwo.some((a) => mapped.includes(a)),
    });
  }
  return { rows, summary: summarizeAgreement(rows, aromaless) };
}

export function summarizeAgreement(rows, aromaless = 0) {
  const pct = (a, b) => (b ? Math.round((1000 * a) / b) / 10 : null);
  const cmp = rows.filter((r) => r.status === 'agree' || r.status === 'disagree');
  const chef = cmp.filter((r) => r.chef);
  const agree = cmp.filter((r) => r.status === 'agree').length;
  const agreeChef = chef.filter((r) => r.status === 'agree').length;
  const top2 = cmp.filter((r) => r.top2Overlap).length;
  return {
    lines: rows.length + aromaless, aromaless, withAroma: rows.length,
    noCounterpart: rows.filter((r) => r.status === 'no-counterpart').length,
    noExpressible: rows.filter((r) => r.status === 'no-expressible').length,
    compared: cmp.length, agree, agreePct: pct(agree, cmp.length),
    comparedChef: chef.length, agreeChef, agreeChefPct: pct(agreeChef, chef.length),
    top2, top2Pct: pct(top2, cmp.length),
    disagree: cmp.length - agree,
    withHomelessWords: cmp.filter((r) => r.homeless.length).length,
  };
}

/** The disagreement rows only. */
export const disagreements = (rows) => rows.filter((r) => r.status === 'disagree');

/** Disagreements nobody has decided: `accepted` is { name: { reason, kind } }. A corrected line stops disagreeing, so it never appears. */
export function unreviewedDisagreements(rows, accepted = {}) {
  return disagreements(rows).filter((r) => !accepted[r.name]);
}

export const ACCEPT_KINDS = ['table-right', 'both-defensible', 'missing-axis'];

/** Problems with the accepted file: unknown kind, thin reason, missing-axis without an aroma, or a name that no longer disagrees. */
export function validateAccepted(accepted, rows) {
  const problems = [];
  const live = new Set(disagreements(rows).map((r) => r.name));
  for (const [name, e] of Object.entries(accepted || {})) {
    if (!e || typeof e.reason !== 'string' || e.reason.trim().length < 12) problems.push(`${name}: reason must be a real sentence`);
    if (!e || !ACCEPT_KINDS.includes(e.kind)) problems.push(`${name}: kind must be one of ${ACCEPT_KINDS.join(', ')}`);
    if (e?.kind === 'missing-axis' && !(typeof e.aroma === 'string' && e.aroma.trim())) problems.push(`${name}: missing-axis needs "aroma"`);
    if (!live.has(name)) problems.push(`${name}: no longer disagrees (remove it from the accepted file)`);
  }
  return problems;
}

const clean = (s) => String(s ?? '').replace(/[\t\r\n]+/g, ' ').trim();
const fmtLine = (l) => Object.keys(TABLE_TO_SET).filter((k) => l[k]).map((k) => `${k} ${l[k]}`).concat(`potency ${l.potency}`).join(', ');

/** The unreviewed disagreements as a TSV (header + one row each, both sides shown). */
export function disagreementTsv(unreviewed) {
  const head = ['name', 'table_top', 'table_line', 'second_source_key', 'second_source_aromas', 'second_mapped', 'homeless_words', 'chef_sourced'].join('\t');
  const body = unreviewed.map((r) => [r.name, r.tableTop.join('/'), fmtLine(r.line), r.second, r.secondWords.join(', '), r.secondMapped.join('/'), r.homeless.join(', '), r.chef ? 'chef' : 'ai'].map(clean).join('\t'));
  return [head, ...body].join('\n') + '\n';
}
