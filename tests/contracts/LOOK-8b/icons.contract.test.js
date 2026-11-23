// LOOK-8b contract tests (blind): favicon and PNG icons re-rendered for the chalk-blue liquid.
// Written from plan.md (LOOK-8b AC-5) and the brief .schermness/design/LOOK-8b.md.
//
// Fixture: iconHashesBefore.json holds the sha256 of the four PNG icons as LOOK-8 left them (148809c),
// recorded by the test writer before the LOOK-8b build.
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../../..');
const pub = (rel) => resolve(ROOT, 'public', rel);
const BEFORE = JSON.parse(readFileSync(resolve(HERE, 'iconHashesBefore.json'), 'utf8')).sha256;

describe('LOOK-8b AC-5: favicon.svg uses the chalk-blue liquid', () => {
  const text = readFileSync(pub('favicon.svg'), 'utf8').toLowerCase();

  // Covers: AC-5
  it('contains #5b9fd6', () => {
    expect(text).toContain('#5b9fd6');
  });

  // Covers: AC-5
  it('no longer contains the orange #f2a93b', () => {
    expect(text).not.toContain('#f2a93b');
  });
});

function pngSize(buf) {
  const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  sig.forEach((b, i) => expect(buf[i], 'not a PNG').toBe(b));
  expect(buf.toString('ascii', 12, 16)).toBe('IHDR');
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}

describe('LOOK-8b AC-5: PNG icons re-rendered at the same sizes', () => {
  // Covers: AC-5
  it.each([
    ['icon-192.png', 192],
    ['icon-512.png', 512],
    ['icon-512-maskable.png', 512],
    ['apple-touch-icon.png', 180],
  ])('%s is %ipx square and differs from its LOOK-8 bytes', (file, size) => {
    const p = pub(`icons/${file}`);
    expect(existsSync(p), `${file} missing`).toBe(true);
    const buf = readFileSync(p);
    expect(pngSize(buf)).toEqual({ w: size, h: size });
    const hash = createHash('sha256').update(buf).digest('hex');
    expect(BEFORE[file]).toMatch(/^[0-9a-f]{64}$/);
    expect(hash, `${file} unchanged since LOOK-8`).not.toBe(BEFORE[file]);
  });
});
