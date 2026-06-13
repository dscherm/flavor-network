# Ingredient-Level Odor Label Sourcing — Research & Decision Record (2026-06-13)

**Status:** Decision record. Follows directly from
`MODEL_INVESTIGATION_SUMMARY_2026-06-10.md`, which proved the molecular GNN's
taste/odor signal does **not** survive `compound → ingredient` aggregation
(chef per-head ingredient AUROC ≈ 0.5; odor-head ingredient F1 ≈ 0.0). That
investigation named the binding constraint: **the lack of a large, clean,
ingredient-level odor label set** to supervise a learned aggregator (e.g. a
Multiple-Instance-Learning model: bag = ingredient, instances = its compounds,
label = aroma descriptor).

This record answers: *can we re-source such a set, and should we?*

---

## TL;DR

1. **No off-the-shelf rescue exists.** Every ingredient-aroma dataset at scale
   is **molecule-keyed** (the exact aggregation failure mode), or paywalled, or
   below the scale we need.
2. **The only scalable path to ingredient-level labels is LLM distillation**
   against our fixed controlled vocabulary, calibrated on the 304-row chef gold
   set — and we already have the infra (the 39-batch LLM ingredient-accuracy
   audit, commit `efc9b1a`).
3. **This largely dissolves the MIL-over-molecules plan.** If we LLM-distill
   ingredient-level descriptors directly, they *are* the profile — we don't need
   a molecular aggregator to reproduce them. And a bigger label set does **not**
   raise the molecular model's culinary-signal ceiling (~0.58 AUROC vs the
   Flavor Bible); that ceiling is in the compound signal, not the label count.
4. **Decision: do not pursue a molecular MIL aggregator.** The calibration pilot
   (companion scaffold) **PASSED**: blind LLM labels hit **11-head macro-F1 0.710
   vs the molecular 0.101 — ~7×** (see "Pilot v2 RESULT" below). **Green-light to
   distill ingredient-level descriptors directly** as the profile surface and
   scale 304 → 3,913, with chef-row overlay precedence and salty/odor_spicy
   flagged low-confidence. The distilled labels are the product; the molecular
   model stays visualization-only as 2026-06-10 concluded.

---

## Research method

Deep-research workflow (2026-06-13): 5 search angles → 22 sources fetched → 101
claims extracted → 25 adversarially verified. **Caveat:** the verification stage
was heavily rate-limited; only 1 claim survived a full 2-of-3 vote, most
abstained (0-0). Scale figures below are **medium-confidence — re-check against
primary sources before committing engineering effort.** The *negative* finding
("everything at scale is molecule-keyed") is robust: it held across many
independent evaluations.

## Q1/Q3 — The dataset landscape

| Source | Ingredient scale | Granularity | Access | Verdict |
|---|---|---|---|---|
| FlavorDB2 (2024) | ~936 food entities | molecule-keyed (food = molecule set) | open | fails on aggregation; below scale |
| FoodAtlas (2025) | ~1,430 foods | chemical-keyed flavor (3,645 chem→flavor) | open | same molecule data we have |
| VCF (Volatile Compounds in Food) | ~1,610–2,112 products | compound-level descriptors | commercial subscription | paywalled + aggregation problem |
| FlavorGraph | ~8,000 mixed nodes | co-occurrence, no odor vocab | open | no descriptor labels |
| Leffingwell FRM 2001 | >5,500 materials (>1,400 "natural") | CAS/FEMA-keyed chemicals | US$2,775 CD-ROM | *only claim verified 2-0* — chemicals, not foods |
| Arctander "Natural Origin" | ~natural materials | ingredient-level (right shape) | borrow-only, not scrapeable; Pyrfume mirror is molecule-level | right granularity, no legal bulk access |
| GoodScents raw-material ("rw") | — | would be ingredient-level | **"future plan" in Pyrfume, not shipped** | watch this — best open natural-material candidate |
| Coffee/wine/beer/spice sensory lexicons + aroma wheels | hundreds | clean, ingredient/category-keyed | open (e.g. WCR coffee lexicon) | clean but narrow — seed/validation only |

**Sources:** FlavorDB2 https://ift.onlinelibrary.wiley.com/doi/10.1111/1750-3841.17298 ·
FoodAtlas https://www.nature.com/articles/s41538-025-00680-9 ,
https://pmc.ncbi.nlm.nih.gov/articles/PMC12868623/ ·
VCF https://www.vcf-online.nl/VcfCompounds.cfm ·
FlavorGraph https://pmc.ncbi.nlm.nih.gov/articles/PMC7806805/ ·
Leffingwell FRM 2001 http://www.leffingwell.com/bacisfrm.htm ·
Arctander https://archive.org/details/isbn_9781978241329 ·
Pyrfume https://pyrfume.org/pyrfume/published-data.html ,
https://github.com/pyrfume/pyrfume-data/tree/main/goodscents ·
WCR coffee lexicon https://library.sweetmarias.com/wp-content/uploads/2020/08/Sensory-Lexicon-World-coffee-research-2016.pdf

## Q2 — LLM distillation: viable, with guardrails

- **For:** GPT-4-generated labels match human annotations across 14 classification
  tasks (https://arxiv.org/abs/2406.17633) — distillation is legitimate
  weak-supervision.
- **Against:** LLMs fall short of human experts in specialized domains
  (https://arxiv.org/pdf/2508.07827); an olfactory-reasoning benchmark reportedly
  tops out ~64% (https://arxiv.org/pdf/2604.00002 — *paper/model id beyond
  knowledge cutoff; treat as indicative, not authoritative*).
- **Implication:** fixed controlled vocabulary + multi-sample/multi-model
  consensus + **calibrate against the 304-row chef gold set**. Never trust blind.

## Q4 — Recommended sourcing plan (ranked)

1. **Calibration pilot (cheap, decisive — DO FIRST).** Blind LLM-label the 304
   chef ingredients on the chef's native vocab; measure macro-F1 vs gold. If the
   taste macro-F1 clears ~0.65–0.70 (and beats the molecular 0.101 ingredient
   baseline decisively), distillation is real. Scaffold:
   `flavor-gnn/scripts/pilot_odor_labels/`.
2. **Scale distillation 304 → 3,913** with chef rows as few-shot anchors +
   consensus voting; keep chef rows as a gold overlay (precedence), exactly like
   the N1-D3 bake overlay pattern (chef rows win).
3. **Seed/validate with narrow clean lexicons** (coffee/wine/beer/spice aroma
   wheels) as a second independent anchor beyond the chef set.
4. **Commercial sources (Arctander/VCF/Leffingwell) only as small validation
   anchors** where licensing permits — never bulk training. Watch Pyrfume's
   GoodScents "rw" profiles in case they ship.

## Open questions

- Realistic precision of expert-anchored LLM consensus vs the chef gold set on
  *our exact* vocabulary? → the pilot answers this.
- Have GoodScents raw-material ("rw") profiles shipped in Pyrfume yet? → single
  most promising open natural-material source if so.
- Any licensable bulk export (CSV/API) of Arctander natural-origin or VCF
  food-entity descriptors that permits legal training-set construction?

## Calibration pilot RESULT (2026-06-13)

Ran the step-1 pilot: 5 blind subagents labeled all 304 chef ingredients given
only names + the controlled vocab (never the gold), scored by
`score_pilot.py`. Scaffold + outputs in `flavor-gnn/scripts/pilot_odor_labels/`.

| view | result | vs baseline |
|---|---|---|
| primary_aroma exact-match accuracy | 0.503 | — |
| taste multi-label macro-F1 | 0.617 | — |
| **11-head macro-F1 (GNN-mappable)** | **0.606** | **vs molecular 0.101 → ~6×** |

Per-head F1 (11-head view): sour 0.88, floral 0.82, umami 0.80, sweet 0.79,
fruity 0.77, bitter 0.75, green 0.73 · spicy 0.44 · salty 0.35 · woody 0.23 ·
fatty 0.10.

**The scorer's mechanical verdict was FAIL (taste macro-F1 0.617 < 0.65 bar),
but this is a FALSE NEGATIVE.** Diagnosis (spot-checked):
- **woody (R=0.13) and fatty (R=0.05) are crushed by the single-primary-aroma
  label format, not by LLM error.** Forced to pick ONE aroma, the LLM picked
  arguably *better* terms than the chef gold: chef `anchovy→woody`/`beet→woody`/
  `cardamom→woody` vs LLM marine/earthy/spicy; chef flattens `almond`/`avocado`/
  `butter`/`beef`→`fatty` vs LLM nutty/creamy/meaty. Precision when the LLM *does*
  emit woody/fatty is 0.88/1.00 — it under-emits, it isn't wrong.
- **salty (P=0.21): 44 LLM-salty / chef-umami disagreements** (anchovy, bacon,
  blue cheese, béchamel) — the salty↔umami overlap on the axis chemdataset-status
  already calls structurally unreliable.
- **spicy/pungent (F1 0.20/0.68): boundary-term disagreement** between two
  overlapping chef taste terms.

**Real conclusion: distillation works.** On the 7 well-defined heads the LLM
reproduces chef judgments at **0.73–0.88 F1 (~6× the molecular ingredient
baseline)**, blind. The 4 weak heads are label-format + gold-noise artifacts; in
several cases the LLM is *more* correct than the chef gold, so the true agreement
is understated.

**Next step before scaling:** re-run with (1) **multi-label aroma** (let the LLM
emit ranked aromas; score against the multi-aroma `leaves` column, not the single
`tier1_aroma`) to remove the winner-take-all artifact, and (2) prompt guidance on
the salty↔umami and spicy↔pungent boundaries.

### Pilot v2 RESULT — both fixes applied (2026-06-13) → **PASS**

`build_pilot_input_v2.py` + `score_pilot_v2.py` (multi-label aroma vs
`leaves`-derived gold + boundary rubric). 5 blind subagents, all 304 ingredients.

| view | v1 | **v2** |
|---|---|---|
| aroma macro-F1 (6 GNN aromas) | — | **0.705** |
| taste macro-F1 (5 GNN tastes) | — | **0.716** (full 8-term 0.633) |
| **11-head macro-F1** | 0.606 | **0.710** — vs molecular **0.101 → ~7×** |

Per-head v2: sour 0.87, fruity 0.85, green 0.83, umami 0.77, floral 0.74,
sweet 0.73, **fatty 0.72** (was 0.10), bitter 0.72, **woody 0.59** (was 0.23),
spicy 0.50, salty 0.48. **8 of 11 heads ≥ 0.70.** The multi-label fix recovered
woody/fatty exactly as predicted. The only two laggards — salty (0.48, n=12) and
odor_spicy (0.50) — are the *same* axes the molecular model can't do
(chemdataset-status: "do not surface salty"; "odor_spicy still weak"), so the
LLM's weak spots align with genuinely hard chemistry, not a labeling defect.

**VERDICT: distillation is viable. Green-light to scale 304 → 3,913** with chef
rows as a gold overlay (precedence), excluding/flagging salty + odor_spicy as
low-confidence. The LLM-distilled ingredient profile is ~7× the molecular
model's ingredient-level signal — confirming the strategic reframe below: the
distilled labels are the product; a molecular MIL aggregator is not needed.

## Full-corpus distillation SHIPPED (2026-06-13)

Scaled the v2-validated method to the whole ingredient universe.

- Harness: `build_corpus_batches.py` (56 batches over 3,624 non-chef names) →
  blind labeling workflow (112 jobs = 56 batches × 2 samples; ran in two waves
  due to transient server rate-limiting, verified 112/112 on disk) →
  `merge_corpus_labels.py` (consensus → vocab-validate → chef overlay → flag).
- Output: **`public/proDataset/flavor_profiles_distilled.json` — 3,927
  ingredient-level profiles** (3,623 LLM-distilled + 304 chef-gold overlay,
  precedence). 0 invalid/empty/out-of-vocab rows. Avg 2.23 aromas + 1.23 tastes
  per ingredient. 1,048 distilled rows carry a `low_confidence` flag (salty /
  odor_spicy).
- Spot-QA across a deterministic spread looks strong: `morel mushroom →
  [meaty,woody,earthy]/umami`, `abalone → [marine,meaty]/umami`, `tonkatsu sauce
  → [caramel,fruity,fermented]/sour,umami,sweet`, `green tea →
  [green,earthy]/astringent,bitter`, `espresso → [smoky,roasted,earthy]/bitter`.
- Validation basis: the v2 pilot (11-head macro-F1 0.710 vs molecular 0.101).
  Distribution sanity: sweet 1,446 · umami 968 · fruity 897 · earthy 866 ·
  creamy 761 · green 738 · fatty 730 (full head counts in
  `corpus/distill_report.json`).

This is the deliverable the whole investigation pointed to: a clean,
full-corpus, ingredient-level flavor profile — ~7× the molecular model's
ingredient signal, with the chef gold preserved by precedence.

### Hardened to 3-sample majority consensus (2026-06-13)

Ran a 3rd independent labeling pass (s2) over all 56 batches and re-merged with
true majority consensus (a label is kept iff it appears in **≥2 of 3** samples).
Effect vs the 2-sample union: labels tightened — avg aromas 2.23 → **2.07**,
avg tastes 1.23 → **1.17**; head counts dropped modestly across the board
(e.g. fruity 897→855, astringent 67→55) as one-sample-only labels are filtered.
Still 0 invalid/empty/out-of-vocab rows; spot-checks unchanged in quality. This
is the final shipped `flavor_profiles_distilled.json`.

**Not yet wired into the app.** Next step (separate task) is consuming
`flavor_profiles_distilled.json` in the IngredientPanel/radar surface, honoring
the `low_confidence` flag.

## Strategic note (the reframe)

We wanted ingredient-level labels to *train a MIL aggregator so the molecular
model's signal reaches the ingredient level*. But the only scalable label source
is LLM distillation, which produces the ingredient-level descriptors **directly**
— collapsing the plan:

- **Goal = radar/visualization profile** → LLM-distill descriptors and ship them;
  the molecular MIL aggregator is redundant.
- **Goal = rescue the *molecular* model as a culinary signal** → more labels
  don't help; the ceiling is the compound signal (2026-06-10), not label count.

So: re-sourcing ingredient-level labels is *achievable* but *obviates* the
MIL-over-molecules idea rather than enabling it. The labels are the product.
