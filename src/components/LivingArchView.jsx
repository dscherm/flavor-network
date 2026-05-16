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
import { TASTE_ORDER, TASTE_HEX, CATEGORY_RADII, TRANSITION_DURATION, POPOUT_DURATION, POPOUT_HEIGHT, CAMERA_ANIMATOR_DEFAULT_ON } from './livingArchConstants.js';
import { handleSceneClick, handleSceneMove } from './livingArchInteraction.js';
import { AffinityMode } from '../three/AffinityMode.js';
import { CameraAnimator } from '../three/CameraAnimator.js';
import { computeBloomStrength } from '../three/bloomQuality.js';
import NetworkA11yShim from './NetworkA11yShim.jsx';
import ShapeLegend from './ShapeLegend.jsx';
import { MODE_CYCLE, MODE_LABELS, MODE_IS_2D, MODE_IS_CATEGORICAL, MODE_TO_AXIS } from '../data/networkModes.js';
import { computeCategoricalWheelPositions } from '../data/categoricalWheelPositions.js';
import { computeBucketPoles2D, computeBucketPoles3D } from '../data/bucketPoles.js';
import { computeBucketStats } from '../data/bucketStats.js';
import { rankBridges } from '../data/bridgeRanker.js';
import { CATEGORICAL_AXES, bucketOf } from '../data/categoricalAxes.js';
import { FILTER_TO_AXIS } from '../data/networkModes.js';
import { AFFINITY_SHAPE_LEGEND } from '../data/affinityShapes.js';
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
  // R16 Phase 1 — orthogonal filter stack. When non-empty, hidden
  // nodes (those that don't match every active filter's bucketOf) get
  // their instance matrix scaled to 0. The `mode` prop already carries
  // the effective legacy mode key (e.g., 'aromas2d') so the existing
  // morph + bucket-coloring machinery from commit 8749a3f still drives
  // the layout; this prop just adds AND-intersection on visibility.
  filterStack = [],
  morphAxis = null,
  // R17 — continuous pull strength. When 0, nodes sit at cooccurrence
  // positions (posA for 'ml' / posB for 'ml2d'). When 1, nodes snap
  // to their bucket pole (per the active axis filters). Intermediate
  // values lerp between the two. Defaults to 1.0 so component callers
  // that don't pass it preserve the legacy "wheel-snap when filtered"
  // behavior.
  pullStrength = 1.0,
  // R16 Phase 2 — cocktail / sauce scope sets (Set<string>) loaded by
  // App.jsx via labScope.js. When passed through, bucketOf for the
  // cocktail-scope and sauce-scope filter keys checks set membership
  // instead of returning the Phase 1 no-op sentinel.
  cocktailScope = null,
  sauceScope = null,
  // R16 Phase 4: notify App.jsx when the visible count changes so
  // HUDAnnouncer can surface it to screen readers.
  onVisibleCountChange = null,
  onDoubleTap,
  onNodeHover,
  // R18 — pole-label hover. Fires with { label, memberCount, color, x, y }
  // when the cursor lands on a bucket-pole sprite (or null on leave).
  onPoleHover = null,
  // R19 Phase 3 — bridge-pulse trigger. Fires once when pullStrength
  // crosses 0.5 in either direction (cooccurrence ↔ bucket dominance)
  // with a screen-projected snapshot of the top-20 cross-bucket
  // bridge ingredients of the active morph axis.
  onBridgePulse = null,
  // Track 2 (2026-05-16) — top-K affinity neighbors of the focal,
  // projected to screen pixels per-frame and written to
  // `affinityProjectionRef.current` for AffinityTriangleOverlay to
  // consume via its own ~20Hz polling RAF.
  neighbors = null,
  affinityProjectionRef = null,
  highlightPairings = null,
  flyToTarget = null,
  highlightIngredients = null,
  focusedClusterId = null,
  affinityEnabled = true,
  isMobile = false,
  onClearSelection = null,
}) {
  const containerRef = useRef(null);
  const stateRef = useRef(null); // holds all Three.js state
  const affinityModeRef = useRef(null); // α-mode controller (R13-5)
  const cameraAnimatorRef = useRef(null); // R14 cluster-tour + focal-orbit
  const [pcaAxes, setPcaAxes] = useState(null);
  // Use lifted state if provided, otherwise local state
  const [localMode, setLocalMode] = useState('ml');
  const mode = externalMode !== undefined ? externalMode : localMode;
  const setMode = onModeChange || setLocalMode;
  const modeRef = useRef(mode);

  // External mode change (App.jsx's dropdown calls setLivingMode):
  // fire the position + camera transition. MUST run BEFORE the
  // modeRef sync below — triggerTransition() reads modeRef.current
  // as `fromMode`, and if modeRef has already been updated to the
  // new value, fromMode === toMode and the trigger bails.
  const lastTriggeredModeRef = useRef(mode);
  useEffect(() => {
    if (lastTriggeredModeRef.current === mode) return;
    const prevMode = lastTriggeredModeRef.current;
    lastTriggeredModeRef.current = mode;
    // triggerTransition reads modeRef.current as the "from" mode —
    // ensure it's still the previous value here (the modeRef sync
    // useEffect below runs AFTER this one in declaration order).
    stateRef.current?.triggerTransition?.(mode);
    // Defensive: if the modeRef sync has already executed (e.g. on
    // a fast re-render), re-fire with the captured prevMode so we
    // don't silently no-op.
    if (modeRef.current === mode && prevMode !== mode) {
      modeRef.current = prevMode;
      stateRef.current?.triggerTransition?.(mode);
      modeRef.current = mode;
    }
  }, [mode]);

  // Keep modeRef in sync for use inside animation loop. Declared
  // after the trigger useEffect so it runs AFTER it.
  useEffect(() => { modeRef.current = mode; }, [mode]);

  // Refs for callbacks/props consumed inside the scene-setup useEffect
  // closure, which only runs on [data] changes. Without these refs the
  // closure captures stale values (focusedClusterId stays null, cluster
  // focus click-gating fails).
  const onNodeClickRef = useRef(onNodeClick);
  useEffect(() => { onNodeClickRef.current = onNodeClick; }, [onNodeClick]);
  const focusedClusterIdRef = useRef(focusedClusterId);
  useEffect(() => { focusedClusterIdRef.current = focusedClusterId; }, [focusedClusterId]);
  const onPoleHoverRef = useRef(onPoleHover);
  useEffect(() => { onPoleHoverRef.current = onPoleHover; }, [onPoleHover]);
  const onBridgePulseRef = useRef(onBridgePulse);
  useEffect(() => { onBridgePulseRef.current = onBridgePulse; }, [onBridgePulse]);
  // Live filter stack ref — read by AffinityMode (constructor-injected
  // getFilterStack closure) so the wedge axis follows the most-recent
  // active filter without rebuilding stateRef. Sync effect below also
  // re-renders the wedge layout in-place after the ref updates.
  const filterStackRef = useRef(filterStack);
  useEffect(() => {
    filterStackRef.current = filterStack;
    // Refresh the wedge axis on filter change while engaged. No-op
    // when no focal is selected.
    affinityModeRef.current?.refreshWedgeLayout?.();
  }, [filterStack]);

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

    // Categorical wheel positions (Phase 2 MVP). Computed once at
    // mount time — each is an O(N) phyllotaxis layout per axis. The
    // gnnEntropy / cuisineMap / seasonMap inputs are read off `data`
    // when present, otherwise the bucketer falls back to per-node
    // fields (e.g. node.cuisines for cuisine).
    const categoricalCtx = {
      gnnEntropy: data.gnnEntropy || null,
      cuisineMap: data.cuisineMap || null,
      seasonMap:  data.seasonMap  || null,
    };
    const tasteOut   = computeCategoricalWheelPositions('taste',   graph.nodes, categoricalCtx);
    const aromasOut  = computeCategoricalWheelPositions('aromas',  graph.nodes, categoricalCtx);
    const cuisineOut = computeCategoricalWheelPositions('cuisine', graph.nodes, categoricalCtx);
    const seasonOut  = computeCategoricalWheelPositions('season',  graph.nodes, categoricalCtx);
    const familyOut  = computeCategoricalWheelPositions('family',  graph.nodes, categoricalCtx);
    // R17 — bucket-pole position tables. 2D variants put poles on a
    // flat ring (matches the existing wheel layout when pull===1).
    // 3D variants distribute poles on a Fibonacci sphere so the user
    // can rotate the camera and inspect bucket structure spatially.
    const polesByAxis2D = {
      taste:   computeBucketPoles2D('taste',   graph.nodes, categoricalCtx),
      aromas:  computeBucketPoles2D('aromas',  graph.nodes, categoricalCtx),
      cuisine: computeBucketPoles2D('cuisine', graph.nodes, categoricalCtx),
      season:  computeBucketPoles2D('season',  graph.nodes, categoricalCtx),
      family:  computeBucketPoles2D('family',  graph.nodes, categoricalCtx),
    };
    const polesByAxis3D = {
      taste:   computeBucketPoles3D('taste',   graph.nodes, categoricalCtx),
      aromas:  computeBucketPoles3D('aromas',  graph.nodes, categoricalCtx),
      cuisine: computeBucketPoles3D('cuisine', graph.nodes, categoricalCtx),
      season:  computeBucketPoles3D('season',  graph.nodes, categoricalCtx),
      family:  computeBucketPoles3D('family',  graph.nodes, categoricalCtx),
    };
    // R19 Phase 2 — per-axis bucket stats (top-N members + one cross-
    // bucket bridge). One-shot O(N+E) per axis; the result feeds the
    // enriched pole-hover tooltip via sprite.userData.
    function statsFor(axisKey, out) {
      return computeBucketStats(axisKey, {
        nodes: graph.nodes,
        edges: graph.edges,
        bucketOf: out.bucketOf,
      });
    }
    const statsByAxis = {
      taste:   statsFor('taste',   tasteOut),
      aromas:  statsFor('aromas',  aromasOut),
      cuisine: statsFor('cuisine', cuisineOut),
      season:  statsFor('season',  seasonOut),
      family:  statsFor('family',  familyOut),
    };
    // R19 Phase 3 — top-20 bridge ingredients per axis, ranked globally
    // by cross-bucket cooccurrence strength. The threshold-crossing
    // effect reads bridgesByAxis[morphAxis] to fire the pulse overlay
    // without recomputing on every slider tick.
    function bridgesFor(axisKey, out) {
      return rankBridges(axisKey, {
        nodes: graph.nodes,
        edges: graph.edges,
        bucketOf: out.bucketOf,
      }, { topN: 20 });
    }
    const bridgesByAxis = {
      taste:   bridgesFor('taste',   tasteOut),
      aromas:  bridgesFor('aromas',  aromasOut),
      cuisine: bridgesFor('cuisine', cuisineOut),
      season:  bridgesFor('season',  seasonOut),
      family:  bridgesFor('family',  familyOut),
    };
    const bucketColorByAxis = {
      taste:   tasteOut.bucketColor,
      aromas:  aromasOut.bucketColor,
      cuisine: cuisineOut.bucketColor,
      season:  seasonOut.bucketColor,
      family:  familyOut.bucketColor,
    };
    const tasteWheel   = tasteOut.positions;
    const aromasWheel  = aromasOut.positions;
    const cuisineWheel = cuisineOut.positions;
    const seasonWheel  = seasonOut.positions;
    const familyWheel  = familyOut.positions;
    // Lookup table for resolving (mode → axis output) without
    // string comparisons inside hot paths.
    const categoricalOutByMode = {
      taste2d:   tasteOut,
      aromas2d:  aromasOut,
      cuisine2d: cuisineOut,
      season2d:  seasonOut,
      family2d:  familyOut,
    };

    // Name index map
    const nameIdx = new Map();
    nodeArray.forEach((n, i) => nameIdx.set(n.name, i));

    // R20 — corpus max pairingCount, used to normalize per-node
    // stickiness so a single mega-hub doesn't pin every other node.
    let maxPairingCount = 0;
    for (const n of nodeArray) {
      const pc = n.pairingCount || 0;
      if (pc > maxPairingCount) maxPairingCount = pc;
    }

    // Float32Arrays for eight position sets (4 original + 4 categorical wheels)
    const posA = new Float32Array(count * 3); // ML 3D
    const posB = new Float32Array(count * 3); // ML 2D (PCA) — Y=0 flat plane
    const posC = new Float32Array(count * 3); // Taste axis 3D
    const posD = new Float32Array(count * 3); // Taste axis 2D (wheel)
    const posE = new Float32Array(count * 3); // Aromas 2D wheel
    const posF = new Float32Array(count * 3); // Cuisine 2D wheel
    const posG = new Float32Array(count * 3); // Season 2D wheel
    const posH = new Float32Array(count * 3); // Family 2D wheel
    const curPos = new Float32Array(count * 3);

    const posForMode = {
      ml: posA, ml2d: posB, neural: posC, taste2d: posD,
      aromas2d: posE, cuisine2d: posF, season2d: posG, family2d: posH,
    };

    for (let i = 0; i < count; i++) {
      const name = nodeArray[i].name;
      const ml = (mlPos && mlPos[name]) || tasteAxisPos[name] || [0, 0, 0];
      const ta = tasteAxisPos[name] || [0, 0, 0];
      // taste2d now uses the categorical wheel layout (8 sub-discs,
      // one per dominant taste). Falls back to the legacy octagonal
      // pos2D positioner only if the bucket assignment failed.
      const wh = tasteWheel[name] || pos2D[name] || [0, 0, 0];
      const aro = aromasWheel[name]  || [0, 0, 0];
      const cui = cuisineWheel[name] || [0, 0, 0];
      const sea = seasonWheel[name]  || [0, 0, 0];
      const fam = familyWheel[name]  || [0, 0, 0];
      posA[i*3] = ml[0]; posA[i*3+1] = ml[1]; posA[i*3+2] = ml[2];
      posB[i*3] = 0; posB[i*3+1] = 0; posB[i*3+2] = 0;
      posC[i*3] = ta[0]; posC[i*3+1] = ta[1]; posC[i*3+2] = ta[2];
      posD[i*3] = wh[0]; posD[i*3+1] = wh[1]; posD[i*3+2] = wh[2];
      posE[i*3] = aro[0]; posE[i*3+1] = aro[1]; posE[i*3+2] = aro[2];
      posF[i*3] = cui[0]; posF[i*3+1] = cui[1]; posF[i*3+2] = cui[2];
      posG[i*3] = sea[0]; posG[i*3+1] = sea[1]; posG[i*3+2] = sea[2];
      posH[i*3] = fam[0]; posH[i*3+1] = fam[1]; posH[i*3+2] = fam[2];
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
    if (MODE_IS_2D.has(modeRef.current)) {
      // Wheel modes (taste2d + the categorical wheels) want a slightly
      // higher camera so the full ring is visible. ml2d (PCA scatter)
      // can sit closer.
      camera.position.set(0, modeRef.current === 'ml2d' ? 100 : 120, 0.1);
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
    const bloomStrength = computeBloomStrength(1.5, typeof window !== 'undefined' ? window.innerWidth : null);
    composer.addPass(new UnrealBloomPass(new THREE.Vector2(el.clientWidth, el.clientHeight), bloomStrength, 0.4, 0.85));

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
    // Per-axis bucket-color arrays (used in the 4 categorical wheel
    // modes). Each is a parallel array of THREE.Color objects, indexed
    // by the same `nameIdx` as defaultColors / clusterColors. Built
    // below in the main color-population loop.
    const tasteColors   = new Array(count);
    const aromaColors   = new Array(count);
    const cuisineColors = new Array(count);
    const seasonColors  = new Array(count);
    const familyColors  = new Array(count);
    const categoricalColorByMode = {
      taste2d:   tasteColors,
      aromas2d:  aromaColors,
      cuisine2d: cuisineColors,
      season2d:  seasonColors,
      family2d:  familyColors,
    };

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

    // Cache THREE.Color instances per bucket-label per axis so we
    // don't allocate one Color per node — there are only ~5-11 buckets
    // per axis but ~3,913 nodes.
    const bucketColorCache = {
      taste:   new Map(),
      aromas:  new Map(),
      cuisine: new Map(),
      season:  new Map(),
      family:  new Map(),
    };
    function colorForBucket(axisKey, label, hexMap) {
      if (!label) return new THREE.Color('#3a3a4a'); // muted grey for unbucketed
      const cache = bucketColorCache[axisKey];
      let c = cache.get(label);
      if (!c) {
        const hex = hexMap.get(label) || '#3a3a4a';
        c = new THREE.Color(hex);
        cache.set(label, c);
      }
      return c;
    }

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
      // Categorical-axis colors — one bucket-color per node per axis.
      // Each axis's bucketOf Map<name, label> gives the bucket; the
      // bucketColor Map<label, hex> gives the color.
      const tasLbl = tasteOut.bucketOf.get(node.name);
      const aroLbl = aromasOut.bucketOf.get(node.name);
      const cuiLbl = cuisineOut.bucketOf.get(node.name);
      const seaLbl = seasonOut.bucketOf.get(node.name);
      const famLbl = familyOut.bucketOf.get(node.name);
      tasteColors[i]   = colorForBucket('taste',   tasLbl, tasteOut.bucketColor).clone();
      aromaColors[i]   = colorForBucket('aromas',  aroLbl, aromasOut.bucketColor).clone();
      cuisineColors[i] = colorForBucket('cuisine', cuiLbl, cuisineOut.bucketColor).clone();
      seasonColors[i]  = colorForBucket('season',  seaLbl, seasonOut.bucketColor).clone();
      familyColors[i]  = colorForBucket('family',  famLbl, familyOut.bucketColor).clone();
      // Initial color set by mode — Network modes use cluster, taste
      // modes use taste, categorical modes use the axis bucket color.
      const catArr = categoricalColorByMode[modeRef.current];
      const initColor = (modeRef.current === 'ml' || modeRef.current === 'ml2d')
        ? clusterColors[i]
        : (catArr ? catArr[i] : c);
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
    // taste2d now uses the categorical wheel labels (sub-disc centroids
    // via categoricalLabelGroupByMode['taste2d']), so the legacy 8-axis
    // sprite ring is restricted to the 3D `neural` mode only.
    labelGroup.visible = modeRef.current === 'neural';
    scene.add(labelGroup);

    // --- Categorical-axis bucket labels (Phase 2 wheel modes) ---
    // One label sprite per bucket per axis, positioned just outside
    // the bucket's centroid on the wheel ring. Each axis has its own
    // group so visibility can flip per-mode without rebuilding.
    function buildCategoricalLabels(out) {
      const group = new THREE.Group();
      // Position labels at radius slightly larger than the wheel
      // ring, outward from origin, so they sit OUTSIDE the petal.
      const LABEL_RADIUS = 110;
      for (const [label, centroid] of out.bucketCentroids) {
        const hex = out.bucketColor.get(label) || '#ffffff';
        const sprite = makeLabel(label.toUpperCase(), hex, 18);
        const ang = Math.atan2(centroid[2], centroid[0]);
        sprite.position.set(
          Math.cos(ang) * LABEL_RADIUS,
          0.5,
          Math.sin(ang) * LABEL_RADIUS,
        );
        sprite.userData = { axisLabel: label, isLabel: true };
        group.add(sprite);
      }
      group.visible = false;
      scene.add(group);
      return group;
    }
    const categoricalLabelGroupByMode = {
      taste2d:   buildCategoricalLabels(tasteOut),
      aromas2d:  buildCategoricalLabels(aromasOut),
      cuisine2d: buildCategoricalLabels(cuisineOut),
      season2d:  buildCategoricalLabels(seasonOut),
      family2d:  buildCategoricalLabels(familyOut),
    };

    // R18 — bucket-pole labels keyed by axis (rather than by legacy
    // mode key). Render one label per bucket positioned ON the actual
    // pole position (Fibonacci sphere in 3D, flat ring in 2D). Used
    // by the visibility-toggle effect that shows / hides them based
    // on filterStack + morphAxis + geometry mode. Tooltip-on-hover
    // surfaces bucket size; hit detection is via raycaster against
    // sprite.userData.isPole.
    function buildPoleLabels(polesByAxis, out, statsForAxis, scale = 1.18) {
      const group = new THREE.Group();
      for (const [label, pole] of polesByAxis.polePositions) {
        const hex = out.bucketColor.get(label) || '#ffffff';
        const stat = statsForAxis?.get(label) || null;
        const memberCount = stat?.count ?? (out.bucketOf
          ? Array.from(out.bucketOf.values()).filter((v) => v === label).length
          : 0);
        const sprite = makeLabel(label.toUpperCase(), hex, 22);
        // Push label outward from origin so it doesn't collide with
        // the bucket of nodes pulled to the pole — scale > 1 nudges
        // it past the pole position along the same radial direction.
        sprite.position.set(pole[0] * scale, pole[1] * scale + 0.5, pole[2] * scale);
        sprite.userData = {
          isPole: true,
          axisLabel: label,
          memberCount,
          color: hex,
          // R19 Phase 2 — enriched tooltip payload. topMembers + bridge
          // come from the one-shot statsByAxis computed above; null/empty
          // when the bucket is empty or has no cross-bucket edges.
          topMembers: stat?.topMembers || [],
          bridge: stat?.bridge || null,
        };
        group.add(sprite);
      }
      group.visible = false;
      scene.add(group);
      return group;
    }
    const poleLabelGroup3DByAxis = {
      taste:   buildPoleLabels(polesByAxis3D.taste,   tasteOut,   statsByAxis.taste),
      aromas:  buildPoleLabels(polesByAxis3D.aromas,  aromasOut,  statsByAxis.aromas),
      cuisine: buildPoleLabels(polesByAxis3D.cuisine, cuisineOut, statsByAxis.cuisine),
      season:  buildPoleLabels(polesByAxis3D.season,  seasonOut,  statsByAxis.season),
      family:  buildPoleLabels(polesByAxis3D.family,  familyOut,  statsByAxis.family),
    };
    const poleLabelGroup2DByAxis = {
      taste:   buildPoleLabels(polesByAxis2D.taste,   tasteOut,   statsByAxis.taste),
      aromas:  buildPoleLabels(polesByAxis2D.aromas,  aromasOut,  statsByAxis.aromas),
      cuisine: buildPoleLabels(polesByAxis2D.cuisine, cuisineOut, statsByAxis.cuisine),
      season:  buildPoleLabels(polesByAxis2D.season,  seasonOut,  statsByAxis.season),
      family:  buildPoleLabels(polesByAxis2D.family,  familyOut,  statsByAxis.family),
    };
    // Show the right one initially if we mounted in a categorical mode.
    if (categoricalLabelGroupByMode[modeRef.current]) {
      categoricalLabelGroupByMode[modeRef.current].visible = true;
    }

    // --- Octagonal sector lines + concentric rings for wheel mode ---
    // Legacy from the original octagonal taste2d wheel. With taste2d
    // now rendered as a categorical sub-disc wheel, these sector
    // dividers no longer line up with anything, so we keep the geometry
    // around but never show it. Could be deleted in a future cleanup.
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
      // R14 v3: when AffinityMode is engaged, the visible focal + ring
      // shapes sit at orbit positions far from the underlying
      // ingredients' real layout coordinates. The default raycast
      // against the main mesh would miss every ring (or hit some
      // unrelated node behind it), leaving the user unable to repivot
      // by clicking a visible affinity sphere. Test ring meshes first;
      // on hit, map (mesh, instanceId) → global ingredient index.
      const aff = affinityModeRef.current;
      const ringMeshes = aff?.engaged ? aff.getRaycastMeshes() : [];
      if (ringMeshes.length > 0) {
        const rect = renderer.domElement.getBoundingClientRect();
        const mx = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        const my = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        raycaster.setFromCamera({ x: mx, y: my }, camera);
        const hits = raycaster.intersectObjects(ringMeshes, false);
        if (hits.length > 0) {
          const idx = aff.resolveRingHit(hits[0].object, hits[0].instanceId);
          if (idx >= 0 && idx < nodeArray.length) {
            const node = nodeArray[idx];
            // Cluster gate doesn't apply here — affinities deliberately
            // span clusters by chemistry, and the user just clicked an
            // explicit ring sphere asking for that ingredient.
            onNodeClickRef.current?.(node);
            return;
          }
        }
      }
      handleSceneClick(event, camera, renderer, tasteLabelSprites, mesh, nodeArray, raycaster, {
        // Gate clicks by the current cluster focus (read via ref so we
        // always see the latest value — the scene-setup useEffect runs
        // only on [data] change). Nodes outside the focused cluster
        // are silently ignored; empty clicks propagate (App.jsx exits
        // focus on null).
        onNodeClick: (node) => {
          const focused = focusedClusterIdRef.current;
          if (focused != null && node) {
            // Categorical-wheel modes use pseudo-cluster IDs (negative,
            // -100 - i) that don't map to node.clusterId. Resolve the
            // bucket label and compare via the axis's bucketOf instead.
            const m = modeRef.current;
            if (MODE_IS_CATEGORICAL.has(m) && focused <= -100) {
              const axisKey = MODE_TO_AXIS[m];
              const axis = axisKey ? CATEGORICAL_AXES[axisKey] : null;
              const idx = -100 - focused;
              const bucketLabel = axis?.labels?.[idx];
              const out = stateRef.current?.categoricalOutByMode?.[m];
              const nodeBucket = out?.bucketOf?.get(node.name);
              if (bucketLabel && nodeBucket !== bucketLabel) return;
            } else if (node.clusterId !== focused) {
              return;
            }
          }
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

    // Track the last pole sprite reported so we only fire onPoleHover
    // on transitions (avoids spamming React state every mousemove tick).
    let lastPoleLabel = null;
    function onMove(event) {
      // R18 — pole-sprite raycast runs first. Only one pole group is
      // visible at a time (the one for the active axis filter under the
      // current geometry mode). Hit any sprite in it and we skip the
      // node-hover path entirely.
      const phCb = onPoleHoverRef.current;
      if (phCb) {
        const groupSet = modeRef.current === 'ml'
          ? poleLabelGroup3DByAxis
          : poleLabelGroup2DByAxis;
        const visibleGroup = Object.values(groupSet || {}).find((g) => g.visible);
        if (visibleGroup && visibleGroup.children.length > 0) {
          const rect = renderer.domElement.getBoundingClientRect();
          const mx = ((event.clientX - rect.left) / rect.width) * 2 - 1;
          const my = -((event.clientY - rect.top) / rect.height) * 2 + 1;
          raycaster.setFromCamera({ x: mx, y: my }, camera);
          const hits = raycaster.intersectObjects(visibleGroup.children, false);
          if (hits.length > 0) {
            const sprite = hits[0].object;
            const ud = sprite.userData || {};
            if (ud.isPole) {
              lastPoleLabel = ud.axisLabel;
              phCb({
                label: ud.axisLabel,
                memberCount: ud.memberCount || 0,
                color: ud.color || '#ffffff',
                topMembers: Array.isArray(ud.topMembers) ? ud.topMembers : [],
                bridge: ud.bridge || null,
                x: event.clientX,
                y: event.clientY,
              });
              if (onNodeHover) onNodeHover(null, null);
              return;
            }
          }
        }
        if (lastPoleLabel !== null) {
          lastPoleLabel = null;
          phCb(null);
        }
      }
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

    // Camera targets per mode. All 5 categorical wheels (taste2d
    // included) share the same top-down camera — they're laid out on
    // the same y=0 plane at RING_RADIUS=90.
    const camTargets = {
      ml:        { pos: [0, 40, 120], lookAt: [0, 0, 0] },
      ml2d:      { pos: [0, 100, 0.1], lookAt: [0, 0, 0] },
      neural:    { pos: [0, 40, 120], lookAt: [0, 0, 0] },
      taste2d:   { pos: [0, 200, 0.1], lookAt: [0, 0, 0] },
      aromas2d:  { pos: [0, 200, 0.1], lookAt: [0, 0, 0] },
      cuisine2d: { pos: [0, 200, 0.1], lookAt: [0, 0, 0] },
      season2d:  { pos: [0, 200, 0.1], lookAt: [0, 0, 0] },
      family2d:  { pos: [0, 200, 0.1], lookAt: [0, 0, 0] },
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
        // Show/hide legacy 8-axis taste labels — restricted to 3D
        // `neural` only now that taste2d uses categorical sub-disc
        // labels mounted via categoricalLabelGroupByMode['taste2d'].
        const toTaste = transition.toMode === 'neural';
        const fromTaste = transition.fromMode === 'neural';
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

      // Legacy octagonal sector lines — taste2d no longer uses them.
      sectorGroup.visible = false;
      lineMat.opacity = 0;

      if (t >= 1) {
        transition.active = false;
        // Reset controls target
        controls.target.set(camEnd.lookAt[0], camEnd.lookAt[1], camEnd.lookAt[2]);
        controls.update();
        sectorGroup.visible = false;
        labelGroup.visible = transition.toMode === 'neural';
        clusterLabelGroup.visible = transition.toMode === 'ml' || transition.toMode === 'ml2d';
        clusterConnectorGroup.visible = clusterLabelGroup.visible;
        if (clusterConnectorGroup.visible) updateClusterConnectors();
        // Categorical-axis label visibility — show the matching axis,
        // hide the rest.
        for (const [m, g] of Object.entries(categoricalLabelGroupByMode)) {
          g.visible = (m === transition.toMode);
        }
        // Push the per-mode color array into the instanced mesh so
        // categorical wheels render with bucket colors and the other
        // modes restore their respective default/cluster colors.
        const catArr = categoricalColorByMode[transition.toMode];
        const colorSrc = (transition.toMode === 'ml' || transition.toMode === 'ml2d')
          ? clusterColors
          : (catArr || defaultColors);
        for (let i = 0; i < count; i++) {
          mesh.setColorAt(i, colorSrc[i]);
        }
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
        // Hide edges + particles in categorical wheel modes — every
        // cross-petal pairing produces a long line through the wheel
        // center, creating a dense pink haze that drowns out the
        // bucket structure. Restore on exit.
        const isCat = MODE_IS_CATEGORICAL.has(transition.toMode);
        edgeMesh.visible = isCat ? false : showEdges;
        particleMesh.visible = isCat ? false : showParticles;
        // R14 AC-NR-3 (v2): tour is mode-agnostic (orbits controls.target
        // when no centroids), so resume unconditionally on every transition.
        cameraAnimatorRef.current?.resumeClusterTour();
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
      // R14 CameraAnimator — drives cluster tour glide/dwell + focal
      // orbit (when engaged). Skips entirely while idle.
      cameraAnimatorRef.current?.tickAnimation(deltaSec);
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
      // R14 AC-NR-3: pause cluster tour for the duration of the
      // mode transition. Re-engagement happens at completion below
      // (only when toMode is a cluster mode).
      cameraAnimatorRef.current?.pauseClusterTour();
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
    const flyToPoint = (labelPos, centroidPos = null, onComplete = null) => {
      if (!labelPos) return;
      const labelVec = new THREE.Vector3(labelPos[0], labelPos[1], labelPos[2]);
      const centroidVec = centroidPos
        ? new THREE.Vector3(centroidPos[0], centroidPos[1], centroidPos[2])
        : null;
      const is2D = MODE_IS_2D.has(modeRef.current);
      // Camera-to-label distance. Was 70 — too far in 3D: the label sprite
      // (world-scale ~22 wide) shrinks and gets washed out by the cluster's
      // bloom glow behind it. 30 gives the label real visual weight in the
      // foreground while keeping the whole cluster body visible behind.
      // iOS detail: phone viewports zoomed too tight at 30/70, so pull the
      // camera back 1.6× on mobile (≤640px) to widen the framing.
      const isMobileVp = typeof window !== 'undefined'
        && window.matchMedia('(max-width: 640px)').matches;
      const mobileScale = isMobileVp ? 1.6 : 1;
      const distance = (is2D ? 70 : 30) * mobileScale;
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
        if (dt < 1 && stateRef.current) {
          requestAnimationFrame(tween);
        } else if (onComplete) {
          onComplete();
        }
      }
      tween();
    };

    stateRef.current = {
      scene, camera, renderer, composer, controls, mesh, edgeMesh, edgeMat, edgeGeo,
      edgeColors, edgeOpacities, validEdges,
      particleMesh, particleMat,
      nodeArray, nameIdx, maxPairingCount, defaultColors, clusterColors, curPos, posA, posB, posC, posD, posForMode,
      // categoricalOutByMode + categoricalColorByMode let the
      // focused-cluster effect derive bucket membership for the 5
      // wheel modes (taste/aromas/cuisine/season/family). bucketOf
      // is a Map<ingredientName, bucketLabel> per axis.
      categoricalOutByMode, categoricalColorByMode,
      // R16 Phase 1: the data context passed into every per-axis
      // bucketOf call (gnnEntropy + cuisineMap + seasonMap).
      categoricalCtx,
      // R17 — per-axis pole tables. The visibility-predicate effect
      // reads these to lerp position toward the bucket pole(s) for
      // each active axis filter under the current geometry mode.
      polesByAxis2D, polesByAxis3D,
      // R19 Phase 3 — top-20 cross-bucket bridge rankings per axis +
      // per-axis bucket→hex color maps. Consumed by the threshold-
      // crossing effect that fires the BridgePulseOverlay snapshot.
      bridgesByAxis, bucketColorByAxis,
      // R18 — pole label groups (Sprite groups, one per axis) for
      // both 2D ring + 3D Fibonacci layouts. Visibility flipped by
      // the new pole-label effect on (filterStack, morphAxis, mode).
      poleLabelGroup2DByAxis, poleLabelGroup3DByAxis,
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

    // R14 CameraAnimator — cluster tour + focal orbit. Gated behind
    // a URL param (?cameraAnim=v1 / =off) and the
    // CAMERA_ANIMATOR_DEFAULT_ON constant.
    //
    // v2 (continuous-orbit) tour is mode-agnostic: it works in
    // neural / taste2d / ml / ml2d. The adapter still emits cluster
    // centroids in ml / ml2d so the orbit pivot lands on the cluster
    // cloud center; for neural / taste2d it returns [] and the
    // animator orbits the current `controls.target` instead.
    //
    // Order matters (Phase 4): the animator is constructed BEFORE
    // AffinityMode so the latter can receive it via constructor
    // injection. Dispose runs in reverse order in cleanup below.
    let cameraAnimEnabled = CAMERA_ANIMATOR_DEFAULT_ON;
    try {
      const params = new URLSearchParams(window.location.search);
      const v = params.get('cameraAnim');
      if (v === 'v1') cameraAnimEnabled = true;
      else if (v === 'off') cameraAnimEnabled = false;
    } catch { /* SSR / private mode — keep default */ }

    if (cameraAnimEnabled) {
      const networkCentroidAdapter = () => {
        const m = modeRef.current;
        const out = [];
        if (m === 'ml') {
          for (const [id, pos] of centroidByCluster3d) {
            out.push({ id, position: pos });
          }
        } else if (m === 'ml2d') {
          for (const [id, c2] of centroidByCluster2d) {
            out.push({ id, position: [c2[0], 0, c2[1]] });
          }
        }
        // neural / taste2d → [] → animator orbits controls.target.
        return out;
      };
      cameraAnimatorRef.current = new CameraAnimator(
        { camera, controls, scene },
        networkCentroidAdapter,
        { isMobile },
      );
      cameraAnimatorRef.current.attachMediaQueryListener();
    }

    // R13-5 + R14: Instantiate AffinityMode controller after the
    // animator is constructed (Phase 4 wires AffinityMode through the
    // animator). Lifecycle bound to the scene's useEffect — disposed
    // in cleanup below in reverse order (AffinityMode first, then
    // animator) so the animator outlives any AffinityMode method
    // calls during teardown.
    if (data.pairingStrength && data.top5 && data.bridgeCompoundIndex && data.affinityThresholds) {
      affinityModeRef.current = new AffinityMode(stateRef.current, {
        pairingStrength: data.pairingStrength,
        top5: data.top5,
        bridgeCompoundIndex: data.bridgeCompoundIndex,
        affinityThresholds: data.affinityThresholds,
        graph: data.graph,
      }, cameraAnimatorRef.current, {
        // Wedge-layout inputs (2026-05-13 user feedback): the focal
        // fly-to view groups neighbors into bucket-wedge angular
        // sectors instead of the legacy star-radiating placement.
        // categoricalCtx feeds bucketOf() the same gnnEntropy /
        // cuisineMap / seasonMap the SVG wheel + visibility
        // predicate consume. getFilterStack returns the live filter
        // stack so the wedge axis follows the most-recent filter.
        categoricalCtx,
        getFilterStack: () => filterStackRef.current,
      });
    }

    // Engage cluster tour + wire user-input cancel only after BOTH
    // the animator and AffinityMode are constructed. Otherwise an
    // OrbitControls 'start' event mid-construction could call
    // recordInput before AffinityMode is ready to coexist.
    //
    // v2: tour is mode-agnostic (orbits controls.target when no
    // centroids), so engage unconditionally on mount.
    //
    // v3: bind cancel listeners DIRECTLY on the canvas (not via
    // OrbitControls' 'start' event). While the animator owns the
    // camera, controls.enabled is false — and a disabled OrbitControls
    // never fires 'start', so the previous wiring left the user unable
    // to break out of focal-orbit / cluster-tour. Pointerdown / wheel /
    // touchstart fire regardless of controls.enabled, so they land
    // recordInput → IDLE first; OrbitControls' own listener then sees
    // enabled=true on the same gesture and picks up the drag/pinch/
    // zoom cleanly.
    if (cameraAnimEnabled && cameraAnimatorRef.current) {
      cameraAnimatorRef.current.engageClusterTour();
    }
    const onAnimCancelPointer = () => cameraAnimatorRef.current?.recordInput();
    if (cameraAnimEnabled) {
      renderer.domElement.addEventListener('pointerdown', onAnimCancelPointer, { passive: true });
      renderer.domElement.addEventListener('wheel', onAnimCancelPointer, { passive: true });
      renderer.domElement.addEventListener('touchstart', onAnimCancelPointer, { passive: true });
    }

    return () => {
      running = false;
      // R14 dispose-order contract (load-bearing):
      //   1. AffinityMode disposes FIRST. Once Phase 4 wires
      //      AffinityMode → CameraAnimator, AffinityMode holds an
      //      injected reference and may invoke animator methods from
      //      inside its own exit() / dispose(). The animator MUST
      //      still be alive at that point.
      //   2. CameraAnimator disposes SECOND, after AffinityMode is
      //      fully torn down.
      // Reverse order produces a use-after-free on the animator that
      // silently no-ops (post-dispose methods short-circuit) instead
      // of throwing, making the leak invisible to AC-MA-3.
      if (affinityModeRef.current) {
        affinityModeRef.current.dispose();
        affinityModeRef.current = null;
      }
      if (cameraAnimatorRef.current) {
        cameraAnimatorRef.current.dispose();
        cameraAnimatorRef.current = null;
      }
      window.removeEventListener('resize', onResize);
      renderer.domElement.removeEventListener('click', onClickGuard);
      renderer.domElement.removeEventListener('touchstart', onTouchStart);
      renderer.domElement.removeEventListener('touchmove', onTouchMove);
      renderer.domElement.removeEventListener('touchend', onTouchEnd);
      renderer.domElement.removeEventListener('mousemove', onMove);
      if (cameraAnimEnabled) {
        renderer.domElement.removeEventListener('pointerdown', onAnimCancelPointer);
        renderer.domElement.removeEventListener('wheel', onAnimCancelPointer);
        renderer.domElement.removeEventListener('touchstart', onAnimCancelPointer);
      }
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
    const { mesh, defaultColors, clusterColors, categoricalColorByMode, nodeArray, tasteSelection } = st;
    const count = nodeArray.length;
    const activeNodes = selectedNodes.length > 0 ? selectedNodes : (selectedNode ? [selectedNode] : []);

    // Skip color override if taste selection is active
    if (tasteSelection && (tasteSelection.taste1 !== null || tasteSelection.taste2 !== null)) return;

    // R18 item 4 — clicking an ingredient while a filter is active
    // preserves the filter palette instead of falling back to
    // defaultColors. Mirrors the palette-selection rule in the
    // visual-state effect: axis filter → bucket palette; scope-only
    // → cluster palette; no filter → default.
    let palette = defaultColors;
    if (filterStack.length > 0 && morphAxis) {
      palette = categoricalColorByMode?.[`${morphAxis}2d`] || defaultColors;
    } else if (filterStack.length > 0) {
      palette = clusterColors;
    }

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
          const c = palette[i].clone().lerp(new THREE.Color('#ffffff'), str * 0.6);
          mesh.setColorAt(i, c);
        } else {
          mesh.setColorAt(i, palette[i].clone().multiplyScalar(0.15));
        }
      }
    } else {
      for (let i = 0; i < count; i++) mesh.setColorAt(i, palette[i]);
    }
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [selectedNode, selectedNodes, data, filterStack, morphAxis]);

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
    // R14 v3: external fly-to (cluster-pill / search-select) pauses
    // the tour for the duration of the fly, then re-engages it
    // around the now-updated controls.target so the cluster the
    // user clicked stays in frame and rotates slowly.
    const animator = cameraAnimatorRef.current;
    animator?.pauseClusterTour();
    const resumeAfterFly = () => animator?.resumeClusterTour();
    if (Array.isArray(flyToTarget)) {
      st.flyToPoint?.(flyToTarget, null, resumeAfterFly);
      return;
    }
    let labelPos = flyToTarget.position;
    let centroid = null;
    if (typeof flyToTarget.clusterId === 'number') {
      const cid = flyToTarget.clusterId;
      const is2D = MODE_IS_2D.has(modeRef.current);
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
    st.flyToPoint?.(labelPos, centroid, resumeAfterFly);
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
    const { mesh, clusterColors, defaultColors, nodeArray, clusterLabelGroup,
            categoricalOutByMode, categoricalColorByMode } = st;
    const inClusterMode = mode === 'ml' || mode === 'ml2d';
    const isCategorical = MODE_IS_CATEGORICAL.has(mode);
    // Source palette: ML clusters → cluster colors, categorical wheels →
    // bucket colors, otherwise the taste-based default colors.
    const source = inClusterMode
      ? clusterColors
      : (isCategorical && categoricalColorByMode?.[mode]) || defaultColors;
    // Resolve the focused-bucket label for categorical modes. The
    // ClusterJoystick assigns pseudo-cluster IDs `-100 - i` where `i`
    // indexes into CATEGORICAL_AXES[axisKey].labels. A null focusedClusterId
    // means "no focus — render every node normally".
    let focusedBucket = null;
    let bucketOf = null;
    if (isCategorical && focusedClusterId != null && focusedClusterId <= -100) {
      const axisKey = MODE_TO_AXIS[mode];
      const axis = axisKey ? CATEGORICAL_AXES[axisKey] : null;
      const idx = -100 - focusedClusterId;
      if (axis && idx >= 0 && idx < axis.labels.length) {
        focusedBucket = axis.labels[idx];
        bucketOf = categoricalOutByMode?.[mode]?.bucketOf || null;
      }
    }
    const DIM = 0.12;
    const GLOW = 1.5;
    const tmp = new THREE.Color();
    for (let i = 0; i < nodeArray.length; i++) {
      // Membership check varies by mode:
      //   ml/ml2d           → numeric clusterId match
      //   categorical wheel → bucket label match via axis bucketOf
      //   anything else     → no concept of cluster membership, leave
      //                       color at source (focusedClusterId path
      //                       below short-circuits when focusedBucket
      //                       resolution failed for the active mode).
      let match;
      if (isCategorical) {
        match = focusedBucket != null && bucketOf?.get(nodeArray[i].name) === focusedBucket;
      } else {
        match = nodeArray[i].clusterId === focusedClusterId;
      }
      const noFocus = focusedClusterId == null
        || (isCategorical && focusedBucket == null);
      if (noFocus) {
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

  // ---- R17: visual treatment switch when filterStack toggles ----
  // The R16 visual machinery (bucket colors, hidden edges/particles,
  // hidden ML cluster labels) was driven by `mode` ∈ {aromas2d, ...}.
  // Under R17, mode is just '3D'/'2D' (mapped to ml/ml2d in App.jsx)
  // and filterStack carries the categorical-active signal. This
  // effect re-applies the visual treatment so colors/edges/labels
  // respond to filter pills regardless of geometry mode.
  useEffect(() => {
    const st = stateRef.current;
    if (!st || !st.mesh) return;
    // Affinity-engage guard — while a single-ingredient affinity view
    // is engaged, AffinityMode owns the mesh colors / edge + label
    // visibility. Letting this effect run would clobber the affinity
    // rings and re-show the full network the moment the user toggles
    // a filter pill (user-reported regression 2026-05-16).
    if (affinityModeRef.current?.engaged) return;
    const {
      mesh, nodeArray, defaultColors, clusterColors,
      categoricalColorByMode, edgeMesh, particleMesh, clusterLabelGroup,
      clusterConnectorGroup, labelGroup,
    } = st;
    const filterActive = filterStack.length > 0;

    // Pick the color source:
    //   filterActive + axis filter → axis bucket colors keyed off
    //     the legacy mode-key the existing palette table understands
    //     (aromas → 'aromas2d', cuisine → 'cuisine2d', etc.).
    //   filterActive + scope-only → cluster colors (no axis pull, so
    //     keep the cluster palette — fine since visibility narrows
    //     but layout stays cooccurrence).
    //   no filter → default colors in 3D (ml), cluster colors in 2D
    //     (ml2d) — preserve R16 default behavior.
    let colorSrc;
    if (filterActive && morphAxis) {
      const palKey = `${morphAxis === 'aromas' ? 'aromas' : morphAxis}2d`;
      colorSrc = categoricalColorByMode?.[palKey] || defaultColors;
    } else if (filterActive) {
      colorSrc = clusterColors;
    } else {
      colorSrc = mode === 'ml' || mode === 'ml2d' ? clusterColors : defaultColors;
    }
    if (colorSrc) {
      for (let i = 0; i < nodeArray.length; i++) mesh.setColorAt(i, colorSrc[i]);
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }

    // Edges + particles hide whenever any filter is active — pulling
    // nodes toward poles leaves the long edges spanning the wheel
    // center, which produces the haze we already saw in R16 P1.
    if (edgeMesh) edgeMesh.visible = !filterActive && showEdges;
    if (particleMesh) particleMesh.visible = !filterActive && showParticles;

    // ML cluster labels + connectors only show in the unfiltered
    // network views — filter overlays replace them with axis pills
    // on the joystick.
    if (clusterLabelGroup) clusterLabelGroup.visible = !filterActive && (mode === 'ml' || mode === 'ml2d');
    if (clusterConnectorGroup) clusterConnectorGroup.visible = clusterLabelGroup?.visible || false;
    // Legacy taste-axis labels (3D neural mode only) — gone under R17
    // unless someone explicitly enters the legacy taste mode.
    if (labelGroup) labelGroup.visible = false;

    // R18 — pole labels: show ONE group (the one matching morphAxis +
    // geometry mode) when an axis filter is active; hide every other
    // group. With no filter or scope-only stack, all pole labels off.
    const groupSetActive = mode === 'ml' ? st.poleLabelGroup3DByAxis : st.poleLabelGroup2DByAxis;
    const groupSetInactive = mode === 'ml' ? st.poleLabelGroup2DByAxis : st.poleLabelGroup3DByAxis;
    for (const g of Object.values(groupSetInactive || {})) g.visible = false;
    for (const [axisKey, g] of Object.entries(groupSetActive || {})) {
      g.visible = filterActive && morphAxis === axisKey;
    }
  }, [filterStack, morphAxis, mode, showEdges, showParticles]);

  // ---- R16 Phase 1/2 + R17: filter-stack visibility predicate ----
  // Runs only when membership-defining inputs change (filterStack +
  // scope sets). The expensive part — per-node bucketOf calls — does
  // NOT re-run on slider drag, which would burn CPU at 5-15Hz
  // continuously. Stored visibility is then consumed by the
  // position-lerp effect below.
  const [emptyIntersection, setEmptyIntersection] = useState(false);
  const visibilityRef = useRef(null); // Uint8Array, one byte per node
  useEffect(() => {
    const st = stateRef.current;
    if (!st || !st.mesh || !st.nodeArray) return;
    const { nodeArray } = st;
    const ctx = { ...(st.categoricalCtx || {}), cocktailScope, sauceScope };
    if (!visibilityRef.current || visibilityRef.current.length !== nodeArray.length) {
      visibilityRef.current = new Uint8Array(nodeArray.length);
    }
    const vis = visibilityRef.current;
    let visibleCount = 0;
    for (let i = 0; i < nodeArray.length; i++) {
      const node = nodeArray[i];
      const isVisible = filterStack.length === 0
        ? true
        : filterStack.every((f) => bucketOf(f, node, ctx) != null);
      vis[i] = isVisible ? 1 : 0;
      if (isVisible) visibleCount++;
    }
    setEmptyIntersection(filterStack.length > 0 && visibleCount === 0);
    onVisibleCountChange?.(visibleCount);
  }, [filterStack, cocktailScope, sauceScope, onVisibleCountChange]);

  // ---- R17: position lerp + scale write ----
  // Runs on every pullStrength tick during slider drag, but does NOT
  // recompute visibility — it just reads the precomputed Uint8Array
  // and writes scale-0 for hidden nodes plus the lerp'd position for
  // visible nodes. Order in this loop: lerp cooccurrence base toward
  // the mean pole across active axis filters, weighted by pull.
  useEffect(() => {
    const st = stateRef.current;
    if (!st || !st.mesh || !st.nodeArray) return;
    // Affinity-engage guard — while engaged, AffinityMode owns node
    // scales + positions (rings + dimming). Letting the position lerp
    // run would re-show the bucket-pole network the moment the user
    // clicks any filter pill from inside the affinity view
    // (user-reported regression 2026-05-16). AffinityMode.exit() does
    // the restore when the user clears selection.
    if (affinityModeRef.current?.engaged) return;
    const { mesh, nodeArray, curPos, polesByAxis2D, polesByAxis3D } = st;
    const polesByAxis = mode === 'ml' ? polesByAxis3D : polesByAxis2D;
    const vis = visibilityRef.current;
    const axisFilters = filterStack.filter((f) => FILTER_TO_AXIS[f]);
    const dummy = new THREE.Object3D();
    // R18 — sqrt curve: dramatic onset at low slider values, gentle
    // finish near 100%. Slider semantics stay linear (the user sees
    // 0..100), but the visual lerp uses sqrt(t) so 25% slider already
    // reveals 50% of the bucket structure, while 75% slider lands at
    // 87%.
    // R20.1 — pull-cap retuned. 0.65 read as flat (the morph barely
    // moved nodes), 1.0 collapsed everything to a pinhead. 0.82
    // lands ~85% of the bucket pole at slider 100% — the chef sees a
    // clear bucket structure but the long tail still has visible
    // breathing room from the pole, so the cooccurrence story isn't
    // erased.
    const PULL_CAP = 0.82;
    const pullBase = Math.sqrt(Math.max(0, Math.min(1, pullStrength))) * PULL_CAP;
    // R20.1 — stickiness lowered from 0.4 to 0.3 in the same vein:
    // hubs still resist, but not by so much that the layout feels
    // un-responsive at 100% pull.
    const STICKINESS_MAX = 0.3;
    const maxPc = stateRef.current?.maxPairingCount || 1;
    const logMax = Math.log(1 + maxPc) || 1;
    for (let i = 0; i < nodeArray.length; i++) {
      const node = nodeArray[i];
      const isVisible = vis ? vis[i] === 1 : true;
      const pc = node.pairingCount || 0;
      const baseScale = Math.max(0.3, Math.min(2.0, Math.sqrt(pc) * 0.15));
      const finalScale = isVisible ? baseScale : 0;
      let px = curPos[i*3];
      let py = curPos[i*3+1];
      let pz = curPos[i*3+2];
      if (isVisible && pullBase > 0 && axisFilters.length > 0) {
        const stickiness = Math.log(1 + pc) / logMax; // 0..1
        const pull = pullBase * (1 - stickiness * STICKINESS_MAX);
        let sx = 0, sy = 0, sz = 0, n = 0;
        for (let f = 0; f < axisFilters.length; f++) {
          const axisKey = FILTER_TO_AXIS[axisFilters[f]];
          const tbl = polesByAxis?.[axisKey];
          const p = tbl?.positions?.[node.name];
          if (p) { sx += p[0]; sy += p[1]; sz += p[2]; n++; }
        }
        if (n > 0) {
          const mx = sx / n, my = sy / n, mz = sz / n;
          px = px + (mx - px) * pull;
          py = py + (my - py) * pull;
          pz = pz + (mz - pz) * pull;
        }
      }
      dummy.position.set(px, py, pz);
      dummy.scale.set(finalScale, finalScale, finalScale);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  }, [filterStack, mode, pullStrength, emptyIntersection]);

  // ---- R19 Phase 3: bridge-pulse trigger on pull-strength 0.5 crossing ----
  // When the slider crosses the half-way mark in either direction, fire a
  // one-shot snapshot of the active morph axis's top-20 cross-bucket
  // bridge ingredients (screen-projected positions + bucket colors) so the
  // App-side BridgePulseOverlay can flash them. Re-uses the same sqrt-pull
  // curve as the position lerp so the projected positions match what the
  // user actually sees on screen at the moment of crossing.
  const prevPullRef = useRef(pullStrength);
  useEffect(() => {
    const prev = prevPullRef.current;
    const curr = pullStrength;
    prevPullRef.current = curr;
    const crossed = (prev < 0.5 && curr >= 0.5) || (prev >= 0.5 && curr < 0.5);
    if (!crossed) return;
    if (!morphAxis) return;
    if (!filterStack || filterStack.length === 0) return;
    const cb = onBridgePulseRef.current;
    if (typeof cb !== 'function') return;
    const st = stateRef.current;
    if (!st || !st.camera || !st.renderer || !st.curPos || !st.nameIdx) return;
    const ranked = st.bridgesByAxis?.[morphAxis];
    if (!Array.isArray(ranked) || ranked.length === 0) return;
    const colorMap = st.bucketColorByAxis?.[morphAxis] || null;
    const polesByAxis = mode === 'ml' ? st.polesByAxis3D : st.polesByAxis2D;
    const axisFilters = filterStack.filter((f) => FILTER_TO_AXIS[f]);
    // R20 — use the same dampened + sticky pull formula as the position
    // lerp effect so the pulse's projected positions match what the user
    // sees on screen. Constants kept in sync with the position-lerp
    // effect's R20.1 retune (PULL_CAP 0.82, STICKINESS_MAX 0.3).
    const PULL_CAP = 0.82;
    const STICKINESS_MAX = 0.3;
    const pullBase = Math.sqrt(Math.max(0, Math.min(1, curr))) * PULL_CAP;
    const maxPc = st.maxPairingCount || 1;
    const logMax = Math.log(1 + maxPc) || 1;
    const rect = st.renderer.domElement.getBoundingClientRect();
    const v = new THREE.Vector3();
    const screenBridges = [];
    for (const r of ranked) {
      const i = st.nameIdx.get(r.name);
      if (i == null) continue;
      const node = st.nodeArray[i];
      let px = st.curPos[i * 3];
      let py = st.curPos[i * 3 + 1];
      let pz = st.curPos[i * 3 + 2];
      if (pullBase > 0 && axisFilters.length > 0) {
        const pc = node?.pairingCount || 0;
        const stickiness = Math.log(1 + pc) / logMax;
        const pullEff = pullBase * (1 - stickiness * STICKINESS_MAX);
        let sx = 0, sy = 0, sz = 0, n = 0;
        for (let f = 0; f < axisFilters.length; f++) {
          const axisKey = FILTER_TO_AXIS[axisFilters[f]];
          const tbl = polesByAxis?.[axisKey];
          const p = tbl?.positions?.[r.name];
          if (p) { sx += p[0]; sy += p[1]; sz += p[2]; n++; }
        }
        if (n > 0) {
          const mx = sx / n, my = sy / n, mz = sz / n;
          px = px + (mx - px) * pullEff;
          py = py + (my - py) * pullEff;
          pz = pz + (mz - pz) * pullEff;
        }
      }
      v.set(px, py, pz).project(st.camera);
      // .project returns NDC ([-1,1] for x/y, z in front-of-camera range).
      // Skip points clipped behind the camera so we don't flash phantoms.
      if (v.z > 1 || v.z < -1) continue;
      const sxPx = ((v.x + 1) / 2) * rect.width + rect.left;
      const syPx = ((1 - v.y) / 2) * rect.height + rect.top;
      screenBridges.push({
        name: r.name,
        x: sxPx,
        y: syPx,
        color: colorMap?.get?.(r.bucket) || '#7dd3fc',
      });
    }
    if (screenBridges.length === 0) return;
    cb({ bridges: screenBridges, ts: typeof performance !== 'undefined' ? performance.now() : Date.now() });
  }, [pullStrength, morphAxis, filterStack, mode]);

  // ---- R13-5: AffinityMode selection driver ----
  // Watches selectedNodes + affinityEnabled and dispatches
  // engage / pivot / suspend / exit on the AffinityMode controller.
  // α-mode runs on BOTH desktop and iOS so the ingredient flyto +
  // ring experience is identical across platforms. Only the
  // ?affinity=v0 kill-switch URL param disables it.
  useEffect(() => {
    const ctrl = affinityModeRef.current;
    if (!ctrl) return;
    if (!affinityEnabled) {
      // Kill-switch: ensure controller is never engaged.
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

  // ---- Track 2 (2026-05-16) — per-frame affinity projection ----
  // While a single ingredient is focal, project the focal + each
  // top-K neighbor's 3D position to viewport pixels and write the
  // snapshot to `affinityProjectionRef.current`. AffinityTriangleOverlay
  // polls the ref at ~20Hz and renders right-triangle wedges from focal
  // to each accent. Color per accent matches the network surface:
  // cluster color by default, bucket color when a categorical filter
  // is active (mirrors the R17 visual-treatment logic at line 2313).
  //
  // Clamps: focal/accent NDC outside [-1.2, 1.2] OR z out of [-1,1] →
  // the affected entry is omitted (focal omitted → snapshot=null).
  const trackedFocalName = selectedNodes.length === 1 ? selectedNodes[0] : null;
  // Mirror `neighbors` into a ref so the per-frame loop reads the
  // latest list without restarting the RAF when the parent re-renders
  // (and `neighbors` gets a new array identity each time).
  const neighborsRef = useRef(neighbors);
  useEffect(() => { neighborsRef.current = neighbors; }, [neighbors]);
  useEffect(() => {
    if (!affinityProjectionRef) return undefined;
    if (isMobile) return undefined;
    if (!trackedFocalName) {
      affinityProjectionRef.current = null;
      return undefined;
    }
    const v = new THREE.Vector3();
    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const st = stateRef.current;
      if (!st || !st.camera || !st.renderer || !st.curPos || !st.nameIdx) {
        affinityProjectionRef.current = null;
        return;
      }
      const fi = st.nameIdx.get(trackedFocalName);
      if (fi == null) {
        affinityProjectionRef.current = null;
        return;
      }
      const rect = st.renderer.domElement.getBoundingClientRect();
      const ctrl = affinityModeRef.current;
      const wedgeAxis = ctrl?.engaged ? ctrl.currentWedgeAxis : null;
      const ctrlEngaged = ctrl?.engaged;
      // Color source. Iter (2026-05-16 'audit'): when α-mode is engaged,
      // ALWAYS color by the wedge axis bucket palette so cone direction
      // (driven by the wedge layout) and cone color match. Without this
      // override, no-filter affinity view paints cones with cluster
      // colors that have nothing to do with the aroma sector the cone
      // points to — purple cones pointing at the floral sector etc.
      const filterActive = filterStackRef.current?.length > 0;
      const morphActive = filterActive && !!morphAxis;
      let colorArr;
      if (ctrlEngaged && wedgeAxis) {
        const palKey = `${wedgeAxis === 'aromas' ? 'aromas' : wedgeAxis}2d`;
        colorArr = st.categoricalColorByMode?.[palKey] || st.defaultColors;
      } else if (morphActive) {
        const palKey = `${morphAxis === 'aromas' ? 'aromas' : morphAxis}2d`;
        colorArr = st.categoricalColorByMode?.[palKey] || st.defaultColors;
      } else if (filterActive) {
        colorArr = st.clusterColors || st.defaultColors;
      } else {
        colorArr = (mode === 'ml' || mode === 'ml2d') ? (st.clusterColors || st.defaultColors) : st.defaultColors;
      }
      // Project world-space [x, y, z] → { x, y, opacity } viewport pixels.
      // Behind-camera (z out of [-1,1]) → null (skip entirely).
      // Otherwise opacity ramps from 1 inside |NDC|<=1 to 0 at the
      // hard cutoff |NDC|=1.6 so the wedge fades out as the accent
      // exits the viewport instead of popping (user feedback iter
      // 2026-05-16).
      const projectXYZ = (wx, wy, wz) => {
        v.set(wx, wy, wz).project(st.camera);
        if (v.z > 1 || v.z < -1) return null;
        const ax = Math.max(Math.abs(v.x), Math.abs(v.y));
        if (ax > 1.6) return null;
        const opacity = ax <= 1 ? 1 : Math.max(0, 1 - (ax - 1) / 0.6);
        return {
          x: ((v.x + 1) / 2) * rect.width + rect.left,
          y: ((1 - v.y) / 2) * rect.height + rect.top,
          opacity,
        };
      };
      const colorHex = (c) => `#${c.getHexString()}`;
      // Prefer AffinityMode's authoritative accent list (covers all
      // tiers including Surprising; carries per-accent worldPos so the
      // SVG cone lands on the actual ring-rendered position, not the
      // ingredient's curPos out in the network layout).
      const affList = ctrlEngaged ? (ctrl.currentAffinities || []) : null;
      // Focal: when α-mode is engaged, use AffinityMode's tracked focal
      // world position. Otherwise fall back to the focal's curPos.
      const focalWp = ctrl?.engaged && ctrl.focalWorldPos
        ? ctrl.focalWorldPos
        : [st.curPos[fi * 3], st.curPos[fi * 3 + 1], st.curPos[fi * 3 + 2]];
      const focalProj = projectXYZ(focalWp[0], focalWp[1], focalWp[2]);
      if (!focalProj) {
        affinityProjectionRef.current = null;
        return;
      }
      const focalColor = colorArr?.[fi] ? colorHex(colorArr[fi]) : '#ffffff';
      const nbs = affList && affList.length > 0
        ? affList
        : (neighborsRef.current || []);
      const candidates = [];
      for (const n of nbs) {
        const idx = st.nameIdx.get(n.name);
        if (idx == null) continue;
        // Position source priority: AffinityMode's wedge-placed worldPos
        // (matches the visible 3D shape) → fallback to network curPos.
        const wp = Array.isArray(n.worldPos) && n.worldPos.length === 3
          ? n.worldPos
          : [st.curPos[idx * 3], st.curPos[idx * 3 + 1], st.curPos[idx * 3 + 2]];
        const proj = projectXYZ(wp[0], wp[1], wp[2]);
        if (!proj) continue;
        candidates.push({
          name: n.name,
          x: proj.x,
          y: proj.y,
          color: colorArr?.[idx] ? colorHex(colorArr[idx]) : '#7dd3fc',
          strength: n.strength,
          // tier: 3 ★★★ chemistry / 2 ★★ strong / 1 ★ good / 0 surprising / null untiered
          tier: n.tier ?? null,
          opacity: proj.opacity,
        });
      }
      // Sort weakest-first so strongest paint visually on top (no cap
      // — slim cones below are narrow enough that 30+ stay readable).
      candidates.sort((p, q) => (p.strength || 0) - (q.strength || 0));
      affinityProjectionRef.current = {
        focal: { name: trackedFocalName, x: focalProj.x, y: focalProj.y, color: focalColor },
        accents: candidates,
        ts: typeof performance !== 'undefined' ? performance.now() : Date.now(),
      };
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      affinityProjectionRef.current = null;
    };
  }, [trackedFocalName, isMobile, mode, morphAxis, affinityProjectionRef]);

  // ---- Toggle handler — MODE_CYCLE / MODE_LABELS now imported
  // from `data/networkModes.js` so MobileTabBar's Network-button
  // dropdown can render the same set without duplication.
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

  // R6-37 a11y: keyboard shortcuts on the canvas wrapper.
  // Escape clears the current selection; slash focuses the search bar
  // (id "ingredient-search-input" is owned by SearchBar.jsx).
  const handleCanvasKeyDown = useCallback(
    (e) => {
      if (e.key === 'Escape' && onClearSelection) {
        e.preventDefault();
        onClearSelection();
        return;
      }
      if (e.key === '/') {
        const input = document.getElementById('ingredient-search-input');
        if (input) {
          e.preventDefault();
          input.focus();
        }
      }
    },
    [onClearSelection],
  );

  const a11ySelected = selectedNode || (selectedNodes.length > 0 ? selectedNodes[selectedNodes.length - 1] : null);

  return (
    <div className="absolute inset-0 pt-10" role="region" aria-label="Flavor network">
      <div
        ref={containerRef}
        tabIndex={0}
        role="application"
        aria-label="Flavor network — 3D ingredient pairing graph. Use Tab to traverse top ingredients, Enter to select, Escape to clear selection, slash to focus search."
        onKeyDown={handleCanvasKeyDown}
        style={{ width: '100%', height: '100%' }}
      />
      <NetworkA11yShim
        data={data}
        selectedNode={a11ySelected}
        onNodeClick={onNodeClick}
      />

      {/* R16 Phase 2: empty-intersection overlay. Shown when the filter
          stack reduces the visible set to 0 nodes (the layout itself
          is frozen — see Spec Amendment 1 in the plan). Click "Clear
          filters" to escape the dead-end without losing the camera. */}
      {emptyIntersection && (
        <div className="absolute inset-0 z-[60] flex items-center justify-center pointer-events-none">
          <div className="bg-[#0a0a12]/90 backdrop-blur-md border border-red-500/40 rounded-lg shadow-lg px-5 py-4 pointer-events-auto max-w-xs text-center">
            <p className="text-sm font-medium text-gray-200 mb-2">
              No ingredients match these filters
            </p>
            <p className="text-xs text-gray-500 mb-3">
              Try removing one of the active filters.
            </p>
          </div>
        </div>
      )}

      {/* PCA X/Y axis labels were removed in R18 per user feedback —
          they clashed visually with the filter pill row + breadcrumb
          and the variance-direction story wasn't reading at a glance.
          The pcaAxes state + load effect are kept around in case the
          insight ships back as a tooltip-on-pole feature later. */}

      {/* 4-way mode selector now lives on the bottom-bar Network
          button (MobileTabBar). LivingArchView renders no on-canvas
          mode pill — taps on the Network tab open a popover with the
          4 modes. Per user feedback 2026-05-08. */}

      {/* α-mode shape legend — only shown while a single ingredient is
          selected (which is the same gate that engages AffinityMode).
          Explains the four silhouettes the user sees in the rings:
          dodecahedron focal + bipyramid/cylinder/sphere tier rings. */}
      {affinityEnabled && selectedNodes.length === 1 && (
        <ShapeLegend title="Affinity shapes" legend={AFFINITY_SHAPE_LEGEND} />
      )}

      {/* Surprising tier now renders as a 5th 3D ring (star shapes,
          fuchsia edges) inside AffinityMode — see ring0Mesh in
          src/three/AffinityMode.js. The dedicated text panel that
          briefly lived here was removed once the 3D ring was wired
          (2026-05-08). */}
    </div>
  );
}
