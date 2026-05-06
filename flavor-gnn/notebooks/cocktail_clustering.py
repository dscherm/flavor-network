"""
Cocktail Codex v2 — Phase 5 clustering.

Implements the spec at docs/cocktail-codex-v2/spec.md sections 5–7:
build per-cocktail feature vectors from structural slots + taste +
aroma layers + engineering metadata, run candidate clustering
algorithms, evaluate against the validation harness, select the
winning model.

Run:  python flavor-gnn/notebooks/cocktail_clustering.py

Outputs:
  proDataset/cocktails_v2/data/cocktail_clusters.json
  proDataset/cocktails_v2/data/cocktail_clusters_report.txt
"""

from __future__ import annotations

import csv
import json
import unicodedata
from collections import Counter, defaultdict
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.cluster import AgglomerativeClustering, KMeans
from sklearn.metrics import silhouette_score
from sklearn.preprocessing import StandardScaler

ROOT = Path(__file__).resolve().parent.parent.parent
CORPUS_PATH = ROOT / "proDataset/cocktails_v2/raw/corpus_v3.json"
SLOTS_CSV = ROOT / "proDataset/cocktails_v2/data/cocktail_ingredient_slots.csv"
LAYERS_CSV = ROOT / "proDataset/cocktails_v2/data/cocktail_aroma_layers.csv"
ENGINEERING_CSV = ROOT / "proDataset/cocktails_v2/data/cocktail_engineering.csv"
GNN_ENTROPY_PATH = ROOT / "public/proDataset/gnn_entropy.json"

OUT_DIR = ROOT / "proDataset/cocktails_v2/data"
OUT_CLUSTERS = OUT_DIR / "cocktail_clusters.json"
OUT_REPORT = OUT_DIR / "cocktail_clusters_report.txt"

SLOTS = ["spirit", "sweet", "sour", "bitter", "vermouth", "amaro_liqueur", "aromatic", "modifier"]
LAYERS = ["top", "middle", "bass"]
# Per spec §5.3: drop salty + odor_spicy (chemdataset F1 ≤ 0.5).
TASTE_CHANNELS = [
    "sweet", "bitter", "sour", "umami",
    "odor_fruity", "odor_fatty", "odor_green", "odor_woody", "odor_floral",
]


def normalize_name(s: str) -> str:
    if not s:
        return ""
    s = s.lower()
    s = unicodedata.normalize("NFD", s)
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    s = s.replace("'", "").replace("’", "").replace("`", "")
    out = []
    for c in s:
        if c.isalnum() or c in " -":
            out.append(c)
    return " ".join("".join(out).split()).strip()


# ── Load all artifacts ─────────────────────────────────────────────────

def load_corpus() -> list[dict]:
    with CORPUS_PATH.open("r", encoding="utf-8") as f:
        return json.load(f)["cocktails"]


def load_slot_dict() -> dict[str, str]:
    out = {}
    with SLOTS_CSV.open("r", encoding="utf-8") as f:
        rdr = csv.reader(f)
        next(rdr)
        for row in rdr:
            if len(row) < 2:
                continue
            ingredient, slot = row[0], row[1]
            if slot:
                out[ingredient] = slot
    return out


def load_layer_dict() -> dict[str, str]:
    out = {}
    with LAYERS_CSV.open("r", encoding="utf-8") as f:
        rdr = csv.reader(f)
        next(rdr)
        for row in rdr:
            if len(row) < 3:
                continue
            ingredient, _, layer = row[0], row[1], row[2]
            if layer:
                out[ingredient] = layer
    return out


def load_engineering() -> dict[str, dict]:
    out = {}
    with ENGINEERING_CSV.open("r", encoding="utf-8") as f:
        rdr = csv.reader(f)
        next(rdr)
        for row in rdr:
            if len(row) < 9:
                continue
            cocktail, canonical, build, _bc, glass, _gc, ice, _ic, aer = row[:9]
            out[canonical] = {
                "build_method": build,
                "glass_type": glass,
                "ice_format": ice,
                "aeration": aer,
            }
    return out


def load_gnn_taste() -> dict[str, dict[str, float]]:
    """Per-ingredient calibrated taste/odor probabilities."""
    with GNN_ENTROPY_PATH.open("r", encoding="utf-8") as f:
        raw = json.load(f)
    # gnn_entropy.json schema is {ingredient: {sweet, bitter, sour, ...}}
    # under either a top-level dict or under a "predictions" key.
    if isinstance(raw, dict) and "predictions" in raw:
        return {normalize_name(k): v for k, v in raw["predictions"].items()}
    return {normalize_name(k): v for k, v in raw.items()}


# ── Feature engineering ───────────────────────────────────────────────


def cocktail_volume(c: dict) -> float:
    return sum(
        i.get("amount_ml") or 0.0 for i in c.get("ingredients_raw", [])
    )


def slot_ratios(c: dict, slot_dict: dict[str, str]) -> dict[str, float]:
    """Volume-weighted slot proportions; returns dict summing to 1.0
    (or all zeros if no measured volumes)."""
    counts = Counter()
    total = 0.0
    for ing in c.get("ingredients_raw", []):
        name = normalize_name(ing.get("name") or ing.get("raw") or "")
        slot = slot_dict.get(name)
        if not slot:
            continue
        amt = ing.get("amount_ml") or 0.0
        # If amount is missing, fall back to per-ingredient unit weight
        # so the cocktail still gets a slot signature.
        if amt <= 0:
            amt = 30.0  # ~1 oz default for unmeasured ingredients
        counts[slot] += amt
        total += amt
    if total <= 0:
        return {s: 0.0 for s in SLOTS}
    return {s: counts.get(s, 0.0) / total for s in SLOTS}


def layer_signature(c: dict, layer_dict: dict[str, str]) -> dict[str, float]:
    counts = Counter()
    total = 0.0
    for ing in c.get("ingredients_raw", []):
        name = normalize_name(ing.get("name") or ing.get("raw") or "")
        layer = layer_dict.get(name)
        if not layer:
            continue
        amt = ing.get("amount_ml") or 30.0
        counts[layer] += amt
        total += amt
    if total <= 0:
        return {l: 0.0 for l in LAYERS}
    return {l: counts.get(l, 0.0) / total for l in LAYERS}


def taste_vector(c: dict, gnn: dict[str, dict[str, float]]) -> dict[str, float]:
    """Volume-weighted taste vector. Channels per TASTE_CHANNELS."""
    accum = {ch: 0.0 for ch in TASTE_CHANNELS}
    total = 0.0
    for ing in c.get("ingredients_raw", []):
        name = normalize_name(ing.get("name") or ing.get("raw") or "")
        probs = gnn.get(name)
        if not probs:
            continue
        amt = ing.get("amount_ml") or 30.0
        for ch in TASTE_CHANNELS:
            accum[ch] += probs.get(ch, 0.0) * amt
        total += amt
    if total <= 0:
        return accum
    return {ch: v / total for ch, v in accum.items()}


def engineering_onehot(eng: dict) -> dict[str, float]:
    """Lightweight one-hot. Skips unknowns (just leaves zero columns)."""
    out = {}
    # Build method
    for v in ("shake", "stir", "build", "blend", "swizzle", "muddle", "throw"):
        out[f"build_{v}"] = 1.0 if eng.get("build_method") == v else 0.0
    # Glass collapsed to 3 buckets per spec §5.5
    glass = eng.get("glass_type", "")
    out["glass_coupe_style"] = 1.0 if glass in ("coupe",) else 0.0
    out["glass_rocks_style"] = 1.0 if glass in ("rocks",) else 0.0
    out["glass_tall_style"] = 1.0 if glass in ("highball", "hurricane") else 0.0
    # Aeration as ordinal scalar
    aer_map = {"low": 0.0, "medium": 0.5, "high": 1.0}
    out["aeration"] = aer_map.get(eng.get("aeration", ""), 0.5)
    return out


# ── Feature matrix assembly ───────────────────────────────────────────


def build_features(corpus, slot_dict, layer_dict, eng_dict, gnn) -> pd.DataFrame:
    rows = []
    for c in corpus:
        canonical = c["name_canonical"]
        slots = slot_ratios(c, slot_dict)
        layers = layer_signature(c, layer_dict)
        taste = taste_vector(c, gnn)
        eng = engineering_onehot(eng_dict.get(canonical, {}))
        row = {
            "name": c["name"],
            "canonical": canonical,
            "iba_official": c.get("iba_official", False),
            **{f"slot_{k}": v for k, v in slots.items()},
            **{f"layer_{k}": v for k, v in layers.items()},
            **{f"taste_{k}": v for k, v in taste.items()},
            **eng,
        }
        rows.append(row)
    df = pd.DataFrame(rows)
    return df


def feature_block_scale(df: pd.DataFrame) -> tuple[np.ndarray, list[str]]:
    """Scale each feature block (slots / taste / layers / engineering)
    to zero-mean unit-variance independently, so no block dominates."""
    blocks = {
        "slot": [c for c in df.columns if c.startswith("slot_")],
        "layer": [c for c in df.columns if c.startswith("layer_")],
        "taste": [c for c in df.columns if c.startswith("taste_")],
        "eng_build": [c for c in df.columns if c.startswith("build_")],
        "eng_glass": [c for c in df.columns if c.startswith("glass_")],
        "eng_aer": ["aeration"],
    }
    parts = []
    feature_cols = []
    for block_name, cols in blocks.items():
        if not cols:
            continue
        sub = df[cols].fillna(0.0).to_numpy()
        if sub.std(axis=0).sum() > 0:
            sub = StandardScaler().fit_transform(sub)
        parts.append(sub)
        feature_cols.extend(cols)
    return np.hstack(parts), feature_cols


# ── Megacategory anchor (pre-clustering label) ────────────────────────

CANONICAL_SOUR = {
    "daiquiri", "margarita", "gimlet", "whiskey sour", "sidecar",
    "bees knees", "aviation", "mai tai", "jungle bird", "last word",
    "paper plane", "trinidad sour", "naked and famous", "penicillin",
    "hemingway special", "tommys margarita", "white lady", "mojito",
    "tom collins", "john collins", "french 75", "south side",
}
CANONICAL_BITTER = {
    "negroni", "manhattan", "old fashioned", "boulevardier",
    "sazerac", "vieux carre", "rob roy", "martinez", "americano",
    "hanky panky", "monkey gland", "tuxedo", "casino",
    "rusty nail", "remember the maine", "vesper", "martini",
    "dry martini", "gibson",
}


def megacategory(c: dict, slots: dict[str, float]) -> str:
    cn = c["name_canonical"]
    if cn in CANONICAL_SOUR:
        return "sour"
    if cn in CANONICAL_BITTER:
        return "bitter"
    has_sour = slots.get("slot_sour", 0) > 0.05
    has_sweet = slots.get("slot_sweet", 0) > 0.05
    has_spirit = slots.get("slot_spirit", 0) > 0.10
    has_vermouth = slots.get("slot_vermouth", 0) > 0.05
    has_amaro = slots.get("slot_amaro_liqueur", 0) > 0.10
    if has_sour and has_sweet and has_spirit:
        return "sour"
    if has_vermouth or (has_amaro and not has_sour):
        return "bitter"
    return "unclassified"


# ── Validation harness (spec §7) ──────────────────────────────────────

NEAR_PAIRS = [
    ("negroni", "boulevardier"),
    ("manhattan", "rob roy"),
    ("daiquiri", "gimlet"),
    ("daiquiri", "margarita"),
    ("whiskey sour", "daiquiri"),
    ("old fashioned", "sazerac"),
    ("martini", "gibson"),
    ("martini", "vesper"),
    ("aviation", "bees knees"),
    ("mai tai", "jungle bird"),
]
FAR_PAIRS = [
    ("negroni", "daiquiri"),
    ("old fashioned", "daiquiri"),
    ("manhattan", "margarita"),
    ("bloody mary", "old fashioned"),
]


def harness_score(df: pd.DataFrame, labels: np.ndarray) -> dict:
    canonical_to_label = {row.canonical: lbl for row, lbl in zip(df.itertuples(), labels)}
    near_hits = 0
    near_total = 0
    near_misses = []
    for a, b in NEAR_PAIRS:
        la, lb = canonical_to_label.get(a), canonical_to_label.get(b)
        if la is None or lb is None:
            continue
        near_total += 1
        if la == lb:
            near_hits += 1
        else:
            near_misses.append((a, b, la, lb))
    far_hits = 0
    far_total = 0
    far_misses = []
    for a, b in FAR_PAIRS:
        la, lb = canonical_to_label.get(a), canonical_to_label.get(b)
        if la is None or lb is None:
            continue
        far_total += 1
        if la != lb:
            far_hits += 1
        else:
            far_misses.append((a, b, la, lb))
    return {
        "near_hit_rate": near_hits / max(near_total, 1),
        "far_hit_rate": far_hits / max(far_total, 1),
        "near_total": near_total,
        "far_total": far_total,
        "near_misses": near_misses,
        "far_misses": far_misses,
    }


# ── Clustering experiments ────────────────────────────────────────────


def run_kmeans_sweep(X: np.ndarray, df: pd.DataFrame) -> list[dict]:
    results = []
    for k in range(4, 8):
        km = KMeans(n_clusters=k, random_state=42, n_init=10).fit(X)
        labels = km.labels_
        sil = silhouette_score(X, labels)
        score = harness_score(df, labels)
        composite = 0.4 * sil + 0.4 * score["near_hit_rate"] + 0.2 * score["far_hit_rate"]
        results.append({
            "model": f"kmeans-k{k}",
            "k": k,
            "silhouette": float(sil),
            "near_hit_rate": score["near_hit_rate"],
            "far_hit_rate": score["far_hit_rate"],
            "composite": float(composite),
            "labels": labels.tolist(),
            "near_misses": score["near_misses"],
            "far_misses": score["far_misses"],
        })
    return results


def run_hierarchical_sweep(X: np.ndarray, df: pd.DataFrame) -> list[dict]:
    results = []
    for k in range(4, 8):
        ag = AgglomerativeClustering(n_clusters=k, linkage="ward").fit(X)
        labels = ag.labels_
        sil = silhouette_score(X, labels)
        score = harness_score(df, labels)
        composite = 0.4 * sil + 0.4 * score["near_hit_rate"] + 0.2 * score["far_hit_rate"]
        results.append({
            "model": f"hierarchical-ward-k{k}",
            "k": k,
            "silhouette": float(sil),
            "near_hit_rate": score["near_hit_rate"],
            "far_hit_rate": score["far_hit_rate"],
            "composite": float(composite),
            "labels": labels.tolist(),
            "near_misses": score["near_misses"],
            "far_misses": score["far_misses"],
        })
    return results


# ── Cluster naming + reporting ────────────────────────────────────────


# ── Sub-clustering ────────────────────────────────────────────────────


MIN_SUB_SIZE = 5  # any sub-cluster smaller than this is merged back


def subcluster(X: np.ndarray, parent_labels: np.ndarray, df: pd.DataFrame, max_sub_k: int = 4) -> tuple[np.ndarray, dict]:
    """For each parent cluster, run a 2nd-level K-means with K chosen
    by silhouette. Sub-clusters with fewer than MIN_SUB_SIZE members
    are merged back into the largest sibling.
    Returns:
      - sub_labels: same length as parent_labels, integer encoding
        within each parent cluster (0..sub_k-1)
      - hierarchy: dict[parent_id -> dict[sub_id -> { size, exemplars }]]
    """
    sub_labels = np.full_like(parent_labels, -1)
    hierarchy: dict[int, dict] = {}
    for pid in sorted(set(parent_labels.tolist())):
        mask = parent_labels == pid
        n = int(mask.sum())
        # Floor: need ≥ MIN_SUB_SIZE per sub, ≥ 2 sub-clusters total.
        # Ceiling: per spec 4-7 top-level + max ~5 sub gives ~30 combos.
        # Cap sub_k by cluster size so smallest sub still ≥ MIN_SUB_SIZE
        # in expectation.
        upper = max(2, min(max_sub_k, n // (MIN_SUB_SIZE * 2)))
        if n < MIN_SUB_SIZE * 2 or upper < 2:
            # Tiny cluster — single sub-bucket.
            sub_labels[mask] = 0
            hierarchy[int(pid)] = {0: {"size": n, "exemplars": list(df[mask]["name"].head(5))}}
            continue
        Xp = X[mask]
        best_sub_k = 2
        best_sil = -1.0
        best_labels = None
        for sk in range(2, upper + 1):
            try:
                km = KMeans(n_clusters=sk, random_state=42, n_init=10).fit(Xp)
                sil = silhouette_score(Xp, km.labels_)
                if sil > best_sil:
                    best_sil = sil
                    best_sub_k = sk
                    best_labels = km.labels_
            except Exception:
                continue
        if best_labels is None:
            sub_labels[mask] = 0
            hierarchy[int(pid)] = {0: {"size": n, "exemplars": list(df[mask]["name"].head(5))}}
            continue
        # Merge sub-clusters smaller than MIN_SUB_SIZE into the nearest
        # surviving sibling (centroid distance). Avoids 77 vs 1 splits.
        best_labels = best_labels.copy()
        while True:
            sizes = Counter(best_labels.tolist())
            tiny = [sid for sid, sz in sizes.items() if sz < MIN_SUB_SIZE]
            if not tiny or len(sizes) <= 1:
                break
            # Compute centroids of each surviving (non-tiny) cluster
            survivors = [s for s, sz in sizes.items() if sz >= MIN_SUB_SIZE]
            if not survivors:
                # All tiny — collapse everything to a single sub
                best_labels[:] = 0
                break
            centroids = {s: Xp[best_labels == s].mean(axis=0) for s in survivors}
            # Reassign every member of every tiny sub to the nearest survivor
            for ts in tiny:
                ts_idx = np.where(best_labels == ts)[0]
                for i in ts_idx:
                    nearest = min(
                        survivors,
                        key=lambda s: float(np.linalg.norm(Xp[i] - centroids[s])),
                    )
                    best_labels[i] = nearest
        # Renumber sub-cluster IDs to be 0..k-1 contiguous
        unique = sorted(set(best_labels.tolist()))
        remap = {old: new for new, old in enumerate(unique)}
        best_labels = np.array([remap[s] for s in best_labels])
        sub_labels[mask] = best_labels
        # Build hierarchy entry
        sub_dict: dict[int, dict] = {}
        sub_df = df[mask].reset_index(drop=True)
        for sid in sorted(set(best_labels.tolist())):
            sub_mask = best_labels == sid
            sub_members = sub_df[sub_mask]
            iba_first = list(sub_members[sub_members["iba_official"] == True]["name"].head(5))
            exemplars = iba_first if len(iba_first) >= 3 else list(sub_members["name"].head(5))
            # Sub-cluster signature: which slot/layer dominates within
            # this sub-cluster vs. the parent's overall mean.
            slot_means = {
                c.replace("slot_", ""): float(sub_members[c].mean())
                for c in df.columns if c.startswith("slot_")
            }
            layer_means = {
                c.replace("layer_", ""): float(sub_members[c].mean())
                for c in df.columns if c.startswith("layer_")
            }
            dom_slots = sorted(slot_means.items(), key=lambda x: -x[1])[:3]
            sub_dict[int(sid)] = {
                "size": int(sub_mask.sum()),
                "silhouette": float(best_sil),
                "dominant_slots": dom_slots,
                "layer_means": layer_means,
                "exemplars": exemplars,
            }
        hierarchy[int(pid)] = sub_dict
    return sub_labels, hierarchy


def cluster_signatures(df: pd.DataFrame, labels: np.ndarray) -> dict[int, dict]:
    """For each cluster: compute mean slot ratios and pick exemplars."""
    df_lbl = df.copy()
    df_lbl["__cluster"] = labels
    out = {}
    for cluster_id in sorted(set(labels.tolist())):
        sub = df_lbl[df_lbl["__cluster"] == cluster_id]
        slot_means = {c.replace("slot_", ""): float(sub[c].mean()) for c in df.columns if c.startswith("slot_")}
        layer_means = {c.replace("layer_", ""): float(sub[c].mean()) for c in df.columns if c.startswith("layer_")}
        # Top-3 dominant slots for naming
        dom_slots = sorted(slot_means.items(), key=lambda x: -x[1])[:3]
        # Pick 5 IBA exemplars if available
        exemplars = list(sub[sub["iba_official"] == True]["name"].head(5))
        if len(exemplars) < 3:
            exemplars = list(sub["name"].head(5))
        out[int(cluster_id)] = {
            "size": int(len(sub)),
            "slot_means": slot_means,
            "layer_means": layer_means,
            "dominant_slots": dom_slots,
            "exemplars": exemplars,
        }
    return out


# ── Main ──────────────────────────────────────────────────────────────


def main():
    print("Loading data...")
    corpus = load_corpus()
    slot_dict = load_slot_dict()
    layer_dict = load_layer_dict()
    eng_dict = load_engineering()
    gnn = load_gnn_taste()
    print(f"  corpus={len(corpus)} slots={len(slot_dict)} layers={len(layer_dict)} eng={len(eng_dict)} gnn={len(gnn)}")

    print("Building features...")
    df = build_features(corpus, slot_dict, layer_dict, eng_dict, gnn)
    X, cols = feature_block_scale(df)
    print(f"  feature matrix: {X.shape}, cols: {len(cols)}")

    # Megacategory anchors (deterministic)
    megacat = []
    for c in corpus:
        slots = {f"slot_{k}": v for k, v in slot_ratios(c, slot_dict).items()}
        megacat.append(megacategory(c, slots))
    df["megacategory"] = megacat
    print(f"  megacategory: sour={megacat.count('sour')} bitter={megacat.count('bitter')} unc={megacat.count('unclassified')}")

    print("Running clustering experiments...")
    results = []
    results.extend(run_kmeans_sweep(X, df))
    results.extend(run_hierarchical_sweep(X, df))

    # Pick winner
    results_sorted = sorted(results, key=lambda r: -r["composite"])
    winner = results_sorted[0]
    print(f"\nWinner: {winner['model']}")
    print(f"  silhouette={winner['silhouette']:.3f}")
    print(f"  near_hit_rate={winner['near_hit_rate']:.3f} ({winner['near_hit_rate']*10:.0f}/10)")
    print(f"  far_hit_rate={winner['far_hit_rate']:.3f}")
    print(f"  composite={winner['composite']:.3f}")

    winner_labels = np.array(winner["labels"])
    sigs = cluster_signatures(df, winner_labels)

    # Sub-clustering: within each top-level cluster, run a 2nd-level
    # K-means and pick sub-K by silhouette (capped at 4).
    print("\nRunning sub-clustering...")
    sub_labels, hierarchy = subcluster(X, winner_labels, df, max_sub_k=4)
    sub_count = sum(len(v) for v in hierarchy.values())
    print(f"  Sub-clusters: {sub_count} across {len(hierarchy)} parents")

    # Tag the "Root" of each top-level cluster: the centroid-nearest
    # IBA-blessed cocktail (or Codex-tagged if no IBA member). Per spec
    # ship-decision question, this gives each family a single canonical
    # narrative anchor — Negroni for the bitter-stirred family, Daiquiri
    # for the sour family, etc. — without forcing the rest of the
    # taxonomy into Codex narrative buckets.
    print("Tagging cluster Roots...")
    is_root = np.zeros(len(df), dtype=bool)
    cluster_roots: dict[int, str] = {}
    canonical_to_codex_id = {c["name_canonical"]: c.get("cocktail_codex_family_id") for c in corpus}
    for pid in sorted(set(winner_labels.tolist())):
        mask = winner_labels == pid
        idxs = np.where(mask)[0]
        centroid = X[mask].mean(axis=0)
        # Score: prefer IBA-blessed, then Codex-tagged, then anything;
        # within tier, take centroid-nearest by Euclidean distance.
        best_idx = None
        best_score = (-1, float("inf"))  # (-tier, distance) — minimize
        for i in idxs:
            row = df.iloc[i]
            tier = 2 if row.iba_official else (1 if canonical_to_codex_id.get(row.canonical) is not None else 0)
            dist = float(np.linalg.norm(X[i] - centroid))
            score = (-tier, dist)
            if score < best_score:
                best_score = score
                best_idx = i
        if best_idx is not None:
            is_root[best_idx] = True
            cluster_roots[int(pid)] = str(df.iloc[best_idx]["name"])
            print(f"  Cluster {pid} Root: {cluster_roots[int(pid)]}")

    # Output cluster assignments
    out = {
        "_meta": {
            "model": winner["model"],
            "k": winner["k"],
            "silhouette": winner["silhouette"],
            "near_hit_rate": winner["near_hit_rate"],
            "far_hit_rate": winner["far_hit_rate"],
            "composite": winner["composite"],
            "feature_dim": X.shape[1],
            "n_cocktails": len(corpus),
            "sub_cluster_total": sub_count,
        },
        "clusters": {
            str(k): {**v, "root_cocktail": cluster_roots.get(k)}
            for k, v in sigs.items()
        },
        "subclusters": {
            str(pid): {str(sid): sdata for sid, sdata in subs.items()}
            for pid, subs in hierarchy.items()
        },
        "cluster_roots": cluster_roots,
        "assignments": [
            {
                "name": row.name,
                "canonical": row.canonical,
                "cluster": int(winner_labels[i]),
                "subcluster": int(sub_labels[i]),
                "hierarchy_id": f"{int(winner_labels[i])}.{int(sub_labels[i])}",
                "is_root": bool(is_root[i]),
                "iba_official": bool(row.iba_official),
                "megacategory": row.megacategory,
                "feature_vector": [round(float(v), 4) for v in X[i]],
            }
            for i, row in enumerate(df.itertuples())
        ],
        "all_models": [
            {k: v for k, v in r.items() if k not in ("labels",)}
            for r in results_sorted
        ],
    }
    # numpy → native types so json.dump doesn't choke on int32/float32
    def to_native(o):
        if isinstance(o, np.integer):
            return int(o)
        if isinstance(o, np.floating):
            return float(o)
        if isinstance(o, np.ndarray):
            return o.tolist()
        if isinstance(o, dict):
            return {k: to_native(v) for k, v in o.items()}
        if isinstance(o, (list, tuple)):
            return [to_native(x) for x in o]
        return o

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    with OUT_CLUSTERS.open("w", encoding="utf-8") as f:
        json.dump(to_native(out), f, indent=2)

    # Report
    lines = []
    lines.append(f"Cocktail v2 Phase 5 — clustering report")
    lines.append(f"Generated: corpus_v3 (n={len(corpus)})")
    lines.append("")
    lines.append("Model leaderboard:")
    lines.append(f"  {'model':<28} {'sil':<7} {'near':<6} {'far':<6} {'comp':<6}")
    for r in results_sorted:
        lines.append(f"  {r['model']:<28} {r['silhouette']:<7.3f} {r['near_hit_rate']:<6.2f} {r['far_hit_rate']:<6.2f} {r['composite']:<6.3f}")
    lines.append("")
    lines.append(f"Winner: {winner['model']} (composite={winner['composite']:.3f})")
    lines.append("")
    lines.append("--- Cluster signatures ---")
    for cid, sig in sigs.items():
        slots_str = ", ".join(f"{k}:{v:.2f}" for k, v in sig["dominant_slots"] if v > 0.05)
        root = cluster_roots.get(int(cid), "—")
        lines.append(f"\nCluster {cid} (n={sig['size']})  Root: {root}")
        lines.append(f"  Dominant slots: {slots_str}")
        lines.append(f"  Layer mix:      top={sig['layer_means']['top']:.2f} mid={sig['layer_means']['middle']:.2f} bass={sig['layer_means']['bass']:.2f}")
        lines.append(f"  Exemplars:      {', '.join(sig['exemplars'])}")
        # Sub-clusters under this parent
        subs = hierarchy.get(int(cid), {})
        for sid, sd in subs.items():
            sub_slots = ", ".join(f"{k}:{v:.2f}" for k, v in sd.get("dominant_slots", []) if v > 0.05)
            lines.append(f"    └─ {cid}.{sid} (n={sd['size']}): {sub_slots}")
            lines.append(f"        Exemplars: {', '.join(sd['exemplars'])}")
    lines.append("")
    lines.append("--- Validation harness ---")
    lines.append(f"Near pairs that landed in DIFFERENT clusters (FAILURES):")
    for a, b, la, lb in winner["near_misses"]:
        lines.append(f"  {a} (cluster {la}) ⊥ {b} (cluster {lb})")
    lines.append("")
    lines.append(f"Far pairs that landed in SAME cluster (FAILURES):")
    for a, b, la, lb in winner["far_misses"]:
        lines.append(f"  {a} (cluster {la}) ⊥ {b} (cluster {lb})")

    with OUT_REPORT.open("w", encoding="utf-8") as f:
        f.write("\n".join(lines))

    print(f"\nWrote {OUT_CLUSTERS}")
    print(f"Wrote {OUT_REPORT}")


if __name__ == "__main__":
    main()
