import { useRef, useEffect, useMemo, useCallback } from 'react';
import { scoreRecipeAroma, AROMA_LABELS, AROMA_COLORS } from '../data/recipeScoring.js';

const AXES = ['odor_fruity', 'odor_floral', 'odor_green', 'odor_woody', 'odor_spicy', 'odor_fatty'];
const FONT_FAMILY = 'Caveat, cursive';

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

function generatePencilStrokes(cx, cy, radius, angleStart, angleEnd, intensity, seed) {
  if (intensity <= 0.01) return [];
  const rng = seededRandom(seed);
  const numStrokes = Math.ceil(intensity * 8);
  const strokes = [];

  for (let i = 0; i < numStrokes; i++) {
    const points = [];
    const baseAngle = angleStart + (angleEnd - angleStart) * rng();
    const jitter = (rng() - 0.5) * 0.25;
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
 * AromaHexWheel — Hexagonal aroma radar with scribbled colored-pencil
 * fill. Replaces AromaProfileBars / the old octagonal TasteWheel.
 *
 * Six axes map to the GNN odor heads (fruity, floral, green, woody,
 * spicy, fatty). Each wedge's pencil intensity is the normalized
 * aroma probability for that channel.
 *
 * Tap a wedge → onTapAroma(suffix) fires with the bare odor key
 * (e.g. 'fruity'). Mirrors the old AromaProfileBars contract.
 */
export default function AromaHexWheel({ ingredients = [], nodes, onTapAroma, width = 300 }) {
  const canvasRef = useRef(null);

  const size = Math.min(width - 32, 320);
  const radius = size * 0.36;
  const cx = size / 2;
  const cy = size / 2;

  const vertices = useMemo(() => {
    return AXES.map((axis, i) => {
      const angle = (i / AXES.length) * Math.PI * 2 - Math.PI / 2;
      return {
        axis,
        x: cx + Math.cos(angle) * radius,
        y: cy + Math.sin(angle) * radius,
        angle,
      };
    });
  }, [cx, cy, radius]);

  const aroma = useMemo(() => {
    if (!nodes || ingredients.length === 0) return null;
    const data = ingredients.map(name => nodes.get(name)).filter(Boolean);
    return scoreRecipeAroma(data);
  }, [ingredients, nodes]);

  const wedgeStrokes = useMemo(() => {
    if (!aroma || !aroma.hasSignal) return {};
    const strokes = {};
    for (let i = 0; i < AXES.length; i++) {
      const axis = AXES[i];
      const intensity = aroma.profile[i] || 0;
      // Center the wedge ON the axis vertex (axis at top, wedge spans
      // ±half-step around it) so pencil shading actually fills toward
      // the labeled vertex instead of starting at it.
      const half = Math.PI / AXES.length;
      const center = (i / AXES.length) * Math.PI * 2 - Math.PI / 2;
      const angleStart = center - half;
      const angleEnd = center + half;
      const seed = hashString(axis + ingredients.join(','));
      strokes[axis] = {
        paths: generatePencilStrokes(cx, cy, radius, angleStart, angleEnd, intensity, seed),
        intensity,
      };
    }
    return strokes;
  }, [aroma, cx, cy, radius, ingredients]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);

    ctx.fillStyle = '#fefae0';
    ctx.fillRect(0, 0, size, size);

    // Pencil shading per wedge
    for (const axis of AXES) {
      const data = wedgeStrokes[axis];
      if (!data || data.paths.length === 0) continue;
      const color = AROMA_COLORS[axis] || '#888';
      const baseOpacity = 0.25 + data.intensity * 0.45;

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

    // Dashed axis spokes
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

    // Wobbly hand-drawn hexagon outline
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

    // Axis labels with colored dot
    ctx.font = `13px ${FONT_FAMILY}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const v of vertices) {
      const labelR = radius + 22;
      const lx = cx + Math.cos(v.angle) * labelR;
      const ly = cy + Math.sin(v.angle) * labelR;

      ctx.beginPath();
      ctx.arc(lx, ly - 9, 3, 0, Math.PI * 2);
      ctx.fillStyle = AROMA_COLORS[v.axis] || '#888';
      ctx.fill();

      ctx.fillStyle = '#3a3428';
      ctx.fillText(AROMA_LABELS[v.axis] || v.axis, lx, ly + 5);
    }

    // Center dot when there's data
    if (ingredients.length > 0) {
      ctx.beginPath();
      ctx.arc(cx, cy, 3, 0, Math.PI * 2);
      ctx.fillStyle = '#7a6a4a';
      ctx.fill();
    }
  }, [size, vertices, wedgeStrokes, cx, cy, radius, ingredients.length]);

  const hitTestWedge = useCallback((clientX, clientY) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    const dx = x - cx;
    const dy = y - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > radius + 8 || dist < 5) return null;

    // Wedges are centered ON axis vertices, so shift by +half-step
    // before bucketing.
    let angle = Math.atan2(dy, dx) + Math.PI / 2 + Math.PI / AXES.length;
    if (angle < 0) angle += Math.PI * 2;
    angle = angle % (Math.PI * 2);
    const idx = Math.floor((angle / (Math.PI * 2)) * AXES.length) % AXES.length;
    return AXES[idx];
  }, [cx, cy, radius]);

  const handleTap = useCallback((clientX, clientY) => {
    const axis = hitTestWedge(clientX, clientY);
    if (axis && onTapAroma) onTapAroma(axis.replace('odor_', ''));
  }, [hitTestWedge, onTapAroma]);

  const handleClick = useCallback((e) => {
    handleTap(e.clientX, e.clientY);
  }, [handleTap]);

  const handleTouchEnd = useCallback((e) => {
    if (e.changedTouches.length === 0) return;
    const t = e.changedTouches[0];
    handleTap(t.clientX, t.clientY);
  }, [handleTap]);

  const showEmpty = !aroma || !aroma.hasSignal;

  return (
    <div
      className="w-full flex flex-col items-center px-2 py-2"
      style={{
        backgroundColor: '#fefae0',
        borderBottom: '1px solid #e8dcc0',
        touchAction: 'none',
      }}
    >
      <div className="flex items-baseline justify-between w-full max-w-[320px] px-2 mb-1">
        <h3 className="text-base" style={{ fontFamily: FONT_FAMILY, color: '#5a4a2a' }}>
          Aroma Profile
        </h3>
        {aroma?.hasSignal && aroma.confidence < 1 && (
          <span className="text-[10px]" style={{ fontFamily: FONT_FAMILY, color: '#a09070' }}>
            {Math.round(aroma.confidence * 100)}% covered
          </span>
        )}
      </div>

      <div className="relative">
        <canvas
          ref={canvasRef}
          style={{ width: size, height: size, display: 'block' }}
          onClick={handleClick}
          onTouchEnd={handleTouchEnd}
        />
        {showEmpty && (
          <div
            className="absolute inset-0 flex items-center justify-center text-center px-4 pointer-events-none"
            style={{ fontFamily: FONT_FAMILY, color: '#a09070' }}
          >
            <span className="text-sm">
              {ingredients.length === 0
                ? 'Add ingredients to see the aroma profile'
                : 'No aroma data for these ingredients yet'}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
