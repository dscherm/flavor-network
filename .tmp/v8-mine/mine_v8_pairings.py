#!/usr/bin/env python3
"""
mine_v8_pairings.py — N2-V8-MINE.

Stream-scan proDataset/raw/RecipeNLG_dataset.csv (2.3 GB) to find
co-occurrence pairings for 68 chef-curated v8 ingredients that
currently have no edges in public/proDataset/pairings.json.

Strategy:
  1. Load 68 target names (.tmp/v8-mine/targets.json)
  2. Load 3,847 canonical app ingredient names (post-prune ingredients.json)
  3. For each RecipeNLG row, parse NER column (JSON array of ingredient strings)
  4. Lowercase each NER token; normalize whitespace
  5. Match a NER token to a target via substring (target IN ner) since
     RecipeNLG NER varies ("asparagus spear", "asparagus tips" both → asparagus)
  6. Match the same NER token to a canonical app ingredient via exact match
  7. For every (target, other_app_ingredient) pair in the recipe, increment count
  8. After full scan, compute NPMI per the existing pipeline formula

Output: .tmp/v8-mine/v8_pairings.json — list of edges ready to merge
into public/proDataset/pairings.json.

NPMI = log(p(a,b) / (p(a) * p(b))) / -log(p(a,b))
where p(x) = recipes_containing_x / total_recipes
      p(a,b) = recipes_containing_both / total_recipes
"""
import csv, json, sys, math, time
from pathlib import Path
from collections import Counter, defaultdict

REPO = Path(r'D:\Projects\flavor-network')
RAW = REPO / 'proDataset/raw/RecipeNLG_dataset.csv'
TARGETS = REPO / '.tmp/v8-mine/targets.json'
APP_INGS = REPO / 'public/proDataset/ingredients.json'
OUT = REPO / '.tmp/v8-mine/v8_pairings.json'

target_list = json.load(open(TARGETS, encoding='utf-8'))
target_set = set(target_list)
print(f'targets ({len(target_set)}):', sorted(target_set)[:5], '...')

app_ings = json.load(open(APP_INGS, encoding='utf-8'))
app_names = set(n.lower() for n in app_ings.keys())
print(f'canonical app ingredients (post-prune): {len(app_names)}')

# Sort targets longest-first so 'red bell pepper' matches before 'pepper'
sorted_targets = sorted(target_set, key=lambda x: (-len(x), x))

def match_target(ner_token):
    """Return the target this NER token is a substring of, or None."""
    for t in sorted_targets:
        # Whole-word containment: target must appear with word boundaries
        if t in ner_token:
            # Verify it's a whole-word match
            idx = ner_token.find(t)
            before = ner_token[idx-1] if idx > 0 else ' '
            after = ner_token[idx+len(t)] if idx+len(t) < len(ner_token) else ' '
            if not before.isalpha() and not after.isalpha():
                return t
    return None

# csv.field_size_limit bump — recipe rows can have long ingredient lists
csv.field_size_limit(2**31 - 1)

# Counters
recipe_count = 0
target_recipe_count = Counter()           # target → how many recipes it appears in
app_recipe_count = Counter()              # app ingredient → how many recipes
cooc = defaultdict(int)                   # (target, app_ingredient) → cooccurrence count

t0 = time.time()
print(f'\nStreaming {RAW.name} ({RAW.stat().st_size/1024/1024/1024:.2f} GB)...')
with open(RAW, encoding='utf-8', newline='') as f:
    reader = csv.DictReader(f)
    for row in reader:
        recipe_count += 1
        if recipe_count % 100000 == 0:
            elapsed = time.time() - t0
            rate = recipe_count / elapsed
            eta = (2200000 - recipe_count) / rate if rate > 0 else 0
            print(f'  {recipe_count:>10,d} recipes  ({rate:.0f}/s)  ETA {eta:.0f}s')

        try:
            ner = json.loads(row['NER'])
        except Exception:
            continue
        if not isinstance(ner, list): continue

        ner_lc = [str(x).lower().strip() for x in ner if isinstance(x, str)]
        ner_lc = [x for x in ner_lc if x]
        if not ner_lc: continue

        # Find which targets appear (one substring scan per NER token)
        matched_targets = set()
        matched_app = set()
        for nt in ner_lc:
            tgt = match_target(nt)
            if tgt: matched_targets.add(tgt)
            if nt in app_names: matched_app.add(nt)

        # Global per-recipe counts (for marginal probability)
        for t in matched_targets: target_recipe_count[t] += 1
        for a in matched_app:     app_recipe_count[a] += 1

        # Co-occurrence: (target, every-other-canonical-app-ingredient)
        if matched_targets and matched_app:
            for t in matched_targets:
                for a in matched_app:
                    if a == t: continue  # skip self-pair (also unlikely since a∈app_names, t∈target_set)
                    cooc[(t, a)] += 1

print(f'\nDone scan. {recipe_count:,} recipes in {time.time()-t0:.1f}s')
print(f'target hits      : {sum(target_recipe_count.values())} ({len(target_recipe_count)} unique targets)')
print(f'co-occurrence pairs: {len(cooc)}')

# Compute NPMI per pipeline formula
MIN_COOC = 5  # mirror MIN_RECIPE_COUNT from proDataset/config.js (typically 3-5)
edges = []
for (t, a), c in cooc.items():
    if c < MIN_COOC: continue
    p_a = target_recipe_count[t] / recipe_count
    p_b = app_recipe_count[a] / recipe_count
    p_ab = c / recipe_count
    if p_ab <= 0 or p_a <= 0 or p_b <= 0: continue
    pmi = math.log(p_ab / (p_a * p_b))
    npmi = pmi / -math.log(p_ab)
    # NPMI is in [-1, 1]. Map to a [0, 1] strength via 0.5+0.5*npmi, then clip
    strength = max(0.0, min(1.0, 0.5 + 0.5 * npmi))
    edges.append({
        'ingredientA': t,
        'ingredientB': a,
        'strength': round(strength, 4),
        'cooc': c,
        'npmi': round(npmi, 4),
    })

# Sort by strength descending
edges.sort(key=lambda e: -e['strength'])
print(f'edges with cooc >= {MIN_COOC}: {len(edges)}')

# Count edges per target
per_target = Counter()
for e in edges: per_target[e['ingredientA']] += 1
print(f'\nedges per target (top 20):')
for t, c in per_target.most_common(20):
    print(f'  {c:>5}  {t}')
print(f'\ntargets with ≥3 edges: {sum(1 for c in per_target.values() if c >= 3)} / {len(target_set)}')
print(f'targets with 0 edges: {len(target_set) - len(per_target)}')

json.dump(edges, open(OUT, 'w', encoding='utf-8'), indent=2)
print(f'\nwrote {len(edges)} edges to {OUT}')
