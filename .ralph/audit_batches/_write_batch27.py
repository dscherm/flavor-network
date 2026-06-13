import json

data = [
  {"name":"pork chop","category":"protein","taste":"umami salty","cuisines":["Chinese","German","Filipino","Vietnamese","American"],"isJunk":False,"junkReason":""},
  {"name":"pork cutlet","category":"protein","taste":"umami salty","cuisines":["Chinese","German","Filipino","Vietnamese","Japanese"],"isJunk":False,"junkReason":""},
  {"name":"pork fat","category":"fat","taste":"umami salty","cuisines":["Chinese","German","Filipino","Vietnamese"],"isJunk":False,"junkReason":""},
  {"name":"pork fatback","category":"fat","taste":"umami salty","cuisines":["Chinese","German","Filipino","Vietnamese","Southern US"],"isJunk":False,"junkReason":""},
  {"name":"pork fillet","category":"protein","taste":"umami salty","cuisines":["Chinese","German","Filipino","Vietnamese"],"isJunk":False,"junkReason":""},
  {"name":"pork hock","category":"protein","taste":"umami salty","cuisines":["Chinese","German","Filipino","Vietnamese","Eastern European"],"isJunk":False,"junkReason":""},
  {"name":"pork lean","category":"protein","taste":"umami salty","cuisines":["Chinese","German","Filipino","Vietnamese"],"isJunk":False,"junkReason":""},
  {"name":"pork loin","category":"protein","taste":"umami salty","cuisines":["Chinese","German","Filipino","Vietnamese","American"],"isJunk":False,"junkReason":""},
  {"name":"pork loin chop","category":"protein","taste":"umami salty","cuisines":["Chinese","German","Filipino","Vietnamese","American"],"isJunk":False,"junkReason":""},
  {"name":"pork loin roast","category":"protein","taste":"umami salty","cuisines":["Chinese","German","Filipino","Vietnamese","American"],"isJunk":False,"junkReason":""},
  {"name":"pork meat","category":"protein","taste":"umami salty","cuisines":["Chinese","German","Filipino","Vietnamese"],"isJunk":False,"junkReason":""},
  {"name":"pork mince","category":"protein","taste":"umami salty","cuisines":["Chinese","German","Filipino","Vietnamese"],"isJunk":False,"junkReason":""},
  {"name":"pork neck","category":"protein","taste":"umami salty","cuisines":["Chinese","German","Filipino","Vietnamese","Eastern European"],"isJunk":False,"junkReason":""},
  {"name":"pork rib","category":"protein","taste":"umami salty","cuisines":["Chinese","American","Southern US","Vietnamese"],"isJunk":False,"junkReason":""},
  {"name":"pork rind","category":"protein","taste":"salty umami","cuisines":["American","Southern US","Chinese","Filipino"],"isJunk":False,"junkReason":""},
  {"name":"pork roast","category":"protein","taste":"umami salty","cuisines":["Chinese","German","Filipino","Vietnamese","American"],"isJunk":False,"junkReason":""},
  {"name":"pork sausage","category":"protein","taste":"umami salty spicy","cuisines":["German","American","Italian","Filipino","Chinese"],"isJunk":False,"junkReason":""},
  {"name":"pork sausage link","category":"protein","taste":"umami salty spicy","cuisines":["German","American","Italian"],"isJunk":False,"junkReason":""},
  {"name":"pork sausage meat","category":"protein","taste":"umami salty spicy","cuisines":["German","American","British"],"isJunk":False,"junkReason":""},
  {"name":"pork shoulder","category":"protein","taste":"umami salty","cuisines":["Chinese","German","Filipino","Vietnamese","American"],"isJunk":False,"junkReason":""},
  {"name":"pork shoulder butt roast","category":"protein","taste":"umami salty","cuisines":["Chinese","German","Filipino","Vietnamese","American"],"isJunk":False,"junkReason":""},
  {"name":"pork shoulder roast","category":"protein","taste":"umami salty","cuisines":["Chinese","German","Filipino","Vietnamese","American"],"isJunk":False,"junkReason":""},
  {"name":"pork sirloin roast","category":"protein","taste":"umami salty","cuisines":["American","Chinese","German","Korean"],"isJunk":False,"junkReason":""},
  {"name":"pork sparerib","category":"protein","taste":"umami salty","cuisines":["Chinese","American","Southern US","Filipino"],"isJunk":False,"junkReason":""},
  {"name":"pork steak","category":"protein","taste":"umami salty","cuisines":["American","Chinese","German","Korean"],"isJunk":False,"junkReason":""},
  {"name":"pork stew meat","category":"protein","taste":"umami salty","cuisines":["Chinese","German","Filipino","Vietnamese"],"isJunk":False,"junkReason":""},
  {"name":"pork stock","category":"liquid","taste":"umami salty","cuisines":["French","German","Chinese"],"isJunk":False,"junkReason":""},
  {"name":"pork tenderloin","category":"protein","taste":"umami salty","cuisines":["Chinese","German","Filipino","Vietnamese","American"],"isJunk":False,"junkReason":""},
  {"name":"port","category":"spirit","taste":"sweet bitter","cuisines":["Portuguese","Spanish","British"],"isJunk":False,"junkReason":""},
  {"name":"port wine","category":"spirit","taste":"sweet bitter","cuisines":["Portuguese","Spanish","British"],"isJunk":False,"junkReason":""},
  {"name":"portabella mushroom","category":"vegetable","taste":"umami","cuisines":["Italian","French","American"],"isJunk":False,"junkReason":""},
  {"name":"portabella mushroom cap","category":"vegetable","taste":"umami","cuisines":["Italian","French","American"],"isJunk":False,"junkReason":""},
  {"name":"portabello mushroom","category":"vegetable","taste":"umami","cuisines":["Italian","French","American"],"isJunk":False,"junkReason":""},
  {"name":"portobello","category":"vegetable","taste":"umami","cuisines":["Italian","French","American"],"isJunk":False,"junkReason":""},
  {"name":"portobello mushroom","category":"vegetable","taste":"umami","cuisines":["Italian","French","American"],"isJunk":False,"junkReason":""},
  {"name":"portobello mushroom cap","category":"vegetable","taste":"umami","cuisines":["Italian","French","American"],"isJunk":False,"junkReason":""},
  {"name":"potato","category":"vegetable","taste":"sweet umami","cuisines":["Irish","American","German","Peruvian","French"],"isJunk":False,"junkReason":""},
  {"name":"potato chip","category":"grain","taste":"salty sweet","cuisines":["American"],"isJunk":False,"junkReason":""},
  {"name":"potato flake","category":"vegetable","taste":"sweet umami","cuisines":["American","Global"],"isJunk":False,"junkReason":""},
  {"name":"potato gnocchi","category":"grain","taste":"sweet umami","cuisines":["Italian","Peruvian"],"isJunk":False,"junkReason":""},
  {"name":"potato roll","category":"baked","taste":"sweet","cuisines":["German","American","Eastern European"],"isJunk":False,"junkReason":""},
  {"name":"potato soup","category":"liquid","taste":"sweet umami","cuisines":["French","Irish","German","American"],"isJunk":False,"junkReason":""},
  {"name":"potato starch","category":"thickener","taste":"sweet","cuisines":["Global"],"isJunk":False,"junkReason":""},
  {"name":"potato water","category":"liquid","taste":"sweet","cuisines":["Global"],"isJunk":False,"junkReason":""},
  {"name":"potato wedge","category":"vegetable","taste":"sweet umami","cuisines":["American","British","Australian"],"isJunk":False,"junkReason":""},
  {"name":"poultry seasoning","category":"spice","taste":"spicy pungent bitter","cuisines":["American"],"isJunk":False,"junkReason":""},
  {"name":"poundcake","category":"baked","taste":"sweet","cuisines":["American","British","French"],"isJunk":False,"junkReason":""},
  {"name":"pouring cream","category":"dairy","taste":"sweet","cuisines":["British","Australian","French"],"isJunk":False,"junkReason":""},
  {"name":"powdered sugar","category":"sweetener","taste":"sweet","cuisines":["Global"],"isJunk":False,"junkReason":""},
  {"name":"prairie turnip","category":"vegetable","taste":"sweet","cuisines":["American"],"isJunk":False,"junkReason":""},
  {"name":"prawn","category":"protein","taste":"umami salty","cuisines":["British","Australian","Thai","Chinese","Indian"],"isJunk":False,"junkReason":""},
  {"name":"prepared mustard","category":"condiment","taste":"pungent sour","cuisines":["American","German","French"],"isJunk":False,"junkReason":""},
  {"name":"preserved lemon","category":"citrus","taste":"sour salty pungent","cuisines":["Moroccan","Lebanese","Turkish","French"],"isJunk":False,"junkReason":""},
  {"name":"pressed garlic","category":"aromatic","taste":"pungent spicy","cuisines":["Italian","Chinese","Korean","Spanish","French"],"isJunk":False,"junkReason":""},
  {"name":"pretzel crumb","category":"baked","taste":"salty sweet","cuisines":["German","American"],"isJunk":False,"junkReason":""},
  {"name":"prickly pear","category":"fruit","taste":"sweet sour","cuisines":["Mexican","Middle Eastern","Moroccan","Italian"],"isJunk":False,"junkReason":""},
  {"name":"process cheese","category":"dairy","taste":"umami salty","cuisines":["American"],"isJunk":False,"junkReason":""},
  {"name":"process cheese sauce","category":"dairy","taste":"umami salty","cuisines":["American","Tex-Mex"],"isJunk":False,"junkReason":""},
  {"name":"processed cheese","category":"dairy","taste":"umami salty","cuisines":["American","Global"],"isJunk":False,"junkReason":""},
  {"name":"processed cheese food","category":"dairy","taste":"umami salty","cuisines":["American"],"isJunk":False,"junkReason":""},
  {"name":"processed cheese spread","category":"dairy","taste":"umami salty","cuisines":["American"],"isJunk":False,"junkReason":""},
  {"name":"promise buttery spread","category":"fat","taste":"sweet","cuisines":["American"],"isJunk":True,"junkReason":"Branded product (Promise is a registered trademark)"},
  {"name":"prosciutto","category":"protein","taste":"umami salty","cuisines":["Italian"],"isJunk":False,"junkReason":""},
  {"name":"prosecco","category":"mixer","taste":"sweet sour","cuisines":["Italian"],"isJunk":False,"junkReason":""},
  {"name":"protein powder","category":"other","taste":"sweet","cuisines":["American","Global"],"isJunk":True,"junkReason":"Generic supplement ingredient, not a culinary food ingredient"},
  {"name":"provolone cheese","category":"dairy","taste":"umami salty","cuisines":["Italian","Argentine","American"],"isJunk":False,"junkReason":""},
  {"name":"prune","category":"fruit","taste":"sweet sour","cuisines":["French","American","Eastern European","Moroccan"],"isJunk":False,"junkReason":""},
  {"name":"prune juice","category":"liquid","taste":"sweet sour","cuisines":["American","Global"],"isJunk":False,"junkReason":""},
  {"name":"pudding","category":"confection","taste":"sweet","cuisines":["British","American","French"],"isJunk":True,"junkReason":"Too generic — not a specific ingredient"},
  {"name":"puff pastry","category":"baked","taste":"sweet","cuisines":["French","British","American"],"isJunk":False,"junkReason":""},
  {"name":"puffed rice","category":"grain","taste":"sweet","cuisines":["Chinese","Japanese","Thai","Korean","Indian"],"isJunk":False,"junkReason":""},
  {"name":"puffed rice cereal","category":"grain","taste":"sweet","cuisines":["American","Japanese"],"isJunk":False,"junkReason":""},
  {"name":"puffed wheat cereal","category":"grain","taste":"sweet","cuisines":["American","British"],"isJunk":False,"junkReason":""},
  {"name":"pulled pork","category":"protein","taste":"umami salty sweet","cuisines":["American","Southern US","Caribbean"],"isJunk":False,"junkReason":""},
  {"name":"pummelo","category":"citrus","taste":"sweet sour bitter","cuisines":["Chinese","Thai","Filipino","Vietnamese"],"isJunk":False,"junkReason":""},
  {"name":"pumpernickel bread","category":"baked","taste":"bitter sweet umami","cuisines":["German","Eastern European","Scandinavian"],"isJunk":False,"junkReason":""},
  {"name":"pumpkin","category":"vegetable","taste":"sweet","cuisines":["American","Australian","Italian","Indian"],"isJunk":False,"junkReason":""},
  {"name":"pumpkin butter","category":"condiment","taste":"sweet spicy","cuisines":["American"],"isJunk":False,"junkReason":""},
  {"name":"pumpkin pie","category":"baked","taste":"sweet spicy","cuisines":["American"],"isJunk":False,"junkReason":""},
  {"name":"pumpkin pie filling","category":"condiment","taste":"sweet spicy","cuisines":["American"],"isJunk":False,"junkReason":""},
  {"name":"pumpkin pie mix","category":"condiment","taste":"sweet spicy","cuisines":["American"],"isJunk":False,"junkReason":""},
  {"name":"pumpkin pie spice","category":"spice","taste":"spicy sweet pungent","cuisines":["American"],"isJunk":False,"junkReason":""},
  {"name":"pumpkin puree","category":"vegetable","taste":"sweet","cuisines":["American","Australian","Italian","Indian"],"isJunk":False,"junkReason":""},
  {"name":"pumpkin seed","category":"nut","taste":"sweet umami","cuisines":["Mexican","American","Middle Eastern","Austrian"],"isJunk":False,"junkReason":""},
  {"name":"pumpkin spice","category":"spice","taste":"spicy sweet pungent","cuisines":["American","Moroccan"],"isJunk":False,"junkReason":""},
  {"name":"pumpkinseed sunfish","category":"protein","taste":"umami salty","cuisines":["American"],"isJunk":False,"junkReason":""},
  {"name":"punnet cherry tomatoe","category":"vegetable","taste":"sweet sour umami","cuisines":["Italian","Mexican","Spanish","Turkish"],"isJunk":False,"junkReason":""},
  {"name":"purple basil","category":"herb","taste":"sweet pungent","cuisines":["Italian","Thai"],"isJunk":False,"junkReason":""},
  {"name":"purple cabbage","category":"vegetable","taste":"bitter sweet","cuisines":["German","Eastern European","Korean","American"],"isJunk":False,"junkReason":""},
  {"name":"purple grape","category":"fruit","taste":"sweet sour","cuisines":["Global"],"isJunk":False,"junkReason":""},
  {"name":"purple laver","category":"vegetable","taste":"umami salty","cuisines":["Japanese","Korean","Chinese"],"isJunk":False,"junkReason":""},
  {"name":"purple mangosteen","category":"fruit","taste":"sweet sour","cuisines":["Thai","Filipino","Indonesian","Malaysian"],"isJunk":False,"junkReason":""},
  {"name":"purple onion","category":"aromatic","taste":"pungent sweet","cuisines":["French","Indian","Turkish","Italian","Greek"],"isJunk":False,"junkReason":""},
  {"name":"purple potatoe","category":"vegetable","taste":"sweet umami","cuisines":["Peruvian","American","German"],"isJunk":False,"junkReason":""},
  {"name":"purslane","category":"vegetable","taste":"sour sweet","cuisines":["Turkish","Lebanese","Mexican","Greek","Moroccan"],"isJunk":False,"junkReason":""},
  {"name":"quartered cherry tomatoe","category":"vegetable","taste":"sweet sour umami","cuisines":["Italian","Mexican","Spanish","Turkish"],"isJunk":False,"junkReason":""},
  {"name":"queso fresco","category":"dairy","taste":"salty umami","cuisines":["Mexican","Tex-Mex","Latin American"],"isJunk":False,"junkReason":""},
  {"name":"quick-cooking barley","category":"grain","taste":"sweet umami","cuisines":["British","German","American"],"isJunk":False,"junkReason":""},
  {"name":"quick-cooking oatmeal","category":"grain","taste":"sweet","cuisines":["American","British","Scandinavian"],"isJunk":False,"junkReason":""},
  {"name":"quince","category":"fruit","taste":"sour astringent","cuisines":["Turkish","Persian","Moroccan","Spanish","French"],"isJunk":False,"junkReason":""},
]

inp = json.load(open('.ralph/audit_batches/batch_27.json', encoding='utf-8'))
assert len(data) == len(inp), f'LENGTH MISMATCH {len(data)} vs {len(inp)}'
for i,(d,r) in enumerate(zip(data,inp)):
    if d['name'] != r['name']:
        print(f'NAME MISMATCH at {i}: got {repr(d["name"])} expected {repr(r["name"])}')
        d['name'] = r['name']

with open('.ralph/audit_batches/batch_27.out.json','w',encoding='utf-8') as f:
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
