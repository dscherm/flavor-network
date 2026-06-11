# Flavor-Model Investigation — Summary & Decision Record (2026-06-10)

**Status:** Authoritative conclusion of the molecular taste/odor model improvement
campaign. Where any older doc (e.g. `.claude/.chemdataset-status.md`, the
GNN-LIFT spec, plan.md task blocks) contradicts the conclusions here, **this
document supersedes it.** Nothing in this campaign was committed; all artifacts
are measurement/analysis records.

---

## 1. What we set out to do
Improve the molecular GNN's weak odor heads (odor_spicy, odor_floral, etc.),
prompted by an audit (`gnn-audit-2026-06-09.md`) and a literature deep-research
(`deep-research-flavor-gnn-2026-06-09.md`).

## 2. What we built (durable, valuable regardless of outcome)
A rigorous **measurement harness** — this is the lasting infrastructure:
- **P0 measurement gate** — exposed that the original CV numbers were inflated by
  (a) no molecular scaffold split (FartDB homolog leakage), (b) calibration-on-test,
  (c) best-epoch-on-test selection. Fixed all three.
- **DeepChem balanced-scaffold CV** (benzene pinned to train; 5 seeds) + held-out
  calibration + validation-epoch selection.
- **The paired-control pattern** (`--no-augment-train`, identical-test toggles) —
  the single most important methodological tool. It caught a phantom "win" (P3b)
  that cross-test-set comparison had manufactured.

**Methodological lesson (write this into team practice):** never compare model
variants across different test sets. Always pair on an identical held-out set.
Cross-test-set comparison conflates intervention effect with test-set difficulty
and produces false wins. This fooled the campaign through three runs.

## 3. Molecular lever results (all paired-measured)

| lever | result |
|---|---|
| **GAT backbone** (GATv2 attention msg-passing) | **only real win** — floral +0.058 (4/5 seeds), sweet +0.047, sour +0.035, paired/clean |
| `mean_max` readout | marginal (sour win), banked |
| `mean_max_sum` readout | rejected (net negative, hurts sweet) |
| odor-label de-noise (P1c) | rejected (flat-to-negative) |
| external odor data / Pyrfume-Leffingwell (P3b) | **flat** — the apparent +0.12 floral / +0.14 fatty was a **test-set artifact**; the paired control showed mean odor Δ ≈ −0.01 |
| physchem descriptors | rejected (negative, hurts sweet) |
| chirality/stereo features | **untestable** — only 0.5% of our SMILES carry stereo |

**Banked molecular config:** GAT backbone + mean_max readout + 12 heads (incl. the
viable `odor_nutty` head, F1 0.442 from FlavorDB alone). `odor_woody`/`odor_nutty`
conflict with external-set labels and should not merge external odor data.

**The molecular finding:** odor improvement comes from a better *inductive bias*
(attention), not from more aggregation, cleaner labels, more data, or richer input
features. But — see §4 — molecular F1 turned out to be the wrong objective.

## 4. THE KEY FINDING — molecular gains barely reach the user

We tested whether molecular odor F1 survives the `compound → ingredient`
aggregation to what the user actually sees. It does not:

- **Chef per-head ingredient AUROC ≈ 0.5** (near-random) for almost every head.
  Even sweet (molecular F1 0.904) has ingredient AUROC 0.598; its apparent
  ingredient F1 0.78 was a base-rate artifact. The 6 odor heads have ingredient
  chef F1 ≈ 0.000 under the shipped topk_mean aggregation.
- The per-head threshold *surfacing* is the bottleneck — it throws away whatever
  signal the profile carries.

## 5. Validation against the Flavor Bible (the more reliable ground truth)

The chef set is only 304 rows. The Flavor Bible (`data/flavor_bible_full.csv`,
25,844 curated pairings — same data as areeves87/Flavor-Bible-App) is the stronger
test. Question: do GNN flavor profiles predict FB pairings?

- Naive cosine similarity: AUROC 0.43 (fails — but pairing is partly *contrast*,
  not similarity, so this is the wrong operationalization).
- **Learned classifier** (profile contrast + co-presence features), as the matched
  set grew more representative: **0.696 (2,330 pairs) → 0.595 (5,457) → 0.579
  (9,557).** Converges to **~0.58 — weak, only slightly above random.** The 0.696
  was small-sample optimism.

**FB↔ingredient name matching:** improved 9% → 46% (token-set matching was the key;
`scripts/match_flavor_bible_v2.py`). Most remaining "misses" are **non-ingredients**
— multi-ingredient affinity combos ("achiote + pork + sour orange"), cuisines,
`aka:` alias lines, categories. So true ingredient overlap is even higher than 46%;
the vocabulary gap was largely a matcher + FB-data-hygiene artifact, not real.

## 6. Conclusion (supported by 3 independent ground truths)
Chef labels (~0.5), Flavor Bible pairings (~0.58), and the prior measured result
that GNN embeddings lose to co-occurrence ~4.6× for pairing recovery all converge:

> **The molecular GNN's ingredient-level flavor profile is a WEAK culinary-signal
> tool.** It is a fine *visualization/explanation* surface (the radar charts) but a
> weak *pairing/recommendation* signal. The molecular-lever campaign improved a
> quantity (molecular CV F1) with little downstream value to the user.

## 7. Recommendation — where effort should go
1. **Pairings/recommendations: use curated graphs, not the flavor model.**
   - RecipeNLG co-occurrence (already shipped) remains the reliable pairing signal.
   - **Integrate the Flavor Bible curated graph** as a complementary pairing layer
     (set-intersection, like the reference app). It's now matched into ~half (and
     rising) of our ingredient space — `public/proDataset/flavor_bible_matched.json`
     (9,557 pairs). This is the highest-value, lowest-effort, no-ML lever the
     investigation surfaced.
2. **Flavor model: keep as visualization only.** Stop optimizing molecular CV F1.
   If GAT is adopted, it's a modest profile-quality improvement, not a pairing or
   user-facing-accuracy improvement.
3. **Do NOT retry** (measured dead-ends): more molecular odor data (P3b),
   focal loss, SMILES enumeration, DREAM ingestion, descriptors, readout-beyond-
   mean_max. Chirality is untestable without isomeric SMILES (re-sourcing required).

## 8. Artifacts produced
- `gnn-audit-2026-06-09.md`, `deep-research-flavor-gnn-2026-06-09.md` (inputs)
- `cv_scaffold_delta.md`, `threshold_calibration_heldout_delta.md` (P0 gate records)
- `p1_levers_results.md` (lever measurements — note its early "P3b works" section is
  marked SUPERSEDED; the paired control is authoritative)
- `cv_results_scaffold_*.json` (CV artifacts: baseline, gat12, p1a/p1c/p3b, control)
- `public/proDataset/flavor_bible_matched.json` (the shippable FB pairing graph)
- `public/proDataset/processed_foods.json` (strand-2 recipe-food manifest, 441 foods)
- `scripts/match_flavor_bible_v2.py`, `scripts/audit_processed_foods.py`
