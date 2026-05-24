# Cluster Comparison — Encoded vs GNN (post tier-fill retrain)

Encoded: 16 clusters, 4278 ingredients
GNN:     16 clusters, 4313 ingredients

## ENCODED

### c2 (546 nodes) — **dairy-cooling**
- 152937  lemon juice
- 121872  sour cream
- 120516  cream cheese
- 115583  cheddar
-  92334  mayonnaise
-  68992  cheese
-  47957  buttermilk
-  36282  cream of mushroom soup
-  33501  cream of chicken soup
-  21834  sauce
-  20980  condensed milk
-  17038  swiss cheese
-  16712  cottage cheese
-  15777  feta
-  15675  yogurt

### c3 (537 nodes) — **protein**
- 584925  egg
- 174999  chicken
-  85510  beef
-  71521  bacon
-  46361  egg yolk
-  38225  egg white
-  37796  shrimp
-  25357  sausage
-  22367  ham
-  21267  pork
-  19268  hamburger
-  16991  turkey
-  13890  salmon
-  12579  lean beef
-  10522  tuna

### c1 (498 nodes) — **sweetener**
- 246119  olive oil
- 160647  baking powder
- 100057  parmesan
-  78826  powdered sugar
-  77992  soy sauce
-  74262  oregano
-  73975  thyme
-  66508  cumin
-  54333  walnut
-  44062  cocoa
-  31618  rosemary
-  26177  yeast
-  24000  allspice
-  19284  sage
-  18203  turmeric

### c8 (391 nodes) — **grain-sweet**
- 654609  sugar
- 565100  butter
- 478527  flour
- 366422  milk
- 297556  vanilla
- 199690  brown sugar
- 182199  cinnamon
- 116366  cream
-  85993  pecan
-  80670  basil
-  76427  nutmeg
-  71747  honey
-  70115  rice
-  64066  paprika
-  60620  cornstarch

### c4 (336 nodes) — **vegetable-sweet**
-  90388  potato
-  82488  mushroom
-  33500  corn
-  22761  green bean
-  21896  bean
-  17081  black bean
-  13570  kidney bean
-  13173  tomato soup
-  11495  eggplant
-  11068  kernel corn
-   9575  mushroom soup
-   8655  red potatoe
-   7597  pinto bean
-   6826  broccoli floret
-   6093  baby spinach

### c0 (315 nodes) — **other-pungent**
-  94091  mustard
-  85482  ginger
-  79618  nut
-   4885  liquid smoke
-   3876  baking pwdr
-   2670  dream whip
-   2496  fryer
-   2360  flat-leaf
-   1715  porcini
-   1613  cool whip
-   1319  nutella
-   1273  baking mix
-   1185  portobello
-   1170  bisquick baking mix
-    962  eggnog

### c5 (221 nodes) — **other**
-  81054  chocolate
-  41685  olive
-  24935  avocado
-  15940  green chilie
-  10268  oatmeal
-   9701  vegetable
-   7976  chickpea
-   6256  black peppercorn
-   6129  gingerroot
-   5985  crabmeat
-   5829  curry
-   4885  fruit
-   4472  pumpkin puree
-   4348  peppercorn
-   4077  whipped topping

### c11 (220 nodes) — **liquid**
- 120340  baking soda
-  86938  chicken stock
-  64972  worcestershire sauce
-  59550  vinegar
-  42569  white wine
-  35974  boiling water
-  22261  red wine vinegar
-  18742  white vinegar
-  18454  beef stock
-  16909  cider vinegar
-  16632  red wine
-  15408  vegetable stock
-  14876  rice vinegar
-  12342  capers
-  11009  white wine vinegar

### c12 (208 nodes) — **fruit**
-  47335  raisin
-  16068  peache
-  15094  date
-   9326  cherry pie filling
-   7712  apricot
-   6496  golden raisin
-   5445  cranberry sauce
-   3973  grape tomatoe
-   3407  apricot preserve
-   2712  marinade
-   2246  tart apple
-   2240  fig
-   1951  pineapple tidbit
-   1860  watermelon
-   1686  green grape

### c14 (206 nodes) — **cooling-sweet**
-   9193  peanut oil
-   7141  poppy seed
-   5352  pine nut
-   4947  herb
-   4716  strawberry jello
-   4498  grape
-   3059  penne pasta
-   2903  pasta sauce
-   2636  black-eyed pea
-   2622  crunchy peanut butter
-   1837  mashed ripe banana
-   1821  chunky peanut butter
-   1682  smooth peanut butter
-   1636  pasta shell
-   1517  orzo pasta

### c10 (193 nodes) — **aromatic-spice-oily**
- 575624  onion
- 440489  garlic
- 119130  scallion
-  37331  shallot
-  20621  garlic salt
-  17983  curry powder
-  17014  onion powder
-  12170  onion soup
-   8627  leek
-   7274  vanilla pudding
-   7172  celery salt
-   5856  unflavored gelatin
-   5311  fennel seed
-   5018  caraway seed
-   4616  onion salt

### c6 (177 nodes) — **grain-waxy-cooling**
-  37332  bread crumb
-  32533  extra-virgin olive oil
-  19694  oat
-  12612  graham cracker crumb
-  11818  water chestnut
-   9417  corn tortilla
-   8401  white bread
-   8385  brandy
-   6774  ginger ale
-   6597  vanilla wafer
-   6525  graham cracker
-   6308  graham cracker crust
-   5932  lasagna noodle
-   5468  bourbon
-   5425  pumpkin pie spice

### c13 (175 nodes) — **chili-waxy**
-  49619  cayenne pepper
-  47865  chili powder
-  31186  freshly black pepper
-  16839  white pepper
-  15660  jalapeño
-  11607  tabasco sauce
-  11272  freshly pepper
-   8565  chili sauce
-   7808  chili
-   5586  pepper sauce
-   3646  red chili pepper
-   2599  green chili pepper
-   2588  chili bean
-   2379  chili flake
-   2001  green chili

### c15 (105 nodes) — **citrus-pungent-waxy**
-  90637  lemon
-  43437  orange juice
-  38368  lime juice
-  26939  lime
-   9498  mandarin orange
-   5355  orange rind
-   4625  lemon pepper
-   3582  orange marmalade
-   2516  lime wedge
-   2428  orange jello
-   2419  orange juice concentrate
-   1915  lime jello
-   1789  freshly squeezed lime juice
-   1541  orange liqueur
-   1297  orange bell pepper

### c7 (85 nodes) — **vegetable-astringent-green**
- 138137  celery
- 135539  parsley
- 119018  carrot
-  79207  sweet pepper
-  73654  red pepper
-  73174  green pepper
-  64908  cilantro
-  46801  bay leaf
-  39824  zucchini
-  35348  broccoli
-  29892  mint
-  26302  cabbage
-  26099  spinach
-  23869  pea
-  13741  cauliflower

### c9 (65 nodes) — **fruit-fruity-juicy**
- 210841  tomato
-  76599  pineapple
-  50147  apple
-  47236  banana
-  42561  tomato sauce
-  16586  pineapple juice
-   9182  mango
-   8164  applesauce
-   8003  apple juice
-   5777  strawberry
-   5770  apple cider
-   4201  pear
-   3903  unsweetened applesauce
-   2906  raspberry
-   2750  prune

---

## GNN

### c0 (704 nodes) — **sweetener-sticky-bitter**
- 654609  sugar
- 366422  milk
- 246119  olive oil
- 199690  brown sugar
- 160647  baking powder
- 120516  cream cheese
- 116366  cream
-  90388  potato
-  85993  pecan
-  82488  mushroom
-  80670  basil
-  79207  sweet pepper
-  78826  powdered sugar
-  73654  red pepper
-  73174  green pepper

### c15 (665 nodes) — **grain-woody-chewy**
- 565100  butter
- 478527  flour
- 297556  vanilla
- 182199  cinnamon
- 138137  celery
- 119018  carrot
-  76427  nutmeg
-  70115  rice
-  64066  paprika
-  47236  banana
-  44062  coconut
-  43093  bread
-  37814  peanut butter
-  37332  bread crumb
-  22812  coriander

### c1 (405 nodes) — **protein-pungent-salty**
-  71521  bacon
-  22367  ham
-  12579  lean beef
-  10130  pork chop
-   7007  italian sausage
-   6558  pepperoni
-   5780  pork sausage
-   5468  pork tenderloin
-   3612  egg substitute
-   3521  coarse salt
-   3077  clam
-   3064  chicken breast halve
-   2859  mussel
-   2754  turkey breast
-   2737  pork loin

### c6 (401 nodes) — **other-pungent**
-  79618  nut
-  15940  green chilie
-   9701  vegetable
-   5985  crabmeat
-   5829  curry
-   4885  liquid smoke
-   4077  whipped topping
-   4063  butterscotch chip
-   3982  fruit cocktail
-   3876  baking pwdr
-   2737  chilie
-   2670  dream whip
-   2496  fryer
-   2360  flat-leaf
-   2147  lump crabmeat

### c2 (400 nodes) — **citrus-fruit-juicy**
- 210841  tomato
- 152937  lemon juice
-  90637  lemon
-  76599  pineapple
-  64972  worcestershire sauce
-  50147  apple
-  47335  raisin
-  43437  orange juice
-  42569  white wine
-  42561  tomato sauce
-  42086  orange
-  38368  lime juice
-  26939  lime
-  16586  pineapple juice
-  16068  peache

### c14 (383 nodes) — **dairy-fatty-creamy**
-  47957  buttermilk
-  36282  cream of mushroom soup
-  33501  cream of chicken soup
-  24935  avocado
-  20980  condensed milk
-  17038  swiss cheese
-  16712  cottage cheese
-  14471  cream of tartar
-  12865  velveeta cheese
-  11046  vanilla ice cream
-   9726  cream of celery soup
-   9090  whipped cream
-   8664  american cheese
-   8202  goat cheese
-   7969  condensed cream

### c11 (232 nodes) — **vegetable-astringent-crispy**
-  23869  pea
-  22761  green bean
-  21896  bean
-  13570  kidney bean
-  13173  tomato soup
-   9575  mushroom soup
-   7597  pinto bean
-   6826  broccoli floret
-   6093  baby spinach
-   5333  butternut squash
-   5222  bean sprout
-   5167  green pea
-   3963  red kidney bean
-   3932  garbanzo bean
-   3771  potato chip

### c10 (221 nodes) — **protein-other-pungent**
-  81054  chocolate
-   7657  vodka
-   6256  black peppercorn
-   6129  gingerroot
-   5311  fennel seed
-   5018  caraway seed
-   4472  pumpkin puree
-   4348  peppercorn
-   3374  bacon bit
-   3195  mustard seed
-   2476  gin
-   2358  chuck roast
-   1939  pickling spice
-   1747  cumin powder
-   1672  freshly nutmeg

### c7 (193 nodes) — **chili-spicy-spicy**
-  94091  mustard
-  85482  ginger
-  47865  chili powder
-  31186  freshly black pepper
-  16839  white pepper
-  15660  jalapeño
-  11607  tabasco sauce
-  11272  freshly pepper
-   8565  chili sauce
-   7808  chili
-   5586  pepper sauce
-   3646  red chili pepper
-   2599  green chili pepper
-   2588  chili bean
-   2379  chili flake

### c5 (167 nodes) — **aromatic-spice-pungent**
- 575624  onion
- 440489  garlic
- 119130  scallion
-  66508  cumin
-  49619  cayenne pepper
-  37331  shallot
-  24000  allspice
-  20621  garlic salt
-  18203  turmeric
-  17983  curry powder
-  17014  onion powder
-  12170  onion soup
-   7274  vanilla pudding
-   7172  celery salt
-   7141  poppy seed

### c9 (160 nodes) — **condiment-pungent-sticky**
-  92334  mayonnaise
-  27696  ketchup
-  21834  sauce
-  10550  dressing
-  10504  barbecue sauce
-   8532  italian dressing
-   7411  salad dressing
-   7115  spaghetti sauce
-   4654  mayo
-   4473  pizza sauce
-   3903  unsweetened applesauce
-   3744  italian salad dressing
-   3479  picante sauce
-   3421  ro-tel tomatoe
-   3305  enchilada sauce

### c3 (116 nodes) — **liquid-watery-salty**
-  35974  boiling water
-  15777  feta
-  12342  capers
-   8534  tomato juice
-   3899  cranberry juice
-   2440  sherry wine
-   1458  marsala wine
-   1289  vegetable soup
-   1183  port wine
-   1028  cranberry juice cocktail
-   1008  apple juice concentrate
-    958  very water
-    892  vegetable juice
-    870  sparkling wine
-    697  coffee powder

### c8 (98 nodes) — **acid-liquid-watery**
- 121872  sour cream
- 120340  baking soda
-  86938  chicken stock
-  59550  vinegar
-  22261  red wine vinegar
-  21238  balsamic vinegar
-  18742  white vinegar
-  18454  beef stock
-  16909  cider vinegar
-  16632  red wine
-  15675  yogurt
-  15408  vegetable stock
-  14876  rice vinegar
-  11009  white wine vinegar
-  10945  apple cider vinegar

### c4 (77 nodes) — **herb-astringent-bitter**
- 135539  parsley
-  74262  oregano
-  73975  thyme
-  64908  cilantro
-  46801  bay leaf
-  31618  rosemary
-  29892  mint
-  19284  sage
-  11536  tarragon
-  10338  parsley flake
-   3065  dill pickle
-   2965  flat-leaf parsley
-   1530  basil leaf
-    896  cilantro leaf
-    884  basil pesto

### c13 (57 nodes) — **umami-protein-meaty**
- 584925  egg
- 174999  chicken
- 115583  cheddar
- 100057  parmesan
-  85510  beef
-  77992  soy sauce
-  68992  cheese
-  46361  egg yolk
-  41685  olive
-  38225  egg white
-  37796  shrimp
-  25357  sausage
-  21267  pork
-  16991  turkey
-  13890  salmon

### c12 (34 nodes) — **cluster-12**
-      1  sevaiiya
-      0  candied mixed fruit
-      0  coleslaw
-      0  creole seasoning
-      0  croissant
-      0  dabeli masala
-      0  dried mixed fruit
-      0  goda masala
-      0  green chutney
-      0  half and half
-      0  half half
-      0  herbe de provence
-      0  herbes de provence
-      0  nam pla
-      0  nuoc cham

---
