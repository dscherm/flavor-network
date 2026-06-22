# plan.md — Recipe Flavor Profiles Card: remediation pass (2026-06-14)

**Context**: The Flavor Profiles card + card-format suggestions feature
was already built and shipped in commit `21f2f6c`
(`RecipeFlavorProfilesCard.jsx`, `SuggestionCardDeck.jsx`,
`ProfileDeltaRadar.jsx`, `recipeProfileAnalysis.js` + tests; mounted in
`RecipeLabMobile.jsx`). A 2026-06-14 audit against `.ralph/spec.md`
found the feature is production-green (1319 tests pass) but **Component
2 deviates from the spec** and a few cleanups remain. This plan is the
remediation pass — NOT a greenfield build. Every task below EDITS
existing files; read them first (`check-existing-before-authoring`).

**Goal**: Bring the shipped feature into spec compliance: make the
suggestion UI a real swipeable card deck with per-card before→after
radars, surface aroma-matched pairing names, polish the carousel, and
clean up dead code — all tested, suite green.

**Audit findings (2026-06-14)** — see commit 21f2f6c for shipped code:
- Component 2 (`SuggestionCardDeck.jsx`) shipped as a vertical scroll
  list, not the spec's swipeable card deck; per-row delta is text only,
  no per-card before→after mini-radar (one shared before-only radar).
- Pairings page uses generic "Find cocktails/sauces" routing buttons,
  not aroma-matched names.
- Carousel uses ◀▶ + "1/N", no page dots / touch-swipe.
- Old `RecipeFlavorProfileCard.jsx` (singular) is dead code (unused).
- No tests for `SuggestionCardDeck` / `ProfileDeltaRadar`.

**Cadence**: interactive bridge mode — **pause between each task**.

---

## Reuse map
- Swipe deck reference: `src/components/PairingMode.jsx` (swipe deck) +
  `src/components/PairingModeCard.jsx` (chalk Tinder card).
- Radar (already supports before+delta+movers): `src/components/ProfileDeltaRadar.jsx`.
- Profile math: `src/data/recipeProfileAnalysis.js`
  (`recipeAxisProfile`, `profileDelta`, `topMovers`, `rankByAxisImpact`).
- Aroma match for pairings: `src/data/recipeAromaSimilarity.js`
  (`computeRecipeAroma`) + the cocktail/sauce augment data.
- Mount points: `RecipeLabMobile.jsx` (`SuggestionCardDeck` at :573/:588,
  `RecipeFlavorProfilesCard` at :603).

---

## Task queue (remediation)

### RFP-R1 — Chalkboard profile card (hero before→after radar) for Suggest + R

```json
{
  "id": "RFP-R1",
  "title": "Chalkboard IngredientProfileCard with hero before->after radar; use it in the Suggest + R decks",
  "category": "ui",
  "priority": 1,
  "description": "Replace the cream notebook card in src/components/SuggestionCardDeck.jsx with a DARK CHALKBOARD card matching PairingModeCard's aesthetic (CHALK_BG radial slate, 2px double chalk-rail border, cream Caveat text, chalk-dust text-shadow). Create a reusable src/components/IngredientProfileCard.jsx whose CENTERPIECE is a large, readable BEFORE->AFTER flavor radar over the 11 taste+aroma axes (recipe current profile = faint fill; profile WITH this candidate = bright accent outline; dots on the axes that move most). Hero-radar layout: ingredient name (Caveat cream ~28px), a one-line delta caption ('adds sweet, tempers green'), the big radar (~size 200-240, colored axis labels like PairingModeCard MiniRadar), then a chalk-green Add/Swap pill. SuggestionCardDeck keeps swipe-deck behavior (one card at a time, drag + arrows; optional peek-stack) and renders IngredientProfileCard per candidate for BOTH mode='add' (Suggest) and mode='replace' (R). Extend ProfileDeltaRadar with an optional dark/large variant (or build the radar inside IngredientProfileCard) WITHOUT breaking its existing cream usage. Preserve ALL deck smartness (cuisine-conditioning, ALPHA discount, replace same-category re-rank, WRONG_FOR_NOODLE, add-vs-replace delta, graceful degradation), the onAdd(qty-prefill)/onSwap/onClose contract, and data-testids suggestion-deck-<mode> + deck-commit. Do NOT change recipeProfileAnalysis.js.",
  "acceptance": [
    "New src/components/IngredientProfileCard.jsx: dark chalkboard card (CHALK_BG + 2px double border + Caveat cream) with a LARGE before->after flavor radar as the visual centerpiece + name + delta caption + Add/Swap pill",
    "Before->after radar clearly distinguishes current profile (faint) vs with-candidate (accent), colored axis labels, mover dots; readable at hero size",
    "SuggestionCardDeck renders IngredientProfileCard per candidate as a swipe deck for both add and replace; chalkboard aesthetic (no cream notebook card)",
    "ProfileDeltaRadar existing cream usage in other callers unbroken (dark variant additive)",
    "All existing deck smartness + onAdd/onSwap/onClose contract + data-testids (suggestion-deck-<mode>, deck-commit) preserved",
    "Tests for IngredientProfileCard (renders radar + name + commit) and updated SuggestionCardDeck tests; full vitest suite green; npm run build succeeds"
  ]
}
```

### RFP-R1B — Funnel "+ Add" into the chalkboard card-deck experience

```json
{
  "id": "RFP-R1B",
  "title": "Route the + Add chrome button into the chalkboard IngredientProfileCard deck",
  "category": "ui",
  "priority": 1,
  "description": "Make the '+ Add' chrome flow surface the same chalkboard IngredientProfileCard (with before->after radar) as Suggest/R, so all three entry points share one card experience. Keep a search/filter affordance for browsing the full ingredient universe (cannot swipe 3000+ blind), but present the chosen/filtered candidate as the chalkboard profile card with the before->after radar + Add action, instead of (or layered on) the current IngredientPicker list confirm. Reuse IngredientProfileCard from RFP-R1 and the existing picker filtering/search; preserve onSelect(name)->handleAddIngredient and quantity prefill; keep dish-type filtering. Null-safe.",
  "acceptance": [
    "'+ Add' surfaces the chalkboard IngredientProfileCard with a before->after radar before committing an ingredient",
    "Search/filter still available so the full ingredient universe is reachable",
    "onSelect/handleAddIngredient + quantity prefill + dish-type filter preserved",
    "Consistent chalkboard aesthetic across + Add / Suggest / R",
    "Tests cover the + Add card flow; full suite green; build clean"
  ]
}
```

### RFP-R1C — Chalkboard ingredient card deck in Cocktail Lab

```json
{
  "id": "RFP-R1C",
  "title": "Wire the chalkboard IngredientProfileCard deck into Cocktail Lab's 'Suggested Next'",
  "category": "ui",
  "priority": 1,
  "description": "Cocktail Lab's CocktailBuilder renders a 'Suggested Next' chip row from suggestNextIngredients (CocktailPanel). Add a '✨ Suggest' affordance that opens the full-screen chalkboard SuggestionCardDeck (now generalized with the `candidates` prop) for the cocktail bowl: pass candidates=suggestions.map(s=>s.name), bowlNames=builderIngredients, nodes=cocktailNodes (carry gnnProbs via ...node spread), onAdd=onAddIngredient, qtyPrefill={false} (cocktail has its own qty UI), headerLabel='✨ Cocktail suggestions'. Each card shows the before→after taste+aroma radar of how the candidate shifts the drink. Keep the existing chip row too or replace it — match the recipe-lab pattern. Mount overlay full-screen with Back/×/Esc.",
  "acceptance": [
    "Cocktail Lab can open the chalkboard card deck for ingredient suggestions (before→after radar) and add on commit",
    "Deck fed by existing cocktail suggestions; cocktail nodes' gnnProbs drive the radar",
    "Back/Esc closes without adding; full suite green; build clean"
  ]
}
```

### RFP-R1D — Sauce-suggestion card deck + smart relevance gate

```json
{
  "id": "RFP-R1D",
  "title": "Chalkboard sauce-card deck for 'Suggested sauces' + smart recipe-relevance gate",
  "category": "ui",
  "priority": 1,
  "description": "Build a parallel chalkboard deck for Sauce Lab's 'Suggested sauces' ranker (sauceRecommendation.js): one card per recommended SAUCE showing THAT SAUCE's flavor radar (single-series taste+aroma profile aggregated from the sauce's ingredients via recipeAxisProfile — not a before→after delta). Add a SMART GATE so sauces are only suggested for RELEVANT recipes — suppress the sauce suggestions entirely for recipe types that don't take a sauce (e.g. drinks/desserts) or recipes whose profile/cuisine the ranker can't meaningfully match. Gate decision should be a small pure, testable function (e.g. recipeTakesSauce(recipe/profile/type)). Reuse the deck shell + chalkboard card; commit routes to the existing sauce-open/deep-link.",
  "acceptance": [
    "'Suggested sauces' can render as a chalkboard card deck, one card per sauce with that sauce's flavor radar",
    "A pure, tested smart-gate function only surfaces sauce suggestions for relevant recipes (suppressed otherwise)",
    "Commit/deep-link to the sauce preserved; full suite green; build clean"
  ]
}
```

### RFP-R2 — Aroma-matched cocktail/sauce names on the Pairings page

```json
{
  "id": "RFP-R2",
  "title": "Surface aroma-matched cocktail + sauce names on the Flavor Profiles Pairings page",
  "category": "ui",
  "priority": 1,
  "description": "In src/components/RecipeFlavorProfilesCard.jsx, replace the generic 'Find cocktails'/'Find sauces' buttons on the Pairings page with actual aroma-matched cocktail + sauce NAMES computed via src/data/recipeAromaSimilarity.js (computeRecipeAroma) against the cocktail/sauce augment data, alongside the existing similar-dish titles. Keep deep-link routing: tapping a named cocktail/sauce (or a 'see all' affordance) still calls onFindCocktail/onFindSauce. Null-safe: if aroma data unavailable, fall back to the current routing buttons. Reuse existing aroma-match code; do not touch Cocktail/Sauce Lab internals.",
  "acceptance": [
    "Pairings page lists aroma-matched cocktail names and sauce names (not just generic buttons)",
    "Names computed via existing recipeAromaSimilarity (no new model)",
    "Tapping a named pairing still deep-links via onFindCocktail/onFindSauce",
    "Graceful fallback to routing buttons when aroma data unavailable",
    "Tests cover the named-pairings rendering + fallback; suite green; build clean"
  ]
}
```

### RFP-R3 — Carousel page-dots + touch-swipe

```json
{
  "id": "RFP-R3",
  "title": "Add page-indicator dots + touch-swipe to the Flavor Profiles carousel",
  "category": "ui",
  "priority": 2,
  "description": "In src/components/RecipeFlavorProfilesCard.jsx, add page-indicator dots (one per axis page + pairings) and touch-swipe navigation between pages, keeping the existing ◀▶ arrows and the N/total counter as fallback. Reuse swipe handling consistent with PairingMode if practical. Mobile-first; keep the chalk visual language.",
  "acceptance": [
    "Page-indicator dots render (one per page) and reflect the active page",
    "Touch-swipe moves between pages (arrows still work)",
    "No regression to existing card tests; suite green; build clean"
  ]
}
```

### RFP-R4 — Delete dead code + final integration verify

```json
{
  "id": "RFP-R4",
  "title": "Delete dead RecipeFlavorProfileCard.jsx (singular) + final integration verify",
  "category": "verify",
  "priority": 2,
  "description": "Grep-confirm src/components/RecipeFlavorProfileCard.jsx (the OLD singular component) is imported nowhere, then delete it (and any now-orphaned tests for it). Do a final pass: all spec acceptance criteria satisfied, graceful-degradation verified, no regressions. Run the full vitest suite and production build.",
  "acceptance": [
    "RecipeFlavorProfileCard.jsx (singular) deleted after grep confirms zero usage; no broken imports",
    "All .ralph/spec.md acceptance criteria demonstrably satisfied post-remediation",
    "Graceful-degradation path still holds (model/index unavailable -> static analysis renders)",
    "Full vitest suite green; npm run build succeeds"
  ]
}
```

---

## Notes
- Mark a task done by setting `"passes": true` in its block, then
  `python $RALPH_HOME/tools/bridge_state.py done <id>`.
- Prior plan queues (Seamless UX, N1/N2/N3, greenfield RFP-1..5) live
  in git history; replaced per repo convention.
- The RFP card-deck initiative above is **shipped + deployed**
  (neuralflavor.web.app). The next planned initiative follows.

---

# NEXT INITIATIVE (PLANNED — not started): Recipe Flavor Profile Overview

Crystallized via deep-interview 2026-06-17 (full spec in `.ralph/spec.md`
§"Flavor Profile Overview"). Surfaces here for `--what-next`. Decisions:
rule-based description NOW + explore a **local on-device** model (ONNX,
NOT a cloud/Claude API); **quantity-weight** the profile (defer prep
inference); reuse boost/temper for the enhance card; new **Overview**
page first in the chalkboard Flavor Profiles carousel.

### FP-OV-1 — Overview page: quantity-weighted flavor bar chart

```json
{
  "id": "FP-OV-1",
  "title": "Overview page: quantity-weighted horizontal flavor bar chart on the chalkboard Flavor Profiles card",
  "category": "ui",
  "priority": 1,
  "description": "Add a new page-0 'Overview' to src/components/RecipeFlavorProfilesCard.jsx (before the Flavor map). Render a HORIZONTAL bar chart of the recipe's flavor percentages across the 11 taste+aroma axes, where each ingredient's contribution is WEIGHTED BY ITS PREDICTED/ENTERED QUANTITY (reuse quantityRuntime predictions / entered amounts; fall back to equal weight when amounts unknown). Bars use axisColor + axisLabel + %. Chalkboard styling. Re-index the carousel (Overview, Flavor map, per-axis pages, Pairings) + page dots/swipe.",
  "acceptance": [
    "Overview page renders a horizontal flavor bar chart (taste+aroma %) weighted by ingredient quantity",
    "Equal-weight fallback when quantities unavailable; null-safe",
    "Carousel re-indexed (Overview first) with dots/swipe; chalkboard styling",
    "Pure quantity-weighting logic unit-tested; full suite green; build clean"
  ]
}
```

### FP-OV-2 — Rule-based smart flavor description (on-device, no API)

```json
{
  "id": "FP-OV-2",
  "title": "Rule-based smart flavor-profile description (on-device, no external API)",
  "category": "logic",
  "priority": 1,
  "description": "Add a pure, tested generator that writes a chef-like paragraph describing the recipe's flavor from: the quantity-weighted taste/aroma/mouthfeel profile, the dominant + balancing axes, the driving ingredients, and the aroma-match signal. NO external LLM/API — fully on-device/deterministic. Surface it on the Overview page beneath the bar chart. Preparation-method nuance is OUT here (deferred — FP-OV-5).",
  "acceptance": [
    "Pure function maps weighted profile + drivers + aroma signal -> a readable multi-sentence description",
    "No network/LLM dependency; deterministic + unit-tested across profiles (sweet-lean, balanced, faint, umami-rich, etc.)",
    "Rendered on the Overview page; full suite green; build clean"
  ]
}
```

### FP-OV-3 — 'More {axis}? Try…' enhance card with ingredient buckets

```json
{
  "id": "FP-OV-3",
  "title": "'More {axis}? Try…' enhance card (boost/temper) with Make-a-Recipe-style ingredient buckets",
  "category": "ui",
  "priority": 1,
  "description": "Add a swipeable enhancement page/section to the Flavor Profiles card: per flavor axis, 'More {axis}? Try …' showing model-ranked candidates (REUSE recipeProfileAnalysis.rankByAxisImpact boost/temper) rendered as the Make-a-Recipe-style ingredient mini-card 'buckets'. Tapping a bucket adds the ingredient (quantity-prefilled). Also surface a 'tone down' (temper) row per axis. Chalkboard styling consistent with the card.",
  "acceptance": [
    "Enhancement page shows 'More {axis}? Try…' buckets per axis using the existing boost/temper ranking",
    "Buckets use the Make-a-Recipe mini-card visual; tap-to-add is quantity-prefilled",
    "Swipeable within the carousel; full suite green; build clean"
  ]
}
```

### FP-OV-4 — SPIKE: local on-device description model (ONNX, no API)

```json
{
  "id": "FP-OV-4",
  "title": "SPIKE: explore a LOCAL on-device model for the flavor-profile description (ONNX, no cloud API)",
  "category": "research",
  "priority": 2,
  "description": "Feasibility spike to augment/replace the rule-based description (FP-OV-2) with a LOCAL model running in-app (ONNX via onnxruntime-web, like the existing GNN / set-completion models) — explicitly NOT Claude or any cloud API. Assess: training-data path (recipe -> description pairs; could bootstrap from rule output + curation), candidate architecture (small seq model vs templated-slot/classifier), model size + latency for browser + Capacitor iOS, and offline behavior. Output: a written recommendation + go/no-go. No production wiring required.",
  "acceptance": [
    "Written feasibility report: data source, candidate architecture, in-browser/Capacitor inference cost, go/no-go",
    "No external API used; throwaway prototype optional",
    "If go: a follow-up implementation task is appended to plan.md"
  ]
}
```

### FP-OV-5 — FUTURE STRETCH: preparation-method inference

```json
{
  "id": "FP-OV-5",
  "title": "FUTURE STRETCH: preparation-method inference to tune the profile + description",
  "category": "research",
  "priority": 3,
  "passes": true,
  "description": "Deferred. Infer the likely preparation method (saute / simmer / raw / bake / roast …) from the ingredient set + dish type to further tune the quantity-weighting and the flavor description. No prep-method model or data exists today; this is a separate research effort. Documented so it surfaces, but NOT scheduled until FP-OV-1..4 ship.",
  "acceptance": [
    "Scoped + deferred; revisit only after FP-OV-1..4 ship"
  ]
}
```

---

# NEXT INITIATIVE: Targeted "?" help bubbles + cheap UX wins (2026-06-22)

**Context**: A 2026-06-22 two-scout exploration of the app's interactive
surfaces (nav/entry + lab/tool) found the app has concept-level
onboarding (HowItWorks modal, post-entry GuidedTour) but nothing
explains the **non-obvious interaction grammar** on specific surfaces.
The recurring root cause is **hover-dependent affordances + hidden
primary actions on a mobile-first app**. Decision: add a small,
targeted "?" help bubble (NOT on every page) on the 4 most-confusing
surfaces, revealed as a **popover tooltip**, and fold in the
low-risk UX tweaks that reduce *why* help is needed. The bigger
IngredientPicker pin-to-confirm redesign is explicitly OUT (logged as
HELP-6, deferred).

**Target surfaces (chosen)**: IngredientPicker, Network 3D explorer,
Filter pills, Flavor Profiles carousel.

**Reveal pattern**: tiny circular "?" bubble button → taps open a small
anchored, dismissible popover (outside-click / Esc / × to close) with
2-4 plain-language lines: what it is, how to use, what to try.

**Cadence**: interactive bridge mode — **pause between each task** for
review. Build the shared component first, then wire one surface per task.

**Constraints**: additive + null-safe (help is purely additive chrome;
never blocks the underlying surface). Mobile-first (touch targets ≥44px,
no hover-only reveals). Match each surface's existing visual language
(chalkboard cards vs. the network UI). Read each target file first
(`check-existing-before-authoring`). Unit-test the shared component +
any new pure logic; full suite green, build clean.

### HELP-1 — Reusable HelpBubble + popover component

```json
{
  "id": "HELP-1",
  "title": "Reusable HelpBubble component: tiny '?' button + dismissible anchored popover",
  "category": "ui",
  "priority": 1,
  "passes": true,
  "description": "Create src/components/HelpBubble.jsx: a small circular '?' bubble button that toggles a compact anchored popover. Props: title, body (string | string[] lines), optional placement, optional size/variant for light (network) vs chalkboard (recipe) surfaces. Popover dismisses on outside-click, Esc, and an in-popover × ; only one open at a time per instance. Accessible: button has aria-label + aria-expanded, popover has role + focus handling, ≥44px touch target. Pure/presentational — no app data. NO wiring into surfaces yet.",
  "acceptance": [
    "HelpBubble renders a '?' button; clicking toggles a popover with title + body lines",
    "Popover closes on outside-click, Esc, and the × ; reopen works",
    "Accessible (aria-label, aria-expanded, role) + ≥44px target; light + chalkboard variants",
    "Unit tests (render, toggle, dismiss paths); full suite green; build clean"
  ]
}
```

### HELP-2 — Wire HelpBubble into the IngredientPicker

```json
{
  "id": "HELP-2",
  "title": "Add a help bubble to the IngredientPicker explaining the pin-to-confirm add flow",
  "category": "ui",
  "priority": 1,
  "description": "Mount HelpBubble in the IngredientPicker header (src/components/IngredientPicker.jsx ~:421, before the close ×). Copy explains the non-obvious flow: tap an ingredient row → it pins as a dot on the taste radar → tap the dot → 'Yes, add to recipe'. Also mention the '+ Add to Recipe' row shortcut once pinned. Read the file first to confirm the exact flow/labels.",
  "acceptance": [
    "A '?' bubble appears in the IngredientPicker header; popover explains pin → tap dot → confirm",
    "Chalkboard variant matches the picker styling; does not block picker interactions",
    "Full suite green; build clean"
  ]
}
```

### HELP-3 — Wire HelpBubble into the Network 3D explorer (+ tap-reveal labels)

```json
{
  "id": "HELP-3",
  "title": "Add a help bubble to the Network 3D explorer; make hover-only node/pole labels tap-revealable",
  "category": "ui",
  "priority": 1,
  "description": "Mount HelpBubble in a corner of the Network canvas chrome (App.jsx ~:1674 / LivingArchView). Copy lists the interaction grammar: drag to orbit, scroll/pinch to zoom, tap a node for details, tap a cluster pill to focus, tap empty space / Esc to reset, arrow keys to walk, '/' to search. Cheap UX win: where node/pole labels currently reveal on hover only (a dead end on touch), make them tap-revealable too. Read App.jsx + the network components first to confirm exact affordances before writing copy.",
  "acceptance": [
    "A '?' bubble in the network canvas corner; popover lists the core gestures accurately",
    "Hover-only node/pole labels are also reachable by tap on touch devices",
    "Full suite green; build clean"
  ]
}
```

### HELP-4 — Wire HelpBubble into the Filter pills (+ rename 'None' + tap-reveal poles)

```json
{
  "id": "HELP-4",
  "title": "Add a help bubble to the filter pills; rename the misleading 'None' pill; tap-reveal pole labels",
  "category": "ui",
  "priority": 1,
  "description": "Mount HelpBubble at the right edge of the filter pill row (src/components/FilterPillRow.jsx ~:13 / App.jsx :1698). Copy explains: filters stack (AND-intersection), the pull-strength slider lerps between co-occurrence and bucket poles, pole labels show member counts. Cheap UX wins: (1) rename the 'None' pill to what it actually does — it toggles particle flow, not 'clear filters' — verify the exact behavior in code first and pick an accurate one-word label (e.g. 'Particles'/'Flow'); (2) make the hover-only pole/member labels tap-revealable. Read FilterPillRow.jsx first.",
  "acceptance": [
    "A '?' bubble at the filter row's edge; popover explains stacking + pull-strength + poles",
    "The 'None' pill is renamed to accurately describe its particle-toggle behavior",
    "Pole/member labels are tap-revealable on touch; full suite green; build clean"
  ]
}
```

### HELP-5 — Wire HelpBubble into the Flavor Profiles carousel (+ page titles)

```json
{
  "id": "HELP-5",
  "title": "Add a help bubble to the Flavor Profiles carousel; label each page; add a first-open swipe hint",
  "category": "ui",
  "priority": 1,
  "description": "Mount HelpBubble in the RecipeFlavorProfilesCard header (src/components/RecipeFlavorProfilesCard.jsx ~:504). Copy explains: swipe left/right (or use ◀ ▶ / the dots) to move between pages — Overview, Flavor map, per-axis Boost/Temper, Enhance, Pairings — and that tapping Boost/Temper chips adds ingredients. Cheap UX wins: ensure each carousel page shows a clear title (several already do — fill gaps), and add a subtle one-time ◀▶ swipe-hint nudge on first open. Apply the same page-title polish to SuggestionCardDeck where pages are unlabeled. Read both files first.",
  "acceptance": [
    "A '?' bubble in the Flavor Profiles header; popover explains swipe/pages + tap-to-add",
    "Every carousel page has a visible title; a one-time swipe hint shows on first open",
    "Full suite green; build clean"
  ]
}
```

### HELP-6 — FUTURE (deferred): IngredientPicker one-tap add redesign

```json
{
  "id": "HELP-6",
  "title": "FUTURE: rework IngredientPicker so '+ Add' is the primary one-tap action (radar-pin becomes optional)",
  "category": "ui",
  "priority": 3,
  "description": "Deferred per scoping decision. The pin → tap-dot → confirm flow is 3 steps for 'add an ingredient'. The stronger fix than a help bubble (HELP-2) is to make the row's '+ Add to Recipe' the always-visible primary action and demote the radar-pin to an optional compare/preview gesture, collapsing 3 steps → 1. Touches the most-used add flow, so it is intentionally separate from the help-bubble pass. Revisit after HELP-1..5 ship + the help bubble's effect is observed.",
  "acceptance": [
    "Scoped + deferred; revisit after HELP-1..5 ship"
  ]
}
```
