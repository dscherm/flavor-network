# RALPLAN — Flavor Model Expansion (Phase 1, 1 week)

> ⚠ **PARTIALLY SUPERSEDED (2026-05-19):** P0 + P1 of this plan shipped as commit
> `a04486e`. P2–P6 are **superseded** by `.omc/plans/ralplan-flavor-model-expansion-v3-pathAB.md`
> because the chef-saved CSV expanded from 6 → 9 columns (added `key_pairings`,
> `pairing_principles`, `chemistry_notes`) and the row set shrank from 500 → 73
> chef-verified rows. The richer schema means the next priority is validating
> the chemistry signal via a small classifier (Path A) before refactoring the
> GAT (Path B). The UI deliverables (this plan's P3–P6) become Path C of v3,
> running against new GAT embeddings instead of the original `flavor_graph.json`.
> Read v3 for the current path forward.

**Mode:** short (consensus / direct)
**Source spec:** `.omc/specs/deep-interview-flavor-model-expansion.md` (17.9% ambiguity, 6 rounds, PASSED)
**Downstream of:** commits `03681b0` (Track 3 Guided Overhaul) + `b94779c` (Network Cleanup Tactical Pack)
**Branch target:** master
**Phase 2 (1.5w, deferred):** held-out cross-check + chef walkthrough — NOT in this plan.

---

## R2 Changelog (2026-05-18, after Architect REVISE + Critic ITERATE)

This iteration addresses 12 sign-off conditions from R1 review. All fixes are surgical (~2 hours).

### Critical / blocking fixes
- **Item 1 — Threshold artifact + shape correction.** Rewrote every reference to `odor_thresholds.json` to use `ingredient_profile_thresholds.json` (the ingredient-level artifact per `src/utils/predictedProfile.js:7-39`). All consumers project `per_task: [{task, ingredient_threshold, molecule_f1}]` → `{task → ingredient_threshold}` dict. Bake script, JS consumers, N1-ADR-3 (was R1 ADR-3), Decision C, spec fixture wording, and §2.4 mint canonical predicate now all use `ingredient_threshold` not bare threshold. Documented in N1-ADR-3.
- **Item 2 — Scaffold idempotency (P0).** P0 script now reads existing CSV if present, preserves any row where ANY tier column is non-empty (manual-edit detection by row content, not just by name), and only fills empty rows. New §2.4 P0 verification gate asserts mint/vanilla/soy sauce/lemon/garlic tier columns survive a scaffold re-run.
- **Item 3 — Tier-2 curated-path coverage AC.** Added explicit P2 AC: "≥20 top-500 ingredients have `tier2_taste` containing one of `{pungent, astringent, spicy}` via curated `node.taste` overlay" (N=20 lower-bound; raise post-audit of `node.taste` distribution). §2.4 P2 grep gate enforces it on the baked artifact.
- **Item 4 — P5/P6 soak + visual-diff gate.** Inserted soak point in §2.3 schedule: D5 AM ships P5, D5 PM is reserved as soak/QA window, P6 slips to D6 AM. P5 bake emits `flavor_recolor_diff.json` (per-ingredient `old_color → new_color` from `node.taste` → `BRISCIONE_AROMA[primary_tier1]`). §2.4 P5 gate fails if `>50` catastrophic transitions (sweet→woody, sour→fatty, etc.).
- **Item 5 — ADR numbering collision.** Renumbered this plan's ADRs to `N1-ADR-1..N1-ADR-4` (plan-scoped IDs). The bare "ADR-1" reference inside §1.1 Principle 5 now reads "ADR-1 from the prior delivery (commit `b94779c`)" to disambiguate.
- **Item 6 — Placeholder verification commands.** §2.4 P1 (byte-equality) and P6 (`MODE_CYCLE.length`) replaced with concrete one-liners + expected exit codes / stdout.
- **Item 7 — Test count gates tightened to exact.** Each phase now states its delta from 736 baseline (P0 +1→737, P1 +1→738, P2 +1→739, P3 +3→742, P4 +5→747, P5 +2→749, P6 +3→**752**). Final §2.4 P6 gate asserts `== 752` not `≥`. Full per-phase delta table in §2.4.

### Non-blocking but accepted
- **Item 8 — Lesson codification depth (how=2/how=3).** P2 already plans `sources: ['manual-top-500']` (how=2; confirmed); added explicit docstring requirements to `flavor_layout_v2.py` and `bake_flavor_graph.py` per how=3; added `npm run bake:flavor-pipeline` as a chained orchestrator.
- **Item 9 — `flavor_recolor_diff.json` size estimate.** ~3,913 entries × ~80 bytes ≈ 320 KB; committed to `flavor-gnn/artifacts/` (not `public/`) since it's a diagnostic, not runtime.
- **Item 10 — P6 effort bump.** P6 effort raised from 0.5d to 1d. Schedule extends to D6 AM (total 5.5d work + 0.25d buffer = 5.75d).
- **Item 11 — N1-ADR-2 (was ADR-2) B2 caveat.** Steelman acknowledged: B2 would be lighter for a single dual-tier term (`pungent`). Rejection now rests on the spec's ontology listing `TierBadge` as a first-class entity AND on the executor's likelihood of needing it again in Phase 2 chef walkthrough.
- **Item 12 — Long-tail coverage AC.** Chose path (b): explicit AC documenting the Phase-1 silence expectation. Long-tail rule table stays at ~40 seeds (Item 12 path-b); Phase-2 walkthrough is the recovery path.

---

## 1. RALPLAN-DR Summary

### 1.1 Principles (non-negotiable)

1. **`BRISCIONE_TASTE` is byte-locked.** Any commit that changes `src/data/briscionePalette.js`'s `BRISCIONE_TASTE` literal is a hard fail. Codified as a grep gate: `(Select-String 'BRISCIONE_TASTE\s*=' src/data/briscionePalette.js).Count == 1`.
2. **Mint is the canonical fixture.** Every phase that touches data or rendering must preserve the mint tree end-to-end: `tier1_aroma=['green']`, `tier2_taste⊇{'bitter','astringent'}`, `tier3_mouthfeel⊇{'cooling','pungent'}`, `leaves==['menthol','fresh','sharp','grassy','herbaceous']`. Mint is asserted at the schema gate AND at the renderer-integration gate.
3. **All 736 existing tests stay green per phase.** Each phase ends with `npx vitest run` exit 0. Never commit on a partial-green suite.
4. **Manual curation is sacred — never wiped by a rule-derivation re-run.** Per lesson `pipeline-rebuild-wipes-manual-data-additions` how=5, the long-tail rule-derivation step (which can be re-run) must merge ON TOP of the chef-curated top-500 file, never write through it. Manual entries are tagged with a `sources: ['manual-top-500']` flag; the pre-commit verifier greps for ≥3 known manual fixtures (mint, vanilla, soy sauce) by name and fails the build if any are missing from `flavor_graph.json`.
5. **Hide-without-delete contract preserved.** The new `flavor2D` mode key adds to internal mode resolution but does NOT enter `MODE_CYCLE` unless that change is explicitly part of the deliverable; existing `effectiveLegacyMode('3D') → 'ml'` regression contract from **ADR-1 of the prior delivery (commit `b94779c`)** stays passing. NOTE: throughout this plan, ADRs from the prior Network Cleanup Tactical Pack delivery are referenced as "prior ADR-N" or "ADR-N (commit `b94779c`)". This plan's own ADRs use the namespaced prefix `N1-ADR-1..N1-ADR-4` (see §4).

### 1.2 Decision Drivers (top 3, ranked)

1. **Ship-by-day-5 fits within Phase-1 budget.** The 1-week window is the binding constraint. Any decision that pushes effort over 5d gets rejected even if it produces a "better" artifact. Phase 2 absorbs quality bumps.
2. **Schema must be re-bakeable without losing chef work.** Top-500 manual curation is the most expensive human-time input; the architecture must support re-running the long-tail rule-derivation cheaply without disturbing it.
3. **Tier-3 long-tail accuracy ≤ Tier-1/Tier-2 accuracy is acceptable.** Spec explicitly allows partial graphs in the long-tail (>500 by `pairingCount`). The 80%-of-top-500 coverage AC is the sole gate; rule-derivation quality for the 3,400+ long-tail is Phase-2 verification material.

### 1.3 Viable Options + Chosen Path

#### Decision A — Long-tail Tier-3 rule-derivation: offline-baked vs. runtime in `useProData`

| Option | Pros | Cons |
|---|---|---|
| **A1. Offline-baked (chosen)** — A Node.js or Python script reads `gnn_compounds.json` + top-500 manual curation CSV, emits the final merged `flavor_graph.json` once. Re-run only on data refresh. | Smaller runtime JSON (one fetch). Deterministic. Easy verification gate (grep the artifact). Aligns with existing offline-build pattern (`flavor_layout_v2.py`, `bake-pairings`). | Adds one script to the offline pipeline. Re-bake requires running the script. |
| A2. Runtime-derived in `useProData` | No offline step; ships the rule table as JS. | Increases load-time work (3,400 ingredients × tag lookup at every cold-start); harder to gate-verify; harder to inspect output; couples data shape to JS data structures. |

**Chosen: A1 (offline-baked).** A2 was rejected because lesson `pipeline-rebuild-wipes-manual-data-additions` mandates merge-aware ordering, which is naturally enforced by an offline script's step sequence (rebuild rules → merge manual → write artifact). Runtime derivation would need the same merge logic at every cold-start, with no inspection surface.

#### Decision B — `TierBadge` implementation: separate component vs. inline tier-aware label helper

| Option | Pros | Cons |
|---|---|---|
| **B1. Separate `TierBadge` component (chosen)** — `src/components/TierBadge.jsx` renders the badge given `{ tier: 2|3, term: string }`. Accessible name auto-derived: "Tier-2 taste" / "Tier-3 mouthfeel". | Single render-site to maintain. Easy a11y verification. Re-usable when a future delivery needs T1/T4. Easy to unit-test in isolation. | Adds one file. |
| B2. Inline helper that returns a styled `<span>` per term | Zero new files. | A11y label drift across multiple call sites. Harder to test. Tier semantics scattered. |

**Chosen: B1.** Spec ontology lists `TierBadge` as a first-class entity (row 7); making it a component honors the schema. B2 was rejected because a11y disambiguation is the binding gate per spec line 108 — concentrating that in one component reduces drift risk.

#### Decision C — Primary-Tier-1 selector: client-side per-frame vs. baked into `flavor_graph.json`

| Option | Pros | Cons |
|---|---|---|
| **C1. Baked into `flavor_graph.json` (chosen)** — Offline script computes `primary_tier1_aroma` per ingredient using `gnnProbs[odor_*]` + `ingredient_profile_thresholds.json` `ingredient_threshold` per task + tie-break by `AROMA_AXES` order. Emits as a top-level field on each ingredient entry. | Zero per-frame compute. Deterministic across reloads. One source of truth. Verifiable (assert the computed primary at bake time matches the AC fixture). | Re-bake when thresholds change. |
| C2. Client-side per-frame in NodeMesh | Live re-compute when thresholds update without re-bake. | Hot path cost (3,913 ingredients × per-frame color resolution if naive; cached if memoized). Two implementations to keep in sync — one for re-color, one for filter-axis. Hard to unit-test the renderer's selection. |

**Chosen: C1.** Driver 2 (re-bakeable without losing chef work) is satisfied because primary-Tier-1 derives only from `gnnProbs` + `ingredient_threshold`s, both immutable in this delivery. C2 was rejected because the spec includes a fixture-style unit test (`tier1_aroma:['woody','fruity']` + ingredient_thresholds → `'fruity'`) that's easier to assert on the bake script than on a Three.js path.

**Why `ingredient_profile_thresholds.json` not `odor_thresholds.json`:** Per `src/utils/predictedProfile.js:7-39` (existing project pattern), the molecule-level `odor_thresholds.json` is calibrated per-compound and "almost never triggers" when applied to ingredient mean-pool probabilities (mean-pool dilutes molecule-level extremes). `ingredient_profile_thresholds.json` is the p85-of-ingredient-distribution calibrated threshold and is the existing project convention for ingredient-level decisions. Codified in N1-ADR-3.

#### Decision D — Filter-axis integration: extend existing `FilterPillRow` vs. fork

| Option | Pros | Cons |
|---|---|---|
| **D1. Extend existing `FilterPillRow` (chosen)** — Add `'flavor-category'` to `FILTER_KEYS` and `FILTER_LABELS` in `src/data/networkModes.js`; add `'flavor-category' → null` to `FILTER_TO_AXIS` (it's visibility-only, not a morph driver, in Phase 1). Renderer handles the visibility predicate when the pill is active. | Zero new components. Reuses pill row's existing horizontal-scroll + a11y + interaction grammar (commit `b94779c`). User mental model is one filter row. | Couples flavor-graph to existing pill order; minor UX risk if pill row becomes long. |
| D2. Fork — new `FlavorCategoryPillRow.jsx` parallel row | Independent evolution. | Two interaction rows = user confusion. Track-3 ADR-5's fork pattern was for radar-style UI, not pill rows — wrong precedent. |

**Chosen: D1.** Phase-1 filter is visibility-only (no morph layout for flavor-category yet); D1 satisfies this with one line in `networkModes.js` + a predicate in the renderer. D2 was rejected because the spec describes one filter pill ("flavor-category or similar") alongside existing pills — same row.

---

## 2. Full Implementation Plan

### 2.1 Phase Dependency Graph

```
       ┌─────────────────────────────────────────────────────────────┐
       │ P0 — Curation scaffolding (BLOCKS chef-user)                │
       │  ⇣ chef CSV starts filling                                  │
       └─────────────┬───────────────────────────────────────────────┘
                    │
       ┌────────────┴────────────────────────────────────────────────┐
       │                                                             │
       ▼                                                             ▼
┌────────────────────────┐                          ┌────────────────────────────────┐
│ P1 — flavor_layout_v2  │                          │ P2 — Long-tail rules + baker   │
│ extends to 2D output   │  (parallel-eligible)     │ rule table + offline bake      │
└──────────┬─────────────┘                          └────────────────┬───────────────┘
           │                                                         │
           └────────────────────────────┬────────────────────────────┘
                                        ▼
                          ┌──────────────────────────────────┐
                          │ P3 — useProData loads new files  │
                          │ + primary_tier1 surfacing        │
                          └────────────────┬─────────────────┘
                                           │
                          ┌────────────────┴─────────────────┐
                          │                                  │
                          ▼                                  ▼
              ┌──────────────────────────┐    ┌─────────────────────────────┐
              │ P4 — IngredientPanel +   │    │ P5 — Network re-color path  │
              │ TierBadge tree-view      │    │ NodeMesh primary_tier1 hook │
              └──────────────────────────┘    └──────────────┬──────────────┘
                                                             │
                                              ┌──────────────┴──────────────┐
                                              │ P6 — flavor2D mode + filter │
                                              │ pill + final QA             │
                                              └─────────────────────────────┘
```

P1 + P2 are parallel-eligible after P0 ships its CSV scaffold and chef-user starts curation. P4 + P5 are parallel-eligible after P3 lands `useProData`.

### 2.2 Per-Phase Detail

#### P0 — Curation scaffolding (D1 morning, 0.25d)

**Goal:** Unblock chef-user's curation work immediately so it overlaps with executor's P1/P2 work.

**Files:**
- NEW `flavor-gnn/scripts/scaffold_top500_curation.py` — **idempotent merger** (lesson `pipeline-rebuild-wipes-manual-data-additions` how=1):
  1. Read `public/proDataset/ingredients.json`, sort by `pairingCount` desc, take top-500.
  2. If `flavor-gnn/curation/top500_flavor_graph.csv` already exists, load it into a dict keyed by `name`. For each existing row where ANY of `tier1_aroma | tier2_taste | tier3_mouthfeel | leaves` is non-empty, mark it as "manual-edited" and preserve VERBATIM in the output.
  3. For any name in the top-500 not present in the existing CSV, append a new empty row with `sources=manual-top-500`.
  4. For names present but with ALL four tier columns empty, refresh the row (keep the slot; chef may have re-prioritized).
  5. Names dropping out of the top-500 (e.g., pairing graph re-bake shifted them) are LOGGED to stderr but preserved in the file (we never silently delete chef work).
- NEW `flavor-gnn/curation/README.md` — instructions for the chef-user; documents the idempotency contract above.
- NEW `flavor-gnn/curation/top500_flavor_graph.csv` — script output. Columns: `name, tier1_aroma, tier2_taste, tier3_mouthfeel, leaves, sources` (the last col pre-filled with `manual-top-500`).
- Mint, vanilla, soy sauce, lemon, garlic — 5 fixtures pre-filled by the executor as bootstrap so verification gates have anchors AND so the chef-user has a worked example.
- **Script docstring requirement (lesson how=3):** the file header must say "Re-running this script preserves any row where any tier column is non-empty. Empty rows are refilled from `ingredients.json` top-500 by `pairingCount`. Manual entries are never overwritten by re-run."

**Effort:** 0.25d

**Tests:**
- Unit: `scaffold_top500_curation.test.py` (Python pytest) — three cases:
  1. `n_rows == 500` on a fresh run (no prior CSV).
  2. Mint row pre-filled with canonical fixture survives a re-run.
  3. **Idempotency:** run scaffold, manually edit a row (e.g., add `tier1_aroma=fruity` to a junk name), re-run scaffold, assert that edited row is byte-identical to before re-run.

**Risks:**
- Chef-user blocking on Day 2 if scaffold doesn't ship at start of Day 1 → mitigated by P0 priority.
- Idempotency bug silently wipes a row → mitigated by §2.4 P0 re-run gate + Test #3 above.

**Acceptance:**
- [ ] `top500_flavor_graph.csv` exists with 500 data rows.
- [ ] Mint row exactly matches the canonical fixture.
- [ ] Vanilla bean / soy sauce / lemon / garlic rows pre-filled and non-empty.
- [ ] **Idempotency: re-running scaffold with no source data change produces a byte-identical CSV** (`git diff --exit-code flavor-gnn/curation/top500_flavor_graph.csv`).
- [ ] **Manual-row preservation: pre-existing rows where any tier column is non-empty survive re-run with all columns intact.**

#### P1 — `flavor_layout_v2.py` extends to 2D output (D1 afternoon, 0.5d)

**Goal:** Emit `public/proDataset/flavor_positions_2d.json` from the same UMAP-input vectors as the existing 3D output, in one run.

**Files:**
- MODIFY `flavor-gnn/scripts/flavor_layout_v2.py` — after the existing 3D `reducer.fit_transform(Xn)` block (line ~485), call a second `umap.UMAP(n_components=2, ...same params...)` and emit `flavor_positions_2d.json` alongside `flavor_positions.json`. Same alias-mirror loop applies.
- Add `OUT_POS_2D = ROOT / "public" / "proDataset" / "flavor_positions_2d.json"` constant.
- **Docstring requirement (lesson how=3):** the file header must add: "Downstream consumer: `flavor-gnn/scripts/bake_flavor_graph.py` consumes `flavor_positions.json` indirectly via the ingredient list. Re-running `flavor_layout_v2.py` REQUIRES re-running `bake_flavor_graph.py` afterward to refresh the merged graph artifact. Use `npm run bake:flavor-pipeline` to chain both."

**LOC delta:** +35 / -0 in `flavor_layout_v2.py`.

**Effort:** 0.5d

**Tests:**
- Existing `flavor_positions.json` byte-equality check before / after the extension (same UMAP seed, same input vectors — 3D output is unchanged).
- New: `flavor_positions_2d.json` exists, every value is a 2-element array, set of keys equals set of keys in `flavor_positions.json`.

**Risks:**
- UMAP at `n_components=2` may scramble cluster separation (Risk 4). Phase-1 ships the JSON regardless; the 2D toggle becoming the user's default is a UX call deferred to chef-user soak.

**Acceptance:**
- [ ] Script run produces both files in one invocation.
- [ ] `flavor_positions_2d.json` parses; every entry is `[x, y]`.
- [ ] Same ingredient set as `flavor_positions.json`.
- [ ] Existing 3D output byte-identical to pre-change.

#### P2 — Long-tail rules + offline baker (D2, 1d)

**Goal:** Build the rule table that maps `gnn_compounds.json` Level-2/3 descriptor tags → Tier-3 mouthfeel + leaves; bake the merged `flavor_graph.json`.

**Files:**
- NEW `flavor-gnn/curation/longtail_rules.json` — declarative rule table. Shape:
  ```json
  {
    "tag_to_tier3": {
      "minty": ["cooling"],
      "menthol": ["cooling", "pungent"],
      "coconut": ["creamy"],
      "buttery": ["creamy", "sticky"],
      "...": []
    },
    "tag_to_leaves": {
      "minty": ["menthol", "fresh"],
      "coconut": ["coconut"],
      "...": []
    }
  }
  ```
  Initial table seeded with ~40 entries from `_GENERIC_DESCRIPTORS` (negative list in `flavor_layout_v2.py`) inverted — the descriptors that AREN'T generic become positive tag-anchors.
- NEW `flavor-gnn/scripts/bake_flavor_graph.py` — the offline merger. Step sequence:
  1. Load `public/proDataset/gnn_entropy.json` (for `gnnProbs`).
  2. Load `public/proDataset/ingredient_profile_thresholds.json` (for calibrated **ingredient-level** thresholds, NOT `odor_thresholds.json` — the latter is molecule-level and is washed out by ingredient mean-pooling per `src/utils/predictedProfile.js:7-39`). Project `per_task: [{task, ingredient_threshold, molecule_f1}]` → `{task → ingredient_threshold}` dict. Skip rows where `molecule_f1 < 0.4` (matches existing predictedProfile contract).
  3. Load `public/proDataset/gnn_compounds.json` (for Level-2/3 tags).
  4. Load `public/proDataset/ingredients.json` (for curated `node.taste` overlay used in step 4b).
  5. **Rule-derive Tier-1 + Tier-2 from `gnnProbs`** for every ingredient where `gnnProbs` exists:
     - `tier1_aroma = [k.replace('odor_', '') for k in odor heads where prob ≥ ingredient_threshold[k]]`
     - `tier2_taste (GNN slice) = [k for k in {'sweet','sour','bitter','salty','umami'} where prob ≥ ingredient_threshold[k]]`. Skip `salty` and `odor_spicy` per chemDataset-status policy (F1 < 0.50; do not surface from GNN).
     - **(4b) `tier2_taste (curated slice)`** = tokens from `node.taste` that match BRISCIONE_TASTE vocabulary. THIS is the only path by which `{pungent, astringent, spicy}` enter tier2_taste, because GNN has no head for them. Union with the GNN slice.
  6. **Rule-derive Tier-3 + leaves from descriptor tags.** For each ingredient, look up its `top_compounds[].tags` in `tag_to_tier3` / `tag_to_leaves`; deduplicate.
  7. **Compute primary_tier1_aroma** per ingredient: argmax `gnnProbs[odor_*]` over the keys in `tier1_aroma`, tie-break by `AROMA_AXES` order. If `tier1_aroma` is empty, primary is `null`.
  8. **Load `top500_flavor_graph.csv`** (chef-curated) and OVERLAY on top of rule-derived entries. Manual entries WIN on conflict (per-tier replacement: manual tier1 wipes rule-derived tier1 for that ingredient; tiers manual leaves empty fall through to rule-derived). Tag the merged entry with `sources: ['rule-derived', 'manual-top-500']` (or one of the two).
  9. **Build vocabulary block** by gathering distinct values across all ingredients per tier.
  10. **Emit `public/proDataset/flavor_graph.json`** with `{ ingredients, vocabulary, _meta: { generated_at, source_versions, threshold_artifact: "ingredient_profile_thresholds.json" } }`.
  11. **Pre-write verification step** (lesson how=5): assert `flavor_graph.ingredients['mint']` matches the canonical fixture exactly; assert ≥5 known manual entries (mint, vanilla, soy sauce, lemon, garlic) survive the merge with `sources` containing `'manual-top-500'`. If any check fails, abort write and exit non-zero.
- **Docstring requirement (lesson how=3):** the file header of `bake_flavor_graph.py` must say: "Upstream dependency: `flavor-gnn/scripts/flavor_layout_v2.py` (which produces the position artifacts this script's downstream consumers depend on). Re-running THIS script is safe AFTER any of: `flavor_layout_v2.py`, GNN retraining (changes `gnn_entropy.json`), or chef-user edits to `top500_flavor_graph.csv`. Re-running this script REQUIRES `flavor_layout_v2.py` to have run at least once. Use `npm run bake:flavor-pipeline` to chain both in correct order."
- MODIFY `package.json` (or `flavor-gnn/package.json` if separate) — add `"bake:flavor-graph": "python flavor-gnn/scripts/bake_flavor_graph.py"` AND `"bake:flavor-pipeline": "python flavor-gnn/scripts/flavor_layout_v2.py && python flavor-gnn/scripts/bake_flavor_graph.py"` (the chained orchestrator — lesson how=3 + how=4).

**LOC delta:** NEW ~280 lines in `bake_flavor_graph.py`, NEW ~80 lines in `longtail_rules.json`.

**Effort:** 1d (rule-table seeding is the variable lever, but 40 seed entries × 30s each = 20min).

**Tests:**
- NEW `flavor-gnn/scripts/__tests__/test_bake_flavor_graph.py` — runs the bake on a 10-ingredient fixture (mint + 9 others), asserts: (a) mint matches canonical, (b) primary_tier1 logic matches spec fixture (`{tier1_aroma:['woody','fruity'], gnnProbs:{odor_woody:0.5,odor_fruity:0.8}, ingredient_thresholds:{odor_woody:0.252,odor_fruity:0.269}} → 'fruity'`), (c) salty/odor_spicy NOT surfaced when prob > ingredient_threshold (policy carve-out), (d) manual overlay wins over rule-derived, (e) **curated `node.taste='pungent'` produces `tier2_taste` containing `'pungent'`** (validates step 4b path).

**Risks (per spec):**
- Risk 1 (Tier-3 long-tail accuracy unknown) — mitigated by Phase-2 verification, not Phase-1.
- Risk 5 (vocabulary curation is chef-user's bottleneck) — mitigated by P0's scaffold-shipped-first ordering.
- Manual-vs-rule conflict resolution — codified in step 7 ("manual wins on conflict"); spec ACs don't require chef-curated and rule-derived to be merged per-tier (i.e. if manual provides Tier-3 only, rule-derived Tier-1/2 are still used). Doc this in script docstring.

**Acceptance:**
- [ ] `flavor_graph.json` parses, has `ingredients` + `vocabulary` keys.
- [ ] Mint canonical fixture exact match (5 specific leaves, 2 specific T3 terms).
- [ ] No ingredient has `tier2_taste` containing `salty` OR `tier1_aroma` containing `spicy` from GNN-rule derivation (sanity check on the policy carve-out).
- [ ] ≥80% of top-500 (by `pairingCount`) have all 4 tier slots non-empty (4-of-4 coverage).
- [ ] **≥20 top-500 ingredients have `tier2_taste` containing at least one of `{pungent, astringent, spicy}`** sourced via the curated `node.taste` overlay (step 4b). This validates that the curated-path is wired and not silently bypassed. N=20 is a conservative lower bound; raise after auditing the `node.taste` distribution at executor-time.
- [ ] **Long-tail silence AC (Item 12 path-b):** Acknowledge that approximately 60-70% of the 3,400+ long-tail ingredients (everything outside top-500) will have empty `tier3_mouthfeel` AND empty `leaves` in Phase 1 because the seed rule table only covers ~40 of the 206 known `gnn_compounds.json` tags. Phase 2 chef walkthrough is the recovery path. Bake script emits a `_meta.longtail_coverage` summary stat (e.g., `{tier3_nonempty: 0.35, leaves_nonempty: 0.32}`); no hard threshold gate here, but the stat must be present for Phase-2 to baseline against.
- [ ] **§2.4 pre-bake verifier passes** (mint + 5 fixtures intact, no manual entry lost).

#### P3 — `useProData` loads new files + surfaces graph + primary_tier1 (D3, 1d)

**Goal:** Wire the new artifacts into the data hook so every downstream consumer (panel, network, filter) reads from one source.

**Files:**
- MODIFY `src/hooks/useProData.js`:
  - Add a fetch for `/proDataset/flavor_graph.json` in the `finish()` block (parallelizable with the existing entropy/thresholds Promise.all on line ~465).
  - Attach `flavorGraph` to the hook return value alongside `flavorPositions` / `flavorClusterLabels`.
  - Attach `flavor_positions_2d` (named `flavorPositions2D` in the return) — second fetch, optional.
  - On each `node`, attach `node.flavorGraph = flavorGraph.ingredients[name] || null` and `node.primaryTier1Aroma = flavorGraph.ingredients[name]?.primary_tier1_aroma ?? null`.
- MODIFY `src/workers/pairingsParser.worker.js` if it owns any of the new fetches (audit at executor-time; current worker handles ingredients+pairings only, but flavor_graph could be added there for parallelism).

**LOC delta:** +30 in `useProData.js`.

**Effort:** 1d (includes a worker-side audit + the optional return-shape doc).

**Tests:**
- Unit (vitest, mocking fetch): `useProData.flavorGraph.test.js` — feed a mock `flavor_graph.json` with mint + 1 other ingredient; assert hook return has `flavorGraph`, `node.flavorGraph` set on mint node, `node.primaryTier1Aroma === 'green'`.
- Integration: existing `useProData` tests still pass.

**Risks:**
- Fetch failure (graph file missing in dev) should not crash the network mode — wrap in try/catch with `flavorGraph = null` fallback (mirror existing pattern for `flavor_cluster_labels`).

**Acceptance:**
- [ ] Hook returns `flavorGraph` populated when file present; `null` when absent.
- [ ] Each graph-node decorated with `node.flavorGraph` + `node.primaryTier1Aroma`.
- [ ] No console errors loading Flavor Network mode.
- [ ] Existing `useProData` unit tests still pass.

#### P4 — IngredientPanel tree-view + `TierBadge` component (D4, 1d)

**Goal:** Render the per-ingredient flavor graph as chips with tier disambiguation.

**Files:**
- NEW `src/components/TierBadge.jsx` — `<TierBadge tier={2|3} />` renders a small superscript or pill. Two visual modes (superscript for compactness in chip text, pill for standalone): controlled by prop `variant: 'superscript' | 'pill'` (default superscript). Accessible name via `aria-label`: `"Tier-2 taste"` / `"Tier-3 mouthfeel"`.
- NEW `src/components/FlavorGraphTree.jsx` — given `node.flavorGraph`, renders a chip cloud with sections for T1, T2, T3, leaves. Each chip is a `<span>` with the corresponding palette color (BRISCIONE_AROMA for T1, BRISCIONE_TASTE for T2, slate-gray for T3 + leaves since no color contract). When the rendered term is `"pungent"` AND it appears at both Tier-2 and Tier-3 for this ingredient, both chips render with `<TierBadge>` for disambiguation.
- MODIFY `src/components/IngredientPanel.jsx` — import `FlavorGraphTree`, render inside a `<CollapsibleSection title="Flavor Graph" defaultOpen={true}>` block above the existing taste-radar / predicted-profile sections.

**LOC delta:** NEW ~80 (TierBadge) + ~150 (FlavorGraphTree); +5 to IngredientPanel.

**Effort:** 1d

**Tests:**
- NEW `src/components/__tests__/TierBadge.test.jsx` — renders, `aria-label` correct per tier, no console errors.
- NEW `src/components/__tests__/FlavorGraphTree.test.jsx` — mint fixture renders 1 + 2 + 2 + 5 chips, the Tier-3 `pungent` chip carries a `TierBadge`, the Tier-2 `pungent` chip ALSO carries one (if both present for the same ingredient).
- NEW `src/components/__tests__/IngredientPanel.flavorGraph.test.jsx` — IngredientPanel with mint as selected ingredient shows the tree section with the expected 10 chips.

**Risks:**
- Risk 2 (pungent dual-tier foot-gun) — fully mitigated by making `TierBadge` mandatory on any term that appears at both T2 and T3 for the same ingredient.

**Acceptance:**
- [ ] Mint panel renders 1 T1 chip + 2 T2 chips + 2 T3 chips + 5 leaf chips.
- [ ] At least one displayed chip (`pungent` at T3) carries TierBadge with `aria-label="Tier-3 mouthfeel"`.
- [ ] No console errors when ingredient has `flavorGraph: null`.

#### P5 — Network node re-color path + recolor diff artifact (D5 AM, 0.5d)

**Goal:** Network nodes inherit `BRISCIONE_AROMA[primaryTier1Aroma]` color when graph data is present. Bake-time emit a diagnostic `flavor_recolor_diff.json` so the chef-user soak window (D5 PM) has a concrete artifact to inspect before P6 ships.

**Files:**
- MODIFY `src/three/NodeMesh.js` — add a `colorForNode(node)` helper that resolves in this priority:
  1. If `node.primaryTier1Aroma` is non-null AND `BRISCIONE_AROMA[node.primaryTier1Aroma]` exists → use that hex.
  2. Else if `node.taste` matches `TASTE_COLORS` → use that (existing behavior; line 38 of NodeMesh).
  3. Else cluster fallback (existing defensive path).
- MODIFY `src/three/NodeMesh.js` color-update loop — invoke `colorForNode` per node when populating the InstancedMesh color buffer.
- Import `BRISCIONE_AROMA` from `src/data/briscionePalette.js`.
- MODIFY `flavor-gnn/scripts/bake_flavor_graph.py` — additional emit at end of bake: `flavor-gnn/artifacts/flavor_recolor_diff.json`. Shape:
  ```json
  {
    "_meta": { "generated_at": "...", "n_ingredients": 3913, "n_recolored": 2410, "n_catastrophic": 12 },
    "diffs": [
      {"name": "mint", "old_color": "#9d4edd", "new_color": "#22c55e", "old_taste": "bitter", "new_tier1": "green", "catastrophic": false},
      ...
    ]
  }
  ```
  Where:
  - `old_color` = the color the renderer would have picked from `node.taste` via existing `TASTE_COLORS` (or `DEFAULT_COLOR` if no taste).
  - `new_color` = `BRISCIONE_AROMA[primary_tier1_aroma]` (or fallback if null).
  - `catastrophic` = true when the transition crosses semantic palette families per a tiny inline taxonomy (e.g., sweet/pink → woody/brown, sour/cyan → fatty/yellow; the spec for "catastrophic" is a fixed list of ~6 forbidden palette-family transitions, codified in the script).

**LOC delta:** +25 in `NodeMesh.js`, +1 import, +60 in `bake_flavor_graph.py` (diff emit step + catastrophic taxonomy).

**Artifact size estimate:** ~3,913 entries × ~80 bytes ≈ **320 KB** (Item 9). Committed to `flavor-gnn/artifacts/` not `public/` since it's a diagnostic, not runtime.

**Effort:** 0.5d

**Tests:**
- NEW `src/three/__tests__/NodeMesh.colorForNode.test.js` — fixture nodes:
  - `{primaryTier1Aroma:'green'}` → `#22c55e` (BRISCIONE_AROMA.green).
  - `{primaryTier1Aroma:null, taste:'sweet'}` → `#ff6b9d` (existing TASTE_COLORS.sweet).
  - `{primaryTier1Aroma:null, taste:null}` → `DEFAULT_COLOR`.
- NEW `flavor-gnn/scripts/__tests__/test_recolor_diff.py` — 5-ingredient fixture, asserts: (a) diff file emitted, (b) `n_recolored` count matches manual count, (c) catastrophic transitions detected for the planted fixture (e.g., a sour→fatty case), (d) `_meta.n_catastrophic` field present.
- Integration: existing `NodeMesh` tests still pass.

**Risks:**
- Risk 3 (chef-user visual identity shift) — code-side mitigated by C1 baking + defensive fallback to existing cluster-color when no T1 derivable. The chef-user soak window (D5 PM) plus the new `flavor_recolor_diff.json` artifact catch the perceived-quality regression BEFORE P6 ships.

**Acceptance:**
- [ ] Spec unit test passes: `{tier1_aroma:['woody','fruity'], gnnProbs:{odor_woody:0.5,odor_fruity:0.8}, ingredient_thresholds:{odor_woody:0.252,odor_fruity:0.269}} → primaryTier1='fruity'`. (This is asserted at bake time per Decision C1; the renderer just reads the field.)
- [ ] Existing cluster-color fallback path still fires when graph absent (defensive).
- [ ] No console errors loading Flavor Network mode.
- [ ] **`flavor-gnn/artifacts/flavor_recolor_diff.json` emitted by bake step; parseable JSON with `_meta` + `diffs`.**
- [ ] **`_meta.n_catastrophic ≤ 50`** — soft gate (Item 4). If exceeded, P6 is BLOCKED until chef-user reviews and either signs off on the catastrophic transitions OR rule table is tuned to reduce them.

#### P6 — flavor2D mode + flavor-category filter pill + final QA (D6 AM, 1d)

**Goal:** Land the 2D-from-3D mode key, the new filter pill, and the cross-cutting gates.

**Files:**
- MODIFY `src/data/networkModes.js`:
  - Add `'flavor2D'` to internal mode mapping (NOT to `MODE_CYCLE` — same hide-without-delete pattern as the prior delivery's ADR-1, commit `b94779c`). `MODE_LABELS['flavor2D'] = 'Flavor Network 2D'`.
  - Extend `effectiveLegacyMode(mode, morphAxis)` to handle `'flavor2D'` → `'ml2d'` (or a new `'mlflavor2d'` key if rendering needs to disambiguate, executor's call after a 30-min spike).
  - Add `'flavor-category'` to `FILTER_KEYS` + `FILTER_LABELS.['flavor-category'] = 'Flavor Category'`.
  - Set `FILTER_TO_AXIS['flavor-category'] = null` (visibility-only in Phase 1; not a morph driver).
- MODIFY `src/hooks/useProData.js` (or wherever position lookup happens) — when mode is `flavor2D`, source positions from `flavorPositions2D` instead of `flavorPositions`.
- MODIFY `src/components/LivingArchView.jsx` or equivalent renderer dispatch — if `flavor-category` filter is active, apply a visibility predicate over `node.flavorGraph` (term matches any of T1/T2/T3/leaves arrays).

**LOC delta:** +20 in `networkModes.js`, +15 in `useProData.js`, +30 in `LivingArchView.jsx`.

**Effort:** 1d (Item 10: bumped from 0.5d to absorb the mode-resolution spike + filter-predicate test surface + final-QA verification sweep)

**Tests:**
- MODIFY `src/data/__tests__/networkModes.test.js` — assert `MODE_CYCLE.length === 2` (unchanged from prior delivery's ADR-1, commit `b94779c`), `MODE_LABELS['flavor2D']` resolves, `effectiveLegacyMode('flavor2D', null)` returns expected value.
- NEW filter-predicate unit test — given a node with `flavorGraph.tier1_aroma=['green']`, a filter on `'green'` matches; same for tier 2/3/leaves.

**Risks:**
- Filter UI for flavor-category needs to expose which TERM the user is filtering on (Phase 1 may default to "any" — i.e. filter is binary "has any flavor-graph term selected from a dropdown"). UI shape TBD by executor; spec leaves this open.

**Acceptance:**
- [ ] `flavor2D` mode loads positions from `flavor_positions_2d.json`.
- [ ] `'flavor-category'` filter pill renders in the existing FilterPillRow.
- [ ] Toggling the pill highlights matching ingredients (visibility predicate).
- [ ] `MODE_CYCLE` length still equals 2 (prior delivery's ADR-1 regression preserved, commit `b94779c`).

### 2.3 Execution Order Summary

| Day | Lane A (offline / data) | Lane B (UI / renderer) | Sync points |
|-----|-------------------------|------------------------|-------------|
| D1 AM | P0 scaffold (0.25d) | — | Chef-user unblocked |
| D1 PM | P1 2D layout (0.5d) | — | — |
| D2 | P2 baker + rules (1d) | (chef-user fills CSV in parallel) | End of D2: `flavor_graph.json` exists |
| D3 | — | P3 useProData wiring (1d) | End of D3: hook returns flavorGraph |
| D4 | — | P4 IngredientPanel + TierBadge (1d) | Mint visually verified |
| D5 AM | — | P5 Network re-color + diff artifact (0.5d) | `flavor_recolor_diff.json` emitted |
| **D5 PM** | **SOAK / QA WINDOW (Item 4)** — chef-user reviews `flavor_recolor_diff.json` end-to-end; `_meta.n_catastrophic ≤ 50` gate evaluated; if exceeded, P6 BLOCKED until rule table tuned or chef-user sign-off recorded in `.omc/notepad.md` | (P5 deploy lab-only; no master push yet) | Soak gate decision |
| D6 AM | — | P6 mode + filter + final QA (1d) | All ACs pass |

Total: **5.5d work + 0.25d buffer = 5.75d.** Up from R1's 5d to absorb (a) Item 4 soak window between P5 and P6, (b) Item 10 P6 effort bump.

### 2.4 Verification Gates (BLOCKING per-phase)

Per lesson `pipeline-rebuild-wipes-manual-data-additions` how=5: every phase has a deterministic check that runs BEFORE commit and fails the build if not satisfied. Codify these in `flavor-gnn/scripts/verify_flavor_graph.ps1` (or `.py`).

**Test count per-phase delta (Item 7 — exact gates, not `≥`):**

| After phase | Test count | Delta from previous |
|-------------|------------|---------------------|
| Baseline (current) | 736 | — |
| P0 | 737 | +1 (`scaffold_top500_curation.test.py`) |
| P1 | 738 | +1 (`flavor_layout_v2_2d.test.py`) |
| P2 | 739 | +1 (`test_bake_flavor_graph.py` — single file, multi-case) |
| P3 | 742 | +3 (`useProData.flavorGraph.test.js` — 3 cases: present / null / decoration) |
| P4 | 747 | +5 (`TierBadge.test.jsx` x2 + `FlavorGraphTree.test.jsx` x2 + `IngredientPanel.flavorGraph.test.jsx` x1) |
| P5 | 749 | +2 (`NodeMesh.colorForNode.test.js` x1 + `test_recolor_diff.py` x1) |
| P6 | **752** | +3 (`networkModes.flavor2D.test.js` x2 + `filterPredicate.test.js` x1) |

**Final gate:** `npx vitest run` reports `Tests: 752 passed` (exact, not `≥`).

| Phase | Gate | Command | Pass criteria |
|-------|------|---------|---------------|
| P0 | Scaffold rows | `(Get-Content flavor-gnn/curation/top500_flavor_graph.csv \| Measure-Object -Line).Lines` | `≥501` (header + 500 rows) |
| P0 | Mint bootstrap | `Select-String '^mint,green,' flavor-gnn/curation/top500_flavor_graph.csv` | exit 0; ≥1 match |
| **P0 (NEW)** | **Idempotency — scaffold re-run preserves manual rows** | Run scaffold, edit 5 fixture rows, run scaffold again: `git diff --exit-code flavor-gnn/curation/top500_flavor_graph.csv` | exit 0 (no diff) |
| **P0 (NEW)** | **Canonical-fixture preservation** | `python -c "import csv; rows={r['name']:r for r in csv.DictReader(open('flavor-gnn/curation/top500_flavor_graph.csv'))}; assert all(rows[n]['tier1_aroma'] for n in ['mint','vanilla','soy sauce','lemon','garlic']), 'fixture row tier1 was wiped'"` | exit 0 |
| P1 | 2D file emitted | `Test-Path public/proDataset/flavor_positions_2d.json` | True |
| **P1 (Item 6)** | **3D byte-equality preserved** | Before P1 starts, snapshot: `Copy-Item public/proDataset/flavor_positions.json public/proDataset/flavor_positions.json.precoupling`. After P1: `python -c "import json; a=json.load(open('public/proDataset/flavor_positions.json')); b=json.load(open('public/proDataset/flavor_positions.json.precoupling')); assert set(a.keys())==set(b.keys()), 'key set diverged'; assert all(a[k]==b[k] for k in a), 'value diverged'; print('PASS')"` | exit 0; stdout contains `PASS` |
| P1 | 2D entry count matches 3D | `python -c "import json; a=json.load(open('public/proDataset/flavor_positions.json')); b=json.load(open('public/proDataset/flavor_positions_2d.json')); assert set(a.keys())==set(b.keys()), f'2D-3D key set diverged: {len(set(a)^set(b))} diff'; assert all(len(b[k])==2 for k in b), '2D entry not [x,y]'; print('PASS')"` | exit 0; stdout contains `PASS` |
| P2 | Schema valid | `python -c "import json; g=json.load(open('public/proDataset/flavor_graph.json')); assert 'ingredients' in g and 'vocabulary' in g and g['_meta']['threshold_artifact']=='ingredient_profile_thresholds.json', 'schema missing keys or wrong threshold artifact'"` | exit 0 |
| P2 | Mint canonical | `python flavor-gnn/scripts/verify_mint_fixture.py` (asserts the 4-field exact match: `tier1_aroma=['green']`, `tier2_taste⊇{'bitter','astringent'}`, `tier3_mouthfeel⊇{'cooling','pungent'}`, `leaves==['menthol','fresh','sharp','grassy','herbaceous']`) | exit 0 |
| P2 | Manual entries survived | grep for each of `mint`, `vanilla`, `soy sauce`, `lemon`, `garlic` in `flavor_graph.json`, AND each has `"sources"` containing `"manual-top-500"` | all 5 present |
| P2 | Coverage ≥ 80% top-500 | `python flavor-gnn/scripts/verify_coverage.py` (computes 4-of-4 over top-500 by pairingCount) | `coveredCount / 500 ≥ 0.80` |
| **P2 (Item 3)** | **Tier-2 curated-path coverage** | `python -c "import json; g=json.load(open('public/proDataset/flavor_graph.json'))['ingredients']; ing=json.load(open('public/proDataset/ingredients.json')); top500=sorted(ing,key=lambda x:x.get('pairingCount',0),reverse=True)[:500]; hits=sum(1 for n in top500 if g.get(n['name'],{}).get('tier2_taste',[]) and any(t in g[n['name']]['tier2_taste'] for t in ['pungent','astringent','spicy'])); assert hits>=20, f'curated taste coverage too low: {hits}'; print(f'PASS hits={hits}')"` | exit 0; stdout `PASS hits=N` where N ≥ 20 |
| P2 | BRISCIONE_TASTE unchanged | `(Select-String 'BRISCIONE_TASTE\s*=' src/data/briscionePalette.js).Count` | `== 1` |
| P3 | Vitest suite | `npx vitest run` | exit 0; **exactly 742 tests** (was 736, +3 useProData +1 P0 +1 P1 +1 P2) |
| P4 | Vitest + IngredientPanel test | `npx vitest run src/components/__tests__/IngredientPanel.flavorGraph.test.jsx` | exit 0; mint chips count == 10 |
| P4 | Full vitest count | `npx vitest run` | exit 0; **exactly 747 tests** |
| P5 | Vitest + NodeMesh test | `npx vitest run src/three/__tests__/NodeMesh.colorForNode.test.js` | exit 0 |
| P5 | BRISCIONE_TASTE unchanged | (same grep gate as P2) | `== 1` |
| **P5 (Item 4)** | **Catastrophic-transition diff gate** | `python -c "import json; d=json.load(open('flavor-gnn/artifacts/flavor_recolor_diff.json')); n=d['_meta']['n_catastrophic']; assert n<=50, f'catastrophic recolor count too high: {n}'; print(f'PASS n_catastrophic={n}')"` | exit 0; stdout `PASS n_catastrophic=N` where N ≤ 50 |
| P5 | Full vitest count | `npx vitest run` | exit 0; **exactly 749 tests** |
| P5→P6 | **SOAK GATE (Item 4)** — chef-user reviews `flavor_recolor_diff.json` end-to-end. If `_meta.n_catastrophic > 0`, sign-off must be recorded in `.omc/notepad.md` with a 1-line per catastrophic entry (`mint: bitter→green, approved`). If sign-off absent, P6 BLOCKED. | manual review + grep of `.omc/notepad.md` | sign-off present OR n_catastrophic == 0 |
| P6 | Full vitest | `npx vitest run` | exit 0; **exactly 752 tests** |
| P6 | Build green | `npm run build` | exit 0 |
| P6 | iOS sync | `npm run ios:sync` | exit 0 |
| P6 | Prior-delivery ADR-1 regression | `npx vitest run src/components/__tests__/LivingArchView.legacyRegression.test.jsx` | exit 0 |
| **P6 (Item 6)** | **MODE_CYCLE length** | `node -e "import('./src/data/networkModes.js').then(m => { if (m.MODE_CYCLE.length !== 2) { console.error('FAIL: MODE_CYCLE.length=' + m.MODE_CYCLE.length); process.exit(1); } console.log('PASS MODE_CYCLE.length=2'); })"` | exit 0; stdout `PASS MODE_CYCLE.length=2` |

The §2.4 table is the binding pre-commit checklist. Any phase that ships without its gate passing is rolled back.

---

## 3. Test Plan (short mode)

### 3.1 Unit Tests (per-phase, new)

| Phase | Test File | Asserts |
|-------|-----------|---------|
| P0 | `scaffold_top500_curation.test.js` (or Python doctest) | 500 rows; mint fixture exact |
| P1 | `flavor_layout_v2_2d.test.py` | 2D file emitted; key set matches 3D |
| P2 | `test_bake_flavor_graph.py` | (a) mint canonical, (b) primary_tier1 fixture, (c) salty/odor_spicy not surfaced, (d) manual overlay wins |
| P3 | `useProData.flavorGraph.test.js` | hook returns flavorGraph; node.primaryTier1Aroma populated |
| P4 | `TierBadge.test.jsx` + `FlavorGraphTree.test.jsx` + `IngredientPanel.flavorGraph.test.jsx` | a11y label; mint chip count == 10; dual-tier pungent both badge |
| P5 | `NodeMesh.colorForNode.test.js` | priority-resolution fixture |
| P6 | `networkModes.flavor2D.test.js` + `filterPredicate.test.js` | mode mapping; filter visibility |

### 3.2 Integration Tests

- IngredientPanel + flavor_graph load: from cold start, select mint, panel renders the tree with no console errors.
- Network re-color + cluster preservation: in flavor3D mode, nodes pick up BRISCIONE_AROMA colors per primary T1; cluster centroids still render with cluster-color when no T1 derivable.
- Prior-delivery ADR-1 regression (legacy '3D' programmatic mount, commit `b94779c`): `mode='3D'` continues to mount with `pivotAdvanceMs: null`.
- Filter pill toggle: `'flavor-category'` pill toggles visibility predicate on `node.flavorGraph` matches.

### 3.3 Cross-Cutting Gates

| Gate | Command | When | Pass criteria |
|------|---------|------|---------------|
| Full vitest | `npx vitest run` | End of each phase + final | exit 0; exact count per §2.4 table |
| Build | `npm run build` | End of P6 | exit 0 |
| iOS sync | `npm run ios:sync` | End of P6 | exit 0 |
| Console error free | Manual: load Flavor Network mode in dev, dev-tools console | End of P6 | zero errors |
| BRISCIONE_TASTE grep | `(Select-String 'BRISCIONE_TASTE\s*=' src/data/briscionePalette.js).Count` | End of every phase | `== 1` |
| MODE_CYCLE length | `node -e "import('./src/data/networkModes.js').then(m=>{if(m.MODE_CYCLE.length!==2){process.exit(1)}})"` | End of P6 | exit 0 |
| Final test count | `npx vitest run` | End of P6 | **Tests: 752 passed** (exact) |

---

## 4. ADRs

**Naming convention (Item 5):** This plan's ADRs use the plan-scoped prefix `N1-ADR-N` to avoid collision with the prior Network Cleanup Tactical Pack delivery (commit `b94779c`), whose ADRs are referenced in this plan as "prior ADR-N" or "ADR-N (commit `b94779c`)".

### N1-ADR-1: Long-tail rule-derivation is offline-baked (Decision A)

- **Decision:** Tier-3 long-tail rule-derivation runs in `flavor-gnn/scripts/bake_flavor_graph.py` offline. Output is committed to `public/proDataset/flavor_graph.json`. Runtime `useProData` only loads + decorates; it never derives.
- **Drivers:** Ship-by-day-5 (D1) + re-bakeable-without-losing-chef-work (D2). The offline pipeline naturally orders rebuild-then-merge per lesson `pipeline-rebuild-wipes-manual-data-additions` how=5.
- **Alternatives considered:** Runtime derivation in `useProData` (A2) — rejected: 3,400 ingredients × tag lookup at every cold-start; harder to verify; manual-merge logic would have to live in JS.
- **Why chosen:** Aligns with existing offline-build pattern (`flavor_layout_v2.py`, `bake-pairings`). Deterministic, inspectable, verifiable. Re-bake is a single command (`npm run bake:flavor-pipeline` chains both upstream `flavor_layout_v2.py` and `bake_flavor_graph.py` — lesson how=4).
- **Consequences:** Adds one Python script + one rule-table JSON to the repo. Schema-evolution requires re-bake. The script's verification step (mint + 5 manual fixtures present) is a binding pre-write gate.
- **Follow-ups:** Phase 2 chef walkthrough may surface rule-table edits; bake pipeline re-runs idempotently after each edit.

### N1-ADR-2: `TierBadge` is a first-class component (Decision B)

- **Decision:** `src/components/TierBadge.jsx` renders dual-tier disambiguation; a `<FlavorGraphTree>` parent component is responsible for deciding when to mount a TierBadge.
- **Drivers:** D1 (ship), but more importantly a11y disambiguation is binding per spec line 108.
- **Alternatives considered:** Inline tier-aware label helper (B2) — **steelman acknowledged (Item 11):** for the SINGLE dual-tier term in Phase 1 (`pungent`), B2 is genuinely lighter than a dedicated component; one inline `(<sup>{tier}</sup>)` returns a span and the rendering cost is amortized. Rejection rests on TWO independent reasons, either of which alone would be insufficient:
  1. The spec ontology row 7 lists `TierBadge` as a first-class entity — making it a component honors the schema-as-source-of-truth principle.
  2. Phase 2 chef walkthrough is LIKELY to surface additional dual-tier terms (e.g., `bitter` at T2 + `astringent` at T3 are semantically adjacent; chef may want disambiguation when both appear). The component absorbs them without re-architecture; the inline helper would need to be retrofitted into a component anyway. Pay the cost now, once.
- **Why chosen:** Two-reason rule above; single a11y label source; unit-testable in isolation.
- **Consequences:** Adds two new files (TierBadge, FlavorGraphTree). Future tier extensions (Tier-1 / Tier-4) reuse the same component with a different `tier` prop value.
- **Follow-ups:** If Phase-2 walkthrough surfaces zero new dual-tier terms, this ADR is revisited and the component can be inlined as a future cleanup.

### N1-ADR-3: `primary_tier1_aroma` is baked from `ingredient_profile_thresholds.json`, not `odor_thresholds.json`, and not computed per-frame (Decision C)

- **Decision:** Offline bake script computes `primary_tier1_aroma` from `gnnProbs` + **`ingredient_profile_thresholds.json` (per-task `ingredient_threshold`)** + `AROMA_AXES` tie-break, writes to each ingredient entry in `flavor_graph.json`.
- **Drivers:** D2 (re-bakeable without losing chef work) — primary_tier1 derives only from immutable-this-delivery inputs. D1 — zero per-frame cost.
- **Why `ingredient_profile_thresholds.json` (Item 1):** The molecule-level `odor_thresholds.json` is calibrated per-compound and "almost never triggers" when applied to ingredient-level mean-pooled probabilities, because mean-pool dilutes molecule-level extremes (documented in `src/utils/predictedProfile.js:7-39`). The project already ships `ingredient_profile_thresholds.json` as the p85-of-ingredient-distribution threshold artifact for exactly this reason. Shape is `{per_task: [{task, ingredient_threshold, molecule_f1}], generated_by, percentile, min_molecule_level_f1}`; consumers project `per_task → {task → ingredient_threshold}` dict. Skip rows where `molecule_f1 < 0.4` (matches the existing `MIN_F1` constant in `predictedProfile.js`).
- **Alternatives considered:**
  - Use `odor_thresholds.json` (R1 plan default) — rejected per the above; would produce a primary_tier1 that almost never selects above-threshold tasks.
  - Client-side per-frame in NodeMesh (C2) — rejected because the spec's fixture test (`{woody:0.5, fruity:0.8} → fruity`) is easier to assert on the bake script's output than on the Three.js render path; and the filter-pill code path would need the same compute, leading to two implementations.
- **Why chosen:** Matches existing project convention; one source of truth; deterministic across reloads; verifiable at bake time.
- **Consequences:** Re-bake when calibrated thresholds change (rare; thresholds typically update only after a GNN retrain). Adds one field to the per-ingredient schema (`primary_tier1_aroma`). Adds `_meta.threshold_artifact: "ingredient_profile_thresholds.json"` to the baked output for traceability.
- **Follow-ups:** If thresholds become user-tunable in a future delivery, this decision flips to C2 (runtime). Not in scope here.

### N1-ADR-4: Filter-axis integration extends `FilterPillRow` (Decision D)

- **Decision:** Add `'flavor-category'` to `FILTER_KEYS` in `networkModes.js`. Single pill row. `FILTER_TO_AXIS['flavor-category'] = null` (visibility-only, not a morph driver in Phase 1).
- **Drivers:** D1 (ship). User mental model is one filter row (commit `b94779c`).
- **Alternatives considered:** Fork to `FlavorCategoryPillRow.jsx` (D2) — rejected because the prior Track-3 delivery's ADR-5 fork pattern was for radar UI, not pill rows; two interaction rows would confuse users.
- **Why chosen:** Reuses existing horizontal-scroll + a11y + interaction grammar with minimal new surface. Spec describes one pill alongside existing ones (line 68).
- **Consequences:** Pill row grows from 7 to 8 entries. Horizontal-scroll on narrow viewports absorbs the additional pill. Future morph behavior (flavor-category as a morph driver) requires an axis mapping later.
- **Follow-ups:** Phase-2 walkthrough may indicate users want a "pick a term" sub-selector. Out of scope here — Phase-1 ships binary "filter is on / off" semantics.

---

## 5. Risk → Phase Mitigation Map

| Spec Risk | Mitigating Phase | Verification Artifact |
|-----------|------------------|----------------------|
| **R1 Tier-3 long-tail accuracy unknown** | P2 (rule table) + Phase-2 verification (deferred) | `longtail_rules.json` is a seed (~40 entries); Phase-1 ships partial long-tail coverage by AC (Item 12 path-b); `_meta.longtail_coverage` stat emitted so Phase-2 has a baseline |
| **R2 Pungent dual-tier foot-gun** | P4 (TierBadge mandatory on dual-tier terms) | `FlavorGraphTree.test.jsx` asserts dual-tier pungent both carry badge |
| **R3 Re-color destabilizes chef visual identity** | P5 (defensive fallback) + **D5 PM soak window with `flavor_recolor_diff.json` review** + chef sign-off recorded in `.omc/notepad.md` for catastrophic transitions (Item 4) | `flavor_recolor_diff.json` in `flavor-gnn/artifacts/`; `_meta.n_catastrophic ≤ 50` gate; `NodeMesh.colorForNode` unit test asserts cluster-color fallback |
| **R4 2D-from-3D may not be meaningful** | P1 ships JSON regardless; UX decision deferred | `flavor_positions_2d.json` exists; default mode pick deferred |
| **R5 Vocabulary curation is chef-user's bottleneck** | P0 scaffold-first (D1 AM) | `top500_flavor_graph.csv` shipped before P2 starts |
| **R6 Mosaic vocabulary is inspiration only** | P2 seed table is conservative (~40 terms), chef extends | `longtail_rules.json` reviewable; not copy-paste from Mosaic |
| **R7 (new) Manual data wiped by re-bake** | P0 idempotent scaffold + P2 manual-wins overlay + `sources` tagging | §2.4 P0 idempotency gate (`git diff --exit-code`); P2 manual-fixture grep; lesson `pipeline-rebuild-wipes-manual-data-additions` how=1/2/3/4/5 all encoded |

---

## 6. Open Questions for Architect / Critic Pressure-Test

These are spec gaps / under-specified items the executor will hit. Surface to Architect and Critic for resolution before P2 starts; do NOT guess.

1. **Manual-vs-rule merge granularity.** When a chef-curated row provides Tier-3 + leaves but leaves Tier-1/Tier-2 empty (assuming rule-derivation handles those), does "manual wins on conflict" mean the manual T3 wipes the rule-derived T3 entirely, or do they merge per-term (union)? **Plan assumes per-tier replacement (manual fills only the tiers it touches; rule-derived survives elsewhere).** Confirm with chef-user.

2. **`'flavor-category'` filter UI sub-selector.** Spec line 68 says the pill "filters by a Tier-1/2/3/leaf term highlighting matching ingredients." But it doesn't specify the UX for picking which term — is it a dropdown that opens on pill click, a separate term-list panel, or always-on multi-select? **Plan assumes Phase-1 ships binary visibility (filter on/off matches any-term-active); UI for picking a specific term is a Phase-2 follow-up.** Architect: confirm or push back.

3. **`flavor2D` and `MODE_CYCLE` entry vs. URL-only.** Spec AC line 188 says "a new mode key (TBD by implementer) reads from `flavor_positions_2d.json`." Should `flavor2D` enter `MODE_CYCLE`? **Plan defaults to hide-without-delete (same as the prior delivery's ADR-1 for legacy '3D', commit `b94779c`): code-mounted, programmatically reachable, NOT in MODE_CYCLE.** This is the safest interpretation; Architect can promote to MODE_CYCLE in a one-line follow-up.

4. **Top-500 by `pairingCount` vs. by `_meta` weight.** Spec AC line 171 says "top-500 ingredients" without specifying ordering. **Plan assumes top-500 by `node.pairingCount` desc (the most-used field across the project).** Critic: confirm this is the chef's mental model of "top".

5. **`gnn_compounds.json` Level-2/3 tag inventory.** Project memory `project_gnn_compounds_level2_descriptors` mentions "206 tags across 3,283 ingredients". Plan seeds the rule table with ~40 of these (the most-shared, non-generic). **Question:** Does the chef-user need ALL 206 tags mapped before Phase 1 ships, or is "the top-40 lift the long-tail to non-zero coverage" sufficient for the 80%-top-500 AC? **Plan assumes the latter** (the AC is over top-500, not long-tail; long-tail can ship with partial coverage).

6. **Salty + odor_spicy carve-out.** chemDataset-status policy says "Do not surface salty (0.333) or odor_spicy (0.329) even with calibration." **Plan applies this in the baker** (step 4 in P2). But spec line 88 says GNN-derived T2 uses "every taste head where prob ≥ calibrated_threshold." Are salty and odor_spicy permanently excluded from `flavor_graph.json`, or surfaced-but-with-low-confidence-flag? **Plan assumes excluded** (consistent with the chemDataset policy). Critic: pressure-test this choice — does it disadvantage users searching for spicy ingredients?

7. **Spec internal inconsistency — `BRISCIONE_TASTE` includes both `spicy` and `pungent`, and `tier2_taste` vocabulary in spec line 51 also lists both, but the spec's chemDataset-status policy excludes `odor_spicy`.** Note: `spicy` in BRISCIONE_TASTE is the *taste* (capsaicin/chili sensation) while `odor_spicy` in GNN is the *aroma*. They are distinct. **Plan distinguishes them: `tier2_taste` uses BRISCIONE_TASTE.spicy (taste sense, surfaced via curated `node.taste`); `tier1_aroma` excludes `odor_spicy` (aroma sense, not surfaced).** Architect: confirm this distinction is preserved correctly.

---

**End of plan. Hand off to Architect for risk-tree pressure test and Critic for AC-coverage audit.**
