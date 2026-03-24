// --- Taste selection state machine for Living Architecture view ---
// Extracted from LivingArchView.jsx — pure functions that operate on scene state
// passed as parameters (no closure dependencies).

import { ingredientHasTaste } from './livingArchUtils.js';
import { POPOUT_HEIGHT } from './livingArchConstants.js';

/**
 * Create the initial tasteSelection state object.
 * @param {number} count - number of ingredients (nodes)
 */
export function createTasteSelection(count) {
  return {
    taste1: null,       // first selected taste
    taste2: null,       // second selected taste (comparison)
    set1: new Set(),    // ingredient indices matching taste1
    set2: new Set(),    // ingredient indices matching taste2
    animating: false,
    animStartTime: 0,
    animDirection: 1,   // 1 = popping out, -1 = returning
    // Y offsets per ingredient (target values)
    yOffsets: new Float32Array(count),
    // Current animated Y offsets
    yCurrentOffsets: new Float32Array(count),
  };
}

/**
 * Compute which ingredients match a taste.
 * @param {string} taste
 * @param {Array} nodeArray
 * @returns {Set<number>} indices of matching ingredients
 */
export function getIndicesForTaste(taste, nodeArray) {
  const indices = new Set();
  for (let i = 0; i < nodeArray.length; i++) {
    const node = nodeArray[i];
    if (ingredientHasTaste(node.name, node, taste)) {
      indices.add(i);
    }
  }
  return indices;
}

/**
 * Build pop-out edge geometry for selected taste groups.
 * @param {object} tasteSelection
 * @param {Array} validEdges
 * @param {Float32Array} curPos
 * @param {THREE.BufferGeometry} popEdgeGeo
 * @param {THREE.LineSegments} popEdgeMesh
 * @param {number} POPOUT_EDGE_OPACITY
 * @param {number} MAX_POPOUT_EDGES
 */
export function buildPopoutEdges(tasteSelection, validEdges, curPos, popEdgeGeo, popEdgeMesh, POPOUT_EDGE_OPACITY, MAX_POPOUT_EDGES) {
  const allSelected = new Set([...tasteSelection.set1, ...tasteSelection.set2]);
  if (allSelected.size === 0) {
    popEdgeMesh.visible = false;
    popEdgeGeo.setDrawRange(0, 0);
    return;
  }

  const popEdgeVerts = popEdgeGeo.getAttribute('position').array;
  const popEdgeColors = popEdgeGeo.getAttribute('aColor').array;
  const popEdgeOpacities = popEdgeGeo.getAttribute('aOpacity').array;

  let edgeCount = 0;
  // Inline color values to avoid importing THREE just for Color
  const popColorR = 0.30980392156862746, popColorG = 0.5647058823529412, popColorB = 1.0; // #4f8fff
  const crossColorR = 1.0, crossColorG = 0.4196078431372549, crossColorB = 0.8745098039215686; // #ff6bdf

  for (let i = 0; i < validEdges.length && edgeCount < MAX_POPOUT_EDGES; i++) {
    const { si, ti, edge } = validEdges[i];
    const siSel = allSelected.has(si);
    const tiSel = allSelected.has(ti);
    if (!siSel || !tiSel) continue;

    // Both endpoints are in the selected set
    const o = edgeCount * 6;
    popEdgeVerts[o]   = curPos[si*3];   popEdgeVerts[o+1] = curPos[si*3+1]; popEdgeVerts[o+2] = curPos[si*3+2];
    popEdgeVerts[o+3] = curPos[ti*3];   popEdgeVerts[o+4] = curPos[ti*3+1]; popEdgeVerts[o+5] = curPos[ti*3+2];

    // Cross-group edges (one in set1, one in set2) get a different color
    const isCross = (tasteSelection.set1.has(si) && tasteSelection.set2.has(ti)) ||
                    (tasteSelection.set2.has(si) && tasteSelection.set1.has(ti));
    const str = edge.strength || 0;
    const opacity = POPOUT_EDGE_OPACITY * (0.3 + 0.7 * str);

    if (isCross) {
      popEdgeColors[o]   = crossColorR; popEdgeColors[o+1] = crossColorG; popEdgeColors[o+2] = crossColorB;
      popEdgeColors[o+3] = crossColorR; popEdgeColors[o+4] = crossColorG; popEdgeColors[o+5] = crossColorB;
    } else {
      popEdgeColors[o]   = popColorR; popEdgeColors[o+1] = popColorG; popEdgeColors[o+2] = popColorB;
      popEdgeColors[o+3] = popColorR; popEdgeColors[o+4] = popColorG; popEdgeColors[o+5] = popColorB;
    }
    popEdgeOpacities[edgeCount*2] = opacity;
    popEdgeOpacities[edgeCount*2+1] = opacity;
    edgeCount++;
  }

  popEdgeGeo.setDrawRange(0, edgeCount * 2);
  popEdgeGeo.getAttribute('position').needsUpdate = true;
  popEdgeGeo.getAttribute('aColor').needsUpdate = true;
  popEdgeGeo.getAttribute('aOpacity').needsUpdate = true;
  popEdgeMesh.visible = edgeCount > 0;
}

/**
 * Compute pairing-count-based Y offset for a set of ingredient indices.
 * In 2D wheel mode: vertical pop — most pairings closest to wheel, fewest furthest.
 * In 3D mode: use fixed POPOUT_HEIGHT.
 * @param {Set<number>} indices
 * @param {number} direction - 1 or -1
 * @param {object} tasteSelection - mutated in place (yOffsets)
 * @param {{ current: string }} modeRef
 * @param {Array} nodeArray
 */
export function computePairingOffset(indices, direction, tasteSelection, modeRef, nodeArray) {
  const sign = direction > 0 ? 1 : -1;
  if (modeRef.current !== 'wheel') {
    // 3D mode: fixed height
    for (const idx of indices) {
      tasteSelection.yOffsets[idx] = sign * POPOUT_HEIGHT;
    }
    return;
  }
  // 2D wheel mode: vertical displacement perpendicular to wheel
  // Most pairings = close to wheel plane, fewest = furthest away
  // Use percentile rank so height spreads evenly across the actual distribution
  // (pairing counts are power-law: log transform prevents bunching at the top)
  const MIN_HEIGHT = 2;   // closest to wheel (most pairings)
  const MAX_HEIGHT = 55;  // furthest from wheel (fewest pairings)

  // Collect and sort pairing counts to compute percentile rank
  const pcs = [];
  for (const idx of indices) pcs.push({ idx, pc: nodeArray[idx].pairingCount || 1 });
  pcs.sort((a, b) => b.pc - a.pc); // descending: most pairings first

  const n = pcs.length;
  for (let rank = 0; rank < n; rank++) {
    // percentile: 0 = most pairings, 1 = fewest
    const pct = n > 1 ? rank / (n - 1) : 0;
    // Square-root curve: gentle rise for top ingredients, steeper spread for lower ones
    const curved = Math.sqrt(pct);
    const height = MIN_HEIGHT + curved * (MAX_HEIGHT - MIN_HEIGHT);
    tasteSelection.yOffsets[pcs[rank].idx] = sign * height;
  }
}

/**
 * State machine for taste click: single -> dual -> clear.
 * Mutates tasteSelection in place.
 * @param {string} taste
 * @param {object} tasteSelection
 * @param {Array} nodeArray
 * @param {{ current: string }} modeRef
 * @param {Array} validEdges
 */
export function handleTasteClick(taste, tasteSelection, nodeArray, modeRef, validEdges) {
  if (tasteSelection.animating) return;

  if (tasteSelection.taste1 === taste) {
    // Clicking the same taste again -- clear everything
    tasteSelection.animDirection = -1;
    tasteSelection.animating = true;
    tasteSelection.animStartTime = performance.now();
    // After animation completes, clear state (handled in animate loop)
    return;
  }

  if (tasteSelection.taste1 === null) {
    // First taste selection -- pop up
    tasteSelection.taste1 = taste;
    tasteSelection.set1 = getIndicesForTaste(taste, nodeArray);
    tasteSelection.yOffsets.fill(0);
    computePairingOffset(tasteSelection.set1, 1, tasteSelection, modeRef, nodeArray);
    tasteSelection.animDirection = 1;
    tasteSelection.animating = true;
    tasteSelection.animStartTime = performance.now();
  } else if (tasteSelection.taste2 === null) {
    // Second taste selection -- pop down
    if (taste === tasteSelection.taste2) return;
    tasteSelection.taste2 = taste;
    tasteSelection.set2 = getIndicesForTaste(taste, nodeArray);
    // Remove overlapping ingredients from set2 (keep them in set1 above)
    for (const idx of tasteSelection.set1) {
      tasteSelection.set2.delete(idx);
    }
    computePairingOffset(tasteSelection.set2, -1, tasteSelection, modeRef, nodeArray);
    tasteSelection.animDirection = 1;
    tasteSelection.animating = true;
    tasteSelection.animStartTime = performance.now();
  } else {
    // Already have two tastes selected -- clear and start fresh
    tasteSelection.animDirection = -1;
    tasteSelection.animating = true;
    tasteSelection.animStartTime = performance.now();
    // Queue the new selection after clear completes
    tasteSelection._pendingTaste = taste;
  }
}

/**
 * Clear taste selection state and reset visuals.
 * @param {object} tasteSelection
 * @param {number} count - number of nodes
 * @param {THREE.InstancedMesh} mesh
 * @param {Array<THREE.Color>} defaultColors
 * @param {THREE.LineSegments} popEdgeMesh
 * @param {THREE.BufferGeometry} popEdgeGeo
 */
export function clearTasteSelection(tasteSelection, count, mesh, defaultColors, popEdgeMesh, popEdgeGeo) {
  tasteSelection.taste1 = null;
  tasteSelection.taste2 = null;
  tasteSelection.set1.clear();
  tasteSelection.set2.clear();
  tasteSelection.yOffsets.fill(0);
  tasteSelection.yCurrentOffsets.fill(0);
  popEdgeMesh.visible = false;
  popEdgeGeo.setDrawRange(0, 0);
  // Reset node colors
  for (let i = 0; i < count; i++) {
    mesh.setColorAt(i, defaultColors[i]);
  }
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
}
