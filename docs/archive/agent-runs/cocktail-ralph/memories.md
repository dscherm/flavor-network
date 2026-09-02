## Patterns

## Decisions

## Fixes

## Context

### mem-20260324-c01
> Cocktail Lab audit (2026-03-24): 85% feature-complete across 12 files, 6,222 LOC. Core features working: 3D Codex positioning, builder with scoring, TheCocktailDB integration, swap mode, export. Key gaps: O(n²) alternative scoring, quantity persistence, 40+ missing world spirits, pairing asymmetry, roundRect browser compat. Augment: 107 ingredients, 528 pairings post ingredient-ralph dedup.
<!-- tags: audit, cocktail, status | created: 2026-03-24 -->

### mem-20260324-c02
> Data flow: cocktail_augment.json → buildCocktailGraph() merges with ProData fullGraph → computeCocktailPositions() → NetworkScene renders. Augment ingredients enriched with cocktailCategory and codexRole. Edges merged via max-strength when duplicated between ProData and augment. Edge key uses alphabetical sort for dedup.
<!-- tags: architecture, data-flow | created: 2026-03-24 -->

### mem-20260324-c03
> Coordination map: data-engineer owns cocktailGraph.js merge logic and API. scene-architect owns NetworkScene rendering and axis labels. ui-builder owns React component patterns and Tailwind. ingredient-ralph owns naming conventions and strength scale consistency. cocktail-agent owns augment data, scoring, and mixology knowledge.
<!-- tags: coordination, agents | created: 2026-03-24 -->
