import {
  ShaderMaterial,
  AdditiveBlending,
  Color,
  Vector3,
} from 'three';

// ---------------------------------------------------------------------------
// Node material — glowing spheres with rim-light and activation pulse
// ---------------------------------------------------------------------------

const nodeVertexShader = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vPosition;

  void main() {
    vNormal = normalize(normalMatrix * normal);
    vPosition = (modelMatrix * vec4(position, 1.0)).xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const nodeFragmentShader = /* glsl */ `
  uniform vec3 uColor;
  uniform float uActivation;
  uniform float uTime;

  varying vec3 vNormal;
  varying vec3 vPosition;

  void main() {
    // View direction in world space
    vec3 viewDir = normalize(cameraPosition - vPosition);

    // Rim glow: brightest at edges where normal is perpendicular to view
    float rim = 1.0 - max(dot(vNormal, viewDir), 0.0);
    rim = pow(rim, 2.0);

    // Activation pulse — gentle sine wave modulated by activation level
    float pulse = 1.0 + uActivation * 0.3 * sin(uTime * 3.0);

    // Core brightness increases with activation
    float core = 0.35 + uActivation * 0.55;

    // Combine core color with rim glow
    vec3 coreColor = uColor * core * pulse;
    vec3 rimColor = uColor * rim * (0.8 + uActivation * 1.2);

    vec3 finalColor = coreColor + rimColor;

    // Overall alpha: solid center, glowing rim
    float alpha = 0.7 + rim * 0.3 + uActivation * 0.15;

    gl_FragColor = vec4(finalColor, clamp(alpha, 0.0, 1.0));
  }
`;

export function createNodeMaterial() {
  return new ShaderMaterial({
    uniforms: {
      uColor: { value: new Vector3(0.3, 0.6, 1.0) },
      uActivation: { value: 0.0 },
      uTime: { value: 0.0 },
    },
    vertexShader: nodeVertexShader,
    fragmentShader: nodeFragmentShader,
    transparent: true,
    depthWrite: true,
  });
}

// ---------------------------------------------------------------------------
// Edge material — translucent additive lines for pairing connections
// ---------------------------------------------------------------------------

const edgeVertexShader = /* glsl */ `
  void main() {
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const edgeFragmentShader = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;

  void main() {
    gl_FragColor = vec4(uColor, uOpacity);
  }
`;

export function createEdgeMaterial() {
  return new ShaderMaterial({
    uniforms: {
      uColor: { value: new Vector3(0.2, 0.5, 0.9) },
      uOpacity: { value: 0.25 },
    },
    vertexShader: edgeVertexShader,
    fragmentShader: edgeFragmentShader,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
  });
}

// ---------------------------------------------------------------------------
// Particle material — soft circular point sprites with additive glow
// ---------------------------------------------------------------------------

const particleVertexShader = /* glsl */ `
  uniform float uSize;

  attribute vec3 aColor;

  varying vec3 vColor;

  void main() {
    vColor = aColor;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    // Scale point size by distance so particles shrink with perspective
    gl_PointSize = uSize * (300.0 / -mvPosition.z);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const particleFragmentShader = /* glsl */ `
  uniform float uOpacity;

  varying vec3 vColor;

  void main() {
    // Soft circular point sprite
    vec2 center = gl_PointCoord - vec2(0.5);
    float dist = length(center);

    // Discard fragments outside the circle radius
    if (dist > 0.5) discard;

    // Smooth falloff from center for a soft glow
    float strength = 1.0 - smoothstep(0.0, 0.5, dist);
    strength = pow(strength, 1.5);

    gl_FragColor = vec4(vColor * strength, uOpacity * strength);
  }
`;

export function createParticleMaterial() {
  return new ShaderMaterial({
    uniforms: {
      uColor: { value: new Vector3(0.4, 0.7, 1.0) },
      uSize: { value: 6.0 },
      uOpacity: { value: 0.4 },
    },
    vertexShader: particleVertexShader,
    fragmentShader: particleFragmentShader,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
  });
}

// ---------------------------------------------------------------------------
// Living Architecture — edge material with per-vertex color/opacity + brightness
// ---------------------------------------------------------------------------

const livingEdgeVertexShader = /* glsl */ `
        precision highp float;
        attribute vec3 aColor;
        attribute float aOpacity;
        varying vec3 vColor;
        varying float vOpacity;
        void main() {
          vColor = aColor;
          vOpacity = aOpacity;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
`;

const livingEdgeFragmentShader = /* glsl */ `
        precision highp float;
        uniform float uBrightness;
        varying vec3 vColor;
        varying float vOpacity;
        void main() { gl_FragColor = vec4(vColor * uBrightness, vOpacity * uBrightness); }
`;

export function createLivingEdgeMaterial() {
  return new ShaderMaterial({
    uniforms: { uBrightness: { value: 1.0 } },
    vertexShader: livingEdgeVertexShader,
    fragmentShader: livingEdgeFragmentShader,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
  });
}

// ---------------------------------------------------------------------------
// Living Architecture — particle material with per-vertex color/opacity + brightness
// ---------------------------------------------------------------------------

const livingParticleVertexShader = /* glsl */ `
        precision highp float;
        attribute float aOpacity;
        attribute vec3 aColor;
        varying float vOpacity;
        varying vec3 vColor;
        void main() {
          vOpacity = aOpacity;
          vColor = aColor;
          vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = 3.0 * (200.0 / -mvPos.z);
          gl_Position = projectionMatrix * mvPos;
        }
`;

const livingParticleFragmentShader = /* glsl */ `
        precision highp float;
        uniform float uBrightness;
        varying float vOpacity;
        varying vec3 vColor;
        void main() {
          float d = length(gl_PointCoord - vec2(0.5));
          if (d > 0.5) discard;
          float alpha = smoothstep(0.5, 0.2, d) * vOpacity * uBrightness;
          gl_FragColor = vec4(vColor * uBrightness, alpha);
        }
`;

export function createLivingParticleMaterial() {
  return new ShaderMaterial({
    uniforms: { uBrightness: { value: 1.0 } },
    vertexShader: livingParticleVertexShader,
    fragmentShader: livingParticleFragmentShader,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
  });
}
