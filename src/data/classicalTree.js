/**
 * Classical culinary taxonomies — mother sauces + cocktail codex.
 *
 * Each node: { name, key_ingredients, technique?, parent?, children: [] }
 *   key_ingredients = canonical list; user's recipe matches a node when
 *     ≥ 80% of the node's key_ingredients appear in the recipe.
 *
 * Ingredient names use the lowercased canonical forms present in
 * public/proDataset/ingredients.json so matching is exact-string at
 * the recipe level.
 *
 * Coverage is curated not exhaustive — aim is ~25-40 nodes per mode,
 * focused on the entries a chef would recognize. Expand as usage grows.
 */

export const SAUCE_TREE = [
  {
    name: 'Béchamel',
    family: 'Roux-Milk',
    description: 'Fat + roux + milk. The foundational white sauce.',
    technique: 'roux',
    key_ingredients: ['butter', 'flour', 'milk'],
    children: [
      {
        name: 'Mornay',
        description: 'Béchamel + cheese (gruyère + parmesan).',
        key_ingredients: ['butter', 'flour', 'milk', 'gruyere', 'parmesan'],
      },
      {
        name: 'Soubise',
        description: 'Béchamel with puréed onion.',
        key_ingredients: ['butter', 'flour', 'milk', 'onion'],
      },
      {
        name: 'Cheddar sauce',
        description: 'Béchamel with sharp cheddar — a Mornay variant.',
        key_ingredients: ['butter', 'flour', 'milk', 'cheddar'],
      },
      {
        name: 'Mustard sauce',
        description: 'Béchamel + mustard.',
        key_ingredients: ['butter', 'flour', 'milk', 'mustard'],
      },
      {
        name: 'Cream sauce',
        description: 'Béchamel enriched with cream.',
        key_ingredients: ['butter', 'flour', 'milk', 'cream'],
      },
      {
        name: 'Nantua',
        description: 'Béchamel + crayfish butter + cream.',
        key_ingredients: ['butter', 'flour', 'milk', 'cream', 'shrimp'],
      },
    ],
  },
  {
    name: 'Velouté',
    family: 'Roux-Stock',
    description: 'Fat + roux + white stock (chicken/fish/veal).',
    technique: 'roux',
    key_ingredients: ['butter', 'flour', 'chicken stock'],
    children: [
      {
        name: 'Suprême',
        description: 'Chicken velouté finished with cream + butter.',
        key_ingredients: ['butter', 'flour', 'chicken stock', 'cream'],
      },
      {
        name: 'Allemande',
        description: 'Velouté + egg yolks + lemon.',
        key_ingredients: ['butter', 'flour', 'chicken stock', 'egg yolk', 'lemon juice'],
      },
      {
        name: 'Sauce au vin blanc',
        description: 'Fish velouté + white wine.',
        key_ingredients: ['butter', 'flour', 'fish stock', 'white wine'],
      },
      {
        name: 'Aurora',
        description: 'Velouté + tomato purée.',
        key_ingredients: ['butter', 'flour', 'chicken stock', 'tomato puree'],
      },
    ],
  },
  {
    name: 'Espagnole',
    family: 'Roux-Brown Stock',
    description: 'Brown roux + brown stock + mirepoix + tomato.',
    technique: 'reduction',
    key_ingredients: ['butter', 'flour', 'beef stock', 'tomato paste', 'onion', 'carrot', 'celery'],
    children: [
      {
        name: 'Demi-glace',
        description: 'Espagnole reduced 50% with more brown stock.',
        key_ingredients: ['butter', 'flour', 'beef stock', 'tomato paste'],
        children: [
          {
            name: 'Bordelaise',
            description: 'Demi-glace + red wine + shallot + bone marrow.',
            key_ingredients: ['beef stock', 'red wine', 'shallot', 'butter'],
          },
          {
            name: 'Chasseur',
            description: 'Demi-glace + mushroom + white wine + tomato + tarragon.',
            key_ingredients: ['beef stock', 'mushroom', 'white wine', 'tomato', 'tarragon'],
          },
          {
            name: 'Diable',
            description: 'Demi-glace + white wine + shallot + pepper.',
            key_ingredients: ['beef stock', 'white wine', 'shallot', 'black pepper'],
          },
          {
            name: 'Robert',
            description: 'Demi-glace + onion + mustard + white wine.',
            key_ingredients: ['beef stock', 'onion', 'mustard', 'white wine'],
          },
          {
            name: 'Bourguignon',
            description: 'Demi-glace + red wine + mushroom + onion + bacon.',
            key_ingredients: ['beef stock', 'red wine', 'mushroom', 'onion', 'bacon'],
          },
        ],
      },
      {
        name: 'Madère',
        description: 'Demi-glace + Madeira wine.',
        key_ingredients: ['beef stock', 'madeira', 'butter'],
      },
    ],
  },
  {
    name: 'Tomate',
    family: 'Tomato',
    description: 'Tomato + fat + aromatics + (optional) herbs.',
    technique: 'simmer',
    key_ingredients: ['tomato', 'olive oil', 'onion', 'garlic'],
    children: [
      {
        name: 'Marinara',
        description: 'Tomato + garlic + oregano + basil.',
        key_ingredients: ['tomato', 'garlic', 'oregano', 'basil', 'olive oil'],
      },
      {
        name: 'Arrabiata',
        description: 'Marinara with chili.',
        key_ingredients: ['tomato', 'garlic', 'red chile', 'olive oil'],
      },
      {
        name: 'Pomodoro',
        description: 'Simple tomato + basil + olive oil.',
        key_ingredients: ['tomato', 'basil', 'olive oil'],
      },
      {
        name: 'Puttanesca',
        description: 'Tomato + olive + caper + anchovy + garlic.',
        key_ingredients: ['tomato', 'olive', 'caper', 'anchovy', 'garlic'],
      },
      {
        name: 'Amatriciana',
        description: 'Tomato + guanciale + pecorino + chili.',
        key_ingredients: ['tomato', 'bacon', 'pecorino', 'red chile'],
      },
    ],
  },
  {
    name: 'Hollandaise',
    family: 'Emulsion',
    description: 'Butter + egg yolk + lemon. Warm egg emulsion.',
    technique: 'emulsify',
    key_ingredients: ['butter', 'egg yolk', 'lemon juice'],
    children: [
      {
        name: 'Béarnaise',
        description: 'Hollandaise with tarragon + shallot + white wine vinegar reduction.',
        key_ingredients: ['butter', 'egg yolk', 'tarragon', 'shallot', 'vinegar'],
      },
      {
        name: 'Mousseline',
        description: 'Hollandaise lightened with whipped cream.',
        key_ingredients: ['butter', 'egg yolk', 'lemon juice', 'cream'],
      },
      {
        name: 'Maltaise',
        description: 'Hollandaise + blood orange.',
        key_ingredients: ['butter', 'egg yolk', 'orange'],
      },
      {
        name: 'Choron',
        description: 'Béarnaise + tomato purée.',
        key_ingredients: ['butter', 'egg yolk', 'tarragon', 'tomato puree'],
      },
    ],
  },
];

export const COCKTAIL_CODEX_TREE = [
  {
    name: 'Old Fashioned',
    family: 'Spirit-Sugar-Bitters',
    description: 'Spirit + sugar + bitters, stirred.',
    technique: 'stirred',
    key_ingredients: ['whiskey', 'sugar', 'angostura bitters'],
    children: [
      { name: 'Sazerac', description: 'Rye + sugar + Peychaud\'s + absinthe rinse.',
        key_ingredients: ['rye', 'sugar', 'absinthe'] },
      { name: 'Rum Old Fashioned', description: 'Rum + demerara + aromatic bitters.',
        key_ingredients: ['rum', 'demerara', 'angostura bitters'] },
      { name: 'Tequila Old Fashioned', description: 'Reposado tequila + agave + orange bitters.',
        key_ingredients: ['tequila', 'agave', 'orange bitters'] },
      { name: 'Improved Whiskey Cocktail', description: 'Old Fashioned + maraschino + absinthe.',
        key_ingredients: ['whiskey', 'sugar', 'maraschino', 'absinthe'] },
    ],
  },
  {
    name: 'Martini',
    family: 'Spirit-Vermouth',
    description: 'Spirit + fortified wine, stirred.',
    technique: 'stirred',
    key_ingredients: ['gin', 'dry vermouth'],
    children: [
      { name: 'Manhattan', description: 'Whiskey + sweet vermouth + bitters.',
        key_ingredients: ['whiskey', 'sweet vermouth', 'angostura bitters'] },
      { name: 'Negroni', description: 'Gin + Campari + sweet vermouth, equal parts.',
        key_ingredients: ['gin', 'campari', 'sweet vermouth'] },
      { name: 'Boulevardier', description: 'Bourbon + Campari + sweet vermouth.',
        key_ingredients: ['bourbon', 'campari', 'sweet vermouth'] },
      { name: 'Vesper', description: 'Gin + vodka + Lillet Blanc.',
        key_ingredients: ['gin', 'vodka', 'lillet blanc'] },
      { name: 'Rob Roy', description: 'Scotch + sweet vermouth + bitters.',
        key_ingredients: ['scotch', 'sweet vermouth', 'angostura bitters'] },
    ],
  },
  {
    name: 'Daiquiri',
    family: 'Spirit-Citrus-Sweetener',
    description: 'Spirit + citrus + sweetener, shaken sour.',
    technique: 'shaken',
    key_ingredients: ['rum', 'lime juice', 'sugar'],
    children: [
      { name: 'Margarita', description: 'Tequila + lime + triple sec.',
        key_ingredients: ['tequila', 'lime juice', 'triple sec'] },
      { name: 'Whiskey Sour', description: 'Whiskey + lemon + sugar (+ optional egg white).',
        key_ingredients: ['whiskey', 'lemon juice', 'sugar'] },
      { name: 'Gimlet', description: 'Gin + lime cordial.',
        key_ingredients: ['gin', 'lime juice', 'sugar'] },
      { name: 'Hemingway Daiquiri', description: 'Rum + lime + grapefruit + maraschino.',
        key_ingredients: ['rum', 'lime juice', 'grapefruit juice', 'maraschino'] },
      { name: 'Pisco Sour', description: 'Pisco + lemon + sugar + egg white.',
        key_ingredients: ['pisco', 'lemon juice', 'sugar', 'egg white'] },
    ],
  },
  {
    name: 'Sidecar',
    family: 'Spirit-Liqueur-Citrus',
    description: 'Spirit + liqueur + citrus, shaken.',
    technique: 'shaken',
    key_ingredients: ['cognac', 'triple sec', 'lemon juice'],
    children: [
      { name: 'Aviation', description: 'Gin + maraschino + violet + lemon.',
        key_ingredients: ['gin', 'maraschino', 'creme de violette', 'lemon juice'] },
      { name: 'Last Word', description: 'Gin + green chartreuse + maraschino + lime.',
        key_ingredients: ['gin', 'green chartreuse', 'maraschino', 'lime juice'] },
      { name: 'Between the Sheets', description: 'Sidecar + rum.',
        key_ingredients: ['cognac', 'rum', 'triple sec', 'lemon juice'] },
      { name: 'Corpse Reviver No. 2', description: 'Gin + Cocchi Americano + triple sec + lemon + absinthe.',
        key_ingredients: ['gin', 'cocchi americano', 'triple sec', 'lemon juice', 'absinthe'] },
    ],
  },
  {
    name: 'Whiskey Highball',
    family: 'Spirit-Lengthener',
    description: 'Spirit + carbonated lengthener, built.',
    technique: 'built',
    key_ingredients: ['whiskey', 'soda water'],
    children: [
      { name: 'Gin & Tonic', description: 'Gin + tonic water + lime.',
        key_ingredients: ['gin', 'tonic water', 'lime juice'] },
      { name: 'Moscow Mule', description: 'Vodka + ginger beer + lime.',
        key_ingredients: ['vodka', 'ginger beer', 'lime juice'] },
      { name: 'Dark \'n\' Stormy', description: 'Dark rum + ginger beer + lime.',
        key_ingredients: ['dark rum', 'ginger beer', 'lime juice'] },
      { name: 'Americano', description: 'Campari + sweet vermouth + soda.',
        key_ingredients: ['campari', 'sweet vermouth', 'soda water'] },
      { name: 'Cuba Libre', description: 'Rum + cola + lime.',
        key_ingredients: ['rum', 'cola', 'lime juice'] },
    ],
  },
  {
    name: 'Flip',
    family: 'Spirit-Egg',
    description: 'Spirit + sugar + whole egg, shaken very hard.',
    technique: 'shaken',
    key_ingredients: ['brandy', 'sugar', 'egg'],
    children: [
      { name: 'Ramos Gin Fizz', description: 'Gin + cream + egg white + citrus + orange flower water.',
        key_ingredients: ['gin', 'cream', 'egg white', 'lemon juice', 'lime juice', 'orange flower water'] },
      { name: 'Grasshopper', description: 'Crème de menthe + crème de cacao + cream.',
        key_ingredients: ['creme de menthe', 'creme de cacao', 'cream'] },
      { name: 'Alexander', description: 'Brandy + crème de cacao + cream.',
        key_ingredients: ['brandy', 'creme de cacao', 'cream'] },
      { name: 'Brandy Alexander', description: 'Cognac + crème de cacao + cream + nutmeg.',
        key_ingredients: ['cognac', 'creme de cacao', 'cream'] },
    ],
  },
];
