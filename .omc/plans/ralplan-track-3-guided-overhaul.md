# RALPLAN — Track 3 — Guided Overhaul (Round 2, revised)

> **Source spec:** `.omc/specs/deep-interview-track-3-guided-overhaul.md` (16.5% ambiguity, PASSED, 2026-05-18 — patched in Round 2 for "8 buckets" + measurable ACs)
> **Mode:** `--consensus --direct` (non-interactive; SHORT, not `--deliberate`)
> **Lane:** Planner → Architect (concurred + 5 refinements) → Critic (concurred 4 + pushed back on 1 + 6 gaps) → **Planner R2** → next Architect/Critic pass
> **Effort estimate:** ~3 days · **Net LOC delta:** ~+1,210 / ~-180 (net +1,030)
> **Lesson applied proactively:** `pipeline-rebuild-wipes-manual-data-additions` how=5
> ("run a verification step that checks for known manual entries by name before
> reporting success") — codified as per-phase `grep` gates in §2.4 instead of prose.

---

## 0. Round-2 changelog (vs. Round-1 plan)

| Item | Source | What changed |
|---|---|---|
| 1 | Concurred | "top-12 cuisine buckets" → "8 buckets, per `CATEGORICAL_AXES.cuisine.labels`" everywhere (spec + plan). OQ2 closed to option (a). |
| 2 | Concurred | ADR-4 re-framed from "spec deviation" → "spec correction (verified-architecture finding)" citing `GuidedTour.jsx:84-112` scene-action contract. |
| 3 | Concurred | OQ4 locked to option (a): keep `selectCuratedPairings` as banner predicate input. Dropped from open questions; integrated into P6. |
| 4 | Concurred | OQ3 closed to YAGNI: no `theme` prop. Added header comment in `GuidedProfileRadar.jsx` flagging Track 4 reuse. |
| 5 | Pushback resolved | FilterPillRow decision moved to new **ADR-5** — Planner endorses Critic's recommendation: fork (Option 3b). |
| 6 | Critic G1 | "Feels right" ACs replaced with computed-style predicates (width === 48px; fillOpacity === '0.55'; performance.now() delta <16ms). |
| 7 | Critic G2 | NEW11 auto-advance gets concrete fake-timer spec name + assertion text. |
| 8 | Critic G3 | New §2.4 "Verification Gates" — per-phase `grep` checks codified post-each-phase. |
| 9 | Critic G4 | `GuidedProfileRadar.test.jsx` gains explicit mode-transition spec (null → 'sweet' → null). |
| 10 | Critic G5 | ADR-3 C2 dismissal corrected: ~12KB gzip is the real `flag-icons` size, not 250KB; rejection rests on region-vs-flag semantic mismatch. |
| 11 | Critic G6 | NEW10 bridge-stale assertion: spy on `deriveFilterStackFromBubbles`, walk new flow, expect call count === 0 with new payload shape. |

---

## 1. RALPLAN-DR Summary

### 1.1 Principles (non-negotiable rules)

1. **Pure-component radar before consumer wiring.** `GuidedProfileRadar` ships
   with a pure-data unit test pass *before* it is mounted in
   `GuidedDiscoveryResults`. Single phase touches one boundary at a time.
2. **Brownfield reuse over fork — unless the prop signature already drifts.**
   Fork when fitting two responsibilities into one signature would inflate
   props or invert existing semantics. Reuse SVG primitives, not components.
3. **Polish bundle ships as a single bisectable commit.** No-auto-advance +
   can't-check-empty + Got-it disabled state land together in P5.
4. **Sole `setFilterStack` bridge is preserved.** Constraint #4 from prior
   R16 work — only `onExploreInNetwork` flows from Guided into App.jsx's
   network filter stack. The new `GuidedResultsFilterPills` row is LOCAL
   state; verifier asserts no leak via spy in G6 (NEW10).
5. **No silent data-shape change.** The radar reads `node.gnnProbs` /
   `node.taste` / `node.cuisines` / `node.season` exactly as
   `ProfileAxisRadar.signalForAxis` does today. Missing data → "no axis
   match" + drop-count callback; never fabricate signal.
6. **Verification artifacts beat prose** (lesson applied, how=5). Every
   phase has a codified `grep` or test predicate that BLOCKS commit if it
   doesn't match the expected post-state. See §2.4.

### 1.2 Decision Drivers (top 3)

| Rank | Driver | Why it dominates |
|---|---|---|
| **D1** | **Brownfield safety** — 462 passing tests; CuratedWheel/GuidedTour/BUBBLE_REGISTRY are all live with downstream consumers (Build, Recipe Lab, LivingArchView tour handle). Breaking a consumer = Critic-blocking regression. | Spec Risks #3, #4, #7 |
| **D2** | **Visual parity + interaction predictability** — radar must obey Briscione palettes + 0.55/0.35 opacity contract so users read it as "same family as the Notebook wedge wheel". | Spec Constraints §Visual |
| **D3** | **Scope discipline** — Dietary/Meat + 2 icons explicitly deferred to Track 4; icon procurement must not pull heavy npm dep for 4 SVGs. | Spec Non-Goals |

### 1.3 Viable Options (≥2 per architectural decision)

#### Decision A — ProfileRadar: extend `MultiAxisRadarStack` vs. fork

| Option | Description | Pros | Cons |
|---|---|---|---|
| **A1 — Extend** with `mode='single'` prop | Collapse 5-radar grid to one. | Single file. | Two divergent modes; `onAxisSelect` vs. `onAxisTap` conflict; couples Recipe Lab to Guided's evolution. |
| **A2 — Fork** to `GuidedProfileRadar.jsx` (copy SVG primitives) | New file w/ comment-block attribution. | Bisect-safe; clean evolution; each file one job. | ~200 LOC math duplication. |
| **Why A2** | Components answer different questions (per-recipe lean across 5 lenses vs. per-pairing plot on one axis). Share math primitives, not responsibilities. Duplication is bounded; extraction is OQ for a future third consumer. | | |

#### Decision B — Cuisine axes: static vs. dynamic

| Option | Description | Pros | Cons |
|---|---|---|---|
| **B1 — Static, 8 buckets** from `CATEGORICAL_AXES.cuisine.labels` (Global, European, Americas, East Asian, SE Asian, South Asian, Middle Eastern, African) | Render in declared order; same buckets used by network color scheme + chip icons. | Visual consistency; scan-stability; zero recompute per focal. | Sparse axes for ingredients with limited regional fit. |
| **B2 — Dynamic top-N by focal pairing-count** | Recompute per focal. | Density. | Axis positions move per focal; users re-learn each radar. |
| **Why B1** | OQ2 closed by Round-1 verification — `categoricalAxes.js:165-174` declares exactly 8 buckets; the spec's earlier "top-12" wording was aspirational. Bucket list is canonical; stability beats density. | | |

#### Decision C — Icon procurement

| Option | Description | Pros | Cons |
|---|---|---|---|
| **C1 — Hand-curate inline SVGs** in `guidedIcons.jsx` | Continuation of existing 30+ inline SVG pattern; `currentColor` stroke. | Zero deps; tree-shakable; palette auto-tints on active state. | ~3-4h design time; subjective silhouettes. |
| **C2 — `flag-icons` CSS sprite** | ~12KB gzip (corrected from R1's incorrect ~250KB claim — `flag-icons` is a CSS-only sprite). | Recognition is instant. | **Region-vs-flag semantic mismatch**: `CATEGORICAL_AXES.cuisine.labels` are 8 regional buckets (Americas, East Asian, SE Asian, ...), not nations. A flag library flags individual nations within those buckets, not the buckets themselves. Adopting C2 would require us to pick "a representative flag" per region — a politically-fraught reduction the project has explicitly avoided in `CUISINE_BUCKETS` design. |
| **C3 — Static SVGs in `public/icons/`** | One file per bucket. | Decoupled from bundle. | Loses `currentColor` palette wiring; +11 HTTP requests; re-implements lookup. |
| **Why C1** | C2 is rejected on the *region-vs-flag* axis (G5 correction), not on bundle size. C3 regresses on palette wiring. C1 continues the file's pattern. | | |

#### Decision D — GuidedTour: refactor STAGES vs. replace with static panel

| Option | Description | Pros | Cons |
|---|---|---|---|
| **D1 — Refactor `STAGES`** | Walk new 3-screen flow. | Reuses TourPopup + reducer. | **Architectural mismatch** (see ADR-4): `GuidedTour.jsx:84-112` requires a `sceneHandle` to dispatch animatePull/clusterDemo/engageAffinity/clearFilters/ingredientGlow/engageFinalAffinity — Guided Results has no such handle. The tour would ship with all scene actions no-oping. |
| **D2 — Replace with `ProvenancePanel.jsx`** (static modal) | New 110-LOC component. Honest match to button copy "Show me where this data comes from". | Semantic match; self-contained; no `sceneHandle` dep. | New component; GuidedTour orphaned for Guided (kept for other callers). |
| **D3 — Hybrid stage 0** | New provenance stage 0 in STAGES, then existing stages. | Reuses popup. | Mixes semantics; still hits sceneHandle problem in later stages. |
| **Why D2** | Same as Round 1, now re-framed in ADR-4 as a **verified-architecture finding** (item 2 concurred). `GuidedTour` cannot run from Guided Results without `sceneHandle` plumbing; honoring spec literal ships a broken tour. | | |

#### Decision E — FilterPillRow: extend vs. fork (NEW in R2, per Critic pushback)

| Option | Description | Pros | Cons |
|---|---|---|---|
| **E1 — Extend** `FilterPillRow.jsx` with `mode='single'` | Use the existing unused `mode` prop placeholder at `FilterPillRow.jsx:13-21`. ~40 LOC change: flip `role="checkbox"` → `role="radio"`/`radiogroup`, hide "None" pill in single mode, replace `onToggle`+`onClear` with `onSelect`. | Lower file count. Single-source-of-truth for pill row styling. | **High blast radius**: 78-LOC component that ships on the network surface. Role flip means existing aria semantics changes wrt screen readers if anyone toggles modes in dev. Three new test paths required to lock current `mode='multi'` (default) behavior against regressions. |
| **E2 — Fork** to `GuidedResultsFilterPills.jsx` (~70 LOC NEW) | Single-select sibling; same Tailwind classes for visual consistency. | Zero blast radius on production network pill. Clean isolated component. | Two pill components in the codebase. |
| **Why E2** | Critic's blast-radius argument is sound for a Phase-1 production component. The 78-LOC `FilterPillRow.jsx` is on the hot path (network surface). File-table cost (one extra file) is bookkeeping; architectural cost of role-flip in a hot-path component is real. See **ADR-5**. | | |

### 1.4 Single-viable decisions

ADR-4 is now framed as the unique architectural option (D1 and D3 are
**invalidated** by the verified `sceneHandle` requirement, not a judgment
call). Documented in ADR-4.

---

## 2. Full Implementation Plan

### 2.1 Phase dependency graph

```
                P1 (FilterTypeCard, pure)
                       │
                       ▼
                P2 (GuidedProfileRadar, pure) ◄── parallel with P1
                       │
                       ▼
                P3 (GuidedResultsFilterPills, pure fork — ADR-5) ◄── parallel
                       │
                       ▼
P4 (ProvenancePanel)   P5 (swipe → 3-screen wiring) ◄── DEPENDS on P1+P2+P3
       │                       │
       ▼                       ▼
       └───────► P6 (CuratedWheel removal + radar mount + tests migrate)
                       │
                       ▼
                P7 (icon swaps + size bump)  ◄── parallel-eligible w/ P6
```

**Parallel-eligible lanes:** Lane α (P1+P2+P3) · Lane β (P4) · Lane γ (P7).
Sequenced: P5 → P6.

### 2.2 Phase details

#### P1 — `GuidedFilterTypeCard.jsx` (NEW)

| Item | Value |
|---|---|
| **Files** | `src/components/GuidedFilterTypeCard.jsx` (NEW, ~80 LOC) · `src/components/__tests__/GuidedFilterTypeCard.test.jsx` (NEW, ~120 LOC, 5-7 specs) |
| **LOC delta** | +200 |
| **Effort** | 0.25d |
| **Tests** | Render: heading, 4 pills, disabled Got-it. Interaction: click pill → Got-it enables, click Got-it → `onCommit(chosenType)` fires. A11y: `aria-live` on pill select, `aria-disabled` on Got-it. **Measurable AC (G1)**: pill icon `getComputedStyle(el).width === '48px'` for the FilterTypeCard surface (vs. baseline 28px in `GuidedDiscoverySwipe.jsx:64`). |
| **Risks** | None directly — pure new component. |
| **Acceptance** | Spec AC: "After ingredient pick, the user lands on a card titled 'Discover pairings that are…'"; "Got it button is disabled until a pill is selected"; "Cards do NOT auto-advance". |

#### P2 — `GuidedProfileRadar.jsx` (NEW; fork from ProfileAxisRadar; ADR-1)

| Item | Value |
|---|---|
| **Files** | `src/components/GuidedProfileRadar.jsx` (NEW, ~280 LOC) · `src/components/__tests__/GuidedProfileRadar.test.jsx` (NEW, ~290 LOC, 14-17 specs including new mode-transition spec from G4) · `src/data/guidedRadarAxes.js` (NEW, ~80 LOC: `getAxesFor`, `getColorMapFor`, `pairingMatchesAxis`, `coordsForPairing`) · `src/data/__tests__/guidedRadarAxes.test.js` (NEW, ~100 LOC, 8-10 specs) |
| **LOC delta** | +750 |
| **Effort** | 1d |
| **Tests (helper)** | `getAxesFor('cuisine') === CATEGORICAL_AXES.cuisine.labels` (exact reference equality — locks ADR-2). `getAxesFor('cuisine').length === 8` (locks item 1 correction). All other axis counts (4/6/8). `pairingMatchesAxis` for taste/aroma/season/cuisine. `coordsForPairing(...)` returns null when `gnnProbs` missing. |
| **Tests (component)** | Axis counts per filterType. **G4 mode-transition spec** (named `'restores all-pairings-at-1.0 on chosenValue=null after a value was set'`): render with `chosenValue=null` → all 30 mock pairings opacity 1.0; re-render `chosenValue='sweet'` → matching subset 1.0, non-matching 0.35; re-render `chosenValue=null` → restoration to all-at-1.0. **Measurable AC (G1)**: `getComputedStyle(wedgeFillEl).fillOpacity === '0.55'` when wedge is filled. |
| **Header comment** (OQ3 closure) | `// TRACK-4 REUSE: This radar's shape (filter-adaptive axes + axis-fill +`<br>`// per-pairing dots) is a candidate hero for Build's by-dimension surface.`<br>`// Do NOT add a 'theme' prop pre-emptively — refactor at Track 4 time if`<br>`// the surfaces actually converge. YAGNI confirmed in ralplan R2 OQ3.` |
| **Risks** | **Risk #1** (fork via ADR-1). **Risk #6** (`getAxesFor('cuisine')` reads `.labels` directly — locked by exact-reference assertion). **Risk #5** (missing `gnnProbs` → drop + `onDropCount` callback). |
| **Acceptance** | Spec AC: axis count 8/6/4/8; no-value mode default; tap commits value with 0.55 wedge fill + 1.0 match / 0.35 non-match opacities. |

##### P2 algorithm contract (locked)

```js
// src/data/guidedRadarAxes.js
import { CATEGORICAL_AXES } from './categoricalAxes.js';
import { BRISCIONE_AROMA, BRISCIONE_TASTE, BRISCIONE_SEASON } from './briscionePalette.js';
import { CUISINE_CHIP_COLOR } from '../components/guidedIcons.jsx';

// Exact-reference: `getAxesFor('cuisine') === CATEGORICAL_AXES.cuisine.labels`
const AXIS_BY_FILTER = {
  taste:   ['sweet','sour','bitter','salty','umami','pungent','astringent','spicy'],
  aroma:   ['fruity','floral','green','woody','spicy','fatty'],
  season:  ['spring','summer','fall','winter'],
  cuisine: CATEGORICAL_AXES.cuisine.labels,  // 8 buckets (ADR-2)
};
const COLOR_BY_FILTER = {
  taste: BRISCIONE_TASTE, aroma: BRISCIONE_AROMA,
  season: BRISCIONE_SEASON, cuisine: CUISINE_CHIP_COLOR,
};
export function getAxesFor(filterType)     { return AXIS_BY_FILTER[filterType] || []; }
export function getColorMapFor(filterType) { return COLOR_BY_FILTER[filterType] || {}; }
```

#### P3 — `GuidedResultsFilterPills.jsx` (NEW fork; ADR-5)

| Item | Value |
|---|---|
| **Files** | `src/components/GuidedResultsFilterPills.jsx` (NEW, ~70 LOC) · `src/components/__tests__/GuidedResultsFilterPills.test.jsx` (NEW, ~50 LOC, 3 specs) |
| **LOC delta** | +120 |
| **Effort** | 0.25d |
| **Tests** | Renders 4 pills with current selection. Tap different pill → `onSelect(nextType)` fires. Single-select semantics: only one pill carries `aria-checked="true"`. |
| **Risks** | None (per ADR-5: forking avoids the high-blast-radius role-flip in production `FilterPillRow.jsx`). |
| **Acceptance** | Spec AC: "Pill row above radar shows 4 pills"; "Tapping a different pill switches the radar's axes AND clears value" (the value-reset behavior is owned by the Results-page parent, verified in P6 integration test). |

#### P4 — `ProvenancePanel.jsx` (NEW; ADR-4)

| Item | Value |
|---|---|
| **Files** | `src/components/ProvenancePanel.jsx` (NEW, ~110 LOC) · `src/components/__tests__/ProvenancePanel.test.jsx` (NEW, ~60 LOC, 3-4 specs) |
| **LOC delta** | +170 |
| **Effort** | 0.25d |
| **Tests** | Renders when `open === true`. Lists 4 ProData sources + GNN + ChemTastesDB + ground-truth. Close button → `onClose` fires. A11y: `role="dialog"`, `aria-modal="true"`. |
| **Risks** | **Risk #3** resolved by leaving `GuidedTour.jsx` untouched. Verified by §2.4 grep gate. |
| **Acceptance** | Spec AC adjusted by ADR-4: button opens ProvenancePanel (the spec-corrected target), not `GuidedTour`. |

#### P5 — Swipe deck → 2-card flow + polish bundle

| Item | Value |
|---|---|
| **Files** | `src/components/GuidedDiscoverySwipe.jsx` (MODIFY: -120/+60 = -60 LOC) · `src/components/__tests__/GuidedDiscoveryStart.test.jsx` (UPDATE) |
| **LOC delta** | -60 |
| **Effort** | 0.5d |
| **Tests** | **G2 — NEW11 verification (explicit fake-timer spec)**: Named `'no-auto-advance: ingredient pick does NOT auto-render FilterTypeCard'`. Body: `vi.useFakeTimers(); render(<GuidedDiscoverySwipe ... />); /* simulate ingredient pick via SearchBar */ userEvent.click(searchResult); vi.advanceTimersByTime(5000); expect(screen.queryByTestId('guided-filter-type-card')).toBeNull();` Then `userEvent.click(getItButton); expect(screen.getByTestId('guided-filter-type-card')).toBeVisible();`. Restore real timers in `afterEach`. |
| **Tests (other)** | Ingredient card renders first; SearchBar + Suggest one work. Filter-type pick + Got-it → `onComplete({ ingredient, filterType })` fires (not bubbleStack — new payload). Drop assertions for season/cuisine/aroma/dietary/meat. |
| **Risks** | **Risk #4** (BUBBLE_REGISTRY orphaning) — import removed; verified by §2.4 grep gate. **NEW10** (App.jsx bridge stale) — verified in P6 by spy. **NEW11** (auto-advance) — verified by fake-timer spec above. |
| **Acceptance** | Spec AC: "No Season/Aroma/Cuisine/Dietary/Meat cards"; "Cards do NOT auto-advance". |

#### P6 — Remove CuratedWheel; mount GuidedProfileRadar

| Item | Value |
|---|---|
| **Files** | `src/components/GuidedDiscoveryResults.jsx` (MODIFY: -50/+230 = +180 LOC — remove `CuratedWheel`+`MultiAxisRadarStack` mounts; add `GuidedProfileRadar`+`GuidedResultsFilterPills`+Provenance button) · `src/components/__tests__/GuidedDiscoveryResults.test.jsx` (MIGRATE: -60/+110 = +50 LOC) · `src/App.jsx` (TINY MODIFY: +10 LOC bridge) |
| **LOC delta** | +240 |
| **Effort** | 0.25d |
| **Tests (integration)** | ASSERT: `CuratedWheel` is NOT rendered. ASSERT: `MultiAxisRadarStack` is NOT rendered. ASSERT: `GuidedProfileRadar` IS rendered. ASSERT: `GuidedResultsFilterPills` IS rendered. ASSERT: Provenance button IS rendered. Tap aroma "green" → green-tagged pairings stay full-opacity, others dim to 0.35. Switch pill `aroma`→`taste` → axis count flips to 8, `chosenValue` resets to `null`. **G6 — NEW10 bridge-stale assertion** (named `'App bridge does not call deriveFilterStackFromBubbles with the new payload shape'`): `import * as bubbles from '../data/guidedDiscovery.js'; const spy = vi.spyOn(bubbles, 'deriveFilterStackFromBubbles'); /* mount App, walk new flow ingredient→filterType→Results→Explore in network */; expect(spy).not.toHaveBeenCalledWith(expect.objectContaining({ ingredient: expect.any(String), filterType: expect.any(String) }));` (asserts the bridge isn't silently passed the new shape — which would no-op since the function expects an array). |
| **Tests (chemistry banner, OQ4 closure)** | Banner predicate still reads `selectCuratedPairings(focal, ctx, dietary)` even though the wheel itself is removed. Function stays imported solely as the banner's input. Existing banner test in `GuidedDiscoveryResults.test.jsx` is updated to expect the banner above the radar (not above the wheel). |
| **Risks** | **Risk #1**, **#7** (test migration). **NEW9** (chemistry banner) closed by OQ4 option (a). **NEW10** verified by spy. |
| **Acceptance** | Spec AC: "Results page renders the new ProfileRadar (not CuratedWheel)"; "CuratedWheel no longer mounts in GuidedDiscoveryResults". |

#### P7 — Icon swaps + size bump

| Item | Value |
|---|---|
| **Files** | `src/components/guidedIcons.jsx` (MODIFY: +120 LOC for new path data + size constants) |
| **LOC delta** | +120 |
| **Effort** | 0.5d |
| **Tests** | Snapshot update for `GuidedDiscoveryStart.test.jsx`. **Measurable AC (G1, already in spec patch)**: assertion `expect(getComputedStyle(filterTypePillIcon).width).toBe('48px')` — done in P1 test, re-asserted post-swap. |
| **Risks** | **Risk #5** (icon procurement) closed by ADR-3 (C1, with G5-corrected rationale). |
| **Acceptance** | Spec AC (patched): "FilterTypeCard pill icons render at `width === 48px`"; "Cuisine bucket icons replaced with continent silhouettes"; Fall/Spring/Spicy SVGs replaced. |
| **Note on size bump scope** | FilterTypeCard pills get `w-12 h-12` (48px). In-Results chip strip stays at `w-7 h-7` (28px) for legibility — confirmed not in spec scope. |

### 2.3 Execution order summary

| Day | Phase(s) | Surface affected | Test gate |
|---|---|---|---|
| D1 AM | P1 + P2 stage 1 (helper + unit tests) | New components | `vitest run guidedRadarAxes GuidedFilterTypeCard` |
| D1 PM | P2 stage 2 (radar component + RTL incl. G4 mode-transition spec) | New component | `vitest run GuidedProfileRadar` |
| D2 AM | P3 + P4 | New components | `vitest run GuidedResultsFilterPills ProvenancePanel` |
| D2 PM | P5 (deck → 2-card + polish + G2 fake-timer spec) | `GuidedDiscoverySwipe.jsx` | `vitest run GuidedDiscoveryStart` |
| D3 AM | P6 (Results migration + G6 bridge-stale spy) | `GuidedDiscoveryResults.jsx`, `App.jsx` | `vitest run GuidedDiscoveryResults`; manual smoke |
| D3 PM | P7 (icon swaps + size bump) | `guidedIcons.jsx` | Snapshot update; visual QA |
| D3 EOD | Full gate | All | `npx vitest run` (target ~497); `npm run build` clean |

### 2.4 Verification Gates (codified per-phase, lesson `pipeline-rebuild-wipes-manual-data-additions` how=5)

Each phase MUST satisfy its grep gate before the commit lands. The
gate command runs in PowerShell on Windows; the equivalent on POSIX
is `grep -c <pattern> <file>`. A failed gate (count ≠ expected) BLOCKS
the commit per the verification protocol.

| After phase | Codified gate | Expected | Rationale |
|---|---|---|---|
| **P4** | `(Select-String -Pattern 'from.*GuidedTour' -Path src/components/GuidedDiscoveryResults.jsx -SimpleMatch).Count` | **0** | Ensures GuidedTour is NOT imported (D2 stays clean). |
| **P5** | `(Select-String -Pattern 'BUBBLE_REGISTRY' -Path src/components/GuidedDiscoverySwipe.jsx).Count` | **0** | Confirms swipe-deck registry is gone from the new 2-card flow (Risk #4 mitigation). |
| **P5** | `(Select-String -Pattern 'BUBBLE_REGISTRY' -Path src/ -Recurse).Count` | **≥ 1** | Confirms registry still imported by Build's flow (preservation guard, Risk #4). |
| **P6** | `(Select-String -Pattern 'CuratedWheel' -Path src/components/GuidedDiscoveryResults.jsx).Count` | **0** | Confirms CuratedWheel mount removed (Spec AC). |
| **P6** | `(Select-String -Pattern 'MultiAxisRadarStack' -Path src/components/GuidedDiscoveryResults.jsx).Count` | **0** | Confirms older radar grid mount removed too. |
| **P6** | `(Select-String -Pattern 'GuidedProfileRadar' -Path src/components/GuidedDiscoveryResults.jsx).Count` | **≥ 1** | Confirms new radar is mounted. |
| **P7** | `(Select-String -Pattern 'CUISINE_ICON_BY_LABEL' -Path src/components/guidedIcons.jsx).Count` | **0** | The const name CHANGES with the swap (new continent-silhouette icons under a new export name `CUISINE_BUCKET_ICON_BY_LABEL` to avoid stale-import bugs). Zero count of the old name verifies the swap landed. *(Alternative reading: keep the name and just swap path data. If executor goes that route, gate flips to "new path-data signature differs from old".)* |
| **P7** | `(Select-String -Pattern 'CUISINE_BUCKET_ICON_BY_LABEL' -Path src/components/guidedIcons.jsx).Count` | **≥ 1** | New export exists. (If executor keeps the old name, drop this gate.) |
| **D3 EOD** | `npx vitest run --reporter=verbose 2>&1 | Select-String 'passed'` | shows ≥ 497 pass | Full-suite gate. |
| **D3 EOD** | `npm run build` | exit 0, no new warnings | Build gate. |

These commands run as a verifier hook in the bridge protocol; a failed
gate writes to `.ralph/gate_failure.md` per the existing R8-49 pattern,
NOT the prose checklist of Round 1.

---

## 3. Test Plan (SHORT mode — no pre-mortem)

### 3.1 Unit tests

**`GuidedFilterTypeCard.test.jsx`** (5-7 specs)
- Renders heading + 4 pills + disabled Got-it
- Click pill → Got-it enables; click Got-it → `onCommit('taste')` fires
- A11y: aria-live on select, aria-disabled on Got-it
- **G1 measurable**: `expect(getComputedStyle(pillIconEl).width).toBe('48px')` (post-P7)

**`guidedRadarAxes.test.js`** (8-10 specs)
- `getAxesFor('cuisine') === CATEGORICAL_AXES.cuisine.labels` (exact ref — locks ADR-2)
- All axis counts (4/6/8/8)
- `pairingMatchesAxis` per filter type
- `coordsForPairing` returns null on missing gnnProbs
- `getColorMapFor('aroma') === BRISCIONE_AROMA`

**`GuidedProfileRadar.test.jsx`** (14-17 specs)
- Axis count per filterType (4 specs)
- No wedge filled at chosenValue=null
- Tap axis → `onAxisTap` fires
- **G1 measurable**: `getComputedStyle(wedgeFill).fillOpacity === '0.55'`
- Matching opacity 1.0, stroke 2.0, label visible
- Non-matching opacity 0.35, no label
- **G4 mode-transition spec** named `'restores all-pairings-at-1.0 on chosenValue=null after a value was set'` — full three-state lifecycle (null → 'sweet' → null)
- Pairings with no signal don't render
- Focal hub renders at center
- Axis label `<button>` has `aria-label="Highlight pairings tagged sweet"`
- `aria-live="polite"` on commit
- **G1 perf**: `measureCommit(() => userEvent.click(pillEl))` returns < 16ms (test-infra wrapper added if absent)

**`ProvenancePanel.test.jsx`** (3-4 specs) — unchanged from R1

**`GuidedResultsFilterPills.test.jsx`** (3 specs) — unchanged from R1

### 3.2 Integration tests

**`GuidedDiscoveryStart.test.jsx`** (updated for P5)
- Ingredient card first; SearchBar + Suggest one work
- Ingredient pick → FilterTypeCard renders
- Filter-type Got-it → `onComplete({ ingredient, filterType })` fires
- **G2 NEW11 spec** named `'no-auto-advance: ingredient pick does NOT auto-render FilterTypeCard'` (fake-timer test detailed in P5 row above)

**`GuidedDiscoveryResults.test.jsx`** (migrated for P6)
- Negative asserts: CuratedWheel + MultiAxisRadarStack NOT rendered
- Positive asserts: GuidedProfileRadar + GuidedResultsFilterPills + ProvenancePanel button rendered
- Tap green axis → opacity transition (1.0 / 0.35)
- Switch pill → axis count flips, chosenValue resets
- Chemistry banner still fires when ≥50% of `selectCuratedPairings()` heroes carry `x3 === 0.5` (OQ4 closure: predicate input unchanged)
- **G6 NEW10 spec** named `'App bridge does not call deriveFilterStackFromBubbles with the new payload shape'` (spy test detailed in P6 row above)

### 3.3 Manual visual QA checklist

- [ ] FilterTypeCard pill icons measure 48px in DevTools
- [ ] Cuisine bucket icons: continent silhouettes readable at chip size
- [ ] Fall/Spring/Spicy: new SVGs visible vs. R1 versions
- [ ] Briscione fill opacity 0.55 matches Notebook wedge wheel
- [ ] Radar render < 16ms at 30 pairings (Chrome DevTools Performance)
- [ ] Pill switch < 16ms commit (React Profiler)
- [ ] No console errors on full end-to-end walkthrough
- [ ] Mobile <480px: no horizontal scroll

### 3.4 Cross-cutting gates

Codified in §2.4 above (Verification Gates table).

---

## 4. ADR Skeletons

### ADR-1 — GuidedProfileRadar: fork from ProfileAxisRadar

**Status:** Proposed (Architect concurred R1). **Decision:** Fork; copy SVG
primitives w/ attribution. `MultiAxisRadarStack.jsx` untouched.
**Drivers:** D1, D2, Principle #2.
**Alternatives:** A1 (extend `MultiAxisRadarStack` with `mode='single'`) —
divergent modes, prop signature inflation, semantic conflict between
`onAxisSelect` and `onAxisTap`, couples Recipe Lab evolution to Guided.
**Why chosen:** Components answer fundamentally different questions; sharing
math primitives (~200 LOC) is bounded; extraction is a future option.
**Consequences:** Two files house axis-spoke math; attribution comment block
in `GuidedProfileRadar.jsx` points back to `ProfileAxisRadar.jsx`.
**Follow-ups:** Extract `src/utils/radarMath.js` if/when a third radar
consumer appears (Track 4 candidate per OQ3 header comment).

### ADR-2 — Cuisine axis ordering: static from `CATEGORICAL_AXES.cuisine.labels` (8 buckets)

**Status:** Proposed (Architect + Critic concurred R1, item 1 R2).
**Decision:** Cuisine axes = the 8 regional buckets declared in
`categoricalAxes.js:165-174`, rendered in declared order: Global, European,
Americas, East Asian, SE Asian, South Asian, Middle Eastern, African.
**Drivers:** D2 (visual consistency), D3 (no per-focal recompute), Principle #1.
**Alternatives:** B2 (dynamic top-N by pairing-count) — loses scan-stability.
**Why chosen:** Verified-architecture finding — the 8-bucket set is canonical;
the spec's "top-12" wording was aspirational and is patched in R2.
**Consequences:** Some focals will have sparse cuisine axes (2-3 of 8 lit).
Acceptable as honest signal.
**Follow-ups:** None for this delivery.

### ADR-3 — Icon procurement: hand-curate inline SVGs (with corrected C2 dismissal)

**Status:** Proposed (Architect + Critic concurred R1, item 10/G5 R2).
**Decision:** Add new inline SVG path data in `guidedIcons.jsx` for FallIcon,
SpringIcon, SpicyIcon, and 8 cuisine continent-silhouette icons. `currentColor`
stroke pattern preserved. No new npm deps.
**Drivers:** D3 (scope discipline), Principle #2.
**Alternatives:**
- **C2 (`flag-icons` CSS sprite)** — corrected from R1: bundle cost is ~12KB
  gzipped, NOT ~250KB. The real disqualifier is **region-vs-flag semantic
  mismatch**: `CATEGORICAL_AXES.cuisine.labels` are 8 regional buckets
  (Americas, East Asian, SE Asian, …) not nation-states. `flag-icons` flags
  individual nations. Picking "a representative flag per region" is a
  politically-fraught reduction the project has explicitly avoided in
  `CUISINE_BUCKETS` design.
- **C3 (static SVGs in `public/icons/`)** — loses `currentColor` palette wiring;
  +11 HTTP requests; reinvents lookup map already in `guidedIcons.jsx`.
**Why chosen:** Continuation of the existing 30+ inline SVG pattern in
`guidedIcons.jsx`; preserves `currentColor` tint behavior used by
`CUISINE_CHIP_COLOR` palette wiring.
**Consequences:** ~3-4h design time; new icons are subjective.
**Follow-ups:** Fallback path = letter-monograms (E / A / EA / SEA / SA / ME /
AF / G) if continent silhouettes don't read at chip size.

### ADR-4 — Provenance: static panel (spec correction, not deviation)

**Status:** Proposed (Critic concurred, R2 re-framing per item 2).
**Decision:** The "Show me where this data comes from" button opens a new
`ProvenancePanel.jsx` static modal listing data sources. It does NOT open
`GuidedTour.jsx`. `GuidedTour.jsx` stays untouched for callers that have a
`sceneHandle` (e.g., network-tab tour entry).
**Drivers:** D1, Principle #1.
**Verified-architecture finding (R2 re-framing):** `GuidedTour.jsx:84-112`
dispatches six scene actions (`animatePull`, `clusterDemo`, `engageAffinity`,
`clearFilters`, `ingredientGlow`, `engageFinalAffinity`) via the
`sceneHandle` prop. From Guided Results there is no `LivingArchView`
imperative handle to plumb in. Honoring the spec's literal "opens the
existing GuidedTour component" wording would ship a tour with all scene
actions no-oping — the user would see step-through copy but the scene
behind it would not respond. This is not a judgment call; it is an
architectural incompatibility verified in the source.
**Alternatives invalidated:**
- D1 (refactor `STAGES` to walk the new flow) — still requires `sceneHandle`
  for the new stages; no plumbing path from Guided Results.
- D3 (hybrid stage 0) — first stage works, later stages hit the same
  `sceneHandle` wall.
**Why chosen:** ProvenancePanel is the honest match to the button copy
semantic AND the only viable architecture given the verified `sceneHandle`
contract. GuidedTour preserved unchanged for future callers.
**Consequences:** New ~110-LOC component. Spec AC line updated by R2 patch.
**Follow-ups:** If chef-user feedback requests a network tour from this
button, add a secondary "Take the network tour" button that mounts
`LivingArchView` first, then invokes `GuidedTour` with the live handle.
Not now.

### ADR-5 — FilterPillRow: fork to `GuidedResultsFilterPills.jsx` (Critic pushback resolution)

**Status:** Proposed (R2 NEW per Critic pushback on Architect item #3).
**Decision:** Create new `GuidedResultsFilterPills.jsx` (~70 LOC, single-select
sibling). Do NOT extend `FilterPillRow.jsx` with `mode='single'`.
**Drivers:** D1 (brownfield safety on a Phase-1 production component used on
the network surface), Principle #2 (fork when prop signature inflates or
semantics invert).
**Alternatives:**
- **E1 (extend `FilterPillRow.jsx` with `mode='single'`)** — uses the existing
  unused `mode` prop placeholder. ~40 LOC change requires: flip `role="checkbox"`
  → `role="radio"`/`radiogroup`; hide "None" pill in single mode; swap
  `onToggle`+`onClear` → `onSelect`. **Blast radius**: 78-LOC component on the
  network hot path; role flip changes aria semantics; three new test paths
  required just to lock the existing `mode='multi'` (default) behavior against
  regressions.
**Why chosen:** Critic's blast-radius argument is sound. The 78-LOC
`FilterPillRow.jsx` ships on the network surface; injecting a role flip
inside a `mode` switch increases test surface in a hot-path component for
no architectural gain. File-table cost of E2 is one extra small file —
bookkeeping, not architecture.
**Consequences:** Two pill components in the codebase. Same Tailwind classes
in both, so visual drift is minimal; can refactor to shared if a third
single-select consumer emerges.
**Follow-ups:** None for this delivery.

---

## 5. Open Questions (post-R2 closures)

| # | Status | Closure |
|---|---|---|
| OQ1 | **Closed (R2 item 2)** | ADR-4 re-framed as spec correction, citing `GuidedTour.jsx:84-112` `sceneHandle` requirement. |
| OQ2 | **Closed (R2 item 1)** | 8 buckets, per `CATEGORICAL_AXES.cuisine.labels`. Spec patched. |
| OQ3 | **Closed (R2 item 4)** | YAGNI: no `theme` prop. Header comment in `GuidedProfileRadar.jsx` flags Track 4 reuse candidate. |
| OQ4 | **Closed (R2 item 3)** | Option (a): keep `selectCuratedPairings` as banner predicate input. Integrated into P6 row. |

**No open questions remain for R2.** Plan is consensus-ready pending the
next Architect/Critic pass.

---

## 6. Risk → Phase Mitigation Table

| # | Risk | Phase | Mitigation | Verification artifact |
|---|---|---|---|---|
| 1 | MultiAxisRadarStack reuse vs. fork | P2 | ADR-1: fork; copy SVG primitives w/ attribution | `GuidedProfileRadar.test.jsx` (14-17 specs incl. G4); `MultiAxisRadarStack.jsx` untouched |
| 2 | Cuisine ordering | P2 helper | ADR-2: read `CATEGORICAL_AXES.cuisine.labels` directly | `guidedRadarAxes.test.js`: exact-reference equality assertion |
| 3 | GuidedTour lifecycle | P4, P6 | ADR-4: ProvenancePanel replaces invocation; GuidedTour.jsx untouched | §2.4 P4 grep gate: `from.*GuidedTour` count === 0 in Results |
| 4 | BUBBLE_REGISTRY orphaning | P5 | Import removed; registry file preserved for Build | §2.4 P5 grep gates: 0 in Swipe.jsx; ≥1 in src/ tree |
| 5 | Icon procurement | P7 | ADR-3: hand-curated inline; C2 rejected on region-vs-flag mismatch (G5) | §2.4 P7 grep gate: `CUISINE_ICON_BY_LABEL` count === 0; `CUISINE_BUCKET_ICON_BY_LABEL` count ≥1 |
| 6 | Cuisine buckets vs. full list | P2 helper | ADR-2: bucket list | Same as Risk #2 |
| 7 | Test migration | P6 | Migrate `GuidedDiscoveryResults.test.jsx`; replace not duplicate | `vitest run GuidedDiscoveryResults` clean; no skipped tests |
| 8 | Soak findings carry-over | Out-of-scope | Tracked as separate commits per spec note | N/A |
| **NEW9** | Chemistry banner orphan | P6 | OQ4 closed to (a): keep `selectCuratedPairings` as predicate input | Banner test in `GuidedDiscoveryResults.test.jsx` still asserts banner fires when majority of heroes have `x3 === 0.5` |
| **NEW10** | App.jsx bridge payload-shape stale | P5, P6 | New `onComplete({ ingredient, filterType })` payload + App.jsx handler update in same commit | **G6 spy test** in `GuidedDiscoveryResults.test.jsx`: `expect(spy).not.toHaveBeenCalledWith(expect.objectContaining({ ingredient, filterType }))` |
| **NEW11** | SwipeDeckCard auto-advance | P5 | Polish bundle disables auto-advance | **G2 fake-timer test** in `GuidedDiscoveryStart.test.jsx`: `vi.advanceTimersByTime(5000)` after pick → FilterTypeCard MUST NOT have rendered until Got-it click |

---

## 7. Files Created / Modified / Deleted Summary

### Created (10 files, ~1,210 LOC) — updated for ADR-5 (fork) + R2 test additions

| File | LOC | Purpose |
|---|---|---|
| `src/components/GuidedFilterTypeCard.jsx` | 80 | Screen 2 (NEW) |
| `src/components/GuidedProfileRadar.jsx` | 280 | Screen 3 hero (NEW; ADR-1 fork) |
| `src/components/GuidedResultsFilterPills.jsx` | 70 | Screen 3 pill row (NEW; ADR-5 fork — *kept per Critic pushback*) |
| `src/components/ProvenancePanel.jsx` | 110 | "Where this data comes from" (NEW; ADR-4) |
| `src/data/guidedRadarAxes.js` | 80 | Pure helper |
| `src/components/__tests__/GuidedFilterTypeCard.test.jsx` | 120 | 5-7 specs (incl. G1 measurable) |
| `src/components/__tests__/GuidedProfileRadar.test.jsx` | 290 | 14-17 specs (incl. G4 mode-transition, G1 fillOpacity, G1 perf) |
| `src/components/__tests__/GuidedResultsFilterPills.test.jsx` | 50 | 3 specs |
| `src/components/__tests__/ProvenancePanel.test.jsx` | 60 | 3-4 specs |
| `src/data/__tests__/guidedRadarAxes.test.js` | 100 | 8-10 specs (incl. exact-ref equality for cuisine) |
| `src/__tests__/utils/measureCommit.js` | ~10 | Optional perf-test wrapper (if not present) |

### Modified (6 files, net +260 LOC)

| File | LOC delta | Change |
|---|---|---|
| `src/components/GuidedDiscoverySwipe.jsx` | -60 | 8-card deck → 2-card sequence |
| `src/components/GuidedDiscoveryResults.jsx` | +180 | Remove CuratedWheel+MultiAxisRadarStack; add new components |
| `src/components/guidedIcons.jsx` | +120 | 4 SVG swaps + size constants |
| `src/components/__tests__/GuidedDiscoveryResults.test.jsx` | +50 | Migrate assertions; add G6 bridge-stale spy |
| `src/components/__tests__/GuidedDiscoveryStart.test.jsx` | -40 | Drop registry tests; add G2 fake-timer spec |
| `src/App.jsx` | +10 | Bridge: receive `{ ingredient, filterType }` |

### Not deleted (preserved per Risk #4)

`src/data/guidedDiscovery.js` (BUBBLE_REGISTRY) · `src/components/GuidedTour.jsx` · `src/components/MultiAxisRadarStack.jsx` · `src/components/CuratedWheel.jsx` · `src/components/ProfileAxisRadar.jsx` · `src/components/FilterPillRow.jsx`.

### Net LOC delta

**~+1,210 added · ~-180 removed · net +1,030 LOC** (up ~60 from R1 due to
G4 mode-transition spec + G2 fake-timer spec + G6 spy spec + measureCommit
helper).

---

## 8. Reuse opportunities flagged

Same as R1: `recipeAromaSimilarity.js` and `pivotAdvanceMs` knob are not
relevant to Track 3. No overlap.

---

## 9. Reporting summary (for parent agent / ralplan consumer)

| Field | Value |
|---|---|
| **Plan file** | `D:\Projects\flavor-network\.omc\plans\ralplan-track-3-guided-overhaul.md` |
| **Spec patch** | 6 surgical edits to `.omc/specs/deep-interview-track-3-guided-overhaul.md`: "top-12" → "8 buckets" (3 locations) + measurable ACs (3 locations: icon width=48px, fillOpacity=0.55, performance.now() <16ms) |
| **Total LOC** | **+1,210 / -180 / net +1,030** across 16 files (10 new + 6 modified) |
| **ADR-1** | Fork GuidedProfileRadar (concurred) |
| **ADR-2** | 8 cuisine buckets, static (concurred, spec patched) |
| **ADR-3** | Inline SVGs; C2 dismissal corrected to region-vs-flag mismatch (concurred + G5) |
| **ADR-4** | ProvenancePanel — re-framed as spec correction citing `GuidedTour.jsx:84-112` `sceneHandle` contract (concurred + item 2) |
| **ADR-5** | **NEW R2:** Fork `GuidedResultsFilterPills.jsx` per Critic pushback; do NOT extend `FilterPillRow.jsx` |
| **Open Questions** | None — OQ1-OQ4 all closed in R2 |
| **Verification protocol** | §2.4 codifies 9 per-phase grep gates + full-suite vitest + build gate at D3 EOD. Mirrors prior delivery's R8-49 verification protocol (failed gate writes `.ralph/gate_failure.md`). |
| **Lesson applied** | `pipeline-rebuild-wipes-manual-data-additions` how=5 — every risk has a codified verification artifact, not prose. |
