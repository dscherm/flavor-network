# Deep Interview Spec: Suggestions Tab — ADD/REPLACE Parent Layer

## Metadata
- Interview ID: `r15-3-suggestions-add-replace`
- Rounds: 3
- Final Ambiguity Score: ~15% (under 20% threshold)
- Type: brownfield (extends existing `SuggestionDrawer.jsx`)
- Generated: 2026-05-02
- Threshold: 0.2
- Status: PASSED
- Bridge task: R15-3 (pipeline `347b338b`, plan `new_pipeline_may_2.md`)

## Clarity Breakdown
| Dimension | Score | Weight | Weighted |
|-----------|-------|--------|----------|
| Goal Clarity      | 0.95 | 0.35 | 0.333 |
| Constraint Clarity| 0.80 | 0.25 | 0.200 |
| Success Criteria  | 0.70 | 0.25 | 0.175 |
| Context Clarity   | 0.92 | 0.15 | 0.138 |
| **Total Clarity** |      |      | **0.846** |
| **Ambiguity**     |      |      | **0.154 (~15%)** |

## Goal

Add a **visible ADD/REPLACE toggle pill** at the top of `SuggestionDrawer`,
where:

- **REPLACE mode preserves the existing per-bowl-ingredient column layout
  exactly as it ships today** (`SuggestionDrawer.jsx:461-624`,
  commits `a2624c3` + `e54cfd7`). No changes to ranking, filtering, scope,
  or "No suggestions" empty state.
- **ADD mode is net-new**: an 8-column grid keyed by taste — Sweet, Sour,
  Bitter, Salty, Umami, Spicy, Pungent, Astringent — mirroring REPLACE's
  layout but using **taste category** as the column header instead of
  bowl-ingredient name. Each column shows top-K candidates fitting that
  taste, ranked by pairing strength to the whole bowl.
- **Default mode is bowl-size driven**: empty bowl forces ADD (REPLACE has
  nothing to replace). Bowl with 1+ items defaults to REPLACE. Once the
  user manually flips the toggle, that choice **sticks until the bowl
  empties**, then resets to the default rule.
- Both modes apply existing taste/aroma/cuisine filters; cocktail mode
  hides the cuisine filter in both (already implemented at `:243`/`:714`).
- Both modes never suggest an ingredient already in the recipe (already
  enforced for REPLACE at `:606`; needs equivalent enforcement in the new
  ADD path).
- "Most likely to pair" is surfaced **implicitly** as the top-of-column
  position in each taste column (no new badge/sort UI). Existing
  `rankByRecipeCooccurrence` from `recipeSuggestionEngine.js:26-65`
  drives the ranking.

The toggle is **drawer-local state** — RecipeLabMobile owns nothing
new; the pill, mode value, and stickiness logic all live inside
`SuggestionDrawer.jsx`.

## Defined Variables

### Mode resolution
```
mode ∈ {'ADD', 'REPLACE'}
manualMode ∈ {null, 'ADD', 'REPLACE'}     // null = follow default rule

resolveMode(bowlSize, manualMode):
  if manualMode !== null: return manualMode
  if bowlSize === 0: return 'ADD'
  return 'REPLACE'

onToggle(newMode):
  manualMode = newMode

onBowlEmpty():
  manualMode = null    // resets stickiness
```

### ADD mode column structure
```
TASTE_COLUMNS = ['sweet', 'sour', 'bitter', 'salty', 'umami', 'spicy', 'pungent', 'astringent']
ADD_TOP_K_PER_COLUMN = 12   // matches REPLACE's column cap
```

For each column `t`:
```
candidates(t, bowl) =
  rankByRecipeCooccurrence(allCandidates, bowl)
    .filter(c => c.dominantTaste === t)
    .filter(c => !bowl.includes(c.name))         // never suggest already-in-recipe
    .filter(c => scopeFilter ? scopeFilter.has(c.name.toLowerCase()) : true)
    .slice(0, ADD_TOP_K_PER_COLUMN)
```

Where `dominantTaste(c)` = the taste with highest probability in
`c.taste` (existing field on graph nodes; falls back to `'best'`
bucket if no clear dominant).

### Filter behavior
- Taste/Aroma/Cuisine filter pills stay in current header position.
- Cocktail mode hides Cuisine pill in both ADD and REPLACE (existing
  behavior preserved).
- Filters apply BEFORE the per-column slice in ADD mode; columns with
  zero candidates after filtering render as `(empty)` placeholder
  rather than disappearing entirely (preserves the 8-column visual
  rhythm).

## Constraints

### Toggle UI
- Pill placement: **top of SuggestionDrawer header**, immediately above
  the existing filter pill row (Filter by Taste/Aroma/Cuisine).
- Visual: `[ADD] [REPLACE]` two-button segmented control. Active mode
  has cyan background + white text (matches existing tab-active style
  in the project palette).
- ARIA: `role="tablist"`, each pill `role="tab"` with
  `aria-selected={mode === t}`.
- Keyboard nav: ←/→ arrow keys flip mode when toggle is focused.
- Touch target: ≥44px height (matches existing min-height on
  cluster pills + REPLACE chips).

### Mode-switch behavior
- Toggling resets nothing else — taste/aroma/cuisine filter selections
  persist across mode flips.
- Toggling does NOT cause camera flight, panel close, or any side
  effects outside the drawer.
- Switching from ADD ←→ REPLACE while filters are active: the filter
  pill row re-renders (taste/aroma/cuisine all still apply), but the
  candidate list rebuilds against the new mode's data flow.

### Default rule (codified)
```
useEffect(() => {
  if (bowlSize === 0 && manualMode !== null) {
    setManualMode(null);    // reset stickiness when bowl empties
  }
}, [bowlSize, manualMode]);

const mode = resolveMode(bowlSize, manualMode);
```

### Brownfield preservation
- **REPLACE's existing logic untouched**: the `replaceColumns` useMemo
  at `SuggestionDrawer.jsx:461-624`, the `handleSwapIngredient` handler
  at `RecipeLabMobile.jsx:231`, and the per-bowl-ingredient column
  headers at `:814-858` all stay as-is.
- **ADD's existing fallback rendering** (the single grid of
  `filteredChips + complementChips` at `:796-900`) is **replaced** by
  the new 8-column taste grid when ADD mode is active. The legacy
  single-grid is removed (it was the implicit empty-bowl fallback;
  ADD now always renders the 8-column structure even when bowl is
  empty).
- Scope filter (`scopeFilter` prop) flows into both modes unchanged.
- Cocktail-mode cuisine hide (already at `:243`/`:714`) stays.

### Performance
- ADD mode rebuild on bowl change: must complete in <50ms (matches
  REPLACE's existing budget). `rankByRecipeCooccurrence` is already
  O(N) over candidates; the new per-taste filter+slice is O(N) once.
  Total: ~3,913 × 8 = 31K filter ops + 8 sorts on bounded subsets.

## Non-Goals
- **NOT replacing REPLACE's column structure** — the per-bowl-ingredient
  columns stay exactly as shipped.
- **NOT adding multi-select on chips in ADD mode** — single tap = single
  add (preserves existing `onAddIngredient(name)` contract).
- **NOT introducing a new ranking signal** for "most likely to pair" —
  the existing `rankByRecipeCooccurrence` engine drives both modes;
  "most likely" is the top of each column visually.
- **NOT moving the toggle to RecipeLabMobile** — drawer-local state
  was explicitly chosen to keep RecipeLabMobile unchanged.
- **NOT introducing a "best match" / "any taste" extra column** — the
  8 tastes are exhaustive; candidates without a dominant taste either
  fall to a default column or are dropped (executor's choice with a
  documented fallback).
- **NOT animating mode transitions** — mode flip is instant.

## Acceptance Criteria

### Toggle UI
- [ ] An `[ADD] [REPLACE]` segmented pill appears at the top of
  `SuggestionDrawer`, above the filter pills.
- [ ] Active mode pill has cyan background + white text (matches
  existing active-tab style).
- [ ] Pills have `role="tab"`, `aria-selected` reflects the active
  mode, and ←/→ arrow keys flip mode when the toggle is focused.
- [ ] Each pill ≥44px tall (touch target).

### Default rule
- [ ] Empty bowl: ADD is active and REPLACE pill is disabled (or
  visually de-emphasized) since REPLACE has nothing to replace.
- [ ] Bowl with 1+ items: REPLACE is the default unless user has
  manually flipped to ADD.
- [ ] After manual flip to ADD with 2+ items: ADD persists across
  bowl additions/removals until the bowl reaches 0; on empty, the
  manual choice resets and the default rule re-applies.

### ADD mode rendering
- [ ] 8 columns visible, headers = Sweet | Sour | Bitter | Salty |
  Umami | Spicy | Pungent | Astringent.
- [ ] Each column shows up to 12 candidates ranked by
  `rankByRecipeCooccurrence` strength to the current bowl.
- [ ] Empty columns render as a placeholder (e.g., dim "—" or
  italic "no candidates") rather than collapsing.
- [ ] No candidate appearing in the column matches an ingredient
  already in the bowl.
- [ ] In cocktail mode, the cuisine filter pill is hidden (existing
  behavior, both modes).
- [ ] Scope filter (cocktail/sauce ingredient subsets) applies in
  ADD mode just as in REPLACE.

### REPLACE mode preservation
- [ ] All existing REPLACE acceptance criteria pass unchanged: per-
  bowl-ingredient columns, "Replace [name]" headers, "No suggestions"
  empty state, swap chip behavior calling
  `onSwapIngredient(target, newName)`.
- [ ] No regression in the cocktail/sauce scope filtering behavior.
- [ ] No regression in the existing taste/aroma/cuisine filter
  behavior in REPLACE mode.

### Cross-platform & a11y
- [ ] Toggle works on touch (iOS) and click (desktop) — single tap to
  flip.
- [ ] Mode is announced via `aria-live` region or via the
  `aria-selected` change on the tab pills.
- [ ] No memory leaks: 100 mode flips on a bowl of 5 ingredients
  does not increase retained heap (mirror the
  `AffinityMode.perf.test.js` pattern).

### Performance
- [ ] ADD mode rebuild on bowl-change ≤50ms (CPU) on a 2020-era
  laptop; measured with `performance.mark`.
- [ ] Mode toggle (no bowl change) ≤16ms (one frame).

## Implementation Plan (for executor / ralplan stage)

### New files
1. `src/components/SuggestionDrawerToggle.jsx` — small presentational
   pill component, props `{ mode, onChange, bowlSize }`. Pure UI;
   no business logic.
2. `src/data/__tests__/suggestionAddMode.test.js` — Vitest coverage
   for: column slicing, dominant-taste assignment, already-in-bowl
   exclusion, empty-column placeholder.

### Files to modify
1. `src/components/SuggestionDrawer.jsx`:
   - Add `manualMode` state + `mode` derived value (lines around 195
     where other state lives).
   - Add `resetOnEmpty` `useEffect`.
   - Render `<SuggestionDrawerToggle>` at the top of the header
     (above the filter pill row currently at `:708-728`).
   - Branch the main render: if `mode === 'REPLACE'`, render existing
     `replaceColumns` block (`:796-900` becomes
     `:796-900` REPLACE-only branch).
   - If `mode === 'ADD'`, render new 8-column taste grid built from
     `addColumns` useMemo (mirrors `replaceColumns` structure).
2. `src/data/recipeSuggestionEngine.js`:
   - Export new `rankAddByTaste(candidates, bowl, ctx, opts)` that
     calls existing `rankByRecipeCooccurrence` then partitions into
     8 taste buckets with the `dominantTaste` filter + already-in-bowl
     exclusion + scope filter.
3. (No changes to `RecipeLabMobile.jsx`.)

### Phasing
- **Phase 1 (1 day)**: Ship `SuggestionDrawerToggle` + `manualMode`
  state + default rule. ADD mode renders the EXISTING single-grid
  fallback (no new layout yet). Validates the toggle UX in isolation.
- **Phase 2 (1 day)**: Ship `rankAddByTaste` + 8-column grid render
  in ADD mode. Existing single-grid fallback removed.
- **Phase 3 (0.5 day)**: A11y polish — ARIA roles, keyboard nav,
  empty-column placeholder, perf measurement.

Total: 2.5 days.

## Risks / Notes for Executor

1. **Dominant-taste assignment edge case**: ingredients without a
   clear dominant taste (multi-taste blends like "fennel" or "ginger")
   need a deterministic tie-break. Recommend: `Object.entries(taste)
   .sort((a,b) => b[1]-a[1])[0]` with random seeded by ingredient
   name on exact ties. Document in code which taste each tie-broken
   ingredient lands in.
2. **Empty-bowl ADD ranking**: when bowl is empty,
   `rankByRecipeCooccurrence` has no signal. Recommend: fall back to
   `globalCount` (raw ingredient frequency in corpus) so the columns
   still show meaningful "popular sweet ingredients" / "popular sour
   ingredients" / etc.
3. **Cocktail/sauce mode column counts**: the 8-taste structure
   applies the same way, but the candidate pool is shrunk by the
   scope filter. Some columns (e.g., "umami" in cocktails) may
   render mostly empty. The `(empty)` placeholder must be
   informative: "No umami options in cocktail scope" rather than
   blank.
4. **Toggle disabled state when bowl is empty**: REPLACE pill should
   be visibly disabled (not just grayed) when bowl is 0 — clicking
   it should be a no-op or toast "Add an ingredient first." Don't
   silently swallow the click.
5. **Filter persistence regression risk**: the existing filter state
   is stored in component-local state, so it survives mode flips by
   default. Verify this with manual QA — if a future refactor moves
   filters to context, this regression vector reopens.
6. **Scope filter prop threading**: `scopeFilter` is currently passed
   down from `RecipeLabMobile`. The new ADD path must consume it
   identically — don't accidentally hard-code the cocktail/sauce
   subset list in `rankAddByTaste`.
7. **Performance regression from 8 sorts vs. 1**: the 8-column
   structure does 8 sorts over taste-filtered subsets instead of
   one big sort. On the 3,913-ingredient catalog this is fine
   (~30K total ops), but if the catalog grows past 10K, consider
   a single-pass partition.
8. **A11y for the tab semantics**: `role="tablist"` with
   `role="tab"` children REQUIRES a corresponding
   `role="tabpanel"` for the rendered content. Add `aria-controls`
   linking each tab to the panel ID. Skipping this triggers axe
   warnings.

## Ontology (Final Entities)

| Entity | Type | Fields | Relationships |
|--------|------|--------|---------------|
| SuggestionDrawer | core controller | `mode`, `manualMode`, `bowlSize`, `filters` | owns ParentToggle; renders AddMode XOR ReplaceMode |
| ParentToggle | view object | `mode`, `disabledMode` | inside SuggestionDrawer header; emits `onToggle(mode)` |
| AddMode | render branch | `columns: TasteColumn[8]` | uses `rankAddByTaste`; hidden when mode='REPLACE' |
| ReplaceMode | render branch | `columns: BowlIngredientColumn[N]` | unchanged; hidden when mode='ADD' |
| TasteColumn | view object | `taste`, `candidates: Candidate[≤12]`, `placeholder?` | one per taste in ADD mode |
| BowlIngredientColumn | view object | `bowlIngredient`, `candidates: Candidate[≤12]` | one per bowl ingredient in REPLACE mode (unchanged) |
| TasteFilter | filter pill | `selectedTastes: Set<string>` | applies in both modes |
| AromaFilter | filter pill | `selectedAromas: Set<string>` | applies in both modes |
| CuisineFilter | filter pill | `selectedCuisines: Set<string>` | applies in both modes EXCEPT cocktail-mode |
| ScopeFilter | hidden controller | `Set<string> | null` | applies in both modes when active |

## Ontology Convergence
| Round | Entity Count | New | Changed | Stable | Stability |
|-------|-------------|-----|---------|--------|----------------|
| 1 | 4 | 4 | - | - | N/A |
| 2 | 5 | 1 (TasteColumn) | 0 | 4 | 80% |
| 3 | 10 | 5 (BowlColumn, 4 filter entities) | 0 | 5 | 50% |

Round 3's lower stability ratio reflects the addition of granular filter
entities at crystallization-time, not domain instability. The core 5
entities from rounds 1-2 (SuggestionDrawer, AddMode, ReplaceMode,
ParentToggle, TasteColumn) are 100% stable through all rounds.

## Interview Transcript

<details>
<summary>3 rounds of Q&A</summary>

### Round 1 — Goal scope
**Q**: REPLACE behavior already auto-engages today — when bowl ≥1, SuggestionDrawer.jsx renders one swap column per bowl ingredient. So when you say "add a parent ADD/REPLACE layer", what do you actually want?
**A**: ADD is the new mode, REPLACE stays as-is.

### Round 2 — ADD layout
**Q**: ADD mode layout — your spec says ADD buckets by "Taste categories like what exists now for replace", but REPLACE buckets by recipe ingredient. Which layout matches what you're picturing?
**A**: Mirror REPLACE: one column per taste (Sweet/Sour/Bitter/Salty/Umami/Spicy/Pungent/Astringent).

### Round 3 — Toggle UX
**Q**: Where does the toggle live, and how does it default when bowl changes?
**A**: Drawer-header pill, default by bowl size (empty→ADD, 1+→REPLACE), sticks on manual flip until bowl empties.

</details>

---

## Pipeline next step

Per the deep-interview skill chain, this spec hands off to
**`/oh-my-claudecode:omc-plan --consensus --direct`** for multi-agent
plan refinement, then **`/oh-my-claudecode:autopilot`** for execution.
The phasing is small (2.5 days, single drawer file plus one test
file), so direct **autopilot** without ralplan consensus is also
reasonable — the spec is concrete enough that consensus refinement
is unlikely to yield material changes.
