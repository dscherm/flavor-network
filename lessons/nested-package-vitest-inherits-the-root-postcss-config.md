<!-- candidate-axes: procedure -->
<!-- severity: low -->
<!-- applies-to: vite, vitest, monorepo, javascript, typescript -->
<!-- tags: vitest, vite, postcss, tailwind, config-inheritance, sub-package -->
<!-- source: hand-authored -->
<!-- created: 2026-07-31 -->
<!-- project: flavor-network -->

# Lesson: A nested package's vitest run loads the repo-root PostCSS config

## Problem

Running vitest inside a sub-package aborts the **entire run** — not one
test, not one file — before any test executes:

```
Unhandled Rejection
Failed to load PostCSS config (searchPath: D:/Projects/flavor-network/functions):
  Loading PostCSS Plugin failed: Cannot find module 'tailwindcss'
  Require stack: - D:\Projects\flavor-network\postcss.config.js
```

Observed on **flavor-network 2026-07-31** running `npx vitest run` in
`functions/`. The give-away is in the message itself: the search path is
`functions/`, but the file it blames is the **repo root's**
`postcss.config.js`. These are node-side TypeScript tests for a Cloud
Function. There is no CSS anywhere near them.

## Root cause

Vite resolves PostCSS config by walking **upward** from the project root
until it finds one. A sub-package with no `postcss.config.js` of its own
therefore inherits the repo root's — which, in a typical React app, loads
`tailwindcss`. Tailwind is a dependency of the root `package.json`, not of
`functions/package.json`, so it resolves from neither `functions/node_modules`
nor the sub-package's hoisting scope, and the plugin load throws.

The failure is disproportionate because it happens during config
resolution, before the test graph is built — so it presents as an
unhandled rejection with no test output at all, rather than as a per-file
error. Nothing in the message suggests the tests themselves are healthy.

The trap generalizes past PostCSS: any upward-searching config resolution
(PostCSS, Babel, ESLint's older cascade) will reach across a package
boundary that the dependency graph does not.

## Mitigation

1. **Opt the sub-package out explicitly** in its own `vitest.config.ts`:

   ```ts
   export default defineConfig({
     // Vite searches upward and finds the repo root's postcss.config.js,
     // whose tailwindcss plugin isn't installed here. No CSS in these tests.
     css: { postcss: {} },
     test: { include: ['src/**/*.test.ts'], environment: 'node' },
   });
   ```

   `{}` means "an empty PostCSS config", which halts the upward search —
   distinct from omitting the key, which resumes it.
2. **Read the search path and the blamed file as two separate facts.**
   When they sit in different packages, the problem is config inheritance
   across a boundary, not a missing dependency. Installing `tailwindcss`
   into `functions/` would also have silenced this — and would have been
   the wrong fix, adding a CSS toolchain to a Cloud Function forever.
3. **Suspect this whenever a sub-package test run dies before emitting a
   single test result.** A config-resolution failure produces no test
   output; a real test failure always produces some.
