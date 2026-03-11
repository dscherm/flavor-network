---
mode: add-features
updated: 2026-03-11T11:30
---

# Flavor Network — Build Plan

## Phase 0: Project Scaffold
- [x] TASK-1: Initialize package.json with React 18, Vite, Three.js, TensorFlow.js, Tailwind, Express, Fuse.js dependencies #infra
- [x] TASK-2: Create Vite config with React plugin and dev server settings #infra
- [x] TASK-3: Create Tailwind config and base CSS (dark theme) #infra
- [x] TASK-4: Create index.html entry point and src/main.jsx React mount #infra (already existed from TASK-1)

## Phase 1: Data Pipeline
- [x] TASK-5: Build data/loader.js — parse ingredients.csv, pairings data, cuisines.csv, ingredient_metadata.csv, affinities.csv into structured JS objects #data
- [x] TASK-6: Build data/graph.js — construct node/edge graph from parsed data (ingredients=nodes, pairings=edges, with strength values) #data
- [x] TASK-7: Build data/metadata.js — accessor functions for ingredient taste, weight, volume, season, tips, cuisines #data

## Phase 2: ML Embeddings
- [x] TASK-8: Build ml/embeddings.js — train skip-gram ingredient embeddings using TensorFlow.js on pairing co-occurrence data #ml
- [x] TASK-9: Build ml/dimensionReduce.js — project high-dimensional embeddings to 3D positions using UMAP (umap-js) #ml
- [x] TASK-10: Create npm script `train` that runs embedding pipeline and exports pre-computed positions to public/embeddings.json #ml
- [x] TASK-11: Build ml/similarity.js — cosine similarity search over embeddings for "similar ingredients" feature #ml

## Phase 3: Three.js Scene
- [x] TASK-12: Build three/SceneManager.js — scene, PerspectiveCamera, WebGLRenderer, OrbitControls, resize handler, animation loop #viz
- [x] TASK-13: Build three/ShaderMaterials.js — custom glow/pulse vertex+fragment shaders for nodes and edges #viz
- [x] TASK-14: Build three/NodeMesh.js — InstancedMesh of spheres for ingredients, sized by pairing count, colored by cuisine/taste #viz
- [x] TASK-15: Build three/EdgeMesh.js — BufferGeometry line segments for pairing connections with opacity based on strength #viz
- [x] TASK-16: Build three/ParticleSystem.js — animated particles flowing along edges (synapse firing effect) #viz
- [x] TASK-17: Add post-processing pipeline: UnrealBloomPass for glow, optional FXAA #viz
- [x] TASK-18: Implement raycasting for node hover/click detection in 3D scene #viz

## Phase 4: React UI
- [x] TASK-19: Build App.jsx — root layout with Three.js canvas + overlay UI panels #ui
- [x] TASK-20: Build components/NetworkScene.jsx — React wrapper for SceneManager (ref-based lifecycle) #ui
- [x] TASK-21: Build components/SearchBar.jsx — fuzzy search with Fuse.js, autocomplete dropdown #ui
- [x] TASK-22: Build components/IngredientPanel.jsx — drilldown panel showing pairings, cuisines, metadata, similar ingredients #ui
- [x] TASK-23: Build components/Legend.jsx — color legend for cuisines and taste profiles #ui
- [x] TASK-24: Build components/Controls.jsx — filter by cuisine, taste, season; toggle edges/particles #ui
- [x] TASK-25: Build hooks/useFlavorData.js — async data loading hook with loading/error states #ui
- [x] TASK-26: Wire up search → 3D selection: clicking search result highlights node + flies camera to it #ui (wired in App.jsx + NetworkScene)
- [x] TASK-27: Wire up 3D click → panel: clicking a node in scene opens IngredientPanel with that ingredient's data #ui (wired in App.jsx + NetworkScene)

## Phase 5: Activation & Interaction
- [x] TASK-28: Implement activation spread — selecting an ingredient "lights up" connected nodes with intensity = pairing strength #interaction
- [x] TASK-29: Implement path highlighting — show strongest connection chain between two selected ingredients #interaction
- [x] TASK-30: Add ingredient comparison mode — select 2 ingredients, show shared pairings and differences #interaction

## Phase 6: API
- [x] TASK-31: Build api/server.js — Express server with /api/ingredient/:name endpoint returning full ingredient data + pairings + similar #api
- [x] TASK-32: Add /api/search?q= endpoint with fuzzy matching #api
- [x] TASK-33: Add /api/pairings/:ingredient1/:ingredient2 endpoint showing shared connections #api
- [x] TASK-34: Add CORS, error handling, and rate limiting to API #api

## Phase 7: Walkthrough Demo
- [x] TASK-39: Build Walkthrough.jsx — step-based tour engine with spotlight overlay, progress dots, skip/next buttons #demo
- [x] TASK-40: Implement tour steps 1-3 — welcome, navigation instructions (wait for user drag), fly to garlic node #demo
- [x] TASK-41: Implement tour steps 4-6 — ingredient panel walkthrough, activation spread demo, search demo with auto-type #demo
- [x] TASK-42: Implement tour steps 7-9 — comparison mode demo, filter demo, completion with localStorage flag #demo
- [x] TASK-43: Add "?" help button to re-trigger tour, mobile bottom-sheet layout for steps #demo

## Phase 8: Polish
- [x] TASK-44: Add loading screen with neural network animation while data/embeddings load #polish
- [x] TASK-45: Add responsive layout — panel collapses on mobile, touch controls for 3D #polish
- [x] TASK-46: Performance optimization — frustum culling, LOD for distant nodes, throttle raycasts #polish
- [x] TASK-47: Add keyboard shortcuts — Escape to deselect, / to focus search, arrow keys for navigation #polish

## Phase 9: User Flavor Profile — Data Layer
- [x] TASK-50: Build hooks/useUserProfile.js — localStorage-backed state for user cuisines, ingredients, recipes with add/remove/clear/export/import #profile
- [x] TASK-51: Build data/profileWeights.js — compute personal weight per ingredient from user profile (direct selection + cuisine boost + recipe boost + 1-hop cascade) #profile
- [ ] TASK-52: Add recipe ingredient parser — extract known ingredients from free-text recipe names and pasted recipe text/URLs #profile

## Phase 10: User Flavor Profile — UI
- [ ] TASK-53: Build components/ProfilePanel.jsx — slide-in panel to manage profile: add/remove cuisines, ingredients, recipes; show profile stats #profile
- [ ] TASK-54: Build components/RecipeBuilder.jsx — modal to create recipes by selecting ingredients from graph + free-text + paste URL parsing #profile
- [ ] TASK-55: Build components/ProfileToggle.jsx — button to switch between global view and "My Profile" view mode #profile
- [ ] TASK-56: Add heart/star toggle on node hover in 3D scene — click to quick-add/remove ingredient from profile #profile
- [ ] TASK-57: Build components/ProfileInsights.jsx — show top 10 ingredients, "you might like" suggestions, flavor signature (taste breakdown), cuisine affinity #profile

## Phase 11: User Flavor Profile — Visualization
- [ ] TASK-58: Add applyProfileWeights() to NodeMesh — scale node size and brightness by personal weight in profile mode #profile
- [ ] TASK-59: Add applyProfileWeights() to EdgeMesh — brighten edges between high-weight nodes in profile mode #profile
- [ ] TASK-60: Wire profile view toggle in App.jsx + NetworkScene — switch between global and profile-weighted views #profile
- [ ] TASK-61: Add profile export/import buttons — download profile as JSON, upload JSON to restore #profile
- [ ] TASK-62: Add walkthrough steps for profile feature — explain how to add preferences, switch views, read insights #profile
