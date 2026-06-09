# FM-P0-2 + FM-Q1 — corpus build report

## FM-P0-2 recipe sets
- recipes parsed: **2,231,142**
- kept (nm>=3, deduped): **1,636,962** ✅ (>=1.5M gate)
- dropped (nm<3): 118,234
- dropped (duplicate set): 475,373

### n_mapped distribution (recipes with >=1 mapped ingredient)

| n_mapped | recipes |
|---|---|
| 1 | 30,875 |
| 2 | 80,082 |
| 3 | 145,253 |
| 4 | 213,268 |
| 5 | 269,270 |
| 6 | 298,431 |
| 7 | 289,608 |
| 8 | 250,238 |
| 9 | 195,842 |
| 10 | 145,043 |
| 11 | 102,303 |
| 12 | 69,728 |
| 13 | 46,461 |
| 14 | 31,106 |
| 15 | 20,081 |
| 16 | 12,897 |
| 17 | 8,285 |
| 18 | 5,331 |
| 19 | 3,314 |
| 20 | 2,126 |
| 21+ | 3,750 |

## FM-Q1 quantities
- index-aligned recipes (len(ingredients)==len(NER)): **1,776,725** (skipped 453,844)
- ingredient lines seen (aligned): 14,983,028
- usable {qty,unit} triples emitted: **12,139,573**
- parse-coverage (usable / aligned lines): **81.02%**
- unit vocabulary: matches UNIT_DENSITY (27 units)