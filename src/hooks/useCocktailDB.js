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

  return {
    searchByName,
    searchByIngredient,
    getById,
    getRandom,
    loading,
    error,
  };
}
