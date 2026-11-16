/**
 * feedback.js — pure helpers for the "Send feedback" button (USAGE-4).
 *
 *   FEEDBACK_SCREENS        the fixed list of screens a note can come from; firestore.rules checks the same ids
 *   buildFeedback(...)      the document written to feedback/{auto}: exactly note, goal, lab, at.
 *                           Nothing identifying the sender is ever put in it (no uid, email, name or device id).
 *   feedbackLeft / recordFeedback
 *                           a courtesy limit of 3 notes per browser per day, kept in localStorage.
 *                           It stops accidents and idle repeats; clearing site data gets round it.
 */
export const FEEDBACK_SCREENS = ['labs', 'shared', 'cocktail', 'sauce', 'recipe', 'make', 'cookbook', 'pairing', 'wine', 'network', 'profile', 'other'];
export const NOTE_MAX = 500;
export const GOAL_MAX = 200;
export const FEEDBACK_PER_DAY = 3;
export const FEEDBACK_LIMIT_MESSAGE = 'You have already sent 3 notes today. Thank you, please try again tomorrow.';
const LIMIT_KEY = 'nf-feedback-sent';

const clean = (s, max) => String(s ?? '').replace(/[\u0000-\u001f\u007f‪-‮⁦-⁩]/g, ' ').trim().slice(0, max).trim();

/** Null when the note is empty. An unknown screen becomes 'other'. */
export function buildFeedback(note, goal, screen, now = Date.now()) {
  const n = clean(note, NOTE_MAX);
  if (!n) return null;
  return { note: n, goal: clean(goal, GOAL_MAX), lab: FEEDBACK_SCREENS.includes(screen) ? screen : 'other', at: now };
}

const dayOf = (now) => new Date(now).toISOString().slice(0, 10);

function read(storage, now) {
  try {
    const raw = JSON.parse(storage.getItem(LIMIT_KEY) || 'null');
    if (raw && raw.day === dayOf(now) && Number.isInteger(raw.count) && raw.count >= 0) return raw.count;
  } catch { /* unreadable counter: start from zero */ }
  return 0;
}

function defaultStorage() {
  try { return typeof localStorage !== 'undefined' ? localStorage : null; } catch { return null; }
}

/** { allowed, remaining } without counting anything. */
export function feedbackLeft(now = Date.now(), storage = defaultStorage()) {
  if (!storage) return { allowed: true, remaining: FEEDBACK_PER_DAY };
  const used = read(storage, now);
  return { allowed: used < FEEDBACK_PER_DAY, remaining: Math.max(0, FEEDBACK_PER_DAY - used) };
}

/** Call after a note was actually sent. */
export function recordFeedback(now = Date.now(), storage = defaultStorage()) {
  if (!storage) return;
  try { storage.setItem(LIMIT_KEY, JSON.stringify({ day: dayOf(now), count: read(storage, now) + 1 })); } catch { /* storage full or blocked */ }
}
