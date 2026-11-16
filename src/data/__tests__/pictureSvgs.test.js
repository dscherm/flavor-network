// @vitest-environment node
// PICTURE-4. The generated drawing map (src/data/pictureSvgs.generated.js and its copy in functions/) is current and complete.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildPictureSvgs, pictureSvgsModule } from '../../../scripts/buildShareIndex.mjs';
import { allPictureIds } from '../../components/pictureArt.jsx';
import { PICTURE_SVGS } from '../pictureSvgs.generated.js';

const ROOT = resolve(__dirname, '../../..');
const read = (p) => readFileSync(resolve(ROOT, p), 'utf8');

describe('picture drawings for the share cards', () => {
  it('has a standalone SVG for every id the chooser offers, and nothing else', () => {
    expect(Object.keys(PICTURE_SVGS).sort()).toEqual([...allPictureIds()].sort());
    for (const svg of Object.values(PICTURE_SVGS)) {
      expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"')).toBe(true);
      expect(svg).toContain('viewBox=');
      expect(svg).not.toMatch(/data-testid|aria-hidden|style=/);
    }
  });

  it('the committed app and functions copies are up to date (run scripts/buildShareIndex.mjs)', async () => {
    const svgs = await buildPictureSvgs();
    expect(read('src/data/pictureSvgs.generated.js')).toBe(pictureSvgsModule(svgs));
    expect(read('functions/src/share/pictureSvgs.generated.ts')).toBe(pictureSvgsModule(svgs, { ts: true }));
  }, 60_000);
});
