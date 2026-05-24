# Unassigned Ingredients — Chef Removal Review

**Total**: 1018 ingredients in ingredients.json but NOT in cluster_labels_v3.json.

Mark items to remove with **`r`** in the **Action** column. Items left blank are kept.
When done, run:

```
python flavor-gnn/scripts/apply_removal_review.py
```

Columns:
- **Action**: put `r` to remove (drops from ingredients.json AND pairings.json)
- **Name**: ingredient name
- **Count**: totalCount in pairings (higher = more popular)
- **Category**: from ingredients.json (`other` is often junk)
- **Alias→**: if non-empty, this name auto-aliases to a v3 canonical (low priority to remove; the alias already folds the signal)

| Action | Name | Count | Category | Alias→ |
|--------|------|------:|----------|--------|
|  | vegetable oil | 147030 | fat | `vegetable` |
|  | breadcrumb | 20871 | thickener | `bread crumb` |
|  | semi-sweet chocolate chip | 12285 | sweetener | `semi-sweet chocolate` |
|  | rolled oat | 10386 | grain | `oat` |
|  | mixed vegetable | 6017 | other | `vegetable` |
|  | pie shell | 5569 | baked | `pie` |
|  | pecan halve | 5381 | nut | `pecan` |
|  | chile | 5102 | chili | `chilie` |
|  | green chile | 4710 | chili | `green chilie` |
|  | yellow squash | 4686 | vegetable | `squash` |
|  | crab meat | 4421 | protein | `crab` |
|  | corn meal | 3609 | vegetable | `corn` |
|  | vegetable cooking spray | 2929 | other | `vegetable` |
|  | flax seed | 2567 | nut | `flaxseed` |
|  | light mayonnaise | 2375 | condiment | `mayonnaise` |
|  | cornflake | 2232 | other | `corn flake` |
|  | red chile | 2160 | chili | `red chilie` |
|  | chile powder | 2068 | chili | `chili powder` |
|  | pickling spice | 1939 | other | `spice` |
|  | serrano chile | 1813 | chili | `serrano chilie` |
|  | red curry | 1768 | other | `curry` |
|  | cooking oat | 1663 | grain | `oat` |
|  | corn bread | 1599 | grain | `bread` |
|  | red lentil | 1581 | other | `lentil` |
|  | corn starch | 1460 | vegetable | `corn` |
|  | ham hock | 1423 | protein | `ham` |
|  | miracle whip | 1237 | other | `mayonnaise` |
|  | mixed spice | 1179 | other | `spice` |
|  | quick-cooking oat | 1151 | grain | `oat` |
|  | vegetable oil cooking spray | 1142 | fat | `vegetable` |
|  | chipotle chile | 1127 | chili | `chipotle chilie` |
|  | low-fat mayonnaise | 1119 | condiment | `mayonnaise` |
|  | italian seasoned breadcrumb | 1105 | thickener | `italian seasoned bread crumb` |
|  | lemon jell-o | 1060 | citrus | `lemon` |
|  | deli ham | 1056 | protein | `ham` |
|  | soy milk | 1026 | dairy | `milk` |
|  | dish pie shell | 1011 | baked | `pie` |
|  | long grain white rice | 991 | grain | `grain white rice` |
|  | red-wine vinegar | 990 | acid | `wine vinegar` |
|  | old-fashioned oat | 980 | grain | `oat` |
|  | poblano chile | 976 | chili | `poblano chilie` |
|  | ham bone | 932 | protein | `ham` |
|  | mixed fruit | 913 | other | `fruit` |
|  | mixed herb | 862 | other | `herb` |
|  | yellow corn meal | 860 | vegetable | `yellow corn` |
|  | chipotle powder | 824 | chili | `chili powder` |
|  | orange jell-o | 809 | citrus | `orange` |
|  | lemon grass | 797 | citrus | `lemongrass` |
|  | freshly parmesan | 792 | dairy | `parmesan` |
|  | vegetable oil spray | 773 | fat | `vegetable` |
|  | unbaked pie shell | 757 | baked | `pie` |
|  | brown lentil | 741 | other | `lentil` |
|  | aubergine | 740 | other | `eggplant` |
|  | chilli powder | 712 | chili | `chili powder` |
|  | strawberry jell-o | 702 | fruit | `strawberry` |
|  | nut meat | 676 | other | `nutmeat` |
|  | cayenne powder | 649 | chili | `cayenne pepper` |
|  | extravirgin olive oil | 646 | fat | `olive oil` |
|  | pie spice | 644 | baked | `spice` |
|  | -grain mustard | 638 | condiment | `grain mustard` |
|  | cream style corn | 636 | dairy | `corn` |
|  | white-wine vinegar | 625 | acid | `wine vinegar` |
|  | candied fruit | 615 | other | `fruit` |
|  | dressing mix | 598 | condiment | `dressing` |
|  | spice powder | 595 | other | `spice` |
|  | cornflake crumb | 561 | other | `corn flake crumb` |
|  | italian breadcrumb | 558 | thickener | `italian bread` |
|  | mayonaise | 552 | condiment | `mayonnaise` |
|  | duck breast | 549 | protein | `duck` |
|  | regular oat | 541 | grain | `oat` |
|  | fully cooked ham | 538 | protein | `ham` |
|  | extra-lean beef | 532 | protein | `lean beef` |
|  | corn flour | 501 | thickener | `flour` |
|  | chick pea | 488 | vegetable | `chickpea` |
|  | green curry | 484 | other | `curry` |
|  | ham steak | 470 | protein | `ham` |
|  | rum flavoring | 470 | spirit | `rum` |
|  | curry pwdr | 463 | other | `curry` |
|  | italian dressing mix | 463 | condiment | `italian dressing` |
|  | -berry | 454 | fruit | `berry` |
|  | kiwifruit | 448 | other | `kiwi fruit` |
|  | vegetable bouillon cube | 435 | other | `vegetable` |
|  | country ham | 431 | protein | `ham` |
|  | red leaf | 425 | other | `leaf` |
|  | cacao powder | 410 | other | `cocoa` |
|  | mixed candied fruit | 399 | other | `fruit` |
|  | italian spice | 398 | other | `spice` |
|  | red-pepper | 398 | chili | `red pepper` |
|  | 's white chocolate | 397 | sweetener | `white chocolate` |
|  | campbell's tomato soup | 390 | vegetable | `tomato soup` |
|  | semi sweet chocolate chip | 390 | sweetener | `sweet chocolate chip` |
|  | sweetcorn | 381 | other | `sweet corn` |
|  | lasagne noodle | 376 | grain | `lasagna noodle` |
|  | extra-virgin extra virgin olive oil | 369 | fat | `olive oil` |
|  | ancho chile powder | 368 | chili | `ancho chili powder` |
|  | italian herb seasoning | 353 | seasoning | `herb` |
|  | passionfruit | 348 | other | `passion fruit` |
|  | cinnamon-sugar | 343 | spice | `cinnamon` |
|  | chick-pea | 342 | vegetable | `chickpea` |
|  | vegetable bouillon | 342 | other | `vegetable` |
|  | solid white tuna | 328 | protein | `tuna` |
|  | ricotta salata | 310 | dairy | `ricotta` |
|  | italian herb | 308 | other | `herb` |
|  | ruby port | 304 | condiment | `port` |
|  | serrano ham | 300 | protein | `ham` |
|  | lime jell-o | 299 | citrus | `lime` |
|  | chile flake | 285 | chili | `chili flake` |
|  | lean ham | 277 | protein | `ham` |
|  | chile paste | 265 | chili | `chili paste` |
|  | summer squash | 253 | vegetable | `squash` |
|  | white cheddar | 253 | dairy | `cheddar` |
|  | scotch bonnet | 251 | chili | `chilie` |
|  | lump crab meat | 240 | protein | `lump crab` |
|  | white tuna | 228 | protein | `tuna` |
|  | dry lentil | 224 | other | `lentil` |
|  | herb dressing | 223 | condiment | `herb` |
|  | philadelphia original cream cheese | 223 | dairy | `cream cheese` |
|  | thin ham | 222 | protein | `ham` |
|  | chinese vegetable | 221 | other | `vegetable` |
|  | mixed italian herb | 221 | other | `herb` |
|  | duck fat | 218 | protein | `duck` |
|  | white shoe peg corn | 215 | vegetable | `shoe peg corn` |
|  | black currant | 213 | other | `currant` |
|  | vegetable stock cube | 213 | liquid | `vegetable stock` |
|  | vermicelli noodle | 212 | grain | `vermicelli` |
|  | beef processed | 209 | protein | `beef` |
|  | stone mustard | 209 | condiment | `mustard` |
|  | cognac brandy | 204 | spirit | `brandy` |
|  | ginger garlic | 203 | aromatic | `garlic` |
|  | malibu rum | 203 | spirit | `rum` |
|  | green leaf | 201 | other | `leaf` |
|  | teriyaki marinade | 201 | umami | `teriyaki` |
|  | graham wafer crumb | 200 | baked | `graham cracker crumb` |
|  | cornflakes cereal | 199 | grain | `corn flakes cereal` |
|  | italian style bread crumb | 198 | grain | `bread crumb` |
|  | semisweet chocolate morsel | 195 | sweetener | `chocolate morsel` |
|  | boiled ham | 189 | protein | `ham` |
|  | sherry | 189 | other | `wine` |
|  | sugar + | 189 | sweetener | `sugar` |
|  | wheat breadcrumb | 188 | thickener | `wheat bread` |
|  | wish-bone italian dressing | 188 | condiment | `italian dressing` |
|  | cake pan | 187 | baked | `cake` |
|  | vanilla low-fat yogurt | 184 | dairy | `low-fat yogurt` |
|  | -milk | 183 | dairy | `milk` |
|  | white bread crumb | 183 | grain | `bread crumb` |
|  | italian-seasoned breadcrumb | 181 | thickener | `italian seasoned bread crumb` |
|  | bird chile | 179 | chili | `chilie` |
|  | black forest ham | 179 | protein | `ham` |
|  | flour + | 178 | thickener | `flour` |
|  | red chilli powder | 176 | chili | `red chili powder` |
|  | whitefish | 175 | other | `white fish` |
|  | short grain rice | 170 | grain | `grain rice` |
|  | white corn meal | 169 | vegetable | `white corn` |
|  | parma ham | 168 | protein | `ham` |
|  | kabocha squash | 166 | vegetable | `squash` |
|  | pinenut | 166 | other | `pine nut` |
|  | cashew halve | 158 | nut | `cashew` |
|  | fines herbe | 158 | other | `herbe` |
|  | nonfat mayonnaise | 157 | condiment | `mayonnaise` |
|  | grape seed oil | 156 | fat | `vegetable` |
|  | long-grain brown rice | 156 | grain | `brown rice` |
|  | vegetable spray | 155 | other | `vegetable` |
|  | spice mix | 154 | other | `spice` |
|  | -wheat flour | 153 | thickener | `wheat flour` |
|  | campbell's cheddar cheese soup | 152 | dairy | `cheddar cheese soup` |
|  | duck leg | 150 | protein | `duck` |
|  | parmesan rind | 149 | dairy | `parmesan` |
|  | four-cheese | 148 | dairy | `four cheese` |
|  | asafetida powder | 147 | other | `asafoetida powder` |
|  | mozzarella ball | 147 | dairy | `mozzarella` |
|  | baby caper | 146 | vegetable | `caper` |
|  | low fat milk | 146 | dairy | `milk` |
|  | anise | 145 | other | `aniseed` |
|  | golden rum | 145 | spirit | `rum` |
|  | mayonnaise dressing | 145 | condiment | `mayonnaise` |
|  | red chile powder | 143 | chili | `red chili powder` |
|  | red currant | 143 | other | `currant` |
|  | anaheim chile | 141 | chili | `anaheim chilie` |
|  | semi sweet chocolate | 141 | sweetener | `sweet chocolate` |
|  | pot roast | 140 | protein | `beef` |
|  | sunflower | 140 | nut | `sunflower seed` |
|  | light oil | 139 | fat | `vegetable` |
|  | safflower | 138 | other | `safflower oil` |
|  | soy bean | 137 | vegetable | `bean` |
|  | sour cherry | 136 | fruit | `cherry` |
|  | instant oat | 134 | grain | `oat` |
|  | graham crust | 133 | baked | `graham pie crust` |
|  | drizzle of olive oil | 132 | fat | `olive oil` |
|  | strawberry wine | 132 | liquid | `strawberry` |
|  | pie cherrie | 131 | baked | `pie` |
|  | cured ham | 129 | protein | `ham` |
|  | musk melon | 129 | fruit | `melon` |
|  | cook oat | 128 | grain | `oat` |
|  | italian style tomatoe | 128 | vegetable | `tomatoe` |
|  | olive oil + | 128 | fat | `olive oil` |
|  | other cheese | 128 | dairy | `cheese` |
|  | all spice | 126 | other | `spice` |
|  | comte cheese | 126 | dairy | `cheese` |
|  | five spice powder | 125 | spice | `spice` |
|  | freshly-grnd black pepper | 125 | chili | `grnd black pepper` |
|  | vanilla low- | 125 | spice | `vanilla` |
|  | mayonnai | 124 | condiment | `mayonnaise` |
|  | parmesan shaving | 124 | dairy | `parmesan` |
|  | extra virgin extra virgin olive oil | 123 | fat | `olive oil` |
|  | mixed peel | 123 | other | `peel` |
|  | fruit filling | 122 | other | `fruit` |
|  | russian cheese | 122 | dairy | `cheese` |
|  | chile oil | 121 | fat | `chili oil` |
|  | mixed pickling spice | 121 | other | `spice` |
|  | regular rolled oat | 121 | grain | `oat` |
|  | cooked ham | 120 | protein | `ham` |
|  | rocket salad | 119 | other | `rocket` |
|  | white crab meat | 119 | protein | `crab` |
|  | ginger snap | 118 | aromatic | `ginger` |
|  | sheep cheese | 116 | dairy | `cheese` |
|  | 's bittersweet chocolate | 115 | sweetener | `sweet chocolate` |
|  | black eyed pea | 115 | vegetable | `black-eyed pea` |
|  | cinnamon raisin bread | 115 | spice | `raisin bread` |
|  | bourbon whisky | 114 | spirit | `bourbon` |
|  | campbell's golden mushroom soup | 114 | vegetable | `golden mushroom soup` |
|  | domiati cheese | 114 | dairy | `cheese` |
|  | emmental cheese | 114 | dairy | `emmentaler cheese` |
|  | mission fig | 114 | fruit | `fig` |
|  | tilsit cheese | 114 | dairy | `cheese` |
|  | munster cheese | 113 | dairy | `muenster cheese` |
|  | orange flavored liqueur | 113 | liqueur | `orange flavored` |
|  | candied pecan | 112 | nut | `pecan` |
|  | corn- | 111 | vegetable | `corn` |
|  | black lentil | 109 | other | `lentil` |
|  | hanout spice mix | 109 | other | `spice` |
|  | pecan chip | 107 | nut | `pecan` |
|  | bitter cherry | 106 | fruit | `cherry` |
|  | italian-seasoned bread crumb | 106 | grain | `bread crumb` |
|  | vegetable stock powder | 106 | liquid | `vegetable stock` |
|  | light tuna | 105 | protein | `tuna` |
|  | no sugar | 105 | sweetener | `no-sugar` |
|  | -milk ricotta cheese | 104 | dairy | `milk ricotta cheese` |
|  | apple - | 104 | fruit | `apple` |
|  | corn bread crumb | 104 | grain | `bread crumb` |
|  | campbell's beef | 103 | protein | `beef` |
|  | chinese five spice | 102 | spice | `spice` |
|  | puy lentil | 101 | other | `lentil` |
|  | -milk ricotta | 100 | dairy | `milk ricotta` |
|  | -milk yogurt | 100 | dairy | `milk yogurt` |
|  | -squeezed lemon juice | 100 | citrus | `squeezed lemon juice` |
|  | japanese pumpkin | 100 | other | `pumpkin` |
|  | mung bean | 100 | vegetable | `bean` |
|  | poppyseed | 100 | nut | `poppy seed` |
|  | yellow lentil | 100 | other | `lentil` |
|  | orange-flower water | 99 | citrus | `orange` |
|  | pork spare rib | 99 | protein | `pork` |
|  | boiling- water | 98 | liquid | `boiling water` |
|  | redskin onion | 98 | aromatic | `onion` |
|  | corn bread stuffing | 97 | grain | `bread stuffing` |
|  | italian-style bread crumb | 97 | grain | `bread crumb` |
|  | mexican oregano | 97 | herb | `oregano` |
|  | virginia ham | 96 | protein | `ham` |
|  | butter milk | 95 | fat | `buttermilk` |
|  | full fat coconut milk | 95 | dairy | `coconut milk` |
|  | pie dough | 95 | baked | `pie` |
|  | black mulberry | 94 | fruit | `berry` |
|  | cherry tomato | 94 | vegetable | `tomatoe` |
|  | european chestnut | 94 | nut | `chestnut` |
|  | hard wheat | 94 | grain | `wheat` |
|  | malabar spinach | 94 | vegetable | `spinach` |
|  | nanking cherry | 94 | fruit | `cherry` |
|  | oriental wheat | 94 | grain | `wheat` |
|  | rowanberry | 94 | fruit | `berry` |
|  | saskatoon berry | 94 | fruit | `berry` |
|  | welsh onion | 94 | aromatic | `onion` |
|  | black crowberry | 93 | fruit | `berry` |
|  | chinese chestnut | 93 | nut | `chestnut` |
|  | corn salad | 93 | vegetable | `corn` |
|  | hedge mustard | 93 | condiment | `mustard` |
|  | herb dressing mix | 93 | condiment | `herb` |
|  | horned melon | 93 | fruit | `melon` |
|  | hyacinth bean | 93 | vegetable | `bean` |
|  | japanese chestnut | 93 | nut | `chestnut` |
|  | malabar plum | 93 | fruit | `plum` |
|  | mammee apple | 93 | fruit | `apple` |
|  | moth bean | 93 | vegetable | `bean` |
|  | natal plum | 93 | fruit | `plum` |
|  | new zealand spinach | 93 | vegetable | `spinach` |
|  | ohelo berry | 93 | fruit | `berry` |
|  | scarlet bean | 93 | vegetable | `bean` |
|  | swamp cabbage | 93 | vegetable | `cabbage` |
|  | winged bean | 93 | vegetable | `bean` |
|  | winter squash | 93 | vegetable | `squash` |
|  | yardlong bean | 93 | vegetable | `long bean` |
|  | annual wild rice | 92 | grain | `wild rice` |
|  | beansprout | 92 | other | `bean sprout` |
|  | buffalo currant | 92 | other | `currant` |
|  | climbing bean | 92 | vegetable | `bean` |
|  | jostaberry | 92 | fruit | `berry` |
|  | kentucky bourbon | 92 | spirit | `bourbon` |
|  | muscadine grape | 92 | fruit | `grape` |
|  | pineappple sage | 92 | herb | `sage` |
|  | red rice | 92 | grain | `rice` |
|  | skunk currant | 92 | other | `currant` |
|  | tartary buckwheat | 92 | baked | `buckwheat` |
|  | crookneck squash | 91 | vegetable | `squash` |
|  | black mussel | 89 | protein | `mussel` |
|  | vegetable bouillon granule | 89 | other | `vegetable` |
|  | passionfruit pulp | 88 | other | `passion fruit pulp` |
|  | vanilla soymilk | 88 | spice | `soymilk` |
|  | yellow curry | 88 | other | `curry` |
|  | corn bread stuffing mix | 87 | grain | `bread stuffing mix` |
|  | veg-all vegetable | 87 | other | `vegetable` |
|  | campbell's condensed cream | 86 | dairy | `condensed cream` |
|  | tightly baby spinach leave | 86 | vegetable | `baby spinach leave` |
|  | vegetable mix | 86 | other | `vegetable` |
|  | vegetable-oil cooking spray | 86 | fat | `vegetable` |
|  | seasons italian dressing | 84 | condiment | `italian dressing` |
|  | vegan mayonnaise | 83 | condiment | `mayonnaise` |
|  | light italian dressing | 82 | condiment | `dressing` |
|  | vegetable or chicken | 82 | protein | `vegetable` |
|  | non-fat vanilla yogurt | 81 | dairy | `vanilla yogurt` |
|  | campbell's pork | 80 | protein | `pork` |
|  | country style pork rib | 79 | protein | `pork rib` |
|  | ham shank | 79 | protein | `ham` |
|  | mayonaisse | 79 | condiment | `mayonnaise` |
|  | soy mayonnaise | 79 | condiment | `mayonnaise` |
|  | apple-cider vinegar | 78 | acid | `cider vinegar` |
|  | bottles champagne | 78 | liquid | `champagne` |
|  | ham cooked | 78 | protein | `ham` |
|  | light chunk tuna | 78 | protein | `tuna` |
|  | kraft classic caesar dressing | 76 | condiment | `caesar dressing` |
|  | vegetable seasoning | 76 | seasoning | `vegetable` |
|  | egg mayonnaise | 75 | protein | `mayonnaise` |
|  | ham stock | 75 | protein | `ham` |
|  | plum brandy | 75 | spirit | `brandy` |
|  | candied peel | 74 | other | `peel` |
|  | cherry jell-o | 74 | fruit | `cherry` |
|  | chocolate-hazelnut spread | 74 | nut | `chocolate` |
|  | fruit jam | 74 | sweetener | `fruit` |
|  | philadelphia light cream cheese | 74 | dairy | `light cream cheese` |
|  | vanilla fat- | 74 | spice | `vanilla` |
|  | 's sweet chocolate | 73 | sweetener | `sweet chocolate` |
|  | kraft classic mayonnaise | 73 | condiment | `mayonnaise` |
|  | ranch dressing mix | 73 | condiment | `ranch dressing` |
|  | short grain brown rice | 73 | grain | `brown rice` |
|  | a spice mill | 72 | other | `spice` |
|  | campbell's beef broth | 72 | protein | `beef` |
|  | fruit punch | 72 | liquid | `fruit` |
|  | vegetable blend | 71 | other | `vegetable` |
|  | vegetable protein | 71 | other | `vegetable` |
|  | fruit bit | 70 | other | `fruit` |
|  | piquillo peppers | 70 | chili | `piquillo pepper` |
|  | shaved ham | 70 | protein | `ham` |
|  | italian tuna | 69 | protein | `tuna` |
|  | baking molasse | 68 | sweetener | `molasse` |
|  | fried potato | 68 | vegetable | `potato` |
|  | herb seasoning | 68 | seasoning | `herb` |
|  | light mayo | 68 | condiment | `mayo` |
|  | lite mayonnaise | 68 | condiment | `mayonnaise` |
|  | spice rub | 68 | condiment | `spice` |
|  | tropical fruit | 68 | other | `fruit` |
|  | favorite fruit | 67 | other | `fruit` |
|  | ham cube | 67 | protein | `ham` |
|  | milk + | 67 | dairy | `milk` |
|  | thin deli ham | 67 | protein | `ham` |
|  | tumeric powder | 67 | other | `turmeric` |
|  | your favorite barbecue sauce | 67 | condiment | `barbecue sauce` |
|  | crumbled feta | 66 | dairy | `feta` |
|  | jumbo lump crab meat | 66 | protein | `lump crab` |
|  | vegetable flake | 66 | other | `vegetable` |
|  | fluid bourbon | 65 | spirit | `bourbon` |
|  | regular mayonnaise | 65 | condiment | `mayonnaise` |
|  | smoked ham | 65 | protein | `ham` |
|  | ichimi spice | 63 | other | `spice` |
|  | lean hamburg | 63 | protein | `hamburg` |
|  | philadelphia neufchatel cheese | 63 | dairy | `neufchatel cheese` |
|  | barbecue spice | 62 | other | `spice` |
|  | black fig | 62 | fruit | `fig` |
|  | extra lean turkey | 62 | protein | `lean turkey` |
|  | coarse-grain mustard | 61 | condiment | `grain mustard` |
|  | cookie crust | 61 | baked | `cookie pie crust` |
|  | kraft classic ranch dressing | 61 | condiment | `ranch dressing` |
|  | low fat sour cream | 60 | dairy | `cream` |
|  | chicken-flavor | 59 | protein | `chicken` |
|  | butter + | 58 | fat | `butter` |
|  | leftover ham | 58 | protein | `ham` |
|  | monde spice | 58 | other | `spice` |
|  | no salt | 58 | seasoning | `no-salt` |
|  | pickle spice | 58 | vegetable | `spice` |
|  | pork loin chops with bone | 58 | protein | `pork loin chop` |
|  | seedless red | 58 | nut | `grape` |
|  | steamed vegetable | 58 | other | `vegetable` |
|  | sweet curry | 58 | other | `curry` |
|  | wholewheat bread | 58 | grain | `wheat bread` |
|  | -kernel corn | 57 | vegetable | `kernel corn` |
|  | backfin crab meat | 57 | protein | `crab` |
|  | citrus peel oil | 57 | fat | `peel` |
|  | lemon lime soda | 57 | citrus | `lime soda` |
|  | stone cornmeal | 57 | thickener | `cornmeal` |
|  | textured vegetable protein | 57 | other | `vegetable` |
|  | chunk light tuna | 56 | protein | `tuna` |
|  | cooked lentil | 56 | other | `lentil` |
|  | golden italian dressing | 56 | condiment | `italian dressing` |
|  | mashed fig | 56 | fruit | `fig` |
|  | yeast roll | 56 | baked | `bread` |
|  | cardamon seed | 55 | nut | `cardamom seed` |
|  | chili-garlic | 55 | chili | `garlic` |
|  | -squeezed orange juice | 54 | citrus | `squeezed orange juice` |
|  | assorted fruit | 54 | other | `fruit` |
|  | assorted vegetable | 54 | other | `vegetable` |
|  | blackberry brandy | 54 | spirit | `blackberry` |
|  | chilli paste | 54 | chili | `chili paste` |
|  | ripe fig | 54 | fruit | `fig` |
|  | vanilla low-fat | 54 | spice | `vanilla` |
|  | baby zucchini | 53 | vegetable | `zucchini` |
|  | beef-flavor | 53 | protein | `beef` |
|  | campbell's mushroom soup | 53 | vegetable | `mushroom soup` |
|  | fluid gin | 53 | spirit | `gin` |
|  | hormel chunk ham | 53 | protein | `ham` |
|  | jeera powder | 53 | other | `cumin` |
|  | kraft lite raspberry vinaigrette dressing | 53 | fruit | `raspberry vinaigrette` |
|  | polly-o original ricotta cheese | 53 | dairy | `ricotta` |
|  | stir-fry vegetable | 53 | other | `vegetable` |
|  | weinbrand brandy | 53 | spirit | `brandy` |
|  | chocolate hazelnut | 52 | nut | `chocolate` |
|  | lemon-flavored gelatin | 52 | citrus | `flavored gelatin` |
|  | nama shoyu | 52 | other | `shoyu` |
|  | non-fat milk | 52 | dairy | `milk` |
|  | piecrust | 52 | baked | `pie crust` |
|  | raspberry brandy | 52 | spirit | `raspberry` |
|  | anise brandy | 51 | spirit | `brandy` |
|  | armagnac brandy | 51 | spirit | `brandy` |
|  | crust pie | 51 | baked | `pie` |
|  | hormel ham | 51 | protein | `ham` |
|  | light vegetable oil | 51 | fat | `vegetable` |
|  | non-fat yogurt | 51 | dairy | `yogurt` |
|  | nonstick vegetable cooking spray | 51 | other | `vegetable` |
|  | papaya brandy | 51 | spirit | `brandy` |
|  | chicken flavored ramen noodle | 50 | protein | `chicken flavor` |
|  | coleslaw dressing | 50 | condiment | `coleslaw` |
|  | cream of mushroom soup or cream of chicken soup | 50 | dairy | `cream of mushroom soup` |
|  | curry leaves | 50 | herb | `curry` |
|  | duck stock | 50 | protein | `duck` |
|  | long red chile | 50 | chili | `long red chilie` |
|  | mein vegetable | 50 | other | `vegetable` |
|  | nonpareil caper | 50 | vegetable | `caper` |
|  | red fruit | 50 | other | `fruit` |
|  | red chilli | 48 | chili | `red chili` |
|  | clary sage | 43 | herb | `sage` |
|  | citrus fruit | 42 | citrus | `fruit` |
|  | fatty fish | 38 | protein | `fish` |
|  | turkey berry | 38 | protein | `berry` |
|  | white currant | 37 | other | `currant` |
|  | lemon peel oil | 36 | fat | `lemon` |
|  | scotch spearmint | 36 | spirit | `mint` |
|  | wheaten bread | 30 | grain | `bread` |
|  | fish oil | 23 | fat | `fish` |
|  | mandarin orange peel oil | 23 | fat | `mandarin orange` |
|  | bitter orange | 22 | citrus | `orange` |
|  | spineless monkey orange | 20 | citrus | `orange` |
|  | soybean sauce | 19 | condiment | `bean sauce` |
|  | lean fish | 18 | protein | `fish` |
|  | lime peel oil | 16 | fat | `lime` |
|  | green chilli | 15 | chili | `green chili` |
|  | smoked fish | 15 | protein | `fish` |
|  | bomba rice | 14 | grain | `rice` |
|  | bantu beer | 13 | liquid | `beer` |
|  | grapefruit peel oil | 13 | fat | `grapefruit` |
|  | wild cherry | 13 | fruit | `cherry` |
|  | cluster bean | 12 | vegetable | `bean` |
|  | proof rum | 12 | spirit | `rum` |
|  | arabica coffee | 11 | liquid | `coffee` |
|  | courgette | 10 | other | `zucchini` |
|  | strawberrie | 10 | fruit | `strawberry` |
|  | anise hyssop | 9 | other |  |
|  | valerian | 9 | other |  |
|  | allium | 8 | other |  |
|  | egg plant | 8 | protein | `eggplant` |
|  | spanish sage | 8 | herb | `sage` |
|  | yoghurt | 8 | other | `yogurt` |
|  | baguette | 7 | other |  |
|  | blackberrie | 7 | fruit | `blackberry` |
|  | cashew apple | 7 | nut | `cashew` |
|  | challot | 7 | other | `shallot` |
|  | champaca | 7 | other |  |
|  | codfish | 7 | other | `cod fish` |
|  | creosote | 7 | other |  |
|  | pepino | 7 | other |  |
|  | raspberrie | 7 | fruit | `raspberry` |
|  | red sage | 7 | herb | `sage` |
|  | sassafra | 7 | other |  |
|  | sweet and sour | 7 | other |  |
|  | bakery product | 6 | other |  |
|  | cajeput | 6 | other |  |
|  | chambord raspberry liqueur | 6 | liqueur | `raspberry liqueur` |
|  | chilli | 6 | chili | `chili` |
|  | galliano | 6 | other |  |
|  | garcinia indica | 6 | other |  |
|  | haddock | 6 | other |  |
|  | sirloin steak | 6 | protein | `beef` |
|  | woodapple | 6 | other |  |
|  | arrack | 5 | other |  |
|  | birds-eye chillie | 5 | other |  |
|  | chilli flake | 5 | chili | `chili flake` |
|  | common tuna | 5 | protein | `tuna` |
|  | creme de cacao | 5 | other |  |
|  | creme de cassi | 5 | other |  |
|  | gelatin dessert | 5 | dairy | `gelatin` |
|  | hummu | 5 | other |  |
|  | leavening agent | 5 | other |  |
|  | malay apple | 5 | fruit | `apple` |
|  | other dish | 5 | other |  |
|  | other fish product | 5 | protein | `fish` |
|  | other snack food | 5 | other |  |
|  | pate | 5 | other |  |
|  | pheasant | 5 | other |  |
|  | pizza | 5 | other |  |
|  | satsuma orange | 5 | citrus | `orange` |
|  | soft drink | 5 | other |  |
|  | spaghetti | 5 | other |  |
|  | atlantic salmon | 4 | protein | `salmon` |
|  | atlantic wolffish | 4 | other |  |
|  | bagel | 4 | other |  |
|  | bearded seal | 4 | other |  |
|  | beluga whale | 4 | other |  |
|  | berry wine | 4 | liquid | `berry` |
|  | breakfast sandwich | 4 | other |  |
|  | burrito | 4 | other |  |
|  | caribou | 4 | other |  |
|  | chinook salmon | 4 | protein | `salmon` |
|  | chocolate spread | 4 | sweetener | `chocolate` |
|  | chum salmon | 4 | protein | `salmon` |
|  | cichlidae | 4 | other |  |
|  | clupeinae | 4 | other |  |
|  | common ling | 4 | other |  |
|  | common octopu | 4 | other |  |
|  | corn grit | 4 | vegetable | `corn` |
|  | crown royal | 4 | other |  |
|  | cut | 4 | other |  |
|  | deer | 4 | other |  |
|  | elderflower cordial | 4 | other |  |
|  | flatfish | 4 | other | `fish` |
|  | focaccia | 4 | other |  |
|  | frankfurter sausage | 4 | protein | `sausage` |
|  | french toast | 4 | other |  |
|  | goat milk | 4 | dairy | `goat` |
|  | gruyère | 4 | other | `gruyere` |
|  | horse | 4 | other |  |
|  | lasagna | 4 | other |  |
|  | macaroni and cheese | 4 | dairy | `macaroni` |
|  | marzipan | 4 | other |  |
|  | midori melon liqueur | 4 | liqueur | `melon liqueur` |
|  | nacho | 4 | other |  |
|  | northern pike | 4 | other |  |
|  | nougat | 4 | other |  |
|  | ostrich | 4 | other |  |
|  | other bread product | 4 | grain | `bread` |
|  | other dessert | 4 | other |  |
|  | other meat product | 4 | other |  |
|  | other pasta dish | 4 | grain | `pasta` |
|  | other sandwich | 4 | other |  |
|  | passata | 4 | other | `tomato sauce` |
|  | perciforme | 4 | other |  |
|  | pot pie | 4 | baked | `pie` |
|  | potato puff | 4 | vegetable | `potato` |
|  | salmonidae | 4 | other |  |
|  | sauerkraut | 4 | other |  |
|  | sheefish | 4 | other | `fish` |
|  | snack bar | 4 | other |  |
|  | snail | 4 | other |  |
|  | squab | 4 | other |  |
|  | starch | 4 | other |  |
|  | stuffing | 4 | other |  |
|  | suet | 4 | other |  |
|  | taco | 4 | other |  |
|  | tamale | 4 | other |  |
|  | topping | 4 | other |  |
|  | true frog | 4 | other |  |
|  | turbot | 4 | other |  |
|  | vegetarian food | 4 | other |  |
|  | whiting | 4 | other |  |
|  | absinthe | 3 | other |  |
|  | alaska pollock | 3 | other |  |
|  | anatidae | 3 | other |  |
|  | anguilliforme | 3 | other |  |
|  | ani | 3 | other |  |
|  | arepa | 3 | other |  |
|  | bacardi limon | 3 | other |  |
|  | beaver | 3 | other |  |
|  | beli | 3 | other |  |
|  | bivalvia | 3 | other |  |
|  | blue whiting | 3 | other |  |
|  | brown bear | 3 | other |  |
|  | buffalo | 3 | other |  |
|  | carp bream | 3 | other |  |
|  | casein | 3 | other |  |
|  | celeriac | 3 | other |  |
|  | cetacea | 3 | other |  |
|  | channel catfish | 3 | protein | `catfish` |
|  | charr | 3 | other |  |
|  | chewing gum | 3 | other |  |
|  | coho salmon | 3 | protein | `salmon` |
|  | columbidae | 3 | other |  |
|  | common dab | 3 | other |  |
|  | elk | 3 | other |  |
|  | emu | 3 | other |  |
|  | energy drink | 3 | other |  |
|  | everclear | 3 | other |  |
|  | falafel | 3 | other |  |
|  | flaked almond | 3 | nut | `almond` |
|  | fruit gum | 3 | other | `fruit` |
|  | gadiforme | 3 | other |  |
|  | garfish | 3 | other |  |
|  | goldschlager | 3 | other |  |
|  | half-and-half | 3 | other | `half and half` |
|  | hippoglossu | 3 | other |  |
|  | horchata | 3 | other |  |
|  | hushpuppy | 3 | other |  |
|  | ice cream cone | 3 | dairy | `ice cream` |
|  | jack daniel | 3 | other |  |
|  | jägermeister | 3 | other |  |
|  | kefir | 3 | dairy | `milk` |
|  | kool-aid | 3 | other |  |
|  | lasagne sheet | 3 | other |  |
|  | lemon sole | 3 | citrus | `fish` |
|  | lumpsucker | 3 | other |  |
|  | mallard duck | 3 | protein | `duck` |
|  | meat bouillon | 3 | other |  |
|  | meringue | 3 | other |  |
|  | moose | 3 | other |  |
|  | mountain hare | 3 | other |  |
|  | myrrh | 3 | other |  |
|  | norway haddock | 3 | other |  |
|  | norway pout | 3 | other |  |
|  | nutritional drink | 3 | other |  |
|  | opossum | 3 | other |  |
|  | orange spiral | 3 | citrus | `orange` |
|  | orgeat syrup | 3 | sweetener | `almond` |
|  | pacific ocean perch | 3 | other |  |
|  | pacific rockfish | 3 | other | `rockfish` |
|  | painted comber | 3 | other |  |
|  | pak choi | 3 | other |  |
|  | pan dulce | 3 | other |  |
|  | pikeperch | 3 | other |  |
|  | pleuronectidae | 3 | other |  |
|  | pollock | 3 | other |  |
|  | potato bread | 3 | grain | `potato` |
|  | pupusa | 3 | other |  |
|  | quail | 3 | other |  |
|  | quesadilla | 3 | other |  |
|  | raccoon | 3 | other |  |
|  | ravioli | 3 | other |  |
|  | remoulade | 3 | other |  |
|  | rock ptarmigan | 3 | other |  |
|  | salad | 3 | other |  |
|  | scombridae | 3 | other |  |
|  | scrapple | 3 | other |  |
|  | sheep milk | 3 | dairy | `milk` |
|  | sloe gin | 3 | spirit | `gin` |
|  | sour mix | 3 | other |  |
|  | southern comfort | 3 | other |  |
|  | spiny dogfish | 3 | other |  |
|  | spotted seal | 3 | other |  |
|  | spread | 3 | other |  |
|  | sprite | 3 | other |  |
|  | squirrel | 3 | other |  |
|  | sturgeon | 3 | other |  |
|  | true sole | 3 | other |  |
|  | up | 3 | other |  |
|  | waffle | 3 | other |  |
|  | white creme de menthe | 3 | other |  |
|  | wild boar | 3 | other |  |
|  | wild turkey | 3 | protein | `turkey` |
|  | ymer | 3 | other |  |
|  | zwieback | 3 | other |  |
|  | absolut citron | 2 | other | `vodka` |
|  | adobo | 2 | other |  |
|  | akutaq | 2 | other |  |
|  | albacore tuna | 2 | protein | `tuna` |
|  | american shad | 2 | other |  |
|  | ascidian | 2 | other |  |
|  | atlantic croaker | 2 | other |  |
|  | atlantic mackerel | 2 | other |  |
|  | atlantic menhaden | 2 | other |  |
|  | atlantic pollock | 2 | other |  |
|  | beef shin | 2 | protein | `beef` |
|  | beefalo | 2 | other |  |
|  | beverage alcolohic other | 2 | other |  |
|  | brown rice noodle | 2 | grain | `rice noodle` |
|  | cacao | 2 | other |  |
|  | cardomom | 2 | other | `cardamom` |
|  | cascarilla | 2 | other |  |
|  | ceriman | 2 | other |  |
|  | cherrie | 2 | other |  |
|  | cherry heering | 2 | fruit | `cherry` |
|  | chimichanga | 2 | other |  |
|  | cisco | 2 | other |  |
|  | cocktail | 2 | other |  |
|  | coco sugar | 2 | sweetener | `coconut sugar` |
|  | coffee mocha | 2 | liquid | `coffee` |
|  | common carp | 2 | other |  |
|  | corona | 2 | other | `beer` |
|  | cranberrie | 2 | fruit | `cranberry` |
|  | creme de banane | 2 | other |  |
|  | cusk | 2 | other |  |
|  | cuttlefish | 2 | other |  |
|  | damn | 2 | other |  |
|  | dark brown soft sugar | 2 | sweetener | `brown sugar` |
|  | dog | 2 | other |  |
|  | dolphin fish | 2 | protein | `fish` |
|  | dragée | 2 | other |  |
|  | dumpling | 2 | other |  |
|  | empanada | 2 | other |  |
|  | enchilada | 2 | other |  |
|  | european anchovy | 2 | other | `anchovy` |
|  | fir | 2 | other |  |
|  | fish burger | 2 | protein | `fish` |
|  | florida pompano | 2 | other |  |
|  | freshwater drum | 2 | other |  |
|  | freshwater eel | 2 | other |  |
|  | frybread | 2 | baked | `bread` |
|  | garlic bulb | 2 | aromatic | `garlic` |
|  | gefilte fish | 2 | protein | `fish` |
|  | gelatine leaf | 2 | dairy | `gelatine` |
|  | ginger cordial | 2 | aromatic | `ginger` |
|  | glace cherry | 2 | fruit | `cherry` |
|  | grass | 2 | other |  |
|  | greater sturgeon | 2 | other |  |
|  | green creme de menthe | 2 | other |  |
|  | green turtle | 2 | other |  |
|  | grouper | 2 | other |  |
|  | guinea hen | 2 | other |  |
|  | heart of palm | 2 | other |  |
|  | hispi cabbage | 2 | vegetable | `cabbage` |
|  | italian fennel sausage | 2 | protein | `sausage` |
|  | jamaican curry powder | 2 | spice | `curry powder` |
|  | junket | 2 | other |  |
|  | king mackerel | 2 | other |  |
|  | lager | 2 | other |  |
|  | lamb kidney | 2 | protein | `lamb` |
|  | leather chiton | 2 | other |  |
|  | lillet blanc | 2 | other |  |
|  | lingcod | 2 | other |  |
|  | meringue nest | 2 | other |  |
|  | milkfish | 2 | other |  |
|  | mincemeat | 2 | other |  |
|  | morchella | 2 | other |  |
|  | mule deer | 2 | other |  |
|  | muskrat | 2 | other |  |
|  | naan bread | 2 | grain | `bread` |
|  | napa cabbage | 2 | vegetable | `cabbage` |
|  | natto | 2 | other |  |
|  | natural yoghurt | 2 | other | `natural yogurt` |
|  | north pacific giant octopu | 2 | other |  |
|  | northern bluefin tuna | 2 | protein | `tuna` |
|  | ocean pout | 2 | other |  |
|  | pacific herring | 2 | other |  |
|  | pacific jack mackerel | 2 | other |  |
|  | passoa | 2 | other |  |
|  | peach bitter | 2 | fruit | `bitter` |
|  | pectin | 2 | other |  |
|  | percoidei | 2 | other |  |
|  | piki bread | 2 | grain | `bread` |
|  | plain chocolate | 2 | sweetener | `chocolate` |
|  | polar bear | 2 | other |  |
|  | potato gratin | 2 | vegetable | `potato` |
|  | pretzel | 2 | other |  |
|  | pul biber | 2 | other |  |
|  | rainbow smelt | 2 | other |  |
|  | red king crab | 2 | protein | `king crab` |
|  | red pepper paste | 2 | chili | `red pepper` |
|  | ricard | 2 | other |  |
|  | rice bread | 2 | grain | `bread` |
|  | rice paper sheet | 2 | grain | `rice paper` |
|  | roe | 2 | other |  |
|  | rosemary syrup | 2 | herb | `rosemary` |
|  | sablefish | 2 | other | `fish` |
|  | sandalwood | 2 | other |  |
|  | scup | 2 | other |  |
|  | seafood mix | 2 | other |  |
|  | sesame seed burger bun | 2 | nut | `sesame seed` |
|  | shark | 2 | other |  |
|  | sheepshead | 2 | other |  |
|  | smelt | 2 | other |  |
|  | spanish mackerel | 2 | other |  |
|  | spiny lobster | 2 | protein | `lobster` |
|  | spot croaker | 2 | other |  |
|  | striped mullet | 2 | other |  |
|  | succotash | 2 | other |  |
|  | surge | 2 | other |  |
|  | tapioca pearl | 2 | thickener | `pearl` |
|  | tilefish | 2 | other |  |
|  | tostada | 2 | other |  |
|  | trail mix | 2 | other |  |
|  | true seal | 2 | other |  |
|  | vanilla ice-cream | 2 | dairy | `vanilla` |
|  | walleye | 2 | other |  |
|  | whelk | 2 | other |  |
|  | white sucker | 2 | other | `fish` |
|  | wonton wrapper | 2 | other |  |
|  | yellowtail amberjack | 2 | other |  |
|  | zima | 2 | other |  |
|  | absolut kurant | 1 | other | `vodka` |
|  | absolut peppar | 1 | other | `vodka` |
|  | absolut vodka | 1 | spirit | `vodka` |
|  | achillea | 1 | other |  |
|  | ackee | 1 | other |  |
|  | advocaat | 1 | other |  |
|  | alaska blackfish | 1 | other |  |
|  | alpinia | 1 | other |  |
|  | amaro montenegro | 1 | other |  |
|  | ancho chillie | 1 | chili | `ancho chilie` |
|  | anisette | 1 | other |  |
|  | apfelkorn | 1 | other |  |
|  | añejo rum | 1 | spirit | `rum` |
|  | baby aubergine | 1 | other | `eggplant` |
|  | baby lettuce leave | 1 | vegetable | `lettuce leave` |
|  | baby pak koi | 1 | other |  |
|  | baby plum tomatoe | 1 | fruit | `tomatoe` |
|  | baby squid | 1 | protein | `squid` |
|  | baked bean | 1 | vegetable | `bean` |
|  | barramundi | 1 | other |  |
|  | beef cutlet | 1 | protein | `beef` |
|  | beef stock concentrate | 1 | protein | `beef stock` |
|  | beef stock cube | 1 | protein | `beef stock` |
|  | beef tomatoe | 1 | protein | `tomatoe` |
|  | biryani masala | 1 | other |  |
|  | bitter lemon | 1 | citrus | `lemon` |
|  | black bear | 1 | other |  |
|  | blackcurrant cordial | 1 | other |  |
|  | blackstrap rum | 1 | spirit | `rum` |
|  | blended scotch | 1 | spirit | `scotch` |
|  | blood orange | 1 | citrus | `orange` |
|  | bok choi | 1 | other |  |
|  | bouillon cube | 1 | other |  |
|  | bouquet garni | 1 | other |  |
|  | bowhead whale | 1 | other |  |
|  | broad whitefish | 1 | other |  |
|  | bun | 1 | other |  |
|  | byrsonima crassifolia | 1 | other |  |
|  | cabbage leave | 1 | vegetable | `cabbage` |
|  | cajun | 1 | other |  |
|  | callaloo | 1 | other |  |
|  | carbonated soft drink | 1 | other |  |
|  | casabe | 1 | other |  |
|  | cassaba | 1 | other |  |
|  | cedar | 1 | other |  |
|  | chicken wing | 1 | protein | `chicken` |
|  | chilli bean paste | 1 | chili | `bean paste` |
|  | chillie | 1 | other | `chilie` |
|  | chinese leaf | 1 | other | `leaf` |
|  | chinese long bean | 1 | vegetable | `long bean` |
|  | chinese sesame sauce | 1 | nut | `sesame` |
|  | ciabatta | 1 | other |  |
|  | coffee brandy | 1 | spirit | `brandy` |
|  | colby jack cheese | 1 | dairy | `jack cheese` |
|  | cooked beetroot | 1 | other | `beetroot` |
|  | cooked chestnut | 1 | nut | `chestnut` |
|  | corn arepa filled with mozarella cheese | 1 | dairy | `mozarella cheese` |
|  | cranberry vodka | 1 | spirit | `cranberry` |
|  | creamed corn | 1 | vegetable | `corn` |
|  | creme de mure | 1 | other |  |
|  | cubed feta cheese | 1 | dairy | `feta` |
|  | daiquiri mix | 1 | other |  |
|  | dark chocolate chip | 1 | sweetener | `chocolate chip` |
|  | dark soft brown sugar | 1 | sweetener | `brown sugar` |
|  | doner meat | 1 | other |  |
|  | doubanjiang | 1 | other |  |
|  | dubonnet rouge | 1 | other |  |
|  | dutch stroop | 1 | other |  |
|  | falernum | 1 | other |  |
|  | farfalle | 1 | other |  |
|  | feather blade beef | 1 | protein | `beef` |
|  | fermented black bean | 1 | vegetable | `bean` |
|  | fine yellow cornmeal | 1 | thickener | `cornmeal` |
|  | firewater | 1 | other |  |
|  | flat rice noodle | 1 | grain | `rice noodle` |
|  | free-range eggs beaten | 1 | other |  |
|  | freekeh | 1 | other |  |
|  | french lentil | 1 | other | `lentil` |
|  | fresca | 1 | other |  |
|  | frie | 1 | other |  |
|  | fried ripe banana | 1 | fruit | `ripe banana` |
|  | fromage frai | 1 | other |  |
|  | fruit mix | 1 | other | `fruit` |
|  | full fat sour cream | 1 | dairy | `sour cream` |
|  | full fat yogurt | 1 | dairy | `yogurt` |
|  | german sausage | 1 | protein | `sausage` |
|  | grain alcohol | 1 | other |  |
|  | grape soda | 1 | liquid | `grape` |
|  | green red lentil | 1 | other | `lentil` |
|  | guinness stout | 1 | other |  |
|  | hake | 1 | other |  |
|  | hard taco shell | 1 | other |  |
|  | hazlenut | 1 | other | `hazelnut` |
|  | herring | 1 | other |  |
|  | hind shank | 1 | other |  |
|  | islay single malt scotch | 1 | spirit | `scotch` |
|  | jagermeister | 1 | other |  |
|  | jello | 1 | dairy | `jelly` |
|  | jim beam | 1 | other | `whiskey` |
|  | kabanos sausage | 1 | protein | `sausage` |
|  | kabse spice | 1 | other | `spice` |
|  | khus khu | 1 | other |  |
|  | kielbasa | 1 | other |  |
|  | knafeh | 1 | other |  |
|  | leaves of summer savoury | 1 | other |  |
|  | lillet | 1 | other |  |
|  | lime vodka | 1 | spirit | `vodka` |
|  | little gem lettuce | 1 | vegetable | `gem lettuce` |
|  | mackerel | 1 | other |  |
|  | madras paste | 1 | other |  |
|  | malai | 1 | other |  |
|  | manchego | 1 | other |  |
|  | marinated tofu | 1 | other | `tofu` |
|  | mars bar | 1 | other |  |
|  | massaman curry paste | 1 | other | `curry paste` |
|  | mature cheddar | 1 | dairy | `cheddar` |
|  | mint syrup | 1 | herb | `mint` |
|  | mixed beef cut | 1 | protein | `beef` |
|  | mixed berrie | 1 | fruit | `mixed berry` |
|  | mixed grain | 1 | other |  |
|  | morcilla | 1 | other |  |
|  | mountain dew | 1 | other |  |
|  | mulukhiyah | 1 | other |  |
|  | muskmallow | 1 | other |  |
|  | nuttall cockle | 1 | other |  |
|  | olive brine | 1 | vegetable | `olive` |
|  | ouzo | 1 | other |  |
|  | oxtail | 1 | other |  |
|  | paccheri pasta | 1 | grain | `pasta` |
|  | panang curry paste | 1 | other | `curry paste` |
|  | parmigiano-reggiano | 1 | other |  |
|  | passion fruit syrup | 1 | sweetener | `passion fruit` |
|  | peach brandy | 1 | spirit | `brandy` |
|  | peach nectar | 1 | fruit | `peach` |
|  | peach vodka | 1 | spirit | `peach` |
|  | peachtree schnapp | 1 | other | `peach schnapp` |
|  | peanut cookie | 1 | nut | `peanut` |
|  | penne rigate | 1 | other |  |
|  | pernod | 1 | other |  |
|  | petit poi | 1 | other |  |
|  | peychaud bitter | 1 | other | `bitter` |
|  | pilchard | 1 | other |  |
|  | pina colada mix | 1 | other |  |
|  | pink food colouring | 1 | other |  |
|  | pisang ambon | 1 | other |  |
|  | pistachio paste | 1 | nut | `pistachio` |
|  | pitted black olive | 1 | vegetable | `black olive` |
|  | pitted date | 1 | fruit | `date` |
|  | plum jam | 1 | fruit | `plum` |
|  | polish kabano | 1 | other |  |
|  | pork knuckle | 1 | protein | `pork` |
|  | pork shoulder steak | 1 | protein | `pork shoulder` |
|  | porridge oat | 1 | grain | `oat` |
|  | purple sprouting broccoli | 1 | vegetable | `broccoli` |
|  | ready rolled shortcrust pastry | 1 | baked | `shortcrust pastry` |
|  | red chillie | 1 | other | `red chilie` |
|  | red snapper | 1 | protein | `fish` |
|  | red wine jelly | 1 | liquid | `red wine` |
|  | redcurrant | 1 | other | `currant` |
|  | refried bean | 1 | vegetable | `bean` |
|  | rice flour pancake | 1 | thickener | `rice flour` |
|  | rigatoni | 1 | other |  |
|  | ringed seal | 1 | other |  |
|  | rosso vermouth | 1 | bitters | `vermouth` |
|  | sarsaparilla | 1 | other |  |
|  | sazon | 1 | other |  |
|  | seasoned rice vinegar | 1 | acid | `rice vinegar` |
|  | semolina flour | 1 | thickener | `flour` |
|  | sevaiiya | 1 | other |  |
|  | shelled hazelnut | 1 | nut | `hazelnut` |
|  | sirup of rose | 1 | other |  |
|  | smoked flaked salmon | 1 | protein | `salmon` |
|  | smoked salmon | 1 | protein | `salmon` |
|  | smoky aïoli | 1 | other |  |
|  | soured cream and chive dip | 1 | dairy | `soured cream` |
|  | soya bean | 1 | vegetable | `bean` |
|  | speculaas spice mix | 1 | other | `spice` |
|  | st. germain | 1 | other |  |
|  | steller sea lion | 1 | other |  |
|  | stoned date | 1 | fruit | `date` |
|  | storax | 1 | other |  |
|  | stout | 1 | other |  |
|  | strawberry schnapp | 1 | fruit | `strawberry` |
|  | strong white flour | 1 | thickener | `white flour` |
|  | strong wholemeal flour | 1 | thickener | `wholemeal flour` |
|  | sultana | 1 | other | `raisin` |
|  | sun- tomatoe | 1 | vegetable | `tomatoe` |
|  | sweet peppadew pepper | 1 | chili | `peppadew pepper` |
|  | sweet sherry | 1 | other | `wine` |
|  | sweetened condensed milk | 1 | dairy | `milk` |
|  | tamarind ball | 1 | acid | `tamarind` |
|  | tempeh | 1 | other |  |
|  | thai fish sauce | 1 | protein | `fish sauce` |
|  | tia maria | 1 | other |  |
|  | toast | 1 | other |  |
|  | toffee popcorn | 1 | confection | `popcorn` |
|  | toor dal | 1 | other |  |
|  | turkey mince | 1 | protein | `turkey` |
|  | turkish delight | 1 | other |  |
|  | unflavoured gelatin | 1 | dairy | `gelatin` |
|  | unsalted beef stock | 1 | protein | `beef stock` |
|  | unwaxed lemon | 1 | citrus | `lemon` |
|  | unwaxed lime | 1 | citrus | `lime` |
|  | vegan white wine vinegar | 1 | acid | `white wine vinegar` |
|  | vine leave | 1 | other |  |
|  | vine tomatoe | 1 | vegetable | `tomatoe` |
|  | walru | 1 | other |  |
|  | white asparagu | 1 | other |  |
|  | white bread mix | 1 | grain | `bread mix` |
|  | white fish fillet | 1 | protein | `fish fillet` |
|  | white sauerkraut | 1 | other |  |
|  | wholegrain bread | 1 | grain | `grain bread` |
|  | wild garlic leave | 1 | aromatic | `garlic` |
|  | wonton skin | 1 | other |  |
|  | wood ear mushroom | 1 | vegetable | `mushroom` |
|  | wormwood | 1 | other |  |
|  | yarrow | 1 | other |  |
|  | yellow food colouring | 1 | other |  |
|  | yellow masarepa | 1 | other |  |
|  | yukon jack | 1 | other |  |
