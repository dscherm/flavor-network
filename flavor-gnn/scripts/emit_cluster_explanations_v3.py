"""emit_cluster_explanations_v3.py — N2-V3-EXP.

Generates public/proDataset/cluster_explanations_v3.json with per-cluster
top-cuisines, top-ingredients, dominant-taste, and a one-sentence
narrative — mirroring the v2 cluster_explanations.json schema so the
IngredientPanel `clusterExplanation` renderer reads v3 the same way.

Inputs:
  - public/proDataset/cluster_labels_v3.json  (clusters + ingredients map)
  - public/proDataset/pairings.json           (centrality within cluster)
  - public/proDataset/ingredients.json        (cuisines + taste per ingredient)
  - public/proDataset/flavor_graph_data_v3.json (tier1 aroma)

Output:
  - public/proDataset/cluster_explanations_v3.json

Schema (matches v2):
{
  "clusters": {
    "<cluster_id>": {
      "label": str,                    # from cluster_labels_v3.clusters[i].label
      "top_ingredients": [str, ...],   # top-5 by within-cluster centrality
      "top_cuisines": [str, ...],      # top-3 by frequency across members
      "dominant_taste": str,           # most common taste tag, may be null
      "dominant_aroma": str,           # most common tier1 aroma, may be null
      "size": int,
      "explanation": str               # narrative composed from above
    }, ...
  }
}
"""
from __future__ import annotations
import json
from pathlib import Path
from collections import Counter, defaultdict

ROOT = Path(__file__).resolve().parents[2]
PRO = ROOT / 'public' / 'proDataset'

cluster_labels = json.loads((PRO / 'cluster_labels_v3.json').read_text(encoding='utf-8'))
ingredients   = json.loads((PRO / 'ingredients.json').read_text(encoding='utf-8'))
pairings      = json.loads((PRO / 'pairings.json').read_text(encoding='utf-8'))
fg_v3         = json.loads((PRO / 'flavor_graph_data_v3.json').read_text(encoding='utf-8'))

# Build cluster → [member_names]
cluster_members = defaultdict(list)
for name, cid in cluster_labels.get('ingredients', {}).items():
    cluster_members[cid].append(name)

# Build name → tier1_aroma lookup from flavor_graph_data_v3
tier1_by_name = {}
for n in fg_v3.get('nodes', []):
    if n.get('tier1'):
        tier1_by_name[n['name']] = n['tier1']

# Build adjacency map for within-cluster centrality
adj = defaultdict(dict)
for e in pairings:
    a = (e.get('ingredientA') or e.get('source') or '').lower()
    b = (e.get('ingredientB') or e.get('target') or '').lower()
    s = e.get('strength', 0)
    if a and b:
        adj[a][b] = s
        adj[b][a] = s

def top_ingredients(members, k=5):
    """Return top-k members by sum of within-cluster edge strength."""
    members_set = set(m.lower() for m in members)
    scored = []
    for m in members:
        ml = m.lower()
        score = sum(s for n, s in adj.get(ml, {}).items() if n in members_set)
        scored.append((m, score))
    scored.sort(key=lambda x: -x[1])
    return [m for m, _ in scored[:k]]

def top_cuisines(members, k=3):
    """Return top-k cuisines by frequency across members."""
    c = Counter()
    for m in members:
        node = ingredients.get(m, {})
        for cu in (node.get('cuisines') or []):
            c[cu] += 1
    return [cu for cu, _ in c.most_common(k)]

def dominant_taste(members):
    """Most common taste tag across members (first token if multi)."""
    c = Counter()
    for m in members:
        t = ingredients.get(m, {}).get('taste') or ''
        for tok in str(t).lower().split():
            c[tok] += 1
    if not c: return None
    return c.most_common(1)[0][0]

def dominant_aroma(members):
    """Most common chef tier1 aroma across members."""
    c = Counter()
    for m in members:
        for a in tier1_by_name.get(m, []):
            c[a] += 1
    if not c: return None
    return c.most_common(1)[0][0]

def compose_explanation(top_ings, top_cuis, dom_taste, dom_aroma, size, label):
    """Generate a one-sentence narrative."""
    parts = []
    if top_ings:
        names = ', '.join(top_ings[:3])
        parts.append(f'Ingredients like {names} cluster here')
    if top_cuis:
        cu_names = ', '.join(top_cuis[:2])
        parts.append(f'most common in {cu_names} cuisine')
    if dom_aroma:
        parts.append(f'with a dominant {dom_aroma} aroma')
    if dom_taste and dom_taste != 'sweet':  # avoid the v2 "tends toward sweet" boilerplate
        parts.append(f'and a {dom_taste} taste profile')
    if not parts:
        return f'Cluster of {size} ingredients.'
    return ' '.join(parts).capitalize() + '.'

out_clusters = {}
for cl in cluster_labels.get('clusters', []):
    cid = cl['id']
    members = cluster_members.get(cid, [])
    ti = top_ingredients(members)
    tc = top_cuisines(members)
    dt = dominant_taste(members)
    da = dominant_aroma(members)
    out_clusters[str(cid)] = {
        'label': cl.get('label', f'cluster-{cid}'),
        'chemistry_label': cl.get('chemistry_label'),
        'top_ingredients': ti,
        'top_cuisines': tc,
        'dominant_taste': dt,
        'dominant_aroma': da,
        'size': len(members),
        'explanation': compose_explanation(ti, tc, dt, da, len(members), cl.get('label', '')),
    }

out = {
    'clusters': out_clusters,
    '_meta': {
        'generated_by': 'flavor-gnn/scripts/emit_cluster_explanations_v3.py (N2-V3-EXP, 2026-05-28)',
        'source_files': [
            'cluster_labels_v3.json',
            'pairings.json',
            'ingredients.json',
            'flavor_graph_data_v3.json',
        ],
        'k': cluster_labels.get('k'),
        'cluster_count': len(out_clusters),
    },
}

out_path = PRO / 'cluster_explanations_v3.json'
out_path.write_text(json.dumps(out, indent=2), encoding='utf-8')
print(f'wrote {out_path.name}: {len(out_clusters)} cluster explanations')

print('\nSample:')
for cid, c in list(out_clusters.items())[:3]:
    print(f"  [{cid}] {c['label']}  (size={c['size']})")
    print(f"      top: {', '.join(c['top_ingredients'])}")
    print(f"      cuisines: {', '.join(c['top_cuisines'])}")
    print(f"      taste={c['dominant_taste']}  aroma={c['dominant_aroma']}")
    print(f"      explanation: {c['explanation']}")
