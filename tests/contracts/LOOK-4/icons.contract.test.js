// LOOK-4 contract tests (blind, TRUSTED mode): written from plan.md, design/DESIGN.md and the
// task brief only. No file under src/ was read; the scan is generic and runs at test time.
//
// It reads every .jsx file under src/components as text (no component is imported) and checks:
//   AC-1  no pictographic emoji (or the emoji variation selector U+FE0F, or an escaped emoji such
//         as '\u{1F500}', a surrogate pair '\uD83D' or an HTML entity '&#x1F500;') on a
//         non-comment line
//   AC-2  src/components/ChalkIcons.jsx exists, exports at least 8 named components, draws with
//         <svg>, and uses no <img> and no http URL
//   AC-3  no component imports an icon library; the bottom tab bar (MobileTabBar.jsx, named in
//         design/DESIGN.md) takes its icons from ChalkIcons and draws no SVG of its own
//   AC-4  the allowlist is well formed
//
// Allowlist: tests/contracts/LOOK-4/allowlist.json,
//   { "entries": [ { "file": "src/components/X.jsx", "pattern": "U+1F500", "reason": "..." } ] }
// "pattern" is the label printed in the failure message: the code point as "U+XXXX" (upper-case
// hex, at least 4 digits) for a literal character, or the escaped text itself (for example
// "\\u{1F500}", "&#x1F500;", "\\uD83D") for an escaped form. A hit is allowed only when an entry
// names the same file and pattern and gives a non-empty reason.
//
// Not counted as emoji: (c) U+00A9, (r) U+00AE and TM U+2122, which are text symbols in credits,
// not icons, even though Unicode marks them Extended_Pictographic.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../../..');
const COMPONENTS = path.join(ROOT, 'src', 'components');
const ALLOWLIST_PATH = path.join(HERE, 'allowlist.json');
const ICONS_REL = 'src/components/ChalkIcons.jsx';
const ICONS_PATH = path.join(ROOT, ...ICONS_REL.split('/'));
const TAB_BAR_NAME = 'MobileTabBar.jsx';

function walk(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === '__tests__' || entry.name === 'node_modules') continue;
      out.push(...walk(full));
    } else if (entry.isFile() && entry.name.endsWith('.jsx')) {
      out.push(full);
    }
  }
  return out;
}

const rel = (abs) => path.relative(ROOT, abs).split(path.sep).join('/');

const FILES = walk(COMPONENTS)
  .filter((f) => !rel(f).includes('__tests__') && !f.endsWith('.test.jsx'))
  .sort()
  .map((abs) => ({ file: rel(abs), text: fs.readFileSync(abs, 'utf8') }));

function loadAllowlist() {
  const raw = JSON.parse(fs.readFileSync(ALLOWLIST_PATH, 'utf8'));
  return Array.isArray(raw.entries) ? raw.entries : [];
}

const ALLOW = loadAllowlist();

function isAllowed(file, pattern) {
  return ALLOW.some(
    (e) =>
      e &&
      e.file === file &&
      e.pattern === pattern &&
      typeof e.reason === 'string' &&
      e.reason.trim().length > 0,
  );
}

// Same comment handling as tests/contracts/LOOK-3/copy.contract.test.js: returns
// [{ lineNo, code }] for lines that are not comments. A line counts as a comment when it sits
// inside a /* ... */ block, or its trimmed text starts with //, /*, *, or {/* (a JSX comment).
// A trailing `// note` after code is cut off (not when the // follows a ':' as in a URL).
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
    const code = line.replace(/(^|[^:])\s\/\/(?!\/).*$/, '$1');
    out.push({ lineNo: i + 1, code });
  });
  return out;
}

const NOT_EMOJI = new Set([0x00a9, 0x00ae, 0x2122]);
const PICTO = /\p{Extended_Pictographic}/u;

const cpLabel = (cp) => 'U+' + cp.toString(16).toUpperCase().padStart(4, '0');

// Returns [label] for every emoji-like thing on one code line.
function emojiHits(code) {
  const labels = [];
  for (const ch of code) {
    const cp = ch.codePointAt(0);
    if (cp === 0xfe0f || (PICTO.test(ch) && !NOT_EMOJI.has(cp))) labels.push(cpLabel(cp));
  }
  // Escaped forms: '\u{1F500}' (astral, 1F000-1FFFF), surrogate halves '\uD83C'..'\uD83E',
  // '️', and HTML numeric entities for the emoji planes.
  const escapes = [
    /\\u\{1F[0-9A-Fa-f]{3}\}/g,
    /\\u\{(?:26|27)[0-9A-Fa-f]{2}\}/g,
    /\\u[Dd]83[CcDdEe]/g,
    /\\u[Ff][Ee]0[Ff]/g,
    /&#x1F[0-9A-Fa-f]{3};/g,
    /&#12[0-9]{4};/g,
  ];
  for (const re of escapes) {
    for (const m of code.matchAll(re)) labels.push(m[0]);
  }
  return [...new Set(labels)];
}

describe('LOOK-4 no emoji as icons in src/components', () => {
  it('finds component files to scan', () => {
    expect(FILES.length, 'no .jsx files found under src/components').toBeGreaterThan(0);
  });

  // Covers: AC-1
  it('has no pictographic emoji or emoji variation selector on a non-comment line', () => {
    const hits = [];
    for (const { file, text } of FILES) {
      for (const { lineNo, code } of codeLines(text)) {
        for (const label of emojiHits(code)) {
          if (!isAllowed(file, label)) {
            hits.push(`${file}:${lineNo}  [${label}]  ${code.trim().slice(0, 160)}`);
          }
        }
      }
    }
    const msg =
      hits.length === 0
        ? ''
        : `Emoji used in components: ${hits.length} hit(s). Replace with a ChalkIcons icon or ` +
          `the word alone, or add an allowlist entry with a reason ` +
          `(tests/contracts/LOOK-4/allowlist.json):\n  ` +
          hits.join('\n  ');
    expect(hits, msg).toEqual([]);
  });

  // Covers: AC-1 (self-check of the detector, so a passing scan means something)
  it('the detector catches the emoji named in plan.md and ignores plain text', () => {
    for (const e of ['✨', '🔀', '🛒', '🍾', '🍸', '❤️']) {
      expect(emojiHits(`<button>${e} Invent</button>`).length, `missed ${e}`).toBeGreaterThan(0);
    }
    expect(emojiHits("label: '\\u{1F500} Riff'").length).toBeGreaterThan(0);
    expect(emojiHits('<span>&#x1F6D2;</span>').length).toBeGreaterThan(0);
    expect(emojiHits('<p>Piña colada, crème de cassis, génépy © 2026</p>')).toEqual([]);
  });
});

describe('LOOK-4 one icon file', () => {
  const exists = fs.existsSync(ICONS_PATH);
  const text = exists ? fs.readFileSync(ICONS_PATH, 'utf8') : '';
  const code = codeLines(text)
    .map((l) => l.code)
    .join('\n');

  // Covers: AC-2
  it(`${ICONS_REL} exists`, () => {
    expect(exists, `${ICONS_REL} is missing: the one drawn icon set lives there`).toBe(true);
  });

  // Covers: AC-2
  it('exports at least 8 named components', () => {
    const names = new Set();
    for (const m of code.matchAll(/^\s*export\s+(?:function\s+([A-Z]\w*)|const\s+([A-Z]\w*)\s*=)/gm)) {
      names.add(m[1] || m[2]);
    }
    // export { A, B as C }
    for (const m of code.matchAll(/^\s*export\s*\{([^}]*)\}/gm)) {
      for (const part of m[1].split(',')) {
        const name = part.trim().split(/\s+as\s+/).pop().trim();
        if (/^[A-Z]\w*$/.test(name)) names.add(name);
      }
    }
    expect(
      names.size,
      `${ICONS_REL} exports ${names.size} named component(s): ${[...names].join(', ') || 'none'}`,
    ).toBeGreaterThanOrEqual(8);
  });

  // Covers: AC-2
  it('draws with <svg> and uses no <img> and no http URL', () => {
    expect(code.includes('<svg'), `${ICONS_REL} has no <svg>`).toBe(true);
    const bad = [];
    codeLines(text).forEach(({ lineNo, code: c }) => {
      if (/<img\b/i.test(c)) bad.push(`${ICONS_REL}:${lineNo}  [<img]  ${c.trim()}`);
      if (/https?:/i.test(c)) bad.push(`${ICONS_REL}:${lineNo}  [http]  ${c.trim()}`);
    });
    // The SVG namespace attribute is not a fetched URL.
    const real = bad.filter((b) => !/xmlns(:\w+)?=["']http:\/\/www\.w3\.org\//.test(b));
    expect(real, real.join('\n')).toEqual([]);
  });
});

describe('LOOK-4 no other icon set', () => {
  const LIBS = [
    /^lucide-react(\/|$)/,
    /^react-icons(\/|$)/,
    /^@heroicons\//,
    /^heroicons(\/|$)/,
    /^@fortawesome\//,
    /^react-feather(\/|$)/,
    /^@mui\/icons-material(\/|$)/,
    /^@?phosphor/,
  ];
  const specifiers = (c) => {
    const out = [];
    for (const m of c.matchAll(/\bfrom\s*['"]([^'"]+)['"]/g)) out.push(m[1]);
    for (const m of c.matchAll(/\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g)) out.push(m[1]);
    for (const m of c.matchAll(/\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g)) out.push(m[1]);
    for (const m of c.matchAll(/^\s*import\s*['"]([^'"]+)['"]/g)) out.push(m[1]);
    return out;
  };

  // Covers: AC-3
  it('no component imports an icon library', () => {
    const hits = [];
    for (const { file, text } of FILES) {
      for (const { lineNo, code } of codeLines(text)) {
        for (const spec of specifiers(code)) {
          if (LIBS.some((re) => re.test(spec)) && !isAllowed(file, spec)) {
            hits.push(`${file}:${lineNo}  [${spec}]  ${code.trim().slice(0, 160)}`);
          }
        }
      }
    }
    expect(hits, `Icon library imports:\n  ${hits.join('\n  ')}`).toEqual([]);
  });

  // Covers: AC-3
  it(`the bottom tab bar (${TAB_BAR_NAME}) takes its icons from ChalkIcons and draws none itself`, () => {
    const tab = FILES.find((f) => f.file.endsWith('/' + TAB_BAR_NAME));
    expect(
      tab,
      `${TAB_BAR_NAME} not found under src/components (design/DESIGN.md names it as the tab bar)`,
    ).toBeTruthy();
    const lines = codeLines(tab.text);
    const code = lines.map((l) => l.code).join('\n');
    expect(
      /\bfrom\s*['"][./]*(?:[\w/]*\/)?ChalkIcons(?:\.jsx)?['"]/.test(code),
      `${tab.file} does not import from ChalkIcons`,
    ).toBe(true);
    const inline = lines
      .filter(({ code: c }) => /<(svg|path|polyline|circle|rect|line|polygon)\b/.test(c))
      .map(({ lineNo, code: c }) => `${tab.file}:${lineNo}  ${c.trim().slice(0, 160)}`);
    expect(inline, `Inline SVG in the tab bar (move it into ChalkIcons):\n  ${inline.join('\n  ')}`).toEqual([]);
  });
});

describe('LOOK-4 allowlist', () => {
  // Covers: AC-4
  it('is a JSON object with an entries array', () => {
    const raw = JSON.parse(fs.readFileSync(ALLOWLIST_PATH, 'utf8'));
    expect(Array.isArray(raw.entries)).toBe(true);
  });

  // Covers: AC-4
  it('every entry has a pattern, a non-empty reason and names a file that exists', () => {
    const bad = [];
    ALLOW.forEach((e, i) => {
      const where = `entries[${i}]`;
      if (!e || typeof e !== 'object') {
        bad.push(`${where}: not an object`);
        return;
      }
      if (typeof e.file !== 'string' || !e.file) bad.push(`${where}: missing file`);
      else if (!fs.existsSync(path.join(ROOT, e.file)))
        bad.push(`${where}: file does not exist: ${e.file}`);
      if (typeof e.pattern !== 'string' || !e.pattern) bad.push(`${where}: missing pattern`);
      if (typeof e.reason !== 'string' || !e.reason.trim())
        bad.push(`${where}: empty reason (${e.file} ${e.pattern})`);
    });
    expect(bad, bad.join('\n')).toEqual([]);
  });
});
