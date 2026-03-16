#!/usr/bin/env node
/**
 * Generate cuisine_map.json — maps ingredient names to cuisine traditions.
 * Cross-references proDataset/ingredients.json names with season_region.json
 * and applies curated culinary knowledge.
 */

const fs = require('fs');
const path = require('path');

const ingredients = require('../public/proDataset/ingredients.json');
const seasonRegion = require('../public/data/season_region.json');

// Region-to-cuisine mapping
const REGION_CUISINES = {
  "Mediterranean": ["Italian", "French", "Spanish", "Greek"],
  "Western Europe": ["French", "German", "British"],
  "Northern Europe": ["Scandinavian", "British", "German"],
  "Eastern Europe": ["Russian", "Polish", "Hungarian"],
  "East Asia": ["Chinese", "Japanese", "Korean"],
  "Southeast Asia": ["Thai", "Vietnamese", "Indonesian", "Malaysian", "Filipino"],
  "South Asia": ["Indian", "Pakistani", "Sri Lankan"],
  "Middle East": ["Lebanese", "Turkish", "Persian", "Israeli"],
  "North Africa": ["Moroccan"],
  "Sub-Saharan Africa": ["Ethiopian", "West African", "South African"],
  "Central America": ["Mexican"],
  "South America": ["Brazilian", "Peruvian", "Argentine"],
  "Caribbean": ["Caribbean"],
  "North America": ["American"],
  "Oceania": ["Australian", "Pacific Islander"],
  "Central Asia": [],
  "Global": ["Global"]
};

// Curated overrides — these take priority over auto-mapping
// Only list cuisines where the ingredient is genuinely characteristic
const CURATED = {
  // === GLOBAL STAPLES ===
  "salt": ["Global"],
  "sugar": ["Global"],
  "water": ["Global"],
  "flour": ["Global"],
  "oil": ["Global"],
  "butter": ["Global"],
  "milk": ["Global"],
  "cream": ["Global"],
  "egg": ["Global"],
  "egg white": ["Global"],
  "egg yolk": ["Global"],
  "black pepper": ["Global"],
  "- black pepper": ["Global"],
  "- pepper": ["Global"],
  "pepper": ["Global"],
  "white pepper": ["Global"],
  "garlic": ["Global"],
  "onion": ["Global"],
  "rice": ["Chinese", "Japanese", "Korean", "Thai", "Vietnamese", "Indian", "Indonesian"],
  "bread": ["Global"],
  "vinegar": ["Global"],
  "honey": ["Global"],
  "lemon": ["Italian", "Greek", "French", "Lebanese", "Moroccan"],
  "lemon juice": ["Italian", "Greek", "French", "Lebanese", "Moroccan"],
  "lime": ["Thai", "Vietnamese", "Mexican", "Indian", "Caribbean"],
  "lime juice": ["Thai", "Vietnamese", "Mexican", "Indian", "Caribbean"],
  "vegetable oil": ["Global"],
  "canola oil": ["Global"],
  "salad oil": ["Global"],
  "cooking oil": ["Global"],
  "cooking spray": ["American"],
  "vegetable cooking spray": ["American"],

  // === ITALIAN ===
  "basil": ["Italian", "Thai"],
  "oregano": ["Italian", "Greek", "Mexican"],
  "parsley": ["Italian", "French", "Lebanese", "Turkish"],
  "rosemary": ["Italian", "French", "Greek"],
  "sage": ["Italian", "French", "British"],
  "thyme": ["French", "Italian", "Caribbean"],
  "marjoram": ["Italian", "Greek", "French"],
  "parmesan": ["Italian"],
  "parmesan cheese": ["Italian"],
  "parmigiano reggiano": ["Italian"],
  "mozzarella": ["Italian"],
  "mozzarella cheese": ["Italian"],
  "ricotta": ["Italian"],
  "ricotta cheese": ["Italian"],
  "mascarpone": ["Italian"],
  "gorgonzola": ["Italian"],
  "pecorino": ["Italian"],
  "pecorino romano": ["Italian"],
  "pecorino cheese": ["Italian"],
  "provolone": ["Italian"],
  "provolone cheese": ["Italian"],
  "asiago cheese": ["Italian"],
  "fontina": ["Italian"],
  "fontina cheese": ["Italian"],
  "prosciutto": ["Italian"],
  "pancetta": ["Italian"],
  "salami": ["Italian"],
  "mortadella": ["Italian"],
  "pepperoni": ["Italian", "American"],
  "tomato": ["Italian", "Mexican", "Spanish", "Indian"],
  "tomato sauce": ["Italian", "Mexican", "Spanish"],
  "tomato paste": ["Italian", "Turkish", "Indian"],
  "tomato juice": ["Italian", "American"],
  "italian tomatoe": ["Italian"],
  "crushed tomatoe": ["Italian", "Mexican"],
  "diced tomatoe": ["Italian", "Mexican"],
  "stewed tomatoe": ["Italian"],
  "sun-dried tomato": ["Italian"],
  "sundried tomatoe": ["Italian"],
  "san marzano tomatoe": ["Italian"],
  "roma tomatoe": ["Italian", "Mexican"],
  "roma tomato": ["Italian", "Mexican"],
  "cherry tomato": ["Italian"],
  "cherry tomatoe": ["Italian"],
  "plum tomatoe": ["Italian"],
  "plum tomato": ["Italian"],
  "grape tomatoe": ["Italian"],
  "olive oil": ["Italian", "Greek", "Spanish", "French", "Lebanese"],
  "extra-virgin olive oil": ["Italian", "Greek", "Spanish"],
  "extra virgin olive oil": ["Italian", "Greek", "Spanish"],
  "olive": ["Italian", "Greek", "Spanish", "Moroccan"],
  "kalamata olive": ["Greek"],
  "green olive": ["Spanish", "Italian", "Moroccan"],
  "black olive": ["Italian", "Greek", "Spanish"],
  "balsamic vinegar": ["Italian"],
  "aged balsamic vinegar": ["Italian"],
  "balsamic": ["Italian"],
  "balsamic glaze": ["Italian"],
  "pesto": ["Italian"],
  "basil pesto": ["Italian"],
  "marinara": ["Italian"],
  "marinara sauce": ["Italian"],
  "focaccia": ["Italian"],
  "ciabatta": ["Italian"],
  "polenta": ["Italian"],
  "arborio rice": ["Italian"],
  "risotto": ["Italian"],
  "orzo": ["Italian", "Greek"],
  "angel hair pasta": ["Italian"],
  "fettuccine": ["Italian"],
  "linguine": ["Italian"],
  "penne": ["Italian"],
  "penne pasta": ["Italian"],
  "rigatoni": ["Italian"],
  "spaghetti": ["Italian"],
  "ziti": ["Italian"],
  "farfalle": ["Italian"],
  "fusilli": ["Italian"],
  "lasagna noodle": ["Italian"],
  "lasagna": ["Italian"],
  "manicotti": ["Italian"],
  "gnocchi": ["Italian"],
  "ravioli": ["Italian"],
  "tortellini": ["Italian"],
  "capellini": ["Italian"],
  "rotini": ["Italian"],
  "cavatappi": ["Italian"],
  "cannellini bean": ["Italian", "French"],
  "pine nut": ["Italian", "Lebanese"],
  "pine nuts": ["Italian", "Lebanese"],
  "caper": ["Italian", "Spanish", "French"],
  "capers": ["Italian", "Spanish", "French"],
  "artichoke": ["Italian", "French", "Greek"],
  "artichoke heart": ["Italian", "Greek"],
  "arugula": ["Italian"],
  "radicchio": ["Italian"],
  "fennel": ["Italian", "French", "Indian"],
  "fennel bulb": ["Italian", "French"],
  "red pepper flake": ["Italian"],
  "red pepper flakes": ["Italian"],
  "crushed red pepper": ["Italian", "Korean"],
  "crushed red pepper flake": ["Italian"],
  "grappa": ["Italian"],
  "amaretto": ["Italian"],
  "limoncello": ["Italian"],
  "campari": ["Italian"],
  "aperol": ["Italian"],
  "sambuca": ["Italian"],
  "prosecco": ["Italian"],
  "marsala": ["Italian"],
  "marsala wine": ["Italian"],

  // === FRENCH ===
  "tarragon": ["French"],
  "chervil": ["French"],
  "shallot": ["French", "Thai", "Vietnamese"],
  "shallots": ["French", "Thai", "Vietnamese"],
  "leek": ["French", "British"],
  "leeks": ["French", "British"],
  "dijon mustard": ["French"],
  "dijon": ["French"],
  "whole grain mustard": ["French", "German"],
  "creme fraiche": ["French"],
  "brie": ["French"],
  "camembert": ["French"],
  "roquefort": ["French"],
  "gruyere": ["French"],
  "gruyere cheese": ["French"],
  "comte": ["French"],
  "emmental": ["French", "German"],
  "emmentaler": ["French", "German"],
  "goat cheese": ["French"],
  "chevre": ["French"],
  "fromage blanc": ["French"],
  "boursin": ["French"],
  "brandy": ["French"],
  "cognac": ["French"],
  "grand marnier": ["French"],
  "cointreau": ["French"],
  "chartreuse": ["French"],
  "champagne": ["French"],
  "white wine": ["French", "Italian"],
  "red wine": ["French", "Italian", "Spanish"],
  "chablis": ["French"],
  "burgundy": ["French"],
  "burgundy wine": ["French"],
  "herbes de provence": ["French"],
  "herbs de provence": ["French"],
  "herb de provence": ["French"],
  "fines herbes": ["French"],
  "truffle": ["French", "Italian"],
  "truffle oil": ["French", "Italian"],
  "black truffle": ["French", "Italian"],
  "foie gras": ["French"],
  "duck": ["French", "Chinese"],
  "duck fat": ["French"],
  "duck breast": ["French", "Chinese"],
  "veal": ["French", "Italian"],
  "veal stock": ["French"],
  "rabbit": ["French", "Italian", "Spanish"],
  "escargot": ["French"],
  "endive": ["French"],
  "frisee": ["French"],
  "mache": ["French"],
  "lemon verbena": ["French"],
  "celery root": ["French", "German"],
  "celeriac": ["French", "German"],
  "sorrel": ["French", "Russian"],
  "brioche": ["French"],
  "crepe": ["French"],

  // === SPANISH ===
  "saffron": ["Spanish", "Indian", "Persian", "Moroccan"],
  "paprika": ["Spanish", "Hungarian"],
  "smoked paprika": ["Spanish"],
  "pimenton": ["Spanish"],
  "chorizo": ["Spanish", "Mexican", "Portuguese"],
  "manchego": ["Spanish"],
  "manchego cheese": ["Spanish"],
  "sherry": ["Spanish"],
  "sherry vinegar": ["Spanish"],
  "aged sherry vinegar": ["Spanish"],
  "romesco": ["Spanish"],
  "piquillo pepper": ["Spanish"],

  // === GREEK ===
  "feta": ["Greek", "Turkish"],
  "feta cheese": ["Greek", "Turkish"],
  "phyllo dough": ["Greek", "Turkish", "Lebanese"],
  "phyllo": ["Greek", "Turkish", "Lebanese"],
  "filo dough": ["Greek", "Turkish"],
  "pita bread": ["Greek", "Lebanese", "Turkish", "Israeli"],
  "pita": ["Greek", "Lebanese", "Turkish"],
  "tzatziki": ["Greek"],
  "dill": ["Greek", "Scandinavian", "Russian", "Polish"],

  // === PORTUGUESE ===
  "piri piri": ["Portuguese", "South African"],

  // === CHINESE ===
  "soy sauce": ["Chinese", "Japanese", "Korean"],
  "sesame oil": ["Chinese", "Japanese", "Korean"],
  "asian sesame oil": ["Chinese", "Japanese", "Korean"],
  "ginger": ["Chinese", "Japanese", "Indian", "Thai"],
  "fresh ginger": ["Chinese", "Japanese", "Indian", "Thai"],
  "ginger root": ["Chinese", "Japanese", "Indian", "Thai"],
  "ground ginger": ["Chinese", "Indian"],
  "star anise": ["Chinese", "Vietnamese"],
  "five spice": ["Chinese"],
  "five-spice powder": ["Chinese"],
  "five spice powder": ["Chinese"],
  "chinese five spice": ["Chinese"],
  "chinese five-spice": ["Chinese"],
  "szechuan peppercorn": ["Chinese"],
  "sichuan peppercorn": ["Chinese"],
  "hoisin sauce": ["Chinese"],
  "hoisin": ["Chinese"],
  "oyster sauce": ["Chinese", "Thai"],
  "rice vinegar": ["Chinese", "Japanese"],
  "rice wine vinegar": ["Chinese", "Japanese"],
  "shaoxing wine": ["Chinese"],
  "shaoxing": ["Chinese"],
  "chili oil": ["Chinese"],
  "black vinegar": ["Chinese"],
  "black bean sauce": ["Chinese"],
  "fermented black bean": ["Chinese"],
  "xo sauce": ["Chinese"],
  "doubanjiang": ["Chinese"],
  "doenjang": ["Korean"],
  "wonton wrapper": ["Chinese"],
  "spring roll wrapper": ["Chinese", "Vietnamese"],
  "egg noodle": ["Chinese"],
  "napa cabbage": ["Chinese", "Korean"],
  "bok choy": ["Chinese"],
  "chinese cabbage": ["Chinese"],
  "gai lan": ["Chinese"],
  "choy sum": ["Chinese"],
  "yu choy": ["Chinese"],
  "water chestnut": ["Chinese"],
  "bamboo shoot": ["Chinese", "Thai", "Japanese"],
  "tofu": ["Chinese", "Japanese", "Korean", "Thai"],
  "firm tofu": ["Chinese", "Japanese", "Korean"],
  "silken tofu": ["Chinese", "Japanese"],
  "dried tofu": ["Chinese"],
  "tofu skin": ["Chinese", "Japanese"],
  "yuba": ["Chinese", "Japanese"],
  "century egg": ["Chinese"],
  "salted duck egg": ["Chinese"],
  "dried shrimp": ["Chinese", "Thai", "Vietnamese", "Brazilian"],
  "dried scallop": ["Chinese"],
  "black garlic": ["Chinese", "Korean"],
  "miso": ["Japanese"],
  "miso paste": ["Japanese"],
  "pickled ginger": ["Japanese"],
  "seitan": ["Chinese", "Japanese"],
  "chinese mustard": ["Chinese"],
  "chinese long bean": ["Chinese"],
  "celtuce": ["Chinese"],
  "lotus root": ["Chinese", "Japanese", "Indian"],
  "lotus seed": ["Chinese"],
  "black rice": ["Chinese", "Indonesian"],
  "glutinous rice": ["Chinese", "Thai"],
  "sticky rice": ["Thai", "Chinese"],
  "peanut oil": ["Chinese"],
  "scallion": ["Chinese", "Japanese", "Korean", "American"],
  "green onion": ["Chinese", "Japanese", "Korean", "Mexican"],

  // === JAPANESE ===
  "wasabi": ["Japanese"],
  "wasabi paste": ["Japanese"],
  "nori": ["Japanese", "Korean"],
  "wakame": ["Japanese", "Korean"],
  "kombu": ["Japanese"],
  "hijiki": ["Japanese"],
  "dashi": ["Japanese"],
  "bonito flake": ["Japanese"],
  "bonito": ["Japanese"],
  "mirin": ["Japanese"],
  "sake": ["Japanese"],
  "tamari": ["Japanese"],
  "ponzu": ["Japanese"],
  "yuzu": ["Japanese"],
  "yuzu juice": ["Japanese"],
  "furikake": ["Japanese"],
  "togarashi": ["Japanese"],
  "shichimi togarashi": ["Japanese"],
  "sansho pepper": ["Japanese"],
  "shiso": ["Japanese"],
  "shiso leaf": ["Japanese"],
  "perilla": ["Japanese", "Korean"],
  "perilla seed": ["Korean"],
  "myoga": ["Japanese"],
  "kinome": ["Japanese"],
  "soba noodle": ["Japanese"],
  "udon noodle": ["Japanese"],
  "ramen noodle": ["Japanese"],
  "sushi rice": ["Japanese"],
  "mochi": ["Japanese"],
  "umeboshi": ["Japanese"],
  "ume plum": ["Japanese"],
  "sudachi": ["Japanese"],
  "dried persimmon": ["Japanese"],
  "chrysanthemum": ["Japanese", "Chinese"],
  "mizuna": ["Japanese"],
  "tatsoi": ["Japanese", "Chinese"],
  "enoki mushroom": ["Japanese"],
  "shiitake mushroom": ["Japanese", "Chinese"],
  "shiitake": ["Japanese", "Chinese"],
  "maitake mushroom": ["Japanese"],
  "king oyster mushroom": ["Japanese", "Korean"],
  "matcha": ["Japanese"],
  "green tea": ["Japanese", "Chinese"],
  "oolong tea": ["Chinese"],
  "yellowtail": ["Japanese"],
  "eel": ["Japanese"],

  // === KOREAN ===
  "gochugaru": ["Korean"],
  "gochujang": ["Korean"],
  "kimchi": ["Korean"],
  "soju": ["Korean"],
  "red bean paste": ["Korean", "Japanese", "Chinese"],
  "white bean paste": ["Japanese"],
  "sesame seed": ["Korean", "Japanese", "Chinese", "Indian", "Lebanese"],

  // === THAI ===
  "lemongrass": ["Thai", "Vietnamese", "Indonesian"],
  "thai basil": ["Thai", "Vietnamese"],
  "kaffir lime leaf": ["Thai", "Indonesian"],
  "galangal": ["Thai", "Indonesian", "Malaysian"],
  "thai chili": ["Thai"],
  "bird's eye chili": ["Thai", "Vietnamese"],
  "coconut milk": ["Thai", "Indian", "Indonesian", "Malaysian", "Caribbean"],
  "coconut cream": ["Thai", "Indian"],
  "fish sauce": ["Thai", "Vietnamese"],
  "asian fish sauce": ["Thai", "Vietnamese"],
  "palm sugar": ["Thai", "Indonesian"],
  "red curry paste": ["Thai"],
  "green curry paste": ["Thai"],
  "massaman curry paste": ["Thai"],
  "tom yum paste": ["Thai"],
  "satay sauce": ["Thai", "Indonesian", "Malaysian"],
  "curry paste": ["Thai", "Indian"],
  "sriracha": ["Thai"],
  "jasmine rice": ["Thai"],

  // === VIETNAMESE ===
  "rice noodle": ["Vietnamese", "Thai", "Chinese"],
  "rice paper": ["Vietnamese"],
  "calamansi": ["Filipino"],
  "nam pla": ["Thai"],

  // === INDONESIAN / MALAYSIAN ===
  "sambal": ["Indonesian", "Malaysian"],
  "sambal oelek": ["Indonesian"],
  "tempeh": ["Indonesian"],
  "belacan": ["Malaysian"],
  "shrimp paste": ["Malaysian", "Thai", "Indonesian"],
  "candlenut": ["Indonesian", "Malaysian"],
  "candle nut": ["Indonesian", "Malaysian"],
  "kemangi": ["Indonesian"],
  "kencur": ["Indonesian"],
  "laksa leaf": ["Malaysian"],
  "pandanus": ["Indonesian", "Malaysian"],
  "pandan leaf": ["Indonesian", "Malaysian", "Thai"],
  "torch ginger": ["Indonesian", "Malaysian"],

  // === FILIPINO ===
  "palm vinegar": ["Filipino"],

  // === INDIAN ===
  "cumin": ["Indian", "Mexican", "Lebanese", "Turkish", "Moroccan"],
  "ground cumin": ["Indian", "Mexican", "Lebanese"],
  "coriander": ["Indian", "Thai", "Mexican", "Lebanese"],
  "ground coriander": ["Indian", "Thai", "Mexican"],
  "coriander seed": ["Indian"],
  "cilantro": ["Mexican", "Indian", "Thai", "Vietnamese"],
  "fresh cilantro": ["Mexican", "Indian", "Thai"],
  "turmeric": ["Indian", "Thai", "Indonesian"],
  "ground turmeric": ["Indian", "Thai"],
  "curry powder": ["Indian", "Thai", "Japanese"],
  "curry leaf": ["Indian", "Sri Lankan"],
  "cardamom": ["Indian", "Lebanese", "Scandinavian"],
  "green cardamom": ["Indian"],
  "black cardamom": ["Indian", "Chinese"],
  "cinnamon": ["Indian", "Mexican", "Moroccan", "French"],
  "ground cinnamon": ["Indian", "Mexican", "Moroccan"],
  "cinnamon stick": ["Indian", "Mexican"],
  "clove": ["Indian", "Indonesian", "Chinese"],
  "ground clove": ["Indian"],
  "whole clove": ["Indian"],
  "nutmeg": ["Indian", "Indonesian", "French", "Caribbean"],
  "ground nutmeg": ["Indian", "French", "Caribbean"],
  "garam masala": ["Indian", "Pakistani"],
  "chaat masala": ["Indian"],
  "panch phoron": ["Indian"],
  "fenugreek": ["Indian"],
  "fenugreek seed": ["Indian"],
  "fenugreek leave": ["Indian"],
  "kasuri methi": ["Indian"],
  "asafoetida": ["Indian"],
  "asafetida powder": ["Indian"],
  "asafoetida powder": ["Indian"],
  "mustard seed": ["Indian", "French", "German"],
  "black mustard seed": ["Indian"],
  "ajwain": ["Indian"],
  "kalonji": ["Indian"],
  "nigella seed": ["Indian", "Turkish"],
  "amchur": ["Indian"],
  "kokum": ["Indian"],
  "black salt": ["Indian"],
  "pink salt": ["Indian", "Pakistani"],
  "ghee": ["Indian", "Pakistani"],
  "paneer": ["Indian"],
  "yogurt": ["Indian", "Turkish", "Greek", "Lebanese"],
  "plain yogurt": ["Indian", "Turkish", "Greek"],
  "greek yogurt": ["Greek"],
  "naan": ["Indian", "Pakistani"],
  "roti": ["Indian", "Malaysian", "Caribbean"],
  "basmati rice": ["Indian", "Pakistani"],
  "lentil": ["Indian", "Turkish", "French"],
  "red lentil": ["Indian", "Turkish"],
  "chickpea": ["Indian", "Lebanese", "Turkish", "Moroccan"],
  "chana dal": ["Indian"],
  "urad dal": ["Indian"],
  "mung bean": ["Indian", "Chinese", "Thai"],
  "tamarind": ["Indian", "Thai", "Mexican"],
  "tamarind paste": ["Indian", "Thai"],
  "mango chutney": ["Indian"],
  "chutney": ["Indian"],
  "buttermilk": ["Indian", "American", "Scandinavian"],
  "jaggery": ["Indian"],
  "mustard oil": ["Indian"],
  "kashmiri chili": ["Indian"],
  "long pepper": ["Indian"],

  // === PAKISTANI ===

  // === SRI LANKAN ===

  // === MEXICAN ===
  "jalapeno": ["Mexican"],
  "jalapeno pepper": ["Mexican"],
  "poblano": ["Mexican"],
  "poblano pepper": ["Mexican"],
  "serrano": ["Mexican"],
  "serrano pepper": ["Mexican"],
  "serrano chile": ["Mexican"],
  "habanero": ["Mexican", "Caribbean"],
  "habanero pepper": ["Mexican", "Caribbean"],
  "ancho": ["Mexican"],
  "ancho chili": ["Mexican"],
  "ancho chile": ["Mexican"],
  "ancho chile powder": ["Mexican"],
  "ancho chili powder": ["Mexican"],
  "chipotle": ["Mexican"],
  "chipotle pepper": ["Mexican"],
  "chipotle chile": ["Mexican"],
  "chipotle in adobo": ["Mexican"],
  "guajillo": ["Mexican"],
  "guajillo chile": ["Mexican"],
  "pasilla": ["Mexican"],
  "pasilla chile": ["Mexican"],
  "arbol chile": ["Mexican"],
  "new mexico chile": ["Mexican"],
  "achiote": ["Mexican", "Caribbean"],
  "achiote paste": ["Mexican"],
  "achiote powder": ["Mexican"],
  "annatto": ["Mexican", "Caribbean", "Filipino"],
  "annatto seed": ["Mexican", "Filipino"],
  "corn tortilla": ["Mexican"],
  "flour tortilla": ["Mexican", "Tex-Mex"],
  "tortilla": ["Mexican"],
  "tortilla chip": ["Mexican", "Tex-Mex"],
  "taco shell": ["Mexican", "Tex-Mex"],
  "taco sauce": ["Mexican", "Tex-Mex"],
  "taco seasoning": ["Mexican", "Tex-Mex"],
  "enchilada sauce": ["Mexican"],
  "mole": ["Mexican"],
  "salsa": ["Mexican"],
  "salsa verde": ["Mexican", "Italian"],
  "tomatillo": ["Mexican"],
  "pico de gallo": ["Mexican"],
  "epazote": ["Mexican"],
  "queso fresco": ["Mexican"],
  "cotija": ["Mexican"],
  "cotija cheese": ["Mexican"],
  "avocado": ["Mexican", "American", "Peruvian"],
  "guacamole": ["Mexican"],
  "pumpkin seed": ["Mexican"],
  "pepita": ["Mexican"],
  "piloncillo": ["Mexican"],
  "agave": ["Mexican"],
  "agave syrup": ["Mexican"],
  "tequila": ["Mexican"],
  "mezcal": ["Mexican"],
  "mexican chocolate": ["Mexican"],
  "mexican crema": ["Mexican"],
  "spanish rice": ["Mexican"],
  "black bean": ["Mexican", "Brazilian", "Caribbean"],
  "pinto bean": ["Mexican", "Tex-Mex"],
  "refried bean": ["Mexican", "Tex-Mex"],

  // === BRAZILIAN ===
  "cachaca": ["Brazilian"],
  "pisco": ["Peruvian"],
  "dulce de leche": ["Argentine", "Brazilian"],
  "chimichurri": ["Argentine"],
  "hearts of palm": ["Brazilian", "Peruvian"],

  // === PERUVIAN ===
  "aji amarillo": ["Peruvian"],
  "quinoa": ["Peruvian"],
  "amaranth": ["Mexican", "Peruvian"],
  "amaranth flour": ["Mexican"],

  // === CARIBBEAN ===
  "allspice": ["Caribbean", "Mexican"],
  "scotch bonnet": ["Caribbean"],
  "rum": ["Caribbean"],
  "dark rum": ["Caribbean"],
  "light rum": ["Caribbean"],
  "coconut rum": ["Caribbean"],
  "plantain": ["Caribbean", "West African"],
  "mace": ["Caribbean", "Indian"],
  "jerk seasoning": ["Caribbean"],
  "angostura bitters": ["Caribbean"],
  "molasses": ["Caribbean", "American"],
  "conch": ["Caribbean"],
  "ginger beer": ["Caribbean", "British"],

  // === MOROCCAN ===
  "ras el hanout": ["Moroccan"],
  "harissa": ["Moroccan", "Lebanese"],
  "preserved lemon": ["Moroccan"],
  "couscous": ["Moroccan"],
  "chermoula": ["Moroccan"],
  "rose water": ["Moroccan", "Indian", "Lebanese", "Persian"],
  "orange blossom water": ["Moroccan", "Lebanese", "French"],

  // === ETHIOPIAN ===
  "berbere": ["Ethiopian"],
  "teff": ["Ethiopian"],
  "injera": ["Ethiopian"],

  // === WEST AFRICAN ===
  "grains of paradise": ["West African"],

  // === TURKISH ===
  "sumac": ["Turkish", "Lebanese"],
  "za'atar": ["Lebanese", "Israeli", "Turkish"],
  "zaatar": ["Lebanese", "Israeli"],
  "pomegranate molasses": ["Turkish", "Lebanese", "Persian"],
  "aleppo pepper": ["Turkish", "Lebanese"],
  "bulgur": ["Turkish", "Lebanese"],
  "freekeh": ["Lebanese", "Turkish"],

  // === LEBANESE / MIDDLE EASTERN ===
  "tahini": ["Lebanese", "Israeli"],
  "hummus": ["Lebanese", "Israeli"],
  "labneh": ["Lebanese"],
  "halloumi": ["Greek", "Turkish", "Lebanese"],
  "date": ["Lebanese", "Persian", "Moroccan"],
  "date syrup": ["Persian", "Lebanese"],
  "pistachio": ["Persian", "Turkish", "Lebanese", "Indian"],
  "pomegranate": ["Persian", "Turkish", "Lebanese"],
  "zhug": ["Israeli"],
  "fava bean": ["Lebanese", "Italian", "Greek", "Moroccan"],

  // === PERSIAN ===

  // === ISRAELI ===

  // === RUSSIAN ===
  "sauerkraut": ["German", "Russian", "Polish"],
  "beet": ["Russian", "Polish"],
  "horseradish": ["Russian", "Polish", "German"],
  "vodka": ["Russian", "Polish"],
  "kefir": ["Russian"],
  "sour cream": ["Russian", "Polish", "Hungarian", "Mexican"],
  "caviar": ["Russian"],

  // === POLISH ===
  "caraway": ["Polish", "German", "Hungarian", "Scandinavian"],

  // === HUNGARIAN ===

  // === GERMAN ===
  "sausage": ["German", "American"],
  "pumpernickel": ["German"],

  // === SCANDINAVIAN ===
  "juniper berry": ["Scandinavian", "German"],
  "aquavit": ["Scandinavian"],
  "lingonberry": ["Scandinavian"],
  "smoked salt": ["Scandinavian"],

  // === BRITISH ===
  "worcestershire sauce": ["British", "American"],
  "english mustard": ["British"],
  "clotted cream": ["British"],
  "stilton": ["British"],
  "malt": ["British"],
  "malt vinegar": ["British"],

  // === AMERICAN ===
  "maple syrup": ["American"],
  "corn syrup": ["American"],
  "white corn syrup": ["American"],
  "dark corn syrup": ["American"],
  "corn bread": ["American", "Southern US"],
  "barbecue sauce": ["American"],
  "ketchup": ["American"],
  "mayonnaise": ["American", "French"],
  "ranch dressing": ["American"],
  "bourbon": ["American"],
  "rye whiskey": ["American"],
  "applejack": ["American"],
  "apple cider": ["American"],
  "apple cider vinegar": ["American"],
  "apple-cider vinegar": ["American"],
  "cranberry": ["American"],
  "cranberry sauce": ["American"],
  "dried cranberry": ["American"],
  "blueberry": ["American", "Scandinavian"],
  "pecan": ["American", "Southern US"],
  "wild rice": ["American"],
  "bison": ["American"],
  "turkey": ["American"],
  "peanut butter": ["American"],
  "cornflake": ["American"],
  "corn flake crumb": ["American"],
  "graham cracker crumb": ["American"],
  "graham cracker crust": ["American"],
  "graham cracker": ["American"],

  // === CAJUN/CREOLE ===
  "andouille": ["Cajun/Creole"],
  "andouille sausage": ["Cajun/Creole"],
  "cajun seasoning": ["Cajun/Creole"],
  "cajun spice": ["Cajun/Creole"],
  "creole mustard": ["Cajun/Creole"],
  "creole seasoning": ["Cajun/Creole"],
  "crawfish": ["Cajun/Creole"],
  "crayfish": ["Cajun/Creole", "Scandinavian"],
  "file powder": ["Cajun/Creole"],

  // === SOUTHERN US ===
  "collard green": ["Southern US"],
  "okra": ["Southern US", "Indian", "West African"],
  "black-eyed pea": ["Southern US", "West African"],
  "catfish": ["Southern US", "Vietnamese"],
  "tabasco": ["Cajun/Creole"],

  // === TEX-MEX ===
  "velveeta cheese": ["Tex-Mex"],
  "american cheese": ["American"],
  "monterey jack": ["Tex-Mex"],
  "monterey jack cheese": ["Tex-Mex"],
  "pepper jack cheese": ["Tex-Mex"],
  "cheddar": ["American", "British"],
  "cheddar cheese": ["American", "British"],
  "sharp cheddar": ["American", "British"],
  "sharp cheddar cheese": ["American", "British"],
  "colby jack cheese": ["American"],
  "colby cheese": ["American"],
  "chili powder": ["Mexican", "Tex-Mex", "Indian"],

  // === AUSTRALIAN ===
  "pepperberry": ["Australian"],
  "wattleseed": ["Australian"],
  "lemon myrtle": ["Australian"],
  "bush tomato": ["Australian"],
  "macadamia": ["Australian"],
  "macadamia nut": ["Australian"],

  // === PACIFIC ISLANDER ===
  "taro": ["Pacific Islander", "Filipino", "Japanese"],
  "breadfruit": ["Pacific Islander", "Caribbean"],

  // === MULTI-CUISINE COMMON ITEMS ===
  "coconut": ["Thai", "Indian", "Indonesian", "Caribbean", "Filipino"],
  "dried coconut": ["Indian", "Thai", "Indonesian"],
  "coconut oil": ["Indian", "Thai", "Indonesian"],
  "peanut": ["Chinese", "Thai", "Indonesian", "American"],
  "cashew": ["Indian", "Thai", "Vietnamese", "Brazilian"],
  "almond": ["Indian", "French", "Italian", "Moroccan"],
  "walnut": ["French", "Italian", "Persian", "Chinese"],
  "hazelnut": ["French", "Italian", "Turkish"],
  "chestnut": ["French", "Italian", "Chinese", "Japanese"],
  "pigeon pea": ["Indian", "Caribbean"],
  "eggplant": ["Italian", "Indian", "Turkish", "Japanese", "Thai"],
  "aubergine": ["Italian", "Indian", "Turkish"],
  "baby eggplant": ["Indian", "Thai"],
  "cucumber": ["Greek", "Indian", "Japanese"],
  "bell pepper": ["Italian", "Mexican", "Chinese"],
  "green bell pepper": ["American", "Chinese"],
  "red bell pepper": ["Italian", "Spanish"],
  "yellow bell pepper": ["Italian"],
  "mushroom": ["French", "Italian", "Chinese", "Japanese"],
  "portobello mushroom": ["Italian", "American"],
  "baby bella mushroom": ["Italian"],
  "baby portabella mushroom": ["Italian"],
  "baby portobello mushroom": ["Italian"],
  "porcini": ["Italian", "French"],
  "porcini mushroom": ["Italian", "French"],
  "chanterelle": ["French", "Scandinavian"],
  "morel": ["French", "American"],
  "oyster mushroom": ["Chinese", "Japanese"],
  "carrot": ["French", "Indian", "Chinese"],
  "celery": ["French", "Italian", "American"],
  "potato": ["French", "Indian", "German", "American"],
  "sweet potato": ["American", "Japanese", "West African", "Caribbean"],
  "yam": ["West African", "Caribbean"],
  "cassava": ["Brazilian", "West African", "Caribbean"],
  "manioc": ["Brazilian", "West African"],
  "jicama": ["Mexican"],
  "spinach": ["Indian", "Italian", "French"],
  "baby spinach": ["Italian", "American"],
  "broccoli": ["Italian", "Chinese", "American"],
  "broccoli rabe": ["Italian"],
  "rapini": ["Italian"],
  "romanesco": ["Italian"],
  "cauliflower": ["Indian", "Italian", "French"],
  "cabbage": ["German", "Russian", "Korean", "Chinese"],
  "red cabbage": ["German", "Scandinavian"],
  "savoy cabbage": ["French", "Italian"],
  "brussels sprout": ["French", "British"],
  "kale": ["Italian", "Scandinavian", "American"],
  "swiss chard": ["Italian", "French"],
  "asparagus": ["French", "Italian"],
  "asparagus spear": ["French", "Italian"],
  "zucchini": ["Italian", "French", "Greek"],
  "squash": ["Mexican", "American"],
  "butternut squash": ["Italian", "American"],
  "acorn squash": ["American"],
  "pumpkin": ["American", "Italian", "Thai"],
  "turnip": ["French", "Japanese"],
  "rutabaga": ["Scandinavian"],
  "parsnip": ["British", "French"],
  "radish": ["Japanese", "French", "Mexican"],
  "daikon": ["Japanese", "Korean"],
  "lettuce": ["French", "American"],
  "romaine lettuce": ["French", "Italian", "American"],
  "baby romaine lettuce": ["French", "Italian"],
  "watercress": ["French", "British"],
  "dandelion green": ["Italian", "French"],
  "bitter melon": ["Indian", "Chinese", "Filipino"],
  "winter melon": ["Chinese"],
  "kabocha": ["Japanese"],
  "chayote": ["Mexican"],
  "gooseberry": ["British", "Scandinavian"],
  "currant": ["British", "French"],
  "rhubarb": ["British", "Scandinavian"],
  "fig": ["Italian", "Greek", "Turkish", "Moroccan"],
  "dried fig": ["Turkish", "Moroccan"],
  "pomegranate": ["Persian", "Turkish", "Indian"],
  "persimmon": ["Japanese", "Korean"],
  "lychee": ["Chinese"],
  "passion fruit": ["Brazilian"],
  "dragon fruit": ["Vietnamese", "Thai"],
  "jackfruit": ["Indian", "Thai", "Indonesian"],
  "durian": ["Thai", "Malaysian", "Indonesian"],
  "rambutan": ["Thai", "Indonesian"],
  "guava": ["Mexican", "Indian", "Brazilian"],
  "papaya": ["Thai", "Mexican", "Brazilian"],
  "mango": ["Indian", "Thai", "Mexican"],
  "starfruit": ["Thai", "Malaysian"],
  "quince": ["Turkish", "Persian", "Spanish"],
  "kumquat": ["Chinese", "Japanese"],
  "tangerine": ["Chinese"],
  "mandarin": ["Chinese", "Japanese"],
  "clementine": ["Spanish", "Moroccan"],
  "blood orange": ["Italian"],
  "meyer lemon": ["American"],
  "key lime": ["Caribbean", "American"],
  "bergamot": ["Italian"],
  "pomelo": ["Chinese", "Thai"],
  "grapefruit": ["American"],
  "orange": ["Spanish", "American"],
  "orange juice": ["American"],

  // === PROTEINS ===
  "chicken": ["Global"],
  "chicken breast": ["Global"],
  "chicken thigh": ["Global"],
  "chicken cutlet": ["Italian", "Japanese", "American"],
  "chicken leg": ["Global"],
  "chicken wing": ["Chinese", "American"],
  "chicken stock": ["Global"],
  "chicken broth": ["Global"],
  "beef": ["American", "Argentine", "French"],
  "beef stock": ["French", "American"],
  "beef broth": ["French", "American"],
  "ground beef": ["American", "Mexican"],
  "extra lean beef": ["American"],
  "steak": ["American", "Argentine", "French"],
  "pork": ["Chinese", "German", "Mexican"],
  "pork chop": ["American", "German"],
  "pork loin": ["Chinese", "Italian"],
  "pork tenderloin": ["French", "Chinese"],
  "pork shoulder": ["Mexican", "Chinese"],
  "ground pork": ["Chinese", "Italian"],
  "pork belly": ["Chinese", "Korean"],
  "bacon": ["American", "British"],
  "bacon bit": ["American"],
  "bacon strip": ["American"],
  "bacon fat": ["American", "Southern US"],
  "bacon dripping": ["British"],
  "bacon rasher": ["British"],
  "ham": ["Italian", "Spanish", "American"],
  "smoked ham": ["German", "American"],
  "lamb": ["Indian", "Greek", "Turkish", "Moroccan", "Lebanese"],
  "lamb chop": ["Greek", "Indian", "French"],
  "lamb shank": ["Indian", "Turkish", "Moroccan"],
  "ground lamb": ["Turkish", "Lebanese", "Greek"],
  "leg of lamb": ["French", "Greek"],
  "goat": ["Indian", "Caribbean", "Mexican", "Ethiopian"],
  "venison": ["Scandinavian", "British", "American"],
  "quail": ["French", "Italian"],
  "quail egg": ["Japanese", "French"],
  "pheasant": ["French", "British"],
  "partridge": ["French", "British"],
  "goose": ["French", "German", "Chinese"],
  "duck egg": ["Chinese", "Thai"],

  // === SEAFOOD ===
  "salmon": ["Japanese", "Scandinavian", "American"],
  "tuna": ["Japanese", "Italian"],
  "cod": ["British", "Scandinavian", "Portuguese"],
  "halibut": ["American", "Scandinavian"],
  "swordfish": ["Italian", "Greek"],
  "sea bass": ["Italian", "Japanese"],
  "branzino": ["Italian", "Greek"],
  "trout": ["French", "American"],
  "sardine": ["Italian", "Portuguese", "Spanish"],
  "anchovy": ["Italian", "Spanish"],
  "anchovy filet": ["Italian"],
  "anchovy fillet": ["Italian"],
  "mackerel": ["Japanese", "British", "Scandinavian"],
  "snapper": ["Caribbean", "Thai"],
  "red snapper": ["Caribbean", "Mexican"],
  "mahi mahi": ["Caribbean", "American"],
  "tilapia": ["Mexican", "West African"],
  "flounder": ["American"],
  "sole": ["French"],
  "monkfish": ["French", "Spanish"],
  "grouper": ["Caribbean"],
  "arctic char": ["Scandinavian"],
  "herring": ["Scandinavian", "Russian", "Polish"],
  "smelt": ["Japanese", "Scandinavian"],
  "shrimp": ["Thai", "Chinese", "Italian", "American", "Cajun/Creole"],
  "lobster": ["American", "French"],
  "crab": ["American", "Chinese", "Japanese"],
  "crabmeat": ["American"],
  "backfin crabmeat": ["American"],
  "soft-shell crab": ["American"],
  "scallop": ["French", "Japanese"],
  "mussel": ["French", "Italian", "Spanish"],
  "clam": ["Italian", "American", "Japanese"],
  "baby clam": ["Italian"],
  "oyster": ["French", "American", "Japanese"],
  "squid": ["Italian", "Greek", "Japanese", "Thai"],
  "calamari": ["Italian", "Greek"],
  "octopus": ["Italian", "Greek", "Japanese", "Spanish"],
  "cuttlefish": ["Italian", "Japanese"],
  "abalone": ["Chinese", "Japanese"],
  "sea urchin": ["Japanese", "Italian"],

  // === DAIRY ===
  "cream cheese": ["American"],
  "cream cheese spread": ["American"],
  "cottage cheese": ["American"],
  "swiss cheese": ["French", "German"],
  "blue cheese": ["French"],
  "gouda": ["German"],
  "edam": ["German"],
  "whipping cream": ["Global"],
  "heavy cream": ["Global"],
  "half and half": ["American"],
  "condensed milk": ["Global"],
  "sweetened condensed milk": ["Global"],
  "evaporated milk": ["Global"],
  "powdered milk": ["Global"],
  "whole milk": ["Global"],

  // === GRAINS/STARCHES ===
  "all-purpose flour": ["Global"],
  "bread flour": ["Global"],
  "cake flour": ["Global"],
  "self-rising flour": ["American", "British"],
  "whole wheat flour": ["Global"],
  "cornstarch": ["Global"],
  "cornmeal": ["Italian", "American", "Mexican"],
  "masa harina": ["Mexican"],
  "farro": ["Italian"],
  "barley": ["British", "Scandinavian"],
  "oat": ["British", "Scandinavian", "American"],
  "buckwheat": ["Russian", "Japanese", "French"],
  "buckwheat flour": ["Japanese", "French"],
  "millet": ["Indian", "Ethiopian", "West African"],
  "sorghum": ["Ethiopian", "Indian"],
  "spelt": ["German", "Italian"],
  "noodle": ["Chinese", "Japanese", "Thai", "Vietnamese"],
  "pasta": ["Italian"],
  "egg noodles": ["German", "Chinese"],
  "couscous": ["Moroccan"],

  // === SWEETENERS & BAKING ===
  "brown sugar": ["Global"],
  "powdered sugar": ["Global"],
  "confectioners sugar": ["Global"],
  "turbinado sugar": ["Global"],
  "molasses": ["Caribbean", "American"],
  "dark chocolate": ["French", "Mexican"],
  "chocolate": ["French", "Mexican", "American"],
  "unsweetened chocolate": ["French", "Mexican"],
  "cocoa": ["Mexican", "French"],
  "cocoa powder": ["Mexican", "French"],
  "baking cocoa": ["American"],
  "white chocolate": ["French"],
  "vanilla": ["Global"],
  "vanilla extract": ["Global"],
  "vanilla bean": ["Global"],
  "baking powder": ["Global"],
  "baking soda": ["Global"],
  "yeast": ["Global"],
  "active dry yeast": ["Global"],
  "active yeast": ["Global"],
  "gelatin": ["Global"],

  // === OILS/FATS ===
  "lard": ["Mexican", "Chinese", "German"],
  "schmaltz": ["Polish", "Hungarian", "German"],
  "tallow": ["British"],

  // === MISC ===
  "italian dressing": ["Italian", "American"],
  "italian seasoning": ["Italian"],
  "bean": ["Global"],
  "dried bean": ["Global"],
  "kidney bean": ["Mexican", "Indian", "Caribbean"],
  "navy bean": ["American"],
  "butter bean": ["Southern US", "British"],
  "lima bean": ["American"],
  "adzuki bean": ["Japanese"],
  "azuki bean": ["Japanese"],
  "edamame": ["Japanese"],
  "edamame bean": ["Japanese"],
  "split pea": ["Indian", "Scandinavian"],
  "french lentil": ["French"],

  // === CONDIMENTS ===
  "mustard": ["French", "German", "American"],
  "yellow mustard": ["American"],
  "hot sauce": ["American", "Caribbean"],
  "siracha": ["Thai"],
  "aioli": ["French", "Spanish"],
  "sofrito": ["Spanish", "Caribbean"],
  "italian tomatoe": ["Italian"],
  "stir-fry sauce": ["Chinese"],

  // === WINES & SPIRITS ===
  "port": ["Portuguese"],
  "port wine": ["Portuguese"],
  "madeira": ["Portuguese"],
  "sherry wine": ["Spanish"],
  "whiskey": ["American", "British"],
  "gin": ["British"],
  "absinthe": ["French"],
  "stout": ["British"],
  "beer": ["German", "British", "American"],
  "vermouth": ["Italian", "French"],
  "maraschino liqueur": ["Italian"],
  "benedictine": ["French"],
  "triple sec": ["French"],
  "orange bitters": ["American"],

  // === TEAS & BEVERAGES ===
  "black tea": ["Indian", "British"],
  "rooibos": ["South African"],
  "hibiscus": ["Mexican", "Ethiopian", "Caribbean"],
  "coffee": ["Italian", "Ethiopian", "Brazilian", "American"],
  "espresso": ["Italian"],
  "espresso powder": ["Italian"],

  // === MISC ITEMS FROM DATASET ===
  "cream of mushroom soup": ["American"],
  "cream of celery soup": ["American"],
  "cream of chicken soup": ["American"],
  "onion soup": ["French", "American"],
  "tomato soup": ["American"],
  "vegetable soup mix": ["American"],
  "onion soup mix": ["American", "French"],
  "chicken gravy": ["American"],
  "beef consomme": ["French"],
  "wesson oil": ["American"],
  "crisco oil": ["American"],
  "ginger ale": ["American"],
  "cake mix": ["American"],
  "yellow cake mix": ["American"],
  "white cake": ["American"],
  "angel food cake": ["American"],
  "angel food cake mix": ["American"],
  "pie filling": ["American"],
  "apple pie filling": ["American"],
  "cherry pie mix": ["American"],
  "pie crust": ["American", "French"],
  "pie shell": ["American"],
  "frozen pie crust": ["American"],
  "frozen pie shell": ["American"],
  "gelatin dessert": ["American"],
  "jello": ["American"],
  "strawberry jello": ["American"],
  "lime gelatin": ["American"],
  "apricot jello": ["American"],
  "orange gelatin": ["American"],
  "cool whip": ["American"],
  "whipped topping": ["American"],
  "corn flake": ["American"],
  "ritz cracker": ["American"],
  "saltine cracker": ["American"],
  "vanilla wafer": ["American"],
  "cream of tartar": ["Global"],
  "food coloring": ["Global"],
};

// Keywords that suggest cuisine associations
const KEYWORD_RULES = [
  // Asian
  { pattern: /\basian\b/i, cuisines: ["Chinese", "Japanese", "Korean", "Thai"] },
  { pattern: /\bchinese\b/i, cuisines: ["Chinese"] },
  { pattern: /\bjapanese\b/i, cuisines: ["Japanese"] },
  { pattern: /\bkorean\b/i, cuisines: ["Korean"] },
  { pattern: /\bthai\b/i, cuisines: ["Thai"] },
  { pattern: /\bvietnamese\b/i, cuisines: ["Vietnamese"] },
  { pattern: /\bindonesian\b/i, cuisines: ["Indonesian"] },
  { pattern: /\bmalay\b/i, cuisines: ["Malaysian"] },
  { pattern: /\bfilipino\b/i, cuisines: ["Filipino"] },

  // European
  { pattern: /\bitalian\b/i, cuisines: ["Italian"] },
  { pattern: /\bfrench\b/i, cuisines: ["French"] },
  { pattern: /\bspanish\b/i, cuisines: ["Spanish"] },
  { pattern: /\bgreek\b/i, cuisines: ["Greek"] },
  { pattern: /\bgerman\b/i, cuisines: ["German"] },
  { pattern: /\benglish\b/i, cuisines: ["British"] },
  { pattern: /\bbritish\b/i, cuisines: ["British"] },
  { pattern: /\bscandinavian\b/i, cuisines: ["Scandinavian"] },
  { pattern: /\brussian\b/i, cuisines: ["Russian"] },
  { pattern: /\bpolish\b/i, cuisines: ["Polish"] },
  { pattern: /\bhungarian\b/i, cuisines: ["Hungarian"] },
  { pattern: /\bswiss\b/i, cuisines: ["French", "German"] },
  { pattern: /\bportuguese\b/i, cuisines: ["Portuguese"] },

  // South Asian
  { pattern: /\bindian\b/i, cuisines: ["Indian"] },
  { pattern: /\bmasala\b/i, cuisines: ["Indian"] },
  { pattern: /\bdal\b/i, cuisines: ["Indian"] },
  { pattern: /\bcurry\b/i, cuisines: ["Indian", "Thai"] },

  // Americas
  { pattern: /\bmexican\b/i, cuisines: ["Mexican"] },
  { pattern: /\btex[- ]?mex\b/i, cuisines: ["Tex-Mex"] },
  { pattern: /\bcajun\b/i, cuisines: ["Cajun/Creole"] },
  { pattern: /\bcreole\b/i, cuisines: ["Cajun/Creole"] },
  { pattern: /\bsouthern\b/i, cuisines: ["Southern US"] },
  { pattern: /\bbrazilian\b/i, cuisines: ["Brazilian"] },
  { pattern: /\bperuvian\b/i, cuisines: ["Peruvian"] },

  // Middle East / African
  { pattern: /\bturkish\b/i, cuisines: ["Turkish"] },
  { pattern: /\blebanese\b/i, cuisines: ["Lebanese"] },
  { pattern: /\bpersian\b/i, cuisines: ["Persian"] },
  { pattern: /\bisraeli\b/i, cuisines: ["Israeli"] },
  { pattern: /\bmoroccan\b/i, cuisines: ["Moroccan"] },
  { pattern: /\bethiopian\b/i, cuisines: ["Ethiopian"] },

  // Cuisine-implying ingredient words
  { pattern: /\btortilla\b/i, cuisines: ["Mexican"] },
  { pattern: /\bpasta\b/i, cuisines: ["Italian"] },
  { pattern: /\bspaghetti\b/i, cuisines: ["Italian"] },
  { pattern: /\blasagna\b/i, cuisines: ["Italian"] },
  { pattern: /\bmacaroni\b/i, cuisines: ["Italian", "American"] },
  { pattern: /\brigatoni\b/i, cuisines: ["Italian"] },
  { pattern: /\bpenne\b/i, cuisines: ["Italian"] },
  { pattern: /\bfettuccin/i, cuisines: ["Italian"] },
  { pattern: /\blinguine\b/i, cuisines: ["Italian"] },
  { pattern: /\bravioli\b/i, cuisines: ["Italian"] },
  { pattern: /\bgnocchi\b/i, cuisines: ["Italian"] },
  { pattern: /\btortellini\b/i, cuisines: ["Italian"] },
  { pattern: /\borzo\b/i, cuisines: ["Italian", "Greek"] },
  { pattern: /\bfusilli\b/i, cuisines: ["Italian"] },
  { pattern: /\brotini\b/i, cuisines: ["Italian"] },
  { pattern: /\bfarfalle\b/i, cuisines: ["Italian"] },
  { pattern: /\bcavatappi\b/i, cuisines: ["Italian"] },
  { pattern: /\bmanicotti\b/i, cuisines: ["Italian"] },
  { pattern: /\bziti\b/i, cuisines: ["Italian"] },
  { pattern: /\brisotto\b/i, cuisines: ["Italian"] },
  { pattern: /\bpolenta\b/i, cuisines: ["Italian"] },
  { pattern: /\bfocaccia\b/i, cuisines: ["Italian"] },
  { pattern: /\bciabatta\b/i, cuisines: ["Italian"] },
  { pattern: /\bbrioche\b/i, cuisines: ["French"] },
  { pattern: /\bcroissant\b/i, cuisines: ["French"] },
  { pattern: /\bbaguette\b/i, cuisines: ["French"] },
  { pattern: /\bnaan\b/i, cuisines: ["Indian"] },
  { pattern: /\broti\b/i, cuisines: ["Indian", "Malaysian"] },
  { pattern: /\bchapati\b/i, cuisines: ["Indian"] },
  { pattern: /\bparatha\b/i, cuisines: ["Indian"] },
  { pattern: /\btempura\b/i, cuisines: ["Japanese"] },
  { pattern: /\bteriyaki\b/i, cuisines: ["Japanese"] },
  { pattern: /\bsushi\b/i, cuisines: ["Japanese"] },
  { pattern: /\bsashimi\b/i, cuisines: ["Japanese"] },
  { pattern: /\bpanko\b/i, cuisines: ["Japanese"] },
  { pattern: /\bwonton\b/i, cuisines: ["Chinese"] },
  { pattern: /\btofu\b/i, cuisines: ["Chinese", "Japanese", "Korean"] },
  { pattern: /\bkimchi\b/i, cuisines: ["Korean"] },
  { pattern: /\bmiso\b/i, cuisines: ["Japanese"] },
  { pattern: /\bsake\b/i, cuisines: ["Japanese"] },
  { pattern: /\bmirin\b/i, cuisines: ["Japanese"] },
  { pattern: /\bnori\b/i, cuisines: ["Japanese"] },
  { pattern: /\bwasabi\b/i, cuisines: ["Japanese"] },
  { pattern: /\bchipotle\b/i, cuisines: ["Mexican"] },
  { pattern: /\bjalapeno\b/i, cuisines: ["Mexican"] },
  { pattern: /\bhabanero\b/i, cuisines: ["Mexican", "Caribbean"] },
  { pattern: /\bancho\b/i, cuisines: ["Mexican"] },
  { pattern: /\bpoblano\b/i, cuisines: ["Mexican"] },
  { pattern: /\bserrano\b/i, cuisines: ["Mexican"] },
  { pattern: /\bguajillo\b/i, cuisines: ["Mexican"] },
  { pattern: /\btaco\b/i, cuisines: ["Mexican"] },
  { pattern: /\benchilada\b/i, cuisines: ["Mexican"] },
  { pattern: /\bmole\b/i, cuisines: ["Mexican"] },
  { pattern: /\bsalsa\b/i, cuisines: ["Mexican"] },
  { pattern: /\bmasala\b/i, cuisines: ["Indian"] },
  { pattern: /\btandoori\b/i, cuisines: ["Indian"] },
  { pattern: /\bbiryani\b/i, cuisines: ["Indian"] },
  { pattern: /\bghee\b/i, cuisines: ["Indian"] },
  { pattern: /\bpaneer\b/i, cuisines: ["Indian"] },
  { pattern: /\bchutney\b/i, cuisines: ["Indian"] },
  { pattern: /\bharissa\b/i, cuisines: ["Moroccan"] },
  { pattern: /\bcouscous\b/i, cuisines: ["Moroccan"] },
  { pattern: /\btahini\b/i, cuisines: ["Lebanese"] },
  { pattern: /\bhummus\b/i, cuisines: ["Lebanese"] },
  { pattern: /\bbulgur\b/i, cuisines: ["Turkish", "Lebanese"] },
  { pattern: /\bpita\b/i, cuisines: ["Lebanese", "Greek"] },

  // More specific food words
  { pattern: /\bprosciutto\b/i, cuisines: ["Italian"] },
  { pattern: /\bpancetta\b/i, cuisines: ["Italian"] },
  { pattern: /\bproscuitto\b/i, cuisines: ["Italian"] },
  { pattern: /\bmortadella\b/i, cuisines: ["Italian"] },
  { pattern: /\bcapicola\b/i, cuisines: ["Italian"] },
  { pattern: /\bcoppa\b/i, cuisines: ["Italian"] },
  { pattern: /\bbolognese\b/i, cuisines: ["Italian"] },
  { pattern: /\bcarbonara\b/i, cuisines: ["Italian"] },
  { pattern: /\barrabbiata\b/i, cuisines: ["Italian"] },
  { pattern: /\balfredo\b/i, cuisines: ["Italian", "American"] },
  { pattern: /\bpizza\b/i, cuisines: ["Italian"] },
  { pattern: /\bcalzone\b/i, cuisines: ["Italian"] },
  { pattern: /\bpanini\b/i, cuisines: ["Italian"] },
  { pattern: /\bgelato\b/i, cuisines: ["Italian"] },
  { pattern: /\btiramisu\b/i, cuisines: ["Italian"] },
  { pattern: /\bcannoli\b/i, cuisines: ["Italian"] },
  { pattern: /\bproscuitt\b/i, cuisines: ["Italian"] },
  { pattern: /\bmarsala\b/i, cuisines: ["Italian"] },
  { pattern: /\bparmigian/i, cuisines: ["Italian"] },
  { pattern: /\bprovolone\b/i, cuisines: ["Italian"] },
  { pattern: /\bfontina\b/i, cuisines: ["Italian"] },
  { pattern: /\basiago\b/i, cuisines: ["Italian"] },
  { pattern: /\bricotta\b/i, cuisines: ["Italian"] },
  { pattern: /\bmascarpone\b/i, cuisines: ["Italian"] },
  { pattern: /\bgorgonzola\b/i, cuisines: ["Italian"] },

  // French
  { pattern: /\bdijon\b/i, cuisines: ["French"] },
  { pattern: /\bbechamel\b/i, cuisines: ["French"] },
  { pattern: /\bhollandaise\b/i, cuisines: ["French"] },
  { pattern: /\bbeurre\b/i, cuisines: ["French"] },
  { pattern: /\bbernaise\b/i, cuisines: ["French"] },
  { pattern: /\bbeurre blanc\b/i, cuisines: ["French"] },
  { pattern: /\bcognac\b/i, cuisines: ["French"] },
  { pattern: /\bchablis\b/i, cuisines: ["French"] },
  { pattern: /\bburgundy\b/i, cuisines: ["French"] },
  { pattern: /\bchampagne\b/i, cuisines: ["French"] },
  { pattern: /\bgruyere\b/i, cuisines: ["French"] },
  { pattern: /\bcomte\b/i, cuisines: ["French"] },
  { pattern: /\bbrie\b/i, cuisines: ["French"] },
  { pattern: /\bcamembert\b/i, cuisines: ["French"] },
  { pattern: /\broquefort\b/i, cuisines: ["French"] },

  // German/Eastern European
  { pattern: /\bkielbasa\b/i, cuisines: ["Polish"] },
  { pattern: /\bbratwurst\b/i, cuisines: ["German"] },
  { pattern: /\bsauerbraten\b/i, cuisines: ["German"] },
  { pattern: /\bspaetzle\b/i, cuisines: ["German"] },
  { pattern: /\bstrudel\b/i, cuisines: ["German"] },
  { pattern: /\bpretzel\b/i, cuisines: ["German"] },

  // More Asian
  { pattern: /\bssamjang\b/i, cuisines: ["Korean"] },
  { pattern: /\bgalbi\b/i, cuisines: ["Korean"] },
  { pattern: /\bbulgogi\b/i, cuisines: ["Korean"] },
  { pattern: /\bpho\b/i, cuisines: ["Vietnamese"] },
  { pattern: /\bbanh\b/i, cuisines: ["Vietnamese"] },
  { pattern: /\bnuoc\b/i, cuisines: ["Vietnamese"] },
  { pattern: /\blaksa\b/i, cuisines: ["Malaysian"] },
  { pattern: /\brendang\b/i, cuisines: ["Indonesian"] },
  { pattern: /\bsambal\b/i, cuisines: ["Indonesian", "Malaysian"] },
  { pattern: /\badobo\b/i, cuisines: ["Filipino", "Mexican"] },
  { pattern: /\blumpia\b/i, cuisines: ["Filipino"] },
  { pattern: /\bdim sum\b/i, cuisines: ["Chinese"] },
  { pattern: /\bszechuan\b/i, cuisines: ["Chinese"] },
  { pattern: /\bsichuan\b/i, cuisines: ["Chinese"] },
  { pattern: /\bcantonese\b/i, cuisines: ["Chinese"] },
  { pattern: /\bhoisin\b/i, cuisines: ["Chinese"] },
  { pattern: /\bshaoxing\b/i, cuisines: ["Chinese"] },

  // More Mexican/Latin
  { pattern: /\bchorizo\b/i, cuisines: ["Mexican", "Spanish"] },
  { pattern: /\bburrito\b/i, cuisines: ["Mexican"] },
  { pattern: /\bquesadilla\b/i, cuisines: ["Mexican"] },
  { pattern: /\btamale\b/i, cuisines: ["Mexican"] },
  { pattern: /\bceviche\b/i, cuisines: ["Peruvian", "Mexican"] },
  { pattern: /\bempanada\b/i, cuisines: ["Argentine", "Mexican"] },

  // Middle Eastern
  { pattern: /\bsumac\b/i, cuisines: ["Turkish", "Lebanese"] },
  { pattern: /\bza'atar\b/i, cuisines: ["Lebanese", "Israeli"] },
  { pattern: /\bzaatar\b/i, cuisines: ["Lebanese", "Israeli"] },
  { pattern: /\bfalafel\b/i, cuisines: ["Lebanese", "Israeli"] },
  { pattern: /\bshawarma\b/i, cuisines: ["Lebanese", "Turkish"] },
  { pattern: /\blabneh\b/i, cuisines: ["Lebanese"] },
  { pattern: /\bhalloumi\b/i, cuisines: ["Greek", "Turkish"] },

  // Common ingredient-containing words
  { pattern: /\bchocolate\b/i, cuisines: ["French", "American"] },
  { pattern: /\bcacao\b/i, cuisines: ["Mexican"] },
  { pattern: /\bespresso\b/i, cuisines: ["Italian"] },
  { pattern: /\bmatcha\b/i, cuisines: ["Japanese"] },
  { pattern: /\bmanchester\b/i, cuisines: ["British"] },
  { pattern: /\bcheddar\b/i, cuisines: ["American", "British"] },
  { pattern: /\bstilton\b/i, cuisines: ["British"] },
  { pattern: /\bmanchego\b/i, cuisines: ["Spanish"] },
  { pattern: /\bfeta\b/i, cuisines: ["Greek"] },
  { pattern: /\bpecorino\b/i, cuisines: ["Italian"] },
  { pattern: /\bgouda\b/i, cuisines: ["German"] },
  { pattern: /\bedam\b/i, cuisines: ["German"] },
  { pattern: /\bharvarti\b/i, cuisines: ["Scandinavian"] },
  { pattern: /\bjarlsberg\b/i, cuisines: ["Scandinavian"] },
];

// Additional curated entries for common dataset ingredient patterns
const ADDITIONAL_CURATED = {
  // Common cooking fats
  "shortening": ["American"],
  "crisco": ["American"],
  "all-vegetable shortening": ["American"],

  // Cooking preparations
  "bisquick": ["American"],
  "baking mix": ["American"],
  "corn meal": ["American", "Italian"],
  "cornmeal": ["American", "Italian"],
  "masa": ["Mexican"],

  // Cheese
  "swiss": ["French", "German"],
  "jack cheese": ["American"],
  "colby": ["American"],
  "muenster": ["German"],
  "muenster cheese": ["German"],
  "havarti": ["Scandinavian"],
  "havarti cheese": ["Scandinavian"],
  "jarlsberg": ["Scandinavian"],

  // Processed meats
  "corned beef": ["British", "American"],
  "kielbasa": ["Polish"],
  "bratwurst": ["German"],

  // Common remaining items
  "garlic": ["Global"],
  "garlic salt": ["American"],
  "garlic powder": ["American"],
  "garlic clove": ["Global"],
  "garlic bread": ["Italian", "American"],
  "garlic crouton": ["Italian", "French"],
  "garlic puree": ["Global"],
  "garlic juice": ["Global"],
  "garlic granule": ["American"],
  "roasted garlic": ["Italian"],
  "minced garlic": ["Global"],
  "fresh garlic": ["Global"],
  "onion powder": ["American"],
  "onion salt": ["American"],
  "onion flake": ["American"],
  "dried onion": ["American"],
  "fried onion": ["American"],
  "french fried onion": ["American", "French"],
  "caramelized onion": ["French"],
  "cocktail onion": ["British"],
  "brown onion": ["Global"],
  "red onion": ["Global"],
  "white onion": ["Mexican"],
  "yellow onion": ["American"],
  "spanish onion": ["Spanish"],
  "bermuda onion": ["American"],
  "boiling onion": ["French"],
  "pearl onion": ["French"],
  "baby onion": ["French"],
  "bean sprout": ["Chinese", "Thai", "Vietnamese", "Korean"],
  "bean thread": ["Chinese", "Thai"],
  "bean curd": ["Chinese", "Japanese", "Korean"],
  "bean paste": ["Chinese", "Korean"],
  "bean sauce": ["Chinese"],
  "bean dip": ["Tex-Mex"],
  "beefsteak tomatoe": ["American"],
  "anaheim chile": ["Mexican"],
  "anaheim chili": ["Mexican"],
  "anaheim chilie": ["Mexican"],
  "anaheim pepper": ["Mexican"],
  "chile": ["Mexican"],
  "chile flake": ["Mexican"],
  "chile paste": ["Mexican", "Thai"],
  "chile pepper": ["Mexican"],
  "chile powder": ["Mexican"],
  "chile sauce": ["Mexican", "Thai"],
  "chili pepper": ["Mexican"],
  "chili sauce": ["Mexican", "Thai"],
  "chili flake": ["Mexican", "Italian"],
  "chili bean": ["Mexican"],
  "green chili": ["Mexican"],
  "green chili pepper": ["Mexican"],
  "green chilie": ["Mexican"],
  "red chili": ["Thai", "Indian"],
  "red chili pepper": ["Thai", "Indian"],
  "cayenne pepper": ["Cajun/Creole", "Indian"],
  "cayenne pepper sauce": ["Cajun/Creole"],
  "cayanne pepper": ["Cajun/Creole"],
  "cayenne red pepper": ["Cajun/Creole"],
  "bird chile": ["Thai"],
  "bread": ["Global"],
  "bread crumb": ["Italian", "American"],
  "bread crumbs soft": ["American"],
  "bread cube": ["American"],
  "bread dough": ["Global"],
  "bread flour": ["Global"],
  "bread mix": ["Global"],
  "bread roll": ["Global"],
  "bread stuffing mix": ["American"],
  "brown bread": ["British"],
  "breadcrumb": ["Italian"],
  "coarse breadcrumb": ["Italian"],
  "vinegar": ["Global"],
  "white vinegar": ["Global"],
  "distilled vinegar": ["Global"],
  "white distilled vinegar": ["Global"],
  "white wine vinegar": ["French", "Italian"],
  "white-wine vinegar": ["French", "Italian"],
  "red wine vinegar": ["Italian", "French"],
  "red-wine vinegar": ["Italian", "French"],
  "red vinegar": ["Italian"],
  "wine vinegar": ["Italian", "French"],
  "brown vinegar": ["British"],
  "dark vinegar": ["Chinese"],
  "salad vinegar": ["American"],
  "balsalmic vinegar": ["Italian"],
  "salt": ["Global"],
  "kosher salt": ["Global"],
  "sea salt": ["Global"],
  "coarse salt": ["Global"],
  "coarse kosher salt": ["Global"],
  "coarse sea salt": ["Global"],
  "flaky sea salt": ["Global"],
  "table salt": ["Global"],
  "celtic sea salt": ["French"],
  "curing salt": ["Global"],
  "freshly salt": ["Global"],
  "course salt": ["Global"],
  "grill seasoning": ["American"],
  "steak seasoning": ["American"],
  "blackening seasoning": ["Cajun/Creole"],
  "seasoning salt": ["American"],
  "seasoned salt": ["American"],
  "caribbean jerk seasoning": ["Caribbean"],
  "old bay seasoning": ["American"],
  "water": ["Global"],
  "boiling water": ["Global"],
  "boiling salted water": ["Global"],
  "ice water": ["Global"],
  "broth": ["Global"],
  "chicken broth": ["Global"],
  "beef broth": ["American", "French"],
  "vegetable broth": ["Global"],
  "brown stock": ["French"],
  "applesauce": ["American"],
  "chunky applesauce": ["American"],
  "barbq sauce": ["American"],
  "barbeque sauce": ["American"],
  "bbq sauce": ["American"],
  "bearnaise sauce": ["French"],
  "brown sauce": ["British"],
  "browning sauce": ["British"],
  "buffalo sauce": ["American"],
  "buffalo wing sauce": ["American"],
  "butterscotch sauce": ["American", "British"],
  "cocktail sauce": ["American"],
  "caramel sauce": ["French"],
  "caesar dressing": ["Italian", "American"],
  "caesar salad dressing": ["Italian", "American"],
  "basting sauce": ["American"],
  "butter": ["Global"],
  "unsalted butter": ["Global"],
  "salted butter": ["Global"],
  "canola oil spray": ["Global"],
  "cooking wine": ["Global"],
  "cabernet sauvignon wine": ["French"],
  "chardonnay wine": ["French"],
  "chianti wine": ["Italian"],
  "dessert wine": ["French"],
  "cider": ["British", "American"],
  "corn flour": ["Mexican", "American"],
  "all-purpose flour": ["Global"],
  "arrowroot": ["Global"],
  "arrowroot flour": ["Global"],
  "arrowroot powder": ["Global"],
  "arrowroot starch": ["Global"],
  "beaten egg": ["Global"],
  "gelatin": ["Global"],
  "unflavored gelatin": ["Global"],
  "flavored gelatin": ["American"],
  "rose": ["Persian", "Indian", "Moroccan"],
  "seed": ["Global"],
  "sesame": ["Chinese", "Japanese", "Korean"],
  "sesame dressing": ["Japanese"],
  "black sesame": ["Japanese", "Chinese"],
  "aniseed": ["Italian", "Indian"],
  "cardamon seed": ["Indian"],
  "poppyseed": ["Polish", "German"],
  "flax seed": ["Indian", "American"],
  "flax seed meal": ["American"],
  "sunflower nut": ["Russian"],
  "kiwi": ["Australian"],
  "melon": ["Global"],
  "berry": ["Global"],
  "mixed berry": ["Global"],
  "peache": ["American"],
  "ripe peache": ["American"],
  "white peache": ["American"],
  "yellow peache": ["American"],
  "citrus juice": ["Global"],
  "vanilla vodka": ["Russian"],
  "baileys irish cream": ["British"],
  "bailey's irish cream": ["British"],
  "irish cream liqueur": ["British"],
  "cream liqueur": ["British"],
  "curacao": ["Caribbean"],
  "drambuie": ["British"],
  "melon liqueur": ["Japanese"],
  "lillet blanc": ["French"],
  "st-germain": ["French"],
  "liqueur": ["Global"],
  "vanilla frosting": ["American"],
  "vanilla icing": ["American"],
  "vanilla cake": ["American"],
  "vanilla cake mix": ["American"],
  "vanilla pie filling": ["American"],
  "vanilla wafer cookie": ["American"],
  "vanilla wafer crumb": ["American"],
  "nilla vanilla wafer": ["American"],
  "black bean paste": ["Chinese", "Korean"],
  "meat glaze": ["French"],
  "wormwood": ["French"],

  // More dairy
  "bleu cheese": ["French"],
  "bleu cheese salad dressing": ["French", "American"],
  "blue cheese crumble": ["French", "American"],
  "asadero cheese": ["Mexican"],
  "oaxaca cheese": ["Mexican"],
  "queso": ["Mexican"],
  "brick cheese": ["American"],
  "block cheese": ["American"],
  "blend cheese": ["American"],
  "barrel cheese": ["American"],
  "caramel ice cream": ["American"],
  "caramel ice cream topping": ["American"],
  "butterscotch pudding": ["American"],
  "butterscotch instant pudding": ["American"],
  "butterscotch ice cream topping": ["American"],
  "carnation milk": ["American"],
  "carnation cream": ["American"],
  "almond milk": ["Global"],

  // More chilis
  "chili": ["Mexican", "Tex-Mex"],
  "chili with bean": ["Tex-Mex"],
  "chili meat": ["Tex-Mex"],
  "chili mix": ["Tex-Mex"],
  "chili seasoning": ["Tex-Mex"],
  "chili seasoning mix": ["Tex-Mex"],
  "chili paste": ["Thai", "Chinese"],
  "chili paste with garlic": ["Thai", "Chinese"],
  "chili garlic": ["Thai", "Chinese"],
  "chili-garlic": ["Thai", "Chinese"],
  "chili-garlic sauce": ["Thai", "Chinese"],
  "chili bean paste": ["Chinese"],
  "chili bean sauce": ["Chinese"],
  "chilli paste": ["Thai", "Indian"],
  "chilli pepper": ["Thai", "Indian"],
  "red pepper sauce": ["American", "Cajun/Creole"],

  // More proteins
  "chicken bouillon": ["Global"],
  "chicken bouillon cube": ["Global"],
  "chicken bouillon granule": ["Global"],
  "chicken bouillon powder": ["Global"],
  "chicken base": ["Global"],
  "chicken breast cutlet": ["Global"],
  "chicken breast fillet": ["Global"],
  "chicken breast halve": ["Global"],
  "chicken breast meat": ["Global"],
  "chicken breast tender": ["Global"],
  "boneless skinless chicken breast": ["Global"],
  "broiler-fryer chicken": ["American"],
  "boiling chicken": ["Global"],
  "boned chicken": ["Global"],
  "broth from chicken": ["Global"],
  "brown chicken": ["Global"],
  "brown egg": ["Global"],
  "beaten egg": ["Global"],

  // More vegetables
  "baking potatoe": ["American"],
  "baking potato": ["American"],
  "boiling potatoe": ["Global"],
  "all-purpose potatoe": ["Global"],
  "baby potatoe": ["French"],
  "baby red potatoe": ["French"],
  "baby new potatoe": ["French"],
  "brown potatoe": ["Global"],
  "cooked sweet potatoe": ["American"],
  "broad bean": ["British", "Greek"],
  "borlotti bean": ["Italian"],
  "cannelini bean": ["Italian"],
  "chick-pea": ["Indian", "Lebanese"],
  "cornichon": ["French"],
  "caperberrie": ["Italian"],
  "bean soup mix": ["American"],
  "brown bean": ["Global"],
  "brown bean sauce": ["Chinese"],
  "bean": ["Global"],

  // More sweeteners
  "cane sugar": ["Global"],
  "cane syrup": ["Caribbean"],
  "castor sugar": ["British"],
  "clear honey": ["Global"],
  "coarse sugar": ["Global"],
  "caramel syrup": ["French"],
  "caramel sundae syrup": ["American"],
  "dark syrup": ["Global"],
  "falernum": ["Caribbean"],
  "orgeat": ["French"],

  // More grains
  "buttered bread crumb": ["American"],
  "corn bread crumb": ["American"],
  "corn bread stuffing": ["American"],
  "corn bread stuffing mix": ["American"],
  "bulgar wheat": ["Turkish", "Lebanese"],
  "cocktail rye bread": ["American"],
  "coarse cracker crumb": ["American"],
  "buttery cracker": ["American"],
  "buttery cracker crumb": ["American"],
  "buttery round cracker": ["American"],
  "buttered cracker crumb": ["American"],

  // More liquids
  "fruit juice": ["Global"],
  "fruit punch": ["American"],
  "clamato juice": ["Mexican", "American"],
  "cranapple juice": ["American"],
  "dry wine": ["Global"],
  "filtered water": ["Global"],
  "juice": ["Global"],

  // Vegetables and herbs
  "scallion": ["Chinese", "Korean", "Japanese", "American"],
  "chive": ["French"],
  "chives": ["French"],
  "mint": ["Lebanese", "Indian", "Vietnamese", "Moroccan"],
  "fresh mint": ["Lebanese", "Indian", "Vietnamese"],
  "spearmint": ["Lebanese", "Indian"],
  "mint leave": ["Lebanese", "Indian", "Vietnamese"],
  "lovage": ["French", "Italian"],
  "savory": ["French"],
  "lemon balm": ["French"],
  "lavender": ["French"],
  "chamomile": ["French", "German"],
  "borage": ["Italian", "French"],
  "hyssop": ["French"],
  "woodruff": ["German"],
  "lemon zest": ["Italian", "French"],
  "orange zest": ["Italian", "French"],
  "lime zest": ["Thai", "Mexican"],

  // Misc global/neutral items
  "baking powder": ["Global"],
  "baking soda": ["Global"],
  "powdered sugar": ["Global"],
  "brown sugar": ["Global"],
  "granulated sugar": ["Global"],
  "confectioners sugar": ["Global"],
  "light brown sugar": ["Global"],
  "dark brown sugar": ["Global"],
  "superfine sugar": ["Global"],
  "raw sugar": ["Global"],
  "caster sugar": ["British"],
  "demerara sugar": ["British"],
  "icing sugar": ["British"],

  "unsalted butter": ["Global"],
  "salted butter": ["Global"],
  "clarified butter": ["Indian", "French"],
  "brown butter": ["French"],
  "whole milk": ["Global"],
  "skim milk": ["Global"],
  "lowfat milk": ["Global"],
  "evaporated milk": ["Global"],
  "sweetened condensed milk": ["Global"],
  "heavy cream": ["Global"],
  "whipping cream": ["Global"],
  "heavy whipping cream": ["Global"],
  "light cream": ["Global"],
  "half and half": ["American"],
  "sour cream": ["Russian", "Mexican", "American"],
  "buttermilk": ["American", "Indian"],

  // Fruits
  "apple": ["American", "French", "British"],
  "pear": ["French", "Italian"],
  "cherry": ["French", "Turkish"],
  "plum": ["Chinese", "French"],
  "apricot": ["Turkish", "Persian", "Moroccan"],
  "peach": ["American", "Italian"],
  "nectarine": ["Italian", "American"],
  "banana": ["Caribbean", "Indian", "Thai"],
  "pineapple": ["Caribbean", "Thai", "Filipino"],
  "watermelon": ["Turkish", "American"],
  "grape": ["Italian", "French", "Spanish"],
  "strawberry": ["French", "American"],
  "raspberry": ["French"],
  "blackberry": ["American", "British"],
  "elderberry": ["British", "German"],
  "mulberry": ["Turkish", "Persian"],
  "boysenberry": ["American"],

  // More nuts
  "almond flour": ["French", "Italian", "Indian"],
  "almond meal": ["French", "Italian"],
  "almond butter": ["American"],
  "almond milk": ["Global"],
  "almond extract": ["Italian", "French", "American"],
  "almond paste": ["Italian", "Scandinavian"],
  "almond sliver": ["Indian", "French"],
  "coconut flake": ["Indian", "Thai"],
  "coconut flour": ["Indian", "Thai"],
  "pine nuts": ["Italian", "Lebanese"],
  "sunflower seed": ["Russian", "American"],
  "poppy seed": ["Polish", "German", "Indian"],
  "flaxseed": ["Indian", "American"],
  "chia seed": ["Mexican"],

  // Proteins
  "shrimp": ["Thai", "Chinese", "Italian", "Cajun/Creole"],
  "baby shrimp": ["Chinese"],
  "prawn": ["British", "Indian", "Thai"],
  "smoked salmon": ["Scandinavian"],
  "lox": ["Scandinavian", "American"],
  "corned beef": ["British", "American"],
  "roast beef": ["American", "British"],

  // Prepared items
  "tomato ketchup": ["American"],
  "prepared mustard": ["American"],
  "hot dog": ["American"],
  "hamburger": ["American"],
};

// Merge additional curated into CURATED
Object.assign(CURATED, ADDITIONAL_CURATED);

function regionsToCuisines(regions) {
  const cuisines = new Set();
  for (const region of regions) {
    const mapped = REGION_CUISINES[region];
    if (mapped) {
      for (const c of mapped) cuisines.add(c);
    }
  }
  return [...cuisines];
}

function applyKeywordRules(name) {
  const cuisines = new Set();
  for (const rule of KEYWORD_RULES) {
    if (rule.pattern.test(name)) {
      for (const c of rule.cuisines) cuisines.add(c);
    }
  }
  return [...cuisines];
}

// Normalize an ingredient name for matching against season_region keys
function normalizeForLookup(name) {
  return name.toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

// Try to find a season_region match for an ingredient
function findRegionMatch(name) {
  const norm = normalizeForLookup(name);

  // Direct match
  if (seasonRegion[norm]) return seasonRegion[norm].regions;

  // Try removing trailing 's', 'e', 'es'
  const singulars = [
    norm.replace(/e?s$/, ''),
    norm.replace(/ies$/, 'y'),
    norm.replace(/ves$/, 'f'),
  ];
  for (const s of singulars) {
    if (seasonRegion[s]) return seasonRegion[s].regions;
  }

  // Try matching the last word (e.g., "baby spinach" -> "spinach")
  const words = norm.split(' ');
  if (words.length > 1) {
    const lastWord = words[words.length - 1];
    if (seasonRegion[lastWord]) return seasonRegion[lastWord].regions;
    // Try singular of last word
    const lastSingular = lastWord.replace(/e?s$/, '');
    if (seasonRegion[lastSingular]) return seasonRegion[lastSingular].regions;
    // Try second-to-last + last
    if (words.length > 2) {
      const twoWords = words.slice(-2).join(' ');
      if (seasonRegion[twoWords]) return seasonRegion[twoWords].regions;
    }
    // Try first word
    const firstWord = words[0];
    if (seasonRegion[firstWord]) return seasonRegion[firstWord].regions;
    // Try first two words
    if (words.length > 2) {
      const firstTwo = words.slice(0, 2).join(' ');
      if (seasonRegion[firstTwo]) return seasonRegion[firstTwo].regions;
    }
    // Try every individual word
    for (const w of words) {
      if (w.length > 3 && seasonRegion[w]) return seasonRegion[w].regions;
      const ws = w.replace(/e?s$/, '');
      if (ws.length > 3 && seasonRegion[ws]) return seasonRegion[ws].regions;
    }
  }

  return null;
}

// Try to inherit cuisine from a curated entry by matching substrings
function inheritFromCurated(name) {
  const norm = name.toLowerCase();
  const words = norm.split(/[\s-]+/).filter(w => w.length > 2);

  // Skip generic modifier words
  const skipWords = new Set([
    'fresh', 'dried', 'ground', 'whole', 'chopped', 'diced', 'sliced',
    'minced', 'crushed', 'grated', 'shredded', 'frozen', 'canned',
    'raw', 'cooked', 'roasted', 'toasted', 'smoked', 'pickled',
    'blanched', 'steamed', 'fried', 'boiled', 'baked', 'grilled',
    'baby', 'mini', 'large', 'small', 'medium', 'extra', 'fine',
    'thick', 'thin', 'light', 'dark', 'sweet', 'hot', 'cold',
    'plain', 'pure', 'real', 'organic', 'natural', 'regular',
    'low', 'fat', 'nonfat', 'reduced', 'unsweetened', 'sweetened',
    'unsalted', 'salted', 'boneless', 'skinless', 'lean', 'bulk',
    'dry', 'wet', 'ripe', 'unripe', 'old', 'new', 'young',
    'prepared', 'additional', 'optional', 'leftover',
    'leave', 'leaf', 'seed', 'root', 'stem', 'stalk', 'sprig',
    'flake', 'powder', 'paste', 'sauce', 'juice', 'oil', 'extract',
    'syrup', 'cream', 'milk', 'water', 'stock', 'broth',
    'fillet', 'filet', 'cutlet', 'chop', 'loin', 'breast', 'thigh',
    'leg', 'wing', 'rib', 'shoulder', 'shank', 'roast', 'round',
    'strip', 'bit', 'piece', 'cube', 'ring', 'wedge', 'half', 'halve',
    'crumb', 'crust', 'shell', 'wrap', 'wrapper', 'dough',
    'bag', 'can', 'jar', 'box', 'bottle', 'packet', 'package',
    'mix', 'blend', 'filling', 'topping', 'garnish', 'seasoning',
    'style', 'type', 'flavor', 'flavoring', 'flavored',
    'white', 'red', 'green', 'yellow', 'black', 'brown', 'golden',
    'purpose', 'rising', 'grain', 'wheat',
  ]);

  // Try each content word against curated
  for (const word of words) {
    if (skipWords.has(word)) continue;
    if (CURATED[word]) return CURATED[word];
  }

  // Try pairs of content words
  const contentWords = words.filter(w => !skipWords.has(w));
  for (let i = 0; i < contentWords.length - 1; i++) {
    const pair = contentWords[i] + ' ' + contentWords[i + 1];
    if (CURATED[pair]) return CURATED[pair];
  }

  return null;
}

// Limit cuisines to the most appropriate ones (max 6)
function limitCuisines(cuisines) {
  if (cuisines.length <= 6) return cuisines;
  // If "Global" is present and there are too many, just use Global
  if (cuisines.includes("Global") && cuisines.length > 6) {
    return ["Global"];
  }
  return cuisines.slice(0, 6);
}

// Main generation
const cuisineMap = {};
const allNames = Object.keys(ingredients);
let matched = 0;

for (const name of allNames) {
  const lowerName = name.toLowerCase();

  // 1. Check curated overrides first
  if (CURATED[lowerName]) {
    cuisineMap[name] = limitCuisines(CURATED[lowerName]);
    matched++;
    continue;
  }
  if (CURATED[name]) {
    cuisineMap[name] = limitCuisines(CURATED[name]);
    matched++;
    continue;
  }

  // 2. Apply keyword rules
  const keywordCuisines = applyKeywordRules(name);
  if (keywordCuisines.length > 0) {
    cuisineMap[name] = limitCuisines(keywordCuisines);
    matched++;
    continue;
  }

  // 3. Try inheriting from curated entries by matching component words
  const inherited = inheritFromCurated(name);
  if (inherited) {
    cuisineMap[name] = limitCuisines(inherited);
    matched++;
    continue;
  }

  // 4. Try region matching from season_region.json
  const regions = findRegionMatch(name);
  if (regions) {
    const fromRegions = regionsToCuisines(regions);
    if (fromRegions.length > 0) {
      cuisineMap[name] = limitCuisines(fromRegions);
      matched++;
      continue;
    }
  }

  // 5. Category-based fallback with ingredient knowledge
  const cat = ingredients[name].category;

  // Simple category defaults for unmatched items
  const categoryDefaults = {
    "baked": ["American"],
    "confection": ["American", "French"],
    "mixer": ["American"],
    "bitters": ["American"],
    "thickener": ["Global"],
    "spirit": ["Global"],
    "liqueur": ["Global"],
  };

  if (categoryDefaults[cat]) {
    cuisineMap[name] = categoryDefaults[cat];
    matched++;
    continue;
  }

  // For anything still unmatched, assign Global
  cuisineMap[name] = ["Global"];
  matched++;
}

// Sort keys alphabetically for readability
const sorted = {};
const sortedKeys = Object.keys(cuisineMap).sort((a, b) => a.localeCompare(b));
for (const key of sortedKeys) {
  sorted[key] = cuisineMap[key];
}

// Write output
const outPath = path.join(__dirname, '..', 'public', 'data', 'cuisine_map.json');
fs.writeFileSync(outPath, JSON.stringify(sorted, null, 2), 'utf8');

console.log(`Generated cuisine_map.json with ${Object.keys(sorted).length} entries`);
console.log(`Matched: ${matched}`);

// Stats
const cuisineCounts = {};
for (const cuisines of Object.values(sorted)) {
  for (const c of cuisines) {
    cuisineCounts[c] = (cuisineCounts[c] || 0) + 1;
  }
}
const sortedCuisines = Object.entries(cuisineCounts).sort((a, b) => b[1] - a[1]);
console.log('\nCuisine distribution (top 30):');
for (const [cuisine, count] of sortedCuisines.slice(0, 30)) {
  console.log(`  ${cuisine}: ${count}`);
}

// Check how many got Global only
const globalOnly = Object.values(sorted).filter(c => c.length === 1 && c[0] === 'Global').length;
console.log(`\nGlobal-only: ${globalOnly}`);
