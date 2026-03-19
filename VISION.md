# Flavor Network — Vision & Research Synthesis

## Panel of Experts
- **Neural Network Expert** — audited the actual pipeline code
- **Culinary Professor** — evaluated pedagogical gaps and creative cooking workflows
- **Data Visualization / UX Expert** — explored alternative visualization paradigms
- **ML Researcher** — surveyed state-of-the-art computational gastronomy

---

## Part 1: What We Actually Have (Honest Assessment)

### Is it a neural network?

**No.** The "neural network" is purely an aesthetic metaphor. The actual model is **statistical co-occurrence scoring** using NPMI (Normalized Pointwise Mutual Information) + log-count frequency blending across three recipe datasets.

### The exact math

```
For each ingredient pair (a, b):

1. PMI = log2(P(a,b) / (P(a) * P(b)))        # surprise vs random chance
2. NPMI = PMI / (-log2(P(a,b)))                # normalize to [0,1]
3. hybridScore = 0.65 * NPMI + 0.35 * logCount  # blend surprise + frequency
4. Normalize per source to [0,1]

Final blended strength across sources:
  0.60 * RecipeNLG (2.2M recipes)
+ 0.20 * MealDB (593 meals)
+ 0.15 * CocktailDB (426 drinks)
+ 0.05 * FlavorDB (currently 0 — API unavailable)
```

Result: **51,726 pairings across 4,488 ingredients**, each with a scalar strength in [0.02, 1.0].

### What strength actually means

A high strength means "these ingredients co-occur in recipes far more often than chance would predict, weighted toward larger datasets." It does NOT mean:
- They share flavor compounds (chemistry)
- They taste good together (sensory science)
- A chef recommends them (expertise)

It's **culinary convention, not flavor science**.

### Key limitations

| What it knows | What it can't do |
|---|---|
| "Garlic + onion appear together a lot" | "Why do they pair well?" (shared sulfur compounds) |
| Scalar strength per pair | Multi-dimensional relationship (taste bridge, texture contrast, aromatic overlap) |
| Static, precomputed scores | Adapt to context (raw vs roasted garlic are different) |
| Pairwise relationships only | Multi-hop reasoning ("if A pairs with B and B with C...") |
| Co-occurrence = convention | Novel pairings that should work but haven't been tried |

---

## Part 2: What Food Science Actually Says

### The Ahn et al. Hypothesis (2011, Nature Scientific Reports)

The foundational "flavor network" paper found:
- **Western cuisines** favor ingredient pairs that **share** volatile flavor compounds (harmony principle)
- **East Asian cuisines** actively **avoid** shared compounds (contrast principle)
- A small number of hub ingredients (butter, egg, vanilla) connect most of the network

**Implication for us:** Our model conflates these two opposite strategies into a single "strength" number. A Thai recipe using contrasting flavors scores the same as a French recipe using harmonious ones. We're missing the *why*.

### The 8 Dimensions That Actually Matter for Flavor Pairing

| Dimension | What it is | Do we model it? |
|---|---|---|
| 1. Shared volatile compounds | Chemical overlap between ingredients | No (FlavorDB planned but unavailable) |
| 2. Taste balance | Sweet/sour/salty/bitter/umami complementarity | Partially (taste labels, no balance scoring) |
| 3. Aromatic bridging | A third ingredient connects two incompatible ones | Implicit in graph topology, not surfaced |
| 4. Texture contrast | Crispy + creamy, crunchy + soft | Not at all |
| 5. Trigeminal sensations | Spicy heat, cooling, tingling | Partially (spicy/pungent labels) |
| 6. Cooking method transformation | Raw garlic vs roasted vs black garlic | Not at all |
| 7. Concentration sensitivity | Vanilla at 1% vs 10% | Not at all |
| 8. Temporal sequence | Order flavors hit the palate | Not at all |

---

## Part 3: How to Make It Actually Neural (ML Upgrade Path)

### Tier 1: Quick Wins (2-3 weeks each)

#### A. Node2Vec Graph Embeddings
Train random walk embeddings on our existing 51K-edge graph. Each ingredient gets a 64-128D dense vector instead of just pairwise scores.

**What it unlocks:**
- Multi-hop reasoning (garlic is similar to shallot even without a direct edge)
- Automatic clustering (all citrus fruits cluster together without manual labels)
- Cosine similarity as a richer "strength" metric
- Ingredient substitution suggestions ("nearest neighbor in embedding space")

**What changes in the app:**
- 3D layout becomes semantically meaningful (PCA/UMAP of embeddings as coordinates)
- "Similar ingredients" panel for each ingredient
- A/B test NPMI strength vs embedding cosine similarity

#### B. Taste Balance Radar Chart
Given a user's selected recipe ingredients, compute aggregate taste profile and show imbalances.

**What it unlocks:**
- "This combination is very sour but has no fat — add butter or cream"
- Teaches the Salt/Fat/Acid/Heat framework visually
- Gives actionable guidance, not just pairing lookup

### Tier 2: Medium Effort (1-2 months)

#### C. Graph Neural Network (GraphSAGE/GAT)
Train a GNN that learns node features by aggregating neighborhood information. Fine-tune on held-out recipe prediction.

**What it unlocks:**
- Predict new pairings for rare ingredients (inductive learning)
- Edge attention weights reveal which neighbors matter most
- Can answer "what's missing from this recipe?" by link prediction

#### D. Food2Vec / Recipe Transformer
Treat recipes as "sentences" and ingredients as "words." Train Skip-gram or a small BERT on the 2.2M RecipeNLG corpus.

**What it unlocks:**
- Contextual ingredient roles ("garlic as base" vs "garlic as finish")
- Recipe-level patterns ("Indian recipes cluster cumin + turmeric + coriander")
- Full recipe generation given selected ingredients

### Tier 3: Transformative (3-6 months)

#### E. FlavorGraph-style Heterogeneous GNN
Integrate chemical compound data (FlavorDB) + co-occurrence data into a single heterogeneous graph. Train a GAT that learns from both signal types.

**What it unlocks:**
- "These pair well because they share linalool (floral)" — chemical explanations
- "Surprise mode" — high chemical overlap but low co-occurrence = novel pairings worth trying
- Western "harmony" vs Eastern "contrast" toggle
- 95% AUC on pairing prediction (per Park et al. 2021)

#### F. Knowledge Graph Embedding (TransE/ComplEx)
Model ingredients as entities with typed relations: (ingredient, pairedWith, ingredient), (ingredient, hasCategory, category), (ingredient, hasTaste, taste).

**What it unlocks:**
- Complex queries: "find all sweet ingredients that pair with garlic AND belong to Asian cuisine"
- Multi-hop reasoning through explicit relation types
- "Flavor bridge finder" as a first-class feature

---

## Part 4: Visualization Alternatives (Ranked by Impact)

### Current Visualization: Honest Critique

**Strengths:** Beautiful, memorable, performs well at scale (InstancedMesh), good color encoding for taste.

**Fundamental problems:**
1. **Hairball effect** — 51K edges create an unreadable tangle in the center
2. **No semantic ordering** — layout is force-based physics, not meaning-based
3. **Context loss** — rotate into a cluster, lose the global picture
4. **"What" without "why"** — shows the connection, doesn't explain it
5. **Mobile hostile** — 3D orbit controls conflict with iOS gestures

### The 9 Alternatives (Expert-Evaluated)

#### Tier A: High Impact, Buildable Now

**1. Flavor Space Embedding (UMAP/t-SNE) — RECOMMENDED**
- Ingredients positioned by learned similarity, not physics
- Similar ingredients cluster naturally (all citrus together, all alliums together)
- 2D layout is mobile-friendly, no occlusion
- Toggle between current 3D and "Flavor Space" with animated transition
- *Best for: Discovery, mobile, learning emergent structure*

**2. Progressive Disclosure Layers — RECOMMENDED**
- Layer 0: Just dots, no edges (clean, approachable)
- Layer 1: Hover reveals label + top 3 pairings
- Layer 2: Click shows full neighborhood
- Layer 3: Power user mode (all edges, current behavior)
- *Best for: Reducing cognitive load, onboarding new users*

**3. Constellation Map**
- Ingredients as stars, brightness = importance, constellations = cuisine clusters
- Deep space background, constellation names, storytelling
- Visually stunning and shareable
- *Best for: Brand experience, social sharing, wonder*

#### Tier B: Medium Impact, Worth Exploring

**4. Terrain/Topographic Map**
- 2D UMAP layout with z-axis = pairing density
- Peaks = flavor family clusters, valleys = incompatible regions
- Ridge ingredients = flavor bridges between families
- *Best for: Understanding macro structure, finding unexplored territory*

**5. Chord Diagram (Filtered)**
- Only works when filtered (e.g., "Italian cuisine pairings only")
- Beautiful for showing cross-cuisine bridges
- *Best for: Specific analytical questions, not open exploration*

**6. Parallel Coordinates**
- Each axis = a dimension (sweetness, acidity, pairing count, cuisine diversity)
- Powerful for multi-dimensional analysis
- *Best for: Power users, data scientists, not beginners*

#### Tier C: Niche / Future

**7. Hyperbolic Space (Poincare Disk)** — unique, beautiful, re-rootable, but steep learning curve
**8. Periodic Table of Flavors** — good for reference posters, not interactive exploration
**9. Galaxy/Nebula** — maximally beautiful, minimally actionable

### Recommended Hybrid Approach

Don't pick one — **combine views with smooth transitions:**

1. **Default view**: Progressive disclosure over the 3D neural network (current aesthetic, but cleaner)
2. **"Flavor Map" toggle**: Smooth transition to 2D UMAP semantic layout
3. **Linked detail panel**: Selecting an ingredient shows radar chart (taste balance), pairing list, and "why these pair" explanations
4. **Guided tours**: Preset narrative paths through the data ("From garlic to chocolate in 5 steps")
5. **Mobile**: Default to 2D Flavor Map (touch-friendly), with 3D as opt-in

---

## Part 5: What the Culinary Professor Wants

### The Core Pedagogical Gap

The app teaches **"what pairs with what"** but not **"why"** or **"how to think about flavor."**

### What's Missing for Culinary Education

**1. Flavor compound explanations**
- Current: "Basil + tomato = 78% strength"
- Needed: "Both contain linalool (floral) and eugenol (warm). Italian cuisine exploits this shared aromatic bridge."

**2. Cooking technique as a dimension**
- Tomato (fresh, sour) vs. tomato paste (concentrated umami) vs. burnt tomato (bitter, smoky) are three different ingredients. The app treats them as one.

**3. The Salt/Fat/Acid/Heat framework**
- Map every ingredient to its functional role: source of salt, fat, acid, or heat
- Show balance when building a recipe: "Your dish has no acid — add citrus or vinegar"

**4. Progressive complexity levels**
- **Beginner**: "Here are 5 classic pairings for chicken"
- **Intermediate**: "Replace one ingredient with something from a different cuisine. Here's why it works."
- **Advanced**: "Find a completely novel pairing by traversing the graph. Why might duck + miso + blood orange work?"

**5. Guided exercises**
- "Given beef, create 3 different cuisine profiles" (same protein, different flavor ratios)
- "Find the weakest pairing in your dish and strengthen it" (diagnostic thinking)
- "Bridge two ingredients that don't pair directly" (flavor bridging)

**6. "Unexplored territory" mode**
- Surface ingredient pairs with low co-occurrence but high chemical overlap
- These are novel combinations worth trying — the creative frontier
- Chef Watson's key insight: creativity lives at the boundary between familiar and novel

**7. Structure builders for all cooking**
- Cocktails and sauces have templates (Old Fashioned, Bechamel). General cooking needs them too.
- Stir-fry = aromatics + protein + vegetable + sauce
- Curry = spice paste + liquid + protein + vegetable
- Braise = sear + aromatics + liquid + time

---

## Part 6: Creative Interaction Ideas

### "Discovery Facts" on Hover
Instead of just showing a name, show a nugget:
> "Did you know? Parmesan and chocolate share 37 volatile compounds. Heston Blumenthal serves them together."

### Flavor Bridge Finder
Select two ingredients that seem incompatible. The app finds and animates the shortest path between them:
> Garlic → Tarragon → Strawberry → Chocolate
> "Each step shares aromatic compounds with the next."

### "Surprise Me" Button
Surfaces a high-chemical-overlap, low-co-occurrence pairing — novel but scientifically plausible.
> "Try: White chocolate + caviar (both rich in amines)"

### Creativity Dial
Slider from "Classic" to "Adventurous":
- Classic: High co-occurrence pairings (safe, conventional)
- Adventurous: High chemical similarity but low co-occurrence (novel, experimental)

### Cuisine Crossover Challenges
> "Here's a classic French dish (Coq au Vin). Redesign it using only Japanese ingredients."
> Shows how flavor logic transcends cuisine boundaries.

### Temporal Tasting Sequence
Show the order flavors hit the palate in a dish:
> First: bright acid (lemon) → Then: savory base (chicken) → Finally: aromatic finish (herbs)

### AR Overlay (Future)
Point your phone camera at a physical ingredient (garlic clove). App overlays its flavor network in AR, showing pairings as glowing paths in 3D space.

---

## Part 7: Recommended Roadmap

### Phase 1: Foundation (Weeks 1-4)
| Task | Impact | Effort |
|---|---|---|
| Node2Vec embeddings on existing graph | Unlocks clustering, substitution, semantic layout | 2 weeks |
| Taste balance radar chart for Recipe Lab | Teaches balance, actionable guidance | 1 week |
| Progressive disclosure layers | Reduces cognitive load | 1 week |
| Flavor bridge path finder (shortest path viz) | Core pedagogical feature | 1 week |

### Phase 2: Intelligence (Weeks 5-10)
| Task | Impact | Effort |
|---|---|---|
| 2D UMAP "Flavor Map" view with animated toggle | Mobile-friendly, semantic layout | 2 weeks |
| Pairing explanations ("why these pair") | Teaches flavor science | 2 weeks |
| FlavorDB chemical compound integration | Enables "surprise mode" | 2 weeks |
| Ingredient substitution suggestions | Practical cooking utility | 1 week |

### Phase 3: Pedagogy (Weeks 11-16)
| Task | Impact | Effort |
|---|---|---|
| Guided exploration tours (3-5 preset journeys) | Narrative learning | 2 weeks |
| Structure templates for general cooking | Extends cocktail/sauce codex | 2 weeks |
| "Creativity dial" (classic ↔ adventurous) | Enables creative exploration | 1 week |
| Cuisine crossover exercises | Teaches transferable flavor logic | 1 week |

### Phase 4: Neural (Weeks 17-24)
| Task | Impact | Effort |
|---|---|---|
| GNN (GraphSAGE) for pairing prediction | True ML, predicts new pairings | 4 weeks |
| Recipe transformer (fine-tuned on RecipeNLG) | Recipe generation from ingredients | 4 weeks |
| Multi-modal embedding space (chemistry + co-occurrence) | FlavorGraph-level intelligence | 4 weeks |

---

## Part 8: The One-Sentence Vision

**Transform the Flavor Network from "a beautiful lookup tool for co-occurrence statistics" into "an intelligent culinary thinking partner that teaches WHY flavors work, surfaces novel combinations worth trying, and adapts to how chefs actually create."**

The neural network metaphor shouldn't just be an aesthetic — it should be the actual architecture.
