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
import { placeLabels, ringRadii } from '../data/pairingLabelLayout.js';

const TWEEN_MS = 460;
const HOLD_MS = 420;           // press-and-hold → peek
const TAP_MOVE_TOL = 10;       // px; movement beyond this cancels a tap
const SANS = 'system-ui, -apple-system, "Segoe UI", sans-serif';
const LABEL_FONT = `600 16px ${FONT}`;
const BUCKET_FONT = (hi) => `600 ${hi ? 19 : 17}px ${FONT}`;
const CENTER_FONT = `700 30px ${FONT}`;

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
function computeLayout(partners, lens, ctx, cx, cy, width, height) {
  const targets = new Map();   // name → {x,y,r,color,group}
  const labels = [];           // {text,x,y,color} bucket labels
  if (!partners || partners.length === 0) return { targets, labels };

  const strengths = partners.map((p) => p.strength);
  const sMax = Math.max(...strengths, 1e-6);
  const sMin = Math.min(...strengths);
  const sSpan = Math.max(sMax - sMin, 1e-6);
  const nodeR = (s) => 7 + ((s - sMin) / sSpan) * 7; // 7..14 px

  // DESIGN-1: the ring is an ellipse that uses the whole board (phones are
  // taller than wide) instead of a circle sized to the narrow side.
  const { rx, ry } = ringRadii(width, height);

  if (lens === 'affinity') {
    const fIn = 0.55;           // inner ring, clear of the center oval
    const n = partners.length;
    partners.forEach((p, i) => {
      const ang = -Math.PI / 2 + (i * 2 * Math.PI) / n;
      const sNorm = (p.strength - sMin) / sSpan;      // 1 = strongest
      const f = 1 - sNorm * (1 - fIn);                // strongest → inner
      targets.set(p.name, {
        x: cx + f * rx * Math.cos(ang),
        y: cy + f * ry * Math.sin(ang),
        r: nodeR(p.strength),
        color: tasteColorFor(p.node),
        group: 'Affinity',
      });
    });
    return { targets, labels };
  }

  // Categorical: each bucket owns an angular SECTOR; its members fan
  // across that sector on an outer ring (so nothing crowds the center),
  // with a small radial stagger so adjacent node labels don't collide.
  const groups = groupByLens(partners, lens, ctx);
  const G = groups.length || 1;
  const fMid = 0.78;                      // members sit on this ring
  const fStagger = 0.12;                  // alternate radius to de-overlap labels
  const sectorW = 2 * Math.PI / G;
  groups.forEach((g, gi) => {
    const sectorCenter = -Math.PI / 2 + gi * sectorW;
    const M = g.members.length;
    // Members span up to 70% of the sector width (leaves a gap between
    // buckets); a lone member sits dead-center on the sector.
    const span = Math.min(sectorW * 0.7, 1.0);
    g.members.forEach((p, mi) => {
      const t = M > 1 ? (mi / (M - 1)) - 0.5 : 0; // -0.5 … 0.5 across the arc
      const ang = sectorCenter + t * span;
      const f = fMid + (mi % 2 === 0 ? 0 : fStagger);
      targets.set(p.name, {
        x: cx + f * rx * Math.cos(ang),
        y: cy + f * ry * Math.sin(ang),
        r: nodeR(p.strength),
        color: g.color,
        group: g.label,
      });
    });
    labels.push({ // bucket label just outside its members
      text: g.label,
      x: cx + rx * Math.cos(sectorCenter),
      y: cy + ry * Math.sin(sectorCenter),
      color: g.color,
    });
  });
  return { targets, labels };
}

/**
 * Fix the text spots for a layout (DESIGN-1): bucket labels clamped onto the
 * board, then partner names placed so none overlap each other, a circle,
 * a bucket label or the center oval. `measureWith(font, text)` → px.
 */
function placeText(layout, partners, center, highlightGroup, cx, cy, width, height, measureWith) {
  const obstacles = [];
  if (center) {
    const w = Math.max(measureWith(CENTER_FONT, center) + 40, 100);
    obstacles.push({ x0: cx - w / 2, y0: cy - 29, x1: cx + w / 2, y1: cy + 29 });
  }
  const nodes = partners
    .map((p) => { const t = layout.targets.get(p.name); return t && { name: p.name, x: t.x, y: t.y, r: t.r }; })
    .filter(Boolean);
  // Group labels go first, kept clear of the circles and the center oval;
  // the partner names then keep clear of the group labels too.
  const groupText = layout.labels.map((lab) => {
    const hi = !!highlightGroup && lab.text === highlightGroup;
    return { ...lab, hi, text: hi ? `★ ${lab.text}` : lab.text };
  });
  const groupSpots = placeLabels(
    groupText.map((g) => ({ name: g.text, x: g.x, y: g.y, r: 0 })),
    {
      width, height, cx, cy, lineHeight: 22,
      obstacles: [...obstacles, ...nodes.map((n) => ({ x0: n.x - n.r, y0: n.y - n.r, x1: n.x + n.r, y1: n.y + n.r }))],
      measure: (text) => measureWith(BUCKET_FONT(groupText.find((g) => g.text === text)?.hi), text),
    },
  );
  const buckets = groupText.map((g) => {
    const spot = groupSpots.get(g.text);
    obstacles.push(spot.box);
    return { ...g, x: spot.x, y: spot.y };
  });
  const names = placeLabels(nodes, {
    width, height, cx, cy, obstacles, lineHeight: 18,
    measure: (text) => measureWith(LABEL_FONT, text),
  });
  return { buckets, names };
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
  const targetRef = useRef({ targets: new Map(), labels: [], text: null });
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

  // Re-place the labels once the Caveat web font is in, so the measured
  // widths match what is drawn.
  const [fontsReady, setFontsReady] = useState(false);
  useEffect(() => {
    let alive = true;
    try { document.fonts?.ready?.then(() => { if (alive) setFontsReady(true); }); } catch { /* no font API */ }
    return () => { alive = false; };
  }, []);

  // ── draw a single frame from posRef ──────────────────────────────────
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const c = canvas.getContext('2d');
    if (!c) { setCanvasOk(false); return; }

    c.clearRect(0, 0, width, height);
    const pos = posRef.current;
    const { targets, text } = targetRef.current;
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
    for (const lab of text?.buckets || []) {
      c.font = BUCKET_FONT(lab.hi);
      c.fillStyle = lab.color;
      c.save();
      c.shadowColor = 'rgba(0,0,0,0.6)';
      c.shadowBlur = 3;
      c.fillText(lab.text, lab.x, lab.y);
      c.restore();
    }

    // Partner nodes + names.
    for (const p of partners) {
      const pt = pos.get(p.name);
      const t = targets.get(p.name);
      if (!pt || !t) continue;
      c.beginPath();
      c.arc(pt.x, pt.y, t.r, 0, 2 * Math.PI);
      c.fillStyle = t.color;
      c.fill();
      c.lineWidth = 1.5;
      c.strokeStyle = 'rgba(245,239,222,0.7)';
      c.stroke();
      hitsRef.current.push({ name: p.name, x: pt.x, y: pt.y, r: t.r + 6 });

      // DESIGN-1: the spot was fixed on the target layout (no overlaps);
      // during a lens tween it rides along with its circle.
      const spot = text?.names.get(p.name);
      if (spot) {
        c.save();
        c.font = LABEL_FONT;
        c.fillStyle = CHALK_CREAM;
        c.shadowColor = 'rgba(245,239,222,0.5)';
        c.shadowBlur = 3;
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        c.fillText(p.name, spot.x + (pt.x - t.x), spot.y + (pt.y - t.y));
        c.restore();
      }
    }

    // Center ingredient — a bigger black chalk-oval with a hand-drawn
    // double stroke + chalk glow, Caveat name.
    if (center) {
      c.save();
      c.font = CENTER_FONT;
      const w = Math.max(c.measureText(center).width + 40, 100);
      const h = 58;
      // Make the focus oval a hit target too: a long-press here peeks the
      // center ingredient's own profile card (PAIR-LAB consolidation).
      hitsRef.current.push({ name: center, x: cx, y: cy, r: Math.max(w, h) / 2 });
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
  }, [partners, center, cx, cy, width, height, bridges]);

  // ── (re)layout + tween whenever inputs change ────────────────────────
  useEffect(() => {
    const layout = computeLayout(partners, lens, ctx, cx, cy, width, height);
    let mctx = null;
    try { mctx = canvasRef.current?.getContext?.('2d') || null; } catch { mctx = null; }
    const measureWith = (font, txt) => {
      if (!mctx) return String(txt).length * 8;
      mctx.font = font;
      return mctx.measureText(txt).width;
    };
    layout.text = placeText(layout, partners, center, highlightGroup, cx, cy, width, height, measureWith);
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
  }, [partners, lens, ctx, width, height, reducedMotion, draw, center, highlightGroup, fontsReady]);

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
