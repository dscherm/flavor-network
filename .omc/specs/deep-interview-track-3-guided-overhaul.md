# Deep Interview Spec: Track 3 — Guided Overhaul

## Metadata
- Interview ID: `track-3-guided-overhaul-2026-05-18`
- Rounds: 6
- Final Ambiguity Score: **16.5%** (under 20% threshold)
- Type: **brownfield**
- Generated: 2026-05-18
- Threshold: 0.20
- Initial Context Summarized: yes (6-bullet brain-dump from the original 5-track spec; 2 sub-items deferred via Round 5 scope cut)
- Status: **PASSED**

## Clarity Breakdown
| Dimension | Score | Weight | Weighted |
|-----------|-------|--------|----------|
| Goal Clarity | 0.92 | 0.35 | 0.322 |
| Constraint Clarity | 0.85 | 0.25 | 0.213 |
| Success Criteria | 0.72 | 0.25 | 0.180 |
| Context Clarity (brownfield) | 0.80 | 0.15 | 0.120 |
| **Total Clarity** | | | **0.835** |
| **Ambiguity** | | | **0.165 (16.5%)** |

---

## Goal

Restructure the Guided Discovery flow from a multi-card swipe deck (~7 cards) to a focused 3-screen pivot path that uses a new filter-adaptive `ProfileRadar` as the Results hero (replacing `CuratedWheel`). The new flow lets chefs ask "show me basil's pairings *by the dimension that matters to me today*" — pick a filter type once, see all pairings plotted on that filter's axes, commit a value by tapping an axis to highlight the matching pairings.

### The 3-screen flow

```
[Screen 1] Ingredient pick           (existing — SearchBar / Suggest one)
    ↓
[Screen 2] Filter-type card  (NEW)   "Discover pairings that are..."
                                     pick-one: Taste · Aroma · Season · Cuisine
    ↓
[Screen 3] Results                   ProfileRadar with chosen filter's axes
                                     · No-value mode by default (axes + all pairings full opacity)
                                     · Tap an axis label → commits a value
                                       (wedge fills, matching pairings highlighted,
                                        non-matching dimmed to 0.35)
                                     · 4 pill buttons above radar (Taste/Aroma/Season/Cuisine)
                                       — tap to switch filter type, resets value
                                     · "Show me where this data comes from" button → GuidedTour
```

The existing swipe-deck cards for Season / Aroma / Cuisine / Dietary / Meat are **removed from Guided** entirely. Dietary + Meat + their associated icon swaps deferred to Track 4 (Build), where they remain relevant.

---

## Defined Variables

### Screen 2 — FilterTypeCard

```jsx
// src/components/GuidedFilterTypeCard.jsx (NEW)
//
// Renders after ingredient pick. Shows 4 pick-one pill buttons + a
// "Got it" button (disabled until a pill is selected — the can't-check-
// empty fix). Reuses FilterPillRow styling for the pills.

const FILTER_TYPES = ['taste', 'aroma', 'season', 'cuisine'];

function GuidedFilterTypeCard({ onCommit }):
    const [chosenType, setChosenType] = useState(null);
    return (
      <Card>
        <Heading>Discover pairings that are…</Heading>
        <PillRow values={FILTER_TYPES} selected={chosenType} onSelect={setChosenType} />
        <Button disabled={!chosenType} onClick={() => onCommit(chosenType)}>
          Got it
        </Button>
      </Card>
    );
```

### Screen 3 — Filter-adaptive ProfileRadar

```jsx
// Reuse / extend src/components/MultiAxisRadarStack.jsx (or fork to a
// new GuidedProfileRadar.jsx if the abstraction doesn't fit cleanly).
//
// Axis count adapts to filter type:
//   taste   → 8 axes (sweet/sour/bitter/salty/umami/pungent/astringent/spicy)
//   aroma   → 6 axes (odor_fruity/floral/green/woody/spicy/fatty — GNN)
//   season  → 4 axes (spring/summer/fall/winter)
//   cuisine → cuisine buckets (8, per `CATEGORICAL_AXES.cuisine.labels`:
//             Global, European, Americas, East Asian, SE Asian,
//             South Asian, Middle Eastern, African — verified
//             `categoricalAxes.js:165-174` as the canonical set)

function GuidedProfileRadar({ focal, pairings, filterType, chosenValue, onAxisTap }):
    const axes = getAxesFor(filterType);            // 4/6/8/8 labels
    const plottedPairings = pairings.map(p => ({
      ...p,
      coords: computeAxisCoordsFor(p, axes, filterType),  // (axis_i, magnitude) pairs
    }));
    const isMatch = (p) => chosenValue
      ? p[filterType]?.includes(chosenValue)
      : null;

    return (
      <svg>
        {axes.map((axis, i) => (
          <AxisWedge
            key={axis}
            axis={axis}
            filled={chosenValue === axis}
            fillColor={chosenValue === axis ? FILTER_COLORS[filterType] : null}
            onClick={() => onAxisTap(axis)}
          />
        ))}
        {plottedPairings.map(p => (
          <PairingDot
            key={p.name}
            pos={p.coords}
            opacity={chosenValue === null ? 1.0 : (isMatch(p) ? 1.0 : 0.35)}
            strokeWidth={isMatch(p) ? 2.0 : 0.5}
            label={(chosenValue === null || isMatch(p)) ? p.name : null}
          />
        ))}
        <FocalHub label={focal.name} />
      </svg>
    );
```

### Screen 3 — Filter Pill Row

```jsx
// Mount above the radar. Single-select. Tapping a pill switches
// filter type and resets the chosen value (no-overlap rule per ADR-2 in spirit).
<FilterPillRow
  values={['taste', 'aroma', 'season', 'cuisine']}
  selected={currentFilterType}
  onSelect={(next) => {
    setCurrentFilterType(next);
    setChosenValue(null);    // ADR — reset value on pill switch
  }}
/>
```

### Screen 3 — ProvenanceTour button

```jsx
// "Show me where this data comes from" button at the bottom of Results.
// Opens the existing src/components/GuidedTour.jsx component (verify
// its prop signature; pass focal + filterType so the tour text can
// reference the specific data the user is looking at).

<button onClick={() => setTourOpen(true)}>
  Show me where this data comes from
</button>
{tourOpen && <GuidedTour onClose={() => setTourOpen(false)} focal={focal} />}
```

### Polish bundle

**No-auto-advance:** Today's `GuidedDiscoverySwipe` cards auto-advance after Yes/No. Refactor so each card has an explicit "Got it" button — advance only on tap. Applies to the existing ingredient card AND the new filter-type card.

**Can't-check-empty:** The "Got it" button is `disabled={!hasSelection}` on every card. Visual disabled state (50% opacity, cursor not-allowed). Applies to ingredient card AND filter-type card.

**ProvenanceTour wiring:** Re-mount `GuidedTour` from a Results-page button. Verify the existing component still works after the swipe-deck removal (its internal nav references may break if it walks the OLD bubble flow).

### Icon swaps (3)

| Icon family | Current source | Replace with | Notes |
|---|---|---|---|
| Cuisine buckets | `CUISINE_ICON_BY_LABEL` (in `guidedIcons.jsx`) | Hand-curated SVGs: country flags or continent silhouettes per bucket | ~10-12 buckets; source from a public-domain flag/silhouette library |
| Season — fall | `SEASON_ICON_BY_KEY.fall` (current: leaf?) | Hand-curated SVG: distinctive fall icon (better-rendered leaf, or maple/pumpkin) | One asset; keep semantic of "fall = warm/orange" |
| Season — spring | `SEASON_ICON_BY_KEY.spring` (current: ?) | Hand-curated SVG: tulip OR daisy flower | One asset; replaces whatever's there now |
| Aroma — spicy | `AROMA_ICON_BY_LABEL.spicy` (current: flame?) | Hand-curated SVG: redrawn spicy icon (chili pepper? steam waves? user discretion) | One asset; aesthetic refresh |

**Bigger icons on the cards** (§3a from original spec): keep current icon-mapping shape; bump card-level CSS sizing — e.g., `w-16 h-16` → `w-24 h-24` (or whatever Tailwind preset reads right at 60-80px). Single-line change in the card renderer.

---

## Constraints

### Visual
- Filter-type card reuses `FilterPillRow` pill styling for consistency
- ProfileRadar shading uses Briscione-aligned filter colors (e.g., aroma → `BRISCIONE_AROMA[axis]`, taste → `BRISCIONE_TASTE[axis]`, season → `BRISCIONE_SEASON[axis]`, cuisine → existing cuisine palette in `categoricalAxes.js`)
- Match opacity 1.0, non-match opacity 0.35
- Axis-wedge fill opacity 0.55 (matches the just-shipped Notebook wedge wheel pattern); verified via Vitest assertion `getComputedStyle(wedgeFillEl).fillOpacity === '0.55'`
- Icons: ~60-80px on cards (`w-16 h-16` → `w-24 h-24` Tailwind), keep aspect ratio square

### Brownfield reuse
- `MultiAxisRadarStack.jsx` is the candidate base for the new radar — extend or fork
- `GuidedTour.jsx` exists; reuse without rewrite (only the invocation point changes)
- `FilterPillRow.jsx` styling pattern reused for pills
- `BRISCIONE_AROMA`, `BRISCIONE_TASTE`, `BRISCIONE_SEASON`, cuisine palette in `categoricalAxes.js` — all existing palettes
- `BUBBLE_REGISTRY` in `data/guidedDiscovery.js` — most entries become unused once swipe deck is removed (keep the file; just stop importing dropped keys from new flow)

### Routing / state
- Guided still owns its bubbleStack-equivalent state internally; constraint #4 from prior interviews (no `setFilterStack` from Guided) preserved — only the existing `onShowPairings` / `onExploreInNetwork` bridge enters App state
- Pill switch in Results resets chosen value; ADR (analogous to matchesContext.ADR-2): predictability beats persistence

### Performance
- Radar render ≤16ms for ≤30 pairings (one frame) — current MultiAxisRadarStack baseline holds
- Pill switch + value reset: RTL test asserts `performance.now()` delta < 16ms between click handler invocation and the radar's re-render commit (single frame budget). Test infra adds a ~10-LOC `measureCommit()` wrapper if not present.

### A11y
- Filter-type card "Got it" button announces selection via `aria-live="polite"` when filter type selected
- Disabled state on "Got it" carries `aria-disabled="true"` + visible disabled styling
- Pills in Results have `role="radiogroup"` semantics (single-select among 4)
- Radar axis labels are `<button>` elements (tappable) with accessible name `"Highlight pairings tagged {axis}"`
- ProvenanceTour button accessible name: `"Show data sources for {focal} pairings"`

---

## Non-Goals (explicitly deferred to Track 4 or future)

- **Dietary card removal from Build** — Build's Dietary card stays; deferred to Track 4
- **Meat / Protein card icon redraw** — icon (ii) deferred (Dietary + Meat dropped from Guided's flow but still present in Build)
- **halal.png drop-in** — icon (v) deferred to Track 4
- **Build's can't-check-empty fix** — same pattern as Guided's but Build is its own delivery (Track 4)
- **FilterValueCard intermediate screen** — Round 4 contrarian collapsed this; axis-tap in Results commits the value
- **Method card surfacing** — explicitly out per original spec ("note that we need to go back and explore how we should use the method metadata")
- **Generative icon pipeline** — out of scope (locked in prior delivery)
- **CuratedWheel removal from other surfaces** — only Guided Results swaps it for ProfileRadar; if CuratedWheel is mounted elsewhere (e.g., from a Discover landing card), leave that mount alone

---

## Acceptance Criteria

### Screen 2 — FilterTypeCard
- [ ] After ingredient pick, the user lands on a card titled "Discover pairings that are…"
- [ ] Card has 4 pick-one pills: Taste, Aroma, Season, Cuisine
- [ ] "Got it" button is disabled until a pill is selected (can't-check-empty)
- [ ] Tapping "Got it" navigates to Results with the chosen filter type
- [ ] Cards do NOT auto-advance — only tap-to-advance (no-auto-advance)
- [ ] No Season / Aroma / Cuisine / Dietary / Meat individual swipe cards render in Guided (swipe deck removed)

### Screen 3 — Results
- [ ] Results page renders the new `ProfileRadar` (not `CuratedWheel`) as the hero
- [ ] Radar axis count adapts to filter type: taste=8, aroma=6, season=4, cuisine=8 buckets (per `CATEGORICAL_AXES.cuisine.labels`)
- [ ] On first land, no axis wedge is shaded (no-value mode); all pairings render at full opacity
- [ ] Tapping any axis label commits a value: that wedge fills with filter color (opacity 0.55), matching pairings stay full opacity + thick stroke + label, non-matching pairings drop to opacity 0.35 + no label
- [ ] Pill row above radar shows 4 pills (Taste/Aroma/Season/Cuisine); selected pill matches current filter type
- [ ] Tapping a different pill switches the radar's axes AND clears value (back to no-value mode)
- [ ] "Show me where this data comes from" button at the bottom of Results opens the existing `GuidedTour` component
- [ ] `CuratedWheel` no longer mounts in GuidedDiscoveryResults (removed import)

### Polish + Icons
- [ ] FilterTypeCard pill icons render at `width === 48px` (Tailwind `w-12 h-12`); verified via `getComputedStyle(el).width === '48px'`. Baseline before this change is `w-7 h-7` (28px) per `GuidedDiscoverySwipe.jsx:64`.
- [ ] Cuisine bucket icons (in cuisine-related surfaces) replaced with country flags / continent silhouettes
- [ ] Fall season icon replaced with a hand-curated SVG
- [ ] Spring season icon replaced with a tulip OR daisy flower SVG
- [ ] Spicy aroma icon replaced with a hand-curated SVG

### Cross-cutting
- [ ] All existing tests still pass (`npx vitest run`)
- [ ] Build succeeds (`npm run build`)
- [ ] No console errors when navigating Guided end-to-end
- [ ] `GuidedDiscoveryResults` test suite updated for ProfileRadar — old CuratedWheel assertions removed/migrated

---

## Implementation Plan

### Phasing
| Phase | Scope | Effort |
|---|---|---|
| **P1** | `GuidedFilterTypeCard.jsx` (new) — 4-pill pick-one + disabled Got-it button | 0.25d |
| **P2** | `GuidedProfileRadar.jsx` (new, or extend MultiAxisRadarStack) — filter-adaptive axes + axis-fill highlight + axis-tap to commit | 1d |
| **P3** | Filter pill row in Results (single-select, switch+reset behavior) | 0.25d |
| **P4** | Wire ProvenanceTour button on Results — open existing GuidedTour | 0.25d |
| **P5** | Replace swipe-deck flow: GuidedDiscoverySwipe → ingredient pick + FilterTypeCard only | 0.5d |
| **P6** | Remove CuratedWheel from Results; mount GuidedProfileRadar | 0.25d |
| **P7** | Card icon size bump (CSS only) + 3 SVG icon swaps | 0.5d |

**Total: ~3 days.**

### Files to create
| File | Purpose |
|---|---|
| `src/components/GuidedFilterTypeCard.jsx` | New: pick-one filter-type card |
| `src/components/GuidedProfileRadar.jsx` | New: filter-adaptive radar (or extension of MultiAxisRadarStack) |
| `src/components/__tests__/GuidedFilterTypeCard.test.jsx` | RTL tests |
| `src/components/__tests__/GuidedProfileRadar.test.jsx` | RTL + axis-count + highlight-mode tests |
| `public/icons/cuisine/*.svg` (~10-12 files) | Cuisine bucket flags/silhouettes |
| `public/icons/season-fall.svg` | Replacement fall icon |
| `public/icons/season-spring.svg` | Replacement spring icon (tulip/daisy) |
| `public/icons/aroma-spicy.svg` | Replacement spicy icon |

### Files to modify
| File | Change |
|---|---|
| `src/components/GuidedDiscoverySwipe.jsx` | Replace internal swipe deck with: ingredient pick → FilterTypeCard → onComplete. Remove BUBBLE_REGISTRY iteration. |
| `src/components/GuidedDiscoveryResults.jsx` | Remove `CuratedWheel` mount; mount `GuidedProfileRadar` + FilterPillRow + ProvenanceTour button |
| `src/components/guidedIcons.jsx` | Update icon imports for the 4 swapped icons; bump default size constants |
| `src/components/__tests__/GuidedDiscoveryResults.test.jsx` | Migrate CuratedWheel-specific assertions to ProfileRadar-equivalent |

### Files to potentially delete (audit during P5)
| File | Reason |
|---|---|
| Any swipe-deck-only utility no longer referenced | Audit after P5; only delete if confirmed dead |

---

## Risks / Notes for Executor

1. **MultiAxisRadarStack reuse vs new component** — the cleanest architectural call. If MultiAxisRadarStack's prop signature accommodates the 4/6/8/12 axis-count adaptation + axis-fill + per-pairing opacity gradient, extend it. If not, fork a clean `GuidedProfileRadar.jsx` and reference the old component for SVG primitives. **Decision to bring to Architect.**

2. **Cuisine bucket axes** — patched in ralplan R2 from "top-12 cuisine buckets" to **8 buckets** per `CATEGORICAL_AXES.cuisine.labels` (Global, European, Americas, East Asian, SE Asian, South Asian, Middle Eastern, African — verified `categoricalAxes.js:165-174`). Apply this ordering to ProfileRadar axes when filterType === 'cuisine'.

3. **GuidedTour mount lifecycle** — `GuidedTour.jsx` may have internal logic that walks the OLD swipe-deck steps. After the deck removal (P5), verify the tour still works. If it references removed bubbles, either update its step list to walk the new 3-screen flow OR refactor it to be a static "what is this data?" panel rather than a step-by-step walkthrough.

4. **`BUBBLE_REGISTRY` orphaning** — `BUBBLE_REGISTRY` will still be imported by Build's flow (which retains Dietary, Meat, etc.). Don't delete the registry. Just stop importing the dropped keys from the new Guided flow.

5. **Icon procurement** — public-domain SVG sources: Heroicons (limited), Material Icons (broad), flag-icons npm package (country flags), undraw.co. For continent silhouettes, draw simple polygons inline as SVG `<polygon>` — no external library needed.

6. **Cuisine "buckets" vs full cuisine list** — there are 50+ cuisines in metadata but `CATEGORICAL_AXES.cuisine.labels` is the 10-12 bucket list (already grouped: Italian, Mexican, Indian, Caribbean, etc.). Confirm executor uses the BUCKET list, not the full cuisine list, for radar axes.

7. **Test migration** — `GuidedDiscoveryResults.test.jsx` currently asserts on CuratedWheel rendering. These tests need migration to ProfileRadar assertions OR the old assertions need to be inverted ("CuratedWheel does NOT render"). Cleanest: replace, don't keep both.

8. **Soak findings carry-over** — three open items from the just-shipped delivery may surface during this work: cluster 10 rename, palette repick (2 SEASON fills), AnimatedLogo orbit tuning. None block Track 3. Track them as separate small commits.

---

## Ontology (Final Entities)

| Entity | Type | Fields | Relationships |
|---|---|---|---|
| FilterTypeCard | UI component (NEW) | filterTypes, selected, gotItDisabled | replaces swipe deck |
| ProfileRadar | UI component (NEW or extended from MultiAxisRadarStack) | axes, filterType, chosenValue, focal, pairings | hero in Results |
| FocalIngredient | data | name, gnnProbs, taste, season, cuisines | center of radar |
| AccentPairings | data | name[], filterType-tagged subsets | plotted on radar |
| FilterPillRow (in Results) | UI element | currentFilterType, switchable | resets value on switch |
| ProvenanceTour | invocation | reuses GuidedTour.jsx | opens from button on Results |
| GotItButton | UI element | disabled when no selection | applies to ingredient card + filter-type card |
| RequiredSelectionGuard | behavior | gates Got-it via disabled prop | enforces can't-check-empty |
| IconSet | assets | scope = (cuisine flags, fall, spring, spicy) | refresh on cards |
| CuratedWheel | UI component (REMOVE from Results) | — | Results no longer mounts this |
| RadarMode | computed state | 'no-value' | 'value' | toggled by axis-tap or pill-switch |
| AxisLabelTap | gesture | commits value within current filter type | RadarMode transition |

## Ontology Convergence
| Round | Entity Count | New | Changed | Stable | Stability |
|---|---|---|---|---|---|
| 1 | 12 | 12 | 0 | 0 | N/A |
| 2 | 12 | 0 | 0 | 12 | 100% |
| 3 | 13 | 1 | 0 | 12 | 100% (RadarMode added) |
| 4 | 12 | 1 | 0 | 11 | 92% (-FilterValueCard via contrarian, +AxisLabelTap) |
| 5 | 12 | 0 | 0 | 12 | 100% |
| 6 | 12 | 0 | 0 | 12 | 100% |

Converged by R5; R4 contrarian was the only structural prune.

---

## Assumptions Exposed & Resolved

| Assumption | Round | Resolution |
|---|---|---|
| Existing swipe deck stays and FilterTypeCard inserts somewhere within | 1 | False — swipe deck removed entirely; flow collapses to 3 screens |
| Radar highlights pairings with a glow (no axis fill) | 2 | False — chosen-filter axis wedge gets a tinted fill; matches at full opacity, non-matches dimmed to 0.35 |
| Switching pills preserves the previous value | 3 | False — pill switch resets value; user must tap axis label in Results to commit |
| FilterValueCard is a necessary intermediate screen | 4 | False (contrarian) — axis-tap in Results commits the value; FilterValueCard dropped |
| All 5 icons + Build cross-cutting fixes ship together | 5 | False — scope cut to Guided-only; icons (ii) + (v) and Build's can't-check-empty deferred to Track 4 |
| All 5 deliverables are nice-to-have | 6 | False — all 5 marked must-ship; ~3-day delivery is the floor |

---

## Interview Transcript

<details>
<summary>6 rounds of Q&A</summary>

### Round 1 — Goal Clarity
**Q:** Where does the new filter-choice card sit in the Guided flow?
**A:** Replaces the entire bubble deck. 3-screen flow: ingredient → filter-type → Results.

### Round 2 — Goal Clarity
**Q:** How does the radar visually distinguish chosen-filter pairings from the rest?
**A:** Filled wedge for the chosen axis (filter color, 0.55 opacity), matches at full opacity + stroke + label, non-matches dimmed to 0.35.

### Round 3 — Goal Clarity
**Q:** What happens to the value when the user taps a different pill in Results?
**A:** Reset to no-value (clean state, user re-commits by tapping a new axis).

### Round 4 — Goal Clarity — Contrarian Mode
**Q:** Do you need the FilterValueCard between FilterTypeCard and Results?
**A:** Drop it — Results' axis-tap commits the value. 3-screen flow: ingredient → filter-type → Results.

### Round 5 — Constraints
**Q:** With Dietary + Meat cards dropped from Guided, what's the icon + Build scope?
**A:** Guided-only this delivery; defer icons (ii) protein + (v) halal and Build's can't-check-empty fix to Track 4.

### Round 6 — Success Criteria — Simplifier Mode
**Q:** Of 5 deliverables, which 3 are must-ship?
**A:** All 4 (filter-type card, ProfileRadar+pills, polish bundle, 3 icon swaps). No further scope cut.

</details>

---

## Pipeline next step

Per the deep-interview skill chain, this spec is ready for:

- **`/oh-my-claudecode:omc-plan --consensus --direct`** — recommended (matches the just-shipped pipeline pattern). Architect/Critic pressure-test: MultiAxisRadarStack reuse vs fork (Risk #1), GuidedTour lifecycle after swipe-deck removal (Risk #3), cuisine bucket ordering (Risk #2).
- **`/oh-my-claudecode:autopilot`** — direct execution.
- **`/oh-my-claudecode:ralph`** — persistence loop.
