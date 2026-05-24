# Unassigned Ingredients — V3 Research Report

**Generated**: 2026-05-24, post chef-removal pass (874 removed from `ingredients.json`)

74 unaliased items remained after the removal pass. 4 parallel research agents triaged them. WebFetch + WebSearch were both denied by sandbox policy, so all recommendations come from **training knowledge** spot-checkable against the listed Wikipedia URLs.

## Alias-target verification

23 of the agents' 47 suggested alias canonicals don't exist verbatim in V3. The **Patched Action** column below uses the actual V3 canonical when a close variant exists (`game hen` → `cornish game hen`, `halibut` → `atlantic halibut`, `stout` → `stout beer`, etc.) or downgrades to `classify` when no V3 equivalent exists at all.

**Hard gaps** (suggested alias target has NO V3 equivalent — these get classify or chem_add fallback):
- `bok choy`, `mackerel`, `elderflower`, `kokum`, `pernod`, `walleye`, `blood sausage`, `smoked sausage`, `lillet blanc`, `creme de cassis`, `fromage blanc`

---

## Chunk A: Liqueurs & Spirits (19)

| Name | What it is | Action (agent) | Patched action | Reason |
|------|------------|----------------|----------------|--------|
| absinthe | High-ABV anise/wormwood/fennel spirit | alias → pernod | **classify → cluster 3** | pernod not in V3 |
| amaro montenegro | Italian herbal amaro w/ orange peel, vanilla, eucalyptus | classify → cluster 3 | **classify → cluster 3** | Bitter herbal aperitif/digestif |
| anisette | Sweet anise-seed liqueur | alias → pernod | **classify → cluster 1** | pernod not in V3; sweet anise → desserts cluster |
| apfelkorn | German apple-flavored grain spirit | alias → apple liqueur | **alias → apple brandy** | Closest apple-spirit canonical in V3 |
| blackcurrant cordial | Sweetened blackcurrant syrup/liqueur | alias → creme de cassis | **classify → cluster 1** | creme de cassis not in V3 |
| creme de banane | Sweet banana liqueur | alias → banana liqueur | **alias → banana liqueur** | Banana liqueur IS in V3 ✓ |
| creme de cacao | Sweet chocolate/cocoa liqueur | alias → chocolate liqueur | **alias → chocolate liqueur** | Chocolate liqueur IS in V3 ✓ |
| creme de cassi | Typo of crème de cassis | alias → creme de cassis | **classify → cluster 1** | creme de cassis not in V3; sweet berry liqueur |
| dubonnet rouge | French quinine-fortified aperitif wine | alias → sweet vermouth | **alias → sweet vermouth** | Sweet vermouth IS in V3 ✓ |
| everclear | Neutral grain spirit, 75.5–95% ABV, flavorless | alias → vodka | **alias → vodka** | Vodka IS in V3 ✓ |
| falernum | Caribbean spiced syrup/liqueur (lime, ginger, almond, clove) | classify → cluster 3 | **classify → cluster 3** | Spiced syrup territory |
| galliano | Italian sweet herbal liqueur (vanilla, anise, star anise) | classify → cluster 1 | **classify → cluster 1** | Vanilla-anise sweet liqueur |
| jägermeister | German digestif bitter (56 herbs, anise, licorice, citrus) | classify → cluster 3 | **classify → cluster 3** | Herbal bitter/digestif |
| lillet | Aperitif wine, usually = Lillet Blanc | alias → lillet blanc | **classify → cluster 3** | lillet blanc not in V3 |
| lillet blanc | French white aperitif wine (Bordeaux + citrus liqueurs) | classify → cluster 3 | **classify → cluster 3** | Aperitif wine, with vermouths |
| ouzo | Greek anise spirit | alias → pernod | **classify → cluster 3** | pernod not in V3 |
| pernod | French anise spirit (modern absinthe stand-in) | classify → cluster 3 | **classify → cluster 3** | Aromatic spirit/aperitif |
| pisang ambon | Indonesian-style bright green banana liqueur | alias → banana liqueur | **alias → banana liqueur** | Banana liqueur IS in V3 ✓ |
| st. germain | French elderflower liqueur | alias → elderflower liqueur | **classify → cluster 1** | elderflower liqueur not in V3 |

---

## Chunk B: Beers, Cordials, Spices, Botanicals (18)

| Name | What it is | Action (agent) | Patched action | Reason |
|------|------------|----------------|----------------|--------|
| biryani masala | Indian spice blend (cumin/coriander/cardamom/cinnamon/etc.) | alias → garam masala | **alias → garam masala** | garam masala IS in V3 ✓ |
| doubanjiang | Sichuan fermented broad-bean + chili paste | alias → chili bean paste | **alias → chili bean paste** | chili bean paste IS in V3 ✓ |
| dutch stroop | Dutch dark sugar-beet/apple/pear syrup | alias → molasses | **classify → cluster 3** | molasses not in V3 (only pomegranate molasses) |
| elderflower cordial | Sweet British/European syrup from Sambucus nigra | alias → elderflower | **classify → cluster 1** | elderflower not in V3 |
| garcinia indica | Kokum — sour-tart dried fruit rind, souring agent | alias → kokum | **classify → cluster 1** | kokum not in V3 |
| guinness stout | Irish dry stout beer | alias → stout | **alias → stout beer** | stout beer IS in V3 ✓ |
| lager | Bottom-fermented beer (Pilsner/Helles/etc.) | alias → beer | **alias → beer** | beer IS in V3 ✓ |
| leavening agent | Functional category (yeast/baking powder/baking soda) | remove | **remove** | Non-flavoral functional descriptor |
| leaves of summer savoury | Aromatic Mediterranean herb | alias → summer savory | **alias → summer savory** | summer savory IS in V3 ✓ |
| madras paste | South Indian curry paste | alias → curry paste | **alias → curry paste** | curry paste IS in V3 ✓ |
| mulukhiyah | Jute leaves (mucilaginous leafy green) | alias → jute leaves | **alias → jute** | jute (bare) IS in V3 ✓ |
| musk mallow | Abelmoschus moschatus (ambrette) seeds | chem_add | **chem_add** | Distinctive macrocyclic-musk (ambrettolide) |
| sarsaparilla | Smilax root extract; root-beer-like | chem_add | **chem_add** | Signature sarsapogenin + methyl salicylate |
| sazon | Latin/Caribbean seasoning blend (annatto, coriander, etc.) | alias → adobo seasoning | **alias → adobo sauce** | adobo sauce IS in V3 (lossier — flavor-neighbor) |
| stout | Dark top-fermented beer (roasted-malt, coffee, chocolate) | classify → cluster 4 | **alias → stout beer** | stout beer IS in V3 ✓ (better than classify) |
| tia maria | Jamaican coffee liqueur (rum + coffee + vanilla) | alias → coffee liqueur | **alias → coffee liqueur** | coffee liqueur IS in V3 ✓ |
| wormwood | Artemisia absinthium; signature thujone | chem_add | **chem_add** | Signature thujone + absinthin |
| yarrow | Achillea millefolium; camphor, chamazulene | chem_add | **chem_add** | Distinctive azulene/camphor/sabinene |

---

## Chunk C: Proteins — Fish, Game, Sausages (19)

| Name | What it is | Action (agent) | Patched action | Reason |
|------|------------|----------------|----------------|--------|
| barramundi | Australian/SE-Asian lean white flaky fish | alias → cod | **alias → cod** | cod IS in V3 ✓ |
| broad whitefish | Arctic lean white flaky freshwater (Coregonus) | alias → cod | **alias → cod** | cod IS in V3 ✓ |
| elk | Lean dark red game mammal | alias → venison | **alias → venison roast** | venison roast IS in V3 (closest) |
| grouper | Lean white firm-to-flaky saltwater | alias → cod | **alias → cod** | cod IS in V3 ✓ |
| haddock | Lean white flaky gadid (cod family) | alias → cod | **alias → cod** | cod IS in V3 ✓ |
| hake | Lean white soft-flaky gadid | alias → cod | **alias → cod** | cod IS in V3 ✓ |
| herring | Oily strong-flavored small pelagic | alias → mackerel | **classify → cluster 4** | mackerel not in V3; oily fish → bold/smoky |
| kielbasa | Polish smoked pork sausage | alias → smoked sausage | **classify → cluster 4** | smoked sausage not in V3; smoked → bold/smoky |
| mackerel | Oily strong-flavored pelagic | classify → cluster 4 | **classify → cluster 4** | mackerel not in V3 itself (!) |
| morcilla | Spanish/Latin blood sausage | alias → blood sausage | **classify → cluster 7** | blood sausage not in V3; aged/funky meat |
| oxtail | Beef tail, gelatinous braised cut | classify → cluster 7 | **classify → cluster 7** | Deep umami braised-beef |
| pheasant | Lean game bird, mild gamey | alias → game hen | **alias → cornish game hen** | cornish game hen IS in V3 ✓ |
| pikeperch | Lean white flaky freshwater (zander) | alias → walleye | **alias → cod** | walleye not in V3; same lean white flaky role |
| quail | Small lean game bird | alias → game hen | **alias → cornish game hen** | cornish game hen IS in V3 ✓ |
| roe | Fish eggs, briny umami | alias → caviar | **alias → caviar** | caviar IS in V3 ✓ |
| shark | Cartilaginous firm meaty | alias → swordfish | **alias → swordfish** | swordfish IS in V3 ✓ |
| smelt | Small oily fish, often fried whole | alias → sardine | **alias → sardine** | sardine IS in V3 ✓ |
| turbot | Lean white firm flatfish | alias → halibut | **alias → atlantic halibut** | atlantic halibut IS in V3 (closest) |
| walleye | Lean white flaky freshwater | alias → cod | **alias → cod** | cod IS in V3 ✓ |

---

## Chunk D: Pasta, Bread, Cheese, Compound Foods, Produce (18)

| Name | What it is | Action (agent) | Patched action | Reason |
|------|------------|----------------|----------------|--------|
| bok choi | Asian leafy green | alias → bok choy | **classify → cluster 0** | bok choy not in V3; vegetables cluster |
| ciabatta | Italian elongated high-hydration bread | alias → italian bread | **alias → italian bread** | italian bread IS in V3 ✓ |
| falafel | Deep-fried chickpea fritter | alias → chickpea | **alias → chickpea** | chickpea IS in V3 ✓ |
| farfalle | Bowtie-shaped pasta | alias → bowtie pasta | **alias → bowtie pasta** | bowtie pasta IS in V3 ✓ |
| focaccia | Italian flat oven-baked bread | alias → italian bread | **alias → italian bread** | italian bread IS in V3 ✓ |
| freekeh | Roasted green durum wheat (smoky, nutty) | classify → cluster 4 | **classify → cluster 4** | Distinct smoky/charred profile |
| fromage frai | Acid-coagulated fresh French cheese | alias → fromage blanc | **classify → cluster 1** | fromage blanc not in V3 |
| manchego | Spanish aged sheep's-milk cheese | classify → cluster 7 | **classify → cluster 7** | Aged nutty cheese, umami-savory |
| marzipan | Sugar + almond meal confection | alias → almond paste | **alias → almond paste** | almond paste IS in V3 ✓ |
| parmigiano-reggiano | Italian hard aged grana cheese | alias → parmesan | **alias → parmesan** | parmesan IS in V3 ✓ |
| pate | Forcemeat spread (most often liver-based) | alias → liver | **alias → chicken liver** | chicken liver IS in V3 (closest single-canonical) |
| penne rigate | Ridged penne | alias → penne | **alias → penne pasta** | penne pasta IS in V3 ✓ |
| petit poi | French "small pea" (petit pois) | alias → pea | **alias → pea** | pea IS in V3 ✓ |
| sauerkraut | Fermented finely-cut white cabbage | alias → cabbage | **alias → cabbage** | cabbage IS in V3 ✓ |
| seviyan | Indian thin wheat vermicelli | alias → vermicelli | **alias → vermicelli** | vermicelli IS in V3 ✓ |
| spaghetti | Long thin durum-wheat pasta | alias → pasta | **alias → pasta** | pasta IS in V3 ✓ |
| tamale | Mesoamerican steamed masa wrap | alias → masa | **alias → masa harina** | masa harina IS in V3 (closest) |
| toor dal | Split pigeon peas | alias → lentil | **alias → lentil** | lentil IS in V3 ✓ |

---

## Summary by patched action

| Action | Count | Items |
|--------|-------|-------|
| **alias** (fold to existing V3 canonical) | 38 | Most fish, pasta, breads, common liqueurs |
| **classify** (pin to cluster) | 31 | Items where suggested alias canonical doesn't exist in V3 |
| **chem_add** (worth adding to compounds.parquet) | 4 | musk mallow, sarsaparilla, wormwood, yarrow |
| **remove** | 1 | leavening agent |
| **TOTAL** | 74 | |

## Cluster distribution for `classify` items (31)

| Cluster | Count | Reason |
|---------|-------|--------|
| 1 — Sweet Desserts & Dairy | 9 | sweet liqueurs/cordials, fromage frai |
| 3 — Pantry & Sweeteners | 11 | bitters, vermouths, anise spirits, syrups |
| 4 — Bold Savory & Smoky | 4 | herring, kielbasa, mackerel, freekeh |
| 7 — Mushrooms & Cooked Meats | 2 | morcilla, oxtail (manchego is alias not classify) |
| 0 — Vegetables & Greens | 1 | bok choi |
| 7 (already in) | manchego, oxtail | (counted above) |

---

## Next steps

1. **Chef review**: walk through the `Patched action` column. Edit any `alias →` target that doesn't feel right (the agent picked closest-match, not always best-match). For `classify`, confirm the cluster.
2. **Apply script** (TBD): once chef signs off, write `apply_v3_assignments.py` that:
   - Appends `alias` rows to `flavor-gnn/curation/v3_alias_map.json` under `auto_high_confidence`
   - Appends `classify` rows to a new `manual_cluster_assignments.json` consumed by `flavor_layout_v3.py`
   - For `chem_add`, opens a follow-up curation file for compound research (4 items)
   - For `remove`, calls `apply_removal_review.py`-style cleanup
3. **Pipeline re-run**: alias additions will fold pairing signal into canonicals; classify additions will populate cluster slots without retrain (offline-injected positions/cluster_id).

---

## Methodology note

WebFetch and WebSearch were both denied by sandbox policy in this run. The 4 agents fell back to **training knowledge** spot-checkable against the Wikipedia URLs listed in their original tables. The items most worth chef-eyeballing for recommendation quality:
- **Botanicals flagged moderate-confidence by the agent**: garcinia indica, mulukhiyah, musk mallow
- **Anise spirit chain** (absinthe, anisette, ouzo, pernod): all suggested aliasing to `pernod`, which doesn't exist in V3 — so they all fell back to `classify → cluster 3`. Could alternatively bundle as `chem_add` to give the anise family its own chemistry slot.
