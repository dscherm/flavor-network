import { describe, it, expect } from 'vitest';
import { placeLabels, ringRadii } from '../pairingLabelLayout.js';

const measure = (t) => t.length * 8; // ~Caveat 16px
const overlaps = (a, b) => Math.min(a.x1, b.x1) > Math.max(a.x0, b.x0) && Math.min(a.y1, b.y1) > Math.max(a.y0, b.y0);

const NAMES = ['tomato sauce', 'tomato paste', 'parmesan', 'white wine', 'red pepper', 'chicken stock',
  'sweet pepper', 'extra-virgin olive oil', 'red wine', 'anchovy', 'shrimp', 'cayenne pepper'];

/** A 12-partner ring on a phone-sized board, like the Pairing Lab's. */
function ring(width, height, fIn = 0.55) {
  const cx = width / 2;
  const cy = height / 2;
  const { rx, ry } = ringRadii(width, height);
  const nodes = NAMES.map((name, i) => {
    const ang = -Math.PI / 2 + (i * 2 * Math.PI) / NAMES.length;
    const f = i % 3 === 0 ? fIn : i % 3 === 1 ? 0.8 : 1;
    return { name, x: cx + f * rx * Math.cos(ang), y: cy + f * ry * Math.sin(ang), r: 10 };
  });
  const center = { x0: cx - 60, y0: cy - 29, x1: cx + 60, y1: cy + 29 };
  return { nodes, cx, cy, center };
}

describe('placeLabels (Pairing Lab names)', () => {
  for (const [w, h] of [[375, 520], [320, 460], [768, 700]]) {
    it(`no two names overlap, and none covers a circle or the centre, at ${w}x${h}`, () => {
      const { nodes, cx, cy, center } = ring(w, h);
      const placed = placeLabels(nodes, { width: w, height: h, cx, cy, measure, obstacles: [center] });
      expect(placed.size).toBe(nodes.length);
      const boxes = [...placed.values()].map((p) => p.box);
      for (let i = 0; i < boxes.length; i += 1) {
        expect(overlaps(boxes[i], center), NAMES[i]).toBe(false);
        for (const n of nodes) {
          const circle = { x0: n.x - n.r, y0: n.y - n.r, x1: n.x + n.r, y1: n.y + n.r };
          expect(overlaps(boxes[i], circle), `${[...placed.keys()][i]} vs ${n.name}`).toBe(false);
        }
        for (let j = i + 1; j < boxes.length; j += 1) {
          expect(overlaps(boxes[i], boxes[j]), `${[...placed.keys()][i]} vs ${[...placed.keys()][j]}`).toBe(false);
        }
      }
    });
  }

  it('keeps every name on the board', () => {
    const { nodes, cx, cy, center } = ring(375, 520);
    const placed = placeLabels(nodes, { width: 375, height: 520, cx, cy, measure, obstacles: [center] });
    for (const { box } of placed.values()) {
      expect(box.x0).toBeGreaterThanOrEqual(0);
      expect(box.y0).toBeGreaterThanOrEqual(0);
      expect(box.x1).toBeLessThanOrEqual(375);
      expect(box.y1).toBeLessThanOrEqual(520);
    }
  });

  it('puts a lone label outward from the centre when there is room', () => {
    const placed = placeLabels([{ name: 'basil', x: 300, y: 200, r: 10 }], { width: 400, height: 400, cx: 200, cy: 200, measure });
    expect(placed.get('basil').x).toBeGreaterThan(300);
  });
});

describe('ringRadii', () => {
  it('uses the full height on a tall phone board instead of the narrow side', () => {
    const { rx, ry } = ringRadii(375, 520);
    expect(ry).toBeGreaterThan(rx);
    expect(rx).toBeLessThanOrEqual(375 / 2);
    expect(ry).toBeLessThanOrEqual(520 / 2);
  });
});
