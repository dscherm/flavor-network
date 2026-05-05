# Cocktail Codex v2 — Data-Driven Family Taxonomy

**Status:** Spec (pre-notebook) · 2026-05-05
**Owner:** Dan Schermele
**Driving question:** Replace the *Cocktail Codex* book's 7 hard-coded
archetypes in `CocktailLab.jsx` with a data-driven family taxonomy that
combines (a) **Kevin Peterson's** structural framework from *Cocktail
Theory* (2024) with (b) the project's existing flavor-chemistry data
(GNN aroma probabilities, compound taste vectors, bridge compounds).

---

## 1. Problem & motivation

### Current state (audit 2026-05-05)
- `public/data/cocktail_codex.json` — 172 cocktails curated from the
  *Cocktail Codex* book. 6 root archetypes (Old Fashioned, Martini,
  Daiquiri, Sidecar, Highball, Flip) plus a 7th utility cluster
  (Syrups). 32 hand-curated subclusters.
- Visualization: 3D Fibonacci sphere, family-as-disc.
- Similarity within a family: ingredient-keyword Jaccard (no flavor
  chemistry input).
- Ingredient-level taste / aroma data exists at scale (2,790 GNN
  predictions, 612 compound taste vectors, 778 bridge-compound pairs)
  but is **never** aggregated to the cocktail level.

### Why change
1. The Codex archetypes are bartender-canonical, not flavor-grounded.
   Two cocktails in the same Codex family can taste very different
   (e.g. Negroni and Boulevardier vs. Old Fashioned in the same
   "spirit + bitter + sugar" archetype).
2. Peterson argues every cocktail decomposes into structural slots
   (spirit / sweet / sour / bitter / vermouth / liqueur) and that
   families correspond to which slots are filled. This *is*
   measurable from recipe text + ingredient flavor data.
3. We want subclusters within families to mean something — currently
   they're hand-curated narrative groupings, not derived from the data.

### Goal
Ship a 4–7 cluster taxonomy (per user constraint, see §3) where:
- Each cluster has a structural / flavor signature, not a book citation
- Top-level split recovers Peterson's two megacategories
  (Spirit + Citrus + Sweetener vs. Spirit + Amaro + Vermouth)
- Manufactured / novelty drinks are filtered out, not bucketed
- Syrups remain a non-cocktail utility group (kept separately)

---

## 2. References

- Peterson, K. *Cocktail Theory: A Sensory Approach to Transcendent
  Drinks*, 2024 (book). Nine cocktail families chapter is the
  primary anchor.
- Carroll, S. *Mindscape* podcast 307 — Peterson interview, 2025-03-03.
  Source for the "two megacategories" + Mr. Potato Head theory + the
  three lenses (physicist, perfumer, engineer).
- Project data: `public/proDataset/gnn_entropy.json`,
  `public/proDataset/compound_tastes.json`,
  `public/proDataset/bridge_compounds.json`,
  `public/data/cocktail_codex.json`,
  `public/data/cocktail_augment.json`,
  `public/data/cocktail_clusters.json`.

---

## 3. Acceptance criteria

A v2 model passes if **all** of the following hold against the held-out
validation harness in §7:

1. **K-bound:** Final cluster count K ∈ [4, 7]
2. **Megacategory recovery:** A top-level cut at K=2 splits cocktails
   into Sour-skeleton vs. Bitter-skeleton with ≥ 90% purity against
   Peterson's labels for canonical members
3. **Near-neighbor preservation:** ≥ 80% of ground-truth near-neighbor
   pairs (§7.1) land in the same final cluster
4. **Far-neighbor preservation:** 100% of ground-truth far-neighbor
   pairs (§7.2) land in *different* final clusters
5. **Outlier handling:** Manufactured-novelty drinks (Espresso Martini,
   Chocolate Martini, etc.) either filtered out by §4.2 OR labeled as
   a distinct outlier cluster, never bucketed with classics
6. **Cluster legibility:** Each final cluster has a human-readable name
   + 3–5 prototypical exemplars + a one-sentence flavor signature

---

## 4. Data sources & corpus filter

### 4.1 Inclusion whitelist (union of canonical lists)

| Source | Approx count | Status | Acquisition method |
|---|---|---|---|
| **IBA Official Cocktails** | ~88 | Not in repo | Scrape iba-world.com or pull from Wikipedia table |
| **Cocktail Codex** book | 172 | ✓ Already in repo | `public/data/cocktail_codex.json` |
| **PUNCH Essential Cocktails** | ~1,000 | Not in repo | Scrape punchdrink.com tag pages |
| **Death & Co Modern Classic Cocktails** | ~500 | Not in repo | Death & Co book index — manual list |
| **Difford's Guide** top-rated | ~200 | Not in repo | Scrape diffordsguide.com top-100 |

Union after dedup: estimated **~1,100 unique cocktails**.

### 4.2 Hard exclusion rules

Apply *after* dedup. Reject cocktails where any of:

```
1. Base spirit is a flavored / cream liqueur
   (Baileys, Kahlúa, creme de cacao, Frangelico, Disaronno used as base)
2. Name matches /shot|shooter|bomb|test tube|jello|jelly|slushie/i
3. Name ends in "tini" but isn't an authentic Martini / Vesper /
   Gibson / Gimlet variant
4. Total ingredient count ≤ 2  (it's a poured drink, not a cocktail)
5. Sweetener count ≥ 3
   (counting: simple syrup, grenadine, liqueur-as-sweetener,
    fruit juice with added sugar, flavored vodka)
6. Energy-drink + spirit + sugar combinations
7. Manual override blocklist:
   - Espresso Martini  (modern manufactured-coffee, defer to v1.1)
   - Long Island Iced Tea  (kitchen-sink, breaks slot model)
   - Lynchburg Lemonade (more soda than cocktail)
   - Sex on the Beach + cousins (manufactured-novelty)
```

Rules 1, 2, 3, 6, 7 are deterministic regex / list lookups.
Rules 4, 5 require ingredient parsing per §5.1.

### 4.3 Engineering variables (manual curation — Q2 = option (a))

For each surviving cocktail, hand-curate four engineering variables.
Output: `data/cocktail_engineering.csv` with columns:

| col | values | rationale |
|---|---|---|
| `build_method` | shake / stir / build / blend / swizzle / throw | Determines aeration + dilution profile |
| `ice_format` | up / rocks / crushed / block / none | Affects dilution + temperature |
| `aeration` | high / medium / low | Egg-white, vigorous shake = high; stir = low |
| `glass_type` | rocks / coupe / martini / highball / collins / wine / mug | Cultural signal correlates with family |

Tagging effort: ~1,100 cocktails × ~10 sec = ~3 hours focused work.
Source-of-truth tie-breakers: IBA recipe → Cocktail Codex → Death & Co.

### 4.4 Syrups carve-out

The 3 cocktails currently in the Codex `Syrups` cluster are kept as a
separate non-cocktail utility group. They do not enter the clustering
pipeline. Their use as ingredients in other cocktails is unaffected.

---

## 5. Feature engineering

### 5.1 Structural slot detection

Build `data/cocktail_ingredient_slots.csv` mapping every unique
ingredient in the filtered corpus to one of seven slots:

| Slot | Examples |
|---|---|
| `spirit` | gin, vodka, whiskey-family, rum-family, tequila, mezcal, brandy, calvados, eau-de-vie |
| `sweet` | simple syrup, demerara, honey syrup, agave, grenadine, orgeat, gum syrup |
| `sour` | lemon, lime, orange, grapefruit, yuzu (citrus & acid sources) |
| `bitter` | angostura, peychauds, orange bitters, mole bitters, celery bitters |
| `vermouth` | sweet vermouth, dry vermouth, blanc vermouth, bianco vermouth |
| `amaro_liqueur` | Campari, Aperol, Fernet, Cynar, Suze, maraschino, Chartreuse, curaçao, amaretto |
| `aromatic` | citrus twist, mint, basil, rosemary, smoked salt rim |

Each ingredient gets exactly one slot. Edge cases (St-Germain,
Bénédictine, sherry) get assigned to the dominant slot they fill in
practice — convention documented inline in the CSV. Roughly ~250 unique
ingredients in the filtered corpus, so ~1 hour of manual tagging
(reuse the existing `cocktail_augment.json` ingredient list as
starting point — it covers 130 of them).

### 5.2 Recipe ratio extraction

Recipes are stored as free text in three different formats across our
sources. Parse with:

```python
def parse_recipe(text: str) -> list[(amount_ml, ingredient)]:
    # 1. Tokenize on commas / newlines
    # 2. Regex extract:
    #    /(\d+(\.\d+)?)\s*(oz|ml|cl|dash|drop|splash|barspoon|tsp)/
    # 3. Convert all units to ml
    # 4. Strip prefixes ("fresh", "cold", "1 part") via the existing
    #    normalizeIngredient() in src/utils/cocktailCodex.js
```

Output per cocktail: a list of `(amount_ml, slot, ingredient)` rows.

### 5.3 Per-cocktail taste vector (volume-weighted)

For each cocktail, compute an 11-dim taste/aroma vector:

```
taste_vec_cocktail = Σᵢ (amount_ml_i × taste_vec_ingredient_i) / total_volume_ml
```

`taste_vec_ingredient` comes from `gnn_entropy.json`
(11-dim probability vector per ingredient, post-calibration). For
ingredients without GNN coverage (~29% of the corpus), fall back to:

1. Mean of taste vectors from `compound_tastes.json` for the
   ingredient's known compounds (via `bridge_compounds.json`)
2. If still missing, infer from category (spirit-default, citrus-default,
   etc.) — last-resort hand-curated defaults in
   `data/cocktail_taste_fallbacks.csv`

Channels: `[sweet, bitter, sour, salty, umami, odor_fruity, odor_fatty,
odor_green, odor_woody, odor_floral, odor_spicy]` per the v3 GNN
calibrated heads from `.claude/.chemdataset-status.md`. Drop salty and
odor_spicy from clustering features per the chemdataset shipping
policy (F1 ≤ 0.5).

### 5.4 Per-cocktail aroma layer signature (perfumery)

Inspired by Peterson's perfumer lens. Build
`data/cocktail_aroma_layers.csv` mapping ingredients to one of three
volatility layers:

- **Top notes** — citrus, light herbs, sparkling water, dry vermouth
  (volatile, smelled first)
- **Middle notes** — spirit body, sweet vermouth, fruit, light syrups
  (the heart)
- **Bass notes** — amaro, coffee, woody-spirit oak, demerara,
  chocolate (linger)

Per-cocktail signature: `(top%, middle%, bass%)` summing to 1.0,
weighted by ingredient volume × aroma layer.

### 5.5 Engineering features

Encode `cocktail_engineering.csv` (§4.3) as:
- `build_method`: one-hot (5–6 columns)
- `ice_format`: one-hot (4–5 columns)
- `aeration`: ordinal (low=0, medium=0.5, high=1.0)
- `glass_type`: one-hot, but collapse to 3 buckets:
  `coupe-style / rocks-style / tall-style` to avoid sparse columns

### 5.6 Final feature vector per cocktail

```
features = concat(
    structural_slot_ratios,   # 7 dims (one per slot, fraction of total volume)
    taste_vector_9dim,        # 9 (sweet + bitter + sour + umami + 5 odor heads)
    aroma_layer_signature,    # 3 (top/middle/bass %)
    engineering_onehots,      # ~12 (build × ice × aeration × glass-bucket)
)
# Total: ~31 dims
```

Standardize each block to zero-mean unit-variance before clustering
(z-score within block, not globally — keeps slot ratios from being
dominated by taste channels).

---

## 6. Clustering method

### 6.1 Candidate algorithms

Run **all three** in the notebook; pick winner per §6.3.

1. **K-Means with silhouette sweep**
   - Sweep K = 4 .. 7
   - Score each K by silhouette + ground-truth pair preservation
2. **Hierarchical (Ward linkage)**
   - Cut at K=2 to verify megacategory recovery
   - Cut at K=4..7 for sub-families
   - Provides interpretable dendrogram
3. **HDBSCAN on UMAP-reduced features**
   - UMAP to 5-10 dims (preserve global structure)
   - HDBSCAN with `min_cluster_size = 15`, `min_samples = 5`
   - Lets K emerge; clamp final K to [4, 7] by merging smallest
     clusters until in range

### 6.2 Megacategory anchor

Before running clustering, pre-compute a binary `megacategory` label
for each cocktail using a deterministic rule:

```
if has_slot('sour') and has_slot('sweet') and has_slot('spirit'):
    return 'sour_skeleton'
elif has_slot('vermouth') or (has_slot('amaro_liqueur')
                              and not has_slot('sour')):
    return 'bitter_skeleton'
else:
    return 'unclassified'
```

This label is held out of the feature vector and used only as a
ground-truth tester (criterion §3.2).

### 6.3 Selection criterion

```
score(model) = 0.4 * silhouette_score
             + 0.4 * ground_truth_pair_preservation_rate
             + 0.2 * megacategory_purity_at_K=2
```

Tie-break by interpretability — pick the model whose cluster medoids
are more recognizable as canonical drinks.

---

## 7. Validation harness

### 7.1 Near-neighbor pairs (must land in same cluster)

Cocktails that share the structural skeleton with one ingredient swap.
Acceptance: ≥ 80% in same final cluster.

| Pair | Skeleton |
|---|---|
| Negroni ↔ Boulevardier | spirit + Campari + sweet vermouth (gin / whiskey swap) |
| Manhattan ↔ Rob Roy | whiskey + sweet vermouth + bitters (rye / scotch swap) |
| Daiquiri ↔ Gimlet | spirit + lime + sweet (rum / gin swap) |
| Daiquiri ↔ Margarita | spirit + lime + sweet (rum / tequila swap) |
| Whiskey Sour ↔ Daiquiri | spirit + citrus + sweet |
| Old Fashioned ↔ Sazerac | spirit + sugar + bitters (whiskey + absinthe rinse) |
| Martini ↔ Gibson | gin + dry vermouth (olive / onion garnish swap) |
| Martini ↔ Vesper | gin/vodka + dry vermouth + Lillet |
| Aviation ↔ Bee's Knees | gin sour family with floral modifier |
| Mai Tai ↔ Jungle Bird | rum sour with bitter modifier |

### 7.2 Far-neighbor pairs (must land in different clusters)

Acceptance: 100% in different final clusters.

| Pair | Why different |
|---|---|
| Negroni ⊥ Daiquiri | Bitter megacategory vs. Sour megacategory |
| Old Fashioned ⊥ Daiquiri | Cross-megacategory |
| Manhattan ⊥ Margarita | Cross-megacategory |
| Espresso Martini ⊥ Manhattan | Manufactured-modern vs. classic (if Espresso Martini survives §4.2 filter) |
| Bloody Mary ⊥ Old Fashioned | Savory-sour vs. spirit-bitter |

### 7.3 Megacategory anchor recovery

The K=2 hierarchical cut (§6.1.2) must produce two clusters where:
- ≥ 90% of canonical Sour members (Daiquiri, Margarita, Gimlet,
  Whiskey Sour, Sidecar, Bee's Knees, Aviation) land in one cluster
- ≥ 90% of canonical Bitter members (Negroni, Manhattan, Old
  Fashioned, Boulevardier, Sazerac, Vieux Carré) land in the other

---

## 8. Phasing

| Phase | Deliverable | Effort | Blocked by |
|---|---|---|---|
| 1. Corpus acquisition | `proDataset/cocktails_filtered.json` (~1,100 entries) | 1–2 days | scraping access |
| 2. Engineering tagging | `data/cocktail_engineering.csv` | 3–4 hrs manual | Phase 1 |
| 3. Slot dictionary | `data/cocktail_ingredient_slots.csv` | 2–3 hrs manual | Phase 1 |
| 4. Aroma layer dictionary | `data/cocktail_aroma_layers.csv` | 1–2 hrs manual | Phase 3 |
| 5. Notebook | `flavor-gnn/notebooks/cocktail_clustering.ipynb` | 1 day | Phase 2–4 |
| 6. Findings writeup | `docs/cocktail-codex-v2/findings.md` | 2 hrs | Phase 5 |
| 7. **Ship decision** | Go / no-go on Cocktail Lab v2 implementation | 0 | Phase 6 |
| 8. (future) App ship | Replace `cocktail_codex.json` and `CocktailLab.jsx` rendering | 2–3 days | Phase 7 = go |

Total pre-ship effort: ~3–4 days of focused work, of which ~6 hrs is
manual tagging that cannot be parallelized with code.

---

## 9. Risks & open questions

1. **Scraping access.** PUNCH and Difford's may rate-limit or
   block. Fallback: hand-pick top 100 from each via their published
   "best of" lists.
2. **Engineering tagging accuracy.** Some cocktails have multiple
   acceptable build methods (e.g. Margarita: shaken or blended).
   Convention: tag the most common; document alternates in
   `data/cocktail_engineering_notes.md`.
3. **GNN coverage gap.** ~29% of ingredients have no GNN prediction
   (per `.claude/.chemdataset-status.md`). The fallback chain in §5.3
   may noise the taste vectors. Acceptable if the noise is balanced
   across clusters; problematic if all hub ingredients (which are
   uncovered) end up in one cluster.
4. **Slot ambiguity.** St-Germain is both liqueur and sweetener.
   Dry vermouth is sometimes a modifier, sometimes the bitter slot.
   Convention: pick dominant role in practice, document edge cases
   inline in the slot CSV.
5. **Cluster naming bikeshed.** Naming the resulting families (e.g.
   "Bitter Stirred", "Sour Shaken", "Citrus Highball") will require
   user judgment. Notebook will *propose* names; final naming is a
   ship-decision deliverable.
6. **K = 4–7 vs. data wants more.** If the data prefers K = 9 (matching
   Peterson's nine families), our K ≤ 7 cap forces merging. The
   findings writeup will surface this if it happens.
7. **Held-out validation overfitting.** Ground-truth pairs in §7 are
   subjective. They'll be *added to the spec doc*, not changed after
   running the notebook, to avoid cherry-picking.

---

## 10. Out of scope (this spec)

- Cocktail Lab UI redesign — covered in a separate v2.5 spec once
  Phase 7 is a go
- Cocktail recipe scoring (separate `recipeScoring.js` module —
  unaffected by this work)
- Sauce / Recipe Lab clustering — orthogonal
- Replacing the GNN model — chemdataset v3 is the source of truth
- Localization, accessibility — UI concerns, separate spec

---

## 11. Hand-off

After the notebook + findings deliver, this spec hands off to:
1. **`/oh-my-claudecode:omc-plan --consensus --direct`** to refine
   the Phase 7 implementation plan
2. **`/oh-my-claudecode:autopilot`** to execute the plan if go-ship
3. The notebook output (`cocktail_codex_v2.json` cluster assignments)
   becomes the input to the new `CocktailLab.jsx` rendering layer.

---

*Spec author: Claude Opus 4.7 (1M context) · Reviewed by: Dan
Schermele · Status: ready for Phase 1 execution*
