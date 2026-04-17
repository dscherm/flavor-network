# chemDataset — Molecular flavor pipeline (C variant)

Builds `public/chemDataset/{ingredients,pairings}.json` from public
chemistry/sensory databases surveyed in
[S2665927125001583](https://pmc.ncbi.nlm.nih.gov/articles/PMC12274706/).

## Sources

| Source         | Content                                  | URL                                          | Acquisition  |
|----------------|------------------------------------------|----------------------------------------------|--------------|
| FooDB          | 797 foods × 70,926 compounds             | www.foodb.ca                                 | bulk CSV     |
| FlavorDB       | 25,595 molecules with taste + odor tags  | cosylab.iiitd.edu.in/flavordb2               | scrape       |
| ChemTasteDB    | 2,944 taste-classified molecules         | zenodo.org/records/5747393                   | Zenodo ZIP   |
| BitterDB       | 1,041 bitter-tasting molecules           | bitterdb.agri.huji.ac.il                     | scrape       |
| SuperSweetDB   | 8,000+ sweet compounds                   | webdocs.cs.ualberta.ca/SuperSweetDB (mirror) | scrape       |

## Pipeline order

```
01-fetch-foodb.js          raw/foodb/         → processed/foodb.json
02-fetch-flavordb.js       raw/flavordb/      → processed/flavordb.json
03-fetch-chemtastedb.js    raw/chemtastedb/   → processed/chemtastedb.json
04-fetch-bitterdb.js       raw/bitterdb/      → processed/bitterdb.json
05-fetch-supersweetdb.js   raw/supersweetdb/  → processed/supersweetdb.json

10-blend.js                processed/*.json   → ../public/chemDataset/*.json
```

`raw/` is gitignored — each script is idempotent and caches to disk.
Rate-limited to 1 req/sec for scraped sources.

## Pairing score (10-blend.js)

For ingredients A and B:

```
compounds(A) = set of FooDB chemicals for A, filtered to those in FlavorDB
compounds(B) = same for B
shared       = compounds(A) ∩ compounds(B)
taste_shared = shared compounds with matching primary taste class

jaccard         = |shared| / |compounds(A) ∪ compounds(B)|
potency_shared  = Σ log(1 + intensity(c)) for c in shared
strength        = 0.6 × jaccard + 0.3 × normalized(potency_shared) + 0.1 × taste_shared/|shared|
```

Edges kept if `strength > 0.05` and `|shared| ≥ 2`.

## Licensing

All sources are academic. Redistribution rules vary. The pipeline
writes only derived joins (ingredient-name → summary compounds),
never the full upstream tables. See LICENSE-NOTES.md.
