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
| r | vegetable oil | 147030 | fat | `vegetable` |
| r | breadcrumb | 20871 | thickener | `bread crumb` |
| r | semi-sweet chocolate chip | 12285 | sweetener | `semi-sweet chocolate` |
| r | rolled oat | 10386 | grain | `oat` |
| r | mixed vegetable | 6017 | other | `vegetable` |
| r | pie shell | 5569 | baked | `pie` |
| r | pecan halve | 5381 | nut | `pecan` |
| r | chile | 5102 | chili | `chilie` |
| r | green chile | 4710 | chili | `green chilie` |
| r | yellow squash | 4686 | vegetable | `squash` |
| r | crab meat | 4421 | protein | `crab` |
|  | corn meal | 3609 | vegetable | `corn` |
| r | vegetable cooking spray | 2929 | other | `vegetable` |
| r | flax seed | 2567 | nut | `flaxseed` |
| r | light mayonnaise | 2375 | condiment | `mayonnaise` |
| r | cornflake | 2232 | other | `corn flake` |
| r | red chile | 2160 | chili | `red chilie` |
| r | chile powder | 2068 | chili | `chili powder` |
|  | pickling spice | 1939 | other | `spice` |
| r | serrano chile | 1813 | chili | `serrano chilie` |
|  | red curry | 1768 | other | `curry` |
| r | cooking oat | 1663 | grain | `oat` |
|  | corn bread | 1599 | grain | `bread` |
|  | red lentil | 1581 | other | `lentil` |
|  | corn starch | 1460 | vegetable | `corn` |
| r | ham hock | 1423 | protein | `ham` |
| r | miracle whip | 1237 | other | `mayonnaise` |
| r | mixed spice | 1179 | other | `spice` |
| r | quick-cooking oat | 1151 | grain | `oat` |
| r | vegetable oil cooking spray | 1142 | fat | `vegetable` |
| r | chipotle chile | 1127 | chili | `chipotle chilie` |
| r | low-fat mayonnaise | 1119 | condiment | `mayonnaise` |
| r | italian seasoned breadcrumb | 1105 | thickener | `italian seasoned bread crumb` |
| r | lemon jell-o | 1060 | citrus | `lemon` |
| r | deli ham | 1056 | protein | `ham` |
|  | soy milk | 1026 | dairy | `milk` |
| r | dish pie shell | 1011 | baked | `pie` |
| r | long grain white rice | 991 | grain | `grain white rice` |
|  | red-wine vinegar | 990 | acid | `wine vinegar` |
| r | old-fashioned oat | 980 | grain | `oat` |
| r | poblano chile | 976 | chili | `poblano chilie` |
| r | ham bone | 932 | protein | `ham` |
| r | mixed fruit | 913 | other | `fruit` |
| r | mixed herb | 862 | other | `herb` |
|  | yellow corn meal | 860 | vegetable | `yellow corn` |
|  | chipotle powder | 824 | chili | `chili powder` |
| r | orange jell-o | 809 | citrus | `orange` |
| r | lemon grass | 797 | citrus | `lemongrass` |
|r  | freshly parmesan | 792 | dairy | `parmesan` |
| r | vegetable oil spray | 773 | fat | `vegetable` |
| r | unbaked pie shell | 757 | baked | `pie` |
|  | brown lentil | 741 | other | `lentil` |
| r | aubergine | 740 | other | `eggplant` |
| r | chilli powder | 712 | chili | `chili powder` |
| r | strawberry jell-o | 702 | fruit | `strawberry` |
| r | nut meat | 676 | other | `nutmeat` |
| r | cayenne powder | 649 | chili | `cayenne pepper` |
| r | extravirgin olive oil | 646 | fat | `olive oil` |
| r | pie spice | 644 | baked | `spice` |
| r | -grain mustard | 638 | condiment | `grain mustard` |
| r | cream style corn | 636 | dairy | `corn` |
|  | white-wine vinegar | 625 | acid | `wine vinegar` |
|  | candied fruit | 615 | other | `fruit` |
| r | dressing mix | 598 | condiment | `dressing` |
| r | spice powder | 595 | other | `spice` |
| r | cornflake crumb | 561 | other | `corn flake crumb` |
| r | italian breadcrumb | 558 | thickener | `italian bread` |
| r | mayonaise | 552 | condiment | `mayonnaise` |
| r | duck breast | 549 | protein | `duck` |
| r | regular oat | 541 | grain | `oat` |
| r | fully cooked ham | 538 | protein | `ham` |
| r | extra-lean beef | 532 | protein | `lean beef` |
|  | corn flour | 501 | thickener | `flour` |
| r | chick pea | 488 | vegetable | `chickpea` |
|  | green curry | 484 | other | `curry` |
| r | ham steak | 470 | protein | `ham` |
| r | rum flavoring | 470 | spirit | `rum` |
| r | curry pwdr | 463 | other | `curry` |
| r | italian dressing mix | 463 | condiment | `italian dressing` |
| r | -berry | 454 | fruit | `berry` |
| r | kiwifruit | 448 | other | `kiwi fruit` |
|  | vegetable bouillon cube | 435 | other | `vegetable` |
| r | country ham | 431 | protein | `ham` |
| r | red leaf | 425 | other | `leaf` |
| r | cacao powder | 410 | other | `cocoa` |
| r | mixed candied fruit | 399 | other | `fruit` |
|  | italian spice | 398 | other | `spice` |
| r | red-pepper | 398 | chili | `red pepper` |
| r | 's white chocolate | 397 | sweetener | `white chocolate` |
| r | campbell's tomato soup | 390 | vegetable | `tomato soup` |
| r | semi sweet chocolate chip | 390 | sweetener | `sweet chocolate chip` |
| r | sweetcorn | 381 | other | `sweet corn` |
| r | lasagne noodle | 376 | grain | `lasagna noodle` |
| r | extra-virgin extra virgin olive oil | 369 | fat | `olive oil` |
| r | ancho chile powder | 368 | chili | `ancho chili powder` |
| r | italian herb seasoning | 353 | seasoning | `herb` |
| r | passionfruit | 348 | other | `passion fruit` |
| r | cinnamon-sugar | 343 | spice | `cinnamon` |
| r | chick-pea | 342 | vegetable | `chickpea` |
| r | vegetable bouillon | 342 | other | `vegetable` |
| r | solid white tuna | 328 | protein | `tuna` |
| r | ricotta salata | 310 | dairy | `ricotta` |
| r | italian herb | 308 | other | `herb` |
|  | ruby port | 304 | condiment | `port` |
| r | serrano ham | 300 | protein | `ham` |
| r | lime jell-o | 299 | citrus | `lime` |
| r | chile flake | 285 | chili | `chili flake` |
| r | lean ham | 277 | protein | `ham` |
| r | chile paste | 265 | chili | `chili paste` |
|  | summer squash | 253 | vegetable | `squash` |
|  | white cheddar | 253 | dairy | `cheddar` |
|  | scotch bonnet | 251 | chili | `chilie` |
| r | lump crab meat | 240 | protein | `lump crab` |
| r | white tuna | 228 | protein | `tuna` |
| r | dry lentil | 224 | other | `lentil` |
| r | herb dressing | 223 | condiment | `herb` |
| r | philadelphia original cream cheese | 223 | dairy | `cream cheese` |
| r | thin ham | 222 | protein | `ham` |
| r | chinese vegetable | 221 | other | `vegetable` |
| r | mixed italian herb | 221 | other | `herb` |
| r | duck fat | 218 | protein | `duck` |
| r | white shoe peg corn | 215 | vegetable | `shoe peg corn` |
| r | black currant | 213 | other | `currant` |
| r | vegetable stock cube | 213 | liquid | `vegetable stock` |
| r | vermicelli noodle | 212 | grain | `vermicelli` |
| r | beef processed | 209 | protein | `beef` |
| r | stone mustard | 209 | condiment | `mustard` |
|  | cognac brandy | 204 | spirit | `brandy` |
| r | ginger garlic | 203 | aromatic | `garlic` |
| r | malibu rum | 203 | spirit | `rum` |
| r | green leaf | 201 | other | `leaf` |
| r | teriyaki marinade | 201 | umami | `teriyaki` |
| r | graham wafer crumb | 200 | baked | `graham cracker crumb` |
| r | cornflakes cereal | 199 | grain | `corn flakes cereal` |
| r | italian style bread crumb | 198 | grain | `bread crumb` |
| r | semisweet chocolate morsel | 195 | sweetener | `chocolate morsel` |
| r | boiled ham | 189 | protein | `ham` |
|  | sherry | 189 | other | `wine` |
|r  | sugar + | 189 | sweetener | `sugar` |
| r | wheat breadcrumb | 188 | thickener | `wheat bread` |
| r | wish-bone italian dressing | 188 | condiment | `italian dressing` |
| r | cake pan | 187 | baked | `cake` |
| r | vanilla low-fat yogurt | 184 | dairy | `low-fat yogurt` |
| r | -milk | 183 | dairy | `milk` |
| r | white bread crumb | 183 | grain | `bread crumb` |
| r | italian-seasoned breadcrumb | 181 | thickener | `italian seasoned bread crumb` |
|r  | bird chile | 179 | chili | `chilie` |
|r  | black forest ham | 179 | protein | `ham` |
| r | flour + | 178 | thickener | `flour` |
| r | red chilli powder | 176 | chili | `red chili powder` |
| r | whitefish | 175 | other | `white fish` |
| r | short grain rice | 170 | grain | `grain rice` |
| r | white corn meal | 169 | vegetable | `white corn` |
| r | parma ham | 168 | protein | `ham` |
| r | kabocha squash | 166 | vegetable | `squash` |
| r | pinenut | 166 | other | `pine nut` |
| r | cashew halve | 158 | nut | `cashew` |
| r | fines herbe | 158 | other | `herbe` |
| r | nonfat mayonnaise | 157 | condiment | `mayonnaise` |
|  | grape seed oil | 156 | fat | `vegetable` |
| r | long-grain brown rice | 156 | grain | `brown rice` |
| r | vegetable spray | 155 | other | `vegetable` |
| r | spice mix | 154 | other | `spice` |
| r | -wheat flour | 153 | thickener | `wheat flour` |
| r | campbell's cheddar cheese soup | 152 | dairy | `cheddar cheese soup` |
| r | duck leg | 150 | protein | `duck` |
| r | parmesan rind | 149 | dairy | `parmesan` |
| r | four-cheese | 148 | dairy | `four cheese` |
| r | asafetida powder | 147 | other | `asafoetida powder` |
| r | mozzarella ball | 147 | dairy | `mozzarella` |
| r | baby caper | 146 | vegetable | `caper` |
| r | low fat milk | 146 | dairy | `milk` |
| r | anise | 145 | other | `aniseed` |
| r | golden rum | 145 | spirit | `rum` |
| r | mayonnaise dressing | 145 | condiment | `mayonnaise` |
| r | red chile powder | 143 | chili | `red chili powder` |
| r | red currant | 143 | other | `currant` |
| r | anaheim chile | 141 | chili | `anaheim chilie` |
| r | semi sweet chocolate | 141 | sweetener | `sweet chocolate` |
| r | pot roast | 140 | protein | `beef` |
| r | sunflower | 140 | nut | `sunflower seed` |
| r | light oil | 139 | fat | `vegetable` |
| r | safflower | 138 | other | `safflower oil` |
|  | soy bean | 137 | vegetable | `bean` |
|  | sour cherry | 136 | fruit | `cherry` |
| r | instant oat | 134 | grain | `oat` |
| r | graham crust | 133 | baked | `graham pie crust` |
| r | drizzle of olive oil | 132 | fat | `olive oil` |
| r | strawberry wine | 132 | liquid | `strawberry` |
| r | pie cherrie | 131 | baked | `pie` |
| r | cured ham | 129 | protein | `ham` |
| r | musk melon | 129 | fruit | `melon` |
| r | cook oat | 128 | grain | `oat` |
| r | italian style tomatoe | 128 | vegetable | `tomatoe` |
| r | olive oil + | 128 | fat | `olive oil` |
| r | other cheese | 128 | dairy | `cheese` |
| r | all spice | 126 | other | `spice` |
| r | comte cheese | 126 | dairy | `cheese` |
|  | five spice powder | 125 | spice | `spice` |
| r | freshly-grnd black pepper | 125 | chili | `grnd black pepper` |
| r | vanilla low- | 125 | spice | `vanilla` |
| r | mayonnai | 124 | condiment | `mayonnaise` |
| r | parmesan shaving | 124 | dairy | `parmesan` |
| r | extra virgin extra virgin olive oil | 123 | fat | `olive oil` |
| r | mixed peel | 123 | other | `peel` |
| r | fruit filling | 122 | other | `fruit` |
| r | russian cheese | 122 | dairy | `cheese` |
| r | chile oil | 121 | fat | `chili oil` |
| r | mixed pickling spice | 121 | other | `spice` |
| r | regular rolled oat | 121 | grain | `oat` |
| r | cooked ham | 120 | protein | `ham` |
| r | rocket salad | 119 | other | `rocket` |
| r | white crab meat | 119 | protein | `crab` |
| r | ginger snap | 118 | aromatic | `ginger` |
| r | sheep cheese | 116 | dairy | `cheese` |
| r | 's bittersweet chocolate | 115 | sweetener | `sweet chocolate` |
| r | black eyed pea | 115 | vegetable | `black-eyed pea` |
| r | cinnamon raisin bread | 115 | spice | `raisin bread` |
| r | bourbon whisky | 114 | spirit | `bourbon` |
| r | campbell's golden mushroom soup | 114 | vegetable | `golden mushroom soup` |
| r | domiati cheese | 114 | dairy | `cheese` |
| r | emmental cheese | 114 | dairy | `emmentaler cheese` |
| r | mission fig | 114 | fruit | `fig` |
| r | tilsit cheese | 114 | dairy | `cheese` |
| r | munster cheese | 113 | dairy | `muenster cheese` |
| r | orange flavored liqueur | 113 | liqueur | `orange flavored` |
|  | candied pecan | 112 | nut | `pecan` |
|r  | corn- | 111 | vegetable | `corn` |
|  | black lentil | 109 | other | `lentil` |
| r | hanout spice mix | 109 | other | `spice` |
| r | pecan chip | 107 | nut | `pecan` |
| r | bitter cherry | 106 | fruit | `cherry` |
| r | italian-seasoned bread crumb | 106 | grain | `bread crumb` |
| r | vegetable stock powder | 106 | liquid | `vegetable stock` |
| r | light tuna | 105 | protein | `tuna` |
| r | no sugar | 105 | sweetener | `no-sugar` |
| r | -milk ricotta cheese | 104 | dairy | `milk ricotta cheese` |
| r | apple - | 104 | fruit | `apple` |
| r | corn bread crumb | 104 | grain | `bread crumb` |
| r | campbell's beef | 103 | protein | `beef` |
|  | chinese five spice | 102 | spice | `spice` |
| r | puy lentil | 101 | other | `lentil` |
| r | -milk ricotta | 100 | dairy | `milk ricotta` |
| r | -milk yogurt | 100 | dairy | `milk yogurt` |
| r | -squeezed lemon juice | 100 | citrus | `squeezed lemon juice` |
| r | japanese pumpkin | 100 | other | `pumpkin` |
|  | mung bean | 100 | vegetable | `bean` |
| r | poppyseed | 100 | nut | `poppy seed` |
|  | yellow lentil | 100 | other | `lentil` |
| r | orange-flower water | 99 | citrus | `orange` |
| r | pork spare rib | 99 | protein | `pork` |
| r | boiling- water | 98 | liquid | `boiling water` |
| r | redskin onion | 98 | aromatic | `onion` |
| r | corn bread stuffing | 97 | grain | `bread stuffing` |
| r | italian-style bread crumb | 97 | grain | `bread crumb` |
| r | mexican oregano | 97 | herb | `oregano` |
| r | virginia ham | 96 | protein | `ham` |
| r | butter milk | 95 | fat | `buttermilk` |
| r | full fat coconut milk | 95 | dairy | `coconut milk` |
| r | pie dough | 95 | baked | `pie` |
| r | black mulberry | 94 | fruit | `berry` |
| r | cherry tomato | 94 | vegetable | `tomatoe` |
| r | european chestnut | 94 | nut | `chestnut` |
| r | hard wheat | 94 | grain | `wheat` |
| r | malabar spinach | 94 | vegetable | `spinach` |
| r | nanking cherry | 94 | fruit | `cherry` |
| r | oriental wheat | 94 | grain | `wheat` |
|  | rowanberry | 94 | fruit | `berry` |
| r | saskatoon berry | 94 | fruit | `berry` |
| r | welsh onion | 94 | aromatic | `onion` |
| r | black crowberry | 93 | fruit | `berry` |
| r | chinese chestnut | 93 | nut | `chestnut` |
| r | corn salad | 93 | vegetable | `corn` |
| r | hedge mustard | 93 | condiment | `mustard` |
| r | herb dressing mix | 93 | condiment | `herb` |
| r | horned melon | 93 | fruit | `melon` |
| r | hyacinth bean | 93 | vegetable | `bean` |
| r | japanese chestnut | 93 | nut | `chestnut` |
| r | malabar plum | 93 | fruit | `plum` |
| r | mammee apple | 93 | fruit | `apple` |
| r | moth bean | 93 | vegetable | `bean` |
| r | natal plum | 93 | fruit | `plum` |
| r | new zealand spinach | 93 | vegetable | `spinach` |
| r | ohelo berry | 93 | fruit | `berry` |
| r | scarlet bean | 93 | vegetable | `bean` |
| r | swamp cabbage | 93 | vegetable | `cabbage` |
| r | winged bean | 93 | vegetable | `bean` |
|  | winter squash | 93 | vegetable | `squash` |
| r | yardlong bean | 93 | vegetable | `long bean` |
| r | annual wild rice | 92 | grain | `wild rice` |
| r | beansprout | 92 | other | `bean sprout` |
| r | buffalo currant | 92 | other | `currant` |
| r | climbing bean | 92 | vegetable | `bean` |
| r | jostaberry | 92 | fruit | `berry` |
| r | kentucky bourbon | 92 | spirit | `bourbon` |
| r | muscadine grape | 92 | fruit | `grape` |
| r | pineappple sage | 92 | herb | `sage` |
| r | red rice | 92 | grain | `rice` |
| r | skunk currant | 92 | other | `currant` |
| r | tartary buckwheat | 92 | baked | `buckwheat` |
| r | crookneck squash | 91 | vegetable | `squash` |
| r | black mussel | 89 | protein | `mussel` |
| r | vegetable bouillon granule | 89 | other | `vegetable` |
| r | passionfruit pulp | 88 | other | `passion fruit pulp` |
|  | vanilla soymilk | 88 | spice | `soymilk` |
| r | yellow curry | 88 | other | `curry` |
| r | corn bread stuffing mix | 87 | grain | `bread stuffing mix` |
| r | veg-all vegetable | 87 | other | `vegetable` |
| r | campbell's condensed cream | 86 | dairy | `condensed cream` |
| r | tightly baby spinach leave | 86 | vegetable | `baby spinach leave` |
| r | vegetable mix | 86 | other | `vegetable` |
| r | vegetable-oil cooking spray | 86 | fat | `vegetable` |
| r | seasons italian dressing | 84 | condiment | `italian dressing` |
| r | vegan mayonnaise | 83 | condiment | `mayonnaise` |
| r | light italian dressing | 82 | condiment | `dressing` |
| r | vegetable or chicken | 82 | protein | `vegetable` |
| r | non-fat vanilla yogurt | 81 | dairy | `vanilla yogurt` |
| r | campbell's pork | 80 | protein | `pork` |
| r | country style pork rib | 79 | protein | `pork rib` |
| r | ham shank | 79 | protein | `ham` |
| r | mayonaisse | 79 | condiment | `mayonnaise` |
| r | soy mayonnaise | 79 | condiment | `mayonnaise` |
|  | apple-cider vinegar | 78 | acid | `cider vinegar` |
| r | bottles champagne | 78 | liquid | `champagne` |
| r | ham cooked | 78 | protein | `ham` |
| r | light chunk tuna | 78 | protein | `tuna` |
| r | kraft classic caesar dressing | 76 | condiment | `caesar dressing` |
| r | vegetable seasoning | 76 | seasoning | `vegetable` |
| r | egg mayonnaise | 75 | protein | `mayonnaise` |
| r | ham stock | 75 | protein | `ham` |
| r | plum brandy | 75 | spirit | `brandy` |
| r | candied peel | 74 | other | `peel` |
| r | cherry jell-o | 74 | fruit | `cherry` |
| r | chocolate-hazelnut spread | 74 | nut | `chocolate` |
| r | fruit jam | 74 | sweetener | `fruit` |
| r | philadelphia light cream cheese | 74 | dairy | `light cream cheese` |
| r | vanilla fat- | 74 | spice | `vanilla` |
| r | 's sweet chocolate | 73 | sweetener | `sweet chocolate` |
| r | kraft classic mayonnaise | 73 | condiment | `mayonnaise` |
| r | ranch dressing mix | 73 | condiment | `ranch dressing` |
| r | short grain brown rice | 73 | grain | `brown rice` |
| r | a spice mill | 72 | other | `spice` |
| r | campbell's beef broth | 72 | protein | `beef` |
| r | fruit punch | 72 | liquid | `fruit` |
| r | vegetable blend | 71 | other | `vegetable` |
| r | vegetable protein | 71 | other | `vegetable` |
| r | fruit bit | 70 | other | `fruit` |
| r | piquillo peppers | 70 | chili | `piquillo pepper` |
| r | shaved ham | 70 | protein | `ham` |
| r | italian tuna | 69 | protein | `tuna` |
| r | baking molasse | 68 | sweetener | `molasse` |
| r | fried potato | 68 | vegetable | `potato` |
| r | herb seasoning | 68 | seasoning | `herb` |
| r | light mayo | 68 | condiment | `mayo` |
| r | lite mayonnaise | 68 | condiment | `mayonnaise` |
| r | spice rub | 68 | condiment | `spice` |
| r | tropical fruit | 68 | other | `fruit` |
| r | favorite fruit | 67 | other | `fruit` |
| r | ham cube | 67 | protein | `ham` |
| r | milk + | 67 | dairy | `milk` |
| r | thin deli ham | 67 | protein | `ham` |
| r | tumeric powder | 67 | other | `turmeric` |
| r | your favorite barbecue sauce | 67 | condiment | `barbecue sauce` |
| r | crumbled feta | 66 | dairy | `feta` |
| r | jumbo lump crab meat | 66 | protein | `lump crab` |
| r | vegetable flake | 66 | other | `vegetable` |
| r | fluid bourbon | 65 | spirit | `bourbon` |
| r | regular mayonnaise | 65 | condiment | `mayonnaise` |
| r | smoked ham | 65 | protein | `ham` |
| r | ichimi spice | 63 | other | `spice` |
| r | lean hamburg | 63 | protein | `hamburg` |
| r | philadelphia neufchatel cheese | 63 | dairy | `neufchatel cheese` |
| r | barbecue spice | 62 | other | `spice` |
| r | black fig | 62 | fruit | `fig` |
| r | extra lean turkey | 62 | protein | `lean turkey` |
| r | coarse-grain mustard | 61 | condiment | `grain mustard` |
| r | cookie crust | 61 | baked | `cookie pie crust` |
| r | kraft classic ranch dressing | 61 | condiment | `ranch dressing` |
| r | low fat sour cream | 60 | dairy | `cream` |
| r | chicken-flavor | 59 | protein | `chicken` |
| r | butter + | 58 | fat | `butter` |
| r | leftover ham | 58 | protein | `ham` |
| r | monde spice | 58 | other | `spice` |
| r | no salt | 58 | seasoning | `no-salt` |
| r | pickle spice | 58 | vegetable | `spice` |
| r | pork loin chops with bone | 58 | protein | `pork loin chop` |
| r | seedless red | 58 | nut | `grape` |
| r | steamed vegetable | 58 | other | `vegetable` |
| r | sweet curry | 58 | other | `curry` |
| r | wholewheat bread | 58 | grain | `wheat bread` |
| r | -kernel corn | 57 | vegetable | `kernel corn` |
| r | backfin crab meat | 57 | protein | `crab` |
| r | citrus peel oil | 57 | fat | `peel` |
| r | lemon lime soda | 57 | citrus | `lime soda` |
| r | stone cornmeal | 57 | thickener | `cornmeal` |
| r | textured vegetable protein | 57 | other | `vegetable` |
| r | chunk light tuna | 56 | protein | `tuna` |
| r | cooked lentil | 56 | other | `lentil` |
| r | golden italian dressing | 56 | condiment | `italian dressing` |
| r | mashed fig | 56 | fruit | `fig` |
| r | yeast roll | 56 | baked | `bread` |
| r | cardamon seed | 55 | nut | `cardamom seed` |
| r | chili-garlic | 55 | chili | `garlic` |
| r | -squeezed orange juice | 54 | citrus | `squeezed orange juice` |
| r | assorted fruit | 54 | other | `fruit` |
| r | assorted vegetable | 54 | other | `vegetable` |
| r | blackberry brandy | 54 | spirit | `blackberry` |
| r | chilli paste | 54 | chili | `chili paste` |
| r | ripe fig | 54 | fruit | `fig` |
| r | vanilla low-fat | 54 | spice | `vanilla` |
| r | baby zucchini | 53 | vegetable | `zucchini` |
| r | beef-flavor | 53 | protein | `beef` |
| r | campbell's mushroom soup | 53 | vegetable | `mushroom soup` |
| r | fluid gin | 53 | spirit | `gin` |
| r | hormel chunk ham | 53 | protein | `ham` |
| r | jeera powder | 53 | other | `cumin` |
| r | kraft lite raspberry vinaigrette dressing | 53 | fruit | `raspberry vinaigrette` |
| r | polly-o original ricotta cheese | 53 | dairy | `ricotta` |
| r | stir-fry vegetable | 53 | other | `vegetable` |
| r | weinbrand brandy | 53 | spirit | `brandy` |
|  | chocolate hazelnut | 52 | nut | `chocolate` |
| r | lemon-flavored gelatin | 52 | citrus | `flavored gelatin` |
| r | nama shoyu | 52 | other | `shoyu` |
| r | non-fat milk | 52 | dairy | `milk` |
| r | piecrust | 52 | baked | `pie crust` |
| r | raspberry brandy | 52 | spirit | `raspberry` |
| r | anise brandy | 51 | spirit | `brandy` |
| r | armagnac brandy | 51 | spirit | `brandy` |
| r | crust pie | 51 | baked | `pie` |
| r | hormel ham | 51 | protein | `ham` |
| r | light vegetable oil | 51 | fat | `vegetable` |
| r | non-fat yogurt | 51 | dairy | `yogurt` |
| r | nonstick vegetable cooking spray | 51 | other | `vegetable` |
| r | papaya brandy | 51 | spirit | `brandy` |
| r | chicken flavored ramen noodle | 50 | protein | `chicken flavor` |
| r | coleslaw dressing | 50 | condiment | `coleslaw` |
| r | cream of mushroom soup or cream of chicken soup | 50 | dairy | `cream of mushroom soup` |
| r | curry leaves | 50 | herb | `curry` |
| r | duck stock | 50 | protein | `duck` |
| r | long red chile | 50 | chili | `long red chilie` |
| r | mein vegetable | 50 | other | `vegetable` |
| r | nonpareil caper | 50 | vegetable | `caper` |
| r | red fruit | 50 | other | `fruit` |
| r | red chilli | 48 | chili | `red chili` |
| r | clary sage | 43 | herb | `sage` |
| r | citrus fruit | 42 | citrus | `fruit` |
| r | fatty fish | 38 | protein | `fish` |
| r | turkey berry | 38 | protein | `berry` |
| r | white currant | 37 | other | `currant` |
| r | lemon peel oil | 36 | fat | `lemon` |
| r | scotch spearmint | 36 | spirit | `mint` |
| r | wheaten bread | 30 | grain | `bread` |
|  | fish oil | 23 | fat | `fish` |
| r | mandarin orange peel oil | 23 | fat | `mandarin orange` |
| r | bitter orange | 22 | citrus | `orange` |
| r | spineless monkey orange | 20 | citrus | `orange` |
| r | soybean sauce | 19 | condiment | `bean sauce` |
| r | lean fish | 18 | protein | `fish` |
| r | lime peel oil | 16 | fat | `lime` |
| r | green chilli | 15 | chili | `green chili` |
| r | smoked fish | 15 | protein | `fish` |
| r | bomba rice | 14 | grain | `rice` |
| r | bantu beer | 13 | liquid | `beer` |
| r | grapefruit peel oil | 13 | fat | `grapefruit` |
| r | wild cherry | 13 | fruit | `cherry` |
| r | cluster bean | 12 | vegetable | `bean` |
| r | proof rum | 12 | spirit | `rum` |
| r | arabica coffee | 11 | liquid | `coffee` |
| r | courgette | 10 | other | `zucchini` |
| r | strawberrie | 10 | fruit | `strawberry` |
| r | anise hyssop | 9 | other |  |
| r | valerian | 9 | other |  |
| r | allium | 8 | other |  |
| r | egg plant | 8 | protein | `eggplant` |
| r | spanish sage | 8 | herb | `sage` |
| r | yoghurt | 8 | other | `yogurt` |
| r | baguette | 7 | other |  |
| r | blackberrie | 7 | fruit | `blackberry` |
| r | cashew apple | 7 | nut | `cashew` |
| r | challot | 7 | other | `shallot` |
| r | champaca | 7 | other |  |
| r | codfish | 7 | other | `cod fish` |
| r | creosote | 7 | other |  |
| r | pepino | 7 | other |  |
| r | raspberrie | 7 | fruit | `raspberry` |
| r | red sage | 7 | herb | `sage` |
| r | sassafra | 7 | other |  |
| r | sweet and sour | 7 | other |  |
| r | bakery product | 6 | other |  |
| r | cajeput | 6 | other |  |
| r | chambord raspberry liqueur | 6 | liqueur | `raspberry liqueur` |
| r | chilli | 6 | chili | `chili` |
|  | galliano | 6 | other |  |
|  | garcinia indica | 6 | other |  |
|  | haddock | 6 | other |  |
| r | sirloin steak | 6 | protein | `beef` |
| r | woodapple | 6 | other |  |
| r | arrack | 5 | other |  |
| r | birds-eye chillie | 5 | other |  |
| r | chilli flake | 5 | chili | `chili flake` |
| r | common tuna | 5 | protein | `tuna` |
|  | creme de cacao | 5 | other |  |
|  | creme de cassi | 5 | other |  |
| r | gelatin dessert | 5 | dairy | `gelatin` |
| r | hummu | 5 | other |  |
|  | leavening agent | 5 | other |  |
| r | malay apple | 5 | fruit | `apple` |
| r | other dish | 5 | other |  |
| r | other fish product | 5 | protein | `fish` |
| r | other snack food | 5 | other |  |
|  | pate | 5 | other |  |
|  | pheasant | 5 | other |  |
| r | pizza | 5 | other |  |
| r | satsuma orange | 5 | citrus | `orange` |
| r | soft drink | 5 | other |  |
|  | spaghetti | 5 | other |  |
|  | atlantic salmon | 4 | protein | `salmon` |
| r | atlantic wolffish | 4 | other |  |
| r | bagel | 4 | other |  |
| r | bearded seal | 4 | other |  |
| r | beluga whale | 4 | other |  |
| r | berry wine | 4 | liquid | `berry` |
| r | breakfast sandwich | 4 | other |  |
| r | burrito | 4 | other |  |
| r | caribou | 4 | other |  |
| r | chinook salmon | 4 | protein | `salmon` |
| r | chocolate spread | 4 | sweetener | `chocolate` |
| r | chum salmon | 4 | protein | `salmon` |
| r | cichlidae | 4 | other |  |
| r | clupeinae | 4 | other |  |
| r | common ling | 4 | other |  |
| r | common octopu | 4 | other |  |
| r | corn grit | 4 | vegetable | `corn` |
| r | crown royal | 4 | other |  |
| r | cut | 4 | other |  |
| r | deer | 4 | other |  |
|  | elderflower cordial | 4 | other |  |
| r | flatfish | 4 | other | `fish` |
|  | focaccia | 4 | other |  |
| r | frankfurter sausage | 4 | protein | `sausage` |
| r | french toast | 4 | other |  |
|  | goat milk | 4 | dairy | `goat` |
| r | gruyère | 4 | other | `gruyere` |
| r | horse | 4 | other |  |
| r | lasagna | 4 | other |  |
| r | macaroni and cheese | 4 | dairy | `macaroni` |
|  | marzipan | 4 | other |  |
| r | midori melon liqueur | 4 | liqueur | `melon liqueur` |
| r | nacho | 4 | other |  |
| r | northern pike | 4 | other |  |
| r | nougat | 4 | other |  |
| r | ostrich | 4 | other |  |
| r | other bread product | 4 | grain | `bread` |
| r | other dessert | 4 | other |  |
| r | other meat product | 4 | other |  |
| r | other pasta dish | 4 | grain | `pasta` |
| r | other sandwich | 4 | other |  |
| r | passata | 4 | other | `tomato sauce` |
| r | perciforme | 4 | other |  |
| r | pot pie | 4 | baked | `pie` |
| r | potato puff | 4 | vegetable | `potato` |
| r | salmonidae | 4 | other |  |
|  | sauerkraut | 4 | other |  |
| r | sheefish | 4 | other | `fish` |
| r | snack bar | 4 | other |  |
| r | snail | 4 | other |  |
| r | squab | 4 | other |  |
| r | starch | 4 | other |  |
| r | stuffing | 4 | other |  |
| r | suet | 4 | other |  |
| r | taco | 4 | other |  |
|  | tamale | 4 | other |  |
| r | topping | 4 | other |  |
| r | true frog | 4 | other |  |
|  | turbot | 4 | other |  |
| r | vegetarian food | 4 | other |  |
| r | whiting | 4 | other |  |
|  | absinthe | 3 | other |  |
| r | alaska pollock | 3 | other |  |
| r | anatidae | 3 | other |  |
| r | anguilliforme | 3 | other |  |
| r | ani | 3 | other |  |
| r | arepa | 3 | other |  |
| r | bacardi limon | 3 | other |  |
| r | beaver | 3 | other |  |
| r | beli | 3 | other |  |
| r | bivalvia | 3 | other |  |
| r | blue whiting | 3 | other |  |
| r | brown bear | 3 | other |  |
| r | buffalo | 3 | other |  |
| r | carp bream | 3 | other |  |
| r | casein | 3 | other |  |
|  r| celeriac | 3 | other |  |
| r | cetacea | 3 | other |  |
| r | channel catfish | 3 | protein | `catfish` |
| r | charr | 3 | other |  |
| r | chewing gum | 3 | other |  |
| r | coho salmon | 3 | protein | `salmon` |
| r | columbidae | 3 | other |  |
| r | common dab | 3 | other |  |
|  | elk | 3 | other |  |
| r | emu | 3 | other |  |
| r | energy drink | 3 | other |  |
|  | everclear | 3 | other |  |
|  | falafel | 3 | other |  |
| r | flaked almond | 3 | nut | `almond` |
| r | fruit gum | 3 | other | `fruit` |
| r | gadiforme | 3 | other |  |
| r | garfish | 3 | other |  |
| r | goldschlager | 3 | other |  |
| r | half-and-half | 3 | other | `half and half` |
| r | hippoglossu | 3 | other |  |
| r | horchata | 3 | other |  |
| r | hushpuppy | 3 | other |  |
| r | ice cream cone | 3 | dairy | `ice cream` |
| r | jack daniel | 3 | other |  |
|  | jägermeister | 3 | other |  |
| r | kefir | 3 | dairy | `milk` |
| r | kool-aid | 3 | other |  |
| r | lasagne sheet | 3 | other |  |
| r | lemon sole | 3 | citrus | `fish` |
| r | lumpsucker | 3 | other |  |
| r | mallard duck | 3 | protein | `duck` |
| r | meat bouillon | 3 | other |  |
| r | meringue | 3 | other |  |
| r | moose | 3 | other |  |
| r | mountain hare | 3 | other |  |
| r | myrrh | 3 | other |  |
| r | norway haddock | 3 | other |  |
| r | norway pout | 3 | other |  |
| r | nutritional drink | 3 | other |  |
| r | opossum | 3 | other |  |
| r | orange spiral | 3 | citrus | `orange` |
| r | orgeat syrup | 3 | sweetener | `almond` |
| r | pacific ocean perch | 3 | other |  |
| r | pacific rockfish | 3 | other | `rockfish` |
| r | painted comber | 3 | other |  |
| r | pak choi | 3 | other |  |
| r | pan dulce | 3 | other |  |
|  | pikeperch | 3 | other |  |
| r | pleuronectidae | 3 | other |  |
| r | pollock | 3 | other |  |
| r | potato bread | 3 | grain | `potato` |
| r | pupusa | 3 | other |  |
|  | quail | 3 | other |  |
| r | quesadilla | 3 | other |  |
| r | raccoon | 3 | other |  |
| r | ravioli | 3 | other |  |
| r | remoulade | 3 | other |  |
| r | rock ptarmigan | 3 | other |  |
| r | salad | 3 | other |  |
| r | scombridae | 3 | other |  |
| r | scrapple | 3 | other |  |
|  | sheep milk | 3 | dairy | `milk` |
| r | sloe gin | 3 | spirit | `gin` |
| r | sour mix | 3 | other |  |
| r | southern comfort | 3 | other |  |
| r | spiny dogfish | 3 | other |  |
| r | spotted seal | 3 | other |  |
| r | spread | 3 | other |  |
| r | sprite | 3 | other |  |
| r | squirrel | 3 | other |  |
| r | sturgeon | 3 | other |  |
| r | true sole | 3 | other |  |
| r | up | 3 | other |  |
| r | waffle | 3 | other |  |
| r | white creme de menthe | 3 | other |  |
| r | wild boar | 3 | other |  |
| r | wild turkey | 3 | protein | `turkey` |
| r | ymer | 3 | other |  |
| r | zwieback | 3 | other |  |
| r | absolut citron | 2 | other | `vodka` |
| r | adobo | 2 | other |  |
| r | akutaq | 2 | other |  |
| r | albacore tuna | 2 | protein | `tuna` |
| r | american shad | 2 | other |  |
| r | ascidian | 2 | other |  |
| r | atlantic croaker | 2 | other |  |
| r | atlantic mackerel | 2 | other |  |
| r | atlantic menhaden | 2 | other |  |
| r | atlantic pollock | 2 | other |  |
| r | beef shin | 2 | protein | `beef` |
| r | beefalo | 2 | other |  |
| r | beverage alcolohic other | 2 | other |  |
| r | brown rice noodle | 2 | grain | `rice noodle` |
| r | cacao | 2 | other |  |
| r | cardomom | 2 | other | `cardamom` |
| r | cascarilla | 2 | other |  |
| r | ceriman | 2 | other |  |
| r | cherrie | 2 | other |  |
| r | cherry heering | 2 | fruit | `cherry` |
| r | chimichanga | 2 | other |  |
| r | cisco | 2 | other |  |
| r | cocktail | 2 | other |  |
| r | coco sugar | 2 | sweetener | `coconut sugar` |
| r | coffee mocha | 2 | liquid | `coffee` |
| r | common carp | 2 | other |  |
| r | corona | 2 | other | `beer` |
| r | cranberrie | 2 | fruit | `cranberry` |
|  | creme de banane | 2 | other |  |
| r | cusk | 2 | other |  |
| r | cuttlefish | 2 | other |  |
| r | damn | 2 | other |  |
| r | dark brown soft sugar | 2 | sweetener | `brown sugar` |
| r | dog | 2 | other |  |
| r | dolphin fish | 2 | protein | `fish` |
| r | dragée | 2 | other |  |
| r | dumpling | 2 | other |  |
| r | empanada | 2 | other |  |
| r | enchilada | 2 | other |  |
| r | european anchovy | 2 | other | `anchovy` |
| r | fir | 2 | other |  |
| r | fish burger | 2 | protein | `fish` |
| r | florida pompano | 2 | other |  |
| r | freshwater drum | 2 | other |  |
| r | freshwater eel | 2 | other |  |
| r | frybread | 2 | baked | `bread` |
| r | garlic bulb | 2 | aromatic | `garlic` |
| r | gefilte fish | 2 | protein | `fish` |
| r | gelatine leaf | 2 | dairy | `gelatine` |
| r | ginger cordial | 2 | aromatic | `ginger` |
| r | glace cherry | 2 | fruit | `cherry` |
| r | grass | 2 | other |  |
| r | greater sturgeon | 2 | other |  |
| r | green creme de menthe | 2 | other |  |
| r | green turtle | 2 | other |  |
|  | grouper | 2 | other |  |
| r | guinea hen | 2 | other |  |
| r | heart of palm | 2 | other |  |
| r | hispi cabbage | 2 | vegetable | `cabbage` |
| r | italian fennel sausage | 2 | protein | `sausage` |
|  | jamaican curry powder | 2 | spice | `curry powder` |
| r | junket | 2 | other |  |
| r | king mackerel | 2 | other |  |
|  | lager | 2 | other |  |
| r | lamb kidney | 2 | protein | `lamb` |
| r | leather chiton | 2 | other |  |
|  | lillet blanc | 2 | other |  |
| r | lingcod | 2 | other |  |
| r | meringue nest | 2 | other |  |
| r | milkfish | 2 | other |  |
| r | mincemeat | 2 | other |  |
| r | morchella | 2 | other |  |
| r | mule deer | 2 | other |  |
| r | muskrat | 2 | other |  |
|  | naan bread | 2 | grain | `bread` |
| r | napa cabbage | 2 | vegetable | `cabbage` |
| r | natto | 2 | other |  |
| r | natural yoghurt | 2 | other | `natural yogurt` |
| r | north pacific giant octopu | 2 | other |  |
| r | northern bluefin tuna | 2 | protein | `tuna` |
| r | ocean pout | 2 | other |  |
| r | pacific herring | 2 | other |  |
| r | pacific jack mackerel | 2 | other |  |
| r | passoa | 2 | other |  |
| r | peach bitter | 2 | fruit | `bitter` |
| r | pectin | 2 | other |  |
| r | percoidei | 2 | other |  |
| r | piki bread | 2 | grain | `bread` |
| r | plain chocolate | 2 | sweetener | `chocolate` |
| r | polar bear | 2 | other |  |
| r | potato gratin | 2 | vegetable | `potato` |
| r | pretzel | 2 | other |  |
| r | pul biber | 2 | other |  |
| r | rainbow smelt | 2 | other |  |
| r | red king crab | 2 | protein | `king crab` |
| r | red pepper paste | 2 | chili | `red pepper` |
| r | ricard | 2 | other |  |
| r | rice bread | 2 | grain | `bread` |
| r | rice paper sheet | 2 | grain | `rice paper` |
|  | roe | 2 | other |  |
| r | rosemary syrup | 2 | herb | `rosemary` |
| r | sablefish | 2 | other | `fish` |
| r | sandalwood | 2 | other |  |
| r | scup | 2 | other |  |
| r | seafood mix | 2 | other |  |
| r | sesame seed burger bun | 2 | nut | `sesame seed` |
|  | shark | 2 | other |  |
| r | sheepshead | 2 | other |  |
|  | smelt | 2 | other |  |
| r | spanish mackerel | 2 | other |  |
| r | spiny lobster | 2 | protein | `lobster` |
| r | spot croaker | 2 | other |  |
| r | striped mullet | 2 | other |  |
| r | succotash | 2 | other |  |
| r | surge | 2 | other |  |
| r | tapioca pearl | 2 | thickener | `pearl` |
| r | tilefish | 2 | other |  |
| r | tostada | 2 | other |  |
| r | trail mix | 2 | other |  |
| r | true seal | 2 | other |  |
| r | vanilla ice-cream | 2 | dairy | `vanilla` |
|  | walleye | 2 | other |  |
| r | whelk | 2 | other |  |
| r | white sucker | 2 | other | `fish` |
| r | wonton wrapper | 2 | other |  |
| r | yellowtail amberjack | 2 | other |  |
| r | zima | 2 | other |  |
| r | absolut kurant | 1 | other | `vodka` |
| r | absolut peppar | 1 | other | `vodka` |
| r | absolut vodka | 1 | spirit | `vodka` |
| r | achillea | 1 | other |  |
| r | ackee | 1 | other |  |
| r | advocaat | 1 | other |  |
| r | alaska blackfish | 1 | other |  |
| r | alpinia | 1 | other |  |
|  | amaro montenegro | 1 | other |  |
| r | ancho chillie | 1 | chili | `ancho chilie` |
|  | anisette | 1 | other |  |
|  | apfelkorn | 1 | other |  |
| r | añejo rum | 1 | spirit | `rum` |
| r | baby aubergine | 1 | other | `eggplant` |
| r | baby lettuce leave | 1 | vegetable | `lettuce leave` |
| r | baby pak koi | 1 | other |  |
| r | baby plum tomatoe | 1 | fruit | `tomatoe` |
| r | baby squid | 1 | protein | `squid` |
| r | baked bean | 1 | vegetable | `bean` |
|  | barramundi | 1 | other |  |
| r | beef cutlet | 1 | protein | `beef` |
| r | beef stock concentrate | 1 | protein | `beef stock` |
| r | beef stock cube | 1 | protein | `beef stock` |
|  | beef tomatoe | 1 | protein | `tomatoe` |
|  | biryani masala | 1 | other |  |
| r | bitter lemon | 1 | citrus | `lemon` |
| r | black bear | 1 | other |  |
|  | blackcurrant cordial | 1 | other |  |
|  | blackstrap rum | 1 | spirit | `rum` |
| r | blended scotch | 1 | spirit | `scotch` |
|  | blood orange | 1 | citrus | `orange` |
|  | bok choi | 1 | other |  |
| r | bouillon cube | 1 | other |  |
| r | bouquet garni | 1 | other |  |
| r | bowhead whale | 1 | other |  |
|  | broad whitefish | 1 | other |  |
| r | bun | 1 | other |  |
| r | byrsonima crassifolia | 1 | other |  |
| r | cabbage leave | 1 | vegetable | `cabbage` |
| r | cajun | 1 | other |  |
| r | callaloo | 1 | other |  |
| r | carbonated soft drink | 1 | other |  |
| r | casabe | 1 | other |  |
| r | cassaba | 1 | other |  |
| r | cedar | 1 | other |  |
| r | chicken wing | 1 | protein | `chicken` |
| r | chilli bean paste | 1 | chili | `bean paste` |
| r | chillie | 1 | other | `chilie` |
| r | chinese leaf | 1 | other | `leaf` |
| r | chinese long bean | 1 | vegetable | `long bean` |
| r | chinese sesame sauce | 1 | nut | `sesame` |
|  | ciabatta | 1 | other |  |
|  | coffee brandy | 1 | spirit | `brandy` |
|  | colby jack cheese | 1 | dairy | `jack cheese` |
| r | cooked beetroot | 1 | other | `beetroot` |
| r | cooked chestnut | 1 | nut | `chestnut` |
| r | corn arepa filled with mozarella cheese | 1 | dairy | `mozarella cheese` |
| r | cranberry vodka | 1 | spirit | `cranberry` |
| r | creamed corn | 1 | vegetable | `corn` |
| r | creme de mure | 1 | other |  |
| r | cubed feta cheese | 1 | dairy | `feta` |
| r | daiquiri mix | 1 | other |  |
|  | dark chocolate chip | 1 | sweetener | `chocolate chip` |
| r | dark soft brown sugar | 1 | sweetener | `brown sugar` |
| r | doner meat | 1 | other |  |
|  | doubanjiang | 1 | other |  |
|  | dubonnet rouge | 1 | other |  |
|  | dutch stroop | 1 | other |  |
|  | falernum | 1 | other |  |
|  | farfalle | 1 | other |  |
| r | feather blade beef | 1 | protein | `beef` |
|  | fermented black bean | 1 | vegetable | `bean` |
| r | fine yellow cornmeal | 1 | thickener | `cornmeal` |
| r | firewater | 1 | other |  |
| r | flat rice noodle | 1 | grain | `rice noodle` |
| r | free-range eggs beaten | 1 | other |  |
|  | freekeh | 1 | other |  |
| r | french lentil | 1 | other | `lentil` |
| r | fresca | 1 | other |  |
| r | frie | 1 | other |  |
| r | fried ripe banana | 1 | fruit | `ripe banana` |
|  | fromage frai | 1 | other |  |
| r | fruit mix | 1 | other | `fruit` |
| r | full fat sour cream | 1 | dairy | `sour cream` |
| r | full fat yogurt | 1 | dairy | `yogurt` |
| r | german sausage | 1 | protein | `sausage` |
| r | grain alcohol | 1 | other |  |
| r | grape soda | 1 | liquid | `grape` |
| r | green red lentil | 1 | other | `lentil` |
|  | guinness stout | 1 | other |  |
|  | hake | 1 | other |  |
| r | hard taco shell | 1 | other |  |
| r | hazlenut | 1 | other | `hazelnut` |
|  | herring | 1 | other |  |
| r | hind shank | 1 | other |  |
| r | islay single malt scotch | 1 | spirit | `scotch` |
| r | jagermeister | 1 | other |  |
| r | jello | 1 | dairy | `jelly` |
| r | jim beam | 1 | other | `whiskey` |
| r | kabanos sausage | 1 | protein | `sausage` |
| r | kabse spice | 1 | other | `spice` |
| r | khus khu | 1 | other |  |
|  | kielbasa | 1 | other |  |
| r | knafeh | 1 | other |  |
|  | leaves of summer savoury | 1 | other |  |
|  | lillet | 1 | other |  |
| r | lime vodka | 1 | spirit | `vodka` |
| r | little gem lettuce | 1 | vegetable | `gem lettuce` |
|  | mackerel | 1 | other |  |
|  | madras paste | 1 | other |  |
| r | malai | 1 | other |  |
|  | manchego | 1 | other |  |
| r | marinated tofu | 1 | other | `tofu` |
| r | mars bar | 1 | other |  |
|  | massaman curry paste | 1 | other | `curry paste` |
| r | mature cheddar | 1 | dairy | `cheddar` |
|  | mint syrup | 1 | herb | `mint` |
| r | mixed beef cut | 1 | protein | `beef` |
| r | mixed berrie | 1 | fruit | `mixed berry` |
| r | mixed grain | 1 | other |  |
|  | morcilla | 1 | other |  |
| r | mountain dew | 1 | other |  |
|  | mulukhiyah | 1 | other |  |
|  | musk mallow | 1 | other |  |
| r | nuttall cockle | 1 | other |  |
|  | olive brine | 1 | vegetable | `olive` |
|  | ouzo | 1 | other |  |
|  | oxtail | 1 | other |  |
| r | paccheri pasta | 1 | grain | `pasta` |
|  | panang curry paste | 1 | other | `curry paste` |
|  | parmigiano-reggiano | 1 | other |  |
| r | passion fruit syrup | 1 | sweetener | `passion fruit` |
|  | peach brandy | 1 | spirit | `brandy` |
|  | peach nectar | 1 | fruit | `peach` |
| r | peach vodka | 1 | spirit | `peach` |
| r | peachtree schnapp | 1 | other | `peach schnapp` |
| r | peanut cookie | 1 | nut | `peanut` |
|  | penne rigate | 1 | other |  |
|  | pernod | 1 | other |  |
|  | petit poi | 1 | other |  |
|  | peychaud bitter | 1 | other | `bitter` |
| r | pilchard | 1 | other |  |
| r | pina colada mix | 1 | other |  |
| r | pink food colouring | 1 | other |  |
|  | pisang ambon | 1 | other |  |
|  | pistachio paste | 1 | nut | `pistachio` |
| r | pitted black olive | 1 | vegetable | `black olive` |
| r | pitted date | 1 | fruit | `date` |
|  | plum jam | 1 | fruit | `plum` |
| r | polish kabano | 1 | other |  |
| r | pork knuckle | 1 | protein | `pork` |
| r | pork shoulder steak | 1 | protein | `pork shoulder` |
| r | porridge oat | 1 | grain | `oat` |
|  | purple sprouting broccoli | 1 | vegetable | `broccoli` |
| r | ready rolled shortcrust pastry | 1 | baked | `shortcrust pastry` |
| r | red chillie | 1 | other | `red chilie` |
|  | red snapper | 1 | protein | `fish` |
| r | red wine jelly | 1 | liquid | `red wine` |
|  | redcurrant | 1 | other | `currant` |
|  | refried bean | 1 | vegetable | `bean` |
| r | rice flour pancake | 1 | thickener | `rice flour` |
| r | rigatoni | 1 | other |  |
| r | ringed seal | 1 | other |  |
|  | rosso vermouth | 1 | bitters | `vermouth` |
|  | sarsaparilla | 1 | other |  |
|  | sazon | 1 | other |  |
| r | seasoned rice vinegar | 1 | acid | `rice vinegar` |
|  | semolina flour | 1 | thickener | `flour` |
|  | seviyan | 1 | other |  |
| r | shelled hazelnut | 1 | nut | `hazelnut` |
| r | sirup of rose | 1 | other |  |
| r | smoked flaked salmon | 1 | protein | `salmon` |
|  | smoked salmon | 1 | protein | `salmon` |
| r | smoky aïoli | 1 | other |  |
| r | soured cream and chive dip | 1 | dairy | `soured cream` |
| r | soya bean | 1 | vegetable | `bean` |
| r | speculaas spice mix | 1 | other | `spice` |
|  | st. germain | 1 | other |  |
| r | steller sea lion | 1 | other |  |
| r | stoned date | 1 | fruit | `date` |
| r | storax | 1 | other |  |
|  | stout | 1 | other |  |
| r | strawberry schnapp | 1 | fruit | `strawberry` |
| r | strong white flour | 1 | thickener | `white flour` |
| r | strong wholemeal flour | 1 | thickener | `wholemeal flour` |
|  | sultana | 1 | other | `raisin` |
| r | sun- tomatoe | 1 | vegetable | `tomatoe` |
| r | sweet peppadew pepper | 1 | chili | `peppadew pepper` |
|  | sweet sherry | 1 | other | `wine` |
|  | sweetened condensed milk | 1 | dairy | `milk` |
| r | tamarind ball | 1 | acid | `tamarind` |
| r | tempeh | 1 | other |  |
| r | thai fish sauce | 1 | protein | `fish sauce` |
|  | tia maria | 1 | other |  |
| r | toast | 1 | other |  |
| r | toffee popcorn | 1 | confection | `popcorn` |
|  | toor dal | 1 | other |  |
|r  | turkey mince | 1 | protein | `turkey` |
| r | turkish delight | 1 | other |  |
| r | unflavoured gelatin | 1 | dairy | `gelatin` |
| r | unsalted beef stock | 1 | protein | `beef stock` |
| r | unwaxed lemon | 1 | citrus | `lemon` |
| r | unwaxed lime | 1 | citrus | `lime` |
| r | vegan white wine vinegar | 1 | acid | `white wine vinegar` |
| r | vine leave | 1 | other |  |
| r | vine tomatoe | 1 | vegetable | `tomatoe` |
| r | walru | 1 | other |  |
| r | white asparagu | 1 | other |  |
| r | white bread mix | 1 | grain | `bread mix` |
| r | white fish fillet | 1 | protein | `fish fillet` |
| r | white sauerkraut | 1 | other |  |
| r | wholegrain bread | 1 | grain | `grain bread` |
| r | wild garlic leave | 1 | aromatic | `garlic` |
| r | wonton skin | 1 | other |  |
|  | wood ear mushroom | 1 | vegetable | `mushroom` |
|  | wormwood | 1 | other |  |
|  | yarrow | 1 | other |  |
| r | yellow food colouring | 1 | other |  |
| r | yellow masarepa | 1 | other |  |
| r | yukon jack | 1 | other |  |
