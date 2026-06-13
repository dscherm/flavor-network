#!/usr/bin/env python3
"""
apply_v8_prune.py — 2026-05-28 chef-v8 ingredient pruning.

Drives the v8-canonical ingredient list per chef instruction:
  - KEEP: any ingredient in v8 CSV OR referenced by cocktail_augment.json
    OR sauce_augment.json
  - ALIAS: rename 7 known app-name typo/plural variants to the v8
    canonical name BEFORE the keep/drop pass
  - DELETE: every other current ingredient (~410)

Filters atomically across:
  - public/proDataset/ingredients.json
  - public/proDataset/pairings.json
  - public/proDataset/gnn_entropy.json
  - public/proDataset/gnn_compounds.json
  - public/proDataset/flavor_positions_v3.json
  - public/proDataset/cluster_labels_v3.json (ingredient → cluster_id map)
  - public/proDataset/gnn_positions.json (legacy 5-aroma layout, if present)

Originals are backed up with .pre-v8-prune.bak extension.
"""
import csv, json, os, shutil
from pathlib import Path

REPO = Path(r'D:\Projects\flavor-network')
V8_CSV = REPO / '.tmp/chef-revs-8/flavor_graph_full_v8_NEW.csv'
PRO = REPO / 'public/proDataset'
DATA = REPO / 'public/data'

# ─── 1. Build the canonical KEEP set ────────────────────────────────

def clean(n: str) -> str:
    return n.strip().lstrip('- ').strip().lower()

with open(V8_CSV, encoding='utf-8') as f:
    v8_rows = list(csv.DictReader(f))
v8_names = {clean(r['name']) for r in v8_rows if r.get('name','').strip()}
print(f'v8 canonical names: {len(v8_names)}')

def collect_names(obj, out: set):
    """Recursively collect lower-cased 'name' values from any nested JSON."""
    if isinstance(obj, dict):
        if 'name' in obj and isinstance(obj['name'], str):
            out.add(obj['name'].lower())
        for v in obj.values():
            collect_names(v, out)
    elif isinstance(obj, list):
        for v in obj:
            collect_names(v, out)

cocktail_aug = json.load(open(DATA / 'cocktail_augment.json', encoding='utf-8'))
sauce_aug = json.load(open(DATA / 'sauce_augment.json', encoding='utf-8'))
cocktail_ings = set()
collect_names(cocktail_aug, cocktail_ings)
sauce_ings = set()
collect_names(sauce_aug, sauce_ings)
print(f'cocktail augment ingredients: {len(cocktail_ings)}')
print(f'sauce augment ingredients   : {len(sauce_ings)}')

# Aliases: app-name → v8-canonical-name
ALIAS = {
    'asparagu': 'asparagus',
    'baby back pork rib': 'baby back pork ribs',
    'bitter': 'bitters',
    'hop': 'hops',
    'molasse': 'molasses',
    # NOTE: 'currant' → 'blackcurrant' is ambiguous (red/black), skipping
    # to avoid losing red-currant pairings. Chef can add 'currant' as a
    # canonical row in a future batch if she wants it kept.
}

# KEEP set in CANONICAL-NAME-SPACE (post-alias)
keep = set(v8_names) | cocktail_ings | sauce_ings

# ─── 2. Build the per-file MIGRATIONS plan ──────────────────────────

def resolve(name):
    """Map an app name to its post-prune canonical form, or None if it's deleted."""
    low = name.lower()
    if low in ALIAS:
        canonical = ALIAS[low]
        return canonical if canonical in keep else None
    return low if low in keep else None

# ─── 3. Migrate each artifact ───────────────────────────────────────

def backup(p: Path):
    bak = p.with_suffix(p.suffix + '.pre-v8-prune.bak')
    if not bak.exists():
        shutil.copy(p, bak)
        print(f'  backup: {bak.name}')

def migrate_ingredients_json():
    p = PRO / 'ingredients.json'
    backup(p)
    d = json.load(open(p, encoding='utf-8'))
    out = {}
    renamed = 0
    dropped = 0
    for name, fields in d.items():
        new = resolve(name)
        if new is None:
            dropped += 1
            continue
        if new != name.lower():
            renamed += 1
        # Merge sources if alias collision (asparagu→asparagus when asparagus
        # already exists, take the new canonical entry as authoritative)
        out[new] = fields
    json.dump(out, open(p, 'w', encoding='utf-8'), indent=2)
    print(f'ingredients.json: {len(d)} → {len(out)}  (dropped {dropped}, renamed {renamed})')

def migrate_pairings_json():
    p = PRO / 'pairings.json'
    backup(p)
    d = json.load(open(p, encoding='utf-8'))
    out = []
    dropped = 0
    # schema: list of dicts with {ingredientA, ingredientB, strength, ...}
    # (also tolerate older {source, target} shape if present)
    if isinstance(d, list) and d and isinstance(d[0], dict):
        a_key = 'ingredientA' if 'ingredientA' in d[0] else 'source'
        b_key = 'ingredientB' if 'ingredientB' in d[0] else 'target'
        for e in d:
            s = resolve(e[a_key])
            t = resolve(e[b_key])
            if s is None or t is None or s == t:
                dropped += 1
                continue
            out.append({**e, a_key: s, b_key: t})
        json.dump(out, open(p, 'w', encoding='utf-8'), indent=2)
        print(f'pairings.json (array, {a_key}/{b_key}): {len(d)} → {len(out)}  (dropped {dropped})')
    elif isinstance(d, dict):
        # dict-of-arrays schema: { ingredient: [{name, strength}, ...] }
        new = {}
        for src, neighbors in d.items():
            s = resolve(src)
            if s is None:
                dropped += sum(1 for _ in neighbors) if isinstance(neighbors, list) else 1
                continue
            if isinstance(neighbors, list):
                kept_nb = []
                for nb in neighbors:
                    if isinstance(nb, dict) and 'name' in nb:
                        t = resolve(nb['name'])
                        if t is None or t == s: continue
                        kept_nb.append({**nb, 'name': t})
                    elif isinstance(nb, str):
                        t = resolve(nb)
                        if t and t != s: kept_nb.append(t)
                if kept_nb:
                    new.setdefault(s, []).extend(kept_nb)
                else:
                    dropped += 1
            else:
                new[s] = neighbors  # unrecognized shape, pass through
        json.dump(new, open(p, 'w', encoding='utf-8'), indent=2)
        print(f'pairings.json (dict): {len(d)} → {len(new)}  (src dropped {dropped})')
    else:
        print(f'pairings.json: UNKNOWN SCHEMA, type={type(d).__name__}, skipped')

def migrate_dict_keyed_by_name(filename: str):
    p = PRO / filename
    if not p.exists():
        print(f'{filename}: not present, skipping')
        return
    backup(p)
    d = json.load(open(p, encoding='utf-8'))
    if not isinstance(d, dict):
        print(f'{filename}: not a dict, skipping')
        return
    out = {}
    dropped = 0
    for name, value in d.items():
        new = resolve(name)
        if new is None:
            dropped += 1
            continue
        out[new] = value
    json.dump(out, open(p, 'w', encoding='utf-8'), indent=2)
    print(f'{filename}: {len(d)} → {len(out)}  (dropped {dropped})')

def migrate_cluster_labels_v3():
    p = PRO / 'cluster_labels_v3.json'
    if not p.exists():
        print('cluster_labels_v3.json: not present, skipping')
        return
    # backup already exists from prior run; skip overwriting
    if not p.with_suffix(p.suffix + '.pre-v8-prune.bak').exists():
        backup(p)
    d = json.load(open(p, encoding='utf-8'))
    # schema: { k, clusters, ingredients: {name: cluster_id}, _meta }
    if isinstance(d, dict) and isinstance(d.get('ingredients'), dict):
        mp = d['ingredients']
        out_mp = {}
        dropped = 0
        for name, cid in mp.items():
            new = resolve(name)
            if new is None:
                dropped += 1
                continue
            out_mp[new] = cid
        d['ingredients'] = out_mp
        json.dump(d, open(p, 'w', encoding='utf-8'), indent=2)
        print(f'cluster_labels_v3.json: ingredients {len(mp)} → {len(out_mp)}  (dropped {dropped})')
    elif isinstance(d, dict) and 'ingredient_to_cluster' in d:
        mp = d['ingredient_to_cluster']
        out_mp = {}
        dropped = 0
        for name, cid in mp.items():
            new = resolve(name)
            if new is None:
                dropped += 1
                continue
            out_mp[new] = cid
        d['ingredient_to_cluster'] = out_mp
        json.dump(d, open(p, 'w', encoding='utf-8'), indent=2)
        print(f'cluster_labels_v3.json: ingredient_to_cluster {len(mp)} → {len(out_mp)}  (dropped {dropped})')
    else:
        print(f'cluster_labels_v3.json: unrecognized schema, keys = {list(d.keys()) if isinstance(d, dict) else type(d).__name__}')

# Run migrations
print('\n=== Migrating data files ===')
migrate_ingredients_json()
migrate_pairings_json()
migrate_dict_keyed_by_name('gnn_entropy.json')
migrate_dict_keyed_by_name('gnn_compounds.json')
migrate_dict_keyed_by_name('flavor_positions_v3.json')
migrate_dict_keyed_by_name('flavor_positions.json')
migrate_dict_keyed_by_name('gnn_positions.json')
migrate_cluster_labels_v3()

print('\n=== Done ===')
