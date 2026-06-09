/**
 * FM-P2-3 parity check — confirm the exported ONNX graph matches PyTorch.
 *
 * Loads public/models/recipe-setcompletion.onnx via onnxruntime-node (the same
 * ORT engine onnxruntime-web uses, numerically equivalent) and runs the inputs
 * from flavor-gnn/artifacts/fm_p2_parity_fixture.json, comparing logits to the
 * torch reference. PASS = max abs diff < 1e-3 AND top-10 ranking identical.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as ort from 'onnxruntime-node';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const ONNX = path.join(ROOT, 'public', 'models', 'recipe-setcompletion.onnx');
const FIX = path.join(ROOT, 'flavor-gnn', 'artifacts', 'fm_p2_parity_fixture.json');
const TOL = 1e-3;

const i64 = (arr) => BigInt64Array.from(arr.flat().map((x) => BigInt(Math.trunc(x))));
const f32 = (arr) => Float32Array.from(arr.flat());
const top = (a, k) => [...a.keys()].sort((x, y) => a[y] - a[x]).slice(0, k);

async function main() {
  const fixture = JSON.parse(fs.readFileSync(FIX, 'utf-8'));
  const session = await ort.InferenceSession.create(ONNX);

  let worstDiff = 0;
  let allPass = true;
  for (let ci = 0; ci < fixture.cases.length; ci++) {
    const c = fixture.cases[ci];
    const feeds = {
      obs_ids: new ort.Tensor('int64', i64(c.obs_ids), [1, c.obs_ids[0].length]),
      obs_mask: new ort.Tensor('float32', f32(c.obs_mask), [1, c.obs_mask[0].length]),
      profile: new ort.Tensor('float32', f32(c.profile), [1, c.profile.length]),
      cuisine: new ort.Tensor('int64', i64(c.cuisine), [1]),
      season: new ort.Tensor('int64', i64(c.season), [1]),
    };
    const out = await session.run(feeds);
    const logits = out.logits.data; // Float32Array, length V
    const ref = c.logits;

    let maxDiff = 0;
    for (let i = 0; i < ref.length; i++) maxDiff = Math.max(maxDiff, Math.abs(logits[i] - ref[i]));
    const topOnnx = top(logits, 10);
    const topRef = top(Float32Array.from(ref), 10);
    const rankMatch = topOnnx.every((v, i) => v === topRef[i]);
    worstDiff = Math.max(worstDiff, maxDiff);
    const pass = maxDiff < TOL && rankMatch;
    allPass = allPass && pass;
    console.log(`case ${ci} [${c.observed.join(', ')}${c.cuisine_name ? ' | ' + c.cuisine_name : ''}]: ` +
      `maxAbsDiff=${maxDiff.toExponential(2)} top10Match=${rankMatch} → ${pass ? 'PASS' : 'FAIL'}`);
  }
  console.log(`\n[parity] worst maxAbsDiff=${worstDiff.toExponential(2)} (tol ${TOL}) → ${allPass ? 'PASS' : 'FAIL'}`);
  process.exit(allPass ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
