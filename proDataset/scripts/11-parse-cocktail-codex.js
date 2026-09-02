/**
 * 11-parse-cocktail-codex.js
 *
 * Parses COCKTAIL_CODEX_NEEDS.md (curated by hand from the Cocktail Codex
 * book) into a structured JSON file the new Cocktail Lab can render
 * directly. Each cocktail becomes a node; each cocktail's family +
 * subcluster determine where it sits in 3D.
 *
 * Output: public/data/cocktail_codex.json
 *   {
 *     clusters: [{ id, name, color }, ...],
 *     subclusters: [{ id, family_id, name }, ...],
 *     cocktails: [{ id, name, family_id, subcluster_id, ingredients[], garnishes[], recipe_text[] }, ...],
 *     syrups: [{ id, name, instructions }, ...],
 *   }
 *
 * Heuristic boundary detection:
 *   - "## XYZ FAMILY" → new family
 *   - "Subcluster: <name>" → new subcluster (next line = description, skip)
 *   - Lines containing measurement/unit/ingredient keywords → ingredient
 *   - "Garnish:" / "Rim:" → garnish
 *   - Otherwise: title-cased line = new cocktail name
 *   - "Syrup & Solution Recipes" / "Syrup Recipes" → start syrup block;
 *     each "Name: description" line becomes a syrup entry.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SRC = path.join(__dirname, '..', 'data', 'COCKTAIL_CODEX_NEEDS.md');
const OUT = path.join(__dirname, '..', '..', 'public', 'data', 'cocktail_codex.json');
const COCKTAILDB_DIR = path.join(__dirname, '..', 'raw', 'cocktaildb');

const FAMILIES = [
  { id: 0, name: 'Old-Fashioned',   color: '#b45309', match: /OLD-?FASHIONED FAMILY/i },
  { id: 1, name: 'Martini',         color: '#94a3b8', match: /MARTINI FAMILY/i },
  { id: 2, name: 'Daiquiri',        color: '#facc15', match: /DAIQUIRI FAMILY/i },
  { id: 3, name: 'Sidecar',         color: '#ea580c', match: /SIDECAR FAMILY/i },
  { id: 4, name: 'Whisky Highball', color: '#22c55e', match: /WHISKY HIGHBALL FAMILY/i },
  { id: 5, name: 'Flip',            color: '#a855f7', match: /FLIP FAMILY/i },
  { id: 6, name: 'Syrups',          color: '#fbbf24', match: null },
];

// Tokens that, when present (case-insensitive substring), mark a line
// as an ingredient line rather than a cocktail name.
const INGREDIENT_HINTS = [
  // measurements / units
  'oz','ounce','ounces','cl','ml','dash','dashes','drop','drops','tsp','tbsp','teaspoon','tablespoon',
  'parts','part','cube','cubes','splash','sprays','spray','to taste','pinch',
  // structural words
  'rim:','garnish:',
  // ingredient body words
  'syrup','bitters','liqueur','vermouth','sherry','port','wine','champagne','prosecco','cava',
  'soda','tonic','water','juice','cream','milk','beer','cola','cider','sparkling','spritzer',
  'mint','egg','honey','sugar','salt','pepper','lemon','lime','orange','grapefruit',
  'peach','apple','pear','pineapple','strawberry','raspberry','blackberry','mandarin',
  'ginger','cucumber','cherry','olive','nutmeg','cinnamon','cassis','almond','coconut',
  'vanilla','chocolate','cacao','coffee','basil','sage','celery','tomato','tomatillo',
  'jalapeño','jalapeno','rosé','rose','mole','grenadine','orgeat','verjus','curaçao',
  'curacao','cointreau','maraschino','aperol','campari','suze','chartreuse','bénédictine',
  'benedictine','fernet','amaro','amer','galliano','strega','lillet','absinthe','peychaud',
  'angostura','cocoa','amaretto','pisco','cachaça','cachaca','calvados','armagnac','aquavit',
  'singani','limoncello','grappa','sake','rum','rhum','cognac','brandy','whisky','whiskey',
  'scotch','bourbon','rye','tequila','mezcal','vodka','gin','tincture','extract','solution',
  'mix','puree','marmalade','tea','schnapps','green','yellow','flower','agar','infused',
  'aperitif','aperitif:','wedge','wheel','sprig','leaf','leaves','bouquet','twist','peel',
  'half-and-half','heavy','dry','sweet','blanc','blanco','reposado','añejo','anejo','aged',
  'gin-infused','rum-infused','vodka-infused','tequila-infused','whisky-infused','whiskey-infused',
  'seltzer','crème','creme','menthe','pineau','charentes','heering','batter','infusion',
  'cordial','de pamplemousse','st. germain','st germain','st-germain','agave','genever',
  'co2','bottle','spirit base','clarified',
];

function isIngredientLine(line) {
  if (/^\s*[¼½¾⅓⅔⅛⅜⅝⅞0-9]/.test(line)) return true;
  const lc = line.toLowerCase();
  return INGREDIENT_HINTS.some(h => lc.includes(h));
}

function slugify(s) {
  return s.toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function parseMd(md) {
  const lines = md.split(/\r?\n/);

  const cocktails = [];
  const subclusters = [];
  const syrups = [];
  const subclusterIdSet = new Set();

  let currentFamily = null;
  let currentSubcluster = null;
  let inSubclusterDescription = false; // skip the next prose line
  let inSyrupBlock = false;
  let currentCocktail = null;
  let lastWasGarnish = false;

  function closeCocktail() {
    if (currentCocktail && currentCocktail.ingredients.length > 0) {
      cocktails.push(currentCocktail);
    }
    currentCocktail = null;
    lastWasGarnish = false;
  }

  function startSubcluster(family, subName) {
    const id = `${family.id}-${slugify(subName)}`;
    if (!subclusterIdSet.has(id)) {
      subclusters.push({ id, family_id: family.id, name: subName });
      subclusterIdSet.add(id);
    }
    return id;
  }

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith('---')) continue;
    if (line.startsWith('# ')) continue;
    if (line.startsWith('**')) continue;

    // Family header
    const familyHit = FAMILIES.find(f => f.match && f.match.test(line));
    if (line.startsWith('## ') && familyHit) {
      closeCocktail();
      currentFamily = familyHit;
      currentSubcluster = null;
      inSubclusterDescription = false;
      inSyrupBlock = false;
      continue;
    }

    // Skip other markdown headers (## sections that aren't families,
    // like "How to use this doc")
    if (line.startsWith('## ') || line.startsWith('### ')) {
      closeCocktail();
      currentFamily = null;
      continue;
    }

    if (!currentFamily) continue;

    // Subcluster header
    const subMatch = line.match(/^Subcluster:\s*(.+)$/i);
    if (subMatch) {
      closeCocktail();
      // Detect implicit family transition (the doc has Daiquiri nested
      // under Martini without a header; spotted by description prose
      // on the next line).
      const nextLine = (lines[i + 1] || '').trim();
      const sourFamily = /sour\s+family|spirit,\s*citrus,\s*and\s*sugar/i;
      if (currentFamily.id === 1 && sourFamily.test(nextLine)) {
        currentFamily = FAMILIES.find(f => f.id === 2); // Daiquiri
      }
      currentSubcluster = startSubcluster(currentFamily, subMatch[1].trim());
      inSubclusterDescription = true;
      inSyrupBlock = false;
      continue;
    }

    // Syrup section header
    if (/^Syrup\s*(?:&\s*Solution)?\s*Recipes?:?$/i.test(line)) {
      closeCocktail();
      inSyrupBlock = true;
      continue;
    }

    if (inSyrupBlock) {
      // Each syrup line is "Name: description". A line without a colon
      // means the syrup block has ended (e.g. continuing on into more
      // cocktails like Mint Julep / Sazerac at the bottom of the OF
      // section). Exit syrup mode and let the line fall through to
      // cocktail handling.
      const m = line.match(/^([^:]+):\s*(.+)$/);
      if (m) {
        const name = m[1].trim();
        const instructions = m[2].trim();
        const id = `syrup-${slugify(name)}`;
        if (!syrups.find(s => s.id === id)) {
          syrups.push({ id, name, instructions });
        }
        continue;
      }
      inSyrupBlock = false;
      // fall through and reprocess as cocktail
    }

    // Skip pasted artifact lines (base64-like garbage from PDF copy).
    if (/[A-Za-z0-9+/]{20,}={0,2}$/.test(line)) {
      continue;
    }

    if (inSubclusterDescription) {
      inSubclusterDescription = false;
      // Only skip the line if it actually looks like a description.
      // The Flip section omits description prose, so this line is the
      // first cocktail name and we must NOT skip it.
      const looksDescriptive = (
        /^(These|This|Each|It |The )/i.test(line) ||
        (line.length > 60 && /\.\s*$/.test(line))
      );
      if (looksDescriptive) continue;
      // fall through and treat as a cocktail name
    }

    // Garnish/Rim line — append to current cocktail
    if (/^(Garnish|Rim):/i.test(line)) {
      if (currentCocktail) {
        currentCocktail.garnishes.push(line.replace(/^(Garnish|Rim):\s*/i, ''));
        currentCocktail.recipe_text.push(line);
      }
      lastWasGarnish = true;
      continue;
    }

    const looksLikeIngredient = isIngredientLine(line);

    // New cocktail boundary detection:
    //  - if previous line was a garnish, the next line is a new cocktail
    //  - if there's no current cocktail yet, this is a new cocktail
    //  - if the line doesn't look like an ingredient AND the current
    //    cocktail has at least one ingredient, treat as new cocktail
    const isNewCocktail = (
      !currentCocktail ||
      lastWasGarnish ||
      (!looksLikeIngredient && currentCocktail.ingredients.length > 0)
    );

    if (isNewCocktail) {
      closeCocktail();
      currentCocktail = {
        id: '', // assigned at close
        name: line,
        family_id: currentFamily.id,
        subcluster_id: currentSubcluster,
        ingredients: [],
        garnishes: [],
        recipe_text: [],
      };
      currentCocktail.id = `${slugify(currentFamily.name)}--${slugify(line)}`;
      lastWasGarnish = false;
      continue;
    }

    // Otherwise: this is an ingredient for the current cocktail
    currentCocktail.ingredients.push(line);
    currentCocktail.recipe_text.push(line);
    lastWasGarnish = false;
  }

  closeCocktail();

  return { cocktails, subclusters, syrups };
}

// Pull a CocktailDB recipe by name (case-insensitive) so the
// "I'm UNSURE" cocktails the user assigned without recipes still get
// ingredients to render.
function loadCocktailDB() {
  const map = new Map();
  if (!fs.existsSync(COCKTAILDB_DIR)) return map;
  for (const f of fs.readdirSync(COCKTAILDB_DIR)) {
    if (!f.startsWith('drinks_')) continue;
    const j = JSON.parse(fs.readFileSync(path.join(COCKTAILDB_DIR, f), 'utf8'));
    if (!j || !j.drinks) continue;
    for (const d of j.drinks) {
      const ings = [];
      const garnishes = [];
      for (let i = 1; i <= 15; i++) {
        const ing = d['strIngredient' + i];
        const meas = d['strMeasure' + i];
        if (!ing || !ing.trim()) continue;
        const ingName = ing.trim();
        const measStr = (meas || '').trim();
        const lc = ingName.toLowerCase();
        const isGarnish = ['cherry','olive','peel','wedge','wheel','twist','sprig','leaf','salt','sugar (rim)','nutmeg','cinnamon stick'].includes(lc);
        const text = (measStr ? measStr + ' ' : '') + ingName;
        if (isGarnish) garnishes.push(text);
        else ings.push(text);
      }
      map.set(d.strDrink.toLowerCase(), { name: d.strDrink, ingredients: ings, garnishes });
    }
  }
  return map;
}

// Cocktails the user explicitly assigned to families in the "UNSURE" section
// at the bottom of the doc — they don't have recipes there, so we pull
// from CocktailDB.
const UNSURE_ASSIGNMENTS = [
  { name: 'Mai Tai',         family_id: 2, subcluster: 'Extended Family' }, // Daiquiri
  { name: 'Hurricane',       family_id: 2, subcluster: 'Extended Family' },
  { name: 'Singapore Sling', family_id: 4, subcluster: 'Extended Family' }, // Whisky Highball
  { name: 'Pimm\'s Cup',     family_id: 4, subcluster: 'Extended Family' },
  { name: 'Dirty Martini',   family_id: 1, subcluster: 'Extended Family' }, // Martini
];

// The 6 root cocktails. Each codex family is a tree branching off
// from a central root recipe. The root cocktails themselves don't
// appear in any subcluster's recipe list in the markdown (the
// user's "Subcluster: Core" lists are foundational templates that
// BUILD ON the root, not the root itself). These are injected with
// isRoot:true and placed in a "Root" subcluster so they read as the
// hub for each family.
const ROOT_COCKTAILS = [
  { family_id: 0, name: 'Old-Fashioned',   ingredients: ['2 oz Bourbon', '1 sugar cube', '2 dashes Angostura bitters', 'Splash of water'], garnishes: ['Orange peel'] },
  { family_id: 1, name: 'Martini',         ingredients: ['2 oz Gin', '0.5 oz Dry vermouth'], garnishes: ['Lemon twist or olive'] },
  { family_id: 2, name: 'Daiquiri',        ingredients: ['2 oz White rum', '0.75 oz Lime juice', '0.5 oz Simple syrup'], garnishes: ['Lime wheel'] },
  { family_id: 3, name: 'Sidecar',         ingredients: ['2 oz Cognac', '0.75 oz Orange liqueur', '0.75 oz Lemon juice'], garnishes: ['Orange twist', 'Sugar rim (optional)'] },
  { family_id: 4, name: 'Whisky Highball', ingredients: ['2 oz Hakushu 12-yr Japanese whisky', '4 oz Cold seltzer'], garnishes: ['Lemon twist'] },
  { family_id: 5, name: 'Flip',            ingredients: ['2 oz Sherry', '0.25 oz Gum syrup', '1 whole egg'], garnishes: ['Nutmeg'] },
];

// Hardcoded recipes for cocktails that aren't in our CocktailDB cache
// (the API only returned ~426 random drinks). These are well-known
// recipes from standard references.
const HARDCODED_RECIPES = {
  'hurricane': {
    name: 'Hurricane',
    ingredients: ['2 oz Dark rum', '2 oz Light rum', '2 oz Passion fruit puree', '1 oz Orange juice', '1 oz Lime juice', '0.5 oz Simple syrup', '0.5 oz Grenadine'],
    garnishes: ['Orange slice', 'Maraschino cherry'],
  },
  'singapore sling': {
    name: 'Singapore Sling',
    ingredients: ['1.5 oz Gin', '0.5 oz Cherry Heering', '0.25 oz Bénédictine', '0.25 oz Cointreau', '4 oz Pineapple juice', '0.5 oz Lime juice', '0.33 oz Grenadine', '1 dash Angostura bitters', 'Soda water (top)'],
    garnishes: ['Pineapple wedge', 'Maraschino cherry'],
  },
  "pimm's cup": {
    name: "Pimm's Cup",
    ingredients: ["2 oz Pimm's No. 1", '4 oz Ginger ale (or lemonade)', '1 Lemon wedge', '1 Cucumber spear'],
    garnishes: ['Mint sprig', 'Cucumber slice', 'Orange wheel'],
  },
};

function applyUnsureAssignments(parsed, db) {
  const family = id => FAMILIES.find(f => f.id === id);
  for (const a of UNSURE_ASSIGNMENTS) {
    const existing = parsed.cocktails.find(c => c.name.toLowerCase() === a.name.toLowerCase());
    if (existing) continue; // already in the doc
    const recipe = db.get(a.name.toLowerCase()) || HARDCODED_RECIPES[a.name.toLowerCase()];
    if (!recipe) {
      console.warn(`[skip] No recipe for ${a.name}`);
      continue;
    }
    const fam = family(a.family_id);
    const subId = `${fam.id}-${slugify(a.subcluster)}`;
    if (!parsed.subclusters.find(s => s.id === subId)) {
      parsed.subclusters.push({ id: subId, family_id: fam.id, name: a.subcluster });
    }
    parsed.cocktails.push({
      id: `${slugify(fam.name)}--${slugify(a.name)}`,
      name: a.name,
      family_id: fam.id,
      subcluster_id: subId,
      ingredients: recipe.ingredients,
      garnishes: recipe.garnishes,
      recipe_text: [...recipe.ingredients, ...recipe.garnishes.map(g => 'Garnish: ' + g)],
    });
  }
}

function dedupeCocktails(cocktails) {
  const seen = new Map();
  const out = [];
  for (const c of cocktails) {
    if (seen.has(c.id)) continue;
    seen.set(c.id, c);
    out.push(c);
  }
  return out;
}

function main() {
  const md = fs.readFileSync(SRC, 'utf8');
  const parsed = parseMd(md);
  parsed.cocktails = dedupeCocktails(parsed.cocktails);

  const db = loadCocktailDB();
  applyUnsureAssignments(parsed, db);

  // Inject the 6 root cocktails into a "Root" subcluster per family
  // so each family has a clear central hub.
  for (const root of ROOT_COCKTAILS) {
    const fam = FAMILIES.find(f => f.id === root.family_id);
    const subId = `${fam.id}-root`;
    if (!parsed.subclusters.find(s => s.id === subId)) {
      // Put the root subcluster first by unshift
      parsed.subclusters.unshift({ id: subId, family_id: fam.id, name: 'Root' });
    }
    parsed.cocktails.push({
      id: `${slugify(fam.name)}--${slugify(root.name)}--root`,
      name: root.name,
      family_id: fam.id,
      subcluster_id: subId,
      ingredients: root.ingredients,
      garnishes: root.garnishes,
      recipe_text: [...root.ingredients, ...root.garnishes.map(g => 'Garnish: ' + g)],
      isRoot: true,
    });
  }

  // Add the Syrups super-cluster as a virtual subcluster bag — each
  // syrup is its own node under family_id=6.
  for (const s of parsed.syrups) {
    parsed.cocktails.push({
      id: `syrup--${slugify(s.name)}`,
      name: s.name,
      family_id: 6,
      subcluster_id: '6-recipes',
      ingredients: [s.instructions],
      garnishes: [],
      recipe_text: [s.instructions],
      isSyrup: true,
    });
  }
  if (parsed.syrups.length > 0 && !parsed.subclusters.find(s => s.id === '6-recipes')) {
    parsed.subclusters.push({ id: '6-recipes', family_id: 6, name: 'Recipes' });
  }

  // Final dedupe (syrups can collide with cocktails of same name)
  parsed.cocktails = dedupeCocktails(parsed.cocktails);

  const out = {
    _meta: {
      generatedAt: new Date().toISOString(),
      source: 'COCKTAIL_CODEX_NEEDS.md',
      cocktailCount: parsed.cocktails.length,
      familyCount: FAMILIES.length,
      subclusterCount: parsed.subclusters.length,
      syrupCount: parsed.syrups.length,
    },
    clusters: FAMILIES.map(({ id, name, color }) => ({ id, name, color })),
    subclusters: parsed.subclusters,
    cocktails: parsed.cocktails,
    syrups: parsed.syrups,
  };

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2));

  // Per-family summary
  console.log('\n=== Cocktail Codex parsed ===');
  for (const fam of FAMILIES) {
    const drinks = parsed.cocktails.filter(c => c.family_id === fam.id);
    const subs = parsed.subclusters.filter(s => s.family_id === fam.id);
    console.log(`  ${fam.name.padEnd(18)} ${drinks.length} cocktails / ${subs.length} subclusters`);
  }
  console.log(`\n  Total cocktails: ${parsed.cocktails.length}`);
  console.log(`  Total subclusters: ${parsed.subclusters.length}`);
  console.log(`  Syrups: ${parsed.syrups.length}`);
  console.log(`  Output: ${OUT}\n`);
}

main();
