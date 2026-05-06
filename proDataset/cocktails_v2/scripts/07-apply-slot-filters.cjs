#!/usr/bin/env node
/**
 * Cocktail Codex v2 — Phase 1 finalization: apply deferred slot-based
 * exclusion rules (1, 5) using the now-built slot dictionary.
 *
 * Rule 1: Drop if base is exclusively a flavored / cream liqueur
 *         (no spirit slot, only amaro_liqueur as a "base")
 * Rule 5: Drop if sweetener-slot ingredient count ≥ 3
 *         (manufactured-sweet pattern)
 *
 * Also applies a final manual blocklist sweep covering the homemade
 * liqueur recipes and novelty drinks that surfaced as build-method
 * unknowns in step 6 (Coffee Liqueur, Homemade Kahlua, Kool-Aid
 * Slammer, etc.) — none of these are real cocktails.
 *
 * Inputs:
 *   proDataset/cocktails_v2/raw/corpus_v2.json
 *   proDataset/cocktails_v2/data/cocktail_ingredient_slots.csv
 *
 * Outputs:
 *   proDataset/cocktails_v2/raw/corpus_v3.json   (Phase 1 truly final)
 *   proDataset/cocktails_v2/raw/corpus_v3_report.txt
 */

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../../..');
const IN_PATH = path.join(ROOT, 'proDataset/cocktails_v2/raw/corpus_v2.json');
const SLOT_CSV = path.join(ROOT, 'proDataset/cocktails_v2/data/cocktail_ingredient_slots.csv');
const OUT_DIR = path.join(ROOT, 'proDataset/cocktails_v2/raw');
const OUT_PATH = path.join(OUT_DIR, 'corpus_v3.json');
const REPORT_PATH = path.join(OUT_DIR, 'corpus_v3_report.txt');

// Final manual blocklist sweep — homemade liqueur recipes, novelty
// slammers, Kool-Aid drinks, and other non-cocktail edge cases that
// surfaced during Phase 2's build-method auto-classifier.
const FINAL_BLOCKLIST = new Set([
  'coffee liqueur',
  'homemade kahlua',
  'irish cream',
  'tia-maria',
  'tia maria',
  'kool first aid',
  'kool-aid slammer',
  'kool aid slammer',
  'moranguito',
  'tequila slammer',
  'tequila surprise',
  'jelly bean',
  'vodka russian',
  'karsk',
  'kurant tea',
  'shark attack',
  'limona corona',
  'fahrenheit 5000',
  'downshift',
  'danbooka',
  'diesel',
  'radler',
  'halloween punch',
  'miami vice',
]);

// Load slot dictionary
function loadSlots() {
  const lines = fs.readFileSync(SLOT_CSV, 'utf-8').split('\n').slice(1);
  const m = new Map();
  for (const line of lines) {
    const match = line.match(/^"([^"]+)",([^,]*),/);
    if (match) m.set(match[1], match[2]);
  }
  return m;
}

function normalizeName(name) {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[‘’'`]/g, '')
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function getSlotCounts(c, slotMap) {
  const counts = {};
  for (const ing of c.ingredients_raw || []) {
    const name = normalizeName(ing.name || ing.raw || '');
    const slot = slotMap.get(name);
    if (slot) counts[slot] = (counts[slot] || 0) + 1;
  }
  return counts;
}

function applySlotFilters(c, slotCounts) {
  const reasons = [];
  const cn = c.name_canonical;
  // Rule 1: liqueur-only base (amaro_liqueur > 0 AND spirit == 0).
  // IBA / Codex blessed cocktails are exempted: they're explicitly
  // canonical so we'd be overriding human curation by dropping them.
  // (e.g. Hanky Panky has gin spirit; Grasshopper is liqueur-only).
  if ((slotCounts.amaro_liqueur || 0) > 0
      && (slotCounts.spirit || 0) === 0
      && !c.iba_official
      && !c.sources.includes('cocktail_codex')) {
    reasons.push('rule-1: liqueur-only base (no spirit slot)');
  }
  // Rule 5: sweetener count ≥ 3.
  // Same exemption — IBA/Codex cocktails like Mai Tai legitimately have
  // multiple sweeteners (orgeat + curaçao + sugar).
  if ((slotCounts.sweet || 0) >= 3
      && !c.iba_official
      && !c.sources.includes('cocktail_codex')) {
    reasons.push('rule-5: sweetener count ≥ 3');
  }
  // Final manual blocklist (Phase 2 cleanup)
  if (FINAL_BLOCKLIST.has(cn)) {
    reasons.push('rule-7-final: manual blocklist (Phase 2 cleanup)');
  }
  return reasons;
}

function main() {
  const data = JSON.parse(fs.readFileSync(IN_PATH, 'utf-8'));
  const slotMap = loadSlots();
  const kept = [];
  const dropped = [];

  for (const c of data.cocktails) {
    const slotCounts = getSlotCounts(c, slotMap);
    c.slot_counts = slotCounts; // attach for downstream use
    const reasons = applySlotFilters(c, slotCounts);
    if (reasons.length === 0) {
      kept.push(c);
    } else {
      dropped.push({ name: c.name, sources: c.sources, slot_counts: slotCounts, reasons });
    }
  }

  fs.writeFileSync(
    OUT_PATH,
    JSON.stringify(
      {
        _meta: {
          ...data._meta,
          generatedAt: new Date().toISOString(),
          script: '07-apply-slot-filters.cjs',
          phase: 'Phase 1 truly final',
          input_count: data.cocktails.length,
          dropped_in_this_pass: dropped.length,
          final_count: kept.length,
          iba_official_count: kept.filter((c) => c.iba_official).length,
        },
        cocktails: kept,
      },
      null,
      2,
    ),
  );

  const lines = [];
  lines.push('Cocktail v2 — corpus_v3 final report');
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push('');
  lines.push(`Input:    ${data.cocktails.length}`);
  lines.push(`Dropped:  ${dropped.length}`);
  lines.push(`FINAL:    ${kept.length}`);
  lines.push(`IBA-official: ${kept.filter((c) => c.iba_official).length}`);
  lines.push('');
  const hist = {};
  for (const d of dropped) for (const r of d.reasons) hist[r] = (hist[r] || 0) + 1;
  lines.push('--- Drop reason histogram ---');
  for (const [r, n] of Object.entries(hist).sort((a, b) => b[1] - a[1])) {
    lines.push(`  ${n.toString().padStart(4)}  ${r}`);
  }
  lines.push('');
  lines.push('--- All dropped (sample) ---');
  for (const d of dropped.slice(0, 60)) {
    lines.push(`  ${d.name.padEnd(35)} ${d.reasons.join('; ')}`);
  }
  fs.writeFileSync(REPORT_PATH, lines.join('\n'));

  console.log(`Final corpus: ${kept.length} cocktails (was ${data.cocktails.length}, dropped ${dropped.length})`);
}

main();
