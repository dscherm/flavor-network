# Dish stories and photos from Wikipedia (STORIES-1)

Cards in the Cookbook, Sauce Lab, Cocktail Lab and Wine Lab carry a short
"About this dish / sauce / drink / wine" section: one or two sentences from the
English Wikipedia article and the article's lead photo when that photo is
freely licensed on Wikimedia Commons.

- Build: `node scripts/build_dish_stories.mjs` (add `--review` to print the match table)
- Output: `public/data/dish_stories.json`
- Overrides: `scripts/dish_story_overrides.json` (item → article title, or `null` to skip)
- Rules: `src/data/dishStoryMatch.js` (pure, unit-tested on fixtures)
- Loader: `src/data/dishStories.js` · Card section: `src/components/DishStory.jsx`

## Checks, written before building

Predictions written before the first fetch.

| # | Check | How | Prediction |
|---|---|---|---|
| a | Coverage: share of items with a story and with a photo | `_meta.counts`, printed by the build | recipes 85% story / 75% photo · sauces 80% / 65% · cocktails 35% / 28% · wines 85% / 60% |
| b | Every shipped photo has a free licence and a recorded artist | `src/data/__tests__/dishStoriesData.test.js` over the JSON | 100% (the build refuses anything else) |
| c | No disambiguation or non-food pages | same test over title + description + text, plus the by-eye review below | 0 bad pages after review; expect the rules alone to let through a handful (wrong-sense food pages, parent-cocktail redirects) |
| d | Cards render with and without a story | `src/components/__tests__/DishStory.test.jsx` | — |

## Results

### (a) Coverage — predicted vs actual

| Kind | Items | Story (predicted) | Story (actual) | Photo (predicted) | Photo (actual) |
|---|---|---|---|---|---|
| Cookbook recipes | 83 | 85% | **79 (95%)** | 75% | **78 (94%)** |
| Sauces | 77 | 80% | **72 (94%)** | 65% | **66 (86%)** |
| Cocktails (unique names) | 439 | 35% | **177 (40%)** | 28% | **163 (37%)** |
| Wine styles | 53 | 85% | **52 (98%)** | 60% | **41 (77%)** |

Recipes and sauces beat the prediction because the overrides map name variants
("Beef Pho", "Lamb Biryani") to the dish article. The rules alone reached
recipes 53% / sauces 77% on the first run. Cocktails came out about as
predicted: the IBA classics match, and the house riffs and TheCocktailDB
novelty names do not. The 441 codex rows contain 2 duplicate names, so there
are 439 keys. Wine photos fall short of stories because many wine-region
articles lead with a map (an SVG, or a PNG map dropped by eye) and the grape
articles lead with grapes, not wine.

`public/data/dish_stories.json` is **271 KB** (budget 1 MB). The first build
made 1,390 requests at ~1/s. Re-runs make 0 (cache in `.cache/dish-stories/`,
gitignored), and output is byte-identical when nothing changed.

### (b) Licences — 100%

`src/data/__tests__/dishStoriesData.test.js` checks every one of the 348
shipped photos for: a free licence (CC0 / public domain / CC BY / CC BY-SA, no
NC/ND), a non-empty artist with no HTML, a Commons file page, and an
`upload.wikimedia.org/wikipedia/commons/` URL no wider than the 500px bucket.

The build refused these photos:

- **Licence not on the list:** GFDL 1.2 (Horse's Neck), "Copyrighted free use"
  (Assyrtiko), KOGL Type 1 (Gochujang).
- **Hosted on enwiki rather than Commons:** the files enwiki keeps for itself,
  usually non-free.
- **No real author:** "Unknown author", "Own work" in any language, e.g. Fino
  sherry's "trabajo propio", Ti' Punch, Sancerre, Sauternes.
- **SVG:** maps and diagrams.

### (c) No disambiguation or non-food pages

The same test asserts, for every entry, that the title and description are not
a disambiguation page and that description + text pass the food test. The
by-eye review below caught what the rules alone let through. Each was fixed by
a rule (with a unit test) or an override:

| Caught on review | Fix |
|---|---|
| Mac and Cheese → *Mac & Cheese 3* (album); Chocolate Chip Cookies → 1996 album | rule: the page's own title is no evidence; album/film/song/… descriptions rejected |
| Loch Lomond → a whisky distillery | rule: distillery/brewery descriptions rejected; override null |
| Honey Bee → *Honey bee starvation* | override null |
| Makhani (Butter Chicken) → *Dal makhani* | override → Butter chicken |
| Suprême → *Supreme (cooking)* (a culinary term) | override → Suprême sauce |
| Madeira Sauce → *Madeira wine* | override null |
| Shiraz (Australia) → *Shiraz wine* (historical Iranian wine) | override → Syrah |
| Vermouth Cocktail → *Vermouth*; Negroni Sbagliato → *Negroni*; Watercress → *Watercress soup*; Orange Crush / Cream Soda → soft-drink articles | override null |
| "Mac and Cheese", "Beef Pho" missed (titles are case-sensitive after the first letter) | rule: also try sentence case; an opensearch hit equal to the name is judged as an exact lookup |
| Shakshuka / Osso Buco / Mujadara redirect to spelling variants | rule: ≥ 0.8 string similarity counts for redirects |
| Harissa, BBQ ribs read as not-food | rule: "paste", "pork", "cut of meat" are food words |

### (d) Cards with and without a story

`src/components/__tests__/DishStory.test.jsx` covers:

- the loader: one fetch, a cache, fail-safe on 404 and offline, and a retry
  after a failure;
- the section with photo + credit, with a story but no photo, and with no
  story (renders nothing);
- a failed image load dropping the photo but keeping the text;
- the fixed aspect box set before the image loads;
- the Cookbook popup with and without a story;
- a sauce `LabNodeCard` with and without a story.

### Browser check (375px, Vite on port 5297, redraw before each capture)

| Card | Result |
|---|---|
| Recipe: Paella | photo 294×195 in frame, story, credit; no horizontal overflow |
| Recipe: Mole Poblano | same; Mole (sauce) story |
| Recipe: Butter Croissant | same |
| Recipe: Garlic Bok Choy | no section (no story), card unchanged |
| Sauce: Béchamel | photo, story, credit |
| Sauce: Mole Poblano | photo, story, credit |
| Cocktail: Negroni | portrait photo 144×193 centred in frame, story, credit |
| Cocktail: Bramble | the cocktail, not the shrub |
| Cocktail: Golden Boy | no section (house drink, no article) |
| Wine: Barolo | photo of Barolo, story, credit |

Every image had `complete` true and a natural width of 500. There were no
page errors.

## Skipped on purpose (override `null`)

- **Recipes:** Moules Marinières (no article; *Moules-frites* adds fries).
  Garlic Bok Choy (only the vegetable has an article). Goan Fish Curry (no
  article). Elote (redirects to the generic *Corn on the cob*).
- **Sauces:** Madeira Sauce (→ wine). Choron and Mousseline (redirect to
  béarnaise / hollandaise, whose first sentences describe the parent).
  Black Bean Sauce (*Douchi* describes the soybean). Peri Peri (the article is
  the chili cultivar).
- **Cocktails:** Vermouth Cocktail, Watercress, Negroni Sbagliato, Honey Bee,
  Loch Lomond, Orange Crush, Cream Soda.
- **Wines:** Sparkling Rosé.

Photo dropped, story kept (`{"title": …, "photo": false}`):

- Dal Tadka (raw lentils)
- Adobo Sauce (cured ham)
- Ají Amarillo Sauce (a green ají)
- Beaujolais and Bordeaux (region maps)

## Trade-offs and weak spots

- **Hotlinked photos need a connection.** Thumbnails load from
  upload.wikimedia.org (allowed by Wikimedia; nothing stored in this repo).
  Offline, or if Wikimedia is unreachable, the image fails and the section
  falls back to text + text credit. The fixed aspect box means the card does
  not jump either way.
- **Parent-article stories.** Some items show the story of the article
  Wikipedia files them under, not of the exact variant. Examples: Pork Gyoza →
  *Jiaozi*; Salmon Avocado Roll → *Sushi* (photo is nigiri); Teriyaki Salmon →
  *Teriyaki*; Saffron Risotto → *Risotto*; "Martini (Very Dry)" and
  "Dirty Martini" → *Martini*; Gin Sour / Rum Sour → *Sour (cocktail)*. Several
  sauces named after their dish go to the dish (Kung Pao, Pad Thai Sauce,
  Buffalo Sauce → *Buffalo wing*, Yangnyeom → *Yangnyeom chicken*).
- **Photos that match the article but are a stretch for the item:**
  - Tonkatsu Sauce: a bottle in a fridge door.
  - Dashi: bonito flakes.
  - Wine grape articles: a bunch of grapes rather than a glass.
  - Spare ribs (for BBQ Pork Ribs): raw-ish ribs.
- **Cocktail coverage is 40%.** The rest are house riffs (*Death & Co* /
  *Cocktail Codex* names) and TheCocktailDB novelty names with no article.
  That's expected.

## Review tables

The `--review` flag prints the full table (match path, rejection reasons,
photo verdict) for every item. Recipes and sauces were reviewed by eye row by
row, with the photos on a contact sheet. Cocktail and wine titles were read in
full and their photos checked on a contact sheet.

### Cookbook recipes (every row reviewed by eye: title, text and photo)

| Item | Article | How matched | Photo licence | By-eye verdict |
|---|---|---|---|---|
| Margherita Pizza | Pizza Margherita | qualifier | CC BY 2.0 | ok |
| Beef Bolognese | Bolognese sauce | override | CC BY-SA 3.0 | ok |
| Saffron Risotto | Risotto | override | CC BY 2.0 | ok, weak: general Risotto; photo is plain risotto |
| Beef Bourguignon | Beef bourguignon | exact | CC BY-SA 4.0 | ok |
| Butter Croissant | Croissant | override | CC0 | ok |
| Ratatouille | Ratatouille | exact | CC0 | ok |
| Salmon Avocado Roll | Sushi | override | CC BY-SA 2.0 | ok, weak: general Sushi article; photo is nigiri, not a roll |
| Miso Soup | Miso soup | exact | CC0 | ok |
| Pad Thai | Pad thai | exact | CC BY-SA 3.0 | ok |
| Beef Pho | Pho | qualifier | CC BY 4.0 | ok |
| Chicken Tikka Masala | Chicken tikka masala | exact | CC BY 2.0 | ok |
| Lamb Biryani | Biryani | override | CC BY-SA 4.0 | ok |
| Tacos al Pastor | Al pastor | exact | CC BY-SA 3.0 | ok |
| Mole Poblano | Mole (sauce) | qualifier | CC BY-SA 4.0 | ok |
| Hummus | Hummus | exact | CC BY 3.0 | ok |
| Spaghetti Carbonara | Carbonara | exact | CC BY-SA 4.0 | ok |
| Linguine alle Vongole | Spaghetti alle vongole | override | CC BY-SA 4.0 | ok |
| Pasta al Pesto | Pesto | override | CC BY-SA 3.0 | ok |
| Caprese Salad | Caprese salad | qualifier | CC BY-SA 3.0 | ok |
| Tiramisu | Tiramisu | exact | CC BY 2.0 | ok |
| Coq au Vin | Coq au vin | exact | CC BY 2.0 | ok |
| French Onion Soup | French onion soup | exact | CC BY-SA 3.0 | ok |
| Moules Marinières | — | skipped (override null) |  | — |
| Quiche Lorraine | Quiche Lorraine | exact | CC BY-SA 4.0 | ok |
| Crème Brûlée | Crème brûlée | exact | CC BY-SA 3.0 | ok |
| Mapo Tofu | Mapo tofu | exact | CC BY-SA 4.0 | ok |
| Bibimbap | Bibimbap | exact | CC BY 2.0 | ok |
| Teriyaki Salmon | Teriyaki | override | CC BY-SA 3.0 | ok, weak: Teriyaki technique, photo is teriyaki meat |
| Pork Gyoza | Jiaozi | override | CC BY-SA 4.0 | ok, weak: Jiaozi (Chinese dumplings) — Wikipedia redirects Gyoza here; photo is boiled jiaozi |
| Garlic Bok Choy | — | skipped (override null) |  | — |
| Thai Green Curry | Green curry | qualifier | CC BY-SA 3.0 | ok |
| Tom Yum Goong | Tom yum | override | CC BY-SA 3.0 | ok |
| Chicken Satay | Satay | qualifier | CC BY-SA 4.0 | ok |
| Som Tam | Green papaya salad | override | CC BY-SA 3.0 | ok |
| Chana Masala | Chana masala | qualifier | CC BY-SA 2.0 | ok |
| Palak Paneer | Palak paneer | exact | CC BY-SA 4.0 | ok |
| Dal Tadka | Dal | override | none (override: photo looks wrong for this item) | ok, weak: story opens on dal the pulse; photo dropped (raw lentils) |
| Goan Fish Curry | — | skipped (override null) |  | — |
| Garlic Naan | Naan | qualifier | CC BY 2.0 | ok |
| Guacamole | Guacamole | exact | CC BY-SA 3.0 | ok |
| Shrimp Ceviche | Ceviche | override | CC BY-SA 4.0 | ok |
| Chicken Enchiladas | Enchilada | exact | Public domain | ok |
| Pozole Rojo | Pozole | override | CC BY 2.0 | ok |
| Churros | Churro | exact | CC BY 2.0 | ok |
| Falafel | Falafel | exact | CC BY-SA 3.0 | ok |
| Shakshuka | Shakshouka | exact | CC BY-SA 3.0 | ok |
| Chicken Shawarma | Shawarma | exact | CC BY-SA 4.0 | ok |
| Tabbouleh | Tabbouleh | exact | CC0 | ok |
| Baklava | Baklava | exact | CC BY-SA 4.0 | ok |
| Cheeseburger | Cheeseburger | exact | Public domain | ok |
| Mac and Cheese | Macaroni and cheese | override | CC BY-SA 4.0 | ok |
| BBQ Pork Ribs | Spare ribs | override | CC BY-SA 4.0 | ok, weak: Spare ribs (pork cut) — the barbecue article has no rib-specific page |
| New England Clam Chowder | Clam chowder | exact | Public domain | ok |
| Buttermilk Pancakes | Pancake | override | CC0 | ok |
| Chicken and Sausage Gumbo | Gumbo | override | CC BY-SA 3.0 | ok |
| Caesar Salad | Caesar salad | exact | CC BY 2.0 | ok |
| Buttermilk Fried Chicken | Fried chicken | override | CC0 | ok |
| Apple Pie | Apple pie | exact | CC BY 4.0 | ok |
| Chocolate Chip Cookies | Chocolate chip cookie | override | CC BY 2.5 | ok |
| Paella | Paella | exact | CC BY-SA 4.0 | ok |
| Gazpacho | Gazpacho | exact | CC BY-SA 2.0 | ok |
| Patatas Bravas | Patatas bravas | qualifier | CC BY 2.0 | ok |
| Greek Salad | Greek salad | exact | CC BY-SA 4.0 | ok |
| Moussaka | Moussaka | exact | CC BY-SA 2.5 | ok |
| Spanakopita | Savory spinach pie | override | CC BY-SA 2.0 | ok |
| Pork Souvlaki | Souvlaki | override | CC BY-SA 3.0 | ok |
| Lasagna | Lasagna | exact | CC BY 2.0 | ok |
| Osso Buco | Ossobuco | exact | CC BY-SA 3.0 | ok |
| Panna Cotta | Panna cotta | exact | CC BY-SA 2.0 | ok |
| Bouillabaisse | Bouillabaisse | exact | CC BY 3.0 | ok |
| Tarte Tatin | Tarte Tatin | exact | CC BY-SA 3.0 | ok |
| Salade Niçoise | Salade niçoise | qualifier | CC BY-SA 3.0 | ok |
| Miso Ramen | Ramen | override | CC BY-SA 4.0 | ok |
| Kung Pao Chicken | Kung Pao chicken | exact | CC BY-SA 3.0 | ok |
| Beef Bulgogi | Bulgogi | override | CC BY-SA 2.0 kr | ok |
| Laksa | Laksa | exact | CC BY-SA 4.0 | ok |
| Pork Bánh Mì | Bánh mì | override | CC BY-SA 3.0 | ok |
| Vegetable Samosas | Samosa | override | CC BY-SA 4.0 | ok |
| Butter Chicken | Butter chicken | exact | CC BY-SA 4.0 | ok |
| Lamb Kofta | Kofta | override | CC BY-SA 2.5 | ok |
| Mujadara | Mujaddara | exact | CC BY-SA 3.0 | ok |
| Chiles Rellenos | Chile relleno | override | CC BY-SA 3.0 | ok |
| Elote | — | skipped (override null) |  | — |

### Sauces (every row reviewed by eye: title, text and photo)

| Item | Article | How matched | Photo licence | By-eye verdict |
|---|---|---|---|---|
| Béchamel | Béchamel sauce | exact | CC BY-SA 4.0 | ok |
| Mornay | Mornay sauce | qualifier | Public domain | ok |
| Soubise | Soubise sauce | qualifier | CC BY-SA 3.0 | ok |
| Alfredo | Fettuccine Alfredo | qualifier | CC BY 4.0 | ok, weak: Fettuccine Alfredo (dish) |
| Cheddar Sauce | Cheddar sauce | qualifier | CC BY-SA 2.0 | ok |
| Velouté | Velouté sauce | exact | CC BY-SA 2.0 | ok |
| Suprême | Suprême sauce | override | CC BY-SA 2.0 | ok |
| Allemande | Allemande sauce | qualifier | CC BY 2.0 | ok |
| Bercy | Sauce bercy | qualifier | none (no lead image) | ok |
| Espagnole | Espagnole sauce | exact | CC BY-SA 3.0 | ok |
| Demi-glace | Demi-glace | exact | CC BY 2.0 | ok |
| Bordelaise | Bordelaise sauce | qualifier | CC BY-SA 4.0 | ok |
| Chasseur | Chasseur (sauce) | qualifier | none (no lead image) | ok |
| Robert | Sauce Robert | qualifier | CC BY-SA 2.0 | ok |
| Madeira Sauce | — | skipped (override null) |  | — |
| Tomato Sauce (Classic French) | Tomato sauce | exact | CC0 | ok |
| Marinara | Marinara sauce | qualifier | CC0 | ok |
| Arrabbiata | Arrabbiata sauce | exact | CC BY-SA 4.0 | ok |
| Puttanesca | Spaghetti alla puttanesca | exact | CC BY-SA 4.0 | ok, weak: Spaghetti alla puttanesca (dish) |
| Bolognese | Bolognese sauce | qualifier | CC BY-SA 3.0 | ok |
| Hollandaise | Hollandaise sauce | exact | CC BY-SA 4.0 | ok |
| Béarnaise | Béarnaise sauce | qualifier | CC BY-SA 4.0 | ok |
| Choron | — | skipped (override null) |  | — |
| Mousseline | — | skipped (override null) |  | — |
| Teriyaki | Teriyaki | exact | CC BY-SA 3.0 | ok |
| Ponzu | Ponzu | exact | CC BY 2.0 | ok |
| Kung Pao | Kung Pao chicken | exact | CC BY-SA 3.0 | ok, weak: sauce named after the dish → dish article |
| Sweet and Sour Sauce | Sweet and sour | qualifier | none (no lead image) | ok |
| Black Bean Sauce | — | skipped (override null) |  | — |
| XO Sauce | XO sauce | qualifier | CC0 | ok |
| Thai Green Curry | Green curry | qualifier | CC BY-SA 3.0 | ok |
| Thai Red Curry | Red curry | qualifier | CC BY-SA 3.0 | ok |
| Pad Thai Sauce | Pad thai | override | CC BY-SA 3.0 | ok, weak: dish article |
| Peanut Sauce (Thai) | Peanut sauce | qualifier | CC BY-SA 3.0 | ok |
| Yangnyeom | Yangnyeom chicken | search | CC BY-SA 4.0 | ok, weak: Yangnyeom chicken (dish) article |
| Bulgogi Marinade | Bulgogi | override | CC BY-SA 2.0 kr | ok, weak: dish article |
| Gochujang Sauce | Gochujang | override | none (licence: KOGL Type 1) | ok, weak: Gochujang (paste); no free photo |
| Tonkatsu Sauce | Tonkatsu sauce | qualifier | CC BY-SA 4.0 | ok, weak: photo is a bottle in a fridge door |
| Tare | Tare sauce | qualifier | CC BY 2.0 | ok |
| Tikka Masala | Chicken tikka masala | qualifier | CC BY 2.0 | ok, weak: dish article |
| Makhani (Butter Chicken) | Butter chicken | override | CC BY-SA 4.0 | ok, weak: dish article |
| Korma | Korma | exact | CC0 | ok |
| Vindaloo | Vindaloo | exact | CC BY-SA 2.0 | ok |
| Saag | Saag | exact | Public domain | ok |
| Raita | Raita | exact | CC BY-SA 2.0 | ok |
| Mango Chutney | Green mango chutney | exact | CC BY 3.0 | ok, weak: Green mango chutney |
| Mint Chutney | Chutney | qualifier | CC BY-SA 2.0 | ok, weak: general Chutney |
| Mole Poblano | Mole (sauce) | qualifier | CC BY-SA 4.0 | ok |
| Mole Negro | Mole (sauce) | qualifier | CC BY-SA 4.0 | ok |
| Salsa Roja | Salsa (food) | qualifier | CC BY-SA 3.0 | ok |
| Salsa Verde | Salsa verde | exact | CC BY-SA 2.0 | ok |
| Chimichurri | Chimichurri | exact | CC BY 2.0 | ok |
| Sofrito | Sofrito | exact | CC BY 2.0 | ok |
| Adobo Sauce | Adobo | override | none (override: photo looks wrong for this item) | ok, weak: Iberian adobo article; photo dropped (cured ham) |
| Ají Amarillo Sauce | Ají (sauce) | override | none (override: photo looks wrong for this item) | ok, weak: Ají sauce article (green); photo dropped |
| Tahini Sauce | Tahini | qualifier | CC BY-SA 3.0 | ok, weak: Tahini (paste) |
| Toum | Toum | exact | CC BY-SA 3.0 | ok |
| Zhug | Zhug | exact | CC BY-SA 4.0 | ok |
| Harissa | Harissa | exact | CC BY-SA 4.0 | ok |
| Romesco | Romesco | exact | Public domain | ok |
| Chermoula | Chermoula | exact | CC BY 2.0 | ok |
| Groundnut Sauce | Peanut stew | override | CC0 | ok |
| Shito | Shito | exact | CC BY-SA 4.0 | ok |
| Peri Peri | — | skipped (override null) |  | — |
| Berbere Sauce | Berbere | search | CC BY 3.0 | ok, weak: Berbere spice mix |
| BBQ Sauce | Barbecue sauce | override | CC BY-SA 3.0 | ok |
| Buffalo Sauce | Buffalo wing | exact | CC BY 2.0 | ok, weak: Buffalo wing (dish) article |
| Gravy (Southern) | Gravy | exact | CC BY-SA 4.0 | ok |
| Remoulade | Remoulade | exact | CC BY-SA 3.0 | ok |
| Aji Sauce | Ají (sauce) | qualifier | CC BY-SA 3.0 | ok |
| Nuoc Cham | Nước chấm | exact | CC BY 2.0 | ok |
| Beurre Blanc | Beurre blanc | qualifier | CC BY-SA 2.0 | ok |
| Beurre Noisette | Beurre noisette | qualifier | CC BY 2.0 | ok |
| Gastrique | Gastrique | exact | CC BY-SA 2.0 | ok |
| Chimichurri Verde | Chimichurri | override | CC BY 2.0 | ok |
| Dashi | Dashi | exact | CC BY-SA 3.0 | ok, weak: photo is bonito flakes (dashi ingredient) |
| Salsa Macha | Salsa macha | qualifier | CC BY-SA 4.0 | ok |

### Cocktails — 177 accepted (titles reviewed by eye; photos on a contact sheet)

Ti’ Punch → Ti' punch · Chrysanthemum → Chrysanthemum (cocktail) · Stinger → Stinger (cocktail) · Champagne Cocktail → Champagne cocktail · Mint Julep → Mint julep · Sazerac → Sazerac · Vesper → Vesper (cocktail) · Martini (Very Dry) → Martini (cocktail) · Martini (Our Root Recipe) → Martini (cocktail) · Martini (Wet) → Martini (cocktail) · Martinez → Martinez (cocktail) · Perfect Manhattan → Manhattan (cocktail) · Brooklyn → Brooklyn (cocktail) · Negroni → Negroni · Boulevardier → Boulevardier (cocktail) · Old Pal → Old pal · Amaretto Sour → Amaretto sour · Pisco Sour → Pisco sour · Hemingway Daiquiri → Hemingway special *(override)* · Bee’s Knees → Bee's knees · Brown Derby → Brown Derby (cocktail) · Whiskey Sour → Whiskey sour · Pink Lady → Pink lady (cocktail) · Southside → South Side (cocktail) · Mai Tai → Mai Tai · Caipirinha → Caipirinha · French 75 → French 75 (cocktail) · Old Cuban → Old Cuban · Ramos Gin Fizz → Fizz (cocktail) · Moscow Mule → Moscow mule · Sidecar (Our Ideal Recipe) → Sidecar (cocktail) · Margarita → Margarita · Margarita (Dry) → Margarita · Margarita (Sweet) → Margarita · Between the Sheets (Classic) → Between the sheets (cocktail) · Between the Sheets (Our Ideal Recipe) → Between the sheets (cocktail) · 20th Century → 20th century (cocktail) · Corpse Reviver #2 → Corpse reviver · Fish House Punch → Fish house punch · Americano → Americano (cocktail) · Paloma → Paloma (cocktail) · Cuba Libre → Rum and Coke *(override)* · Screwdriver → Screwdriver (cocktail) · Gin and Tonic → Gin and tonic · Tequila Sunrise → Tequila sunrise · Harvey Wallbanger → Harvey Wallbanger · Bloody Mary (Classic Variation) → Bloody Mary (cocktail) · Mimosa → Mimosa (cocktail) · Bellini → Bellini (cocktail) · Kir Royale → Kir royal · Aperol Spritz → Spritz (cocktail) · Brandy Flip → Flip (cocktail) *(override)* · Eggnog → Eggnog · Brandy Alexander → Brandy Alexander · White Russian → White Russian (cocktail) · Irish Coffee → Irish coffee · Grasshopper → Grasshopper (cocktail) · Tom and Jerry → Tom and Jerry (drink) · Pina Colada → Piña colada · Hurricane → Hurricane (cocktail) · Singapore Sling → Singapore sling · Pimm's Cup → Pimm's cup · Dirty Martini → Martini (cocktail) · Old-Fashioned → Old fashioned (cocktail) · Martini → Martini (cocktail) · Daiquiri → Daiquiri · Sidecar → Sidecar (cocktail) · Whisky Highball → Highball *(override)* · Flip → Flip (cocktail) · Aviation → Aviation (cocktail) · Alexander → Alexander (cocktail) · B-52 → B-52 (cocktail) · Bijou → Bijou (cocktail) · Bramble → Bramble (cocktail) · Boomerang → Boomerang (cocktail) · Blackthorn → Blackthorn (cocktail) · Boston Sour → Whiskey sour *(override)* · Casino → Casino (cocktail) · Cuba Libra → Rum and Coke *(override)* · Clover Club → Clover Club cocktail · Cosmopolitan → Cosmopolitan (cocktail) · Corpse Reviver → Corpse reviver · Derby → Derby (cocktail) · Dry Martini → Martini (cocktail) · Dark and Stormy → Dark 'n' stormy · Death in the Afternoon → Death in the Afternoon (cocktail) · Frozen Daiquiri → Daiquiri · Flaming Dr. Pepper → Flaming Doctor Pepper *(override)* · Frozen Mint Daiquiri → Daiquiri *(override)* · Frozen Pineapple Daiquiri → Daiquiri *(override)* · Gimlet → Gimlet (cocktail) · Gin Fizz → Fizz (cocktail) · Gin Sour → Sour (cocktail) · Godfather → Godfather (cocktail) · Gin Tonic → Gin and tonic · Greyhound → Greyhound (cocktail) · Gin Rickey → Rickey (cocktail) · Hot Toddy → Hot toddy · Horse's Neck → Horse's neck · Hemingway Special → Hemingway special · John Collins → John Collins (cocktail) · Jack Rose Cocktail → Jack Rose (cocktail) · Kir → Kir (cocktail) · Kamikaze → Kamikaze (cocktail) · Lemon Drop → Lemon drop (cocktail) · Long vodka → Long vodka · Long Island Tea → Long Island iced tea · Mojito → Mojito · Michelada → Michelada · Manhattan → Manhattan (cocktail) · Mulled Wine → Mulled wine · Monkey Gland → Monkey gland (cocktail) · Mary Pickford → Mary Pickford (cocktail) · New York Sour → New York sour · Orgasm → Orgasm (cocktail) · Orange Whip → Orange whip · Old Fashioned → Old fashioned (cocktail) · Paradise → Paradise (cocktail) · Pink Gin → Pink gin · Pegu Club → Pegu Club (cocktail) · Penicillin → Penicillin (cocktail) · Porto flip → Porto flip · Planter's Punch → Planter's punch · Rose → Rose (cocktail) · Rum Sour → Sour (cocktail) *(override)* · Rum Punch → Punch (drink) *(override)* · Rusty Nail → Rusty nail (cocktail) · Spritz → Spritz (cocktail) · Salty Dog → Salty dog (cocktail) · Sea breeze → Sea breeze (cocktail) · Scotch Sour → Whiskey sour *(override)* · Sherry Flip → Flip (cocktail) *(override)* · Sol Y Sombra → Sol y Sombra · Tom Collins → Tom Collins · Tequila Sour → Sour (cocktail) · The Last Word → Last Word (cocktail) · Tuxedo Cocktail → Tuxedo (cocktail) · Vampiro → Vampiro (cocktail) · Vodka Tonic → Vodka tonic · Vodka Martini → Martini (cocktail) · Vodka And Tonic → Vodka tonic · Whisky Mac → Whisky Mac · White Lady → White lady (cocktail) · White Wine Sangria → Sangria *(override)* · Yellow Bird → Yellow bird (cocktail) · Zombie → Zombie (cocktail) · Angel Face → Angel face (cocktail) · Between the Sheets → Between the sheets (cocktail) · Brandy Crusta → Brandy crusta · Hanky Panky → Hanky panky (cocktail) · Last Word → Last Word (cocktail) · Remember the Maine → Remember the Maine (cocktail) · Tuxedo → Tuxedo (cocktail) · Vieux Carré → Vieux Carré (cocktail) · Black Russian → Black Russian · Bloody Mary → Bloody Mary (cocktail) · Garibaldi → Garibaldi (cocktail) · Rabo de Galo → Rabo de Galo · Canchanchara → Canchanchara · Chartreuse Swizzle → Chartreuse swizzle · Dark 'n' Stormy → Dark 'n' stormy · Fernandito → Fernet con coca *(override)* · Gin Basil Smash → Gin basil smash · Illegal → Illegal (cocktail) · Jungle Bird → Jungle Bird · Naked and Famous → Naked and famous (cocktail) · Paper Plane → Paper plane (cocktail) · Pisco Punch → Pisco punch · Sherry Cobbler → Sherry cobbler · South Side → South Side (cocktail) · Spicy Fifty → Spicy Fifty · Suffering Bastard → Suffering bastard · Tommy's Margarita → Tommy's margarita · Trinidad Sour → Trinidad sour · Ve.n.to → Ve.n.to · Rob Roy → Rob Roy (cocktail) · Gibson → Gibson (cocktail)

### Wines — 52 accepted (titles reviewed by eye; photos on a contact sheet)

Champagne (Brut) → Champagne · Prosecco → Prosecco · Cava → Cava (Spanish wine) *(override)* · Lambrusco → Lambrusco · Sancerre (Loire Sauvignon Blanc) → Sancerre (wine) · New Zealand Sauvignon Blanc → Sauvignon blanc *(override)* · Pinot Grigio → Pinot gris *(override)* · Albariño → Albariño · Muscadet → Muscadet · Chablis (unoaked Chardonnay) → Chablis (AOC) · Vermentino → Vermentino · Assyrtiko → Assyrtiko · Grüner Veltliner → Grüner Veltliner · Vinho Verde → Vinho Verde · Dry Riesling → Riesling *(override)* · Off-dry Riesling (Kabinett) → Riesling *(override)* · Gewürztraminer → Gewürztraminer · Viognier → Viognier · Chenin Blanc (Vouvray) → Chenin blanc · Oaked Chardonnay (California) → Chardonnay *(override)* · White Burgundy (Meursault) → Burgundy wine *(override)* · White Rhône (Marsanne-Roussanne) → Rhône wine *(override)* · Provence Rosé → Provence wine *(override)* · Rosado / Tavel (fuller rosé) → Tavel AOC *(override)* · Red Burgundy (Pinot Noir) → Burgundy wine *(override)* · Pinot Noir (Oregon / New Zealand) → Pinot noir *(override)* · Beaujolais (Gamay) → Beaujolais *(override)* · Valpolicella → Valpolicella · Chianti Classico (Sangiovese) → Chianti · Rioja Crianza (Tempranillo) → Rioja DOCa *(override)* · Côtes du Rhône (Grenache blend) → Côtes du Rhône AOC · Barbera → Barbera · Merlot → Merlot · Chinon (Cabernet Franc) → Chinon AOC · Montepulciano d'Abruzzo → Montepulciano d'Abruzzo · Cabernet Sauvignon (Napa) → Cabernet Sauvignon · Bordeaux (Left Bank) → Bordeaux wine *(override)* · Syrah (Northern Rhône) → Syrah · Shiraz (Australia) → Syrah *(override)* · Malbec (Argentina) → Malbec · Zinfandel → Zinfandel · Barolo (Nebbiolo) → Barolo · Amarone della Valpolicella → Amarone · Sauternes → Sauternes (wine) · Moscato d'Asti → Moscato d'Asti · Tokaji Aszú → Tokaji · Vin Santo → Vin Santo · Fino Sherry → Fino · Amontillado Sherry → Amontillado *(override)* · Tawny Port → Port wine · Ruby / Vintage Port → Port wine *(override)* · Madeira (Bual / Malmsey) → Madeira wine *(override)*
