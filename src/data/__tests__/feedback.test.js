import { describe, it, expect } from 'vitest';
import { buildFeedback, feedbackLeft, recordFeedback, FEEDBACK_SCREENS, NOTE_MAX, GOAL_MAX } from '../feedback.js';

const mem = () => { const m = {}; return { getItem: (k) => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); } }; };
const T = Date.UTC(2026, 10, 16, 12);

describe('buildFeedback', () => {
  it('has exactly note, goal, lab and at', () => {
    expect(buildFeedback('Nice', 'cook', 'labs', T)).toEqual({ note: 'Nice', goal: 'cook', lab: 'labs', at: T });
    expect(Object.keys(buildFeedback('Nice', '', 'shared', T)).sort()).toEqual(['at', 'goal', 'lab', 'note']);
  });
  it('refuses an empty or blank note', () => {
    expect(buildFeedback('', 'x', 'labs', T)).toBeNull();
    expect(buildFeedback('   \n ', 'x', 'labs', T)).toBeNull();
    expect(buildFeedback(undefined, 'x', 'labs', T)).toBeNull();
  });
  it('trims, strips control characters and caps both texts', () => {
    expect(buildFeedback('  a\u0000b‮ ', ' g ', 'labs', T)).toMatchObject({ note: 'a b', goal: 'g' });
    expect(buildFeedback('x'.repeat(900), 'y'.repeat(900), 'labs', T)).toMatchObject({ note: 'x'.repeat(NOTE_MAX), goal: 'y'.repeat(GOAL_MAX) });
    expect(buildFeedback('n', undefined, 'labs', T).goal).toBe('');
  });
  it('maps an unknown screen to other, so no URL or id can be written', () => {
    expect(buildFeedback('n', '', 'https://x.test/?path=cocktail&id=9', T).lab).toBe('other');
    expect(FEEDBACK_SCREENS).toContain('other');
  });
  it('never carries identity, even when a signed-in user object is around', () => {
    const user = { uid: 'secret-uid', email: 'a@b.co', displayName: 'Dan' };
    const fb = buildFeedback('hello', 'goal', 'labs', T, user);
    expect(Object.keys(fb).sort()).toEqual(['at', 'goal', 'lab', 'note']);
    expect(JSON.stringify(fb)).not.toMatch(/secret-uid|a@b\.co|Dan/);
  });
});

describe('daily limit', () => {
  it('allows three and refuses the fourth', () => {
    const s = mem();
    for (let i = 0; i < 3; i++) { expect(feedbackLeft(T, s).allowed).toBe(true); recordFeedback(T, s); }
    expect(feedbackLeft(T, s)).toEqual({ allowed: false, remaining: 0 });
  });
  it('starts again the next day', () => {
    const s = mem();
    for (let i = 0; i < 3; i++) recordFeedback(T, s);
    expect(feedbackLeft(T + 86400000, s).allowed).toBe(true);
  });
  it('is separate from the report limit', () => {
    const s = mem();
    s.setItem('nf-share-reports', JSON.stringify({ day: '2026-11-16', count: 3 }));
    expect(feedbackLeft(T, s).allowed).toBe(true);
  });
  it('treats unreadable storage as none yet, and a missing one as allowed', () => {
    const s = mem(); s.setItem('nf-feedback-sent', '{bad');
    expect(feedbackLeft(T, s).allowed).toBe(true);
    expect(feedbackLeft(T, null).allowed).toBe(true);
    expect(() => recordFeedback(T, { getItem() { throw new Error('x'); }, setItem() { throw new Error('x'); } })).not.toThrow();
  });
});
