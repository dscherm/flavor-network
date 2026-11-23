// LOOK-7 contract tests (blind): the static scan. Written from plan.md (LOOK-7 AC-5) and the approved brief
// .schermness/design/LOOK-7.md (sections 3.1 rule 10, 5, 9 tests 3 and 8). The listed source files are read as
// TEXT at test time (no component is imported); nothing under src/ was read while writing this file.
//
// Listed files (AC-5): src/components/LabNodeCard.jsx, CocktailBrowse.jsx, every src/components/Invent*.jsx,
// RecipeFlavorProfilesCard.jsx, ShoppingList.jsx, inventUi.jsx.
//
//   1. None contains `outlineColor: CHALK_CREAM` (the Focus token is used instead).
//   2. Every pill shape on a code line -- `rounded-full`, or a borderRadius of 999 / 9999 / '999px' / '9999px' --
//      sits on a DOT or a BAR, or is allowed by tests/contracts/LOOK-7/allowlist.json.
//        dot: the same element also sets an equal width and height (Tailwind w-X + h-X with the same X, size-X,
//             or inline width/height with the same value)
//        bar: the same element sets a thin height (Tailwind h-0.5..h-3 or h-[1..12px]; inline height 1..12 px)
//      "The same element" is read as the source region around the hit: from the line that opens the tag or style
//      object (the nearest line above holding `<` or `{{`, at most 6 up) to the line that closes it (`>` or `}}`,
//      at most 6 down). Comment lines are ignored.
//   3. The allowlist is well formed: { "entries": [ { "file", "pattern", "reason" } ] }; each entry names an
//      existing file, a non-empty pattern that still occurs in that file, and a non-empty reason. An entry allows
//      the hits on lines of that file containing the pattern.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../../..');
const COMPONENTS = path.join(ROOT, 'src', 'components');
const ALLOWLIST_PATH = path.join(HERE, 'allowlist.json');
const rel = (abs) => path.relative(ROOT, abs).split(path.sep).join('/');

const NAMED = ['LabNodeCard.jsx', 'CocktailBrowse.jsx', 'RecipeFlavorProfilesCard.jsx', 'ShoppingList.jsx', 'inventUi.jsx'];
const INVENT = fs.readdirSync(COMPONENTS).filter((f) => /^Invent.*\.jsx$/.test(f)).sort();
const LISTED = [...NAMED, ...INVENT].map((f) => path.join(COMPONENTS, f));
const FILES = LISTED.map((abs) => ({ file: rel(abs), exists: fs.existsSync(abs), text: fs.existsSync(abs) ? fs.readFileSync(abs, 'utf8') : '' }));

// Lines that are code (comment lines dropped; block comments tracked). Returns [{ i, code }] with i 0-based.
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

const PILL = /rounded-full|borderRadius\s*:\s*(?:9999|999|'999px'|"999px"|'9999px'|"9999px")(?![0-9])/g;

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

function loadAllowlist() {
  const raw = JSON.parse(fs.readFileSync(ALLOWLIST_PATH, 'utf8'));
  return raw;
}

describe('LOOK-7 static scan of the listed files', () => {
  // Covers: AC-5
  it('every listed file exists (the Invent* set is not empty)', () => {
    expect(INVENT.length).toBeGreaterThan(0);
    expect(FILES.filter((f) => !f.exists).map((f) => f.file)).toEqual([]);
  });

  // Covers: AC-5
  it('no listed file contains outlineColor: CHALK_CREAM', () => {
    const hits = [];
    for (const { file, text } of FILES) {
      for (const { i, code } of codeLines(text)) {
        if (/outlineColor\s*:\s*CHALK_CREAM\b/.test(code)) hits.push(`${file}:${i + 1}: ${code.trim()}`);
      }
    }
    expect(hits).toEqual([]);
  });

  // Covers: AC-5
  it('every rounded-full or 999/9999 radius is on a dot or a bar, or allowlisted with a reason', () => {
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
    expect(offenders, 'pill shapes that are not a dot or a bar and are not in tests/contracts/LOOK-7/allowlist.json').toEqual([]);
  });
});

describe('LOOK-7 allowlist', () => {
  // Covers: AC-5
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

  // Covers: AC-5
  it('the scan heuristics recognise a dot, a bar and a pill (self-check)', () => {
    expect(isDot('<span className="w-2 h-2 rounded-full" />')).toBe(true);
    expect(isDot("style={{ width: 9, height: 9, borderRadius: 999 }}")).toBe(true);
    expect(isBar('<div className="h-1.5 rounded-full bg-x" />')).toBe(true);
    expect(isBar("style={{ height: 6, borderRadius: 999 }}")).toBe(true);
    const pill = '<button className="px-3 py-1 rounded-full border" />';
    expect(isDot(pill) || isBar(pill)).toBe(false);
  });
});
