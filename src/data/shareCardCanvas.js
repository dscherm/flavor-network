/**
 * shareCardCanvas.js — SHARE-5. Draws a layout from shareCardLayout.js onto a <canvas> and returns PNG
 * files at the layout's exact pixel size. DOM only here; the layout is already wrapped, shrunk and
 * truncated, so this file never measures text.
 */
import { layoutCard, layoutSet } from './shareCardLayout.js';

const STACK = {
  hand: 'Caveat, "Comic Sans MS", cursive',
  sans: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
};

/** Waits for the handwriting font (a fallback face is drawn instead if it never arrives). */
export async function ensureFonts() {
  try {
    if (typeof document === 'undefined' || !document.fonts) return;
    await Promise.all([document.fonts.load('700 40px Caveat'), document.fonts.load('400 40px Caveat')]);
    await document.fonts.ready;
  } catch { /* fall back to the system cursive face */ }
}

function roundedPath(ctx, x, y, w, h, r) {
  const rr = Math.min(r || 0, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

export function drawCard(ctx, card) {
  const { width: W, height: H, background: bg } = card;
  // The slate wash: the CSS "radial-gradient(ellipse at center, inner 0%, mid 75%, outer 100%)".
  ctx.save();
  ctx.translate(W / 2, H / 2);
  const rx = (W / 2) * Math.SQRT2;
  ctx.scale(1, (H / 2) / (W / 2));
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
  g.addColorStop(0, bg.inner);
  g.addColorStop(0.75, bg.mid);
  g.addColorStop(1, bg.outer);
  ctx.fillStyle = g;
  ctx.fillRect(-W, -W, 2 * W, 2 * W);
  ctx.restore();

  for (const p of card.primitives) {
    if (p.type === 'rect') {
      roundedPath(ctx, p.x, p.y, p.w, p.h, p.radius);
      if (p.fill) { ctx.fillStyle = p.fill; ctx.fill(); }
      if (p.stroke) {
        const sw = p.strokeWidth || 1;
        roundedPath(ctx, p.x + sw / 2, p.y + sw / 2, p.w - sw, p.h - sw, p.radius);
        ctx.strokeStyle = p.stroke; ctx.lineWidth = sw; ctx.stroke();
      }
    } else if (p.type === 'line') {
      ctx.beginPath();
      ctx.setLineDash(p.dash || []);
      ctx.moveTo(p.x1, p.y1); ctx.lineTo(p.x2, p.y2);
      ctx.strokeStyle = p.color; ctx.lineWidth = p.width; ctx.stroke();
      ctx.setLineDash([]);
    } else if (p.type === 'text') {
      ctx.font = `${p.weight} ${p.size}px ${STACK[p.font] || STACK.sans}`;
      ctx.fillStyle = p.color;
      ctx.textBaseline = 'middle';
      ctx.textAlign = p.align;
      const x = p.align === 'center' ? p.x + p.w / 2 : p.align === 'right' ? p.x + p.w : p.x;
      ctx.fillText(p.text, x, p.y + p.h / 2 + p.size * 0.04);
    }
  }
}

/** One layout -> a PNG Blob of exactly card.width x card.height. */
export function cardToBlob(card) {
  const canvas = document.createElement('canvas');
  canvas.width = card.width;
  canvas.height = card.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return Promise.reject(new Error('no canvas'));
  drawCard(ctx, card);
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('could not make the picture'))), 'image/png');
  });
}

/**
 * The files for a choice: { count: 'one' | 'set', format: 'portrait' | 'tall' }.
 * -> File[] named "<slug>-card.png" or "<slug>-card-1.png" ... "-3.png".
 */
export async function renderCardFiles({ recipe, bars, link, count = 'one', format = 'portrait', slug = 'recipe' }) {
  const layouts = count === 'set'
    ? layoutSet({ format, recipe, bars, link })
    : [layoutCard({ format, recipe, bars, link })];
  await ensureFonts();
  const files = [];
  for (let i = 0; i < layouts.length; i += 1) {
    const blob = await cardToBlob(layouts[i]);
    files.push(new File([blob], layouts.length === 1 ? `${slug}-card.png` : `${slug}-card-${i + 1}.png`, { type: 'image/png' }));
  }
  return files;
}
