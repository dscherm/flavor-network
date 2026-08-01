import json

data = [
  {"name":"mixed olive","category":"vegetable","taste":"salty bitter","cuisines":["Italian","Greek","Spanish","Lebanese","Moroccan"],"isJunk":False,"junkReason":""},
  {"name":"mixed pepper","category":"vegetable","taste":"sweet spicy","cuisines":["Global"],"isJunk":False,"junkReason":""},
  {"name":"mixed seed","category":"nut","taste":"bitter sweet","cuisines":["Global"],"isJunk":False,"junkReason":""},
  {"name":"mixed veggie","category":"vegetable","taste":"sweet astringent","cuisines":["Global"],"isJunk":False,"junkReason":""},
  {"name":"moist coconut","category":"nut","taste":"sweet","cuisines":["Thai","Indonesian","Malaysian","Indian","Caribbean"],"isJunk":False,"junkReason":""},
  {"name":"molasses","category":"sweetener","taste":"sweet bitter","cuisines":["American","Caribbean","British"],"isJunk":False,"junkReason":""},
  {"name":"mollusc","category":"protein","taste":"salty umami","cuisines":["French","Spanish","Italian","Portuguese"],"isJunk":False,"junkReason":""},
  {"name":"monkfish","category":"protein","taste":"umami","cuisines":["French","Spanish","Portuguese","British"],"isJunk":False,"junkReason":""},
  {"name":"monterey cheese","category":"dairy","taste":"umami sweet","cuisines":["American","Tex-Mex"],"isJunk":False,"junkReason":""},
  {"name":"monterey jack cheese","category":"dairy","taste":"umami sweet","cuisines":["American","Tex-Mex"],"isJunk":False,"junkReason":""},
  {"name":"monterey jack pepper cheese","category":"dairy","taste":"spicy umami","cuisines":["American","Tex-Mex"],"isJunk":False,"junkReason":""},
  {"name":"morel mushroom","category":"vegetable","taste":"umami","cuisines":["French","Italian","Chinese"],"isJunk":False,"junkReason":""},
  {"name":"morton tender quick salt","category":"seasoning","taste":"salty","cuisines":["American"],"isJunk":True,"junkReason":"Branded product (Morton Tender Quick is a registered trademark of Morton Salt)"},
  {"name":"mostaccioli noodle","category":"grain","taste":"sweet","cuisines":["Italian"],"isJunk":False,"junkReason":""},
  {"name":"mostaccioli pasta","category":"grain","taste":"sweet","cuisines":["Italian"],"isJunk":False,"junkReason":""},
  {"name":"mountain papaya","category":"fruit","taste":"sweet sour","cuisines":["Caribbean","Peruvian","Filipino"],"isJunk":False,"junkReason":""},
  {"name":"mountain yam","category":"vegetable","taste":"sweet astringent","cuisines":["Japanese","Chinese","Korean"],"isJunk":False,"junkReason":""},
  {"name":"mozarella cheese","category":"dairy","taste":"umami","cuisines":["Italian"],"isJunk":False,"junkReason":""},
  {"name":"mozzarella","category":"dairy","taste":"umami","cuisines":["Italian"],"isJunk":False,"junkReason":""},
  {"name":"mozzarella string cheese","category":"dairy","taste":"umami","cuisines":["Italian","American"],"isJunk":False,"junkReason":""},
  {"name":"mozzerella cheese","category":"dairy","taste":"umami","cuisines":["Italian"],"isJunk":False,"junkReason":""},
  {"name":"muenster cheese","category":"dairy","taste":"umami sweet","cuisines":["French","German","American"],"isJunk":False,"junkReason":""},
  {"name":"mulberry","category":"fruit","taste":"sweet sour","cuisines":["Turkish","Persian","Chinese"],"isJunk":False,"junkReason":""},
  {"name":"multi-grain bread","category":"grain","taste":"sweet","cuisines":["German","American","Scandinavian"],"isJunk":False,"junkReason":""},
  {"name":"multigrain bread","category":"grain","taste":"sweet","cuisines":["German","American","Scandinavian"],"isJunk":False,"junkReason":""},
  {"name":"mung bean sprout","category":"vegetable","taste":"sweet astringent","cuisines":["Vietnamese","Thai","Korean","Chinese"],"isJunk":False,"junkReason":""},
  {"name":"mushroom","category":"vegetable","taste":"umami","cuisines":["Chinese","Japanese","Korean","Italian","French"],"isJunk":False,"junkReason":""},
  {"name":"mushroom broth","category":"liquid","taste":"umami salty","cuisines":["Chinese","Japanese","Italian","French"],"isJunk":False,"junkReason":""},
  {"name":"mushroom cap","category":"vegetable","taste":"umami","cuisines":["Chinese","Japanese","Italian","French"],"isJunk":False,"junkReason":""},
  {"name":"mushroom gravy","category":"condiment","taste":"umami salty","cuisines":["American","British","French"],"isJunk":False,"junkReason":""},
  {"name":"mushroom gravy mix","category":"condiment","taste":"umami salty","cuisines":["American","British"],"isJunk":False,"junkReason":""},
  {"name":"mushroom sauce","category":"condiment","taste":"umami salty","cuisines":["French","Italian","Chinese"],"isJunk":False,"junkReason":""},
  {"name":"mushroom soy sauce","category":"umami","taste":"salty umami","cuisines":["Chinese","Japanese","Vietnamese"],"isJunk":False,"junkReason":""},
  {"name":"mushroom stem","category":"vegetable","taste":"umami","cuisines":["Chinese","Japanese","Italian","French"],"isJunk":False,"junkReason":""},
  {"name":"mushroom stock","category":"liquid","taste":"umami salty","cuisines":["Chinese","Japanese","Italian","French"],"isJunk":False,"junkReason":""},
  {"name":"mussel","category":"protein","taste":"salty umami","cuisines":["Spanish","Portuguese","French","Belgian"],"isJunk":False,"junkReason":""},
  {"name":"mustard","category":"condiment","taste":"pungent spicy","cuisines":["French","American","German","Indian"],"isJunk":False,"junkReason":""},
  {"name":"mustard green","category":"vegetable","taste":"bitter pungent","cuisines":["Chinese","Indian","Southern US","Korean"],"isJunk":False,"junkReason":""},
  {"name":"mustard oil","category":"fat","taste":"pungent spicy","cuisines":["Indian","Pakistani","Bengali"],"isJunk":False,"junkReason":""},
  {"name":"mustard powder","category":"spice","taste":"pungent spicy","cuisines":["French","American","German","Indian"],"isJunk":False,"junkReason":""},
  {"name":"mustard sauce","category":"condiment","taste":"pungent spicy","cuisines":["French","American","German"],"isJunk":False,"junkReason":""},
  {"name":"mustard seed","category":"spice","taste":"pungent spicy","cuisines":["Indian","Pakistani","German","French"],"isJunk":False,"junkReason":""},
  {"name":"mutton","category":"protein","taste":"umami","cuisines":["Indian","Pakistani","Moroccan","Persian"],"isJunk":False,"junkReason":""},
  {"name":"myrtle","category":"herb","taste":"pungent bitter","cuisines":["Sardinian","Corsican","Moroccan"],"isJunk":False,"junkReason":""},
  {"name":"nacho cheese","category":"dairy","taste":"spicy umami salty","cuisines":["American","Tex-Mex"],"isJunk":False,"junkReason":""},
  {"name":"nacho cheese dorito","category":"baked","taste":"spicy salty umami","cuisines":["American","Tex-Mex"],"isJunk":True,"junkReason":"Branded product (Doritos is a registered trademark of Frito-Lay/PepsiCo)"},
  {"name":"nacho cheese flavor","category":"other","taste":"spicy umami salty","cuisines":["American","Tex-Mex"],"isJunk":True,"junkReason":"Flavor descriptor, not a specific ingredient"},
  {"name":"nacho cheese soup","category":"liquid","taste":"spicy umami salty","cuisines":["American","Tex-Mex"],"isJunk":False,"junkReason":""},
  {"name":"nance","category":"fruit","taste":"sour sweet","cuisines":["Caribbean","Mexican","Central American"],"isJunk":False,"junkReason":""},
  {"name":"naranjilla","category":"fruit","taste":"sour sweet","cuisines":["Peruvian","Colombian","Ecuadorian"],"isJunk":False,"junkReason":""},
  {"name":"narrowleaf cattail","category":"vegetable","taste":"sweet astringent","cuisines":["American"],"isJunk":False,"junkReason":""},
  {"name":"navy bean","category":"protein","taste":"umami","cuisines":["American","British","French"],"isJunk":False,"junkReason":""},
  {"name":"neck clam","category":"protein","taste":"salty umami","cuisines":["American","Portuguese"],"isJunk":False,"junkReason":""},
  {"name":"nectarine","category":"fruit","taste":"sweet sour","cuisines":["American","French","Italian"],"isJunk":False,"junkReason":""},
  {"name":"neroli oil","category":"fat","taste":"sweet pungent","cuisines":["Moroccan","French"],"isJunk":False,"junkReason":""},
  {"name":"neufchatel cheese","category":"dairy","taste":"sour umami","cuisines":["French","American"],"isJunk":False,"junkReason":""},
  {"name":"neutral oil","category":"fat","taste":"sweet","cuisines":["Global"],"isJunk":False,"junkReason":""},
  {"name":"new potato","category":"vegetable","taste":"sweet","cuisines":["British","French"],"isJunk":False,"junkReason":""},
  {"name":"new potatoe","category":"vegetable","taste":"sweet","cuisines":["British","French"],"isJunk":False,"junkReason":""},
  {"name":"new red potatoe","category":"vegetable","taste":"sweet","cuisines":["American","British","French"],"isJunk":False,"junkReason":""},
  {"name":"niblets corn","category":"vegetable","taste":"sweet","cuisines":["American","Mexican"],"isJunk":False,"junkReason":""},
  {"name":"nicoise olive","category":"vegetable","taste":"salty bitter","cuisines":["French"],"isJunk":False,"junkReason":""},
  {"name":"nigella seed","category":"spice","taste":"bitter pungent","cuisines":["Indian","Pakistani","Ethiopian","Turkish"],"isJunk":False,"junkReason":""},
  {"name":"nilla vanilla wafer","category":"baked","taste":"sweet","cuisines":["American"],"isJunk":True,"junkReason":"Branded product (Nilla is a registered trademark of Nabisco/Mondelez)"},
  {"name":"niçoise olive","category":"vegetable","taste":"salty bitter","cuisines":["French"],"isJunk":False,"junkReason":""},
  {"name":"non-dairy coffee creamer","category":"other","taste":"sweet","cuisines":["American","Global"],"isJunk":False,"junkReason":""},
  {"name":"non-dairy milk","category":"liquid","taste":"sweet","cuisines":["Global"],"isJunk":False,"junkReason":""},
  {"name":"nondairy creamer","category":"other","taste":"sweet","cuisines":["American","Global"],"isJunk":False,"junkReason":""},
  {"name":"nondairy whipped topping","category":"other","taste":"sweet","cuisines":["American"],"isJunk":False,"junkReason":""},
  {"name":"noodle","category":"grain","taste":"sweet","cuisines":["Chinese","Japanese","Korean","Vietnamese","Thai"],"isJunk":False,"junkReason":""},
  {"name":"noodle soup","category":"liquid","taste":"umami salty","cuisines":["Chinese","Japanese","Korean","Vietnamese","Thai"],"isJunk":True,"junkReason":"Prepared dish, not a single ingredient"},
  {"name":"nopal","category":"vegetable","taste":"sour astringent","cuisines":["Mexican","Peruvian"],"isJunk":False,"junkReason":""},
  {"name":"nori","category":"umami","taste":"umami salty","cuisines":["Japanese","Korean"],"isJunk":False,"junkReason":""},
  {"name":"northern bean","category":"protein","taste":"umami","cuisines":["American","Mexican","French"],"isJunk":False,"junkReason":""},
  {"name":"nut","category":"nut","taste":"sweet bitter","cuisines":["Global"],"isJunk":True,"junkReason":"Overly generic — not a single identifiable ingredient"},
  {"name":"nut butter","category":"condiment","taste":"sweet umami","cuisines":["American","Global"],"isJunk":False,"junkReason":""},
  {"name":"nut oil","category":"fat","taste":"sweet","cuisines":["French","Global"],"isJunk":False,"junkReason":""},
  {"name":"nutella","category":"condiment","taste":"sweet bitter","cuisines":["Italian","French"],"isJunk":True,"junkReason":"Branded product (Nutella is a registered trademark of Ferrero)"},
  {"name":"nutmeat","category":"protein","taste":"umami","cuisines":["Global"],"isJunk":False,"junkReason":""},
  {"name":"nutmeg","category":"spice","taste":"pungent sweet","cuisines":["Indonesian","Indian","Caribbean","French"],"isJunk":False,"junkReason":""},
  {"name":"nutmeg freshly","category":"spice","taste":"pungent sweet","cuisines":["Indonesian","Indian","Caribbean","French"],"isJunk":False,"junkReason":""},
  {"name":"nutmeg powder","category":"spice","taste":"pungent sweet","cuisines":["Indonesian","Indian","Caribbean","French"],"isJunk":False,"junkReason":""},
  {"name":"nutritional yeast","category":"umami","taste":"umami","cuisines":["Global"],"isJunk":False,"junkReason":""},
  {"name":"o gelatin","category":"thickener","taste":"sweet","cuisines":["American"],"isJunk":False,"junkReason":""},
  {"name":"o lakes egg","category":"protein","taste":"umami","cuisines":["Global"],"isJunk":True,"junkReason":"Branded product (Land O Lakes is a registered trademark)"},
  {"name":"o'brien potatoe","category":"vegetable","taste":"sweet pungent","cuisines":["American","Southern US"],"isJunk":False,"junkReason":""},
  {"name":"oat","category":"grain","taste":"sweet","cuisines":["British","Scandinavian","American"],"isJunk":False,"junkReason":""},
  {"name":"oat bread","category":"baked","taste":"sweet","cuisines":["British","Scandinavian","American"],"isJunk":False,"junkReason":""},
  {"name":"oatmeal","category":"grain","taste":"sweet","cuisines":["American","British","Scandinavian"],"isJunk":False,"junkReason":""},
  {"name":"oaxaca cheese","category":"dairy","taste":"umami","cuisines":["Mexican"],"isJunk":False,"junkReason":""},
  {"name":"oil palm","category":"fat","taste":"sweet","cuisines":["West African","Indonesian","Malaysian"],"isJunk":False,"junkReason":""},
  {"name":"oil-cured black olive","category":"vegetable","taste":"salty bitter","cuisines":["Italian","Moroccan","Spanish"],"isJunk":False,"junkReason":""},
  {"name":"oil-cured olive","category":"vegetable","taste":"salty bitter","cuisines":["Italian","Moroccan","Spanish"],"isJunk":False,"junkReason":""},
  {"name":"oil-seed camellia","category":"fat","taste":"sweet","cuisines":["Chinese","Japanese"],"isJunk":False,"junkReason":""},
  {"name":"okra","category":"vegetable","taste":"astringent sweet","cuisines":["West African","Southern US","Indian","Cajun/Creole"],"isJunk":False,"junkReason":""},
  {"name":"old-fashioned oatmeal","category":"grain","taste":"sweet","cuisines":["American","British","Scandinavian"],"isJunk":False,"junkReason":""},
  {"name":"olive","category":"vegetable","taste":"salty bitter","cuisines":["Italian","Greek","Spanish","Lebanese","Moroccan"],"isJunk":False,"junkReason":""},
  {"name":"olive juice","category":"liquid","taste":"salty bitter","cuisines":["Italian","Greek","Spanish","Lebanese"],"isJunk":False,"junkReason":""},
  {"name":"olive oil","category":"fat","taste":"sweet","cuisines":["Global"],"isJunk":False,"junkReason":""},
  {"name":"olive oil cooking spray","category":"fat","taste":"sweet","cuisines":["Global"],"isJunk":False,"junkReason":""},
]

inp = json.load(open('.ralph/audit_batches/batch_23.json', encoding='utf-8'))
assert len(data) == len(inp), f'LENGTH MISMATCH {len(data)} vs {len(inp)}'
for i,(d,r) in enumerate(zip(data,inp)):
    if d['name'] != r['name']:
        print(f'NAME MISMATCH at {i}: got {repr(d["name"])} expected {repr(r["name"])}')
        d['name'] = r['name']

with open('.ralph/audit_batches/batch_23.out.json','w',encoding='utf-8') as f:
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
