/**
 * barStandIns.js (STANDIN-3) — what to offer when the store (or the bar) lacks a bottle, a mixer, a syrup or a juice.
 *
 * The BAR half of the one stand-in table: kitchenSwaps.js spreads BAR_STAND_INS into its TABLE, so the shopping sheet
 * (shoppingAlternatives.alternativesFor) and the cocktail builder's "Don't have it?" read the same entries through
 * the same function. Every entry is one reviewable line, the assistant's judgement from common bartending
 * knowledge, never inferred from role alone; the owner reads and corrects them in docs/stand-ins.md.
 *
 * Every entry here carries `bar: true`. That keeps it OUT of kitchenSwaps.SWAPS (the recipe side's table), so a
 * triple sec for a Cointreau can never make a dish or a sauce look makeable, and out of the Sauce Lab strictness
 * test, which is about food. My bar's "what can I make" never reads this file at all (myBar.coverLine has its own
 * equivalence table, unchanged).
 *
 * A GROUP is a named list whose members stand in for each other: the first member is the closest kin of
 * every other, and a note says what the swap changes in the drink ("sweeter, with less bitterness"). A base spirit
 * never crosses families here: gin and vodka are honest nones, and the only spirit entries are inside one family
 * (apple brandy and applejack are both brandy; cachaca for a plain rum is both rum).
 *
 * Names are the ones a cocktail line resolves to (shoppingList.canonicalKey), checked by scripts/checkStandIns.mjs.
 * Fizzy waters are not here: soda water, club soda, seltzer, sparkling water and carbonated water are ONE ingredient on
 * the shopping list (shoppingList.LIST_SYNONYMS), so none lists another as a stand-in; soda water carries a
 * `same` none that says so, and tonic, which is not the same thing, says nothing replaces it.
 */
import { S, FORM, MAKE, NONE } from './standInEntries.js';

const bar = (e) => ({ ...e, bar: true });

/**
 * Entries for every ordered pair in `members`. `note(from, to)` says what changes when `to` stands in for `from`
 * (a string, or undefined for no note). Order inside a group is the order the sheet lists them (it shows three).
 */
function group(role, kind, members, note = () => undefined, extra = {}) {
  const out = [];
  for (const from of members) {
    for (const to of members) {
      if (to === from) continue;
      const n = note(from, to);
      out.push(bar(S(from, to, role, kind, { ...(n ? { note: n } : {}), ...extra })));
    }
  }
  return out;
}

const pick = (map) => (from, to) => (typeof map[`${from}>${to}`] === 'string' ? map[`${from}>${to}`] : map[to]);

export const BAR_STAND_INS = [
  // ---- Orange liqueurs. Blue curacao tastes the same and only changes the colour.
  ...group('liqueur', 'orange liqueur', ['triple sec', 'cointreau', 'orange curacao', 'orange liqueur', 'grand marnier'], pick({
    'triple sec': 'usually lighter and a little sweeter than Cointreau; the same style of liqueur',
    cointreau: 'drier and stronger than most triple sec: use a touch less',
    'orange curacao': 'a little richer, with more bitter orange peel',
    'orange liqueur': 'any orange liqueur works; taste the drink and adjust the sweetness',
    'grand marnier': 'cognac-based, so richer, rounder and sweeter: use a touch less',
  })),
  ...['triple sec', 'cointreau', 'orange curacao', 'orange liqueur'].map((from) => bar(S(from, 'blue curacao', 'liqueur', 'orange liqueur', { note: 'the same orange flavor, but it will turn the drink blue' }))),
  ...['orange curacao', 'triple sec', 'orange liqueur'].map((to) => bar(S('blue curacao', to, 'liqueur', 'orange liqueur', { note: 'the same orange flavor, but the drink will not be blue' }))),

  // ---- Vermouths and aperitif wines. Dry and sweet are different bottles: never one for the other.
  bar(S('dry vermouth', 'lillet blanc', 'liqueur', 'dry vermouth', { note: 'fruitier and sweeter, with orange and honey: use a little less' })),
  bar(S('lillet blanc', 'dry vermouth', 'liqueur', 'dry vermouth', { note: 'drier and more herbal' })),
  bar(S('vermouth', 'dry vermouth', 'liqueur', 'vermouth', { note: 'the usual one when a recipe only says vermouth; use sweet (red) vermouth instead if the drink is dark, as a Manhattan is' })),
  bar(S('vermouth', 'sweet vermouth', 'liqueur', 'vermouth', { note: 'for a dark, rich drink such as a Manhattan; the drink says which' })),
  bar(S('sweet vermouth', 'dubonnet rouge', 'liqueur', 'sweet vermouth', { note: 'sweeter, with a quinine bite: cut any added sugar' })),
  bar(S('dubonnet rouge', 'sweet vermouth', 'liqueur', 'sweet vermouth', { note: 'less bitter and more herbal' })),

  // ---- Bitter red aperitifs.
  bar(S('campari', 'aperol', 'liqueur', 'bitter aperitif', { note: 'sweeter, lighter and much less bitter, with more orange: the drink will be milder, so add a dash of bitters if it needs bite' })),
  bar(S('aperol', 'campari', 'liqueur', 'bitter aperitif', { note: 'more bitter and stronger: use a little less, or add a touch of sugar' })),

  // ---- Bitters. The generic "bitters" is any aromatic bottle.
  bar(S('angostura bitters', "peychaud's bitters", 'bitters', 'aromatic bitters', { note: 'lighter, with anise and cherry in place of warm spice' })),
  bar(S('angostura bitters', 'bitters', 'bitters', 'aromatic bitters', { note: 'whichever aromatic bitters you have' })),
  bar(S('angostura bitters', 'orange bitters', 'bitters', 'aromatic bitters', { note: 'bright citrus in place of the warm spice: a different drink' })),
  bar(S('bitters', 'angostura bitters', 'bitters', 'aromatic bitters', { note: 'the usual one' })),
  bar(S('bitters', "peychaud's bitters", 'bitters', 'aromatic bitters', { note: 'lighter, with anise and cherry' })),
  bar(S('bitters', 'orange bitters', 'bitters', 'aromatic bitters', { note: 'citrus in place of spice' })),
  bar(S('orange bitters', 'angostura bitters', 'bitters', 'aromatic bitters', { note: 'warm spice in place of orange: add a strip of orange peel if you have one' })),
  bar(S("peychaud's bitters", 'angostura bitters', 'bitters', 'aromatic bitters', { note: 'rounder, with more spice and no anise' })),

  // ---- Mixers. Fizzy waters are one ingredient (LIST_SYNONYMS); tonic is not one of them.
  NONE('soda water', 'club soda, seltzer, sparkling water and carbonated water are all this one thing, so any of them will do', 'mixer', 'fizzy water', { same: 'Soda water, club soda, seltzer and sparkling water are the same thing.', bar: true }),
  NONE('tonic water', 'tonic is sweet and bitter with quinine; soda water gives only bubbles, so it makes a different drink', 'mixer', 'tonic', { bar: true }),
  bar(S('ginger beer', 'ginger ale', 'mixer', 'ginger soda', { note: 'milder and sweeter, with less ginger bite: add a squeeze of lime and, if you have it, a little fresh ginger' })),
  bar(S('ginger ale', 'ginger beer', 'mixer', 'ginger soda', { note: 'spicier and less sweet: use a little less' })),
  bar(S('coca-cola', 'cola', 'mixer', 'cola', { note: 'any cola; the brand is a matter of taste' })),
  bar(S('cola', 'coca-cola', 'mixer', 'cola', { note: 'any cola; the brand is a matter of taste' })),
  bar(S('lemon-lime soda', 'lemonade', 'mixer', 'lemon soda', { note: 'sweeter and flat: it will not add bubbles' })),

  // ---- Syrups, made from things.
  bar(MAKE('simple syrup', ['sugar', 'water'], 'sweetener', 'syrup', { amountNote: 'about 1/2 cup sugar stirred into 1/2 cup hot water until clear, then cooled; it makes about 3/4 cup' })),
  bar(MAKE('syrup', ['sugar', 'water'], 'sweetener', 'syrup', { amountNote: 'about 1/2 cup sugar stirred into 1/2 cup hot water until clear, then cooled; it makes about 3/4 cup' })),
  bar(MAKE('honey syrup', ['honey', 'water'], 'sweetener', 'syrup', { amountNote: 'equal parts honey and warm water, stirred until smooth: 1/4 cup of each makes about 1/2 cup' })),
  bar(MAKE('grenadine', ['pomegranate juice', 'sugar'], 'sweetener', 'syrup', { amountNote: 'equal parts pomegranate juice and sugar, warmed until the sugar dissolves: 1/2 cup of each makes about 3/4 cup', note: 'real grenadine is pomegranate; most bottled ones are mostly sugar and dye' })),
  bar(MAKE('ginger syrup', ['ginger', 'sugar', 'water'], 'sweetener', 'syrup', { amountNote: 'simmer 1/2 cup sliced fresh ginger with 1/2 cup sugar and 1/2 cup water for 10 minutes, then strain' })),
  bar(MAKE('cinnamon syrup', ['cinnamon', 'sugar', 'water'], 'sweetener', 'syrup', { amountNote: 'simmer 2 cinnamon sticks with 1/2 cup sugar and 1/2 cup water for 10 minutes, then strain' })),
  bar(MAKE('sweet sour', ['lemon juice', 'simple syrup'], 'citrus', 'sour mix', { amountNote: 'equal parts fresh lemon juice and simple syrup' })),
  bar(S('honey syrup', 'simple syrup', 'sweetener', 'syrup', { note: 'sweet in the same way, without the honey flavor' })),
  bar(S('simple syrup', 'honey syrup', 'sweetener', 'syrup', { note: 'adds honey flavor, and is a touch sweeter: use a little less' })),
  bar(S('agave syrup', 'simple syrup', 'sweetener', 'syrup', { note: 'agave is sweeter: use about a third more simple syrup' })),
  bar(S('agave syrup', 'honey syrup', 'sweetener', 'syrup', { note: 'a little honey flavor, and a little less sweet' })),
  bar(S('powdered sugar', 'sugar', 'sweetener', 'sugar', { amountNote: 'about 2/3 as much granulated sugar by volume as powdered', note: 'it dissolves more slowly, so stir or shake it longer' })),
  bar(S('powdered sugar', 'simple syrup', 'sweetener', 'sugar', { amountNote: 'about 1/4 oz simple syrup for each 1 tsp powdered sugar', note: 'adds a little liquid' })),
  bar(S('cane sugar', 'sugar', 'sweetener', 'sugar', { note: 'plain white sugar works, with a touch less molasses flavor' })),
  NONE('elderflower cordial', 'a non-alcoholic floral syrup: an elderflower liqueur adds alcohol and is not the same drink', 'liquid', 'cordial', { bar: true }),
  NONE('falernum', 'a spiced almond, lime and clove syrup: no single bottle copies it', 'liqueur', 'falernum', { bar: true }),

  // ---- Citrus and fruit juices: fresh from the fruit, and bottled. Lemon for lime changes the drink.
  bar(MAKE('lemon juice', ['lemon'], 'citrus', 'citrus', { amountNote: 'squeeze it fresh: one lemon gives about 1 oz (2 tbsp)' })),
  bar(MAKE('lime juice', ['lime'], 'citrus', 'citrus', { amountNote: 'squeeze it fresh: one lime gives about 1 oz (2 tbsp)' })),
  bar(MAKE('orange juice', ['orange'], 'citrus', 'citrus', { amountNote: 'squeeze it fresh: one medium orange gives about 2 oz (1/4 cup)' })),
  bar(MAKE('grapefruit juice', ['grapefruit'], 'citrus', 'citrus', { amountNote: 'squeeze it fresh: one medium grapefruit gives about 4 oz (1/2 cup)' })),
  bar(MAKE('pineapple juice', ['pineapple'], 'juice', 'juice', { amountNote: 'blend 1 cup of chunks with 1/4 cup water and strain: it makes about 1/2 cup' })),
  bar(FORM('lemon juice', 'bottled lemon juice', 'citrus', 'citrus', { amountNote: 'the same amount', note: 'flatter and a little bitter: fine in a punch or a long drink, poor in a sour' })),
  bar(FORM('lime juice', 'bottled lime juice', 'citrus', 'citrus', { amountNote: 'the same amount', note: 'flatter and a little bitter: fine in a punch or a long drink, poor in a Daiquiri' })),
  bar(FORM('orange juice', 'bottled orange juice', 'citrus', 'citrus', { amountNote: 'the same amount', note: 'sweeter and less bright: fine in a Screwdriver or a Mimosa' })),
  bar(FORM('grapefruit juice', 'bottled grapefruit juice', 'citrus', 'citrus', { amountNote: 'the same amount', note: 'sweeter and less sharp than fresh' })),
  bar(S('cranberry juice', 'pomegranate juice', 'juice', 'tart red juice', { note: 'sweeter and deeper, with less tartness: add a squeeze of lime' })),

  // ---- Sparkling wines.
  bar(S('champagne', 'sparkling wine', 'wine', 'sparkling wine', { note: 'any dry sparkling wine; a brut cava is the closest' })),
  bar(S('champagne', 'prosecco', 'wine', 'sparkling wine', { note: 'fruitier and softer, with less toast: fine in any cocktail' })),
  bar(S('prosecco', 'sparkling wine', 'wine', 'sparkling wine', { note: 'any dry sparkling wine; a little drier than prosecco' })),
  bar(S('prosecco', 'champagne', 'wine', 'sparkling wine', { note: 'drier and more toasty' })),
  bar(S('sparkling wine', 'champagne', 'wine', 'sparkling wine', { note: 'the classic; drier and more toasty' })),
  bar(S('sparkling wine', 'prosecco', 'wine', 'sparkling wine', { note: 'fruitier and softer' })),
  bar(S('sherry', 'madeira wine', 'wine', 'fortified wine', { note: 'a little sweeter and nuttier: fine where a nutty fortified wine is wanted' })),
  bar(S('madeira wine', 'sherry', 'wine', 'fortified wine', { note: 'drier and less caramel' })),
  bar(S('cream sherry', 'port', 'wine', 'sweet fortified wine', { note: 'fruitier; a tawny port is the closest' })),
  bar(S('port', 'cream sherry', 'wine', 'sweet fortified wine', { note: 'less fruity and more nutty' })),

  // ---- Cream, coffee and chocolate liqueurs; creams.
  bar(S('baileys irish cream', 'irish cream', 'liqueur', 'cream liqueur', { note: 'the same style; Baileys is the brand' })),
  bar(S('irish cream', 'baileys irish cream', 'liqueur', 'cream liqueur', { note: 'the best-known one' })),
  ...group('liqueur', 'coffee liqueur', ['coffee liqueur', 'kahlua', 'tia maria'], pick({
    'coffee liqueur': 'any coffee liqueur; taste the drink and adjust the sweetness',
    kahlua: 'rum-based and sweet, the usual coffee liqueur',
    'tia maria': 'a little drier and lighter, with more coffee',
  })),
  bar(S('coffee', 'espresso', 'liquid', 'coffee', { note: 'stronger: use about half as much, topped up with hot water' })),
  bar(S('espresso', 'coffee', 'liquid', 'coffee', { note: 'brew it very strong; instant espresso powder in hot water also works' })),
  bar(S('creme de cacao', 'chocolate liqueur', 'liqueur', 'chocolate liqueur', { note: 'sweeter, with less vanilla' })),
  bar(S('chocolate liqueur', 'creme de cacao', 'liqueur', 'chocolate liqueur', { note: 'drier and more vanilla' })),
  bar(S('creme de cassis', 'raspberry liqueur', 'liqueur', 'berry liqueur', { note: 'sweeter and less tart, with raspberry in place of blackcurrant' })),
  bar(S('raspberry liqueur', 'creme de cassis', 'liqueur', 'berry liqueur', { note: 'tarter and deeper, with blackcurrant in place of raspberry' })),
  bar(S('creme de banane', 'banana liqueur', 'liqueur', 'banana liqueur', { note: 'the same thing under another name' })),
  bar(S('banana liqueur', 'creme de banane', 'liqueur', 'banana liqueur', { note: 'the same thing under another name' })),
  bar(S('cherry brandy', 'cherry liqueur', 'spirit', 'cherry liqueur', { note: 'cherry liqueurs vary in sweetness: taste the drink and adjust' })),
  bar(S('cherry liqueur', 'cherry brandy', 'spirit', 'cherry liqueur', { note: 'cherry liqueurs vary in sweetness: taste the drink and adjust' })),
  bar(S('whipped cream', 'cream', 'dairy', 'cream', { note: 'whip it first, with a little sugar if the drink wants it sweet' })),
  bar(MAKE('half and half', ['milk', 'cream'], 'dairy', 'cream', { amountNote: 'equal parts whole milk and cream' })),

  // ---- Anise spirits.
  bar(S('absinthe', 'pernod', 'spirit', 'anise spirit', { note: 'lighter and sweeter, with licorice and little wormwood: fine for a rinse' })),
  bar(S('pernod', 'absinthe', 'spirit', 'anise spirit', { note: 'stronger and drier, with more wormwood: use a little less' })),

  // ---- The egg white of a sour: aquafaba is the liquid in a can of chickpeas.
  bar(MAKE('egg white', ['chickpea'], 'protein', 'egg white', { amountNote: '2 tbsp (1 oz) aquafaba, the liquid from a can of chickpeas, for each egg white; shake it hard', note: 'no egg taste or smell; the foam is a little looser' })),

  // ---- Spirits stay in their family. Apple brandy and applejack are both brandy; cachaca is a rum.
  bar(S('apple brandy', 'applejack', 'spirit', 'apple brandy', { note: 'blended with neutral spirit, so lighter and less apple' })),
  bar(S('applejack', 'apple brandy', 'spirit', 'apple brandy', { note: 'richer and more apple' })),
  bar(S('cachaca', 'rum', 'spirit', 'cane spirit', { note: 'an unaged white rum works; it is made from molasses, so less grassy' })),

  // ---- Honest nones. "Same family, same style" is the rule; where nothing meets it, the sheet says so.
  NONE('gin', 'juniper is what a gin drink is; vodka keeps the shape and drops the botanicals, so a Negroni or a Collins turns into a different drink', 'spirit', 'gin', { bar: true }),
  NONE('vodka', 'vodka is the plain one; any other spirit brings its own flavor and changes the drink rather than standing in', 'spirit', 'vodka', { bar: true }),
  NONE('liqueur', 'a recipe that only says liqueur means one sweet, flavored bottle: choose the flavor the drink wants (orange, coffee, herbal), there is no single stand-in', 'liqueur', 'liqueur', { bar: true }),
  NONE('maraschino liqueur', 'a bitter-nutty cherry-pit liqueur; it is not cherry brandy, and kirsch is dry and cherry brandy is sweet, so neither stands in', 'liqueur', 'maraschino', { bar: true }),
  NONE('amaretto', 'an almond and apricot-kernel liqueur; orgeat has no alcohol and Frangelico is hazelnut, so each changes the drink', 'liqueur', 'amaretto', { bar: true }),
  NONE('green chartreuse', 'about 130 herbs in one bottle, with no copy; yellow Chartreuse is sweeter and milder, so it makes a different drink', 'liqueur', 'chartreuse', { bar: true }),
  NONE('yellow chartreuse', 'a honeyed, saffron-and-herb liqueur with no copy; green Chartreuse is stronger and sharper, so it makes a different drink', 'liqueur', 'chartreuse', { bar: true }),
  NONE('benedictine', 'a honeyed herbal liqueur of 27 botanicals; nothing common copies it', 'liqueur', 'benedictine', { bar: true }),
  NONE('amaro montenegro', 'light, floral and orange-peel bitter; Averna and Nonino are the nearest amari but are darker or sweeter, so they change the drink', 'liqueur', 'amaro', { bar: true }),
  NONE('fernet branca', 'a menthol, saffron and myrrh bitter that no other amaro matches', 'liqueur', 'fernet', { bar: true }),
  NONE('galliano', 'a vanilla-and-anise herb liqueur with no copy', 'liqueur', 'galliano', { bar: true }),
  NONE('drambuie', 'a whisky and honey-spice liqueur with no copy', 'liqueur', 'drambuie', { bar: true }),
  NONE('pear brandy', 'a clear, unsweetened pear distillate: grape brandy is aged and sweeter, so it changes the drink', 'spirit', 'pear brandy', { bar: true }),
  NONE('apricot brandy', 'a sweet apricot liqueur; peach schnapps is a different fruit and grape brandy has none of it', 'spirit', 'apricot liqueur', { bar: true }),
];
