import { useRef, useEffect, useCallback } from 'react';
import SceneManager from '../three/SceneManager.js';
import NodeMesh, { tasteMatches } from '../three/NodeMesh.js';
import EdgeMesh from '../three/EdgeMesh.js';
import ParticleSystem from '../three/ParticleSystem.js';
import * as THREE from 'three';
import { computeTastePositions } from '../data/tastePositioning.js';
import { createNodeLabel } from '../three/AxisLabels.js';

/**
 * React wrapper for the Three.js scene. Manages SceneManager lifecycle via refs.
 * Props:
 *   - data: { graph, positions, embeddings } from useFlavorData
 *   - onNodeClick: (node) => void
 *   - onNodeHover: (node) => void
 *   - selectedNode: string | null
 *   - showEdges: boolean
 *   - showParticles: boolean
 */
function NetworkScene({
  data,
  onNodeClick,
  onNodeHover,
  selectedNode,
  selectedNodes = [],
  showEdges = true,
  showParticles = true,
  filterCuisine = '',
  filterTaste = '',
  profileWeights = null,
  treeFilterIngredients = null,
  sceneExtras = null, // Additional Three.js objects to add to the scene
  showNodeLabels = false, // Show name labels on selected nodes
  labelNodeNames = null, // Additional node names to show labels for (e.g., filtered category)
  flyToTarget = null, // { position: [x,y,z], ts: number } — camera flies to that point, label-front
}) {
  const containerRef = useRef(null);
  const sceneRef = useRef(null);
  const nodeMeshRef = useRef(null);
  const edgeMeshRef = useRef(null);
  const nodeLabelGroupRef = useRef(null);
  const particleRef = useRef(null);
  const frameRef = useRef(null);

  // Initialize scene
  useEffect(() => {
    if (!containerRef.current || !data) return;

    const { graph } = data;
    let positions = data.positions;

    // Compute taste-axis positions if no pre-computed positions available
    if (!positions || !positions.positions) {
      positions = computeTastePositions(graph.nodes, graph.edges, 50);
    }

    const manager = new SceneManager();
    manager.init(containerRef.current);
    sceneRef.current = manager;

    // Create meshes
    const nodes = new NodeMesh({ nodes: graph.nodes, positions });
    const edges = new EdgeMesh({ edges: graph.edges, positions });
    const particles = new ParticleSystem({ edges: graph.edges, positions, nodes: graph.nodes });

    nodeMeshRef.current = nodes;
    edgeMeshRef.current = edges;
    particleRef.current = particles;

    manager.addToScene(nodes.getMesh());
    manager.addToScene(edges.getMesh());
    manager.addToScene(particles.getMesh());

    // Add any extra scene objects (e.g., axis labels)
    if (sceneExtras) {
      const extras = Array.isArray(sceneExtras) ? sceneExtras : [sceneExtras];
      for (const obj of extras) {
        if (obj) manager.addToScene(obj);
      }
    }

    // Set up raycasting
    manager.setRaycastTarget(nodes.getMesh());

    // Start render loop with particle updates
    const clock = { last: performance.now() };
    function animate() {
      frameRef.current = requestAnimationFrame(animate);
      const now = performance.now();
      const dt = (now - clock.last) / 1000;
      clock.last = now;
      if (particleRef.current) {
        particleRef.current.update(dt);
      }
    }

    manager.start();
    animate();

    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
      manager.dispose();
      nodes.dispose();
      edges.dispose();
      particles.dispose();
    };
  }, [data]);

  // Wire up click/hover callbacks
  useEffect(() => {
    const manager = sceneRef.current;
    const nodes = nodeMeshRef.current;
    if (!manager || !nodes) return;

    manager.onNodeClick((idx) => {
      if (onNodeClick) {
        const node = idx !== null ? nodes.getNodeAtIndex(idx) : null;
        onNodeClick(node);
      }
    });

    manager.onNodeHover((idx, mousePos) => {
      if (onNodeHover) {
        const node = idx !== null ? nodes.getNodeAtIndex(idx) : null;
        onNodeHover(node, mousePos);
      }
    });
  }, [data, onNodeClick, onNodeHover]);

  // Handle selection changes — activation spread (supports multiple nodes)
  useEffect(() => {
    const nodes = nodeMeshRef.current;
    const edges = edgeMeshRef.current;
    if (!nodes || !edges) return;

    nodes.resetActivations();
    edges.resetHighlights();
    if (particleRef.current) particleRef.current.resetHighlights();

    const activeNodes = selectedNodes.length > 0 ? selectedNodes : (selectedNode ? [selectedNode] : []);

    if (activeNodes.length > 0 && data) {
      // Progressive disclosure: show edges for the selected node even if
      // edges are globally hidden (e.g., on mobile). This reveals connections
      // contextually without overwhelming the full network view.
      if (!showEdges) {
        edges.setVisible(true);
      }

      // Build combined connected map from all selected nodes
      const connectedMap = new Map();
      for (const sel of activeNodes) {
        connectedMap.set(sel, 1.0);
        for (const edge of data.graph.edges) {
          if (edge.source === sel) {
            const prev = connectedMap.get(edge.target) || 0;
            connectedMap.set(edge.target, Math.max(prev, edge.strength));
          } else if (edge.target === sel) {
            const prev = connectedMap.get(edge.source) || 0;
            connectedMap.set(edge.source, Math.max(prev, edge.strength));
          }
        }
      }

      // Dim ALL nodes, edges, particles first
      nodes.dimAll();
      edges.dimAll();
      if (particleRef.current) particleRef.current.dimAll();

      // Brighten connected nodes proportional to strength
      for (const [name, strength] of connectedMap) {
        nodes.setActivation(name, strength);
      }

      // Brighten edges and particles for all selected nodes
      for (const sel of activeNodes) {
        edges.highlightEdgesFor(sel, 1.0);
        if (particleRef.current) particleRef.current.highlightFor(sel);
      }
    } else {
      // No selection: restore edge visibility to match the showEdges toggle
      if (edges) edges.setVisible(showEdges);
    }
  }, [selectedNode, selectedNodes, data, showEdges]);

  // Show/hide node name labels for selected nodes and/or explicitly labeled nodes
  useEffect(() => {
    const manager = sceneRef.current;
    if (!manager || !showNodeLabels || !data) return;

    // Remove previous labels
    if (nodeLabelGroupRef.current) {
      manager.removeFromScene(nodeLabelGroupRef.current);
      nodeLabelGroupRef.current = null;
    }

    // Combine selected nodes and explicit label names (deduplicated)
    const activeNodes = selectedNodes.length > 0 ? selectedNodes : (selectedNode ? [selectedNode] : []);
    const allLabelNames = new Set([...activeNodes, ...(labelNodeNames || [])]);
    if (allLabelNames.size === 0) return;

    const posMap = data.positions?.positions || data.positions || {};
    const labelGroup = new THREE.Group();

    for (const name of allLabelNames) {
      const pos = posMap[name];
      if (pos) {
        labelGroup.add(createNodeLabel(name, pos));
      }
    }

    manager.addToScene(labelGroup);
    nodeLabelGroupRef.current = labelGroup;
  }, [selectedNode, selectedNodes, data, showNodeLabels, labelNodeNames]);

  // Toggle visibility — but keep edges visible if a node is selected (progressive disclosure)
  useEffect(() => {
    if (!edgeMeshRef.current) return;
    const hasSelection = selectedNodes.length > 0 || !!selectedNode;
    edgeMeshRef.current.setVisible(showEdges || hasSelection);
  }, [showEdges, selectedNode, selectedNodes]);

  useEffect(() => {
    if (particleRef.current) particleRef.current.setVisible(showParticles);
  }, [showParticles]);

  // Apply cuisine/taste filters to nodes, edges, and particles
  useEffect(() => {
    const nodes = nodeMeshRef.current;
    const edges = edgeMeshRef.current;
    const particles = particleRef.current;
    if (!nodes) return;

    if (!filterCuisine && !filterTaste) {
      nodes.resetActivations();
      if (edges) edges.resetHighlights();
      if (particles) particles.resetHighlights();
    } else {
      nodes.applyFilter({ cuisine: filterCuisine, taste: filterTaste });

      // Compute the set of node names that match the filter
      if (data) {
        const activeNames = new Set();
        for (const [name, node] of data.graph.nodes) {
          let matches = true;
          if (filterCuisine) {
            matches = matches && node.cuisines && node.cuisines.some(
              c => c.toLowerCase().includes(filterCuisine.toLowerCase())
            );
          }
          if (filterTaste) {
            matches = matches && tasteMatches(node.taste, filterTaste);
          }
          if (matches) activeNames.add(name);
        }
        if (edges) edges.applyFilter(activeNames);
        if (particles) particles.applyFilter(activeNames);
      }
    }
  }, [filterCuisine, filterTaste, data]);

  // Apply tree-based ingredient filtering
  useEffect(() => {
    const nodes = nodeMeshRef.current;
    const edges = edgeMeshRef.current;
    const particles = particleRef.current;
    if (!nodes) return;

    if (!treeFilterIngredients) {
      // Only reset if no other filters are active
      if (!filterCuisine && !filterTaste) {
        nodes.resetActivations();
        if (edges) edges.resetHighlights();
        if (particles) particles.resetHighlights();
      }
      return;
    }

    const activeNames = new Set(treeFilterIngredients);
    nodes.applyFilter(null, activeNames);
    if (edges) edges.applyFilter(activeNames);
    if (particles) particles.applyFilter(activeNames);

    // Animate camera to focus on the centroid of filtered nodes
    if (data && sceneRef.current && treeFilterIngredients.length > 0) {
      // The Network view stamps node.position3D on each node; lab views
      // (Cocktail Codex, Sauce Lab) instead carry positions in
      // data.positions.positions[name]. Read whichever is present so
      // family-chip clicks land the camera in both places.
      const posMap = data?.positions?.positions || data?.positions || null;
      let cx = 0, cy = 0, cz = 0, count = 0;
      for (const [name, node] of data.graph.nodes) {
        if (!activeNames.has(name)) continue;
        const p = node.position3D || (posMap && posMap[name]);
        if (!p) continue;
        cx += p[0]; cy += p[1]; cz += p[2];
        count++;
      }
      if (count > 0) {
        cx /= count; cy /= count; cz /= count;
        const camera = sceneRef.current.getCamera();
        if (camera) {
          const startPos = { x: camera.position.x, y: camera.position.y, z: camera.position.z };
          const dist = Math.max(30, Math.sqrt(count) * 5);
          // Position the camera along the radial-OUTWARD direction
          // from the scene origin to the cluster centroid. The cluster
          // label sprite sits AT the centroid; landing radially outward
          // puts the label between the camera and the origin so it
          // reads as "in front of" the cluster every time. The previous
          // fixed `(+0.3x, +0.2y, +1z)` offset worked for centroids on
          // the +Z hemisphere but parked the camera between the cluster
          // and origin (i.e. behind the label) for clusters on the -Z
          // side of the Fibonacci sphere.
          const radialLen = Math.hypot(cx, cy, cz);
          let dirX, dirY, dirZ;
          if (radialLen > 0.001) {
            dirX = cx / radialLen;
            dirY = cy / radialLen;
            dirZ = cz / radialLen;
          } else {
            // Cluster sits at origin — fall back to the old offset.
            const fb = Math.hypot(0.3, 0.2, 1);
            dirX = 0.3 / fb; dirY = 0.2 / fb; dirZ = 1 / fb;
          }
          const targetPos = {
            x: cx + dirX * dist,
            y: cy + dirY * dist,
            z: cz + dirZ * dist,
          };
          const duration = 1200;
          const startTime = performance.now();
          function animateFly(now) {
            const t = Math.min((now - startTime) / duration, 1);
            const ease = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
            camera.position.set(
              startPos.x + (targetPos.x - startPos.x) * ease,
              startPos.y + (targetPos.y - startPos.y) * ease,
              startPos.z + (targetPos.z - startPos.z) * ease
            );
            camera.lookAt(cx, cy, cz);
            if (t < 1) requestAnimationFrame(animateFly);
          }
          requestAnimationFrame(animateFly);
        }
      }
    }
  }, [treeFilterIngredients, filterCuisine, filterTaste, data]);

  // Apply profile weights when in profile mode
  useEffect(() => {
    const nodes = nodeMeshRef.current;
    const edges = edgeMeshRef.current;
    if (!nodes || !edges) return;

    if (profileWeights && profileWeights.size > 0) {
      nodes.applyProfileWeights(profileWeights);
      edges.applyProfileWeights(profileWeights);
    } else {
      nodes.resetProfileWeights();
      edges.resetHighlights();
    }
  }, [profileWeights]);

  // Explicit fly-to-front-of-label (R10-66). The camera lands radially
  // outward from the scene origin past the label position so the label
  // sits between the viewer and the cluster body. Reuses the same
  // sqrt(memberCount) scaling as the tree-filter fly so distance
  // matches when both fire (e.g., CocktailLab tapping a family).
  useEffect(() => {
    const manager = sceneRef.current;
    if (!manager || !flyToTarget || !flyToTarget.position) return;
    const camera = manager.getCamera();
    if (!camera) return;
    const [cx, cy, cz] = flyToTarget.position;
    const memberCount = flyToTarget.memberCount || 1;
    const dist = Math.max(30, Math.sqrt(memberCount) * 5);
    const radialLen = Math.hypot(cx, cy, cz);
    let dirX, dirY, dirZ;
    if (radialLen > 0.001) {
      dirX = cx / radialLen; dirY = cy / radialLen; dirZ = cz / radialLen;
    } else {
      const fb = Math.hypot(0.3, 0.2, 1);
      dirX = 0.3 / fb; dirY = 0.2 / fb; dirZ = 1 / fb;
    }
    const startPos = { x: camera.position.x, y: camera.position.y, z: camera.position.z };
    const targetPos = { x: cx + dirX * dist, y: cy + dirY * dist, z: cz + dirZ * dist };
    const duration = 1200;
    const startTime = performance.now();
    function animateFly(now) {
      const t = Math.min((now - startTime) / duration, 1);
      const ease = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      camera.position.set(
        startPos.x + (targetPos.x - startPos.x) * ease,
        startPos.y + (targetPos.y - startPos.y) * ease,
        startPos.z + (targetPos.z - startPos.z) * ease,
      );
      camera.lookAt(cx, cy, cz);
      if (t < 1) requestAnimationFrame(animateFly);
    }
    requestAnimationFrame(animateFly);
  }, [flyToTarget]);

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      role="application"
      aria-label="Flavor network — 3D ingredient pairing graph. Use arrow keys to walk through pairings, Escape to clear selection, slash to search."
      style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0 }}
    />
  );
}

export default NetworkScene;
