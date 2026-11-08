# aroma as-built specs

## AROMA-1 — Experiment: do model-written aroma tags predict good pairings?

449 Flavor Bible answer-key ingredients tagged (1-5 of 32 aroma tags, intensity 1-3) by three model agents told to describe each ingredient alone (data/experiments/aroma_tags_449.json, instructions alongside). Pre-registered test (scripts/evalAromaTags.mjs): aroma-tag cosine AUROC 0.512 vs molecular GNN 0.527 on all 100,576 pairs; adds nothing to co-occurrence on observed pairs (0.630 -> 0.630). FAIL. Exploratory (scripts/exploreAromaTagCombos.py, held-out ingredients): tag COMBINATIONS reach 0.598 when trained on Flavor Bible labels, but 0.510 when trained on recipe co-occurrence — the signal is learned from the Flavor Bible itself, which the project cannot ship. Conclusion: no shippable aroma pairing signal; do not tag the remaining 3,891 for pairing. Tags may still serve as descriptive 'smells like' labels.
