import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

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
    this._renderer.setPixelRatio(window.devicePixelRatio);
    this._renderer.setSize(target.clientWidth, target.clientHeight);

    if (!isCanvas) {
      target.appendChild(this._renderer.domElement);
    }

    // Post-processing
    const width = target.clientWidth;
    const height = target.clientHeight;
    this._composer = new EffectComposer(this._renderer);
    this._composer.addPass(new RenderPass(this._scene, this._camera));

    this._bloomPass = new UnrealBloomPass(
      new THREE.Vector2(width, height),
      1.5,
      0.4,
      0.85
    );
    this._composer.addPass(this._bloomPass);

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

  _animate() {
    if (!this._running) return;
    this._animationFrameId = requestAnimationFrame(this._animate.bind(this));
    const delta = this._clock.getDelta();
    this._tick(delta);
  }

  _tick(deltaTime) {
    if (this._controls) {
      this._controls.update();
    }
    this._composer.render();
  }
}

export default SceneManager;
