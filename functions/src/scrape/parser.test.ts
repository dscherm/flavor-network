import { describe, it, expect } from 'vitest';
import {
  decodeHtmlEntities,
  extractJsonLdRecipes,
  extractTitle,
  jsonLdToRecipe,
  parseIngredientLine,
  parseRecipeFromHtml,
} from './parser';

const RECIPE_JSON_LD = `<!doctype html>
<html><head>
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Recipe",
  "name": "Tomato Basil Pasta",
  "recipeIngredient": [
    "1 lb dried pasta",
    "2 tablespoons olive oil",
    "4 cloves garlic, minced",
    "1 can crushed tomatoes",
    "½ cup fresh basil leaves",
    "salt and pepper to taste"
  ]
}
</script>
</head></html>`;

const GRAPH_NESTED = `<!doctype html>
<html><head>
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@graph": [
    { "@type": "Organization", "name": "Some Site" },
    {
      "@type": "Recipe",
      "name": "Vinaigrette",
      "recipeIngredient": ["3 tbsp olive oil", "1 tbsp red wine vinegar", "1 tsp dijon"]
    }
  ]
}
</script>
</head></html>`;

const MULTI_TYPE = `<script type="application/ld+json">
{
  "@type": ["WebPage", "Recipe"],
  "name": "Quick Salad",
  "recipeIngredient": ["mixed greens", "1 cucumber, sliced", "balsamic"]
}
</script>`;

describe('extractJsonLdRecipes', () => {
  it('extracts a top-level Recipe node', () => {
    const nodes = extractJsonLdRecipes(RECIPE_JSON_LD);
    expect(nodes).toHaveLength(1);
    expect(nodes[0].name).toBe('Tomato Basil Pasta');
  });

  it('extracts a Recipe nested under @graph', () => {
    const nodes = extractJsonLdRecipes(GRAPH_NESTED);
    expect(nodes).toHaveLength(1);
    expect(nodes[0].name).toBe('Vinaigrette');
  });

  it('extracts a Recipe with multi-type @type array', () => {
    const nodes = extractJsonLdRecipes(MULTI_TYPE);
    expect(nodes).toHaveLength(1);
    expect(nodes[0].name).toBe('Quick Salad');
  });

  it('returns empty array on malformed JSON', () => {
    const html = '<script type="application/ld+json">{not valid json}</script>';
    expect(extractJsonLdRecipes(html)).toEqual([]);
  });

  it('returns empty array on no recipes', () => {
    const html = '<script type="application/ld+json">{"@type": "Organization"}</script>';
    expect(extractJsonLdRecipes(html)).toEqual([]);
  });

  it('returns empty array on empty/missing HTML', () => {
    expect(extractJsonLdRecipes('')).toEqual([]);
  });
});

describe('jsonLdToRecipe', () => {
  it('extracts title + ingredients with raw + noun', () => {
    const nodes = extractJsonLdRecipes(RECIPE_JSON_LD);
    const r = jsonLdToRecipe(nodes[0]);
    expect(r.title).toBe('Tomato Basil Pasta');
    expect(r.ingredients).toHaveLength(6);
    expect(r.ingredients[0]).toMatchObject({ raw: '1 lb dried pasta', noun: 'dried pasta', unit: 'lb', quantity: 1 });
    expect(r.ingredients[2]).toMatchObject({ raw: '4 cloves garlic, minced', noun: 'garlic, minced', unit: 'cloves', quantity: 4 });
    expect(r.ingredients[4]).toMatchObject({ raw: '½ cup fresh basil leaves', noun: 'fresh basil leaves', unit: 'cup', quantity: 0.5 });
  });

  it('handles {name, text} object-shape ingredients', () => {
    const html = `<script type="application/ld+json">
      { "@type": "Recipe", "name": "X",
        "recipeIngredient": [{"text": "2 cups flour"}, {"name": "milk"}] }
    </script>`;
    const nodes = extractJsonLdRecipes(html);
    const r = jsonLdToRecipe(nodes[0]);
    expect(r.ingredients).toHaveLength(2);
    expect(r.ingredients[0].raw).toBe('2 cups flour');
    expect(r.ingredients[1].raw).toBe('milk');
  });
});

describe('parseIngredientLine', () => {
  it('parses qty + known unit + noun', () => {
    expect(parseIngredientLine('1 cup flour')).toEqual({ raw: '1 cup flour', noun: 'flour', unit: 'cup', quantity: 1 });
    expect(parseIngredientLine('2 tbsp olive oil')).toEqual({ raw: '2 tbsp olive oil', noun: 'olive oil', unit: 'tbsp', quantity: 2 });
  });

  it('parses unicode fractions', () => {
    expect(parseIngredientLine('½ cup sugar')?.quantity).toBe(0.5);
    expect(parseIngredientLine('¼ tsp salt')?.quantity).toBe(0.25);
    expect(parseIngredientLine('⅔ cup milk')?.quantity).toBeCloseTo(2 / 3);
  });

  it('parses mixed fractions ("1 1/2 cups")', () => {
    expect(parseIngredientLine('1 1/2 cups water')?.quantity).toBe(1.5);
  });

  it('handles missing unit (qty + noun directly)', () => {
    const r = parseIngredientLine('2 eggs');
    expect(r?.quantity).toBe(2);
    expect(r?.noun).toBe('eggs');
    expect(r?.unit).toBeUndefined();
  });

  it('handles no qty at all', () => {
    const r = parseIngredientLine('salt and pepper to taste');
    expect(r?.noun).toMatch(/salt and pepper/);
    expect(r?.quantity).toBeUndefined();
  });

  it('returns null on empty input', () => {
    expect(parseIngredientLine('')).toBeNull();
    expect(parseIngredientLine('   ')).toBeNull();
  });
});

// WEBLINK-3 (2026-07-31): a page could fetch perfectly and still fail, because
// the function understood JSON-LD only. These cover the fallback chain and the
// entity decoding that was letting "World&#39;s Best Lasagna" reach the UI.

const MICRODATA_ONLY = `<!doctype html>
<html><head><title>Site — Skillet Cornbread</title></head><body>
<div itemscope itemtype="http://schema.org/Recipe">
  <h1 itemprop="name">Skillet Cornbread</h1>
  <ul>
    <li itemprop="recipeIngredient">1 cup cornmeal</li>
    <li itemprop="recipeIngredient">2 tablespoons butter, melted</li>
    <li itemprop="recipeIngredient">1 cup buttermilk</li>
  </ul>
</div></body></html>`;

const MICRODATA_META_FORM = `<div itemscope itemtype="http://schema.org/Recipe">
  <meta itemprop="recipeIngredient" content="3 cloves garlic">
  <meta itemprop="recipeIngredient" content="1 tsp cumin">
</div>`;

const HEURISTIC_ONLY = `<!doctype html>
<html><head>
<meta property="og:title" content="Weeknight Dal">
</head><body>
<div class="wprm-recipe-ingredients">
  <li class="wprm-recipe-ingredient">1 cup red lentils</li>
  <li class="wprm-recipe-ingredient">2 tsp turmeric</li>
  <li class="wprm-recipe-ingredient">1 onion, diced</li>
</div></body></html>`;

const HEURISTIC_LIST_SECTION = `<html><head><title>Chili Oil</title></head><body>
<ul id="ingredient-list">
  <li>1 cup neutral oil</li>
  <li>3 tbsp chili flakes</li>
  <li>2 star anise</li>
</ul></body></html>`;

describe('decodeHtmlEntities', () => {
  it('decodes the entities that were reaching the UI raw', () => {
    expect(decodeHtmlEntities('World&#39;s Best Lasagna')).toBe("World's Best Lasagna");
    expect(decodeHtmlEntities('Homemade Pizza &amp; Pizza Dough')).toBe('Homemade Pizza & Pizza Dough');
  });

  it('decodes hex, decimal and named forms', () => {
    expect(decodeHtmlEntities('caf&#xe9;')).toBe('café');
    expect(decodeHtmlEntities('jalape&#241;o')).toBe('jalapeño');
    expect(decodeHtmlEntities('salt &amp; pepper')).toBe('salt & pepper');
    expect(decodeHtmlEntities('&frac12; cup')).toBe('½ cup');
  });

  it('leaves unknown entities and entity-free text alone', () => {
    expect(decodeHtmlEntities('&notarealentity;')).toBe('&notarealentity;');
    expect(decodeHtmlEntities('plain text')).toBe('plain text');
    expect(decodeHtmlEntities('')).toBe('');
  });
});

describe('parseRecipeFromHtml', () => {
  it('prefers JSON-LD when the page publishes it', () => {
    const r = parseRecipeFromHtml(RECIPE_JSON_LD);
    expect(r?.strategy).toBe('json-ld');
    expect(r?.title).toBe('Tomato Basil Pasta');
    expect(r?.ingredients).toHaveLength(6);
  });

  it('falls back to microdata when there is no JSON-LD', () => {
    const r = parseRecipeFromHtml(MICRODATA_ONLY);
    expect(r?.strategy).toBe('microdata');
    expect(r?.title).toBe('Skillet Cornbread');
    expect(r?.ingredients).toHaveLength(3);
    // Fallback lines must have the same shape as the JSON-LD path.
    expect(r?.ingredients[0]).toMatchObject({
      raw: '1 cup cornmeal', noun: 'cornmeal', unit: 'cup', quantity: 1,
    });
  });

  it('reads the meta/content form of microdata', () => {
    const r = parseRecipeFromHtml(MICRODATA_META_FORM);
    expect(r?.strategy).toBe('microdata');
    expect(r?.ingredients.map((i) => i.noun)).toEqual(['garlic', 'cumin']);
  });

  it('falls back to class heuristics when there is no structured markup', () => {
    const r = parseRecipeFromHtml(HEURISTIC_ONLY);
    expect(r?.strategy).toBe('heuristic');
    expect(r?.title).toBe('Weeknight Dal');
    expect(r?.ingredients.map((i) => i.noun)).toEqual([
      'red lentils', 'turmeric', 'onion, diced',
    ]);
  });

  it('finds <li> items inside a container whose id mentions ingredient', () => {
    const r = parseRecipeFromHtml(HEURISTIC_LIST_SECTION);
    expect(r?.strategy).toBe('heuristic');
    expect(r?.ingredients).toHaveLength(3);
  });

  it('returns null when no strategy finds anything', () => {
    expect(parseRecipeFromHtml('<html><body><p>a blog post</p></body></html>')).toBeNull();
    expect(parseRecipeFromHtml('')).toBeNull();
  });

  it('skips a JSON-LD Recipe with no ingredients rather than returning it empty', () => {
    const html = `<script type="application/ld+json">
      { "@type": "Recipe", "name": "Title only", "recipeIngredient": [] }
    </script>`;
    expect(parseRecipeFromHtml(html)).toBeNull();
  });

  it('decodes entities in JSON-LD titles and ingredients', () => {
    const html = `<script type="application/ld+json">
      { "@type": "Recipe", "name": "World&#39;s Best Lasagna",
        "recipeIngredient": ["2 jalape&#241;os, diced", "salt &amp; pepper"] }
    </script>`;
    const r = parseRecipeFromHtml(html);
    expect(r?.title).toBe("World's Best Lasagna");
    expect(r?.ingredients[0].raw).toBe('2 jalapeños, diced');
    expect(r?.ingredients[1].raw).toBe('salt & pepper');
  });

  it('dedupes repeated ingredient lines from overlapping class patterns', () => {
    const r = parseRecipeFromHtml(HEURISTIC_ONLY);
    const nouns = r?.ingredients.map((i) => i.noun) ?? [];
    expect(new Set(nouns).size).toBe(nouns.length);
  });
});

describe('extractTitle', () => {
  it('prefers microdata name, then og:title, then <title>', () => {
    expect(extractTitle(MICRODATA_ONLY)).toBe('Skillet Cornbread');
    expect(extractTitle(HEURISTIC_ONLY)).toBe('Weeknight Dal');
    expect(extractTitle(HEURISTIC_LIST_SECTION)).toBe('Chili Oil');
    expect(extractTitle('<html><body>nothing</body></html>')).toBe('');
  });
});

// WEBLINK-3 follow-up: found live, not in review. A 404 page from
// 101cookbooks was served 200 through the proxy, the heuristic layer matched
// exactly one element with "ingredient" in its class, and handleScrape
// reported status=ok with the title "Page not found". The guessiest strategy
// must not be the most confident one.
describe('heuristic confidence floor', () => {
  it('rejects a single stray heuristic hit rather than inventing a recipe', () => {
    const html = `<html><head><title>Page not found</title></head><body>
      <div class="ingredient-teaser">Browse recipes by ingredient</div>
    </body></html>`;
    expect(parseRecipeFromHtml(html)).toBeNull();
  });

  it('rejects two heuristic hits', () => {
    const html = `<html><head><title>404</title></head><body>
      <li class="recipe-ingredient">olive oil</li>
      <li class="recipe-ingredient">salt</li>
    </body></html>`;
    expect(parseRecipeFromHtml(html)).toBeNull();
  });

  it('accepts three or more', () => {
    const html = `<html><head><title>Real Recipe</title></head><body>
      <li class="recipe-ingredient">2 tbsp olive oil</li>
      <li class="recipe-ingredient">1 tsp salt</li>
      <li class="recipe-ingredient">3 cloves garlic</li>
    </body></html>`;
    const r = parseRecipeFromHtml(html);
    expect(r?.strategy).toBe('heuristic');
    expect(r?.ingredients).toHaveLength(3);
  });

  it('still trusts a single DECLARED microdata ingredient', () => {
    const html = `<div itemscope itemtype="http://schema.org/Recipe">
      <h1 itemprop="name">One-Ingredient Ice Cream</h1>
      <li itemprop="recipeIngredient">4 ripe bananas</li>
    </div>`;
    const r = parseRecipeFromHtml(html);
    expect(r?.strategy).toBe('microdata');
    expect(r?.ingredients).toHaveLength(1);
  });
});
