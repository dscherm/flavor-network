"""Flavor-space layout v2: spread overlapping nodes + emit cluster labels.

Improvements over flavor_layout_prototype.py:
  1. UMAP min_dist bumped 0.1 → 0.45 so variant ingredients (94 chicken
     variants, 299 potato variants) spread visibly instead of stacking
     at near-identical points.
  2. Deterministic per-name jitter applied AFTER UMAP, so identical-
     vector siblings (e.g. shitake mushroom + shiitake mushroom +
     shiitake mushroom cap, which all share the same GNN prediction)
     get distinct visible positions. Jitter is stable across reloads
     (hashed from name).
  3. Runs k-means on the 3D positions and writes flavor_cluster_labels.json
     with auto-labels per cluster, so the renderer can drop floating
     labels into flavor space.

Outputs:
  - public/proDataset/flavor_positions.json
  - public/proDataset/flavor_cluster_labels.json

Run: .venv/Scripts/python.exe scripts/flavor_layout_v2.py [k]
"""
import json
import math
import re
from collections import Counter
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[2]
ENTROPY = ROOT / "public" / "proDataset" / "gnn_entropy.json"
INGREDIENTS = ROOT / "public" / "proDataset" / "ingredients.json"
COMPOUND_FOODS_JSON = ROOT / "public" / "proDataset" / "compound_foods.json"
GNN_COMPOUNDS = ROOT / "public" / "proDataset" / "gnn_compounds.json"
OUT_POS = ROOT / "public" / "proDataset" / "flavor_positions.json"
OUT_CL = ROOT / "public" / "proDataset" / "flavor_cluster_labels.json"

TASTE_AXES = ["sweet", "bitter", "umami", "salty", "sour"]
ODOR_AXES = [
    "odor_fruity", "odor_floral", "odor_green",
    "odor_woody", "odor_spicy", "odor_fatty",
]
ALL_AXES = TASTE_AXES + ODOR_AXES

# Hashed-jitter magnitude in UMAP coordinate frame. The UMAP output
# with min_dist=0.45 spans roughly ±15 per axis. Bumping this from 1.5
# → 3.5 makes variant siblings (chicken variants, potato variants)
# visually distinct without merging adjacent cluster pockets — a
# typical cluster radius is 5-7 units, so 3.5 stays under that.
JITTER_MAGNITUDE = 3.5


def _hash_name(name: str) -> int:
    # FNV-1a-ish, mirrors the JS hash used elsewhere in this repo.
    h = 2166136261
    for c in name:
        h ^= ord(c)
        h = (h * 16777619) & 0xFFFFFFFF
    return h


def _jitter_for(name: str):
    h = _hash_name(name)
    u = ((h >> 0) & 0xFFFF) / 0xFFFF
    v = ((h >> 16) & 0xFFFF) / 0xFFFF
    w = (h >> 8) & 0xFFFF
    w = w / 0xFFFF
    theta = u * 2 * math.pi
    phi = math.acos(2 * v - 1)
    r = JITTER_MAGNITUDE * (w ** (1 / 3))
    return (
        r * math.sin(phi) * math.cos(theta),
        r * math.sin(phi) * math.sin(theta),
        r * math.cos(phi),
    )


def _synthesize_compound_vector(compound_name, compound_foods, substitutes,
                                base_vectors):
    """Resolve a compound food's 11-dim feature vector via weighted mean
    of its constituent vectors. Returns (vector, coverage) or None if
    coverage < 50% of declared constituent weight.

    Mirrors the runtime synthesizeCompoundProfile() logic in
    src/data/compoundFoods.js — same coverage gate, same substitute
    lookup, same weighted mean — so positions computed offline here
    match what the UI sees from applyCompoundSynthesis at runtime.
    """
    visited = set()

    def resolve(name, weight):
        if name in visited:
            return None
        entry = compound_foods.get(name)
        if entry and entry.get("aliasOf"):
            return resolve(entry["aliasOf"], weight)
        return name

    entry = compound_foods.get(compound_name)
    if entry is None or entry.get("aliasOf"):
        return None
    consts = entry.get("constituents") or {}
    total_w = sum(consts.values())
    if total_w <= 0:
        return None

    avail_w = 0.0
    sum_vec = np.zeros(len(ALL_AXES))
    for c_name, weight in consts.items():
        lookup = substitutes.get(c_name, c_name)
        # If the constituent is itself a compound food, resolve via alias
        # chain (handles tamari → soy sauce → constituents).
        alias_entry = compound_foods.get(lookup)
        if alias_entry and alias_entry.get("aliasOf"):
            lookup = alias_entry["aliasOf"]
        vec = base_vectors.get(lookup)
        if vec is None:
            continue
        avail_w += weight
        sum_vec += np.array(vec) * weight

    if avail_w / total_w < 0.5:
        return None
    return sum_vec / avail_w, avail_w / total_w


def build_features():
    """Build the per-ingredient flavor feature matrix.

    Source priority per ingredient:
      1. forceCompound compound foods → synthesized vector (overrides GNN)
      2. Direct GNN prediction from gnn_entropy.json
      3. Gap-filling compound foods (no GNN entry, has constituent breakdown)

    This mirrors the runtime applyCompoundSynthesis logic in
    src/data/compoundFoods.js so offline positions match what the UI
    would synthesize. Without this, compound foods like mayonnaise /
    pesto / sriracha sit at recipe-coocc fallback in flavor3D, and
    the umami pantry (soy sauce / miso / fish sauce / oyster sauce /
    worcestershire) sits at near-identical garbage GNN positions.
    """
    entropy = json.loads(ENTROPY.read_text(encoding="utf-8"))

    # Pass 1: collect direct GNN vectors (the "base" each compound food
    # will synthesize against).
    base_vectors = {}
    for name, data in entropy.items():
        probs = (data or {}).get("probs")
        if not probs:
            continue
        base_vectors[name] = [probs.get(ax, 0.0) for ax in ALL_AXES]

    # Load compound-food synthesis table (extracted from compoundFoods.js).
    compound_payload = json.loads(COMPOUND_FOODS_JSON.read_text(encoding="utf-8"))
    compound_foods = compound_payload.get("compound_foods", {})
    substitutes = compound_payload.get("substitutes", {})

    # Pass 2: synthesize compound foods. forceCompound entries overwrite
    # the base vector; non-forceCompound entries only fill gaps where
    # no GNN base exists.
    synthesized = 0
    overridden = 0
    for cname, entry in compound_foods.items():
        if entry.get("aliasOf"):
            # Aliases resolve at write-out so each canonical entry's
            # position is reused by its aliases.
            continue
        force = bool(entry.get("forceCompound"))
        if cname in base_vectors and not force:
            continue
        result = _synthesize_compound_vector(cname, compound_foods, substitutes, base_vectors)
        if result is None:
            continue
        vec, _coverage = result
        if cname in base_vectors:
            overridden += 1
        else:
            synthesized += 1
        base_vectors[cname] = vec.tolist()

    # Pass 3: build feature matrix in deterministic name order
    names = sorted(base_vectors.keys())
    features = np.array([base_vectors[n] for n in names])
    print(f"[v2] synthesized {synthesized} new compound foods, "
          f"overrode {overridden} bad-GNN compound foods")
    return names, features


# Simple stop words; we want lasting descriptive tokens, not generic ones.
_STOP_WORDS = frozenset({
    "the", "and", "of", "with", "in", "a", "an",
    "fresh", "freshly", "dry", "dried", "raw", "cooked", "whole", "half",
    "halved", "ground", "grnd", "powdered", "powder", "extract", "essence",
    "concentrate", "flavored", "flavor", "flavoring", "flavour",
    "low", "fat", "skim", "lean", "thin", "thick",
    "red", "green", "yellow", "white", "black", "brown", "pink",
    "large", "small", "medium", "baby",
    "frozen", "canned", "tinned", "instant", "natural",
    "italian", "asian", "chinese", "indian", "mexican", "american",
    "thai", "japanese", "korean", "french", "spanish", "greek",
    "leaf", "leave", "leaves",
    "juice", "juiced", "rind", "zest", "peel",
    "cup", "tablespoon", "teaspoon", "ounce", "pound", "gram",
})


def _root_tokens(name: str):
    tokens = re.findall(r"[a-z]+", name.lower())
    return [t for t in tokens if t not in _STOP_WORDS and len(t) > 2]


def _build_descriptor_profile(gnn_compounds):
    """For each ingredient, aggregate FlavorDB-style descriptor tags
    across its top compounds (from gnn_compounds.json). These tags are
    Level-2/3 in the SCAA-style flavor wheel (minty, peppermint, menthol,
    camphor; coconut, waxy, fat; balsamic, gasoline, floral; musty,
    coffee, cocoa; etc.) — richer than our 6 GNN aroma axes and already
    aggregated per ingredient.

    Returns (per_ingredient_tags, global_tag_share) where
    per_ingredient_tags[name] = Counter of tag → count from top compounds.
    """
    per_ingredient_tags = {}
    global_tag_total = Counter()
    n_with_tags = 0
    for name, info in gnn_compounds.items():
        if name.startswith("_"):
            continue
        top = (info or {}).get("top_compounds") or []
        tags = Counter()
        for cmpd in top:
            for tag in (cmpd.get("tags") or []):
                t = tag.strip().lower()
                if t:
                    tags[t] += 1
        if tags:
            per_ingredient_tags[name] = tags
            for tag, c in tags.items():
                global_tag_total[tag] += 1  # presence per ingredient, not raw count
            n_with_tags += 1
    global_tag_share = {t: c / max(n_with_tags, 1) for t, c in global_tag_total.items()}
    return per_ingredient_tags, global_tag_share


# Stop list — tags that are too generic, too chemical-sounding, or
# too narrow to anchor a flavor label. Descriptor tags come from FlavorDB
# compound chemistry which mixes consumer-facing notes ("minty", "coconut")
# with chemical-class notes ("hop_oil", "terpentine"). The latter aren't
# wrong but they read poorly as cluster labels.
_GENERIC_DESCRIPTORS = frozenset({
    # Too generic
    "odorless", "weak", "mild", "strong", "sharp", "fresh", "soft", "deep",
    "dry", "wet", "cooked", "raw", "warm", "cool", "dusty", "dust", "gas",
    "ethereal", "alcoholic", "medical", "balsamic", "n",
    # Too chemical
    "terpentine", "turpentine", "hop_oil", "hop oil", "tutti frutti",
    "tutti_frutti", "ester", "ether", "ketone", "aldehyde",
    "diacetyl", "lactone", "phenol", "indole", "skatole",
    "mediumal", "rubbery", "dirty",
    # Too narrow / quirky
    "gasoline", "mustard", "menthol",  # menthol triggers on many fruits via terpenes
})


def _clean_descriptor(tag: str) -> str:
    """Normalize a FlavorDB descriptor for display. 'hop_oil' → 'Hop Oil'."""
    return re.sub(r"[_\s]+", " ", tag).strip().title()


def _compute_global_baselines(names, ingredients, entropy):
    """Global taste-share + aroma-mean across all GNN-covered ingredients.

    The per-cluster labeler uses LIFT (cluster_share / global_share) so it
    surfaces the *distinctive* taste/aroma rather than just the most
    common one. Sweet is the most common curated taste tag everywhere —
    using share alone makes every cluster say "Sweet". Using lift makes
    "Sour" win where sour is unusually concentrated, "Pungent" where
    pungent is, "Woody" where woody aroma lifts above baseline, etc.
    """
    taste_total = Counter()
    n_taste = 0
    aroma_sum = {a.replace("odor_", ""): 0.0 for a in ODOR_AXES}
    n_aroma = 0
    for name in names:
        node = ingredients.get(name) or {}
        taste_str = (node.get("taste") or "").lower()
        if taste_str:
            n_taste += 1
            for t in re.split(r"[,\s]+", taste_str):
                t = t.strip()
                if t:
                    taste_total[t] += 1
        probs = (entropy.get(name) or {}).get("probs")
        if probs:
            n_aroma += 1
            for a in ODOR_AXES:
                aroma_sum[a.replace("odor_", "")] += probs.get(a, 0.0)
    taste_share = {t: c / max(n_taste, 1) for t, c in taste_total.items()}
    aroma_mean = {k: v / max(n_aroma, 1) for k, v in aroma_sum.items()}
    return taste_share, aroma_mean


def auto_label_flavor_cluster(sorted_members, ingredients, entropy,
                              global_taste_share, global_aroma_mean,
                              per_ingredient_tags=None,
                              global_tag_share=None):
    """Label a cluster from its 25 centroid-closest members using LIFT
    against global baselines so non-sweet tastes and aroma signal can
    win the label.

    Output format: "<Taste-lift> <Aroma-lift> <Anchor>" where each piece
    only appears if it's discriminating. Pieces drop out when below
    lift threshold:
      - Taste: cluster_share / global_share ≥ 1.3 AND cluster_share ≥ 15%
      - Aroma: cluster_mean / global_mean ≥ 1.4 AND cluster_mean ≥ 5%
      - Anchor: category at ≥40% support, else top non-stopword token,
        else nearest ingredient name
    """
    TOP_N = 25
    closest = sorted_members[:TOP_N]

    tastes = Counter()
    aromas_sum = {a.replace("odor_", ""): 0.0 for a in ODOR_AXES}
    aroma_n = 0
    cats = Counter()
    tokens = Counter()
    descriptors = Counter()
    descriptor_n = 0

    for name in closest:
        node = ingredients.get(name) or {}
        for t in re.split(r"[,\s]+", (node.get("taste") or "").lower()):
            t = t.strip()
            if t:
                tastes[t] += 1
        cat = (node.get("category") or "").lower().strip()
        if cat and cat != "other":
            cats[cat] += 1
        for tok in _root_tokens(name):
            tokens[tok] += 1
        probs = (entropy.get(name) or {}).get("probs")
        if probs:
            aroma_n += 1
            for a in ODOR_AXES:
                aromas_sum[a.replace("odor_", "")] += probs.get(a, 0.0)
        # FlavorDB descriptor tags from this ingredient's top compounds
        if per_ingredient_tags is not None:
            ing_tags = per_ingredient_tags.get(name)
            if ing_tags:
                descriptor_n += 1
                # Record presence (not raw count) so a single ingredient with
                # 5 "minty" tag instances doesn't dominate the cluster score
                for tag in ing_tags:
                    descriptors[tag] += 1

    # Taste lift
    taste_word = ""
    taste_candidates = []
    for t, c in tastes.items():
        share = c / TOP_N
        if share < 0.15:
            continue
        gshare = global_taste_share.get(t, 0.01)
        if gshare < 0.001:
            continue
        lift = share / gshare
        if lift >= 1.3:
            taste_candidates.append((t, lift, share))
    if taste_candidates:
        taste_candidates.sort(key=lambda x: x[1], reverse=True)
        taste_word = taste_candidates[0][0].title()

    # Aroma lift
    aroma_word = ""
    if aroma_n > 0:
        aroma_candidates = []
        for a, total in aromas_sum.items():
            cmean = total / aroma_n
            if cmean < 0.05:
                continue
            gmean = global_aroma_mean.get(a, 0.01)
            if gmean < 0.001:
                continue
            lift = cmean / gmean
            if lift >= 1.4:
                aroma_candidates.append((a, lift, cmean))
        if aroma_candidates:
            aroma_candidates.sort(key=lambda x: x[1], reverse=True)
            aroma_word = aroma_candidates[0][0].title()

    # Descriptor (Level-2/3 FlavorDB tag) — preferred anchor because
    # it carries actual flavor meaning (minty / coconut / cocoa) rather
    # than just naming the ingredient family. Strict thresholds: tag
    # must appear in ≥30% of the closest 25 members AND show ≥2× lift
    # vs global. Underscored multi-word tags are normalized for display.
    descriptor_word = ""
    if descriptor_n > 0 and global_tag_share:
        desc_candidates = []
        for tag, count in descriptors.items():
            if tag in _GENERIC_DESCRIPTORS:
                continue
            share = count / descriptor_n
            if share < 0.30:
                continue
            gshare = global_tag_share.get(tag, 0.001)
            if gshare < 0.001:
                continue
            lift = share / gshare
            if lift >= 2.0:
                desc_candidates.append((tag, lift, share))
        if desc_candidates:
            desc_candidates.sort(key=lambda x: x[1], reverse=True)
            descriptor_word = _clean_descriptor(desc_candidates[0][0])

    # Anchor priority: category (≥40% support) > top token > descriptor
    # > first-name-token. Descriptors are kept as a tertiary anchor only
    # because they surface real chemistry but often pick up trace notes
    # that contradict the cluster's identity (e.g. "mint" winning on an
    # aged-cheese cluster because cheese rinds contain menthone). The
    # higher-confidence signals must fail first before descriptors fire.
    anchor = ""
    top_cat = cats.most_common(1)
    if top_cat and top_cat[0][1] / TOP_N >= 0.4:
        anchor = top_cat[0][0].title()
    else:
        top_tok = tokens.most_common(1)
        if top_tok and top_tok[0][1] >= max(3, TOP_N // 5):
            anchor = top_tok[0][0].title()
    if not anchor and descriptor_word:
        anchor = descriptor_word
    if not anchor:
        # Last resort: the first significant root token of the closest
        # ingredient name. Using the full name produces 4-word anchors
        # like "Lime Juice Freshly Squeezed" when the closest member is
        # a multi-word variant.
        first_name = closest[0] if closest else "Mix"
        first_tokens = _root_tokens(first_name)
        anchor = (first_tokens[0] if first_tokens else first_name).title()

    parts = []
    if taste_word:
        parts.append(taste_word)
    if aroma_word and aroma_word.lower() != (taste_word or "").lower():
        parts.append(aroma_word)
    if anchor.lower() not in " ".join(p.lower() for p in parts):
        parts.append(anchor)

    return " ".join(parts) if parts else "Flavor Mix"


def main(k: int = 12):
    import umap
    from sklearn.cluster import KMeans

    names, X = build_features()
    ingredients = json.loads(INGREDIENTS.read_text(encoding="utf-8"))
    entropy = json.loads(ENTROPY.read_text(encoding="utf-8"))
    gnn_compounds = json.loads(GNN_COMPOUNDS.read_text(encoding="utf-8"))
    print(f"[v2] features {X.shape} | k={k}")

    global_taste_share, global_aroma_mean = _compute_global_baselines(
        names, ingredients, entropy,
    )
    per_ingredient_tags, global_tag_share = _build_descriptor_profile(gnn_compounds)
    print(f"[v2] descriptor profile: {len(per_ingredient_tags)} ingredients have FlavorDB tags, "
          f"{len(global_tag_share)} unique tags across the corpus")
    print("[v2] global taste baseline:", {t: f"{v*100:.0f}%" for t, v in sorted(
        global_taste_share.items(), key=lambda kv: -kv[1])[:6]})
    print("[v2] global aroma baseline:", {a: f"{v*100:.1f}%" for a, v in sorted(
        global_aroma_mean.items(), key=lambda kv: -kv[1])})

    # z-score so no axis dominates
    mean = X.mean(axis=0)
    std = X.std(axis=0)
    Xn = (X - mean) / (std + 1e-8)

    print("[v2] UMAP → 3D (min_dist=0.45 for spread)...")
    reducer = umap.UMAP(
        n_components=3,
        n_neighbors=20,
        min_dist=0.45,
        metric="cosine",
        random_state=42,
    )
    pos = reducer.fit_transform(Xn).astype(float)

    # Per-name jitter for variant separation
    for i, name in enumerate(names):
        jx, jy, jz = _jitter_for(name)
        pos[i, 0] += jx
        pos[i, 1] += jy
        pos[i, 2] += jz

    print(f"[v2] projected + jittered: x={pos[:,0].min():.2f}..{pos[:,0].max():.2f} "
          f"y={pos[:,1].min():.2f}..{pos[:,1].max():.2f} "
          f"z={pos[:,2].min():.2f}..{pos[:,2].max():.2f}")

    # Write positions, including alias mirrors so tamari/shoyu/etc. land
    # at their canonical entry's position rather than recipe-coocc fallback.
    out_pos = {name: [float(pos[i,0]), float(pos[i,1]), float(pos[i,2])]
               for i, name in enumerate(names)}
    compound_payload = json.loads(COMPOUND_FOODS_JSON.read_text(encoding="utf-8"))
    compound_foods = compound_payload.get("compound_foods", {})
    alias_mirrored = 0
    for alias_name, entry in compound_foods.items():
        target = entry.get("aliasOf")
        if not target:
            continue
        # Follow alias chain to canonical
        seen = {alias_name}
        while target in compound_foods and compound_foods[target].get("aliasOf"):
            if target in seen:
                target = None
                break
            seen.add(target)
            target = compound_foods[target]["aliasOf"]
        if target and target in out_pos:
            out_pos[alias_name] = list(out_pos[target])
            alias_mirrored += 1
    OUT_POS.write_text(json.dumps(out_pos), encoding="utf-8")
    print(f"[v2] wrote {OUT_POS.name} ({len(out_pos)} ingredients, "
          f"{alias_mirrored} alias mirrors)")

    # K-means on 3D positions → cluster labels
    km = KMeans(n_clusters=k, random_state=42, n_init=10)
    labels = km.fit_predict(pos)

    clusters = []
    ingredient_clusters = {}
    for cid in range(k):
        mask = labels == cid
        member_idx = np.where(mask)[0]
        if len(member_idx) == 0:
            continue
        member_names = [names[i] for i in member_idx]

        # Top ingredients by closeness to centroid
        centroid = km.cluster_centers_[cid]
        dists = np.linalg.norm(pos[mask] - centroid, axis=1)
        order = dists.argsort()
        sorted_members = [member_names[i] for i in order]

        label = auto_label_flavor_cluster(
            sorted_members, ingredients, entropy,
            global_taste_share, global_aroma_mean,
            per_ingredient_tags=per_ingredient_tags,
            global_tag_share=global_tag_share,
        )

        clusters.append({
            "id": cid,
            "label": label,
            "size": int(len(member_idx)),
            "centroid_3d": [float(centroid[0]), float(centroid[1]), float(centroid[2])],
            "top_ingredients": sorted_members[:8],
        })
        for n in member_names:
            ingredient_clusters[n] = {
                "cluster_id": int(cid),
                "cluster_label": label,
            }

    OUT_CL.write_text(json.dumps({
        "clusters": clusters,
        "ingredient_clusters": ingredient_clusters,
        "_meta": {
            "source": "flavor-umap-kmeans",
            "k": int(k),
            "n_ingredients": int(len(names)),
            "umap_params": {"n_neighbors": 20, "min_dist": 0.45, "metric": "cosine"},
        },
    }), encoding="utf-8")
    print(f"[v2] wrote {OUT_CL.name} ({len(clusters)} clusters)")

    # Report
    for c in clusters:
        print(f"  c{c['id']:>2} n={c['size']:>4}  {c['label']:30s} top: {', '.join(c['top_ingredients'][:5])}")


if __name__ == "__main__":
    import sys
    k = int(sys.argv[1]) if len(sys.argv) > 1 else 12
    main(k)
