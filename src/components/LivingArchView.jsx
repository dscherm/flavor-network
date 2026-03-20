import { useRef, useEffect, useCallback, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { computeTastePositions, TASTE_AXES, scoreIngredient } from '../data/tastePositioning.js';
import { getColorForNode } from '../three/NodeMesh.js';

// --- Constants ---

const TASTE_ORDER = ['sweet','sour','bitter','salty','umami','spicy','pungent','astringent'];
const TASTE_HEX = {
  sweet:'#fb92b4', sour:'#fde047', bitter:'#a78bfa', salty:'#93c5fd',
  umami:'#f9a870', spicy:'#f87171', pungent:'#b48c64', astringent:'#4ade80',
};
const CATEGORY_RADII = {
  protein:40, meat:40, seafood:38, dairy:32, vegetable:35, fruit:30,
  herb:28, spice:25, grain:33, nut:27, condiment:22, oil:20, default:30,
};
const TRANSITION_DURATION = 1500; // ms
const POPOUT_DURATION = 800; // ms for taste pop-out animation
const POPOUT_HEIGHT = 15; // units above/below wheel

// --- Helpers ---

function easeInOutCubic(t) {
  return t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t+2, 3) / 2;
}

function hashStr(s) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return h;
}

function seededRng(seed) {
  let st = seed >>> 0;
  return () => { st = (1664525 * st + 1013904223) % 4294967296; return st / 4294967296; };
}

/** Create a billboard sprite with text */
function makeLabel(text, color, size) {
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
function computeWheelPositions(nodes) {
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
function ingredientHasTaste(name, node, taste) {
  const { channels } = scoreIngredient(name, node);
  return (channels[taste] || 0) > 0.1;
}

// ==========================================================================
// Component
// ==========================================================================

export default function LivingArchView({
  data,
  onNodeClick,
  selectedNode,
  selectedNodes = [],
  showEdges = true,
  showParticles = true,
  filterTaste = '',
  treeFilterIngredients = null,
  bridgePathIngredients = null,
  mode: externalMode,
  onModeChange,
}) {
  const containerRef = useRef(null);
  const stateRef = useRef(null); // holds all Three.js state
  // Use lifted state if provided, otherwise local state
  const [localMode, setLocalMode] = useState('neural');
  const mode = externalMode !== undefined ? externalMode : localMode;
  const setMode = onModeChange || setLocalMode;
  const modeRef = useRef(mode);

  // Keep modeRef in sync for use inside animation loop
  useEffect(() => { modeRef.current = mode; }, [mode]);

  // ---- Build scene ----
  useEffect(() => {
    if (!containerRef.current || !data) return;
    const { graph } = data;
    const nodeArray = Array.from(graph.nodes.values());
    const count = nodeArray.length;
    if (count === 0) return;

    // Positions — prefer GAT embeddings, fall back to taste-axis positions
    let posData = data.positions;
    if (!posData || !posData.positions) posData = computeTastePositions(graph.nodes, graph.edges, 50);
    const tastePos = posData.positions || posData;
    const pos2D = computeWheelPositions(graph.nodes);

    // Check if GAT embeddings are available
    const sampleNode = nodeArray[0];
    const hasEmbeddings = sampleNode && sampleNode.embedding && typeof sampleNode.embedding.x === 'number';

    // Name index map
    const nameIdx = new Map();
    nodeArray.forEach((n, i) => nameIdx.set(n.name, i));

    // Float32Arrays for both position sets
    const posA = new Float32Array(count * 3);
    const posB = new Float32Array(count * 3);
    const curPos = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      const node = nodeArray[i];
      const name = node.name;
      // 3D mode: use GAT embeddings if available, otherwise taste positions
      let a;
      if (hasEmbeddings && node.embedding) {
        a = [node.embedding.x, node.embedding.y, node.embedding.z];
      } else {
        a = tastePos[name] || [0, 0, 0];
      }
      const b = pos2D[name] || [0, 0, 0];
      posA[i*3] = a[0]; posA[i*3+1] = a[1]; posA[i*3+2] = a[2];
      posB[i*3] = b[0]; posB[i*3+1] = b[1]; posB[i*3+2] = b[2];
      curPos[i*3] = a[0]; curPos[i*3+1] = a[1]; curPos[i*3+2] = a[2];
    }

    // --- Renderer, Scene, Camera ---
    const el = containerRef.current;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0a0f);

    const camera = new THREE.PerspectiveCamera(60, el.clientWidth/el.clientHeight, 0.1, 2000);
    camera.position.set(0, 40, 120);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(el.clientWidth, el.clientHeight);
    el.appendChild(renderer.domElement);

    // Post-processing
    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    composer.addPass(new UnrealBloomPass(new THREE.Vector2(el.clientWidth, el.clientHeight), 1.5, 0.4, 0.85));

    // Lights
    scene.add(new THREE.AmbientLight(0x404060, 1.0));
    const pl1 = new THREE.PointLight(0x4f8fff, 2.0, 500); pl1.position.set(50, 80, 100); scene.add(pl1);
    const pl2 = new THREE.PointLight(0xff6b9d, 1.5, 500); pl2.position.set(-80, -50, -60); scene.add(pl2);

    // Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true; controls.dampingFactor = 0.05;
    controls.minDistance = 10; controls.maxDistance = 300;

    // --- InstancedMesh for nodes ---
    const geo = new THREE.SphereGeometry(1, 16, 16);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9 });
    const mesh = new THREE.InstancedMesh(geo, mat, count);
    mesh.frustumCulled = true;
    const dummy = new THREE.Object3D();
    const defaultColors = [];

    for (let i = 0; i < count; i++) {
      const node = nodeArray[i];
      dummy.position.set(curPos[i*3], curPos[i*3+1], curPos[i*3+2]);
      const pc = node.pairingCount || 0;
      const s = Math.max(0.3, Math.min(2.0, Math.sqrt(pc) * 0.15));
      dummy.scale.set(s, s, s);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      const c = getColorForNode(node);
      defaultColors.push(c.clone());
      mesh.setColorAt(i, c);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    scene.add(mesh);

    // --- Edges (BufferGeometry + LineSegments) ---
    const validEdges = [];
    for (const edge of graph.edges) {
      const si = nameIdx.get(edge.source);
      const ti = nameIdx.get(edge.target);
      if (si !== undefined && ti !== undefined) validEdges.push({ edge, si, ti });
    }

    const edgeVerts = new Float32Array(validEdges.length * 6);
    const edgeColors = new Float32Array(validEdges.length * 6);
    const edgeOpacities = new Float32Array(validEdges.length * 2);
    const tmp = new THREE.Color();
    const tmp2 = new THREE.Color();

    // Base edge opacity multiplier — 50% brighter than before (was 0.2, now 0.3)
    const BASE_EDGE_DIM = 0.3;
    // Edge opacity for popped-out ingredient connections
    const POPOUT_EDGE_OPACITY = 0.3;

    function updateEdgePositions() {
      for (let i = 0; i < validEdges.length; i++) {
        const { si, ti, edge } = validEdges[i];
        const o = i * 6;
        edgeVerts[o]   = curPos[si*3];   edgeVerts[o+1] = curPos[si*3+1]; edgeVerts[o+2] = curPos[si*3+2];
        edgeVerts[o+3] = curPos[ti*3];   edgeVerts[o+4] = curPos[ti*3+1]; edgeVerts[o+5] = curPos[ti*3+2];
        const str = edge.strength || 0;
        // Color-code edges: source node color → target node color (GPU interpolates)
        tmp.copy(defaultColors[si]);
        tmp2.copy(defaultColors[ti]);
        // Boost brightness based on strength
        const brighten = 0.3 + 0.7 * str;
        edgeColors[o]   = tmp.r * BASE_EDGE_DIM * brighten;
        edgeColors[o+1] = tmp.g * BASE_EDGE_DIM * brighten;
        edgeColors[o+2] = tmp.b * BASE_EDGE_DIM * brighten;
        edgeColors[o+3] = tmp2.r * BASE_EDGE_DIM * brighten;
        edgeColors[o+4] = tmp2.g * BASE_EDGE_DIM * brighten;
        edgeColors[o+5] = tmp2.b * BASE_EDGE_DIM * brighten;
        const op = (0.04 + 0.26 * str) * BASE_EDGE_DIM;
        edgeOpacities[i*2] = op; edgeOpacities[i*2+1] = op;
      }
    }
    updateEdgePositions();

    const edgeGeo = new THREE.BufferGeometry();
    edgeGeo.setAttribute('position', new THREE.Float32BufferAttribute(edgeVerts, 3));
    edgeGeo.setAttribute('aColor', new THREE.Float32BufferAttribute(edgeColors, 3));
    edgeGeo.setAttribute('aOpacity', new THREE.Float32BufferAttribute(edgeOpacities, 1));

    const edgeMat = new THREE.ShaderMaterial({
      vertexShader: `
        attribute vec3 aColor;
        attribute float aOpacity;
        varying vec3 vColor;
        varying float vOpacity;
        void main() {
          vColor = aColor;
          vOpacity = aOpacity;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec3 vColor;
        varying float vOpacity;
        void main() { gl_FragColor = vec4(vColor, vOpacity); }
      `,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    const edgeMesh = new THREE.LineSegments(edgeGeo, edgeMat);
    scene.add(edgeMesh);

    // --- Pop-out edges (for taste selection connections) ---
    const MAX_POPOUT_EDGES = 10000;
    const popEdgeVerts = new Float32Array(MAX_POPOUT_EDGES * 6);
    const popEdgeColors = new Float32Array(MAX_POPOUT_EDGES * 6);
    const popEdgeOpacities = new Float32Array(MAX_POPOUT_EDGES * 2);
    const popEdgeGeo = new THREE.BufferGeometry();
    popEdgeGeo.setAttribute('position', new THREE.Float32BufferAttribute(popEdgeVerts, 3));
    popEdgeGeo.setAttribute('aColor', new THREE.Float32BufferAttribute(popEdgeColors, 3));
    popEdgeGeo.setAttribute('aOpacity', new THREE.Float32BufferAttribute(popEdgeOpacities, 1));
    popEdgeGeo.setDrawRange(0, 0);
    const popEdgeMat = new THREE.ShaderMaterial({
      vertexShader: edgeMat.vertexShader,
      fragmentShader: edgeMat.fragmentShader,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    const popEdgeMesh = new THREE.LineSegments(popEdgeGeo, popEdgeMat);
    popEdgeMesh.visible = false;
    scene.add(popEdgeMesh);

    // --- Taste Region Labels (Sprites) ---
    const labelGroup = new THREE.Group();
    const tasteLabelSprites = []; // Array of sprites for raycasting
    for (let i = 0; i < TASTE_ORDER.length; i++) {
      const taste = TASTE_ORDER[i];
      const axis = TASTE_AXES[taste];
      const hex = TASTE_HEX[taste] || '#ffffff';
      const sprite = makeLabel(taste.toUpperCase(), hex, 24);
      // Position at the extreme of the taste axis in 3D mode
      sprite.position.set(axis[0] * 60, axis[1] * 60, axis[2] * 60);
      sprite.userData = { taste, axis3D: [axis[0]*60, axis[1]*60, axis[2]*60], isLabel: true };
      labelGroup.add(sprite);
      tasteLabelSprites.push(sprite);
    }
    scene.add(labelGroup);

    // --- Octagonal sector lines + concentric rings for wheel mode ---
    const sectorGroup = new THREE.Group();
    sectorGroup.visible = false;
    const N_TASTES = TASTE_ORDER.length;
    const sectorAngle = (Math.PI * 2) / N_TASTES;
    const lineMat = new THREE.LineBasicMaterial({ color: 0x333355, transparent: true, opacity: 0.4 });
    const faintMat = new THREE.LineBasicMaterial({ color: 0x222244, transparent: true, opacity: 0.2 });

    // Radial sector dividers (from center to edge)
    for (let i = 0; i < N_TASTES; i++) {
      const angle = i * sectorAngle - Math.PI / 2;
      const pts = [new THREE.Vector3(0, 0.1, 0), new THREE.Vector3(Math.cos(angle) * 55, 0.1, Math.sin(angle) * 55)];
      const lg = new THREE.BufferGeometry().setFromPoints(pts);
      sectorGroup.add(new THREE.Line(lg, lineMat));
    }

    // Concentric octagonal rings at 25%, 50%, 75%, 100%
    for (const pct of [0.25, 0.5, 0.75, 1.0]) {
      const ringR = 50 * pct;
      const ringPts = [];
      for (let i = 0; i <= N_TASTES; i++) {
        const angle = (i % N_TASTES) * sectorAngle - Math.PI / 2;
        ringPts.push(new THREE.Vector3(Math.cos(angle) * ringR, 0.1, Math.sin(angle) * ringR));
      }
      const ringGeo = new THREE.BufferGeometry().setFromPoints(ringPts);
      sectorGroup.add(new THREE.Line(ringGeo, pct === 1.0 ? lineMat : faintMat));
    }

    scene.add(sectorGroup);

    // --- Taste pop-out state ---
    const tasteSelection = {
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

    /** Compute which ingredients match a taste */
    function getIndicesForTaste(taste) {
      const indices = new Set();
      for (let i = 0; i < count; i++) {
        const node = nodeArray[i];
        if (ingredientHasTaste(node.name, node, taste)) {
          indices.add(i);
        }
      }
      return indices;
    }

    /** Build pop-out edge geometry for selected taste groups */
    function buildPopoutEdges() {
      const allSelected = new Set([...tasteSelection.set1, ...tasteSelection.set2]);
      if (allSelected.size === 0) {
        popEdgeMesh.visible = false;
        popEdgeGeo.setDrawRange(0, 0);
        return;
      }

      let edgeCount = 0;
      const popColor = new THREE.Color('#4f8fff');
      const crossColor = new THREE.Color('#ff6bdf');

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
        const c = isCross ? crossColor : popColor;
        const str = edge.strength || 0;
        const opacity = POPOUT_EDGE_OPACITY * (0.3 + 0.7 * str);

        popEdgeColors[o]   = c.r; popEdgeColors[o+1] = c.g; popEdgeColors[o+2] = c.b;
        popEdgeColors[o+3] = c.r; popEdgeColors[o+4] = c.g; popEdgeColors[o+5] = c.b;
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

    /** Compute pairing-count-based Y offset for a set of ingredient indices.
     *  In 2D wheel mode: vertical pop — most pairings closest to wheel, fewest pairings furthest.
     *  In 3D mode: use fixed POPOUT_HEIGHT as before. */
    function computePairingOffset(indices, direction) {
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

    /** Start pop-out animation for a taste click */
    function handleTasteClick(taste) {
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
        tasteSelection.set1 = getIndicesForTaste(taste);
        tasteSelection.yOffsets.fill(0);
        computePairingOffset(tasteSelection.set1, 1);
        tasteSelection.animDirection = 1;
        tasteSelection.animating = true;
        tasteSelection.animStartTime = performance.now();
      } else if (tasteSelection.taste2 === null) {
        // Second taste selection -- pop down
        if (taste === tasteSelection.taste2) return;
        tasteSelection.taste2 = taste;
        tasteSelection.set2 = getIndicesForTaste(taste);
        // Remove overlapping ingredients from set2 (keep them in set1 above)
        for (const idx of tasteSelection.set1) {
          tasteSelection.set2.delete(idx);
        }
        computePairingOffset(tasteSelection.set2, -1);
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

    /** Clear taste selection (called when clicking empty space or same taste) */
    function clearTasteSelection() {
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

    // --- Raycasting ---
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    function raycastLabels(event) {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(mouse, camera);
      // Check taste label sprites first
      const labelHits = raycaster.intersectObjects(tasteLabelSprites);
      if (labelHits.length > 0) {
        return { type: 'label', taste: labelHits[0].object.userData.taste };
      }
      // Then check instanced mesh
      const meshHits = raycaster.intersectObject(mesh);
      if (meshHits.length > 0) {
        return { type: 'node', instanceId: meshHits[0].instanceId };
      }
      return { type: 'none' };
    }

    function onClick(event) {
      const hit = raycastLabels(event);
      if (hit.type === 'label') {
        handleTasteClick(hit.taste);
        return;
      }
      if (hit.type === 'node') {
        // If taste selection is active, clear it
        if (tasteSelection.taste1 !== null && !tasteSelection.animating) {
          tasteSelection.animDirection = -1;
          tasteSelection.animating = true;
          tasteSelection.animStartTime = performance.now();
        }
        if (onNodeClick) onNodeClick(nodeArray[hit.instanceId]);
        return;
      }
      // Clicked empty space
      if (tasteSelection.taste1 !== null && !tasteSelection.animating) {
        tasteSelection.animDirection = -1;
        tasteSelection.animating = true;
        tasteSelection.animStartTime = performance.now();
      }
      if (onNodeClick) onNodeClick(null);
    }
    renderer.domElement.addEventListener('click', onClick);
    renderer.domElement.style.cursor = 'default';
    let lastHover = -1;
    let lastHoverType = 'none';
    function onMove(event) {
      const hit = raycastLabels(event);
      const newType = hit.type;
      const newId = hit.type === 'node' ? hit.instanceId : (hit.type === 'label' ? hit.taste : -1);
      const curId = lastHoverType === 'node' ? lastHover : (lastHoverType === 'label' ? lastHover : -1);
      if (newType !== lastHoverType || newId !== curId) {
        lastHoverType = newType;
        lastHover = newId;
        renderer.domElement.style.cursor = (newType === 'node' || newType === 'label') ? 'pointer' : 'default';
      }
    }
    renderer.domElement.addEventListener('mousemove', onMove);

    // --- Transition state ---
    const transition = { active: false, startTime: 0, fromMode: 'neural', toMode: 'wheel' };

    // Camera targets
    const camTargets = {
      neural: { pos: [0, 40, 120], lookAt: [0, 0, 0] },
      wheel:  { pos: [0, 120, 0.1], lookAt: [0, 0, 0] },
    };

    // Store starting camera for transition
    let camStart = { pos: [0,40,120], lookAt: [0,0,0] };

    // --- Resize ---
    function onResize() {
      const w = el.clientWidth, h = el.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      composer.setSize(w, h);
    }
    window.addEventListener('resize', onResize);

    // --- Animate ---
    let running = true;
    const dimColor = new THREE.Color('#111118');
    function animate() {
      if (!running) return;
      requestAnimationFrame(animate);

      // Handle mode transition (neural <-> wheel)
      if (transition.active) {
        const elapsed = performance.now() - transition.startTime;
        let t = Math.min(elapsed / TRANSITION_DURATION, 1);
        const et = easeInOutCubic(t);

        const isToWheel = transition.toMode === 'wheel';
        const srcPos = isToWheel ? posA : posB;
        const dstPos = isToWheel ? posB : posA;

        // Lerp node positions
        for (let i = 0; i < count; i++) {
          curPos[i*3]   = srcPos[i*3]   + (dstPos[i*3]   - srcPos[i*3])   * et;
          curPos[i*3+1] = srcPos[i*3+1] + (dstPos[i*3+1] - srcPos[i*3+1]) * et;
          curPos[i*3+2] = srcPos[i*3+2] + (dstPos[i*3+2] - srcPos[i*3+2]) * et;

          mesh.getMatrixAt(i, dummy.matrix);
          dummy.matrix.decompose(dummy.position, dummy.quaternion, dummy.scale);
          dummy.position.set(curPos[i*3], curPos[i*3+1], curPos[i*3+2]);
          dummy.updateMatrix();
          mesh.setMatrixAt(i, dummy.matrix);
        }
        mesh.instanceMatrix.needsUpdate = true;

        // Update edge positions
        updateEdgePositions();
        edgeGeo.getAttribute('position').array.set(edgeVerts);
        edgeGeo.getAttribute('position').needsUpdate = true;
        edgeGeo.getAttribute('aColor').needsUpdate = true;
        edgeGeo.getAttribute('aOpacity').needsUpdate = true;

        // Lerp labels between 3D axis positions and 2D wheel positions
        const sA = (Math.PI * 2) / TASTE_ORDER.length;
        labelGroup.children.forEach((sprite, idx) => {
          const a3 = sprite.userData.axis3D;
          const angle = idx * sA - Math.PI / 2; // start from top
          const w2 = [Math.cos(angle) * 55, 2, Math.sin(angle) * 55];
          // Swap source/dest based on transition direction
          const srcLabel = isToWheel ? a3 : w2;
          const dstLabel = isToWheel ? w2 : a3;
          sprite.position.set(
            srcLabel[0] + (dstLabel[0] - srcLabel[0]) * et,
            srcLabel[1] + (dstLabel[1] - srcLabel[1]) * et,
            srcLabel[2] + (dstLabel[2] - srcLabel[2]) * et,
          );
        });

        // Lerp camera
        const camEnd = camTargets[transition.toMode];
        camera.position.set(
          camStart.pos[0] + (camEnd.pos[0] - camStart.pos[0]) * et,
          camStart.pos[1] + (camEnd.pos[1] - camStart.pos[1]) * et,
          camStart.pos[2] + (camEnd.pos[2] - camStart.pos[2]) * et,
        );
        camera.lookAt(camEnd.lookAt[0], camEnd.lookAt[1], camEnd.lookAt[2]);

        // Show/hide sector lines
        if (isToWheel) {
          sectorGroup.visible = et > 0.3;
          lineMat.opacity = Math.max(0, (et - 0.3) / 0.7) * 0.4;
        } else {
          sectorGroup.visible = et < 0.7;
          lineMat.opacity = 0.4 * (1 - et);
        }

        if (t >= 1) {
          transition.active = false;
          // Reset controls target
          controls.target.set(camEnd.lookAt[0], camEnd.lookAt[1], camEnd.lookAt[2]);
          controls.update();
          sectorGroup.visible = transition.toMode === 'wheel';
        }
      }

      // Handle taste pop-out animation
      if (tasteSelection.animating) {
        const elapsed = performance.now() - tasteSelection.animStartTime;
        let t = Math.min(elapsed / POPOUT_DURATION, 1);
        const et = easeInOutCubic(t);

        if (tasteSelection.animDirection === 1) {
          // Animating outward (Y only — perpendicular to wheel)
          for (let i = 0; i < count; i++) {
            tasteSelection.yCurrentOffsets[i] = tasteSelection.yOffsets[i] * et;
          }
          // Dim non-selected ingredients
          const allSelected = new Set([...tasteSelection.set1, ...tasteSelection.set2]);
          for (let i = 0; i < count; i++) {
            if (allSelected.has(i)) {
              mesh.setColorAt(i, defaultColors[i]);
            } else {
              const dc = defaultColors[i].clone().lerp(dimColor, et * 0.7);
              mesh.setColorAt(i, dc);
            }
          }
          if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
        } else {
          // Animating back (reverse)
          for (let i = 0; i < count; i++) {
            tasteSelection.yCurrentOffsets[i] = tasteSelection.yOffsets[i] * (1 - et);
          }
          // Restore colors
          for (let i = 0; i < count; i++) {
            const restored = defaultColors[i].clone().lerp(dimColor, (1 - et) * 0.7);
            const allSelected = new Set([...tasteSelection.set1, ...tasteSelection.set2]);
            if (allSelected.has(i)) {
              mesh.setColorAt(i, defaultColors[i]);
            } else {
              mesh.setColorAt(i, restored);
            }
          }
          if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
        }

        // Apply Y offsets to current positions and update instance matrices
        for (let i = 0; i < count; i++) {
          mesh.getMatrixAt(i, dummy.matrix);
          dummy.matrix.decompose(dummy.position, dummy.quaternion, dummy.scale);
          dummy.position.set(curPos[i*3], curPos[i*3+1] + tasteSelection.yCurrentOffsets[i], curPos[i*3+2]);
          dummy.updateMatrix();
          mesh.setMatrixAt(i, dummy.matrix);
        }
        mesh.instanceMatrix.needsUpdate = true;

        // Update pop-out edges with offset positions
        if (tasteSelection.animDirection === 1) {
          // Rebuild pop-out edges with current offset positions
          const allSelected = new Set([...tasteSelection.set1, ...tasteSelection.set2]);
          if (allSelected.size > 0 && et > 0.2) {
            let edgeCount = 0;
            const popColor = new THREE.Color('#4f8fff');
            const crossColor = new THREE.Color('#ff6bdf');
            for (let ei = 0; ei < validEdges.length && edgeCount < MAX_POPOUT_EDGES; ei++) {
              const { si, ti, edge } = validEdges[ei];
              if (!allSelected.has(si) || !allSelected.has(ti)) continue;
              const o = edgeCount * 6;
              popEdgeVerts[o]   = curPos[si*3];
              popEdgeVerts[o+1] = curPos[si*3+1] + tasteSelection.yCurrentOffsets[si];
              popEdgeVerts[o+2] = curPos[si*3+2];
              popEdgeVerts[o+3] = curPos[ti*3];
              popEdgeVerts[o+4] = curPos[ti*3+1] + tasteSelection.yCurrentOffsets[ti];
              popEdgeVerts[o+5] = curPos[ti*3+2];
              const isCross = (tasteSelection.set1.has(si) && tasteSelection.set2.has(ti)) ||
                              (tasteSelection.set2.has(si) && tasteSelection.set1.has(ti));
              const c = isCross ? crossColor : popColor;
              const str = edge.strength || 0;
              const opacity = POPOUT_EDGE_OPACITY * (0.3 + 0.7 * str) * et;
              popEdgeColors[o]   = c.r; popEdgeColors[o+1] = c.g; popEdgeColors[o+2] = c.b;
              popEdgeColors[o+3] = c.r; popEdgeColors[o+4] = c.g; popEdgeColors[o+5] = c.b;
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
        } else {
          // Fading out pop edges
          if (popEdgeMesh.visible) {
            // Update positions as nodes return
            let edgeCount = 0;
            const allSelected = new Set([...tasteSelection.set1, ...tasteSelection.set2]);
            const popColor = new THREE.Color('#4f8fff');
            const crossColor = new THREE.Color('#ff6bdf');
            for (let ei = 0; ei < validEdges.length && edgeCount < MAX_POPOUT_EDGES; ei++) {
              const { si, ti, edge } = validEdges[ei];
              if (!allSelected.has(si) || !allSelected.has(ti)) continue;
              const o = edgeCount * 6;
              popEdgeVerts[o]   = curPos[si*3];
              popEdgeVerts[o+1] = curPos[si*3+1] + tasteSelection.yCurrentOffsets[si];
              popEdgeVerts[o+2] = curPos[si*3+2];
              popEdgeVerts[o+3] = curPos[ti*3];
              popEdgeVerts[o+4] = curPos[ti*3+1] + tasteSelection.yCurrentOffsets[ti];
              popEdgeVerts[o+5] = curPos[ti*3+2];
              const isCross = (tasteSelection.set1.has(si) && tasteSelection.set2.has(ti)) ||
                              (tasteSelection.set2.has(si) && tasteSelection.set1.has(ti));
              const c = isCross ? crossColor : popColor;
              const str = edge.strength || 0;
              const opacity = POPOUT_EDGE_OPACITY * (0.3 + 0.7 * str) * (1 - et);
              popEdgeColors[o]   = c.r; popEdgeColors[o+1] = c.g; popEdgeColors[o+2] = c.b;
              popEdgeColors[o+3] = c.r; popEdgeColors[o+4] = c.g; popEdgeColors[o+5] = c.b;
              popEdgeOpacities[edgeCount*2] = opacity;
              popEdgeOpacities[edgeCount*2+1] = opacity;
              edgeCount++;
            }
            popEdgeGeo.setDrawRange(0, edgeCount * 2);
            popEdgeGeo.getAttribute('position').needsUpdate = true;
            popEdgeGeo.getAttribute('aColor').needsUpdate = true;
            popEdgeGeo.getAttribute('aOpacity').needsUpdate = true;
          }
        }

        if (t >= 1) {
          tasteSelection.animating = false;
          if (tasteSelection.animDirection === -1) {
            const pending = tasteSelection._pendingTaste;
            clearTasteSelection();
            // If there was a queued taste, start it
            if (pending) {
              tasteSelection._pendingTaste = null;
              handleTasteClick(pending);
            }
          }
        }
      }

      // Even when not animating taste pop-out, keep Y offsets applied
      // (for static state after animation completes with direction=1)
      if (!tasteSelection.animating && (tasteSelection.taste1 !== null || tasteSelection.taste2 !== null)) {
        // Ensure positions include Y offsets
        for (let i = 0; i < count; i++) {
          if (tasteSelection.yCurrentOffsets[i] !== 0) {
            mesh.getMatrixAt(i, dummy.matrix);
            dummy.matrix.decompose(dummy.position, dummy.quaternion, dummy.scale);
            dummy.position.set(curPos[i*3], curPos[i*3+1] + tasteSelection.yCurrentOffsets[i], curPos[i*3+2]);
            dummy.updateMatrix();
            mesh.setMatrixAt(i, dummy.matrix);
          }
        }
        mesh.instanceMatrix.needsUpdate = true;

        // Keep pop-out edges updated with current positions
        buildPopoutEdges();
      }

      controls.update();
      composer.render();
    }
    animate();

    // --- Expose trigger function ---
    const triggerTransition = (toMode) => {
      if (transition.active) return;
      const fromMode = toMode === 'wheel' ? 'neural' : 'wheel';
      camStart = { pos: [camera.position.x, camera.position.y, camera.position.z], lookAt: [0,0,0] };
      transition.active = true;
      transition.startTime = performance.now();
      transition.fromMode = fromMode;
      transition.toMode = toMode;
    };

    stateRef.current = {
      scene, camera, renderer, composer, controls, mesh, edgeMesh, edgeGeo,
      edgeColors, edgeOpacities, validEdges,
      nodeArray, nameIdx, defaultColors, curPos, posA, posB,
      triggerTransition, labelGroup, sectorGroup, tasteSelection,
      updateEdgePositions,
    };

    return () => {
      running = false;
      window.removeEventListener('resize', onResize);
      renderer.domElement.removeEventListener('click', onClick);
      renderer.domElement.removeEventListener('mousemove', onMove);
      controls.dispose();
      composer.dispose();
      renderer.dispose();
      geo.dispose();
      mat.dispose();
      edgeGeo.dispose();
      edgeMat.dispose();
      popEdgeGeo.dispose();
      popEdgeMat.dispose();
      lineMat.dispose();
      labelGroup.children.forEach(s => { s.material.map.dispose(); s.material.dispose(); });
      if (el.contains(renderer.domElement)) el.removeChild(renderer.domElement);
      stateRef.current = null;
    };
  }, [data]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- Selection handling ----
  useEffect(() => {
    const st = stateRef.current;
    if (!st) return;
    const { mesh, defaultColors, nodeArray, nameIdx, edgeMesh: em, tasteSelection } = st;
    const count = nodeArray.length;
    const activeNodes = selectedNodes.length > 0 ? selectedNodes : (selectedNode ? [selectedNode] : []);

    // Skip color override if taste selection is active
    if (tasteSelection && (tasteSelection.taste1 !== null || tasteSelection.taste2 !== null)) return;

    if (activeNodes.length > 0 && data) {
      const connMap = new Map();
      for (const sel of activeNodes) {
        connMap.set(sel, 1.0);
        for (const edge of data.graph.edges) {
          if (edge.source === sel) connMap.set(edge.target, Math.max(connMap.get(edge.target)||0, edge.strength));
          else if (edge.target === sel) connMap.set(edge.source, Math.max(connMap.get(edge.source)||0, edge.strength));
        }
      }
      for (let i = 0; i < count; i++) {
        const name = nodeArray[i].name;
        const str = connMap.get(name);
        if (str !== undefined) {
          const c = defaultColors[i].clone().lerp(new THREE.Color('#ffffff'), str * 0.6);
          mesh.setColorAt(i, c);
        } else {
          mesh.setColorAt(i, defaultColors[i].clone().multiplyScalar(0.15));
        }
      }
    } else {
      for (let i = 0; i < count; i++) mesh.setColorAt(i, defaultColors[i]);
    }
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [selectedNode, selectedNodes, data]);

  // ---- Edge visibility ----
  useEffect(() => {
    const st = stateRef.current;
    if (st && st.edgeMesh) st.edgeMesh.visible = showEdges;
  }, [showEdges]);

  // ---- Taste filter ----
  useEffect(() => {
    const st = stateRef.current;
    if (!st || !data) return;
    const { mesh, defaultColors, nodeArray } = st;
    const dimColor = new THREE.Color('#111118');

    if (!filterTaste) {
      for (let i = 0; i < nodeArray.length; i++) mesh.setColorAt(i, defaultColors[i]);
    } else {
      const fl = filterTaste.toLowerCase();
      for (let i = 0; i < nodeArray.length; i++) {
        const taste = (nodeArray[i].taste || '').toLowerCase();
        mesh.setColorAt(i, taste.includes(fl) ? defaultColors[i] : dimColor);
      }
    }
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [filterTaste, data]);

  // ---- Tree filter highlighting (TASK-155) ----
  useEffect(() => {
    const st = stateRef.current;
    if (!st || !data) return;
    const { mesh, defaultColors, nodeArray, edgeGeo, edgeColors, edgeOpacities, validEdges, updateEdgePositions: updateEdges } = st;
    const dimColor = new THREE.Color('#111118');

    if (!treeFilterIngredients || treeFilterIngredients.length === 0) {
      // Reset if no other filters active
      if (!filterTaste) {
        for (let i = 0; i < nodeArray.length; i++) mesh.setColorAt(i, defaultColors[i]);
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
        // Reset edge colors
        updateEdges();
        edgeGeo.getAttribute('aColor').needsUpdate = true;
        edgeGeo.getAttribute('aOpacity').needsUpdate = true;
      }
      return;
    }

    const activeSet = new Set(treeFilterIngredients);
    const count = nodeArray.length;
    for (let i = 0; i < count; i++) {
      const name = nodeArray[i].name;
      if (activeSet.has(name)) {
        mesh.setColorAt(i, defaultColors[i].clone().lerp(new THREE.Color('#ffffff'), 0.3));
      } else {
        mesh.setColorAt(i, dimColor);
      }
    }
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;

    // Dim edges not connecting active ingredients
    const nameIdx = st.nameIdx;
    for (let i = 0; i < validEdges.length; i++) {
      const { si, ti } = validEdges[i];
      const srcName = nodeArray[si].name;
      const tgtName = nodeArray[ti].name;
      const o = i * 6;
      if (activeSet.has(srcName) && activeSet.has(tgtName)) {
        // Keep bright
      } else {
        edgeColors[o] *= 0.1; edgeColors[o+1] *= 0.1; edgeColors[o+2] *= 0.1;
        edgeColors[o+3] *= 0.1; edgeColors[o+4] *= 0.1; edgeColors[o+5] *= 0.1;
        edgeOpacities[i*2] *= 0.1; edgeOpacities[i*2+1] *= 0.1;
      }
    }
    edgeGeo.getAttribute('aColor').needsUpdate = true;
    edgeGeo.getAttribute('aOpacity').needsUpdate = true;
  }, [treeFilterIngredients, filterTaste, data]);

  // ---- Bridge path highlighting (TASK-159) ----
  useEffect(() => {
    const st = stateRef.current;
    if (!st || !data) return;
    const { mesh, defaultColors, nodeArray, edgeGeo, edgeColors, edgeOpacities, validEdges, updateEdgePositions: updateEdges } = st;
    const dimColor = new THREE.Color('#111118');
    const pathColor = new THREE.Color('#22d3ee');

    if (!bridgePathIngredients || bridgePathIngredients.length === 0) {
      // Don't reset if tree filter is active
      if (!treeFilterIngredients) {
        for (let i = 0; i < nodeArray.length; i++) mesh.setColorAt(i, defaultColors[i]);
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
        updateEdges();
        edgeGeo.getAttribute('aColor').needsUpdate = true;
        edgeGeo.getAttribute('aOpacity').needsUpdate = true;
      }
      return;
    }

    const pathSet = new Set(bridgePathIngredients);
    const count = nodeArray.length;
    for (let i = 0; i < count; i++) {
      const name = nodeArray[i].name;
      if (pathSet.has(name)) {
        mesh.setColorAt(i, defaultColors[i].clone().lerp(pathColor, 0.5));
      } else {
        mesh.setColorAt(i, defaultColors[i].clone().lerp(dimColor, 0.7));
      }
    }
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;

    // Highlight edges along path
    const pathEdgeSet = new Set();
    for (let i = 0; i < bridgePathIngredients.length - 1; i++) {
      pathEdgeSet.add(`${bridgePathIngredients[i]}|${bridgePathIngredients[i+1]}`);
      pathEdgeSet.add(`${bridgePathIngredients[i+1]}|${bridgePathIngredients[i]}`);
    }
    updateEdges();
    for (let i = 0; i < validEdges.length; i++) {
      const { si, ti } = validEdges[i];
      const key = `${nodeArray[si].name}|${nodeArray[ti].name}`;
      const o = i * 6;
      if (pathEdgeSet.has(key)) {
        // Bright cyan for path edges
        edgeColors[o] = pathColor.r; edgeColors[o+1] = pathColor.g; edgeColors[o+2] = pathColor.b;
        edgeColors[o+3] = pathColor.r; edgeColors[o+4] = pathColor.g; edgeColors[o+5] = pathColor.b;
        edgeOpacities[i*2] = 0.8; edgeOpacities[i*2+1] = 0.8;
      } else {
        edgeColors[o] *= 0.15; edgeColors[o+1] *= 0.15; edgeColors[o+2] *= 0.15;
        edgeColors[o+3] *= 0.15; edgeColors[o+4] *= 0.15; edgeColors[o+5] *= 0.15;
        edgeOpacities[i*2] *= 0.15; edgeOpacities[i*2+1] *= 0.15;
      }
    }
    edgeGeo.getAttribute('aColor').needsUpdate = true;
    edgeGeo.getAttribute('aOpacity').needsUpdate = true;
  }, [bridgePathIngredients, treeFilterIngredients, data]);

  // ---- Toggle handler ----
  const handleToggle = useCallback(() => {
    const next = mode === 'neural' ? 'wheel' : 'neural';
    setMode(next);
    if (stateRef.current) stateRef.current.triggerTransition(next);
  }, [mode, setMode]);

  return (
    <div className="absolute inset-0 pt-10">
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
      {/* Toggle switch — bottom center, z-[60] to stay above MobileTabBar on iOS */}
      <div className="absolute bottom-24 sm:bottom-6 left-1/2 -translate-x-1/2 z-[60] flex items-center gap-3 px-4 py-2 rounded-full bg-[#0a0a12]/90 backdrop-blur-md border border-[#1e1e2e] select-none"
        style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom, 0px))' }}
      >
        <span className={`text-[11px] font-medium transition-colors ${mode === 'neural' ? 'text-cyan-400' : 'text-gray-600'}`}>
          3D Neural
        </span>
        <button
          onClick={handleToggle}
          className="relative w-9 h-5 rounded-full transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-cyan-500/40 flex-shrink-0"
          style={{ backgroundColor: mode === 'wheel' ? '#4f8fff' : '#333344' }}
          title={mode === 'neural' ? 'Switch to Flavor Wheel' : 'Switch to Neural Cloud'}
          role="switch"
          aria-checked={mode === 'wheel'}
        >
          <span
            className="absolute top-[2px] left-[2px] w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-300"
            style={{ transform: mode === 'wheel' ? 'translateX(16px)' : 'translateX(0)' }}
          />
        </button>
        <span className={`text-[11px] font-medium transition-colors ${mode === 'wheel' ? 'text-blue-400' : 'text-gray-600'}`}>
          2D Wheel
        </span>
      </div>
    </div>
  );
}
