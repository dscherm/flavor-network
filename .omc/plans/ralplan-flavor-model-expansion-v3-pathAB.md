# RALPLAN — Flavor Model Expansion v3 (Path A + Path B pivot)

**Mode:** short (direct)
**Date:** 2026-05-19
**Supersedes:** §2 P2–P6 of `.omc/plans/ralplan-flavor-model-expansion.md` (R2 plan dated 2026-05-18)
**Source specs:** `C:/Users/scher/Downloads/path_a_specs.md`, `C:/Users/scher/Downloads/path_b_design.md`, `C:/Users/scher/Downloads/test_gates_v1.py`
**Author:** Schermele + Claude
**Branch target:** master

---

## 0. Why this plan exists (the pivot)

The chef-user expanded `flavor-gnn/curation/top500_flavor_graph.csv` while filling it in:

- **Schema grew from 6 → 9 columns.** New fields: `key_pairings` (7 pipe-separated ingredient names), `pairing_principles` (7 pipe-separated edge labels), `chemistry_notes` (text).
- **Row set shrank from 500 → 73 chef-verified rows.** The chef kept only what they could verify with chemistry-grounded leaves.
- **The CSV is now an EDGE-LABELED graph dataset**, not just a per-ingredient flavor tree.

The original v2 plan's P2–P6 (bake `flavor_graph.json`, render in IngredientPanel, network re-color, filter pill) **don't address the new edge labels at all**. The right next move is to **test whether the chemistry signal in `leaves` predicts the new `pairing_principles` labels** before refactoring the GAT pipeline to consume them. That's Path A. If it passes, Path B refactors `train/train_gnn.py` to use the full new schema. Only after Path B succeeds does the UI work from v2 P3–P6 resume (against the new embeddings).

The v2 P0 (scaffold) + P1 (2D UMAP) work already shipped as commit `a04486e`. **Nothing in v2 is destroyed — only the data-dependent phases are deferred** until Path A + B prove the schema is ML-usable.

---

## 1. Pre-flight findings (BLOCKING — must resolve before V1 runs)

### Finding 1 — Filename drift

The chef-saved file is `flavor-gnn/curation/top500_flavor_graph.csv.csv` (double `.csv` from Excel/Windows Save-As). Git sees the original `top500_flavor_graph.csv` as deleted. **Fix:** rename to the canonical name in a pre-Path-A commit and re-run the scaffold idempotency gate (Plan v2 §2.2 P0 step 2 — already idempotent for content; only the filename is wrong).

### Finding 2 — Edge count below V1 threshold

Edge-level filter rate computed against the chef-saved CSV:

| Metric | Value | V1 threshold | Pass? |
|---|---|---|---|
| Total edges (74 rows × 7 pairings) | 518 | — | — |
| After filter (target ∈ name column) | **171** | ≥ 200 (spec Open Q3 halt rule) | **NO** |
| Filter rate | **33.0%** | ≥ 40% (`test_filter_rate_reasonable`) | **NO** |
| Expected test edges at 20% split | 34 | ≥ 30 (`test_edge_count_minimum`) | borderline pass |

**This means V1 as-spec'd will halt-or-fail on the filter-rate gate.** Three mitigations:

- **M1 — Backfill rows first** (RECOMMENDED). Add ~10–15 more chef-verified rows that appear as targets in existing rows' `key_pairings`. Target: lift filter rate ≥ 50%. Estimated chef-user time: ~3 hours.
- **M2 — Lower the V1 threshold** to match data. The 40% threshold is a "data sparsity" canary, not a quality gate. Documenting "Chef has verified what they can; data is small but signal-rich" is a defensible position.
- **M3 — Restructure edges** as undirected (per Open Q2). Currently each edge is directed `source→target`; if we add the reverse direction `target→source` (with the same principle label), the effective edge count doubles BUT the filter rate stays the same (still gated by names ∩ targets). So this doesn't help. Skip M3.

**Decision needed before P0 of Path A:** which mitigation? The plan below assumes **M1 (backfill)** with an M2 (threshold-lower) fallback if backfill is too slow. The pre-Path-A status check phase (P-A0) confirms which path is active before V1 trains.

### Finding 3 — Principle vocabulary

Vocab in the chef-saved CSV (frequency-sorted):

| Principle | Count | Canonical? | Collapse? |
|---|---|---|---|
| shared-volatile | 190 | yes | — |
| cut-fat | 115 | yes | — |
| sweet-acid | 78 | yes | — |
| umami-bridge | 32 | yes | — |
| tradition | 28 | yes | — |
| maillard-bridge | 27 | yes (spec default: collapse to shared-volatile) | **decide** |
| cleanse-palate | 20 | yes | — |
| texture-contrast | 20 | yes | — |
| earthy-bridge | 8 | extended (collapse → shared-volatile) | YES |

After collapsing `earthy-bridge` → `shared-volatile`: **8 canonical classes** (matches V1 spec §1 default).

`herbal-bridge` and `allium-bridge` from the spec are not present in the chef-saved data — no collapse needed.

**`maillard-bridge` decision (spec Q1):** chef-saved data has 27 occurrences; collapsing to `shared-volatile` would give 7 final classes (190+27=217 for shared-volatile, dominant). KEEPING it gives 8 classes with `maillard-bridge` as a small but distinct class. **Default per spec:** collapse. **Recommendation here:** **KEEP `maillard-bridge` separate** for V1, because (a) the test gates accept either 7 or 8 classes, (b) the chemistry is genuinely different (browning Maillard reactions vs. simple volatile overlap), and (c) keeping it gives the model another head to lift baseline. If V1 still fails, ablate by collapsing.

### Finding 4 — `train/` directory ALREADY EXISTS

`train/train_gnn.py` (~180 LOC) and `train/model.py` (29 LOC) already live at the repo root, loading legacy `ingredients.json` + `pairings.json` per Path B §1. No "create train/" step needed — the work is to refactor what's there, plus add `dataset.py` + `train_v1.py` + `test_gates_v1.py` + `test_gnn.py`.

---

## 2. Implementation phases

### Phase dependency graph

```
        ┌────────────────────────────────────────────────────────────┐
        │ P-A0 — Pre-flight: rename CSV, decide M1/M2, freeze vocab │ ½d
        └─────────────────────────┬──────────────────────────────────┘
                                  │
        ┌─────────────────────────▼──────────────────────────────────┐
        │ P-A1 — train_v1.py + results.json artifact                │ 1d
        └─────────────────────────┬──────────────────────────────────┘
                                  │
        ┌─────────────────────────▼──────────────────────────────────┐
        │ P-A2 — test_gates_v1.py runs; PASS or refine schema       │ ½d
        └─────────────────────────┬──────────────────────────────────┘
                          PASS    │    FAIL → halt, refine schema
        ┌─────────────────────────▼──────────────────────────────────┐
        │ P-B1 — train/dataset.py (CSV → torch tensors)             │ 1d
        └─────────────────────────┬──────────────────────────────────┘
                                  │
        ┌─────────────────────────▼──────────────────────────────────┐
        │ P-B2 — train/model.py defaults bump                       │ ¼d
        └─────────────────────────┬──────────────────────────────────┘
                                  │
        ┌─────────────────────────▼──────────────────────────────────┐
        │ P-B3 — train/train_gnn.py rewrite (loading + loss + out)  │ 2d
        └─────────────────────────┬──────────────────────────────────┘
                                  │
        ┌─────────────────────────▼──────────────────────────────────┐
        │ P-B4 — train/test_gnn.py smoke tests                      │ ½d
        └─────────────────────────┬──────────────────────────────────┘
                                  │
        ┌─────────────────────────▼──────────────────────────────────┐
        │ P-B5 — Visual validation in neuralflavor.web.app          │ 1d
        └─────────────────────────┬──────────────────────────────────┘
                                  │
        ┌─────────────────────────▼──────────────────────────────────┐
        │ P-C — UI integration (v2 P3–P6 deferred work, now using   │ 3d
        │       new graph_data.json embeddings)                     │
        └────────────────────────────────────────────────────────────┘
```

**Path A total:** ~2d (Pre-flight + train_v1.py + gates)
**Path B total:** ~5d (dataset + model + rewrite + tests + visual)
**Path C (UI) total:** ~3d (deferred from v2)

**Grand total:** ~10d. Sequential; Path A blocks Path B blocks Path C.

---

### P-A0 — Pre-flight (½ day)

**Goal:** Resolve filename drift, lock principle vocabulary, decide filter-rate mitigation.

**Steps:**

1. **Rename CSV.** `git mv flavor-gnn/curation/top500_flavor_graph.csv.csv flavor-gnn/curation/top500_flavor_graph.csv`. Verify chef's filled rows survive (`wc -l` → 74 lines incl. header).
2. **Update `flavor-gnn/scripts/scaffold_top500_curation.py`** to accept the new 9-column schema (currently writes 6). The scaffold's idempotency rule preserves any row with non-empty tier columns — the 3 new chef columns (`key_pairings`, `pairing_principles`, `chemistry_notes`) are also "manual evidence" and must be preserved on re-run. Add them to `TIER_COLUMNS` or to a separate `MANUAL_COLUMNS` tuple checked by `_row_is_manual()`. Add to `COLUMNS` order: `name, tier1_aroma, tier2_taste, tier3_mouthfeel, leaves, sources, key_pairings, pairing_principles, chemistry_notes`.
3. **Re-run scaffold** to verify idempotency (the chef's 74 verified rows survive; the other 426 top-500 names are re-emitted as empty-row placeholders). Output should be a 500-row file with 74 rows containing chef data + 426 empty-but-named rows.
4. **Decide filter-rate mitigation.** Either:
   - M1 (chef backfills ~15 rows targeting `key_pairings` ingredients not yet in `name` column — script analyzes which targets occur most often and surfaces them to the chef-user as a "fill these first" list), OR
   - M2 (lower V1 threshold to `≥30%` and document the rationale in `.omc/notepad.md`).
5. **Freeze principle vocabulary** — write `flavor-gnn/curation/principle_vocab.json`:
   ```json
   {
     "canonical": ["shared-volatile", "cut-fat", "sweet-acid", "umami-bridge", "tradition", "maillard-bridge", "cleanse-palate", "texture-contrast"],
     "collapse": {"earthy-bridge": "shared-volatile", "herbal-bridge": "shared-volatile", "allium-bridge": "shared-volatile"},
     "maillard_collapse_default": false
   }
   ```
   Both `train_v1.py` and (later) `dataset.py` read from this file as the single source of truth.

**Acceptance:**
- [ ] `flavor-gnn/curation/top500_flavor_graph.csv` exists (renamed, no `.csv.csv`).
- [ ] `principle_vocab.json` exists with the 8 canonical classes + collapse table.
- [ ] Scaffold idempotency test re-runs and chef's 74 rows survive byte-identical (chef-data hash matches pre-rebuild hash).
- [ ] `.omc/notepad.md` updated with the M1/M2 mitigation decision and reasoning.

---

### P-A1 — `train_v1.py` (1 day)

**Goal:** Implement Path A spec's algorithm exactly. Single 120–180 LOC file. Read CSV → multi-hot leaves → expand edges → filter → node-disjoint 80/20 split → train majority-baseline + logistic + RF → emit `train/results.json` + `train/confusion_matrix.png`.

**New files:**
- `train/train_v1.py` (per Path A spec §3)
- `train/requirements_v1.txt`: `pandas`, `scikit-learn`, `matplotlib`
- `train/test_gates_v1.py` (the file the user provided; drop into place verbatim)

**Algorithm verbatim per `path_a_specs.md` §3.** Quoted here for traceability:

```
1. LOAD       — read CSV, drop rows with empty leaves OR empty key_pairings
2. VOCAB      — leaf_vocab = sorted(set(token for row in rows for token in row.leaves.split('|')))
              — principle_vocab = 8 canonical classes (post-collapse, see principle_vocab.json)
3. EXPAND     — for each row: zip(key_pairings.split('|'), pairing_principles.split('|'))
              — emit (source_name, target_name, principle) triples; skip if lengths mismatch
4. FILTER     — keep edge iff target_name ∈ name column (so target also has leaf data)
              — record filter_rate
5. COLLAPSE   — per principle_vocab.json.collapse table
6. ENCODE     — leaves_A_vec = multi_hot(leaves[source]); leaves_B_vec = multi_hot(leaves[target])
              — feature = concat(leaves_A_vec, leaves_B_vec)  # ~240 dims (120 leaves × 2)
              — label = collapsed principle
7. SPLIT      — node-disjoint: pick 20% of NAMES uniformly at random (seed=42),
              — hold out all edges where source OR target is in held-out names.
              — report train_edges, test_edges, dropped_due_to_overlap
8. TRAIN      — baseline (majority class), logistic (multinomial, class_weight='balanced'),
              — random_forest (n_estimators=200, max_depth=None, random_state=42)
9. EVAL       — per-model: overall accuracy, per-class P/R/F1, confusion matrix
              — save confusion_matrix.png (logistic regression's matrix)
              — write results.json per Path A spec §3 schema
```

**Run command (one-shot):**

```bash
cd train
pip install -r requirements_v1.txt
python train_v1.py ../flavor-gnn/curation/top500_flavor_graph.csv
python test_gates_v1.py
```

**Acceptance:**
- [ ] `train/train_v1.py` exists, ~120–180 LOC, runs to completion against the chef-saved CSV without error.
- [ ] `train/results.json` exists and conforms to Path A spec §3 schema.
- [ ] `train/confusion_matrix.png` exists.
- [ ] All `pairing_principles` values map cleanly to canonical or collapsed classes (no unknown labels logged).
- [ ] LOC budget hit: `wc -l train/train_v1.py` returns ≤ 180.

---

### P-A2 — Run `test_gates_v1.py` (½ day)

**Goal:** Verify all 9 V1 gates pass. The decision point on whether to proceed to Path B.

**Steps:**

1. `cd train && python test_gates_v1.py` — script exits 0 (pass) or 1 (fail).
2. Inspect `results.json` per Path A spec §4 (manual validation):
   - Confusion matrix structure: `cut-fat` and `shared-volatile` should be strongest diagonals; `tradition` likely weakest (catch-all).
   - Per-class F1 distribution: top-3 by frequency should have F1 > 0.5.
   - Feature importance (RF): top-20 features should be recognizable chemistry tokens (phenolic, lactonic, aldehydic, pyrazinic, …).
3. **Apply pass/fail decision per Path A spec §5.** If pass → P-B1. If fail → halt, write up findings in `.omc/notepad.md`, decide between schema refinement or threshold relaxation.

**Pass criteria (Path A spec §5, MEDIUM threshold):**
- Logistic test accuracy ≥ 55%
- Logistic beats baseline by ≥ 10pp
- Confusion matrix non-degenerate (not predicting one class for everything)
- All 8 classes appear in test predictions with non-zero recall

**Fail modes A–D per Path A spec §5 are folded in verbatim** — executor follows the remediation flow there.

**Acceptance:**
- [ ] `python test_gates_v1.py` exits 0.
- [ ] Manual validation checks (Path A spec §4) hand-verified and noted in `.omc/notepad.md`.
- [ ] Decision recorded: PROCEED to P-B1, or HALT to refine schema.

---

### P-B1 — `train/dataset.py` (1 day)

**Goal:** Factor out CSV loading into a testable module. Shared by `train_gnn.py` (Path B) and (optionally) `train_v1.py` (Path A regression).

**New file:** `train/dataset.py`. Interface per Path B §3:

```python
from pathlib import Path
from dataclasses import dataclass
import torch

@dataclass
class FlavorGraphData:
    node_features: torch.Tensor        # [N, ~150]
    edge_index:    torch.Tensor        # [2, E]
    edge_attr:     torch.Tensor        # [E, 8]
    name_to_idx:   dict[str, int]
    vocabularies:  dict[str, list[str]]  # 'tier1', 'tier2', 'tier3', 'leaves', 'principles'

def load_flavor_graph(csv_path: Path) -> FlavorGraphData: ...
```

**Encoding per Path B §2.1:**

| Tier | Dim | Multi-value? |
|---|---|---|
| tier1_aroma | 5–17 (use the 5-term Q7 vocabulary `{fruity, floral, green, woody, fatty}` per `.omc/notepad.md` pre-flight Q7, NOT 17) | yes — multi-hot |
| tier2_taste | 7 (`{sweet, sour, bitter, umami, pungent, astringent, spicy}` — salty excluded per Q6) | yes — multi-hot |
| tier3_mouthfeel | ~26 (built from data; emit vocab list in output for downstream consumers) | yes |
| leaves | ~120 (built from data) | yes |
| **total node feature dim** | **~158** | — |

Edge features: `one_hot(principle)` over 8 canonical classes = 8 dims. If a pair appears in multiple rows with different principles, union into multi-hot (multi-label).

**Pre-flight constraints honored verbatim:**
- `tier1_aroma` vocabulary is the 5-term Q7 set (`spicy` excluded — `.omc/notepad.md` line 102).
- `tier2_taste` excludes `salty` per Q6; rows with `salty` are filtered out at vocab build (not crashes — silent skip with a counter logged).
- The bake reads from `flavor-gnn/curation/principle_vocab.json` for the principle collapse table — do not hardcode collapse rules here.

**Symmetric edges:** Per Path A Open Q2 default = "separate samples" — emit both `(A→B, principle)` and `(B→A, principle)` only if they appear that way in the data. Don't synthesize.

**Acceptance:**
- [ ] `train/dataset.py` exists; `load_flavor_graph(csv_path)` returns a `FlavorGraphData` instance.
- [ ] `node_features.shape == (N, ~158)` for the chef-saved CSV.
- [ ] `edge_attr.shape == (E, 8)`.
- [ ] `name_to_idx[name]` lookup works for all 74 chef-verified rows.
- [ ] No `salty` reaches `tier2_taste`; no `spicy` reaches `tier1_aroma` (grep gate in test).

---

### P-B2 — `train/model.py` defaults (¼ day)

**Goal:** Bump GAT hyperparameters per Path B §2.3.

```python
class FlavorGAT(torch.nn.Module):
    def __init__(self, node_in=158, edge_in=8, hidden=32, out=16, heads=4):
        ...
```

Architecture is otherwise unchanged.

**Acceptance:**
- [ ] `model.py` defaults updated.
- [ ] `FlavorGAT()` forward-pass smoke test (in `test_gnn.py`) passes with random inputs of correct shape.

---

### P-B3 — `train/train_gnn.py` rewrite (2 days)

**Goal:** Rewrite end-to-end per Path B §3.

**KEEP (lines roughly as-is):**
- GAT training loop (`for epoch in range(300)`)
- UMAP → 3D + KMeans clustering block
- Embedding export to JSON

**DELETE:**
- Old `ingredients.json` / `pairings.json` loading
- `TASTE_ORDER` + `taste_to_vector()` (replaced by multi-hot)
- `EDGE_KEYS` / `BD_KEYS` + `edge_feats` (legacy schema)
- Novelty regressor block (no ground truth in new data)
- Hardcoded `CLUSTER_LABELS` array (replace with post-hoc labeling from cluster centroids' nearest-leaf signature)

**REWRITE:**
- Data loading → `dataset.load_flavor_graph()`
- Loss → hybrid: `0.7 * contrastive + 0.3 * classification` per Path B §2.4 Option A
- Output JSON → new `public/proDataset/flavor_graph_data.json` matching new schema

**Hybrid loss math:**

```python
# contrastive — pull connected nodes together
contrastive_loss = mean(||z_i - z_j||² for (i,j) in edge_index)

# classification — predict principle from embedding pair
edge_emb = concat([z[edge_index[0]], z[edge_index[1]]])  # [E, 2*out]
logits = edge_classifier(edge_emb)                       # [E, 8]
clf_loss = F.cross_entropy(logits, edge_principle_idx, weight=class_weights)

total = 0.7 * contrastive + 0.3 * clf
```

The `edge_classifier` is a small MLP head (2 layers, ~32 hidden) added to the existing GAT.

**Tradition handling (Path B Open Q3):** drop `tradition`-labeled edges from the auxiliary classification loss (keep them in topology contrastive). Configurable via `--include-tradition` flag (default off).

**Class weighting:** compute weights from train-edge principle distribution. `shared-volatile` will dominate — apply inverse-frequency weights to the classification head.

**Annealing safeguard (Path B §5 Risk):** if `0.7 / 0.3` weighting causes the auxiliary loss to dominate (heuristic: classification loss < 0.1 by epoch 50 while contrastive plateaus), log a warning and downweight `clf` by 0.5×. No auto-recovery — surface to the user.

**Output artifacts:**
- `public/proDataset/flavor_graph_data.json` — node embeddings + edge list, schema:
  ```json
  {
    "nodes": [{"name": "thyme", "x": ..., "y": ..., "z": ..., "embedding": [...], "cluster": 0, "tier1": ["green"], "leaves": ["thymolic", "phenolic", ...]}, ...],
    "edges": [{"source": "thyme", "target": "lamb", "principle": "shared-volatile"}, ...],
    "clusters": [{"id": 0, "label": "Phenolic Herbs", "centroid": [...]}, ...],
    "_meta": {
      "n_nodes": 74,
      "n_edges": 171,
      "principle_vocab": [...],
      "tier1_vocabulary": [...],
      "leaves_vocabulary": [...],
      "trained_at": "2026-05-22T...",
      "tradition_dropped_from_aux_loss": true
    }
  }
  ```
- `train/training_log.json` — per-epoch losses, final accuracy on classification head.
- `train/cluster_labels.json` — post-hoc cluster names derived from each cluster's most-common leaves.

**KMeans seeding:** seed with `random_state=42` so cluster IDs are stable across re-bakes (fixes the cluster_labels jitter we hit in v2 P1).

**Acceptance:**
- [ ] `train/train_gnn.py` runs end-to-end on chef-saved CSV without error.
- [ ] `public/proDataset/flavor_graph_data.json` exists, validates against schema above.
- [ ] Classification loss converges (final < 1.5).
- [ ] Contrastive loss converges (final embedding-distance distribution shows connected pairs closer than random — quantitative check in `test_gnn.py`).
- [ ] Output JSON parseable by existing 3D scene loader (use existing `x, y, z, cluster` fields; new fields are additive).

---

### P-B4 — `train/test_gnn.py` smoke tests (½ day)

**Goal:** Per Path B §3 deliverable list.

**Tests:**
1. `dataset.load_flavor_graph()` returns expected shapes (`[N, 158]`, `[2, E]`, `[E, 8]`).
2. `FlavorGAT()` forward pass on random inputs returns `[N, out]`.
3. One epoch of training reduces total loss.
4. Output JSON validates against the schema above.
5. Cluster IDs are stable across two runs with seed=42 (regression for the v2 P1 KMeans jitter).
6. No `salty` in tier2 vocab; no `spicy` in tier1 vocab.
7. Mint fixture survives end-to-end: `nodes["mint"].tier1` = `["green"]`, leaves include `menthol`, `cooling` mouthfeel surface in tier3.

**Acceptance:**
- [ ] `python -m pytest train/test_gnn.py` exits 0.
- [ ] All 7 tests pass.

---

### P-B5 — Visual validation (1 day)

**Goal:** Path B §6 success criteria 3 + 4. Open the 3D scene in `neuralflavor.web.app` (or local dev) with the new `flavor_graph_data.json` and visually verify chemistry-family clustering.

**Spot checks:**
- thyme + oregano cluster together (phenolic)
- rosemary + sage + basil cluster together (camphoraceous) — only if those rows are chef-verified
- alliums cluster (garlic, onion, shallot)
- citrus cluster
- bacon between smoky + meaty (bridge)

**Tolerable misses:** the 73-row dataset means most pairs are sparse; we accept clusters that are "directionally correct" rather than "perfect."

**Acceptance:**
- [ ] At least 3 of the 5 spot checks pass (thyme/oregano, alliums, citrus minimum).
- [ ] No console errors loading the new JSON in the 3D scene.
- [ ] If any spot check fails, root-cause noted in `.omc/notepad.md`.

---

### P-C — UI integration (3 days, deferred from v2 P3–P6)

**Goal:** Resume the v2 plan's UI work, now against the new `flavor_graph_data.json` embeddings + edge labels.

This phase re-applies v2 P3 (IngredientPanel tree-view + TierBadge), v2 P4 (network re-color via primary Tier-1), v2 P5 (filter pill for flavor-category), and v2 P6 (`flavor2D` mode key) — but reads from `flavor_graph_data.json` (Path B output) instead of the deferred `flavor_graph.json` (v2 P2 — never built).

**Differences from v2:**
- `flavor_graph.json` (v2 P2 artifact, never built) is dropped from this delivery. The richer `flavor_graph_data.json` replaces it.
- The "primary Tier-1 selector" in v2 P5 reads `nodes[i].tier1[0]` (chef-curated) for the 74 verified rows and falls back to `gnn_entropy.json` for the ~3,400 long-tail ingredients that weren't chef-verified.
- The flavor-category filter pill in v2 P6 now filters by either tier OR `pairing_principles` (e.g., "show me all `cut-fat` pairings").

**Sequence:** D8–D10 of total schedule.

Detailed phase breakdown (P-C1 through P-C4) follows v2 §2.2 P3–P6 verbatim, with the artifact name and field map updated.

**Acceptance (per v2 §2.4):**
- [ ] `BRISCIONE_TASTE` literal unchanged (grep gate from v2 Principle 1).
- [ ] Mint fixture renders identically (v2 P3 canonical assertion).
- [ ] Soak gate `flavor_recolor_diff.json._meta.n_catastrophic` ≤ 50 (v2 P5 forbidden-transitions gate).
- [ ] All existing tests pass; total test count = 752 (per v2 R2 delta table) +5 new (3 for Path A regression that we keep, 2 for Path B dataset).

---

## 3. Files affected (summary)

| Action | Path | Purpose |
|---|---|---|
| RENAME | `flavor-gnn/curation/top500_flavor_graph.csv.csv` → `top500_flavor_graph.csv` | undo Excel artifact |
| EDIT | `flavor-gnn/scripts/scaffold_top500_curation.py` | add 9-col schema awareness |
| CREATE | `flavor-gnn/curation/principle_vocab.json` | single source of truth for principle collapse |
| CREATE | `train/train_v1.py` | Path A validator (~150 LOC) |
| CREATE | `train/requirements_v1.txt` | pandas, sklearn, matplotlib |
| CREATE | `train/test_gates_v1.py` | drop-in from `C:/Users/scher/Downloads/test_gates_v1.py` |
| CREATE | `train/results.json` | Path A output artifact |
| CREATE | `train/confusion_matrix.png` | Path A diagnostic |
| CREATE | `train/dataset.py` | Path B CSV loader |
| EDIT | `train/model.py` | bump defaults (node_in=158, edge_in=8, hidden=32, out=16) |
| REWRITE | `train/train_gnn.py` | Path B end-to-end |
| EDIT | `train/requirements.txt` | add `pandas` |
| CREATE | `train/test_gnn.py` | Path B smoke tests |
| CREATE | `public/proDataset/flavor_graph_data.json` | Path B output (replaces v2's `flavor_graph.json`) |
| CREATE | `train/training_log.json` | per-epoch losses |
| CREATE | `train/cluster_labels.json` | post-hoc cluster names |
| EDIT | `src/hooks/useProData.js` | (P-C) load `flavor_graph_data.json` |
| CREATE | `src/components/TierBadge.jsx` | (P-C) v2 P3 work |
| EDIT | `src/components/IngredientPanel.jsx` | (P-C) v2 P3 work |
| EDIT | `src/data/networkModes.js` | (P-C) v2 P6 mode key + filter |
| EDIT | `src/three/NodeMesh.js` (or equiv.) | (P-C) v2 P4 re-color |
| MOVE | `public/proDataset/ingredients.json`, `pairings.json` | → `legacy/` after P-B confirmed working |

---

## 4. ADRs (this plan's decisions)

### N1-V3-ADR-1 — Maillard-bridge: keep separate in V1

**Decision:** Keep `maillard-bridge` as the 8th canonical class for V1. Do NOT collapse to `shared-volatile`.

**Why:** Path A spec defaults to collapse (`maillard_collapse_default: false` in `principle_vocab.json` per P-A0). The 27 maillard rows in chef data are chemistry-distinct (browning, pyrazines) from shared-volatile (terpenes, esters). Keeping the class gives the model one more head, and `test_gates_v1.py` already accepts either 7 or 8 classes.

**Consequences:** If V1 still fails to hit MEDIUM threshold, the first ablation is to set `maillard_collapse_default: true` and re-run.

### N1-V3-ADR-2 — Filter-rate mitigation: M1 (backfill) over M2 (lower threshold)

**Decision:** Backfill ~15 rows targeting the highest-frequency `key_pairings` ingredients not yet in `name` column. Document the prioritized list in P-A0.

**Why:** The 33% filter rate isn't a data-quality problem (the chef-verified rows are high-quality); it's a graph-completeness problem (chef hasn't filled rows for ingredients that are pairing TARGETS of other ingredients). Backfilling is cheap chef-time (~3h for ~15 rows) and lifts every downstream gate.

**Consequences:** If chef-user can't backfill in time, fall back to M2: lower V1 threshold to `≥30%` and document in `.omc/notepad.md`. The fallback is a one-line change to the gate.

### N1-V3-ADR-3 — Loss weighting: 0.7 contrastive + 0.3 classification

**Decision:** Per Path B §2.4 Option A. Hybrid objective.

**Why:** Pure contrastive (current behavior) ignores chemistry signal; pure classification might collapse embeddings into class clusters and lose pairwise topology. The hybrid preserves both.

**Consequences:** Annealing safeguard in P-B3 — if classification loss reaches <0.1 by epoch 50, log warning and downweight by 0.5×.

### N1-V3-ADR-4 — Tradition edges: drop from aux loss, keep in topology

**Decision:** Per Path B Open Q3 first option.

**Why:** `tradition` is the catch-all by design and will pull together unrelated nodes if it's in the aux loss. Keeping it in topology preserves the chef's intent ("these ingredients DO go together, just not via chemistry") without polluting the classifier.

**Consequences:** Configurable via `--include-tradition` flag; default off.

### N1-V3-ADR-5 — KMeans seed: pin to 42

**Decision:** Always pass `random_state=42` to `KMeans()` in `train_gnn.py`.

**Why:** v2 P1 caught the bug — unseeded KMeans makes `flavor_cluster_labels.json` jitter across re-bakes, producing noisy diffs and breaking byte-equality assumptions downstream.

**Consequences:** Cluster IDs are now stable across re-runs. Smoke test (P-B4 test 5) regression-checks this.

---

## 5. Risks (carry-over from Path A + Path B specs)

- **R1 — 74-row dataset is too small for GAT** (Path B §5). Mitigation: contrastive learning works at small scale (provable in test 5); hidden dim 32 prevents overfit; eventual backfill to 200+ rows.
- **R2 — Multi-value tier1 confuses attention** (Path B §5). Mitigation: visual check — bacon (`smoky|meaty`) should sit BETWEEN clusters, not arbitrarily near one. L2-normalize sub-vectors if skewed.
- **R3 — Class imbalance hurts aux loss** (Path B §5). Mitigation: class weighting + tradition dropping (ADR-4).
- **R4 — Three.js scene breaks on new metadata** (Path B §5). Mitigation: `flavor_graph_data.json` schema additive — existing `x, y, z, cluster` fields preserved.
- **R5 — Chef can't backfill in time** (this plan, §1 Finding 2). Mitigation: ADR-2 fallback to M2.

---

## 6. Status snapshot (2026-05-19)

- v2 P0 + v2 P1 ✅ shipped as commit `a04486e` (Path A + Path B don't touch them; the scaffold script gets a 9-column schema bump in P-A0).
- v2 P2 ❌ superseded — `flavor_graph.json` replaced by `flavor_graph_data.json` (Path B output).
- v2 P3 ⏸ deferred to P-C (Path C UI integration).
- v2 P4–P6 ⏸ deferred to P-C.
- Path A — not started. ETA 2 days after pre-flight resolved.
- Path B — not started. ETA 5 days after Path A passes.
- Path C — not started. ETA 3 days after Path B passes.
- **Total remaining:** ~10 days work + chef-user backfill time.

---

## 7. Next concrete action

Run P-A0 step 1: rename `top500_flavor_graph.csv.csv` → `top500_flavor_graph.csv`. Decide whether chef-user backfills (M1) before V1 trains, or whether to lower the filter-rate threshold (M2). Then bump `scaffold_top500_curation.py` to the 9-column schema. Both are <30-minute changes; the chef-user backfill decision is the gating step.
