// SHARE-5. The shareCard pipeline: /r-img/<kind>/<slug>.png -> a 1200x630 PNG of the
// recipe's preview card, drawn from the SAME layout the browser uses
// (cardLayout.generated.ts, copied from src/data/shareCardLayout.js at build time) with
// satori (layout -> SVG) and resvg (SVG -> PNG). Fonts are bundled in functions/fonts.
// Pure and dependency-injected (card data, shared-recipe lookup, renderer, logger).

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { layoutCard, layoutSiteCard, SHARE_CHARTS_ENABLED } from './cardLayout.generated';

export const CANONICAL_HOST = 'neuralflavor.web.app';
export const FALLBACK_IMAGE = '/icons/icon-512.png';
const PNG_CACHE = 'public, max-age=86400, s-maxage=86400';
const GENERIC_CACHE = 'public, max-age=600, s-maxage=600';
// A user's share can be removed, so its image is cached for minutes, not a day: a removal shows up within the window.
const USER_CACHE = GENERIC_CACHE;

/** What a card needs for one recipe (built-ins: share-cards.json; user shares: SHARE-6's lookup). */
export interface CardData {
  name: string;
  kind: string;
  lines: { label: string; amount?: string; suggested?: boolean }[];
  lineCount?: number;
  bars: { label: string; color: string; score: number }[];
  category?: string;
  glass?: string;
  meta?: string;
  garnish?: string;
}

export interface CardDeps {
  cards: Record<string, CardData>;
  /** SHARE-6: a user's shared recipe by id, or null when unknown or removed. */
  lookupShared: (id: string) => Promise<CardData | null>;
  /** Draws a layout to PNG bytes. Defaults to satori + resvg. */
  render?: (card: unknown) => Promise<Buffer>;
  log: (message: string, fields?: Record<string, unknown>) => void;
}

export interface CardResult {
  status: number;
  headers: Record<string, string>;
  body: Buffer | string;
}

export type CardTarget = { kind: string; slug: string } | { id: string } | null;

/** "/r-img/cocktail/negroni.png" -> { kind, slug }; "/r-img/ab12cd.png" -> { id }; anything else null. */
export function parseCardPath(path: string): CardTarget {
  const m = /^\/r-img\/(.+?)(?:\.png)?\/?$/i.exec(String(path || ''));
  if (!m) return null;
  let rest: string;
  try { rest = decodeURIComponent(m[1]).toLowerCase(); } catch { return null; }
  const parts = rest.split('/').filter(Boolean);
  if (parts.length === 2) return { kind: parts[0], slug: parts[1] };
  if (parts.length === 1) return { id: parts[0] };
  return null;
}

/** The link printed on a card, without the scheme: the same path the og:image belongs to. */
export function printedLink(target: CardTarget): string {
  if (!target) return CANONICAL_HOST;
  return 'slug' in target ? `${CANONICAL_HOST}/r/${target.kind}/${target.slug}` : `${CANONICAL_HOST}/r/${target.id}`;
}

export function layoutFor(data: CardData | null, link: string) {
  if (!data) return layoutSiteCard({ link });
  return layoutCard({
    format: 'preview',
    recipe: {
      kind: data.kind, name: data.name, category: data.category, glass: data.glass, meta: data.meta, garnish: data.garnish,
      lines: data.lines, lineCount: data.lineCount, method: '',
    },
    bars: SHARE_CHARTS_ENABLED ? data.bars : [],
    link,
  });
}

// ---- layout -> satori element tree ------------------------------------------------------------------
interface Prim { type: string; [k: string]: any }
interface LayoutCard { width: number; height: number; background: { inner: string; mid: string; outer: string }; primitives: Prim[] }

const FAMILY = { hand: 'Caveat', sans: 'Inter' } as const;

export function toSatori(card: LayoutCard) {
  const children = card.primitives.map((p) => {
    if (p.type === 'rect') {
      const style: Record<string, unknown> = {
        position: 'absolute', display: 'flex', left: p.x, top: p.y, width: p.w, height: p.h, boxSizing: 'border-box',
      };
      if (p.fill) style.backgroundColor = p.fill;
      if (p.stroke) style.border = `${p.strokeWidth || 1}px solid ${p.stroke}`;
      if (p.radius) style.borderRadius = p.radius;
      return { type: 'div', props: { style } };
    }
    if (p.type === 'line') {
      return {
        type: 'div',
        props: {
          style: {
            position: 'absolute', display: 'flex', left: p.x1, top: p.y1, width: p.x2 - p.x1, height: 0,
            borderTop: `${p.width}px ${p.dash ? 'dashed' : 'solid'} ${p.color}`,
          },
        },
      };
    }
    const justify = p.align === 'center' ? 'center' : p.align === 'right' ? 'flex-end' : 'flex-start';
    return {
      type: 'div',
      props: {
        style: {
          position: 'absolute', display: 'flex', alignItems: 'center', justifyContent: justify,
          left: p.x, top: p.y, width: p.w, height: p.h, fontFamily: FAMILY[p.font as 'hand' | 'sans'] || 'Inter',
          fontSize: p.size, fontWeight: p.weight, color: p.color, whiteSpace: 'nowrap', overflow: 'hidden',
        },
        children: Array.isArray(p.runs) && p.runs.length
          ? p.runs.map((r: { text: string; underline?: string }) => ({
            type: 'span',
            props: {
              style: { whiteSpace: 'pre', ...(r.underline ? { textDecoration: 'underline', textDecorationColor: r.underline } : {}) },
              children: r.text,
            },
          }))
          : p.text,
      },
    };
  });
  const bg = card.background;
  return {
    type: 'div',
    props: {
      style: {
        position: 'relative', display: 'flex', width: card.width, height: card.height,
        backgroundImage: `radial-gradient(ellipse at center, ${bg.inner} 0%, ${bg.mid} 75%, ${bg.outer} 100%)`,
      },
      children,
    },
  };
}

// ---- default renderer --------------------------------------------------------------------------------
type FontSpec = { name: string; data: Buffer; weight: 400 | 600 | 700; style: 'normal' };
let fontCache: FontSpec[] | null = null;
function fonts(): FontSpec[] {
  if (fontCache) return fontCache;
  const dir = join(__dirname, '..', '..', 'fonts');
  const f = (file: string, name: string, weight: 400 | 600 | 700): FontSpec => ({ name, data: readFileSync(join(dir, file)), weight, style: 'normal' });
  fontCache = [
    f('caveat-latin-400-normal.woff', 'Caveat', 400),
    f('caveat-latin-700-normal.woff', 'Caveat', 700),
    f('inter-latin-400-normal.woff', 'Inter', 400),
    f('inter-latin-600-normal.woff', 'Inter', 600),
  ];
  return fontCache;
}

export async function renderPng(card: unknown): Promise<Buffer> {
  const c = card as LayoutCard;
  const { default: satori } = await import('satori');
  const { Resvg } = await import('@resvg/resvg-js');
  const svg = await satori(toSatori(c) as any, { width: c.width, height: c.height, fonts: fonts() });
  return Buffer.from(new Resvg(svg, { fitTo: { mode: 'width', value: c.width } }).render().asPng());
}

// ---- handler -----------------------------------------------------------------------------------------
export async function handleShareCard(req: { path: string }, deps: CardDeps): Promise<CardResult> {
  const render = deps.render || renderPng;
  const target = parseCardPath(req.path);
  let data: CardData | null = null;
  let cache = GENERIC_CACHE;
  try {
    if (target && 'slug' in target) {
      data = deps.cards[`${target.kind}/${target.slug}`] ?? null;
      if (data) cache = PNG_CACHE;
    } else if (target) {
      data = await deps.lookupShared(target.id);
      if (data) cache = USER_CACHE;
    }
  } catch (err) {
    deps.log('shareCard lookup failed', { path: req.path, error: String(err) });
    data = null;
  }
  try {
    const png = await render(layoutFor(data, data ? printedLink(target) : CANONICAL_HOST));
    return { status: 200, headers: { 'Content-Type': 'image/png', 'Cache-Control': cache }, body: png };
  } catch (err) {
    deps.log('shareCard render failed', { path: req.path, error: String(err) });
    return { status: 302, headers: { Location: FALLBACK_IMAGE, 'Cache-Control': 'public, max-age=60, s-maxage=60' }, body: '' };
  }
}
