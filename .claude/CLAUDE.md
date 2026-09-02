# Flavor Network — Neural Visualization Platform

## Architecture
- **Stack**: React 18 + Vite + Three.js (WebGL) + Capacitor (iOS)
- **Rendering**: Three.js scene with post-processing (bloom/glow), OrbitControls for 3D navigation
- **API**: Express.js REST endpoint for ingredient lookup (`/api/ingredient/:name`)
- **Search**: In-app fuzzy search bar (fuse.js) + drilldown panel showing pairings, cuisines, metadata
- **Data**: ProData proprietary dataset — 3,891 ingredients, 95,992 scored pairings (68,417 observed in RecipeNLG (2.2M recipes) / TheMealDB / TheCocktailDB co-occurrence, 27,575 GNN-predicted). NPMI + log-count hybrid scoring. NO Flavor Bible dependency.
- **Navigation**: Landing → "The Labs" (Cocktail Lab, Sauce Lab, Pairing Lab, Recipe Notebook) or "Make a recipe"; plus Cookbook and Profile. The 3D Network view is parked (reachable via `?path=explore`). Labs are lazy-mounted.
- **Distribution**: web only (Firebase Hosting). The iOS/Capacitor effort is archived on branch `archive/ios` — see CLOSEOUT.md. `@capacitor/*` packages remain as inert `isNativePlatform()` guards.

## Data Sources (ProData Pipeline)
The app uses a proprietary dataset built from open sources via `proDataset/`:
- **RecipeNLG**: 2.2M recipes → ingredient co-occurrence + PMI (40% weight)
- **TheMealDB**: 595 meals → co-occurrence (15% weight)
- **TheCocktailDB**: 426 drinks → co-occurrence (15% weight)
- **FlavorDB**: Chemical compound overlap (30% weight, when API available)

The Flavor Bible CSV data and legacy hooks (useFlavorData.js, loader.js) were removed on 2026-03-24. The app uses `useProData()` hook which loads from `public/proDataset/`.

## Key Directories
```
src/
├── main.jsx                 # React entry point
├── App.jsx                  # Root component (uses useProData, NOT useFlavorData)
├── components/
│   ├── NetworkScene.jsx     # Three.js 3D neural network canvas
│   ├── SearchBar.jsx        # Fuzzy ingredient search
│   ├── IngredientPanel.jsx  # Drilldown info panel
│   ├── Legend.jsx           # Color/size legend
│   ├── Controls.jsx         # Filter/view controls
│   ├── CocktailLab.jsx      # Cocktail Lab (3D, uses ProData graph)
│   ├── SauceLab.jsx         # Sauce Lab (3D, uses ProData graph)
│   ├── RecipeLab.jsx        # Recipe Lab (2D canvas, notebook aesthetic)
│   ├── NotebookCanvas.jsx   # Canvas 2D renderer for Recipe Lab
│   ├── RecipePanel.jsx      # Recipe Lab right sidebar
│   └── ...                  # Profile, insights, quiz, etc.
├── three/
│   ├── SceneManager.js      # Three.js scene, camera, renderer, post-processing
│   ├── NodeMesh.js          # Instanced mesh for ingredient nodes (spheres + glow)
│   ├── EdgeMesh.js          # Line segments for synapse connections
│   ├── ParticleSystem.js    # Animated particles flowing along edges
│   └── ShaderMaterials.js   # Custom glow/pulse/activation shaders
├── data/
│   ├── graph.js             # Build node/edge graph from pairings
│   ├── graph.js             # Build node/edge graph from pairings
│   ├── cocktailGraph.js     # Cocktail subgraph builder
│   ├── sauceGraph.js        # Sauce subgraph builder
│   └── metadata.js          # Ingredient metadata accessors
├── hooks/
│   ├── useProData.js        # PRIMARY: Loads ProData dataset (proprietary)
│   └── useIsMobile.js       # Responsive mobile detection hook
└── utils/
    └── color.js             # Color scales for cuisines, taste, activation
proDataset/                  # Proprietary dataset pipeline (standalone Node.js)
├── scripts/                 # 5 pipeline scripts + orchestrator
├── data/                    # Synonym tables, category lookup
├── processed/               # Intermediate data per source
└── output/                  # Final blended dataset
public/
├── proDataset/              # ACTIVE: ingredients.json, pairings.json (served to app)
└── data/                    # Augment data (cocktail_augment.json, sauce_augment.json, cuisine_map.json, season_region.json)
```

## Data Model
- **Ingredient node**: `{ id, name, cuisines[], taste, weight, volume, season, tips, pairingCount, category, sources[] }`
- **Pairing edge**: `{ source, target, strength }` (from ProData pairings)
- **Cocktail augment**: `cocktail_augment.json` (curated cocktail-specific data)
- **Sauce augment**: `sauce_augment.json` (69 curated sauce recipes + sauce-specific data)

## Visual Design — Neural Network Aesthetic
- Nodes = glowing spheres; size = number of pairings; color = taste profile (multi-taste blending)
- Taste colors: sweet (pink), sour (cyan), bitter (purple), salty (blue), spicy (red), pungent (orange), astringent (teal), umami (gold)
- Edges = translucent lines with animated particles flowing (synapse firing)
- Bloom post-processing for glow effect
- 3D depth with OrbitControls (rotate, zoom, pan)
- Background: dark (#0a0a0f)

## Build & Run
```bash
npm install          # Install dependencies
npm run dev          # Vite dev server (port 5173)
npm run build        # Production build
npm run gate         # Full vitest suite + build — must pass before any commit
npm run api          # Start API server (port 3001; dev-only, needs GEMINI_API_KEY)
```

## ProData Pipeline
```bash
cd proDataset
npm install
npm run all          # Run full pipeline (needs raw/recipenlg.csv from Kaggle)
npm run mealdb       # Fetch TheMealDB data
npm run cocktaildb   # Fetch TheCocktailDB data
npm run blend        # Blend all sources into output/
```

## Conventions
- Functional React components with hooks (no class components)
- Three.js managed outside React lifecycle via refs (SceneManager pattern)
- All data loading async, show loading state
- ESM imports throughout
- Tailwind CSS for UI panels (not for Three.js canvas)
- ALL ingredient data comes from ProData (useProData hook), NOT Flavor Bible

## Critical Rules
- useFlavorData and loader.js have been removed. Use useProData exclusively.
- Use InstancedMesh for nodes (performance — thousands of spheres)
- Use BufferGeometry for edges (performance — thousands of lines)
- API responses must include CORS headers
- Cocktail Lab and Sauce Lab receive ProData graph via fullData prop from App.jsx
