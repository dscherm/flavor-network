import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

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
  }

  dispose() {
    this.stop();
    window.removeEventListener('resize', this._resizeHandler);

    if (this._controls) {
      this._controls.dispose();
      this._controls = null;
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
    this._renderer.render(this._scene, this._camera);
  }
}

export default SceneManager;
