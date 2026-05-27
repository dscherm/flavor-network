# Canonical Make Mode Spec

> **Status**: Authoritative. Supersedes all prior specs, ralplans, and
> plan-document fragments listed in [§12 Source spec lineage](#12-source-spec-lineage).
> When this file disagrees with any other file in the repo, **this file wins**.
> Last revised 2026-05-27.

> **Scope**: The Make feature — a new third entry surface for
> experienced users who want to start building a recipe directly,
> with less hand-holding than Guided Discovery. Covers the Make
> landing tile + top-nav entry, the 3-card picker screen
> (`MakeRecipeStart`), and the three card handoffs into Recipe Lab
> (existing recipe via Cookbook Lab, start from scratch, upload a
> photo stub). The Recipe Lab consumer contract is owned by
> `RECIPE-LAB-SPEC.md` §9; this spec only describes the inbound
> handoff payload Make emits.
>
> **Out of scope**: the Recipe Lab notebook UI, the suggestion
> engine, the aroma-match bridge, per-ingredient portions and
> auto-portion inference, focal-weighted suggestion ranking, the
> food-category filter, and sauce + seasoning recommendations.
> Those are extensions to `RECIPE-LAB-SPEC.md` shipping in parallel
> under `DOCS-MAKE-MODE` and reference components 6–10 of the
> deep-interview topology (see §1.5). The Guided Discovery feature
> (sibling top-level tab) is fully scoped in
> `GUIDED-DISCOVERY-SPEC.md`.

> **How to use this document**: each section is a self-contained
> contract. Source spec citations live at the end; you do not need
> to read the source specs to implement the feature. Where Make
> hands off to a downstream consumer (Recipe Lab, Cookbook Lab),
> the section cites the consumer's authoritative spec — Make does
> NOT redefine that consumer's contract.

---

## Table of Contents

1. [Information architecture](#1-information-architecture)
2. [Make picker screen](#2-make-picker-screen)
3. [Existing-recipe path (Cookbook Lab pass-through)](#3-existing-recipe-path-cookbook-lab-pass-through)
4. [Start-from-scratch path](#4-start-from-scratch-path)
5. [Photo-upload path (stub)](#5-photo-upload-path-stub)
6. [Bridge to Recipe Lab](#6-bridge-to-recipe-lab)
7. [State ownership](#7-state-ownership)
8. [Cross-feature relationships](#8-cross-feature-relationships)
9. [Accessibility + interaction invariants](#9-accessibility--interaction-invariants)
10. [Tests covering the contract](#10-tests-covering-the-contract)
11. [Open questions](#11-open-questions)
12. [Source spec lineage](#12-source-spec-lineage)

---

## 1. Information architecture

### 1.1 Entry points

| Surface | Trigger | Effect |
|---|---|---|
| Landing tile "Make" | `onModeSelect('make')` in `LandingScreen.jsx` | `handleModeSelect('make')` in `App.jsx` → `setActiveTab('make')` |
| Top-level "Make" nav button (primary row, sibling of Explore / Guided) | click | `setActiveTab('make')` |
| Mobile tab bar | `onTabChange('make')` | `setActiveTab('make')` |
| URL deep-link `?path=make` | `PATH_TO_TAB['make'] === 'make'` | `initialTab === 'make'` |

Make replaces the prior "Build" tile + tab as the third top-level
entry. The legacy `'build'` and `'build-results'` keys are kept
under one release of back-compat alias and resolve to `'make'`
during the migration window — see §11 O-1.

### 1.2 Screen flow

```
landing tile / Make nav / ?path=make
                │
                ▼
[Make picker]  activeTab === 'make'      — MakeRecipeStart
   3 vertical cards centered on screen
                │
   ┌────────────┼────────────┐
   │            │            │
 [📖]         [✏️]         [📷]
 Existing    Start from   Upload
 recipe      scratch      a photo
   │            │            │
   ▼            ▼            ▼
[Cookbook]   recipeHandoff  File picker
 picker       (empty bowl)   stub
 mode         setActiveTab    │
   │          ('recipe-lab')  ▼
   │            │           recipeHandoff
   │            │           (empty bowl
   │            │            + image)
   │            │           setActiveTab
   │            │           ('recipe-lab')
   │            ▼            │
   │  Recipe Lab mounts ◀────┘
   │
   ▼
Cookbook Lab (picker mode)
   user picks 1 of 15 seed recipes
                │
                ▼
   recipeHandoff (ingredients + title +
                   recipeType + amounts?)
   setActiveTab('recipe-lab')
                │
                ▼
   Recipe Lab mounts
```

Make is **ephemeral**: it has no Results screen, no persistent state.
Once any card is picked, Make unmounts and the user is routed to either
Cookbook Lab (picker mode) or directly to Recipe Lab.

### 1.3 Routing key

```js
activeTab === 'make'
```

URL alias: `TAB_TO_PATH['make'] = 'make'`. Reverse alias
`PATH_TO_TAB['make'] = 'make'`. Legacy `?path=build` redirects to
`?path=make` for one release window (see §11 O-1).

### 1.4 Exit handoff

Three exits from `MakeRecipeStart`:

1. **📖 Existing recipe** — pushes the user into `CookbookLab` in
   `pickerMode='make'`. Cookbook Lab is then the surface responsible
   for emitting `recipeHandoff` once the user picks a recipe.
   Make itself emits no handoff. See §3.
2. **✏️ Start from scratch** — synthesizes an empty `recipeHandoff`
   payload (`ingredients: []`, `image: null`) and jumps directly to
   Recipe Lab. See §4.
3. **📷 Upload a photo** — opens a native `<input type="file">`
   picker. On image selection, synthesizes a `recipeHandoff` payload
   with `image: <File>` and empty ingredients, then jumps to Recipe
   Lab. See §5.

### 1.5 Topology — 10 components

The deep-interview that produced this spec locked a 10-component
topology. Components 1–5 are owned by THIS spec. Components 6–10
extend `RECIPE-LAB-SPEC.md` in parallel under the same bridge task
`DOCS-MAKE-MODE` and are referenced only.

| # | Component | Owner |
|---|---|---|
| 1 | Make tile (Landing) + top-nav "Make" entry | THIS spec §1.1, §1.3 |
| 2 | Make 3-card picker screen (`MakeRecipeStart`) | THIS spec §2 |
| 3 | Cookbook Lab integration (picker mode pass-through) | THIS spec §3 + Cookbook Lab spec (forthcoming) |
| 4 | Photo upload stub (file picker + image attach) | THIS spec §5 |
| 5 | Bridge to Recipe Lab (`recipeHandoff` payload) | THIS spec §6 + `RECIPE-LAB-SPEC.md` §9 |
| 6 | Per-ingredient portions | `RECIPE-LAB-SPEC.md` §Portions (extension) |
| 7 | Auto-portion inference | `RECIPE-LAB-SPEC.md` §Portions (extension) |
| 8 | Focal-weighted suggestion ranking | `RECIPE-LAB-SPEC.md` §Focal-weighted suggestions (extension) |
| 9 | Food-category filter on suggestions | `RECIPE-LAB-SPEC.md` §Food-category filter (extension) |
| 10 | Sauce + seasoning recommendations | `RECIPE-LAB-SPEC.md` §Sauces+seasonings (extension) |

Make spec must NOT redefine components 6–10. References to them
appear only in handoff payload fields (e.g. `amounts`, `recipeType`)
that downstream consumers interpret.

### 1.6 Tile placement on Landing

The Landing screen carries **4** primary tiles (1 row, 4 columns on
`sm:`+, 1 column on mobile):

| Tile | `id` | Routes to |
|---|---|---|
| Explore the Network | `pairing` | `network` |
| Guided Discovery | `guided` | `guided` |
| **Make** | **`make`** | **`make`** |
| Build your Recipe (legacy alias) | `build` | `make` (one-release redirect; tile removed in the next release) |

Exact tile order, color accent, and icon copy are deferred to design
sign-off — see §11 O-2. The minimum-viable shipping order is
[Explore, Guided, Make]; the Build tile collapses into Make during
the migration window.

---

## 2. Make picker screen

Component: `src/components/MakeRecipeStart.jsx` (new). Mounted at
`activeTab === 'make'`.

### 2.1 Layout

3 vertical cards stacked center-of-screen. Each card spans the full
width of a centered max-w-md container (mobile: 90% viewport; sm+:
`max-w-md` ≈ 28rem) with vertical gap of `gap-4`. The cards sit
inside a `flex flex-col items-center justify-center min-h-[calc(100vh-var(--nav-h))]`
container so the stack reads vertically centered against the safe-
area-respecting nav.

```
┌─────────────────────────────────────────┐
│  ┌───────────────────────────────────┐  │
│  │ [📖]  Existing recipe              │  │
│  │       Pick from your Cookbook      │  │
│  └───────────────────────────────────┘  │
│  ┌───────────────────────────────────┐  │
│  │ [✏️]  Start from scratch           │  │
│  │       Empty Recipe Lab             │  │
│  └───────────────────────────────────┘  │
│  ┌───────────────────────────────────┐  │
│  │ [📷]  Upload a photo               │  │
│  │       We'll add the image; you     │  │
│  │       fill in ingredients          │  │
│  │       (parsing coming later)       │  │
│  └───────────────────────────────────┘  │
└─────────────────────────────────────────┘
```

### 2.2 Card schema

```ts
{
  id: 'existing' | 'scratch' | 'photo',
  icon: string,           // emoji glyph; see §2.4
  title: string,          // top line, bold
  subtitle: string,       // single line, muted
  onActivate: () => void, // see §2.5
}
```

### 2.3 Card content (locked)

| `id` | `icon` | `title` | `subtitle` |
|---|---|---|---|
| `existing` | 📖 | "Existing recipe" | "Pick from your Cookbook" |
| `scratch` | ✏️ | "Start from scratch" | "Empty Recipe Lab" |
| `photo` | 📷 | "Upload a photo" | "We'll add the image; you fill in ingredients (parsing coming later)" |

Copy is **locked** by deep-interview 2026-05-27. Iconography may be
replaced with hand-drawn SVGs (matching the `LandingScreen.jsx`
`PairingVisual` / `GuidedVisual` / `BuildVisual` pattern) at design
sign-off — see §11 O-3.

### 2.4 Visual style

Mirror `LandingScreen.jsx`'s tile aesthetic (cited as the design-
of-record source). Each card:

- `rounded-xl border bg-[#12203b] p-5 sm:p-6 min-h-[44px]`
- Left accent stripe: `absolute left-0 top-0 bottom-0 w-1` colored
  per card (`#a78bfa` existing / `#38bdf8` scratch / `#f472b6` photo).
  Exact palette is deferred to §11 O-3.
- Icon sized at 48×48 (`w-12 h-12`) inside a `bg-[#0a1428]/60` square.
- Hover/focus: `hover:bg-[#16284a]`, `focus-visible:ring-2 ring-cyan-300/60`.
- `min-h-[44px]` tap target on every interactive element.

### 2.5 Card behaviors

| Card | Click handler |
|---|---|
| `existing` | `setActiveTab('cookbook')` + `setCookbookPickerMode('make')` (Cookbook Lab opens in picker mode; see §3) |
| `scratch` | `setRecipeHandoff({ source: 'make-scratch', ingredients: [], image: null, recipeType: null, ts: Date.now() })` + `setRecipeMounted(true)` + `setActiveTab('recipe-lab')` |
| `photo` | trigger hidden `<input type="file" accept="image/*">`; on `onChange` fire `setRecipeHandoff({ source: 'make-photo', ingredients: [], image: <File>, recipeType: null, ts: Date.now() })` + `setRecipeMounted(true)` + `setActiveTab('recipe-lab')` |

All three exits unmount the Make screen. `MakeRecipeStart` owns no
state that survives the handoff.

### 2.6 Acceptance

- [ ] `MakeRecipeStart` renders 3 cards in the order: existing, scratch, photo.
- [ ] Cards are vertically stacked + centered on viewport at all breakpoints.
- [ ] Card copy matches §2.3 exactly.
- [ ] Tap targets are ≥ 44px high.
- [ ] Clicking `existing` routes to Cookbook Lab in picker mode (§3).
- [ ] Clicking `scratch` emits an empty `recipeHandoff` + routes to Recipe Lab (§4).
- [ ] Clicking `photo` opens a file picker; selecting an image emits a `recipeHandoff` with the `File` attached + routes to Recipe Lab (§5).
- [ ] Dismissing the file picker (cancel) leaves the user on Make with no state change.

---

## 3. Existing-recipe path (Cookbook Lab pass-through)

### 3.1 Cookbook Lab in picker mode

`CookbookLab.jsx` (current `RecipesLab.jsx`, renamed under
`DOCS-RL-COOKBOOK-RENAME`) accepts a new prop:

```ts
pickerMode?: 'make' | null   // when 'make', tap on a recipe card
                              // emits recipeHandoff + jumps to Recipe Lab
                              // instead of opening the in-place detail modal
```

When `pickerMode === 'make'`, the Cookbook Lab card grid + 3D scene
are unchanged but **the card click handler** is rewired:

| Click target | Default (`pickerMode === null`) | `pickerMode === 'make'` |
|---|---|---|
| Recipe card | Opens `RecipeDetail` modal | Emits `recipeHandoff` (see §3.2) and unmounts Cookbook Lab |
| 3D NetworkScene sphere | Opens `RecipeDetail` modal | Emits `recipeHandoff` (same) |
| `RecipeDetail` "Open in Recipe Notebook →" | Emits `recipeHandoff` (existing path) | n/a — modal is bypassed |

### 3.2 Handoff payload from Cookbook Lab

```ts
setRecipeHandoff({
  source: 'make-cookbook',
  ingredients: [...recipe.ingredients],   // array of strings; from SEED_RECIPES
  image: null,
  recipeType: recipe.cluster,             // e.g. 'savory' / 'baking' / 'seafood' / 'vegetable'
  title: recipe.name,
  amounts: null,                          // SEED_RECIPES today has no per-ingredient amounts
  mode: 'recipe',                         // back-compat with RECIPE-LAB-SPEC §9 mode coercion
  ts: Date.now(),
});
setActiveTab('recipe-lab');
```

Notes:

- `recipeType` carries the seed-recipe's `cluster` field
  (`savory` / `baking` / `seafood` / `vegetable`) verbatim. Recipe
  Lab's recipe-type classification (Recipe Lab spec extension
  component 10) is the consumer that interprets this.
- `amounts` is `null` for current seed recipes; the auto-portion
  inference path in Recipe Lab (component 7) backfills.
- `title` is REQUIRED on this path so Recipe Lab's title input
  pre-populates with the dish name (matches the Profile "Load Recipe"
  path in `RECIPE-LAB-SPEC.md` §9.1).

### 3.3 Cookbook Lab picker-mode UI affordances

- A persistent breadcrumb chip top-of-screen: **"Make → Pick a recipe"**.
  Tapping the chip returns to Make (`setActiveTab('make')` +
  `setCookbookPickerMode(null)`).
- The card grid header copy changes from "15 hand-curated seed recipes"
  (the default Cookbook Lab framing) to **"Pick one to start cooking"**.
- `externalFilter` props from the Build flow are ignored while
  `pickerMode === 'make'`.

### 3.4 Acceptance

- [ ] `CookbookLab` accepts `pickerMode='make'` prop.
- [ ] When set, recipe-card click emits `recipeHandoff` per §3.2 (does NOT open `RecipeDetail`).
- [ ] Breadcrumb chip "Make → Pick a recipe" returns the user to Make on tap.
- [ ] `recipeType` field on the payload equals the seed recipe's `cluster` value verbatim.
- [ ] `title` field on the payload equals the seed recipe's `name` value verbatim.
- [ ] Returning to Make from Cookbook Lab does NOT leave `cookbookPickerMode` set.

---

## 4. Start-from-scratch path

### 4.1 Direct handoff

The `scratch` card click handler emits an **empty** `recipeHandoff`:

```js
setRecipeHandoff({
  source: 'make-scratch',
  ingredients: [],
  image: null,
  recipeType: null,
  title: '',
  mode: null,           // → Recipe Lab labMode resolves to 'taste'
  ts: Date.now(),
});
setRecipeMounted(true);
setActiveTab('recipe-lab');
```

### 4.2 Recipe Lab behavior on empty handoff

Per `RECIPE-LAB-SPEC.md` §9.2, the handoff watcher's invariant is
`if (incoming.length === 0) return;` — an empty `ingredients` array
would normally be a NO-OP. The Make path violates that invariant
intentionally: an empty bowl IS the user's intent on the scratch
path. Two implementation choices are valid:

1. **Sentinel field.** Add `source: 'make-scratch'` to the watcher's
   bypass list so empty bowls still execute the watcher (clearing
   any pre-existing bowl, resetting title, etc.).
2. **Mounting-only behavior.** Skip the watcher entirely for empty
   payloads and rely on the first-mount `initialIngredients=[]`
   path. Drawback: if Recipe Lab is already mounted from a previous
   session, the bowl will NOT clear.

**Decision:** option 1. `RECIPE-LAB-SPEC.md` §9.2 will be amended
under `DOCS-MAKE-MODE` to drop the `incoming.length === 0` early
return when `handoff.source` starts with `make-`.

### 4.3 Acceptance

- [ ] `scratch` card click emits a `recipeHandoff` with `ingredients: []`.
- [ ] Recipe Lab clears any pre-existing bowl, resets `recipeTitle`, and shows the empty notebook on mount.
- [ ] `labMode` resolves to `'taste'` (per §9.5 mode coercion).
- [ ] Returning to Make from Recipe Lab does NOT re-fire the handoff.

---

## 5. Photo-upload path (stub)

### 5.1 Stub scope — image attached, ingredients NOT parsed

The photo-upload card is a **STUB** by deep-interview 2026-05-27
decision. The shipping behavior:

| Step | Behavior |
|---|---|
| User taps `📷 Upload a photo` | Hidden `<input type="file" accept="image/*" capture="environment">` is clicked programmatically |
| User picks an image | `<input>` fires `onChange` with `e.target.files[0]` |
| Selected file is a valid `image/*` | App emits `recipeHandoff` with `image: <File>` and `ingredients: []`, then routes to Recipe Lab |
| User cancels the picker | NO-OP; user stays on Make with no state change |

**The app does NOT parse the image.** No OCR. No LLM extraction.
No vision model. The image is attached to the bowl as a preview
thumbnail only; the user fills in ingredients themselves.

### 5.2 Handoff payload from photo path

```js
setRecipeHandoff({
  source: 'make-photo',
  ingredients: [],
  image: <File>,        // the raw File object from the picker
  recipeType: null,
  title: '',
  mode: null,
  ts: Date.now(),
});
setRecipeMounted(true);
setActiveTab('recipe-lab');
```

### 5.3 Recipe Lab consumer contract (image preview)

Recipe Lab renders the attached image as a thumbnail near the top
of the notebook (zone 2 header area, above the title input). The
exact placement, size, and remove-image affordance are owned by
`RECIPE-LAB-SPEC.md` and are NOT specified here — see §11 O-4.

Minimum invariants Recipe Lab MUST honor:

- An attached `handoff.image` renders as an `<img>` (created via
  `URL.createObjectURL(file)`) at ≥ 80px tall, with `alt="Recipe photo"`.
- The user can remove the image without clearing the bowl.
- Removing the image revokes the object URL.
- An attached image does NOT change `labMode` or scoring.

### 5.4 File-picker invariants

- `<input>` is mounted as a sibling of the card (hidden via
  `className="sr-only"`), with `ref` exposed to the card's click
  handler.
- `accept="image/*"` constrains the picker to images at the OS level.
- `capture="environment"` hints rear-camera on mobile (no-op on desktop).
- No size cap is enforced at the Make layer (Recipe Lab MAY enforce
  one).

### 5.5 Acceptance

- [ ] `photo` card click triggers a file picker scoped to images.
- [ ] Picking a non-image file (forced via dev-tools) is a NO-OP with no error toast.
- [ ] Picking an image emits a `recipeHandoff` with `image` set to the `File` instance.
- [ ] Cancelling the picker leaves Make mounted with no state change.
- [ ] No OCR / LLM / vision-model code runs anywhere on this path.

---

## 6. Bridge to Recipe Lab

### 6.1 `recipeHandoff` payload shape — Make extensions

Make extends the existing `recipeHandoff` shape defined in
`RECIPE-LAB-SPEC.md` §9.1 with three new fields:

```ts
{
  // Pre-existing fields (RECIPE-LAB-SPEC §9.1)
  ingredients: string[],
  mode: 'recipe' | 'cocktail' | 'sauce' | null,
  ts: number,
  title?: string,

  // New fields introduced by Make
  source: 'make-scratch' | 'make-photo' | 'make-cookbook'
        | 'build' | 'cocktail' | 'sauce' | 'network' | 'profile'
        | 'cookbook',
  image?: File | null,
  recipeType?: string | null,   // e.g. 'savory' / 'baking' / ...
  amounts?: Record<string, number> | null,  // unit-agnostic; component 6/7
}
```

The `source` field is a **breaking** addition to the payload shape
because it must distinguish Make's empty-bowl handoffs from the
existing "if-empty-then-noop" guard in `RECIPE-LAB-SPEC.md` §9.2
(see §4.2 above). All existing callers of `setRecipeHandoff` in
`App.jsx` MUST be updated to set `source` to a non-Make value (one
of `'build'`, `'cocktail'`, `'sauce'`, `'network'`, `'profile'`,
`'cookbook'`) during the same migration commit.

### 6.2 Handoff emission sites — Make-only

| Site | Source value | Image | Ingredients | recipeType |
|---|---|---|---|---|
| `MakeRecipeStart` "Start from scratch" | `'make-scratch'` | `null` | `[]` | `null` |
| `MakeRecipeStart` "Upload a photo" → file picked | `'make-photo'` | `<File>` | `[]` | `null` |
| `CookbookLab` (picker mode) recipe-card tap | `'make-cookbook'` | `null` | seed recipe ingredients | seed `cluster` |

### 6.3 Consumer contract reference

The full handoff watcher contract lives in `RECIPE-LAB-SPEC.md` §9.
This spec only owns the **emit side**. The amendment to drop the
`incoming.length === 0` early return when `handoff.source` starts
with `make-` is tracked in `RECIPE-LAB-SPEC.md` §9.2 (will be added
as part of the bridge task implementing this spec).

### 6.4 Acceptance

- [ ] All three Make exits set `handoff.source` to a `make-*` value.
- [ ] `handoff.ts` is fresh (`Date.now()`) on every emission.
- [ ] `handoff.image` is `null` on every non-photo path.
- [ ] `handoff.ingredients` is an array (never `undefined`, never `null`).
- [ ] Existing non-Make handoff sites (Network, Build, Cocktail, Sauce, Profile, Cookbook detail-modal) set `source` to a non-Make value in the same commit that introduces this contract.

---

## 7. State ownership

**Make owns NO persistent state.** It is a pure router: a click on
any card synthesizes a payload (or delegates to Cookbook Lab) and
unmounts.

### 7.1 State map

| State | Owner | Notes |
|---|---|---|
| `activeTab` | `App.jsx` (`useState`) | Set to `'make'` on Make entry; replaced on card-click exit |
| `recipeHandoff` | `App.jsx` (`useState`) | Set by Make's scratch / photo cards directly; set by Cookbook Lab on the existing-recipe path |
| `cookbookPickerMode` | `App.jsx` (`useState`, new) | `'make' | null`. Set to `'make'` when the existing-recipe card is tapped; cleared when the user returns to Make or commits a Cookbook pick. |
| `recipeMounted` | `App.jsx` (`useState`) | Lazy-mount latch for Recipe Lab; set to `true` on every Make card commit |
| Image preview File | not owned by Make | The `File` lives only inside the `recipeHandoff` payload; Recipe Lab is responsible for `URL.createObjectURL` lifecycle |
| File picker `<input>` ref | `MakeRecipeStart` (local `useRef`) | Local-only; survives only as long as the component is mounted |

### 7.2 No `useEffect` writes back to App

`MakeRecipeStart` MUST NOT call any setter beyond the three exit
handlers (and the hidden file `<input>` onChange that drives the
photo handler). In particular, Make MUST NOT call:

- `setFilterStack`
- `setSelectedNodes` / `setSelectedNode`
- `setBubbleStack` / `setBuildStack`
- `setMode` / `setTreeFilter`

This isolation matches the Guided Discovery Constraint #4
(`GUIDED-DISCOVERY-SPEC.md` §5) — entry routers don't reach into
downstream feature state.

### 7.3 Acceptance

- [ ] `MakeRecipeStart` has no `useState` of its own beyond optional UI flags.
- [ ] Grep gate: `MakeRecipeStart.jsx` imports no `setFilterStack`, `setSelectedNodes`, `setBubbleStack`, `setBuildStack`, `setMode`, or `setTreeFilter` setters.
- [ ] Returning to Make from Recipe Lab (via tab nav) shows the picker in its initial state — no card pre-selected, no error toast.

---

## 8. Cross-feature relationships

### 8.1 Recipe Lab (downstream consumer)

Recipe Lab is the **canonical destination** for two of three Make
paths (scratch + photo) and the **eventual** destination of the
third (existing via Cookbook). The handoff payload is the only
interface; Recipe Lab does not read any state owned by Make.

Recipe Lab's behavior on Make payloads:

- `source: 'make-scratch'` → empty bowl, `labMode='taste'`, no image, no title.
- `source: 'make-photo'` → empty bowl, `labMode='taste'`, image preview rendered.
- `source: 'make-cookbook'` → bowl populated from seed recipe, title set, `labMode='taste'`, `recipeType` available to Recipe Lab's classifier (Recipe Lab spec extension component 10).

### 8.2 Cookbook Lab (pass-through)

Cookbook Lab is the only feature Make routes to other than Recipe
Lab. The relationship is a pass-through: Make sets
`cookbookPickerMode='make'` and `activeTab='cookbook'`; Cookbook Lab
emits the eventual `recipeHandoff` itself (Cookbook Lab knows the
seed recipe schema; Make does not).

The Cookbook Lab rename is tracked under bridge task
`DOCS-RL-COOKBOOK-RENAME`. Until that task ships, the component is
`RecipesLab.jsx` and `activeTab === 'recipes-3d'`. The Make spec
uses the post-rename names (`CookbookLab.jsx`, `activeTab === 'cookbook'`)
for forward compatibility — see §11 O-5.

### 8.3 Guided Discovery (sibling)

Guided Discovery (`GUIDED-DISCOVERY-SPEC.md`) is Make's sibling top-
level tab. Both are landing-tile entry routers; both exit into
downstream feature surfaces (Guided → Network + Tour; Make → Recipe
Lab). They share NO state. They share NO components. The only
overlap is the landing-screen tile pattern.

A future user-research finding (deferred) MAY consolidate Guided
and Make into one surface with a top-of-screen toggle ("Guide me" /
"I know what I want"). That consolidation is not in scope here —
see §11 O-6.

### 8.4 Build (deprecated)

The legacy Build flow (`BuildRecipeStart` + `BuildRecipeResults`)
is functionally superseded by Make. Specifically:

| Build behavior | Make equivalent |
|---|---|
| BuildRecipeStart's ingredient-card multi-select | Make does NOT pre-pick ingredients in its picker; the user starts in Recipe Lab |
| BuildRecipeResults' `onOpenLab('notebook', ings)` → Recipe Lab | Make's scratch / photo / cookbook paths route to Recipe Lab directly |
| BuildRecipeResults' cocktail / sauce short-circuit | NOT replicated by Make — users wanting a Cocktail or Sauce lab should pick those from Explore → secondary nav |

Build is kept under a one-release back-compat alias
(`?path=build` → `?path=make`). The Build components and bridge
task `BUILD-DEPRECATE` track removal.

---

## 9. Accessibility + interaction invariants

### 9.1 Focus order

When `MakeRecipeStart` mounts, focus moves to the first card
(`existing`). Tab moves focus down the stack: existing → scratch →
photo. Shift-Tab reverses. The hidden file `<input>` is NOT in the
tab order (it's triggered programmatically by the photo card).

### 9.2 ARIA

| Element | Role / ARIA |
|---|---|
| Make screen container | `role="region" aria-label="Make a recipe"` |
| Each card | `<button>` with `aria-label="${title}. ${subtitle}"` |
| File `<input>` | hidden via `className="sr-only"`, NO `aria-hidden` (it's still functionally addressable for screen readers when the photo card is announced) |
| Cookbook breadcrumb chip ("Make → Pick a recipe") | `<button>` with `aria-label="Back to Make"` |

### 9.3 Keyboard

- Enter / Space on a card fires the card's exit handler (same as click).
- Esc on the Make screen is a NO-OP (Make has no dismiss affordance —
  the user must pick a card or use top-nav).
- Esc on the OS file picker is owned by the OS (dismisses picker;
  Make stays mounted).

### 9.4 Touch targets

All three cards are `min-h-[44px]` overall and use generous
internal padding (`p-5 sm:p-6`); icon containers are 80×80
(`w-20 h-20`) so the entire card surface is comfortably tappable.
Single-finger tap is the only required gesture.

### 9.5 Live regions

Make does NOT need an `aria-live` announcer — there is no in-screen
state change (no chip add/remove, no axis-tap highlight). The
transition to Recipe Lab / Cookbook Lab triggers those surfaces'
own announcers.

### 9.6 Reduced motion

No animation on the picker screen. The cards are static. The icon
emojis are not animated. `prefers-reduced-motion: reduce` is a
NO-OP because there is no motion to suppress.

### 9.7 Acceptance

- [ ] First focus on mount lands on the `existing` card.
- [ ] Tab order is existing → scratch → photo.
- [ ] Each card has `aria-label="${title}. ${subtitle}"`.
- [ ] File picker is reachable via the `photo` card's Enter / Space keypress.
- [ ] Cookbook breadcrumb chip is keyboard-reachable and announces "Back to Make".

---

## 10. Tests covering the contract

Planned test coverage (`src/components/__tests__/MakeRecipeStart.test.jsx`,
`src/components/__tests__/CookbookLab.pickerMode.test.jsx`, and
`src/components/__tests__/App.makeRouting.test.jsx`):

| Test | Covers |
|---|---|
| `MakeRecipeStart renders 3 cards in order` | §2.1, §2.3 |
| `card copy matches spec exactly` | §2.3 |
| `clicking 'existing' calls onPick('existing') → setActiveTab('cookbook') + setCookbookPickerMode('make')` | §2.5, §3.1 |
| `clicking 'scratch' emits recipeHandoff with empty bowl + source='make-scratch'` | §2.5, §4.1 |
| `clicking 'photo' opens the file picker` | §2.5, §5.4 |
| `picking an image emits recipeHandoff with image=<File> + source='make-photo'` | §5.2 |
| `cancelling the file picker is a NO-OP` | §5.5 |
| `picking a non-image (forced) is a NO-OP` | §5.5 |
| `CookbookLab in pickerMode='make' emits recipeHandoff on card tap (no RecipeDetail modal)` | §3.1, §3.2 |
| `pickerMode handoff carries recipeType=cluster + title=name` | §3.2 |
| `breadcrumb 'Make → Pick a recipe' returns to Make` | §3.3 |
| `recipeHandoff payload has source field on every emission site` | §6.4 |
| `MakeRecipeStart owns no setFilterStack / setBubbleStack / setMode calls` | §7.2 (grep gate) |
| `first focus lands on 'existing' card` | §9.1, §9.7 |
| `tab order is existing → scratch → photo` | §9.1, §9.7 |

### 10.1 Grep gates

| File | Pattern | Expected count |
|---|---|---|
| `src/components/MakeRecipeStart.jsx` | `setFilterStack` | **0** |
| `src/components/MakeRecipeStart.jsx` | `setBubbleStack\|setBuildStack` | **0** |
| `src/components/MakeRecipeStart.jsx` | `setSelectedNodes\|setSelectedNode` | **0** |
| `src/components/MakeRecipeStart.jsx` | `setRecipeHandoff` | **≥ 2** (scratch + photo paths) |
| `src/App.jsx` | `setRecipeHandoff\(\{\s*source:` | **≥ 6** (all emission sites carry `source`) |
| `src/components/CookbookLab.jsx` | `pickerMode === 'make'` | **≥ 1** |

---

## 11. Open questions

### O-1 — Build tile / `?path=build` migration window

How many releases does the legacy Build tile + `?path=build` alias
persist before removal? Deep-interview deferred. Conservative default
in this spec: **one release**. Bridge task `BUILD-DEPRECATE` tracks
removal; the alias is added in the same commit that ships Make and
removed in the next release branch.

### O-2 — Make tile placement on Landing

The 4-tile Landing layout in §1.6 (Explore / Guided / Make / legacy
Build) is the minimum-viable shipping order. The chef-user has not
sign-off on whether Build should ship at all, where Make should sit
in the row (leftmost / center / rightmost), or whether the icon
should be hand-drawn SVG (matching `BuildVisual` / `GuidedVisual` /
`PairingVisual`) or emoji. Design pass deferred.

### O-3 — Picker card icons

The 📖 / ✏️ / 📷 emoji glyphs in §2.3 are placeholders. Design has
not approved whether the shipping cards use emoji or hand-drawn
SVG (consistent with the three Landing tile visuals). Copy is
locked; icon form is not.

### O-4 — Image preview placement in Recipe Lab

`RECIPE-LAB-SPEC.md` does not currently describe where an attached
recipe photo renders inside the notebook. Make's spec only requires
that the image render at ≥ 80px tall with alt text and a remove
affordance (§5.3). Exact placement, sizing, and styling are owed
to the Recipe Lab spec extension under `DOCS-MAKE-MODE`.

### O-5 — Cookbook Lab rename ordering

The Cookbook Lab rename (`DOCS-RL-COOKBOOK-RENAME`) and the Make
spec (`DOCS-MAKE-MODE`) can ship independently. Make uses the
post-rename names internally; if the rename slips, Make ships
against `RecipesLab.jsx` + `activeTab === 'recipes-3d'` and adds a
small adapter shim during the migration window. Decision deferred
to bridge sequencing.

### O-6 — Hamburger / in-app menu entry

Whether Make is reachable from any secondary entry surface (in-app
hamburger menu, ?path=make deep-link from a chef's profile card,
etc.) beyond the Landing tile and the top-nav tab is deferred to
the next product round. Today: Landing tile + top-nav + mobile tab
bar + `?path=make` are the only entry surfaces.

---

## 12. Source spec lineage

This canonical spec consolidates one deep-interview transcript and
one bridge task. Where any source disagrees with this spec, **this
spec wins**.

### 12.1 Deep-interview transcript

| Source | Status |
|---|---|
| Deep-interview 2026-05-27 (8 rounds, final ambiguity 17%) | Superseded by §1–§9 |

The deep-interview locked:

- The 10-component topology (§1.5) — components 1–5 owned by this
  spec, components 6–10 deferred to `RECIPE-LAB-SPEC.md` extensions.
- The 3-card vertical-stack picker (§2) — copy locked, icons
  deferred.
- The photo-upload **stub** scope (§5) — file picker only, no
  parsing.
- The Cookbook Lab pass-through pattern (§3) — Make does not own
  the seed-recipe schema.
- The empty `recipeHandoff` pattern (§4, §6) — requires a `source`
  field on the payload to bypass `RECIPE-LAB-SPEC.md` §9.2's
  empty-bowl guard.
- State ownership: Make owns no persistent state (§7) — mirrors
  Guided Discovery's Constraint #4.

### 12.2 Bridge task

| Source | Status |
|---|---|
| `plan.md` bridge task `DOCS-MAKE-MODE` (priority 1) | This spec is the deliverable; the same bridge task also extends `RECIPE-LAB-SPEC.md` for components 6–10 |

The bridge task acceptance criteria include both `MAKE-MODE-SPEC.md`
existing and `RECIPE-LAB-SPEC.md` carrying the matching component
6–10 sections. Spec lineage in both files cites the deep-interview
2026-05-27.

### 12.3 Sibling and adjacent specs

- `GUIDED-DISCOVERY-SPEC.md` — sibling top-level tab; mirror for
  the entry-router pattern, Constraint #4 state isolation, and the
  Information Architecture section style.
- `RECIPE-LAB-SPEC.md` — downstream consumer; cited at §6 (handoff
  payload shape) and §9.1 (handoff entry-point table that this spec
  adds three rows to).
- `NETWORK-AND-AFFINITY-SPEC.md` — format template; mirrored for
  header block, self-contained-section-as-contract convention, and
  §Source spec lineage layout.

### 12.4 Architecture context

- `.claude/CLAUDE.md` — top-level architecture overview; Make is
  reached via the top-level "Make" tab + Landing tile + `?path=make`
  URL alias.
- `plan.md` (root) — bridge tasks `DOCS-MAKE-MODE`,
  `DOCS-RL-COOKBOOK-RENAME`, and the parallel Recipe Lab
  extensions; landing-tile structure section.

---

## How to revise this spec

1. Edit this file directly.
2. Bump the "Last revised" date at the top.
3. Source specs in `.omc/specs/` and deep-interview transcripts in
   `.omc/sessions/` remain as historical artifacts — do NOT update
   them.
4. Update tests, code, and any external docs to match this spec.

When the spec is in conflict with the shipped code:

1. Check whether the code is wrong (open an issue + fix).
2. Or whether this spec is wrong (open a spec-revision PR).
3. Never silently align one to match the other — make the
   divergence explicit.
