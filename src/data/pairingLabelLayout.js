/**
 * pairingLabelLayout.js — DESIGN-1.
 *
 * Places the partner names on the Pairing Lab board so no two names
 * overlap each other, a partner circle, or the centre oval. Pure (the text
 * width comes from an injected `measure`) so it can be tested without a
 * canvas.
 *
 * Each label tries a ladder of spots around its circle — outward from the
 * centre first, then below / above / beside, then the same spots further
 * out — and takes the first that is clear and inside the board. If none is
 * clear it takes the spot with the least overlap.
 */

const GAP = 5;   // px between a circle and its label
const PAD = 2;   // px of breathing room around every label box

function overlapArea(a, b) {
  const w = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0);
  const h = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0);
  return w > 0 && h > 0 ? w * h : 0;
}

/** Box of a label whose centre is (x, y). */
function boxAt(x, y, w, h) {
  return { x0: x - w / 2 - PAD, y0: y - h / 2 - PAD, x1: x + w / 2 + PAD, y1: y + h / 2 + PAD };
}

/**
 * @param {Array<{name,x,y,r}>} nodes   partner circles
 * @param {object} opts
 *   width, height   board size
 *   cx, cy          board centre (labels lean away from it)
 *   measure(text)   → text width in px
 *   lineHeight      label height in px (default 18)
 *   obstacles       extra boxes to keep clear of ({x0,y0,x1,y1}), e.g. the centre oval
 * @returns Map name → { x, y, w, h, box }  (x, y = label centre)
 */
export function placeLabels(nodes, { width, height, cx, cy, measure, lineHeight = 18, obstacles = [] }) {
  const placed = new Map();
  const blocked = [
    ...obstacles,
    ...nodes.map((n) => ({ x0: n.x - n.r, y0: n.y - n.r, x1: n.x + n.r, y1: n.y + n.r })),
  ];
  // Label the outermost partners first: they have the least room.
  const order = [...nodes].sort((a, b) => Math.hypot(b.x - cx, b.y - cy) - Math.hypot(a.x - cx, a.y - cy));

  for (const n of order) {
    const w = measure(n.name);
    const h = lineHeight;
    const dx = n.x - cx;
    const dy = n.y - cy;
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len;
    const uy = dy / len;

    const candidates = [];
    for (const extra of [0, 12, 26, 44]) {
      const d = n.r + GAP + extra;
      // Outward: far enough that the box clears the circle in that direction.
      const out = d + Math.abs(ux) * (w / 2) + Math.abs(uy) * (h / 2);
      candidates.push([n.x + ux * out, n.y + uy * out]);
      candidates.push([n.x, n.y + d + h / 2]);       // below
      candidates.push([n.x, n.y - d - h / 2]);       // above
      candidates.push([n.x + d + w / 2, n.y]);       // right
      candidates.push([n.x - d - w / 2, n.y]);       // left
      // Diagonals: the label's near corner just off the circle.
      for (const [sx, sy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
        candidates.push([n.x + sx * (d * 0.7 + w / 2), n.y + sy * (d * 0.7 + h / 2)]);
      }
    }

    let best = null;
    for (const [rawX, rawY] of candidates) {
      // Keep the label on the board.
      const x = Math.min(width - w / 2 - PAD, Math.max(w / 2 + PAD, rawX));
      const y = Math.min(height - h / 2 - PAD, Math.max(h / 2 + PAD, rawY));
      const box = boxAt(x, y, w, h);
      let cost = 0;
      for (const b of blocked) cost += overlapArea(box, b);
      if (!best || cost < best.cost) best = { x, y, box, cost };
      if (cost === 0) break;
    }
    placed.set(n.name, { x: best.x, y: best.y, w, h, box: best.box });
    blocked.push(best.box);
  }
  return placed;
}

/**
 * Ring geometry for the board: an ellipse that uses the board's full width
 * and height (phones are taller than wide), leaving `margin` for labels.
 */
export function ringRadii(width, height, margin = { x: 30, y: 26 }) {
  return {
    rx: Math.max(60, width / 2 - margin.x),
    ry: Math.max(60, height / 2 - margin.y),
  };
}
