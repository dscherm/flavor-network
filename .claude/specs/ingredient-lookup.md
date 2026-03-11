# Spec: Ingredient Lookup Tool

## Overview
Two-part ingredient lookup: in-app search UI + REST API endpoint.

## In-App Search (SearchBar component)
- Fuzzy search powered by Fuse.js over ingredient names
- Autocomplete dropdown showing top 8 matches as user types
- Each result shows: ingredient name, primary cuisine, taste profile
- Clicking a result:
  1. Selects the node in the 3D scene
  2. Flies camera to center on that node
  3. Opens IngredientPanel drilldown
- Keyboard: `/` focuses search, Escape clears, arrow keys navigate results, Enter selects

## IngredientPanel Drilldown
When an ingredient is selected (via search or 3D click), show:
- **Name** (large heading)
- **Metadata**: taste, weight, volume, season, tips (from ingredient_metadata.csv)
- **Cuisines**: list of cuisines this ingredient belongs to (from cuisines.csv)
- **Top Pairings**: ranked list of paired ingredients with visual strength indicator
- **Flavor Affinities**: multi-ingredient combos (from affinities.csv)
- **Similar Ingredients**: top 10 by embedding cosine similarity
- Panel slides in from right side, overlaid on 3D scene
- Close button or click elsewhere to dismiss

## REST API
Base URL: `http://localhost:3001/api`

### GET /api/ingredient/:name
Returns full ingredient profile:
```json
{
  "name": "garlic",
  "metadata": { "taste": "pungent", "weight": "medium", "volume": "loud", "season": null, "tips": "..." },
  "cuisines": ["italian cuisine", "chinese cuisine", "french cuisine", ...],
  "pairings": [{ "ingredient": "onions", "strength": 1.0 }, ...],
  "affinities": ["garlic + olive oil + pasta", ...],
  "similar": [{ "ingredient": "shallots", "score": 0.92 }, ...]
}
```

### GET /api/search?q=gar
Returns top 10 fuzzy matches:
```json
{
  "query": "gar",
  "results": [
    { "name": "garlic", "score": 0.95 },
    { "name": "garam masala", "score": 0.72 }
  ]
}
```

### GET /api/pairings/:ingredient1/:ingredient2
Returns shared connections:
```json
{
  "ingredient1": "garlic",
  "ingredient2": "basil",
  "direct_pairing": true,
  "shared_pairings": ["tomatoes", "olive oil", "pasta"],
  "shared_cuisines": ["italian cuisine"]
}
```
