// LOOK-6 contract tests (blind): written from plan.md (LOOK-6 acceptance_criteria AC-1..AC-7) and the
// approved brief .schermness/design/LOOK-6.md (sections 3, 6, 9). No implementation file under src/ was
// read; every scan below is generic and reads the files as text at test time.
//
// This file covers the text scans:
//   AC-1  no system-ui, -apple-system, Segoe UI, Roboto, 'Inter' / "Inter", Georgia (as a face),
//         Palatino or JetBrains on a code line of any .js/.jsx/.css/.ts/.tsx file under src/
//         (one named exception: src/data/shareCardCanvas.js, until LOOK-6b)
//   AC-2  the face names Alegreya Sans and Caveat appear as face literals only in
//         src/data/chalkTheme.js, the one font-loading module (the single file under src/ that imports
//         @fontsource packages) and index.html; @fontsource import paths are not face literals
//   AC-3  no fontFamily / font-family set to a bare generic ('sans-serif', 'serif', 'cursive',
//         'monospace')
//   AC-4  FONT, FONT_HAND, FONT_FAMILY, SANS, SANS_STACK are neither defined, exported nor imported
//         anywhere under src/ (and src/data/chalkTheme.js exports none of them)
//   AC-7  @fontsource/alegreya-sans and @fontsource/caveat are package.json dependencies (and
//         @fontsource/kalam is not), the app imports them, and index.html loads no
//         fonts.googleapis.com stylesheet
//   Owner change 2026-11-23 ("go back to the previous font for the chalk handwriting (not Kalam)"):
//         the hand is Caveat again; an extra check asserts no file under src/ or index.html mentions
//         Kalam at all (comments included).
//
// Scope: test files (__tests__ folders, *.test.*, *.spec.*) are out of scope. Comment lines are
// skipped (same rules as tests/contracts/LOOK-3 and LOOK-4), so a comment may name a banned face.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../../..');
const SRC = path.join(ROOT, 'src');
const EXTS = ['.js', '.jsx', '.css', '.ts', '.tsx'];

const AC1_EXCEPTIONS = new Set([
  // Brief D2 (owner, 2026-11-23): share cards change in LOOK-6b; until then this file keeps its stack.
]);
const CHALK_THEME = 'src/data/chalkTheme.js';

function walk(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === '__tests__' || entry.name === 'node_modules') continue;
      out.push(...walk(full));
    } else if (entry.isFile() && EXTS.includes(path.extname(entry.name))) {
      if (/\.(test|spec)\.[jt]sx?$/.test(entry.name)) continue;
      out.push(full);
    }
  }
  return out;
}

const rel = (abs) => path.relative(ROOT, abs).split(path.sep).join('/');

const FILES = walk(SRC)
  .sort()
  .map((abs) => ({ file: rel(abs), text: fs.readFileSync(abs, 'utf8') }));

// Returns [{ lineNo, code }] for lines that are not comments. A line is a comment when it sits inside
// a /* ... */ block, or its trimmed text starts with //, /*, * or {/* (JSX comment). Inline /* ... */
// is removed; a trailing `// note` after code is cut off (not when the // follows ':' as in a URL).
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
    const startsComment =
      trimmed.startsWith('//') ||
      trimmed.startsWith('/*') ||
      trimmed.startsWith('*') ||
      trimmed.startsWith('{/*');
    if (startsComment) {
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

function scan(files, patterns) {
  const hits = [];
  for (const { file, text } of files) {
    for (const { lineNo, code } of codeLines(text)) {
      for (const p of patterns) {
        if (p.re.test(code)) hits.push(`${file}:${lineNo} [${p.label}] ${code.trim().slice(0, 140)}`);
      }
    }
  }
  return hits;
}

// ---- AC-1 ----
const BANNED_FACES = [
  { label: 'system-ui', re: /system-ui/i },
  { label: '-apple-system', re: /-apple-system/i },
  { label: 'Segoe UI', re: /Segoe\s+UI/i },
  { label: 'Roboto', re: /\bRoboto\b/i },
  { label: "'Inter' (quoted face)", re: /(['"`])Inter\1|\\"Inter\\"/ },
  // Georgia is also a country (wine regions), so it counts only on a line that is about type.
  { label: 'Georgia (as a face)', re: /^(?=.*\bGeorgia\b)(?=.*(font|serif)).*/i },
  { label: 'Palatino', re: /Palatino/i },
  { label: 'JetBrains', re: /JetBrains/i },
];

// ---- AC-2 ----
const FACE_NAMES = '(Alegreya\\s+Sans|Caveat)';
const FACE_LITERALS = [
  // The face at the start of a quoted string: 'Caveat, cursive', '"Caveat", cursive', "Alegreya Sans"
  { label: 'quoted face', re: new RegExp(`['"\`]\\s*${FACE_NAMES}\\b`) },
  // Canvas shorthand: '400 30px Caveat'
  { label: 'canvas font', re: new RegExp(`\\d+(px|pt|em|rem)\\s+['"]?${FACE_NAMES}\\b`) },
  // CSS / SVG: font-family: Caveat
  { label: 'font-family', re: new RegExp(`font-?family\\s*[:=][^;]*\\b${FACE_NAMES}\\b`, 'i') },
  // fontFamily: ... Caveat ... in a style object or attribute
  { label: 'fontFamily', re: new RegExp(`fontFamily\\s*[:=][^,;}]*\\b${FACE_NAMES}\\b`) },
];
const stripFontsource = (files) =>
  files.map(({ file, text }) => ({
    file,
    text: text.replace(/@fontsource\/[\w.\-/]+/g, '@fontsource/PKG'),
  }));

const FONTSOURCE_IMPORT = /(import\s[^;]*?from\s*|import\s*\(?\s*|@import\s+(url\()?\s*|require\(\s*)['"]@fontsource\//;
const fontLoaders = () =>
  FILES.filter(({ text }) => codeLines(text).some(({ code }) => FONTSOURCE_IMPORT.test(code))).map((f) => f.file);

// ---- AC-3 ----
const GENERIC = '(sans-serif|serif|cursive|monospace)';
const BARE_GENERIC = [
  { label: 'fontFamily bare generic', re: new RegExp(`fontFamily\\s*[:=]\\s*\\{?\\s*(['"\`])\\s*${GENERIC}\\s*\\1`) },
  { label: 'font-family bare generic', re: new RegExp(`font-family\\s*[:=]\\s*(['"]?)\\s*${GENERIC}\\s*\\1\\s*(;|\\}|!|$|\\s)`, 'i') },
];

// ---- AC-4 ----
const OLD_NAMES = ['FONT', 'FONT_HAND', 'FONT_FAMILY', 'SANS', 'SANS_STACK'];
const NAME_ALT = OLD_NAMES.join('|');

function oldNameHits() {
  const hits = [];
  for (const { file, text } of FILES) {
    if (file.endsWith('.css')) continue;
    const code = codeLines(text).map((l) => l.code).join('\n');
    const report = (kind, m) => hits.push(`${file} [${kind}] ${m.replace(/\s+/g, ' ').slice(0, 140)}`);
    // definitions: const FONT = ..., export const SANS = ..., function FONT(...)
    for (const m of code.matchAll(new RegExp(`\\b(const|let|var|function|class)\\s+(${NAME_ALT})\\b(?!\\w)`, 'g'))) {
      report('definition', m[0]);
    }
    // destructuring definitions: const { FONT } = ..., const { FONT: X } = ...
    for (const m of code.matchAll(/\b(const|let|var)\s*\{([^}]*)\}\s*=/g)) {
      const names = m[2].split(',').map((s) => s.trim().split(/\s*:\s*/).pop().split(/\s*=/)[0].trim());
      if (names.some((n) => OLD_NAMES.includes(n))) report('destructured definition', m[0]);
    }
    // named imports / re-exports: import { FONT, X as SANS } from '...'; export { FONT } (from '...')
    for (const m of code.matchAll(/\b(import|export)\s*(type\s+)?([\w$]+\s*,\s*)?\{([^}]*)\}/g)) {
      const parts = m[4].split(',').map((s) => s.trim()).filter(Boolean);
      const bad = parts.some((p) => p.split(/\s+as\s+/).some((n) => OLD_NAMES.includes(n.trim())));
      if (bad) report(`${m[1]} list`, m[0]);
    }
    // default import named like an old token: import FONT from '...'
    for (const m of code.matchAll(new RegExp(`\\bimport\\s+(${NAME_ALT})\\s*(,|from)`, 'g'))) {
      report('default import', m[0]);
    }
    // namespace access to an old token on chalkTheme: theme.FONT, chalkTheme.SANS
    for (const m of code.matchAll(new RegExp(`\\b[\\w$]*[Tt]heme\\.(${NAME_ALT})\\b(?!\\w)`, 'g'))) {
      report('member access', m[0]);
    }
  }
  return hits;
}

describe('LOOK-6 type: banned faces, face literals, generics, old tokens, font loading', () => {
  it('finds source files to scan (guards against an empty walk)', () => {
    expect(FILES.length).toBeGreaterThan(20);
    expect(FILES.some((f) => f.file === CHALK_THEME)).toBe(true);
  });

  // Covers: AC-1
  it('AC-1: no system-ui, -apple-system, Segoe UI, Roboto, quoted Inter, Georgia, Palatino or JetBrains in src/ (except shareCardCanvas.js)', () => {
    const files = FILES.filter((f) => !AC1_EXCEPTIONS.has(f.file));
    const hits = scan(files, BANNED_FACES);
    expect(hits, `banned faces found:\n${hits.join('\n')}`).toEqual([]);
  });

  // Covers: AC-1
  it('AC-1: the scan matches a quoted Inter face but not words like Interface or Internal', () => {
    const probe = [{ file: 'probe.js', text: "const a = 'Interface';\nconst b = \"Internal\";\nconst c = \"'Inter', x\";" }];
    const hits = scan(probe, BANNED_FACES);
    expect(hits).toHaveLength(1);
    expect(hits[0]).toMatch(/probe\.js:3/);
  });

  // Covers: AC-2
  it('AC-2: Alegreya Sans and Caveat are named only in chalkTheme.js and the one font-loading module', () => {
    const loaders = fontLoaders();
    // src/data/shareCardLayout.js names its own faces in CARD_FACES (LOOK-6b): the card layout must be
    // self-contained because scripts/buildShareIndex.mjs copies it into the functions package.
    const allowed = new Set([CHALK_THEME, 'src/data/shareCardLayout.js', ...(loaders.length === 1 ? loaders : [])]);
    const files = stripFontsource(FILES).filter((f) => !allowed.has(f.file));
    const hits = scan(files, FACE_LITERALS);
    expect(hits, `face names outside chalkTheme.js / the font module:\n${hits.join('\n')}`).toEqual([]);
  });

  // Covers: AC-2
  it('AC-2: at most one module under src/ loads the @fontsource packages', () => {
    const loaders = fontLoaders();
    expect(loaders.length, `font-loading modules: ${loaders.join(', ')}`).toBeLessThanOrEqual(1);
  });

  // Covers: AC-2
  it('AC-2: chalkTheme.js names Alegreya Sans and Caveat (the one place a face is named)', () => {
    const theme = FILES.find((f) => f.file === CHALK_THEME).text;
    const code = codeLines(theme).map((l) => l.code).join('\n');
    expect(code).toMatch(/['"`]\s*"?Alegreya Sans\b/);
    expect(code).toMatch(/['"`]\s*"?Caveat\b/);
  });

  // Covers: AC-2
  it('AC-2: an @fontsource import path is not counted as a face literal', () => {
    const probe = stripFontsource([
      { file: 'probe.js', text: "import '@fontsource/alegreya-sans/latin-400.css';\nimport '@fontsource/caveat/700.css';" },
    ]);
    expect(scan(probe, FACE_LITERALS)).toEqual([]);
    const bad = [{ file: 'probe.jsx', text: "const s = { fontFamily: 'Caveat, cursive' };" }];
    expect(scan(bad, FACE_LITERALS).length).toBeGreaterThan(0);
  });

  // Covers: AC-3
  it("AC-3: no fontFamily / font-family set to a bare 'sans-serif', 'serif', 'cursive' or 'monospace'", () => {
    const hits = scan(FILES, BARE_GENERIC);
    expect(hits, `bare generic faces:\n${hits.join('\n')}`).toEqual([]);
  });

  // Covers: AC-3
  it('AC-3: the generic scan catches bare generics but allows a generic as a fallback after a named face', () => {
    const bad = [
      {
        file: 'probe.jsx',
        text: [
          "const a = { fontFamily: 'sans-serif' };",
          'const b = <text fontFamily="serif">x</text>;',
          '.x { font-family: monospace; }',
          "const c = { fontFamily: \"cursive\" };",
        ].join('\n'),
      },
    ];
    expect(scan(bad, BARE_GENERIC)).toHaveLength(4);
    const ok = [
      {
        file: 'probe.jsx',
        text: [
          "export const TEXT = '\"Alegreya Sans\", sans-serif';",
          'const a = { fontFamily: TEXT };',
          'body { font-family: "Alegreya Sans", sans-serif; }',
        ].join('\n'),
      },
    ];
    expect(scan(ok, BARE_GENERIC)).toEqual([]);
  });

  // Covers: AC-4
  it('AC-4: FONT, FONT_HAND, FONT_FAMILY, SANS and SANS_STACK are not defined, exported or imported anywhere in src/', () => {
    const hits = oldNameHits();
    expect(hits, `old font tokens remain:\n${hits.join('\n')}`).toEqual([]);
  });

  // Covers: AC-4
  it('AC-4: src/data/chalkTheme.js exports none of the old font tokens', async () => {
    const theme = await import('../../../src/data/chalkTheme.js');
    const present = OLD_NAMES.filter((n) => Object.prototype.hasOwnProperty.call(theme, n));
    expect(present).toEqual([]);
  });

  // Covers: AC-7
  it('AC-7: @fontsource/alegreya-sans and @fontsource/caveat are package.json dependencies; @fontsource/kalam is not', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
    const deps = pkg.dependencies || {};
    for (const name of ['@fontsource/alegreya-sans', '@fontsource/caveat']) {
      expect(deps[name], `${name} missing from dependencies`).toBeTruthy();
    }
    const all = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}), ...(pkg.optionalDependencies || {}) };
    expect(all['@fontsource/kalam'], '@fontsource/kalam must not be a dependency').toBeUndefined();
  });

  // Covers: AC-7 (owner change 2026-11-23: the hand is Caveat, not Kalam)
  it('AC-7: no file under src/ (tests excluded) or index.html mentions Kalam', () => {
    const hits = [];
    const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    for (const { file, text } of [...FILES, { file: 'index.html', text: html }]) {
      text.split(/\r?\n/).forEach((line, i) => {
        // word boundary: 'kalamata olive' is an ingredient, not the face
        if (/\bKalam\b/i.test(line)) hits.push(`${file}:${i + 1} ${line.trim().slice(0, 140)}`);
      });
    }
    expect(hits, `Kalam still mentioned:\n${hits.join('\n')}`).toEqual([]);
  });

  // Covers: AC-7
  it('AC-7: index.html loads no fonts.googleapis.com stylesheet', () => {
    const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8').replace(/<!--[\s\S]*?-->/g, '');
    expect(html).not.toMatch(/fonts\.googleapis\.com/i);
  });

  // Covers: AC-7
  it('AC-7: the app imports @fontsource/alegreya-sans and @fontsource/caveat, from the entry or a module the entry imports', () => {
    const loaders = fontLoaders();
    expect(loaders.length, 'no module under src/ imports @fontsource').toBe(1);
    const loader = FILES.find((f) => f.file === loaders[0]);
    const code = codeLines(loader.text).map((l) => l.code).join('\n');
    for (const pkg of ['alegreya-sans', 'caveat']) {
      expect(code, `${loader.file} does not import @fontsource/${pkg}`).toMatch(
        new RegExp(`['"]@fontsource/${pkg}(/[^'"]*)?['"]`),
      );
    }
    // Reachable from the app entry: the loader is src/main.jsx (or App.jsx) itself, or one of them imports it.
    const ENTRIES = ['src/main.jsx', 'src/App.jsx'];
    if (ENTRIES.includes(loader.file)) return;
    // A JS module may be imported without its extension; a .css file is imported with it.
    const noExt = (p) => p.replace(/\.(jsx?|tsx?)$/, '');
    const importedByEntry = ENTRIES.some((entry) => {
      const f = FILES.find((x) => x.file === entry);
      if (!f) return false;
      const entryCode = codeLines(f.text).map((l) => l.code).join('\n');
      return [...entryCode.matchAll(/(?:import|from)\s*\(?\s*['"](\.[^'"]+)['"]/g)].some((m) => {
        const resolved = path.posix.normalize(path.posix.join(path.posix.dirname(entry), m[1]));
        return resolved === loader.file || noExt(resolved) === noExt(loader.file);
      });
    });
    expect(importedByEntry, `${loader.file} is not imported by src/main.jsx or src/App.jsx`).toBe(true);
  });
});
