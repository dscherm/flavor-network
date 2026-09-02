# Flavor Network Pairing Formula: Analysis & Redesign

**Author:** Computational Gastronomy Research
**Date:** 2026-03-19
**Status:** Design Document (Research Only)

---

## Table of Contents

1. [Phase 1: Current Formula Analysis](#phase-1-current-formula-analysis)
2. [Phase 2: Identified Weaknesses](#phase-2-identified-weaknesses)
3. [Phase 3: Chemical Compound Data Sources](#phase-3-chemical-compound-data-sources)
4. [Phase 4: Intelligent Pairing Formula Design](#phase-4-intelligent-pairing-formula-design)
5. [Phase 5: Implementation Roadmap](#phase-5-implementation-roadmap)

---

## Phase 1: Current Formula Analysis

### Pipeline Overview

The pipeline consists of 5 scripts orchestrated by `run-all.js`:

| Step | Script | Input | Output |
|------|--------|-------|--------|
| 1 | `01-parse-recipenlg.js` | 2.2M recipes (CSV) | `recipenlg-cooccurrence.json` |
| 2 | `02-fetch-flavordb.js` | FlavorDB API | `flavordb-overlap.json` (empty) |
| 3 | `03-fetch-mealdb.js` | TheMealDB API | `mealdb-cooccurrence.json` |
| 4 | `04-fetch-cocktaildb.js` | TheCocktailDB API | `cocktaildb-cooccurrence.json` |
| 5 | `05-blend.js` | All processed files | `ingredients.json`, `pairings.json`, `metadata.json` |

### Step 1: RecipeNLG NPMI Computation

**Input filtering:**
- Skip set: `{salt, pepper, water, oil, black pepper}` -- hardcoded exclusions
- Ingredient minimum: must appear in >= 50 recipes (`MIN_INGREDIENT_RECIPES`)
- Pair minimum: pair must co-occur in >= 3 recipes (`MIN_RECIPE_COUNT`)
- Food validation: `looksLikeFood()` checks against 57 food indicator substrings and a known-food set built from `synonyms.json` + `categories.json`

**Canonicalization (`canonicalizeIngredient`):**
- Strip parentheticals, quantities (Unicode fractions), unit words, adjective words
- Synonym lookup from `synonyms.json` (357 entries mapping variants to canonical names)
- Naive singularization: strip trailing 's' if length > 3 and not 'ss'

**PMI formula (clamped, non-normalized):**
```
PMI(A,B) = max(0, log2(P(A,B) / (P(A) * P(B))))

where:
  P(A,B) = pairCount / totalRecipes
  P(A)   = countA / totalRecipes
  P(B)   = countB / totalRecipes
```

Negative PMI values (ingredients that co-occur less than chance) are clamped to 0, destroying the negative signal entirely.

**NPMI formula (normalized to [0,1]):**
```
NPMI(A,B) = PMI(A,B) / (-log2(P(A,B)))

Result clamped to [0, 1].
If PMI <= 0, NPMI = 0.
```

**Hybrid score formula:**
```
hybrid(A,B) = NPMI * (1 - logCountWeight) + logCount * logCountWeight

where:
  logCountWeight = 0.35 (hardcoded default)
  logCount = log2(pairCount + 1) / log2(totalRecipes)
```

The logCount component is `log2(pairCount + 1) / log2(totalRecipes)`. For totalRecipes = 2,231,142, this denominator is ~21.09. A pair appearing 1000 times gets logCount = log2(1001)/21.09 = 9.97/21.09 = 0.473.

**Final normalization:** All hybrid scores are min-max normalized to [0, 1] across all pairs, stored as `strength`.

### Step 2: FlavorDB Chemical Overlap (BROKEN)

**Status:** API at `https://cosylab.iiitd.edu.in/flavordb` is unreachable. Outputs empty `{ pairs: {}, ingredients: {} }`.

**Intended formula:** Szymkiewicz-Simpson overlap coefficient (NOT Jaccard):
```
overlap(A,B) = |molecules_A intersection molecules_B| / min(|molecules_A|, |molecules_B|)
```

This is important -- they chose Simpson overlap, not Jaccard. Simpson is biased toward the smaller set: if ingredient A has 5 compounds and shares 4 with ingredient B (which has 200 compounds), Simpson = 4/5 = 0.8, while Jaccard = 4/201 = 0.02. This means ingredients with few but shared compounds score disproportionately high.

Molecule IDs are PubChem compound IDs. The script merges multiple FlavorDB entities that canonicalize to the same ingredient name.

### Step 3: TheMealDB Co-occurrence

Identical methodology to RecipeNLG:
- Fetches meals A-Z via `search.php?f={letter}`
- Same SKIP_SET, same canonicalization
- Same hybrid score formula (NPMI 65% + logCount 35%)
- No `MIN_INGREDIENT_RECIPES` filter (too few recipes to warrant it)
- `MIN_RECIPE_COUNT = 3` still applies
- Results: 593 meals, 721 ingredients, 2,022 pairs

### Step 4: TheCocktailDB Co-occurrence

Identical methodology to MealDB/RecipeNLG:
- Fetches drinks A-Z
- Same hybrid formula
- Results: 426 drinks, 266 ingredients, 204 pairs

### Step 5: Blending

**Weights (config.js):**
```
recipenlg:  0.60   (was 0.40 but FlavorDB weight redistributed)
flavordb:   0.05   (originally 0.30, but contributes 0)
mealdb:     0.20   (originally 0.15)
cocktaildb: 0.15   (originally 0.15)
```

**Actual effective weights** (since FlavorDB contributes 0 for all pairs):
```
recipenlg:  0.60 / 0.95 = 63.2% effective
mealdb:     0.20 / 0.95 = 21.1% effective
cocktaildb: 0.15 / 0.95 = 15.8% effective
(5% weight is simply lost -- not redistributed dynamically)
```

**Blending formula:**
```
blended(A,B) = 0.60 * recipenlg_strength(A,B)
             + 0.05 * flavordb_overlap(A,B)      // always 0
             + 0.20 * mealdb_strength(A,B)
             + 0.15 * cocktaildb_strength(A,B)
```

**Post-blend filtering:**
- Drop pairs with blended strength < 0.02 (`MIN_BLENDED_STRENGTH`)
- Smart cap: max 40,000 pairs (`MAX_PAIRS`)
  - Phase 1: Guarantee every ingredient retains its top 15 pairings (`MIN_PAIRS_PER_INGREDIENT`)
  - Phase 2: Fill remaining slots from global top-strength pairs

**Category inference (`inferCategory`):**
- First: exact lookup in `categories.json` (163 explicit entries)
- Second: 22 regex-based keyword rules with priority ordering
- Third: 15 extended heuristic regex fallbacks
- Default: `{ category: 'other', taste: 'pungent' }`

Categories assign both a `category` label and a `taste` profile string (e.g., `"sweet sour"`, `"pungent bitter"`).

### Graph Building (app-side, `graph.js` and `useProData.js`)

The app-side `useProData.js` performs an ADDITIONAL normalization: edge strengths are divided by `maxStrength` again, re-normalizing to [0,1]. This means the blended scores undergo double normalization -- once in the pipeline (min-max per source), once in the client (divide-by-max).

The legacy `graph.js` uses a different approach entirely: it counts bidirectional appearances (strength += 1 per direction) and normalizes by max count. This code path is NOT used by ProData but exists in the codebase.

### Summary of All Magic Numbers

| Constant | Value | Location |
|----------|-------|----------|
| `SKIP_SET` | {salt, pepper, water, oil, black pepper} | 01, 03, 04 |
| `MIN_RECIPE_COUNT` | 3 | config.js |
| `MIN_INGREDIENT_RECIPES` | 50 | config.js (RecipeNLG only) |
| `MIN_BLENDED_STRENGTH` | 0.02 | config.js |
| `logCountWeight` | 0.35 | utils.js |
| `WEIGHTS.recipenlg` | 0.60 | config.js |
| `WEIGHTS.flavordb` | 0.05 | config.js |
| `WEIGHTS.mealdb` | 0.20 | config.js |
| `WEIGHTS.cocktaildb` | 0.15 | config.js |
| `MAX_PAIRS` | 40,000 | 05-blend.js |
| `MIN_PAIRS_PER_INGREDIENT` | 15 | 05-blend.js |
| PMI negative clamp | 0 | utils.js |
| NPMI clamp range | [0, 1] | utils.js |
| `RATE_LIMITS.flavordb` | 1200ms | config.js |
| `RATE_LIMITS.mealdb` | 600ms | config.js |
| `RATE_LIMITS.cocktaildb` | 600ms | config.js |
| Food name length filter | 2-50 chars | 01 |

---

## Phase 2: Identified Weaknesses

### Weakness 1: Co-occurrence Does Not Equal Flavor Compatibility

**The fundamental problem:** Two ingredients co-occurring in recipes tells us they are *used together*, not that they *taste good together*. Confounding variables include:

- **Cultural co-occurrence:** Rice + soy sauce have high NPMI because they appear together in thousands of Asian recipes. But this reflects culinary tradition, not a chemical flavor affinity. Rice is essentially flavor-neutral (starch) -- it does not "pair" with soy sauce in the sense that their flavors synergize. It is a vehicle.

- **Structural co-occurrence:** Flour + sugar + egg + butter co-occur in virtually all baking recipes. Their high NPMI reflects that they are structural components of dough/batter, not that flour and egg have an interesting flavor interaction.

- **Convenience co-occurrence:** Garlic + olive oil have extremely high co-occurrence simply because one is typically cooked in the other. The pairing says "cooking medium" not "flavor synergy."

**Concrete example:** Consider the pair (rice, soy sauce):
- P(rice) in RecipeNLG is likely ~5-8% of recipes
- P(soy sauce) is likely ~3-5%
- P(rice, soy sauce) is likely ~2-3%
- NPMI would be high (~0.4-0.6) because they co-occur far more than chance
- But rice contributes essentially zero volatile flavor compounds. The "pairing" is functional, not gustatory.

Meanwhile, (strawberry, balsamic vinegar) -- a genuinely interesting flavor pairing validated by shared methyl-based esters and complementary sweet/acid profiles -- may have very low NPMI because it appears in relatively few recipes despite being chemically and gastronomically brilliant.

### Weakness 2: Missing "Why" -- Collapsed Dimensionality

The formula produces a single scalar `strength` in [0, 1]. This collapses at least 10 distinct dimensions of *why* two ingredients pair well:

1. **Chemical compound sharing** -- They share volatile aroma compounds (e.g., strawberry + basil both contain linalool)
2. **Taste complementarity** -- Their basic tastes balance (sweet + acid, umami + bitter)
3. **Taste harmony** -- They share the same taste profile, reinforcing it (honey + maple syrup)
4. **Texture contrast** -- Crispy + creamy, smooth + crunchy (not capturable from ingredient lists)
5. **Fat solubility bridge** -- A fat carries flavor compounds from one ingredient to another (butter bridges sage's terpenes)
6. **Cultural tradition** -- They are used together in an established cuisine (dashi + miso in Japanese cooking)
7. **Maillard reaction partnership** -- Amino acids from one + reducing sugars from another create new flavors when heated
8. **Aromatic layering** -- They contribute to different parts of the aroma timeline (top/middle/base notes, like perfumery)
9. **Enzyme-mediated interaction** -- One ingredient's enzymes transform the other's compounds (e.g., garlic's alliinase reacting with heat)
10. **Seasonal/contextual appropriateness** -- Warming spices in winter, bright citrus in summer

The current formula cannot distinguish between "these taste amazing together because of shared terpenoids" and "these appear together because every Mexican recipe has cumin and chili." A user who wants to discover novel pairings gets the same signal as one who wants to validate traditional ones.

### Weakness 3: Frequency Bias from 35% Log-Count Weight

The hybrid formula is:
```
hybrid = 0.65 * NPMI + 0.35 * log2(pairCount + 1) / log2(totalRecipes)
```

This 35% log-count weight systematically advantages common pairings:

**Example calculation for RecipeNLG (totalRecipes = 2,231,142):**

| Pair | Co-occurrences | NPMI (est.) | logCount | Hybrid | Character |
|------|---------------|-------------|----------|--------|-----------|
| chicken + garlic | ~150,000 | 0.35 | 0.81 | 0.51 | Boring, obvious |
| tomato + basil | ~80,000 | 0.45 | 0.76 | 0.56 | Well-known |
| lemongrass + galangal | ~2,000 | 0.72 | 0.52 | 0.65 | Interesting |
| tamarind + jaggery | ~200 | 0.85 | 0.37 | 0.68 | Novel, validated |
| saffron + cardamom | ~500 | 0.78 | 0.43 | 0.66 | Exotic, excellent |

Without the 35% log-count weight, the ranking would correctly favor the more interesting and statistically surprising pairings. With it, ultra-common pairs like chicken+garlic get an artificial boost. The justification in the code comment -- "so that common, genuinely paired ingredients aren't penalized" -- conflates "common" with "genuine."

**The deeper problem:** After min-max normalization, the log-count component stretches the top end. Pairs with 100,000+ co-occurrences dominate the top of the logCount distribution, which after normalization means they occupy the 0.9-1.0 range while pairs with 500 co-occurrences are compressed into 0.3-0.5. This compression disproportionately affects cuisines with fewer recipes in the corpus (see Weakness 4).

### Weakness 4: Source Imbalance and Western/English-Language Bias

**Scale disparity:**
- RecipeNLG: 2,231,142 recipes, 4,017 ingredients, 381,407 pairs (60% weight)
- TheMealDB: 593 recipes, 721 ingredients, 2,022 pairs (20% weight)
- TheCocktailDB: 426 recipes, 266 ingredients, 204 pairs (15% weight)

RecipeNLG is derived from English-language recipe websites. This creates systematic biases:

**Underrepresented cuisines:**
- **West African** (egusi, dawadawa, locust bean) -- near-zero representation in English recipe sites
- **Ethiopian** (berbere, niter kibbeh, korarima) -- specialized ingredients absent from RecipeNLG
- **Southeast Asian** (kencur, candlenut, pandan, torch ginger) -- many ingredients not canonicalized
- **Central Asian** (qurt, suzma, kashk) -- fermented dairy products unknown to Western recipe databases
- **Peruvian** (aji amarillo, huacatay, lucuma) -- unique Andean ingredients with few English recipes
- **Korean** (doenjang, jeotgal, makgeolli) -- limited beyond gochujang/gochugaru in synonyms table

**MealDB bias:** TheMealDB's 593 meals are heavily skewed toward British, American, and popular international dishes. A quick inspection of the API shows categories like "Beef", "Chicken", "Dessert", "Lamb", "Pasta", "Seafood" -- Western-centric groupings. There are some Thai, Japanese, and Moroccan entries, but coverage is thin.

**Cocktail bias:** TheCocktailDB is almost entirely Western bar cocktails. Traditional drinks from other cultures (soju cocktails, sake-based, mezcal tradition, ayurvedic drinks, Chinese herbal liquors) are poorly represented.

**The 3-recipe minimum compound:** `MIN_RECIPE_COUNT = 3` seems reasonable for RecipeNLG (2.2M recipes) but is the *same* threshold for MealDB (593 recipes) and CocktailDB (426 recipes). For small databases, this is quite restrictive: a pairing appearing in 2 out of 426 cocktail recipes (0.47%) is statistically significant but gets dropped.

### Weakness 5: FlavorDB Gap -- Missing Chemical Foundation

**What FlavorDB was supposed to provide:**

FlavorDB (cosylab.iiitd.edu.in/flavordb) catalogs ~25,000+ flavor compounds across ~936 food ingredients, mapping each ingredient to its constituent volatile and non-volatile molecules identified by PubChem CID.

**What the gap means:**

The intended 30% weight (now reduced to 5% nominal, 0% actual) was supposed to provide the *only chemistry-based signal* in the formula. Without it, the entire scoring system is purely statistical co-occurrence -- it knows nothing about *why* foods taste good together.

**What chemical data would add:**

1. **Food pairing hypothesis validation:** Ahn et al. (2011, Nature Scientific Reports) showed that Western cuisines tend to pair ingredients sharing flavor compounds, while East Asian cuisines tend to pair ingredients with *few* shared compounds. The formula currently cannot test or leverage this.

2. **Novel pairing discovery:** Chemical overlap can identify pairings that have never appeared in a recipe but should work. Example: white chocolate + caviar share trimethylamine and other compounds -- a pairing famously validated by Heston Blumenthal but absent from recipe databases.

3. **Pairing explanation:** Chemical data enables generating explanations like "Strawberry and basil both contain linalool (floral), giving them complementary aromatic profiles."

4. **Compound class analysis:** Knowing whether shared compounds are terpenes (herbal/citrus), aldehydes (green/fatty), esters (fruity), pyrazines (roasted/nutty), or sulfur compounds (pungent/savory) adds qualitative understanding.

### Weakness 6: No Negative Signal

**What's lost by clamping PMI >= 0:**

The PMI formula naturally produces negative values when two ingredients co-occur *less* than expected by chance. These negative values carry meaningful information:

- **Chocolate + fish:** These almost never appear together. Negative PMI would correctly flag this as an unusual/risky combination.
- **Mint + anchovy:** Negative co-occurrence suggests culinary incompatibility.
- **Cinnamon + soy sauce:** Rarely combined in practice (though potentially interesting).

By clamping to 0, the formula treats "never seen together" the same as "seen together at exactly the rate predicted by chance." This is a massive information loss.

**What negative signals would enable:**
- "Avoid" warnings in the UI
- Risk scores for experimental pairings
- Distinguishing "novel and untested" from "tested and rejected"
- Training data for a classifier: negative PMI pairs are (soft) negative examples

### Weakness 7: Symmetry Assumption

The formula uses `pairKey(a, b)` which sorts alphabetically, making (garlic, chicken) == (chicken, garlic). Both get the same strength score.

**Why this is wrong in practice:**

- **Garlic enhances chicken** -- garlic is a flavor modifier, chicken is the primary. Removing garlic from a chicken dish changes its character. Removing chicken from a garlic dish makes it a completely different dish.
- **Lemon brightens fish** -- lemon's acid cuts through fish's oily richness. But fish does not "brighten" lemon.
- **Salt enhances chocolate** -- a pinch of salt in chocolate intensifies sweetness and adds complexity. Chocolate does not enhance salt.
- **Butter carries sage** -- butter is a fat-soluble vehicle for sage's terpenes. The relationship is functional and directional.

**Asymmetry manifests as:**
- **Hub ingredients** (garlic, butter, lemon, olive oil) that enhance many things but aren't enhanced back
- **Primary vs. modifier** roles that differ per ingredient
- **Carrier vs. carried** flavor compound relationships

### Weakness 8: No Quantity/Ratio Sensitivity

The co-occurrence model treats every ingredient as binary: present or absent. But:

- **Vanilla + chocolate:** At 1:100 ratio (a drop of vanilla in chocolate ganache), vanilla provides aromatic lift. At 1:1, the flavors compete and muddle.
- **Chili + lime:** A squeeze of lime on chili is traditional. Equal parts would be inedible.
- **Salt in everything:** Salt at 1-2% enhances. At 5% it destroys. The skip-set removes salt entirely, losing all salt interaction data.

**The RecipeNLG dataset actually contains quantity data** (in the `ingredients` column, not the `NER` column), but the pipeline discards it during canonicalization. The `QUANTITY_RE` regex strips all numeric quantities before processing.

**What ratio data would enable:**
- Distinguishing "accent" pairings (1:20+) from "equal partner" pairings (1:1 to 1:3)
- Identifying ingredients that are always used in small quantities (saffron, truffle, vanilla) vs. bulk ingredients (rice, potato, flour)
- More accurate pairing strength: ingredients used in similar ratios across many recipes have a more reliable pairing signal

---

## Phase 3: Chemical Compound Data Sources

### Source 1: FlavorDB 2.0

- **URL:** `https://cosylab.iiitd.edu.in/flavordb2/` (the original FlavorDB has been superseded)
- **Status (as of 2025-2026):** The original API at `cosylab.iiitd.edu.in/flavordb` appears to be down intermittently. FlavorDB 2.0 may have different endpoints.
- **Data:**
  - ~936 food ingredients
  - ~25,595 flavor molecules per their published dataset
  - Fields: entity_id, entity_alias, category, molecules (each with PubChem CID, common name, flavor profile, natural occurrence)
- **Access:** Originally free REST API. A downloadable CSV dump was published alongside the 2017 paper (Garg et al., "FlavorDB: a database of flavor molecules," Nucleic Acids Research, 2018).
- **Format:** JSON via API; CSV available from supplementary materials
- **Licensing:** Academic/research use. The dataset from the paper's supplementary materials is freely available.
- **Coverage:** ~936 ingredients, primarily spices, herbs, fruits, vegetables, dairy, meats. Weaker on processed/composite ingredients.
- **Key limitation:** Many ingredient names use scientific/botanical nomenclature that needs mapping to culinary names.

### Source 2: FooDB

- **URL:** `https://foodb.ca/`
- **Access:** Free download after registration. REST API available at `https://foodb.ca/api/v1/`
- **Data:**
  - 1,003 food ingredients (raw, processed, and cooked)
  - 70,926 compound entries (26,625 confirmed in food)
  - 892 flavor descriptors
  - Compound types: volatile, non-volatile, macro/micronutrients
  - Each compound entry includes: name, CAS number, HMDB ID, PubChem CID, molecular weight, flavor/taste/odor descriptors, natural food sources
- **Format:** MySQL dump (downloadable), CSV exports, JSON via API
- **Licensing:** Creative Commons Attribution 4.0 (CC-BY 4.0) -- free for any use with attribution
- **Coverage:** Strong coverage of common foods. Contains detailed compound quantification (concentration ranges in mg/100g).
- **Advantage over FlavorDB:** FooDB includes QUANTITY data (concentration ranges), not just presence/absence. This enables weighted compound overlap rather than binary.
- **Key fields per compound:**
  - `name`: Common compound name
  - `cas_number`: CAS registry number
  - `pubchem_compound_db_id`: PubChem CID
  - `flavor_profile`: Text description of flavor
  - `odor_profile`: Text description of odor
  - `taste_profile`: Text description of taste
  - `food_id`: Which food contains it
  - `concentration`: Average concentration in the food
  - `concentration_unit`: Units (mg/100g typically)

### Source 3: PubChem

- **URL:** `https://pubchem.ncbi.nlm.nih.gov/`
- **Access:** Free REST API (PUG REST), no authentication required
- **Endpoint example:** `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/{CID}/property/MolecularFormula,MolecularWeight,IsomericSMILES/JSON`
- **Data:** Chemical properties of individual compounds. Not food-specific, but can be used to enrich compound data from FlavorDB/FooDB with molecular structure information.
- **Relevant fields:** SMILES notation (for structural similarity computation), molecular weight, XLogP (hydrophobicity -- relevant for volatility), compound classification
- **Licensing:** Public domain (US government database)
- **Use case:** Cross-reference PubChem CIDs from FlavorDB/FooDB to get structural properties. Compute Tanimoto structural similarity between compounds.

### Source 4: Volatile Compounds in Food (VCF) Database

- **URL:** `https://www.vcf-online.nl/` (subscription required)
- **Data:** 9,000+ volatile compounds in 800+ foods
- **Access:** Commercial subscription (~EUR 500/year for academic use)
- **Format:** Web interface with export capability
- **Coverage:** The gold standard for volatile compound data in food science. Published by TIFN (Top Institute Food and Nutrition, Netherlands).
- **Licensing:** Commercial. Not suitable for open-source project without licensing.
- **Assessment:** Best data quality but cost-prohibitive for this project.

### Source 5: Fenaroli's Handbook of Flavor Ingredients (via literature)

- **Not a database** but the canonical reference work (6th edition, 2015) documenting ~3,000 flavor compounds with their sensory properties, natural occurrence, and regulatory status (FEMA GRAS numbers).
- **Use case:** Manually extract key compound-to-flavor mappings for the most important 200-300 compounds. This is a one-time data-entry effort.

### Source 6: Open Food Facts

- **URL:** `https://world.openfoodfacts.org/`
- **Access:** Free API + bulk download
- **Data:** 3M+ food products with ingredient lists and nutritional data
- **Relevance:** Not directly useful for flavor compounds, but could supplement co-occurrence data with product-level ingredient combinations (e.g., flavored yogurts, sauces, condiments).
- **Licensing:** Open Database License (ODbL)

### Recommended Data Acquisition Strategy

**Primary: FooDB** -- Best combination of coverage, quality, accessibility, and licensing. The downloadable MySQL dump + CC-BY license makes it ideal.

**Secondary: FlavorDB supplementary data** -- Use the published CSV from the 2018 paper as a fallback/supplement. Available from Nucleic Acids Research supplementary materials.

**Enrichment: PubChem** -- Cross-reference compound CIDs to get structural data for computing molecular similarity beyond simple ID matching.

---

## Phase 4: Intelligent Pairing Formula Design

### Architecture Overview

```
                    INGREDIENT PAIR (A, B)
                           |
                    [Raw Feature Extraction]
                           |
              x1  x2  x3  x4  x5  x6  x7  x8
               \   \   |   |   |   /   /   /
                \   \  |   |   |  /   /   /
                 [Single-Layer Perceptron]
                    z = W . x + b
                    h = sigmoid(z)
                           |
                  [Context Modifiers]
                  cuisine / novelty / dietary
                           |
              [Multi-Dimensional Output Vector]
              overall | tradition | chemistry | novelty | balance | explanation
```

### Layer 1: Raw Feature Extraction (8 Dimensions)

#### Feature x1: Co-occurrence NPMI (existing, refined)

**Formula (unchanged):**
```
NPMI(A,B) = PMI(A,B) / (-log2(P(A,B)))
PMI(A,B) = log2(P(A,B) / (P(A) * P(B)))
```

**Refinement:** Remove the 35% log-count blend. Keep NPMI pure. The log-count information moves to x2.

**Range:** [0, 1] (clamped; negative PMI preserved separately in x1_neg below)

**Additionally store raw negative PMI as a separate metadata field:**
```
x1_neg = min(0, PMI(A,B)) / log2(P(A,B))   // in [-1, 0]
```
This is not an input to the perceptron but is used for "avoid" warnings in the UI.

#### Feature x2: Co-occurrence Frequency (existing, refined)

**Formula:**
```
x2 = log2(pairCount + 1) / log2(maxPairCount + 1)
```

**Change from current:** Normalize by max pair count across the dataset rather than by total recipes. This gives a more meaningful scale (0 = never, 1 = most frequently co-occurring pair).

**Range:** [0, 1]

#### Feature x3: Chemical Compound Overlap (NEW)

**Data source:** FooDB compound-food mappings

**Formula:** Weighted Jaccard similarity using compound concentrations:

```
Let C_A = set of flavor compounds in ingredient A
Let C_B = set of flavor compounds in ingredient B
Let w(c, X) = log2(1 + concentration_of_compound_c_in_X_mg_per_100g)

If concentration data available:
  x3 = sum(min(w(c,A), w(c,B)) for c in C_A intersect C_B) /
       sum(max(w(c,A), w(c,B)) for c in C_A union C_B)

If only presence/absence data available (FlavorDB):
  x3 = |C_A intersect C_B| / |C_A union C_B|    (standard Jaccard)
```

**Rationale for Jaccard over Simpson:** The current FlavorDB script uses Simpson overlap (normalize by min set size), which inflates scores for ingredients with very few known compounds. Jaccard is more conservative and penalizes asymmetric knowledge. However, the weighted variant above handles this naturally.

**Range:** [0, 1]

**Fallback:** If neither ingredient has compound data, x3 = 0.5 (neutral, not 0 which would penalize unknown ingredients).

#### Feature x4: Taste Compatibility Score (NEW)

**Data source:** Category-to-taste mappings already in `categories.json`

**Design:** An 8x8 compatibility matrix for the 8 taste dimensions:

```
TASTE_COMPATIBILITY = {
          sweet  sour  bitter  salty  umami  spicy  pungent  astringent
sweet     [ 0.5,  0.9,  0.7,   0.6,  0.5,   0.7,   0.4,     0.6  ]
sour      [ 0.9,  0.3,  0.5,   0.7,  0.8,   0.8,   0.6,     0.4  ]
bitter    [ 0.7,  0.5,  0.2,   0.6,  0.7,   0.5,   0.6,     0.5  ]
salty     [ 0.6,  0.7,  0.6,   0.2,  0.8,   0.7,   0.5,     0.4  ]
umami     [ 0.5,  0.8,  0.7,   0.8,  0.4,   0.6,   0.6,     0.5  ]
spicy     [ 0.7,  0.8,  0.5,   0.7,  0.6,   0.3,   0.7,     0.4  ]
pungent   [ 0.4,  0.6,  0.6,   0.5,  0.6,   0.7,   0.3,     0.5  ]
astringent[ 0.6,  0.4,  0.5,   0.4,  0.5,   0.4,   0.5,     0.2  ]
```

**Matrix rationale (from food science literature):**
- **sweet + sour = 0.9:** Classic complementary pairing. Acid enhances perceived sweetness at moderate levels (lemonade principle). Documented in: Keast & Breslin, 2003.
- **sweet + bitter = 0.7:** Moderate complementarity. Sugar tempers bitterness (coffee + sugar). Documented in: Breslin, 1996.
- **salty + umami = 0.8:** Strong synergy. Salt and glutamate enhance each other at sub-threshold levels (Yamaguchi & Ninomiya, 2000).
- **sweet + spicy = 0.7:** Thai cuisine principle. Sugar moderates capsaicin burn.
- **sour + umami = 0.8:** Japanese cuisine principle. Acidity brightens umami (ponzu + dashi).
- **bitter + bitter = 0.2:** Bitterness is additive and usually unpleasant when doubled.
- **astringent + astringent = 0.2:** Compounding astringency (tannins) dries the palate excessively.
- **same taste (diagonal) = low (0.2-0.5):** Same-taste pairings are harmonious but not as interesting as complementary ones.
- **sour + astringent = 0.4:** Both create mouth-puckering sensations; together they can be excessive.

**Computation for multi-taste ingredients:**

Many ingredients have multi-taste profiles (e.g., citrus = "sour sweet"). For a pair (A, B):

```
tastes_A = parse_taste_string(A.taste)  // e.g., ["sour", "sweet"]
tastes_B = parse_taste_string(B.taste)  // e.g., ["bitter", "umami"]

x4 = mean(TASTE_COMPATIBILITY[tA][tB] for tA in tastes_A, tB in tastes_B)
```

**Range:** [0, 1]

**Fallback:** If either ingredient has no taste data, x4 = 0.5 (neutral).

#### Feature x5: Category Bridge Score (NEW)

**Intuition:** Cross-category pairings that work are more interesting than within-category pairings. "Herb + herb" is expected. "Herb + dairy" is more informative.

**Category distance matrix:** Define a distance metric between the 22 ingredient categories:

```
Same category:           distance = 0.0
Adjacent categories:     distance = 0.5   (e.g., herb-spice, citrus-fruit, spirit-liqueur)
Distant categories:      distance = 1.0   (e.g., protein-sweetener, grain-spirit)
```

**Adjacent category pairs** (distance = 0.5):
- herb <-> spice (both flavor modifiers)
- citrus <-> fruit (both plant-derived, sweet/sour)
- protein <-> umami (both savory)
- fat <-> dairy (both lipid-rich)
- spirit <-> liqueur <-> bitters (all alcoholic)
- sweetener <-> fruit (both sweet)
- grain <-> thickener (both starchy)
- vegetable <-> aromatic (overlapping members)
- acid <-> citrus (both sour)
- mixer <-> liquid (both beverages)

All other pairs: distance = 1.0.

**Score computation:**
```
bridge_distance = category_distance(A.category, B.category)

// High co-occurrence + high category distance = interesting bridge
x5 = bridge_distance * x1  // scale by NPMI so only validated bridges score high

// If no co-occurrence data, use chemical overlap
if (x1 == 0) x5 = bridge_distance * x3
```

**Range:** [0, 1]

**Rationale:** The multiplication by NPMI or chemical overlap prevents arbitrary cross-category pairs (chocolate + sardines) from scoring high. Only validated or chemically grounded bridges get credit.

#### Feature x6: Cuisine Co-occurrence (NEW)

**Data source:** TheMealDB meal categories/areas + supplementary cuisine tagging

**Formula:**
```
cuisines_A = set of cuisines featuring ingredient A
cuisines_B = set of cuisines featuring ingredient B

cuisine_jaccard = |cuisines_A intersect cuisines_B| / |cuisines_A union cuisines_B|
x6 = cuisine_jaccard
```

**Range:** [0, 1]

**Interpretation:** High x6 = traditional pairing shared across cuisines. Low x6 = either novel or cuisine-specific.

**Note:** This feature intentionally correlates with x1 (NPMI) but adds a qualitative dimension. It answers "where is this pairing traditional?" rather than just "how often does it appear?"

#### Feature x7: Hub Asymmetry (NEW)

**Intuition:** A pairing between a hub ingredient (garlic, butter, lemon -- hundreds of connections) and a niche ingredient (saffron, truffle, yuzu -- few connections) is structurally different from two hubs pairing or two niche ingredients pairing.

**Formula:**
```
degree_A = number of pairings for ingredient A (from the graph)
degree_B = number of pairings for ingredient B

// Normalized hub score: log scale to compress dynamic range
hub_A = log2(degree_A + 1) / log2(max_degree + 1)
hub_B = log2(degree_B + 1) / log2(max_degree + 1)

// Asymmetry: how different are their hub scores?
x7 = |hub_A - hub_B|
```

**Range:** [0, 1]

**Interpretation:**
- x7 near 0: Both ingredients have similar connectivity (both hubs or both niche)
- x7 near 1: One is a mega-hub, the other is niche
- High x7 + high x1: A hub ingredient that reliably enhances a niche ingredient (garlic + saffron)

#### Feature x8: Compound Class Diversity (NEW)

**Data source:** FooDB compound classifications

**Compound classes (major categories of flavor-active compounds):**
1. **Terpenes/terpenoids** -- herbal, citrus, piney, floral (linalool, limonene, pinene)
2. **Aldehydes** -- green, fatty, waxy (hexanal, nonanal, citral)
3. **Esters** -- fruity, sweet, floral (ethyl acetate, methyl butyrate)
4. **Pyrazines** -- roasted, nutty, earthy (2-ethyl-3-methylpyrazine)
5. **Sulfur compounds** -- pungent, savory, garlicky (allicin, dimethyl sulfide)
6. **Lactones** -- creamy, coconut, peach (gamma-decalactone)
7. **Furanones** -- caramel, strawberry, sweet (furaneol)
8. **Phenols** -- smoky, spicy, medicinal (eugenol, guaiacol)
9. **Organic acids** -- sour, tangy (citric, malic, acetic)
10. **Alcohols** -- floral, green, waxy (linalool -- also terpene; 1-octen-3-ol)

**Formula:**
```
shared_compounds = C_A intersect C_B
classes_of_shared = set of compound classes represented in shared_compounds
total_classes = 10

x8 = |classes_of_shared| / total_classes
```

**Range:** [0, 1]

**Interpretation:** Higher diversity of shared compound classes suggests a more complex, multi-layered flavor interaction. If A and B share only terpenes (x8 = 0.1), their interaction is one-dimensional. If they share terpenes + esters + aldehydes (x8 = 0.3), the interaction has more facets.

**Fallback:** If compound data unavailable, x8 = 0.3 (below average, conservative).

### Layer 2: Learned Weights (Single-Layer Perceptron)

**Architecture:**
```
z = w1*x1 + w2*x2 + w3*x3 + w4*x4 + w5*x5 + w6*x6 + w7*x7 + w8*x8 + bias
output = sigmoid(z)
```

**Proposed initial weights (prior to training):**

| Feature | Weight | Rationale |
|---------|--------|-----------|
| w1 (NPMI) | 2.0 | Primary signal; strong statistical evidence of association |
| w2 (Frequency) | 0.5 | Mild positive weight; frequency matters but shouldn't dominate |
| w3 (Chemical overlap) | 2.5 | Strongest weight; chemistry is the ground truth for flavor pairing (Ahn et al., 2011) |
| w4 (Taste compatibility) | 1.5 | Important for balance; well-established in food science |
| w5 (Category bridge) | 1.0 | Moderate; interesting for discovery but not primary |
| w6 (Cuisine overlap) | 0.8 | Moderate; tradition is informative but can be limiting |
| w7 (Hub asymmetry) | 0.3 | Small; structural feature, not directly about flavor |
| w8 (Compound diversity) | 1.2 | Moderate-high; multi-dimensional interactions are more valuable |
| bias | -3.0 | Negative bias ensures output is selective (sigmoid(-3) = 0.047, requiring substantial positive input) |

**Weight rationale details:**

The 2.5 weight on chemical overlap (x3) reflects the central finding of the food pairing literature: shared volatile compounds are the strongest predictor of whether two ingredients will taste good together (see Ahn et al., 2011; Kort et al., 2010; de Klepper, 2011). The NPMI weight (2.0) is second because co-occurrence data is abundant and generally reliable, but as discussed in Weakness 1, it conflates multiple signals.

The negative bias of -3.0 ensures that the sigmoid output is near zero unless multiple features contribute positively. With all features at 0.5 (middling):
```
z = 2.0(0.5) + 0.5(0.5) + 2.5(0.5) + 1.5(0.5) + 1.0(0.5) + 0.8(0.5) + 0.3(0.5) + 1.2(0.5) - 3.0
z = 1.0 + 0.25 + 1.25 + 0.75 + 0.5 + 0.4 + 0.15 + 0.6 - 3.0
z = 1.9
sigmoid(1.9) = 0.87
```

With features at 0.3 (weak):
```
z = 0.6 + 0.15 + 0.75 + 0.45 + 0.3 + 0.24 + 0.09 + 0.36 - 3.0
z = -0.06
sigmoid(-0.06) = 0.485
```

This provides reasonable dynamic range.

**Training approach:**

**Ground truth data sources for supervised training:**

1. **Positive examples (score near 1.0):**
   - Expert chef pairings from The Flavor Bible (Karen Page & Andrew Dornenburg) -- ~1,000 validated pairings
   - Ahn et al.'s validated food pairing data from their Nature paper
   - Classic culinary school pairings (e.g., CIA Flavor Dynamics database)
   - Michelin-starred recipe pairings (hand-curated from notable cookbooks)

2. **Negative examples (score near 0.0):**
   - Pairs with strongly negative PMI that also have low chemical overlap
   - Known culinary taboos (documented in food science literature)
   - Randomly sampled pairs from ingredients with no shared compounds and no co-occurrence

3. **Training procedure:**
   - Use logistic regression (equivalent to single-layer perceptron with sigmoid)
   - Loss function: Binary cross-entropy
   - Regularization: L2 with lambda = 0.01 to prevent overfitting
   - Train on 70% of labeled data, validate on 15%, test on 15%
   - Optimization: Gradient descent (can be done in JavaScript with simple matrix math, or offline in Python)

```
Loss = -1/N * sum(y_i * log(sigmoid(z_i)) + (1-y_i) * log(1-sigmoid(z_i)))

Gradient for weight w_j:
  dL/dw_j = 1/N * sum((sigmoid(z_i) - y_i) * x_ij)

Update rule:
  w_j = w_j - learning_rate * (dL/dw_j + lambda * w_j)
```

**Offline training, online inference:** The perceptron weights are trained once (or periodically) offline using Python/NumPy. The trained weights are saved as a JSON file and loaded by the JavaScript pipeline at blend time. Inference is just a dot product + sigmoid -- trivial in JavaScript.

### Layer 3: Context Modifiers

The perceptron output `h = sigmoid(z)` is modified by user-selected context:

#### Cuisine Context Modifier

```
If user selects cuisine C:
  cuisine_boost(A,B) = 1.0 + alpha * (cuisine_relevance(A, C) + cuisine_relevance(B, C))

  where:
    cuisine_relevance(X, C) = 1.0 if C in cuisines(X), else 0.0
    alpha = 0.3  (30% boost for cuisine-relevant pairings)

  modified_score = h * min(cuisine_boost, 1.6)  // cap at 60% boost
```

#### Novelty Dial

User preference slider from 0.0 (classic) to 1.0 (adventurous):

```
novelty_preference in [0, 1]

// Reweight features before perceptron:
effective_w1 = w1 * (1 - 0.5 * novelty_preference)    // NPMI matters less for adventurous
effective_w2 = w2 * (1 - 0.8 * novelty_preference)    // Frequency matters much less
effective_w3 = w3 * (1 + 0.5 * novelty_preference)    // Chemistry matters more
effective_w5 = w5 * (1 + 0.8 * novelty_preference)    // Category bridges more interesting
effective_w6 = w6 * (1 - 0.6 * novelty_preference)    // Cuisine tradition less important

// Other weights unchanged
// Recompute z with effective weights, then sigmoid
```

At novelty = 0 (classic): weights unchanged, favors traditional well-known pairings.
At novelty = 1 (adventurous): NPMI halved, frequency nearly zeroed, chemistry boosted 50%, bridges boosted 80%, cuisine tradition reduced 60%. Favors chemically grounded but unconventional pairings.

#### Dietary Context

Binary filters applied post-scoring:

```
if (dietary_context == 'vegan'):
  exclude pairs where A or B has category in {protein, dairy}
  AND A or B is animal-derived (maintain a tag in ingredients.json)

if (dietary_context == 'gluten_free'):
  exclude pairs where A or B has category == 'grain' AND contains gluten
  (maintain a gluten_free boolean in ingredients.json)

if (dietary_context == 'halal' or 'kosher'):
  exclude pairs involving pork, non-halal proteins, mixing of meat+dairy
```

These are hard filters, not score modifiers.

### Output: Multi-Dimensional Pairing Vector

Instead of a single `strength` scalar, each pairing outputs:

```javascript
{
  overall: sigmoid(z),                              // 0-1, the perceptron output
  tradition: weighted_mean(x1, x2, x6),             // how traditional/established
  chemistry: weighted_mean(x3, x8),                 // how chemically grounded
  novelty: 1 - weighted_mean(x1, x2, x6),          // inverse of tradition
  balance: x4,                                      // taste compatibility directly
  bridging: x5,                                     // cross-category interestingness
  explanation: generateExplanation(features, compounds)  // human-readable string
}

where weighted_mean uses normalized weights summing to 1.
```

**Explanation generation:**

```javascript
function generateExplanation(A, B, features, sharedCompounds) {
  const parts = [];

  if (sharedCompounds.length > 0) {
    const top3 = sharedCompounds.slice(0, 3);
    const descriptors = top3.map(c => `${c.name} (${c.flavor_descriptor})`);
    parts.push(`Both contain ${descriptors.join(', ')}.`);
  }

  if (features.x4 > 0.7) {
    parts.push(`Strong taste complementarity (${A.taste} + ${B.taste}).`);
  }

  if (features.x6 > 0.5) {
    const sharedCuisines = getCuisineIntersection(A, B);
    parts.push(`Traditional in ${sharedCuisines.slice(0,2).join(' and ')} cuisine.`);
  }

  if (features.x5 > 0.5 && features.x6 < 0.3) {
    parts.push(`Unconventional cross-category pairing with chemical support.`);
  }

  return parts.join(' ');
}
```

---

## Phase 5: Implementation Roadmap

### Phase 5.1: Data Acquisition (Weeks 1-3)

#### Task 1: Download and process FooDB

1. Register at foodb.ca and download the MySQL dump
2. Extract relevant tables:
   - `foods` -- food items with names
   - `compounds` -- compound names, CAS numbers, classes
   - `contents` -- food-compound mappings with concentrations
   - `flavor_profiles` -- odor/taste descriptors per compound
3. Write a new script `06-process-foodb.js`:
   - Parse MySQL dump or CSV export
   - Map FooDB food names to canonical ingredient names (using existing `synonyms.json` extended with FooDB-specific mappings)
   - Output: `processed/foodb-compounds.json`

   ```json
   {
     "ingredients": {
       "basil": {
         "compounds": [
           { "pubchem_id": "6549", "name": "linalool", "class": "terpene",
             "concentration_mg": 12.5, "flavor": "floral, sweet", "odor": "floral, woody" },
           ...
         ]
       }
     },
     "compound_classes": {
       "6549": "terpene",
       "22311": "aldehyde",
       ...
     }
   }
   ```

4. Expected coverage: ~600-800 ingredients mapped (out of 4,488 in the current dataset)

#### Task 2: Build FooDB-to-canonical name mapping

1. Extend `synonyms.json` with FooDB variant names (botanical names, processed forms)
2. Write a semi-automated matching script that:
   - Exact matches canonical names to FooDB food names
   - Fuzzy matches (Levenshtein distance <= 2) for remaining
   - Manual review queue for ambiguous matches
3. Expected effort: ~200 manual mappings needed

#### Task 3: Retrieve FlavorDB supplementary data

1. Download CSV from Garg et al. (2018) Nucleic Acids Research supplementary materials
2. Parse into same format as FooDB output
3. Merge with FooDB data (FooDB takes priority for concentration data; FlavorDB fills gaps)

### Phase 5.2: Feature Engineering Scripts (Weeks 3-5)

#### New script: `06-compute-features.js`

This script runs after the existing Steps 1-4 and before blending:

```
Input:
  - processed/recipenlg-cooccurrence.json
  - processed/mealdb-cooccurrence.json
  - processed/cocktaildb-cooccurrence.json
  - processed/foodb-compounds.json
  - data/categories.json
  - data/taste_compatibility.json (new, the 8x8 matrix)

Output:
  - processed/pair-features.json
    {
      "pair_key": {
        "x1_npmi": 0.45,
        "x2_freq": 0.32,
        "x3_chemical": 0.67,
        "x4_taste": 0.82,
        "x5_bridge": 0.55,
        "x6_cuisine": 0.40,
        "x7_hub_asymmetry": 0.23,
        "x8_compound_diversity": 0.30,
        "shared_compounds": ["linalool", "limonene", "eugenol"],
        "shared_compound_classes": ["terpene", "terpene", "phenol"]
      },
      ...
    }
```

#### New data file: `data/taste_compatibility.json`

The 8x8 matrix from Phase 4, Feature x4.

#### New data file: `data/category_distances.json`

The category adjacency definitions from Phase 4, Feature x5.

### Phase 5.3: Perceptron Training (Weeks 5-7)

#### Task 1: Assemble training data

1. **Positive labels:** Extract ~500-1,000 validated pairings from:
   - The Flavor Bible "highly recommended" pairings (available as structured data from academic analyses)
   - Ahn et al. (2011) published dataset of validated food pairings
   - Hand-curate 100 expert-validated pairings from Michelin chef cookbooks

2. **Negative labels:** Sample ~500-1,000 negative examples:
   - Pairs with PMI < -1.0 (anti-correlated) AND chemical overlap < 0.05
   - Random pairs from different culinary traditions with no co-occurrence
   - Known culinary incompatibilities from food science literature

3. Store as `training/labeled_pairs.json`:
   ```json
   [
     { "a": "basil", "b": "tomato", "label": 1, "source": "flavor_bible" },
     { "a": "chocolate", "b": "sardine", "label": 0, "source": "anti_correlated" },
     ...
   ]
   ```

#### Task 2: Train the perceptron

1. Write a Python script `training/train_perceptron.py`:
   ```python
   import numpy as np

   # Load features and labels
   X = load_features()  # shape: (N, 8)
   y = load_labels()    # shape: (N,)

   # Initialize with proposed weights
   w = np.array([2.0, 0.5, 2.5, 1.5, 1.0, 0.8, 0.3, 1.2])
   b = -3.0

   # Train with gradient descent
   lr = 0.01
   lambda_reg = 0.01

   for epoch in range(1000):
       z = X @ w + b
       h = 1 / (1 + np.exp(-z))

       loss = -np.mean(y * np.log(h + 1e-8) + (1-y) * np.log(1-h + 1e-8))
       loss += 0.5 * lambda_reg * np.sum(w**2)

       dw = X.T @ (h - y) / len(y) + lambda_reg * w
       db = np.mean(h - y)

       w -= lr * dw
       b -= lr * db

   # Save trained weights
   save_json('trained_weights.json', {
       'weights': w.tolist(),
       'bias': float(b),
       'training_loss': float(loss),
       'training_accuracy': float(np.mean((h > 0.5) == y))
   })
   ```

2. Output: `data/trained_weights.json`

3. Validate: Report precision, recall, F1 on the test set. Target F1 > 0.80.

### Phase 5.4: Pipeline Integration (Weeks 7-9)

#### Modified script: `05-blend.js` -> `05-blend-v2.js`

Replace the simple weighted average with the perceptron scoring:

```javascript
// Load trained weights
const { weights, bias } = readJson(path.join(DATA_DIR, 'trained_weights.json'));

// Load feature data
const featureData = readJson(path.join(PROCESSED_DIR, 'pair-features.json'));

for (const key of allPairKeys) {
  const f = featureData[key];
  if (!f) continue;

  const features = [f.x1_npmi, f.x2_freq, f.x3_chemical, f.x4_taste,
                     f.x5_bridge, f.x6_cuisine, f.x7_hub_asymmetry, f.x8_compound_diversity];

  // Perceptron forward pass
  const z = features.reduce((sum, x, i) => sum + x * weights[i], bias);
  const overall = 1 / (1 + Math.exp(-z));

  // Multi-dimensional output
  const tradition = (f.x1_npmi * 0.4 + f.x2_freq * 0.3 + f.x6_cuisine * 0.3);
  const chemistry = (f.x3_chemical * 0.6 + f.x8_compound_diversity * 0.4);
  const novelty = 1 - tradition;
  const balance = f.x4_taste;

  blendedPairs.push({
    key,
    ingredientA: a,
    ingredientB: b,
    strength: overall,
    tradition,
    chemistry,
    novelty,
    balance,
    bridging: f.x5_bridge,
    sharedCompounds: f.shared_compounds || [],
    breakdown: { ...f },
  });
}
```

#### Modified output: `pairings.json` schema change

```json
[
  {
    "ingredientA": "basil",
    "ingredientB": "tomato",
    "strength": 0.92,
    "tradition": 0.88,
    "chemistry": 0.73,
    "novelty": 0.12,
    "balance": 0.85,
    "bridging": 0.45,
    "sharedCompounds": ["linalool", "eugenol", "citral"],
    "breakdown": {
      "x1_npmi": 0.78,
      "x2_freq": 0.65,
      "x3_chemical": 0.73,
      "x4_taste": 0.85,
      "x5_bridge": 0.45,
      "x6_cuisine": 0.92,
      "x7_hub_asymmetry": 0.15,
      "x8_compound_diversity": 0.30
    }
  }
]
```

#### Modified config.js

```javascript
// Old weights replaced by perceptron
// export const WEIGHTS = { ... }  // REMOVED

// New thresholds
export const MIN_BLENDED_STRENGTH = 0.15;  // raised from 0.02 since perceptron
                                            // output is more selective
export const FEATURE_FALLBACKS = {
  x3_chemical: 0.5,        // neutral when no compound data
  x8_compound_diversity: 0.3,  // conservative when no compound data
};
```

### Phase 5.5: App UI Changes (Weeks 9-12)

#### Modified `useProData.js`

Update `buildProGraph` to pass through the new multi-dimensional scores:

```javascript
edges.push({
  source,
  target,
  strength: pairing.strength,      // overall score (for rendering)
  tradition: pairing.tradition,
  chemistry: pairing.chemistry,
  novelty: pairing.novelty,
  balance: pairing.balance,
  bridging: pairing.bridging,
  sharedCompounds: pairing.sharedCompounds,
});
```

#### Modified `IngredientPanel.jsx`

Add a multi-dimensional score display for each pairing:

- **Score radar chart:** Small 5-axis radar (tradition, chemistry, novelty, balance, bridging) for each top pairing
- **Compound explanation:** "Both share linalool (floral) and limonene (citrus)"
- **Novelty badge:** Flag pairings where novelty > 0.7 with a "Discovery" badge

#### New: Novelty Dial Control

Add a slider to `Controls.jsx`:
- Label: "Exploration Style"
- Left end: "Classic" (icon: traditional chef hat)
- Right end: "Adventurous" (icon: laboratory flask)
- Changes edge rendering: Classic = only high-tradition edges visible; Adventurous = high-chemistry/high-novelty edges visible
- Implementation: Filter edges in `EdgeMesh.js` based on novelty dial position

#### New: Compound Overlay Mode

Add a toggle to show chemical compound sharing:
- When enabled, edges are colored by compound class:
  - Terpenes: green
  - Aldehydes: yellow-green
  - Esters: pink
  - Pyrazines: brown
  - Sulfur compounds: amber
  - Phenols: purple
- Edge thickness proportional to number of shared compounds
- Requires new shader uniforms in `ShaderMaterials.js`

### Phase 5.6: Pipeline Script Summary

**Updated pipeline order:**

| Step | Script | New/Modified |
|------|--------|-------------|
| 1 | `01-parse-recipenlg.js` | Minor: preserve negative PMI |
| 2 | `02-fetch-flavordb.js` | Keep as fallback |
| 3 | `03-fetch-mealdb.js` | Unchanged |
| 4 | `04-fetch-cocktaildb.js` | Unchanged |
| 5 | `05-process-foodb.js` | **NEW**: Process FooDB compound data |
| 6 | `06-compute-features.js` | **NEW**: Compute 8-dimensional feature vectors |
| 7 | `07-blend-v2.js` | **MODIFIED**: Perceptron-based blending |

**New data files:**

| File | Purpose |
|------|---------|
| `data/taste_compatibility.json` | 8x8 taste interaction matrix |
| `data/category_distances.json` | Category adjacency definitions |
| `data/trained_weights.json` | Perceptron weights + bias |
| `data/foodb_name_mappings.json` | FooDB food name to canonical name mappings |
| `processed/foodb-compounds.json` | Ingredient-compound mappings with concentrations |
| `processed/pair-features.json` | 8-dimensional feature vectors per pair |
| `training/labeled_pairs.json` | Training data for perceptron |
| `training/train_perceptron.py` | Training script |

### Phase 5.7: Validation Plan

1. **Quantitative evaluation:**
   - Compare top-100 pairings from old vs. new formula against expert-validated ground truth
   - Measure precision@k for k = 10, 50, 100, 500
   - Report per-cuisine accuracy (ensure non-Western cuisines improved)

2. **Qualitative evaluation:**
   - Blind taste test: Present 20 novel pairings (high chemistry, low tradition) to 5 culinary professionals
   - Score each on 1-5 scale for "I would use this in a dish"
   - Target: mean score > 3.5 for pairings with chemistry > 0.6

3. **A/B test in app:**
   - Deploy both formulas, randomly assign users
   - Track engagement metrics: time spent exploring, number of pairings clicked, return visits
   - Target: 15%+ increase in exploration depth (edges clicked per session)

---

## Appendix A: Mathematical Reference

### NPMI Derivation

Normalized Pointwise Mutual Information (Bouma, 2009):

```
PMI(A,B) = log2(P(A,B) / (P(A) * P(B)))
         = log2(P(A,B)) - log2(P(A)) - log2(P(B))

NPMI(A,B) = PMI(A,B) / h(A,B)
where h(A,B) = -log2(P(A,B))

NPMI range: [-1, +1]
  +1: A and B always co-occur (P(A,B) = P(A) = P(B))
  0:  A and B are independent
  -1: A and B never co-occur

Current implementation clamps to [0, 1], discarding the [-1, 0) range.
```

### Sigmoid Function Properties

```
sigmoid(z) = 1 / (1 + exp(-z))

sigmoid(0) = 0.5
sigmoid(-3) = 0.047
sigmoid(-5) = 0.007
sigmoid(3) = 0.953
sigmoid(5) = 0.993

Derivative: sigmoid'(z) = sigmoid(z) * (1 - sigmoid(z))
```

### Jaccard vs Simpson Overlap

```
Jaccard(A,B) = |A intersect B| / |A union B|
  - Symmetric, penalizes size difference
  - Better when both sets are well-characterized

Simpson(A,B) = |A intersect B| / min(|A|, |B|)
  - Asymmetric (normalizes by smaller set)
  - Better when one set may be incomplete
  - Current FlavorDB implementation uses this

Weighted Jaccard(A,B) = sum(min(wA_i, wB_i)) / sum(max(wA_i, wB_i))
  - Proposed for FooDB (with concentration weights)
  - Naturally handles varying compound importance
```

### Perceptron Gradient Derivation

```
Given:
  z = w^T x + b
  h = sigmoid(z)
  L = -[y * log(h) + (1-y) * log(1-h)]

Chain rule:
  dL/dz = h - y
  dL/dw_j = (h - y) * x_j
  dL/db = h - y

With L2 regularization:
  L_reg = L + (lambda/2) * sum(w_j^2)
  dL_reg/dw_j = (h - y) * x_j + lambda * w_j
```

---

## Appendix B: Key References

1. **Ahn, Y.-Y., Ahnert, S. E., Bagrow, J. P., & Barabasi, A.-L. (2011).** Flavor network and the principles of food pairing. *Nature Scientific Reports*, 1, 196. -- Foundational work showing Western cuisines favor shared-compound pairings while East Asian cuisines avoid them.

2. **Garg, N., et al. (2018).** FlavorDB: a database of flavor molecules. *Nucleic Acids Research*, 46(D1), D1210-D1216. -- Primary chemical compound database used in this project.

3. **Bouma, G. (2009).** Normalized (pointwise) mutual information in collocation extraction. *GSCL*, 31-40. -- Formal definition and properties of NPMI.

4. **Kort, M., Nijssen, B., van Ingen-Visscher, K., & Donders, J. (2010).** Food pairing from the perspective of the 'volatile compounds in food' database. *Expression of Multidisciplinary Flavour Science*. -- VCF-based food pairing analysis.

5. **Keast, R. S. J., & Breslin, P. A. S. (2003).** An overview of binary taste-taste interactions. *Food Quality and Preference*, 14(2), 111-124. -- Taste interaction matrix foundation.

6. **Yamaguchi, S., & Ninomiya, K. (2000).** Umami and food palatability. *Journal of Nutrition*, 130(4S), 921S-926S. -- Umami-salt synergy evidence.

---

*End of design document. This is a research artifact -- no implementation code has been written.*
