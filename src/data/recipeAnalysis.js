import { getNeighbors, buildAdjacencyList } from './graph.js';
import { scoreStructures } from './structureScoring.js';

function getPairStrength(ingA, ingB, adjMap) {
  const neighbors = adjMap.get(ingA);
  if (!neighbors) return 0;
  const found = neighbors.find(n => n.name === ingB);
  return found ? found.strength : 0;
}

export function analyzeRecipe(ingredients, nodes, edges, labMode, selectedStructure) {
  if (!ingredients || ingredients.length < 3 || !nodes || !edges) {
    return null;
  }

  const adjMap = buildAdjacencyList(edges);

  const allStrengths = [];
  const pairData = [];
  for (let i = 0; i < ingredients.length; i++) {
    for (let j = i + 1; j < ingredients.length; j++) {
      const s = getPairStrength(ingredients[i], ingredients[j], adjMap);
      allStrengths.push(s);
      pairData.push({ a: ingredients[i], b: ingredients[j], strength: s });
    }
  }

  const sortedStrengths = [...allStrengths].sort((a, b) => a - b);
  const median = sortedStrengths[Math.floor(sortedStrengths.length / 2)] || 0;

  // --- Interesting pairs: cross-category + above-median strength ---
  const interesting = [];
  for (const { a, b, strength } of pairData) {
    if (strength <= median) continue;
    const catA = (nodes.get(a)?.category || 'other').toLowerCase();
    const catB = (nodes.get(b)?.category || 'other').toLowerCase();
    if (catA !== catB && catA !== 'other' && catB !== 'other') {
      interesting.push({
        pair: [a, b],
        strength,
        reason: `Cross between ${catA} and ${catB}`,
      });
    }
  }
  interesting.sort((a, b) => b.strength - a.strength);

  // --- Unusual: low avg strength or zero-strength pair ---
  const unusual = [];
  for (const name of ingredients) {
    const others = ingredients.filter(n => n !== name);
    if (others.length === 0) continue;
    let total = 0;
    let weakestStr = Infinity;
    let weakestPair = null;
    for (const other of others) {
      const s = getPairStrength(name, other, adjMap);
      total += s;
      if (s < weakestStr) {
        weakestStr = s;
        weakestPair = [name, other];
      }
    }
    const avg = total / others.length;
    if (avg < 0.05 || weakestStr === 0) {
      unusual.push({
        ingredient: name,
        avgStrength: avg,
        weakestPair,
        note: `${name} has weak connection to ${weakestPair[1]} (${Math.round(weakestStr * 100)}%)`,
      });
    }
  }
  unusual.sort((a, b) => a.avgStrength - b.avgStrength);

  // --- Add suggestions: non-recipe ingredients with >=2 edges to recipe ---
  const recipeSet = new Set(ingredients);
  const candidateMap = new Map();
  for (const name of ingredients) {
    const neighbors = adjMap.get(name) || [];
    for (const { name: neighbor, strength } of neighbors) {
      if (recipeSet.has(neighbor)) continue;
      if (!candidateMap.has(neighbor)) {
        candidateMap.set(neighbor, { totalStrength: 0, count: 0 });
      }
      const c = candidateMap.get(neighbor);
      c.totalStrength += strength;
      c.count++;
    }
  }

  const addSuggestions = [];
  for (const [name, { totalStrength, count }] of candidateMap) {
    if (count < 2) continue;
    addSuggestions.push({
      name,
      avgStrength: totalStrength / count,
      reason: `Pairs well with ${count} of your ${ingredients.length} ingredients`,
    });
  }
  addSuggestions.sort((a, b) => b.avgStrength - a.avgStrength);
  addSuggestions.splice(5);

  // --- Swap suggestions: replace weakest ingredient ---
  const swapSuggestions = [];
  if (unusual.length > 0) {
    const weakest = unusual[0].ingredient;
    const remaining = ingredients.filter(n => n !== weakest);
    const currentAvg = unusual[0].avgStrength;

    const swapCandidates = [];
    for (const [name, { totalStrength, count }] of candidateMap) {
      if (count < 1) continue;
      let swapTotal = 0;
      for (const r of remaining) {
        swapTotal += getPairStrength(name, r, adjMap);
      }
      const swapAvg = remaining.length > 0 ? swapTotal / remaining.length : 0;
      const improvement = swapAvg - currentAvg;
      if (improvement > 0) {
        swapCandidates.push({
          remove: weakest,
          addInstead: name,
          improvement: Math.round(improvement * 100),
          reason: `Replacing ${weakest} with ${name} improves avg compatibility by ${Math.round(improvement * 100)}%`,
        });
      }
    }
    swapCandidates.sort((a, b) => b.improvement - a.improvement);
    swapSuggestions.push(...swapCandidates.slice(0, 3));
  }

  // --- Structure advice ---
  let structureAdvice = null;
  if (labMode === 'cocktail' || labMode === 'sauce') {
    const scores = scoreStructures(ingredients, nodes, labMode);
    if (scores && scores.length > 0) {
      const best = scores[0];
      const selected = selectedStructure
        ? scores.find(s => s.key === selectedStructure)
        : null;

      if (selected) {
        const missingStr = selected.missing.length > 0
          ? `Add a ${selected.missing[0]} element to complete the ${selected.name} structure`
          : `Your recipe matches the ${selected.name} structure well`;
        structureAdvice = {
          selectedMatch: { name: selected.name, confidence: selected.confidence, missing: selected.missing },
          bestMatch: { name: best.name, confidence: best.confidence },
          advice: missingStr,
        };
      } else if (best.confidence >= 30) {
        structureAdvice = {
          selectedMatch: null,
          bestMatch: { name: best.name, confidence: best.confidence },
          advice: best.missing.length > 0
            ? `Add a ${best.missing[0]} element to build toward a ${best.name}`
            : `This looks like a ${best.name}`,
        };
      }
    }
  }

  return {
    interesting: interesting.slice(0, 6),
    unusual,
    suggestions: {
      add: addSuggestions,
      swap: swapSuggestions,
    },
    structureAdvice,
  };
}
