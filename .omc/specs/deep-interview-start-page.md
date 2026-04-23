# Deep Interview Spec: Start Page for Flavor Network (R10-64)

## Metadata
- Interview ID: r10-64-start-page
- Rounds: 7
- Final Ambiguity Score: 5%
- Type: brownfield
- Generated: 2026-04-21 (refined: rounds 6–7)
- Threshold: 20%
- Status: PASSED (crystal-clear)
- Linked plan.md task: **R10-64**

## Clarity Breakdown
| Dimension | Score | Weight | Weighted |
|-----------|-------|--------|----------|
| Goal Clarity | 0.97 | 0.35 | 0.340 |
| Constraint Clarity | 0.95 | 0.25 | 0.238 |
| Success Criteria | 0.97 | 0.25 | 0.243 |
| Context Clarity | 0.85 | 0.15 | 0.128 |
| **Total Clarity** | | | **0.947** |
| **Ambiguity** | | | **0.053 (5%)** |

## Goal

Ship a lightweight start page that mounts in `App.jsx` **before** `useProData` fires, shown once per user via a `localStorage` flag. It orients a first-time chef on what the app is, offers three mode cards (Discover / Build / Learn) as the hero, and — only after a card is clicked — triggers the 27MB pairings.json fetch. Returning users skip the page entirely and land directly where they were before.

## Constraints
- **Mount position:** Before `useProData()` in `App.jsx` — the hook must not fire until the user clicks a card.
- **Dismissal:** `localStorage` key `fn-start-seen` = `"1"` after first card click. If present on subsequent visits, skip the start page entirely and render the selected-mode surface immediately.
- **Load gating:** `useProData` must be refactored (or wrapped) so the pairings.json fetch is deferred until the user selects a mode. The existing loading spinner (App.jsx:262–279) becomes the post-CTA surface, not the first thing users see.
- **Mobile-first:** Start page must render correctly on ≤375px viewports. Card layout stacks vertically on mobile, 3-column on ≥768px.
- **Accessibility:** Escape does nothing on the start page (no dismiss without choosing a card). Focus trap around the 3 cards. Reduced-motion: disable the Discover card's animated preview, fall back to a still.
- **Bundle budget:** No new heavy deps. No video files. Any animation is CSS or existing Three.js assets already loaded.
- **No separate hero visual** — the 3 mode cards ARE the hero.

## Non-Goals
- Not a guided tour (Walkthrough.jsx already exists and remains the post-entry tour).
- Not contextual help (HowItWorks.jsx remains the `?` button).
- Not a marketing / signup page — no email capture, no account creation.
- Not shown on every visit — power users must never see it twice.
- Not a mode picker for every sub-tab — only 3 top-level cards.

## Acceptance Criteria

**Happy path:**
- [x] On a browser with no `fn-start-seen` key, opening the app shows the start page, NOT the 3D network.
- [x] Network requests panel shows zero fetch of `/proDataset/pairings.json` until a card is clicked.
- [x] Clicking the **Discover** card sets `fn-start-seen=1`, begins the pairings fetch, and routes to the Network tab when ready.
- [x] Clicking the **Build** card sets `fn-start-seen=1`, begins the pairings fetch, and routes to Recipe Lab (default sub-tab: Recipe).
- [~] Clicking the **Learn** card sets `fn-start-seen=1`, begins the pairings fetch, and routes to Network tab with HowItWorks modal auto-open. **Spec amendment:** MoleculeLab route deferred — the lab is being consolidated into IngredientPanel per `feedback_landing_polish.md`.
- [x] On a second visit with `fn-start-seen=1` present, the start page does NOT render and pairings.json fetches eagerly as before.
- [x] A `?reset=start` query param (or dev console call `localStorage.removeItem('fn-start-seen')`) reliably returns the page for testing.

**Mobile / a11y:**
- [x] At ≤375px viewport, cards stack vertically with readable copy (no clipping, no horizontal scroll).
- [x] Keyboard: Tab cycles through the 3 cards; Enter activates the focused card.
- [x] `prefers-reduced-motion: reduce` disables the animated node-cluster preview on the Discover card AND the rotating molecule on the Learn card.

**Error path (round 7 decision: Error Card with Retry + Reset):**
- [x] If pairings.json fetch fails after a card click, show an Error Card in place of the loading spinner with exact copy: "Couldn't load the flavor network." + two buttons: **Retry** and **Start over**.
- [x] **Retry**: re-invokes the fetch. `fn-start-seen` stays = 1 (so a browser refresh does NOT re-show the start page after a transient failure).
- [x] **Start over**: `localStorage.removeItem('fn-start-seen')`, unmounts the Error Card, re-shows the StartPage.
- [x] Unit test: mock 500 → Error Card renders → Retry → on success routes to selected mode (FlowHarness `failUntilAttempt` in `StartPage.test.jsx`).
- [x] Unit test: Error Card → Start over → StartPage visible again with all 3 cards (FlowHarness in `StartPage.test.jsx`).

**Tests:**
- [x] `StartPage.test.jsx` asserts card-click fires `onModeSelect` callback with the correct mode. `startPageFlag.test.js` asserts localStorage read/write/clear + `?reset=start` semantics.
- [x] `StartPage.test.jsx` asserts `motion-safe` classes applied to animated treatments (reduced-motion opt-out).

## Assumptions Exposed & Resolved

| Assumption | Challenge | Resolution |
|------------|-----------|------------|
| "Primary audience is first-time chefs" | Considered power users and technical visitors as alternatives | Mix with first-time chefs leading; power users get fast skip via localStorage; technical visitors served by the Learn card |
| "We need a guided tour" | Walkthrough.jsx already does this post-entry | Start page is a mode picker, NOT a tour — avoids duplication |
| "We need a hero image or animation" | Contrarian challenge (round 5): maybe the 3 cards ARE the hero | Confirmed: card tiles carry visual weight, no separate hero |
| "Show on every visit" | Considered always-show vs session-only vs one-time | One-time only via localStorage — power users must not re-see it |
| "Load 27MB pairings eagerly as today" | Considered keeping the current behavior to simplify the refactor | Defer load behind first card click for a real TTI win |
| "Copy should be scientific and precise" | Considered scientific / playful / utilitarian | Playful + warm-curious, not marketing-y, still mentions 'real chemistry' / '2.2M recipes' as credibility |
| "Three distinct per-card visual treatments" | Simplifier challenge (round 6): would one static treatment across all 3 cards ship the same value in 1/4 the effort? | KEEP the distinct treatments — landing-surface polish is worth the build cost (see memory: feedback_landing_polish.md) |
| "Fetch always succeeds after mode click" | What if pairings.json fetch fails (network, 500, corrupt blob) after localStorage is set? | Error Card with Retry (keeps localStorage) and Start Over (clears localStorage, returns to StartPage) — round 7 decision |

## Technical Context

**Brownfield findings from explore agent:**
- `src/App.jsx:33` — `useProData()` called on mount, blocks render until loaded
- `src/App.jsx:51–53` — Tour modal already uses localStorage key `flavor-tour-complete`
- `src/App.jsx:262–279` — Existing loading spinner (animated rings) — reuse as post-CTA surface
- `src/App.jsx:318–349` — Top nav: Network | Labs (dropdown: Recipe, Cocktail, Sauce, Pairing Chemistry) | Explore (dropdown: Flavor Trees, Flavor Bridge, Network Insights) | Profile
- `src/hooks/useProData.js:316–321` — `pairings.json` fetched in parallel useEffect (NOT deferred currently)
- `src/hooks/useProData.js:118–120` — Exports `{ loading, error, data }` — compatible with post-CTA surface
- `src/components/HowItWorks.jsx` — Contextual `?` modal, reusable from the Learn card
- `src/components/Walkthrough.jsx` — Existing post-entry tour, unchanged by this work

**Refactor plan for the 27MB defer:**
- Wrap `useProData` in a conditional: accept a `enabled` prop/flag; when `false`, skip the fetch and return `{ loading: false, data: null, error: null, ready: false }`.
- In `App.jsx`, set `enabled = startPageComplete` where `startPageComplete = localStorage.getItem('fn-start-seen') === '1' || modeSelected`.
- After card click: set localStorage, set `modeSelected`, which flips `enabled=true`, which triggers the fetch + existing loading spinner + eventual render of the selected tab.

## Ontology (Key Entities)

| Entity | Type | Fields | Relationships |
|--------|------|--------|---------------|
| Start Page | core UI | mounted, startPageComplete, onModeSelect | renders Mode Cards; gates useProData |
| Mode Card | core UI | id, label, description, onClick | three instances: Discover, Build, Learn |
| Discover Card | mode card | label="Discover", route="/network" | routes to Network tab |
| Build Card | mode card | label="Build", route="/labs/recipe" | routes to Recipe Lab |
| Learn Card | mode card | label="Learn", route="/labs/molecule?howItWorks=1" | routes to Molecule Lab + opens HowItWorks |
| First-time Chef | persona | primary audience | sees start page, uses cards as orientation |
| Returning Power User | persona | has fn-start-seen=1 | skips start page entirely |
| Technical Visitor | persona | secondary audience | served by Learn card |
| localStorage Flag | state | key="fn-start-seen", value="1" | set on first card click; checked at App mount |
| Error Card | core UI | title, retry, startOver | shown when useProData errors after mode click |

## Ontology Convergence

| Round | Entity Count | New | Changed | Stable | Stability Ratio |
|-------|-------------|-----|---------|--------|----------------|
| 1 | 5 | 5 | - | - | N/A |
| 2 | 7 | 2 | 1 (CTA → Mode-Card) | 4 | 71% |
| 3 | 8 | 1 (localStorage-flag) | 0 | 7 | 88% |
| 4 | 9 | 1 (Learn-card) | 2 (Labs-entry→Build-card, Network-entry→Discover-card) | 6 | 89% |
| 5 | 9 | 0 | 0 | 9 | **100%** |
| 6 | 9 | 0 | 0 | 9 | **100%** |
| 7 | 10 | 1 (Error-Card) | 0 | 9 | 90% |

Ontology converged at round 5; only expansion was adding the Error Card entity in round 7 after scoping the failure path.

## Implementation Plan (for executor)

### Files to create
1. `src/components/StartPage.jsx` — the component itself; props: `{ onModeSelect: (mode: 'discover'|'build'|'learn') => void }`
2. `src/components/StartPage.module.css` or Tailwind-only styles — card tile layout, responsive breakpoints, reduced-motion query
3. `src/components/__tests__/StartPage.test.jsx` — card click sets localStorage + fires callback

### Files to modify
1. `src/App.jsx` — mount StartPage before useProData when `!startPageComplete`; implement `startPageComplete` state from localStorage + onModeSelect handler that sets the flag, selects the target tab, and triggers useProData
2. `src/hooks/useProData.js` — add `enabled` parameter (default `true` for backwards-compat); when `false`, return `{ loading: false, data: null, error: null }` without firing the fetch effect

### Copy (final)
- **Title:** "Find flavors that work together."
- **Subtitle:** "Built on 2.2M recipes, 48,588 pairings, and real molecular chemistry. Pick a mode to start."
- **Discover card:** "Discover ingredients" / "Explore a 3D network of 3,913 ingredients grouped by shared chemistry."
- **Build card:** "Build a recipe" / "Start with an ingredient, get pairings that balance sweet, sour, bitter, salty, umami."
- **Learn card:** "Learn the science" / "See the molecules, the model, and why basil tastes like strawberry."

### Visual details per card
- **Discover card:** Small (80px) animated node-cluster — 6-8 CSS-only glowing dots with faint connection lines, gentle pulse. Reduced-motion: replace with a still SVG of the same layout.
- **Build card:** SVG icon composite (recipe list + cocktail glass + sauce bowl).
- **Learn card:** Rotating molecule — reuse a simple Three.js scene OR a CSS-rotated SVG of caffeine. Reduced-motion: static.

### Reset for testing
- Support `?reset=start` query param: if present, `localStorage.removeItem('fn-start-seen')` on mount before reading the flag.

## Risks / Notes for executor

1. **useProData refactor is the riskiest change** — adding an `enabled` gate affects every consumer. Scan for all `useProData()` call sites before editing; only App.jsx should pass `enabled=false` initially.
2. **Power-user first-run:** if a returning user has `flavor-tour-complete` set but no `fn-start-seen` (they've used the app before this feature ships), we'll show them the start page once. That's acceptable — treat the start page as "new feature, everyone sees it once."
3. **iOS Safari localStorage quirks:** private browsing mode silently fails on setItem. Wrap in try/catch; if set fails, fall through (start page shows every time on private-mode Safari, which is acceptable).
4. **Do not break the existing Walkthrough.jsx flow** — it triggers off `flavor-tour-complete`, independent of `fn-start-seen`. Both can coexist: start page → card click → Network tab → Walkthrough modal fires (if its own flag is unset).
5. **Performance probe:** measure `performance.now()` from page open to first-paint-of-start-page. Target <300ms on mid-range mobile; if worse, pre-inline the start page CSS.

## Interview Transcript

<details>
<summary>Full Q&A (5 rounds)</summary>

### Round 1 — Targeting: Goal Clarity
**Q:** Who is the PRIMARY audience the start page must serve well?
**A:** A mix — but first-time chefs lead
**Ambiguity after:** 42%

### Round 2 — Targeting: Success Criteria
**Q:** A first-time chef lands on the start page for the first time. What's the ONE thing they should do that would make you say 'start page worked'?
**A:** Pick a mode and go there directly
**Ambiguity after:** 29%

### Round 3 — Targeting: Constraints
**Q:** How should the start page behave for RETURNING users, and should we defer the 27MB pairings.json load behind it?
**A:** One-time only + defer load
**Ambiguity after:** 16%

### Round 4 — Targeting: Goal Clarity (final detail)
**Q:** Which 3 mode cards should the start page offer?
**A:** Discover · Build · Learn
**Ambiguity after:** 10%

### Round 5 — Contrarian Mode, Targeting: Goal Clarity tail
**Q:** Tone + hero visual. CONTRARIAN: the 3 mode cards could BE the hero — meaning you may not need a separate hero at all.
**A:** Playful + card-tiles-are-the-hero
**Ambiguity after:** 8%

### Round 6 — Simplifier Mode, Targeting: Constraint Clarity (animation scope)
**Q:** 3 distinct per-card visuals vs one static treatment — is the build cost worth it?
**A:** Keep the current spec (3 distinct treatments) — landing-surface polish over ship-speed
**Ambiguity after:** 7%

### Round 7 — Targeting: Success Criteria (edge-case completion)
**Q:** User clicks a mode card, fetch fails. What's the error UX and recovery path?
**A:** Error Card with Retry (localStorage stays) + Start Over (localStorage cleared)
**Ambiguity after:** 5%

</details>
