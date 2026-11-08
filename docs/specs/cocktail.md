# cocktail as-built specs

## COCKTAIL-FOUND-1 — Cocktail Lab foundation: named sub-groups, normalised glass, suggested amounts, brand aliases, loader tests

The 15 data-driven sub-groups get hand names (src/data/cocktailSubclusters.js) shown in the menu and on cards; 40+ glass spellings fold into 10 types with a fallback from ice/build; cocktails without quantities (217/441) show per-slot house amounts marked '~ suggested' instead of nothing (src/data/cocktailAmounts.js); brand/bar-shorthand aliases (St-Germain, Jack Daniels, sour mix, …) and ice/soda/cola as trivial; tests for the codex loader, similarity, and every sub-group having a name.

## COCKTAIL-FACETS-1 — Cocktail Lab search by occasion, season, strength, character, effort, glass

src/data/cocktailFacets.js derives facets per cocktail by rule from slots, build method, ice, glass, family and seasonal ingredients (no hand tags yet); a chip rail in CocktailBrowse filters on them with per-chip counts under the other active filters, plus No egg / No dairy toggles. Occasion tags are rule-bootstrapped and still want a human pass.

## COCKTAIL-RIFF-1 — Cocktail Lab: riff on a classic

'Riff on this' on every cocktail card opens a panel listing the drink's lines with their role; each line offers same-role swaps (slot dictionary, cleaned of garnishes and whole fruit) ranked by co-occurrence with the rest of the drink; after any change the panel names the closest existing cocktails (shared ingredients, spirits compared by family, base spirit weighted double). Reset, and 'Write this riff in the Recipe Notebook'. src/data/cocktailRiff.js + src/components/CocktailRiff.jsx; LabNodeCard gains an actions prop.
