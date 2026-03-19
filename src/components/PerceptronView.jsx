/**
 * PerceptronView.jsx — Flavor Network architecture diagram.
 * 4 meaningful layers: Taste → Category → Flavor Cluster → Ingredients.
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

const CLUSTERS = [
  { id: 0, label: 'Sweet & Floral', color: '#FAC775' },
  { id: 1, label: 'Acidic & Bright', color: '#5DCAA5' },
  { id: 2, label: 'Earthy & Savory', color: '#97C459' },
  { id: 3, label: 'Bitter & Umami', color: '#7F77DD' },
  { id: 4, label: 'Spicy & Warm', color: '#F0997B' },
  { id: 5, label: 'Fresh & Herbal', color: '#85B7EB' },
  { id: 6, label: 'Smoky & Rich', color: '#888780' },
  { id: 7, label: 'Creamy & Mild', color: '#F4C0D1' },
];

const LX = [80, 300, 520, 760];
const LAYER_LABELS = ['Taste', 'Category', 'Flavor Family', 'Ingredients'];

function hashName(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return h;
}

export default function PerceptronView({ data, onNodeClick, selectedNode, selectedNodes = [] }) {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [drag, setDrag] = useState(null);
  const [hovered, setHovered] = useState(null);
  const [actCat, setActCat] = useState(null);
  const [actTaste, setActTaste] = useState(null);
  const [actCluster, setActCluster] = useState(null);
  const [fired, setFired] = useState(false);
  const touchRef = useRef(0);
  const sel = selectedNode || (selectedNodes.length > 0 ? selectedNodes[0] : null);

  // Compute categories and cluster bins
  const { categories, catTastes, clusterBins, topIng } = useMemo(() => {
    if (!data?.graph) return { categories: [], catTastes: {}, clusterBins: {}, topIng: [] };
    const cc = {}, ct = {}, bins = {};
    for (const c of CLUSTERS) bins[c.id] = [];

    for (const [, n] of data.graph.nodes) {
      const c = n.category || 'other';
      cc[c] = (cc[c] || 0) + 1;
      if (!ct[c]) ct[c] = {};
      const d = domTaste(n.taste);
      if (d) ct[c][d] = (ct[c][d] || 0) + 1;
      const cid = n.cluster ?? Math.abs(hashName(n.name)) % 8;
      if (!bins[cid]) bins[cid] = [];
      bins[cid].push(n);
    }
    const cats = Object.entries(cc).sort((a, b) => b[1] - a[1]).slice(0, 16).map(([name, count]) => {
      const ts = ct[name] || {};
      const dom = Object.entries(ts).sort((a, b) => b[1] - a[1])[0];
      return { name, count, dom: dom ? dom[0] : null };
    });
    const all = [...data.graph.nodes.values()].sort((a, b) => b.pairingCount - a.pairingCount);
    return { categories: cats, catTastes: ct, clusterBins: bins, topIng: all.slice(0, 80) };
  }, [data]);

  // Visible ingredients
  const visIng = useMemo(() => {
    if (!data?.graph) return [];
    const nodes = data.graph.nodes;
    if (sel) {
      const sn = typeof sel === 'string' ? nodes.get(sel) : sel;
      if (!sn) return topIng;
      const nb = getNeighbors(sn.name, data.graph.edges).slice(0, 25);
      return [sn, ...nb.map(n => nodes.get(n.name)).filter(Boolean)];
    }
    if (actTaste) return [...nodes.values()].filter(n => n.taste?.toLowerCase().includes(actTaste)).sort((a, b) => b.pairingCount - a.pairingCount).slice(0, 60);
    if (actCat) return [...nodes.values()].filter(n => n.category === actCat).sort((a, b) => b.pairingCount - a.pairingCount).slice(0, 60);
    if (actCluster != null) return (clusterBins[actCluster] || []).sort((a, b) => b.pairingCount - a.pairingCount).slice(0, 60);
    return topIng;
  }, [data, sel, actTaste, actCat, actCluster, topIng, clusterBins]);

  // Layout points
  const tastePts = useMemo(() => {
    const g = 60, s = 300 - (TASTES.length - 1) * g / 2;
    return TASTES.map((t, i) => ({ ...t, x: LX[0], y: s + i * g }));
  }, []);

  const catPts = useMemo(() => {
    const g = Math.min(36, 520 / Math.max(categories.length, 1));
    const s = 300 - (categories.length - 1) * g / 2;
    return categories.map((c, i) => ({ ...c, x: LX[1], y: s + i * g }));
  }, [categories]);

  const clusterPts = useMemo(() => {
    const g = 55, s = 300 - (CLUSTERS.length - 1) * g / 2;
    return CLUSTERS.map((c, i) => ({ ...c, x: LX[2], y: s + i * g, count: (clusterBins[c.id] || []).length }));
  }, [clusterBins]);

  const ingPts = useMemo(() => {
    const g = Math.min(18, 500 / Math.max(visIng.length, 1));
    const s = 300 - (visIng.length - 1) * g / 2;
    return visIng.map((n, i) => ({ ...n, x: LX[3], y: s + i * g }));
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

  // Pan/zoom
  const onWheel = useCallback(e => { e.preventDefault(); setZoom(z => Math.max(0.2, Math.min(3, z * (e.deltaY > 0 ? 0.9 : 1.1)))); }, []);
  const onPtrDown = useCallback(e => { if (e.button === 0) setDrag({ x: e.clientX - pan.x, y: e.clientY - pan.y }); }, [pan]);
  const onPtrMove = useCallback(e => { if (drag) setPan({ x: e.clientX - drag.x, y: e.clientY - drag.y }); }, [drag]);
  const onPtrUp = useCallback(() => setDrag(null), []);
  const onTouchS = useCallback(e => {
    if (e.touches.length === 2) {
      touchRef.current = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
    } else if (e.touches.length === 1) setDrag({ x: e.touches[0].clientX - pan.x, y: e.touches[0].clientY - pan.y });
  }, [pan]);
  const onTouchM = useCallback(e => {
    if (e.touches.length === 2) {
      const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
      if (touchRef.current > 0) setZoom(z => Math.max(0.2, Math.min(3, z * d / touchRef.current)));
      touchRef.current = d;
    } else if (drag && e.touches.length === 1) setPan({ x: e.touches[0].clientX - drag.x, y: e.touches[0].clientY - drag.y });
  }, [drag]);
  const onTouchE = useCallback(() => { setDrag(null); touchRef.current = 0; }, []);

  // Taste->Category links
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

  // Category->Cluster links (map categories to their dominant cluster)
  const ccLinks = useMemo(() => {
    const links = [];
    for (const cat of categories) {
      const clusterCounts = {};
      for (const [, n] of data?.graph?.nodes || []) {
        if (n.category !== cat.name) continue;
        const cid = n.cluster ?? Math.abs(hashName(n.name)) % 8;
        clusterCounts[cid] = (clusterCounts[cid] || 0) + 1;
      }
      const total = Object.values(clusterCounts).reduce((s, v) => s + v, 0);
      for (const [cid, count] of Object.entries(clusterCounts)) {
        if (count / total > 0.1) { // only show links with >10% representation
          links.push({ cat: cat.name, cluster: parseInt(cid), op: Math.min(0.7, count / total) });
        }
      }
    }
    return links;
  }, [categories, data]);

  const sn = selData?.name;
  const st = selData?.taste?.toLowerCase().split(/\s+/) || [];
  const sc = selData?.category;
  const scl = selData?.cluster ?? null;

  if (!data?.graph) return null;

  return (
    <div className="fixed inset-0 pt-10 bg-[#0a0a0f] z-10 flex flex-col">
      <svg className="w-full h-full cursor-grab active:cursor-grabbing" onWheel={onWheel}
        onPointerDown={onPtrDown} onPointerMove={onPtrMove} onPointerUp={onPtrUp} onPointerLeave={onPtrUp}
        onTouchStart={onTouchS} onTouchMove={onTouchM} onTouchEnd={onTouchE} style={{ touchAction: 'none' }}>
        <defs>
          <filter id="gn" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="b" /><feComposite in="SourceGraphic" in2="b" operator="over" />
          </filter>
          <filter id="gs" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="6" result="b" /><feComposite in="SourceGraphic" in2="b" operator="over" />
          </filter>
        </defs>
        <g transform={`translate(${pan.x},${pan.y}) scale(${zoom})`}>
          {/* Layer labels */}
          {LAYER_LABELS.map((label, i) => (
            <text key={i} x={LX[i]} y={25} textAnchor="middle" fill="#555" fontSize="12" fontFamily="monospace" fontWeight="bold">{label}</text>
          ))}

          {/* Taste → Category connections */}
          {tcLinks.map((lk, i) => {
            const tp = tastePts.find(t => t.key === lk.taste), cp = catPts.find(c => c.name === lk.cat);
            if (!tp || !cp) return null;
            const act = fired && st.includes(lk.taste) && lk.cat === sc;
            return <line key={`tc${i}`} x1={tp.x + 20} y1={tp.y} x2={cp.x - 14} y2={cp.y}
              stroke={TC[lk.taste]} strokeOpacity={act ? 0.7 : lk.op * 0.2} strokeWidth={act ? 2 : 0.4}
              className={act ? 'nn-draw' : ''} />;
          })}

          {/* Category → Cluster connections */}
          {ccLinks.map((lk, i) => {
            const cp = catPts.find(c => c.name === lk.cat);
            const cl = clusterPts.find(c => c.id === lk.cluster);
            if (!cp || !cl) return null;
            const act = fired && sc === lk.cat && scl === lk.cluster;
            return <line key={`cc${i}`} x1={cp.x + 14} y1={cp.y} x2={cl.x - 16} y2={cl.y}
              stroke={cl.color} strokeOpacity={act ? 0.6 : lk.op * 0.15} strokeWidth={act ? 1.5 : 0.4}
              className={act ? 'nn-draw' : ''} />;
          })}

          {/* Cluster → Ingredient connections */}
          {ingPts.map((ing, i) => {
            const cid = ing.cluster ?? Math.abs(hashName(ing.name)) % 8;
            const cl = clusterPts[cid];
            if (!cl) return null;
            const isSel = sn === ing.name;
            return <line key={`ci${i}`} x1={cl.x + 16} y1={cl.y} x2={ing.x - 8} y2={ing.y}
              stroke={cl.color} strokeOpacity={isSel ? 0.5 : 0.06} strokeWidth={isSel ? 1.5 : 0.3}
              className={fired && isSel ? 'nn-draw' : ''} />;
          })}

          {/* Pairing arcs */}
          {fired && sn && ingPts.length > 1 && (() => {
            const sp = ingPts.find(p => p.name === sn);
            if (!sp) return null;
            return getNeighbors(sn, data.graph.edges).slice(0, 10).map((nb, i) => {
              const np = ingPts.find(p => p.name === nb.name);
              if (!np) return null;
              return <path key={`a${i}`}
                d={`M${sp.x + 8},${sp.y} Q${sp.x + 60},${(sp.y + np.y) / 2} ${np.x + 8},${np.y}`}
                fill="none" stroke="#f39c12" strokeOpacity={nb.strength * 0.7} strokeWidth={1 + nb.strength}
                className="nn-arc" />;
            });
          })()}

          {/* Taste nodes */}
          {tastePts.map(t => {
            const act = fired && st.includes(t.key), hov = actTaste === t.key;
            return (<g key={t.key} className="cursor-pointer"
              onClick={() => { setActTaste(actTaste === t.key ? null : t.key); setActCat(null); setActCluster(null); }}>
              <circle cx={t.x} cy={t.y} r={22} fill={t.color} fillOpacity={act || hov ? 0.85 : 0.4}
                stroke={t.color} strokeWidth={act ? 2.5 : 0.5} filter={act ? 'url(#gs)' : 'url(#gn)'}
                className={act ? 'nn-pulse' : ''} />
              <text x={t.x} y={t.y + 3} textAnchor="middle" fill="#fff" fontSize="8" fontFamily="monospace"
                fontWeight="bold" pointerEvents="none">{t.label}</text>
            </g>);
          })}

          {/* Category nodes */}
          {catPts.map(c => {
            const bd = c.dom ? (TC[c.dom] || '#4f8fff') : '#4f8fff';
            const act = fired && sc === c.name, hov = actCat === c.name;
            return (<g key={c.name} className="cursor-pointer"
              onClick={() => { setActCat(actCat === c.name ? null : c.name); setActTaste(null); setActCluster(null); }}>
              <circle cx={c.x} cy={c.y} r={13} fill={act || hov ? bd : '#1a1a2e'}
                fillOpacity={act || hov ? 0.7 : 0.6} stroke={bd} strokeWidth={act ? 2 : 0.5}
                filter={act ? 'url(#gs)' : 'url(#gn)'} className={act ? 'nn-pulse' : ''} />
              <text x={c.x + 18} y={c.y + 3} fill={act ? '#fff' : '#999'} fontSize="8" fontFamily="monospace"
                pointerEvents="none">{c.name}</text>
              <text x={c.x + 18} y={c.y + 13} fill="#555" fontSize="7" fontFamily="monospace"
                pointerEvents="none">{c.count}</text>
            </g>);
          })}

          {/* Cluster nodes */}
          {clusterPts.map(c => {
            const act = actCluster === c.id || (fired && scl === c.id);
            return (<g key={`cl${c.id}`} className="cursor-pointer"
              onClick={() => { setActCluster(actCluster === c.id ? null : c.id); setActTaste(null); setActCat(null); }}>
              <circle cx={c.x} cy={c.y} r={18} fill={c.color} fillOpacity={act ? 0.75 : 0.3}
                stroke={c.color} strokeWidth={act ? 2.5 : 0.5} filter={act ? 'url(#gs)' : 'url(#gn)'}
                className={act ? 'nn-pulse' : ''} />
              <text x={c.x} y={c.y + 3} textAnchor="middle" fill="#fff" fontSize="7"
                fontFamily="monospace" fontWeight="bold" pointerEvents="none">{c.label}</text>
              <text x={c.x} y={c.y + 14} textAnchor="middle" fill={c.color} fontSize="7"
                fontFamily="monospace" opacity={0.5} pointerEvents="none">{c.count}</text>
            </g>);
          })}

          {/* Ingredient nodes */}
          {ingPts.map((ing) => {
            const cid = ing.cluster ?? Math.abs(hashName(ing.name)) % 8;
            const col = CLUSTERS[cid]?.color || tasteColor(ing.taste);
            const isSel = sn === ing.name, isH = hovered === `i-${ing.name}`;
            return (<g key={ing.name} className="cursor-pointer" onClick={() => onNodeClick?.(ing)}
              onMouseEnter={() => setHovered(`i-${ing.name}`)} onMouseLeave={() => setHovered(null)}>
              <circle cx={ing.x} cy={ing.y} r={isSel ? 9 : 6} fill={col}
                fillOpacity={isSel ? 0.9 : isH ? 0.7 : 0.4}
                stroke={isSel ? '#fff' : col} strokeWidth={isSel ? 2 : 0.3}
                filter={isSel ? 'url(#gs)' : 'url(#gn)'}
                className={fired && isSel ? 'nn-pulse' : ''} />
              <text x={ing.x + 12} y={ing.y + 3} textAnchor="start"
                fill={isSel ? '#fff' : isH ? '#ccc' : '#666'} fontSize={isSel ? '8' : '7'} fontFamily="monospace"
                pointerEvents="none">{ing.name}</text>
            </g>);
          })}
        </g>
      </svg>

      {/* Info panel */}
      {fired && selData && (
        <div className="absolute bottom-4 right-4 bg-gray-900/90 border border-gray-700 rounded-lg p-3 w-56 backdrop-blur-sm">
          <div className="text-white text-sm font-mono mb-1">{selData.name}</div>
          <div className="space-y-1 text-[10px] font-mono">
            {selData.taste && <div className="flex gap-2"><span className="text-gray-500">Taste</span><span style={{ color: tasteColor(selData.taste) }}>{selData.taste}</span></div>}
            {selData.category && <div className="flex gap-2"><span className="text-gray-500">Category</span><span className="text-gray-300">{selData.category}</span></div>}
            <div className="flex gap-2 items-center">
              <span className="text-gray-500">Family</span>
              <span className="px-1.5 py-0.5 rounded text-[9px]" style={{ backgroundColor: CLUSTERS[selData.cluster ?? 0]?.color + '30', color: CLUSTERS[selData.cluster ?? 0]?.color }}>
                {CLUSTERS[selData.cluster ?? 0]?.label}
              </span>
            </div>
            <div className="flex gap-2"><span className="text-gray-500">Pairings</span><span className="text-gray-300">{selData.pairingCount}</span></div>
            {selData.bridgingScore != null && (
              <div className="flex gap-2 items-center">
                <span className="text-gray-500">Bridging</span>
                <div className="flex-1 h-1 bg-gray-800 rounded-full overflow-hidden">
                  <div className="h-full rounded-full bg-purple-500/60" style={{ width: `${selData.bridgingScore * 100}%` }} />
                </div>
                <span className="text-gray-600">{(selData.bridgingScore * 100).toFixed(0)}%</span>
              </div>
            )}
          </div>
        </div>
      )}

      <style>{`
        @keyframes nnp { 0%,100%{opacity:.7} 50%{opacity:1} }
        .nn-pulse { animation: nnp 1.5s ease-in-out infinite; }
        @keyframes nnd { from{stroke-dashoffset:500} to{stroke-dashoffset:0} }
        .nn-draw { stroke-dasharray:500; animation: nnd .8s ease-out forwards; }
        @keyframes nna { from{stroke-dashoffset:300;opacity:0} to{stroke-dashoffset:0;opacity:1} }
        .nn-arc { stroke-dasharray:300; animation: nna 1s ease-out .5s both; }
      `}</style>
    </div>
  );
}
