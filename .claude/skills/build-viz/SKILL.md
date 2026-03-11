# Skill: /build-viz

Build or rebuild the Three.js visualization pipeline.

## Phases
1. **Data Check** — Verify data/loader.js exports parsed ingredients, pairings, cuisines
2. **Scene Setup** — Ensure SceneManager.js initializes scene, camera, renderer, controls
3. **Nodes** — Build/update NodeMesh.js with InstancedMesh from ingredient data
4. **Edges** — Build/update EdgeMesh.js with BufferGeometry from pairing data
5. **Effects** — Ensure ShaderMaterials.js + post-processing pipeline works
6. **Integration** — Verify NetworkScene.jsx mounts SceneManager and passes data
7. **Validate** — Run build gate, check for errors

## Usage
```
/build-viz
```
