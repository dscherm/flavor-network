"""EXPLORATORY (post-hoc, decided after the pre-registered test failed).

Do tag COMBINATIONS (contrast as well as similarity) predict Flavor Bible
pairs? Features for a pair = symmetric outer product of the two tag
vectors (528 tag-pair interactions). Split by INGREDIENT: train only on
pairs whose ingredients are both in the training half, test only on pairs
whose ingredients are both in the other half, so the model cannot memorise
ingredients. Same split and model for the GNN probability vectors.
"""
import json
import numpy as np
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import roc_auc_score

ROOT = 'D:/Projects/flavor-network/'
TAGS = ROOT + 'data/experiments/aroma_tags_449.json'
VOCAB = ['citrus', 'berry', 'stone-fruit', 'tropical-fruit', 'apple-pear', 'dried-fruit', 'floral', 'green-grassy', 'herbal', 'mint', 'anise', 'earthy', 'mushroom', 'woody', 'smoky', 'roasted', 'nutty', 'caramel', 'chocolate', 'coffee', 'vanilla', 'warm-spice', 'peppery', 'pungent-allium', 'sulfurous-brassica', 'buttery-creamy', 'cheesy', 'meaty', 'briny-marine', 'fermented-funky', 'sour-tangy', 'sweet']

tags = json.load(open(TAGS, encoding='utf-8'))
fb = json.load(open(ROOT + 'public/proDataset/flavor_bible_matched.json', encoding='utf-8'))['pairs']
names = sorted({n for p in fb for n in p})
listed = {tuple(sorted(p)) for p in fb}
ent = json.load(open(ROOT + 'public/proDataset/gnn_entropy.json', encoding='utf-8'))

def tagvec(n):
    t = tags.get(n, {})
    return np.array([float(t.get(v, 0)) for v in VOCAB]) / 3.0

def gnnvec(n):
    p = (ent.get(n) or {}).get('probs')
    return np.array([p[k] for k in sorted(p)]) if p else None

iu = None
def feats(a, b):
    global iu
    m = np.outer(a, b)
    m = (m + m.T) / 2
    if iu is None or iu[0].max() >= len(a):
        iu = np.triu_indices(len(a))
    return m[iu]

results = {'tags': [], 'gnn': []}
for seed in range(5):
    rng = np.random.default_rng(seed)
    perm = rng.permutation(names)
    train = set(perm[: len(perm) // 2]); test = set(perm[len(perm) // 2:])
    for kind, vf in (('tags', tagvec), ('gnn', gnnvec)):
        iu = None
        def rows(side):
            X, y = [], []
            nm = sorted(side)
            for i in range(len(nm)):
                va = vf(nm[i])
                if va is None: continue
                for j in range(i + 1, len(nm)):
                    vb = vf(nm[j])
                    if vb is None: continue
                    X.append(feats(va, vb)); y.append(1 if (nm[i], nm[j]) in listed or (nm[j], nm[i]) in listed else 0)
            return np.array(X), np.array(y)
        Xtr, ytr = rows(train); Xte, yte = rows(test)
        clf = LogisticRegression(max_iter=2000, C=0.5, class_weight='balanced').fit(Xtr, ytr)
        results[kind].append(roc_auc_score(yte, clf.predict_proba(Xte)[:, 1]))

for k, v in results.items():
    print(f'{k:5s} held-out-ingredient AUROC over 5 splits: mean {np.mean(v):.3f}  (min {min(v):.3f}, max {max(v):.3f})')

# Same held-out-ingredient splits: co-occurrence alone (tradition, 0 when the
# pair never co-occurs) and co-occurrence + tag-combination model.
pairs = json.load(open(ROOT + 'public/proDataset/pairings.json', encoding='utf-8'))
trad = {tuple(sorted((p['ingredientA'], p['ingredientB']))): p['tradition'] for p in pairs if p.get('known')}
cmp = {'cooccurrence': [], 'tags+cooccurrence': []}
for seed in range(5):
    rng = np.random.default_rng(seed)
    perm = rng.permutation(names)
    train = set(perm[: len(perm) // 2]); test = set(perm[len(perm) // 2:])
    iu = None
    def rows2(side):
        X, T, y = [], [], []
        nm = sorted(side)
        for i in range(len(nm)):
            for j in range(i + 1, len(nm)):
                k = tuple(sorted((nm[i], nm[j])))
                X.append(feats(tagvec(nm[i]), tagvec(nm[j]))); T.append(trad.get(k, 0.0)); y.append(1 if k in listed else 0)
        return np.array(X), np.array(T), np.array(y)
    Xtr, Ttr, ytr = rows2(train); Xte, Tte, yte = rows2(test)
    cmp['cooccurrence'].append(roc_auc_score(yte, Tte))
    Ztr = np.column_stack([Xtr, Ttr, (Ttr > 0).astype(float)]); Zte = np.column_stack([Xte, Tte, (Tte > 0).astype(float)])
    clf = LogisticRegression(max_iter=3000, C=0.5, class_weight='balanced').fit(Ztr, ytr)
    cmp['tags+cooccurrence'].append(roc_auc_score(yte, clf.predict_proba(Zte)[:, 1]))
for k, v in cmp.items():
    print(f'{k:18s} held-out-ingredient AUROC over 5 splits: mean {np.mean(v):.3f}  (min {min(v):.3f}, max {max(v):.3f})')

# Shippable variant: learn tag-combination weights from RECIPE CO-OCCURRENCE
# (observed pair or not), never from the Flavor Bible; still scored on
# Flavor Bible labels for held-out ingredients.
res = []
for seed in range(5):
    rng = np.random.default_rng(seed)
    perm = rng.permutation(names)
    train = set(perm[: len(perm) // 2]); test = set(perm[len(perm) // 2:])
    iu = None
    def rows3(side, label):
        X, y = [], []
        nm = sorted(side)
        for i in range(len(nm)):
            for j in range(i + 1, len(nm)):
                k = tuple(sorted((nm[i], nm[j])))
                X.append(feats(tagvec(nm[i]), tagvec(nm[j])))
                y.append((1 if k in trad else 0) if label == 'cooc' else (1 if k in listed else 0))
        return np.array(X), np.array(y)
    Xtr, ytr = rows3(train, 'cooc'); Xte, yte = rows3(test, 'fb')
    clf = LogisticRegression(max_iter=3000, C=0.5, class_weight='balanced').fit(Xtr, ytr)
    res.append(roc_auc_score(yte, clf.predict_proba(Xte)[:, 1]))
print(f'tags trained on co-occurrence, scored on FB (held-out ingredients): mean {np.mean(res):.3f}  (min {min(res):.3f}, max {max(res):.3f})')
