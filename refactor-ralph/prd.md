# Refactor — Requirements

## Overview
Post-consolidation, several components absorbed too much functionality without being decomposed into sub-components. LivingArchView.jsx is 1,284 lines with an 870-line useEffect. This refactor extracts logical units into focused files without changing any behavior.

## Principle
**Extract, don't rewrite.** Every extraction must be a pure structural move — same logic, same behavior, just in a better-organized file. No feature changes, no new functionality, no "improvements" to the logic itself.

## Current State
- `LivingArchView.jsx`: 1,284 lines — Three.js scene setup, animation, raycasting, taste selection, mode transitions, 12 useEffects all in one file
- Inline shader code duplicates what should be in `ShaderMaterials.js`
- 130 lines of pure utility functions (easing, hashing, label creation, wheel layout) mixed with component code
- `animate()` function is 236 lines handling 3 unrelated concerns
- 5 color-management useEffects that could be consolidated

## Target State
- `LivingArchView.jsx` reduced to ~400 lines — orchestration layer only
- Utilities in `src/components/livingArchUtils.js`
- Inline shaders moved to `src/three/ShaderMaterials.js`
- Taste selection logic in custom hook `src/hooks/useTasteSelection.js`
- Animation sub-functions extracted as named functions
- All 12 useEffects still work identically

## Acceptance Criteria
1. LivingArchView.jsx is under 500 lines
2. Zero behavior changes — 3D/2D modes, taste selection, particle animation, edge brightness, all work identically
3. All extracted files are imported by LivingArchView (no orphans)
4. `npm run build` passes
5. No new dependencies added
6. Shader code in ShaderMaterials.js, not inline
