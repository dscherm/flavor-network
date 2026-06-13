# Deep Interview Spec: Pairing Formula Audit + Guided Discovery + Radial Wheel

## Metadata
- Interview ID: `deep-interview-pairing-audit-and-guided-discovery`
- Rounds: 6
- Final Ambiguity Score: **11.3%** (well under 20% threshold)
- Type: **brownfield**
- Generated: 2026-05-13
- Threshold: 0.20
- Initial Context Summarized: no (audit reports treated as prompt-safe context)
- Status: **PASSED**

## Clarity Breakdown
| Dimension | Score | Weight | Weighted |
|-----------|-------|--------|----------|
| Goal Clarity | 0.94 | 0.35 | 0.329 |
| Constraint Clarity | 0.92 | 0.25 | 0.230 |
| Success Criteria | 0.88 | 0.25 | 0.220 |
| Context Clarity (brownfield) | 0.72 | 0.15 | 0.108 |
| **Total Clarity** | | | **0.887** |
| **Ambiguity** | | | **0.113 (11.3%)** |

---

## Goal

Ship a **bundled artifact** in two parts:

### Part A — Validation audit (rolling harness)
A persistent validation system that scores the current pairing formula against external ground-truth pairings (The Flavor Bible, The Flavor Matrix, chef citations) across **four composite "surprise" axes**:
1. **Chem-bridged corpus-rare** (what `surprisingAffinities()` already ships)
2. **Absent from Flavor Bible / Flavor Matrix**
3. **Cross-cuisine boundary**
4. **Cross-aroma-family / cross-taste-axis**

The harness is **rolling** — first run uses a small seed (~30 pairings), each subsequent session grows the ground-truth file. Zero throwaway work; compounds value.

The harness publishes a markdown report after each run with per-axis precision, recall, beyond-book count, and cross-source agreement. **It does NOT train the perceptron weights in this build** — training is a follow-up triggered by an "audit says weights are off" verdict.

### Part B — Guided Discovery feature + landing rename + shared radial wheel
A new landing-page CTA that delivers a **scaffolded, single-flow** discovery experience converging on a **2D radial affinity wheel** that is also reused inside `IngredientPanel`.

User-facing changes:
- Landing card renamed: **"Network" → "Explore the NeuFlavor Network"**
- Landing gains a 5th card: **"Guided Discovery"**
- New flow: sentence starter `"I'm thinking about pairing that…"` → grid of multi-selectable **thought-bubble cards** (one of which is `"Starts with a specific ingredient"` — opens inline ingredient search) → 2D radial wheel of curated pairings → expandable **"Why this works"** story per pairing.
- New shared component **`RadialAffinityWheel`** with two modes:
  - `curated` — 5–10 hero pairings + story labels (used in Guided Discovery)
  - `full` — full neighbor cloud (used in IngredientPanel via a new "View as wheel" toggle)

Emotional outcome: **search satisfaction + educational**, NOT provocation/inspiration and NOT editorial mentorship.

---

## Defined Variables

### Thread map (final)
```
THREAD_1_AUDIT      = IN_SCOPE  (rolling harness; no perceptron training)
THREAD_2_FLAVORPAIR = DEFERRED  (Appendix A backlog)
THREAD_3_CUISINES   = DEFERRED  (Appendix A backlog)
THREAD_4_WHEEL      = IN_SCOPE  (promoted via Round 5 unification with #5)
THREAD_5_GUIDED     = IN_SCOPE  (single-flow architecture, search-as-bubble-card)
```

### Surprise axes (composite, validated independently)
```
SURPRISE_AXES = [
  'chem-bridged-rare',     // GNN compound bridge, low corpus co-occurrence
  'absent-from-books',     // we recommend it, FB+Matrix don't list it
  'cross-cuisine',         // bridges cuisines that rarely meet in corpus
  'cross-aroma'            // bridges aroma families (e.g., fatty bridge between fruity+woody)
]
```

### Guided Discovery state
```
bubbleStack = []                          // ordered, multi-select
THOUGHT_BUBBLES = [
  { key: 'ingredient', label: 'Starts with a specific ingredient', subUI: 'ingredient-search' },
  { key: 'season',     label: 'Goes with a season',                 subUI: 'season-picker' },
  { key: 'cuisine',    label: 'Goes with a cuisine',                subUI: 'cuisine-picker' },
  { key: 'cocktail',   label: 'Is for a cocktail',                  subUI: 'cocktail-scope-toggle' },
  { key: 'meat',       label: 'Is for a meat / protein',            subUI: 'meat-picker' },
  { key: 'dessert',    label: 'Is for a dessert',                   subUI: 'dessert-flag' },
  { key: 'sauce',      label: 'Is for a sauce',                     subUI: 'sauce-scope-toggle' },
  { key: 'aroma',      label: 'Has a specific aroma family',        subUI: 'aroma-picker' },
]

isReadyToShowPairings = bubbleStack.length > 0
```

### Audit ground-truth schema
```jsonc
// chemDataset/validation/ground_truth.json
{
  "version": 1,
  "pairings": [
    {
      "a": "salmon",
      "b": "dill",
      "sources": ["flavor-bible-p123", "flavor-matrix-p45"],
      "strength_book": "★★★",                            // FB-style if applicable
      "axes_validated": ["cross-cuisine", "cross-aroma"]  // which surprise axes this exemplifies
    }
  ]
}
```

### Audit metrics per surprise axis
```
precision@K   = (our top-K matching axis ∩ ground_truth) / K
recall@K      = (ground_truth pairings we surface in top-K) / |ground_truth|
beyondBook@K  = (our top-K NOT in ground_truth) / K            // the novelty signal
crossSource   = jaccard(FB_matches, Matrix_matches) per pairing
```

### RadialAffinityWheel props
```
<RadialAffinityWheel
  focal={ingredient | null}
  mode={'curated' | 'full'}
  filterStack={Filter[]}
  pairings={Pairing[]}
  storyFn={whyThisWorks}     // only invoked in curated mode
  onSelectPairing={(p) => void}
/>
```

### "Why this works" story
```
whyThisWorks(a, b, gnnEntropy, bridgeCompounds, groundTruth) → {
  headline: string,                  // e.g., "Both share methyl anthranilate (grape-bubblegum compound)"
  compoundBridge: Compound | null,   // strongest shared aroma compound, if any
  citationsIfAny: Citation[],        // FB / Matrix page refs from ground_truth
  surpriseAxesMatched: string[]      // which of the 4 axes this pairing hits
}
```

---

## Constraints

### Audit constraints
- **No book text extraction.** Use publicly-visible reference data only (FB front-matter tables that have appeared in reviews, Matrix wheel data, chef-cite quotes). Legal gray-area avoided.
- **First run seed ≥ 30 pairings** (≥10 from FB, ≥10 from Matrix, ≥10 from chef-cite or our own curated bridge_compounds).
- **No perceptron training in this build.** The harness produces a baseline score for the current untrained weights; training is a follow-up gated on "audit says weights are off."
- **Harness completes one run in <30s** for the current ~48,588 pairings + ~30 ground-truth entries.
- Output: markdown report at `chemDataset/validation/reports/run-{YYYY-MM-DD}.md`. Most recent run also symlinked / copied to `LATEST.md`.

### Guided Discovery / wheel constraints
- **Single flow, not two-entry-points.** Bubbles are always the front door; ingredient-search is just one of the bubble cards. Picking it does NOT end the flow — user stays on the bubble grid to keep stacking context.
- **Multi-select bubbles.** Stack shown as breadcrumb chips at top.
- **"Show me pairings" CTA** only enabled when `bubbleStack.length > 0`.
- **Screen 2 = RadialAffinityWheel `curated` mode** with 5–10 hero pairings + per-pairing "Why this works" story.
- **`RadialAffinityWheel` is a SHARED component** used in two places. One build, two configurations.
- **IngredientPanel gains a "View as wheel" toggle** that swaps the ranked-list pairings view for `RadialAffinityWheel` `full` mode.
- **Reuse existing infra.** `FilterPillRow`, `categoricalAxes.js` bucket colors, `bridge_compounds.json`, GNN entropy data, `affinityTiers.js` — all reused. No greenfield rewrites.
- **Mobile parity required.** Both new components responsive; wheel falls back to a list-with-bucket-headers below a min viewport width.
- **Landing has exactly 5 cards** after this change. No more.

### A11y
- Thought-bubble cards: `role="checkbox"` with `aria-checked`; bubble row is `role="group"` `aria-label="Pick what you're cooking for"`.
- Wheel: focus order goes focal → wedge labels → pairing dots; each pairing dot has accessible name `"{neighbor name}, strength {strength*100}% in {bucket}"`.
- Story expansion announces via `aria-live="polite"`.
- Sentence starter `"I'm thinking about pairing that…"` rendered as visible label + `<label for="bubble-grid">`.

### Performance
- `RadialAffinityWheel` renders ≤16ms for ≤50 neighbors (one frame).
- Guided Discovery Screen 1 cold-load ≤300ms.
- Curated mode story generation cached per pairing; recomputed only on focal/filter change.

---

## Non-Goals

- **NOT building flavorpair.me integration.** Deferred to Appendix A.
- **NOT expanding cuisine coverage in this build.** Deferred to Appendix A.
- **NOT training the perceptron weights** in `07-blend-v2.js`. Audit produces a baseline; training is a follow-up.
- **NOT extracting full text from FB / Matrix books.** Ground truth uses public references only.
- **NOT building editorial daily-mix / trail templating.** Explicitly demoted in Round 3.
- **NOT building a risk/difficulty dial / wild-ideas surfacer.** Explicitly demoted in Round 3.
- **NOT replacing IngredientPanel's ranked list.** The wheel is an ADDITIONAL view via toggle.
- **NOT animating the Guided Discovery → wheel transition** at first ship. Cross-fade is acceptable but not required.
- **NOT adding OR/NOT logical operators** between bubbles. Multi-select is AND-intersection (same semantics as `FilterPillRow`).
- **NOT changing the existing `LandingScreen` layout/visual style** beyond adding the 5th card and renaming the Network card.

---

## Acceptance Criteria

### Audit harness (Part A)
- [ ] `chemDataset/validation/` directory exists with `score_pairings.js`, `ground_truth.json`, `reports/`, `README.md`.
- [ ] `ground_truth.json` seeded with ≥30 pairings (≥10 each from FB, Matrix, chef-cite/our curated).
- [ ] `npm run validate` (or equivalent CLI) runs the harness end-to-end in <30s.
- [ ] Report contains: per-axis `precision@10`, `recall@10`, `beyondBook@10`, cross-source agreement, top-10 illustrative pairings per axis, and a one-paragraph verdict ("the formula directionally agrees with the books on axis X but misses on axis Y").
- [ ] README documents how to add new ground-truth entries (schema, sources allowed, contribution guidance).
- [ ] Verdict explicitly states whether the **untrained perceptron in `07-blend-v2.js`** appears competitive with the simpler RecipeNLG-NPMI blend or not.
- [ ] First run is committed alongside the harness.

### Guided Discovery (Part B)
- [ ] `LandingScreen.jsx` shows 5 cards: `"Explore the NeuFlavor Network"`, `"Guided Discovery"` (NEW), `Cocktail Lab`, `Sauce Lab`, `Recipe Lab`.
- [ ] The Network card's onClick still routes to `activeTab='network'`; only the label changed.
- [ ] Tapping `"Guided Discovery"` routes to a new `activeTab='guided'` (or equivalent route) and renders `GuidedDiscoveryStart`.
- [ ] `GuidedDiscoveryStart` shows the sentence starter `"I'm thinking about pairing that…"` above a grid of 6–10 thought-bubble cards.
- [ ] The `"Starts with a specific ingredient"` card opens inline ingredient search; selecting an ingredient adds it as a stack chip and KEEPS user on the bubble grid (per Round 4 revision).
- [ ] Other cards open their sub-pickers in place (season → spring/summer/fall/winter; cuisine → reuses `FilterPillRow` data; etc.).
- [ ] Stack chips visible at top; tapping a chip removes it from the stack.
- [ ] `"Show me pairings"` CTA only enabled when `bubbleStack.length > 0`.
- [ ] CTA routes to `GuidedDiscoveryResults`, which renders `RadialAffinityWheel mode='curated'` with 5–10 highlighted pairings filtered by the stack.
- [ ] Each highlighted pairing is tap/hover-expandable to reveal a `"Why this works"` story sourced from `whyThisWorks()`.
- [ ] If a pairing exists in `ground_truth.json`, its story shows a citation chip ("Flavor Bible p.123").
- [ ] `"Edit"` link on the stack chips returns user to Screen 1 with bubbleStack preserved.
- [ ] `"Explore in the network"` CTA jumps to `LivingArchView` with the same filter stack pre-applied.

### Shared radial wheel (Thread #4)
- [ ] `RadialAffinityWheel.jsx` is a single component used by both `GuidedDiscoveryResults` and `IngredientPanel`.
- [ ] `mode='curated'` highlights 5–10 hero pairings with story labels.
- [ ] `mode='full'` plots all neighbors as dots with no story labels.
- [ ] Wedges = bucket dimensions determined by `filterStack` (defaults to aroma when no filter active).
- [ ] Bucket colors come from `categoricalAxes.js`.
- [ ] `IngredientPanel.jsx` gains a `"View as wheel"` toggle on the pairings section that swaps the ranked-list view for `RadialAffinityWheel mode='full'`.
- [ ] Toggle state persisted to localStorage (`'ingredient-panel-view'` key) so user's preference sticks.
- [ ] Wheel is responsive; below 480px viewport falls back to a list-with-bucket-headers.

### Cross-platform & a11y
- [ ] Touch + click both toggle bubble cards on a single tap.
- [ ] Bubble activation announces via `aria-live` ("Added: cocktail. 3 selections.").
- [ ] Wheel pairings keyboard-navigable (arrow keys move between neighbors; Enter opens story).
- [ ] No memory leaks: opening/closing Guided Discovery 50 times does not grow retained heap (mirror `AffinityMode.perf.test.js` pattern).

### Performance
- [ ] Guided Discovery Screen 1 cold-render ≤300ms.
- [ ] Wheel render ≤16ms for ≤50 neighbors.
- [ ] Audit harness end-to-end run ≤30s on the current dataset.

---

## Implementation Plan (handoff to executor)

### Phasing
| Phase | Scope | Effort |
|---|---|---|
| **Phase 1** | Rolling audit harness + seed ground_truth + first report | 1 day |
| **Phase 2** | `RadialAffinityWheel` shared component (`full` mode first, `curated` second) + IngredientPanel toggle | 1.5 days |
| **Phase 3** | Guided Discovery: Screen 1 (bubbles, search-as-card, stack chips, CTA) | 1 day |
| **Phase 4** | Guided Discovery: Screen 2 (wheel in curated mode, story renderer, citation chips, jump-to-network CTA) | 1 day |
| **Phase 5** | Landing rename + 5th card + walkthrough copy update + a11y polish + manual QA across mobile + desktop | 0.5 day |

**Total: ~5 days.**

### Files to modify
| File | Change |
|---|---|
| `src/components/LandingScreen.jsx` | Rename "Network" card; add 5th "Guided Discovery" card |
| `src/components/IngredientPanel.jsx` | Add "View as wheel" toggle; mount `RadialAffinityWheel` in full mode when toggled |
| `src/App.jsx` | Add `'guided'` activeTab branch; route to `GuidedDiscoveryStart` |
| `src/components/Walkthrough.jsx` | Update step copy to reflect renamed Network card + new Guided Discovery step |
| `src/data/networkModes.js` | (No change — filter pills already exist as Phase-1-shipped) |

### New files
| File | Purpose |
|---|---|
| `src/components/RadialAffinityWheel.jsx` | Shared wheel component (curated + full modes) |
| `src/components/GuidedDiscoveryStart.jsx` | Screen 1: sentence starter + bubble grid + stack + CTA |
| `src/components/GuidedDiscoveryResults.jsx` | Screen 2: wheel + story panel + jump-to-network |
| `src/components/ThoughtBubbleCard.jsx` | Reusable bubble card with sub-picker slot |
| `src/data/guidedDiscovery.js` | THOUGHT_BUBBLES constant + bubble-to-filter mapping |
| `src/data/whyThisWorks.js` | Story generator (compound bridge + axes matched + citation) |
| `src/data/__tests__/whyThisWorks.test.js` | Vitest coverage on story generator edge cases |
| `chemDataset/validation/score_pairings.js` | Audit harness CLI |
| `chemDataset/validation/ground_truth.json` | Seed: ≥30 pairings |
| `chemDataset/validation/README.md` | Contribution guide |
| `chemDataset/validation/reports/run-{date}.md` | First run output |

### Where the audit lives in npm scripts
```jsonc
// package.json scripts addition
{
  "validate:pairings": "node chemDataset/validation/score_pairings.js"
}
```

---

## Risks / Notes for Executor

1. **The perceptron is UNTRAINED.** The audit's first run will likely show that the `07-blend-v2.js` 8-feature weighted model performs no better than the simple `05-blend.js` weighted average. That's fine — surface it, don't hide it. A follow-up task can train the weights against `ground_truth.json` once the seed grows.
2. **FlavorDB chemistry feature is zero.** `flavordb-overlap.json` is empty (API down per CLAUDE.md). The x3 chemical feature falls back to 0.5 everywhere. Note this in the audit report; do NOT pretend chemistry is contributing.
3. **The "Surprising" tier already ships** in `affinityTiers.js:181` (`surprisingAffinities()`). When building the wheel's curated mode, **reuse that function** — don't reimplement novelty detection. The wheel can highlight surprising-tier pairings with a distinct color (fuchsia, matching the existing AffinityPanel column).
4. **Bubble-to-filter mapping is the same surface as `FilterPillRow`.** The cuisine bubble → cuisine filter stack; season bubble → season filter stack; cocktail/sauce bubbles → scope pills; aroma bubble → aroma filter. Reuse the `FILTER_KEYS` machinery in `networkModes.js` — do NOT introduce a parallel filter system.
5. **The ingredient-search-as-card UX matters.** Per Round 4 revision: picking the ingredient card does NOT navigate away. User stays on Screen 1, sees the ingredient chip added to the stack, and can keep selecting other bubbles. This is the differentiated UX vs. just "Network search."
6. **`bridge_compounds.json` already maps shared aroma compounds** between curated pairings. The `whyThisWorks` story generator's primary data source is this file. For pairings not in `bridge_compounds.json`, fall back to GNN entropy overlap top-3 shared aroma classes from `gnn_entropy.json`.
7. **Ground-truth seed must avoid copyright issues.** Use FB pairings that have appeared in published reviews / chef interviews / publicly-quoted excerpts, not full table extractions. Cite source URL in each entry.
8. **The wheel's "curated" mode highlight count is 5–10, not a hard 8.** The story generator may filter pairings that have no meaningful chem bridge or citation; degrade gracefully to fewer hero pairings if the input is sparse.
9. **Walkthrough.jsx** has 7 steps; the Network step's copy mentions the old name. Update copy AND add a step for Guided Discovery.
10. **Beware mobile keyboard on Screen 1.** If user taps the ingredient-search card and the keyboard pops up, the bubble grid below should remain scrollable. Test on iOS.

---

## Ontology (Final Entities)

| Entity | Type | Fields | Relationships |
|---|---|---|---|
| Surprise | composite concept | `axes[4]` | drives validation + curation |
| PairingFormula | system | `npmi`, `logCount`, `chem (broken)`, `perceptron8d (untrained)` | input to audit |
| SurprisingAffinitiesTier | existing UI | `tier=0`, `color=fuchsia` | reused by wheel curated mode |
| FlavorBible | ground-truth source | `pairings[]`, `pageRefs[]` | populates ground_truth.json |
| FlavorMatrix | ground-truth source + wheel inspiration | `wheelData[]`, `axes[]` | populates ground_truth.json; layout ref |
| FlavorpairMe | comparator (deferred) | `methodology?` | Appendix A |
| CuisineMap | data structure | `ingredient → cuisines[]` | manually curated; Appendix A expansion |
| UnderrepresentedCuisines | gap (deferred) | `African`, `Caribbean`, etc. | Appendix A |
| RadialAffinityWheel | NEW UI component | `mode`, `focal`, `filterStack`, `pairings`, `storyFn` | shared between Guided Discovery + IngredientPanel |
| CuratedMode | wheel config | `heroCount=5..10` | one of two wheel modes |
| FullCloudMode | wheel config | `showAllNeighbors=true` | one of two wheel modes |
| GuidedDiscoveryFlow | NEW feature | `screen1`, `screen2`, `bubbleStack` | new activeTab |
| ThoughtBubbleSequence | UX pattern | `bubbles[8]`, `multiSelect=true` | single flow |
| SearchAsBubbleCard | UX primitive | `key='ingredient'` | one of the bubbles |
| ThoughtBubbleCard | UI component | `label`, `subUI`, `selected` | rendered N times in grid |
| LandingScreen | existing surface | `cards[5]` | adds Guided Discovery card |
| RollingAuditHarness | NEW system | `groundTruth`, `scorePairings`, `report`, `seed≥30` | persistent, grows over time |
| GroundTruthJSON | data structure | `pairings[]`, `versioned` | append-only seed |
| AuditMetrics | metric set | `precision@K`, `recall@K`, `beyondBook@K`, `crossSource` | computed per surprise axis |
| WhyThisWorksStory | UI element | `headline`, `compoundBridge`, `citations`, `axesMatched` | per pairing in curated mode |
| SearchSatisfaction | outcome | (emotional) | primary goal |
| EducationalOutcome | outcome | (emotional) | secondary goal |

## Ontology Convergence
| Round | Entity Count | New | Changed | Stable | Stability |
|---|---|---|---|---|---|
| 1 | 12 | 12 | — | — | N/A |
| 2 | 12 | 0 | 0 (3 status-flipped to parked) | 12 | 100% |
| 3 | 16 | 4 (SearchSat, Educational, WhyThisWorks, ChemBridge) | 0 | 12 | 75% |
| 4 | 18 | 2 (TwoEntryPoint, 2DPairingDisplay) | 0 | 16 | 89% |
| 5 | 20 | 2 (CuratedMode, FullCloudMode) | 1 (RadialAffinityWheel unparked) | 17 | 85% |
| 6 | 22 | 3 (ThoughtBubbleSequence, SearchAsBubbleCard, RollingAuditHarness) | 1 (TwoEntryPoint removed) | 18 | 82% |

Convergence trend: healthy oscillation between consolidation (rounds 2, 4) and refinement (rounds 3, 5, 6). The 12 entities introduced in round 1 all survived to the final spec (Surprise, PairingFormula, FB, Matrix, etc.) — strong evidence the core ontology was identified early. Late rounds added UX-specific entities without disturbing the foundation.

---

## Assumptions Exposed & Resolved
| Assumption | Round | Resolution |
|---|---|---|
| "Surprise" is a single dimension | 1 | False — composite of 4 axes (chem-bridged-rare, absent-from-books, cross-cuisine, cross-aroma) |
| The user wants me to BUILD all 5 threads | 2 | False — 2 artifacts (audit + Guided Discovery), 3 threads deferred |
| Guided Discovery is provocation/inspiration (wild ideas) | 3 | False — search-satisfaction + educational |
| Guided Discovery has two equal entry points (search + bubbles) | 4 → revised | False — single bubble flow; search is one of the bubbles |
| The 2D pairing display is a separate UI from the radial wheel | 5 | False — same component, two modes (curated + full) |
| The audit must be comprehensive on day one | 6 | False — rolling harness, seed-then-grow |
| `affinityTiers.surprisingAffinities()` is undefined / needs building | (audit) | False — already shipped; reuse |
| The perceptron in `07-blend-v2.js` has trained weights | (audit) | False — explicitly untrained; audit reports baseline only |

---

## Technical Context (brownfield findings)

### What's already shipped that we're reusing
- `src/components/LandingScreen.jsx:136-165` — 4-card landing; we add a 5th + rename Network.
- `src/components/IngredientPanel.jsx:875-897` — Top Pairings ranked list with strength bars; we add a toggle to swap for the wheel.
- `src/components/FilterPillRow.jsx` — already shipped Phase 1 of r16-1 spec; bubble cards reuse its filter data.
- `src/data/networkModes.js:31-39` — `FILTER_KEYS` constant; bubble-to-filter mapping uses it.
- `src/data/affinityTiers.js:181` — `surprisingAffinities()` powers the wheel's curated highlights.
- `src/data/categoricalAxes.js` — bucket-color machinery for wheel wedges.
- `public/proDataset/bridge_compounds.json` — primary data source for `whyThisWorks()` story generator.
- `public/proDataset/gnn_entropy.json` — fallback aroma overlap data when bridge_compounds is sparse.
- `src/components/Walkthrough.jsx` — existing 7-step tour; add a Guided Discovery step and update Network step copy.

### What the design doc promises that isn't shipped
- 8-feature perceptron in `proDataset/scripts/07-blend-v2.js` exists but is **UNTRAINED** (`training_status: "untrained — using proposed initial weights"`).
- FlavorDB chemical overlap is 0 (API down). x3 chemical feature falls back to constant 0.5.
- No validation harness, no eval comparison, no reference to FB/Matrix/Ahn-et-al in code.
- `novelty = 1 - tradition` is a derived inverse, not an independent score.

### Audit will surface these gaps in its first report.

---

## Appendix A — Deferred Threads (Follow-Up Backlog)

### A.1 — flavorpair.me competitive scope (Thread #2)
**Goal**: Characterize flavorpair.me's methodology, surface comparison axes, identify what they do better/worse vs our formula + UI.

**Approach** (when picked up):
- Manual exploration of flavorpair.me UI; document their pairing surface, formula hints (if any), data sources cited.
- Side-by-side compare 20 ingredient lookups (e.g., salmon, cilantro, miso, dill, anise) — note where our top-K and theirs agree/disagree.
- Identify novel UX patterns worth borrowing (visualization, story telling, scope filters).
- Identify methodological weaknesses we can beat (data sources, novelty handling, cuisine coverage).

**Effort**: ~1 day research + 0.5 day writeup.

### A.2 — Underrepresented cuisines (Thread #3)
**Current state**: African = 220 ingredients (5.6%). Nigerian + Senegalese absent. Cuisines come from hand-authored `public/data/cuisine_map.json`.

**Approach** (when picked up):
- Extend `proDataset/scripts/03-fetch-mealdb.js` with region filters (`?a=Nigerian`, `?a=Senegalese`, `?a=Ethiopian` — though TheMealDB's coverage of these is patchy).
- Source a dedicated African ingredient lexicon — candidates: Afroculinary, African Food Studio, Yoruba/Igbo/Amharic ingredient corpora.
- Hand-curate `cuisine_map.json` additions for ~200 new African ingredients across Nigerian, Senegalese, Ghanaian, Ethiopian, Moroccan, South African.
- Consider engaging a culinary advisor / chef collaborator for accuracy.
- Re-blend; audit harness re-runs to validate the new pairings on the cross-cuisine surprise axis.

**Effort**: ~3 days (data work) + ongoing curation.

---

## Interview Transcript

<details>
<summary>6 rounds of Q&A</summary>

### Round 1 — Targeting: Success Criteria
**Q**: When you say the formula should produce 'new, surprising and exciting' pairings, what operationally counts as 'surprising'?
**A**: All four (chem-bridged corpus-rare + absent-from-books + cross-cuisine + cross-aroma).
**Resolution**: Surprise is a composite of 4 axes, not a single dimension.

### Round 2 — Targeting: Goal Clarity
**Q**: When this interview ends, what artifact do you want me to have produced?
**A**: Bundle (audit + Guided Discovery spec together).
**Resolution**: 2 artifacts; threads 2/3/4 deferred (though #4 unparks in Round 5).

### Round 3 — Targeting: Success Criteria
**Q**: When a user finishes a Guided Discovery session, what's the emotional outcome you're optimizing for?
**A**: 2 (search satisfaction) and 3 (educational).
**Resolution**: Two emotional outcomes co-equal; provocation and editorial-mentorship explicitly demoted.

### Round 4 — Contrarian Mode — Targeting: Goal Clarity
**Q**: Outcome says 'search satisfaction'; flow says 'guided decision tree.' Which signal is load-bearing?
**A (initial)**: Two equal entry points side-by-side.
**A (revised)**: "i think it can be both, but it's more of an additional card that can be selected for users that know the ingredient they want to start with but still need to brainstorm with the other thought card bubbles."
**Resolution**: Single bubble flow; ingredient-search is one of the bubble cards; picking it keeps user on the bubble grid.

### Round 5 — Targeting: unifying threads
**Q**: Is the Guided Discovery 2D display the same as the Briscione-style radial wheel from thread #4?
**A**: SAME geometry, different framing.
**Resolution**: One shared `RadialAffinityWheel` component with `curated` and `full` modes. Thread #4 unparks.

### Round 6 — Simplifier Mode — Targeting: Constraints
**Q**: How rigorous should the validation audit be?
**A**: Rolling audit — ship the harness, grow over time.
**Resolution**: Persistent harness with a small seed and a markdown report. No perceptron training in this build.

</details>

---

## Pipeline next step

Per the deep-interview skill chain, this spec is ready for:

- **`/oh-my-claudecode:omc-plan --consensus --direct`** — Planner/Architect/Critic refinement before execution. **Recommended** for a 5-day, two-artifact spec. Worth the time for the Audit harness data-flow choices and the shared-wheel component contract.
- **`/oh-my-claudecode:autopilot`** — direct execution if you'd rather move now.
- **`/oh-my-claudecode:ralph`** — persistence loop with verifier — keeps working until acceptance criteria pass.
