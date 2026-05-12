/**
 * BridgePulseOverlay — 2D DOM overlay that flashes expanding rings at
 * the screen positions of the top-N bridge ingredients when pullStrength
 * crosses 0.5.
 *
 * R19 Phase 3 (Tier D). The 3D scene supplies a one-shot snapshot of
 * `{ bridges: [{ name, x, y, color }], ts }` at the crossing moment.
 * The overlay animates each ring from r≈11px to r≈28px over 1.5s
 * (fade in 200ms, hold 1s, fade out 300ms). DOM-only — keeps the
 * Three.js scene + shaders untouched and the pulse easy to test in
 * jsdom.
 *
 * aria-hidden because the semantic content is already announced via
 * HUDAnnouncer + visible in the InsightChip's narrative.
 */

import { useEffect, useRef, useState } from 'react';

const TOTAL_MS = 1500;
const MAX_RADIUS = 28;
const MIN_RADIUS = MAX_RADIUS * 0.4;

function alphaForT(t) {
  if (t < 0.133) return t / 0.133;          // 200ms fade-in
  if (t < 0.8)   return 1;                  // 1s hold
  return Math.max(0, 1 - (t - 0.8) / 0.2);  // 300ms fade-out
}

export default function BridgePulseOverlay({ pulse = null }) {
  const lastTsRef = useRef(null);
  const [frame, setFrame] = useState({ alpha: 1, radius: MIN_RADIUS, done: false });

  useEffect(() => {
    if (!pulse || !Array.isArray(pulse.bridges) || pulse.bridges.length === 0) {
      setFrame((f) => ({ ...f, done: true }));
      return undefined;
    }
    // Fresh pulse — reset to t=0 and start ticking. Tracking the ts
    // separately so a re-render with the same pulse doesn't restart
    // the animation (RAF cleanup handles that).
    lastTsRef.current = pulse.ts;
    setFrame({ alpha: 1, radius: MIN_RADIUS, done: false });
    let raf = 0;
    let cancelled = false;
    const start = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const tick = (now) => {
      if (cancelled) return;
      const elapsed = now - start;
      const t = Math.min(1, elapsed / TOTAL_MS);
      if (t < 1) {
        setFrame({
          alpha: alphaForT(t),
          radius: MIN_RADIUS + (MAX_RADIUS - MIN_RADIUS) * t,
          done: false,
        });
        raf = requestAnimationFrame(tick);
      } else {
        setFrame({ alpha: 0, radius: MAX_RADIUS, done: true });
      }
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      if (raf) cancelAnimationFrame(raf);
    };
  }, [pulse?.ts]);

  if (!pulse || frame.done || !Array.isArray(pulse.bridges) || pulse.bridges.length === 0) {
    return null;
  }

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-[65]"
      data-testid="bridge-pulse-overlay"
    >
      {pulse.bridges.map((b, i) => (
        <span
          key={`${b.name}-${i}`}
          data-testid="bridge-pulse-ring"
          className="absolute rounded-full"
          style={{
            left: b.x - frame.radius,
            top: b.y - frame.radius,
            width: frame.radius * 2,
            height: frame.radius * 2,
            borderWidth: 2,
            borderStyle: 'solid',
            borderColor: b.color || '#7dd3fc',
            opacity: frame.alpha,
            boxShadow: `0 0 ${frame.radius / 2}px ${b.color || '#7dd3fc'}`,
          }}
        />
      ))}
    </div>
  );
}
