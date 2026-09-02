---
title: Grepping `from '<pkg>'` to prove a package is unused misses dynamic `import()` — the build finds it for you
severity: medium
tags: [dependencies, npm-uninstall, dynamic-import, rollup, vite, grep, false-negative]
source: hand-authored
created: 2026-09-02
project: flavor-network
---

## Symptom

Six packages were removed after this returned only two files, both of
which imported a *different* package from the same scope:

```bash
grep -rn "from '@capacitor" src
# src/firebase.js:      from '@capacitor/core'
# src/hooks/useAuth.js: from '@capacitor/core'  / '@capacitor-firebase/authentication'
```

`npm run gate` then failed twice at once — a test file that imports the
module, and the production build:

```
[vite]: Rollup failed to resolve import "@capacitor/splash-screen"
        from "src/utils/native.js".
```

`src/utils/native.js` uses `import('@capacitor/splash-screen')`,
`import('@capacitor/status-bar')`, `import('@capacitor/haptics')` — dynamic
imports inside helper functions, written that way precisely so the web
bundle could tree-shake them. The grep pattern could not match them.

## Root cause

`from '<pkg>'` only matches static ESM imports. Dynamic `import('<pkg>')`,
CommonJS `require('<pkg>')`, `vi.mock('<pkg>')`, and bare strings in config
(`optimizeDeps.include`, `dedupe`) all reference a package without the word
`from`. A negative grep result on one syntactic form was read as "unused".

## Mitigation

1. Search for the bare package name, not an import form:
   `grep -rn "@scope/name" src vite.config.* package.json` — and read every
   hit, including comments, to see which are code.
2. Better: remove the dependency, then run the **build** and the **full
   test suite** before committing. The bundler's resolver is the only
   complete list of what is imported; a green build after removal is the
   proof, a clean grep is not.
3. When a removal must be partial (some packages of a scope stay),
   enumerate per package, not per scope — `@capacitor/core` staying tells
   you nothing about `@capacitor/haptics`.
4. If the package is kept only as an inert guard (a runtime
   `isNativePlatform()` check that is always false on the shipping
   platform), say so in the commit body so the next person does not repeat
   the removal attempt blind.

## Notes

`npm ls <pkg>` shows *installed* dependencies, not *imported* ones — it will
not catch this either. Only the bundler/test run does.
