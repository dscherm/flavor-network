import { useRef, useEffect } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { getNeighbors } from '../data/graph.js';
import { TASTE_COLORS } from '../utils/color.js';

const TASTE_ANGLES = {
  sweet: 0, sour: 45, bitter: 90, salty: 135,
  umami: 180, spicy: 225, pungent: 270, astringent: 315,
};
const TASTE_KEYS = Object.keys(TASTE_ANGLES);
const DEG = Math.PI / 180;
const WHEEL_RADIUS = 50;
const MAX_EDGES = 3000;
const MAX_CONSTELLATION = 10;

function getTasteAngle(taste) {
  if (!taste) return Math.random() * 360;
  const lower = taste.toLowerCase();
  for (const key of TASTE_KEYS) {
    if (lower.includes(key)) return TASTE_ANGLES[key];
  }
  return Math.random() * 360;
}

function getTasteColor(taste) {
  if (!taste) return TASTE_COLORS.default;
  const lower = taste.toLowerCase();
  for (const [key, hex] of Object.entries(TASTE_COLORS)) {
    if (key !== 'default' && lower.includes(key)) return hex;
  }
  return TASTE_COLORS.default;
}

/**
 * ConstellationView -- Flavor wheel ground plane with star-height nodes.
 * Self-contained Three.js scene, no SceneManager dependency.
 */
export default function ConstellationView({
  data,
  onNodeClick,
  selectedNode,
  selectedNodes = [],
  filterTaste = '',
}) {
  const containerRef = useRef(null);
  const sceneRef = useRef({});

  // Build scene
  useEffect(() => {
    if (!containerRef.current || !data) return;
    const container = containerRef.current;
    const { graph } = data;
    const { nodes, edges } = graph;

    // --- Renderer, scene, camera ---
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x050510);

    const camera = new THREE.PerspectiveCamera(
      55, container.clientWidth / container.clientHeight, 0.1, 2000
    );
    camera.position.set(0, 70, 80);
    camera.lookAt(0, 5, 0);

    // Controls -- bias toward overhead
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.minDistance = 20;
    controls.maxDistance = 250;
    controls.maxPolarAngle = Math.PI * 0.48; // prevent going below ground

    // Post-processing
    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    const bloom = new UnrealBloomPass(
      new THREE.Vector2(container.clientWidth, container.clientHeight),
      1.8, 0.3, 0.7
    );
    composer.addPass(bloom);

    // Ambient + point lights
    scene.add(new THREE.AmbientLight(0x303050, 0.8));
    const pLight = new THREE.PointLight(0x4f8fff, 1.5, 400);
    pLight.position.set(30, 60, 40);
    scene.add(pLight);

    // --- Starfield background ---
    const starGeo = new THREE.BufferGeometry();
    const starCount = 800;
    const starPos = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      starPos[i * 3] = (Math.random() - 0.5) * 600;
      starPos[i * 3 + 1] = Math.random() * 300 + 30;
      starPos[i * 3 + 2] = (Math.random() - 0.5) * 600;
    }
    starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPos, 3));
    scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({
      color: 0x8888cc, size: 0.3, transparent: true, opacity: 0.5,
    })));

    // --- Ground plane: 8 taste-colored sectors ---
    const wheelGroup = new THREE.Group();
    scene.add(wheelGroup);

    for (let i = 0; i < 8; i++) {
      const startA = (i * 45 - 22.5) * DEG;
      const endA = ((i + 1) * 45 - 22.5) * DEG;
      const shape = new THREE.Shape();
      shape.moveTo(0, 0);
      const steps = 16;
      for (let s = 0; s <= steps; s++) {
        const a = startA + (endA - startA) * (s / steps);
        shape.lineTo(Math.cos(a) * WHEEL_RADIUS, Math.sin(a) * WHEEL_RADIUS);
      }
      shape.lineTo(0, 0);
      const geo = new THREE.ShapeGeometry(shape);
      const hex = TASTE_COLORS[TASTE_KEYS[i]] || TASTE_COLORS.default;
      const mat = new THREE.MeshBasicMaterial({
        color: hex, transparent: true, opacity: 0.12, side: THREE.DoubleSide,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.y = 0;
      wheelGroup.add(mesh);
    }

    // Concentric grid circles
    for (const frac of [0.25, 0.5, 0.75, 1.0]) {
      const cGeo = new THREE.RingGeometry(
        WHEEL_RADIUS * frac - 0.05, WHEEL_RADIUS * frac + 0.05, 64
      );
      const cMat = new THREE.MeshBasicMaterial({
        color: 0x4f8fff, transparent: true, opacity: 0.08, side: THREE.DoubleSide,
      });
      const cMesh = new THREE.Mesh(cGeo, cMat);
      cMesh.rotation.x = -Math.PI / 2;
      cMesh.position.y = 0.01;
      wheelGroup.add(cMesh);
    }

    // Sector labels
    for (let i = 0; i < 8; i++) {
      const a = i * 45 * DEG;
      const label = TASTE_KEYS[i];
      const canvas = document.createElement('canvas');
      canvas.width = 128; canvas.height = 32;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = TASTE_COLORS[label] || '#aaa';
      ctx.font = 'bold 18px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(label, 64, 22);
      const tex = new THREE.CanvasTexture(canvas);
      const spriteMat = new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: 0.7 });
      const sprite = new THREE.Sprite(spriteMat);
      sprite.position.set(
        Math.cos(a) * (WHEEL_RADIUS + 5), 0.5, -Math.sin(a) * (WHEEL_RADIUS + 5)
      );
      sprite.scale.set(8, 2, 1);
      wheelGroup.add(sprite);
    }

    // --- Compute node positions ---
    const nodeArr = Array.from(nodes.values());
    const count = nodeArr.length;
    const positionsMap = {}; // name -> [x, y, z]
    const indexMap = new Map(); // name -> instance index

    // Precompute max pairing count
    const maxPC = Math.max(1, ...nodeArr.map(n => n.pairingCount || 0));

    for (let i = 0; i < count; i++) {
      const n = nodeArr[i];
      indexMap.set(n.name, i);
      const pc = n.pairingCount || 0;
      const theta = getTasteAngle(n.taste) * DEG;
      // High connectivity -> closer to center
      const rFrac = 0.2 + 0.7 * (1 - pc / maxPC) + Math.random() * 0.1;
      const r = rFrac * WHEEL_RADIUS;
      const x = Math.cos(theta + (Math.random() - 0.5) * 0.6) * r;
      const z = -Math.sin(theta + (Math.random() - 0.5) * 0.6) * r;
      const y = Math.log2(pc + 1) * 2;
      positionsMap[n.name] = [x, y, z];
    }

    // --- Star Nodes (InstancedMesh) ---
    const sphereGeo = new THREE.SphereGeometry(1, 12, 12);
    const sphereMat = new THREE.MeshBasicMaterial({
      color: 0xffffff, transparent: true, opacity: 0.9,
    });
    const iMesh = new THREE.InstancedMesh(sphereGeo, sphereMat, count);
    iMesh.frustumCulled = true;
    const dummy = new THREE.Object3D();
    const defaultColors = [];

    for (let i = 0; i < count; i++) {
      const n = nodeArr[i];
      const [x, y, z] = positionsMap[n.name];
      dummy.position.set(x, y, z);
      const strength = (n.pairingCount || 0) / maxPC;
      const s = 0.2 + strength * 0.8;
      dummy.scale.set(s, s, s);
      dummy.updateMatrix();
      iMesh.setMatrixAt(i, dummy.matrix);

      const col = new THREE.Color(getTasteColor(n.taste));
      // Slight brightness variation
      col.offsetHSL(0, 0, (Math.random() - 0.5) * 0.15);
      defaultColors.push(col.clone());
      iMesh.setColorAt(i, col);
    }
    iMesh.instanceMatrix.needsUpdate = true;
    if (iMesh.instanceColor) iMesh.instanceColor.needsUpdate = true;
    scene.add(iMesh);

    // Point lights for top-10 hubs
    const sorted = [...nodeArr].sort((a, b) => (b.pairingCount || 0) - (a.pairingCount || 0));
    for (let i = 0; i < Math.min(10, sorted.length); i++) {
      const pos = positionsMap[sorted[i].name];
      if (!pos) continue;
      const hubLight = new THREE.PointLight(
        new THREE.Color(getTasteColor(sorted[i].taste)).getHex(), 0.6, 25
      );
      hubLight.position.set(pos[0], pos[1] + 1, pos[2]);
      scene.add(hubLight);
    }

    // --- Edges (BufferGeometry LineSegments) ---
    const sortedEdges = [...edges].sort((a, b) => b.strength - a.strength).slice(0, MAX_EDGES);
    const edgePositions = new Float32Array(sortedEdges.length * 6);
    const edgeColors = new Float32Array(sortedEdges.length * 6);
    const edgeOpacities = new Float32Array(sortedEdges.length * 2);
    const edgeSrcNames = []; // for selection highlighting

    for (let i = 0; i < sortedEdges.length; i++) {
      const e = sortedEdges[i];
      const sP = positionsMap[e.source];
      const tP = positionsMap[e.target];
      if (!sP || !tP) continue;
      edgeSrcNames.push(e);
      const i6 = i * 6;
      edgePositions[i6] = sP[0]; edgePositions[i6 + 1] = sP[1]; edgePositions[i6 + 2] = sP[2];
      edgePositions[i6 + 3] = tP[0]; edgePositions[i6 + 4] = tP[1]; edgePositions[i6 + 5] = tP[2];
      const baseCol = new THREE.Color(0x4f8fff);
      edgeColors[i6] = baseCol.r; edgeColors[i6 + 1] = baseCol.g; edgeColors[i6 + 2] = baseCol.b;
      edgeColors[i6 + 3] = baseCol.r; edgeColors[i6 + 4] = baseCol.g; edgeColors[i6 + 5] = baseCol.b;
      const op = 0.03 + e.strength * 0.12;
      edgeOpacities[i * 2] = op;
      edgeOpacities[i * 2 + 1] = op;
    }

    const edgeGeo = new THREE.BufferGeometry();
    edgeGeo.setAttribute('position', new THREE.Float32BufferAttribute(edgePositions, 3));
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
    const edgeLines = new THREE.LineSegments(edgeGeo, edgeMat);
    scene.add(edgeLines);

    // --- Constellation tracing group (populated on selection) ---
    const constellationGroup = new THREE.Group();
    scene.add(constellationGroup);

    // --- Raycaster ---
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    function onClick(event) {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(mouse, camera);
      const hits = raycaster.intersectObject(iMesh);
      if (hits.length > 0 && onNodeClick) {
        onNodeClick(nodeArr[hits[0].instanceId]);
      } else if (onNodeClick) {
        onNodeClick(null);
      }
    }
    renderer.domElement.addEventListener('click', onClick);

    // Hover cursor
    let lastHover = -1;
    function onMove(event) {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(mouse, camera);
      const hits = raycaster.intersectObject(iMesh);
      const idx = hits.length > 0 ? hits[0].instanceId : -1;
      if (idx !== lastHover) {
        lastHover = idx;
        renderer.domElement.style.cursor = idx >= 0 ? 'pointer' : 'default';
      }
    }
    renderer.domElement.addEventListener('mousemove', onMove);

    // Store refs for selection effects + resize
    sceneRef.current = {
      renderer, scene, camera, controls, composer, iMesh, nodeArr, indexMap,
      defaultColors, edgeGeo, edgeOpacities, sortedEdges, positionsMap,
      constellationGroup, edges: graph.edges, container,
    };

    // Resize handler
    function onResize() {
      const w = container.clientWidth, h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      composer.setSize(w, h);
    }
    window.addEventListener('resize', onResize);

    // Animation loop
    let running = true;
    const clock = new THREE.Clock();
    function animate() {
      if (!running) return;
      requestAnimationFrame(animate);
      controls.update();
      // Gentle rotation of constellation lines
      const t = clock.getElapsedTime();
      for (const child of constellationGroup.children) {
        if (child.userData.isParticle) {
          const frac = ((t * 0.3 + child.userData.offset) % 1);
          const sp = child.userData.startPos;
          const ep = child.userData.endPos;
          child.position.set(
            sp[0] + (ep[0] - sp[0]) * frac,
            sp[1] + (ep[1] - sp[1]) * frac,
            sp[2] + (ep[2] - sp[2]) * frac,
          );
        }
      }
      composer.render();
    }
    animate();

    return () => {
      running = false;
      window.removeEventListener('resize', onResize);
      renderer.domElement.removeEventListener('click', onClick);
      renderer.domElement.removeEventListener('mousemove', onMove);
      controls.dispose();
      composer.dispose();
      renderer.dispose();
      sphereGeo.dispose();
      sphereMat.dispose();
      edgeGeo.dispose();
      edgeMat.dispose();
      starGeo.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      sceneRef.current = {};
    };
  }, [data]); // eslint-disable-line react-hooks/exhaustive-deps

  // --- Selection effect ---
  useEffect(() => {
    const s = sceneRef.current;
    if (!s.iMesh || !s.nodeArr) return;
    const { iMesh, nodeArr, indexMap, defaultColors, edgeGeo, edgeOpacities,
            sortedEdges, positionsMap, constellationGroup } = s;

    // Clear constellation traces
    while (constellationGroup.children.length) {
      const c = constellationGroup.children[0];
      constellationGroup.remove(c);
      if (c.geometry) c.geometry.dispose();
      if (c.material) c.material.dispose();
    }

    const active = selectedNodes.length > 0 ? selectedNodes : (selectedNode ? [selectedNode] : []);

    if (active.length === 0) {
      // Reset all colors and edge opacities
      for (let i = 0; i < nodeArr.length; i++) {
        iMesh.setColorAt(i, defaultColors[i]);
      }
      if (iMesh.instanceColor) iMesh.instanceColor.needsUpdate = true;
      const opAttr = edgeGeo.getAttribute('aOpacity');
      for (let i = 0; i < sortedEdges.length; i++) {
        const op = 0.03 + sortedEdges[i].strength * 0.12;
        opAttr.array[i * 2] = op;
        opAttr.array[i * 2 + 1] = op;
      }
      opAttr.needsUpdate = true;
      return;
    }

    const activeSet = new Set(active);

    // Gather neighbors for constellation tracing
    const neighborMap = new Map();
    for (const sel of active) {
      const nbrs = getNeighbors(sel, s.edges).slice(0, MAX_CONSTELLATION);
      for (const nb of nbrs) neighborMap.set(nb.name, Math.max(neighborMap.get(nb.name) || 0, nb.strength));
    }

    // Dim nodes, brighten selected + neighbors
    const dimCol = new THREE.Color(0x111118);
    for (let i = 0; i < nodeArr.length; i++) {
      const name = nodeArr[i].name;
      if (activeSet.has(name)) {
        const bright = defaultColors[i].clone().lerp(new THREE.Color(0xffffff), 0.5);
        iMesh.setColorAt(i, bright);
      } else if (neighborMap.has(name)) {
        const intensity = neighborMap.get(name);
        const c = defaultColors[i].clone().lerp(new THREE.Color(0xffffff), intensity * 0.3);
        iMesh.setColorAt(i, c);
      } else {
        iMesh.setColorAt(i, dimCol);
      }
    }
    if (iMesh.instanceColor) iMesh.instanceColor.needsUpdate = true;

    // Dim edges, brighten selected
    const opAttr = edgeGeo.getAttribute('aOpacity');
    for (let i = 0; i < sortedEdges.length; i++) {
      const e = sortedEdges[i];
      const connected = activeSet.has(e.source) || activeSet.has(e.target);
      const op = connected ? 0.15 + e.strength * 0.6 : 0.01;
      opAttr.array[i * 2] = op;
      opAttr.array[i * 2 + 1] = op;
    }
    opAttr.needsUpdate = true;

    // Draw constellation lines + labels + particles
    for (const sel of active) {
      const sp = positionsMap[sel];
      if (!sp) continue;
      const nbrs = getNeighbors(sel, s.edges).slice(0, MAX_CONSTELLATION);
      for (const nb of nbrs) {
        const ep = positionsMap[nb.name];
        if (!ep) continue;

        // Bright tube line
        const curve = new THREE.LineCurve3(
          new THREE.Vector3(sp[0], sp[1], sp[2]),
          new THREE.Vector3(ep[0], ep[1], ep[2])
        );
        const tubeGeo = new THREE.TubeGeometry(curve, 1, 0.12, 4, false);
        const tubeMat = new THREE.MeshBasicMaterial({
          color: 0x4f8fff, transparent: true, opacity: 0.5 + nb.strength * 0.5,
        });
        const tubeMesh = new THREE.Mesh(tubeGeo, tubeMat);
        constellationGroup.add(tubeMesh);

        // Floating label
        const canvas = document.createElement('canvas');
        canvas.width = 256; canvas.height = 48;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ccc';
        ctx.font = '20px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(nb.name, 128, 30);
        const tex = new THREE.CanvasTexture(canvas);
        const sMat = new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: 0.85 });
        const sprite = new THREE.Sprite(sMat);
        sprite.position.set(ep[0], ep[1] + 1.5, ep[2]);
        sprite.scale.set(10, 2, 1);
        constellationGroup.add(sprite);

        // Animated particle dot
        const pGeo = new THREE.SphereGeometry(0.18, 6, 6);
        const pMat = new THREE.MeshBasicMaterial({ color: 0x88ccff });
        const pMesh = new THREE.Mesh(pGeo, pMat);
        pMesh.userData = { isParticle: true, startPos: sp, endPos: ep, offset: Math.random() };
        pMesh.position.set(sp[0], sp[1], sp[2]);
        constellationGroup.add(pMesh);
      }
    }
  }, [selectedNode, selectedNodes, data]);

  // --- Taste filter ---
  useEffect(() => {
    const s = sceneRef.current;
    if (!s.iMesh || !s.nodeArr || !filterTaste) return;
    const { iMesh, nodeArr, defaultColors } = s;
    const dimCol = new THREE.Color(0x111118);
    for (let i = 0; i < nodeArr.length; i++) {
      const taste = (nodeArr[i].taste || '').toLowerCase();
      if (taste.includes(filterTaste.toLowerCase())) {
        iMesh.setColorAt(i, defaultColors[i]);
      } else {
        iMesh.setColorAt(i, dimCol);
      }
    }
    if (iMesh.instanceColor) iMesh.instanceColor.needsUpdate = true;
  }, [filterTaste]);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 pt-10"
      style={{ background: '#050510' }}
    />
  );
}
