# Wine mapping review (bead WINE-6, 2026-11-07)

A review of the Wine Lab's flavour mappings: the 53 styles in
`public/data/wine_styles.json` and the trait → wine rules in
`src/data/winePairing.js`. It was written alongside the new wine-card
sections ("Flavour profile", "Pairs by profile", "Avoid" — `src/data/wineProfile.js`).

## Data edits made in this bead

**None.** Another agent is changing `winePairing.js` against this data, so
every data finding below is a recommendation and is not applied. Each
data change should be measured on its own with `scripts/evalWinePairing.mjs`.

## Baseline (before any change, this branch)

`node scripts/evalWinePairing.mjs --heldout`:

| key | hit@1 | hit@3 | MRR |
|---|---|---|---|
| Answer key (tuned on, 42 dishes) | 21/42 | 31/42 | 0.63 |
| Held-out (16 dishes) | 5/16 | 10/16 | 0.49 |

Concentration (top 3 over 83 recipes): assyrtiko 21, barbera 16, cava 16, chablis 15.
Coverage: 42/53 wines reach some top 3. **The 11 that never do:**
gewurztraminer, viognier, chardonnay-oaked, rhone-white, valpolicella, rioja,
merlot, shiraz, amarone, ruby-port, madeira.

The wine-card sections only add display code, so they do not change these numbers.

---

## 1. Data checks

The structure values are mostly in line with standard wine-education
descriptions. Most findings are about which axis carries the information, not
about wrong numbers.

### 1a. Structure values to look at

| Style | Field | Now | Suggest | Why |
|---|---|---|---|---|
| Chianti | acidity | 5 | 4 | Sangiovese is high in acid, but 5 puts it level with Muscadet and Champagne. A 5 for a red also beats every white in the "too little acid" check. |
| Shiraz (Barossa) | acidity | 2 | 3 | Warm-climate Shiraz is usually medium, not low. A 2 also triggers the steepest penalty (0.3 per point short) for any tomato or BBQ-sauce dish. That may be why Shiraz never reaches a top 3, even for BBQ ribs, where it is in the answer key. |
| Zinfandel | sweetness | 2 | 1 (and keep alcohol 5) | Most red Zinfandel is dry. The ripe-fruit impression is alcohol and jammy fruit, not sugar. With a 2, the engine treats it as off-dry, and the "calms chili" logic would favour it next to heat. Its alcohol of 5 makes heat worse. |
| Amontillado, Tawny Port, Madeira | oak | 2 | 1, plus a new `oxidative` flag | These styles age in old, neutral casks. Their character is oxidative (nuts, caramel), not toasty new oak. With oak 2, the engine reads them like oaked Chardonnay for smoke and char. The card now says "long cask age" for these styles, but the engine cannot tell the difference. |
| Fino Sherry | oak | 1 | 0, plus `oxidative`/`flor` | Same reason as above. Fino gets its character from flor yeast and is close to oak-free in flavour. |
| Vinho Verde, Moscato d'Asti | sparkling | true | `sparkling: "frizzante"` | Both are lightly prickly, not fully sparkling. Vinho Verde currently gets the full "bubbles scrub the fried batter" bonus that Champagne gets. |
| Gewürztraminer | sweetness | 2 | keep, but split the style | Alsace Gewürztraminer runs from dry to sweet. A single style at 2 is fine, but the "off-dry → calms heat" rule never fires for it because alcohol is 4. See rule 2b. |
| Chablis | body | 3 | 2 | Unoaked Chablis is usually light to medium. It sits at 3 next to Assyrtiko. This pushes Chablis into medium-weight dishes, which adds to its concentration (15 top-3 places). |

### 1b. Aromas

- **Every aroma tag maps to one of 8 families** (fruit, floral, herbal, earthy,
  spice, oak & toast, nutty & oxidative, mineral & saline). This is enforced by a
  test in `src/data/__tests__/wineProfile.test.js`. **Fruit is overloaded:**
  20 of 53 styles list `citrus`, and fruit is the largest family for most whites.
  That makes the aroma breakdown look alike from one white to the next.
- **Missing typical notes:** Merlot has no `earthy` or `cedar`. Bordeaux and
  Cabernet have no `cedar` or `tobacco`. Rioja has no `dill` or `coconut`
  (American oak). Pinot Grigio has no `floral`. Sauvignon Blanc has no `grass`
  (it uses `herbal`, which is fine). Chenin has no `wax`/`lanolin`. Riesling has
  no `petrol`. These tags would not change the pairing much, since the bridges
  only read about a dozen tags, but they would make the card read true to a
  wine drinker.
- **Tags no bridge reads:** `mineral`, `leather`, `olive`, `tomato`, `floral`,
  `yeasty`, `red fruit`, `black fruit`, `cherry`, `plum`, `jam`. `floral` (13
  styles) and the red and black fruit tags (26 uses) carry no pairing weight at all.

### 1c. Classic matches against the rules

- No firm-tannin red (tannin ≥ 4) lists fish. That is good.
- **Assyrtiko lists `lamb`.** This is a real Santorini pairing. However, a
  red-meat dish gives the white a −0.25 to −0.45 colour penalty and the bonus
  for classic matches is capped, so this match can never win. That is fine, but
  it should be documented as regional colour.
- **Sparkling Rosé lists `duck`** and **Champagne lists `chicken`** and
  `mushroom`. These are defensible. Champagne's high acid and bubbles then also
  make it a frequent top-3 pick for generic chicken dishes.
- **Lambrusco lists `pizza sauce`,** while tomato wants acid ≥ 4 and Lambrusco
  has acid 4. The data is consistent.
- Every `classicMatches` entry resolves to an ingredient in
  `public/proDataset/ingredients.json` (checked again here: none missing).

### 1d. Missing styles

Each of these is an obvious gap for the dishes in the Cookbook:

1. **Grenache/Garnacha red** (Châteauneuf-du-Pape, Priorat, Garnacha). This is
   a soft-tannin, high-alcohol, spicy red that is classic with lamb tagine,
   Moroccan food and BBQ. Right now `cotes-du-rhone` covers it alone.
2. **Orange / skin-contact white.** It has tannin without red fruit, which
   makes it the natural answer for spiced Middle Eastern and South Asian
   vegetable dishes. Middle Eastern is 8 Cookbook recipes, with no regional wine.
3. **Dry Lambrusco / Sangiovese rosato / a Cerasuolo d'Abruzzo.** These are
   light reds and rosés with tomato-friendly acid.
4. **Sake** (junmai / ginjo). It is not a wine, but it is the standard answer
   for East Asian food (10 recipes) and for miso, dashi and soy, where the
   engine's umami penalty makes every tannic red lose. The `pad-thai` and
   `miso-ramen` misses point to it. If sake is out of scope, add
   **Mosel Kabinett** and **dry Furmint** as umami-friendly whites.
5. **Pedro Ximénez sherry.** This is the classic wine for chocolate and ice
   cream. The answer key's chocolate dishes are left to Port and Madeira.
6. **Torrontés, Carmenère, Pinotage, Tempranillo (Ribera)** would add breadth,
   but they are not needed for any dish in the key.

### 1e. Region / cuisine tagging (hurts the region bonus)

The region bonus (+0.12) fires only when `wine.cuisine === recipe.cuisine`.
The Cookbook's cuisines are Italian, French, East Asian, American, South Asian,
Mexican, SE Asian, Middle Eastern and Mediterranean.

- **`German` (3 wines: both Rieslings, Grüner) and `Other` (4 wines: NZ
  Sauvignon, Shiraz, Malbec, Tokaji) never match any recipe.** Seven styles,
  13% of the list, can never get the region bonus.
- Spain, Portugal and Greece are all tagged `Mediterranean`. This is reasonable,
  because the Cookbook has no Spanish or Greek cuisine.
- No wine is tagged for Mexican, Middle Eastern, South Asian, SE Asian or East
  Asian food. That is correct, since there is no wine tradition there. The
  answer is not a region bonus. It is the structure rules (heat, spice, umami)
  doing their job, which is where the misses are (1d, 2a–2c).
- Suggestion: rename the field to `homeCuisines: string[]`. Tag Malbec
  `['Argentine', 'American']`, and treat Grüner/Riesling as `['German',
  'Central European']`. Accept that the bonus only matters when the Cookbook
  has that cuisine. Do not tag a wine with a cuisine it does not come from just
  to collect the bonus.

---

## 2. Rule checks (engine vs standard pairing advice)

### 2a. Low-acid aromatic whites can never win spiced dishes — biggest gap

Gewürztraminer and Viognier (acidity 2) are in the answer key for Thai
green curry, chicken tikka and butter chicken. They **never reach any top 3.**
The cause is the acid rule. The ideal acidity starts at 2.6 and rises with
richness, salt and tomato. A wine below that loses 0.3 per point. For butter
chicken, tomato alone adds 0.8, so the ideal is about 4. Gewürztraminer then
pays about 0.6, more than any bridge can earn back. Standard advice: with a
creamy, aromatic, moderately spiced dish, low acid is acceptable and
aromatic intensity matters more than acid.
**Suggest:** reduce the acid shortfall penalty when `p.spice > 0.4` or the
dish is creamy without much acid (cream or coconut rather than vinegar or
citrus). Measure on `chicken-tikka` and `butter-chicken` (first accepted at
ranks 10 and 11 today) and on held-out `chana-masala` and `goan-fish-curry`.

### 2b. The heat rule needs off-dry AND low alcohol; Gewürztraminer fails on alcohol

The "calms the chili heat" reason fires only at sweetness ≥ 2 and alcohol ≤ 3.
Gewürztraminer (sweetness 2, alcohol 4) is a textbook partner for medium heat
but fails the alcohol test. In standard advice, high alcohol is the problem with
*hot* chili, not with mild spice. **Suggest:** scale the alcohol penalty by heat,
which the engine already does in part, and let the reason fire at alcohol 4 when
heat is below about 0.5.

### 2c. Umami penalises tannin, but nothing rewards what umami wants

Strong umami (miso, soy, fish sauce, mushrooms) lowers the ideal tannin, but
no rule raises anything in return. Standard advice says umami wants acid, a
little sweetness, low tannin, and oxidative or savoury styles (Amontillado,
aged Champagne, sake). Miso Ramen's top picks today are Cava, Sparkling Rosé
and Champagne, which is reasonable, while Amontillado (whose classic matches
are mushroom, soy sauce and miso) has no structural rule pulling it up: only the
capped classic-match bonus and the nutty/mushroom bridges count in its favour.
**Suggest:** add an `umami` bridge that rewards the `nutty`/`mushroom`/`yeasty`
aroma tags plus a small acid bump. Measure on `miso-ramen` and `beef-pho`.

### 2d. Concentration on high-acid whites

Assyrtiko (21 of 83 top 3s), Chablis (15) and Cava (16) win because the acid
penalty is asymmetric: too little acid costs 0.3 per point, too much costs only
0.08. Any high-acid wine is a safe fallback. Standard advice agrees that acid is
forgiving, but not *that* forgiving with rich red-meat dishes.
**Suggest:** raise the over-acid cost to about 0.12, or apply it only when the
dish is rich and low in acid. Watch concentration, not just hit@3.

### 2e. Oak means two different things

`oak` mixes new-oak toast (Napa Cabernet, oaked Chardonnay, Rioja) with
old-cask oxidation (Tawny, Madeira, Amontillado). The engine's smoke bridge and
`t.oak` treat both the same, so Madeira can collect "toasty oak meets the smoke"
on a BBQ dish. **Suggest:** an `oxidative: 0–2` axis. Move the fortified
styles' oak into it, and give it its own bridge (nuts, caramel, mushroom, aged cheese).

### 2f. Bubbles bonus treats frizzante as fully sparkling

See 1a. Halve `t.sparkling` for `frizzante` styles.

### 2g. "Region" bonus vs "cooked with" bonus

Cooking with red wine adds +0.3 for any red with body ≤ 4. That is stronger than
the region bonus and does not care which red: Barolo gets the same credit as
Beaujolais for coq au vin. This is in line with the "drink what you cook with"
advice, which is soft. Consider limiting it to reds within ±1 body of the ideal.

### 2h. Where the card and the engine could drift

`src/data/wineProfile.js` restates the engine's thresholds in plain words. The
engine is the source of truth. The places it could drift:

| Card rule | Engine logic it restates | Drift risk |
|---|---|---|
| firm tannin ≥ 4 → red meat; avoid fish/chili/umami | reason at `t.tannin ≥ 3.5 && wine.tannin ≥ 3.5`; tannin ideal drops with heat/umami/spice | low |
| off-dry ≥ 2, alcohol ≤ 3, tannin ≤ 2 → calms heat | reason at `sweetness ≥ 2 && alcohol ≤ 3` when heat > 0.2 | **medium**: the card adds `tannin ≤ 2`; the engine has no tannin condition on the reason (tannin is penalised separately) |
| alcohol ≥ 4 → avoid hot chili | `0.25 × (alcohol − ideal)` when heat > 0.2 | low |
| sweetness ≥ 4 → desserts; dry → avoid desserts | dessert ideal sweetness ≥ 4; 0.55/point short | low |
| acid ≥ 4 → cuts fat, tomato | reasons at `acidity ≥ 4` | low |
| dry sparkling → salty/fried | bonus only when `sparkling && sweetness ≤ 2` | low (exact) |
| body ≥ 4 / ≤ 2 → rich / delicate | `0.28 × |body − ideal|` | low |
| oak 2 → smoke/butter (or "long cask age" for fortified/sweet) | reason at `oak ≥ 2 && t.oak ≥ 1` | **medium**: the card already separates oxidative casks; the engine does not (2e) |
| aroma bridges list | engine's private `BRIDGES` table | **high**: duplicated by hand, because `BRIDGES` is not exported |

Consistency tests in `src/data/__tests__/wineProfile.test.js` compare the
engine's own scores. They check that firm-tannin wines beat fish-safe wines for
steak and lose for fish, that heat-rule wines beat chili-warning wines for a
Thai dish, that dessert-rule wines beat dry wines for a dessert, and that dry
bubbles gain from frying. A threshold change in the engine that breaks the card's
wording should fail one of them.
**Suggest:** export `BRIDGES` (and the numeric thresholds) from `winePairing.js`
and import them in `wineProfile.js`, so the card cannot drift.

---

## 3. Prioritised improvements

Each item: what to change, the expected effect, and how to measure it. Always
run `node scripts/evalWinePairing.mjs --heldout --detail` before and after, on
the same data, and change one thing at a time. Do not edit the answer keys.

1. **Soften the acid shortfall for spiced/creamy dishes (2a) and let mild heat
   accept alcohol 4 (2b).** Expected: Gewürztraminer and Viognier reach the top 3
   for tikka, butter chicken and Thai curry. Answer key hit@3 +2 to 3, held-out
   `chana-masala` and `goan-fish-curry` move up. Coverage +2.
   Measure: those dishes' first accepted rank, plus coverage.
2. **Raise the over-acid cost (2d).** Expected: Assyrtiko, Chablis and Cava
   concentration drops from 21/15/16 toward ≤ 12. Red-meat dishes stop drifting
   to crisp whites (Cheeseburger is a miss today: top 3 chianti, barolo, syrah).
   Measure: the concentration line, and hit@3 must not drop.
3. **Fix the three structure values most likely to matter: Shiraz acidity
   2→3, Zinfandel sweetness 2→1, Chablis body 3→2 (1a).** Expected: Shiraz
   reaches BBQ ribs and cheeseburger, Zinfandel stops looking off-dry, Chablis
   concentration falls. Measure each edit separately: BBQ ribs, cheeseburger,
   and the concentration line.
4. **Add an `oxidative` axis and an umami bridge (2c, 2e).** Expected:
   Amontillado and Fino rise for miso, mushroom and soy dishes. Madeira and Tawny
   stop picking up smoke credit. Measure: `miso-ramen`, `beef-pho`,
   `french-onion-soup` (all misses today).
5. **Add the missing styles (1d): Garnacha red, orange wine, sake or a
   Kabinett, PX.** Expected: better hits for the Middle Eastern, East Asian and
   chocolate dishes. First write the answer-key entries for these dishes
   **before** adding the wines, following the key's own rule.
   Measure: the new key entries plus held-out.
6. **Retag cuisine (1e):** 7 styles can never get the region bonus. This is
   small (+0.12) but free. Measure: hit@1 on European dishes.
7. **Export `BRIDGES` and the thresholds from `winePairing.js` (2h)**, so the
   wine card restates the engine instead of copying it. This adds no accuracy;
   it removes drift risk.
8. **Make frizzante a separate kind of sparkling (2f).** Small effect on fried
   dishes. Measure: the Vinho Verde and Moscato rank on fried/salty recipes.
9. **Enrich aromas (1b)** with cedar, tobacco, petrol, dill and grass, and give
   `floral` and the red/black fruit tags a bridge (e.g. red fruit → cranberry,
   tomato; black fruit → BBQ sauce, plum). Mostly a card-quality change.
   Measure: rank changes on the duck, turkey and BBQ dishes.

## Licence / sources

Everything in this review is our own analysis, based on general, widely taught
wine-pairing principles. It is not derived from The Flavor Bible or any
copyrighted pairing text.
