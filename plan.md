# plan.md — Recipe Flavor Profiles Card: remediation pass (2026-06-14)

**Context**: The Flavor Profiles card + card-format suggestions feature
was already built and shipped in commit `21f2f6c`
(`RecipeFlavorProfilesCard.jsx`, `SuggestionCardDeck.jsx`,
`ProfileDeltaRadar.jsx`, `recipeProfileAnalysis.js` + tests; mounted in
`RecipeLabMobile.jsx`). A 2026-06-14 audit against `.schermness/spec.md`
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
    "All .schermness/spec.md acceptance criteria demonstrably satisfied post-remediation",
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

Crystallized via deep-interview 2026-06-17 (full spec in `.schermness/spec.md`
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
  "description": "The deployed revision predates WEBLINK-1..4 (functions/lib was last built 2026-05-30). Run npm --prefix functions run build, deploy with firebase deploy --only functions:scrapeRecipe, then verify against a real URL matrix covering each measured wall: foodnetwork.com (UA-sniffing, fixed by WEBLINK-1), seriouseats.com and simplyrecipes.com (HTTP 402 datacenter block, needs the WEBLINK-2 proxy), bonappetit.com (already worked - regression check), a schema-less blog page (exercises WEBLINK-3), and a deliberate 404 (must fail fast without a proxy hop). Record the observed status, fetch path, title and ingredient count for each row in .schermness/weblink_verification.md. Deployment touches live infrastructure - confirm with the user before running firebase deploy.",
  "acceptance": [
    "functions build succeeds and scrapeRecipe deploys (after explicit user go-ahead)",
    "Live matrix run covering UA-blocked, 402-blocked, already-working, schema-less and 404 URLs",
    "Every row status / fetch path / title / ingredient count recorded in .schermness/weblink_verification.md",
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

### WEBLINK-8 — Apple News links: resolve when possible, explain honestly when not

**Measured 2026-08-01** against a real link
(`apple.news/KcFmm7QLuNEyYYYM2Bm9Z_w`, America's Test Kitchen):
the apple.news interstitial is a 7.5KB "open in the News app" bounce page.
It carries `og:title` ("Miso Pork and Eggplant Stir-Fry — America's Test
Kitchen") and `<meta name="Author">`, but **no canonical, no og:url, and
every absolute URL on the page is an Apple domain**. The only navigation is
a JS redirect to `applenewss://`, which only the News app can open. There is
nothing for the redirect-follower to resolve.

Today such a link returns "No recipe markup found on this page" — true and
useless. n=1 so far, and from a News+ publisher; a free-publisher sample may
expose a web URL, so the resolver path is built opportunistically.

```json
{
  "id": "WEBLINK-8",
  "title": "Detect apple.news links: use a publisher URL if present, otherwise name the recipe and explain",
  "category": "feature",
  "priority": 2,
  "description": "In functions/src/scrape/. Recognise the apple.news host and handle it as its own case. (1) OPPORTUNISTIC RESOLVE: scan the interstitial for a non-Apple http(s) URL (canonical, og:url, or any publisher-domain link); if one is found, follow it and scrape normally, so free-publisher articles that do expose a web version keep working end-to-end. (2) HONEST FALLBACK: when no publisher URL exists, do NOT return the generic no-markup error. Extract og:title (strip the trailing ' — Publisher' suffix) and the Author meta, and return a distinct error naming the recipe and publisher so the user can see we read the right article, plus guidance to use News's Open-in-Safari and paste that link. The guidance must NOT promise Open-in-Safari always exists — News+ content has no public web equivalent. Add an appleNews flag or a distinct error kind on ScrapeResult so the client can render this branch specifically rather than pattern-matching prose. Client side: extend describeServerFailure in src/components/MakeRecipeStart.jsx to render the Apple News case with the extracted title. Keep the SSRF gauntlet on any followed publisher URL — it is user-influenced content.",
  "acceptance": [
    "An apple.news URL whose interstitial contains a publisher link is followed and scraped normally",
    "An apple.news URL with no publisher link returns a distinct Apple-News error naming the recipe title and publisher, not the generic no-markup message",
    "The title is cleaned of the trailing ' — Publisher' suffix that og:title carries",
    "Copy does not claim Open-in-Safari always works (News+ has no web version)",
    "Any followed publisher URL still passes ssrfReason + assertHostnameResolvesPublicly",
    "Tests use the REAL captured interstitial as a fixture, not a hand-written mock",
    "Non-apple.news URLs are completely unaffected; functions + app suites green"
  ]
}
```

### WEBLINK-12 — Native sign-in for the packaged iOS app (NOT STARTED)

**Confirmed 2026-08-01.** Safari on iPhone works — sign-in and import both
verified by the user. The packaged Capacitor app does not: the sign-in
buttons do nothing.

Cause is structural, not a regression. The app runs in a WKWebView loaded
from `capacitor://localhost`. `signInWithPopup` needs a popup window that
does not exist there; `signInWithRedirect` needs to return to a Firebase
authorized domain, and authorized domains are HTTPS origins — so
`capacitor://localhost` can never be one. The Firebase **web** SDK's OAuth
cannot complete in the packaged app on any build. It has never worked.

Nothing native is configured today (measured): no `GoogleService-Info.plist`,
no `CFBundleURLSchemes` (so no `REVERSED_CLIENT_ID`), no entitlements file,
no auth plugin — only the core Capacitor plugins.

**PREREQUISITES — human-only, must land before the code work:**
1. Download `GoogleService-Info.plist` from Firebase Console → iOS app.
2. Enable **Sign in with Apple** on the App ID in the Apple Developer portal.
   Not optional: App Store Review Guideline 4.8 requires it wherever Google
   sign-in is offered.
3. Confirm Codemagic still signs cleanly once the app carries an entitlement.

**RISK, stated plainly:** adding an entitlement changes provisioning-profile
requirements, and the Codemagic signing setup was only just stabilised. This
is the single most likely change to break the working TestFlight pipeline.
Do it as its own task with its own TestFlight verification — never bolted
onto another change.

```json
{
  "id": "WEBLINK-12",
  "title": "Native Google + Apple sign-in for the Capacitor iOS app",
  "category": "feature",
  "priority": 2,
  "blocked_by": "human prerequisites above (plist, Apple capability, signing check)",
  "description": "Add @capacitor-firebase/authentication (or equivalent) so the packaged iOS app signs in through the native Google Sign-In SDK and Apple's ASAuthorization, then exchanges the resulting credential for a Firebase session via signInWithCredential. Branch useAuth on Capacitor.isNativePlatform(): native path in the app, and leave the existing popup -> redirect web path COMPLETELY untouched, since it is verified working in Safari on iPhone. Add GoogleService-Info.plist to the Xcode project, the REVERSED_CLIENT_ID URL scheme to Info.plist, and an entitlements file with com.apple.developer.applesignin. Preserve the authError surfacing from WEBLINK-10 on both paths — a silent native failure would be exactly as undebuggable as the web one was.",
  "acceptance": [
    "Signing in on a TestFlight build completes and persists across app restarts",
    "Both Google and Apple work natively (4.8 requires Apple alongside Google)",
    "The web path in Safari is unchanged and still works — verified, not assumed",
    "Auth failures surface visibly on the native path too",
    "Codemagic still builds and signs; a TestFlight build is confirmed BEFORE this is called done"
  ]
}
```

### WEBLINK-13 — Matcher: reject unit-only nouns and generic-head mismatches

Third accuracy pass. Found by scraping a wider corpus (3 sites) and READING
every matched row.

**A. A noun that is entirely a unit must never match a food.** WEBLINK-6
guarded the bare LAST TOKEN being a shape word; this is the case where the
whole noun is one. Measured against the real 3,891-name dictionary:

| noun | matched | |
|---|---|---|
| `lb.` / `lb` | bilberry | ✗ |
| `oz.` | mozzarella | ✗ |
| `cup` / `cups` | cupcake | ✗ |
| `head` | arrowhead | ✗ |

These arise whenever the heuristic parser misfires on a page that isn't a
recipe — it emits table/nav fragments, and every one of those decoys is a
genuine dictionary entry, so they match at high confidence.

**B. When the head word is GENERIC, the modifier carries the identity.**

    "1¼ tsp. baking powder"  ->  gelatin powder

`baking powder` is absent from the dictionary and `gelatin powder` is
present; they share the head `powder`, so the WEBLINK-7 head-word guard
passes it. For generic form heads (powder, oil, sauce, juice, extract,
flakes, paste) the distinguishing word is the modifier, and baking != gelatin.

```json
{
  "id": "WEBLINK-13",
  "title": "Reject unit-only nouns; require modifier agreement on generic head words",
  "category": "bugfix",
  "priority": 1,
  "description": "In src/data/parseRecipeIngredient.js. (A) matchIngredientName returns null when the noun, after normalisation, consists ONLY of unit/measure/quantity tokens and punctuation — 'lb.', 'oz.', 'cup', 'cups', 'head', '2 lb', bare numerals. Reuse KNOWN_UNITS plus the abbreviation-with-period forms; strip trailing periods before the check. (B) Add a GENERIC_HEADS set (powder, oil, sauce, juice, extract, flakes, paste, syrup, vinegar, stock, broth) — when the noun's head word is in it, a fuzzy match must ALSO share a non-generic modifier token, else decline. Exact dictionary hits are unaffected in both cases: if the dictionary genuinely contains the phrase, it still wins. Do NOT touch MATCH_THRESHOLD or CONFIDENCE_FLOOR. Expect unmatched to rise; declining is the point.",
  "acceptance": [
    "Unit-only nouns (lb., oz., cup, cups, head, tsp., bare numerals) return no match",
    "'baking powder' declines rather than returning 'gelatin powder'",
    "Generic-head phrases that ARE in the dictionary still match exactly (tomato paste, red wine vinegar, hot sauce)",
    "The WEBLINK-6 Panzanella and WEBLINK-7 fixtures still pass unchanged",
    "Re-run the corpus and READ every changed row; report corrected / newly-declined / still-wrong honestly",
    "Full app suite green; build clean"
  ]
}
```

```json
{
  "id": "STW-1",
  "title": "Review orphaned doc docs/MAKE-MODE-SPEC.md: link it from an index or archive it",
  "passes": false,
  "category": "docs",
  "steward_key": "orphan:docs/MAKE-MODE-SPEC.md",
  "description": "Review orphaned doc docs/MAKE-MODE-SPEC.md: link it from an index or archive it\n\nsteward_key: orphan:docs/MAKE-MODE-SPEC.md",
  "acceptance_criteria": [
    {
      "id": "AC-1",
      "given": "the doc-steward flagged this issue",
      "when": "the fix is applied by a human or implementer through the gate",
      "then": "docs/MAKE-MODE-SPEC.md is linked from an index doc or moved to docs/archive/ with an ARCHIVE.md entry"
    }
  ]
}
```

## 2026-11-05 — Lab search, Cookbook expansion, shared links

```json
{
  "id": "LABSEARCH-1",
  "title": "Search the Cocktail Lab and Sauce Lab by ingredient",
  "category": "ui",
  "passes": true,
  "description": "The lab browse search boxes matched only names. Match ingredients too (word-based, comma = AND), show which ingredients matched on each row, and autocomplete ingredient names. Shared logic in src/data/ingredientSearch.js.",
  "acceptance": [
    "Typing an ingredient in either lab lists every drink/sauce containing it, with a 'with …' hint per row",
    "'gin, lime' requires both; 'gin' does not match 'ginger beer'",
    "Unit tests for the matcher and component tests for both labs; full suite green"
  ]
}
```

```json
{
  "id": "COOKBOOK-49",
  "title": "Expand the Cookbook from 15 to 49 seed recipes",
  "category": "data",
  "passes": true,
  "description": "Add 34 recipes across the existing 7 cuisines and 4 dish types in src/data/seedRecipes.js, using ProData ingredient spellings. Subtitle counts recipes from data.",
  "acceptance": [
    "49 recipes with unique ids and positions",
    "Every ingredient name resolves in public/proDataset/ingredients.json (test)",
    "Cookbook subtitle reads the real count"
  ]
}
```

```json
{
  "id": "COOKBOOK-NAMES-1",
  "title": "Fix original seed-recipe ingredient names that don't resolve",
  "category": "data",
  "passes": true,
  "description": "ground beef, bell pepper, seaweed, chili pepper were absent from ProData and silently dropped out of flavor profiles; renamed to beef, sweet pepper, wakame, ancho chili.",
  "acceptance": ["Guard test covers all 49 recipes, not just the new ones"]
}
```

```json
{
  "id": "COOKBOOK-METHOD-1",
  "title": "Quantities, servings, time and method steps for every Cookbook recipe",
  "category": "data",
  "passes": true,
  "description": "New src/data/seedRecipeDetails.js keyed by recipe id; the recipe popup shows 'Serves N · time', an amount beside each ingredient, and a numbered Method.",
  "acceptance": [
    "Every seed recipe has serves, time, >=3 steps and an amount for every ingredient (tests)",
    "Popup renders meta, amounts and steps (component test)"
  ]
}
```

```json
{
  "id": "COOKBOOK-PAIR-1",
  "title": "'Goes well with' cocktails and sauces from a Cookbook recipe",
  "category": "ui",
  "passes": true,
  "description": "Recipe popup gets Matching cocktails / Matching sauces buttons that reuse App's aroma-match handlers; matchesContext carries returnTab so 'Back to recipe' returns to the Cookbook.",
  "acceptance": [
    "Buttons hand the recipe's matched ingredients to the labs (component test)",
    "Back from matches returns to the Cookbook (verified in browser)"
  ]
}
```

```json
{
  "id": "DEEPLINK-1",
  "title": "Shared ?path= links open the named screen",
  "category": "ui",
  "passes": true,
  "description": "A URL with a valid ?path= skipped nothing: the landing picker always showed, and once past it the lab rendered blank because labs only mounted via click handlers. Now a valid ?path= skips the landing picker, labs latch mounted whenever they become active, and ?path= is written only after the user picks (a bare visit stays on the landing).",
  "acceptance": [
    "?path=cocktail / ?path=sauce open those labs directly; bare and unknown paths show the landing (App.deepLink.test.jsx)"
  ]
}
```

```json
{
  "id": "PAIRMATCH-1",
  "title": "Rank 'goes well with' cocktails and sauces by ingredient co-occurrence, not molecular aroma",
  "category": "data",
  "passes": true,
  "description": "New src/data/recipePairingMatch.js ranks items by IDF-weighted best observed pairing strength between item and recipe ingredients (shared ingredient = 1). Used by App's Find cocktail/sauce handlers (Recipe Notebook + Cookbook) and the Flavor Profiles Pairings page; match cards show the pairs that drove each match. pairings.bin bumped to v2 to carry the observed/predicted flag (bit 15 of idxB); decoder moved to src/data/pairingsBinary.js.",
  "acceptance": [
    "On the 9 seed recipes with a same-name sauce, that sauce ranks top-3 for 8/9 (aroma cosine: 1/9); MRR 0.66 vs 0.10",
    "Only observed (known) pairings are used; pairings.bin known count equals pairings.json (test)",
    "Unit tests for the ranker; full suite green; verified in browser (Beef Bolognese → Bolognese sauce; Brandy Flip / Mulled Wine)"
  ]
}
```

```json
{
  "id": "PAIRMATCH-2",
  "title": "Stop drinks scored on a sliver of their recipe from dominating matches",
  "category": "data",
  "passes": true,
  "description": "'Normandie Club Bloody Mary' resolved only lemon + lime juice (aquavit and bottled mix unmatched) and appeared in the top-8 cocktail matches for 35/49 Cookbook recipes. scoreItemForRecipe now scales the score by the share of the item's ingredients that resolve.",
  "acceptance": [
    "That drink drops out of every top-8; most frequent cocktail is Michelada at 16/49",
    "Same-name sauce still top-3 for 8/9 recipes (MRR 0.66 -> 0.60; Bolognese 1st -> 2nd)",
    "Regression tests for coverage scaling; full suite green"
  ]
}
```

```json
{
  "id": "PAIRMATCH-3",
  "title": "Pairing-match reliability: answer key, co-occurrence score, hub discounts, floor, aliases",
  "category": "data",
  "passes": true,
  "description": "scripts/evalPairingMatch.mjs is a three-part offline answer key (namesake-sauce rank, top-N concentration over every Cookbook recipe, Flavor Bible agreement vs random). Measured on it: the blended `strength` barely agrees with the Flavor Bible (AUROC 0.53), the pipeline's `tradition` sub-score does (0.63), so the ranker now scores on it (pairings.bin v3 carries it as `cooccurrence`). Hub ingredients are discounted on the item side too, short items shrink toward zero, matches under 0.1 are not shown and under 0.2 read 'loose match'. Ice/soda are ignored; accents, hyphens and ~50 spirit/liqueur aliases resolve.",
  "acceptance": [
    "Namesake sauce in the top 3 for 9/9 recipes (7 ranked first; MRR 0.81 vs 0.60 before)",
    "No cocktail in more than 14 of 83 Cookbook top-8 lists (was 26 of 49)",
    "Flavor Bible agreement of top-5 sauces x1.24 vs random",
    "pairings.bin v3 cooccurrence equals pairings.json tradition (test); full suite green"
  ]
}
```

```json
{
  "id": "COOKBOOK-83",
  "title": "Cookbook 49 -> 83 recipes, adding American and Mediterranean",
  "category": "data",
  "passes": true,
  "description": "34 more recipes with servings, time, amounts and method; two new cuisines with colours.",
  "acceptance": ["83 recipes, every ingredient name resolves in ProData, every recipe has complete details (tests)"]
}
```

```json
{
  "id": "COCKTAIL-FOUND-1",
  "title": "Cocktail Lab foundation: named sub-groups, normalised glass, suggested amounts, brand aliases, loader tests",
  "category": "data",
  "passes": true,
  "description": "The 15 data-driven sub-groups get hand names (src/data/cocktailSubclusters.js) shown in the menu and on cards; 40+ glass spellings fold into 10 types with a fallback from ice/build; cocktails without quantities (217/441) show per-slot house amounts marked '~ suggested' instead of nothing (src/data/cocktailAmounts.js); brand/bar-shorthand aliases (St-Germain, Jack Daniels, sour mix, …) and ice/soda/cola as trivial; tests for the codex loader, similarity, and every sub-group having a name.",
  "acceptance": [
    "Every subcluster id in cocktail_codex_v2.json has a name (test)",
    "Every cocktail derives a glass type (test)",
    "Cards with no source amounts show ~ amounts and a note; cards with amounts are unchanged",
    "Loader + similarity tests green"
  ]
}
```

```json
{
  "id": "COCKTAIL-FACETS-1",
  "title": "Cocktail Lab search by occasion, season, strength, character, effort, glass",
  "category": "ui",
  "passes": true,
  "description": "src/data/cocktailFacets.js derives facets per cocktail by rule from slots, build method, ice, glass, family and seasonal ingredients (no hand tags yet); a chip rail in CocktailBrowse filters on them with per-chip counts under the other active filters, plus No egg / No dairy toggles. Occasion tags are rule-bootstrapped and still want a human pass.",
  "acceptance": [
    "Chips for occasion / season / strength / character / effort / glass combine with the ingredient search and spirit shelf",
    "A chip that would leave nothing is disabled and shows 0",
    "No facet value covers more than 80% of the corpus; every occasion has >5 drinks (test)",
    "Component tests for filtering; full suite green"
  ]
}
```

```json
{
  "id": "WINE-1",
  "title": "Wine style data for the Wine Lab",
  "category": "data",
  "passes": true,
  "description": "public/data/wine_styles.json: 53 hand-written wine styles in 10 families (sparkling to fortified) with body/acidity/tannin/sweetness/alcohol/oak scales, aromas, grapes, region, cuisine, serving temperature, tasting notes and classic food matches named as ProData ingredients. Original data from standard wine-education descriptions; no third-party database.",
  "acceptance": [
    "Every classic match resolves in public/proDataset/ingredients.json (test)",
    "Scales in range, unique ids, every family populated, whites/rosés tannin <= 1 (tests)"
  ]
}
```

```json
{
  "id": "WINE-2",
  "title": "Wine pairing engine with a sommelier answer key",
  "category": "data",
  "passes": true,
  "description": "src/data/winePairing.js: dish traits from ingredient names + ProData category + method text (protein with cured pork demoted, richness, acid, dessert, hot vs mild chili, umami, warm spice, char, soup, wine in the pot); idealWine() derives the target body/acidity/tannin/sweetness/alcohol/oak/colour; each wine is scored by distance from it plus flavour bridges, region and classic matches, with reasons. Answer keys in src/data/wineAnswerKey.js (written before the engine; held-out key written mid-tuning and never tuned on); scripts/evalWinePairing.mjs reports hit@1/hit@3/MRR, concentration and coverage.",
  "acceptance": [
    "Tuned key: accepted wine in top 3 for 31/42 dishes (MRR 0.63); held-out: 10/16 (MRR 0.49)",
    "Regression floors in tests: >= 30/42 and >= 9/16",
    "Rule tests: steak -> tannic red, oysters never red, dessert -> sweet wine, hot dish -> off-dry low alcohol",
    "Known weak spot: Indian curries rank crisp whites above aromatic off-dry whites"
  ]
}
```

```json
{
  "id": "WINE-3",
  "title": "Wine Lab UI and wiring",
  "category": "ui",
  "passes": true,
  "description": "src/components/WineLab.jsx: chalk wine list by family with search (name, grape, region, aroma, food) and colour chips; matches mode with per-wine reasons and back-to-recipe; shared LabNodeCard (kind=wine) with structure words, grapes, tasting notes, similar wines, classic foods and 'why' for matched wines. Wired as a lab: Labs tile, mobile Labs menu, ?path=wine, Cookbook 'Matching wines' (passes cuisine, dish type, method), Recipe Notebook Flavor Profiles 'Find wines'.",
  "acceptance": [
    "Component tests for browse, search, chips, card, matches and back; Cookbook passes cuisine/dish type/method; ?path=wine opens the lab",
    "In-app ranking identical to scripts/evalWinePairing.mjs (verified in browser for Beef Bourguignon)",
    "No horizontal scroll at 375px"
  ]
}
```

```json
{
  "id": "WINE-4",
  "title": "Wine Lab: country of origin and region",
  "category": "ui",
  "passes": true,
  "description": "Each wine style gets country (home), countries (everywhere it is made) and area (principal wine region). Wine Lab adds country chips with flags and counts, region chips inside a country, a Group by Style/Country switch, country/region on rows and cards, and search over country and region names (src/data/wineStyles.js countryIndex/fromCountry/countryFlag).",
  "acceptance": [
    "Every wine has country in countries and an area; every country has a flag (tests)",
    "Italy chip shows the Italian styles; Piedmont narrows to Barbera, Barolo, Moscato d'Asti; 'tuscany' search finds Chianti and Vin Santo; group by country shows each wine once (tests)",
    "Known: Windows desktop browsers draw flag emoji as letters (FR)"
  ]
}
```

```json
{
  "id": "FOODON-1",
  "title": "Measure FoodOn (CC BY 4.0) synonyms for ingredient name matching",
  "category": "data",
  "passes": true,
  "description": "scripts/build_foodon_synonyms.py maps FoodOn label/exact synonyms to ProData names (2,095 mappings, unambiguous only). Result: Flavor Bible name match 45% -> 46%; ~85-90% precise on a spot check but mostly Latin species names, with culinary errors (ninjin -> ginseng; bell pepper -> paprika). Not shipped. The real gap is plurals, 'x, y' inversions, 'x and y' entries, mojibake and non-ingredient rows.",
  "acceptance": ["Finding recorded in the script docstring; map kept git-ignored, not in the app"]
}
```

```json
{
  "id": "AROMA-1",
  "title": "Experiment: do model-written aroma tags predict good pairings?",
  "category": "data",
  "passes": true,
  "description": "449 Flavor Bible answer-key ingredients tagged (1-5 of 32 aroma tags, intensity 1-3) by three model agents told to describe each ingredient alone (data/experiments/aroma_tags_449.json, instructions alongside). Pre-registered test (scripts/evalAromaTags.mjs): aroma-tag cosine AUROC 0.512 vs molecular GNN 0.527 on all 100,576 pairs; adds nothing to co-occurrence on observed pairs (0.630 -> 0.630). FAIL. Exploratory (scripts/exploreAromaTagCombos.py, held-out ingredients): tag COMBINATIONS reach 0.598 when trained on Flavor Bible labels, but 0.510 when trained on recipe co-occurrence — the signal is learned from the Flavor Bible itself, which the project cannot ship. Conclusion: no shippable aroma pairing signal; do not tag the remaining 3,891 for pairing. Tags may still serve as descriptive 'smells like' labels.",
  "acceptance": ["Pre-registered verdict recorded (FAIL); exploratory results labelled as post-hoc"]
}
```

```json
{
  "id": "COCKTAIL-RIFF-1",
  "title": "Cocktail Lab: riff on a classic",
  "category": "ui",
  "passes": true,
  "description": "'Riff on this' on every cocktail card opens a panel listing the drink's lines with their role; each line offers same-role swaps (slot dictionary, cleaned of garnishes and whole fruit) ranked by co-occurrence with the rest of the drink; after any change the panel names the closest existing cocktails (shared ingredients, spirits compared by family, base spirit weighted double). Reset, and 'Write this riff in the Recipe Notebook'. src/data/cocktailRiff.js + src/components/CocktailRiff.jsx; LabNodeCard gains an actions prop.",
  "acceptance": [
    "Whiskey Negroni names the Boulevardier as basically the same drink; tequila Daiquiri names a Margarita (tests)",
    "Swaps stay within the role and exclude what is already in the drink; water/ice fixed, sugar swappable (tests)",
    "Verified in browser on the Negroni"
  ]
}
```

```json
{
  "id": "FB-PURGE-1",
  "title": "Remove copyrighted Flavor Bible data from the repo, its history and the live site",
  "category": "data",
  "passes": true,
  "description": "data/flavor_bible_full.csv and public/proDataset/flavor_bible_matched.json (and the older public/data/flavor_bible_full.csv) held The Flavor Bible's pairing lists in a public repo and on the live site. They move to git-ignored data/private/ for local evaluation only; scripts read from there; the app no longer loads the curated layer (empty set -> no 📖 badges, no 'Also in The Flavor Bible' list, no ★★ floor). History rewritten on every branch and tag and force-pushed; site redeployed. Kept: proDataset/scripts/13-build-chef-citations.js (37 individually cited pairs, 4 from the book).",
  "acceptance": [
    "git log --all shows no commit containing the three paths",
    "https://neuralflavor.web.app/proDataset/flavor_bible_matched.json no longer serves the data",
    "Full test suite green; evaluation scripts run from data/private/"
  ]
}
```

```json
{
  "id": "WINE-7",
  "title": "Wine aroma profiles from 130k wine reviews (CC BY-NC-SA)",
  "category": "data",
  "passes": true,
  "description": "scripts/build_wine_review_aromas.py maps each of the 53 Wine Lab styles to reviews in the Kaggle 'Wine Reviews' set (variety + country/province/region/title selectors) and counts how often each of 18 aroma families and their terms appear; ships only aggregate shares + lift per style in public/data/wine_review_aromas.json (CC BY-NC-SA 4.0, attributed; README updated). 52/53 styles profiled (Madeira: 11 reviews, below the 15 minimum). 74% of the hand-written aroma tags are confirmed by the reviews' top-5 families; the unconfirmed ones are listed by --compare. Card display waits for WINE-6.",
  "acceptance": ["No review text shipped; licence and attribution in the file and README", "--compare agreement reported"]

  "id": "WINE-6",
  "title": "Wine card: flavour-profile radar, aroma families and 'pairs by profile' rules; review of the wine mappings",
  "category": "ui",
  "passes": true,
  "description": "Opening a wine card now shows a 'Flavour profile' section (structure radar over body/acidity/tannin/sweetness/alcohol/oak via ProfileRadar, plus an aroma-family breakdown over 8 families), a 'Pairs by profile' list of structure -> food rules with example foods from the style's classic matches and its aroma bridges, and an 'Avoid' list. Pure logic in src/data/wineProfile.js restates the pairing engine (src/data/winePairing.js, unchanged) at its thresholds; consistency tests score dishes with the engine itself. LabNodeCard gains an optional children slot. docs/wine-mapping-review.md audits the 53 styles and the rules with a prioritised, measurable improvement list. No data edits.",
  "acceptance": [
    "wineProfile.js unit tests: axes in 0..1, every aroma tag mapped, Barolo tannin rule, off-dry Riesling heat rule, Sauternes dessert rule, Champagne bubbles rule",
    "Engine-consistency tests: rule groups rank as the engine scores them (steak, fish, Thai, dessert, fried)",
    "Component test: opening a wine card shows the profile and mapping sections",
    "Checked at 375px in the browser: no horizontal scroll",
    "Full vitest suite green; evalWinePairing numbers unchanged (no engine or data change)"

  "id": "WINE-5",
  "title": "Wine engine: aromatic, off-dry wines for warm-spiced curries instead of racy whites",
  "category": "data",
  "passes": true,
  "description": "Indian curries ranked crisp high-acid whites (Assyrtiko, Chablis, Champagne) first. Three principled rules in src/data/winePairing.js: (1) isFried() — frying the flavour base (onion, garlic, spices, curry paste) starts a sauce and no longer marks the dish fried (which demanded acid and bubbles); (2) a 'creamy' trait (cream, butter, ghee, coconut milk; not yogurt or buttermilk, which are the acid) rounds off the acid the dish's tomato and acid ingredients ask of the wine; (3) warm spice without red meat raises the sweetness target and lowers the acid target, so aromatic off-dry wines lead. Red-meat dishes keep their reds. Tuned key 31/42 MRR 0.633 -> 33/42 MRR 0.703; held-out 10/16 MRR 0.49 -> 12/16 MRR 0.58.",
  "acceptance": [
    "Garam masala + cream + tomato curry gets an aromatic or off-dry, non-crisp, non-red wine first (test)",
    "Goan fish curry gets an aromatic white first (test)",
    "Tuned key hit@3 and MRR not lowered; floors raised to measured 33/42 and 12/16",
    "Full vitest suite green"

  "id": "COCKTAIL-BAR-1",
  "title": "Cocktail Lab: My bar + Invent a cocktail",
  "category": "ui",
  "passes": true,
  "description": "'My bar' (per device, localStorage fn-my-bar, every access wrapped) lists the user's bottles with autocomplete from the cocktail vocabulary resolved to graph names and quick-add chips for the 20 most common cocktail ingredients, and ranks every codex cocktail by coverage: 'You can make' (all non-trivial lines covered; water/ice/soda/sugar/garnish assumed) and 'One away' (names the missing line and suggests a same-role, same-kind substitute from the bar). Spirits of the same family stand in for each other (familyKey: any whiskey for a whiskey, never vodka for gin) and say 'with rye instead of bourbon'. 'Invent a cocktail' fills a family skeleton (Sour, Aromatic Stirred, Highball/Fizz, Aperitivo spritz, Tropical, Sipper) from the bar or, with an empty bar, the whole role pool, choosing the combination with the highest mean co-occurrence strength; amounts from SLOT_DEFAULT_AMOUNT scaled into the family's volume range; card with build/glass, why-it-works pairings, nearest existing cocktails, Shuffle, Riff on it, Write it in the Recipe Notebook. src/data/myBar.js, src/data/cocktailInvent.js, src/components/MyBarPanel.jsx, src/components/InventCocktail.jsx; entry buttons in CocktailBrowse, wiring in CocktailLabV2.",
  "acceptance": [
    "Coverage ranking: exact, one-away with substitute, same-family spirit substitution, no vodka-for-gin (tests)",
    "Invent guard rails: one base spirit, never two sours, no ingredient twice, missing role reported (tests)",
    "Component tests for MyBarPanel and InventCocktail; full vitest suite green",
    "Not yet verified in a browser"
  ]
}
```

```json
{
  "id": "DESIGN-1",
  "title": "Fewer words, more chalk: small items from the 2026-11 design review",
  "category": "ui",
  "passes": true,
  "description": "Items 1, 4, 5, 6 and 8 of docs/design-review-2026-11.md. (1) Cocktail Lab: the six facet rows (occasion/season/strength/character/effort/glass) sit behind one 'Filters' chip that shows the number of active filters; horizontal chip rows hide their scrollbars (.chip-row utility). (4) Pairing Lab: the ring is an ellipse that uses the whole board, names and group labels are placed by src/data/pairingLabelLayout.js so they never overlap each other, a circle or the centre oval; the explainer and line key moved into the 'Where do these pairings come from?' footer; lens chips on one row. (5) One loader, ChalkLoader (a chalk wine glass filling up), replaces the purple spinners in Cocktail/Sauce Lab, the Wine/Pairing lazy-load fallbacks, the wine list wait and the dimmed landing. (6) Wine Lab flags are drawn SVGs (src/data/countryFlags.js) instead of emoji, which Windows shows as 'FR'. (8) Labs menu and Make screen lead with larger chalk drawings (src/components/chalkArt.jsx).",
  "acceptance": [
    "Filters chip hides the facet rows by default, counts active filters, keeps them applied when closed (test)",
    "Pairing label placement: no overlaps at 375x520, 320x460, 768x700, all on the board (test); checked at 375px on Affinity and Aroma lenses",
    "Every wine country has a drawn flag whose stripes cover the board (test); checked at 375px",
    "ChalkLoader renders as a status region (test); seen on the landing at 375px",
    "Labs menu and Make screen checked at 375px",
    "npm run gate green"
  ]
}
```

```json
{
  "id": "DESIGN-2",
  "title": "A picture on every row: wine family glasses, drink glasses in My bar and Invent",
  "category": "ui",
  "passes": true,
  "description": "Recommendation 2 of docs/design-review-2026-11.md, minus the Cookbook part. src/components/wineGlasses.jsx draws one chalk glass per wine family (flute for sparkling; white tulip, Riesling glass and Chardonnay bowl for the whites; flared rose glass; a red balloon whose bowl grows light -> medium -> full; a small dessert glass; a copita for fortified), filled with the family colour as wine, chalk-dust halo, glow, dashed when unselected. Wine Lab: the glass on every row (browse and matches mode), on each family header, large at the top of the wine card (new optional LabNodeCard headerArt slot), and a new family filter drawn as a swipeable shelf of glasses with slanted chalk tags and counts, combined with the colour and country chips. The cocktail family glass geometry moved out of CocktailBrowse into src/components/cocktailGlasses.jsx (unchanged drawing) so My bar and Invent a cocktail can show each drink's family glass beside its name; the invented drink is drawn large in its glass, filled with a colour from its ingredients (src/data/drinkColor.js: family colour, tinted by campari, grenadine, blue curacao and other strong colourants). Style chips in Invent carry their glass too.",
  "acceptance": [
    "Every wine family in wine_styles.json renders a glass of its own shape, aria-hidden, filled with the family colour; red bowls grow light -> full (test)",
    "Every wine row in browse and matches mode includes its family glass; the card leads with a large glass (test)",
    "Family shelf: one glass per family with a count; tapping filters, tapping again clears; works with the colour and country chips (test)",
    "My bar rows (You can make, One away) and Invent (card, nearest cocktails, style chips) show the family glass; a campari drink is poured red (test)",
    "Checked at 375px in the browser: wine list, shelf, filtered shelf, card, My bar, Invent; Cocktail menu shelf unchanged",

  "id": "DESIGN-4",
  "title": "Recipe Notebook: chalk frame, paper page, and a starter state",
  "category": "ui",
  "passes": true,
  "description": "Item 7 of docs/design-review-2026-11.md; owner's ruling: 'Chalk frame, paper page.' The Recipe Notebook (RecipeLabMobile, also behind RecipeLab on desktop) now sits on the labs' chalkboard (chalkSurfaceStyle) and stops above the tab bar. The header ('Recipe Notebook' chalk heading + count), Save/Clear and the toolbar (Suggest, Amounts, Flavor Profiles, + Add) are chalk-outline buttons in Caveat; the toast is chalk. The recipe itself stays a cream lined sheet with a red margin, pinned with two strips of tape and a drop shadow. Each ingredient row carries a small ink drawing picked from the ingredient's existing `category` (IngredientArt / ingredientArtKind, appended to chalkArt.jsx: leaf for herbs, drop for liquids/fats/acids, pepper for chili/spice, citrus slice, apple, carrot, garlic bulb, fish for protein, cheese, wheat, loaf, nut, sugar cube, bottle, mushroom; bowl when unknown). With an empty bowl the board shows 'Start with…' and three starter ingredients drawn in chalk (src/data/notebookStarters.js: the most-paired ingredient of the first three present of vegetable, aromatic, herb, protein, citrus, …; pantry staples excluded), a tap adds one; plus 'or open a Cookbook recipe' (new onOpenCookbook prop, App switches to the Cookbook tab). Popouts (picker, suggestion card deck, Flavor Profiles card) were already chalk and are unchanged.",
  "acceptance": [
    "Empty bowl: three chalk starter ingredients render, tap adds to the bowl and the starter goes away (test)",
    "'or open a Cookbook recipe' calls onOpenCookbook; hidden when not wired; starter renders before the graph loads (test)",
    "Chrome keeps Suggest / Amounts / Flavor Profiles / + Add / Save / Clear with a non-empty bowl; Flavor Profiles still opens (test)",
    "Frame is the chalk surface, the page is a separate paper sheet; each row has an aria-hidden category drawing (test)",
    "Checked at 375px with an empty bowl and with 7 ingredients (amounts filled, Flavor Profiles opened)",
    "npm run gate green"
  ]
}
```

```json
{
  "id": "DESIGN-5",
  "title": "Landing logo redrawn in chalk as SVG",
  "category": "ui",
  "passes": true,
  "description": "The landing logo (chef's toque with Nf on the band over a Rutherford atom) was a painted PNG. Redrawn as an SVG component (src/components/ChalkLogo.jsx, rendered by AnimatedLogo) in the lab icons' chalk style: crisp line over a faint dust halo, slightly roughened edges. Toque per the owner: tall pleated band, three round puffs overhanging it, middle tallest. Atom per the owner: upright middle orbit orange, the two tilted orbits green. Orbits are true ellipses, so electrons travel them again; hidden under prefers-reduced-motion. public/fn-logo-chalk.png kept, unused.",
  "acceptance": [
    "Landing shows the SVG logo with an accessible name (test)",
    "Nf on the band, three orbits, three moving electrons; animate=false draws it still (test)",
    "Checked at 375px and enlarged: hat reads as a toque, atom clear of the band"

  "id": "DESIGN-3",
  "title": "Cookbook: a chalk drawing on every recipe, and a popup that leads with pictures",
  "category": "ui",
  "passes": true,
  "description": "Items 2 (Cookbook part) and 3 of docs/design-review-2026-11.md, plus the nested-button bug noted at the end of that review. (a) Recipe tiles: each tile leads with a small slate inset holding a chalk drawing of the dish type (soup, noodles, pasta, rice, curry, stew, grill, fish, salad, stir-fry, taco, wrap, sandwich/burger, dumplings, dip, skillet, pizza, bakes, dessert, vegetables), tinted with the cuisine colour; name stays as text, with cuisine + dish type on one line and a two-line description. The ingredient word chips on the tile were dropped. Dish type comes from src/data/dishType.js (dishTypeOf), which reads name, cluster and ingredients, so user-saved recipes get a picture too ('plate' is the fallback). Drawings are DishArt in src/components/chalkArt.jsx (new exports appended; existing ones unchanged). (b) Recipe popup: title + dish drawing + serves/time/ingredient count as icon+number pairs; the profile radar (one ProfileAxisRadar with working Taste/Aroma/Season/Cuisine/Method chips) right under the title; ingredients as chips (amount + name, with a small chalk glyph per ingredient-graph category, IngredientGlyph); the method behind a 'Method (N steps)' fold; 'Goes well with' as three drawn mini-cards (wine, cocktail, sauce via LabArt). Open in Recipe Notebook, Explore in Network, and the find-wines/cocktails/sauces handoffs are unchanged. The five-radar MultiAxisRadarStack is no longer used by the Cookbook. (c) MultiAxisRadarStack: each card is a div with role=button, tabIndex 0 and Enter/Space handling instead of a <button>, and its inner radar hides its axis chips (new ProfileAxisRadar prop showAxisSwitcher), so there is no button inside a button. ProfileAxisRadar's svg now has overflow visible so long edge labels ('Astringent') are not clipped.",
  "acceptance": [
    "dishTypeOf gives all 83 seed recipes a real dish type, never the generic plate, and every type has a drawing (test)",
    "Every tile has an aria-hidden dish drawing of its type and keeps the recipe name as text (test)",
    "Popup order: head (drawing + meta) → radar → ingredient chips → method → goes well with (test)",
    "Method fold is closed by default and opens and closes on tap (test)",
    "Wines/cocktails/sauces mini-cards, Recipe Notebook and Network actions all fire with the same arguments as before (test)",
    "MultiAxisRadarStack: no <button> inside a button, Enter/Space select an axis (test); no validateDOMNesting warning in the popup (test, and no console warnings in the browser)",
    "Checked at 375px in a browser: tiles for all dish types; popups for Beef Bolognese, Thai Green Curry, Tacos al Pastor, Crème Brûlée, Chicken Shawarma",
    "Full vitest suite green (154 files, 1696 tests) and vite build clean"
  ]
}
```

```json
{
  "id": "SAUCE-PAIR-1",
  "title": "Sauce card: proteins it is served with, and wines per protein",
  "category": "feature",
  "passes": true,
  "description": "Owner asked for 'pairs well with' wines on the sauce card and which proteins each sauce pairs with. Each of the 77 sauces in public/data/sauce_augment.json now has a hand-written `proteins` list (2-4, most typical first; kitchen convention, not mined). The card shows them as 'Serve it with' chips with drawings, then 'Wines': the Wine Lab engine (rankWinesForRecipe) scores the sauce's ingredients plus each protein, keeping the best wine per protein, grouped (src/data/sauceWines.js, src/components/SaucePairings.jsx). 'More wines' opens the Wine Lab list for the first protein; its back button returns to the sauce. Fixed along the way: the engine's cooked-with-wine rule fired on wine vinegar (Bearnaise on steak got a white Burgundy; now Syrah). Answer-key scores unchanged (tuned top-3 33/42, held-out 12/16).",
  "acceptance": [
    "Every sauce lists 2-4 proteins, each an ingredient the pairing data knows (test)",
    "Every protein gets a wine, grouped by wine; Bordelaise on beef is a red, Beurre Blanc on white fish a white (test)",
    "Card shows proteins with drawings and wines with family glasses; 'More wines' hands off with the sauce's ingredients plus the first protein (test)",
    "Proteins still render if wine data fails (test)",
    "Checked at 375px: Bearnaise card and the More wines handoff",
    "npm run gate green"
  ]
}
```

```json
{
  "id": "KITCHEN-2",
  "title": "Recipe Lab: what's in my kitchen, what you can cook, and invent a recipe",
  "category": "feature",
  "passes": true,
  "description": "The Make screen works like the Cocktail Lab's My bar + Invent a cocktail, and becomes the Recipe Lab (owner, 2026-11-07). Header 'Recipe Lab' in the labs' chalk style with the subtitle 'What's in your kitchen? Cook it, or invent something.' and an 'Open my notebook' link (to the Recipe Notebook, no handoff). Lead cards: 'What's in my kitchen?' (new MakeArt pantry drawing) and 'Invent a recipe' (new MakeArt invent drawing), which replaces 'Start from scratch'; Cookbook / photo / link stay below as secondary cards. The kitchen panel (src/components/KitchenPanel.jsx) uses the shared myKitchen.js list (localStorage fn-my-kitchen, also used by the Sauce Lab): add box with autocomplete over graph ingredient names, removable chips with ingredient drawings, quick-add chips (the Cookbook's 18 most-used non-basic ingredients) and an 'Assume basics' switch. Results update live: You can make (Cookbook recipes fully covered, with DishArt), One or two away ('missing basil'), and From 40,000 real recipes (directions index, lazy-loaded behind a chalk loader; each with 'you have N of M' and what is missing, and a method fold). Tapping a Cookbook recipe opens the Cookbook's own RecipeDetail (now exported from CookbookLab.jsx), whose notebook button hands off with the recipe's method; tapping a real recipe hands its covered ingredients, title and steps to the Notebook (source make-kitchen). Invent (src/components/InventRecipe.jsx, logic in src/data/inventRecipe.js): cuisine chips from the model vocab (default: the cuisines the kitchen leans toward), optional main ingredient; the FM-P2 set-completion model grows the dish from the kitchen (candidateNames), an ingredient joining only at logit >= -2.5; a thin dish (< 4) may add at most 2 common, pairing-backed ingredients from outside, labelled \"you'd need\"; scored by mean pairwise pairing strength plus a small model-confidence bonus; three at a time with Shuffle. Each card: a simple name ('Chicken & Lemon Skillet, Italian-style'), a dish drawing, amounts from quantityRuntime, the closest real recipe with its method, and the note 'An idea from what pairs, not a tested recipe'. 'Write it in the Recipe Notebook' hands off (source make-invent) with amounts and the closest recipe's steps. The Notebook shows a toast for each new source and a 'Method (N steps)' fold for handed-over steps. retrieveDirections also returns each recipe's full ingredient list. Findings: the observed-pairing index has no edge between many hub pairs (no chicken|garlic), so it cannot gate which kitchen items join a dish (the model logit does); and the directions index keeps only vocab-mapped ingredients (Cajun 15 Bean Soup lists no bean), so ingredients named in a recipe title count too, and a 'closest real recipe' must name one of the dish's ingredients in its title.",
  "acceptance": [
    "Recipe Lab header, subtitle and 'Open my notebook' (no handoff); cards in order kitchen, invent, existing, photo, weblink; no scratch card (test)",
    "Kitchen panel: autocomplete, Enter adds the best match, quick-add, remove chip, basics switch; saved to fn-my-kitchen (test)",
    "You can make / One or two away from the Cookbook, naming what is missing; tapping opens the Cookbook detail, which hands off with the method (test)",
    "Real recipes: chalk loader while the index loads, then 'you have N of M' + missing; an ingredient named only in the title counts; tap hands off make-kitchen with title and steps (test)",
    "Index failure: says so and the Cookbook lists still work (test); model failure: invent says it is unavailable (test)",
    "Invent: kitchen first, poor fits left out, at most 2 \"you'd need\" items that are common and pairing-backed, distinct dishes and names, scored by mean pairing (test)",
    "Invent card: name with cuisine, dish drawing, amounts, closest real recipe + method, the honest note; Write it hands off make-invent with amounts (test)",
    "Notebook toasts for make-kitchen / make-invent and a method fold that a later handoff clears (test)",
    "Checked at 375px in a browser with chicken, garlic, lemon, rice, onion, tomato and with an empty kitchen; no console errors",
    "npm run gate green"

  "id": "KITCHEN-3",
  "title": "Sauce Lab: My pantry + Invent a sauce",
  "category": "ui",
  "passes": true,
  "description": "The Sauce Lab gets the Cocktail Lab's pair (My bar, Invent a cocktail) for sauces. Two buttons under the sauce search box, '🧺 My pantry (n)' and '✨ Invent a sauce', each open a full chalk panel with Back. 'My pantry' edits the shared kitchen list of src/data/myKitchen.js (localStorage fn-my-kitchen, the same list Make a recipe edits; re-read when a panel opens), with an add box autocompleting over sauce ingredient names, quick-add chips for the 20 most used sauce ingredients (basics and already-covered ones hidden) and the 'assume basics' toggle, then lists 'Sauces you can make' and 'One or two away' naming what is missing. A sauce one away gets a stand-in from the pantry only when it plays the same role (sauce_augment category) and is the same kind within it (src/data/saucePantry.js sauceKind: lime for lemon, shallot for onion, cream for crème fraîche; never flour for egg yolk, milk for cream or garlic for onion). 'Invent a sauce' (src/data/inventSauce.js) has one technique per SAUCE_TEMPLATES skeleton (roux & milk, roux & stock, brown reduction, emulsion, tomato simmer, curry base, stir-fry, mole, salsa, nut sauce), narrowed by kind where chemistry needs it: an emulsion needs fat + egg yolk + citrus/vinegar, a roux sauce fat + flour (not cornstarch) + the right liquid. Roles are filled from the pantry first; a required role the pantry lacks falls back to the ingredients most used for it, marked 'you'd need' (optional roles never send the cook shopping); 'Only what I have' names what is missing instead of inventing around it. Combinations ranked by beam search on mean pair strength (ProData co-occurrence + half the curated sauce pairings) plus strength with the chosen protein and a small per-pantry-item bonus. Three inventions per page (Shuffle steps on): name, family vessel, amounts from a per-kind house table, the technique as a method naming the actual ingredients (oil emulsions are a mayonnaise/aïoli whisked cold; a butter emulsion is held under 70 °C), why it works, the closest existing sauce (Jaccard, src/data/sauceSimilarity.js, shared with sauceCodex), the honest note 'an idea from what pairs, not a tested recipe', a wine for the chosen protein (winesForSauce), and 'Open in Recipe Notebook' (SauceLab's onOpenRecipeLab handoff, protein included). A sauce card opened from a panel returns to that panel when closed. The family vessel drawing moved from SauceBrowse to src/components/sauceVessels.jsx (unchanged geometry). myKitchen gains equivalents: eggs cover egg yolk, butter covers clarified/cold butter (also as an assumed basic), lemon covers zest. loadSauceCodex also returns the ingredient catalogue and curated pairings.",
  "acceptance": [
    "Stand-ins only within the same role and kind: lime for lemon, shallot for onion, cream for crème fraîche; never flour/cornstarch for egg yolk, cream for milk, garlic for onion (test)",
    "Can make / one or two away on the shared kitchen list; empty pantry gives nothing; assume-basics off makes butter and flour count (test)",
    "Every invent technique keeps its SAUCE_TEMPLATES required roles (test)",
    "Never invents an emulsion without an emulsifier, a fat and an acid, across empty and partial pantries; with 'only what I have' the missing emulsifier is named (test)",
    "A roux sauce always has fat, flour (never starch or egg) and the right liquid; no béchamel without a liquid (test)",
    "Every technique builds from an empty pantry with a non-empty method and every line priced with an amount; no ingredient twice (test)",
    "Pantry-first: nothing to buy when the pantry covers it; a missing required role is marked you'd need; optional roles never are (test)",
    "Component tests for SaucePantryPanel, InventSauce and the SauceLab wiring (buttons, Back, card returns to the panel, shared list written)",
    "Checked at 375px in a browser with butter, egg yolk, lemon, shallot, white wine, cream, tomato, garlic and with an empty pantry: no horizontal overflow, no page errors, controls ≥ 44px",
    "npm run gate green (168 files, 1807 tests; build clean)"
  ]
}
```

```json
{
  "id": "WEAK-A",
  "title": "Everyday-pairs index for the invent and kitchen features",
  "category": "data",
  "passes": true,
  "description": "pairings.json is missing the most common pairs in cooking (chicken|garlic, garlic|onion, garlic|olive oil, beef|onion …). 07-blend-v2.js weights NPMI, on which hub pairs score low, and keeps only the strongest 40k. Option A (owner-approved): a separate index built from the raw RecipeNLG counts, used only by the invent and kitchen features. scripts/build_everyday_pairs.mjs (rule in src/data/everydayPairsSelect.js) maps co-occurrence names onto the app vocabulary: 3,353 exact plus 136 through spelling variants and aliases, with counts summed. It drops TRIVIAL + SUGGESTION_EXCLUDE and keeps pairs with count >= 30 and PMI > 0. It scores each pair log10(count)^3 * cbrt(min(PMI,3)), keeps each ingredient's top 32 (either side) and quantile-maps the score percentile onto the curated tradition strengths. Output: public/proDataset/everyday_pairs.json, 488 KB, 35,701 pairs, 2,906 names, deterministic. src/data/everydayPairs.js has a cached, fail-safe loader (null on failure), strength(), partners() and blendIndex(curated, everyday): the buildPairingIndex shape with the per-pair max. It is wired into Invent a recipe (InventRecipe.jsx) and the Sauce Lab pantry context (Invent a sauce + My pantry stand-ins) through useEverydayPairs. The cocktail lab is not wired: links rose from 73% to 82%, but the top picks got worse (Margarita → rum sour), and its single index also drives Riff. pairings.json/.bin, the Pairing Lab, the Cookbook 'goes well with' ranking and evalPairingMatch are untouched. Before/after in docs/everyday-pairs.md (scripts/measureEverydayPairs.mjs, real set-completion model via onnxruntime-node).",
  "acceptance": [
    "Checks written down before measuring in docs/everyday-pairs.md",
    "(a) 9 of 10 named common pairs present blended (0 of 8 brief pairs curated); butter|garlic is absent because RecipeNLG PMI is -0.54, and the report says why",
    "(b) Cookbook within-recipe pairs with an edge: 29.1% curated → 67.8% blended",
    "(c)/(d) Invent a recipe (3 kitchens) and Invent a sauce (1 pantry, 10 styles) measured over 5 shuffles before/after; sizes and variety unchanged, as expected (the next bead's job)",
    "Builder selection rule unit-tested on a tiny fixture: hub pairs kept, trivial/floor/negative-PMI dropped, alias merge, top-K on either side, determinism (test)",
    "Loader caches, returns null on failure and retries; blendIndex keeps the buildPairingIndex shape, takes the per-pair max, does not mutate curated, falls back to curated when everyday is null, and drops into inventRecipes unchanged (test)",
    "Artifact <= 1.5 MB (488 KB)",
    "npm run gate green"
  ]
}
```

```json
{
  "id": "WEAK-4",
  "title": "Amount model: kitchen units and kitchen fractions (no more '3.6 each')",
  "category": "data",
  "passes": true,
  "description": "The FM-Q2 amount model (public/models/quantity_model.json) that prefills amounts in the Recipe Notebook, Invent a recipe and the kitchen hand-offs gave unusable amounts ('chicken: each 3.6', 'pasta: each 4.54', 'c 0.83' vs 'cup'). Root cause is in FM-Q1's line parser (fm_p0_2_build_corpus.mjs parseLeadingAmount): a unit counted only when the lowercased token was literally a UNIT_DENSITY key, so plurals (cups, lbs, ounces, tablespoons, teaspoons), parenthetical packages ('1 (16 oz.) pkg.'), unsized cans/packages and 'garlic cloves' all became 'each' = 100 g, and 'T.' (tablespoon) became 't' (teaspoon). On the first 100k recipes 27% of quantity lines were 'each' and only 42% of those were real counts. FM-Q2 then took the modal raw unit and qty = median grams / density, so 'each 4.54' was 454 g. Fix at the source: src/ml/ingredientLineParser.js re-parses RecipeNLG lines (package sizes converted to weight, plural/abbreviated units, case-sensitive T/t, ranges, unicode fractions, count nouns, stick butter, plausibility caps); flavor-gnn/scripts/weak4_quantity_model.mjs re-parses once (12.08M triples), picks volume / weight / count per ingredient by vote with the ingredients.json category default as tie-break (runner-up within 80%), takes the median amount in that dimension and expresses it via src/ml/kitchenUnits.js category rules (spices tsp; oils and sauces tbsp below 1/4 cup; meat, fish and pasta by the pound from ~1/2 lb; small weights in oz; counts keep their noun: each / clove / can / pkg) rounded to kitchen fractions (spoons 1/8 1/4 1/2 3/4, cups 1/4 1/3 1/2 2/3 3/4, quarter pounds, whole cloves, half steps for 'each' below 2). quantityModel.predictQuantity adds a post-processing layer (kitchenize: normalise unit names, round) so any older artifact also yields kitchen amounts; quantityRuntime writes raw as ASCII kitchen fractions ('1 1/2 lb') that parseAmount re-reads. portionParser gains 'can' (425 g) and 'pkg' (250 g). API unchanged ({unit, qty, source} / {raw, qty, unit, inferred}); artifact 186 -> 212 KB.",
  "acceptance": [
    "A hand-written list of 46 common ingredients, each with acceptable units and a plausible range (e.g. garlic 1-6 clove; olive oil 1-4 tbsp; pasta 0.5-1 lb), written before the rebuild: 17/46 pass with the old artifact, 46/46 after (src/ml/__tests__/quantityKitchenCheck.test.js)",
    "No prediction carries a non-kitchen quantity: 1031 of 3619 entries before, 0 of 3587 after; every raw string re-parses with parseAmount to the same unit and qty (test)",
    "FM-Q2 eval: on the original triples the old metric gets worse (grams MdAPE 0.583 -> 0.667, raw-unit top-1 0.495 -> 0.317), because its ground truth is the each=100 g artefact itself; on the corrected re-parse holdout (r % 10 == 0, 1.21M rows) grams-equivalent MdAPE improves 0.647 -> 0.500 and measuring-dimension top-1 0.649 -> 0.830 (global baseline 0.662) (flavor-gnn/data/weak4_eval.json)",
    "Unit tests for unit normalisation, kitchen rounding, category rules and the line parser's artefacts (kitchenUnits.test.js, ingredientLineParser.test.js, quantityModel.test.js)",
    "API and artifact size kept: {unit, qty, source} / {raw, qty, unit, inferred}; 212 KB vs 186 KB",
    "npm run gate green (180 files, 2001 tests on master 3a3c958 + WEAK-4; build clean)"
  ]
}
```

```json
{
  "id": "WEAK-2",
  "title": "Directions index: steps that match their recipe, one per title",
  "category": "data",
  "passes": true,
  "description": "public/models/directions_index.json (real RecipeNLG recipes behind 'What's in my kitchen?' and Invent a recipe's closest real recipe) had 15.5% of entries whose steps mention none of their ingredients ('Barbecue Wieners' with 'Wash turkey thoroughly…'), 41% repeated titles and 6.3% titles naming a food the list lacks. Root cause measured: not a CSV join drift (parser counter equals the CSV index column on all 2,231,142 rows, all corpus titles match); the source rows themselves are mismatched, and the old builder took the first 40,000 sets in file order, all from the scraped 'Gathered' rows, unchecked. flavor-gnn/scripts/fm_dir1_build_index.mjs now joins on the CSV index column and re-checks the title, screens every 3-10-ingredient candidate (steps must mention >= 1/3 of the raw ingredients and >= 1 shown one; title headline foods must be in the list; no meat cooked in steps that list and title lack; method <= 1,000 chars), keeps per normalised title the most complete version + at most one more with <= 25% Jaccard overlap, and samples titles in seeded-hash order to 40,000 entries (<= 25 MB). Pure checks in src/ml/directionsQuality.js; fm_dir1_measure.mjs reports the numbers; docs/directions-index.md has before/after. The kitchen panel's real-recipe list shows one result per normalised title.",
  "acceptance": [
    "Builder joins on the CSV index column and drops + counts title mismatches (0 drift, 0 mismatches on the rebuild)",
    "Alignment, title-food, foreign-meat and same-title variant checks unit-tested on fixtures, including the real Barbecue Wieners row (src/ml/__tests__/directionsQuality.test.js)",
    "Rebuilt index: 40,000 entries, 24.01 MB (<= 25 MB), seeded deterministic sample; steps mentioning none of their ingredients 15.5% -> 0%, repeated titles 40.9% -> 5.4% exact (max 2 per normalised title), missing title food 6.3% -> 0% (test reads the shipped file)",
    "docs/directions-index.md: root cause, before/after table, 20-entry spot-check",
    "Kitchen real-recipe list shows at most one result per normalised title (test)",
    "npm run gate green (182 files, 2024 tests on master e2310af + WEAK-2; build clean)"

  "id": "WEAK-5",
  "title": "Invent: dishes and sauces of a real size, and Shuffle that finds new ones",
  "category": "feature",
  "passes": true,
  "description": "Invented dishes averaged 4-4.4 ingredients and repeated (the pasta kitchen gave one dish), one beef-kitchen dish had no beef, sauces were thin (salsa = tomato + garlic) and their 'why' lines leaned on olive oil + garlic. Cause: ranking by mean pair strength favours small sets, and a deterministic top-k repeats. Recipe (src/data/inventRecipe.js): each seed is grown four ways up to 8 ingredients (fit gate logit -3.5, was -2.5), every prefix alone and with 1-2 common outside ingredients becomes a candidate; score = coherence (basics left out; 1/4 mean pair + 3/4 best partner) + size (flat top 5-8) + role balance (main, vegetable, starch where the cuisine expects one, aromatic, acid or richness, herb or spice) + fit - buying (0.05 to fill to 5, 0.09 beyond) + kitchen use; the chosen main is in every dish, savoury dishes need a centre, a kitchen with a protein/legume/starch builds every dish on one, thin subsets of better dishes are dropped. Sauce (src/data/inventSauce.js): basics fill slots but never count toward coherence or the 'why', pair strength capped at 0.5, size term peaking at 5-7, a cost for an optional ingredient that pairs with nothing, a second optional aromatic for Tomato and Salsa; chemistry slots unchanged. Variety (src/data/inventVariety.js): maximal marginal relevance (lambda 0.6, Jaccard) against the ideas shown this session, unique names in that order, and 'That's every idea for this kitchen/pantry; add an ingredient for more' with Start over when the pool is done (InventRecipe.jsx, InventSauce.jsx). Measured by scripts/measureInvent.mjs (real set-completion model via onnxruntime-node); before/after and by-eye review in docs/invent-size-variety.md.",
  "acceptance": [
    "Checks (a)-(f) written down before changing anything in docs/invent-size-variety.md",
    "(a) recipe mean size within 5-8: chicken 4.43 -> 5.67, pasta 5.00 -> 5.67, beef 4.00 -> 5.08",
    "(b) distinct dishes over a first page + 5 Shuffles >= 10: chicken 5-6 -> 18, pasta 1 -> 18, beef 3 -> 18 (pools 71/29/65, none exhausted; a 2-item kitchen reaches the exhausted message after 11)",
    "(c) chosen main in 100% of its dishes (471/471); with any main, 180/180 dishes have a centre (was 35/48)",
    "(d) no assumed basic in the top 'why' pair: recipes 0/180, sauces 330/545 -> 0/345",
    "(e) sauce mean size 4.41 -> 5.97 over 10 techniques with the chemistry tests (inventSauce.test.js) passing",
    "(f) by-eye review: 9/10 recipes and 9/10 sauces a cook would make (tables in the doc)",
    "Unit tests: size term, coherence, role balance, centre rule, buying cost, why line, MMR selection, exhaustion, unique names (inventRecipeSize.test.js, inventVariety.test.js, inventSauce.test.js, InventRecipe/InventSauce component tests); four existing invent tests updated with a reason in the test",
    "Checked at 375px in Chrome (Vite 5197): 18 distinct dishes over 5 Shuffles, main = lemon in every card, exhausted message + Start over for recipe and sauce, no page errors",

  "id": "WEAK-3",
  "title": "\"Makeable\" that matches how people cook: mains vs flavourings, everyday swaps, spice rack",
  "category": "feature",
  "passes": true,
  "description": "With a 30-item kitchen, 0 of 83 Cookbook recipes were 'You can make'; the misses were mostly flavourings. src/data/recipeMains.js classifies each recipe ingredient as main or supporting from the ingredient-graph category, in this order: per-recipe dish-defining flavourings (25 recipes), then ingredients the recipe's name names, then a short per-ingredient list (onion main, garlic supporting, parmesan main, panko supporting), then bake/dessert structure, then the category. A recipe is makeable when every main is covered; missing supporting items show as 'even better with'. src/data/kitchenSwaps.js is a hand-written table of 65 directed everyday swaps. Each side has the same role (graph category) and kind; butter <-> oil applies only where the fat is supporting; 'sauce: false' marks swaps that fail in a sauce. A swap from the kitchen counts a main as covered and is shown ('use your onion for the scallion', 'with a swap'). A Spice rack switch (fn-my-kitchen-spices, default off) counts 16 common dried spices as on hand in the Recipe Lab, the Sauce Lab pantry and What do I need?. The Sauce Lab pantry stays strict (no split, no table swaps). Fixes found on the way: 'bell pepper' was stored as pepper (the spice) and 'vegetable oil' as vegetable; a vinegar is now an Acid before the sauce Liquid rule (cider vinegar had been a wine-kind stand-in). Report: docs/kitchen-makeable.md (scripts/measureKitchenMakeable.mjs).",
  "acceptance": [
    "Checks written down before changing code in docs/kitchen-makeable.md",
    "(a) 30-item kitchen: You can make 0 -> 6 (predicted 6), 3 with a swap; every listed recipe has all mains covered directly or by a table swap (mechanical re-check in the script and a test)",
    "(b) 6-item kitchen: 0 -> 0 (predicted 0); one-or-two-mains-away 1 -> 20",
    "(c) By-eye review of 15 newly makeable recipes: 14 yes, 1 no (Chana Masala without garam masala), now fixed by a per-recipe main; Kung Pao from chicken+garlic+onion caught on the first run and fixed",
    "(d) No swap crosses roles: a test over the whole table checks the same graph category on both sides, Sauce Lab role agreement, sauce flag never contradicting sameRoleAndKind, supporting-only fat swaps, no garlic<->onion (test)",
    "Unit tests: classification (category defaults, garlic/onion, name rule, per-recipe overrides, bakes, no-graph fallback, every Cookbook recipe has >= 2 mains), swaps (findSwap helpers, supportingOnly, inRecipe, sauce mode), spice rack storage and coverage, kitchen aliases, split/swap coverage, needsFromKitchen better/swaps, shopping list (test)",
    "Component tests: KitchenPanel mains/swap/even-better rows and the Spice rack switch; WhatDoINeed You need / Even better with / swaps / summary; Cookbook card reads kitchen + spice rack; Sauce pantry spice rack (test)",
    "Checked at 375px in the browser (kitchen panel switches + You can make with spice rack off/on, Cookbook card What do I need? with a swap, Sauce pantry switches); no horizontal overflow",
    "npm run gate green"
  ]
}
```

```json
{
  "id": "STORIES-1",
  "title": "Dish stories and photos from Wikipedia on recipe, sauce, cocktail and wine cards",
  "category": "feature",
  "passes": true,
  "description": "Cards carry an 'About this dish / sauce / drink / wine' section: the first 1-2 sentences (<=300 chars) of the English Wikipedia article plus its lead photo when the photo is freely licensed on Wikimedia Commons. Build-time only: scripts/build_dish_stories.mjs (polite User-Agent, ~1 req/s, raw responses cached in .cache/dish-stories/, deterministic re-runs) writes public/data/dish_stories.json (271 KB, keyed recipes/sauces/cocktails/wines, _meta with source, licences, date, counts). Matching (src/data/dishStoryMatch.js, pure): overrides (scripts/dish_story_overrides.json: title, null to skip, or {title, photo:false}), then exact title, sentence case, title + qualifier, then opensearch; a page is accepted only if not a disambiguation page, food/drink by description or first sentence (own title excluded; album/film/place/distillery descriptions rejected), and the title plausibly names the item (search hits may be more specific, never less, so riffs do not inherit their parent). Photos: lead image must be a Commons file (enwiki-hosted = skipped) with LicenseShortName CC0 / public domain / CC BY / CC BY-SA and a real artist; thumbnails hotlinked from upload.wikimedia.org (500px bucket). Loader src/data/dishStories.js (lazy, cached, fail-safe, retries after failure) + component src/components/DishStory.jsx (fixed aspect box, loading=lazy, alt 'Photo of x', chalk frame, credit 'Text: Wikipedia (CC BY-SA) · Photo: artist, licence' all linked) mounted in Cookbook RecipeDetail, SauceLab and CocktailLabV2 LabNodeCard children, WineLab card. README data-licence table row added. Report: docs/dish-stories.md.",
  "acceptance": [
    "Checks and coverage predictions written before the first fetch in docs/dish-stories.md",
    "(a) Coverage, predicted -> actual: recipes story 85% -> 95% (79/83), photo 75% -> 94%; sauces 80% -> 94% (72/77), photo 65% -> 86%; cocktails 35% -> 40% (177/439), photo 28% -> 37%; wines 85% -> 98% (52/53), photo 60% -> 77%",
    "(b) 100% of the 348 shipped photos have a free licence, a recorded artist, a Commons file page and an upload.wikimedia.org URL (test over the JSON)",
    "(c) No disambiguation or non-food pages: test over title + description + text; by-eye review of every recipe and sauce (title, text, photo on a contact sheet) and of all cocktail and wine titles + photos; 15 wrong matches caught and fixed by rule or override (albums, distillery, Dal makhani, Supreme (cooking), Madeira wine, Shiraz wine, parent-cocktail redirects)",
    "(d) Component tests: loader (single fetch, fail-safe, retry), section with photo / without photo / no story / failed image, Cookbook popup and sauce LabNodeCard with and without a story",
    "Unit tests for the matching rules on fixtures, no network (Mole sauce vs animal, Bramble cocktail vs shrub, Gravy (Southern), Velouté, riffs, sentence case, spelling-variant redirects, licences, artist cleaning, sentence trimming)",
    "Checked at 375px in Chrome (Vite 5297): Paella, Mole Poblano, Butter Croissant, Garlic Bok Choy (no story), Béchamel, Mole Poblano sauce, Negroni, Bramble, Golden Boy (no story), Barolo; images loaded, no overflow, no page errors",
    "npm run gate green"
  ]
}
```

## 2026-11-07 — Apple News links resolve to the publisher; ?import= share link

```json
{
  "id": "WEBLINK-17",
  "title": "Apple News links: find the recipe on the publisher's own site, fail helpfully, and accept ?import= from an iOS Share-sheet Shortcut",
  "category": "feature",
  "passes": true,
  "description": "The owner's import of an apple.news link failed with apple-news-unresolvable. apple.news pages never contain the publisher's page for newer articles, but do carry the recipe title and publisher. Server (functions/src/scrape/applenewsResolve.ts): a hard-coded publisher table (name/aliases -> host, own search URL, recipe-path regex, paywalled flag, or an unsearchable reason); the publisher's OWN site search is fetched through the existing SSRF-checked fetcher with the r.jina.ai fallback (no general web search engine); candidate links must be on the publisher host and match a recipe path; a candidate is accepted only if its slug AND then the parsed page's recipe title both match the Apple title (identity tokens, coverage >= 0.85 and Dice >= 0.85, >= 2 shared words, marketing adjectives kept, ties refused as ambiguous). Resolution is capped at 12 s and at what is left of a 23 s overall budget (client races 25 s, callable times out at 30 s). Success returns a normal result plus resolvedFrom 'apple.news', publisherUrl and publisherHost; the older canonical-link path (which DOES fire on older Bon Appetit and Allrecipes articles) is tagged the same way. Failure returns appleNews {title, publisher, paywalled, searchQuery, reason, publisherUrl?}. Client: src/components/AppleNewsFallback.jsx replaces the dead-end message (recipe + publisher named, why, subscriber-only when true, a user-clicked 'Find it on the web' search link, a paste box, the Share -> Open in Safari tip); the preview says 'Found on <host>'. ?import=<url> (and ?path=make&import=) opens Make a recipe on the web-link step and queues the parse through the existing signed-out flow; only http(s) is accepted (src/utils/importParam.js) and the param is removed with history.replaceState. Shortcut steps: docs/apple-news-shortcut.md, linked from a 'Sharing from Apple News?' expander.",
  "acceptance": [
    "Publisher map unit tests: names, aliases, curly/straight apostrophes, paywalled flags (ATK, Cook's, NYT Cooking), People Inc. sites marked blocks-automated-access with no search, every search URL on its own host over https (test)",
    "Title matching tests incl. near-miss rejections taken from the live search pages (miso-glazed-pork vs miso pork stir-fry, southern-fried-chicken vs Southern Thai, black-forest-cupcakes, easy/classic tuna melt vs Ultimate Tuna Melt, one missing word, one extra word on a 2-word title, single shared word) and ambiguity refusal (test)",
    "Resolver tests with fixtures and no network: success, slug matches but page title differs -> rejected, no ingredients -> rejected, unknown / unsearchable / no title fetch nothing, search failure, budget timeout (test)",
    "Handler tests: resolvedFrom/publisherHost on success (search and canonical paths), fallback payload {title, publisher, paywalled, searchQuery, reason}, publisherUrl kept when Apple linked a page that refuses us, SSRF on a canonical link still a hard error (test)",
    "Real links measured 2026-11-07 (13 apple.news links: 2 fixtures + 11 found by web search): 8 resolve with ingredients (ATK and Epicurious fixtures and Pioneer Woman via publisher search with title match; 4 Bon Appetit via Apple's canonical link, 2 of them with a renamed title); Ultimate Tuna Melt correctly refused; Delish listicle refused (not a recipe); HGTV Magazine unsearchable; 3 Allrecipes refused by the publisher (402 + Jina 451) and returned with the publisher link. Slowest call 5.4 s",
    "Client tests: fallback panel copy, subscriber line only when paywalled, search link href/target/rel, tip, paste box imports, publisher link, back; Found-on line; initialImportUrl starts the parse once, signed-out queue then resume, non-http ignored; share-help link (test)",
    "App tests: ?import= skips the landing picker and opens make, wins over another ?path=, is stripped from the address bar (path kept), non-http value ignored and stripped, hand-off cleared once consumed (test)",
    "functions build + 149 tests green; npm run gate green. Not deployed (needs owner approval)"
  ]
}
```

## 2026-11-14 — Invent redesign: pick a baseline, build it yourself; "Invent this" from search

Spec: `.schermness/spec.md` → "Invent redesign". Order: INVENT-1 first (shared model), then
INVENT-2/3/4 (one per lab, independent of each other), then INVENT-5/6 (search), INVENT-7 last.

```json
{
  "id": "INVENT-1",
  "title": "Shared build model for invent: baseline skeleton, pre-filled required slots, swap/add/remove, guard rails",
  "category": "feature",
  "passes": true,
  "description": "New pure module src/data/inventBuild.js: Build/Slot/Line state shared by the three invent panels. seedBuild(skeleton, {pinned}) places pinned keys in the first accepting slot (locked) or in extras; fillRequired(build, rankFn) fills only empty required slots with the top-ranked pick; shortlist(build, slotId, rankFn, n) ranks candidates against the rest of the build; setSlot/clearSlot/addExtra/removeExtra are immutable; clearing a required slot reports it in `missing` instead of refilling. Guard rails (one base spirit, never two sours, no duplicate ingredient, lab-specific rules passed in) refuse a bad add with a one-line reason. Lab-agnostic: skeletons, rankFn and amounts are injected.",
  "acceptance": [
    "seedBuild puts each pinned key in the first slot whose accepts() takes it, marked locked + source; keys no slot takes land in extras (test)",
    "fillRequired fills every empty required slot with rankFn's top pick and leaves optional, locked and user-set slots untouched (test)",
    "shortlist excludes keys already in the build and re-ranks when another slot changes (test)",
    "clearSlot on a required slot leaves it empty and lists its label in missing; nothing refills it until fillRequired is called explicitly (test)",
    "Guard rails: duplicate key, second base spirit, second sour each refused with a reason and the build unchanged (test)",
    "npm run gate green"
  ]
}
```

```json
{
  "id": "INVENT-2",
  "title": "Cocktail Lab invent: spirit first, then 'what are you going for?', then build the drink yourself",
  "category": "feature",
  "passes": true,
  "description": "Rework src/components/InventCocktail.jsx onto inventBuild.js. Step 1 picks the spirit (bar's base spirits, or the codex's most common with an empty bar; 'any' allowed); step 2 picks the style from the 6 codex families, each with a one-line plain description (Sour: bright, shaken, citrus-forward; Aromatic Stirred: spirit-forward, silky; Highballs & Fizzes: long, bubbly, easy; Aperitivos: low-proof, bittersweet, bubbly; Tropical Sours: fruity, shaken, crushed ice; Boozy Sippers: strong, stirred, slow). Aperitivos with a spirit chosen says the aperitif is the base instead of dropping the pick silently. The card shows the FAMILY_SKELETONS slots with required ones pre-filled by the existing pairing score; each slot opens a ranked shortlist (bar first) plus free text; '+ add an ingredient' adds extras. Amounts (scaleAmounts), glass, build, colour, why-line and closest cocktails update on every change. Shuffle removed; Riff on it, Write it in the Recipe Notebook and Start over remain.",
  "acceptance": [
    "Spirit picker appears before the style picker; each of the 6 styles shows its one-line description (test)",
    "Picking bourbon + Boozy Sippers gives a card with base = bourbon (locked), sweetener pre-filled, bitters slot empty and offered (test)",
    "Swapping a slot from its shortlist and typing a free-text ingredient both update amounts, glass colour and closest cocktails (test)",
    "Adding a second base spirit or a second sour is refused with a visible reason (test)",
    "No Shuffle button; Riff on it and Write it in the Recipe Notebook pass the built lines (test)",
    "Empty bar: shortlists come from the whole codex pool; existing data-testids kept where the element survives",
    "Checked at 375px in the browser, no horizontal overflow",
    "npm run gate green"
  ]
}
```

```json
{
  "id": "INVENT-3",
  "title": "Sauce Lab invent: technique (+ protein), then build the sauce yourself",
  "category": "feature",
  "passes": true,
  "description": "Rework src/components/InventSauce.jsx onto inventBuild.js. Baseline = one of the 10 INVENT_STYLES (Roux & milk, Roux & stock, Brown reduction, Emulsion, Tomato simmer, Curry base, Stir-fry, Mole, Salsa, Nut sauce) plus an optional protein. One sauce card instead of three: required slots pre-filled from pantry first by pairStrength with the build and protein ('you'd need' kept for non-pantry picks), optional slots empty with ranked shortlists, free text and extras. 'Only what I have' restricts shortlists to the pantry and reports an unfillable required slot as missing. Amounts (amountFor), method (methodFor), wine-with-protein and closest sauce update live. Shuffle and the three-up page removed.",
  "acceptance": [
    "Picking Emulsion gives fat + egg yolk + acid pre-filled and aromatic/herb/spice empty (test)",
    "With a protein chosen, shortlists re-rank by pairing with the protein and the wine line appears (test)",
    "Only what I have + a pantry without egg yolk: emulsifier slot shown as missing, never filled from outside (test)",
    "Method text and amounts change when a slot is swapped (test)",
    "No Shuffle button; Open in Recipe Notebook passes the built lines + protein (test)",
    "Checked at 375px in the browser, no horizontal overflow",
    "npm run gate green"
  ]
}
```

```json
{
  "id": "INVENT-4",
  "title": "Recipe Lab invent: dish type + main baseline (cuisine optional), then build the dish yourself",
  "category": "feature",
  "passes": true,
  "description": "New pure src/data/dishSkeletons.js with 8 dish-type skeletons (stir-fry, braise/stew, soup, salad, pasta, roast, tacos, grain bowl), slot membership from the ingredient-graph categories used by recipeRoles / recipeMains.js. Rework src/components/InventRecipe.jsx onto inventBuild.js: step 1 dish type (DishArt drawings), step 2 main (kitchen proteins/legumes/veg first, any ingredient allowed), step 3 optional cuisine chips that only re-rank. Slot shortlists rank by the set-completion model (suggest, cuisine-aware, restricted to the slot's kinds) blended with the curated+everyday pairing index, kitchen first; if the model fails to load, ranking falls back to the pairing index and the panel still works. Amounts (predictBowlAmounts) and closest real recipe update live; Write it uses the existing inventionHandoff path. Shuffle and the three-up page removed.",
  "acceptance": [
    "dishSkeletons: every skeleton has >= 2 required slots, every slot accepts at least 5 ingredients in the graph, no slot accepts salt/oil/water (test)",
    "Stir-fry + chicken gives main = chicken (locked) and vegetable, aromatic, sauce, starch pre-filled (test with injected suggest)",
    "Changing cuisine re-orders shortlists but does not replace pre-filled or user-set slots (test)",
    "Model load failure: panel still opens, slots still fill from the pairing index (test)",
    "Write it hands the built ingredients + amounts to the Recipe Notebook (test)",
    "By-eye review of one build per dish type (8) recorded in the commit body: no absurd pre-fill",
    "Checked at 375px in the browser, no horizontal overflow",
    "npm run gate green"
  ]
}
```

```json
{
  "id": "INVENT-5",
  "title": "Search parsing for 'Invent this': split a search into recipe names and ingredients, pick a baseline",
  "category": "feature",
  "passes": true,
  "description": "Pure parseSearchForInvent(query, {names, vocab}) in src/data/inventBuild.js: comma-separated terms (ingredientSearch.parseQuery) classified as a recipe name (codex cocktail, sauce, Cookbook recipe; exact or near match) or an ingredient (vocab), unknown terms kept as free-text extras. Baseline resolver per lab: a name gives that recipe's family/technique/dish type with its lines pre-filled (source 'search'); ingredients alone use the browse page's active chips if any, else the skeleton that locks the most search ingredients (tie: most common style).",
  "acceptance": [
    "'negroni' resolves to the Negroni's codex family, with its lines pre-filled as source 'search' (test)",
    "'gin, cucumber' resolves to ingredients, both locked; baseline picked by most slots filled (test)",
    "'negroni, mezcal' gives the Negroni baseline with mezcal swapped into the base slot (test)",
    "An unknown term is kept as a free-text extra, never dropped (test)",
    "Active spirit/family/cuisine chips on the browse page override the best-fit baseline (test)",
    "npm run gate green"
  ]
}
```

```json
{
  "id": "INVENT-6",
  "title": "'✨ Invent this' button on the Cocktail, Sauce and Cookbook search bars",
  "category": "feature",
  "passes": true,
  "description": "CocktailBrowse.jsx, SauceBrowse.jsx and CookbookLab.jsx show '✨ Invent this' whenever the search box has text, including when 0 results match ('No cocktail has gin + cucumber + chartreuse — invent one?'). It opens the lab's invent panel already seeded via parseSearchForInvent + seedBuild (Cookbook opens Recipe Lab invent). Baseline pickers stay editable; changing them re-seeds and keeps the locked search ingredients.",
  "acceptance": [
    "Button hidden with an empty search, shown with text, shown with 0 matches with the no-match copy (test, all three surfaces)",
    "Cocktail search 'gin, cucumber' opens InventCocktail with gin and cucumber locked (test)",
    "Sauce search 'tomato, basil' opens InventSauce with both locked under a fitting technique (test)",
    "Cookbook search 'chicken' opens Recipe Lab invent with chicken as the main (test)",
    "Changing style/technique/dish type in the panel keeps the searched ingredients (test)",
    "Checked at 375px in the browser on all three surfaces",
    "npm run gate green"
  ]
}
```

```json
{
  "id": "INVENT-7",
  "title": "Invent redesign cleanup: retire the finished-idea generators from the UI, docs, final browser pass",
  "category": "chore",
  "passes": true,
  "description": "Remove now-unused UI paths (Shuffle, nextInventions/nextSauces paging, exhausted copy) and any generator exports nothing imports any more; keep the scorers the build model reuses. Update the entry-point copy (LabsPanel 'Mix a drink by family + spirit' etc.) and CLOSEOUT.md / BACKLOG.md. Final pass in the browser across all three labs and the three search surfaces.",
  "acceptance": [
    "grep finds no remaining import of removed exports; dead tests removed or rewritten, not skipped",
    "Entry-point copy matches the new flow on Labs, Cocktail browse, Sauce browse, Make a recipe",
    "End-to-end at 375px: bourbon Boozy Sipper built and written to the Notebook; Emulsion with chicken built; Stir-fry with tofu built; 'Invent this' from each search",
    "npm run gate green"
  ]
}
```

## 2026-11-14 — Fill My bar from a photo

Spec: `.schermness/spec.md` → "Fill My bar from a photo". Owner rulings 2026-11-14: no paid key;
each user pastes their own Gemini key (scan runs in the browser), AND a user with a code from
the owner may scan on the owner's free key through the scanBar function. Order: BARPHOTO-1
(record the test, done), BARPHOTO-2 (naming), BARPHOTO-3 (function, invite codes), BARPHOTO-6
(scan client, both paths), BARPHOTO-4 (screen), BARPHOTO-5 (final pass).

```json
{
  "id": "BARPHOTO-1",
  "title": "Record the bar-photo accuracy test: script, report, cost per photo",
  "category": "docs",
  "passes": true,
  "description": "Commit scripts/measureBarPhoto.mjs (written 2026-11-14) and write docs/bar-photo.md: the options considered, the 15 test photos (13 Wikimedia Commons with licence and artist from .cache/bar-photos/SOURCES.json, 2 of the owner's bar), the answer key and how it was made, the scores, the four failure modes with examples, and the cost per photo worked out from the measured token counts and the current Gemini 2.5 Flash list price (looked up, with the date). Photos stay in .cache/ (git-ignored).",
  "acceptance": [
    "scripts/measureBarPhoto.mjs committed; runs with no photos and with no truth file without crashing",
    "docs/bar-photo.md has the baseline numbers: 12 scored photos, 73 bottles, 77% found, 82% right; owner's bar 14 of 17, 0 invented",
    "Cost per photo stated with the price source and date",
    "Every Commons photo listed with title, licence and artist",
    "npm run gate green"
  ]
}
```

```json
{
  "id": "BARPHOTO-2",
  "title": "Bottle naming: stop losing amaretto, cassis, génépy and named amari between the label and My bar",
  "category": "fix",
  "passes": true,
  "description": "src/data/myBar.js: isBooze learns the kinds it drops (amaretto, crème de cassis and other crème de liqueurs, cream liqueurs, génépy, aquavit and similar); a bottle whose only match is a generic word ('liqueur', 'herbal liqueur') keeps its own normalised name; a plain 'amaro' entry exists and a named amaro never resolves to a different brand (Averna, Jägermeister must not become amaro montenegro, for typed entries as well as scanned ones). The bottle list sent to the model gains these entries, and the prompt forbids substituting another brand, listing unreadable bottles, or exceeding 40 entries; output tokens capped. Re-measure with scripts/measureBarPhoto.mjs --fresh.",
  "acceptance": [
    "Predictions written in docs/bar-photo.md before the re-run",
    "barKey + isBooze: amaretto, creme de cassis, licor 43, genepy, amarula each give a non-empty, non-generic bar key (test)",
    "barKey('averna') and barKey('jagermeister') are not 'amaro montenegro' (test)",
    "No existing My bar / coverCocktail test regresses; a bar saved before the change still loads",
    "Re-run on the same 12 scored photos: at least 88% found and 92% right (was 77% / 82%); numbers recorded either way",
    "The two commercial bar-wall photos (c03, c06): no entry without a readable label, no parse failure, at most 40 entries",
    "npm run gate green"
  ]
}
```

```json
{
  "id": "BARPHOTO-3",
  "title": "scanBar Cloud Function for invite-code holders: photo in, bottle list out, on the owner's own (free) key",
  "category": "feature",
  "passes": true,
  "description": "Owner rulings 2026-11-14, in order: 'No paid key'; 'Each user brings a key'; then 'Stick with pasting their own key but also allow users that have a code from me to use my key'. So there are two ways to scan: a user's own key in the browser (BARPHOTO-6), or a code the owner hands out, which runs the scan on the owner's key through this function. Start from the function already built on branch worktree-agent-ac7124b4a03455f73 (commit c96f7a9, functions/src/barscan/, 33 tests) and change the access rule: instead of requiring sign-in, the request carries `code`; the function looks up Firestore `scanCodes/{code}` ({ enabled: boolean, label: string, dailyCap?: number }) through the Admin SDK and refuses a missing, unknown or disabled code with permission-denied and one fixed message (never saying which). Codes are compared as given after trim; a code must be 8-64 characters of [A-Za-z0-9-] or it is refused before any lookup. Usage is counted per code per UTC day (`barScans/{code}_{day}`), default cap 10, overridable per code by dailyCap; over the cap is resource-exhausted. Everything else stays: input validation, 4 MB limit, hardened prompt with no stated maximum, retries inside 25 s, no retry on a daily-quota 429, lenient parse, truncation to 60, no image or code in logs (log the code's label, not the code). The key is the GEMINI_API_KEY Functions secret; the owner's key is on Gemini's free tier (about 20 requests a day in total), so the 'out of capacity for today' message matters. firestore.rules must deny all client access to scanCodes and barScans. Add a short docs section on how the owner creates, disables and caps a code in the Firebase console. Merge the branch into master when green.",
  "acceptance": [
    "Missing, malformed, unknown and disabled codes each give permission-denied with the same message, and no model call (test)",
    "A valid code works with no sign-in; the model call uses the injected model (test)",
    "Missing image, non-image mime, oversize, bad vocab -> invalid-argument (test)",
    "503 then success is retried; 503 past the budget -> unavailable; a daily-quota 429 -> the 'out of capacity for today' message, not retried (test)",
    "Per-code daily cap: default 10, per-code dailyCap honoured, another code unaffected, next day resets, rejected input does not count (test)",
    "Malformed model output -> a clean error, never a partial list; more than 60 bottles truncated (test)",
    "No image bytes, base64 or code value in any log line (test over the logger calls)",
    "firestore.rules denies client reads and writes of scanCodes and barScans (rules file reviewed; test if the repo has a rules test harness)",
    "functions build + tests green. NOT deployed (needs owner approval and the secret set by the owner)"
  ]
}
```

```json
{
  "id": "BARPHOTO-4",
  "title": "My bar: 'Add from a photo' with an invite code or the user's own Gemini key, and a review list before anything is added",
  "category": "feature",
  "passes": true,
  "description": "src/components/MyBarPanel.jsx gains '📷 Add from a photo' (file input, image/*, camera or library). First use shows a one-time set-up card with two choices. 'I have a code': a paste box; the photo is read using the app owner's Google key, through this app's server, and is not stored. 'Use my own Google key': what the key is, that it is free, a link to Google AI Studio's key page, a paste box, 'the key stays on this device and is sent only to Google', that the photo goes from the browser straight to Google under the user's own key and Google's terms for that key apply, and that a free key allows about 20 scans a day. Change / remove is always available. New src/components/BarScanReview.jsx: one row per bottle (label, 'added as' name editable with the bar typeahead, checkbox; high confidence checked, medium/low unchecked; 'already in your bar'), non-alcohol items offered for the shared kitchen unchecked, 'Add N to my bar', 'Add another photo'. Uses src/data/barScan.js (BARPHOTO-6) for storage, the downscale, the scan and the row mapping; the code path uses httpsCallable(functions, 'scanBar'). Guidance line 'One shelf at a time, labels facing you'; plain messages for a rejected key, a rejected code, the daily limit, offline, busy and an empty result; manual search always still usable. No sign-in is required.",
  "acceptance": [
    "Nothing saved: tapping the button shows the set-up card with both choices, not the file picker; saving a code or a key then opens the picker; Remove returns to the set-up card (test)",
    "The set-up card says, for each choice, where the photo goes and what is kept on the device, states the free daily limit for an own key, and links to the key page with target=_blank rel=noopener (test)",
    "Nothing is written to the bar until 'Add N to my bar'; only checked rows are added; Cancel adds nothing (test)",
    "Default checks by confidence, 'already in your bar' rows, editable 'added as' name, bottles with no bar name shown as editable not dropped (test)",
    "Checked 'other' items go to the kitchen list, not the bar (test)",
    "Rejected key, rejected code, daily limit, offline, busy and empty result each show their own message and leave the manual bar usable (test)",
    "The key and the code are masked in the DOM after saving and never appear in console output (test)",
    "Checked at 375px in the browser with a stubbed scan result, no horizontal overflow",
    "npm run gate green"
  ]
}
```

```json
{
  "id": "BARPHOTO-5",
  "title": "Bar photo final pass: owner's photos end to end by key and by code, docs, deploy hand-off",
  "category": "chore",
  "passes": false,
  "description": "Run the owner's two bar photos through the real flow in the browser, once with the owner's key pasted in and once with an invite code against the functions emulator (or the deployed function if the owner has approved a deploy), and compare with the test. Update docs/bar-photo.md (the three rulings and what was built), CLOSEOUT.md and the README (the two ways to scan, where the key and code live, how the owner makes and disables a code). List exactly what the owner must do to switch the code path on: set the GEMINI_API_KEY secret, deploy the function and the rules, create a code. Note that Google's pricing page says gemini-2.5-flash requests route to a newer Flash-Lite model from 2026-12-01, so accuracy should be re-measured after that date.",
  "acceptance": [
    "Owner's two photos end to end by own key: the review list shows the bottles found in the test (14 of 17 or better), none invented",
    "The same by invite code against the emulator or the deployed function",
    "CLOSEOUT.md and README describe both paths and the owner's steps to enable codes",
    "docs/bar-photo.md records the rulings and the model-routing note",
    "npm run gate green; function and rules deployed only if the owner approved"
  ]
}
```

```json
{
  "id": "BARPHOTO-6",
  "title": "Bar photo scan client: the user's own Gemini key in the browser, or an invite code through scanBar",
  "category": "feature",
  "passes": true,
  "description": "Owner rulings 2026-11-14, in order: 'No paid key'; 'Each user brings a key'; then 'Stick with pasting their own key but also allow users that have a code from me to use my key'. New module src/data/barScan.js, no React. (1) Storage on this device only, wrapped like myBar.js so blocked storage means 'nothing saved', never an error: the user's own key ('fn-gemini-key') and an invite code ('fn-scan-code'); load/save/clear for each, a format sanity check, a mask for display, and scanMode() -> 'key' | 'code' | null (own key wins when both are saved). (2) downscaleSize(w, h, 1600) and a canvas-based downscale to JPEG. (3) scanBarPhoto({ imageBase64, mimeType, vocab, key?, code?, fetch, callScanBar }): with a key it calls Google's generateContent REST endpoint directly from the browser, key in the x-goog-api-key header (never in the URL), model gemini-2.5-flash, temperature 0.1, JSON response schema, thinking off, capped output tokens, prompt and schema as in functions/src/barscan/handler.ts (only readable labels, never another brand's name, key '' when nothing fits, no stated maximum, truncate to 60 in code), retries 503/429 up to 3 times inside 25 s but not a daily-quota 429; with a code it calls the scanBar callable (injected as callScanBar) with { code, image, mimeType, vocab } and maps its HttpsError codes. Both paths return the same { bottles, other } and the same typed errors: not-set-up, bad-key, bad-code, daily-limit, busy, offline, unreadable. (4) toReviewRows(result, bar, { names, roles }) with barKey/isBooze: default checks by confidence, already-in-bar flag, bottles with no bar name kept as editable rows, merge of a second photo without duplicates. The vocab list is built from the cocktail codex the way scripts/measureBarPhoto.mjs does. fetch and callScanBar are injected so tests use no network.",
  "acceptance": [
    "Storage: key and code each round-trip; blocked or missing storage gives 'nothing saved' without throwing; mask shows only the last 4 characters; scanMode prefers the key (test)",
    "Key path: the request goes to generativelanguage.googleapis.com only, key in a header and never in the URL or body (test on the injected fetch)",
    "Code path: callScanBar receives { code, image, mimeType, vocab } and fetch is never called (test)",
    "Both paths: parsed bottles and other; more than 60 truncated; entries missing label/type dropped; unknown confidence becomes low (test)",
    "Key path errors: 503 then success retried; past the budget -> busy; daily-quota 429 -> daily-limit, not retried; 400/401/403 -> bad-key; network error -> offline; malformed JSON -> unreadable (test, injected sleep)",
    "Code path errors: permission-denied -> bad-code; resource-exhausted -> daily-limit; unavailable -> busy; internal -> unreadable (test)",
    "toReviewRows: rows from a result, default checks by confidence, already-in-bar flag, merge without duplicates, no-bar-name bottles kept (test)",
    "downscaleSize keeps aspect ratio, never upscales, long side at most 1600 (test)",
    "Neither the key nor the code is ever written to console or to any error message (test)",
    "npm run gate green"
  ]
}
```

## 2026-11-14 — Invent, second pass: start empty, the cook chooses everything

Spec: `.schermness/spec.md` → "Invent, second pass". Owner's review of the live v1.12.0 panels:
no pre-filled ingredients or name; liquor / main ingredient first; category optional and
recommended from the list; suggestions, replacements and a flavor profile on the panel; the
cook names it and saves it to their account. Order: INVENT-8 (shared pieces) first; then
INVENT-9 / 10 / 11 (one per lab) and INVENT-12 (saving and lists) in parallel; INVENT-13 last.

```json
{
  "id": "INVENT-8",
  "title": "Invent shared pieces for start-empty: checklist, category recommendation, suggestions, replacements, flavor profile, name-and-save",
  "category": "feature",
  "passes": true,
  "description": "Shared building blocks the three panels will use; no panel is reworked here. Pure, in src/data/inventBuild.js (additive, existing API kept): openBuild({ lab, baseline, lines }) for a list with no category; applyCategory(build, skeleton) / clearCategory(build) that re-home the same lines into a skeleton's slots (or back to a flat list) without adding or dropping any; checklist(build) -> [{ slotId, label, required, done, key }]; advice(build) -> soft notes for rails that are advice not refusals (two base spirits = split base), with only a duplicate ingredient still refused; recommendCategory(keys, skeletons, { order }) -> { id, placed, requiredPlaced } | null using the best assignment of keys to distinct slots (the logic INVENT-5 used for search, moved here and reused there); suggestNext(build, rankFn, n) -> ranked candidates for the whole list. New pure src/data/inventProfile.js: buildFlavorProfile(keys, nodes) on recipeProfileAnalysis.js (scores per axis, which keys had no data). New pure src/data/inventSaved.js: the saved-item shape, toSavedItem(build, { name, category, lines, method, glass, protein }), validation (name, at least two ingredients), and fromSavedItem(item) -> a seed that reopens it. Components (lab-agnostic, chalk): InventList.jsx (the cook's lines with editable suggested amount, remove, 'don't have it' mark and a replacements popover fed by a replacementsFor(key) prop, plus the always-visible add box), InventChecklist.jsx, InventSuggestions.jsx, InventCategoryHint.jsx (recommendation with Accept / Not now), InventFlavorProfile.jsx (compact 11-axis chart reusing the recipe creator's drawing where it can), InventNameSave.jsx (empty name box, save button, disabled rules, signed-out prompt via an onNeedSignIn prop). InventSlots.jsx stays until the panels stop using it (INVENT-13 removes it).",
  "acceptance": [
    "openBuild holds exactly the lines given and nothing else; applyCategory then clearCategory returns the same lines in the same order (test)",
    "checklist ticks a part only when a line fits it, each line ticks at most one part, and never adds a line (test)",
    "recommendCategory returns null under two ingredients, picks the category that places the most keys in distinct slots with ties to required parts then order, on fake skeletons and on the real cocktail families (gin + lime juice + simple syrup -> Sour; bourbon + sugar + bitters -> Boozy Sippers) (test)",
    "advice reports a second base spirit as a note and the add still succeeds; a duplicate ingredient is still refused (test)",
    "suggestNext excludes what is in the list and puts owned items first (test)",
    "buildFlavorProfile returns axis scores and the list of keys with no data; an empty list gives an empty profile, no throw (test)",
    "toSavedItem refuses an empty name or fewer than two ingredients; fromSavedItem(toSavedItem(x)) reopens the same lines and category (test)",
    "Each component renders from props alone, imports nothing lab-specific, has 44px targets, and has its own test; InventNameSave starts with an empty name box",
    "Existing inventBuild / inventSearch tests still pass; npm run gate green"
  ]
}
```

```json
{
  "id": "INVENT-9",
  "title": "Cocktail Lab invent starts empty: which liquor, optional style, add your own ingredients, recommended style, suggestions, replacements, flavor profile, name and save",
  "category": "feature",
  "passes": true,
  "description": "Rework src/components/InventCocktail.jsx onto the INVENT-8 pieces. Step 1 'Which liquor?': the bar's base spirits first, then the common ones, a text box, no 'any'. Nothing else is shown until it is answered. The list then holds only that liquor. 'Going for a particular style? (optional)' is collapsed; choosing one of the 6 families shows the checklist built from FAMILY_SKELETONS; with none chosen and two or more ingredients the recommendation appears and is applied only on Accept. The cook adds ingredients by typing (barKey) or from suggestions (rankCocktailSlot over the whole list, bar first). Lines not in the bar or kitchen are marked with replacements from swapCandidates. Amounts are suggestions by role (scaleAmounts when a style is set, role defaults otherwise), editable. The flavor profile is drawn from the list. Glass, method, why-line and closest cocktails appear only once a style is chosen or accepted. The name box is empty; 'Add to my cocktails' calls onSave(savedItem) (wired in INVENT-12); Riff on it and Write it in the Recipe Notebook stay. fillRequired is not called anywhere in the panel. The seed prop still opens the panel from a search with the searched ingredients as the list.",
  "acceptance": [
    "The panel opens showing only the liquor question; no ingredient list, no name, no card (test)",
    "After picking bourbon the list is exactly [bourbon]; nothing else is added and the name box is empty (test)",
    "With no style, adding sugar and bitters shows 'This looks like Boozy Sippers'; the style is applied only after Accept; Not now hides it until the list changes (test)",
    "With Sour chosen the checklist shows a sour and a sweetener unticked; adding lime juice ticks the sour; tapping the unticked sweetener lists suggestions and adds nothing by itself (test)",
    "A second base spirit is added with a split-base note; a duplicate is refused (test)",
    "An ingredient not in the bar shows 'Don't have it? Try…' with same-role bottles from the bar, and tapping one replaces the line (test)",
    "The flavor profile renders for the list and names ingredients it could not count (test)",
    "Save is disabled until there is a name and two ingredients; onSave receives name, lines with amounts and roles, and the style or null (test)",
    "Opening from the search seed shows the searched ingredients as the list (test)",
    "npm run gate green"
  ]
}
```

```json
{
  "id": "INVENT-10",
  "title": "Sauce Lab invent starts empty: main ingredient, optional 'what is it for', optional technique, add your own, recommended technique, suggestions, replacements, flavor profile, name and save",
  "category": "feature",
  "passes": true,
  "description": "Rework src/components/InventSauce.jsx onto the INVENT-8 pieces. Step 1 'What is the sauce built on?': pantry items that can anchor a sauce first (tomato, butter, cream, chili, stock, nuts, yogurt, …), common ones next, a text box. Step 2 optional 'What is it for?' (the protein / dish chips that exist today). The list holds only the main. 'A particular technique? (optional)' is collapsed; choosing one of the 10 INVENT_STYLES shows its checklist with the chemistry explained on unticked required parts ('an emulsion needs egg yolk: its lecithin holds the fat'); with none chosen the technique is recommended from the list and applied only on Accept. Suggestions rank by pairing with the list and the protein, pantry first. Lines the cook does not have are marked with same-role, same-kind replacements from the pantry. 'Only what I have' restricts suggestions and replacements to the pantry. Amounts are suggestions (amountFor), editable. Flavor profile from the list. Method, vessel, wine and closest sauce appear only once a technique is chosen or accepted. Empty name box; 'Add to my sauces' calls onSave(savedItem); Open in Recipe Notebook stays. fillRequired is not called. The seed prop still works.",
  "acceptance": [
    "The panel opens showing only the main-ingredient question (test)",
    "After picking butter the list is exactly [butter] and the name box is empty (test)",
    "With no technique, adding egg yolk and lemon juice recommends Emulsion; applied only on Accept (test)",
    "With Emulsion chosen and no egg yolk, the emulsifier part is unticked with its one-line why, and nothing is filled in for it (test)",
    "Choosing 'for chicken' re-ranks suggestions and the wine line appears once a technique is set (test)",
    "A line not in the pantry shows replacements from the pantry of the same role and kind; 'Only what I have' limits suggestions to the pantry (test)",
    "The flavor profile renders for the list (test)",
    "Save is disabled until there is a name and two ingredients; onSave receives name, lines, technique or null, protein (test)",
    "Opening from the search seed shows the searched ingredients as the list (test)",
    "npm run gate green"
  ]
}
```

```json
{
  "id": "INVENT-11",
  "title": "Recipe Lab invent starts empty: main ingredient, optional dish type, add your own, recommended dish type, suggestions, replacements, flavor profile, name and save",
  "category": "feature",
  "passes": true,
  "description": "Rework src/components/InventRecipe.jsx onto the INVENT-8 pieces. Step 1 'What is the main ingredient?': kitchen items first, a text box. The list holds only the main. 'A particular kind of dish? (optional)' is collapsed (the 8 dish types, two-column grid); with none chosen the dish type is recommended from the list (dishTypeForIngredients / recommendCategory) and applied only on Accept. Cuisine stays an optional steer for suggestions. Suggestions come from the set-completion model blended with the pairing index (as rankDishSlot does), kitchen first, and fall back to the pairing index when the model is not loaded; they are offered, never added. Lines not in the kitchen are marked with replacements from kitchenSwaps.findSwap. Amounts are suggestions (predictBowlAmounts), editable. Flavor profile from the list. Method and closest real recipe appear only once a dish type is chosen or accepted. Empty name box; 'Add to my recipes' saves through the existing user-recipe path (INVENT-12 wires it) and 'Write it' still hands off to the Recipe Notebook. fillRequired is not called; the model re-fill that replaced pre-filled slots is removed. The seed prop still works.",
  "acceptance": [
    "The panel opens showing only the main-ingredient question (test)",
    "After picking chicken the list is exactly [chicken] and the name box is empty (test)",
    "With no dish type, adding noodle, soy sauce and ginger recommends Stir-fry; applied only on Accept (test)",
    "With Tacos chosen the checklist shows tortilla, salsa or sauce and fresh topping unticked and nothing is filled in (test)",
    "Suggestions use the injected model when loaded and the pairing index when it failed; neither path adds an ingredient by itself (test)",
    "A line not in the kitchen shows a swap from the kitchen when kitchenSwaps has one (test)",
    "The flavor profile renders for the list (test)",
    "Save is disabled until there is a name and two ingredients; Write it hands the list and amounts to the Recipe Notebook as before (test)",
    "Opening from the Cookbook search seed shows the searched ingredients as the list (test)",
    "npm run gate green"
  ]
}
```

```json
{
  "id": "INVENT-12",
  "title": "Save an invention to the account and show the cook's own cocktails, sauces and recipes in each lab's list",
  "category": "feature",
  "passes": true,
  "description": "Profile gains cocktails: [] and sauces: [] beside the existing recipes: [] (find the profile document read/write used for Cookbook user recipes in App.jsx and its hooks; use the same path; firestore.rules already limits profiles/{uid} to its owner). src/data/inventSaved.js (from INVENT-8) is the shape. CocktailLabV2.jsx, SauceLab.jsx and MakeRecipeStart.jsx pass onSave to their invent panels: signed in -> append to the profile array and confirm ('Saved to your cocktails'); signed out -> the existing sign-in prompt, then the save resumes with nothing lost. Saved cocktails and sauces are adapted to the codex shapes the browse lists and cards already render (family from the saved category or the recommended one, else an 'Uncategorised' group), merged into CocktailBrowse / SauceBrowse in a 'Yours' group at the top and inside their family, marked as the cook's own, searchable, and counted by My bar's what-can-I-make and the sauce pantry. Opening one shows the normal card with Edit (reopens the invent panel via fromSavedItem) and Delete (confirm first). Saved recipes go through the existing user-recipe save so the Cookbook lists them as today. Sizes are bounded: at most 200 saved items per kind, names at most 80 characters.",
  "acceptance": [
    "Saving while signed in appends one item to the right profile array and nothing else in the profile changes (test with the profile writer mocked)",
    "Saving while signed out shows sign-in, and after sign-in the same invention is saved exactly once (test)",
    "A saved cocktail appears in the Cocktail Lab list under 'Yours' and its family, is found by search by name and by ingredient, and is counted by what-can-I-make when the bar covers it (test)",
    "A saved sauce appears in the Sauce Lab list the same way (test)",
    "Edit reopens the panel with the same lines, category and name; saving again updates the item in place, not a duplicate; Delete asks first and removes it (test)",
    "A profile with no cocktails / sauces fields, or with malformed entries, loads as empty lists without an error (test)",
    "Checked at 375px in the browser; npm run gate green"
  ]
}
```

```json
{
  "id": "INVENT-13",
  "title": "Invent second pass: remove what start-empty replaced, docs, final browser pass",
  "category": "chore",
  "passes": true,
  "description": "Remove InventSlots.jsx and anything else the start-empty panels no longer use (fillRequired stays in inventBuild.js only if something still calls it; otherwise remove it and its tests). Update panel and module header comments, entry-point copy, CLOSEOUT.md (an unreleased entry), README.md and BACKLOG.md. Final pass in the browser across the three labs: open, pick the start, add ingredients, accept a recommendation, use a suggestion and a replacement, read the flavor profile, name and save, find it in the list, edit, delete; and 'Invent this' from each search.",
  "acceptance": [
    "grep finds no remaining import of removed files or exports; no skipped tests",
    "No user-facing copy says the app will fill in or suggest a finished recipe",
    "End to end at 375px for each lab as described, with nothing appearing in a list or name box that was not chosen",
    "CLOSEOUT.md, README.md and BACKLOG.md updated without claiming a deploy that did not happen",
    "npm run gate green"
  ]
}
```

## 2026-11-15 — Share a recipe on social media; the link invites the visitor to join

Spec: `.schermness/spec.md` → "Share a recipe on social media". Owner's four decisions: share
the user's own recipes and the app's built-in ones; a visitor sees the whole recipe and is
asked to sign up only at Save; the picture is a generated chalkboard recipe card; the sharer
chooses each time whether a name shows. Order: SHARE-1 first (page and links for built-in
recipes, no new public data); then SHARE-2 (share sheet) and SHARE-3 (save and sign-up
prompt) in parallel; SHARE-4 (link preview function) and SHARE-5 (card image) after SHARE-1;
SHARE-6 (publishing a user's own recipe) and SHARE-7 (report, takedown, final pass) land
together, never SHARE-6 alone. Three open decisions with defaults are defined in the spec
(counting views, who handles reports, a cap on a popular link).

```json
{
  "id": "SHARE-1",
  "title": "Public recipe page and /r/ links for the app's built-in recipes",
  "category": "ui",
  "passes": true,
  "description": "New route /r/<kind>/<slug> (kind cocktail, sauce or dish) rendering SharedRecipePage.jsx: name, ingredients with amounts, method, glass or vessel, and the flavor profile chart with its 'visual guide' label. Pure resolver src/data/sharedRecipe.js: parseSharePath(pathname), slugFor(kind, item), resolveBuiltIn(kind, slug) over cocktailCodexV2.js, sauceCodex.js and the Cookbook dishes, returning one normalised shape { kind, name, lines, method, glass, category } that SHARE-6 reuses for user copies. The page opens without the landing picker, without sign-in and without loading the full pairing dataset. Unknown slug shows 'This recipe is no longer shared' with a button to the starting page.",
  "acceptance": [
    "/r/cocktail/<slug>, /r/sauce/<slug> and /r/dish/<slug> each render the whole recipe signed out, for at least three real items per kind (component tests)",
    "parseSharePath, slugFor and resolveBuiltIn are pure and unit-tested, including unknown kind, unknown slug and a slug needing URL encoding",
    "The network tab shows pairings.json is not requested when a /r/ link is opened directly",
    "An unknown link shows the 'no longer shared' message, not a blank page or the landing picker",
    "375px: no horizontal overflow; npm run gate green"
  ]
}
```

```json
{
  "id": "SHARE-2",
  "title": "Share button and share sheet on recipe cards",
  "category": "ui",
  "passes": true,
  "description": "ShareSheet.jsx plus a Share button on built-in and own cocktail, sauce and Cookbook dish cards and on the result step of the three invent panels after saving. Phone: navigator.share with title, text and url. Elsewhere: Copy link, X, Facebook, Pinterest and WhatsApp as plain share URLs (pure builder src/data/shareTargets.js, no third-party scripts), and a Download image slot that SHARE-5 fills. For built-in recipes the link is the /r/<kind>/<slug> link from SHARE-1. For a user's own recipe the button is present but routes to the publish step that SHARE-6 adds; until then it is hidden behind one flag so this task can ship alone.",
  "acceptance": [
    "shareTargets builds correct, fully encoded URLs for each network (unit tests with a name containing an ampersand, a quote and an emoji)",
    "With navigator.share available the native sheet is called with title, text and url; without it the fallback buttons render (component tests)",
    "Copy link writes the link and shows a confirmation; a clipboard failure shows the link as selectable text instead",
    "Share appears on built-in cards in the Cocktail Lab, Sauce Lab and Cookbook; no external script is loaded",
    "375px, 44px targets; npm run gate green"
  ]
}
```

```json
{
  "id": "SHARE-3",
  "title": "Save to my cookbook and Make it your own from a shared page, with the sign-up prompt",
  "category": "ui",
  "passes": true,
  "description": "On SharedRecipePage: 'Save to my cookbook' (or 'my cocktails' / 'my sauces'), 'Make it your own', and for signed-out visitors a one-line invitation with 'Create a free account'. Save reuses useSaveInvention and InventSaveOverlay; the overlay copy says why an account is needed; the save completes after sign-in returns, including the redirect sign-in flow (the pending save survives the reload). The saved copy carries sharedFrom (slug or share id). Make it your own opens that lab's invent panel through its seed prop with the recipe's lines and category. The invitation is inline, shown once per page, never a blocking pop-up.",
  "acceptance": [
    "Signed in: Save adds one copy to the right profile list with sharedFrom set; saving the same shared recipe twice does not duplicate it",
    "Signed out: Save opens the sign-in overlay; after sign-in the copy is saved without a second tap (tested for popup and for redirect return)",
    "Make it your own opens the correct lab's invent panel with every line of the shared recipe and its category chosen",
    "The signed-out invitation renders once and is absent when signed in",
    "npm run gate green"
  ]
}
```

```json
{
  "id": "SHARE-4",
  "title": "Link preview: a function that fills in the title, description and image for /r/ links",
  "category": "backend",
  "passes": true,
  "description": "Cloud Function sharePreview (functions/src/share/) and a hosting rewrite /r/** to it, placed before the catch-all. It returns the built app's index.html with <title>, og:title, og:description (the first ingredients), og:image, og:url, og:type and twitter:card=summary_large_image filled in for the recipe; every value HTML-escaped. Built-in recipes resolve from a small JSON index generated at build time (scripts/buildShareIndex.mjs) so the function does not bundle the app's data modules. Unknown or removed ids get the generic site tags. Cache-Control: public, max-age=600. If anything throws, it serves the unmodified index.html. Also adds generic og tags to index.html for every other page.",
  "acceptance": [
    "Handler unit tests: built-in cocktail, sauce and dish each produce the expected tags; a name with quotes, angle brackets and an ampersand is escaped; unknown id gives generic tags",
    "A thrown error inside the handler still returns the app's index.html with status 200",
    "firebase.json rewrite order is /r/** before ** and existing ?path= links still work (deep-link tests green)",
    "scripts/buildShareIndex.mjs runs in the build and its output covers every built-in cocktail, sauce and Cookbook dish",
    "Functions tests and npm run gate green; the function is NOT deployed without the owner's go-ahead"
  ]
}
```

```json
{
  "id": "SHARE-5",
  "title": "The recipe card images: server-drawn for previews; a downloadable set for Instagram and TikTok",
  "category": "feature",
  "passes": true,
  "description": "One pure layout description src/data/shareCardLayout.js (name, ingredient lines, the 11-axis flavor chart as plain numbers, method, the short link as printed text, site name, chalkboard palette) consumed by two renderers. Server: Cloud Function shareCard behind a hosting rewrite /r-img/**, drawing a 1200x630 PNG with satori and resvg and bundled fonts, Cache-Control one day. Browser (canvas), behind the share sheet: (a) a portrait card 1080x1350 for the Instagram feed; (b) a tall card 1080x1920 for Stories and TikTok, with the top and bottom 250px kept clear of text because both apps cover them; (c) a swipeable set of three cards in either size: 1 name and flavor chart, 2 ingredients, 3 method. Every card prints the short link (for example neuralflavor.web.app/r/ab12cd) since neither app allows a tappable link in a post. Share sheet additions: 'Share images' hands the PNG files to navigator.share where navigator.canShare({ files }) is true, so the person picks Instagram or TikTok in the phone's own menu; 'Download images' everywhere else; 'Copy caption' copies a ready caption (recipe name, the link as text, two hashtags) because the share menu does not carry text with files; one line says the link was copied for an Instagram Story link sticker. Long names shrink, then wrap to two lines, then truncate; long ingredient lists and methods continue with '+N more at the link'. The chart is labelled 'flavor chart: a visual guide'. No posting API of Instagram or TikTok is used. A short video is NOT part of this task (later experiment, needs testing on real phones).",
  "acceptance": [
    "shareCardLayout unit tests: 1, 8 and 20 ingredients; an 80-character name; a method too long for one card; a recipe with no profile data (chart omitted, not empty axes); the printed link present on every card",
    "The server renderer returns a 1200x630 PNG for a built-in cocktail, sauce and dish (functions tests check signature and dimensions)",
    "The browser renderer produces PNGs of exactly 1080x1350 and 1080x1920, single and as a set of three, and no text falls in the top or bottom 250px of the tall card (layout unit test)",
    "With navigator.canShare({ files }) true, 'Share images' calls navigator.share with the files; with it false or absent, 'Download images' is offered instead (component tests)",
    "'Copy caption' copies the name, the link and the hashtags; a drawing failure does not block Copy link",
    "og:image from SHARE-4 points at the /r-img/ URL for the same recipe",
    "Checked in the browser at 375px; sharing into Instagram and TikTok on a real phone is named as NOT verified unless the owner did it",
    "npm run gate green; the function is NOT deployed without the owner's go-ahead"
  ]
}
```

```json
{
  "id": "SHARE-6",
  "title": "Share a recipe the user made: publish a frozen copy, choose the name shown, unshare",
  "category": "feature",
  "passes": true,
  "description": "New public collection shared/{id} (shape and limits in the spec) and firestore.rules for it: get by id for anyone, no list, create only signed in as owner within the limits, owner may set removed or delete, nothing else. src/data/sharePublish.js (pure toSharedDoc with the limits, and the Firestore calls). The share sheet's publish step for own items: shows exactly what will be public, the name choice (first name / typed nickname / nothing, default nothing), then 'Create link'. profiles/{uid}.shares tracks links (cap 50 live); an unedited item reuses its link. Profile gains 'Shared links' with Unshare. /r/<id> renders through SharedRecipePage and the preview and card functions read shared/{id}; removed or missing shows 'no longer shared' and generic preview tags. Must ship together with SHARE-7.",
  "acceptance": [
    "Rules tests (emulator): anonymous get by id allowed, list denied; create denied signed out, denied with another uid as owner, denied over each limit; update by a non-owner denied; owner can set removed and delete",
    "toSharedDoc unit tests: trims and caps every field, drops unknown fields, never includes the owner's email or display name unless chosen as 'by'",
    "Nothing is written to shared/ before the 'Create link' tap; the tap is preceded by a view of what will be public (component test)",
    "Unshare makes /r/<id> show 'no longer shared' and the preview function serve generic tags",
    "The 51st live share is refused with a plain sentence; npm run gate green; rules NOT deployed without the owner's go-ahead"
  ]
}
```

```json
{
  "id": "SHARE-7",
  "title": "Report, takedown, docs and the final pass",
  "category": "chore",
  "passes": true,
  "description": "A 'Report' link on pages for user-shared recipes: reason picker and optional note written to shareReports/{auto} (rules: create by anyone within size limits, no read, no update), limited to 3 per browser per day. docs/sharing.md: how links work, what is public, how the owner removes a share in the Firebase console (set removed: true), how to read reports, and the three open decisions with their defaults. CLOSEOUT.md (unreleased entry), README.md (including what is and is not recorded about visitors) and BACKLOG.md updated. Final pass in the browser at 375px: share a built-in recipe; publish, open signed out, save through sign-in, unshare; report. Preview checked with a real preview checker only after deploy; until then say so.",
  "acceptance": [
    "Rules tests: report create allowed within limits, oversize denied, read denied to everyone",
    "The fourth report from one browser in a day is refused with a plain sentence",
    "docs/sharing.md exists and its takedown steps were followed once against the emulator",
    "End to end at 375px as described, with anything not verified (live previews before deploy) named as not verified",
    "CLOSEOUT.md, README.md and BACKLOG.md updated without claiming a deploy that did not happen; npm run gate green"
  ]
}
```

## 2026-11-15 — Flavor profiles that mean something

Spec: `.schermness/spec.md` → "Flavor profiles that mean something". Measured 2026-11-15:
1,526 of 3,432 ingredients carry one identical taste vector and 2,063 one identical aroma
vector, so most charts are drawn from a constant (sour tops 261 of 439 built-in cocktails).
Owner chose: a test set first, tastes rebuilt on the curated labels, a hand-tuned table for
the ingredients that matter, aromas rebuilt on published descriptors, bad charts hidden
meanwhile. Order: FLAVOR-1 and FLAVOR-2 first (no share card is deployed before FLAVOR-2);
then FLAVOR-3, FLAVOR-4, FLAVOR-5 in that order; FLAVOR-6 last.

```json
{
  "id": "FLAVOR-1",
  "title": "Flavor test set and scorer, with today's baseline",
  "category": "tooling",
  "passes": true,
  "description": "data/flavor-truth.json: about 40 well-known cocktails, sauces and dishes that exist in the app's built-in data, each with the tastes a cook would expect (strongest first), tastes that must not lead, and aroma expectations only where uncontroversial. Written by the assistant from common culinary knowledge and marked as such in the file. scripts/measureFlavorProfile.mjs computes each item's chart exactly as the app does (same functions, same data files) and prints per item and overall: top taste is an expected one, top two both expected, a forbidden taste leads, share of ingredients counted; --json for machines. docs/flavor-profile.md records the method, the answer key's authorship and limits, and the baseline numbers for today's charts.",
  "acceptance": [
    "Every item in data/flavor-truth.json resolves to a built-in recipe (the script fails loudly on an unknown one)",
    "The script reads only files in the repo, makes no network call, and exits non-zero on a malformed truth file",
    "The scoring functions are pure and unit-tested with hand-made profiles (all right, top-1 wrong, forbidden leading, nothing counted)",
    "docs/flavor-profile.md states the baseline as printed by the script, including Negroni and Daiquiri by name",
    "npm run gate green"
  ]
}
```

```json
{
  "id": "FLAVOR-2",
  "title": "Never draw a chart from placeholder values",
  "category": "fix",
  "passes": true,
  "description": "Detect the constant vectors by value: a build step (in scripts/buildShareIndex.mjs or a sibling wired into the same prebuild) writes a small JSON listing every exact taste vector and aroma vector shared by more than a threshold number of ingredients in gnn_entropy.json. isPlaceholder(probs) uses it. Ingredients whose values are placeholder count as having no flavor data (they appear under 'Not counted'), separately for the taste half and the aroma half. A chart is drawn only when at least half of the ingredients, and at least two, have real values; otherwise the surface says there is not enough flavor data and draws nothing. Applies to buildFlavorProfile, recipeAxisProfile and recipeAxisProfileWeighted, so the Recipe Notebook, the invent panels, the shared page and both card renderers all follow; share-cards.json is regenerated. Boost / temper suggestions must not rank on placeholder values either.",
  "acceptance": [
    "The generated placeholder list contains the 1,526-ingredient taste vector and the 2,063-ingredient aroma vector, and a test asserts sugar, salt, coffee and lemon are treated as not counted for taste",
    "A recipe made only of placeholder ingredients draws no chart on the Recipe Notebook card, an invent panel and the shared page (component tests)",
    "share-cards.json regenerated; the count of built-in recipes with and without a chart is reported before and after",
    "scripts/measureFlavorProfile.mjs re-run and the numbers added to docs/flavor-profile.md (a forbidden taste leading should drop sharply; counted share will drop too, and that is stated)",
    "npm run gate green; functions tests green"
  ]
}
```

```json
{
  "id": "FLAVOR-3",
  "title": "Tastes from the curated labels, weighted by amount",
  "category": "feature",
  "passes": true,
  "description": "src/data/flavorTaste.js (pure): turns an ingredient's curated taste label from ingredients.json (one to three ordered words) into weights on six taste axes: sweet, sour, bitter, salty, umami, heat. First word 1.0, second 0.6, third 0.35; 'spicy' and 'pungent' both feed heat; 'astringent' counts half toward bitter. tasteProfile(lines, lookup) averages by gram-equivalent amount (reusing amountGrams), with equal weights when no amounts are known, and reports counted and uncounted. The taste labels are shipped to the pages that need them as a small file (not the full ingredients.json) so the shared page stays light. The model's taste values are no longer used for the taste half of any chart. After DATA-5 the curated taste labels use ten words: neutral (no taste of its own: water, starch, vodka) contributes to no taste axis but still counts as an ingredient with data, and rich (fat or creaminess) is a mouthfeel outside the six tastes and contributes to none of them, so for a label such as 'rich sweet' only the sweet counts, at its position's weight; see docs/flavor-profile.md, 'How neutral and rich are treated'. Herbs and warm spices: about 25 of them (parsley, thyme, oregano, basil, cumin, cinnamon, nutmeg, paprika, turmeric and others) carry 'pungent' as a second word meaning aromatic, which would chart as heat. Relabel those through tasteOverrides.json so pungent stays only on ingredients with real bite (garlic, raw onion, mustard, horseradish, ginger, pepper, chilies); each override with a reason.",
  "acceptance": [
    "Unit tests: label parsing for one, two and three words; heat from spicy and from pungent; astringent; amount weighting (2 oz vs a dash); unknown ingredient uncounted",
    "At least 90% of the ingredients in the test set are counted for taste",
    "scripts/measureFlavorProfile.mjs: the top taste is an expected one for at least 70% of items with labels alone (the hand-tuned table in FLAVOR-4 is what takes it to 85%); numbers added to docs/flavor-profile.md",
    "The shared page's extra download for taste data is reported and under 150 KB",
    "npm run gate green"
  ]
}
```

```json
{
  "id": "FLAVOR-4",
  "title": "Hand-tuned strengths and potency for the ingredients that matter most",
  "category": "data",
  "passes": true,
  "description": "src/data/flavorStrengths.js: about 150 one-line entries covering base spirits, liqueurs, amari, vermouths and fortified wines, bitters, citrus and juices, sweeteners and syrups, sodas and mixers, dairy and eggs, sauce bases (stock, tomato, cream, butter, roux), salty and umami seasonings, chilies and hot sauces, and common herbs and spices. Each entry gives 0..3 on sweet, sour, bitter, salty, umami and heat, and a potency: how much a small amount counts (bitters, absinthe, hot sauce, fish sauce high; soda water and ice near zero). A table entry overrides the label-derived weights from FLAVOR-3. Keys go through the same normalisation as the bar and kitchen keys (barKey, kitchenKey) so 'campari', 'angostura bitters' and 'sweet vermouth' hit. Written by the assistant from common bartending and cooking knowledge and marked as such; the file header says how to correct a line.",
  "acceptance": [
    "Every base spirit and every bottle in the app's bar list (GENERIC_BOTTLE_KEYS and the codex's 40 most used ingredients) has an entry; a test lists any that are missing",
    "Unit tests: an entry overrides the label; potency makes two dashes of bitters register against 2 oz of spirit; soda water does not dilute the chart to nothing",
    "Negroni charts bitter and sweet ahead of sour; Daiquiri sour and sweet; Old Fashioned sweet and bitter (asserted in a test using the real recipes)",
    "scripts/measureFlavorProfile.mjs: top taste expected for at least 85% of items and no forbidden taste leading; numbers added to docs/flavor-profile.md",
    "npm run gate green"
  ]
}
```

```json
{
  "id": "FLAVOR-5",
  "title": "Aromas from published descriptors instead of the model",
  "category": "feature",
  "passes": true,
  "description": "Confirm what gnn_compounds.json holds (how many ingredients, how many descriptor tags, the shape) and write that into docs/flavor-profile.md. A reviewed map from descriptor tags to the six aroma axes (fruity, floral, green, woody, spicy, fatty) in src/data/aromaDescriptorMap.js; tags with no home are listed and dropped. A build step writes a small per-ingredient aroma file (six numbers each, normalised) so pages do not load the full compound file. aromaProfile(lines, lookup) mirrors tasteProfile (amount weighting, counted and uncounted). Ingredients with no descriptors are not counted for aroma. The model's odor values are no longer used for any chart.",
  "acceptance": [
    "The tag map is one reviewable table; a test fails if a tag present in the data is neither mapped nor on the explicit dropped list",
    "The number of ingredients with an aroma profile, and the share of test-set ingredients counted for aroma, are reported",
    "Spot checks asserted in tests with real data: mint leads green, vanilla woody or sweet-associated axis as mapped, lemon fruity, butter fatty, black pepper spicy; any that the data does not support is reported, not forced",
    "The generated aroma file is under 300 KB and is the only aroma data the shared page loads",
    "npm run gate green"
  ]
}
```

```json
{
  "id": "FLAVOR-6",
  "title": "One profile everywhere, honest wording, final measurement",
  "category": "chore",
  "passes": true,
  "description": "A single profile function (tastes from FLAVOR-3 and FLAVOR-4, aromas from FLAVOR-5, the draw rule from FLAVOR-2) behind every chart: Recipe Notebook Flavor Profiles (overview bar chart, per-axis pages, boost / temper ranking via rankByAxisImpact), the three invent panels (InventFlavorProfile), the shared recipe page, and the share cards in the browser and on the server through the share index. The chart axes become the six tastes plus the six aromas; any axis list, colour or label that assumed five tastes is updated. Copy says the chart is built from taste labels and published aroma notes for each ingredient, weighted by amount, and is a guide rather than a taste test. Remove code paths that read the model's per-ingredient values for charts once nothing uses them (the radar views in the parked Network tab may keep them). .claude/.chemdataset-status.md gains a dated note pointing at docs/flavor-profile.md. Final scorer run recorded; three share cards re-rendered and looked at.",
  "acceptance": [
    "grep shows no chart surface reading gnnProbs for a recipe profile; the parked Network views are named if they still do",
    "Recipe Notebook, an invent panel, the shared page and a server card show the same leading tastes for the same recipe (test with Negroni and Beef Bolognese)",
    "Boost and temper suggestions still work and no longer rank on placeholder values (tests)",
    "docs/flavor-profile.md has baseline, after FLAVOR-2, after FLAVOR-3, after FLAVOR-4 and final numbers from the same test set, with what is still wrong listed by item",
    "Set SHARE_CHARTS_ENABLED to true in src/data/shareTargets.js once the rebuilt charts pass the measure; run node scripts/buildShareIndex.mjs and commit the regenerated share-cards.json and cardLayout.generated.ts; update the SHARE-8 note in docs/sharing.md",
    "375px browser check of the Recipe Notebook card, an invent panel and the shared page; share-cards.json regenerated; npm run gate and functions tests green; nothing deployed without the owner's go-ahead"
  ]
}
```

## 2026-11-15 — Data cleanup: ingredients, categories, taste labels, cocktail and sauce groupings

Spec: `.schermness/spec.md` → "Data cleanup". From a read-only critique on 2026-11-15: at
least 151 duplicate ingredients under another spelling, non-food entries, inconsistent
categories, starches and fats labelled sweet, 59 cream and egg cocktails filed under sours
and highballs, a third of sauces in a catch-all. Fixes go in a curation layer the app
applies on load, mirrored into the pipeline's inputs; no generated file is edited by hand
and no model is retrained (Decision 2, defined in the spec; the owner may override). Order:
DATA-1 (audit), DATA-2 (the layer), then DATA-3, DATA-4, DATA-5; DATA-6 and DATA-7 are
independent of those; DATA-8 last. DATA-5 must land before FLAVOR-3.

```json
{
  "id": "DATA-1",
  "title": "Repeatable data audit with today's baseline",
  "category": "tooling",
  "passes": true,
  "description": "scripts/auditData.mjs reads only repo files and reports: duplicate ingredient candidates (misspelt singulars such as 'tomatoe', plurals, leading preparation words such as 'freshly', 'lean', 'boneless', 'cooked', 'instant'), non-food and fragment candidates, branded and packaged candidates, category inconsistencies by rule (cheese, juice, flour, wine, beer, the 'umami' category), taste-label oddities by category (starch, plain fat, water, neutral spirits), cocktail checks (cream or egg drinks per family, citrus in the stirred families, lines without amounts, duplicate names, unnamed sub-groups, a short list of classics that must exist), the share of sauces under 'Independent', dish-type singletons and the two dish-type vocabularies. Writes docs/data-quality.md (method, limits, baseline numbers) and candidate lists as review files under data/review/. Changes no data.",
  "acceptance": [
    "The script makes no network call, edits no data file, and exits non-zero only on a missing input",
    "Its rules are pure functions with unit tests (each rule: a hit, a near miss that must not hit, e.g. 'olive' is not a bad singular and 'fresh mozzarella' is not a duplicate of 'mozzarella' unless listed)",
    "docs/data-quality.md states each baseline number as printed and says the lists are candidates for review, not verdicts",
    "The candidate lists are written in a form DATA-3..7 can paste from (one line per item with the rule that flagged it)",
    "npm run gate green"
  ]
}
```

```json
{
  "id": "DATA-2",
  "title": "The curation layer: aliases, hidden, packaged, category and taste overrides applied on load",
  "category": "feature",
  "passes": true,
  "description": "src/data/curation/ with empty-but-valid tables (aliases.json, hidden.json, packaged.json, categoryOverrides.json, tasteOverrides.json; each entry one line with a reason) and a pure applyCuration(ingredients, pairings, tables): aliases merge an entry into its canonical one (pairings combined, the stronger score kept, counts summed, self-pairs dropped), hidden entries removed with their pairings, packaged entries flagged, overrides applied. Wired where useProData builds the graph and into every build script that reads ingredients (share index, placeholder list). resolveIngredient(name) goes through the alias table and is used by the typed-ingredient matchers, barKey, kitchenKey and the model vocabulary lookups, so an old or variant name still lands on the canonical entry. A saved recipe that names a merged or hidden ingredient still opens and shows its original text. Seed the tables with ten obvious entries to prove the path end to end.",
  "acceptance": [
    "applyCuration unit tests: alias merge with pairing combination, hidden removal, packaged flag, overrides, an alias chain, an alias to a missing canonical (reported, not crashed), idempotence",
    "With the ten seed entries, the merged names no longer appear as separate nodes anywhere in the app and their pairings appear on the canonical entry (component or integration test)",
    "A test fails if any module reads ingredients.json or builds the graph without going through the curated loader",
    "A saved item naming a merged ingredient opens and displays; the set-completion and quantity models still receive names from their own vocabulary (tests)",
    "Load time of the main dataset is measured before and after and the difference reported; npm run gate green"
  ]
}
```

```json
{
  "id": "DATA-3",
  "title": "Ingredient merges, removals and packaged flags",
  "category": "data",
  "passes": true,
  "description": "Fill aliases.json, hidden.json and packaged.json from DATA-1's review lists after reading every line: duplicates (at least the 151 found on 2026-11-15) merged into their canonical entry; non-food and fragments hidden; branded and packaged products flagged (Decision 3: kept and searchable, never suggested). Where a 'duplicate' is a real distinction a cook would care about (new potato vs potato, extra-virgin olive oil vs olive oil, cherry tomato vs tomato), it is NOT merged and the reason is recorded in a keep list so the audit stops flagging it. Suggestions, stand-ins, checklist picks and the bar and kitchen typeaheads exclude packaged and hidden entries.",
  "acceptance": [
    "Every alias, hidden and packaged line carries a reason; the keep list exists and is honoured by the audit",
    "The audit re-run reports zero unreviewed duplicate, non-food and fragment candidates",
    "No packaged or hidden entry appears in suggestions, stand-ins or checklist picks in any of the three invent panels or the Recipe Notebook (tests over the real data)",
    "Counts before and after (ingredients visible, pairings) are added to docs/data-quality.md",
    "npm run gate green"
  ]
}
```

```json
{
  "id": "DATA-4",
  "title": "One consistent category scheme",
  "category": "data",
  "passes": true,
  "description": "Write the category scheme down in docs/data-quality.md (each category with a one-line definition and three examples), then apply it through categoryOverrides.json: all cheeses under dairy; all juices under a new 'juice' category; all flours under grain; still, sparkling, fortified and cooking wines under a new 'wine' category; beer and cider under 'beer'; the 'umami' category renamed 'savory seasoning'; vermouths and aromatised wines decided once and stated. Before changing anything, list every place in the code that reads a category name (inventSauce.js slot rules, dishSkeletons.js, recipeRoles, recipeMains.js, myBar.js isBooze and family rules, suggestion filters, colour and legend maps, tests) and update them in the same change so no slot or filter silently empties.",
  "acceptance": [
    "The list of category readers is in the report, and each was either updated or shown not to be affected",
    "The audit's category rules report zero inconsistencies (cheese, juice, flour, wine, beer)",
    "For each invent panel, every checklist part and slot shortlist still returns candidates for the same test recipes as before (a before/after test over real data), and My bar still recognises every bottle it recognised before",
    "No category named 'umami' remains; colours and legends cover the new categories",
    "npm run gate green"
  ]
}
```

```json
{
  "id": "DATA-5",
  "title": "Taste labels: add neutral and rich, fix starches, fats and spirits",
  "category": "data",
  "passes": true,
  "description": "The taste vocabulary gains 'neutral' and 'rich'. tasteOverrides.json corrects: starches and plain grains (flour, rice, bread, pasta, cornstarch, oats, tortilla) to neutral; plain fats and oils to rich (butter 'rich sweet' at most); water, ice and soda water to neutral; vodka neutral; other spirits, wines and beers reviewed one by one; egg, cream and cheeses reviewed; the audit's other oddities resolved or kept with a reason. Add the missing bar entries (rye whiskey, cola, common bitters and mixers) as curated additions with category and taste. Everything that reads the taste field (node colours, taste compatibility, filters, legends) handles the two new words. Must land before FLAVOR-3, which then treats neutral as contributing to no taste axis and rich as a mouthfeel note outside the six tastes.",
  "acceptance": [
    "No starch, plain fat, water or soda is labelled sweet (audit rule reports zero); each override carries a reason",
    "Every reader of the taste field handles 'neutral' and 'rich' (tests; no undefined colour or missing legend entry)",
    "The added bar entries resolve through barKey and appear in the My bar typeahead",
    "The spec section 'Flavor profiles that mean something' and FLAVOR-3's task text are updated to say how neutral and rich are treated",
    "npm run gate green"
  ]
}
```

```json
{
  "id": "DATA-6",
  "title": "Cocktails: a family for flips and cream drinks, misfiled drinks, names, duplicates, missing classics",
  "category": "data",
  "passes": true,
  "description": "Per Decision 4 (the owner may override before this starts): add a seventh family, 'Flips & Cream Drinks', with a root drink and a one-line blurb, and move the cream and egg drinks into it after reading each one (about 59 candidates). Move the clear mistakes (Mojito, Bramble) and review the drinks with citrus in 'Boozy Sippers' and 'Aromatic Stirred'. Name the 15 sub-groups. Remove the two duplicates. Add Espresso Martini, Long Island Iced Tea and Sex on the Beach with published specs. Add amounts where a standard published spec exists (IBA for the official ones); otherwise leave the existing '~ suggested' amounts. All of it in the codex's source and proDataset/scripts/11-parse-cocktail-codex.js, regenerating cocktail_codex_v2.json; the generated file is not edited by hand. Update everything that assumes six: the family list and order, the Invent style picker, blurbs and checklist skeleton for the new family, the parked 3D layout, share slugs (existing links must keep working), tests and copy that says 'six'.",
  "acceptance": [
    "Regenerating the codex from source reproduces the committed file exactly",
    "The audit reports no cream or egg drink outside the new family except those on a stated keep list, no duplicate names, no unnamed sub-group, and the three classics present",
    "Every /r/cocktail/<slug> link that worked before still works (test over the previous slug list)",
    "Invent a cocktail offers the new style with a checklist that makes sense for it (cream or egg, sweetener, spirit) and recommends it for a cream drink",
    "The count of drinks without amounts before and after is reported; no amount is invented",
    "npm run gate green; functions tests green; share index regenerated"
  ]
}
```

```json
{
  "id": "DATA-7",
  "title": "Sauces: split the catch-all; one dish-type vocabulary",
  "category": "data",
  "passes": true,
  "description": "Review the 27 sauces under mother sauce 'Independent' and regroup them into named groups wherever at least three share one (candidates: vinaigrettes, cold emulsions, herb sauces, fermented and chili condiments, dairy sauces); the rest stay 'Independent'. Update the Sauce Lab's family list, colours, Invent a sauce techniques where a new group maps to one, and the share index. Separately, define one dish-type list used by both the Cookbook (dishTypeOf, 22 types today, six with one dish) and Invent a recipe (dishSkeletons.js, 8 types): every Cookbook dish maps to a type that Invent also knows, or to an explicit 'other' with a reason.",
  "acceptance": [
    "'Independent' holds fewer than 12 sauces and each new group has at least three; every sauce still has exactly one group",
    "Sauce Lab list, filters and share links still work for every sauce (tests)",
    "One exported dish-type list; a test fails if the Cookbook and Invent a recipe disagree on it; no type has a single dish unless listed with a reason",
    "dishTypeForIngredients and the Cookbook filters give the same type for the same dish",
    "npm run gate green"
  ]
}
```

```json
{
  "id": "DATA-8",
  "title": "Mirror into the pipeline inputs; final audit and docs",
  "category": "chore",
  "passes": true,
  "description": "Write the curation tables into the pipeline's inputs so a future rebuild agrees: aliases into proDataset/data/synonyms.json (without disturbing its 525 existing entries), hidden entries into a stop list the parse and blend steps honour, category and taste rules into the tables 05-blend.js reads. A test fails when the app's tables and the pipeline inputs drift. Do NOT re-run the full pipeline. Re-run the audit and record before and after in docs/data-quality.md; regenerate share-index.json and share-cards.json; update README.md and CLOSEOUT.md (unreleased entry) with the new counts (ingredients, pairings, cocktail families) wherever the old ones are quoted, and BACKLOG.md with what was deliberately left (the full rebuild, low-count ingredients).",
  "acceptance": [
    "The drift test exists and passes; the pipeline scripts still parse (node --check) and their unit tests, if any, pass",
    "docs/data-quality.md has before and after for every audit number, and lists what is still open by item",
    "Every count quoted in README.md, CLOSEOUT.md and .claude/CLAUDE.md matches the data as loaded through the curation layer, or is marked as the raw count",
    "Nothing deployed without the owner's go-ahead; npm run gate and functions tests green"
  ]
}
```

## 2026-11-15 — Usage data: learn how people use the app

Spec: `.schermness/spec.md` → "Usage data". Owner chose Google Analytics through Firebase.
Owner also approved (2026-11-15, "Yes, add both"): USAGE-3 (counts from account records) and
USAGE-4 (a feedback button). Consent default: ask everyone once, nothing sent until yes
(defined in the spec). Owner step first: turn on Google Analytics for the project in the
Firebase console. Order: USAGE-1, then USAGE-2; USAGE-3 and USAGE-4 are independent.

```json
{
  "id": "USAGE-1",
  "title": "Consent banner, privacy page and analytics wiring (nothing sent before a yes)",
  "category": "feature",
  "passes": true,
  "description": "src/data/usage.js: consent state (unset, yes, no) kept on the device; track(name, params) is a no-op unless consent is yes; Firebase Analytics is imported lazily only after a yes and only when isSupported(); failures are swallowed. A one-time banner with Yes and No in the chalk language, not blocking the page, 44px targets; the choice can be changed in Profile. A plain /privacy page (routed like the shared recipe page, no account needed) listing what is collected, by whom (Google), the typed text that is sent (search terms that found nothing, unrecognised ingredient names), and how to turn it off; linked from the banner, the Labs menu and the shared recipe page. No user id, email or display name is ever set on analytics. The measurement id comes from the Firebase config; without one, everything stays a no-op. README's statement that the app records nothing is rewritten to match.",
  "acceptance": [
    "With consent unset or no: no analytics module is loaded and no request goes to Google (test with a spy on the dynamic import; browser network check)",
    "With consent yes: the module loads once and track() forwards name and params; turning it off in Profile stops further calls",
    "track() never throws, with analytics blocked, unsupported or missing a measurement id",
    "/privacy renders signed out without loading the main dataset; the banner appears once and is absent after either answer",
    "375px check; npm run gate green; nothing deployed without the owner's go-ahead"
  ]
}
```

```json
{
  "id": "USAGE-2",
  "title": "The events: labs, invent, sharing, searches that find nothing, photo scan, sign-in",
  "category": "feature",
  "passes": true,
  "description": "docs/usage-data.md holds the one table of events (name, when it fires, fields) and src/data/usageEvents.js the matching helpers, so nothing calls track() with a free-form name. Events: lab_opened (lab); invent_started (lab), invent_style_chosen, invent_named, invent_saved; share_sheet_opened (kind, built-in or own), share_link_created, shared_page_opened (kind, built-in or own), shared_saved, shared_signup; search_no_result (lab, term trimmed to 60 characters, lowercased); ingredient_unrecognised (lab, text trimmed to 60); scan_started, scan_succeeded (count), scan_kept (count); signin_started (provider), signin_completed. Never sent: recipe contents, the name a user gave their own recipe, nicknames, anything from a shared recipe a user wrote.",
  "acceptance": [
    "A test fails if track() is called anywhere outside usageEvents.js, and if an event in the code is missing from docs/usage-data.md or the reverse",
    "Each event fires once at the stated moment (component tests with a test double), including search_no_result only after the query settles, not per keystroke",
    "A test asserts no event carries a user-written recipe name, nickname or uid",
    "The privacy page's list matches docs/usage-data.md (test)",
    "npm run gate green; live arrival in Google's debug view is named as NOT verified until after deploy"
  ]
}
```

```json
{
  "id": "USAGE-3",
  "title": "Totals from account records, printed by a script the owner runs",
  "category": "tooling",
  "passes": true,
  "description": "scripts/accountStats.mjs, run by the owner with their own Google login (application default credentials), reads the profiles, shared and shareReports collections with firebase-admin and prints totals only: accounts, accounts with at least one saved item, saved cocktails, sauces and recipes, items saved from a shared link, live and removed shared links, reports waiting. It prints no recipe content, names, emails or ids, and writes nothing. docs/usage-data.md says how to run it. The counting functions are pure and tested on made-up records.",
  "acceptance": [
    "The counting functions are pure and unit-tested; the script has a --dry-run that uses a fixture and no network",
    "The script only reads; a test asserts no write or delete call exists in it",
    "Its output contains numbers and labels only (test on a fixture containing names and emails)",
    "It was NOT run against production by the builder; the docs say the owner runs it",
    "npm run gate green"
  ]
}
```

```json
{
  "id": "USAGE-4",
  "title": "A feedback button",
  "category": "feature",
  "passes": true,
  "description": "'Send feedback' in the Labs menu and on the shared recipe page: a short note (500 characters) and an optional 'what were you trying to do' (200), written to feedback/{auto} as { note, goal, lab, at } with no identity. Rules: create by anyone within the limits, no read, update or delete; the owner reads it in the Firebase console (docs/usage-data.md says where). Three per browser per day as a courtesy limit.",
  "acceptance": [
    "Rules tests on the emulator: create allowed within limits, oversize and extra keys denied, read denied to everyone",
    "The fourth message in a day from one browser is refused with a plain sentence; a failed send keeps the text",
    "No uid, email or name is written (test)",
    "375px check; npm run gate green; rules not deployed without the owner's go-ahead"
  ]
}
```

```json
{
  "id": "SHARE-8",
  "title": "Hide flavor charts on shared pages and share cards until the charts are rebuilt",
  "category": "fix",
  "passes": true,
  "description": "Owner, 2026-11-15: 'Deploy, charts hidden'. After FLAVOR-2, 186 of 599 built-in recipes still draw a chart and on the test set most of those lead with a wrong taste. One exported switch SHARE_CHARTS_ENABLED = false (beside SHARE_OWN_ENABLED) turns the flavor chart off on every PUBLIC share surface: the shared recipe page (no chart section and no 'not enough data' line), the browser share cards (single and set of three; card 1 of the set shows name and details without the chart), the server cards (share-cards.json regenerated with no bars), and the bars stored when a user publishes their own recipe (bars: []). Charts inside the app (Recipe Notebook, invent panels) are unchanged. FLAVOR-6 turns the switch back on.",
  "acceptance": [
    "With the switch off: no chart and no flavor-data line on /r/ pages for a built-in and a user copy (component tests); browser and server cards carry no chart (tests); a newly published share stores bars: []",
    "With the switch on (test override) everything behaves as before this task",
    "share-cards.json regenerated and the generated-files sync tests pass; card layouts still fill sensibly without the chart (look at one preview card and say what it looks like)",
    "docs/sharing.md and docs/flavor-profile.md say charts are hidden on shared pages and cards and why; FLAVOR-6's task text names turning the switch back on",
    "functions tests, npm run test:rules and npm run gate green; nothing deployed by the builder"
  ]
}
```

## 2026-11-16 — A picture for a recipe: chalk drawing from a photo, or a chalk icon

Spec: `.schermness/spec.md` → "A picture for a recipe". Owner's decisions after trying a
prototype: coloured chalk, made by a free filter in the browser, defaults line weight 5, fine
detail 13, shading 110, colour 200, grain 5, with an "Adjust" button revealing the five
sliders; only the chalk version is ever published or stored; pictures live in the database
(under 150 KB each); cocktails and sauces get a small set of new drawings to pick from.
Prototype source: `docs/prototypes/chalk-filter-bench.html` (untracked until PICTURE-1 commits it). Order: PICTURE-1 (filter) and
PICTURE-2 (drawings and the chooser) first; PICTURE-3 (storage and rules); PICTURE-4 (where
it shows); PICTURE-5 last.

```json
{
  "id": "PICTURE-1",
  "title": "The chalk filter as a tested module",
  "category": "feature",
  "passes": true,
  "description": "Port the prototype's filter into src/data/chalkFilter.js as pure functions over pixel arrays: chalkify({ data, width, height }, settings) returning the same shape, CHALK_DEFAULTS (weight 5, detail 13, shading 110, colour 200, grain 5), CHALK_RANGES (weight 0.6-10, detail 0-16, shading 0-200, colour 0-300, grain 0-100), and prepare(image) that scales to 1080 px on the long side and stretches contrast. Fixed-seed noise so the same photo and settings always give the same picture. A runner that keeps the page responsive (a Web Worker, or sliced work with yields) and reports progress. encodeChalk(canvas) produces WebP (JPEG fallback) at 600 px on the long side, stepping quality down until under 150 KB, and returns { blob, mime, w, h, bytes }. Copy the prototype page into docs/prototypes/chalk-filter-bench.html for reference.",
  "acceptance": [
    "chalkify is deterministic and pure: unit tests on small synthetic images (a white square on black gives bright outlines on slate; a flat image gives no lines; colour 0 gives cream chalk only; grain 0 leaves strokes untouched; each setting clamps to its range)",
    "The output at the defaults matches the prototype's for the same input within a small tolerance (a fixture image and a stored checksum or per-pixel tolerance test)",
    "encodeChalk returns under 150 KB for three varied sample images and reports the measured sizes; the encoded picture carries no EXIF (test by inspecting the bytes)",
    "Converting a 12-megapixel photo does not block input for more than 100 ms at a time (measured in a browser and reported), and shows progress",
    "npm run gate green"
  ]
}
```

```json
{
  "id": "PICTURE-2",
  "title": "New glass and sauce drawings, and the picture chooser",
  "category": "ui",
  "passes": true,
  "description": "Add chalk drawings in the style of chalkArt.jsx: six glasses (coupe, rocks, highball, flute, martini, mug) that take the drink colour as ChalkGlass does, and four for sauces (pan, jar, bowl, bottle). One registry of pickable drawings by kind (dish: the 23 existing DISH_ART_KINDS; cocktail: the glasses; sauce: the four) with stable ids such as 'dish:pasta' and 'glass:coupe'. RecipePicture.jsx: three choices (a drawing, a photo turned into chalk, no picture). The photo path takes a picture from the camera or library, shows the chalk result at the defaults with a 'drawing…' state, an 'Adjust' button that reveals the five sliders with live preview and Reset, and 'Use this picture'. Landscape or square crop choice only. No storage yet: the component returns { kind: 'icon', icon } or { kind: 'chalk', blob, mime, w, h } to its parent.",
  "acceptance": [
    "The ten new drawings render at 24, 64 and 120 px without clipping and match the stroke weight and palette of the existing ones (looked at in a browser and described honestly)",
    "The drawing grid shows the right set per kind and returns a stable id; unknown ids render a fallback, not a crash",
    "The photo path: choosing a picture shows the chalk result at the defaults; Adjust reveals five labelled sliders; Reset restores the defaults; Use this picture returns the encoded result (component tests with a stubbed filter)",
    "A file that cannot be opened (for example HEIC outside Safari) gives a plain sentence and leaves the chooser usable",
    "375px, 44px targets, no horizontal overflow; npm run gate green"
  ]
}
```

```json
{
  "id": "PICTURE-3",
  "title": "Storing pictures: with a saved item and with a shared copy",
  "category": "feature",
  "passes": true,
  "description": "Saved items gain picture: { kind: 'icon'|'chalk', icon?, v }. A chalk picture is stored as its own document profiles/{uid}/pictures/{itemId} ({ data (base64), mime, w, h, updatedAt }), never inside the profile document; deleting the item deletes its picture. A shared copy stores sharedPictures/{shareId} ({ data, mime, w, h, owner, createdAt }) written with the share, and shared/{id} carries picture: { kind, icon? } only. firestore.rules: profiles/{uid}/pictures/{id} readable and writable by that user only, size-capped (data string length under 210,000); sharedPictures/{id} get by anyone, list by nobody, create by the signed-in owner within the cap and only alongside their own share id, delete by the owner, and unreadable to others once shared/{id}.removed is true. Offline or failed picture writes never block saving the item or creating the link; the item is saved without the picture and the user is told in one line. The original photo is never sent anywhere.",
  "acceptance": [
    "Rules tests on the emulator: own picture read and write allowed, another user's denied; oversize denied; sharedPictures get allowed, list denied, create denied signed out or with another owner or oversize, readable only by the owner after the share is removed",
    "Saving an item with a chalk picture writes two documents and the profile document's size does not grow by the picture (test)",
    "Deleting an item deletes its picture; unsharing makes the shared picture unreadable to others (tests)",
    "A test asserts that no network call in the save or share path carries the original file (only the encoded chalk data)",
    "A failed picture write still saves the item and shows one plain line",
    "npm run test:rules, functions tests and npm run gate green; rules NOT deployed without the owner's go-ahead"
  ]
}
```

```json
{
  "id": "PICTURE-4",
  "title": "Showing the picture: saved items, the shared page, the share cards",
  "category": "feature",
  "passes": true,
  "description": "Wire RecipePicture into: the name-and-save step of the three invent panels, Edit on a saved item, and the share sheet's publish step (the preview of what becomes public shows the picture). Show the picture on 'Yours' cards in the Cocktail Lab and Sauce Lab and on user recipes in the Cookbook, on the shared recipe page for user copies, and on the share cards: browser cards (single and set of three) and the server card, which reads sharedPictures/{id} and embeds it (and draws the chosen icon for icon pictures). A recipe with a picture uses the space that short recipes leave empty on the card. The Report sheet gains the reason 'The picture'. Removing or unsharing a recipe stops its picture being served within the existing cache window.",
  "acceptance": [
    "A saved item with an icon and one with a chalk picture each show it on their lab card, their shared page and their browser and server cards (component, layout and functions tests)",
    "The server card renders a real PNG of 1200x630 containing the picture for a user share with a chalk picture and with an icon (functions tests); hostile or oversized picture data is refused and the card still renders",
    "Card layouts with a picture were looked at as images (one cocktail, one dish) and described honestly",
    "A recipe without a picture looks exactly as before (snapshot or layout test)",
    "npm run gate, functions and rules tests green; nothing deployed without the owner's go-ahead"
  ]
}
```

```json
{
  "id": "PICTURE-5",
  "title": "Pictures: docs and the final pass",
  "category": "chore",
  "passes": true,
  "description": "docs/sharing.md gains a section on pictures: what is stored and where, that the original photo never leaves the device, the size cap, that a report can be about the picture, and that removing a share removes its picture. CLOSEOUT.md (unreleased entry), README.md and BACKLOG.md updated (left out on purpose: original photos, an AI image model, cropping tools, more than one picture). Final pass at 375px: invent a drink, add a chalk picture from a photo, adjust it, save; pick a drawing for a sauce; share one and open the link signed out. Anything not exercised for real (a phone camera, real Firestore writes, live previews) is named as not verified.",
  "acceptance": [
    "docs/sharing.md describes exactly what the code stores and sends",
    "End to end at 375px as described, with what was and was not exercised stated",
    "CLOSEOUT.md, README.md and BACKLOG.md updated without claiming a deploy that did not happen",
    "npm run gate, functions and rules tests green"
  ]
}
```

## 2026-11-16 — More reliable aromas: a second opinion, wider axes, a stronger test

Spec: `.schermness/spec.md` → "More reliable aromas". Measured 2026-11-16: the app already
holds a second set of aroma labels for 3,927 ingredients (`flavor_profiles_distilled.json`);
FLAVOR-5's aroma table agrees with it on the strongest aroma for 221 of 261 shared
ingredients (85%); eight of that source's 17 aroma words (fermented, earthy, caramel, nutty,
roasted, smoky, meaty, marine) have no place on the six aroma axes. Owner chose: a stronger
test, a second-opinion check with every disagreement reviewed, and wider axes. Order:
AROMA-1, AROMA-2, AROMA-3, AROMA-4. Taste numbers must not move.

```json
{
  "id": "AROMA-1",
  "title": "A blind aroma answer key and an outside key",
  "category": "tooling",
  "passes": false,
  "description": "data/aroma-truth-blind.json: about 100 items (60 single ingredients across spirits, liqueurs, herbs, spices, fruit, vegetables, dairy, nuts, meats and seafood, coffee, chocolate, smoked and fermented things; 40 built-in recipes across the three kinds), each with the aromas a cook would expect among the strongest two or three, using the eleven-aroma vocabulary (fruity, floral, green, woody, spice, fatty, toasty, nutty, earthy, smoky, savory), and aromas that must not lead. It is written WITHOUT opening src/data/flavorAromas.js or data/aroma-truth.json (the builder writes and commits the key before reading either, and says so); a third of it is marked held back. An outside key: the chef-sourced entries of public/proDataset/flavor_profiles_distilled.json mapped to the eleven aromas by a stated table. The scorer gains --aroma-blind and --aroma-chef modes reporting, on the six axes that exist today (new-axis expectations counted as not expressible, shown separately) and ready for eleven: strongest aroma expected, forbidden aroma leading, no aroma data. docs/flavor-profile.md records the method and today's scores.",
  "acceptance": [
    "The key file's first commit predates any read of the aroma table in this task (the builder states the order of work; the key has its own commit)",
    "Every recipe item resolves to a built-in recipe and every ingredient item to a curated ingredient; the script fails loudly otherwise",
    "The mapping from the second source's 17 words to the eleven aromas is one reviewable table with a test",
    "Scores on the blind key (all, and held-back third) and on the chef key are reported as printed, including how many expectations today's six axes cannot express",
    "The existing measures are unchanged (taste 36/41 and 19/20; aroma 30/30 and 8/10 or whatever FLAVOR-6 left, stated); npm run gate green"
  ]
}
```

```json
{
  "id": "AROMA-2",
  "title": "Second-opinion check: every disagreement with the distilled profiles reviewed",
  "category": "data",
  "passes": true,
  "description": "scripts/checkAromaAgreement.mjs compares each line of the aroma table with the second source (flavor_profiles_distilled.json, through the curation layer's name resolution) and prints: agreement on the strongest aroma, top-two overlap, table lines with no counterpart, and every disagreement with both sides shown and whether the second source's entry is chef-sourced. Read every disagreement (40 at the time of the spec). For each: correct the table line with a reason when the second source is right (likely: chilies, gin, vermouths), or record it in data/review/aroma-accepted.json with a reason when the table is right or the difference is only the missing axes (those are re-checked in AROMA-3). The check becomes part of npm run audit:data: a table edit that creates a new unreviewed disagreement fails --check. Do not tune against the held-back third of the blind key.",
  "acceptance": [
    "Every disagreement is either fixed or accepted with a specific reason; the script reports zero unreviewed",
    "Agreement before and after is reported as printed, overall and for chef-sourced entries",
    "Blind-key and chef-key scores from AROMA-1 re-run and reported; taste measures unchanged",
    "An 'owner may disagree' table lists the judgement calls",
    "npm run audit:data -- --check passes; npm run gate green"
  ]
}
```

```json
{
  "id": "AROMA-3",
  "title": "Eleven aroma axes: toasty, nutty, earthy, smoky and savory join the six",
  "category": "feature",
  "passes": true,
  "description": "The aroma axes become fruity, floral, green, woody, spice, fatty, toasty (roasted, caramel), nutty, earthy, smoky, savory (meaty, marine, fermented). Every line of src/data/flavorAromas.js is re-read and given values on the new axes where they apply; ingredients that had no aroma because their aromas had no home get real lines (fish sauce, anchovy, soy sauce, miso, parmesan and aged cheeses, coffee and coffee liqueur, cocoa and chocolate, nuts and nut milks, mushrooms, beets, root vegetables, smoked paprika, bacon, mezcal and peated whisky, caramel and brown sugar, toasted sesame, stocks and seared-meat bases). Values that were standing in for a missing axis are moved (coffee liqueur from woody to toasty, almond milk from woody to nutty). flavorAroma.js, the shared profile helpers, axis labels, colours (eleven distinct, readable on slate, not colliding with the six taste colours), balancing pairs, per-axis pages and boost / temper all cover eleven. The second-opinion check is re-run with the full 17-word mapping; accepted disagreements that were only 'missing axis' must now agree or be re-decided.",
  "acceptance": [
    "Every table line was re-read; the count of lines changed and of ingredients newly given an aroma is reported; a test fails if an axis name outside the eleven appears",
    "Named checks on real data as tests: fish sauce and anchovy savory; coffee toasty; almond nutty; mushroom earthy; smoked paprika and mezcal smoky; brown butter or caramel toasty; an Espresso-style or coffee drink shows toasty; a miso or soy dish shows savory",
    "Blind key: score on all items and on the held-back third, before and after, now on eleven axes; chef key likewise; second-opinion agreement before and after. All as printed, with the held-back third not tuned against",
    "Taste measures unchanged (36/41 and 19/20)",
    "Functions tests green; npm run audit:data -- --check passes; npm run gate green"
  ]
}
```

```json
{
  "id": "AROMA-4",
  "title": "Charts kept readable with eleven aromas (interim rule; the redesign is CHART-1); docs; final measurement",
  "category": "chore",
  "passes": true,
  "description": "With six tastes and eleven aromas a full chart has seventeen bars. One rule, the same on every surface (Recipe Notebook overview and flavor map, invent panels, Cookbook radar, shared page, browser and server share cards): show the strongest bars above a stated floor, tastes and aromas in their own groups, with a stated maximum per group (for example four and four on a card, more on the full Recipe Notebook page), and 'show all' where there is room. Per-axis pages and boost / temper work for every axis. Server and browser cards re-rendered and looked at for a drink, a sauce and a dish. docs/flavor-profile.md gains 'Aromas, second pass' with all scores stage by stage, what the second source is and is not (mostly AI-written; a second opinion, not ground truth), and what is still wrong by item. BACKLOG.md records the two deferred pieces with enough detail to pick up: using the second source for ingredients outside the table, and aromas created by cooking method. CLOSEOUT.md unreleased entry and README updated. share-cards.json regenerated.",
  "acceptance": [
    "The bar rule is written once in code and in docs/flavor-profile.md, and a test asserts each surface uses it",
    "Three cards (a drink, a sauce, a dish) were rendered and looked at; each is described honestly, including whether the chart is readable",
    "Recipe Notebook, an invent panel, the shared page and a server card lead with the same tastes and aromas for two named recipes (test)",
    "All measures re-run and recorded: taste main and hold-out unchanged; aroma original, blind (all and held-back), chef key, second-opinion agreement",
    "375px DOM check of the Recipe Notebook card and an invent panel; npm run gate, functions and rules tests green; nothing deployed without the owner's go-ahead"
  ]
}
```

```json
{
  "id": "CHART-1",
  "title": "Explore, with the owner, how the flavor graphs should change for six tastes and eleven aromas",
  "category": "design",
  "passes": true,
  "description": "Owner, 2026-11-16: 'explore and brainstorm how we should change the graphs for the widening number of aromas. You can wait to do this once we have the data right.' Starts only after AROMA-3 (eleven aroma axes with real values). An exploration, not a build: survey every place a flavor graph appears (Recipe Notebook overview bars, flavor-map radar, per-axis pages, boost and temper, invent panels, Cookbook radar, ingredient panel, shared page, share cards in three sizes) and what each is for; then show the owner several candidate designs drawn with REAL data for the same five recipes (a spirit-forward drink, a sour, a rich sauce, a spiced dish, a dessert), for example: grouped bars with only the strongest shown; two small wheels (taste and aroma); one wheel with aroma families as sectors; a short written 'tasting note' line with a small chart; a ranked chip list. Each shown at phone width and on a share card, with what it makes easy and what it hides. The owner picks; the choice becomes a spec and build tasks. AROMA-4's bar rule is an interim so charts stay readable until then, not the final design.",
  "acceptance": [
    "Every existing graph surface is listed with its purpose and what breaks at seventeen axes",
    "At least four candidate designs are shown to the owner as viewable mock-ups using real recipe data, at phone width and card size",
    "Each candidate has its trade-offs stated; the owner's choice is recorded verbatim",
    "A spec and tasks are written from that choice; nothing is built in this task"
  ]
}
```

```json
{
  "id": "PROFILE-1",
  "title": "A flavor profile for every existing recipe, opened from the recipe card next to Riff",
  "category": "ui",
  "passes": true,
  "description": "Owner, 2026-11-16: 'add a task to create a flavor profile for every existing recipe and make it available in the recipe card next to the riff button'. Every built-in cocktail, sauce and Cookbook dish, and every item the user saved or invented, gets a flavor profile computed by the one shared function (profileForRecipe: taste labels and strengths, the aroma table, amounts, garnish) and shown through the shared display rule (Taste and Aroma groups, strongest first, '+N fainter notes', 'show all'). A 'Flavor profile' button sits next to 'Riff on it' on the recipe card the labs use (LabNodeCard in the Cocktail Lab and Sauce Lab) and in the equivalent action row of the Cookbook's recipe detail; it opens the profile in place (an expanding section or a small sheet in the chalk language), with the line 'Built from taste labels and aroma notes for each ingredient, weighted by amount. A guide, not a taste test.', the ingredients that drive the two strongest bars, and any ingredients not counted. Built-in profiles may come from the precomputed share data where that is already loaded, otherwise they are computed on open; either way the numbers must equal the shared page's for the same recipe. A recipe with too little data says so instead of drawing a chart. This uses the interim chart style; CHART-1's redesign will restyle it with the other charts. Run after DATA-6 (same card component).",
  "acceptance": [
    "The button appears next to Riff on built-in and user-made cocktail and sauce cards and in the Cookbook recipe detail, for every recipe; a test over all built-in recipes asserts each one yields a profile or the plain 'not enough data' line, and reports how many of each",
    "The profile shown on the card equals the shared recipe page's and the share card's for the same recipe (test with a drink, a sauce and a dish)",
    "Opening and closing works by tap and keyboard; 375px with no horizontal overflow; 44px targets; no extra large download when a card is opened (state what is fetched)",
    "User-made and invented items show a profile from their own lines and amounts",
    "npm run gate green; nothing deployed without the owner's go-ahead"
  ]
}
```

## 2026-11-15 — Flavor graphs: tasting note with strips, swipe to the wheel; bars in the Notebook; fixed grid on suggestions

Spec: `.schermness/spec.md` → "Flavor graphs for six tastes and eleven aromas". Owner's choice
after CHART-1's options page, verbatim: "Do d. But then also allow users to swipe to see c. A
on recipe note book.  F on suggestion grid". Order: CHART-2 (pure pieces), CHART-3 (components
and the swipe, in-app surfaces), then CHART-4 (cards), CHART-5 (Recipe Notebook), CHART-6
(suggestion cards) one at a time, CHART-7 last. No score changes anywhere.

```json
{
  "id": "CHART-2",
  "title": "The pure pieces: tasting-note sentence, strips, the fixed wheel and the fixed grid",
  "category": "feature",
  "passes": true,
  "description": "Add to the display-rule family (src/data/, pure, no imports beyond flavorDisplay.js, so the share card layout can be copied into the Cloud Functions package): flavorNote(bars) -> { lead, behind, text } (the two strongest notes, or one 'above all' when the strongest is at least twice the second; up to three more 'behind'; a plain fallback under two notes; names notes only, never an ingredient); flavorStrips(bars) -> taste and aroma rows of segments on ONE shared scale (segment length = score over the larger group total), with a stated width threshold for labelling a segment; flavorWheel(bars, size) -> seventeen wedges in fixed positions (aromas clockwise from the top, tastes on the upper left, two gaps), length scaled to the recipe's strongest note, and which wedges get a label at each size; flavorGrid(bars) -> seventeen fixed cells (six tastes; eleven aromas as six and five) with a dot radius or absent. Ordering, floor, labels and colours come from flavorDisplay.js and recipeScoring.js and are not redefined. Reference drawing code: docs/prototypes/flavor-graph-options.html.",
  "acceptance": [
    "Unit tests on real profiles for Old Fashioned ('Woody and sweet, with bitter, spice and toasty behind.'), Hollandaise ('Creamy above all, with sour, salty and nutty behind.'), Margarita, Thai Green Curry and Tiramisu, computed through profileForRecipe, not typed in",
    "Edge cases tested: no bars, one bar, ties (broken by compareBars), a profile with tastes only and aromas only",
    "Strips: the weaker group's row is shorter than the stronger group's; segment lengths sum to the group total over the shared scale",
    "Wheel and grid: every axis has the same position for every recipe (test over all built-in recipes); a test fails if an axis outside the seventeen appears",
    "npm run measure:flavor and its --truth, --aroma, --aroma-blind, --aroma-chef modes print the same numbers as before (stated); npm run gate green"
  ]
}
```

```json
{
  "id": "CHART-3",
  "title": "The note-and-strips chart with a swipe to the wheel, on the shared page, invent panels and Flavor profile button",
  "category": "ui",
  "passes": true,
  "description": "FlavorNote.jsx (sentence with each note underlined in its colour, Taste and Aroma strips), FlavorWheel.jsx (design C as SVG with a one-line key saying which part is taste), FlavorSwipe.jsx (two pages: note first, wheel second; touch swipe, two dots that are buttons, left and right arrow keys; height does not jump between pages; no slide animation under prefers-reduced-motion). A visually hidden ranked list gives screen readers the same content. Replace the bar chart with FlavorSwipe on: the shared recipe page, the three invent panels, and the sheet opened by the Flavor profile button on recipe cards. Keep the 'a guide, not a taste test' label, the 'not counted' line and the not-enough-data state exactly as they are.",
  "acceptance": [
    "Each of the three surfaces opens on the sentence with strips and reaches the wheel by swipe, by the dots and by keyboard (component tests)",
    "The sentence on the shared page, in an invent panel and behind the Flavor profile button is identical for two named recipes (test)",
    "Not-enough-data and no-data states still draw no chart and say why",
    "Looked at in a browser at 375px for a drink, a sauce and a dish, both pages; described honestly, including whether wheel labels collide; no horizontal overflow; 44px targets",
    "npm run gate green; nothing deployed without the owner's go-ahead"
  ]
}
```

```json
{
  "id": "CHART-4",
  "title": "Share cards show the tasting note with strips",
  "category": "feature",
  "passes": true,
  "description": "shareCardLayout.js draws design D in place of the capped bars on the link-preview (1200x630), portrait (1080x1350) and tall (1080x1920) cards, in the browser canvas and on the server card (regenerate cardLayout.generated.ts through scripts/buildShareIndex.mjs; never hand-edit generated files). The first card of the set of three shows D and the wheel together. Stored bars on a user's published copy stay within the rules' limit (at most 11 bars): state whether the sentence and strips can be drawn from the stored bars alone, and if not, what is stored instead and the rules change needed (rules tests on the emulator only). share-cards.json regenerated.",
  "acceptance": [
    "Server and browser cards for a drink, a sauce and a dish were rendered to PNG and looked at; each is described honestly, including sentence wrapping beside a long recipe name and whether segment labels are readable",
    "The sentence on the server card equals the shared page's for the same recipe (functions test)",
    "A user's published copy draws the same sentence as the owner saw in the share sheet (test); any rules change has emulator tests",
    "Cards for recipes with no chart look exactly as before (layout test)",
    "Functions tests, rules tests and npm run gate green; functions and rules not deployed without the owner's go-ahead"
  ]
}
```

```json
{
  "id": "CHART-5",
  "title": "Recipe Notebook: bars stay on the overview; the flavor map becomes the fixed wheel",
  "category": "ui",
  "passes": true,
  "description": "The overview page keeps ranked bars (design A: six tastes and six aromas, 'show all'), now as the chosen design and no longer an interim: update the comments in flavorDisplay.js and the docs to say so. The flavor-map page draws FlavorWheel (seventeen fixed wedges) in place of the radar whose spokes change by recipe. Per-note pages and 'more of' / 'less of' are untouched. The owner did not rule on the flavor-map page; this is the assistant's default (spec Decision 7) and is reported as such.",
  "acceptance": [
    "The overview shows the same bars as before for two named recipes (test unchanged or equivalent)",
    "The flavor map shows the fixed wheel; wedge positions are identical for two different recipes (test)",
    "Looked at in a browser at 375px with a recipe of three ingredients and one of ten; described honestly",
    "npm run gate green"
  ]
}
```

```json
{
  "id": "CHART-6",
  "title": "Suggestion cards: before and after as two fixed grids",
  "category": "ui",
  "passes": true,
  "description": "On the add and swap suggestion cards the small before-and-after radar (three and three spokes) is replaced by FlavorGrid.jsx drawn twice, before and after, with the notes that move most marked (a ring or arrow on the cells whose score changes by more than a stated amount). Both grids use ONE scale (the larger of the two profiles' strongest notes) so a dot that grows really is stronger. Labels only where there is room; a text line names the two notes that move most.",
  "acceptance": [
    "For a named recipe and a named added ingredient, the cells that change match the profile difference computed by the existing delta code (test)",
    "Both grids share one scale (test: an unchanged note has the same dot size in both)",
    "Looked at in a browser at 375px on an add card and a swap card; described honestly, including legibility of the smallest dots",
    "npm run gate green"
  ]
}
```

```json
{
  "id": "CHART-7",
  "title": "Flavor graphs: docs, cleanup and the final pass",
  "category": "chore",
  "passes": true,
  "description": "docs/flavor-profile.md gains a 'Graphs' section: which design is on which surface and why, the sentence rule, the shared strip scale, the wheel and grid layouts, and that nothing about the scores changed. Remove chart code no surface uses any more (old radar axis selection, unused SURFACES entries) with a test that each remaining entry has a caller. CLOSEOUT.md unreleased entry, README and BACKLOG.md updated (left out on purpose: Cookbook card wheel and ingredient panel on the seventeen notes; tappable wedges). Final pass at 375px across the shared page, an invent panel, the Flavor profile button, the Recipe Notebook and a suggestion card. All flavor measures re-run and recorded as unchanged.",
  "acceptance": [
    "docs/flavor-profile.md describes exactly what the code draws on each surface",
    "A test asserts one recipe leads with the same notes on the shared page, an invent panel, a server card, the Recipe Notebook overview and the wheel",
    "All measures printed and unchanged from before CHART-2 (taste 36/41 and 19/20; aroma modes as recorded)",
    "What was and was not looked at for real is stated (a phone, live cards, signed-in flows)",
    "npm run gate, functions and rules tests green; nothing deployed without the owner's go-ahead"
  ]
}
```

## 2026-11-16 — Chalk picture: fade the background (a sixth slider) and try an automatic cut-out

Owner, 2026-11-16: "would it also be possible for the chalk filter to erase the background of
the image?" Offered three on-device ways (focus fade; mark it yourself; automatic cut-out by a
small on-device model) and recommended "focus fade plus a cut-out trial on the try-it page".
Owner: "approve recommendation". A cloud background-removal service stays ruled out (the
original photo never leaves the device; no paid key). Spec: `.schermness/spec.md` → "A picture
for a recipe", addendum "Fading or removing the background". Order: PICTURE-6 after PICTURE-2
(it adds a slider to the chooser PICTURE-2 builds) and before PICTURE-3. PICTURE-7 is an
exploration for the owner and builds nothing in the app.

```json
{
  "id": "PICTURE-6",
  "title": "Focus: a sixth slider that fades the background of a chalk picture to bare slate",
  "category": "feature",
  "passes": true,
  "description": "Add a `focus` setting to src/data/chalkFilter.js: 0 (the default) draws the whole photo exactly as today; raising it keeps a centred oval of the picture and fades every chalk mark outside it (lines, shading, colour fill and grain) smoothly to the bare slate ground, the oval tightening as the value rises. CHALK_DEFAULTS.focus = 0 and CHALK_RANGES.focus = 0-100. The oval follows the crop (square or landscape) and the fade is smooth, with no visible ring. Pure, deterministic, no DOM, no network, as the rest of the filter. RecipePicture.jsx's Adjust panel gains a sixth labelled slider, 'Focus', with live preview and Reset like the other five. At focus 0 the output must be byte-identical to PICTURE-1's for the same input and settings (the prototype-parity test keeps passing unchanged). Stored pictures need no migration: the setting is not stored, only the finished picture.",
  "acceptance": [
    "focus 0 gives byte-identical output to the filter before this task for the same input and settings (test), and the prototype-parity test still passes untouched",
    "With focus raised, a synthetic image with marks in the centre and in all four corners keeps the centre marks at full strength and leaves the corners as bare slate (test with stated pixel thresholds); the fade is monotonic from centre to edge (test); focus clamps to 0-100",
    "The Adjust panel shows six labelled sliders; changing Focus re-runs the filter and cancels the previous run; Reset returns it to 0 (component tests with the stubbed filter)",
    "Looked at in a browser at 375px through the dev harness on a synthetic photo at focus 0, 50 and 100, described honestly (is the fade smooth, does the subject survive, is there a visible ring)",
    "Encoded size still under 150 KB for the three sample images at focus 50 (reported); conversion time on the 4000x3000 test image reported and no main-thread block over 100 ms",
    "npm run gate green; nothing deployed without the owner's go-ahead"
  ]
}
```

```json
{
  "id": "PICTURE-7",
  "title": "Try an automatic cut-out on the try-it page, for the owner to judge",
  "category": "design",
  "passes": false,
  "description": "An exploration, not a build in the app. Extend the chalk try-it page (docs/prototypes/chalk-filter-bench.html, published as the artifact https://claude.ai/artifact/ASj8nzhA61rxqbWLWY4TbV) with: the new Focus slider, and a switch 'Cut out the subject automatically' that runs a small salient-object model in the browser (candidate: u2netp, about 4.7 MB, Apache-2.0, through onnxruntime-web) to make a mask, then draws chalk only where the mask says subject (soft edge). The page must work as a published artifact: the runtime and the model are published beside the page as supporting files (an artifact cannot fetch from other hosts), nothing is uploaded, and the page says so. It reports, per photo, the time taken and the model download size. The owner tries it on their own food and drink photos, including clear glassware and a busy background, and decides: keep focus fade only, add the automatic cut-out to the app (then a spec and tasks follow: model hosting, first-use download, phone timing, a fallback when it fails), or add 'mark it yourself'. Downloading the model file needs the owner's go-ahead first (file name, source and size stated). Nothing in src/ changes in this task.",
  "acceptance": [
    "The published try-it page has the Focus slider and the automatic cut-out switch, and both work on a photo chosen in the page (looked at by the builder on at least a plated dish, a drink in a clear glass and a busy background; described honestly, including failures)",
    "The page states the model's name, size and licence, that nothing leaves the device, and shows the time each cut-out took",
    "The owner's decision is recorded verbatim; if they choose the automatic cut-out, a spec addendum and tasks are written",
    "Nothing in src/ changes; nothing is deployed"
  ]
}
```

## 2026-11-16 — Shopping list: check off, fill from recipes, alternatives

Spec: `.schermness/spec.md` → "Shopping list: check off as you shop, fill it from recipes, swap
what the store lacks". Owner, verbatim: "create a shopping cart tool for them and allow them to
check off items as they shop. also allow them to quickly add ingredients for recipes they can
search up inside the shoping cart that autofills the cart with ingredients that they don't have
in their "pantry". make sure that a critieria of this isn't to double up on ingredients that are
already in their cart unless the cart has specific quantities then you can add on to those
quantities." and "also provide them with a button that provides an alternative to the ingredient
in case the store doesn't have the ingreiend". Today there is no stored list, only "Copy
shopping list". Order: SHOP-1, SHOP-2, SHOP-3, SHOP-4, SHOP-5, one at a time.

```json
{
  "id": "SHOP-1",
  "title": "Shopping list logic: one line per ingredient, quantities added only when both are specific",
  "category": "feature",
  "passes": true,
  "description": "src/data/shoppingList.js, pure: List = { items, recipes }, Item = { id, key, label, parts: [{ qty, unit }], checked, from: [recipeId], swappedFrom?, note? }. Functions: emptyList, addLine(list, { key|text, amount }), addRecipe(list, recipe, has, { includeBasics }) returning { list, summary: { added, merged, skippedHave, skippedBasics } }, toggle, remove, clearChecked, replaceItem (for an alternative, keeping swappedFrom so it can be undone), groupByAisle (produce, dairy, meat and fish, dry goods, spices, drinks, other, from the curated ingredient category, with a stated mapping), toText (the existing 'Copy shopping list' format), unchecked count. Matching is by canonical ingredient name through the curation aliases; a checked-off line does not count as on the list. THE MERGE RULE (owner's criterion, spec Decision 3): existing line without a quantity + anything = one line, still without a quantity; existing with a quantity + incoming without = unchanged; both with quantities in like units (both weights, both volumes, or the same count word) = summed, shown in a sensible unit; both with quantities in unlike units = one line with both parts ('2 cloves + 1 tbsp'), never converted by guesswork. 'has' is one predicate over everything the cook has (My kitchen, the sauce pantry, My bar). Kitchen basics (isBasic) are skipped unless includeBasics. Adding a recipe already in list.recipes is reported so the screen can ask first. Reuse parseAmountText, whatDoINeed.js and the alias resolver; do not write a second amount parser.",
  "acceptance": [
    "The merge table in the spec is a table-driven test, including: 200 g + 300 g = 500 g; 1 cup + 2 tbsp summed as volume; 2 cloves + 1 tbsp kept as two parts; no-quantity line stays no-quantity; a checked line is not merged into; aliases merge (scallion and green onion); free-text items that match no ingredient merge only on identical normalised text",
    "addRecipe on a real built-in dish, sauce and cocktail with a real kitchen/bar fixture adds only what the cook lacks, skips basics by default, and its summary counts are right (tests)",
    "Property-style test: after any sequence of addLine/addRecipe, no two UNCHECKED items share a canonical key",
    "A cap of 200 items is enforced with a plain message; toText matches the existing copy format for a list with and without quantities",
    "npm run gate green"
  ]
}
```

```json
{
  "id": "SHOP-2",
  "title": "The shopping list screen: check off as you shop, kept on the device and with the account",
  "category": "ui",
  "passes": true,
  "description": "ShoppingList.jsx, opened from a new 'Shopping list' entry in the Labs menu that shows the unchecked count. Rows grouped by aisle; each row a large checkbox, the name, the quantity, and which recipes it is for; checking strikes it and drops it to the bottom of its group; rows of at least 44 px, usable one-handed at 375 px. 'Add an item' (typeahead over curated ingredients, free text allowed, optional amount). 'Copy list', 'Clear checked', 'Put checked items in my kitchen' (a button, never automatic; bar items go to My bar), 'Clear all' (asks first), an empty state that explains the two ways to fill it. Storage: localStorage first under one versioned key so it works signed out and offline; when signed in, a `shopping` field on the profile document, merged by item id with last-change-wins per item (each item carries an updatedAt), through the existing useUserProfile sync. State how the known issue recorded in BACKLOG (useUserProfile cloud sync dropping a field) is avoided for this field. The profile rules must allow the new field within a size cap; rules tests on the emulator only.",
  "acceptance": [
    "Component tests: check and uncheck, order after checking, add by typeahead and free text, clear checked, clear all asks first, put checked in my kitchen updates the kitchen and (for spirits) the bar, the count in the Labs menu",
    "The list survives a reload signed out; signed in, two devices' changes merge per item (unit test of the merge with offline edits on both sides); a profile without the field loads as an empty list",
    "Rules tests if firestore.rules changes: own list read and write allowed, another user's denied, oversize denied",
    "Looked at in a browser at 375px with an empty list and a list of about 15 items in several aisles; described honestly; no horizontal overflow; not hidden behind the bottom bar or the consent banner",
    "npm run gate (and npm run test:rules if rules changed) green; nothing deployed without the owner's go-ahead"
  ]
}
```

```json
{
  "id": "SHOP-3",
  "title": "Add from a recipe: search inside the list, add only what the cook lacks; 'Add to shopping list' on What do I need",
  "category": "feature",
  "passes": true,
  "description": "In the shopping list, 'Add from a recipe' opens one search box over the built-in cocktails, sauces and dishes and the cook's own saved cocktails, sauces and recipes (by name; reuse the labs' existing search helpers). Picking a recipe shows its lines split into 'You need' (ticked) and 'You have' (unticked, greyed; from My kitchen, the sauce pantry and My bar), with an 'include basics' tick, and 'Add N to the list'. After adding, a short summary says what was added and what merged into lines already there ('garlic: now 5 cloves'). Adding a recipe that is already on the list asks first. The three 'What do I need?' panels (Cocktail Lab, Sauce Lab, Cookbook) gain 'Add to shopping list' beside 'Copy shopping list', using the same addRecipe, with 'Open list' afterwards. The recipe search must not load the large pairing dataset if the list is opened first (state what is fetched).",
  "acceptance": [
    "Searching finds a built-in drink, sauce and dish and one of the cook's own saved items (component tests)",
    "With a kitchen fixture, the preview ticks exactly the missing lines; un-ticking one leaves it off; ticking a 'you have' line adds it (tests)",
    "Adding two recipes that share an ingredient leaves one line with the summed quantity where both are specific and like-for-like, and the summary says so (test on two real recipes)",
    "Adding the same recipe twice asks first (test)",
    "'Add to shopping list' on each of the three What do I need panels adds the same items the panel lists as missing (tests)",
    "Looked at in a browser at 375px: search, preview, add, summary; described honestly",
    "npm run gate green"
  ]
}
```

```json
{
  "id": "SHOP-4",
  "title": "'Store doesn't have it?': an alternative for any item on the list",
  "category": "feature",
  "passes": true,
  "description": "Each unchecked row has 'Store doesn't have it?'. It opens up to three alternatives for that ingredient, each with how to use it (swapUseText, e.g. 'use three quarters as much'), ones the cook already has marked 'you have this'. Sources, in order: kitchenSwaps.js (swapsFor / findSwap) for food, cocktailRiff.swapCandidates for bar items, then same-category neighbours from the curated ingredients ONLY where a stated rule makes that safe (say what the rule is; if none is safe, do not use this source). An alternative that is already on the list merges by the SHOP-1 rule instead of creating a second line. Picking one replaces the row, keeps 'instead of <original>' on it, and offers Undo; if the cook already has the alternative, offer 'Use what I have' which simply removes the row. Where nothing is known the sheet says so plainly and suggests leaving it out only when the recipe marks the line optional. Wording is advice ('could stand in'), never a guarantee.",
  "acceptance": [
    "For named ingredients with known swaps (e.g. buttermilk, shallot, a base spirit) the sheet lists the alternatives with usage text; for one with none it says so (tests)",
    "Picking an alternative replaces the row, keeps the original for Undo, and adjusts the quantity only when the swap table gives a ratio (test); Undo restores the row exactly",
    "An alternative already on the list merges instead of doubling up (test)",
    "'Use what I have' removes the row and leaves the kitchen unchanged (test)",
    "Keyboard and screen-reader reachable; 375px browser look described honestly",
    "npm run gate green"
  ]
}
```

```json
{
  "id": "SHOP-5",
  "title": "Shopping list: usage events, docs and the final pass",
  "category": "chore",
  "passes": true,
  "description": "Usage events, sent only with the analytics Yes and carrying counts and kinds only, never item text: shop_opened, shop_recipe_added (kind, origin, added and merged counts), shop_alternative_used. Add them to the catalogue (src/data/usageEvents.js), docs/usage-data.md and the privacy page together (the parity test enforces it). docs: a short docs/shopping-list.md (what is stored and where, the merge rule with its table, what 'pantry' means, limits). README, BACKLOG (left out on purpose: prices, stores, sharing a list, weight-volume conversion, per-store aisle order) and a CLOSEOUT.md UNRELEASED note stating the exact deploy targets. Final pass at 375px: add a dish from inside the list with a kitchen that has some of it, add a second recipe that shares an ingredient, check items off, use an alternative, put checked items in the kitchen, reload, and (emulator or stub only) the signed-in sync. Anything not exercised for real is named.",
  "acceptance": [
    "The three events arrive at the test double with only the listed params; item text never appears (tests); catalogue, doc table and privacy page in step",
    "docs/shopping-list.md matches what the code does, including the merge table",
    "The end-to-end pass was done at 375px and is described step by step, with what was and was not exercised stated",
    "npm run gate, functions and rules tests green; nothing deployed without the owner's go-ahead"
  ]
}
```

## 2026-11-16 — The test run fails on timeouts when the whole suite runs

Seen across the last eight tasks: `npm run gate` fails on tests hitting vitest's 5 s limit when
the full suite runs under load, and the same files pass alone. PICTURE-2 needed five full runs
(about four minutes each). Files seen so far: CookbookLab.design3, CookbookLab.whatDoINeed,
CookbookLab.pickerMode, curation.integration, suggestable, WineLab.glasses, flavorCharts.

```json
{
  "id": "GATE-1",
  "title": "Make the full test run pass first time: find why these tests time out under load and fix the cause",
  "category": "tooling",
  "passes": true,
  "description": "Diagnose before changing anything: run the full suite with vitest's reporter timings and find what the timing-out files have in common (loading the large ingredient and pairing files per test file, heavy component trees, the worker pool oversubscribing a machine with little free memory and a nearly full disk). Then fix the cause, in this order of preference: (1) load big fixtures once and share them (a cached loader or a globalSetup) instead of per test; (2) cap the worker pool in vitest config so the machine is not oversubscribed, if measurements show that is the cause; (3) only then, a longer timeout for the specific files that legitimately do heavy work, set per file with a comment saying why, never a blanket increase that would hide a real hang. No test is skipped, deleted or weakened. Report timings before and after.",
  "acceptance": [
    "A short written diagnosis with numbers: the slowest test files and tests, and what they spend the time on",
    "The full gate passes three times in a row with no timeout failure (all three runs reported with their durations)",
    "Total gate time is not worse than before by more than a stated small margin, and is reported",
    "No test skipped, deleted or weakened; any per-file timeout carries a comment with the measured reason",
    "npm run gate green"
  ]
}
```

## 2026-11-16 — Shopping list in US amounts; deletions that stay deleted

Owner, 2026-11-16, answering the open decisions listed after v1.20.0: "3. add us amounts by default." (SHOP-OPEN-1,
metric and US amounts on one line) and "4. es." (yes: fix PROFILE-RESURRECT, things deleted on one device coming back
at sign-in). Order: SHOP-6, then PROFILE-2, one at a time.

```json
{
  "id": "SHOP-6",
  "title": "Shopping list: metric and US amounts add up, shown in US amounts by default",
  "category": "feature",
  "passes": true,
  "description": "Closes SHOP-OPEN-1 by the owner's ruling. Today 200 g + 8 oz stays two parts on one line because only exact ladders are summed (src/data/shoppingList.js, merge-rule header). New rule: a weight adds to a weight and a volume adds to a volume across metric and US (1 oz = 28.3495 g, 1 lb = 16 oz; US cup 236.588 ml, tbsp 14.787 ml, tsp 4.929 ml, fl oz 29.574 ml; cl and l as today). Weight is still never turned into volume or the reverse, count words (cloves, sprigs, dashes) are untouched, and unlike kinds still show as two parts. What is STORED must stay exactly what was entered (no rounding written back, so Undo, sync and the other display stay exact); the total is worked out for display. Display system: US by default (oz and lb; tsp, tbsp, cups; fl oz for drinks, written the way a US cook reads them, with the fractions 1/4 1/3 1/2 2/3 3/4 and no false precision such as 7.05 oz), with one switch on the list, 'US | Metric', remembered on the device (say where it is kept and whether it syncs; default: device only). Metric display rounds to sensible steps (5 g, 5 ml, or 1 for small amounts). The word 'about' is shown only when the number on screen is not exact (a conversion between systems happened, or rounding changed it); a line entered and shown in the same system reads exactly as before. Copy list and the add summary ('garlic: now 5 cloves') use the same display. Do not change how recipe cards elsewhere in the app print their own amounts; name that as out of scope in the report. Update docs/shopping-list.md (the merge table and a short 'US and metric' section with the factors and rounding steps) and move SHOP-OPEN-1 in BACKLOG.md to decided, with the owner's words.",
  "acceptance": [
    "Table-driven tests: 200 g + 8 oz is one part (about 15 oz in US, about 425 g in metric); 250 ml + 1 cup is one part (about 2 cups; about 485 ml); 30 ml alone shows as 1 fl oz in US and 30 ml in metric with no 'about' in metric; 1 cup + 2 tbsp entered in US shows exactly as before with no 'about'; 2 cloves + 1 tbsp still two parts; 200 g + 1 cup still two parts",
    "Stored parts are byte-for-byte what was entered after any number of merges and after switching the display back and forth (test); replaceItem Undo still restores exactly",
    "US rounding never prints more than one fraction or a decimal a cook cannot measure (property-style test over a range of gram and ml values); no value rounds to 0",
    "The switch changes every row, the copy text and the add summary; it survives a reload (component tests)",
    "Looked at in a browser at 375px with a list holding metric-only, US-only and mixed lines in both settings; described honestly; no horizontal overflow",
    "docs/shopping-list.md and BACKLOG.md match the code; npm run gate green; nothing deployed"
  ]
}
```

```json
{
  "id": "PROFILE-2",
  "title": "Deleted means deleted: a recipe, drink, sauce, cuisine, ingredient or favourite pairing removed on one device does not come back at sign-in",
  "category": "bug",
  "passes": true,
  "description": "PROFILE-RESURRECT in BACKLOG.md: mergeProfiles (src/hooks/useUserProfile.js) joins the local and cloud lists as a union with no record of removals, so anything deleted on one device returns from the other at the next sign-in. Only the shopping list has removal markers (src/data/shoppingStore.js, mergeShopping, 30 days). Diagnose first and write down, per list (recipes, cocktails, sauces, favourite pairings, cuisines, ingredients, and any other list the merge unions; shares is the owner's record of public links and needs its own look), how items are identified and whether they carry a time. Then give each list removal markers on the same pattern as the shopping list: a removal is recorded with its time, kept 30 days, synced with the profile, and the merge drops an item whose marker is newer than the item's own last change (where the item has no time, the marker wins). Adding the same thing again clears its marker. A device that has been offline longer than 30 days can still bring an item back; say so in the docs rather than hide it. Deleting must work signed out (marker kept on the device and applied at the next sign-in). Put the merge in a pure, tested function if it is not one already. The profile rules must allow the new field within a size cap; rules tests on the emulator only, with a demo- project id of its own. Do not change what deleting a recipe does to a link already shared from it; report what happens today. Remove PROFILE-RESURRECT from BACKLOG.md and add a CLOSEOUT.md UNRELEASED note naming the deploy targets (rules if they changed, hosting).",
  "acceptance": [
    "A written per-list table in the report: identity, whether items carry a time, how removal is recorded",
    "Unit tests of the merge for every list: deleted on A and still on B stays deleted; deleted on A then added again on A stays; deleted on A, edited later on B (where items carry a time) keeps B's edit; markers older than 30 days are dropped; a profile with no markers merges exactly as before",
    "Signed-out delete followed by sign-in keeps the item deleted (test)",
    "The existing merge tests, including the favourite-pairings sign-in fix, still pass unchanged",
    "Rules tests if firestore.rules changes: own profile with markers allowed, oversize denied, another user's denied",
    "npm run gate (and npm run test:rules if rules changed) green; nothing deployed"
  ]
}
```

## 2026-11-16 — One recipe builder on the chalkboard; one suggestion deck; ingredients open their card

Spec: `.schermness/spec.md` -> "One recipe builder on the chalkboard; one suggestion deck; ingredients open
their card". Owner, verbatim: "also i want to be able to click on the ingredients to look at their individual
cards.  for the recipe notebook, i want to retire that look and use the universal chalkboard look that is used in
other labs like the sauce lab and cocktail lab for inventing recipes.  and use the same suggestion deck", then
"One builder". Order: BUILDER-1, 2, 3, 4, 5, one at a time.

```json
{
  "id": "BUILDER-1",
  "title": "One suggestion deck: the before-and-after grid deck in all three builders, and the same grid on the matched-sauces deck",
  "category": "ui",
  "passes": true,
  "description": "Today SuggestionCardDeck (IngredientProfileCard, two FlavorGrid charts: Now and With X) is mounted only in the Recipe Notebook and always with a single card; the invent panels (InventCocktail, InventSauce, InventRecipe) show plain chips (InventSuggestions) and plain replacement lists; SauceSuggestionDeck draws the old BeforeAfterRadar twice per card. Build: (1) in each of the three invent panels, 'Goes well with what you have' keeps its chips for a quick add and gains a button, 'See how each changes the flavor', that opens SuggestionCardDeck with ALL current suggestions as cards (swipe, arrows, dots; Add on each card adds the line exactly as the chip does, amounts included). (2) The replacements ('Don't have it? Try...') open the same deck in swap mode over the stand-ins. (3) The deck's Now grid must equal the panel's own flavor profile: feed it the build's lines with amounts through the one profile calculation the panels already use (profileForRecipe / buildFlavorProfile / profilePair); if the deck today computes from names only, extend it rather than adding a second calculation, and keep its Recipe Notebook mount working. (4) SauceSuggestionDeck draws the FlavorGrid pair instead of BeforeAfterRadar; delete BeforeAfterRadar when nothing imports it. Deck opened from a panel is an overlay in the chalk look that returns to the panel where the cook was. Ingredients with no flavor data are handled as the grid already does.",
  "acceptance": [
    "Component tests per panel (cocktail, sauce, recipe): the button opens a deck with one card per suggestion; Add on the second card adds that ingredient to the build with the same amount the chip would give; closing returns to the panel with the list intact",
    "Swap mode from a replacement in each panel replaces the line and closes (tests)",
    "A test shows the deck's Now grid and the panel's flavor profile lead with the same notes for a build with amounts (Negroni lines; a Bolognese-like build)",
    "SauceSuggestionDeck renders FlavorGrid, and BeforeAfterRadar no longer exists in src/ (grep in the report)",
    "The Recipe Notebook's existing deck tests still pass",
    "Looked at in a browser at 375px in one panel at least: deck open, swipe, add; described honestly; no horizontal overflow",
    "npm run gate green; npm run measure:flavor numbers unchanged (state them)"
  ]
}
```

```json
{
  "id": "BUILDER-2",
  "title": "The chalkboard recipe builder gains what only the Recipe Notebook had",
  "category": "feature",
  "passes": true,
  "description": "InventRecipe.jsx (the chalkboard recipe builder) gains, reusing the existing components and logic rather than rewriting them: (1) the Flavor Profiles card (RecipeFlavorProfilesCard: overview ranked bars, fixed wheel, per-note pages whose Boost/Temper chips add to the build with a predicted amount, Enhance, Pairings), opened from the builder's flavor profile row; it must read the build's lines and amounts. (2) Model-based suggestions and smart swaps: the set-completion model's candidates (loadSuggestCandidates / recipeRuntime, as RecipeLabMobile uses them) join the builder's suggestion list and its deck from BUILDER-1, kitchen first, de-duplicated, with the pairing-index ranking as the fallback when the model is not loaded. (3) Find a cocktail, Need a sauce and Find wines buttons wired to the same App handlers the Notebook uses (handleFindCocktail, handleFindSauce, onFindWine), fed from the build. (4) Cooking-method chips (RecipeCookingMethod). (5) When the builder is opened from a handoff that carries method steps or a picture, they are shown (collapsed 'Method (N steps)', picture with remove) as the Notebook shows them. Do not remove anything from the Notebook in this task and do not change routes; BUILDER-3 does that. Retired on purpose and NOT to be ported: swipe-left delete, per-row match %, the focal flag, Recenter, NotebookStarter.",
  "acceptance": [
    "From a build of three or more ingredients the Flavor Profiles card opens; a Boost chip adds its ingredient to the build with an amount; the Pairings page buttons call the handlers with the build's names (component tests)",
    "With a stubbed model the suggestion list contains model candidates and pairing candidates without duplicates, kitchen items first; with no model the list still fills (tests)",
    "Find a cocktail / Need a sauce / Find wines call their handlers with the build's ingredient names and title (tests)",
    "Cooking-method chips render and their selection is kept while the builder is open (test)",
    "A seeded handoff with steps and an image shows both; removing the image works (test)",
    "The cocktail and sauce builders are unchanged (their tests pass untouched)",
    "Looked at in a browser at 375px: the builder with the new rows, the Flavor Profiles card opened from it; described honestly",
    "npm run gate green"
  ]
}
```

```json
{
  "id": "BUILDER-3",
  "title": "The Recipe Notebook tab opens the chalkboard builder; the paper page is retired",
  "category": "feature",
  "passes": true,
  "description": "Tab 'recipe' and ?path=notebook mount the chalkboard recipe builder instead of RecipeLab/RecipeLabMobile. Every existing way in opens the builder seeded with that recipe: the Network panel's build recipe, Profile's load recipe, Cocktail and Sauce 'open in Recipe Notebook', the Pairing Lab's send to recipe, Make a recipe (sendToNotebook), URL import, and a handoff from an invention (inventionHandoff). The seed carries lines, amounts, title, steps, picture, and now also the dish type and cuisine that inventionHandoff drops today. With no handoff the tab opens the builder at its first question, or with the build the cook left there (keep work in progress across tab switches as the Notebook did; say how). Saving goes through saveInvention (amounts, picture, share). Recipes saved earlier by the Notebook (names only, userProfile.addRecipe) must still list in the Cookbook and Profile, open in the builder, and save without being duplicated or losing their name; do not migrate stored data in place. Unmount RecipeLab, RecipeLabMobile, RecipeNotebook and NotebookStarter (delete in BUILDER-5, not here, so this change is easy to revert). Update or replace the tests that asserted the paper page; a test that covered behaviour now retired by the spec (swipe-delete, match %, focal, recenter, starter) is removed with a line in the report naming it; any other failing test is a real regression to fix.",
  "acceptance": [
    "?path=notebook and the Labs entry show the chalkboard builder; no element with the paper styling or data-testid notebook-paper is rendered (test)",
    "Each listed way in opens the builder with the handed-over lines and title (one test per door, with amounts and steps where that door carries them)",
    "An invention handed to the tab keeps its dish type and cuisine (test)",
    "A names-only recipe saved by the old Notebook opens in the builder, can be renamed and saved, and appears once afterwards (test)",
    "Switching to another tab and back keeps the build in progress (test)",
    "The report lists every test removed and why, and every Notebook feature with where it now lives or that it was retired by the spec",
    "Looked at in a browser at 375px and at desktop width: the tab, one handoff from the Cocktail Lab, a save; described honestly",
    "npm run gate green"
  ]
}
```

```json
{
  "id": "BUILDER-4",
  "title": "Tap an ingredient to see its card",
  "category": "feature",
  "passes": true,
  "description": "A reusable IngredientCard overlay built on the Pairing Lab's chalk single-ingredient card (PairingModeCard with props from buildPairingCardProps in src/data/pairingCardData.js, shown for the ingredient's own profile as the Pairing Lab's peek does), not on the Network's IngredientPanel. It shows the name, taste and aroma, what it pairs with, and shared compounds where known, with 'Open in Pairing Lab', and, when opened inside a builder, 'Add to this recipe' (or 'Swap it in' from a replacement). Closes with Back, Escape and a tap outside; focus returns to the name that opened it. One provider or hook (for example useIngredientCard) so surfaces only need to render a tappable name. Make ingredient names tappable in: the three builders' lines (InventList), suggestion deck cards (IngredientProfileCard name), suggestion chips via a small info button (a tap on the chip still adds), Flavor Profiles 'Driven by' names, cocktail, sauce and wine detail cards (LabNodeCard ingredient lines and 'pairs with' chips), Cookbook recipe card ingredients, What do I need rows, shopping list rows (the checkbox must keep working; the name is the link, with a target of at least 44 px that cannot be confused with the checkbox). NOT on the public shared recipe page. While the large dataset is still loading, tapping shows a short loading state and then the card; an ingredient the app does not know (free text, an unresolved name) is not a link, or says plainly that there is no card. Names resolve through the curation aliases. Add a usage event only if the catalogue, docs table and privacy page are updated together (name only as a count, never the ingredient text).",
  "acceptance": [
    "Component tests: the card opens from each listed surface with the right ingredient, closes three ways, and returns focus",
    "Inside a builder, 'Add to this recipe' adds the ingredient once and closes; from a replacement it swaps (tests)",
    "Shopping list: tapping the checkbox still checks the row and does not open the card; tapping the name opens it (test)",
    "An alias opens the canonical ingredient's card; a free-text line renders no link (tests)",
    "With the dataset not yet loaded the tap shows loading then the card (test with a delayed loader); the shared recipe page gains no link and loads no new data (test or grep in the report)",
    "Keyboard and screen-reader reachable (names are buttons or links with a label such as 'About garlic')",
    "Looked at in a browser at 375px from a builder line, a cocktail card and a shopping row; described honestly",
    "npm run gate green"
  ]
}
```

```json
{
  "id": "BUILDER-5",
  "title": "Flavor-map ingredient marks, removal of the retired notebook code, docs and the final pass",
  "category": "chore",
  "passes": true,
  "description": "(1) Flavor map page of the Flavor Profiles card: bring back one mark per ingredient on the fixed seventeen-wedge wheel, placed from that ingredient's own strongest notes (the removed IngredientFlavorMap is in git history at 4336204^:src/components/RecipeFlavorProfilesCard.jsx; reuse its placement idea on the fixed wheel, with the current flavor tables, not the old model values), each mark labelled or listed so a screen reader gets it; cap or thin labels so twelve ingredients stay readable at 375 px. Close CHART-NOTEBOOK-DOTS in BACKLOG. (2) Delete, each only after a grep shows no importer outside its own tests: RecipeLab, RecipeLabMobile, RecipeNotebook, NotebookStarter, NotebookCanvas, RecipePanel, RecipeAnalysis, RecipeFlavorWheel, IngredientSuggestionsPopout, SuggestionDrawer, SwipeDeckCard, AromaHexWheel, CocktailBuilder, CocktailPanel, with their tests. Anything still imported is left and named. (3) Docs: README, .claude/CLAUDE.md (navigation and the directory list, which still names NotebookCanvas and RecipePanel), docs/flavor-profile.md, a short docs/recipe-builder.md (the one builder, its doors, what was retired, the ingredient card and where it opens), BACKLOG (CHART-SAUCE-CARD closed by BUILDER-1; anything left out), CLOSEOUT.md UNRELEASED with deploy targets. (4) Final pass at 375 px and desktop width: build a recipe from the Notebook tab, use the deck, open an ingredient card and add from it, open Flavor Profiles and the flavor map, find a sauce, save, reopen from the Cookbook, add to the shopping list and open a card there. Anything not exercised for real is named.",
  "acceptance": [
    "Flavor map shows one mark per ingredient with data, readable with twelve ingredients at 375px (component test for count and labels; described from a browser look)",
    "Every listed file is deleted or named as still imported, with the grep shown; bundle builds; the report gives the line count removed",
    "README, CLAUDE.md, docs and BACKLOG match the code; no doc still describes a paper notebook page",
    "The final pass is described step by step with what was and was not exercised",
    "npm run measure:flavor numbers unchanged (stated); npm run gate, functions tests green; nothing deployed"
  ]
}
```

## 2026-11-16 — Shopping list: two rulings; stand-ins for most of what recipes ask for

Owner, 2026-11-16: "DO stand ins.  cut out trial.  Adds optional items.  flavourings start unticked." This closes
SHOP-OPEN-2 (the panel's "Add to shopping list" also adds the optional items), SHOP-OPEN-3 (in "Add from a recipe" a
dish's flavourings start unticked) and SHOP-OPEN-4 (extend the stand-in tables; the owner was shown six ideas and a
measurement on 2026-11-16 and the recommendation "1, 2 and 3 together, then 4"). Measured that day over the 602
built-in recipes, by the names printed on recipe cards: a stand-in exists for 21% of cocktail lines, 25% of dish
lines and 22% of sauce lines; the most used ingredients with nothing are garlic, tomato, butter, olive oil, egg,
flour, ginger, cumin, soy sauce, gin, vodka, simple syrup, lemon and lime juice, both vermouths, bitters, grenadine
and triple sec. Order: SHOP-7, STANDIN-1, STANDIN-2, STANDIN-3, one at a time. ("cut out trial" is not filed: the
owner's choice among the three options was not clear and has been asked.)

```json
{
  "id": "SHOP-7",
  "title": "Shopping list: the panel button adds the optional items too; a dish's flavourings start unticked",
  "category": "feature",
  "passes": true,
  "description": "Two owner rulings on BACKLOG.md SHOP-OPEN-2 and SHOP-OPEN-3. (1) On a What do I need? panel, 'Add to shopping list' (src/components/AddToShoppingList.jsx) now adds what 'Copy shopping list' copies: the missing 'You need' lines AND the optional ones ('Even better with', 'Nice to have'), by the same merge rule, so the two buttons on one panel agree. The summary says how many were optional. Items the cook already has are still skipped, and basics follow the existing rule. (2) In the list's 'Add from a recipe' preview (ShoppingRecipeAdd.jsx, classifyLines in src/data/shoppingRecipes.js), a dish's flavourings (the Cookbook's split of mains and flavourings) start UNTICKED under their own short heading, so a tap adds them; mains the cook lacks stay ticked. Cocktails and sauces have no such split and are unchanged. State plainly in the report whether the two doors now add the same rows by default for the same dish, and if not, exactly how they differ (the panel adds optional items by ruling 1; the preview leaves flavourings unticked by ruling 2) so the owner can see it. Update docs/shopping-list.md and move both entries in BACKLOG.md to decided with the owner's words.",
  "acceptance": [
    "On each of the three What do I need? panels, the rows added equal the lines Copy shopping list copies (tests on a real cocktail, sauce and dish with a kitchen fixture); the summary counts the optional ones",
    "In Add from a recipe, a real dish with flavourings shows them unticked under their own heading; adding with defaults leaves them off; ticking one adds it (tests); a cocktail and a sauce preview are unchanged (tests)",
    "The report states how the two doors compare for the same dish, with the row lists",
    "docs/shopping-list.md and BACKLOG.md match the code",
    "npm run gate green; nothing deployed"
  ]
}
```

```json
{
  "id": "STANDIN-1",
  "title": "Stand-ins: four kinds of answer, amounts, the recipe the row came from, and a coverage measure",
  "category": "feature",
  "passes": true,
  "description": "Groundwork before any new entries. (1) MEASURE: scripts/measureStandIns.mjs (npm run measure:standins) counts, over the built-in cocktails, sauces and dishes, every ingredient line by the app's own canonical name (the resolver the shopping list uses, not the printed label), and reports per kind: distinct ingredients, lines, share of lines with an answer, the most used ingredients with none, and how many more are needed for 80%. --json. Record the baseline in docs/stand-ins.md. (2) KINDS: an entry in src/data/kitchenSwaps.js may be one of four kinds: 'swap' (another ingredient: shallot for onion; today's entries), 'form' (the same thing in another form: dried thyme for fresh, bottled lemon juice for fresh, garlic powder for a clove), 'make' (make it from things: simple syrup from sugar and water; buttermilk from milk and lemon; today's `plus` entries are this), and 'none' (nothing replaces it, with a one-line reason: eggs in a custard). Each may carry `ratio` (a number the code already supports) or `amountNote` for a conversion that is not a single factor ('1 tsp dried for 1 tbsp fresh', '1/8 tsp powder per clove'), and a short `note`. Existing entries keep working unchanged. (3) WHO MAY USE WHICH: the shopping sheet (shoppingAlternatives.js, StoreAlternatives.jsx) shows all four, labelled in plain words ('Use instead', 'Another form', 'Make it', and for none: 'Nothing really replaces X' with the reason, instead of today's 'No stand-in I'd trust'). Recipe-side users (findSwap in whatDoINeed.js and myKitchen.js, the invent panels' replacements, inventSauce.js) keep their present behaviour and must not silently start counting a recipe as makeable through a 'form' or 'make' entry unless you show that is correct for that caller; say per caller what you decided and test it. The Sauce Lab strictness test (a swap never contradicts saucePantry.sameRoleAndKind) must still hold for 'swap' entries. (4) THE ROW'S RECIPE: a shopping row records the recipes it came from (item.from). Use that so swaps flagged supportingOnly (butter and olive oil for the pan) are offered when the ingredient is NOT a main of any recipe the row came from, and withheld when it is a main of one or when the row has no recipe; show the reason in the sheet ('fine for frying; not if butter is the point of the dish'). State how main is decided (reuse the existing mainOf logic) and what data the sheet loads to know it. (5) 'make' on the list: picking it replaces the row with its parts by the merge rule (as the buttermilk case already does), with Undo. Add NO new stand-in entries in this task beyond the minimum needed to test each kind.",
  "acceptance": [
    "npm run measure:standins prints the per-kind table and --json; the baseline is in docs/stand-ins.md with the date and the statement that names are the app's canonical ones",
    "Unit tests for each kind through alternativesFor: label, usage text with a ratio and with an amountNote, a 'none' entry returns the reason and no alternatives, 'make' replaces the row with its parts and Undo restores it",
    "supportingOnly: offered for a row from a recipe where the ingredient is not a main, withheld where it is a main and where the row has no recipe (tests on real recipes)",
    "Every recipe-side caller is listed in the report with its behaviour before and after and a test that it did not change unless stated",
    "Existing swap, shopping-alternative and Sauce Lab strictness tests pass unchanged",
    "The sheet at 375px shows the four labels (component tests; browser look described honestly, saving and restoring any localStorage touched)",
    "npm run gate green; nothing deployed"
  ]
}
```

```json
{
  "id": "STANDIN-2",
  "title": "Stand-ins for food: answers for the ingredients dishes and sauces use most",
  "category": "data",
  "passes": true,
  "description": "Write entries in order of use until at least 80% of dish lines and 80% of sauce lines have an answer on npm run measure:standins (an honest 'none' with its reason counts as an answer and is reported separately from real stand-ins). Work down the measure's most-used list; expect roughly 100 entries. Each entry is ONE reviewable line with role and kind as today, written from common cooking knowledge and marked as the assistant's judgement, never inferred from category alone ('no basil? use mint' is the mistake to avoid). Expected content includes: garlic (jarred or powder as forms, with amounts; shallot is not a stand-in for garlic), ginger (ground, with amount; galangal only where honest), fresh and dried herbs both ways with amounts, tomato forms (canned, paste plus water, fresh), tomato paste, stocks and bouillon, soy sauce (tamari; coconut aminos), fish sauce, vinegars, mustards, chilies and chili powders and flakes, cayenne and paprika, cumin and coriander (ground and whole), cinnamon, nutmeg and mace, garam masala and curry powder as 'make' from spices, cornstarch and flour as thickeners with amounts, baking powder as 'make' from baking soda and cream of tartar, eggs as 'none' with the reason, flour as 'none' unless a specific honest swap exists, rice and noodles and pasta shapes, proteins of one kind (chicken thigh and breast, pork cuts, white fish), milk and cream and coconut milk, cheeses of one kind, nuts and seeds, sesame oil (none: it is a flavouring, not a fat) and other oils, wine in cooking, sugar kinds. A SECOND CHECK, not a source: scripts/checkStandIns.mjs lists, for every 'swap' entry, how many pairing partners the two sides share (the everyday-pairs index measureKitchenMakeable.mjs already uses) and flags the weakest tenth for a second look; each flagged line is either changed or kept with a reason in docs/stand-ins.md. Entries that only hold for a supporting role are flagged supportingOnly; entries that do not hold in a sauce are flagged sauce:false and the strictness test must pass. docs/stand-ins.md gains the full table grouped by kind of ingredient, so the owner can read and correct every line.",
  "acceptance": [
    "measure:standins after: at least 80% of dish lines and 80% of sauce lines answered, with real stand-ins and 'none' answers counted separately; before and after in docs/stand-ins.md",
    "No entry offers a packaged, branded or hidden ingredient (isSuggestable); no entry stands one role or kind in for another (the existing same-role-and-kind test extended to the new entries)",
    "The second-check script runs, its flagged lines are each resolved in writing",
    "Spot tests on named cases: garlic offers forms with amounts and not shallot; eggs say nothing replaces them and why; fresh thyme offers dried with the amount; baking powder offers the make-it; butter for frying appears only for a supporting use",
    "Recipe-side makeability numbers (scripts/measureKitchenMakeable.mjs) are reported before and after; any change is explained",
    "npm run gate green; nothing deployed"
  ]
}
```

```json
{
  "id": "STANDIN-3",
  "title": "Stand-ins for the bar, docs and the final pass",
  "category": "data",
  "passes": true,
  "description": "Bar answers for the shopping sheet and the cocktail builder's 'Don't have it?'. Today only base spirits of one family have alternatives (shoppingAlternatives.js via cocktailRiff.swapCandidates with a family filter). Add reviewed GROUPS, each a named list whose members stand in for each other, with a note where the swap changes the drink: orange liqueurs (triple sec, Cointreau, curacao, Grand Marnier, orange liqueur); dry and blanc vermouths; sweet vermouths; bitter red aperitifs (Campari, Aperol and the like, with 'sweeter, less bitter' notes); aromatic bitters and orange bitters; fizzy waters, which are the same thing (soda water, club soda, seltzer, carbonated water) and tonic, which is not; ginger beer and ginger ale with a note; syrups as 'make' (simple syrup, rich or demerara syrup, honey syrup, grenadine from pomegranate juice and sugar) and as swaps with notes; citrus juice forms (fresh and bottled) and lemon for lime with a note; sparkling wines; cream liqueurs; coffee liqueurs; herbal liqueurs only where honest (Chartreuse: none, with the reason); maraschino liqueur (none; it is not cherry brandy); absinthe and pastis; egg white (aquafaba, with amount); cream kinds; gin and vodka (other bottles of the same spirit are the same ingredient to the app; say what the sheet should tell the cook for 'the store has no gin': an honest none, or vodka with a strong note, and justify). Decide where these live so the cocktail builder and the shopping sheet read ONE table (extend kitchenSwaps with bar entries, or a sibling table read through the same alternativesFor), and keep the existing rule that a base spirit never crosses families. Target: at least 70% of cocktail lines answered on measure:standins, real stand-ins and 'none' counted separately; if 70% is not reachable honestly, stop at what is and say why. Then: docs/stand-ins.md complete (bar table, final numbers), docs/shopping-list.md, README line, BACKLOG (SHOP-OPEN-4 closed; what was left out), CLOSEOUT.md UNRELEASED with deploy targets. Final pass at 375px on the local site: a shopping row for garlic, eggs, butter from a recipe where it is supporting, simple syrup, triple sec and gin; the cocktail builder's replacement for an orange liqueur. Save and restore any localStorage touched; never clear a list you did not create.",
  "acceptance": [
    "measure:standins after: cocktail lines answered at 70% or the honest figure with the reason; all three kinds' before and after in docs/stand-ins.md",
    "One table feeds both the shopping sheet and the cocktail builder's replacements (test: an orange liqueur gets the same alternatives in both)",
    "A base spirit still never crosses families; fizzy waters fold into one ingredient rather than listing each other as stand-ins (tests)",
    "Named cases tested: simple syrup offers make-it with amounts; triple sec offers the orange liqueurs; Campari offers Aperol with its note; Chartreuse and maraschino say nothing replaces them and why; egg white offers aquafaba with the amount",
    "The final pass is described row by row with what was and was not seen",
    "Docs and BACKLOG match the code; npm run gate green; nothing deployed"
  ]
}
```

## 2026-11-16 — Every card's flavor wheel gets the look of the combined wheel

Owner, 2026-11-16, verbatim: "give the flavor wheels on all cards the same look as the new combined flavor wheel.
start with the ingredient card". The combined wheel is `FlavorWheel.jsx` (design C of the flavor-graphs spec):
seventeen wedges in fixed places, six tastes and eleven aromas, each wedge as long as its note is strong and in the
note's colour, drawn from `flavorWheel()` in `src/data/flavorCharts.js`. Found on 2026-11-16, still drawing another
kind of wheel or radar on a card: the ingredient card and the Pairing Lab card (`PairingModeCard.jsx`, `MiniRadar`,
a polygon over `guidedRadarAxes`), the Cookbook recipe card (`ProfileAxisRadar` in `CookbookLab.jsx`), the Wine Lab
shelf card (`ProfileRadar` in `WineLab.jsx`), and the ingredient picker's radar (`PickerRadar` in
`IngredientPicker.jsx`). The parked 3D Network panel (`IngredientPanel.jsx`: TasteRadar, FullWheel,
WedgeGridFlavorWheel, ProfileRadarCarousel) is left alone by the assistant's default, since that view is parked.
Order: WHEEL-1 then WHEEL-2, before the STANDIN tasks.

```json
{
  "id": "WHEEL-1",
  "title": "The ingredient card draws the combined flavor wheel",
  "category": "ui",
  "passes": true,
  "description": "PairingModeCard.jsx is the chalk single-ingredient card, shown in the Pairing Lab and (since BUILDER-4) as the IngredientCard overlay everywhere an ingredient name is tapped. Its chart is MiniRadar, a polygon radar over guidedRadarAxes with a filterType and a chosenAxis. Replace it with the combined wheel: FlavorWheel fed with that ONE ingredient's seventeen notes from the current flavor tables (the per-ingredient values behind profileForRecipe; src/data/flavorMarks.js already reads them per ingredient for the flavor-map marks; do not use the old model values and do not add a second calculation), so an ingredient's wheel and a one-ingredient recipe's wheel agree. Same wedge positions, colours, labels and scaling rule as everywhere else; a size that fits the card at 375 px without clipping any label (the present radar clips 'pungent'; that must be gone). Where the Pairing Lab passes a chosen filter or axis (filterType, chosenAxis), keep the information without bringing back the polygon: mark the chosen note's wedge (a stated, tested treatment such as an outline and its label always shown) and say in the report what each old filter type maps to and what could not be mapped. When the card shows a PARTNER against the ingredient you came from, state what the wheel shows (the partner's own notes, as the default) and keep the shared-compounds section as it is. An ingredient with no flavor data shows the same plain 'not enough flavor data' line the other surfaces use, not an empty ring. A text equivalent (the ranked list of notes) for screen readers, as FlavorWheel already provides. Remove MiniRadar and any helper only it used, after a grep. Do not change what else the card shows.",
  "acceptance": [
    "The card renders FlavorWheel and no polygon radar (test: no pairing-card-radar-polygon; the wheel's wedges are present) in the Pairing Lab and in the IngredientCard overlay",
    "For three named ingredients (lemon, soy sauce, cinnamon) the wheel's strongest wedges equal the strongest notes the flavor tables give that ingredient, and equal the wheel of a recipe made of only that ingredient where one draws (tests)",
    "A chosen axis from the Pairing Lab marks its wedge (test); the mapping table for filter types is in the report",
    "An ingredient with no data shows the plain line (test)",
    "No label is clipped at 375 px (measured in a browser and described honestly); the card's other sections are unchanged (existing PairingModeCard and IngredientCard tests pass, changed only where they asserted the polygon, each change named)",
    "MiniRadar is gone from src/ (grep in the report); npm run measure:flavor numbers unchanged (stated); npm run gate green; nothing deployed"
  ]
}
```

```json
{
  "id": "WHEEL-2",
  "title": "The other cards' wheels and radars take the same look",
  "category": "ui",
  "passes": true,
  "description": "After WHEEL-1. Inventory first and put the table in the report: every wheel or radar still drawn on a card or sheet outside the parked 3D Network panel, with what data feeds it. Known: the Cookbook recipe card (ProfileAxisRadar in CookbookLab.jsx, with RecipeFlavorProfile beside it), the Wine Lab shelf card (ProfileRadar in WineLab.jsx), the ingredient picker (PickerRadar in IngredientPicker.jsx; check whether anything still mounts the picker now that the paper Notebook is gone, and delete it with its tests if nothing does), MultiAxisRadarStack (no importer found; delete if confirmed). Then: (1) Cookbook recipe card: draw the combined wheel from the recipe's seventeen notes through profileForRecipe, the same numbers its Flavor profile button shows; the card's own word lists, if any remain, must not contradict the wheel (say what happened to them). (2) Wine Lab: a wine's chart is not the seventeen notes (it has its own axes, such as body, acidity, tannin, sweetness). Do NOT force wine onto the seventeen notes. Give it the same LOOK: wedges in fixed places for its own axes, each as long as its value, chalk colours, same label and scaling treatment, by making the wheel drawing take an axis set (a small generalisation of flavorWheel / FlavorWheel) rather than copying the component. State the axes used. (3) Any other card found by the inventory gets the same treatment by whichever of the two cases fits; anything that does not fit either is left and named with the reason. The share cards and the functions package already draw the combined wheel; if generalising the wheel changes src/data/flavorCharts.js or flavorDisplay.js in a way the generated functions layout picks up, regenerate with scripts/buildShareIndex.mjs (never hand-edit generated files), run the functions tests, and report whether the generated file changed. Left alone on purpose: the parked Network panel's charts. Update docs/flavor-profile.md (Graphs) and BACKLOG (close what this closes; record the Network panel as left out), and add a CLOSEOUT.md UNRELEASED note with deploy targets.",
  "acceptance": [
    "The inventory table is in the report: every chart found, its data, and what was done or why it was left",
    "Cookbook recipe card shows the combined wheel with the same leading notes as its Flavor profile button for three named dishes (tests)",
    "Wine Lab card shows fixed wedges for wine's own axes with the stated axis list (tests); no wine is charted on the seventeen notes",
    "ProfileAxisRadar, ProfileRadar, PickerRadar and MultiAxisRadarStack are each deleted or named as still used by the Network panel, with the grep",
    "Server and browser share cards still match (existing parity tests pass); functions tests green if anything under functions/ changed",
    "Looked at in a browser at 375 px: a Cookbook card and a wine card; no clipped label; described honestly",
    "npm run measure:flavor numbers unchanged (stated); npm run gate green; nothing deployed"
  ]
}
```

## 2026-11-16 — The automatic cut-out moves from the trial page into the picture chooser

Owner, asked three times which of the three options they meant for the cut-out trial (add the automatic cut-out to
the app / Focus only / mark it yourself): "cut out trial.", then "continue with cutout tiral". The assistant reads
this as: carry the automatic cut-out forward into the app. It is built as a button the cook chooses to tap, so
nothing changes for anyone who does not, and it is not deployed without the owner's go-ahead. PICTURE-7 (the trial)
stays as the record of the trial page. Runs after STANDIN-1, before STANDIN-2.

```json
{
  "id": "PICTURE-8",
  "title": "Recipe pictures: 'Remove background', an automatic cut-out on the device",
  "category": "feature",
  "passes": true,
  "description": "In the picture chooser's 'A photo as chalk' step (RecipePicture.jsx, chalkFilterBrowser.js, chalkWorker.js, the pure filter in src/data/chalkFilter.js), add a 'Remove background' button beside Adjust. Tapping it loads a small on-device model once, finds the main subject, and the chalk is drawn only there, the rest left as bare slate with a soft edge. Port the pipeline from the trial page docs/prototypes/chalk-cutout-bench.html (do NOT edit that file or chalk-filter-bench.html; PICTURE-1's parity test runs the latter): model U2-Net small (u2netp, Apache-2.0), run with onnxruntime-web, which the app already ships for its other models (see how src/ loads public/models/*.onnx and where scripts/copy_wasm.cjs puts the wasm files; reuse that, do not add a second copy of the runtime or load anything from a CDN). The model file: decode the base64 text the trial used into public/models/u2netp.onnx (source text: C:\\Users\\scher\\AppData\\Local\\Temp\\claude\\D--Projects-flavor-network\\7e4ae764-bfa2-46b3-b75c-0637549eb886\\scratchpad\\cutout\\u2netp.b64.txt; the owner approved downloading this model on 2026-11-16; do not download anything else), check its size is about 4.6 MB, commit it, and add its licence notice where the repo keeps third-party notices (create a short NOTICE entry if there is none). RULES: the model is fetched from the app's own hosting only when the button is tapped, never before, and is cached by the browser; the original photo and the mask never leave the device (no network request carries pixels: test it); only the finished chalk JPEG is stored, as today, so nothing about the cut-out is stored or migrated. The mask is an input to the filter: add an optional mask argument to the pure filter (alpha per pixel, feathered) so the filter stays pure and testable; with no mask its output is byte-identical to today (existing parity tests pass unchanged). Running the model must not freeze the page: off the main thread where the runtime allows, with a visible 'finding the subject…' state and a way to cancel. Failure (model fails to load, no WebAssembly, out of memory, nothing found, or the mask covers almost nothing or almost everything) falls back to the picture without a cut-out and a plain sentence; it never blocks saving. Focus stays and works with or without the cut-out; 'Remove background' can be turned off again. Honest limits go in the UI as one short line and in docs/pictures.md: clear glassware and busy backgrounds may cut badly; the first use downloads about 5 MB. State the measured time for one picture on this machine.",
  "acceptance": [
    "With a synthetic test image (a coloured subject on a plain ground) and a stubbed model that returns a known mask, chalk is drawn only inside the mask and the outside is bare slate with a feathered edge (pure filter tests); with no mask the filter output is identical to before (existing parity tests untouched)",
    "The model is not requested until the button is tapped; after that it is requested from the app's own origin under /models/ and nowhere else; no request carries image data (component test with fetch and worker doubles)",
    "Each failure mode falls back with its sentence and saving still works (tests); cancel works",
    "The stored picture is still a JPEG within 150 KB with no cut-out setting stored (test)",
    "Really run in a browser on this machine with the real model on at least two images (one plain background, one busy): described honestly with the time taken; if it could not be run for real, say so and do not claim it",
    "public/models/u2netp.onnx is committed with its size stated, the licence notice is in the repo, docs/pictures.md and BACKLOG.md (PICTURE-CUTOUT decided, with the owner's words and the assistant's reading of them) match the code, CLOSEOUT.md UNRELEASED names the deploy target (hosting only; state the added download size of a deploy)",
    "npm run gate green; nothing deployed"
  ]
}
```

## 2026-11-22 — The app stops looking AI-made

Owner, 2026-11-22: "the design agent has criteria to make the design of apps look less ai designed. can you use
that as a critque to review and suggest changes for this app? what's making it look like it was created by ai and
what makes it more authentic?", then, to filing the findings: "Yes, file tasks". The criteria are the owner's
`~/.claude/design-criteria.md` (2026-11-22). The review looked at the live site at 375 px: landing page, Cocktail
menu, the Piña Colada card, the recipe builder.

Keep (what already reads as hand-made): the chalkboard world, the drawn chef's hat, the glass shelf and the bottle
shelf on the Cocktail menu, the drawn lab icons, the honest copy ("an idea from what pairs, not a tested recipe").

Rules for every task below: brief each agent with `~/.claude/design-criteria.md` (paste it or point to it) and
`design/DESIGN.md` once LOOK-1 has written it; no literal colours outside the token block; proof is before-and-after
screenshots at 375 px and desktop width checked item by item against the criteria; nothing deployed without the
owner's go-ahead. Order: LOOK-1 and LOOK-2 first (independent), then LOOK-3, LOOK-4, LOOK-5, LOOK-6, LOOK-7 one at
a time (they touch the same components).

Open decision, NOT in any task (defined for the owner 2026-11-22): the name "Neural Flavor" and the atom logo say
"tech lab" while the app says "kitchen chalkboard". If nothing is decided both stay and every task here still
works. Options: keep both (no work, the clash stays); keep the name and redraw the atom as something from a
kitchen (cheap); rename (domain, share cards and links; large). No earlier ruling collides. LOOK-5 leaves the logo
and name exactly as they are.

```json
{
  "id": "LOOK-1",
  "title": "Write the design system: tokens, colour roles, spacing, allowed components, a never list, and typeface specimens for the owner",
  "category": "chore",
  "passes": true,
  "description": "design/DESIGN.md is still the empty template, so every screen was styled by default. Fill it from what the app already uses (src/components/chalkTheme.js and the other chalk styles; Caveat from index.html; the system-ui, Inter and Georgia stacks found in src/ are listed as things to remove, not tokens). Sections: (1) colour ROLES as named tokens with hex and where each is defined: slate ground, chalk text, muted chalk, the ONE accent for the primary action and current state, focus, error, and the taste and aroma colours as data colours only; (2) a spacing scale (tight within a group, generous between sections); (3) the type roles (display, body, small print) with sizes and weights, faces left as 'to be chosen by the owner, LOOK-6'; (4) the components allowed and which tokens each uses (button: one filled primary per view; secondary as text or outline; chip only for something you can toggle; card only for something you can open; rule and space to separate sections); (5) a 'never' list taken from ~/.claude/design-criteria.md as it applies here, plus the review's findings: tracked all-caps labels, middle-dot meta strings, arrows in labels and buttons, emoji as icons (sparkle on Invent included), pills for plain text, a box around every row, coloured stripes that mean nothing, developer words on screen, a stats boast in the hero; (6) required states (empty, loading, error, disabled) for the shared pieces. Then make a specimen page (docs/prototypes/type-specimens.html, self-contained, fonts from Google Fonts only) that renders a real Cocktail card (Negroni: name, ingredients with amounts, method) and a recipe-builder question on the slate ground in three or four candidate pairings: Caveat (or one other chalk hand) for titles with a steady face for body and ingredients. Candidates chosen for a bistro chalkboard menu, not the usual defaults (no Inter, Roboto, Poppins, Montserrat, Georgia), each with one line on why. Publish it for the owner to choose; do not pick for them. No app code changes in this task.",
  "acceptance": [
    "design/DESIGN.md has all six sections filled; every token names the file and variable it lives in; nothing is marked TBD except the typeface names, which point to LOOK-6",
    "The never list covers each item of ~/.claude/design-criteria.md that applies to this app and each finding of the 2026-11-22 review, one line each",
    "docs/prototypes/type-specimens.html renders the Negroni card and the builder question in 3 or 4 pairings at 375 px and desktop width, with real content; screenshots of both widths were looked at",
    "The owner is shown the rendered specimens (an artifact link or screenshots), not font names; their choice is recorded in DESIGN.md and BACKLOG.md when made",
    "No file under src/ changed"
  ]
}
```

```json
{
  "id": "LOOK-2",
  "title": "Recipe lines that read as machine-made: 'tblsp Coconut milk 3' on the Piña Colada, and the empty photo frame",
  "category": "bug",
  "passes": true,
  "description": "Seen live 2026-11-22 on the Piña Colada card (Cocktail Lab): the What do I need rows and the Ingredients list show 'tblsp Coconut milk 3' and 'tblsp Pineapple 3', the unit read as part of the name and the amount on the wrong side; the card's photo frame was an empty grey box. Find where the line is split into amount, unit and name for cocktail cards (the codex lines, src/data/curation/cocktailOverrides.json, the amount parser in src/data/amountGrams.js and whatever builds the card rows) and fix the cause, not the one drink. Then write a check script that runs every built-in cocktail, sauce and Cookbook dish through the same split and lists each line whose name starts with a unit word or a number, or whose amount is empty while the raw text has one; fix what it finds through the existing correction tables (never by editing generated data), and add the script to npm (for example npm run check:lines). Photo frame: when a drink has no photo or the photo fails to load, the card shows no frame at all rather than an empty box (or the drink's drawn glass if one exists); a failed load must not leave a grey rectangle. State how many lines were wrong before and after.",
  "acceptance": [
    "The Piña Colada card reads coconut milk and pineapple with their amounts in front of the name, in the What do I need rows and in Ingredients (component test on that drink)",
    "The check script runs over all built-in cocktails, sauces and dishes and prints the count of bad lines; before and after counts are in the report; after is 0 or each remaining line is named with the reason",
    "No generated data file is edited by hand; fixes live in the parser or the correction tables",
    "A drink with no photo or a failing photo shows no empty frame (test with a failing image)",
    "Looked at in a browser at 375 px on the Piña Colada and two other drinks the script had flagged; npm run gate green; nothing deployed"
  ]
}
```

```json
{
  "id": "LOOK-3",
  "title": "Words and punctuation: no tracked capitals, middle dots, arrows or developer words",
  "category": "design",
  "design_surface": "Cocktail Lab menu and card, Sauce Lab, Wine Lab, Cookbook, the three builders, shopping list, ingredient card",
  "public_surface": {
    "module": "src.components",
    "adds": [
      "visible copy in src/components/**/*.jsx (scanned as text by tests/contracts/LOOK-3/copy.contract.test.js)"
    ]
  },
  "acceptance_criteria": [
    {"id": "AC-1", "given": "every non-comment line of the visible copy in src/components/**/*.jsx", "when": "it is scanned for a space, a middle dot (U+00B7) and a space", "then": "the scan returns exactly 0 hits outside allowlisted files"},
    {"id": "AC-2", "given": "the visible copy in src/components/**/*.jsx", "when": "it is scanned for arrow characters and their escapes", "then": "the scan returns exactly 0 hits outside allowlisted files"},
    {"id": "AC-3", "given": "the visible copy in src/components/**/*.jsx", "when": "it is scanned for textTransform uppercase, text-transform: uppercase and the Tailwind class uppercase", "then": "the scan returns exactly 0 hits outside allowlisted files"},
    {"id": "AC-4", "given": "the visible copy in src/components/**/*.jsx", "when": "it is scanned for the developer phrases cocktail · card, Bridges other families and Warming up the recipe model", "then": "the scan returns exactly 0 hits"},
    {"id": "AC-5", "given": "tests/contracts/LOOK-3/allowlist.json", "when": "each entry is read", "then": "each entry contains a non-empty reason and names a file that exists"}
  ],
  "passes": true,
  "description": "After LOOK-1. The review found: tracked all-caps section labels ('FAMILIES', 'SPIRITS', 'ABOUT THIS DRINK', 'WHAT DO I NEED?', 'INGREDIENTS', 'PREPARATION', 'COCKTAILS LIKE THIS'; 133 uppercase uses in src/); middle-dot strings ('Tap a family to filter · tap a drink for the recipe', 'cocktail · card', 'Tropical Sours · Piña coladas & blended', credits; 83 in src/); arrows in labels and buttons ('← Back', 'swipe →', a → bullet before each ingredient); developer or system words on screen ('cocktail · card', 'Bridges other families', 'Warming up the recipe model…'). Change: section headings become sentence case in the chalkboard's own heading style, and a heading is dropped where the content already says what it is (numbered method steps need no 'Preparation' label); a meta string becomes real structure (the family shown by its drawn glass, the sub-group as a plain second line, credits as small print); Back is a plain 'Back' (an arrow icon from the one icon set only if LOOK-4 has drawn one); ingredient lines lose the → bullet and read amount first, the way a bartender writes a spec; developer words get plain names or are removed ('cocktail · card' removed; 'Bridges other families' becomes words a cook would use, offered in the report; loading lines say what is loading in plain words). A grey hint paragraph under a section moves behind a '?' where it is help, or is cut. Every visible label change keeps tests meaningful: a test that matched the old text is updated and named in the report. Usage-event names and data are not touched.",
  "acceptance": [
    "grep in the report: tracked all-caps text, ' · ' and → / ← in visible copy under src/components, before and after counts; every remaining one named with the reason it stays",
    "Before-and-after screenshots at 375 px and desktop width of the Cocktail menu, the Piña Colada card, a Sauce Lab card, the recipe builder and the shopping list, checked against ~/.claude/design-criteria.md item by item in the report",
    "Each renamed label is listed old -> new in the report, and the owner sees that list before deploy",
    "Tests updated only where they matched old text, each named; npm run gate green; nothing deployed"
  ]
}
```

```json
{
  "id": "LOOK-4",
  "title": "One drawn icon set: chalk icons replace the emoji and the tab bar's stock icons",
  "category": "design",
  "design_surface": "Invent buttons, Riff, shopping buttons, My bar, Labs menu, bottom tab bar",
  "public_surface": {
    "module": "src.components.ChalkIcons",
    "adds": [
      "ChalkIcons.jsx named SVG icon components (title / aria-hidden props, currentColor)"
    ]
  },
  "acceptance_criteria": [
    {"id": "AC-1", "given": "every non-comment line of src/components/**/*.jsx", "when": "it is scanned for Extended_Pictographic characters and U+FE0F", "then": "the scan returns exactly 0 hits outside allowlisted entries"},
    {"id": "AC-2", "given": "src/components/ChalkIcons.jsx", "when": "it is read as text", "then": "it exists, exports at least 8 named components, contains <svg and contains no <img and no http URL"},
    {"id": "AC-3", "given": "src/components/**/*.jsx and MobileTabBar.jsx", "when": "imports are scanned", "then": "no file imports an icon library and MobileTabBar.jsx imports from ChalkIcons and draws no inline svg"},
    {"id": "AC-4", "given": "tests/contracts/LOOK-4/allowlist.json", "when": "each entry is read", "then": "each entry contains a non-empty reason and names a file that exists"},
    {"id": "AC-5", "given": "each named export of ChalkIcons.jsx", "when": "it is rendered with no props", "then": "it renders an svg element"},
    {"id": "AC-6", "given": "each named export of ChalkIcons.jsx", "when": "it is rendered with a title prop, or with aria-hidden", "then": "it returns an accessible name equal to the title, or exactly no accessible name when aria-hidden"},
    {"id": "AC-7", "given": "each named export of ChalkIcons.jsx", "when": "its markup is rendered", "then": "the stroke or fill contains currentColor"}
  ],
  "passes": true,
  "description": "After LOOK-3. Emoji stand in for icons (sparkle on 'Invent a cocktail' and the other Invent buttons, 14 uses; 🔀 on 'Riff on this'; 🛒 on the shopping buttons; 🍾 on 'Only what I have' and 'My bar'; others found by grep), and the bottom tab bar uses stock line icons, a system font and a blue 'Sign in' that matches nothing else. Draw one small icon set in the app's chalk line style (same stroke and wobble as the lab icons on the landing page; SVG components in one file), only for places where an icon is the convention (back, close, share, shopping list, search, the tab bar) or where it carries meaning a word cannot: Invent gets a drawn shaker or whisk, never a sparkle. Where a word alone is clearer, drop the emoji and keep the word. The tab bar is redrawn in chalk on the slate with the app's type and token colours; the current tab is the only place the accent colour appears there. Each icon has an accessible name or sits next to its label.",
  "acceptance": [
    "grep in the report: emoji used as icons in src/components before and after; after is 0 or each remaining one named with the reason",
    "One icon file; no icon from another set remains in the tab bar or the buttons listed (grep)",
    "The tab bar uses only tokens from design/DESIGN.md; the accent appears only on the current tab (screenshot)",
    "Before-and-after screenshots at 375 px and desktop width of the landing page, the Cocktail menu, a builder and the tab bar, checked against ~/.claude/design-criteria.md; npm run gate green; nothing deployed"
  ]
}
```

```json
{
  "id": "LOOK-5",
  "title": "Landing page: lead with the shelf, no stats boast, the labs as a written menu board",
  "category": "design",
  "design_surface": "Landing page (start screen with the six lab doors)",
  "passes": false,
  "description": "After LOOK-4. Today: the chef's hat and the atom logo, then 'Built on 2.2M recipes, 68,417 pairings, and real molecular chemistry.', then six identical rounded cards each with a coloured left stripe that means nothing. The stats line is a stock opener and it overclaims (the project measured the molecular model as weak per ingredient, and charts now come from hand-tuned tables; see .claude/.chemdataset-status.md). Change: cut the stats line (if a line stays, it says what the app does for a cook in plain words, offered in the report); give the page one dominant thing drawn from what the app owns, the glass and bottle shelf of the Cocktail menu or an equivalent chalk drawing of the six labs, rather than six equal boxes; the six labs read as items written on a menu board (name and drawn icon, separated by space and chalk rules, no box around each, no coloured stripes), each still a 44 px target. The logo and the name 'Neural Flavor' stay exactly as they are (open decision, see this section's header). The analytics banner and the loading line keep working. Write a short design brief first (ralph-designer) and show the owner one rendered mock before building.",
  "acceptance": [
    "The stats line is gone; any replacement line is plain and was shown to the owner",
    "No coloured stripe and no identical boxed cards on the landing page; each lab is still reachable with a 44 px target and keyboard focus (test)",
    "One rendered mock was shown to the owner before the build, and their answer recorded",
    "Logo and name unchanged (diff)",
    "Before-and-after screenshots at 375 px and desktop width, checked against ~/.claude/design-criteria.md; npm run gate green; nothing deployed"
  ]
}
```

```json
{
  "id": "LOOK-6",
  "title": "Type: handwriting for titles only, the owner's chosen steady face for everything people read",
  "category": "design",
  "design_surface": "Every screen (type roles)",
  "passes": false,
  "description": "After LOOK-1 (the owner's choice from the specimens) and LOOK-5. Today Caveat sets titles, buttons, list rows, ingredients and method steps, and plain text falls back to system-ui, Inter or Georgia. Apply the type roles in design/DESIGN.md: the chalk hand only for titles and the hand-drawn moments; the chosen steady face for body, ingredients, method, buttons and inputs; one size scale. Self-host or load only from Google Fonts with font-display swap; remove every system-ui, Inter, Georgia and 'sans-serif' fallback stack used as a face (grep). Share cards and the functions package draw text too: if they use Caveat or a system face, say what they use and whether they change (a change there regenerates through scripts/buildShareIndex.mjs and needs the functions tests; deploying it is the owner's call). Check line length (under about 80 characters) and that no label is clipped at 375 px.",
  "acceptance": [
    "grep in the report: fontFamily and font-family values in src/ before and after; after uses only the faces in design/DESIGN.md",
    "Before-and-after screenshots at 375 px and desktop width of the Cocktail card, the recipe builder, the shopping list and the Cookbook card; no clipped label; checked against ~/.claude/design-criteria.md",
    "Share cards: stated whether they changed; if they did, server and browser cards still match (existing parity tests) and functions tests are green",
    "npm run gate green; nothing deployed"
  ]
}
```

```json
{
  "id": "LOOK-7",
  "title": "Fewer boxes and pills: borders only on what you can click, one filled button per view, varied spacing",
  "category": "design",
  "design_surface": "Cocktail Lab card and menu, the three builders, Flavor Profiles card, shopping list",
  "passes": false,
  "description": "After LOOK-6. The review found 171 pill shapes in src/components and a box around nearly every row: the Cocktail card wraps its buttons, chips, rows and sections all in the same rounded border; 'Riff on this', 'Flavor profile' and 'Share' are three equal outlined pills; 'Cocktails like this' is a cloud of boxed pills for plain links; every list row in the Cocktail menu is its own bordered box. Apply the components rule in design/DESIGN.md: a border only on something you can click or that holds state; sections separated by space and a chalk rule; one filled primary action per view (on a drink card that is probably 'What do I need?' or 'Add to shopping list'; propose it in the brief); secondary actions as text or a single grouped control; plain lists as text, not pills; spacing tight within a group and generous between sections. Write the brief first (ralph-designer) with one before-and-after mock of the Cocktail card for the owner.",
  "acceptance": [
    "grep in the report: pill and border patterns in src/components before and after, with what remains and why",
    "Each listed screen has exactly one filled primary action (screenshot per screen)",
    "Before-and-after screenshots at 375 px and desktop width of each listed screen, checked against ~/.claude/design-criteria.md item by item",
    "No behaviour change: existing tests pass, changed only where they asserted a class or border, each named; npm run gate green; nothing deployed"
  ]
}
```
