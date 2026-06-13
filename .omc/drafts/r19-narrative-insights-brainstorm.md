# R19 — Narrative Insights for Filter + Pull Changes

Brainstorm doc for Item 8 of the R18 refinement list. Not a spec — a
landscape of options ordered by depth (one-liner chip → cross-cluster
bridge analysis → full pairing narrative). Pick a tier; we can stack
them later if one proves useful.

## What's the user asking?

"What story does the layout tell when I apply a filter and slide pull?"

Pull = the strength of the bucket structure relative to the cooccurrence
default. The audience is chefs who already grok cooccurrence networks
but can't see the relationship between cooccurrence and the bucket
they're filtering by. The narrative has to surface that relationship,
not just label what's on screen.

## Dimensions of insight available for free

All of these are derivable from existing state (`filterStack`,
`pullStrength`, `bucketOf`, `visibleCount`, `mode`, current
cooccurrence positions). No new data, no new model calls.

1. **Bucket population.** How many ingredients sit in each pole's
   bucket. Trivial; already in `bucketOf` Map.
2. **Bucket asymmetry.** Largest vs smallest bucket. Tells the chef
   which buckets are dense vs niche.
3. **Cross-bucket bridges.** Ingredients with high cooccurrence to a
   member of a *different* bucket. These are the ones that resist the
   pull at high pull strength.
4. **Cluster ↔ bucket overlap.** For each ML cluster (when filter
   active), how many of its members fall into which bucket. Reveals
   which cooccurrence clusters align with which bucket.
5. **Intersection cardinality.** Multi-filter: "Italian × Summer ×
   Fruity = 27 ingredients."
6. **Pull-position semantics.** 0% = "what pairs together"; 100% =
   "what's labeled the same"; intermediate = tension. The slider IS a
   narrative axis.
7. **Surprising distance.** A node still far from its bucket pole at
   pull=80% is being held by strong cooccurrence ties to a different
   bucket. These are the "boundary spanners."
8. **Empty intersections.** "No ingredients are both Italian and
   Floral." Useful negative space — tells the chef where the corpus is
   thin.

## Surfacing modes

### Tier A — Single-line chip (smallest, ships fastest)

A floating chip below the breadcrumb. One sentence, updates on
(filterStack, pullStrength, visibleCount). Rotates between three
templates:

- **Filter on, pull < 30%:** "Layout shows cooccurrence pairings within
  {filter} buckets. {bucketCount} buckets, {visibleCount} ingredients."
- **Filter on, pull 30-70%:** "Tension layout — strong pairings resist
  the pull. {bridgeCount} ingredients sit between buckets."
- **Filter on, pull > 70%:** "Layout shows {filter} bucket structure.
  Largest: {topBucket} ({topCount}). Smallest: {bottomBucket}
  ({bottomCount})."
- **Multi-filter:** "{N} ingredients match {f1} × {f2} × {f3}.
  Densest bucket: {bucket}."

Cost: ~30 lines, one new component (`InsightChip.jsx`), one
`useMemo` derivation. No new data. No animation. Ships in 2 hours.

### Tier B — Pole tooltip enrichment (already half-built)

The R18 pole hover tooltip currently shows `{LABEL} N ingredients`.
Extend it with the top 3 members (by pairing count) and one
cross-bucket bridge.

- Header: `FRUITY · 412 ingredients`
- Body: `Top: strawberry · raspberry · pineapple`
- Footer: `Bridge: lemon (also Citrus, cooccurs with Basil ×127)`

Cost: ~80 lines. Add a helper in `LivingArchView` that computes the
top-N per bucket once at scene-setup; the hover handler reads from
the precomputed map.

### Tier C — Pull-slider thumb annotation

A small label *above* the slider thumb that updates as the user
drags, showing what the current pull means in plain language. Reads
like a tooltip on the thumb:

- **0%:** "Pairings only"
- **25%:** "Pairings, gently grouped"
- **50%:** "Balanced — pairings + buckets"
- **75%:** "Buckets, gently bridged"
- **100%:** "Buckets only"

Cost: ~40 lines, pure FilterPullSlider edit. No data work.

### Tier D — Bridge highlights on pull change

When pull crosses 50% (cooccurrence → bucket dominance), briefly
highlight the cross-bucket bridge ingredients (the ones that resist
the pull). Glow them for ~1.5s.

Computation: for each ingredient I in active filter's morph axis,
score = (sum of cooccurrence to ingredients in other buckets) /
(sum of cooccurrence to ingredients in same bucket). Score > 1 →
bridge. Top 20 get a glow pulse.

Cost: ~150 lines. New `bridgeRanker.js`, scene-side glow material,
threshold tracking in the existing pullStrength effect. Half-day.

### Tier E — Narrative drawer (opt-in)

A right-side drawer (similar to IngredientPanel) that surfaces:

- **Composition:** "{filterCount} active filter(s) intersecting to
  {visibleCount} ingredients."
- **Bucket distribution:** sparkline of counts per bucket.
- **Cluster overlap matrix:** small table of ML clusters × current
  buckets, with bucket counts.
- **Pull explanation:** what the current pull% means + which bridges
  are most affected.
- **Suggested next move:** "Add a Cuisine filter to narrow Fruity ×
  Summer further."

Toggle via a `?` button next to the FilterPillRow. Drawer is
collapsed by default — chefs who don't want narrative ignore it.

Cost: ~400 lines. New `InsightDrawer.jsx`, a few derived selectors,
sparkline component. 1-day build.

### Tier F — Auto-generated paragraph (LLM, deferred)

The same data as Tier E, but rendered as a 2-3 sentence paragraph
generated by a local LLM (or precomputed templates with slot fills).
Risky — adds latency, can produce wrong-sounding sentences. Park.

## Cross-bucket bridge — math sketch

Bridges are the most interesting derivation. Definition:

```
bridgeScore(node) =
   sum over (peer in graph[node].edges) of:
     edgeWeight * (1 if bucketOf(peer) != bucketOf(node) else 0)
   / total edge weight of node
```

A node with high bridgeScore in the active filter's axis is being
"pulled apart" — its cooccurrence neighbors live in different buckets.

Top bridges per bucket = the most informative ingredients to surface.
For Fruity bucket: a high-bridgeScore fruit is one that *also* pairs
heavily with non-fruity peers — e.g., **lemon** pairs with herbs,
cheeses, and fish; lemon is in Citrus aroma bucket but has the highest
cross-bucket cooccurrence in that bucket.

Surfacing rule: at pull > 60%, highlight the top 3 bridges per
visible bucket. The chef sees the *connectors* between bucket
clusters, which is the actual culinary insight.

## Recommended path

**Phase 1 (ship now, ~2h):** Tier A + Tier C.
- Insight chip below breadcrumb.
- Pull-slider thumb annotation.
- Both pure derivations, no data work.

**Phase 2 (ship soon, ~half day):** Tier B.
- Enrich pole tooltips with top-N members + one bridge.
- Reuses the bridge computation that Phase 3 will build.

**Phase 3 (a day):** Tier D + bridge ranker.
- `bridgeRanker.js` computes top bridges per bucket at scene-setup.
- Glow pulse when pull crosses 50%.
- Phase 2 tooltips read from the same ranker.

**Phase 4 (a day, optional):** Tier E narrative drawer.
- Only if Phases 1-3 land and the user still wants more context.

Defer Tier F until the static narrative proves valuable AND the
chef community asks for prose summaries.

## Open questions

1. Should the insight chip *replace* the existing Colors chip or sit
   alongside it? Argument for replacement: both chips communicate
   "what the layout means right now," so one canonical chip is less
   noisy. Argument for sidecar: Colors chip is glance-grade; insight
   chip is read-grade. Different attention levels.

2. For the cross-bucket bridge highlight (Tier D), should we *also*
   draw an edge line from the bridge node to its non-bucket peers?
   Adds clarity but reintroduces edge clutter the filter mode was
   meant to eliminate.

3. Is a chef going to read prose, or just scan stats? If the answer
   is "scan stats," Tier E becomes a sparkline + table panel, no
   sentences. Worth user-testing before building the prose version.

4. Should pull-percentage milestones (25/50/75) trigger micro-haptics
   on mobile? Probably no — gimmicky and doesn't survive into
   desktop. Skip.

## Files this would touch

Phase 1 (Tier A + C):
- `src/components/InsightChip.jsx` (new, ~80 lines)
- `src/components/FilterPullSlider.jsx` (annotate thumb, ~30 lines)
- `src/App.jsx` (mount InsightChip, ~10 lines)

Phase 2 (Tier B):
- `src/data/bucketStats.js` (new — top-N per bucket, ~60 lines)
- `src/components/LivingArchView.jsx` (enrich tooltip payload, ~20 lines)
- `src/App.jsx` (enrich tooltip render, ~15 lines)

Phase 3 (Tier D + bridge ranker):
- `src/data/bridgeRanker.js` (new, ~120 lines)
- `src/components/LivingArchView.jsx` (glow pulse trigger, ~80 lines)

Phase 4 (Tier E):
- `src/components/InsightDrawer.jsx` (new, ~250 lines)
- `src/data/clusterBucketOverlap.js` (new, ~80 lines)
- `src/App.jsx` (drawer toggle wiring, ~30 lines)
