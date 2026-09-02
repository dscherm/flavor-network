## Patterns

### mem-20260324-p01
> Follow cocktail-ralph patterns for shared features: adjacency map (cocktailGraph.js buildAdjacencyMap), pairing symmetry enforcement (task3_symmetry.cjs), technique tags on templates, quantity persistence. Don't reinvent — reuse the established approach.
<!-- tags: patterns, cocktail-parity | created: 2026-03-24 -->

## Decisions

## Fixes

## Context

### mem-20260324-c01
> Sauce Lab audit (2026-03-24): 85% feature-complete across 8 files, ~2,100 LOC. 69 curated recipes, 11 mother sauce families, 167 ingredients, 672 pairings. Key gaps: no adjacency map, no swap UI, no user persistence, no technique tags, pairing asymmetry, 1 category typo (caraway), 46 orphaned ingredients. TheMealDB lookup returns non-sauce recipes.
<!-- tags: audit, sauce, status | created: 2026-03-24 -->

### mem-20260324-c02
> Data flow: sauce_augment.json → buildSauceGraph() merges with ProData → computeSaucePositions() → NetworkScene renders. Positioning uses 3 axes: Light/Rich × Mild/Bold × Simple/Complex with 160+ ingredient-specific overrides. 10 ingredient role categories.
<!-- tags: architecture, data-flow | created: 2026-03-24 -->
