import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

// Every button, text box, select and link in the invent panels and their shared pieces
// asks for a 44px target (min-h-[44px]); a bare checkbox must sit inside a label that does.
const dir = path.resolve(__dirname, '..');
const files = readdirSync(dir).filter((f) => /^[Ii]nvent.*\.jsx$/.test(f));

describe('invent panels: 44px targets', () => {
  it('finds the panels', () => { expect(files.length).toBeGreaterThan(8); });
  it('no control without a 44px minimum', () => {
    const bad = [];
    for (const f of files) {
      const lines = readFileSync(path.join(dir, f), 'utf8').split('\n');
      lines.forEach((l, i) => {
        if (!/<(button|input|select|textarea|a)\b/.test(l)) return;
        let blk = lines.slice(i, i + 5).join(' ');
        if (blk.includes('</')) blk = blk.slice(0, blk.indexOf('</'));
        if (/type="checkbox"/.test(l)) blk = lines.slice(Math.max(0, i - 2), i + 1).join(' ');
        if (!/min-h-\[44px\]/.test(blk)) bad.push(`${f}:${i + 1}`);
      });
    }
    expect(bad).toEqual([]);
  });
});
