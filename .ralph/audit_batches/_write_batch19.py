import json

data = [
  {"name":"jaggery","category":"sweetener","taste":"sweet","cuisines":["Indian","Pakistani","Sri Lankan"],"isJunk":False,"junkReason":""},
  {"name":"jalapeno bean","category":"protein","taste":"spicy umami","cuisines":["Mexican","Tex-Mex"],"isJunk":False,"junkReason":""},
  {"name":"jalapeno bean dip","category":"condiment","taste":"spicy umami","cuisines":["Mexican","Tex-Mex","American"],"isJunk":False,"junkReason":""},
  {"name":"jalapeno cheese","category":"dairy","taste":"spicy umami salty","cuisines":["American","Tex-Mex"],"isJunk":False,"junkReason":""},
  {"name":"jalapeno cheez whiz","category":"condiment","taste":"spicy umami salty","cuisines":["American","Tex-Mex"],"isJunk":True,"junkReason":"Branded product (Cheez Whiz is a registered trademark of Kraft Heinz)"},
  {"name":"jalapeno chile","category":"chili","taste":"spicy pungent","cuisines":["Mexican","Tex-Mex"],"isJunk":False,"junkReason":""},
  {"name":"jalapeno chili","category":"chili","taste":"spicy pungent","cuisines":["Mexican","Tex-Mex"],"isJunk":False,"junkReason":""},
  {"name":"jalapeno chilie","category":"chili","taste":"spicy pungent","cuisines":["Mexican","Tex-Mex"],"isJunk":False,"junkReason":""},
  {"name":"jalapeno jelly","category":"condiment","taste":"sweet spicy","cuisines":["American","Tex-Mex"],"isJunk":False,"junkReason":""},
  {"name":"jalapeno juice","category":"liquid","taste":"spicy sour","cuisines":["Mexican","American"],"isJunk":False,"junkReason":""},
  {"name":"jalapeno relish","category":"condiment","taste":"spicy sour","cuisines":["American","Tex-Mex"],"isJunk":False,"junkReason":""},
  {"name":"jalapeno sauce","category":"condiment","taste":"spicy sour","cuisines":["Mexican","American","Tex-Mex"],"isJunk":False,"junkReason":""},
  {"name":"jalapeño","category":"chili","taste":"spicy pungent","cuisines":["Mexican","Tex-Mex"],"isJunk":False,"junkReason":""},
  {"name":"jalepeno pepper","category":"chili","taste":"spicy pungent","cuisines":["Mexican","Tex-Mex"],"isJunk":False,"junkReason":""},
  {"name":"jam","category":"condiment","taste":"sweet","cuisines":["British","French","American"],"isJunk":False,"junkReason":""},
  {"name":"jamón ibérico","category":"protein","taste":"salty umami","cuisines":["Spanish"],"isJunk":False,"junkReason":""},
  {"name":"japanese breadcrumb","category":"baked","taste":"sweet","cuisines":["Japanese","Korean"],"isJunk":False,"junkReason":""},
  {"name":"japanese eggplant","category":"vegetable","taste":"bitter astringent","cuisines":["Japanese","Chinese","Korean"],"isJunk":False,"junkReason":""},
  {"name":"japanese mustard","category":"condiment","taste":"pungent spicy","cuisines":["Japanese"],"isJunk":False,"junkReason":""},
  {"name":"japanese persimmon","category":"fruit","taste":"sweet astringent","cuisines":["Japanese","Korean","Chinese"],"isJunk":False,"junkReason":""},
  {"name":"japanese whisky","category":"spirit","taste":"bitter","cuisines":["Japanese"],"isJunk":False,"junkReason":""},
  {"name":"jarlsberg cheese","category":"dairy","taste":"umami sweet","cuisines":["Scandinavian","Norwegian"],"isJunk":False,"junkReason":""},
  {"name":"jasmine","category":"other","taste":"sweet pungent","cuisines":["Persian","Thai","Moroccan"],"isJunk":False,"junkReason":""},
  {"name":"jello gelatin","category":"confection","taste":"sweet","cuisines":["American"],"isJunk":True,"junkReason":"Branded product (Jello is a registered trademark of Kraft Heinz)"},
  {"name":"jelly","category":"condiment","taste":"sweet","cuisines":["British","American"],"isJunk":False,"junkReason":""},
  {"name":"jellyfish","category":"protein","taste":"salty","cuisines":["Chinese","Japanese","Korean"],"isJunk":False,"junkReason":""},
  {"name":"jerk spice","category":"spice","taste":"spicy pungent","cuisines":["Caribbean","West African"],"isJunk":False,"junkReason":""},
  {"name":"jersey royal potatoe","category":"vegetable","taste":"sweet","cuisines":["British"],"isJunk":False,"junkReason":""},
  {"name":"jerusalem artichoke","category":"vegetable","taste":"sweet umami","cuisines":["French","British","Italian"],"isJunk":False,"junkReason":""},
  {"name":"jew's ear","category":"umami","taste":"umami","cuisines":["Chinese","Japanese","Korean"],"isJunk":False,"junkReason":""},
  {"name":"jicama","category":"vegetable","taste":"sweet astringent","cuisines":["Mexican","Filipino","Vietnamese"],"isJunk":False,"junkReason":""},
  {"name":"jif creamy","category":"condiment","taste":"sweet umami","cuisines":["American"],"isJunk":True,"junkReason":"Branded product (Jif is a registered trademark of J.M. Smucker Company)"},
  {"name":"jif peanut butter","category":"condiment","taste":"sweet umami","cuisines":["American"],"isJunk":True,"junkReason":"Branded product (Jif is a registered trademark of J.M. Smucker Company)"},
  {"name":"juice","category":"liquid","taste":"sweet sour","cuisines":["Global"],"isJunk":True,"junkReason":"Overly generic — not a single identifiable ingredient"},
  {"name":"juice from","category":"liquid","taste":"sweet sour","cuisines":["Global"],"isJunk":True,"junkReason":"Artifact parse fragment — not a standalone ingredient"},
  {"name":"jujube","category":"fruit","taste":"sweet","cuisines":["Chinese","Korean","Persian"],"isJunk":False,"junkReason":""},
  {"name":"julienne carrot","category":"vegetable","taste":"sweet","cuisines":["French","Vietnamese","Chinese","Korean"],"isJunk":False,"junkReason":""},
  {"name":"julienne-cut carrot","category":"vegetable","taste":"sweet","cuisines":["French","Vietnamese","Chinese","Korean"],"isJunk":False,"junkReason":""},
  {"name":"jumbo egg","category":"protein","taste":"umami","cuisines":["Global"],"isJunk":False,"junkReason":""},
  {"name":"jumbo lump crabmeat","category":"protein","taste":"salty umami","cuisines":["American","Cajun/Creole"],"isJunk":False,"junkReason":""},
  {"name":"jumbo pasta","category":"grain","taste":"sweet","cuisines":["Italian"],"isJunk":False,"junkReason":""},
  {"name":"jumbo pasta shell","category":"grain","taste":"sweet","cuisines":["Italian"],"isJunk":False,"junkReason":""},
  {"name":"jumbo shrimp","category":"protein","taste":"salty umami","cuisines":["Cajun/Creole","Thai","Vietnamese","Chinese"],"isJunk":False,"junkReason":""},
  {"name":"juniper berrie","category":"spice","taste":"spicy bitter","cuisines":["Scandinavian","German","French"],"isJunk":False,"junkReason":""},
  {"name":"jute","category":"vegetable","taste":"bitter astringent","cuisines":["West African","Ethiopian","Egyptian"],"isJunk":False,"junkReason":""},
  {"name":"kaffir lime","category":"citrus","taste":"sour bitter","cuisines":["Thai","Indonesian","Malaysian"],"isJunk":False,"junkReason":""},
  {"name":"kahlua","category":"liqueur","taste":"sweet bitter","cuisines":["Mexican"],"isJunk":False,"junkReason":""},
  {"name":"kai lan","category":"vegetable","taste":"bitter astringent","cuisines":["Chinese","Malaysian","Filipino"],"isJunk":False,"junkReason":""},
  {"name":"kalamata olive","category":"vegetable","taste":"salty bitter","cuisines":["Greek","Italian","Lebanese","Turkish"],"isJunk":False,"junkReason":""},
  {"name":"kale","category":"vegetable","taste":"bitter astringent","cuisines":["American","Italian","Portuguese"],"isJunk":False,"junkReason":""},
  {"name":"kasuri methi","category":"herb","taste":"bitter pungent","cuisines":["Indian","Pakistani"],"isJunk":False,"junkReason":""},
  {"name":"kelp","category":"umami","taste":"umami salty","cuisines":["Japanese","Korean","Chinese"],"isJunk":False,"junkReason":""},
  {"name":"kenaf","category":"vegetable","taste":"bitter astringent","cuisines":["West African","Japanese"],"isJunk":False,"junkReason":""},
  {"name":"kernel corn","category":"vegetable","taste":"sweet","cuisines":["American","Mexican","Southern US"],"isJunk":False,"junkReason":""},
  {"name":"kernel sweet corn","category":"vegetable","taste":"sweet","cuisines":["American","Mexican"],"isJunk":False,"junkReason":""},
  {"name":"ketchup","category":"condiment","taste":"sweet sour","cuisines":["American","Global"],"isJunk":False,"junkReason":""},
  {"name":"ketjap manis","category":"condiment","taste":"sweet umami","cuisines":["Indonesian","Malaysian"],"isJunk":False,"junkReason":""},
  {"name":"kewda","category":"other","taste":"sweet pungent","cuisines":["Indian","Pakistani"],"isJunk":False,"junkReason":""},
  {"name":"key lime juice","category":"citrus","taste":"sour","cuisines":["American","Caribbean","Mexican"],"isJunk":False,"junkReason":""},
  {"name":"kidney bean","category":"protein","taste":"umami","cuisines":["Mexican","Indian","American","Cajun/Creole"],"isJunk":False,"junkReason":""},
  {"name":"kielbasa sausage","category":"protein","taste":"salty umami","cuisines":["Polish","German","Cajun/Creole"],"isJunk":False,"junkReason":""},
  {"name":"king crab","category":"protein","taste":"salty umami","cuisines":["Japanese","Scandinavian","American"],"isJunk":False,"junkReason":""},
  {"name":"king prawn","category":"protein","taste":"salty umami","cuisines":["Australian","British","Thai"],"isJunk":False,"junkReason":""},
  {"name":"king syrup","category":"sweetener","taste":"sweet","cuisines":["American","Southern US"],"isJunk":False,"junkReason":""},
  {"name":"kitchen twine","category":"other","taste":"sweet","cuisines":["Global"],"isJunk":True,"junkReason":"Not a food ingredient — kitchen twine is a cooking tool/supply"},
  {"name":"kiwi","category":"fruit","taste":"sour sweet","cuisines":["Global"],"isJunk":False,"junkReason":""},
  {"name":"kiwi fruit","category":"fruit","taste":"sour sweet","cuisines":["Global"],"isJunk":False,"junkReason":""},
  {"name":"kiwi liqueur","category":"liqueur","taste":"sweet sour","cuisines":["Global"],"isJunk":False,"junkReason":""},
  {"name":"knob butter","category":"fat","taste":"sweet","cuisines":["French","British"],"isJunk":False,"junkReason":""},
  {"name":"knob ginger","category":"aromatic","taste":"spicy pungent","cuisines":["Chinese","Indian","Thai","Japanese","Korean"],"isJunk":False,"junkReason":""},
  {"name":"knob of butter","category":"fat","taste":"sweet","cuisines":["French","British"],"isJunk":False,"junkReason":""},
  {"name":"knorr chicken","category":"umami","taste":"salty umami","cuisines":["Global"],"isJunk":True,"junkReason":"Branded product (Knorr is a registered trademark of Unilever)"},
  {"name":"kohlrabi","category":"vegetable","taste":"sweet astringent","cuisines":["German","Indian","Chinese"],"isJunk":False,"junkReason":""},
  {"name":"komatsuna","category":"vegetable","taste":"bitter astringent","cuisines":["Japanese","Korean"],"isJunk":False,"junkReason":""},
  {"name":"kombu","category":"umami","taste":"umami salty","cuisines":["Japanese","Korean"],"isJunk":False,"junkReason":""},
  {"name":"korean red pepper","category":"chili","taste":"spicy pungent","cuisines":["Korean"],"isJunk":False,"junkReason":""},
  {"name":"kosher dill","category":"condiment","taste":"sour salty","cuisines":["American","Eastern European","German"],"isJunk":False,"junkReason":""},
  {"name":"kosher dill pickle","category":"condiment","taste":"sour salty","cuisines":["American","Eastern European","German"],"isJunk":False,"junkReason":""},
  {"name":"kosher sea salt","category":"seasoning","taste":"salty","cuisines":["Global"],"isJunk":False,"junkReason":""},
  {"name":"krill","category":"protein","taste":"salty umami","cuisines":["Japanese","Korean","Scandinavian"],"isJunk":False,"junkReason":""},
  {"name":"kumquat","category":"citrus","taste":"sour sweet bitter","cuisines":["Chinese","Japanese","Vietnamese"],"isJunk":False,"junkReason":""},
  {"name":"ladyfinger cookie","category":"baked","taste":"sweet","cuisines":["Italian","French"],"isJunk":False,"junkReason":""},
  {"name":"lager beer","category":"liquid","taste":"bitter","cuisines":["German","British","Czech"],"isJunk":False,"junkReason":""},
  {"name":"lake trout","category":"protein","taste":"umami","cuisines":["American","Scandinavian"],"isJunk":False,"junkReason":""},
  {"name":"lamb","category":"protein","taste":"umami","cuisines":["Australian","Greek","Turkish","Moroccan","Indian","Persian"],"isJunk":False,"junkReason":""},
  {"name":"lamb chop","category":"protein","taste":"umami","cuisines":["Australian","Greek","Turkish","Moroccan"],"isJunk":False,"junkReason":""},
  {"name":"lamb fillet","category":"protein","taste":"umami","cuisines":["Australian","Greek","Turkish","Moroccan"],"isJunk":False,"junkReason":""},
  {"name":"lamb leg","category":"protein","taste":"umami","cuisines":["Australian","Greek","Turkish","Moroccan","Indian","Persian"],"isJunk":False,"junkReason":""},
  {"name":"lamb loin","category":"protein","taste":"umami","cuisines":["Australian","French","Greek","Turkish"],"isJunk":False,"junkReason":""},
  {"name":"lamb loin chop","category":"protein","taste":"umami","cuisines":["Australian","Greek","Turkish","Moroccan"],"isJunk":False,"junkReason":""},
  {"name":"lamb meat","category":"protein","taste":"umami","cuisines":["Australian","Greek","Turkish","Moroccan","Indian","Persian"],"isJunk":False,"junkReason":""},
  {"name":"lamb mince","category":"protein","taste":"umami","cuisines":["Australian","Greek","Turkish","Moroccan","Indian"],"isJunk":False,"junkReason":""},
  {"name":"lamb rack","category":"protein","taste":"umami","cuisines":["French","Australian","Greek","Turkish"],"isJunk":False,"junkReason":""},
  {"name":"lamb shank","category":"protein","taste":"umami","cuisines":["Australian","Greek","Turkish","Moroccan","Persian"],"isJunk":False,"junkReason":""},
  {"name":"lamb shoulder","category":"protein","taste":"umami","cuisines":["Australian","Greek","Turkish","Moroccan","Indian"],"isJunk":False,"junkReason":""},
  {"name":"lamb shoulder chop","category":"protein","taste":"umami","cuisines":["Australian","Greek","Turkish","Moroccan"],"isJunk":False,"junkReason":""},
  {"name":"lamb stew meat","category":"protein","taste":"umami","cuisines":["Australian","Greek","Turkish","Moroccan","Indian"],"isJunk":False,"junkReason":""},
  {"name":"lamb stock","category":"liquid","taste":"umami salty","cuisines":["French","British","Moroccan"],"isJunk":False,"junkReason":""},
  {"name":"lambsquarter","category":"vegetable","taste":"bitter astringent","cuisines":["Indian","American","Ethiopian"],"isJunk":False,"junkReason":""},
  {"name":"lard","category":"fat","taste":"sweet","cuisines":["American","Spanish","Mexican","Southern US"],"isJunk":False,"junkReason":""},
]

inp = json.load(open('.ralph/audit_batches/batch_19.json', encoding='utf-8'))
assert len(data) == len(inp), f'LENGTH MISMATCH {len(data)} vs {len(inp)}'
for i,(d,r) in enumerate(zip(data,inp)):
    if d['name'] != r['name']:
        print(f'NAME MISMATCH at {i}: got {repr(d["name"])} expected {repr(r["name"])}')
        d['name'] = r['name']

with open('.ralph/audit_batches/batch_19.out.json','w',encoding='utf-8') as f:
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
