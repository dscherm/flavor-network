# Fill My bar from a photo: accuracy test (BARPHOTO-1)

Run on 2026-11-14 with `node scripts/measureBarPhoto.mjs`. Written before any
of the feature is built. The numbers below were recomputed from
`.cache/bar-photos/results.json` and `.cache/kitchen-photos/results.json`
(both git-ignored), not copied from the spec; where they differ from the
spec or plan the difference is said.

## What the feature is, and why a test came first

In Cocktail Lab, My bar is the list of bottles you own; the app uses it to say
which cocktails you can make. Typing 20 bottles is the slow part. The planned
feature: tap "Add from a photo", photograph the shelf, a vision model lists
the bottles it can read, the user ticks the ones that are right, and only
then are they added to My bar. Nothing is added without that confirm tap.

A test came first because it puts a paid AI key on a public site for the
first time, and because a vision model that is right 60% of the time would be
worse than typing. The question was: on real photos, how many bottles does it
find, and how many of the ones it reports are right, measured at the level the
app cares about, which is the My bar name?

## Options considered

| Option | What it is | Why not / why |
|---|---|---|
| **Cloud vision model through a Cloud Function (chosen)** | Send the photo to Gemini 2.5 Flash (the model `src/api/recipeImport.js` already uses) and get a list back | Reads curved, stylised labels and brands in one call, many bottles per photo. Costs money per photo and needs a signed-in guard and a key kept on the server |
| On-device OCR | Read the label text in the browser, match against a brand table | Labels are curved, decorative and angled; OCR gives fragments. Needs a brand table we would have to build and keep. Not measured |
| On-device image model | A small classifier or detector in onnxruntime-web | Can find "a bottle" but cannot read which brand it is. Not measured |
| Barcode scan | Scan each bottle's barcode | One bottle at a time (the slow thing we are replacing), weak spirits coverage in free barcode data, and no barcode scanner in iOS Safari. Not measured |
| Brand-aware typing | Keep typing, but make the typeahead know brands ("Maker's Mark" gives bourbon) | Cheap and worth doing anyway, but it is not "fill from a photo". Partly covered by BARPHOTO-2 |

The three rejected image options were rejected on reasoning, not tested.
Only the cloud model was measured.

## Method

- **Model:** `gemini-2.5-flash`, thinking off (`thinkingBudget: 0`),
  temperature 0.1, JSON output with a response schema, `maxOutputTokens` 8192.
  Timeout 60 s per call; a 503 or 429 is retried up to 4 times, waiting
  8 s times the attempt number; a "per day" quota error is not retried.
- **Images:** the Commons photos were downloaded from the thumbnail URLs
  recorded in `SOURCES.json`, most of them 1920 px wide thumbnails (c05, c09
  and c10 are the unscaled originals). That is 1920 px, not the 1600 px the
  build task plans to use; I did not measure the files' pixel sizes. The
  owner's two photos are at full phone resolution (2.5 and 2.9 MB). File
  sizes are in the table below. Every bar call used 836 input tokens whatever
  the file size (the model's own image tiling), so file size did not change
  the input cost.
- **The bottle list:** the prompt carries a list of **89** bottle names, built
  by the script from the cocktail codex (`cocktail_codex_v2.json`): every key
  that `isBooze` accepts in any recipe, most used first. The model is told to
  copy one of them into `key`, or leave it empty when none fits. It also
  returns the label, a plain type ("london dry gin") and a confidence
  (high: label readable; medium: recognised, not readable; low: guessing).
- **From a detection to a My bar name:** the same code the app uses for typed
  entries. If the model's `key` is on the 89-name list it is used; otherwise
  `barKey(type)` from `src/data/myBar.js` is tried, and the result is kept
  only if `isBooze` accepts it. An empty result means "not a bar item" and
  the bottle is dropped. So a bottle can be read correctly off the label and
  still be lost here; that is failure mode (a).
- **Scoring:** the detections are collapsed to distinct bar keys (eight
  Scotch bottles are one `scotch`), and compared with the answer key, also
  collapsed to distinct keys through `barKey`. **Exact** means the same bar
  key. **Family** also accepts a base spirit of the same family (rye for
  bourbon), which is how My bar already covers a recipe line. "Found" is the
  share of answer-key entries the model reported; "right" is the share of
  reported keys that were in the answer key.

## The photos

15 bar photos in `.cache/bar-photos/`. **The photos are not committed**
(`.cache/` is git-ignored); the Commons ones can be re-downloaded from the
page URLs below, the owner's two are private.

| File | What it shows | KB | Scored |
|---|---|---|---|
| c01.jpg | Bar stock: shelf of liqueurs, vermouths, whisky | 601 | yes |
| c02.jpg | Gin bottles on a store shelf | 569 | yes |
| c03.jpg | Commercial bar wall | 564 | no (model answer failed to parse) |
| c04.jpg | Home liquor cabinet, mostly Scotch | 708 | yes |
| c05.jpg | Two shelves of liquor | 1278 | yes |
| c06.jpg | Commercial bar wall, very many bottles | 594 | no (model invented bottles) |
| c07.jpg | Home bar with tools | 558 | yes |
| c08.jpg | Cocktail ingredients on a bar | 341 | no (no readable bottles; the model returned none) |
| c09.jpg | Bar, one beer | 1733 | yes |
| c10.jpg | Cocktail ingredients, one vodka | 2220 | yes |
| c11.jpg | Bar cart of bourbons | 1347 | yes |
| c12.jpg | Cocktail ingredients, one bourbon | 556 | yes |
| c13.jpg | Row of bottles on a dim bar | 306 | yes |
| IMG_1835.jpeg | The owner's own home bar, dim, angled, cluttered | 2554 | yes |
| IMG_1836.jpeg | The owner's own home bar, second photo | 2871 | yes |

Commons photos (`SOURCES.json`):

| File | Title | Licence | Artist | Page |
|---|---|---|---|---|
| c01 | File:Barbestand.JPG | CC BY-SA 3.0 | 4028mdk09 | https://commons.wikimedia.org/wiki/File:Barbestand.JPG |
| c02 | File:Assorted gin bottles on a store shelf.jpg | CC BY 2.0 | Jon Worth | https://commons.wikimedia.org/wiki/File:Assorted_gin_bottles_on_a_store_shelf.jpg |
| c03 | File:Roberts Bar NOLA Bottles 1.jpg | CC BY 2.0 | Infrogmation of New Orleans | https://commons.wikimedia.org/wiki/File:Roberts_Bar_NOLA_Bottles_1.jpg |
| c04 | File:Liquor Cabinet (4233482692).jpg | CC BY 2.0 | xlibber | https://commons.wikimedia.org/wiki/File:Liquor_Cabinet_(4233482692).jpg |
| c05 | File:Two shelves full of liquor bottles (Portland, Oregon - 2014).jpg | CC BY-SA 3.0 | Visitor7 | https://commons.wikimedia.org/wiki/File:Two_shelves_full_of_liquor_bottles_(Portland,_Oregon_-_2014).jpg |
| c06 | File:Liquor Bottles on a Bar Wall.JPG | CC BY-SA 3.0 | DWS-Montag Zen | https://commons.wikimedia.org/wiki/File:Liquor_Bottles_on_a_Bar_Wall.JPG |
| c07 | File:Home bar example.jpg | CC BY-SA 4.0 | Bertram Kreuter | https://commons.wikimedia.org/wiki/File:Home_bar_example.jpg |
| c08 | File:Ingredientes de cocteleras, Bar Baltra.jpg | CC BY-SA 4.0 | Janramwill | https://commons.wikimedia.org/wiki/File:Ingredientes_de_cocteleras,_Bar_Baltra.jpg |
| c09 | File:Bar Kukigazi.jpg | CC BY-SA 4.0 | Arthur Nkunzimana | https://commons.wikimedia.org/wiki/File:Bar_Kukigazi.jpg |
| c10 | File:Vanilla pear cocktail ingredients Absolut vodka vanilla bean extract and glass (18495290910).jpg | CC BY 2.0 | Personal Creations | https://commons.wikimedia.org/wiki/File:Vanilla_pear_cocktail_ingredients_Absolut_vodka_vanilla_bean_extract_and_glass_(18495290910).jpg |
| c11 | File:A bar cart with a selection of different bourbon whiskeys.jpg | CC BY-SA 4.0 | Gatorfan252525 | https://commons.wikimedia.org/wiki/File:A_bar_cart_with_a_selection_of_different_bourbon_whiskeys.jpg |
| c12 | File:Amber Moon Ingredients.jpg | CC BY-SA 4.0 | Ms Brave | https://commons.wikimedia.org/wiki/File:Amber_Moon_Ingredients.jpg |
| c13 | File:DZ3 0679 A colorful row of liquor bottles lined up on a dimly lit bar ready for tonights drinks.jpg | CC BY-SA 4.0 | PattayaPatrol | https://commons.wikimedia.org/wiki/File:DZ3_0679_A_colorful_row_of_liquor_bottles_lined_up_on_a_dimly_lit_bar_ready_for_tonights_drinks.jpg |

The "what it shows" column is taken from the titles and from what the model
returned, not from a fresh look at every photo.

## The answer key, and its limits

`truth.json` lists, for each scored photo, the bottles that can be read.
**It was written by the AI assistant (Claude) from reading the labels in the
photos. It was not independently checked by a person.** Consequences:

- Some "wrong" results below may be a bottle that is really in the photo but
  was left out of the key (for instance Kahlua, sherry and Angostura bitters
  were reported in c01 and c07 but are not in the key; I did not go back to
  the photos to settle it).
- The key is entered as free text and passes through `barKey`, the same
  function under test, so it inherits `barKey`'s holes. The c13 key entry
  "jagermeister" became "amaro montenegro" (see failure mode (a)), so that
  miss is partly a naming artefact, not a vision miss.
- c03 and c06 are not scored: both are commercial bar walls, c03 because the
  answer failed to parse, c06 because the model padded the list with brands
  that are not in the photo, so no honest key could be written. c08 is not
  scored because no bottles are readable in it. That leaves **12 scored
  photos** (10 from Commons, 2 of the owner's).
- Scoring is by distinct bar key, so "73 bottles" means 73 distinct
  keys across the photos, not 73 physical bottles. c11 has 26 bottles
  reported and 5 keys.

## Results

Recomputed from `results.json`: the model, rows and totals match the spec and
the plan (12 photos, 73, 77%, 82%, 14 of 17); nothing differed.

| | Photos | Answer-key entries | Reported | Found (exact) | Right (exact) | Found (family) | Right (family) |
|---|---|---|---|---|---|---|---|
| **All scored** | 12 | 73 | 68 | 56 = **77%** | 56 of 68 = **82%** | 57 = 78% | 57 of 68 = 84% |
| Commons only | 10 | 56 | 53 | 42 = 75% | 42 of 53 = 79% | 43 = 77% | 43 of 53 = 81% |
| **Owner's bar** | 2 | 17 | 15 | 14 = **82%** | 14 of 15 = 93% | 14 | 14 of 15 |

(exact: 56/73 = 76.7%, 56/68 = 82.4%.)

Per photo (exact level):

| Photo | Key | Reported | Hit | Wrong | Missed |
|---|---|---|---|---|---|
| c01 | 17 | 15 | 10 | whisky, liqueur, sherry, kahlua, herbal liqueur | amaretto, canadian whisky, goldwasser, rosso antico, licor 43, amarula, blackcurrant (cassis) |
| c02 | 1 | 1 | 1 | none | none |
| c04 | 8 | 7 | 6 | amaro montenegro | averna, cointreau |
| c05 | 13 | 14 | 11 | anise liqueur, aperol, campari | pernod, strega |
| c07 | 3 | 3 | 2 | angostura bitters | gin |
| c09 | 1 | 1 | 1 | none | none |
| c10 | 1 | 1 | 1 | none | none |
| c11 | 5 | 5 | 5 | none | none |
| c12 | 1 | 1 | 1 | none | none |
| c13 | 6 | 5 | 4 | herbal liqueur | amaro montenegro (Jagermeister), vodka |
| IMG_1835 | 11 | 10 | 9 | herbal liqueur | genepy, rye |
| IMG_1836 | 6 | 5 | 5 | none | cointreau |

The owner's bar: **14 of 17**, nothing invented. The one "wrong" entry in
IMG_1835 ("herbal liqueur") is the Dolin Génépy bottle under a generic name,
so it is the same loss as the missed génépy, not an extra bottle. The three
misses were génépy (naming), and rye and Cointreau, which per the owner and
the spec were bottles hidden behind other bottles; I cannot check that from
the data files.

Not scored but run:
- **c06**: 62 bottles reported, 18 of them "high" confidence, the rest
  "medium" or "low". 2,694 output tokens.
- **c03**: the call took 31.2 s and failed with "Unexpected end of JSON
  input" (a cut-off answer). No answer or token count was saved.
- **c08**: 0 bottles, "other" lists a bitters bottle, spice jar, sugar bowl.

**Latency** (14 calls that returned): 1.2 to 6.7 s for 13 of them, median
3.2 s, plus the 15.3 s for c06 (the long list) and the 31.2 s failed c03.
The two phone-resolution photos took 4.4 and 4.6 s.

**Tokens**: 836 in for every bar call. Output: 25 to 1,245 for the 12 scored
photos (median 250, 459 on IMG_1835), 2,694 on c06.

**503 "high demand" on the first try:** the run log from the day recorded
5 of 13 first calls (13 Commons photos) answered 503 and a retry fixed 4
(the 5th is the c03 parse failure above, per the spec). This is not in
`results.json`, because the script retries without recording attempts and
keeps only the final answer, so I could not recompute it. Treat as reported,
not verified.

## Failure modes

**(a) Naming loses bottles.** The model read these correctly off the label,
and the bottle was lost or blurred between the label and My bar:

| Bottle on the label | What the model said | What My bar got |
|---|---|---|
| Disaronno (c01) | type "amaretto" | nothing (`isBooze` does not accept it) |
| Cassisée (c01) | "creme de cassis" | nothing |
| Licor 43 (c01) | "liqueur" | `liqueur` (generic) |
| Goldwasser (c01), Dolin Génépy (IMG_1835), Jagermeister (c13) | "herbal liqueur" | `herbal liqueur` (generic) |
| Averna Amaro Siciliano (c04) | "amaro", key empty | `amaro montenegro` (a different brand) |
| Pernod (c05) | "anise liqueur" | `anise liqueur` (generic) |
| Amarula, Strega (not reported at all) | not read | not read |

Typed entries have the same hole: the answer key line "jagermeister" itself
came out as `amaro montenegro`. Disaronno in c06 became `amaretto liqueur`
(non-empty, but not a name the cocktail list knows). This is the largest loss
and the cheapest to fix, because the labels were read.

**(b) Invention on very large shelves.** c06 (a back bar of very many
bottles): the first 18 entries are marked "high"; the spec records about 18
real labels. After those come about 31 "medium" entries that are the
famous-brand catalogue (Jack Daniel's, Jim Beam, Glenfiddich, Macallan,
Remy Martin, Midori, Chambord and so on) and then 13 "low" entries of the form "A bottle of
dark rum", "A bottle of light rum", "A bottle of tequila" ... "A bottle of
vermouth". Whether each medium one is in the photo I did not check; the pattern
(a complete list of generic types with no brand) is the tell. c03 (second bar
wall) produced a runaway answer that was cut off and did not parse. Nothing
in the prompt caps the length.

**(c) Hidden bottles are missed.** Rye and Cointreau on the owner's bar, per
the owner. Expected from one photo; handled by the guidance line and by
adding a second photo.

**(d) Transient 503s.** See above. A retry fixed 4 of the 5 reported; the
live function must retry.

**(e) One wrong brand at high confidence.** IMG_1835: the model reported
"Ron Zacapa Centenario 23" with high confidence; the owner says the bottle is
a Brugal 1888 (taken from the spec; `results.json` only shows the model's
answer). Both are rum, so the My bar entry (`rum`) was still right. A wrong
brand matters only where the brand decides the bar name.

Also seen: the answer key and the model sometimes disagree about
whisky families (Canadian Club mapped to `whisky`, the key says
`canadian whisky`). That is the naming layer again.

## Kitchen photos, first look

The same script with `--kitchen` (shared kitchen list, `kitchenKey`) was
run on the owner's 9 distinct kitchen photos (10 files; IMG_1842 is in
the folder twice). **3 ran before the free-tier daily quota ran out; 6 did not**
(IMG_1838 to IMG_1842, IMG_1845). So this is a first look, not a measurement:
there is no answer key and no score.

| Photo | What happened |
|---|---|
| IMG_1837 (spice rack) | 7 entries. 5 of 5 labelled lids read at "high" (curry powder, sage, basil, cinnamon powder, rosemary) plus 2 generic "medium" ones ("dried herbs", "ground spice"). 560 in, 316 out |
| IMG_1843 (blurred pantry shelf) | 8 entries. The photo is badly motion-blurred; the model still marked 4 entries (marinara, ketchup, spicy brown mustard, tomato sauce) "high". I did not check them against the shelf, but a label cannot be read in that image, so the confidence flag was not trustworthy. 560 in, 350 out |
| IMG_1844 (home pantry shelf) | 40 entries, exactly the cap the prompt states, 1,891 out. The first 22 are specific products with brands the shelf could plausibly hold. From "Trader Joe's Organic Tomato Paste" on, the last 18 are a uniform run of "Trader Joe's Organic" plus a generic pantry item (balsamic vinegar, mayonnaise, pickles, relish, soy sauce, teriyaki sauce, sesame oil, honey ...), all marked "high". I read that split from the output pattern and from the review done on the day; I did not check every item against the photo |

Naming breaks on packaged food, as it does for spirits:

| Product | Model's type | Kitchen key |
|---|---|---|
| Dalmatia Fig Chili Spread | fig chili spread | `chili` |
| Simple Mills Banana Muffin and Bread Mix | banana muffin mix | `banana` |
| Explore Organic Green Lentil Lasagne | green lentil lasagna | `green lentil` |
| Diced tomatoes with green chiles | (same) | `tomato` |

**Verdict: not ready to spec.** Spice racks work; a crowded pantry brings
invention and a flag (confidence) that does not separate real from invented;
six photos are untested. Needs a second run with a paid key.

## Cost per photo

The Gemini API key used here is on the **free tier**, which allows **20
requests per day** for `gemini-2.5-flash`; it was hit during the test (the
429 text is in the kitchen results, quota id
`GenerateRequestsPerDayPerProjectPerModel-FreeTier`, limit 20). The live
feature needs a **paid** key.

Price source: Google's Gemini API pricing page, https://ai.google.dev/gemini-api/docs/pricing
(it redirects to https://aistudio.google.com/docs/pricing), read on
**2026-11-14**. Gemini 2.5 Flash, paid tier, standard, per 1 million tokens:
**$0.30 input** (text, image and video; audio is $1.00), **$2.50 output**
(including thinking tokens; thinking is off here). The page shows no
effective date for the prices, and carries a notice that all requests to
`gemini-2.5-flash` will route automatically to Gemini 3.5 Flash-Lite, billed
at that model's rates, from **1 December 2026**. So the price below is the
current one and the model name in the build will need revisiting. I read only the first 100,000 of the page's 111,617 characters; the 2.5 Flash figures were in what I read.

| Case | Input tokens | Output tokens | Cost |
|---|---|---|---|
| Typical home shelf (IMG_1835) | 836 | 459 | 836 x $0.30/M + 459 x $2.50/M = $0.00025 + $0.00115 = **$0.0014** |
| Owner's smaller shelf (IMG_1836) | 836 | 258 | $0.0009 |
| Worst measured (c06, 62 entries) | 836 | 2,694 | $0.0070 |
| Kitchen pantry at the 40-entry cap (IMG_1844) | 560 | 1,891 | $0.0049 |
| Theoretical ceiling at the 8,192-token output cap | 836 | 8,192 | $0.0207 |

So a typical photo is about **0.14 US cents**; 1,000 typical photos cost about
$1.40; a user at the planned 10-photo daily cap is at most about 21 cents a
day even if every call hit the ceiling, and about 1.4 cents at typical size.
These are token-count arithmetic on the list price; I did not see a bill.

## Verdict, and what each build task does about it

Build it, with a mandatory review step. Reading labels works (on the six
densest photos about 80 of 86 reported labels were real, per the spec; I did
not recompute that). The 77% / 82% is mostly lost in naming, and very large
shelves need a cap.

| Failure mode | Task |
|---|---|
| (a) naming loses bottles | BARPHOTO-2: `isBooze` learns amaretto, creme de cassis and the other creme de liqueurs, cream liqueurs, genepy, aquavit; a generic answer ("liqueur", "herbal liqueur") keeps the bottle's own name; a plain `amaro` entry and a named amaro never maps to another brand (Averna, Jagermeister, typed or scanned); the bottle list and prompt gain these. Target on re-run: at least 88% found and 92% right, predictions written here before the re-run |
| (b) invention on large shelves | BARPHOTO-2 prompt: no unreadable bottles, no substituting a brand, at most 40 entries, output tokens capped; c03 and c06 must give no entry without a readable label and no parse failure. BARPHOTO-3 caps output |
| (c) hidden bottles | BARPHOTO-4: guidance line "One shelf at a time, labels facing you", and "Add another photo" |
| (d) 503s | BARPHOTO-3: retries 503/429 up to 3 times inside a 25 s budget, plain message when over |
| (e) wrong brand, and everything else | BARPHOTO-4: mandatory review list; "high" boxes ticked, "medium" and "low" unticked, the name editable, nothing added until "Add N to my bar" |
| Cost and abuse | BARPHOTO-3: signed-in only, per-user daily cap (default 10), key as a Functions secret. Open decision for the owner: a paid key on the live site |

## Script acceptance check: empty or missing folder

**Verified by reading the code, not by running it** (the worktree has no
`node_modules`). `node scripts/measureBarPhoto.mjs some-empty-or-missing-dir`:

- A missing folder: `existsSync(dir)` fails and it prints
  "No folder <path>. Put bar photos there (jpg, png, webp, heic)." and exits 1.
- A folder with no photos: prints "No photos in <path> (jpg, png, webp, heic)."
  and exits 1.
- No `truth.json`: `truth` stays `null`, photos are still run, and the end
  prints "No truth file (<path>); nothing scored." with no crash.
- Before either folder check, a missing `GEMINI_API_KEY` prints "GEMINI_API_KEY
  is not set. See .env.example." and exits 1, so without a key you get that
  message and not the folder one. Both are clear, neither is a stack trace.
- Not covered: a `truth.json` that is not valid JSON would throw a stack trace.
  That is not in the acceptance criterion, so I left the script unchanged.

I found no bug to fix in the script. It was untracked in the main checkout, so
it is added to the repo in this commit.

## How to re-run

```
node scripts/measureBarPhoto.mjs                 # bars, folder .cache/bar-photos
node scripts/measureBarPhoto.mjs --kitchen       # kitchen, folder .cache/kitchen-photos
node scripts/measureBarPhoto.mjs some-dir --json
node scripts/measureBarPhoto.mjs --fresh         # ask again for photos already answered
```

- Put the photos (jpg, png, webp, heic) in the folder and the answer key in
  `<folder>/truth.json`, shaped `{ "shelf1.jpg": ["bourbon", "campari"] }`.
  Entries are free text and go through `barKey` like a typed bar entry.
- Answers are saved in `<folder>/results.json` and reused; a second run asks
  only for new photos and ones that failed; scoring is always redone.
  `--fresh` re-asks everything and costs a request per photo.
- Needs `GEMINI_API_KEY` in `.env`. **The photos are sent to the Gemini API**;
  nothing else is uploaded. On the free tier the daily limit is 20 requests,
  so the 9-photo kitchen set plus the 15 bar photos cannot both finish in
  a day; the six unrun kitchen photos are the first thing to do with a paid key.
- `.cache/` is git-ignored; photos and results are never committed.

## BARPHOTO-2: bottle naming (written 2026-11-14)

**What changed.** `barKey`, `isBooze` (src/data/myBar.js) and `keyFor`
(scripts/measureBarPhoto.mjs):

- `isBooze` now accepts amaretto, every "creme de ..." liqueur, Amarula,
  genepy, aquavit, ouzo, pastis, arak, raki, limoncello, soju, baijiu,
  eau-de-vie, calvados, armagnac, slivovitz, kirsch and the named liqueurs with
  no generic word in their name (Licor 43, Disaronno, Drambuie, Galliano,
  Strega, St-Germain, Jagermeister, Goldwasser, Cynar, Averna, Fernet, Suze,
  Dubonnet, Pimm's, Grand Marnier, Midori, Chambord, Frangelico, Malibu,
  Southern Comfort ...). Same word-list style as before; NOT_BOOZE still wins
  for cherry, juice, syrup and the rest.
- Root cause of "averna became amaro montenegro": `ALIASES` in
  recipePairingMatch.js maps the bare word `amaro` (and `jagermeister`) to
  `amaro montenegro`, and `resolveIngredientName` falls back to the last word
  of a phrase, so "Averna Amaro Siciliano" resolved through the word "amaro".
  That alias is right for pairing data and for a bare "amaro", so it is left
  alone; `barKey` now refuses `amaro montenegro` for any text that is not
  "amaro" or does not say Montenegro, and a short list of named bottles
  (`namedBottle`) keeps its own key when the resolution was generic or the
  wrong brand ("Licor 43" was "liqueur", Goldwasser and genepy "herbal liqueur").
- `creme de cassis` was resolving to `blackcurrant` (a fruit, so it left the
  bar): `LIQUEUR_WORDS`, the existing guard for "sloe gin", now covers
  "creme de", limoncello, aquavit and Suze.
- A bar saved before this change still loads unchanged. One consequence: a
  recipe line "creme de cassis" used to be keyed `blackcurrant` and so was
  "covered" by a fresh blackcurrant; it is now keyed `creme de cassis`, which
  only a cassis bottle covers. Same for limoncello (was `lemon`).
- measureBarPhoto.mjs: stricter prompt (no unreadable bottles, never another
  brand's name as the key, `key` is "" when nothing fits, do not pad), no stated
  maximum in either prompt (the "At most 40" in the kitchen prompt acted as a
  target), truncation to 60 in code, `maxOutputTokens` 4096, the bottle list
  gains the new entries, and `keyFor` lets the label name a bottle when the
  model's key was generic or a different brand.

**Predictions, written before any re-score.** On the same 12 scored photos
(was 77% found / 82% right, from 73 truth bottles):

- Naming fix only, same cached model answers: about 85% found (62 of 73: the
  six bottles Disaronno, Licor 43, Cassisee, Goldwasser, Averna and Genepy
  become hits) and about 89% right (62 of about 70 reported). That reaches the
  "found" target roughly and falls short of 92% right, because what is left is
  not naming: Amarula and Strega were never read, Rosso Antico and Pernod come
  back as generic types, and a few bottles are still the model's family guess.
- Full re-run with the hardened prompts: 86 to 90% found, 90 to 93% right. I
  have no basis stronger than the prompt change for this, and it is not
  measured. The 88% / 92% target is therefore plausible only with the prompt
  changes, not from naming alone.

**Result: naming fix only, same model answers; prompt changes not yet
re-measured.** Offline: the 12 scored photos' cached answers
(`.cache/bar-photos/results.json`, gemini-2.5-flash, 73 truth bottles) were
re-mapped through the new `barKey` / `isBooze` / `keyFor` and re-scored against
`truth.json` (a throwaway script, not committed; no API call).

| | Found | Right (of what was reported) | Bottles reported |
|---|---|---|---|
| Before (cached, old naming) | 76.7% | 82.4% | 68 |
| After, exact | 86.3% (63 of 73) | 90.0% (63 of 70) | 70 |
| After, family match | 87.7% | 91.4% | 70 |

The prediction above (about 85% / 89%) was close; it was one bottle low.
Gained: Disaronno, Cassisee, Licor 43, Goldwasser (c01), Averna (c04), Genepy
(IMG_1835). Still missed, none of them naming: Amarula, Rosso Antico and
Strega (not read or only a generic type), Pernod ("anise liqueur"), Cointreau
in IMG_1836 and c04, rye in IMG_1835, gin in c07, vodka in c13, and the
Canadian whisky in c01 (reported as `whisky`). Wrong reports left: `kahlua`
and `sherry` in c01 (not in the answer key), `aperol` and `campari` in c05.

**Not verified.** The target (88% found, 92% right) is not met by naming
alone. The hardened prompts, the new bottle list, the 60-entry truncation and
the 4096-token cap have not been run: the Gemini API's daily quota is
exhausted today and no call was made. So the two commercial bar-wall photos
(c03: it failed to parse before, c06: it invented generic bottles) are NOT
yet verified, and neither is "no entry without a readable label". The re-run is
`node scripts/measureBarPhoto.mjs --fresh`.
