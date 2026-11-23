// LOOK-3 contract tests (blind, TRUSTED mode): written from plan.md, design/DESIGN.md and the
// task brief only. No file under src/ was read; the scan is generic and runs at test time.
//
// It reads every .jsx file under src/components as text (no component is imported) and checks
// the visible-copy rules of LOOK-3:
//   AC-1  no " · " middle-dot meta strings
//   AC-2  no arrows (→ ←) in labels or buttons
//   AC-3  no tracked all-caps (textTransform uppercase, CSS text-transform, Tailwind `uppercase`)
//   AC-4  no developer words ("cocktail · card", "Bridges other families",
//         "Warming up the recipe model")
//   AC-5  the allowlist is well formed
//
// Allowlist: tests/contracts/LOOK-3/allowlist.json,
//   { "entries": [ { "file": "src/components/X.jsx", "pattern": "→", "reason": "..." } ] }
// "file" is the repo-relative path with forward slashes; "pattern" is the pattern label printed
// in the failure message (for example " · ", "→", "&larr;", "uppercase"). A hit is allowed only
// when an entry names the same file and pattern and gives a non-empty reason.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../../..');
const COMPONENTS = path.join(ROOT, 'src', 'components');
const ALLOWLIST_PATH = path.join(HERE, 'allowlist.json');

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

// Returns [{ lineNo, code }] for lines that are not comments. A line counts as a comment when it
// sits inside a /* ... */ block, or its trimmed text starts with //, /*, *, or {/* (a JSX
// comment). A trailing `// note` after code is cut off (not when the // follows a ':' as in a
// URL), so a code comment beside a line does not count as copy.
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

// Scans every file for each [label, test] pattern; returns the hits not covered by the allowlist.
function scan(patterns) {
  const hits = [];
  for (const { file, text } of FILES) {
    for (const { lineNo, code } of codeLines(text)) {
      for (const [label, test] of patterns) {
        if (test(code) && !isAllowed(file, label)) {
          hits.push(`${file}:${lineNo}  [${label}]  ${code.trim().slice(0, 160)}`);
        }
      }
    }
  }
  return hits;
}

function report(name, hits) {
  return hits.length === 0
    ? ''
    : `${name}: ${hits.length} hit(s). Fix them or add an allowlist entry with a reason ` +
        `(tests/contracts/LOOK-3/allowlist.json):\n  ` +
        hits.join('\n  ');
}

const has = (s) => (code) => code.includes(s);
const hasI = (s) => (code) => code.toLowerCase().includes(s.toLowerCase());

describe('LOOK-3 visible copy in src/components', () => {
  it('finds component files to scan', () => {
    expect(FILES.length, 'no .jsx files found under src/components').toBeGreaterThan(0);
  });

  // Covers: AC-1
  it('has no " · " middle-dot meta strings', () => {
    const hits = scan([
      [' · ', has(' · ')],
      [' \\u00b7 ', hasI(' \\u00b7 ')],
      [' &middot; ', hasI(' &middot; ')],
    ]);
    expect(hits, report('Middle dots', hits)).toEqual([]);
  });

  // Covers: AC-2
  it('has no arrows in labels or buttons', () => {
    const hits = scan([
      ['→', has('→')],
      ['←', has('←')],
      ['&rarr;', hasI('&rarr;')],
      ['&larr;', hasI('&larr;')],
      ['\\u2192', hasI('\\u2192')],
      ['\\u2190', hasI('\\u2190')],
    ]);
    expect(hits, report('Arrows', hits)).toEqual([]);
  });

  // Covers: AC-3
  it('has no tracked all-caps text', () => {
    const hits = scan([
      ['textTransform uppercase', (c) => /textTransform\s*:\s*['"`]uppercase['"`]/.test(c)],
      ['text-transform: uppercase', (c) => /text-transform\s*:\s*uppercase/i.test(c)],
      // Tailwind class as a whole word inside a class string (also md:uppercase etc.).
      // Case-sensitive, so `toUpperCase()` is not matched.
      [
        'uppercase',
        (c) =>
          !/textTransform\s*:/.test(c) &&
          !/text-transform\s*:/i.test(c) &&
          /(^|[\s"'`:{])uppercase(?=[\s"'`}]|$)/.test(c),
      ],
    ]);
    expect(hits, report('Tracked capitals', hits)).toEqual([]);
  });

  // Covers: AC-4
  it('has no developer words on screen', () => {
    const words = ['cocktail · card', 'Bridges other families', 'Warming up the recipe model'];
    const hits = [];
    for (const { file, text } of FILES) {
      const lines = text.split(/\r?\n/);
      lines.forEach((line, i) => {
        for (const w of words) {
          if (line.toLowerCase().includes(w.toLowerCase()) && !isAllowed(file, w)) {
            hits.push(`${file}:${i + 1}  [${w}]  ${line.trim().slice(0, 160)}`);
          }
        }
      });
    }
    expect(hits, report('Developer words', hits)).toEqual([]);
  });
});

describe('LOOK-3 allowlist', () => {
  // Covers: AC-5
  it('is a JSON object with an entries array', () => {
    const raw = JSON.parse(fs.readFileSync(ALLOWLIST_PATH, 'utf8'));
    expect(Array.isArray(raw.entries)).toBe(true);
  });

  // Covers: AC-5
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
