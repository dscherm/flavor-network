import { useRef, useEffect, useCallback, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { computeTastePositions, TASTE_AXES, scoreIngredient } from '../data/tastePositioning.js';
import { getColorForNode } from '../three/NodeMesh.js';
import { createLivingEdgeMaterial, createLivingParticleMaterial } from '../three/ShaderMaterials.js';
import { easeInOutCubic, hashStr, seededRng, makeLabel, computeWheelPositions, ingredientHasTaste } from './livingArchUtils.js';
import { TASTE_ORDER, TASTE_HEX, CATEGORY_RADII, TRANSITION_DURATION, POPOUT_DURATION, POPOUT_HEIGHT } from './livingArchConstants.js';
import { handleSceneClick, handleSceneMove } from './livingArchInteraction.js';
import {
  createTasteSelection,
  getIndicesForTaste as _getIndicesForTaste,
  buildPopoutEdges as _buildPopoutEdges,
  computePairingOffset as _computePairingOffset,
  handleTasteClick as _handleTasteClick,
  clearTasteSelection as _clearTasteSelection,
} from './livingArchTaste.js';

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
  edgeBrightness = 1.0,
  particleBrightness = 1.0,
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
      // Start from the current mode's positions
      const startPos = modeRef.current === 'wheel' ? b : a;
      curPos[i*3] = startPos[0]; curPos[i*3+1] = startPos[1]; curPos[i*3+2] = startPos[2];
    }

    // --- Renderer, Scene, Camera ---
    const el = containerRef.current;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0a0f);

    const camera = new THREE.PerspectiveCamera(60, el.clientWidth/el.clientHeight, 0.1, 2000);
    if (modeRef.current === 'wheel') {
      camera.position.set(0, 120, 0.1);
    } else {
      camera.position.set(0, 40, 120);
    }
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
      const yOffsets = tasteSelection.yCurrentOffsets;
      for (let i = 0; i < validEdges.length; i++) {
        const { si, ti, edge } = validEdges[i];
        const o = i * 6;
        const syOff = yOffsets ? (yOffsets[si] || 0) : 0;
        const tyOff = yOffsets ? (yOffsets[ti] || 0) : 0;
        edgeVerts[o]   = curPos[si*3];   edgeVerts[o+1] = curPos[si*3+1] + syOff; edgeVerts[o+2] = curPos[si*3+2];
        edgeVerts[o+3] = curPos[ti*3];   edgeVerts[o+4] = curPos[ti*3+1] + tyOff; edgeVerts[o+5] = curPos[ti*3+2];
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
        const op = Math.max(0.03, (0.08 + 0.32 * str) * BASE_EDGE_DIM);
        edgeOpacities[i*2] = op; edgeOpacities[i*2+1] = op;
      }
    }
    updateEdgePositions();

    const edgeGeo = new THREE.BufferGeometry();
    edgeGeo.setAttribute('position', new THREE.Float32BufferAttribute(edgeVerts, 3));
    edgeGeo.setAttribute('aColor', new THREE.Float32BufferAttribute(edgeColors, 3));
    edgeGeo.setAttribute('aOpacity', new THREE.Float32BufferAttribute(edgeOpacities, 1));

    const edgeMat = createLivingEdgeMaterial();
    const edgeMesh = new THREE.LineSegments(edgeGeo, edgeMat);
    scene.add(edgeMesh);

    // --- Particles flowing along strong edges ---
    const PARTICLE_THRESHOLD = 0.3;
    const PARTICLES_PER_EDGE = 2;
    const particleData = [];
    const particleColorArr = [];
    const defaultParticleColor = new THREE.Color(0x4f8fff);

    for (const { edge, si, ti } of validEdges) {
      if ((edge.strength || 0) <= PARTICLE_THRESHOLD) continue;
      const col = defaultColors[si] || defaultParticleColor;
      const speed = 0.15 + 0.45 * (edge.strength || 0);
      for (let p = 0; p < PARTICLES_PER_EDGE; p++) {
        particleData.push({ si, ti, progress: p / PARTICLES_PER_EDGE, speed });
        particleColorArr.push(col.r, col.g, col.b);
      }
    }

    const pCount = particleData.length;
    const particlePositions = new Float32Array(pCount * 3);
    const particleOpacities = new Float32Array(pCount);
    const particleColors = new Float32Array(particleColorArr);

    const particleGeo = new THREE.BufferGeometry();
    particleGeo.setAttribute('position', new THREE.Float32BufferAttribute(particlePositions, 3));
    particleGeo.setAttribute('aOpacity', new THREE.Float32BufferAttribute(particleOpacities, 1));
    particleGeo.setAttribute('aColor', new THREE.Float32BufferAttribute(particleColors, 3));

    const particleMat = createLivingParticleMaterial();

    const particleMesh = new THREE.Points(particleGeo, particleMat);
    particleMesh.frustumCulled = false;
    scene.add(particleMesh);

    let lastTime = performance.now();

    function updateParticles() {
      const now = performance.now();
      const dt = (now - lastTime) / 1000;
      lastTime = now;
      const posAttr = particleGeo.getAttribute('position');
      const opAttr = particleGeo.getAttribute('aOpacity');

      for (let i = 0; i < pCount; i++) {
        const pd = particleData[i];
        pd.progress += pd.speed * dt;
        if (pd.progress >= 1) pd.progress -= Math.floor(pd.progress);
        const t = pd.progress;

        // Lerp between source and target using curPos (which animates during transitions)
        const si3 = pd.si * 3, ti3 = pd.ti * 3;
        const yOff1 = tasteSelection.yCurrentOffsets[pd.si] || 0;
        const yOff2 = tasteSelection.yCurrentOffsets[pd.ti] || 0;
        posAttr.array[i*3]   = curPos[si3]   + (curPos[ti3]   - curPos[si3])   * t;
        posAttr.array[i*3+1] = (curPos[si3+1] + yOff1) + ((curPos[ti3+1] + yOff2) - (curPos[si3+1] + yOff1)) * t;
        posAttr.array[i*3+2] = curPos[si3+2] + (curPos[ti3+2] - curPos[si3+2]) * t;

        // Fade near endpoints
        const fade = Math.min(t, 1 - t) * 4;
        opAttr.array[i] = Math.min(fade, 1.0) * 0.7;
      }
      posAttr.needsUpdate = true;
      opAttr.needsUpdate = true;
    }

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
    const popEdgeMat = createLivingEdgeMaterial();
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
    sectorGroup.visible = modeRef.current === 'wheel';
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
    const tasteSelection = createTasteSelection(count);

    /** Compute which ingredients match a taste */
    function getIndicesForTaste(taste) {
      return _getIndicesForTaste(taste, nodeArray);
    }

    /** Build pop-out edge geometry for selected taste groups */
    function buildPopoutEdges() {
      _buildPopoutEdges(tasteSelection, validEdges, curPos, popEdgeGeo, popEdgeMesh, POPOUT_EDGE_OPACITY, MAX_POPOUT_EDGES);
    }

    /** Compute pairing-count-based Y offset for a set of ingredient indices */
    function computePairingOffset(indices, direction) {
      _computePairingOffset(indices, direction, tasteSelection, modeRef, nodeArray);
    }

    /** Start pop-out animation for a taste click */
    function handleTasteClick(taste) {
      _handleTasteClick(taste, tasteSelection, nodeArray, modeRef, validEdges);
    }

    /** Clear taste selection (called when clicking empty space or same taste) */
    function clearTasteSelection() {
      _clearTasteSelection(tasteSelection, count, mesh, defaultColors, popEdgeMesh, popEdgeGeo);
    }

    // --- Raycasting (delegated to livingArchInteraction.js) ---
    const raycaster = new THREE.Raycaster();
    const hoverState = { lastHover: -1, lastHoverType: 'none' };

    function onClick(event) {
      handleSceneClick(event, camera, renderer, tasteLabelSprites, mesh, nodeArray, raycaster, {
        onNodeClick,
        handleTasteClick,
        tasteSelection,
      });
    }
    renderer.domElement.addEventListener('click', onClick);
    renderer.domElement.style.cursor = 'default';

    function onMove(event) {
      handleSceneMove(event, camera, renderer, tasteLabelSprites, mesh, raycaster, hoverState);
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

    function updateModeTransition() {
      if (!transition.active) return;

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

    function updateTasteAnimation() {
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

        // Update main edges to follow node Y offsets
        updateEdgePositions();
        edgeGeo.getAttribute('position').array.set(edgeVerts);
        edgeGeo.getAttribute('position').needsUpdate = true;

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

        // Keep main edges following node Y offsets
        updateEdgePositions();
        edgeGeo.getAttribute('position').array.set(edgeVerts);
        edgeGeo.getAttribute('position').needsUpdate = true;

        // Keep pop-out edges updated with current positions
        buildPopoutEdges();
      }
    }

    function animate() {
      if (!running) return;
      requestAnimationFrame(animate);

      updateModeTransition();
      updateTasteAnimation();
      updateParticles();
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
      scene, camera, renderer, composer, controls, mesh, edgeMesh, edgeMat, edgeGeo,
      edgeColors, edgeOpacities, validEdges,
      particleMesh, particleMat,
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
      particleGeo.dispose();
      particleMat.dispose();
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

  // ---- Visibility & brightness (edges + particles) ----
  useEffect(() => {
    const st = stateRef.current;
    if (!st) return;
    if (st.edgeMesh) st.edgeMesh.visible = showEdges;
    if (st.particleMesh) st.particleMesh.visible = showParticles;
    if (st.edgeMat) st.edgeMat.uniforms.uBrightness.value = edgeBrightness;
    if (st.particleMat) st.particleMat.uniforms.uBrightness.value = particleBrightness;
  }, [showEdges, showParticles, edgeBrightness, particleBrightness]);

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
