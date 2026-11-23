// LOOK-6b contract helper: a small WOFF 1.0 reader (no new dependency). Reads the table directory,
// inflates compressed tables with zlib, and exposes what the contract tests need:
//   unitsPerEm (head), advance widths (hhea + hmtx), the Unicode cmap (formats 4 and 12),
//   glyph names (post format 2.0) and the name table strings.
// Not a test file (no .test. in the name), so vitest does not collect it.
import fs from 'node:fs';
import zlib from 'node:zlib';

const cache = new Map();

export function readWoff(file) {
  if (cache.has(file)) return cache.get(file);
  const buf = fs.readFileSync(file);
  if (buf.toString('latin1', 0, 4) !== 'wOFF') throw new Error(`${file} is not a WOFF 1.0 file`);
  const numTables = buf.readUInt16BE(12);
  const tables = {};
  for (let i = 0; i < numTables; i++) {
    const at = 44 + i * 20;
    const tag = buf.toString('latin1', at, at + 4);
    const offset = buf.readUInt32BE(at + 4);
    const compLength = buf.readUInt32BE(at + 8);
    const origLength = buf.readUInt32BE(at + 12);
    const raw = buf.subarray(offset, offset + compLength);
    tables[tag] = compLength < origLength ? zlib.inflateSync(raw) : Buffer.from(raw);
  }
  const font = parse(tables);
  font.file = file;
  cache.set(file, font);
  return font;
}

function parse(t) {
  const unitsPerEm = t.head.readUInt16BE(18);
  const numGlyphs = t.maxp.readUInt16BE(4);
  const numberOfHMetrics = t.hhea.readUInt16BE(34);
  const advances = new Array(numGlyphs);
  let last = 0;
  for (let g = 0; g < numGlyphs; g++) {
    if (g < numberOfHMetrics) last = t.hmtx.readUInt16BE(g * 4);
    advances[g] = last;
  }
  return {
    unitsPerEm,
    numGlyphs,
    advances,
    cmap: parseCmap(t.cmap),
    glyphNames: t.post ? parsePostNames(t.post, numGlyphs) : null,
    names: t.name ? parseNames(t.name) : [],
  };
}

function parseCmap(c) {
  const n = c.readUInt16BE(2);
  const subs = [];
  for (let i = 0; i < n; i++) {
    const at = 4 + i * 8;
    subs.push({ platform: c.readUInt16BE(at), encoding: c.readUInt16BE(at + 2), offset: c.readUInt32BE(at + 4) });
  }
  const unicode = (s) => s.platform === 0 || (s.platform === 3 && (s.encoding === 1 || s.encoding === 10));
  const map = new Map();
  // Read every Unicode subtable (format 4 and 12); later ones fill in, they never conflict in practice.
  for (const s of subs.filter(unicode)) {
    const format = c.readUInt16BE(s.offset);
    if (format === 4) readFormat4(c, s.offset, map);
    else if (format === 12) readFormat12(c, s.offset, map);
  }
  return map;
}

function readFormat4(c, o, map) {
  const segCount = c.readUInt16BE(o + 6) / 2;
  const endAt = o + 14;
  const startAt = endAt + segCount * 2 + 2;
  const deltaAt = startAt + segCount * 2;
  const rangeAt = deltaAt + segCount * 2;
  for (let i = 0; i < segCount; i++) {
    const end = c.readUInt16BE(endAt + i * 2);
    const start = c.readUInt16BE(startAt + i * 2);
    const delta = c.readInt16BE(deltaAt + i * 2);
    const rangeOffset = c.readUInt16BE(rangeAt + i * 2);
    for (let cp = start; cp <= end && cp !== 0xffff; cp++) {
      let gid;
      if (rangeOffset === 0) gid = (cp + delta) & 0xffff;
      else {
        const at = rangeAt + i * 2 + rangeOffset + (cp - start) * 2;
        gid = c.readUInt16BE(at);
        if (gid !== 0) gid = (gid + delta) & 0xffff;
      }
      if (gid !== 0 && !map.has(cp)) map.set(cp, gid);
    }
  }
}

function readFormat12(c, o, map) {
  const groups = c.readUInt32BE(o + 12);
  for (let i = 0; i < groups; i++) {
    const at = o + 16 + i * 12;
    const start = c.readUInt32BE(at);
    const end = c.readUInt32BE(at + 4);
    const g0 = c.readUInt32BE(at + 8);
    for (let cp = start; cp <= end; cp++) if (!map.has(cp)) map.set(cp, g0 + (cp - start));
  }
}

// post format 2.0: indices < 258 are the standard Macintosh names (returned as "#std<index>", plus the
// ten digit names, which are all this test needs from that list); indices >= 258 are Pascal strings.
const STD_DIGITS = { 19: 'zero', 20: 'one', 21: 'two', 22: 'three', 23: 'four', 24: 'five', 25: 'six', 26: 'seven', 27: 'eight', 28: 'nine' };
function parsePostNames(p, numGlyphs) {
  const version = p.readUInt32BE(0);
  if (version !== 0x00020000) return null;
  const n = p.readUInt16BE(32);
  const idx = [];
  for (let i = 0; i < n; i++) idx.push(p.readUInt16BE(34 + i * 2));
  const custom = [];
  let at = 34 + n * 2;
  while (at < p.length) {
    const len = p[at];
    custom.push(p.toString('latin1', at + 1, at + 1 + len));
    at += 1 + len;
  }
  const names = new Array(numGlyphs);
  for (let g = 0; g < numGlyphs; g++) {
    const k = idx[g];
    names[g] = k >= 258 ? custom[k - 258] : STD_DIGITS[k] || `#std${k}`;
  }
  return names;
}

function parseNames(t) {
  const count = t.readUInt16BE(2);
  const strOff = t.readUInt16BE(4);
  const out = [];
  for (let i = 0; i < count; i++) {
    const at = 6 + i * 12;
    const platform = t.readUInt16BE(at);
    const nameID = t.readUInt16BE(at + 6);
    const length = t.readUInt16BE(at + 8);
    const offset = t.readUInt16BE(at + 10);
    const raw = t.subarray(strOff + offset, strOff + offset + length);
    let text;
    if (platform === 0 || platform === 3) {
      const sw = Buffer.from(raw);
      sw.swap16();
      text = sw.toString('utf16le');
    } else text = raw.toString('latin1');
    out.push({ platform, nameID, text });
  }
  return out;
}

/** Width in px of `s` drawn at `size` px (advance widths only, no kerning). Missing glyphs count 0.6 em. */
export function measure(font, s, size) {
  let units = 0;
  for (const ch of String(s)) {
    const g = font.cmap.get(ch.codePointAt(0));
    units += g ? font.advances[g] : 0.6 * font.unitsPerEm;
  }
  return (units / font.unitsPerEm) * size;
}

/** Characters of `s` the font has no glyph for (whitespace other than the space and no-break space included). */
export function missingChars(font, s) {
  const miss = new Set();
  for (const ch of String(s)) if (!font.cmap.has(ch.codePointAt(0))) miss.add(ch);
  return [...miss];
}
