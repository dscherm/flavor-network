# Canonical Network & Affinity Spec

> **Status**: Authoritative. Supersedes all prior specs, ralplans, and amendments listed in
> [§13 Source spec lineage](#13-source-spec-lineage). When this file disagrees with any other file
> in the repo, **this file wins**. Last revised 2026-05-24.

> **Scope**: The 3D Flavor Network, Affinity Mode (α-mode), filter pills, camera animator,
> IngredientPanel, and adjacent UI in the Explore tab. Cocktail Lab / Sauce Lab / Recipes Lab
> are out of scope except where they consume the same data artifacts.

> **How to use this document**: each section is a self-contained contract. Source spec citations
> live at the end; you do not need to read the source specs to implement the feature.

---

## Table of Contents

1. [Information architecture](#1-information-architecture)
2. [Network modes & mode picker](#2-network-modes--mode-picker)
3. [Node behaviors](#3-node-behaviors)
4. [Edge behaviors](#4-edge-behaviors)
5. [Cluster behavior](#5-cluster-behavior)
6. [Affinity Mode (α-mode)](#6-affinity-mode-α-mode)
7. [Filter pills + breadcrumb](#7-filter-pills--breadcrumb)
8. [Camera animator](#8-camera-animator)
9. [IngredientPanel](#9-ingredientpanel)
10. [Feature flags](#10-feature-flags)
11. [Performance + accessibility](#11-performance--accessibility)
12. [Out of scope / non-goals](#12-out-of-scope--non-goals)
13. [Source spec lineage](#13-source-spec-lineage)

---

## 1. Information architecture

### 1.1 Landing & top-level nav

3 entry tiles → 3 top-level tabs:

| Tile | Tab | Route |
|---|---|---|
| Explore the Network | Explore | `/explore` |
| Guided Discovery | Guided | `/guided` |
| Build your Recipe | Build | `/build` |

Inside **Explore**, a secondary nav exposes the labs:
`Network 3D | Cocktail Lab | Sauce Lab | Recipes`. Labs are lazy-mounted.

### 1.2 Default landing mode

When the user lands on Explore → Network 3D, the default mode is **`flavor3D`**
(the chemistry-grounded UMAP layout). This is the v3 corpus-wide layout
described in §3.3.

---

## 2. Network modes & mode picker

### 2.1 User-facing modes (locked at 2 entries)

```
MODE_CYCLE = ['flavor3D', '2D']
```

- **`flavor3D`** (position 0) — the v3 UMAP layout (4,814 ingredients) with
  chemistry-grounded clusters. The UI displays this entry as "3D" via
  `MODE_LABELS`.
- **`2D`** (position 1) — the parallel `n_components=2` UMAP from the same
  V3b embedding (4,814 ingredients). Resolves internally to `flavor2D`
  via `effectiveLegacyMode('2D')`.

The asymmetry (position 0 is the internal key, position 1 is the human
label) is intentional. Per ADR-1 the legacy human label `'3D'` was hidden
from the cycle while keeping `effectiveLegacyMode('3D') → 'ml'` intact
so programmatic callers (URL params, bookmarks, tests) continue to work.
To re-enable the legacy `'3D'` entry, add `'3D'` back to `MODE_CYCLE`
(single-line revert in `src/data/networkModes.js`).

**Legacy modes (`ml`, `ml2d`, `neural`, `taste2d`, `aromas2d`, `cuisine2d`,
`season2d`, `family2d`) are not reachable via the user-facing picker.**
They remain as internal axis keys consumed by `posForMode` for morph
transitions when a filter pill is active (see §7) — but never as
user-selectable modes.

### 2.2 Internal-only modes (axis keys for filter morphs)

When a filter pill is active, the 3D scene morphs node positions from
the current `flavor3D` / `flavor2D` layout to a categorical axis layout
indexed by the filter (taste, aroma, cuisine, season, family). The
morph is computed at `posForMode[axis]` and interpolated by the filter
joystick. The morph is **internal animation only** — the visible mode
picker stays at the two cycle entries.

### 2.3 Acceptance

- [ ] `MODE_CYCLE.length === 2`
- [ ] `MODE_CYCLE[0] === 'flavor3D'` and `MODE_CYCLE[1] === '2D'`
- [ ] User can switch 3D ↔ 2D with a single tap
- [ ] Switching modes does NOT clear an active filter
- [ ] Switching modes does NOT exit α-mode

---

## 3. Node behaviors

### 3.1 Color precedence

A node's rendered color is determined by a multi-layer pipeline that
spans **three places in the codebase**, not a single function. Reading
in order of priority (top wins):

0. **Cluster-focus visibility (§5.6)** — when cluster-focus is engaged
   and `node.clusterId !== focusedClusterId`, the node is HIDDEN via a
   scale-0 matrix write in `ClusterFocusMode.tickAnimation`. Cluster-focus
   owns exclusive write authority over visibility for non-focused nodes
   while engaged. *This short-circuits everything below — applied in
   `ClusterFocusMode.js`, not in `getColorForNode`.*
1. **Filter-bucket color** — if a non-scope filter pill is active, the
   filter effect in `LivingArchView.jsx` writes per-instance color from
   the active filter's bucket palette (aroma family color, taste color,
   etc.). See §7. *Applied via `mesh.setColorAt` in the filter useEffect,
   not in `getColorForNode`.*
2. **Primary Tier-1 aroma** — `BRISCIONE_AROMA[node.primaryTier1Aroma]`
   when set (N1-D5, 2026-05-25). Chef T1[0] for the 89 verified
   ingredients; `gnnPrimaryTier1()` for the long-tail (highest aroma
   head above its calibrated `ingredient_profile_thresholds`
   threshold, with `AROMA_AXES` order tie-break). Palette =
   `BRISCIONE_AROMA` (5 entries: fruity, floral, green, woody, fatty).
3. **v3 cluster color** — defensive fallback when no Tier-1 is
   derivable (long-tail without GNN coverage, or compound foods with
   no Tier-1 entry). `getColorForNode` returns `node.clusterColor`
   from the `V3_CLUSTER_HEX` palette (20 entries, wraps modulo for
   k > 20).
4. **Taste blending** — multi-taste blend from `node.taste` (sweet=pink,
   sour=cyan, bitter=purple, salty=blue, spicy=red, pungent=orange,
   astringent=teal, umami=gold). Fallback only.
5. **Neutral gray `#5a5a6b`** — applied as a pre-pass to every node in
   v3 mode so any node outside the v3 universe doesn't bleed taste
   colors. The v3 ingredients pass overwrites this with their cluster
   color. *Applied in the v3 initializer in `useProData.js`, not in
   `getColorForNode`.*

`getColorForNode(node)` itself only implements priorities **2–4**
(cluster / Tier-1 / taste). Priorities 0, 1, and 5 are written by
their respective owners before or after `getColorForNode` runs.

**Color is mutually-exclusive per node at any given moment.** When a
filter pill is active, the cluster palette is suppressed; when no
filter is active, the cluster palette drives the visual.

### 3.2 Size

`size ∝ pairingCount` (truncated to a sane visual range). Hub
ingredients render larger; specialty ingredients smaller. No
size-based filter behavior — size is always informational.

### 3.3 Position (v3 layout)

Positions for all 4,814 v3-universe ingredients come from:

- **3D mode**: `public/proDataset/flavor_positions_v3.json` (UMAP
  `n_components=3`, `min_dist=0.45`, `seed=42`, applied `* SCENE_SCALE`
  then `* FLAVOR_SPREAD=3.0` in `useProData`).
- **2D mode**: `public/proDataset/flavor_positions_2d_v3.json` (same
  UMAP seed at `n_components=2`).

For ingredients in `ingredients.json` but outside the v3 universe (post-
expansion, ~0 — the expansion brought heuristic rows in), no position
is rendered.

### 3.4 Hover behavior

On node hover:
- Cursor switches to pointer
- A tooltip renders at cursor position with:
  - **Name** (bold)
  - **Aroma** in amber if `node.flavorGraph?.tier1?.length > 0`
  - **Taste** in gray if `node.taste` is set
- The node itself does NOT change scale on hover (subtle: glow brightness
  only).

### 3.5 Selection state (two-stage)

α-mode is no longer engaged on a simple click. The single click is a
"peek" gesture that opens the IngredientPanel with Tier-1/2/3 info;
α-mode requires a deliberate second gesture (long-press or
double-click).

| Gesture | Action |
|---|---|
| Single-click / single-tap on node | **Selects** the node. Opens IngredientPanel (Tier-1 aroma, Tier-2 taste, Tier-3 mouthfeel, leaves, predicted profile). **Always exits α-mode** — even if α-mode was engaged on a previous node, single-click forces it off. |
| Long-press on node (touch held ≥ 350ms) | Engages α-mode (§6) on this node. |
| Double-click on node (desktop) | Engages α-mode (§6) on this node. |
| Single-click on a different node (while α-mode active) | **Exits α-mode + re-selects.** Panel updates; no ring re-pivot. To pivot α-mode to a new focal, double-click the new node. |
| Single-click on a different node (while panel open, no α-mode) | Re-selects; panel updates. |
| Click on background | Deselects, closes panel, exits α-mode. |
| Double-click on background | Also deselects + recenters camera. |
| ESC | Full clear: closes IngredientPanel, deselects, exits α-mode, exits cluster-focus. (Routes through `handleClearSelection` in `App.jsx`, which clears `selectedNodes` + `activePanel` + `focusedCluster` in one shot.) |

Rationale: the prior single-click→α-mode gesture meant users couldn't
inspect an ingredient's chemistry without committing to the full
α-mode rendering. The two-stage flow lets the user **peek** (panel
only) or **commit** (panel + 3D rings).

### 3.6 Acceptance

- [ ] Color priority order matches §3.1
- [ ] No taste-color bleed-through in v3 mode for nodes outside the universe
- [ ] Hover tooltip shows aroma + taste when known
- [ ] Click engages α-mode (§6) ; click-empty exits

---

## 4. Edge behaviors

### 4.1 Source

Edges come from `public/proDataset/pairings.json` (~105,792 pairs).

### 4.2 Visibility rules

By default the 3D scene renders edges only for the currently-selected
node (α-mode renders rings — see §6). When no node is selected, **no
edges render** (otherwise the corpus is illegible: 100k+ edges).

**Cluster-focus exception (§5.6):** when cluster-focus is engaged, edges
render only where BOTH endpoints share `focusedClusterId` (intra-cluster
edges only). Cross-cluster edges stay hidden. Edge colors follow §4.3
tier coloring rules unchanged.

### 4.3 Edge color (α-mode only)

From `TIER_COLOR` in `src/three/AffinityMode.js:126-131`:

- ★★★ (Chemistry) — **gold** `#facc15` (`0xfacc15`)
- ★★  (Strong)    — **silver** `#a3a3a3` (`0xa3a3a3`)
- ★   (Good)      — **bronze** `#a16207` (`0xa16207`)
- ♢   (Surprising) — **fuchsia** `#e879f9` (`0xe879f9`)

Edge opacity from `TIER_OPACITY`:
- ★★★ 0.9, ★★ 0.7, ★ 0.5, ♢ 0.55.

Edge color reflects the **native tier** of the pairing (its scoring
under strict/lenient rules per §6.7), NOT the ring/floor it sits in.
A pair that ranks high by raw strength but only matches ★★ rules
still gets silver.

### 4.4 Particle flow

Animated particles flow along visible edges, direction = source → target,
speed scaled by strength. Particle density is throttled on mobile (see
§11).

### 4.5 Acceptance

- [ ] No edges visible when no selection
- [ ] α-mode edges colored gold/silver/bronze per native tier
- [ ] Particle FPS holds 60 on desktop / 30 on mobile

---

## 5. Cluster behavior

### 5.1 Source

`public/proDataset/cluster_labels_v3.json`:

```json
{
  "k": 14,
  "clusters": [
    { "id": 0, "label": "Vegetables & Greens", "chemistry_label": "cluster-0",
      "size": 95, "dense_core_size": 74, "centroid_3d": [x, y, z] },
    ...
  ],
  "ingredients": { "<name>": <cluster_id>, ... },
  "_meta": { "cluster": {...}, "k": 14, ... }
}
```

Note: after the 2026-05-24 bisection + merge passes, cluster ids in use
are non-contiguous (`[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 15, 17]` —
ids 12/13/14/16/18/19 are unused gaps from merges). `k=14` is the count
of populated clusters, not the max id + 1.

### 5.2 Label sprites

In flavor3D / mlflavor mode, a floating text sprite renders at each
cluster's `centroid_3d` position (the **all-member mean**). The label
text comes from `label` (chef-curated when present, else auto-chemistry
tag). Sprite color matches the cluster's palette color so the label is
legible against its members.

**Known limitation: label uses all-member centroid, not dense-core
centroid.** An earlier spec revision required a dense-core centroid to
avoid HDBSCAN noise-reassignment pulling the label off the actual
cluster heart. The current `cluster_labels_v3.json` schema only stores
`dense_core_size` (a count) and `centroid_3d` (all-member position) —
there is no `dense_core_centroid` field, so the dense-core-position
contract is not enforced today. Reinstating it would require an
offline bake step that emits per-cluster `dense_core_centroid_3d`.

Sprites are hidden when α-mode is engaged so the affinity wheel reads
cleanly.

### 5.3 Cluster colors (palette)

```
V3_CLUSTER_HEX = [
  // Base palette — cluster ids 0..9
  '#f472b6', '#ea580c', '#22c55e', '#dc2626', '#facc15',
  '#a855f7', '#84cc16', '#b45309', '#78350f', '#64748b',
  // Extended for cluster ids 10..17 (added 2026-05-24 after the
  // layout-v3 bisection grew cluster count from 8 → 17 before merges).
  '#06b6d4', '#fb7185', '#10b981', '#eab308', '#7c3aed',
  '#15803d', '#9333ea', '#0284c7',
  // Further extended for k=20 GNN bisection (cluster ids 18..19).
  '#ef4444', '#14b8a6'
]
```

20 entries. Indexing wraps modulo `V3_CLUSTER_HEX.length` (i.e., 20).
With the current `k=14` and the bisection-then-merge ID gaps, **no two
shipped clusters share a color** today. The previous "accepted
compromise" wording (color collision among 3-of-13 clusters under a
10-entry palette) is superseded.

### 5.4 Click behavior on cluster sprite

Currently inert (sprite is decorative). Future: may engage a "cluster
tour" focal flight. Out of scope for current ship — note that the
**joystick pill** click (§5.6) is the canonical cluster-focus
entry-point, NOT the sprite.

### 5.5 Acceptance

- [ ] Label sprite renders at `centroid_3d` (all-member centroid; dense-core variant is a follow-up — see §5.2)
- [ ] Label hidden when α-mode engaged
- [ ] Palette wraparound is consistent across renders (mod `V3_CLUSTER_HEX.length` = 20)

### 5.6 Cluster focus: Isolate + Spread

Tapping a **joystick cluster pill** (`ClusterJoystick.jsx`) engages
cluster-focus on that cluster. The mode does two things together:

#### 5.6.1 Isolate (hide everything else)

While a cluster is focused:

- Every node whose `clusterId !== focusedClusterId` is **HIDDEN**
  (priority-0 visibility per §3.1, item 0). This is a true hide, not
  a dim — non-focused nodes do not render at all.
- Every cluster label sprite except the focused cluster's hides
  (parallel to §5.2's α-mode hide).
- Every joystick pill except the focused pill hides.
- Every edge except intra-focused-cluster edges hides (§4.2 exception).
- Intra-focused-cluster edges render with §4.3 tier colors.

#### 5.6.2 Spread (fan focused-cluster members apart)

Focused-cluster members are repositioned via radial fan-out from the
cluster centroid:

```
node_radius          = NodeMesh sphere radius at default size
target_min_spacing   = 1.5 × (2 × node_radius)
current_min_spacing  = min nearest-neighbor distance in the cluster
spread_factor        = max(1.0, target_min_spacing / current_min_spacing)

new_pos = centroid + (canonical_pos - centroid) * spread_factor
```

Properties:

- **Adaptive per cluster** — small dense clusters spread aggressively;
  already-loose clusters barely spread. Each cluster reaches the same
  identifiability floor.
- **Centroid is invariant** — only members move; centroid stays put.
- **Relative topology preserved** — nearby ingredients stay near each
  other; just farther apart in absolute distance.
- **Aliased members travel with their canonical** — the existing SHA1
  post-jitter keeps aliases visually distinguishable from canonicals.
- **Reversible** — canonical positions are snapshotted at focus-enter
  and restored exactly on exit.

#### 5.6.3 Camera

Camera flies to the focused cluster's centroid and re-fits its distance
so the now-spread cluster fills ~60% of viewport height:

```
spread_radius = max(|new_pos - centroid|) for all focused members
fov_rad       = camera.fov * PI / 180
fit_distance  = spread_radius / tan(fov_rad / 2 * 0.60)
```

Animation: 1200ms in parallel with the 600ms spread (see §8.4). On
exit, camera reverses to the pre-focus position + target.

#### 5.6.4 Exit triggers (any one exits)

- Re-tap the focused cluster's pill (current toggle behavior preserved)
- Tap a **different** cluster pill (exit + immediate re-enter on the new one)
- **ESC** key
- Click / double-click on background (empty 3D scene space)
- Engaging α-mode (double-click / long-press a member, or a search-bar
  selection): cluster-focus exits **first**, then α-mode engages
- Switching mode picker from 3D → 2D

#### 5.6.5 Interaction matrix

| Other feature | Behavior under cluster-focus |
|---|---|
| α-mode (§6) | **Mutually exclusive.** Engaging α-mode exits cluster-focus first. |
| Filter pills (§7) | Compose. Focused-cluster members must also pass active-filter intersection to render. |
| Cluster tour (§8.1) | Pauses on pill tap (per §8.5). Resumes after `idleResumeMs` idle. |
| IngredientPanel (§9) | Single-click on a focused-cluster member opens panel WITHOUT exiting cluster-focus. |
| Mode picker (§2) | 3D only. 2D mode click → fly-to-centroid as today, no isolate/spread. |
| `prefers-reduced-motion` | Both transforms snap (no animation). |

#### 5.6.6 Acceptance

- [ ] Tapping a joystick cluster pill hides every non-focused cluster's
      nodes, sprites, edges, and pills within one animation cycle.
- [ ] Min nearest-neighbor distance among focused-cluster members after
      spread is ≥ `1.5 × (2 × node_radius)`.
- [ ] Cluster centroid stays fixed across enter/exit.
- [ ] All 4+ exit triggers (re-tap, different-pill, ESC, background)
      land the user back at canonical positions + framing.
- [ ] α-mode engage forces cluster-focus exit before α-mode rings spawn.
- [ ] 2D mode pill click does NOT trigger isolate/spread.
- [ ] `prefers-reduced-motion: reduce` snaps both transforms.
- [ ] No regression in α-mode, filter morph, or cluster tour.

---

## 6. Affinity Mode (α-mode)

### 6.1 What it is

When a single node is selected, the network collapses to a focal-
centered view: the selected ingredient lands on the angular segment
of the cluster it belongs to on the cluster ring (ring 1 — see §6.3
for the full 6-ring composition). The focal pulses with its
designated bucket color (the cluster segment's color), surrounded by
the 6 concentric rings of its top affinities, with the rest of the
corpus dimmed to ghost dots. Only the affinity ingredients that have
edges to the focal render; everything else is ghosted.

### 6.2 Entry triggers

α-mode engages whenever:

- `selectedNodes.length === 1` **AND**
- viewport is not mobile (mobile gets β-mode side panel; see §6.7)

Selection sources: single-click on a 3D node, or search-bar selection.

### 6.3 Ring composition (single ring)

> **Implementation status (2026-05-24 revision)**: The 2026-05-22
> "single ring" simplification was superseded by the tier-column tower
> (§6.5). Ring meshes 0/1/2/3 are now all populated as **vertical
> floors** at different Y elevations (one per native tier + Surprising).
> They share a single XZ angular footprint, so the user still reads ONE
> angular ring at the ground plane. Ring meshes 4 and 5 (cuisine, season)
> remain allocated but unused. Re-enabling the original 6-axis radial
> layout would still be a one-constant toggle but is no longer the
> default lever — the tier-column design replaced it.

α-mode renders **one angular ring** at the XZ plane, with affinities
stacked vertically above it as 4 floors (§6.5). The ring's angular
axis matches the active filter pill; when no filter is active, the
ring divides by **network cluster** (the "None" default).

| Filter state | Angular axis | Segments | Source |
|---|---|---|---|
| **None (default)** | Network cluster | 14 (gapped ids) | `cluster_labels_v3.json` |
| Aroma pill | Aroma (Tier-1) | 5 | `BRISCIONE_AROMA` |
| Taste pill | Taste (Tier-2) | 7 (salty hidden) | `BRISCIONE_TASTE` |
| Family pill | Family | N | `categoricalAxes.js` |
| Cuisine pill | Cuisine | N | `categoricalAxes.js` |
| Season pill | Season | 4 | `categoricalAxes.js` |

The ring is divided into angular segments equal to the number of
buckets on the active axis. **Each segment is drawn as a filled
annular sector** (innerR=0 → outerR=ring radius + 8u border) at
opacity 0.30, in the bucket color — read as a faint background tint
behind the affinity spheres, not a solid wash. `renderOrder=-1` on
the segment mesh prevents z-fighting with the affinity spheres above.
The angular order of segments is fixed per axis so the same bucket
sits at the same clock position across pivots — important for visual
continuity when re-pivoting.

### 6.4 Focal placement

**The focal ingredient sits ON the ring at the angular position of
its own bucket on the active axis.** With no filter active, that
means the focal sits in its CLUSTER segment. It does NOT sit at the
center of the wheel. The focal sphere **pulses** in its bucket
color (the segment's color) — a 1.4s breathing cycle so the user
can identify the focal at a glance.

This makes the focal's identity discoverable at a glance — you can see
which cluster owns this ingredient before reading any affinities. The
center of the wheel stays empty (camera focus point only).

### 6.5 Affinity placement (tier-column layout)

The focal's affinities are sampled from **two separate ranking
pipelines** and rendered as a 4-floor tower above the ring plane.
**Three native tiers** (★★★ / ★★ / ★) come from the tier-scoring
function in `affinityTiers.js`; the **fourth floor (♢ Surprising)**
comes from a separate `surprisingAffinities()` query, deduplicated
against the three native-tier entries.

**Native tiers** (top 3 per tier from `topAffinities()`):

| Tier | Label | Count | Y elevation | Mesh shape | Source |
|---|---|---|---|---|---|
| ★★★ | Chemistry (compound-bridged or ≥ quantile-0.99) | 3 | +24 | bipyramid | `byTier[3]` |
| ★★ | Strong (≥ quantile-0.90) | 3 | +16 | cylinder | `byTier[2]` |
| ★ | Good (≥ quantile-0.50) | 3 | +8 (ring plane) | sphere | `byTier[1]` |

**Surprising floor** (computed independently):

| Tier | Label | Count | Y elevation | Mesh shape | Source |
|---|---|---|---|---|---|
| ♢ | Surprising (compound-bridged, low strength) | up to 3 | **+32 (top)** | star | `surprisingAffinities(focal, ctx, { N: 12 }).slice(0, 3)` after dedup against tiered names |

That's **up to 12 ingredients total** — 9 from native tiers + up to 3
deduped Surprising entries. The Surprising count can fall short of 3
when the bridge-compound pool is small for this focal, OR when ♢
candidates collide by name with native-tier picks (the dedup keeps the
native-tier entry and drops the Surprising one).

The XZ position of each affinity comes from the shared cluster wedge
layout (or filter axis when a pill is active); the Y position is set
by its native tier (or +32 for Surprising). Each tier uses its own
tier-shaped InstancedMesh so the user reads tier by SHAPE in addition
to elevation. An affinity with `bucket=null` falls back to the
`_other` segment.

Within a tier+bucket cell, multiple affinities pull radially inward
so they don't collide (closer to wheel center = subsequent stack
slot). 3D edges from focal→affinity are HIDDEN in tier-column mode —
the vertical separation by tier conveys the focal→affinity
relationship without needing radial lines.

### 6.6 Edge tier coloring (unchanged from v1)

Edges from focal to each affinity still color by native tier:

- **★★★ (gold)**: meets strict compound-bridged tier criteria (§6.4)
- **★★ (silver)**: meets strict ★★ OR lenient ★★★
- **★ (bronze)**: meets ★ criteria

Edge color is independent of which ring an affinity sits on.

### 6.7 Tier scoring (native tier of each affinity)

Two rule sets, picked per-pair by data availability:

**Strict (compound-bridged)** — applies when both nodes have GNN
compound data **AND** the pair has an entry in `bridge_compounds.json`:

| Tier | Condition |
|---|---|
| ★★★ | shared bridge compounds ≥ 3 AND strength ≥ quantile-0.99 |
| ★★ | shared bridge compounds ≥ 1 AND strength ≥ quantile-0.90 |
| ★ | strength ≥ quantile-0.50 |

**Lenient (strength-only)** — applies when ≥1 node lacks GNN data
or the pair has no compound bridge entry:

| Tier | Condition |
|---|---|
| ★★★ | strength ≥ quantile-0.99 |
| ★★ | strength ≥ quantile-0.90 |
| ★ | strength ≥ quantile-0.50 |

**Quantiles are recomputed at data-load over the actual pairings
distribution.** Literal numeric thresholds (0.7/0.4/0.2) admitted 51%
of pairs as ★★★ in practice — useless. Quantile-based admits ~1%/10%/
50% which gives real discrimination. [§13 U1]

### 6.8 Exit triggers

α-mode exits when:

- ESC key
- Click on the focal node again
- Double-click ingredient
- Double-click / tap background
- Switching to multi-select (e.g., picking a second ingredient via
  shift-click) — α-mode suspends; "Common pairings" UX takes over.
  α-mode resumes when selection collapses back to single.

### 6.9 Re-pivot

Single-click a different ingredient → smoothly re-center camera and
re-spawn affinity rings around the new focal. No mode transition needed.

### 6.10 Mobile β-mode

On mobile viewport, instead of 3D rings, render a side-panel "Flavor
Bible page" with 3 column sections (★★★ | ★★ | ★) listing affinity
names with strength. No 3D ring animation; α-mode's focal-orbit
camera (§8.3) does not engage on mobile.

### 6.11 Filter-aware affinity selection

When a filter pill is active, α-mode **continues to engage on
selection** and the top-3-per-tier candidate pool is filtered:

1. **Axis membership** — a candidate must have a non-null bucket on
   each active filter's axis (e.g., aroma filter on → candidate must
   have at least one Tier-1 aroma).
2. **Picked bucket** — if the joystick has selected a specific bucket
   within the most-recent filter axis (e.g., aroma → "fruity"),
   candidates must be IN that bucket.

The candidate pool from `topAffinities` is expanded (60 per rank
instead of 30) so the post-filter top-3-per-tier stays populated
under restrictive filters. If a tier ends up with < 3 matches, that
tier's column is sparse (no out-of-filter backfill).

When no filter is active, the candidate pool is the full corpus
ranking (same as v1 behavior).

### 6.12 Kill switch

URL param `?affinity=v0` disables α-mode (and β-mode) entirely. Used
for emergency rollback.

### 6.13 Acceptance

- [ ] Single-click → IngredientPanel opens (no α-mode); long-press OR double-click → α-mode engages within 200ms
- [ ] One angular ring renders at the XZ plane; with no filter, the ring divides by cluster
- [ ] Each segment is drawn as a filled annular sector (innerR=0 → outerR=ring radius + 8u) at opacity 0.30 in the bucket color
- [ ] Focal sits on the ring at its own bucket-segment (cluster segment when no filter) — NOT at the wheel center
- [ ] Focal pulses with its bucket color (not white)
- [ ] Top 3 affinities per native tier (★★★ / ★★ / ★) render as a 3-floor sub-tower above each bucket — Y elevations 24 / 16 / 8, shapes bipyramid / cylinder / sphere
- [ ] Up to 3 Surprising (♢) affinities render at Y=+32 as stars, sourced from `surprisingAffinities()` and deduplicated against native-tier names (may be < 3 when the bridge-compound pool is small or all ♢ candidates collide by name with native picks)
- [ ] 3D focal→affinity edges are HIDDEN in tier-column mode (the vertical tier separation conveys the relationship)
- [ ] Cone-overlay (SVG) cone colors gold (★★★) / silver (★★) / bronze (★) / fuchsia (♢) by native tier
- [ ] Re-pivot animates smoothly (no flicker)
- [ ] ESC closes the IngredientPanel and exits α-mode together (single ESC = full clear); double-click background also exits both
- [ ] Multi-select suspends; collapse-to-1 resumes
- [ ] Mobile β-mode renders side panel, not 3D rings
- [ ] `?affinity=v0` disables both α and β

---

## 7. Filter pills + breadcrumb

### 7.1 Pill row

```
[None] [Aroma] [Cuisine] [Season] [Family] [Taste]
       [Cocktail Scope] [Sauce Scope] [Flavor Graph]
```

8 filters + None. Each pill toggles a filter on the **filter stack**.
The three scope filters — `cocktail-scope`, `sauce-scope`,
`flavor-category` (labelled "Flavor Graph") — are axis-null
visibility-only filters that do NOT drive position morph (§7.3); the
first five filters (aroma / cuisine / season / family / taste) are
layout-driving.

### 7.2 Visibility predicate

Strict AND-intersection:

```
isVisible(node) = filterStack.every(f => bucketOf(f, node) !== null)
```

A node renders only if it has a value for every active filter.
Multi-select (2+ pills active) AND-intersects.

### 7.3 Pill behavior by category

**Layout-driving filters** (`aroma`, `cuisine`, `season`, `family`, `taste`):
- When activated, the 3D scene morphs node positions from the current
  layout to a categorical axis layout indexed by the filter (via
  `posForMode[axis]`).
- **Bucket centroids are v3-derived (Phase-1 of Interpretation B,
  2026-05-24).** Each bucket's centroid is the mean of its members'
  v3 UMAP positions (via `morphTargets.resolveBucketCentroid`); sparse
  buckets (< 5 members) fall through to a synthetic pole at
  `v3BoundingRadius × 0.65`. Members are placed in a phyllotaxis disc
  around the centroid (unchanged). The morph TARGET now traces back
  to v3 chemistry space rather than a hand-tuned synthetic ring at
  radius 90. Phase-2 (Spec
  `.omc/specs/deep-interview-v3-derived-morph-targets.md`, still
  pending approval) will replace the 8 legacy mode keys + per-axis
  position files and rewire the cluster-tour adapter.
- The joystick lets the user pick a specific bucket within the filter
  (e.g., "Fruity" within Aroma).

**Scope filters** (`cocktail-scope`, `sauce-scope`, `flavor-category`):
- Do NOT drive morph. Layout stays at `flavor3D` / `flavor2D` (the v3
  layout).
- If both a scope filter AND a layout-driving filter are active, the
  layout-driving filter wins.
- Deactivating the layout-driving filter while scope remains: layout
  falls back to the previous non-scope filter, or to v3 if none.

### 7.4 Empty intersection

When the intersection of all active filters is empty, the renderer:
- Freezes the current layout (no morph spasm)
- Renders an overlay: "No ingredients match these filters"
- Provides a "Clear filters" button in the overlay

[supersedes earlier "morph still runs to empty wheel" — §13]

### 7.5 Breadcrumb display

When 1+ filter pill active, a breadcrumb renders above the network:

`All › <Filter1Name> › <Filter2Name> › <ActiveBucketLabel>`

Only the **tail (most-recently-active) filter** displays its picked
bucket. Earlier filters show axis name only. Example: stack
`['cuisine', 'season', 'aroma']` + picked "Fruity":

`All › Cuisine › Season › Fruity`

[supersedes earlier "All › European › Summer › Fruity" spec — §13]

### 7.6 Filter + α-mode interaction

Per §6.8: α-mode rings only include affinities passing the filter
visibility predicate.

### 7.7 Acceptance

- [ ] All 8 pills + None render correctly (5 layout-driving + 3 scope)
- [ ] AND-intersection visibility correct on multi-select
- [ ] Layout morphs only for non-scope filters
- [ ] Scope filters compose visibility without morph
- [ ] Empty intersection freezes + shows overlay
- [ ] Breadcrumb tail-only display matches §7.5

---

## 8. Camera animator

### 8.1 Cluster tour (auto on view-load)

Engages automatically on first arrival at Explore → Network 3D, after
the data load resolves and the splash screen dismisses.

The v2 tour (current implementation) is a **continuous orbit** around
`controls.target` at the camera's existing radius and elevation. The
camera walks azimuth at a fixed lap rate; it does not glide-and-dwell
on individual clusters. The previous v1 dwell-and-glide pattern only
shifted the camera marginally per cluster — user feedback drove the
switch to a true rotation around the model. (See `CameraAnimator.js`
lines 13-21 for the migration note.)

Lap durations (from `CameraAnimator.DEFAULTS`):

- **Network desktop**: `tourLapSecDesktop = 60` (sec/lap)
- **Network mobile**: `tourLapSecMobile = 90` (sec/lap, slower for battery)
- **Cocktail Lab**: 42 sec lap (7 families)
- **Sauce Lab**: 60 sec lap

The tour is mode-agnostic: it works in `flavor3D` / `flavor2D` /
`neural` / `taste2d` / Cocktail / Sauce, because the orbit pivot is
`controls.target` rather than a per-mode centroid array. When ML-mode
centroids are available (ml / ml2d) the network adapter still returns
them and the pivot defaults to the centroid-mean; otherwise the
adapter returns `[]` and the orbit pivots around `controls.target`.

Per-cluster dwell/brighten/label-pop effects from the v1 tour are
**no longer fired** — the tour reads as ambient rotation, not a
guided per-cluster spotlight.

### 8.2 Resume after interrupt

If the user interacts (mouse/touch), the tour pauses. After **60 sec**
of no interaction, the tour resumes from the **cluster nearest the
current camera position** (not from the cluster it was on when
interrupted). (Original camera-animations spec said 30s; user feedback
during early integration found that too short after picking a cluster
label; bumped to 60s — `idleResumeMs` in `CameraAnimator.js`.)

### 8.3 Focal orbit (α-mode camera)

When α-mode engages, camera switches to a **60° elevation orbit at
distance 75** around the focal node:

- Desktop: 25 sec / lap
- Mobile: 30 sec / lap (slower for less motion sickness)
- Continuous loop until α-mode exits
- Affinity rings remain fully visible throughout

Focal orbit **replaces** any prior α-mode static top-down flight. The
orbit is the canonical α-mode camera behavior. [§13]

### 8.4 Cluster focus camera (joystick pill → isolate + spread)

When the user taps a **joystick cluster pill** (§5.6 entry), CameraAnimator
engages a `engageClusterFit(centroid, spreadRadius)` flight:

- Eased fly to `centroid` over **1200ms** (matches `flyToFocalMs`).
- Final distance computed from the post-spread bounding sphere so the
  cluster fills ~60% of viewport height (§5.6.3 formula).
- Runs in parallel with the 600ms member-spread transform (§5.6.2).
- The pre-focus camera position + target are snapshotted into
  `cameraSnapshot` so exit can reverse exactly.

On any exit trigger (§5.6.4), CameraAnimator reverses the flight over
1200ms back to `cameraSnapshot`.

*Note: clicking the cluster's label sprite (§5.4) is still inert; only
the joystick pill triggers cluster-focus.*

### 8.5 Cancellation semantics

User interaction (mouse drag, touch) cancels any animation via
`controls.enabled = false` (not by polling). On `recordInput()`, the
animator syncs `controls.target` then sets `controls.enabled = true`
to avoid damping snap.

### 8.6 Reduced motion

`prefers-reduced-motion: reduce` opts the user out of:
- Cluster tour
- Focal orbit
- Particle flow
- Bloom pulsing

Static camera behavior only.

### 8.7 Acceptance

- [ ] Cluster tour engages on first load
- [ ] Tour pauses on interaction
- [ ] Tour resumes from nearest cluster after 60s idle (`idleResumeMs`)
- [ ] Focal orbit engages on α-mode
- [ ] Focal orbit cancels on user input via `controls.enabled` toggle
- [ ] `prefers-reduced-motion` honored across all animation paths

---

## 9. IngredientPanel

### 9.1 Render trigger

Opens when a node is selected (also engages α-mode per §6). Closes
when α-mode exits.

### 9.2 Content sections (in order)

IngredientPanel ships in **two render paths** in `IngredientPanel.jsx`:
the **embedded** path (used inline within other surfaces) and the
**desktop side-panel** path (used when rendered as the main drilldown
panel). They differ in section ordering and which sections appear.

**Desktop side-panel path** (`IngredientPanel.jsx` line 815+):

1. **Header**: close button + ingredient name + favorite toggle.
2. **Properties** (chips): `taste` (color-coded by taste blending),
   `aroma` (when `node.flavorGraph?.tier1` is non-empty, joined with
   commas), `weight`, `volume`, `season` (when available).
3. **Flavor Graph** (collapsible, default open):
   - 4 rows: Aroma / Taste / Mouthfeel / Leaves
   - Each row shows chips for the tier's tokens
   - **TierBadge** renders next to any token that appears at multiple
     tiers (currently only "pungent" appears at both Tier-2 and
     Tier-3). Badge shows tier number + a11y label "Tier-2 taste" /
     "Tier-3 mouthfeel".
   - For chef-curated rows, footer text: "Chef-curated — verified
     flavor graph from the top-209 corpus."
4. **Molecular Profile** (collapsible, default closed): per-ingredient
   GNN entropy probabilities thresholded against
   `ingredient_profile_thresholds.json`. Top ~15% per trait. Includes
   the **Predicted from Components** styled card when the ingredient
   is a compound food synthesizing its profile from constituents (apple
   sauce, mayonnaise) — the badge is rendered inside this section, not
   as a separate top-level section.
5. **Profile Radar** (swipeable): Taste / Aroma / Combined radar charts.
6. **Cuisines** (collapsible, when set).
7. **Shared Molecules** (conditional, when exactly 2 ingredients are
   selected): chemistry explanation of the molecular overlap.
8. **Taste Gap** (conditional callout, when one taste dominates the
   pairing imbalance).
9. **Common Pairings** (multi-select) OR **Top Pairings** (single-select):
   the larger of the two interaction lists depending on selection state.
10. **Affinities** (collapsible, when set): α-mode tier list.
11. **Tips** (collapsible, when set).
12. **Build a recipe CTA**: CTA button to Build tab pre-loaded with
    this ingredient.

**Embedded path** (`IngredientPanel.jsx` line 380-740): same Flavor
Graph + a **Flavor Cluster** section (cluster label + brief
explanation when `clusterExplanation` is available; in v3 mode only
the cluster label renders) + Cuisines + Top Pairings + Affinities +
Tips. The Molecular Profile / Profile Radar / Shared Molecules / Taste
Gap sections are not part of the embedded path.

### 9.3 Compound-food predictions

The compound-food gap-fill logic lives at **`src/data/compoundFoods.js`**
(constituent map + aggregation). `useProData` merges synthesized aroma
profiles into the data store for compound foods (apple sauce, mayonnaise,
vinaigrette) before `categoricalWheelPositions` is computed. The merge
applies a **"Predicted from Components"** badge inside the Molecular
Profile section (§9.2 item 4) so users can distinguish synthesized
profiles from native GNN predictions.

> A previously-planned build-time pipeline at
> `chemDataset/scripts/09-predict-compound-foods.mjs` was not shipped;
> the in-app `compoundFoods.js` path replaced it.

Coverage target: ≥ 800 of the 1,123 hub-gap ingredients should have a
synthesized profile.

[history: a build-time pipeline was originally specced as the canonical
timing, but the as-shipped path is the in-app `compoundFoods.js` merge
at data-load. See §13.2 amendment #9.]

### 9.4 Acceptance

- [ ] Panel opens on selection, closes on α-mode exit
- [ ] Aroma chip renders when tier1 known
- [ ] TierBadge disambiguates dual-tier tokens (pungent)
- [ ] Predicted-from-components badge renders for ≥ 800 hub ingredients
- [ ] Chef-curated footer renders for the 209 chef rows

---

## 10. Feature flags

### 10.1 `FN_FLAVOR_V3`

**Default**: **ON everywhere** (web + iOS) as of 2026-05-24. Web was
previously OFF (soak gate) and was flipped after the chef-approved
research pass landed 25 cluster-classified ingredients + 44 aliases
into the v3 corpus. iOS has been ON since v3 first shipped.

**Opt out (v2 fallback)** — primary escape hatch now that v3 is the
default:
- `localStorage.setItem('FN_FLAVOR_V3', 'false')` (per-browser)

**Force on explicitly** (no-op vs default but kept for parity):
- `localStorage.setItem('FN_FLAVOR_V3', 'true')` (per-browser)
- `VITE_FN_FLAVOR_V3=true npm run build` (build-time)

**When ON**: useProData fetches v3 artifacts
(`flavor_positions_v3.json`, `flavor_positions_2d_v3.json`,
`cluster_labels_v3.json`, `flavor_graph_data_v3.json`) instead of v2.
The flag also gates the cluster-color path (§3.1).

### 10.2 `affinity` URL param

`?affinity=v0` disables α-mode + β-mode (kill switch).

### 10.3 No other feature flags

This spec does NOT define any other feature flag. Kill switches for
specific sub-features (cluster tour, focal orbit, etc.) live in the
runtime config via `prefers-reduced-motion` only.

---

## 11. Performance + accessibility

### 11.1 Frame rate targets

- **Desktop**: 60 fps with all animations (cluster tour, focal orbit,
  particles, bloom)
- **Mobile**: 30 fps with throttled particle density and reduced bloom
  (0.6× intensity)

### 11.2 Bundle size

- Web: dist + brotli ≤ 50 MB total (current: ~35 MB)
- iOS: post-strip bundle ≤ 200 MB (current: ~148 MB)

### 11.3 Accessibility

- `prefers-reduced-motion: reduce` → all animation off (cluster tour,
  focal orbit, particle flow, bloom pulsing)
- Keyboard navigation: ESC fully clears selection (closes panel + exits α-mode + exits cluster-focus); slash focuses the search bar; arrow keys cycle modes
- Screen-reader: TierBadge has a11y label per §9.2
- Color: minimum 3:1 contrast for cluster colors against background
  `#0a0a0f`

---

## 12. Out of scope / non-goals

The following are explicitly **not part of the current spec** and will
not be addressed without a new spec round:

- **Modifying `BRISCIONE_TASTE` or `BRISCIONE_AROMA` palettes** — locked
- **User-editable flavor graph** — chef-curated CSV is the source; no
  in-app editing
- **Cross-language flavor vocabulary** — English only
- **Saved-filter-preset persistence** — deferred to v2
- **5th tier or further taxonomy split** — locked at 4 tiers
- **`salty` and `odor_spicy` UI surfacing** — confirmed structural
  ceilings in the GNN, never shown
- **A "Predicted Profile" section for compound foods that lack a
  GNN-pre-computable profile** — synthesized from components instead
- **Tier1 vocabulary expansion** — frozen at 5 terms per Q7
  (`fruity`, `floral`, `green`, `woody`, `fatty`) for v3 data pipeline;
  `BRISCIONE_AROMA` retains its 6-term palette (including `spicy`) for
  the UI color path
- **Mode picker beyond `[3D, 2D]`** — locked at 2 entries (legacy 8-mode
  cycle is internal only)

---

## 13. Source spec lineage

This canonical spec consolidates the following source files. Where a
source disagrees with this spec, **this spec wins**. Notable amendments
are listed inline with [§13] markers in the body above.

### 13.1 Primary sources

| Source spec | Status |
|---|---|
| `.claude/.ralph-spec.md` (Flavor Model Expansion N+1) | Superseded by §3, §4, §5, §9 |
| `.omc/specs/deep-interview-flavor-affinity-mode.md` | Superseded by §6 (U1+U4a applied) |
| `.omc/plans/ralplan-flavor-affinity-mode.md` | Implementation source; spec text reflected in §6 |
| `.omc/specs/deep-interview-network-filter-consolidation.md` | Superseded by §7 (amendments 1+2 applied) |
| `.omc/plans/ralplan-r16-network-filter-consolidation-plan.md` | Implementation source for §7 |
| `.omc/specs/deep-interview-camera-animations.md` | Superseded by §8 (mode-cycle updated to 2-entry) |
| `.omc/plans/ralplan-camera-animations.md` | Implementation source for §8 |

### 13.2 Resolved amendments (locked herein)

1. **MODE_CYCLE** = `['3D', '2D']` (2 entries). The 8-mode legacy cycle
   is internal axis-key only. [§2.1]
2. **Color precedence**: filter-bucket > cluster > Tier-1 aroma > taste
   > neutral gray. They coexist via priority, not exclusion. [§3.1]
3. **α-mode rings by strength rank** (U4a). Edge color reflects native
   tier independently. [§6.3, §6.4]
4. **Quantile thresholds for tier scoring** (U1). Literal numeric
   thresholds are abandoned. [§6.4]
5. **Breadcrumb tail-only bucket display**. Earlier filters show axis
   name only. [§7.5]
6. **Scope-filter morph fallback**: scope filters never drive morph;
   layout stays at the previous non-scope filter or v3. [§7.3]
7. **Empty intersection**: freeze + overlay, not "morph to empty wheel".
   [§7.4]
8. **Focal orbit replaces α-mode static flight**. [§8.3]
9. **Compound-food predictor: data-load merge via `src/data/compoundFoods.js`**,
   NOT a build-time sidecar. (The previously-planned build-time pipeline
   at `chemDataset/scripts/09-predict-compound-foods.mjs` was not shipped.
   The runtime merge replaced it.) [§9.3]
10. **Cluster focus (joystick pill → isolate + spread)**: tapping a
    joystick cluster pill hides every non-focused cluster's nodes /
    sprites / edges / pills and radially fans the focused cluster's
    members outward via adaptive per-cluster spread factor (target
    nearest-neighbor distance ≥ `1.5 × node diameter`). Camera flies +
    re-fits over 1200ms; spread eases 600ms. **Intra-focused-cluster
    edges (§4.2 exception) render with §4.3 tier colors via a secondary
    LineSegments mesh owned by `ClusterFocusMode`; vertex positions
    track the spread animation in real time and opacity fades in/out
    with the same easing.** Mutually exclusive with α-mode. 3D only
    Phase 1. [§3.1 priority 0, §4.2 exception, §5.6 full spec, §8.4
    camera. Source:
    `.omc/specs/deep-interview-cluster-focus-isolate-spread.md`]
11. **v3-derived bucket centroids (Interpretation B Phase 1, 2026-05-24)**:
    bucket centroid placement in `computeCategoricalWheelPositions` is
    now derived from v3 UMAP positions (mean of bucket members' v3
    positions; synthetic-pole fallback at `v3BoundingRadius × 0.65`
    for sparse buckets `< 5` members). The morph TARGET traces back to
    v3 chemistry space rather than a fixed synthetic ring at radius 90.
    Member placement around each centroid remains phyllotaxis.
    Phase-2 cluster-tour adapter rewire shipped 2026-05-25 (canon §8.1
    — adapter reads `cluster_labels_v3.json` centroid_3d directly,
    mode-agnostic). Remaining Phase-2 work (8 legacy mode keys +
    `posForMode` purge + per-axis position files) deferred. [§7.3.
    Source: `.omc/specs/deep-interview-v3-derived-morph-targets.md`]
12. **Primary Tier-1 aroma drives node color (N1-D5, 2026-05-25)**:
    §3.1 precedence inverted — `BRISCIONE_AROMA[primaryTier1]` now
    wins over `clusterColor`. Chef T1[0] for 89 verified ingredients;
    `gnnPrimaryTier1()` with calibrated `ingredient_profile_thresholds`
    for the long-tail. Cluster color falls through as defensive
    fallback when no T1 is derivable. New `flavor-category` filter
    pill restricts visibility to the 89 chef-verified ingredients
    via `matchesFlavorCategory()` (axis-null scope filter, parallel
    to `cocktail-scope` / `sauce-scope`).
    [§3.1, src/data/primaryTier1.js, src/data/flavorCategoryFilter.js]

### 13.3 Affinity examples cleanup

The original spec used `tomato+basil = ★★★` and `peel+tangerine = ★★★`
as canonical examples. Under U1 quantile thresholds + strict compound-
bridge rule, these do not exist as ★★★ pairs in `bridge_compounds.json`
— they downgrade to ★★ or are inadmissible. **Spec examples should be
rewritten against verified data pairs when this doc is next revised.**

Pending: a small `docs/affinity-example-pairs.md` companion doc with
real verified examples. (Out of scope for this revision.)

---

## How to revise this spec

When future work changes any of the above:

1. Edit this file directly
2. Bump the "Last revised" date at the top
3. Add a row to §13.2 if a new amendment is locked
4. Source specs in `.omc/specs/` and `.omc/plans/` remain as historical
   artifacts — do NOT update them
5. Update tests, code, and any external docs (e.g., onboarding) to
   match this spec, not the historical sources

When the spec is in conflict with the shipped code:

1. Check whether the code is wrong (open an issue + fix)
2. Or whether this spec is wrong (open a spec-revision PR)
3. Never silently align one to match the other — make the divergence
   explicit
