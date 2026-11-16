/**
 * standInEntries.js — the builders for stand-in table entries, shared by kitchenSwaps.js (food) and
 * barStandIns.js (the bar). Pure; no table lives here. See kitchenSwaps.js for what each kind means.
 */
export const S = (forName, use, role, kind, extra = {}) => ({ for: forName, use, role, kind, plus: [], ...extra });
/** A two-way swap: a for b and b for a. */
export const both = (a, b, role, kind, extra = {}) => [S(a, b, role, kind, extra), S(b, a, role, kind, extra)];
/** The same thing in another form: dried thyme for fresh thyme. */
export const FORM = (forName, use, role, kind, extra = {}) => S(forName, use, role, kind, { type: 'form', ...extra });
/** Made from parts: parts[0] is `use`, the rest are `plus`. */
export const MAKE = (forName, parts, role, kind, extra = {}) => S(forName, parts[0], role, kind, { type: 'make', plus: parts.slice(1), ...extra });
/** Nothing replaces it; `reason` is one line saying why. `same` (a sentence) marks "it is all one thing under several names". */
export const NONE = (forName, reason, role = null, kind = null, extra = {}) => ({ for: forName, use: null, role, kind, plus: [], type: 'none', reason, ...extra });
