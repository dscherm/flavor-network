import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import Fuse from 'fuse.js';
import { findStrongestPath } from '../data/graph.js';
import { colorForTaste } from '../utils/color.js';

/**
 * Fuzzy search input with dropdown, styled to match the main SearchBar.
 */
function BridgeSearchInput({ label, value, onSelect, ingredientList, placeholder }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const inputRef = useRef(null);
  const containerRef = useRef(null);

  const fuse = useMemo(() => {
    const docs = (ingredientList || []).map((n) => ({ name: n }));
    return new Fuse(docs, { keys: ['name'], threshold: 0.4 });
  }, [ingredientList]);

  const handleChange = useCallback((e) => {
    const v = e.target.value;
    setQuery(v);
    if (v.trim().length === 0) {
      setResults([]);
      setIsOpen(false);
      setHighlightIndex(-1);
      return;
    }
    const matched = fuse.search(v, { limit: 6 });
    setResults(matched.map((r) => r.item));
    setIsOpen(matched.length > 0);
    setHighlightIndex(-1);
  }, [fuse]);

  const selectItem = useCallback((name) => {
    onSelect(name);
    setQuery(name);
    setResults([]);
    setIsOpen(false);
    setHighlightIndex(-1);
  }, [onSelect]);

  const handleKeyDown = useCallback((e) => {
    if (!isOpen || results.length === 0) {
      if (e.key === 'Escape') {
        setIsOpen(false);
        inputRef.current?.blur();
      }
      return;
    }
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightIndex((prev) => (prev < results.length - 1 ? prev + 1 : 0));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightIndex((prev) => (prev > 0 ? prev - 1 : results.length - 1));
        break;
      case 'Enter':
        e.preventDefault();
        if (highlightIndex >= 0 && highlightIndex < results.length) {
          selectItem(results[highlightIndex].name);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        setHighlightIndex(-1);
        break;
      default:
        break;
    }
  }, [isOpen, results, highlightIndex, selectItem]);

  // Update display when value is cleared externally
  useEffect(() => {
    if (!value) setQuery('');
  }, [value]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
        setHighlightIndex(-1);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <label className="block text-[10px] uppercase tracking-wider text-gray-500 mb-1">{label}</label>
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onFocus={() => { if (results.length > 0) setIsOpen(true); }}
        placeholder={placeholder}
        aria-label={label}
        className="w-full px-3 py-2 rounded-lg bg-[#0a0a0f] border border-gray-700 text-gray-100 placeholder-gray-600 text-sm outline-none transition-all focus:border-[#4f8fff] focus:shadow-[0_0_12px_rgba(79,143,255,0.2)]"
      />
      {isOpen && results.length > 0 && (
        <ul className="absolute left-0 right-0 mt-1 rounded-lg bg-[#0e0e18] border border-gray-700 max-h-48 overflow-y-auto shadow-lg z-10">
          {results.map((item, index) => (
            <li
              key={item.name}
              role="option"
              aria-selected={index === highlightIndex}
              onMouseDown={(e) => { e.preventDefault(); selectItem(item.name); }}
              onMouseEnter={() => setHighlightIndex(index)}
              className={`px-3 py-2 cursor-pointer text-sm text-gray-200 transition-colors ${
                index === highlightIndex ? 'bg-[#4f8fff]/20 text-white' : 'hover:bg-[#4f8fff]/10'
              }`}
            >
              {item.name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * Get the edge strength between two adjacent ingredients.
 */
function getEdgeStrength(a, b, edges) {
  for (const edge of edges) {
    if ((edge.source === a && edge.target === b) || (edge.source === b && edge.target === a)) {
      return edge.strength;
    }
  }
  return 0;
}

/**
 * Extract primary taste from a node object.
 */
function primaryTaste(node) {
  if (!node) return null;
  const taste = node.taste;
  if (!taste) return null;
  // taste can be a string like "sweet, sour" — take the first
  const first = taste.split(/[,;\/]/).map(s => s.trim().toLowerCase()).filter(Boolean)[0];
  return first || null;
}

export default function FlavorBridge({ nodes, edges, ingredientList, isOpen, onClose, onSelectIngredient }) {
  const [fromIngredient, setFromIngredient] = useState(null);
  const [toIngredient, setToIngredient] = useState(null);

  // Compute path
  const path = useMemo(() => {
    if (!fromIngredient || !toIngredient || !edges) return [];
    if (fromIngredient === toIngredient) return [];
    return findStrongestPath(fromIngredient, toIngredient, edges);
  }, [fromIngredient, toIngredient, edges]);

  // Compute edge strengths along the path
  const pathEdges = useMemo(() => {
    if (path.length < 2) return [];
    const result = [];
    for (let i = 0; i < path.length - 1; i++) {
      result.push({
        from: path[i],
        to: path[i + 1],
        strength: getEdgeStrength(path[i], path[i + 1], edges),
      });
    }
    return result;
  }, [path, edges]);

  // Check if direct pairing exists
  const directStrength = useMemo(() => {
    if (!fromIngredient || !toIngredient || !edges) return null;
    if (fromIngredient === toIngredient) return null;
    const s = getEdgeStrength(fromIngredient, toIngredient, edges);
    return s > 0 ? s : null;
  }, [fromIngredient, toIngredient, edges]);

  // Taste chain along path
  const tasteChain = useMemo(() => {
    if (path.length === 0 || !nodes) return [];
    const tastes = [];
    const seen = new Set();
    for (const name of path) {
      const node = nodes.get(name);
      const t = primaryTaste(node);
      if (t && !seen.has(t)) {
        seen.add(t);
        tastes.push(t);
      }
    }
    return tastes;
  }, [path, nodes]);

  // "Random Bridge" — pick two ingredients that are 3-5 steps apart
  const handleSurpriseMe = useCallback(() => {
    if (!ingredientList || ingredientList.length < 2 || !edges) return;
    // Try up to 30 random pairs to find a 3-5 step path
    for (let attempt = 0; attempt < 30; attempt++) {
      const a = ingredientList[Math.floor(Math.random() * ingredientList.length)];
      const b = ingredientList[Math.floor(Math.random() * ingredientList.length)];
      if (a === b) continue;
      const p = findStrongestPath(a, b, edges, 5);
      if (p.length >= 4 && p.length <= 6) { // 3-5 steps = 4-6 nodes
        setFromIngredient(a);
        setToIngredient(b);
        return;
      }
    }
    // Fallback: just pick any two that have a path
    for (let attempt = 0; attempt < 20; attempt++) {
      const a = ingredientList[Math.floor(Math.random() * ingredientList.length)];
      const b = ingredientList[Math.floor(Math.random() * ingredientList.length)];
      if (a === b) continue;
      const p = findStrongestPath(a, b, edges, 5);
      if (p.length >= 2) {
        setFromIngredient(a);
        setToIngredient(b);
        return;
      }
    }
  }, [ingredientList, edges]);

  // Reset state when panel closes
  useEffect(() => {
    if (!isOpen) {
      setFromIngredient(null);
      setToIngredient(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const bothSelected = fromIngredient && toIngredient;
  const sameIngredient = bothSelected && fromIngredient === toIngredient;
  const noPath = bothSelected && !sameIngredient && path.length === 0;
  const steps = path.length > 1 ? path.length - 1 : 0;

  return (
    <div className="fixed left-0 top-0 bottom-0 z-50 w-[360px] max-w-[calc(100vw-1rem)] bg-[#12121a]/95 backdrop-blur-md border-r border-[#1e1e2e] flex flex-col overflow-hidden"
      style={{ paddingTop: 'var(--nav-h, 40px)' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#1e1e2e]">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
          </svg>
          <h2 className="text-sm font-semibold text-gray-100">Flavor Bridge</h2>
        </div>
        <button
          onClick={onClose}
          className="p-1 text-gray-500 hover:text-gray-300 transition-colors rounded"
          aria-label="Close Flavor Bridge"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
        {/* Search inputs */}
        <div className="space-y-3">
          <BridgeSearchInput
            label="From ingredient"
            value={fromIngredient}
            onSelect={setFromIngredient}
            ingredientList={ingredientList}
            placeholder="e.g. garlic"
          />
          <BridgeSearchInput
            label="To ingredient"
            value={toIngredient}
            onSelect={setToIngredient}
            ingredientList={ingredientList}
            placeholder="e.g. basil"
          />
        </div>

        {/* Random Bridge button */}
        <button
          onClick={handleSurpriseMe}
          className="w-full px-3 py-2 text-xs font-medium text-gray-300 bg-[#1a1a2a] hover:bg-[#222233] border border-[#2a2a3a] rounded-lg transition-colors flex items-center justify-center gap-2"
        >
          <svg className="w-3.5 h-3.5 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 12c0-1.232-.046-2.453-.138-3.662a4.006 4.006 0 00-3.7-3.7 48.678 48.678 0 00-7.324 0 4.006 4.006 0 00-3.7 3.7c-.017.22-.032.441-.046.662M19.5 12l3-3m-3 3l-3-3m-12 3c0 1.232.046 2.453.138 3.662a4.006 4.006 0 003.7 3.7 48.656 48.656 0 007.324 0 4.006 4.006 0 003.7-3.7c.017-.22.032-.441.046-.662M4.5 12l3 3m-3-3l-3 3" />
          </svg>
          Random Bridge
        </button>

        {/* Same ingredient warning */}
        {sameIngredient && (
          <p className="text-xs text-yellow-400/80">
            Both inputs are the same ingredient. Pick two different ingredients to find a bridge.
          </p>
        )}

        {/* Path visualization */}
        {bothSelected && !sameIngredient && !noPath && nodes && path.length >= 2 && (
          <div className="space-y-1">
            <h3 className="text-[10px] uppercase tracking-wider text-gray-500 mb-2">Connection Path</h3>
            <div className="space-y-0">
              {path.map((name, i) => {
                const node = nodes.get(name);
                const taste = primaryTaste(node);
                const tasteColor = colorForTaste(taste);
                const edgeAfter = i < pathEdges.length ? pathEdges[i] : null;

                return (
                  <div key={name}>
                    {/* Node */}
                    <div className="flex items-center gap-2 group">
                      {/* Taste dot */}
                      <div
                        className="w-2.5 h-2.5 rounded-full flex-shrink-0 ring-1 ring-white/10"
                        style={{ backgroundColor: tasteColor, boxShadow: `0 0 6px ${tasteColor}40` }}
                      />
                      {/* Name */}
                      <button
                        onClick={() => onSelectIngredient(name)}
                        className="text-sm text-gray-200 hover:text-cyan-300 transition-colors text-left"
                        title={`View ${name} in network`}
                      >
                        {name}
                      </button>
                      {/* Taste badge */}
                      {taste && (
                        <span
                          className="text-[9px] px-1.5 py-0.5 rounded-full font-medium"
                          style={{
                            backgroundColor: `${tasteColor}20`,
                            color: tasteColor,
                            border: `1px solid ${tasteColor}30`,
                          }}
                        >
                          {taste}
                        </span>
                      )}
                    </div>

                    {/* Edge connector */}
                    {edgeAfter && (
                      <div className="flex items-center gap-2 py-1 ml-[5px]">
                        {/* Vertical line */}
                        <div className="flex flex-col items-center">
                          <div
                            className="w-0.5 h-5"
                            style={{
                              background: `linear-gradient(to bottom, ${colorForTaste(primaryTaste(nodes.get(edgeAfter.from)))}, ${colorForTaste(primaryTaste(nodes.get(edgeAfter.to)))})`,
                              opacity: 0.5,
                            }}
                          />
                        </div>
                        {/* Strength label */}
                        <span className="text-[10px] text-gray-500 font-mono">
                          {Math.round(edgeAfter.strength * 100)}%
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Path explanation */}
        {bothSelected && !sameIngredient && (
          <div className="space-y-1.5 pt-1">
            <h3 className="text-[10px] uppercase tracking-wider text-gray-500">Path Info</h3>
            {noPath ? (
              <p className="text-xs text-gray-400">
                No connection found within 5 steps.
              </p>
            ) : directStrength !== null ? (
              <div className="text-xs text-gray-300 space-y-1">
                <p className="text-cyan-400 font-medium">
                  Direct pairing! Strength: {Math.round(directStrength * 100)}%
                </p>
                {steps > 1 && (
                  <p className="text-gray-400">
                    {steps} steps from {fromIngredient} to {toIngredient}
                  </p>
                )}
              </div>
            ) : (
              <div className="text-xs text-gray-400 space-y-1">
                <p>
                  {steps} {steps === 1 ? 'step' : 'steps'} from <span className="text-gray-200">{fromIngredient}</span> to <span className="text-gray-200">{toIngredient}</span>
                </p>
                <p className="text-gray-500">
                  Each step follows the strongest available pairing.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Shared taste analysis */}
        {bothSelected && !sameIngredient && tasteChain.length > 0 && !noPath && (
          <div className="space-y-1.5 pt-1">
            <h3 className="text-[10px] uppercase tracking-wider text-gray-500">Taste Journey</h3>
            <div className="flex items-center gap-1 flex-wrap">
              {tasteChain.map((taste, i) => {
                const color = colorForTaste(taste);
                return (
                  <span key={taste} className="flex items-center gap-1">
                    {i > 0 && (
                      <svg className="w-3 h-3 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                    )}
                    <span
                      className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                      style={{
                        backgroundColor: `${color}20`,
                        color: color,
                        border: `1px solid ${color}30`,
                      }}
                    >
                      {taste}
                    </span>
                  </span>
                );
              })}
            </div>
            <p className="text-[10px] text-gray-600">
              This bridge goes through: {tasteChain.join(' \u2192 ')}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
