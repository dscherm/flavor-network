// LOOK-8 contract tests (blind): favicon, PNG icons and the unused painted logo. Written from plan.md
// (LOOK-8 AC-4..AC-6) and the approved brief .schermness/design/LOOK-8.md (section 3.4, the small-size cut).
//
// Fixtures: iconHashesBefore.json holds the sha256 of the four PNG icons before LOOK-8; hatPaths.json the
// pre-LOOK-8 hat path `d` strings (the small-size cut reuses the same hat paths, scaled by a transform).
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../../..');
const pub = (rel) => resolve(ROOT, 'public', rel);
const HAT = JSON.parse(readFileSync(resolve(HERE, 'hatPaths.json'), 'utf8')).paths;
const BEFORE = JSON.parse(readFileSync(resolve(HERE, 'iconHashesBefore.json'), 'utf8')).sha256;
const norm = (s) => String(s || '').replace(/\s+/g, ' ').trim();

describe('LOOK-8 AC-4: favicon.svg draws the flask with the hat, no atom', () => {
  const text = readFileSync(pub('favicon.svg'), 'utf8');

  // Covers: AC-4
  it('has no atom or orbit drawing', () => {
    expect(text).not.toMatch(/<ellipse\b/i);
    expect(text).not.toMatch(/\batoms?\b|\belectrons?\b|\bnucleus\b|\borbits?\b|\borbital\b|rutherford/i);
    expect(text).not.toMatch(/radialGradient/i);
  });

  // Covers: AC-4
  it('parses as an svg with a square viewBox on the slate ground', () => {
    const doc = new DOMParser().parseFromString(text, 'image/svg+xml');
    expect(doc.getElementsByTagName('parsererror').length).toBe(0);
    const svg = doc.documentElement;
    expect(svg.tagName.toLowerCase()).toBe('svg');
    const vb = (svg.getAttribute('viewBox') || '').trim().split(/[\s,]+/).map(Number);
    expect(vb.length).toBe(4);
    expect(vb[2]).toBeGreaterThan(0);
    expect(vb[2]).toBe(vb[3]);
    expect(text.toLowerCase()).toContain('#0a0a0a');
    expect(text.toLowerCase()).not.toContain('#0d1f38');
  });

  // Covers: AC-4
  it('draws the hat (same hat paths) and a flask in the logo colours', () => {
    const doc = new DOMParser().parseFromString(text, 'image/svg+xml');
    const ds = new Set([...doc.getElementsByTagName('path')].map((p) => norm(p.getAttribute('d'))));
    for (const name of ['puffs', 'band']) {
      expect(ds.has(HAT[name]), `hat path "${name}" not in favicon`).toBe(true);
    }
    expect(text, 'the flask is not named (data-part="flask", an id or a comment)').toMatch(/flask/i);
    expect(text.toLowerCase()).toContain('#8fa274');
    expect(text.toLowerCase()).toContain('#f2a93b');
  });
});

function pngSize(buf) {
  const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  sig.forEach((b, i) => expect(buf[i], 'not a PNG').toBe(b));
  expect(buf.toString('ascii', 12, 16)).toBe('IHDR');
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}

describe('LOOK-8 AC-5: PNG icons redrawn at their sizes', () => {
  // Covers: AC-5
  it.each([
    ['icon-192.png', 192],
    ['icon-512.png', 512],
    ['icon-512-maskable.png', 512],
    ['apple-touch-icon.png', 180],
  ])('%s is %ipx square and differs from its pre-LOOK-8 bytes', (file, size) => {
    const p = pub(`icons/${file}`);
    expect(existsSync(p), `${file} missing`).toBe(true);
    const buf = readFileSync(p);
    expect(pngSize(buf)).toEqual({ w: size, h: size });
    const hash = createHash('sha256').update(buf).digest('hex');
    expect(BEFORE[file]).toMatch(/^[0-9a-f]{64}$/);
    expect(hash, `${file} unchanged since before LOOK-8`).not.toBe(BEFORE[file]);
  });
});

describe('LOOK-8 AC-6: the unused painted logo is gone', () => {
  // Covers: AC-6
  it('public/fn-logo-chalk.png no longer exists', () => {
    expect(existsSync(pub('fn-logo-chalk.png'))).toBe(false);
  });
});
