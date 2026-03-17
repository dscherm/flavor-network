# Labs — PRD

## Overview

The Flavor Network includes three specialized lab environments, each accessible via a **Labs dropdown** in the top navigation bar. The navigation uses two top-level elements: a `Network` tab and a `Labs` dropdown that contains Cocktail Lab, Sauce Lab, and Recipe Lab. When a lab is active, the dropdown button shows the active lab's name and a cyan highlight.

### Lab Summary

| Lab | Purpose | Rendering | Key Feature |
|-----|---------|-----------|-------------|
| **Cocktail Lab** | Cocktail creation with Codex-based positioning | 3D (Three.js NetworkScene) | Ingredient swap, template detection |
| **Sauce Lab** | Sauce building with mother-sauce axis positioning | 3D (Three.js NetworkScene) | Mother sauce templates, builder |
| **Recipe Lab** | General recipe planning on a 2D notebook canvas | 2D (Canvas API) | Radial taste layout, pencil aesthetic |

---

## Navigation

- **Top nav bar**: `Network` button + `Labs ▾` dropdown
- `Network` = the existing Flavor Network (unchanged)
- `Labs ▾` dropdown contains: Cocktail Lab, Sauce Lab, Recipe Lab
- Active lab name replaces "Labs" text in the dropdown button
- Each lab is **lazy-mounted** on first open and stays mounted for instant switching
- Switching between labs or back to Network swaps the entire view

---

## Recipe Lab (2D Canvas)

### Concept
A notebook-pad-style 2D visualization for planning recipes. Users search for a center ingredient, and its pairings radiate outward grouped by dominant taste axis. The aesthetic is a yellow ruled notebook with colored-pencil-style ingredient nodes.

### Visual Design
- **Background**: Yellow ruled paper (#fefae0), horizontal lines, red margin line
- **Center ingredient**: Rhombus (diamond) shape, filled with blended flavor-profile color
- **Strong pairings** (>=22% match): 5-point star shapes
- **Normal pairings**: Text-fitted ovals (sized to ingredient name)
- **All colors**: Desaturated pencil-texture tints from TASTE_COLORS
- **Font**: Caveat (Google Fonts handwritten)
- **Taste axis lines**: 8 faint dashed radials, dark-tinted labels at edges
- **Connection lines**: Wobbly pencil strokes from center to each pairing

### Layout Algorithm (recipeLayout.js)
- 8 taste axes at 45° intervals
- Pairings grouped by dominant taste channel (via scoreIngredient)
- Stronger pairings closer to center, weaker farther out
- Staggered rings to reduce initial clumping
- **Force-directed repulsion** (up to 80 iterations) eliminates all overlaps
- Node bounds include 6px gap margin
- Technique/non-food items filtered out of canvas

### Interactions
- Pan (click-drag), zoom (scroll/pinch)
- Click pairing → add to recipe list
- Click recipe ingredient → re-center canvas on it
- Hover → tooltip with match percentage

### Recipe Panel (right sidebar)
- Recipe title input
- Ingredient list with taste-color badges
- Center ingredient marked with diamond + "center" badge
- Re-center / remove buttons per ingredient
- **Common Techniques** section (filtered non-food items like "grill pan")
- Compatibility score (avg pairwise strength)
- Save / Clear buttons

### Technique Filtering
Items matching technique/non-food patterns (grill pan, foil, cooking spray, etc.) are excluded from the canvas and shown separately in the recipe panel.

### Cross-Lab Recipe Modes
The Recipe Lab can be entered in three modes via the Labs dropdown:
- **Recipe Lab** (taste mode) — default 8 taste axes, no structure templates
- **Cocktail Recipe** — cocktail codex axes (Spirit-forward/Modified, Short/Long), structure selector with 6 Codex templates
- **Sauce Recipe** — mother sauce axes (Light/Rich, Mild/Bold), structure selector with 10 sauce templates

### Structure Selector (top-left dropdown)
When in cocktail or sauce recipe mode, a subtle dropdown in the top-left corner lets users select a structure template:

**Cocktail Codex Templates:**
| Template | Structure | Hand-drawn Icon |
|----------|-----------|-----------------|
| Old Fashioned | Spirit + Sugar + Bitters | Rocks glass |
| Martini | Spirit + Vermouth | Martini glass |
| Daiquiri | Spirit + Citrus + Sugar | Coupe glass |
| Sidecar | Spirit + Liqueur + Citrus | Coupe with sugar rim |
| Highball | Spirit + Lengthener | Tall glass with bubbles |
| Flip | Spirit + Sugar + Egg | Wine glass |

**Mother Sauce Templates:**
| Template | Structure | Hand-drawn Icon |
|----------|-----------|-----------------|
| Béchamel | Roux + Milk | Pot with lid |
| Velouté | Roux + Stock | Ladle |
| Espagnole | Roux + Stock + Mirepoix | Deep pot |
| Tomato | Tomato + Aromatics + Herbs | Tomato |
| Hollandaise | Butter + Egg + Acid | Whisk |
| Curry | Fat + Aromatics + Spices | Bowl with steam |
| Stir-fry | Soy/Fish Sauce + Aromatics | Wok |
| Mole | Chilies + Spices + Chocolate | Mortar & pestle |
| Salsa | Tomato + Chili + Herbs | Chili pepper |
| Nut Sauce | Peanut/Tahini + Acid | Peanut shape |

### Structure Scoring (Recipe Panel)
- **Selected structure adherence**: Confidence bar (0-100%) showing how well ingredients match the template's required roles. Lists missing roles.
- **"Starting to look like..."**: When no structure is selected (or the best match differs), shows the highest-scoring template with confidence. At >=70% says "This is a [name]!". Also shows runner-up if close.
- Uses ProData ingredient categories mapped to cocktail/sauce roles via `structureScoring.js`.
- Structure selection does NOT filter pairings — all pairings remain visible. Scoring is informational.

---

## Cocktail Lab (3D Scene)

---

## Cocktail Network (3D Scene)

### Ingredient Scope
Focused subset of cocktail-relevant ingredients only:
- **Spirits**: vodka, gin, rum, tequila, whiskey, brandy, cognac, mezcal, sake, bourbon
- **Liqueurs**: amaretto, triple sec, Cointreau, Campari, Aperol, Chartreuse, Kahlua, Maraschino, St-Germain, Benedictine, Drambuie, Curaçao
- **Vermouth & Aromatized Wine**: dry vermouth, sweet vermouth, Lillet, Dubonnet
- **Bitters**: Angostura, Peychaud's, orange bitters, chocolate bitters
- **Citrus**: lemon, lime, orange, grapefruit, yuzu
- **Sweeteners**: simple syrup, honey, agave, grenadine, maple syrup, sugar, demerara syrup, orgeat
- **Lengtheners**: soda water, tonic water, ginger beer, ginger ale, cola, prosecco, champagne
- **Dairy/Egg**: egg white, heavy cream, coconut cream
- **Herbs & Aromatics**: mint, basil, rosemary, thyme, lavender, ginger, cinnamon, vanilla, nutmeg, clove, star anise
- **Other**: coffee, chocolate, tea, olive, cherry, cucumber, jalapeño, salt, black pepper

### Cocktail Codex Positioning (3D Axes)

Positions derived from the Cocktail Codex 6-template framework:

| Template | Structure | Role in Axis System |
|----------|-----------|-------------------|
| Old Fashioned | Spirit + Sugar + Bitters | Spirit-forward, short, simple |
| Martini | Spirit + Vermouth | Spirit-forward, short, moderate complexity |
| Daiquiri | Spirit + Citrus + Sugar | Balanced, short, moderate |
| Sidecar | Spirit + Citrus + Liqueur | Modified, short, complex |
| Whiskey Highball | Spirit + Lengthener | Spirit-forward, long, simple |
| Flip | Spirit + Sugar + Dairy/Egg | Modified, short, rich/complex |

**Axes:**
- **X**: Spirit-forward (dry) ←→ Modified (sweet/liqueur-heavy)
  - Spirits, bitters, vermouth cluster left
  - Liqueurs, sweeteners, dairy cluster right
- **Y**: Short/Concentrated ←→ Long/Diluted
  - Neat spirits, bitters, syrups at bottom
  - Soda, tonic, ginger beer, champagne at top
- **Z**: Simple/Classic ←→ Complex/Layered
  - Core ingredients (spirit, citrus, sugar) at front
  - Specialty ingredients (herbs, spices, exotic liqueurs) at back

Each ingredient gets a Codex role vector based on which templates it commonly appears in and what structural role it plays (base, modifier, sweetener, accent, lengthener). Jitter and neighbor gravity fill in gaps, same as the taste positioning system.

### Edges
- Pairing edges from the Flavor Bible (existing data)
- Additional edges inferred from CocktailDB co-occurrence (ingredients that appear together in cocktails get edges, strength = frequency of co-occurrence)
- Visual: same glow/particle system as the main network

---

## Data Pipeline

### Phase 1: Seed from TheCocktailDB
- Fetch cocktails by base spirit for all major spirits
- Extract ingredient lists, normalize names to canonical forms
- Build co-occurrence matrix: if two ingredients appear in the same cocktail, they get an edge
- Edge strength = number of cocktails they co-occur in, normalized to 0-1
- Cache all API responses in localStorage (keyed by query, with timestamp)

### Phase 2: Merge with Flavor Bible
- Overlay Flavor Bible pairing edges where they exist (these are flavor-science backed, higher quality)
- When both sources have an edge, take the max strength
- Flavor Bible edges that connect cocktail ingredients are included even if CocktailDB doesn't have them

### Phase 3: Manual Curation
- Define a curated set of cocktail-specific nodes not in the Flavor Bible (simple syrup, Angostura, tonic water, etc.)
- Hand-define key pairing edges for these (e.g., Angostura ↔ whiskey = 0.9, tonic ↔ gin = 0.95)
- Store as a static JSON file (`public/data/cocktail_augment.json`)

---

## Features

### 1. Cocktail Lookup
- **Search bar** at top: search TheCocktailDB by cocktail name
- Results appear as cards in a dropdown
- Selecting a cocktail:
  - Highlights its ingredients on the network (activation spread)
  - Shows edges between the cocktail's ingredients
  - Opens a **recipe card** in the side panel with: name, image, glass type, ingredients + measures, instructions
  - Each ingredient in the recipe card is clickable for swapping

### 2. Ingredient Swap (Alternatives)
- Click any ingredient in a looked-up cocktail to enter **swap mode**
- The network highlights neighbor nodes connected to the selected ingredient
- Edge brightness = pairing strength with the other cocktail ingredients
- A **ranked alternatives list** appears in the side panel:
  - Sorted by average pairing strength with the remaining cocktail ingredients
  - Shows compatibility score (0-10)
  - Click an alternative to preview the swap — network updates in real-time
  - "Accept swap" button confirms the change to the working recipe

### 3. Cocktail Builder
- **Bidirectional**: click nodes on the network OR search/select in the side panel — both stay in sync
- As ingredients are added:
  - Network highlights selected nodes
  - Edges between selected ingredients glow (showing compatibility)
  - An overall **compatibility score** is computed (average pairwise pairing strength)
  - The side panel shows the ingredient list with quantity fields
- **Codex template detection**: as user builds, identify which Codex template they're closest to and suggest missing components
  - e.g., "You have Spirit + Citrus — add a sweetener for a Daiquiri structure, or a Liqueur for a Sidecar"
- **Suggestion engine**: based on current ingredients, suggest what to add next (highest average pairing strength with existing ingredients)

### 4. Save & Share
- Save cocktails to user's flavor profile (localStorage + Firebase sync)
- Separate `cocktails` array in the profile schema:
  ```
  { name, ingredients: [{name, quantity, unit}], instructions, template, createdAt }
  ```
- **Export as image**: Canvas-rendered cocktail card (similar to Flavor Passport) with:
  - Cocktail name, ingredient list with measurements
  - Mini network visualization showing ingredient connections
  - Codex template badge
  - Downloads as PNG
- Saved cocktails appear in a "My Cocktails" section in the side panel

---

## UI Layout

```
┌─────────────────────────────────────────────────────┐
│  Network  │  Labs ▾                                 │  ← tab bar
├─────────────────────────────────────────────────────┤
│                                        ┌───────────┐│
│                                        │ Search    ││
│                                        │ cocktails ││
│       3D Cocktail Network              │───────────││
│       (Codex-axis positioned)          │ Recipe    ││
│                                        │ Card /    ││
│       click nodes to add               │ Builder   ││
│       ingredients                      │ Panel     ││
│                                        │           ││
│                                        │ Alts list ││
│                                        │           ││
│                                        │ My        ││
│                                        │ Cocktails ││
│                                        └───────────┘│
│  [Axis Labels]   [Codex Template Badge]             │
└─────────────────────────────────────────────────────┘
```

### Side Panel Tabs
- **Lookup**: Search cocktails from CocktailDB, view recipe cards
- **Builder**: Build a cocktail, see compatibility, get suggestions
- **My Cocktails**: Saved creations, export/share

### Axis Labels (subtle, on the 3D scene)
- Floating text labels at axis extremes:
  - X: "Spirit-forward" ←→ "Modified"
  - Y: "Short" ←→ "Long"
  - Z: "Simple" ←→ "Complex"

---

## Technical Architecture

### New Files
```
src/components/CocktailLab.jsx           # Main container (tab content)
src/components/CocktailPanel.jsx         # Side panel (lookup/builder/saved)
src/components/CocktailRecipeCard.jsx    # Recipe display + swap UI
src/components/CocktailBuilder.jsx       # Ingredient builder with sync
src/components/CocktailCard.jsx          # Exportable cocktail image
src/data/cocktailData.js                 # Cocktail ingredient definitions + augmented edges
src/data/cocktailPositioning.js          # Codex-based 3D positioning
src/data/cocktailGraph.js               # Build filtered graph for cocktail ingredients
src/hooks/useCocktailDB.js              # TheCocktailDB API + caching layer
public/data/cocktail_augment.json       # Hand-curated nodes + edges
```

### Modified Files
```
src/App.jsx                              # Add tab nav, CocktailLab state
src/hooks/useUserProfile.js              # Add cocktails[] to profile schema
src/data/ingredientFamilyTree.js         # Add Spirits, Liqueurs, Bitters families
```

### API Integration
- **TheCocktailDB** (free, no auth):
  - Search by name: `GET /api/json/v1/1/search.php?s={name}`
  - Search by ingredient: `GET /api/json/v1/1/filter.php?i={ingredient}`
  - Random: `GET /api/json/v1/1/random.php`
  - Lookup by ID: `GET /api/json/v1/1/lookup.php?i={id}`
- **Caching**: localStorage with `cocktaildb_cache_{query}` keys, 24-hour TTL

### Reused Infrastructure
- `NetworkScene.jsx` — instantiated separately for cocktail scene
- `NodeMesh.js` / `EdgeMesh.js` / `ParticleSystem.js` — same rendering
- `SceneManager.js` — same camera/controls/post-processing
- `SearchBar.jsx` — reused with cocktail ingredient list
- Activation spread / edge highlighting — existing APIs

---

## Implementation Phases

### Phase 1: Foundation
1. Add top-level tab navigation to App.jsx
2. Create `cocktailData.js` with cocktail ingredient definitions
3. Create `cocktail_augment.json` with curated nodes + edges
4. Build `cocktailGraph.js` to construct the cocktail-only subgraph
5. Build `cocktailPositioning.js` with Codex-axis vectors
6. Create `CocktailLab.jsx` rendering its own NetworkScene with cocktail data
7. Verify: cocktail network renders with Codex-based positions

### Phase 2: Lookup & Swap
8. Build `useCocktailDB.js` hook with caching
9. Create `CocktailPanel.jsx` with Lookup tab
10. Create `CocktailRecipeCard.jsx` — display recipe, highlight on network
11. Implement ingredient swap mode — network highlights alternatives
12. Add ranked alternatives list in panel
13. Real-time swap preview — click alternative, network updates

### Phase 3: Builder
14. Create `CocktailBuilder.jsx` — bidirectional ingredient selection
15. Sync builder ↔ network (click node adds to builder, search adds to network)
16. Compatibility score computation (average pairwise strength)
17. Codex template detection + suggestions
18. "What to add next" suggestion engine

### Phase 4: Save & Share
19. Add `cocktails[]` to user profile schema
20. Save/load cocktails from profile
21. My Cocktails tab in panel
22. Create `CocktailCard.jsx` — canvas-rendered exportable image
23. Export as PNG

### Phase 5: Polish
24. Axis labels on the 3D scene
25. Codex template badge overlay
26. Smooth transitions between tab views
27. Mobile-responsive panel layout
28. Loading states for API calls

---

## Success Criteria
- Cocktail network renders with clear Codex-based spatial organization
- Users can look up any cocktail from TheCocktailDB and see it on the network
- Ingredient swaps show meaningful alternatives ranked by pairing strength
- Building a cocktail on the network feels intuitive (click + visual feedback)
- Saved cocktails persist across sessions
- Exported cocktail cards look polished and shareable
