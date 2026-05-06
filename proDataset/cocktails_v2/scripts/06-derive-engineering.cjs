#!/usr/bin/env node
/**
 * Cocktail Codex v2 — Phase 2: derive engineering metadata.
 *
 * Auto-extracts build_method, glass_type, ice_format, and aeration for
 * each cocktail in corpus_v2 by parsing recipe_text + the existing
 * glass field. The IBA Wikipedia agent pre-populated build_method for
 * 32 cocktails — those land at high confidence; everything else is
 * inferred from text patterns.
 *
 * Output is a CSV the user can hand-edit to fix any low-confidence
 * tags. Per spec §4.3 schema:
 *   build_method:  shake | stir | build | blend | swizzle | muddle
 *   glass_type:    coupe | rocks | martini | highball | collins | wine | mug
 *   ice_format:    up | rocks | crushed | block | tall | none
 *   aeration:      high | medium | low
 *
 * Inputs:
 *   proDataset/cocktails_v2/raw/corpus_v2.json
 *
 * Outputs:
 *   proDataset/cocktails_v2/data/cocktail_engineering.csv
 *   proDataset/cocktails_v2/data/cocktail_engineering_report.txt
 */

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../../..');
const IN_PATH = path.join(ROOT, 'proDataset/cocktails_v2/raw/corpus_v2.json');
const OUT_DIR = path.join(ROOT, 'proDataset/cocktails_v2/data');
const CSV_PATH = path.join(OUT_DIR, 'cocktail_engineering.csv');
const REPORT_PATH = path.join(OUT_DIR, 'cocktail_engineering_report.txt');

// Codex family ID → typical build method. The Codex archetypes
// correspond tightly to canonical build methods even though the
// archetypes themselves are being deprecated for clustering. We use
// these as a metadata fallback only when recipe text gives no signal.
const CODEX_FAMILY_BUILD = {
  0: 'stir',  // Old-Fashioned
  1: 'stir',  // Martini
  2: 'shake', // Daiquiri (sour)
  3: 'shake', // Sidecar (sour)
  4: 'build', // Whisky Highball
  5: 'shake', // Flip
};

// Load the slot dictionary so we can do slot-based inference for
// non-Codex cocktails missing recipe instructions.
const SLOT_CSV_PATH = path.join(ROOT, 'proDataset/cocktails_v2/data/cocktail_ingredient_slots.csv');
const ingredientSlots = new Map();
if (fs.existsSync(SLOT_CSV_PATH)) {
  const lines = fs.readFileSync(SLOT_CSV_PATH, 'utf-8').split('\n').slice(1);
  for (const line of lines) {
    const m = line.match(/^"([^"]+)",([^,]*),/);
    if (m) ingredientSlots.set(m[1], m[2]);
  }
}

function getCocktailSlots(c) {
  const slots = new Set();
  for (const ing of c.ingredients_raw || []) {
    const name = (ing.name || ing.raw || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[‘’'`]/g, '')
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    const slot = ingredientSlots.get(name);
    if (slot) slots.add(slot);
  }
  return slots;
}

// Slot-based heuristic: citrus+sweet → shake; spirit+bitter only → stir;
// modifier-soda → build; cream/egg → shake.
function inferBuildFromSlots(c) {
  const slots = getCocktailSlots(c);
  const hasFoam = (c.ingredients_raw || []).some((i) =>
    /egg\s+white|albumen|aquafaba|cream/i.test(i.name || i.raw || '')
  );
  if (hasFoam) return { value: 'shake', confidence: 'medium', source: 'slot:foam' };
  if (slots.has('sour') && slots.has('sweet'))
    return { value: 'shake', confidence: 'medium', source: 'slot:sour+sweet' };
  if (slots.has('sour')) return { value: 'shake', confidence: 'medium', source: 'slot:sour' };
  // Modifier slot dominated by soda → build
  const modIngs = (c.ingredients_raw || []).filter((i) => {
    const n = (i.name || i.raw || '').toLowerCase();
    return /\b(soda|tonic|ginger\s*beer|ginger\s*ale|cola|sparkling|champagne|prosecco)\b/.test(n);
  });
  if (modIngs.length > 0) return { value: 'build', confidence: 'medium', source: 'slot:carbonated' };
  if (slots.has('vermouth') || slots.has('bitter') || slots.has('amaro_liqueur'))
    return { value: 'stir', confidence: 'medium', source: 'slot:bitter-skeleton' };
  return { value: null, confidence: 'unknown', source: 'slot:no-signal' };
}

// ── Build method detection ─────────────────────────────────────────
function detectBuildMethod(c) {
  // 1. Pre-populated by IBA Wikipedia agent
  if (c.build_method) return { value: c.build_method, confidence: 'high', source: 'agent' };
  const text = (c.recipe_text || '').toLowerCase();
  // 2. Recipe text keywords (only when text exists and has signal)
  if (text) {
    if (/swizzle/.test(text)) return { value: 'swizzle', confidence: 'high', source: 'recipe-text' };
    if (/blend/.test(text)) return { value: 'blend', confidence: 'high', source: 'recipe-text' };
    if (/throw/.test(text)) return { value: 'throw', confidence: 'high', source: 'recipe-text' };
    if (/shake|shaken/.test(text)) return { value: 'shake', confidence: 'high', source: 'recipe-text' };
    if (/stir|stirred/.test(text)) return { value: 'stir', confidence: 'high', source: 'recipe-text' };
    if (/muddle/.test(text)) return { value: 'muddle', confidence: 'medium', source: 'recipe-text' };
    if (/pour\s+(all\s+)?ingredients/.test(text)) return { value: 'build', confidence: 'medium', source: 'recipe-text' };
    if (/build/.test(text)) return { value: 'build', confidence: 'high', source: 'recipe-text' };
  }
  // 3. Codex family heuristic (covers the ~149 Codex cocktails whose
  //    parsed recipe_text contains only the ingredient list, no method)
  if (c.cocktail_codex_family_id != null && CODEX_FAMILY_BUILD[c.cocktail_codex_family_id]) {
    return {
      value: CODEX_FAMILY_BUILD[c.cocktail_codex_family_id],
      confidence: 'medium',
      source: `codex-family-${c.cocktail_codex_family_id}`,
    };
  }
  // 4. Slot-based inference for cocktails with neither method text nor
  //    Codex family.
  return inferBuildFromSlots(c);
}

// ── Glass type detection ───────────────────────────────────────────
const GLASS_BUCKETS = {
  coupe: /coup(e|é)|cocktail glass|martini glass|nick.*nora/i,
  rocks: /rocks|old[\s-]?fashioned|double old[\s-]?fashioned|tumbler/i,
  highball: /highball|collins/i,
  wine: /wine|champagne|flute/i,
  mug: /mug|copper|moscow mule/i,
  hurricane: /hurricane|tiki|tropical/i,
  punch: /punch|julep/i,
};

function detectGlassType(c) {
  const glass = (c.glass || '').toLowerCase();
  const text = (c.recipe_text || '').toLowerCase();
  for (const [bucket, re] of Object.entries(GLASS_BUCKETS)) {
    if (re.test(glass)) return { value: bucket, confidence: 'high', source: 'glass-field' };
  }
  for (const [bucket, re] of Object.entries(GLASS_BUCKETS)) {
    if (re.test(text)) return { value: bucket, confidence: 'medium', source: 'recipe-text' };
  }
  return { value: null, confidence: 'unknown', source: 'no-match' };
}

// ── Ice format detection ───────────────────────────────────────────
function detectIceFormat(c, glass) {
  const text = (c.recipe_text || '').toLowerCase();
  if (/served\s+straight\s+up|without\s+ice|chilled\s+(cocktail\s+)?glass|coup(e|é)/.test(text))
    return { value: 'up', confidence: 'high', source: 'recipe-text' };
  if (/crushed\s+ice|pebble\s+ice|julep/.test(text))
    return { value: 'crushed', confidence: 'high', source: 'recipe-text' };
  if (/block\s+of\s+ice|big\s+(cube|rock)|king\s+cube/.test(text))
    return { value: 'block', confidence: 'high', source: 'recipe-text' };
  if (/over\s+ice|on\s+the\s+rocks|filled\s+with\s+ice|fill\s+(.*)\s+with\s+ice/.test(text))
    return { value: 'rocks', confidence: 'high', source: 'recipe-text' };
  // Fall back to glass-bucket heuristics
  if (glass === 'coupe') return { value: 'up', confidence: 'medium', source: 'glass-coupe' };
  if (glass === 'rocks') return { value: 'rocks', confidence: 'medium', source: 'glass-rocks' };
  if (glass === 'highball') return { value: 'tall', confidence: 'medium', source: 'glass-highball' };
  if (glass === 'mug') return { value: 'rocks', confidence: 'medium', source: 'glass-mug' };
  if (glass === 'hurricane') return { value: 'crushed', confidence: 'medium', source: 'glass-tiki' };
  return { value: null, confidence: 'unknown', source: 'no-signal' };
}

// ── Aeration detection ─────────────────────────────────────────────
function detectAeration(c, buildMethod) {
  const text = (c.recipe_text || '').toLowerCase();
  // Egg white / cream + shake = high (foam)
  const hasFoam = /egg\s+white|albumen|aquafaba|heavy\s+cream|whipping\s+cream/.test(text)
    || (c.ingredients_raw || []).some((i) => /egg\s+white|cream|albumen|aquafaba/i.test(i.name || i.raw || ''));
  if (hasFoam && buildMethod === 'shake') return { value: 'high', confidence: 'high', source: 'foam-shake' };
  if (buildMethod === 'shake') return { value: 'medium', confidence: 'high', source: 'shake-default' };
  if (buildMethod === 'blend') return { value: 'high', confidence: 'high', source: 'blend' };
  if (buildMethod === 'throw') return { value: 'high', confidence: 'high', source: 'throw' };
  if (buildMethod === 'stir') return { value: 'low', confidence: 'high', source: 'stir' };
  if (buildMethod === 'build' || buildMethod === 'swizzle' || buildMethod === 'muddle')
    return { value: 'low', confidence: 'medium', source: buildMethod };
  return { value: null, confidence: 'unknown', source: 'no-method' };
}

// ── Main ───────────────────────────────────────────────────────────
function main() {
  const data = JSON.parse(fs.readFileSync(IN_PATH, 'utf-8'));
  const rows = [];
  const stats = { build: {}, glass: {}, ice: {}, aer: {} };
  const conf = { build: { high: 0, medium: 0, unknown: 0 }, glass: { high: 0, medium: 0, unknown: 0 }, ice: { high: 0, medium: 0, unknown: 0 }, aer: { high: 0, medium: 0, unknown: 0 } };

  for (const c of data.cocktails) {
    const build = detectBuildMethod(c);
    const glass = detectGlassType(c);
    const ice = detectIceFormat(c, glass.value);
    const aer = detectAeration(c, build.value);

    rows.push({
      cocktail: c.name,
      canonical: c.name_canonical,
      build_method: build.value || '',
      build_confidence: build.confidence,
      glass_type: glass.value || '',
      glass_confidence: glass.confidence,
      ice_format: ice.value || '',
      ice_confidence: ice.confidence,
      aeration: aer.value || '',
      aer_confidence: aer.confidence,
    });

    if (build.value) stats.build[build.value] = (stats.build[build.value] || 0) + 1;
    if (glass.value) stats.glass[glass.value] = (stats.glass[glass.value] || 0) + 1;
    if (ice.value) stats.ice[ice.value] = (stats.ice[ice.value] || 0) + 1;
    if (aer.value) stats.aer[aer.value] = (stats.aer[aer.value] || 0) + 1;
    conf.build[build.confidence]++;
    conf.glass[glass.confidence]++;
    conf.ice[ice.confidence]++;
    conf.aer[aer.confidence]++;
  }

  // CSV output
  const escape = (s) => `"${String(s).replace(/"/g, '""')}"`;
  const csv = ['cocktail,canonical,build_method,build_confidence,glass_type,glass_confidence,ice_format,ice_confidence,aeration,aer_confidence'];
  for (const r of rows) {
    csv.push([escape(r.cocktail), escape(r.canonical), r.build_method, r.build_confidence, r.glass_type, r.glass_confidence, r.ice_format, r.ice_confidence, r.aeration, r.aer_confidence].join(','));
  }
  fs.writeFileSync(CSV_PATH, csv.join('\n'));

  // Report
  const lines = [];
  lines.push('Cocktail v2 Phase 2 — engineering report');
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push(`Cocktails: ${data.cocktails.length}`);
  lines.push('');
  lines.push('--- Build method distribution ---');
  for (const [k, v] of Object.entries(stats.build).sort((a, b) => b[1] - a[1])) lines.push(`  ${k.padEnd(10)} ${v}`);
  lines.push(`Confidence: high=${conf.build.high} medium=${conf.build.medium} unknown=${conf.build.unknown}`);
  lines.push('');
  lines.push('--- Glass type distribution ---');
  for (const [k, v] of Object.entries(stats.glass).sort((a, b) => b[1] - a[1])) lines.push(`  ${k.padEnd(12)} ${v}`);
  lines.push(`Confidence: high=${conf.glass.high} medium=${conf.glass.medium} unknown=${conf.glass.unknown}`);
  lines.push('');
  lines.push('--- Ice format distribution ---');
  for (const [k, v] of Object.entries(stats.ice).sort((a, b) => b[1] - a[1])) lines.push(`  ${k.padEnd(10)} ${v}`);
  lines.push(`Confidence: high=${conf.ice.high} medium=${conf.ice.medium} unknown=${conf.ice.unknown}`);
  lines.push('');
  lines.push('--- Aeration distribution ---');
  for (const [k, v] of Object.entries(stats.aer).sort((a, b) => b[1] - a[1])) lines.push(`  ${k.padEnd(10)} ${v}`);
  lines.push(`Confidence: high=${conf.aer.high} medium=${conf.aer.medium} unknown=${conf.aer.unknown}`);
  lines.push('');
  lines.push('--- Cocktails with no build_method detected (need recipe text or manual tag) ---');
  const missing = rows.filter((r) => !r.build_method);
  for (const r of missing.slice(0, 30)) lines.push(`  ${r.cocktail}`);
  if (missing.length > 30) lines.push(`  ... + ${missing.length - 30} more`);
  fs.writeFileSync(REPORT_PATH, lines.join('\n'));

  console.log(`Wrote ${rows.length} engineering rows to ${CSV_PATH}`);
  console.log(`Build: ${conf.build.high} high, ${conf.build.medium} medium, ${conf.build.unknown} unknown`);
  console.log(`Glass: ${conf.glass.high} high, ${conf.glass.medium} medium, ${conf.glass.unknown} unknown`);
  console.log(`Ice:   ${conf.ice.high} high, ${conf.ice.medium} medium, ${conf.ice.unknown} unknown`);
  console.log(`Aer:   ${conf.aer.high} high, ${conf.aer.medium} medium, ${conf.aer.unknown} unknown`);
  console.log(`Report at ${REPORT_PATH}`);
}

main();
