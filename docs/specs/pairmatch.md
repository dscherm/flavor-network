# pairmatch as-built specs

## PAIRMATCH-1 — Rank 'goes well with' cocktails and sauces by ingredient co-occurrence, not molecular aroma

New src/data/recipePairingMatch.js ranks items by IDF-weighted best observed pairing strength between item and recipe ingredients (shared ingredient = 1). Used by App's Find cocktail/sauce handlers (Recipe Notebook + Cookbook) and the Flavor Profiles Pairings page; match cards show the pairs that drove each match. pairings.bin bumped to v2 to carry the observed/predicted flag (bit 15 of idxB); decoder moved to src/data/pairingsBinary.js.

## PAIRMATCH-2 — Stop drinks scored on a sliver of their recipe from dominating matches

'Normandie Club Bloody Mary' resolved only lemon + lime juice (aquavit and bottled mix unmatched) and appeared in the top-8 cocktail matches for 35/49 Cookbook recipes. scoreItemForRecipe now scales the score by the share of the item's ingredients that resolve.

## PAIRMATCH-3 — Pairing-match reliability: answer key, co-occurrence score, hub discounts, floor, aliases

scripts/evalPairingMatch.mjs is a three-part offline answer key (namesake-sauce rank, top-N concentration over every Cookbook recipe, Flavor Bible agreement vs random). Measured on it: the blended `strength` barely agrees with the Flavor Bible (AUROC 0.53), the pipeline's `tradition` sub-score does (0.63), so the ranker now scores on it (pairings.bin v3 carries it as `cooccurrence`). Hub ingredients are discounted on the item side too, short items shrink toward zero, matches under 0.1 are not shown and under 0.2 read 'loose match'. Ice/soda are ignored; accents, hyphens and ~50 spirit/liqueur aliases resolve.
