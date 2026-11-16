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

## Full dataset rebuild with the corrections in its inputs (2026-11-16, DATA-8; deferred option (c) of the data clean-up)
- DATA-REBUILD Re-run `proDataset` (`npm run all`: 01 to 19) so the generated ingredient and pairing files come out already clean, instead of being corrected on every load. The corrections are already in the pipeline's inputs (`proDataset/data/curation.json`, the alias entries in `synonyms.json`; steps 01, 05 and 07 read them) but nothing has been rebuilt, so the result is unproven.
  - Needs: the 2.3 GB RecipeNLG file (`proDataset/raw/recipenlg.csv`, ignored by git), FlavorDB / TheMealDB / TheCocktailDB fetched again (steps 02 to 04), about 110 MB of intermediates, and several hours.
  - Compare before trusting: ingredient count against the 3,674 the app loads today (the rebuild should land near it, not exactly: 01 normalises scores over the recipes left after hiding), pairings against 92,389, and every name in `public/proDataset/ingredients.json` that is not an alias or hidden against the new file.
  - Then regenerate everything keyed by ingredient name (about 30 files: `flavor_positions*.json`, `gnn_positions*.json`, `gnn_entropy*.json`, `gnn_compounds.json`, `pca_positions.json`, the cluster files, `compound_foods.json`, `everyday_pairs.json`, `pairings.bin`) and retrain or re-export the on-device set-completion and quantity models, whose vocabulary is the ingredient list. This is the part with real risk to suggestions; it also collides with the standing "no new model training" rule.
  - After it works, the app-side tables can shrink (an alias no longer needs applying on load once its variant is gone) but keep the drift test until they are empty.
  - Known contradictions already resolved in `synonyms.json` (12 entries re-pointed, listed in `docs/data-quality.md`) were pipeline entries that folded a name the curation keeps as its own ingredient (chicken breast, roma tomato, rye whiskey, pepper).
- DATA-LOWCOUNT About 140 ingredients are seen in fewer than five source recipes. Kept on purpose; pruning them is part of the rebuild above, not of the load-time layer.
- DATA-CODEX-PIPELINE The cocktail codex is built by `proDataset/cocktails_v2/scripts/09-emit-codex-v2.cjs` from a corpus that is not in the repository, so its corrections (`cocktailOverrides.json`) stay load-time only.

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

## Flavor graphs, left out on purpose (2026-11-15, CHART-7; on master, not deployed)
- CHART-COOKBOOK-WHEEL The Cookbook card radar (chef vocabulary, own axis switcher) and the ingredient panel were not moved onto the seventeen notes; they keep their own word lists and radars
- CHART-TAPPABLE-WEDGES Wedges on the wheel cannot be tapped for a note's detail; a screen reader gets the ranked list instead
- CHART-NOTEBOOK-DOTS The Recipe Notebook flavor map no longer plots each ingredient as a dot at its own flavor position (spec Decision 7, assistant's default; the owner has not ruled). Restoring it means a per-ingredient overlay on the fixed wheel, or putting the old radar back beside it
- CHART-INVENT-SENTENCE The cocktail Invent panel weighs the amounts it suggests itself, not a built-in recipe's own, so its tasting note can differ from the shared page's in notes beyond the lead. CHART-3 reported this as a risk without a measurement; the CHART-7 test shows Negroni's panel naming the same lead notes as the recipe, and the Beef Bolognese panel is identical when given the recipe's own amounts. Nothing here proves other recipes match
- CHART-SAUCE-CARD The Sauce suggestion card still draws two radars for one profile (not a before/after), unlike the add and swap cards
- CHART-PHONE The graphs were looked at in a desktop browser pane at 375 px and as rendered card images, never on a phone or through a live link preview

## Recipe pictures, left out on purpose (2026-11-16, PICTURE-5; on master, not deployed)
- PICTURE-LEFT-OUT Publishing original photos. Only the chalk drawing is ever stored or public; the original never leaves the device.
- PICTURE-AI-IMAGE An AI image model, and any paid key, for making the drawing. The filter is a free pixel filter in the browser.
- PICTURE-CROP Cropping beyond a centred square or 4:3 landscape.
- PICTURE-MANY More than one picture per recipe.
- PICTURE-BUILTIN Pictures on built-in recipes (they keep their dish or glass drawing).
- PICTURE-SMALL-ART Redrawing the chalk drawings so they read below 40 px; today no picture is drawn under 40 px (`MIN_PICTURE_SIZE`).
- PICTURE-SAVE-COPY Copying the picture when someone saves a recipe from a shared page; the saved copy has none.
- PICTURE-RELINK Changing the picture of an existing link; today the person unshares and shares again for a new link.
- PICTURE-CUTOUT Open owner decision: an automatic cut-out of the subject instead of the Focus oval. A trial page exists (https://claude.ai/artifact/D2APE3CRDfPAvHka3jdMz8, source `docs/prototypes/chalk-cutout-bench.html`); the owner has not judged it, and nothing in `src/` uses a model for it. If nothing is decided, Focus is the only background control.
- PICTURE-PHONE The picture work was looked at in a desktop browser pane at 375 px with a synthetic image, never with a phone camera, a real HEIC photo or Safari, and never against the real database or through a live link preview.

## Shopping list (2026-11-16, SHOP-1 to 5; on master, not deployed). Docs: `docs/shopping-list.md`

Left out on purpose:
- SHOP-NO-PRICES Prices, totals and budgets.
- SHOP-NO-STORES Choosing a store, and a per-store aisle order (the aisles are one fixed table, `AISLE_OF_CATEGORY` in `src/data/shoppingList.js`).
- SHOP-NO-ORDERING Online ordering or hand-off to a delivery service.
- SHOP-NO-BARCODE Barcode scanning.
- SHOP-NO-SHARING Sharing one list between people (the list belongs to one account; there is no link and no live co-editing).
- SHOP-NO-CONVERSION Converting between weight and volume (a cup of flour is not a fixed weight), and between metric and US (see decision 1).

OPEN OWNER DECISIONS (each one defined; the builder did not decide any of them):

- SHOP-OPEN-1 Should metric and US amounts be converted and summed?
  - What it is: today 200 g plus 8 oz stays "200 g + 8 oz" on one line, and 250 ml plus 1 cup stays "250 ml + 1 cup". The rule only adds units whose conversion is exact by definition (g with kg, ml with cl and l, tsp with tbsp and cup, oz with lb); 1 oz = 28.35 g is a rounded figure, so metric and US are never turned into each other (`src/data/shoppingList.js`, the merge-rule header; SHOP-1 spec said "both weights").
  - If nothing is decided: the list stays as it is. A cook who adds a cocktail in ml and a dish in oz of the same ingredient sees two parts on one line and has to add them in their head.
  - Options: (a) keep as is (exact, never wrong, sometimes two numbers); (b) convert US to metric (or the other way) with rounding and show the sum with a "about" marker, which is easier to read and can be off by a few percent; (c) convert only when the recipe itself carries both. Weight to volume stays out whatever is chosen.
  - Collides with: the earlier ruling that an ingredient is never listed twice (kept in every option, only the number display changes).
- SHOP-OPEN-2 Should the panel's "Add to shopping list" also add "Even better with" and "Nice to have"?
  - What it is: on a What do I need? panel, "Copy shopping list" copies the missing items and the optional ones, but "Add to shopping list" adds only the "You need" lines (`needs.missing`, `src/components/AddToShoppingList.jsx`), as the task said.
  - If nothing is decided: the two buttons on one panel give different lists.
  - Options: (a) keep the difference (the shopping list holds only what the recipe needs); (b) add the optional items too, as Copy does (the two agree, the list gets longer and the cook may buy extras); (c) add them unticked-by-default in a preview, which needs the panel to show a preview step it does not have today.
- SHOP-OPEN-3 Should "Add from a recipe" leave a dish's flavourings unticked so it agrees with the panel?
  - What it is: inside the list, the preview treats every line the cook lacks as needed, including a dish's "flavourings" (the Cookbook splits mains from flavourings); the panel adds only the mains' missing lines. So adding the same dish through the two doors gives different rows.
  - If nothing is decided: the list's door adds flavourings ticked; the panel's does not.
  - Options: (a) keep (more complete shopping, a longer list); (b) untick flavourings by default in the preview, so a tap adds them and the two doors agree on the default; (c) hide them behind "Include flavourings", like basics.
- SHOP-OPEN-4 Extend the stand-in tables.
  - What it is: only 58 ingredients have an alternative (45 food, 13 spirits). A row with none says "No stand-in I'd trust for X." These have none: garlic, ginger, eggs, flour, basil, cumin, butter, olive oil (their only swaps are for a supporting role, which a list row cannot tell), gin, vodka, every liqueur, vermouth, bitters, soda water; also baking powder and soda, chicken breast and thigh, mint, thyme, saffron, tomatoes, rice, potatoes, soy sauce, fish sauce, mustard, red wine.
  - If nothing is decided: nothing changes; the sheet is honest and short.
  - Options: (a) leave it; (b) add hand-written entries to `SWAPS` in `src/data/kitchenSwaps.js`, each one a reviewed line (this also improves the recipe-side swaps; cost: someone has to decide each pair, because a wrong stand-in is worse than none); (c) a numeric ratio on entries ("use three quarters as much"), which the code supports (`ratio`) but no table entry uses today.
  - Collides with: the rule that no stand-in is inferred from category ("no basil? use mint" passes a category test and is wrong).

Known gaps, not decisions:
- SHOP-SYNC-REAL Signed-in sync was tested with a mocked Firestore and the emulator rules, never on a real account.
- SHOP-PHONE Looked at in a desktop browser pane at 375 px only; no phone, no iOS clipboard, and the consent banner overlapping the list was not seen.
- SHOP-REMOVAL-RESURRECT Removing an item from a list on one device and not syncing for more than 30 days lets it come back (removal notes are dropped after 30 days).
- PROFILE-RESURRECT A cuisine, ingredient, favourite pairing, saved recipe, cocktail or sauce deleted on one device comes back from the other at sign-in: those lists merge as a union and carry no removal markers. Only the shopping list has tombstones. Ambiguous (a rule change), so not changed in SHOP-5.
