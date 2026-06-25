# Design Exploration — Pairing Lab (reintroducing "network mode")

*2026-06-25 · /design + /frontend-design · interactive-bridge intake*

## Intent (from the brief)
A model of flavor pairings that can **shift between aspects** — aroma,
taste, cuisine, season. Reintroduces the parked "network mode," but
thoughtfully, **mobile/iOS-first**, lives under **Labs**. References:
flavorpair.me (ingredient-search → network nav, switchable "lenses",
Jaccard vs Flavor Bible, recipe module) and cosylab FlavorDB (molecular
compound network, ingredient/molecule pages — **explicitly desktop-only**,
a cautionary tale for iOS).

## Key grounding finding
**This is not a new algorithm — it already exists, parked.**
- `src/data/categoricalAxes.js` → `CATEGORICAL_AXES`: aroma (13 buckets),
  taste (8), cuisine (8 regional), season (5), family (11), each with
  colors + a `bucketOf(node, ctx)` classifier. **These ARE the "aspects."**
- `src/data/networkModes.js` → `morphAxisForStack` / `FILTER_TO_AXIS` is
  exactly the aspect-shift mechanism.
- `src/components/LivingArchView.jsx` (3,768 lines, Three.js) already
  morphs all nodes between per-axis "wheel" layouts, edges = pairings.
- Pairing neighborhoods: `src/data/graph.js` `getNeighbors` /
  `getNeighborsEnriched` + already-loaded pairing strengths.

**Why it was parked (2026-06-23):** the whole-graph 3D was "decorative +
hard to navigate," the WebGL is heavy on phones and hangs headless, and
the morph engine is 3,768 lines of complexity. So: keep the *model + data
+ bucket math*, replace the *interaction + renderer*.

## Decisions (interactive-bridge intake, 2026-06-25)
| # | Question | Decision |
|---|---|---|
| 1 | Core interaction | **Ingredient-first ego-network** — one ingredient + its ~12 strongest partners; switch lens to recolor/regroup; tap a partner to re-center. (Matches flavorpair.me; legible at 390px.) |
| 2 | Rendering | **2D Canvas now, keep a documented WebGL seam optional** — reuse axis/bucket DATA, not the 3,768-line WebGL view. |
| 3 | Placement | **New "Pairing Lab"** — 4th lab beside Cocktail/Sauce/Cookbook. |
| 4 | Aesthetic | **Chalk frame, vivid data inside** — chalk chrome/controls; canvas uses the vivid bucket palette at full saturation. |

## Thesis / signature
The hero is **not** a hairball — it's a single ingredient and its circle
of partners, drawn like a **mise-en-place board**: the center ingredient
is the dish-in-progress; partners are the prepped bowls around it. The
**signature interaction is the "lens twist"**: the *same* partners
physically travel into new grouped, labeled zones (and recolor) as you
change the aspect. The layout itself encodes the lens — not just a
recolor, a *re-plating*. That single orchestrated motion is the one bold
moment; everything around it stays quiet.

## The five lenses (the core)
Only ~12–15 partners are ever on screen (top by pairing strength), so
every layout stays legible and the draw cost is bounded regardless of the
3,390-node universe.

- **Affinity (default)** — pure ego. Partners radial; ring distance =
  pairing strength (closer = stronger). Node color = dominant taste.
  "Who pairs with garlic."
- **Aroma** — partners group into labeled arcs by aroma family
  (Citrus/Fruity/.../Pungent), colored with `AROMA_COLORS_FULL`.
  "Garlic's partners, sorted by aroma" → reveals e.g. pungent+green skew.
- **Taste** — partners pulled toward the 8 taste poles (`TASTE_COLORS`).
  Shows the taste balance of the pairing set.
- **Cuisine** — partners group by region bucket (`CUISINE_COLORS`).
  "Where garlic lives."
- **Season** — partners on a 4-quarter seasonal ring + All-Year band
  (`SEASON_COLORS`). Seasonal co-availability; defaults to current month.

Lens = a thumb-reachable chalk segmented control. Switching springs the
re-layout. **This is the "shift between aspects" made concrete + legible.**

## Token system (frontend-design)
- **Color — frame (chalk):** `chalkTheme.js` — slate `CHALK_BG`, cream
  `CHALK_CREAM` text, `CHALK_DIM`/`CHALK_RAIL`, `CHALK_TEXTURE`.
  **Data (vivid, full-sat inside canvas):** reuse `AROMA_COLORS_FULL`,
  `TASTE_COLORS`, `CUISINE_COLORS`, `SEASON_COLORS`, `FAMILY_COLORS`
  verbatim (already consistent across radar/joystick). Edges = white
  chalk stroke, low alpha; active partner's edge brightens.
- **Type:** Caveat (`FONT`) for center name (large), lens + zone labels;
  a legible sans for partner names / strength values / counts so small
  retina text stays crisp (matches the CK-14 pairing).
- **Layout:** full-bleed chalk-framed canvas; top = chalk search +
  lens segmented control; ego board fills the rest; `BottomSheet` for
  tapped-partner detail.
- **Signature:** the lens-twist re-plating (one memorable motion).

## iOS / mobile fit (explicit concern)
- **2D Canvas, no WebGL** → no WebGL-hang, no Three.js init; fine under
  Capacitor WKWebView. Lab is **lazy-mounted** (reuses the just-shipped
  PERF-LAZY-NETWORK pattern).
- **Touch:** tap node = re-center; press-and-hold = peek detail; lens is
  a thumb control. No 3D orbit/pinch needed (ego is inherently legible).
- **Bounded cost:** cap ~12–15 partners; `devicePixelRatio` capped at 2;
  `requestAnimationFrame` runs **only during the lens-twist transition**,
  then idle — no continuous render loop (fixes the parked version's
  always-animating battery drain).
- **Respects `prefers-reduced-motion`** — snap to layout, skip the twist.

## Reuse map
| Need | Existing |
|---|---|
| partner neighborhood + strengths | `graph.js` getNeighbors(Enriched) |
| lens grouping | `categoricalAxes.js` `bucketAllNodes(axis, nodes, ctx)` → byBucket |
| colors | bucket palettes above |
| search | fuse.js / SearchBar pattern |
| node taste color | `utils/color.js` |
| detail | `BottomSheet` + `IngredientPanel` |
| send-to-lab | existing `onFindCocktail` / `onFindSauce` handoff |

## New functionality (invited)
1. **Bridge arcs** — when two partners also pair with each other, draw a
   faint chalk arc → surfaces 3-ingredient flavor trios chefs love.
2. **Build-a-plate** — tap-collect partners into a bottom tray → send the
   set to Recipe Lab / Find-cocktail / Find-sauce (reuses handoff). Turns
   exploration into action.
3. **Lens-contrast insight line** — one rule-based sentence per lens
   ("Garlic's partners skew Pungent + Green") from the bucket distribution.
4. **Two-ingredient (edge) mode** — center on garlic×lemon → show the
   *shared* neighborhood (what completes the pair).
5. **Serendipity shuffle** — re-center on a strong-but-distant partner
   (novelty prior; see the embeddings-as-novelty memory).
6. **Season-now default** — season lens defaults to current month,
   highlights in-season partners.

## Plan (phased, each independently shippable)
- **P0 — data seam:** `src/data/pairingEgoModel.js` — pure:
  `egoNeighborhood(name, {limit})`, `groupByLens(partners, lens, ctx)`,
  `lensInsight(partners, lens, ctx)`. Unit-tested; no rendering.
- **P1 — renderer:** `src/components/PairingBoard.jsx` — 2D Canvas ego
  graph, 5 lens layouts + spring transition, chalk frame + vivid palette,
  reduced-motion + dpr cap.
- **P2 — lab shell:** `src/components/PairingLab.jsx` — search + lens
  control + board + bottom-sheet detail; lazy-mounted; wired as the 4th
  lab in the Labs entry.
- **P3 — new functionality:** bridge arcs, build-a-plate, insight line,
  season-now.
- **WebGL seam:** `PairingBoard` takes a renderer strategy so the
  Three.js view can later implement the same interface for a desktop
  "expand" mode (satisfies decision #2).

## Constraints
- Additive + null-safe: degrade to a static partner LIST if canvas/model
  unavailable.
- Reuse existing math/data — no model retraining, no new dataset.
- Mobile-first; stay in the chalk visual language for chrome.
- Unit tests for the pure logic (ego selection, lens grouping, insight).

## Acceptance criteria
- [ ] Pairing Lab reachable from Labs; opens to a searchable ego board.
- [ ] Search/tap an ingredient → ~12 strongest partners, ring = strength.
- [ ] Lens segmented control (Affinity/Aroma/Taste/Cuisine/Season)
      re-plates + recolors partners with a spring transition.
- [ ] Tap a partner re-centers; press-hold peeks detail.
- [ ] Insight line reflects the active lens's bucket distribution.
- [ ] No WebGL; idle when not transitioning; reduced-motion respected.
- [ ] Pure logic unit-tested; full suite green; build clean.

## Why this beats the parked version
Same model + data, radically more legible and lighter: one ingredient +
~12 partners instead of a 3,390-node hairball; 2D tap-nav instead of 3D
orbit; the lens does real analytical work instead of decoration; idle
instead of always-animating WebGL. Boldness spent in one place (the lens
twist); everything else disciplined and quiet.
