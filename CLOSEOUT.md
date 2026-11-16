# CLOSEOUT — Flavor Network v1.0.x

**Frozen 2026-09-01 at v1.0.0; live site currently serves v1.0.4.**
Everything after v1.0.0 is bug fixes, mobile polish and one security
hardening step — no features. Per-release detail below.

**Originally frozen 2026-09-01.** The web app at **https://neuralflavor.web.app** is the
finished product and the only distribution channel. This document is the
release note, the list of what is known not to work, and the map for anyone
who comes back to it — including future me.

Tag: `v1.0.0` · Bundle: `assets/index-DFFDS8PS.js` · Deployed: 2026-09-02 01:32 UTC (Firebase Hosting, 239 files)
Tag: `v1.0.1` · Bundle: `assets/index-BCzjul9s.js` · Deployed: 2026-09-02 10:25 UTC — landing/How-it-works copy now quotes the shipped counts (3,891 ingredients, 68,417 recipe-observed pairings). 
Tag: `v1.0.2` · Bundle: `assets/index-BHUdOK7y.js` · Deployed: 2026-09-02 22:05 UTC — Capacitor removed entirely; every scroll surface now stops above the fixed tab bar (the 'can't scroll to the bottom of a card' bug); Playwright playtest script added. 
Tag: `v1.0.3` · Bundle: `assets/index-D0QyKVkq.js` · Deployed: 2026-09-02 22:40 UTC — mobile polish pass (tinted cocktail/sauce cards, readable shelf counts, blank top band removed, radial pairing labels, radar labels inside the ring, one-row cookbook type filter, inactive labs unmounted from layout). Firebase browser API key now restricted to the site's origins (HTTP referrers). 
Tag: `v1.0.4` · Bundle: `assets/index-CAD-MjW6.js` · Deployed: 2026-09-02 23:05 UTC — vivid family-coloured cocktail/sauce cards (wash + glowing outline + family-coloured names); shelf labels rebuilt as fixed-size slanted chalk tags, spirits shelf swipes on phones.
Tag: `v1.1.0` · Bundle: `assets/index-DuoyXy0q.js` · Deployed: 2026-11-06 UTC — first post-freeze feature release (commit c1bac08): Cocktail/Sauce Lab search by ingredient; Cookbook 15 → 49 recipes, each with servings, time, amounts and method; shared `?path=` links open their screen; "goes well with" cocktails/sauces ranked by observed ingredient co-occurrence instead of the molecular aroma model (pairings.bin v2 carries the observed flag). 
Tag: `v1.1.1` · Bundle: `assets/index-epf1vbCr.js` · Deployed: 2026-11-06 UTC — match scores scale by how much of a drink's recipe resolves (the Bloody Mary that matched 35/49 dishes is gone); harness wiring repaired. 
Tag: `v1.2.0` · Bundle: `assets/index-Df3xIDxC.js` · Deployed: 2026-11-06 UTC — pairing matches re-ranked on the recipe co-occurrence score with hub discounts, a match floor and 'loose match' badges (measured on scripts/evalPairingMatch.mjs: namesake sauce first for 7/9, no cocktail in more than 14/83 top lists); pairings.bin v3; Cookbook 49 → 83 recipes with American + Mediterranean. 
Tag: `v1.3.0` · Bundle: `assets/index-B5WVEllV.js` · Deployed: 2026-11-06 UTC — Cocktail Lab: filter chips for occasion, season, strength, character, effort and glass (rule-derived, occasion tags not yet hand-checked); named sub-groups; normalised glass types; suggested '~' amounts for the 217 drinks with none; brand aliases. 
Tag: `v1.4.0` · Bundle: `assets/index-DaXfr6rc.js` · Deployed: 2026-11-07 UTC — Wine Lab: 53 hand-written wine styles, a sommelier-rule pairing engine (answer key: tuned top-3 31/42, held-out 10/16), wine list with search and colour chips, 'Matching wines' from Cookbook recipes and the Recipe Notebook. 
Tag: `v1.4.1` · Bundle: `assets/index-CpVsf59R.js` · Deployed: 2026-11-07 UTC — Wine Lab country of origin and region: country chips, region chips, group by country, origin on cards, search by country/region. 
Tag: `v1.5.0` · Bundle: `assets/index-JS-N-9b6.js` · Deployed: 2026-11-07 UTC — Cocktail Lab 'Riff on this': same-role swaps ranked by co-occurrence with the rest of the drink, and the closest existing cocktail after each change. (FoodOn synonyms and model-written aroma tags were measured and not shipped; see plan.md FOODON-1 / AROMA-1.) 
Tag: `v1.5.1` · Bundle: `assets/index-DxW-sJeL.js` · Deployed: 2026-11-07 UTC — The Flavor Bible data (copyrighted) removed from the app, the live site and the repository's entire history (all branches and tags rewritten and force-pushed); the curated 📖 layer is gone. Evaluation keeps a private local copy.
Tag: `v1.6.0` · Bundle: `assets/index-BOpQQISd.js` · Deployed: 2026-11-07 UTC — Cocktail Lab 'My bar' (what you can make from your shelf, a one-bottle-away list, same-family spirit swaps only) and 'Invent a cocktail' (house proportions per style, closest existing drinks shown). Wine Lab: aromatic off-dry whites for warm-spiced curries (tuned top-3 33/42, held-out 12/16); the wine card shows a flavour profile (structure radar, aroma families, food rules, avoid list) and critics' most-mentioned aromas from 130k Wine Enthusiast reviews (aggregates only, CC BY-NC-SA). Reviews: docs/wine-mapping-review.md, docs/design-review-2026-11.md.
Tag: `v1.6.1` · Bundle: `assets/index-TTGVCVZL.js` · Deployed: 2026-11-07 UTC — design quick wins (DESIGN-1): Cocktail Lab filters folded behind one Filters button, Pairing Lab ring fills the screen with non-overlapping labels, one chalk-glass loader for every lab, drawn country flags (Windows showed letters), larger chalk drawings on the Labs menu and Make screen.
Tag: `v1.7.0` · Bundle: `assets/index-DoykBnip.js` · Deployed: 2026-11-07 UTC — the bigger design-review items: a chalk glass per wine family (Wine Lab shelf, rows, card) and each drink drawn in its glass in My bar / Invent a cocktail (DESIGN-2); a chalk dish drawing on every Cookbook recipe and a picture-first recipe popup with the method folded (DESIGN-3); the Recipe Notebook as a paper page taped on the chalkboard with a three-ingredient starter (DESIGN-4); the landing logo redrawn in chalk as SVG with moving electrons, about half the phone screen (DESIGN-5).
Tag: `v1.7.1` · Bundle: `assets/index-CR_yqFCr.js` · Deployed: 2026-11-07 UTC — drawing fixes: tomato drawn as a tomato in the Recipe Notebook (common ingredients get a drawing by name; other vegetables broccoli); Patatas Bravas a small plate and Bánh Mì a baguette in the Cookbook.
Tag: `v1.8.0` · Bundle: `assets/index-cP0nUiPI.js` · Deployed: 2026-11-07 UTC — the app is only labs: the landing page lists them under the logo (Recipe, Cocktail, Sauce, Wine, Cookbook, Pairing) and "Make" became the Recipe Lab (KITCHEN-2: what's in my kitchen → Cookbook recipes you can make or are 1–2 away from, matches from 40k real recipes, Invent a recipe from the set-completion model; "From scratch" removed). Sauce Lab: My pantry and Invent a sauce on the same shared kitchen list (KITCHEN-3), proteins and wines per protein on every sauce card (SAUCE-PAIR-1). Wine engine: wine vinegar no longer counts as cooking wine (answer-key scores unchanged). Drawings: proteins (drumstick/steak/egg), light-blue cocktail and deep-red sauce icons.
Tag: `v1.9.0` · Bundle: `assets/index-B5N3N4yW.js` · Deployed: 2026-11-07 UTC — "What do I need?" on every Cookbook, sauce and cocktail card (KITCHEN-4); the bar is booze only, mixers live in the shared kitchen. Weak-spot fixes (docs/weak-spots-plan.md): everyday-pairs index for invent/kitchen features (WEAK-A, Cookbook pairs linked 29% → 68%); real-recipe index rebuilt with quality filters (WEAK-2, wrong methods 15.5% → 0%, title repeats 41% → 5%; cause was RecipeNLG data, not a join bug); amount model re-parsed with kitchen units and fractions (WEAK-4, 17/46 → 46/46 sensible); makeable by main ingredients, everyday swaps, spice rack (WEAK-3, 30-item kitchen 0 → 6 makeable); invented dishes 5–8 ingredients and varied (WEAK-5, 18 distinct dishes over 5 shuffles).
Tag: `v1.10.0` · Bundle: `assets/index-BzbUQtj3.js` · Deployed: 2026-11-07 UTC — dish stories and photos from Wikipedia lead every Cookbook, sauce, cocktail and wine card (STORIES-1): 79/83 recipes, 72/77 sauces, 177/439 cocktails, 52/53 wines have a story; 348 photos, all free-licensed on Wikimedia Commons with artist and licence credited, hotlinked (need a connection). Matches reviewed by hand (docs/dish-stories.md).
Tag: `v1.10.1` · Bundle: `assets/index-agIKzXGE.js` · Deployed: 2026-11-07 UTC — on phones with a notch, the Back/top buttons of every card and panel no longer sit under the status bar (MOBILE-SAFE-1, .safe-top-pad); Cocktail Menu gets an "Only what I have" pill switch that shows only drinks the bar + kitchen covers (COCKTAIL-BAR-2).
Tag: `v1.11.0` · Bundle: `assets/index-DN_sdgG5.js` · Deployed: 2026-11-07 UTC (hosting + `scrapeRecipe` function) — Apple News links resolve to the publisher's own recipe page via the publisher's site search, with a two-step title check (WEBLINK-17); America's Test Kitchen and NYT Cooking kept on (owner's go-ahead; they publish ingredients in public structured data). Unresolvable links get a fallback (recipe name, Find it on the web, paste a link, Open-in-Safari tip). `?import=<url>` share link starts an import (iOS Shortcut guide: docs/apple-news-shortcut.md). Known: People Inc. sites (Allrecipes, Serious Eats, Simply Recipes, Food & Wine, EatingWell, …) now refuse all automated fetches and opted out of the reader proxy, so pasted links from them fail too. Live site runs v1.11.0.

Tag: `v1.12.0` · Bundle: `assets/index-D-ZawPKM.js` · Deployed: 2026-11-14 UTC (hosting + Firestore rules; the `scanBar` function is NOT deployed yet, so invite codes do not work on the live site until its `GEMINI_API_KEY` secret is set and it is deployed; scanning with your own key does) — the three Invent panels now start from a baseline and let the cook build it: Invent a cocktail (pick a spirit and a style), Invent a sauce (pick a technique, optionally a protein) and Invent a recipe (pick a dish type, then a main) fill the required slots with the best-pairing picks, show every pick with an amount, and re-run the method, the "why" and the closest existing drink, sauce or recipe on each change; the finished-idea generators and Shuffle are gone. "✨ Invent this" on the Cocktail, Sauce and Cookbook search bars turns what was typed into the baseline, and an empty search offers it (INVENT-1..7). The Cookbook gained a search box (name and ingredient, comma = AND). Cocktail Lab My bar: "Add from a photo" lists the bottles it can read, the user ticks the right ones and only then are they added; the scan runs with the user's own free Gemini key from the browser, or with an invite code from the owner on the owner's key through the `scanBar` function (BARPHOTO-1..6; owner's rulings in docs/bar-photo.md). Bottle naming fixed (amaretto, crème de cassis, Licor 43, plain amaro and the like no longer drop out or become another brand). **The `scanBar` function, its Firestore rules and its secret are NOT deployed; a code does nothing until they are (docs/bar-scan-codes.md).** Open: (1) the accuracy figures after the naming and prompt changes are only a re-map of cached model answers (86% found, 90% right on 12 photos); a real re-measure needs the Gemini API (docs/bar-photo.md); (2) the owner's end-to-end check of the photo scan on a phone, own-key route and code route; (3) Google's pricing page says `gemini-2.5-flash` requests route to a newer Flash-Lite model from 2026-12-01, so accuracy should be re-measured after that date.

Tag: `v1.13.0` · Bundle: `assets/index-Bv5pslw-.js` · Deployed: 2026-11-15 UTC (hosting only; the `scanBar` function is still NOT deployed) — the three Invent panels start empty, so the v1.12.0 description above no longer matches what master does. Invent a cocktail asks "Which liquor?", Invent a sauce "What is it built on?" and Invent a recipe "What is the main ingredient?"; the list then holds only that answer and the cook adds every other ingredient, by typing or from suggestions, with no name or ingredient put in for them. A style (technique, kind of dish) is optional: with two or more ingredients one is recommended from the list and applied only on Accept, and once chosen a checklist shows what it usually has ("needed" or "optional" on parts not yet covered). Suggestions leave out catch-all names, a second base spirit, a second bitters and kitchen basics; an ingredient the cook does not have offers stand-ins; a flavor profile (a visual guide on weak per-ingredient data, not a taste test) is drawn from the list; the cook names the result and saves it to their account. Saved cocktails and sauces appear in their lab's list under "Yours" with Edit and Delete, and the Cookbook lists invented recipes. No deploy, version number or date is claimed for this entry.

Tag: `v1.14.0` · Bundle: `assets/index-CSPlAf6P.js` · Deployed: 2026-11-15 UTC (hosting, and the `scanBar` function) — the bottom bar's left button is now Home: it shows the starting page (the six lab tiles) over the running app, so a half-built drink, sauce or recipe is still there on return; the Recipe Lab is reached from its tile there or from the Labs menu. The `scanBar` function is deployed with its `GEMINI_API_KEY` secret set, so an invite code now works: checked by calling the live function, which refused a wrong code and read five bottles from a test photo with a valid one. It logs the status and Google's reason when the model call fails, never the photo. Bar photos re-measured with fresh model answers on 11 of the 12 scored photos: 81% of bottles found, 98% of reported bottles right (docs/bar-photo.md). Open: (1) the photo scan has not been tried through the My bar screen on the live site, own-key route or code route; (2) `c13.jpg` is unmeasured (free daily quota); (3) turning kitchen product names into kitchen items loses compound names ("chipotle aioli" becomes chipotle); (4) saving, editing and deleting an invented item has not been tried on the live site signed in.

UNRELEASED (working tree on master after v1.14.0; no version, no date, nothing deployed) — the flavor charts rebuilt, widened to eleven aromas and kept readable, and the ingredient data cleaned (FLAVOR-1 to FLAVOR-6, DATA-1 to DATA-5, AROMA-1 to AROMA-4). What a user would see:
- **Eleven aromas, and a second opinion (AROMA-1 to AROMA-4).** The aroma half of the chart now has eleven axes (fruity, floral, green, woody, spice, creamy, plus toasty, nutty, earthy, smoky and savory), so fish sauce, anchovy, coffee, nuts, mushrooms and smoked things have a real aroma instead of none. The aroma table was checked line by line against a second source (a chef-reviewed list plus an earlier AI labelling pass): agreement is 355 of 364 compared lines, every remaining disagreement is recorded with a reason. A blind answer key of 114 items written before the table was read scores 106 of 114 (34 of 38 on the third held back from tuning); an outside key of 304 chef-reviewed ingredients scores 161 of 304 with 122 having no table line. Taste numbers did not move (36 of 41, hold-out 19 of 20). The tables are an AI assistant's judgement; no cook has reviewed them (`docs/flavor-profile.md`, "Aromas, second pass").
- **Charts show at most the strongest bars (interim rule).** With six tastes and eleven aromas a chart could have seventeen bars, so every chart now shows two groups headed Taste and Aroma, each strongest first, above a floor: 3 + 3 on share cards, 4 + 4 on the invent panels and the shared page, 6 + 6 on the Recipe Notebook, with "+N fainter notes" and "show all" where there is room, and radars that plot only those axes. Ties break the same way on every surface. A real redesign is still to come (CHART-1). Two things to know: BBQ sauce shows no smoke, and Thai peanut sauce ranks nutty third (`docs/flavor-profile.md`).
- **Flavor charts mean something now.** Every chart (Recipe Notebook Flavor Profiles, the three Invent panels, the shared recipe page, the share pictures and link previews) is built from a taste label and aroma notes for each ingredient, weighted by how much of it the recipe uses. It no longer averages the model's per-ingredient numbers, which gave one identical row to half the ingredients (a Negroni used to chart sweet, then sour). On the test recipes it now leads with the right taste on 36 of 41 (up from 20), and on 19 of 20 held-back recipes; the aroma half reads right on 30 of 30 tuned and 9 of 10 held-back. It is a guide, not a taste test, and says so in plain words wherever it is drawn. The labels, strengths and aroma lines are hand-written judgement by an AI assistant, not checked by a professional (`docs/flavor-profile.md`, "Where the charts stand").
- **Six tastes, with Heat.** The chart has sweet, sour, bitter, salty, umami and heat, plus eleven aromas (fruity, floral, green, woody, spice, creamy, toasty, nutty, earthy, smoky, savory). A dash of bitters no longer weighs as much as two ounces of gin; a salt rim, a twist or a sprig in a drink's garnish counts. Kilograms are read as kilograms.
- **Public charts are back** on the shared page and the cards (`SHARE_CHARTS_ENABLED`, hidden 2026-11-15 and switched on again here, still a one-line switch). The shared page downloads only the small label file (about 20 KB compressed) for its chart, not the 1.4 MB model file.
- **Ingredient list cleaned:** 3,891 ingredients in the generated data are now 3,674 as the app loads them (216 spelling and preparation variants merged into their plain name, 29 non-food entries hidden, 28 bar and mixer entries added), with 123 branded or packaged items kept findable by typing but never suggested. Every ingredient has one category from a single scheme (the old `umami` category is now `savory seasoning`), and taste labels have ten words (neutral and rich added; starches, plain fats and spirits no longer read as sweet).
- Not user-visible: the placeholder detection from FLAVOR-2 was removed because nothing reads the model's values for a recipe chart any more; the fallback that matches a recipe to cocktails and sauces by aroma now uses the new aroma profile.
- To deploy: hosting, plus the `sharePreview` and `shareCard` functions (their share index, card bars and card layout changed; the card layout now shows Taste and Aroma groups). `firestore.rules` unchanged. Not deployed.

## What v1.0.0 is

A browser app for cooks: 3,891 ingredients, 95,992 scored pairings
(68,417 observed in 2.2 M recipes, 27,575 model-predicted), 441 cocktails in six *Cocktail Codex*
families, 77 sauces in ten mother families, an on-device set-completion
model that proposes the next ingredient, and a molecular taste/odor model
that explains *why*. Four labs plus a make-a-recipe flow and a cookbook,
with optional Google/Apple sign-in to sync it. The README describes the
architecture; this file describes the state.

## Why web-only

An iOS build (Capacitor + Xcode + Codemagic + App Store listing) was
carried most of the way — signing worked, native Google/Apple sign-in was
wired and unit-tested — but the last mile needs a Mac, a device, and
App Store Connect access to verify, none of which this project has on
hand, and App Store review is an open-ended maintenance commitment for a
frozen app. The web app already installs to a phone home screen
(manifest + icons; see below), which is the "app" experience without the
store. Everything iOS lives on branch **`archive/ios`** at commit
`5a17cc2`: `ios/`, `capacitor.config.json`, `codemagic.yaml`,
`app-store-listing.md`, the two iOS skills. No Apple signing keys were
ever committed (verified: no `.p8`/`.p12`/`.mobileprovision` in history or
on disk). v1.0.2 then removed the `@capacitor/*` packages and every
`isNativePlatform()` branch from `src/` as well — the web build has no
native code paths left; haptics go through `navigator.vibrate`.

## What changed at the closeout

Twenty-one closeout commits (plus five pre-existing harness commits that
had never been pushed) between the last feature deploy (2026-08-02) and the
tag. No features. In order of consequence:

1. **The gate is an honest green.** It had been red since Aug 2 (a jsdom
   `scrollIntoView` unhandled error), masked by an exit-code bug in the
   check itself; it ran only `src/` (skipping 21 tests); and a fresh clone
   on Windows failed on CRLF + shebang. Now: `.gitattributes` forces LF,
   `npm run gate` runs the whole configured suite plus the build (131 files /
   1,427 tests as of v1.0.4; it was 132/1,440 before the Capacitor removal
   deleted the native-auth test file), and it
   no longer depends on the agent harness being present.
2. **One live bug fixed.** PDF/photo recipe import in the Profile panel
   posted to a dev-only endpoint and failed with a null-JSON error on the
   live site; it is now hidden outside `npm run dev` with a note.
3. **Deploy halved.** 64 dataset snapshot files (`*.bak`, `*.pregnn`,
   256 MB) were being uploaded to and served from the CDN. Deleted and
   excluded in `firebase.json`; `dist/` is ~223 MB.
4. **Repo a stranger can read.** ~1,300 tracked files of agent harness
   state, screenshots, logs, stale worktrees, phantom submodule entries,
   duplicate dataset copies and dead test scripts untracked or deleted;
   planning docs moved to `docs/archive/`; README rewritten; MIT LICENSE
   added; privacy policy re-scoped to the web app.
5. **Installable.** `manifest.webmanifest` + icons + apple-touch-icon.
   No service worker — on purpose. A cached shell that outlives a deploy
   is exactly the failure class that cost a session in August, and a
   frozen app gains nothing from offline launch that justifies it.

## Known limitations (not bugs to fix — the shape of the thing)

- **PDF/photo recipe import is dev-only.** It needs the Express API and a
  Gemini key (`npm run api`). Recipe-by-URL works on the live site via the
  Cloud Function. (The My bar photo scan is a different feature and needs no
  server of ours when the user brings their own key; see the v1.12.0 entry.)
- **The molecular model is weak per-ingredient.** Compound-level taste/odor
  F1 looks good but does not survive aggregation to ingredients (chef-set
  AUROC ≈ 0.5). It drives radar charts and explanations; pairing strength
  comes from recipe co-occurrence. `.claude/.chemdataset-status.md` has the
  numbers and the experiments not to repeat (focal loss, DREAM olfaction,
  SMILES enumeration).
- **The 3D Network view is parked.** Reachable at `?path=explore`, not
  linked from the UI. 3,863 of 3,891 ingredients have layout positions;
  ~70 compound foods (mayonnaise, vinaigrette) have no molecular profile.
- **Salty and spicy heads are never surfaced** — structurally limited
  (ionic / TRPV1 mechanisms, not molecular structure).
- **`firebase.json` cache headers rely on `no-cache` for `index.html`**, so
  a deploy shows up within about a minute; a hard refresh may still be
  needed once.
- **Public data is large.** `public/` is ~220 MB and every byte of it is
  committed; the git clone is ~450 MB. History was deliberately not
  rewritten.
- **The Firebase browser API key is referrer-restricted** (v1.0.3) to
  `neuralflavor.web.app`, `neuralflavor.firebaseapp.com`, `localhost:5173`,
  `localhost:4173`, `127.0.0.1:5173`. A new dev port or domain must be added
  in Cloud Console → Credentials → "Browser key" before auth works there.
- **Auth configuration lives in consoles, not the repo.** Changing
  `authDomain` or adding a provider without registering the redirect URI
  first breaks sign-in for every user (it happened once); read
  `.claude/skills/firebase-auth/SKILL.md` before touching it.
- **One intermittent test failure, unresolved.** Two cases in
  `src/__tests__/App.handoff.test.jsx` (the ADR-2 "matchesContext clears on
  tab leave" pair) failed twice during `npm run gate` on a clean clone while
  the machine was running other builds, and passed on every one of nine
  deliberate re-runs afterwards — including four with `--sequence.shuffle`
  and one under induced CPU contention. Not reproduced on demand, so not
  fixed and not diagnosed. What is known: the failing assertions are the
  `toBeNull()` ones while the `not.toBeNull()` guards in the same tests pass,
  which is the signature of the pill callback never being wired up for that
  run (`undefined` satisfies `not.toBeNull()`). Those guards now assert the
  object shape instead, so a recurrence fails at the true point with a
  legible message. If you see it, capture the full vitest output — the gate
  script truncates stderr to the last 1500 characters, which is why the
  original failures were never diagnosable.

## If you return — start here

1. `git clone` → `npm ci` → `npm run gate`. Green on a clean clone at the
   tag (Node 24, Windows and the CRLF trap accounted for) — with one known
   exception, below. If it isn't green, fix that before anything else; do
   not trust a build whose gate you haven't seen pass.
2. `npm run dev`, open http://localhost:5173, sign in, save a recipe, open
   the Cookbook. That exercises Firestore, Auth and the cookbook path that
   was the last bug fixed before the freeze.
3. Read `BACKLOG.md` for what was deliberately not built, and
   `docs/archive/RALPH-SPEC-flavor-profiles.md` for the largest un-built
   spec. The `.omc`/`.schermness` state dirs and `.claude/.ralph-*.md` are
   regenerated by the agent harness and are gitignored; `ralph.sh`,
   `plan.md`, `activity.md`, `public_api.md` and `lessons/` are kept so the
   project stays enrollable in that harness. They are inert otherwise.
4. Deploy is `npm run gate && firebase deploy --only hosting`. Functions
   and Firestore rules deploy separately; see README.
5. Datasets: nothing needs regenerating to run or deploy. The pipelines
   and their raw inputs (RecipeNLG CSV from Kaggle, FooDB dump) are
   documented in the README; `proDataset/raw/` and `chemDataset/raw/` are
   gitignored and can be deleted locally (~7 GB) without losing anything
   the app needs.

## Process notes worth keeping

Three things that were true at the end and would have been cheaper to
know at the start:

- *A check that cannot fail is not evidence.* The gate was green for a
  month while broken, because `npm run build | tail -1` reports `tail`'s
  exit code. Every "verified" between Aug 2 and the closeout was a manual
  browser check, not the gate.
- *Read the live state before theorising.* The cookbook bug
  (`userProfile.recipes` vs `userProfile.profile.recipes`) was found in a
  minute by reading props in the running app after two rounds of
  reasoning about the plumbing had produced a plausible, wrong fix.
- *Scoped runners shrink silently.* `vitest run src/` looked complete and
  omitted a directory; `tests/` looked like a suite and was never run by
  anything. The unscoped run and the include globs are the only truth.

Tag: `v1.15.0` · Bundle: `assets/index-DIxE4uPN.js` · Deployed: 2026-11-15 UTC (hosting, the `sharePreview` and `shareCard` functions, and Firestore rules, together) — checked live after deploy: `/r/cocktail/negroni` serves the recipe's title, description and card address in its preview tags and renders the whole recipe signed out; `/r-img/cocktail/negroni.png` is a 1200x630 PNG; an unknown link shows "This recipe is no longer shared" and gets the generic preview and card. **Flavor charts are hidden on shared pages and on every share card (SHARE-8)**: after FLAVOR-2 stopped charts being drawn from placeholder numbers (1,526 of 3,432 ingredients carried one identical taste vector), the charts that remained were still mostly wrong on the 41-recipe test set, so the owner chose to deploy without them; `SHARE_CHARTS_ENABLED` in `src/data/shareTargets.js` turns them back on when FLAVOR-6 lands (docs/flavor-profile.md). Inside the app, a chart is now drawn only when at least half of a recipe's ingredients, and at least two, have real values (186 of 599 built-in recipes). NOT verified on the live site: real sign-in and save from a shared page, publishing and unsharing a user's own recipe, sending a report, the console takedown, previews as real social sites and messaging apps show them, and sharing card images into Instagram or TikTok from a phone. Also on master, not user-visible: a flavor test set and scorer (`npm run measure:flavor`) and a data audit (`npm run audit:data`, docs/data-quality.md). What follows describes the feature: sharing a recipe on social media (SHARE-1..7). Every cocktail, sauce and dish has a Share button that offers a link (`/r/<kind>/<slug>`), the phone's share sheet, X, Facebook, Pinterest and WhatsApp, and picture cards for Instagram and TikTok (1080x1350 feed, 1080x1920 story, one card or a set of three) drawn in the browser. A link opens the whole recipe signed out; pasting it into a chat shows a preview card made by two new Cloud Functions, `sharePreview` and `shareCard`, with an invitation to create a free account and a Save that completes after sign-in. A cook can publish a recipe they made as a frozen public copy (`/r/<id>`, stored in Firestore `shared`) after a step that shows exactly what becomes public, with no name shown unless they pick one; they unshare from Profile, "Shared links". Pages for those copies have a Report link (reason and optional note, written to `shareReports`, no reporter identity, 3 per browser per day as a courtesy); the site owner removes a copy by setting `removed` to true in the Firebase console (docs/sharing.md). Nothing about visitors is counted. **Not deployed:** hosting, the two functions and `firestore.rules` must go out together (command in docs/sharing.md); nothing should be deployed before FLAVOR-2, because many flavor charts on cards are drawn from placeholder numbers. Not verified: live link previews, real sign-in, real Firestore writes, a real phone (`.schermness/reports/SHARE-7.md`).
