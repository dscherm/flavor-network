# Safe deletion plan — retire the Guided Discovery code (PAIR/Guided #5)

*2026-06-26 · exploration only (no code changed by this doc)*

## Goal
Guided is already gone from the UX (no entry points). This plan removes
the now-dead Guided-Discovery **code** without breaking the reachable
features it's entangled with.

## Verified dependency map (real `import`s, not comment mentions)

**DELETE (guided-only; only App.jsx imports the screens):**
- Components: `GuidedDiscoveryStart`, `GuidedDiscoverySwipe`,
  `GuidedDiscoveryResults`, `GuidedDiscoveryFocalPicker`,
  `GuidedResultsFilterPills`, `GuidedProfileRadar`, `ProvenancePanel`,
  `ThoughtBubbleCard`, `GuidedAlphaPanel` (already orphaned).
- App.jsx: the `activeTab === 'guided' | 'guided-results' |
  'guided-pairing' | 'guided-details'` mount blocks + their imports +
  the guided `?path` routing entries + guided-only state
  (`bubbleStack`, `guidedInitialFilterType`, `setBubbleStack`, …) +
  `deriveFilterStackFromBubbles` usage.
- Data (verify zero real importers first): `guidedDiscovery.js`,
  `curatedPairings.js`.
- Tests: `GuidedDiscoveryResults.test`, `GuidedDiscoveryStart.test`,
  `GuidedResultsFilterPills.test`, `uxPipelinePlaythrough` §2 (Guided
  mechanic block), guided mocks in `App.handoff.test`.

**KEEP (load-bearing — shared with reachable features):**
- `AlphaModeDetailsCard`, `PairingMode`, `PairingModeCard` — the
  network's tap-a-node PairingMode/α-mode flow uses them
  (`pairingModeFocal`, App.jsx ~1454/1466). The guided tabs only
  *reused* them.
- `guidedTourStages.js` (`STAGES`, `logTourEvent`, `tourIsEnabled`) —
  `GuidedTour` + `LabTour` import it.
- `guidedRadarAxes.js` (`getAxesFor`, `getColorMapFor`,
  `pairingMatchesAxis`) — `PairingModeCard` + `PairingMode` import it.
- `MultiAxisRadarStack` (→ `ProfileAxisRadar`) — `CookbookLab` uses it.
- App state: `pairingModeFocal` + tour state (`setTourFocal`,
  `setTourAxis`, `setAffinityRequested`, `setSelectedNodes`, …) — the
  network "Explore in network" + GuidedTour paths use them.

## The one real untangling
App's `guided-pairing`/`guided-details` mounts render the *shared*
`PairingMode`/`AlphaModeDetailsCard`. Deleting the **mounts** is safe;
the **components** stay. Then the network-PairingMode gates that
currently read `&& activeTab !== 'guided-pairing' && activeTab !==
'guided-details'` (App.jsx ~1454/1466) simplify — those tabs no longer
exist, so drop the clauses.

## Phased execution (each phase ends green; commit per phase)

**Phase 0 — safety net.** Capture the two reachable regressions to watch:
a Playwright smoke that (1) taps a network node → PairingMode card opens
(`?path=explore`, `__qaSetTab('network')` + node tap), and (2) the
GuidedTour + a LabTour still launch. Snapshot pass before changes.

**Phase 1 — App.jsx only (no file deletes yet).** Remove the 4 guided
mount blocks + guided imports + guided routing + guided-only state +
simplify the ~1454/1466 PairingMode gates + drop `guided*` from the
nav-chrome `activeTab ===` condition (~1599). Update `App.handoff.test`
(remove guided mocks/assertions) + `uxPipeline` §2. Run full suite +
build + the Phase-0 smoke. → Guided screens are now unimported.

**Phase 2 — delete the orphaned component files.** For each guided
screen, confirm `grep -rn "from '.*<name>"` returns nothing (post
Phase 1), then `git rm` the component + its test. Run suite + build.

**Phase 3 — delete guided-only data.** Confirm zero real importers of
`guidedDiscovery.js` + `curatedPairings.js`, then remove (+ their
tests). KEEP `guidedRadarAxes.js` + `guidedTourStages.js`. Suite + build.

**Phase 4 — sweep.** `grep -rn "uided"` for stragglers (comments, dead
state, `BUBBLE_REGISTRY`, `deriveFilterStackFromBubbles`); remove dead
imports/vars flagged by the build. Final full suite + build + smoke;
commit; push (Codemagic).

## Verification per phase
- `npx vitest run` (full) + `npm run build` (BUILD_EXIT=0).
- `grep -rn "from '.*Guided\|from '.*guidedDiscovery\|from '.*curatedPairings"` → only intended survivors.
- Phase-0 smoke: network node-tap PairingMode + tours still work.

## Risk register
- **Network PairingMode** (tap a node) — highest-watch; shares
  `PairingMode`/`AlphaModeDetailsCard`. Smoke after every phase.
- **Tours** (`GuidedTour`/`LabTour`) — depend on `guidedTourStages.js`
  (kept) + `guidedRadarAxes.js` (kept). Confirm they still mount.
- **Source-grep tests** (`NetworkClickPolish.sourceGrep`,
  `App.handoff`) assert GD-TOUR-* patterns tied to the network handoff,
  NOT the guided screens — but re-run them; update only if a removed
  block was referenced.
- Estimated blast radius: ~9 component files, ~2 data files, ~4-5 test
  files, ~150 lines of App.jsx. Net: large but mechanical once Phase 1
  lands green.
