import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

/**
 * Device-capability check: returns true for devices where bloom
 * post-processing is too expensive (~1fps on iPhone 13 per simulation).
 * Override with localStorage keys 'fn.forceBloom' (force on) or
 * 'fn.disableBloom' (force off) for manual testing.
 */
function isLowEndForBloom() {
  try {
    if (typeof localStorage !== 'undefined') {
      if (localStorage.getItem('fn.forceBloom') === '1') return false;
      if (localStorage.getItem('fn.disableBloom') === '1') return true;
      // Unified mobile-quality override — when set, treats device as low-end
      // across ParticleSystem + SceneManager + any other GPU-sensitive path.
      if (localStorage.getItem('fn.forceMobileQuality') === '1') return true;
    }
  } catch {
    // private mode / SSR — ignore
  }
  if (typeof navigator === 'undefined' || typeof window === 'undefined') {
    return false;
  }
  // Heuristic: low deviceMemory, coarse pointer (touch), or small viewport.
  const memory = navigator.deviceMemory;
  if (typeof memory === 'number' && memory > 0 && memory < 4) return true;
  const coarse = typeof window.matchMedia === 'function'
    && window.matchMedia('(pointer: coarse)').matches;
  const narrow = typeof window.innerWidth === 'number' && window.innerWidth < 768;
  if (coarse && narrow) return true;
  const mobileUA = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent || '');
  if (mobileUA && narrow) return true;
  return false;
}

class SceneManager {
  constructor(canvas) {
    this._canvas = canvas;
    this._scene = null;
    this._camera = null;
    this._renderer = null;
    this._controls = null;
    this._clock = null;
    this._animationFrameId = null;
    this._running = false;
    this._composer = null;
    this._bloomPass = null;
    this._resizeHandler = this.resize.bind(this);
    this._raycaster = new THREE.Raycaster();
    this._mouse = new THREE.Vector2();
    this._raycastTarget = null; // set to an InstancedMesh for node picking
    this._onNodeClick = null;
    this._onNodeHover = null;
    this._hoveredIndex = -1;

    // Adaptive quality state — the monitor watches FPS and degrades
    // or restores one tier at a time. Tier 0 is the initial config.
    // Tier 1: halve DPR. Tier 2: also disable bloom. Tier 3: also
    // emit an 'adaptive-quality:degrade' event for ParticleSystem.
    this._qualityTier = 0;
    this._qualityMaxTier = 3;
    this._fpsSampleSum = 0;
    this._fpsSampleCount = 0;
    this._fpsLowStreakMs = 0;
    this._fpsHighStreakMs = 0;
    this._qualityDegradeMs = 2000;
    this._qualityRestoreMs = 5000;
    this._qualityDegradeFps = 25;
    this._qualityRestoreFps = 45;
    this._adaptiveQualityEnabled = true;
  }

  init(container) {
    const target = container || this._canvas;

    // Scene
    this._scene = new THREE.Scene();
    this._scene.background = new THREE.Color(0x0a0a0f);

    // Camera
    const aspect = target.clientWidth / target.clientHeight;
    this._camera = new THREE.PerspectiveCamera(60, aspect, 0.1, 2000);
    this._camera.position.set(0, 0, 120);
    this._camera.lookAt(0, 0, 0);

    // Renderer
    const isCanvas = target instanceof HTMLCanvasElement;
    this._renderer = new THREE.WebGLRenderer({
      canvas: isCanvas ? target : undefined,
      antialias: true,
      alpha: true,
      logarithmicDepthBuffer: true,
    });
    this._renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
    this._renderer.setSize(target.clientWidth, target.clientHeight);

    if (!isCanvas) {
      target.appendChild(this._renderer.domElement);
    }

    // Post-processing
    const width = target.clientWidth;
    const height = target.clientHeight;
    this._composer = new EffectComposer(this._renderer);
    this._composer.addPass(new RenderPass(this._scene, this._camera));

    // Skip bloom on low-end devices — UnrealBloomPass is the dominant
    // cost on iPhone 13 (FPS drops to ~1.2 with bloom on per simulation).
    this._bloomEnabled = !isLowEndForBloom();
    if (this._bloomEnabled) {
      this._bloomPass = new UnrealBloomPass(
        new THREE.Vector2(width, height),
        1.5,
        0.4,
        0.85
      );
      this._composer.addPass(this._bloomPass);
    }

    // Lighting — required for MeshStandardMaterial
    const ambientLight = new THREE.AmbientLight(0x404060, 1.0);
    this._scene.add(ambientLight);

    const pointLight1 = new THREE.PointLight(0x4f8fff, 2.0, 500);
    pointLight1.position.set(50, 80, 100);
    this._scene.add(pointLight1);

    const pointLight2 = new THREE.PointLight(0xff6b9d, 1.5, 500);
    pointLight2.position.set(-80, -50, -60);
    this._scene.add(pointLight2);

    // Controls
    this._controls = new OrbitControls(this._camera, this._renderer.domElement);
    this._controls.enableDamping = true;
    this._controls.dampingFactor = 0.05;
    this._controls.minDistance = 10;
    this._controls.maxDistance = 300;

    // Clock
    this._clock = new THREE.Clock();

    // Resize listener
    window.addEventListener('resize', this._resizeHandler);

    // Raycasting events — use pointer events so touch works on iOS.
    // Tap is distinguished from drag by tracking pointerdown position
    // and only firing the click handler if movement stayed under a
    // small threshold on pointerup.
    this._pointerDownPos = null;
    this._pointerTapThresholdPx = 10;
    this._pointerDownHandler = this._onPointerDown.bind(this);
    this._pointerUpHandler = this._onPointerUp.bind(this);
    this._moveHandler = this._onPointerMove.bind(this);
    this._renderer.domElement.addEventListener('pointerdown', this._pointerDownHandler);
    this._renderer.domElement.addEventListener('pointerup', this._pointerUpHandler);
    this._renderer.domElement.addEventListener('pointermove', this._moveHandler);

    return this;
  }

  start() {
    if (this._running) return;
    this._running = true;
    this._clock.start();
    this._animate();
  }

  stop() {
    this._running = false;
    if (this._animationFrameId !== null) {
      cancelAnimationFrame(this._animationFrameId);
      this._animationFrameId = null;
    }
  }

  resize() {
    const domElement = this._renderer.domElement;
    const parent = domElement.parentElement;
    if (!parent) return;

    const width = parent.clientWidth;
    const height = parent.clientHeight;

    this._camera.aspect = width / height;
    this._camera.updateProjectionMatrix();
    this._renderer.setSize(width, height);
    if (this._composer) {
      this._composer.setSize(width, height);
    }
  }

  dispose() {
    this.stop();
    window.removeEventListener('resize', this._resizeHandler);

    if (this._renderer) {
      this._renderer.domElement.removeEventListener('pointerdown', this._pointerDownHandler);
      this._renderer.domElement.removeEventListener('pointerup', this._pointerUpHandler);
      this._renderer.domElement.removeEventListener('pointermove', this._moveHandler);
    }

    if (this._controls) {
      this._controls.dispose();
      this._controls = null;
    }

    if (this._composer) {
      this._composer.dispose();
      this._composer = null;
      this._bloomPass = null;
    }

    if (this._renderer) {
      this._renderer.dispose();
      this._renderer = null;
    }

    this._scene = null;
    this._camera = null;
    this._clock = null;
  }

  getScene() {
    return this._scene;
  }

  getCamera() {
    return this._camera;
  }

  getRenderer() {
    return this._renderer;
  }

  getControls() {
    return this._controls;
  }

  addToScene(object3d) {
    if (this._scene && object3d) {
      this._scene.add(object3d);
    }
  }

  setBloomParams({ strength, radius, threshold }) {
    if (!this._bloomPass) return;
    if (strength !== undefined) this._bloomPass.strength = strength;
    if (radius !== undefined) this._bloomPass.radius = radius;
    if (threshold !== undefined) this._bloomPass.threshold = threshold;
  }

  removeFromScene(object3d) {
    if (this._scene && object3d) {
      this._scene.remove(object3d);
    }
  }

  setRaycastTarget(instancedMesh) {
    this._raycastTarget = instancedMesh;
  }

  onNodeClick(callback) {
    this._onNodeClick = callback;
  }

  onNodeHover(callback) {
    this._onNodeHover = callback;
  }

  _getMouseNDC(event) {
    const rect = this._renderer.domElement.getBoundingClientRect();
    this._mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this._mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  }

  _raycast() {
    if (!this._raycastTarget) return -1;
    this._raycaster.setFromCamera(this._mouse, this._camera);
    const target = this._raycastTarget;
    // Multi-shape NodeMesh wraps several InstancedMeshes in a Group.
    // intersectObjects(target.children) tests each per-shape mesh and
    // returns the closest hit; the per-mesh `userData.globalIndices`
    // map then translates the local instanceId back into the global
    // 0..N-1 index space the rest of the app expects.
    const isGroup = target.isGroup === true || target.type === 'Group';
    // Skip pure-visual children (e.g. NodeMesh outline LineSegments)
    // marked with userData.skipRaycast so the filled InstancedMeshes
    // underneath get the click.
    const candidates = isGroup
      ? target.children.filter((c) => !(c.userData && c.userData.skipRaycast))
      : [target];
    const hits = isGroup
      ? this._raycaster.intersectObjects(candidates, false)
      : this._raycaster.intersectObject(target);
    if (hits.length === 0) return -1;
    const hit = hits[0];
    const map = hit.object.userData && hit.object.userData.globalIndices;
    if (map) {
      const g = map[hit.instanceId];
      return g != null ? g : -1;
    }
    return hit.instanceId;
  }

  _onPointerDown(event) {
    // Record where the pointer went down so we can distinguish tap from drag.
    this._pointerDownPos = { x: event.clientX, y: event.clientY };
  }

  _onPointerUp(event) {
    // Only treat as a tap/click if movement stayed under the threshold.
    // OrbitControls otherwise interprets the gesture as a drag and we
    // would select a node at the end of every rotate.
    if (!this._pointerDownPos) return;
    const dx = event.clientX - this._pointerDownPos.x;
    const dy = event.clientY - this._pointerDownPos.y;
    this._pointerDownPos = null;
    if (Math.hypot(dx, dy) > this._pointerTapThresholdPx) return;

    this._getMouseNDC(event);
    const idx = this._raycast();
    if (this._onNodeClick) {
      this._onNodeClick(idx >= 0 ? idx : null);
    }
  }

  _onPointerMove(event) {
    // Hover state is a mouse-only concept — skip for touch/pen to
    // avoid firing hover updates during a two-finger pinch or drag.
    if (event.pointerType && event.pointerType !== 'mouse') return;

    // Throttle raycasts to ~30fps for performance
    const now = performance.now();
    if (now - (this._lastRaycastTime || 0) < 33) return;
    this._lastRaycastTime = now;

    this._getMouseNDC(event);
    const idx = this._raycast();
    if (idx !== this._hoveredIndex) {
      this._hoveredIndex = idx;
      if (this._onNodeHover) {
        this._onNodeHover(
          idx >= 0 ? idx : null,
          { x: event.clientX, y: event.clientY }
        );
      }
      this._renderer.domElement.style.cursor = idx >= 0 ? 'pointer' : 'default';
    }
  }

  _animate() {
    if (!this._running) return;
    this._animationFrameId = requestAnimationFrame(this._animate.bind(this));
    const delta = this._clock.getDelta();
    this._tick(delta);
    if (this._adaptiveQualityEnabled) this._sampleFps(delta);
  }

  _tick(deltaTime) {
    if (this._controls) {
      this._controls.update();
    }
    this._composer.render();
  }

  _sampleFps(delta) {
    // Accumulate samples over a 1-second window, then evaluate.
    if (delta <= 0) return;
    this._fpsSampleSum += 1 / delta;
    this._fpsSampleCount += 1;
    const windowMs = this._fpsSampleCount * delta * 1000;
    if (windowMs < 1000) return;

    const avgFps = this._fpsSampleSum / this._fpsSampleCount;
    this._fpsSampleSum = 0;
    this._fpsSampleCount = 0;

    if (avgFps < this._qualityDegradeFps) {
      this._fpsLowStreakMs += windowMs;
      this._fpsHighStreakMs = 0;
      if (this._fpsLowStreakMs >= this._qualityDegradeMs
          && this._qualityTier < this._qualityMaxTier) {
        this._qualityTier += 1;
        this._applyQualityTier();
        this._fpsLowStreakMs = 0;
      }
    } else if (avgFps > this._qualityRestoreFps) {
      this._fpsHighStreakMs += windowMs;
      this._fpsLowStreakMs = 0;
      if (this._fpsHighStreakMs >= this._qualityRestoreMs
          && this._qualityTier > 0) {
        this._qualityTier -= 1;
        this._applyQualityTier();
        this._fpsHighStreakMs = 0;
      }
    } else {
      // Middle band — decay both streaks so a single bad second
      // doesn't eventually trip the threshold.
      this._fpsLowStreakMs = Math.max(0, this._fpsLowStreakMs - windowMs);
      this._fpsHighStreakMs = Math.max(0, this._fpsHighStreakMs - windowMs);
    }

    if (typeof window !== 'undefined') {
      window.fn = window.fn || {};
      window.fn.qualityTier = this._qualityTier;
      window.fn.lastAvgFps = Math.round(avgFps * 10) / 10;
    }
  }

  _applyQualityTier() {
    const tier = this._qualityTier;
    // Tier 1+: DPR 1.0 (was min(2, devicePixelRatio))
    if (this._renderer) {
      const dpr = tier >= 1 ? 1 : Math.min(2, window.devicePixelRatio || 1);
      this._renderer.setPixelRatio(dpr);
    }
    // Tier 2+: disable bloom if it was enabled
    if (this._bloomPass) {
      const shouldEnableBloom = tier < 2;
      this._bloomPass.enabled = shouldEnableBloom;
    }
    // Tier 3: dispatch an event so ParticleSystem (or others) can react
    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
      try {
        window.dispatchEvent(new CustomEvent('fn:quality-tier', {
          detail: { tier, degradeParticles: tier >= 3 },
        }));
      } catch {
        // CustomEvent unsupported in some jsdom environments — ignore
      }
    }
  }
}

export default SceneManager;
