# Deep Interview Spec: GAT Link-Prediction Clusters

## Metadata
- Interview ID: `gat-link-prediction-clusters-2026-05-28`
- Rounds: 3 (+ Round 0 topology gate)
- Final Ambiguity Score: ~10% (under 20% threshold)
- Type: **brownfield**
- Generated: 2026-05-28
- Threshold: 0.20
- Initial Context Summarized: no
- Status: **PASSED**

## Clarity Breakdown
| Dimension | Score | Weight | Weighted |
|-----------|-------|--------|----------|
| Goal Clarity        | 0.92 | 0.35 | 0.322 |
| Constraint Clarity  | 0.88 | 0.25 | 0.220 |
| Success Criteria    | 0.85 | 0.25 | 0.213 |
| Context Clarity     | 0.95 | 0.15 | 0.143 |
| **Total Clarity**   |      |      | **0.898** |
| **Ambiguity**       |      |      | **0.102 (~10%)** |

## Topology

| Component | Status | Description | Coverage |
|---|---|---|---|
| **C1 Graph + features** | active | Build PyG `Data` object: node features (~25-30d) + edge_index + NPMI strength as edge_attr + stratified 80/10/10 edge split. | §Goal, §Constraints, §AC |
| **C2 GAT + objective** | active | 2-layer GATConv + dot-product link prediction head + BCE on positives vs sampled negatives. V2 follow-up: hybrid with tier1 classification head. | §Goal, §Constraints, §AC |
| **C3 Clustering algorithm** | active | Leiden on cosine-kNN graph of 32d embeddings; k auto-discovers; stability gate via 10-seed consensus matrix at Jaccard ≥ 0.85. | §Goal, §Constraints, §AC |
| **C4 App wiring + acceptance** | active | Hard-replace `cluster_labels_v3.json` + `cluster_explanations_v3.json` in place; chef visual A/B on 5×3=15 cluster cards; rollback = `git revert`. | §Goal, §AC §Spec |

---

## Goal

Replace the current KMeans-on-11d-prob-vectors clustering (which
produces 1×2,618-blob + 4×2-node-stubs in the active
`cluster_labels_v3.json`) with **node embeddings learned by a 2-layer
GAT trained on link prediction over the chef-curated v8 pairing
graph**, then **Leiden community detection on cosine-kNN of those
embeddings**, with **stability-gated acceptance** (Jaccard ≥ 0.85
across 10 seeds) and **chef visual A/B before commit**.

The fundamental architectural shift: stop clustering on per-ingredient
prediction vectors (where most ingredients pile up near origin → one
giant savory blob), start clustering on representations shaped by the
pairing graph itself (where co-pairing structure naturally separates
ingredients into balanced communities). Two ingredients are close in
the new embedding space iff they *pair with the same kinds of things*
— which is a more honest definition of a "flavor cluster" than
"molecular taste/aroma profiles look similar in 11d Euclidean space."

---

## Defined Variables

### PyG Data object construction (C1)

```python
import torch
from torch_geometric.data import Data

# Node features: 13-aroma multi-hot + 6-taste multi-hot + mouthfeel top-N
def build_node_features(ingredients_json, flavor_graph_v3, gnn_entropy):
    AROMA_KEYS = ['citrus','fruity','floral','herbal','green','creamy',
                  'woody','earthy','roasted','caramel','fermented',
                  'marine','pungent']
    TASTE_KEYS = ['sweet','sour','bitter','salty','umami','spicy']
    MOUTHFEEL_TOP_N = top_k_mouthfeel_tokens(flavor_graph_v3, k=10)
    features = []
    for name in canonical_order:
        aroma_vec = multi_hot(flavor_graph_v3.tier1_of(name), AROMA_KEYS)
        taste_vec = multi_hot(ingredients_json.taste_of(name), TASTE_KEYS)
        mfeel_vec = multi_hot(flavor_graph_v3.mouthfeel_of(name), MOUTHFEEL_TOP_N)
        features.append(aroma_vec + taste_vec + mfeel_vec)  # ~29d
    return torch.tensor(features, dtype=torch.float)

# Edge index + edge weight from pairings.json
def build_edges(pairings_json, name_to_idx):
    src, dst, w = [], [], []
    for e in pairings_json:
        a, b = name_to_idx[e['ingredientA']], name_to_idx[e['ingredientB']]
        s = e['strength']  # NPMI-derived, range ~0.5-1.0
        src.extend([a, b]); dst.extend([b, a]); w.extend([s, s])  # undirected
    edge_index = torch.tensor([src, dst], dtype=torch.long)
    edge_attr  = torch.tensor(w, dtype=torch.float).unsqueeze(1)
    # Min-max normalize edge_attr to [0,1] to prevent attention saturation
    edge_attr = (edge_attr - edge_attr.min()) / (edge_attr.max() - edge_attr.min() + 1e-8)
    return edge_index, edge_attr

data = Data(x=features, edge_index=edge_index, edge_attr=edge_attr)
```

### Stratified edge split (C1)

```python
# Standard PyG RandomLinkSplit splits edges uniformly — risks orphaning
# long-tail nodes. Custom stratified split enforces per-node retention.
def stratified_edge_split(data, val_ratio=0.1, test_ratio=0.1,
                          max_node_loss=0.30):
    """No node loses more than 30% of its edges to val+test combined."""
    # Implementation: bucket edges by min-degree endpoint, hold out
    # proportionally per bucket, then verify post-split degree retention.
    # See flavor-gnn/src/data/stratified_split.py
```

### GAT link-prediction model (C2)

```python
import torch.nn as nn
from torch_geometric.nn import GATConv

class GATLinkPredictor(nn.Module):
    def __init__(self, in_dim, hidden=64, embed=32, heads=4, dropout=0.5):
        super().__init__()
        self.conv1 = GATConv(in_dim, hidden // heads, heads=heads,
                             dropout=dropout, edge_dim=1)
        self.conv2 = GATConv(hidden, embed, heads=1,
                             dropout=dropout, edge_dim=1)
        self.act = nn.ELU()

    def encode(self, x, edge_index, edge_attr):
        h = self.act(self.conv1(x, edge_index, edge_attr))
        h = self.conv2(h, edge_index, edge_attr)
        return h  # [N, 32]

    def decode(self, h, edge_pairs):
        # edge_pairs: [2, E] — pairs to score
        src, dst = edge_pairs
        return (h[src] * h[dst]).sum(dim=1)  # dot product → logit
```

### Training loop (C2)

```python
from torch_geometric.utils import negative_sampling

def train_step(model, data, train_pos_edges, optimizer):
    model.train()
    optimizer.zero_grad()
    h = model.encode(data.x, data.train_edge_index, data.train_edge_attr)
    # Resample negatives every step (varied negatives = better generalization)
    neg_edges = negative_sampling(
        edge_index=train_pos_edges, num_nodes=data.num_nodes,
        num_neg_samples=train_pos_edges.size(1)  # 1:1 ratio
    )
    pos_logits = model.decode(h, train_pos_edges)
    neg_logits = model.decode(h, neg_edges)
    logits = torch.cat([pos_logits, neg_logits])
    labels = torch.cat([torch.ones_like(pos_logits),
                        torch.zeros_like(neg_logits)])
    loss = nn.functional.binary_cross_entropy_with_logits(logits, labels)
    loss.backward()
    optimizer.step()
    return loss.item()
```

### Leiden + consensus (C3)

```python
import igraph as ig
import leidenalg

def leiden_consensus(embeddings, k_neighbors=15, n_seeds=10,
                     resolution=1.0):
    """Run Leiden 10x, build consensus matrix, partition consensus."""
    # 1. Build cosine-kNN graph from 32d embeddings
    knn_graph = build_cosine_knn(embeddings, k=k_neighbors)
    g = ig.Graph.Weighted_Adjacency(knn_graph.tolist(), mode='undirected')

    # 2. Run Leiden 10x with different seeds
    partitions = []
    for seed in range(n_seeds):
        p = leidenalg.find_partition(g, leidenalg.RBConfigurationVertexPartition,
                                     resolution_parameter=resolution, seed=seed)
        partitions.append(p.membership)

    # 3. Pairwise Jaccard — gate
    jaccards = pairwise_partition_jaccard(partitions)
    if jaccards.min() < 0.85:
        raise StabilityGateFail(f"min Jaccard {jaccards.min():.3f} < 0.85")

    # 4. Consensus matrix → final Leiden
    consensus = build_consensus_matrix(partitions)  # [N, N], values in [0, 1]
    g_consensus = ig.Graph.Weighted_Adjacency(consensus.tolist(), mode='undirected')
    final = leidenalg.find_partition(g_consensus,
                                     leidenalg.RBConfigurationVertexPartition,
                                     resolution_parameter=resolution, seed=42)
    return final.membership, jaccards
```

### Cluster JSON emission (C4)

Must match the existing `cluster_labels_v3.json` schema exactly (no JS
changes downstream):

```json
{
  "k": <auto-discovered>,
  "clusters": [
    {"id": 0, "label": "<auto-generated or hand-curated>", "size": <n>, "centroid_3d": [...]},
    ...
  ],
  "ingredients": { "<name>": <cluster_id>, ... },
  "_meta": {
    "generated_by": "flavor-gnn/scripts/gat_link_clusters.py (N3-GAT-CLUSTERS, 2026-05-28)",
    "source_files": ["pairings.json", "flavor_graph_data_v3.json", "gnn_entropy.json"],
    "stability_jaccard_min": <float>,
    "model_artifact": "flavor-gnn/artifacts/gat_link_v1.pt"
  }
}
```

---

## Constraints

### Graph + features (C1)

- Node count: ~3,847 (post-v8-prune). Edge count: ~57,800 (48,588 base
  + 9,245 v8-mined).
- Feature vector ~25-30d: 13-aroma multi-hot + 6-taste multi-hot +
  mouthfeel top-N (N=10). Don't widen beyond ~30 — wider features on a
  sparse graph cause memorization.
- NPMI `strength` passed as `edge_attr`, min-max normalized to [0,1]
  before consumption by GATConv.
- Stratified 80/10/10 edge split: no node loses >30% of its edges to
  val+test combined.
- Cold-start nodes (53 with empty tier1 post-backfill): aroma slice
  will be all-zero. GAT relies on neighbor signal alone. Verify
  embeddings cluster sensibly post-train; if not, imputation from
  `gnn_entropy.json` predicted tier1 is the fallback.

### GAT + objective (C2)

- 2-layer GATConv. **Do not go deeper than 3** — oversmoothing
  collapses all node representations toward the mean.
- hidden=64, heads=4, dropout=0.5, ELU, embedding=32.
- Link prediction objective: dot product of node embeddings → sigmoid
  → BCE.
- Negative sampling: 1:1 ratio, resampled per epoch via PyG's
  `negative_sampling()`. Random negatives for v1; hard-negative mining
  (same chef tier1 cluster as positive's source) is a v2 follow-up if
  v1 AUC < 0.85.
- Adam optimizer, lr=5e-3, weight_decay=5e-4, early stopping on val
  AUC patience=20 epochs.
- Training budget: ≤ 500 epochs CPU, ~5-10min on 4814 nodes (clustering
  side of the work, not the long molecular GNN training).
- **V2 follow-up (separate spec):** hybrid loss
  `α·L_link + (1-α)·L_tier1_classification` with classification head
  on the same 32d embedding. Defer to after v1 baseline metrics land.

### Clustering algorithm (C3)

- Leiden on cosine-kNN graph of 32d GAT embeddings.
- k_neighbors=15 (standard for graphs of this size). Resolution
  parameter γ=1.0 default; tune to 0.5-2.0 if k auto-discovers absurdly
  high or low.
- k auto-discovers via modularity optimization. Expected range: 10-18
  for graphs your size.
- **Quality gate: stability** — run Leiden 10x with different seeds,
  pairwise Jaccard ≥ 0.85 between any two runs. Build consensus matrix
  from the 10 runs, run Leiden once more on the consensus matrix for
  the final partition.
- **No size-balance constraint, no chef-purity constraint.** The
  principle: if link-prediction embeddings are good, sizes balance
  themselves; stability alone validates that the embeddings carry
  real signal.

### App wiring (C4)

- **Hard-replace** `public/proDataset/cluster_labels_v3.json` and
  `public/proDataset/cluster_explanations_v3.json` (same paths, same
  schema → zero JS changes downstream).
- Validate schema match before writing: load new JSON through
  `useProData.js` loader code path in a test fixture.
- Regenerate `cluster_explanations_v3.json` via existing
  `flavor-gnn/scripts/emit_cluster_explanations_v3.py` script
  (no changes needed — it reads cluster_labels_v3 and emits
  explanations).
- Cluster-tour adapter at `LivingArchView.jsx:1906-1919` reads
  `cluster_labels_v3.json` `clusters[].centroid_3d` field — preserve
  this field by computing 3D centroids from `flavor_positions_v3.json`
  member positions after Leiden partition lands.

### Acceptance

- Chef visual A/B fixture: 5 axes × 3 buckets = 15 cluster cards
  side-by-side against current v3. Chef sign-off required before
  commit (in-PR, offline review).
- Quantitative metrics report (`flavor-gnn/artifacts/gat_cluster_quality_report.json`):
  - Stability: pairwise Jaccard ≥ 0.85 (gate)
  - Link-prediction val AUC ≥ 0.80 (gate)
  - Link-prediction Hits@10 ≥ 0.50 (gate)
  - Size distribution: histogram, min/max/median (informational)
  - Tier1 purity per cluster (informational, for chef review)

### Performance

- Training: ≤ 10 min CPU on 4814 nodes / 57k edges.
- Leiden consensus: ≤ 30s for 10 seeds + consensus pass.
- No runtime impact on the app — clustering is offline; only the JSON
  files change.

---

## Non-Goals (out of scope)

- **Hybrid loss (BGRL + tier1 classification)** — defer to v2 spec
  after v1 baseline metrics land.
- **Hard-negative mining** — defer to v2 if v1 link-prediction AUC
  inadequate.
- **End-to-end deep clustering (DEC/SCAN/IGCN)** — explicitly rejected
  in Round 1 due to instability on graphs this size.
- **Ranking-loss link prediction** (predict NPMI strength rank, not
  binary) — defer. Binary BCE + edge_attr is a v1 simplification.
- **UI changes** — schema is preserved; no LivingArchView, IngredientPanel,
  or Controls changes needed.
- **Replacing the existing molecular MPNN** — that model produces
  `gnn_entropy.json` predictions used as INPUT features here.
  Completely orthogonal pipeline.
- **Re-running v3 morph-targets work** — `flavor_positions_v3.json`
  is read-only input; the v3-derived morph layer is unaffected.

---

## Acceptance Criteria

### Graph + features

- [ ] `flavor-gnn/src/data/build_pyg_data.py` constructs PyG `Data` object from `pairings.json` + `flavor_graph_data_v3.json` + `ingredients.json`.
- [ ] Feature dim is 25-30 (13 aroma + 6 taste + 10 mouthfeel).
- [ ] `edge_attr` is the min-max-normalized NPMI strength, shape `[num_edges, 1]`.
- [ ] `flavor-gnn/src/data/stratified_split.py` produces train/val/test edge sets where no node loses >30% of its edges to val+test combined.
- [ ] Unit test: stratified split preserves degree distribution within 10% per decile.

### GAT + objective

- [ ] `flavor-gnn/src/models/gat_link.py` implements `GATLinkPredictor` with 2 GATConv layers, hidden=64, heads=4, embedding=32, dropout=0.5, ELU.
- [ ] `flavor-gnn/src/train/train_gat_link.py` trains via link-prediction BCE with per-epoch negative resampling at 1:1 ratio.
- [ ] Validation AUC ≥ 0.80 on held-out 10% positive + 10% negative edges.
- [ ] Hits@10 ≥ 0.50 on the validation set.
- [ ] Model artifact saved to `flavor-gnn/artifacts/gat_link_v1.pt`.

### Clustering algorithm

- [ ] `flavor-gnn/scripts/leiden_consensus.py` runs Leiden 10x on the cosine-kNN graph of 32d embeddings, builds consensus matrix, runs final Leiden on consensus.
- [ ] Pairwise Jaccard between any two of the 10 runs ≥ 0.85 (hard gate — fail loudly if not).
- [ ] Final partition is from consensus run, not from an arbitrary seed.
- [ ] Auto-discovered k logged + reported (expected 10-18).

### App wiring + acceptance

- [ ] `public/proDataset/cluster_labels_v3.json` regenerated with new partition; schema preserved (k, clusters[], ingredients{}, _meta).
- [ ] `cluster_labels_v3.json` `clusters[].centroid_3d` recomputed from `flavor_positions_v3.json` member positions per cluster.
- [ ] `public/proDataset/cluster_explanations_v3.json` regenerated via existing `emit_cluster_explanations_v3.py` script (no script changes).
- [ ] All 788+ existing tests pass.
- [ ] `useProData.js` loads new `cluster_labels_v3.json` without errors (schema validation).
- [ ] `npm run build` succeeds.
- [ ] Cluster-tour adapter at `LivingArchView.jsx:1906-1919` orbits the new cluster cloud centers (regression check — manual visual).
- [ ] Chef visual A/B: 5×3=15 cluster cards screenshot pair (new vs current v3) reviewed in PR.
- [ ] Chef sign-off explicit in PR before merge.

### Cross-cutting

- [ ] `flavor-gnn/artifacts/gat_cluster_quality_report.json` written with stability Jaccard, val AUC, Hits@10, size distribution, tier1 purity per cluster.
- [ ] Rollback path: `git revert` restores prior v3 artifacts (no JS changes to revert).

---

## Implementation Plan

### Phase 1 (single ship — 3-4 days estimated)

| Day | Phase | Effort |
|---|---|---|
| **D1** | `build_pyg_data.py` + `stratified_split.py` — convert v8 graph + features into PyG `Data` object. Unit tests for feature shape + split degree preservation. | 1d |
| **D2** | `gat_link.py` model + `train_gat_link.py` loop. Train v1 baseline; log val AUC + Hits@10. Save model artifact. | 1d |
| **D3** | `leiden_consensus.py` — Leiden ×10 + consensus + stability gate. Recompute `centroid_3d` from `flavor_positions_v3.json`. Emit new `cluster_labels_v3.json`. | 1d |
| **D4** | Re-run `emit_cluster_explanations_v3.py`. Chef visual A/B fixture (15 cluster cards screenshot pair). Sign-off + commit. | 1d |

### Touched files (planned)

- `flavor-gnn/src/data/build_pyg_data.py` — **new**
- `flavor-gnn/src/data/stratified_split.py` — **new**
- `flavor-gnn/src/data/__tests__/build_pyg_data_test.py` — **new**
- `flavor-gnn/src/data/__tests__/stratified_split_test.py` — **new**
- `flavor-gnn/src/models/gat_link.py` — **new**
- `flavor-gnn/src/train/train_gat_link.py` — **new**
- `flavor-gnn/scripts/leiden_consensus.py` — **new**
- `flavor-gnn/scripts/gat_link_clusters.py` — **new** (entry-point orchestrator: data→train→cluster→emit)
- `flavor-gnn/artifacts/gat_link_v1.pt` — **new** (trained weights)
- `flavor-gnn/artifacts/gat_cluster_quality_report.json` — **new**
- `public/proDataset/cluster_labels_v3.json` — regenerated
- `public/proDataset/cluster_explanations_v3.json` — regenerated
- `requirements.txt` (or pyproject.toml) — add `torch-geometric`, `python-igraph`, `leidenalg` if not already present

### Untouched (read-only consumers)

- `flavor-gnn/src/models/mpnn.py` — molecular GNN, unchanged
- `flavor-gnn/artifacts/m3_multitask*.pt` — molecular model, unchanged
- `public/proDataset/gnn_entropy.json` — read as input feature source
- `public/proDataset/flavor_graph_data_v3.json` — read as feature source
- `public/proDataset/pairings.json` — read as edge source
- `public/proDataset/flavor_positions_v3.json` — read for `centroid_3d` recomputation
- All `src/**/*.js` and `src/**/*.jsx` — zero JS changes (schema preserved)

---

## Ontology (10 entities)

| Entity | Type | Fields | Relationships |
|---|---|---|---|
| Pairing Graph | input | nodes (ingredients), edges (pairings) with NPMI strength | source for GAT training |
| Node Feature Vector | input | ~29d per node: 13 aroma + 6 taste + 10 mouthfeel multi-hot | concatenated from `flavor_graph_data_v3.json` + `ingredients.json` |
| Edge Attribute | input | scalar NPMI strength per edge, min-max normalized to [0,1] | consumed by GATConv attention |
| Stratified Edge Split | derived | train/val/test edge sets, per-node degree-retention bounded | 80/10/10 with ≤30% node loss to val+test |
| GAT Encoder | model | 2-layer GATConv, hidden=64, heads=4, embedding=32 | produces 32d node embeddings |
| Link Predictor | model head | dot product of node embedding pairs → sigmoid → BCE | trained against positives + 1:1 sampled negatives |
| 32d Embedding | derived value | per-node vector | output of GAT; input to clustering |
| Cosine-kNN Graph | derived | k=15 nearest neighbors per node by cosine similarity in embedding space | input to Leiden |
| Consensus Partition | derived | cluster_id per node, from consensus of 10 Leiden runs | output: `cluster_labels_v3.json` `ingredients` map |
| Quality Report | output artifact | stability Jaccard, val AUC, Hits@10, size distribution, tier1 purity | `flavor-gnn/artifacts/gat_cluster_quality_report.json` |

## Ontology Convergence

| Round | Entity Count | New | Changed | Stable | Stability |
|---|---|---|---|---|---|
| 1 | 5 | 5 | 0 | 0 | N/A |
| 2 | 8 | 3 (Cosine-kNN Graph, Consensus Partition, Quality Report) | 0 | 5 | 62% |
| 3 | 10 | 2 (Stratified Edge Split, Link Predictor) | 0 | 8 | 80% |
| Final | 10 | 0 | 0 | 10 | 100% (converged) |

---

## Assumptions Exposed & Resolved

| Assumption | Round | Resolution |
|---|---|---|
| Clustering uses molecular MPNN embeddings | R1 | False — molecular MPNN is for taste/aroma prediction; clustering needs a relational ingredient GNN |
| KMeans on 11d prob vectors is fixable with better k | R1 | False — feature space collapses near origin; need a different feature space entirely |
| Chef tier1 should be the supervision target | R1 | False — using tier1 as input features (Option 2/proposal) rather than as target preserves room for discovery; tier1-as-target is the v2 hybrid option |
| End-to-end deep clustering (DEC) is the modern choice | R1 | False — unstable on graphs this size; embed-then-cluster is more reliable |
| k should be fixed at 8 (matching current v3) | R2 | False — k auto-discovers via Leiden; expected 10-18 |
| Need size-balance constraint to prevent blob recurrence | R2 | False — new feature space (link-prediction embeddings) doesn't have the prob-vector collapse pathology; stability alone validates |
| Need chef purity constraint for label quality | R2 | False — clusters will be labeled post-hoc from member chef labels; purity becomes a measurement, not a gate |
| Should ship as v4 parallel for safer rollout | R3 | False — schema is preserved; in-place v3 replacement is smaller diff with `git revert` as rollback |
| Metrics-only acceptance is sufficient | R3 | False — chef visual A/B catches semantic regressions metrics miss |

---

## Technical Context

### Brownfield surfaces touched

- `flavor-gnn/src/data/`, `flavor-gnn/src/models/`, `flavor-gnn/src/train/`,
  `flavor-gnn/scripts/` — all NEW files added (no existing files modified)
- `public/proDataset/cluster_labels_v3.json` — regenerated
- `public/proDataset/cluster_explanations_v3.json` — regenerated

### Brownfield surfaces NOT touched

- `flavor-gnn/src/models/mpnn.py` and the molecular pipeline — orthogonal
- All `src/**/*.js` and `src/**/*.jsx` — schema preservation guarantees zero JS impact
- v3 morph targets (`src/data/morphTargets.js`) — composes with the new partition unchanged
- α-mode (`AffinityMode.js`) — reads cluster_id from `cluster_labels_v3.json`; no change to consumption pattern
- Cluster-focus mode — reads cluster_id similarly; no change

---

## Risks / Notes for Executor

1. **Cold-start nodes (53 with empty tier1).** Their feature vector will be all-zero for the aroma slice. GAT relies entirely on neighbor signal for them. Spot-check their embeddings post-train. If they cluster sensibly (i.e., they land in clusters whose other members have related chef labels), fine. If they all land in one random cluster, fallback is feature imputation from `gnn_entropy.json` predicted tier1 — but only if it's broken; don't pre-emptively impute.

2. **Hub gap (71-of-3,390 compound foods).** These have no GNN entropy entry but DO have pairings. GAT can embed them via neighbor information. Check which cluster mayonnaise, vinaigrette, etc. land in — should be the dairy/oil/condiment neighborhood.

3. **NPMI weight saturation.** Pairing strengths range 0.5–1.0 post NPMI clip. Without min-max normalization, GATConv attention may saturate (all attention weights ≈ 1.0 for high-NPMI edges). Normalize to [0,1] before passing as `edge_attr`. Cite line in `build_pyg_data.py`.

4. **Stability gate at Jaccard ≥ 0.85 is tight.** If v1 runs land at 0.70–0.80, diagnose before loosening:
   - Embeddings under-trained → increase patience, more epochs
   - Embeddings over-fit → stronger dropout, weight decay
   - Leiden resolution wrong → sweep γ ∈ [0.5, 1.5]
   - Cosine-kNN k too small → bump from 15 to 25
   Do not loosen the gate; loosening means accepting an unstable partition.

5. **Schema preservation is the cheapest invariant.** Before writing the new `cluster_labels_v3.json`, validate it loads through `useProData.js` parsing path in a test fixture. If shape diverges, cluster-tour adapter at `LivingArchView.jsx:1906-1919` breaks silently (orbit pivots to origin instead of cluster cloud center).

6. **Centroid_3d recomputation.** New partition means new cluster membership → new 3D centroids. Compute by averaging `flavor_positions_v3.json` positions over member nodes. Write into the `clusters[].centroid_3d` field. This keeps the cluster-tour adapter working without code changes.

7. **Chef visual A/B fixture format.** Same convention as the v3 morph A/B sign-off (per `project_v3_morph_chef_signoff` memory): 15 screenshot pairs in `.playwright-shots/gat-clusters-ab/`. Each pair labeled `{axis}-{bucket}-old.png` vs `{axis}-{bucket}-new.png`. Generate via Playwright snapshot script before requesting sign-off.

---

## Pipeline next step

Per the deep-interview chain, three execution paths:

1. **`/oh-my-claudecode:omc-plan --consensus --direct`** — Planner/Architect/Critic consensus on the math + sequencing
2. **`/oh-my-claudecode:autopilot`** — direct execution
3. **`/oh-my-claudecode:ralph`** — persistence loop

Given the small file fan-out (~6 new files, ~2 regenerated artifacts),
the clear math (GAT + Leiden is well-trodden), and the algorithmic
acceptance criteria, **direct executor implementation** is viable. The
chef visual A/B step needs you (the chef-user) in the loop before the
commit lands.
