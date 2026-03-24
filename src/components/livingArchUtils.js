import * as THREE from 'three';
import { scoreIngredient } from '../data/tastePositioning.js';
import { TASTE_ORDER, TASTE_HEX, CATEGORY_RADII } from './livingArchConstants.js';

// --- Helpers ---

export function easeInOutCubic(t) {
  return t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t+2, 3) / 2;
}

export function hashStr(s) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return h;
}

export function seededRng(seed) {
  let st = seed >>> 0;
  return () => { st = (1664525 * st + 1013904223) % 4294967296; return st / 4294967296; };
}

/** Create a billboard sprite with text */
export function makeLabel(text, color, size) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  const fontSize = 48;
  canvas.width = 512; canvas.height = 96;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.font = `bold ${fontSize}px "Inter", "Segoe UI", sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = color;
  ctx.shadowColor = color; ctx.shadowBlur = 12;
  ctx.fillText(text, canvas.width/2, canvas.height/2);
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, opacity: 0.85 });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(size, size * 96/512, 1);
  return sprite;
}

/** Compute 2D wheel positions — octagonal spiral layout.
 *  Ingredients spiral outward from center based on taste weights.
 *  Inner ring = strongest taste affinity, outer ring = weaker/multi-taste.
 *  Octagonal sector boundaries match the TasteRadar shape. */
export function computeWheelPositions(nodes) {
  const positions = {};
  const N = TASTE_ORDER.length; // 8
  const sectorAngle = (Math.PI * 2) / N;

  // Bin ingredients by dominant taste for spiral ordering
  const bins = {};
  for (const t of TASTE_ORDER) bins[t] = [];

  for (const [name, node] of nodes) {
    const { channels } = scoreIngredient(name, node);
    // Find dominant taste
    let bestTaste = 'sweet', bestScore = 0;
    for (const t of TASTE_ORDER) {
      const s = channels[t] || 0;
      if (s > bestScore) { bestScore = s; bestTaste = t; }
    }
    const totalWeight = TASTE_ORDER.reduce((s, t) => s + (channels[t] || 0), 0);
    bins[bestTaste].push({ name, node, channels, totalWeight, bestScore });
  }

  // Sort each bin: most-paired first (center), then shuffle slightly
  // to prevent clumping of similar ingredients
  for (const t of TASTE_ORDER) {
    bins[t].sort((a, b) => (b.node.pairingCount || 0) - (a.node.pairingCount || 0));
    // Interleave: take every 3rd item to spread similar ingredients apart
    const original = [...bins[t]];
    const shuffled = [];
    const thirds = [[], [], []];
    original.forEach((item, i) => thirds[i % 3].push(item));
    for (let i = 0; i < Math.max(thirds[0].length, thirds[1].length, thirds[2].length); i++) {
      if (thirds[0][i]) shuffled.push(thirds[0][i]);
      if (thirds[1][i]) shuffled.push(thirds[1][i]);
      if (thirds[2][i]) shuffled.push(thirds[2][i]);
    }
    bins[t] = shuffled;
  }

  // Place ingredients in Archimedean spiral within each sector
  for (let ti = 0; ti < N; ti++) {
    const taste = TASTE_ORDER[ti];
    const centerAngle = ti * sectorAngle - Math.PI / 2; // start from top
    const items = bins[taste];

    for (let idx = 0; idx < items.length; idx++) {
      const { name, channels, bestScore } = items[idx];
      const rng = seededRng(hashStr(name));

      // Radius: most-paired start at 28 (outside 2nd octagon ring), least-paired reach ~55
      // This ensures no ingredients in innermost ring (0-12.5) and only top-paired in 2nd ring (12.5-25)
      const spiralT = idx / Math.max(1, items.length - 1);
      const baseRadius = 28 + spiralT * 27;

      // Swirl with wide spread — ingredients fill the full sector width
      const spiralTurns = 1.5;
      const halfSector = sectorAngle * 0.42;
      // Continuous angle advance creates the swirl
      const angleAdvance = spiralT * spiralTurns * Math.PI * 2 / N;
      // Wide spread — ingredients drift freely across sector boundaries
      const sectorSpread = (rng() - 0.5) * halfSector * 3.0 * (0.5 + spiralT * 0.5);
      const spiralAngle = centerAngle + angleAdvance + sectorSpread;

      // Strong multi-taste pull — ingredients blend across sector boundaries
      let pullX = 0, pullZ = 0;
      for (let j = 0; j < N; j++) {
        if (j === ti) continue;
        const w = channels[TASTE_ORDER[j]] || 0;
        if (w > 0.05) {
          const pullAngle = j * sectorAngle - Math.PI / 2;
          pullX += Math.cos(pullAngle) * w * 12;
          pullZ += Math.sin(pullAngle) * w * 12;
        }
      }

      // Radial jitter for more spacing between ingredients
      const jr = (rng() - 0.5) * 12;
      const r = baseRadius + jr;

      const x = r * Math.cos(spiralAngle) + pullX;
      const z = r * Math.sin(spiralAngle) + pullZ;
      positions[name] = [x, 0, z];
    }
  }
  return positions;
}

/** Check if an ingredient has a specific taste */
export function ingredientHasTaste(name, node, taste) {
  const { channels } = scoreIngredient(name, node);
  return (channels[taste] || 0) > 0.1;
}
