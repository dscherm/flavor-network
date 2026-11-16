/**
 * shareReport.js — pure helpers for reporting a shared recipe (SHARE-7).
 *
 *   REPORT_REASONS          the fixed list of reasons; firestore.rules checks the same ids
 *   buildReport(...)        the document written to shareReports/{auto}: exactly shareId, reason, note, at.
 *                           Nothing identifying the reporter is ever put in it.
 *   reportsLeft / recordReport
 *                           a courtesy limit of 3 reports per browser per day, kept in localStorage.
 *                           It stops accidents and idle repeats; anyone who clears their storage can get round it.
 */
export const REPORT_REASONS = [
  { id: 'offensive', label: 'Offensive or abusive' },
  { id: 'spam', label: 'Spam or advertising' },
  { id: 'private', label: 'Private information' },
  { id: 'not-recipe', label: 'Not a recipe' },
  { id: 'picture', label: 'The picture' },
  { id: 'other', label: 'Something else' },
];
export const NOTE_MAX = 300;
export const REPORTS_PER_DAY = 3;
export const REPORT_LIMIT_MESSAGE = 'You have already sent 3 reports today. Please try again tomorrow.';
const LIMIT_KEY = 'nf-share-reports';

export function buildReport(shareId, reasonId, note, now = Date.now()) {
  if (!/^[a-z0-9]{10}$/.test(String(shareId))) return null;
  if (!REPORT_REASONS.some((r) => r.id === reasonId)) return null;
  const clean = String(note ?? '').replace(/[\u0000-\u001f\u007f‪-‮⁦-⁩]/g, ' ').trim().slice(0, NOTE_MAX);
  return { shareId: String(shareId), reason: reasonId, note: clean, at: now };
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
export function reportsLeft(now = Date.now(), storage = defaultStorage()) {
  if (!storage) return { allowed: true, remaining: REPORTS_PER_DAY };
  const used = read(storage, now);
  return { allowed: used < REPORTS_PER_DAY, remaining: Math.max(0, REPORTS_PER_DAY - used) };
}

/** Call after a report was actually sent. */
export function recordReport(now = Date.now(), storage = defaultStorage()) {
  if (!storage) return;
  try { storage.setItem(LIMIT_KEY, JSON.stringify({ day: dayOf(now), count: read(storage, now) + 1 })); } catch { /* storage full or blocked */ }
}
