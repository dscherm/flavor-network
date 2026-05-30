import { describe, it, expect } from 'vitest';
import { extractJsonLdRecipes, jsonLdToRecipe, parseIngredientLine } from './parser';

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
