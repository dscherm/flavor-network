# Canonical Guided Discovery Spec

> **Status**: Authoritative. Supersedes all prior specs, ralplans, and amendments listed in
> [§12 Source spec lineage](#12-source-spec-lineage). When this file disagrees with any other file
> in the repo, **this file wins**. Last revised 2026-05-27.

> **Scope**: The Guided Discovery feature reachable from the landing tile "Guided Discovery"
> and the top-level "Guided" tab. Covers the entry flow (`GuidedDiscoverySwipe` —
> the current production path; `GuidedDiscoveryStart` — the deprecated 8-bubble grid
> kept for its test suite), the results page (`GuidedDiscoveryResults`), the
> per-pairing radar (`GuidedProfileRadar`), the single-select filter pill row
> (`GuidedResultsFilterPills`), the static provenance panel (`ProvenancePanel`),
> the disclosure shell (`ThoughtBubbleCard`), the bubble registry + translation
> (`src/data/guidedDiscovery.js`), and the radar/story/curated-pairing data layer
> (`guidedRadarAxes.js`, `whyThisWorks.js`, `curatedPairings.js`).
>
> The Build flow (`activeTab === 'build'` / `'build-results'`) is OUT OF SCOPE
> even though it shares the bubble registry; the GuidedTour overlay
> (`GuidedTour.jsx`) is OUT OF SCOPE except where it is launched from the
> Guided Results radar.
>
> **"Guided Mode" + "Discovery Mode" are ONE merged feature** named **Guided
> Discovery** (chef-user decision 2026-05-27). There is no separate Discovery
> Mode anywhere in the codebase.

> **How to use this document**: each section is a self-contained contract.
> Source spec citations live at the end; you do not need to read the source
> specs to implement the feature.

---

## Table of Contents

1. [Information architecture](#1-information-architecture)
2. [Bubble registry](#2-bubble-registry)
3. [Screen 1 — Entry flow](#3-screen-1--entry-flow)
4. [Screen 2 — Results](#4-screen-2--results)
5. [State ownership](#5-state-ownership)
6. [Filter-stack translation](#6-filter-stack-translation)
7. [Network handoff](#7-network-handoff)
8. [Curated pairings + story generation](#8-curated-pairings--story-generation)
9. [Accessibility + interaction invariants](#9-accessibility--interaction-invariants)
10. [Tests covering the contract](#10-tests-covering-the-contract)
11. [Open questions](#11-open-questions)
12. [Source spec lineage](#12-source-spec-lineage)

---

## 1. Information architecture

### 1.1 Entry points

| Surface | Trigger | Effect |
|---|---|---|
| Landing tile "Guided Discovery" | `onModeSelect('guided')` in `App.jsx:719-721` | `setActiveTab('guided')` |
| Top-level "Guided" nav button (`App.jsx:1276-1293`) | click | `setActiveTab('guided')` |
| Mobile tab bar | `onTabChange('guided')` | `setActiveTab('guided')` |
| URL deep-link `?path=guided` | `PATH_TO_TAB['guided'] === 'guided'` | `initialTab === 'guided'` |

### 1.2 Screen flow

```
landing tile / Guided nav / ?path=guided
                │
                ▼
[Screen 1]  activeTab === 'guided'        — GuidedDiscoverySwipe (production)
            (GuidedDiscoveryStart is a    — deprecated; preserved for tests
             retired 8-bubble alternative)
                │  onComplete({ ingredient, filterType })
                │  ↳ App.jsx synthesizes a minimal bubbleStack
                │    [{ key:'ingredient', value:{ ingredient } }]
                │    + sets guidedInitialFilterType
                ▼
[Screen 2]  activeTab === 'guided-results' — GuidedDiscoveryResults
                │
                ├── onBackToBubbles  →  setActiveTab('guided')
                ├── onAxisSelect(k)  →  setFilterStack + GuidedTour overlay
                │                       + setActiveTab('network')
                └── onExploreInNetwork → deriveFilterStackFromBubbles
                                         + setActiveTab('network')
```

`'guided-results'` is marked **ephemeral** in `TAB_TO_PATH` — `?path=guided`
deep-linking collapses both `'guided'` and `'guided-results'` to the entry
screen.

### 1.3 Exit handoff

Three exits from `GuidedDiscoveryResults`:

1. **Back to bubbles** — returns to Screen 1, `bubbleStack` preserved.
2. **Tap a radar axis** — sets a one-axis `filterStack` (axis goes first,
   rest derived from `bubbleStack`), seeds `selectedNodes=[focal]` so
   α-mode auto-engages, activates the `GuidedTour` overlay, jumps to the
   network tab. See §7.
3. **Explore in the network** — calls `deriveFilterStackFromBubbles`,
   jumps to the network tab without tour overlay. See §6 + §7.

---

## 2. Bubble registry

Defined in `src/data/guidedDiscovery.js`. **8 bubbles**, plus the
ingredient bubble = 9 entries. (The "8-bubble" count in earlier specs
refers to the 8 non-ingredient bubbles; the registry holds 9 total.)

| `key` | `label` | `subUI` | `axisHint` | Primitive |
|---|---|---|---|---|
| `ingredient` | "Starts with a specific ingredient" | `ingredient-search` | `null` | `SearchBar` (inline) |
| `season` | "Goes with a season" | `season-chips` | `season` | inline chips × `SEASON_VALUES` (`spring`/`summer`/`fall`/`winter`) |
| `cuisine` | "Goes with a cuisine" | `cuisine-pills` | `cuisine` | inline chips × `CATEGORICAL_AXES.cuisine.labels` |
| `meat` | "Is for a meat or protein" | `meat-chips` | `family` | inline chips × `MEAT_VALUES` (`beef`/`pork`/`chicken`/`fish`/`lamb`/`game`) |
| `aroma` | "Has a specific aroma family" | `aroma-pills` | `aroma` | inline chips × `CATEGORICAL_AXES.aromas.labels` |
| `cocktail` | "Is for a cocktail" | `scope-toggle` | `cocktail-scope` | boolean toggle |
| `sauce` | "Is for a sauce" | `scope-toggle` | `sauce-scope` | boolean toggle |
| `dessert` | "Is for a dessert" | `flag-toggle` | `null` | boolean toggle |
| `dietary` | "Has dietary restrictions" | `dietary-chips` | `null` | multi-select chips × `DIETARY_RESTRICTIONS` |

### 2.1 Bubble entry shape (in `bubbleStack`)

```ts
{
  key: BubbleKey,
  label: string,         // copy from registry
  value: BubbleValue,    // see per-subUI shape below
  axisHint: AxisHint,    // copy from registry; null = no morph axis
}
```

`BubbleValue` by `subUI`:

| `subUI` | `value` shape |
|---|---|
| `ingredient-search` | `{ ingredient: string }` |
| `season-chips` | `string` (one of `SEASON_VALUES`) |
| `meat-chips` | `string` (one of `MEAT_VALUES`) |
| `cuisine-pills` | `{ cuisineBucket: string }` |
| `aroma-pills` | `{ aromaBucket: string }` |
| `scope-toggle` | `true` (presence = on; absent = off) |
| `flag-toggle` | `true` |
| `dietary-chips` | `{ dietary: string[] }` (multi-select; `[]` auto-removes the bubble) |

`summarizeBubble(b)` (defined inline in both `GuidedDiscoveryStart` and
`GuidedDiscoveryResults`) renders chips with the value pretty-printed:
`ingredient` → name; `{cuisineBucket}` → label; `{aromaBucket}` → label;
`{dietary}` → comma-joined list; `true` → `"on"`.

### 2.2 `axisHint` → filter-axis mapping

`axisHint` corresponds 1:1 with `App.jsx` `filterStack` axis keys
consumed by `LivingArchView` (`'aroma'`, `'cuisine'`, `'season'`,
`'family'`, `'cocktail-scope'`, `'sauce-scope'`). `null` bubbles
(`ingredient`, `dessert`, `dietary`) do not contribute to the filter
stack on the network handoff path — they shape Screen 2 only.

`onAxisSelect` in `App.jsx:1816` remaps `'aroma'` → `'aromas'` to match
the categorical-axis key used internally; `deriveFilterStackFromBubbles`
does NOT (see §6).

---

## 3. Screen 1 — Entry flow

Two implementations exist. **`GuidedDiscoverySwipe` is the production
path** (mounted by `App.jsx:1765`). `GuidedDiscoveryStart` is retired
but kept in-tree (and tested) so the 8-bubble flow can be re-enabled
without re-implementation.

### 3.1 `GuidedDiscoverySwipe` (production)

Two-card sequential flow with **no auto-advance**. Step state:
`'ingredient' | 'filterType'`.

**Card 1 — Ingredient pick**

- Heading: "Starts with a specific ingredient".
- `SearchBar` (inline, with `.guided-search-inline` overrides flattening
  `SearchBar`'s normally-fixed positioning).
- "Suggest one for me" button — random pick from
  `SUGGESTION_POOL = ['chicken', 'onion', 'basil', 'vanilla']`.
- "Got it" button — disabled until `ingredient !== null`; click
  advances `step` to `'filterType'`. **Never auto-advances** on
  selection alone.

**Card 2 — Filter-type pick** (`GuidedFilterTypeCard`)

- Heading: "Discover pairings that are…".
- 4 single-select pill buttons (`role="radio"` in a
  `role="radiogroup"`):

| `key` | `label` | Icon | `color` (idle) | `activeColor` |
|---|---|---|---|---|
| `taste` | "a taste" | inline `TasteIcon` (tongue + buds) | `#f9a8d4` | `#ec4899` |
| `aroma` | "an aroma" | `AromaHeaderIcon` | `#c4b5fd` | `#a78bfa` |
| `season` | "in season" | `SeasonHeaderIcon` | `#6ee7b7` | `#34d399` |
| `cuisine` | "from a region" | `CuisineHeaderIcon` | `#93c5fd` | `#60a5fa` |

- Pill icons render at 48×48px (Tailwind `w-12 h-12`).
- "Got it" button — disabled until a pill is selected. Click fires
  `onCommit(filterType)`, which bubbles up as
  `onComplete({ ingredient, filterType })` to `App.jsx`.
- `aria-live="polite"` announcer fires "Filtering by {label}" on pill
  select.

**`BUBBLE_REGISTRY` is NOT imported by this component.** This is a
hard contract verified by §10's grep gate. The registry survives only
for Build's flow.

### 3.2 `GuidedDiscoveryStart` (deprecated, kept for tests)

- 8-bubble grid + the ingredient bubble (so 9 cards).
- Sentence starter: `"I'm thinking about pairing that…"` in a dashed-
  outline thought-bubble header.
- Each card is a `ThoughtBubbleCard` (a `<details>`/`<summary>`
  disclosure wrapper):
  - Closed state: bold title + large per-card colored icon + tail dots.
  - Open state: icon hides, summary chip shows the picked value, sub-UI
    chips/toggle render via the slotted `children`.
  - Per-card stroke color from `CARD_COLOR_BY_KEY[bubbleKey]`.
- Stack chips render above the grid; tapping a chip removes the bubble
  (`removeBubbleByKey`).
- CTA "Show me pairings →" is **disabled** when
  `bubbleStack.length === 0` (the can't-check-empty invariant).
- On CTA click: `onShowPairings(bubbleStack)` — `App.jsx` would route
  this through the legacy array-shape branch (defensive path,
  `App.jsx:1773-1776`).
- **Ingredient bubble does NOT auto-collapse** after an ingredient
  pick (Round-4 revision in the pairing-audit spec). Other bubbles
  auto-collapse via `setOpenBubble(null)` after their value is
  committed.

### 3.3 Per-bubble sub-UI renderers (`GuidedDiscoveryStart`)

| `subUI` | Renderer | Behavior |
|---|---|---|
| `ingredient-search` | `renderIngredientSearch` | `SearchBar`; `onSelect` adds bubble but keeps grid mounted |
| `season-chips` | `renderSeasonChips` | One chip per `SEASON_VALUES`; `aria-pressed`; clicking auto-collapses |
| `meat-chips` | `renderMeatChips` | One chip per `MEAT_VALUES`; auto-collapses |
| `cuisine-pills` | `renderCuisineChips` | One chip per `CATEGORICAL_AXES.cuisine.labels`; auto-collapses |
| `aroma-pills` | `renderAromaChips` | One chip per `CATEGORICAL_AXES.aromas.labels`; auto-collapses |
| `scope-toggle` | `renderScopeToggle` | Boolean toggle; presence in stack = on |
| `flag-toggle` | `renderFlagToggle` | Boolean toggle ("Yes, this is for dessert") |
| `dietary-chips` | `renderDietaryChips` | Multi-select; empty array → bubble auto-removes |

---

## 4. Screen 2 — Results

Component: `GuidedDiscoveryResults`. Mounted at
`activeTab === 'guided-results'`.

### 4.1 Layout

```
┌─────────────────────────────────────────────────┐
│ "Guided Discovery — Results"                    │
│                                                 │
│  [Selected-bubble chip strip]                   │
│                                                 │
│  [Chemistry banner — conditional, see §4.5]     │
│                                                 │
│  ┌────────────────────────┬──────────────────┐  │
│  │ [GuidedResultsFilter   │ StoryPanel       │  │
│  │  Pills]  Taste·Aroma   │  (selected pair) │  │
│  │        ·Season·Region  │                  │  │
│  │                        │                  │  │
│  │ [GuidedProfileRadar]   │                  │  │
│  │  per-pairing scatter   │                  │  │
│  │                        │                  │  │
│  │  "Show me where this   │                  │  │
│  │   data comes from"     │                  │  │
│  └────────────────────────┴──────────────────┘  │
│                                                 │
│  [← Back to bubbles]     [Explore in network →] │
└─────────────────────────────────────────────────┘
```

Grid columns: `1fr` on mobile, `2fr 1fr` on `lg:`.

### 4.2 Props

```ts
{
  bubbleStack: BubbleEntry[],          // from App.jsx state
  initialFilterType: FilterType|null,  // from GuidedDiscoverySwipe payload
  onBackToBubbles?: () => void,
  onExploreInNetwork?: ({chosenValue, filterType}) => void,
  onAxisSelect?: (filterType) => void, // legacy hook; tour entry
  ctx?: ProDataCtx | null,             // useProData() output
  runtimeData?: { pairingCount?, sharedCompoundsForPair? } | null,
  odorThresholds?: Record<string, number> | null,
}
```

### 4.3 Filter-type derivation

Local state `filterType`, seeded from
`seededFilterType = initialFilterType || filterTypeFromStack(bubbleStack)`.

`filterTypeFromStack(stack, fallback='taste')` scans the bubble stack
in reverse for a bubble whose `axisHint` is in `{ aroma, cuisine,
season, taste }` and returns it; otherwise returns `fallback`. **Taste
is the canonical fallback** — every node carries a taste field;
aroma requires `gnnEntropy` which is sparse.

When `initialFilterType` changes (e.g. user re-walks the flow),
`useEffect` resets both `filterType` and `chosenValue=null`.

### 4.4 Hero pairings

`heroPairings = selectCuratedPairings({ focal, ctx, dietary }) || []`,
where:

- `focal = focalFromStack(bubbleStack)` — first bubble with
  `key === 'ingredient'`.
- `dietary = dietaryFromStack(bubbleStack)` — restrictions passed
  through unchanged into `selectCuratedPairings` (see §8).

`radarPairings = heroPairings.map(hydratePairing)` — `hydratePairing`
looks the neighbor up in `ctx.graph.nodes` and copies `taste`,
`season`, `cuisines`, `gnnProbs` onto the result so the radar's
predicates have data to read.

### 4.5 Chemistry banner

Renders **above the radar** when ≥ 50% of `heroPairings` have
`pair.breakdown.x3 === 0.5` (chem-bridge fallback default). Copy:

> "Several pairings on this wheel rank on recipe co-occurrence alone —
> our chemistry bridge found no shared aroma compounds for those
> specific pairs. The story for each pair will say which signal it
> leans on."

Predicate input: `selectCuratedPairings(focal, ctx, dietary)` —
`selectCuratedPairings` stays imported solely for this predicate
(OQ4 closure in ralplan track-3 R2).

The banner is **single, not per-pair** (Critic-imposed constraint
#5b from `pairing-audit-and-guided-discovery-v2.md`).

### 4.6 `GuidedProfileRadar` (the hero)

**ADR-1 fork of `ProfileAxisRadar.jsx`** — shares SVG math primitives
but answers a different question (per-pairing scatter on one axis,
not per-recipe lean across five). Implementation in
`src/components/GuidedProfileRadar.jsx`.

| Prop | Default | Behavior |
|---|---|---|
| `focal` | `null` | Drawn as a 6px amber hub circle at center |
| `pairings` | `[]` | Hydrated pairings; plotted as dots |
| `filterType` | `'taste'` | Axes & color map (§4.7) |
| `chosenValue` | `null` | Axis key (e.g. `'sweet'`) or null |
| `onAxisTap` | `null` | `(axisKey) => void` |
| `size` | `280` (Results page passes `320`) | Render size |
| `odorThresholds` | `null` | Per-task threshold map (`{ odor_fruity: 0.55, ... }`) |
| `onDropCount` | `null` | Called with count of pairings dropped for missing data |

**Visual contract:**

- 4 concentric grid polygons at radius levels `0.25 / 0.5 / 0.75 / 1.0`.
- Axis spokes (one per axis).
- Filled wedge at `chosenValue` axis: `fillOpacity={0.55}`,
  `data-testid="guided-radar-wedge-fill"`.
- Per-pairing dots: 4px radius, fill `#0a1428`, stroke `#22d3ee`.
- Match opacity 1.0 / stroke 2.0 / label visible; non-match opacity
  0.35 / stroke 1.0 / no label.
- `chosenValue === null` → ALL pairings opacity 1.0, NO labels.
- Focal hub: fill `#fbbf24`, stroke `#0a1428` 2px, `r=6`.
- Axis labels are `<button>` elements positioned via absolute CSS
  outside the SVG, `aria-label="Highlight pairings tagged {axis}"`,
  `aria-pressed={chosenValue === k}`.
- `aria-live="polite"` announces "Highlighting pairings tagged {k}"
  or "Showing all pairings on {filterType} axes".

### 4.7 Axes + color maps (`guidedRadarAxes.js`)

| `filterType` | `getAxesFor` | `getColorMapFor` |
|---|---|---|
| `taste` | `['sweet','sour','bitter','salty','umami','pungent','astringent','spicy']` (8) | `BRISCIONE_TASTE` |
| `aroma` | `['fruity','floral','green','woody','spicy','fatty']` (6) | `BRISCIONE_AROMA` |
| `season` | `['spring','summer','fall','winter']` (4) | `BRISCIONE_SEASON` |
| `cuisine` | `CATEGORICAL_AXES.cuisine.labels` (8, exact-ref) | `CUISINE_CHIP_COLOR` |

`getAxesFor('cuisine') === CATEGORICAL_AXES.cuisine.labels` is an
**exact-reference** contract (asserted in §10's helper tests).

### 4.8 `pairingMatchesAxis` predicates

| `filterType` | Match rule |
|---|---|
| `taste` | `tokenize(pairing.taste).includes(axisKey.toLowerCase())` |
| `season` | `tokenize(pairing.season).includes(axisKey.toLowerCase())` |
| `aroma` | `pairing.gnnProbs['odor_' + axisKey] >= threshold` where threshold = `odorThresholds['odor_' + axisKey] ?? 0.5` |
| `cuisine` | Case-insensitive membership in `pairing.cuisines[]` |

`tokenize` lowercases and splits on `[\s,/]+`.

### 4.9 `coordsForPairing`

Returns `{x, y}` SVG offset from radar center, or `null`. The returned
coords are the **centroid of all matching axis positions**:

```
angle_i = 2π·i/N − π/2
matched = [i for i where pairingMatchesAxis(... axes[i] ...)]
return null if matched is empty
return { x: mean(cos(angle_i)*radius), y: mean(sin(angle_i)*radius) }
```

**Aroma honesty**: when `filterType === 'aroma'` and `pairing.gnnProbs`
is missing, returns `null` — never fabricate a position. The
component reports the drop count via `onDropCount`.

### 4.10 `GuidedResultsFilterPills`

ADR-5 **fork** of `FilterPillRow.jsx`. Single-select (`role="radio"`
in a `role="radiogroup" aria-label="Result filter type"`), 4 pills:

| `type` | `label` | Icon |
|---|---|---|
| `taste` | "Taste" | inline `TasteIcon` |
| `aroma` | "Aroma" | `AromaHeaderIcon` |
| `season` | "Season" | `SeasonHeaderIcon` |
| `cuisine` | "Region" | `CuisineHeaderIcon` |

`onSelect(nextType)` fires only on a different selection (clicking the
active pill is a no-op). The Results page handler resets
`chosenValue = null` when `filterType` changes.

**Do NOT modify `FilterPillRow.jsx` for Guided purposes** (ADR-5
blast-radius rule).

### 4.11 `StoryPanel`

Renders `whyThisWorks(selectedPair, runtime, ctx)` when the user taps
a radar dot (currently `setSelectedPair` is called from the dot tap
handler — but see §11). Output schema (`whyThisWorks.js`):

```ts
{
  causalSentence: string,            // always present
  annotativeSentence: string | null, // bridge_compounds bridge or GNN class fallback
  isAnnotativeCompoundUsedByRuntime: boolean,
  citationsIfAny: Citation[],        // ground_truth.json refs
  surpriseAxesMatched: string[],     // chem-bridged-rare / absent-from-books / cross-cuisine / cross-aroma
}
```

`StoryPanel` rendering rules:

1. **`causalSentence`** — prominent; `data-testid="story-causal"`.
2. **`annotativeSentence`** — muted, prefixed
   `"supporting context"`; `data-testid="story-annotative"`.
3. **Disclaimer chip** "annotation only — not used in ranking" when
   `isAnnotativeCompoundUsedByRuntime === false` and an annotative
   sentence exists.
4. **Citation chips** (`citationsIfAny`) — open `url` in new tab when
   present; `data-testid="story-citation-chip"`.
5. **Surprise badges** — labels from `SURPRISE_LABELS`
   (`chem-bridged-rare`/`absent-from-books`/`cross-cuisine`/
   `cross-aroma`).

`role="region"`, `aria-live="polite"`, `aria-label="Story for {a + b}"`.

Placeholder when no `selectedPair`: copy depends on whether `focal`
is present.

### 4.12 `ProvenancePanel`

Static modal opened by the "Show me where this data comes from"
button below the radar. ADR-4 **replacement** for invoking
`GuidedTour` from this surface (`GuidedTour` requires a `sceneHandle`
that doesn't exist on the Guided Results page).

Sources listed:

1. RecipeNLG — 2.2M recipes → co-occurrence + PMI (40% weight)
2. TheMealDB — 595 meals → co-occurrence (15% weight)
3. TheCocktailDB — 426 drinks → co-occurrence (15% weight)
4. FlavorDB — chemical compound overlap (30% weight)
5. GNN — 11-head multi-task taste + aroma classifier (19,902 SMILES, 5-fold CV)
6. ChemTastesDB v2.1 — 3,849 compounds (Zenodo 15051366)
7. Ground truth — Briscione palette curated taste + aroma axes

`role="dialog" aria-modal="true"`, backdrop click + ESC + close button
all dismiss. **`GuidedTour.jsx` is NOT imported by
`GuidedDiscoveryResults`** (grep gate — see §10).

---

## 5. State ownership

**Constraint #4 (executor handoff, preserved across both spec
generations)**: `setFilterStack` is invoked from Guided Discovery
**exclusively** through the explicit CTAs at the App.jsx level.

| State | Owner | Notes |
|---|---|---|
| `bubbleStack` | `App.jsx` (`useState`) | Lifted so it survives the Screen 1 → Screen 2 tab flip. Built by `GuidedDiscoverySwipe`'s `onComplete` callback. |
| `guidedInitialFilterType` | `App.jsx` (`useState`) | Threaded into `GuidedDiscoveryResults` as `initialFilterType`. |
| `filterType` | `GuidedDiscoveryResults` (`useState`) | Seeded from `initialFilterType || filterTypeFromStack(bubbleStack)`. Switching pills resets `chosenValue`. |
| `chosenValue` | `GuidedDiscoveryResults` (`useState`) | Axis label currently highlighted. `null` = no-value mode. |
| `selectedPair` | `GuidedDiscoveryResults` (`useState`) | Currently focused hero pairing for `StoryPanel`. |
| `provenancePanelOpen` | `GuidedDiscoveryResults` (`useState`) | |
| `bubbleStack` (Screen-1-only legacy `GuidedDiscoveryStart`) | Local `useState` | Only leaves the component via the `onShowPairings(bubbleStack)` callback. |

**`GuidedDiscoveryStart`, `GuidedDiscoverySwipe`,
`GuidedFilterTypeCard`, `GuidedDiscoveryResults`,
`GuidedProfileRadar`, `GuidedResultsFilterPills`, `ProvenancePanel`
MUST NOT import or call `setFilterStack`.** The only `setFilterStack`
calls from the Guided context live in `App.jsx`'s `onAxisSelect`
(`App.jsx:1817`) and `onExploreInNetwork` (`App.jsx:1831`) handlers.

---

## 6. Filter-stack translation

`deriveFilterStackFromBubbles(bubbleStack)` in `src/data/guidedDiscovery.js`
is the **only** translation from local bubble state to App-level
`filterStack`.

### 6.1 Contract

```ts
function deriveFilterStackFromBubbles(bubbleStack: BubbleEntry[]): string[]
```

- Iterates the stack in order.
- For each bubble, takes `item.axisHint`.
- **Drops `null` `axisHint`** (ingredient, dessert, dietary do not
  appear on the network's filter pill row).
- Dedupes (first occurrence wins).
- Order preserved — most-recent bubble becomes the most-recent
  filter, which determines the morph axis in `LivingArchView`.

### 6.2 Axis-key remap

`deriveFilterStackFromBubbles` returns `axisHint` strings **as-is**:
`'aroma'`, `'cuisine'`, `'season'`, `'family'`, `'cocktail-scope'`,
`'sauce-scope'`.

The `onAxisSelect` handler in `App.jsx:1816` is the **only place** that
remaps `'aroma' → 'aromas'` (the categorical-axes key used by the
3D scene). `deriveFilterStackFromBubbles` itself does not remap — see
§11 Open Question O-1.

---

## 7. Network handoff

Two CTAs on `GuidedDiscoveryResults` route into the network tab.

### 7.1 "Explore in the network →"

```js
onExploreInNetwork={() => {
  setFilterStack(deriveFilterStackFromBubbles(bubbleStack));
  setActiveTab('network');
}}
```

- Pure pill translation — no tour overlay, no preselected node.
- `chosenValue` and `filterType` from Screen 2 are NOT propagated to
  the network (intentional: the network surface owns its own pill
  state).

### 7.2 "Tap a radar axis" (legacy `onAxisSelect`)

Fires when the user taps an axis label on the radar. Currently wired
through `handleAxisTap` → `onAxisSelect(filterType)`:

```js
onAxisSelect={(axis) => {
  const axisFilter = axis === 'aroma' ? 'aromas' : axis;
  setFilterStack([
    axisFilter,
    ...deriveFilterStackFromBubbles(bubbleStack).filter((f) => f !== axisFilter),
  ]);
  const focal = bubbleStack.find((b) => b.key === 'ingredient')?.value?.ingredient || null;
  if (focal) setSelectedNodes([focal]);
  setTourAxis(axis);
  setTourFocal(focal);
  setTourActive(true);
  setActiveTab('network');
}}
```

- The tapped axis is **prepended** to the filter stack (becomes the
  morph-driving filter).
- The focal ingredient is selected to auto-engage α-mode in
  `LivingArchView`.
- `GuidedTour` overlay activates with the tapped axis + focal as
  context. Tour stages live in `src/data/guidedTourStages.js`.

The radar's per-axis-tap `handleAxisTap` in `GuidedDiscoveryResults`
also toggles a local `chosenValue` state (tapping the same axis
twice clears it). The two effects (chosenValue toggle + onAxisSelect
network handoff) currently both fire on every axis tap — see §11
Open Question O-2.

---

## 8. Curated pairings + story generation

### 8.1 `selectCuratedPairings({ focal, ctx, dietary })`

Lives in `src/data/curatedPairings.js` (extracted from `CuratedWheel.jsx`
so the chemistry banner predicate can import it without dragging in
the wheel UI). Returns up to 10 hero pairings.

Composition (with dietary multiplier `mult = dietary.length > 0 ? 2 : 1`):

1. `surprisingAffinities(focal, ctx, { N: 3 * mult })` — tagged
   `_source: 'surprising'`.
2. `topAffinities(focal, ctx, { N3: 4 * mult, N2: 0, N1: 0 })` —
   tagged `_source: 'top'`.
3. Pull 10×mult more top-tier candidates, keep those where
   `groundTruthHas(focal, n.name)` returns true; slice to `3 * mult` —
   tagged `_source: 'cited'`.
4. Dietary filter (when active): `passesDietaryFilters(name, node, dietary)`
   from `dietaryFilters.js`.
5. `uniqueByName` dedup.
6. `.slice(0, 10)` cap.

The over-pull multiplier on dietary-active flows ensures the final 10
heroes survive vegan / vegetarian filtering of a meat-heavy candidate
set.

### 8.2 `whyThisWorks(pair, runtime, ctx)`

Returns the dual-sentence story object documented in §4.11. Honesty
contract (Critic-imposed Constraint #5):

- **`causalSentence` ALWAYS present** — engine attribution
  ("recipe co-occurrence in 50,312 pairings"). Pure data templating
  — no LLM (ADR-001 explicit rejection).
- **`annotativeSentence`** — chemistry hypothesis. Looked up via
  `bridge_compounds.json` first, falls back to GNN-entropy shared
  top-class. `null` when neither has signal.
- **`isAnnotativeCompoundUsedByRuntime`** — `true` only when the
  bridge compound also appears in `pair.sharedCompounds` (or
  `runtime.sharedCompoundsForPair(a, b)`). When `false`, `StoryPanel`
  renders the disclaimer chip.
- **`citationsIfAny`** — `ground_truth.json` matches.
- **`surpriseAxesMatched`** — runs the 4 axis classifiers
  (`chemBridgedRare`, `absentFromBooks`, `crossCuisine`, `crossAroma`)
  from `chemDataset/validation/lib/axes.js`.

Node-side helpers (`loadBridgeCompounds`, `loadGroundTruth`,
`loadCuratedStoriesFixture`) are lazy and guard on `_isNode`. The
browser path requires `ctx.bridgeCompounds` / `ctx.gnnEntropy` /
`ctx.groundTruth` to be injected by the caller (`GuidedDiscoveryResults`
threads them through `buildWhyThisWorksInputs`).

### 8.3 `normalizePair(focal, neighbor, ctx)`

Adapter used by the chemistry-banner predicate and the story
generator. Pulls the pair's `breakdown` and `sharedCompounds` from
`ctx.graph.edges` (tolerant of either endpoint ordering). Default
`breakdown: { x3: 0.5 }` — the chem-bridge fallback. Default
`sharedCompounds: []`.

---

## 9. Accessibility + interaction invariants

### 9.1 No-auto-advance

`GuidedDiscoverySwipe` Card 1 (ingredient pick) **does NOT** auto-
advance to Card 2 (filter-type) when the user selects an ingredient.
The "Got it" button must be clicked. Asserted by the fake-timer test
named `'no-auto-advance: ingredient pick does NOT auto-render
FilterTypeCard'` — see §10.

### 9.2 Can't-check-empty

- `GuidedDiscoverySwipe` Card 1 "Got it" — `disabled={!ingredient}`,
  `aria-disabled={!ingredient ? 'true' : 'false'}`.
- `GuidedDiscoverySwipe` Card 2 "Got it" — `disabled={!chosen}`,
  `aria-disabled` set.
- `GuidedDiscoveryStart` "Show me pairings →" —
  `disabled={bubbleStack.length === 0}`, `aria-disabled` set.

### 9.3 `aria-live` announcers

| Component | Location | Trigger |
|---|---|---|
| `GuidedDiscoveryStart` | `data-testid="guided-aria-live"`, `role="status"` | "Added: {label}. N selection(s)." on bubble add; "Removed selection. N selection(s)." on remove |
| `GuidedFilterTypeCard` | `role="status"` ref | "Filtering by {label}" on pill select |
| `GuidedProfileRadar` | `data-testid="guided-radar-announce"` | "Highlighting pairings tagged {axis}" / "Showing all pairings on {filterType} axes" |
| `StoryPanel` | `aria-live="polite"` on the `region` itself | Re-fires on `story` change |

### 9.4 Keyboard / focus

- `ThoughtBubbleCard` uses `<details>`/`<summary>` so Enter/Space
  toggle works for free; `aria-expanded` follows the open prop.
- `GuidedProfileRadar` axis labels are `<button>` elements with
  visible focus rings; positioned absolutely outside the SVG so they
  participate in normal tab order.
- `GuidedResultsFilterPills` and `GuidedFilterTypeCard` use
  `role="radiogroup"` + `role="radio"` + `aria-checked`.
- `ProvenancePanel` traps focus visually via the backdrop overlay;
  ESC + close button + backdrop click all dismiss.

### 9.5 Touch targets

All tappable elements use `min-h-[44px]` (or `min-h-[32px]` for the
stack-chip removal buttons in `GuidedDiscoveryStart`'s chip strip).

### 9.6 Drop-count honesty (aroma radar)

When `filterType === 'aroma'` and pairings lack `gnnProbs`, those
pairings are dropped from the radar plot. The drop count is reported
to the parent via `onDropCount`. The current parent does not surface
this in the UI — see §11 Open Question O-3.

---

## 10. Tests covering the contract

| Test file | Covers |
|---|---|
| `src/data/__tests__/guidedRadarAxes.test.js` | `getAxesFor` reference equality (`getAxesFor('cuisine') === CATEGORICAL_AXES.cuisine.labels`); axis counts 4/6/8/8; `pairingMatchesAxis` per filter type; `coordsForPairing` null on missing `gnnProbs`; `getColorMapFor('aroma') === BRISCIONE_AROMA` |
| `src/data/__tests__/whyThisWorks.test.js` | Causal sentence always present; annotative sentence from bridge vs GNN fallback; `isAnnotativeCompoundUsedByRuntime` true/false; citation passthrough; surprise axes accumulation |
| `src/components/__tests__/GuidedFilterTypeCard.test.jsx` | 4 pills render; disabled "Got it" until pill picked; `onCommit(filterType)` fires; pill icon `getComputedStyle(el).width === '48px'`; aria-live announces on select |
| `src/components/__tests__/GuidedProfileRadar.test.jsx` | Axis count per `filterType`; no wedge filled at `chosenValue=null`; wedge fillOpacity `'0.55'`; matching opacity 1.0 / non-matching 0.35; mode-transition lifecycle (`null → 'sweet' → null` restores all-pairings-at-1.0); aroma drop on missing `gnnProbs` |
| `src/components/__tests__/GuidedResultsFilterPills.test.jsx` | 4 pills + current selection; single-select `aria-checked`; `onSelect(next)` fires only on different selection |
| `src/components/__tests__/GuidedDiscoveryStart.test.jsx` | Bubble grid renders the 9 registry entries; CTA disabled on empty stack; ingredient bubble does NOT collapse on pick; other bubbles auto-collapse |
| `src/components/__tests__/GuidedDiscoveryStart.a11y.test.jsx` | `aria-live` announcer fires on stack add/remove; CTA `aria-disabled` toggles |
| `src/components/__tests__/GuidedDiscoveryResults.test.jsx` | Negative: `CuratedWheel` NOT rendered; `MultiAxisRadarStack` NOT rendered. Positive: `GuidedProfileRadar` + `GuidedResultsFilterPills` + Provenance button render. Pill switch flips axis count + resets `chosenValue=null`. Chemistry banner fires when ≥50% heroes have `x3 === 0.5`. Bridge-stale spy on `deriveFilterStackFromBubbles` — never called with the new `{ingredient, filterType}` payload shape. |

### 10.1 Grep gates (codified verification, lesson `pipeline-rebuild-wipes-manual-data-additions` how=5)

| File | Pattern | Expected count |
|---|---|---|
| `src/components/GuidedDiscoveryResults.jsx` | `from.*GuidedTour` | **0** (ADR-4: GuidedTour replaced by ProvenancePanel here) |
| `src/components/GuidedDiscoveryResults.jsx` | `CuratedWheel` | **0** (Spec AC: removed) |
| `src/components/GuidedDiscoveryResults.jsx` | `MultiAxisRadarStack` | **0** |
| `src/components/GuidedDiscoveryResults.jsx` | `GuidedProfileRadar` | **≥ 1** |
| `src/components/GuidedDiscoverySwipe.jsx` | `BUBBLE_REGISTRY` | **0** (production swipe path never imports the registry) |
| `src/` (recursive) | `BUBBLE_REGISTRY` | **≥ 1** (preserved for Build flow + legacy GuidedDiscoveryStart) |

---

## 11. Open questions

All three escalated open questions from the original audit were resolved
by chef-user on 2026-05-27. The resolutions are recorded here for
lineage; the contract is what's specified in §§1–10 and §12 below.

### O-1 — Aroma axis-key remap location — RESOLVED

**Resolution (2026-05-27):** the remap lives inside
`deriveFilterStackFromBubbles` via a `REGISTRY_AXIS_TO_FILTER_AXIS`
table. `BUBBLE_REGISTRY` keeps its filterType-style `'aroma'` key
(which `GuidedDiscoveryResults`' radar consumes for axis labels);
the translator centralizes the `'aroma' → 'aromas'` rename when
emitting a network filterStack entry. The App.jsx `onAxisSelect`
inline remaps stay as-is — they translate the radar's
`filterType` argument directly and don't go through the translator.
Shipped in the `DOCS-GD-DM-RL` audit commit.

### O-2 — Double-action on axis tap — RESOLVED (follow-up task)

**Resolution (2026-05-27):** target behavior is **two-step commit
gesture** — first tap on an axis toggles the local `chosenValue`
(visual wedge fill + matching highlight on the radar) only; a
second tap on the same axis fires `onAxisSelect(filterType)` to
commit and jump to the network tab with `GuidedTour` activated.
The first-tap-is-visual-only contract eliminates the surface-bounce
on incidental taps and gives the user a way to compare wedge fills
across axes without losing context.

The audit commit does NOT implement the two-tap state machine —
that's tracked as a separate follow-up bridge task
`DOCS-GD-TWO-TAP`. Until the follow-up lands, the current
single-tap-jumps-to-network behavior persists (the spec describes
the target, not the in-flight legacy).

### O-3 — Aroma drop-count surfacing — RESOLVED

**Resolution (2026-05-27):** **leave silent.** The `onDropCount`
callback in `GuidedProfileRadar` remains wired but unconsumed.
Surfacing a "N of M pairings have no aroma model data" footnote
adds noise without giving the user an action they can take —
GNN coverage is a data-pipeline concern, not a user choice.
The callback stays in case a future surface needs it; no UI
change required.

---

## 12. Source spec lineage

This canonical spec consolidates two parallel planning eras that
both targeted the same feature from different angles. Where any
source disagrees with this spec, **this spec wins**.

### 12.1 Pairing-Audit + Guided Discovery generation (2026-05-13)

The original spec generation that introduced Guided Discovery as a
landing-card / bubble-flow / shared-wheel concept.

| Source spec | Status |
|---|---|
| `.omc/specs/deep-interview-pairing-audit-and-guided-discovery.md` | Superseded by §1, §2, §3.2 (`GuidedDiscoveryStart`), §8 |
| `.omc/plans/pairing-audit-and-guided-discovery-v2.md` (8 ADRs, Critic APPROVE iteration 2) | Implementation source for §3.2 (8-bubble grid), §8 (curated pairings + story), §11 (executor handoff constraint #4) |

Notable amendments folded into this canon:

- 9-bubble registry (`ingredient` + 8 others) with `axisHint` per
  entry. The "8 thought bubbles" in the original spec refers to the
  non-ingredient bubbles only.
- `RadialAffinityWheelGeometry` + `CuratedWheel` + `FullWheel`
  three-artifact decomposition (Plan v2 ADR-001) — only
  `CuratedWheel` survived for Guided's Screen 2 prior to the
  Track-3 overhaul, and now ships as the chemistry-banner predicate
  input only.
- `whyThisWorks` dual-sentence honesty model with
  `isAnnotativeCompoundUsedByRuntime` disclaimer chip.
- Single-banner chemistry disclaimer (vs. per-pair chips).
- LOCAL `bubbleFilterStack` rule (Constraint #4) — preserved in
  §5.

### 12.2 Track-3 Guided Overhaul (2026-05-18)

The second spec generation that pivoted the entry flow from the
8-bubble grid to the 2-card swipe (`GuidedDiscoverySwipe` +
`GuidedFilterTypeCard`) and replaced `CuratedWheel` with
`GuidedProfileRadar` as the Results hero.

| Source spec | Status |
|---|---|
| `.omc/specs/deep-interview-track-3-guided-overhaul.md` | Superseded by §3.1, §4 |
| `.omc/plans/ralplan-track-3-guided-overhaul.md` (5 ADRs incl. R2 ADR-5 fork, NEW10/NEW11 risks) | Implementation source for §3.1, §4, §7.2 |

Notable amendments folded into this canon:

- 3-screen pivot: ingredient → filter-type → results. Cards do
  NOT auto-advance.
- `GuidedProfileRadar` is a **fork** of `ProfileAxisRadar` (ADR-1).
- `GuidedResultsFilterPills` is a **fork** of `FilterPillRow`
  (ADR-5).
- Cuisine axes = the 8 buckets from `CATEGORICAL_AXES.cuisine.labels`
  (ADR-2).
- `ProvenancePanel` replaces `GuidedTour` invocation from the
  Results "where this data comes from" button (ADR-4).
- Inline hand-curated SVGs for icons (ADR-3).
- The bubble-grid `GuidedDiscoveryStart` survives the overhaul as a
  retired-but-tested alternative, per Critic concession (preserved
  alongside the swipe path).

### 12.3 Manual QA paths

`.omc/notes/guided-discovery-qa-checklist.md` — 12-path manual
walkthrough deferred to chef-user sign-off. References the 5-tile
landing screen (since superseded by the 3-tile landing per
`plan.md`); paths 1–6 still describe the canonical user journey.

### 12.4 Architecture context

- `.claude/CLAUDE.md` — top-level architecture overview; Guided
  Discovery is reached via the top-level "Guided" tab + landing tile.
- `plan.md` (root, lines 1-46) — Seamless UX Pipeline establishing
  the 3-tile landing (`Explore the Network` / `Guided Discovery` /
  `Build your Recipe`) and the top-level tab structure that hosts
  Guided.

### 12.5 Two-era reconciliation note

Both source-spec families describe **the same feature** at different
planning eras. The pairing-audit generation (2026-05-13) drew up the
bubble registry, the shared wheel, the story honesty model, and the
audit harness; the Track-3 overhaul (2026-05-18) replaced the
bubble grid with the swipe + radar surface. The current production
build runs the Track-3 overhaul's Screen 1 and Screen 2 while
preserving the pairing-audit generation's data layer
(`whyThisWorks`, `selectCuratedPairings`, `BUBBLE_REGISTRY`).

Both are listed here as legitimately superseded — neither is dead
context, but neither remains authoritative on its own.

---

## How to revise this spec

1. Edit this file directly.
2. Bump the "Last revised" date at the top.
3. Source specs in `.omc/specs/` and `.omc/plans/` remain as
   historical artifacts — do NOT update them.
4. Update tests, code, and any external docs to match this spec.

When the spec is in conflict with the shipped code:

1. Check whether the code is wrong (open an issue + fix).
2. Or whether this spec is wrong (open a spec-revision PR).
3. Never silently align one to match the other — make the
   divergence explicit.
