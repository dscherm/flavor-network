import { useState, useEffect, useMemo, useCallback } from 'react';
import NetworkScene from './NetworkScene.jsx';
import CocktailDetailPanel from './CocktailDetailPanel.jsx';
import {
  loadCodexV2,
  placeCocktailInFamily,
  topSimilar,
  crossFamilySimilar,
  cocktailSimilarity,
} from '../data/cocktailCodexV2.js';
import { createClusterLabels } from '../three/AxisLabels.js';
import ClusterJoystick from './ClusterJoystick.jsx';

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
export default function CocktailLabV2({ onSelectionChange, onOpenRecipeLab }) {
  const [graph, setGraph] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedCocktail, setSelectedCocktail] = useState(null);
  const [filterFamily, setFilterFamily] = useState(null);
  const [flyToTarget, setFlyToTarget] = useState(null);

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

  // Family centroid lookup (3D position) for camera fly-to + 3D labels.
  const familyCentroids = useMemo(() => {
    if (!graph) return null;
    const m = new Map();
    for (const f of graph.families) {
      const p = f.position;
      m.set(f.id, [p.x, p.y, p.z]);
    }
    return m;
  }, [graph]);

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
      for (const m of members) {
        const pos = placeCocktailInFamily(m, fam, members);
        positionDict[m.name] = [pos.x, pos.y, pos.z];
        nodes.set(m.name, {
          name: m.name,
          family_id: m.family_id,
          subcluster_id: m.subcluster_id,
          isRoot: m.is_root,
          iba_official: m.iba_official,
          color: fam.color,
          // NetworkScene reads `taste` for legacy taste-blend coloring;
          // we inject a per-family hue here so the existing renderer
          // colors nodes by family without further changes.
          taste: m.iba_official ? 'sweet' : 'sweet',
          pairingCount: 1,
          cuisines: [],
        });
      }
    }
    return {
      graph: {
        nodes,
        edges: [], // Phase 7d: re-introduce cosine-similarity edges
        ingredientList: [],
      },
      positions: { positions: positionDict },
      codex: { clusters: graph.families.map((f) => ({ id: f.id, name: f.name, color: f.color })) },
    };
  }, [graph]);

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

  const sceneExtras = useMemo(() => {
    if (!graph || !familyCentroids) return null;
    const clusters = graph.families.map((f) => ({
      id: f.id,
      label: f.name,
      color: f.color,
    }));
    return createClusterLabels(clusters, familyCentroids);
  }, [graph, familyCentroids]);

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
      <NetworkScene
        data={networkData}
        onNodeClick={handleNodeClick}
        onNodeHover={() => {}}
        selectedNode={selectedCocktail}
        selectedNodes={selectedCocktail ? [selectedCocktail] : []}
        showEdges={false}
        showParticles={true}
        filterCuisine=""
        filterTaste=""
        profileWeights={null}
        treeFilterIngredients={familyFilteredNames}
        sceneExtras={sceneExtras}
        showNodeLabels={true}
        labelNodeNames={familyFilteredNames}
        flyToTarget={flyToTarget}
        scaleMultiplier={3.0}
        centroidAdapter={familyCentroidAdapter}
      />

      {/* Top-of-screen family banner when a family is filtered */}
      {familyForSelected && selectedCocktail && (
        <div className="fixed top-12 left-1/2 -translate-x-1/2 z-40 px-4 py-2 rounded-lg bg-[#12121a]/90 backdrop-blur-md border border-[#1e1e2e] text-xs text-gray-300 select-none">
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
