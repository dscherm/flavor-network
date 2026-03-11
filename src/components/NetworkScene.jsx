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

    const { graph, positions } = data;
    if (!positions) return;

    const manager = new SceneManager();
    manager.init(containerRef.current);
    sceneRef.current = manager;

    // Create meshes
    const nodes = new NodeMesh({ nodes: graph.nodes, positions });
    const edges = new EdgeMesh({ edges: graph.edges, positions });
    const particles = new ParticleSystem({ edges: graph.edges, positions });

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

    if (selectedNode && data) {
      // Activate selected node
      nodes.setActivation(selectedNode, 1.0);

      // Activate connected nodes based on edge strength
      for (const edge of data.graph.edges) {
        if (edge.source === selectedNode) {
          nodes.setActivation(edge.target, edge.strength * 0.7);
        } else if (edge.target === selectedNode) {
          nodes.setActivation(edge.source, edge.strength * 0.7);
        }
      }

      edges.highlightEdgesFor(selectedNode, 1.0);
    }
  }, [selectedNode, data]);

  // Toggle visibility
  useEffect(() => {
    if (edgeMeshRef.current) edgeMeshRef.current.setVisible(showEdges);
  }, [showEdges]);

  useEffect(() => {
    if (particleRef.current) particleRef.current.setVisible(showParticles);
  }, [showParticles]);

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0 }}
    />
  );
}
