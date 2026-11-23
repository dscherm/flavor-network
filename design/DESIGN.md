# Design: flavor-network (Neural Flavor)

The design system for the chalkboard app. Written 2026-11-22 (LOOK-1) from what the code uses today, measured against
the owner's `~/.claude/design-criteria.md`. Where today's code breaks a rule it is named in the Never list, not hidden.
Every colour below is a role with a name; no literal colour may appear in a component outside the token files.

Token files today:
- `src/data/chalkTheme.js` (slate, chalk inks, cream recipe card)
- `src/components/inventUi.jsx` (accent, sans stack, shared button, input, heading and small-print styles)
- `src/data/recipeProfileAnalysis.js` (`TASTE_COLOR`) and `src/data/recipeScoring.js` (`AROMA_COLORS`)
- `src/index.css` (focus ring, safe-area and bar-height variables)
- `index.html` (the font link)

LOOK-6 moves the roles into one token block; until then each entry names where it lives now.

## 1. Colour roles

| Role | Hex | File and variable today | Job |
|---|---|---|---|
| Slate ground | #0a0a0a (wash from #1c1c1c to #050505) | `chalkTheme.js` `CHALK_BG`, `CHALK_GRADIENT`, `chalkSurfaceStyle()` | Page background of every chalk surface |
| Slate dust | 5% white noise | `chalkTheme.js` `CHALK_TEXTURE` | Grain over the ground, never over text |
| Chalk text | #f5efde | `chalkTheme.js` `CHALK_CREAM` | Titles, body, ingredients, anything read |
| Muted chalk | #bdb6a3 | `chalkTheme.js` `CHALK_DIM` | Secondary text, labels that name a value |
| Faint chalk | #8a8478 | `chalkTheme.js` `CHALK_SUB` | Small print, credits, captions |
| Rail | #4a4a4a | `chalkTheme.js` `CHALK_RAIL` | The border of a clickable control or a held state, and chalk rules between sections |
| Chalk glow | 0 0 1px / 0 0 3px cream at 50% and 20% | `chalkTheme.js` `CHALK_SHADOW` | Text shadow on drawn titles only |
| Accent | #e8c97a | `inventUi.jsx` `ACCENT` (copied as `accent` in `shareCardLayout.js` line 52) | The ONE primary action in a view and the current state (selected tab, chosen style). Nothing else |
| Focus | #4f9eff | `index.css` `:focus-visible` | Keyboard focus ring. A role of its own, never the accent |
| Error | #f87171 (proposed; no role exists today) | none | Failed save, failed scan, invalid input. Today the error text reuses the accent, see Never |
| Recipe card paper | #f4ecd8, edge #e4d8bd | `chalkTheme.js` `CARD_CREAM`, `CARD_CREAM_EDGE` | Cookbook recipe card only |
| Recipe card ink | #2e2a22, sub #6b6353 | `chalkTheme.js` `CARD_INK`, `CARD_INK_SUB` | Text on the recipe card paper |
| Illustration inks (LOOK-5, owner approved 2026-11-23) | Spirit colours (`COCKTAIL_SPIRIT_COLORS`), the bottle-label ink #211e18, the fills inside the lab drawings (drink #7dd3fc, cherry #dc2626, lime #84cc16 / #bef264, sauce #b91c1c, pencil #fbbf24, wine #e11d48, pairing nodes) and the logo's own colours | `cocktailBaseSpirit.js`, `chalkArt.jsx` (`WINE_RED`, the drawing functions, `bottleMark`), `ChalkLogo.jsx` | The colours inside a chalk drawing. Never on chrome, text, borders or controls |

Data colours (a chart's meaning only; never used for chrome, buttons or headings). The one exception is the family
colours: a family's identity, used ONLY on that family's drawn glass or vessel, its name, and its list rows. Never on a
button, a chip fill, a border or a heading that is not the family's own name:

| Set | Values | File and variable |
|---|---|---|
| Six tastes | sweet #ff5fa2, sour #2bd4d4, bitter #a855f7, salty #5b8def, umami #e0a93b, heat #ff4444 | `recipeProfileAnalysis.js` `TASTE_COLOR` |
| Eleven aromas | fruity #fd875a, floral #e0a9d6, green #7ccc7b, woody #967a51, spicy #c25726, fatty #efe096, toasty #cd7e2d, nutty #ceb89b, earthy #9aa373, smoky #a9aac1, savory #ba4b65 | `recipeScoring.js` `AROMA_COLORS` |
| Fallback axis | #a09070 | `recipeProfileAnalysis.js` `axisColor` |
| Family colours (owner approved, LOOK-3, 2026-11-22) | One colour per cocktail family, sauce family and wine family (cocktail examples: Tropical Sours #047857, Highballs and Fizzes #0369a1, Sour Family #a16207; the full sets are data) | Cocktails: `families[].color` in `public/data/cocktail_codex_v2.json`, read by `cocktailCodexV2.js`. Sauces: `MOTHER_FAMILIES` in `sauceCodex.js`. Wines: `_meta.families[].color` in `public/data/wine_styles.json`, read with `wineStyles.js` `familyColor()`. Dark colours are lifted for text and outline by `popColor` / `liftColor` |

Not tokens (found in `src/`, to be replaced, listed in Never): the tab bar and menus use the cool dark set #0a0a12,
#12121a, #1e1e2e, #2a2a3a and Tailwind grays, blue-400 for Sign in and emerald-300 for the current tab
(`MobileTabBar.jsx`); the 3D Network uses its own palette (parked view, out of scope).

## 2. Spacing scale

Base unit 4 px. Use only these steps.

| Step | px | Use |
|---|---|---|
| 1 | 4 | Inside a group: label to value, icon to word |
| 2 | 8 | Between rows of one list |
| 3 | 12 | Control padding, between a heading and its content |
| 4 | 16 | Page gutter at 375 px; between related groups |
| 5 | 24 | Between sections (paired with a chalk rule where the sections differ in kind) |
| 6 | 40 | Between major blocks on a page; leave some of it bare |
| 7 | 64 | Top of a page under the bar; around the one dominant thing on a start screen |

Rules: tight within a group, generous between sections, never one value everywhere. Touch targets are at least 44 px
tall and wide. At 375 px nothing scrolls sideways. Bars: `--nav-h`, `--tab-bar-h`, `--bottom-safe` in `index.css`.

## 3. Type roles

Faces chosen by the owner: Alegreya Sans for steady text (2026-11-22, specimens in `docs/prototypes/type-specimens.html`);
the chalk hand stays Caveat (2026-11-23: "go back to the previous font for the chalk handwriting (not Kalam)").

| Role | Face | Size and weight | Used for |
|---|---|---|---|
| Display | Caveat (chalk hand; owner, 2026-11-23) | 32 px / 700 | Page and card titles, the hand-drawn moments |
| Heading | Caveat (chalk hand; owner, 2026-11-23) | 22 px / 700 | Section headings, in sentence case |
| Body | Alegreya Sans (steady face; owner, 2026-11-22) | 16 px / 400, line 1.5, measure under 80 characters | Ingredients, method steps, descriptions, inputs |
| Control | Alegreya Sans (steady face; owner, 2026-11-22) | 16 px / 500 (Alegreya Sans has no 600; owner default D3, 2026-11-23) | Button and chip text |
| Small print | Alegreya Sans (steady face; owner, 2026-11-22) | 13 px / 400, in Faint chalk | Credits, counts, sources |

In code (LOOK-6, 2026-11-23): `src/data/chalkTheme.js` names the faces once: `HAND` (Caveat), `TEXT` (Alegreya Sans),
`LOGO_HAND` (the logo's "Nf"), and `TYPE` (display, heading, drawn, body, control, small; body, control and small set
lining tabular figures). Files load from `src/fonts.js` (self-hosted `@fontsource`, latin, Alegreya Sans 400 and 500,
Caveat 400 and 700). `font-synthesis: none` on the body, so a weight that is not loaded is never faked. No system,
Inter, Roboto, Georgia or bare generic stack remains in `src/`.
Share cards (LOOK-6b, 2026-11-23) are images, not screens: both renderers read `CARD_FACES` in `src/data/shareCardLayout.js`
(Caveat 700 for the name, "Ingredients", "Method" and the signature; "Alegreya Sans Lining" 400 and 500 for everything else).
"Alegreya Sans Lining" is the same OFL font with the digits mapped to its lining tabular glyphs (a canvas cannot ask for them),
built by `scripts/buildLiningFont.py` into `public/fonts/` and `functions/fonts/`; it is for canvas and server images only.
Input text is at least 16 px so iOS does not zoom.

## 4. Components allowed

| Component | Tokens | Rule |
|---|---|---|
| Primary button | Accent fill, Slate ground text | Exactly one per view. The action the view exists for |
| Secondary action | Chalk text, no border; or Rail outline when it needs to read as a control | Never more than one outlined control in a row; related actions are one grouped control |
| Chip | Rail border, Chalk text; selected: Accent border | Only for something that toggles or filters. Plain text is text |
| Card | Rail border | Only for something you can open. A list of facts is not cards |
| List row | no border | Separated by space (step 2) and, between groups, a chalk rule |
| Chalk rule | Rail, 1 px, slightly uneven | Separates sections. Preferred over a box |
| Input | Rail border, Chalk text on a faint wash, Focus ring | 16 px text, 44 px tall, label always visible |
| Control radius (LOOK-7, owner approved 2026-11-23) | `chalkTheme.js` `CONTROL_RADIUS` = 8 px | Every control that keeps a border (input, chip, segmented toggle, the primary, a Rail-outline button) has this one radius. A fully round shape (`rounded-full`) is only for a dot, a bar, a page dot, a round swatch, the on/off switch track and the round help button. Never a pill on text |
| Text control (LOOK-7) | `inventUi.jsx` `textAction()` | Chalk text, a Rail underline offset 6 px, a 44 px tall hit area, no box. Related ones sit in one `role="group"`, gap 24 px |
| Add row (LOOK-7) | `inventUi.jsx` `AddRow` | Adding from a list: a "+" in Muted chalk, the name, small print after it; the whole row is the 44 px button. No chip, no fill |
| Drink drawing (LOOK-7) | `cocktailGlasses.jsx` `DrinkDrawing` | A drink with no photo, or whose photo fails to load, shows its glass in chalk line filled in `drinkColor`, with its garnish where the method names one. Never a gradient or a disc. A drink whose photo loads keeps the photo |
| Heading | Display or Heading role, Chalk text | Sentence case. Dropped where the content already says what it is |
| Icon | `src/components/ChalkIcons.jsx`, the one icon set (LOOK-4): each icon its own named export, drawn twice (a faint 2.2x halo under a crisp line, round ends, wobble in the path, no fill, no filter), one ink in `currentColor`, sizes 16, 20 and 24 only. Chalk text or Muted chalk; Accent only when current | Only where an icon is the convention (back, close, previous and next, disclosure, search, filters, share, camera, a shopping list, a checklist tick, the tab bar) or carries meaning a word cannot (Invent: a shaker for drinks, a whisk for food). Pass `title` for an accessible name; decorative beside a word. Nothing else defines a UI icon |
| Tab bar | Slate ground (opaque), Muted chalk at rest, an uneven chalk rule on top | Accent only on the current tab, which is also marked by a drawn underline, a heavier label and `aria-current` |
| Chart | Data colours only | Labelled "a guide, not a taste test" |
| Recipe card (Cookbook) | Card paper and ink tokens | The one place the paper look is used |
| Help disclosure ("?") | `HelpBubble.jsx`, `variant="chalk"`: Rail border, Chalk text, Focus ring | The one place help text lives. A 44 x 44 px "?" button with accessible name "How this works" opens a small dismissible note (tap outside, Escape or the close mark). Used instead of a grey hint paragraph under a title or button |

## 5. Never

From `~/.claude/design-criteria.md`, as it applies here:
- Never ship the system font stack, Georgia or Palatino, or Inter, Roboto, Poppins, Montserrat, Open Sans or Lato as a face.
- Never put a literal colour in a component; use a token. Today the 283 uses of cream and the others are inline (breaks this).
- Never use the accent for anything but the one primary action and the current state. Today it also marks error text, chip fills and tints (breaks this).
- Never reuse one colour for two roles; focus, error, accent and links each have their own.
- Never use purple or blue gradients, radial glows, veils, glow shadows or neon in chrome. Today the slate wash is a radial gradient and `CHALK_SHADOW` is a glow; both stay only as the board's surface and drawn titles (named exception).
- Never build a hero plus three identical cards, or three equal columns with no hierarchy. Today the landing page has six identical boxes (LOOK-5).
- Never wrap every panel, row and control in the same border, radius and padding. Borders only on things you can click or that hold state (LOOK-7).
- Never fill a page with uniform spacing; use the scale in section 2 and vary it (LOOK-7).
- Never show a row of equal-weight word buttons for what is one control, or more than one filled primary per view. Today 'Riff on this', 'Flavor profile' and 'Share' are three equal outlined pills (LOOK-7).
- Never use a pill chip for plain text. Today 171 pill shapes exist in `src/components`, and 'Cocktails like this' is a cloud of boxed pills (LOOK-7).
- Never mix icon sets, glyphs and emoji as icons (LOOK-4).
- Never use hazy, anonymous or glowing imagery as filler; imagery is the app's own chalk drawing.
- Never show engine or developer speak or bland explanatory headings on screen. Numbers come second, in small print.
- Never put a grey hint paragraph under every section or run-on help text; help goes behind a "?" disclosure or is cut.
- Never use motion that is absent everywhere or slot-machine; one or two authored moments, none under reduced motion.
- Never brief an agent without naming the clichés it must not use (this list is the brief).

From the 2026-11-22 review and the LOOK tasks:
- Never use tracked all-caps section labels ('FAMILIES', 'SPIRITS', 'ABOUT THIS DRINK'); 133 uppercase uses in `src/` (LOOK-3).
- Never write meta strings joined by middle dots ('Tropical Sours · Piña coladas & blended'); 83 in `src/` (LOOK-3).
- Never put arrows in labels or buttons ('← Back', 'swipe →', a → bullet before each ingredient) (LOOK-3).
- Never use emoji as icons, the sparkle on every Invent button included; 14 uses of the sparkle, plus the shuffle, cart and bottle emoji (LOOK-4).
- Never use stock line icons, a system font or a stray blue 'Sign in' in the tab bar; the current tab is not emerald (LOOK-4).
- Never use pills for plain text or a box around every list row (LOOK-7).
- Never use a coloured left stripe that carries no meaning, as on the six lab cards (LOOK-5).
- Never lead the landing page with a stats boast. 'Built on 2.2M recipes, 68,417 pairings, and real molecular chemistry' also overclaims (LOOK-5; see `.claude/.chemdataset-status.md`).
- Never show developer words: 'cocktail · card', 'Bridges other families', 'Warming up the recipe model…' (LOOK-3).
- Never leave an empty photo frame when a drink has no photo or the image fails (LOOK-2).
- Never print a recipe line machine-style ('tblsp Coconut milk 3'); amount first, unit spelled, then the ingredient (LOOK-2).
- Never set body text, ingredients and method in the chalk hand; the hand is for titles and drawn moments only (LOOK-6).
- Never let a line run past about 80 characters or clip a label at 375 px (LOOK-6).
- Never rename the logo or the name 'Neural Flavor' as part of this work; that is an open owner decision.

## 6. Required states

Every shared piece lists all four. Words are plain and in the app's voice; no spinner-only states.

| Piece | Empty | Loading | Error | Disabled |
|---|---|---|---|---|
| Ingredient list (`InventList`) | One line saying what to do ("Nothing in the bowl yet"), the add box visible | Rows keep their place; amounts fill in | A row that could not be priced or matched says so in small print and stays editable | n/a |
| Suggestions and deck (`InventSuggestions`, `SuggestionCardDeck`) | "Add an ingredient and suggestions appear" | One line naming what is loading in plain words | "Suggestions are unavailable right now" with the typed add still working | Add is disabled on an ingredient already in the list, with the reason |
| Text box with add (`TextAdd`) | Placeholder only; label stays visible | n/a | Error colour text under the box, role alert | Rail border at 55% opacity, not focusable, reason in small print |
| Primary button | n/a | Label becomes the verb in progress ("Saving"); stays the same width | Returns to its label; the failure shows beside it in the Error colour | Outline only, Faint chalk text, a reason nearby |
| Name and save (`InventNameSave`) | Name box empty with placeholder | "Saving" | "Could not save. Your recipe is still here." in Error colour | Disabled until there is a name and two ingredients, and says which is missing |
| Flavor chart (`InventFlavorProfile`, share cards) | "Not enough flavor data to draw a chart" and no chart | Space held at chart height | The line above, never a wrong chart | n/a |
| Lab menu and card lists | "Nothing matches. Clear a filter" with the filter control in reach | Row-shaped placeholders in Rail, no spinner-only | Plain sentence and a Try again text button | A filter with no results is greyed with its count of 0 |
| Shopping list | Explains the two ways to fill it | Items from storage appear first; sync state in small print | Sync failure in small print; the list still works offline | Checked items drop to the bottom, struck through |
| Photo or picture (`RecipePicture`, drink photo) | No frame is drawn | Chalk "drawing" line while the filter runs | The frame is removed; the recipe shows without it | n/a |
| Sign-in prompt | n/a | "Signing in" | Provider error in plain words and a Try again | n/a |
| Tab bar | n/a | n/a | n/a | The current tab is the only accent; unavailable tabs are Faint chalk and not focusable |
