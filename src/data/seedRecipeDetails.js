/**
 * seedRecipeDetails.js — cookable details for the Cookbook seed recipes
 * (added 2026-11-05).
 *
 * Kept apart from seedRecipes.js so the browse/scene data stays small.
 * Keyed by recipe id. Each entry:
 *   serves  — number of portions
 *   time    — total hands-on + cooking time, human-readable
 *   amounts — { [ingredient name exactly as in SEED_RECIPES]: amount }
 *   steps   — method, in order
 *
 * Amounts are home-kitchen quantities for the stated servings, not
 * scaled lab measurements.
 */

export const RECIPE_DETAILS = {
  // ── Italian ────────────────────────────────────────────────────────
  'margherita-pizza': {
    serves: 2, time: '2 hr (incl. rising)',
    amounts: { flour: '300 g', tomato: '200 g canned, crushed', mozzarella: '125 g', basil: '8 leaves', 'olive oil': '2 tbsp', salt: '1 tsp', yeast: '1 tsp instant' },
    steps: [
      'Mix flour, yeast, salt, 1 tbsp oil and 190 ml warm water; knead 8 min until smooth.',
      'Cover and let rise until doubled, about 1½ hours.',
      'Heat the oven (with a tray or stone inside) as hot as it goes, 250 °C+.',
      'Stretch the dough thin, spread the crushed tomato, season with salt.',
      'Tear over the mozzarella and bake 7–10 min until blistered.',
      'Finish with basil and the remaining olive oil.',
    ],
  },
  'beef-bolognese': {
    serves: 4, time: '2½ hr',
    amounts: { beef: '500 g minced', tomato: '400 g canned', onion: '1', carrot: '1', celery: '1 stalk', garlic: '2 cloves', 'red wine': '150 ml', pasta: '400 g tagliatelle' },
    steps: [
      'Finely chop onion, carrot, celery and garlic; soften in oil over low heat 10 min.',
      'Raise the heat, add the beef and brown it well, breaking it up.',
      'Pour in the wine and let it bubble away.',
      'Add the tomatoes, season, and simmer very gently, partly covered, 2 hours.',
      'Cook the pasta, toss with the sauce, and serve with parmesan if you like.',
    ],
  },
  'risotto-saffron': {
    serves: 4, time: '35 min',
    amounts: { rice: '320 g arborio', saffron: '1 pinch', onion: '1 small', parmesan: '60 g grated', butter: '50 g', 'white wine': '100 ml', 'vegetable broth': '1.2 L, hot' },
    steps: [
      'Steep the saffron in a ladle of hot broth.',
      'Soften the chopped onion in half the butter, then toast the rice 2 min.',
      'Add the wine and stir until absorbed.',
      'Add broth a ladle at a time, stirring, for about 18 min; add the saffron halfway.',
      'Off the heat, beat in the rest of the butter and the parmesan. Rest 2 min and serve loose.',
    ],
  },
  'spaghetti-carbonara': {
    serves: 2, time: '20 min',
    amounts: { pasta: '200 g spaghetti', 'egg yolk': '3 (+1 whole egg)', pecorino: '50 g grated', bacon: '100 g, or guanciale', 'black pepper': '1 tsp coarse', salt: 'for the pasta water' },
    steps: [
      'Cook the spaghetti in well-salted water.',
      'Crisp the cured pork in a dry pan; turn off the heat.',
      'Whisk the yolks, egg, pecorino and lots of black pepper.',
      'Toss the drained pasta into the pork pan, then add the egg mix with a splash of pasta water.',
      'Stir off the heat until glossy — the eggs should thicken, not scramble.',
    ],
  },
  'linguine-vongole': {
    serves: 2, time: '25 min',
    amounts: { 'linguine pasta': '200 g', clam: '1 kg, scrubbed', 'white wine': '100 ml', garlic: '3 cloves', 'olive oil': '4 tbsp', parsley: '1 handful, chopped', 'red pepper': '1 pinch, flakes' },
    steps: [
      'Start the linguine in salted water.',
      'Warm the oil with sliced garlic and chili until fragrant.',
      'Add the clams and wine, cover, and steam 3–4 min until they open; discard any that stay shut.',
      'Drain the pasta a minute early and finish it in the clam pan with some cooking water.',
      'Toss with parsley and serve.',
    ],
  },
  'pesto-genovese': {
    serves: 4, time: '20 min',
    amounts: { pasta: '400 g trofie or linguine', basil: '60 g leaves', 'pine nut': '30 g', parmesan: '50 g grated', garlic: '1 clove', 'olive oil': '120 ml', salt: '1 pinch' },
    steps: [
      'Pound or blitz the garlic, pine nuts and salt to a paste.',
      'Add the basil and work it in briefly so it stays green.',
      'Stir in the parmesan, then loosen with the olive oil.',
      'Cook the pasta, then toss with the pesto and a splash of cooking water — no further heat.',
    ],
  },
  'caprese-salad': {
    serves: 2, time: '10 min',
    amounts: { tomato: '3 ripe', mozzarella: '250 g', basil: '1 handful', 'olive oil': '3 tbsp', 'balsamic vinegar': '1 tsp', salt: 'to taste', 'black pepper': 'to taste' },
    steps: [
      'Slice the tomatoes and mozzarella about 1 cm thick.',
      'Alternate them on a plate with basil leaves.',
      'Season with salt and pepper, then drizzle with oil and a little balsamic.',
    ],
  },
  tiramisu: {
    serves: 6, time: '30 min + 6 hr chilling',
    amounts: { 'ladyfinger cookie': '200 g', mascarpone: '250 g', espresso: '300 ml, cooled', egg: '3, separated', sugar: '75 g', cocoa: '2 tbsp' },
    steps: [
      'Beat the yolks with the sugar until pale, then beat in the mascarpone.',
      'Whisk the whites to soft peaks and fold them through.',
      'Dip ladyfingers briefly in espresso and lay half in a dish.',
      'Cover with half the cream; repeat the layers.',
      'Chill at least 6 hours, then dust with cocoa.',
    ],
  },

  // ── French ─────────────────────────────────────────────────────────
  'beef-bourguignon': {
    serves: 6, time: '3½ hr',
    amounts: { beef: '1.2 kg chuck, cubed', 'red wine': '750 ml', onion: '1 + 12 pearl', carrot: '2', mushroom: '250 g', thyme: '4 sprigs', bacon: '150 g lardons', butter: '30 g' },
    steps: [
      'Brown the lardons, then sear the beef in batches in the fat.',
      'Soften the sliced onion and carrot; return the meat.',
      'Add the wine and thyme, bring to a simmer, cover and braise at 160 °C for 2½–3 hours.',
      'Brown the mushrooms and pearl onions in butter and stir them in for the last 30 min.',
      'Reduce the sauce if thin and season.',
    ],
  },
  croissant: {
    serves: 12, time: '1 day (mostly resting)',
    amounts: { flour: '500 g', butter: '280 g cold, for laminating', yeast: '10 g instant', milk: '280 ml', sugar: '55 g', salt: '10 g', egg: '1, for glazing' },
    steps: [
      'Make a dough of flour, yeast, sugar, salt and milk; chill overnight.',
      'Pound the butter into a flat square and lock it into the rolled-out dough.',
      'Roll and fold in thirds three times, chilling 30 min between folds.',
      'Roll out, cut into triangles and roll them up from the wide end.',
      'Proof until wobbly (2–3 hr), glaze with egg, and bake at 200 °C for 15–18 min.',
    ],
  },
  ratatouille: {
    serves: 4, time: '1 hr',
    amounts: { eggplant: '1', zucchini: '2', tomato: '4', 'sweet pepper': '2', onion: '1', garlic: '3 cloves', thyme: '3 sprigs', 'olive oil': '5 tbsp' },
    steps: [
      'Cut all the vegetables into similar chunks.',
      'Brown the eggplant, zucchini and pepper separately in olive oil.',
      'Soften the onion and garlic, add the tomatoes and thyme and cook down 10 min.',
      'Return everything to the pan and simmer gently 25 min. Better the next day.',
    ],
  },
  'coq-au-vin': {
    serves: 4, time: '2 hr',
    amounts: { chicken: '1.5 kg, jointed', 'red wine': '500 ml', mushroom: '200 g', bacon: '120 g lardons', 'pearl onion': '12', garlic: '2 cloves', thyme: '3 sprigs', butter: '30 g' },
    steps: [
      'Brown the lardons, then the chicken pieces in the fat.',
      'Add garlic and thyme, pour over the wine, and simmer covered 1 hour.',
      'Brown the mushrooms and pearl onions in butter and add them.',
      'Cook 20 min more; reduce the sauce until it coats a spoon.',
    ],
  },
  'french-onion-soup': {
    serves: 4, time: '1½ hr',
    amounts: { onion: '1 kg', butter: '50 g', 'beef stock': '1.2 L', 'white wine': '150 ml', thyme: '2 sprigs', gruyere: '150 g grated', 'bread baguette': '8 slices' },
    steps: [
      'Slice the onions thinly and cook slowly in butter for 45–60 min until deep brown.',
      'Deglaze with the wine, then add stock and thyme; simmer 20 min.',
      'Ladle into ovenproof bowls, top with toasted bread and gruyère.',
      'Grill until bubbling and browned.',
    ],
  },
  'moules-marinieres': {
    serves: 2, time: '20 min',
    amounts: { mussel: '1 kg, cleaned', 'white wine': '150 ml', shallot: '2', garlic: '2 cloves', parsley: '1 handful', butter: '30 g', cream: '50 ml' },
    steps: [
      'Soften the chopped shallot and garlic in butter.',
      'Add the mussels and wine, cover, and steam 4 min, shaking the pan.',
      'Discard any that stay closed; stir in the cream and parsley.',
      'Serve with bread for the juices.',
    ],
  },
  'quiche-lorraine': {
    serves: 6, time: '1¼ hr',
    amounts: { 'pie crust': '1 × 23 cm shell', egg: '3', cream: '300 ml', bacon: '150 g lardons', gruyere: '80 g grated', nutmeg: '1 pinch', 'black pepper': 'to taste' },
    steps: [
      'Blind-bake the pastry shell at 190 °C for 15 min.',
      'Fry the lardons until golden and scatter them in the shell with the cheese.',
      'Whisk the eggs, cream, nutmeg and pepper; pour in.',
      'Bake at 170 °C for 30–35 min until just set with a slight wobble.',
    ],
  },
  'creme-brulee': {
    serves: 4, time: '1 hr + chilling',
    amounts: { cream: '500 ml', 'egg yolk': '5', sugar: '80 g + extra for the tops', vanilla: '1 pod or 1 tsp extract' },
    steps: [
      'Heat the cream with the vanilla to just below a simmer.',
      'Whisk the yolks and sugar, then whisk in the hot cream.',
      'Pour into ramekins and bake in a water bath at 150 °C for 30–35 min, until barely set.',
      'Chill, then sprinkle with sugar and torch until it cracks to the tap.',
    ],
  },

  // ── East Asian ─────────────────────────────────────────────────────
  'sushi-roll': {
    serves: 2, time: '45 min',
    amounts: { rice: '300 g sushi rice', salmon: '150 g sashimi-grade', avocado: '1', nori: '3 sheets', 'rice vinegar': '3 tbsp', 'soy sauce': 'to serve' },
    steps: [
      'Rinse and cook the rice; fold in the rice vinegar (seasoned with a little sugar and salt) and cool.',
      'Slice the salmon and avocado into strips.',
      'Spread rice thinly over a nori sheet on a bamboo mat, leaving a strip bare at the top.',
      'Lay the fillings along the bottom and roll firmly.',
      'Slice with a wet knife; serve with soy sauce.',
    ],
  },
  'miso-soup': {
    serves: 4, time: '15 min',
    amounts: { miso: '3 tbsp', tofu: '200 g silken, cubed', scallion: '2, sliced', dashi: '800 ml', wakame: '1 tbsp dried' },
    steps: [
      'Soak the wakame 5 min; drain.',
      'Heat the dashi to a bare simmer and add the tofu and wakame.',
      'Turn off the heat and whisk in the miso through a sieve — do not boil it.',
      'Serve topped with scallion.',
    ],
  },
  'mapo-tofu': {
    serves: 3, time: '25 min',
    amounts: { tofu: '400 g silken', pork: '150 g minced', doubanjiang: '2 tbsp', 'sichuan peppercorn': '1 tsp, toasted and ground', garlic: '3 cloves', ginger: '1 tbsp minced', scallion: '2', 'chili oil': '2 tbsp' },
    steps: [
      'Cube the tofu and soak it in hot salted water while you cook.',
      'Fry the pork until crisp, then add doubanjiang, garlic and ginger until the oil turns red.',
      'Add 200 ml water and the drained tofu; simmer 5 min, nudging gently.',
      'Thicken with a little cornstarch slurry, finish with chili oil, Sichuan pepper and scallion.',
    ],
  },
  bibimbap: {
    serves: 2, time: '40 min',
    amounts: { rice: '2 bowls, cooked', spinach: '150 g', carrot: '1, julienned', 'bean sprout': '100 g', mushroom: '100 g shiitake', egg: '2', gochujang: '2 tbsp', 'sesame oil': '2 tbsp' },
    steps: [
      'Blanch the spinach and bean sprouts; season each with sesame oil and salt.',
      'Stir-fry the carrot and mushrooms separately.',
      'Fry the eggs sunny side up.',
      'Arrange everything over hot rice, top with the egg and gochujang, and mix at the table.',
    ],
  },
  'teriyaki-salmon': {
    serves: 2, time: '20 min',
    amounts: { salmon: '2 fillets', 'soy sauce': '3 tbsp', mirin: '3 tbsp', sake: '2 tbsp', 'brown sugar': '1 tbsp', ginger: '1 tsp grated', 'sesame seed': '1 tsp' },
    steps: [
      'Mix soy, mirin, sake, sugar and ginger.',
      'Sear the salmon skin side down until crisp, then flip.',
      'Pour in the sauce and let it bubble down to a glaze, basting the fish.',
      'Serve sprinkled with sesame seeds.',
    ],
  },
  'pork-gyoza': {
    serves: 4, time: '1 hr',
    amounts: { pork: '300 g minced', 'chinese cabbage': '200 g, finely chopped', ginger: '1 tbsp grated', garlic: '2 cloves', scallion: '2', 'soy sauce': '2 tbsp', 'sesame oil': '1 tsp' },
    steps: [
      'Salt the cabbage 10 min, squeeze dry, and mix with the other filling ingredients.',
      'Spoon onto round wrappers, wet the edge, and pleat closed.',
      'Fry flat side down in oil until golden.',
      'Add 80 ml water, cover, and steam until the water is gone; serve with soy and vinegar.',
    ],
  },
  'garlic-bok-choy': {
    serves: 2, time: '10 min',
    amounts: { 'pak choy': '400 g, halved', garlic: '4 cloves, sliced', 'oyster sauce': '1½ tbsp', 'soy sauce': '1 tsp', 'sesame oil': '1 tsp', ginger: '1 tsp minced' },
    steps: [
      'Heat a wok until smoking with a little oil.',
      'Add garlic and ginger for a few seconds, then the bok choy.',
      'Toss 2 min, add a splash of water, cover 1 min.',
      'Finish with oyster sauce, soy and sesame oil.',
    ],
  },

  // ── SE Asian ───────────────────────────────────────────────────────
  'pad-thai': {
    serves: 2, time: '30 min',
    amounts: { 'rice noodle': '200 g flat', shrimp: '200 g', tamarind: '3 tbsp paste', peanut: '40 g, crushed', lime: '1', 'fish sauce': '2 tbsp', egg: '2', 'bean sprout': '100 g' },
    steps: [
      'Soak the noodles in warm water 20 min; drain.',
      'Mix tamarind, fish sauce and 1 tbsp sugar.',
      'Stir-fry the shrimp, push aside, scramble the eggs.',
      'Add noodles and sauce and toss until absorbed; fold in the sprouts.',
      'Serve with peanuts and lime.',
    ],
  },
  pho: {
    serves: 4, time: '4 hr',
    amounts: { beef: '1.5 kg bones + 300 g sirloin', 'rice noodle': '400 g', 'star anise': '3', cinnamon: '1 stick', ginger: '1 thumb, charred', onion: '1, charred', cilantro: '1 bunch', lime: '2' },
    steps: [
      'Blanch the bones, rinse, then simmer in 4 L water with the charred onion, ginger and toasted spices for 3+ hours.',
      'Season the strained broth with fish sauce and a little sugar.',
      'Slice the sirloin paper-thin.',
      'Put noodles and raw beef in bowls and ladle over the boiling broth.',
      'Serve with cilantro and lime.',
    ],
  },
  'thai-green-curry': {
    serves: 4, time: '30 min',
    amounts: { chicken: '500 g thigh, sliced', 'coconut milk': '400 ml', 'curry paste': '3 tbsp green', eggplant: '2 Thai or 1 small', 'thai basil': '1 handful', 'fish sauce': '1½ tbsp', lime: '1', 'palm sugar': '1 tbsp' },
    steps: [
      'Fry the curry paste in the thick top of the coconut milk until fragrant.',
      'Add the chicken and coat it, then the rest of the coconut milk.',
      'Add the eggplant and simmer 10–12 min.',
      'Season with fish sauce, palm sugar and lime; stir in the basil.',
    ],
  },
  'tom-yum': {
    serves: 4, time: '25 min',
    amounts: { shrimp: '300 g', lemongrass: '2 stalks, bruised', galangal: '5 slices', lime: '2', 'fish sauce': '3 tbsp', mushroom: '150 g', cilantro: '1 handful', 'green chili pepper': '3, smashed' },
    steps: [
      'Simmer lemongrass, galangal and chili in 1 L stock or water for 10 min.',
      'Add the mushrooms, then the shrimp until just pink.',
      'Off the heat, season with fish sauce and lime juice — it should be sharp and hot.',
      'Top with cilantro.',
    ],
  },
  'chicken-satay': {
    serves: 4, time: '40 min + marinating',
    amounts: { chicken: '600 g thigh, in strips', turmeric: '1 tsp', coriander: '1 tsp ground', lemongrass: '1 stalk, minced', 'coconut milk': '200 ml', 'peanut butter': '4 tbsp', 'soy sauce': '2 tbsp', 'brown sugar': '1 tbsp' },
    steps: [
      'Marinate the chicken with turmeric, coriander, lemongrass, half the soy and a splash of coconut milk for 1 hour.',
      'Thread onto soaked skewers and grill until charred.',
      'Simmer the peanut butter with the rest of the coconut milk, soy and sugar for the sauce.',
      'Serve the skewers with the sauce.',
    ],
  },
  'som-tam': {
    serves: 2, time: '15 min',
    amounts: { papaya: '300 g green, shredded', tomato: '6 cherry, halved', 'green bean': '4, in short lengths', peanut: '2 tbsp roasted', lime: '1½', 'fish sauce': '2 tbsp', 'palm sugar': '1 tbsp', garlic: '1 clove' },
    steps: [
      'Pound the garlic (and chilis, to taste) in a mortar.',
      'Add palm sugar, fish sauce and lime juice and pound to dissolve.',
      'Add beans and tomatoes, bruise lightly, then the papaya.',
      'Toss with the pestle and spoon; top with peanuts.',
    ],
  },

  // ── South Asian ────────────────────────────────────────────────────
  'chicken-tikka': {
    serves: 4, time: '1 hr + marinating',
    amounts: { chicken: '700 g thigh', tomato: '400 g canned', yogurt: '150 g', 'garam masala': '2 tsp', ginger: '1 tbsp grated', garlic: '4 cloves', cream: '150 ml', cilantro: '1 handful' },
    steps: [
      'Marinate the chicken in yogurt, half the ginger and garlic and 1 tsp garam masala for 2+ hours.',
      'Grill or broil the chicken until charred at the edges.',
      'Fry the rest of the ginger and garlic, add the tomatoes and simmer 15 min; blend smooth.',
      'Stir in the cream, the rest of the garam masala and the chicken; simmer 10 min.',
      'Finish with cilantro.',
    ],
  },
  biryani: {
    serves: 6, time: '2 hr',
    amounts: { lamb: '800 g, cubed', rice: '400 g basmati', onion: '3, sliced', yogurt: '200 g', saffron: '1 pinch, in warm milk', cardamom: '6 pods', cinnamon: '1 stick', mint: '1 handful' },
    steps: [
      'Fry the onions slowly until deep brown and crisp; keep half for the top.',
      'Marinate the lamb in yogurt, spices and half the onions, then cook covered until tender, about 1 hour.',
      'Par-boil the rice with whole spices for 5 min.',
      'Layer the rice over the lamb, drizzle with the saffron milk, scatter mint and fried onions.',
      'Seal the pot and cook on very low heat 25 min.',
    ],
  },
  'chana-masala': {
    serves: 4, time: '40 min',
    amounts: { chickpea: '2 × 400 g cans', onion: '1', tomato: '3', ginger: '1 tbsp', garlic: '3 cloves', 'garam masala': '1½ tsp', cumin: '1 tsp seeds', cilantro: '1 handful' },
    steps: [
      'Sizzle the cumin seeds in oil, then fry the onion until golden.',
      'Add ginger and garlic, then the chopped tomatoes; cook to a thick paste.',
      'Add the chickpeas and 200 ml water; simmer 20 min, mashing a few.',
      'Stir in garam masala, a squeeze of lemon and cilantro.',
    ],
  },
  'palak-paneer': {
    serves: 4, time: '35 min',
    amounts: { paneer: '250 g, cubed', spinach: '500 g', onion: '1', garlic: '3 cloves', ginger: '1 tbsp', cumin: '1 tsp', 'garam masala': '1 tsp', cream: '3 tbsp' },
    steps: [
      'Blanch the spinach 1 min, cool in cold water, and blend smooth.',
      'Brown the paneer lightly and set aside.',
      'Fry cumin, onion, ginger and garlic, add the spinach purée and simmer 5 min.',
      'Stir in garam masala, cream and the paneer.',
    ],
  },
  'dal-tadka': {
    serves: 4, time: '45 min',
    amounts: { lentil: '250 g yellow (toor or moong)', ghee: '2 tbsp', cumin: '1 tsp seeds', turmeric: '½ tsp', garlic: '4 cloves, sliced', tomato: '1', onion: '1', 'green chili pepper': '2' },
    steps: [
      'Rinse the lentils and simmer with turmeric in 1 L water until soft, 25–30 min.',
      'Cook the onion, tomato and chili in a little ghee; stir into the dal.',
      'For the tadka, heat the rest of the ghee until hot, add cumin and garlic until golden.',
      'Pour the sizzling tadka over the dal and serve.',
    ],
  },
  'goan-fish-curry': {
    serves: 4, time: '35 min',
    amounts: { 'white fish': '600 g firm fillets', 'coconut milk': '400 ml', tamarind: '1 tbsp paste', turmeric: '½ tsp', coriander: '2 tsp ground', 'curry leaf': '10', garlic: '3 cloves', onion: '1' },
    steps: [
      'Fry the onion until soft, then garlic, curry leaves and the ground spices.',
      'Add the coconut milk and tamarind; simmer 10 min.',
      'Slide in the fish pieces and poach gently 5–6 min.',
      'Season with salt and serve with rice.',
    ],
  },
  'garlic-naan': {
    serves: 6, time: '2 hr (incl. rising)',
    amounts: { flour: '400 g', yogurt: '120 g', yeast: '1 tsp instant', milk: '120 ml warm', sugar: '1 tsp', garlic: '4 cloves, minced', ghee: '3 tbsp, melted', cilantro: '2 tbsp chopped' },
    steps: [
      'Mix flour, yeast, sugar, salt, yogurt and milk into a soft dough; knead 5 min.',
      'Rise 1 hour, then divide into 6 balls.',
      'Roll each into a teardrop and cook in a very hot dry pan until puffed and spotted.',
      'Brush with garlic ghee and scatter with cilantro.',
    ],
  },

  // ── Mexican ────────────────────────────────────────────────────────
  'tacos-al-pastor': {
    serves: 4, time: '1 hr + marinating',
    amounts: { pork: '800 g shoulder, thin slices', pineapple: '¼, sliced', cilantro: '1 bunch', onion: '1, finely diced', lime: '2', 'corn tortilla': '12', chipotle: '2 in adobo' },
    steps: [
      'Blend chipotle, a little adobo sauce, garlic, vinegar and pineapple juice; marinate the pork overnight.',
      'Grill or pan-sear the pork in batches until charred, along with the pineapple slices.',
      'Chop the meat and pineapple together.',
      'Serve on warm tortillas with onion, cilantro and lime.',
    ],
  },
  'mole-poblano': {
    serves: 8, time: '3 hr',
    amounts: { chocolate: '50 g Mexican', 'ancho chili': '6 dried (plus mulato/pasilla if you have them)', cinnamon: '1 stick', almond: '40 g', tomato: '2', onion: '1', 'sesame seed': '3 tbsp' },
    steps: [
      'Toast and seed the chiles, then soak them in hot water 20 min.',
      'Toast the almonds, sesame and spices; char the tomato and onion.',
      'Blend everything with the chiles and some soaking water until very smooth.',
      'Fry the paste in lard or oil, stirring, then thin with stock and simmer 1 hour.',
      'Melt in the chocolate and season. Serve over chicken or turkey.',
    ],
  },
  guacamole: {
    serves: 4, time: '10 min',
    amounts: { avocado: '3 ripe', 'lime juice': '1 lime', 'purple onion': '¼, finely diced', 'serrano pepper': '1, minced', cilantro: '1 handful', tomato: '1, seeded and diced', salt: 'to taste' },
    steps: [
      'Mash the onion, chile and some cilantro with salt.',
      'Add the avocado and mash coarsely.',
      'Fold in tomato, lime juice and the rest of the cilantro. Taste and adjust.',
    ],
  },
  'shrimp-ceviche': {
    serves: 4, time: '30 min',
    amounts: { shrimp: '500 g, small dice', 'lime juice': '8 limes', tomato: '2', 'purple onion': '½', cucumber: '1', cilantro: '1 handful', 'jalapeno chile': '1', avocado: '1' },
    steps: [
      'Cover the shrimp in lime juice and chill 15–20 min until opaque.',
      'Dice the tomato, onion, cucumber and chile.',
      'Toss everything with cilantro and salt; add avocado last.',
      'Serve cold with tostadas.',
    ],
  },
  'chicken-enchiladas': {
    serves: 4, time: '50 min',
    amounts: { 'corn tortilla': '10', chicken: '500 g, cooked and shredded', 'chili powder': '2 tbsp', 'tomato sauce': '400 ml', onion: '1', garlic: '2 cloves', cheddar: '150 g grated', 'sour cream': 'to serve' },
    steps: [
      'Simmer tomato sauce with chili powder, garlic and half the onion for 10 min.',
      'Warm the tortillas so they bend; dip each in sauce.',
      'Fill with chicken and a little cheese, roll, and lay seam-down in a dish.',
      'Pour over the rest of the sauce and cheese; bake at 190 °C for 20 min.',
      'Serve with sour cream and the rest of the onion.',
    ],
  },
  'pozole-rojo': {
    serves: 6, time: '2½ hr',
    amounts: { pork: '1 kg shoulder', hominy: '2 × 800 g cans', 'guajillo chili': '6 dried', garlic: '4 cloves', onion: '1', oregano: '1 tbsp', radish: '6, sliced', cabbage: '¼, shredded' },
    steps: [
      'Simmer the pork with onion and garlic in 3 L water for 1½ hours.',
      'Toast and soak the guajillos; blend with a little broth and strain.',
      'Add the chile purée and hominy to the pot; simmer 30 min more and shred the pork.',
      'Serve with radish, cabbage, oregano and lime.',
    ],
  },
  churros: {
    serves: 4, time: '40 min',
    amounts: { flour: '150 g', butter: '30 g', egg: '1', sugar: '100 g, for coating', cinnamon: '2 tsp', salt: '1 pinch', chocolate: '100 g dark, for dipping' },
    steps: [
      'Boil 250 ml water with the butter and salt; beat in the flour until it forms a ball.',
      'Cool slightly and beat in the egg.',
      'Pipe lengths through a star nozzle into 180 °C oil and fry until golden.',
      'Roll in cinnamon sugar; serve with melted chocolate.',
    ],
  },

  // ── Middle Eastern ─────────────────────────────────────────────────
  hummus: {
    serves: 6, time: '15 min',
    amounts: { chickpea: '2 × 400 g cans', tahini: '100 g', 'lemon juice': '1 lemon', garlic: '1 clove', 'olive oil': 'to finish', cumin: '½ tsp' },
    steps: [
      'Blend the tahini, lemon juice, garlic and an ice cube until pale and fluffy.',
      'Add the drained chickpeas and cumin; blend 3–4 min, loosening with cold water.',
      'Season, spread in a bowl, and finish with olive oil.',
    ],
  },
  falafel: {
    serves: 4, time: '40 min + overnight soak',
    amounts: { chickpea: '250 g dried, soaked overnight (not canned)', parsley: '1 bunch', cilantro: '1 bunch', onion: '1 small', garlic: '3 cloves', cumin: '2 tsp', coriander: '1 tsp', tahini: '4 tbsp, for the sauce', 'pita bread': '4' },
    steps: [
      'Pulse the drained raw chickpeas with herbs, onion, garlic and spices to a coarse paste.',
      'Season and chill 30 min, then shape into small patties.',
      'Fry at 175 °C until deep brown, 3–4 min.',
      'Whisk tahini with lemon and water into a sauce; serve in pita.',
    ],
  },
  shakshuka: {
    serves: 2, time: '30 min',
    amounts: { egg: '4', tomato: '400 g canned', 'red pepper': '1', onion: '1', garlic: '2 cloves', cumin: '1 tsp', paprika: '1 tsp', feta: '50 g' },
    steps: [
      'Soften the onion and sliced pepper in oil, then add garlic and spices.',
      'Add the tomatoes and simmer 10 min until thick.',
      'Make wells, crack in the eggs, cover, and cook until the whites set.',
      'Crumble over the feta and serve with bread.',
    ],
  },
  'chicken-shawarma': {
    serves: 4, time: '45 min + marinating',
    amounts: { chicken: '800 g thigh', yogurt: '200 g', garlic: '4 cloves', 'lemon juice': '1 lemon', cumin: '2 tsp', paprika: '2 tsp', allspice: '1 tsp', 'pita bread': '4' },
    steps: [
      'Marinate the chicken in half the yogurt, lemon, spices and half the garlic for 2+ hours.',
      'Roast at 220 °C for 25 min, or grill, until charred.',
      'Mix the remaining yogurt and garlic for the sauce.',
      'Slice the chicken and serve in pita with the sauce.',
    ],
  },
  tabbouleh: {
    serves: 4, time: '25 min',
    amounts: { parsley: '3 bunches, finely chopped', bulgur: '50 g fine', tomato: '3', mint: '1 handful', 'lemon juice': '2 lemons', 'olive oil': '5 tbsp', scallion: '3' },
    steps: [
      'Soak the bulgur in the lemon juice and a little water for 15 min.',
      'Finely chop the parsley, mint, tomato and scallion.',
      'Toss everything with the oil and season. It should be mostly green.',
    ],
  },
  baklava: {
    serves: 20, time: '1½ hr + soaking',
    amounts: { 'phyllo dough': '450 g', walnut: '200 g, chopped', pistachio: '150 g, chopped', butter: '250 g, melted', honey: '150 g', sugar: '200 g', cinnamon: '1 tsp' },
    steps: [
      'Mix the nuts with the cinnamon and a little sugar.',
      'Layer 8 buttered phyllo sheets, scatter nuts, and repeat; finish with 8 sheets.',
      'Cut into diamonds and bake at 170 °C for 50 min until golden.',
      'Boil sugar, honey and 150 ml water for 5 min; pour over the hot pastry.',
      'Leave to soak at least 4 hours.',
    ],
  },
};

/** Details for a recipe id, or null (user-saved recipes have none). */
export function getRecipeDetails(id) {
  return RECIPE_DETAILS[id] || null;
}
