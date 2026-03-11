# Skill: /train-embeddings

Train ingredient embeddings and export pre-computed data.

## Phases
1. **Parse** — Load ingredients.csv and build co-occurrence pairs
2. **Train** — Run skip-gram training via TensorFlow.js (50 epochs)
3. **Project** — UMAP projection to 3D coordinates
4. **Similarity** — Compute top-K similar ingredients per ingredient
5. **Export** — Write public/embeddings.json with vocabulary, positions, similarity
6. **Validate** — Verify output file is valid JSON and reasonable size

## Usage
```
/train-embeddings
```
