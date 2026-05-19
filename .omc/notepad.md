# Notepad — Network Cleanup Tactical Delivery

## P0 artifact #2 — iOS hardware availability check (2026-05-18)

iOS Capacitor sync verified earlier this session (commit `1532780` chalk logo deploy):
- `npm run ios:sync` → exit 0
- Bundle: 142.3MB (-37.3MB strip)
- 3 Capacitor plugins: haptics@8.0.2, splash-screen@8.0.1, status-bar@8.0.2
- No new native plugins required for this delivery
- P6 ships against verified Capacitor + Xcode toolchain

## P0 artifact #3 — Test baseline (2026-05-18)

`network-cleanup-tactical iter-2 baseline: 657 passing, 657 total, 2026-05-18, post-commit-1532780`

- 63 test files
- Duration ~20s
- P7 verifies count >= baseline + new tests added (P0 harness + P3 affinity + P4 primer + P5 affinity-primer)


## P0 artifact #1 — Diagnostic harness output (2026-05-18, P2 spike substrate)

Harness: `src/three/__tests__/CameraAnimator.labelAlignment.test.js`
Run: `npx vitest run src/three/__tests__/CameraAnimator.labelAlignment.test.js --reporter=verbose`

### P0 artifact #4 — 3-cluster measurements

**Aggregate ranking:**
```json
{
  "mean_c_a_score": 0.080,
  "mean_c_b_score": 1.323,
  "mean_c_c_score": 0.247,
  "dominant": "C-b camera-pitch"
}
```

**Cluster 2 (SPARSE_OUTLIER) detail — exercises C-c case:**
- centroid_3d: [6.92, 3.98, 22.70]
- visualCenter: [0.95, 1.33, 24.70]
- centroidVsVisualDelta: 6.83 world-units
- Stale orbit projection: viewportY = 0.645 (14.5% off center)
- After C-b fix (camera.lookAt sprite): viewportY = 0.500 (0% off)
- After C-c fix (target visualCenter not centroid): viewportY = 0.510 (1% off)

### Spike conclusion

**MECHANISM = C-b (camera-pitch / orbit-target alignment).** Dominates by 5-16x across all 3 mock clusters; reduces delta to 0% for both compact and sparse-outlier clusters. C-c is a useful secondary mitigation but C-b alone hits the ±5% predicate.

Recommended ADR-2 rewrite: extend `CameraAnimator._tickTourOrbit` so the projected screen-Y of `_tourPivot` lands at viewport center (0.5). Add NEW `pivotTargets[].viewport_align_y` optional field (default `0.5`, omit → no-op). Legacy `pivotAdvanceMs: null` path never enters the alignment branch — byte-identity preserved per Principle #1.

## P2 — Architect re-review verdict (2026-05-18)

**APPROVE_WITH_NOTES** (agentId: `a75df31c09966c13c`)

Architect verified the load-bearing claim and simplified the fix:

- **Load-bearing claim verified:** `_tickTourOrbit` (CameraAnimator.js:640-660) writes `camera.position` + `controls.target.copy(_tourPivot)` only. `controls.enabled = false` (CameraAnimator.js:584-586) means `OrbitControls.update()` never runs. Camera quaternion is stale-from-engage-time. The harness's `stalePoseTarget` (prior-cluster) model is faithful to production.
- **Steelman against C-b:** harness scores were partially an artifact of unit framing (C-b was the only score in the predicate's units). The C-b dominance still holds — but the underlying reason is simpler than "camera-pitch is the biggest effect": **production never calls `camera.lookAt(_tourPivot)` at all** during tour-orbit. The fix is therefore a 1-line `camera.lookAt` + `updateMatrixWorld` call, not iterative pitch correction.
- **Mechanism approved (C-b)** but **implementation simplified** from iterative-pitch math to `camera.lookAt(_tourPivot); camera.updateMatrixWorld(true);`. Provably stable (no iteration, no oscillation). Already proven by harness `projectionFresh` (CameraAnimator.labelAlignment.test.js:320-325) showing deltaFromCenter ≈ 0.
- **Schema narrowed** to `align_to_pivot?: boolean` (Architect improvement #1 adopted). Numeric `viewport_align_y` admitted future callers setting 0.4 "for design" without a real use case. Boolean closes that surface; numeric variant can ship later if needed.
- **Legacy regression structurally protected:** `pivotTargets = []` in legacy mode (LivingArchView.jsx:170-181, 1849-1862, confirmed in legacyRegression.test.jsx:217-219, 225-227). No item exists to carry the field → alignment branch is structurally unreachable. No new gate needed in `_tickTourOrbit`.

**3 binding executor obligations (folded into ADR-2 contract):**
1. Replace iterative-pitch-correction math with single `camera.lookAt(_tourPivot); camera.updateMatrixWorld(true);` call (contract step 2).
2. Add pre-fix sanity branch to harness via `it.each([{fixActive: false, expectFail: true}, {fixActive: true, expectFail: false}])` so the test is meaningful even if fix code path is dead. Cluster 2 stale `viewportY = 0.645` is the natural pre-fix witness (contract step 4b).
3. Add `align_to_pivot: undefined` absence assertion in `LivingArchView.legacyRegression.test.jsx` for all `pivotAdvanceMs: null` configs (contract step 5).

**Non-blocking improvements adopted in ADR-2:**
- Boolean schema (improvement #1)
- Concrete P+1 C-c trigger: `||centroid_3d - trimmedMean(member_positions, 0.2)|| > 4.0` world-units (improvement #2)
- JSDoc note on `_tickTourOrbit:640` about stale quaternion (improvement #3)

**P2-impl may proceed without further consensus loop.** All architect notes are folded into the ADR contract; the executor follows the contract.

---

# Delivery N+1 — Flavor Model Expansion — Autopilot Pre-Flight

**Date:** 2026-05-18
**Plan:** `.omc/plans/ralplan-flavor-model-expansion.md` (Critic R2 APPROVE, 5.75d, 752 final test target)
**Spec:** `.omc/specs/deep-interview-flavor-model-expansion.md` (17.9% ambiguity, 6 rounds, PASSED)

## Binding pre-flight decisions (user-confirmed before autopilot start)

These resolve §6 Open Questions #6 and #7 of the plan. Executor MUST honor them; no re-decide.

### Q6 — Salty + odor_spicy GNN heads (F1 ≈ 0.33)

**Decision: EXCLUDE BOTH ENTIRELY from the flavor graph.**

- Bake script MUST NOT emit any `tier2_taste: 'salty'` entries.
- Curated `node.taste` strings containing `'salty'` are filtered OUT at bake time (not surfaced).
- Bake script MUST NOT read GNN's `odor_spicy` head probabilities at all.
- Salt ingredients still render in the 3D network with their existing cluster color (no regression to a default).
- Rationale: chemDataset-status.md flags both as data-ceiling weak heads ("do not surface"); their inclusion would dilute the entire Tier-2 / Tier-1 vocabulary.

### Q7 — Spicy ambiguity (BRISCIONE_TASTE.spicy vs. GNN odor_spicy)

**Decision: MERGE. Any 'spicy' signal lands at Tier-2 taste only. Tier-1 'spicy' aroma is permanently empty in the flavor graph.**

- The graph's `tier1_aroma` for every ingredient is one or more of `{fruity, floral, green, woody, fatty}` (5 terms — `spicy` excluded from the Tier-1 vocabulary).
- The graph's `tier2_taste` carries `spicy` only via curated `node.taste` (consistent with Q6 above — GNN `odor_spicy` never read).
- `BRISCIONE_AROMA` palette literal is NOT modified (still has 6 terms in JS code). Just no flavor graph data ever maps to its `'spicy'` slot. Palette stays for backward compat + WedgeGridFlavorWheel sector rendering.
- `_meta.tier1_vocabulary` MUST emit `['fruity','floral','green','woody','fatty']` (5 terms, not 6) so any downstream consumer reading the graph's vocabulary key gets the truth.
- Re-color network nodes: primary Tier-1 selector now picks among 5 aromas, not 6. Pure spicy-aroma ingredients (chili, pepper) fall through to their existing cluster color via the defensive fallback path (Plan §2.2 P5).

### Architect's executor obligation (b) — 6 forbidden palette-family transitions

The P5 re-color soak gate requires a "fixed list of ~6 forbidden palette-family transitions" codified in `bake_flavor_graph.py`. Executor codifies this list BEFORE P5 lands and surfaces it here for chef-user review:

**Default 6 forbidden transitions (executor may revise once with chef-user feedback BEFORE P5 lands):**
1. `sweet → woody` (dairy/sweet flipping to woody-aroma is a strong identity break)
2. `sour → fatty` (acid → richness flip — unnatural in shipped clusters)
3. `salty → floral` (salt-cluster → floral palette is jarring)
4. `umami → fruity` (protein/savory → fruity is mis-leading)
5. `bitter → green` (bitter herbs flipping to "fresh green" loses bitter context)
6. `pungent → floral` (chili → delicate floral palette doesn't match)

If `flavor_recolor_diff.json._meta.n_catastrophic` > 50 (catastrophic = any ingredient hitting one of these 6 transitions), P5 gate fails and the executor halts for chef-user review.

### Critic's recommendation #3 — Threshold projection canonicalization

The `per_task[] → {task → ingredient_threshold}` projection logic exists today in `src/utils/predictedProfile.js:34-39`. The new Python bake script (`flavor-gnn/scripts/bake_flavor_graph.py`) MUST mirror this projection literally:

```python
# Mirror of predictedProfile.js:34-39
def project_thresholds(raw):
    out = {}
    for tt in raw['per_task']:
        if tt.get('molecule_f1', 1.0) < 0.4:
            continue  # skip weak heads (matches MIN_F1 = 0.4 in JS)
        out[tt['task']] = tt['ingredient_threshold']
    return out
```

If `predictedProfile.js` ever changes its projection logic, both files must update in sync. Add a TODO comment in both files referencing the other.

### Architect's executor obligation (a) — P0 fixture rows

The 5 P0 fixture rows (mint, vanilla, soy sauce, lemon, garlic) MUST each have a non-empty `tier1_aroma` column when pre-filled by the executor. The §2.4 P0 canonical-fixture preservation gate keys off that specific column.

Suggested seed values (executor may refine):
- mint → `green`
- vanilla → `woody`
- soy sauce → `fatty` (umami is Tier-2, but the aroma profile is fermented/oily-fatty)
- lemon → `fruity`
- garlic → `green` (some chefs would argue `fatty` — pick one and ship)

---

**Pre-flight complete.** Autopilot may proceed; the 4 decisions above are binding constraints, not suggestions.
