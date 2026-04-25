# Flavor Network

A 3D, browser-based exploration of how ingredients pair, how cocktails
cluster into a culinary codex, and how the 10 mother sauces relate to
their global descendants. Built on 2.2M real recipes, 48,588 ingredient
pairings, and a graph neural network trained on flavor-compound
chemistry.

Live: **https://neuralflavor.web.app**

The app opens to a picker with three "model" entry points:

- **Explore Pairing Model** → 3,913 ingredients in a 3D network,
  clustered by shared chemistry. Click a node, see its top pairings,
  understand why basil tastes like strawberry.
- **Explore Cocktail Model** → the *Cocktail Codex* view: 172 cocktails
  as nodes, grouped into the 7 super-cluster families (Old-Fashioned,
  Martini, Daiquiri, Sidecar, Whisky Highball, Flip, Syrups). Click a
  cocktail, see its ingredients, find similar drinks, push the
  ingredients into the Recipe Lab to experiment with substitutions.
- **Explore Sauce Model** → 77 curated sauces grouped into the 10
  mother families (Béchamel, Velouté, Espagnole, Hollandaise, Tomato,
  Curry, Stir-fry, Mole, Salsa, Nut Sauce). Within each family, sauces
  sub-cluster by cuisine (Indian / Thai / Japanese curries, etc.).

A **Recipe Lab** mode lets you assemble a bowl of ingredients and
get phase-aware substitution suggestions — what to add when the bowl
is empty (popular pairings) shifts to coherence-driven suggestions in
the middle of a recipe, then to predictive next-ingredient ranking
once the bowl is mostly assembled.

---

## How the modeling works

### 1. The pairing graph (3,913 ingredients × 48,588 edges)

The base graph is built from a **proprietary blended dataset** in
`proDataset/`. Sources, in weight order:

| Source           | Records   | Weight | What it contributes              |
| ---------------- | --------- | ------ | -------------------------------- |
| RecipeNLG        | 2.2M      | 40%    | Recipe-level co-occurrence + PMI |
| FlavorDB         | ~1k       | 30%    | Shared molecular compounds       |
| TheMealDB        | 595       | 15%    | Cuisine-tagged co-occurrence     |
| TheCocktailDB    | 426       | 15%    | Cocktail-specific co-occurrence  |

Edge strength is a **NPMI + log-count hybrid**: NPMI rewards specific
non-trivial pairings (lemon juice ↔ tequila), the log-count term keeps
common-but-real pairs (salt ↔ pepper) from being washed out by the
NPMI normalization. Pipeline lives in `proDataset/scripts/` and runs
top-to-bottom via `npm run all` (script numbers indicate order):

```
01-parse-recipenlg → 02-fetch-flavordb → 03-fetch-mealdb
  → 04-fetch-cocktaildb → 05-blend → 05-process-compounds
  → 06-compute-features → 07-blend-v2 → 08-derive-recipe-pairs
  → 09-derive-cocktail-clusters → 10-derive-sauce-clusters
  → 11-parse-cocktail-codex
```

Output ships in `public/proDataset/` as `ingredients.json` (node
metadata), `pairings.json` (edge list), `recipe_pairs.json` (recipe-
level co-occurrence for the suggestion engine), plus a binary
`pairings.bin` for fast load.

### 2. Chemistry: the GNN taste/odor predictor

A separate sub-project, `chemDataset/` and `flavor-gnn/`, trains a
**multi-task message-passing neural network** on flavor compounds:

- **Inputs**: SMILES → molecular graph (atoms as nodes, bonds as
  edges). Compound features pulled from FooDB, FlavorDB, ChemTasteDB,
  BitterDB, SuperSweetDB, FlavorNet, and PubChem.
- **Architecture**: GINEConv, 3 layers, hidden=128. 11-task multi-head
  output for taste (sweet, sour, bitter, salty, umami) and odor
  (fruity, green, woody, fatty, floral, spicy).
- **Training**: 5-fold CV, 15 epochs, batch=64, seed=42, CPU. Per-task
  threshold calibration writes `public/proDataset/odor_thresholds.json`.
- **Calibrated F1 (post-R12 calibration)**: bitter 0.81, fruity 0.62,
  umami 0.61 (unlocked via calibration from baseline 0.25), green
  0.56, sweet 0.56, woody 0.52, fatty 0.52, sour 0.49 (also unlocked),
  floral 0.46. Salty (0.40, 16 training positives) and spicy (0.30) are
  data-limited and **not surfaced in the UI**.
- **Coverage**: 2,790 of 3,913 ingredients have GNN predictions. The
  ~1,100 missing are mostly high-pairing hub ingredients (cheddar,
  bacon, egg, tomato paste) where compound data is incomplete. The
  app shows GNN-predicted profiles in the IngredientPanel as a
  separate "Predicted profile" section, not as a replacement for
  curated taste tags.

### 3. Cocktail Codex (172 cocktails, 7 families)

`proDataset/scripts/11-parse-cocktail-codex.js` parses a curated
markdown source (`COCKTAIL_CODEX_NEEDS.md`) into 172 cocktail
recipes, each tagged with a family and subcluster. The 7 families
mirror Dave Arnold's *Cocktail Codex* taxonomy: each family has a
single root cocktail (Old-Fashioned, Martini, Daiquiri, Sidecar,
Whisky Highball, Flip) plus a Syrups bin. Within a family, cocktails
break into Core / Balance / Seasoning / Variations / Extended Family
subclusters.

In the 3D scene (`src/data/cocktailCodex.js` +
`src/components/CocktailLab.jsx`):
- Family centroids lie on a 36-unit radius circle.
- Subclusters ring each centroid at radius 8.
- Individual cocktails scatter ±3 units around their subcluster.
- **Tree edges** (strength=1) connect each cocktail to its family
  root. **Jaccard edges** connect cocktails with ingredient overlap
  ≥ 0.18 within the same family.

### 4. Sauce Codex (77 sauces, 10 mother families)

`src/data/sauceCodex.js` loads `public/data/sauce_augment.json` (77
curated sauces, each with structured ingredient + measure + technique
fields), reassigns the 27 originally-tagged "Independent" sauces to
their nearest mother family at load time (table in `REASSIGN`), and
groups by `family + cuisine` for visual sub-clustering. Curry shows
Indian / Thai / African as visible sub-pods; Stir-fry separates
Japanese / Chinese / Korean. Single-cuisine families (Espagnole = all
French) collapse the sub-centroid back to the family centroid.

Eponymous mother sauces (Béchamel, Velouté, Espagnole, Hollandaise)
sit AT their family centroid as the visual anchor; non-eponymous
families (Curry, Stir-fry, Salsa, Mole, Nut Sauce) use the first
sauce as the centroid label anchor.

### 5. Phase-shifting suggestion engine (Recipe Lab)

When the user assembles a bowl in the Recipe Lab, suggestions are
ranked differently as the bowl grows — see `.claude/.ralph-spec.md`
for the full info-theoretic spec:

| Bowl size | Phase       | Score function                                        |
| --------- | ----------- | ----------------------------------------------------- |
| N = 0     | Cold-start  | Pure corpus frequency (top-paired ingredients)        |
| N = 1–2   | Reductive   | `pairing × ΔH` over `P(Cluster \| bowl)`              |
| N = 3–5   | Coherent    | `−KL(neighbor_dist(c) ‖ bowl_dist)`                   |
| N ≥ 6     | Predictive  | `P(c \| bowl)` from recipe-level co-occurrence        |

`P(Cluster | bowl)` is the marginal cluster posterior built from a
precomputed `clusterMatrix` (3913 × 10 soft cluster assignments
derived from each ingredient's top-50 neighbors). Boundaries are
linearly blended so the drawer doesn't visibly reshuffle at N=3 and
N=6.

A separate **wildcard slot** ranks candidates by
`pairing_strength × surprisal(c | bowl)` with eligibility filters
(pairing ≥ 0.3, corpus appearances ≥ 100, not in the safe top-K) so
the user can find non-obvious bridges (the "kalamata + chocolate"
discoveries) without losing safe defaults.

A per-user prior, stored in `localStorage` under `fn-recipe-prior`,
records implicit signals (saved recipes weighted at +1.0, clicks on
ingredients that survive to a save at +0.5, debounced searches at
+0.2) and biases ranking toward ingredients the user has shown
affinity for. Cold-start blend `α = N_saves / (N_saves + 5)` keeps
new users on pure corpus until they've saved a few recipes.

---

## Project structure

```
flavor-network/
├── src/
│   ├── App.jsx                  # Tab orchestration + handoff state
│   ├── components/
│   │   ├── StartPage.jsx        # Three-model entry picker
│   │   ├── NetworkScene.jsx     # Three.js 3D canvas
│   │   ├── CocktailLab.jsx      # Cocktail Codex view
│   │   ├── SauceLab.jsx         # Sauce Codex view
│   │   ├── RecipeLabMobile.jsx  # Recipe Lab (web + iOS share layout)
│   │   ├── SuggestionDrawer.jsx # Phase-shifting suggestion engine
│   │   ├── IngredientPanel.jsx  # Ingredient drilldown (right side)
│   │   ├── CocktailDetailPanel.jsx
│   │   └── SauceDetailPanel.jsx
│   ├── data/
│   │   ├── graph.js             # Adjacency builder + neighbor lookup
│   │   ├── cocktailCodex.js     # 7-family cocktail layout
│   │   ├── sauceCodex.js        # 10-family sauce layout
│   │   ├── recipeSuggestionEngine.js
│   │   └── infoTheory.js        # entropy / KL / surprisal
│   ├── three/                   # Scene, instanced meshes, shaders
│   └── hooks/useProData.js      # Loads ProData dataset
├── public/
│   ├── proDataset/              # ingredients.json, pairings.json, GNN outputs
│   └── data/                    # cocktail_codex.json, sauce_augment.json
├── proDataset/                  # Standalone Node.js pipeline (sources → blend)
├── chemDataset/                 # Compound data fetchers
├── flavor-gnn/                  # PyTorch GNN training
└── ios/                         # Capacitor iOS project (Xcode)
```

---

## Build & run

```bash
npm install
npm run dev          # Vite dev server (port 5173)
npm run build        # Production build → dist/
npm run preview      # Serve the production build locally
npm run api          # Express API (port 3001) for ingredient lookup
```

iOS (Mac only):

```bash
npm run ios:sync     # Build web + sync to ios/App/App/public
npm run ios:open     # Open Xcode project
```

To rebuild the dataset from sources (requires `proDataset/raw/recipenlg.csv`
from Kaggle):

```bash
cd proDataset
npm install
npm run all
```

---

## Stack

- **Frontend**: React 18 + Vite, Tailwind CSS for panels, Three.js
  (WebGL) for the 3D scene with bloom post-processing.
- **3D rendering**: `InstancedMesh` for nodes (thousands of spheres),
  `BufferGeometry` line segments for edges, sprite labels for cluster
  centroids, `OrbitControls` for navigation.
- **Search**: Fuse.js for fuzzy ingredient/cocktail/sauce search.
- **API**: Express.js for the `/api/ingredient/:name` lookup.
- **iOS**: Capacitor wraps the web app for App Store distribution
  (bundle id `com.neuralflavor.app`).
- **Hosting**: Firebase Hosting (`neuralflavor.web.app`).
- **ML**: PyTorch + PyTorch Geometric for the GNN training pipeline
  in `flavor-gnn/`.

---

## License & credits

The pipeline derives data from open sources (RecipeNLG, TheMealDB,
TheCocktailDB, FlavorDB, FooDB, ChemTasteDB, BitterDB, SuperSweetDB,
FlavorNet, PubChem). The blended `proDataset/` output is proprietary.
Cocktail Codex taxonomy follows Dave Arnold's *Cocktail Codex* (2018);
mother sauce taxonomy follows Auguste Escoffier's *Le Guide
Culinaire* (1903) extended with five global parallels (Curry,
Stir-fry, Mole, Salsa, Nut Sauce) per the in-app classification.
