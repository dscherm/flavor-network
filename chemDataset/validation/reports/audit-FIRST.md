# Pairing audit report

<!-- AUDIT_HEADER_BEGIN -->
runDate: 2026-05-13
scoredAgainst: 2026-03-19T19:34:19.501819
weightsHash: c34f81a5667ca87a8061bc30dfd92034a3f8b858454762af9b502f8d73b738fb
pairingCount: 48588
groundTruthCount: 30
<!-- AUDIT_HEADER_END -->

## Per-axis verdicts

| Axis | n (gt entries) | Sample gate | P@10 | R@20 | beyondBook@10 | Axis pairs | Verdict |
|---|---|---|---|---|---|---|---|
| chem-bridged-rare | 2 | insufficient | 0.0% | 0.0% | 0 | 0 | insufficient (n=2, target >= 15) |
| absent-from-books | 9 | insufficient | 0.0% | 0.0% | 10 | 48584 | insufficient (n=9, target >= 15) |
| cross-cuisine | 10 | insufficient | 0.0% | 0.0% | 0 | 0 | insufficient (n=10, target >= 15) |
| cross-aroma | 30 | ready | 0.0% | 0.0% | 10 | 20111 | fail |

## Top illustrative pairings per axis
### chem-bridged-rare: no pairs match this axis classifier

### absent-from-books
| Rank | Pair | Strength | In GT? | Shared compounds |
|---|---|---|---|---|
| 1 | galangal + makrut lime leave | 1.000 | no | — |
| 2 | all-purpose seasoning + scotch bonnet | 1.000 | no | — |
| 3 | lemongrass + makrut lime leave | 1.000 | no | — |
| 4 | liquid butter + lite salt | 1.000 | no | — |
| 5 | fish sauce + lemongrass | 1.000 | no | — |
| 6 | mirin + sake | 1.000 | no | — |
| 7 | blanched almond flour + celtic sea salt | 1.000 | no | — |
| 8 | paella rice + saffron | 1.000 | no | — |
| 9 | anchovy + capers | 1.000 | no | — |
| 10 | carbonated water + powdered sugar | 1.000 | no | — |
### cross-cuisine: no pairs match this axis classifier

### cross-aroma
| Rank | Pair | Strength | In GT? | Shared compounds |
|---|---|---|---|---|
| 1 | lemongrass + makrut lime leave | 1.000 | no | — |
| 2 | fish sauce + lemongrass | 1.000 | no | — |
| 3 | paella rice + saffron | 1.000 | no | — |
| 4 | anchovy + capers | 1.000 | no | — |
| 5 | brown chicken + parsley stem | 1.000 | no | — |
| 6 | lamb leg + pita bread | 1.000 | no | — |
| 7 | rice vinegar + soy sauce | 1.000 | no | — |
| 8 | fluid orange juice + fluid pineapple juice | 1.000 | no | — |
| 9 | mussel + saffron | 1.000 | no | — |
| 10 | crusty bread + tinned tomato | 1.000 | no | — |

## Data-source health

- Total ground-truth entries: 30
- Flavor Bible: 12
- Flavor Matrix: 8
- Chef-cite: 10
- Other / uncategorized: 0
- Cross-source Jaccard (FB-only ∩ Matrix-only): 0.000
- x3==0.5 share of corpus (FlavorDB API health proxy): 100.0%
- gnn_entropy.json available for cross-aroma axis: yes
- cuisine metadata available for cross-cuisine axis: yes
- Unmatched ground-truth entries (not present in shipped pairings): 26

  unmatched_ground_truth_entries:
  - basil|tomato
  - chili|chocolate
  - balsamic vinegar|strawberry
  - apple|pork
  - scallop|vanilla
  - goat cheese|honey
  - parmesan|strawberry
  - blue cheese|chocolate
  - coffee|mushroom
  - kiwi fruit|oyster sauce
  - asparagus spear|tangerine juice
  - bacon|maple syrup
  - chicken liver|chocolate
  - grapefruit|shrimp
  - coffee|salmon fillet
  - egg yolk|white chocolate
  - cucumber|gin
  - honey|whiskey
  - grapefruit|rosemary
  - lemon|thyme
  - ginger|lime
  - honey|thyme
  - coriander|orange
  - cardamom|coffee
  - chocolate|cinnamon
  - saffron|vanilla

## Axis distribution (ground-truth)

- cross-aroma: 30
- cross-cuisine: 10
- absent-from-books: 9
- chem-bridged-rare: 2

## Coverage delta (vs LATEST.md)

- first run — no prior baseline. All entries are new.

## Verdict paragraph

- **chem-bridged-rare**: insufficient (n=2, target >= 15). Cannot judge whether the untrained perceptron in 07-blend-v2.js is competitive with a simpler NPMI-only baseline on this axis until ground-truth coverage grows.
- **absent-from-books**: insufficient (n=9, target >= 15). Cannot judge whether the untrained perceptron in 07-blend-v2.js is competitive with a simpler NPMI-only baseline on this axis until ground-truth coverage grows.
- **cross-cuisine**: insufficient (n=10, target >= 15). Cannot judge whether the untrained perceptron in 07-blend-v2.js is competitive with a simpler NPMI-only baseline on this axis until ground-truth coverage grows.
- **cross-aroma**: fail (P@10=0.0%, R@20=0.0%). The untrained perceptron has no usable signal on this axis. Suspect feature weighting; ablation should isolate which input dimension is responsible.

curatedStoryCompoundOverlapRate: N/A (no curated_stories.json fixture present)
