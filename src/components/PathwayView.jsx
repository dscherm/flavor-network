import { useRef, useEffect, useCallback, useState, useMemo } from 'react';
import { TASTE_COLORS } from '../utils/color.js';

const TASTE_KEYS = ['sweet', 'sour', 'bitter', 'salty', 'umami', 'spicy', 'pungent', 'astringent'];
const PATHWAY_COLORS = {
  tradition: '#f39c12', chemistry: '#4ecdc4', bridge: '#e74c3c', balance: '#2ecc71',
};
const PATHWAY_LABELS = {
  tradition: 'Tradition',
  chemistry: 'Chemistry',
  bridge:    'Bridge',
  balance:   'Balance',
};
const PATHWAY_DESCRIPTIONS = {
  tradition: 'classic culinary pairings',
  chemistry: 'shared flavor compounds',
  bridge:    'cross-category discoveries',
  balance:   'taste complementarity',
};
const BG = '#0a0a0f';
const HUB_R = 30, NODE_MIN_R = 5, NODE_MAX_R = 12;
const TOP_PER_HUB = 30, TOP_EDGES = 500, HUB_SPREAD = 200;

// Category groupings for computing cross-category "bridge" edges
const CATEGORY_GROUPS = {
  protein:    ['meat', 'poultry', 'fish', 'seafood', 'egg', 'game'],
  dairy:      ['dairy', 'cheese', 'milk', 'cream', 'butter', 'yogurt'],
  fruit:      ['fruit', 'berry', 'citrus', 'tropical'],
  vegetable:  ['vegetable', 'root', 'leafy', 'squash', 'legume'],
  grain:      ['grain', 'bread', 'pasta', 'rice', 'cereal', 'flour'],
  spice:      ['spice', 'herb', 'seasoning', 'aromatic'],
  sweet:      ['sugar', 'sweetener', 'chocolate', 'honey', 'syrup', 'candy'],
  beverage:   ['alcohol', 'spirit', 'wine', 'beer', 'liqueur', 'juice', 'tea', 'coffee'],
  fat:        ['oil', 'fat', 'nut', 'seed'],
  condiment:  ['sauce', 'condiment', 'vinegar', 'mustard', 'pickle'],
};

function getCategoryGroup(node) {
  if (!node) return null;
  const cat = (node.category || '').toLowerCase();
  const name = (node.name || '').toLowerCase();
  const combined = cat + ' ' + name;
  for (const [group, keywords] of Object.entries(CATEGORY_GROUPS)) {
    for (const kw of keywords) {
      if (combined.includes(kw)) return group;
    }
  }
  return null;
}

// Deterministic hash from a string pair for reproducible classification
function pairHash(a, b) {
  const s = a < b ? a + '|' + b : b + '|' + a;
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

// Taste compatibility: returns how complementary two taste profiles are (0-1)
function tasteCompat(t1, t2) {
  if (!t1 || !t2) return 0;
  const a = t1.toLowerCase(), b = t2.toLowerCase();
  // Complementary pairs score higher
  const complements = [
    ['sweet', 'sour'], ['sweet', 'bitter'], ['sweet', 'salty'],
    ['salty', 'sour'], ['umami', 'sour'], ['umami', 'bitter'],
    ['spicy', 'sweet'], ['bitter', 'salty'],
  ];
  for (const [x, y] of complements) {
    if ((a.includes(x) && b.includes(y)) || (a.includes(y) && b.includes(x))) return 1;
  }
  // Same taste = low complementarity
  for (const k of TASTE_KEYS) {
    if (a.includes(k) && b.includes(k)) return 0.1;
  }
  return 0.3;
}

/**
 * Classify an edge into one of four pathway types.
 * If the edge has explicit breakdown data, use that.
 * Otherwise, derive classification from ingredient properties deterministically.
 */
function classifyEdge(edge, nodesMap) {
  // If explicit breakdown data exists, use a balanced comparison
  const t = edge.tradition ?? edge.breakdown?.x1 ?? null;
  const c = edge.chemistry ?? edge.breakdown?.x3 ?? null;
  const b = edge.bridging  ?? edge.breakdown?.x5 ?? null;
  const bl = edge.balance  ?? edge.breakdown?.x4 ?? null;

  if (t !== null && c !== null && b !== null && bl !== null) {
    const scores = { tradition: t, chemistry: c, bridge: b, balance: bl };
    let best = 'tradition', bestVal = -1;
    for (const [k, v] of Object.entries(scores)) {
      if (v > bestVal) { bestVal = v; best = k; }
    }
    return best;
  }

  // Derive classification from ingredient properties
  const srcNode = nodesMap?.get(edge.source);
  const tgtNode = nodesMap?.get(edge.target);
  const srcGroup = getCategoryGroup(srcNode);
  const tgtGroup = getCategoryGroup(tgtNode);
  const srcTaste = srcNode?.taste || '';
  const tgtTaste = tgtNode?.taste || '';

  // Bridge: cross-category pairings (different food groups)
  const isCrossCategory = srcGroup && tgtGroup && srcGroup !== tgtGroup;
  // Exclude spice-to-anything since spices pair with everything (not surprising)
  const isSpiceCross = srcGroup === 'spice' || tgtGroup === 'spice';
  const isTrueBridge = isCrossCategory && !isSpiceCross;

  // Balance: taste complementarity
  const compat = tasteCompat(srcTaste, tgtTaste);

  // Chemistry: high strength suggests shared compounds
  const str = edge.strength || 0;

  // Use a scoring system with deterministic tiebreaker
  const hash = pairHash(edge.source, edge.target);
  const jitter = (hash % 100) / 1000; // 0 to 0.099, for deterministic tiebreaking

  const scores = {
    tradition: 0.3 + (str > 0.4 ? 0.1 : 0) + jitter * 0.2,
    chemistry: (str > 0.65 ? 0.45 : str > 0.5 ? 0.3 : 0.1) + ((hash >> 3) % 100) / 1000 * 0.2,
    bridge:    (isTrueBridge ? 0.55 : 0) + (isCrossCategory ? 0.2 : 0) + ((hash >> 5) % 100) / 1000 * 0.2,
    balance:   compat * 0.6 + (compat > 0.6 ? 0.2 : 0) + ((hash >> 7) % 100) / 1000 * 0.2,
  };

  let best = 'tradition', bestVal = -1;
  for (const [k, v] of Object.entries(scores)) {
    if (v > bestVal) { bestVal = v; best = k; }
  }
  return best;
}

function primaryTaste(node) {
  if (!node?.taste) return 'sweet';
  const t = node.taste.toLowerCase();
  for (const k of TASTE_KEYS) { if (t.includes(k)) return k; }
  return 'sweet';
}

function rgba(hex, a) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${a})`;
}

export default function PathwayView({ data, onNodeClick, selectedNode, selectedNodes }) {
  const canvasRef = useRef(null);
  const stateRef = useRef({ panX: 0, panY: 0, zoom: 1, dragging: false, lastMouse: null, hovered: null });
  const layoutRef = useRef(null);
  const rafRef = useRef(null);
  const [pathwayToggles, setPathwayToggles] = useState({
    tradition: true, chemistry: true, bridge: true, balance: true,
  });
  const [hoveredNode, setHoveredNode] = useState(null);

  const layout = useMemo(() => {
    if (!data?.graph) return null;
    const { nodes, edges } = data.graph;
    // Hub positions in octagon
    const hubs = {};
    TASTE_KEYS.forEach((taste, i) => {
      const angle = (i / 8) * Math.PI * 2 - Math.PI / 2;
      hubs[taste] = {
        x: Math.cos(angle) * HUB_SPREAD, y: Math.sin(angle) * HUB_SPREAD,
        taste, color: TASTE_COLORS[taste] || TASTE_COLORS.default,
      };
    });
    // Bucket ingredients by primary taste, pick top N by pairingCount
    const buckets = {};
    TASTE_KEYS.forEach(k => { buckets[k] = []; });
    for (const [name, node] of nodes) buckets[primaryTaste(node)].push({ name, node });
    for (const k of TASTE_KEYS) {
      buckets[k].sort((a, b) => b.node.pairingCount - a.node.pairingCount);
      buckets[k] = buckets[k].slice(0, TOP_PER_HUB);
    }
    // Position ingredient nodes in a spiral around their hub
    const positions = {};
    const maxP = Math.max(1, ...Array.from(nodes.values()).map(n => n.pairingCount));
    for (const taste of TASTE_KEYS) {
      const hub = hubs[taste];
      buckets[taste].forEach((item, i) => {
        const ring = Math.floor(i / 8) + 1, slot = i % 8;
        const a = (slot / 8) * Math.PI * 2 + ring * 0.4;
        const dist = 40 + ring * 28;
        positions[item.name] = {
          x: hub.x + Math.cos(a) * dist, y: hub.y + Math.sin(a) * dist,
          r: NODE_MIN_R + (NODE_MAX_R - NODE_MIN_R) * (item.node.pairingCount / maxP),
          taste, color: hub.color, node: item.node, isTop5: i < 5,
        };
      });
    }
    // Filter edges to visible ingredients, classify, take top N
    const vis = new Set(Object.keys(positions));
    const classified = edges
      .filter(e => vis.has(e.source) && vis.has(e.target))
      .map(e => ({ ...e, pathway: classifyEdge(e, nodes) }))
      .sort((a, b) => b.strength - a.strength)
      .slice(0, TOP_EDGES);

    // Count per pathway type
    const counts = { tradition: 0, chemistry: 0, bridge: 0, balance: 0 };
    for (const e of classified) counts[e.pathway]++;

    return { hubs, positions, classified, counts };
  }, [data]);

  useEffect(() => { layoutRef.current = layout; }, [layout]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current, lay = layoutRef.current;
    if (!canvas || !lay) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height, st = stateRef.current;
    const ox = w / 2 + st.panX, oy = h / 2 + st.panY, z = st.zoom;
    const tx = (x) => ox + x * z, ty = (y) => oy + y * z;

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, w, h);

    // Edges with distinct visual styles per pathway type
    for (const edge of lay.classified) {
      if (!pathwayToggles[edge.pathway]) continue;
      const p1 = lay.positions[edge.source], p2 = lay.positions[edge.target];
      if (!p1 || !p2) continue;
      const isHi = selectedNode && (edge.source === selectedNode || edge.target === selectedNode);
      const dim = selectedNode && !isHi;

      const x1 = tx(p1.x), y1 = ty(p1.y), x2 = tx(p2.x), y2 = ty(p2.y);
      const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
      const off = (p1.taste !== p2.taste ? 30 : 10) * z;
      const cx = mx + off, cy = my - off;

      const pw = edge.pathway;
      // Tradition: thinner, lower opacity; others: thicker, higher opacity
      const baseOpacity = 0.55;
      const baseWidth = 2.0;
      const alpha = dim ? 0.06 : baseOpacity * (0.3 + edge.strength * 0.7);
      const lw = (dim ? 0.8 : baseWidth + edge.strength * 1.5) * z;

      ctx.strokeStyle = rgba(PATHWAY_COLORS[pw], alpha);
      ctx.lineWidth = lw;

      if (pw === 'chemistry') {
        // Dashed line
        ctx.setLineDash([8 * z, 4 * z]);
      } else if (pw === 'bridge') {
        // Dotted line
        ctx.setLineDash([3 * z, 5 * z]);
      } else if (pw === 'balance') {
        // Dash-dot pattern
        ctx.setLineDash([10 * z, 3 * z, 3 * z, 3 * z]);
      } else {
        // Tradition: solid
        ctx.setLineDash([]);
      }

      if (false) {
        // (removed double-line balance rendering)
        const dx = x2 - x1, dy = y2 - y1;
        const len = Math.sqrt(dx * dx + dy * dy) || 1;
        const nx = -dy / len, ny = dx / len;
        const sep = 1.5 * z;
        ctx.setLineDash([]);
        ctx.lineWidth = Math.max(0.8, lw * 0.5);

        ctx.beginPath();
        ctx.moveTo(x1 + nx * sep, y1 + ny * sep);
        ctx.quadraticCurveTo(cx + nx * sep, cy + ny * sep, x2 + nx * sep, y2 + ny * sep);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(x1 - nx * sep, y1 - ny * sep);
        ctx.quadraticCurveTo(cx - nx * sep, cy - ny * sep, x2 - nx * sep, y2 - ny * sep);
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.quadraticCurveTo(cx, cy, x2, y2);
        ctx.stroke();
      }

      // Reset dash
      ctx.setLineDash([]);
    }

    // Junction dots for cross-taste edges
    for (const edge of lay.classified) {
      if (!pathwayToggles[edge.pathway]) continue;
      const p1 = lay.positions[edge.source], p2 = lay.positions[edge.target];
      if (!p1 || !p2 || p1.taste === p2.taste) continue;
      ctx.fillStyle = rgba('#ffffff', 0.3);
      ctx.beginPath();
      ctx.arc((tx(p1.x) + tx(p2.x)) / 2, (ty(p1.y) + ty(p2.y)) / 2, 2.5 * z, 0, Math.PI * 2);
      ctx.fill();
    }
    // Taste hub stations
    for (const taste of TASTE_KEYS) {
      const hub = lay.hubs[taste], hx = tx(hub.x), hy = ty(hub.y), hr = HUB_R * z;
      const grd = ctx.createRadialGradient(hx, hy, hr * 0.5, hx, hy, hr * 2.2);
      grd.addColorStop(0, rgba(hub.color, 0.25));
      grd.addColorStop(1, rgba(hub.color, 0));
      ctx.fillStyle = grd;
      ctx.beginPath(); ctx.arc(hx, hy, hr * 2.2, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = rgba(hub.color, 0.85);
      ctx.beginPath(); ctx.arc(hx, hy, hr, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = hub.color; ctx.lineWidth = 2 * z; ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.font = `bold ${Math.round(12 * z)}px Inter,system-ui,sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(taste.charAt(0).toUpperCase() + taste.slice(1), hx, hy);
    }
    // Ingredient nodes
    const hov = stateRef.current.hovered;
    // Pre-build selected neighbor set for dimming
    const selNeighbors = selectedNode ? new Set(
      lay.classified.filter(e => e.source === selectedNode || e.target === selectedNode)
        .flatMap(e => [e.source, e.target])
    ) : null;

    for (const [name, pos] of Object.entries(lay.positions)) {
      const nx = tx(pos.x), ny = ty(pos.y), nr = pos.r * z;
      const isSel = name === selectedNode || (selectedNodes?.includes(name));
      const dim = selNeighbors && !selNeighbors.has(name) && !isSel;
      const isH = hov === name;
      if (isSel || isH) {
        const grd = ctx.createRadialGradient(nx, ny, nr * 0.3, nx, ny, nr * 3);
        grd.addColorStop(0, rgba(pos.color, 0.5));
        grd.addColorStop(1, rgba(pos.color, 0));
        ctx.fillStyle = grd;
        ctx.beginPath(); ctx.arc(nx, ny, nr * 3, 0, Math.PI * 2); ctx.fill();
      }
      ctx.fillStyle = rgba(pos.color, dim ? 0.15 : isSel ? 1 : 0.8);
      ctx.beginPath(); ctx.arc(nx, ny, nr, 0, Math.PI * 2); ctx.fill();
      if (pos.isTop5 || isH || isSel) {
        ctx.fillStyle = dim ? rgba('#ffffff', 0.2) : '#fff';
        ctx.font = `${Math.round((isH || isSel ? 11 : 9) * z)}px Inter,system-ui,sans-serif`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'top';
        ctx.fillText(name, nx, ny + nr + 3 * z);
      }
    }
  }, [pathwayToggles, selectedNode, selectedNodes]);

  // Resize + animation loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const rect = canvas.parentElement.getBoundingClientRect();
      canvas.width = rect.width * devicePixelRatio;
      canvas.height = rect.height * devicePixelRatio;
      canvas.style.width = rect.width + 'px';
      canvas.style.height = rect.height + 'px';
      canvas.getContext('2d').scale(devicePixelRatio, devicePixelRatio);
    };
    resize();
    window.addEventListener('resize', resize);
    let running = true;
    const loop = () => { if (!running) return; draw(); rafRef.current = requestAnimationFrame(loop); };
    loop();
    return () => { running = false; cancelAnimationFrame(rafRef.current); window.removeEventListener('resize', resize); };
  }, [draw]);

  const hitTest = useCallback((mx, my) => {
    const lay = layoutRef.current;
    if (!lay) return null;
    const st = stateRef.current, cvs = canvasRef.current;
    const w = cvs.width / devicePixelRatio, h = cvs.height / devicePixelRatio;
    const ox = w / 2 + st.panX, oy = h / 2 + st.panY, z = st.zoom;
    for (const taste of TASTE_KEYS) {
      const hub = lay.hubs[taste];
      const dx = mx - (ox + hub.x * z), dy = my - (oy + hub.y * z);
      if (dx * dx + dy * dy < (HUB_R * z) ** 2) return { type: 'hub', taste };
    }
    for (const [name, pos] of Object.entries(lay.positions)) {
      const dx = mx - (ox + pos.x * z), dy = my - (oy + pos.y * z);
      if (dx * dx + dy * dy < (Math.max(pos.r, 8) * z) ** 2) return { type: 'node', name };
    }
    return null;
  }, []);

  // Mouse + touch handlers
  useEffect(() => {
    const cvs = canvasRef.current;
    if (!cvs) return;
    const st = stateRef.current;
    let lastTouchDist = null;

    const onWheel = (e) => { e.preventDefault(); st.zoom = Math.max(0.2, Math.min(5, st.zoom * (e.deltaY > 0 ? 0.9 : 1.1))); };
    const onDown = (e) => { st.dragging = true; st.lastMouse = { x: e.clientX, y: e.clientY }; };
    const onMove = (e) => {
      const rect = cvs.getBoundingClientRect();
      const hit = hitTest(e.clientX - rect.left, e.clientY - rect.top);
      st.hovered = hit?.type === 'node' ? hit.name : null;
      setHoveredNode(st.hovered);
      cvs.style.cursor = hit ? 'pointer' : st.dragging ? 'grabbing' : 'grab';
      if (st.dragging && st.lastMouse) {
        st.panX += e.clientX - st.lastMouse.x; st.panY += e.clientY - st.lastMouse.y;
        st.lastMouse = { x: e.clientX, y: e.clientY };
      }
    };
    const onUp = () => { st.dragging = false; st.lastMouse = null; };
    const onClick = (e) => {
      const rect = cvs.getBoundingClientRect();
      const hit = hitTest(e.clientX - rect.left, e.clientY - rect.top);
      if (hit?.type === 'node' && onNodeClick) onNodeClick(hit.name);
      else if (hit?.type === 'hub') {
        const hub = layoutRef.current.hubs[hit.taste];
        st.zoom = 2.5; st.panX = -hub.x * st.zoom; st.panY = -hub.y * st.zoom;
      }
    };
    const onTouchStart = (e) => {
      if (e.touches.length === 1) { st.dragging = true; st.lastMouse = { x: e.touches[0].clientX, y: e.touches[0].clientY }; }
      else if (e.touches.length === 2) {
        const dx = e.touches[1].clientX - e.touches[0].clientX, dy = e.touches[1].clientY - e.touches[0].clientY;
        lastTouchDist = Math.sqrt(dx * dx + dy * dy);
      }
    };
    const onTouchMove = (e) => {
      e.preventDefault();
      if (e.touches.length === 1 && st.dragging && st.lastMouse) {
        st.panX += e.touches[0].clientX - st.lastMouse.x; st.panY += e.touches[0].clientY - st.lastMouse.y;
        st.lastMouse = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      } else if (e.touches.length === 2 && lastTouchDist) {
        const dx = e.touches[1].clientX - e.touches[0].clientX, dy = e.touches[1].clientY - e.touches[0].clientY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        st.zoom = Math.max(0.2, Math.min(5, st.zoom * (dist / lastTouchDist))); lastTouchDist = dist;
      }
    };
    const onTouchEnd = () => { st.dragging = false; st.lastMouse = null; lastTouchDist = null; };

    cvs.addEventListener('wheel', onWheel, { passive: false });
    cvs.addEventListener('mousedown', onDown);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    cvs.addEventListener('click', onClick);
    cvs.addEventListener('touchstart', onTouchStart, { passive: false });
    cvs.addEventListener('touchmove', onTouchMove, { passive: false });
    cvs.addEventListener('touchend', onTouchEnd);
    return () => {
      cvs.removeEventListener('wheel', onWheel); cvs.removeEventListener('mousedown', onDown);
      window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp);
      cvs.removeEventListener('click', onClick);
      cvs.removeEventListener('touchstart', onTouchStart); cvs.removeEventListener('touchmove', onTouchMove);
      cvs.removeEventListener('touchend', onTouchEnd);
    };
  }, [hitTest, onNodeClick]);

  const allVisible = Object.values(pathwayToggles).every(Boolean);
  const noneVisible = Object.values(pathwayToggles).every(v => !v);

  const toggleAll = useCallback(() => {
    const nextState = !allVisible;
    setPathwayToggles({
      tradition: nextState, chemistry: nextState, bridge: nextState, balance: nextState,
    });
  }, [allVisible]);

  if (!data?.graph) {
    return (
      <div className="fixed inset-0 pt-10 bg-gray-950 flex items-center justify-center z-10">
        <span className="text-gray-400 text-sm">Loading pathway map...</span>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 pt-10 z-10" style={{ background: BG }}>
      <canvas ref={canvasRef} className="w-full h-full block" tabIndex={0}
        role="img" aria-label="Neural Pathway Map visualization" />

      {/* Pathway type toggles */}
      <div className="absolute top-14 right-4 flex flex-col gap-1.5 z-20">
        <button
          onClick={toggleAll}
          className="flex items-center gap-2 px-3 py-1.5 rounded text-xs font-medium
            bg-gray-700/80 hover:bg-gray-600/80 text-gray-200 backdrop-blur-sm border border-gray-600/40"
          aria-label={allVisible ? 'Hide all pathways' : 'Show all pathways'}>
          {allVisible ? 'Hide All' : 'Show All'}
        </button>
        {Object.entries(PATHWAY_COLORS).map(([key, color]) => {
          const count = layout?.counts?.[key] ?? 0;
          return (
            <button key={key}
              onClick={() => setPathwayToggles(p => ({ ...p, [key]: !p[key] }))}
              className={`flex items-center gap-2 px-3 py-1.5 rounded text-xs font-medium transition-opacity
                ${pathwayToggles[key] ? 'opacity-100' : 'opacity-40'}
                bg-gray-800/80 hover:bg-gray-700/80 text-gray-100 backdrop-blur-sm`}
              aria-pressed={pathwayToggles[key]} aria-label={`Toggle ${key} pathways`}>
              <span className="w-3 h-3 rounded-full inline-block flex-shrink-0" style={{ background: color }} />
              {PATHWAY_LABELS[key]}
              <span className="text-gray-400 ml-auto">({count})</span>
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div className="absolute bottom-4 left-4 bg-gray-900/85 backdrop-blur-sm rounded-lg px-4 py-3 z-20
                      max-w-xs border border-gray-700/50">
        <div className="text-xs font-semibold text-gray-300 mb-2 tracking-wide uppercase">Neural Pathways</div>
        {Object.entries(PATHWAY_LABELS).map(([key, label]) => (
          <div key={key} className="flex items-start gap-2 mb-1 last:mb-0">
            <span className="w-2.5 h-2.5 rounded-full mt-0.5 flex-shrink-0" style={{ background: PATHWAY_COLORS[key] }} />
            <span className="text-[10px] text-gray-400 leading-tight">
              {label} — {PATHWAY_DESCRIPTIONS[key]}
              {key === 'chemistry' && ' (dashed)'}
              {key === 'bridge' && ' (dotted)'}
              {key === 'balance' && ' (dash-dot)'}
            </span>
          </div>
        ))}
      </div>

      {/* Hover tooltip */}
      {hoveredNode && layout?.positions[hoveredNode] && (
        <div className="absolute top-14 left-4 bg-gray-900/90 backdrop-blur-sm rounded-lg px-3 py-2 z-20
                        border border-gray-700/50 max-w-[200px]">
          <div className="text-sm font-medium text-gray-100">{hoveredNode}</div>
          <div className="text-[10px] text-gray-400 mt-0.5">
            {layout.positions[hoveredNode].node.pairingCount} pairings
            <span className="mx-1">|</span>
            {layout.positions[hoveredNode].taste}
            {layout.positions[hoveredNode].node.category && (
              <><span className="mx-1">|</span>{layout.positions[hoveredNode].node.category}</>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
