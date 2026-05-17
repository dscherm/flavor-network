# Deep Interview Spec: Flavor Space Primary + Notebook Polish

## Metadata
- Interview ID: `flavor-space-primary-and-notebook-polish-2026-05-17`
- Rounds: 7
- Final Ambiguity Score: **13.4%** (under 20% threshold)
- Type: **brownfield**
- Generated: 2026-05-17
- Threshold: 0.20
- Initial Context Summarized: yes (5-track brain-dump compressed; 3 tracks explicitly deferred via Simplifier round)
- Status: **PASSED**

## Clarity Breakdown
| Dimension | Score | Weight | Weighted |
|-----------|-------|--------|----------|
| Goal Clarity | 0.95 | 0.35 | 0.333 |
| Constraint Clarity | 0.90 | 0.25 | 0.225 |
| Success Criteria | 0.75 | 0.25 | 0.188 |
| Context Clarity (brownfield) | 0.80 | 0.15 | 0.120 |
| **Total Clarity** | | | **0.866** |
| **Ambiguity** | | | **0.134 (13.4%)** |

---

## Goal

Ship two coordinated changes that promote Flavor Space (the GNN taste+aroma UMAP layout, currently `flavor3D` beta mode) from a beta toggle to the **primary 3D and 2D network model**, and polish the Recipe Notebook so chefs can pivot from a recipe to a curated Cocktail or Sauce Lab without losing flavor context:

1. **Track 1 — Flavor Space Primary + Flywheel Rebind:** Make Flavor Space the default 3D/2D network mode (replacing the recipe-coocc layout as the default landing). Rebind the **camera fly-through animation** ("flywheel" in user vocabulary — the `CameraAnimator` tour) to the new Flavor Space cluster centroids. Surface new flavor-cluster labels (already shipped in `flavor_cluster_labels.json`) in the cluster chip sidebar AND the 3D label sprites. Assign colors to any clusters still missing a color (Briscione palette as the source).

2. **Track 2 — Notebook Center + Lab Handoff Pills:** Center the wedge profile wheel in the Notebook tab (currently left-aligned). Add two pill buttons under the Suggestions section: **"Find a Cocktail to serve with this recipe"** and **"Need a sauce for this recipe?"**. Clicking either pill computes a **recipe-aroma vector** (mean of constituent GNN aroma probabilities) and routes the user to the Cocktail Lab or Sauce Lab in **"Matches"** mode — showing **only** the top 5-8 cocktails/sauces ranked by cosine similarity to the recipe-aroma vector, each card displaying its similarity score and which aromas matched.

---

## Defined Variables

### Track 1 — Network Mode Promotion

```
// src/data/networkModes.js
MODE_CYCLE = ['flavor3D', '3D', '2D']   // flavor3D becomes index 0 (default)
DEFAULT_MODE = 'flavor3D'                // was '3D'
MODE_LABELS.flavor3D = 'Flavor Network'  // drop "(beta)" suffix
MODE_LABELS['3D']    = 'Recipe Network (legacy)'  // demote former default
```

### Track 1 — Flywheel (CameraAnimator) rebind

```
// CameraAnimator v2 is a continuous-orbit around `controls.target`. v1's
// glide-and-dwell was explicitly replaced because it "just shifts the camera
// a little bit rather than rotating around the model" (CameraAnimator.js:13-21).
// To surface the 12 flavor-space cluster centroids without resurrecting v1,
// parameterize v2 with a single `pivotAdvanceMs` knob:
//   pivotAdvanceMs === null   → current v2 behavior (legacy 3D / 2D) — byte-identical
//   pivotAdvanceMs === 3500   → flavor3D variant: every 3500ms the orbit pivot
//                                advances to the next cluster centroid; the
//                                continuous-orbit math is otherwise unchanged
// Re-use existing easeInOutCubic in livingArchUtils.js for the pivot transition.
//
// CRITICAL FIELD NAME: the shipped JSON uses `centroid_3d` (NOT `centroid`).
// Verified in useProData.js:270-272, App.jsx:642 / 1942 / 1949, and
// LivingArchView.jsx:715 / 741 / 1370. A bare `centroid` access reads
// undefined and aims the camera at origin.

function advancePivot(state, mode, labels):
    if mode !== 'mlflavor': return state             // pivotAdvanceMs is null
    if (now - state.lastAdvanceMs) < 3500: return state
    const next = labels[(state.idx + 1) % labels.length]
    return {
        ...state,
        pivot: next.centroid_3d,                     // already SPREAD-scaled in useProData
        idx: state.idx + 1,
        lastAdvanceMs: now,
    }
```

### Track 1 — Cluster color assignment (revised — hand-pick)

```
// public/proDataset/flavor_cluster_labels.json — 12 clusters. Auto-blend was
// rejected during consensus review (ADR-1) because 6 aroma × 8 taste anchors
// with 0.6/0.4 blend was assessed likely to produce ≥3 muddy/indistinct hex
// values out of 12. Decision: hand-pick 12 hex codes from
// (BRISCIONE_AROMA ∪ BRISCIONE_TASTE), enforcing pairwise CIE-Lab ΔE > 15.
//
// The 12 colors are written directly into flavor_cluster_labels.json by the
// executor (P2 of the plan) after the P0 dedupe phase has resolved the
// duplicate "Sour Fruit" label for clusters 3 and 10. The chosen palette
// is enumerated in the plan; an optional future `color` override field is
// noted as a follow-up, not a deliverable this round.
```

### Track 2 — Recipe-aroma vector

```
// Called when user clicks cocktail/sauce pill in Notebook.
function computeRecipeAroma(recipeIngredients, ingredients):
    const vectors = recipeIngredients
        .map(name => ingredients[name]?.gnnProbs)
        .filter(v => v && hasAromaKeys(v))      // skip ingredients without GNN
    if vectors.length === 0: return null         // fallback path
    return meanVector(vectors, ['odor_fruity', 'odor_floral', 'odor_green',
                                 'odor_woody', 'odor_spicy', 'odor_fatty'])
```

### Track 2 — Cocktail/Sauce match ranking

```
function rankByAromaSimilarity(recipeVector, items, ingredients):
    return items
        .map(item => {
            const itemVec = meanVector(
                item.ingredients.map(n => ingredients[n]?.gnnProbs).filter(Boolean),
                AROMA_KEYS
            )
            if !itemVec: return null
            return {
                item,
                similarity: cosineSim(recipeVector, itemVec),
                matchedAromas: topAromaOverlap(recipeVector, itemVec, 2)  // top-2 shared axes
            }
        })
        .filter(Boolean)
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, 8)   // top-8 (display 5-8 depending on viewport)
```

### Track 2 — Lab "Matches" mode

```
// CocktailLabV2.jsx and SauceLab.jsx accept new prop:
// `matchesContext: {
//     recipeName: string,
//     items: AromaMatchResult[],
//  } | null`
//
// AromaMatchResult schema (output of rankByAromaSimilarity above):
//   {
//     item: <full row from cocktail_augment.json or sauce_augment.json — pass
//            through whatever keys those rows currently expose: name,
//            ingredients[], image, instructions, etc. Cards render via the
//            same component used in browse mode, so any field the existing
//            card already reads continues to work.>,
//     similarity: number ∈ [0,1],     // cosine over non-negative aroma probs
//     matchedAromas: string[]          // top-2 shared aroma keys
//                                      // (subset of AROMA_KEYS)
//   }
//
// When matchesContext is non-null:
//   - render ONLY items in matchesContext.items (no full browse)
//   - show "Matches for {recipeName}" header chip
//   - each card shows similarity badge with text `${Math.round(similarity * 100)}% match`
//     (e.g., 0.823 → "82% match") plus matched-aroma chips
//   - "Show all" button exits matches mode (clears matchesContext via parent)
//
// When matchesContext is null: existing browse-all behavior unchanged.
```

---

## Constraints

### Visual
- Cluster sidebar chips render Flavor Space cluster labels; the previous recipe-coocc cluster labels move to legacy-mode-only display
- 3D label sprites in `flavorClusterLabelGroup` already use centroid positions — no scene-graph changes needed
- Notebook wedge wheel centered via flex/grid container; preserve existing aspect ratio and ring layout
- Pill buttons in Notebook use existing pill style from `FilterPillRow` (consistency)
- Lab "Matches" header chip uses the project's existing chip pattern; not a new component family

### Brownfield reuse
- `CameraAnimator` (src/three/CameraAnimator.js) — extend; do not replace
- `flavor_cluster_labels.json` already shipped — read existing centroids
- `BRISCIONE_AROMA`, `BRISCIONE_TASTE` from `briscionePalette.js` — source palette for missing-color clusters
- `CocktailLabV2.jsx`, `SauceLab.jsx` — add optional `matchesContext` prop; default behavior unchanged when prop is absent
- `cocktail_augment.json` / `sauce_augment.json` — read existing `ingredients` arrays per item (no schema changes)
- GNN aroma keys: `odor_fruity`, `odor_floral`, `odor_green`, `odor_woody`, `odor_spicy`, `odor_fatty` (the 6 axes calibrated above F1=0.50)

### Performance
- Recipe-aroma computation must complete in <50ms for recipes up to 20 ingredients (mean over ≤20 GNN vectors is trivial)
- Cosine-similarity ranking over ≤500 cocktails / ≤69 sauces must complete in <100ms (well within budget)
- Cluster fly-through dwell time 3500ms per stop; total tour ~42s for 12 clusters

### A11y
- Pill buttons have accessible labels: "Find a cocktail to pair with {recipeName}", "Find a sauce to pair with {recipeName}"
- Lab "Matches" mode announces via `aria-live="polite"`: "Showing {N} cocktails matched to {recipeName}"
- "Show all" exit button has accessible name "Exit matches and browse all {cocktails|sauces}"
- Cluster fly-through is decorative; provide a pause/play toggle (existing controls; ensure they still work after rebind)

### iOS / Capacitor
- No new native plugins; all changes ship via web → ios:sync
- Match-mode handoff is intra-app routing (React state), not deep-link — no Universal Links work needed

---

## Non-Goals (explicitly deferred to next delivery)

- **Guided overhaul** (Track 3 in original request): bigger card icons, 5 curated-SVG icon swaps (flags, protein, fall/spring, spicy, halal), filter-choice card after ingredient pick, filter-adaptive ProfileRadar, "Show me where this data comes from" provenance tour, no-auto-advance, can't-check-empty fix. **Deferred — separate spec.**
- **Build overhaul** (Track 4 in original request): "Meal"→"Dish" rename + icons, dietary-before-protein reordering, hide-protein-for-vegan/vegetarian, dessert tag filtering + curation pass, filter-adaptive radar w/ pills, dietary-aware pairing filtering, sauce/cocktail handoff cards (more filters than Notebook variant), only-Open-in-Notebook on Results. **Deferred — separate spec.**
- **App icon + landing image swap** (Track 5 in original request): replace iOS app icon + landing hero with `fn-logo-chalk_00004_.png` keeping electron animation. **Deferred — separate spec.**
- **Generative icon pipeline** (drawing-agent / ComfyUI integration): out of scope; not even an exploration spike this delivery.
- **NOT removing the old recipe-coocc 3D layout** — demoted to "Recipe Network (legacy)" so users with bookmarks/screenshots can still reach it.
- **NOT changing the GNN model, retraining, or new umami data** — uses shipped artifacts.

---

## Acceptance Criteria

### Track 1 — Flavor Space Primary + Flywheel Rebind
- [ ] Loading `https://neuralflavor.web.app` lands the user in `flavor3D` mode by default (not `3D` recipe-coocc)
- [ ] Network tab dropdown shows three modes: `Flavor Network` (default), `Recipe Network (legacy)`, `2D Pairings`
- [ ] Camera fly-through tours the 12 Flavor Space cluster centroids in label-sort order, dwelling ~3.5s per stop
- [ ] Every cluster in `flavor_cluster_labels.json` has a non-empty `color` field after this delivery (auto-assigned from Briscione palette where missing)
- [ ] Cluster chip sidebar renders the Flavor Space cluster labels (the new "Sweet Fruit", "Sour Dairy", etc.) when in `flavor3D` mode
- [ ] 3D label sprites carry their assigned cluster color (currently uniform; sprite material gets per-cluster tint)
- [ ] Switching to "Recipe Network (legacy)" still works and the old recipe-coocc layout still renders (no regression)

### Track 2 — Notebook Center + Lab Handoff Pills
- [ ] Wedge profile wheel is horizontally centered in the Notebook tab viewport (verified at desktop ≥1024px and tablet 768-1023px)
- [ ] Below the Suggestions section, two pill buttons render: "Find a Cocktail to serve with this recipe" and "Need a sauce for this recipe?"
- [ ] Clicking the cocktail pill computes a recipe-aroma vector, routes to Cocktail Lab in matches mode, and the Lab shows ONLY the top 5-8 cocktails sorted by cosine similarity (highest first)
- [ ] Each cocktail card in matches mode shows a similarity percentage and at least one matched aroma chip. Formula: badge text is `${Math.round(similarity * 100)}% match` (e.g., similarity=0.823 → "82% match"). Cosine over non-negative aroma-prob vectors is always in [0,1] so no rescaling is required.
- [ ] A "Matches for {recipeName}" header chip is visible at the top of the Lab in matches mode
- [ ] A "Show all cocktails" button exits matches mode and returns the Lab to its normal browse-all view
- [ ] Same flow + acceptance applies for Sauce Lab via the sauce pill
- [ ] If the recipe has zero ingredients with GNN data (edge case), pills become disabled with tooltip "Need at least one ingredient with flavor data"

### Cross-cutting
- [ ] All existing tests still pass (no regressions in `npx vitest run`)
- [ ] Build succeeds (`npm run build`)
- [ ] No console errors when loading default mode, switching modes, or invoking either handoff pill
- [ ] iOS sync works (`npm run ios:sync`) without new native dependency requirements

---

## Implementation Plan

### Phasing
| Phase | Scope | Effort |
|---|---|---|
| **P1** | networkModes.js: reorder MODE_CYCLE, change DEFAULT_MODE, rename labels | 0.25d |
| **P2** | Cluster-color assignment: backfill `color` field in `flavor_cluster_labels.json` (offline script or runtime fallback) | 0.5d |
| **P3** | CameraAnimator rebind: extend fly-through to read `data.flavorClusterLabels` when mode is `mlflavor` | 0.5d |
| **P4** | Cluster sidebar chips + 3D label sprite tints driven by per-cluster colors | 0.5d |
| **P5** | Notebook wedge centering (CSS/layout) | 0.25d |
| **P6** | Recipe-aroma vector + cosine ranker (pure module + tests) | 0.5d |
| **P7** | Lab `matchesContext` prop in CocktailLab + SauceLab; matches-mode chip header + per-card similarity badge | 0.75d |
| **P8** | Notebook pill buttons + handoff routing + a11y polish | 0.5d |

**Total: ~3.75 days.**

### Files to create
| File | Purpose |
|---|---|
| `src/data/recipeAromaSimilarity.js` | Pure module: recipe→aroma vector + ranker |
| `src/data/__tests__/recipeAromaSimilarity.test.js` | Unit tests for the algorithm |

### Files to modify
| File | Change |
|---|---|
| `src/data/networkModes.js` | Reorder MODE_CYCLE; set DEFAULT_MODE='flavor3D'; rename labels |
| `src/three/CameraAnimator.js` | Add `pivotAdvanceMs` param to v2 (null = byte-identical legacy behavior; 3500 = pivot-advancing variant for flavor3D). NO mode-gated v1 branch. |
| `src/components/LivingArchView.jsx` | Tint flavor-cluster label sprites by their assigned color; pass colors to sidebar chips; pass `pivotAdvanceMs={mode === 'flavor3D' ? 3500 : null}` to CameraAnimator |
| `src/components/NotebookCanvas.jsx` (or parent of wedge wheel in Notebook tab) | Center wedge wheel; add Suggestions-section pill buttons |
| `src/components/CocktailLabV2.jsx` | Accept optional `matchesContext` prop; render matches-mode header + filtered card list when present |
| `src/components/SauceLab.jsx` | Same as CocktailLabV2 |
| `src/components/RecipesLab.jsx` | (touched only if NotebookCanvas lives inside it — verify file ownership before editing) |
| `src/App.jsx` | Wire pill click → compute recipe-aroma → setMatchesContext → navigate to Lab |
| `public/proDataset/flavor_cluster_labels.json` | (a) Resolve duplicate "Sour Fruit" label collision (clusters 3 + 10); (b) write 12 hand-picked hex colors into `color` field per cluster |

### Files to delete
None this delivery. Old recipe-coocc layout demoted to "legacy" mode but stays mounted.

---

## Risks / Notes for Executor

1. **Cluster fly-through dwell tuning** — 3.5s per stop may feel slow to power users and rushed to first-time users. Make the dwell duration a single tunable constant (`FLYTHROUGH_DWELL_MS = 3500`) so it can be adjusted without scattered edits. Test on the live deploy with both audiences.

2. **Cluster color backfill — palette source vs auto-blend** — the Briscione palette has 6 aroma + 8 taste anchors; 12 clusters need 12 distinct colors. Auto-blending centroid-nearest-aroma with cluster-dominant-taste at 0.6/0.4 weight is the proposed algorithm, but may produce muddy colors. Verify visually before committing the JSON; consider hand-picking the 12 colors if blend results look indistinct.

3. **`matchesContext` lifecycle** — when user clicks "Show all" or navigates away from the Lab, `matchesContext` must clear. If a user leaves Cocktail Lab in matches mode, comes back via tab nav, do they re-enter matches or browse-all? Recommend: clearing matchesContext on tab leave; user re-clicks the recipe pill to re-enter.

4. **Aroma-vector edge cases** — many ingredients (1,123 of 3,913) lack GNN predictions. A recipe with only no-GNN ingredients can't produce a recipe-aroma vector. The acceptance criterion handles this by disabling the pill. Verify the disable-state on a recipe like "salt + water + flour" where coverage is sparse.

5. **Performance — Cocktail Lab match scan** — ranking ~500 cocktails by aroma cosine similarity should be <100ms but verify on a mobile Capacitor build. If slow, memoize per-recipe (recipe ingredient set → top-8 result) in a Map; recipe content rarely changes.

6. **Legacy mode regression** — switching to "Recipe Network (legacy)" must still render correctly. The risk is that the cluster sidebar, fly-through, and chip pattern were designed around `flavor3D`-as-primary; verify legacy mode doesn't lose its own chip sidebar or break its camera tour.

7. **Notebook centering** — depending on the existing CSS, "centering" may require either a flex justify-content change OR a grid template-columns rework. Check whether the Suggestions section sits in the same row container as the wedge wheel before changing layout primitives.

8. **Visual QA priority** — given the must-ship pair is highly visual, schedule a 30-min visual review on the live deploy after PRs land. Both tracks share the Network surface (sidebar + 3D scene) so a single review session covers both.

---

## Ontology (Final Entities)

| Entity | Type | Fields | Relationships |
|---|---|---|---|
| FlavorSpaceMode | runtime mode | key='flavor3D', renderer='mlflavor', isDefault=true | replaces previous 3D as default |
| CameraFlyThrough (flywheel) | animation | mode-bound cluster centroid path, dwellMs=3500 | tours FlavorClusterLabel sequence |
| ClusterLabel | data | name, centroid, color, cluster_id | shown in sidebar + 3D sprite |
| ClusterColor | computed | hex string, source='briscione-blend' | assigned per ClusterLabel |
| WedgeWheelCenter | layout | aspect ratio preserved, centered in Notebook viewport | parent: NotebookTab |
| HandoffPill | UI button | label, target ('cocktail'|'sauce'), enabled (boolean) | dispatches LabHandoff |
| LabHandoff | routing event | recipeName, recipeAromaVector, target (Lab) | populates matchesContext |
| RecipeAromaVector | computed | 6-dim float [fruity, floral, green, woody, spicy, fatty] | mean of constituent GNN aroma probs |
| MatchesContext | prop/state | recipeName, items[], visible (boolean) | Lab mode toggle |
| AromaMatchResult | computed | item, similarity (0-1), matchedAromas[] | one per ranked cocktail/sauce |

## Ontology Convergence
| Round | Entity Count | New | Changed | Stable | Stability |
|---|---|---|---|---|---|
| 1 | 13 | 13 | 0 | 0 | N/A |
| 2 | 13 | 0 | 0 | 13 | 100% |
| 3 | 13 | 0 | 0 | 13 | 100% |
| 4 | 13 | 0 | 0 | 13 | 100% |
| 5 | 14 | 1 | 0 | 13 | 100% (RecipeAromaVector added) |
| 6 | 8 | 0 | 0 | 8 | 100% (pruned to must-ship: 6 entities deferred with tracks 3/4/5) |
| 7 | 10 | 2 | 0 | 8 | 100% (MatchesContext + AromaMatchResult derived from Lab handoff decision) |

Strong convergence; entity churn only came from explicit scope decisions (Simplifier-driven prune in R6, render-rule selection in R7) — not from definitional instability.

---

## Assumptions Exposed & Resolved
| Assumption | Round | Resolution |
|---|---|---|
| "Flywheel" maps to a code symbol | 1 | False — project vocabulary; resolved to CameraAnimator fly-through |
| ProfileRadar reuses one existing radar component | 2 | False — needs filter-adaptive axes (4/6/8/12 per filter type); deferred with track 3 |
| Dessert filtering can be derived from existing tags | 3 | False — needs new curated `tags: ['dessert']` field; deferred with track 4 |
| All icon redraws ship together via generative pipeline | 4 | False — 5 specific swaps via curated SVG; generative deferred entirely |
| Recipe→cocktail pairing has a clean existing algorithm | 5 | False — needs new recipe-aroma cosine similarity; in-scope |
| All 5 tracks ship together | 6 | False — Simplifier round cut to 2 must-ship; 3 deferred |
| Filtered Lab keeps full browse + adds highlights | 7 | False — top-N only mode with explicit "Show all" exit |

---

## Interview Transcript

<details>
<summary>7 rounds of Q&A</summary>

### Round 1 — Goal Clarity
**Q:** What does "flywheel" map to in the existing UI?
**A:** Camera fly-through animation (CameraAnimator) — re-bind to new Flavor Space cluster centroids.

### Round 2 — Goal Clarity
**Q:** What are ProfileRadar's axes per filter (taste/aroma/season/cuisine)?
**A:** Filter-shape-adaptive: 8 / 6 / 4 / top-12 axes per filter type. *(Deferred with track 3.)*

### Round 3 — Goal Clarity
**Q:** What defines a "dessert-related" ingredient for Build §3a?
**A:** Curated dessert tag (~150-300 ingredients hand-tagged). *(Deferred with track 4.)*

### Round 4 — Constraints — Contrarian Mode
**Q:** "Explore drawing-agent/ComfyUI" vs 5 specific icon redraws — which pattern ships?
**A:** Ship the 5 specific swaps now via hand-sourced SVGs; defer generative pipeline. *(Deferred with track 3.)*

### Round 5 — Goal Clarity
**Q:** How is "pairs well" computed between a recipe and cocktails/sauces?
**A:** Recipe-aroma vector (mean of constituent GNN aroma probs) → cosine similarity ranker.

### Round 6 — Success Criteria — Simplifier Mode
**Q:** Of 5 tracks, which 2 must ship this delivery?
**A:** Track 1 (Flavor Space primary + flywheel rebind) + Track 2 (Notebook polish + handoff pills). Other 3 deferred.

### Round 7 — Goal Clarity
**Q:** When user lands in a Lab via the handoff pill, what does the Lab render?
**A:** Top-N only, sorted by similarity — hide non-matching, show 5-8 ranked, with similarity score + matched-aroma chips per card.

</details>

---

## Pipeline next step

Per the deep-interview skill chain, this spec is ready for:

- **`/oh-my-claudecode:omc-plan --consensus --direct`** — Planner/Architect/Critic refinement. Recommended given the cluster fly-through and Lab `matchesContext` lifecycle have implementation-tradeoff questions (Risk #1, Risk #3).
- **`/oh-my-claudecode:autopilot`** — direct execution if you'd rather move now.
- **`/oh-my-claudecode:ralph`** — persistence loop with verifier until acceptance criteria pass.
