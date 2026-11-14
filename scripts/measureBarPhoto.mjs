#!/usr/bin/env node
/**
 * measureBarPhoto.mjs — accuracy test for "fill My bar from a photo".
 *
 * Sends each photo in a folder to Gemini (the model and call shape of
 * src/api/recipeImport.js), asks for the bottles it can see, and maps each
 * one to a My bar key the way the app would (barKey + isBooze, myBar.js).
 * With a truth file it scores the result; without one it prints what it
 * found, ready to be corrected into a truth file.
 *
 * Photos leave this machine: they are sent to the Gemini API under the
 * GEMINI_API_KEY in .env. Nothing else is uploaded.
 *
 * --kitchen does the same for the shared kitchen list (myKitchen.js): food
 * in a photo of a fridge, pantry shelf, spice rack, groceries or a receipt,
 * mapped with kitchenKey. Each item says whether it was read off a label
 * or recognised by look.
 *
 * Usage:
 *   node scripts/measureBarPhoto.mjs [dir]            (default .cache/bar-photos)
 *   node scripts/measureBarPhoto.mjs --kitchen [dir]  (default .cache/kitchen-photos)
 *   node scripts/measureBarPhoto.mjs [dir] --json
 *   node scripts/measureBarPhoto.mjs [dir] --fresh    (ask again for photos already answered)
 *
 * Answers are kept in <dir>/results.json and reused, so a second run only
 * asks for new photos and ones that failed; scoring is always redone.
 *
 * Truth file: <dir>/truth.json
 *   { "shelf1.jpg": ["bourbon", "campari", "sweet vermouth"], ... }
 * Entries are free text; they go through barKey like a typed bar entry.
 *
 * Scores, per photo and overall:
 *   exact   — the same bar key
 *   family  — a base spirit of the same family counts (rye for bourbon),
 *             which is how My bar already covers a recipe line
 */
import 'dotenv/config';
import { readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pub = (p) => path.join(ROOT, 'public', p);
const src = (p) => pathToFileURL(path.join(ROOT, 'src', p)).href;
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));

const args = process.argv.slice(2);
const asJson = args.includes('--json');
const fresh = args.includes('--fresh');
const kitchen = args.includes('--kitchen');
const dir = path.resolve(ROOT, args.find((a) => !a.startsWith('--')) || (kitchen ? '.cache/kitchen-photos' : '.cache/bar-photos'));

const MODEL_NAME = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const TIMEOUT_MS = 60_000;
const RETRIES = 4;          // a 503 ("high demand") or 429 is retried
const RETRY_WAIT_MS = 8_000; // × attempt number
const MIME = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.heic': 'image/heic', '.heif': 'image/heif' };

const { barKey, isBooze, barKeyLists } = await import(src('data/myBar.js'));
const { familyKey, roleOf } = await import(src('data/cocktailRiff.js'));
const { kitchenKey, isBasic, isSpiceRackItem } = await import(src('data/myKitchen.js'));

const names = new Set(Object.keys(readJson(pub('proDataset/ingredients.json'))));
const roles = readJson(pub('data/cocktail_roles.json'));
const codex = readJson(pub('data/cocktail_codex_v2.json'));

// The bottles the cocktail list knows: every booze key any recipe uses,
// most used first. The model is asked to answer in these words when it can.
const counts = new Map();
for (const keys of barKeyLists(codex.cocktails, roles, names)) {
  for (const k of new Set(keys)) if (isBooze(k, roles)) counts.set(k, (counts.get(k) || 0) + 1);
}
const vocab = [...counts].sort((a, b) => b[1] - a[1]).map(([k]) => k);
const vocabSet = new Set(vocab);

const RESPONSE_SCHEMA = {
  type: SchemaType.OBJECT,
  properties: {
    bottles: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          label: { type: SchemaType.STRING },
          type: { type: SchemaType.STRING },
          key: { type: SchemaType.STRING },
          confidence: { type: SchemaType.STRING, enum: ['high', 'medium', 'low'] },
        },
        required: ['label', 'type', 'key', 'confidence'],
      },
    },
    other: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
  },
  required: ['bottles', 'other'],
};

const SYSTEM_PROMPT = `You look at a photo of someone's home bar and list the bottles of alcohol in it, for a cocktail app.

For each distinct bottle you can identify:
- "label": what the label says (brand and expression), e.g. "Maker's Mark", "Carpano Antica Formula".
- "type": the generic kind of drink, lower case, e.g. "bourbon", "london dry gin", "sweet vermouth", "orange liqueur", "aromatic bitters".
- "key": the ONE entry from the app's list below that this bottle counts as (copy it exactly), or "" when nothing on the list fits.
- "confidence": "high" when you can read the label, "medium" when you recognise the bottle but cannot read it, "low" when you are guessing from shape or colour.

Rules:
- One entry per distinct product. Two bottles of the same product are one entry.
- Never invent a bottle. A bottle you cannot identify at all is left out.
- Alcohol only in "bottles". Mixers, juices, syrups, fruit and tools go in "other" as short lower-case names (e.g. "tonic water", "lime").
- Output only the JSON object.

The app's list:
${vocab.join(', ')}`;

const KITCHEN_SCHEMA = {
  type: SchemaType.OBJECT,
  properties: {
    bottles: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          label: { type: SchemaType.STRING },
          type: { type: SchemaType.STRING },
          basis: { type: SchemaType.STRING, enum: ['label', 'look'] },
          confidence: { type: SchemaType.STRING, enum: ['high', 'medium', 'low'] },
        },
        required: ['label', 'type', 'basis', 'confidence'],
      },
    },
    other: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
  },
  required: ['bottles', 'other'],
};

const KITCHEN_PROMPT = `You look at a photo from someone's kitchen (a fridge, a pantry shelf, a spice rack, groceries on a counter, or a grocery receipt) and list the food in it, for a cooking app. The list goes in "bottles".

For each distinct food you can identify:
- "label": what you see: the words on the package or receipt line, or a short description for unpackaged food, e.g. "Rao's Marinara", "ORG BNLS CHKN TH", "bunch of green herbs".
- "type": the plain cooking ingredient, lower case, singular, no brand, e.g. "tomato sauce", "chicken thigh", "cilantro", "greek yogurt", "smoked paprika".
- "basis": "label" when you read it from printed words, "look" when you recognised it by appearance.
- "confidence": "high" when you are sure, "medium" when it is probably that, "low" when you are guessing.

Rules:
- One entry per distinct ingredient. Three onions are one entry.
- Never invent food. Something you cannot identify (an opaque container, an unlabelled jar) is left out.
- At most 40 entries.
- Things that are not food (dishes, appliances, cleaning products) go in "other".
- Output only the JSON object.`;

function withTimeout(promise, ms, label) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    promise.then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
  });
}

async function ask(parts) {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await withTimeout(model.generateContent({ contents: [{ role: 'user', parts }] }), TIMEOUT_MS, 'gemini');
    } catch (err) {
      // A used-up daily quota does not come back in seconds: do not retry it.
      if (/per day|free_tier/i.test(err.message)) throw err;
      if (attempt > RETRIES || !/(503|429)/.test(err.message)) throw err;
      await new Promise((r) => setTimeout(r, RETRY_WAIT_MS * attempt));
    }
  }
}

/** The bar key the app would store for one detected bottle ('' = not a bar item). */
function keyFor(bottle) {
  if (kitchen) return kitchenKey(bottle.type, names) || '';
  if (vocabSet.has(bottle.key)) return bottle.key;
  const k = barKey(bottle.type, names);
  return k && isBooze(k, roles) ? k : '';
}

const isBase = (k) => roleOf(k, roles) === 'spirit';
const sameFamily = (a, b) => a === b || (isBase(a) && isBase(b) && familyKey(a) === familyKey(b));

/** found / truth are key arrays; `match` decides whether two keys agree. */
function score(found, truth, match) {
  const left = [...truth];
  let hit = 0;
  const wrong = [];
  for (const f of found) {
    const i = left.findIndex((t) => match(f, t));
    if (i >= 0) { hit += 1; left.splice(i, 1); } else wrong.push(f);
  }
  return { hit, wrong, missed: left };
}

if (!process.env.GEMINI_API_KEY) {
  console.error('GEMINI_API_KEY is not set. See .env.example.');
  process.exit(1);
}
if (!existsSync(dir)) {
  console.error(`No folder ${dir}. Put bar photos there (jpg, png, webp, heic).`);
  process.exit(1);
}
const photos = readdirSync(dir).filter((f) => MIME[path.extname(f).toLowerCase()]).sort();
if (photos.length === 0) {
  console.error(`No photos in ${dir} (jpg, png, webp, heic).`);
  process.exit(1);
}
const truthPath = path.join(dir, 'truth.json');
const truth = existsSync(truthPath) ? readJson(truthPath) : null;

const model = new GoogleGenerativeAI(process.env.GEMINI_API_KEY).getGenerativeModel({
  model: MODEL_NAME,
  systemInstruction: kitchen ? KITCHEN_PROMPT : SYSTEM_PROMPT,
  generationConfig: {
    temperature: 0.1,
    maxOutputTokens: 8192,
    responseMimeType: 'application/json',
    responseSchema: kitchen ? KITCHEN_SCHEMA : RESPONSE_SCHEMA,
    thinkingConfig: { thinkingBudget: 0 },
  },
});

const resultsPath = path.join(dir, 'results.json');
const previous = new Map();
if (!fresh && existsSync(resultsPath)) {
  const old = readJson(resultsPath);
  if (old.model === MODEL_NAME && !!old.kitchen === kitchen) for (const r of old.rows || []) if (!r.error) previous.set(r.file, r);
}

const rows = [];
for (const file of photos) {
  const buffer = readFileSync(path.join(dir, file));
  const parts = [
    { text: kitchen ? 'List the food in this kitchen photo.' : 'List the bottles in this photo of a home bar.' },
    { inlineData: { mimeType: MIME[path.extname(file).toLowerCase()], data: buffer.toString('base64') } },
  ];
  const row = { file, kb: Math.round(buffer.length / 1024) };
  const t0 = Date.now();
  const kept = previous.get(file);
  if (kept) {
    Object.assign(row, { ms: kept.ms, tokens: kept.tokens, bottles: kept.bottles, other: kept.other, found: kept.found, unmapped: kept.unmapped });
  } else try {
    const result = await ask(parts);
    const parsed = JSON.parse(result.response.text());
    const usage = result.response.usageMetadata || {};
    row.ms = Date.now() - t0;
    row.tokens = { in: usage.promptTokenCount ?? null, out: usage.candidatesTokenCount ?? null };
    row.bottles = (parsed.bottles || []).map((b) => ({ ...b, barKey: keyFor(b) }));
    row.other = parsed.other || [];
    row.found = [...new Set(row.bottles.map((b) => b.barKey).filter(Boolean))];
    row.unmapped = row.bottles.filter((b) => !b.barKey).map((b) => `${b.label} (${b.type})`);
  } catch (err) {
    row.ms = Date.now() - t0;
    row.error = err.message;
  }
  if (truth?.[file] && !row.error) {
    row.truth = [...new Set(truth[file].map((t) => (kitchen ? kitchenKey(t, names) : barKey(t, names))).filter(Boolean))];
    row.exact = score(row.found, row.truth, (a, b) => a === b);
    row.family = score(row.found, row.truth, kitchen ? (a, b) => a === b : sameFamily);
  }
  rows.push(row);
  if (!asJson) {
    console.log(`\n${file}  (${row.kb} KB, ${row.ms} ms${row.tokens ? `, ${row.tokens.in} in / ${row.tokens.out} out tokens` : ''})`);
    if (row.error) { console.log(`  FAILED: ${row.error}`); continue; }
    for (const b of row.bottles) {
      const note = kitchen ? `${b.basis.padEnd(5)} ` : '';
      const assumed = kitchen && b.barKey && (isBasic(b.barKey) || isSpiceRackItem(b.barKey)) ? '  (basic / spice rack)' : '';
      console.log(`  ${b.confidence.padEnd(6)} ${note}${b.label}  [${b.type}]  ->  ${b.barKey || '(no key)'}${assumed}`);
    }
    if (row.other.length) console.log(`  other: ${row.other.join(', ')}`);
    if (row.exact) {
      console.log(`  exact : ${row.exact.hit}/${row.truth.length} found, ${row.exact.wrong.length} wrong${row.exact.wrong.length ? ` (${row.exact.wrong.join(', ')})` : ''}, missed: ${row.exact.missed.join(', ') || 'none'}`);
      console.log(`  family: ${row.family.hit}/${row.truth.length} found, ${row.family.wrong.length} wrong, missed: ${row.family.missed.join(', ') || 'none'}`);
    }
  }
}

const scored = rows.filter((r) => r.exact);
const total = (pick) => scored.reduce((n, r) => n + pick(r), 0);
const summary = scored.length ? {
  photos: scored.length,
  bottles: total((r) => r.truth.length),
  found: total((r) => r.found.length),
  exact: { recall: total((r) => r.exact.hit) / total((r) => r.truth.length), precision: total((r) => r.exact.hit) / Math.max(1, total((r) => r.found.length)) },
  family: { recall: total((r) => r.family.hit) / total((r) => r.truth.length), precision: total((r) => r.family.hit) / Math.max(1, total((r) => r.found.length)) },
} : null;

writeFileSync(resultsPath, JSON.stringify({ model: MODEL_NAME, kitchen, vocab: vocab.length, summary, rows }, null, 2));

if (asJson) {
  console.log(JSON.stringify({ model: MODEL_NAME, summary, rows }, null, 2));
} else {
  const pct = (x) => `${Math.round(x * 100)}%`;
  console.log(`\nModel ${MODEL_NAME}; ${kitchen ? 'kitchen mode' : `app list of ${vocab.length} bottles`}; ${rows.length} photo(s), ${rows.filter((r) => r.error).length} failed.`);
  if (summary) {
    console.log(`Scored ${summary.photos} photo(s), ${summary.bottles} bottles in the truth file, ${summary.found} reported.`);
    console.log(`  exact : found ${pct(summary.exact.recall)} of the bottles; ${pct(summary.exact.precision)} of what it reported was right`);
    console.log(`  family: found ${pct(summary.family.recall)} of the bottles; ${pct(summary.family.precision)} of what it reported was right`);
  } else {
    console.log(`No truth file (${truthPath}); nothing scored.`);
  }
  console.log(`Details: ${resultsPath}`);
}
