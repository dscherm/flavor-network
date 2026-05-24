=== ALIAS MAP CORRECTION CHANGELOG ===

--- FIXED auto_high values (semantically wrong) ---
  'bitter cherry': 'bitter' -> 'cherry'
  'bitter lemon': 'bitter' -> 'lemon'
  'bitter orange': 'bitter' -> 'orange'
  'cherry tomato': 'cherry' -> 'tomatoe'
  'egg plant': 'egg' -> 'eggplant'
  'lemon sole': 'lemon' -> 'fish'
  'scotch bonnet': 'scotch' -> 'chilie'
  'scotch spearmint': 'scotch' -> 'mint'
  'turkey berry': 'turkey' -> 'berry'
  'european anchovy': 'european' -> 'anchovy'
  'european rabbit': 'european' -> 'rabbit'
  'grape seed oil': 'grape' -> 'vegetable'
  'lemon grass': 'lemon' -> 'lemongrass'
  'dark brown soft sugar': 't sugar' -> 'brown sugar'
  'light oil': 't oil' -> 'vegetable'
  'extra virgin extra virgin olive oil': 'virgin extra virgin olive oil' -> 'olive oil'
  'extra-virgin extra virgin olive oil': 'virgin extra virgin olive oil' -> 'olive oil'
  'extravirgin olive oil': 'virgin olive oil' -> 'olive oil'

--- REMOVED from auto_high -> unmatched (no valid parent) ---
  'jerusalem artichoke' (was -> 'artichoke') moved to unmatched
  'prickly pear' (was -> 'pear') moved to unmatched
  'sea cucumber' (was -> 'cucumber') moved to unmatched
  'giant butterbur' (was -> 't butter') moved to unmatched
  'grape nut' (was -> 'grape') moved to unmatched
  'grape nut cereal' (was -> 'grape') moved to unmatched

--- PROMOTED flagged -> auto_high (suggestion correct) ---
  'chile' -> 'chilie'
  'chile flake' -> 'chili flake'
  'chile oil' -> 'chili oil'
  'chile paste' -> 'chili paste'
  'chile powder' -> 'chili powder'
  'chilli' -> 'chili'
  'chillie' -> 'chilie'
  'strawberrie' -> 'strawberry'
  'raspberrie' -> 'raspberry'
  'blackberrie' -> 'blackberry'
  'blueberrie' -> 'blueberry'
  'cranberrie' -> 'cranberry'
  'cardomom' -> 'cardamom'
  'cardamon seed' -> 'cardamom seed'
  'hazlenut' -> 'hazelnut'
  'lavendar' -> 'lavender'
  'mayonaisse' -> 'mayonnaise'
  'mayonnai' -> 'mayonnaise'
  'gruyère' -> 'gruyere'
  'whisky' -> 'whiskey'
  'yoghurt' -> 'yogurt'
  'black eyed pea' -> 'black-eyed pea'
  'four-cheese' -> 'four cheese'
  'half-and-half' -> 'half and half'
  'lasagne noodle' -> 'lasagna noodle'
  'no salt' -> 'no-salt'
  'no sugar' -> 'no-sugar'
  'red-pepper' -> 'red pepper'
  'redcurrant' -> 'currant'
  'mixed berrie' -> 'mixed berry'
  'butter +' -> 'butter'
  'milk +' -> 'milk'
  'salt +' -> 'salt'
  'sugar +' -> 'sugar'
  'coco sugar' -> 'coconut sugar'
  'chipotle powder' -> 'chili powder'
  'bilberry' -> 'blueberry'
  'cookie crust' -> 'cookie pie crust'
  'graham wafer crumb' -> 'graham cracker crumb'
  'safflower' -> 'safflower oil'
  'peachtree schnapp' -> 'peach schnapp'
  'graham crust' -> 'graham pie crust'

--- REMAPPED flagged -> auto_high (suggestion was wrong) ---
  'jeera powder': 'celery powder' (rejected) -> 'cumin'
  'tumeric powder': 'rice powder' (rejected) -> 'turmeric'
  'cacao powder': 'carob powder' (rejected) -> 'cocoa'
  'passata': 'pasta' (rejected) -> 'tomato sauce'
  'toffee': 'coffee' (rejected) -> 'caramel'
  'pot roast': 'pork roast' (rejected) -> 'beef'
  'sirloin steak': 'salmon steak' (rejected) -> 'beef'
  'corona': 'corn' (rejected) -> 'beer'
  'orgeat syrup': 'orange syrup' (rejected) -> 'almond'
  'anise': 'aniseed' (rejected) -> 'aniseed'
  'bird chile': 'red chilie' (rejected) -> 'chilie'
  'black crowberry': 'black cherry' (rejected) -> 'berry'
  'black mulberry': 'blackberry' (rejected) -> 'berry'
  'comte cheese': 'cottage cheese' (rejected) -> 'cheese'
  'domiati cheese': 'goat cheese' (rejected) -> 'cheese'
  'dressing mix': 'dressing' (rejected) -> 'dressing'
  'flatfish': 'catfish' (rejected) -> 'fish'
  'frybread': 'rye bread' (rejected) -> 'bread'
  'green pea': 'green bean' (rejected) -> 'peas'
  'jello': 'jelly' (rejected) -> 'jelly'
  'jostaberry': 'strawberry' (rejected) -> 'berry'
  'other cheese': 'three cheese' (rejected) -> 'cheese'
  'packets yeast': 'cakes yeast' (rejected) -> 'yeast'
  'red snapper': 'red apple' (rejected) -> 'fish'
  'rowanberry': 'cranberry' (rejected) -> 'berry'
  'russian cheese': 'parmesian cheese' (rejected) -> 'cheese'
  'sablefish': 'bluefish' (rejected) -> 'fish'
  'seedless red': 'seedless grape' (rejected) -> 'grape'
  'sheefish': 'shellfish' (rejected) -> 'fish'
  'sheep cheese': 'sharp cheese' (rejected) -> 'cheese'
  'sheep milk': 'sweet milk' (rejected) -> 'milk'
  'sunflower': 'sunflower nut' (rejected) -> 'sunflower seed'
  'sweet green pea': 'sweet green pepper' (rejected) -> 'peas'
  'sweet pea': 'sweet apple' (rejected) -> 'peas'
  'thin noodle': 'chicken noodle' (rejected) -> 'noodles'
  'tilsit cheese': 'stilton cheese' (rejected) -> 'cheese'
  'white sucker': 'white cake' (rejected) -> 'fish'
  'wide noodle': 'rice noodle' (rejected) -> 'noodles'
  'yeast roll': 'wheat roll' (rejected) -> 'bread'
  'yellow pea': 'yellow bean' (rejected) -> 'peas'
  '.salt': 'salt' (rejected) -> 'salt'
  '-milk': 'milk' (rejected) -> 'milk'

--- REJECTED flagged -> unmatched (no valid parent) ---
  "'s cheese" (bad suggestion 'soy cheese') moved to unmatched
  "'s sauce" (bad suggestion 'soy sauce') moved to unmatched
  "'s sugar" (bad suggestion 't sugar') moved to unmatched
  'achiote powder' (bad suggestion 'chocolate powder') moved to unmatched
  'anisette' (bad suggestion 'aniseed') moved to unmatched
  'baking pan' (bad suggestion 'king prawn') moved to unmatched
  'baking powder' (bad suggestion 'mango powder') moved to unmatched
  'beaver' (bad suggestion 'beer') moved to unmatched
  'black bear' (bad suggestion 'blackberry') moved to unmatched
  'brown bear' (bad suggestion 'brown bread') moved to unmatched
  'bilberry wine' (bad suggestion 'blackberry wine') moved to unmatched
  'bisquick baking' (bad suggestion 'biscuit baking') moved to unmatched
  'bisquick baking mix' (bad suggestion 'biscuit baking mix') moved to unmatched
  'black tea' (bad suggestion 'black bean') moved to unmatched
  'green tea' (bad suggestion 'green bean') moved to unmatched
  'bonito flakes' (bad suggestion 'onion flake') moved to unmatched
  'borage' (bad suggestion 'orange') moved to unmatched
  'bouillon powder' (bad suggestion 'onion powder') moved to unmatched
  'calamu' (bad suggestion 'clam') moved to unmatched
  'cane juice' (bad suggestion 'orange juice') moved to unmatched
  'carom seed' (bad suggestion 'cardamom seed') moved to unmatched
  'cedar' (bad suggestion 'cheddar') moved to unmatched
  'chinese quince' (bad suggestion 'chinese rice') moved to unmatched
  'common verbena' (bad suggestion 'lemon verbena') moved to unmatched
  'cookie crumb' (bad suggestion 'cake crumb') moved to unmatched
  'curly leaf' (bad suggestion 'curry leaf') moved to unmatched
  'file powder' (bad suggestion 'milk powder') moved to unmatched
  'freshly squeezed juice' (bad suggestion 'freshly squeezed lemon') moved to unmatched
  'grill seasoning' (bad suggestion 'chili seasoning') moved to unmatched
  'longan' (bad suggestion 'long bean') moved to unmatched
  'margarine' (bad suggestion 'soy margarine') moved to unmatched
  'minute' (bad suggestion 'mint') moved to unmatched
  'pate' (bad suggestion 'paste') moved to unmatched
  'powdered' (bad suggestion 'powder') moved to unmatched
  'powdered alum' (bad suggestion 'powdered cumin') moved to unmatched
  'romano pepper' (bad suggestion 'poblano pepper') moved to unmatched
  'sherbet' (bad suggestion 'herbe') moved to unmatched
  'sour mix' (bad suggestion 'sour milk') moved to unmatched
  'soy cream' (bad suggestion 'sour cream') moved to unmatched
  'tia maria' (bad suggestion 'tamari') moved to unmatched
  'vegan butter' (bad suggestion 'peanut butter') moved to unmatched
  'vegetarian food' (bad suggestion 'vegetarian beef') moved to unmatched
  'vine leave' (bad suggestion 'lime leave') moved to unmatched
  'white baking' (bad suggestion 'white bean') moved to unmatched
  'white lupine' (bad suggestion 'white wine') moved to unmatched
  'white tequila' (bad suggestion 'white quinoa') moved to unmatched
  'yellow chartreuse' (bad suggestion 'yellow cheese') moved to unmatched

=== SUMMARY ===
  auto_high_confidence: 782 entries
  flagged_medium remaining: 0 entries
  unmatched: 513 entries
  fixes applied: 18 value-fixes, 6 removals, 42 promotions, 42 remaps, 47 rejections