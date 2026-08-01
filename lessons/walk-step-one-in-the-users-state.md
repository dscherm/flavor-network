<!-- candidate-axes: verification -->
<!-- severity: high -->
<!-- applies-to: ux, verification, auth, mobile, debugging -->
<!-- tags: verification, user-journey, entry-point, signed-out, blind-spot -->
<!-- source: hand-authored -->
<!-- created: 2026-08-01 -->
<!-- project: flavor-network -->

# Lesson: Walk step one of the journey, in the user's actual state

## Problem

A user reported: *"I'm not able to push the parse recipe button on iOS."*

Two rounds of real fixes followed. A `disabled` prop that could trap the
button permanently. Auth errors swallowed into `console.error` so failures
were invisible. Both genuine, both shipped, neither the blocker.

The blocker, found only when the user finally said the plain thing —
*"There's not an option to sign in anywhere on the app"* — was that the
mobile bottom bar rendered **Make / Labs / How-to** and nothing else. The
only route to sign-in was:

```
Labs → popover → "Profile — Saved recipes & insights" → scroll → Sign in
```

Three levels deep, under a menu that reads as cocktail/sauce/recipe labs,
behind a row whose description never mentions an account. Nothing on that
path contains the words "sign in".

The URL import had required authentication since the day it shipped. So for
any signed-out user on mobile, the feature had been **unreachable for over
two months** — not broken, unreachable. And an entire session went into
repairing steps two and three of a path whose first step did not exist.

## Root cause

Every verification ran on a desktop browser where the session was already
authenticated. That state silently skips the entry point: an already-signed-
in tester never needs to find sign-in, so its absence is invisible no matter
how carefully the rest is tested.

The user's own bug report reinforced the blind spot. They described the
symptom they could see — a button that wouldn't respond — and that framing
was accepted as the scope. Taking the report at face value meant debugging
the deepest reachable step instead of asking how they got there, or whether
they could have.

Both failures share one shape: **the tester's state was not the user's
state**, and the difference lived entirely upstream of everything examined.

## Mitigation

1. **Traverse the journey from a cold start, in the user's state.** Signed
   out, fresh profile, real viewport. Not the screen that was reported —
   the first screen. Ask "could a new user even get here?" before "why did
   this fail?"
2. **When a feature has a precondition (auth, permission, subscription,
   onboarding), verify the precondition is REACHABLE**, not just enforced.
   Enforcing an auth requirement is easy to test; the path to satisfying it
   is easy to forget, and it is the one users hit first.
3. **Treat a bug report as the symptom, not the scope.** "The button doesn't
   work" is where the user noticed the problem, which is rarely where it
   starts. Ask what they were trying to do and reconstruct the whole path.
4. **Sign out before testing anything gated.** A persistent session is the
   single most common way a tester's environment stops resembling a user's.
5. **When a fix doesn't resolve the report, widen upstream instead of
   deeper.** Two consecutive fixes failing to unblock the user was the
   signal that the model of their situation was wrong — not an invitation
   to look harder at the same screen.

## Generalization

Verification inherits the state of whoever performs it. Anything already
true for the tester — signed in, onboarded, permissioned, cached, feature-
flagged — is invisible to them by construction. The parts of a product most
likely to be broken for real users are precisely the parts a developer
never has to traverse.

Related: [[every-layer-green-system-wrong]] (verified components, unverified
composition) and [[a-count-is-not-a-judgment]] (verified the shape, never
looked at the substance).
