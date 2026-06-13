import json

data = [
  {"name":"olive oil drizzle","category":"fat","taste":"sweet","cuisines":["Italian","Greek","Spanish","Global"],"isJunk":False,"junkReason":""},
  {"name":"olive oil mayonnaise","category":"condiment","taste":"sour sweet","cuisines":["American","French"],"isJunk":False,"junkReason":""},
  {"name":"olive oil spray","category":"fat","taste":"sweet","cuisines":["Global"],"isJunk":False,"junkReason":""},
  {"name":"olive or","category":"vegetable","taste":"salty bitter","cuisines":["Italian","Greek","Spanish","Lebanese"],"isJunk":True,"junkReason":"Parse artifact — incomplete ingredient name"},
  {"name":"olive tapenade","category":"condiment","taste":"salty bitter umami","cuisines":["French","Italian","Greek","Spanish"],"isJunk":False,"junkReason":""},
  {"name":"onion","category":"aromatic","taste":"pungent sweet","cuisines":["Global"],"isJunk":False,"junkReason":""},
  {"name":"onion cream cheese","category":"dairy","taste":"sour pungent","cuisines":["American"],"isJunk":False,"junkReason":""},
  {"name":"onion flake","category":"spice","taste":"pungent sweet","cuisines":["Global"],"isJunk":False,"junkReason":""},
  {"name":"onion gravy mix","category":"condiment","taste":"umami pungent","cuisines":["British","American","French"],"isJunk":False,"junkReason":""},
  {"name":"onion juice","category":"liquid","taste":"pungent","cuisines":["Global"],"isJunk":False,"junkReason":""},
  {"name":"onion powder","category":"spice","taste":"pungent sweet","cuisines":["Global"],"isJunk":False,"junkReason":""},
  {"name":"onion pwdr","category":"spice","taste":"pungent sweet","cuisines":["Global"],"isJunk":False,"junkReason":""},
  {"name":"onion ring","category":"baked","taste":"pungent sweet","cuisines":["American","Global"],"isJunk":False,"junkReason":""},
  {"name":"onion roll","category":"baked","taste":"pungent sweet","cuisines":["American","German"],"isJunk":False,"junkReason":""},
  {"name":"onion salt","category":"seasoning","taste":"pungent salty","cuisines":["Global"],"isJunk":False,"junkReason":""},
  {"name":"onion seed","category":"spice","taste":"pungent bitter","cuisines":["Indian","Pakistani","Turkish"],"isJunk":False,"junkReason":""},
  {"name":"onion soup","category":"liquid","taste":"umami pungent","cuisines":["French","American"],"isJunk":False,"junkReason":""},
  {"name":"onion soup mix","category":"seasoning","taste":"umami pungent salty","cuisines":["French","American"],"isJunk":False,"junkReason":""},
  {"name":"onion top","category":"aromatic","taste":"pungent","cuisines":["Global"],"isJunk":False,"junkReason":""},
  {"name":"orange","category":"citrus","taste":"sweet sour","cuisines":["Spanish","Moroccan","Brazilian","American"],"isJunk":False,"junkReason":""},
  {"name":"orange and","category":"citrus","taste":"sweet sour","cuisines":["Spanish","Moroccan","Portuguese"],"isJunk":True,"junkReason":"Parse artifact — incomplete ingredient name"},
  {"name":"orange bell pepper","category":"vegetable","taste":"sweet","cuisines":["Spanish","Hungarian","Chinese","American"],"isJunk":False,"junkReason":""},
  {"name":"orange bitters","category":"bitters","taste":"bitter","cuisines":["Global"],"isJunk":False,"junkReason":""},
  {"name":"orange blossom","category":"spice","taste":"sweet pungent","cuisines":["Moroccan","Lebanese","Persian","Turkish"],"isJunk":False,"junkReason":""},
  {"name":"orange blossom honey","category":"sweetener","taste":"sweet","cuisines":["Moroccan","Lebanese","Greek"],"isJunk":False,"junkReason":""},
  {"name":"orange blossom water","category":"liquid","taste":"sweet pungent","cuisines":["Moroccan","Lebanese","Persian","Turkish"],"isJunk":False,"junkReason":""},
  {"name":"orange cake","category":"baked","taste":"sweet sour","cuisines":["British","Spanish","American"],"isJunk":False,"junkReason":""},
  {"name":"orange cake mix","category":"baked","taste":"sweet sour","cuisines":["American"],"isJunk":False,"junkReason":""},
  {"name":"orange candy","category":"confection","taste":"sweet","cuisines":["American","Global"],"isJunk":False,"junkReason":""},
  {"name":"orange concentrate","category":"citrus","taste":"sweet sour","cuisines":["Spanish","American","Global"],"isJunk":False,"junkReason":""},
  {"name":"orange crystal","category":"sweetener","taste":"sweet sour","cuisines":["American"],"isJunk":True,"junkReason":"Branded/artifactual product descriptor — likely Tang or similar powder drink mix, not a distinct ingredient"},
  {"name":"orange curacao","category":"liqueur","taste":"sweet bitter","cuisines":["French","Spanish","Caribbean"],"isJunk":False,"junkReason":""},
  {"name":"orange drink","category":"liquid","taste":"sweet sour","cuisines":["American","Global"],"isJunk":False,"junkReason":""},
  {"name":"orange extract","category":"spice","taste":"sweet sour","cuisines":["Global"],"isJunk":False,"junkReason":""},
  {"name":"orange flavor","category":"spice","taste":"sweet sour","cuisines":["Global"],"isJunk":False,"junkReason":""},
  {"name":"orange flavored","category":"other","taste":"sweet sour","cuisines":["Global"],"isJunk":True,"junkReason":"Flavor descriptor/adjective, not a specific ingredient"},
  {"name":"orange flavored gelatin","category":"confection","taste":"sweet sour","cuisines":["American"],"isJunk":False,"junkReason":""},
  {"name":"orange flavoring","category":"spice","taste":"sweet sour","cuisines":["Global"],"isJunk":False,"junkReason":""},
  {"name":"orange flower","category":"spice","taste":"sweet pungent","cuisines":["Moroccan","Lebanese","Persian"],"isJunk":False,"junkReason":""},
  {"name":"orange flower water","category":"liquid","taste":"sweet pungent","cuisines":["Moroccan","Lebanese","Persian","Turkish"],"isJunk":False,"junkReason":""},
  {"name":"orange food coloring","category":"other","taste":"sweet","cuisines":["Global"],"isJunk":True,"junkReason":"Not an ingredient — food coloring is an additive with no flavor contribution"},
  {"name":"orange gelatin","category":"confection","taste":"sweet sour","cuisines":["American"],"isJunk":False,"junkReason":""},
  {"name":"orange glaze","category":"condiment","taste":"sweet sour","cuisines":["French","American","Chinese"],"isJunk":False,"junkReason":""},
  {"name":"orange jello","category":"confection","taste":"sweet sour","cuisines":["American"],"isJunk":True,"junkReason":"Branded product (Jell-O is a registered trademark of Kraft Heinz)"},
  {"name":"orange juice","category":"citrus","taste":"sweet sour","cuisines":["Spanish","Brazilian","American","Moroccan"],"isJunk":False,"junkReason":""},
  {"name":"orange juice concentrate","category":"citrus","taste":"sweet sour","cuisines":["American","Global"],"isJunk":False,"junkReason":""},
  {"name":"orange juice freshly squeezed","category":"citrus","taste":"sweet sour","cuisines":["Spanish","American","Brazilian"],"isJunk":False,"junkReason":""},
  {"name":"orange liqueur","category":"liqueur","taste":"sweet bitter","cuisines":["French","Spanish","Caribbean"],"isJunk":False,"junkReason":""},
  {"name":"orange marmalade","category":"condiment","taste":"sweet sour bitter","cuisines":["British","Spanish","Moroccan"],"isJunk":False,"junkReason":""},
  {"name":"orange oil","category":"fat","taste":"sweet sour","cuisines":["Italian","French","Global"],"isJunk":False,"junkReason":""},
  {"name":"orange pepper","category":"vegetable","taste":"sweet","cuisines":["Spanish","American","Hungarian"],"isJunk":False,"junkReason":""},
  {"name":"orange rind","category":"citrus","taste":"sour bitter","cuisines":["Global"],"isJunk":False,"junkReason":""},
  {"name":"orange rind strip","category":"citrus","taste":"sour bitter","cuisines":["Global"],"isJunk":False,"junkReason":""},
  {"name":"orange roughy","category":"protein","taste":"umami","cuisines":["Australian","American","New Zealand"],"isJunk":False,"junkReason":""},
  {"name":"orange roughy fillet","category":"protein","taste":"umami","cuisines":["Australian","American"],"isJunk":False,"junkReason":""},
  {"name":"orange sauce","category":"condiment","taste":"sweet sour","cuisines":["Chinese","American","French"],"isJunk":False,"junkReason":""},
  {"name":"orange section","category":"citrus","taste":"sweet sour","cuisines":["Spanish","American","Moroccan"],"isJunk":False,"junkReason":""},
  {"name":"orange segment","category":"citrus","taste":"sweet sour","cuisines":["Spanish","American","Moroccan"],"isJunk":False,"junkReason":""},
  {"name":"orange sherbet","category":"confection","taste":"sweet sour","cuisines":["American"],"isJunk":False,"junkReason":""},
  {"name":"orange soda","category":"mixer","taste":"sweet sour","cuisines":["American","Global"],"isJunk":False,"junkReason":""},
  {"name":"orange syrup","category":"sweetener","taste":"sweet sour","cuisines":["Spanish","Moroccan","French"],"isJunk":False,"junkReason":""},
  {"name":"orange tang","category":"liquid","taste":"sweet sour","cuisines":["American"],"isJunk":True,"junkReason":"Branded product (Tang is a registered trademark of Mondelez International)"},
  {"name":"orange twist","category":"citrus","taste":"sour bitter","cuisines":["Global"],"isJunk":False,"junkReason":""},
  {"name":"orange wedge","category":"citrus","taste":"sweet sour","cuisines":["Spanish","American","Moroccan"],"isJunk":False,"junkReason":""},
  {"name":"orange wheel","category":"citrus","taste":"sweet sour","cuisines":["Spanish","American","Moroccan"],"isJunk":False,"junkReason":""},
  {"name":"orange zested","category":"citrus","taste":"sour bitter","cuisines":["Spanish","Italian","French"],"isJunk":False,"junkReason":""},
  {"name":"orange-flavored liqueur","category":"liqueur","taste":"sweet bitter","cuisines":["French","Spanish","Caribbean"],"isJunk":False,"junkReason":""},
  {"name":"orange-pineapple","category":"fruit","taste":"sweet sour","cuisines":["Pacific Islander","Caribbean","Filipino"],"isJunk":False,"junkReason":""},
  {"name":"oregano","category":"herb","taste":"pungent bitter","cuisines":["Italian","Greek","Mexican","Turkish"],"isJunk":False,"junkReason":""},
  {"name":"oregano dressing","category":"condiment","taste":"pungent sour","cuisines":["Italian","Greek"],"isJunk":False,"junkReason":""},
  {"name":"oregano flake","category":"herb","taste":"pungent bitter","cuisines":["Italian","Greek","Mexican"],"isJunk":False,"junkReason":""},
  {"name":"oregano leave","category":"herb","taste":"pungent bitter","cuisines":["Italian","Greek","Mexican","Turkish"],"isJunk":False,"junkReason":""},
  {"name":"oregon yampah","category":"vegetable","taste":"sweet pungent","cuisines":["American"],"isJunk":False,"junkReason":""},
  {"name":"oreo cookie","category":"baked","taste":"sweet bitter","cuisines":["American"],"isJunk":True,"junkReason":"Branded product (Oreo is a registered trademark of Mondelez/Nabisco)"},
  {"name":"oreo cream biscuit","category":"baked","taste":"sweet bitter","cuisines":["American"],"isJunk":True,"junkReason":"Branded product (Oreo is a registered trademark of Mondelez/Nabisco)"},
  {"name":"oreo pie crust","category":"baked","taste":"sweet bitter","cuisines":["American"],"isJunk":True,"junkReason":"Branded product (Oreo is a registered trademark of Mondelez/Nabisco)"},
  {"name":"original hidden","category":"condiment","taste":"sour sweet","cuisines":["American"],"isJunk":True,"junkReason":"Parse artifact / branded product fragment (Hidden Valley); not a complete ingredient name"},
  {"name":"original sauce","category":"condiment","taste":"umami salty","cuisines":["American","Global"],"isJunk":True,"junkReason":"Overly generic descriptor — not a specific identifiable ingredient"},
  {"name":"orri","category":"citrus","taste":"sweet sour","cuisines":["Spanish","Israeli"],"isJunk":False,"junkReason":""},
  {"name":"orzo pasta","category":"grain","taste":"sweet","cuisines":["Italian","Greek"],"isJunk":False,"junkReason":""},
  {"name":"oscar mayer bacon","category":"protein","taste":"salty umami","cuisines":["American"],"isJunk":True,"junkReason":"Branded product (Oscar Mayer is a registered trademark of Kraft Heinz)"},
  {"name":"ostrich fern","category":"vegetable","taste":"astringent bitter","cuisines":["Japanese","Korean","Canadian"],"isJunk":False,"junkReason":""},
  {"name":"other fermented milk","category":"dairy","taste":"sour","cuisines":["Global"],"isJunk":True,"junkReason":"Generic catch-all descriptor, not a single identifiable ingredient"},
  {"name":"other neutral oil","category":"fat","taste":"sweet","cuisines":["Global"],"isJunk":True,"junkReason":"Generic catch-all descriptor, not a single identifiable ingredient"},
  {"name":"ouzo","category":"spirit","taste":"sweet bitter","cuisines":["Greek"],"isJunk":False,"junkReason":""},
  {"name":"overripe banana","category":"fruit","taste":"sweet","cuisines":["Caribbean","Filipino","Pacific Islander"],"isJunk":False,"junkReason":""},
  {"name":"owens sausage","category":"protein","taste":"salty umami","cuisines":["American","Southern US"],"isJunk":True,"junkReason":"Branded product (Owen's is a registered brand of sausage)"},
  {"name":"oyster","category":"protein","taste":"salty umami","cuisines":["French","Japanese","American"],"isJunk":False,"junkReason":""},
  {"name":"oyster mushroom","category":"vegetable","taste":"umami","cuisines":["Chinese","Japanese","Korean","Italian"],"isJunk":False,"junkReason":""},
  {"name":"oyster sauce","category":"umami","taste":"umami salty","cuisines":["Chinese","Vietnamese","Thai"],"isJunk":False,"junkReason":""},
  {"name":"pacific sardine","category":"protein","taste":"salty umami","cuisines":["Japanese","Spanish","Portuguese"],"isJunk":False,"junkReason":""},
  {"name":"padano cheese","category":"dairy","taste":"umami salty","cuisines":["Italian"],"isJunk":False,"junkReason":""},
  {"name":"padron pepper","category":"chili","taste":"spicy pungent","cuisines":["Spanish"],"isJunk":False,"junkReason":""},
  {"name":"paella rice","category":"grain","taste":"sweet umami","cuisines":["Spanish"],"isJunk":False,"junkReason":""},
  {"name":"pak choy","category":"vegetable","taste":"bitter astringent","cuisines":["Chinese","Korean","Vietnamese"],"isJunk":False,"junkReason":""},
  {"name":"palm oil","category":"fat","taste":"sweet","cuisines":["West African","Indonesian","Malaysian"],"isJunk":False,"junkReason":""},
  {"name":"palm sugar","category":"sweetener","taste":"sweet","cuisines":["Thai","Indonesian","Malaysian","Filipino"],"isJunk":False,"junkReason":""},
  {"name":"pan cornbread","category":"baked","taste":"sweet","cuisines":["American","Southern US"],"isJunk":False,"junkReason":""},
  {"name":"pan sausage","category":"protein","taste":"salty umami","cuisines":["American","Southern US"],"isJunk":False,"junkReason":""},
  {"name":"pancake","category":"baked","taste":"sweet","cuisines":["American","French","Scandinavian"],"isJunk":False,"junkReason":""},
]

inp = json.load(open('.ralph/audit_batches/batch_24.json', encoding='utf-8'))
assert len(data) == len(inp), f'LENGTH MISMATCH {len(data)} vs {len(inp)}'
for i,(d,r) in enumerate(zip(data,inp)):
    if d['name'] != r['name']:
        print(f'NAME MISMATCH at {i}: got {repr(d["name"])} expected {repr(r["name"])}')
        d['name'] = r['name']

with open('.ralph/audit_batches/batch_24.out.json','w',encoding='utf-8') as f:
    json.dump(data, f, ensure_ascii=False, indent=2)

changed_cat = sum(1 for r,o in zip(inp,data) if r['category'] != o['category'])
changed_taste = sum(1 for r,o in zip(inp,data) if r['taste'] != o['taste'])
changed_cuisines = sum(1 for r,o in zip(inp,data) if sorted(r['cuisines']) != sorted(o['cuisines']))
junk = sum(1 for o in data if o['isJunk'])
print(f'Written OK, length: {len(data)}')
print(f'changedCategory: {changed_cat}')
print(f'changedTaste: {changed_taste}')
print(f'changedCuisines: {changed_cuisines}')
print(f'junk: {junk}')
