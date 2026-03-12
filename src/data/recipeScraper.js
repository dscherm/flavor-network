/**
 * recipeScraper.js — Server-side recipe URL scraper.
 *
 * Fetches HTML from a recipe URL and extracts structured recipe data:
 *   1. JSON-LD Recipe schema (schema.org/Recipe) — most reliable
 *   2. Microdata / meta tag fallback (Open Graph title)
 *   3. Common recipe site HTML pattern heuristics
 *
 * Returns: { title, ingredients[], servings, source }
 *
 * Used by: POST /api/recipe/scrape (see server.js)
 */

const FETCH_TIMEOUT_MS = 10_000;

const USER_AGENT =
  'Mozilla/5.0 (compatible; FlavorNetworkBot/1.0; +https://github.com/flavor-network)';

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Scrape a recipe URL and return structured data.
 *
 * @param {string} url - Absolute URL to a recipe page
 * @returns {Promise<{ title: string, ingredients: string[], servings: string|null, source: string }>}
 */
export async function scrapeRecipe(url) {
  const html = await fetchPage(url);
  const source = new URL(url).hostname.replace(/^www\./, '');

  // Strategy 1: JSON-LD (most common on major recipe sites)
  const jsonLd = extractJsonLdRecipe(html);
  if (jsonLd) {
    return {
      title: jsonLd.title || titleFromHtml(html) || 'Untitled Recipe',
      ingredients: jsonLd.ingredients,
      servings: jsonLd.servings,
      source,
    };
  }

  // Strategy 2: Microdata (itemprop="recipeIngredient")
  const microdata = extractMicrodata(html);
  if (microdata.ingredients.length > 0) {
    return {
      title: microdata.title || titleFromHtml(html) || 'Untitled Recipe',
      ingredients: microdata.ingredients,
      servings: microdata.servings,
      source,
    };
  }

  // Strategy 3: Heuristic HTML patterns (ingredient list classes, etc.)
  const heuristic = extractHeuristic(html);
  if (heuristic.ingredients.length > 0) {
    return {
      title: heuristic.title || titleFromHtml(html) || 'Untitled Recipe',
      ingredients: heuristic.ingredients,
      servings: null,
      source,
    };
  }

  // Nothing found
  return {
    title: titleFromHtml(html) || 'Untitled Recipe',
    ingredients: [],
    servings: null,
    source,
  };
}

// ---------------------------------------------------------------------------
// Fetch
// ---------------------------------------------------------------------------

async function fetchPage(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html',
      },
      signal: controller.signal,
      redirect: 'follow',
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status} fetching ${url}`);
    }

    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// Strategy 1: JSON-LD
// ---------------------------------------------------------------------------

/**
 * Extract recipe data from <script type="application/ld+json"> blocks.
 * Handles both direct Recipe objects and @graph arrays.
 */
function extractJsonLdRecipe(html) {
  const scriptPattern = /<script[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;

  while ((match = scriptPattern.exec(html)) !== null) {
    try {
      const data = JSON.parse(match[1]);
      const recipe = findRecipeInJsonLd(data);
      if (recipe) return recipe;
    } catch {
      // Malformed JSON — skip this block
    }
  }

  return null;
}

function findRecipeInJsonLd(data) {
  if (!data) return null;

  // Direct Recipe object
  if (isRecipeType(data)) {
    return parseJsonLdRecipe(data);
  }

  // @graph array (common on WordPress recipe plugins)
  if (data['@graph'] && Array.isArray(data['@graph'])) {
    for (const item of data['@graph']) {
      if (isRecipeType(item)) {
        return parseJsonLdRecipe(item);
      }
    }
  }

  // Array of objects (some sites emit an array at top level)
  if (Array.isArray(data)) {
    for (const item of data) {
      const found = findRecipeInJsonLd(item);
      if (found) return found;
    }
  }

  return null;
}

function isRecipeType(obj) {
  if (!obj || typeof obj !== 'object') return false;
  const type = obj['@type'];
  if (typeof type === 'string') return type.toLowerCase() === 'recipe';
  if (Array.isArray(type)) return type.some(t => typeof t === 'string' && t.toLowerCase() === 'recipe');
  return false;
}

function parseJsonLdRecipe(recipe) {
  const ingredients = normalizeIngredientList(recipe.recipeIngredient);
  if (ingredients.length === 0) return null;

  return {
    title: recipe.name || null,
    ingredients,
    servings: extractServings(recipe),
  };
}

function extractServings(recipe) {
  if (recipe.recipeYield) {
    const y = Array.isArray(recipe.recipeYield) ? recipe.recipeYield[0] : recipe.recipeYield;
    return String(y);
  }
  return null;
}

// ---------------------------------------------------------------------------
// Strategy 2: Microdata (itemprop)
// ---------------------------------------------------------------------------

function extractMicrodata(html) {
  const ingredients = [];
  const ingredientPattern = /itemprop\s*=\s*["']recipeIngredient["'][^>]*>([^<]+)/gi;
  let match;
  while ((match = ingredientPattern.exec(html)) !== null) {
    const cleaned = stripHtml(match[1]).trim();
    if (cleaned) ingredients.push(cleaned);
  }

  // Also try content attribute form: <meta itemprop="recipeIngredient" content="...">
  const metaPattern = /itemprop\s*=\s*["']recipeIngredient["'][^>]*content\s*=\s*["']([^"']+)["']/gi;
  while ((match = metaPattern.exec(html)) !== null) {
    const cleaned = stripHtml(match[1]).trim();
    if (cleaned) ingredients.push(cleaned);
  }

  // Title from itemprop="name" within recipe scope
  let title = null;
  const titleMatch = html.match(/itemprop\s*=\s*["']name["'][^>]*>([^<]+)/i);
  if (titleMatch) title = stripHtml(titleMatch[1]).trim();

  // Servings from itemprop="recipeYield"
  let servings = null;
  const yieldMatch = html.match(/itemprop\s*=\s*["']recipeYield["'][^>]*(?:content\s*=\s*["']([^"']+)["']|>([^<]+))/i);
  if (yieldMatch) servings = (yieldMatch[1] || yieldMatch[2] || '').trim() || null;

  return { title, ingredients: dedup(ingredients), servings };
}

// ---------------------------------------------------------------------------
// Strategy 3: Heuristic HTML patterns
// ---------------------------------------------------------------------------

function extractHeuristic(html) {
  const ingredients = [];

  // Common class names used by recipe sites / WP recipe plugins
  const classPatterns = [
    /class\s*=\s*["'][^"']*ingredient[^"']*["'][^>]*>([\s\S]*?)<\//gi,
    /class\s*=\s*["'][^"']*wprm-recipe-ingredient[^"']*["'][^>]*>([\s\S]*?)<\//gi,
    /class\s*=\s*["'][^"']*tasty-recipe[^"']*ingredient[^"']*["'][^>]*>([\s\S]*?)<\//gi,
    /class\s*=\s*["'][^"']*recipe-ingred[^"']*["'][^>]*>([\s\S]*?)<\//gi,
  ];

  for (const pattern of classPatterns) {
    let match;
    while ((match = pattern.exec(html)) !== null) {
      const text = stripHtml(match[1]).trim();
      if (text && text.length > 1 && text.length < 200) {
        ingredients.push(text);
      }
    }
  }

  // Try <li> items inside an element with "ingredient" in its id or class
  if (ingredients.length === 0) {
    const sectionPattern = /(?:id|class)\s*=\s*["'][^"']*ingredient[^"']*["'][^>]*>([\s\S]*?)<\/(?:ul|ol|div|section)/gi;
    let sectionMatch;
    while ((sectionMatch = sectionPattern.exec(html)) !== null) {
      const liPattern = /<li[^>]*>([\s\S]*?)<\/li>/gi;
      let liMatch;
      while ((liMatch = liPattern.exec(sectionMatch[1])) !== null) {
        const text = stripHtml(liMatch[1]).trim();
        if (text && text.length > 1 && text.length < 200) {
          ingredients.push(text);
        }
      }
    }
  }

  // Title: try Open Graph or <h1>/<h2> with recipe-related class
  let title = null;
  const ogTitle = html.match(/<meta[^>]*property\s*=\s*["']og:title["'][^>]*content\s*=\s*["']([^"']+)["']/i);
  if (ogTitle) {
    title = stripHtml(ogTitle[1]).trim();
  } else {
    const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
    if (h1Match) title = stripHtml(h1Match[1]).trim();
  }

  return { title, ingredients: dedup(ingredients) };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function normalizeIngredientList(raw) {
  if (!raw) return [];
  const list = Array.isArray(raw) ? raw : [raw];
  return dedup(
    list
      .map(item => (typeof item === 'string' ? stripHtml(item).trim() : ''))
      .filter(Boolean),
  );
}

function stripHtml(str) {
  return str
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ');
}

function titleFromHtml(html) {
  // Open Graph title
  const og = html.match(/<meta[^>]*property\s*=\s*["']og:title["'][^>]*content\s*=\s*["']([^"']+)["']/i);
  if (og) return stripHtml(og[1]).trim();

  // <title> tag
  const titleTag = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (titleTag) return stripHtml(titleTag[1]).trim();

  return null;
}

function dedup(arr) {
  const seen = new Set();
  return arr.filter(item => {
    const key = item.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
