import { describe, it, expect } from 'vitest';
import { buildReport, recordReport, reportsLeft, REPORT_REASONS, NOTE_MAX } from '../shareReport.js';

const mem = () => { const m = {}; return { getItem: (k) => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); } }; };
const ID = 'abcdefghjk';
const T = Date.UTC(2026, 10, 15, 12);

describe('buildReport', () => {
  it('has exactly shareId, reason, note and at', () => {
    expect(buildReport(ID, 'spam', 'hi', T)).toEqual({ shareId: ID, reason: 'spam', note: 'hi', at: T });
    expect(Object.keys(buildReport(ID, 'other', '', T)).sort()).toEqual(['at', 'note', 'reason', 'shareId']);
  });
  it('refuses a bad id or an unknown reason', () => {
    expect(buildReport('short', 'spam', '', T)).toBeNull();
    expect(buildReport(ID, 'whatever', '', T)).toBeNull();
    expect(buildReport(ID, '', '', T)).toBeNull();
  });
  it('trims, caps the note at 300 and strips control characters', () => {
    expect(buildReport(ID, 'spam', '  a\u0000b‮ ', T).note).toBe('a b');
    expect(buildReport(ID, 'spam', 'x'.repeat(500), T).note.length).toBe(NOTE_MAX);
    expect(buildReport(ID, 'spam', undefined, T).note).toBe('');
  });
  it('lists the same reasons the rules allow', () => {
    expect(REPORT_REASONS.map((r) => r.id)).toEqual(['offensive', 'spam', 'private', 'not-recipe', 'picture', 'other']);
  });
});

describe('daily limit', () => {
  it('allows three and refuses the fourth', () => {
    const s = mem();
    for (let i = 0; i < 3; i++) { expect(reportsLeft(T, s).allowed).toBe(true); recordReport(T, s); }
    expect(reportsLeft(T, s)).toEqual({ allowed: false, remaining: 0 });
  });
  it('starts again the next day', () => {
    const s = mem();
    for (let i = 0; i < 3; i++) recordReport(T, s);
    expect(reportsLeft(T + 86400000, s).allowed).toBe(true);
  });
  it('treats unreadable storage as no reports yet, and a missing one as allowed', () => {
    const s = mem(); s.setItem('nf-share-reports', '{bad');
    expect(reportsLeft(T, s).allowed).toBe(true);
    expect(reportsLeft(T, null).allowed).toBe(true);
    expect(() => recordReport(T, { getItem() { throw new Error('x'); }, setItem() { throw new Error('x'); } })).not.toThrow();
  });
});
