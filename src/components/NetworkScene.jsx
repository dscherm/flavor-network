import { useRef, useEffect, useCallback } from 'react';
import SceneManager from '../three/SceneManager.js';
import NodeMesh from '../three/NodeMesh.js';
import EdgeMesh from '../three/EdgeMesh.js';
import ParticleSystem from '../three/ParticleSystem.js';

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
export default function NetworkScene({
  data,
  onNodeClick,
  onNodeHover,
  selectedNode,
  showEdges = true,
  showParticles = true,
  filterCuisine = '',
  filterTaste = '',
}) {
  const containerRef = useRef(null);
  const sceneRef = useRef(null);
  const nodeMeshRef = useRef(null);
  const edgeMeshRef = useRef(null);
  const particleRef = useRef(null);
  const frameRef = useRef(null);

  // Initialize scene
  useEffect(() => {
    if (!containerRef.current || !data) return;

    const { graph } = data;
    let positions = data.positions;

    // Fallback: generate random 3D positions if embeddings not trained yet
    if (!positions || !positions.positions) {
      const fallback = {};
      for (const [name, node] of graph.nodes) {
        const angle1 = Math.random() * Math.PI * 2;
        const angle2 = Math.random() * Math.PI * 2;
        const radius = 30 + Math.random() * 70;
        fallback[name] = [
          radius * Math.sin(angle1) * Math.cos(angle2),
          radius * Math.sin(angle1) * Math.sin(angle2),
          radius * Math.cos(angle1),
        ];
      }
      positions = { positions: fallback };
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

    manager.onNodeHover((idx) => {
      if (onNodeHover) {
        const node = idx !== null ? nodes.getNodeAtIndex(idx) : null;
        onNodeHover(node);
      }
    });
  }, [data, onNodeClick, onNodeHover]);

  // Handle selection changes — activation spread
  useEffect(() => {
    const nodes = nodeMeshRef.current;
    const edges = edgeMeshRef.current;
    if (!nodes || !edges) return;

    nodes.resetActivations();
    edges.resetHighlights();
    if (particleRef.current) particleRef.current.resetHighlights();

    if (selectedNode && data) {
      // Build set of connected node names + their strength
      const connectedMap = new Map();
      connectedMap.set(selectedNode, 1.0);

      for (const edge of data.graph.edges) {
        if (edge.source === selectedNode) {
          connectedMap.set(edge.target, edge.strength);
        } else if (edge.target === selectedNode) {
          connectedMap.set(edge.source, edge.strength);
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

      // Brighten only edges and particles connected to selected node
      edges.highlightEdgesFor(selectedNode, 1.0);
      if (particleRef.current) particleRef.current.highlightFor(selectedNode);
    }
  }, [selectedNode, data]);

  // Toggle visibility
  useEffect(() => {
    if (edgeMeshRef.current) edgeMeshRef.current.setVisible(showEdges);
  }, [showEdges]);

  useEffect(() => {
    if (particleRef.current) particleRef.current.setVisible(showParticles);
  }, [showParticles]);

  // Apply cuisine/taste filters
  useEffect(() => {
    const nodes = nodeMeshRef.current;
    if (!nodes) return;

    if (!filterCuisine && !filterTaste) {
      nodes.resetActivations();
    } else {
      nodes.applyFilter({ cuisine: filterCuisine, taste: filterTaste });
    }
  }, [filterCuisine, filterTaste]);

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0 }}
    />
  );
}
