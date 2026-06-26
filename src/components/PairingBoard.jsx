/**
 * PairingBoard.jsx — PAIR-LAB-P1.
 *
 * 2D <canvas> ego-network renderer for the Pairing Lab. A center
 * ingredient sits at the middle; its strongest partners (from
 * pairingEgoModel.egoNeighborhood) arrange around it. Switching the lens
 * re-plates the SAME partners into grouped, recolored layouts — the
 * "lens twist". This is deliberately 2D (no WebGL): fine under Capacitor
 * WKWebView on iOS, idle when not animating, cheap because we only ever
 * draw ~12 partners.
 *
 * iOS/perf discipline:
 *   - devicePixelRatio capped at 2.
 *   - requestAnimationFrame runs ONLY while a lens twist is in flight,
 *     then the loop stops (no continuous render → battery friendly).
 *   - prefers-reduced-motion → snap to the new layout, no tween.
 *
 * Accessibility + graceful degradation: a real <button> per partner is
 * always rendered (screen-reader reachable; visually hidden when the
 * canvas is healthy). If the 2D context is unavailable the buttons
 * become the visible fallback UI.
 */
import { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import { TASTE_COLORS } from '../utils/color.js';
import { FONT, CHALK_CREAM, CHALK_DIM } from '../data/chalkTheme.js';
import { groupByLens } from '../data/pairingEgoModel.js';

const TWEEN_MS = 460;
const HOLD_MS = 420;           // press-and-hold → peek
const TAP_MOVE_TOL = 10;       // px; movement beyond this cancels a tap
const SANS = 'system-ui, -apple-system, "Segoe UI", sans-serif';

const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

function tasteColorFor(node) {
  const raw = node?.taste;
  if (typeof raw === 'string') {
    const tok = raw.toLowerCase().split(/\s+/).filter(Boolean)[0];
    if (tok && TASTE_COLORS[tok]) return TASTE_COLORS[tok];
  }
  return TASTE_COLORS.default || CHALK_DIM;
}

/**
 * Pure layout: map the lens groups to a target {x,y,r,color,group} per
 * partner, plus bucket-label anchors. Center is (cx,cy).
 *
 *   affinity → clock ring; radius encodes strength (stronger = inner).
 *   categorical → one labeled spoke per bucket; members step outward,
 *     strongest nearest the center.
 */
function computeLayout(partners, lens, ctx, cx, cy, minDim) {
  const targets = new Map();   // name → {x,y,r,color,group}
  const labels = [];           // {text,x,y,color} bucket labels
  if (!partners || partners.length === 0) return { targets, labels };

  const strengths = partners.map((p) => p.strength);
  const sMax = Math.max(...strengths, 1e-6);
  const sMin = Math.min(...strengths);
  const sSpan = Math.max(sMax - sMin, 1e-6);
  const nodeR = (s) => 7 + ((s - sMin) / sSpan) * 7; // 7..14 px

  if (lens === 'affinity') {
    const rIn = 0.24 * minDim;  // clear the (now larger) center oval
    const rOut = 0.46 * minDim;
    const n = partners.length;
    partners.forEach((p, i) => {
      const ang = -Math.PI / 2 + (i * 2 * Math.PI) / n;
      const sNorm = (p.strength - sMin) / sSpan;      // 1 = strongest
      const r = rOut - sNorm * (rOut - rIn);          // strongest → inner
      targets.set(p.name, {
        x: cx + r * Math.cos(ang),
        y: cy + r * Math.sin(ang),
        r: nodeR(p.strength),
        color: tasteColorFor(p.node),
        group: 'Affinity',
      });
    });
    return { targets, labels };
  }

  // Categorical: spokes per bucket.
  const groups = groupByLens(partners, lens, ctx);
  const G = groups.length || 1;
  const rStart = 0.27 * minDim; // start spokes well outside the center oval
  const rEnd = 0.48 * minDim;
  // Small angular fan so multiple members on one spoke don't stack their
  // labels on a single radial line (reduces the crowded-center look).
  const fan = G > 1 ? Math.min(0.18, Math.PI / (G * 2.2)) : 0.14;
  groups.forEach((g, gi) => {
    const baseAng = -Math.PI / 2 + (gi * 2 * Math.PI) / G;
    const M = g.members.length;
    g.members.forEach((p, mi) => {
      const r = M > 1 ? rStart + (mi * (rEnd - rStart)) / (M - 1) : (rStart + rEnd) / 2;
      const ang = baseAng + (M > 1 ? (mi - (M - 1) / 2) * fan / M : 0);
      targets.set(p.name, {
        x: cx + r * Math.cos(ang),
        y: cy + r * Math.sin(ang),
        r: nodeR(p.strength),
        color: g.color,
        group: g.label,
      });
    });
    const ang = baseAng;
    const lr = rEnd + 0.05 * minDim;
    labels.push({
      text: g.label,
      x: cx + lr * Math.cos(ang),
      y: cy + lr * Math.sin(ang),
      color: g.color,
    });
  });
  return { targets, labels };
}

export default function PairingBoard({
  center,
  centerNode,
  partners = [],
  lens = 'affinity',
  ctx = {},
  width = 360,
  height = 480,
  bridges = [],          // PAIR-LAB-P3a: [{a,b}] partner pairs that also pair
  highlightGroup = null, // PAIR-LAB-P3d: bucket label to star (e.g. season-now)
  onSelectPartner,
  onPeek,
}) {
  const canvasRef = useRef(null);
  const posRef = useRef(new Map());      // animated name → {x,y}
  const targetRef = useRef({ targets: new Map(), labels: [] });
  const rafRef = useRef(0);
  const hitsRef = useRef([]);            // {name,x,y,r}
  const pointerRef = useRef(null);       // {x,y,t,holdTimer,held}
  const [canvasOk, setCanvasOk] = useState(true);

  const reducedMotion = useMemo(() => {
    try {
      return typeof window !== 'undefined'
        && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    } catch { return false; }
  }, []);

  const cx = width / 2;
  const cy = height / 2;
  const minDim = Math.min(width, height);

  // ── draw a single frame from posRef ──────────────────────────────────
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const c = canvas.getContext('2d');
    if (!c) { setCanvasOk(false); return; }

    c.clearRect(0, 0, width, height);
    const pos = posRef.current;
    const { labels } = targetRef.current;
    hitsRef.current = [];

    // Edges: center → each partner. Weight + opacity encode pairing
    // STRENGTH; line style encodes PROVENANCE (how the pairing was
    // determined): solid = shared chemistry/co-occurrence, dashed =
    // culinary tradition, solid+glow = both.
    const ss = partners.map((p) => p.strength);
    const sMax = ss.length ? Math.max(...ss) : 1;
    const sMin = ss.length ? Math.min(...ss) : 0;
    const sSpan = Math.max(sMax - sMin, 1e-6);
    for (const p of partners) {
      const pt = pos.get(p.name);
      if (!pt) continue;
      const sn = (p.strength - sMin) / sSpan; // 0..1
      c.save();
      c.lineWidth = 1 + sn * 3;
      c.strokeStyle = `rgba(245,239,222,${(0.22 + sn * 0.5).toFixed(3)})`;
      if (p.provenance === 'cuisine') c.setLineDash([5, 4]);
      else c.setLineDash([]);
      if (p.provenance === 'both') { c.shadowColor = 'rgba(245,239,222,0.8)'; c.shadowBlur = 6; }
      c.beginPath();
      c.moveTo(cx, cy);
      c.lineTo(pt.x, pt.y);
      c.stroke();
      c.restore();
    }

    // Bridge arcs (P3a): a faint dashed curve between two partners that
    // also pair with each other — a 3-ingredient trio with the center.
    if (bridges && bridges.length) {
      c.save();
      c.setLineDash([4, 4]);
      c.lineWidth = 1;
      c.strokeStyle = 'rgba(245,239,222,0.3)';
      for (const br of bridges) {
        const pa = pos.get(br.a);
        const pb = pos.get(br.b);
        if (!pa || !pb) continue;
        const mx = (pa.x + pb.x) / 2;
        const my = (pa.y + pb.y) / 2;
        const dx = mx - cx;
        const dy = my - cy;
        const len = Math.hypot(dx, dy) || 1;
        c.beginPath();
        c.moveTo(pa.x, pa.y);
        c.quadraticCurveTo(mx + (dx / len) * 24, my + (dy / len) * 24, pb.x, pb.y);
        c.stroke();
      }
      c.restore();
    }

    // Bucket labels (categorical lenses). A highlighted bucket (e.g. the
    // current season) gets a star + a slightly larger label.
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    for (const lab of labels) {
      const hi = highlightGroup && lab.text === highlightGroup;
      c.font = `600 ${hi ? 19 : 17}px ${FONT}`;
      c.fillStyle = lab.color;
      // Clamp inside the canvas so spoke labels never clip off-screen.
      const lx = Math.max(36, Math.min(width - 36, lab.x));
      const ly = Math.max(20, Math.min(height - 12, lab.y));
      c.save();
      c.shadowColor = 'rgba(0,0,0,0.6)';
      c.shadowBlur = 3;
      c.fillText(hi ? `★ ${lab.text}` : lab.text, lx, ly);
      c.restore();
    }

    // Partner nodes + names.
    for (const p of partners) {
      const pt = pos.get(p.name);
      const t = targetRef.current.targets.get(p.name);
      if (!pt || !t) continue;
      c.beginPath();
      c.arc(pt.x, pt.y, t.r, 0, 2 * Math.PI);
      c.fillStyle = t.color;
      c.fill();
      c.lineWidth = 1.5;
      c.strokeStyle = 'rgba(245,239,222,0.7)';
      c.stroke();
      hitsRef.current.push({ name: p.name, x: pt.x, y: pt.y, r: t.r + 6 });

      c.save();
      c.font = `600 16px ${FONT}`;
      c.fillStyle = CHALK_CREAM;
      c.shadowColor = 'rgba(245,239,222,0.5)';
      c.shadowBlur = 3;
      c.fillText(p.name, pt.x, pt.y + t.r + 13);
      c.restore();
    }

    // Center ingredient — a bigger black chalk-oval with a hand-drawn
    // double stroke + chalk glow, Caveat name.
    if (center) {
      c.save();
      c.font = `700 30px ${FONT}`;
      const w = Math.max(c.measureText(center).width + 40, 100);
      const h = 58;
      const ell = (rx, ry) => {
        c.beginPath();
        if (c.ellipse) c.ellipse(cx, cy, rx, ry, 0, 0, 2 * Math.PI);
        else c.arc(cx, cy, rx, 0, 2 * Math.PI);
      };
      ell(w / 2, h / 2);
      c.fillStyle = 'rgba(8,8,10,0.92)';
      c.shadowColor = 'rgba(245,239,222,0.45)';
      c.shadowBlur = 16;
      c.fill();
      c.shadowBlur = 0;
      // double chalk stroke — outer bold + inner faint = hand-drawn feel
      c.strokeStyle = CHALK_CREAM; c.lineWidth = 2.5; ell(w / 2, h / 2); c.stroke();
      c.strokeStyle = 'rgba(245,239,222,0.5)'; c.lineWidth = 1; ell(w / 2 - 2.5, h / 2 - 1.5); c.stroke();
      c.fillStyle = CHALK_CREAM;
      c.shadowColor = 'rgba(245,239,222,0.6)';
      c.shadowBlur = 4;
      c.fillText(center, cx, cy);
      c.restore();
    }
  }, [partners, center, cx, cy, width, height, bridges, highlightGroup]);

  // ── (re)layout + tween whenever inputs change ────────────────────────
  useEffect(() => {
    const layout = computeLayout(partners, lens, ctx, cx, cy, minDim);
    targetRef.current = layout;

    const startPos = new Map();
    for (const [name, t] of layout.targets) {
      const prev = posRef.current.get(name);
      startPos.set(name, prev ? { ...prev } : { x: cx, y: cy }); // new nodes fly out from center
    }
    // Drop stale entries.
    for (const name of [...posRef.current.keys()]) {
      if (!layout.targets.has(name)) posRef.current.delete(name);
    }

    if (rafRef.current) cancelAnimationFrame(rafRef.current);

    if (reducedMotion) {
      for (const [name, t] of layout.targets) posRef.current.set(name, { x: t.x, y: t.y });
      draw();
      return;
    }

    let start = null;
    const step = (now) => {
      if (start === null) start = now;
      const k = easeOutCubic(Math.min(1, (now - start) / TWEEN_MS));
      for (const [name, t] of layout.targets) {
        const s = startPos.get(name) || { x: cx, y: cy };
        posRef.current.set(name, { x: s.x + (t.x - s.x) * k, y: s.y + (t.y - s.y) * k });
      }
      draw();
      if (k < 1) rafRef.current = requestAnimationFrame(step);
      else rafRef.current = 0;
    };
    rafRef.current = requestAnimationFrame(step);

    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partners, lens, ctx, width, height, reducedMotion, draw]);

  // ── canvas backing store (dpr capped at 2) ───────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = Math.min(typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1, 2);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    const c = canvas.getContext('2d');
    if (!c) { setCanvasOk(false); return; }
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw();
  }, [width, height, draw]);

  // ── pointer: tap re-centers, press-hold peeks ────────────────────────
  const hitAt = (sx, sy) => {
    for (const h of hitsRef.current) {
      if (Math.hypot(sx - h.x, sy - h.y) <= h.r) return h.name;
    }
    return null;
  };
  const localXY = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };
  const onPointerDown = (e) => {
    const { x, y } = localXY(e);
    const name = hitAt(x, y);
    const holdTimer = name && onPeek
      ? window.setTimeout(() => { pointerRef.current && (pointerRef.current.held = true); onPeek(name); }, HOLD_MS)
      : 0;
    pointerRef.current = { x, y, name, holdTimer, held: false };
  };
  const onPointerUp = (e) => {
    const ptr = pointerRef.current;
    pointerRef.current = null;
    if (!ptr) return;
    if (ptr.holdTimer) window.clearTimeout(ptr.holdTimer);
    if (ptr.held) return; // already peeked
    const { x, y } = localXY(e);
    if (Math.hypot(x - ptr.x, y - ptr.y) > TAP_MOVE_TOL) return;
    if (ptr.name && onSelectPartner) onSelectPartner(ptr.name);
  };

  return (
    <div style={{ position: 'relative', width, height }}>
      <canvas
        ref={canvasRef}
        style={{ width, height, display: canvasOk ? 'block' : 'none', touchAction: 'manipulation' }}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        aria-hidden="true"
      />
      {/* Always-present accessible fallback / a11y list. */}
      <ul
        className={canvasOk ? 'sr-only' : ''}
        style={canvasOk ? undefined : { listStyle: 'none', margin: 0, padding: 8, color: CHALK_CREAM, fontFamily: SANS }}
        aria-label={center ? `Partners of ${center}` : 'Partners'}
      >
        {partners.map((p) => (
          <li key={p.name} style={canvasOk ? undefined : { display: 'flex', gap: 8, alignItems: 'center' }}>
            <button
              type="button"
              onClick={() => onSelectPartner?.(p.name)}
              style={canvasOk ? undefined : {
                background: 'none', border: 'none', color: CHALK_CREAM,
                fontFamily: SANS, fontSize: 15, padding: '6px 4px', cursor: 'pointer',
              }}
            >
              {p.name}
            </button>
            {onPeek && (
              <button
                type="button"
                aria-label={`Details for ${p.name}`}
                onClick={() => onPeek(p.name)}
                style={canvasOk ? undefined : {
                  background: 'none', border: `1px solid ${CHALK_DIM}`, color: CHALK_DIM,
                  fontFamily: SANS, fontSize: 13, borderRadius: 10, padding: '2px 8px', cursor: 'pointer',
                }}
              >
                ⋯
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
