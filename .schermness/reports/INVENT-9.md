# INVENT-9 — Cocktail Lab invent starts empty

`src/components/InventCocktail.jsx` is rebuilt on the INVENT-8 pieces. It never adds an ingredient or a name by itself. `fillRequired` and `InventSlots` are no longer used by this panel (InventSlots.jsx left in place).

## Panel props
`bar` (stock: bottles; CocktailLabV2 already passes bar+kitchen as `stock`), NEW `kitchen = []` (extra stock, merged with `stockFor(bar, kitchen)`), `cocktails`, `families`, `roles`, `pool`, `pairingIndex`, NEW `nodes` (Map name -> `{ gnnProbs }`, may be null), `seed`, NEW `editItem`, NEW `onSave`, `onClose`, `onRiff`, `onOpenRecipeLab`, `onSelectCocktail`.
REMOVED: `initialFamily` (nothing is pre-chosen any more; nobody else passed it).

- `seed = { familyId?, fromName?, base?, pinned: [{ key, source }] }`. Searched ingredients become the list (source 'search'); `seed.base` is added first if not pinned; step 1 is skipped. `familyId` is APPLIED only when `seed.fromName` is true, otherwise the best-fit family is just what the hint recommends. I added `fromName: true` to the cocktail-name branch of `cocktailSeedFromSearch` (additive; tests extended).
- `editItem = { id, name, baseline: { category }, lines: [{ key, amount, role }] }`: opens on that drink, style applied if `category != null`, name filled with its own name, amounts kept as the cook's text, `onSave` input carries the same `id`.
- `onSave(input)` -> Promise `{ status: 'saved'|'signin'|'error', message? }`, passed straight to InventNameSave `status`/`message`. A rejected promise shows status error. With no `onSave` the whole save row is not rendered.

### Exact onSave input
```
{ kind: 'cocktail', id?,            // id only when editItem was given
  name,                             // trimmed
  category: familyId | null,        // null unless a style is chosen/accepted
  lines: [{ key, amount, role }],   // amount = what the box shows (cook's text, else suggestion); role = roleOf(key) | null
  method?, glass? }                 // only when a style is chosen (family build + glass)
```

## Data changes (`src/data/cocktailInvent.js`)
- New export `cocktailAdviceRules(roles)`: `oneOf(isBaseSpirit, ..., { advise: true, kind: 'split-base' })` ("Two base spirits: that's a split base. Fine, just know it.") and `oneOf(sour, ..., { advise: true, kind: 'two-sours' })` ("Two sours: check the balance."). `cocktailSkeleton` now uses them, so neither refuses any more; only a duplicate is refused (inventBuild's guard).
- `rankCocktailSlot({ slot: null, ... })` ranks the whole pool, every role, by mean pairing with `currentKeys` plus the commonness bonus, bar first. A slot still ranks as before.

## Test ids
Panel: `invent-cocktail`, `invent-close`, `invent-source`, `invent-advice` / `invent-advice-split-base` / `invent-advice-two-sours`, `invent-card`, `invent-glass` (data-color, data-tinted), `invent-drink-glass`, `invent-style`, `invent-method`, `invent-why`, `invent-nearest`, `invent-restart`, `invent-riff`, `invent-notebook`, `invent-profile-nodata`, `invent-family-glass-{id}`.
Shared components by prefix: `invent-start` (`-question`, `-option`, `-input`, `-go`), `invent-list` (`-line`, `-lines`, `-amount-{key}`, `-remove-{key}`, `-need-{key}`, `-replacements-{key}`, `-replace-option`, `-add-input`, `-add`, `-notice`), `invent-category` (`-toggle`, `-option-{id}`, `-none`), `invent-hint` (`-accept`, `-dismiss`), `invent-checklist` (`-item-{slotId}`, `-open-{slotId}`, `-options-{slotId}`, `-option`), `invent-suggest` (`-item`), `invent-profile` (`-bar-{axis}`, `-summary`, `-uncounted`), `invent-namesave` (`-name`, `-save`, `-reason`, `-status`).
The old `invent-bases`, `invent-families`, `invent-blurb-*`, `invent-slot-*`, `invent-line-*`, `invent-extras`, `invent-name`, `invent-missing` are gone.

## Behaviour notes / interpretations
- Step 1 options: stock base spirits (`have`) then up to 8 common codex spirits; a typed liquor (via `barKey`) is also accepted. After it, the list view appears and stays even if the cook removes every line.
- `have` per line = `coverLine({key, role}, stockSet, roles)` covered and not a same-family substitution. With an EMPTY stock every line is `have: undefined` (no "Don't have it?" noise).
- Replacements: `swapCandidates` over `barRolePool(stock, roles, line)` (same role and kind), so only things the cook has. Replace keeps the cook's edited amount (moved to the new key).
- Amounts: cook's text wins; else the style's `drinkFromBuild` proportions when styled; else `SLOT_DEFAULT_AMOUNT[role]` or `extraAmount`.
- The generated drink name is NOT shown anywhere (name starts empty). `Riff on it` is shown only when a style is set (drinkAsCocktail needs a family); the Notebook button shows whenever the list is non-empty.
- Hint: "Not now" is remembered against the current list signature, so any add/remove brings it back.
- "A {word} usually has": uses the family word (Sour, Stirred, Highball, Spritz, Tropical, Sipper).
- Checklist pick uses `setSlot` (puts the pick in the tapped part).

## Workaround for a shared-piece problem (for the orchestrator)
`clearCategory(build)` sets `rules: []`, which would drop the advice rules of a style-less build. I re-attach them locally: `{ ...clearCategory(build), rules: adviceRules }`. Suggest `clearCategory` keep a `baseRules`-style set (or accept `{ rules }`) so the three panels do not each patch it. Nothing else needed.

## Tests
- `InventCocktail.test.jsx` rewritten: 27 tests (every acceptance criterion plus edit, riff, seed, start over, kitchen, no-nodes).
- `cocktailInvent.test.js`: refusal test replaced by advice tests, plus no-slot ranking and flat-build advice (17 pass).
- `inventSearch.test.js`: `fromName` assertions added.
- Updated tests that mount the real panel: `CocktailLabV2.inventThis.test.jsx` (4), `drinkGlasses.test.jsx` (Invent block, 3).
- Full suite with a 30s timeout: 2487 pass, 1 timeout (MakeRecipeStart.inventThis, passes alone). Plain `npm run gate` runs hit 5s timeouts in a different unrelated file each time (CookbookLab.design3, then SuggestionDrawer.addMode and WineLab.glasses); each passes alone. The machine was loaded by three other agents' gates. `vite build` passes. A quiet-machine gate run is worth repeating once at merge.

## Needs eyes at 375px
The whole stack is now one long column: list rows (name + 80px amount box + remove), the Don't-have-it chips, the collapsed style row, the hint, the checklist, suggestion chips, the 11 flavor bars, the style card with the 92px glass, then name/save and the three buttons. Check: long ingredient names truncate without pushing the amount box; the style picker opened (6 rows with 30px glasses); the card's glass + title + method line wrap; nothing scrolls horizontally.
