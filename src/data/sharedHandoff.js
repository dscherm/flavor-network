/**
 * sharedHandoff.js — the two small things the public shared-recipe page leaves in
 * sessionStorage (the page lives outside <App/>, so it cannot pass props):
 *
 *   'shared-pending-save'   { kind, slug, at }   a Save waiting on sign-in. Written when a
 *                           sign-in starts, cleared on success, cancel and error; survives
 *                           the page reload of the redirect sign-in. Ignored after 10 minutes.
 *   'shared-invent-seed'    { lab, seed, at }    "Make it your own": the Invent seed for one lab
 *                           ('cocktail' | 'sauce' | 'make'). App reads it ONCE on start-up and removes it.
 * Every storage call is wrapped: storage can be blocked or full.
 */
export const PENDING_KEY = 'shared-pending-save';
export const SEED_KEY = 'shared-invent-seed';
export const LAB_PATH = Object.freeze({ cocktail: 'cocktail', sauce: 'sauce', make: 'make' });
const MAX_AGE_MS = 10 * 60 * 1000;

const store = () => { try { return typeof sessionStorage === 'undefined' ? null : sessionStorage; } catch { return null; } };

function read(key, now) {
  const s = store();
  if (!s) return null;
  try {
    const v = JSON.parse(s.getItem(key));
    if (!v || typeof v !== 'object' || !Number.isFinite(v.at) || now - v.at > MAX_AGE_MS) return null;
    return v;
  } catch { return null; }
}
function write(key, value) {
  const s = store();
  if (!s) return false;
  try { s.setItem(key, JSON.stringify(value)); return true; } catch { return false; }
}
function remove(key) { try { store()?.removeItem(key); } catch { /* storage blocked */ } }

export const setPendingSave = ({ kind, slug }, now = Date.now()) => write(PENDING_KEY, { kind, slug, at: now });
export function readPendingSave(now = Date.now()) {
  const v = read(PENDING_KEY, now);
  return v && typeof v.kind === 'string' && typeof v.slug === 'string' ? { kind: v.kind, slug: v.slug } : null;
}
export const clearPendingSave = () => remove(PENDING_KEY);

export const stashInventSeed = (lab, seed, now = Date.now()) => (LAB_PATH[lab] && seed ? write(SEED_KEY, { lab, seed, at: now }) : false);
/** Read and remove the stashed seed: { lab, seed } or null. */
export function takeInventSeed(now = Date.now()) {
  const v = read(SEED_KEY, now);
  remove(SEED_KEY);
  return v && LAB_PATH[v.lab] && v.seed && typeof v.seed === 'object' ? { lab: v.lab, seed: v.seed } : null;
}
