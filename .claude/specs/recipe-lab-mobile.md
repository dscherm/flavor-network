# Recipe Lab Mobile UX Redesign — Product Spec

**Date:** 2026-04-01
**Status:** Draft
**Loop:** recipe-mobile-ralph

---

## Problem Statement

The Recipe Lab's radial star layout is unusable on mobile phones. Nodes are too small to tap, pan/zoom is a desktop paradigm, and the canvas + bottom sheet compete for limited screen space. The current UX requires constant pinch-zooming to read labels, making recipe brainstorming frustrating rather than creative.

**Goal:** Redesign the mobile Recipe Lab into a guided, touch-friendly recipe builder that preserves the hand-drawn notebook aesthetic while replacing the radial graph with mobile-native interaction patterns.

Desktop behavior is unchanged. All changes are behind `isMobile` gating.

---

## Design Concept: Notebook Page + Taste Wheel + Suggestion Drawer

### Three-Zone Mobile Layout

```
+----------------------------------+
|         TASTE WHEEL              |
|    (pencil-shaded octagon)       |
|   shows recipe flavor balance    |
|          ~35% height             |
+----------------------------------+
|       RECIPE NOTEBOOK PAGE       |
|   center ingredient + added      |
|   ingredients as handwritten     |
|   list, ruled lines, Caveat font |
|          ~25% height             |
+----------------------------------+
|      SUGGESTION DRAWER           |
|  (pull-up bottom sheet)          |
|  taste-tabbed ingredient chips   |
|  + "Suggest" button              |
|       ~40% height (expanded)     |
|       ~15% height (collapsed)    |
+----------------------------------+
```

---

## Zone 1: Taste Wheel (Top — ~35%)

A simplified octagonal taste radar that replaces both the radial axis graph AND the AI analysis panel. It is the primary visual feedback mechanism.

### Visual Design
- **Shape:** Regular octagon, one vertex per taste axis (sweet, salty, sour, bitter, umami, spicy, pungent, astringent)
- **Aesthetic:** Hand-drawn pencil style matching the notebook theme. Wobbly lines, Caveat font labels.
- **Background:** Cream (#fefae0) matching notebook paper
- **Axis labels:** Taste names at each vertex in pencil-gray (#3a3428), small Caveat text

### Pencil-Shaded Fill (Core Innovation)
Each octant (pie slice from center to edge) is shaded with its taste's color, using a **colored-pencil scribble texture** effect:

| Taste | Color (from TASTE_COLORS) |
|-------|---------------------------|
| sweet | #fb92b4 (pink) |
| sour | #fde047 (yellow) |
| bitter | #a78bfa (purple) |
| salty | #93c5fd (blue) |
| umami | #f9a870 (orange) |
| spicy | #f87171 (red) |
| pungent | #b48c64 (brown) |
| astringent | #4ade80 (green) |

**Shading intensity rules:**
- **Empty recipe:** All octants are unshaded (just faint axis lines)
- **Per ingredient added:** Compute its taste profile using `scoreIngredient()` from `tastePositioning.js`
- **Aggregate:** Sum all ingredient taste scores per axis. Normalize so the max channel = 1.0.
- **Render:** Each octant's fill opacity/density scales from 0% (no coverage) to 100% (fully shaded)
- **Pencil texture:** Use overlapping semi-transparent strokes at slight angles (canvas lineTo with jitter), not flat fills. Layer more strokes = darker shading. Target 3-8 layers depending on intensity.

**What this communicates:**
- Lightly shaded areas = flavors already represented
- Unshaded areas = flavor gaps ("you have no umami — try adding soy sauce or parmesan")
- Heavily shaded areas = dominant flavors (maybe over-represented)
- **Replaces the RecipeAnalysis component** on mobile — the wheel IS the analysis, visually

### Interaction
- **Tap an octant** → The suggestion drawer filters to that taste category
- **Long-press an octant** → Tooltip shows: "Umami: 65% — contributed by mushroom, soy sauce"
- No pan/zoom. Wheel always fits the viewport width with 16px padding.

### Animation
- When an ingredient is added, its taste contributions animate in: new pencil strokes "draw themselves" into the relevant octants over ~400ms

---

## Zone 2: Recipe Notebook Page (Middle — ~25%)

A clean, scrollable representation of the recipe being built. This replaces the canvas-rendered ingredient nodes.

### Visual Design
- Ruled lines every 28px (#c9b99a), red margin line at left (#e07070) — same as current NotebookCanvas
- Caveat cursive font throughout
- Cream background (#fefae0)

### Content Layout
```
  | [Recipe Title input — placeholder: "Untitled Recipe"]
  | 
  | ◆ garlic (center)              [recenter] [x]
  | ● lemon — 87% match            [recenter] [x]
  | ● butter — 82% match           [recenter] [x]
  | ● shrimp — 76% match           [recenter] [x]
  |
```

- **Center ingredient:** Diamond (◆) icon, bold, taste-colored left border
- **Other ingredients:** Circle (●) icon, taste-colored left border, match % shown
- **Each row:** Tappable. Shows ingredient name, compatibility score, recenter and remove buttons
- **Swipe left on a row** → Reveals remove button (iOS-style swipe-to-delete)
- **Tap recenter button** → Changes center ingredient, suggestion drawer updates

### Empty State
```
  |
  |   Start your recipe...
  |   Search for an ingredient above
  |   to build around
  |
```

Centered placeholder text in light pencil gray, italic Caveat.

### Compatibility Score
- Shown below ingredient list when >= 2 ingredients
- Same pairwise averaging as current RecipePanel
- Rendered as handwritten text: "Compatibility: 78%"

---

## Zone 3: Suggestion Drawer (Bottom — Collapsible)

A bottom sheet following the Apple Maps pattern: collapsed (peek), half-expanded, full-expanded.

### States
1. **Collapsed (peek):** ~56px visible. Shows drag handle + "Suggestions" label + ingredient count badge
2. **Half-expanded (default):** ~40% screen height. Shows taste tabs + ingredient chips
3. **Full-expanded:** ~75% screen height. Shows taste tabs + chips + "Give me a suggestion" section

### Drag Handle
- Centered pill shape (40px x 4px, rounded, #c9b99a)
- Drag up/down to resize. Snap to nearest state.

### Taste Tab Bar
- Horizontal scrollable row of 8 taste tabs
- Each tab: taste name + colored dot (from TASTE_COLORS)
- Active tab: filled background with taste color at 20% opacity
- **"All" tab** at the start (default) — shows top pairings sorted by strength
- **"Best" tab** — shows only pairings that complement current recipe gaps (based on taste wheel analysis)

### Ingredient Chips
- Scrollable grid (2 columns) or vertical list of ingredient chips
- Each chip:
  ```
  +-----------------------------+
  | ● Parmesan         87%  [+] |
  |   umami, salty              |
  +-----------------------------+
  ```
  - Taste-colored left accent
  - Ingredient name (Caveat font)
  - Match % (strength to center ingredient, or avg strength to all recipe ingredients)
  - Small taste tags below name
  - Tap [+] or tap anywhere on chip → adds to recipe
- **Sorted by:** Relevance (avg pairing strength to current recipe ingredients)
- **Filtered by:** Active taste tab
- **Grayed out:** Ingredients already in recipe (shown at bottom, non-tappable)

### "Give Me a Suggestion" Feature
- Button at bottom of full-expanded drawer
- Styled as a hand-drawn button matching notebook aesthetic
- **Logic:** Uses existing `analyzeRecipe().suggestions.add` from recipeAnalysis.js
- **Behavior on tap:**
  1. Picks the top suggestion not already in recipe
  2. Shows it as a highlighted "recommended" chip with explanation: "Pairs well with 3 of your ingredients"
  3. User taps to accept or dismiss
- **If recipe has gaps** (unshaded taste wheel octants): Prioritize suggestions that fill the weakest taste axis
  - Example: "Your recipe is missing umami — try mushroom (pairs with garlic, butter)"
- **Shake-to-suggest:** Optional — device shake triggers a random-weighted suggestion (fun/playful)

---

## Search Bar

- Pinned at very top of screen, above the taste wheel
- Same Fuse.js fuzzy search as current
- Width: `calc(100% - 2rem)`, centered
- On focus: taste wheel and notebook compress slightly to make room for keyboard + results dropdown
- First ingredient selected → becomes center ingredient (same as current flow)

---

## Mode Tabs (Taste / Cocktail / Sauce)

- Small segmented control below search bar, right-aligned
- Same 3 modes as current
- When mode changes:
  - Taste wheel axis labels update (taste axes vs cocktail axes vs sauce axes)
  - Suggestion drawer content re-sorts based on mode-specific structure scoring
  - Structure selector appears as a dropdown within the drawer (not a separate top-left control)

---

## Flow: Step by Step

### First Launch (Empty State)
1. User sees: Search bar + empty taste wheel (just axis lines, no shading) + notebook with "Start your recipe..." prompt + collapsed suggestion drawer
2. Suggestion drawer peek shows: "Search to get started"

### Pick Center Ingredient
1. User searches "chicken"
2. Taps result → chicken becomes center ingredient
3. Taste wheel animates: chicken's taste profile shades in (mild umami, subtle savory)
4. Notebook shows: "◆ chicken" as first entry
5. Suggestion drawer auto-expands to half state, populated with chicken's pairings

### Browse & Add Pairings
1. User scrolls suggestion drawer, sees chips: garlic (92%), lemon (85%), thyme (81%)...
2. Taps "garlic" chip → added to notebook, taste wheel updates (more pungent/umami shading)
3. Taps "umami" taste tab → drawer filters to umami pairings: soy sauce, parmesan, mushroom...
4. Sees the umami octant is still lightly shaded → taps mushroom to fill it out

### Use the Taste Wheel for Guidance
1. After 4 ingredients, user sees: heavy umami + pungent, light sweet + sour
2. Taps the pale sour octant → drawer jumps to sour-dominant pairings
3. Sees "lemon" chip highlighted → adds it
4. Sour octant darkens — recipe is more balanced

### Get a Suggestion
1. User pulls drawer to full-expanded
2. Taps "Give me a suggestion"
3. System responds: "Try adding rosemary — pairs well with chicken, garlic, and lemon. Would add herbal/astringent notes you're missing."
4. User taps the highlighted chip → rosemary added

### Recenter
1. User taps recenter on "mushroom" in notebook
2. Suggestion drawer repopulates with mushroom's pairings (filtered to exclude ingredients already in recipe)
3. Taste wheel doesn't change (it reflects the whole recipe, not just center)

### Save
1. User taps recipe title, types "Lemon Herb Chicken"
2. Taps "Save" button at bottom of notebook section
3. Recipe saved to profile

---

## Technical Implementation

### New/Modified Files

| File | Action | Description |
|------|--------|-------------|
| `src/components/RecipeLabMobile.jsx` | **NEW** | Mobile-specific Recipe Lab container |
| `src/components/TasteWheel.jsx` | **NEW** | Canvas-rendered octagonal taste wheel with pencil shading |
| `src/components/RecipeNotebook.jsx` | **NEW** | Scrollable ingredient list (notebook styled) |
| `src/components/SuggestionDrawer.jsx` | **NEW** | Bottom sheet with taste tabs + ingredient chips |
| `src/components/RecipeLab.jsx` | **MODIFY** | Gate: `isMobile ? <RecipeLabMobile /> : <existing desktop JSX>` |
| `src/data/tasteScoring.js` | **NEW** | Aggregate taste scoring for recipe (wraps scoreIngredient) |
| `src/components/NotebookCanvas.jsx` | **UNCHANGED** | Desktop only, no modifications |
| `src/components/RecipePanel.jsx` | **UNCHANGED** | Desktop only, no modifications |

### TasteWheel Rendering (Canvas 2D)

```
Canvas element, sized to viewport width - 32px, square aspect ratio

1. Draw octagon outline (wobbly hand-drawn lines)
2. For each of 8 octants:
   a. Compute fill intensity = aggregateRecipeTaste[axis] / maxTaste (0-1)
   b. If intensity > 0:
      - Generate N pencil strokes (N = Math.ceil(intensity * 8))
      - Each stroke: line from near-center to near-edge of octant
      - Stroke color: TASTE_COLORS[axis] at 30-60% opacity
      - Stroke width: 2-4px with slight randomness
      - Angle: base angle ± random jitter (±15deg)
      - Creates hand-drawn colored pencil shading effect
3. Draw axis lines (dashed, pencil gray)
4. Draw axis labels at vertices
5. Draw center dot (if recipe non-empty)
```

### Suggestion Drawer — Bottom Sheet Implementation

Use a gesture-driven bottom sheet:
- CSS `transform: translateY()` for position
- `touch-start/move/end` for drag gesture
- Three snap points: peek (56px), half (40vh), full (75vh)
- Spring physics or `transition: transform 300ms ease-out` for snapping
- `overflow-y: auto` for internal scroll when content exceeds sheet height
- Sheet scrolls internally; doesn't compete with page scroll

### Taste Scoring Aggregation

```javascript
// src/data/tasteScoring.js
import { scoreIngredient } from './tastePositioning.js';

export function aggregateRecipeTastes(ingredients, nodes) {
  const totals = { sweet: 0, salty: 0, sour: 0, bitter: 0,
                   umami: 0, spicy: 0, pungent: 0, astringent: 0 };
  for (const name of ingredients) {
    const node = nodes.find(n => n.name === name);
    if (!node) continue;
    const scores = scoreIngredient(name, node);
    for (const [axis, val] of Object.entries(scores)) {
      totals[axis] += val;
    }
  }
  const max = Math.max(...Object.values(totals), 0.01);
  const normalized = {};
  for (const [axis, val] of Object.entries(totals)) {
    normalized[axis] = val / max;
  }
  return { totals, normalized, max };
}

export function findWeakestAxis(normalized) {
  return Object.entries(normalized)
    .sort((a, b) => a[1] - b[1])[0]; // [axisName, value]
}
```

### Integration with Existing Analysis

- The "Give me a suggestion" button calls `analyzeRecipe()` from `recipeAnalysis.js` (already exists)
- It uses `suggestions.add` (up to 5 suggestions sorted by avg strength)
- Additional filtering: cross-reference with `findWeakestAxis()` to prioritize gap-filling suggestions
- Swap suggestions available via long-press on an ingredient in the notebook

---

## Constraints

- **Desktop is unchanged.** All new components are mobile-only, gated by `isMobile` prop.
- **No new dependencies.** Bottom sheet is hand-rolled (CSS transforms + touch events). No external gesture libraries.
- **Performance:** TasteWheel re-renders only when `recipeIngredients` changes. Memoize pencil stroke geometry (regenerate only on ingredient add/remove, not on every frame).
- **Data flow:** Same `fullData` prop from App.jsx. Same `useProData()` hook. No new API calls.
- **Font:** Caveat (already loaded). No new fonts.
- **Colors:** Use existing TASTE_COLORS from `src/utils/color.js`. No new color constants.

---

## Lessons Applied (from ralph-universal/lessons/)

- **small-iterations-succeed**: Each task touches 1-3 files max. No monolithic refactors.
- **test-coverage-gaps**: flavor-network has ~1 test file for the entire app. This loop includes 2 dedicated test tasks (TASK-212, TASK-213) to avoid repeating this pattern.
- **ui-projects-need-test-infrastructure**: Test infrastructure (vitest + @testing-library/react) must be verified/bootstrapped before the test tasks run. Unit tests for data logic (tasteScoring), component tests for gesture/interaction code.
- **bootstrap-overwrites-config**: Do NOT run `bootstrap.py` on this project — it would destroy 96 custom permissions in `.claude/settings.local.json`.

---

## Out of Scope (This Loop)

- Desktop Recipe Lab changes
- New data sources or API endpoints
- Recipe sharing/export
- Offline/PWA caching
- Recipe Lab for tablet (use desktop layout for now)
- Cocktail/sauce mode axis customization for taste wheel (use taste axes for all modes initially; cocktail/sauce axis mapping is a fast-follow)

---

## Task Breakdown (for ralph plan.md)

1. **Scaffold RecipeLabMobile.jsx** — Container with 3-zone layout, isMobile gate in RecipeLab.jsx
2. **Build TasteWheel.jsx** — Canvas octagon with axis lines and labels (no shading yet)
3. **Add pencil-shading renderer** — Scribble-stroke fill algorithm for TasteWheel octants
4. **Implement tasteScoring.js** — Aggregate recipe taste scoring + weakest axis detection
5. **Wire TasteWheel to live data** — Connect to recipe state, animate shading on ingredient add/remove
6. **Build RecipeNotebook.jsx** — Scrollable ingredient list with notebook styling, swipe-to-delete
7. **Build SuggestionDrawer.jsx** — Bottom sheet shell with 3 snap states, drag gesture
8. **Add taste tab bar** — Horizontal scrollable tabs with "All" and "Best" + 8 taste tabs
9. **Add ingredient chips** — 2-column grid of tappable pairing chips in drawer, sorted by relevance
10. **"Give me a suggestion" feature** — Button + logic using analyzeRecipe + taste gap analysis
11. **Tap-octant-to-filter** — Tapping taste wheel octant filters suggestion drawer to that taste
12. **Polish & integration test** — Animations, empty states, mode switching, save/clear flow
