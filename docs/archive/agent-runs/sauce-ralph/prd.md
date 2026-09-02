# Sauce Lab — Improvement Requirements

## Overview
The Sauce Lab is 85% feature-complete with 69 curated recipes across 11 mother sauce families. This mini-ralph addresses data quality, feature parity with Cocktail Lab, user persistence, and performance. The sauce-agent (expert chef + chemical engineer) drives the work.

## Current State
- 167 augment ingredients, 672 pairings, 69 curated sauce recipes
- 11 mother sauce families (5 French + 6 global)
- 3D positioning (Light/Rich × Mild/Bold × Simple/Complex) with 160+ overrides
- Builder with compatibility scoring, template detection, suggestions
- TheMealDB lookup integration
- No ingredient substitution UI (Cocktail Lab has this)
- No adjacency map optimization
- User recipe save is stubbed but not wired to persistence

## Identified Issues

### Data Quality
- Category typo: caraway has "spice" (should be "Seasoning" to match others)
- 46 of 167 ingredients never appear in any curated recipe (orphaned)
- Pairing symmetry not enforced (same issue cocktail-ralph fixed)
- No validation script for augment integrity

### Feature Gaps (vs Cocktail Lab parity)
- No ingredient substitution/swap UI
- No adjacency map (O(1) lookups) — cocktail-ralph added this
- No "My Sauces" tab for saved recipes
- Save function stubbed but not wired to userProfile
- No technique tags on templates (cocktail-ralph added this)
- No export-as-image for sauce recipes

### Architecture
- Magic strings for category names not centralized
- TheMealDB lookup returns non-sauce recipes (no filtering)
- No unit tests for sauce scoring functions

## Target State
- Zero data quality issues (symmetry, no orphans in recipes, correct categories)
- Feature parity with Cocktail Lab (swaps, adjacency map, persistence, technique tags)
- "My Sauces" tab with full CRUD
- Automated augment validation script
- Technique tags on sauce templates (emulsification, reduction, roux, etc.)

## Acceptance Criteria
1. Pairing symmetry enforced (zero asymmetric pairs)
2. Category typo fixed
3. Adjacency map for O(1) edge lookups
4. Ingredient substitution UI in SaucePanel
5. User sauce persistence wired to userProfile
6. "My Sauces" tab in SaucePanel
7. Technique tags on all SAUCE_TEMPLATES
8. Augment validation script passing with zero issues
9. `npm run build` passes after all changes
