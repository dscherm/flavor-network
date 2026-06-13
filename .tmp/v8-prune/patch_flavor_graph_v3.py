#!/usr/bin/env python3
"""
patch_flavor_graph_v3.py — backfill chef v8 tier1/2/3/leaves into the
shipped flavor_graph_data_v3.json without re-running the GAT pipeline.

The v8 CSV is a labels-only update (chef edited tier1_aroma /
tier2_taste / tier3_mouthfeel columns); the model embeddings,
clustering, and positions weren't affected. So patching tier values
in-place is correct.

Also handles:
  - Pruning nodes not in v8 / cocktail-aug / sauce-aug (consistent
    with apply_v8_prune.py KEEP set)
  - Renaming nodes per ALIAS map
  - Striping the chef's '- name' prefix from any row that survives
    (cleans up display labels)
"""
import csv, json, shutil
from pathlib import Path

REPO = Path(r'D:\Projects\flavor-network')
V8_CSV = REPO / '.tmp/chef-revs-8/flavor_graph_full_v8_NEW.csv'
PRO = REPO / 'public/proDataset'
DATA = REPO / 'public/data'

def clean(n):
    return n.strip().lstrip('- ').strip().lower()

# Load v8 chef labels keyed by canonical name
with open(V8_CSV, encoding='utf-8') as f:
    v8_rows = list(csv.DictReader(f))

def tokenize(s):
    return [t.strip() for t in (s or '').split('|') if t.strip() and t.strip() != '[odorless]']

v8_labels = {}
for r in v8_rows:
    name = clean(r.get('name', ''))
    if not name: continue
    v8_labels[name] = {
        'tier1': tokenize(r.get('tier1_aroma', '')),
        'tier2': tokenize(r.get('tier2_taste', '')),
        'tier3': tokenize(r.get('tier3_mouthfeel', '')),
        'leaves': tokenize(r.get('leaves', '')),
    }
print(f'v8 chef labels loaded: {len(v8_labels)} ingredients')

# Build KEEP set + aliases (mirror apply_v8_prune.py)
def collect_names(obj, out):
    if isinstance(obj, dict):
        if 'name' in obj and isinstance(obj['name'], str):
            out.add(obj['name'].lower())
        for v in obj.values(): collect_names(v, out)
    elif isinstance(obj, list):
        for v in obj: collect_names(v, out)

cocktail_aug = json.load(open(DATA / 'cocktail_augment.json', encoding='utf-8'))
sauce_aug = json.load(open(DATA / 'sauce_augment.json', encoding='utf-8'))
cocktail_ings = set(); collect_names(cocktail_aug, cocktail_ings)
sauce_ings = set(); collect_names(sauce_aug, sauce_ings)
keep = set(v8_labels.keys()) | cocktail_ings | sauce_ings

ALIAS = {
    'asparagu': 'asparagus',
    'baby back pork rib': 'baby back pork ribs',
    'bitter': 'bitters',
    'hop': 'hops',
    'molasse': 'molasses',
}

def resolve(name):
    low = name.lower().strip()
    # also strip chef's '- ' prefix from old-format rows
    if low.startswith('- '): low = low[2:].strip()
    if low in ALIAS:
        canonical = ALIAS[low]
        return canonical if canonical in keep else None
    return low if low in keep else None

# Patch flavor_graph_data_v3.json
p = PRO / 'flavor_graph_data_v3.json'
bak = p.with_suffix(p.suffix + '.pre-v8-patch.bak')
if not bak.exists():
    shutil.copy(p, bak)
    print(f'backup: {bak.name}')

d = json.load(open(p, encoding='utf-8'))
nodes = d.get('nodes', [])
print(f'flavor_graph_data_v3.json input nodes: {len(nodes)}')

out_nodes = []
dropped = 0
patched = 0
empty_tier1_before = sum(1 for n in nodes if not n.get('tier1'))
for n in nodes:
    canonical = resolve(n.get('name', ''))
    if canonical is None:
        dropped += 1
        continue
    n['name'] = canonical
    chef = v8_labels.get(canonical)
    if chef:
        # only overwrite when chef has content (preserves rows where chef left blank)
        if chef['tier1']: n['tier1'] = chef['tier1']
        if chef['tier2']: n['tier2'] = chef['tier2']
        if chef['tier3']: n['tier3'] = chef['tier3']
        if chef['leaves']: n['leaves'] = chef['leaves']
        patched += 1
    out_nodes.append(n)

# Dedup by name (alias collisions): keep first occurrence
seen = set()
deduped = []
for n in out_nodes:
    if n['name'] in seen: continue
    seen.add(n['name'])
    deduped.append(n)

d['nodes'] = deduped
empty_tier1_after = sum(1 for n in deduped if not n.get('tier1'))

# Also filter edges to nodes in keep set
edges_in = d.get('edges', [])
node_names = {n['name'] for n in deduped}
edges_out = []
for e in edges_in:
    src = resolve(e.get('source', e.get('a', '')))
    tgt = resolve(e.get('target', e.get('b', '')))
    if src is None or tgt is None or src == tgt: continue
    if src not in node_names or tgt not in node_names: continue
    e2 = dict(e)
    if 'source' in e2: e2['source'] = src
    if 'target' in e2: e2['target'] = tgt
    if 'a' in e2: e2['a'] = src
    if 'b' in e2: e2['b'] = tgt
    edges_out.append(e2)
d['edges'] = edges_out

json.dump(d, open(p, 'w', encoding='utf-8'), indent=2)
print(f'flavor_graph_data_v3.json output: {len(deduped)} nodes ({dropped} dropped, {patched} patched)')
print(f'  empty tier1: {empty_tier1_before} → {empty_tier1_after}')
print(f'  edges: {len(edges_in)} → {len(edges_out)}')
