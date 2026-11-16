# The recipe builder

There is one recipe builder, on the chalkboard. The **Recipe Notebook** tab (`?path=notebook`) and **Make a recipe** both end at it. The paper notebook that used to be the Recipe Notebook is gone.

## What it is

`RecipeBuilderTab.jsx` hosts `InventRecipe.jsx` (the same chalkboard panel the cocktail and sauce builders are made from: `Invent*` pieces and `chalkTheme.js`). The tab host owns sign-in and saving (`useSaveInvention` -> `saveInvention`, so amounts, picture and share are kept), the kitchen the cook told the app about, and a loader until the ingredient graph is there.

One instance is mounted and hidden (not unmounted) when another tab is open, so a build in progress survives going to the Cocktail Lab and back, My kitchen, and the cocktail / sauce / wine matches. A new handoff replaces the build; **Start over** clears it.

The builder starts empty. It asks for the main ingredient, then optionally a dish type and a cuisine; ingredients go in only when the cook adds them. It offers:

- suggestions ("Goes well with what you have") as quick chips, and **See how each changes the flavor**, which opens the one swipeable suggestion deck (before and after flavor grids, Add on each card);
- stand-ins for ingredients the cook does not have, as chips and as the same deck in swap mode;
- the flavor profile (tasting note and strips, swipe to the wheel), and the **Flavor Profiles** card (overview bars, the flavor map with one mark per ingredient, per-note pages with Boost and Temper, Enhance, Pairings);
- Find a cocktail, Need a sauce, Find wines, cooking-method chips, the closest real recipe and its method;
- a picture (chalk drawing, chalk-filtered photo or none), save (amounts kept), share.

## Doors

| Door | Opens with |
|---|---|
| Labs > Recipe Notebook, `?path=notebook` | the first question (or the build left there) |
| Make a recipe > Invent a recipe | the same builder tab |
| Make a recipe: kitchen or a real recipe, link import, photo | lines, title, method steps; a photo is offered to the picture chooser |
| Network panel "build recipe" | the selected ingredients |
| Profile "load recipe" | lines, title; an invention also its amounts, dish type, cuisine and its own id |
| Cocktail Lab / Sauce Lab "Write it in the Recipe Notebook" | the drink's or sauce's lines |
| Cookbook (picker and recipe card) | lines and title |
| Cookbook "Invent this" (search) | the seed: type, main, the searched ingredients |
| Pairing Lab "send to recipe" | the plate and title |
| A shared page's "Make it your own" | that recipe as a seed |

Recipes the old notebook saved (names only) still list in the Cookbook and Profile, open in the builder with no amounts, and saving replaces that one entry instead of adding a copy. Nothing stored is migrated in place.

## What was retired with the paper page

Swipe-left to delete (the remove button stays), the per-row match percentage, the "focal" flag with Recenter and focal-weighted ranking, the starter-ingredients empty state, and the Notebook picking up the 3D Network's selection by itself. Deleted in BUILDER-5: `RecipeLab`, `RecipeLabMobile`, `RecipeNotebook`, `NotebookStarter`, `NotebookCanvas`, `RecipePanel`, `RecipeAnalysis`, `RecipeFlavorWheel`, `IngredientSuggestionsPopout`, `SuggestionDrawer`, `SuggestionDrawerToggle`, `SwipeDeckCard`, `AromaHexWheel`, `CocktailBuilder`, `CocktailPanel`, with their tests. `docs/RECIPE-LAB-SPEC.md` describes them and is marked retired.

## The ingredient card

Tapping an ingredient name opens its chalk card (`IngredientCard.jsx`, from `IngredientCardProvider.jsx`, mounted once in `App.jsx`; the card chunk loads on first tap). It is the Pairing Lab's card for one ingredient plus "Pairs well with", **Open in Pairing Lab**, and inside a builder **Add to this drink / sauce / recipe** or **Swap it in**. It closes with Back, Escape or a tap outside.

Names that open it (`IngredientName`, a button labelled "About garlic"; `IngredientInfoButton`, a small "i", where the name's own tap does another job):

- builder lines in all three builders; suggestion and stand-in chips (the "i");
- deck cards;
- Flavor Profiles "Driven by" and the "Driven by" line on cocktail and sauce cards;
- cocktail, sauce and wine detail card ingredient lines and "pairs with" chips;
- Cookbook recipe cards; What do I need (missing rows); shopping list rows.

Not on the public shared recipe page (it would need the large dataset there) and not in free text the app cannot match to an ingredient. The card reads the graph the app already holds; nothing is fetched for it.

## Where the code is

| Piece | File |
|---|---|
| Tab host | `src/components/RecipeBuilderTab.jsx` |
| The builder | `src/components/InventRecipe.jsx`, `src/data/inventRecipe.js`, `dishSkeletons.js`, `inventBuild.js` |
| The deck | `SuggestionCardDeck.jsx`, `InventDeck.jsx`, `IngredientProfileCard.jsx` |
| Flavor Profiles card and map marks | `RecipeFlavorProfilesCard.jsx`, `FlavorWheel.jsx`, `src/data/flavorMarks.js` |
| Ingredient card | `IngredientCardProvider.jsx`, `IngredientCard.jsx`, `src/data/ingredientCard.js` |
| Saving | `useSaveInvention.js`, `useUserProfile.js` (`saveInvention`, `saveInventionWithPicture`), `savedInventions.js` |

Saving the same build twice in one session with a picture chosen updates the first save (a save with no id reuses the saved item that has the same name, as recipes without a picture already did).
