import { useRef, useEffect, useMemo, useCallback } from 'react';
import { TASTE_COLORS } from '../utils/color.js';
import { aggregateRecipeTastes, getAxisContributors } from '../data/tasteScoring.js';

const AXES = ['sweet', 'salty', 'sour', 'bitter', 'umami', 'spicy', 'pungent', 'astringent'];
const FONT_FAMILY = 'Caveat, cursive';

// Deterministic pseudo-random for pencil stroke jitter
function seededRandom(seed) {
  const a = 1664525, c = 1013904223, m = 2 ** 32;
  let state = seed >>> 0;
  return () => { state = (a * state + c) % m; return state / m; };
}

function hashString(str) {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) hash = ((hash << 5) + hash + str.charCodeAt(i)) | 0;
  return hash;
}

/**
 * Generate pencil scribble strokes for an octant.
 * Returns an array of stroke paths (each is an array of {x,y} points).
 */
function generatePencilStrokes(cx, cy, radius, angleStart, angleEnd, intensity, seed) {
  if (intensity <= 0.01) return [];
  const rng = seededRandom(seed);
  const numStrokes = Math.ceil(intensity * 8);
  const strokes = [];

  for (let i = 0; i < numStrokes; i++) {
    const points = [];
    // Each stroke goes from near-center toward the edge within the octant
    const baseAngle = angleStart + (angleEnd - angleStart) * rng();
    const jitter = (rng() - 0.5) * 0.25; // ±~15 degrees in radians
    const angle = baseAngle + jitter;

    const startR = radius * (0.08 + rng() * 0.12);
    const endR = radius * (0.4 + intensity * 0.5 * rng());

    const steps = 6 + Math.floor(rng() * 4);
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      const r = startR + (endR - startR) * t;
      const wobble = (rng() - 0.5) * radius * 0.04;
      const a = angle + wobble * 0.02;
      points.push({
        x: cx + Math.cos(a) * r + wobble,
        y: cy + Math.sin(a) * r + wobble,
      });
    }
    strokes.push(points);
  }
  return strokes;
}

/**
 * TasteWheel — Octagonal taste radar with pencil-shaded fill.
 *
 * Props:
 *   ingredients: string[] — current recipe ingredients
 *   nodes: Map<string, Object> — graph nodes
 *   onTapAxis: (axisName: string) => void — called when user taps an octant
 *   width: number — available width
 */
export default function TasteWheel({ ingredients = [], nodes, onTapAxis, width = 300 }) {
  const canvasRef = useRef(null);
  const longPressTimer = useRef(null);
  const longPressAxis = useRef(null);
  const tooltipRef = useRef(null);

  const size = Math.min(width - 32, 320); // max 320px, 16px padding each side
  const radius = size * 0.38;
  const cx = size / 2;
  const cy = size / 2;

  // Compute vertex positions for octagon
  const vertices = useMemo(() => {
    return AXES.map((axis, i) => {
      const angle = (i / AXES.length) * Math.PI * 2 - Math.PI / 2; // start at top
      return {
        axis,
        x: cx + Math.cos(angle) * radius,
        y: cy + Math.sin(angle) * radius,
        angle,
      };
    });
  }, [cx, cy, radius]);

  // Aggregate taste scores
  const tasteProfile = useMemo(() => {
    if (!nodes || ingredients.length === 0) return null;
    return aggregateRecipeTastes(ingredients, nodes);
  }, [ingredients, nodes]);

  // Memoize pencil strokes per octant (regenerate only on ingredient changes)
  const octantStrokes = useMemo(() => {
    if (!tasteProfile) return {};
    const strokes = {};
    for (let i = 0; i < AXES.length; i++) {
      const axis = AXES[i];
      const intensity = tasteProfile.normalized[axis];
      const angleStart = (i / AXES.length) * Math.PI * 2 - Math.PI / 2;
      const angleEnd = ((i + 1) / AXES.length) * Math.PI * 2 - Math.PI / 2;
      const seed = hashString(axis + ingredients.join(','));
      strokes[axis] = {
        paths: generatePencilStrokes(cx, cy, radius, angleStart, angleEnd, intensity, seed),
        intensity,
      };
    }
    return strokes;
  }, [tasteProfile, cx, cy, radius, ingredients]);

  // Draw canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    const ctx = canvas.getContext('2d');
    if (!ctx) return; // jsdom/SSR: no canvas support
    ctx.scale(dpr, dpr);

    // Clear
    ctx.fillStyle = '#fefae0';
    ctx.fillRect(0, 0, size, size);

    // Draw pencil shading per octant
    for (const axis of AXES) {
      const data = octantStrokes[axis];
      if (!data || data.paths.length === 0) continue;
      const color = TASTE_COLORS[axis] || TASTE_COLORS.default;
      const baseOpacity = 0.25 + data.intensity * 0.35;

      for (const points of data.paths) {
        if (points.length < 2) continue;
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        for (let j = 1; j < points.length; j++) {
          ctx.lineTo(points[j].x, points[j].y);
        }
        ctx.strokeStyle = color;
        ctx.globalAlpha = baseOpacity;
        ctx.lineWidth = 2 + Math.random() * 2;
        ctx.lineCap = 'round';
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;

    // Draw axis lines (dashed, from center to vertex)
    ctx.setLineDash([4, 4]);
    ctx.lineWidth = 1;
    for (const v of vertices) {
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(v.x, v.y);
      ctx.strokeStyle = '#c9b99a';
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // Draw octagon outline (wobbly hand-drawn)
    const rng = seededRandom(42);
    ctx.beginPath();
    for (let i = 0; i <= vertices.length; i++) {
      const v = vertices[i % vertices.length];
      const wx = v.x + (rng() - 0.5) * 2;
      const wy = v.y + (rng() - 0.5) * 2;
      if (i === 0) ctx.moveTo(wx, wy);
      else ctx.lineTo(wx, wy);
    }
    ctx.strokeStyle = '#a09070';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Draw axis labels
    ctx.font = `14px ${FONT_FAMILY}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const v of vertices) {
      const labelR = radius + 18;
      const lx = cx + Math.cos(v.angle) * labelR;
      const ly = cy + Math.sin(v.angle) * labelR;

      // Colored dot
      ctx.beginPath();
      ctx.arc(lx, ly - 10, 3, 0, Math.PI * 2);
      ctx.fillStyle = TASTE_COLORS[v.axis] || TASTE_COLORS.default;
      ctx.fill();

      // Label text
      ctx.fillStyle = '#3a3428';
      ctx.fillText(v.axis, lx, ly + 4);
    }

    // Center dot if recipe has ingredients
    if (ingredients.length > 0) {
      ctx.beginPath();
      ctx.arc(cx, cy, 3, 0, Math.PI * 2);
      ctx.fillStyle = '#7a6a4a';
      ctx.fill();
    }
  }, [size, vertices, octantStrokes, cx, cy, radius, ingredients.length]);

  // Hit test: which octant was tapped?
  const hitTestOctant = useCallback((clientX, clientY) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    const dx = x - cx;
    const dy = y - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > radius + 5 || dist < 5) return null;

    let angle = Math.atan2(dy, dx) + Math.PI / 2; // offset to match vertex start
    if (angle < 0) angle += Math.PI * 2;
    const idx = Math.floor((angle / (Math.PI * 2)) * AXES.length) % AXES.length;
    return AXES[idx];
  }, [cx, cy, radius]);

  const handleTap = useCallback((clientX, clientY) => {
    const axis = hitTestOctant(clientX, clientY);
    if (axis && onTapAxis) onTapAxis(axis);
  }, [hitTestOctant, onTapAxis]);

  // Touch handlers
  const handleTouchStart = useCallback((e) => {
    if (e.touches.length !== 1) return;
    const touch = e.touches[0];
    const axis = hitTestOctant(touch.clientX, touch.clientY);
    longPressAxis.current = axis;

    // Start long-press timer for tooltip
    longPressTimer.current = setTimeout(() => {
      if (axis && tasteProfile && nodes) {
        const pct = Math.round((tasteProfile.normalized[axis] || 0) * 100);
        const contributors = getAxisContributors(axis, ingredients, nodes);
        const names = contributors.slice(0, 3).map(c => c.name).join(', ');
        if (tooltipRef.current) {
          tooltipRef.current.textContent = `${axis}: ${pct}%${names ? ` — ${names}` : ''}`;
          tooltipRef.current.style.display = 'block';
        }
      }
      longPressAxis.current = null; // consumed by long-press
    }, 500);
  }, [hitTestOctant, tasteProfile, nodes, ingredients]);

  const handleTouchEnd = useCallback((e) => {
    clearTimeout(longPressTimer.current);
    if (tooltipRef.current) tooltipRef.current.style.display = 'none';

    if (longPressAxis.current !== null) {
      // Was a tap, not a long-press
      const touch = e.changedTouches[0];
      handleTap(touch.clientX, touch.clientY);
    }
    longPressAxis.current = null;
  }, [handleTap]);

  // Mouse click (desktop fallback)
  const handleClick = useCallback((e) => {
    handleTap(e.clientX, e.clientY);
  }, [handleTap]);

  return (
    <div className="relative flex flex-col items-center" style={{ touchAction: 'none' }}>
      <canvas
        ref={canvasRef}
        style={{ width: size, height: size }}
        onClick={handleClick}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      />
      <div
        ref={tooltipRef}
        className="absolute bottom-1 left-1/2 -translate-x-1/2 px-3 py-1 rounded-md text-sm pointer-events-none"
        style={{
          display: 'none',
          fontFamily: FONT_FAMILY,
          color: '#3a3428',
          backgroundColor: '#fefae0',
          border: '1px solid #c9b99a',
          whiteSpace: 'nowrap',
        }}
      />
    </div>
  );
}
