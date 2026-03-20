---
mode: bugfix-and-enhance
updated: 2026-03-20T12:30
---

# Flavor Network — Fix Plan (2026-03-20)

## Bug Fixes

- [x] TASK-153: Fix 3D/2D toggle disappearing on iOS when switching tabs or view modes. Lifted mode state to App.jsx so it persists across tab switches. Raised z-index to z-[60] and bottom-24 on mobile to clear MobileTabBar #bug
- [x] TASK-154: Fix flavor labels staying at 2D wheel positions when switching back to 3D. Fixed transition lerp to swap source/dest based on direction (isToWheel) #bug
- [x] TASK-155: Fix Flavor Trees not highlighting ingredients in LivingArchView. Added treeFilterIngredients prop and implemented filtering with dim/highlight logic + edge dimming #bug

## Enhancements

- [x] TASK-156: Clicking flavor label in 2D wheel now translates ingredients radially from center — high-pairing ingredients stay close, low-pairing push outward. Added XZ offset system alongside existing Y offsets #enhance
- [x] TASK-157: Made TasteRadar bigger (200→260px) with larger radius (75→90) and more label offset (20→28) to prevent pungent/salty cutoff. Font size 10→12 #enhance
- [x] TASK-158: Pushed 2D wheel innermost ingredients outward — baseRadius changed from 16 to 28, range compressed to 27 units. None in innermost ring, only highest-pairing in second ring #enhance
- [x] TASK-159: FlavorBridge connection path now highlights all path ingredients in the 3D view. Added onPathChange callback + bridgePathIngredients state. Path edges glow cyan, non-path dims #enhance
- [x] TASK-160: Edges now color-coded with source→target node color gradient (GPU interpolation). BASE_EDGE_DIM raised from 0.2→0.3 (50% brighter). Strength-based brightness boost added #enhance
