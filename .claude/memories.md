## Patterns

## Decisions

### mem-1710153000-a1b1
> Tech stack: React 18 + Vite + Three.js + TensorFlow.js + Tailwind + Express + Fuse.js. Chosen for 3D neural-network aesthetic with real ML embeddings.
<!-- tags: architecture, stack | created: 2026-03-11 -->

### mem-1710153000-a1b2
> Data source is Flavor Bible dataset from food-tools/flavor-map repo. Key files: ingredients.csv (ingredient-pairing pairs), cuisines.csv (cuisine-ingredient pairs), ingredient_metadata.csv (taste/weight/volume/season), affinities.csv (flavor combos). Large JSON files (graph.json, pairings.json) are 1M+ tokens — never read directly.
<!-- tags: data, architecture | created: 2026-03-11 -->

## Fixes

### mem-1711100000-f1
> Edge and particle brightness controlled via uBrightness uniform on their ShaderMaterials in LivingArchView. edgeMat and particleMat stored in stateRef. Sliders in Controls.jsx (0–200%, default 100%). Particle visibility was broken (particleMesh not in stateRef) — fixed 2026-03-22.
<!-- tags: three, shaders, controls | created: 2026-03-22 -->

### mem-1711100000-f2
> Ingredient data audit and cleanup completed 2026-03-24 via ingredient-ralph mini-loop (12 tasks). Before: 4,488 ingredients, 50,512 pairings. After: 3,913 ingredients, 48,588 pairings. Removed: 200 brown sugar anomalies, 49 garbage names, 387 orphans, 111 merged duplicates, 28 recipe/brand names. Filled 27 tastes, normalized taste ordering (23→18 unique values), rescaled strengths to full 0–1 range, deduped augments. Scripts in ingredient-ralph/scripts/.
<!-- tags: data, audit, cleanup | created: 2026-03-24 -->

## Context

### mem-1710153000-c1c1
> Original flavor-map used D3 force layout with cuisine-based gravity centers. Our approach replaces force layout with ML embeddings projected to 3D via UMAP, giving semantically meaningful positions.
<!-- tags: ml, viz | created: 2026-03-11 -->
