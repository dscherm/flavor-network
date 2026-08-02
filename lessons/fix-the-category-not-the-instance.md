<!-- candidate-axes: debugging -->
<!-- severity: high -->
<!-- applies-to: debugging, error-handling, refactoring -->
<!-- tags: silent-failure, category-bugs, incomplete-fix, churn-after-done -->
<!-- source: reflection/candidate -->
<!-- created: 2026-08-02 -->
<!-- project: flavor-network -->

# Lesson: Fixing a category means enumerating the category, not the instance

## Problem

A sign-in helper swallowed errors silently:

```js
const USER_CANCELLED = /cancel|abort|1001|user closed/i;
if (USER_CANCELLED.test(err?.message ?? '')) return false;   // no authError
```

WEBLINK-17 diagnosed this correctly and fixed it well: message-substring
matching became exact-code matching, an explicit assertion was added that
the credential exchange produced a session, and the commit message argued —
convincingly — that a swallowed real error costs hours while a spurious
message after a real cancel costs nothing.

Then it kept `'1001'` in the silent set.

```js
const USER_CANCELLED_CODES = new Set([
  'auth/cancelled-popup-request',
  'auth/popup-closed-by-user',
  'auth/user-cancelled',
  '1001',                       // <- the survivor
]);
```

Hours later, on the build containing that fix, a device reported: Face ID
appears, Face ID completes, nothing happens, **no error message**. Apple
returns `ASAuthorizationError.canceled` (1001) both for a sheet the user
dismissed and for an authorization the system aborted — an entitlement or
configuration failure is indistinguishable from a cancel in JS. Face ID
completing proves it was not a dismissal.

So the one code Apple overloads was the one code still swallowed. The fix
for silent failures shipped with a silent failure inside it, and the whole
build-install-test-report cycle had to run again to find that out.

## Root cause

The fix was scoped to the *instances observed* rather than to the
*category named*. The category was "errors that vanish without surfacing".
Every member of the silent set was a member of that category, but only the
ones that had already misfired got scrutiny. `1001` was carried across from
the old regex without being re-argued, because it looked like the least
controversial entry — it is literally the cancel code.

The reasoning that justified the fix actually applied to `1001` too, and
would have caught it. The commit argued "when uncertain, SHOW the error."
1001 is the single most uncertain code in the set, since it is documented
to mean two different things. The principle was stated and then not applied
to the one entry that most needed it.

Two aggravators worth naming:

1. **The survivor looked safest.** Entries that seem obviously correct get
   the least review, which is exactly inverted from where review pays.
2. **Carrying values across a rewrite feels like preservation, not a
   decision.** Every entry that survives a rewrite is a fresh assertion,
   even when the diff shows it unchanged.

## Mitigation

1. **Name the category, then list its members and justify each survivor.**
   For a silent-failure fix that means: enumerate every path that can
   return without surfacing, and write down why each remaining one is safe.
   If the justification cannot be written, the path should surface.
2. **Apply the fix's own stated principle to every member.** If the commit
   message says "when uncertain, show it", grep the result for entries that
   are uncertain. Stated principles are testable against the diff.
3. **Treat a carried-over value as a new decision.** "It was already there"
   is not a reason; it is the absence of one.
4. **Suspect the entry that looks least controversial.** In a set of
   special cases, the one nobody would question is the one that has not
   been questioned.
5. **When a fix targets a class, its test should cover the class.** The
   WEBLINK-17 tests covered message-matching thoroughly and never asked
   "which codes remain silent, and should they be?"

## Generalization

An incomplete fix for a category bug is more dangerous than no fix, because
it consumes the attention the bug would otherwise keep attracting. Everyone
downstream — including the author — now believes the class is handled, so
the surviving member's next failure gets attributed anywhere but here. That
is what happened: with 1001 still silent, the device's behaviour was
indistinguishable from "the fix never reached the build", and time went
into verifying the build pipeline instead.

Related: [[check-existence-before-debugging-correctness]] (same session,
same failure of scope — checking the value rather than whether it existed),
and [[measure-the-defect-before-fixing-it]].
