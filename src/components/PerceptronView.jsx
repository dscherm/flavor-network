/**
 * PerceptronView.jsx — GAT Architecture Diagram for the Flavor Network.
 * Renders the actual model architecture: Taste Profile → GAT Attention Heads → Embedding → Clusters → Ingredients.
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
  { id: 0, label: 'sweet-floral', color: '#FAC775' },
  { id: 1, label: 'acidic-bright', color: '#5DCAA5' },
  { id: 2, label: 'earthy-savory', color: '#97C459' },
  { id: 3, label: 'bitter-umami', color: '#7F77DD' },
  { id: 4, label: 'spicy-warm', color: '#F0997B' },
  { id: 5, label: 'fresh-herbal', color: '#85B7EB' },
  { id: 6, label: 'smoky-rich', color: '#888780' },
  { id: 7, label: 'creamy-mild', color: '#F4C0D1' },
];

// 5 layer x-positions
const LX = [80, 260, 440, 620, 820];
const LAYER_LABELS = ['Taste Profile', 'GAT Layer 1', 'Embedding', 'Clusters', 'Ingredients'];
const LAYER_SUBLABELS = ['8-dim input', '4 attention heads', '8-dim output', 'k-means', ''];

// 4 attention head colors
const HEAD_COLORS = ['#4f8fff', '#ff6b9d', '#4ecdc4', '#f39c12'];

export default function PerceptronView({ data, onNodeClick, selectedNode, selectedNodes = [] }) {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [drag, setDrag] = useState(null);
  const [hovered, setHovered] = useState(null);
  const [actCluster, setActCluster] = useState(null);
  const [actTaste, setActTaste] = useState(null);
  const [fired, setFired] = useState(false);
  const touchRef = useRef(0);
  const sel = selectedNode || (selectedNodes.length > 0 ? selectedNodes[0] : null);

  // Build cluster bins from ingredient data
  const { clusterBins, topIng } = useMemo(() => {
    if (!data?.graph) return { clusterBins: {}, topIng: [] };
    const bins = {};
    for (const c of CLUSTERS) bins[c.id] = [];
    const all = [];
    for (const [, n] of data.graph.nodes) {
      all.push(n);
      const cid = n.cluster ?? Math.abs(hashName(n.name)) % 8;
      if (!bins[cid]) bins[cid] = [];
      bins[cid].push(n);
    }
    all.sort((a, b) => b.pairingCount - a.pairingCount);
    return { clusterBins: bins, topIng: all.slice(0, 80) };
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
    if (actCluster != null) return (clusterBins[actCluster] || []).sort((a, b) => b.pairingCount - a.pairingCount).slice(0, 60);
    return topIng;
  }, [data, sel, actTaste, actCluster, topIng, clusterBins]);

  // Layout points
  const tastePts = useMemo(() => {
    const g = 60, s = 300 - (TASTES.length - 1) * g / 2;
    return TASTES.map((t, i) => ({ ...t, x: LX[0], y: s + i * g }));
  }, []);

  // GAT hidden layer: 4 heads × 4 nodes each = 16 hidden nodes
  const headPts = useMemo(() => {
    const pts = [];
    for (let h = 0; h < 4; h++) {
      for (let n = 0; n < 4; n++) {
        const y = 160 + h * 120 + n * 25;
        pts.push({ head: h, idx: n, x: LX[1], y, color: HEAD_COLORS[h] });
      }
    }
    return pts;
  }, []);

  // Embedding layer: 8 nodes
  const embPts = useMemo(() => {
    const g = 55, s = 300 - 7 * g / 2;
    return Array.from({ length: 8 }, (_, i) => ({ idx: i, x: LX[2], y: s + i * g }));
  }, []);

  // Cluster layer: 8 clusters
  const clusterPts = useMemo(() => {
    const g = 60, s = 300 - (CLUSTERS.length - 1) * g / 2;
    return CLUSTERS.map((c, i) => ({ ...c, x: LX[3], y: s + i * g, count: (clusterBins[c.id] || []).length }));
  }, [clusterBins]);

  // Ingredient points
  const ingPts = useMemo(() => {
    const g = Math.min(18, 500 / Math.max(visIng.length, 1));
    const s = 300 - (visIng.length - 1) * g / 2;
    return visIng.map((n, i) => ({ ...n, x: LX[4], y: s + i * g }));
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

  // Pan/zoom handlers
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

  const sn = selData?.name;
  const st = selData?.taste?.toLowerCase().split(/\s+/) || [];
  const sc = selData?.cluster ?? null;

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
            <g key={i}>
              <text x={LX[i]} y={22} textAnchor="middle" fill="#555" fontSize="11" fontFamily="monospace" fontWeight="bold">{label}</text>
              {LAYER_SUBLABELS[i] && <text x={LX[i]} y={36} textAnchor="middle" fill="#333" fontSize="9" fontFamily="monospace">{LAYER_SUBLABELS[i]}</text>}
            </g>
          ))}

          {/* Connections: Taste → GAT Heads (sparse, colored by head) */}
          {headPts.map((hp, i) => {
            const srcTaste = tastePts[Math.floor(hp.head * 2 + hp.idx / 2) % 8];
            if (!srcTaste) return null;
            const act = fired && st.includes(srcTaste.key);
            return <line key={`th${i}`} x1={srcTaste.x + 20} y1={srcTaste.y} x2={hp.x - 8} y2={hp.y}
              stroke={hp.color} strokeOpacity={act ? 0.6 : 0.08} strokeWidth={act ? 1.5 : 0.4} />;
          })}

          {/* Connections: GAT Heads → Embedding */}
          {headPts.map((hp, i) => {
            const tgtEmb = embPts[hp.idx % 8 + (hp.head < 2 ? 0 : 4)] || embPts[i % 8];
            if (!tgtEmb) return null;
            return <line key={`he${i}`} x1={hp.x + 8} y1={hp.y} x2={tgtEmb.x - 8} y2={tgtEmb.y}
              stroke={hp.color} strokeOpacity={0.06} strokeWidth={0.4} />;
          })}

          {/* Connections: Embedding → Clusters */}
          {embPts.map((ep, i) => {
            const tgt = clusterPts[i];
            if (!tgt) return null;
            return <line key={`ec${i}`} x1={ep.x + 8} y1={ep.y} x2={tgt.x - 18} y2={tgt.y}
              stroke={tgt.color} strokeOpacity={0.12} strokeWidth={0.6} />;
          })}

          {/* Connections: Cluster → Ingredients */}
          {ingPts.map((ing, i) => {
            const cid = ing.cluster ?? Math.abs(hashName(ing.name)) % 8;
            const cp = clusterPts[cid];
            if (!cp) return null;
            const isSel = sn === ing.name;
            return <line key={`ci${i}`} x1={cp.x + 18} y1={cp.y} x2={ing.x - 8} y2={ing.y}
              stroke={cp.color} strokeOpacity={isSel ? 0.6 : 0.08} strokeWidth={isSel ? 1.5 : 0.3}
              className={fired && isSel ? 'gat-draw' : ''} />;
          })}

          {/* Pairing arcs between selected ingredient and its neighbors */}
          {fired && sn && ingPts.length > 1 && (() => {
            const sp = ingPts.find(p => p.name === sn);
            if (!sp) return null;
            return getNeighbors(sn, data.graph.edges).slice(0, 10).map((nb, i) => {
              const np = ingPts.find(p => p.name === nb.name);
              if (!np) return null;
              const isNovel = nb.known === false;
              return <path key={`a${i}`}
                d={`M${sp.x + 8},${sp.y} Q${sp.x + 70},${(sp.y + np.y) / 2} ${np.x + 8},${np.y}`}
                fill="none" stroke={isNovel ? '#7F77DD' : '#f39c12'}
                strokeOpacity={nb.strength * 0.7} strokeWidth={1 + nb.strength}
                strokeDasharray={isNovel ? '4 3' : 'none'}
                className="gat-arc" />;
            });
          })()}

          {/* Layer 1: Taste Profile nodes */}
          {tastePts.map(t => {
            const act = fired && st.includes(t.key), hov = actTaste === t.key;
            return (<g key={t.key} className="cursor-pointer" onClick={() => { setActTaste(actTaste === t.key ? null : t.key); setActCluster(null); }}
              onMouseEnter={() => setHovered(`t-${t.key}`)} onMouseLeave={() => setHovered(null)}>
              <circle cx={t.x} cy={t.y} r={20} fill={t.color} fillOpacity={act || hov ? 0.9 : 0.4}
                stroke={t.color} strokeWidth={act ? 2 : 0.5} filter={act ? 'url(#gs)' : 'url(#gn)'}
                className={act ? 'gat-pulse' : ''} />
              <text x={t.x} y={t.y + 3} textAnchor="middle" fill="#fff" fontSize="8" fontFamily="monospace"
                fontWeight="bold" pointerEvents="none">{t.label}</text>
            </g>);
          })}

          {/* Layer 2: GAT Attention Head nodes */}
          {headPts.map((hp, i) => {
            const label = `H${hp.head + 1}`;
            return (<g key={`h${i}`}>
              <circle cx={hp.x} cy={hp.y} r={6} fill={hp.color} fillOpacity={0.35}
                stroke={hp.color} strokeWidth={0.5} filter="url(#gn)" />
              {hp.idx === 0 && <text x={hp.x - 12} y={hp.y + 3} textAnchor="end" fill={hp.color}
                fontSize="8" fontFamily="monospace" fontWeight="bold" opacity={0.6}>{label}</text>}
            </g>);
          })}

          {/* Layer 3: Embedding nodes */}
          {embPts.map((ep, i) => (
            <g key={`e${i}`}>
              <circle cx={ep.x} cy={ep.y} r={8} fill="#2a2a4a" stroke="#4f8fff"
                strokeWidth={0.5} fillOpacity={0.8} filter="url(#gn)" />
              <text x={ep.x} y={ep.y + 3} textAnchor="middle" fill="#4f8fff" fontSize="7"
                fontFamily="monospace" pointerEvents="none">d{i + 1}</text>
            </g>
          ))}

          {/* Layer 4: Cluster nodes */}
          {clusterPts.map(c => {
            const act = actCluster === c.id || (fired && sc === c.id);
            return (<g key={`cl${c.id}`} className="cursor-pointer"
              onClick={() => { setActCluster(actCluster === c.id ? null : c.id); setActTaste(null); }}
              onMouseEnter={() => setHovered(`cl-${c.id}`)} onMouseLeave={() => setHovered(null)}>
              <circle cx={c.x} cy={c.y} r={16} fill={c.color} fillOpacity={act ? 0.8 : 0.3}
                stroke={c.color} strokeWidth={act ? 2 : 0.5} filter={act ? 'url(#gs)' : 'url(#gn)'}
                className={act ? 'gat-pulse' : ''} />
              <text x={c.x} y={c.y + 3} textAnchor="middle" fill="#fff" fontSize="6"
                fontFamily="monospace" pointerEvents="none">{c.label}</text>
              <text x={c.x} y={c.y + 12} textAnchor="middle" fill={c.color} fontSize="7"
                fontFamily="monospace" opacity={0.5} pointerEvents="none">{c.count}</text>
            </g>);
          })}

          {/* Layer 5: Ingredient nodes */}
          {ingPts.map((ing, i) => {
            const cid = ing.cluster ?? Math.abs(hashName(ing.name)) % 8;
            const col = CLUSTERS[cid]?.color || tasteColor(ing.taste);
            const isSel = sn === ing.name, isH = hovered === `i-${ing.name}`;
            const isNovel = ing.known === false;
            return (<g key={ing.name} className="cursor-pointer" onClick={() => onNodeClick?.(ing)}
              onMouseEnter={() => setHovered(`i-${ing.name}`)} onMouseLeave={() => setHovered(null)}>
              <circle cx={ing.x} cy={ing.y} r={isSel ? 9 : 6} fill={col}
                fillOpacity={isSel ? 0.9 : isH ? 0.7 : 0.4}
                stroke={isNovel ? '#7F77DD' : isSel ? '#fff' : col}
                strokeWidth={isSel ? 2 : isNovel ? 1 : 0.3}
                strokeDasharray={isNovel ? '2 2' : 'none'}
                filter={isSel ? 'url(#gs)' : 'url(#gn)'}
                className={fired && isSel ? 'gat-pulse' : ''} />
              <text x={ing.x + 12} y={ing.y + 3} textAnchor="start"
                fill={isSel ? '#fff' : isH ? '#ccc' : '#666'} fontSize={isSel ? '8' : '7'} fontFamily="monospace"
                pointerEvents="none">{ing.name}</text>
            </g>);
          })}
        </g>
      </svg>

      {/* Info panel */}
      {fired && selData && (
        <div className="absolute bottom-4 right-4 bg-gray-900/90 border border-gray-700 rounded-lg p-3 w-60 backdrop-blur-sm">
          <div className="text-gray-400 text-[10px] font-mono uppercase tracking-wider mb-1">GAT Embedding</div>
          <div className="text-white text-sm font-mono mb-2">{selData.name}</div>
          {selData.embeddingFull && (
            <div className="space-y-0.5 mb-2">
              {selData.embeddingFull.slice(0, 8).map((v, i) => (
                <div key={i} className="flex items-center gap-1">
                  <span className="text-gray-600 text-[8px] font-mono w-4">d{i + 1}</span>
                  <div className="flex-1 h-1 bg-gray-800 rounded-full overflow-hidden">
                    <div className="h-full rounded-full bg-blue-500/60" style={{ width: `${Math.abs(v) * 50}%`, marginLeft: v < 0 ? `${50 - Math.abs(v) * 50}%` : '50%' }} />
                  </div>
                  <span className="text-gray-600 text-[8px] font-mono w-8 text-right">{v.toFixed(2)}</span>
                </div>
              ))}
            </div>
          )}
          <div className="flex items-center gap-2 text-[10px]">
            <span className="text-gray-500 font-mono">cluster</span>
            <span className="px-1.5 py-0.5 rounded text-white font-mono" style={{ backgroundColor: CLUSTERS[selData.cluster ?? 0]?.color + '40' }}>
              {selData.clusterLabel || CLUSTERS[selData.cluster ?? 0]?.label}
            </span>
          </div>
          {selData.bridgingScore != null && (
            <div className="flex items-center gap-2 text-[10px] mt-1">
              <span className="text-gray-500 font-mono">bridging</span>
              <div className="flex-1 h-1 bg-gray-800 rounded-full overflow-hidden">
                <div className="h-full rounded-full bg-purple-500/60" style={{ width: `${selData.bridgingScore * 100}%` }} />
              </div>
              <span className="text-gray-600 font-mono">{selData.bridgingScore.toFixed(2)}</span>
            </div>
          )}
        </div>
      )}

      {/* Legend */}
      <div className="absolute top-14 right-4 bg-gray-900/70 border border-gray-800 rounded-lg p-2 backdrop-blur-sm">
        <div className="text-[9px] text-gray-500 font-mono mb-1">Attention Heads</div>
        <div className="flex gap-1.5">
          {HEAD_COLORS.map((c, i) => (
            <div key={i} className="flex items-center gap-0.5">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: c }} />
              <span className="text-[8px] text-gray-500 font-mono">H{i + 1}</span>
            </div>
          ))}
        </div>
        <div className="text-[9px] text-gray-500 font-mono mt-1.5 mb-0.5">Novel pairing</div>
        <div className="flex items-center gap-1">
          <div className="w-4 h-0 border-t border-dashed border-purple-400" />
          <span className="text-[8px] text-gray-500 font-mono">predicted</span>
        </div>
      </div>

      <style>{`
        @keyframes gp { 0%,100%{opacity:.7} 50%{opacity:1} }
        .gat-pulse { animation: gp 1.5s ease-in-out infinite; }
        @keyframes gd { from{stroke-dashoffset:500} to{stroke-dashoffset:0} }
        .gat-draw { stroke-dasharray:500; animation: gd .8s ease-out forwards; }
        @keyframes ga { from{stroke-dashoffset:300;opacity:0} to{stroke-dashoffset:0;opacity:1} }
        .gat-arc { stroke-dasharray:300; animation: ga 1s ease-out .5s both; }
      `}</style>
    </div>
  );
}

function hashName(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return h;
}
