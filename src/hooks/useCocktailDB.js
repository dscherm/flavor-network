/**
 * useCocktailDB.js — TheCocktailDB API hook with localStorage caching.
 *
 * Endpoints (free, no auth):
 *   Search by name:       /search.php?s={name}
 *   Filter by ingredient: /filter.php?i={ingredient}
 *   Lookup by ID:         /lookup.php?i={id}
 *   Random:               /random.php
 *
 * Cache: localStorage with 24-hour TTL per query.
 */

import { useState, useCallback } from 'react';

const API_BASE = 'https://www.thecocktaildb.com/api/json/v1/1';
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

// ---------------------------------------------------------------------------
// Cache helpers
// ---------------------------------------------------------------------------

function cacheKey(type, query) {
  return `cocktaildb_${type}_${query.toLowerCase().replace(/\s+/g, '_')}`;
}

function getFromCache(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const { data, timestamp } = JSON.parse(raw);
    if (Date.now() - timestamp > CACHE_TTL) {
      localStorage.removeItem(key);
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

function setCache(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify({ data, timestamp: Date.now() }));
  } catch {
    // localStorage full — silently fail
  }
}

// ---------------------------------------------------------------------------
// Response normalization
// ---------------------------------------------------------------------------

function normalizeDrink(raw) {
  if (!raw) return null;

  const ingredients = [];
  for (let i = 1; i <= 15; i++) {
    const name = raw[`strIngredient${i}`];
    const measure = raw[`strMeasure${i}`];
    if (name && name.trim()) {
      ingredients.push({
        name: name.trim().toLowerCase(),
        measure: measure ? measure.trim() : '',
      });
    }
  }

  return {
    id: raw.idDrink,
    name: raw.strDrink || 'Unknown',
    image: raw.strDrinkThumb || null,
    glass: raw.strGlass || null,
    category: raw.strCategory || null,
    alcoholic: raw.strAlcoholic || null,
    instructions: raw.strInstructions || '',
    ingredients,
  };
}

function normalizeDrinkList(drinks) {
  if (!drinks || !Array.isArray(drinks)) return [];
  return drinks.map(normalizeDrink).filter(Boolean);
}

// Minimal card from filter endpoint (only has id, name, image)
function normalizeFilterResult(raw) {
  if (!raw) return null;
  return {
    id: raw.idDrink,
    name: raw.strDrink || 'Unknown',
    image: raw.strDrinkThumb || null,
  };
}

// ---------------------------------------------------------------------------
// API fetch
// ---------------------------------------------------------------------------

async function fetchAPI(url, key) {
  const cached = getFromCache(key);
  if (cached) return cached;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`CocktailDB API error: ${res.status}`);
  const json = await res.json();
  setCache(key, json);
  return json;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export default function useCocktailDB() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const searchByName = useCallback(async (query) => {
    if (!query || !query.trim()) return [];
    setLoading(true);
    setError(null);
    try {
      const key = cacheKey('search', query);
      const json = await fetchAPI(`${API_BASE}/search.php?s=${encodeURIComponent(query.trim())}`, key);
      return normalizeDrinkList(json.drinks);
    } catch (err) {
      setError(err.message);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const searchByIngredient = useCallback(async (ingredient) => {
    if (!ingredient || !ingredient.trim()) return [];
    setLoading(true);
    setError(null);
    try {
      const key = cacheKey('ingredient', ingredient);
      const json = await fetchAPI(`${API_BASE}/filter.php?i=${encodeURIComponent(ingredient.trim())}`, key);
      return (json.drinks || []).map(normalizeFilterResult).filter(Boolean);
    } catch (err) {
      setError(err.message);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const getById = useCallback(async (id) => {
    if (!id) return null;
    setLoading(true);
    setError(null);
    try {
      const key = cacheKey('lookup', String(id));
      const json = await fetchAPI(`${API_BASE}/lookup.php?i=${id}`, key);
      const drinks = normalizeDrinkList(json.drinks);
      return drinks.length > 0 ? drinks[0] : null;
    } catch (err) {
      setError(err.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const getRandom = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Don't cache random results
      const res = await fetch(`${API_BASE}/random.php`);
      if (!res.ok) throw new Error(`CocktailDB API error: ${res.status}`);
      const json = await res.json();
      const drinks = normalizeDrinkList(json.drinks);
      return drinks.length > 0 ? drinks[0] : null;
    } catch (err) {
      setError(err.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Find cocktails that contain ALL of the given ingredients (by ingredient set, not proportions).
   * Searches CocktailDB by each ingredient, intersects results, then fetches full details
   * to verify ingredient overlap. Returns matches sorted by overlap %.
   */
  const findByIngredients = useCallback(async (ingredients) => {
    if (!ingredients || ingredients.length === 0) return [];
    setLoading(true);
    setError(null);
    try {
      // Search by each ingredient in parallel
      const resultSets = await Promise.all(
        ingredients.map(async (ing) => {
          const key = cacheKey('ingredient', ing);
          const json = await fetchAPI(
            `${API_BASE}/filter.php?i=${encodeURIComponent(ing.trim())}`,
            key
          );
          return (json.drinks || []).map(normalizeFilterResult).filter(Boolean);
        })
      );

      if (resultSets.length === 0) return [];

      // Count how many ingredient searches each cocktail appears in
      const idCounts = new Map();
      const idInfo = new Map();
      for (const results of resultSets) {
        for (const drink of results) {
          idCounts.set(drink.id, (idCounts.get(drink.id) || 0) + 1);
          if (!idInfo.has(drink.id)) idInfo.set(drink.id, drink);
        }
      }

      // Keep cocktails that match at least 2 ingredients or all of them
      const minMatch = Math.min(2, ingredients.length);
      const candidates = [];
      for (const [id, count] of idCounts) {
        if (count >= minMatch) {
          candidates.push({ id, matchCount: count, info: idInfo.get(id) });
        }
      }

      // Sort by most ingredients matched
      candidates.sort((a, b) => b.matchCount - a.matchCount);

      // Fetch full details for top candidates (limit to 8 to avoid excessive API calls)
      const topCandidates = candidates.slice(0, 8);
      const fullResults = await Promise.all(
        topCandidates.map(async (c) => {
          const key = cacheKey('lookup', String(c.id));
          const json = await fetchAPI(`${API_BASE}/lookup.php?i=${c.id}`, key);
          const drinks = normalizeDrinkList(json.drinks);
          return drinks.length > 0 ? drinks[0] : null;
        })
      );

      // Compute overlap: what % of the user's ingredients are in this cocktail
      const inputSet = new Set(ingredients.map(i => i.toLowerCase()));
      const matches = fullResults.filter(Boolean).map((cocktail) => {
        const cocktailIngs = new Set(cocktail.ingredients.map(i => i.name.toLowerCase()));
        let overlap = 0;
        for (const ing of inputSet) {
          if (cocktailIngs.has(ing)) overlap++;
        }
        return {
          ...cocktail,
          overlapCount: overlap,
          overlapPercent: Math.round((overlap / inputSet.size) * 100),
          totalIngredients: cocktail.ingredients.length,
        };
      });

      matches.sort((a, b) => b.overlapPercent - a.overlapPercent || a.totalIngredients - b.totalIngredients);
      return matches;
    } catch (err) {
      setError(err.message);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    searchByName,
    searchByIngredient,
    getById,
    getRandom,
    findByIngredients,
    loading,
    error,
  };
}
