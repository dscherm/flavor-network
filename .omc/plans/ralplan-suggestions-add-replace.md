# RALPLAN: Suggestions Tab — ADD/REPLACE Parent Layer

**Source spec:** `D:\Projects\flavor-network\.omc\specs\deep-interview-suggestions-add-replace.md`
**Pipeline:** R15-3 / `347b338b` | **Mode:** consensus / short / non-deliberate
**Generated:** 2026-05-02 by Planner (iteration 2) | **Next:** Architect review

> **Iteration 2 note:** Iteration 1 chose Option A (3-phase rollout). Critic + Architect both flagged that Phase 1's interim state was **factually broken**: with `recipeIngredients.length > 0`, the ternary at `SuggestionDrawer.jsx:796` always takes the REPLACE-columns branch, so a "manual flip to ADD" would render REPLACE chips with `onSwapIngredient` semantics under an "ADD" tab label. **This iteration switches to Option C** (Phases 1+2 bundled, a11y/perf separate) and addresses 9 other findings — see *Iteration 2 Changelog* at the end.

---

## RALPLAN-DR Summary

### Principles (5)
1. **Brownfield-preservation first.** REPLACE mode (`SuggestionDrawer.jsx:461-624` for `replaceColumns` useMemo, `:796-859` for column markup) is shipping behaviour and must not regress — every modification is additive next to the existing `replaceColumns` useMemo, never a rewrite of it.
2. **Drawer-local state only.** RecipeLabMobile owns nothing new; toggle state, mode resolution and stickiness all live inside `SuggestionDrawer.jsx`. No new props on `RecipeLabMobile.handleSwapIngredient` (`RecipeLabMobile.jsx:231-242`).
3. **Engine module stays pure.** `recipeSuggestionEngine.js` (lines 1-22 docstring describes itself as a pure ranker over `recipePairs` + `globalCount`) does NOT learn about taste channels. Bucketing-by-taste lives in a NEW module `src/data/addModeBucketing.js` that calls `rankByRecipeCooccurrence` and then partitions on `scoreIngredient`. Engine stays pure; taste-graph awareness stays in the bucketing layer.
4. **8-column visual rhythm is invariant.** ADD always renders all 8 taste columns; empty columns get a typed placeholder, never collapse. This preserves layout stability across bowl/scope changes.
5. **A11y conformance is non-negotiable.** `role="tablist"` requires matching `role="tabpanel"` + `aria-controls` linkage; arrow-key nav and ≥44px touch targets are spec'd, not optional.

### Decision Drivers (top 3)
1. **Risk to shipped REPLACE behaviour** — REPLACE is in production and tested-by-use; any regression breaks the cocktail-handoff Recipe Lab loop.
2. **Time budget of 2.5 days** (per spec phasing) constrains us to incremental delivery, not a big-bang rewrite of `SuggestionDrawer.jsx`.
3. **Single drawer file footprint** — touching only `SuggestionDrawer.jsx` + adding `SuggestionDrawerToggle.jsx` + adding `addModeBucketing.js` keeps the blast radius small and reviewable. `recipeSuggestionEngine.js` is left untouched in this iteration.

### Viable Options

#### Option A — Phased rollout (3 phases) [REJECTED in iter 2]
- **Phase 1 (1d):** Toggle pill + `manualMode` state + default rule. ADD reuses existing single-grid fallback.
- **Phase 2 (1d):** Add bucketing + 8-column taste grid; remove the legacy single-grid fallback.
- **Phase 3 (0.5d):** A11y + perf polish.

**Why rejected:** Phase 1's "ADD reuses existing single-grid fallback" is impossible. The ternary at `SuggestionDrawer.jsx:796` is `recipeIngredients.length > 0 ? <replaceColumns> : <single-grid>`. When bowl≥1, the ELSE branch never runs regardless of `mode`. A user manually flipping to ADD with bowl≥1 would see REPLACE columns labeled "Replace [name]" with `onSwapIngredient` swap semantics on chip click — directly contradicting the "ADD" tab label. Architect flagged this; verified in this iteration's read.

#### Option B — Single PR
Ship all three phases as one autopilot run, single commit.
**Pros:** No interim state at all; user sees finished UX on first contact.
**Cons:** ~600+ LOC change in one review surface; harder for Critic to isolate REPLACE-regression cause if a test fails. Loses any natural mid-pipeline checkpoint.

#### Option C — Hybrid (Phase 1+2 bundled, Phase 3 a11y/perf separate) [RECOMMENDED]
Land toggle + 8-column grid + bucketing module + ternary rewrite as ONE commit. Ship a11y polish (axe pass + arrow-key nav refinement) + perf measurement as a follow-up commit.

**Pros:**
- Eliminates the broken interim state in Option A — the toggle and the data-flow changes ship together, so ADD always renders ADD semantics.
- Single visible-behaviour commit is easier to user-test in dev than two staged commits where the first one looks like the second one is broken.
- A11y follow-up has a clean diff (no functional changes mixed in), so axe regressions are easy to bisect.
- **Mitigates the original Option C concern (a11y bugs ship to users):** the first commit lands with `role="tablist"`, `role="tab"`, `role="tabpanel"`, `aria-selected`, `aria-controls`, `aria-disabled`, AND `min-h-[44px]` — i.e. the *baseline* a11y contract is in commit 1. Commit 2 only handles axe-discovered nice-to-haves (live-region for mode change, focus-ring polish, color-contrast tuning) and the perf budget verification.

**Cons:** Larger first commit (~250 LOC) than Option A's first phase (~50 LOC). Mitigated by the new module split — the bucketing logic is in its own file, so the SuggestionDrawer.jsx diff stays under ~120 LOC.

**Recommendation: Option C.** Architect explicitly preferred this in iteration 1 review. Two commits, each leaving the app in a working state with ADD = ADD semantics from commit 1.

---

## Requirements Summary

Pulled from spec §Goal (lines 23-53) and §Constraints (lines 103-156):

1. **Visible ADD/REPLACE segmented pill** at top of `SuggestionDrawer` header, immediately above the existing filter pill row at `SuggestionDrawer.jsx:708-728`.
2. **REPLACE mode preserved exactly** — `replaceColumns` useMemo at `SuggestionDrawer.jsx:461-624` is untouched; per-bowl-ingredient column rendering at `:814-858` is untouched; `onSwapIngredient` swap chip behaviour calling `RecipeLabMobile.handleSwapIngredient` (`:231-242`) is untouched.
3. **ADD mode = 8-column taste grid** keyed by **`AXES`** (the existing constant at `SuggestionDrawer.jsx:27` — `['sweet','salty','sour','bitter','umami','spicy','pungent','astringent']`). **Brownfield-consistency note (ADR):** spec text used `['sweet','sour','bitter','salty','umami','spicy','pungent','astringent']` (sour-before-bitter). We OVERRIDE the spec ordering and reuse `AXES` to match every other surface in the drawer + the radar. Each column shows top-12 candidates ranked by `rankByRecipeCooccurrence` strength, partitioned by `dominantTaste`, excluding bowl ingredients.
4. **Mode resolution rule (clarified for centerIngredient):** `effectiveBowlSize = recipeIngredients.length + (centerIngredient ? 1 : 0)`. If `effectiveBowlSize === 0` → ADD. If `effectiveBowlSize >= 1` → REPLACE. Manual flip sticks until `effectiveBowlSize === 0`, at which point `manualMode` resets to `null`. **Rationale:** the bucketing layer in Step 2.2 builds `bowl = [...recipeIngredients, centerIngredient]` and feeds 1+ ingredients to the ranker; if mode resolution used only `recipeIngredients.length`, a centerIngredient-only state (search-selected ingredient with no recipe yet) would default to ADD but the ranker would receive 1 bowl item. Aligning both definitions removes that inconsistency.
5. **Filters preserved across mode flips** — `filterMode` + `activeTab` state (currently at `SuggestionDrawer.jsx:212-220`) survives toggle. Cocktail-mode cuisine-hide at `:243-248` and `:714` continues to apply in both modes. **Tested explicitly in AC-25 (new).**
6. **Scope filter (`scopeFilter` prop, `SuggestionDrawer.jsx:203`) flows into ADD path identically** to its current REPLACE usage at `:607` and chipData usage at `:328-330`.
7. **Performance budgets**: ADD-mode bowl-change rebuild ≤50ms (CPU), mode toggle (no bowl change) ≤16ms (one frame).
8. **A11y**: `role="tablist"` + `role="tab"` + `aria-selected` + `aria-controls` linking each tab to a `role="tabpanel"`; ←/→ arrow keys flip mode when toggle focused; ≥44px touch target per pill.
9. **`?engine=v1` legacy ranker path** (`SuggestionDrawer.jsx:15-19`) must continue to work in BOTH modes. v1 forces legacy avg-NPMI ranking; the bucketing layer must accept whichever ranker output the drawer hands it. **Tested in AC-26 (new).**

---

## Acceptance Criteria

> **Test-quality notes (iter 2):** AC-2 reformulated to assert by `data-mode` attribute (not computed style) so token swaps don't break it. AC-3 split: a className regex assertion runs in JSDOM (CI-gating), and the actual computed `min-height: 44px` measurement is moved to manual QA + Cypress (where real CSS is loaded). AC-22 reformulated to assert deterministic listener/timer disposal counts instead of heap deltas (which are V8-noisy in JSDOM).

### Toggle UI (spec lines 175-183)
- [ ] **AC-1**: Segmented `[ADD] [REPLACE]` pill renders at top of `SuggestionDrawer` header, above the `Filter by` row at `SuggestionDrawer.jsx:708-728`. Verified by `getByRole('tablist')` returning exactly 2 children with `role="tab"`.
- [ ] **AC-2** (revised): Toggle root has a `data-mode` attribute equal to the active mode. Asserted via `expect(screen.getByRole('tablist')).toHaveAttribute('data-mode', 'ADD')` after mount with empty bowl, then `'REPLACE'` after click. (No computed-style assertion; class/token swaps stay free to refactor.)
- [ ] **AC-3** (revised, split):
  - **AC-3a (CI):** Each tab DOM node has a className matching `/min-h-\[44px\]/` (asserted via `expect(addTab.className).toMatch(/min-h-\[44px\]/)`). This catches regressions where the touch-target class is removed.
  - **AC-3b (manual + Cypress):** In a real browser, `getComputedStyle(addTab).minHeight` is `"44px"`. Listed in §Verification → Manual QA. JSDOM cannot compute this from the Tailwind class without a styled fixture.
- [ ] **AC-4**: Pressing `ArrowRight` on the focused active tab moves focus + selection to the next tab; `ArrowLeft` reverses. Asserted via `userEvent.keyboard('{ArrowRight}')` + `expect(replaceTab).toHaveAttribute('aria-selected', 'true')` AND `expect(replaceTab).toHaveFocus()`.
- [ ] **AC-5**: `aria-controls` on each tab matches the `id` of the rendered `role="tabpanel"` element below.

### Default rule (spec lines 184-191, clarified for centerIngredient)
- [ ] **AC-6**: Mount `<SuggestionDrawer recipeIngredients={[]} centerIngredient={null}>` → `getByRole('tab', { selected: true }).textContent === 'ADD'`. REPLACE pill has `aria-disabled="true"` AND clicking it is a no-op (mode does not change, asserted via `data-mode` unchanged after click).
- [ ] **AC-7**: Mount with `recipeIngredients={['onion','garlic']}` → REPLACE selected by default.
- [ ] **AC-8**: With bowl=2 + manual flip to ADD: `data-mode === 'ADD'`. Add a 3rd ingredient (`recipeIngredients={['onion','garlic','butter']}`) → still ADD (sticky). Remove all → bowl=0 → assert mode resolved to ADD via default rule (and that toggling REPLACE is again a no-op since `aria-disabled="true"`).
- [ ] **AC-8b** (new — centerIngredient interaction): Mount with `recipeIngredients={[]} centerIngredient={'tomato'}` → REPLACE selected by default (since `effectiveBowlSize === 1`). Asserted by `expect(replaceTab).toHaveAttribute('aria-selected', 'true')`. AND the bucketing layer receives `bowl = ['tomato']`, asserted by spying on `rankAddByTaste` and verifying the first call's first argument equals `['tomato']` after manual flip to ADD.

### ADD mode rendering (spec lines 193-206)
- [ ] **AC-9**: With ADD active, exactly 8 column headers render with text matching `AXES.map(t => t[0].toUpperCase() + t.slice(1))` in display order (Sweet, Salty, Sour, Bitter, Umami, Spicy, Pungent, Astringent — matching the existing `AXES` constant at `:27`).
- [ ] **AC-10**: Each column shows ≤12 candidate chips (`queryAllByRole('button')` filtered to chip pattern per column ≤ 12).
- [ ] **AC-11**: Column with no candidates after filtering renders a placeholder element with text matching `/no .* (candidates|options)/i` instead of collapsing the column DOM node. The placeholder element exists at `getAllByTestId('add-column')[i]`.
- [ ] **AC-12**: For bowl=`['onion']`, ADD candidates do NOT include "onion": `expect(allChips.map(c => c.textContent)).not.toContain('onion')`.
- [ ] **AC-13**: With `labMode='cocktail'`, the cuisine filter pill is absent from the filter row (existing behaviour at `:714` preserved).
- [ ] **AC-14**: With `scopeFilter=new Set(['lemon','lime','rum','sugar'])` (cocktail-scope), no chip outside that set appears in any ADD column.

### REPLACE mode preservation (spec lines 207-214)
- [ ] **AC-15**: With REPLACE active + bowl=`['onion','garlic']`, exactly 2 column headers render: "Replace onion" + "Replace garlic" (matches existing `:825-833` markup).
- [ ] **AC-16**: Clicking a chip in REPLACE column for "onion" calls `onSwapIngredient('onion', <chipName>)` — NOT `onAddIngredient`. Asserted via mock `onSwapIngredient` spy.
- [ ] **AC-17**: Empty REPLACE column renders "No matches" copy (existing `:840-842` behaviour).
- [ ] **AC-18**: Cocktail-mode + scopeFilter combination behaves identically to today (snapshot test of `replaceColumns` output structure for fixture bowl `['white rum','lime','sugar','mint']`).
- [ ] **AC-19**: All existing `__tests__/affinityShapes|cocktailShapes|sauceShapes.test.js` files continue to pass (no regression in unrelated suites).

### Cross-platform & a11y (spec lines 217-223)
- [ ] **AC-20**: Toggle responds to single tap (`fireEvent.touchStart` + `touchEnd`) AND single click — both flip mode.
- [ ] **AC-21**: Mode change announced via `aria-selected` attribute change on the now-active tab (no separate `aria-live` region required since `aria-selected` flips are screen-reader-announced for tab semantics).
- [ ] **AC-22** (revised — deterministic, JSDOM-stable): Mount → flip ADD↔REPLACE 100 times → unmount. Assert (a) every `addEventListener` registered by the toggle has a matching `removeEventListener` on unmount (spy on `window.addEventListener`/`removeEventListener` and assert call counts equal), AND (b) every `setTimeout`/`setInterval` returned a handle that `clearTimeout`/`clearInterval` was called on. The original heap-delta assertion is preserved as **AC-22b (manual)** — run via Chrome DevTools Memory tab on a real browser and confirm no >5MB delta after 100 flips.

### Filter persistence (new — addresses critic finding #9)
- [ ] **AC-25** (new): Mount `<SuggestionDrawer recipeIngredients={['onion']} activeTab='taste:sweet'>` (REPLACE auto-selected). Click ADD pill → assert `activeTab` prop unchanged (i.e. parent's `onTabChange` was NOT called by the mode flip). Then click REPLACE pill → `activeTab` still `'taste:sweet'`. AND the visible chips in both modes are filtered to sweet — asserted by `getAllByRole('button')` count being lower than the unfiltered baseline. **This is a real regression test, not a comment marker.**

### `?engine=v1` legacy ranker (new — addresses critic finding #8)
- [ ] **AC-26** (new): With `window.location.search = '?engine=v1'` set before module load, mount `<SuggestionDrawer recipeIngredients={['onion']}>` and flip to ADD. Assert (a) the `console.log('[SuggestionDrawer] engine = v1')` from `:23` fired, AND (b) ADD columns still render 8 headers (the bucketing layer gracefully accepts the v1 ranker output, since it operates on `[{name, strength}]` shape that both v1 and v2 produce). If v1 path actually skips through a different code branch in the drawer, document the behaviour and either gate ADD-mode 8-column rendering on `ENGINE_MODE === 'v2'` (with a single-column fallback for v1 + a console warning) OR adapt the bucketing layer to handle v1's output shape — decision deferred to the implementation step but ACs cover both branches.

### Performance (spec lines 226-228)
- [ ] **AC-23**: `performance.measure` of ADD-mode `addColumns` useMemo recomputation on bowl-change ≤50ms p95 over 20 trials with bowl=5 + 3,913-ingredient catalog. Failure mode: log p50/p95/max + abort.
- [ ] **AC-24**: Mode-toggle (bowl unchanged) `performance.measure` from click to next paint ≤16ms p95 over 20 trials.

---

## Implementation Steps

Execute in order. Each step lists the exact file:line where edits land. Two commits total per Option C.

### Commit 1 — Toggle + bucketing + 8-column grid (target: 2 days, single commit)

**Step 1.1.** Create `D:\Projects\flavor-network\src\data\addModeBucketing.js` (NEW module — keeps engine pure).
- Imports: `import { rankByRecipeCooccurrence } from './recipeSuggestionEngine.js'` and `import { scoreIngredient } from './tastePositioning.js'`.
- Exports `TASTE_COLUMNS` constant — a re-export of `AXES` order: `['sweet','salty','sour','bitter','umami','spicy','pungent','astringent']` (NOT the spec's sour-first ordering — see Requirement 3 ADR).
- Exports `computeDominantTaste(name, node)` — returns the `AXES` channel with max value from `scoreIngredient(name, node)`. Tie-break: alphabetical channel name (per spec risk #1 — `Object.entries(channels).sort((a,b) => b[1]-a[1] || a[0].localeCompare(b[0]))[0]`). Returns `null` if all channels are zero or node missing.
- Exports `rankAddByTaste(bowl, recipePairs, globalCount, nodes, scopeFilter = null, opts = {})`:
  ```js
  export function rankAddByTaste(bowl, recipePairs, globalCount, nodes, scopeFilter = null, opts = {}) {
    const { topK = 12, candidatePoolSize = 200 } = opts;
    const ranked = rankByRecipeCooccurrence(bowl, recipePairs, globalCount, candidatePoolSize);
    const buckets = Object.fromEntries(TASTE_COLUMNS.map(t => [t, []]));
    const bowlSet = new Set(bowl || []);
    for (const cand of ranked) {
      if (bowlSet.has(cand.name)) continue;
      if (scopeFilter && !scopeFilter.has(cand.name.toLowerCase())) continue;
      const dom = computeDominantTaste(cand.name, nodes?.get(cand.name));
      if (!dom || !buckets[dom]) continue;
      if (buckets[dom].length < topK) buckets[dom].push({ ...cand, dominantTaste: dom });
    }
    return TASTE_COLUMNS.map(t => ({ taste: t, candidates: buckets[t] }));
  }
  ```
- **Engine purity preserved.** `recipeSuggestionEngine.js` is NOT modified in this iteration. `addModeBucketing.js` is the only new dependency on `tastePositioning.js`.

**Step 1.2.** Create `D:\Projects\flavor-network\src\components\SuggestionDrawerToggle.jsx`.
- Pure presentational. Props: `{ mode, onChange, effectiveBowlSize, panelId }`.
- Renders `<div role="tablist" aria-label="Suggestion mode" data-mode={mode}>` with two children:
  - `<button role="tab" aria-selected={mode==='ADD'} aria-controls={panelId} aria-disabled={false} className="min-h-[44px] ...">ADD</button>`
  - `<button role="tab" aria-selected={mode==='REPLACE'} aria-controls={panelId} aria-disabled={effectiveBowlSize===0} className="min-h-[44px] ...">REPLACE</button>`
- `onClick` of each calls `onChange('ADD' | 'REPLACE')`. REPLACE click is no-op when `effectiveBowlSize===0`.
- `onKeyDown` handles `ArrowLeft`/`ArrowRight` to flip mode + move DOM focus to the other tab via `tabRef.current?.focus()`.
- Style: tailwind classes matching existing tab-active palette (cyan bg + white text active; `min-h-[44px]` literally on each pill).

**Step 1.3.** Edit `D:\Projects\flavor-network\src\components\SuggestionDrawer.jsx`:

a) Add import after line 7: `import { rankAddByTaste, TASTE_COLUMNS } from '../data/addModeBucketing.js';`
b) Add import after line 10: `import SuggestionDrawerToggle from './SuggestionDrawerToggle.jsx';`
c) After line 212 (`const [filterMode, setFilterMode] = useState('taste');`), add:
   ```js
   const [manualMode, setManualMode] = useState(null);
   const effectiveBowlSize = (recipeIngredients?.length || 0) + (centerIngredient ? 1 : 0);
   const mode = manualMode !== null ? manualMode : (effectiveBowlSize === 0 ? 'ADD' : 'REPLACE');
   ```
d) After the existing `useEffect` block ending at line 248, add:
   ```js
   useEffect(() => { if (effectiveBowlSize === 0 && manualMode !== null) setManualMode(null); }, [effectiveBowlSize, manualMode]);
   ```
e) Add new `addColumns` useMemo after `replaceColumns` (after `:624`):
   ```js
   const addColumns = useMemo(() => {
     if (mode !== 'ADD' || !nodes || !recipePairs || !globalCount) {
       return TASTE_COLUMNS.map(t => ({ taste: t, candidates: [] }));
     }
     const bowl = [...new Set([...(recipeIngredients || []), ...(centerIngredient ? [centerIngredient] : [])])];
     return rankAddByTaste(bowl, recipePairs, globalCount, nodes, scopeFilter, { topK: 12 });
   }, [mode, nodes, recipePairs, globalCount, recipeIngredients, centerIngredient, scopeFilter]);
   ```
f) Render the toggle: immediately after the drag-handle block ending at line 702 and before the `Filter by` row starting at line 708, insert `<SuggestionDrawerToggle mode={mode} onChange={setManualMode} effectiveBowlSize={effectiveBowlSize} panelId="suggestion-panel" />`.
g) **Replace the ternary at `:796`** with mode-aware branching wrapped in a tabpanel:
   ```jsx
   <div role="tabpanel" id="suggestion-panel" data-mode={mode}>
     {mode === 'REPLACE' && recipeIngredients.length > 0 ? (
       /* existing replaceColumns grid at :804-860 — unchanged */
     ) : mode === 'ADD' ? (
       /* NEW 8-column grid using addColumns + applyChipFilter — see Step 1.4 */
     ) : (
       /* fallback: REPLACE selected but bowl is empty (only reachable via centerIngredient gone race) — render single-grid filteredChips :862-899 unchanged */
     )}
   </div>
   ```
   The legacy `:861-900` single-grid fallback STAYS for the REPLACE-with-empty-bowl edge case. ADD now ALWAYS renders the 8-column grid regardless of bowl size.

**Step 1.4.** ADD-mode column rendering (inside the `mode === 'ADD'` branch from Step 1.3g):
- Grid container: `<div className="grid gap-2 pb-1" style={{ gridTemplateColumns: isMobile ? 'repeat(2, minmax(0, 1fr))' : 'repeat(auto-fit, minmax(140px, 1fr))' }}>` (mobile = 2 cols × 4 rows; desktop = auto-fit, typically 4-8 cols).
- Per column (`addColumns.map(col => ...)`):
  - Apply existing filter the same way REPLACE does at `:815`: `const filtered = applyChipFilter(col.candidates, activeTab, nodes);`
  - Header: `<p className="text-[10px] uppercase tracking-wider">{col.taste}</p>` capitalized.
  - Body: `filtered.slice(0, 12).map(chip => <ChipButton key={chip.name} chip={chip} onAdd={onAddIngredient} ... />)` — `onAdd` IS `onAddIngredient`, NEVER `onSwapIngredient` (ADD is additive).
  - Empty: when `filtered.length === 0`, render placeholder `<p data-testid="add-column-empty">No {col.taste} {labMode === 'cocktail' ? 'options in cocktail scope' : 'candidates'}</p>` (per spec risk #3).
  - Wrap each column in `<div data-testid="add-column">` for AC-11 lookup.

**Step 1.5.** Add tests. New files (Vitest):
- `D:\Projects\flavor-network\src\data\__tests__\addModeBucketing.test.js` — pure-function tests for `rankAddByTaste` + `computeDominantTaste`. Covers AC-9 (8 columns), AC-10 (≤12), AC-12 (bowl exclusion), AC-14 (scopeFilter). Tie-break determinism test (R1).
- `D:\Projects\flavor-network\src\components\__tests__\SuggestionDrawerToggle.test.jsx` — toggle UI in isolation. Covers AC-1, AC-2, AC-3a, AC-4, AC-5, AC-20 (touch + click), AC-21.
- `D:\Projects\flavor-network\src\components\__tests__\SuggestionDrawer.modeResolution.test.jsx` — mode resolution + stickiness. Covers AC-6, AC-7, AC-8, AC-8b (centerIngredient).
- `D:\Projects\flavor-network\src\components\__tests__\SuggestionDrawer.addMode.test.jsx` — full-mount ADD rendering. Covers AC-9 (column order via DOM), AC-11 (empty placeholder), AC-13 (cocktail cuisine-hide), AC-15-AC-18 (REPLACE preservation), AC-25 (filter persistence across mode flips), AC-26 (engine=v1 path).

**Step 1.6.** Run `npm test` → all pass (new + existing). Verify AC-19 explicitly by running the three pre-existing affinity/cocktail/sauce shape suites.

**Step 1.7.** Commit message:
```
feat(suggestion-drawer): ADD/REPLACE toggle + 8-column taste grid (1/2)

- New module src/data/addModeBucketing.js wraps rankByRecipeCooccurrence
  with per-taste bucketing. Engine module stays pure.
- New component SuggestionDrawerToggle with role=tablist + arrow nav.
- Toggle, mode resolution, and 8-column ADD grid land together to avoid
  any interim state where ADD label renders REPLACE semantics.
- REPLACE behaviour preserved verbatim. AC-15..AC-19 enforce no regression.
- effectiveBowlSize includes centerIngredient (Iter-2 clarification).
```

### Commit 2 — A11y + perf measurement (target: 0.5 day, single commit)

**Step 2.1.** Add `D:\Projects\flavor-network\src\components\__tests__\SuggestionDrawer.perf.test.jsx`:
- AC-22 (deterministic dispose-count assertion via `vi.spyOn(window, 'addEventListener')` + `removeEventListener` paired-call assertion).
- AC-23 (`addColumns` rebuild perf — use `performance.now()`, log p50/p95/max, fail if p95 > 50ms).
- AC-24 (mode-toggle paint).

**Step 2.2.** Run `npx axe-core` (or `@axe-core/react`) against the rendered drawer fixture to verify zero violations on `role="tab"` / `role="tabpanel"` / `aria-controls`. If violations surface, fix them in this commit (e.g. add `aria-label` to the tablist if axe flags the lack of accessible name).

**Step 2.3.** Manual QA pass on local dev server using checklist in §Verification → Manual QA. Specifically run AC-3b (computed `min-height: 44px` in real browser) and AC-22b (heap delta in Chrome DevTools).

**Step 2.4.** Commit message: `feat(suggestion-drawer): a11y axe pass + perf measurement (2/2)`.

---

## Risks and Mitigations

(refined from spec §Risks lines 270-310)

| # | Risk | Mitigation |
|---|------|-----------|
| R1 | **Dominant-taste ties** for ingredients like ginger/fennel land non-deterministically. | `computeDominantTaste` uses alphabetical channel-name tie-break: `Object.entries(channels).sort((a,b) => b[1]-a[1] \|\| a[0].localeCompare(b[0]))[0]`. Asserted by addModeBucketing test (R1 determinism case). |
| R2 | **Empty-bowl ADD ranking** has no co-occurrence signal. | Already mitigated upstream — `rankByRecipeCooccurrence:29-39` falls back to `globalCount` ranking when `bowl.length === 0`. No new code needed; bucketing layer just consumes the result. |
| R3 | **Cocktail/sauce scope shrinks columns to near-empty.** | Empty-column placeholder copy is scope-aware: cocktail-mode renders "No {taste} options in cocktail scope" (Step 1.4). Asserted by AC-11 + AC-13. |
| R4 | **REPLACE pill not visibly disabled when bowl=0.** | `aria-disabled="true"` AND `opacity-50` styling AND click no-op when `effectiveBowlSize===0`. Asserted by AC-6. **Telemetry follow-up added to ADR §Follow-ups** so we can measure click-on-disabled rate before deciding whether to add a toast (spec risk #4). |
| R5 | **Filter persistence regression** if a future refactor moves filter state out of component-local. | **AC-25 is a real test** asserting `activeTab` prop survives mode flips AND filtered chip count is preserved. Removed the iter-1 "comment marker" approach — comments don't catch regressions. |
| R6 | **Scope filter prop threading silently broken** in ADD path. | `rankAddByTaste` accepts `scopeFilter` as an explicit parameter, not derived from any context. AC-14 asserts cocktail scope correctness. |
| R7 | **Performance regression from 8 sorts vs 1.** | The implementation is single-pass partition (allocate 8 arrays upfront, single iteration over `ranked`, push into bucket if `length < topK`) — see Step 1.1 code. No 8 sorts. AC-23 measures the result with 50ms p95 budget; if exceeded we tune `candidatePoolSize` (currently 200). |
| R8 | **A11y compliance gap** — `role="tab"` without `role="tabpanel"` triggers axe warnings. | Wrap chip area in `<div role="tabpanel" id="suggestion-panel">` (Step 1.3g) and link via `aria-controls="suggestion-panel"` on each tab. Verified by Step 2.2 axe pass. |
| R9 | **Engine purity violation (architect finding 2).** | Resolved by Step 1.1's design: `recipeSuggestionEngine.js` is NOT touched. `tastePositioning.js` is imported only by the new `addModeBucketing.js` module. Engine docstring at lines 1-22 still describes the truth. |
| R10 | **`?engine=v1` regression (critic finding 8).** | AC-26 covers it. `addModeBucketing.js` operates on the `[{name, strength}]` shape that both v1 and v2 produce — but if implementation reveals the v1 path actually short-circuits ADD entirely, gate ADD's 8-column rendering on `ENGINE_MODE === 'v2'` and fall back to a single-column "v1: column view unavailable, click an ingredient to swap" message. Decision deferred to Step 1.4 implementation reading. |
| R11 | **centerIngredient/mode-resolution mismatch (critic finding 6).** | Resolved by `effectiveBowlSize = recipeIngredients.length + (centerIngredient ? 1 : 0)`. AC-8b is the dedicated test. |
| R12 | **JSDOM heap-test flakiness (critic finding 7).** | Resolved by AC-22 reformulation: assert paired listener/timer disposal call counts, not `process.memoryUsage().heapUsed`. Real-browser heap delta moved to manual AC-22b. |
| R13 | **AC-3 JSDOM gap (critic finding 5).** | Resolved by AC-3 split: AC-3a checks className regex in JSDOM (CI-gating); AC-3b checks computed style in real browser (manual + Cypress). |

---

## Verification Steps

### Automated (gating commits)
```powershell
# Commit 1 gate
npm test -- addModeBucketing
npm test -- SuggestionDrawerToggle
npm test -- SuggestionDrawer.modeResolution
npm test -- SuggestionDrawer.addMode
npm test  # full suite — verify no regression in affinityShapes/cocktailShapes/sauceShapes (AC-19)

# Commit 2 gate
npm test -- SuggestionDrawer.perf
npx axe-core  # or whichever axe runner the project standardizes on
```

### Manual QA checklist (run after Commit 2)
Open `npm run dev` (port 5173), navigate to Recipe Lab on mobile-viewport emulation:

- [ ] Empty bowl: ADD pill is selected, REPLACE pill visibly de-emphasized with `aria-disabled`. Clicking REPLACE does nothing.
- [ ] Search "onion" + add: REPLACE auto-engages, "Replace onion" column appears with chip candidates.
- [ ] Add "garlic": REPLACE shows 2 columns. Click chip in onion column → onion swaps for that chip (existing behaviour).
- [ ] Manually flip to ADD: 8 columns (Sweet, Salty, Sour, Bitter, Umami, Spicy, Pungent, Astringent — matching `AXES` order) appear. Each shows ≤12 chips. Onion + garlic are NOT in any column.
- [ ] Add "butter" via ADD chip click: bowl now has 3 ingredients, mode is still ADD (sticky). Verify no auto-flip.
- [ ] Remove all 3 ingredients via Recipe Lab UI: bowl=0, ADD remains active (default rule + sticky reset both produce ADD). REPLACE pill goes back to disabled state.
- [ ] **centerIngredient interaction:** open the drawer with a search-selected ingredient (centerIngredient set, recipeIngredients empty) → REPLACE auto-selected (effectiveBowlSize=1). Manual flip to ADD → bucketing receives `bowl=[centerIngredient]`.
- [ ] **Filter persistence:** click a taste filter pill (e.g. "sweet"): only chips matching sweet remain visible across all 8 ADD columns. Toggle to REPLACE: filter persists, REPLACE columns also filter to sweet.
- [ ] Switch to Cocktail Lab → Open in Recipe Lab → bowl populated with cocktail ingredients. Cuisine pill is hidden in both ADD and REPLACE modes.
- [ ] In ADD mode + cocktail context, the umami column likely shows "No umami options in cocktail scope" placeholder.
- [ ] Tab to the toggle pill, press →/← arrows: focus moves between ADD and REPLACE pills, mode flips accordingly.
- [ ] **AC-3b:** Open DevTools, inspect each tab pill, confirm computed `min-height` is `44px`.
- [ ] Open Chrome DevTools Performance tab, record while flipping ADD↔REPLACE 5x: each flip should be one frame (≤16ms scripting time).
- [ ] **AC-22b:** Open DevTools Memory tab, take heap snapshot, flip 100×, take second snapshot. Delta should be < 5MB.
- [ ] Open DevTools axe extension: zero violations on the drawer DOM subtree.
- [ ] **`?engine=v1` regression:** open `http://localhost:5173/?engine=v1` → flip to ADD → either 8 columns render OR the v1-fallback message renders (whichever Step 1.4 settled on). NO crash, NO blank panel.

### Cross-platform verification (deferred to TestFlight cycle)
- [ ] iOS Capacitor wrap: toggle responds to single tap. ARIA semantics carry through to VoiceOver (announces "ADD, tab, selected, 1 of 2").
- [ ] Real iPhone 11 baseline: ADD-mode rebuild on bowl-change feels instant (no perceived hitch).

---

## Phase ETA Summary
| Commit | Scope | Time | Files |
|--------|-------|------|-------|
| 1 | Toggle + bucketing module + 8-col grid + ternary rewrite | 2d | New: `addModeBucketing.js`, `SuggestionDrawerToggle.jsx`, 4 test files · Mod: `SuggestionDrawer.jsx` (~120 LOC: imports, state, useMemo, toggle render, ternary rewrite, ADD branch) |
| 2 | A11y axe pass + perf measurement | 0.5d | New: `SuggestionDrawer.perf.test.jsx`. Manual axe + DevTools perf pass. Possible micro-edit to toggle for axe nice-to-haves. |
| **Total** | | **2.5d** | 1 file modified, 6 files created |

---

## ADR (final)

- **Decision:** Adopt **Option C** — bundle Toggle + 8-column grid + bucketing module as ONE commit (eliminates broken interim state); ship a11y/perf as a follow-up commit.
- **Drivers:**
  1. Iteration-1 (Option A) Phase 1 was factually broken — the `recipeIngredients.length > 0` ternary at `SuggestionDrawer.jsx:796` made manual-flip-to-ADD render REPLACE semantics under an "ADD" label. Option C avoids ever shipping that contradiction.
  2. 2.5-day budget fits two commits without forcing a single 600-LOC review surface.
  3. Engine purity (architect finding 2) requires the bucketing logic to live in a NEW module, not extending the existing engine — implemented in Step 1.1.
- **Alternatives considered:**
  - **Option A (3-phase):** rejected — interim state contradicts the toggle label (see Driver 1).
  - **Option B (single PR):** rejected — review surface bloat; harder to bisect a11y regressions when polish is mixed with functional code.
- **Why chosen:** Option C is the minimum-risk path that ships ADD = ADD semantics from commit 1 while keeping the a11y/perf polish in a clean, axe-only diff for commit 2. Each commit leaves the app in a working, regression-free state.
- **Consequences:**
  - Commit 1 is larger (~250 LOC across 1 modified + 5 new files) but per-file diffs stay small (drawer ~120 LOC; toggle component ~80 LOC; bucketing module ~50 LOC).
  - `addModeBucketing.js` becomes the only module that knows about both `recipeSuggestionEngine` ranking AND `tastePositioning` taste channels. Future "rank by aroma" or "rank by cuisine" features get parallel modules (e.g. `addModeBucketingByAroma.js`), not new exports on the engine.
  - **Brownfield-consistency override:** spec used `[sweet, sour, bitter, ...]` ordering but we ship `AXES` ordering `[sweet, salty, sour, bitter, ...]`. Documented at Requirement 3 + AC-9.
  - `centerIngredient` now contributes to `effectiveBowlSize` for default-mode resolution AND for the bowl handed to `rankAddByTaste`. Both definitions agree.
- **Follow-ups:**
  1. **Telemetry on disabled-REPLACE clicks** (spec risk #4 + critic finding 10): add a `data-omc-event="replace-disabled-click"` attribute or fire `console.debug('[telemetry] replace-disabled-click')` on the no-op click handler so we can later wire it to the project's analytics layer. After 1 week of usage, decide whether the disabled state needs a toast or stronger affordance based on click rate.
  2. Revisit empty-bowl `globalCount` ordering after commit 1 ships — current behaviour ranks by raw recipe-frequency, which may bias toward sugar/onion/garlic across all 8 columns. If visually monotonous, add per-taste `globalCount` normalization in `addModeBucketing.js`.
  3. Foundation for future "best match across all tastes" column if spec scope ever expands (currently a Non-Goal).
  4. If AC-26 implementation reveals `?engine=v1` needs special-case handling, file a follow-up to either bring v1 to feature parity or formally deprecate the legacy ranker path.

---

## Iteration 2 Changelog

10 fixes applied in this revision (one-liner per item):

1. **Switched recommendation from Option A → Option C.** Phase 1's interim state was factually broken — `recipeIngredients.length > 0` ternary at `SuggestionDrawer.jsx:796` makes manual-flip-to-ADD render REPLACE semantics. Bundling Phases 1+2 eliminates the contradiction.
2. **Engine purity preserved.** New module `src/data/addModeBucketing.js` wraps `rankByRecipeCooccurrence`; `tastePositioning` import does NOT leak into `recipeSuggestionEngine.js` anymore. R9 + Step 1.1 reflect this.
3. **TASTE_COLUMNS reuses `AXES` constant** at `SuggestionDrawer.jsx:27` (`[sweet,salty,sour,bitter,umami,spicy,pungent,astringent]`) for brownfield consistency. Override of spec ordering documented in Requirement 3 + ADR §Consequences.
4. **AC-2 reformulated** to assert `data-mode={mode}` attribute instead of computed background style — robust against token swaps.
5. **AC-3 split into AC-3a (className regex, JSDOM CI) + AC-3b (computed `min-height`, real browser manual + Cypress)** to avoid the JSDOM no-op silently passing.
6. **`centerIngredient` interaction** explicit: `effectiveBowlSize = recipeIngredients.length + (centerIngredient ? 1 : 0)` is used for BOTH default-mode resolution AND the bowl handed to `rankAddByTaste`. New AC-8b covers it.
7. **AC-22 reformulated** to assert deterministic listener/timer disposal call counts (JSDOM-stable) instead of `process.memoryUsage().heapUsed` (V8-noisy). Real-browser heap delta preserved as manual AC-22b.
8. **AC-26 added** for `?engine=v1` regression coverage — bucketing layer accepts both v1 + v2 ranker output shapes; if implementation reveals divergence, fall back to a v1-aware single-column message.
9. **AC-25 added** — real filter-persistence regression test (asserts `activeTab` prop unchanged after mode flip AND filtered chip count preserved). Replaces the iter-1 "comment marker" mitigation that wouldn't catch regressions.
10. **Telemetry follow-up added to ADR** for disabled-REPLACE clicks per spec risk #4 + critic finding 10 — `data-omc-event` or `console.debug` instrumentation in commit 1, decide on toast vs. silent after 1 week of click-rate data.

---

## Iteration 2 Reviewer Notes (APPROVE — implementer pickups)

Both reviewers APPROVED. The following minor items are non-blocking implementation pickups (no further plan iteration required):

- **Step 1.3g defensive branch comment.** The fallback at line 192 ("REPLACE selected but bowl is empty (only reachable via centerIngredient gone race)") is reachable but rare. Keep the branch but add a one-line code comment in the implementation explaining why the resetOnEmpty effect normally pre-empts it.
- **AC-26 deferred branch resolution.** Implementer should read `recipeSuggestionEngine.js:15-23` in commit 1 to verify whether `?engine=v1` produces the same `[{name, strength}]` shape `addModeBucketing.js` consumes. If divergent, ship the v1-aware single-column fallback message; if compatible, the AC's "either branch" passes naturally. Bounded ≤30 min decision.
- **Step 1.3e double-Set redundancy.** The bowl is built as `[...new Set([...recipeIngredients, ...centerIngredient])]` AND `rankAddByTaste` derives `bowlSet = new Set(bowl)` internally. Drop the inner Set construction in `addModeBucketing.js` — accept the array and dedupe at the call site only.
- **AC-25 assertion tightening.** Plan asserts "filtered chip count is lower than unfiltered baseline." Strengthen to "every visible chip's dominant taste === selected filter taste" — catches more regressions for trivial cost.
- **LOC estimate drift.** `~120 LOC` for the drawer mod is optimistic given imports + state + useMemo + toggle render + ternary rewrite + ADD branch with grid container/header/body/empty placeholder. Realistic budget: 150-180 LOC. Not blocking; just don't be surprised when commit 1 shows ~170 lines.

**Consensus state:** Architect APPROVE (iter-2) + Critic APPROVE (iter-2). Plan ready for autopilot execution.
