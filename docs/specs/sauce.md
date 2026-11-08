# sauce as-built specs

## SAUCE-PAIR-1 — Sauce card: proteins it is served with, and wines per protein

Owner asked for 'pairs well with' wines on the sauce card and which proteins each sauce pairs with. Each of the 77 sauces in public/data/sauce_augment.json now has a hand-written `proteins` list (2-4, most typical first; kitchen convention, not mined). The card shows them as 'Serve it with' chips with drawings, then 'Wines': the Wine Lab engine (rankWinesForRecipe) scores the sauce's ingredients plus each protein, keeping the best wine per protein, grouped (src/data/sauceWines.js, src/components/SaucePairings.jsx). 'More wines' opens the Wine Lab list for the first protein; its back button returns to the sauce. Fixed along the way: the engine's cooked-with-wine rule fired on wine vinegar (Bearnaise on steak got a white Burgundy; now Syrah). Answer-key scores unchanged (tuned top-3 33/42, held-out 12/16).
