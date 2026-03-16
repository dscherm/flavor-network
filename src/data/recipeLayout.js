import { scoreIngredient } from './tastePositioning.js';

// 8 taste axes mapped to evenly-spaced 2D angles (45 degrees apart)
const TASTE_AXES_2D = {
  sweet:      0,
  salty:      Math.PI * 0.25,
  sour:       Math.PI * 0.5,
  bitter:     Math.PI * 0.75,
  umami:      Math.PI,
  spicy:      Math.PI * 1.25,
  pungent:    Math.PI * 1.5,
  astringent: Math.PI * 1.75,
};

const TASTE_KEYS = Object.keys(TASTE_AXES_2D);
const MAX_PAIRINGS = 60;
const STAR_THRESHOLD = 0.22;

// Technique / non-food patterns — these get filtered out of the canvas
const TECHNIQUE_RE = /^(grill pan|grill|roasting pan|baking pan|baking sheet|cake pan|cookie sheet|foil|aluminum foil|fry|broil|boil|pan cornbread)$/;
const NON_FOOD_RE = /\b(cooking spray|oil spray|vegetable spray|nonstick|parchment|wax paper|spray$|pan$|sheet$|foil$)\b/i;

export function isTechnique(name) {
  if (TECHNIQUE_RE.test(name)) return true;
  if (NON_FOOD_RE.test(name)) return true;
  return false;
}

// Approximate text width (px) for a name at a given font size
function estimateTextWidth(name, fontSize) {
  return name.length * fontSize * 0.55;
}

// Node sizing constants — must match NotebookCanvas rendering
const OVAL_PAD_X = 16;
const OVAL_PAD_Y = 10;
const BASE_FONT = 13;
const MIN_FONT = 9;
const STAR_OUTER = 26;
const NODE_GAP = 6; // minimum px gap between any two nodes

function getNodeBounds(name, strength) {
  const isStar = strength >= STAR_THRESHOLD;
  if (isStar) {
    return { hw: STAR_OUTER + NODE_GAP, hh: STAR_OUTER + NODE_GAP };
  }
  const fontSize = Math.max(MIN_FONT, Math.min(BASE_FONT, 140 / name.length));
  const tw = estimateTextWidth(name, fontSize);
  return {
    hw: tw / 2 + OVAL_PAD_X + NODE_GAP,
    hh: fontSize / 2 + OVAL_PAD_Y + NODE_GAP,
  };
}

/**
 * Check if two axis-aligned rectangles overlap.
 * Returns overlap amounts on each axis, or null if no overlap.
 */
function rectOverlap(posA, boundsA, posB, boundsB) {
  const dx = posB.x - posA.x;
  const dy = posB.y - posA.y;
  const overlapX = boundsA.hw + boundsB.hw - Math.abs(dx);
  const overlapY = boundsA.hh + boundsB.hh - Math.abs(dy);
  if (overlapX > 0 && overlapY > 0) {
    return { dx, dy, overlapX, overlapY };
  }
  return null;
}

/**
 * Compute 2D radial layout positions for pairings around a center ingredient.
 * Uses force-directed repulsion to eliminate all overlaps.
 */
export function computeRadialLayout(centerName, pairings, nodes, radius = 340) {
  const positions = new Map();

  // Filter out techniques and cap
  const filtered = pairings.filter(p => !isTechnique(p.name));
  const topPairings = filtered.slice(0, MAX_PAIRINGS);

  // Group pairings by dominant taste axis
  const groups = new Map();
  for (const key of TASTE_KEYS) groups.set(key, []);

  for (const pairing of topPairings) {
    const node = nodes.get(pairing.name);
    const { channels } = scoreIngredient(pairing.name, node || {});

    let dominant = 'umami';
    let maxScore = -1;
    for (const key of TASTE_KEYS) {
      if (channels[key] > maxScore) {
        maxScore = channels[key];
        dominant = key;
      }
    }

    groups.get(dominant).push({ ...pairing, dominantTaste: dominant });
  }

  // Initial placement: radial with staggered rings per group
  for (const [taste, items] of groups) {
    if (items.length === 0) continue;
    const baseAngle = TASTE_AXES_2D[taste];

    items.sort((a, b) => b.strength - a.strength);

    // Adaptive arc: wider for more items
    const arcHalf = Math.PI / 12 + items.length * 0.035;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const arcOffset = items.length === 1
        ? 0
        : arcHalf * 2 * (i / (items.length - 1) - 0.5);
      const angle = baseAngle + arcOffset;

      // Distance: stronger closer, weaker farther
      // Use wider range and add per-item stagger to reduce initial clumping
      const baseDist = radius * (0.3 + 0.7 * (1 - item.strength));
      const stagger = (i % 3) * 20; // alternate rings
      const dist = baseDist + stagger;

      positions.set(item.name, {
        x: Math.cos(angle) * dist,
        y: Math.sin(angle) * dist,
        dominantTaste: item.dominantTaste,
        strength: item.strength,
      });
    }
  }

  // Force-directed repulsion to eliminate overlaps
  const entries = [...positions.entries()];
  const n = entries.length;
  const CENTER_CLEAR = 55;

  // Pre-compute bounds (they don't change)
  const bounds = entries.map(([name, pos]) => getNodeBounds(name, pos.strength));

  for (let iter = 0; iter < 80; iter++) {
    let maxOverlap = 0;

    // Repel from center rhombus
    for (let i = 0; i < n; i++) {
      const pos = entries[i][1];
      const b = bounds[i];
      const distC = Math.sqrt(pos.x * pos.x + pos.y * pos.y);
      const minDist = CENTER_CLEAR + Math.max(b.hw, b.hh);
      if (distC < minDist) {
        const angle = Math.atan2(pos.y, pos.x) || 0.01;
        const push = minDist - distC;
        pos.x += Math.cos(angle) * push;
        pos.y += Math.sin(angle) * push;
        maxOverlap = Math.max(maxOverlap, push);
      }
    }

    // Pairwise repulsion
    for (let i = 0; i < n; i++) {
      const posA = entries[i][1];
      const bA = bounds[i];

      for (let j = i + 1; j < n; j++) {
        const posB = entries[j][1];
        const bB = bounds[j];

        const ov = rectOverlap(posA, bA, posB, bB);
        if (!ov) continue;

        const { dx, dy, overlapX, overlapY } = ov;
        maxOverlap = Math.max(maxOverlap, Math.min(overlapX, overlapY));

        // Push apart — resolve smallest overlap axis first, but always
        // apply both axes with weighted amounts to avoid oscillation
        const totalOverlap = overlapX + overlapY;
        const wxRatio = overlapY / totalOverlap; // push more on X when Y overlap is larger
        const wyRatio = overlapX / totalOverlap;

        const signX = dx >= 0 ? 1 : -1;
        const signY = dy >= 0 ? 1 : -1;

        // Each node gets pushed half the overlap distance
        const pushX = overlapX * wxRatio * 0.52 * signX;
        const pushY = overlapY * wyRatio * 0.52 * signY;

        posA.x -= pushX;
        posA.y -= pushY;
        posB.x += pushX;
        posB.y += pushY;
      }
    }

    // Converged — no meaningful overlaps remain
    if (maxOverlap < 1) break;
  }

  // Write back
  for (const [name, pos] of entries) {
    positions.set(name, pos);
  }

  return positions;
}

/**
 * Extract technique pairings for an ingredient.
 */
export function extractTechniques(pairings) {
  return pairings
    .filter(p => isTechnique(p.name))
    .map(p => p.name);
}

export { TASTE_AXES_2D, TASTE_KEYS, STAR_THRESHOLD };
