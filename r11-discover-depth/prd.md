# R11 — Discover Depth

## Goal
Deepen the *taste / flavor / odor* understanding surface of Flavor Network by:
1. Fixing diagnostic bugs that hide cluster structure from users (Q2).
2. Reducing post-start-page friction with a user-typed "pairing of the day" CTA (Q1).
3. Surfacing per-pairing odor information using human-auditable chemistry, not the GNN head that collapses (Q3).

## Interview findings (2026-04-22)

- **Cluster labels huddled at center** (3D Network mode).
  Root cause: `LivingArchView.jsx:316-321` places labels at `cluster.centroid_3d * 1.4`. Node2Vec embeddings sit on an approximate hypersphere — centroids average toward origin. Measured: centroid distances 0.75–9.22 units; node distances p50=17.14, p90=48.15. Labels sit inside the empty core. Secondary bug: two clusters share the label "Chili".
- **GNN multi-task odor head is too weak for per-pairing badges.**
  R10-63 CV F1: bitter 0.78, fruity 0.57, green 0.49, woody 0.43, fatty 0.38, floral 0.33, sour 0.29, umami 0.25, spicy 0.24, salty 0.18. Cosine sim between predicted odor vectors is p50=1.000 — collapse. Decision: ship odor badges via `bridge_compounds.json` (FlavorDB molecule-level tags) instead; defer GNN retrain to R12.
- **After-mode friction.** StartPage cards work; the *second* screen dumps users into open surface. Fix: Discover gets a user-typed pairing-of-the-day CTA; Learn re-uses the existing `MoleculeOfTheDay.jsx` component as entry.
- **Doc drift.** Top-level CLAUDE.md `@`-includes 4 missing files. Create 1 (`.chemdataset-status.md`), delete 3.

## Out of scope (R11)
- GNN retrain with class-balanced loss → R12 follow-up task filed in plan.md.
- 5th "Odor" mode on the bottom selector → rejected (consistent with consolidation philosophy).
- UMAP swap for 2D Network projection → rejected for now; cluster-label fix addresses the user-visible symptom at 1% of the cost.

## Acceptance criteria
- Cluster labels in 3D Network mode sit at or beyond their cluster's median node radius, not near origin.
- Duplicate "Chili" labels disambiguated or merged.
- DiscoverCTA: user picks pairing type (taste / cuisine / surprise / bridge), gets one edge + panel preselected.
- MoleculeOfTheDay mounts as Learn mode entry.
- IngredientPanel neighbor rows + CocktailRecipeCard pairing rows + SaucePanel rows show an odor badge when the pair exists in `bridge_compounds.json` with a shared-tag majority.
- Top-level CLAUDE.md has 0 broken @-includes.
- `observations.jsonl` latest commit gate = `pass`, not `stale`.
