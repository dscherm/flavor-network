# Spec: Flavor Bible Curated Pairing Layer

> **Mode: interactive bridge design — DO NOT commit or execute until explicitly
> approved.** This spec + the plan blocks below are the deliverable; implementation
> is a separate, approved step.

> **🟢 STATUS — IMPLEMENTED 2026-06-11 (approved + executed in-session; NOT yet
> committed).** All 5 tasks done. `npm test` 1256/1256 green, `npm run build`
> clean. Two refinements vs the original design, both prompted by the
> mid-implementation honest-measurement check:
>
> 1. **Shipped the PRECISE match set (8,270 pairs / 449 ingredients), not the full
>    9,557.** The v2 matcher's `head`-noun + `fuzzy` stages (320 of 2,661 names) are
>    heuristic and would assert false FB endorsements. For a curated *authoritative*
>    layer precision > recall, so those two stages are gated behind `--precise` (off
>    by default for the shipped artifact). The 0.58 learned-classifier AUROC is the
>    number for *predicting FB pairs from the GNN profile* — which this layer does
>    NOT do; it uses FB membership directly as set-intersection (like
>    areeves87/Flavor-Bible-App `match_up()`). So the weak AUROC is the rationale for
>    direct set-intersection, not a problem for it.
> 2. **Discovered 82% of FB pairs have no corpus edge** — they ARE the canonical-but-
>    corpus-missed pairings this layer exists to surface. `topAffinities` now walks an
>    `flavorBibleNeighbors` adjacency map (built in useProData), so α-mode surfaces
>    them (verified: thyme +76, basil +55, almond +80 newly-surfaced FB pairs).
>
> **Follow-up DONE (2026-06-11):** FB-only (corpus-edgeless) pairs now surface in all
> three surfaces, not just α-mode:
> - **PairingMode** appends FB-only neighbors to the swipe deck (strength 0 → sorted
>   after every corpus pair), hydrated to real graph nodes, badged via `fb:true`.
> - **IngredientPanel** gains a distinct, collapsed-by-default **"Also in The Flavor
>   Bible"** section (`FlavorBibleOnlySection`) listing corpus-edgeless FB pairings —
>   kept separate so the strength-ranked Top Pairings list, its wheel, and the
>   "strongest bond" insight stay purely corpus-driven. Both IngredientPanel mounts
>   now receive `affinityCtx={data}` (previously unset, so the badge was inert there).
> - Shared helpers `isInFlavorBible` / `flavorBibleOnlyNeighbors` exported + unit-
>   tested (8 cases). The main-branch Top Pairings row also gained the inline 📖 badge
>   (the first pass had only badged the embedded branch).
> All surfaces complete. `npm test` 1264/1264, build clean.

## Metadata
- Interview ID: `flavor-bible-pairing-layer-2026-06-11`
- Type: **brownfield** (app data + UI — `src/`, `scripts/`, `public/proDataset/`)
- Generated: 2026-06-11
- Status: **PENDING APPROVAL (design — no execution)**
- Derivation: Direct follow-on from
  `flavor-gnn/artifacts/MODEL_INVESTIGATION_SUMMARY_2026-06-10.md` §7.1, which named
  this "the highest-value, lowest-effort, no-ML lever the investigation surfaced."
  Memory: [[project_molecular_model_weak_at_ingredient_level]].

## Decisions (interactive-bridge intake, 2026-06-11)
| # | Question | Decision |
|---|---|---|
| 1 | How should an FB-listed pairing affect the surfaces? | **Tier floor + badge.** A pair present in the FB set earns `tier = max(base_tier, 2)` AND a `📖 Flavor Bible` provenance badge. Canonical pairs are never hidden by low corpus co-occurrence. |
| 2 | Which match-set ships? | **Regenerate to the larger match** (~9,557-class). The on-disk file is the older 5,457-pair / 376-ingredient v1 output; the v2 matcher is more permissive but currently doesn't persist. |
| 3 | Which surfaces, first pass? | **All three:** α-mode affinity rings, IngredientPanel pairings list, SuggestionDrawer (PairingMode). |

---

## Goal

Add **The Flavor Bible's curated pairings as a third, high-reliability signal** in
the app's pairing/affinity layer — complementary to the existing RecipeNLG
co-occurrence strength and molecular bridge-compound signals. The investigation
established (three converging ground truths) that the molecular GNN is a weak
pairing signal; curated graphs are the reliable lever. RecipeNLG co-occurrence is
already shipped; this spec adds the Flavor Bible graph alongside it.

The integration is **set-intersection presence** (like the reference app
areeves87/Flavor-Bible-App): "is `(a,b)` listed in the Flavor Bible?" → a boolean
endorsement that floors the tier and shows provenance.

---

## Background evidence (traceable)
- `MODEL_INVESTIGATION_SUMMARY_2026-06-10.md` §7.1 — recommendation to integrate FB
  as a complementary pairing layer; `flavor_bible_matched.json` named as the
  shippable asset.
- `scripts/match_flavor_bible_v2.py` — the matcher. Reads `data/flavor_bible_full.csv`
  (25,844 `main→pairing` rows) and `public/proDataset/gnn_entropy.json` keys as the
  ingredient universe; cascade exact→synonym→singular→token-set→head→fuzzy.
  **Audit note:** `main()` prints `matched unique pairs` but **does not write any
  file** — the on-disk `flavor_bible_matched.json` (5,457 pairs / 376 ingredients,
  `{pairs, n}`) was produced by the older `scripts/match_flavor_bible.py`. The
  regenerate task must add a persistence step to v2.
- `src/data/affinityTiers.js` — `tierFor(a,b,ctx)` is the fusion point. Already
  blends co-occurrence (`ctx.pairingStrength`) + molecular bridge
  (`ctx.bridgeCompoundIndex`). Returns `{tier:3|2|1|null, strength, bridge}`.
- `src/components/LivingArchView.jsx:2040-2046, 2184-2189` — assembles the affinity
  ctx from `data.{pairingStrength, top5, bridgeCompoundIndex, affinityThresholds}`.
  `data` is produced by `useProData`. This is where `flavorBibleSet` threads in.
- `src/hooks/useProData.js` — loads the proDataset artifacts; the place to fetch
  `flavor_bible_matched.json` and build the `Set<"a|b">`.

---

## Design

### Data: canonical-keyed lookup
- Build `flavorBibleSet: Set<string>` of canonical keys `min(a,b)+"|"+max(a,b)` from
  `flavor_bible_matched.json.pairs`. Canonical ordering (sorted) makes membership
  test order-independent; `tierFor` tests both `a|b` and `b|a` regardless, but
  canonical keying keeps the set half-size and unambiguous.
- Loaded once in `useProData`, exposed as `data.flavorBibleSet`. Null-safe: if the
  fetch fails, the set is empty and `tierFor` behaves exactly as today (pure
  additive, zero regression risk).

### Fusion: `tierFor` tier-floor + badge
```
// after existing tier computation, before return:
const fbKey = canonical(a,b);
const inFB = ctx.flavorBibleSet?.has(fbKey) ?? false;
if (inFB) {
  tier = (tier == null) ? 2 : Math.max(tier, 2);   // floor at ★★
  fb = true;                                        // provenance flag
}
return { tier, strength, bridge, fb };
```
- **Floor at ★★ (not ★★★):** ★★★ retains its meaning (chemistry-bridged or
  exceptional corpus strength). FB endorsement guarantees a *strong* pairing but
  doesn't claim molecular bridging. A pair that is BOTH FB-listed and
  chemistry-bridged still earns ★★★ via the existing branch.
- **`fb` flag** rides on every `tierFor` result so all three renderers can show the
  `📖 Flavor Bible` badge. `topAffinities`/`surprisingAffinities` spread `...t`, so
  `fb` propagates for free.
- **Untiered→tiered:** an FB pair with zero corpus strength currently returns
  `{tier:null}` and is dropped by `topAffinities`. With the floor it becomes ★★ and
  surfaces — this is the core value (canonical pairs the corpus under-weighted).

### Surfaces (all three)
1. **α-mode affinity rings** — `topAffinities` already returns `fb`; `AffinityMode.js`
   / AffinityPanel renders the badge on ring spheres/edges. Ring placement is by
   strength rank (unchanged); FB pairs with 0 strength sort last within their ring
   but are no longer dropped.
2. **IngredientPanel pairings list** (`src/components/IngredientPanel.jsx`) — show
   `📖` next to FB-listed pairings.
3. **SuggestionDrawer / PairingMode** (`src/components/PairingMode.jsx`) — consumes
   the same ctx; surface the badge in the suggestion rows.

---

## Constraints
- **Purely additive.** When `flavorBibleSet` is empty/absent, every surface behaves
  exactly as today. No existing tier can be *lowered* by this change.
- **No molecular-model work.** This is the no-ML curated-graph lever; do not touch
  `flavor-gnn/`.
- **Provenance preserved on the data artifact.** Regenerated
  `flavor_bible_matched.json` keeps the `{pairs, n}` shape; bump `n` and (optional)
  add a `_source`/`_generated` provenance key. No licensing/origin notes (per
  standing directive — training project).
- **Regenerate must be reproducible.** The v2 matcher write-step is committed so the
  artifact can be rebuilt; record the final matched-pair count in the spec/plan.

## Non-Goals
- Re-deriving or re-scraping the Flavor Bible source CSV (already in
  `data/flavor_bible_full.csv`).
- Weighting FB by frequency/rank — this pass is boolean set-intersection only.
- Cocktail/Sauce Lab pairing surfaces (separate graphs; out of scope this pass).
- Any change to molecular GNN artifacts or `compoundFoods.js`.

---

## Acceptance Criteria (per task → plan.md blocks)

### FB-PAIR-1 — Regenerate the matched graph (data)
- [ ] Add a persistence step to `scripts/match_flavor_bible_v2.py` that writes
      `public/proDataset/flavor_bible_matched.json` as `{pairs:[[a,b]...], n, _generated}`.
- [ ] Run it; record the final matched-pair count (expect > 5,457). Verify all
      ingredient names in `pairs` exist as keys in `ingredients.json` /
      `gnn_entropy.json` (no orphan vocabulary).
- [ ] Larger file replaces the 5,457 version on disk.

### FB-PAIR-2 — Load `flavorBibleSet` in useProData
- [ ] Fetch `flavor_bible_matched.json` in `src/hooks/useProData.js`; build
      `Set<canonicalKey>`; expose as `data.flavorBibleSet`. Null-safe on fetch failure.
- [ ] Unit: set membership is order-independent (`a|b` and `b|a` both hit).

### FB-PAIR-3 — Tier-floor + badge in affinityTiers
- [ ] `tierFor` floors tier at 2 and sets `fb:true` when the pair is in
      `ctx.flavorBibleSet`; result shape gains `fb`. Existing ★★★ branch unaffected.
- [ ] `topAffinities` no longer drops FB pairs that were previously untiered.
- [ ] Unit tests in `src/data/affinityTiers.test.js`: (a) FB pair with 0 strength →
      tier 2 + fb; (b) FB pair already ★★★ → stays 3 + fb; (c) non-FB pair unchanged;
      (d) empty/undefined `flavorBibleSet` → identical to current behavior.

### FB-PAIR-4 — Thread ctx through LivingArchView
- [ ] Add `flavorBibleSet: data.flavorBibleSet` to the ctx objects at
      `LivingArchView.jsx:2043-2046` and `:2186-2189` (and the categorical ctx at
      :3098 if it feeds tierFor).

### FB-PAIR-5 — Render the badge on all three surfaces
- [ ] α-mode (AffinityMode/AffinityPanel): `📖 Flavor Bible` indicator on FB edges.
- [ ] IngredientPanel pairings list: `📖` marker on FB-listed pairings.
- [ ] PairingMode/SuggestionDrawer: `📖` marker on FB-endorsed suggestions.

### Cross-cutting
- [ ] `npm test` green (76 files / 788 tests baseline + new affinityTiers cases).
- [ ] `npm run build` clean.
- [ ] Manual: pick an FB-canonical pair weak in the corpus (e.g. a classic herb+protein
      combo) and confirm it now surfaces with the badge where it was hidden before.
- [ ] **NO COMMITS** until approved.

---

## Risks / Notes for Executor
1. **`match_flavor_bible_v2.py` does not write a file today.** Don't assume re-running
   it regenerates the artifact — you must add the write step (FB-PAIR-1). Confirm the
   pair count printed by `main()` and persist exactly that set.
2. **Tier inflation.** Flooring at ★★ promotes every FB pair. With ~9.5k pairs across
   ~hundreds of ingredients this is intended, but spot-check that a hub ingredient's
   ring isn't entirely FB-flooded to the point of drowning chemistry-bridged ★★★ — if
   so, the renderer should sort ★★★ ahead of FB-floored ★★ within a ring.
3. **Strength-0 FB pairs in `topAffinities`.** They now pass the `if(!t.tier)` gate and
   sort last by strength within their ring — verify ring slicing (5/10/15) still fills
   sensibly and doesn't push genuine high-strength pairs off the visible rings.
4. **Name-space alignment.** FB pairs are keyed on `gnn_entropy.json`/ingredient names;
   confirm those match the names used as graph node ids in `ctx.graph` (FB-PAIR-1
   verification covers this).
5. **`tierFor` is hot** (called per edge in `topAffinities` over all neighbors). The FB
   check is one `Set.has` — O(1), negligible.
