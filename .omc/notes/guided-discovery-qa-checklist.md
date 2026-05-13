# Guided Discovery — Manual QA Checklist (AC-5.4)

Run each path with `npm run dev` (`http://localhost:5173`).

**Status: Deferred to user for sign-off.** Phase 5b ships this document;
the user walks through each path and ticks the checkboxes.

---

## Setup (run once before starting)

- [ ] `npm run dev` — dev server running at `http://localhost:5173`
- [ ] Open browser DevTools → Console → run `localStorage.clear()`
- [ ] Hard refresh (`Ctrl+Shift+R` / `Cmd+Shift+R`)
- [ ] Confirm landing screen appears with 5 tiles (Guided Discovery, Explore the NeuFlavor Network, Cocktail Lab, Sauce Lab, Recipe Lab)

---

## Tour smoke-check (run once, before the 12 paths)

- [ ] `localStorage.removeItem('flavor-tour-complete')` → hard refresh
- [ ] Walkthrough triggers automatically on the network view
- [ ] Step "Guided Discovery" is present — reads: *"Tell us what you're cooking and we'll find pairings that fit. Pick from thought bubbles like 'goes with a season' or 'is for a cocktail' — stack as many as you want."*
- [ ] Step "Explore the NeuFlavor Network" is present (updated copy from "Search & Discover")
- [ ] All steps can be advanced with "Next"; final step shows "Start Exploring"
- [ ] After completing the tour, `localStorage.getItem('flavor-tour-complete')` === `'true'`
- [ ] Tour does NOT re-trigger on page reload after completion

---

## Path 1: Single ingredient + season — desktop

- [ ] Click "Guided Discovery" tile from the landing screen
- [ ] Sentence starter "I'm thinking about pairing that…" is visible
- [ ] Click "Starts with a specific ingredient" bubble — it expands
- [ ] Type "salmon" into the search input → suggestion appears → click "salmon"
- [ ] Ingredient bubble stays open (Round 4 revision — bubble does NOT collapse)
- [ ] Stack shows 1 chip: "Starts with a specific ingredient: salmon"
- [ ] Click "Goes with a season" bubble → click "Summer"
- [ ] Season bubble collapses; stack shows 2 chips
- [ ] "Show me pairings →" CTA is enabled (green)
- [ ] Click CTA → results view renders (curated wheel or pairing list)
- [ ] Hover or click a pairing card → StoryPanel / detail appears
- [ ] Click "Explore in the network →" → Network tab opens

---

## Path 2: Cuisine + aroma — desktop

- [ ] `localStorage.clear()` → hard refresh → click "Guided Discovery"
- [ ] Click "Goes with a cuisine" bubble → tap the Cuisine pill → bubble collapses
- [ ] Stack shows 1 chip: "Goes with a cuisine"
- [ ] Click "Has a specific aroma" bubble → tap the Aroma pill → bubble collapses
- [ ] Stack shows 2 chips
- [ ] CTA enabled → click → results render
- [ ] Verify both filter contexts appear in the result (cuisine + aroma signal present)
- [ ] "Explore in the network →" routes correctly

---

## Path 3: Three filters + ingredient — desktop

- [ ] `localStorage.clear()` → hard refresh → click "Guided Discovery"
- [ ] Add "Starts with a specific ingredient" (type "lemon", select)
- [ ] Add "Goes with a season" → pick "Winter"
- [ ] Add "Is for a cocktail" (scope toggle) → turns on
- [ ] Stack shows 3 chips
- [ ] CTA enabled → click → results render with all three contexts applied
- [ ] No blank/empty results screen (at least 1 pairing shown or graceful empty state)
- [ ] Removing "Is for a cocktail" chip from the stack re-enables 2-chip state
- [ ] Re-clicking CTA re-runs with updated 2-bubble stack

---

## Path 4: Single ingredient + season — mobile (375×667)

- [ ] Open DevTools → Device toolbar → set 375×667 (iPhone SE)
- [ ] Hard refresh → click "Guided Discovery" tile
- [ ] Sentence starter visible; bubble grid renders 1-column
- [ ] Tap "Starts with a specific ingredient" → expand → type "basil" → select
- [ ] Tap "Goes with a season" → pick "Spring" → collapses
- [ ] Stack chips visible (truncated at max-w-[180px] if long — verify no overflow)
- [ ] CTA visible at bottom without horizontal scroll
- [ ] Tap CTA → results render correctly on mobile viewport
- [ ] "Explore in the network →" works on mobile

---

## Path 5: Cuisine + aroma — mobile (375×667)

- [ ] Hard refresh (still in mobile viewport)
- [ ] Click "Guided Discovery" → tap "Goes with a cuisine" → tap Cuisine pill
- [ ] Tap "Has a specific aroma" → tap Aroma pill
- [ ] Stack shows 2 chips — no overflow beyond screen width
- [ ] CTA tappable (min-h-[44px] touch target confirmed)
- [ ] Results render; back-navigation to landing works

---

## Path 6: Three filters + ingredient — mobile (375×667)

- [ ] Hard refresh (mobile viewport)
- [ ] Add ingredient "garlic", season "Fall", cocktail scope on
- [ ] Stack shows 3 chips; no UI overflow
- [ ] CTA tap → results render
- [ ] Breadcrumb or context indicator (if present) shows correct active filters
- [ ] Removing a chip via tap re-renders stack correctly

---

## Paths 7–9: Surprising-pairings toggle — desktop

*The "Show surprising pairings" toggle or equivalent flag bubble, if present in the BUBBLE_REGISTRY.*

- [ ] Path 7: Open "Show surprising pairings" (or "Is an unusual pairing") bubble → enable → tap CTA → results labelled "surprising" appear or results are filtered differently than without flag
- [ ] Path 8: Stack ingredient + surprising flag → CTA → results combine both contexts
- [ ] Path 9: Toggle surprising flag off mid-session (remove chip) → CTA → results revert to normal set

*If the surprising-pairings bubble is not in the current BUBBLE_REGISTRY, mark Paths 7–9 as N/A and note the registry keys observed.*

---

## Paths 10–12: Dessert flag — desktop + mobile

- [ ] Path 10 (desktop): Open "Is for dessert" bubble → tap "Yes, this is for dessert" → stack 1 chip → CTA → results skew sweet/dessert-appropriate
- [ ] Path 11 (desktop): Stack dessert flag + season "Summer" → 2-chip CTA → results combine both
- [ ] Path 12 (mobile, 375×667): Repeat Path 10 on mobile viewport → same behavior, no layout breakage

---

## A11y spot-checks (manual, any path)

- [ ] Tab through the bubble grid with keyboard — each `<summary>` focusable, Enter/Space toggles
- [ ] VoiceOver / NVDA: bubble grid announced as a group with label "I'm thinking about pairing that…"
- [ ] Screen reader announces chip additions ("Added: Goes with a season. 1 selection.")
- [ ] Screen reader announces chip removals ("Removed selection. 0 selections.")
- [ ] "Show me pairings →" CTA announced as disabled when no bubbles selected
- [ ] After selecting a bubble, CTA announced as enabled

---

## Sign-off

| Reviewer | Date | Paths passed | Notes |
|----------|------|-------------|-------|
|          |      |             |       |
