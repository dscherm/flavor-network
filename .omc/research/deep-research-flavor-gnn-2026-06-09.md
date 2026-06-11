# Deep Research — Improving Molecular Flavor/Odor Prediction (SMILES → taste + odor)

**Date:** 2026-06-09
**Question:** Most promising, evidence-backed levers to lift a multi-task GINEConv MPNN that
predicts 5 tastes + 6 odor descriptors, bottlenecked on weak odor heads (spicy, floral) and salty.
**Provenance:** Synthesized from 85 claims extracted by the `deep-research` workflow run
`wf_029c5316-551` (5 search angles, ~19 source-fetch agents). The workflow's own synthesis step
was lost to a session-limit hit; this report was reconstructed by mining the run's cached
StructuredOutput payloads directly. Claim numbers `[n]` refer to that extraction set.

Read alongside the companion technical audit: `.omc/research/gnn-audit-2026-06-09.md`.
Where the two agree, confidence is high (independent code-evidence + literature-evidence).

---

## TL;DR — what the literature says to do (and not do)

1. **Your architecture is the right one.** The Principal Odor Map (Osmo/Google) is an MPNN/GNN
   on ~5,000 molecules that beats the median human panelist — the same class of model and a
   *comparable label scale* to what you already have. You are not on the wrong horse. [62,63,81,82,85]
2. **Salty is genuinely unsolvable from SMILES.** Independent literature confirms the audit and
   your status doc: salty is an ion-channel (ENaC) phenomenon, not ligand binding. Every serious
   taste model (FART, Dutta 2023) *excludes salty by design*. Drop the head. [1,2,3,4,36,52]
3. **The single strongest convergent lever: change the readout.** External work shows `set2set`
   pooling measurably improves odor prediction on sparse molecular graphs — independent
   confirmation of the audit's Finding 1.2 (global_mean_pool dilutes local motifs). [59]
4. **Add fingerprints/descriptors alongside the graph.** FP+GNN fusion beats either alone for
   taste (sweet F1 0.852). Confirms audit Lever 3. [49,50]
5. **Foundation-model encoder swap is NOT a slam dunk.** A pretrained MoLFormer with no olfactory
   fine-tuning only *matches* the graph POM and stays *below* it on expert odor labels;
   fine-tuning made odor *worse*. Treat it as an auxiliary-feature experiment, not a rewrite. [20,21,22,24,42]
6. **Naive noisy-OR is theoretically inadequate for true mixture odor** — but that is a different
   problem from your compound→ingredient aggregation. Nuance below; it changes how you should
   read the audit's Lever 1. [27,78]
7. **The binding constraint on weak heads is labeled positives, and the best public odor datasets
   are non-commercial-licensed** — a hard blocker the audit could not see. [17,32,34,70,75]

---

## Angle 1 — Foundation-model molecular encoders (transfer learning)

**Scale is the driver, and the payoff is modest for your regime.**
- MoLFormer-XL: SMILES transformer pretrained on ~1.1B molecules (PubChem 111M + ZINC ~1B);
  matches/outperforms GNN baselines on MoleculeNet. [5]
- But the gain is **corpus-size-dependent**: performance climbs monotonically from 10% → full
  corpus, and smaller chemical LMs (ChemBERTa, 10–77M) *underperformed* GNNs. A small pretrained
  checkpoint is not free lift. [6]
- ChemBERTa-2 (≤77M compounds) reaches only **parity** with SOTA on MoleculeNet, not a decisive
  win. [40,41,42]
- Fine-tuning the full encoder beats frozen embeddings *in general*. [7] **But for odor
  specifically, fine-tuning did not help and was slightly worse — frozen embeddings as features
  were preferable.** [24]

**Most decision-relevant finding:** a pretrained MoLFormer with *no* olfactory fine-tuning performs
**on par with** the graph-based Open-POM and the hand-engineered DAM on human olfactory tasks [20];
on expert-label odor (GS-LF) it beats DAM but stays **below** Open-POM [21]; on continuous human
ratings it is competitive but **slightly trails** Open-POM (Keller r 0.20 vs 0.22; Sagar 0.25 vs
0.29). [22] Its frozen embeddings do correlate strongly with human perceptual similarity (r 0.64–0.66). [23]

> **Read:** A foundation encoder will not decisively beat your dedicated graph model on odor. The
> low-risk version is to **concatenate frozen MoLFormer embeddings as auxiliary features** next to
> the GINEConv readout — not to replace the backbone. Expect a small lift, not a breakthrough.

**FART (already in your pipeline as a data source):** a ChemBERTa-based taste transformer, >91%
multi-class accuracy on sweet/bitter/sour/umami + tasteless, **salty excluded by design**; 15,025
curated SMILES from 6 sources; public on GitHub. [35,36,37,38,39] You already ingest FartDB's labels;
the *model* is a SMILES-transformer alternative you have not tried.

---

## Angle 2 — Principal Odor Map (why graph-based odor prediction works)

- POM is an MPNN/GNN trained on **~5,000** GoodScents+Leffingwell molecules with per-atom features
  (valence, degree, H-count, hybridization, formal charge, atomic number) — and it matches the
  human panel mean better than the **median panelist**. [62,66] On a 400-odorant prospective set it
  beat the median panelist for **53%** of molecules vs 41% for random forest. [63,82]
- **Why it beats fingerprints: the GNN reweights fragments for the odor task**, whereas Morgan
  fingerprints weight all fragments in a radius equally and lose perceptual-distance structure. [65,77]
- The learned POM embedding **transfers**: a simple linear model on top of POM beats chemoinformatic
  SVM/RF baselines on detection threshold, perceptual similarity, descriptor applicability. [64,83,84]
- Training recipe (reproducible): weighted cross-entropy, 150 epochs, Adam lr 5e-4→1e-5, batch 128. [66]

> **Read:** This is direct validation that your GINEConv MPNN is the correct architecture, and that
> **~5,000 labeled molecules is enough for human-level odor** — so your weak heads are a
> label-quality/quantity and readout problem, not an architecture problem. [85] Note their longer
> training schedule (150 epochs vs your 15) — pairs with the audit's Finding 3.4 (no LR schedule /
> undertraining on rare heads).

---

## Angle 3 — Public odor/taste datasets (coverage + licensing)

| Dataset | Scale | Format | License | Note |
|---|---|---|---|---|
| **Pyrfume** | 40+ datasets, 20,000+ odorants | SMILES+CID, REST/Zenodo, RDKit-ready | **Non-commercial FAIR** [17,75] | Aggregates Leffingwell, GoodScents, Sigma, Dravnieks, Keller [73] |
| Leffingwell PMP + Firmenich | 3,523 + 4,704 = 7,374 | — | mixed | Only **75** reliable descriptors after dedup [34] |
| **BitterDB 2024** | 2,250+ bitter (2× 2019) | + AlphaFold 3D for 111 TAS2Rs | **CC BY-NC** [70] | Receptor-resolved bitter labels [67,68,69] |
| GoodScents (pairs) | 160k+ molecule-pairs | presence/absence, 104–109 notes | **CC BY-NC-ND** [80] | For mixture/pair odor models [29,80] |
| FART | 15,025 SMILES | 6 sources, GitHub | public | Taste, salty excluded [38,39] |
| Dravnieks | 138 molecules | structured vocab | — | Illustrates the small-label bottleneck [74] |

**The binding constraint is rare-class positives, quantified:** odor-descriptor predictability tracks
label frequency almost perfectly — Fruity (F1 0.540, 2050 positives) and Mint (0.557) predict well;
rare/abstract descriptors (Clean 0.053, Sharp 0.054, Chemical 0.075) do not. Per-class counts range
2050 → 9. Severe imbalance (MeanIR 29.17, label density 0.0285). [30,31,32] Classical FP+RF plateaus
at F1 0.35 across 75 descriptors. [30]

> **Read — TWO hard caveats the audit could not see:**
> 1. **Licensing is a deployment blocker.** Pyrfume, BitterDB, and the GoodScents pair corpus are
>    all **non-commercial**. This app is a commercial product. Ingesting these to lift odor heads is
>    fine for *research/measurement* but their labels may not be shippable. Verify per-source before
>    baking anything into `compounds.parquet` for production. [17,70,75,80]
> 2. **More clean positives is the proven lever, but only above the noise floor.** This corroborates
>    the audit's framing of why DREAM failed (90–135 positives, below noise) and why de-noising
>    existing labels (audit Lever 4) beats trickle-ingestion.

---

## Angle 4 — Mixtures / noisy-OR / MIL (compound-food flavor)

**Critical nuance that reframes the audit's Lever 1.** There are two *different* aggregation problems:

- **(A) Compound → ingredient** (the audit's `noisy_or` lever): "given N molecules in this
  ingredient, each with p(property), what's p(ingredient has property)?" Here noisy-OR
  `1−∏(1−pᵢ)` is the correct probabilistic union and the audit's in-repo benchmark shows it works
  (+0.091 chef macro-F1). **The literature does not contradict this.**
- **(B) Ingredient(s) → mixture/dish odor** (compound foods like mayo, BBQ sauce): here the
  literature is emphatic that **naive averaging/noisy-OR is inadequate** — mixture embeddings are
  **not** linear combinations of constituents (linear regression r² = 0.47 MPNN / 0.021 GIN), and
  mixture odor is non-linear and emergent: combining notes produces new qualities and can *mute*
  others. [27,78]

For problem (B), the state of the art is **learned attention aggregation**, not fixed pooling:
- **POMMix** extends POM to mixtures via attention over per-molecule GNN embeddings + a cosine head;
  SOTA on mixture similarity, generalizes to unseen molecules and mixture sizes. [10,11,12,13]
- **AROMMA** learns a unified single-molecule + mixture embedding space with an attention aggregator
  (permutation-invariant, captures asymmetric interactions), foundation-model encoder per molecule,
  knowledge distillation + class-aware pseudo-labeling to align fragmented datasets →
  **up to +19.1% AUROC**, SOTA on single + pair odor. [44,45,46,47,48]
- Pair models: GIN on aroma pairs AUROC 0.80 [25]; MPNN 0.7627 vs GIN 0.7359 [76]; **joint
  two-component graph beats post-hoc aggregation** [79]; Set2Set recommended for 3+ molecules. [26]
- Caution: modeling label *correlations* (classifier chains) did **not** beat binary relevance
  despite strong co-occurrence (green+fruity 518×). Don't over-invest in correlation-aware heads. [33]

> **Read:** Keep `noisy_or` for the compound→ingredient step (audit Lever 1 stands). For your
> in-flight **compoundFoods.js "predicted from components"** badge (mayo/vinaigrette), do **not**
> average/union constituent predictions — that's the exact case the literature says fails. Use a
> learned attention/Set2Set aggregator (POMMix/AROMMA pattern) if you want it to be defensible, or
> label it clearly as a heuristic.

---

## Angle 5 — 3D conformers and atom-environment features

**Marginal for taste/odor quality; relevant only for intensity / quantum properties.**
- Adding 3D geometry contributes only a **small** independent benefit to property prediction
  (plausibly because the conformer is randomized); multi-modal SMILES+2D+3D fusion beats graph-only,
  but was tested on general benchmarks (BACE/BBBP/Tox21…), not taste/odor. [54,55,57]
- MoLFormer already implicitly captures 3D interatomic distances from 1D SMILES (cosine 0.59–0.73). [8]
- Explicit-3D models (SchNet/DimeNet) only decisively win on quantum-energy tasks needing precise
  geometry (DimeNet ~10× lower MAE on QM9). [9]
- The one odor-positive 3D result is **odor *intensity*** (a regression task, not quality): 3DGCN
  beats 2D GAT, and **set2set readout improves odor-intensity on sparse graphs**. [58,59,60,61]

> **Read:** Do not invest in 3D conformers for your taste/odor *quality* heads — low expected value.
> But [59] independently corroborates the **readout lever** (set2set/max-pool), which is the part of
> "richer features" that is actually worth doing. Atom-environment enrichment (the audit's chirality
> gap, Finding 1.4) is cheaper and better-targeted than full 3D.

---

## Angle 6 — Why salty is hard (and whether anyone cracked it)

**Mechanistically confirmed unsolvable from SMILES alone. No approach has cracked it.**
- Salty is mediated by **epithelial sodium channels (ENaC) via ion flux**, not receptor/ligand
  binding; the full pathway isn't even clarified. [1]
- Tastes split into two classes: **sweet/bitter/umami = GPCRs (T1R/T2R) → structurally
  predictable**; **salty/sour = ion channels (ENaC / proton channels) → governed by ionic
  physico-chemistry, not ligand shape.** [2] Salty/sour are modeled as ion currents (Goldman-
  Hodgkin-Katz), i.e. concentration/reversal-potential physics, not binding affinity. [3]
- Both FART and Dutta 2023 **exclude salty by design**; structure-from-SMILES taste prediction is
  restricted to the three GPCR tastes. [4,36] Salty is also perennially data-starved (12 molecules
  in one benchmark → excluded). [52]
- Counterpoint worth noting: **umami rarity ≠ unpredictability** — 98 umami molecules still hit
  F1 >0.70, because umami *is* GPCR-mediated. Rarity alone doesn't doom a head; mechanism does. [51]

> **Read:** Drop the salty head (audit Lever 5). Independent mechanistic confirmation. The only path
> to salty would be modeling matrix/ionic context — out of scope for a molecular GNN.

---

## Prioritized levers (literature-backed, cross-referenced to the audit)

Ordered by expected value / effort. ✅ = independently corroborated by both the code audit and the
literature (highest confidence).

1. **✅ Change the readout (mean-pool → mean+max+sum, or set2set).** Audit Finding 1.2 +
   literature [59,65]. Highest-confidence model change; 3 lines. Targets the odor-motif-dilution
   root cause directly.
2. **✅ Add RDKit physchem descriptors / fingerprints alongside the graph (FP+GNN fusion).**
   Audit Lever 3 + literature [49,50]. Sweet FP+GNN hit F1 0.852. Cheap, no new dependency.
3. **✅ Drop the salty head.** Audit Lever 5 + mechanistic literature [1,2,3,4,36]. Trivial.
4. **De-noise existing odor labels before ingesting new ones.** Audit Lever 4 + the
   frequency↔predictability evidence [31,32]. The binding constraint is clean positives; cleaning
   beats trickle-adding (this is *why* DREAM failed). Watch the non-commercial licensing on any new
   external odor labels. [17,75]
5. **Train longer with an LR schedule on the rare heads.** Audit Finding 3.4 + POM's 150-epoch
   recipe [66]. Your 15 epochs likely undertrains umami/odor heads.
6. **Auxiliary frozen-MoLFormer-embedding features (experiment, not rewrite).** [20,21,22,24]
   Expect a small lift; do NOT fine-tune for odor (made it worse [24]); do NOT replace the backbone.
7. **For compound-food flavor synthesis (compoundFoods.js): use learned attention / Set2Set
   aggregation, not averaging/noisy-OR.** [27,44,78] Naive aggregation provably fails for true
   mixtures (distinct from the compound→ingredient noisy_or step, which stands).

### Explicitly low-value / do-not-pursue (literature-confirmed)
- **Full 3D conformer features for taste/odor quality** — marginal benefit, randomized-conformer
  noise; only helps intensity/quantum tasks. [54,57]
- **Foundation-encoder backbone *replacement*** — only reaches parity with your graph model on
  odor; not worth the rewrite. [20,21,42]
- **Correlation-aware multi-label heads (classifier chains)** — did not beat binary relevance. [33]
- **Salty by any structural means** — mechanistically impossible from SMILES. [1,2,3,4]

---

## Limitations of this report
1. **Reconstructed, not workflow-synthesized.** Built from 85 cached claim-extractions after the
   workflow's synthesis step died to a session limit. The adversarial 3-vote verification stage did
   not complete for all claims, so claims here are source-extracted but not all cross-refuted. Treat
   single-source numbers as directional.
2. **Licensing is asserted from source descriptions, not legal review.** Confirm per-dataset before
   any production ingestion.
3. **Effort/lift estimates are inherited from the companion audit + published deltas**, not measured
   on this repo. Validate under a scaffold split (audit Lever 2) before trusting magnitudes.
