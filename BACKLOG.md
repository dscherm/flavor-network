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
- CHART-COOKBOOK-WHEEL CLOSED by WHEEL-2 for the Cookbook card (it draws the combined wheel from `profileForRecipe`); the 3D Network's `IngredientPanel` charts (TasteRadar, FullWheel, WedgeGridFlavorWheel, ProfileRadarCarousel and the `ProfileRadar` they use) were left out on purpose, because that view is parked, and keep their own word lists and radars. Also left: `radarKeys` in `flavorDisplay.js` no longer has a caller (its radar was deleted); it was kept because the generated functions layout and its tests carry it. `MakeRecipeCardsGrid` and `RecipeTypePills` were hosted only by the deleted `MakeRecipeView` and may now be unused (not checked)
- CHART-TAPPABLE-WEDGES Wedges on the wheel cannot be tapped for a note's detail; a screen reader gets the ranked list instead
- CHART-NOTEBOOK-DOTS CLOSED by BUILDER-5: the flavor map shows one mark per ingredient on the fixed wheel (`docs/flavor-profile.md` "Ingredient marks on the flavor map")
- CHART-INVENT-SENTENCE The cocktail Invent panel weighs the amounts it suggests itself, not a built-in recipe's own, so its tasting note can differ from the shared page's in notes beyond the lead. CHART-3 reported this as a risk without a measurement; the CHART-7 test shows Negroni's panel naming the same lead notes as the recipe, and the Beef Bolognese panel is identical when given the recipe's own amounts. Nothing here proves other recipes match
- CHART-SAUCE-CARD CLOSED by BUILDER-1: the Sauce suggestion card draws the same fixed grid as the add and swap cards
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
- PICTURE-CUTOUT Decided 2026-11-16 and built (PICTURE-8, on master, not deployed): a "Remove background" button in the picture chooser runs an on-device model (U2-Net small) and draws chalk only on the subject. The owner, asked three times which of three options they meant (add the automatic cut-out to the app, Focus only, or mark it yourself), answered "cut out trial." and then "continue with cutout tiral"; the assistant read that as: carry the automatic cut-out into the app, as a button the cook chooses to tap. Not decided and not built: "mark it yourself" (drag an oval or rub out) as a fallback when the automatic cut is poor. See `docs/pictures.md`.
- PICTURE-PHONE The picture work was looked at in a desktop browser pane at 375 px with a synthetic image, never with a phone camera, a real HEIC photo or Safari, and never against the real database or through a live link preview.

## Shopping list (2026-11-16, SHOP-1 to 5; on master, not deployed). Docs: `docs/shopping-list.md`

Left out on purpose:
- SHOP-NO-PRICES Prices, totals and budgets.
- SHOP-NO-STORES Choosing a store, and a per-store aisle order (the aisles are one fixed table, `AISLE_OF_CATEGORY` in `src/data/shoppingList.js`).
- SHOP-NO-ORDERING Online ordering or hand-off to a delivery service.
- SHOP-NO-BARCODE Barcode scanning.
- SHOP-NO-SHARING Sharing one list between people (the list belongs to one account; there is no link and no live co-editing).
- SHOP-NO-CONVERSION Converting between weight and volume (a cup of flour is not a fixed weight), (metric and US: done for display in SHOP-6).

OPEN OWNER DECISIONS (each one defined; the builder did not decide any of them):

- SHOP-OPEN-1 DECIDED 2026-11-16 (SHOP-6): metric and US amounts are summed for display, shown in US by default, with a US | Metric switch kept on the device. Owner: "add us amounts by default". What is stored stays exactly as entered; "about" shows only when the number on screen is not exact. Weight to volume stays out. See `docs/shopping-list.md`, "US and metric".
- SHOP-OPEN-2 DECIDED 2026-11-16 (SHOP-7): option (b). Owner: "Adds optional items." The panel's "Add to shopping list" adds what Copy shopping list copies ("You need", "Even better with", "Nice to have") and the summary counts the optional ones. Original question:
  - What it is: on a What do I need? panel, "Copy shopping list" copies the missing items and the optional ones, but "Add to shopping list" adds only the "You need" lines (`needs.missing`, `src/components/AddToShoppingList.jsx`), as the task said.
  - If nothing is decided: the two buttons on one panel give different lists.
  - Options: (a) keep the difference (the shopping list holds only what the recipe needs); (b) add the optional items too, as Copy does (the two agree, the list gets longer and the cook may buy extras); (c) add them unticked-by-default in a preview, which needs the panel to show a preview step it does not have today.
- SHOP-OPEN-3 DECIDED 2026-11-16 (SHOP-7): option (b). Owner: "flavourings start unticked." In Add from a recipe a dish's flavourings sit under "Flavourings, tap to add", unticked. Original question:
  - What it is: inside the list, the preview treats every line the cook lacks as needed, including a dish's "flavourings" (the Cookbook splits mains from flavourings); the panel adds only the mains' missing lines. So adding the same dish through the two doors gives different rows.
  - If nothing is decided: the list's door adds flavourings ticked; the panel's does not.
  - Options: (a) keep (more complete shopping, a longer list); (b) untick flavourings by default in the preview, so a tap adds them and the two doors agree on the default; (c) hide them behind "Include flavourings", like basics.
- SHOP-OPEN-4 DECIDED 2026-11-16 (STANDIN-1 to 3): option (b), with the ratio of (c) supported but unused. Owner: "DO stand ins." The table now holds four kinds of answer (use instead, another form, make it, nothing really replaces it) and 340 hand-written entries (food 214, bar 126, in `src/data/kitchenSwaps.js` and `src/data/barStandIns.js`), each one reviewable line in `docs/stand-ins.md`. Measured over the 602 built-in recipes: dishes 83.8% answered (72.6% with a real stand-in), sauces 83.6% (75.1%), cocktails 87.1% (69.3% real, 17.9% honest nones, about 30 lines of which are fizzy waters that are one ingredient). Left out, on purpose: ice, water and a salt solution (not shopping rows a stand-in helps with); garnishes (orange, cherry, maraschino cherry, olive, a wheel or a wedge); beer, peach schnapps, grape and apple juice and a long tail of single-use bottles and garnishes (each seen four times or fewer) for want of a swap that could be stood behind; generic words ("vegetable", "meat", "fruit"); butter, olive oil and cream in sauces (next entry). A `ratio` is supported but no entry uses one (amounts are written as notes). Original question:
  - What it is: only 58 ingredients had an alternative (45 food, 13 spirits). A row with none said "No stand-in I'd trust for X."
  - If nothing is decided: nothing changes; the sheet is honest and short.
  - Options: (a) leave it; (b) add hand-written entries, each one a reviewed line; (c) a numeric ratio on entries.
  - Collides with: the rule that no stand-in is inferred from category ("no basil? use mint" passes a category test and is wrong).
- STANDIN-SAUCE-FATS Butter, olive oil and cream in sauces have almost no answer on the sheet.
  - What it is: butter is 20 lines of the 77 built-in sauces, olive oil 14, cream 9, and the sheet says "No stand-in I'd trust" or offers nothing for them in a sauce. Their only table entries (butter and olive oil for each other, vegetable oil for butter, milk for cream) are flagged `sauce: false` or `supportingOnly`, because oil for butter is wrong in a beurre blanc and milk for cream splits in a sauce. A cook at the store who finds no butter for a sauce is told nothing.
  - If nothing is decided: those three stay unanswered for sauces (about 43 lines, 7% of sauce lines); dishes are unaffected (the pan swaps are offered where the ingredient is not the point). Existing tests pin the present answers: "a swap flagged sauce:false is dropped for a row from a sauce" (cream is milk only, nothing for a sauce), "a swap that holds only for a supporting item is not offered" (butter has no answer on a row with no recipe), and the Sauce Lab strictness test (a same-role-and-kind pair must not be `sauce:false`, which is why half and half cannot be a cream stand-in).
  - Options: (a) leave it (honest, short; costs a cook the help on the most common sauce ingredients); (b) add honest nones with reasons ("butter is the sauce: a beurre blanc and a pan sauce are butter; oil makes a different dish"), which answers the rows without offering a swap, and changes no existing test; (c) add real answers such as "ghee for butter" and "salted for unsalted, with the salt note" and "half and half for cream outside a sauce", each needing an existing test to be rewritten, because those tests were written to forbid exactly them; (d) loosen the strictness rule so a swap may be `sauce:false` while same-role-and-kind (a rule change in the Sauce Lab pantry, with its own consequences).
  - Collides with: the Sauce Lab's strictness rule (saucePantry.sameRoleAndKind); the rule that a wrong stand-in is worse than none.
- STANDIN-GIN-VODKA What the sheet says when the store has no gin or no vodka.
  - What it is: gin is 112 and vodka 64 of the 1809 built-in cocktail lines. The sheet now says nothing really replaces each ("juniper is what a gin drink is; vodka keeps the shape and drops the botanicals", and the reverse), the assistant's reading of the rule that a base spirit never crosses families. It is the one reason cocktails read 17.9% "none".
  - If nothing is decided: the answer stays an honest none for both.
  - Options: (a) keep the none (consistent with the family rule; a cook with no gin for a Negroni is told so); (b) vodka for gin with a strong note ("keeps the drink's shape and loses the botanicals: a Gimlet or a Martini made this way is its own drink, a Negroni is not a Negroni"), which is true for some drinks and wrong for others and would be offered for all of them; (c) the same, only when the drink is a Gimlet, Martini or Collins-style (needs the drink on the row, which a shopping row does not carry except through its recipe id).
  - Collides with: the family rule (a base spirit never crosses families, tested for the sheet and the builder's bar suggestion in My bar).

Known gaps, not decisions:
- SHOP-SYNC-REAL Signed-in sync was tested with a mocked Firestore and the emulator rules, never on a real account.
- SHOP-PHONE Looked at in a desktop browser pane at 375 px only; no phone, no iOS clipboard, and the consent banner overlapping the list was not seen.
- SHOP-REMOVAL-RESURRECT Removing an item from a list on one device and not syncing for more than 30 days lets it come back (removal notes are dropped after 30 days).

## One recipe builder (2026-11-16, BUILDER-1 to 5; on master, not deployed)
Retired with the paper Recipe Notebook (spec decision 4, assistant's default; any of them can be asked for back):
- BUILDER-RETIRED-SWIPE-DELETE Swipe-left to delete an ingredient row (the remove button stays).
- BUILDER-RETIRED-MATCH Per-row "match %" on the notebook's ingredient rows.
- BUILDER-RETIRED-FOCAL The "focal" flag on an ingredient and the Recenter button, with focal-weighted suggestion ranking.
- BUILDER-RETIRED-STARTER The starter-ingredients empty state (the builder's first question replaces it).
- BUILDER-RETIRED-SELECTION The Recipe Notebook no longer picks up the 3D Network's selected ingredients on its own; it opens empty or on whatever door handed it a recipe (the Network panel's "build recipe" still hands them over explicitly).
Left in place on purpose:
- BUILDER-ONWRITE `InventRecipe`'s optional `onWrite` prop ("Write it in the Recipe Notebook") has no caller since the builder IS the notebook; it stays because six test files exercise it and one asserts the tab host does not pass it. Remove it with those tests when someone wants the cleanup.
- BUILDER-SAVE-TWICE-COCKTAIL Saving the same cocktail or sauce twice with no picture and no id still adds a second copy (recipes already replace by name); the with-picture path now reuses the saved item with that name.
- BUILDER-ORPHANS Files only the deleted components used may now be unreferenced (for example some helpers in `src/data/` named in their comments); not audited.

## The app stops looking AI-made (2026-11-22, LOOK-1 to 7)
- LOOK-6 typefaces DECIDED by the owner, 2026-11-22: pairing B from docs/prototypes/type-specimens.html, "B: Kalam + Alegreya". Kalam for titles and hand-drawn moments; Alegreya Sans for body, ingredients, method, buttons and inputs. Recorded in design/DESIGN.md.
- LOOK-6 hand REVERTED by the owner, 2026-11-23: "go back to the previous font for the chalk handwriting (not Kalam)". Caveat stays the chalk hand (titles and drawn moments only); Alegreya Sans stays the steady face.
- LOOK-LOGO open: the name "Neural Flavor" and the atom logo read as a tech lab against the chalkboard kitchen. Options and costs are in the plan.md section header for LOOK-1 to 7. Nothing decided; LOOK-5 leaves both unchanged.
