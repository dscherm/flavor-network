import { useState, useEffect, useMemo, useCallback } from 'react';
import NetworkScene from './NetworkScene.jsx';
import CocktailDetailPanel from './CocktailDetailPanel.jsx';
import CocktailBrowse from './CocktailBrowse.jsx';
import {
  loadCodexV2,
  placeCocktailInFamily,
  topSimilar,
  crossFamilySimilar,
  cocktailSimilarity,
} from '../data/cocktailCodexV2.js';
import { createClusterLabels, createGlowSprite } from '../three/AxisLabels.js';
import ClusterJoystick from './ClusterJoystick.jsx';
import ShapeLegend from './ShapeLegend.jsx';
import { cocktailBaseSpiritShape, COCKTAIL_SPIRIT_LEGEND } from '../data/cocktailBaseSpirit.js';

/**
 * CocktailLabV2 — data-driven taxonomy view.
 *
 * Replaces the legacy 7-archetype Cocktail Codex view with the K=6
 * data-driven family taxonomy from `cocktail_codex_v2.json`. See
 * `docs/cocktail-codex-v2/v2.5-impl-spec.md`.
 *
 * Click a cocktail → detail panel with engineering metadata + closest
 * cousins (within-family) + cross-family bridges.
 */
export default function CocktailLabV2({
  onSelectionChange,
  onOpenRecipeLab,
  // Phase 5 bridge: Build path → Cocktail Lab. Shape:
  //   { family?: string, spirit?: string }
  // Pre-selects filter pills on mount so the user lands in the slice
  // matching their Build picks. Optional; null = no pre-filter.
  externalFilter = null,
}) {
  const [graph, setGraph] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedCocktail, setSelectedCocktail] = useState(null);
  const [filterFamily, setFilterFamily] = useState(null);
  const [filterSpirit, setFilterSpirit] = useState(null);
  const [flyToTarget, setFlyToTarget] = useState(null);

  // Apply Build → Lab pre-filter on mount.
  useEffect(() => {
    if (!externalFilter) return;
    if (externalFilter.family) setFilterFamily(externalFilter.family);
    if (externalFilter.spirit) setFilterSpirit(externalFilter.spirit);
  }, [externalFilter]);
  // Explore = the 3D NetworkScene cluster view (existing behavior).
  // Browse = the 2D mini-map + filterable list view (new). Detail
  // panel + cocktail selection state are shared across both modes.
  const [viewMode, setViewMode] = useState('explore');

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(`${import.meta.env.BASE_URL}data/cocktail_codex_v2.json`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const raw = await res.json();
        const g = loadCodexV2(raw);
        if (cancelled) return;
        if (!g) throw new Error('Invalid cocktail_codex_v2.json schema');
        setGraph(g);
        setLoading(false);
      } catch (err) {
        if (!cancelled) {
          setError(err.message);
          setLoading(false);
        }
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  // NetworkScene-compatible data shape: Map<name, node> + positions
  // dictionary keyed by name. Each cocktail's 3D position is computed
  // by `placeCocktailInFamily` (Fibonacci sphere shell + inner-orbit
  // sub-cluster rings).
  const networkData = useMemo(() => {
    if (!graph) return null;
    const nodes = new Map();
    const positionDict = {};
    for (const fam of graph.families) {
      const members = graph.byFamily.get(fam.id) || [];
      // Index sub-clusters within this family so each gets a distinct
      // color tint (lightness shift). Even-indexed subs darken, odd
      // lighten — keeps the family hue but separates the rings.
      const subIds = [...new Set(members.map((m) => m.subcluster_id))].sort();
      const subShade = new Map();
      subIds.forEach((sid, i) => {
        const lightness = i === 0 ? 0 : (i % 2 === 1 ? -18 : 14);
        subShade.set(sid, shiftColorLightness(fam.color, lightness));
      });
      for (const m of members) {
        const pos = placeCocktailInFamily(m, fam, members);
        positionDict[m.name] = [pos.x, pos.y, pos.z];
        const tinted = subShade.get(m.subcluster_id) || fam.color;
        nodes.set(m.name, {
          name: m.name,
          family_id: m.family_id,
          subcluster_id: m.subcluster_id,
          isRoot: m.is_root,
          iba_official: m.iba_official,
          // NodeMesh.getColorForNode short-circuits on `clusterColor`
          // — that's how the cocktail/sauce labs paint per-cluster
          // hues. `color` alone was being ignored and every node fell
          // through to the taste path, which was hard-coded to 'sweet'
          // (= pink) for all 441 cocktails.
          clusterColor: tinted,
          color: tinted,
          taste: '',
          pairingCount: 1,
          cuisines: [],
          // Cocktail nodes 50% larger (1.0 → 1.5); cultural Root
          // doubled on top of that (4.0 = 2× the new regular). Root
          // also gets a permanent activation in CocktailLabV2 so it
          // glows continuously, not just on selection.
          scaleBoost: m.is_root ? 4.0 : 1.5,
        });
      }
    }
    // No edges in v2: NetworkScene's selection effect dims everything
    // and re-brightens the selected node + every edge-connected
    // neighbor. With ~8-12 cosine ≥ 0.85 neighbors per cocktail in our
    // within-family graph, a single click would light up most of the
    // surrounding cluster, making it impossible to tell what was
    // actually selected. Cluster identity is already conveyed by the
    // family color; "similar cocktails" lives in the detail panel.
    const edges = [];
    return {
      graph: {
        nodes,
        edges,
        ingredientList: [],
      },
      positions: { positions: positionDict },
      codex: { clusters: graph.families.map((f) => ({ id: f.id, name: f.name, color: f.color })) },
    };
  }, [graph]);

  // Family centroid lookup (3D position) for camera fly-to + 3D labels.
  // Built from the actual rendered cocktail positions — the abstract
  // sphere-shell point from `placeFamilyOnSphere` is not where any
  // cocktail actually sits, so flying there lands the camera in empty
  // space. We use the Root cocktail's placed position instead.
  const familyCentroids = useMemo(() => {
    if (!graph || !networkData) return null;
    const m = new Map();
    const positions = networkData.positions.positions;
    for (const f of graph.families) {
      const root = graph.rootByFamily.get(f.id);
      const pos = root ? positions[root.name] : null;
      if (pos) {
        m.set(f.id, pos);
      } else {
        const members = graph.byFamily.get(f.id) || [];
        let sx = 0, sy = 0, sz = 0, n = 0;
        for (const c of members) {
          const p = positions[c.name];
          if (!p) continue;
          sx += p[0]; sy += p[1]; sz += p[2]; n++;
        }
        if (n > 0) m.set(f.id, [sx / n, sy / n, sz / n]);
      }
    }
    return m;
  }, [graph, networkData]);

  const familyCentroidAdapter = useMemo(() => {
    if (!familyCentroids) return null;
    return () => {
      const out = [];
      for (const [id, position] of familyCentroids) {
        if (Array.isArray(position) && position.length >= 3) {
          out.push({ id, position });
        }
      }
      return out;
    };
  }, [familyCentroids]);

  const familyMemberCount = useMemo(() => {
    if (!graph) return null;
    const m = new Map();
    for (const f of graph.families) m.set(f.id, f.signature.size);
    return m;
  }, [graph]);

  // Map<name, shapeKey> — base spirit drives shape (gin=cube, whiskey=
  // cylinder, rum=torus, etc.). Built once when the graph loads;
  // NetworkScene's NodeMesh uses this to render multi-shape instances.
  const shapeAssignments = useMemo(() => {
    if (!graph) return null;
    const m = new Map();
    for (const c of graph.cocktails) {
      m.set(c.name, cocktailBaseSpiritShape(c.ingredients_raw));
    }
    return m.size > 0 ? m : null;
  }, [graph]);

  const sceneExtras = useMemo(() => {
    if (!graph || !familyCentroids || !networkData) return null;
    const clusters = graph.families.map((f) => ({
      id: f.id,
      label: f.name,
      color: f.color,
    }));
    const labels = createClusterLabels(clusters, familyCentroids);
    // Add a permanent glow halo around each Cultural Root cocktail
    // — colored by its family hue so the centroid pulses with cluster
    // identity without us having to fight NodeMesh's activation reset
    // on every selection / filter change.
    const positions = networkData.positions.positions;
    for (const f of graph.families) {
      const root = graph.rootByFamily.get(f.id);
      if (!root) continue;
      const pos = positions[root.name];
      if (!pos) continue;
      labels.add(createGlowSprite(pos, f.color, 14));
    }
    return labels;
  }, [graph, familyCentroids, networkData]);

  useEffect(() => {
    if (onSelectionChange) onSelectionChange(selectedCocktail ? [selectedCocktail] : []);
  }, [selectedCocktail, onSelectionChange]);

  const selectedNode = useMemo(() => {
    if (!selectedCocktail || !graph) return null;
    return graph.byCanonical.get(canonicalize(selectedCocktail))
      || [...graph.byCanonical.values()].find((c) => c.name === selectedCocktail)
      || null;
  }, [selectedCocktail, graph]);

  // Within-family closest cousins (cosine ≥ 0.55).
  const similarCocktails = useMemo(() => {
    if (!selectedNode || !graph) return [];
    const within = topSimilar(selectedNode, graph.cocktails, 8, { withinFamily: true });
    const familyById = new Map(graph.families.map((f) => [f.id, f]));
    return within.map(({ cocktail, similarity }) => ({
      name: cocktail.name,
      similarity,
      family_id: cocktail.family_id,
      color: familyById.get(cocktail.family_id)?.color || '#888',
    }));
  }, [selectedNode, graph]);

  // Cross-family bridges — the "where this cocktail breaks ranks" panel.
  const crossFamilyCousins = useMemo(() => {
    if (!selectedNode || !graph) return [];
    const across = crossFamilySimilar(selectedNode, graph.cocktails, 3);
    const familyById = new Map(graph.families.map((f) => [f.id, f]));
    return across.map(({ cocktail, similarity }) => ({
      name: cocktail.name,
      similarity,
      family_id: cocktail.family_id,
      family_name: familyById.get(cocktail.family_id)?.name,
      color: familyById.get(cocktail.family_id)?.color || '#888',
    }));
  }, [selectedNode, graph]);

  const familyForSelected = useMemo(() => {
    if (!selectedNode || !graph) return null;
    return graph.families.find((f) => f.id === selectedNode.family_id) || null;
  }, [selectedNode, graph]);

  const familyFilteredNames = useMemo(() => {
    if (filterFamily == null || !graph) return null;
    const names = (graph.byFamily.get(filterFamily) || []).map((c) => c.name);
    return names.length > 0 ? names : null;
  }, [filterFamily, graph]);

  // Spirit-shape filter: ShapeLegend now acts as a fly-to wheel.
  // Maps selected category ('Gin') → its shape ('cube') → all cocktails
  // whose base-spirit shape matches. Combines with familyFilteredNames
  // when both filters are active (intersection — show only family X
  // cocktails that also use spirit Y).
  const spiritFilteredNames = useMemo(() => {
    if (!filterSpirit || !shapeAssignments) return null;
    const targetShape = COCKTAIL_SPIRIT_LEGEND.find((l) => l.category === filterSpirit)?.shape;
    if (!targetShape) return null;
    const names = [];
    for (const [name, shape] of shapeAssignments) {
      if (shape === targetShape) names.push(name);
    }
    return names.length > 0 ? names : null;
  }, [filterSpirit, shapeAssignments]);

  const combinedFilterNames = useMemo(() => {
    if (familyFilteredNames && spiritFilteredNames) {
      const set = new Set(spiritFilteredNames);
      const inter = familyFilteredNames.filter((n) => set.has(n));
      return inter.length > 0 ? inter : null;
    }
    return familyFilteredNames || spiritFilteredNames;
  }, [familyFilteredNames, spiritFilteredNames]);

  const handleNodeClick = useCallback((node) => {
    if (!node) return;
    setSelectedCocktail(node.name);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center w-full h-full bg-neural-bg pt-10">
        <div className="text-center">
          <div className="relative w-16 h-16 mx-auto mb-4">
            <div className="absolute inset-0 border-2 border-purple-400/30 rounded-full animate-ping" />
            <div className="absolute inset-2 border-2 border-purple-400/50 rounded-full animate-spin" style={{ animationDuration: '2s' }} />
            <div className="absolute inset-[30%] bg-purple-400/80 rounded-full animate-pulse" />
          </div>
          <p className="text-gray-400 text-sm">Loading Cocktail Lab v2…</p>
        </div>
      </div>
    );
  }
  if (error) {
    return (
      <div className="flex items-center justify-center w-full h-full bg-neural-bg pt-10">
        <div className="text-center panel p-6">
          <p className="text-red-400 mb-2">Failed to load v2 cocktail data</p>
          <p className="text-neural-muted text-sm">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Explore (3D) ↔ Browse (2D) toggle. Sits just below the
          global nav (top-10) and is the entry point for the new
          selection-friendly view. State is lab-local. */}
      <div className="fixed top-10 left-1/2 -translate-x-1/2 z-40 flex items-center gap-0.5 p-0.5 rounded-lg bg-[#12121a]/95 backdrop-blur-md border border-[#1e1e2e]">
        {[
          { id: 'explore', label: 'Explore (3D)' },
          { id: 'browse',  label: 'Browse (2D)' },
        ].map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => setViewMode(m.id)}
            className={`px-3 py-1 text-[11px] font-medium rounded-md transition-colors ${
              viewMode === m.id
                ? 'bg-cyan-500/15 text-cyan-200 border border-cyan-400/40'
                : 'text-gray-400 hover:text-gray-200 border border-transparent'
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      {viewMode === 'explore' ? (
        <NetworkScene
          data={networkData}
          onNodeClick={handleNodeClick}
          onNodeHover={() => {}}
          selectedNode={selectedCocktail}
          selectedNodes={selectedCocktail ? [selectedCocktail] : []}
          showEdges={true}
          showParticles={true}
          filterCuisine=""
          filterTaste=""
          profileWeights={null}
          treeFilterIngredients={combinedFilterNames}
          sceneExtras={sceneExtras}
          showNodeLabels={true}
          labelNodeNames={combinedFilterNames}
          flyToTarget={flyToTarget}
          scaleMultiplier={2.5}
          centroidAdapter={familyCentroidAdapter}
          shapeAssignments={shapeAssignments}
        />
      ) : (
        <CocktailBrowse
          graph={graph}
          selectedCocktail={selectedCocktail}
          onSelectCocktail={(name) => setSelectedCocktail(name)}
          filterFamily={filterFamily}
          onFilterFamily={setFilterFamily}
          filterSpirit={filterSpirit}
          onFilterSpirit={setFilterSpirit}
        />
      )}

      {/* Top-of-screen family banner when a family is filtered. Only
          in Explore mode — Browse view shows family context inline. */}
      {viewMode === 'explore' && familyForSelected && selectedCocktail && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-40 px-4 py-2 rounded-lg bg-[#12121a]/90 backdrop-blur-md border border-[#1e1e2e] text-xs text-gray-300 select-none">
          <span className="font-medium" style={{ color: familyForSelected.color }}>
            {familyForSelected.name}
          </span>
          <span className="text-gray-500 mx-2">·</span>
          <span>Root: <span className="text-white">{familyForSelected.cultural_root}</span></span>
          <span className="text-gray-500 mx-2">·</span>
          <span>Sub-cluster: {selectedNode?.subcluster_id || '?'}</span>
        </div>
      )}

      {selectedCocktail && (
        <CocktailDetailPanel
          cocktail={networkData.graph.nodes.get(selectedCocktail)}
          family={familyForSelected ? {
            id: familyForSelected.id,
            name: familyForSelected.name,
            color: familyForSelected.color,
            root: familyForSelected.cultural_root,
            mathRoot: familyForSelected.math_root,
            signature: familyForSelected.signature,
          } : null}
          subclusterLabel={selectedNode?.subcluster_id || null}
          similarCocktails={similarCocktails}
          crossFamilyCousins={crossFamilyCousins}
          engineering={selectedNode ? {
            build: selectedNode.build_method,
            glass: selectedNode.glass,
            ice: selectedNode.ice_format,
            aeration: selectedNode.aeration,
          } : null}
          ingredients={selectedNode?.ingredients_raw || []}
          recipe={selectedNode?.recipe_text || ''}
          onSelectCocktail={(name) => setSelectedCocktail(name)}
          onOpenRecipeLab={onOpenRecipeLab}
          onClose={() => setSelectedCocktail(null)}
        />
      )}

      {selectedCocktail && (
        <div className="fixed top-[100px] right-2 z-50 flex flex-col items-end gap-2">
          <button
            onClick={() => setSelectedCocktail(null)}
            className="px-3 py-1.5 min-h-[44px] text-xs text-gray-400 hover:text-red-400 bg-[#12121a]/90 backdrop-blur-md border border-[#1e1e2e] rounded-lg transition-colors select-none flex items-center gap-1.5"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
            Clear Selection
          </button>
        </div>
      )}

      {/* ClusterJoystick + ShapeLegend are 3D-scene affordances — the
          Browse view has its own family bubbles and spirit chips, so
          we hide both overlays in Browse mode to avoid duplicate UI. */}
      {viewMode === 'explore' && (
        <ClusterJoystick
          clusters={graph.families.map((f) => ({ id: f.id, name: f.name, color: f.color }))}
          mode="ml"
          focusedClusterId={filterFamily}
          onClusterFocus={(id) => setFilterFamily(id)}
          onFlyTo={(family) => {
            const pos = familyCentroids?.get(family.id);
            if (!pos) return;
            setFlyToTarget({
              position: pos,
              memberCount: familyMemberCount?.get(family.id) || 1,
              ts: Date.now(),
            });
          }}
        />
      )}

      {viewMode === 'explore' && (
        <ShapeLegend
          title="Base spirit shapes"
          legend={COCKTAIL_SPIRIT_LEGEND}
          selectedKey={filterSpirit}
          onSelect={setFilterSpirit}
        />
      )}
    </>
  );
}

function canonicalize(s) {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[‘’'`]/g, '')
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Shift the lightness of a hex color by ±N percentage points so each
// sub-cluster within a family reads as a distinct ring (visually) without
// breaking the family hue identity. Positive = lighter, negative = darker.
function shiftColorLightness(hex, deltaPct) {
  if (!hex || !hex.startsWith('#') || hex.length !== 7) return hex;
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l0 = (max + min) / 2;
  const d = max - min;
  let s = 0;
  let h = 0;
  if (d !== 0) {
    s = d / (1 - Math.abs(2 * l0 - 1));
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  const l = Math.max(0, Math.min(100, l0 * 100 + deltaPct)) / 100;
  // HSL → RGB
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let rp = 0, gp = 0, bp = 0;
  if (h < 60) [rp, gp, bp] = [c, x, 0];
  else if (h < 120) [rp, gp, bp] = [x, c, 0];
  else if (h < 180) [rp, gp, bp] = [0, c, x];
  else if (h < 240) [rp, gp, bp] = [0, x, c];
  else if (h < 300) [rp, gp, bp] = [x, 0, c];
  else [rp, gp, bp] = [c, 0, x];
  const to2 = (n) => Math.round((n + m) * 255).toString(16).padStart(2, '0');
  return `#${to2(rp)}${to2(gp)}${to2(bp)}`;
}
