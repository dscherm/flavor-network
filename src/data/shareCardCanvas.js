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

/** Loads the pictures a layout asks for ({ type: 'image' }), by src. One that cannot be loaded is simply not drawn. */
export async function loadCardImages(card) {
  const images = new Map();
  const srcs = [...new Set(card.primitives.filter((p) => p.type === 'image').map((p) => p.src))];
  await Promise.all(srcs.map((src) => new Promise((resolve) => {
    const img = new Image();
    img.onload = () => { images.set(src, img); resolve(); };
    img.onerror = () => resolve();
    img.src = src;
  })));
  return images;
}

function drawImagePrim(ctx, p, img) {
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  if (!iw || !ih) return;
  ctx.save();
  if (p.radius) { roundedPath(ctx, p.x, p.y, p.w, p.h, p.radius); ctx.clip(); }
  const k = p.fit === 'contain' ? Math.min(p.w / iw, p.h / ih) : Math.max(p.w / iw, p.h / ih);
  const dw = iw * k;
  const dh = ih * k;
  ctx.drawImage(img, p.x + (p.w - dw) / 2, p.y + (p.h - dh) / 2, dw, dh);
  ctx.restore();
}

export function drawCard(ctx, card, images = new Map()) {
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
    } else if (p.type === 'image') {
      const img = images.get(p.src);
      if (img) drawImagePrim(ctx, p, img);
    } else if (p.type === 'wedge') {
      const t = (deg) => (deg * Math.PI) / 180;
      ctx.beginPath();
      ctx.arc(p.cx, p.cy, p.r1, t(p.a0), t(p.a1), false);
      ctx.arc(p.cx, p.cy, p.r0, t(p.a1), t(p.a0), true);
      ctx.closePath();
      ctx.fillStyle = p.fill;
      ctx.fill();
    } else if (p.type === 'text') {
      ctx.font = `${p.weight} ${p.size}px ${STACK[p.font] || STACK.sans}`;
      ctx.fillStyle = p.color;
      ctx.textBaseline = 'middle';
      const y = p.y + p.h / 2 + p.size * 0.04;
      if (p.runs && p.runs.length) {
        // The tasting note: pieces drawn side by side, each note word underlined in its colour.
        ctx.textAlign = 'left';
        const widths = p.runs.map((r) => ctx.measureText(r.text).width);
        const total = widths.reduce((a, b) => a + b, 0);
        let x = p.align === 'center' ? p.x + (p.w - total) / 2 : p.align === 'right' ? p.x + p.w - total : p.x;
        p.runs.forEach((r, i) => {
          ctx.fillStyle = p.color;
          ctx.fillText(r.text, x, y);
          if (r.underline) {
            const uy = y + p.size * 0.36;
            ctx.beginPath();
            ctx.moveTo(x, uy); ctx.lineTo(x + widths[i], uy);
            ctx.strokeStyle = r.underline; ctx.lineWidth = Math.max(2, Math.round(p.size * 0.07)); ctx.stroke();
          }
          x += widths[i];
        });
      } else {
        ctx.textAlign = p.align;
        const x = p.align === 'center' ? p.x + p.w / 2 : p.align === 'right' ? p.x + p.w : p.x;
        ctx.fillText(p.text, x, y);
      }
    }
  }
}

/** One layout -> a PNG Blob of exactly card.width x card.height. */
export async function cardToBlob(card) {
  const images = await loadCardImages(card);
  const canvas = document.createElement('canvas');
  canvas.width = card.width;
  canvas.height = card.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('no canvas');
  drawCard(ctx, card, images);
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
