# wine as-built specs

## WINE-1 — Wine style data for the Wine Lab

public/data/wine_styles.json: 53 hand-written wine styles in 10 families (sparkling to fortified) with body/acidity/tannin/sweetness/alcohol/oak scales, aromas, grapes, region, cuisine, serving temperature, tasting notes and classic food matches named as ProData ingredients. Original data from standard wine-education descriptions; no third-party database.

## WINE-2 — Wine pairing engine with a sommelier answer key

src/data/winePairing.js: dish traits from ingredient names + ProData category + method text (protein with cured pork demoted, richness, acid, dessert, hot vs mild chili, umami, warm spice, char, soup, wine in the pot); idealWine() derives the target body/acidity/tannin/sweetness/alcohol/oak/colour; each wine is scored by distance from it plus flavour bridges, region and classic matches, with reasons. Answer keys in src/data/wineAnswerKey.js (written before the engine; held-out key written mid-tuning and never tuned on); scripts/evalWinePairing.mjs reports hit@1/hit@3/MRR, concentration and coverage.

## WINE-3 — Wine Lab UI and wiring

src/components/WineLab.jsx: chalk wine list by family with search (name, grape, region, aroma, food) and colour chips; matches mode with per-wine reasons and back-to-recipe; shared LabNodeCard (kind=wine) with structure words, grapes, tasting notes, similar wines, classic foods and 'why' for matched wines. Wired as a lab: Labs tile, mobile Labs menu, ?path=wine, Cookbook 'Matching wines' (passes cuisine, dish type, method), Recipe Notebook Flavor Profiles 'Find wines'.

## WINE-4 — Wine Lab: country of origin and region

Each wine style gets country (home), countries (everywhere it is made) and area (principal wine region). Wine Lab adds country chips with flags and counts, region chips inside a country, a Group by Style/Country switch, country/region on rows and cards, and search over country and region names (src/data/wineStyles.js countryIndex/fromCountry/countryFlag).
