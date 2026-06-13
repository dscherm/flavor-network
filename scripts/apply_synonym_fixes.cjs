'use strict';
// Apply additional synonym mappings for clear misspellings found in programmatic near-dup scan.
// These map variant→canonical in synonyms.json ONLY — no key renames, no pairing changes.
// Only included when: the canonical is unambiguous AND the variant is a clear misspelling/variant
// (not a legitimately different ingredient).

const fs = require('fs');
const synonyms = JSON.parse(fs.readFileSync('D:/Projects/flavor-network/proDataset/data/synonyms.json'));

const additions = [
  // Clear misspellings of dominant canonical
  ['worchestershire sauce', 'worcestershire sauce', 'misspelling'],
  ['pinapple', 'pineapple', 'misspelling'],
  ['barbeque sauce', 'barbecue sauce', 'spelling variant'],
  ['lemons juice', 'lemon juice', 'erroneous plural possessive'],
  ['lemon juiced', 'lemon juice', 'verb form used as noun'],
  ['applesauce', 'apple sauce', 'spacing variant — map both ways for safety, dominant is apple sauce'],
  ['apple sauce', 'apple sauce', null], // apple sauce is already canonical, skip
  ['soya sauce', 'soy sauce', 'UK/regional variant'],
  ['tomatoe sauce', 'tomato sauce', 'misspelling'],
  ['tobasco sauce', 'tabasco sauce', 'misspelling'],
  ['cayanne pepper', 'cayenne pepper', 'misspelling'],
  ['course black pepper', 'coarse black pepper', 'homophones — "course" vs "coarse"'],
  ['course salt', 'coarse salt', 'homophones — "course" vs "coarse"'],
  ['course sea salt', 'coarse sea salt', 'homophones — "course" vs "coarse"'],
  ['corn kernal', 'corn kernel', 'misspelling'],
  ['cannelini bean', 'cannellini bean', 'misspelling (one l vs two)'],
  ['iceburg lettuce', 'iceberg lettuce', 'misspelling'],
  ['balsalmic vinegar', 'balsamic vinegar', 'misspelling'],
  ['unflavored gelatine', 'unflavored gelatin', 'UK/US spelling variant'],
  ['gelatine', 'gelatin', 'UK/US spelling variant'],
  ['lime juiced', 'lime juice', 'verb form used as noun'],
  ['eggs yolk', 'egg yolk', 'erroneous plural possessive'],
  ['eggs white', 'egg white', 'erroneous plural possessive'],
  ['cream of tarter', 'cream of tartar', 'misspelling'],
  ['avocadoe', 'avocado', 'misspelling'],
  ['shitake mushroom', 'shiitake mushroom', 'misspelling (one i vs two)'],
  ['crystalized ginger', 'crystallized ginger', 'misspelling'],
  ['haloumi cheese', 'halloumi cheese', 'misspelling'],
  ['hotsauce', 'hot sauce', 'spacing variant'],
  ['bayleaf', 'bay leaf', 'spacing variant'],
  ['bulgar wheat', 'bulgur wheat', 'misspelling'],
  ['green mangoe', 'green mango', 'misspelling'],
  // chili/chile/chilli variants — map to dominant US spelling
  ['green chili salsa', 'green chile salsa', null], // ambiguous chili vs chile, skip
  ['red chilie', 'red chili', 'misspelling suffix'],
  ['green chilie', 'green chili', 'misspelling suffix'],
  ['serrano chilie', 'serrano chili', 'misspelling suffix'],
  ['anaheim chilie', 'anaheim chili', 'misspelling suffix'],
  ['ancho chilie', 'ancho chili', 'misspelling suffix'],
  ['chipotle chilie', 'chipotle chili', 'misspelling suffix'],
  ['guajillo chilie', 'guajillo chili', 'misspelling suffix'],
  ['long red chilie', 'long red chili', 'misspelling suffix'],
  ['jalapeno chilie', 'jalapeno chile', 'misspelling suffix — map to jalapeno chile (more pairings)'],
  ['poblano chilie', 'poblano chili', 'misspelling suffix'],
  // flake/flaked coconut — map lower-pairing to higher
  ['flake coconut', 'flaked coconut', 'spacing/form variant — flaked coconut has more pairings'],
  // crimini/cremini — cremini is the more common spelling
  ['crimini mushroom', 'cremini mushroom', 'spelling variant — cremini is canonical'],
  // portabella/portabello/portobello — portobello is most common
  ['portabello mushroom', 'portobello mushroom', 'spelling variant'],
  ['portabella mushroom', 'portobello mushroom', 'spelling variant'],
  // emmenthaler/emmentaler — emmentaler is correct
  ['emmenthaler cheese', 'emmentaler cheese', 'spelling variant'],
  // salmon fillet/filet
  ['salmon filet', 'salmon fillet', 'spelling variant — fillet is standard English'],
  // anchovy fillet/filet (already in ingredients, but also add synonym)
  ['anchovy filet', 'anchovy fillet', 'spelling variant'],
  // worcester/worchester sauce — worcester sauce is closest
  ['worchester sauce', 'worcester sauce', 'misspelling'],
  // pimento/pimiento cheese
  ['pimiento cheese', 'pimento cheese', 'spelling variant'],
  // nicoise/niçoise olive
  ['niçoise olive', 'nicoise olive', 'accented variant — map accented to unaccented key'],
  // serrano chile/chili pepper
  ['serrano chile pepper', 'serrano chili pepper', 'chile vs chili variant'],
  // red chile pepper → red chili pepper (more pairings)
  ['red chile pepper', 'red chili pepper', 'chile vs chili variant'],
  // chipotle chile pepper
  ['chipotle chile pepper', 'chipotle chili pepper', 'chile vs chili variant'],
  // green chile pepper
  ['green chile pepper', 'green chili pepper', 'chile vs chili variant'],
  // lavendar → lavender
  ['lavendar', 'lavender', 'misspelling'],
  // rosewater → rose water (rose water has more pairings)
  ['rosewater', 'rose water', 'spacing variant'],
  // multigrain bread (0 pairings) → multi-grain bread
  ['multigrain bread', 'multi-grain bread', 'spacing variant'],
  // farmer/farmers cheese — farmer cheese has more pairings
  ['farmers cheese', 'farmer cheese', 'possessive vs non-possessive variant'],
  // goats cheese → goat cheese
  ['goats cheese', 'goat cheese', 'possessive vs non-possessive variant'],
  // barbecue/barbecued pork
  ['barbecued pork', 'barbecue pork', 'verb/adjective form variant'],
  // grain/grainy mustard — grain mustard has more pairings
  ['grainy mustard', 'grain mustard', 'adjective vs noun form'],
  // chicken breast halve/halves
  ['chicken breasts halve', 'chicken breast halve', 'plural variant'],
  // biscuit baking / biscuit/baking — map slash variant to space variant
  ['biscuit/baking mix', 'biscuit baking mix', 'slash vs space separator'],
  ['biscuit/baking', 'biscuit baking', 'slash vs space separator'],
  // cinnamon/sugar → cinnamon sugar
  ['cinnamon/sugar', 'cinnamon sugar', 'slash vs space separator'],
  // grape-nut / grape nut — grape-nut has more pairings
  ['grape nut', 'grape-nut', 'hyphen variant — grape-nut has more pairings'],
  // bananas mashed / banana mashed
  ['bananas mashed', 'banana mashed', 'erroneous plural'],
  // freshly- black pepper → freshly black pepper
  ['freshly- black pepper', 'freshly black pepper', 'erroneous hyphen'],
  // rice krispie/crispie
  ['rice crispie', 'rice krispie', 'spelling variant'],
  // crisp/crispy rice cereal — crispy has more pairings
  ['crisp rice cereal', 'crispy rice cereal', 'adjective form variant — crispy has more pairings'],
  // fettucine/fettucini noodle
  ['fettucini noodle', 'fettucine noodle', 'spelling variant'],
  // jake/jalapeno chile vs chili — jalapeno chile has more pairings
  ['jalapeno chili', 'jalapeno chile', 'chile vs chili variant — jalapeno chile more common here'],
  // chilli sauce → chili sauce
  ['chilli sauce', 'chili sauce', 'UK spelling variant'],
  // chile sauce → chili sauce (chili sauce dominant)
  ['chile sauce', 'chili sauce', 'chile vs chili variant'],
  // chili-garlic / chile-garlic — chili-garlic has more pairings
  ['chile-garlic sauce', 'chili-garlic sauce', 'chile vs chili variant'],
  // sweet chilli sauce → sweet chili sauce
  ['sweet chilli sauce', 'sweet chili sauce', 'UK spelling variant'],
  // cake/cakes yeast
  ['cakes yeast', 'cake yeast', 'erroneous plural'],
  // strawberry jello/jelly — different products, flag rather than map
  // apricot jello/jelly — different products, skip
  // grape jello/jelly — different products, skip
  // raspberry jello/jelly — different products, skip
  // (jello = gelatin dessert, jelly = fruit preserve — intentionally different)
  // mustard vs custard — completely different ingredients, skip
  // green pea vs green tea — completely different, skip
  // green olive vs greek olive — different, skip
  // baby shrimp vs bay shrimp — different, skip
  // mild cheese vs milk cheese — milk cheese may be valid, skip
  // chocolate bar vs chocolate bark — different products, skip
  // crawfish/crayfish — regional US/UK, both valid, skip
  // grapeseed vs rapeseed — completely different oils, skip
  // curly leaf vs curry leaf — completely different, skip
];

let added = 0;
let skipped = 0;
for (const [variant, canonical, note] of additions) {
  if (canonical === null || note === null) { skipped++; continue; }
  if (!synonyms[variant]) {
    synonyms[variant] = canonical;
    console.log('ADD:', variant, '->', canonical, '|', note);
    added++;
  }
}

console.log('\nAdded:', added, 'Skipped (null/existing):', skipped);
fs.writeFileSync('D:/Projects/flavor-network/proDataset/data/synonyms.json', JSON.stringify(synonyms, null, 2));
console.log('Written synonyms.json');
