/**
 * Audit the recipe set-completion suggestions for the "staple collapse"
 * (every suggestion = salt/sugar/flour). Tests three levers on a real pad-thai
 * bowl: (1) cuisine conditioning, (2) contrastive popularity discount
 * score = logit(i|observed) - alpha*logit(i|baseline), (3) both.
 * Run: node flavor-gnn/scripts/fm_p2_suggest_audit.mjs
 */
import * as ort from 'onnxruntime-node';
import { readFileSync } from 'node:fs';

const meta = JSON.parse(readFileSync('public/models/recipe_vocab.json', 'utf8'));
const VOCAB = meta.vocab;
const VIDX = new Map(VOCAB.map((n, i) => [n.toLowerCase(), i]));
const HEADS = meta.heads;
const i64 = (a) => BigInt64Array.from(a.map((x) => BigInt(Math.trunc(x))));

function feeds(observedNames, cuisineName) {
  const obsIds = observedNames.map((n) => VIDX.get(n.toLowerCase())).filter((x) => x != null);
  const ids = new Array(meta.maxlen).fill(meta.pad_id);
  const mask = new Array(meta.maxlen).fill(0);
  for (let j = 0; j < Math.min(obsIds.length, meta.maxlen); j++) { ids[j] = obsIds[j]; mask[j] = 1; }
  const ci = cuisineName ? meta.cuisine_vocab.indexOf(cuisineName) : -1;
  return {
    feed: {
      obs_ids: new ort.Tensor('int64', i64(ids), [1, meta.maxlen]),
      obs_mask: new ort.Tensor('float32', Float32Array.from(mask), [1, meta.maxlen]),
      profile: new ort.Tensor('float32', Float32Array.from(new Array(HEADS.length).fill(0)), [1, HEADS.length]),
      cuisine: new ort.Tensor('int64', i64([ci >= 0 ? ci : meta.cuisine_null]), [1]),
      season: new ort.Tensor('int64', i64([meta.season_null]), [1]),
    },
    obsIds,
  };
}
const topK = (scores, exclude, k = 12) => {
  const ex = new Set(exclude);
  const idx = [];
  for (let i = 0; i < scores.length; i++) if (!ex.has(i)) idx.push(i);
  idx.sort((a, b) => scores[b] - scores[a]);
  return idx.slice(0, k).map((i) => VOCAB[i]);
};

async function main() {
  const session = await ort.InferenceSession.create('public/models/recipe-setcompletion.onnx');
  const bowl = ['rice noodle', 'fish sauce', 'tamarind', 'peanut', 'bean sprout', 'egg', 'lime', 'garlic', 'shallot', 'tofu'];

  // baseline: empty observed, zero profile, cuisine_null — the unconditional prior
  const baseOut = await session.run(feeds([], null).feed);
  const baseLogits = baseOut.logits.data;

  const run = async (observed, cuisine, label) => {
    const { feed, obsIds } = feeds(observed, cuisine);
    const out = await session.run(feed);
    const lg = out.logits.data;
    console.log(`\n[${label}] observed=${observed.join(',')} cuisine=${cuisine || 'none'}`);
    console.log('  raw argmax   :', topK(lg, obsIds, 12).join(', '));
    for (const a of [0.5, 1.0]) {
      const sc = new Float64Array(lg.length);
      for (let i = 0; i < lg.length; i++) sc[i] = lg[i] - a * baseLogits[i];
      console.log(`  discount a=${a}:`, topK(sc, obsIds, 12).join(', '));
    }
  };

  console.log('=== FULL BOWL (add suggestions) ===');
  await run(bowl, null, 'no cuisine');
  await run(bowl, 'Thai', 'Thai cuisine');

  console.log('\n=== REPLACE rice noodle (observed = bowl minus rice noodle) ===');
  const minus = bowl.filter((x) => x !== 'rice noodle');
  await run(minus, 'Thai', 'Thai, replace noodle');

  // FINAL-CONFIG validation: cuisine + mild discount, and category-pool replace.
  const ing = JSON.parse(readFileSync('public/proDataset/ingredients.json', 'utf8'));
  const focalCat = ing['rice noodle']?.category;
  const pool = Object.keys(ing).filter((n) => ing[n]?.category === focalCat && VIDX.has(n.toLowerCase()));
  const poolIds = new Set(pool.map((n) => VIDX.get(n.toLowerCase())));
  console.log(`\n=== FINAL: same-category replace pool (cat=${focalCat}, ${pool.length} items) ===`);
  const { feed, obsIds } = feeds(minus, 'Thai');
  const lg = (await session.run(feed)).logits.data;
  for (const a of [0, 0.3]) {
    const sc = new Float64Array(lg.length);
    for (let i = 0; i < lg.length; i++) sc[i] = lg[i] - a * baseLogits[i];
    const ranked = [...poolIds].filter((i) => !obsIds.includes(i)).sort((x, y) => sc[y] - sc[x]).slice(0, 12).map((i) => VOCAB[i]);
    console.log(`  category-pool a=${a}:`, ranked.join(', '));
  }
  // add (full vocab) with mild discount
  console.log('\n=== FINAL: add with Thai + a=0.3 ===');
  const fb = feeds(bowl, 'Thai');
  const flg = (await session.run(fb.feed)).logits.data;
  const sc = new Float64Array(flg.length);
  for (let i = 0; i < flg.length; i++) sc[i] = flg[i] - 0.3 * baseLogits[i];
  console.log('  ', topK(sc, fb.obsIds, 14).join(', '));
}
main().catch((e) => { console.error(e); process.exit(1); });
