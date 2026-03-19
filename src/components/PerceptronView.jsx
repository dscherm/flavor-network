/**
 * PerceptronView.jsx — Neural network architecture diagram for the Flavor Network.
 * Renders ingredients as a 3-layer perceptron: Taste -> Category -> Ingredient.
 * Pure SVG with pan/zoom, glow filters, and activation animations.
 */
import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { getNeighbors } from '../data/graph.js';

const TASTES = [
  { key: 'sweet', color: '#ff6b9d', label: 'Sweet' },
  { key: 'sour', color: '#4ecdc4', label: 'Sour' },
  { key: 'bitter', color: '#9b59b6', label: 'Bitter' },
  { key: 'salty', color: '#3498db', label: 'Salty' },
  { key: 'umami', color: '#f39c12', label: 'Umami' },
  { key: 'spicy', color: '#e74c3c', label: 'Spicy' },
  { key: 'pungent', color: '#e67e22', label: 'Pungent' },
  { key: 'astringent', color: '#1abc9c', label: 'Astringent' },
];
const TC = Object.fromEntries(TASTES.map(t => [t.key, t.color]));
const tasteColor = (taste) => {
  if (!taste) return '#4f8fff';
  const l = taste.toLowerCase();
  for (const t of TASTES) if (l.includes(t.key)) return t.color;
  return '#4f8fff';
};
const domTaste = (taste) => {
  if (!taste) return null;
  const l = taste.toLowerCase();
  for (const t of TASTES) if (l.includes(t.key)) return t.key;
  return null;
};
const LX = [100, 420, 740];

export default function PerceptronView({ data, onNodeClick, selectedNode, selectedNodes = [] }) {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [drag, setDrag] = useState(null);
  const [hovered, setHovered] = useState(null);
  const [actCat, setActCat] = useState(null);
  const [actTaste, setActTaste] = useState(null);
  const [fired, setFired] = useState(false);
  const touchRef = useRef(0);
  const sel = selectedNode || (selectedNodes.length > 0 ? selectedNodes[0] : null);

  const { categories, topIng, catTastes } = useMemo(() => {
    if (!data?.graph) return { categories: [], topIng: [], catTastes: {} };
    const cc = {}, ct = {};
    for (const [, n] of data.graph.nodes) {
      const c = n.category || 'other';
      cc[c] = (cc[c] || 0) + 1;
      if (!ct[c]) ct[c] = {};
      const d = domTaste(n.taste);
      if (d) ct[c][d] = (ct[c][d] || 0) + 1;
    }
    const cats = Object.entries(cc).sort((a, b) => b[1] - a[1]).slice(0, 18).map(([name, count]) => {
      const ts = ct[name] || {};
      const dom = Object.entries(ts).sort((a, b) => b[1] - a[1])[0];
      return { name, count, dom: dom ? dom[0] : null };
    });
    const all = [...data.graph.nodes.values()].sort((a, b) => b.pairingCount - a.pairingCount);
    return { categories: cats, topIng: all.slice(0, 50), catTastes: ct };
  }, [data]);

  const tastePts = useMemo(() => {
    const g = 70, s = 300 - (TASTES.length - 1) * g / 2;
    return TASTES.map((t, i) => ({ ...t, x: LX[0], y: s + i * g }));
  }, []);
  const catPts = useMemo(() => {
    const g = Math.min(40, 560 / Math.max(categories.length, 1));
    const s = 300 - (categories.length - 1) * g / 2;
    return categories.map((c, i) => ({ ...c, x: LX[1], y: s + i * g }));
  }, [categories]);

  const visIng = useMemo(() => {
    if (!data?.graph) return [];
    const nodes = data.graph.nodes;
    if (sel) {
      const sn = typeof sel === 'string' ? nodes.get(sel) : sel;
      if (!sn) return topIng;
      const nb = getNeighbors(sn.name, data.graph.edges).slice(0, 30);
      return [sn, ...nb.map(n => nodes.get(n.name)).filter(Boolean)];
    }
    if (actTaste) return [...nodes.values()].filter(n => n.taste?.toLowerCase().includes(actTaste)).sort((a, b) => b.pairingCount - a.pairingCount).slice(0, 40);
    if (actCat) return [...nodes.values()].filter(n => n.category === actCat).sort((a, b) => b.pairingCount - a.pairingCount).slice(0, 40);
    return topIng;
  }, [data, sel, actTaste, actCat, topIng]);

  const ingPts = useMemo(() => {
    const g = Math.min(22, 560 / Math.max(visIng.length, 1));
    const s = 300 - (visIng.length - 1) * g / 2;
    return visIng.map((n, i) => ({ ...n, x: LX[2], y: s + i * g }));
  }, [visIng]);

  useEffect(() => {
    if (!sel) { setFired(false); return; }
    setFired(false);
    const t = setTimeout(() => setFired(true), 50);
    return () => clearTimeout(t);
  }, [sel]);

  const selData = useMemo(() => {
    if (!sel || !data?.graph) return null;
    return data.graph.nodes.get(typeof sel === 'string' ? sel : sel.name) || null;
  }, [sel, data]);

  const onWheel = useCallback(e => { e.preventDefault(); setZoom(z => Math.max(0.3, Math.min(3, z * (e.deltaY > 0 ? 0.9 : 1.1)))); }, []);
  const onPtrDown = useCallback(e => { if (e.button === 0) setDrag({ x: e.clientX - pan.x, y: e.clientY - pan.y }); }, [pan]);
  const onPtrMove = useCallback(e => { if (drag) setPan({ x: e.clientX - drag.x, y: e.clientY - drag.y }); }, [drag]);
  const onPtrUp = useCallback(() => setDrag(null), []);
  const onTouchS = useCallback(e => {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX, dy = e.touches[0].clientY - e.touches[1].clientY;
      touchRef.current = Math.hypot(dx, dy);
    } else if (e.touches.length === 1) setDrag({ x: e.touches[0].clientX - pan.x, y: e.touches[0].clientY - pan.y });
  }, [pan]);
  const onTouchM = useCallback(e => {
    if (e.touches.length === 2) {
      const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
      if (touchRef.current > 0) setZoom(z => Math.max(0.3, Math.min(3, z * d / touchRef.current)));
      touchRef.current = d;
    } else if (drag && e.touches.length === 1) setPan({ x: e.touches[0].clientX - drag.x, y: e.touches[0].clientY - drag.y });
  }, [drag]);
  const onTouchE = useCallback(() => { setDrag(null); touchRef.current = 0; }, []);

  const tcLinks = useMemo(() => {
    const links = [];
    for (const cat of categories) {
      const ts = catTastes[cat.name] || {};
      const tot = Object.values(ts).reduce((s, v) => s + v, 0);
      for (const t of TASTES) {
        const c = ts[t.key] || 0;
        if (c > 0) links.push({ taste: t.key, cat: cat.name, op: Math.min(0.8, c / tot * 1.5) });
      }
    }
    return links;
  }, [categories, catTastes]);

  const sn = selData?.name, st = selData?.taste?.toLowerCase().split(/\s+/) || [], sc = selData?.category;
  if (!data?.graph) return null;

  return (
    <div className="fixed inset-0 pt-10 bg-[#0a0a0f] z-10 flex flex-col">
      <svg className="w-full h-full cursor-grab active:cursor-grabbing" onWheel={onWheel}
        onPointerDown={onPtrDown} onPointerMove={onPtrMove} onPointerUp={onPtrUp} onPointerLeave={onPtrUp}
        onTouchStart={onTouchS} onTouchMove={onTouchM} onTouchEnd={onTouchE} style={{ touchAction: 'none' }}>
        <defs>
          <filter id="pcg" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" result="b" /><feComposite in="SourceGraphic" in2="b" operator="over" />
          </filter>
          <filter id="pcgs" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="8" result="b" /><feComposite in="SourceGraphic" in2="b" operator="over" />
          </filter>
        </defs>
        <g transform={`translate(${pan.x},${pan.y}) scale(${zoom})`}>
          <text x={LX[0]} y={30} textAnchor="middle" fill="#666" fontSize="12" fontFamily="monospace">INPUT: Taste</text>
          <text x={LX[1]} y={30} textAnchor="middle" fill="#666" fontSize="12" fontFamily="monospace">HIDDEN: Category</text>
          <text x={LX[2]} y={30} textAnchor="middle" fill="#666" fontSize="12" fontFamily="monospace">OUTPUT: Ingredients</text>

          {/* Taste->Category lines */}
          {tcLinks.map((lk, i) => {
            const tp = tastePts.find(t => t.key === lk.taste), cp = catPts.find(c => c.name === lk.cat);
            if (!tp || !cp) return null;
            const act = fired && st.includes(lk.taste) && lk.cat === sc;
            return <line key={`tc${i}`} x1={tp.x + 25} y1={tp.y} x2={cp.x - 15} y2={cp.y}
              stroke={TC[lk.taste]} strokeOpacity={act ? 0.8 : lk.op * 0.3} strokeWidth={act ? 2 : 0.5}
              className={act ? 'pc-draw' : ''} />;
          })}

          {/* Category->Ingredient lines */}
          {(actCat || sc) && ingPts.map((ing, i) => {
            const cat = actCat || sc;
            if (ing.category !== cat) return null;
            const cp = catPts.find(c => c.name === cat);
            if (!cp) return null;
            const isSel = sn === ing.name;
            return <line key={`ci${i}`} x1={cp.x + 15} y1={cp.y} x2={ing.x - 8} y2={ing.y}
              stroke={tasteColor(ing.taste)} strokeOpacity={isSel ? 0.7 : 0.15} strokeWidth={isSel ? 1.5 : 0.5}
              className={fired && isSel ? 'pc-draw' : ''} />;
          })}

          {/* Pairing arcs */}
          {fired && sn && ingPts.length > 1 && (() => {
            const sp = ingPts.find(p => p.name === sn);
            if (!sp) return null;
            return getNeighbors(sn, data.graph.edges).slice(0, 10).map((nb, i) => {
              const np = ingPts.find(p => p.name === nb.name);
              if (!np) return null;
              return <path key={`a${i}`} d={`M${sp.x + 8},${sp.y} Q${sp.x + 60},${(sp.y + np.y) / 2} ${np.x + 8},${np.y}`}
                fill="none" stroke="#f39c12" strokeOpacity={nb.strength * 0.7} strokeWidth={1 + nb.strength} className="pc-arc" />;
            });
          })()}

          {/* Taste nodes */}
          {tastePts.map(t => {
            const act = fired && st.includes(t.key), hov = actTaste === t.key;
            return (<g key={t.key} className="cursor-pointer" tabIndex={0} role="button" aria-label={`Taste: ${t.label}`}
              onClick={() => { setActTaste(actTaste === t.key ? null : t.key); setActCat(null); }}
              onMouseEnter={() => setHovered(`t-${t.key}`)} onMouseLeave={() => setHovered(null)}>
              <circle cx={t.x} cy={t.y} r={25} fill={t.color} fillOpacity={act || hov ? 0.9 : 0.5}
                stroke={t.color} strokeWidth={act ? 3 : 1} filter={act ? 'url(#pcgs)' : 'url(#pcg)'}
                className={act ? 'pc-pulse' : ''} />
              <text x={t.x} y={t.y + 4} textAnchor="middle" fill="#fff" fontSize="9" fontFamily="monospace"
                fontWeight="bold" pointerEvents="none">{t.label}</text>
            </g>);
          })}

          {/* Category nodes */}
          {catPts.map(c => {
            const bd = c.dom ? (TC[c.dom] || '#4f8fff') : '#4f8fff';
            const act = fired && sc === c.name, hov = actCat === c.name;
            return (<g key={c.name} className="cursor-pointer" tabIndex={0} role="button"
              aria-label={`Category: ${c.name} (${c.count})`}
              onClick={() => { setActCat(actCat === c.name ? null : c.name); setActTaste(null); }}
              onMouseEnter={() => setHovered(`c-${c.name}`)} onMouseLeave={() => setHovered(null)}>
              <circle cx={c.x} cy={c.y} r={15} fill={act || hov ? bd : '#1a1a2e'}
                fillOpacity={act || hov ? 0.7 : 0.8} stroke={bd} strokeWidth={act ? 2.5 : 1}
                filter="url(#pcg)" className={act ? 'pc-pulse' : ''} />
              <text x={c.x + 20} y={c.y + 3} fill="#aaa" fontSize="8" fontFamily="monospace"
                pointerEvents="none">{c.name} ({c.count})</text>
            </g>);
          })}

          {/* Ingredient nodes */}
          {ingPts.map((ing, i) => {
            const col = tasteColor(ing.taste), isSel = sn === ing.name, isH = hovered === `i-${ing.name}`;
            return (<g key={ing.name} className="cursor-pointer" tabIndex={0} role="button"
              aria-label={`Ingredient: ${ing.name}`} onClick={() => onNodeClick?.(ing)}
              onMouseEnter={() => setHovered(`i-${ing.name}`)} onMouseLeave={() => setHovered(null)}>
              <circle cx={ing.x} cy={ing.y} r={isSel ? 10 : 7} fill={col}
                fillOpacity={isSel ? 0.9 : isH ? 0.8 : 0.5} stroke={isSel ? '#fff' : col}
                strokeWidth={isSel ? 2 : 0.5} filter={isSel ? 'url(#pcgs)' : 'url(#pcg)'}
                className={fired && isSel ? 'pc-pulse' : ''} />
              {(i < 20 || isSel || isH) && <text x={ing.x - 12} y={ing.y + 3} textAnchor="end"
                fill={isSel ? '#fff' : '#888'} fontSize={isSel ? '9' : '7'} fontFamily="monospace"
                pointerEvents="none">{ing.name}</text>}
            </g>);
          })}
        </g>
      </svg>

      {/* Perceptron score panel */}
      {fired && selData && (
        <div className="absolute bottom-4 right-4 bg-gray-900/90 border border-gray-700 rounded-lg p-3 w-56 backdrop-blur-sm">
          <div className="text-gray-400 text-[10px] font-mono uppercase tracking-wider mb-2">Perceptron Activation</div>
          <div className="text-white text-sm font-mono mb-2">{selData.name}</div>
          <div className="space-y-1">
            {TASTES.map((t, i) => {
              const v = st.includes(t.key) ? 0.7 + Math.random() * 0.3 : Math.random() * 0.15;
              return (<div key={t.key} className="flex items-center gap-1.5">
                <span className="text-gray-500 text-[9px] font-mono w-4">x{i + 1}</span>
                <div className="flex-1 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${v * 100}%`, backgroundColor: t.color }} />
                </div>
              </div>);
            })}
          </div>
          <div className="mt-2 flex items-center gap-2">
            <span className="text-gray-500 text-[9px] font-mono">sigma</span>
            <div className="w-5 h-5 rounded-full pc-pulse"
              style={{ backgroundColor: tasteColor(selData.taste),
                boxShadow: `0 0 12px ${tasteColor(selData.taste)}`,
                opacity: 0.6 + Math.min(0.4, selData.pairingCount / 500 * 0.4) }} />
            <span className="text-gray-300 text-[10px] font-mono">
              {Math.min(0.99, 0.5 + selData.pairingCount / 1000).toFixed(2)}
            </span>
          </div>
        </div>
      )}

      <style>{`
        @keyframes pc-p { 0%,100%{opacity:.7} 50%{opacity:1} }
        .pc-pulse { animation: pc-p 1.5s ease-in-out infinite; }
        @keyframes pc-d { from{stroke-dashoffset:500} to{stroke-dashoffset:0} }
        .pc-draw { stroke-dasharray:500; animation: pc-d .8s ease-out forwards; }
        @keyframes pc-a { from{stroke-dashoffset:300;opacity:0} to{stroke-dashoffset:0;opacity:1} }
        .pc-arc { stroke-dasharray:300; animation: pc-a 1s ease-out .5s both; }
      `}</style>
    </div>
  );
}
