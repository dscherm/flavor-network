# Canonical Recipe Lab Spec

> **Status**: Authoritative. Supersedes all prior specs, ralplans, and
> plan-document fragments listed in [§21 Source spec lineage](#21-source-spec-lineage).
> When this file disagrees with any other file in the repo, **this file wins**.
> Last revised 2026-05-27.

> **Scope**: The Recipe Lab notebook surface — `RecipeLab.jsx` /
> `RecipeLabMobile.jsx` and its 3-zone layout (aroma wheel, notebook,
> per-ingredient suggestion popout). Includes recipe scoring, layout,
> analysis, suggestion engine v2, the aroma-match bridge to Cocktail Lab
> and Sauce Lab, and the inbound handoff pipeline from Build, Network,
> Cocktail Lab, Sauce Lab, RecipesLab, and Profile.
>
> **Out of scope**: Cocktail Lab, Sauce Lab, and the Phase-4 `RecipesLab`
> 3D/grid browser are out of scope EXCEPT where they consume shared
> data artifacts (`cocktail_codex_v2.json`, `sauce_augment.json`,
> `recipe_pairs.json`) or share the aroma-match bridge. The 3D Network,
> α-mode, and IngredientPanel live in `NETWORK-AND-AFFINITY-SPEC.md`.

> **How to use this document**: each section is a self-contained
> contract. Source spec citations live at the end; you do not need to
> read the source specs to implement the feature. Where the shipped
> code and a planned target differ, the divergence is called out
> inline with a "Current" / "Canonical (Phase 5 Build-path)" pair.

---

## Table of Contents

1. [Information architecture](#1-information-architecture)
2. [3-zone layout](#2-3-zone-layout)
3. [Notebook canvas (hand-drawn aesthetic)](#3-notebook-canvas-hand-drawn-aesthetic)
4. [Recipe scoring](#4-recipe-scoring)
5. [Recipe layout (radial force-directed 2D)](#5-recipe-layout-radial-force-directed-2d)
6. [Recipe analysis](#6-recipe-analysis)
7. [Aroma-match bridge](#7-aroma-match-bridge)
8. [Suggestion engine v2](#8-suggestion-engine-v2)
9. [Handoff pipeline](#9-handoff-pipeline)
10. [Data contracts](#10-data-contracts)
11. [Per-ingredient portion data model](#11-per-ingredient-portion-data-model)
12. [Auto-portion inference](#12-auto-portion-inference)
13. [Focal-weighted suggestions](#13-focal-weighted-suggestions)
14. [Food-category filter on suggestions](#14-food-category-filter-on-suggestions)
15. [Sauces + seasonings recommendations](#15-sauces--seasonings-recommendations)
16. [Recipe-type classifier](#16-recipe-type-classifier)
17. [State ownership](#17-state-ownership)
18. [Tests covering the contract](#18-tests-covering-the-contract)
19. [In-flight legacy routing vs canonical Build-path target](#19-in-flight-legacy-routing-vs-canonical-build-path-target)
20. [Open questions](#20-open-questions)
21. [Source spec lineage](#21-source-spec-lineage)

---

## 1. Information architecture

### 1.1 Mount point

`RecipeLab.jsx` is a **thin alias** that forwards every prop to
`RecipeLabMobile.jsx`. Web and iOS share the same layout — the
historical `isMobile` prop is accepted but ignored. All real behavior
lives in `RecipeLabMobile`.

### 1.2 Routing — Current (in-flight legacy)

`App.jsx` carries a flat `activeTab` enum. Recipe Lab is reached when
`activeTab === 'recipe'` AND `recipeMounted === true` (lazy-mount
latch). The Build-flow callback in `App.jsx` engages this path via:

```js
onOpenLab(labKey, externalFilter) {
  if (labKey === 'notebook') {           // ← current key
    setRecipeHandoff({ ingredients, mode: 'recipe', ts: Date.now() });
    setRecipeMounted(true);
    setActiveTab('recipe');
  }
}
```

The Recipe Lab is also reachable as a top-level tab via
`?tab=recipe` URLs, by direct Build → Recipe Notebook handoff, and by
Cocktail/Sauce/Network/RecipesLab/Profile handoff buttons.

### 1.3 Routing — Canonical (Phase 5 Build-path target, chef-decision 2026-05-27)

The target topology — to which §1.2 will migrate — is a 2-level mode
state:

```js
{ topLevel: 'explore' | 'guided' | 'build',
  subLevel: 'network' | 'cocktail' | 'sauce' | 'recipes' | 'recipe-notebook' | null }
```

Recipe Lab lives at `topLevel === 'build'` AND `subLevel === 'recipe-notebook'`.
The Build flow's `onOpenLab` switch case becomes:

```js
if (labKey === 'recipe-notebook') {
  setRecipeHandoff({ ingredients, mode: 'recipe', ts: Date.now() });
  setTopLevel('build');
  setSubLevel('recipe-notebook');
}
```

URL alias contract: legacy `?tab=recipe` redirects to
`?path=build&sub=recipe-notebook`. The `labKey === 'notebook'` value is
deprecated and removed after migration.

### 1.4 Lazy-mount

The component is lazy-mounted via the `recipeMounted` latch — first
arrival mounts the DOM subtree, subsequent navigations only toggle
opacity. State (bowl, title, mode, focused-ingredient) persists across
tab switches until the user explicitly clears it or a new handoff
replaces it (§9).

### 1.5 Acceptance

- [ ] `RecipeLab.jsx` forwards 100% of props to `RecipeLabMobile.jsx` and renders nothing of its own.
- [ ] Recipe Lab mounts once per session and persists state across tab switches.
- [ ] Legacy `labKey === 'notebook'` and canonical `labKey === 'recipe-notebook'` both resolve to the same Recipe Lab component (during the migration window).
- [ ] `?tab=recipe` URL parameter continues to work until the Phase 5 router migration ships.

---

## 2. 3-zone layout

`RecipeLabMobile.jsx` renders a fixed-position three-zone layout on a
notebook-paper background (`#fefae0`). Above the zones sit a top
action bar (Save/Clear), a Mode tab strip (General / Cocktail / Sauce),
a Search bar, and an optional handoff toast.

### 2.1 Zone 1 — Aroma Profile / Suggestion Popout (top)

Sticky region. Renders one of three children, mutually exclusive:

| State | Renders | Trigger |
|---|---|---|
| Default | `<RecipeFlavorWheel>` (axis-switchable radar) | bowl ≥ 0 ingredients and no popout open |
| Per-ingredient suggestions | `<IngredientSuggestionsPopout ingredient={focusedIngredient} ...>` | user taps the **R** pill on a notebook row |
| Bowl-wide suggestions | `<IngredientSuggestionsPopout ingredient={null} ...>` | user taps the **Suggestions…** row at the end of the notebook |

The Aroma Profile and Suggestion Popout are exclusive — they share the
same screen real estate so only one is visible at a time. Closing a
popout (`onClose`) restores the radar.

### 2.2 Zone 2 — Recipe Notebook (middle, scrollable)

Renders `<RecipeNotebook>` (§3.4). Scrolls under the sticky zone-1.
Owns the title input, the ingredient rows, the **+ Add ingredient…**
row, the **Suggestions…** row, the **Find a Cocktail / Need a Sauce**
aroma-match pills (§7), and the live Compatibility readout.

### 2.3 Zone 3 — Suggestion Drawer (REMOVED 2026-05-07)

The legacy bottom-up `<SuggestionDrawer>` was eliminated per chef
decision 2026-05-07. The per-ingredient `<IngredientSuggestionsPopout>`
in zone 1 is now the only suggestion surface in the Recipe Lab. The
`drawerSnap` state (`'peek' | 'half' | 'full'`) survives in
`RecipeLabMobile` because handoff payloads still set it to drive
post-handoff focus, but no drawer renders.

### 2.3a Axis vocabulary (canonical — 2026-05-29)

`<RecipeFlavorWheel>` (and every other axis-switchable surface in
the app) pulls its label list from `briscionePalette.axisOrder()`.
The chef-canonical vocab is:

| Axis | Count | Labels |
|---|---|---|
| `taste`  | 8  | sweet, sour, bitter, salty, spicy, pungent, astringent, umami |
| `aroma`  | 13 | citrus, fruity, floral, herbal, green, creamy, woody, earthy, roasted, caramel, fermented, marine, pungent |

For aroma, only 5 labels have a GNN head (fruity, floral, green,
woody, creamy) — the mapping lives in `AROMA_LABEL_TO_GNN_KEY` in
`briscionePalette.js` (note: `creamy` → `odor_fatty` data column
since the chef-vocab rename 2026-05-27 kept the legacy column
name). The remaining 8 chef-only aromas (citrus, herbal, earthy,
roasted, caramel, fermented, marine, pungent) surface only when
the chef-curated `flavor_graph.tier1` carries the label; on
GNN-only ingredients these axes appear as zero-value spokes.

Single source of truth: `src/data/briscionePalette.js`. Wheels
that hardcode their own keysets are tracked under
`RL-AXIS-VOCAB-WEDGEGRID` (deferred — needs visual A/B for the
6→13 sector expansion in the Briscione donut).

### 2.4 Mode tab strip

Below the top action bar, full-width: `General` (taste) / `Cocktail` /
`Sauce`. Tapping a mode:

- Sets `labMode ∈ {'taste', 'cocktail', 'sauce'}`.
- Clears `selectedStructure` (§6.4).
- Loads `getCocktailScope()` / `getSauceScope()` and the role-map for
  the active scope (cocktail = `getCocktailRoles()`, sauce = `getSauceRoles()`).
- Filters the in-lab ingredient list and the Fuse.js search index to
  ingredients in the active scope. `General` mode uses the full
  ProData ingredient list.

A handoff payload with `mode: 'cocktail'` or `mode: 'sauce'` forces
the lab mode to the matching tab (§9).

### 2.5 Acceptance

- [ ] Zone 1 is sticky; zone 2 scrolls beneath it.
- [ ] Tapping an R pill swaps zone 1 to the per-ingredient popout and collapses any drawer state to `'peek'`.
- [ ] Tapping the Suggestions… row swaps zone 1 to the bowl-wide popout.
- [ ] Closing either popout (`onClose`) returns zone 1 to `<RecipeFlavorWheel>`.
- [ ] Mode tab change clears `selectedStructure` and re-filters the search index.

---

## 3. Notebook canvas (hand-drawn aesthetic)

### 3.1 Two renderers — RecipeNotebook (shipped) and NotebookCanvas (legacy)

There are **two** notebook surfaces in the codebase:

| Renderer | Substrate | Status | Used by |
|---|---|---|---|
| `<RecipeNotebook>` | HTML/CSS (DOM rows on a CSS-painted ruled page) | **Shipped** in the current Recipe Lab | `RecipeLabMobile.jsx` zone 2 |
| `<NotebookCanvas>` | Canvas 2D — pencil-rendered radial graph | **Legacy**, not mounted by the current Recipe Lab | Reserved; may render via a desktop-mode reintroduction or removal — see §20 Open Questions |

The shipped UX is the DOM RecipeNotebook. The Canvas 2D NotebookCanvas
remains in the repo for the **glyph rules and pencil aesthetic spec
of record** (this section §3.2-§3.3 documents it).

### 3.2 Hand-drawn aesthetic (NotebookCanvas glyph rules)

`NotebookCanvas.jsx` renders the Canvas 2D variant with these
invariants (also adopted in spirit by RecipeNotebook's CSS styling):

- **Background**: paper `#fefae0`, repeating-linear-gradient ruled
  lines every 28px at `#c9b99a`, red margin line at x=60 at `#e07070`.
- **Font**: `Caveat, cursive` everywhere. No system fonts.
- **Strokes**: jittered "wobbly" line (8-segment perturbation, ±1.8px)
  for any focal→pairing connection; flat smooth strokes for ruled
  lines.
- **Pencil-color fill**: `pencilColor(hex, amount)` desaturates a base
  color toward its luminance, simulating colored-pencil grain.

### 3.3 Glyph rules

NotebookCanvas glyph contract:

| Glyph | Used for | Shape | Source of color |
|---|---|---|---|
| Rhombus (diamond) | Center ingredient | 4-point diamond, half-diagonal 36px | Taste-blended fill (§3.4) at desaturation `0.2` |
| Star (5-point) | Strong pairing (`strength ≥ STAR_THRESHOLD = 0.22`) | Outer 26px, inner ratio 0.45 | `TASTE_COLORS[dominantTaste]` at desaturation `0.25` (in-recipe) or `0.5` (out-of-recipe) |
| Oval | Weak pairing (`strength < 0.22`) | Ellipse fitted to label width + 16px x-pad + 10px y-pad | Same taste-color mapping as star |
| Axis line | 8 radial axes from center | Dashed `[4, 6]`, color `rgba(160,140,110,0.18)` | n/a |

Axis labels per `labMode`:

| `labMode` | 8 axis labels |
|---|---|
| `taste` | sweet, salty, sour, bitter, umami, spicy, pungent, astringent (from `TASTE_KEYS`) |
| `cocktail` | Spirit-forward, Dry, Short, Concentrated, Modified, Sweet, Long, Diluted |
| `sauce` | Light, Thin, Mild, Subtle, Rich, Heavy, Bold, Intense |

### 3.4 Taste blending (center node color)

`blendTasteColor(name, node)` produces the center rhombus's fill:

```
let { channels } = scoreIngredient(name, node);   // 8-channel weights
// Convert TASTE_COLORS hex per channel to RGB, sum weighted channel-by-channel:
r = Σ (channel_weight × TASTE_COLORS[channel].r)
// Same for g, b; divide by Σ channel_weight.
// Returns 'rgb(r,g,b)' or fallback '#d4c8a0' when no channels fire.
```

`TASTE_COLORS` is locked from `src/utils/color.js` and the same palette
the 3D Network uses. The shipped DOM `<RecipeNotebook>` uses the
**dominant** taste color (highest channel) as a 3px left accent and
an 8px taste-color glyph, not a full blend — blending is reserved for
the Canvas 2D renderer.

### 3.5 Acceptance

- [ ] Paper background `#fefae0` and Caveat font appear everywhere in zone 2.
- [ ] DOM RecipeNotebook center row uses a rotated-45° square glyph; other rows use a circle.
- [ ] `NotebookCanvas` (when invoked) renders rhombus / star / oval glyphs per §3.3.
- [ ] No system fonts (Helvetica, Arial, etc.) appear in any Recipe Lab surface.

---

## 4. Recipe scoring

### 4.1 GNN inputs (per ingredient)

Each ingredient node provides:

- `node.taste` — whitespace-joined taste string from ProData (e.g., `"sweet sour"`)
- `node.gnnProbs` — 11-head GNN probability map keyed by `sweet`, `sour`,
  `bitter`, `umami`, `salty`, `odor_fruity`, `odor_floral`, `odor_green`,
  `odor_woody`, `odor_spicy`, `odor_fatty` (per
  `.claude/.chemdataset-status.md`).
- `node.gnnProbsSource` — `'direct'` (native GNN row) or `'compound'`
  (synthesized from constituent ingredients via `compoundFoods.js`).

### 4.2 `scoreRecipe(ingredients)` — taste-axis aggregator

Source: `src/data/recipeScoring.js`.

Pipeline:

1. For each ingredient, prefer `gnnProbs` (5 taste heads) over
   `tasteStringToVector(node.taste)` fallback. Increment `gnnCount`
   when the GNN path is used.
2. Sum 5-D vectors across all ingredients → `agg`.
3. Normalize so `Σ profile = 1`.
4. Compute outputs.

Outputs:

| Field | Type | Definition |
|---|---|---|
| `balance` | `[0, 1]` | `max(0, 1 − variance(profile) / maxVar)`, where `maxVar = (1 − 1/5) × (1/5)`. Higher = more evenly spread. |
| `coverage` | `[0, 1]` | Fraction of the 5 taste axes whose capped contribution `min(1, agg[i] / N)` clears `PRESENT_THRESHOLD = 0.3`. |
| `profile` | `number[5]` | Normalized taste distribution (sweet, bitter, umami, salty, sour). |
| `dominantTastes` | `string[]` | Tastes sorted descending by profile share, zeros dropped. |
| `confidence` | `[0, 1]` | `gnnCount / ingredients.length` — how many ingredients used the GNN path vs the string fallback. |

`verdictForScore(score)` returns a human-readable string:

- `balance > 0.75 && coverage ≥ 0.6` → "Well-balanced across tastes"
- `balance > 0.5 && coverage ≥ 0.4` → "Moderately balanced"
- `coverage < 0.2` → "Monotone — dominated by `<dominantTaste>`"
- else → "Uneven — try adding a contrasting taste"

### 4.3 `scoreRecipeAroma(ingredients)` — aroma-profile aggregator

Same module. Operates over 6 calibrated aroma heads:
`odor_fruity, odor_floral, odor_green, odor_woody, odor_spicy, odor_fatty`.

Key difference from §4.2: **reports a profile, not a balance score.**
Food-pairing theory says aroma OVERLAP (not diversity) predicts good
pairings, so a single balance number would be misleading.

Outputs:

| Field | Type | Definition |
|---|---|---|
| `profile` | `number[6]` | Normalized aroma distribution; zero-magnitude → zeros. |
| `dominantAromas` | `string[]` | Sorted, non-zero entries. |
| `confidence` | `[0, 1]` | `gnnCount / ingredients.length`. |
| `hasSignal` | `boolean` | `total > 0`. |
| `compoundCount` | `number` | Count of ingredients with `gnnProbsSource === 'compound'`. |
| `compoundNames` | `string[]` | Names of those compound-food ingredients (drives the "Predicted from Components" badge in the aroma wheel). |

`AROMA_LABELS` and `AROMA_COLORS` (also exported) provide the human
labels and palette for any UI consumer.

### 4.4 Compatibility readout (notebook footer)

`RecipeNotebook` renders `Compatibility: <pct>%` when `ingredients.length ≥ 2`.
The percentage = average pairwise edge strength over all `C(N, 2)`
pairs in the bowl, computed via `getNeighborsEnriched(name, edges,
cuisineNeighborIndex)`. Cuisine-anchored pairs use the larger of
`strength` or `cuisineStrength`.

`RecipePanel` (the desktop-style sidebar; legacy code-path) renders
the same compatibility number plus a width-`compatibility%` progress bar
colored green (>60) / amber (>30) / red (≤30).

### 4.5 Acceptance

- [ ] `scoreRecipe([])` returns `{ balance:0, coverage:0, profile:[0,0,0,0,0], dominantTastes:[], confidence:0 }`.
- [ ] Adding one strong-umami ingredient yields `balance < 0.25` and `coverage = 0.2`.
- [ ] A 5-ingredient bowl with each ingredient dominating a different taste yields `balance > 0.9` and `coverage ≥ 0.8`.
- [ ] `scoreRecipeAroma` returns `hasSignal = false` and zero `profile` when no ingredient has `gnnProbs`.
- [ ] `confidence` strictly equals `gnnCount / ingredients.length` for both scorers.
- [ ] Compatibility readout matches `mean(strength)` over all `C(N, 2)` pairs (rounded to integer percent).

---

## 5. Recipe layout (radial force-directed 2D)

Source: `src/data/recipeLayout.js` (consumed by `NotebookCanvas`).

### 5.1 Inputs

```
computeRadialLayout(centerName, pairings, nodes, radius = 340)
```

`pairings` = `[{ name, strength }]` for the center ingredient's neighbors
(post-filter, pre-cap).

### 5.2 Pre-filter

- Drop **techniques** (`isTechnique(name)`) — matches `/^(grill pan|grill|...)$/` plus a non-food regex (cooking spray, foil, parchment, etc.).
- Cap to `MAX_PAIRINGS = 60`.

`extractTechniques(pairings)` is the complementary getter for the
"Common Techniques" chip strip in `<RecipePanel>`.

### 5.3 Group by dominant taste

For each remaining pairing, run `scoreIngredient(name, node)`; pick the
channel with the highest weight; group by that channel into 8 buckets
keyed to `TASTE_AXES_2D`:

| Taste | Angle (radians) |
|---|---|
| sweet | 0 |
| salty | π × 0.25 |
| sour | π × 0.5 |
| bitter | π × 0.75 |
| umami | π |
| spicy | π × 1.25 |
| pungent | π × 1.5 |
| astringent | π × 1.75 |

### 5.4 Initial placement (per taste bucket)

For each bucket:

1. Sort items by `strength` desc.
2. `arcHalf = π/12 + items.length × 0.035` (wider arc when bucket is crowded).
3. For each `i`, compute `arcOffset = arcHalf × 2 × (i / (n-1) − 0.5)`.
4. `baseDist = radius × (0.3 + 0.7 × (1 − strength))` — stronger pairs sit closer.
5. `stagger = (i % 3) × 20` — alternate three concentric rings to reduce initial clumping.
6. `(x, y) = (cos(baseAngle + arcOffset) × (baseDist + stagger), sin(...) × ...)`.

### 5.5 Force-directed repulsion (overlap resolver)

Loop up to **80 iterations**, exit when `maxOverlap < 1`:

- **Center clearance**: every node pushed outward to `CENTER_CLEAR = 55 + max(hw, hh)`.
- **Pairwise**: for every `(i, j)` pair, compute AABB overlap on
  `(hw, hh)` bounds. Push each node by `overlapAxis × wRatio × 0.52` in
  the appropriate direction (weighted so the larger overlap axis
  receives the smaller fraction — avoids oscillation).

Bounds:

- **Star nodes** (strong pairings): `hw = hh = STAR_OUTER + NODE_GAP = 32`.
- **Oval nodes** (weak pairings): `hw = textWidth/2 + 16 + 6`, `hh = fontSize/2 + 10 + 6`.

### 5.6 Output

`Map<name, { x, y, dominantTaste, strength }>` consumed by
`NotebookCanvas` for both the wobbly line drawing and the
star/oval/text rendering.

### 5.7 Acceptance

- [ ] Techniques (`grill pan`, `cooking spray`, ...) never appear in the layout.
- [ ] No two layout nodes overlap after 80 iterations (or layout exits early with `maxOverlap < 1`).
- [ ] Star nodes (strength ≥ 0.22) cluster on the dominant-taste axis, not at the center.
- [ ] The center clearance ring (55px + node radius) is empty of pairing nodes.

---

## 6. Recipe analysis

### 6.1 Entry trigger

`<RecipePanel>` renders an "Analyze ▾" toggle when
`ingredients.length ≥ 3`. Expanding it calls
`analyzeRecipe(ingredients, nodes, edges, labMode, selectedStructure, cuisineNeighborIndex)`
from `src/data/recipeAnalysis.js`. Below 3 ingredients the analyzer
returns `null` and the section is hidden.

`<RecipeAnalysis>` is the presentational component that renders the
four collapsible sections.

### 6.2 Sections (in render order)

**1. What's Interesting** (`✨`, default open):
- Pairs with `strength > median(allPairStrengths)`.
- Pair endpoints must be in **different non-`other` categories**.
- Rendered as `<StrengthBadge> <a> + <b> <reason>` rows.
- Truncated to top 6.

**2. Watch Out** (`⚠`):
- For each ingredient, compute its `avg(strength to each other in bowl)`.
- Flag when `avg < 0.05` or any pair strength is exactly 0.
- Reason copy: `"<ing> has weak connection to <weakestPair[1]> (<pct>%)"`.

**3. Try Adding** (`+`):
- Candidate pool = neighbors of every bowl ingredient with at least 2
  edges into the bowl AND not already in the bowl.
- Score = average edge strength into the bowl.
- Top 5.

**4. Consider Swapping** (`⇄`):
- Only fires when at least one Watch-Out ingredient exists.
- For the weakest Watch-Out ingredient W, for each candidate C from the
  Try-Adding pool, compute `swapAvg = mean(strength(C, r) for r in
  bowl \ {W})`. Keep candidates where `swapAvg > currentAvg`.
- Top 3 by improvement (rounded to integer percent).

**5. Structure Advice** (`🎯`, cocktail/sauce modes only):
- Calls `scoreStructures(ingredients, nodes, labMode)`.
- When `selectedStructure` is set → shows adherence percent + missing
  elements.
- Otherwise when `bestMatch.confidence ≥ 30` → shows
  "Starting to look like a `<name>`..." progressive hint.

### 6.3 Cuisine-anchored pair strength

`getPairStrength(a, b, adjMap, cuisineNeighborIndex)` returns
`max(strength(a, b), cuisineStrength(a, b))` when a `cuisineNeighborIndex`
entry exists. This lets cuisine-foundational pairs (e.g., garlic +
olive oil in Italian) participate in interestingness scoring even when
their NPMI strength is low.

### 6.4 Structure scoring (cocktail / sauce modes)

`<RecipePanel>` renders structure scoring INDEPENDENTLY of the
collapsible Analyze panel, beneath the ingredient list. Behavior:

- For `labMode === 'taste'` → hidden.
- For `cocktail` / `sauce` → `scoreStructures(ingredients, nodes, labMode)`
  returns `[{ key, name, confidence, missing }, ...]` sorted desc.
- The user-selected structure shows an adherence bar + missing chips.
- If the user has NOT selected a structure and `best.confidence ≥ 40`,
  the "Starting to look like a `<name>`..." hint renders (turns into
  "This is a `<name>`!" at ≥ 70%).

### 6.5 Acceptance

- [ ] `analyzeRecipe(bowl, ...)` returns `null` when `bowl.length < 3`.
- [ ] Interesting pairs are cross-category and above-median; never same-category and never `other`-category.
- [ ] Watch-Out fires for any ingredient whose mean bowl-strength is < 0.05.
- [ ] Swap suggestions sort by improvement, top 3.
- [ ] Structure Advice section is hidden in `taste` mode.
- [ ] Cuisine-anchored pair strength prefers `cuisineStrength` when greater than `strength`.

---

## 7. Aroma-match bridge

### 7.1 Pills

`<RecipeNotebook>` renders two pill buttons after the Suggestions row
when `ingredients.length > 0`:

- **🍸 Find a Cocktail to serve with this recipe** — fires `onFindCocktail(recipeIngredients, recipeTitle)`.
- **🥣 Need a sauce for this recipe?** — fires `onFindSauce(...)`.

The pills render at reduced opacity with a "Need at least one
ingredient with flavor data" tooltip when `aromaDisabled === true`
(see §7.4). They never hide entirely — feature stays discoverable.

### 7.2 6-dim aroma cosine similarity

Source: `src/data/recipeAromaSimilarity.js`. Pure functions:

| Export | Signature | Behavior |
|---|---|---|
| `AROMA_KEYS` | `string[6]` | `['odor_fruity', 'odor_floral', 'odor_green', 'odor_woody', 'odor_spicy', 'odor_fatty']` — locked. |
| `computeRecipeAroma(names, ingredientsData)` | → `number[6] \| null` | Mean of GNN aroma vectors across ingredients with data; null when zero ingredients have data. |
| `cosineSim(a, b)` | → `[0, 1]` | Standard cosine over non-negative vectors; returns 0 when either magnitude is zero. |
| `topAromaOverlap(recipeVec, itemVec, k=2)` | → `string[k]` | Aroma keys with the largest element-wise products (> 0). |
| `rankByAromaSimilarity(recipeVec, items, ingredientsData, topN=8)` | → `[{ item, similarity, matchedAromas }]` | Cosine-sorted, top-8. |
| `formatSimilarityBadge(similarity)` | → `"XX% match"` | Cosine is already in `[0, 1]`. |

### 7.3 Handler wiring (App.jsx)

`handleFindCocktail`:

1. `nodesObj = Object.fromEntries(data.graph.nodes)`.
2. `recipeVec = computeRecipeAroma(recipeIngredients, nodesObj)` — bail if null.
3. `fetch('${BASE_URL}data/cocktail_codex_v2.json')`.
4. Normalize each cocktail to `{ ...c, ingredients: string[] }` by
   flattening `ingredients_raw`.
5. `ranked = rankByAromaSimilarity(recipeVec, items, nodesObj, 8)`.
6. `setMatchesContext({ recipeName, items: ranked })`.
7. `setCocktailMounted(true)` + `setActiveTab('cocktail')`.

`handleFindSauce` is the same flow against `sauce_augment.json` with
`s.ingredients` already an array of `{ name, measure }` objects (the
normalizer flattens to `string[]`).

### 7.4 `aromaDisabled` derivation

In `RecipeLabMobile`:

```js
const aromaDisabled = useMemo(() => {
  if (!fullData?.graph?.nodes || recipeIngredients.length === 0) return true;
  const nodesObj = Object.fromEntries(fullData.graph.nodes);
  return computeRecipeAroma(recipeIngredients, nodesObj) === null;
}, [recipeIngredients, fullData?.graph?.nodes]);
```

### 7.5 Sister-lab consumption

The destination lab (Cocktail Lab or Sauce Lab) consumes `matchesContext`
via the `matchesContext` prop and renders the ranked list as its
primary content. The aroma-match flow is one-way: navigating back to
Recipe Lab does NOT alter the bowl. `onExitMatches` clears
`matchesContext` and restores the destination lab's default view.

### 7.6 Acceptance

- [ ] `<RecipeNotebook>` renders both pills when `ingredients.length > 0`.
- [ ] Pills render disabled but visible when `aromaDisabled === true`.
- [ ] `handleFindCocktail` / `handleFindSauce` set `matchesContext` and navigate to the destination lab; they do NOT mutate the Recipe Lab bowl.
- [ ] Network failure on the destination fetch is swallowed silently (pills stay active).
- [ ] `cosineSim` returns 0 when either vector has zero magnitude.

---

## 8. Suggestion engine v2

### 8.1 Recipe-level co-occurrence ranker

Source: `src/data/recipeSuggestionEngine.js`. Replaced the legacy
"average pairwise NPMI strength" ranker.

Score per candidate `c`:

```
score(c) = Σ_{s ∈ bowl} log1p(count(s, c))   if globalCount(c) ≥ FAMILIARITY_FLOOR
           dropped                             otherwise
```

Where:

- `count(s, c)` = number of RecipeNLG recipes containing both `s` and `c`.
- `globalCount(c)` = recipe-frequency of `c` across the whole RecipeNLG
  corpus — used **only as a hard gate**, not a multiplier. Multiplying
  by familiarity makes every bowl converge on the global popular
  ingredients (sugar / onion / garlic / butter); a floor prevents
  obscure-but-tightly-paired noise without flattening the ranking.
- `FAMILIARITY_FLOOR = 50` (matches `proDataset/config.js:MIN_INGREDIENT_RECIPES`).

### 8.2 Empty bowl

When the bowl is empty, fall back to global popularity: sort all
ingredients by `globalCount` descending, take top `K = 100`,
max-normalize to `[0, 1]` strength.

### 8.3 Output shape

`[{ name: string, strength: number }]` with `strength ∈ [0, 1]`
(max-normalized within the result set). Truncated to `K = 100`.
This output shape matches what the legacy ranker emitted so the UI's
`matchPct` rendering continues to work without changes.

### 8.4 Consumers

`<IngredientSuggestionsPopout>` (the only suggestion surface as of
2026-05-07) consumes the ranker for both the per-ingredient replace
flow (focal = R-pilled ingredient) and the bowl-wide add flow (focal
= null, ranking by bowl co-occurrence).

### 8.5 Data dependency

`recipe_pairs.json` (in `public/proDataset/`) — see §10.1.

### 8.6 Information-theoretic suggestion engine (deferred)

The Wordle-inspired phase-shifting engine with reductive/coherent/
predictive scoring, per-user prior, and split safe/wildcard slots
(`.omc/specs/deep-interview-recipe-info-theory.md`) was specified to
high clarity (~7% ambiguity) but **never shipped** to the current
Recipe Lab. The shipped engine is the recipe-level co-occurrence
ranker described in §8.1-§8.4. The info-theory engine remains a
candidate v3 design; see §20 Open Questions.

### 8.7 Acceptance

- [ ] Empty bowl → returns up to 100 globally-popular ingredients ranked by `globalCount`.
- [ ] Non-empty bowl → ranks candidates by `Σ log1p(count)` with `globalCount(c) ≥ 50` as a hard gate.
- [ ] Ingredients already in the bowl never appear in the result.
- [ ] Strengths are max-normalized to `[0, 1]` within each call.
- [ ] Output truncated to `K = 100`.

---

## 9. Handoff pipeline

### 9.1 Six entry points, all REPLACE the bowl

Every payload carries a `source` string so downstream consumers (the
handoff watcher, telemetry, and the upcoming Make mode) can branch on
origin without inferring it from `mode`. The six current sources are
`'network' | 'build' | 'cocktail' | 'sauce' | 'profile' | 'cookbook'`.
Make-mode payloads use the `make-*` prefix (`'make-scratch'`,
`'make-photo'`, `'make-existing'`) and are governed by the §9.2
bypass clause below.

| Source value | App.jsx callback | Payload mode |
|---|---|---|
| `'build'` | Build → Recipe Notebook (`onOpenLab('notebook' \| 'recipe-notebook', ...)`) → `setRecipeHandoff({ source: 'build', ingredients, mode: 'recipe', ts })` | `'recipe'` |
| `'network'` | Network "Build Recipe" CTA (IngredientPanel `onBuildRecipe`) → `setRecipeHandoff({ source: 'network', ingredients: [...selectedNodes], mode: null, ts })` | `null` (→ taste mode) |
| `'cocktail'` | Cocktail Lab "Open in Recipe Lab" (`onOpenRecipeLab(mode, ings)`) → `setRecipeHandoff({ source: 'cocktail', ingredients, mode: 'cocktail', ts })` | `'cocktail'` |
| `'sauce'` | Sauce Lab "Open in Recipe Lab" (`onOpenRecipeLab(mode, ings)`) → `setRecipeHandoff({ source: 'sauce', ingredients, mode: 'sauce', ts })` | `'sauce'` |
| `'profile'` | Profile "Load Recipe" (`onLoadRecipe(recipe)`) → `setRecipeHandoff({ source: 'profile', ingredients, mode: 'recipe', ts, title })` | `'recipe'` |
| `'cookbook'` | CookbookLab "Open in Recipe Notebook" (`onOpenRecipeLab(_mode, ingredients)`) → `setRecipeHandoff({ source: 'cookbook', ingredients, mode: 'recipe', ts })` | `'recipe'` |

### 9.2 Handoff watcher

`RecipeLabMobile` runs a one-shot effect keyed on `handoff?.ts`:

```js
useEffect(() => {
  if (!handoff || !handoff.ts) return;
  const incoming = bowlFromIngredients(handoff.ingredients);
  const isMake = typeof handoff.source === 'string' && handoff.source.startsWith('make-');
  // Empty-bowl bypass: Make-mode entry points (source: 'make-scratch',
  // 'make-photo', 'make-existing') intentionally hand off an empty bowl
  // so the user starts on a blank notebook. All other sources still
  // early-return on empty payloads — there is no useful "load 0
  // ingredients from cocktail" state for the existing entry points.
  if (incoming.length === 0 && !isMake) return;
  setRecipeIngredients(prev => {
    const cleared = prev.length;
    const msg = cleared > 0
      ? `Loaded ${incoming.length} ingredients from <source><title> — previous ${cleared} cleared`
      : `Loaded ${incoming.length} ingredients from <source><title>`;
    setHandoffToast(msg);
    return incoming;     // REPLACES, never appends
  });
  setCenterIngredient(incoming[0]);
  setRecipeTitle(handoff.title || '');
  setSelectedStructure(null);
  setActiveTab('all');
  setDrawerSnap('half');
  if (handoff.mode === 'cocktail') setLabMode('cocktail');
  else if (handoff.mode === 'sauce') setLabMode('sauce');
  else setLabMode('taste');
}, [handoff?.ts]);
```

Invariants:

- **Replace, never append.** Fixes the bug where exploring cocktails /
  sauces / network selections silently piled extra ingredients onto an
  in-progress recipe.
- `handoff.ts` is the unique key — re-firing the same payload requires a
  new timestamp.
- `initialIngredients` (prop) is the FIRST-MOUNT seed only; post-mount
  the bowl is controlled exclusively by user actions + handoff events.

### 9.3 Toast confirmation

The toast renders top-center for 2500ms with a notebook-styled bubble.
Copy: `Loaded N ingredients from <source><title>[ — previous M cleared]`.
Sources are `'recipe' | 'cocktail' | 'sauce'`. Auto-clears via
`setTimeout`. Also fires from the in-lab Save button: `Saved "<title>" to profile`.

### 9.4 Center ingredient seeding

The handoff's first ingredient becomes the new `centerIngredient`. The
`recipeTitle` is taken from `handoff.title` when present (Profile path
and Save flow), otherwise cleared to empty.

### 9.5 Mode coercion

`handoff.mode` coerces `labMode` for the cocktail and sauce cases so
the Mode tab strip, the scope filter, and the role-aware suggestions
all line up with the user's mental context. `mode: null` and
`mode: 'recipe'` resolve to `labMode = 'taste'`.

### 9.6 Acceptance

- [ ] Every handoff REPLACES the bowl; no handoff appends.
- [ ] Toast renders within 240ms of the handoff and dismisses within 2500ms.
- [ ] When the toast reports a clear count, it equals the bowl size at the moment of replacement.
- [ ] `handoff.mode === 'cocktail'` switches the Mode tab to Cocktail; `'sauce'` switches to Sauce.
- [ ] Re-firing the same `handoff.ts` does NOT re-execute the watcher.

---

## 10. Data contracts

Recipe Lab consumes the following artifacts from `public/`. Each
schema below is the **exact contract Recipe Lab depends on**; the
upstream pipelines may include additional fields.

### 10.1 `public/proDataset/recipe_pairs.json`

Used by the suggestion engine v2 (§8).

```json
{
  "_meta": {
    "topK": 50,
    "totalRecipes": 2231142,
    "ingredients": 4000,
    "generatedAt": "<iso8601>"
  },
  "globalCount": { "<name>": <integer recipe-frequency>, ... },
  "pairs": { "<name>": { "<partner>": <integer co-occurrence>, ... } }
}
```

- `globalCount[c]` is the recipe-frequency hard gate (§8.1).
- `pairs[s][c]` is the integer count of RecipeNLG recipes containing
  both `s` and `c`. Asymmetric storage is acceptable (engine sums one
  direction).
- Names are lowercase canonical strings matching `ingredients.json`.

### 10.2 `public/proDataset/ingredients.json` (Recipe-Lab-relevant fields)

```ts
{
  id: string;
  name: string;             // lowercase canonical
  taste?: string;           // whitespace-joined taste tokens
  weight?: string;
  volume?: string;
  season?: string;
  pairingCount: number;
  category?: string;
  cuisines?: string[];
  gnnProbs?: {              // 11-head probability map (5 tastes + 6 odors)
    sweet?: number; sour?: number; bitter?: number; umami?: number; salty?: number;
    odor_fruity?: number; odor_floral?: number; odor_green?: number;
    odor_woody?: number; odor_spicy?: number; odor_fatty?: number;
  };
  gnnProbsSource?: 'direct' | 'compound';
  flavorGraph?: { tier1?: string[]; tier2?: string[]; tier3?: string[]; tier4?: string[] };
}
```

### 10.3 `public/data/cocktail_codex_v2.json` (aroma-match consumption)

```ts
{
  cocktails: Array<{
    name: string;
    family?: string;
    description?: string;
    ingredients_raw: Array<string | { name: string; raw?: string }>;
    // ...other codex fields ignored by Recipe Lab
  }>;
}
```

The aroma-match handler normalizes `ingredients_raw` to `string[]`
before scoring.

### 10.4 `public/data/sauce_augment.json` (aroma-match consumption)

```ts
{
  description: string;
  ingredients: Array<{
    name: string;
    category?: string;
    taste?: string;
    weight?: string;
    codexRole?: string;       // sauce-slot vocabulary (base / acid / aromatic / ...)
  }>;
  sauces?: Array<{
    name: string;
    mother?: string;
    ingredients: Array<string | { name: string; measure?: string }>;
  }>;
}
```

The aroma-match handler normalizes `sauces[].ingredients` to `string[]`.

### 10.5 `public/proDataset/pairings.json` (edge strengths for analysis + compatibility)

```ts
Array<{ source: string; target: string; strength: number }>
```

Strength is the ProData NPMI + log-count hybrid in `[0, 1]`. Recipe
Lab consumes edges via `getNeighborsEnriched()` and
`buildAdjacencyList()` from `src/data/graph.js`.

### 10.6 Cuisine neighbor index (in-memory)

`useProData` exposes `data.cuisineNeighborIndex` — a
`Map<name, Array<{ name, cuisineStrength }>>` built from
`cuisine_pair_lookup`. Recipe Lab consumes this for cuisine-anchored
pair strengths (§6.3).

---

## 11. Per-ingredient portion data model

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

## 17. State ownership

### 11.1 Local state (`RecipeLabMobile`)

| State | Purpose |
|---|---|
| `labMode` (`'taste' \| 'cocktail' \| 'sauce'`) | Mode tab strip + scope filter |
| `centerIngredient` | Highlighted "center" row in the notebook + radar focal |
| `recipeIngredients` (string[]) | The bowl. Sole source of truth for the recipe. |
| `recipeTitle` | User-edited title; seeded from handoff |
| `selectedStructure` | Cocktail/sauce structure key for adherence scoring |
| `drawerSnap` (`'peek' \| 'half'`) | Vestigial — drawer is gone but the value drives some post-handoff focus behavior |
| `focusedIngredient` | When set, zone 1 swaps to per-ingredient `IngredientSuggestionsPopout` |
| `suggestionsMode` (boolean) | When true, zone 1 swaps to bowl-wide `IngredientSuggestionsPopout` |
| `handoffToast` | Transient string; auto-clears after 2500ms |
| `searchQuery`, `searchResults`, `searchOpen`, `highlightIdx` | Fuse.js search bar state |
| `cocktailScope` / `sauceScope` / `cocktailRoles` / `sauceRoles` | Lazy-loaded scope sets and role maps |

### 11.2 App-level handoff trigger (`App.jsx`)

| State | Purpose |
|---|---|
| `recipeMounted` | Latch — once true, never goes back to false |
| `recipeHandoff` (`{ ingredients, mode, ts, title? } \| null`) | One-shot watcher key |
| `recipeInitialMode` (`'cocktail' \| 'sauce' \| 'recipe' \| null`) | Initial mode override at first mount |
| `matchesContext` (`{ recipeName, items } \| null`) | Aroma-match output, consumed by Cocktail Lab / Sauce Lab |
| `externalLabFilter` | Build-path filter pill payload for sister labs |

### 11.3 Aroma-match context lives at App level

`matchesContext` is set by the Recipe Lab's pill handlers
(`handleFindCocktail` / `handleFindSauce`) but **consumed by the
destination lab**, not by the Recipe Lab itself. The handler navigates
to the destination tab and the destination renders the aroma-matched
list. `onExitMatches` (Cocktail Lab / Sauce Lab callback) clears the
context and restores the lab's default view.

This keeps Recipe Lab's own bowl unmodified by the aroma-match flow.

### 11.4 No persistence

- No localStorage for the in-flight bowl. A page refresh clears the
  Recipe Lab to its initial empty state unless the user explicitly
  saved (via `userProfile.addRecipe`).
- Profile (saved recipes) is the only durable Recipe Lab storage.
  `Save Recipe` button calls `userProfile.addRecipe(title, ingredients)`.

### 11.5 Acceptance

- [ ] All bowl mutations route through `setRecipeIngredients` in `RecipeLabMobile`.
- [ ] `matchesContext` is App-level state; Recipe Lab never reads it.
- [ ] Lab lazy-remount preserves the bowl across tab switches but not across page reload.
- [ ] Save flow writes through `userProfile.addRecipe(title, ingredients)`.

---

## 18. Tests covering the contract

These vitest files exercise the contract above. New work must extend
them, not replace them.

| Test file | Covers |
|---|---|
| `src/data/__tests__/recipeFocus.test.js` | `roleOfIngredient`, `inferMassShares`, `detectFocus` (§ supporting RecipeFlavorWheel anchoring) |
| `src/data/__tests__/recipeAromaSimilarity.test.js` | `computeRecipeAroma`, `cosineSim`, `topAromaOverlap`, `rankByAromaSimilarity`, `formatSimilarityBadge` (§7) |
| `src/data/__tests__/networkModes.test.js` | Adjacent — mode-resolution helpers consumed by useProData (NOT Recipe-Lab-specific but referenced) |

Missing coverage (open follow-ups, see §20):

- `recipeScoring.test.js` — `scoreRecipe`, `scoreRecipeAroma`, `verdictForScore`.
- `recipeLayout.test.js` — `computeRadialLayout` overlap-free invariant + `extractTechniques`.
- `recipeAnalysis.test.js` — interesting / unusual / suggestion / swap output shapes.
- `recipeSuggestionEngine.test.js` — `rankByRecipeCooccurrence` with mini fixture.
- Component tests for `RecipeLabMobile` handoff watcher (replace-not-append invariant).

### 12.1 Acceptance

- [ ] All listed tests pass.
- [ ] New tests added to fill the §20 follow-up coverage gaps must precede any refactor that touches the corresponding module.

---

## 19. In-flight legacy routing vs canonical Build-path target

This section makes the migration explicit so the executor knows what
to change and what to leave alone.

### 13.1 Current (in-flight legacy) routing

- `App.jsx` carries flat `activeTab` enum: `'network' | 'cocktail' | 'sauce' | 'recipe' | 'cookbook' | 'guided' | 'build' | 'profile'` (2026-05-29: `'recipes-3d'` renamed to `'cookbook'`).
- Build path's `onOpenLab(labKey, ...)` switches on `labKey === 'notebook'` to dispatch to Recipe Lab.
- URL alias: `?tab=recipe`.
- Recipe Lab's `<RecipeLab>` alias accepts `isMobile` for backwards-compat (ignored).

### 13.2 Canonical (Phase 5 Build-path) target

- `App.jsx` carries 2-level mode state `{ topLevel, subLevel }` per `plan.md` Phase 1.
- Build path's `onOpenLab` switches on `labKey === 'recipe-notebook'`.
- URL alias: `?path=build&sub=recipe-notebook` (with `?tab=recipe` redirect for one release).
- `<RecipeLab>` alias drops `isMobile` once no caller passes it; Phase 7 cleanup deletes the alias if no external imports remain (see §20).

### 13.3 Migration invariants

- The Recipe Lab component contract (props, handoff payload shape,
  bowl state ownership) does NOT change across the migration.
- `RecipeLabMobile.jsx` keeps the same prop interface; only the routing
  shell around it changes.
- The handoff `mode` field (`'recipe' | 'cocktail' | 'sauce' | null`)
  is route-agnostic and survives the migration unchanged.
- The aroma-match bridge handlers (`handleFindCocktail` /
  `handleFindSauce`) are route-agnostic and survive unchanged.

### 13.4 Acceptance

- [ ] During the migration window, BOTH `labKey === 'notebook'` and `labKey === 'recipe-notebook'` resolve to Recipe Lab.
- [ ] After migration, `labKey === 'notebook'` is removed and only `labKey === 'recipe-notebook'` resolves; the spec is updated to drop the legacy row in this table.
- [ ] `?tab=recipe` URLs continue to work via redirect for at least one release after the router migration.

---

## 20. Open questions

Five items were escalated in the original audit. Three resolved by
chef-user on 2026-05-27; two parked (downstream dependencies). The
resolutions are recorded here for lineage; the contract is what's
specified in §§1–13 and §21.

### Cookbook Lab rename — LANDED (2026-05-29 / DOCS-RL-COOKBOOK-RENAME)

`src/components/RecipesLab.jsx` was renamed to `CookbookLab.jsx`
on 2026-05-29. The 15-curated-seed-recipe browser (3D NetworkScene
mode + filterable card grid) lives there now. The activeTab key
`'recipes-3d'` was renamed to `'cookbook'`; the URL slug
`?path=recipes` keeps a back-compat alias to `'cookbook'` so any
previously-shared links still resolve. The recipe-building notebook
(this spec's RecipeLabMobile) is unaffected — it remains the
authoring surface separately from the cookbook browser.

### 1. NotebookCanvas (Canvas 2D radial) fate — REVERSED 2026-05-29

**Reversal (2026-05-29):** chef-user smoke-tested the canvas surface
wired behind feature flag `feature:canvas-notebook` and rejected it.
The mobile-first `RecipeLabMobile` surface is now **canonical**;
`NotebookCanvas.jsx`, `recipeLayout.js`, and `<RecipePanel>` revert
to their pre-2026-05-27 status (legacy, retained in repo as the
glyph-rules spec of record at §3.2–§3.3 only). The single signal
salvaged from the canvas exploration — the 7-pill recipe-type row
from §16 — lands directly on `RecipeLabMobile` via `RL-RECIPETYPE`.

The DOCS-RL-NOTEBOOK-WIRE umbrella task and its 3 short-lived
sub-tasks (DOCS-RL-CANVAS-MOUNT / -HANDOFF / -FLIP) are obsoleted by
this reversal. The 2026-05-27 resolution below is preserved for
historical context.

**Prior resolution (2026-05-27, SUPERSEDED):** `NotebookCanvas.jsx`,
`recipeLayout.js`, and `<RecipePanel>` are **canonical to Recipe
Lab** — the Canvas-2D hand-drawn aesthetic is the target rendering
surface. `RecipeLabMobile` was a Phase 1 stripped-down mobile-first
intermediate; the canonical state wires the Canvas renderer +
`<RecipePanel>` sidebar back into the Recipe Lab mount. This
resolution stood for two days before being reversed by chef-user
smoke-test feedback on 2026-05-29.

### 2. `<RecipeLab>` alias removal — PARKED

The `<RecipeLab>` alias / `<RecipeLabMobile>` underlying-file rename
depends on the NotebookCanvas wire-back (§20.1) settling first.
Once the canonical surface (Canvas + Notebook + RecipePanel)
replaces the mobile-first surface, the public export consolidates
to a single `<RecipeLab>` component. Parked behind
`DOCS-RL-NOTEBOOK-WIRE`; no separate task needed yet.

### 3. Information-theoretic suggestion engine — RESOLVED (backlog)

**Resolution (2026-05-27):** **backlog.** The Wordle-inspired
phase-shifting engine specced in `.omc/specs/deep-interview-
recipe-info-theory.md` stays on the backlog. Current
`recipeSuggestionEngine.js` v2 (recipe-level co-occurrence with
`FAMILIARITY_FLOOR = 50`) is the contract until/unless a future
session promotes the info-theory engine to active development.
The info-theory spec stays in §21 source-spec lineage as a
"never-shipped" entry, not a superseded entry.

### 4. Compound-food woody bias — PARKED (upstream)

The F0 woody-bias for compound foods (`raspberry sherbet → woody`,
etc.) inherits into the aroma-match bridge because
`computeRecipeAroma` averages `gnnProbs` directly. The fix lives
upstream in the GNN / compound-food synthesis pipeline (separate
N2-GNN-* / data-pipeline lever), not in Recipe Lab. No Recipe-Lab-
local action — parked here as a known limitation that the
aroma-match bridge inherits until the upstream fix lands.

### 5. Vestigial `drawerSnap` state — RESOLVED (follow-up task)

**Resolution (2026-05-27):** **delete vestigial `drawerSnap`
state.** The `<SuggestionDrawer>` was removed 2026-05-07; the
`drawerSnap` state (`'peek' | 'half'`) in `RecipeLabMobile` is
unobservable and should be cleaned up. Tracked under follow-up
bridge task `DOCS-RL-DRAWERSNAP-CLEANUP`. The audit commit does
not delete it — kept until the dedicated cleanup task lands so
the doc + code track separately.

---

## 21. Source spec lineage

This canonical spec consolidates the following source files. Where a
source disagrees with this spec, **this spec wins**. Notable
amendments are listed inline with [§21] markers in the body above.

### 15.1 Primary sources

| Source spec | Status |
|---|---|
| `.claude/specs/recipe-lab-mobile.md` (2026-04-01 Draft) | Superseded by §2, §3, §17. SuggestionDrawer-related sections (Zone 3, taste tabs, "Give me a suggestion" button) are no longer canonical — the drawer was removed 2026-05-07 and replaced by `<IngredientSuggestionsPopout>` (see §2.3). |
| `.omc/specs/deep-interview-recipe-info-theory.md` | **Not shipped.** Documented for the record only. The shipped suggestion engine is the recipe-level co-occurrence ranker in §8. See §20 Open Question 3. |
| `.omc/plans/network-recipe-iter-2026-05-16.md` (Tracks 1-4) | Track 2 shipped — `RecipeFlavorWheel` rewrite to `ProfileAxisRadar` (§2.1). Other tracks are out of scope for Recipe Lab. The F0 follow-up (compound-food woody bias) is escalated as §20 Open Question 4. |
| `plan.md` (Seamless UX Pipeline, 2026-05-16) | Phase 1, 4, 5, 7 are the migration plan reflected in §1 and §19. Phase 7 "Files Deleted" list is escalated as §20 Open Question 2. |
| `.claude/CLAUDE.md` (project architecture) | Confirms data sources and component layout; not superseded but cited. |

### 15.2 Resolved amendments (locked herein)

1. **`<SuggestionDrawer>` removed; replaced by `<IngredientSuggestionsPopout>`** (2026-05-07). The drawer's bottom-sheet shell, taste tabs, "Give me a suggestion" button, and shake-to-suggest are no longer part of the Recipe Lab. [§2.3]
2. **Handoff replaces the bowl, never appends** (2026-05-07). All five entry points use the one-shot `handoff.ts` watcher and clear-then-replace semantics. [§9.2]
3. **Toast on handoff** with cleared-count copy. [§9.3]
4. **Aroma-match bridge canonical** via 6-dim cosine sim through `recipeAromaSimilarity.js`. Handler lives in `App.jsx`; destination lab consumes `matchesContext`. [§7]
5. **Suggestion engine v2: recipe-level co-occurrence** with `FAMILIARITY_FLOOR = 50` as a hard gate, not a multiplier. Replaced the legacy "average pairwise NPMI" ranker. [§8]
6. **6 aroma axes (not 5) for aroma scoring** — `odor_fruity / odor_floral / odor_green / odor_woody / odor_spicy / odor_fatty`. `odor_spicy` is included despite F1 < 0.50 because it's a recognizable axis; its underweighting comes from the cosine math, not an exclusion. [§4.3, §7.2]
7. **`RecipeLab.jsx` is a thin alias for `RecipeLabMobile.jsx`.** Web and iOS share the same layout; `isMobile` prop is accepted but ignored. [§1.1]
8. **Mode tab strip stays at three entries** (`General / Cocktail / Sauce`); the strip is full-width below the top action bar. [§2.4]
9. **Compatibility readout** in the notebook + sidebar is mean pairwise edge strength over `C(N, 2)` pairs, with cuisine-anchored fallback. [§4.4, §6.3]
10. **Phase 5 Build-path topology is canonical-as-planned** (chef decision 2026-05-27). `subLevel === 'recipe-notebook'` under `topLevel === 'build'` replaces `labKey === 'notebook'`. The Recipe Lab component contract is unchanged across the migration. [§1.3, §19]

---

## How to revise this spec

When future work changes any of the above:

1. Edit this file directly.
2. Bump the "Last revised" date at the top.
3. Add a row to §21.2 if a new amendment is locked.
4. Source specs in `.claude/specs/`, `.omc/specs/`, and `.omc/plans/`
   remain as historical artifacts — do NOT update them.
5. Update tests, code, and any external docs to match this spec, not
   the historical sources.

When the spec is in conflict with the shipped code:

1. Check whether the code is wrong (open an issue + fix).
2. Or whether this spec is wrong (open a spec-revision PR).
3. Never silently align one to match the other — make the divergence
   explicit, mirroring the §19 "Current vs Canonical" pattern.
