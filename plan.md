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
  "passes": true,
  "description": "Mount HelpBubble in the IngredientPicker header (src/components/IngredientPicker.jsx ~:421, before the close ×). Copy explains the non-obvious flow: tap an ingredient row → it pins as a dot on the taste radar → tap the dot → 'Yes, add to recipe'. Also mention the '+ Add to Recipe' row shortcut once pinned. Read the file first to confirm the exact flow/labels.",
  "acceptance": [
    "A '?' bubble appears in the IngredientPicker header; popover explains pin → tap dot → confirm",
    "Chalkboard variant matches the picker styling; does not block picker interactions",
    "Full suite green; build clean"
  ]
}
```

### HELP-3 — Network gesture grammar (folded into the HowItWorks modal)

```json
{
  "id": "HELP-3",
  "title": "Document the Network 3D interaction grammar in the existing HowItWorks modal (no new bubble)",
  "category": "ui",
  "priority": 1,
  "passes": true,
  "description": "REVISED after investigation: the Network already has TWO help affordances (the global tour '?' HelpButton + the 'How it works' modal), so a third floating bubble would be redundant (user prefers consolidation). The genuine gap is the interaction GRAMMAR, which neither documents. Add a 'Getting around' section to src/components/HowItWorks.jsx covering: drag to orbit, scroll/pinch to zoom, two-finger drag to pan, tap a dot for details, press-and-hold a dot to focus pairings, tap a cluster pill to isolate, tap empty space / Esc to reset, arrow keys to walk, '/' to search. The bundled 'tap-reveal hover labels' win is mostly moot — nodes are already tap + long-press accessible on touch; only morph POLE labels are hover-only and tap-revealing them is risky 3D raycasting → split out as HELP-7 (deferred).",
  "acceptance": [
    "HowItWorks modal has a 'Getting around' section listing the core gestures accurately",
    "No third floating help affordance added to the network (consolidated into HowItWorks)",
    "Unit test for the new section; full suite green; build clean"
  ]
}
```

### HELP-4 — Rename the 'None' pill + document filter mechanics (consolidated into HowItWorks)

```json
{
  "id": "HELP-4",
  "title": "Rename the misleading 'None' filter pill → 'Particles'; document filter mechanics in HowItWorks",
  "category": "ui",
  "priority": 1,
  "passes": true,
  "description": "REVISED after investigation (same consolidation call as HELP-3): the network top-right already has an InsightDrawer '?' right beside the filter row, and HowItWorks' 'The Network' section already explains filter stacking + pole morphing — so a 4th floating '?' would be redundant. Delivered: (1) Cheap UX win — renamed the misleading 'None' pill (which actually toggles particle flow, not clear-filters) → 'Particles' in src/components/FilterPillRow.jsx; aria-label was already accurate and behavior (onToggleNone) unchanged. (2) Folded the two undocumented mechanics — the pull-strength slider + the Particles toggle — into the HowItWorks 'The Network' section. The 'tap-reveal pole labels' part is the 3D morph poles → deferred to HELP-7.",
  "acceptance": [
    "The 'None' pill is renamed to 'Particles' (accurate particle-toggle label); wiring unchanged",
    "HowItWorks documents filter stacking + pull-strength + the Particles toggle",
    "Updated the source-grep guard test for the rename; full suite green; build clean"
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
  "passes": true,
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
  "title": "Rework IngredientPicker so '+ Add' is the primary one-tap action (radar-pin becomes optional)",
  "category": "ui",
  "priority": 3,
  "passes": true,
  "description": "Done. The pin → tap-dot → confirm flow was 3 steps for 'add an ingredient'. Every notebook row now exposes an always-visible '+ Add' primary button (data-testid picker-add-<name>) that commits in one tap via handleCommit/onSelect; the row BODY (picker-row-<name>) keeps the now-optional pin-to-radar gesture for flavor comparison. Guided mode is unchanged (tap = pick, no '+ Add'). Footer instruction updated to lead with '+ Add'. Restructured the non-pinned row from a single <button> to a div with a pin-body button + an add button (valid nesting).",
  "acceptance": [
    "Every notebook row shows an always-visible '+ Add' that adds in one tap",
    "Row-name tap still pins to the radar (optional compare); guided mode unaffected",
    "Existing pin/commit tests stay green; +3 HELP-6 tests; full suite green; build clean"
  ]
}
```

### HELP-7 — tap-reveal morph pole labels on touch

```json
{
  "id": "HELP-7",
  "title": "Make hover-only morph POLE labels (member counts / top members) reachable by tap on touch",
  "category": "ui",
  "priority": 3,
  "passes": true,
  "description": "Done. Pole labels (member count / top members / bridge) previously surfaced only on mousemove (onPoleHover), so touch users never saw them. In LivingArchView extracted a shared poleHitAt(clientX,clientY) raycast helper and a shared activePoleLabel, used by BOTH onMove (hover) and onClick (tap). A tap on a pole sprite now surfaces its tooltip (and toggles off / clears when tapping the same pole again or anything else); a normal tap reaches it via onClickGuard→onClick, and the node-selection path runs only when no pole was hit. Long-press (α-mode) and node tap are unaffected. Verified: hover still surfaces + clears poles after the refactor (regression-safe), and a live click on a pole sprite exercised the new tap branch (toggled the overlay). Build + full suite green; source-grep guard added.",
  "acceptance": [
    "Tapping a bucket-pole label surfaces its tooltip on touch (shared poleHitAt raycast)",
    "Hover path unchanged (no regression); node tap / long-press unaffected",
    "Source-grep guard for the tap path; full suite green; build clean"
  ]
}
```

---

# FOLLOW-UPS (open, 2026-06-25)

```json
{
  "id": "PERF-LAZY-NETWORK",
  "title": "Lazy-mount LivingArchView only when activeTab === 'network' (+ React.lazy code-split)",
  "category": "perf",
  "priority": 2,
  "status": "done (2026-06-25)",
  "resolution": "App.jsx:41 static import → lazyWithRetry(() => import(...)); added a one-way `networkVisited` latch (flips true on first Network-tab visit, stays mounted via the opacity-toggle wrapper so WebGL isn't re-initialized on tab switches); mount wrapped in <Suspense fallback={null}>. LandingScreen early-return (App.jsx:1276) already prevents mount behind the landing gate, so no startPageComplete gating needed. sceneHandle is App-owned (useMemo) and passed INTO the view, so the Guided handoff is safe. All 6 referencing tests pass + full suite green + build clean; three chunk now code-split off the initial bundle.",
  "description": "LivingArchView (178KB + the three/ WebGL stack) is currently ALWAYS mounted, hidden via opacity (App.jsx ~1677). It inits WebGL on every surface incl. the kitchen flows — wasteful on mobile and it HANGS headless Chromium (blocks automated Playwright/CI mobile QA). Fix: gate the mount with `activeTab === 'network'` and convert the static import (App.jsx:41) to lazyWithRetry + <Suspense> so the 178KB also code-splits out of the initial bundle. CARE: 6 tests reference LivingArchView — App.handoff.test.jsx, NetworkClickPolish.sourceGrep.test.js, LivingArchView.legacyRegression.test.jsx, AffinityMode.playthrough.test.js, CameraAnimator.labelAlignment.test.js, multiFilterMean.test.js. Verify App-level values it feeds (visibleNodeCount, joystickClusters, bridge-pulse) are network-only before gating. Reached via Guided 'Explore in the network →' (App.jsx:2227 setActiveTab('network')).",
  "acceptance": ["LivingArchView mounts only on the network tab; not initialized on kitchen surfaces; headless page-load no longer hangs; 178KB code-split; suite green; build clean"]
}
```

```json
{
  "id": "IOS-NATIVE-DEPLOY",
  "title": "iOS native build + TestFlight (Codemagic, automatic on push to master)",
  "category": "ops",
  "priority": 3,
  "status": "automated",
  "description": "CORRECTION 2026-06-25: this is NOT a manual macOS task. iOS builds run on Codemagic (cloud mac_mini_m2) via codemagic.yaml workflow `ios-testflight`, which triggers on every PUSH to master (branch_patterns: master). The cloud pipeline does its own npm ci + npm run build + npx cap sync ios + strip-ios-bundle + SPM resolve + agvtool build-number bump + xcode-project use-profiles + build-ipa, then publishes to App Store Connect (Apple ID 6760793304, bundle com.neuralflavor.app) and submits to the TestFlight 'Internal Testers' group. Signing is Codemagic-managed (app_store distribution). So local `npm run ios:sync` is NOT required for the cloud build (Codemagic regenerates the bundle from src); pushing src to master is the trigger. Today's master pushes (through 126877d + the PERF-LAZY-NETWORK commit) already kicked off TestFlight builds. Monitoring/retries happen in the Codemagic UI — not runnable from this box.",
  "acceptance": ["Push to master triggers the Codemagic ios-testflight workflow; build-ipa succeeds; build appears in TestFlight Internal Testers (verify in Codemagic + App Store Connect UI)"]
}
```

# NEXT INITIATIVE: Pairing Lab — reintroduce "network mode" (PAIR-LAB, 2026-06-25)

**Context**: /design + /frontend-design exploration (full doc:
`.omc/plans/pairing-lab-design-2026-06-25.md`). Reintroduce the parked
"network mode" as an **ingredient-first ego-network** in a **2D Canvas**
(no WebGL), as a new **Pairing Lab** in the kitchen world, **chalk frame /
vivid bucket data inside**. Reuses the EXISTING model: `categoricalAxes.js`
CATEGORICAL_AXES (the aroma/taste/cuisine/season/family "lenses"),
`graph.js` getNeighbors for partner neighborhoods. Signature = the "lens
twist": the same ~12 partners re-plate into grouped/recolored zones when
you change aspect. iOS: ≤15 partners, dpr cap 2, rAF only during the
twist (idle otherwise), lazy-mounted, reduced-motion respected. Interview
decisions locked 2026-06-25 (interaction=ego, render=2D-now/WebGL-seam,
place=new lab, aesthetic=chalk-frame/vivid-data).

```json
{
  "id": "PAIR-LAB-P0",
  "title": "pairingEgoModel.js — pure ego/lens/insight model (no rendering)",
  "category": "feature",
  "priority": 1,
  "status": "done (2026-06-25, e6b8bb0) — 17 unit tests",
  "description": "New src/data/pairingEgoModel.js with pure, unit-tested functions: egoNeighborhood(name, data, {limit=12}) -> [{name, strength, node}] top partners by pairing strength via graph.js getNeighbors(Enriched); groupByLens(partners, lens, ctx) -> per-bucket member arrays reusing categoricalAxes.bucketAllNodes/bucketOf + CATEGORICAL_AXES (lens in affinity|aroma|taste|cuisine|season); lensInsight(partners, lens, ctx) -> one rule-based sentence from the bucket distribution. No DOM/canvas. Null-safe (missing data -> [] / null).",
  "acceptance": ["egoNeighborhood returns top-N partners sorted by strength desc, capped at limit, self excluded", "groupByLens buckets partners per lens using CATEGORICAL_AXES; affinity lens = single group by strength", "lensInsight returns a non-empty string describing the dominant bucket(s) per lens, '' when no partners", "unit tests cover all lenses + empty/missing-data; full suite green"]
}
```

```json
{
  "id": "PAIR-LAB-P1",
  "title": "PairingBoard.jsx — 2D Canvas ego renderer with 5 lens layouts + lens-twist transition",
  "category": "feature",
  "priority": 2,
  "status": "done (2026-06-25, 8399929) — 5 component tests; rAF-only-during-twist, dpr cap 2, reduced-motion snap, a11y fallback list",
  "dependsOn": ["PAIR-LAB-P0"],
  "description": "New src/components/PairingBoard.jsx: 2D <canvas> ego graph. Center ingredient + partners from PAIR-LAB-P0. Layouts: affinity (radial, ring distance = strength), aroma/cuisine/season/taste (grouped/poled by bucket, vivid bucket palette from categoricalAxes colors). Spring/tween 'lens twist' re-layout on lens change. Chalk frame (chalkTheme), Caveat center label + sans partner labels. iOS: devicePixelRatio capped at 2; requestAnimationFrame ONLY during a transition then idle; prefers-reduced-motion -> snap. onSelectPartner(name) re-center callback; press-hold -> onPeek(name). Renderer-strategy seam documented so a Three.js impl can slot in later. Degrades to a partner LIST if canvas unsupported.",
  "acceptance": ["renders center + partners on canvas; 5 lenses produce distinct layouts", "lens change animates a re-layout; idle (no rAF) when not transitioning", "dpr capped; reduced-motion snaps; tap re-centers, press-hold peeks", "graceful list fallback; suite green; build clean"]
}
```

```json
{
  "id": "PAIR-LAB-P2",
  "title": "PairingLab.jsx — lab shell (search + lens control + board + detail) wired as 4th lab",
  "category": "feature",
  "priority": 3,
  "status": "done (2026-06-25) — wired into MobileTabBar labs menu + App.jsx (lazy-mounted, ?path=pairing routing); replaced the dead 'molecule' menu slot; 5 shell tests; code-split 11KB chunk",
  "dependsOn": ["PAIR-LAB-P1"],
  "description": "New src/components/PairingLab.jsx: chalk search (fuse.js/SearchBar pattern) + lens segmented control (Affinity/Aroma/Taste/Cuisine/Season) + PairingBoard + BottomSheet partner detail (IngredientPanel) + the lensInsight line. Wire as the 4th lab beside Cocktail/Sauce/Cookbook in the Labs entry (LabsFab / labs dropdown / onSelectLab). Lazy-mounted (lazyWithRetry + Suspense, per PERF-LAZY-NETWORK). Additive + null-safe.",
  "acceptance": ["Pairing Lab reachable from Labs entry; lazy-mounted", "search/tap -> ego board; lens control re-plates partners; insight line updates", "tap partner re-centers; detail sheet opens; suite green; build clean"]
}
```

```json
{
  "id": "PAIR-LAB-P3",
  "title": "Pairing Lab extras (parallelizable): bridge arcs, build-a-plate, two-ingredient mode, season-now, shuffle",
  "category": "feature",
  "priority": 4,
  "status": "done (2026-06-25) — all 5 extras: model helpers (0ebd4ce) + UI. Built sequentially inline, NOT via parallel agents (headless claude -p had no API credit; Agent tool off per directive). Also added an accessible per-partner details button to the board fallback (a11y + testability). 13 new tests (1439 total suite).",
  "dependsOn": ["PAIR-LAB-P2"],
  "description": "Independent enhancements, each shippable alone (fan out): (a) bridge arcs — faint arc when two partners also pair with each other (3-ingredient trios); (b) build-a-plate — tap-collect partners into a tray -> send to Recipe/Cocktail/Sauce via existing onFindCocktail/onFindSauce handoff; (c) two-ingredient (edge) mode — center on a pair, show shared neighborhood; (d) season-now — season lens defaults to current month + highlights in-season; (e) serendipity shuffle — re-center on a strong-but-distant partner.",
  "acceptance": ["each extra behind its own commit + tests where logic is pure", "no regression to P0-P2; suite green; build clean"]
}
```

```json
{
  "id": "PAIR-LAB-P4",
  "title": "Pairing Lab polish — meaningful lines, chalk center, axis captions, cross-category Surprise, insights, network pathway",
  "category": "feature",
  "priority": 2,
  "status": "done (2026-06-25) — all 7 items; verified by headless screenshot. Lines weight=strength/style=provenance + key; axis caption + clamped labels; chalk double-stroke center oval + bigger Caveat labels; 🎲 Surprise keeps center (cross-category); peek provenance+★tier+why; inline network teaser → onOpenInNetwork. Suite 1447 green; build clean.",
  "description": "Round 2 from user feedback + /design (2026-06-25). (1) Lines: weight=strength, style=provenance (solid=chemistry, dashed=cuisine, glow=both) via getNeighborsEnriched, + a small key. (2) Axis names: clamp on-canvas bucket labels + an always-visible caption naming the lens buckets (fixes 'only taste shows axis names'). (3) Center oval: larger hand-drawn wobbly chalk ellipse + bigger Caveat. (4) Partner labels: bigger Caveat + chalk shadow (was tiny sans). (5) Surprise (🎲): SAME center, cross-category surprises — strong partners in a different taste/aroma family (surprisingNeighborhood); banner + exit, NOT a re-center. (6) Insights: enrich the peek sheet (provenance + ★ strength tier + why-line) + keep the lens-contrast line. (7) Network pathway: inline 'Where this comes from' teaser that expands to the full 3D network focused on the center (onOpenInNetwork → setSelectedNode + setActiveTab('network')) + a one-line explainer.",
  "acceptance": ["lines differentiate strength (weight) + provenance (style) with a key", "every lens names its buckets (caption + clamped labels)", "center oval + partner labels read as chalk and are legible", "🎲 keeps the center and shows cross-category partners", "peek shows provenance + tier + why; lens line stays", "a teaser opens the focused 3D network with an explainer", "suite green; build clean"]
}
```

# NEXT INITIATIVE: Labs 2D "kitchen-world" menu redesign (CK-MENU, 2026-06-23)

**Context**: From the 2026-06-23 labs design review (frontend-design lens) +
the "two worlds" decision: the molecular lab is parked, so the Cocktail /
Sauce / Cookbook labs are being re-homed into the kitchen world. Finding: 3D
"Explore" is decorative + hard to navigate; the 2D "Browse" views are the real
product. So: **default labs to 2D and re-skin the 2D views as kitchen
artifacts** — a cocktail BAR MENU + sauce SPECIALS BOARD on bistro chalkboard,
and a recipe-card COOKBOOK. Shared chalkboard DNA with RecipeFlavorProfilesCard
(slate wash, Caveat headings + a legible sans for data, colored-chalk accents).
Reuse each lab's existing IA (family grouping, filters, ingredient/IBA badges).

Prototype + interactive design tuning happened on the Cocktail Lab
(`CocktailBrowse.jsx`); CK-2..6 carry the rest. Files: `CocktailBrowse.jsx`,
`SauceBrowse.jsx`, `CookbookLab.jsx`, `LabNodeCard.jsx`, `cocktailBaseSpirit.js`
(added `COCKTAIL_SPIRIT_COLORS`).

### CK-1 — Cocktail Lab: bistro chalkboard bar menu (default 2D)

```json
{
  "id": "CK-1",
  "title": "Cocktail Lab 2D Browse → bistro chalkboard bar menu (default to 2D)",
  "category": "ui",
  "priority": 1,
  "passes": true,
  "description": "Done + user-validated. CocktailLabV2 defaults viewMode to 'browse'. CocktailBrowse reskinned to a chalkboard bar menu: big 'Cocktail Menu' chalk-script title (underline); per-family signature GLASSES drawn as chalk SVG on a back-bar shelf (Tropical→pilsner, Highballs→brandy balloon, Sour→margarita, Boozy→rocks, Aromatic→martini, Aperitivos→wine), scaled up, full-slot tap hit-area, family names word-WRAPPED (no truncation) + 'N drinks'; spirit filter chips color-coded by back-bar pour color (COCKTAIL_SPIRIT_COLORS); colored-chalk family section headers; drink names in Caveat, data (counts/IBA/spirit) in legible sans.",
  "acceptance": ["Validated interactively over several rounds; suite green; build clean"]
}
```

### CK-2 — Spirits row → varied chalk bottles

```json
{
  "id": "CK-2",
  "title": "Cocktail menu Spirits row → per-spirit varied chalk bottle silhouettes",
  "category": "ui",
  "priority": 1,
  "passes": true,
  "description": "Done + user-validated (commit 24205c1). Spirit filter chips replaced by a tappable back-bar bottle shelf, one chalk bottle per base spirit via a parametric builder (bodyW/bodyTopW/shoulder/bodyStyle/punt): square-shouldered gin, tapered whiskey, bulged rum/liqueur, slim sloped vodka/vermouth, squat short-wide tequila, long-neck punted wine, generic other. Each bottle wears a cream paper label with the spirit name (Caveat, ink) — gin+vodka use a skewY rhombus label (vertical edges flush to the walls), the rest upright. Liquid/outline color-coded by COCKTAIL_SPIRIT_COLORS; '+N drinks' below. Bottles scaled 1.65 except gin (0.9). Sticky bar slimmed to IBA toggle + search + active-spirit pill.",
  "acceptance": ["Spirits shown as varied, color-coded chalk bottles on a shelf; tap-to-filter works; suite green; build clean"]
}
```

### CK-3 — Subgroup styling: colored Caveat labels + larger font + icons

```json
{
  "id": "CK-3",
  "title": "Cocktail menu subgroups → colored chalk Caveat labels (drink-size) + per-subgroup icon",
  "category": "ui",
  "priority": 2,
  "passes": true,
  "decision": "Icon scope (user, 2026-06-24): keyword-matched glyph set, rendered as chalk line-art in the subgroup color (NOT emoji) to keep the chalkboard aesthetic; generic glass fallback.",
  "done_note": "Commit 93a6ada. Headers: 24px Caveat + chalk glow, distinct chalk color per subgroup (9-hue palette cycled per family), keyword-matched chalk glyph (citrus/mint/coconut/berry/cream/spice/coffee/fizz + glass fallback) at 23px.",
  "description": "Within each family section, style the subgroup ('PINA COLADA-style') headers as colored chalk in the SAME Caveat font as the drink rows but LARGER (currently small uppercase sans), each subgroup a distinct chalk color. Add a small icon per subgroup. NOTE/decision needed: subgroups are data-derived (many per family) — a unique hand-drawn icon per subgroup isn't feasible; use a derived/generic chalk glyph (e.g. a small glass or a color swatch) or cap to a curated icon set. Confirm icon scope before building.",
  "acceptance": ["Subgroup headers: bigger Caveat, per-subgroup color, an icon; readable; suite green; build clean"]
}
```

### CK-4 — Chalk-textured background

```json
{
  "id": "CK-4",
  "title": "Cocktail menu → chalk-textured background fill",
  "category": "ui",
  "priority": 2,
  "description": "Add a subtle chalk-like texture/shade behind the slate wash (faint noise / dust / smudge), shared as reusable kitchen-world DNA so the chalkboard surfaces (menu, specials board, Flavor Profiles card) feel like real boards rather than flat black. Keep it subtle — must not hurt text legibility.",
  "acceptance": ["Subtle chalk texture behind the menu; text still legible; suite green; build clean"]
}
```

### CK-5 — Roll the treatment to Sauce + Cookbook

```json
{
  "id": "CK-5",
  "title": "Apply the chalkboard menu treatment to Sauce Lab + Cookbook (default 2D)",
  "category": "ui",
  "priority": 2,
  "passes": true,
  "done_note": "User-validated over many rounds. Extracted shared src/data/chalkTheme.js (FONT/CHALK_* palette + CHALK_TEXTURE + chalkSurfaceStyle + CARD_* tokens); CocktailBrowse refactored to import it. SauceLab + CookbookLab default to 2D ('browse'). SauceBrowse → chalk 'Sauce Specials' board: 11 mother families as DISTINCT vessels (saucepan/ladle/boat/whisk-bowl/bottle/mortar/wok/jug/jar/carafe/cruet) on pantry shelves, 5/row centered, scaled 1.55; family list headers get line-above+below, 36px title, vessel icon, indented (ml-5) sauce cells with vessel-trace icon + 20px label + dashed chalk-trace cell. CookbookLab: cuisines as 'cookbooks' on a shelf (per-cuisine KitchenIcon, vertical spine titles), dish types as centered icon-only controls (84px KitchenIcon + label), recipe cards color-coded by cuisine wash over cream. Cocktail list polish: bigger family glasses/spirit bottles + labels, subgroup tinted cards (ml-5 indent, left spine), family headers line-above+below with glass icon, per-row glass-trace icon + dashed chalk-trace cells + 20px labels.",
  "acceptance": ["Sauce + Cookbook re-skinned to the kitchen world, default 2D; suite green; build clean"]
}
```

## ENTRY-SCREEN CONSISTENCY (2026-06-24) — DONE

Design-review (frontend-design lens) follow-up: the opening Landing was already
chalk kitchen-world, but the Make picker + Guided start were still dark-blue
neural. Brought onto chalkTheme.js. Shipped in commit 8190800.

### CK-8 — Make picker → kitchen-world  ✅ passes

```json
{ "id": "CK-8", "passes": true, "category": "ui",
  "title": "Reskin MakeRecipeStart to the chalk kitchen-world",
  "done_note": "Commit 8190800, user-confirmed. 4 picker cards mirror the landing tiles (slate wash, 2px double chalk-rail border + accent spine, Caveat title/subtitle); emoji → chalk line-art glyphs (book/pencil/camera/link, local MakeGlyph); url/parsing/preview/error/photo-preview stages reskinned to slate + Caveat + cream buttons. testids/handlers preserved." }
```

### CK-9 — Guided Discovery start → kitchen-world  ✅ passes

```json
{ "id": "CK-9", "passes": true, "category": "ui",
  "title": "Reskin GuidedDiscoveryStart + ThoughtBubbleCard to the chalk kitchen-world",
  "done_note": "Commit 8190800. Slate chalk surface; thought-bubble signature kept but restated in chalk (Caveat cream heading, chalk-dashed outline); ThoughtBubbleCard slate-filled + Caveat titles; stack chips + CTA chalk-cream. Per-category taxonomy colors + icons preserved; inactive chip bgs → slate. testids/aria/handlers preserved." }
```

### CK-10 — Landing 2-tile grid fix  ✅ passes

```json
{ "id": "CK-10", "passes": true, "category": "ui",
  "title": "LandingScreen — center the 2-tile grid",
  "done_note": "Commit 8190800. sm:grid-cols-3 max-w-5xl → sm:grid-cols-2 max-w-3xl so the two tiles (Network tile hidden) sit centered/balanced on desktop (verified: 256px margins at 1280w). NOTE: an uncommitted edit was reverted once by a concurrent working-tree reset — committed promptly to lock it in." }
```

### CK-7 — Cookbook dish detail card → kitchen-world

```json
{
  "id": "CK-7",
  "title": "Reskin the Cookbook dish detail (RecipeDetail in CookbookLab) to the chalk kitchen-world",
  "category": "ui",
  "priority": 2,
  "passes": true,
  "done_note": "Brought the dish detail modal up to the LabNodeCard treatment: chalk-slate surface (chalkSurfaceStyle + texture) + double chalk border replacing the dark-blue modal; Caveat 34px title + cuisine chip with color dot; description in larger Caveat; ingredients as a two-column → arrow list (matched cream / unmatched faded, same match logic, no more pill chips); MultiAxisRadarStack kept with a Caveat section label; action buttons restyled to chalk (cream 'Open in Recipe Notebook', cuisine-tinted 'Explore in Network'). role=dialog preserved. Seed dishes carry only description + ingredient strings (no step text) so no numbering needed here.",
  "acceptance": ["Cookbook dish detail matches the kitchen-world card; dialog role preserved; suite green; build clean"]
}
```

### CK-6 — cocktail/sauce recipe-card readability

```json
{
  "id": "CK-6",
  "title": "Improve the recipe detail card (LabNodeCard) readability — no images",
  "category": "ui",
  "priority": 3,
  "passes": true,
  "done_note": "No-image readability pass on LabNodeCard (the shared Cocktail + Sauce detail card). Refactored to import chalkTheme.js (dropped duplicate constants) + chalk-dust texture on the surface. Ingredient lines reformatted as 'name … measure' with a dotted chalk leader, measure right-aligned and larger; bullet replaced by a family-color → arrow. Preparation upgraded to high-contrast cream + line-height 1.45 and auto-numbered steps via splitPrepSteps (line-break → numbered-marker → sentence split, with leading enumerators STRIPPED so pre-numbered preps don't render '1. 1. …'). FS_BODY bumped to clamp(19,2.7vh,27) so ingredients+prep read above the FS_CHIP cousin chips. Regression test added for already-numbered preps. NOTE: the Cookbook dish detail (RecipeDetail in CookbookLab.jsx) is a SEPARATE component still on the old dark-blue modal — not covered here; candidate follow-up (CK-7).",
  "acceptance": ["LabNodeCard ingredient/prep readability improved without images; numbered preps don't double-number; suite green; build clean"]
}
```

---

## WEBLINK IMPORT REPAIR (2026-07-31) — "load recipes from links" is broken

**Symptom (user-reported, reproduced 2026-07-31):** pasting a recipe URL in
Make → "From a web link" fails with *"The recipe parser failed"*.

**Measured root cause.** `functions/src/scrape/handler.ts` fetches the target
page with the bot-advertising UA `flavor-network-scrape/0.1 (+github...)`.
Live probe of that exact request:

| site | status w/ bot UA | status w/ browser UA |
|---|---|---|
| allrecipes.com | **402** | **402** |
| seriouseats.com | **402** | **402** |
| simplyrecipes.com | **402** | **402** |
| foodnetwork.com | **403** | **200** ✅ |
| bonappetit.com | 200 | 200 |

Two distinct walls: (a) UA-sniffing sites (foodnetwork class) that a realistic
browser header set defeats; (b) Dotdash-Meredith properties returning HTTP 402
to any datacenter IP regardless of headers — those need a reader-proxy hop.
Measured: `https://r.jina.ai/<url>` with `x-return-format: html` returns the
full HTML **including the JSON-LD Recipe block** for seriouseats (883KB,
hasRecipeLD ✅) and simplyrecipes (896KB, hasRecipeLD ✅) in <1.1s.

Secondary defects found in the same read:
- `DEFAULT_BUDGET_MS = 5_000` is too tight once a proxy hop is involved.
- The Cloud Function parses **JSON-LD only**; the older client-side
  `src/data/recipeScraper.js` has microdata + HTML-heuristic fallbacks that
  were never ported, so schema-less pages fail outright.
- The client fires the 25s parse spinner before checking auth, so a
  signed-out user waits, then gets an error screen instead of a Sign-in button.

**Decision (user, 2026-07-31):** keep the `unauthenticated` guard on the
callable — it stops `scrapeRecipe` becoming a public URL-fetch proxy — and fix
the client UX around it instead.

**Cadence:** interactive bridge mode — **pause between each task.**

### WEBLINK-1 — Browser-realistic fetch headers + workable budget

```json
{
  "id": "WEBLINK-1",
  "title": "Send a browser-realistic header set from the scrape fetcher and raise the fetch budget",
  "category": "bugfix",
  "priority": 1,
  "description": "In functions/src/scrape/handler.ts, replace the bot-advertising user-agent on defaultFetcher with a current desktop-Chrome UA plus the companion headers real browsers send (accept, accept-language, sec-fetch-dest/mode/site, upgrade-insecure-requests). This alone flips foodnetwork.com from 403 to 200 (measured). Raise DEFAULT_BUDGET_MS from 5_000 to 15_000 so a redirect chain or a proxy hop fits inside the 30s callable timeout and the client's 25s race. Keep every SSRF guard exactly as-is: ssrfReason() per hop, assertHostnameResolvesPublicly() per hop, redirect 'manual' with REDIRECT_MAX. Do not touch ssrf.ts logic. Extend functions/src/scrape/handler.test.ts to assert the outbound headers include a Mozilla/5.0 user-agent and that the budget default is 15s.",
  "acceptance": [
    "defaultFetcher sends a Mozilla/5.0 desktop-Chrome UA + accept-language + sec-fetch-* headers",
    "DEFAULT_BUDGET_MS is 15_000 and still strictly under the 30s callable timeout",
    "Per-hop ssrfReason + assertHostnameResolvesPublicly + redirect manual + REDIRECT_MAX unchanged",
    "handler.test.ts covers the header set and the new budget; functions vitest suite green; npx tsc --noEmit clean"
  ]
}
```

### WEBLINK-2 — Reader-proxy fallback for datacenter-IP-blocked sites

```json
{
  "id": "WEBLINK-2",
  "title": "Fall back to the r.jina.ai reader proxy when the origin bot-blocks the fetch",
  "category": "bugfix",
  "priority": 1,
  "description": "Headers alone cannot reach allrecipes/seriouseats/simplyrecipes (HTTP 402 to any datacenter IP). Add a second fetch attempt in functions/src/scrape/handler.ts: when the direct fetch of the ORIGIN returns a bot-block-shaped status (401, 402, 403, 406, 429, 451, or any 5xx), retry once through https://r.jina.ai/<absolute-url> with header x-return-format html, which returns the origin HTML with its JSON-LD intact (measured working on seriouseats + simplyrecipes). Requirements: (1) the proxy is a single hard-coded constant host, never user-controlled, and the ORIGINAL url still passes the full SSRF gauntlet before any proxy attempt, so this cannot be used to reach internal hosts; (2) only fall back for bot-block statuses, never for 404/410 (a genuinely missing page must stay a fast, honest error); (3) attempt the proxy at most once per request; (4) record which path succeeded on the returned ScrapeResult (e.g. fetchPath direct or proxy) so the field is observable in logs; (5) the whole two-attempt sequence must fit the WEBLINK-1 budget. Add handler tests with a stubbed fetcher covering: direct-200 never proxies, 402 proxies and succeeds, 404 does not proxy, proxy failure surfaces the ORIGIN status in the error message.",
  "acceptance": [
    "A bot-block status (401/402/403/406/429/451/5xx) on the origin triggers exactly one r.jina.ai retry with x-return-format html",
    "404/410 never trigger the proxy; the origin error is returned directly",
    "Proxy host is a hard-coded constant; the user-supplied URL still runs the full SSRF gauntlet first",
    "ScrapeResult reports which fetch path succeeded",
    "Stubbed-fetcher tests cover direct-200 / 402-then-proxy / 404-no-proxy / proxy-also-fails; functions suite green; tsc clean"
  ]
}
```

### WEBLINK-3 — Microdata + heuristic parser fallbacks

```json
{
  "id": "WEBLINK-3",
  "title": "Port the microdata + HTML-heuristic ingredient extraction into the Cloud Function parser",
  "category": "bugfix",
  "priority": 2,
  "description": "functions/src/scrape/parser.ts only understands JSON-LD, so a fetched-fine page without schema.org markup returns 'No Recipe schema found'. src/data/recipeScraper.js already implements two further strategies client-side (itemprop=recipeIngredient microdata, then class/id-based ingredient-list heuristics incl. wprm-recipe-ingredient and tasty-recipe patterns) - port them to TypeScript as an ordered fallback chain behind the existing JSON-LD path. Route every extracted line through the existing parseIngredientLine() so raw/noun/quantity/unit stay consistent with the JSON-LD path, and reuse the existing dedup behaviour. JSON-LD must keep winning when present; the fallbacks only run when it yields no usable Recipe. Title fallback order: microdata itemprop=name, og:title, then title tag. Keep the 'No Recipe schema found' error only for pages where all three strategies come up empty, and reword it to mention that the page had no recognisable recipe markup. Add parser.test.ts fixtures for a microdata-only page and a class-heuristic-only page.",
  "acceptance": [
    "Parser tries JSON-LD, then microdata, then class/id heuristics, in that order",
    "JSON-LD still wins whenever a usable Recipe node exists (existing tests unchanged)",
    "Fallback lines go through parseIngredientLine so raw/noun/quantity/unit match the JSON-LD shape",
    "Title falls back microdata name then og:title then title tag",
    "parser.test.ts gains microdata-only and heuristic-only fixtures; functions suite green; tsc clean"
  ]
}
```

### WEBLINK-4 — Client: check auth before the spinner, offer inline sign-in

```json
{
  "id": "WEBLINK-4",
  "title": "Gate the URL parse on auth up front with an inline Sign in action",
  "category": "ui",
  "priority": 2,
  "description": "In src/components/MakeRecipeStart.jsx, handleParseUrl currently enters STAGE.PARSING and calls the callable before knowing whether the user is signed in, so a signed-out user watches a spinner and then lands on a dead-end error screen. Read the current auth state (src/hooks/useAuth.js already wraps onAuthStateChanged / signInWithPopup for Google + Apple) and, when there is no user, skip the network call entirely: show the sign-in prompt in the URL-input stage with working Sign in buttons, and re-run the parse automatically once sign-in resolves so the pasted URL is not lost. Also carry the improved server errors through: when the result carries a fetch-path or origin-status detail, show a specific message ('that site blocked the import' vs 'no recipe markup found on that page') rather than the generic 'The recipe parser failed'. Keep the 25s timeout race, keep resetWebLink/back behaviour, and preserve every data-testid (make-weblink-url-input, make-weblink-parse-btn, make-weblink-error, make-weblink-preview, make-weblink-back). Extend src/components/__tests__/MakeRecipeStart.weblink.test.jsx accordingly.",
  "acceptance": [
    "Signed-out parse shows an inline Sign in affordance without firing the callable or the spinner",
    "The pasted URL survives sign-in and the parse resumes automatically",
    "Blocked-site and no-markup failures render distinct, actionable copy",
    "25s timeout race, back/reset behaviour and all existing data-testids preserved",
    "MakeRecipeStart.weblink.test.jsx covers signed-out, resume-after-sign-in, and both error branches; app vitest suite green; npm run build clean"
  ]
}
```

### WEBLINK-5 — Deploy and verify against a live URL matrix

```json
{
  "id": "WEBLINK-5",
  "title": "Build, deploy scrapeRecipe, and verify recipe import end-to-end on real URLs",
  "category": "verification",
  "priority": 3,
  "description": "The deployed revision predates WEBLINK-1..4 (functions/lib was last built 2026-05-30). Run npm --prefix functions run build, deploy with firebase deploy --only functions:scrapeRecipe, then verify against a real URL matrix covering each measured wall: foodnetwork.com (UA-sniffing, fixed by WEBLINK-1), seriouseats.com and simplyrecipes.com (HTTP 402 datacenter block, needs the WEBLINK-2 proxy), bonappetit.com (already worked - regression check), a schema-less blog page (exercises WEBLINK-3), and a deliberate 404 (must fail fast without a proxy hop). Record the observed status, fetch path, title and ingredient count for each row in .ralph/weblink_verification.md. Deployment touches live infrastructure - confirm with the user before running firebase deploy.",
  "acceptance": [
    "functions build succeeds and scrapeRecipe deploys (after explicit user go-ahead)",
    "Live matrix run covering UA-blocked, 402-blocked, already-working, schema-less and 404 URLs",
    "Every row status / fetch path / title / ingredient count recorded in .ralph/weblink_verification.md",
    "Any row still failing is written up as a follow-up task rather than reported as a pass"
  ]
}
```

### WEBLINK-6 — Ingredient matcher: stop matching shape words to real ingredients

**Found by end-to-end UI verification (2026-08-01), not by tests.** Importing
Serious Eats' "Classic Panzanella Salad (Tuscan-Style Tomato and Bread Salad)"
put allspice, cubed cheese and lettuce in the bowl — no tomato, no bread, no
basil — while every layer's tests were green. See
`lessons/every-layer-green-system-wrong.md`.

Reproduced against the real 3,891-name dictionary:

| noun after parsing | bare last token | matched | conf |
|---|---|---|---|
| `mixed ripe tomatoes, cut into bite-size pieces` | `pieces` | allspice | 0.760 |
| `ciabatta or rustic sourdough bread, cut into 1 1/2-inch cubes` | `cubes` | cubed cheese | 0.992 |
| `packed basil leaves` | `leaves` | leaves lettuce | 0.992 |

`tomato`, `bread` and `basil` all exist in the dictionary — the matcher chose
wrong entries over available right ones.

```json
{
  "id": "WEBLINK-6",
  "title": "Stop the matcher proposing shape/prep words as standalone ingredient candidates",
  "category": "bugfix",
  "priority": 1,
  "description": "Two independent defects in src/data/parseRecipeIngredient.js. (1) deriveCandidates pushes the bare last token as a match candidate; when a line ends in a shape word the candidate is 'pieces'/'cubes'/'leaves', which fuzzy-matches unrelated dictionary entries at ~0.99 confidence. The module already classifies these as FORM_SUFFIXES and uses them to strip suffixes, then contradicts itself by offering them as ingredients. Skip the bare-last-token candidate whenever that token is a FORM_SUFFIX or a KNOWN_UNIT. (2) preprocessLine only drops a comma-tail when it matches TAIL_MODIFIERS exactly, so real prep clauses ('cut into bite-size pieces', 'cut into 1 1/2-inch cubes', 'plus more for seasoning') survive into the noun and leave the shape word trailing. Drop a comma-tail when it STARTS with a preparation verb/phrase, not only on exact match. Also add the leading qualifiers this recipe exposed ('packed', 'ripe', 'mixed') to LEADING_ADJECTIVES. Do NOT loosen MATCH_THRESHOLD or CONFIDENCE_FLOOR — the bug is candidate generation, not the threshold. Server-side parser.ts is out of scope: the client re-parses item.raw, so the server noun is unused on this path.",
  "acceptance": [
    "The ten real Panzanella lines are a test fixture; tomatoes->tomato, bread->bread, basil->basil, and no row matches a shape word",
    "deriveCandidates never proposes a bare FORM_SUFFIX or KNOWN_UNIT as a standalone candidate",
    "preprocessLine drops comma-tails beginning with a prep verb, not just exact TAIL_MODIFIERS hits",
    "Existing parseRecipeIngredient tests stay green (canonical compounds like 'tomato paste' must not collapse)",
    "Verified by READING the matched names on 3+ additional real recipes, not by counting them",
    "Full app suite green; build clean"
  ]
}
```

### WEBLINK-7 — Matcher accuracy pass over a 102-line real-recipe corpus

Follow-up to WEBLINK-6, which fixed the shape-word class. A 102-line corpus
scraped from 7 live recipes (foodnetwork, allrecipes x2, simplyrecipes,
bonappetit, seriouseats, budgetbytes) shows the remaining errors split into
two kinds, and the second matters more:

**A. A correct entry exists and was not chosen**

| line | matched | should be |
|---|---|---|
| Fresh soft mozzarella cheese, separated into small clumps | lump crabmeat | mozzarella |
| Feta cheese, crumbled | crumbled cornbread | feta |
| Italian sausage, cooked ahead and crumbled | crumbled cornbread | italian sausage |
| Mushrooms, very thinly sliced if raw, otherwise first sauteed | salted | mushroom |
| 2 tsp. vanilla extract | lemon extract | vanilla |
| 2 cans canned tomato sauce | hotsauce | tomato sauce |
| 1 can sliced water chestnuts, drained | chestnut | water chestnut |
| 3 skinless, boneless chicken breast halves, thinly sliced | halved cherry tomatoe | boneless skinless chicken breast |
| 1 cup panko bread crumbs | crumb crust | panko |

**B. NO correct entry exists, and a confident wrong one was returned anyway**

`baking soda` -> "soda water"; `Baby arugula` -> "woven wheat cracker";
`Bell peppers` -> (correctly none); `chicken thighs` -> "boneless skinless
chicken breast" (wrong cut). Verified absent from the 3,891-name dictionary:
baking soda, soda, arugula, bell pepper, chicken thigh, vanilla extract,
mozzarella cheese, feta cheese, pesto.

A wrong ingredient silently changes the recipe's computed flavor profile; a
declined one the user simply adds. Declining is the better failure.

```json
{
  "id": "WEBLINK-7",
  "title": "Matcher accuracy: generalize only to exact hits, and decline when no entry exists",
  "category": "bugfix",
  "priority": 1,
  "description": "In src/data/parseRecipeIngredient.js. CORE RULE: a candidate derived by DROPPING tokens (any idx>0 in deriveCandidates — adjective-stripped, form-stripped, last-token, first-token) may only win on an EXACT dictionary hit. Today a fuzzy hit on a dropped-token candidate can beat the full noun, which is how 'baking soda' became 'soda water' (0.99) and 'vanilla extract' became 'lemon extract'. Generalizing is a fallback, not an upgrade. Supporting changes: (a) singularize single-token nouns too — deriveCandidates only singularizes the last word of multi-token nouns, so bare 'Mushrooms' never reached 'mushroom'; (b) add cheese/extract/crumbs/halves/florets/chunks/wedges/strips to FORM_SUFFIXES so 'feta cheese'->'feta', 'vanilla extract'->'vanilla'; (c) add sliced/canned/soft/firm/grated/shredded/cooked to LEADING_ADJECTIVES; (d) add cooked/crumbled/tossed/added/separated/stems/seeds/otherwise/broken to the prep-clause openers and crumbled/sauteed/caramelized to TAIL_MODIFIERS; (e) push the FIRST content token as a last-resort candidate so 'panko bread crumbs'->'panko' (exact-only under the core rule). Do NOT lower MATCH_THRESHOLD or CONFIDENCE_FLOOR. Expect the unmatched count to RISE — that is the point.",
  "acceptance": [
    "Dropped-token candidates win only on an exact dictionary hit; fuzzy generalization cannot beat the full noun",
    "Group A lines match their correct entry (mozzarella, feta, italian sausage, mushroom, vanilla, tomato sauce, water chestnut, panko)",
    "Group B lines with no correct entry return NO match rather than a confident wrong one (baking soda, baby arugula)",
    "The WEBLINK-6 Panzanella fixture still passes unchanged",
    "Canonical compounds still preserved (tomato paste, red wine vinegar)",
    "Re-run the 102-line corpus and READ every changed row; report matched-correct / declined / still-wrong counts honestly",
    "Full app suite green; build clean"
  ]
}
```
