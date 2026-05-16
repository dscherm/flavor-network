#!/usr/bin/env node
/**
 * One-shot exploration script — NOT for shipping.
 * Tests cuisine-inference strategies on RecipeNLG and surfaces
 * under-represented-cuisine candidate ingredients.
 *
 * Streams the 2.2M-row recipenlg.csv with a custom quote-aware
 * parser. No external deps; ~60s end to end on Windows.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const RECIPENLG = path.join(ROOT, 'proDataset/raw/recipenlg.csv');
const MEALDB_DIR = path.join(ROOT, 'proDataset/raw/mealdb');
const SYN = JSON.parse(fs.readFileSync(path.join(ROOT, 'proDataset/data/synonyms.json'), 'utf8'));
const CDB = JSON.parse(fs.readFileSync(path.join(ROOT, 'proDataset/processed/culinarydb-cuisines.json'), 'utf8'));
const PAIRINGS = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/proDataset/pairings.json'), 'utf8'));
const ING = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/proDataset/ingredients.json'), 'utf8'));

const SAMPLE_LIMIT = Number(process.env.SAMPLE_LIMIT || 2_300_000);

// ── Synonym normalize ──
function canon(s) {
  const n = s.toLowerCase().trim();
  return SYN[n] || n;
}

// ── CulinaryDB prior — both USA-included and USA-excluded ──
function buildPrior(excludeCuisines = new Set()) {
  const ingByCui = {};
  const totalByCui = {};
  const vocab = new Set();
  for (const [ing, data] of Object.entries(CDB)) {
    if (ing.startsWith('_')) continue;
    const reg = data.byRegion;
    if (!reg) continue;
    vocab.add(ing);
    for (const [cui, n] of Object.entries(reg)) {
      if (excludeCuisines.has(cui)) continue;
      if (!ingByCui[cui]) ingByCui[cui] = {};
      ingByCui[cui][ing] = (ingByCui[cui][ing] || 0) + n;
      totalByCui[cui] = (totalByCui[cui] || 0) + n;
    }
  }
  const cuisines = Object.keys(ingByCui);
  const SMOOTH = 0.5;
  const V = vocab.size;
  const grandTotal = cuisines.reduce((s, c) => s + totalByCui[c], 0);
  function classify(ings) {
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
      lp: scored[0][1],
      gap: scored[0][1] - scored[1][1],
      top3: scored.slice(0, 3),
    };
  }
  return { classify, vocab, cuisines };
}

const PRIOR_ALL = buildPrior();
const PRIOR_NO_USA = buildPrior(new Set(['USA']));

// ── Title-keyword matcher with word boundaries + cuisine-stoplist ──
// CulinaryDB-aligned cuisine names.
const TITLE_RULES = [
  // [cuisine, keyword-array]
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
// Stop-list: keywords that often appear in non-cuisine contexts and
// should NOT match unless the title actually carries cuisine context.
const STOP_FALSE_FIRES = new Set([
  'jerky',     // "deer jerky", "beef jerky"
  'jerk off',
  'curry powder',  // generic spice — too many false positives for "Indian"
]);
// Word-boundary regex with custom escape (some keywords have spaces/special).
function wbRe(kw) {
  const esc = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // Require word boundary if keyword starts/ends with letter; otherwise loose.
  const startWB = /^[a-z]/.test(kw) ? '\\b' : '';
  const endWB = /[a-z]$/.test(kw) ? '\\b' : '';
  return new RegExp(startWB + esc + endWB, 'i');
}
const COMPILED_TITLE_RULES = TITLE_RULES.map(([cui, kws]) => [cui, kws.map(wbRe)]);
function titleTag(title) {
  const t = title.toLowerCase();
  // Stop-list takes precedence.
  for (const s of STOP_FALSE_FIRES) if (t.includes(s)) return null;
  for (const [cui, regs] of COMPILED_TITLE_RULES) {
    for (const r of regs) {
      if (r.test(t)) return cui;
    }
  }
  return null;
}

// ── Source-URL cuisine prior ──
// Pattern: many sites carry cuisine words in the URL path
// (/recipes/italian/, /food/asian/123). Extract host + path tokens.
const URL_CUISINE_HINTS = [
  [/\b(italian|tuscan|sicilian)\b/i, 'Italy'],
  [/\b(mexican|tex-mex|tex mex)\b/i, 'Mexico'],
  [/\b(french|parisien|provencal)\b/i, 'France'],
  [/\b(indian|indianfood|hindi)\b/i, 'Indian Subcontinent'],
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
  for (const [re, cui] of URL_CUISINE_HINTS) {
    if (re.test(link)) return cui;
  }
  return null;
}

// ── Streaming CSV parser ──
// Custom quote-aware tokenizer. RecipeNLG uses `""` as embedded quote.
function* csvRowsStream(filepath) {
  const stream = fs.createReadStream(filepath, { encoding: 'utf8', highWaterMark: 1 << 20 });
  let buf = '';
  let inQuote = false;
  for (const chunk of streamSync(stream)) {
    buf += chunk;
    let lastBoundary = 0;
    for (let i = 0; i < buf.length; i++) {
      const c = buf[i];
      if (c === '"') {
        // Handle doubled quote inside quoted field.
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
// Sync wrapper around an async readable.
function streamSync(stream) {
  // Use Symbol.asyncIterator via Node 18+ for-await emulation through
  // generator. We need a sync generator interface — Node provides
  // it through `stream[Symbol.asyncIterator]()`. We'll fall back to
  // accumulating sync via deasync-style trick: ride on resumeOn data.
  // Simpler: turn this into an async generator and adapt callers.
  return { [Symbol.iterator]() { return this; }, next() { return { done: true }; } };  // placeholder
}

// Easier: re-implement as async generator (no sync wrapper needed).
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
  if (!Array.isArray(ner)) return null;
  return { title, link, ner: ner.map(canon) };
}

// ── MealDB ground truth ──
function loadMealDB() {
  const out = [];
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
  for (const f of fs.readdirSync(MEALDB_DIR)) {
    const d = JSON.parse(fs.readFileSync(path.join(MEALDB_DIR, f), 'utf8'));
    for (const m of d.meals || []) {
      const truth = AREA_TO_CUI[m.strArea];
      if (!truth) continue;
      const ings = [];
      for (let i = 1; i <= 20; i++) {
        const v = m['strIngredient' + i];
        if (v && v.trim()) ings.push(canon(v));
      }
      out.push({ title: m.strMeal.toLowerCase(), ner: [...new Set(ings)], truth });
    }
  }
  return out;
}

// ── TEST 1+3: precision tests on MealDB ground truth ──
function evalOnMealDB() {
  const truths = loadMealDB();
  const counts = {
    title: { total: 0, correct: 0 },
    sig_all: { total: 0, correct: 0, confTotal: 0, confCorrect: 0 },
    sig_noUSA: { total: 0, correct: 0, confTotal: 0, confCorrect: 0 },
    url: { total: 0, correct: 0 },
    cascade: { total: 0, correct: 0 },
    fusion: { total: 0, correct: 0 },
  };
  const conf = { sig_all: {}, sig_noUSA: {} };
  for (const r of truths) {
    // Title
    const t = titleTag(r.title);
    if (t) {
      counts.title.total++;
      if (t === r.truth) counts.title.correct++;
    }
    // Signature (all-cuisines prior)
    const s = PRIOR_ALL.classify(r.ner);
    if (s) {
      counts.sig_all.total++;
      if (s.cui === r.truth) counts.sig_all.correct++;
      if (s.gap > 2) {
        counts.sig_all.confTotal++;
        if (s.cui === r.truth) counts.sig_all.confCorrect++;
      }
      const key = r.truth + ' → ' + s.cui;
      conf.sig_all[key] = (conf.sig_all[key] || 0) + 1;
    }
    // Signature (no-USA prior)
    const s2 = PRIOR_NO_USA.classify(r.ner);
    if (s2 && r.truth !== 'USA') {  // skip USA truths for fair compare
      counts.sig_noUSA.total++;
      if (s2.cui === r.truth) counts.sig_noUSA.correct++;
      if (s2.gap > 2) {
        counts.sig_noUSA.confTotal++;
        if (s2.cui === r.truth) counts.sig_noUSA.confCorrect++;
      }
      const key = r.truth + ' → ' + s2.cui;
      conf.sig_noUSA[key] = (conf.sig_noUSA[key] || 0) + 1;
    }
    // Cascade: title → confident-signature
    const cascade = t || (s && s.gap > 2 ? s.cui : null);
    if (cascade) {
      counts.cascade.total++;
      if (cascade === r.truth) counts.cascade.correct++;
    }
    // Fusion: title is high-confidence; otherwise top-signature.
    const fusion = t || (s ? s.cui : null);
    if (fusion) {
      counts.fusion.total++;
      if (fusion === r.truth) counts.fusion.correct++;
    }
  }
  return { counts, conf, truths };
}

// ── TEST 4 (main pass): stream RecipeNLG and aggregate ──
async function streamRecipeNLG() {
  const tagged = {
    title: 0, url: 0, sig_conf: 0, sig_any: 0,
    union: 0, total: 0,
  };
  const cuisineUnionCount = {};
  // For under-represented investigation: ingredient frequencies seen
  // per cuisine in RecipeNLG (any-strategy tagged).
  const cuiIngCount = {};  // cui -> {ing -> count}
  // For pair-level evidence (sample only — full bookkeeping is heavy):
  // cui -> {pair_key -> count}, ignoring top-30 staples.
  const byCount = Object.entries(ING).map(([n, v]) => [n, v.totalCount || 0]).sort((a, b) => b[1] - a[1]);
  const EXCLUDE = new Set(byCount.slice(0, 30).map(([n]) => n));
  ['water', 'salt', 'pepper', 'black pepper', 'ice', 'oil'].forEach((x) => EXCLUDE.add(x));
  const cuiPairCount = {};

  // Strength lookup for cross-ref later.
  const STRENGTH = new Map();
  for (const p of PAIRINGS) {
    const a = canon(p.ingredientA), b = canon(p.ingredientB);
    const k = a < b ? a + '|' + b : b + '|' + a;
    STRENGTH.set(k, { strength: p.strength, tradition: p.tradition });
  }

  let row = 0;
  let header = true;
  for await (const r of csvRows(RECIPENLG)) {
    if (header) { header = false; continue; }
    if (row >= SAMPLE_LIMIT) break;
    row++;
    if (row % 100_000 === 0) console.error('  ...' + row + ' rows');
    const rec = parseRow(r);
    if (!rec) continue;
    tagged.total++;
    const titleC = titleTag(rec.title);
    const urlC = urlTag(rec.link);
    const sigC = PRIOR_ALL.classify(rec.ner);
    if (titleC) tagged.title++;
    if (urlC) tagged.url++;
    if (sigC) {
      tagged.sig_any++;
      if (sigC.gap > 2) tagged.sig_conf++;
    }
    // Union: any signal fires.
    const finalCui = titleC || urlC || (sigC && sigC.gap > 2 ? sigC.cui : null);
    if (!finalCui) continue;
    tagged.union++;
    cuisineUnionCount[finalCui] = (cuisineUnionCount[finalCui] || 0) + 1;

    // Aggregate per-cuisine ingredient frequencies.
    if (!cuiIngCount[finalCui]) cuiIngCount[finalCui] = {};
    const seen = new Set();
    for (const ing of rec.ner) {
      if (seen.has(ing)) continue;
      seen.add(ing);
      cuiIngCount[finalCui][ing] = (cuiIngCount[finalCui][ing] || 0) + 1;
    }

    // Per-cuisine pair count (staples excluded).
    const filtered = [...seen].filter((x) => !EXCLUDE.has(x));
    if (!cuiPairCount[finalCui]) cuiPairCount[finalCui] = {};
    for (let i = 0; i < filtered.length; i++) {
      for (let j = i + 1; j < filtered.length; j++) {
        const a = filtered[i], b = filtered[j];
        const k = a < b ? a + '|' + b : b + '|' + a;
        cuiPairCount[finalCui][k] = (cuiPairCount[finalCui][k] || 0) + 1;
      }
    }
  }
  return { tagged, cuisineUnionCount, cuiIngCount, cuiPairCount, STRENGTH };
}

// ── Run ──
console.log('=== TEST 2+3: MealDB ground-truth evaluation ===');
const { counts, conf, truths } = evalOnMealDB();
console.log('total MealDB recipes:', truths.length);
console.log('\nPer-strategy precision (tagged-recipe basis):');
for (const [k, c] of Object.entries(counts)) {
  const acc = c.total ? Math.round((100 * c.correct) / c.total) : 0;
  let line = '  ' + k.padEnd(14) + 'tagged=' + String(c.total).padStart(4) + ' correct=' + String(c.correct).padStart(4) + ' (' + acc + '%)';
  if (c.confTotal !== undefined) {
    const cAcc = c.confTotal ? Math.round((100 * c.confCorrect) / c.confTotal) : 0;
    line += '  | confident only: ' + c.confCorrect + '/' + c.confTotal + ' (' + cAcc + '%)';
  }
  console.log(line);
}
console.log('\nTop sig_all errors (truth → predicted):');
const errs = Object.entries(conf.sig_all)
  .filter(([k]) => k.split(' → ')[0] !== k.split(' → ')[1])
  .sort((a, b) => b[1] - a[1]).slice(0, 8);
for (const [k, n] of errs) console.log('  ' + String(n).padStart(3) + '  ' + k);
console.log('\nTop sig_noUSA errors (truth → predicted):');
const errs2 = Object.entries(conf.sig_noUSA)
  .filter(([k]) => k.split(' → ')[0] !== k.split(' → ')[1])
  .sort((a, b) => b[1] - a[1]).slice(0, 8);
for (const [k, n] of errs2) console.log('  ' + String(n).padStart(3) + '  ' + k);

console.log('\n=== TEST 1+4: streaming RecipeNLG (limit=' + SAMPLE_LIMIT.toLocaleString() + ') ===');
console.time('stream');
const { tagged, cuisineUnionCount, cuiIngCount, cuiPairCount, STRENGTH } = await streamRecipeNLG();
console.timeEnd('stream');

console.log('\nRecipes processed:', tagged.total.toLocaleString());
console.log('Tagged-by-strategy:');
const pct = (n) => Math.round((100 * n) / tagged.total) + '%';
console.log('  title-keyword          :', tagged.title.toLocaleString(), '(' + pct(tagged.title) + ')');
console.log('  url-cuisine-hint       :', tagged.url.toLocaleString(), '(' + pct(tagged.url) + ')');
console.log('  signature (any)        :', tagged.sig_any.toLocaleString(), '(' + pct(tagged.sig_any) + ')');
console.log('  signature (confident)  :', tagged.sig_conf.toLocaleString(), '(' + pct(tagged.sig_conf) + ')');
console.log('  UNION (any signal)     :', tagged.union.toLocaleString(), '(' + pct(tagged.union) + ')');

console.log('\nUnion-tagged recipes per cuisine:');
const sortedCui = Object.entries(cuisineUnionCount).sort((a, b) => b[1] - a[1]);
for (const [c, n] of sortedCui) console.log('  ' + c.padEnd(24) + n.toLocaleString().padStart(8));

console.log('\n=== Investigation 5: candidate NEW ingredients for under-represented cuisines ===');
// Per-cuisine known-ingredient set in CulinaryDB.
const culinaryDBPerCuiIngCount = {};
for (const [ing, data] of Object.entries(CDB)) {
  if (ing.startsWith('_')) continue;
  const reg = data.byRegion;
  if (!reg) continue;
  for (const [cui] of Object.entries(reg)) {
    if (!culinaryDBPerCuiIngCount[cui]) culinaryDBPerCuiIngCount[cui] = new Set();
    culinaryDBPerCuiIngCount[cui].add(ing);
  }
}
// Per-cuisine known-ingredient set in the SHIPPED ingredients.json
// (this is what the app surfaces today — the "in-app coverage" floor).
const shippedPerCuiIngCount = {};
for (const [ing, data] of Object.entries(ING)) {
  const cuis = data.cuisines || [];
  for (const c of cuis) {
    const norm = c.toLowerCase();
    if (!shippedPerCuiIngCount[norm]) shippedPerCuiIngCount[norm] = new Set();
    shippedPerCuiIngCount[norm].add(ing);
  }
}
// Define under-represented = small ingredient count in shipped data.
// Use the SHIPPED count because that's what the user sees.
const SHIPPED_TO_CDB = {  // ingredients.json cuisine label → CulinaryDB cuisine label
  usa: 'USA', italy: 'Italy', france: 'France', mexico: 'Mexico',
  'indian subcontinent': 'Indian Subcontinent', china: 'China',
  thailand: 'Thailand', japan: 'Japan', greece: 'Greece', spain: 'Spain',
  korea: 'Korea', 'south east asia': 'South East Asia',
  'middle east': 'Middle East', caribbean: 'Caribbean',
  'british isles': 'British Isles', africa: 'Africa',
  canada: 'Canada', scandinavia: 'Scandinavia',
  'eastern europe': 'Eastern Europe', 'south america': 'South America',
  'australia & nz': 'Australia & NZ', 'dach countries': 'DACH Countries',
};
const underrep = Object.entries(shippedPerCuiIngCount)
  .map(([c, set]) => ({
    shippedName: c,
    cdbName: SHIPPED_TO_CDB[c] || null,
    shippedIngs: set.size,
    cdbIngs: SHIPPED_TO_CDB[c] && culinaryDBPerCuiIngCount[SHIPPED_TO_CDB[c]]
      ? culinaryDBPerCuiIngCount[SHIPPED_TO_CDB[c]].size : 0,
  }))
  .filter((r) => r.cdbName && r.shippedIngs < 100)
  .sort((a, b) => a.shippedIngs - b.shippedIngs);
console.log('Under-represented cuisines (< 100 ingredients in shipped ingredients.json):');
console.log('  cuisine                 shipped  CulinaryDB');
for (const r of underrep) {
  console.log('  ' + r.shippedName.padEnd(24) + String(r.shippedIngs).padStart(7) + '  ' + String(r.cdbIngs).padStart(10));
}

// Universal staples — drop these from "candidate new ingredient" lists
// because they're universally used and not cuisine-distinguishing.
// Reuse the EXCLUDE set built earlier inside streamRecipeNLG.
const STAPLES = new Set([
  'sugar', 'egg', 'onion', 'butter', 'flour', 'garlic', 'milk', 'vanilla',
  'olive oil', 'tomato', 'brown sugar', 'cinnamon', 'chicken', 'baking powder',
  'lemon juice', 'vegetable oil', 'celery', 'parsley', 'sour cream', 'cream cheese',
  'baking soda', 'scallion', 'carrot', 'cream', 'cheddar', 'parmesan', 'mustard',
  'mayonnaise', 'lemon', 'potato', 'water', 'salt', 'pepper', 'black pepper',
  'ice', 'oil', 'warm water', 'all-purpose', 'all-purpose flour',
]);

console.log('\nFor each under-represented cuisine, ingredients that appear ≥20× in RecipeNLG-tagged recipes but are NOT in the shipped ingredients.json AND not a universal staple:');
for (const r of underrep) {
  const knownSet = shippedPerCuiIngCount[r.shippedName] || new Set();
  const rec = cuiIngCount[r.cdbName];
  if (!rec) { console.log('\n[' + r.shippedName + '] no RecipeNLG tagged recipes — skipping'); continue; }
  const total = cuisineUnionCount[r.cdbName] || 0;
  const newIngs = Object.entries(rec)
    .filter(([ing, n]) => n >= 20 && !knownSet.has(ing) && !STAPLES.has(ing))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12);
  console.log('\n[' + r.shippedName + '] (' + total + ' tagged recipes) candidate NEW cuisine-distinguishing ingredients:');
  for (const [ing, n] of newIngs) {
    const pctOfRecipes = total ? Math.round((100 * n) / total) : 0;
    console.log('  ' + String(n).padStart(5) + 'x (' + String(pctOfRecipes).padStart(2) + '% of cuisine)  ' + ing);
  }
}

console.log('\n=== Top 10 "out-of-the-box" pairs per under-rep cuisine (RecipeNLG-scale) ===');
for (const r of underrep) {
  const pairs = cuiPairCount[r.cdbName];
  if (!pairs) continue;
  const ranked = Object.entries(pairs)
    .filter(([, n]) => n >= 5)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);
  if (ranked.length === 0) continue;
  console.log('\n[' + r.shippedName + ']');
  for (const [k, n] of ranked) {
    const rec = STRENGTH.get(k);
    const note = rec ? ('model s=' + rec.strength.toFixed(2)) : 'NOT in model';
    console.log('  ' + String(n).padStart(5) + 'x  ' + k.replace('|', ' + ').padEnd(40) + '  ' + note);
  }
}

console.log('\n— end of exploration —');
