# Feasibility Spec: Flavor Model Suite (Pairing · Recipe-Gen · Twists)

- **Mode:** ralph-universal interactive bridge — **EXPLORE/DESIGN. No code, no commits.**
- **Generated:** 2026-06-08
- **Status:** PENDING APPROVAL (feasibility spec only)
- **Decisions locked (2026-06-08, via interactive bridge):**
  1. **Serving = in-browser ONNX** (reuse `src/ml/flavorGnnRuntime.js` path)
  2. **Recipe-gen = train an owned set-completion model** from scratch on RecipeNLG
  3. **Scope this round = feasibility spec only** → this doc
  4. **Build order leads with the pairing model**

---

## 0. Verdict

**Feasible — and the riskiest piece (in-browser model serving) is already solved.**
The app already trains a PyTorch GNN, exports it to ONNX
(`flavor-gnn/src/export/to_onnx.py`), and runs it client-side via
`onnxruntime-web` (`src/ml/flavorGnnRuntime.js` → `public/models/flavor-gnn.onnx`).
Adding three flavor models is an *extension of a paved road*, not new infra.

All three capabilities have sufficient training signal on disk today:

| Capability | Primary signal | Readiness |
|---|---|---|
| Suggest pairings | 96K multi-factor pairings + 122K cuisine-specific + GAT 16D embeddings (`flavor_graph_data_v3.json`, 3,863 nodes) | **Half-built** — embeddings trained; heuristic `rankSuggestions` is the baseline |
| Generate novel recipes (profile + opt. cuisine/season) | **2.23M recipes** (`proDataset/raw/recipenlg.csv`, 2.2GB, NER-tagged ingredient lists) + `cuisine_map` (3,982) + `season_region` (2,313) | **Trainable from scratch** — corpus is large |
| Suggest twists | embeddings + 7 cluster labels + pairing novelty factor | **Mostly retrieval** + a generative "accent" from the set-model |

---

## 1. Existing assets this builds on (grounded inventory)

**Serving / export (the proven path):**
- `package.json` → `onnxruntime-web ^1.24.3`, `onnxruntime-node ^1.24.3`, `fuse.js ^7`.
- `src/ml/flavorGnnRuntime.js` → `ort.InferenceSession.create('/models/flavor-gnn.onnx')`.
- `flavor-gnn/src/export/to_onnx.py` → PyTorch→ONNX (opset 17). **Note:** the GINEConv
  export is "best-effort" (scatter_add op coverage). Our new models are plain
  transformers/MLPs → **cleaner ONNX export, lower risk** than the existing GNN.

**Data:**
- `proDataset/raw/recipenlg.csv` — 2,231,149 recipes; fields `title, ingredients[], directions[], link, source, NER`. The **`NER` field gives normalized ingredient names** → the corpus reduces to ingredient *sets* per dish.
- `dist/proDataset/pairings.json` — ~96K pairs, 8 factors (`strength, tradition, chemistry, novelty, balance, bridging, sharedCompounds[], flavorDistance`).
- `dist/proDataset/cuisine_pairings.json` — ~122K cuisine-conditioned pairs.
- `flavor_graph_data_v3.json` — 3,863 nodes, each with `embedding[16]`, `cluster(0-6)`, `tier1/2/3`, `leaves`.
- `gnn_entropy.json` — 3,432 ingredients × 11 taste/aroma probs.
- `cluster_labels_v3.json` — 7 chef-cognitive clusters.
- `cuisine_map.json` (3,982), `season_region.json` (2,313).
- Synonym/category tables under `proDataset/data/` — needed to map RecipeNLG NER → the ~4K ingredient vocab.

**Heuristic baseline (the A/B control the models must beat):**
- `src/data/recipeScoring.js` — `scoreRecipe()` → balance/coverage/taste-profile from aggregated `gnn_entropy` probs.
- focal-weighted `rankSuggestions` (W_FOCAL=0.6) in the suggestion pipeline.

---

## 2. Model designs (all in-browser-servable)

### 2a. Pairing model (LEAD)
- **v0, no training:** cosine similarity over existing `embedding[16]`, re-ranked
  by the 8 pairing factors. Pure JS, ships immediately as the control.
- **v1, light training:** MLP link-predictor on `[emb_a, emb_b, |emb_a-emb_b|, factors]`
  → P(good pairing). Positives = 96K pairings; negatives = sampled non-pairs.
  Tiny model (<1MB ONNX) or compute in JS. Conditioning on cuisine via
  `cuisine_pairings` slice.
- **Eval:** hit@k / MRR on held-out pairings vs the heuristic 8-factor baseline.

### 2b. Recipe-generation model (the owned set-model)
- **Architecture:** small **conditional set-completion transformer** over the
  ~4K-ingredient vocab. Embedding dim ~128, 3–4 layers. Conditioning prepended
  as tokens (or FiLM): 11-D target flavor profile + optional cuisine one-hot +
  optional season one-hot (4). Generation = autoregressive over a canonically
  ordered ingredient set; in-browser via an `ort.InferenceSession` decode loop
  (recipes are ~8–15 tokens → latency is fine).
- **Training data construction (build-time, offline — never in browser):**
  RecipeNLG NER → vocab (via synonym tables) → ingredient set per recipe.
  Per-recipe labels: **profile** = aggregate of members' `gnn_entropy` probs;
  **cuisine** = `cuisine_map` majority vote (or recipe `source`); **season** =
  `season_region` majority vote. Recipes with too few mapped ingredients dropped.
- **Eval:** held-out member reconstruction (recover masked ingredients),
  profile-match fidelity (does generated set hit the requested profile?),
  novelty (fraction of generated sets not verbatim in corpus), + **chef sign-off**
  (matches the project's existing chef-signoff gate pattern).
- **Guardrail:** re-rank generated sets through `recipeScoring` + pairing model
  so "novel" never means "inedible."

### 2c. Twists model
- **Retrieval-first:** per ingredient in an existing bowl, propose substitutions =
  embedding nearest-neighbors, **within-cluster = safe, cross-cluster = adventurous**,
  scored by Δ`recipeScoring`. "Add an accent" = the 2b set-model conditioned on the
  existing set (complete-the-set, k=1–3).
- **Eval:** chef/human preference vs a random-swap baseline.

---

## 3. In-browser constraints (the binding design rules)

- Vocab ~4K → embedding tables are small; total set-model ONNX target **< ~8MB**
  (comparable to existing assets the app already ships).
- Autoregressive decode runs in a JS loop over `onnxruntime-web`; keep layers
  shallow for mobile/Capacitor.
- **The 2.2GB RecipeNLG CSV is build-time only.** Nothing about training touches
  the client bundle; only the exported `.onnx` + a vocab json ship.
- No new runtime deps — `onnxruntime-web` already present.

---

## 4. Phased bridge plan (when approved — no auto-commit)

| Phase | Title | Output | Notes |
|---|---|---|---|
| **P0** | Corpus + label build | `flavor-gnn/data/recipe_sets.parquet` (set + profile/cuisine/season labels) | Data-eng long pole = NER→vocab synonym coverage. Reuse `proDataset/data/` tables. |
| **P1** | Pairing model (LEAD) | trained MLP scorer + ONNX + `rankSuggestions` flag + A/B vs heuristic | v0 cosine ships first as control |
| **P2** | Set-generation model | trained set transformer + reconstruction/novelty eval + ONNX | plain transformer = clean ONNX export |
| **P3** | In-browser generation UX | serve set-model via a `flavorGnnRuntime` analog; wire profile+cuisine+season inputs into the Make-a-Recipe surface | optional cuisine/season = nullable conditioning |
| **P4** | Twists | retrieval-substitution + set-model accent on a bowl | mostly JS + embeddings |
| **P5** | Chef sign-off + guardrail | re-ranker wiring + chef A/B gate | mirrors existing chef-signoff gates |

**Sequencing rationale:** P0 unblocks everything; P1 (lead) proves the
train→export→serve→A/B loop end-to-end on the cheapest model; P2–P3 deliver the
headline capability; P4 reuses P2; P5 is the quality gate.

---

## 5. Acceptance criteria (spec-level)

- [ ] P0 corpus: ≥ ~1.5M recipes survive NER→vocab mapping with a profile label; mapping coverage reported.
- [ ] P1 pairing model beats heuristic 8-factor baseline on held-out hit@10 / MRR; served in-browser behind a flag; existing tests green; `npm run build` clean.
- [ ] P2 set-model: held-out reconstruction + novelty + profile-fidelity reported; ONNX exports cleanly (< size budget).
- [ ] P3: Make-a-Recipe can request a recipe from (profile, optional cuisine, optional season) and render a generated, guardrail-passed ingredient set fully client-side.
- [ ] P4: twists surface on an existing recipe with safe/adventurous tiers.
- [ ] P5: chef sign-off PASS captured (contact-sheet pattern, like `project_v3_morph_chef_signoff`).
- [ ] **No commits** during design; working tree stays uncommitted until you approve execution.

---

## 6. Risks

1. **NER→vocab normalization** is the real long pole (data-eng), not the modeling. Budget P0 accordingly.
2. **Novelty vs edibility** — generative set-model needs the `recipeScoring`/pairing guardrail or it will surface plausible-but-gross combos.
3. **In-browser latency/size** on mobile/Capacitor — keep the set-model shallow; measure on device.
4. **ONNX export** — low risk here (plain transformer/MLP), unlike the existing GINEConv path.
5. **Cuisine/season label noise** — majority-vote labels are weak supervision; treat conditioning as a soft prior, evaluate with and without.

---

## 7. How to launch when approved

This is a design spec. To execute later, paste the §8 task blocks into `plan.md`
(bridge JSON format) and run interactive bridge mode with `auto_commit:false`
(current config). Start with **P0 → P1**. Build nothing until you say so.

---

## 8. P0 / P1 task decomposition (paste-ready bridge tasks)

These match the existing `plan.md` schema (`{id, title, category, priority,
description, acceptance[]}`). They are **staged here for review** — copy into
`plan.md` only when you approve execution, so they don't enter the live bridge
queue prematurely. IDs use the `FM-` (Flavor Model) prefix.

### P0 — Corpus + label build (offline / build-time only)

```json
{
  "id": "FM-P0-1",
  "title": "RecipeNLG NER → ingredient-vocab normalization map + coverage report",
  "category": "data",
  "priority": 1,
  "description": "Build flavor-gnn/data/ner_vocab_map.json mapping RecipeNLG NER ingredient strings to the ~4K canonical ingredient vocab. Reuse the synonym/category tables under proDataset/data/ (do NOT hand-author a new synonym set — extend existing). Stream the NER column of proDataset/raw/recipenlg.csv (2.2GB, build-time only) to enumerate distinct NER tokens, normalize (lowercase/singularize/strip qualifiers), and resolve to vocab ids via the synonym tables + embedding-name match. Emit an unmatched-token frequency report so the long tail is visible.",
  "acceptance": [
    "flavor-gnn/data/ner_vocab_map.json exists and parses: {ner_token -> vocab_id|null}",
    "Coverage report emitted: % of NER token OCCURRENCES (weighted by frequency) resolved to a vocab id",
    "Weighted NER->vocab coverage >= 85% of occurrences",
    "Top-200 unmatched-by-frequency tokens listed for a follow-up synonym pass",
    "Script is reproducible (seeded, no network) and documents that it reads the 2.2GB CSV build-time only"
  ]
}
```

```json
{
  "id": "FM-P0-2",
  "title": "Recipe → ingredient-set corpus (recipe_sets.parquet)",
  "category": "data",
  "priority": 1,
  "description": "Stream proDataset/raw/recipenlg.csv through FM-P0-1's map to produce flavor-gnn/data/recipe_sets.parquet: one row per recipe = sorted unique vocab-id set + source + title. Drop recipes with < K_MIN mapped ingredients (K_MIN=3, configurable) and de-dupe identical sets. Record per-recipe original ingredient count vs mapped count for shrinkage analysis.",
  "acceptance": [
    "flavor-gnn/data/recipe_sets.parquet exists with columns: recipe_id, vocab_ids[], n_raw, n_mapped, source, title",
    ">= 1.5M recipes survive the K_MIN>=3 + dedupe filter",
    "No row contains an unmapped/null vocab id",
    "Shrinkage report: distribution of n_mapped and count dropped for n_mapped < K_MIN"
  ]
}
```

```json
{
  "id": "FM-P0-3",
  "title": "Per-recipe conditioning labels: flavor profile + cuisine + season",
  "category": "data",
  "priority": 1,
  "description": "Attach conditioning labels to each recipe_sets row. PROFILE = 11-D mean of member ingredients' gnn_entropy.json probs (taste+aroma), renormalized. CUISINE = majority vote over members via cuisine_map.json, with the recipe `source` as a tie-breaker/prior; null when no member has a cuisine tag. SEASON = majority vote via season_region.json; null when unknown. Cuisine/season are intentionally nullable (optional conditioning). Emit as recipe_labels.parquet keyed by recipe_id.",
  "acceptance": [
    "flavor-gnn/data/recipe_labels.parquet exists: recipe_id, profile[11], cuisine|null, season|null",
    "profile vectors are finite and L1-normalized (sum ~1.0)",
    ">= 60% of recipes have a non-null cuisine label; coverage % reported",
    "Season coverage % reported (no hard floor — weak signal expected)",
    "Label join is lossless against recipe_sets.parquet (every set row has a label row)"
  ]
}
```

```json
{
  "id": "FM-P0-4",
  "title": "Deterministic train/val/test split + corpus stats card",
  "category": "data",
  "priority": 2,
  "description": "Produce a seeded recipe-id split (e.g. 90/5/5) stored as flavor-gnn/data/splits.json, plus a one-page stats card (markdown) summarizing vocab size, surviving recipe count, n_mapped distribution, cuisine/season coverage, and the most/least represented ingredients. This card is the baseline the modeling phases report against.",
  "acceptance": [
    "flavor-gnn/data/splits.json with disjoint train/val/test recipe_id lists, fixed seed",
    "No recipe_id appears in more than one split",
    "flavor-gnn/data/corpus_stats.md emitted with vocab size, recipe count, coverage figures",
    "Re-running the split script yields identical assignments (determinism check)"
  ]
}
```

### P1 — Pairing model (LEAD: prove train → export → serve → A/B end-to-end)

```json
{
  "id": "FM-P1-1",
  "title": "v0 cosine pairing scorer in JS (no training) behind a feature flag",
  "category": "ml",
  "priority": 1,
  "description": "Ship the control first: a pure-JS scorer that ranks candidate pairings by cosine similarity over flavor_graph_data_v3.json embedding[16], re-ranked by the existing 8 pairing factors from pairings.json. Expose behind a feature flag (e.g. FN_PAIRING_MODEL) so it can A/B against the current heuristic rankSuggestions. No model training, no new artifact.",
  "acceptance": [
    "A pairing-score util (src/ml/ or src/data/) returns a ranked candidate list for a focal ingredient",
    "Gated behind a flag; default OFF preserves current rankSuggestions behavior",
    "Unit test: known strong pair outranks a known weak pair for a fixed focal",
    "npm run build clean; existing tests green"
  ]
}
```

```json
{
  "id": "FM-P1-2",
  "title": "Train MLP link-predictor on embeddings + factors; eval vs heuristic",
  "category": "ml",
  "priority": 1,
  "description": "Train a small MLP P(good pairing | [emb_a, emb_b, |emb_a-emb_b|, factors]). Positives = pairings.json pairs; negatives = frequency-aware sampled non-pairs. Hold out a pairing test set. Report hit@10 / MRR vs the v0 cosine baseline and the heuristic 8-factor ranking. Keep the net tiny (< ~1MB) for in-browser serving.",
  "acceptance": [
    "Training script under flavor-gnn/ with seeded split; checkpoint saved to flavor-gnn/artifacts/",
    "Held-out hit@10 and MRR reported for: heuristic baseline, v0 cosine, trained MLP",
    "Trained MLP beats the heuristic baseline on hit@10 (primary gate)",
    "Eval artifact (json) committed to artifacts/ for traceability"
  ]
}
```

```json
{
  "id": "FM-P1-3",
  "title": "Export pairing MLP to ONNX + in-browser load via flavorGnnRuntime analog",
  "category": "ml",
  "priority": 1,
  "description": "Export the FM-P1-2 MLP to ONNX (opset 17, plain Linear/ReLU — clean export, unlike the GINEConv path). Place under public/models/. Add a runtime loader modeled on src/ml/flavorGnnRuntime.js (ort.InferenceSession) that scores a focal's candidates. Verify parity between Python eval and in-browser inference on a fixture.",
  "acceptance": [
    "public/models/flavor-pairing.onnx exists and loads via onnxruntime-web",
    "Loader returns scores for a focal+candidates fixture",
    "Python vs in-browser score parity within 1e-3 on the fixture",
    "ONNX file < 2MB"
  ]
}
```

```json
{
  "id": "FM-P1-4",
  "title": "Wire pairing model into rankSuggestions + A/B harness + tests",
  "category": "ui",
  "priority": 1,
  "description": "Route the trained scorer into the suggestion pipeline behind FN_PAIRING_MODEL, preserving focal-weighted (W_FOCAL) behavior as the blend/fallback. Add __qaPairingModel* window helpers under the existing ?af_debug=1 gate to A/B model-on vs model-off. Update/extend tests for the new ranking path.",
  "acceptance": [
    "rankSuggestions consumes the model score behind the flag; flag OFF = unchanged heuristic",
    "__qaPairingModel* harness helpers attached under ?af_debug=1",
    "Tests cover: flag toggles ranking source, fallback when a candidate lacks an embedding",
    "npm run build clean; full test suite green",
    "NO COMMITS — changes stay on an uncommitted working tree until approved"
  ]
}
```

**Suggested run order:** FM-P0-1 → P0-2 → P0-3 → P0-4 (P0 is the data long pole;
P1 only depends on existing embeddings/pairings, so P1-1 can start in parallel
with P0). Lead the proof-of-pipeline with **FM-P1-1 → P1-2 → P1-3 → P1-4**.

---

## 9. Extension: cocktails & sauces (added 2026-06-08)

Same three capabilities (pairing · generation · twists) for cocktail and sauce
recipes. **The generation capability cannot reuse the food approach** — the data
reality forces a different design, and that's a feature, not a compromise.

### 9.1 Data reality (why generation differs by domain)

| Domain | Recipe corpus | Structural grammar on disk | Generation approach |
|---|---|---|---|
| Food | **2.23M** (RecipeNLG) | none | **Train neural set-model** (P2) |
| Cocktails | **441** (`public/data/cocktail_codex_v2.json`: `family_id`, `iba_category`, `is_root`, `ingredients_raw`) + 130 ingredients w/ `codexRole` (base/modifier/sweetener/sour/bitters) + 1,426 curated pairings | strong (codex families + IBA + role taxonomy) | **Structure-constrained generator** (template + retrieval + constraint-satisfaction) |
| Sauces | **77** (`public/data/sauce_augment.json`: `motherSauce`, `cuisine`, `ingredients[]`, `pairsWith`) + 175 ingredients w/ `codexRole` + 1,472 curated pairings | strong (5 mother-sauce families) | **Structure-constrained generator** (mother → derivative) |

441 / 77 recipes are far too few to train a set-model from scratch (food has ~30,000× more).
Forcing a neural model here would overfit and hallucinate inedible drinks/sauces.
The codex families, IBA categories, mother-sauce taxonomy, and `codexRole` tags are
exactly the priors a constraint-satisfaction generator needs — higher quality AND
honest about the data.

### 9.2 Per-capability design

- **Pairing — SHARES P1 infra.** The trained pairing scorer (FM-P1) applies to
  cocktails/sauces with a **domain-filtered candidate pool** (only that domain's
  ingredient universe) and the curated `cocktail_augment.pairings` /
  `sauce_augment.pairings` as additional positives. **Known gap:** many cocktail/
  sauce ingredients (spirits, liqueurs, fats) likely lack `flavor_graph_data_v3`
  embeddings — must audit coverage and fall back to the domain pairing graph +
  `codexRole` similarity when no embedding exists.
- **Generation — structure-constrained, NOT the neural set-model.**
  - *Cocktails:* a drink = base spirit + modifier/liqueur + balance (sweet/sour) +
    bitters/accent (+ dilution), sampled per a `codexRole` grammar seeded by the
    cocktail-codex family template, conditioned on target profile (+ optional
    "occasion"/style), re-ranked by the FM-P1 pairing scorer. The **cocktail-agent**
    is the domain expert to drive role/grammar definition.
  - *Sauces:* pick a mother sauce + a compatible derivative move (e.g. Béchamel
    + cheese → Mornay), conditioned on cuisine/profile, re-ranked by pairing fit.
    The **sauce-agent** is the domain expert for the mother→derivative tree.
- **Twists — constrained substitution.** Reuse embedding-NN substitution but
  **gated by `codexRole` / mother-family** so swaps stay coherent: gin→vodka (same
  role), lime→lemon, Béchamel→Mornay (family-adjacent). Never swap a base spirit
  for a vegetable.

**Net:** pairing + twists share infra across all three domains; only *generation*
forks — neural for food, constraint-satisfaction for cocktails/sauces.

### 9.3 Paste-ready tasks (FM-CS-* — stage in `plan.md` only on approval)

```json
{
  "id": "FM-CS-1",
  "title": "Cocktail/sauce ingredient embedding-coverage audit + fallback spec",
  "category": "data",
  "priority": 1,
  "description": "Audit how many cocktail_augment (130) and sauce_augment (175) ingredients have a flavor_graph_data_v3.json embedding. For uncovered ingredients (spirits, liqueurs, fats), define the fallback similarity signal: curated domain pairings graph + codexRole match. Emit a coverage report and a resolved per-domain ingredient->vector|fallback table.",
  "acceptance": [
    "Report: % of cocktail and % of sauce ingredients with a v3 embedding",
    "flavor-gnn/data/domain_ingredient_vectors.json: per-domain ingredient -> {embedding|null, codexRole, fallback_source}",
    "Every domain ingredient resolves to either an embedding or a documented fallback",
    "No crash on ingredients absent from flavor_graph_data_v3"
  ]
}
```

```json
{
  "id": "FM-CS-2",
  "title": "Extend pairing scorer to cocktail + sauce domains (domain-filtered pools)",
  "category": "ml",
  "priority": 1,
  "description": "Reuse the FM-P1 scorer with a `domain` parameter (food|cocktail|sauce). Candidate pool filters to the domain's ingredient universe; positives augmented with the curated cocktail_augment.pairings (1426) / sauce_augment.pairings (1472). Use FM-CS-1 fallback when an ingredient lacks an embedding. Behind the FN_PAIRING_MODEL flag.",
  "acceptance": [
    "scorer accepts domain in {food,cocktail,sauce}; cocktail/sauce pools exclude non-domain ingredients",
    "Held-out cocktail and sauce pairing hit@10 reported vs the curated-pairing-strength baseline",
    "Beats the baseline on at least one domain; gap explained on any miss",
    "Fallback path covered by a test (ingredient with no embedding still scores)"
  ]
}
```

```json
{
  "id": "FM-CS-3",
  "title": "Cocktail grammar + constraint-satisfaction generator (cocktail-agent-driven)",
  "category": "ml",
  "priority": 2,
  "description": "With the cocktail-agent, formalize the codexRole grammar (base / modifier / sweetener / sour / bitters / accent / dilution) and the cocktail_codex_v2 family templates into a generator: given a target profile (+ optional style), sample a role-complete drink, re-rank candidates by FM-CS-2 pairing fit, validate against the grammar. Pure JS / data-driven (no neural training).",
  "acceptance": [
    "Generator emits a role-complete cocktail (>=1 base + balanced sweet/sour) for a given profile",
    "Every generated drink validates against the codexRole grammar",
    "Output is re-ranked/filtered by the pairing scorer (guardrail against bad combos)",
    "Generates a recognizable classic when seeded toward a known family (sanity check)",
    "cocktail-agent sign-off on a sample of 10 generated drinks"
  ]
}
```

```json
{
  "id": "FM-CS-4",
  "title": "Sauce mother->derivative generator (sauce-agent-driven)",
  "category": "ml",
  "priority": 2,
  "description": "With the sauce-agent, encode the 5 mother sauces + their derivative tree from sauce_augment.sauces (77 recipes, motherSauce field). Generator: given cuisine/profile, pick a mother + a compatible derivative move, re-rank by pairing fit. Data-driven, no neural training.",
  "acceptance": [
    "Generator emits a mother + named derivative (e.g. Bechamel + cheese -> Mornay) for a target",
    "Every output traces to a valid mother-sauce family",
    "Re-ranked by the pairing scorer",
    "sauce-agent sign-off on a sample of 10 generated sauces"
  ]
}
```

```json
{
  "id": "FM-CS-5",
  "title": "Cocktail/sauce twists via role/family-constrained substitution",
  "category": "ui",
  "priority": 3,
  "description": "Extend the food twists flow (P4) to cocktails/sauces: embedding-NN substitution gated by codexRole (cocktails) or mother-family adjacency (sauces). Surfaced in CocktailLab/SauceLab as safe (same role/family) vs adventurous (adjacent) tiers. Reuse FM-CS-1 vectors + FM-CS-2 scoring.",
  "acceptance": [
    "Given a cocktail, proposed swaps preserve codexRole (no base->garnish swaps)",
    "Given a sauce, proposed twists stay within or adjacent to the mother family",
    "Safe vs adventurous tiers surfaced in the existing Cocktail/Sauce lab UI",
    "npm run build clean; tests green; NO COMMITS until approved"
  ]
}
```

**Dependencies:** FM-CS-1 → FM-CS-2 (pairing, shares FM-P1); FM-CS-3/4 depend on
FM-CS-2 for re-ranking and on the cocktail-agent / sauce-agent for domain grammar;
FM-CS-5 depends on FM-CS-1/2 and mirrors food P4. **Generation for these domains
is constraint-satisfaction, so it has NO dependency on the food set-model (P2)** —
cocktail/sauce pairing + generation can ship without the 2.2M-recipe training run.

---

## 10. MEASURED RESULTS — FM-P1-1 done, FM-P1-2 negative (2026-06-08)

### FM-P1-1 (shipped, uncommitted)
`src/ml/pairingModel.js` + 14 passing tests. Cosine scorer + co-occurrence blend,
flag-gated `FN_PAIRING_MODEL` (default OFF). Full suite 1239/1239, build clean.

### FM-P0-1 / FM-P0-2 / FM-Q1 (done — corpus built)
- **FM-P0-1** `ner_vocab_map.json`: 2.23M recipes streamed, 198,899 distinct NER
  tokens, **86.38% weighted coverage** (gate ≥85% ✅). Reused `canonicalizeIngredient`.
  Top-200 unmatched (`baking powder` 161K, `baking soda` 121K, …) flagged for a
  ~30-entry synonym pass that would push coverage to ~90%+.
- **FM-P0-2** `recipe_sets.jsonl`: **1,636,962** unique recipe id-sets (gate ≥1.5M ✅);
  dropped 118K (<3 mapped) + 475K duplicate sets. Vocab `vocab.json` (3,891, stable ids).
- **FM-Q1** `ingredient_quantities.jsonl`: **12,139,573** `(vocab_id, qty, unit)`
  triples, **81.02%** parse-coverage; alignment guard skipped 454K len-mismatched recipes.
- **Deviation (justified):** `parseAmount()` was specified for reuse but returns
  null on full RecipeNLG lines (`"1 c. firmly packed brown sugar"`) — it parses
  clean amount *fields*, not recipe lines. Wrote a leading-amount extractor that
  reuses `UNIT_DENSITY` (same 27-unit vocabulary), preserving consistency where it
  matters. Build script: `flavor-gnn/scripts/fm_p0_2_build_corpus.mjs`.
- Intermediates are large (186MB + 465MB) and `.gitignore`d (regenerable).

### FM-Q2 (done — quantity model beats baseline)
`flavor-gnn/scripts/fm_q2_quantity_model.mjs` → `quantity_model.json` (3,710
ingredients) + `fm_q2_eval.json`. Per-ingredient modal-unit + median-grams over
the 12.1M triples, 10% held-out (1.22M):

| metric | model | global baseline |
|---|---|---|
| unit top-1 accuracy | **0.495** | 0.387 |
| qty MdAPE (grams) | **0.583** | 0.600 |

Beats the baseline on both → primary gate ✅. **Honest read:** the *unit*
prediction is the real win (+11 pts); the *qty* gain is marginal because
context-free quantity is inherently noisy ("how much butter" swings with serving
size). A bowl-context-conditioned model (or the set-model's context) is where qty
error would actually drop. Loadable predictor + 6 tests: `src/ml/quantityModel.js`.
Full suite 1245/1245, build clean. **PyTorch 2.8.0+cpu now installed** → the P2
neural set-model is unblocked.

### FM-P0-3 / FM-P2 (done — recipe generation model trained, mixed result)
- **FM-P0-3** `train_tensors.npz` + `cond_vocab.json`: 1.64M recipes tensorized
  (CSR member arrays + per-recipe profile[11] + cuisine + season). 100%
  cuisine-labeled (52 cuisines; Global is the catch-all), 95.4% season (13).
- **FM-P2-1/2** conditional **set-completion** model (Deep-Sets encoder, tied
  output head, PyTorch). `flavor-gnn/scripts/fm_p2_train_setcompletion.py` →
  `artifacts/fm_p2_setcompletion.pt` + `fm_p2_eval.json`. Trained 6000 steps / 155s CPU.
  Held-out (idx%10) eval:

  | metric | model | baseline |
  |---|---|---|
  | reconstruction hit@10 | **0.866** | 0.799 (popularity) |
  | profile-fidelity cos | **0.989** | 0.964 (popularity) |

  **Beats baseline on both → P2 gate ✅** (unlike the pairing model which lost to
  co-occurrence — here the neural model wins).

- **Qualitative (fm_p2_generate_demo.py) — the honest nuance:**
  - **Flow A (complete-from-partial) works well.** `[flour,butter,sugar]` →
    egg/vanilla/brown sugar/cinnamon/chocolate (recognized baking);
    `[chicken,garlic]`+Italian → olive oil/balsamic/oregano/parsley (cuisine-aware);
    `[soy,ginger,garlic]`+Asian → scallion/sesame oil. **This is the product-ready
    capability: "user picked a few → suggest the rest", and cuisine conditioning works.**
  - **Flow B (generate-from-profile alone) is weak.** All target profiles produced
    near-identical staples (salt/egg/sugar/butter/flour). Root cause: the averaged
    11-D `gnn_entropy` profile **collapses to ~the same vector** across recipes (the
    same feature-compression that sank raw-cosine pairing). With no observed
    ingredients, profile conditioning can't override the global staple prior.

- **Decision:** ship recipe generation **driven by seed ingredients + cuisine**
  (Flow A — strong), not by the abstract 11-D profile alone. Levers to make
  pure-profile generation work, in priority order: (1) generation-time popularity
  discounting (TF-IDF-style demote staples — a no-retrain reranking trick, likely
  the biggest quick win); (2) a more discriminative target representation than the
  averaged gnn profile (e.g. dish-type / cluster conditioning, or target via seed
  ingredients which IS Flow A); (3) stronger profile weighting / FiLM in the model.
- **Next:** FM-P2-3 (ONNX export + in-browser parity) to make Flow A servable;
  optionally a popularity-discount reranker for Flow B.

### FM-P2-3 (done — model servable in-browser, parity proven)
- **ONNX export** `public/models/recipe-setcompletion.onnx` (**4 MB**, clean
  opset-17 export — plain Embedding/Linear/matmul, no GINEConv issues) +
  `public/models/recipe_vocab.json` (vocab + cuisine/season id maps).
  `flavor-gnn/scripts/fm_p2_export_onnx.py` (needed `pip install onnx`).
- **Parity** `flavor-gnn/scripts/fm_p2_parity_check.mjs` (onnxruntime-node, same
  engine as onnxruntime-web): **max abs diff 2.93e-5** (tol 1e-3), top-10 ranking
  identical on both fixtures → **PASS**.
- **Browser loader** `src/ml/recipeRuntime.js` (lazy onnxruntime-web, mirrors
  `flavorGnnRuntime.js`): `loadRecipeModel()` + `suggestIngredients(observed, {cuisine,
  season, profile})`. Pure input-building + ranking unit-tested (5 tests);
  inference lazy. Full suite **1250/1250**, build clean.
- **Recipe generation (Flow A) is now an in-browser capability** — drop-in for
  Make-a-Recipe / Recipe Notebook when wired (not shipped yet, per scope).

### FM-P1-2 (ran; primary gate FAILED — this is a real finding)
`flavor-gnn/scripts/fm_p1_2_pairing_eval.py` → `flavor-gnn/artifacts/fm_p1_2_eval.json`.
Held-out pairing-edge recovery (15% holdout, 800 eval focals, embeddings-only MLP):

| Ranker | hit@10 | MRR |
|---|---|---|
| random | 0.018 | 0.009 |
| v0 cosine | 0.115 | 0.049 |
| MLP (embeddings-only) | **0.183** | **0.080** |
| co-occurrence (heuristic baseline) | **0.840** | **0.672** |

**Two conclusions:**
1. **The MLP extracts ~60% more pairing signal from the embeddings than raw
   cosine** (0.115→0.183 hit@10), and is ~10× better than random. So the
   embeddings are NOT noise, and the earlier "raw cosine looks weak" was partly
   *cosine's* low-resolution readout, not purely the embedding's fault.
2. **But co-occurrence dominates both by ~4.6×.** The trained embedding model
   does NOT beat the heuristic baseline — it loses badly. **FM-P1-2's primary
   acceptance gate fails.**

**Caveat (important):** `pairings.json` edges were themselves substantially
*derived from* RecipeNLG co-occurrence, so co-occurrence predicting those edges
is partly tautological — the baseline is close to "the gold's own source." The
0.84 is inflated by that entanglement; it is not a clean model-vs-model number.

**Decision (negative result, documented like the chemDataset dead-ends):**
- **Do NOT ship an embedding-based pairing model as a replacement for
  co-occurrence.** For recovering pairings people actually cook, recipe
  co-occurrence is the right and dominant signal.
- **Keep the embeddings as a low-weight novelty/re-rank prior only** — exactly
  the `blendPairingScores(alpha≈low)` design in FM-P1-1. Their value is
  *cross-cluster / surprising* pairs that co-occurrence is structurally blind to
  (pairs that never co-occur in recipes), which THIS eval cannot measure because
  the gold is co-occurrence-derived. Measuring novelty value needs a different
  gold (e.g. chef-rated surprising-but-good pairs) — a separate task.
- **FM-P1-3/P1-4 (train→ONNX→wire) are NOT justified for the pairing model.**
  Skip them; the JS cosine blend (FM-P1-1) is the right ceiling for the embedding
  contribution. Redirect effort to the recipe-generation model (P2), where
  recipe data — not structural embeddings — is the instrument, consistent with
  this result.

---

## 11. Extension: quantity + directions prediction (capability only, not shipped)

Added 2026-06-08. Given a few picked ingredients (the Recipe Notebook bowl / a
Make-a-Recipe selection), predict (a) a **quantity** per ingredient and (b)
**cooking directions**. User ask: *build the capability, do not wire it as a
shipped feature yet.*

### 11.1 Data reality (favorable — both labels are already on disk)

RecipeNLG rows carry the signal directly:
- `ingredients` = quantified lines, **index-aligned** to `NER` names, e.g.
  `"1 c. firmly packed brown sugar"` ↔ `"brown sugar"`,
  `"1/2 tsp. vanilla"` ↔ `"vanilla"`.
- `directions` = ordered free-text steps.

Existing app infra to reuse (do NOT reinvent):
- `src/data/portionParser.js` → `parseAmount("1 1/2 cups")` → `{qty, unit}`,
  plus `UNIT_DENSITY` gram-conversion. This is exactly `BowlEntry.amount`'s
  shape ([[RL-PORTIONS-DATA]] / [[RL-PORTIONS-UI]]).
- The Recipe Notebook already renders amount inputs per row; Make-a-Recipe
  hands off a bowl. So a quantity prediction drops straight into the existing
  `BowlEntry.amount` slot — no new UI primitive needed when it's eventually wired.

### 11.2 Quantity prediction — feasible, in-browser, piggybacks on P0

**Approach (escalating):**
1. **Statistical baseline (no training):** per-vocab-ingredient distribution of
   `(unit, qty)` parsed from the `ingredients` field — predict the modal unit and
   median qty, optionally conditioned on recipe-type / inferred serving size and
   on the ingredient's structural role (base vs accent vs seasoning). Surprisingly
   strong and trivially in-browser (a lookup table).
2. **Small conditional model:** predict `(unit, qty)` given the ingredient + bowl
   context (co-ingredients, recipe-type, serving) — a tiny MLP/embedding model,
   ONNX-exportable, in-browser via the proven `flavorGnnRuntime` path.

**This reuses the P0 corpus pass** — when FM-P0-2 streams the CSV it should ALSO
run `parseAmount` on the aligned `ingredients` line per token and emit
`(vocab_id, qty, unit)` alongside the set. One pass, two labels. Quantities are a
near-free addition to the generation corpus.

### 11.3 Directions — the in-browser tension (one real decision)

Fluent multi-step instruction text is where a small in-browser ONNX model is
weakest. Three options, in increasing quality and decreasing "in-browser-ness":

| Option | How | In-browser? | Quality | Training |
|---|---|---|---|---|
| **A. Retrieval + adaptation** | find the most ingredient-set-similar recipe(s), retrieve their real `directions`, swap ingredient names / stitch steps | ✅ fully | grounded, real, sometimes stitched-awkward | none |
| **B. Templated action-slot model** | small seq model over a cooking-action vocab (combine/sauté/fold/bake…) with ingredient slots → "Combine {a} and {b}. Cook over medium heat. Stir in {c}." | ✅ yes (small ONNX) | coherent but template-y | train on 2.2M directions |
| **C. LLM API** | send the ingredient set + predicted quantities to an LLM (e.g. Claude) → fluent directions | ❌ online, per-call cost | best | none (prompt) |

**Recommendation for the "capability now" ask: build Option A (retrieval).** It
delivers real, grounded directions with zero training and stays fully in-browser
— the honest match to the locked serving constraint. Option C is a thin wrapper
to add later if you want a fluent online mode. Option B is the most speculative
(template-y output) and only worth it if you specifically want an owned,
offline, generative directions model.

### 11.4 Paste-ready tasks (FM-Q* / FM-DIR* — stage on approval)

```json
{
  "id": "FM-Q1",
  "title": "Parse quantities from RecipeNLG ingredients field into the P0 corpus",
  "category": "data",
  "priority": 2,
  "description": "Extend the FM-P0-2 corpus pass: for each recipe, align the `ingredients` lines to NER tokens by index, run src/data/portionParser.js parseAmount on each line, map the NER token via FM-P0-1, and emit (vocab_id, qty, unit) triples. Report parse-coverage (% of ingredient lines yielding a {qty,unit}). Build-time only.",
  "acceptance": [
    "flavor-gnn/data/ingredient_quantities.parquet (or jsonl): recipe_id, vocab_id, qty, unit",
    "parseAmount reused (not reimplemented); unit set matches UNIT_DENSITY",
    "Parse-coverage reported (% of lines yielding a usable {qty,unit} vs to_taste/null)",
    "Index-alignment guard: skip recipes where len(ingredients) != len(NER)"
  ]
}
```

```json
{
  "id": "FM-Q2",
  "title": "Per-ingredient quantity statistical model + eval",
  "category": "ml",
  "priority": 2,
  "description": "From FM-Q1 triples, build a per-vocab-ingredient (unit, qty) predictor: modal unit + median qty, optionally conditioned on recipe-type and a normalized serving estimate. Emit a compact lookup artifact (in-browser-friendly). Eval against held-out recipes: unit accuracy + median-relative qty error.",
  "acceptance": [
    "flavor-gnn/data/quantity_model.json: vocab_id -> {unit, qty, by_recipe_type?}",
    "Held-out unit top-1 accuracy and qty MAPE reported vs a global-median baseline",
    "Beats the global-median baseline on qty error",
    "Artifact loads + predicts for a bowl fixture in a unit test"
  ]
}
```

```json
{
  "id": "FM-DIR1",
  "title": "Directions via retrieval + adaptation (Option A, no training)",
  "category": "ml",
  "priority": 3,
  "description": "Given a bowl ingredient set, retrieve the top-N most set-similar RecipeNLG recipes (Jaccard / weighted overlap over vocab ids) and return their real `directions`, with ingredient names swapped to the bowl's. Provides grounded directions fully in-browser. Build a retrieval index keyed by vocab-id sets.",
  "acceptance": [
    "flavor-gnn/data/directions_index.* enabling top-N set-similar recipe lookup",
    "Given a 3-5 ingredient bowl, returns >=1 recipe's directions with names adapted to the bowl",
    "Retrieval is deterministic and runs client-side-feasibly (index size budget documented)",
    "Unit test: a known ingredient set retrieves a plausibly matching recipe's steps"
  ]
}
```

```json
{
  "id": "FM-DIR2",
  "title": "(Optional) LLM-API directions adapter (Option C) behind a flag",
  "category": "ml",
  "priority": 4,
  "description": "Thin adapter that, when an online flag is set, sends the bowl + FM-Q2 quantities to an LLM and returns fluent directions. Documented as the higher-quality online mode; NOT the default. Capability scaffold only, no UI wiring.",
  "acceptance": [
    "A documented function: (ingredients, quantities) -> directions text via LLM",
    "Gated behind an explicit online flag; default OFF (offline retrieval is default)",
    "No secrets committed; provider call isolated for easy swap",
    "Not wired into shipped UI (capability only)"
  ]
}
```

**Dependencies:** FM-Q1 extends FM-P0-2 (same CSV pass) → FM-Q2. FM-DIR1 needs the
P0 vocab-id corpus (FM-P0-2) for the retrieval index; FM-DIR2 is optional and
depends on FM-Q2 for quantities. **Quantities and directions are capability
scaffolds — per the user, build the capability, do not ship the UI yet.**
