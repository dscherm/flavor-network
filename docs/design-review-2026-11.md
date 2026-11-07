# Design review — pictures vs. text (2026-11-07)

Reviewed at phone width (375 px) on the dev build: Landing, Labs menu, Make,
Cocktail Lab (menu, My bar, Invent), Sauce Lab, Pairing Lab, Wine Lab (list
and card), Cookbook (list and recipe popup), Recipe Notebook.

## What works — the standard to copy

The Cocktail Lab menu and the Sauce Lab are the best screens in the app, and
for the same reason: **every choice is a drawing first and a word second.**
Chalk glasses for families, chalk bottles for spirits, vessels for sauces.
Text is a short label under the picture plus a count. You can scan the screen
without reading it.

The landing page also has strong imagery. Everything else drifts toward
lists of words.

## Where the balance tips to text

| Screen | What you see | Picture-to-text |
|---|---|---|
| Labs menu | Text cards with small line icons | Low |
| Make | Text cards | Low |
| Cocktail Lab, filters | Six rows of word chips (occasion, season, strength, character, effort, glass). On mobile the sticky header takes ~45% of the screen once you scroll. Visible purple scrollbars under each row. | Low — and it pushes the drawings off screen |
| My bar | Chips + a list of drink names | Low |
| Invent a cocktail | A recipe card in text; no glass drawing | Low |
| Wine Lab, list | Rows of wine names and tags; no bottle or glass art. Flags show as letters ("FR") on Windows. | Low |
| Wine Lab, card | Radar + coloured aroma bars | **Good** |
| Pairing Lab | A good idea (ingredient in the centre, partners around it) but small: labels overlap, and half the screen above it is empty | Medium |
| Cookbook popup | Ingredients and method as a wall of text; the profile charts sit at the bottom where few people scroll | Low |
| Recipe Notebook | Cream paper — a different look from every lab. Mostly empty when you start. | Low, and off-theme |
| Loading screens | "Loading Cocktail Lab v2…" with a purple spinner; landing dims during data load with no progress cue | Off-theme |

## Recommendations, in order of value for effort

1. **Collapse the Cocktail Lab filters behind one "Filters" chip** (with a
   count of active filters). Puts the glass and bottle drawings back on
   screen; also hide the chip-row scrollbars. *Small.*
2. **Give every list row a picture.** Reuse the chalk-art style already drawn:
   - Wine Lab: one chalk glass per wine family (sparkling flute, white, red,
     rosé, fortified, sweet), tinted with the family colour, on every row and
     at the top of the card. Make the family filter a shelf of glasses like
     the cocktail families.
   - My bar / Invent: the family glass next to each drink; the invented
     drink drawn in its glass, filled with its colour.
   - Cookbook: a cuisine or dish-type chalk icon on each recipe tile.
   *Medium — about 8–10 small SVGs, mostly variants of glasses already drawn.*
3. **Lead the Cookbook popup with a picture of the dish's profile**, not the
   ingredient list: move the taste radar to the top beside the title, show
   ingredients as chips with small icons, keep the method as numbered steps
   under a fold. *Small–medium.*
4. **Pairing Lab: make the graph fill the screen** — larger ring, labels
   placed outside the circles so they cannot overlap, the explainer text
   moved into the "Where do these pairings come from?" footer. *Small.*
5. **One themed loader**: a chalk glass filling up, used by every lab, in
   place of the purple spinner and the dimmed landing. *Small.*
6. **Replace flag emoji with country names or tiny SVG flags** — Windows
   shows "FR" instead of a flag. *Small.*
7. **Recipe Notebook**: decide whether the cream-paper look is deliberate. If
   not, move it onto the chalkboard; either way, show a starter state (three
   suggested ingredients drawn as chalk items) instead of an empty page.
   *Medium.*
8. **Labs menu and Make screen**: swap the line icons for the same chalk
   drawings each lab opens with (glass, sauce pot, wine glass, notebook),
   larger, so the menu previews the labs. *Small.*

Known minor bug seen along the way: a "button inside a button" warning in
the Cookbook radar (MultiAxisRadarStack / ProfileAxisRadar).
