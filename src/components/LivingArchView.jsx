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
import { AffinityMode } from '../three/AffinityMode.js';
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
  onDoubleTap,
  onNodeHover,
  highlightPairings = null,
  flyToTarget = null,
  highlightIngredients = null,
  focusedClusterId = null,
  affinityEnabled = true,
  isMobile = false,
}) {
  const containerRef = useRef(null);
  const stateRef = useRef(null); // holds all Three.js state
  const affinityModeRef = useRef(null); // α-mode controller (R13-5)
  const [pcaAxes, setPcaAxes] = useState(null);
  // Use lifted state if provided, otherwise local state
  const [localMode, setLocalMode] = useState('ml');
  const mode = externalMode !== undefined ? externalMode : localMode;
  const setMode = onModeChange || setLocalMode;
  const modeRef = useRef(mode);

  // Keep modeRef in sync for use inside animation loop
  useEffect(() => { modeRef.current = mode; }, [mode]);

  // Refs for callbacks/props consumed inside the scene-setup useEffect
  // closure, which only runs on [data] changes. Without these refs the
  // closure captures stale values (focusedClusterId stays null, cluster
  // focus click-gating fails).
  const onNodeClickRef = useRef(onNodeClick);
  useEffect(() => { onNodeClickRef.current = onNodeClick; }, [onNodeClick]);
  const focusedClusterIdRef = useRef(focusedClusterId);
  useEffect(() => { focusedClusterIdRef.current = focusedClusterId; }, [focusedClusterId]);

  // ---- Build scene ----
  useEffect(() => {
    if (!containerRef.current || !data) return;
    const { graph } = data;
    const nodeArray = Array.from(graph.nodes.values());
    const count = nodeArray.length;
    if (count === 0) return;

    // Five position sets:
    //   posA = ML 3D (Node2Vec + GNN, UMAP) — default "ml" mode
    //   posB = ML 2D (Node2Vec, PCA) — "ml2d" mode
    //   posC = Taste axes 3D (8-channel sphere) — "neural" mode
    //   posD = Taste axes 2D (octagonal wheel) — "taste2d" mode
    const mlPosData = data.positions;
    const mlPos = (mlPosData && mlPosData.positions) ? mlPosData.positions : null;
    const tasteAxisData = computeTastePositions(graph.nodes, graph.edges, 50);
    const tastePos = mlPos || tasteAxisData.positions || {};
    const tasteAxisPos = tasteAxisData.positions || {};
    const pos2D = computeWheelPositions(graph.nodes);
    // PCA 2D positions loaded async below; start with empty
    let pca2dPos = {};

    // Name index map
    const nameIdx = new Map();
    nodeArray.forEach((n, i) => nameIdx.set(n.name, i));

    // Float32Arrays for four position sets
    const posA = new Float32Array(count * 3); // ML 3D
    const posB = new Float32Array(count * 3); // ML 2D (PCA) — Y=0 flat plane
    const posC = new Float32Array(count * 3); // Taste axis 3D
    const posD = new Float32Array(count * 3); // Taste axis 2D (wheel)
    const curPos = new Float32Array(count * 3);

    const posForMode = { ml: posA, ml2d: posB, neural: posC, taste2d: posD };

    for (let i = 0; i < count; i++) {
      const name = nodeArray[i].name;
      const ml = (mlPos && mlPos[name]) || tasteAxisPos[name] || [0, 0, 0];
      const ta = tasteAxisPos[name] || [0, 0, 0];
      const wh = pos2D[name] || [0, 0, 0];
      posA[i*3] = ml[0]; posA[i*3+1] = ml[1]; posA[i*3+2] = ml[2];
      posB[i*3] = 0; posB[i*3+1] = 0; posB[i*3+2] = 0;
      posC[i*3] = ta[0]; posC[i*3+1] = ta[1]; posC[i*3+2] = ta[2];
      posD[i*3] = wh[0]; posD[i*3+1] = wh[1]; posD[i*3+2] = wh[2];
      const start = posForMode[modeRef.current] || posA;
      curPos[i*3] = start[i*3]; curPos[i*3+1] = start[i*3+1]; curPos[i*3+2] = start[i*3+2];
    }

    // Load PCA 2D positions asynchronously
    fetch('/proDataset/pca_positions.json')
      .then(r => r.ok ? r.json() : null)
      .then(raw => {
        if (!raw) return;
        pca2dPos = raw;
        for (let i = 0; i < count; i++) {
          const name = nodeArray[i].name;
          const p = raw[name];
          if (p && Array.isArray(p) && p.length === 2) {
            posB[i*3] = p[0]; posB[i*3+1] = 0; posB[i*3+2] = p[1];
          }
        }
        // Recompute 2D cluster centroids from the freshly-loaded PCA
        // and refresh connector line 2D endpoints. Lines will sit at
        // these positions when mode = ml2d.
        const sum2d = new Map();
        const cnt = new Map();
        for (let i = 0; i < count; i++) {
          const cid = typeof nodeArray[i].clusterId === 'number' ? nodeArray[i].clusterId : -1;
          if (cid < 0) continue;
          const p = raw[nodeArray[i].name];
          if (!p || !Array.isArray(p)) continue;
          if (!sum2d.has(cid)) { sum2d.set(cid, [0,0]); cnt.set(cid, 0); }
          const s2 = sum2d.get(cid);
          s2[0] += p[0]; s2[1] += p[1];
          cnt.set(cid, cnt.get(cid) + 1);
        }
        for (const [cid, s2] of sum2d) {
          const n = cnt.get(cid) || 1;
          centroidByCluster2d.set(cid, [s2[0]/n, s2[1]/n]);
        }
        // Now that we have real 2D centroids, update each label's 2D
        // target to point outward from its cluster. Transition lerp
        // reads userData.centroid_2d.
        if (typeof outwardLabelPos2D === 'function') {
          clusterLabelGroup.children.forEach((sprite) => {
            const cid = sprite.userData?.clusterId;
            const c2 = centroidByCluster2d.get(cid);
            if (!c2) return;
            sprite.userData.centroid_2d = outwardLabelPos2D(c2);
          });
        }
        if (typeof updateClusterConnectors === 'function') updateClusterConnectors();
        // Extract axis labels for the 2D overlay
        if (raw._meta) {
          const a1 = raw._meta.axis1 || {};
          const a2 = raw._meta.axis2 || {};
          setPcaAxes({
            x: { low: (a1.low || []).slice(0, 3).join(', '), high: (a1.high || []).slice(0, 3).join(', ') },
            y: { low: (a2.low || []).slice(0, 3).join(', '), high: (a2.high || []).slice(0, 3).join(', ') },
          });
        }
      })
      .catch(() => {});

    // --- Renderer, Scene, Camera ---
    const el = containerRef.current;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0a0f);

    const camera = new THREE.PerspectiveCamera(60, el.clientWidth/el.clientHeight, 0.1, 2000);
    if (modeRef.current === 'ml2d' || modeRef.current === 'taste2d') {
      camera.position.set(0, modeRef.current === 'taste2d' ? 120 : 100, 0.1);
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
    const defaultColors = [];       // taste-based (used in neural/taste2d)
    const clusterColors = [];       // cluster-id-based (used in ml/ml2d)

    // 10-hue cluster palette — semantically tuned:
    //   0 Fruit&Nut Desserts — pink   5 Cocktails&Drinks — purple
    //   1 Savory American    — orange 6 French&Herbs     — lime
    //   2 Italian            — green  7 Whole Grain      — amber
    //   3 Mexican & Latin    — red    8 Choc & Vanilla   — brown
    //   4 East Asian         — gold   9 Kitchen Staples  — slate
    const CLUSTER_HEX = ['#f472b6', '#ea580c', '#22c55e', '#dc2626', '#facc15',
                         '#a855f7', '#84cc16', '#b45309', '#78350f', '#64748b'];
    const fallbackHex = '#808080';
    const clusterColorByID = CLUSTER_HEX.map(h => new THREE.Color(h));

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
      const cid = typeof node.clusterId === 'number' ? node.clusterId : -1;
      clusterColors.push(
        cid >= 0 && cid < clusterColorByID.length
          ? clusterColorByID[cid].clone()
          : new THREE.Color(fallbackHex),
      );
      // Initial color set by mode — Network modes use cluster, taste modes use taste.
      const initColor = (modeRef.current === 'ml' || modeRef.current === 'ml2d')
        ? clusterColors[i]
        : c;
      mesh.setColorAt(i, initColor);
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

    // tasteSelection is created later — updateEdgePositions references it via closure
    let tasteSelectionRef = null;

    function updateEdgePositions() {
      const yOffsets = tasteSelectionRef ? tasteSelectionRef.yCurrentOffsets : null;
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
        const yOff1 = tasteSelectionRef ? (tasteSelectionRef.yCurrentOffsets[pd.si] || 0) : 0;
        const yOff2 = tasteSelectionRef ? (tasteSelectionRef.yCurrentOffsets[pd.ti] || 0) : 0;
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

    // --- Per-cluster centroid from actual (blended) node positions.
    // Computed BEFORE label setup so labels can be placed radially outward
    // from each cluster's centroid. Used again by connector lines below.
    const centroidByCluster3d = new Map();
    const centroidByCluster2d = new Map();
    {
      const sum3d = new Map();
      const cnt = new Map();
      for (let i = 0; i < nodeArray.length; i++) {
        const cid = typeof nodeArray[i].clusterId === 'number' ? nodeArray[i].clusterId : -1;
        if (cid < 0) continue;
        if (!sum3d.has(cid)) { sum3d.set(cid, [0,0,0]); cnt.set(cid, 0); }
        const s3 = sum3d.get(cid);
        s3[0] += posA[i*3]; s3[1] += posA[i*3+1]; s3[2] += posA[i*3+2];
        cnt.set(cid, cnt.get(cid) + 1);
      }
      for (const [cid, s3] of sum3d) {
        const n = cnt.get(cid) || 1;
        centroidByCluster3d.set(cid, [s3[0]/n, s3[1]/n, s3[2]/n]);
        centroidByCluster2d.set(cid, [0, 0]); // populated by async PCA fetch
      }
    }

    // Project each centroid onto a label-radius sphere (outward). The
    // resulting label position lies along the ray from origin → centroid,
    // past the centroid, so the connector line points OUTWARD from the
    // cluster center rather than arbitrary anchor-ingredient angles.
    const LABEL_R_3D = 62;
    const LABEL_R_2D = 68;
    function outwardLabelPos3D(c3) {
      const mag = Math.hypot(c3[0], c3[1], c3[2]) || 1e-3;
      return [c3[0] / mag * LABEL_R_3D, c3[1] / mag * LABEL_R_3D, c3[2] / mag * LABEL_R_3D];
    }
    function outwardLabelPos2D(c2) {
      const mag = Math.hypot(c2[0], c2[1]) || 1e-3;
      return [c2[0] / mag * LABEL_R_2D, c2[1] / mag * LABEL_R_2D];
    }

    // --- Cluster labels for ML views ---
    const CLUSTER_LABEL_HEX = ['#f472b6', '#ea580c', '#22c55e', '#dc2626', '#facc15',
                               '#a855f7', '#84cc16', '#b45309', '#78350f', '#64748b'];
    const clusterLabelGroup = new THREE.Group();
    const clusterData = data.clusterLabels;
    if (clusterData?.clusters) {
      for (const cl of clusterData.clusters) {
        const hex = CLUSTER_LABEL_HEX[cl.id] || '#aaaaaa';
        const sprite = makeLabel(cl.label.toUpperCase(), hex, 22);
        const c3 = centroidByCluster3d.get(cl.id);
        const p3 = c3 ? outwardLabelPos3D(c3) : [0, 0, 0];
        const p2Init = [0, 0]; // real 2D position lands when PCA fetch resolves
        sprite.position.set(p3[0], p3[1], p3[2]);
        sprite.userData = {
          clusterId: cl.id,
          // "centroid_3d" / "centroid_2d" are the label-position targets
          // consumed by the transition lerp. Historical names; these are
          // the outward-projected label anchors, not raw centroids.
          centroid_3d: [p3[0], p3[1], p3[2]],
          centroid_2d: p2Init,
        };
        sprite.material.opacity = 0.95;
        sprite.material.depthTest = false;
        sprite.material.depthWrite = false;
        sprite.renderOrder = 999;
        clusterLabelGroup.add(sprite);
      }
    }
    clusterLabelGroup.visible = modeRef.current === 'ml' || modeRef.current === 'ml2d';
    scene.add(clusterLabelGroup);

    // --- Connector lines from each cluster label to its actual cluster
    // centroid. Label sits at r=62 outward, centroid at r~30 → line always
    // points radially inward from label to cluster center.
    const clusterConnectorGroup = new THREE.Group();
    if (clusterData?.clusters) {
      clusterLabelGroup.children.forEach((sprite) => {
        const cid = sprite.userData.clusterId;
        const c3 = centroidByCluster3d.get(cid);
        if (!c3) return;
        const geom = new THREE.BufferGeometry();
        geom.setAttribute('position', new THREE.BufferAttribute(
          new Float32Array([
            sprite.position.x, sprite.position.y, sprite.position.z,
            c3[0], c3[1], c3[2],
          ]), 3));
        const lineColor = (sprite.material.color && sprite.material.color.clone())
          || new THREE.Color('#888888');
        const line = new THREE.Line(geom, new THREE.LineBasicMaterial({
          color: lineColor, transparent: true, opacity: 0.55,
        }));
        line.userData = { clusterId: cid };
        line.renderOrder = 998;
        clusterConnectorGroup.add(line);
      });
    }
    clusterConnectorGroup.visible = clusterLabelGroup.visible;
    scene.add(clusterConnectorGroup);

    // Recompute each connector line's endpoints: anchor end = sprite
    // position, centroid end = actual cluster centroid in the current
    // mode's position space. Callable at init, on async PCA load, on
    // mode change, and each transition frame.
    function updateClusterConnectors() {
      const modeIs3D = modeRef.current === 'ml';
      clusterConnectorGroup.children.forEach((line) => {
        const cid = line.userData.clusterId;
        const sprite = clusterLabelGroup.children.find(s => s.userData.clusterId === cid);
        if (!sprite) return;
        const c3 = centroidByCluster3d.get(cid) || [0,0,0];
        const c2 = centroidByCluster2d.get(cid) || [0,0];
        // In 3D mode: use gnn_positions centroid. In 2D mode: use pca
        // centroid (X,0,Z plane — matches posB layout).
        const ex = modeIs3D ? c3[0] : c2[0];
        const ey = modeIs3D ? c3[1] : 0;
        const ez = modeIs3D ? c3[2] : c2[1];
        const attr = line.geometry.getAttribute('position');
        attr.array[0] = sprite.position.x;
        attr.array[1] = sprite.position.y;
        attr.array[2] = sprite.position.z;
        attr.array[3] = ex;
        attr.array[4] = ey;
        attr.array[5] = ez;
        attr.needsUpdate = true;
      });
    }
    updateClusterConnectors();

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
    // Show taste labels in taste modes, hide in ML modes
    labelGroup.visible = modeRef.current === 'neural' || modeRef.current === 'taste2d';
    scene.add(labelGroup);

    // --- Octagonal sector lines + concentric rings for wheel mode ---
    const sectorGroup = new THREE.Group();
    sectorGroup.visible = modeRef.current === 'taste2d';
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
    tasteSelectionRef = tasteSelection;

    /** Compute which ingredients match a taste */
    function getIndicesForTaste(taste) {
      return _getIndicesForTaste(taste, nodeArray);
    }

    /** Build pop-out edge geometry for selected taste groups */
    function buildPopoutEdges() {
      // Disabled: taste label clicks only translate ingredients, no edge rendering.
      // _buildPopoutEdges(tasteSelection, validEdges, curPos, popEdgeGeo, popEdgeMesh, POPOUT_EDGE_OPACITY, MAX_POPOUT_EDGES);
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
        // Gate clicks by the current cluster focus (read via ref so we
        // always see the latest value — the scene-setup useEffect runs
        // only on [data] change). Nodes outside the focused cluster
        // are silently ignored; empty clicks propagate (App.jsx exits
        // focus on null).
        onNodeClick: (node) => {
          const focused = focusedClusterIdRef.current;
          if (focused != null && node && node.clusterId !== focused) return;
          onNodeClickRef.current?.(node);
        },
        mode: modeRef.current,
        handleTasteClick,
        tasteSelection,
      });
    }
    renderer.domElement.addEventListener('click', onClick);
    // Double-tap detection for clearing filters, plus long-press tooltip
    // (R7-40): hold finger ≥ 500ms with < 10px drift to surface the
    // ingredient name without selecting it. Selection still requires a
    // tap; if a long-press fires, the subsequent click is suppressed.
    let lastTap = 0;
    let pressTimer = null;
    let pressStart = null;
    let suppressNextClick = false;
    const PRESS_HOLD_MS = 500;
    const PRESS_DRIFT_PX = 10;

    function clearPress() {
      if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; }
      pressStart = null;
    }

    function fireHoverFromTouch(touch) {
      if (!onNodeHover) return;
      // Reuse the mouse-move ray path by faking an event with clientX/Y.
      const fake = { clientX: touch.clientX, clientY: touch.clientY };
      handleSceneMove(fake, camera, renderer, tasteLabelSprites, mesh, raycaster, hoverState, {
        mode: modeRef.current,
        onNodeHover: (instanceId, mousePos) => {
          const node = instanceId !== null ? nodeArray[instanceId] : null;
          onNodeHover(node, mousePos);
        },
      });
    }

    function onTouchStart(event) {
      const t = event.touches[0];
      if (!t) return;
      pressStart = { x: t.clientX, y: t.clientY, t: performance.now() };
      clearTimeout(pressTimer);
      pressTimer = setTimeout(() => {
        if (!pressStart) return;
        suppressNextClick = true;
        fireHoverFromTouch({ clientX: pressStart.x, clientY: pressStart.y });
      }, PRESS_HOLD_MS);
    }
    function onTouchMove(event) {
      if (!pressStart) return;
      const t = event.touches[0];
      if (!t) return;
      if (Math.hypot(t.clientX - pressStart.x, t.clientY - pressStart.y) > PRESS_DRIFT_PX) {
        clearPress();
      }
    }
    function onTouchEnd() {
      const now = Date.now();
      if (now - lastTap < 400 && onDoubleTap) onDoubleTap();
      lastTap = now;
      clearPress();
      // If a long-press surfaced a tooltip, dismiss it on lift.
      if (suppressNextClick && onNodeHover) onNodeHover(null, null);
    }
    function onClickGuard(event) {
      if (suppressNextClick) {
        event.stopPropagation();
        event.preventDefault();
        suppressNextClick = false;
        return;
      }
      onClick(event);
    }
    renderer.domElement.addEventListener('touchstart', onTouchStart, { passive: true });
    renderer.domElement.addEventListener('touchmove', onTouchMove, { passive: true });
    renderer.domElement.addEventListener('touchend', onTouchEnd);
    // Replace the plain click listener with the guarded one so a
    // long-press doesn't also fire a selection click on lift.
    renderer.domElement.removeEventListener('click', onClick);
    renderer.domElement.addEventListener('click', onClickGuard);
    renderer.domElement.style.cursor = 'default';

    function onMove(event) {
      handleSceneMove(event, camera, renderer, tasteLabelSprites, mesh, raycaster, hoverState, {
        mode: modeRef.current,
        onNodeHover: onNodeHover ? (instanceId, mousePos) => {
          const node = instanceId !== null ? nodeArray[instanceId] : null;
          onNodeHover(node, mousePos);
        } : undefined,
      });
    }
    renderer.domElement.addEventListener('mousemove', onMove);

    // --- Transition state ---
    const transition = { active: false, startTime: 0, fromMode: 'ml', toMode: 'neural' };

    // Camera targets per mode
    const camTargets = {
      ml:      { pos: [0, 40, 120], lookAt: [0, 0, 0] },
      ml2d:    { pos: [0, 100, 0.1], lookAt: [0, 0, 0] },
      neural:  { pos: [0, 40, 120], lookAt: [0, 0, 0] },
      taste2d: { pos: [0, 120, 0.1], lookAt: [0, 0, 0] },
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

      const srcPos = posForMode[transition.fromMode] || posA;
      const dstPos = posForMode[transition.toMode] || posA;

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

      // R7-41: keep selected-node labels glued to their nodes through
      // the mode transition. Each label sprite carries `userData.nodeIdx`
      // (set when the labels effect builds the group) so we can read
      // the current per-frame interpolated position out of curPos.
      const nodeLabelGroup = stateRef.current?._nodeLabelGroup;
      if (nodeLabelGroup) {
        nodeLabelGroup.children.forEach((sprite) => {
          const idx = sprite.userData?.nodeIdx;
          if (idx == null) return;
          sprite.position.set(curPos[idx*3], curPos[idx*3+1] + 2.5, curPos[idx*3+2]);
        });
      }

      // Update edge positions
      updateEdgePositions();
      edgeGeo.getAttribute('position').array.set(edgeVerts);
      edgeGeo.getAttribute('position').needsUpdate = true;
      edgeGeo.getAttribute('aColor').needsUpdate = true;
      edgeGeo.getAttribute('aOpacity').needsUpdate = true;

      // Lerp taste region labels between 3D axis positions and 2D wheel positions
      const sA = (Math.PI * 2) / TASTE_ORDER.length;
      labelGroup.children.forEach((sprite, idx) => {
        const a3 = sprite.userData.axis3D;
        const angle = idx * sA - Math.PI / 2;
        const w2 = [Math.cos(angle) * 55, 2, Math.sin(angle) * 55];
        // Show/hide taste labels — visible in taste modes
        const toTaste = transition.toMode === 'neural' || transition.toMode === 'taste2d';
        const fromTaste = transition.fromMode === 'neural' || transition.fromMode === 'taste2d';
        if (toTaste && !fromTaste) {
          labelGroup.visible = et > 0.3;
        } else if (fromTaste && !toTaste) {
          labelGroup.visible = et < 0.7;
        } else {
          labelGroup.visible = toTaste;
        }
        // Show/hide cluster labels — visible in ML modes
        const toML = transition.toMode === 'ml' || transition.toMode === 'ml2d';
        const fromML = transition.fromMode === 'ml' || transition.fromMode === 'ml2d';
        if (toML && !fromML) {
          clusterLabelGroup.visible = et > 0.3;
        } else if (fromML && !toML) {
          clusterLabelGroup.visible = et < 0.7;
        } else {
          clusterLabelGroup.visible = toML;
        }
        clusterConnectorGroup.visible = clusterLabelGroup.visible;
        // Lerp cluster label positions between 3D and 2D centroids
        if (clusterLabelGroup.visible) {
          clusterLabelGroup.children.forEach((sprite) => {
            const c3 = sprite.userData.centroid_3d;
            const c2 = sprite.userData.centroid_2d;
            const from3d = transition.fromMode === 'ml';
            const to3d = transition.toMode === 'ml';
            const srcY = from3d ? c3[1] + 4 : 2;
            const dstY = to3d ? c3[1] + 4 : 2;
            const srcX = from3d ? c3[0] : (c2[0] || 0);
            const dstX = to3d ? c3[0] : (c2[0] || 0);
            const srcZ = from3d ? c3[2] : (c2[1] || 0);
            const dstZ = to3d ? c3[2] : (c2[1] || 0);
            sprite.position.set(
              srcX + (dstX - srcX) * et,
              srcY + (dstY - srcY) * et,
              srcZ + (dstZ - srcZ) * et,
            );
          });
          updateClusterConnectors();
        }
        // For ml↔neural transitions, labels stay at 3D axis positions.
        // For transitions involving wheel, lerp to/from wheel positions.
        // Lerp labels between 3D axis and 2D wheel positions for taste modes
        const srcLabel = (transition.fromMode === 'taste2d') ? w2 : a3;
        const dstLabel = (transition.toMode === 'taste2d') ? w2 : a3;
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

      // Sector lines for taste2d mode
      const toTaste2d = transition.toMode === 'taste2d';
      const fromTaste2d = transition.fromMode === 'taste2d';
      if (toTaste2d) {
        sectorGroup.visible = et > 0.3;
        lineMat.opacity = Math.max(0, (et - 0.3) / 0.7) * 0.4;
      } else if (fromTaste2d) {
        sectorGroup.visible = et < 0.7;
        lineMat.opacity = 0.4 * (1 - et);
      } else {
        sectorGroup.visible = false;
        lineMat.opacity = 0;
      }

      if (t >= 1) {
        transition.active = false;
        // Reset controls target
        controls.target.set(camEnd.lookAt[0], camEnd.lookAt[1], camEnd.lookAt[2]);
        controls.update();
        sectorGroup.visible = transition.toMode === 'taste2d';
        labelGroup.visible = transition.toMode === 'neural' || transition.toMode === 'taste2d';
        clusterLabelGroup.visible = transition.toMode === 'ml' || transition.toMode === 'ml2d';
        clusterConnectorGroup.visible = clusterLabelGroup.visible;
        if (clusterConnectorGroup.visible) updateClusterConnectors();
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

    let lastFrameTime = performance.now();
    function animate() {
      if (!running) return;
      requestAnimationFrame(animate);

      const now = performance.now();
      const deltaSec = Math.min(0.1, (now - lastFrameTime) / 1000);
      lastFrameTime = now;

      updateModeTransition();
      updateTasteAnimation();
      updateParticles();
      // R13-5: AffinityMode per-frame tick (currently a no-op
      // placeholder; reserved for future fade animations).
      affinityModeRef.current?.tickAnimation(deltaSec);
      controls.update();
      composer.render();
    }
    animate();

    // --- Expose trigger function ---
    const triggerTransition = (toMode) => {
      if (transition.active) return;
      const fromMode = modeRef.current;
      if (fromMode === toMode) return;
      camStart = { pos: [camera.position.x, camera.position.y, camera.position.z], lookAt: [0,0,0] };
      transition.active = true;
      transition.startTime = performance.now();
      transition.fromMode = fromMode;
      transition.toMode = toMode;
    };

    // Camera fly-to a label position with optional cluster centroid.
    // The label sits at radius ~62 outward from origin; the cluster centroid
    // sits much closer (radius ~5–25). To get "label in front, cluster behind",
    // the camera must land BEYOND the label along the (centroid → label) ray
    // and orbit-focus on the centroid (not the label) so subsequent user
    // rotation pivots around the cluster.
    //
    // labelPos: [x,y,z] of the label (where the user clicked)
    // centroidPos: [x,y,z] of the cluster centroid; if null, falls back to
    //              outward-from-origin direction (legacy behavior).
    const flyToPoint = (labelPos, centroidPos = null) => {
      if (!labelPos) return;
      const labelVec = new THREE.Vector3(labelPos[0], labelPos[1], labelPos[2]);
      const centroidVec = centroidPos
        ? new THREE.Vector3(centroidPos[0], centroidPos[1], centroidPos[2])
        : null;
      const is2D = modeRef.current === 'ml2d' || modeRef.current === 'taste2d';
      // Camera-to-label distance. Was 70 — too far in 3D: the label sprite
      // (world-scale ~22 wide) shrinks and gets washed out by the cluster's
      // bloom glow behind it. 30 gives the label real visual weight in the
      // foreground while keeping the whole cluster body visible behind.
      const distance = is2D ? 70 : 30;
      let camEnd;
      let lookAt;
      if (is2D) {
        // Top-down: camera stays above the label, looking straight down.
        // No "behind" in 2D, so center the view on the label itself.
        camEnd = new THREE.Vector3(labelVec.x, 100, labelVec.z + 0.1);
        lookAt = labelVec.clone();
      } else {
        // 3D: outward = direction from cluster centroid toward the label.
        // This is the side of the cluster the user is "looking from".
        // Camera lands `distance` further along that ray, past the label,
        // so the label sits between the camera and the cluster body.
        let outward;
        if (centroidVec) {
          outward = labelVec.clone().sub(centroidVec);
          if (outward.length() < 0.01) outward = labelVec.clone();
        } else {
          outward = labelVec.clone();
        }
        const len = outward.length();
        if (len < 0.01) {
          // Degenerate: label and centroid coincide and both at origin.
          // Use current camera-to-target direction as a last resort.
          const currentDir = camera.position.clone().sub(controls.target).normalize();
          camEnd = labelVec.clone().add(currentDir.multiplyScalar(distance));
        } else {
          outward.divideScalar(len);
          camEnd = labelVec.clone().add(outward.multiplyScalar(distance));
        }
        // Orbit pivot is the cluster centroid so the user rotates around the
        // cluster, not the label sprite. Falls back to label if no centroid.
        lookAt = centroidVec ? centroidVec.clone() : labelVec.clone();
      }

      const startPos = camera.position.clone();
      const startTarget = controls.target.clone();
      const t0 = performance.now();
      const DURATION = 900;
      function tween() {
        const dt = Math.min(1, (performance.now() - t0) / DURATION);
        const e = dt < 0.5 ? 4 * dt ** 3 : 1 - Math.pow(-2 * dt + 2, 3) / 2;
        camera.position.lerpVectors(startPos, camEnd, e);
        controls.target.lerpVectors(startTarget, lookAt, e);
        controls.update();
        if (dt < 1 && stateRef.current) requestAnimationFrame(tween);
      }
      tween();
    };

    stateRef.current = {
      scene, camera, renderer, composer, controls, mesh, edgeMesh, edgeMat, edgeGeo,
      edgeColors, edgeOpacities, validEdges,
      particleMesh, particleMat,
      nodeArray, nameIdx, defaultColors, clusterColors, curPos, posA, posB, posC, posD, posForMode,
      triggerTransition, flyToPoint, labelGroup, clusterLabelGroup, clusterConnectorGroup, sectorGroup, tasteSelection,
      updateEdgePositions, tastePos,
      // Expose runtime cluster centroids (3D from posA, 2D from PCA) so the
      // fly-to useEffect can orbit-center on a cluster's actual centroid
      // rather than the outward label anchor.
      centroidByCluster3d, centroidByCluster2d,
      // R13-5: AffinityMode reads `mode` to pick the right palette
      // (clusterColors in ml/ml2d, defaultColors otherwise) on exit.
      // Read live via getter so a mode switch propagates without
      // rebuilding stateRef.
      get mode() { return modeRef.current; },
    };

    // R13-5: Instantiate AffinityMode controller after stateRef is
    // built. Lifecycle bound to the scene's useEffect — disposed in
    // cleanup below before existing teardown so GPU resources don't
    // outlive the scene.
    if (data.pairingStrength && data.top5 && data.bridgeCompoundIndex && data.affinityThresholds) {
      affinityModeRef.current = new AffinityMode(stateRef.current, {
        pairingStrength: data.pairingStrength,
        top5: data.top5,
        bridgeCompoundIndex: data.bridgeCompoundIndex,
        affinityThresholds: data.affinityThresholds,
        graph: data.graph,
      });
    }

    return () => {
      running = false;
      // R13-5: Dispose AffinityMode FIRST so its GPU resources are
      // released before the scene/renderer teardown.
      if (affinityModeRef.current) {
        affinityModeRef.current.dispose();
        affinityModeRef.current = null;
      }
      window.removeEventListener('resize', onResize);
      renderer.domElement.removeEventListener('click', onClickGuard);
      renderer.domElement.removeEventListener('touchstart', onTouchStart);
      renderer.domElement.removeEventListener('touchmove', onTouchMove);
      renderer.domElement.removeEventListener('touchend', onTouchEnd);
      renderer.domElement.removeEventListener('mousemove', onMove);
      clearPress();
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
    // R13-5 engage-guard: AffinityMode owns mesh.instanceColor while
    // engaged; this effect would clobber the dim writes. Early-return
    // when engaged. AffinityMode.exit() re-stamps default colors
    // explicitly because this effect's deps don't include `engaged`
    // (it's a ref, not React state) and won't re-fire on exit.
    if (affinityModeRef.current?.engaged) return;
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

  // ---- Per-node name labels for selected + highlighted pairings ----
  // R7-41: labels persist across all selectedNodes (the Set below
  // unions every selection, so adding a 2nd / 3rd ingredient does NOT
  // remove the earlier labels). Label positions read from
  // posForMode[mode] — the live mode-specific buffer — so a mode swap
  // (ml ↔ ml2d ↔ neural ↔ taste2d) re-anchors labels to where the
  // nodes actually are, not where they used to be in ML mode.
  useEffect(() => {
    const st = stateRef.current;
    if (!st) return;
    const { scene, posForMode, nameIdx } = st;

    // Remove previous node labels
    if (st._nodeLabelGroup) {
      scene.remove(st._nodeLabelGroup);
      st._nodeLabelGroup.children.forEach(s => { s.material.map?.dispose(); s.material.dispose(); });
      st._nodeLabelGroup = null;
    }

    // Engage-guard: AffinityMode owns labels for focal + 30 affinities while
    // engaged. Letting this effect also draw labels for selectedNodes /
    // highlightPairings produces duplicate sprites at slightly different
    // positions (mode-buffer vs. ring positions), which the user reads as
    // "highlighted ingredients on a different plane."
    if (affinityModeRef.current?.engaged) return;

    const labelNames = new Set([
      ...(selectedNodes.length > 0 ? selectedNodes : (selectedNode ? [selectedNode] : [])),
      ...(highlightPairings || []),
    ]);
    if (labelNames.size === 0) return;

    const positions = posForMode?.[mode] || st.curPos;
    if (!positions) return;

    const group = new THREE.Group();
    for (const name of labelNames) {
      const idx = nameIdx.get(name);
      if (idx == null) continue;
      const x = positions[idx * 3];
      const y = positions[idx * 3 + 1];
      const z = positions[idx * 3 + 2];
      if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) continue;
      const sprite = makeLabel(name, '#ffffff', 14);
      sprite.position.set(x, y + 2.5, z);
      sprite.scale.set(12, 3, 1);
      sprite.material.opacity = 0.85;
      sprite.userData = { nodeIdx: idx };
      group.add(sprite);
    }
    scene.add(group);
    st._nodeLabelGroup = group;
  }, [selectedNode, selectedNodes, highlightPairings, mode, data]);

  // ClusterJoystick fly-to. Each time flyToTarget changes, animate the
  // camera. When a clusterId is provided, resolve the LIVE label sprite
  // position (clusterLabelGroup) and the runtime cluster centroid — the
  // static label_anchor_3d in cluster_labels.json is computed from
  // pre-blend centroids and does not match where the label actually
  // renders after gnn_positions cluster blending.
  //
  // R13-5: If α-mode engaged when user taps a cluster pill, exit
  // α-mode first so the pill's fly-to wins (existing behavior).
  useEffect(() => {
    if (flyToTarget && affinityModeRef.current?.engaged) {
      affinityModeRef.current.exit({ immediate: true });
    }
  }, [flyToTarget]);

  useEffect(() => {
    const st = stateRef.current;
    if (!st || !flyToTarget) return;
    if (Array.isArray(flyToTarget)) {
      st.flyToPoint?.(flyToTarget);
      return;
    }
    let labelPos = flyToTarget.position;
    let centroid = null;
    if (typeof flyToTarget.clusterId === 'number') {
      const cid = flyToTarget.clusterId;
      const is2D = modeRef.current === 'ml2d' || modeRef.current === 'taste2d';
      const sprite = st.clusterLabelGroup?.children?.find(s => s.userData?.clusterId === cid);
      if (sprite) {
        // In 2D mode the sprite's userData carries the [x, z] target the
        // mode-transition lerp settles on; in 3D the sprite.position is
        // the live render position. Use whichever matches the current mode.
        if (is2D) {
          const c2 = sprite.userData?.centroid_2d;
          if (Array.isArray(c2) && c2.length === 2) labelPos = [c2[0], 0, c2[1]];
          else labelPos = [sprite.position.x, 0, sprite.position.z];
        } else {
          labelPos = [sprite.position.x, sprite.position.y, sprite.position.z];
        }
      }
      const c = is2D
        ? st.centroidByCluster2d?.get(cid)
        : st.centroidByCluster3d?.get(cid);
      if (c) centroid = is2D ? [c[0], 0, c[1]] : c;
    }
    // Taste-mode pills (sweet/sour/...): same shape, but the live label
    // sprite lives in labelGroup (keyed by userData.taste) and the
    // "centroid" is the average position of nodes scoring that taste in
    // posC (the taste-axis-3D position set).
    if (typeof flyToTarget.taste === 'string') {
      const taste = flyToTarget.taste;
      const sprite = st.labelGroup?.children?.find(s => s.userData?.taste === taste);
      if (sprite) {
        labelPos = [sprite.position.x, sprite.position.y, sprite.position.z];
      }
      const { nodeArray, posC } = st;
      if (nodeArray && posC) {
        let sx = 0, sy = 0, sz = 0, n = 0;
        for (let i = 0; i < nodeArray.length; i++) {
          if (!ingredientHasTaste(nodeArray[i].name, nodeArray[i], taste)) continue;
          sx += posC[i*3]; sy += posC[i*3+1]; sz += posC[i*3+2];
          n++;
        }
        if (n > 0) centroid = [sx/n, sy/n, sz/n];
      }
    }
    if (!labelPos) return;
    st.flyToPoint?.(labelPos, centroid);
  }, [flyToTarget]);

  // Cluster highlight labels — spawn ingredient-name sprites at the
  // top-N member positions (in the current mode's position set) so
  // the user can see "what's in this cluster" after flying to it.
  // Auto-clears after 8s.
  useEffect(() => {
    const st = stateRef.current;
    if (!st) return;
    // Clear any existing highlight group
    if (st._clusterHighlightGroup) {
      st.scene.remove(st._clusterHighlightGroup);
      st._clusterHighlightGroup.children.forEach(s => {
        s.material.map?.dispose();
        s.material.dispose();
      });
      st._clusterHighlightGroup = null;
    }
    if (!highlightIngredients || highlightIngredients.length === 0) return;
    const { scene, nameIdx, posForMode } = st;
    const posSet = posForMode[modeRef.current] || posForMode.ml;
    const group = new THREE.Group();
    for (const name of highlightIngredients) {
      const idx = nameIdx.get(name);
      if (idx === undefined) continue;
      // Ingredient name labels are small body text on top of bright
      // ingredient spheres + bloom pass. Skip glow and use a calmer
      // off-white so the text doesn't blow out in the bloom.
      const sprite = makeLabel(name, '#d4d8e0', 14, { glow: false });
      sprite.position.set(posSet[idx * 3], posSet[idx * 3 + 1] + 3.5, posSet[idx * 3 + 2]);
      sprite.material.opacity = 0.85;
      group.add(sprite);
    }
    scene.add(group);
    st._clusterHighlightGroup = group;
    const timeout = setTimeout(() => {
      const cur = stateRef.current;
      if (!cur) return;
      if (cur._clusterHighlightGroup === group) {
        cur.scene.remove(group);
        group.children.forEach(s => {
          s.material.map?.dispose();
          s.material.dispose();
        });
        cur._clusterHighlightGroup = null;
      }
    }, 8000);
    return () => clearTimeout(timeout);
  }, [highlightIngredients]);

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
    if (affinityModeRef.current?.engaged) return; // R13-5 engage-guard
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
    if (affinityModeRef.current?.engaged) return; // R13-5 engage-guard
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
    if (affinityModeRef.current?.engaged) return; // R13-5 engage-guard
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

  // ---- Node coloring per mode: clusters in ml/ml2d, tastes in neural/taste2d.
  // Runs on mode change, but skips if a selection/highlight is active so we
  // don't stomp those brighter colors. Selection effect will restore from
  // defaultColors when cleared; we update defaultColors in-place so the
  // restore path picks up the current palette.
  useEffect(() => {
    const st = stateRef.current;
    if (!st || !st.mesh || !st.defaultColors || !st.clusterColors) return;
    if (affinityModeRef.current?.engaged) return; // R13-5 engage-guard
    const { mesh, defaultColors, clusterColors, nodeArray } = st;
    const source = (mode === 'ml' || mode === 'ml2d') ? clusterColors : defaultColors;
    // Always re-stamp on mode change. Previous guard left taste-selection
    // artifacts visible when user switched Network ↔ Taste mode, which
    // showed up as "clusters with multiple different colors."
    for (let i = 0; i < nodeArray.length; i++) {
      // Mirror the active palette into defaultColors so selection-clear
      // paths read the right source. For neural/taste2d we already have
      // taste colors in defaultColors; for ml/ml2d we copy cluster
      // colors over so restoration from selection matches current mode.
      defaultColors[i].copy(source[i]);
      mesh.setColorAt(i, source[i]);
    }
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [mode]);

  // ---- Cluster focus mode: dim every node OUTSIDE the focused cluster
  // to 12% intensity and boost focused nodes to 150% (bloom post-process
  // amplifies this into a visible glow). Also dim non-focused cluster
  // labels to 25% opacity so the visual hierarchy matches.
  useEffect(() => {
    const st = stateRef.current;
    if (!st || !st.mesh || !st.clusterColors || !st.defaultColors) return;
    if (affinityModeRef.current?.engaged) return; // R13-5 engage-guard
    const { mesh, clusterColors, defaultColors, nodeArray, clusterLabelGroup } = st;
    const inClusterMode = mode === 'ml' || mode === 'ml2d';
    const source = inClusterMode ? clusterColors : defaultColors;
    const DIM = 0.12;
    const GLOW = 1.5;
    const tmp = new THREE.Color();
    for (let i = 0; i < nodeArray.length; i++) {
      const match = nodeArray[i].clusterId === focusedClusterId;
      if (focusedClusterId == null) {
        mesh.setColorAt(i, source[i]);
      } else if (match) {
        tmp.copy(source[i]).multiplyScalar(GLOW);
        mesh.setColorAt(i, tmp);
      } else {
        tmp.copy(source[i]).multiplyScalar(DIM);
        mesh.setColorAt(i, tmp);
      }
    }
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    // Label + connector opacity
    if (clusterLabelGroup) {
      clusterLabelGroup.children.forEach((sprite) => {
        const cid = sprite.userData?.clusterId;
        const isFocused = focusedClusterId == null || cid === focusedClusterId;
        sprite.material.opacity = isFocused ? 0.95 : 0.22;
      });
    }
    if (st.clusterConnectorGroup) {
      st.clusterConnectorGroup.children.forEach((line) => {
        const cid = line.userData?.clusterId;
        const isFocused = focusedClusterId == null || cid === focusedClusterId;
        line.material.opacity = isFocused ? 0.55 : 0.1;
      });
    }
  }, [focusedClusterId, mode]);

  // ---- R13-5: AffinityMode selection driver ----
  // Watches selectedNodes + isMobile + affinityEnabled and dispatches
  // engage / pivot / suspend / exit on the AffinityMode controller.
  // Mobile / kill-switched: never engages — α-mode is desktop-only;
  // β-mode mobile panel ships in R13-9.
  useEffect(() => {
    const ctrl = affinityModeRef.current;
    if (!ctrl) return;
    if (!affinityEnabled || isMobile) {
      // Kill-switch or mobile: ensure controller is never engaged.
      if (ctrl.engaged) ctrl.exit({ immediate: true });
      return;
    }
    if (selectedNodes.length === 0) {
      if (ctrl.engaged) ctrl.exit();
    } else if (selectedNodes.length === 1) {
      const focal = selectedNodes[0];
      if (ctrl.engaged) {
        ctrl.pivot(focal);
      } else {
        ctrl.engage(focal);
      }
    } else {
      // Multi-select: suspend ring visuals; existing common-pairings
      // UX takes over. Resume on collapse back to length 1.
      ctrl.suspend();
    }
  }, [selectedNodes, isMobile, affinityEnabled]);

  // ---- Toggle handler (3-way: ml → neural → wheel → ml) ----
  const MODE_CYCLE = ['ml', 'ml2d', 'neural', 'taste2d'];
  const MODE_LABELS = {
    ml: 'Cooks With · 3D',
    ml2d: 'Cooks With · 2D',
    neural: 'Tastes Like · 3D',
    taste2d: 'Tastes Like · Wheel',
  };
  const handleModeSwitch = useCallback((target) => {
    if (target === mode) return;
    // R13-5: Exit α-mode BEFORE the transition tween starts. Tween
    // writes clusterLabelGroup.visible per-frame and would clobber
    // α-mode's ghost-mode visibility.
    if (affinityModeRef.current?.engaged) {
      affinityModeRef.current.exit({ immediate: true });
    }
    setMode(target);
    if (stateRef.current) stateRef.current.triggerTransition(target);
  }, [mode, setMode]);

  return (
    <div className="absolute inset-0 pt-10">
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />

      {/* PCA axis labels — only meaningful in flat top-down 2D mode.
          Each end shows the 3 most-extreme ingredients on that axis,
          which is the only thing PCA actually optimizes for: directions
          of maximum variance in the Node2Vec recipe-co-occurrence
          embedding. Hidden in 3D / taste modes since the camera is
          orbiting and there's no fixed "left vs right" semantics. */}
      {mode === 'ml2d' && pcaAxes && (
        <div className="pointer-events-none absolute inset-0 z-[55]" aria-hidden="true">
          {/* X axis (low) — left edge, centered vertically */}
          <div className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 max-w-[35%]">
            <p className="text-[9px] uppercase tracking-widest text-cyan-400/70 mb-0.5">← X axis</p>
            <p className="text-xs text-gray-300 leading-tight">{pcaAxes.x.low}</p>
          </div>
          {/* X axis (high) — right edge, centered vertically */}
          <div className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 max-w-[35%] text-right">
            <p className="text-[9px] uppercase tracking-widest text-cyan-400/70 mb-0.5">X axis →</p>
            <p className="text-xs text-gray-300 leading-tight">{pcaAxes.x.high}</p>
          </div>
          {/* Y axis (low) — top, centered horizontally. Y in PCA space
              maps to Z in 3D (camera looks down +Y), so "Y low" sits at
              top of the screen. */}
          <div className="absolute top-12 left-1/2 -translate-x-1/2 max-w-[60%] text-center">
            <p className="text-[9px] uppercase tracking-widest text-cyan-400/70 mb-0.5">↑ Y axis</p>
            <p className="text-xs text-gray-300 leading-tight">{pcaAxes.y.low}</p>
          </div>
          {/* Y axis (high) — bottom, centered. Sits above the mode
              selector, so we offset by enough to clear it on mobile. */}
          <div className="absolute bottom-36 sm:bottom-20 left-1/2 -translate-x-1/2 max-w-[60%] text-center">
            <p className="text-xs text-gray-300 leading-tight">{pcaAxes.y.high}</p>
            <p className="text-[9px] uppercase tracking-widest text-cyan-400/70 mt-0.5">Y axis ↓</p>
          </div>
        </div>
      )}

      {/* 4-way mode selector — bottom center */}
      <div className="absolute bottom-24 sm:bottom-6 left-1/2 -translate-x-1/2 z-[60] flex items-center gap-1 px-2 py-1.5 rounded-full bg-[#0a0a12]/90 backdrop-blur-md border border-[#1e1e2e] select-none"
        style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom, 0px))' }}
      >
        {MODE_CYCLE.map((m) => (
          <button
            key={m}
            onClick={() => handleModeSwitch(m)}
            className={`px-3 py-1.5 min-h-[44px] text-[11px] font-medium rounded-full transition-all ${
              mode === m
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                : 'text-gray-500 hover:text-gray-300 border border-transparent'
            }`}
          >
            {MODE_LABELS[m]}
          </button>
        ))}
      </div>
    </div>
  );
}
