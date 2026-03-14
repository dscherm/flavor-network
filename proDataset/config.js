import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const ROOT = __dirname;
export const RAW_DIR = path.join(__dirname, 'raw');
export const PROCESSED_DIR = path.join(__dirname, 'processed');
export const OUTPUT_DIR = path.join(__dirname, 'output');
export const DATA_DIR = path.join(__dirname, 'data');

// API endpoints
export const FLAVORDB_BASE = 'https://cosylab.iiitd.edu.in/flavordb';
export const MEALDB_BASE = 'https://www.themealdb.com/api/json/v1/1';
export const COCKTAILDB_BASE = 'https://www.thecocktaildb.com/api/json/v1/1';

// Blending weights (must sum to 1.0)
export const WEIGHTS = {
  recipenlg: 0.40,
  flavordb: 0.30,
  mealdb: 0.15,
  cocktaildb: 0.15,
};

// Rate limits (ms between requests)
export const RATE_LIMITS = {
  flavordb: 1200,  // ~1 req/sec, conservative
  mealdb: 600,     // ~2 req/sec
  cocktaildb: 600, // ~2 req/sec
};

// Filtering thresholds
export const MIN_RECIPE_COUNT = 3;         // pair must appear in 3+ recipes
export const MIN_INGREDIENT_RECIPES = 10;  // ingredient must appear in 10+ recipes
export const MIN_BLENDED_STRENGTH = 0.05;  // drop pairs below this after blending
export const MIN_SOURCES = 1;              // pair must appear in at least N sources
