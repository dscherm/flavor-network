import { useState, useMemo, useCallback } from 'react';
import { buildProfileTree, findProfileGaps } from '../data/profileTree.js';
import { computeProfileWeights } from '../data/profileWeights.js';

function TreeNode({ node, depth, expanded, onToggle, weights }) {
  const hasChildren = node.children && node.children.length > 0;
  const isExpanded = expanded.has(node.id);
  const weight = weights?.get(node.name) || 0;

  // Size indicator based on weight or recipe count
  const sizeIndicator = weight > 0 ? weight : 0;

  return (
    <>
      <button
        onClick={() => hasChildren && onToggle(node.id)}
        className="w-full text-left flex items-center gap-1.5 py-1.5 px-2 rounded transition-all text-xs group hover:bg-white/5 text-gray-300"
        style={{ paddingLeft: `${depth * 14 + 8}px` }}
      >
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

        {/* Weight indicator dot */}
        {weight > 0 && (
          <span
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{
              backgroundColor: `rgba(79, 143, 255, ${0.3 + weight * 0.7})`,
              boxShadow: weight > 0.5 ? `0 0 4px rgba(79, 143, 255, ${weight * 0.5})` : 'none',
            }}
          />
        )}

        <span className="truncate flex-1">{node.name}</span>

        {/* Recipe count or ingredient count */}
        {node.type === 'ingredient' && node.recipeCount > 0 && (
          <span className="text-[9px] text-gray-600 flex-shrink-0">
            {node.recipeCount}r
          </span>
        )}
        {(node.type === 'section' || node.type === 'cuisine' || node.type === 'recipe') && (
          <span className="text-[9px] bg-white/5 text-gray-500 rounded-full px-1.5 py-0.5 flex-shrink-0">
            {node.ingredientCount}
          </span>
        )}
      </button>

      {hasChildren && isExpanded && (
        <div>
          {node.children.map(child => (
            <TreeNode
              key={child.id}
              node={child}
              depth={depth + 1}
              expanded={expanded}
              onToggle={onToggle}
              weights={weights}
            />
          ))}
        </div>
      )}
    </>
  );
}

export default function ProfileTreeView({ profile, nodes, isOpen, onClose, onAddIngredient }) {
  const [expanded, setExpanded] = useState(new Set(['my-cuisines', 'my-ingredients', 'my-recipes']));

  const tree = useMemo(() => buildProfileTree(profile, nodes), [profile, nodes]);
  const gaps = useMemo(() => findProfileGaps(profile, nodes), [profile, nodes]);
  const weights = useMemo(() => computeProfileWeights(profile, nodes), [profile, nodes]);

  const handleToggle = useCallback((id) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const isEmpty = tree.length === 0;

  return (
    <div className={`fixed top-16 right-0 bottom-4 z-40 flex items-stretch select-none ${isOpen ? '' : 'pointer-events-none'}`}>
      <div className={`w-80 bg-[#12121a]/90 backdrop-blur-md border border-[#1e1e2e] rounded-l-lg flex flex-col overflow-hidden transition-transform duration-300 ease-in-out ${
        isOpen ? 'translate-x-0' : 'translate-x-full'
      }`}>
        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b border-[#1e1e2e]">
          <h2 className="text-sm font-medium text-gray-200 tracking-wide">My Flavor Tree</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300 transition-colors text-lg leading-none">
            &times;
          </button>
        </div>

        {isEmpty ? (
          <div className="flex-1 flex items-center justify-center p-6">
            <div className="text-center">
              <p className="text-sm text-gray-400 mb-2">No profile data yet</p>
              <p className="text-xs text-gray-600">Add ingredients, cuisines, or recipes to see your flavor tree.</p>
            </div>
          </div>
        ) : (
          <>
            {/* Tree */}
            <div className="flex-1 overflow-y-auto py-1">
              {tree.map(node => (
                <TreeNode
                  key={node.id}
                  node={node}
                  depth={0}
                  expanded={expanded}
                  onToggle={handleToggle}
                  weights={weights}
                />
              ))}
            </div>

            {/* Gaps / Suggestions */}
            {gaps.length > 0 && (
              <div className="border-t border-[#1e1e2e] p-3">
                <p className="text-[10px] text-amber-400/70 uppercase tracking-wider font-medium mb-1.5">
                  You might be missing
                </p>
                <p className="text-[9px] text-gray-600 mb-2">
                  Common in your cuisines but not in your profile:
                </p>
                <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
                  {gaps.slice(0, 15).map(({ name, cuisines }) => (
                    <button
                      key={name}
                      onClick={() => onAddIngredient && onAddIngredient(name)}
                      className="text-[9px] bg-amber-500/10 text-amber-300/70 hover:bg-amber-500/20 rounded px-1.5 py-0.5 transition-colors flex items-center gap-0.5"
                      title={`Common in: ${cuisines.map(c => c.replace(/ cuisines?$/i, '')).join(', ')}`}
                    >
                      <span>+</span>
                      {name}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
