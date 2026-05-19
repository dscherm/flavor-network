# Flavor Graph — Chef-User Curation

This directory holds the **chef-user curation surface** for the Flavor
Model Expansion (Delivery N+1). The CSV here is the source of truth for
the top-500 ingredients' Tier-1/Tier-2/Tier-3 + leaves flavor graph.

## Files

- `top500_flavor_graph.csv` — the curation surface. **Edit this.** One
  row per ingredient. Pipe-delimited multi-value cells
  (e.g., `bitter|astringent`).
- `curation_notes.md` — vocabulary reference + worked example.
  **Read this first** before editing the CSV.
- `README.md` — this file (the contract / idempotency rules).

## Idempotency contract

Re-running `python flavor-gnn/scripts/scaffold_top500_curation.py`
**preserves any row where any tier column is non-empty**. Empty rows
are refilled from `public/proDataset/ingredients.json`'s top-500 by
pairing count.

**Manual entries are never overwritten by re-run.** This is the
binding rule from lesson
`pipeline-rebuild-wipes-manual-data-additions`. If you see a chef
edit disappear after a re-run, that's a bug — file it.

A name dropping out of the new top-500 (e.g., the pairing graph was
rebuilt and the ranking shifted) is **preserved at the end of the
CSV** with a stderr log line so you know the file size has drifted
from 500. We never silently delete chef work.

## Verification gates (must pass before commit)

```powershell
# 1. Re-run is a no-op when no manual edits happened in between:
python flavor-gnn/scripts/scaffold_top500_curation.py
python flavor-gnn/scripts/scaffold_top500_curation.py
git diff --exit-code flavor-gnn/curation/top500_flavor_graph.csv

# 2. Canonical fixture rows (mint, vanilla bean, soy sauce, lemon,
#    garlic) survive with non-empty tier1_aroma:
python -c "import csv; rows = {r['name']: r for r in csv.DictReader(open('flavor-gnn/curation/top500_flavor_graph.csv', encoding='utf-8'))}; assert all(rows[n]['tier1_aroma'] for n in ['mint', 'vanilla bean', 'soy sauce', 'lemon', 'garlic']), 'fixture rows missing tier1_aroma'"

# 3. The top-500 row count is exactly 500 (modulo preserved-dropped
#    manual rows, which the gate test calls out separately).
python -c "import csv; rows = list(csv.DictReader(open('flavor-gnn/curation/top500_flavor_graph.csv', encoding='utf-8'))); assert len(rows) >= 500, f'expected >= 500 rows, got {len(rows)}'"
```

All three must exit 0.
