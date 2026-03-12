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
- [x] TASK-52: Add recipe ingredient parser — extract known ingredients from free-text recipe names and pasted recipe text/URLs #profile

## Phase 10: User Flavor Profile — UI
- [x] TASK-53: Build components/ProfilePanel.jsx — slide-in panel to manage profile: add/remove cuisines, ingredients, recipes; show profile stats #profile
- [x] TASK-54: Build components/RecipeBuilder.jsx — modal to create recipes by selecting ingredients from graph + free-text + paste URL parsing #profile
- [x] TASK-55: Build components/ProfileToggle.jsx — button to switch between global view and "My Profile" view mode #profile
- [x] TASK-56: Add heart/star toggle on node hover in 3D scene — click to quick-add/remove ingredient from profile #profile
- [x] TASK-57: Build components/ProfileInsights.jsx — show top 10 ingredients, "you might like" suggestions, flavor signature (taste breakdown), cuisine affinity #profile

## Phase 11: User Flavor Profile — Visualization
- [x] TASK-58: Add applyProfileWeights() to NodeMesh — scale node size and brightness by personal weight in profile mode #profile
- [x] TASK-59: Add applyProfileWeights() to EdgeMesh — brighten edges between high-weight nodes in profile mode #profile
- [x] TASK-60: Wire profile view toggle in App.jsx + NetworkScene — switch between global and profile-weighted views #profile
- [x] TASK-61: Add profile export/import buttons — download profile as JSON, upload JSON to restore #profile
- [x] TASK-62: Add walkthrough steps for profile feature — explain how to add preferences, switch views, read insights #profile

## Phase 12: Recipe Sharing & Image Scanning
> **Goal**: Let users share recipe links, photograph recipes, and auto-extract ingredients into their profile.

### Recipe Link Sharing
- [x] TASK-63: Build components/RecipeSharePanel.jsx — paste or share a recipe URL, preview extracted ingredients before adding to profile. Support common recipe sites (AllRecipes, Food Network, NYT Cooking, etc.) via Open Graph / JSON-LD structured data scraping #profile
- [x] TASK-64: Build src/data/recipeScraper.js — fetch recipe URL via proxy API, extract ingredient list from JSON-LD Recipe schema (schema.org/Recipe), fallback to HTML parsing of common recipe site DOM patterns. Return structured { title, ingredients[], servings, source } #data
- [x] TASK-65: Add /api/recipe/scrape endpoint to Express server — accepts URL, returns parsed recipe with extracted ingredients matched against known flavor network ingredients. Handles CORS and rate limiting #api
- [x] TASK-66: Add shareable recipe links — generate a URL like /recipe?ingredients=garlic,butter,shrimp that pre-loads ingredients into the visualization. Copy-to-clipboard button for sharing #profile
- [x] TASK-67: Add "Import from URL" button to RecipeBuilder modal — integrate recipeScraper into existing recipe creation flow as an alternative to manual ingredient selection #ui

### Camera / Image Scanning
- [x] TASK-68: Build components/RecipeScanner.jsx — camera capture UI using getUserMedia API. Take photo of printed/handwritten recipe or ingredient list. Preview image before processing #profile
- [x] TASK-69: Integrate OCR for recipe image scanning — use Tesseract.js (client-side OCR) to extract text from captured recipe photos. Pass extracted text through existing recipeParser to identify known ingredients #ml
- [x] TASK-70: Build src/data/ingredientMatcher.js — fuzzy match OCR-extracted text against the 380+ known ingredients using Fuse.js with custom scoring. Handle plurals, abbreviations (tbsp, tsp), misspellings, and partial matches. Return confidence scores per match #data
- [x] TASK-71: Add scan results review UI — show extracted ingredients with confidence scores, let user confirm/reject/edit before adding to profile. Highlight low-confidence matches in yellow #ui
- [x] TASK-72: Add "Scan Recipe" button to ProfilePanel and RecipeBuilder — integrate camera flow into existing profile management. Support both photo capture and image file upload #ui

## Phase 13: Ingredient Weighting & Frequency Analysis
> **Goal**: Weight ingredients in the user's profile based on how frequently they appear
> across recipes and the quantities used, creating a more accurate flavor fingerprint.

### Frequency-Based Weighting
- [x] TASK-73: Extend recipe data model — add quantity and unit fields per ingredient in each recipe: { name, ingredients: [{ name, quantity, unit, raw }] }. Update RecipeBuilder to capture quantities when available #data
- [x] TASK-74: Build src/data/frequencyWeights.js — compute ingredient frequency score across all user recipes (how many recipes use garlic? 8 out of 10 = 0.8 frequency). Combine with quantity normalization (2 cloves garlic vs 1/4 tsp saffron) using standard unit conversions #data
- [x] TASK-75: Build unit conversion table in src/data/unitConversions.js — map common cooking units to a normalized volume/weight scale: tsp→mL, tbsp→mL, cup→mL, oz→g, cloves→g, pinch→g, "to taste"→minimum. Handle ingredient-specific densities (flour vs butter vs liquid) #data
- [x] TASK-76: Update profileWeights.js — integrate frequency and quantity weights into the existing weight calculation: finalWeight = directSelection + cuisineBoost + recipeFrequency * quantityFactor + cascadeBoost. Higher frequency + larger quantities = stronger signal #profile
- [x] TASK-77: Add frequency visualization to ProfileInsights — show "Your Most Used Ingredients" ranked by frequency across recipes, with bar chart showing usage count + average quantity. Highlight signature ingredients (>70% of recipes) vs occasional ingredients (<20%) #ui

## Phase 14: Palate Discovery Questionnaire
> **Goal**: Onboard new users with a guided questionnaire that quickly identifies their
> flavor preferences through general taste questions before they add any recipes.

### Questionnaire Engine
- [x] TASK-78: Build components/PalateQuiz.jsx — step-based questionnaire with progress bar. Appears on first visit (no profile data) or triggered from ProfilePanel. 10-15 questions, ~2 minutes to complete #ui
- [x] TASK-79: Design question bank in src/data/palateQuestions.js — curated questions that efficiently map to flavor preferences. Categories: #data
  - **Intensity preferences**: "Do you always add extra garlic to recipes?" (scale: never→always) → maps to allium/pungent affinity
  - **Heat tolerance**: "How spicy do you like your food?" (mild→extreme) → maps to capsaicin/chili ingredients
  - **Spicy cuisine affinity**: "Which spicy cuisines do you enjoy? (select all)" → Thai, Indian, Mexican, Szechuan, Korean, Ethiopian, Cajun/Creole, Caribbean
  - **Sweet vs savory**: "When snacking, do you reach for sweet or savory?" → maps to sugar/salt/umami balance
  - **Herb preferences**: "Pick your top 3 herbs" → basil, cilantro, parsley, rosemary, thyme, mint, dill, oregano, tarragon, chives
  - **Acid tolerance**: "Do you squeeze lemon/lime on everything?" → maps to citrus/vinegar affinity
  - **Umami seeking**: "Do you add soy sauce, parmesan, or mushrooms to boost flavor?" → maps to umami-rich ingredients
  - **Texture preferences**: "Crunchy or creamy?" → maps to nut/seed vs dairy/cream ingredients
  - **Bitter appreciation**: "Do you enjoy dark chocolate, coffee, or hoppy beer?" → maps to bitter ingredient tolerance
  - **Aromatic preferences**: "Which aromas appeal to you most?" (select 3) → smoky, floral, earthy, citrusy, herbal, nutty, buttery, spicy
  - **Cooking fat preference**: "Your go-to cooking fat?" → butter, olive oil, coconut oil, sesame oil, ghee, neutral oil
  - **Allium spectrum**: "Rank these: raw garlic, roasted garlic, shallots, red onion, scallion" → maps to allium intensity
  - **Dairy comfort**: "How do you feel about strong cheeses?" → maps to dairy/fermented affinity
  - **Global palate breadth**: "How adventurous are you with unfamiliar cuisines?" (1-5) → maps to variety weighting
  - **Finish preference**: "What do you like to finish a dish with?" (select all) → fresh herbs, citrus zest, hot sauce, cheese, cream, crunch, nothing
- [x] TASK-80: Build src/data/quizScoring.js — map quiz answers to ingredient weights. Each question maps to a set of ingredients with multipliers. Combine across all answers to produce an initial profile weight vector. Use the questionnaire as a Bayesian prior that gets refined by recipe data #data
- [x] TASK-81: Wire quiz results into useUserProfile — save quiz answers as profile.quizAnswers, compute initial weights from quiz, merge with recipe-based weights (quiz = 30% weight, recipes = 70% weight when recipes exist, quiz = 100% when no recipes). Re-run on quiz retake #profile
- [x] TASK-82: Add "Retake Quiz" button to ProfilePanel — let users update their answers as tastes evolve. Show how answers changed since last time #ui
- [x] TASK-83: Add quiz prompt to walkthrough — if user has no profile, suggest taking the quiz after tour step 3. Non-blocking — user can skip and come back later #demo

## Phase 15: Flavor Hierarchy Trees
> **Goal**: Build tree structures for cuisines and personal profiles to enable
> hierarchical exploration and comparison of flavor patterns.

### Cuisine Flavor Trees
- [x] TASK-84: Build src/data/cuisineTree.js — construct hierarchical tree: Region → Cuisine → Sub-cuisine → Signature Ingredients. Regions: European (French, Italian, Spanish...), Asian (Chinese, Japanese, Thai, Indian...), Americas (Mexican, Cajun, Brazilian...), African (Ethiopian, Moroccan...), Middle Eastern. Each node has aggregate flavor profile (taste distribution, top pairings) #data
- [x] TASK-85: Build src/data/tasteTree.js — construct taste hierarchy: Primary Taste (Sweet/Sour/Salty/Bitter/Spicy/Pungent) → Taste Subcategories (Sweet: caramel-sweet, fruit-sweet, honey-sweet) → Ingredients. Each node has intensity score and cuisine associations #data
- [ ] TASK-86: Build src/data/ingredientFamilyTree.js — group ingredients into botanical/culinary families: Alliums (garlic, onion, shallot, leek, chive) → Aromatics (ginger, lemongrass, galangal) → Nightshades (tomato, pepper, eggplant) → Citrus (lemon, lime, orange, grapefruit) → Herbs (basil, thyme, rosemary...) → Dairy → Proteins → Grains → Fats/Oils. Enables family-level analysis #data
- [ ] TASK-87: Build src/data/seasonTree.js — organize by season hierarchy: Season → Sub-season → Peak Ingredients. Spring (early spring, late spring) → Summer → Fall → Winter. Cross-reference with cuisine trees to show seasonal cuisine variations #data

### Tree Navigation UI
- [ ] TASK-88: Build components/FlavorTreeExplorer.jsx — collapsible tree panel with multiple view modes: Cuisine, Taste, Ingredient Family, Season. Click a tree node to filter the 3D view to that subtree. Breadcrumb trail showing drill path. Show aggregate stats at each level (ingredient count, avg pairings, dominant taste) #ui
- [ ] TASK-89: Add tree-based 3D filtering — clicking a tree node (e.g., "Asian → Thai") filters the neural network to highlight only ingredients in that branch. Dim non-matching nodes. Animate camera to focus on the filtered cluster #viz
- [ ] TASK-90: Add tree comparison mode — select two tree nodes (e.g., "French" vs "Thai") and show side-by-side: shared ingredients, unique ingredients, taste profile overlay, pairing pattern differences #analysis

### Personal Profile Trees
- [ ] TASK-91: Build src/data/profileTree.js — construct personal flavor tree from user's profile data: Your Cuisines → Your Ingredients per cuisine → Your Recipes per ingredient. Shows the user's flavor world as a navigable hierarchy #profile
- [ ] TASK-92: Build components/ProfileTreeView.jsx — visual tree representation of the user's flavor profile. Nodes sized by frequency/weight. Highlight gaps: "You love Thai food but haven't tried lemongrass or galangal". Show suggested branches to explore #ui
- [ ] TASK-93: Add "Flavor DNA" comparison — compare user's profile tree against cuisine trees to compute similarity scores. "Your profile is 45% Italian, 30% Thai, 15% Mexican, 10% French". Show as a radar chart + tree overlay #analysis
- [ ] TASK-94: Add profile tree export — generate a shareable "Flavor Passport" image showing the user's tree structure, top ingredients, cuisine affinities, and flavor signature. Downloadable as PNG #profile

## Phase 16: Polish & Deploy v2
- [ ] TASK-95: Update walkthrough tour with new features (recipe scanning, quiz, tree navigation, flavor DNA) #demo
- [ ] TASK-96: Performance optimization — lazy-load Tesseract.js for scanning, debounce quiz scoring, virtualize tree lists for large profiles #polish
- [ ] TASK-97: Deploy updated app to Firebase Hosting #deploy
- [ ] TASK-98: Data integrity tests v2 — validate quiz scoring maps to correct ingredients, recipe scraping handles edge cases, tree structures are complete and acyclic #testing
