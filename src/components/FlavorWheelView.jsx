import { useRef, useEffect } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

const TASTE_SECTORS = [
  { name: 'sweet',      color: 0xff6b9d },
  { name: 'sour',       color: 0x4ecdc4 },
  { name: 'bitter',     color: 0x9b59b6 },
  { name: 'salty',      color: 0x3498db },
  { name: 'umami',      color: 0xf39c12 },
  { name: 'spicy',      color: 0xe74c3c },
  { name: 'pungent',    color: 0xe67e22 },
  { name: 'astringent', color: 0x1abc9c },
];

const SECTOR_ANGLE = (Math.PI * 2) / TASTE_SECTORS.length;
const WHEEL_RADIUS = 50;
const MAX_ARCS = 5000;

function tasteAngle(tasteName) {
  const idx = TASTE_SECTORS.findIndex(s => s.name === tasteName);
  return idx >= 0 ? idx * SECTOR_ANGLE : 0;
}

function parseTastes(tasteStr) {
  if (!tasteStr) return [];
  return tasteStr.toLowerCase().split(/\s+/).filter(t =>
    TASTE_SECTORS.some(s => s.name === t)
  );
}

function sectorColor(tasteName) {
  const s = TASTE_SECTORS.find(s => s.name === tasteName);
  return s ? s.color : 0x4f8fff;
}

function makeTextSprite(text, color) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  ctx.font = 'bold 28px sans-serif';
  ctx.fillStyle = '#' + color.toString(16).padStart(6, '0');
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text.toUpperCase(), 128, 32);
  const tex = new THREE.CanvasTexture(canvas);
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(12, 3, 1);
  return sprite;
}

export default function FlavorWheelView({
  data,
  onNodeClick,
  selectedNode,
  selectedNodes = [],
  filterTaste = '',
}) {
  const containerRef = useRef(null);
  const stateRef = useRef(null);

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
    scene.background = new THREE.Color(0x0a0a0f);

    const camera = new THREE.PerspectiveCamera(
      55, container.clientWidth / container.clientHeight, 0.1, 1000
    );
    camera.position.set(0, 70, 70);
    camera.lookAt(0, 0, 0);

    // Post-processing
    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    composer.addPass(new UnrealBloomPass(
      new THREE.Vector2(container.clientWidth, container.clientHeight),
      1.2, 0.4, 0.8
    ));

    // Lighting
    scene.add(new THREE.AmbientLight(0x404060, 1.0));
    const p1 = new THREE.PointLight(0x4f8fff, 2.0, 300);
    p1.position.set(30, 60, 50);
    scene.add(p1);
    const p2 = new THREE.PointLight(0xff6b9d, 1.5, 300);
    p2.position.set(-40, 40, -30);
    scene.add(p2);

    // Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.minDistance = 20;
    controls.maxDistance = 200;

    // --- Wheel sectors ---
    const wheelGroup = new THREE.Group();
    for (let i = 0; i < TASTE_SECTORS.length; i++) {
      const { name, color } = TASTE_SECTORS[i];
      const startA = i * SECTOR_ANGLE - Math.PI / 2;
      const shape = new THREE.Shape();
      shape.moveTo(0, 0);
      const segments = 32;
      for (let s = 0; s <= segments; s++) {
        const a = startA + (s / segments) * SECTOR_ANGLE;
        shape.lineTo(Math.cos(a) * WHEEL_RADIUS, Math.sin(a) * WHEEL_RADIUS);
      }
      shape.lineTo(0, 0);
      const geo = new THREE.ShapeGeometry(shape);
      const mat = new THREE.MeshBasicMaterial({
        color, transparent: true, opacity: 0.25, side: THREE.DoubleSide,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.rotation.x = -Math.PI / 2;
      wheelGroup.add(mesh);

      // Label
      const labelAngle = startA + SECTOR_ANGLE / 2;
      const sprite = makeTextSprite(name, color);
      sprite.position.set(
        Math.cos(labelAngle) * (WHEEL_RADIUS + 6),
        1,
        Math.sin(labelAngle) * (WHEEL_RADIUS + 6)
      );
      wheelGroup.add(sprite);
    }
    scene.add(wheelGroup);

    // --- Compute node positions ---
    const nodeArray = [...nodes.values()];
    const maxPairings = Math.max(1, ...nodeArray.map(n => n.pairingCount));
    const nodePositions = new Map();

    for (const node of nodeArray) {
      const tastes = parseTastes(node.taste);
      let angle = 0;
      if (tastes.length > 0) {
        // Average angle for multi-taste (handle wraparound via vector sum)
        let sx = 0, sy = 0;
        for (const t of tastes) {
          const a = tasteAngle(t) - Math.PI / 2;
          sx += Math.cos(a);
          sy += Math.sin(a);
        }
        angle = Math.atan2(sy, sx);
      } else {
        angle = Math.random() * Math.PI * 2;
      }
      // Jitter within sector
      angle += (Math.random() - 0.5) * SECTOR_ANGLE * 0.6;

      // Radial: high pairings near center
      const normPairings = node.pairingCount / maxPairings;
      const radius = WHEEL_RADIUS * 0.15 + WHEEL_RADIUS * 0.8 * (1 - normPairings);

      nodePositions.set(node.name, {
        x: Math.cos(angle) * radius,
        y: 0.5,
        z: Math.sin(angle) * radius,
      });
    }

    // --- Instanced nodes ---
    const nodeGeo = new THREE.SphereGeometry(1, 12, 8);
    const nodeMat = new THREE.MeshStandardMaterial({
      emissive: 0x4f8fff, emissiveIntensity: 0.6, roughness: 0.3, metalness: 0.2,
    });
    const instancedMesh = new THREE.InstancedMesh(nodeGeo, nodeMat, nodeArray.length);
    instancedMesh.frustumCulled = false;

    const dummy = new THREE.Object3D();
    const colorAttr = new THREE.Color();
    const nameIndex = []; // instanceId -> node name

    for (let i = 0; i < nodeArray.length; i++) {
      const node = nodeArray[i];
      const pos = nodePositions.get(node.name);
      const size = Math.min(1.5, Math.max(0.2, Math.sqrt(node.pairingCount) * 0.12));
      dummy.position.set(pos.x, pos.y, pos.z);
      dummy.scale.setScalar(size);
      dummy.updateMatrix();
      instancedMesh.setMatrixAt(i, dummy.matrix);

      const tastes = parseTastes(node.taste);
      if (tastes.length > 0) {
        const c = new THREE.Color(sectorColor(tastes[0]));
        for (let t = 1; t < tastes.length; t++) {
          c.lerp(new THREE.Color(sectorColor(tastes[t])), 1 / (t + 1));
        }
        instancedMesh.setColorAt(i, c);
      } else {
        instancedMesh.setColorAt(i, colorAttr.set(0x4f8fff));
      }
      nameIndex.push(node.name);
    }
    instancedMesh.instanceMatrix.needsUpdate = true;
    instancedMesh.instanceColor.needsUpdate = true;
    scene.add(instancedMesh);

    // --- Pairing arcs ---
    const sortedEdges = [...edges].sort((a, b) => b.strength - a.strength).slice(0, MAX_ARCS);
    const arcSegments = 20;
    const arcPositions = [];
    const arcColors = [];

    for (const edge of sortedEdges) {
      const posA = nodePositions.get(edge.source);
      const posB = nodePositions.get(edge.target);
      if (!posA || !posB) continue;

      const nodeA = nodes.get(edge.source);
      const nodeB = nodes.get(edge.target);
      const tastesA = parseTastes(nodeA?.taste);
      const tastesB = parseTastes(nodeB?.taste);
      const cA = new THREE.Color(tastesA.length > 0 ? sectorColor(tastesA[0]) : 0x4f8fff);
      const cB = new THREE.Color(tastesB.length > 0 ? sectorColor(tastesB[0]) : 0x4f8fff);

      const arcH = edge.strength * 15 + 2;

      for (let s = 0; s < arcSegments; s++) {
        const t0 = s / arcSegments;
        const t1 = (s + 1) / arcSegments;
        for (const t of [t0, t1]) {
          const x = posA.x + (posB.x - posA.x) * t;
          const z = posA.z + (posB.z - posA.z) * t;
          const parabola = 4 * t * (1 - t);
          const y = 0.5 + arcH * parabola;
          arcPositions.push(x, y, z);
          const blended = cA.clone().lerp(cB, t);
          arcColors.push(blended.r, blended.g, blended.b);
        }
      }
    }

    const arcGeo = new THREE.BufferGeometry();
    arcGeo.setAttribute('position', new THREE.Float32BufferAttribute(arcPositions, 3));
    arcGeo.setAttribute('color', new THREE.Float32BufferAttribute(arcColors, 3));
    const arcMat = new THREE.LineBasicMaterial({
      vertexColors: true, transparent: true, opacity: 0.1, depthWrite: false,
    });
    const arcMesh = new THREE.LineSegments(arcGeo, arcMat);
    scene.add(arcMesh);

    // Store original arc colors for selection reset
    const origArcColors = new Float32Array(arcColors);

    // Build edge index for highlighting: edgeName -> [startVertexIndex, count]
    const edgeVertexIndex = new Map();
    let vtxOffset = 0;
    for (const edge of sortedEdges) {
      if (!nodePositions.has(edge.source) || !nodePositions.has(edge.target)) continue;
      const key = edge.source < edge.target
        ? edge.source + '|' + edge.target
        : edge.target + '|' + edge.source;
      edgeVertexIndex.set(key, { start: vtxOffset, count: arcSegments * 2 });
      vtxOffset += arcSegments * 2;
    }

    // --- Raycasting ---
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    function onClick(event) {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(mouse, camera);
      const hits = raycaster.intersectObject(instancedMesh);
      if (hits.length > 0) {
        const name = nameIndex[hits[0].instanceId];
        const node = nodes.get(name);
        if (onNodeClick && node) onNodeClick(node);
      } else {
        if (onNodeClick) onNodeClick(null);
      }
    }
    renderer.domElement.addEventListener('click', onClick);

    // Cursor
    let lastHover = -1;
    function onMouseMove(event) {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(mouse, camera);
      const hits = raycaster.intersectObject(instancedMesh);
      const idx = hits.length > 0 ? hits[0].instanceId : -1;
      if (idx !== lastHover) {
        lastHover = idx;
        renderer.domElement.style.cursor = idx >= 0 ? 'pointer' : 'default';
      }
    }
    renderer.domElement.addEventListener('mousemove', onMouseMove);

    // --- Resize ---
    function onResize() {
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      composer.setSize(w, h);
    }
    window.addEventListener('resize', onResize);

    // --- Animate ---
    let running = true;
    function animate() {
      if (!running) return;
      requestAnimationFrame(animate);
      controls.update();
      composer.render();
    }
    animate();

    stateRef.current = {
      renderer, scene, camera, controls, composer,
      instancedMesh, arcMesh, arcGeo, nameIndex, nodePositions,
      edgeVertexIndex, sortedEdges, nodes, origArcColors,
    };

    return () => {
      running = false;
      window.removeEventListener('resize', onResize);
      renderer.domElement.removeEventListener('click', onClick);
      renderer.domElement.removeEventListener('mousemove', onMouseMove);
      controls.dispose();
      composer.dispose();
      renderer.dispose();
      if (renderer.domElement.parentElement) {
        renderer.domElement.parentElement.removeChild(renderer.domElement);
      }
    };
  }, [data]);

  // --- Selection highlighting ---
  useEffect(() => {
    const st = stateRef.current;
    if (!st || !data) return;
    const { arcGeo, arcMesh, edgeVertexIndex, sortedEdges, origArcColors } = st;
    const colAttr = arcGeo.getAttribute('color');
    const colors = colAttr.array;
    const activeList = selectedNodes.length > 0 ? selectedNodes : (selectedNode ? [selectedNode] : []);
    const activeSet = new Set(activeList);

    if (activeSet.size === 0) {
      // Restore original colors and default opacity
      colors.set(origArcColors);
      colAttr.needsUpdate = true;
      arcMesh.material.opacity = 0.1;
      arcMesh.material.needsUpdate = true;
      return;
    }

    // Dim all arcs by darkening colors from originals
    for (let i = 0; i < colors.length; i++) {
      colors[i] = origArcColors[i] * 0.15;
    }

    // Brighten arcs connected to active nodes
    for (const edge of sortedEdges) {
      if (!activeSet.has(edge.source) && !activeSet.has(edge.target)) continue;
      const key = edge.source < edge.target
        ? edge.source + '|' + edge.target
        : edge.target + '|' + edge.source;
      const info = edgeVertexIndex.get(key);
      if (!info) continue;
      for (let v = 0; v < info.count; v++) {
        const ci = (info.start + v) * 3;
        colors[ci] = origArcColors[ci] * 2.5;
        colors[ci + 1] = origArcColors[ci + 1] * 2.5;
        colors[ci + 2] = origArcColors[ci + 2] * 2.5;
      }
    }
    colAttr.needsUpdate = true;
    arcMesh.material.opacity = 0.3;
    arcMesh.material.needsUpdate = true;
  }, [selectedNode, selectedNodes, data]);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 pt-10"
      style={{ width: '100%', height: '100%' }}
    />
  );
}
