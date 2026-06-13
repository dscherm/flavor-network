# Deep Interview Spec: Network View Consolidation + Filter Layer + Hub-Gap Fix

## Metadata
- Interview ID: `r16-1-network-filter-consolidation`
- Rounds: 7
- Final Ambiguity Score: ~13.8% (under 20% threshold)
- Type: brownfield (modifies LivingArchView, networkModes, App.jsx, HowItWorks, IngredientPanel)
- Generated: 2026-05-11
- Threshold: 0.2
- Initial Context Summarized: no
- Status: **PASSED**
- Prior commit (rolled back conceptually, kept as working ref): `8749a3f`

## Clarity Breakdown
| Dimension | Score | Weight | Weighted |
|-----------|-------|--------|----------|
| Goal Clarity | 0.92 | 0.35 | 0.322 |
| Constraint Clarity | 0.85 | 0.25 | 0.213 |
| Success Criteria | 0.80 | 0.25 | 0.200 |
| Context Clarity | 0.85 | 0.15 | 0.128 |
| **Total Clarity** | | | **0.862** |
| **Ambiguity** | | | **0.138 (~13.8%)** |

## Goal

Replace the **8-entry Network mode dropdown** (3D/2D Pairings + 3D/2D Flavors + 4 categorical wheels) with a **two-tier control surface**:

- **Top tier — Mode picker (2 entries only):** `[ 3D ]` `[ 2D ]`
- **Second tier — Filter pill row:** `[None] [Aroma] [Cuisine] [Season] [Family] [Taste] [Cocktail Scope] [Sauce Scope]`

The categorical wheels are **preserved as visual outputs** (the sub-disc phyllotaxis layout from `categoricalWheelPositions.js` and the bucket-color machinery in `categoricalAxes.js` stay shipped). They are no longer mode siblings — they are **morph overlays** triggered by the filter pill row.

When one or more filter pills are active:
- The visible node set narrows to the **strict intersection** of every active filter.
- The **most-recently-activated** filter's bucket layout drives the morph (sub-discs on a ring).
- A **breadcrumb** above the scene tracks the active path: `All › European › Summer › Fruity`.
- Deselecting the most recent filter rewinds the breadcrumb and morphs back to the previous filter's layout (or to the cooccurrence default when the stack empties).

Compound-food ingredients (1,123 hub ingredients with no GNN prediction) get a **"Predicted from components"** badge in `IngredientPanel` driven by the existing `compoundFoods.js` constituent map. The badge surfaces a synthesized aroma/taste profile so these ingredients still respond to filter pills.

HowItWorks copy is rewritten to reflect the actual color logic (cluster colors in Pairings mode, taste/bucket colors when a filter is active) via a small **mode-aware contextual chip** in the panel header.

## Defined Variables

### Mode-picker state
```
mode ∈ { '3D', '2D' }                       // 2 entries, drops the wheels as siblings
defaultMode = '3D'                          // cooccurrence layout on first load
```

### Filter pill state
```
FILTERS = ['aroma', 'cuisine', 'season', 'family', 'taste', 'cocktail-scope', 'sauce-scope']
filterStack = []                            // ordered, deduplicated
activeFilter = filterStack.at(-1) || null   // drives the morph layout

toggleFilter(f):
  if filterStack.includes(f):
    filterStack = filterStack.filter(x => x !== f)
  else:
    filterStack = [...filterStack, f]

clearAllFilters():
  filterStack = []
```

### Visibility predicate
```
isVisible(node):
  return filterStack.every(f => bucketOf(f, node) !== null)
```

### Morph driver
```
positions(node):
  if activeFilter == null: return cooccurrencePos[node.name]   // ml / ml2d default
  return categoricalWheelPositions[activeFilter][node.name]
```

### Breadcrumb
```
breadcrumb = [
  'All',
  ...filterStack.map(f => activeBucketFor(f) ?? capitalize(f))
]
```

When the user selects a specific bucket (via the existing `ClusterJoystick` pills), the breadcrumb deepens:
```
['All', 'European']                   // user clicked Cuisine pill, then 'European' pill
['All', 'European', 'Summer']         // then added Season filter, clicked 'Summer'
['All', 'European', 'Summer', 'Fruity']  // then added Aroma, clicked 'Fruity'
```

### Compound-food predictor
```
predictFromComponents(name):
  constituents = compoundFoodsMap[name] || null
  if constituents == null: return null
  // weighted-average the constituents' GNN probs by mass-fraction
  return aggregateProbs(constituents, gnnEntropy)
```

`IngredientPanel` shows the badge `Predicted from components` when this synthesizer returns a non-null profile AND the ingredient has no direct GNN prediction.

## Constraints

### Scope
- **Network tab only.** Cocktail Lab and Sauce Lab tabs stay independent with their own 3D scenes. They are not absorbed into this consolidation.
- **`MODE_CYCLE` shrinks to `['3D', '2D']`.** The 8 existing keys (`ml`, `ml2d`, `neural`, `taste2d`, `aromas2d`, `cuisine2d`, `season2d`, `family2d`) are mapped internally to (mode × activeFilter) pairs.
- **Existing wheel infrastructure preserved.** `categoricalAxes.js`, `categoricalWheelPositions.js`, the per-bucket color caches, label sprite builders, and the transition animator all keep their current shape.
- **`ClusterJoystick` pills follow `activeFilter`.** With no filter active, the joystick shows the 10 ML cluster pills. With a filter active, it shows that axis's bucket pills (preserves the work from commit `8749a3f`).

### Filter combination semantics
- Filters compose as **strict intersection (AND)**. Italian + Summer + Fruity = only nodes matching all three buckets. Empty intersection renders an "(no matches)" state — do not silently filter to nothing.
- **`cocktail-scope` and `sauce-scope`** are special pills that restrict the corpus to ingredients used in cocktails/sauces respectively. They compose AND with the other filters.
- **No upper bound** on how many filters can stack. UI must remain readable when 5+ pills are active (overflow gracefully; ellipsis in the breadcrumb after 4 levels).

### Layout & animation
- Filter activation triggers a **morph animation** (≤1.6s, reusing the existing transition machinery in `LivingArchView.jsx`).
- Removing the most-recent filter morphs back to the previous filter's layout (or cooccurrence when the stack empties).
- "None" pill is a hard-reset: clears the entire `filterStack` and morphs back to cooccurrence in one animation.

### Performance
- Filter pill toggle must produce a frame ≤16ms (UI responsiveness).
- Morph animation runs at 60fps on a 2020-era laptop. Mobile gracefully reduces to 30fps.
- Bucket-membership lookup is O(1) via existing `bucketOf` Maps — no rebuild on every frame.

### A11y
- Each filter pill has `role="checkbox"` with `aria-checked` reflecting active state.
- Pill row has `role="group"` with `aria-label="Filter by"`.
- Active-filter changes announced via `aria-live="polite"` so screen readers track morphs.
- Mode picker (`3D` / `2D`) is a `role="radiogroup"`.

### Compound-food predictor
- Runs once per ingredient at data-load time (no per-frame cost).
- `IngredientPanel` shows the badge with a tooltip explaining the synthesis ("Computed from N constituents: …").
- Filter pills (aroma/taste) honor the predicted profile — a compound food with predicted "fruity" appears in the Fruity bucket alongside directly-measured nodes.
- Constituents below a confidence threshold (mass-fraction < 0.05) are excluded from the aggregation.

### HowItWorks copy
- Replace the line `Colors show taste profiles:` with mode-aware copy:
  > "Color depends on what you're looking at. In Pairings mode, color shows the cluster a recipe lives in. Apply a filter (aroma, cuisine, season, family, taste) and the colors switch to that filter's buckets."
- Add a small **contextual chip** in the scene's header reading `Colors: clusters` (default) or `Colors: aroma buckets` / `Colors: cuisine regions` etc. when a filter is active.

## Non-Goals
- **NOT consolidating Cocktail Lab + Sauce Lab into the Network tab.** They stay independent.
- **NOT adding encoder-swap modeling work (ChemBERTa / MolFormer).** Deferred per chemDataset.md decisions.
- **NOT scraping more weak-head taste data.** v3 hit the ceiling on odor_spicy / odor_floral.
- **NOT introducing OR / NOT logical operators** between filters. Only AND-intersection.
- **NOT animating mode flip (3D ↔ 2D).** Existing instant transition is fine.
- **NOT adding new filter dimensions beyond the 7 listed** (aroma, cuisine, season, family, taste, cocktail-scope, sauce-scope). Saved-filter-preset persistence is a v2 follow-up.
- **NOT changing the existing fly-to / camera tour behavior** — joystick pills still drive `setFlyToTarget`.

## Acceptance Criteria

### Mode picker
- [ ] Network tab's mode dropdown has **exactly 2 entries**: `3D` and `2D`.
- [ ] Clicking either entry switches the layout instantly (no morph).
- [ ] On fresh page load, `3D` is selected and the cooccurrence layout renders.

### Filter pill row
- [ ] A pill row appears below the mode picker with: `None`, `Aroma`, `Cuisine`, `Season`, `Family`, `Taste`, `Cocktail Scope`, `Sauce Scope`.
- [ ] Pills are independently toggleable (multi-select).
- [ ] Selecting `None` clears all active pills in one click and morphs back to cooccurrence.
- [ ] Active pills get a visible "selected" state (background + border).
- [ ] At least one filter active hides edges + particles (preserve current Phase 2 behavior).

### Filter combination
- [ ] When 2+ pills are active, only nodes in the **intersection** of every active filter are visible.
- [ ] Non-matching nodes are hidden (alpha 0), not just dimmed.
- [ ] Empty intersection shows an `"(no ingredients match these filters)"` overlay; the morph still runs to the empty wheel.
- [ ] The **most-recently-activated** filter drives the morph layout (its buckets become the sub-disc ring).
- [ ] Deactivating the most recent filter morphs back to the previous filter's layout.

### Breadcrumb
- [ ] A breadcrumb strip above the scene reads `All › <Filter1> › <Filter2> › …` reflecting the filter stack.
- [ ] Clicking any breadcrumb segment pops the stack back to that level.
- [ ] Breadcrumb truncates with `…` after 4 levels on mobile, 6 on desktop.

### Compound-food predictor
- [ ] `IngredientPanel` shows a `Predicted from components` badge for any ingredient with no direct GNN prediction but a non-null constituent map.
- [ ] Hovering the badge reveals a tooltip listing the constituent ingredients.
- [ ] Compound-food ingredients appear in the correct bucket when aroma/taste filters are active (e.g., mayonnaise appears in `Fatty` aroma bucket).
- [ ] At least 800 of the 1,123 hub ingredients gain a predicted profile (≥71% coverage).

### HowItWorks copy
- [ ] The legacy line `Colors show taste profiles:` is removed.
- [ ] The new copy mentions BOTH cluster-color and filter-color modes.
- [ ] A `Colors: …` chip appears in the scene's header, updating to match the active filter (or `Colors: clusters` when no filter is active).

### Cross-platform & a11y
- [ ] Touch and click both toggle pills on a single tap.
- [ ] Filter activation announces via `aria-live` ("Filter: cuisine applied. 412 ingredients matching.").
- [ ] No memory leaks: 50 sequential filter toggles do not grow retained heap (mirror the existing `AffinityMode.perf.test.js` pattern).

### Performance
- [ ] Pill toggle responds within 16ms (one frame).
- [ ] Morph animation completes in ≤1.6s and stays ≥30fps on a 2020-era laptop.
- [ ] Compound-food predictor adds ≤200ms to initial data-load time (one-shot at startup).

## Implementation Plan (handoff to executor)

### Files to modify
1. **`src/data/networkModes.js`** — collapse `MODE_CYCLE` to `['3D', '2D']`; introduce parallel `FILTER_KEYS` constant.
2. **`src/components/LivingArchView.jsx`** — add `activeFilter` prop; route position lookup through the existing `posForMode` table indexed by (mode × activeFilter); thread the filter stack into the visibility predicate.
3. **`src/components/ClusterJoystick.jsx`** — already mode-aware; extend to read `activeFilter` for pill source.
4. **`src/App.jsx`** — replace `livingMode` with `(mode, filterStack)` tuple; derive `joystickClusters` from `activeFilter`; pass `filterStack` to LivingArchView.
5. **`src/components/HowItWorks.jsx`** — rewrite color paragraph; render the contextual chip.
6. **`src/components/IngredientPanel.jsx`** — add `PredictedFromComponentsBadge` next to the existing odor row.
7. **`src/data/compoundFoods.js`** — extend if needed; ensure `aggregateProbs` helper is exported.

### New files
1. **`src/components/FilterPillRow.jsx`** — presentational pill strip, props `{ activeFilter, filterStack, onToggle, onClear }`.
2. **`src/components/FilterBreadcrumb.jsx`** — breadcrumb strip, props `{ filterStack, onPop }`.
3. **`src/data/compoundFoodPredictor.js`** — pure function `predictFromComponents(name) → ProbVector | null`.
4. **`src/data/__tests__/compoundFoodPredictor.test.js`** — vitest coverage on aggregation, edge cases, threshold.

### Phasing
- **Phase 1 (1 day)** — Mode picker collapse + filter pill row + AND-intersection visibility. Animation reuses existing transition machinery. No breadcrumb. No compound predictor.
- **Phase 2 (1 day)** — Breadcrumb + cocktail-scope + sauce-scope pills + joystick wired to activeFilter.
- **Phase 3 (1 day)** — Compound-food predictor + IngredientPanel badge + HowItWorks copy rewrite.
- **Phase 4 (0.5 day)** — A11y polish, perf measurement, manual QA across 3D/2D + every filter permutation.

Total: 3.5 days.

## Risks / Notes for Executor

1. **Filter stack on mode flip.** Switching `3D ↔ 2D` should preserve `filterStack` (user expects the same filter to keep applying). Verify the existing mode-change useEffect in App.jsx doesn't clear filters.
2. **Pseudo-cluster ID collisions.** The joystick assigns `-100 - i` per axis. When activeFilter changes, the focused cluster must reset to avoid a stale `-105` carrying into a different axis. The reset useEffect added in commit `8749a3f` already handles this — keep it.
3. **Compound-food aggregation tiebreaks.** When two constituents are equally weighted and have opposite dominant tastes (e.g., honey-mustard: sweet + pungent), the predictor must surface multi-taste rather than collapse to one. Use the existing `taste` field's space-delimited string convention.
4. **Breadcrumb-vs-pill source of truth.** The breadcrumb is **derived** from `filterStack`. Don't add a separate state for the breadcrumb path — it always reflects the stack.
5. **Edge/particle visibility.** Already hidden in `MODE_IS_CATEGORICAL`. Update the predicate to "any filter active in the stack" instead.
6. **Empty intersection UX.** Show an overlay, not a blank canvas. Otherwise users assume the filter is broken.
7. **HowItWorks chip placement.** It must read at-a-glance — top-left of the scene header, same row as the mode picker. Don't shove it into the help dialog.
8. **`MODE_IS_CATEGORICAL` deprecation.** With the new architecture, every filter is "categorical" in the old sense. Replace the set with a `filterStack.length > 0` check or rename it `HAS_ACTIVE_FILTER`.

## Ontology (Final Entities)

| Entity | Type | Fields | Relationships |
|--------|------|--------|---------------|
| ModePicker | UI control | `mode: '3D'\|'2D'` | sibling of FilterPillRow |
| FilterPillRow | UI control | `pills: Filter[8]`, `activeStack: Filter[]` | emits toggle events to App.jsx |
| Filter | enum value | `key`, `label`, `axis` | one per dimension |
| FilterStack | state | `filters: Filter[]` (ordered) | drives visibility + morph |
| BucketWheel | layout output | `centroids`, `members`, `positions` | one per active filter |
| Bucket | layout primitive | `label`, `color`, `members[]` | many-to-one with BucketWheel |
| Breadcrumb | UI control | `segments: string[]` | derived from FilterStack |
| ClusterJoystick | UI control | `pills`, `activeFilter` | reads activeFilter from FilterStack |
| LivingArchView | scene host | `mode`, `filterStack` | consumes both top-tier states |
| CooccurrenceLayout | layout default | `positions` | active when filterStack empty |
| CompoundFoodPredictor | function | `(name) → ProbVector \| null` | called at data-load |
| PredictedFromComponentsBadge | UI element | `tooltip` | inside IngredientPanel |
| HowItWorksCopy | UI text | `text`, `contextualChip` | reflects activeFilter |
| CocktailLab | independent tab | unchanged | siblings of Network |
| SauceLab | independent tab | unchanged | siblings of Network |

## Ontology Convergence
| Round | Entity Count | New | Changed | Stable | Stability |
|-------|-------------|-----|---------|--------|-----------|
| 1 | 7 | 7 | — | — | N/A |
| 2 | 8 | 1 (FilterStack) | 0 | 7 | 88% |
| 3 | 8 | 0 | 0 | 8 | 100% |
| 4 | 8 | 0 | 0 | 8 | 100% |
| 5 | 10 | 2 (ModePicker, FilterPillRow) | 0 | 8 | 80% |
| 6 | 13 | 3 (Breadcrumb, ScopePill→Filter, FilterPreset) | 0 | 10 | 77% |
| 7 | 15 | 2 (CompoundFoodPredictor, PredictedFromComponentsBadge) | 0 | 13 | 87% |

Convergence trend: stability climbs to 100% in rounds 3–4, dips when adding UI controls (rounds 5–6) and modeling entities (round 7), then stabilizes again. The 5 most stable entities (Filter, FilterStack, BucketWheel, LivingArchView, CooccurrenceLayout) appear unchanged from round 2 onward.

## Assumptions Exposed & Resolved
| Assumption | Round | Resolution |
|------------|-------|------------|
| "Filters dim nodes" was the natural reading | 1 | False — user wants morph layout |
| Multi-filter is OR or layered axes | 2 | False — strict AND-intersection |
| 1×3D + 1×2D consumes Cocktail/Sauce labs | 3 | False — Labs stay independent |
| Wheels should be deleted | 4 | False — wheels preserved as morph outputs |
| Dropdown bloat is acceptable to preserve wheels | 5 | False — pills below 2-entry picker, not dropdown entries |
| MVP is the static no-animation version | 6 | False — full-vision bundle |
| Modeling work is out of scope | 7 | False — hub-gap fix bundled |

## Interview Transcript

<details>
<summary>7 rounds of Q&A</summary>

### Round 1 — Goal: filter behavior
**Q:** What does the UI actually DO when you pick a filter? (dim, morph, drill, lens)
**A:** Morph layout — nodes regroup into buckets.

### Round 2 — Goal: multi-filter
**Q:** When two filters fire, AND-intersect, tree-drill, layered axes, or single-active?
**A:** Strict intersection (AND).

### Round 3 — Constraint: scope
**Q:** "ONE 3D / ONE 2D" — Network-only or eat the Labs?
**A:** Network only; Labs stay independent.

### Round 4 — Contrarian: reframe vs delete
**Q:** What if we keep the wheels but relabel them as overlays instead of deleting?
**A:** Yes, keep them but relabel. (Surfaced contradiction with Round 0's "1×3D + 1×2D")

### Round 5 — Goal: activation mechanism
**Q:** Dropdown has 2 entries. What triggers the morph? (pill row, big segmented bar, dropdown sub-menu)
**A:** Filter pill row under the mode picker.

### Round 6 — Simplifier: MVP scope
**Q:** Smallest shippable version? (static no-anim, animated MVP, full vision)
**A:** Full vision — morph + breadcrumbs + lab scope pills.

### Round 7 — Constraint: modeling scope
**Q:** Bundle modeling work into this spec? (UI-only, hub-gap fix, encoder spike)
**A:** Bundle hub-gap fix.

</details>

---

## Pipeline next step

Per the deep-interview skill chain, this spec is ready for either:
- **`/oh-my-claudecode:omc-plan --consensus --direct`** — Planner/Architect/Critic refinement before execution (recommended for a 3.5-day spec).
- **`/oh-my-claudecode:autopilot`** — direct execution if you'd rather move now.

The spec is concrete enough that consensus refinement is unlikely to materially change phasing, but Architect review is worth the time for the compound-food predictor's data-flow choices.
