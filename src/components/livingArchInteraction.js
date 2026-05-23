import * as THREE from 'three';

const _mouse = new THREE.Vector2();

/**
 * Raycast against taste label sprites and instanced node mesh.
 * Returns { type: 'label', taste } | { type: 'node', instanceId } | { type: 'none' }.
 */
export function raycastLabels(event, camera, renderer, labelSprites, mesh, raycaster) {
  const rect = renderer.domElement.getBoundingClientRect();
  _mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  _mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(_mouse, camera);
  // Check taste label sprites first
  const labelHits = raycaster.intersectObjects(labelSprites);
  if (labelHits.length > 0) {
    return { type: 'label', taste: labelHits[0].object.userData.taste };
  }
  // Then check instanced mesh
  const meshHits = raycaster.intersectObject(mesh);
  if (meshHits.length > 0) {
    return { type: 'node', instanceId: meshHits[0].instanceId };
  }
  return { type: 'none' };
}

/**
 * Handle click on the scene canvas.
 * @param {MouseEvent} event
 * @param {THREE.Camera} camera
 * @param {THREE.WebGLRenderer} renderer
 * @param {THREE.Sprite[]} labelSprites - array of taste label sprites
 * @param {THREE.InstancedMesh} mesh
 * @param {Array} nodeArray
 * @param {THREE.Raycaster} raycaster
 * @param {Object} callbacks - { onNodeClick, handleTasteClick, tasteSelection }
 */
export function handleSceneClick(event, camera, renderer, labelSprites, mesh, nodeArray, raycaster, callbacks) {
  const { onNodeClick, handleTasteClick, tasteSelection, mode } = callbacks;
  // In Network modes (ml / ml2d) the taste labels are visually hidden
  // and taste-driven translation of ingredients is confusing. Treat any
  // raycast as a node/empty click; skip the label path.
  const skipLabelInteraction = mode === 'ml' || mode === 'ml2d';
  const hit = raycastLabels(
    event, camera, renderer,
    skipLabelInteraction ? [] : labelSprites,
    mesh, raycaster,
  );

  if (hit.type === 'label') {
    handleTasteClick(hit.taste);
    return;
  }
  if (hit.type === 'node') {
    // If taste selection is active, clear it
    if (tasteSelection.taste1 !== null && !tasteSelection.animating) {
      tasteSelection.animDirection = -1;
      tasteSelection.animating = true;
      tasteSelection.animStartTime = performance.now();
    }
    if (onNodeClick) onNodeClick(nodeArray[hit.instanceId], { x: event.clientX, y: event.clientY });
    return;
  }
  // Clicked empty space
  if (tasteSelection.taste1 !== null && !tasteSelection.animating) {
    tasteSelection.animDirection = -1;
    tasteSelection.animating = true;
    tasteSelection.animStartTime = performance.now();
  }
  if (onNodeClick) onNodeClick(null, null);
}

/**
 * Handle mousemove on the scene canvas — update cursor style.
 * @param {MouseEvent} event
 * @param {THREE.Camera} camera
 * @param {THREE.WebGLRenderer} renderer
 * @param {THREE.Sprite[]} labelSprites
 * @param {THREE.InstancedMesh} mesh
 * @param {THREE.Raycaster} raycaster
 * @param {Object} hoverState - mutable { lastHover, lastHoverType } object
 */
export function handleSceneMove(event, camera, renderer, labelSprites, mesh, raycaster, hoverState, callbacks) {
  const mode = callbacks?.mode;
  const skipLabelInteraction = mode === 'ml' || mode === 'ml2d';
  const hit = raycastLabels(
    event, camera, renderer,
    skipLabelInteraction ? [] : labelSprites,
    mesh, raycaster,
  );
  const newType = hit.type;
  const newId = hit.type === 'node' ? hit.instanceId : (hit.type === 'label' ? hit.taste : -1);
  const curId = hoverState.lastHoverType === 'node' ? hoverState.lastHover : (hoverState.lastHoverType === 'label' ? hoverState.lastHover : -1);
  if (newType !== hoverState.lastHoverType || newId !== curId) {
    hoverState.lastHoverType = newType;
    hoverState.lastHover = newId;
    renderer.domElement.style.cursor = (newType === 'node' || newType === 'label') ? 'pointer' : 'default';
    if (callbacks?.onNodeHover) {
      if (newType === 'node') {
        callbacks.onNodeHover(newId, { x: event.clientX, y: event.clientY });
      } else {
        callbacks.onNodeHover(null, null);
      }
    }
  }
}
