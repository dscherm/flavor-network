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
const ARC_SPREAD = Math.PI / 12; // ±15 degrees
const STAR_THRESHOLD = 0.22;

// Technique / non-food patterns — these get filtered out of the canvas
const TECHNIQUE_RE = /^(grill pan|grill|roasting pan|baking pan|baking sheet|cake pan|cookie sheet|foil|aluminum foil|fry|broil|boil|pan cornbread)$/;
const NON_FOOD_RE = /\b(cooking spray|oil spray|vegetable spray|nonstick|parchment|wax paper|spray$|pan$|sheet$|foil$)\b/i;

/**
 * Test if an ingredient name is a technique / non-food item.
 */
export function isTechnique(name) {
  if (TECHNIQUE_RE.test(name)) return true;
  if (NON_FOOD_RE.test(name)) return true;
  return false;
}

// Approximate text width (px) for a name at a given font size
function estimateTextWidth(name, fontSize) {
  return name.length * fontSize * 0.52;
}

// Estimate oval dimensions for a name
const OVAL_PAD_X = 14;
const OVAL_PAD_Y = 8;
const BASE_FONT = 13;
const MIN_FONT = 9;
const STAR_OUTER = 24;

function getNodeBounds(name, strength) {
  const isStar = strength >= STAR_THRESHOLD;
  if (isStar) {
    return { hw: STAR_OUTER + 4, hh: STAR_OUTER + 4 };
  }
  const fontSize = Math.max(MIN_FONT, Math.min(BASE_FONT, 140 / name.length));
  const tw = estimateTextWidth(name, fontSize);
  return {
    hw: tw / 2 + OVAL_PAD_X,
    hh: fontSize / 2 + OVAL_PAD_Y,
  };
}

/**
 * Compute 2D radial layout positions for pairings around a center ingredient.
 * Includes overlap-avoidance repulsion pass.
 */
export function computeRadialLayout(centerName, pairings, nodes, radius = 300) {
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

  // Position each group along its axis angle
  for (const [taste, items] of groups) {
    if (items.length === 0) continue;
    const baseAngle = TASTE_AXES_2D[taste];

    items.sort((a, b) => b.strength - a.strength);

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      // Wider arc spread for larger groups to reduce initial overlap
      const groupSpread = ARC_SPREAD + Math.min(items.length * 0.02, 0.3);
      const arcOffset = items.length === 1
        ? 0
        : groupSpread * 2 * (i / (items.length - 1) - 0.5);
      const angle = baseAngle + arcOffset;

      // Distance: stronger pairings closer to center, weaker farther
      const dist = radius * (0.35 + 0.65 * (1 - item.strength));

      positions.set(item.name, {
        x: Math.cos(angle) * dist,
        y: Math.sin(angle) * dist,
        dominantTaste: item.dominantTaste,
        strength: item.strength,
      });
    }
  }

  // Repulsion pass — push overlapping nodes apart
  const entries = [...positions.entries()];
  const CENTER_CLEAR = 50; // keep nodes away from center rhombus

  for (let iter = 0; iter < 12; iter++) {
    let moved = false;
    for (let i = 0; i < entries.length; i++) {
      const [nameA, posA] = entries[i];
      const boundsA = getNodeBounds(nameA, posA.strength);

      // Repel from center
      const distFromCenter = Math.sqrt(posA.x * posA.x + posA.y * posA.y);
      if (distFromCenter < CENTER_CLEAR) {
        const angle = Math.atan2(posA.y, posA.x);
        posA.x = Math.cos(angle) * CENTER_CLEAR;
        posA.y = Math.sin(angle) * CENTER_CLEAR;
        moved = true;
      }

      for (let j = i + 1; j < entries.length; j++) {
        const [nameB, posB] = entries[j];
        const boundsB = getNodeBounds(nameB, posB.strength);

        const dx = posB.x - posA.x;
        const dy = posB.y - posA.y;
        const overlapX = boundsA.hw + boundsB.hw - Math.abs(dx);
        const overlapY = boundsA.hh + boundsB.hh - Math.abs(dy);

        if (overlapX > 0 && overlapY > 0) {
          // Push apart along the axis of least overlap
          const pushX = overlapX * (dx >= 0 ? 1 : -1) * 0.55;
          const pushY = overlapY * (dy >= 0 ? 1 : -1) * 0.55;

          if (overlapX < overlapY) {
            posA.x -= pushX;
            posB.x += pushX;
          } else {
            posA.y -= pushY;
            posB.y += pushY;
          }
          moved = true;
        }
      }
    }
    if (!moved) break;
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
