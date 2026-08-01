import json

data = [
  {"name":"tamarind paste","category":"acid","taste":"sour sweet","cuisines":["Indian","Thai","Indonesian","Malaysian","West African"],"isJunk":False,"junkReason":""},
  {"name":"tamarind pulp","category":"acid","taste":"sour sweet","cuisines":["Indian","Thai","Indonesian","Malaysian","West African"],"isJunk":False,"junkReason":""},
  {"name":"tandoori masala","category":"spice","taste":"spicy pungent umami","cuisines":["Indian","Pakistani"],"isJunk":False,"junkReason":""},
  {"name":"tandoori paste","category":"condiment","taste":"spicy pungent","cuisines":["Indian","Pakistani"],"isJunk":False,"junkReason":""},
  {"name":"tangerine","category":"citrus","taste":"sweet sour","cuisines":["Spanish","Chinese","Mediterranean","American"],"isJunk":False,"junkReason":""},
  {"name":"tangerine juice","category":"liquid","taste":"sweet sour","cuisines":["Spanish","Chinese","American","Mediterranean"],"isJunk":False,"junkReason":""},
  {"name":"tapioca flour","category":"thickener","taste":"sweet","cuisines":["Brazilian","Filipino","Thai","Chinese","Global"],"isJunk":False,"junkReason":""},
  {"name":"taro","category":"vegetable","taste":"sweet umami","cuisines":["Pacific Islander","Filipino","Chinese","Caribbean","West African"],"isJunk":False,"junkReason":""},
  {"name":"taro root","category":"vegetable","taste":"sweet umami","cuisines":["Pacific Islander","Filipino","Chinese","Caribbean","West African"],"isJunk":False,"junkReason":""},
  {"name":"tarragon","category":"herb","taste":"bitter pungent sweet","cuisines":["French","Italian","Eastern European"],"isJunk":False,"junkReason":""},
  {"name":"tarragon leaf","category":"herb","taste":"bitter pungent sweet","cuisines":["French","Italian"],"isJunk":False,"junkReason":""},
  {"name":"tarragon leave","category":"herb","taste":"bitter pungent sweet","cuisines":["French","Italian","Eastern European"],"isJunk":False,"junkReason":""},
  {"name":"tarragon vinegar","category":"acid","taste":"sour sweet pungent","cuisines":["French"],"isJunk":False,"junkReason":""},
  {"name":"tart apple","category":"fruit","taste":"sour sweet","cuisines":["American","British","French"],"isJunk":False,"junkReason":""},
  {"name":"tartar sauce","category":"condiment","taste":"sour pungent","cuisines":["French","American","British"],"isJunk":False,"junkReason":""},
  {"name":"tasty cheese","category":"dairy","taste":"umami salty","cuisines":["Australian","British","American"],"isJunk":False,"junkReason":""},
  {"name":"tbl butter","category":"fat","taste":"sweet","cuisines":["Global"],"isJunk":True,"junkReason":"Parse artifact — truncated unit abbreviation, not an ingredient"},
  {"name":"tbl olive oil","category":"fat","taste":"sweet","cuisines":["Global"],"isJunk":True,"junkReason":"Parse artifact — truncated unit abbreviation, not an ingredient"},
  {"name":"tea","category":"liquid","taste":"bitter astringent","cuisines":["British","Chinese","Indian","Japanese","Middle Eastern"],"isJunk":False,"junkReason":""},
  {"name":"tea leaf willow","category":"other","taste":"bitter astringent","cuisines":["Scandinavian","Eastern European"],"isJunk":False,"junkReason":""},
  {"name":"teff","category":"grain","taste":"bitter sweet umami","cuisines":["Ethiopian","Eritrean","West African"],"isJunk":False,"junkReason":""},
  {"name":"tempura crumb","category":"baked","taste":"sweet","cuisines":["Japanese"],"isJunk":False,"junkReason":""},
  {"name":"tennessee whiskey","category":"spirit","taste":"sweet bitter pungent","cuisines":["American","Southern US"],"isJunk":False,"junkReason":""},
  {"name":"tequila","category":"spirit","taste":"sweet pungent bitter","cuisines":["Mexican"],"isJunk":False,"junkReason":""},
  {"name":"teriyaki sauce","category":"condiment","taste":"umami sweet salty","cuisines":["Japanese"],"isJunk":False,"junkReason":""},
  {"name":"thai basil","category":"herb","taste":"sweet pungent bitter","cuisines":["Thai","Vietnamese","Indonesian"],"isJunk":False,"junkReason":""},
  {"name":"thai basil leave","category":"herb","taste":"sweet pungent bitter","cuisines":["Thai","Vietnamese","Indonesian"],"isJunk":False,"junkReason":""},
  {"name":"thai chile","category":"chili","taste":"spicy pungent","cuisines":["Thai","Vietnamese","Malaysian","Indonesian"],"isJunk":False,"junkReason":""},
  {"name":"thai chili paste","category":"condiment","taste":"spicy pungent","cuisines":["Thai","Malaysian","Indonesian"],"isJunk":False,"junkReason":""},
  {"name":"thai chilli jam","category":"condiment","taste":"sweet spicy","cuisines":["Thai","Malaysian"],"isJunk":False,"junkReason":""},
  {"name":"thai green curry paste","category":"condiment","taste":"spicy pungent","cuisines":["Thai"],"isJunk":False,"junkReason":""},
  {"name":"thai red curry paste","category":"condiment","taste":"spicy pungent","cuisines":["Thai"],"isJunk":False,"junkReason":""},
  {"name":"thawed whipped topping","category":"dairy","taste":"sweet","cuisines":["American"],"isJunk":False,"junkReason":""},
  {"name":"thick applesauce","category":"condiment","taste":"sweet sour","cuisines":["American","German"],"isJunk":False,"junkReason":""},
  {"name":"thick yogurt","category":"dairy","taste":"sour sweet","cuisines":["Indian","Turkish","Greek","Lebanese","Middle Eastern"],"isJunk":False,"junkReason":""},
  {"name":"thin bacon","category":"protein","taste":"umami salty","cuisines":["British","American"],"isJunk":False,"junkReason":""},
  {"name":"thin carrot","category":"vegetable","taste":"sweet umami","cuisines":["French","Chinese","Vietnamese","Moroccan"],"isJunk":False,"junkReason":""},
  {"name":"thin cream","category":"dairy","taste":"sweet","cuisines":["French","British","Scandinavian"],"isJunk":False,"junkReason":""},
  {"name":"thin egg noodle","category":"grain","taste":"sweet umami","cuisines":["Chinese","Japanese","Vietnamese","Malaysian"],"isJunk":False,"junkReason":""},
  {"name":"thin ginger","category":"aromatic","taste":"pungent spicy sweet","cuisines":["Chinese","Japanese","Indian","Thai","Korean"],"isJunk":False,"junkReason":""},
  {"name":"thin green bean","category":"vegetable","taste":"sweet astringent","cuisines":["French","American","Italian","Chinese"],"isJunk":False,"junkReason":""},
  {"name":"thin lemon","category":"citrus","taste":"sour sweet","cuisines":["Italian","French","Greek","Lebanese","Turkish"],"isJunk":False,"junkReason":""},
  {"name":"thin noodle","category":"grain","taste":"sweet umami","cuisines":["Chinese","Japanese","Vietnamese","Thai","Malaysian"],"isJunk":False,"junkReason":""},
  {"name":"thin onion","category":"aromatic","taste":"pungent sweet","cuisines":["French","Indian","Italian","Turkish"],"isJunk":False,"junkReason":""},
  {"name":"thin red onion","category":"aromatic","taste":"pungent sweet","cuisines":["French","Indian","Italian","Turkish","Greek"],"isJunk":False,"junkReason":""},
  {"name":"thin rice noodle","category":"grain","taste":"sweet umami","cuisines":["Vietnamese","Thai","Chinese","Malaysian"],"isJunk":False,"junkReason":""},
  {"name":"thin swiss cheese","category":"dairy","taste":"umami salty","cuisines":["Swiss","German","American"],"isJunk":False,"junkReason":""},
  {"name":"thin tomato","category":"vegetable","taste":"sweet sour umami","cuisines":["Italian","Mexican","Spanish","Turkish"],"isJunk":False,"junkReason":""},
  {"name":"thin wheat snack cracker","category":"baked","taste":"salty sweet","cuisines":["American","British"],"isJunk":False,"junkReason":""},
  {"name":"thin white bread","category":"baked","taste":"sweet","cuisines":["American","British"],"isJunk":False,"junkReason":""},
  {"name":"thistle","category":"vegetable","taste":"bitter astringent","cuisines":["Italian","Spanish","Sardinian"],"isJunk":False,"junkReason":""},
  {"name":"three cheese","category":"dairy","taste":"umami salty","cuisines":["Italian","American"],"isJunk":False,"junkReason":""},
  {"name":"thyme","category":"herb","taste":"bitter pungent","cuisines":["French","Caribbean","Italian","British","Cajun/Creole"],"isJunk":False,"junkReason":""},
  {"name":"tia maria","category":"liqueur","taste":"sweet bitter","cuisines":["Jamaican","Italian","Global"],"isJunk":False,"junkReason":""},
  {"name":"tiger prawn","category":"protein","taste":"umami salty sweet","cuisines":["Australian","Thai","Chinese","Indian","British"],"isJunk":False,"junkReason":""},
  {"name":"tinda","category":"vegetable","taste":"sweet","cuisines":["Indian","Pakistani"],"isJunk":False,"junkReason":""},
  {"name":"tinned tomato","category":"vegetable","taste":"sweet sour umami","cuisines":["Italian","British","American"],"isJunk":False,"junkReason":""},
  {"name":"tiny new potatoe","category":"vegetable","taste":"sweet umami","cuisines":["American","Peruvian","French","British"],"isJunk":False,"junkReason":""},
  {"name":"tiny pea","category":"vegetable","taste":"sweet","cuisines":["British","French","Indian"],"isJunk":False,"junkReason":""},
  {"name":"tiny shrimp","category":"protein","taste":"umami salty","cuisines":["American","Cajun/Creole","Thai","Vietnamese"],"isJunk":False,"junkReason":""},
  {"name":"tobasco sauce","category":"condiment","taste":"spicy sour","cuisines":["American","Cajun/Creole"],"isJunk":False,"junkReason":""},
  {"name":"toffee","category":"confection","taste":"sweet bitter","cuisines":["British","American"],"isJunk":False,"junkReason":""},
  {"name":"tofu","category":"protein","taste":"umami sweet","cuisines":["Chinese","Japanese","Korean","Thai","Vietnamese"],"isJunk":False,"junkReason":""},
  {"name":"tomato","category":"vegetable","taste":"sweet sour umami","cuisines":["Italian","Mexican","Spanish","Turkish","Indian"],"isJunk":False,"junkReason":""},
  {"name":"tomato basil","category":"herb","taste":"sweet pungent","cuisines":["Italian"],"isJunk":False,"junkReason":""},
  {"name":"tomato catsup","category":"condiment","taste":"sweet sour umami","cuisines":["American","Global"],"isJunk":False,"junkReason":""},
  {"name":"tomato chutney","category":"condiment","taste":"sweet sour spicy","cuisines":["Indian","British","Pakistani"],"isJunk":False,"junkReason":""},
  {"name":"tomato halve","category":"vegetable","taste":"sweet sour umami","cuisines":["Italian","Mexican","Spanish","Turkish","Indian"],"isJunk":False,"junkReason":""},
  {"name":"tomato juice","category":"liquid","taste":"sweet sour umami","cuisines":["American","Russian","Global"],"isJunk":False,"junkReason":""},
  {"name":"tomato ketchup","category":"condiment","taste":"sweet sour umami","cuisines":["American","British","Global"],"isJunk":False,"junkReason":""},
  {"name":"tomato passata","category":"condiment","taste":"sweet sour umami","cuisines":["Italian"],"isJunk":False,"junkReason":""},
  {"name":"tomato pasta sauce","category":"condiment","taste":"sweet sour umami","cuisines":["Italian","American"],"isJunk":False,"junkReason":""},
  {"name":"tomato paste","category":"condiment","taste":"umami sour sweet","cuisines":["Italian","Turkish","Moroccan","American","Indian"],"isJunk":False,"junkReason":""},
  {"name":"tomato pesto","category":"condiment","taste":"umami sweet sour","cuisines":["Italian"],"isJunk":False,"junkReason":""},
  {"name":"tomato purée","category":"condiment","taste":"sweet sour umami","cuisines":["Italian","British","American"],"isJunk":False,"junkReason":""},
  {"name":"tomato salsa","category":"condiment","taste":"spicy sour sweet","cuisines":["Mexican","Tex-Mex","American"],"isJunk":False,"junkReason":""},
  {"name":"tomato sauce","category":"condiment","taste":"sweet sour umami","cuisines":["Italian","Mexican","American","Spanish"],"isJunk":False,"junkReason":""},
  {"name":"tomato soup","category":"liquid","taste":"sweet sour umami","cuisines":["American","British","French"],"isJunk":False,"junkReason":""},
  {"name":"tomato vinaigrette","category":"condiment","taste":"sour sweet umami","cuisines":["Italian","American","French"],"isJunk":False,"junkReason":""},
  {"name":"tomato wedge","category":"vegetable","taste":"sweet sour umami","cuisines":["Italian","Mexican","Spanish","Turkish","Indian"],"isJunk":False,"junkReason":""},
  {"name":"tomato-vegetable juice cocktail","category":"liquid","taste":"sweet sour umami","cuisines":["American","Global"],"isJunk":False,"junkReason":""},
  {"name":"tomatoe","category":"vegetable","taste":"sweet sour umami","cuisines":["Italian","Mexican","Spanish","Turkish","Indian"],"isJunk":False,"junkReason":""},
  {"name":"tomatoe sauce","category":"condiment","taste":"sweet sour umami","cuisines":["Italian","Mexican","Spanish","American"],"isJunk":False,"junkReason":""},
  {"name":"tonic water","category":"mixer","taste":"bitter sweet","cuisines":["British","Global"],"isJunk":False,"junkReason":""},
  {"name":"tonkatsu sauce","category":"condiment","taste":"sweet sour umami","cuisines":["Japanese"],"isJunk":False,"junkReason":""},
  {"name":"torn basil","category":"herb","taste":"sweet pungent","cuisines":["Italian","French","Thai"],"isJunk":False,"junkReason":""},
  {"name":"torn iceberg lettuce","category":"vegetable","taste":"bitter sweet","cuisines":["American"],"isJunk":False,"junkReason":""},
  {"name":"torn leaf lettuce","category":"vegetable","taste":"bitter sweet","cuisines":["American","French"],"isJunk":False,"junkReason":""},
  {"name":"torn lettuce","category":"vegetable","taste":"bitter sweet","cuisines":["American","French","Italian"],"isJunk":False,"junkReason":""},
  {"name":"torn red leaf lettuce","category":"vegetable","taste":"bitter sweet","cuisines":["American","French"],"isJunk":False,"junkReason":""},
  {"name":"torn romaine lettuce","category":"vegetable","taste":"bitter sweet","cuisines":["American","French","Italian"],"isJunk":False,"junkReason":""},
  {"name":"torn romaine lettuce leave","category":"vegetable","taste":"bitter sweet","cuisines":["American","French","Italian"],"isJunk":False,"junkReason":""},
  {"name":"torn spinach","category":"vegetable","taste":"bitter sweet","cuisines":["Indian","Italian","French","Turkish"],"isJunk":False,"junkReason":""},
  {"name":"torn spinach leave","category":"vegetable","taste":"bitter sweet","cuisines":["Indian","Italian","French","Turkish"],"isJunk":False,"junkReason":""},
  {"name":"tortilla","category":"grain","taste":"sweet","cuisines":["Mexican","Tex-Mex","Latin American"],"isJunk":False,"junkReason":""},
  {"name":"tortilla chip","category":"grain","taste":"salty sweet","cuisines":["Mexican","Tex-Mex","American"],"isJunk":False,"junkReason":""},
  {"name":"towel gourd","category":"vegetable","taste":"sweet","cuisines":["Indian","Chinese","Pakistani","Filipino"],"isJunk":False,"junkReason":""},
  {"name":"trassi","category":"condiment","taste":"umami salty pungent","cuisines":["Indonesian","Malaysian"],"isJunk":False,"junkReason":""},
  {"name":"tree fern","category":"vegetable","taste":"bitter astringent","cuisines":["Maori","Pacific Islander","Filipino"],"isJunk":False,"junkReason":""},
  {"name":"triple sec","category":"liqueur","taste":"sweet bitter","cuisines":["French","Mexican","American"],"isJunk":False,"junkReason":""},
]

inp = json.load(open('.ralph/audit_batches/batch_34.json', encoding='utf-8'))
assert len(data) == len(inp), f'LENGTH MISMATCH {len(data)} vs {len(inp)}'
for i,(d,r) in enumerate(zip(data,inp)):
    if d['name'] != r['name']:
        print(f'NAME MISMATCH at {i}: got {repr(d["name"])} expected {repr(r["name"])}')
        d['name'] = r['name']

with open('.ralph/audit_batches/batch_34.out.json','w',encoding='utf-8') as f:
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
