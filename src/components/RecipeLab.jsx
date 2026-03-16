import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { getNeighbors } from '../data/graph.js';
import { computeRadialLayout } from '../data/recipeLayout.js';
import NotebookCanvas from './NotebookCanvas.jsx';
import RecipePanel from './RecipePanel.jsx';
import SearchBar from './SearchBar.jsx';

export default function RecipeLab({ fullData, initialIngredient, userProfile }) {
  const [centerIngredient, setCenterIngredient] = useState(initialIngredient || null);
  const [recipeIngredients, setRecipeIngredients] = useState([]);
  const [recipeTitle, setRecipeTitle] = useState('');
  const [hoveredNode, setHoveredNode] = useState(null);
  const containerRef = useRef(null);
  const [size, setSize] = useState({ width: 800, height: 600 });

  // Responsive sizing
  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize({ width: Math.max(300, width), height: Math.max(300, height) });
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  // Sync initialIngredient when it changes
  useEffect(() => {
    if (initialIngredient && initialIngredient !== centerIngredient) {
      setCenterIngredient(initialIngredient);
    }
  }, [initialIngredient]);

  // Compute pairings for center ingredient
  const pairings = useMemo(() => {
    if (!fullData || !centerIngredient) return [];
    return getNeighbors(centerIngredient, fullData.graph.edges);
  }, [fullData, centerIngredient]);

  // Compute layout positions
  const layoutPositions = useMemo(() => {
    if (!fullData || !centerIngredient || pairings.length === 0) return null;
    return computeRadialLayout(centerIngredient, pairings, fullData.graph.nodes);
  }, [fullData, centerIngredient, pairings]);

  const ingredientList = useMemo(() => {
    if (!fullData) return [];
    return fullData.graph.ingredientList;
  }, [fullData]);

  const handleClickNode = useCallback((name) => {
    if (!name) return;
    // If clicking center, do nothing
    if (name === centerIngredient) return;

    // If already in recipe, re-center on it
    if (recipeIngredients.includes(name)) {
      setCenterIngredient(name);
      return;
    }

    // Add to recipe
    setRecipeIngredients(prev => [...prev, name]);
  }, [centerIngredient, recipeIngredients]);

  const handleRemoveIngredient = useCallback((name) => {
    setRecipeIngredients(prev => prev.filter(n => n !== name));
  }, []);

  const handleRecenter = useCallback((name) => {
    setCenterIngredient(name);
  }, []);

  const handleClear = useCallback(() => {
    setRecipeIngredients([]);
    setRecipeTitle('');
  }, []);

  const handleSave = useCallback(() => {
    if (recipeIngredients.length < 2) return;
    const recipe = {
      name: recipeTitle || 'Untitled Recipe',
      ingredients: recipeIngredients,
      createdAt: Date.now(),
    };
    userProfile?.addRecipe?.(recipe);
  }, [recipeIngredients, recipeTitle, userProfile]);

  const handleSearchSelect = useCallback((name) => {
    setCenterIngredient(name);
    if (!recipeIngredients.includes(name)) {
      setRecipeIngredients(prev => [...prev, name]);
    }
  }, [recipeIngredients]);

  // Panel width for layout calculation
  const panelWidth = 280;
  const canvasWidth = Math.max(300, size.width - panelWidth);

  return (
    <div className="fixed inset-0 pt-10 flex" style={{ backgroundColor: '#fefae0' }}>
      {/* Search bar */}
      <div className="absolute top-12 left-1/2 -translate-x-1/2 z-20" style={{ width: 320 }}>
        <div className="relative">
          <input
            type="text"
            placeholder="Search ingredients..."
            className="w-full px-4 py-2 rounded-lg border-2 border-[#c9b99a] bg-[#fefae0] text-lg outline-none focus:border-[#8a7a5a] placeholder-[#b8a88a]"
            style={{ fontFamily: 'Caveat, cursive', color: '#3a3428' }}
            onFocus={(e) => {
              // Piggyback on existing SearchBar
              const sb = document.querySelector('[data-recipe-search]');
              if (sb) sb.style.display = 'block';
            }}
          />
        </div>
        <SearchBar
          ingredients={ingredientList}
          onSelect={handleSearchSelect}
        />
      </div>

      {/* Canvas area */}
      <div ref={containerRef} className="flex-1 relative overflow-hidden">
        {!centerIngredient && (
          <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
            <div className="text-center" style={{ fontFamily: 'Caveat, cursive' }}>
              <p className="text-3xl mb-2" style={{ color: '#7a6a4a' }}>Recipe Lab</p>
              <p className="text-xl" style={{ color: '#a09070' }}>
                Search for an ingredient to start planning your recipe
              </p>
            </div>
          </div>
        )}
        <NotebookCanvas
          centerIngredient={centerIngredient}
          layoutPositions={layoutPositions}
          recipeIngredients={recipeIngredients}
          hoveredNode={hoveredNode}
          onHoverNode={setHoveredNode}
          onClickNode={handleClickNode}
          width={canvasWidth}
          height={size.height}
        />
      </div>

      {/* Recipe panel sidebar */}
      <div
        className="flex-shrink-0 border-l-2 border-[#d8cca8] overflow-hidden"
        style={{ width: panelWidth, backgroundColor: '#fef9e0' }}
      >
        <RecipePanel
          ingredients={recipeIngredients}
          nodes={fullData?.graph?.nodes}
          edges={fullData?.graph?.edges}
          onRemove={handleRemoveIngredient}
          onRecenter={handleRecenter}
          onClear={handleClear}
          onSave={handleSave}
          recipeTitle={recipeTitle}
          onTitleChange={setRecipeTitle}
        />
      </div>
    </div>
  );
}
