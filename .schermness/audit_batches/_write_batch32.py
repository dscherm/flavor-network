import json

data = [
  {"name":"soy oil","category":"fat","taste":"sweet","cuisines":["Chinese","American","Global"],"isJunk":False,"junkReason":""},
  {"name":"soy sauce","category":"condiment","taste":"umami salty","cuisines":["Chinese","Japanese","Korean","Thai","Vietnamese","Indonesian"],"isJunk":False,"junkReason":""},
  {"name":"soy yogurt","category":"dairy","taste":"sour sweet","cuisines":["Global"],"isJunk":False,"junkReason":""},
  {"name":"soya milk","category":"liquid","taste":"sweet","cuisines":["Global"],"isJunk":False,"junkReason":""},
  {"name":"soya sauce","category":"condiment","taste":"umami salty","cuisines":["Chinese","Japanese","Korean","Thai","Vietnamese","Indonesian"],"isJunk":False,"junkReason":""},
  {"name":"soybean","category":"protein","taste":"umami sweet","cuisines":["Chinese","Japanese","Korean","American"],"isJunk":False,"junkReason":""},
  {"name":"soybean oil","category":"fat","taste":"sweet","cuisines":["Chinese","American","Global"],"isJunk":False,"junkReason":""},
  {"name":"soymilk","category":"liquid","taste":"sweet","cuisines":["Chinese","Japanese","Global"],"isJunk":False,"junkReason":""},
  {"name":"spaghetti sauce","category":"condiment","taste":"sweet sour umami","cuisines":["Italian","American"],"isJunk":False,"junkReason":""},
  {"name":"spanish chorizo","category":"protein","taste":"umami spicy salty","cuisines":["Spanish","Portuguese","Mexican"],"isJunk":False,"junkReason":""},
  {"name":"spanish olive","category":"condiment","taste":"salty sour bitter","cuisines":["Spanish","Portuguese","Italian","Greek","Moroccan"],"isJunk":False,"junkReason":""},
  {"name":"spanish olive oil","category":"fat","taste":"sweet","cuisines":["Spanish","Portuguese","Moroccan"],"isJunk":False,"junkReason":""},
  {"name":"spanish onion","category":"aromatic","taste":"pungent sweet","cuisines":["Spanish","French","Italian","Turkish"],"isJunk":False,"junkReason":""},
  {"name":"spanish paprika","category":"spice","taste":"spicy sweet","cuisines":["Spanish","Hungarian","Portuguese","Moroccan"],"isJunk":False,"junkReason":""},
  {"name":"spanish peanut","category":"nut","taste":"umami sweet","cuisines":["Spanish","American","West African","Thai"],"isJunk":False,"junkReason":""},
  {"name":"spanish rice","category":"grain","taste":"sweet umami","cuisines":["Mexican","Spanish","Tex-Mex"],"isJunk":False,"junkReason":""},
  {"name":"spanish smoked paprika","category":"spice","taste":"spicy sweet","cuisines":["Spanish","Portuguese","Hungarian"],"isJunk":False,"junkReason":""},
  {"name":"sparkleberry","category":"fruit","taste":"sweet sour astringent","cuisines":["American"],"isJunk":False,"junkReason":""},
  {"name":"sparkling apple cider","category":"liquid","taste":"sweet sour","cuisines":["American","French","British"],"isJunk":False,"junkReason":""},
  {"name":"sparkling white wine","category":"liquid","taste":"sour sweet","cuisines":["French","Italian","German"],"isJunk":False,"junkReason":""},
  {"name":"sparkling wine","category":"liquid","taste":"sour sweet","cuisines":["French","Italian","Spanish"],"isJunk":False,"junkReason":""},
  {"name":"spear","category":"vegetable","taste":"sweet bitter","cuisines":["Global"],"isJunk":True,"junkReason":"Too generic — spear of what? Parse artifact"},
  {"name":"spearmint leave","category":"herb","taste":"sweet pungent","cuisines":["Middle Eastern","British","American","Moroccan"],"isJunk":False,"junkReason":""},
  {"name":"spelt","category":"grain","taste":"sweet umami bitter","cuisines":["German","Italian","Scandinavian","Eastern European"],"isJunk":False,"junkReason":""},
  {"name":"spelt flour","category":"grain","taste":"sweet","cuisines":["German","Italian","Global"],"isJunk":False,"junkReason":""},
  {"name":"spice cake","category":"baked","taste":"sweet spicy","cuisines":["American","British","German"],"isJunk":False,"junkReason":""},
  {"name":"spicy mustard","category":"condiment","taste":"pungent spicy sour","cuisines":["American","German","French"],"isJunk":False,"junkReason":""},
  {"name":"spicy sauce","category":"condiment","taste":"spicy sour","cuisines":["Thai","Chinese","Indian","American"],"isJunk":True,"junkReason":"Too generic — not a specific ingredient"},
  {"name":"spinach","category":"vegetable","taste":"bitter sweet","cuisines":["Indian","Italian","French","Turkish","Middle Eastern"],"isJunk":False,"junkReason":""},
  {"name":"spinach leave","category":"vegetable","taste":"bitter sweet","cuisines":["Indian","Italian","French","Turkish","Middle Eastern"],"isJunk":False,"junkReason":""},
  {"name":"spiral noodle","category":"grain","taste":"sweet umami","cuisines":["Italian"],"isJunk":False,"junkReason":""},
  {"name":"spiral pasta","category":"grain","taste":"sweet umami","cuisines":["Italian"],"isJunk":False,"junkReason":""},
  {"name":"spirit","category":"spirit","taste":"bitter sweet","cuisines":["Global"],"isJunk":True,"junkReason":"Too generic — not a specific ingredient"},
  {"name":"spirulina","category":"vegetable","taste":"bitter umami","cuisines":["Global"],"isJunk":False,"junkReason":""},
  {"name":"splenda brown sugar blend","category":"sweetener","taste":"sweet","cuisines":["American","Global"],"isJunk":True,"junkReason":"Branded product (Splenda is a registered trademark of Heartland Consumer Products)"},
  {"name":"splenda sugar","category":"sweetener","taste":"sweet","cuisines":["American","Global"],"isJunk":True,"junkReason":"Branded product (Splenda is a registered trademark of Heartland Consumer Products)"},
  {"name":"splenda sugar substitute","category":"sweetener","taste":"sweet","cuisines":["American","Global"],"isJunk":True,"junkReason":"Branded product (Splenda is a registered trademark of Heartland Consumer Products)"},
  {"name":"split pea","category":"protein","taste":"umami sweet","cuisines":["Indian","West African","Moroccan","British","Scandinavian"],"isJunk":False,"junkReason":""},
  {"name":"sponge cake","category":"baked","taste":"sweet","cuisines":["British","French","American"],"isJunk":False,"junkReason":""},
  {"name":"spray oil","category":"fat","taste":"sweet","cuisines":["American","Global"],"isJunk":False,"junkReason":""},
  {"name":"spring lettuce mix","category":"vegetable","taste":"bitter sweet","cuisines":["American","French","Italian"],"isJunk":False,"junkReason":""},
  {"name":"squash","category":"vegetable","taste":"sweet umami","cuisines":["American","Mexican","Italian","Middle Eastern"],"isJunk":False,"junkReason":""},
  {"name":"squashberry","category":"fruit","taste":"sweet sour","cuisines":["American","Canadian"],"isJunk":False,"junkReason":""},
  {"name":"squid","category":"protein","taste":"umami salty","cuisines":["Italian","Spanish","Japanese","Greek","Chinese"],"isJunk":False,"junkReason":""},
  {"name":"sriracha","category":"condiment","taste":"spicy sour sweet","cuisines":["Thai","Vietnamese","American"],"isJunk":False,"junkReason":""},
  {"name":"sriracha chili sauce","category":"condiment","taste":"spicy sour sweet","cuisines":["Thai","Vietnamese","American"],"isJunk":False,"junkReason":""},
  {"name":"sriracha sauce","category":"condiment","taste":"spicy sour sweet","cuisines":["Thai","Vietnamese","American"],"isJunk":False,"junkReason":""},
  {"name":"stale bread","category":"baked","taste":"sweet","cuisines":["Global"],"isJunk":False,"junkReason":""},
  {"name":"stale breadcrumb","category":"baked","taste":"sweet","cuisines":["Italian","British","French"],"isJunk":False,"junkReason":""},
  {"name":"star anise","category":"spice","taste":"sweet pungent","cuisines":["Chinese","Vietnamese","Indian","French","Moroccan"],"isJunk":False,"junkReason":""},
  {"name":"starchy potatoe","category":"vegetable","taste":"sweet umami","cuisines":["American","Peruvian","German","Irish"],"isJunk":False,"junkReason":""},
  {"name":"starfruit","category":"fruit","taste":"sour sweet","cuisines":["Filipino","Indonesian","Malaysian","Indian","Chinese"],"isJunk":False,"junkReason":""},
  {"name":"steak sauce","category":"condiment","taste":"umami sour sweet","cuisines":["American","British","Argentine"],"isJunk":False,"junkReason":""},
  {"name":"steamed broccoli","category":"vegetable","taste":"bitter sweet","cuisines":["American","Chinese","British"],"isJunk":False,"junkReason":""},
  {"name":"steamed rice","category":"grain","taste":"sweet umami","cuisines":["Chinese","Japanese","Thai","Korean","Vietnamese"],"isJunk":False,"junkReason":""},
  {"name":"steamed white rice","category":"grain","taste":"sweet umami","cuisines":["Chinese","Japanese","Thai","Korean","Vietnamese"],"isJunk":False,"junkReason":""},
  {"name":"stevia powder","category":"sweetener","taste":"sweet","cuisines":["Global"],"isJunk":False,"junkReason":""},
  {"name":"stew","category":"liquid","taste":"umami salty","cuisines":["Global"],"isJunk":True,"junkReason":"Too generic — not a specific ingredient"},
  {"name":"stew beef","category":"protein","taste":"umami salty","cuisines":["American","French","British","Argentine"],"isJunk":False,"junkReason":""},
  {"name":"stewing beef","category":"protein","taste":"umami salty","cuisines":["American","French","British","Argentine"],"isJunk":False,"junkReason":""},
  {"name":"stewing chicken","category":"protein","taste":"umami salty","cuisines":["French","American","Chinese","British"],"isJunk":False,"junkReason":""},
  {"name":"sticky rice","category":"grain","taste":"sweet umami","cuisines":["Thai","Vietnamese","Chinese","Filipino","Japanese"],"isJunk":False,"junkReason":""},
  {"name":"stilton cheese","category":"dairy","taste":"umami salty bitter","cuisines":["British"],"isJunk":False,"junkReason":""},
  {"name":"stir-fry sauce","category":"condiment","taste":"umami salty sweet","cuisines":["Chinese","Japanese","Korean","Thai","Vietnamese"],"isJunk":False,"junkReason":""},
  {"name":"stock","category":"liquid","taste":"umami salty","cuisines":["French","Chinese","Italian","Japanese"],"isJunk":False,"junkReason":""},
  {"name":"stock powder","category":"condiment","taste":"umami salty","cuisines":["French","British","Global"],"isJunk":False,"junkReason":""},
  {"name":"stone- cornmeal","category":"grain","taste":"sweet umami","cuisines":["American","Southern US","West African","Brazilian"],"isJunk":False,"junkReason":""},
  {"name":"stone- mustard","category":"condiment","taste":"pungent sour spicy","cuisines":["French","British","German","American"],"isJunk":False,"junkReason":""},
  {"name":"stone- yellow cornmeal","category":"grain","taste":"sweet umami","cuisines":["American","Southern US","West African","Brazilian"],"isJunk":False,"junkReason":""},
  {"name":"stout beer","category":"liquid","taste":"bitter sweet","cuisines":["Irish","British","American"],"isJunk":False,"junkReason":""},
  {"name":"stove top dressing","category":"condiment","taste":"umami salty sweet","cuisines":["American"],"isJunk":True,"junkReason":"Branded product (Stove Top is a registered trademark of Kraft Heinz)"},
  {"name":"straw mushroom","category":"vegetable","taste":"umami","cuisines":["Chinese","Vietnamese","Thai","Filipino"],"isJunk":False,"junkReason":""},
  {"name":"strawberry","category":"fruit","taste":"sweet sour","cuisines":["American","French","British","Italian"],"isJunk":False,"junkReason":""},
  {"name":"strawberry cake","category":"baked","taste":"sweet sour","cuisines":["American"],"isJunk":False,"junkReason":""},
  {"name":"strawberry cream cheese","category":"dairy","taste":"sweet sour","cuisines":["American"],"isJunk":False,"junkReason":""},
  {"name":"strawberry flavored","category":"other","taste":"sweet sour","cuisines":["American"],"isJunk":True,"junkReason":"Incomplete parse artifact — flavored what?"},
  {"name":"strawberry flavored gelatin","category":"confection","taste":"sweet sour","cuisines":["American"],"isJunk":False,"junkReason":""},
  {"name":"strawberry gelatin","category":"confection","taste":"sweet sour","cuisines":["American"],"isJunk":False,"junkReason":""},
  {"name":"strawberry glaze","category":"condiment","taste":"sweet sour","cuisines":["American"],"isJunk":False,"junkReason":""},
  {"name":"strawberry halve","category":"fruit","taste":"sweet sour","cuisines":["American","French","British"],"isJunk":False,"junkReason":""},
  {"name":"strawberry ice cream","category":"confection","taste":"sweet sour","cuisines":["American","Global"],"isJunk":False,"junkReason":""},
  {"name":"strawberry ice cream topping","category":"condiment","taste":"sweet sour","cuisines":["American"],"isJunk":False,"junkReason":""},
  {"name":"strawberry jam","category":"condiment","taste":"sweet sour","cuisines":["American","British","French"],"isJunk":False,"junkReason":""},
  {"name":"strawberry jello","category":"confection","taste":"sweet sour","cuisines":["American"],"isJunk":True,"junkReason":"Branded product (Jell-O is a registered trademark of Kraft Heinz)"},
  {"name":"strawberry jelly","category":"condiment","taste":"sweet sour","cuisines":["American","British"],"isJunk":False,"junkReason":""},
  {"name":"strawberry juice","category":"liquid","taste":"sweet sour","cuisines":["American","Global"],"isJunk":False,"junkReason":""},
  {"name":"strawberry liqueur","category":"liqueur","taste":"sweet sour","cuisines":["French","Italian","American"],"isJunk":False,"junkReason":""},
  {"name":"strawberry pie filling","category":"condiment","taste":"sweet sour","cuisines":["American"],"isJunk":False,"junkReason":""},
  {"name":"strawberry preserve","category":"condiment","taste":"sweet sour","cuisines":["American","British","French"],"isJunk":False,"junkReason":""},
  {"name":"strawberry puree","category":"fruit","taste":"sweet sour","cuisines":["French","American","British"],"isJunk":False,"junkReason":""},
  {"name":"strawberry sauce","category":"condiment","taste":"sweet sour","cuisines":["American","French"],"isJunk":False,"junkReason":""},
  {"name":"strawberry soda","category":"mixer","taste":"sweet sour","cuisines":["American"],"isJunk":False,"junkReason":""},
  {"name":"strawberry sorbet","category":"confection","taste":"sweet sour","cuisines":["French","American","British"],"isJunk":False,"junkReason":""},
  {"name":"strawberry syrup","category":"sweetener","taste":"sweet sour","cuisines":["American","French"],"isJunk":False,"junkReason":""},
  {"name":"strawberry yogurt","category":"dairy","taste":"sweet sour","cuisines":["American","Global"],"isJunk":False,"junkReason":""},
  {"name":"streaky bacon","category":"protein","taste":"umami salty","cuisines":["British","American"],"isJunk":False,"junkReason":""},
  {"name":"string bean","category":"vegetable","taste":"sweet astringent","cuisines":["American","French","Italian","Chinese"],"isJunk":False,"junkReason":""},
  {"name":"string cheese","category":"dairy","taste":"umami salty","cuisines":["American","Italian"],"isJunk":False,"junkReason":""},
  {"name":"striped bass","category":"protein","taste":"umami salty","cuisines":["American","Japanese"],"isJunk":False,"junkReason":""},
  {"name":"strong white bread flour","category":"grain","taste":"sweet","cuisines":["British","European"],"isJunk":False,"junkReason":""},
]

inp = json.load(open('.ralph/audit_batches/batch_32.json', encoding='utf-8'))
assert len(data) == len(inp), f'LENGTH MISMATCH {len(data)} vs {len(inp)}'
for i,(d,r) in enumerate(zip(data,inp)):
    if d['name'] != r['name']:
        print(f'NAME MISMATCH at {i}: got {repr(d["name"])} expected {repr(r["name"])}')
        d['name'] = r['name']

with open('.ralph/audit_batches/batch_32.out.json','w',encoding='utf-8') as f:
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
