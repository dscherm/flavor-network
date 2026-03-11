# Flavor Network — Neural Visualization Platform

## Architecture
- **Stack**: React 18 + Vite + Three.js (WebGL) + TensorFlow.js
- **Rendering**: Three.js scene with post-processing (bloom/glow), OrbitControls for 3D navigation
- **ML**: TensorFlow.js ingredient embeddings trained on pairing data (Word2Vec-style skip-gram)
- **API**: Express.js REST endpoint for ingredient lookup (`/api/ingredient/:name`)
- **Search**: In-app fuzzy search bar (fuse.js) + drilldown panel showing pairings, cuisines, metadata
- **Data**: Flavor Bible dataset — 380+ ingredients, pairings, cuisines, affinities, taste/weight/volume metadata

## Key Directories
```
src/
├── main.jsx                 # React entry point
├── App.jsx                  # Root component
├── components/
│   ├── NetworkScene.jsx     # Three.js 3D neural network canvas
│   ├── SearchBar.jsx        # Fuzzy ingredient search
│   ├── IngredientPanel.jsx  # Drilldown info panel
│   ├── Legend.jsx           # Color/size legend
│   └── Controls.jsx         # Filter/view controls
├── three/
│   ├── SceneManager.js      # Three.js scene, camera, renderer, post-processing
│   ├── NodeMesh.js          # Instanced mesh for ingredient nodes (spheres + glow)
│   ├── EdgeMesh.js          # Line segments for synapse connections
│   ├── ParticleSystem.js    # Animated particles flowing along edges
│   └── ShaderMaterials.js   # Custom glow/pulse/activation shaders
├── ml/
│   ├── embeddings.js        # Train/load ingredient embeddings (TensorFlow.js)
│   ├── dimensionReduce.js   # UMAP/t-SNE for 3D projection of embeddings
│   └── similarity.js        # Cosine similarity for ingredient lookup
├── data/
│   ├── loader.js            # Parse CSV/JSON data files
│   ├── graph.js             # Build node/edge graph from pairings
│   └── metadata.js          # Ingredient metadata accessors
├── api/
│   └── server.js            # Express API for ingredient lookup
├── hooks/
│   └── useFlavorData.js     # React hook for data loading + state
└── utils/
    └── color.js             # Color scales for cuisines, taste, activation
data/                        # Raw Flavor Bible data (CSV + JSON)
public/                      # Static assets
```

## Data Model
- **Ingredient node**: `{ id, name, cuisines[], taste, weight, volume, season, tips, embedding[], position3D }`
- **Pairing edge**: `{ source, target, strength }` (from pairings data)
- **Cuisine region**: `{ id, name, ingredients[], color }`
- **Affinity**: `{ ingredient, combo: string[] }` (flavor affinities/trios)

## Visual Design — Neural Network Aesthetic
- Nodes = glowing spheres; size = number of pairings; color = cuisine cluster or taste profile
- Edges = translucent lines with animated particles flowing (synapse firing)
- Bloom post-processing for glow effect
- Activation coloring: when an ingredient is selected, connected nodes "light up" with intensity based on pairing strength
- 3D depth with OrbitControls (rotate, zoom, pan)
- Background: dark (#0a0a0f) with subtle grid or star field

## Build & Run
```bash
npm install          # Install dependencies
npm run dev          # Vite dev server (port 5173)
npm run build        # Production build
npm run train        # Train/export embeddings
npm run api          # Start API server (port 3001)
```

## Conventions
- Functional React components with hooks (no class components)
- Three.js managed outside React lifecycle via refs (SceneManager pattern)
- All data loading async, show loading state
- ESM imports throughout
- Tailwind CSS for UI panels (not for Three.js canvas)

## Critical Rules
- NEVER load full graph.json or pairings.json into main thread without streaming — files are huge
- Pre-compute embeddings and 3D positions at build time, serve as static JSON
- Use InstancedMesh for nodes (performance — hundreds of spheres)
- Use BufferGeometry for edges (performance — thousands of lines)
- API responses must include CORS headers
