# Ingredient Data Quality — Requirements

## Overview
The Flavor Network's ingredient and pairing datasets have quality issues discovered during a deep audit (2026-03-24). This PRD defines acceptance criteria for a clean, production-ready dataset.

## Current State (Pre-Cleanup)
- 4,488 ingredients, 50,512 pairings
- 200 anomalous brown sugar pairings (known===false, inflated strengths)
- 34 garbage names from tokenization errors
- 39 ingredients missing taste (including top-10 most-used)
- 387 orphaned ingredients (zero pairings)
- 129 near-duplicate groups
- 7+ non-food entries
- Compressed strength range (90% in 0.56–0.74)
- Sauce augment: 74 duplicate pairings, cocktail augment: 18 duplicates

## Target State
- Clean ingredient names (no parsing artifacts)
- 100% taste coverage on all food ingredients
- Zero orphaned ingredients
- Zero duplicate pairings
- No non-food entries
- Strength distribution spread across 0–1 range
- Canonical taste ordering (alphabetical)
- "other" category <100 entries

## Acceptance Criteria

### Data Integrity
1. Every ingredient in ingredients.json has: name, category, taste, totalCount, sources
2. Every pairing in pairings.json references two valid ingredients
3. Zero self-pairings
4. Zero duplicate pairings (including A→B / B→A)
5. Zero orphaned ingredients (every ingredient has ≥1 pairing)
6. All augment pairings reference ingredients that exist in either the augment or main dataset

### Data Quality
7. No parsing artifacts in names (no leading -, ., 's; no trailing +)
8. No non-food entries (no cookware, aluminum foil, etc.)
9. All food ingredients have a taste value
10. Taste values use canonical alphabetical ordering
11. Near-duplicates merged (one canonical name per concept)
12. "other" category contains only genuinely uncategorizable items (<100)

### Visual Impact
13. Pairing strength distribution uses full 0–1 range for visual differentiation
14. App builds successfully after all changes (`npm run build`)
15. No console errors when loading the app

## Sources Audited
- `public/proDataset/ingredients.json`
- `public/proDataset/pairings.json`
- `public/data/cocktail_augment.json`
- `public/data/sauce_augment.json`
