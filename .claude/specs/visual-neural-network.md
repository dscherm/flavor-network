# Spec: Visual Neural Network Rendering

## Overview
Render ingredient-pairing data as a 3D neural network using Three.js + WebGL.

## Requirements

### Node Rendering
- Each ingredient is a sphere (InstancedMesh for performance)
- Size scales with number of pairings (more pairings = larger node)
- Color encodes primary cuisine cluster (HSL hue mapped to cuisine index)
- Glow effect via custom shader + UnrealBloomPass post-processing
- On hover: node brightens, name tooltip appears
- On click: node "activates" — pulses, connected nodes light up

### Edge Rendering
- Each pairing is a line segment between two ingredient nodes
- Opacity/thickness encodes pairing strength (if available) or defaults to uniform
- Animated particles flow along edges when source node is selected (synapse firing)
- Edges hidden by default for performance, shown on selection or filter

### Camera & Controls
- PerspectiveCamera with OrbitControls (rotate, zoom, pan)
- Fly-to animation when selecting ingredient from search
- Initial camera position shows full graph overview
- Keyboard: scroll to zoom, drag to rotate, shift+drag to pan

### Post-Processing
- UnrealBloomPass: strength 1.5, radius 0.4, threshold 0.8
- Optional FXAA anti-aliasing
- Dark background (#0a0a0f) to make glow pop

### Performance Targets
- 60fps with 400 nodes visible
- Use InstancedMesh (not individual meshes) for nodes
- Use BufferGeometry for all edges
- Frustum culling enabled
- LOD: reduce particle count for distant nodes
