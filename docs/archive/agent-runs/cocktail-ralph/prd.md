# Cocktail Lab — Improvement Requirements

## Overview
The Cocktail Lab is 85% feature-complete. This mini-ralph loop addresses data quality gaps, performance issues, missing features, and UX polish. The cocktail-agent (expert mixologist + chemical engineer) drives the work, coordinating with data-engineer, scene-architect, and ui-builder agents.

## Current State
- 107 augment ingredients, 528 pairings (post-dedup from ingredient-ralph)
- 6 Codex templates detected (Old Fashioned, Martini, Sour, Highball, Flip, Julep)
- TheCocktailDB integration (426 drinks, search/lookup/random)
- 3D Codex positioning (Spirit-forward/Modified × Short/Long × Simple/Complex)
- Builder with compatibility scoring, template detection, suggestions
- Swap mode with ranked alternatives
- Export as PNG card
- Save/load to user profile

## Identified Issues

### Data Quality
- Missing spirits: Pisco, Cachaca, Rhum Agricole, Sotol, Baijiu, Shochu, Aquavit, Genever
- Missing modern ingredients: orgeat (exists), falernum, creme de violette, allspice dram, velvet falernum
- One-directional pairings possible (augment doesn't guarantee symmetry)
- Category mapping uses simple string match — exotic ingredients may misclassify
- No chemical compound data backing pairing strengths (purely co-occurrence based)

### Performance
- Alternative scoring in CocktailPanel is O(n²) — needs adjacency list
- No memoization of adjacency structure across renders

### Feature Gaps
- Quantity fields don't persist to saved cocktails (always empty)
- Missing `instructions` and `createdAt` fields in saved cocktail schema
- Canvas export uses `ctx.roundRect()` — fails silently on older browsers
- No undo/redo for ingredient swaps
- Mobile responsiveness untested

### Architecture
- CocktailLab manages 28 pieces of state — candidates for useReducer
- Magic strings for category names scattered (not centralized)
- INGREDIENT_MODIFIERS regex hardcoded in CocktailPanel

## Target State

### Data
- 150+ augment ingredients covering all major spirit categories worldwide
- Symmetric pairings (if A→B exists, B→A exists at same strength)
- Chemical compound bridging data for top 50 ingredients (shared volatiles justify pairings)
- All new pairings have mixology justification

### Performance
- Alternative scoring uses pre-built adjacency map (O(1) edge lookup)
- Adjacency map built once on graph construction, reused across renders

### Features
- Quantity fields persist to saved cocktails
- `instructions` and `createdAt` included in save schema
- Canvas export works on all modern browsers (polyfill roundRect)
- Technique tags on recipes (stirred/shaken/built/blended)

### Quality
- All cocktail scoring functions covered by unit tests
- Augment data validated by automated script (no dupes, no self-pairings, symmetric)

## Acceptance Criteria
1. Augment has 150+ ingredients covering all major spirit families
2. Zero asymmetric pairings in augment
3. Alternative scoring is O(1) per edge lookup (adjacency map)
4. Saved cocktails include quantities, instructions, createdAt
5. Canvas export works without roundRect dependency
6. All new data has mixology/chemistry justification documented
7. `npm run build` passes after all changes
8. Existing unit tests still pass
