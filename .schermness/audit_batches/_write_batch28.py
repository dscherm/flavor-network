import json

data = [
  {"name":"quinoa","category":"grain","taste":"sweet umami","cuisines":["Peruvian","Bolivian","Argentine","Chilean"],"isJunk":False,"junkReason":""},
  {"name":"quinoa flake","category":"grain","taste":"sweet umami","cuisines":["Peruvian","Argentine","Global"],"isJunk":False,"junkReason":""},
  {"name":"quinoa flour","category":"grain","taste":"sweet","cuisines":["Peruvian","Argentine","Global"],"isJunk":False,"junkReason":""},
  {"name":"rabbit","category":"protein","taste":"umami salty","cuisines":["French","Italian","Spanish","Maltese"],"isJunk":False,"junkReason":""},
  {"name":"rack of lamb","category":"protein","taste":"umami salty","cuisines":["French","Australian","Greek","Turkish","Moroccan"],"isJunk":False,"junkReason":""},
  {"name":"radish","category":"vegetable","taste":"spicy pungent bitter","cuisines":["Japanese","Korean","Chinese","French","Indian"],"isJunk":False,"junkReason":""},
  {"name":"rainbow trout","category":"protein","taste":"umami salty","cuisines":["American","Scandinavian","British"],"isJunk":False,"junkReason":""},
  {"name":"raisin","category":"fruit","taste":"sweet","cuisines":["Global"],"isJunk":False,"junkReason":""},
  {"name":"raisin bran","category":"grain","taste":"sweet","cuisines":["American"],"isJunk":False,"junkReason":""},
  {"name":"raisin bran cereal","category":"grain","taste":"sweet","cuisines":["American"],"isJunk":False,"junkReason":""},
  {"name":"raisin bread","category":"baked","taste":"sweet","cuisines":["German","American","British"],"isJunk":False,"junkReason":""},
  {"name":"raita","category":"condiment","taste":"sour sweet","cuisines":["Indian","Pakistani"],"isJunk":False,"junkReason":""},
  {"name":"rambutan","category":"fruit","taste":"sweet sour","cuisines":["Thai","Filipino","Indonesian","Malaysian"],"isJunk":False,"junkReason":""},
  {"name":"ramen noodle","category":"grain","taste":"sweet umami","cuisines":["Japanese","Korean","Vietnamese"],"isJunk":False,"junkReason":""},
  {"name":"ranch dressing","category":"condiment","taste":"sour pungent","cuisines":["American"],"isJunk":False,"junkReason":""},
  {"name":"ranch salad dressing","category":"condiment","taste":"sour pungent","cuisines":["American"],"isJunk":False,"junkReason":""},
  {"name":"ranch style bean","category":"protein","taste":"umami spicy","cuisines":["Mexican","Tex-Mex","American"],"isJunk":False,"junkReason":""},
  {"name":"range chicken","category":"protein","taste":"umami salty","cuisines":["American","Global"],"isJunk":False,"junkReason":""},
  {"name":"range egg","category":"protein","taste":"umami","cuisines":["Global"],"isJunk":False,"junkReason":""},
  {"name":"rapeseed oil","category":"fat","taste":"sweet","cuisines":["Global"],"isJunk":False,"junkReason":""},
  {"name":"rapidrise yeast","category":"thickener","taste":"bitter pungent","cuisines":["Global"],"isJunk":False,"junkReason":""},
  {"name":"rapini","category":"vegetable","taste":"bitter pungent","cuisines":["Italian","Portuguese","Chinese","Korean"],"isJunk":False,"junkReason":""},
  {"name":"ras el hanout","category":"spice","taste":"spicy sweet pungent","cuisines":["Moroccan","Tunisian","Algerian","Middle Eastern"],"isJunk":False,"junkReason":""},
  {"name":"rashers bacon","category":"protein","taste":"umami salty","cuisines":["British","Irish","Australian"],"isJunk":False,"junkReason":""},
  {"name":"raspberry","category":"fruit","taste":"sour sweet","cuisines":["American","British","French"],"isJunk":False,"junkReason":""},
  {"name":"raspberry gelatin","category":"confection","taste":"sweet sour","cuisines":["American"],"isJunk":False,"junkReason":""},
  {"name":"raspberry gelatin powder","category":"confection","taste":"sweet sour","cuisines":["American"],"isJunk":False,"junkReason":""},
  {"name":"raspberry jam","category":"condiment","taste":"sweet sour","cuisines":["British","French","American"],"isJunk":False,"junkReason":""},
  {"name":"raspberry jello","category":"confection","taste":"sweet sour","cuisines":["American"],"isJunk":True,"junkReason":"Branded product (Jell-O is a registered trademark of Kraft Heinz)"},
  {"name":"raspberry jelly","category":"condiment","taste":"sweet sour","cuisines":["British","French","American"],"isJunk":False,"junkReason":""},
  {"name":"raspberry juice","category":"liquid","taste":"sour sweet","cuisines":["American","British","French"],"isJunk":False,"junkReason":""},
  {"name":"raspberry liqueur","category":"liqueur","taste":"sweet sour","cuisines":["French","British","Belgian"],"isJunk":False,"junkReason":""},
  {"name":"raspberry pie filling","category":"condiment","taste":"sweet sour","cuisines":["American","British"],"isJunk":False,"junkReason":""},
  {"name":"raspberry preserve","category":"condiment","taste":"sweet sour","cuisines":["British","French","American"],"isJunk":False,"junkReason":""},
  {"name":"raspberry puree","category":"fruit","taste":"sour sweet","cuisines":["French","British","American"],"isJunk":False,"junkReason":""},
  {"name":"raspberry sauce","category":"condiment","taste":"sweet sour","cuisines":["French","British","American"],"isJunk":False,"junkReason":""},
  {"name":"raspberry sherbet","category":"confection","taste":"sweet sour","cuisines":["American","British"],"isJunk":False,"junkReason":""},
  {"name":"raspberry sorbet","category":"confection","taste":"sweet sour","cuisines":["French","American","British"],"isJunk":False,"junkReason":""},
  {"name":"raspberry syrup","category":"sweetener","taste":"sweet sour","cuisines":["French","American","British"],"isJunk":False,"junkReason":""},
  {"name":"raspberry vinaigrette","category":"condiment","taste":"sour sweet","cuisines":["American","French"],"isJunk":False,"junkReason":""},
  {"name":"raspberry vinegar","category":"acid","taste":"sour sweet","cuisines":["French","British","American"],"isJunk":False,"junkReason":""},
  {"name":"raspberry vodka","category":"spirit","taste":"sweet bitter","cuisines":["Russian","Polish","American"],"isJunk":False,"junkReason":""},
  {"name":"raspberry yogurt","category":"dairy","taste":"sour sweet","cuisines":["American","British","Global"],"isJunk":False,"junkReason":""},
  {"name":"realemon","category":"citrus","taste":"sour","cuisines":["American","Global"],"isJunk":True,"junkReason":"Branded product (ReaLemon is a registered trademark of B&G Foods)"},
  {"name":"realemon juice","category":"liquid","taste":"sour","cuisines":["American","Global"],"isJunk":False,"junkReason":""},
  {"name":"recaito","category":"condiment","taste":"pungent spicy","cuisines":["Puerto Rican","Caribbean","Latin American"],"isJunk":False,"junkReason":""},
  {"name":"recipe secrets onion soup mix","category":"condiment","taste":"umami salty pungent","cuisines":["American"],"isJunk":True,"junkReason":"Branded product (Lipton Recipe Secrets is a registered trademark)"},
  {"name":"red algae","category":"vegetable","taste":"umami salty","cuisines":["Japanese","Korean","Chinese"],"isJunk":False,"junkReason":""},
  {"name":"red apple","category":"fruit","taste":"sweet sour","cuisines":["American","British","French"],"isJunk":False,"junkReason":""},
  {"name":"red bean","category":"protein","taste":"umami sweet","cuisines":["Chinese","Japanese","Korean","Mexican","Caribbean"],"isJunk":False,"junkReason":""},
  {"name":"red bell pepper","category":"vegetable","taste":"sweet","cuisines":["Spanish","Italian","Turkish","Mexican","French"],"isJunk":False,"junkReason":""},
  {"name":"red bliss potatoe","category":"vegetable","taste":"sweet umami","cuisines":["American","Peruvian"],"isJunk":False,"junkReason":""},
  {"name":"red burgundy wine","category":"liquid","taste":"sour bitter","cuisines":["French"],"isJunk":False,"junkReason":""},
  {"name":"red cabbage","category":"vegetable","taste":"bitter sweet","cuisines":["German","Eastern European","Korean","American"],"isJunk":False,"junkReason":""},
  {"name":"red cake coloring","category":"other","taste":"sweet","cuisines":["American","Global"],"isJunk":False,"junkReason":""},
  {"name":"red capsicum","category":"vegetable","taste":"sweet","cuisines":["Spanish","Italian","Turkish","Mexican","Australian"],"isJunk":False,"junkReason":""},
  {"name":"red cayenne pepper","category":"chili","taste":"spicy pungent","cuisines":["West African","Ethiopian","Cajun/Creole","Indian","Mexican"],"isJunk":False,"junkReason":""},
  {"name":"red cherry tomatoe","category":"vegetable","taste":"sweet sour umami","cuisines":["Italian","Mexican","Spanish","Turkish"],"isJunk":False,"junkReason":""},
  {"name":"red chile flake","category":"chili","taste":"spicy pungent","cuisines":["Mexican","Indian","Korean","Italian"],"isJunk":False,"junkReason":""},
  {"name":"red chile pepper","category":"chili","taste":"spicy pungent","cuisines":["Mexican","Indian","Korean","Thai"],"isJunk":False,"junkReason":""},
  {"name":"red chili","category":"chili","taste":"spicy pungent","cuisines":["Mexican","Indian","Thai","Korean"],"isJunk":False,"junkReason":""},
  {"name":"red chili long","category":"chili","taste":"spicy pungent","cuisines":["Thai","Indonesian","Chinese","Indian"],"isJunk":False,"junkReason":""},
  {"name":"red chili paste","category":"condiment","taste":"spicy pungent","cuisines":["Korean","Thai","Chinese","Indian"],"isJunk":False,"junkReason":""},
  {"name":"red chili pepper","category":"chili","taste":"spicy pungent","cuisines":["Mexican","Indian","Thai","Korean"],"isJunk":False,"junkReason":""},
  {"name":"red chili powder","category":"spice","taste":"spicy pungent","cuisines":["Indian","Mexican","Tex-Mex","Korean","Thai"],"isJunk":False,"junkReason":""},
  {"name":"red chili sauce","category":"condiment","taste":"spicy sour pungent","cuisines":["Thai","Chinese","Korean","Mexican"],"isJunk":False,"junkReason":""},
  {"name":"red chilie","category":"chili","taste":"spicy pungent","cuisines":["Mexican","Indian","Thai","Korean"],"isJunk":False,"junkReason":""},
  {"name":"red chilli flake","category":"chili","taste":"spicy pungent","cuisines":["Italian","Korean","Chinese","Indian","Mexican"],"isJunk":False,"junkReason":""},
  {"name":"red chilli pepper","category":"chili","taste":"spicy pungent","cuisines":["Thai","Indian","Korean","Chinese"],"isJunk":False,"junkReason":""},
  {"name":"red cinnamon","category":"spice","taste":"spicy sweet pungent","cuisines":["Indian","Moroccan","Mexican","Persian","Turkish"],"isJunk":False,"junkReason":""},
  {"name":"red colored sugar","category":"sweetener","taste":"sweet","cuisines":["American","Global"],"isJunk":False,"junkReason":""},
  {"name":"red cooking wine","category":"liquid","taste":"sour bitter","cuisines":["French","Italian","Chinese"],"isJunk":False,"junkReason":""},
  {"name":"red delicious apple","category":"fruit","taste":"sweet sour","cuisines":["American","British"],"isJunk":False,"junkReason":""},
  {"name":"red enchilada sauce","category":"condiment","taste":"spicy sour","cuisines":["Mexican","Tex-Mex"],"isJunk":False,"junkReason":""},
  {"name":"red grape","category":"fruit","taste":"sweet sour","cuisines":["Italian","Spanish","French","Greek","Middle Eastern"],"isJunk":False,"junkReason":""},
  {"name":"red grape tomatoe","category":"vegetable","taste":"sweet sour umami","cuisines":["Italian","Mexican","Spanish","Turkish"],"isJunk":False,"junkReason":""},
  {"name":"red grapefruit","category":"citrus","taste":"sour bitter sweet","cuisines":["American","Israeli","Spanish"],"isJunk":False,"junkReason":""},
  {"name":"red grapefruit juice","category":"liquid","taste":"sour bitter sweet","cuisines":["American","Israeli","Spanish"],"isJunk":False,"junkReason":""},
  {"name":"red jalapeno","category":"chili","taste":"spicy pungent","cuisines":["Mexican","Tex-Mex"],"isJunk":False,"junkReason":""},
  {"name":"red jalapeno chile","category":"chili","taste":"spicy pungent","cuisines":["Mexican","Tex-Mex"],"isJunk":False,"junkReason":""},
  {"name":"red jalapeno pepper","category":"chili","taste":"spicy pungent","cuisines":["Mexican","Tex-Mex"],"isJunk":False,"junkReason":""},
  {"name":"red kidney bean","category":"protein","taste":"umami sweet","cuisines":["Mexican","Tex-Mex","Indian","Caribbean","Latin American"],"isJunk":False,"junkReason":""},
  {"name":"red leaf lettuce","category":"vegetable","taste":"bitter sweet","cuisines":["American","French","Italian"],"isJunk":False,"junkReason":""},
  {"name":"red lettuce","category":"vegetable","taste":"bitter sweet","cuisines":["American","French","Italian"],"isJunk":False,"junkReason":""},
  {"name":"red miso","category":"condiment","taste":"umami salty","cuisines":["Japanese"],"isJunk":False,"junkReason":""},
  {"name":"red new potatoe","category":"vegetable","taste":"sweet umami","cuisines":["American","Peruvian","French"],"isJunk":False,"junkReason":""},
  {"name":"red paprika","category":"spice","taste":"spicy sweet","cuisines":["Hungarian","Spanish","Turkish","Moroccan"],"isJunk":False,"junkReason":""},
  {"name":"red pear","category":"fruit","taste":"sweet sour","cuisines":["American","French","Italian"],"isJunk":False,"junkReason":""},
  {"name":"red pepper","category":"chili","taste":"spicy pungent","cuisines":["Mexican","Indian","Italian","Korean","Thai"],"isJunk":False,"junkReason":""},
  {"name":"red pepper sauce","category":"condiment","taste":"spicy sour","cuisines":["American","Mexican","Caribbean"],"isJunk":False,"junkReason":""},
  {"name":"red plum","category":"fruit","taste":"sweet sour","cuisines":["French","British","Chinese"],"isJunk":False,"junkReason":""},
  {"name":"red potato","category":"vegetable","taste":"sweet umami","cuisines":["American","Peruvian","French","German"],"isJunk":False,"junkReason":""},
  {"name":"red potatoe","category":"vegetable","taste":"sweet umami","cuisines":["American","Peruvian","French","German"],"isJunk":False,"junkReason":""},
  {"name":"red quinoa","category":"grain","taste":"sweet umami","cuisines":["Peruvian","Argentine","Global"],"isJunk":False,"junkReason":""},
  {"name":"red raspberry","category":"fruit","taste":"sour sweet","cuisines":["American","British","French"],"isJunk":False,"junkReason":""},
  {"name":"red raspberry preserve","category":"condiment","taste":"sweet sour","cuisines":["British","French","American"],"isJunk":False,"junkReason":""},
  {"name":"red ripe tomatoe","category":"vegetable","taste":"sweet sour umami","cuisines":["Italian","Mexican","Spanish","Turkish","Indian"],"isJunk":False,"junkReason":""},
  {"name":"red salmon","category":"protein","taste":"umami salty","cuisines":["Scandinavian","Japanese","Russian","American"],"isJunk":False,"junkReason":""},
  {"name":"red sauce","category":"condiment","taste":"sweet sour spicy","cuisines":["Italian","Mexican","American"],"isJunk":False,"junkReason":""},
  {"name":"red seedless grape","category":"fruit","taste":"sweet sour","cuisines":["Italian","Spanish","French","Greek","Middle Eastern"],"isJunk":False,"junkReason":""},
]

inp = json.load(open('.ralph/audit_batches/batch_28.json', encoding='utf-8'))
assert len(data) == len(inp), f'LENGTH MISMATCH {len(data)} vs {len(inp)}'
for i,(d,r) in enumerate(zip(data,inp)):
    if d['name'] != r['name']:
        print(f'NAME MISMATCH at {i}: got {repr(d["name"])} expected {repr(r["name"])}')
        d['name'] = r['name']

with open('.ralph/audit_batches/batch_28.out.json','w',encoding='utf-8') as f:
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
