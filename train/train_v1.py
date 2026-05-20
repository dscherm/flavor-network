"""V1 schema-validation classifier (Path A) — predict pairing_principles
from concatenated (leaves_A, leaves_B) multi-hot vectors.

See `.omc/plans/ralplan-flavor-model-expansion-v3-pathAB.md` §P-A1 and
`C:/Users/scher/Downloads/path_a_specs.md` §3 for the spec this implements
verbatim.

Outputs:
  - results.json          (acceptance-gate artifact for test_gates_v1.py)
  - confusion_matrix.png  (logistic regression diagonal diagnostic)

Run:
    cd train
    pip install -r requirements_v1.txt
    python train_v1.py ../flavor-gnn/curation/top500_flavor_graph.csv
    python test_gates_v1.py
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Iterable

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from sklearn.dummy import DummyClassifier
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import classification_report, confusion_matrix, f1_score

RNG_SEED = 42
TEST_NODE_FRACTION = 0.20


def load_vocab(vocab_path: Path) -> tuple[list[str], dict[str, str]]:
    """Load canonical principles + collapse table from principle_vocab.json."""
    payload = json.loads(vocab_path.read_text(encoding="utf-8"))
    canonical = list(payload["canonical"])
    collapse = dict(payload["collapse"])
    if payload.get("maillard_collapse_default") is True:
        collapse["maillard-bridge"] = "shared-volatile"
        canonical = [c for c in canonical if c != "maillard-bridge"]
    return canonical, collapse


def split_pipe(value: str) -> list[str]:
    if not isinstance(value, str):
        return []
    return [t.strip() for t in value.split("|") if t.strip()]


def multi_hot(tokens: Iterable[str], vocab_idx: dict[str, int]) -> np.ndarray:
    vec = np.zeros(len(vocab_idx), dtype=np.float32)
    for tok in tokens:
        i = vocab_idx.get(tok)
        if i is not None:
            vec[i] = 1.0
    return vec


def build_edges(
    df: pd.DataFrame, names: set[str], collapse: dict[str, str]
) -> tuple[list[tuple[str, str, str]], int]:
    """Expand rows → (source, target, principle); collapse extended labels."""
    raw, kept = [], []
    for _, row in df.iterrows():
        src = str(row["name"]).strip()
        kps = split_pipe(row.get("key_pairings", ""))
        pps = split_pipe(row.get("pairing_principles", ""))
        if not src or not kps or not pps or len(kps) != len(pps):
            continue
        for tgt, principle in zip(kps, pps):
            raw.append((src, tgt, principle))
            if tgt in names:
                kept.append((src, tgt, collapse.get(principle, principle)))
    return kept, len(raw)


def node_disjoint_split(
    edges: list[tuple[str, str, str]], names: list[str], seed: int
) -> tuple[list[int], list[int], list[str], list[str]]:
    """Hold out edges where source OR target is in 20% held-out nodes."""
    rng = np.random.default_rng(seed)
    n_test = max(1, int(round(len(names) * TEST_NODE_FRACTION)))
    test_nodes = set(rng.choice(names, size=n_test, replace=False))
    train_idx, test_idx = [], []
    for i, (s, t, _) in enumerate(edges):
        if s in test_nodes or t in test_nodes:
            test_idx.append(i)
        else:
            train_idx.append(i)
    train_nodes = sorted(set(names) - test_nodes)
    return train_idx, test_idx, train_nodes, sorted(test_nodes)


def fit_and_score(
    model, X_train: np.ndarray, y_train: np.ndarray, X_test: np.ndarray, y_test: np.ndarray
) -> tuple[float, float, np.ndarray]:
    model.fit(X_train, y_train)
    y_pred = model.predict(X_test)
    acc = float((y_pred == y_test).mean())
    macro_f1 = float(f1_score(y_test, y_pred, average="macro", zero_division=0))  # type: ignore[arg-type]
    return acc, macro_f1, y_pred


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("csv", type=Path, help="path to top500_flavor_graph.csv")
    parser.add_argument(
        "--vocab",
        type=Path,
        default=Path(__file__).parent.parent / "flavor-gnn" / "curation" / "principle_vocab.json",
    )
    parser.add_argument("--results", type=Path, default=Path("results.json"))
    parser.add_argument("--matrix", type=Path, default=Path("confusion_matrix.png"))
    args = parser.parse_args(argv)

    print(f"[v1] loading {args.csv}")
    df = pd.read_csv(args.csv).fillna("")
    df = df[(df["leaves"].astype(str).str.strip() != "") & (df["key_pairings"].astype(str).str.strip() != "")]
    print(f"[v1] {len(df)} rows with non-empty leaves + key_pairings")

    canonical, collapse = load_vocab(args.vocab)
    print(f"[v1] vocab: {len(canonical)} canonical classes (maillard collapsed = {('maillard-bridge' in collapse)})")

    names = sorted(df["name"].astype(str).str.strip().unique())
    leaves_by_name = {
        n: split_pipe(df.loc[df["name"].astype(str).str.strip() == n, "leaves"].iloc[0])
        for n in names
    }

    edges, total_raw = build_edges(df, set(names), collapse)
    filter_rate = len(edges) / total_raw if total_raw else 0.0
    print(f"[v1] edges: {len(edges)} kept of {total_raw} raw (filter rate {filter_rate:.1%})")

    leaf_vocab = sorted({t for n in names for t in leaves_by_name[n]})
    leaf_idx = {t: i for i, t in enumerate(leaf_vocab)}
    print(f"[v1] leaf vocab: {len(leaf_vocab)} unique tokens")

    feats = np.stack([
        np.concatenate([
            multi_hot(leaves_by_name[s], leaf_idx),
            multi_hot(leaves_by_name[t], leaf_idx),
        ])
        for s, t, _ in edges
    ])
    labels = np.array([p for _, _, p in edges])
    classes_in_data = sorted(set(labels.tolist()))
    print(f"[v1] feature matrix {feats.shape}; principles in collapsed data: {classes_in_data}")

    train_idx, test_idx, train_nodes, test_nodes = node_disjoint_split(edges, names, RNG_SEED)
    print(f"[v1] split: train={len(train_idx)} test={len(test_idx)} (held-out nodes={len(test_nodes)})")
    if not train_idx or not test_idx:
        print("[v1] empty train or test set after split — aborting")
        return 1

    X_tr, X_te = feats[train_idx], feats[test_idx]
    y_tr, y_te = labels[train_idx], labels[test_idx]

    baseline = DummyClassifier(strategy="most_frequent")
    logistic = LogisticRegression(max_iter=2000, class_weight="balanced", random_state=RNG_SEED)
    rf = RandomForestClassifier(n_estimators=200, max_depth=None, random_state=RNG_SEED, class_weight="balanced")

    base_acc, _, _ = fit_and_score(baseline, X_tr, y_tr, X_te, y_te)
    log_acc, log_f1, log_pred = fit_and_score(logistic, X_tr, y_tr, X_te, y_te)
    rf_acc, rf_f1, _ = fit_and_score(rf, X_tr, y_tr, X_te, y_te)

    print(f"[v1] baseline acc={base_acc:.3f} | logistic acc={log_acc:.3f} f1={log_f1:.3f} | rf acc={rf_acc:.3f} f1={rf_f1:.3f}")

    log_report = classification_report(y_te, log_pred, output_dict=True, zero_division=0)
    per_class_f1 = {c: float(log_report[c]["f1-score"]) for c in classes_in_data if c in log_report}
    cm_labels = sorted(set(y_te.tolist()) | set(log_pred.tolist()))
    cm = confusion_matrix(y_te, log_pred, labels=cm_labels)

    _, ax = plt.subplots(figsize=(6, 5))
    im = ax.imshow(cm, cmap="Blues")
    ax.set_xticks(range(len(cm_labels)), cm_labels, rotation=45, ha="right")
    ax.set_yticks(range(len(cm_labels)), cm_labels)
    for i in range(len(cm_labels)):
        for j in range(len(cm_labels)):
            ax.text(j, i, str(cm[i, j]), ha="center", va="center",
                    color="white" if cm[i, j] > cm.max() / 2 else "black", fontsize=8)
    ax.set_xlabel("predicted"); ax.set_ylabel("true")
    ax.set_title(f"Logistic confusion matrix (acc {log_acc:.2f})")
    plt.colorbar(im, ax=ax); plt.tight_layout(); plt.savefig(args.matrix, dpi=120); plt.close()
    print(f"[v1] wrote {args.matrix}")

    results = {
        "baseline_accuracy": base_acc,
        "logistic_accuracy": log_acc,
        "rf_accuracy": rf_acc,
        "logistic_macro_f1": log_f1,
        "rf_macro_f1": rf_f1,
        "principle_classes": classes_in_data,
        "train_edges": len(train_idx),
        "test_edges": len(test_idx),
        "train_nodes": train_nodes,
        "test_nodes": test_nodes,
        "filter_rate": filter_rate,
        "logistic_per_class_f1": per_class_f1,
        "logistic_confusion_matrix": cm.tolist(),
        "logistic_confusion_labels": cm_labels,
    }
    args.results.write_text(json.dumps(results, indent=2), encoding="utf-8")
    print(f"[v1] wrote {args.results}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
