# foodon as-built specs

## FOODON-1 — Measure FoodOn (CC BY 4.0) synonyms for ingredient name matching

scripts/build_foodon_synonyms.py maps FoodOn label/exact synonyms to ProData names (2,095 mappings, unambiguous only). Result: Flavor Bible name match 45% -> 46%; ~85-90% precise on a spot check but mostly Latin species names, with culinary errors (ninjin -> ginseng; bell pepper -> paprika). Not shipped. The real gap is plurals, 'x, y' inversions, 'x and y' entries, mojibake and non-ingredient rows.
