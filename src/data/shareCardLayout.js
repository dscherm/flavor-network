/**
 * shareCardLayout.js — SHARE-5. Pure, renderer-agnostic description of the recipe
 * cards people post. No DOM, no canvas, no fetch, and one import (flavorCharts.js, the chart pieces, which itself imports
 * flavorDisplay.js; scripts/buildShareIndex.mjs inlines both into the generated copy): the browser canvas
 * renderer and the Cloud Function (satori) both draw exactly what this returns.
 * scripts/buildShareIndex.mjs copies this file into functions/src/share/ as a
 * generated file, so keep it self-contained.
 *

 * CHART-4: the chart is design D, the tasting note: the sentence flavorNote() words (each note word underlined in its
 * colour) and two strips, Taste and Aroma, on one scale (flavorStrips). Nothing is capped or hidden. The first card of a set
 * also draws the fixed wheel (flavorWheel).
 * layoutCard({ format, recipe, bars, link, page })  ->  Card
 *   format  'preview' (1200x630) | 'portrait' (1080x1350) | 'tall' (1080x1920)
 *   recipe  { kind, name, lines: [{ amount, label?, key, suggested? }], method, glass?, garnish?,
 *             category?, meta?, lineCount? }   lineCount = the real number of ingredients when
 *             `lines` was cut short (the server keeps only the first few)
 *   picture (PICTURE-4, optional on recipe) { src, w?, h?, kind?: 'chalk'|'icon' }  src = a data: URI (the chalk picture, or a drawing as SVG);
 *           a recipe without one is laid out exactly as before. Where it goes: link preview, in the right column above the
 *           tasting note; portrait and tall, in the space a short recipe leaves empty (a small corner picture beside the name
 *           when there is none); set of three, above the name on card 1 when there is room.
 *   bars    [{ label, color, score 0..1 }] strongest first, or null/[] for "no profile data"
 *           (the chart is then omitted, never drawn empty)
 *   link    the short link as printed text, e.g. "neuralflavor.web.app/r/cocktail/negroni"
 * layoutSet({ format: 'portrait'|'tall', recipe, bars, link }) -> [Card, Card, Card]
 *   1 name + flavor chart, 2 ingredients, 3 method.
 *
 * Card = { id, format, width, height, safeTop, safeBottom, background: { inner, mid, outer },
 *          primitives: [Primitive] }
 * Primitive (all coordinates in card pixels, y grows downward):
 *   { type: 'rect', x, y, w, h, fill?, stroke?, strokeWidth?, radius? }
 *   { type: 'line', x1, y1, x2, y2, color, width, dash? }
 *   { type: 'text', x, y, w, h, text, size, weight, color, font: 'hand'|'sans', align: 'left'|'center'|'right', runs? }
 *     `runs` (the tasting note only): [{ text, underline?: colour }] pieces of `text`, in order; the renderer draws them
 *     inline and underlines those with a colour. A renderer that ignores `runs` draws `text` plain.
 *   { type: 'image', x, y, w, h, src, fit: 'cover'|'contain', radius? }   a picture (PICTURE-4); src is a data: URI
 *   { type: 'wedge', cx, cy, r0, r1, a0, a1, fill }   a ring sector, angles in degrees (-90 = top, clockwise)
 *     one line of text per primitive; (x, y, w, h) is its box, h = the line height. Layout has
 *     already wrapped, shrunk and truncated: renderers never measure or wrap.
 */

import { flavorNote, flavorStrips, flavorWheel } from './flavorCharts.js';

export const SITE_NAME = 'Neural Flavor';

/** The two faces cards are drawn in, by name: both renderers read this and nothing else names a face. */
export const CARD_FACES = { hand: 'Caveat', sans: 'Alegreya Sans Lining' };
export const CHART_CAPTION = 'flavor chart: a visual guide';
export const MORE_AT_LINK = (n) => `+${n} more at the link`;

// Chalkboard palette: the same values as src/components/inventUi.jsx / chalkTheme.js
// (a unit test keeps them equal).
export const PALETTE = {
  inner: '#1c1c1c', mid: '#0a0a0a', outer: '#050505',
  cream: '#f5efde', dim: '#bdb6a3', sub: '#8a8478', rail: '#4a4a4a', accent: '#e8c97a',
};

export const FORMATS = {
  preview: { width: 1200, height: 630, safeTop: 0, safeBottom: 0 },
  portrait: { width: 1080, height: 1350, safeTop: 0, safeBottom: 0 },
  // Stories and TikTok cover the top and bottom of the screen with their own buttons.
  tall: { width: 1080, height: 1920, safeTop: 250, safeBottom: 250 },
};

const KIND_WORD = { cocktail: 'Cocktail', sauce: 'Sauce', dish: 'Dish' };

// ---- deterministic text measuring (no DOM): per-character width, in em ------------------------
const NARROW = new Set([' ', 'i', 'l', 'j', '.', ',', ':', ';', "'", '’', '!', '|', '`']);
const MIDDLE = new Set(['f', 't', 'r', 'I', '(', ')', '-', '/', '[', ']', '·', '…']);
const WIDE = new Set(['m', 'w', 'M', 'W', '@', '%', '½', '¼', '¾']);

function emWidth(ch) {
  if (NARROW.has(ch)) return 0.3;
  if (MIDDLE.has(ch)) return 0.4;
  if (WIDE.has(ch)) return 0.9;
  if (ch >= '0' && ch <= '9') return 0.62;
  if (ch >= 'A' && ch <= 'Z') return 0.68;
  return 0.56;
}

/** Estimated width in pixels. Slightly generous on purpose, so a line that "fits" really fits in both renderers. */
export function textWidth(text, size, { font = 'sans', weight = 400 } = {}) {
  let em = 0;
  for (const ch of String(text)) em += emWidth(ch);
  const face = font === 'hand' ? 0.8 : 1;
  const bold = weight >= 600 ? 1.12 : 1;
  return em * size * face * bold;
}

const fits = (text, size, o, maxW) => textWidth(text, size, o) <= maxW;

/** Longest prefix of `text` that fits with a trailing ellipsis; `text` unchanged when it fits whole. */
export function ellipsize(text, size, o, maxW) {
  const s = String(text);
  if (fits(s, size, o, maxW)) return s;
  const chars = [...s];
  let n = chars.length;
  while (n > 0 && !fits(`${chars.slice(0, n).join('').trimEnd()}…`, size, o, maxW)) n -= 1;
  return `${chars.slice(0, n).join('').trimEnd().replace(/[,;:\-/]$/, '')}…`;
}

/** Greedy word wrap into at most `maxLines` lines; the last line is ellipsized when text is left over. */
export function wrapText(text, size, o, maxW, maxLines) {
  const words = String(text).replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
  if (!words.length) return [];
  const lines = [];
  let cur = '';
  const push = () => { if (cur) lines.push(cur); cur = ''; };
  for (const word of words) {
    const next = cur ? `${cur} ${word}` : word;
    if (fits(next, size, o, maxW)) { cur = next; continue; }
    push();
    if (fits(word, size, o, maxW)) { cur = word; continue; }
    // One word wider than the line: break it by characters.
    let rest = [...word];
    while (rest.length) {
      let n = rest.length;
      while (n > 1 && !fits(rest.slice(0, n).join(''), size, o, maxW)) n -= 1;
      lines.push(rest.slice(0, n).join(''));
      rest = rest.slice(n);
    }
  }
  push();
  if (lines.length <= maxLines) return lines;
  const kept = lines.slice(0, maxLines - 1);
  kept.push(ellipsize(lines.slice(maxLines - 1).join(' '), size, o, maxW));
  return kept;
}

/**
 * A name: shrink first (down to 70%), then wrap to two lines, then truncate with an ellipsis.
 * -> { size, lines }
 */
export function fitName(name, { size, maxW, font = 'hand', weight = 700, minScale = 0.7, maxLines = 2 }) {
  const o = { font, weight };
  const text = String(name || '').replace(/\s+/g, ' ').trim();
  for (let s = size; s >= Math.round(size * minScale); s -= 2) {
    if (fits(text, s, o, maxW)) return { size: s, lines: [text] };
  }
  const s2 = Math.round(size * 0.8);
  return { size: s2, lines: wrapText(text, s2, o, maxW, maxLines) };
}

// ---- builders ------------------------------------------------------------------------------------
const lineH = (size, lh) => Math.round(size * lh);

export const STEADY_SCALE = 1.08;
const FRAC = { '⅓': '1/3', '⅔': '2/3', '⅛': '1/8', '⅜': '3/8', '⅝': '5/8', '⅞': '7/8', '⅕': '1/5', '⅖': '2/5', '⅗': '3/5', '⅘': '4/5', '⅙': '1/6', '⅚': '5/6' };
export const plainFractions = (t) => String(t).replace(/(\d)([⅓⅔⅛⅜⅝⅞⅕⅖⅗⅘⅙⅚])/g, '$1 $2').replace(/[⅓⅔⅛⅜⅝⅞⅕⅖⅗⅘⅙⅚]/g, (c) => FRAC[c]);
function text(prims, { x, y, w, text: t0, size, weight = 400, color = PALETTE.cream, font = 'sans', align = 'left', lh = 1.25 }) {
  const t = plainFractions(t0).replace(/[⠀​-‍⁠﻿]/g, '');
  const h = lineH(size, lh);
  const drawn = font === 'sans' ? Math.round(size * STEADY_SCALE) : size;
  prims.push({ type: 'text', x: Math.round(x), y: Math.round(y), w: Math.round(w), h, text: t, size: drawn, weight, color, font, align });
  return h;
}

const kindLabel = (recipe) => {
  const word = KIND_WORD[recipe.kind] || 'Recipe';
  return recipe.category ? `${recipe.category} ${word.toLowerCase()}` : word;
};

const cleanLines = (recipe) => (Array.isArray(recipe.lines) ? recipe.lines : []).filter((l) => l && (l.label || l.key));
const totalLines = (recipe) => Math.max(recipe.lineCount || 0, cleanLines(recipe).length);
const stepsOf = (recipe) => String(recipe.method || '').split('\n').map((s) => s.trim()).filter(Boolean);

function frame(format) {
  const f = FORMATS[format];
  if (!f) throw new Error(`unknown card format: ${format}`);
  const prims = [];
  const pad = format === 'preview' ? 48 : 72;
  prims.push({ type: 'rect', x: 18, y: 18, w: f.width - 36, h: f.height - 36, stroke: PALETTE.rail, strokeWidth: 3, radius: 10 });
  return { ...f, format, prims, pad, x0: pad, x1: f.width - pad, top: f.safeTop + (format === 'tall' ? 20 : pad - 8), bottom: f.height - f.safeBottom - (format === 'tall' ? 20 : pad - 8) };
}

function finish(id, fr) {
  return {
    id, format: fr.format, width: fr.width, height: fr.height, safeTop: fr.safeTop, safeBottom: fr.safeBottom,
    background: { inner: PALETTE.inner, mid: PALETTE.mid, outer: PALETTE.outer }, primitives: fr.prims,
  };
}

/**
 * Footer: site name and the printed link. Returns the y where the footer starts (content must end above it).
 * The link is shrunk, then split at a "/" into two lines, so it is never truncated.
 */
function footer(fr, link, page) {
  const small = fr.format === 'preview';
  const siteSize = small ? 38 : 50;
  const linkSize0 = small ? 26 : 32;
  const w = fr.x1 - fr.x0;
  const linkText = String(link || '');
  const pageText = page || '';
  const pageW = pageText ? 90 : 0;
  const siteW = textWidth(SITE_NAME, siteSize, { font: 'hand', weight: 700 });

  let linkSize = linkSize0;
  let linkLines = [linkText];
  const lo = Math.round(linkSize0 * 0.7);
  while (linkSize > lo && textWidth(linkText, linkSize, { weight: 500 }) > w) linkSize -= 1;
  if (textWidth(linkText, linkSize, { weight: 500 }) > w) {
    linkSize = linkSize0 - 6;
    const cut = linkText.lastIndexOf('/', Math.floor(linkText.length * 0.7));
    linkLines = cut > 0 ? [linkText.slice(0, cut + 1), linkText.slice(cut + 1)] : wrapText(linkText, linkSize, { weight: 500 }, w, 2);
  }
  const linkH = lineH(linkSize, 1.3);
  const sameRow = linkLines.length === 1 && siteW + 40 + textWidth(linkText, linkSize, { weight: 500 }) + pageW <= w;
  const siteH = lineH(siteSize, 1.1);
  const height = sameRow ? Math.max(siteH, linkH) : siteH + 6 + linkH * linkLines.length;
  const y = fr.bottom - height;
  fr.prims.push({ type: 'line', x1: fr.x0, y1: y - 14, x2: fr.x1, y2: y - 14, color: PALETTE.rail, width: 2 });
  if (sameRow) {
    text(fr.prims, { x: fr.x0, y: y + (height - siteH) / 2, w: siteW + 8, text: SITE_NAME, size: siteSize, weight: 700, font: 'hand', color: PALETTE.accent, lh: 1.1 });
    text(fr.prims, { x: fr.x0 + siteW + 40, y: y + (height - linkH) / 2, w: w - siteW - 40 - pageW, text: linkText, size: linkSize, weight: 500, color: PALETTE.cream, align: 'right' });
  } else {
    text(fr.prims, { x: fr.x0, y, w: siteW + 8, text: SITE_NAME, size: siteSize, weight: 700, font: 'hand', color: PALETTE.accent, lh: 1.1 });
    linkLines.forEach((ln, i) => text(fr.prims, { x: fr.x0, y: y + siteH + 6 + i * linkH, w, text: ln, size: linkSize, weight: 500, color: PALETTE.cream }));
  }
  if (pageText) text(fr.prims, { x: fr.x1 - pageW, y: y + (sameRow ? (height - siteH) / 2 : 0), w: pageW, text: pageText, size: small ? 24 : 30, color: PALETTE.sub, align: 'right' });
  return y - 14;
}

const cap1 = (t) => t.charAt(0).toUpperCase() + t.slice(1);

/** Splits one wrapped line of the sentence into runs, underlining each note word in its colour. */
function noteRuns(line, colorOf) {
  const runs = [];
  for (const piece of line.match(/[A-Za-z]+|[^A-Za-z]+/g) || []) {
    const color = colorOf.get(piece.toLowerCase());
    const last = runs[runs.length - 1];
    if (color) runs.push({ text: piece, underline: color });
    else if (last && !last.underline) last.text += piece;
    else runs.push({ text: piece });
  }
  return runs;
}

/**
 * The tasting note (design D) as primitives relative to y = 0, x absolute: the sentence (wrapped, note words underlined), then
 * the Taste and Aroma strips on one scale, a label under each segment flavorStrips marks, and the caption.
 * -> { prims, height }, or null when there is nothing to draw.
 */
function noteBlock(bars, { x, w, size, maxLines, strip, caption }) {
  const note = flavorNote(bars);
  if (!note.text) return null;
  const strips = flavorStrips(bars);
  const prims = [];
  const colorOf = new Map(note.words.map((wd) => [wd.label.toLowerCase(), wd.color || PALETTE.accent]));
  const o = { font: 'sans', weight: 400 };
  const lines = wrapText(note.text, size, o, w, maxLines);
  const lh = lineH(size, 1.3);
  let y = 0;
  lines.forEach((ln) => {
    text(prims, { x, y, w, text: ln, size, weight: 400, font: 'sans', color: PALETTE.cream, lh: 1.3 });
    prims[prims.length - 1].runs = noteRuns(ln, colorOf);
    y += lh;
  });
  y += Math.round(size * 0.55);
  const labelW = strip.labelW;
  const trackX = x + labelW;
  const trackW = w - labelW;
  for (const [title, row] of [['Taste', strips.taste], ['Aroma', strips.aroma]]) {
    if (!row.segments.length) continue;
    text(prims, { x, y: y + Math.round((strip.h - lineH(strip.label, 1.2)) / 2), w: labelW - 12, text: title, size: strip.label, weight: 400, color: PALETTE.sub, lh: 1.2 });
    prims.push({ type: 'rect', x: trackX, y, w: trackW, h: strip.h, fill: 'rgba(255,255,255,0.07)', radius: 3 });
    let sx = trackX;
    row.segments.forEach((sg, i) => {
      const sw = Math.max(3, Math.round(sg.length * trackW));
      const gap = i < row.segments.length - 1 ? 2 : 0;
      prims.push({ type: 'rect', x: sx, y, w: Math.max(2, sw - gap), h: strip.h, fill: sg.color || PALETTE.accent, radius: 3 });
      if (sg.labelled) text(prims, { x: sx, y: y + strip.h + 4, w: Math.max(2, sw - gap), text: ellipsize(sg.label, strip.label, {}, Math.max(2, sw - gap)), size: strip.label, color: PALETTE.dim, lh: 1.2 });
      sx += sw;
    });
    y += strip.h + 4 + lineH(strip.label, 1.2) + strip.gap;
  }
  y += 2;
  y += text(prims, { x, y, w, text: CHART_CAPTION, size: caption, color: PALETTE.sub, align: 'left' });
  return { prims, height: y };
}

/** Puts a block's primitives into the card, dy pixels down. */
function place(fr, block, dy) {
  for (const p of block.prims) fr.prims.push(p.type === 'line' ? { ...p, y1: p.y1 + dy, y2: p.y2 + dy } : { ...p, y: p.y + dy });
}

/** The fixed wheel (seventeen wedges, strongest four labelled) centred on (cx, cy); the labels sit outside the rim. */
function wheelPrims(fr, bars, cx, cy, R, labelSize) {
  const wheel = flavorWheel(bars, 'card');
  const R0 = Math.round(R * 0.2);
  for (const wg of wheel.wedges) fr.prims.push({ type: 'wedge', cx, cy, r0: R0, r1: R, a0: wg.start, a1: wg.end, fill: 'rgba(255,255,255,0.08)' });
  for (const wg of wheel.wedges) {
    if (wg.on) fr.prims.push({ type: 'wedge', cx, cy, r0: R0, r1: Math.round(R0 + (R - R0) * wg.drawn), a0: wg.start, a1: wg.end, fill: wg.color || PALETTE.accent });
  }
  const lh = lineH(labelSize, 1.2);
  const boxW = Math.round(labelSize * 7);
  for (const wg of wheel.wedges) {
    if (!wg.labelled) continue;
    const rad = (wg.mid * Math.PI) / 180;
    const c = Math.cos(rad);
    const sn = Math.sin(rad);
    const rr = R + 16 + (Math.abs(c) < 0.5 && wg.index % 2 ? Math.round(labelSize * 0.9) : 0);
    const px = cx + c * rr;
    const py = cy + sn * rr;
    const align = c > 0.25 ? 'left' : c < -0.25 ? 'right' : 'center';
    const bx = align === 'left' ? px : align === 'right' ? px - boxW : px - boxW / 2;
    text(fr.prims, { x: bx, y: py - lh / 2 + (sn > 0.3 ? lh * 0.4 : sn < -0.3 ? -lh * 0.4 : 0), w: boxW, text: wg.label, size: labelSize, color: PALETTE.cream, align, lh: 1.2 });
  }
  text(fr.prims, { x: fr.x0, y: cy + R + labelSize * 1.9, w: fr.x1 - fr.x0, text: 'Left side: tastes. The rest: aromas.', size: Math.max(18, labelSize - 4), color: PALETTE.sub, align: 'center', lh: 1.2 });
}

/** Moves the primitives from index `from` on down by dy. */
function shift(prims, from, dy) {
  for (let i = from; i < prims.length; i += 1) {
    const p = prims[i];
    if (p.type === 'line') { p.y1 += dy; p.y2 += dy; } else p.y += dy;
  }
}

// ---- the recipe's picture (PICTURE-4) -------------------------------------------------------------------
/** The picture to draw, or null: a data: URI is required, anything else is ignored. */
function pictureOf(recipe) {
  const p = recipe && recipe.picture;
  if (!p || typeof p.src !== 'string' || !p.src.startsWith('data:')) return null;
  const w = Number.isFinite(p.w) && p.w > 0 ? p.w : 1;
  const h = Number.isFinite(p.h) && p.h > 0 ? p.h : 1;
  return { src: p.src, ratio: Math.min(2, Math.max(0.5, w / h)), icon: p.kind === 'icon' };
}

/** A picture box inside a maxW x maxH area, keeping the picture's shape. */
function pictureBox(pic, maxW, maxH) {
  let w = Math.min(maxW, maxH * pic.ratio);
  let h = w / pic.ratio;
  if (h > maxH) { h = maxH; w = h * pic.ratio; }
  return { w: Math.round(w), h: Math.round(h) };
}

/**
 * The picture as primitives: a thin chalk frame, then the image inside it. A chalk picture fills the frame
 * (the frame IS its edge); a drawing sits inset with room around it.
 */
function picturePrims(prims, pic, x, y, w, h) {
  const inset = pic.icon ? Math.round(Math.min(w, h) * 0.08) : 0;
  prims.push({ type: 'rect', x, y, w, h, fill: pic.icon ? 'rgba(255,255,255,0.04)' : PALETTE.mid, radius: 14 });
  prims.push({ type: 'image', x: x + inset, y: y + inset, w: w - 2 * inset, h: h - 2 * inset, src: pic.src, fit: pic.icon ? 'contain' : 'cover', radius: pic.icon ? 0 : 14 });
  prims.push({ type: 'rect', x, y, w, h, stroke: PALETTE.rail, strokeWidth: 3, radius: 14 });
}

/** Ingredient rows (amount column + name) into [y, yMax]. Ends with "+N more at the link" when it cannot fit all. */
function ingredientRows(fr, y, yMax, recipe, { x, w, size, row, amountW }) {
  const lines = cleanLines(recipe);
  const total = totalLines(recipe);
  const cap = Math.max(1, Math.floor((yMax - y) / row));
  const showAll = total <= cap && lines.length >= total;
  const shown = showAll ? lines.length : Math.min(lines.length, Math.max(0, cap - 1));
  const nameX = x + amountW + 20;
  const nameW = w - amountW - 20;
  for (let i = 0; i < shown; i += 1) {
    const l = lines[i];
    const ry = y + i * row;
    const amount = l.amount || '';
    if (amount) text(fr.prims, { x, y: ry, w: amountW, text: ellipsize(amount, size, { weight: 500 }, amountW), size, weight: 500, color: l.suggested ? PALETTE.sub : PALETTE.accent, align: 'right', lh: row / size });
    text(fr.prims, { x: nameX, y: ry, w: nameW, text: ellipsize(l.label || l.key, size, {}, nameW), size, color: PALETTE.cream, lh: row / size });
    fr.prims.push({ type: 'line', x1: x, y1: ry + row - 2, x2: x + w, y2: ry + row - 2, color: PALETTE.rail, width: 1, dash: [6, 6] });
  }
  let end = y + shown * row;
  if (total > shown) {
    text(fr.prims, { x, y: end + 4, w, text: MORE_AT_LINK(total - shown), size: Math.round(size * 0.9), color: PALETTE.accent, align: 'left', lh: row / size });
    end += row;
  }
  return end;
}

/** Method steps wrapped into [y, yMax]; ends with "+N more at the link" when cut. */
function methodBlock(fr, y, yMax, steps, { x, w, size, lh, gap }) {
  const row = lineH(size, lh);
  const o = {};
  const numW = Math.round(size * 1.5);
  const blocks = steps.map((s, i) => ({ n: `${i + 1}.`, lines: wrapText(s, size, o, w - numW, 40) }));
  const avail = yMax - y;
  let used = 0;
  let count = 0;
  for (let i = 0; i < blocks.length; i += 1) {
    const h = blocks[i].lines.length * row + (i ? gap : 0);
    const reserve = i < blocks.length - 1 ? row + gap : 0;
    if (used + h + reserve > avail) break;
    used += h;
    count += 1;
  }
  let cy = y;
  const drawBlock = (b, maxLines) => {
    const ls = b.lines.length > maxLines ? [...b.lines.slice(0, maxLines - 1), ellipsize(b.lines.slice(maxLines - 1).join(' '), size, o, w - numW)] : b.lines;
    text(fr.prims, { x, y: cy, w: numW, text: b.n, size, weight: 500, color: PALETTE.accent, lh });
    ls.forEach((ln, k) => text(fr.prims, { x: x + numW, y: cy + k * row, w: w - numW, text: ln, size, color: PALETTE.cream, lh }));
    cy += ls.length * row + gap;
  };
  if (count === 0 && blocks.length) {
    // The first step alone is too long: show its start, then point at the link.
    const keep = Math.max(1, Math.floor((avail - row - gap) / row));
    drawBlock(blocks[0], keep);
    if (blocks.length > 1) text(fr.prims, { x, y: cy, w, text: MORE_AT_LINK(blocks.length - 1), size: Math.round(size * 0.9), color: PALETTE.accent, lh });
    else text(fr.prims, { x, y: cy, w, text: 'The rest is at the link', size: Math.round(size * 0.9), color: PALETTE.accent, lh });
    return;
  }
  for (let i = 0; i < count; i += 1) drawBlock(blocks[i], 40);
  if (count < blocks.length) text(fr.prims, { x, y: cy, w, text: MORE_AT_LINK(blocks.length - count), size: Math.round(size * 0.9), color: PALETTE.accent, lh });
}

function header(fr, recipe, { nameSize, align = 'left', maxLines = 2 }) {
  let y = fr.top;
  const w = fr.x1 - fr.x0;
  const labelSize = fr.format === 'preview' ? 24 : 30;
  y += text(fr.prims, { x: fr.x0, y, w, text: ellipsize(kindLabel(recipe), labelSize, {}, w), size: labelSize, weight: 400, color: PALETTE.sub, align, lh: 1.3 }) + 6;
  const fit = fitName(recipe.name, { size: nameSize, maxW: w, maxLines });
  fit.lines.forEach((ln) => { y += text(fr.prims, { x: fr.x0, y, w, text: ln, size: fit.size, weight: 700, font: 'hand', color: PALETTE.cream, align, lh: 1.05 }); });
  return y;
}

const subline = (recipe) => [recipe.meta, recipe.glass ? `Glass: ${recipe.glass}` : '', recipe.garnish ? `Garnish: ${recipe.garnish}` : ''].filter(Boolean).join('   ');

/**
 * The link-preview card without a chart: nothing sits on the right, so the name and ingredients use the
 * full width. Up to five ingredients: one larger column, centred in the free space. Six or more: two columns.
 */
function previewNoChart(fr, r, sub, footerTop) {
  const w = fr.x1 - fr.x0;
  let y = header(fr, r, { nameSize: 110 });
  if (sub) y += text(fr.prims, { x: fr.x0, y: y + 2, w, text: ellipsize(sub, 28, {}, w), size: 28, color: PALETTE.dim }) + 6;
  y += 14;
  const total = totalLines(r);
  const lines = cleanLines(r);
  const from = fr.prims.length;
  let end;
  if (total >= 6) {
    const gap = 56;
    const colW = Math.round((w - gap) / 2);
    const half = Math.ceil(lines.length / 2);
    const o = { size: 28, row: 40, amountW: 190 };
    const a = ingredientRows(fr, y, footerTop - 8, { ...r, lines: lines.slice(0, half), lineCount: half }, { x: fr.x0, w: colW, ...o });
    const b = ingredientRows(fr, y, footerTop - 8, { ...r, lines: lines.slice(half), lineCount: total - half }, { x: fr.x0 + colW + gap, w: colW, ...o });
    end = Math.max(a, b);
  } else {
    end = ingredientRows(fr, y, footerTop - 8, r, { x: fr.x0, w, size: 40, row: 60, amountW: 300 });
  }
  const free = footerTop - 8 - end;
  if (free > 40) shift(fr.prims, from, Math.round(free * 0.4));
  return fr;
}

// ---- the three single cards ------------------------------------------------------------------------
/** Link preview with a picture: header and ingredients on the left, the picture above the tasting note on the right. */
function previewWithPicture(fr, r, bars, sub, footerTop, pic) {
  const w = fr.x1 - fr.x0;
  const colW = Math.round(w * 0.52);
  const left = { ...fr, x1: fr.x0 + colW };
  let y = header(left, r, { nameSize: 92 });
  if (sub) y += text(fr.prims, { x: fr.x0, y: y + 2, w: colW, text: ellipsize(sub, 24, {}, colW), size: 24, color: PALETTE.dim }) + 6;
  y += 10;
  ingredientRows(fr, y, footerTop - 8, r, { x: fr.x0, w: colW, size: 28, row: 38, amountW: 215 });
  const cx = fr.x0 + colW + 48;
  const cw = fr.x1 - cx;
  const top = fr.top + 14;
  const avail = footerTop - 8 - top;
  const GAP = 22;
  const MIN = 150;
  let b = null;
  // The note keeps its size when the picture can still be MIN tall; otherwise it tightens before the picture shrinks.
  for (const [size, maxLines] of [[34, 4], [30, 3], [26, 3]]) {
    b = noteBlock(bars, { x: cx, w: cw, size, maxLines, strip: { labelW: 92, h: 14, label: 20, gap: 12 }, caption: 24 });
    if (!b || b.height + GAP + MIN <= avail) break;
  }
  const noteH = b ? b.height + GAP : 0;
  const box = pictureBox(pic, cw, Math.min(300, avail - noteH));
  const groupH = box.h + noteH;
  const gy = Math.max(top, Math.round(top + (avail - groupH) / 2));
  picturePrims(fr.prims, pic, Math.round(cx + (cw - box.w) / 2), gy, box.w, box.h);
  if (b) place(fr, b, gy + box.h + GAP);
  return fr;
}

/**
 * Portrait and tall: name, ingredients, chart. With a picture: a short recipe leaves free room, and the picture
 * takes it (centred above the ingredients); when there is no such room it is a small picture beside the name.
 * `opt.inflow` { w, h } / `opt.thumb` { size } are what `layoutCard` decided after a dry run with neither.
 */
function singleCard(format, r, bars, link, page, opt = {}) {
  const fr = frame(format);
  const w = fr.x1 - fr.x0;
  const footerTop = footer(fr, link, page);
  const sub = subline(r);
  const tall = format === 'tall';
  const thumb = opt.thumb || null;
  const hr = thumb ? { ...fr, x1: fr.x1 - thumb.size - 28 } : fr;
  let y = header(hr, r, { nameSize: tall ? 128 : 118 });
  if (sub) y += text(fr.prims, { x: fr.x0, y: y + 4, w: thumb ? hr.x1 - fr.x0 : w, text: ellipsize(sub, 30, {}, thumb ? hr.x1 - fr.x0 : w), size: 30, color: PALETTE.dim }) + 10;
  y += 14;
  if (thumb) {
    picturePrims(fr.prims, opt.pic, fr.x1 - thumb.size, fr.top + 4, thumb.size, thumb.size);
    y = Math.max(y, fr.top + 4 + thumb.size + 18);
  }
  const blk = noteBlock(bars, { x: fr.x0, w, size: tall ? 46 : 44, maxLines: 3, strip: { labelW: 120, h: tall ? 20 : 18, label: tall ? 26 : 24, gap: 14 }, caption: 30 });
  const row = tall ? 52 : 46;
  const gap = blk ? 36 : 0;
  const from = fr.prims.length;
  if (opt.inflow) {
    picturePrims(fr.prims, opt.pic, Math.round(fr.x0 + (w - opt.inflow.w) / 2), y, opt.inflow.w, opt.inflow.h);
    y += opt.inflow.h + 26;
  }
  let end = ingredientRows(fr, y, footerTop - (blk ? blk.height : 0) - gap - 8, r, { x: fr.x0, w, size: tall ? 36 : 34, row, amountW: 260 });
  if (blk) { place(fr, blk, end + gap); end += gap + blk.height; }
  // A short recipe leaves a gap: centre the ingredients and chart in the free space instead of hugging the top.
  const free = footerTop - 8 - end;
  if (free > 60) shift(fr.prims, from, Math.round(free * 0.4));
  return { fr, free };
}

export function layoutCard({ format = 'portrait', recipe, bars, link = '', page = '' }) {
  const fr = frame(format);
  const r = recipe || { name: '', lines: [], method: '' };
  const pic = pictureOf(r);

  if (format === 'preview') {
    const footerTop = footer(fr, link, page);
    const sub = subline(r);
    if (pic) return finish(`${format}`, previewWithPicture(fr, r, bars, sub, footerTop, pic));
    const w = fr.x1 - fr.x0;
    if (!flavorNote(bars).text) return finish(`${format}`, previewNoChart(fr, r, sub, footerTop));
    const colW = Math.round(w * 0.52);
    const left = { ...fr, x1: fr.x0 + colW };
    let y = header(left, r, { nameSize: 92 });
    if (sub) y += text(fr.prims, { x: fr.x0, y: y + 2, w: colW, text: ellipsize(sub, 24, {}, colW), size: 24, color: PALETTE.dim }) + 6;
    y += 10;
    ingredientRows(fr, y, footerTop - 8, r, { x: fr.x0, w: colW, size: 28, row: 38, amountW: 215 });
    const cx = fr.x0 + colW + 48;
    const cw = fr.x1 - cx;
    const b = noteBlock(bars, { x: cx, w: cw, size: 34, maxLines: 4, strip: { labelW: 92, h: 14, label: 20, gap: 12 }, caption: 24 });
    const cy = Math.max(fr.top + 30, Math.round((fr.top + footerTop - b.height) / 2));
    place(fr, b, cy);
    return finish(`${format}`, fr);
  }

  // portrait and tall: one card with name, ingredients, chart
  if (!pic) return finish(format, singleCard(format, r, bars, link, page).fr);
  const dry = singleCard(format, r, bars, link, page).free;
  const maxH = format === 'tall' ? 520 : 440;
  const w = FORMATS[format].width - 2 * (format === 'preview' ? 48 : 72);
  const room = dry - 26 - 8;
  if (room >= 200) {
    const box = pictureBox(pic, w, Math.min(maxH, room));
    return finish(format, singleCard(format, r, bars, link, page, { pic, inflow: box }).fr);
  }
  return finish(format, singleCard(format, r, bars, link, page, { pic, thumb: { size: format === 'tall' ? 190 : 170 } }).fr);
}

// ---- the set of three ---------------------------------------------------------------------------------
export function layoutSet({ format = 'portrait', recipe, bars, link = '' }) {
  if (format === 'preview') throw new Error('a set is portrait or tall');
  const r = recipe || { name: '', lines: [], method: '' };
  const tall = format === 'tall';

  // 1: name and chart
  const a = frame(format);
  const w = a.x1 - a.x0;
  const aFoot = footer(a, link, '1/3');
  const names = fitName(r.name, { size: tall ? 150 : 136, maxW: w });
  const labelSize = 32;
  const nameBlock = names.lines.length * lineH(names.size, 1.05);
  const n = totalLines(r);
  const info = [n ? `${n} ingredient${n === 1 ? '' : 's'}` : '', subline(r)].filter(Boolean).join('   ');
  const blk = noteBlock(bars, { x: a.x0, w, size: tall ? 50 : 46, maxLines: 3, strip: { labelW: 130, h: 22, label: 28, gap: 14 }, caption: 30 });
  // The wheel takes what the text leaves: its radius shrinks (down to 100) rather than run into the footer.
  const head = labelSize * 1.3 + 8 + nameBlock + (info ? 52 : 0);
  const room = aFoot - a.top - 40 - head - (blk ? blk.height + 44 : 0);
  // A picture goes above the label and takes only what the wheel can spare (the wheel keeps a radius of at least 130 with one).
  const pic = pictureOf(r);
  const spare = room - (blk ? 146 + 2 * 130 : 0) - 28;
  const picBox = pic && spare >= 150 ? pictureBox(pic, w, Math.min(tall ? 400 : 330, spare)) : null;
  const picH = picBox ? picBox.h + 28 : 0;
  const R = blk ? Math.max(100, Math.min(tall ? 210 : 190, Math.floor((room - picH - 146) / 2))) : 0;
  const blockH = picH + head + (blk ? 14 + blk.height + 30 + 2 * R + 146 : 0);
  let y = Math.max(a.top + 20, Math.round((a.top + aFoot - blockH) / 2));
  if (picBox) {
    picturePrims(a.prims, pic, Math.round(a.x0 + (w - picBox.w) / 2), y, picBox.w, picBox.h);
    y += picH;
  }
  y += text(a.prims, { x: a.x0, y, w, text: ellipsize(kindLabel(r), labelSize, {}, w), size: labelSize, weight: 400, color: PALETTE.sub, align: 'center', lh: 1.3 }) + 8;
  names.lines.forEach((ln) => { y += text(a.prims, { x: a.x0, y, w, text: ln, size: names.size, weight: 700, font: 'hand', color: PALETTE.cream, align: 'center', lh: 1.05 }); });
  if (info) y += text(a.prims, { x: a.x0, y: y + 10, w, text: ellipsize(info, 30, {}, w), size: 30, color: PALETTE.dim, align: 'center' }) + 42;
  if (blk) {
    place(a, blk, y + 14);
    wheelPrims(a, bars, Math.round(a.x0 + w / 2), y + 14 + blk.height + 30 + 36 + R, R, 28);
  }

  // 2: ingredients
  const b = frame(format);
  const bFoot = footer(b, link, '2/3');
  let by = b.top + 10;
  by += text(b.prims, { x: b.x0, y: by, w, text: ellipsize(r.name, 36, {}, w), size: 36, color: PALETTE.sub, lh: 1.3 }) + 4;
  by += text(b.prims, { x: b.x0, y: by, w, text: 'Ingredients', size: 96, weight: 700, font: 'hand', color: PALETTE.cream, lh: 1.05 }) + 16;
  const end = ingredientRows(b, by, bFoot - (r.garnish ? 70 : 12), r, { x: b.x0, w, size: 40, row: 62, amountW: 320 });
  if (r.garnish) text(b.prims, { x: b.x0, y: Math.min(end + 14, bFoot - 56), w, text: ellipsize(`Garnish: ${r.garnish}`, 32, {}, w), size: 32, color: PALETTE.dim });
  // A picture that had no room on the cover takes what a short ingredient list leaves empty here.
  if (pic && !picBox) {
    const below = Math.min(end + (r.garnish ? 70 : 0) + 30, bFoot - 8);
    const room2 = bFoot - 14 - below;
    if (room2 >= 220) {
      const box2 = pictureBox(pic, w, Math.min(tall ? 520 : 440, room2));
      picturePrims(b.prims, pic, Math.round(b.x0 + (w - box2.w) / 2), below + Math.round((room2 - box2.h) / 2), box2.w, box2.h);
    }
  }

  // 3: method
  const c = frame(format);
  const cFoot = footer(c, link, '3/3');
  let cy = c.top + 10;
  cy += text(c.prims, { x: c.x0, y: cy, w, text: ellipsize(r.name, 36, {}, w), size: 36, color: PALETTE.sub, lh: 1.3 }) + 4;
  cy += text(c.prims, { x: c.x0, y: cy, w, text: 'Method', size: 96, weight: 700, font: 'hand', color: PALETTE.cream, lh: 1.05 }) + 16;
  const steps = stepsOf(r);
  if (steps.length) methodBlock(c, cy, cFoot - 8, steps, { x: c.x0, w, size: 36, lh: 1.38, gap: 18 });
  else text(c.prims, { x: c.x0, y: cy, w, text: 'The full recipe is at the link.', size: 36, color: PALETTE.dim });

  return [finish('1', a), finish('2', b), finish('3', c)];
}

/** A card for a link that points at nothing we can show (unknown, removed): the site name and what it is. */
export function layoutSiteCard({ link = 'neuralflavor.web.app' } = {}) {
  const fr = frame('preview');
  const w = fr.x1 - fr.x0;
  const name = fitName(SITE_NAME, { size: 150, maxW: w });
  let y = 190;
  y += text(fr.prims, { x: fr.x0, y, w, text: name.lines[0], size: name.size, weight: 700, font: 'hand', color: PALETTE.accent, align: 'center', lh: 1.05 }) + 14;
  y += text(fr.prims, { x: fr.x0, y, w, text: 'Cocktails, sauces and dishes, built from what pairs well', size: 32, color: PALETTE.cream, align: 'center' }) + 24;
  text(fr.prims, { x: fr.x0, y, w, text: link, size: 28, weight: 500, color: PALETTE.dim, align: 'center' });
  return finish('site', fr);
}
