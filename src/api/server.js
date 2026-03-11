/**
 * Flavor Network — Express REST API server.
 *
 * Parses CSV data at startup, builds an in-memory ingredient graph,
 * and serves ingredient lookup, fuzzy search, and pairing endpoints.
 *
 * Run: node src/api/server.js
 */

import express from 'express';
import cors from 'cors';
import Fuse from 'fuse.js';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ---------------------------------------------------------------------------
// CSV Parsing — mirrors the logic in src/data/loader.js
// ---------------------------------------------------------------------------

/**
 * Parse a simple two-column CSV (no header) into an array of [col1, col2] pairs.
 * Handles quoted fields with embedded commas.
 */
function parseCsvPairs(text) {
  const rows = [];
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    let col1, col2;
    if (trimmed.startsWith('"')) {
      const closingQuote = trimmed.indexOf('"', 1);
      if (closingQuote === -1) continue;
      col1 = trimmed.slice(1, closingQuote);
      col2 = trimmed.slice(closingQuote + 2); // skip ","
    } else {
      const commaIdx = trimmed.indexOf(',');
      if (commaIdx === -1) continue;
      col1 = trimmed.slice(0, commaIdx);
      col2 = trimmed.slice(commaIdx + 1);
    }

    col2 = col2.replace(/^"|"$/g, '').trim();
    col1 = col1.trim();

    if (col1 && col2) {
      rows.push([col1.toLowerCase(), col2]);
    }
  }
  return rows;
}

// ---------------------------------------------------------------------------
// Data Loading
// ---------------------------------------------------------------------------

const DATA_DIR = join(__dirname, '..', '..', 'data');
const PUBLIC_DIR = join(__dirname, '..', '..', 'public');

function readCsv(filename) {
  const filePath = join(DATA_DIR, filename);
  if (!existsSync(filePath)) return [];
  return parseCsvPairs(readFileSync(filePath, 'utf-8'));
}

/** Parse ingredients.csv -> Map<ingredient, string[]> of pairings */
function loadIngredientPairings() {
  const pairs = readCsv('ingredients.csv');
  const pairings = new Map();
  for (const [ingredient, pairing] of pairs) {
    if (!pairings.has(ingredient)) pairings.set(ingredient, []);
    pairings.get(ingredient).push(pairing.toLowerCase());
  }
  return pairings;
}

/** Parse cuisines.csv -> Map<cuisine, string[]> of ingredients */
function loadCuisines() {
  const pairs = readCsv('cuisines.csv');
  const cuisines = new Map();
  for (const [cuisine, ingredient] of pairs) {
    if (!cuisines.has(cuisine)) cuisines.set(cuisine, []);
    cuisines.get(cuisine).push(ingredient.toLowerCase());
  }
  return cuisines;
}

/** Parse ingredient_metadata.csv -> Map<ingredient, { taste, weight, volume, season, tips[] }> */
function loadMetadata() {
  const pairs = readCsv('ingredient_metadata.csv');
  const metadata = new Map();
  for (const [ingredient, raw] of pairs) {
    if (!metadata.has(ingredient)) {
      metadata.set(ingredient, { taste: null, weight: null, volume: null, season: null, tips: [] });
    }
    const entry = metadata.get(ingredient);
    const lower = raw.toLowerCase();

    if (lower.startsWith('taste:')) {
      entry.taste = raw.slice(6).trim();
    } else if (lower.startsWith('weight:')) {
      entry.weight = raw.slice(7).trim();
    } else if (lower.startsWith('volume:')) {
      entry.volume = raw.slice(7).trim();
    } else if (lower.startsWith('season:')) {
      entry.season = raw.slice(7).trim();
    } else if (lower.startsWith('tips:')) {
      entry.tips.push(raw.slice(5).trim());
    }
  }
  return metadata;
}

/** Parse affinities.csv -> Map<ingredient, string[][]> */
function loadAffinities() {
  const pairs = readCsv('affinities.csv');
  const affinities = new Map();
  for (const [ingredient, comboStr] of pairs) {
    if (!affinities.has(ingredient)) affinities.set(ingredient, []);
    const combo = comboStr.split('+').map(s => s.trim().toLowerCase()).filter(Boolean);
    if (combo.length > 0) {
      affinities.get(ingredient).push(combo);
    }
  }
  return affinities;
}

/** Build reverse map: ingredient -> cuisines[] */
function buildIngredientCuisineMap(cuisines) {
  const map = new Map();
  for (const [cuisine, ingredients] of cuisines) {
    for (const ing of ingredients) {
      if (!map.has(ing)) map.set(ing, []);
      map.get(ing).push(cuisine);
    }
  }
  return map;
}

// ---------------------------------------------------------------------------
// Graph Construction — mirrors src/data/graph.js
// ---------------------------------------------------------------------------

function buildGraph(pairings, metadata, ingredientCuisines, affinities) {
  const ingredientSet = new Set();
  for (const [ingredient, targets] of pairings) {
    ingredientSet.add(ingredient);
    for (const target of targets) ingredientSet.add(target);
  }

  const ingredientList = [...ingredientSet].sort();

  const nodes = new Map();
  let id = 0;
  for (const name of ingredientList) {
    const meta = metadata.get(name) || { taste: null, weight: null, volume: null, season: null, tips: [] };
    const cuisines = ingredientCuisines.get(name) || [];
    const pairingCount = pairings.has(name) ? pairings.get(name).length : 0;
    const ingredientAffinities = affinities.get(name) || [];

    nodes.set(name, {
      id: id++,
      name,
      cuisines,
      taste: meta.taste,
      weight: meta.weight,
      volume: meta.volume,
      season: meta.season,
      tips: meta.tips,
      pairingCount,
      affinities: ingredientAffinities,
    });
  }

  // Build edges with deduplication
  const edgeMap = new Map();
  for (const [source, targets] of pairings) {
    for (const target of targets) {
      if (!nodes.has(target)) continue;
      const key = source < target ? `${source}|${target}` : `${target}|${source}`;
      if (!edgeMap.has(key)) {
        edgeMap.set(key, { source: key.split('|')[0], target: key.split('|')[1], strength: 0 });
      }
      edgeMap.get(key).strength += 1;
    }
  }

  const edges = [...edgeMap.values()];
  const maxStrength = Math.max(1, ...edges.map(e => e.strength));
  for (const edge of edges) {
    edge.strength = edge.strength / maxStrength;
  }

  // Build adjacency list for fast neighbor lookups
  const adjacency = new Map();
  for (const edge of edges) {
    if (!adjacency.has(edge.source)) adjacency.set(edge.source, []);
    if (!adjacency.has(edge.target)) adjacency.set(edge.target, []);
    adjacency.get(edge.source).push({ name: edge.target, strength: edge.strength });
    adjacency.get(edge.target).push({ name: edge.source, strength: edge.strength });
  }

  return { nodes, edges, adjacency, ingredientList };
}

// ---------------------------------------------------------------------------
// Cosine Similarity — inlined to avoid browser-specific imports
// ---------------------------------------------------------------------------

function cosineSimilarity(a, b) {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

function findSimilar(query, embeddingsMap, k = 10) {
  const queryVec = embeddingsMap[query];
  if (!queryVec) return [];

  const results = [];
  for (const [name, vec] of Object.entries(embeddingsMap)) {
    if (name === query) continue;
    results.push({ name, similarity: cosineSimilarity(queryVec, vec) });
  }

  results.sort((a, b) => b.similarity - a.similarity);
  return results.slice(0, k);
}

// ---------------------------------------------------------------------------
// Startup — load all data
// ---------------------------------------------------------------------------

const pairingsData = loadIngredientPairings();
const cuisinesData = loadCuisines();
const metadataData = loadMetadata();
const affinitiesData = loadAffinities();
const ingredientCuisines = buildIngredientCuisineMap(cuisinesData);

const graph = buildGraph(pairingsData, metadataData, ingredientCuisines, affinitiesData);

// Optionally load pre-computed embeddings
let embeddingsMap = null;
const embeddingsPath = join(PUBLIC_DIR, 'embeddings.json');
if (existsSync(embeddingsPath)) {
  try {
    const raw = readFileSync(embeddingsPath, 'utf-8');
    const parsed = JSON.parse(raw);
    // Support both { embeddings: {...} } and flat { ingredient: [...] } formats
    embeddingsMap = parsed.embeddings || parsed;
  } catch (_) {
    // Embeddings unavailable — similarity features disabled
    embeddingsMap = null;
  }
}

// Build Fuse.js index for fuzzy search
const fuseItems = graph.ingredientList.map(name => ({ name }));
const fuse = new Fuse(fuseItems, {
  keys: ['name'],
  threshold: 0.4,
  includeScore: true,
});

// ---------------------------------------------------------------------------
// Rate Limiter — simple in-memory, per-IP, no extra dependencies
// ---------------------------------------------------------------------------

const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const RATE_LIMIT_MAX = 100;
const rateLimitStore = new Map(); // ip -> { count, resetTime }

function rateLimiter(req, res, next) {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const now = Date.now();

  let entry = rateLimitStore.get(ip);
  if (!entry || now > entry.resetTime) {
    entry = { count: 0, resetTime: now + RATE_LIMIT_WINDOW_MS };
    rateLimitStore.set(ip, entry);
  }

  entry.count += 1;

  if (entry.count > RATE_LIMIT_MAX) {
    return res.status(429).json({ error: 'Too many requests. Max 100 per minute.' });
  }

  next();
}

// Periodically clean up expired entries to avoid memory leak
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of rateLimitStore) {
    if (now > entry.resetTime) rateLimitStore.delete(ip);
  }
}, RATE_LIMIT_WINDOW_MS);

// ---------------------------------------------------------------------------
// Express App
// ---------------------------------------------------------------------------

const app = express();

app.use(cors());
app.use(express.json());
app.use(rateLimiter);

// ---------------------------------------------------------------------------
// GET /api/ingredient/:name
// ---------------------------------------------------------------------------

app.get('/api/ingredient/:name', (req, res) => {
  const name = req.params.name.toLowerCase().trim();
  const node = graph.nodes.get(name);

  if (!node) {
    return res.status(404).json({ error: `Ingredient "${req.params.name}" not found.` });
  }

  // Gather pairings from adjacency list, sorted by strength
  const pairings = (graph.adjacency.get(name) || [])
    .slice()
    .sort((a, b) => b.strength - a.strength);

  const result = {
    name: node.name,
    taste: node.taste,
    weight: node.weight,
    volume: node.volume,
    season: node.season,
    tips: node.tips,
    cuisines: node.cuisines,
    pairings: pairings.map(p => ({ name: p.name, strength: p.strength })),
    affinities: node.affinities,
  };

  // Include similar ingredients if embeddings are available
  if (embeddingsMap) {
    const similar = findSimilar(name, embeddingsMap, 10);
    if (similar.length > 0) {
      result.similar = similar.map(s => ({
        name: s.name,
        similarity: Math.round(s.similarity * 1000) / 1000,
      }));
    }
  }

  res.json(result);
});

// ---------------------------------------------------------------------------
// GET /api/search?q=
// ---------------------------------------------------------------------------

app.get('/api/search', (req, res) => {
  const query = (req.query.q || '').trim();

  if (!query) {
    return res.json({ results: [] });
  }

  const fuseResults = fuse.search(query, { limit: 10 });

  const results = fuseResults.map(r => ({
    name: r.item.name,
    score: Math.round((1 - (r.score || 0)) * 1000) / 1000,
  }));

  res.json({ results });
});

// ---------------------------------------------------------------------------
// GET /api/pairings/:ingredient1/:ingredient2
// ---------------------------------------------------------------------------

app.get('/api/pairings/:ingredient1/:ingredient2', (req, res) => {
  const ing1 = req.params.ingredient1.toLowerCase().trim();
  const ing2 = req.params.ingredient2.toLowerCase().trim();

  if (!graph.nodes.has(ing1)) {
    return res.status(404).json({ error: `Ingredient "${req.params.ingredient1}" not found.` });
  }
  if (!graph.nodes.has(ing2)) {
    return res.status(404).json({ error: `Ingredient "${req.params.ingredient2}" not found.` });
  }

  // Check direct connection
  const neighbors1 = graph.adjacency.get(ing1) || [];
  const directEntry = neighbors1.find(n => n.name === ing2);
  const directConnection = directEntry
    ? { strength: directEntry.strength }
    : null;

  // Find shared neighbors
  const set1 = new Set(neighbors1.map(n => n.name));
  const neighbors2 = graph.adjacency.get(ing2) || [];
  const shared = neighbors2
    .filter(n => set1.has(n.name))
    .map(n => n.name)
    .sort();

  res.json({
    ingredient1: ing1,
    ingredient2: ing2,
    shared,
    directConnection,
  });
});

// ---------------------------------------------------------------------------
// Error handling middleware
// ---------------------------------------------------------------------------

// 404 for unmatched routes
app.use((_req, res) => {
  res.status(404).json({ error: 'Not found.' });
});

// Global error handler
app.use((err, _req, res, _next) => {
  const status = err.status || 500;
  res.status(status).json({ error: err.message || 'Internal server error.' });
});

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  process.stdout.write(`Flavor Network API listening on port ${PORT}\n`);
});
