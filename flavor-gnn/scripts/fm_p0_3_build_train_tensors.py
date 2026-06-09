"""FM-P0-3 — compile the recipe corpus + conditioning labels into train tensors.

Reads (all build-time):
  flavor-gnn/data/recipe_sets.jsonl   (FM-P0-2: {r, v:[ids], ...})
  flavor-gnn/data/vocab.json          (id -> name)
  public/proDataset/gnn_entropy.json  (name -> {probs: 11 taste/aroma heads})
  public/data/cuisine_map.json        (name -> [cuisines])
  public/data/season_region.json      (name -> {season, regions})

Per recipe, derives the conditioning the set-completion model trains on:
  profile[11] = mean of member ingredients' gnn_entropy probs (members with a
                prediction; renormalized is unnecessary — probs are independent heads)
  cuisine     = majority vote over members' cuisines (id, or -1 = null/optional)
  season      = majority vote over members' seasons  (id, or -1 = null/optional)

Writes flavor-gnn/data/train_tensors.npz (CSR-style member arrays + label arrays)
and flavor-gnn/data/cond_vocab.json (cuisine/season id maps). Deterministic.
"""
from __future__ import annotations

import json
from collections import Counter
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "flavor-gnn" / "data"
HEADS = ["sweet", "bitter", "umami", "salty", "sour",
         "odor_fruity", "odor_floral", "odor_green", "odor_woody", "odor_spicy", "odor_fatty"]


def main():
    vocab = json.loads((DATA / "vocab.json").read_text(encoding="utf-8"))["vocab"]
    V = len(vocab)
    name_to_id = {n: i for i, n in enumerate(vocab)}

    # Per-vocab-id profile table (V x 11) + has-profile mask.
    ent = json.loads((ROOT / "public" / "proDataset" / "gnn_entropy.json").read_text(encoding="utf-8"))
    prof = np.zeros((V, 11), dtype=np.float32)
    has_prof = np.zeros(V, dtype=bool)
    for name, rec in ent.items():
        i = name_to_id.get(name.lower())
        if i is None:
            continue
        p = rec.get("probs", {})
        prof[i] = [float(p.get(h, 0.0)) for h in HEADS]
        has_prof[i] = True
    print(f"[fm-p0-3] profiles: {int(has_prof.sum())}/{V} vocab ingredients have gnn_entropy")

    # Per-vocab-id cuisine list + season (string), via id maps.
    cmap = json.loads((ROOT / "public" / "data" / "cuisine_map.json").read_text(encoding="utf-8"))
    smap = json.loads((ROOT / "public" / "data" / "season_region.json").read_text(encoding="utf-8"))

    cuisine_vocab: list[str] = []
    cuisine_id = {}
    def cid(c):
        if c not in cuisine_id:
            cuisine_id[c] = len(cuisine_vocab); cuisine_vocab.append(c)
        return cuisine_id[c]
    season_vocab: list[str] = []
    season_id = {}
    def sid(s):
        if s not in season_id:
            season_id[s] = len(season_vocab); season_vocab.append(s)
        return season_id[s]

    vocab_cuisines: list[list[int]] = [[] for _ in range(V)]
    vocab_season = np.full(V, -1, dtype=np.int16)
    for name, cs in cmap.items():
        i = name_to_id.get(name.lower())
        if i is None or not isinstance(cs, list):
            continue
        vocab_cuisines[i] = [cid(c) for c in cs]
    for name, rec in smap.items():
        i = name_to_id.get(name.lower())
        if i is None:
            continue
        s = rec.get("season")
        if s:
            vocab_season[i] = sid(s)

    # Stream recipes → per-recipe member ids + conditioning.
    member_ids: list[int] = []
    offsets = [0]
    profiles: list[np.ndarray] = []
    rec_cuisine: list[int] = []
    rec_season: list[int] = []
    n = 0
    with open(DATA / "recipe_sets.jsonl", encoding="utf-8") as fh:
        for line in fh:
            if not line.strip():
                continue
            o = json.loads(line)
            ids = o["v"]
            member_ids.extend(ids)
            offsets.append(len(member_ids))

            # profile = mean over members with a profile (else zeros)
            mask = has_prof[ids]
            profiles.append(prof[ids][mask].mean(axis=0) if mask.any() else np.zeros(11, dtype=np.float32))

            # cuisine majority vote across members' cuisine lists
            cc = Counter()
            for mid in ids:
                cc.update(vocab_cuisines[mid])
            rec_cuisine.append(cc.most_common(1)[0][0] if cc else -1)

            # season majority vote
            sc = Counter(int(vocab_season[mid]) for mid in ids if vocab_season[mid] >= 0)
            rec_season.append(sc.most_common(1)[0][0] if sc else -1)

            n += 1
            if n % 250000 == 0:
                print(f"[fm-p0-3]   ...{n} recipes")

    member_ids = np.asarray(member_ids, dtype=np.int32)
    offsets = np.asarray(offsets, dtype=np.int64)
    profiles = np.asarray(profiles, dtype=np.float32)
    rec_cuisine = np.asarray(rec_cuisine, dtype=np.int16)
    rec_season = np.asarray(rec_season, dtype=np.int16)

    np.savez(DATA / "train_tensors.npz",
             member_ids=member_ids, offsets=offsets, profiles=profiles,
             cuisine=rec_cuisine, season=rec_season, vocab_size=np.int64(V))
    (DATA / "cond_vocab.json").write_text(json.dumps({
        "heads": HEADS,
        "cuisine_vocab": cuisine_vocab,
        "season_vocab": season_vocab,
    }), encoding="utf-8")

    cov_c = float((rec_cuisine >= 0).mean())
    cov_s = float((rec_season >= 0).mean())
    print(f"[fm-p0-3] {n} recipes | {len(member_ids)} member refs | "
          f"cuisine-labeled {cov_c:.1%} ({len(cuisine_vocab)} cuisines) | "
          f"season-labeled {cov_s:.1%} ({len(season_vocab)} seasons)")
    print(f"[fm-p0-3] wrote train_tensors.npz + cond_vocab.json")


if __name__ == "__main__":
    main()
