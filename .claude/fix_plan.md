---
mode: bugfix-and-enhance
updated: 2026-03-22T10:00
---

# Flavor Network — Fix Plan (2026-03-22)

## Enhancements

- [x] TASK-161: Add edge brightness slider to Controls panel (range 0–200%, default 100%). Wire uBrightness uniform into edge shader in LivingArchView. #enhance
- [x] TASK-162: Add particle brightness slider to Controls panel (range 0–200%, default 100%). Wire uBrightness uniform into particle shader in LivingArchView. #enhance
- [x] TASK-163: Fix particle visibility toggle — particleMesh and particleMat now stored in stateRef, showParticles wired via useEffect. #bug

## Completed (prior)

- [x] TASK-153: Fix 3D/2D toggle disappearing on iOS when switching tabs or view modes #bug
- [x] TASK-154: Fix flavor labels staying at 2D wheel positions when switching back to 3D #bug
- [x] TASK-155: Fix Flavor Trees not highlighting ingredients in LivingArchView #bug
- [x] TASK-156: Clicking flavor label in 2D wheel translates ingredients radially #enhance
- [x] TASK-157: Made TasteRadar bigger to prevent label cutoff #enhance
- [x] TASK-158: Pushed 2D wheel innermost ingredients outward #enhance
- [x] TASK-159: FlavorBridge path highlighting in 3D view #enhance
- [x] TASK-160: Edge color-coding with source→target gradient #enhance
