// LOOK-9 contract tests (blind): the static scan. Written from plan.md (LOOK-9 AC-6) and the approved brief
// .schermness/design/LOOK-9.md (section 9 test 8). The listed source files are read as TEXT at test time (no
// component is imported); nothing under src/ was read while writing this file. Same heuristics as
// tests/contracts/LOOK-7/pills.contract.test.js, with '50%' added to the pill radii (brief "What is there today").
//
//   1. None of the listed files contains `outlineColor: CHALK_CREAM` (the Focus token is used instead).
//   2. None contains a `2px double` border.
//   3. PairingLab.jsx contains no `borderRadius: 14` (30 px controls shaped as pills).
//   4. Every pill shape on a code line -- `rounded-full`, or a borderRadius of 999 / 9999 / '999px' / '9999px' /
//      '50%' -- sits on a DOT (equal width and height on the same element) or a BAR (thin height), or is allowed by
//      tests/contracts/LOOK-9/allowlist.json. Comment lines are ignored.
//   5. The allowlist is well formed: each entry names an existing file, a pattern that still occurs there, a reason.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../../..');
const COMPONENTS = path.join(ROOT, 'src', 'components');
const ALLOWLIST_PATH = path.join(HERE, 'allowlist.json');
const rel = (abs) => path.relative(ROOT, abs).split(path.sep).join('/');

// AC-6, verbatim.
const LISTED_NAMES = [
  'SauceBrowse', 'SaucePairings', 'SaucePantryPanel', 'SauceSuggestionDeck', 'WineLab', 'CookbookLab', 'PairingLab',
  'PairingModeCard', 'PictureField', 'RecipePicture', 'RecipeCookingMethod', 'HelpBubble', 'ShareSheet', 'OwnShare',
  'ShareImages', 'ShareReport', 'RecipeFlavorProfilesCard',
];
const FILES = LISTED_NAMES.map((n) => {
  const abs = path.join(COMPONENTS, `${n}.jsx`);
  const exists = fs.existsSync(abs);
  return { file: rel(abs), exists, text: exists ? fs.readFileSync(abs, 'utf8') : '' };
});

function codeLines(text) {
  const out = [];
  let inBlock = false;
  text.split(/\r?\n/).forEach((line, i) => {
    let t = line.trim();
    if (inBlock) {
      if (t.includes('*/')) { inBlock = false; t = t.slice(t.indexOf('*/') + 2).trim(); if (!t) return; } else return;
    }
    if (t.startsWith('//') || t.startsWith('*')) return;
    if (t.startsWith('/*') || t.startsWith('{/*')) {
      if (!t.includes('*/')) inBlock = true;
      return;
    }
    out.push({ i, code: line.replace(/(^|[^:])\/\/.*$/, '$1') });
  });
  return out;
}

const PILL = /rounded-full|borderRadius\s*:\s*(?:9999|999|'999px'|"999px"|'9999px'|"9999px"|'50%'|"50%")(?![0-9])/g;

function regionAround(lines, i) {
  let start = i;
  for (let k = i; k >= Math.max(0, i - 6); k -= 1) {
    start = k;
    if (/<[A-Za-z]|\{\{/.test(lines[k])) break;
  }
  let end = i;
  for (let k = i; k <= Math.min(lines.length - 1, i + 6); k += 1) {
    end = k;
    if (/\}\}|>/.test(lines[k])) break;
  }
  return lines.slice(start, end + 1).join('\n');
}

function isDot(region) {
  const ws = [...region.matchAll(/(?:^|[\s"'`])(?:[a-z]+:)*w-(\[[^\]]+\]|\d+(?:\.\d+)?)(?=[\s"'`]|$)/gm)].map((m) => m[1]);
  const hs = [...region.matchAll(/(?:^|[\s"'`])(?:[a-z]+:)*h-(\[[^\]]+\]|\d+(?:\.\d+)?)(?=[\s"'`]|$)/gm)].map((m) => m[1]);
  if (ws.some((w) => hs.includes(w))) return true;
  if (/(?:^|[\s"'`])size-(\[[^\]]+\]|\d+(?:\.\d+)?)(?=[\s"'`]|$)/m.test(region)) return true;
  const w = /\bwidth\s*:\s*([^,}\n]+)/.exec(region);
  const h = /\bheight\s*:\s*([^,}\n]+)/.exec(region);
  return !!(w && h && w[1].trim() === h[1].trim());
}

function isBar(region) {
  if (/(?:^|[\s"'`])h-(0\.5|1|1\.5|2|2\.5|3)(?=[\s"'`]|$)/m.test(region)) return true;
  const tw = /(?:^|[\s"'`])h-\[(\d+(?:\.\d+)?)px\](?=[\s"'`]|$)/m.exec(region);
  if (tw && Number(tw[1]) <= 12) return true;
  const inl = /(?<![a-zA-Z])height\s*:\s*['"]?(\d+(?:\.\d+)?)(px)?['"]?\s*[,}\n]/.exec(region);
  return !!(inl && Number(inl[1]) <= 12);
}

const loadAllowlist = () => JSON.parse(fs.readFileSync(ALLOWLIST_PATH, 'utf8'));

function scan(re) {
  const hits = [];
  for (const { file, text } of FILES) {
    for (const { i, code } of codeLines(text)) if (re.test(code)) hits.push(`${file}:${i + 1}: ${code.trim().slice(0, 140)}`);
  }
  return hits;
}

describe('LOOK-9 static scan of the listed files', () => {
  // Covers: AC-6
  it('every listed file exists', () => {
    expect(FILES.filter((f) => !f.exists).map((f) => f.file)).toEqual([]);
  });

  // Covers: AC-6
  it('no listed file contains outlineColor: CHALK_CREAM', () => {
    expect(scan(/outlineColor\s*:\s*CHALK_CREAM\b/)).toEqual([]);
  });

  // Covers: AC-6
  it('no listed file draws a 2px double border', () => {
    expect(scan(/2px\s+double|double\s+2px|border-double/)).toEqual([]);
  });

  // Covers: AC-6
  it('PairingLab.jsx has no borderRadius: 14', () => {
    const f = FILES.find((x) => x.file.endsWith('/PairingLab.jsx'));
    const hits = codeLines(f.text).filter(({ code }) => /borderRadius\s*:\s*['"]?14(px)?['"]?(?![0-9])/.test(code))
      .map(({ i, code }) => `${f.file}:${i + 1}: ${code.trim()}`);
    expect(hits).toEqual([]);
  });

  // Covers: AC-6
  it('every rounded-full or 999 / 9999 / 50% radius is on a dot or a bar, or allowlisted with a reason', () => {
    const allow = (loadAllowlist().entries || []).filter((e) => e && typeof e.reason === 'string' && e.reason.trim() && typeof e.pattern === 'string' && e.pattern);
    const offenders = [];
    for (const { file, text } of FILES) {
      const lines = text.split(/\r?\n/);
      for (const { i, code } of codeLines(text)) {
        PILL.lastIndex = 0;
        if (!PILL.test(code)) continue;
        const region = regionAround(lines, i);
        if (isDot(region) || isBar(region)) continue;
        if (allow.some((e) => e.file === file && lines[i].includes(e.pattern))) continue;
        offenders.push(`${file}:${i + 1}: ${code.trim().slice(0, 140)}`);
      }
    }
    expect(offenders, 'pill shapes that are not a dot or a bar and are not in tests/contracts/LOOK-9/allowlist.json').toEqual([]);
  });
});

describe('LOOK-9 allowlist', () => {
  // Covers: AC-6
  it('is well formed: entries with an existing file, a pattern that still occurs there, and a non-empty reason', () => {
    const raw = loadAllowlist();
    expect(Array.isArray(raw.entries)).toBe(true);
    const problems = [];
    raw.entries.forEach((e, n) => {
      const at = `entries[${n}]`;
      if (!e || typeof e !== 'object') { problems.push(`${at}: not an object`); return; }
      if (typeof e.file !== 'string' || !e.file.trim()) { problems.push(`${at}: no file`); return; }
      const abs = path.join(ROOT, ...e.file.split('/'));
      if (!fs.existsSync(abs)) { problems.push(`${at}: file ${e.file} does not exist`); return; }
      if (typeof e.pattern !== 'string' || !e.pattern.trim()) problems.push(`${at}: empty pattern`);
      else if (!fs.readFileSync(abs, 'utf8').includes(e.pattern)) problems.push(`${at}: pattern "${e.pattern}" no longer occurs in ${e.file} (stale entry)`);
      if (typeof e.reason !== 'string' || !e.reason.trim()) problems.push(`${at}: empty reason`);
    });
    expect(problems).toEqual([]);
  });

  // Covers: AC-6
  it('the scan heuristics recognise a dot, a bar and a pill (self-check)', () => {
    expect(isDot('<span className="w-2 h-2 rounded-full" />')).toBe(true);
    expect(isDot("style={{ width: 9, height: 9, borderRadius: '50%' }}")).toBe(true);
    expect(isBar('<div className="h-1.5 rounded-full bg-x" />')).toBe(true);
    const pill = '<button className="px-3 py-1 rounded-full border" />';
    expect(isDot(pill) || isBar(pill)).toBe(false);
    PILL.lastIndex = 0;
    expect(PILL.test("style={{ borderRadius: '50%' }}")).toBe(true);
  });
});
