import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

/**
 * MoleculeViewer3D — interactive ball-and-stick molecular viewer.
 *
 * Renders atoms as colored spheres and bonds as cylinders. Users can
 * rotate/zoom with OrbitControls. Tap/hover atoms to see their element
 * and functional group membership.
 *
 * Inspired by PhET's Build a Molecule and Molecule Shapes simulations.
 */

const ELEMENT_RADIUS = {
  C: 0.4, N: 0.38, O: 0.35, S: 0.5, H: 0.25, F: 0.3,
  Cl: 0.45, Br: 0.5, P: 0.45, I: 0.55, Na: 0.5, default: 0.35,
};

export default function MoleculeViewer3D({ moleculeData, predictions, tasks }) {
  const containerRef = useRef(null);
  const sceneRef = useRef(null);
  const [tooltip, setTooltip] = useState(null);
  const [activeGroup, setActiveGroup] = useState(null);

  useEffect(() => {
    if (!containerRef.current || !moleculeData?.atoms?.length) return;

    const el = containerRef.current;
    const w = el.clientWidth;
    const h = 300;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0a0f);

    const camera = new THREE.PerspectiveCamera(50, w / h, 0.1, 100);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
    el.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.1;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 1.5;

    // Lighting
    scene.add(new THREE.AmbientLight(0x404060, 2));
    const dirLight = new THREE.DirectionalLight(0xffffff, 1.5);
    dirLight.position.set(5, 5, 5);
    scene.add(dirLight);

    const atoms = moleculeData.atoms;
    const bonds = moleculeData.bonds || [];

    // Center the molecule
    let cx = 0, cy = 0, cz = 0;
    for (const a of atoms) { cx += a.x; cy += a.y; cz += a.z; }
    cx /= atoms.length; cy /= atoms.length; cz /= atoms.length;

    // Atom spheres
    const atomMeshes = [];
    const sphereGeo = new THREE.SphereGeometry(1, 24, 24);
    for (let i = 0; i < atoms.length; i++) {
      const a = atoms[i];
      const r = ELEMENT_RADIUS[a.element] || ELEMENT_RADIUS.default;
      const mat = new THREE.MeshPhongMaterial({
        color: new THREE.Color(a.color || '#cccccc'),
        shininess: 80,
        transparent: true,
        opacity: 0.9,
      });
      const mesh = new THREE.Mesh(sphereGeo, mat);
      mesh.scale.setScalar(r);
      mesh.position.set(a.x - cx, a.y - cy, a.z - cz);
      mesh.userData = { atomIdx: i, element: a.element };
      scene.add(mesh);
      atomMeshes.push(mesh);
    }

    // Bond cylinders
    const bondGeo = new THREE.CylinderGeometry(0.08, 0.08, 1, 8);
    const bondMat = new THREE.MeshPhongMaterial({ color: 0x666688, shininess: 30 });
    for (const b of bonds) {
      const a1 = atoms[b.from];
      const a2 = atoms[b.to];
      if (!a1 || !a2) continue;
      const p1 = new THREE.Vector3(a1.x - cx, a1.y - cy, a1.z - cz);
      const p2 = new THREE.Vector3(a2.x - cx, a2.y - cy, a2.z - cz);
      const mid = p1.clone().add(p2).multiplyScalar(0.5);
      const len = p1.distanceTo(p2);
      const dir = p2.clone().sub(p1).normalize();

      for (let offset = 0; offset < (b.order || 1); offset++) {
        const mesh = new THREE.Mesh(bondGeo, bondMat.clone());
        mesh.position.copy(mid);
        if (offset > 0) {
          const perp = new THREE.Vector3(0, 1, 0).cross(dir).normalize();
          mesh.position.add(perp.multiplyScalar(0.12 * offset));
        }
        mesh.scale.set(1, len, 1);
        mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
        scene.add(mesh);
      }
    }

    // Camera framing
    let maxDist = 0;
    for (const a of atoms) {
      const d = Math.sqrt((a.x - cx) ** 2 + (a.y - cy) ** 2 + (a.z - cz) ** 2);
      if (d > maxDist) maxDist = d;
    }
    camera.position.set(0, 0, maxDist * 3 + 4);
    controls.target.set(0, 0, 0);

    // Raycaster for hover/click
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    function onPointerMove(event) {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(mouse, camera);
      const hits = raycaster.intersectObjects(atomMeshes);

      // Reset glow
      atomMeshes.forEach((m) => { m.material.emissive?.setHex(0x000000); });

      if (hits.length > 0) {
        const mesh = hits[0].object;
        const idx = mesh.userData.atomIdx;
        const atom = atoms[idx];
        mesh.material.emissive?.setHex(0x444466);
        renderer.domElement.style.cursor = 'pointer';

        // Find functional groups containing this atom
        const groups = (moleculeData.functional_groups || [])
          .filter(g => g.atoms.includes(idx));

        setTooltip({
          x: event.clientX,
          y: event.clientY,
          element: atom.element,
          groups,
        });
      } else {
        renderer.domElement.style.cursor = 'grab';
        setTooltip(null);
      }
    }

    function onClick(event) {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(mouse, camera);
      const hits = raycaster.intersectObjects(atomMeshes);

      if (hits.length > 0) {
        const idx = hits[0].object.userData.atomIdx;
        const groups = (moleculeData.functional_groups || [])
          .filter(g => g.atoms.includes(idx));
        if (groups.length > 0) {
          setActiveGroup(prev => prev?.label === groups[0].label ? null : groups[0]);
          // Highlight all atoms in the group
          atomMeshes.forEach(m => { m.material.emissive?.setHex(0x000000); m.material.opacity = 0.9; });
          for (const aidx of groups[0].atoms) {
            if (atomMeshes[aidx]) {
              atomMeshes[aidx].material.emissive?.setHex(0x884488);
              atomMeshes[aidx].material.opacity = 1.0;
            }
          }
        }
      } else {
        setActiveGroup(null);
        atomMeshes.forEach(m => { m.material.emissive?.setHex(0x000000); m.material.opacity = 0.9; });
      }
    }

    renderer.domElement.addEventListener('pointermove', onPointerMove);
    renderer.domElement.addEventListener('click', onClick);

    let running = true;
    function animate() {
      if (!running) return;
      requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    }
    animate();
    sceneRef.current = { renderer, scene, camera, controls };

    return () => {
      running = false;
      renderer.domElement.removeEventListener('pointermove', onPointerMove);
      renderer.domElement.removeEventListener('click', onClick);
      controls.dispose();
      renderer.dispose();
      if (el.contains(renderer.domElement)) el.removeChild(renderer.domElement);
      sceneRef.current = null;
    };
  }, [moleculeData]);

  if (!moleculeData?.atoms?.length) {
    return <div className="text-xs text-gray-500 p-3">No 3D structure available</div>;
  }

  return (
    <div className="relative">
      <div ref={containerRef} className="w-full rounded overflow-hidden" style={{ height: 300 }} />

      {/* Atom tooltip */}
      {tooltip && (
        <div
          className="fixed z-[70] px-2 py-1 rounded bg-[#0d0d16]/95 border border-cyan-500/40 text-xs text-white pointer-events-none"
          style={{ left: tooltip.x + 12, top: tooltip.y - 30 }}
        >
          <span className="font-bold">{tooltip.element}</span>
          {tooltip.groups.length > 0 && (
            <span className="text-gray-400 ml-1">— {tooltip.groups[0].label}</span>
          )}
        </div>
      )}

      {/* Active functional group explanation */}
      {activeGroup && (
        <div className="mt-2 p-2 bg-purple-900/20 border border-purple-500/30 rounded text-xs">
          <div className="text-purple-300 font-medium">{activeGroup.label}</div>
          <div className="text-gray-400 mt-0.5">{activeGroup.relevance}</div>
        </div>
      )}

      {/* Legend */}
      <div className="flex gap-3 flex-wrap text-[10px] text-gray-500 mt-2">
        <span>Rotate: drag</span>
        <span>Zoom: scroll</span>
        <span>Tap atom: see functional group</span>
      </div>
    </div>
  );
}
