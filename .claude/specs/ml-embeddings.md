# Spec: ML Ingredient Embeddings

## Overview
Train ingredient embeddings from pairing co-occurrence data, then project to 3D for layout.

## Embedding Training
- **Model**: Skip-gram style (Word2Vec approach) using TensorFlow.js
- **Input**: Co-occurrence pairs from ingredients.csv (each row = ingredient-pairing pair)
- **Embedding dimension**: 32 (compromise between expressiveness and compute)
- **Training**: Run offline via `npm run train`, export to `public/embeddings.json`
- **Epochs**: 50, learning rate 0.01, batch size 64

## Co-occurrence Matrix
- Parse ingredients.csv: each row is `ingredient,paired_ingredient`
- Build adjacency list: for each ingredient, list all paired ingredients
- Generate skip-gram pairs: (ingredient, paired_ingredient) and (paired_ingredient, ingredient)
- Vocabulary: all unique ingredient names (~380 ingredients)

## 3D Projection
- **Method**: UMAP (via umap-js library)
- **Parameters**: n_components=3, n_neighbors=15, min_dist=0.1
- **Input**: 32-dim embedding vectors
- **Output**: [x, y, z] positions for each ingredient
- **Normalization**: Scale to [-500, 500] range for Three.js scene

## Similarity Search
- Cosine similarity between embedding vectors
- Given ingredient A, return top-K most similar ingredients
- Used by IngredientPanel to show "Similar Ingredients" section
- Pre-compute all-pairs similarity matrix for fast lookup (380x380 = 144K entries)

## Output Format
```json
{
  "vocabulary": ["achiote seeds", "allspice", ...],
  "embeddings": [[0.12, -0.34, ...], ...],
  "positions3d": [[120.5, -45.2, 230.1], ...],
  "similarity": { "garlic": [["onions", 0.95], ["shallots", 0.92], ...] }
}
```

## Fallback
If embeddings fail to train or UMAP errors, fall back to force-directed 3D layout using cuisine cluster centers (similar to original flavor-map approach but in 3D).
