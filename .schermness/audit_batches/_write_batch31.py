import json

data = [
  {"name":"sesame seed","category":"nut","taste":"umami sweet","cuisines":["Chinese","Japanese","Korean","Middle Eastern","Indian"],"isJunk":False,"junkReason":""},
  {"name":"sesame seed hamburger","category":"baked","taste":"sweet umami","cuisines":["American"],"isJunk":False,"junkReason":""},
  {"name":"sesame seed oil","category":"fat","taste":"umami pungent","cuisines":["Chinese","Japanese","Korean","Middle Eastern"],"isJunk":False,"junkReason":""},
  {"name":"sesame tahini","category":"condiment","taste":"umami bitter sweet","cuisines":["Lebanese","Israeli","Turkish","Middle Eastern","Greek"],"isJunk":False,"junkReason":""},
  {"name":"sesbania flower","category":"vegetable","taste":"sweet bitter","cuisines":["Thai","Indian","Filipino"],"isJunk":False,"junkReason":""},
  {"name":"shallot","category":"aromatic","taste":"pungent sweet","cuisines":["French","Italian","Thai","Vietnamese","Indian"],"isJunk":False,"junkReason":""},
  {"name":"shaoxing wine","category":"liquid","taste":"sweet umami sour","cuisines":["Chinese"],"isJunk":False,"junkReason":""},
  {"name":"sharp american cheese","category":"dairy","taste":"umami salty","cuisines":["American"],"isJunk":False,"junkReason":""},
  {"name":"sharp cheddar cheese","category":"dairy","taste":"umami salty","cuisines":["American","British","Tex-Mex"],"isJunk":False,"junkReason":""},
  {"name":"sharp cheese","category":"dairy","taste":"umami salty","cuisines":["American","British"],"isJunk":False,"junkReason":""},
  {"name":"shea tree","category":"fat","taste":"sweet","cuisines":["West African"],"isJunk":False,"junkReason":""},
  {"name":"shell noodle","category":"grain","taste":"sweet umami","cuisines":["Italian"],"isJunk":False,"junkReason":""},
  {"name":"shell pasta","category":"grain","taste":"sweet umami","cuisines":["Italian"],"isJunk":False,"junkReason":""},
  {"name":"shelled edamame","category":"vegetable","taste":"umami sweet","cuisines":["Japanese","Chinese","Korean"],"isJunk":False,"junkReason":""},
  {"name":"shelled pea","category":"vegetable","taste":"sweet","cuisines":["British","French","Indian"],"isJunk":False,"junkReason":""},
  {"name":"shellfish","category":"protein","taste":"umami salty","cuisines":["French","Japanese","American","Chinese","Italian"],"isJunk":True,"junkReason":"Too generic — not a specific ingredient"},
  {"name":"sherbet","category":"confection","taste":"sweet sour","cuisines":["American","British"],"isJunk":False,"junkReason":""},
  {"name":"sherry","category":"spirit","taste":"sweet bitter pungent","cuisines":["Spanish","Portuguese"],"isJunk":False,"junkReason":""},
  {"name":"sherry cooking wine","category":"liquid","taste":"sweet sour umami","cuisines":["Spanish","Chinese","French"],"isJunk":False,"junkReason":""},
  {"name":"sherry vinegar","category":"acid","taste":"sour sweet","cuisines":["Spanish","Portuguese"],"isJunk":False,"junkReason":""},
  {"name":"sherry wine","category":"spirit","taste":"sweet bitter","cuisines":["Spanish","Portuguese"],"isJunk":False,"junkReason":""},
  {"name":"sherry wine vinegar","category":"acid","taste":"sour sweet","cuisines":["Spanish","Portuguese"],"isJunk":False,"junkReason":""},
  {"name":"shichimi togarashi","category":"spice","taste":"spicy pungent bitter","cuisines":["Japanese"],"isJunk":False,"junkReason":""},
  {"name":"shiitake","category":"vegetable","taste":"umami","cuisines":["Japanese","Chinese","Korean","Vietnamese"],"isJunk":False,"junkReason":""},
  {"name":"shiitake mushroom","category":"vegetable","taste":"umami","cuisines":["Japanese","Chinese","Korean","Vietnamese"],"isJunk":False,"junkReason":""},
  {"name":"shiitake mushroom cap","category":"vegetable","taste":"umami","cuisines":["Japanese","Chinese","Korean","Vietnamese"],"isJunk":False,"junkReason":""},
  {"name":"shiso","category":"herb","taste":"bitter pungent","cuisines":["Japanese","Korean"],"isJunk":False,"junkReason":""},
  {"name":"shitake mushroom","category":"vegetable","taste":"umami","cuisines":["Japanese","Chinese","Korean","Vietnamese"],"isJunk":False,"junkReason":""},
  {"name":"shoe peg corn","category":"vegetable","taste":"sweet","cuisines":["American","Southern US"],"isJunk":False,"junkReason":""},
  {"name":"short pasta","category":"grain","taste":"sweet umami","cuisines":["Italian"],"isJunk":False,"junkReason":""},
  {"name":"short-grain brown rice","category":"grain","taste":"sweet umami","cuisines":["Japanese","Korean","Chinese"],"isJunk":False,"junkReason":""},
  {"name":"short-grain rice","category":"grain","taste":"sweet umami","cuisines":["Japanese","Korean","Chinese","Italian"],"isJunk":False,"junkReason":""},
  {"name":"short-grain white rice","category":"grain","taste":"sweet umami","cuisines":["Japanese","Korean","Chinese"],"isJunk":False,"junkReason":""},
  {"name":"shortbread","category":"baked","taste":"sweet","cuisines":["British","Scottish"],"isJunk":False,"junkReason":""},
  {"name":"shortbread cookie","category":"baked","taste":"sweet","cuisines":["British","Scottish","American"],"isJunk":False,"junkReason":""},
  {"name":"shortbread crust","category":"baked","taste":"sweet","cuisines":["British","American"],"isJunk":False,"junkReason":""},
  {"name":"shortbread pie crust","category":"baked","taste":"sweet","cuisines":["American","British"],"isJunk":False,"junkReason":""},
  {"name":"shortcrust pastry","category":"baked","taste":"sweet","cuisines":["British","French","Australian"],"isJunk":False,"junkReason":""},
  {"name":"shortening","category":"fat","taste":"sweet","cuisines":["American","Global"],"isJunk":False,"junkReason":""},
  {"name":"shoyu","category":"condiment","taste":"umami salty","cuisines":["Japanese","Hawaiian"],"isJunk":False,"junkReason":""},
  {"name":"shrimp","category":"protein","taste":"umami salty sweet","cuisines":["Chinese","Japanese","Thai","Cajun/Creole","Vietnamese"],"isJunk":False,"junkReason":""},
  {"name":"shrimp boil","category":"condiment","taste":"spicy salty pungent","cuisines":["American","Cajun/Creole"],"isJunk":False,"junkReason":""},
  {"name":"shrimp paste","category":"condiment","taste":"umami salty pungent","cuisines":["Thai","Indonesian","Malaysian","Vietnamese","Filipino"],"isJunk":False,"junkReason":""},
  {"name":"shrimp sauce","category":"condiment","taste":"umami salty pungent","cuisines":["Chinese","Thai","Vietnamese","Filipino"],"isJunk":False,"junkReason":""},
  {"name":"shrimp shell","category":"protein","taste":"umami salty","cuisines":["Chinese","Japanese","Thai","Vietnamese"],"isJunk":False,"junkReason":""},
  {"name":"shrimp soup","category":"liquid","taste":"umami salty spicy","cuisines":["Thai","Vietnamese","Cajun/Creole","Chinese"],"isJunk":False,"junkReason":""},
  {"name":"shrimp stock","category":"liquid","taste":"umami salty","cuisines":["French","Thai","Cajun/Creole","Chinese"],"isJunk":False,"junkReason":""},
  {"name":"sichuan pepper","category":"spice","taste":"spicy pungent","cuisines":["Chinese"],"isJunk":False,"junkReason":""},
  {"name":"sichuan peppercorn","category":"spice","taste":"spicy pungent","cuisines":["Chinese"],"isJunk":False,"junkReason":""},
  {"name":"silken tofu","category":"protein","taste":"umami sweet","cuisines":["Chinese","Japanese","Korean","Thai","Vietnamese"],"isJunk":False,"junkReason":""},
  {"name":"silver linden","category":"other","taste":"sweet pungent","cuisines":["Eastern European","Turkish"],"isJunk":False,"junkReason":""},
  {"name":"simple syrup","category":"sweetener","taste":"sweet","cuisines":["Global"],"isJunk":False,"junkReason":""},
  {"name":"single cream","category":"dairy","taste":"sweet","cuisines":["British","French"],"isJunk":False,"junkReason":""},
  {"name":"sirloin beef","category":"protein","taste":"umami salty","cuisines":["American","Argentine","British","Korean"],"isJunk":False,"junkReason":""},
  {"name":"sirloin roast","category":"protein","taste":"umami salty","cuisines":["American","British","Argentine"],"isJunk":False,"junkReason":""},
  {"name":"sirloin steak tip","category":"protein","taste":"umami salty","cuisines":["American","Argentine","British"],"isJunk":False,"junkReason":""},
  {"name":"skimmed milk","category":"dairy","taste":"sweet","cuisines":["Global"],"isJunk":False,"junkReason":""},
  {"name":"skirty steak","category":"protein","taste":"umami salty","cuisines":["American","Argentine","Mexican"],"isJunk":False,"junkReason":""},
  {"name":"slivered almond","category":"nut","taste":"sweet bitter","cuisines":["Moroccan","Indian","Spanish","French","Middle Eastern"],"isJunk":False,"junkReason":""},
  {"name":"slivered blanched almond","category":"nut","taste":"sweet bitter","cuisines":["Moroccan","Indian","Spanish","French","Middle Eastern"],"isJunk":False,"junkReason":""},
  {"name":"slivered red onion","category":"aromatic","taste":"pungent sweet","cuisines":["French","Italian","Greek","Indian","Turkish"],"isJunk":False,"junkReason":""},
  {"name":"smoked haddock","category":"protein","taste":"umami salty","cuisines":["British","Scandinavian","Scottish"],"isJunk":False,"junkReason":""},
  {"name":"smoked paprika","category":"spice","taste":"spicy sweet","cuisines":["Spanish","Hungarian","Portuguese","American"],"isJunk":False,"junkReason":""},
  {"name":"smoky paprika","category":"spice","taste":"spicy sweet","cuisines":["Spanish","Hungarian"],"isJunk":False,"junkReason":""},
  {"name":"smooth peanut butter","category":"condiment","taste":"umami sweet","cuisines":["American","West African","Thai"],"isJunk":False,"junkReason":""},
  {"name":"snap pea","category":"vegetable","taste":"sweet astringent","cuisines":["American","Chinese","British"],"isJunk":False,"junkReason":""},
  {"name":"snapper","category":"protein","taste":"umami salty","cuisines":["American","Caribbean","Japanese","Filipino"],"isJunk":False,"junkReason":""},
  {"name":"snow pea","category":"vegetable","taste":"sweet astringent","cuisines":["Chinese","Japanese","American","Vietnamese"],"isJunk":False,"junkReason":""},
  {"name":"snow pea pod","category":"vegetable","taste":"sweet astringent","cuisines":["Chinese","Japanese","American","Vietnamese"],"isJunk":False,"junkReason":""},
  {"name":"sockeye salmon","category":"protein","taste":"umami salty","cuisines":["American","Canadian","Scandinavian","Japanese"],"isJunk":False,"junkReason":""},
  {"name":"soda cracker crumb","category":"baked","taste":"salty sweet","cuisines":["American"],"isJunk":False,"junkReason":""},
  {"name":"soda water","category":"mixer","taste":"sweet","cuisines":["Global"],"isJunk":False,"junkReason":""},
  {"name":"sofrito","category":"condiment","taste":"pungent sweet umami","cuisines":["Puerto Rican","Caribbean","Spanish","Latin American"],"isJunk":False,"junkReason":""},
  {"name":"sofrito sauce","category":"condiment","taste":"pungent sweet umami","cuisines":["Spanish","Puerto Rican","Caribbean"],"isJunk":False,"junkReason":""},
  {"name":"soft breadcrumb","category":"baked","taste":"sweet","cuisines":["British","American","French"],"isJunk":False,"junkReason":""},
  {"name":"soft cheese","category":"dairy","taste":"umami sweet","cuisines":["French","Italian","British"],"isJunk":False,"junkReason":""},
  {"name":"somen noodle","category":"grain","taste":"sweet umami","cuisines":["Japanese","Korean"],"isJunk":False,"junkReason":""},
  {"name":"sorghum","category":"grain","taste":"sweet umami","cuisines":["West African","Ethiopian","Southern US","Indian"],"isJunk":False,"junkReason":""},
  {"name":"sorghum flour","category":"grain","taste":"sweet","cuisines":["West African","Indian","Global"],"isJunk":False,"junkReason":""},
  {"name":"sorghum syrup","category":"sweetener","taste":"sweet","cuisines":["American","Southern US"],"isJunk":False,"junkReason":""},
  {"name":"sorrel","category":"herb","taste":"sour astringent bitter","cuisines":["French","Eastern European","Caribbean","West African"],"isJunk":False,"junkReason":""},
  {"name":"soup","category":"liquid","taste":"umami salty","cuisines":["Global"],"isJunk":True,"junkReason":"Too generic — not a specific ingredient"},
  {"name":"soup stock","category":"liquid","taste":"umami salty","cuisines":["French","Japanese","Chinese","Italian"],"isJunk":False,"junkReason":""},
  {"name":"sour apple","category":"fruit","taste":"sour sweet","cuisines":["American","British","French"],"isJunk":False,"junkReason":""},
  {"name":"sour cream","category":"dairy","taste":"sour sweet","cuisines":["Hungarian","Tex-Mex","Russian","Polish","German","Scandinavian"],"isJunk":False,"junkReason":""},
  {"name":"sour cream dairy","category":"dairy","taste":"sour sweet","cuisines":["Hungarian","Russian","Polish","German","Scandinavian"],"isJunk":False,"junkReason":""},
  {"name":"sour lowfat milk","category":"dairy","taste":"sour sweet","cuisines":["Scandinavian","Russian","Global"],"isJunk":False,"junkReason":""},
  {"name":"sour milk","category":"dairy","taste":"sour sweet","cuisines":["Scandinavian","Russian","Eastern European"],"isJunk":False,"junkReason":""},
  {"name":"sour orange juice","category":"liquid","taste":"sour sweet bitter","cuisines":["Spanish","Caribbean","Moroccan","Peruvian"],"isJunk":False,"junkReason":""},
  {"name":"sour sauce","category":"condiment","taste":"sour sweet spicy","cuisines":["Chinese","Thai","Indian","American"],"isJunk":False,"junkReason":""},
  {"name":"sourdock","category":"herb","taste":"sour bitter","cuisines":["British","Scandinavian","American"],"isJunk":False,"junkReason":""},
  {"name":"sourdough","category":"baked","taste":"sour sweet umami","cuisines":["French","American","German","Scandinavian"],"isJunk":False,"junkReason":""},
  {"name":"soured cream","category":"dairy","taste":"sour sweet","cuisines":["British","French","Eastern European"],"isJunk":False,"junkReason":""},
  {"name":"soursop","category":"fruit","taste":"sweet sour","cuisines":["Caribbean","West African","Filipino","Brazilian"],"isJunk":False,"junkReason":""},
  {"name":"soy","category":"other","taste":"umami","cuisines":["Chinese","Japanese","Korean"],"isJunk":True,"junkReason":"Too generic — could be soy sauce, soy milk, tofu, etc."},
  {"name":"soy cheese","category":"dairy","taste":"umami salty","cuisines":["Global"],"isJunk":False,"junkReason":""},
  {"name":"soy cream","category":"dairy","taste":"sweet","cuisines":["Global"],"isJunk":False,"junkReason":""},
  {"name":"soy crumble","category":"protein","taste":"umami salty","cuisines":["Global"],"isJunk":False,"junkReason":""},
  {"name":"soy flour","category":"grain","taste":"umami sweet","cuisines":["Chinese","Japanese","Global"],"isJunk":False,"junkReason":""},
  {"name":"soy margarine","category":"fat","taste":"sweet","cuisines":["Global"],"isJunk":False,"junkReason":""},
]

inp = json.load(open('.ralph/audit_batches/batch_31.json', encoding='utf-8'))
assert len(data) == len(inp), f'LENGTH MISMATCH {len(data)} vs {len(inp)}'
for i,(d,r) in enumerate(zip(data,inp)):
    if d['name'] != r['name']:
        print(f'NAME MISMATCH at {i}: got {repr(d["name"])} expected {repr(r["name"])}')
        d['name'] = r['name']

with open('.ralph/audit_batches/batch_31.out.json','w',encoding='utf-8') as f:
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
