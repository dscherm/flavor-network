import json

data = [
  {"name":"peppermint schnapp","category":"liqueur","taste":"sweet pungent","cuisines":["German","American"],"isJunk":False,"junkReason":""},
  {"name":"pepperoncini","category":"chili","taste":"spicy sour","cuisines":["Italian","Greek","American"],"isJunk":False,"junkReason":""},
  {"name":"pepperoncini pepper","category":"chili","taste":"spicy sour","cuisines":["Italian","Greek","American"],"isJunk":False,"junkReason":""},
  {"name":"pepperoni","category":"protein","taste":"umami salty spicy","cuisines":["Italian","American"],"isJunk":False,"junkReason":""},
  {"name":"pepperoni sausage","category":"protein","taste":"umami salty spicy","cuisines":["Italian","American"],"isJunk":False,"junkReason":""},
  {"name":"pepsi cola","category":"mixer","taste":"sweet sour","cuisines":["American","Global"],"isJunk":True,"junkReason":"Branded product (Pepsi-Cola is a registered trademark of PepsiCo)"},
  {"name":"percent milk","category":"dairy","taste":"sweet","cuisines":["Global"],"isJunk":True,"junkReason":"Generic incomplete descriptor — missing the percentage (2% milk, whole milk, etc.)"},
  {"name":"pernod","category":"liqueur","taste":"sweet pungent","cuisines":["French"],"isJunk":False,"junkReason":""},
  {"name":"perrins sauce","category":"condiment","taste":"umami sour sweet","cuisines":["British"],"isJunk":False,"junkReason":""},
  {"name":"persimmon","category":"fruit","taste":"sweet astringent","cuisines":["Japanese","Korean","Chinese","Persian"],"isJunk":False,"junkReason":""},
  {"name":"pet milk","category":"dairy","taste":"sweet","cuisines":["American","Southern US"],"isJunk":False,"junkReason":""},
  {"name":"petite green pea","category":"vegetable","taste":"sweet","cuisines":["British","French","Indian"],"isJunk":False,"junkReason":""},
  {"name":"petite pea","category":"vegetable","taste":"sweet","cuisines":["British","French","Indian"],"isJunk":False,"junkReason":""},
  {"name":"phyllo dough","category":"baked","taste":"sweet","cuisines":["Greek","Turkish","Lebanese","Persian","Moroccan"],"isJunk":False,"junkReason":""},
  {"name":"picante sauce","category":"condiment","taste":"spicy sour","cuisines":["Mexican","Tex-Mex"],"isJunk":False,"junkReason":""},
  {"name":"pickapeppa sauce","category":"condiment","taste":"umami sweet spicy","cuisines":["Caribbean","Jamaican"],"isJunk":False,"junkReason":""},
  {"name":"pickle juice","category":"liquid","taste":"sour salty","cuisines":["American","German","Eastern European"],"isJunk":False,"junkReason":""},
  {"name":"pickled ginger","category":"aromatic","taste":"pungent sour sweet","cuisines":["Japanese","Chinese","Korean"],"isJunk":False,"junkReason":""},
  {"name":"pickled jalapeno","category":"chili","taste":"spicy sour","cuisines":["Mexican","Tex-Mex"],"isJunk":False,"junkReason":""},
  {"name":"pickling lime","category":"acid","taste":"sour","cuisines":["American","Mexican","Southern US"],"isJunk":False,"junkReason":""},
  {"name":"pickling salt","category":"seasoning","taste":"salty","cuisines":["Global"],"isJunk":False,"junkReason":""},
  {"name":"pico de gallo sauce","category":"condiment","taste":"spicy sour pungent","cuisines":["Mexican","Tex-Mex"],"isJunk":False,"junkReason":""},
  {"name":"pie","category":"baked","taste":"sweet","cuisines":["American","British"],"isJunk":True,"junkReason":"Overly generic — not a single identifiable ingredient"},
  {"name":"pie apple","category":"fruit","taste":"sweet sour","cuisines":["American","British"],"isJunk":False,"junkReason":""},
  {"name":"pie crust","category":"baked","taste":"sweet","cuisines":["American","British","French"],"isJunk":False,"junkReason":""},
  {"name":"pie filling","category":"condiment","taste":"sweet","cuisines":["American"],"isJunk":True,"junkReason":"Overly generic — no specific ingredient type identified"},
  {"name":"pie pastry","category":"baked","taste":"sweet","cuisines":["American","British","French"],"isJunk":False,"junkReason":""},
  {"name":"pierogie","category":"grain","taste":"sweet umami","cuisines":["Polish","Ukrainian","Russian"],"isJunk":False,"junkReason":""},
  {"name":"pigeon pea","category":"protein","taste":"umami sweet","cuisines":["Caribbean","West African","Indian","Brazilian"],"isJunk":False,"junkReason":""},
  {"name":"pili nut","category":"nut","taste":"sweet umami","cuisines":["Filipino","Pacific Islander"],"isJunk":False,"junkReason":""},
  {"name":"pimento cheese","category":"dairy","taste":"umami spicy","cuisines":["American","Southern US"],"isJunk":False,"junkReason":""},
  {"name":"pimento pepper","category":"chili","taste":"sweet spicy","cuisines":["Spanish","Portuguese","American"],"isJunk":False,"junkReason":""},
  {"name":"pimento stuffed green olive","category":"condiment","taste":"salty sour","cuisines":["Spanish","Italian","Greek","Turkish","Lebanese"],"isJunk":False,"junkReason":""},
  {"name":"pimento stuffed olive","category":"condiment","taste":"salty sour","cuisines":["Spanish","Italian","Greek","Turkish","Lebanese"],"isJunk":False,"junkReason":""},
  {"name":"pimiento cheese","category":"dairy","taste":"umami spicy","cuisines":["American","Southern US"],"isJunk":False,"junkReason":""},
  {"name":"pinapple","category":"fruit","taste":"sweet sour","cuisines":["Pacific Islander","Filipino","Caribbean"],"isJunk":False,"junkReason":""},
  {"name":"pine","category":"other","taste":"bitter pungent","cuisines":["Scandinavian","Finnish"],"isJunk":True,"junkReason":"Parse artifact — not a culinary ingredient on its own"},
  {"name":"pine nut","category":"nut","taste":"sweet umami","cuisines":["Italian","Middle Eastern","Turkish","Lebanese"],"isJunk":False,"junkReason":""},
  {"name":"pineapple","category":"fruit","taste":"sweet sour","cuisines":["Pacific Islander","Filipino","Caribbean","Hawaiian"],"isJunk":False,"junkReason":""},
  {"name":"pineapple bit","category":"fruit","taste":"sweet sour","cuisines":["Pacific Islander","Filipino","Caribbean","Hawaiian"],"isJunk":False,"junkReason":""},
  {"name":"pineapple cake","category":"baked","taste":"sweet sour","cuisines":["Caribbean","Pacific Islander","American"],"isJunk":False,"junkReason":""},
  {"name":"pineapple chunk","category":"fruit","taste":"sweet sour","cuisines":["Pacific Islander","Filipino","Caribbean","Hawaiian"],"isJunk":False,"junkReason":""},
  {"name":"pineapple juice","category":"liquid","taste":"sweet sour","cuisines":["Pacific Islander","Filipino","Caribbean","Hawaiian"],"isJunk":False,"junkReason":""},
  {"name":"pineapple juice concentrate","category":"liquid","taste":"sweet sour","cuisines":["Pacific Islander","Filipino","Caribbean","Hawaiian"],"isJunk":False,"junkReason":""},
  {"name":"pineapple pie filling","category":"condiment","taste":"sweet sour","cuisines":["American","Caribbean"],"isJunk":False,"junkReason":""},
  {"name":"pineapple preserve","category":"condiment","taste":"sweet","cuisines":["Pacific Islander","Filipino","Caribbean"],"isJunk":False,"junkReason":""},
  {"name":"pineapple ring","category":"fruit","taste":"sweet sour","cuisines":["Pacific Islander","Filipino","Caribbean","Hawaiian"],"isJunk":False,"junkReason":""},
  {"name":"pineapple salsa","category":"condiment","taste":"sweet sour spicy","cuisines":["Mexican","Caribbean","Hawaiian"],"isJunk":False,"junkReason":""},
  {"name":"pineapple sherbet","category":"confection","taste":"sweet sour","cuisines":["American","Pacific Islander"],"isJunk":False,"junkReason":""},
  {"name":"pineapple syrup","category":"sweetener","taste":"sweet sour","cuisines":["Pacific Islander","Filipino","Caribbean","Hawaiian"],"isJunk":False,"junkReason":""},
  {"name":"pineapple tidbit","category":"fruit","taste":"sweet sour","cuisines":["Pacific Islander","Filipino","Caribbean","Hawaiian"],"isJunk":False,"junkReason":""},
  {"name":"pineapple yogurt","category":"dairy","taste":"sweet sour","cuisines":["American","Global"],"isJunk":False,"junkReason":""},
  {"name":"pink bean","category":"protein","taste":"umami sweet","cuisines":["Mexican","Caribbean","Latin American"],"isJunk":False,"junkReason":""},
  {"name":"pink grapefruit","category":"citrus","taste":"sour bitter sweet","cuisines":["American","French","Israeli"],"isJunk":False,"junkReason":""},
  {"name":"pink grapefruit juice","category":"liquid","taste":"sour bitter sweet","cuisines":["American","French","Israeli"],"isJunk":False,"junkReason":""},
  {"name":"pink lemonade","category":"liquid","taste":"sweet sour","cuisines":["American"],"isJunk":False,"junkReason":""},
  {"name":"pink peppercorn","category":"spice","taste":"spicy pungent sweet","cuisines":["French","Global"],"isJunk":False,"junkReason":""},
  {"name":"pink salmon","category":"protein","taste":"umami","cuisines":["Scandinavian","Japanese","Russian","American"],"isJunk":False,"junkReason":""},
  {"name":"pink salt","category":"seasoning","taste":"salty","cuisines":["Global"],"isJunk":False,"junkReason":""},
  {"name":"pinto bean","category":"protein","taste":"umami sweet","cuisines":["Mexican","Tex-Mex","Southern US","Latin American"],"isJunk":False,"junkReason":""},
  {"name":"pippin apple","category":"fruit","taste":"sweet sour","cuisines":["American","British"],"isJunk":False,"junkReason":""},
  {"name":"piquillo pepper","category":"chili","taste":"sweet spicy","cuisines":["Spanish","Portuguese"],"isJunk":False,"junkReason":""},
  {"name":"pisco","category":"spirit","taste":"sweet bitter","cuisines":["Peruvian","Chilean"],"isJunk":False,"junkReason":""},
  {"name":"pistachio","category":"nut","taste":"sweet umami","cuisines":["Turkish","Persian","Lebanese","Italian","Moroccan"],"isJunk":False,"junkReason":""},
  {"name":"pistachio instant pudding","category":"confection","taste":"sweet","cuisines":["American"],"isJunk":False,"junkReason":""},
  {"name":"pistachio nut","category":"nut","taste":"sweet umami","cuisines":["Turkish","Persian","Lebanese","Italian","Moroccan"],"isJunk":False,"junkReason":""},
  {"name":"pistachio pudding","category":"confection","taste":"sweet","cuisines":["American"],"isJunk":False,"junkReason":""},
  {"name":"pistachio pudding mix","category":"confection","taste":"sweet","cuisines":["American"],"isJunk":False,"junkReason":""},
  {"name":"pita bread","category":"grain","taste":"sweet","cuisines":["Lebanese","Turkish","Israeli","Greek","Middle Eastern"],"isJunk":False,"junkReason":""},
  {"name":"pitanga","category":"fruit","taste":"sour sweet bitter","cuisines":["Brazilian","Caribbean"],"isJunk":False,"junkReason":""},
  {"name":"pitted ripe olive","category":"condiment","taste":"salty sour bitter","cuisines":["Spanish","Italian","Greek","Turkish","Lebanese"],"isJunk":False,"junkReason":""},
  {"name":"pizza cheese","category":"dairy","taste":"umami salty","cuisines":["Italian","American"],"isJunk":False,"junkReason":""},
  {"name":"pizza sauce","category":"condiment","taste":"sweet sour umami","cuisines":["Italian","American"],"isJunk":False,"junkReason":""},
  {"name":"plain yogurt","category":"dairy","taste":"sour sweet","cuisines":["Indian","Turkish","Greek","Lebanese","Pakistani","Persian"],"isJunk":False,"junkReason":""},
  {"name":"plum","category":"fruit","taste":"sweet sour","cuisines":["French","Chinese","Japanese","British"],"isJunk":False,"junkReason":""},
  {"name":"plum sauce","category":"condiment","taste":"sweet sour","cuisines":["Chinese","Vietnamese","Filipino"],"isJunk":False,"junkReason":""},
  {"name":"plum wine","category":"spirit","taste":"sweet sour","cuisines":["Japanese","Chinese","Korean"],"isJunk":False,"junkReason":""},
  {"name":"plumcot","category":"fruit","taste":"sweet sour","cuisines":["American","French"],"isJunk":False,"junkReason":""},
  {"name":"poblano chilie","category":"chili","taste":"spicy bitter","cuisines":["Mexican","Tex-Mex"],"isJunk":False,"junkReason":""},
  {"name":"poblano pepper","category":"chili","taste":"spicy bitter","cuisines":["Mexican","Tex-Mex"],"isJunk":False,"junkReason":""},
  {"name":"polenta","category":"grain","taste":"sweet umami","cuisines":["Italian","Romanian","Brazilian"],"isJunk":False,"junkReason":""},
  {"name":"pomegranate","category":"fruit","taste":"sour sweet astringent","cuisines":["Turkish","Lebanese","Persian","Israeli","Moroccan"],"isJunk":False,"junkReason":""},
  {"name":"pomegranate juice","category":"liquid","taste":"sour sweet astringent","cuisines":["Turkish","Lebanese","Persian","Israeli","Moroccan"],"isJunk":False,"junkReason":""},
  {"name":"pomegranate molasse","category":"sweetener","taste":"sour sweet","cuisines":["Lebanese","Turkish","Persian","Israeli","Moroccan"],"isJunk":False,"junkReason":""},
  {"name":"pomegranate molasses","category":"sweetener","taste":"sour sweet","cuisines":["Lebanese","Turkish","Persian","Israeli","Moroccan"],"isJunk":False,"junkReason":""},
  {"name":"pomegranate seed","category":"fruit","taste":"sour sweet astringent","cuisines":["Turkish","Lebanese","Persian","Israeli","Moroccan"],"isJunk":False,"junkReason":""},
  {"name":"pomegranate syrup","category":"sweetener","taste":"sweet sour","cuisines":["Persian","Turkish","Lebanese","Israeli","Moroccan"],"isJunk":False,"junkReason":""},
  {"name":"ponzu sauce","category":"condiment","taste":"sour umami salty","cuisines":["Japanese","Korean"],"isJunk":False,"junkReason":""},
  {"name":"popcorn","category":"grain","taste":"sweet salty","cuisines":["American","Global"],"isJunk":False,"junkReason":""},
  {"name":"popcorn kernel","category":"grain","taste":"sweet","cuisines":["American","Global"],"isJunk":False,"junkReason":""},
  {"name":"popping corn","category":"grain","taste":"sweet","cuisines":["American","Mexican"],"isJunk":False,"junkReason":""},
  {"name":"poppy seed","category":"spice","taste":"bitter sweet","cuisines":["Eastern European","German","Indian","Turkish","Scandinavian"],"isJunk":False,"junkReason":""},
  {"name":"porcini","category":"vegetable","taste":"umami","cuisines":["Italian","French","Russian"],"isJunk":False,"junkReason":""},
  {"name":"porcini mushroom","category":"vegetable","taste":"umami","cuisines":["Italian","French","Russian","German"],"isJunk":False,"junkReason":""},
  {"name":"pork","category":"protein","taste":"umami salty","cuisines":["Chinese","German","Filipino","Vietnamese","Korean"],"isJunk":False,"junkReason":""},
  {"name":"pork baby back rib","category":"protein","taste":"umami salty","cuisines":["Chinese","American","Southern US"],"isJunk":False,"junkReason":""},
  {"name":"pork back rib","category":"protein","taste":"umami salty","cuisines":["Chinese","American","Southern US"],"isJunk":False,"junkReason":""},
  {"name":"pork belly","category":"protein","taste":"umami salty","cuisines":["Chinese","Korean","Filipino","German","Vietnamese"],"isJunk":False,"junkReason":""},
  {"name":"pork blade","category":"protein","taste":"umami salty","cuisines":["Chinese","Filipino","Vietnamese","German"],"isJunk":False,"junkReason":""},
  {"name":"pork butt","category":"protein","taste":"umami salty","cuisines":["American","Southern US","Chinese","Filipino"],"isJunk":False,"junkReason":""},
]

inp = json.load(open('.ralph/audit_batches/batch_26.json', encoding='utf-8'))
assert len(data) == len(inp), f'LENGTH MISMATCH {len(data)} vs {len(inp)}'
for i,(d,r) in enumerate(zip(data,inp)):
    if d['name'] != r['name']:
        print(f'NAME MISMATCH at {i}: got {repr(d["name"])} expected {repr(r["name"])}')
        d['name'] = r['name']

with open('.ralph/audit_batches/batch_26.out.json','w',encoding='utf-8') as f:
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
