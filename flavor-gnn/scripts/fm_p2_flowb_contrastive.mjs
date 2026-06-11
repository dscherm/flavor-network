/**
 * FM-P2 Flow-B contrastive-decoding experiment.
 *
 * Flow B = "generate a recipe from a target flavor profile ALONE" (no seed
 * ingredients). The demo found it collapses to staples (salt/egg/sugar/
 * butter/flour) regardless of profile, because the model's unconditional
 * prior dominates when there are no observed ingredients.
 *
 * Lever under test (feasibility doc §10 lever #1, "popularity discounting"):
 * contrastive decoding. Score(i|P) = logit(i|P) - alpha * logit(i|baseline),
 * where baseline = empty observed + ZERO profile. Ingredients the model
 * always predicts (staples) have high baseline logit and get demoted;
 * profile-specific ingredients survive. No new artifact, no retrain — two
 * model passes, fully in-browser-portable.
 *
 * This script MEASURES whether the lever makes Flow-B discriminative across
 * distinct target profiles (the failure mode was "every profile → same
 * staples"). Run: node flavor-gnn/scripts/fm_p2_flowb_contrastive.mjs
 */
import * as ort from 'onnxruntime-node';
import { readFileSync, writeFileSync } from 'node:fs';

const MODEL = 'public/models/recipe-setcompletion.onnx';
const VOCAB = 'public/models/recipe_vocab.json';
const OUT = 'flavor-gnn/artifacts/fm_p2_flowb_eval.json';

const STAPLES = new Set(['salt', 'egg', 'sugar', 'butter', 'flour', 'water', 'oil',
  'milk', 'pepper', 'baking powder', 'baking soda', 'vanilla']);

const meta = JSON.parse(readFileSync(VOCAB, 'utf8'));
const HEADS = meta.heads; // 11-D order
const VOCAB_ARR = meta.vocab;

// Per-ingredient predicted flavor profile (gnn_entropy) → measure whether a
// generated set ACTUALLY has the requested flavor (profile fidelity). This is
// the honest quality metric: overlap alone is gamed by high-alpha rare-junk.
const ENTROPY = JSON.parse(readFileSync('public/proDataset/gnn_entropy.json', 'utf8'));
function nameProfile(name) {
  const e = ENTROPY[name];
  const probs = e?.probs;
  if (!probs) return null;
  return HEADS.map((h) => probs[h] ?? 0);
}
function cosine(a, b) {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  return (na && nb) ? dot / (Math.sqrt(na) * Math.sqrt(nb)) : 0;
}
// Aggregate profile of a generated name list (mean over names that have a
// profile), cosine to the target. Higher = the set really has that flavor.
function profileFidelity(names, target) {
  const vecs = names.map(nameProfile).filter(Boolean);
  if (vecs.length === 0) return 0;
  const mean = HEADS.map((_, i) => vecs.reduce((s, v) => s + v[i], 0) / vecs.length);
  return cosine(mean, target);
}

// Distinct synthetic target profiles — one (or few) dominant head each. The
// failure mode is "all of these return the same staples". Keys are head names.
function prof(obj) {
  return HEADS.map((h) => obj[h] ?? 0);
}
const PROFILES = {
  dessert_sweet: prof({ sweet: 1.0, odor_fruity: 0.5, odor_floral: 0.3 }),
  savory_umami: prof({ umami: 1.0, salty: 0.6, odor_woody: 0.4, odor_fatty: 0.4 }),
  sour_bright: prof({ sour: 1.0, odor_fruity: 0.5, odor_green: 0.4 }),
  bitter_herbal: prof({ bitter: 1.0, odor_green: 0.7, odor_woody: 0.4 }),
  spicy_warm: prof({ odor_spicy: 1.0, salty: 0.4, odor_woody: 0.5 }),
};
const ZERO = HEADS.map(() => 0);

const i64 = (arr) => BigInt64Array.from(arr.map((x) => BigInt(Math.trunc(x))));

function feeds(profile) {
  const obsIds = new Array(meta.maxlen).fill(meta.pad_id);
  const obsMask = new Array(meta.maxlen).fill(0);
  return {
    obs_ids: new ort.Tensor('int64', i64(obsIds), [1, meta.maxlen]),
    obs_mask: new ort.Tensor('float32', Float32Array.from(obsMask), [1, meta.maxlen]),
    profile: new ort.Tensor('float32', Float32Array.from(profile), [1, HEADS.length]),
    cuisine: new ort.Tensor('int64', i64([meta.cuisine_null]), [1]),
    season: new ort.Tensor('int64', i64([meta.season_null]), [1]),
  };
}

function topK(scores, k) {
  const idx = Array.from(scores.keys());
  idx.sort((a, b) => scores[b] - scores[a]);
  return idx.slice(0, k).map((i) => VOCAB_ARR[i]);
}

function jaccard(a, b) {
  const sa = new Set(a), sb = new Set(b);
  let inter = 0;
  for (const x of sa) if (sb.has(x)) inter += 1;
  return inter / (sa.size + sb.size - inter);
}

function stapleCount(names) {
  return names.filter((n) => STAPLES.has(n)).length;
}

// Mean pairwise Jaccard across all profile top-K lists. LOWER = more
// discriminative (profiles produce different recipes). This is the headline.
function meanPairwiseOverlap(lists) {
  const keys = Object.keys(lists);
  let sum = 0, n = 0;
  for (let i = 0; i < keys.length; i++) {
    for (let j = i + 1; j < keys.length; j++) {
      sum += jaccard(lists[keys[i]], lists[keys[j]]);
      n += 1;
    }
  }
  return n ? sum / n : 0;
}

async function main() {
  const session = await ort.InferenceSession.create(MODEL);
  const K = 15;

  // Unconditional baseline logits (empty observed, zero profile).
  const baseOut = await session.run(feeds(ZERO));
  const baseLogits = baseOut.logits.data;

  const ALPHAS = [0, 0.5, 1.0, 1.5];
  const result = { heads: HEADS, K, profiles: {}, byAlpha: {} };

  // Per-profile logits.
  const profLogits = {};
  for (const [name, p] of Object.entries(PROFILES)) {
    const out = await session.run(feeds(p));
    profLogits[name] = out.logits.data;
  }

  for (const alpha of ALPHAS) {
    const lists = {};
    const staples = {};
    const fidelity = {};
    for (const name of Object.keys(PROFILES)) {
      const lg = profLogits[name];
      const scores = new Float64Array(lg.length);
      for (let i = 0; i < lg.length; i++) scores[i] = lg[i] - alpha * baseLogits[i];
      const top = topK(scores, K);
      lists[name] = top;
      staples[name] = stapleCount(top);
      fidelity[name] = profileFidelity(top, PROFILES[name]);
    }
    const overlap = meanPairwiseOverlap(lists);
    const avgStaples = Object.values(staples).reduce((a, b) => a + b, 0) / Object.keys(staples).length;
    const avgFidelity = Object.values(fidelity).reduce((a, b) => a + b, 0) / Object.keys(fidelity).length;
    result.byAlpha[alpha] = { meanPairwiseOverlap: overlap, avgStaplesInTopK: avgStaples, avgProfileFidelity: avgFidelity, lists, staples, fidelity };
    console.log(`\n===== alpha=${alpha} ${alpha === 0 ? '(plain Flow-B, no discount)' : '(contrastive)'} =====`);
    console.log(`mean pairwise overlap: ${overlap.toFixed(3)} (lower=discriminative) | avg profile-fidelity: ${avgFidelity.toFixed(3)} (HIGHER=on-target) | avg staples: ${avgStaples.toFixed(1)}/${K}`);
    for (const [name, top] of Object.entries(lists)) {
      console.log(`  ${name.padEnd(15)} f=${fidelity[name].toFixed(2)} → ${top.slice(0, 8).join(', ')}`);
    }
  }

  writeFileSync(OUT, JSON.stringify(result, null, 2));
  console.log(`\nWrote ${OUT}`);

  // Verdict — fidelity is the quality metric (overlap is gamed by rare-junk at
  // high alpha). Best alpha MAXIMIZES profile fidelity.
  const plainF = result.byAlpha[0].avgProfileFidelity;
  const ranked = ALPHAS.map((a) => ({ a, f: result.byAlpha[a].avgProfileFidelity, o: result.byAlpha[a].meanPairwiseOverlap }))
    .sort((x, y) => y.f - x.f);
  const best = ranked[0];
  console.log(`\nVERDICT (by profile-fidelity): plain(alpha=0) fidelity ${plainF.toFixed(3)} → best alpha=${best.a} fidelity ${best.f.toFixed(3)} (Δ ${(best.f - plainF).toFixed(3)}, overlap ${best.o.toFixed(3)}).`);
  console.log(`Fidelity by alpha: ${ranked.sort((x, y) => x.a - y.a).map((r) => `α${r.a}=${r.f.toFixed(2)}`).join('  ')}`);
  console.log(best.a > 0 && best.f > plainF + 0.02
    ? `→ CONTRASTIVE HELPS at α=${best.a}: more on-target AND discriminative, without the rare-junk collapse seen at high α.`
    : `→ contrastive does not improve on-target fidelity; Flow-B stays weak.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
