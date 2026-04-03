/**
 * Static heuristic analysis — code-level UX checks that don't require a browser.
 * Greps source files for known anti-patterns and missing mobile optimizations.
 */

import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC = join(__dirname, '..', '..', 'src');
const ROOT = join(__dirname, '..', '..');

/**
 * Run all heuristic checks against the source code.
 * @returns {{ checks: Array<{ id: string, name: string, status: 'pass'|'fail'|'warn', detail: string }>, score: number }}
 */
export function runHeuristics() {
  const checks = [];

  // 1. SearchBar: missing touchstart for click-outside
  checks.push(checkSearchBarTouch());

  // 2. BottomSheet: drag handle size
  checks.push(checkBottomSheetHandle());

  // 3. Vite compression
  checks.push(checkCompression());

  // 4. JSON streaming / Web Worker offload
  checks.push(checkJSONParsing());

  // 5. Three.js mobile optimizations
  checks.push(checkThreeJSMobile());

  // 6. Device pixel ratio capping
  checks.push(checkPixelRatio());

  // 7. Particle count reduction on mobile
  checks.push(checkParticlesMobile());

  // 8. React.memo usage on expensive components
  checks.push(checkReactMemo());

  // 9. Touch event support on 3D canvas
  checks.push(checkCanvasTouch());

  // 10. Safe area CSS usage
  checks.push(checkSafeAreas());

  const failCount = checks.filter(c => c.status === 'fail').length;
  const warnCount = checks.filter(c => c.status === 'warn').length;
  const total = checks.length;
  const score = Math.round(((total - failCount - warnCount * 0.5) / total) * 100);

  return { checks, score, summary: { total, pass: total - failCount - warnCount, fail: failCount, warn: warnCount } };
}

function readSafe(filepath) {
  try { return readFileSync(filepath, 'utf-8'); } catch { return ''; }
}

function checkSearchBarTouch() {
  const content = readSafe(join(SRC, 'components', 'SearchBar.jsx'));
  const hasMousedown = content.includes('mousedown');
  const hasTouchstart = content.includes('touchstart');

  if (hasMousedown && !hasTouchstart) {
    return {
      id: 'searchbar-touch',
      name: 'SearchBar click-outside uses touchstart',
      status: 'fail',
      detail: 'SearchBar.jsx binds mousedown for click-outside but not touchstart — dropdown won\'t dismiss on iOS touch',
    };
  }
  return {
    id: 'searchbar-touch',
    name: 'SearchBar click-outside uses touchstart',
    status: hasTouchstart ? 'pass' : 'warn',
    detail: hasTouchstart ? 'touchstart handler found' : 'Could not verify touch event binding',
  };
}

function checkBottomSheetHandle() {
  const content = readSafe(join(SRC, 'components', 'BottomSheet.jsx'));
  // Look for drag handle — typically a thin div with w-10 h-1 or similar
  const handleMatch = content.match(/h-(\d+)/);
  const heightClass = handleMatch ? parseInt(handleMatch[1]) : null;

  // Tailwind h-1 = 4px, h-2 = 8px, etc. iOS minimum is 44px (h-11)
  if (heightClass && heightClass < 11) {
    const heightPx = heightClass * 4;
    return {
      id: 'bottomsheet-handle',
      name: 'BottomSheet drag handle meets 44px minimum',
      status: 'fail',
      detail: `Drag handle is h-${heightClass} (${heightPx}px) — below iOS 44px minimum tap target. Users will struggle to grab it.`,
    };
  }
  return {
    id: 'bottomsheet-handle',
    name: 'BottomSheet drag handle meets 44px minimum',
    status: heightClass ? 'pass' : 'warn',
    detail: heightClass ? `Handle height: h-${heightClass}` : 'Could not determine handle height from classes',
  };
}

function checkCompression() {
  const viteConfig = readSafe(join(ROOT, 'vite.config.js'));
  const hasCompression = viteConfig.includes('viteCompression') ||
                         viteConfig.includes('compression') ||
                         viteConfig.includes('gzip') ||
                         viteConfig.includes('brotli');

  return {
    id: 'compression',
    name: 'Build output uses gzip/brotli compression',
    status: hasCompression ? 'pass' : 'fail',
    detail: hasCompression
      ? 'Compression plugin detected in vite config'
      : 'No compression configured — 27MB pairings.json could be ~3-5MB with gzip. Add vite-plugin-compression.',
  };
}

function checkJSONParsing() {
  const proData = readSafe(join(SRC, 'hooks', 'useProData.js'));
  const hasWorker = proData.includes('Worker') || proData.includes('worker');
  const hasStreaming = proData.includes('getReader') || proData.includes('ReadableStream');
  const hasChunking = proData.includes('chunk') || proData.includes('stream');

  if (!hasWorker && !hasStreaming && !hasChunking) {
    return {
      id: 'json-offload',
      name: 'JSON parsing offloaded from main thread',
      status: 'fail',
      detail: 'useProData.js parses 27MB pairings.json on the main thread — blocks UI for 400-1100ms. Move to Web Worker or use streaming JSON parser.',
    };
  }
  return {
    id: 'json-offload',
    name: 'JSON parsing offloaded from main thread',
    status: 'pass',
    detail: 'JSON parsing uses worker or streaming approach',
  };
}

function checkThreeJSMobile() {
  const edgeMesh = readSafe(join(SRC, 'three', 'EdgeMesh.js'));
  const hasLowp = edgeMesh.includes('lowp') || edgeMesh.includes('mediump');
  const hasHighp = edgeMesh.includes('highp');

  if (hasHighp && !hasLowp) {
    return {
      id: 'shader-precision',
      name: 'Shaders use mobile-appropriate precision',
      status: 'warn',
      detail: 'EdgeMesh.js uses highp float precision — lowp/mediump would be faster on mobile GPUs (A9/A10)',
    };
  }
  return {
    id: 'shader-precision',
    name: 'Shaders use mobile-appropriate precision',
    status: hasLowp ? 'pass' : 'warn',
    detail: hasLowp ? 'Mobile precision hints found' : 'Could not verify shader precision settings',
  };
}

function checkPixelRatio() {
  const sceneManager = readSafe(join(SRC, 'three', 'SceneManager.js'));
  const hasDPRCap = sceneManager.includes('Math.min') && sceneManager.includes('devicePixelRatio');
  const rawDPR = sceneManager.includes('devicePixelRatio') && !hasDPRCap;

  return {
    id: 'dpr-cap',
    name: 'Device pixel ratio capped for mobile',
    status: hasDPRCap ? 'pass' : rawDPR ? 'fail' : 'warn',
    detail: hasDPRCap
      ? 'DPR is capped (e.g., Math.min(2, devicePixelRatio))'
      : rawDPR
        ? 'Uses raw devicePixelRatio (3x on iPhone 12/13/15 Pro = 9x pixels). Cap to 2 on mobile.'
        : 'Could not find devicePixelRatio usage',
  };
}

function checkParticlesMobile() {
  const particleSystem = readSafe(join(SRC, 'three', 'ParticleSystem.js'));
  const hasMobileCheck = particleSystem.includes('isMobile') ||
                          particleSystem.includes('mobile') ||
                          particleSystem.includes('reduced');

  return {
    id: 'particles-mobile',
    name: 'Particle count reduced on mobile',
    status: hasMobileCheck ? 'pass' : 'warn',
    detail: hasMobileCheck
      ? 'Mobile-specific particle reduction found'
      : 'No mobile detection in ParticleSystem — 108K particles render on all devices',
  };
}

function checkReactMemo() {
  const heavyComponents = ['NetworkScene.jsx', 'LivingArchView.jsx', 'SearchBar.jsx', 'Legend.jsx', 'Controls.jsx'];
  const memoized = [];
  const notMemoized = [];

  for (const name of heavyComponents) {
    const content = readSafe(join(SRC, 'components', name));
    if (content.includes('React.memo') || content.includes('memo(')) {
      memoized.push(name);
    } else if (content) {
      notMemoized.push(name);
    }
  }

  return {
    id: 'react-memo',
    name: 'Heavy components use React.memo',
    status: notMemoized.length === 0 ? 'pass' : notMemoized.length <= 2 ? 'warn' : 'fail',
    detail: notMemoized.length === 0
      ? 'All heavy components memoized'
      : `Missing React.memo: ${notMemoized.join(', ')}`,
  };
}

function checkCanvasTouch() {
  const sceneManager = readSafe(join(SRC, 'three', 'SceneManager.js'));
  const livingArch = readSafe(join(SRC, 'components', 'LivingArchView.jsx'));
  const networkScene = readSafe(join(SRC, 'components', 'NetworkScene.jsx'));

  const combined = sceneManager + livingArch + networkScene;
  const hasTouchHandlers = combined.includes('touchstart') || combined.includes('pointerdown');
  const hasOrbitControls = combined.includes('OrbitControls');
  const hasTouchEnable = combined.includes('enableRotate') || combined.includes('enableZoom');

  return {
    id: 'canvas-touch',
    name: '3D canvas supports touch gestures',
    status: hasOrbitControls && hasTouchEnable ? 'pass' : hasTouchHandlers ? 'warn' : 'fail',
    detail: hasOrbitControls
      ? `OrbitControls found — touch should work if enableRotate/enableZoom are true`
      : 'No OrbitControls or touch handlers found on 3D canvas — mobile users cannot rotate/zoom',
  };
}

function checkSafeAreas() {
  const appJsx = readSafe(join(SRC, 'App.jsx'));
  const mobileTab = readSafe(join(SRC, 'components', 'MobileTabBar.jsx'));
  const bottomSheet = readSafe(join(SRC, 'components', 'BottomSheet.jsx'));

  const combined = appJsx + mobileTab + bottomSheet;
  const hasSafeArea = combined.includes('safe-area') || combined.includes('env(safe-area');

  return {
    id: 'safe-areas',
    name: 'iOS safe area insets applied',
    status: hasSafeArea ? 'pass' : 'fail',
    detail: hasSafeArea
      ? 'Safe area insets found in key mobile components'
      : 'No safe area CSS found — content may be hidden behind notch/home indicator',
  };
}
