import json

data = [
  {"name":"red skin potatoe","category":"vegetable","taste":"sweet umami","cuisines":["American","Peruvian","French"],"isJunk":False,"junkReason":""},
  {"name":"red skinned potatoe","category":"vegetable","taste":"sweet umami","cuisines":["American","Peruvian","French","German"],"isJunk":False,"junkReason":""},
  {"name":"red sugar","category":"sweetener","taste":"sweet","cuisines":["Global"],"isJunk":False,"junkReason":""},
  {"name":"red sweet bell pepper","category":"vegetable","taste":"sweet","cuisines":["Spanish","Italian","Turkish","Mexican","French"],"isJunk":False,"junkReason":""},
  {"name":"red sweet pepper","category":"vegetable","taste":"sweet","cuisines":["Spanish","Italian","Turkish","Mexican","French"],"isJunk":False,"junkReason":""},
  {"name":"red thai chile","category":"chili","taste":"spicy pungent","cuisines":["Thai","Malaysian","Indonesian","Vietnamese"],"isJunk":False,"junkReason":""},
  {"name":"red tomato","category":"vegetable","taste":"sweet sour umami","cuisines":["Italian","Mexican","Spanish","Turkish","Indian"],"isJunk":False,"junkReason":""},
  {"name":"red tomatoe","category":"vegetable","taste":"sweet sour umami","cuisines":["Italian","Mexican","Spanish","Turkish","Indian"],"isJunk":False,"junkReason":""},
  {"name":"red vinegar","category":"acid","taste":"sour","cuisines":["Italian","Spanish","Greek"],"isJunk":False,"junkReason":""},
  {"name":"red wine","category":"liquid","taste":"sour bitter","cuisines":["French","Italian","Spanish","Argentine"],"isJunk":False,"junkReason":""},
  {"name":"red wine vinaigrette","category":"condiment","taste":"sour bitter","cuisines":["French","Italian","American"],"isJunk":False,"junkReason":""},
  {"name":"red wine vinegar","category":"acid","taste":"sour","cuisines":["French","Italian","Spanish","Greek","American"],"isJunk":False,"junkReason":""},
  {"name":"relish","category":"condiment","taste":"sweet sour pungent","cuisines":["American","British"],"isJunk":False,"junkReason":""},
  {"name":"remoulade sauce","category":"condiment","taste":"sour pungent","cuisines":["French","Cajun/Creole","Scandinavian"],"isJunk":False,"junkReason":""},
  {"name":"reserved juice","category":"liquid","taste":"sweet sour","cuisines":["Global"],"isJunk":True,"junkReason":"Generic parse artifact — not a specific ingredient"},
  {"name":"rhubarb","category":"vegetable","taste":"sour astringent","cuisines":["British","Scandinavian","American","Eastern European"],"isJunk":False,"junkReason":""},
  {"name":"rice","category":"grain","taste":"sweet umami","cuisines":["Chinese","Japanese","Indian","Thai","Korean"],"isJunk":False,"junkReason":""},
  {"name":"rice bran","category":"grain","taste":"sweet umami","cuisines":["Chinese","Japanese","Indian"],"isJunk":False,"junkReason":""},
  {"name":"rice bran oil","category":"fat","taste":"sweet","cuisines":["Japanese","Chinese","Indian","Global"],"isJunk":False,"junkReason":""},
  {"name":"rice bubble","category":"grain","taste":"sweet","cuisines":["Australian","American","British"],"isJunk":False,"junkReason":""},
  {"name":"rice cake","category":"grain","taste":"sweet umami","cuisines":["Korean","Japanese","Chinese","Vietnamese","Filipino"],"isJunk":False,"junkReason":""},
  {"name":"rice cereal","category":"grain","taste":"sweet","cuisines":["American","Global"],"isJunk":False,"junkReason":""},
  {"name":"rice cooked","category":"grain","taste":"sweet umami","cuisines":["Chinese","Japanese","Thai","Korean","Vietnamese"],"isJunk":False,"junkReason":""},
  {"name":"rice cracker","category":"grain","taste":"sweet umami","cuisines":["Japanese","Chinese","Korean"],"isJunk":False,"junkReason":""},
  {"name":"rice crispie","category":"grain","taste":"sweet","cuisines":["American","British","Australian"],"isJunk":False,"junkReason":""},
  {"name":"rice flour","category":"thickener","taste":"sweet","cuisines":["Chinese","Japanese","Thai","Vietnamese","Filipino"],"isJunk":False,"junkReason":""},
  {"name":"rice krispie","category":"grain","taste":"sweet","cuisines":["American","British"],"isJunk":True,"junkReason":"Branded product (Rice Krispies is a registered trademark of Kellogg's)"},
  {"name":"rice krispie cereal","category":"grain","taste":"sweet","cuisines":["American"],"isJunk":True,"junkReason":"Branded product (Rice Krispies is a registered trademark of Kellogg's)"},
  {"name":"rice milk","category":"liquid","taste":"sweet","cuisines":["Global"],"isJunk":False,"junkReason":""},
  {"name":"rice mix","category":"grain","taste":"sweet umami","cuisines":["Global"],"isJunk":True,"junkReason":"Too generic — not a specific ingredient"},
  {"name":"rice noodle","category":"grain","taste":"sweet","cuisines":["Chinese","Vietnamese","Thai","Malaysian","Filipino"],"isJunk":False,"junkReason":""},
  {"name":"rice paper","category":"grain","taste":"sweet","cuisines":["Vietnamese","Thai","Filipino"],"isJunk":False,"junkReason":""},
  {"name":"rice pilaf","category":"grain","taste":"sweet umami","cuisines":["Turkish","Lebanese","Persian","Greek","Middle Eastern"],"isJunk":False,"junkReason":""},
  {"name":"rice powder","category":"thickener","taste":"sweet","cuisines":["Chinese","Indian","Thai","Vietnamese"],"isJunk":False,"junkReason":""},
  {"name":"rice side","category":"grain","taste":"sweet umami","cuisines":["Global"],"isJunk":True,"junkReason":"Generic descriptor — not a specific ingredient"},
  {"name":"rice syrup","category":"sweetener","taste":"sweet","cuisines":["Japanese","Korean","Chinese","Global"],"isJunk":False,"junkReason":""},
  {"name":"rice vermicelli","category":"grain","taste":"sweet","cuisines":["Vietnamese","Chinese","Thai","Malaysian","Singaporean"],"isJunk":False,"junkReason":""},
  {"name":"rice vermicelli noodle","category":"grain","taste":"sweet","cuisines":["Vietnamese","Chinese","Thai","Malaysian","Singaporean"],"isJunk":False,"junkReason":""},
  {"name":"rice vinegar","category":"acid","taste":"sour sweet","cuisines":["Chinese","Japanese","Korean","Vietnamese","Thai"],"isJunk":False,"junkReason":""},
  {"name":"rice-a-roni","category":"grain","taste":"sweet umami","cuisines":["American"],"isJunk":True,"junkReason":"Branded product (Rice-A-Roni is a registered trademark of PepsiCo/Quaker)"},
  {"name":"rice-wine vinegar","category":"acid","taste":"sour sweet","cuisines":["Chinese","Japanese","Korean","Vietnamese","Thai"],"isJunk":False,"junkReason":""},
  {"name":"ricotta","category":"dairy","taste":"sweet umami","cuisines":["Italian","Greek","American"],"isJunk":False,"junkReason":""},
  {"name":"ricotta salata cheese","category":"dairy","taste":"salty umami","cuisines":["Italian","Greek"],"isJunk":False,"junkReason":""},
  {"name":"riesling wine","category":"liquid","taste":"sweet sour","cuisines":["German","French","Australian","Austrian"],"isJunk":False,"junkReason":""},
  {"name":"rigatoni noodle","category":"grain","taste":"sweet umami","cuisines":["Italian"],"isJunk":False,"junkReason":""},
  {"name":"rigatoni pasta","category":"grain","taste":"sweet umami","cuisines":["Italian"],"isJunk":False,"junkReason":""},
  {"name":"ripe banana","category":"fruit","taste":"sweet","cuisines":["Caribbean","Filipino","Brazilian","Indian","Global"],"isJunk":False,"junkReason":""},
  {"name":"ripe olive","category":"condiment","taste":"salty sour bitter","cuisines":["Spanish","Italian","Greek","Turkish","Lebanese"],"isJunk":False,"junkReason":""},
  {"name":"ripe peache","category":"fruit","taste":"sweet sour","cuisines":["American","French","Italian"],"isJunk":False,"junkReason":""},
  {"name":"ripe tomatoe","category":"vegetable","taste":"sweet sour umami","cuisines":["Italian","Mexican","Spanish","Turkish","Indian"],"isJunk":False,"junkReason":""},
  {"name":"risotto rice","category":"grain","taste":"sweet umami","cuisines":["Italian"],"isJunk":False,"junkReason":""},
  {"name":"ro-tel tomatoe","category":"vegetable","taste":"sweet sour spicy","cuisines":["Tex-Mex","Mexican","American"],"isJunk":False,"junkReason":""},
  {"name":"roasted garlic","category":"aromatic","taste":"sweet pungent umami","cuisines":["Italian","French","Spanish","Middle Eastern"],"isJunk":False,"junkReason":""},
  {"name":"roaster","category":"protein","taste":"umami salty","cuisines":["American","Global"],"isJunk":True,"junkReason":"Generic descriptor — ambiguous, could be a pan or chicken"},
  {"name":"roasting chicken","category":"protein","taste":"umami salty","cuisines":["French","American","British","Chinese"],"isJunk":False,"junkReason":""},
  {"name":"rock salt","category":"seasoning","taste":"salty","cuisines":["Global"],"isJunk":False,"junkReason":""},
  {"name":"rock sugar","category":"sweetener","taste":"sweet","cuisines":["Chinese","Vietnamese","Indian"],"isJunk":False,"junkReason":""},
  {"name":"rocket","category":"vegetable","taste":"bitter pungent","cuisines":["Italian","British","Australian"],"isJunk":False,"junkReason":""},
  {"name":"rockfish","category":"protein","taste":"umami salty","cuisines":["American","Japanese","Korean"],"isJunk":False,"junkReason":""},
  {"name":"roibos tea","category":"liquid","taste":"sweet astringent","cuisines":["South African"],"isJunk":False,"junkReason":""},
  {"name":"roll garlic","category":"baked","taste":"sweet pungent","cuisines":["Italian","American","French"],"isJunk":False,"junkReason":""},
  {"name":"roll sausage","category":"protein","taste":"umami salty spicy","cuisines":["British","German","American"],"isJunk":False,"junkReason":""},
  {"name":"roll sugar cookie","category":"baked","taste":"sweet","cuisines":["American","Scandinavian"],"isJunk":False,"junkReason":""},
  {"name":"rolled pork","category":"protein","taste":"umami salty","cuisines":["Italian","Chinese","German","Filipino"],"isJunk":False,"junkReason":""},
  {"name":"roma tomatoe","category":"vegetable","taste":"sweet sour umami","cuisines":["Italian","Mexican","Spanish","Turkish","American"],"isJunk":False,"junkReason":""},
  {"name":"romaine lettuce","category":"vegetable","taste":"bitter sweet","cuisines":["American","French","Italian","Greek","Lebanese"],"isJunk":False,"junkReason":""},
  {"name":"romaine lettuce heart","category":"vegetable","taste":"bitter sweet","cuisines":["American","French","Italian"],"isJunk":False,"junkReason":""},
  {"name":"romaine lettuce leaf","category":"vegetable","taste":"bitter sweet","cuisines":["American","French","Italian"],"isJunk":False,"junkReason":""},
  {"name":"romaine lettuce leave","category":"vegetable","taste":"bitter sweet","cuisines":["American","French","Italian"],"isJunk":False,"junkReason":""},
  {"name":"romano bean","category":"protein","taste":"umami sweet","cuisines":["Italian","British","Middle Eastern"],"isJunk":False,"junkReason":""},
  {"name":"romano cheese","category":"dairy","taste":"umami salty","cuisines":["Italian","American"],"isJunk":False,"junkReason":""},
  {"name":"romano pepper","category":"chili","taste":"sweet spicy","cuisines":["Italian","Spanish"],"isJunk":False,"junkReason":""},
  {"name":"romesco sauce","category":"condiment","taste":"spicy sweet umami","cuisines":["Spanish","Catalan"],"isJunk":False,"junkReason":""},
  {"name":"root","category":"other","taste":"sweet pungent","cuisines":["Global"],"isJunk":True,"junkReason":"Overly generic — not a specific ingredient"},
  {"name":"root beer","category":"mixer","taste":"sweet","cuisines":["American"],"isJunk":False,"junkReason":""},
  {"name":"root ginger","category":"aromatic","taste":"pungent spicy sweet","cuisines":["Chinese","Indian","Japanese","Thai","Korean"],"isJunk":False,"junkReason":""},
  {"name":"root vegetable","category":"other","taste":"sweet pungent","cuisines":["Global"],"isJunk":True,"junkReason":"Overly generic — not a specific ingredient"},
  {"name":"roquefort cheese","category":"dairy","taste":"umami salty bitter","cuisines":["French"],"isJunk":False,"junkReason":""},
  {"name":"rose","category":"other","taste":"sweet pungent","cuisines":["Persian","Turkish","Moroccan","French"],"isJunk":True,"junkReason":"Ambiguous — ornamental flower not normally a culinary ingredient on its own"},
  {"name":"rose hip","category":"fruit","taste":"sour sweet astringent","cuisines":["Scandinavian","British","Turkish","Eastern European"],"isJunk":False,"junkReason":""},
  {"name":"rose water","category":"liquid","taste":"sweet pungent","cuisines":["Persian","Turkish","Lebanese","Moroccan","Indian"],"isJunk":False,"junkReason":""},
  {"name":"rose wine","category":"liquid","taste":"sweet sour","cuisines":["French","Spanish","Italian","Californian"],"isJunk":False,"junkReason":""},
  {"name":"roseapple","category":"fruit","taste":"sweet sour","cuisines":["Thai","Filipino","Indonesian","Malaysian"],"isJunk":False,"junkReason":""},
  {"name":"roselle","category":"fruit","taste":"sour sweet","cuisines":["West African","Thai","Caribbean","Filipino"],"isJunk":False,"junkReason":""},
  {"name":"rosemary","category":"herb","taste":"bitter pungent","cuisines":["Italian","French","Spanish","Greek","British"],"isJunk":False,"junkReason":""},
  {"name":"rosemary leaf","category":"herb","taste":"bitter pungent","cuisines":["Italian","French","Spanish","Greek"],"isJunk":False,"junkReason":""},
  {"name":"rosemary needle","category":"herb","taste":"bitter pungent","cuisines":["Italian","French","Spanish"],"isJunk":False,"junkReason":""},
  {"name":"rosewater","category":"liquid","taste":"sweet pungent","cuisines":["Persian","Turkish","Lebanese","Moroccan","Indian"],"isJunk":False,"junkReason":""},
  {"name":"rotelle pasta","category":"grain","taste":"sweet umami","cuisines":["Italian"],"isJunk":False,"junkReason":""},
  {"name":"rotini noodle","category":"grain","taste":"sweet umami","cuisines":["Italian"],"isJunk":False,"junkReason":""},
  {"name":"rotini pasta","category":"grain","taste":"sweet umami","cuisines":["Italian"],"isJunk":False,"junkReason":""},
  {"name":"rotisserie chicken","category":"protein","taste":"umami salty","cuisines":["French","American","British"],"isJunk":False,"junkReason":""},
  {"name":"round beef","category":"protein","taste":"umami salty","cuisines":["American","Argentine","British"],"isJunk":False,"junkReason":""},
  {"name":"round roast","category":"protein","taste":"umami salty","cuisines":["American","British","Argentine"],"isJunk":False,"junkReason":""},
  {"name":"rowal","category":"fruit","taste":"sour sweet","cuisines":["Indian","South Asian"],"isJunk":False,"junkReason":""},
  {"name":"ruby grapefruit","category":"citrus","taste":"sour bitter sweet","cuisines":["American","Israeli","Spanish"],"isJunk":False,"junkReason":""},
  {"name":"ruby red grapefruit juice","category":"liquid","taste":"sour bitter sweet","cuisines":["American","Israeli","Spanish"],"isJunk":False,"junkReason":""},
  {"name":"rum","category":"spirit","taste":"sweet","cuisines":["Caribbean","Brazilian","Cuban","Jamaican"],"isJunk":False,"junkReason":""},
  {"name":"rump","category":"protein","taste":"umami salty","cuisines":["British","Australian","Argentine"],"isJunk":False,"junkReason":""},
  {"name":"rump roast","category":"protein","taste":"umami salty","cuisines":["American","British","Argentine"],"isJunk":False,"junkReason":""},
]

inp = json.load(open('.ralph/audit_batches/batch_29.json', encoding='utf-8'))
assert len(data) == len(inp), f'LENGTH MISMATCH {len(data)} vs {len(inp)}'
for i,(d,r) in enumerate(zip(data,inp)):
    if d['name'] != r['name']:
        print(f'NAME MISMATCH at {i}: got {repr(d["name"])} expected {repr(r["name"])}')
        d['name'] = r['name']

with open('.ralph/audit_batches/batch_29.out.json','w',encoding='utf-8') as f:
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
