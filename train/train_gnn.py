"""
NeuralFlavor GAT Training Pipeline

Reads ingredients.json + pairings.json from public/proDataset/,
trains a Graph Attention Network, and writes back enriched data
with embeddings, clusters, and novel pairing candidates.

Usage:
  cd train
  pip install -r requirements.txt
  python train_gnn.py
"""

import json
import os
import torch
import numpy as np
from torch_geometric.data import Data
from sklearn.cluster import KMeans
from sklearn.metrics.pairwise import euclidean_distances
from sklearn.linear_model import Ridge
from collections import defaultdict
import umap
from model import FlavorGAT

DATA_DIR = os.path.join(os.path.dirname(__file__), '..', 'public', 'proDataset')

# ── 1. Load JSON ──────────────────────────────────────────────────────────────
print("Loading data...")
with open(os.path.join(DATA_DIR, 'ingredients.json')) as f:
    ingredients_raw = json.load(f)
with open(os.path.join(DATA_DIR, 'pairings.json')) as f:
    pairings = json.load(f)

# Our ingredients.json is a dict keyed by ingredient name
# Convert to array format for processing
if isinstance(ingredients_raw, dict):
    ingredients = []
    for name, data in ingredients_raw.items():
        entry = dict(data)
        entry['name'] = name
        ingredients.append(entry)
elif isinstance(ingredients_raw, list):
    ingredients = ingredients_raw
else:
    ingredients = []

# Build name-to-index mapping
id_to_idx = {}
for i, ing in enumerate(ingredients):
    name = (ing.get('id') or ing.get('name') or '').lower().strip()
    id_to_idx[name] = i
    ing['_idx'] = i
    ing['_id'] = name

print(f"  {len(ingredients)} ingredients, {len(pairings)} pairings")

# ── 2. Node features: taste profile (8 dims) ─────────────────────────────────
# Our data has 'taste' as a string like "sweet", "sweet sour", etc.
# Convert to 8-dim vector

TASTE_ORDER = ['sweet', 'sour', 'bitter', 'salty', 'umami', 'spicy', 'pungent', 'astringent']

def taste_to_vector(taste_str):
    vec = [0.0] * 8
    if not taste_str:
        return vec
    t = taste_str.lower()
    for i, taste in enumerate(TASTE_ORDER):
        if taste in t:
            vec[i] = 0.8
    # If nothing matched, give a small default
    if sum(vec) == 0:
        vec = [0.1] * 8
    return vec

# Check if ingredients have flavorProfile (new format) or taste (old format)
sample = ingredients[0] if ingredients else {}
if 'flavorProfile' in sample:
    node_features = torch.tensor([
        [ing['flavorProfile'].get(t, 0.0) for t in TASTE_ORDER]
        for ing in ingredients
    ], dtype=torch.float)
else:
    node_features = torch.tensor([
        taste_to_vector(ing.get('taste', ''))
        for ing in ingredients
    ], dtype=torch.float)

print(f"  Node features shape: {node_features.shape}")

# ── 3. Edge index + edge features ────────────────────────────────────────────
# 13 features per edge: [tradition, chemistry, novelty, balance, bridging, x1..x8]

EDGE_KEYS = ['tradition', 'chemistry', 'novelty', 'balance', 'bridging']
BD_KEYS = [f'x{i}' for i in range(1, 9)]

def edge_feats(p):
    top = [p.get(k) or 0.0 for k in EDGE_KEYS]
    bd = p.get('breakdown') or {}
    return top + [bd.get(k) or 0.0 for k in BD_KEYS]

src_list, tgt_list, feat_list, weight_list = [], [], [], []
skipped = 0

for p in pairings:
    # Handle both field naming conventions
    source = (p.get('source') or p.get('ingredientA') or '').lower().strip()
    target = (p.get('target') or p.get('ingredientB') or '').lower().strip()

    if source not in id_to_idx or target not in id_to_idx:
        skipped += 1
        continue

    s, t = id_to_idx[source], id_to_idx[target]
    f = edge_feats(p)
    w = p.get('strength') or 1.0

    # Bidirectional
    src_list += [s, t]
    tgt_list += [t, s]
    feat_list += [f, f]
    weight_list += [w, w]

print(f"  {len(src_list) // 2} edges loaded ({skipped} skipped)")

edge_index = torch.tensor([src_list, tgt_list], dtype=torch.long)
edge_attr = torch.tensor(feat_list, dtype=torch.float)
edge_w = torch.tensor(weight_list, dtype=torch.float)
graph = Data(x=node_features, edge_index=edge_index, edge_attr=edge_attr)

# ── 4. Train ──────────────────────────────────────────────────────────────────
print("Training GAT...")
model = FlavorGAT(node_in=8)
optimizer = torch.optim.Adam(model.parameters(), lr=0.01)

for epoch in range(300):
    model.train()
    optimizer.zero_grad()
    emb = model(graph.x, graph.edge_index, graph.edge_attr)
    dist = (emb[edge_index[0]] - emb[edge_index[1]]).pow(2).sum(dim=1)
    loss = (dist * edge_w).mean()
    loss.backward()
    optimizer.step()
    if epoch % 50 == 0:
        print(f"  Epoch {epoch:3d} | Loss: {loss.item():.4f}")

# ── 5. Extract full embeddings ────────────────────────────────────────────────
model.eval()
with torch.no_grad():
    full_emb = model(graph.x, graph.edge_index, graph.edge_attr).numpy()

print(f"  Embedding shape: {full_emb.shape}")

# ── 6. Project to 3D for Three.js ────────────────────────────────────────────
print("Projecting to 3D with UMAP...")
reducer = umap.UMAP(n_components=3, n_neighbors=15, min_dist=0.1, random_state=42)
coords3d = reducer.fit_transform(full_emb)
coords3d = (coords3d - coords3d.mean(0)) / (coords3d.std(0) + 1e-8)

# ── 7. Cluster ────────────────────────────────────────────────────────────────
print("Clustering...")
n_clusters = min(8, len(ingredients))
kmeans = KMeans(n_clusters=n_clusters, random_state=42, n_init=10)
cluster_ids = kmeans.fit_predict(full_emb)

CLUSTER_LABELS = [
    "sweet-floral", "acidic-bright", "earthy-savory", "bitter-umami",
    "spicy-warm", "fresh-herbal", "smoky-rich", "creamy-mild"
]
CLUSTER_COLORS = [
    "#FAC775", "#5DCAA5", "#97C459", "#7F77DD",
    "#F0997B", "#85B7EB", "#888780", "#F4C0D1"
]

# ── 8. Novelty predictor ─────────────────────────────────────────────────────
print("Training novelty predictor...")
dist_matrix = euclidean_distances(full_emb)
known_set = set()
nov_X, nov_y = [], []

for p in pairings:
    source = (p.get('source') or p.get('ingredientA') or '').lower().strip()
    target = (p.get('target') or p.get('ingredientB') or '').lower().strip()
    if source not in id_to_idx or target not in id_to_idx:
        continue
    i, j = id_to_idx[source], id_to_idx[target]
    known_set.add((min(i, j), max(i, j)))
    if p.get('novelty') is not None:
        d = float(dist_matrix[i, j])
        nov_X.append([d] + [p.get(k) or 0.0 for k in EDGE_KEYS])
        nov_y.append(p['novelty'])

if len(nov_X) > 10:
    nov_reg = Ridge().fit(nov_X, nov_y)
else:
    nov_reg = None
    print("  Warning: not enough novelty data for predictor")

# ── 9. Discover novel candidates ─────────────────────────────────────────────
print("Discovering novel candidates...")

# Find a reasonable threshold from the distance distribution
known_dists = []
for (i, j) in known_set:
    known_dists.append(float(dist_matrix[i, j]))

if known_dists:
    p15 = np.percentile(known_dists, 15)
    p25 = np.percentile(known_dists, 25)
    p50 = np.percentile(known_dists, 50)
    print(f"  Known pair distances: p15={p15:.3f}, p25={p25:.3f}, p50={p50:.3f}")
    DISTANCE_THRESHOLD = max(0.3, p25)
else:
    DISTANCE_THRESHOLD = 0.5

print(f"  Using distance threshold: {DISTANCE_THRESHOLD:.3f}")

novel_candidates = []
MAX_NOVELS = 200  # cap to keep data size reasonable

for i in range(len(ingredients)):
    if len(novel_candidates) >= MAX_NOVELS:
        break
    for j in range(i + 1, len(ingredients)):
        if (i, j) in known_set:
            continue
        d = float(dist_matrix[i, j])
        if d > DISTANCE_THRESHOLD:
            continue
        pred_nov = 0.5
        if nov_reg is not None:
            pred_nov = float(nov_reg.predict([[d, 0, 0, 0, 0, 0]])[0])
            pred_nov = round(max(0.0, min(1.0, pred_nov)), 3)

        novel_candidates.append({
            "ingredientA": ingredients[i]['_id'],
            "ingredientB": ingredients[j]['_id'],
            "strength": round(float(1 - d / DISTANCE_THRESHOLD), 3),
            "tradition": None,
            "chemistry": None,
            "novelty": None,
            "balance": None,
            "bridging": None,
            "breakdown": None,
            "sharedCompounds": [],
            "explanation": None,
            "known": False,
            "predictedNovelty": pred_nov,
            "flavorDistance": round(d, 4)
        })
        if len(novel_candidates) >= MAX_NOVELS:
            break

print(f"  {len(novel_candidates)} novel pairing candidates discovered")

# ── 10. Compute bridgingScore per ingredient ──────────────────────────────────
bridging_totals = defaultdict(list)
for p in pairings:
    b = p.get('bridging')
    source = (p.get('source') or p.get('ingredientA') or '').lower().strip()
    target = (p.get('target') or p.get('ingredientB') or '').lower().strip()
    if b is not None:
        bridging_totals[source].append(b)
        bridging_totals[target].append(b)

# ── 11. Write back ────────────────────────────────────────────────────────────
print("Writing enriched data...")

# Scale coords for Three.js scene (spread out more)
SCENE_SCALE = 40.0

for i, ing in enumerate(ingredients):
    ing['embedding'] = {
        'x': round(float(coords3d[i, 0]) * SCENE_SCALE, 4),
        'y': round(float(coords3d[i, 1]) * SCENE_SCALE, 4),
        'z': round(float(coords3d[i, 2]) * SCENE_SCALE, 4),
    }
    ing['embeddingFull'] = [round(float(v), 4) for v in full_emb[i]]
    ing['cluster'] = int(cluster_ids[i])
    ing['clusterLabel'] = CLUSTER_LABELS[int(cluster_ids[i]) % len(CLUSTER_LABELS)]
    bid = ing['_id']
    ing['bridgingScore'] = round(
        float(np.mean(bridging_totals[bid])) if bridging_totals.get(bid) else 0.0, 4
    )
    # Clean up internal keys
    del ing['_idx']
    del ing['_id']

# Add known/predictedNovelty/flavorDistance to existing pairings
for p in pairings:
    source = (p.get('source') or p.get('ingredientA') or '').lower().strip()
    target = (p.get('target') or p.get('ingredientB') or '').lower().strip()
    if source not in id_to_idx or target not in id_to_idx:
        p['known'] = True
        p['predictedNovelty'] = 0.5
        p['flavorDistance'] = 0.0
        continue
    i, j = id_to_idx[source], id_to_idx[target]
    d = float(dist_matrix[i, j])
    pred = 0.5
    if nov_reg is not None:
        pred = float(nov_reg.predict([[d] + [p.get(k) or 0.0 for k in EDGE_KEYS]])[0])
    p['known'] = True
    p['predictedNovelty'] = round(max(0.0, min(1.0, pred)), 3)
    p['flavorDistance'] = round(d, 4)

# Write ingredients — preserve original dict format
out_ingredients = os.path.join(DATA_DIR, 'ingredients.json')
if isinstance(ingredients_raw, dict):
    out_dict = {}
    for ing in ingredients:
        name = ing['_id'] if '_id' in ing else ing.get('name', '')
        entry = {k: v for k, v in ing.items() if k not in ('_idx', '_id', 'name')}
        out_dict[name] = entry
    with open(out_ingredients, 'w') as f:
        json.dump(out_dict, f)
else:
    with open(out_ingredients, 'w') as f:
        json.dump(ingredients, f)
print(f"  Wrote {out_ingredients} ({len(ingredients)} ingredients)")

# Write pairings (known + novel)
out_pairings = os.path.join(DATA_DIR, 'pairings.json')
all_pairings = pairings + novel_candidates
with open(out_pairings, 'w') as f:
    json.dump(all_pairings, f)
print(f"  Wrote {out_pairings} ({len(pairings)} known + {len(novel_candidates)} novel)")

# Write metadata
metadata = {
    "version": "2.0",
    "ingredientCount": len(ingredients),
    "pairingCount": len(pairings),
    "novelPairingCount": len(novel_candidates),
    "embeddingDim": 8,
    "embeddingDim3D": 3,
    "clusterCount": n_clusters,
    "clusters": [
        {"id": k, "label": CLUSTER_LABELS[k % len(CLUSTER_LABELS)],
         "color": CLUSTER_COLORS[k % len(CLUSTER_COLORS)]}
        for k in range(n_clusters)
    ],
    "edgeFeatures": EDGE_KEYS + BD_KEYS,
    "gnnModel": "GAT",
    "gnnTrainedAt": __import__('datetime').datetime.now().isoformat(),
    "distanceThreshold": DISTANCE_THRESHOLD,
    "sceneScale": SCENE_SCALE,
}
out_metadata = os.path.join(DATA_DIR, 'metadata.json')
with open(out_metadata, 'w') as f:
    json.dump(metadata, f, indent=2)
print(f"  Wrote {out_metadata}")

print(f"\nDone. {len(ingredients)} ingredients, {len(pairings)} known, "
      f"{len(novel_candidates)} novel.")
