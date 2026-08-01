import json

data = [
  {"name":"stuffed olive","category":"condiment","taste":"salty sour bitter","cuisines":["Spanish","Italian","Greek","Turkish","Lebanese"],"isJunk":False,"junkReason":""},
  {"name":"stuffing crumb","category":"baked","taste":"sweet umami","cuisines":["British","American"],"isJunk":False,"junkReason":""},
  {"name":"sugar","category":"sweetener","taste":"sweet","cuisines":["Global"],"isJunk":False,"junkReason":""},
  {"name":"sugar cookie","category":"baked","taste":"sweet","cuisines":["American","Scandinavian"],"isJunk":False,"junkReason":""},
  {"name":"sugar cookie mix","category":"baked","taste":"sweet","cuisines":["American"],"isJunk":False,"junkReason":""},
  {"name":"sugar crystal","category":"sweetener","taste":"sweet","cuisines":["Global"],"isJunk":False,"junkReason":""},
  {"name":"sugar pumpkin","category":"vegetable","taste":"sweet","cuisines":["American"],"isJunk":False,"junkReason":""},
  {"name":"sugar replacement","category":"sweetener","taste":"sweet","cuisines":["Global"],"isJunk":False,"junkReason":""},
  {"name":"sugar snap pea","category":"vegetable","taste":"sweet","cuisines":["American","Chinese","British"],"isJunk":False,"junkReason":""},
  {"name":"sugar substitute","category":"sweetener","taste":"sweet","cuisines":["Global"],"isJunk":False,"junkReason":""},
  {"name":"sugar white","category":"sweetener","taste":"sweet","cuisines":["Global"],"isJunk":False,"junkReason":""},
  {"name":"sugar-free","category":"other","taste":"sweet","cuisines":["Global"],"isJunk":True,"junkReason":"Parse artifact — adjective, not a specific ingredient"},
  {"name":"sukiyaki","category":"condiment","taste":"umami salty sweet","cuisines":["Japanese"],"isJunk":False,"junkReason":""},
  {"name":"sultana raisin","category":"fruit","taste":"sweet","cuisines":["British","Middle Eastern","Moroccan","Turkish","Australian"],"isJunk":False,"junkReason":""},
  {"name":"sumac","category":"spice","taste":"sour astringent","cuisines":["Lebanese","Turkish","Persian","Israeli","Moroccan"],"isJunk":False,"junkReason":""},
  {"name":"summer sausage","category":"protein","taste":"umami salty","cuisines":["American","German"],"isJunk":False,"junkReason":""},
  {"name":"summer savory","category":"herb","taste":"bitter pungent spicy","cuisines":["French","Italian","Eastern European","Balkan"],"isJunk":False,"junkReason":""},
  {"name":"sun-dried tomato","category":"vegetable","taste":"umami sour sweet","cuisines":["Italian","Mediterranean"],"isJunk":False,"junkReason":""},
  {"name":"sundried tomatoe","category":"vegetable","taste":"umami sour sweet","cuisines":["Italian","Mediterranean"],"isJunk":False,"junkReason":""},
  {"name":"sunflower nut","category":"nut","taste":"umami sweet","cuisines":["American","Middle Eastern","Eastern European"],"isJunk":False,"junkReason":""},
  {"name":"sunflower oil","category":"fat","taste":"sweet","cuisines":["Global"],"isJunk":False,"junkReason":""},
  {"name":"sunflower seed","category":"nut","taste":"umami sweet","cuisines":["American","Eastern European","Middle Eastern"],"isJunk":False,"junkReason":""},
  {"name":"sunflower seed oil","category":"fat","taste":"sweet","cuisines":["Global"],"isJunk":False,"junkReason":""},
  {"name":"sushi rice","category":"grain","taste":"sweet sour umami","cuisines":["Japanese"],"isJunk":False,"junkReason":""},
  {"name":"swede","category":"vegetable","taste":"sweet bitter","cuisines":["British","Scandinavian","German","Irish"],"isJunk":False,"junkReason":""},
  {"name":"sweet apple","category":"fruit","taste":"sweet sour","cuisines":["American","British","French"],"isJunk":False,"junkReason":""},
  {"name":"sweet apple cider","category":"liquid","taste":"sweet sour","cuisines":["American","British","French"],"isJunk":False,"junkReason":""},
  {"name":"sweet baking chocolate","category":"confection","taste":"sweet bitter","cuisines":["American","French","Belgian"],"isJunk":False,"junkReason":""},
  {"name":"sweet bell pepper","category":"vegetable","taste":"sweet","cuisines":["Spanish","Italian","Turkish","Mexican","French"],"isJunk":False,"junkReason":""},
  {"name":"sweet biscuit crumb","category":"baked","taste":"sweet","cuisines":["British","American"],"isJunk":False,"junkReason":""},
  {"name":"sweet butter","category":"fat","taste":"sweet","cuisines":["Global"],"isJunk":False,"junkReason":""},
  {"name":"sweet chili sauce","category":"condiment","taste":"sweet spicy","cuisines":["Thai","Malaysian","Indonesian","Vietnamese"],"isJunk":False,"junkReason":""},
  {"name":"sweet chilli sauce","category":"condiment","taste":"sweet spicy","cuisines":["Thai","Malaysian","Indonesian"],"isJunk":False,"junkReason":""},
  {"name":"sweet chocolate","category":"confection","taste":"sweet bitter","cuisines":["American","French","Belgian"],"isJunk":False,"junkReason":""},
  {"name":"sweet chocolate chip","category":"confection","taste":"sweet bitter","cuisines":["American"],"isJunk":False,"junkReason":""},
  {"name":"sweet condensed milk","category":"dairy","taste":"sweet","cuisines":["Brazilian","Vietnamese","Filipino","Portuguese","Argentine"],"isJunk":False,"junkReason":""},
  {"name":"sweet cooking chocolate","category":"confection","taste":"sweet bitter","cuisines":["American","French"],"isJunk":False,"junkReason":""},
  {"name":"sweet corn","category":"vegetable","taste":"sweet","cuisines":["American","Mexican","West African","Southern US"],"isJunk":False,"junkReason":""},
  {"name":"sweet corn kernel","category":"vegetable","taste":"sweet","cuisines":["American","Mexican","Southern US"],"isJunk":False,"junkReason":""},
  {"name":"sweet cream","category":"dairy","taste":"sweet","cuisines":["French","American","Scandinavian"],"isJunk":False,"junkReason":""},
  {"name":"sweet cream butter","category":"fat","taste":"sweet","cuisines":["French","American","Global"],"isJunk":False,"junkReason":""},
  {"name":"sweet custard","category":"dairy","taste":"sweet","cuisines":["British","French","Australian"],"isJunk":False,"junkReason":""},
  {"name":"sweet grass","category":"other","taste":"sweet pungent","cuisines":["American","Scandinavian"],"isJunk":True,"junkReason":"Not a culinary ingredient — ornamental or medicinal plant"},
  {"name":"sweet green pea","category":"vegetable","taste":"sweet","cuisines":["British","French","Indian"],"isJunk":False,"junkReason":""},
  {"name":"sweet green pepper","category":"vegetable","taste":"sweet bitter","cuisines":["Spanish","Italian","Turkish","Mexican","American"],"isJunk":False,"junkReason":""},
  {"name":"sweet hungarian paprika","category":"spice","taste":"spicy sweet","cuisines":["Hungarian","Spanish","Turkish","Moroccan"],"isJunk":False,"junkReason":""},
  {"name":"sweet italian sausage","category":"protein","taste":"umami salty spicy","cuisines":["Italian","American"],"isJunk":False,"junkReason":""},
  {"name":"sweet italian turkey sausage","category":"protein","taste":"umami salty spicy","cuisines":["Italian","American"],"isJunk":False,"junkReason":""},
  {"name":"sweet kernel corn","category":"vegetable","taste":"sweet","cuisines":["American","Mexican","Southern US"],"isJunk":False,"junkReason":""},
  {"name":"sweet lowfat milk","category":"dairy","taste":"sweet","cuisines":["Global"],"isJunk":False,"junkReason":""},
  {"name":"sweet marsala wine","category":"liquid","taste":"sweet bitter","cuisines":["Italian"],"isJunk":False,"junkReason":""},
  {"name":"sweet milk","category":"dairy","taste":"sweet","cuisines":["Global"],"isJunk":False,"junkReason":""},
  {"name":"sweet mustard","category":"condiment","taste":"sweet pungent sour","cuisines":["German","Scandinavian","American"],"isJunk":False,"junkReason":""},
  {"name":"sweet orange","category":"citrus","taste":"sweet sour","cuisines":["Spanish","Moroccan","Mediterranean"],"isJunk":False,"junkReason":""},
  {"name":"sweet orange pepper","category":"vegetable","taste":"sweet","cuisines":["Spanish","Italian","Turkish","Mexican"],"isJunk":False,"junkReason":""},
  {"name":"sweet pea","category":"vegetable","taste":"sweet","cuisines":["British","French","Indian","American"],"isJunk":False,"junkReason":""},
  {"name":"sweet pepper","category":"vegetable","taste":"sweet","cuisines":["Spanish","Italian","Turkish","Mexican","American"],"isJunk":False,"junkReason":""},
  {"name":"sweet pickle juice","category":"liquid","taste":"sweet sour","cuisines":["American","Southern US"],"isJunk":False,"junkReason":""},
  {"name":"sweet potato","category":"vegetable","taste":"sweet","cuisines":["American","West African","Caribbean","Japanese","Latin American"],"isJunk":False,"junkReason":""},
  {"name":"sweet red bell pepper","category":"vegetable","taste":"sweet","cuisines":["Spanish","Italian","Turkish","Mexican","French"],"isJunk":False,"junkReason":""},
  {"name":"sweet red onion","category":"aromatic","taste":"pungent sweet","cuisines":["French","Italian","Greek","Indian","Turkish"],"isJunk":False,"junkReason":""},
  {"name":"sweet red pepper","category":"vegetable","taste":"sweet","cuisines":["Spanish","Italian","Turkish","Mexican","French"],"isJunk":False,"junkReason":""},
  {"name":"sweet red wine","category":"liquid","taste":"sweet sour bitter","cuisines":["French","Italian","Spanish","Argentine"],"isJunk":False,"junkReason":""},
  {"name":"sweet rice","category":"grain","taste":"sweet umami","cuisines":["Japanese","Korean","Chinese","Thai","Filipino"],"isJunk":False,"junkReason":""},
  {"name":"sweet rice flour","category":"thickener","taste":"sweet","cuisines":["Japanese","Korean","Chinese","Thai","Filipino"],"isJunk":False,"junkReason":""},
  {"name":"sweet sausage","category":"protein","taste":"umami salty spicy","cuisines":["Italian","American","German"],"isJunk":False,"junkReason":""},
  {"name":"sweet smoked paprika","category":"spice","taste":"spicy sweet","cuisines":["Spanish","Hungarian","Portuguese","American"],"isJunk":False,"junkReason":""},
  {"name":"sweet soy sauce","category":"condiment","taste":"umami salty sweet","cuisines":["Indonesian","Malaysian","Chinese","Japanese","Thai"],"isJunk":False,"junkReason":""},
  {"name":"sweet unsalted butter","category":"fat","taste":"sweet","cuisines":["French","American","Global"],"isJunk":False,"junkReason":""},
  {"name":"sweet vermouth","category":"liqueur","taste":"sweet bitter","cuisines":["Italian","French","Spanish"],"isJunk":False,"junkReason":""},
  {"name":"sweet vidalia onion","category":"aromatic","taste":"sweet pungent","cuisines":["American","Southern US"],"isJunk":False,"junkReason":""},
  {"name":"sweet white onion","category":"aromatic","taste":"sweet pungent","cuisines":["French","Italian","American","Spanish"],"isJunk":False,"junkReason":""},
  {"name":"sweet white wine","category":"liquid","taste":"sweet sour","cuisines":["French","German","Italian","Austrian"],"isJunk":False,"junkReason":""},
  {"name":"sweet wine","category":"liquid","taste":"sweet sour","cuisines":["French","Italian","Spanish","German"],"isJunk":False,"junkReason":""},
  {"name":"sweet yellow bell pepper","category":"vegetable","taste":"sweet","cuisines":["Spanish","Italian","Turkish","Mexican","American"],"isJunk":False,"junkReason":""},
  {"name":"sweet yellow onion","category":"aromatic","taste":"sweet pungent","cuisines":["French","Italian","American","Spanish"],"isJunk":False,"junkReason":""},
  {"name":"sweet yellow pepper","category":"vegetable","taste":"sweet","cuisines":["Spanish","Italian","Turkish","Mexican","American"],"isJunk":False,"junkReason":""},
  {"name":"sweetened applesauce","category":"condiment","taste":"sweet sour","cuisines":["American","German","Eastern European"],"isJunk":False,"junkReason":""},
  {"name":"swiss cheese","category":"dairy","taste":"umami salty","cuisines":["Swiss","French","German","American"],"isJunk":False,"junkReason":""},
  {"name":"swiss chocolate cake mix","category":"baked","taste":"sweet bitter","cuisines":["American"],"isJunk":True,"junkReason":"Branded product category — specific branded cake mix, not a culinary ingredient"},
  {"name":"swordfish","category":"protein","taste":"umami salty","cuisines":["Italian","Spanish","Japanese","American","Greek"],"isJunk":False,"junkReason":""},
  {"name":"swordfish fillet","category":"protein","taste":"umami salty","cuisines":["Italian","Spanish","Japanese","American"],"isJunk":False,"junkReason":""},
  {"name":"swordfish steak","category":"protein","taste":"umami salty","cuisines":["Italian","Spanish","Japanese","American"],"isJunk":False,"junkReason":""},
  {"name":"syrup","category":"sweetener","taste":"sweet","cuisines":["American","Global"],"isJunk":False,"junkReason":""},
  {"name":"szechuan peppercorn","category":"spice","taste":"spicy pungent","cuisines":["Chinese"],"isJunk":False,"junkReason":""},
  {"name":"t butter","category":"fat","taste":"sweet","cuisines":["Global"],"isJunk":True,"junkReason":"Parse artifact — truncated entry, not a valid ingredient name"},
  {"name":"t oil","category":"fat","taste":"sweet","cuisines":["Global"],"isJunk":True,"junkReason":"Parse artifact — truncated entry, not a valid ingredient name"},
  {"name":"t sugar","category":"sweetener","taste":"sweet","cuisines":["Global"],"isJunk":True,"junkReason":"Parse artifact — truncated entry, not a valid ingredient name"},
  {"name":"tabasco pepper sauce","category":"condiment","taste":"spicy sour","cuisines":["American","Cajun/Creole"],"isJunk":False,"junkReason":""},
  {"name":"tabasco sauce","category":"condiment","taste":"spicy sour","cuisines":["American","Cajun/Creole","Mexican"],"isJunk":False,"junkReason":""},
  {"name":"taco cheese","category":"dairy","taste":"umami spicy salty","cuisines":["Mexican","Tex-Mex","American"],"isJunk":False,"junkReason":""},
  {"name":"taco sauce","category":"condiment","taste":"spicy sour sweet","cuisines":["Mexican","Tex-Mex","American"],"isJunk":False,"junkReason":""},
  {"name":"tahini","category":"condiment","taste":"umami bitter sweet","cuisines":["Lebanese","Israeli","Turkish","Middle Eastern","Greek"],"isJunk":False,"junkReason":""},
  {"name":"tahini sauce","category":"condiment","taste":"umami bitter sweet","cuisines":["Lebanese","Israeli","Turkish","Middle Eastern"],"isJunk":False,"junkReason":""},
  {"name":"taleggio cheese","category":"dairy","taste":"umami salty","cuisines":["Italian"],"isJunk":False,"junkReason":""},
  {"name":"tamari","category":"condiment","taste":"umami salty","cuisines":["Japanese","Chinese","Korean"],"isJunk":False,"junkReason":""},
  {"name":"tamari sauce","category":"condiment","taste":"umami salty","cuisines":["Japanese","Chinese","Korean"],"isJunk":False,"junkReason":""},
  {"name":"tamarind","category":"acid","taste":"sour sweet","cuisines":["Indian","Thai","Indonesian","Malaysian","West African"],"isJunk":False,"junkReason":""},
  {"name":"tamarind concentrate","category":"acid","taste":"sour sweet","cuisines":["Indian","Thai","Indonesian","Malaysian","Sri Lankan"],"isJunk":False,"junkReason":""},
  {"name":"tamarind juice","category":"liquid","taste":"sour sweet","cuisines":["Indian","Thai","Indonesian","Malaysian","Filipino"],"isJunk":False,"junkReason":""},
]

inp = json.load(open('.ralph/audit_batches/batch_33.json', encoding='utf-8'))
assert len(data) == len(inp), f'LENGTH MISMATCH {len(data)} vs {len(inp)}'
for i,(d,r) in enumerate(zip(data,inp)):
    if d['name'] != r['name']:
        print(f'NAME MISMATCH at {i}: got {repr(d["name"])} expected {repr(r["name"])}')
        d['name'] = r['name']

with open('.ralph/audit_batches/batch_33.out.json','w',encoding='utf-8') as f:
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
