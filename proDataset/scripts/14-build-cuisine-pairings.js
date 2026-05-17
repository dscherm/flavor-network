/**
 * 14-build-cuisine-pairings.js
 *
 * Cuisine-anchored pair extraction. Streams RecipeNLG (2.2M recipes)
 * through a cascade cuisine tagger (title-keyword → URL → confident
 * ingredient-signature), then aggregates per-cuisine pair counts.
 * Cross-references against the shipped pairings.json to attach
 * modelStrength + novelty per pair.
 *
 * Output: proDataset/output/cuisine_pairings.json (and copied to
 * public/proDataset/ at ship-prep time).
 *
 * Designed to run after 07-blend-v2.js so pairings.json exists.
 */
import fs from 'fs';
import path from 'path';
import {
  RAW_DIR, PROCESSED_DIR, OUTPUT_DIR, DATA_DIR,
} from '../config.js';
import { ensureDir, writeJson, log } from '../utils.js';

const RECIPENLG = path.join(RAW_DIR, 'recipenlg.csv');
const MEALDB_DIR = path.join(RAW_DIR, 'mealdb');
const SYN_PATH = path.join(DATA_DIR, 'synonyms.json');
const CDB_PATH = path.join(PROCESSED_DIR, 'culinarydb-cuisines.json');
const PAIRINGS_PATH = path.join(OUTPUT_DIR, 'pairings.json');
const OUT_PATH = path.join(OUTPUT_DIR, 'cuisine_pairings.json');

// Minimum recipe-count for a pair to be retained in the output.
const MIN_PAIR_COUNT = 5;
// Confidence floor for the signature classifier to count as a tag.
const SIG_CONFIDENCE_GAP = 2;
// Skip recipe rows whose NER list is empty (parse failures).
const MIN_INGS = 2;

// Universal staples — excluded from pair extraction. Anything that
// pairs with everything dilutes the cuisine signal.
const STAPLES = new Set([
  'sugar', 'egg', 'onion', 'butter', 'flour', 'garlic', 'milk', 'vanilla',
  'olive oil', 'tomato', 'brown sugar', 'cinnamon', 'chicken', 'baking powder',
  'lemon juice', 'vegetable oil', 'celery', 'parsley', 'sour cream', 'cream cheese',
  'baking soda', 'scallion', 'carrot', 'cream', 'cheddar', 'parmesan', 'mustard',
  'mayonnaise', 'lemon', 'potato', 'water', 'salt', 'pepper', 'black pepper',
  'ice', 'oil', 'warm water',
]);

// ── Synonym map ──
const SYN = JSON.parse(fs.readFileSync(SYN_PATH, 'utf8'));
function canon(s) {
  const n = String(s).toLowerCase().trim();
  return SYN[n] || n;
}

// ── CulinaryDB ingredient-signature prior ──
const CDB = JSON.parse(fs.readFileSync(CDB_PATH, 'utf8'));
function buildSignaturePrior() {
  const ingByCui = {};
  const totalByCui = {};
  const vocab = new Set();
  for (const [ing, data] of Object.entries(CDB)) {
    if (ing.startsWith('_')) continue;
    const reg = data.byRegion;
    if (!reg) continue;
    vocab.add(ing);
    for (const [cui, n] of Object.entries(reg)) {
      if (!ingByCui[cui]) ingByCui[cui] = {};
      ingByCui[cui][ing] = (ingByCui[cui][ing] || 0) + n;
      totalByCui[cui] = (totalByCui[cui] || 0) + n;
    }
  }
  const cuisines = Object.keys(ingByCui);
  const SMOOTH = 0.5;
  const V = vocab.size;
  const grandTotal = cuisines.reduce((s, c) => s + totalByCui[c], 0);
  return function classify(ings) {
    const filtered = ings.filter((x) => vocab.has(x));
    if (filtered.length < 3) return null;
    const scored = cuisines.map((c) => {
      const tot = totalByCui[c];
      const denom = tot + V * SMOOTH;
      let lp = Math.log(tot / grandTotal);
      for (const ing of filtered) {
        const ct = (ingByCui[c][ing] || 0) + SMOOTH;
        lp += Math.log(ct / denom);
      }
      return [c, lp];
    }).sort((a, b) => b[1] - a[1]);
    return {
      cui: scored[0][0],
      gap: scored[0][1] - scored[1][1],
    };
  };
}
const signatureClassify = buildSignaturePrior();

// ── Title-keyword tagger (word-boundary regex + stop-list) ──
const TITLE_RULES = [
  ['Italy', ['italian', 'italy', 'tuscan', 'sicilian', 'venetian', 'parmigiana', 'marinara', 'arrabbiata', 'carbonara', 'bolognese', 'lasagna', 'risotto', 'focaccia', 'pesto', 'tiramisu', 'ciabatta', 'prosciutto', 'antipasti', 'caprese', 'piccata', 'osso buco', 'cacio e pepe', 'minestrone']],
  ['Mexico', ['mexican', 'mexico', 'oaxaca', 'taco', 'burrito', 'enchilada', 'quesadilla', 'fajita', 'chimichanga', 'tostada', 'salsa verde', 'mole poblano', 'mexicana', 'chilaquile', 'pozole', 'horchata', 'churro', 'elote']],
  ['France', ['french', 'france', 'provencal', 'parisien', 'bordelaise', 'beurre blanc', 'ratatouille', 'coq au vin', 'bourguignon', 'quiche', 'crepe', 'crêpe', 'souffle', 'soufflé', 'clafouti', 'remoulade', 'dijon', 'niçoise', 'nicoise', 'cassoulet', 'bouillabaisse', 'vichyssoise', 'tarte tatin', 'creme brulee', 'crème brûlée', 'rouille', 'pain au', 'pot au feu']],
  ['Indian Subcontinent', ['indian', 'tikka', 'masala', 'curry', 'tandoori', 'vindaloo', 'biryani', 'samosa', 'naan', 'korma', 'dahl', 'chutney', 'paneer', 'garam', 'basmati', 'raita', 'lassi', 'pakora', 'paratha', 'roti', 'pulao', 'chana', 'aloo']],
  ['China', ['chinese', 'szechuan', 'sichuan', 'cantonese', 'hunan', 'wonton', 'dim sum', 'peking', 'kung pao', 'lo mein', 'chow mein', 'egg roll', 'moo shu', 'fried rice', 'stir fry', 'stir-fry', 'mapo', 'bok choy', 'dumpling']],
  ['Thailand', ['thai', 'pad thai', 'tom yum', 'tom kha', 'green curry', 'red curry', 'massaman', 'satay', 'panang']],
  ['Japan', ['japanese', 'sushi', 'sashimi', 'tempura', 'miso', 'udon', 'soba', 'ramen', 'teriyaki', 'yakitori', 'katsu', 'okonomiyaki', 'onigiri', 'dashi', 'donburi', 'gyoza']],
  ['Greece', ['greek', 'tzatziki', 'spanakopita', 'moussaka', 'gyro', 'souvlaki', 'baklava', 'dolmade', 'phyllo', 'avgolemono', 'pastitsio']],
  ['Spain', ['spanish', 'paella', 'gazpacho', 'sangria', 'manchego', 'tortilla espanola', 'pintxo', 'pisto', 'pulpo']],
  ['South East Asia', ['vietnamese', 'pho', 'banh mi', 'nuoc cham', 'goi cuon', 'bun bo', 'banh xeo', 'filipino', 'malaysian', 'indonesian', 'rendang', 'nasi goreng', 'laksa', 'satay']],
  ['Korea', ['korean', 'kimchi', 'bibimbap', 'bulgogi', 'japchae', 'tteokbokki', 'gochujang']],
  ['Middle East', ['middle eastern', 'lebanese', 'syrian', 'israeli', 'turkish', 'hummus', 'falafel', 'tabouli', 'tabbouleh', 'shawarma', 'baba ganoush', 'kibbeh', 'fattoush', 'sumac', 'za atar', 'tagine']],
  ['Caribbean', ['caribbean', 'jamaican', 'jerk chicken', 'jerk pork', 'jerk shrimp', 'curry goat', 'rice and pea', 'cuban', 'dominican', 'puerto rican', 'plantain']],
  ['British Isles', ['british', 'english', 'scottish', 'welsh', 'irish stew', 'shepherd', 'cornish pasty', 'yorkshire pudding', 'toad in the hole', 'bubble and squeak', 'sticky toffee', 'spotted dick', 'sunday roast', 'bangers and mash', 'fish and chip']],
  ['DACH Countries', ['german', 'germany', 'bratwurst', 'sauerbraten', 'spätzle', 'spaetzle', 'schnitzel', 'strudel', 'kraut', 'austrian', 'swiss']],
  ['Africa', ['african', 'moroccan', 'tunisian', 'egyptian', 'ethiopian', 'algerian', 'tagine', 'harissa', 'couscous', 'injera', 'berbere', 'piri piri']],
];
const STOP_FALSE_FIRES = new Set(['jerky', 'curry powder']);
function wbRe(kw) {
  const esc = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const startWB = /^[a-z]/.test(kw) ? '\\b' : '';
  const endWB = /[a-z]$/.test(kw) ? '\\b' : '';
  return new RegExp(startWB + esc + endWB, 'i');
}
const COMPILED_TITLE_RULES = TITLE_RULES.map(([cui, kws]) => [cui, kws.map(wbRe)]);
function titleTag(title) {
  const t = title.toLowerCase();
  for (const s of STOP_FALSE_FIRES) if (t.includes(s)) return null;
  for (const [cui, regs] of COMPILED_TITLE_RULES) {
    for (const r of regs) if (r.test(t)) return cui;
  }
  return null;
}

// ── URL-path cuisine tagger ──
const URL_CUISINE_HINTS = [
  [/\b(italian|tuscan|sicilian)\b/i, 'Italy'],
  [/\b(mexican|tex-mex|tex mex)\b/i, 'Mexico'],
  [/\b(french|parisien|provencal)\b/i, 'France'],
  [/\b(indian|indianfood)\b/i, 'Indian Subcontinent'],
  [/\b(chinese|szechuan|cantonese)\b/i, 'China'],
  [/\bthai\b/i, 'Thailand'],
  [/\b(japanese|nihon)\b/i, 'Japan'],
  [/\bgreek\b/i, 'Greece'],
  [/\bspanish\b/i, 'Spain'],
  [/\b(vietnamese|filipino|malaysian|indonesian)\b/i, 'South East Asia'],
  [/\bkorean\b/i, 'Korea'],
  [/\b(middle ?eastern|lebanese|turkish|israeli)\b/i, 'Middle East'],
  [/\b(caribbean|jamaican|cuban)\b/i, 'Caribbean'],
  [/\b(british|english|irish)\b/i, 'British Isles'],
  [/\b(german|austrian|swiss)\b/i, 'DACH Countries'],
  [/\b(moroccan|african|ethiopian)\b/i, 'Africa'],
];
function urlTag(link) {
  if (!link) return null;
  for (const [re, cui] of URL_CUISINE_HINTS) if (re.test(link)) return cui;
  return null;
}

// ── Cascade tagger ──
function cascadeTag(title, link, ner) {
  const t = titleTag(title);
  if (t) return { cui: t, source: 'title' };
  const u = urlTag(link);
  if (u) return { cui: u, source: 'url' };
  const s = signatureClassify(ner);
  if (s && s.gap >= SIG_CONFIDENCE_GAP) return { cui: s.cui, source: 'signature' };
  return null;
}

// ── Streaming CSV parser (quote-aware, embedded LF safe) ──
async function* csvRows(filepath) {
  const stream = fs.createReadStream(filepath, { encoding: 'utf8', highWaterMark: 1 << 20 });
  let buf = '';
  let inQuote = false;
  for await (const chunk of stream) {
    buf += chunk;
    let lastBoundary = 0;
    for (let i = 0; i < buf.length; i++) {
      const c = buf[i];
      if (c === '"') {
        if (inQuote && buf[i + 1] === '"') { i++; continue; }
        inQuote = !inQuote;
      } else if (c === '\n' && !inQuote) {
        yield buf.slice(lastBoundary, i);
        lastBoundary = i + 1;
      }
    }
    buf = buf.slice(lastBoundary);
  }
  if (buf.trim()) yield buf;
}
function splitCsvRow(row) {
  const out = [];
  let cur = '';
  let inQuote = false;
  for (let i = 0; i < row.length; i++) {
    const c = row[i];
    if (c === '"') {
      if (inQuote && row[i + 1] === '"') { cur += '"'; i++; continue; }
      inQuote = !inQuote;
    } else if (c === ',' && !inQuote) {
      out.push(cur); cur = '';
    } else cur += c;
  }
  out.push(cur);
  return out;
}
function parseRow(row) {
  const cols = splitCsvRow(row);
  if (cols.length < 7) return null;
  const [, title, , , link, , nerRaw] = cols;
  let ner;
  try { ner = JSON.parse(nerRaw); } catch { return null; }
  if (!Array.isArray(ner) || ner.length < MIN_INGS) return null;
  return { title, link, ner: [...new Set(ner.map(canon))] };
}

// ── MealDB ingestion (ground-truth-tagged recipes) ──
function ingestMealDB(cuiPairCount, cuisineRecipeCount) {
  const AREA_TO_CUI = {
    Italian: 'Italy', French: 'France', Indian: 'Indian Subcontinent',
    Mexican: 'Mexico', Chinese: 'China', Thai: 'Thailand', Japanese: 'Japan',
    Greek: 'Greece', Spanish: 'Spain', Vietnamese: 'South East Asia',
    Turkish: 'Middle East', Jamaican: 'Caribbean', British: 'British Isles',
    American: 'USA', Canadian: 'Canada', Polish: 'Eastern Europe',
    Russian: 'Eastern Europe', German: 'DACH Countries', Dutch: 'DACH Countries',
    Egyptian: 'Africa', Tunisian: 'Africa', Moroccan: 'Africa',
    'Saudi Arabian': 'Middle East', Norwegian: 'Scandinavia', Irish: 'British Isles',
    Australian: 'Australia & NZ', Filipino: 'South East Asia',
    Croatian: 'Eastern Europe', Portuguese: 'Spain', Ukrainian: 'Eastern Europe',
    Kenyan: 'Africa', Malaysian: 'South East Asia',
  };
  let mealsTagged = 0;
  for (const f of fs.readdirSync(MEALDB_DIR)) {
    if (!f.startsWith('meals_')) continue;
    const d = JSON.parse(fs.readFileSync(path.join(MEALDB_DIR, f), 'utf8'));
    for (const m of d.meals || []) {
      const cui = AREA_TO_CUI[m.strArea];
      if (!cui) continue;
      const ings = [];
      for (let i = 1; i <= 20; i++) {
        const v = m['strIngredient' + i];
        if (v && v.trim()) ings.push(canon(v));
      }
      const filtered = [...new Set(ings)].filter((x) => !STAPLES.has(x));
      if (filtered.length < 2) continue;
      mealsTagged++;
      cuisineRecipeCount[cui] = (cuisineRecipeCount[cui] || 0) + 1;
      if (!cuiPairCount[cui]) cuiPairCount[cui] = {};
      for (let i = 0; i < filtered.length; i++) {
        for (let j = i + 1; j < filtered.length; j++) {
          const a = filtered[i], b = filtered[j];
          const key = a < b ? a + '|' + b : b + '|' + a;
          cuiPairCount[cui][key] = (cuiPairCount[cui][key] || 0) + 1;
        }
      }
    }
  }
  return mealsTagged;
}

// ── RecipeNLG streaming ingestion ──
async function ingestRecipeNLG(cuiPairCount, cuisineRecipeCount, tagSource) {
  if (!fs.existsSync(RECIPENLG)) {
    log(`  ⚠ RecipeNLG not found at ${RECIPENLG} — skipping (MealDB-only run)`);
    return { processed: 0, tagged: 0 };
  }
  let row = 0, header = true, tagged = 0, processed = 0;
  for await (const r of csvRows(RECIPENLG)) {
    if (header) { header = false; continue; }
    row++;
    if (row % 200_000 === 0) log(`  ...${row.toLocaleString()} rows processed (${tagged.toLocaleString()} tagged)`);
    const rec = parseRow(r);
    if (!rec) continue;
    processed++;
    const tag = cascadeTag(rec.title, rec.link, rec.ner);
    if (!tag) continue;
    tagged++;
    tagSource[tag.source] = (tagSource[tag.source] || 0) + 1;
    cuisineRecipeCount[tag.cui] = (cuisineRecipeCount[tag.cui] || 0) + 1;
    const filtered = rec.ner.filter((x) => !STAPLES.has(x));
    if (filtered.length < 2) continue;
    if (!cuiPairCount[tag.cui]) cuiPairCount[tag.cui] = {};
    for (let i = 0; i < filtered.length; i++) {
      for (let j = i + 1; j < filtered.length; j++) {
        const a = filtered[i], b = filtered[j];
        const key = a < b ? a + '|' + b : b + '|' + a;
        cuiPairCount[tag.cui][key] = (cuiPairCount[tag.cui][key] || 0) + 1;
      }
    }
  }
  return { processed, tagged };
}

// ── Cross-ref against pairings.json for novelty + modelStrength ──
function buildStrengthIndex() {
  if (!fs.existsSync(PAIRINGS_PATH)) {
    log(`  ⚠ pairings.json missing at ${PAIRINGS_PATH} — modelStrength will be null for all pairs`);
    return new Map();
  }
  const pairings = JSON.parse(fs.readFileSync(PAIRINGS_PATH, 'utf8'));
  const m = new Map();
  for (const p of pairings) {
    const a = canon(p.ingredientA), b = canon(p.ingredientB);
    const k = a < b ? a + '|' + b : b + '|' + a;
    m.set(k, p.strength);
  }
  return m;
}

// ── Aggregate per-pair: collapse cuisines into evidence[] sorted by count ──
function aggregatePairs(cuiPairCount, cuisineRecipeCount, strengthIndex) {
  // First pass — collect raw per-cuisine counts per pair.
  const perPair = new Map();   // pairKey → [{cuisine, count}]
  for (const [cui, pairs] of Object.entries(cuiPairCount)) {
    for (const [k, count] of Object.entries(pairs)) {
      if (count < MIN_PAIR_COUNT) continue;
      if (!perPair.has(k)) perPair.set(k, []);
      perPair.get(k).push({ cuisine: cui, count });
    }
  }
  // Second pass — score each pair.
  const out = {};
  for (const [k, evidence] of perPair.entries()) {
    evidence.sort((a, b) => b.count - a.count);
    // Attach recipePct.
    for (const e of evidence) {
      const total = cuisineRecipeCount[e.cuisine] || 1;
      e.recipePct = +(e.count / total).toFixed(4);
    }
    const primary = evidence[0];
    const modelStrength = strengthIndex.get(k) ?? null;
    const novelty = modelStrength === null ? 1.0 : +(1 - modelStrength).toFixed(3);
    out[k] = {
      evidence,
      primary: primary.cuisine,
      novelty,
      modelStrength,
    };
  }
  return out;
}

// ── Main ──
async function main() {
  log('=== 14: build cuisine pairings ===');
  ensureDir(OUTPUT_DIR);

  const cuiPairCount = {};
  const cuisineRecipeCount = {};
  const tagSource = { title: 0, url: 0, signature: 0 };

  log('Ingesting MealDB (ground-truth-tagged)...');
  const mealsTagged = ingestMealDB(cuiPairCount, cuisineRecipeCount);
  log(`  ${mealsTagged} MealDB recipes ingested`);

  log('Streaming RecipeNLG with cascade tagger...');
  const nlg = await ingestRecipeNLG(cuiPairCount, cuisineRecipeCount, tagSource);
  log(`  ${nlg.processed.toLocaleString()} recipes processed, ${nlg.tagged.toLocaleString()} tagged`);
  log(`  tag sources: title=${tagSource.title.toLocaleString()} url=${tagSource.url.toLocaleString()} signature=${tagSource.signature.toLocaleString()}`);

  log('Cross-referencing pairings.json for modelStrength...');
  const strengthIndex = buildStrengthIndex();
  log(`  ${strengthIndex.size.toLocaleString()} known pairings in model`);

  log('Aggregating per-pair evidence...');
  const pairs = aggregatePairs(cuiPairCount, cuisineRecipeCount, strengthIndex);
  const pairCount = Object.keys(pairs).length;
  const newCount = Object.values(pairs).filter((p) => p.modelStrength === null).length;
  log(`  ${pairCount.toLocaleString()} cuisine-anchored pairs retained (>=${MIN_PAIR_COUNT}x in one cuisine)`);
  log(`  ${newCount.toLocaleString()} pairs are NOT in the chemistry model (novelty=1.0)`);

  const output = {
    _meta: {
      generatedAt: new Date().toISOString(),
      corpus: `recipenlg=${nlg.tagged} + mealdb=${mealsTagged}`,
      cuisinesTagged: Object.keys(cuisineRecipeCount).length,
      totalRecipesTagged: Object.values(cuisineRecipeCount).reduce((s, n) => s + n, 0),
      taggingStrategy: 'cascade: title-keyword → url-hint → confident-signature',
      taggingPrecisionEstimate: 0.75,
      minPairCount: MIN_PAIR_COUNT,
      sigConfidenceGap: SIG_CONFIDENCE_GAP,
      stapleExclusion: [...STAPLES],
      pairCount,
      newPairCount: newCount,
      perCuisineRecipeCount: cuisineRecipeCount,
      tagSourceCounts: tagSource,
    },
    pairs,
  };
  writeJson(OUT_PATH, output);
  log(`  wrote ${OUT_PATH}`);

  // Also copy to public/proDataset for the running app to load.
  const publicPath = path.join(process.cwd(), 'public', 'proDataset', 'cuisine_pairings.json');
  writeJson(publicPath, output);
  log(`  copied to ${publicPath}`);

  log('=== done ===');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
