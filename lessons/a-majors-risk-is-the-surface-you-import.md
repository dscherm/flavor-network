<!-- candidate-axes: procedure -->
<!-- severity: medium -->
<!-- applies-to: dependencies, npm, upgrades, node -->
<!-- tags: dependencies, semver, breaking-changes, upgrade, api-surface -->
<!-- source: hand-authored -->
<!-- created: 2026-08-01 -->
<!-- project: flavor-network -->

# Lesson: A major upgrade's risk is the surface you import, not the version number

## Problem

Every `firebase deploy` printed:

```
!  functions: package.json indicates an outdated version of firebase-functions.
!  functions: Please note that there will be breaking changes when you upgrade.
```

The warning had been deferred for months on the reasonable-sounding grounds
that a major with documented breaking changes is risky and deserves its own
pass. It sat, un-actioned, while the warning became background noise.

When the pass finally happened (2026-08-01), the actual work was ten minutes.
The whole dependency surface was **one import line**:

```ts
import { onCall, HttpsError, type CallableRequest } from 'firebase-functions/v2/https';
```

Checked against the complete v7.0.0 breaking-change list:

| breaking change | applies? |
|---|---|
| drop Node 16, min Node 18 | no — running Node 22 |
| remove `functions.config()` | no — never used it |
| TypeScript 5 / target ES2022 | no — tsconfig already ES2022 on TS 5.6 |
| async `onRequest` errors 500 in Emulator | no — `onCall`, not `onRequest` |
| v1 `Event` → `LegacyEvent` | no — v2 only |

**Zero of five applied.** The upgrade was clean on the first try.

## Root cause

"Major version" describes the *maintainer's* compatibility promise across
their entire API. It says nothing about the intersection of that API with
your code — and for most consumers that intersection is tiny. Treating the
version number as the risk estimate systematically overprices narrow
dependencies and underprices wide ones, and the overpriced ones are the ones
that rot: deferred indefinitely, warning ignored, eventually colliding with a
hard deadline (here, a runtime decommission) when there is no slack left.

The mirror error is just as real: a green test suite is not clearance either.
The tests here covered handler/parser/ssrf and never touched the `onCall`
wrapper — the one thing the upgrade could plausibly break.

## Mitigation

1. **Enumerate your real surface before estimating risk.**
   `grep -rn "<package>" src/` — every import, every symbol. That list, not
   the version delta, is the scope of the upgrade.
2. **Walk the breaking-change list item by item against that surface** and
   write down the verdict for each. If the answer is "none apply", the
   upgrade is routine and the deferral was the expensive choice.
3. **Check the peer range before assuming a cascade.** Here `firebase-admin`
   stayed put because v7's peer accepted `^11 || ^12 || ^13 || ^14`. A
   recommendation to also bump ("declare admin >= 14.2.0") is not a
   requirement — read the manifest, not the blog post.
4. **Verify the wrapper your unit tests don't cover.** Load the built
   artifact and assert the framework integration is intact — here, that
   `lib/index.js` still registered `__endpoint.callableTrigger` with the
   right timeout and memory — then confirm a clean cold start in the
   deployed logs. `tsc` passing and tests passing did not exercise that path.
5. **Do not bundle a major into a deadline patch.** Keeping the
   `firebase-functions` bump out of the Node runtime fix was correct — one
   changes behaviour, one changes a number, and mixing them means a rollback
   of either reverts both.

## Generalization

Estimate upgrade risk from the intersection of your code and theirs, and get
that estimate cheaply — it usually costs one grep. The habit of pricing risk
by version number is what turns a ten-minute upgrade into a year-old warning
that everyone has learned to scroll past.
