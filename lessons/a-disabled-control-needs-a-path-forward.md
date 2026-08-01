<!-- candidate-axes: design -->
<!-- severity: medium -->
<!-- applies-to: ux, react, forms, auth -->
<!-- tags: ux, dead-end, disabled-state, silent-failure, react-state -->
<!-- source: hand-authored -->
<!-- created: 2026-08-01 -->
<!-- project: flavor-network -->

# Lesson: Never disable a control whose re-enabling depends on something that can fail silently

## Problem

A recipe-import screen asked signed-out users to sign in before fetching a
URL. To signal that, the Parse button was disabled while the sign-in prompt
showed:

```jsx
<button onClick={handleParseUrl} disabled={needsSignIn}>Parse recipe</button>
```

`needsSignIn` was set when a queued parse resolved to a signed-out user, and
cleared **only** by a successful sign-in or by pressing Back. Sign-in used
`signInWithPopup`, which Safari on iOS routinely blocks — and the failure
was swallowed into `console.error`, so nothing appeared on screen.

The resulting sequence, reported from an iPhone as *"I'm not able to push
the parse recipe button"*:

1. Tap **Parse** → sign-in panel appears, Parse greys out
2. Tap **Sign in** → popup blocked, no error rendered, nothing changes
3. Parse is now **permanently unpressable**, with the only escape an
   unlabelled Back the user has no reason to try

A second trap sat underneath: even un-disabled, re-tapping would have done
nothing. The handler wrote `setPendingParseUrl(sameString)`; React bails on
identical state, so the effect never re-ran and the tap was swallowed.

This was strictly worse than what it replaced. The previous version gave a
25-second spinner and an error screen — slow and ugly, but *escapable*.

## Root cause

Disabling encodes a promise: *this will become available when a condition is
met.* That promise is only honest when the condition is guaranteed to
resolve, or when its failure is visible. Here neither held — the enabling
condition depended on a third-party popup that fails routinely and, at the
time, silently.

A disabled control is also uniquely bad at communicating. It cannot report
why it is disabled, it cannot be retried, and it removes the affordance the
user would have used to discover the problem. Combined with a silent
failure, it converts "something went wrong" into "this app is broken".

The React state-identity trap is the same failure in a different register:
an action that appears to do something but writes state indistinguishable
from the current state is, to the user, another dead control.

## Mitigation

1. **Don't disable when the enabling condition can fail silently.** Leave
   the control live and let it re-attempt. A button that retries and
   re-explains beats one that cannot be pressed.
2. **If you must disable, guarantee a visible exit** — a labelled Cancel, a
   timeout that re-enables, or an error that tells the user what to do. A
   disabled control with no explanation and no escape is a trap, not a hint.
3. **Never swallow the failure of an action a disabled state depends on.**
   `catch (err) { console.error(err) }` on a phone is indistinguishable from
   nothing happening at all — the user has no console.
4. **Make repeat actions genuinely repeatable.** If a retry writes state
   equal to current state, React (or any diffing renderer) elides it. Carry
   an attempt counter or a fresh object so every invocation is distinct.
5. **When replacing a slow-but-escapable path, check the new one is still
   escapable.** Speed is not the only axis; a fast dead end is a regression.

## Generalization

Disabling is a promise about the future. Before making it, ask what happens
if the condition never arrives — and whether the user will be able to tell.
If the answer is "they are stuck with no signal", the control should stay
enabled and fail loudly instead.

Related: [[walk-step-one-in-the-users-state]] — this shipped because it was
only ever exercised on a desktop where the popup succeeds.
