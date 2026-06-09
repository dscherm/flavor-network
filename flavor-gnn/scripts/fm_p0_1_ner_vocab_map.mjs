/**
 * FM-P0-1 — RecipeNLG NER → ingredient-vocab normalization map + coverage.
 *
 * Reads the 2.2GB proDataset/raw/recipenlg.csv (BUILD-TIME ONLY — nothing here
 * ships to the client) and maps every distinct NER ingredient token to a
 * canonical app-vocab id, REUSING the pipeline's own canonicalizeIngredient()
 * (proDataset/utils.js) so this map stays consistent with how the rest of the
 * ProData pipeline normalizes ingredients. Do NOT reimplement normalization in
 * a second language — divergence is the trap.
 *
 * Vocab = keys of public/proDataset/ingredients.json (the app's ~3.9K
 * ingredient universe and the recipe-generation set-model's vocabulary).
 *
 * Outputs (flavor-gnn/data/):
 *   ner_vocab_map.json        { ner_token -> vocab_id | null }   (+ _meta)
 *   ner_vocab_coverage.md     human-readable coverage + top-200 unmatched
 *
 * Deterministic, no network. Resolution order per raw token:
 *   1. lowercased token is itself a vocab key            → that key
 *   2. canonicalizeIngredient(token) is a vocab key       → canonical
 *   (else null — unresolved)
 *
 * Run from the proDataset dir so csv-parser + utils.js resolve:
 *   node flavor-gnn/scripts/fm_p0_1_ner_vocab_map.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import csvParser from '../../proDataset/node_modules/csv-parser/index.js';
import { canonicalizeIngredient } from '../../proDataset/utils.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const CSV_PATH = path.join(ROOT, 'proDataset', 'raw', 'recipenlg.csv');
const VOCAB_PATH = path.join(ROOT, 'public', 'proDataset', 'ingredients.json');
const OUT_DIR = path.join(ROOT, 'flavor-gnn', 'data');
const MAP_PATH = path.join(OUT_DIR, 'ner_vocab_map.json');
const REPORT_PATH = path.join(OUT_DIR, 'ner_vocab_coverage.md');

function log(...a) { console.log('[fm-p0-1]', ...a); }

async function run() {
  if (!fs.existsSync(CSV_PATH)) {
    console.error(`RecipeNLG CSV not found at ${CSV_PATH}`);
    process.exit(1);
  }
  const vocab = new Set(
    Object.keys(JSON.parse(fs.readFileSync(VOCAB_PATH, 'utf-8'))).map((k) => k.toLowerCase()),
  );
  log(`vocab: ${vocab.size} ingredients`);

  // Pass 1: stream the 2.2GB CSV, count raw NER token occurrence frequency.
  const freq = new Map(); // raw token (lowercased) -> occurrences
  let totalRecipes = 0;
  let totalTokenOccurrences = 0;

  await new Promise((resolve, reject) => {
    fs.createReadStream(CSV_PATH, 'utf-8')
      .pipe(csvParser())
      .on('data', (row) => {
        totalRecipes++;
        if (totalRecipes % 250000 === 0) log(`  ...${totalRecipes} recipes`);
        let ner;
        try { ner = JSON.parse(row.NER || '[]'); } catch { return; }
        if (!Array.isArray(ner)) return;
        for (const raw of ner) {
          if (typeof raw !== 'string' || !raw.trim()) continue;
          const t = raw.toLowerCase().trim();
          freq.set(t, (freq.get(t) || 0) + 1);
          totalTokenOccurrences++;
        }
      })
      .on('end', resolve)
      .on('error', reject);
  });
  log(`parsed ${totalRecipes} recipes, ${freq.size} distinct NER tokens, ` +
      `${totalTokenOccurrences} token occurrences`);

  // Pass 2: resolve each distinct token to a vocab id.
  const map = {};
  let resolvedOcc = 0;
  const unmatched = []; // [token, freq]
  for (const [token, f] of freq) {
    let vid = null;
    if (vocab.has(token)) {
      vid = token;
    } else {
      const canon = canonicalizeIngredient(token);
      if (canon && vocab.has(canon.toLowerCase())) vid = canon.toLowerCase();
    }
    map[token] = vid;
    if (vid) resolvedOcc += f;
    else unmatched.push([token, f]);
  }

  const coverage = totalTokenOccurrences ? resolvedOcc / totalTokenOccurrences : 0;
  const distinctResolved = Object.values(map).filter(Boolean).length;
  unmatched.sort((a, b) => b[1] - a[1]);
  const top200 = unmatched.slice(0, 200);

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(MAP_PATH, JSON.stringify({
    _meta: {
      task: 'FM-P0-1',
      source: 'proDataset/raw/recipenlg.csv (build-time only)',
      vocab: 'public/proDataset/ingredients.json keys',
      totalRecipes,
      distinctNerTokens: freq.size,
      tokenOccurrences: totalTokenOccurrences,
      distinctResolved,
      weightedCoverage: Math.round(coverage * 1e4) / 1e4,
    },
    map,
  }), 'utf-8');

  const pct = (n) => `${(n * 100).toFixed(2)}%`;
  const lines = [
    '# FM-P0-1 — NER → vocab coverage',
    '',
    `- recipes parsed: **${totalRecipes.toLocaleString()}**`,
    `- distinct NER tokens: **${freq.size.toLocaleString()}**`,
    `- token occurrences: **${totalTokenOccurrences.toLocaleString()}**`,
    `- distinct tokens resolved: **${distinctResolved.toLocaleString()}**`,
    `- **weighted (occurrence) coverage: ${pct(coverage)}** ${coverage >= 0.85 ? '✅ (gate ≥85%)' : '❌ (below 85% gate)'}`,
    '',
    '## Top-200 unmatched tokens by frequency (follow-up synonym pass)',
    '',
    '| # | token | occurrences |',
    '|---|---|---|',
    ...top200.map(([t, f], i) => `| ${i + 1} | ${t.replace(/\|/g, '\\|')} | ${f} |`),
  ];
  fs.writeFileSync(REPORT_PATH, lines.join('\n'), 'utf-8');

  log(`weighted coverage: ${pct(coverage)} (${coverage >= 0.85 ? 'PASS' : 'BELOW'} 85% gate)`);
  log(`wrote ${path.relative(ROOT, MAP_PATH)} + ${path.relative(ROOT, REPORT_PATH)}`);
}

run().catch((e) => { console.error(e); process.exit(1); });
