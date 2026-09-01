# Backlog — parked at the v1.0.0 freeze (2026-09-01)

The web app at https://neuralflavor.web.app is frozen at v1.0.0. Everything
below was open when the project closed out and was deliberately **not done**.
Nothing here is a bug in the live build; all of it is new scope.

If you return: read `CLOSEOUT.md` first, then pick from here.

## Recipe Lab — Flavor Profiles card + card-format suggestions
Spec: `docs/archive/RALPH-SPEC-flavor-profiles.md` (deep-interview spec, 2026-06-11).

- RFP-R1  Chalkboard `IngredientProfileCard` with hero before→after radar; use it in the Suggest + R decks
- RFP-R1B Route the + Add chrome button into the chalkboard `IngredientProfileCard` deck
- RFP-R1C Wire the chalkboard deck into Cocktail Lab's "Suggested Next"
- RFP-R1D Chalkboard sauce-card deck for "Suggested sauces" + smart recipe-relevance gate
- RFP-R2  Surface aroma-matched cocktail + sauce names on the Flavor Profiles Pairings page
- RFP-R3  Page-indicator dots + touch-swipe on the Flavor Profiles carousel
- RFP-R4  Delete dead `RecipeFlavorProfileCard.jsx` (singular) + final integration verify
- FP-OV-1 Overview page: quantity-weighted horizontal flavor bar chart
- FP-OV-2 Rule-based smart flavor-profile description (on-device, no external API)
- FP-OV-3 "More {axis}? Try…" enhance card (boost/temper) with ingredient buckets
- FP-OV-4 SPIKE: local on-device model (ONNX) for the profile description — spike doc was
  `flavor-gnn/artifacts/FP-OV-4_ONNX_DESCRIPTION_SPIKE_2026-06-22.md` (deleted; in git history)

## Pairing Lab (a proposed 4th lab — never started)
- PAIR-LAB-P0 `pairingEgoModel.js` — pure ego/lens/insight model
- PAIR-LAB-P1 `PairingBoard.jsx` — 2D canvas ego renderer, 5 lens layouts
- PAIR-LAB-P2 `PairingLab.jsx` — lab shell wired as 4th lab
- PAIR-LAB-P3 Extras: bridge arcs, build-a-plate, two-ingredient mode, season-now, shuffle
- PAIR-LAB-P4 Polish

## Recipe-from-URL import (WEBLINK series)
The Cloud Function `scrapeRecipe` exists and works for schema.org recipes. Open:
- WEBLINK-1 Browser-realistic header set from the scrape fetcher; raise the fetch budget
- WEBLINK-2 Fall back to a reader proxy when the origin bot-blocks the fetch
- WEBLINK-3 Port microdata + HTML-heuristic ingredient extraction into the Cloud Function parser
- WEBLINK-6 Stop the matcher proposing shape/prep words as standalone ingredients
- WEBLINK-7 Matcher accuracy: generalize only to exact hits; decline when no entry exists
- WEBLINK-8 apple.news links: use a publisher URL if present, otherwise explain
- WEBLINK-13 Reject unit-only nouns; require modifier agreement on generic head words

## Performance
- PERF-LAZY-NETWORK Lazy-mount `LivingArchView` only when the Network tab is active (+ `React.lazy`)

## Cosmetic
- CK-4 Cocktail menu → chalk-textured background fill
- `src/components/guidedIcons.jsx:538` — dedicated icons for the 8 chef-only guided steps

## GNN / data-science (all measured dead-ends or unfunded — see `.claude/.chemdataset-status.md`)
- N2-GNN-CHEF-LIFT: chef-paced CSV expansion (10×+ odor labels vs DREAM)
- N2-GNN-LEFF: paywalled Leffingwell PMP-2001 ingest
- Graph augmentation (DropEdge / DropNode / GraphCL) for odor_spicy / odor_floral
- Encoder swap (ChemBERTa / MolFormer) — speculative
- Widening the 3D network universe from 3,390 to the 4,311 ingredients in `pairings.json`
- Do NOT retry: focal loss, DREAM olfaction ingest, SMILES-enumeration augmentation, umamiinfo.com scrape

## iOS / App Store — ARCHIVED, not backlog
- IOS-NATIVE-DEPLOY, WEBLINK-12 (native Google + Apple sign-in)
  Archived on branch `archive/ios`. See `CLOSEOUT.md` § "Why web-only".
