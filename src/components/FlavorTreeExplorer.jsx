import { useState, useMemo, useCallback, memo } from 'react';
import { buildCuisineTree, getTreeIngredients } from '../data/cuisineTree.js';
import { buildTasteTree, getTasteIngredients } from '../data/tasteTree.js';
import { buildIngredientFamilyTree } from '../data/ingredientFamilyTree.js';
import { buildSeasonTree, getSeasonIngredients } from '../data/seasonTree.js';
import { buildRegionTree, getRegionIngredients } from '../data/regionTree.js';

const VIEW_MODES = [
  { key: 'cuisine', label: 'Cuisine' },
  { key: 'taste', label: 'Taste' },
  { key: 'family', label: 'Family' },
  { key: 'season', label: 'Season' },
  { key: 'region', label: 'Region' },
];

const TreeNode = memo(function TreeNode({ node, depth, expanded, onToggle, onSelect, selectedId }) {
  const hasChildren = node.children && node.children.length > 0;
  const isExpanded = expanded.has(node.id);
  const isSelected = selectedId === node.id;

  return (
    <>
      <button
        onClick={(e) => {
          if (hasChildren) onToggle(node.id);
          onSelect(node, e);
        }}
        className={`w-full text-left flex items-center gap-1.5 py-1.5 px-2 rounded transition-all text-xs group hover:bg-white/5 ${
          isSelected ? 'bg-neural-glow/10 text-neural-glow' : 'text-gray-300'
        }`}
        style={{ paddingLeft: `${depth * 14 + 8}px` }}
      >
        {/* Expand/collapse arrow */}
        {hasChildren ? (
          <svg
            className={`w-3 h-3 flex-shrink-0 transition-transform duration-200 text-gray-500 ${isExpanded ? 'rotate-90' : ''}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        ) : (
          <span className="w-3 flex-shrink-0" />
        )}

        {/* Node name */}
        <span className="truncate flex-1">{node.name}</span>

        {/* Ingredient count badge */}
        <span className={`text-[9px] px-1.5 py-0.5 rounded-full flex-shrink-0 ${
          isSelected ? 'bg-neural-glow/20 text-neural-glow' : 'bg-white/5 text-gray-500'
        }`}>
          {node.ingredientCount}
        </span>
      </button>

      {/* Children */}
      {hasChildren && isExpanded && (
        <div>
          {node.children.map(child => (
            <TreeNode
              key={child.id}
              node={child}
              depth={depth + 1}
              expanded={expanded}
              onToggle={onToggle}
              onSelect={onSelect}
              selectedId={selectedId}
            />
          ))}
        </div>
      )}
    </>
  );
});

function BreadcrumbTrail({ path, onNavigate }) {
  if (path.length === 0) return null;
  return (
    <div className="flex items-center gap-1 px-3 py-1.5 text-[10px] text-gray-500 border-b border-[#1e1e2e]/50 overflow-x-auto">
      <button onClick={() => onNavigate(null)} className="hover:text-gray-300 transition-colors">
        All
      </button>
      {path.map((item, i) => (
        <span key={item.id} className="flex items-center gap-1">
          <span className="text-gray-600">/</span>
          <button
            onClick={() => onNavigate(item)}
            className={`hover:text-gray-300 transition-colors ${i === path.length - 1 ? 'text-neural-glow' : ''}`}
          >
            {item.name}
          </button>
        </span>
      ))}
    </div>
  );
}

function StatsBar({ node }) {
  if (!node) return null;

  const tasteProfile = node.tasteProfile;
  const hasTaste = tasteProfile && Object.keys(tasteProfile).length > 0;

  return (
    <div className="px-3 py-2 border-t border-[#1e1e2e]/50 bg-[#0e0e16]/50">
      <div className="flex items-center justify-between text-[10px] text-gray-400 mb-1.5">
        <span className="font-medium text-gray-300">{node.name}</span>
        <span>{node.ingredientCount} ingredients</span>
      </div>

      {/* Taste profile bars */}
      {hasTaste && (
        <div className="space-y-0.5">
          {Object.entries(tasteProfile)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([taste, proportion]) => (
              <div key={taste} className="flex items-center gap-2">
                <span className="text-[9px] text-gray-500 w-12 text-right capitalize">{taste}</span>
                <div className="flex-1 h-1 bg-[#1a1a2e] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-neural-glow/50 rounded-full"
                    style={{ width: `${Math.round(proportion * 100)}%` }}
                  />
                </div>
                <span className="text-[9px] text-gray-600 w-7">{Math.round(proportion * 100)}%</span>
              </div>
            ))}
        </div>
      )}

      {/* Dominant taste for family nodes */}
      {node.dominantTaste && (
        <div className="text-[10px] text-gray-500 mt-1">
          Dominant taste: <span className="text-gray-300 capitalize">{node.dominantTaste}</span>
        </div>
      )}

      {/* Average pairings for family nodes */}
      {node.avgPairings > 0 && (
        <div className="text-[10px] text-gray-500">
          Avg pairings: <span className="text-gray-300">{node.avgPairings}</span>
        </div>
      )}

      {/* Top cuisines */}
      {(node.cuisineAssociations || node.cuisineVariations) && (
        <div className="mt-1.5">
          <span className="text-[9px] text-gray-500 uppercase tracking-wider">Top cuisines</span>
          <div className="flex flex-wrap gap-1 mt-0.5">
            {(node.cuisineAssociations || node.cuisineVariations || []).slice(0, 5).map(({ cuisine }) => (
              <span key={cuisine} className="text-[9px] bg-white/5 text-gray-400 rounded px-1 py-0.5">
                {cuisine.replace(/ cuisines?$/i, '')}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function getIngredientsForNode(node, viewMode) {
  switch (viewMode) {
    case 'cuisine': return getTreeIngredients(node);
    case 'taste': return getTasteIngredients(node);
    case 'season': return getSeasonIngredients(node);
    case 'region': return getRegionIngredients(node);
    case 'family': return node.ingredients || [];
    default: return [];
  }
}

const CompareView = memo(function CompareView({ nodeA, nodeB, viewMode }) {
  const ingsA = new Set(getIngredientsForNode(nodeA, viewMode));
  const ingsB = new Set(getIngredientsForNode(nodeB, viewMode));
  const shared = [...ingsA].filter(i => ingsB.has(i));
  const uniqueA = [...ingsA].filter(i => !ingsB.has(i));
  const uniqueB = [...ingsB].filter(i => !ingsA.has(i));

  // Taste profile overlay
  const tasteA = nodeA.tasteProfile || {};
  const tasteB = nodeB.tasteProfile || {};
  const allTastes = [...new Set([...Object.keys(tasteA), ...Object.keys(tasteB)])].sort();

  return (
    <div className="flex-1 overflow-y-auto p-3 space-y-3">
      <div className="text-[11px] text-gray-400 text-center">
        <span className="text-neural-glow">{nodeA.name}</span>
        {' vs '}
        <span className="text-purple-400">{nodeB.name}</span>
      </div>

      {/* Taste profile comparison */}
      {allTastes.length > 0 && (
        <div className="space-y-1">
          <p className="text-[10px] text-gray-500 uppercase tracking-wider">Taste Profile</p>
          {allTastes.map(taste => (
            <div key={taste} className="flex items-center gap-1.5">
              <span className="text-[9px] text-gray-500 w-12 text-right capitalize">{taste}</span>
              <div className="flex-1 flex gap-0.5">
                <div className="flex-1 h-1.5 bg-[#1a1a2e] rounded-full overflow-hidden flex justify-end">
                  <div className="h-full bg-neural-glow/60 rounded-full" style={{ width: `${Math.round((tasteA[taste] || 0) * 100)}%` }} />
                </div>
                <div className="flex-1 h-1.5 bg-[#1a1a2e] rounded-full overflow-hidden">
                  <div className="h-full bg-purple-400/60 rounded-full" style={{ width: `${Math.round((tasteB[taste] || 0) * 100)}%` }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="bg-neural-glow/5 rounded p-1.5">
          <p className="text-[10px] text-neural-glow font-medium">{uniqueA.length}</p>
          <p className="text-[8px] text-gray-500">Only {nodeA.name}</p>
        </div>
        <div className="bg-white/5 rounded p-1.5">
          <p className="text-[10px] text-green-400 font-medium">{shared.length}</p>
          <p className="text-[8px] text-gray-500">Shared</p>
        </div>
        <div className="bg-purple-500/5 rounded p-1.5">
          <p className="text-[10px] text-purple-400 font-medium">{uniqueB.length}</p>
          <p className="text-[8px] text-gray-500">Only {nodeB.name}</p>
        </div>
      </div>

      {/* Shared ingredients */}
      {shared.length > 0 && (
        <div>
          <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Shared ({shared.length})</p>
          <div className="flex flex-wrap gap-1">
            {shared.slice(0, 30).map(name => (
              <span key={name} className="text-[9px] bg-green-500/10 text-green-300/70 rounded px-1.5 py-0.5">{name}</span>
            ))}
            {shared.length > 30 && <span className="text-[9px] text-gray-600">+{shared.length - 30} more</span>}
          </div>
        </div>
      )}

      {/* Unique to A */}
      {uniqueA.length > 0 && (
        <div>
          <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Only in {nodeA.name} ({uniqueA.length})</p>
          <div className="flex flex-wrap gap-1">
            {uniqueA.slice(0, 20).map(name => (
              <span key={name} className="text-[9px] bg-neural-glow/10 text-neural-glow/70 rounded px-1.5 py-0.5">{name}</span>
            ))}
            {uniqueA.length > 20 && <span className="text-[9px] text-gray-600">+{uniqueA.length - 20} more</span>}
          </div>
        </div>
      )}

      {/* Unique to B */}
      {uniqueB.length > 0 && (
        <div>
          <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Only in {nodeB.name} ({uniqueB.length})</p>
          <div className="flex flex-wrap gap-1">
            {uniqueB.slice(0, 20).map(name => (
              <span key={name} className="text-[9px] bg-purple-500/10 text-purple-300/70 rounded px-1.5 py-0.5">{name}</span>
            ))}
            {uniqueB.length > 20 && <span className="text-[9px] text-gray-600">+{uniqueB.length - 20} more</span>}
          </div>
        </div>
      )}
    </div>
  );
});

export default function FlavorTreeExplorer({ nodes, isOpen, onClose, onFilterIngredients }) {
  const [viewMode, setViewMode] = useState('cuisine');
  const [expanded, setExpanded] = useState(new Set());
  const [selectedNode, setSelectedNode] = useState(null);
  const [compareNode, setCompareNode] = useState(null);
  const [breadcrumb, setBreadcrumb] = useState([]);

  // Build trees (memoized)
  const cuisineTree = useMemo(() => buildCuisineTree(nodes), [nodes]);
  const tasteTree = useMemo(() => buildTasteTree(nodes), [nodes]);
  const familyTree = useMemo(() => buildIngredientFamilyTree(nodes), [nodes]);
  const seasonTree = useMemo(() => buildSeasonTree(nodes), [nodes]);
  const regionTree = useMemo(() => buildRegionTree(nodes), [nodes]);

  const currentTree = useMemo(() => {
    switch (viewMode) {
      case 'cuisine': return cuisineTree;
      case 'taste': return tasteTree;
      case 'family': return familyTree;
      case 'season': return seasonTree;
      case 'region': return regionTree;
      default: return [];
    }
  }, [viewMode, cuisineTree, tasteTree, familyTree, seasonTree, regionTree]);

  const handleToggle = useCallback((id) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleSelect = useCallback((node, event) => {
    // Shift+click to compare
    if (event?.shiftKey && selectedNode && selectedNode.id !== node.id) {
      setCompareNode(node);
      // Filter 3D to show both sets combined
      if (onFilterIngredients) {
        const ingsA = getIngredientsForNode(selectedNode, viewMode);
        const ingsB = getIngredientsForNode(node, viewMode);
        onFilterIngredients([...new Set([...ingsA, ...ingsB])], `${selectedNode.name} vs ${node.name}`);
      }
      return;
    }

    // Regular click
    setCompareNode(null);
    const isDeselecting = selectedNode?.id === node.id;
    setSelectedNode(prev => prev?.id === node.id ? null : node);

    // Update breadcrumb
    if (node.type === 'region' || node.type === 'continent' || node.type === 'taste' || node.type === 'season' || node.type === 'family') {
      setBreadcrumb([node]);
    } else {
      for (const parent of currentTree) {
        if (parent.children?.some(c => c.id === node.id)) {
          setBreadcrumb([parent, node]);
          break;
        }
      }
    }

    // Get ingredients for this node and filter the 3D view
    if (onFilterIngredients) {
      if (isDeselecting) {
        onFilterIngredients(null, null);
      } else {
        const ingredients = getIngredientsForNode(node, viewMode);
        onFilterIngredients(ingredients, node.name);
      }
    }
  }, [currentTree, viewMode, onFilterIngredients, selectedNode]);

  const handleClearCompare = useCallback(() => {
    setCompareNode(null);
    if (selectedNode && onFilterIngredients) {
      onFilterIngredients(getIngredientsForNode(selectedNode, viewMode), selectedNode.name);
    }
  }, [selectedNode, viewMode, onFilterIngredients]);

  const handleBreadcrumbNavigate = useCallback((item) => {
    if (!item) {
      setSelectedNode(null);
      setCompareNode(null);
      setBreadcrumb([]);
      if (onFilterIngredients) onFilterIngredients(null, null);
    } else {
      handleSelect(item);
    }
  }, [handleSelect, onFilterIngredients]);

  const handleModeChange = useCallback((mode) => {
    setViewMode(mode);
    setExpanded(new Set());
    setSelectedNode(null);
    setCompareNode(null);
    setBreadcrumb([]);
    if (onFilterIngredients) onFilterIngredients(null, null);
  }, [onFilterIngredients]);

  return (
    <div className={`fixed right-0 z-40 flex items-stretch select-none ${isOpen ? '' : 'pointer-events-none'}`} style={{ top: 'calc(var(--nav-h) + 2.5rem)', bottom: 'var(--bottom-safe)' }}>
      {/* Panel */}
      <div className={`w-80 bg-[#12121a]/90 backdrop-blur-md border border-[#1e1e2e] rounded-l-lg flex flex-col overflow-hidden transition-transform duration-300 ease-in-out ${
        isOpen ? 'translate-x-0' : 'translate-x-full'
      }`}>
        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b border-[#1e1e2e]">
          <h2 className="text-sm font-medium text-gray-200 tracking-wide">Flavor Trees</h2>
          <button
            onClick={onClose}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center text-gray-500 hover:text-gray-300 transition-colors text-lg leading-none"
            aria-label="Close flavor trees"
          >
            &times;
          </button>
        </div>

        {/* View mode tabs */}
        <div className="flex border-b border-[#1e1e2e]">
          {VIEW_MODES.map(mode => (
            <button
              key={mode.key}
              onClick={() => handleModeChange(mode.key)}
              className={`flex-1 min-h-[44px] py-2 text-[11px] transition-colors flex items-center justify-center ${
                viewMode === mode.key
                  ? 'text-neural-glow border-b-2 border-neural-glow'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              {mode.label}
            </button>
          ))}
        </div>

        {/* Breadcrumb */}
        <BreadcrumbTrail path={breadcrumb} onNavigate={handleBreadcrumbNavigate} />

        {/* Compare mode */}
        {compareNode && selectedNode ? (
          <>
            <div className="px-3 py-1.5 border-b border-[#1e1e2e]/50 flex items-center justify-between">
              <span className="text-[10px] text-gray-500 uppercase tracking-wider">Comparison Mode</span>
              <button onClick={handleClearCompare} className="text-[10px] text-gray-500 hover:text-gray-300 transition-colors">
                Exit
              </button>
            </div>
            <CompareView nodeA={selectedNode} nodeB={compareNode} viewMode={viewMode} />
          </>
        ) : (
          <>
            {/* Tree content */}
            <div className="flex-1 overflow-y-auto py-1">
              {currentTree.map(node => (
                <TreeNode
                  key={node.id}
                  node={node}
                  depth={0}
                  expanded={expanded}
                  onToggle={handleToggle}
                  onSelect={handleSelect}
                  selectedId={selectedNode?.id}
                />
              ))}
              {currentTree.length === 0 && (
                <p className="text-xs text-gray-600 text-center mt-8">No data available</p>
              )}
              {/* Compare hint */}
              {selectedNode && !compareNode && (
                <p className="text-[9px] text-gray-600 text-center mt-2 px-4">
                  Shift+click another node to compare
                </p>
              )}
            </div>

            {/* Stats bar for selected node */}
            {selectedNode && <StatsBar node={selectedNode} />}
          </>
        )}
      </div>
    </div>
  );
}
