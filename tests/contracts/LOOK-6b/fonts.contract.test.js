// @vitest-environment node
// LOOK-6b contract tests (blind): written from plan.md (LOOK-6b acceptance_criteria AC-1, AC-2, AC-7) and
// the approved brief .schermness/design/LOOK-6b.md (sections 3.1, 5, 6 "Font files", 10 tests 1-3 and 7).
// No implementation file under src/ or functions/src/ was read; the scans read files as text at test time.
//
//   AC-1  src/data/shareCardCanvas.js and functions/src/share/*.ts (not tests) name no system-ui,
//         -apple-system, Segoe UI, Roboto, quoted Inter, Georgia (as a face), Palatino or JetBrains on a
//         code line; the LOOK-6 contract no longer lists shareCardCanvas.js as an exception.
//   AC-2  functions/fonts/ holds Caveat, alegreya-sans-lining 400 and 500 woff, LICENSE-alegreya-sans.txt
//         and LICENSE-caveat.txt and no inter-* file; public/fonts and functions/fonts lining copies are
//         byte-equal.
//   AC-7  in both lining woffs, U+0030-0039 map to zero.tf .. nine.tf, the glyph count equals the
//         fontsource source file's, and the family name is "Alegreya Sans Lining".
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readWoff } from './_woff.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../../..');
const FN_FONTS = path.join(ROOT, 'functions', 'fonts');
const PUB_FONTS = path.join(ROOT, 'public', 'fonts');
const SHARE_DIR = path.join(ROOT, 'functions', 'src', 'share');
const CANVAS = 'src/data/shareCardCanvas.js';
const LOOK6_CONTRACT = path.join(ROOT, 'tests', 'contracts', 'LOOK-6', 'fonts.contract.test.js');
const LINING = ['alegreya-sans-lining-latin-400-normal.woff', 'alegreya-sans-lining-latin-500-normal.woff'];
const SOURCE = (w) => path.join(ROOT, 'node_modules', '@fontsource', 'alegreya-sans', 'files', `alegreya-sans-latin-${w}-normal.woff`);

const read = (abs) => fs.readFileSync(abs, 'utf8');
const rel = (abs) => path.relative(ROOT, abs).split(path.sep).join('/');

// Same comment rules as tests/contracts/LOOK-6: a comment may name a banned face, a code line may not.
function codeLines(text) {
  const lines = text.split(/\r?\n/);
  const out = [];
  let inBlock = false;
  lines.forEach((line, i) => {
    const trimmed = line.trim();
    if (inBlock) {
      if (trimmed.includes('*/')) inBlock = false;
      return;
    }
    if (trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*') || trimmed.startsWith('{/*')) {
      const open = trimmed.lastIndexOf('/*');
      const close = trimmed.lastIndexOf('*/');
      if (open !== -1 && close < open) inBlock = true;
      return;
    }
    let code = line.replace(/\/\*.*?\*\//g, '');
    const open = code.indexOf('/*');
    if (open !== -1) {
      code = code.slice(0, open);
      inBlock = true;
    }
    code = code.replace(/(^|[^:])\s\/\/(?!\/).*$/, '$1');
    out.push({ lineNo: i + 1, code });
  });
  return out;
}

const BANNED_FACES = [
  { label: 'system-ui', re: /system-ui/i },
  { label: '-apple-system', re: /-apple-system/i },
  { label: 'Segoe UI', re: /Segoe\s+UI/i },
  { label: 'Roboto', re: /\bRoboto\b/i },
  { label: "'Inter' (quoted face)", re: /(['"`])Inter\1|\\"Inter\\"/ },
  { label: 'Inter as a font file', re: /\binter-latin-\d+/i },
  { label: 'Georgia (as a face)', re: /^(?=.*\bGeorgia\b)(?=.*(font|serif)).*/i },
  { label: 'Palatino', re: /Palatino/i },
  { label: 'JetBrains', re: /JetBrains/i },
];

function scan(files) {
  const hits = [];
  for (const { file, text } of files) {
    for (const { lineNo, code } of codeLines(text)) {
      for (const p of BANNED_FACES) if (p.re.test(code)) hits.push(`${file}:${lineNo} [${p.label}] ${code.trim().slice(0, 140)}`);
    }
  }
  return hits;
}

const shareTs = () =>
  fs
    .readdirSync(SHARE_DIR)
    .filter((n) => n.endsWith('.ts') && !/\.(test|spec)\.ts$/.test(n) && !n.endsWith('.d.ts'))
    .sort()
    .map((n) => ({ file: rel(path.join(SHARE_DIR, n)), text: read(path.join(SHARE_DIR, n)) }));

describe('LOOK-6b AC-1: no system stack or Inter in either card renderer', () => {
  // Covers: AC-1
  it('finds the files to scan (guards against an empty scan)', () => {
    expect(fs.existsSync(path.join(ROOT, CANVAS))).toBe(true);
    const ts = shareTs().map((f) => f.file);
    expect(ts).toContain('functions/src/share/card.ts');
    expect(ts).toContain('functions/src/share/handler.ts');
  });

  // Covers: AC-1
  it('src/data/shareCardCanvas.js and functions/src/share/*.ts name no banned face on a code line', () => {
    const files = [{ file: CANVAS, text: read(path.join(ROOT, CANVAS)) }, ...shareTs()];
    const hits = scan(files);
    expect(hits, `banned faces found:\n${hits.join('\n')}`).toEqual([]);
  });

  // Covers: AC-1
  it('the scan catches the old stacks (self-check on probes)', () => {
    const probe = [
      { file: 'a.js', text: "const STACK = { sans: 'system-ui, -apple-system, \"Segoe UI\", Roboto, sans-serif' };" },
      { file: 'b.ts', text: "const FAMILY = { hand: 'Caveat', sans: 'Inter' };" },
      { file: 'c.ts', text: "readFileSync(join(dir, 'inter-latin-600-normal.woff'))" },
      { file: 'd.ts', text: '// Inter was the old face\nconst Interval = 1;' },
    ];
    const hits = scan(probe);
    expect(hits.some((h) => h.startsWith('a.js:1 [system-ui]'))).toBe(true);
    expect(hits.some((h) => h.startsWith('a.js:1 [Segoe UI]'))).toBe(true);
    expect(hits.some((h) => h.startsWith("b.ts:1 ['Inter'"))).toBe(true);
    expect(hits.some((h) => h.startsWith('c.ts:1'))).toBe(true);
    expect(hits.some((h) => h.startsWith('d.ts'))).toBe(false);
  });

  // Covers: AC-1
  it('the LOOK-6 contract no longer lists shareCardCanvas.js as an exception', () => {
    const text = read(LOOK6_CONTRACT);
    const code = codeLines(text).map((l) => l.code).join('\n');
    expect(code, 'LOOK-6 AC1_EXCEPTIONS still holds src/data/shareCardCanvas.js').not.toMatch(
      /(['"`])src\/data\/shareCardCanvas\.js\1/,
    );
  });

  // Covers: AC-1 (brief section 5: the server error page names the lining face)
  it('handler.ts names "Alegreya Sans Lining" for the error page', () => {
    const handler = read(path.join(SHARE_DIR, 'handler.ts'));
    const code = codeLines(handler).map((l) => l.code).join('\n');
    expect(/Alegreya Sans Lining/.test(code), 'handler.ts does not name "Alegreya Sans Lining"').toBe(true);
  });
});

describe('LOOK-6b AC-1: one face map shared by both renderers', () => {
  // Covers: AC-1 (plan.md public_surface: CARD_FACES exported from src/data/shareCardLayout.js)
  it('shareCardLayout.js exports CARD_FACES { hand: Caveat, sans: Alegreya Sans Lining }', async () => {
    const L = await import('../../../src/data/shareCardLayout.js');
    expect(L.CARD_FACES).toEqual({ hand: 'Caveat', sans: 'Alegreya Sans Lining' });
  });

  // Covers: AC-1
  it('card.ts and shareCardCanvas.js both read CARD_FACES (neither names a face of its own)', () => {
    for (const f of ['functions/src/share/card.ts', CANVAS]) {
      const code = codeLines(read(path.join(ROOT, f))).map((l) => l.code).join('\n');
      expect(code, `${f} does not use CARD_FACES`).toMatch(/\bCARD_FACES\b/);
    }
  });
});

describe('LOOK-6b AC-2: bundled font files and licences', () => {
  const list = () => (fs.existsSync(FN_FONTS) ? fs.readdirSync(FN_FONTS) : []);

  // Covers: AC-2
  it('functions/fonts holds Caveat 700, both lining files and both licences', () => {
    const files = list();
    for (const name of ['caveat-latin-700-normal.woff', ...LINING, 'LICENSE-alegreya-sans.txt', 'LICENSE-caveat.txt']) {
      expect(files, `functions/fonts is missing ${name}`).toContain(name);
    }
  });

  // Covers: AC-2
  it('functions/fonts has no inter-* file (and no Inter licence)', () => {
    const left = list().filter((n) => /inter/i.test(n));
    expect(left, `Inter files remain: ${left.join(', ')}`).toEqual([]);
  });

  // Covers: AC-2
  it('the public/fonts and functions/fonts copies of each lining file are byte-equal', () => {
    for (const name of LINING) {
      const pub = path.join(PUB_FONTS, name);
      const fn = path.join(FN_FONTS, name);
      expect(fs.existsSync(pub), `public/fonts/${name} missing`).toBe(true);
      expect(fs.existsSync(fn), `functions/fonts/${name} missing`).toBe(true);
      expect(fs.readFileSync(pub).equals(fs.readFileSync(fn)), `${name} differs between public/ and functions/`).toBe(true);
    }
  });

  // Covers: AC-2
  it('the Alegreya Sans licence is the OFL, beside each copy of the lining files', () => {
    for (const dir of [FN_FONTS, PUB_FONTS]) {
      const lic = path.join(dir, 'LICENSE-alegreya-sans.txt');
      expect(fs.existsSync(lic), `${rel(lic)} missing`).toBe(true);
      expect(read(lic)).toMatch(/SIL Open Font License/i);
    }
  });

  // Covers: AC-2
  it('every font file card.ts names exists in functions/fonts, and it names the two lining files', () => {
    const code = codeLines(read(path.join(SHARE_DIR, 'card.ts'))).map((l) => l.code).join('\n');
    const named = [...new Set([...code.matchAll(/[\w.-]+\.(woff2?|ttf|otf)\b/g)].map((m) => m[0]))];
    const files = list();
    for (const n of named) expect(files, `card.ts names ${n}, not in functions/fonts`).toContain(n);
    // The lining files may be named whole or built from a weight (alegreya-sans-lining-latin-${w}-normal.woff).
    expect(/alegreya-sans-lining-latin-/.test(code), 'card.ts does not name the alegreya-sans-lining-latin-* files').toBe(true);
  });
});

describe('LOOK-6b AC-7: the lining build of Alegreya Sans', () => {
  for (const [i, name] of LINING.entries()) {
    const weight = i === 0 ? 400 : 500;

    // Covers: AC-7
    it(`${name}: digits 0-9 map to zero.tf .. nine.tf`, () => {
      const file = path.join(FN_FONTS, name);
      expect(fs.existsSync(file), `functions/fonts/${name} missing`).toBe(true);
      const f = readWoff(file);
      expect(f.glyphNames, 'post table has no glyph names').toBeTruthy();
      const want = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'].map((d) => `${d}.tf`);
      const got = want.map((_, d) => f.glyphNames[f.cmap.get(0x30 + d)]);
      expect(got).toEqual(want);
      // Tabular: every digit has the same advance width.
      const adv = new Set(want.map((_, d) => f.advances[f.cmap.get(0x30 + d)]));
      expect(adv.size).toBe(1);
    });

    // Covers: AC-7
    it(`${name}: same glyph count as the fontsource ${weight} source (no glyph added or removed)`, () => {
      const lining = readWoff(path.join(FN_FONTS, name));
      const source = readWoff(SOURCE(weight));
      expect(lining.numGlyphs).toBe(source.numGlyphs);
      // Only the digits are remapped: every other mapped character keeps its glyph.
      const changed = [];
      for (const [cp, g] of source.cmap) {
        if (cp >= 0x30 && cp <= 0x39) continue;
        if (lining.cmap.get(cp) !== g) changed.push(`U+${cp.toString(16).toUpperCase()}`);
      }
      expect(changed, `non-digit cmap entries changed: ${changed.slice(0, 20).join(', ')}`).toEqual([]);
    });

    // Covers: AC-7
    it(`${name}: the family name is "Alegreya Sans Lining"`, () => {
      const f = readWoff(path.join(FN_FONTS, name));
      const family = f.names.filter((n) => n.nameID === 1 || n.nameID === 16).map((n) => n.text);
      expect(family.length).toBeGreaterThan(0);
      // nameID 1 of a non-regular weight carries the style ("Alegreya Sans Lining Medium" for 500) when there
      // is no nameID 16; the family part must be the renamed one either way.
      for (const fam of family) expect(fam.startsWith('Alegreya Sans Lining'), `family name "${fam}"`).toBe(true);
    });
  }

  // Covers: AC-7 (self-check of the reader on the unmodified source: digits there are not the .tf glyphs)
  it('the reader sees oldstyle digits in the unmodified fontsource file', () => {
    const f = readWoff(SOURCE(400));
    const got = [0, 1, 2].map((d) => f.glyphNames[f.cmap.get(0x30 + d)]);
    expect(got).toEqual(['zero', 'one', 'two']);
    expect(f.names.some((n) => n.nameID === 1 && n.text === 'Alegreya Sans')).toBe(true);
  });
});
