// LOOK-7 contract helpers (blind). Shared by the render contracts in this folder.
// jsdom applies no Tailwind CSS, so every check reads BOTH the inline style and the class list.

export const ACCENT_HEX = '#e8c97a';

// Accent with or without alpha: '#e8c97a', '#e8c97a33', 'rgb(232, 201, 122)', 'rgba(232, 201, 122, 0.2)'.
const ACCENT_ANY = /e8c97a|rgba?\(\s*232\s*,\s*201\s*,\s*122/i;
// Solid accent only (the primary's fill).
const ACCENT_SOLID = /#e8c97a(?![0-9a-f])|rgb\(\s*232\s*,\s*201\s*,\s*122\s*\)|rgba\(\s*232\s*,\s*201\s*,\s*122\s*,\s*1(\.0+)?\s*\)/i;

const classTokens = (el) => {
  const c = el.getAttribute && el.getAttribute('class');
  return c ? c.split(/\s+/).filter(Boolean) : [];
};

// Background-related inline declarations, read from the serialised style (what React wrote).
function backgroundDecls(el) {
  const s = el.style;
  if (!s) return [];
  return [s.background, s.backgroundColor, s.backgroundImage].filter((v) => v && v !== 'none' && v !== 'transparent' && v !== 'initial');
}

export function hasAccentBackground(el) {
  if (backgroundDecls(el).some((v) => ACCENT_ANY.test(v))) return true;
  return classTokens(el).some((t) => /^(?:[a-z]+:)*bg-/.test(t) && ACCENT_ANY.test(t));
}

export function hasSolidAccentBackground(el) {
  return backgroundDecls(el).some((v) => ACCENT_SOLID.test(v))
    || classTokens(el).some((t) => /^bg-\[#e8c97a\]$/i.test(t));
}

export function hasAnyBackground(el) {
  if (backgroundDecls(el).length > 0) return true;
  // Resting-state utilities only: a hover/focus wash (hover:bg-white/5) is not a background at rest.
  return classTokens(el).some((t) => /^bg-/.test(t) && !/^bg-(transparent|none)$/.test(t));
}

const SIDES = ['Top', 'Right', 'Bottom', 'Left'];

export function hasBorder(el) {
  const cs = (el.ownerDocument.defaultView || window).getComputedStyle(el);
  for (const side of SIDES) {
    const style = cs[`border${side}Style`] || el.style[`border${side}Style`];
    if (style && style !== 'none' && style !== 'hidden' && style !== 'initial') {
      const width = cs[`border${side}Width`] || el.style[`border${side}Width`];
      if (!/^0(px)?$/.test(String(width || '').trim())) return true;
    }
  }
  // A shorthand jsdom could not expand still counts.
  const raw = el.getAttribute('style') || '';
  if (/(^|;)\s*border(-(top|right|bottom|left))?\s*:\s*(?!none|0(px)?\b|0\s)[^;]*\b(solid|dashed|dotted|double)\b/i.test(raw)) return true;
  // Tailwind border utilities (border, border-2, border-t, border-[1.5px], ...), not border-0/none/colour-only.
  return classTokens(el).some((t) => {
    const u = t.replace(/^(?:[a-z0-9-]+:)+/, '');
    if (t !== u) return false; // only resting state counts
    if (/^border(-[trblxy])?$/.test(u)) return true;
    if (/^border(-[trblxy])?-(\d+(\.\d+)?|\[\d+(\.\d+)?px\])$/.test(u)) return !/-(0|\[0px\])$/.test(u);
    return false;
  });
}

export function hasBoxShadow(el) {
  const v = el.style.boxShadow;
  if (v && v !== 'none' && v !== 'initial') return true;
  return classTokens(el).some((t) => /^shadow(-|$)/.test(t) && t !== 'shadow-none');
}

export function hasRoundedFull(el) {
  return classTokens(el).some((t) => /(^|:)rounded-full$/.test(t));
}

// Minimum height in px from the inline style or a Tailwind min-h utility; null when none is set.
export function minHeightPx(el) {
  const v = el.style.minHeight;
  if (v) {
    const px = /^(\d+(\.\d+)?)px$/.exec(v);
    if (px) return Number(px[1]);
    const rem = /^(\d+(\.\d+)?)rem$/.exec(v);
    if (rem) return Number(rem[1]) * 16;
  }
  for (const t of classTokens(el)) {
    const a = /^min-h-\[(\d+(\.\d+)?)px\]$/.exec(t);
    if (a) return Number(a[1]);
    const r = /^min-h-\[(\d+(\.\d+)?)rem\]$/.exec(t);
    if (r) return Number(r[1]) * 16;
    const n = /^min-h-(\d+(\.\d+)?)$/.exec(t);
    if (n) return Number(n[1]) * 4;
  }
  return null;
}

export const primaries = (root) => [...root.querySelectorAll('[data-primary="true"]')];

// AC-1 shape: exactly one primary, a <button>, filled with the accent.
export function expectOnePrimary(expect, root, label) {
  const found = primaries(root);
  expect(found.length, `${label}: [data-primary="true"] count`).toBe(1);
  const [p] = found;
  expect(p.tagName, `${label}: the primary is a button`).toBe('BUTTON');
  expect(hasSolidAccentBackground(p), `${label}: the primary's background is ${ACCENT_HEX} (style="${p.getAttribute('style')}", class="${p.getAttribute('class')}")`).toBe(true);
  return p;
}

// AC-3 shape: no element other than the primary has an accent background (any alpha).
export function expectNoOtherAccentFill(expect, root, label) {
  const primary = new Set(primaries(root));
  const offenders = [...root.querySelectorAll('*')]
    .filter((el) => !primary.has(el) && hasAccentBackground(el))
    .map((el) => `<${el.tagName.toLowerCase()} data-testid="${el.getAttribute('data-testid') || ''}" style="${el.getAttribute('style') || ''}" class="${el.getAttribute('class') || ''}">${(el.textContent || '').slice(0, 40)}`);
  expect(offenders, `${label}: elements other than the primary with an accent background`).toEqual([]);
}
