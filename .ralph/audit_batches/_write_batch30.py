import json

data = [
  {"name":"rump steak","category":"protein","taste":"umami salty","cuisines":["British","Australian","Argentine"],"isJunk":False,"junkReason":""},
  {"name":"runner bean","category":"vegetable","taste":"sweet astringent","cuisines":["British","Indian","Italian"],"isJunk":False,"junkReason":""},
  {"name":"runny honey","category":"sweetener","taste":"sweet","cuisines":["Global"],"isJunk":False,"junkReason":""},
  {"name":"russet potatoe","category":"vegetable","taste":"sweet umami","cuisines":["American","Peruvian","French","German"],"isJunk":False,"junkReason":""},
  {"name":"rutabaga","category":"vegetable","taste":"sweet bitter","cuisines":["Scandinavian","British","German","American"],"isJunk":False,"junkReason":""},
  {"name":"rye","category":"grain","taste":"bitter umami","cuisines":["German","Scandinavian","Eastern European","Russian"],"isJunk":False,"junkReason":""},
  {"name":"rye bread","category":"baked","taste":"bitter sweet umami","cuisines":["German","Scandinavian","Russian","Eastern European"],"isJunk":False,"junkReason":""},
  {"name":"rye cocktail bread","category":"baked","taste":"bitter sweet umami","cuisines":["Scandinavian","German","Russian"],"isJunk":False,"junkReason":""},
  {"name":"rye flour","category":"grain","taste":"bitter sweet","cuisines":["German","Scandinavian","Eastern European"],"isJunk":False,"junkReason":""},
  {"name":"safflower oil","category":"fat","taste":"sweet","cuisines":["Global"],"isJunk":False,"junkReason":""},
  {"name":"saffron","category":"spice","taste":"bitter pungent","cuisines":["Spanish","Persian","Indian","Moroccan","Italian"],"isJunk":False,"junkReason":""},
  {"name":"saffron powder","category":"spice","taste":"bitter pungent","cuisines":["Spanish","Persian","Indian","Moroccan","Pakistani"],"isJunk":False,"junkReason":""},
  {"name":"saffron rice","category":"grain","taste":"sweet umami bitter","cuisines":["Spanish","Persian","Indian","Moroccan"],"isJunk":False,"junkReason":""},
  {"name":"sage","category":"herb","taste":"bitter pungent","cuisines":["Italian","French","British","German"],"isJunk":False,"junkReason":""},
  {"name":"sage leaf","category":"herb","taste":"bitter pungent","cuisines":["Italian","French","British"],"isJunk":False,"junkReason":""},
  {"name":"sage sausage","category":"protein","taste":"umami salty spicy","cuisines":["American","Southern US","British"],"isJunk":False,"junkReason":""},
  {"name":"sago palm","category":"thickener","taste":"sweet","cuisines":["Indonesian","Filipino","Malaysian","Pacific Islander"],"isJunk":False,"junkReason":""},
  {"name":"sake","category":"spirit","taste":"sweet umami","cuisines":["Japanese"],"isJunk":False,"junkReason":""},
  {"name":"salad dressing","category":"condiment","taste":"sour pungent","cuisines":["American","French","Italian"],"isJunk":True,"junkReason":"Too generic — hundreds of distinct dressings exist"},
  {"name":"salad dressing mix","category":"condiment","taste":"sour pungent","cuisines":["American"],"isJunk":True,"junkReason":"Too generic — not a specific ingredient"},
  {"name":"salad mustard","category":"condiment","taste":"pungent sour","cuisines":["American","German","French"],"isJunk":False,"junkReason":""},
  {"name":"salad oil","category":"fat","taste":"sweet","cuisines":["Global"],"isJunk":False,"junkReason":""},
  {"name":"salad olive","category":"condiment","taste":"salty sour bitter","cuisines":["Spanish","Italian","Greek","Turkish","Lebanese"],"isJunk":False,"junkReason":""},
  {"name":"salad onion","category":"aromatic","taste":"pungent sweet","cuisines":["French","Indian","Italian","Turkish"],"isJunk":False,"junkReason":""},
  {"name":"salad shrimp","category":"protein","taste":"umami salty","cuisines":["American","Cajun/Creole","Thai","Vietnamese"],"isJunk":False,"junkReason":""},
  {"name":"salad vinegar","category":"acid","taste":"sour","cuisines":["French","Italian","American"],"isJunk":False,"junkReason":""},
  {"name":"salmon","category":"protein","taste":"umami salty","cuisines":["Scandinavian","Japanese","Russian","American","British"],"isJunk":False,"junkReason":""},
  {"name":"salmon filet","category":"protein","taste":"umami salty","cuisines":["Scandinavian","Japanese","Russian","American"],"isJunk":False,"junkReason":""},
  {"name":"salmon fillet","category":"protein","taste":"umami salty","cuisines":["Scandinavian","Japanese","Russian","American","British"],"isJunk":False,"junkReason":""},
  {"name":"salmon roe","category":"protein","taste":"umami salty","cuisines":["Japanese","Scandinavian","Russian"],"isJunk":False,"junkReason":""},
  {"name":"salmon steak","category":"protein","taste":"umami salty","cuisines":["Scandinavian","Japanese","American","British"],"isJunk":False,"junkReason":""},
  {"name":"salmonberry","category":"fruit","taste":"sweet sour","cuisines":["American","Canadian"],"isJunk":False,"junkReason":""},
  {"name":"salsa","category":"condiment","taste":"spicy sour","cuisines":["Mexican","Tex-Mex","American"],"isJunk":False,"junkReason":""},
  {"name":"salt","category":"seasoning","taste":"salty","cuisines":["Global"],"isJunk":False,"junkReason":""},
  {"name":"salt cod","category":"protein","taste":"salty umami","cuisines":["Portuguese","Spanish","Caribbean","Scandinavian"],"isJunk":False,"junkReason":""},
  {"name":"salt pork","category":"protein","taste":"umami salty","cuisines":["American","Southern US","Caribbean","Chinese"],"isJunk":False,"junkReason":""},
  {"name":"salt substitute","category":"seasoning","taste":"salty","cuisines":["Global"],"isJunk":False,"junkReason":""},
  {"name":"salt water","category":"liquid","taste":"salty","cuisines":["Global"],"isJunk":False,"junkReason":""},
  {"name":"salted","category":"other","taste":"salty","cuisines":["Global"],"isJunk":True,"junkReason":"Parse artifact — adjective not a standalone ingredient"},
  {"name":"salted spanish peanut","category":"nut","taste":"umami salty sweet","cuisines":["Spanish","American","West African","Thai"],"isJunk":False,"junkReason":""},
  {"name":"saltine","category":"baked","taste":"salty sweet","cuisines":["American"],"isJunk":False,"junkReason":""},
  {"name":"saltine cracker","category":"baked","taste":"salty sweet","cuisines":["American"],"isJunk":False,"junkReason":""},
  {"name":"saltine cracker crumb","category":"baked","taste":"salty sweet","cuisines":["American","British"],"isJunk":False,"junkReason":""},
  {"name":"saltine crumb","category":"baked","taste":"salty sweet","cuisines":["American","British"],"isJunk":False,"junkReason":""},
  {"name":"sambal","category":"condiment","taste":"spicy pungent","cuisines":["Indonesian","Malaysian","Singaporean","Thai"],"isJunk":False,"junkReason":""},
  {"name":"sambal oelek chili paste","category":"condiment","taste":"spicy pungent","cuisines":["Indonesian","Malaysian","Singaporean"],"isJunk":False,"junkReason":""},
  {"name":"sambar powder","category":"spice","taste":"spicy umami pungent","cuisines":["Indian","Sri Lankan"],"isJunk":False,"junkReason":""},
  {"name":"sambuca","category":"liqueur","taste":"sweet pungent","cuisines":["Italian"],"isJunk":False,"junkReason":""},
  {"name":"sanding sugar","category":"sweetener","taste":"sweet","cuisines":["Global"],"isJunk":False,"junkReason":""},
  {"name":"sandwich cookie","category":"confection","taste":"sweet","cuisines":["American"],"isJunk":False,"junkReason":""},
  {"name":"sapodilla","category":"fruit","taste":"sweet","cuisines":["Mexican","Caribbean","Filipino","Indian"],"isJunk":False,"junkReason":""},
  {"name":"sardine","category":"protein","taste":"umami salty","cuisines":["Portuguese","Spanish","Italian","Moroccan"],"isJunk":False,"junkReason":""},
  {"name":"sarsaparilla","category":"other","taste":"bitter sweet pungent","cuisines":["American","Caribbean","Mexican"],"isJunk":False,"junkReason":""},
  {"name":"saskatoon berrie","category":"fruit","taste":"sweet sour","cuisines":["Canadian","American"],"isJunk":False,"junkReason":""},
  {"name":"sausage","category":"protein","taste":"umami salty spicy","cuisines":["German","American","Italian","French","British"],"isJunk":False,"junkReason":""},
  {"name":"sausage pattie","category":"protein","taste":"umami salty spicy","cuisines":["American","British"],"isJunk":False,"junkReason":""},
  {"name":"sauterne wine","category":"liquid","taste":"sweet sour","cuisines":["French"],"isJunk":False,"junkReason":""},
  {"name":"savory","category":"herb","taste":"bitter pungent","cuisines":["French","Italian","Eastern European","Balkan"],"isJunk":False,"junkReason":""},
  {"name":"savoy cabbage","category":"vegetable","taste":"bitter sweet","cuisines":["French","Italian","German","Eastern European"],"isJunk":False,"junkReason":""},
  {"name":"scallion","category":"aromatic","taste":"pungent sweet","cuisines":["Chinese","Korean","Japanese","American","Vietnamese"],"isJunk":False,"junkReason":""},
  {"name":"scallion green","category":"aromatic","taste":"pungent sweet","cuisines":["Chinese","Korean","Japanese","American","Vietnamese"],"isJunk":False,"junkReason":""},
  {"name":"scallions including green top","category":"aromatic","taste":"pungent sweet","cuisines":["Chinese","Korean","Japanese","American","Vietnamese"],"isJunk":False,"junkReason":""},
  {"name":"scallop","category":"protein","taste":"umami sweet salty","cuisines":["French","Japanese","American","Chinese"],"isJunk":False,"junkReason":""},
  {"name":"scotch","category":"spirit","taste":"bitter sweet pungent","cuisines":["British","Global"],"isJunk":False,"junkReason":""},
  {"name":"scotch bonnet","category":"chili","taste":"spicy sweet","cuisines":["Caribbean","West African","Jamaican"],"isJunk":False,"junkReason":""},
  {"name":"scotch whiskey","category":"spirit","taste":"bitter sweet pungent","cuisines":["British"],"isJunk":False,"junkReason":""},
  {"name":"sea bass fillet","category":"protein","taste":"umami salty","cuisines":["British","French","Japanese","Chilean"],"isJunk":False,"junkReason":""},
  {"name":"sea buckthorn","category":"fruit","taste":"sour sweet","cuisines":["Scandinavian","Russian","German","Chinese"],"isJunk":False,"junkReason":""},
  {"name":"sea cucumber","category":"protein","taste":"umami salty","cuisines":["Chinese","Japanese","Korean","Malaysian"],"isJunk":False,"junkReason":""},
  {"name":"sea trout","category":"protein","taste":"umami salty","cuisines":["British","Scandinavian","American"],"isJunk":False,"junkReason":""},
  {"name":"seafood sauce","category":"condiment","taste":"sour spicy sweet","cuisines":["American","British","French"],"isJunk":False,"junkReason":""},
  {"name":"seafood stock","category":"liquid","taste":"umami salty","cuisines":["French","Italian","Spanish","Japanese"],"isJunk":False,"junkReason":""},
  {"name":"seashell pasta","category":"grain","taste":"sweet umami","cuisines":["Italian"],"isJunk":False,"junkReason":""},
  {"name":"season salt","category":"seasoning","taste":"salty spicy pungent","cuisines":["American"],"isJunk":False,"junkReason":""},
  {"name":"seasoning salt","category":"seasoning","taste":"salty spicy pungent","cuisines":["American"],"isJunk":False,"junkReason":""},
  {"name":"seasoning sauce","category":"condiment","taste":"umami salty","cuisines":["Thai","Asian"],"isJunk":False,"junkReason":""},
  {"name":"seed","category":"nut","taste":"umami sweet","cuisines":["Global"],"isJunk":True,"junkReason":"Too generic — not a specific ingredient"},
  {"name":"seeded mustard","category":"condiment","taste":"pungent sour spicy","cuisines":["French","British","German","American"],"isJunk":False,"junkReason":""},
  {"name":"seeded raisin","category":"fruit","taste":"sweet","cuisines":["Global"],"isJunk":False,"junkReason":""},
  {"name":"seeded serrano chile","category":"chili","taste":"spicy pungent","cuisines":["Mexican","Tex-Mex"],"isJunk":False,"junkReason":""},
  {"name":"seeded watermelon","category":"fruit","taste":"sweet","cuisines":["Global"],"isJunk":False,"junkReason":""},
  {"name":"seedless grape","category":"fruit","taste":"sweet sour","cuisines":["Italian","Spanish","French","Greek","Middle Eastern"],"isJunk":False,"junkReason":""},
  {"name":"seedless raisin","category":"fruit","taste":"sweet","cuisines":["Global"],"isJunk":False,"junkReason":""},
  {"name":"seedless raspberry","category":"fruit","taste":"sour sweet","cuisines":["American","British","French"],"isJunk":False,"junkReason":""},
  {"name":"seedless raspberry jam","category":"condiment","taste":"sweet sour","cuisines":["British","French","American"],"isJunk":False,"junkReason":""},
  {"name":"seedless raspberry preserve","category":"condiment","taste":"sweet sour","cuisines":["British","French","American"],"isJunk":False,"junkReason":""},
  {"name":"seedless red grape","category":"fruit","taste":"sweet sour","cuisines":["Italian","Spanish","French","Greek","Middle Eastern"],"isJunk":False,"junkReason":""},
  {"name":"seedless watermelon","category":"fruit","taste":"sweet","cuisines":["American","Middle Eastern","West African"],"isJunk":False,"junkReason":""},
  {"name":"seitan","category":"protein","taste":"umami salty","cuisines":["Chinese","Japanese","Global"],"isJunk":False,"junkReason":""},
  {"name":"self rising flour","category":"grain","taste":"sweet","cuisines":["American","British","Australian"],"isJunk":False,"junkReason":""},
  {"name":"self-raising flour","category":"grain","taste":"sweet","cuisines":["British","Australian","American"],"isJunk":False,"junkReason":""},
  {"name":"semolina","category":"grain","taste":"sweet umami","cuisines":["Italian","Middle Eastern","Indian","Moroccan","North African"],"isJunk":False,"junkReason":""},
  {"name":"serrano chile pepper","category":"chili","taste":"spicy pungent","cuisines":["Mexican","Tex-Mex","Latin American"],"isJunk":False,"junkReason":""},
  {"name":"serrano chili","category":"chili","taste":"spicy pungent","cuisines":["Mexican","Tex-Mex","Latin American"],"isJunk":False,"junkReason":""},
  {"name":"serrano chili pepper","category":"chili","taste":"spicy pungent","cuisines":["Mexican","Tex-Mex","Latin American"],"isJunk":False,"junkReason":""},
  {"name":"serrano chilie","category":"chili","taste":"spicy pungent","cuisines":["Mexican","Tex-Mex","Latin American"],"isJunk":False,"junkReason":""},
  {"name":"serrano pepper","category":"chili","taste":"spicy pungent","cuisines":["Mexican","Tex-Mex","Latin American"],"isJunk":False,"junkReason":""},
  {"name":"sesame","category":"nut","taste":"umami sweet","cuisines":["Chinese","Japanese","Korean","Middle Eastern","Indian"],"isJunk":False,"junkReason":""},
  {"name":"sesame dressing","category":"condiment","taste":"umami sweet","cuisines":["Japanese","Chinese","Korean"],"isJunk":False,"junkReason":""},
  {"name":"sesame oil","category":"fat","taste":"umami pungent","cuisines":["Chinese","Japanese","Korean","Vietnamese","Middle Eastern"],"isJunk":False,"junkReason":""},
]

inp = json.load(open('.ralph/audit_batches/batch_30.json', encoding='utf-8'))
assert len(data) == len(inp), f'LENGTH MISMATCH {len(data)} vs {len(inp)}'
for i,(d,r) in enumerate(zip(data,inp)):
    if d['name'] != r['name']:
        print(f'NAME MISMATCH at {i}: got {repr(d["name"])} expected {repr(r["name"])}')
        d['name'] = r['name']

with open('.ralph/audit_batches/batch_30.out.json','w',encoding='utf-8') as f:
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
