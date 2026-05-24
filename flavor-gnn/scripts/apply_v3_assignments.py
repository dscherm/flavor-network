"""apply_v3_assignments.py — apply patched-action decisions from the V3 research report.

Reads `flavor-gnn/curation/unassigned_v3_research_report.md`, finds every row with
a `Patched action` column, and dispatches one of:

- **alias → <canonical>**  : append to `v3_alias_map.json.auto_high_confidence`
- **classify → cluster N**  : add to `cluster_labels_v3.json.ingredients` and to
                              `flavor_positions_v3.json` / `flavor_positions_2d_v3.json`
                              at the cluster centroid + small deterministic jitter
- **chem_add**              : write to `flavor-gnn/curation/chem_research_followups.md`
                              for human follow-up; no live state change
- **remove**                : drop from `ingredients.json` + `pairings.json`
                              (uses the same removal logic as apply_removal_review.py)

All write-targets are snapshotted next to themselves as `.pre-v3assign.bak` for
revert/diff. Pass `--dry-run` to preview without writing.

Usage:
    python flavor-gnn/scripts/apply_v3_assignments.py [--dry-run]
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
REPORT = ROOT / "flavor-gnn" / "curation" / "unassigned_v3_research_report.md"

ALIAS_MAP = ROOT / "flavor-gnn" / "curation" / "v3_alias_map.json"
CLUSTER_LABELS = ROOT / "public" / "proDataset" / "cluster_labels_v3.json"
POS_3D = ROOT / "public" / "proDataset" / "flavor_positions_v3.json"
POS_2D = ROOT / "public" / "proDataset" / "flavor_positions_2d_v3.json"
INGREDIENTS = ROOT / "public" / "proDataset" / "ingredients.json"
PAIRINGS = ROOT / "public" / "proDataset" / "pairings.json"
CHEM_FOLLOWUP = ROOT / "flavor-gnn" / "curation" / "chem_research_followups.md"

ROW_RE = re.compile(
    r"^\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*$"
)

ALIAS_RE = re.compile(r"^\*\*alias\s*→\s*(.+?)\*\*$")
CLASSIFY_RE = re.compile(r"^\*\*classify\s*→\s*cluster\s*(\d+)\b.*\*\*$")
CHEM_RE = re.compile(r"^\*\*chem_add\*\*$")
REMOVE_RE = re.compile(r"^\*\*remove\*\*$")


def parse_report() -> list[dict]:
    """Return [{name, patched, raw}, ...] for every research-table row."""
    if not REPORT.exists():
        raise FileNotFoundError(REPORT)
    text = REPORT.read_text(encoding="utf-8")
    rows: list[dict] = []
    skip_headers = {"Name", "------"}
    for line in text.splitlines():
        m = ROW_RE.match(line)
        if not m:
            continue
        name = m.group(1).strip()
        patched = m.group(4).strip()
        if name in skip_headers or "----" in name:
            continue
        rows.append({"name": name, "patched": patched})
    return rows


def classify_row(patched: str) -> tuple[str, str | None]:
    """Return (kind, payload). kind in {alias,classify,chem,remove,unknown}."""
    if (m := ALIAS_RE.match(patched)):
        return "alias", m.group(1).strip()
    if (m := CLASSIFY_RE.match(patched)):
        return "classify", m.group(1).strip()
    if CHEM_RE.match(patched):
        return "chem", None
    if REMOVE_RE.match(patched):
        return "remove", None
    return "unknown", None


def deterministic_jitter(name: str, scale: float = 0.6) -> tuple[float, float, float]:
    """Stable per-name tiny offset so multiple new items don't pile up at the centroid."""
    h = hashlib.sha1(name.encode("utf-8")).digest()
    nums = [(b - 128) / 128.0 for b in h[:6]]  # 6 floats in [-1, 1]
    return (nums[0] * scale, nums[1] * scale, nums[2] * scale)


def snapshot(path: Path) -> Path:
    bak = path.with_suffix(path.suffix + ".pre-v3assign.bak")
    if not bak.exists():
        shutil.copy2(path, bak)
    return bak


def main(dry_run: bool) -> None:
    rows = parse_report()
    print(f"[apply] parsed {len(rows)} rows from report")

    buckets: dict[str, list] = {"alias": [], "classify": [], "chem": [], "remove": [], "unknown": []}
    for r in rows:
        kind, payload = classify_row(r["patched"])
        buckets[kind].append({**r, "payload": payload})

    for kind in ("alias", "classify", "chem", "remove", "unknown"):
        print(f"[apply] {kind}: {len(buckets[kind])}")
    if buckets["unknown"]:
        print("[apply] WARNING — rows with unrecognized patched action:")
        for r in buckets["unknown"]:
            print(f"  - {r['name']!r}: {r['patched']!r}")

    # ── Load live state ───────────────────────────────────────────
    alias_map = json.loads(ALIAS_MAP.read_text(encoding="utf-8"))
    cluster_labels = json.loads(CLUSTER_LABELS.read_text(encoding="utf-8"))
    pos_3d = json.loads(POS_3D.read_text(encoding="utf-8"))
    pos_2d = json.loads(POS_2D.read_text(encoding="utf-8"))
    ingredients = json.loads(INGREDIENTS.read_text(encoding="utf-8"))
    pairings = json.loads(PAIRINGS.read_text(encoding="utf-8"))

    v3_names = set(cluster_labels["ingredients"].keys())

    # ── ALIAS ─────────────────────────────────────────────────────
    auto_hc = alias_map.setdefault("auto_high_confidence", {})
    if not isinstance(auto_hc, dict):
        raise SystemExit("auto_high_confidence is not a dict; aborting")
    alias_added: list[tuple[str, str]] = []
    alias_skipped_missing_target: list[tuple[str, str]] = []
    for r in buckets["alias"]:
        name, target = r["name"], r["payload"]
        if target not in v3_names:
            alias_skipped_missing_target.append((name, target))
            continue
        if name in auto_hc:
            continue
        auto_hc[name] = target
        alias_added.append((name, target))
    print(f"[alias] {len(alias_added)} added; {len(alias_skipped_missing_target)} skipped (target not in V3)")
    for n, t in alias_skipped_missing_target:
        print(f"  SKIP {n!r} → {t!r}")

    # ── CLASSIFY ──────────────────────────────────────────────────
    centroids_3d = {c["id"]: c["centroid_3d"] for c in cluster_labels["clusters"]}
    # derive 2D centroids from existing per-cluster member positions
    by_cluster_2d: dict[int, list[list[float]]] = {}
    for n, cid in cluster_labels["ingredients"].items():
        if n in pos_2d:
            by_cluster_2d.setdefault(cid, []).append(pos_2d[n])
    centroids_2d: dict[int, list[float]] = {}
    for cid, pts in by_cluster_2d.items():
        if not pts:
            centroids_2d[cid] = [0.0, 0.0]
            continue
        xs = [p[0] for p in pts]
        ys = [p[1] for p in pts]
        centroids_2d[cid] = [sum(xs) / len(xs), sum(ys) / len(ys)]

    classify_added: list[tuple[str, int]] = []
    for r in buckets["classify"]:
        name = r["name"]
        cid = int(r["payload"])
        if name in v3_names:
            continue
        if cid not in centroids_3d:
            print(f"[classify] WARNING: cluster {cid} for {name!r} has no centroid; skipping")
            continue
        cx, cy, cz = centroids_3d[cid]
        jx, jy, jz = deterministic_jitter(name)
        c2x, c2y = centroids_2d[cid]
        # 2D jitter at the same scale (scaled by 2D feature spread ~ 0.6 looks fine)
        j2x, j2y = jx, jy
        cluster_labels["ingredients"][name] = cid
        pos_3d[name] = [round(cx + jx, 4), round(cy + jy, 4), round(cz + jz, 4)]
        pos_2d[name] = [round(c2x + j2x, 4), round(c2y + j2y, 4)]
        classify_added.append((name, cid))
    print(f"[classify] {len(classify_added)} added to cluster_labels_v3 + flavor_positions_v3 (3D+2D)")
    # bump cluster sizes
    for c in cluster_labels["clusters"]:
        c["size"] = sum(1 for v in cluster_labels["ingredients"].values() if v == c["id"])

    # ── CHEM_ADD ──────────────────────────────────────────────────
    chem_lines = [
        "# Chemistry Research Follow-ups",
        "",
        "These ingredients were flagged by the V3 research pass as worth dedicated",
        "compound-data lookup (PubChem / FlavorDB) before adding them to",
        "`compounds.parquet` and re-running the V3 pipeline. Each has a distinctive",
        "single-compound signature that's lost to alias/classify shortcuts.",
        "",
        "| Name | Signature compounds | Where to look | Notes |",
        "|------|---------------------|---------------|-------|",
    ]
    chem_notes = {
        "musk mallow": ("ambrettolide (macrocyclic musk), farnesol", "PubChem CID 5281882", "Ambrette seed; perfumery / bitters"),
        "sarsaparilla": ("sarsapogenin, methyl salicylate", "PubChem CID 99474", "Smilax root; root-beer base"),
        "wormwood": ("thujone (α and β), absinthin", "PubChem CID 442728", "Artemisia absinthium; basis of absinthe / vermouth"),
        "yarrow": ("chamazulene, sabinene, camphor", "PubChem CID 442345", "Achillea millefolium; bitters / gruit"),
    }
    chem_count = 0
    for r in buckets["chem"]:
        n = r["name"]
        sig, where, notes = chem_notes.get(n, ("?", "?", ""))
        chem_lines.append(f"| {n} | {sig} | {where} | {notes} |")
        chem_count += 1
    print(f"[chem] {chem_count} entries staged for {CHEM_FOLLOWUP.name}")

    # ── REMOVE ────────────────────────────────────────────────────
    remove_names = {r["name"] for r in buckets["remove"]}
    removed_ing = 0
    removed_pairs = 0
    if remove_names:
        before_ing = sum(1 for k in ingredients if not k.startswith("_"))
        new_ing = {k: v for k, v in ingredients.items() if k.startswith("_") or k not in remove_names}
        removed_ing = before_ing - sum(1 for k in new_ing if not k.startswith("_"))
        if isinstance(pairings, list):
            before_pairs = len(pairings)
            new_pairs = [
                p for p in pairings
                if (p.get("source") or p.get("ingredientA") or p.get("a")) not in remove_names
                and (p.get("target") or p.get("ingredientB") or p.get("b")) not in remove_names
            ]
            removed_pairs = before_pairs - len(new_pairs)
        elif isinstance(pairings, dict) and "edges" in pairings:
            before_pairs = len(pairings["edges"])
            pairings["edges"] = [
                p for p in pairings["edges"]
                if (p.get("source") or p.get("ingredientA")) not in remove_names
                and (p.get("target") or p.get("ingredientB")) not in remove_names
            ]
            removed_pairs = before_pairs - len(pairings["edges"])
            new_pairs = pairings
        else:
            new_pairs = pairings
    else:
        new_ing, new_pairs = ingredients, pairings
    print(f"[remove] {len(remove_names)} ingredient(s) → {removed_ing} dropped, {removed_pairs} edges dropped")

    # ── Dry-run gate ──────────────────────────────────────────────
    if dry_run:
        print("\n[dry-run] no files written")
        return

    # ── Write ─────────────────────────────────────────────────────
    snapshot(ALIAS_MAP)
    ALIAS_MAP.write_text(json.dumps(alias_map, indent=2), encoding="utf-8")
    print(f"[write] {ALIAS_MAP.relative_to(ROOT)} (+{len(alias_added)} aliases)")

    snapshot(CLUSTER_LABELS)
    CLUSTER_LABELS.write_text(json.dumps(cluster_labels, separators=(",", ":")), encoding="utf-8")
    print(f"[write] {CLUSTER_LABELS.relative_to(ROOT)} (+{len(classify_added)} ingredients)")

    snapshot(POS_3D)
    POS_3D.write_text(json.dumps(pos_3d, separators=(",", ":")), encoding="utf-8")
    print(f"[write] {POS_3D.relative_to(ROOT)} (+{len(classify_added)} entries)")

    snapshot(POS_2D)
    POS_2D.write_text(json.dumps(pos_2d, separators=(",", ":")), encoding="utf-8")
    print(f"[write] {POS_2D.relative_to(ROOT)} (+{len(classify_added)} entries)")

    if chem_count:
        # Only write the template stub if no existing doc — preserves any
        # hand-expanded version (signature compounds, SMILES, etc.) the
        # chef has invested in. If the file exists and is larger than the
        # template, leave it alone.
        existing_len = CHEM_FOLLOWUP.stat().st_size if CHEM_FOLLOWUP.exists() else 0
        template_len = sum(len(line) + 1 for line in chem_lines)
        if existing_len <= template_len + 100:
            CHEM_FOLLOWUP.write_text("\n".join(chem_lines) + "\n", encoding="utf-8")
            print(f"[write] {CHEM_FOLLOWUP.relative_to(ROOT)} ({chem_count} entries — stub)")
        else:
            print(f"[skip] {CHEM_FOLLOWUP.relative_to(ROOT)} ({existing_len}B existing > template; preserved)")

    if remove_names:
        snapshot(INGREDIENTS)
        INGREDIENTS.write_text(json.dumps(new_ing, indent=2), encoding="utf-8")
        snapshot(PAIRINGS)
        PAIRINGS.write_text(json.dumps(new_pairs), encoding="utf-8")
        print(f"[write] {INGREDIENTS.relative_to(ROOT)} (-{removed_ing} ingredients)")
        print(f"[write] {PAIRINGS.relative_to(ROOT)} (-{removed_pairs} edges)")

    print("\n[apply] done")


if __name__ == "__main__":
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--dry-run", action="store_true", help="Print summary without writing")
    args = p.parse_args()
    main(dry_run=args.dry_run)
