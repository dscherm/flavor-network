/**
 * FM-P0-2 + FM-Q1 — build the recipe-generation corpus AND parse ingredient
 * quantities in a SINGLE pass over the 2.2GB proDataset/raw/recipenlg.csv
 * (build-time only; nothing here ships to the client).
 *
 * Reuses the pipeline's canonicalizeIngredient() (proDataset/utils.js) and the
 * app's parseAmount()/UNIT_DENSITY (src/data/portionParser.js) — do NOT
 * reimplement either; consistency with the live pipeline is the whole point.
 *
 * Outputs (flavor-gnn/data/):
 *   vocab.json                  sorted vocab names; id = array index (set-model token ids)
 *   recipe_sets.jsonl           {r, v:[ids], nr, nm, s, t}  (FM-P0-2)
 *   ingredient_quantities.jsonl {r, v:id, q:qty, u:unit}     (FM-Q1)
 *   corpus_report.md            shrinkage + quantity parse-coverage
 *
 * Rules:
 *   - vocab = keys of public/proDataset/ingredients.json.
 *   - a recipe's set = unique vocab ids from its NER tokens; drop recipes with
 *     < K_MIN (=3) mapped ingredients; dedupe identical id-sets (keep first).
 *   - quantities: only when len(ingredients)==len(NER) (index alignment guard);
 *     parseAmount(ingredients[i]) paired with the vocab id of NER[i].
 *
 * Deterministic, no network. Streamed + stream-written (no giant in-memory arrays).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import csvParser from '../../proDataset/node_modules/csv-parser/index.js';
import { canonicalizeIngredient } from '../../proDataset/utils.js';
import { UNIT_DENSITY } from '../../src/data/portionParser.js';

// Leading-amount extractor for RecipeNLG ingredient LINES (e.g.
// "1 c. firmly packed brown sugar", "1/2 tsp. vanilla", "4 boned chicken
// breasts"). The app's parseAmount() is for clean amount *fields* and returns
// null on full lines, so we parse the leading "QTY [UNIT]" prefix here and
// normalize the unit against UNIT_DENSITY (which already carries c/tsp/tbsp +
// long forms). Period-suffixed abbreviations ("c.", "Tbsp.") are stripped.
// A leading number with no recognized unit word is treated as a count ('each').
function parseQty(q) {
  const t = q.trim();
  if (/^\d+\s+\d+\/\d+$/.test(t)) { const [w, f] = t.split(/\s+/); const [a, b] = f.split('/'); return +b ? +w + +a / +b : null; }
  if (/^\d+\/\d+$/.test(t)) { const [a, b] = t.split('/'); return +b ? +a / +b : null; }
  const v = parseFloat(t);
  return Number.isNaN(v) ? null : v;
}
function normUnit(tok) {
  if (!tok) return null;
  const u = tok.toLowerCase().replace(/\.+$/, '').trim();
  return UNIT_DENSITY[u] != null ? u : null;
}
function parseLeadingAmount(line) {
  if (!line) return null;
  const m = String(line).trim().match(/^(\d+\s+\d+\/\d+|\d+\/\d+|\d+\.\d+|\d+)\s*([a-zA-Z]+\.?)?/);
  if (!m) return null;
  const qty = parseQty(m[1]);
  if (qty == null) return null;
  const unit = normUnit(m[2]);
  return { qty, unit: unit || 'each' };
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const CSV_PATH = path.join(ROOT, 'proDataset', 'raw', 'recipenlg.csv');
const VOCAB_SRC = path.join(ROOT, 'public', 'proDataset', 'ingredients.json');
const OUT_DIR = path.join(ROOT, 'flavor-gnn', 'data');
const K_MIN = 3;

function log(...a) { console.log('[fm-p0-2]', ...a); }

function resolveVocabId(token, vocabIndex) {
  const t = String(token).toLowerCase().trim();
  if (vocabIndex.has(t)) return vocabIndex.get(t);
  const canon = canonicalizeIngredient(t);
  if (canon) {
    const c = canon.toLowerCase();
    if (vocabIndex.has(c)) return vocabIndex.get(c);
  }
  return null;
}

async function run() {
  if (!fs.existsSync(CSV_PATH)) { console.error(`CSV not found: ${CSV_PATH}`); process.exit(1); }
  fs.mkdirSync(OUT_DIR, { recursive: true });

  // Stable vocab → id map (sorted for determinism).
  const vocabNames = Object.keys(JSON.parse(fs.readFileSync(VOCAB_SRC, 'utf-8')))
    .map((k) => k.toLowerCase()).sort();
  const vocabIndex = new Map(vocabNames.map((n, i) => [n, i]));
  fs.writeFileSync(path.join(OUT_DIR, 'vocab.json'),
    JSON.stringify({ _meta: { count: vocabNames.length, source: 'ingredients.json keys' }, vocab: vocabNames }));
  log(`vocab: ${vocabNames.length}`);

  const setsOut = fs.createWriteStream(path.join(OUT_DIR, 'recipe_sets.jsonl'), 'utf-8');
  const qtyOut = fs.createWriteStream(path.join(OUT_DIR, 'ingredient_quantities.jsonl'), 'utf-8');

  const seenSets = new Set();          // dedupe by joined sorted id string
  const nMappedHist = new Map();       // n_mapped -> recipe count (pre-dedupe, mapped>=1)
  const validUnits = new Set(Object.keys(UNIT_DENSITY));
  let total = 0, kept = 0, droppedFewMapped = 0, droppedDup = 0;
  let alignOk = 0, alignSkip = 0, qtyLines = 0, qtyUsable = 0, qtyTriples = 0;

  await new Promise((resolve, reject) => {
    fs.createReadStream(CSV_PATH, 'utf-8').pipe(csvParser())
      .on('data', (row) => {
        const rid = total;
        total++;
        if (total % 250000 === 0) log(`  ...${total} recipes (kept ${kept})`);

        let ner, ings;
        try { ner = JSON.parse(row.NER || '[]'); } catch { return; }
        if (!Array.isArray(ner) || ner.length === 0) return;
        try { ings = JSON.parse(row.ingredients || '[]'); } catch { ings = null; }

        // Build the unique mapped id set.
        const ids = [];
        const idSet = new Set();
        for (const tok of ner) {
          const id = resolveVocabId(tok, vocabIndex);
          if (id != null && !idSet.has(id)) { idSet.add(id); ids.push(id); }
        }
        const nMapped = ids.length;
        if (nMapped >= 1) nMappedHist.set(nMapped, (nMappedHist.get(nMapped) || 0) + 1);

        // Quantities (FM-Q1): only with a clean index alignment.
        if (Array.isArray(ings) && ings.length === ner.length) {
          alignOk++;
          for (let i = 0; i < ner.length; i++) {
            qtyLines++;
            const id = resolveVocabId(ner[i], vocabIndex);
            if (id == null) continue;
            const amt = parseLeadingAmount(ings[i]);
            // Usable = a real numeric qty with a density-known unit ('each' incl.).
            if (amt && amt.qty != null && amt.unit && validUnits.has(amt.unit)) {
              qtyUsable++;
              qtyTriples++;
              qtyOut.write(`{"r":${rid},"v":${id},"q":${amt.qty},"u":${JSON.stringify(amt.unit)}}\n`);
            }
          }
        } else if (Array.isArray(ings)) {
          alignSkip++;
        }

        // Corpus set (FM-P0-2): K_MIN gate + dedupe.
        if (nMapped < K_MIN) { droppedFewMapped++; return; }
        ids.sort((a, b) => a - b);
        const key = ids.join(',');
        if (seenSets.has(key)) { droppedDup++; return; }
        seenSets.add(key);
        kept++;
        const title = (row.title || '').slice(0, 80).replace(/[\r\n]/g, ' ');
        setsOut.write(JSON.stringify({ r: rid, v: ids, nr: ner.length, nm: nMapped, s: row.source || '', t: title }) + '\n');
      })
      .on('end', resolve).on('error', reject);
  });

  // end(cb) fires cb on 'finish' even if the stream drains synchronously —
  // avoids the attach-after-finish race that silently skipped the report.
  await new Promise((r) => setsOut.end(r));
  await new Promise((r) => qtyOut.end(r));

  // Reports.
  const histRows = [...nMappedHist.entries()].sort((a, b) => a[0] - b[0]);
  const pct = (n, d) => (d ? ((n / d) * 100).toFixed(2) + '%' : 'n/a');
  const lines = [
    '# FM-P0-2 + FM-Q1 — corpus build report',
    '',
    '## FM-P0-2 recipe sets',
    `- recipes parsed: **${total.toLocaleString()}**`,
    `- kept (nm>=${K_MIN}, deduped): **${kept.toLocaleString()}** ${kept >= 1_500_000 ? '✅ (>=1.5M gate)' : '❌ (below 1.5M gate)'}`,
    `- dropped (nm<${K_MIN}): ${droppedFewMapped.toLocaleString()}`,
    `- dropped (duplicate set): ${droppedDup.toLocaleString()}`,
    '',
    '### n_mapped distribution (recipes with >=1 mapped ingredient)',
    '',
    '| n_mapped | recipes |',
    '|---|---|',
    ...histRows.filter(([k]) => k <= 20).map(([k, c]) => `| ${k} | ${c.toLocaleString()} |`),
    `| 21+ | ${histRows.filter(([k]) => k > 20).reduce((s, [, c]) => s + c, 0).toLocaleString()} |`,
    '',
    '## FM-Q1 quantities',
    `- index-aligned recipes (len(ingredients)==len(NER)): **${alignOk.toLocaleString()}** (skipped ${alignSkip.toLocaleString()})`,
    `- ingredient lines seen (aligned): ${qtyLines.toLocaleString()}`,
    `- usable {qty,unit} triples emitted: **${qtyTriples.toLocaleString()}**`,
    `- parse-coverage (usable / aligned lines): **${pct(qtyUsable, qtyLines)}**`,
    `- unit vocabulary: matches UNIT_DENSITY (${validUnits.size} units)`,
  ];
  fs.writeFileSync(path.join(OUT_DIR, 'corpus_report.md'), lines.join('\n'), 'utf-8');

  log(`kept ${kept} sets (${kept >= 1.5e6 ? 'PASS' : 'BELOW'} 1.5M), ${qtyTriples} qty triples, ` +
      `qty parse-coverage ${pct(qtyUsable, qtyLines)}`);
  log('wrote vocab.json, recipe_sets.jsonl, ingredient_quantities.jsonl, corpus_report.md');
}

run().catch((e) => { console.error(e); process.exit(1); });
