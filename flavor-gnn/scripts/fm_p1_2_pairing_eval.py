"""FM-P1-2 — embedding link-predictor vs cosine vs co-occurrence baselines.

Question this answers (the one raised in the 2026-06-08 exploration):
  raw cosine over the GAT embeddings is a weak pairing ranker. Is that the
  *embedding's* fault (no pairing signal) or *cosine's* fault (low-resolution
  readout)? A small MLP trained on the embeddings settles it: if the MLP
  recovers held-out pairings far better than cosine, the signal is there and
  cosine just couldn't read it. If MLP ~= cosine ~= weak, the embeddings
  genuinely lack pairing structure.

Honest-experiment rules:
  * MLP input is EMBEDDINGS ONLY ([eu+ev, |eu-ev|, eu*ev], order-invariant).
    The 8 derived pairing factors (tradition/chemistry/...) are EXCLUDED —
    they are co-occurrence-correlated and would leak the baseline into the
    model, making "MLP beats heuristic" circular.
  * Held-out 15% of pairing edges are the gold. Train negatives exclude ALL
    positives (train+test) so no held-out edge is ever seen as a negative.
  * Every ranker is scored on the SAME test focals over the SAME candidate
    pool (all embedded ingredients minus focal minus the focal's TRAIN
    partners), so none gets credit for re-surfacing already-known edges.

numpy-only (no torch/sklearn in this env). Deterministic (seed=42).
Writes flavor-gnn/artifacts/fm_p1_2_eval.json.
"""
from __future__ import annotations

import json
import time
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[2]
EMB_PATH = ROOT / "public" / "proDataset" / "flavor_graph_data_v3.json"
PAIR_PATH = ROOT / "public" / "proDataset" / "pairings.json"
COOC_PATH = ROOT / "proDataset" / "processed" / "recipenlg-cooccurrence.json"
OUT_PATH = ROOT / "flavor-gnn" / "artifacts" / "fm_p1_2_eval.json"

SEED = 42
TEST_FRAC = 0.15
N_EVAL_FOCALS = 800          # sampled test focals to rank (bounded for runtime)
HIDDEN = 32
EPOCHS = 15
BATCH = 2048
LR = 5e-3
rng = np.random.default_rng(SEED)


def load_embeddings():
    data = json.loads(EMB_PATH.read_text(encoding="utf-8"))
    names, vecs = [], []
    for n in data["nodes"]:
        emb = n.get("embedding")
        if isinstance(emb, list) and len(emb) == 16:
            names.append(n["name"])
            vecs.append(emb)
    idx = {nm: i for i, nm in enumerate(names)}
    E = np.asarray(vecs, dtype=np.float64)
    # L2-normalize rows once → cosine is a dot product, and the MLP sees a
    # consistent scale.
    norms = np.linalg.norm(E, axis=1, keepdims=True)
    norms[norms == 0] = 1.0
    E = E / norms
    return names, idx, E


def load_positive_edges(idx):
    pairs = json.loads(PAIR_PATH.read_text(encoding="utf-8"))
    edges = set()
    for p in pairs:
        a, b = p.get("ingredientA"), p.get("ingredientB")
        if a in idx and b in idx and a != b:
            ia, ib = idx[a], idx[b]
            edges.add((ia, ib) if ia < ib else (ib, ia))
    return np.array(sorted(edges), dtype=np.int64)


def load_cooc(names):
    """name-pair -> co-occurrence strength (independent RecipeNLG baseline)."""
    data = json.loads(COOC_PATH.read_text(encoding="utf-8"))
    raw = data["pairs"]
    cooc = {}
    nameset = set(names)
    for key, v in raw.items():
        a, _, b = key.partition("|")
        if a in nameset and b in nameset:
            cooc[(a, b)] = v.get("strength", 0.0)
            cooc[(b, a)] = v.get("strength", 0.0)
    return cooc


def pair_features(E, ia, ib):
    """Order-invariant embedding features for index arrays ia, ib → (N,48)."""
    eu, ev = E[ia], E[ib]
    return np.concatenate([eu + ev, np.abs(eu - ev), eu * ev], axis=1)


# ── tiny numpy MLP (48 → HIDDEN → 1) with Adam ──────────────────────────────
def init_mlp(d_in):
    g = lambda *s: rng.standard_normal(s) * np.sqrt(2.0 / s[0])
    return {
        "W1": g(d_in, HIDDEN), "b1": np.zeros(HIDDEN),
        "W2": g(HIDDEN, 1), "b2": np.zeros(1),
    }


def forward(P, X):
    Z1 = X @ P["W1"] + P["b1"]
    A1 = np.maximum(Z1, 0.0)
    Z2 = A1 @ P["W2"] + P["b2"]
    out = 1.0 / (1.0 + np.exp(-Z2))
    return out, (Z1, A1)


def train_mlp(X, y):
    P = init_mlp(X.shape[1])
    m = {k: np.zeros_like(v) for k, v in P.items()}
    v = {k: np.zeros_like(v) for k, v in P.items()}
    b1d, b2d, eps, t = 0.9, 0.999, 1e-8, 0
    n = X.shape[0]
    for ep in range(EPOCHS):
        perm = rng.permutation(n)
        for s in range(0, n, BATCH):
            bi = perm[s:s + BATCH]
            xb, yb = X[bi], y[bi][:, None]
            out, (Z1, A1) = forward(P, xb)
            dZ2 = (out - yb) / len(bi)
            gW2 = A1.T @ dZ2
            gb2 = dZ2.sum(0)
            dA1 = dZ2 @ P["W2"].T
            dZ1 = dA1 * (Z1 > 0)
            gW1 = xb.T @ dZ1
            gb1 = dZ1.sum(0)
            grads = {"W1": gW1, "b1": gb1, "W2": gW2, "b2": gb2}
            t += 1
            for k in P:
                m[k] = b1d * m[k] + (1 - b1d) * grads[k]
                v[k] = b2d * v[k] + (1 - b2d) * (grads[k] ** 2)
                mhat = m[k] / (1 - b1d ** t)
                vhat = v[k] / (1 - b2d ** t)
                P[k] -= LR * mhat / (np.sqrt(vhat) + eps)
    return P


def main():
    t0 = time.time()
    names, idx, E = load_embeddings()
    pos = load_positive_edges(idx)
    cooc = load_cooc(names)
    print(f"[fm-p1-2] {len(names)} embedded ingredients, {len(pos)} positive edges, "
          f"{len(cooc)//2} cooc pairs")

    # split edges
    perm = rng.permutation(len(pos))
    n_test = int(len(pos) * TEST_FRAC)
    test_e = pos[perm[:n_test]]
    train_e = pos[perm[n_test:]]
    pos_set = {(a, b) for a, b in pos}

    # adjacency
    from collections import defaultdict
    train_adj = defaultdict(set)
    test_adj = defaultdict(set)
    for a, b in train_e:
        train_adj[a].add(b); train_adj[b].add(a)
    for a, b in test_e:
        test_adj[a].add(b); test_adj[b].add(a)

    # training set: train positives + equal random negatives (exclude all positives)
    n_neg = len(train_e)
    neg = []
    N = len(names)
    while len(neg) < n_neg:
        a = rng.integers(0, N); b = rng.integers(0, N)
        if a == b:
            continue
        key = (a, b) if a < b else (b, a)
        if key in pos_set:
            continue
        neg.append(key)
    neg = np.array(neg, dtype=np.int64)

    Xpos = pair_features(E, train_e[:, 0], train_e[:, 1])
    Xneg = pair_features(E, neg[:, 0], neg[:, 1])
    X = np.vstack([Xpos, Xneg])
    y = np.concatenate([np.ones(len(Xpos)), np.zeros(len(Xneg))])
    mu, sd = X.mean(0), X.std(0) + 1e-8
    Xn = (X - mu) / sd
    P = train_mlp(Xn, y)
    print(f"[fm-p1-2] trained MLP on {len(X)} examples in {time.time()-t0:.1f}s")

    # eval focals: test ingredients with >=1 embedded held-out partner
    focal_pool = [f for f, parts in test_adj.items() if parts]
    rng.shuffle(focal_pool)
    focal_pool = focal_pool[:N_EVAL_FOCALS]
    all_idx = np.arange(N)

    def metrics(ranker_scores_fn):
        hits, rrs = [], []
        for f in focal_pool:
            gold = test_adj[f]
            banned = train_adj[f] | {f}
            cand = all_idx[~np.isin(all_idx, list(banned))]
            scores = ranker_scores_fn(f, cand)
            order = cand[np.argsort(-scores)]
            ranks = {c: r for r, c in enumerate(order)}
            gold_ranks = sorted(ranks[g] for g in gold if g in ranks)
            if not gold_ranks:
                continue
            top = gold_ranks[0]
            hits.append(1.0 if top < 10 else 0.0)
            rrs.append(1.0 / (top + 1))
        return float(np.mean(hits)), float(np.mean(rrs)), len(hits)

    def s_random(f, cand):
        return rng.standard_normal(len(cand))

    def s_cosine(f, cand):
        return E[cand] @ E[f]          # rows L2-normalized → dot = cosine

    def s_cooc(f, cand):
        fn = names[f]
        return np.array([cooc.get((fn, names[c]), 0.0) for c in cand])

    def s_mlp(f, cand):
        fa = np.full(len(cand), f)
        X = (pair_features(E, fa, cand) - mu) / sd
        out, _ = forward(P, X)
        return out.ravel()

    results = {}
    for name, fn in [("random", s_random), ("v0_cosine", s_cosine),
                     ("cooccurrence", s_cooc), ("mlp_embeddings", s_mlp)]:
        h, mrr, n = metrics(fn)
        results[name] = {"hit@10": round(h, 4), "MRR": round(mrr, 4), "n_focals": n}
        print(f"  {name:16s}  hit@10={h:.4f}  MRR={mrr:.4f}  (n={n})")

    artifact = {
        "task": "FM-P1-2",
        "seed": SEED,
        "config": {"test_frac": TEST_FRAC, "n_eval_focals": len(focal_pool),
                   "hidden": HIDDEN, "epochs": EPOCHS, "features": "embeddings-only [u+v,|u-v|,u*v]"},
        "counts": {"ingredients": len(names), "pos_edges": int(len(pos)),
                   "train_edges": int(len(train_e)), "test_edges": int(len(test_e))},
        "results": results,
        "runtime_sec": round(time.time() - t0, 1),
    }
    OUT_PATH.write_text(json.dumps(artifact, indent=2), encoding="utf-8")
    print(f"[fm-p1-2] wrote {OUT_PATH.relative_to(ROOT)}  ({artifact['runtime_sec']}s)")


if __name__ == "__main__":
    main()
