/**
 * 15-discover-cuisine-defining-ingredients.js
 *
 * Discovery pass — mines the same RecipeNLG + MealDB corpus that
 * 14-build-cuisine-pairings.js tagged, but instead of aggregating
 * PAIRS this script aggregates SINGLE INGREDIENT tokens per cuisine.
 *
 * Goal: surface ingredient names that are foundational in a specific
 * cuisine (gochujang for Korea, tahini for Middle East, hoisin for
 * China, harissa for North Africa, dashi for Japan, ...) but DO NOT
 * appear in our shipped ingredients.json. These are the next-target
 * ingredients to add to the live graph so under-represented cuisines
 * get the same depth as Italian / French / American.
 *
 * Pipeline:
 *   1. Same cascade cuisine tagger as 14- (title-keyword → URL →
 *      ingredient-signature naive Bayes). Tagger logic is INLINED
 *      from 14-build-cuisine-pairings.js to avoid changing the
 *      already-shipped script — the dup is intentional, see the
 *      "BORROWED FROM 14-" markers.
 *   2. For every tagged recipe, walk its synonym-normalized NER list
 *      and tally per-cuisine appearance count + recipe-bag-of-words.
 *   3. Cross-reference each candidate against the shipped
 *      ingredients.json keys. Drop anything already present (after
 *      synonym normalization, so "tahina"→"tahini" is dropped if
 *      tahini exists).
 *   4. Compute a "cuisine-defining" dominance score:
 *        dominance = primary.recipePct / max(secondary.recipePct, EPS)
 *      A score >= 3 means the ingredient is dramatically more common
 *      in its top cuisine than anywhere else.
 *   5. Output proDataset/output/missing_cuisine_ingredients.json with
 *      ranked candidates + evidence (per-cuisine count, recipePct,
 *      sample recipe titles).
 *
 * Output is a VETTED CANDIDATE LIST, not an automated graph mutation.
 * A separate step will curate the list, attach taste/category metadata,
 * back-compute pairings from the tagged corpus, and merge into
 * ingredients.json + pairings.json.
 *
 * Run time: ~20 minutes on a single CPU core (same as 14-).
 *   Memory: ~1.5GB peak (full per-token-per-cuisine count matrix).
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
const INGREDIENTS_PATH = path.join(OUTPUT_DIR, 'ingredients.json');
const OUT_PATH = path.join(OUTPUT_DIR, 'missing_cuisine_ingredients.json');

// Minimum recipe-count threshold for a candidate to be retained.
// Below this it's noise — even valid ingredients need broad evidence
// before we recommend adding them to the live graph.
const MIN_RECIPE_COUNT = 8;
// Dominance threshold — primary cuisine's recipePct must be at least
// this multiple of the second-place cuisine's recipePct.
const MIN_DOMINANCE = 2.5;
// Confidence floor for the signature classifier to count as a tag.
const SIG_CONFIDENCE_GAP = 2;
const MIN_INGS = 2;
const MAX_SAMPLE_TITLES = 5;

// ── Synonym map (BORROWED FROM 14-) ──
const SYN = JSON.parse(fs.readFileSync(SYN_PATH, 'utf8'));
function canon(s) {
  const n = String(s).toLowerCase().trim();
  return SYN[n] || n;
}

// ── CulinaryDB ingredient-signature prior (BORROWED FROM 14-) ──
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

// ── Title-keyword tagger (BORROWED FROM 14-) ──
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

// ── URL-path cuisine tagger (BORROWED FROM 14-) ──
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

function cascadeTag(title, link, ner) {
  const t = titleTag(title);
  if (t) return { cui: t, source: 'title' };
  const u = urlTag(link);
  if (u) return { cui: u, source: 'url' };
  const s = signatureClassify(ner);
  if (s && s.gap >= SIG_CONFIDENCE_GAP) return { cui: s.cui, source: 'signature' };
  return null;
}

// ── Streaming CSV parser (BORROWED FROM 14-) ──
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

// ── MealDB ingest — ground-truth tags + ingredient counts ──
function ingestMealDB(ingByCui, cuisineRecipeCount, ingSampleTitles) {
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
      const filtered = [...new Set(ings)];
      if (filtered.length < 2) continue;
      mealsTagged++;
      cuisineRecipeCount[cui] = (cuisineRecipeCount[cui] || 0) + 1;
      if (!ingByCui[cui]) ingByCui[cui] = {};
      for (const ing of filtered) {
        ingByCui[cui][ing] = (ingByCui[cui][ing] || 0) + 1;
        if (!ingSampleTitles[ing]) ingSampleTitles[ing] = [];
        if (ingSampleTitles[ing].length < MAX_SAMPLE_TITLES) {
          ingSampleTitles[ing].push(m.strMeal || '(untitled)');
        }
      }
    }
  }
  return mealsTagged;
}

// ── RecipeNLG streaming ingestion ──
async function ingestRecipeNLG(ingByCui, cuisineRecipeCount, tagSource, ingSampleTitles) {
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
    if (!ingByCui[tag.cui]) ingByCui[tag.cui] = {};
    for (const ing of rec.ner) {
      ingByCui[tag.cui][ing] = (ingByCui[tag.cui][ing] || 0) + 1;
      if (!ingSampleTitles[ing]) ingSampleTitles[ing] = [];
      if (ingSampleTitles[ing].length < MAX_SAMPLE_TITLES) {
        ingSampleTitles[ing].push(rec.title);
      }
    }
  }
  return { processed, tagged };
}

// ── Known-ingredient lookup ──
function loadKnownIngredients() {
  if (!fs.existsSync(INGREDIENTS_PATH)) {
    log(`  ⚠ ingredients.json missing at ${INGREDIENTS_PATH} — no candidates will be filtered.`);
    return new Set();
  }
  const data = JSON.parse(fs.readFileSync(INGREDIENTS_PATH, 'utf8'));
  const known = new Set();
  for (const name of Object.keys(data)) {
    if (name.startsWith('_')) continue;
    known.add(canon(name));
  }
  return known;
}

// ── Aggregate: per-ingredient evidence + dominance scoring ──
function aggregate(ingByCui, cuisineRecipeCount, knownIngredients, ingSampleTitles) {
  // Pivot: ingredient → { cuisine → count }
  const perIng = new Map();
  for (const [cui, ingCounts] of Object.entries(ingByCui)) {
    for (const [ing, count] of Object.entries(ingCounts)) {
      if (!perIng.has(ing)) perIng.set(ing, {});
      perIng.get(ing)[cui] = count;
    }
  }

  const out = [];
  for (const [ing, byCui] of perIng.entries()) {
    if (knownIngredients.has(ing)) continue;       // Already in graph — skip.

    const evidence = Object.entries(byCui).map(([cui, count]) => ({
      cuisine: cui,
      count,
      recipePct: +((count / (cuisineRecipeCount[cui] || 1)).toFixed(5)),
    })).sort((a, b) => b.recipePct - a.recipePct);

    const totalCount = evidence.reduce((s, e) => s + e.count, 0);
    if (totalCount < MIN_RECIPE_COUNT) continue;

    const primary = evidence[0];
    const secondary = evidence[1] || { recipePct: 0 };
    const EPS = 1e-6;
    const dominance = primary.recipePct / Math.max(secondary.recipePct, EPS);
    if (dominance < MIN_DOMINANCE) continue;

    out.push({
      ingredient: ing,
      primary: primary.cuisine,
      dominance: +dominance.toFixed(2),
      totalCount,
      evidence: evidence.slice(0, 5),                 // top-5 cuisines
      sampleTitles: ingSampleTitles[ing] || [],
    });
  }

  // Rank by dominance × log(totalCount) — favors strong cuisine signal +
  // sufficient corpus evidence. Pure dominance would surface noise
  // (a single-cuisine ingredient appearing 10× outranks one appearing
  // 500× across cuisines with 80% in the top); pure totalCount would
  // surface staples. Product is the natural balance.
  out.sort((a, b) =>
    (b.dominance * Math.log10(b.totalCount + 1)) -
    (a.dominance * Math.log10(a.totalCount + 1))
  );

  return out;
}

async function main() {
  log('=== 15: discover cuisine-defining ingredients ===');
  ensureDir(OUTPUT_DIR);

  const ingByCui = {};               // cuisine → { ingredient → count }
  const cuisineRecipeCount = {};     // cuisine → total tagged recipes
  const tagSource = { title: 0, url: 0, signature: 0 };
  const ingSampleTitles = {};        // ingredient → first N recipe titles

  log('Ingesting MealDB (ground-truth-tagged)...');
  const mealsTagged = ingestMealDB(ingByCui, cuisineRecipeCount, ingSampleTitles);
  log(`  ${mealsTagged} MealDB recipes ingested`);

  log('Streaming RecipeNLG with cascade tagger...');
  const nlg = await ingestRecipeNLG(ingByCui, cuisineRecipeCount, tagSource, ingSampleTitles);
  log(`  ${nlg.processed.toLocaleString()} recipes processed, ${nlg.tagged.toLocaleString()} tagged`);
  log(`  tag sources: title=${tagSource.title.toLocaleString()} url=${tagSource.url.toLocaleString()} signature=${tagSource.signature.toLocaleString()}`);

  log('Loading known ingredients from shipped ingredients.json...');
  const knownIngredients = loadKnownIngredients();
  log(`  ${knownIngredients.size.toLocaleString()} known ingredients (post-synonym normalization)`);

  log('Aggregating + scoring candidates...');
  const candidates = aggregate(ingByCui, cuisineRecipeCount, knownIngredients, ingSampleTitles);
  log(`  ${candidates.length.toLocaleString()} candidates above MIN_RECIPE_COUNT=${MIN_RECIPE_COUNT} and MIN_DOMINANCE=${MIN_DOMINANCE}`);

  const output = {
    _meta: {
      generatedAt: new Date().toISOString(),
      minRecipeCount: MIN_RECIPE_COUNT,
      minDominance: MIN_DOMINANCE,
      taggedRecipes: nlg.tagged + mealsTagged,
      cuisineRecipeCount,
      knownIngredients: knownIngredients.size,
    },
    candidates,
  };
  writeJson(OUT_PATH, output);
  log(`Wrote ${OUT_PATH}`);

  log('\nTop 20 candidates:');
  for (let i = 0; i < Math.min(20, candidates.length); i++) {
    const c = candidates[i];
    log(`  ${i + 1}. ${c.ingredient.padEnd(30)} ${c.primary.padEnd(22)} dom=${c.dominance.toFixed(2).padStart(6)}  n=${c.totalCount}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
