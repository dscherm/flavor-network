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

## Invent redesign and My bar from a photo (2026-11-14, on master, not deployed)
- BARPHOTO-DEPLOY Deploy `scanBar`, its Firestore rules and the `GEMINI_API_KEY` secret, and create invite codes (`docs/bar-scan-codes.md`); until then only the own-key route works
- BARPHOTO-REMEASURE Re-run the bar-photo accuracy test against the Gemini API with the new naming and prompt (only a cached-answer re-map exists, `docs/bar-photo.md`); repeat after 2026-12-01, when Google's pricing page routes `gemini-2.5-flash` to a newer Flash-Lite model
- BARPHOTO-E2E Owner's end-to-end check on a phone: own-key scan and code scan, review list, adding to My bar
- INVENT-E2E Owner's check at 375px: bourbon Boozy Sipper written to the Notebook, an Emulsion with chicken, a Stir-fry with tofu, and "✨ Invent this" from each of the three searches
- INVENT-RECIPE-EDIT Saved recipes have no Edit in the Cookbook (cocktails and sauces can be edited from their lab's list; recipes can only be deleted or reopened by inventing again)
- INVENT-DELETE-SYNC A delete on one device can come back from another until it is deleted there too, because the profile merge is a union of saved items
- INVENT-PROFILE-DATA The Invent flavor profile rests on weak per-ingredient data (`.claude/.chemdataset-status.md`, correction banner); the summary is deliberately modest and names an ingredient only when its own score on an axis is at least 0.6

## Sharing, parked after SHARE-7 (2026-11-15, on master, not deployed)
- SHARE-VIDEO A short video for TikTok and Reels (browsers do not all record MP4; test on real phones first)
- SHARE-QR A QR code on the share cards
- SHARE-DOMAIN A custom short domain for share links
- SHARE-COUNTERS View and save counters on shared links (open decision 1 in docs/sharing.md; today nothing is counted)
- SHARE-REPORT-EMAIL Email the owner when a report arrives (open decision 2; today reports are read by hand in the console)
- SHARE-LINK-CAP A per-link daily cap that serves the plain preview after a limit (open decision 3; today caching only)

## Aromas, picked up later (2026-11-16, AROMA-4; on master, not deployed)
- AROMA-SECOND-SOURCE Use the second source for ingredients that have no line in the aroma table. `public/proDataset/flavor_profiles_distilled.json` has aroma words for 3,927 ingredients (304 chef-reviewed, 3,623 from an earlier AI pass); the table (`src/data/flavorAromas.js`) has 410 lines. 122 of the 304 chef-reviewed ingredients have no table line (the chef key prints "no aroma data 122"), and roughly 3,000 of the others have none. Map the words to the eleven axes with `src/data/aromaWordMap.js` (the same map `checkAromaAgreement.mjs` uses) and give each a default strength (say 1 on the 0..3 scale, 0.5 for words that map to two axes), clearly marked lower confidence: a separate fallback table or a flag on the line, never mixed into the hand-tuned lines, and the chart should say "from a second source" or leave them out of the draw rule's counts. Check first: how many currently-uncounted ingredients in real recipes this would reach (run the measure on the 599 built-in recipes with and without), and that the blind and chef keys do not move on the hand-tuned lines. Words with no axis (alliaceous, marine, pungent) need a decision; "meaty" and "fermented" map to savory.
- AROMA-COOKING Aromas created by cooking, and spices that perfume a dish beyond their weight. Today an aroma comes only from the ingredient names and amounts. A seared steak, roasted vegetables, grilled corn, a browned-butter sauce, toasted spices, a smoked fish and a caramelised onion all gain toasty, nutty or smoky notes from the method, not the ingredient. Read the method text (steps and verbs: sear, roast, grill, char, smoke, brown, toast, caramelise, deep-fry) or the structured method where there is one (`src/data/cookingMethods.js`, `retrieveCookingMethods` already infers a likely method for the Flavor Profiles card) and add a small, capped boost to toasty / smoky / nutty for the ingredients it applies to (a fat or a protein or a sugar; not a leaf). Separately, a few whole or ground spices (cinnamon, star anise, clove, cardamom, cumin) flavour a whole pot at a few grams: add a per-ingredient "carries" factor so the weight-by-amount rule does not bury them. These are the pho and baklava misses (little spice) and beurre noisette (browning). Test with the existing keys plus a new small key of dishes whose defining aroma is made by cooking; do not tune against the held-back third of the blind key.
- CHART-1 (in plan.md) Explore, with the owner, how the flavor graphs should change for six tastes and eleven aromas; AROMA-4's rule (`src/data/flavorDisplay.js`) is only an interim.
