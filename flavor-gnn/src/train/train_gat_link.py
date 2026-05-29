"""train_gat_link.py — N3-GAT-CLUSTERS phase D2.

Trains the GATLinkPredictor on the ingredient pairing graph via
link-prediction BCE loss with per-epoch resampled negatives (1:1).

Pipeline:
  1. build_pyg_data() → Data + name_to_idx
  2. stratified_edge_split() → train/val/test directed edge tensors
  3. Build bidirectional train edge_index + edge_attr lookup
  4. Train model with Adam, early stop on val AUC
  5. Save model + metrics + embeddings to flavor-gnn/artifacts/

Outputs:
  - flavor-gnn/artifacts/gat_link_v1.pt           — model state dict + metadata
  - flavor-gnn/artifacts/gat_link_v1_embeddings.npy — [N, 32] node embeddings
  - flavor-gnn/artifacts/gat_link_v1_report.json   — val AUC, Hits@10, train curve
"""
from __future__ import annotations

import json
import random
import time
from collections import defaultdict
from pathlib import Path

import numpy as np
import torch
import torch.nn.functional as F
from sklearn.metrics import roc_auc_score
from torch_geometric.utils import negative_sampling

from src.data.build_pyg_data import AROMA_KEYS, build_pyg_data
from src.data.stratified_split import stratified_edge_split, to_bidirectional
from src.models.gat_link import GATLinkPredictor
from src.models.multitask_gat import MultiTaskGAT

REPO_ROOT = Path(__file__).resolve().parents[3]
ARTIFACTS = Path(__file__).resolve().parents[2] / "artifacts"


def build_compound_targets(
    name_to_idx: dict[str, int],
    top_k: int = 50,
    exclude_top: int = 4,
) -> tuple[torch.Tensor, torch.Tensor, list[str]]:
    """Top-k compound multi-hot targets per ingredient.

    Reads public/proDataset/gnn_compounds.json. Builds a vocabulary of
    the top-k compounds by corpus frequency, skipping the first
    `exclude_top` (junk: Ethanol/L-Histidine/Caffeine/Theobromine which
    appear in ~70% of ingredients and carry no signal). Returns:
      targets[N, k]: 0/1 multi-hot
      mask[N]      : 1 if node has any compound data, 0 otherwise
      vocab        : list of compound names in column order
    """
    from collections import Counter
    gc = json.loads(
        (REPO_ROOT / "public" / "proDataset" / "gnn_compounds.json")
        .read_text(encoding="utf-8")
    )
    counts: Counter = Counter()
    per_ing: dict[str, list[str]] = {}
    for ing, info in gc.items():
        names = []
        for c in (info.get("top_compounds") or []):
            if isinstance(c, dict):
                name = c.get("name")
                if name:
                    names.append(name)
        per_ing[ing] = names
        for n in names:
            counts[n] += 1
    sorted_all = [c for c, _ in counts.most_common()]
    vocab = sorted_all[exclude_top:exclude_top + top_k]
    vocab_idx = {c: i for i, c in enumerate(vocab)}

    n = len(name_to_idx)
    targets = torch.zeros(n, len(vocab), dtype=torch.float)
    mask = torch.zeros(n, dtype=torch.float)
    for ing, idx in name_to_idx.items():
        compounds = per_ing.get(ing) or []
        if not compounds:
            continue
        mask[idx] = 1.0
        for c in compounds:
            if c in vocab_idx:
                targets[idx, vocab_idx[c]] = 1.0
    return targets, mask, vocab


def build_edge_type_lookup(
    name_to_idx: dict[str, int],
) -> dict[tuple[int, int], tuple[float, float]]:
    """Build (min_idx, max_idx) -> (tradition, chemistry) lookup from pairings.json.

    Used for Phase 3 edge-type auxiliary. Returns one entry per
    undirected edge (lowest-index endpoint first).
    """
    pairings = json.loads(
        (REPO_ROOT / "public" / "proDataset" / "pairings.json").read_text(encoding="utf-8")
    )
    out: dict[tuple[int, int], tuple[float, float]] = {}
    for e in pairings:
        a = name_to_idx.get(e.get("ingredientA"))
        b = name_to_idx.get(e.get("ingredientB"))
        if a is None or b is None:
            continue
        key = (a, b) if a < b else (b, a)
        out[key] = (float(e.get("tradition", 0.0)), float(e.get("chemistry", 0.0)))
    return out


def edge_type_targets_for(
    pairs: torch.Tensor,
    lookup: dict[tuple[int, int], tuple[float, float]],
) -> tuple[torch.Tensor, torch.Tensor]:
    """Return (targets [E], mask [E]) for the given edges.

    target = 1 if tradition > chemistry, 0 if chemistry > tradition.
    mask   = 1 if not tied (target meaningful), 0 if tied (excluded).
    """
    n = pairs.size(1)
    targets = torch.zeros(n, dtype=torch.float)
    mask = torch.zeros(n, dtype=torch.float)
    for i in range(n):
        a = int(pairs[0, i]); b = int(pairs[1, i])
        key = (a, b) if a < b else (b, a)
        td, ch = lookup.get(key, (0.0, 0.0))
        if td > ch:
            targets[i] = 1.0
            mask[i] = 1.0
        elif ch > td:
            targets[i] = 0.0
            mask[i] = 1.0
    return targets, mask


def build_tier1_targets(
    name_to_idx: dict[str, int],
) -> tuple[torch.Tensor, torch.Tensor]:
    """Return (targets [N, 13], mask [N]) for tier1 multi-label classification.

    targets[i, k] = 1 if node i has AROMA_KEYS[k] in its tier1.
    mask[i] = 1 if node i has any tier1 label (used to mask loss).
    """
    fg = json.loads(
        (REPO_ROOT / "public" / "proDataset" / "flavor_graph_data_v3.json")
        .read_text(encoding="utf-8")
    )
    n = len(name_to_idx)
    targets = torch.zeros(n, len(AROMA_KEYS), dtype=torch.float)
    mask = torch.zeros(n, dtype=torch.float)
    aroma_to_col = {k: i for i, k in enumerate(AROMA_KEYS)}
    for node in fg.get("nodes", []):
        idx = name_to_idx.get(node["name"])
        if idx is None:
            continue
        labels = list(node.get("tier1") or [])
        if not labels:
            continue
        mask[idx] = 1.0
        for l in labels:
            col = aroma_to_col.get(l)
            if col is not None:
                targets[idx, col] = 1.0
    return targets, mask


def build_tier1_buckets(name_to_idx: dict[str, int]) -> dict[int, list[int]]:
    """Return idx -> list of other node indices sharing any tier1 label.

    For nodes with no tier1, the bucket is empty (caller falls back to
    random sampling).
    """
    fg = json.loads(
        (REPO_ROOT / "public" / "proDataset" / "flavor_graph_data_v3.json")
        .read_text(encoding="utf-8")
    )
    label_to_idx = defaultdict(list)
    idx_to_labels: dict[int, list[str]] = {}
    for n in fg.get("nodes", []):
        idx = name_to_idx.get(n["name"])
        if idx is None:
            continue
        labels = list(n.get("tier1") or [])
        idx_to_labels[idx] = labels
        for l in labels:
            label_to_idx[l].append(idx)

    bucket_by_idx: dict[int, list[int]] = {}
    for idx in range(len(name_to_idx)):
        candidates: set[int] = set()
        for l in idx_to_labels.get(idx, []):
            candidates.update(label_to_idx[l])
        candidates.discard(idx)
        bucket_by_idx[idx] = list(candidates)
    return bucket_by_idx


def hard_negative_sampling(
    pos_edges: torch.Tensor,
    num_nodes: int,
    bucket_by_idx: dict[int, list[int]],
    pos_edge_set: set[tuple[int, int]],
    rng: random.Random,
) -> torch.Tensor:
    """For each positive (u, v), sample one negative (u, w) where w
    shares a tier1 with u (hard) or random (fallback)."""
    n = pos_edges.size(1)
    neg_src = [0] * n
    neg_dst = [0] * n
    src_arr = pos_edges[0].tolist()
    dst_arr = pos_edges[1].tolist()
    for i in range(n):
        u = src_arr[i]
        v = dst_arr[i]
        bucket = bucket_by_idx.get(u) or ()
        w = -1
        if bucket:
            for _ in range(5):
                cand = bucket[rng.randrange(len(bucket))]
                if cand == v:
                    continue
                key = (u, cand) if u < cand else (cand, u)
                if key in pos_edge_set:
                    continue
                w = cand
                break
        if w < 0:
            for _ in range(5):
                cand = rng.randrange(num_nodes)
                if cand == u or cand == v:
                    continue
                key = (u, cand) if u < cand else (cand, u)
                if key in pos_edge_set:
                    continue
                w = cand
                break
        if w < 0:
            w = (u + 1) % num_nodes
        neg_src[i] = u
        neg_dst[i] = w
    return torch.tensor([neg_src, neg_dst], dtype=torch.long)


def build_edge_attr_for(
    edges: torch.Tensor,
    full_edge_index: torch.Tensor,
    full_edge_attr: torch.Tensor,
) -> torch.Tensor:
    """Look up edge_attr values for a subset of edges via (src,dst) hash.

    Original data has bidirectional edges; we accept either direction.
    """
    n = full_edge_index.size(1)
    lookup = {}
    src_full = full_edge_index[0].tolist()
    dst_full = full_edge_index[1].tolist()
    w_full = full_edge_attr.squeeze(-1).tolist()
    for i in range(n):
        lookup[(src_full[i], dst_full[i])] = w_full[i]

    out = []
    for i in range(edges.size(1)):
        a, b = int(edges[0, i]), int(edges[1, i])
        w = lookup.get((a, b), lookup.get((b, a), 0.0))
        out.append(w)
    return torch.tensor(out, dtype=torch.float).unsqueeze(1)


@torch.no_grad()
def hits_at_k(
    h: torch.Tensor,
    pos_edges: torch.Tensor,
    k: int = 10,
    chunk: int = 256,
) -> float:
    """Filtered Hits@K: for each positive (u, v), rank v among all
    nodes scored from u. The self-loop (u, u) is excluded from the
    candidate set. Returns mean(rank_v ≤ K) over positives.
    """
    n_total = pos_edges.size(1)
    if n_total == 0:
        return 0.0
    hits = 0
    NEG_INF = float("-inf")
    for start in range(0, n_total, chunk):
        end = min(start + chunk, n_total)
        src = pos_edges[0, start:end]
        dst = pos_edges[1, start:end]
        h_src = h[src]
        all_scores = h_src @ h.T
        # Exclude self-loops from candidate set
        all_scores[torch.arange(src.size(0)), src] = NEG_INF
        target_scores = all_scores[torch.arange(src.size(0)), dst]
        ranks = (all_scores >= target_scores.unsqueeze(1)).sum(dim=1)
        hits += int((ranks <= k).sum().item())
    return hits / n_total


@torch.no_grad()
def eval_link(
    model: GATLinkPredictor,
    data,
    train_bi_ei: torch.Tensor,
    train_bi_ea: torch.Tensor,
    pos_edges: torch.Tensor,
    num_nodes: int,
    eval_neg_ratio: int = 1,
    compute_hits: bool = True,
) -> dict:
    model.eval()
    h = model.encode(data.x, train_bi_ei, train_bi_ea)
    neg = negative_sampling(
        edge_index=pos_edges,
        num_nodes=num_nodes,
        num_neg_samples=pos_edges.size(1) * eval_neg_ratio,
    )
    pos_logits = model.decode(h, pos_edges)
    neg_logits = model.decode(h, neg)
    labels = torch.cat([
        torch.ones(pos_logits.size(0)),
        torch.zeros(neg_logits.size(0)),
    ])
    scores = torch.cat([pos_logits, neg_logits]).sigmoid()
    auc = float(roc_auc_score(labels.numpy(), scores.numpy()))
    out = {"auc": auc}
    if compute_hits:
        out["hits_at_10"] = hits_at_k(h, pos_edges, k=10)
    return out


def train(
    seed: int = 42,
    epochs: int = 500,
    patience: int = 50,
    lr: float = 1e-3,
    weight_decay: float = 5e-4,
    verbose: bool = True,
    use_hard_negatives: bool = False,
    use_hybrid_loss: bool = True,
    alpha: float = 0.5,
    variant: str = "v5",
    multitask: bool = True,
    beta_tier1: float = 0.5,
    beta_recon: float = 0.5,
    with_edge_type: bool = True,
    beta_edge_type: float = 0.5,
    with_compounds: bool = True,
    beta_compounds: float = 0.5,
    compounds_top_k: int = 50,
    compounds_exclude_top: int = 4,
) -> dict:
    torch.manual_seed(seed)
    np.random.seed(seed)
    py_rng = random.Random(seed)

    t0 = time.time()
    if verbose:
        print(f"[D2] building data...")
    data, name_to_idx = build_pyg_data()
    in_dim = data.x.size(1)

    split = stratified_edge_split(
        data.edge_index, num_nodes=data.num_nodes, seed=seed
    )
    train_bi_ei = to_bidirectional(split.train)
    train_bi_ea = build_edge_attr_for(train_bi_ei, data.edge_index, data.edge_attr)

    bucket_by_idx = None
    pos_edge_set: set[tuple[int, int]] = set()
    if use_hard_negatives:
        bucket_by_idx = build_tier1_buckets(name_to_idx)
        nonempty = sum(1 for v in bucket_by_idx.values() if v)
        for i in range(data.edge_index.size(1)):
            a = int(data.edge_index[0, i]); b = int(data.edge_index[1, i])
            pos_edge_set.add((a, b) if a < b else (b, a))
        if verbose:
            print(f"[D2] hard-negative setup: {nonempty}/{len(bucket_by_idx)} "
                  f"nodes have non-empty tier1 bucket  "
                  f"({len(bucket_by_idx)-nonempty} fall back to random)")
            print(f"[D2] full positive edge set: {len(pos_edge_set)} undirected")

    tier1_targets = None
    tier1_mask = None
    n_tier1 = 0
    if use_hybrid_loss:
        tier1_targets, tier1_mask = build_tier1_targets(name_to_idx)
        n_tier1 = tier1_targets.size(1)
        if verbose:
            print(f"[D2] hybrid loss: alpha={alpha}, n_tier1={n_tier1}, "
                  f"labeled_nodes={int(tier1_mask.sum().item())}/{data.num_nodes}")

    if verbose:
        print(f"[D2] data ready: N={data.num_nodes} F={in_dim}  "
              f"train_dir={split.train.size(1)} val={split.val.size(1)} "
              f"test={split.test.size(1)}  hard_negs={use_hard_negatives}  "
              f"hybrid={use_hybrid_loss}  variant={variant}  "
              f"(took {time.time()-t0:.1f}s)")

    edge_type_lookup = None
    edge_type_targets = None
    edge_type_mask = None
    if multitask and with_edge_type:
        edge_type_lookup = build_edge_type_lookup(name_to_idx)
        edge_type_targets, edge_type_mask = edge_type_targets_for(
            split.train, edge_type_lookup
        )
        if verbose:
            n_trad = int((edge_type_targets * edge_type_mask).sum().item())
            n_chem = int(((1 - edge_type_targets) * edge_type_mask).sum().item())
            n_tied = int((1 - edge_type_mask).sum().item())
            print(f"[D2] edge-type targets: tradition={n_trad} chemistry={n_chem} tied(masked)={n_tied}")

    compound_targets = None
    compound_mask = None
    compound_vocab: list[str] = []
    n_compounds = 0
    if multitask and with_compounds:
        compound_targets, compound_mask, compound_vocab = build_compound_targets(
            name_to_idx, top_k=compounds_top_k, exclude_top=compounds_exclude_top,
        )
        n_compounds = compound_targets.size(1)
        if verbose:
            print(f"[D2] compound targets: n_compounds={n_compounds} "
                  f"covered_nodes={int(compound_mask.sum().item())}/{data.num_nodes} "
                  f"(dropped top-{compounds_exclude_top} junk; took ranks "
                  f"{compounds_exclude_top}–{compounds_exclude_top + compounds_top_k})")
            print(f"[D2] compound vocab head: {compound_vocab[:5]}{' ...' if len(compound_vocab) > 5 else ''}")

    if multitask:
        model = MultiTaskGAT(
            in_dim=in_dim, hidden=64, embed=32, heads=4, dropout=0.5,
            n_tier1=n_tier1, with_recon=True, recon_hidden=64,
            with_edge_type=with_edge_type, edge_type_hidden=64,
            n_compounds=n_compounds,
        )
    else:
        model = GATLinkPredictor(
            in_dim=in_dim, hidden=64, embed=32, heads=4, dropout=0.5,
            n_tier1=n_tier1,
        )
    optimizer = torch.optim.Adam(model.parameters(), lr=lr, weight_decay=weight_decay)
    scheduler = torch.optim.lr_scheduler.ReduceLROnPlateau(
        optimizer, mode="max", factor=0.5, patience=10, min_lr=1e-5,
    )

    best_auc = -1.0
    best_state = None
    bad_epochs = 0
    history = []

    for epoch in range(1, epochs + 1):
        model.train()
        optimizer.zero_grad()
        h = model.encode(data.x, train_bi_ei, train_bi_ea)
        if use_hard_negatives and bucket_by_idx is not None:
            neg = hard_negative_sampling(
                split.train, data.num_nodes, bucket_by_idx,
                pos_edge_set, py_rng,
            )
        else:
            neg = negative_sampling(
                edge_index=split.train,
                num_nodes=data.num_nodes,
                num_neg_samples=split.train.size(1),
            )
        if multitask:
            pos_logits = model.score_links(h, split.train)
            neg_logits = model.score_links(h, neg)
        else:
            pos_logits = model.decode(h, split.train)
            neg_logits = model.decode(h, neg)
        link_logits = torch.cat([pos_logits, neg_logits])
        link_labels = torch.cat([
            torch.ones(pos_logits.size(0)),
            torch.zeros(neg_logits.size(0)),
        ])
        link_loss = F.binary_cross_entropy_with_logits(link_logits, link_labels)

        if multitask and use_hybrid_loss and tier1_targets is not None and tier1_mask is not None:
            class_logits = model.classify_tier1(h)
            per_node = F.binary_cross_entropy_with_logits(
                class_logits, tier1_targets, reduction="none"
            ).mean(dim=1)
            class_loss = (per_node * tier1_mask).sum() / tier1_mask.sum().clamp(min=1.0)
            recon_logits = model.reconstruct(h)
            recon_loss = F.binary_cross_entropy_with_logits(recon_logits, data.x)
            loss = link_loss + beta_tier1 * class_loss + beta_recon * recon_loss
            if with_edge_type and edge_type_targets is not None and edge_type_mask is not None:
                etype_logits = model.classify_edge_type(h, split.train)
                per_edge = F.binary_cross_entropy_with_logits(
                    etype_logits, edge_type_targets, reduction="none"
                )
                etype_loss = (per_edge * edge_type_mask).sum() / edge_type_mask.sum().clamp(min=1.0)
                loss = loss + beta_edge_type * etype_loss
            else:
                etype_loss = torch.tensor(0.0)
            if with_compounds and compound_targets is not None and compound_mask is not None:
                comp_logits = model.classify_compounds(h)
                per_node_c = F.binary_cross_entropy_with_logits(
                    comp_logits, compound_targets, reduction="none"
                ).mean(dim=1)
                comp_loss = (per_node_c * compound_mask).sum() / compound_mask.sum().clamp(min=1.0)
                loss = loss + beta_compounds * comp_loss
            else:
                comp_loss = torch.tensor(0.0)
        elif use_hybrid_loss and tier1_targets is not None and tier1_mask is not None:
            class_logits = model.classify(h)
            per_node = F.binary_cross_entropy_with_logits(
                class_logits, tier1_targets, reduction="none"
            ).mean(dim=1)
            class_loss = (per_node * tier1_mask).sum() / tier1_mask.sum().clamp(min=1.0)
            recon_loss = torch.tensor(0.0)
            etype_loss = torch.tensor(0.0)
            comp_loss = torch.tensor(0.0)
            loss = alpha * link_loss + (1.0 - alpha) * class_loss
        else:
            class_loss = torch.tensor(0.0)
            recon_loss = torch.tensor(0.0)
            etype_loss = torch.tensor(0.0)
            comp_loss = torch.tensor(0.0)
            loss = link_loss

        loss.backward()
        optimizer.step()

        # Eval every epoch on val (no Hits@K — too slow)
        val_metrics = eval_link(
            model, data, train_bi_ei, train_bi_ea,
            split.val, data.num_nodes, compute_hits=False,
        )
        scheduler.step(val_metrics["auc"])
        cur_lr = optimizer.param_groups[0]["lr"]
        history.append({
            "epoch": epoch,
            "train_loss": float(loss.item()),
            "link_loss": float(link_loss.item()),
            "class_loss": float(class_loss.item()),
            "recon_loss": float(recon_loss.item()),
            "etype_loss": float(etype_loss.item()),
            "comp_loss": float(comp_loss.item()),
            "val_auc": val_metrics["auc"],
            "lr": cur_lr,
        })
        if verbose and (epoch % 20 == 0 or epoch == 1):
            print(f"  epoch {epoch:3d}  total={loss.item():.4f}  "
                  f"link={link_loss.item():.4f}  class={class_loss.item():.4f}  "
                  f"recon={recon_loss.item():.4f}  etype={etype_loss.item():.4f}  "
                  f"comp={comp_loss.item():.4f}  "
                  f"val_auc={val_metrics['auc']:.4f}  lr={cur_lr:.2e}")

        if val_metrics["auc"] > best_auc:
            best_auc = val_metrics["auc"]
            best_state = {k: v.clone() for k, v in model.state_dict().items()}
            bad_epochs = 0
        else:
            bad_epochs += 1
            if bad_epochs >= patience:
                if verbose:
                    print(f"  early stop at epoch {epoch} (best val_auc={best_auc:.4f})")
                break

    assert best_state is not None
    model.load_state_dict(best_state)

    # Final eval on val + test, WITH Hits@10
    val_final = eval_link(
        model, data, train_bi_ei, train_bi_ea, split.val, data.num_nodes,
        compute_hits=True,
    )
    test_final = eval_link(
        model, data, train_bi_ei, train_bi_ea, split.test, data.num_nodes,
        compute_hits=True,
    )

    # Compute embeddings on FULL bidirectional graph (use all edges for the
    # final layout-time embedding, not just train edges).
    full_bi_ei = data.edge_index
    full_bi_ea = data.edge_attr
    model.eval()
    with torch.no_grad():
        embeddings = model.encode(data.x, full_bi_ei, full_bi_ea).cpu().numpy()

    ARTIFACTS.mkdir(parents=True, exist_ok=True)
    pt_path = ARTIFACTS / f"gat_link_{variant}.pt"
    emb_path = ARTIFACTS / f"gat_link_{variant}_embeddings.npy"
    rpt_path = ARTIFACTS / f"gat_link_{variant}_report.json"
    torch.save(
        {
            "state_dict": best_state,
            "config": {
                "in_dim": in_dim, "hidden": 64, "embed": 32,
                "heads": 4, "dropout": 0.5, "seed": seed,
                "n_tier1": n_tier1, "alpha": alpha,
                "use_hybrid_loss": use_hybrid_loss,
                "use_hard_negatives": use_hard_negatives,
            },
            "name_to_idx": name_to_idx,
        },
        pt_path,
    )
    np.save(emb_path, embeddings)
    report = {
        "variant": variant,
        "use_hybrid_loss": use_hybrid_loss,
        "use_hard_negatives": use_hard_negatives,
        "alpha": alpha,
        "val": val_final,
        "test": test_final,
        "best_val_auc": best_auc,
        "epochs_trained": len(history),
        "elapsed_s": round(time.time() - t0, 1),
        "history_tail": history[-20:],
    }
    rpt_path.write_text(json.dumps(report, indent=2), encoding="utf-8")
    if verbose:
        print(f"[D2] done in {report['elapsed_s']}s  "
              f"val_auc={val_final['auc']:.4f}  val_hits@10={val_final['hits_at_10']:.4f}  "
              f"test_auc={test_final['auc']:.4f}  test_hits@10={test_final['hits_at_10']:.4f}")
        print(f"[D2] saved {pt_path.name}, {emb_path.name}, {rpt_path.name}")
    return report


if __name__ == "__main__":
    train()
