# Public API

Curated surface documentation for blind-TDD gated tasks. The blind test
writer's only view of the codebase beyond the task spec and `tests/`.

## src/lib/memoGuard.js

A pure source-scanning guard against the risky inline `React.memo`-at-export
pattern that can crash a Vite production build with a Temporal Dead Zone error
(no dev-mode symptom). Nothing here exists yet — it is the surface the current
gated task adds.

```js
export function hasRiskyMemoExport(source) // (source: string) => boolean
```

Returns `true` when `source` memoizes a component **inline at the export site**
— `export default memo(function C(){…})`, `export default memo(() => …)`, or the
`React.memo(…)` form of either. Returns `false` when `memo` wraps a
previously-declared identifier (`function C(){}; export default memo(C)`) or
when there is no memoization. It scans text; it does not execute the module.

### Import convention

flavor-network is an ESM Vite/React project tested with **vitest**. Import the
module under test with a relative path from the contract test:

```js
import { hasRiskyMemoExport } from '../../src/lib/memoGuard.js';
```
