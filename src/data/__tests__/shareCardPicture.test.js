// PICTURE-4. Share cards with a recipe picture: where it goes, that it never covers text, and that a recipe
// without one is laid out exactly as before (the hash test in shareCardChart4.test.js pins that byte for byte).
import { describe, it, expect } from 'vitest';
import { layoutCard, layoutSet, FORMATS } from '../shareCardLayout.js';

const BARS = [
  { label: 'Bitter', color: '#a855f7', score: 0.9 }, { label: 'Sweet', color: '#ff5fa2', score: 0.7 }, { label: 'Sour', color: '#22d3ee', score: 0.2 },
  { label: 'Fruity', color: '#ff8a5c', score: 0.55 }, { label: 'Green', color: '#7ccd7c', score: 0.4 }, { label: 'Spice', color: '#c0561f', score: 0.38 },
];
const SRC = 'data:image/jpeg;base64,/9j/AAAA';
const SVG = 'data:image/svg+xml;charset=utf-8,%3Csvg%3E%3C%2Fsvg%3E';
const chalk = { src: SRC, w: 600, h: 600, kind: 'chalk' };
const icon = { src: SVG, w: 256, h: 256, kind: 'icon' };
const short = { kind: 'cocktail', name: 'Negroni', category: 'Aromatic Stirred', glass: 'Old-fashioned glass', lines: [{ label: 'gin', amount: '30 ml' }, { label: 'campari', amount: '30 ml' }, { label: 'sweet vermouth', amount: '30 ml' }], method: 'Stir.\nStrain.' };
const long = { ...short, kind: 'dish', name: 'Beef Bolognese', lines: Array.from({ length: 14 }, (_, i) => ({ label: `ingredient number ${i}`, amount: `${i + 1} g` })), lineCount: 14 };

const images = (card) => card.primitives.filter((p) => p.type === 'image');
const body = (card) => card.primitives.filter((p) => p.type === 'text' || p.type === 'wedge');
const box = (p) => (p.type === 'wedge' ? { x: p.cx - p.r1, y: p.cy - p.r1, w: 2 * p.r1, h: 2 * p.r1 } : { x: p.x, y: p.y, w: p.w, h: p.h });
const overlap = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const inside = (card, p) => p.x >= 0 && p.y >= 0 && p.x + p.w <= card.width && p.y + p.h <= card.height;

describe('a card with a picture', () => {
  for (const [name, recipe] of [['short', short], ['long', long]]) {
    for (const format of ['preview', 'portrait', 'tall']) {
      for (const [pname, pic] of [['chalk', chalk], ['icon', icon]]) {
        for (const bars of [BARS, []]) {
          it(`${name} recipe, ${format}, ${pname} picture, ${bars.length ? 'with' : 'without'} the chart: one picture, on the card, covering no text`, () => {
            const card = layoutCard({ format, recipe: { ...recipe, picture: pic }, bars, link: 'neuralflavor.web.app/r/abcde23456' });
            const imgs = images(card);
            expect(imgs).toHaveLength(1);
            expect(imgs[0].src).toBe(pic.src);
            expect(imgs[0].fit).toBe(pname === 'chalk' ? 'cover' : 'contain');
            expect(inside(card, imgs[0])).toBe(true);
            // the footer (rule + site name + link) sits below the picture
            const rule = Math.max(...card.primitives.filter((p) => p.type === 'line').map((p) => p.y1));
            expect(imgs[0].y + imgs[0].h).toBeLessThanOrEqual(rule);
            // the picture frame is the outer rect; no text or wedge is drawn over it
            const frame = card.primitives.find((p) => p.type === 'rect' && p.stroke && p.w < card.width - 100);
            expect(frame).toBeTruthy();
            for (const t of body(card)) expect(overlap(box(t), { x: frame.x, y: frame.y, w: frame.w, h: frame.h })).toBe(false);
          });
        }
      }
    }
  }

  it('the link preview puts the picture in the right column above the tasting note', () => {
    const card = layoutCard({ format: 'preview', recipe: { ...short, picture: chalk }, bars: BARS, link: 'x.com/r/a' });
    const img = images(card)[0];
    expect(img.x).toBeGreaterThan(FORMATS.preview.width / 2);
    const note = card.primitives.find((p) => p.type === 'text' && p.runs);
    expect(img.y + img.h).toBeLessThan(note.y);
    expect(img.w).toBeGreaterThanOrEqual(150);
  });

  it('a picture keeps its own shape: a 4:3 landscape picture is drawn wider than tall', () => {
    const card = layoutCard({ format: 'portrait', recipe: { ...short, picture: { src: SRC, w: 800, h: 600, kind: 'chalk' } }, bars: BARS, link: 'x.com/r/a' });
    const img = images(card)[0];
    expect(Math.abs(img.w / img.h - 4 / 3)).toBeLessThan(0.02);
  });

  it('a short recipe on a portrait card gets a large picture in the room it leaves; a long one gets a small corner picture beside the name', () => {
    const big = images(layoutCard({ format: 'portrait', recipe: { ...short, picture: chalk }, bars: BARS, link: 'x.com/r/a' }))[0];
    const small = images(layoutCard({ format: 'portrait', recipe: { ...long, picture: chalk }, bars: BARS, link: 'x.com/r/a' }))[0];
    expect(big.w).toBeGreaterThanOrEqual(200);
    expect(small.w).toBeLessThan(big.w);
    expect(small.y).toBeLessThan(200); // up in the header
  });

  it('the set of three draws the picture once: on the cover when the wheel can spare the room, else beside the ingredients', () => {
    for (const format of ['portrait', 'tall']) {
      for (const bars of [BARS, []]) {
        const cards = layoutSet({ format, recipe: { ...short, picture: chalk }, bars, link: 'x.com/r/a' });
        expect(cards.reduce((n, c) => n + images(c).length, 0)).toBe(1);
        expect(images(cards[2])).toHaveLength(0);
        if (bars.length) expect(cards[0].primitives.some((p) => p.type === 'wedge')).toBe(true);
        for (const c of cards) {
          const frame = c.primitives.find((p) => p.type === 'rect' && p.stroke && p.w < c.width - 100);
          if (!frame) continue;
          for (const t of body(c)) expect(overlap(box(t), frame)).toBe(false);
          const rule = Math.max(...c.primitives.filter((p) => p.type === 'line').map((p) => p.y1));
          expect(frame.y + frame.h).toBeLessThanOrEqual(rule);
        }
      }
    }
  });

  it('a very long recipe has no room for a picture on a set; the set is then the set without one (the single card still has it)', () => {
    const cards = layoutSet({ format: 'portrait', recipe: { ...long, picture: chalk }, bars: BARS, link: 'x.com/r/a' });
    expect(cards.reduce((n, c) => n + images(c).length, 0)).toBe(0);
    expect(images(layoutCard({ format: 'portrait', recipe: { ...long, picture: chalk }, bars: BARS, link: 'x.com/r/a' }))).toHaveLength(1);
  });

  it('a picture that is not a data: address is ignored (the card is the card without one)', () => {
    const plain = JSON.stringify(layoutCard({ format: 'portrait', recipe: short, bars: BARS, link: 'x.com/r/a' }));
    for (const bad of [{ src: 'https://evil.example/x.png' }, { src: 5 }, { src: '' }, null, {}]) {
      expect(JSON.stringify(layoutCard({ format: 'portrait', recipe: { ...short, picture: bad }, bars: BARS, link: 'x.com/r/a' }))).toBe(plain);
    }
  });

  it('a recipe without a picture has no image primitive in any format', () => {
    for (const format of ['preview', 'portrait', 'tall']) expect(images(layoutCard({ format, recipe: short, bars: BARS, link: 'x.com/r/a' }))).toHaveLength(0);
    for (const c of layoutSet({ format: 'portrait', recipe: short, bars: BARS, link: 'x.com/r/a' })) expect(images(c)).toHaveLength(0);
  });
});
