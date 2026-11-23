// LOOK-6 contract tests (blind): AC-5, the TYPE role set in src/data/chalkTheme.js.
// Written from plan.md (LOOK-6 AC-5, as changed by the owner on 2026-11-23: the hand reverts from Kalam
// to Caveat) and the brief .schermness/design/LOOK-6.md section 3.3. chalkTheme.js was not read.
//
// Assumed shape (brief 3.3 and plan.md public_surface):
//   export const HAND  // a CSS font-family string naming Caveat
//   export const TEXT  // a CSS font-family string naming Alegreya Sans
//   export const TYPE = { display, heading, drawn, body, control, small }  // React style objects
// Weights may be numbers or numeric strings; a missing fontWeight is read as 400 ("normal").
import { describe, it, expect } from 'vitest';
import { TYPE, HAND, TEXT } from '../../../src/data/chalkTheme.js';

const HAND_ROLES = ['display', 'heading', 'drawn'];
const TEXT_ROLES = ['body', 'control', 'small'];

function weight(role) {
  const w = role.fontWeight;
  if (w === undefined || w === null || w === 'normal') return 400;
  if (w === 'bold') return 700;
  return Number(w);
}

describe('LOOK-6 AC-5: TYPE roles in chalkTheme.js', () => {
  // Covers: AC-5
  it('HAND names Caveat (not Kalam) and TEXT names Alegreya Sans', () => {
    expect(typeof HAND).toBe('string');
    expect(typeof TEXT).toBe('string');
    expect(HAND).toMatch(/Caveat/);
    expect(HAND).not.toMatch(/Kalam/i);
    expect(TEXT).toMatch(/Alegreya Sans/);
  });

  // Covers: AC-5
  it('TYPE has the six roles display, heading, drawn, body, control and small', () => {
    expect(TYPE && typeof TYPE).toBe('object');
    for (const r of [...HAND_ROLES, ...TEXT_ROLES]) {
      expect(TYPE[r], `TYPE.${r} missing`).toBeTruthy();
    }
  });

  // Covers: AC-5
  it.each(HAND_ROLES)('TYPE.%s uses HAND (Caveat) at weight 400 or 700', (r) => {
    expect(TYPE[r].fontFamily).toBe(HAND);
    expect([400, 700]).toContain(weight(TYPE[r]));
  });

  // Covers: AC-5
  it.each(TEXT_ROLES)('TYPE.%s uses TEXT (Alegreya Sans) at a weight below 600', (r) => {
    expect(TYPE[r].fontFamily).toBe(TEXT);
    expect(weight(TYPE[r])).toBeLessThan(600);
  });

  // Covers: AC-5
  it('TYPE.control has weight 500', () => {
    expect(weight(TYPE.control)).toBe(500);
  });

  // Covers: AC-5
  it.each(TEXT_ROLES)('TYPE.%s carries lining-nums tabular-nums', (r) => {
    const v = String(TYPE[r].fontVariantNumeric || '');
    expect(v).toMatch(/lining-nums/);
    expect(v).toMatch(/tabular-nums/);
  });

  // Covers: AC-5
  it('no role in TYPE names Kalam anywhere', () => {
    expect(JSON.stringify(TYPE)).not.toMatch(/Kalam/i);
  });
});
