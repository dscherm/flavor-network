# NeuralFlavor — GNN upgrade: data schema & architecture

## Context

Your current app (`neuralflavor.web.app`) uses a **perceptron** to score ingredient pairings
and renders the result as a Three.js force graph. The perceptron scores each pair in isolation —
it has no concept of the *network* of relationships between ingredients.

The upgrade replaces the perceptron with a **Graph Attention Network (GAT)**. The GAT uses
your rich edge features (`tradition`, `chemistry`, `novelty`, `balance`, `bridging`) to learn
*how much attention* to pay to each neighbor when building an ingredient's embedding.
Crucially, because `novelty` already exists on known pairs, the model can learn what
novelty *looks like* and predict it for pairs it has never seen.

**Architectural decision:** The GAT runs offline in Python and writes its output back
into your existing static JSON files. Firebase Hosting, `useProData.js`, and Three.js
all stay largely the same — they just receive richer data.

---

## Why GAT instead of plain GCN

A plain GCN (Graph Convolutional Network) treats all neighbors equally — chocolate learns
from coffee and from salt with the same weight. A GAT reads your edge attributes and learns
*which neighbors matter more*. A high-`chemistry` edge means "these two share compounds —
pay close attention." A high-`tradition` edge means "this is a classic pairing — trust it."

Think of it like a chef consulting their network: they don't weigh every colleague's opinion
equally. They weight it by the *type* of relationship.

---

## Actual pairing schema (your current data)

```json
{
  "source": "chocolate_dark",
  "target": "coffee",
  "strength": 0.949,
  "tradition": 0.523,
  "chemistry": 0.420,
  "novelty": 0.477,
  "balance": 0.600,
  "bridging": 1.000,
  "breakdown": {
    "x1": 0.82, "x2": 0.67, "x3": 0.44,
    "x4": 0.91, "x5": 0.33, "x6": 0.58,
    "x7": 0.72, "x8": 0.49
  },
  "sharedCompounds": ["pyrazine", "vanillin"],
  "explanation": "Both share roasted, bitter flavor compounds..."
}
```

**What each field means for the GNN:**

| Field | Role in GNN | Notes |
|---|---|---|
| `strength` | Training target + edge weight | Perceptron sigmoid output — used to weight the loss |
| `tradition` | Edge feature | How established the pairing is culturally |
| `chemistry` | Edge feature | Compound overlap score |
| `novelty` | Edge feature + prediction target | The GNN learns to predict this for novel candidates |
| `balance` | Edge feature | Flavor balance between the two ingredients |
| `bridging` | Edge feature | Whether this pairing bridges flavor clusters |
| `breakdown.x1–x8` | Edge features | Raw perceptron inputs — reused as graph edge attributes |
| `sharedCompounds` | Supplementary | Sparse now; will improve with FooDB data later |
| `explanation` | Preserved as-is | Not used in training; passed through to frontend |

The `breakdown.x1–x8` values are particularly valuable: they're the raw signal the
perceptron was already using. The GAT gets to use them *plus* graph structure.

---

## Upgraded data schema

### `ingredients.json` — new fields added

```json
{
  "id": "chocolate_dark",
  "name": "Dark Chocolate",
  "category": "confectionery",
  "flavorProfile": {
    "sweet": 0.6,
    "bitter": 0.8,
    "sour": 0.1,
    "salty": 0.05,
    "umami": 0.3
  },
  "compounds": ["theobromine", "vanillin"],

  "embedding": {
    "x": -0.42,
    "y": 0.71,
    "z": -0.18
  },
  "embeddingFull": [-0.42, 0.71, -0.18, 0.33, -0.55, 0.12, 0.88, -0.21],
  "cluster": 3,
  "clusterLabel": "bitter-umami",
  "bridgingScore": 0.82
}
```

| New field | Type | Purpose |
|---|---|---|
| `embedding.x/y/z` | float | Three.js position — plug directly into `mesh.position` |
| `embeddingFull` | float[8] | Full embedding for similarity search |
| `cluster` | int | Flavor cluster index (k-means on embeddings) |
| `clusterLabel` | string | Human-readable cluster name |
| `bridgingScore` | float | Average `bridging` across all this ingredient's edges |

### `pairings.json` — new fields added

All existing fields are preserved unchanged. New fields added:

```json
{
  "source": "chocolate_dark",
  "target": "coffee",
  "strength": 0.949,
  "tradition": 0.523,
  "chemistry": 0.420,
  "novelty": 0.477,
  "balance": 0.600,
  "bridging": 1.000,
  "breakdown": { "x1": 0.82, "x2": 0.67, "x3": 0.44, "x4": 0.91,
                  "x5": 0.33, "x6": 0.58, "x7": 0.72, "x8": 0.49 },
  "sharedCompounds": ["pyrazine", "vanillin"],
  "explanation": "Both share roasted, bitter flavor compounds...",

  "known": true,
  "predictedNovelty": 0.47,
  "flavorDistance": 0.18
}
```

For **novel candidates** discovered by the GAT, the shape is identical except:

```json
{
  "source": "chocolate_dark",
  "target": "blue_cheese",
  "strength": 0.74,
  "tradition": null, "chemistry": null, "novelty": null,
  "balance": null,   "bridging": null,  "breakdown": null,
  "sharedCompounds": [],
  "explanation": null,

  "known": false,
  "predictedNovelty": 0.91,
  "flavorDistance": 0.22
}
```

`null` on edge attributes signals to the frontend that this is a predicted pairing,
not a scored one — style it differently until it gets human-validated.

| New field | Type | Purpose |
|---|---|---|
| `known` | bool | In training data vs. GAT-discovered |
| `predictedNovelty` | float 0–1 | GAT's prediction of how surprising this pairing is |
| `flavorDistance` | float | Euclidean distance in embedding space |

### `metadata.json` — upgraded

```json
{
  "version": "2.0",
  "ingredientCount": 312,
  "categories": ["spice", "fruit", "protein", "dairy", "confectionery"],
  "embeddingDim": 8,
  "embeddingDim3D": 3,
  "clusterCount": 8,
  "clusters": [
    { "id": 0, "label": "sweet-floral",   "color": "#FAC775" },
    { "id": 1, "label": "acidic-bright",  "color": "#5DCAA5" },
    { "id": 2, "label": "earthy-savory",  "color": "#97C459" },
    { "id": 3, "label": "bitter-umami",   "color": "#7F77DD" },
    { "id": 4, "label": "spicy-warm",     "color": "#F0997B" },
    { "id": 5, "label": "fresh-herbal",   "color": "#85B7EB" },
    { "id": 6, "label": "smoky-rich",     "color": "#888780" },
    { "id": 7, "label": "creamy-mild",    "color": "#F4C0D1" }
  ],
  "edgeFeatures": ["tradition", "chemistry", "novelty", "balance", "bridging",
                   "x1","x2","x3","x4","x5","x6","x7","x8"],
  "gnnModel": "GAT",
  "gnnTrainedAt": "2025-03-19",
  "novelPairingCount": 48,
  "knownPairingCount": 1847
}
```

---

## Python training pipeline

### File structure

```
neuralflavor/
  train/
    train_gnn.py        <- main training script
    model.py            <- GAT architecture
    requirements.txt
  public/
    proDataset/
      ingredients.json  <- read + written by train_gnn.py
      pairings.json     <- read + written by train_gnn.py
      metadata.json     <- written by train_gnn.py
```

### `requirements.txt`

```
torch
torch-geometric
scikit-learn
umap-learn
numpy
```

### `model.py`

```python
import torch
import torch.nn.functional as F
from torch_geometric.nn import GATConv

class FlavorGAT(torch.nn.Module):
    """
    Graph Attention Network for flavor embeddings.

    Each ingredient (node) starts with its flavor profile vector (5 dims).
    Each pairing (edge) has 13 features:
      [tradition, chemistry, novelty, balance, bridging, x1..x8]

    Layer 1: 4 attention heads — each reads the edge features to decide
             how much weight to give each neighbor's contribution.
    Layer 2: 1 head — combines into the final 8-dim embedding.

    Analogy: each ingredient runs a "how relevant is this neighbor to me?"
    calculation for every edge, weighted by what kind of pairing it is
    (traditional? chemical? bridging?). That's the attention mechanism.
    """
    def __init__(self, node_in=5, edge_in=13, hidden=16, out=8, heads=4):
        super().__init__()
        self.conv1 = GATConv(node_in, hidden, heads=heads,
                             edge_dim=edge_in, concat=True)
        self.conv2 = GATConv(hidden * heads, out, heads=1,
                             edge_dim=edge_in, concat=False)

    def forward(self, x, edge_index, edge_attr):
        x = F.elu(self.conv1(x, edge_index, edge_attr))
        x = self.conv2(x, edge_index, edge_attr)
        return x
```

### `train_gnn.py`

```python
import json
import torch
import numpy as np
from torch_geometric.data import Data
from sklearn.cluster import KMeans
from sklearn.metrics.pairwise import euclidean_distances
from sklearn.linear_model import Ridge
from collections import defaultdict
import umap
from model import FlavorGAT

# ── 1. Load JSON ──────────────────────────────────────────────────────────────
with open('../public/proDataset/ingredients.json') as f:
    ingredients = json.load(f)
with open('../public/proDataset/pairings.json') as f:
    pairings = json.load(f)

id_to_idx = {ing['id']: i for i, ing in enumerate(ingredients)}

# ── 2. Node features: flavor profile (5 dims) ────────────────────────────────
node_features = torch.tensor([
    [ing['flavorProfile']['sweet'],
     ing['flavorProfile']['bitter'],
     ing['flavorProfile']['sour'],
     ing['flavorProfile']['salty'],
     ing['flavorProfile']['umami']]
    for ing in ingredients
], dtype=torch.float)

# ── 3. Edge index + edge features ────────────────────────────────────────────
# 13 features per edge: [tradition, chemistry, novelty, balance, bridging, x1..x8]
# Edges are bidirectional — same features in both directions.

EDGE_KEYS = ['tradition', 'chemistry', 'novelty', 'balance', 'bridging']
BD_KEYS   = [f'x{i}' for i in range(1, 9)]

def edge_feats(p):
    top = [p.get(k) or 0.0 for k in EDGE_KEYS]
    bd  = p.get('breakdown') or {}
    return top + [bd.get(k) or 0.0 for k in BD_KEYS]

src_list, tgt_list, feat_list, weight_list = [], [], [], []

for p in pairings:
    if p['source'] not in id_to_idx or p['target'] not in id_to_idx:
        continue
    s, t = id_to_idx[p['source']], id_to_idx[p['target']]
    f = edge_feats(p)
    w = p.get('strength') or 1.0
    src_list += [s, t]; tgt_list += [t, s]
    feat_list += [f, f]; weight_list += [w, w]

edge_index = torch.tensor([src_list, tgt_list], dtype=torch.long)
edge_attr  = torch.tensor(feat_list, dtype=torch.float)
edge_w     = torch.tensor(weight_list, dtype=torch.float)
graph = Data(x=node_features, edge_index=edge_index, edge_attr=edge_attr)

# ── 4. Train ──────────────────────────────────────────────────────────────────
# Loss: pull paired ingredients close in embedding space.
# Weight by `strength` — strong pairings must be very close;
# weak pairings have more slack.

model = FlavorGAT()
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
        print(f"Epoch {epoch:3d} | Loss: {loss.item():.4f}")

# ── 5. Extract full embeddings ────────────────────────────────────────────────
model.eval()
with torch.no_grad():
    full_emb = model(graph.x, graph.edge_index, graph.edge_attr).numpy()

# ── 6. Project to 3D for Three.js ────────────────────────────────────────────
reducer  = umap.UMAP(n_components=3, n_neighbors=15, min_dist=0.1, random_state=42)
coords3d = reducer.fit_transform(full_emb)
coords3d = (coords3d - coords3d.mean(0)) / coords3d.std(0)  # normalize to ~[-2, 2]

# ── 7. Cluster ────────────────────────────────────────────────────────────────
kmeans     = KMeans(n_clusters=8, random_state=42, n_init=10)
cluster_ids = kmeans.fit_predict(full_emb)

CLUSTER_LABELS = [
    "sweet-floral", "acidic-bright", "earthy-savory", "bitter-umami",
    "spicy-warm",   "fresh-herbal",  "smoky-rich",    "creamy-mild"
]

# ── 8. Novelty predictor (trained on known pairs) ────────────────────────────
# The GAT can predict novelty for candidate pairs by learning the relationship
# between (distance, edge features) and novelty on known pairs.

dist_matrix = euclidean_distances(full_emb)
known_set   = set()
nov_X, nov_y = [], []

for p in pairings:
    if p['source'] not in id_to_idx or p['target'] not in id_to_idx:
        continue
    i, j = id_to_idx[p['source']], id_to_idx[p['target']]
    known_set.add((min(i,j), max(i,j)))
    if p.get('novelty') is not None:
        d = float(dist_matrix[i, j])
        nov_X.append([d] + [p.get(k) or 0.0 for k in EDGE_KEYS])
        nov_y.append(p['novelty'])

nov_reg = Ridge().fit(nov_X, nov_y)

# ── 9. Discover novel candidates ─────────────────────────────────────────────
# Tune DISTANCE_THRESHOLD: print np.percentile(dist_matrix, [10,25,50]) to
# find a natural breakpoint. Start around the 15th percentile.
DISTANCE_THRESHOLD = 0.5

novel_candidates = []
for i in range(len(ingredients)):
    for j in range(i+1, len(ingredients)):
        if (i, j) in known_set:
            continue
        d = float(dist_matrix[i, j])
        if d > DISTANCE_THRESHOLD:
            continue
        pred_nov = float(nov_reg.predict([[d, 0, 0, 0, 0, 0]])[0])
        pred_nov = round(max(0.0, min(1.0, pred_nov)), 3)
        novel_candidates.append({
            "source": ingredients[i]['id'],
            "target": ingredients[j]['id'],
            "strength": round(float(1 - d / DISTANCE_THRESHOLD), 3),
            "tradition": None, "chemistry": None, "novelty": None,
            "balance": None,   "bridging": None,  "breakdown": None,
            "sharedCompounds": [], "explanation": None,
            "known": False,
            "predictedNovelty": pred_nov,
            "flavorDistance": round(d, 4)
        })

print(f"{len(novel_candidates)} novel pairing candidates discovered.")

# ── 10. Compute bridgingScore per ingredient ──────────────────────────────────
bridging_totals = defaultdict(list)
for p in pairings:
    b = p.get('bridging')
    if b is not None:
        bridging_totals[p['source']].append(b)
        bridging_totals[p['target']].append(b)

# ── 11. Write back ────────────────────────────────────────────────────────────
for i, ing in enumerate(ingredients):
    ing['embedding']    = {k: round(float(coords3d[i, n]), 4)
                           for n, k in enumerate(['x','y','z'])}
    ing['embeddingFull'] = [round(float(v), 4) for v in full_emb[i]]
    ing['cluster']       = int(cluster_ids[i])
    ing['clusterLabel']  = CLUSTER_LABELS[int(cluster_ids[i])]
    ing['bridgingScore'] = round(
        float(np.mean(bridging_totals[ing['id']])) if bridging_totals[ing['id']] else 0.0, 4)

for p in pairings:
    if p['source'] not in id_to_idx or p['target'] not in id_to_idx:
        continue
    i, j = id_to_idx[p['source']], id_to_idx[p['target']]
    d = float(dist_matrix[i, j])
    pred = float(nov_reg.predict([[d] + [p.get(k) or 0.0 for k in EDGE_KEYS]])[0])
    p['known']            = True
    p['predictedNovelty'] = round(max(0.0, min(1.0, pred)), 3)
    p['flavorDistance']   = round(d, 4)

with open('../public/proDataset/ingredients.json', 'w') as f:
    json.dump(ingredients, f, indent=2)
with open('../public/proDataset/pairings.json', 'w') as f:
    json.dump(pairings + novel_candidates, f, indent=2)

print(f"Done. {len(ingredients)} ingredients, {len(pairings)} known, "
      f"{len(novel_candidates)} novel.")
```

---

## Three.js visualization upgrade

### 1. Use `embedding.x/y/z` for position

```js
// Before: arbitrary perceptron-based positioning
mesh.position.set(node.x, node.y, node.z)

// After: GNN embedding — proximity IS flavor similarity
mesh.position.set(
  ingredient.embedding.x * SCENE_SCALE,
  ingredient.embedding.y * SCENE_SCALE,
  ingredient.embedding.z * SCENE_SCALE
)
```

Clusters emerge automatically — no layout algorithm needed in JS.

### 2. Color nodes by cluster

```js
// Pull from metadata.json — single source of truth
const clusterColors = Object.fromEntries(
  metadata.clusters.map(c => [c.id, parseInt(c.color.replace('#',''), 16)])
)
const material = new THREE.MeshStandardMaterial({
  color: clusterColors[ingredient.cluster]
})
```

### 3. Known vs novel edges

```js
const buildEdgeMaterial = (pairing) => pairing.known
  ? new THREE.LineBasicMaterial({
      color: 0xaaaaaa,
      opacity: 0.3 + pairing.strength * 0.5, transparent: true
    })
  : new THREE.LineDashedMaterial({
      color: 0x7F77DD, dashSize: 0.3, gapSize: 0.2,
      opacity: pairing.predictedNovelty,     transparent: true
    })
```

### 4. Edge mode switcher (strength / chemistry / novelty / bridging)

```js
const EDGE_WIDTH = {
  strength:  p => 0.5 + (p.strength ?? 0) * 2,
  chemistry: p => 0.5 + (p.chemistry ?? 0) * 2,
  tradition: p => 0.5 + (p.tradition ?? 0) * 2,
  bridging:  p => 0.5 + (p.bridging ?? 0) * 2,
  novelty:   p => 0.5 + (p.predictedNovelty ?? 0) * 2,
}
// Usage: EDGE_WIDTH[currentMode](pairing)
```

### 5. Bridging ingredients as visual hubs

```js
const radius = 0.3 + ingredient.bridgingScore * 0.8
const geometry = new THREE.SphereGeometry(radius, 16, 16)
```

---

## Note on `sharedCompounds` sparsity

Most ingredients currently have empty `sharedCompounds`. The GAT does not depend on
this field — it uses your `chemistry` score as a proxy. When you add FooDB data:

1. Recalculate `chemistry` from actual compound overlap
2. Retrain the GAT — embeddings shift to reflect real chemistry
3. `sharedCompounds` on novel candidates auto-populates

No schema change needed. The field exists, it's just sparse for now.

---

## Migration path

| Step | What | Effort |
|---|---|---|
| 1 | `pip install` requirements, run `train_gnn.py` | ~1 hr |
| 2 | Inspect output — check `embedding` in ingredients.json | 10 min |
| 3 | Tune `DISTANCE_THRESHOLD` — print dist_matrix histogram | 30 min |
| 4 | Update Three.js: swap positions for `embedding.x/y/z` | ~1 hr |
| 5 | Color nodes by `cluster` from metadata.json | 30 min |
| 6 | Style novel edges differently (`known: false`) | 30 min |
| 7 | Add edge-mode dropdown (strength / chemistry / novelty / bridging) | 1–2 hr |
| 8 | Scale node size by `bridgingScore` | 30 min |
| 9 | `npm run build` → deploy to Firebase Hosting | 10 min |

**Nothing in Firestore changes.** User profiles, saved recipes, and quiz answers
are completely untouched. The GAT upgrade lives entirely in the static data layer.

---

## Why this is better than the perceptron

| | Perceptron | GAT |
|---|---|---|
| Scores pairs in isolation | Yes | No — sees the whole network |
| Uses edge attributes | As flat inputs | As attention weights |
| Predicts novelty for unseen pairs | No | Yes |
| Positions encode flavor similarity | No | Yes (via UMAP) |
| Discovers novel pairings | No | Yes |
| `bridging` nodes visible as hubs | No | Yes |
| Improves with more pairing data | Minimally | Significantly |

The perceptron asked: *"given these 8 features, how compatible are A and B?"*

The GAT asks: *"given how A and B each sit within the entire flavor network —
weighted by the type of every relationship each has to its neighbors —
how compatible are they, and what does that imply about pairs we've never seen?"*

---

*Generated for NeuralFlavor — neuralflavor.web.app*
