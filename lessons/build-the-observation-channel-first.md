<!-- candidate-axes: debugging -->
<!-- severity: high -->
<!-- applies-to: debugging, mobile, cross-platform, tooling -->
<!-- tags: observability, speculation, device-debugging, diagnostics -->
<!-- source: reflection/candidate -->
<!-- created: 2026-08-02 -->
<!-- project: flavor-network -->

# Lesson: When you cannot observe the surface, build the channel before theorising

## Problem

Sign-in failed inside a packaged Capacitor iOS app. The project is
developed on Windows: no Mac, therefore no Safari Web Inspector, no device
console, no attachable debugger. The only signal available was the user
describing what they saw.

Against that, roughly nine hypotheses were produced across a session —
`redirect_uri` mismatch, Services ID mismatch, unverified domain, missing
association file, nonce hashing, an invisible overlay intercepting taps,
stale bundled web assets, the build not running, the wrong build installed.
Several were checked and disproved. Two produced config changes that were
later reverted. Each cycle that needed device confirmation cost a commit,
a push, a CI build, TestFlight processing, an install, and a user report —
call it thirty minutes of wall clock and a context switch for the user.

What finally produced information was four lines of state rendered into the
UI:

```
1/4 calling native apple sheet
2/4 plugin returned: idToken=yes nonce=NO
3/4 exchanging credential with Firebase
4/4 signed in as <uid>
error code=1001 msg=...
```

The stage that fails to appear localises the fault immediately: stopping at
2/4 is the plugin, stopping at 3/4 is Firebase rejecting the credential, an
`error code=` line gives the raw code. It cost one small commit, and it was
built last.

## Root cause

Debugging defaulted to inference because inference was *available* and
observation felt blocked. "I can't see the device" was treated as a
constraint to reason around rather than a problem to solve. But the app is
a web view — it can render anything, including its own internal state. The
observation channel was always constructible; it just was not considered
until the hypothesis supply ran low.

There is also a seductive asymmetry: a hypothesis is free to generate and
feels like progress, while instrumentation feels like a detour that
produces no fix. On a surface you cannot inspect, that intuition inverts.
Each hypothesis costs a full verification round trip through another
person, and most hypotheses are wrong. Instrumentation costs one round trip
and makes every subsequent one decisive.

## Mitigation

1. **Ask early: can I see the failure, or only hear about it?** If only
   hear, the first commit should make the system report itself. Not the
   fifth.
2. **Price a hypothesis at its verification cost, not its generation
   cost.** When confirming a guess requires CI + store processing + an
   install + a human, guessing is the expensive option and measurement is
   the cheap one.
3. **Render state where the failure is visible.** A web view can print its
   own breadcrumbs; a native app can render a debug line; a server can log
   a stage marker. Prefer stage markers over a single error string — the
   stage that is missing is more informative than the message you get.
4. **Report the raw values, not a friendly summary.** `nonce=NO` and
   `code=1001` are diagnostic; "sign-in failed" is not. Keep the friendly
   message for the user and the raw one for the diagnosis.
5. **A second person in the loop is part of the cost.** Every speculative
   round trip spends someone else's attention. That alone justifies
   instrumentation earlier than feels natural.

## Generalization

Unobservable does not mean unobservable-in-principle; it usually means
nobody has built the channel yet. The instinct to reason harder when you
cannot see is exactly backwards — poor observability is the condition under
which reasoning is *least* reliable and most expensive to check.

Note the interaction with [[check-existence-before-debugging-correctness]]:
that lesson says look at the actual state before theorising about it. This
one covers the case where the actual state is not directly readable. The
answer is the same in both — get real state — but here you have to
manufacture the means first.

Related: [[measure-the-defect-before-fixing-it]],
[[walk-step-one-in-the-users-state]].
