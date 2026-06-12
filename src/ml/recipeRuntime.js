/**
 * recipeRuntime — browser-side wrapper around the FM-P2 recipe set-completion
 * model. Loads onnxruntime-web + /models/recipe-setcompletion.onnx lazily, then
 * suggests ingredients that complete a partial recipe (Flow A: "user picked a
 * few → suggest the rest"), optionally conditioned on cuisine / season / a
 * target flavor profile.
 *
 * Parity with PyTorch is proven in flavor-gnn/scripts/fm_p2_parity_check.mjs
 * (onnxruntime-node, same engine; max abs diff ~3e-5).
 *
 * Capability scaffold — NOT wired into shipped UI yet. The input-building +
 * ranking logic is pure and unit-tested; inference is lazy.
 */

const NUM_HEADS = 11;

/** Build a lowercased name → vocab-id index from recipe_vocab.json `vocab`. */
export function buildVocabIndex(vocab) {
  const idx = new Map();
  if (Array.isArray(vocab)) for (let i = 0; i < vocab.length; i++) idx.set(String(vocab[i]).toLowerCase(), i);
  return idx;
}

/**
 * Build the model inputs (pure — no onnxruntime dependency, so it is testable).
 * @param {string[]} observedNames ingredients the user already chose
 * @param {{ cuisine?: string, season?: string, profile?: number[] }} opts
 * @param {object} meta recipe_vocab.json contents
 * @param {Map<string,number>} vocabIndex
 * @returns {{ obsIds: number[], obsMask: number[], profile: number[], cuisine: number, season: number, observedIds: number[] }}
 */
export function buildRecipeInputs(observedNames, opts, meta, vocabIndex) {
  const { maxlen, pad_id, cuisine_vocab, cuisine_null, season_vocab, season_null } = meta;
  const observedIds = [];
  for (const name of observedNames || []) {
    const id = vocabIndex.get(String(name).toLowerCase());
    if (id != null) observedIds.push(id);
  }
  const obsIds = new Array(maxlen).fill(pad_id);
  const obsMask = new Array(maxlen).fill(0);
  for (let j = 0; j < Math.min(observedIds.length, maxlen); j++) {
    obsIds[j] = observedIds[j];
    obsMask[j] = 1;
  }
  const ci = opts?.cuisine ? cuisine_vocab.indexOf(opts.cuisine) : -1;
  const si = opts?.season ? season_vocab.indexOf(opts.season) : -1;
  const profile = Array.isArray(opts?.profile) && opts.profile.length === NUM_HEADS
    ? opts.profile.map(Number)
    : new Array(NUM_HEADS).fill(0);
  return {
    obsIds, obsMask, profile, observedIds,
    cuisine: ci >= 0 ? ci : cuisine_null,
    season: si >= 0 ? si : season_null,
  };
}

/**
 * Rank logits into suggestions, excluding the observed ingredients.
 * @param {Float32Array|number[]} logits length V
 * @param {string[]} vocab
 * @param {number[]} observedIds ids to exclude
 * @param {number} k
 * @param {Iterable<number>|null} candidateIds restrict ranking to this pool (e.g.
 *   same-category substitutes for a replacement); null = whole vocab.
 * @returns {Array<{name:string, score:number}>}
 */
export function rankLogits(logits, vocab, observedIds, k = 10, candidateIds = null) {
  const excluded = new Set(observedIds);
  const idx = [];
  if (candidateIds) {
    for (const i of candidateIds) if (!excluded.has(i) && i >= 0 && i < vocab.length) idx.push(i);
  } else {
    for (let i = 0; i < vocab.length; i++) if (!excluded.has(i)) idx.push(i);
  }
  idx.sort((a, b) => logits[b] - logits[a]);
  return idx.slice(0, k).map((i) => ({ name: vocab[i], score: logits[i] }));
}

/**
 * Unconditional baseline logits (empty observed + zero profile + null cuisine)
 * — the model's "predict for ANY recipe" prior, dominated by staples
 * (salt/sugar/flour). Cached on the model. Subtracting α·baseline from the
 * conditioned logits demotes those staples so context-specific ingredients
 * surface (popularity discount / contrastive decoding).
 */
async function baselineLogits(model) {
  if (model._baseline) return model._baseline;
  const { ort, session, meta, vocabIndex } = model;
  const inp = buildRecipeInputs([], {}, meta, vocabIndex);
  const i64 = (a) => BigInt64Array.from(a.map((x) => BigInt(Math.trunc(x))));
  const out = await session.run({
    obs_ids: new ort.Tensor('int64', i64(inp.obsIds), [1, meta.maxlen]),
    obs_mask: new ort.Tensor('float32', Float32Array.from(inp.obsMask), [1, meta.maxlen]),
    profile: new ort.Tensor('float32', Float32Array.from(inp.profile), [1, NUM_HEADS]),
    cuisine: new ort.Tensor('int64', i64([meta.cuisine_null]), [1]),
    season: new ort.Tensor('int64', i64([meta.season_null]), [1]),
  });
  model._baseline = out.logits.data;
  return model._baseline;
}

/** Lazily load onnxruntime-web + the model + vocab. */
export async function loadRecipeModel(basePath = '') {
  const ort = await import('onnxruntime-web');
  ort.env.wasm.numThreads = 1;
  ort.env.wasm.simd = true;
  ort.env.wasm.wasmPaths = '/wasm/';
  const session = await ort.InferenceSession.create(`${basePath}/models/recipe-setcompletion.onnx`);
  const meta = await (await fetch(`${basePath}/models/recipe_vocab.json`)).json();
  return { ort, session, meta, vocabIndex: buildVocabIndex(meta.vocab) };
}

/**
 * Suggest ingredients that complete a partial recipe.
 * @param {string[]} observedNames
 * @param {{ cuisine?: string, season?: string, profile?: number[], k?: number }} opts
 * @param {{ ort, session, meta, vocabIndex }} model from loadRecipeModel
 * @returns {Promise<Array<{name:string, score:number}>>}
 */
export async function suggestIngredients(observedNames, opts, model) {
  const { ort, session, meta, vocabIndex } = model;
  const inp = buildRecipeInputs(observedNames, opts, meta, vocabIndex);
  const i64 = (a) => BigInt64Array.from(a.map((x) => BigInt(Math.trunc(x))));
  const feeds = {
    obs_ids: new ort.Tensor('int64', i64(inp.obsIds), [1, meta.maxlen]),
    obs_mask: new ort.Tensor('float32', Float32Array.from(inp.obsMask), [1, meta.maxlen]),
    profile: new ort.Tensor('float32', Float32Array.from(inp.profile), [1, NUM_HEADS]),
    cuisine: new ort.Tensor('int64', i64([inp.cuisine]), [1]),
    season: new ort.Tensor('int64', i64([inp.season]), [1]),
  };
  const out = await session.run(feeds);
  let scores = out.logits.data;

  // Popularity discount (contrastive): score = logit(i|recipe) − α·logit(i|∅).
  // Demotes global staples (salt/sugar/flour) the model predicts for every
  // recipe, so recipe-specific ingredients rank up. α small (~0.3) — high α
  // promotes rare junk (validated in fm_p2_suggest_audit / Flow-B).
  const alpha = opts?.alpha ?? 0;
  if (alpha > 0) {
    const base = await baselineLogits(model);
    const adj = new Float64Array(scores.length);
    for (let i = 0; i < scores.length; i++) adj[i] = scores[i] - alpha * base[i];
    scores = adj;
  }

  // Restrict to a candidate pool (e.g. same-category substitutes for a
  // replacement) when provided.
  let candidateIds = null;
  if (Array.isArray(opts?.candidateNames)) {
    candidateIds = [];
    for (const nm of opts.candidateNames) {
      const id = vocabIndex.get(String(nm).toLowerCase());
      if (id != null) candidateIds.push(id);
    }
  }
  return rankLogits(scores, meta.vocab, inp.observedIds, opts?.k ?? 10, candidateIds);
}
