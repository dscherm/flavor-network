## Patterns

### mem-20260324-p01
> Data cleanup scripts go in ingredient-ralph/scripts/ as .cjs files (require, not import). Each script reads the target JSON, transforms, writes back with 2-space indent. Backups in ingredient-ralph/backups/ before each destructive op.
<!-- tags: scripts, workflow | created: 2026-03-24 -->

## Decisions

### mem-20260324-d01
> Strength rescaling uses percentile-rank + sqrt curve. This maps the old compressed 0.56–0.74 band to 0–1. sqrt pushes values toward upper range which suits additive blending in Three.js.
<!-- tags: data, visualization | created: 2026-03-24 -->

### mem-20260324-d02
> Near-duplicate merging picks the variant with higher totalCount as canonical. Pairings are renamed and deduped (keep highest strength). Self-pairings checked and removed during merge.
<!-- tags: data, dedup | created: 2026-03-24 -->

### mem-20260324-d03
> "other" category reduced from 554→163 via two-pass keyword reclassification. Remaining 163 are genuinely ambiguous (e.g., "leaf", "peel", "spice mix"). Would need manual curation to go below 100.
<!-- tags: data, categories | created: 2026-03-24 -->

## Fixes

### mem-20260324-f01
> Brown sugar pipeline bug: 200 pairings had known===false, null breakdowns, inflated strengths 0.95–1.0. Root cause: late-stage augmentation pass creating synthetic entries without strength capping. Fixed by filtering known===false.
<!-- tags: data, pairings, pipeline | created: 2026-03-24 -->

### mem-20260324-f02
> Garbage names (34 entries) came from NLP tokenization artifacts in RecipeNLG parsing: hyphenated words split wrong (leading -), possessives split ('s prefix), recipe math notation (trailing +).
<!-- tags: data, ingredients, parsing | created: 2026-03-24 -->

## Context

### mem-20260324-c01
> Full audit completed 2026-03-24. All 12 tasks complete. Final state: 3,913 ingredients, 48,588 pairings, 4 tasteless (mixers), 163 "other" category. Cocktail augment: 107 ingredients, 528 pairings. Sauce augment: 167 ingredients, 672 pairings.
<!-- tags: audit, data-quality, summary | created: 2026-03-24 -->

### mem-20260324-c02
> 4 ingredients still have no taste: soda water, champagne, prosecco, vegetable stock. All are mixers/liquids where taste is not meaningful for node coloring. Acceptable gap.
<!-- tags: data, taste | created: 2026-03-24 -->
