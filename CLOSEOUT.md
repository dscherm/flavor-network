# CLOSEOUT — Flavor Network v1.0.0

**Frozen 2026-09-01.** The web app at **https://neuralflavor.web.app** is the
finished product and the only distribution channel. This document is the
release note, the list of what is known not to work, and the map for anyone
who comes back to it — including future me.

Tag: `v1.0.0` · Bundle: `assets/index-DFFDS8PS.js` · Deployed: 2026-09-02 01:32 UTC (Firebase Hosting, 239 files)
Tag: `v1.0.1` · Bundle: `assets/index-BCzjul9s.js` · Deployed: 2026-09-02 10:25 UTC — landing/How-it-works copy now quotes the shipped counts (3,891 ingredients, 68,417 recipe-observed pairings). 
Tag: `v1.0.2` · Bundle: `assets/index-BHUdOK7y.js` · Deployed: 2026-09-02 22:05 UTC — Capacitor removed entirely; every scroll surface now stops above the fixed tab bar (the 'can't scroll to the bottom of a card' bug); Playwright playtest script added. 
Tag: `v1.0.3` · Bundle: `assets/index-D0QyKVkq.js` · Deployed: 2026-09-02 22:40 UTC — mobile polish pass (tinted cocktail/sauce cards, readable shelf counts, blank top band removed, radial pairing labels, radar labels inside the ring, one-row cookbook type filter, inactive labs unmounted from layout). Firebase browser API key now restricted to the site's origins (HTTP referrers). Live site runs v1.0.3.

## What v1.0.0 is

A browser app for cooks: 3,891 ingredients, 95,992 scored pairings
(68,417 observed in 2.2 M recipes, 27,575 model-predicted), 441 cocktails in six *Cocktail Codex*
families, 77 sauces in ten mother families, an on-device set-completion
model that proposes the next ingredient, and a molecular taste/odor model
that explains *why*. Four labs plus a make-a-recipe flow and a cookbook,
with optional Google/Apple sign-in to sync it. The README describes the
architecture; this file describes the state.

## Why web-only

An iOS build (Capacitor + Xcode + Codemagic + App Store listing) was
carried most of the way — signing worked, native Google/Apple sign-in was
wired and unit-tested — but the last mile needs a Mac, a device, and
App Store Connect access to verify, none of which this project has on
hand, and App Store review is an open-ended maintenance commitment for a
frozen app. The web app already installs to a phone home screen
(manifest + icons; see below), which is the "app" experience without the
store. Everything iOS lives on branch **`archive/ios`** at commit
`5a17cc2`: `ios/`, `capacitor.config.json`, `codemagic.yaml`,
`app-store-listing.md`, the two iOS skills. No Apple signing keys were
ever committed (verified: no `.p8`/`.p12`/`.mobileprovision` in history or
on disk). v1.0.2 then removed the `@capacitor/*` packages and every
`isNativePlatform()` branch from `src/` as well — the web build has no
native code paths left; haptics go through `navigator.vibrate`.

## What changed at the closeout

Twenty-one closeout commits (plus five pre-existing harness commits that
had never been pushed) between the last feature deploy (2026-08-02) and the
tag. No features. In order of consequence:

1. **The gate is an honest green.** It had been red since Aug 2 (a jsdom
   `scrollIntoView` unhandled error), masked by an exit-code bug in the
   check itself; it ran only `src/` (skipping 21 tests); and a fresh clone
   on Windows failed on CRLF + shebang. Now: `.gitattributes` forces LF,
   `npm run gate` runs all 132 files / 1,440 tests plus the build, and it
   no longer depends on the agent harness being present.
2. **One live bug fixed.** PDF/photo recipe import in the Profile panel
   posted to a dev-only endpoint and failed with a null-JSON error on the
   live site; it is now hidden outside `npm run dev` with a note.
3. **Deploy halved.** 64 dataset snapshot files (`*.bak`, `*.pregnn`,
   256 MB) were being uploaded to and served from the CDN. Deleted and
   excluded in `firebase.json`; `dist/` is ~223 MB.
4. **Repo a stranger can read.** ~1,300 tracked files of agent harness
   state, screenshots, logs, stale worktrees, phantom submodule entries,
   duplicate dataset copies and dead test scripts untracked or deleted;
   planning docs moved to `docs/archive/`; README rewritten; MIT LICENSE
   added; privacy policy re-scoped to the web app.
5. **Installable.** `manifest.webmanifest` + icons + apple-touch-icon.
   No service worker — on purpose. A cached shell that outlives a deploy
   is exactly the failure class that cost a session in August, and a
   frozen app gains nothing from offline launch that justifies it.

## Known limitations (not bugs to fix — the shape of the thing)

- **PDF/photo import is dev-only.** It needs the Express API and a Gemini
  key (`npm run api`). Recipe-by-URL works on the live site via the Cloud
  Function.
- **The molecular model is weak per-ingredient.** Compound-level taste/odor
  F1 looks good but does not survive aggregation to ingredients (chef-set
  AUROC ≈ 0.5). It drives radar charts and explanations; pairing strength
  comes from recipe co-occurrence. `.claude/.chemdataset-status.md` has the
  numbers and the experiments not to repeat (focal loss, DREAM olfaction,
  SMILES enumeration).
- **The 3D Network view is parked.** Reachable at `?path=explore`, not
  linked from the UI. 3,863 of 3,891 ingredients have layout positions;
  ~70 compound foods (mayonnaise, vinaigrette) have no molecular profile.
- **Salty and spicy heads are never surfaced** — structurally limited
  (ionic / TRPV1 mechanisms, not molecular structure).
- **`firebase.json` cache headers rely on `no-cache` for `index.html`**, so
  a deploy shows up within about a minute; a hard refresh may still be
  needed once.
- **Public data is large.** `public/` is ~220 MB and every byte of it is
  committed; the git clone is ~450 MB. History was deliberately not
  rewritten.
- **The Firebase browser API key is referrer-restricted** (v1.0.3) to
  `neuralflavor.web.app`, `neuralflavor.firebaseapp.com`, `localhost:5173`,
  `localhost:4173`, `127.0.0.1:5173`. A new dev port or domain must be added
  in Cloud Console → Credentials → "Browser key" before auth works there.
- **Auth configuration lives in consoles, not the repo.** Changing
  `authDomain` or adding a provider without registering the redirect URI
  first breaks sign-in for every user (it happened once); read
  `.claude/skills/firebase-auth/SKILL.md` before touching it.

## If you return — start here

1. `git clone` → `npm ci` → `npm run gate`. Green on a clean clone as of
   the tag (Node 24, Windows and the CRLF trap accounted for). If it isn't
   green, fix that before anything else; do not trust a build whose gate
   you haven't seen pass.
2. `npm run dev`, open http://localhost:5173, sign in, save a recipe, open
   the Cookbook. That exercises Firestore, Auth and the cookbook path that
   was the last bug fixed before the freeze.
3. Read `BACKLOG.md` for what was deliberately not built, and
   `docs/archive/RALPH-SPEC-flavor-profiles.md` for the largest un-built
   spec. The `.omc`/`.schermness` state dirs and `.claude/.ralph-*.md` are
   regenerated by the agent harness and are gitignored; `ralph.sh`,
   `plan.md`, `activity.md`, `public_api.md` and `lessons/` are kept so the
   project stays enrollable in that harness. They are inert otherwise.
4. Deploy is `npm run gate && firebase deploy --only hosting`. Functions
   and Firestore rules deploy separately; see README.
5. Datasets: nothing needs regenerating to run or deploy. The pipelines
   and their raw inputs (RecipeNLG CSV from Kaggle, FooDB dump) are
   documented in the README; `proDataset/raw/` and `chemDataset/raw/` are
   gitignored and can be deleted locally (~7 GB) without losing anything
   the app needs.

## Process notes worth keeping

Three things that were true at the end and would have been cheaper to
know at the start:

- *A check that cannot fail is not evidence.* The gate was green for a
  month while broken, because `npm run build | tail -1` reports `tail`'s
  exit code. Every "verified" between Aug 2 and the closeout was a manual
  browser check, not the gate.
- *Read the live state before theorising.* The cookbook bug
  (`userProfile.recipes` vs `userProfile.profile.recipes`) was found in a
  minute by reading props in the running app after two rounds of
  reasoning about the plumbing had produced a plausible, wrong fix.
- *Scoped runners shrink silently.* `vitest run src/` looked complete and
  omitted a directory; `tests/` looked like a suite and was never run by
  anything. The unscoped run and the include globs are the only truth.
