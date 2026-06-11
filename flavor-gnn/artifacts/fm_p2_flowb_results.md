# FM-P2 Flow-B (generate-from-profile-alone) — contrastive decoding tested (NEGATIVE, 2026-06-11)

**Verdict: contrastive decoding does NOT fix Flow-B. Do not ship a
profile-only recipe generator. Keep generation seeded by ingredients
(Flow A, already shipped).**

## What Flow-B is
Generate a recipe from a *target flavor profile alone* (11-D taste+aroma),
with no seed ingredients. The FM-P2 demo found it collapses to staples
(salt/egg/sugar/butter/flour) regardless of the requested profile — the
model's unconditional prior dominates when nothing is observed.

## Lever tested (feasibility doc §10 lever #1: "popularity discounting")
Contrastive decoding, no retrain, two model passes (in-browser-portable):
`score(i | P) = logit(i | P) − α·logit(i | baseline)`, baseline = empty
observed + zero profile. Staples have high baseline logit → demoted.
Script: `flavor-gnn/scripts/fm_p2_flowb_contrastive.mjs`;
artifact: `flavor-gnn/artifacts/fm_p2_flowb_eval.json`. 5 synthetic distinct
target profiles (dessert_sweet, savory_umami, sour_bright, bitter_herbal,
spicy_warm), top-15, α ∈ {0, 0.5, 1.0, 1.5}.

## Two metrics — and why the obvious one lies
- **Mean pairwise top-K Jaccard overlap** (lower = profiles produce *different*
  recipes): 0.307 → 0.111 → 0.010 → 0.052 as α rises. Looks like a huge win.
- **Profile fidelity** (cosine of the generated set's aggregate `gnn_entropy`
  profile to the requested target; higher = actually on-target): **0.594 →
  0.575 → 0.490 → 0.426.** Monotonically WORSE with α.

Overlap is **gamed by rare-junk**: high α promotes low-baseline-logit (rare)
ingredients that merely *differ* from staples — they don't match the target
flavor. α=1.0 has the lowest overlap (0.010) and produces incoherent sets:
`dessert_sweet → pork shoulder, white distilled vinegar, brussels sprout`.
Fidelity is the honest quality metric and it says contrastive strictly hurts.

## Why it can't work without a retrain
Root cause is the one the demo already diagnosed: the averaged 11-D
`gnn_entropy` profile is **not a discriminative conditioning signal** (it
collapses toward a similar vector across recipes), and the model's
profile-conditioning is weak relative to its unconditional prior. Contrastive
can *demote* the staple prior but cannot *synthesize* a coherent on-target set,
because the directional signal to do so isn't in the conditioning. This is the
same theme as the rest of the campaign: the abstract molecular/profile
representation is a weak instrument; **discrete seed ingredients are the strong
one** (Flow A works precisely because ingredients are discriminative).

## Decision
- **Do NOT ship Flow-B (profile-only generation).** Contrastive (the only
  no-retrain lever) fails the fidelity gate; shipping it would surface
  incoherent recipes.
- **Generation stays seeded by ingredients + cuisine (Flow A)** — trained,
  ONNX-served, beats baseline, already wired (the "✨ Smart completions"
  surface).
- Remaining un-tested levers both require a **retrain** and are NOT justified
  by the measured value: (2) dish-type/cluster conditioning (the model wasn't
  trained with it); (3) stronger profile FiLM weighting. Documented for a
  future revisit, not queued.
- Infra retained for traceability: the contrastive script + eval JSON stay in
  the repo (like the DREAM/focal dead-end scaffolding) so a future profile
  representation can be re-measured against this baseline cheaply.

**Bottom line:** measured like the other honest dead-ends (DREAM, focal loss,
embedding pairing model). The lever the doc hoped for doesn't survive the
fidelity metric. The product answer was already shipped: seed-driven Flow A.
