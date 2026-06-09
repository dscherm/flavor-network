"""FM-P2-1 / FM-P2-2 — conditional set-completion model for recipe generation.

Task: given a target flavor profile (11-D) + optional cuisine + optional season
+ optionally a few already-chosen ingredients, score every vocab ingredient for
"belongs in this recipe." This serves BOTH product flows:
  - "user picked a few ingredients, suggest the rest"  (observed set non-empty)
  - "generate a recipe for this profile"               (observed set empty)

Architecture (Deep-Sets encoder, tied output head):
  pooled(observed) + Linear(profile) + Emb(cuisine) + Emb(season)
    -> residual MLP -> context
    -> logits = context @ ingredient_embedding.T + bias   (over the vocab)
Multi-label BCE; observed ingredients are masked out of the loss.

Training tricks:
  - p_empty: a fraction of examples have an EMPTY observed set (pure generation).
  - conditioning dropout: cuisine/season randomly set to null so inference works
    when the user gives neither (they are OPTIONAL by design).

Eval (FM-P2-2, held-out by recipe index % 10 == 0):
  - reconstruction hit@10 / recall@10 vs a popularity baseline (mask observed)
  - profile fidelity: generate from a target profile, recompute the generated
    set's profile, cosine to target — vs popularity baseline.

CPU PyTorch. Deterministic (seed=42). Writes:
  flavor-gnn/artifacts/fm_p2_setcompletion.pt
  flavor-gnn/artifacts/fm_p2_eval.json
"""
from __future__ import annotations

import argparse
import json
import time
from pathlib import Path

import numpy as np
import torch
import torch.nn as nn

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "flavor-gnn" / "data"
ART = ROOT / "flavor-gnn" / "artifacts"
HEADS = ["sweet", "bitter", "umami", "salty", "sour",
         "odor_fruity", "odor_floral", "odor_green", "odor_woody", "odor_spicy", "odor_fatty"]
SEED = 42


class SetCompletion(nn.Module):
    def __init__(self, vocab, d, n_cuisine, n_season):
        super().__init__()
        self.V = vocab
        self.emb = nn.Embedding(vocab + 1, d, padding_idx=vocab)  # index V = pad/empty
        self.prof = nn.Linear(11, d)
        self.cue = nn.Embedding(n_cuisine + 1, d)   # last index = null
        self.sea = nn.Embedding(n_season + 1, d)    # last index = null
        self.mlp = nn.Sequential(nn.Linear(d, d), nn.ReLU(), nn.Linear(d, d))
        self.bias = nn.Parameter(torch.zeros(vocab))

    def forward(self, obs_ids, obs_mask, profile, cuisine, season):
        e = self.emb(obs_ids)                                   # [B,L,d]
        denom = obs_mask.sum(1, keepdim=True).clamp(min=1.0)
        pooled = (e * obs_mask.unsqueeze(-1)).sum(1) / denom    # [B,d]
        ctx = pooled + self.prof(profile) + self.cue(cuisine) + self.sea(season)
        ctx = ctx + self.mlp(ctx)
        return ctx @ self.emb.weight[: self.V].t() + self.bias  # [B,V]


def load_data():
    z = np.load(DATA / "train_tensors.npz")
    cond = json.loads((DATA / "cond_vocab.json").read_text(encoding="utf-8"))
    V = int(z["vocab_size"])
    offsets = z["offsets"]
    members = z["member_ids"]
    N = len(offsets) - 1
    sets = [members[offsets[i]:offsets[i + 1]] for i in range(N)]
    return {
        "V": V, "sets": sets,
        "profiles": z["profiles"], "cuisine": z["cuisine"], "season": z["season"],
        "n_cuisine": len(cond["cuisine_vocab"]), "n_season": len(cond["season_vocab"]),
        "cuisine_vocab": cond["cuisine_vocab"], "season_vocab": cond["season_vocab"],
    }


def vocab_profiles(V):
    """Per-vocab-id 11-D profile (for profile-fidelity eval)."""
    vocab = json.loads((DATA / "vocab.json").read_text(encoding="utf-8"))["vocab"]
    name_to_id = {n: i for i, n in enumerate(vocab)}
    ent = json.loads((ROOT / "public" / "proDataset" / "gnn_entropy.json").read_text(encoding="utf-8"))
    P = np.zeros((V, 11), dtype=np.float32)
    for name, rec in ent.items():
        i = name_to_id.get(name.lower())
        if i is None:
            continue
        p = rec.get("probs", {})
        P[i] = [float(p.get(h, 0.0)) for h in HEADS]
    return P, vocab


def make_batch(D, idxs, rng, maxlen, p_empty, cond_drop, n_cuisine, n_season):
    B = len(idxs)
    V = D["V"]
    obs = np.full((B, maxlen), V, dtype=np.int64)   # pad
    obs_mask = np.zeros((B, maxlen), dtype=np.float32)
    targets = np.zeros((B, V), dtype=np.float32)
    loss_mask = np.ones((B, V), dtype=np.float32)
    for b, i in enumerate(idxs):
        s = D["sets"][i]
        m = s.copy()
        rng.shuffle(m)
        if rng.random() < p_empty or len(m) < 2:
            n_obs = 0
        else:
            n_obs = rng.integers(1, len(m))         # 1..len-1 observed
        observed, tgt = m[:n_obs], m[n_obs:]
        for j, oid in enumerate(observed[:maxlen]):
            obs[b, j] = oid
            obs_mask[b, j] = 1.0
            loss_mask[b, oid] = 0.0                 # don't supervise observed
        for tid in tgt:
            targets[b, tid] = 1.0
    cue = D["cuisine"][idxs].astype(np.int64).copy()
    sea = D["season"][idxs].astype(np.int64).copy()
    cue[cue < 0] = n_cuisine                        # null index
    sea[sea < 0] = n_season
    # conditioning dropout → null (so optional cuisine/season works at inference)
    cue[rng.random(B) < cond_drop] = n_cuisine
    sea[rng.random(B) < cond_drop] = n_season
    return (torch.from_numpy(obs), torch.from_numpy(obs_mask),
            torch.from_numpy(D["profiles"][idxs]), torch.from_numpy(cue),
            torch.from_numpy(sea), torch.from_numpy(targets), torch.from_numpy(loss_mask))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--steps", type=int, default=6000)
    ap.add_argument("--batch", type=int, default=512)
    ap.add_argument("--dim", type=int, default=128)
    ap.add_argument("--lr", type=float, default=1e-3)
    ap.add_argument("--maxlen", type=int, default=32)
    args = ap.parse_args()
    torch.manual_seed(SEED)
    rng = np.random.default_rng(SEED)
    t0 = time.time()

    D = load_data()
    V, n_cuisine, n_season = D["V"], D["n_cuisine"], D["n_season"]
    N = len(D["sets"])
    all_idx = np.arange(N)
    test_idx = all_idx[all_idx % 10 == 0]
    train_idx = all_idx[all_idx % 10 != 0]
    print(f"[fm-p2] V={V} recipes={N} train={len(train_idx)} test={len(test_idx)} "
          f"cuisines={n_cuisine} seasons={n_season}")

    model = SetCompletion(V, args.dim, n_cuisine, n_season)
    opt = torch.optim.Adam(model.parameters(), lr=args.lr)
    lossfn = nn.BCEWithLogitsLoss(reduction="none")
    model.train()
    run_loss = 0.0
    for step in range(1, args.steps + 1):
        idxs = rng.choice(train_idx, size=args.batch, replace=False)
        obs, om, prof, cue, sea, tgt, lm = make_batch(
            D, idxs, rng, args.maxlen, p_empty=0.3, cond_drop=0.3, n_cuisine=n_cuisine, n_season=n_season)
        logits = model(obs, om, prof, cue, sea)
        loss = (lossfn(logits, tgt) * lm).sum() / lm.sum()
        opt.zero_grad(); loss.backward(); opt.step()
        run_loss += loss.item()
        if step % 500 == 0:
            print(f"[fm-p2]   step {step}/{args.steps}  loss {run_loss/500:.4f}  ({time.time()-t0:.0f}s)")
            run_loss = 0.0

    ART.mkdir(parents=True, exist_ok=True)
    torch.save({"state_dict": model.state_dict(), "V": V, "dim": args.dim,
                "n_cuisine": n_cuisine, "n_season": n_season, "heads": HEADS},
               ART / "fm_p2_setcompletion.pt")
    print(f"[fm-p2] trained in {time.time()-t0:.0f}s, saved checkpoint")

    # ── Eval (FM-P2-2) ──
    model.eval()
    P, _ = vocab_profiles(V)
    # popularity baseline
    pop = np.zeros(V, dtype=np.int64)
    for i in train_idx:
        pop[D["sets"][i]] += 1
    pop_order = np.argsort(-pop)

    eval_sample = test_idx[(test_idx % 50 == 0)][:3000]  # ~thousands, bounded
    hit_model, hit_pop, rec_model = [], [], []
    with torch.no_grad():
        for i in eval_sample:
            s = D["sets"][i]
            if len(s) < 3:
                continue
            half = len(s) // 2
            observed, tgt = s[:half], set(int(x) for x in s[half:])
            obs = np.full((1, args.maxlen), V, dtype=np.int64)
            om = np.zeros((1, args.maxlen), dtype=np.float32)
            for j, oid in enumerate(observed[:args.maxlen]):
                obs[0, j] = oid; om[0, j] = 1.0
            cue = np.array([D["cuisine"][i] if D["cuisine"][i] >= 0 else n_cuisine], dtype=np.int64)
            sea = np.array([D["season"][i] if D["season"][i] >= 0 else n_season], dtype=np.int64)
            logits = model(torch.from_numpy(obs), torch.from_numpy(om),
                           torch.from_numpy(D["profiles"][i:i+1]),
                           torch.from_numpy(cue), torch.from_numpy(sea))[0].numpy()
            logits[observed] = -1e9                              # exclude observed
            top = np.argsort(-logits)[:10]
            hit_model.append(1.0 if any(t in tgt for t in top) else 0.0)
            rec_model.append(len(set(int(x) for x in top) & tgt) / len(tgt))
            # popularity baseline (also exclude observed)
            pop_top = [x for x in pop_order if x not in set(int(o) for o in observed)][:10]
            hit_pop.append(1.0 if any(t in tgt for t in pop_top) else 0.0)

    # profile fidelity: generate from empty observed + target profile, cos to target
    def cos(a, b):
        na, nb = np.linalg.norm(a), np.linalg.norm(b)
        return float(a @ b / (na * nb)) if na and nb else 0.0
    fid_model, fid_pop = [], []
    with torch.no_grad():
        for i in eval_sample[:1000]:
            tgt_prof = D["profiles"][i]
            if not np.any(tgt_prof):
                continue
            obs = np.full((1, args.maxlen), V, dtype=np.int64)
            om = np.zeros((1, args.maxlen), dtype=np.float32)
            cue = np.array([n_cuisine], dtype=np.int64); sea = np.array([n_season], dtype=np.int64)
            logits = model(torch.from_numpy(obs), torch.from_numpy(om),
                           torch.from_numpy(tgt_prof[None]), torch.from_numpy(cue),
                           torch.from_numpy(sea))[0].numpy()
            gen = np.argsort(-logits)[:8]
            gen_prof = P[gen].mean(axis=0)
            fid_model.append(cos(gen_prof, tgt_prof))
            fid_pop.append(cos(P[pop_order[:8]].mean(axis=0), tgt_prof))

    results = {
        "task": "FM-P2",
        "n_eval_recon": len(hit_model),
        "reconstruction": {
            "hit@10": {"model": round(float(np.mean(hit_model)), 4), "popularity": round(float(np.mean(hit_pop)), 4)},
            "recall@10_model": round(float(np.mean(rec_model)), 4),
        },
        "profile_fidelity_cos": {"model": round(float(np.mean(fid_model)), 4),
                                  "popularity": round(float(np.mean(fid_pop)), 4)},
        "steps": args.steps, "dim": args.dim, "runtime_sec": round(time.time() - t0, 1),
    }
    (ART / "fm_p2_eval.json").write_text(json.dumps(results, indent=2), encoding="utf-8")
    print(f"[fm-p2] recon hit@10 model={results['reconstruction']['hit@10']['model']} "
          f"pop={results['reconstruction']['hit@10']['popularity']}")
    print(f"[fm-p2] profile-fidelity cos model={results['profile_fidelity_cos']['model']} "
          f"pop={results['profile_fidelity_cos']['popularity']}")
    print(f"[fm-p2] wrote fm_p2_eval.json")


if __name__ == "__main__":
    main()
