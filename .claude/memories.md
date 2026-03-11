## Patterns

## Decisions

### mem-1710153000-a1b1
> Tech stack: React 18 + Vite + Three.js + TensorFlow.js + Tailwind + Express + Fuse.js. Chosen for 3D neural-network aesthetic with real ML embeddings.
<!-- tags: architecture, stack | created: 2026-03-11 -->

### mem-1710153000-a1b2
> Data source is Flavor Bible dataset from food-tools/flavor-map repo. Key files: ingredients.csv (ingredient-pairing pairs), cuisines.csv (cuisine-ingredient pairs), ingredient_metadata.csv (taste/weight/volume/season), affinities.csv (flavor combos). Large JSON files (graph.json, pairings.json) are 1M+ tokens — never read directly.
<!-- tags: data, architecture | created: 2026-03-11 -->

## Fixes

## Context

### mem-1710153000-c1c1
> Original flavor-map used D3 force layout with cuisine-based gravity centers. Our approach replaces force layout with ML embeddings projected to 3D via UMAP, giving semantically meaningful positions.
<!-- tags: ml, viz | created: 2026-03-11 -->
