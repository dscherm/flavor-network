# Ingredient Dataset Audit — Final Report
Generated: 2026-06-12T02:08:09.160Z
Dataset: 3891 ingredients, 95992 pairings

---

## Summary of Changes Applied

| Change Type | Count |
|-------------|-------|
| Category fixes applied (ingredients.json) | 153 (50 initial + 24 corrections + 79 additional) |
| Synonyms added (synonyms.json) | 116 new (total: 524) |
| Keys renamed/deleted | 0 — no referential integrity risk |
| Pairings modified | 0 — no pairing changes |

---

## 1. Category Fixes Applied

**50 initial fixes** from the automated audit pass, with **24 subsequent corrections** where the
keyword rules fired incorrectly (egg noodles → grain not protein; drippings/lard → fat not protein;
rice vinegar → acid not grain; rice/barley syrups → sweetener not grain; grape nut cereal → grain
not fruit; apple/coconut/pumpkin butters → condiment/fat not fruit/vegetable).

**79 additional fixes** for clear "other"-category items with obvious correct categories, and
a few other clear mislabels (gelatin → thickener, water chestnut → vegetable, sugar snap pea →
vegetable, black pepper → spice, coconut water → liquid, tofu/seitan → protein, etc.).

### Category distribution after all fixes

| Category | Count |
|----------|-------|
| protein | 476 |
| other | 417 |
| vegetable | 400 |
| dairy | 326 |
| fruit | 277 |
| grain | 274 |
| chili | 172 |
| sweetener | 166 |
| citrus | 159 |
| liquid | 157 |
| fat | 130 |
| condiment | 124 |
| nut | 118 |
| baked | 115 |
| spice | 113 |
| aromatic | 100 |
| thickener | 87 |
| herb | 76 |
| liqueur | 41 |
| seasoning | 40 |
| acid | 35 |
| spirit | 33 |
| umami | 25 |
| confection | 20 |
| mixer | 6 |
| bitters | 4 |

**"other" reduced from 482 → 417** (65 reclassified).

### Notable category corrections (selected examples)

| Ingredient | Old → New | Rationale |
|------------|-----------|-----------|
| egg noodle (+ 7 variants) | protein → grain | egg is ingredient in pasta, not the food type |
| bacon/beef/turkey dripping | protein → fat | rendered cooking fat |
| lard | protein → fat | rendered pork fat — fat is correct |
| rice vinegar (3 variants) | grain → acid | vinegar is an acid; rice is source ingredient |
| rice/barley malt syrup (3) | grain → sweetener | syrup sweetener; grain is source |
| grape nut cereal | fruit → grain | breakfast cereal; "grape" is a brand name |
| apple butter | fruit → condiment | fruit preserve/spread |
| coconut butter | fruit → fat | fat product derived from coconut |
| pumpkin butter | vegetable → condiment | vegetable-based spread/preserve |
| avocado (+ variants) | other → fruit | avocado is a fruit |
| beet/beetroot | other → vegetable | root vegetable |
| peppercorn (6 variants) | other/seasoning → spice | peppercorns are spices |
| gelatin (10 variants) | dairy/spice → thickener | gelatin is a thickening/gelling agent |
| tofu (3 variants) | other → protein | plant-based protein |
| vermicelli | other → grain | pasta/noodle |
| fettuccine | other → grain | pasta |
| whisky (5 variants) | other → spirit | distilled spirit |
| black pepper | seasoning → spice | spice not generic seasoning |
| water chestnut | nut → vegetable | corm/vegetable, not a true nut |
| coconut water | nut → liquid | liquid beverage |
| sugar snap pea | sweetener → vegetable | vegetable, named for sweetness not category |
| edamame (2 variants) | other → vegetable | immature soybeans |
| seitan | other → protein | plant-based protein |

---

## 2. Synonyms Added

**116 new synonyms** added to `proDataset/data/synonyms.json`
(total: 524 entries, up from 408).

Categories of additions:
- **"leave" → "leaves" redirects (21):** e.g. `makrut lime leaves` → `makrut lime leave`
  (the misspelled key stays; the correct spelling is added as a synonym pointing to it)
- **Misspellings of existing correct-spelling keys (14):** e.g. `baking potatoe` → `baking potato`
- **Clear spelling variants (78 from programmatic scan):**
  - Misspellings: `pinapple`→`pineapple`, `worchestershire sauce`→`worcestershire sauce`,
    `cayanne pepper`→`cayenne pepper`, `balsalmic vinegar`→`balsamic vinegar`,
    `avocadoe`→`avocado`, `shitake mushroom`→`shiitake mushroom`, etc.
  - UK/US variants: `soya sauce`→`soy sauce`, `gelatine`→`gelatin`,
    `unflavored gelatine`→`unflavored gelatin`
  - Homophones: `course salt`→`coarse salt`, `course black pepper`→`coarse black pepper`
  - Erroneous plurals/forms: `eggs yolk`→`egg yolk`, `lemon juiced`→`lemon juice`,
    `barbecued pork`→`barbecue pork`
  - Separator variants: `hotsauce`→`hot sauce`, `bayleaf`→`bay leaf`,
    `biscuit/baking mix`→`biscuit baking mix`
  - Mushroom variants: `portabella mushroom`→`portobello mushroom`,
    `crimini mushroom`→`cremini mushroom`
  - Chili/chile/chilli variants (11 pairs mapped to dominant US form)

**No key renames performed.** Misspelled keys remain in ingredients.json; synonyms redirect
lookups to the canonical form.

---

## 3. Duplicate Clusters — Flagged for Human Review

These require manual merge decisions (pairing consolidation + key deletion across multiple files).
**Not touched in this pass.**

### Must-merge (clear duplicates, both keys exist)

| Pair | Canonical | Pairings A | Pairings B | Note |
|------|-----------|-----------|-----------|------|
| garbanzo bean ↔ chickpea | chickpea | 36 | 89 | Same legume; synonym added |
| sour cream ↔ soured cream | sour cream | 485 | 16 | Same product; synonym added |
| udon noodle ↔ udon noodles | udon noodle | 23 | 42 | Plural variant; synonym added |
| capers ↔ caper | capers | 284 | 20 | Plural variant; synonym added |

### Ambiguous — do NOT merge

| Pair | Why |
|------|-----|
| cilantro ↔ coriander | US: cilantro=leaf, coriander=seed — legitimately different |
| shrimp ↔ prawn | Different sizes in US usage; prawn has only 15 pairings |
| lemon ↔ lemon juice | Ingredient vs prepared juice — different culinary uses |
| lime ↔ lime juice | Ingredient vs prepared juice — different culinary uses |

---

## 4. Near-Duplicate Pairs — Flagged for Human Review

116 pairs detected by edit-distance ≤ 1. Selected high-priority ones not handled by synonyms:

| Pair | Issue | Recommended Action |
|------|-------|--------------------|
| worcestershire sauce ↔ worchestershire sauce | misspelling | synonym added |
| soy sauce ↔ soya sauce | UK variant | synonym added |
| tabasco sauce ↔ tobasco sauce | misspelling | synonym added |
| strawberry jello ↔ strawberry jelly | different products | do NOT merge |
| applesauce ↔ apple sauce | spacing | synonym added |
| barbecue sauce ↔ barbeque sauce | spelling | synonym added |
| green chilie ↔ green chili | misspelling | synonym added |
| chili sauce ↔ chile sauce ↔ chilli sauce | regional variants | synonyms added |
| red chili ↔ red chilie | misspelling | synonym added |
| crawfish ↔ crayfish | regional US/UK | flagged — do not merge (both valid) |
| grapeseed oil ↔ rapeseed oil | completely different oils | do NOT merge |
| green pea ↔ green tea | completely different | do NOT merge |
| green olive ↔ greek olive | different products | do NOT merge |
| chocolate bar ↔ chocolate bark | different products | do NOT merge |

---

## 5. Referential Integrity — Pairings

- **Pairings with missing ingredient refs:** 1
- **Orphaned name(s):** remoulade

The single orphaned name (`remoulade`) was present before this audit and is not caused by
any change in this pass.

---

## 6. Files Modified

| File | Change |
|------|--------|
| `public/proDataset/ingredients.json` | 153 category field values corrected |
| `public/proDataset/pairings.bin` | Regenerated by `npm run build:pairings` (prebuild step) |
| `proDataset/data/synonyms.json` | 116 new synonym entries added |

**Not modified** (no key renames/merges performed):
`pairings.json`, `gnn_entropy.json`, `gnn_entropy_imputed.json`, `gnn_compounds.json`,
`flavor_positions*.json`, `gnn_positions.json`, `cluster_labels*.json`

---

## 7. Verification

- **Tests:** 1,312 passed (119 test files) — exit 0
- **Build:** `vite build` — ✓ built in 19.65s, no errors
- **`build:pairings`:** 95,992 pairings, 95,991 indexed (1 pre-existing orphan: `remoulade`)
