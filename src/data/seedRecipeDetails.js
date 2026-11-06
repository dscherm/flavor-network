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

  // ── American ───────────────────────────────────────────────────────
  cheeseburger: {
    serves: 4, time: '25 min',
    amounts: { beef: '600 g minced (20% fat)', cheddar: '4 slices', 'hamburger bun': '4', lettuce: '4 leaves', tomato: '1, sliced', onion: '½, thinly sliced', 'dill pickle': '8 slices', ketchup: 'to taste', mustard: 'to taste' },
    steps: [
      'Divide the beef into 4 loose balls; season the outsides only.',
      'Press each onto a very hot griddle or pan and cook 2–3 min until crusted; flip.',
      'Lay cheddar on the patties for the last minute to melt.',
      'Toast the buns in the fat; build with pickle, onion, tomato, lettuce and sauces.',
    ],
  },
  'mac-and-cheese': {
    serves: 6, time: '50 min',
    amounts: { macaroni: '400 g', cheddar: '300 g grated, sharp', milk: '700 ml', butter: '50 g + 20 g for the top', flour: '40 g', mustard: '1 tsp', nutmeg: '1 pinch', panko: '40 g' },
    steps: [
      'Boil the macaroni 2 min short of done; drain.',
      'Melt the butter, stir in the flour 1 min, then whisk in the milk until thick.',
      'Off the heat add cheddar, mustard, nutmeg and salt; fold in the pasta.',
      'Top with panko tossed in melted butter; bake at 200 °C for 20 min until bubbling.',
    ],
  },
  'bbq-ribs': {
    serves: 4, time: '4 hr',
    amounts: { 'pork rib': '2 racks', 'brown sugar': '3 tbsp', paprika: '2 tbsp smoked', 'cayenne pepper': '1 tsp', 'black pepper': '1 tbsp', 'apple cider vinegar': '3 tbsp', 'barbecue sauce': '200 ml' },
    steps: [
      'Peel the membrane off the back of the racks.',
      'Rub with brown sugar, paprika, cayenne, pepper and salt; rest 1 hour or overnight.',
      'Wrap in foil with the vinegar and cook at 140 °C for 3 hours until the meat pulls from the bone.',
      'Unwrap, brush with sauce, and grill or broil 10 min until sticky.',
    ],
  },
  'clam-chowder': {
    serves: 4, time: '45 min',
    amounts: { clam: '1 kg in shell, or 300 g shelled + 300 ml clam juice', potato: '400 g, diced', onion: '1', celery: '2 stalks', bacon: '100 g', cream: '250 ml', butter: '30 g', thyme: '3 sprigs' },
    steps: [
      'Steam the clams in 300 ml water until open; chop the meat and keep the strained liquid.',
      'Render the bacon, then soften onion and celery in the fat with the butter.',
      'Add potato, thyme and the clam liquid; simmer 15 min until tender.',
      'Stir in cream and clams; heat through without boiling and season.',
    ],
  },
  'buttermilk-pancakes': {
    serves: 4, time: '25 min',
    amounts: { flour: '250 g', buttermilk: '400 ml', egg: '2', butter: '40 g melted + for the pan', sugar: '2 tbsp', vanilla: '1 tsp', 'maple syrup': 'to serve' },
    steps: [
      'Whisk flour, sugar, 1½ tsp baking powder, ½ tsp baking soda and a pinch of salt.',
      'Whisk buttermilk, eggs, melted butter and vanilla; fold into the dry mix — lumps are fine.',
      'Ladle onto a buttered medium-hot pan; flip when bubbles burst on top.',
      'Serve with butter and maple syrup.',
    ],
  },
  'chicken-gumbo': {
    serves: 6, time: '2 hr',
    amounts: { chicken: '800 g thigh', 'andouille sausage': '300 g, sliced', okra: '250 g, sliced', onion: '1', celery: '2 stalks', 'green pepper': '1', flour: '80 g', 'cayenne pepper': '½ tsp', rice: '400 g, cooked' },
    steps: [
      'Cook the flour in 80 ml oil, stirring constantly, until the colour of milk chocolate (20–30 min).',
      'Add the onion, celery and pepper; cook 5 min.',
      'Add 1.5 L stock, the chicken, sausage, cayenne and okra; simmer 1 hour.',
      'Shred the chicken back in, season, and serve over rice.',
    ],
  },
  'caesar-salad': {
    serves: 4, time: '20 min',
    amounts: { 'romaine lettuce': '2 heads', parmesan: '60 g, shaved', anchovy: '4 fillets', 'egg yolk': '1', 'lemon juice': '2 tbsp', garlic: '1 clove', 'olive oil': '120 ml', 'garlic crouton': '2 handfuls' },
    steps: [
      'Mash the anchovies and garlic to a paste.',
      'Whisk in the yolk and lemon juice, then the oil in a thin stream until creamy.',
      'Toss the torn romaine in the dressing.',
      'Top with croutons and parmesan.',
    ],
  },
  'fried-chicken': {
    serves: 4, time: '1 hr + brining',
    amounts: { chicken: '1.5 kg pieces', buttermilk: '500 ml', flour: '250 g', paprika: '1 tbsp', 'cayenne pepper': '1 tsp', garlic: '2 cloves, crushed', salt: '1 tbsp', 'black pepper': '1 tsp' },
    steps: [
      'Brine the chicken in buttermilk, garlic and half the salt for 4+ hours.',
      'Mix flour with paprika, cayenne, pepper and the rest of the salt.',
      'Dredge the pieces, pressing the flour on; rest 10 min.',
      'Fry at 160 °C for 12–15 min until deep golden and 75 °C inside.',
    ],
  },
  'apple-pie': {
    serves: 8, time: '1½ hr',
    amounts: { apple: '1.2 kg, mixed sweet and tart', 'pie crust': '2 × 23 cm rounds', sugar: '120 g', butter: '30 g', cinnamon: '1½ tsp', nutmeg: '¼ tsp', 'lemon juice': '1 tbsp', flour: '2 tbsp' },
    steps: [
      'Toss sliced apples with sugar, flour, spices and lemon juice.',
      'Line a pie dish with one crust, fill, and dot with butter.',
      'Lay the second crust on top, seal and crimp, and cut vents.',
      'Bake at 200 °C for 20 min, then 180 °C for 35–40 min until the juices bubble thickly.',
    ],
  },
  'chocolate-chip-cookies': {
    serves: 24, time: '30 min + chilling',
    amounts: { flour: '300 g', butter: '200 g, soft', 'brown sugar': '150 g', sugar: '100 g', egg: '1 + 1 yolk', vanilla: '2 tsp', 'chocolate chip': '250 g', salt: '1 tsp' },
    steps: [
      'Beat butter and both sugars until pale; beat in egg, yolk and vanilla.',
      'Fold in flour, salt and ¾ tsp baking soda, then the chocolate.',
      'Chill the dough 1 hour (or overnight for deeper flavour).',
      'Bake scoops at 180 °C for 11–13 min until the edges set and the middles look underdone.',
    ],
  },

  // ── Mediterranean ──────────────────────────────────────────────────
  paella: {
    serves: 6, time: '1 hr',
    amounts: { rice: '500 g bomba or arborio', chicken: '500 g thigh', shrimp: '300 g', chorizo: '150 g', saffron: '1 large pinch', tomato: '2, grated', 'green pea': '100 g', 'sweet pepper': '1 red', garlic: '3 cloves', 'olive oil': '4 tbsp' },
    steps: [
      'Brown the chicken and chorizo in oil in a wide pan; set aside.',
      'Soften the pepper and garlic, add the tomato and cook to a paste.',
      'Stir in the rice to coat, add 1.2 L hot stock with the saffron, and return the meat. Do not stir again.',
      'Simmer 15 min, add peas and shrimp, cook 5 min more, then rest 5 min for the socarrat.',
    ],
  },
  gazpacho: {
    serves: 4, time: '15 min + chilling',
    amounts: { tomato: '1 kg ripe', cucumber: '1', 'sweet pepper': '1 green', onion: '½', garlic: '1 clove', 'olive oil': '80 ml', 'sherry vinegar': '2 tbsp', bread: '1 thick slice, crusts off' },
    steps: [
      'Soak the bread in a little water.',
      'Blend everything but the oil until smooth.',
      'With the motor running, pour in the oil to emulsify; season.',
      'Chill at least 2 hours; serve with diced vegetables on top.',
    ],
  },
  'patatas-bravas': {
    serves: 4, time: '45 min',
    amounts: { potato: '800 g, in chunks', tomato: '400 g canned', paprika: '2 tsp smoked', garlic: '3 cloves', 'olive oil': 'for frying + 2 tbsp', mayonnaise: '100 g', 'cayenne pepper': '½ tsp' },
    steps: [
      'Par-boil the potatoes 8 min, dry, then fry in oil until crisp.',
      'For the bravas sauce, cook 2 cloves garlic in 2 tbsp oil, add paprika, cayenne and tomatoes; simmer 15 min and blend.',
      'Beat the last clove, crushed, into the mayonnaise for the aioli.',
      'Serve the potatoes with both sauces.',
    ],
  },
  'greek-salad': {
    serves: 4, time: '10 min',
    amounts: { tomato: '4, in wedges', cucumber: '1', feta: '200 g in one slab', 'kalamata olive': '16', 'purple onion': '½, sliced', oregano: '1 tsp dried', 'olive oil': '4 tbsp', 'lemon juice': '1 tbsp' },
    steps: [
      'Cut the tomatoes into wedges and the cucumber into thick half-moons.',
      'Toss tomato, cucumber, onion and olives with oil, lemon and salt.',
      'Lay the feta on top and scatter with oregano and more oil. No lettuce.',
    ],
  },
  moussaka: {
    serves: 6, time: '2 hr',
    amounts: { eggplant: '3 large', lamb: '600 g minced', onion: '1', tomato: '400 g canned', cinnamon: '1 tsp', garlic: '3 cloves', milk: '600 ml', butter: '60 g', flour: '60 g', parmesan: '60 g' },
    steps: [
      'Slice and salt the eggplant 20 min, then brush with oil and roast until golden.',
      'Brown the lamb with onion and garlic; add tomato and cinnamon and simmer 30 min.',
      'Make a béchamel with butter, flour and milk; beat in the parmesan.',
      'Layer eggplant and lamb, pour over the béchamel, and bake at 180 °C for 45 min.',
    ],
  },
  spanakopita: {
    serves: 8, time: '1¼ hr',
    amounts: { spinach: '1 kg', feta: '300 g, crumbled', 'phyllo dough': '12 sheets', egg: '2', onion: '1', dill: '1 bunch', butter: '100 g, melted' },
    steps: [
      'Wilt the spinach, squeeze very dry, and chop.',
      'Mix with sautéed onion, dill, feta and beaten eggs.',
      'Layer 6 buttered phyllo sheets in a tin, add the filling, and top with 6 more.',
      'Score the top and bake at 180 °C for 45 min until crisp.',
    ],
  },
  'pork-souvlaki': {
    serves: 4, time: '30 min + marinating',
    amounts: { pork: '800 g shoulder, cubed', 'lemon juice': '2 lemons', oregano: '2 tbsp dried', garlic: '4 cloves', 'olive oil': '4 tbsp', 'pita bread': '4', yogurt: '200 g' },
    steps: [
      'Marinate the pork in lemon, oregano, garlic and oil for 2+ hours.',
      'Thread onto skewers and grill over high heat 10–12 min, turning.',
      'Warm the pita; serve the skewers with yogurt, tomato and onion.',
    ],
  },

  // ── Italian ────────────────────────────────────────────────────────
  lasagna: {
    serves: 8, time: '2 hr',
    amounts: { 'lasagna noodle': '12 sheets', beef: '600 g minced', tomato: '800 g canned', onion: '1', garlic: '3 cloves', ricotta: '400 g', mozzarella: '300 g', parmesan: '80 g', basil: '1 handful' },
    steps: [
      'Brown the beef with onion and garlic, add the tomatoes and basil, and simmer 45 min.',
      'Mix the ricotta with half the parmesan, an egg if you like, and salt.',
      'Layer sauce, noodles, ricotta and mozzarella three times; finish with sauce and parmesan.',
      'Bake covered at 190 °C for 30 min, uncovered 15 min more; rest 15 min before cutting.',
    ],
  },
  'osso-buco': {
    serves: 4, time: '2½ hr',
    amounts: { veal: '4 shank slices, 4 cm thick', 'white wine': '250 ml', onion: '1', carrot: '1', celery: '1 stalk', tomato: '200 g canned', garlic: '2 cloves + 1 for gremolata', lemon: '1, zested', parsley: '1 handful' },
    steps: [
      'Flour and brown the shanks on both sides; set aside.',
      'Soften diced onion, carrot, celery and garlic; add wine and reduce by half.',
      'Return the veal, add tomato and 300 ml stock, cover, and braise at 160 °C for 2 hours.',
      'Mix parsley, lemon zest and raw garlic for the gremolata; scatter over to serve.',
    ],
  },
  'panna-cotta': {
    serves: 4, time: '15 min + 4 hr setting',
    amounts: { cream: '400 ml', milk: '100 ml', sugar: '60 g', vanilla: '1 pod', gelatin: '2 sheets or 1 tsp powdered' },
    steps: [
      'Soak the gelatin in cold water.',
      'Heat cream, milk, sugar and vanilla to just below a simmer.',
      'Squeeze out the gelatin and dissolve it in the hot cream.',
      'Pour into moulds and chill 4 hours; serve with fruit.',
    ],
  },

  // ── French ─────────────────────────────────────────────────────────
  bouillabaisse: {
    serves: 6, time: '1½ hr',
    amounts: { 'white fish': '800 g firm, in chunks', mussel: '500 g', shrimp: '300 g', fennel: '1 bulb', tomato: '4', saffron: '1 pinch', garlic: '4 cloves', orange: '2 strips of peel', 'olive oil': '5 tbsp' },
    steps: [
      'Soften sliced fennel and garlic in oil; add tomato, orange peel and saffron.',
      'Add 1.5 L fish stock and simmer 20 min.',
      'Add the fish, then 3 min later the mussels and shrimp; cook until the shells open.',
      'Serve with rouille and toasted bread.',
    ],
  },
  'tarte-tatin': {
    serves: 6, time: '1 hr',
    amounts: { apple: '6 firm', butter: '80 g', sugar: '150 g', 'puff pastry': '1 sheet' },
    steps: [
      'Melt the sugar in an ovenproof pan to a deep amber caramel; stir in the butter.',
      'Pack peeled apple halves tightly into the caramel, rounded side down.',
      'Cook 15 min on the hob, lay the pastry over, tuck in the edges, and bake at 200 °C for 25 min.',
      'Rest 5 min, then invert onto a plate.',
    ],
  },
  'salade-nicoise': {
    serves: 4, time: '30 min',
    amounts: { tuna: '2 × 150 g, seared or tinned in oil', egg: '4', 'green bean': '200 g', potato: '400 g small', tomato: '4', olive: '16 niçoise', anchovy: '8 fillets', 'olive oil': '5 tbsp' },
    steps: [
      'Boil the potatoes until tender; blanch the beans 3 min; soft-boil the eggs 7 min.',
      'Whisk oil with a little red wine vinegar and mustard for the dressing.',
      'Arrange everything on a platter with the halved eggs, olives and anchovies.',
      'Dress and serve just warm.',
    ],
  },

  // ── East Asian ─────────────────────────────────────────────────────
  'miso-ramen': {
    serves: 2, time: '45 min (with ready stock)',
    amounts: { 'ramen noodle': '2 portions', pork: '200 g belly, sliced', egg: '2, soft-boiled', scallion: '2', 'soy sauce': '1 tbsp', miso: '3 tbsp', garlic: '2 cloves', ginger: '1 tbsp grated', nori: '2 sheets' },
    steps: [
      'Fry the pork until browned; add garlic and ginger for a minute.',
      'Add 1 L pork or chicken stock and the soy; simmer 10 min.',
      'Whisk the miso into a ladle of broth and return it; do not boil.',
      'Cook the noodles, divide into bowls, pour over the broth and top with egg, pork, scallion and nori.',
    ],
  },
  'kung-pao-chicken': {
    serves: 3, time: '25 min',
    amounts: { chicken: '450 g thigh, diced', peanut: '60 g roasted', chili: '8 dried', 'sichuan peppercorn': '1 tsp', 'soy sauce': '2 tbsp', 'rice vinegar': '1 tbsp', garlic: '3 cloves', scallion: '4, in short lengths' },
    steps: [
      'Marinate the chicken in half the soy and a little cornstarch.',
      'Fry the chilies and Sichuan pepper in oil until fragrant, then the chicken until golden.',
      'Add garlic and scallion, then the rest of the soy, vinegar and 1 tsp sugar.',
      'Toss in the peanuts and serve.',
    ],
  },
  'beef-bulgogi': {
    serves: 4, time: '20 min + marinating',
    amounts: { beef: '600 g sirloin, paper-thin', 'soy sauce': '4 tbsp', 'brown sugar': '2 tbsp', 'sesame oil': '1 tbsp', garlic: '4 cloves', pear: '½, grated', scallion: '3', 'sesame seed': '1 tbsp' },
    steps: [
      'Mix soy, sugar, sesame oil, garlic and grated pear; marinate the beef 1+ hours.',
      'Sear in a very hot pan in batches so it chars rather than stews.',
      'Finish with scallion and sesame seeds; serve with rice and lettuce leaves.',
    ],
  },

  // ── SE Asian ───────────────────────────────────────────────────────
  laksa: {
    serves: 4, time: '40 min',
    amounts: { 'rice noodle': '300 g', 'coconut milk': '400 ml', shrimp: '300 g', 'curry paste': '4 tbsp laksa or red', 'bean sprout': '100 g', tofu: '200 g fried puffs', lime: '1', cilantro: '1 handful' },
    steps: [
      'Fry the paste in oil until fragrant; add coconut milk and 600 ml stock.',
      'Simmer 10 min, add tofu and shrimp until pink.',
      'Soak or boil the noodles; divide into bowls.',
      'Ladle over the soup; top with sprouts, cilantro and lime.',
    ],
  },
  'banh-mi': {
    serves: 2, time: '30 min + pickling',
    amounts: { pork: '300 g, thinly sliced', 'bread baguette': '2 short', carrot: '1, julienned', radish: '1 daikon, julienned', cucumber: '½', cilantro: '1 handful', 'jalapeno chile': '1, sliced', mayonnaise: '3 tbsp', 'soy sauce': '2 tbsp' },
    steps: [
      'Pickle the carrot and radish in equal vinegar and water with a spoon of sugar for 30 min.',
      'Marinate the pork in soy, a little sugar and garlic; sear until charred.',
      'Split and toast the baguettes; spread with mayonnaise.',
      'Fill with pork, pickles, cucumber, cilantro and chili.',
    ],
  },

  // ── South Asian ────────────────────────────────────────────────────
  samosa: {
    serves: 6, time: '1½ hr',
    amounts: { potato: '500 g, boiled', 'green pea': '100 g', flour: '250 g', cumin: '1 tsp seeds', coriander: '1 tsp ground', 'garam masala': '1 tsp', ginger: '1 tbsp', cilantro: '2 tbsp' },
    steps: [
      'Make a stiff dough with flour, 3 tbsp oil, salt and water; rest 30 min.',
      'Sizzle cumin, add ginger, then crushed potato, peas and spices; cool.',
      'Roll dough into rounds, halve, form cones, fill, and seal.',
      'Fry at 160 °C until golden and blistered, about 8 min.',
    ],
  },
  'butter-chicken': {
    serves: 4, time: '1 hr + marinating',
    amounts: { chicken: '700 g thigh', butter: '60 g', tomato: '500 g, puréed', cream: '150 ml', 'garam masala': '2 tsp', fenugreek: '1 tsp dried leaves', ginger: '1 tbsp', garlic: '4 cloves' },
    steps: [
      'Marinate the chicken in yogurt, half the ginger-garlic and 1 tsp garam masala; grill until charred.',
      'Melt the butter, cook the rest of the ginger-garlic, add the tomato and simmer 20 min.',
      'Stir in cream, fenugreek, the remaining garam masala and a little sugar.',
      'Add the chicken and simmer 10 min.',
    ],
  },

  // ── Middle Eastern ─────────────────────────────────────────────────
  'lamb-kofta': {
    serves: 4, time: '30 min',
    amounts: { lamb: '600 g minced', onion: '1, grated and squeezed', parsley: '1 handful', cumin: '2 tsp', coriander: '1 tsp', cinnamon: '½ tsp', garlic: '3 cloves', yogurt: '200 g' },
    steps: [
      'Knead the lamb with onion, herbs, spices, garlic and salt until sticky.',
      'Shape onto skewers in long ovals; chill 15 min.',
      'Grill over high heat 8–10 min, turning once.',
      'Serve with garlic-spiked yogurt and flatbread.',
    ],
  },
  mujadara: {
    serves: 4, time: '50 min',
    amounts: { lentil: '250 g brown or green', rice: '200 g', onion: '3 large, thinly sliced', cumin: '1½ tsp', 'olive oil': '100 ml' },
    steps: [
      'Fry the onions slowly in the oil until deeply browned and crisp, 25–30 min.',
      'Simmer the lentils 15 min, add the rice, cumin and 400 ml water; cover and cook 15 min.',
      'Stir half the onions and their oil through; pile the rest on top.',
    ],
  },

  // ── Mexican ────────────────────────────────────────────────────────
  'chiles-rellenos': {
    serves: 4, time: '1 hr',
    amounts: { 'poblano pepper': '4 large', 'monterey jack cheese': '250 g', egg: '4, separated', flour: '3 tbsp + for dusting', tomato: '400 g', onion: '½', garlic: '2 cloves' },
    steps: [
      'Char the poblanos over a flame, steam in a covered bowl, peel, and slit to seed.',
      'Stuff with cheese and close with a toothpick; dust in flour.',
      'Whip the whites to peaks, fold in the yolks and flour; coat the chiles and fry until golden.',
      'Blend and simmer the tomato, onion and garlic for the sauce; serve the chiles in it.',
    ],
  },
  elote: {
    serves: 4, time: '20 min',
    amounts: { corn: '4 ears', mayonnaise: '4 tbsp', 'cotija cheese': '60 g, crumbled', 'chili powder': '1 tsp', lime: '1', cilantro: '2 tbsp chopped' },
    steps: [
      'Grill the corn, turning, until charred in spots, 10 min.',
      'Brush with mayonnaise mixed with lime juice.',
      'Roll in cotija, dust with chili and scatter cilantro; serve with lime wedges.',
    ],
  },
};

/** Details for a recipe id, or null (user-saved recipes have none). */
export function getRecipeDetails(id) {
  return RECIPE_DETAILS[id] || null;
}
