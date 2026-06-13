"""Extend RECIPE-LAB-SPEC.md with 5 new sections (§11-§15) covering the
N2-AGG-RECAL / DOCS-MAKE-MODE additions: per-ingredient portions, auto-
portion inference, focal-weighted suggestions, food-category filter,
sauces + seasonings recommendations, recipe-type classifier.

Renumbers existing §11-§15 → §17-§21 (shift by 6) so the new sections
land logically right after §10 Data contracts.
"""
import re
from pathlib import Path

SPEC = Path("D:/Projects/flavor-network/docs/RECIPE-LAB-SPEC.md")
text = SPEC.read_text(encoding="utf-8")

# 1) Renumber existing sections + anchor refs.
#    REVERSE order to avoid double-shifts.
#    Old §11→§17, §12→§18, §13→§19, §14→§20, §15→§21
SHIFT = 6
for old in [15, 14, 13, 12, 11]:
    new = old + SHIFT
    # Header lines like "## 14. Open questions"
    text = re.sub(
        rf"^## {old}\. ",
        f"## {new}. ",
        text,
        flags=re.MULTILINE,
    )
    # TOC numeric line "14. [Open questions](#14-open-questions)"
    text = re.sub(
        rf"^{old}\. ",
        f"{new}. ",
        text,
        flags=re.MULTILINE,
    )
    # Anchor links inside TOC: "(#14-open-questions)"
    text = re.sub(
        rf"\(#{old}-",
        f"(#{new}-",
        text,
    )
    # Body cross-refs "§14" → "§20"
    text = re.sub(
        rf"§{old}\b",
        f"§{new}",
        text,
    )
    # Body cross-refs "(§14.X)" or "see §14" already handled by the §N\b above.

# 2) Insert new sections between current §10 and original §11 (now §17).
#    Find the start of "## 17. State ownership" — that's where the original
#    §11 lived. Insert new sections immediately above that header.

NEW_SECTIONS = """## 11. Per-ingredient portion data model

DOCS-MAKE-MODE spec, deep-interview Round 2 (2026-05-27). Free-text
amount per ingredient with optional structured `{qty, unit}` extracted
by a forgiving parser. Free-text is the source of truth for display;
structured fields are derived for §13 proportional-weighting math.

### 11.1 Bowl entry shape

Each ingredient row in `RecipeLabMobile`'s bowl carries an `amount`
sub-object:

```json
{
  "ingredient": "tomato",
  "amount": {
    "raw": "2 medium",
    "qty": 2,
    "unit": "medium",
    "inferred": false
  }
}
```

- `raw` — verbatim user entry; never mutated by the parser
- `qty` / `unit` — populated by `parseAmount(raw)` if parsing succeeds;
  null otherwise
- `inferred` — `true` when the value came from §12 auto-portion
  inference (user accepted a suggestion) rather than direct entry

### 11.2 Parser contract

`parseAmount(raw: string) → { qty, unit } | null` lives in
`src/data/portionParser.js`. Recognizes:

- Integer, decimal, simple fraction (`1/2`), mixed (`1 1/2`)
- Common units (case-insensitive, plural-forgiving):
  `tsp` / `teaspoon` / `t`, `tbsp` / `tablespoon` / `T`,
  `cup` / `c`, `g` / `gram`, `oz` / `ounce`, `lb` / `pound`,
  `ml`, `l` / `liter`,
  `pinch`, `dash`, `sprig`, `clove`,
  `each`, `medium`, `large`, `small`, `handful`
- Sentinel string `"to taste"` → `{ qty: null, unit: 'to_taste' }`
- Failure → returns `null`; caller stores only `amount.raw`

### 11.3 UI representation

Per-ingredient row in `RecipeNotebook` renders:
- Ingredient label (existing)
- Inline single-line text input for `amount.raw`, placeholder `"amount"`,
  monospaced font, ~80px wide
- On commit (blur or Enter), runs `parseAmount(raw)`
- If parsed: small structured chip beside the text (`1 tbsp` chip,
  same line)
- If parse failed: raw text preserved verbatim, no UI error, no chip

### 11.4 Acceptance

- [ ] `parseAmount("1 tbsp")` returns `{ qty: 1, unit: 'tbsp' }`
- [ ] `parseAmount("1/2 cup")` returns `{ qty: 0.5, unit: 'cup' }`
- [ ] `parseAmount("a pinch")` returns `{ qty: null, unit: 'pinch' }`
- [ ] `parseAmount("nonsense")` returns `null`
- [ ] Amount input is per-row in `RecipeNotebook`; preserves raw text
      on parse failure
- [ ] Bowl serialization round-trips: structured + raw both persist

---

## 12. Auto-portion inference

DOCS-MAKE-MODE deep-interview Round 5 (2026-05-27). When the user adds
an ingredient without an amount and the bowl already has ≥ 2 priced
amounts, the app suggests an amount inline as a tappable placeholder.
No silent auto-fill — user always sees the suggestion first.

### 12.1 Trigger

The placeholder appears in the amount input field when ALL of:
- New ingredient just added to the bowl (no `amount.raw` yet)
- Bowl contains ≥ 2 ingredients with `amount.qty != null`
- §12.2 inference returns a non-null result

### 12.2 Inference algorithm

`inferAmount(ingredient, recipeType, bowl) → { qty, unit, confidence }`
lives in `src/data/portionInference.js`.

Inputs:
- `ingredient` — canonical name
- `recipeType` — §16 enum value or null
- `bowl` — current bowl array (for proportional baseline)

Algorithm:
1. Query `recipe_pairs.json` for recipes containing `ingredient`
2. If `recipeType` is set, restrict to recipes tagged with that type;
   else use the global pool
3. For each `(qty, unit)` pair observed in matching recipes, compute
   the median per `unit` bucket
4. Return `{ qty: median, unit: most-common-unit, confidence }`
5. `confidence = min(n_matching_recipes / 100, 1.0)`
6. Fallback if no matching recipes: `{ qty: 1, unit: 'each',
   confidence: 0 }`

### 12.3 Data dependency

Requires `recipe_pairs.json` to carry per-ingredient amounts. Today
the file is co-occurrence-only (no amounts). The amount layer is a
NEW data-pipeline step — see §20 Open questions for the build-out
path. Until that data lands, `inferAmount` falls back to confidence=0
fixed-`{1, each}` defaults.

### 12.4 UI representation

- Placeholder text shows in light grey: `"1 tbsp (inferred)"`
- User taps the placeholder → commits as
  `{ qty: 1, unit: 'tbsp', inferred: true }`
- User types over the placeholder → user input wins, `inferred: false`
- User ignores → no amount persisted; §13 ranking treats this row as
  equal-weight

### 12.5 Acceptance

- [ ] `inferAmount` returns a structured object or documented sentinel
- [ ] Placeholder appears only when bowl has ≥ 2 amounts already
- [ ] User tap commits inferred amount with `inferred: true` flag
- [ ] No silent auto-fill — placeholder is visible before commit
- [ ] Fallback to `{ 1, each }` when `recipe_pairs.json` lacks amounts

---

## 13. Focal-weighted suggestions

DOCS-MAKE-MODE chef-user core ask (2026-05-27). Extends §8 suggestion
engine v2 with two new weighting axes: focal-primary, and proportional-
secondary across remaining bowl ingredients.

### 13.1 Contract

For each candidate ingredient `c`:

```
score(c) = base_npmi(c, focal) * W_FOCAL
         + Σ over each non-focal i in bowl:
              base_npmi(c, i) * W_SECONDARY * proportional_weight(i)
```

Constants:
- `W_FOCAL = 0.6`
- `W_SECONDARY = 0.4 / N_non_focal`
- `proportional_weight(i) = mass(i) / Σ mass(j) for all non-focal j`
- `mass(i) = amount.qty * UNIT_DENSITY[amount.unit]` (in grams)

If `mass(i)` is null (no amount entered), `proportional_weight(i) =
1 / N_non_focal` (equal-weight fallback). The fallback preserves
backward compatibility with bowls that have no amounts at all.

### 13.2 UNIT_DENSITY table

Conversion to grams. Stored as a const in `src/data/portionParser.js`:

| unit | density (g) | rationale |
|---|---|---|
| g, gram | 1 | identity |
| oz, ounce | 28.35 | mass conversion |
| lb, pound | 453.6 | mass conversion |
| tsp | 5 | volume → grams (water-equivalent) |
| tbsp | 15 | volume → grams |
| cup | 240 | volume → grams |
| ml | 1 | volume → grams (water-equivalent) |
| l, liter | 1000 | volume → grams |
| each, medium | 100 | nominal "1 thing" mass |
| small | 50 | nominal |
| large | 200 | nominal |
| pinch | 1 | trace |
| dash | 1 | trace |
| sprig | 2 | herb sprig |
| clove | 3 | garlic clove |
| handful | 30 | leafy greens scoop |
| to_taste | 1 | trace |

These densities are deliberately water-equivalent and approximate.
Exact conversions are out of scope; the goal is a sane proportional
ordering, not nutritional accuracy.

### 13.3 Focal flag

The bowl carries `bowl.focalKey: string | null`. Set via:
- Tap-and-hold on a notebook row → "Set as focal" menu (mobile)
- Right-click → "Set as focal" (desktop)
- Or: auto-focal at ranking time when `focalKey` is null — the
  highest-mass ingredient is treated as focal (not persisted)

### 13.4 Acceptance

- [ ] `suggestionRanker` reads `bowl.focalKey` and weights NPMI per §13.1
- [ ] Bowl with no focal flag and no amounts → equal-weight fallback
- [ ] Bowl with focal flag set → focal contributes 60% of the score
- [ ] Bowl with amounts but no focal → highest-mass ingredient acts
      as auto-focal at ranking time
- [ ] `UNIT_DENSITY` table covers all units in §11.2 parser
- [ ] Test fixture: 3-ingredient bowl with one focal yields different
      ranking than the same bowl with focal flag cleared

---

## 14. Food-category filter on suggestions

DOCS-MAKE-MODE deep-interview Round 6 (2026-05-27). Horizontal filter
pill row above the suggestion list scopes suggestions to a single
food category drawn from `ingredients.json.category`.

### 14.1 Filter pill row

Sticky at the top of the suggestion popout. Pills derive from the
distinct values of `ingredients.json.category` (chef-curated):

- Produce / Meat & Seafood / Dairy / Grains / Herbs & Spices /
  Pantry / Beverage / Dessert / Sweetener / Fat & Oil / Condiment /
  Other

Exact label set tracks the field's distinct values at load time; new
chef categories appear automatically without code change.

### 14.2 Behavior

- Default: no pill active → all categories shown
- Tap pill → suggestion list filters to that category
- Tap same pill again → deactivates (back to all)
- Tap different pill → switches single-select (no multi)
- Filter is local to the suggestion popout; doesn't persist across
  bowl mutations or session

### 14.3 Visual contract

- Pill row sticky at top of suggestion popout, horizontally scrollable
- Active pill: filled background with the BRISCIONE category color
  (or fallback `#94a3b8` slate)
- Inactive pill: outlined, label only, 8px padding
- Touch target: minimum 44×44px (a11y)

### 14.4 Acceptance

- [ ] Pills derive from `ingredients.json.category` distinct values
- [ ] Single-select semantics (no multi-pill)
- [ ] Filter does not mutate §13 ranking — only filters the result set
      AFTER ranking
- [ ] Test covers tap → filter → re-tap → unfilter sequence

---

## 15. Sauces + seasonings recommendations

DOCS-MAKE-MODE chef-user core ask (2026-05-27). Two sticky chip rows
below the suggestion popout: suggested sauces (sourced from existing
`sauce_augment.json`) and suggested seasonings (sourced from a NEW
`chemDataset/processed/seasonings.json` pipeline).

### 15.1 Sauce recommendations

Builds on existing `public/data/sauce_augment.json` (69 curated
sauces). For the current bowl, rank sauces by:
1. **Ingredient overlap** — count of bowl ingredients present in the
   sauce recipe; primary tie-break
2. **Aroma-match score** — `recipeAromaSimilarity.js` cosine sim
   between bowl + sauce aroma vectors (§7); secondary
3. **Recipe-type compatibility** — gated by §16 type. Main / Side →
   savory sauces (Béarnaise, Hollandaise, beurre blanc); Dessert →
   sweet sauces (caramel, crème anglaise); Drink → cocktail mixers

Surfaced as a sticky chip row labeled "Suggested sauces" below the
suggestion popout. Up to 5 chips, ordered by score descending.

### 15.2 Seasoning recommendations — NEW DATASET

Introduces `chemDataset/scripts/11-fetch-seasonings.js` and
`chemDataset/processed/seasonings.json`. Source: deep-interview
Round 3 picked "new chemDataset pipeline source"; the specific
upstream (TGSC seasoning catalog vs FlavorDB subset vs hand-curated)
is parked as §20 open question.

Schema (per entry):

```json
{
  "name": "black pepper",
  "category": "spice",
  "flavor_profile": ["pungent", "warm", "woody"],
  "pairing_score_function": "NPMI from recipe_pairs.json"
}
```

`category` enum: `'herb' | 'spice' | 'aromatic' | 'pungent' | 'salt'
| 'pepper' | 'finishing'`.

### 15.3 Seasoning ranking

Same NPMI math as §8 but restricted to the seasoning subset (rows
present in `seasonings.json`). Then filtered by §16 recipe-type
compatibility:
- Main / Side / Appetizer → savory categories
- Dessert → sweet finishing (e.g., cinnamon, cardamom, anise)
- Drink → cocktail-bitters / aromatic
- Sauce → all categories enabled

### 15.4 Acceptance

- [ ] `chemDataset/scripts/11-fetch-seasonings.js` exists; produces
      `chemDataset/processed/seasonings.json`
- [ ] Recipe Lab renders "Suggested sauces" + "Suggested seasonings"
      chip rows when bowl has ≥ 1 ingredient
- [ ] Sauces rank by overlap + aroma-match + recipe-type compatibility
- [ ] Seasonings rank by NPMI to §13 focal, filtered by recipe-type
- [ ] Recipe-type=Dessert hides savory seasonings; Recipe-type=Main
      hides sweet ones (compatibility gate)

---

## 16. Recipe-type classifier

DOCS-MAKE-MODE deep-interview Round 4 (2026-05-27). User-set radio
pill row. No auto-classification this round.

### 16.1 Bowl state

```
bowl.recipeType: 'main' | 'side' | 'appetizer' | 'dessert' |
                 'drink' | 'sauce' | 'other' | null
```

Default: `null` (no type chosen). Persists across handoff payloads
(Make picker / Cookbook seed recipes / Photo upload — see
MAKE-MODE-SPEC §6).

### 16.2 UI

Horizontal radio pill row above the notebook (below the mode tab
strip from §2.4):

`[ Main ] [ Side ] [ Appetizer ] [ Dessert ] [ Drink ] [ Sauce ] [ Other ]`

Single-select. Tap to set; tap same pill again to clear.

### 16.3 Downstream consumers

`recipeType` is read by:
- §12 auto-portion inference — median computed per recipe-type bucket
- §15 sauce + seasoning recommendations — compatibility filter
- Cookbook Lab (future) — browse/filter dimension when classifying
  user-saved recipes
- Future analysis surfaces — recipe-type-aware compatibility advice

### 16.4 No auto-inference (this round)

This spec round does NOT add auto-classification. User explicitly
picks the type. A future spec round may add auto-suggestion with
override (e.g., "this bowl looks like a Main — confirm?"). For now,
the user-set radio is the only source of truth.

### 16.5 Acceptance

- [ ] 7-pill radio row visible above the notebook in `RecipeLabMobile`
- [ ] Single-select semantics
- [ ] State persisted in bowl
- [ ] Round-trips through handoff: Make picker → Cookbook recipe →
      Recipe Lab preserves `recipeType` when the source recipe carries
      it
- [ ] §12 + §15 + future surfaces read `bowl.recipeType` correctly
      (null → fallback path)

---

"""

# Find the original §11 header (now renumbered to §17 by the substitution
# above). Insert NEW_SECTIONS right BEFORE "## 17. State ownership".
marker = "## 17. State ownership"
if marker not in text:
    raise SystemExit(f"ERROR: marker {marker!r} not found after renumber")
text = text.replace(marker, NEW_SECTIONS + marker, 1)

# 3) Update the TOC to insert the new entries (11-16) and renumber
#    the trailing entries.
OLD_TOC_BLOCK = """11. [State ownership](#11-state-ownership)
12. [Tests covering the contract](#12-tests-covering-the-contract)
13. [In-flight legacy routing vs canonical Build-path target](#13-in-flight-legacy-routing-vs-canonical-build-path-target)
14. [Open questions](#14-open-questions)
15. [Source spec lineage](#15-source-spec-lineage)"""
# After renumber the TOC numbers got bumped — find the bumped versions
# and replace with the new layout including 11-16 + 17-21.
NEW_TOC_BLOCK = """11. [Per-ingredient portion data model](#11-per-ingredient-portion-data-model)
12. [Auto-portion inference](#12-auto-portion-inference)
13. [Focal-weighted suggestions](#13-focal-weighted-suggestions)
14. [Food-category filter on suggestions](#14-food-category-filter-on-suggestions)
15. [Sauces + seasonings recommendations](#15-sauces--seasonings-recommendations)
16. [Recipe-type classifier](#16-recipe-type-classifier)
17. [State ownership](#17-state-ownership)
18. [Tests covering the contract](#18-tests-covering-the-contract)
19. [In-flight legacy routing vs canonical Build-path target](#19-in-flight-legacy-routing-vs-canonical-build-path-target)
20. [Open questions](#20-open-questions)
21. [Source spec lineage](#21-source-spec-lineage)"""

# After the §11→§17 renumber, the TOC block reads:
SHIFTED_TOC_BLOCK = """17. [State ownership](#17-state-ownership)
18. [Tests covering the contract](#18-tests-covering-the-contract)
19. [In-flight legacy routing vs canonical Build-path target](#19-in-flight-legacy-routing-vs-canonical-build-path-target)
20. [Open questions](#20-open-questions)
21. [Source spec lineage](#21-source-spec-lineage)"""

if SHIFTED_TOC_BLOCK not in text:
    raise SystemExit(f"ERROR: shifted TOC block not found.  Searched for:\n{SHIFTED_TOC_BLOCK!r}")
text = text.replace(SHIFTED_TOC_BLOCK, NEW_TOC_BLOCK, 1)

# Update header anchor in line 4 — already shifted from §15 → §21 by the
# §N\b substitution above.

SPEC.write_text(text, encoding="utf-8")
print(f"wrote {SPEC} ({len(text.splitlines())} lines)")
