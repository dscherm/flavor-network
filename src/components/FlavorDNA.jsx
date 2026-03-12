import { useMemo } from 'react';
import { buildCuisineTree, getTreeIngredients } from '../data/cuisineTree.js';
import { computeProfileWeights, getTasteSignature } from '../data/profileWeights.js';

/**
 * Compute how similar a user's profile is to each cuisine.
 * Returns a sorted list of { cuisine, score } where score is 0-1.
 */
function computeCuisineSimilarity(profile, nodes) {
  if (!profile || !nodes) return [];

  const userIngredients = new Set([
    ...(profile.ingredients || []),
    ...(profile.recipes || []).flatMap(r =>
      (r.ingredients || []).map(i => (typeof i === 'string' ? i : i.name || '').toLowerCase())
    ),
  ]);

  if (userIngredients.size === 0) return [];

  const cuisineTree = buildCuisineTree(nodes);
  const results = [];

  for (const region of cuisineTree) {
    for (const cuisine of (region.children || [])) {
      const cuisineIngs = new Set(getTreeIngredients(cuisine));
      if (cuisineIngs.size === 0) continue;

      // Jaccard-like similarity weighted toward user coverage
      let overlap = 0;
      for (const ing of userIngredients) {
        if (cuisineIngs.has(ing)) overlap++;
      }

      // Score = overlap / cuisine size (how much of the cuisine do you cover?)
      const score = overlap / cuisineIngs.size;
      if (score > 0) {
        results.push({
          cuisine: cuisine.name,
          rawName: cuisine.rawName,
          score,
          overlap,
          total: cuisineIngs.size,
        });
      }
    }
  }

  results.sort((a, b) => b.score - a.score);
  return results;
}

function RadarChart({ data, size = 200 }) {
  if (!data || data.length === 0) return null;

  const top = data.slice(0, 8);
  const cx = size / 2;
  const cy = size / 2;
  const radius = size / 2 - 30;
  const angleStep = (2 * Math.PI) / top.length;

  // Draw axes and labels
  const axes = top.map((d, i) => {
    const angle = i * angleStep - Math.PI / 2;
    const x = cx + Math.cos(angle) * radius;
    const y = cy + Math.sin(angle) * radius;
    const labelX = cx + Math.cos(angle) * (radius + 16);
    const labelY = cy + Math.sin(angle) * (radius + 16);
    return { x, y, labelX, labelY, label: d.cuisine, angle };
  });

  // Data polygon
  const points = top.map((d, i) => {
    const angle = i * angleStep - Math.PI / 2;
    const r = d.score * radius;
    return `${cx + Math.cos(angle) * r},${cy + Math.sin(angle) * r}`;
  }).join(' ');

  // Grid rings
  const rings = [0.25, 0.5, 0.75, 1.0];

  return (
    <svg width={size} height={size} className="mx-auto">
      {/* Grid rings */}
      {rings.map(r => (
        <circle
          key={r}
          cx={cx} cy={cy}
          r={radius * r}
          fill="none"
          stroke="#1e1e2e"
          strokeWidth={0.5}
        />
      ))}

      {/* Axes */}
      {axes.map((a, i) => (
        <line key={i} x1={cx} y1={cy} x2={a.x} y2={a.y} stroke="#1e1e2e" strokeWidth={0.5} />
      ))}

      {/* Data polygon */}
      <polygon
        points={points}
        fill="rgba(79, 143, 255, 0.15)"
        stroke="rgba(79, 143, 255, 0.6)"
        strokeWidth={1.5}
      />

      {/* Data points */}
      {top.map((d, i) => {
        const angle = i * angleStep - Math.PI / 2;
        const r = d.score * radius;
        return (
          <circle
            key={i}
            cx={cx + Math.cos(angle) * r}
            cy={cy + Math.sin(angle) * r}
            r={3}
            fill="#4f8fff"
            stroke="#12121a"
            strokeWidth={1}
          />
        );
      })}

      {/* Labels */}
      {axes.map((a, i) => (
        <text
          key={i}
          x={a.labelX}
          y={a.labelY}
          textAnchor="middle"
          dominantBaseline="middle"
          className="text-[8px] fill-gray-500"
        >
          {a.label.length > 12 ? a.label.slice(0, 11) + '...' : a.label}
        </text>
      ))}
    </svg>
  );
}

export default function FlavorDNA({ profile, nodes, isOpen, onClose }) {
  const similarities = useMemo(() => computeCuisineSimilarity(profile, nodes), [profile, nodes]);
  const weights = useMemo(() => computeProfileWeights(profile, nodes), [profile, nodes]);
  const tasteSignature = useMemo(() => getTasteSignature(weights, nodes), [weights, nodes]);

  // Compute top percentage breakdown
  const topCuisines = useMemo(() => {
    if (similarities.length === 0) return [];
    const total = similarities.reduce((s, c) => s + c.score, 0);
    if (total === 0) return [];
    return similarities.slice(0, 6).map(c => ({
      ...c,
      percentage: Math.round((c.score / total) * 100),
    }));
  }, [similarities]);

  const isEmpty = similarities.length === 0;

  return (
    <div className={`fixed inset-0 z-[105] flex items-center justify-center transition-opacity duration-300 ${
      isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
    }`}>
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />

      <div className="relative z-10 w-full max-w-md mx-4 bg-[#12121a]/95 backdrop-blur-md border border-[#1e1e2e] rounded-2xl shadow-2xl overflow-hidden max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="px-5 pt-4 pb-2 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-white" style={{ textShadow: '0 0 20px rgba(79,143,255,0.3)' }}>
              Your Flavor DNA
            </h2>
            <p className="text-[10px] text-gray-500 mt-0.5">Profile similarity to world cuisines</p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300 transition-colors text-lg">&times;</button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 pb-5">
          {isEmpty ? (
            <div className="text-center py-12">
              <p className="text-sm text-gray-400">Add ingredients or recipes to see your Flavor DNA</p>
            </div>
          ) : (
            <>
              {/* Radar chart */}
              <RadarChart data={similarities} size={220} />

              {/* Percentage breakdown */}
              <div className="mt-4 space-y-1.5">
                <p className="text-[10px] text-gray-500 uppercase tracking-wider font-medium">Your profile is...</p>
                {topCuisines.map(c => (
                  <div key={c.cuisine} className="flex items-center gap-2">
                    <span className="text-xs text-gray-300 w-24 truncate">{c.cuisine}</span>
                    <div className="flex-1 h-2 bg-[#1a1a2e] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-neural-glow/60 to-purple-500/60 rounded-full transition-all duration-500"
                        style={{ width: `${c.percentage}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-gray-500 w-8 text-right">{c.percentage}%</span>
                  </div>
                ))}
              </div>

              {/* Taste signature */}
              {Object.keys(tasteSignature).length > 0 && (
                <div className="mt-4">
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider font-medium mb-1.5">Taste Signature</p>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(tasteSignature)
                      .sort((a, b) => b[1] - a[1])
                      .map(([taste, proportion]) => (
                        <div key={taste} className="text-center">
                          <div
                            className="w-10 h-10 rounded-full border border-neural-glow/20 flex items-center justify-center mx-auto"
                            style={{
                              background: `radial-gradient(circle, rgba(79,143,255,${proportion * 0.4}) 0%, transparent 70%)`,
                            }}
                          >
                            <span className="text-[10px] text-neural-glow font-medium">{Math.round(proportion * 100)}%</span>
                          </div>
                          <span className="text-[8px] text-gray-500 capitalize mt-0.5 block">{taste}</span>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* Detailed scores */}
              <div className="mt-4">
                <p className="text-[10px] text-gray-500 uppercase tracking-wider font-medium mb-1.5">All Cuisine Matches</p>
                <div className="space-y-0.5 max-h-36 overflow-y-auto">
                  {similarities.slice(0, 20).map(c => (
                    <div key={c.cuisine} className="flex items-center justify-between text-[10px] py-0.5">
                      <span className="text-gray-400">{c.cuisine}</span>
                      <span className="text-gray-600">{c.overlap}/{c.total} ingredients</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
