import json

data = [
  {"name":"vanilla soy milk","category":"liquid","taste":"sweet","cuisines":["Chinese","Japanese","Global"],"isJunk":False,"junkReason":""},
  {"name":"vanilla sugar","category":"sweetener","taste":"sweet","cuisines":["German","Scandinavian","French","Global"],"isJunk":False,"junkReason":""},
  {"name":"vanilla syrup","category":"sweetener","taste":"sweet","cuisines":["American","French"],"isJunk":False,"junkReason":""},
  {"name":"vanilla tapioca","category":"confection","taste":"sweet","cuisines":["American","Global"],"isJunk":False,"junkReason":""},
  {"name":"vanilla vodka","category":"spirit","taste":"sweet bitter","cuisines":["American","Russian"],"isJunk":False,"junkReason":""},
  {"name":"vanilla wafer","category":"baked","taste":"sweet","cuisines":["American"],"isJunk":False,"junkReason":""},
  {"name":"vanilla wafer cookie","category":"baked","taste":"sweet","cuisines":["American"],"isJunk":False,"junkReason":""},
  {"name":"vanilla wafer crumb","category":"baked","taste":"sweet","cuisines":["American"],"isJunk":False,"junkReason":""},
  {"name":"vanilla whey","category":"dairy","taste":"sweet","cuisines":["Global"],"isJunk":False,"junkReason":""},
  {"name":"vanilla yogurt","category":"dairy","taste":"sweet sour","cuisines":["American","Global"],"isJunk":False,"junkReason":""},
  {"name":"vanilla-flavored","category":"other","taste":"sweet","cuisines":["Global"],"isJunk":True,"junkReason":"Parse artifact — adjective, not a specific ingredient"},
  {"name":"vanilla-flavored soymilk","category":"liquid","taste":"sweet","cuisines":["Chinese","Japanese","Global"],"isJunk":False,"junkReason":""},
  {"name":"vanilla-flavored syrup","category":"sweetener","taste":"sweet","cuisines":["American"],"isJunk":False,"junkReason":""},
  {"name":"veal","category":"protein","taste":"umami salty","cuisines":["French","Italian","German","Austrian"],"isJunk":False,"junkReason":""},
  {"name":"veal reduction","category":"liquid","taste":"umami salty","cuisines":["French","Italian"],"isJunk":False,"junkReason":""},
  {"name":"veal scallop","category":"protein","taste":"umami salty","cuisines":["Italian","French","German"],"isJunk":False,"junkReason":""},
  {"name":"veal scallopini","category":"protein","taste":"umami salty","cuisines":["Italian","French"],"isJunk":False,"junkReason":""},
  {"name":"veal stock","category":"liquid","taste":"umami salty","cuisines":["French","Italian"],"isJunk":False,"junkReason":""},
  {"name":"veg oil","category":"fat","taste":"sweet","cuisines":["Global"],"isJunk":False,"junkReason":""},
  {"name":"vegan butter","category":"fat","taste":"sweet","cuisines":["Global"],"isJunk":False,"junkReason":""},
  {"name":"vegan cheese","category":"dairy","taste":"umami salty","cuisines":["Global"],"isJunk":False,"junkReason":""},
  {"name":"vegan sugar","category":"sweetener","taste":"sweet","cuisines":["Global"],"isJunk":False,"junkReason":""},
  {"name":"vegetable","category":"vegetable","taste":"sweet umami","cuisines":["Global"],"isJunk":True,"junkReason":"Too generic — not a specific ingredient"},
  {"name":"vegetable beef soup","category":"liquid","taste":"umami salty","cuisines":["American","German"],"isJunk":False,"junkReason":""},
  {"name":"vegetable broth","category":"liquid","taste":"umami sweet","cuisines":["French","Italian","Chinese","American"],"isJunk":False,"junkReason":""},
  {"name":"vegetable juice","category":"liquid","taste":"sweet sour umami","cuisines":["American","Global"],"isJunk":False,"junkReason":""},
  {"name":"vegetable juice cocktail","category":"liquid","taste":"sweet sour umami","cuisines":["American","Global"],"isJunk":False,"junkReason":""},
  {"name":"vegetable oil olive","category":"fat","taste":"sweet","cuisines":["Spanish","Italian","Portuguese"],"isJunk":False,"junkReason":""},
  {"name":"vegetable shortening","category":"fat","taste":"sweet","cuisines":["American","Global"],"isJunk":False,"junkReason":""},
  {"name":"vegetable soup","category":"liquid","taste":"umami sweet salty","cuisines":["American","French","Italian","Chinese"],"isJunk":False,"junkReason":""},
  {"name":"vegetable soup mix","category":"condiment","taste":"umami salty","cuisines":["American","Global"],"isJunk":False,"junkReason":""},
  {"name":"vegetable stock","category":"liquid","taste":"umami sweet","cuisines":["French","Italian","Chinese","American"],"isJunk":False,"junkReason":""},
  {"name":"vegetarian baked bean","category":"protein","taste":"umami sweet","cuisines":["British","American"],"isJunk":False,"junkReason":""},
  {"name":"vegetarian beef","category":"protein","taste":"umami salty","cuisines":["Chinese","Global"],"isJunk":False,"junkReason":""},
  {"name":"vegetarian chicken","category":"protein","taste":"umami salty","cuisines":["Chinese","Global"],"isJunk":False,"junkReason":""},
  {"name":"vegetarian refried bean","category":"protein","taste":"umami spicy salty","cuisines":["Mexican","Tex-Mex"],"isJunk":False,"junkReason":""},
  {"name":"vegetarian worcestershire sauce","category":"condiment","taste":"umami sour sweet","cuisines":["British","American"],"isJunk":False,"junkReason":""},
  {"name":"veggie","category":"vegetable","taste":"sweet umami","cuisines":["Global"],"isJunk":True,"junkReason":"Too generic — not a specific ingredient"},
  {"name":"veggie broth","category":"liquid","taste":"umami sweet","cuisines":["French","American","Italian"],"isJunk":False,"junkReason":""},
  {"name":"veggie burger","category":"protein","taste":"umami salty","cuisines":["American","Global"],"isJunk":False,"junkReason":""},
  {"name":"veggie crumble","category":"protein","taste":"umami salty","cuisines":["American","Global"],"isJunk":False,"junkReason":""},
  {"name":"veggie oil","category":"fat","taste":"sweet","cuisines":["Global"],"isJunk":False,"junkReason":""},
  {"name":"veggie stock","category":"liquid","taste":"umami sweet","cuisines":["French","American","Italian"],"isJunk":False,"junkReason":""},
  {"name":"velveeta cheese","category":"dairy","taste":"umami salty","cuisines":["American","Tex-Mex","Southern US"],"isJunk":True,"junkReason":"Branded product (Velveeta is a registered trademark of Kraft Heinz)"},
  {"name":"velveeta reduced fat cheese","category":"dairy","taste":"umami salty","cuisines":["American","Tex-Mex"],"isJunk":True,"junkReason":"Branded product (Velveeta is a registered trademark of Kraft Heinz)"},
  {"name":"venison roast","category":"protein","taste":"umami salty","cuisines":["German","Scandinavian","British","American"],"isJunk":False,"junkReason":""},
  {"name":"vermicelli","category":"grain","taste":"sweet umami","cuisines":["Italian","Chinese","Vietnamese","Thai"],"isJunk":False,"junkReason":""},
  {"name":"vermicelli pasta","category":"grain","taste":"sweet umami","cuisines":["Italian"],"isJunk":False,"junkReason":""},
  {"name":"vermicelli rice noodle","category":"grain","taste":"sweet umami","cuisines":["Vietnamese","Chinese","Thai","Malaysian"],"isJunk":False,"junkReason":""},
  {"name":"vermouth","category":"liqueur","taste":"bitter sweet","cuisines":["Italian","French"],"isJunk":False,"junkReason":""},
  {"name":"very lean beef","category":"protein","taste":"umami salty","cuisines":["American","Argentine","Global"],"isJunk":False,"junkReason":""},
  {"name":"very milk","category":"dairy","taste":"sweet","cuisines":["Global"],"isJunk":True,"junkReason":"Parse artifact — incomplete/nonsensical name"},
  {"name":"very ripe banana","category":"fruit","taste":"sweet","cuisines":["Caribbean","Filipino","Brazilian","Global"],"isJunk":False,"junkReason":""},
  {"name":"very ripe tomatoe","category":"vegetable","taste":"sweet sour umami","cuisines":["Italian","Mexican","Spanish","Turkish","Indian"],"isJunk":False,"junkReason":""},
  {"name":"vidalia onion","category":"aromatic","taste":"sweet pungent","cuisines":["American","Southern US"],"isJunk":False,"junkReason":""},
  {"name":"vinaigrette dressing","category":"condiment","taste":"sour sweet","cuisines":["French","American","Italian"],"isJunk":False,"junkReason":""},
  {"name":"vinegar","category":"acid","taste":"sour","cuisines":["Global"],"isJunk":False,"junkReason":""},
  {"name":"virgin coconut oil","category":"fat","taste":"sweet","cuisines":["Indian","Thai","Filipino","Indonesian","Pacific Islander"],"isJunk":False,"junkReason":""},
  {"name":"virgin extra virgin olive oil","category":"fat","taste":"sweet pungent bitter","cuisines":["Italian","Spanish","Greek","Moroccan"],"isJunk":False,"junkReason":""},
  {"name":"virgin olive oil","category":"fat","taste":"sweet pungent bitter","cuisines":["Italian","Spanish","Greek"],"isJunk":False,"junkReason":""},
  {"name":"vital wheat gluten","category":"grain","taste":"umami sweet","cuisines":["Chinese","Global"],"isJunk":False,"junkReason":""},
  {"name":"vodka","category":"spirit","taste":"sweet bitter","cuisines":["Russian","Polish","Scandinavian"],"isJunk":False,"junkReason":""},
  {"name":"vodka sauce","category":"condiment","taste":"sweet sour umami","cuisines":["Italian","American"],"isJunk":False,"junkReason":""},
  {"name":"västerbottensost cheese","category":"dairy","taste":"umami salty","cuisines":["Swedish","Scandinavian"],"isJunk":False,"junkReason":""},
  {"name":"wagon wheel pasta","category":"grain","taste":"sweet umami","cuisines":["Italian"],"isJunk":False,"junkReason":""},
  {"name":"wakame","category":"vegetable","taste":"umami salty","cuisines":["Japanese","Korean","Chinese"],"isJunk":False,"junkReason":""},
  {"name":"walla walla onion","category":"aromatic","taste":"sweet pungent","cuisines":["American"],"isJunk":False,"junkReason":""},
  {"name":"walnut","category":"nut","taste":"bitter sweet","cuisines":["French","Italian","Turkish","Persian","American"],"isJunk":False,"junkReason":""},
  {"name":"walnut meat","category":"nut","taste":"bitter sweet","cuisines":["Turkish","Lebanese","Persian","French","American"],"isJunk":False,"junkReason":""},
  {"name":"walnut oil","category":"fat","taste":"sweet umami","cuisines":["French","Italian","Turkish","Persian"],"isJunk":False,"junkReason":""},
  {"name":"wasabi","category":"spice","taste":"spicy pungent","cuisines":["Japanese"],"isJunk":False,"junkReason":""},
  {"name":"wasabi paste","category":"condiment","taste":"spicy pungent","cuisines":["Japanese"],"isJunk":False,"junkReason":""},
  {"name":"wasabi pea","category":"vegetable","taste":"spicy sweet","cuisines":["Japanese"],"isJunk":False,"junkReason":""},
  {"name":"wasabi powder","category":"spice","taste":"spicy pungent","cuisines":["Japanese"],"isJunk":False,"junkReason":""},
  {"name":"water","category":"liquid","taste":"sweet","cuisines":["Global"],"isJunk":False,"junkReason":""},
  {"name":"water chestnut","category":"vegetable","taste":"sweet umami","cuisines":["Chinese","Vietnamese","Thai","Korean"],"isJunk":False,"junkReason":""},
  {"name":"watercress","category":"vegetable","taste":"bitter pungent spicy","cuisines":["British","French","Chinese","Japanese"],"isJunk":False,"junkReason":""},
  {"name":"watercress leaf","category":"vegetable","taste":"bitter pungent spicy","cuisines":["British","French","Chinese","Japanese"],"isJunk":False,"junkReason":""},
  {"name":"watermelon","category":"fruit","taste":"sweet","cuisines":["American","Middle Eastern","West African","Chinese"],"isJunk":False,"junkReason":""},
  {"name":"watermelon ball","category":"fruit","taste":"sweet","cuisines":["American","Middle Eastern","Global"],"isJunk":False,"junkReason":""},
  {"name":"watermelon juice","category":"liquid","taste":"sweet","cuisines":["American","Middle Eastern","Global"],"isJunk":False,"junkReason":""},
  {"name":"watermelon rind","category":"fruit","taste":"sweet","cuisines":["American","Chinese","Middle Eastern"],"isJunk":False,"junkReason":""},
  {"name":"wattle","category":"other","taste":"sweet pungent","cuisines":["Australian"],"isJunk":False,"junkReason":""},
  {"name":"wax bean","category":"vegetable","taste":"sweet astringent","cuisines":["American","French","Italian"],"isJunk":False,"junkReason":""},
  {"name":"weight bacon","category":"protein","taste":"umami salty","cuisines":["American","British"],"isJunk":True,"junkReason":"Parse artifact — unit-prefixed entry, not a real ingredient name"},
  {"name":"weight bittersweet chocolate","category":"confection","taste":"bitter sweet","cuisines":["American","French","Belgian"],"isJunk":True,"junkReason":"Parse artifact — unit-prefixed entry, not a real ingredient name"},
  {"name":"weight butter","category":"fat","taste":"sweet","cuisines":["Global"],"isJunk":True,"junkReason":"Parse artifact — unit-prefixed entry, not a real ingredient name"},
  {"name":"weight chicken","category":"protein","taste":"umami salty","cuisines":["Global"],"isJunk":True,"junkReason":"Parse artifact — unit-prefixed entry, not a real ingredient name"},
  {"name":"weight chocolate","category":"confection","taste":"sweet bitter","cuisines":["American","French","Belgian"],"isJunk":True,"junkReason":"Parse artifact — unit-prefixed entry, not a real ingredient name"},
  {"name":"weight cream cheese","category":"dairy","taste":"umami sweet","cuisines":["American"],"isJunk":True,"junkReason":"Parse artifact — unit-prefixed entry, not a real ingredient name"},
  {"name":"weight mushroom","category":"vegetable","taste":"umami","cuisines":["Global"],"isJunk":True,"junkReason":"Parse artifact — unit-prefixed entry, not a real ingredient name"},
  {"name":"weight semisweet chocolate","category":"confection","taste":"sweet bitter","cuisines":["American","French","Belgian"],"isJunk":True,"junkReason":"Parse artifact — unit-prefixed entry, not a real ingredient name"},
  {"name":"weight sugar","category":"sweetener","taste":"sweet","cuisines":["Global"],"isJunk":True,"junkReason":"Parse artifact — unit-prefixed entry, not a real ingredient name"},
  {"name":"weight white chocolate","category":"confection","taste":"sweet","cuisines":["American","French","Belgian"],"isJunk":True,"junkReason":"Parse artifact — unit-prefixed entry, not a real ingredient name"},
  {"name":"weight white chocolate chip","category":"confection","taste":"sweet","cuisines":["American"],"isJunk":True,"junkReason":"Parse artifact — unit-prefixed entry, not a real ingredient name"},
  {"name":"well-shaken buttermilk","category":"dairy","taste":"sour sweet","cuisines":["American","British","Indian"],"isJunk":False,"junkReason":""},
  {"name":"wesson oil","category":"fat","taste":"sweet","cuisines":["American","Global"],"isJunk":True,"junkReason":"Branded product (Wesson is a registered trademark of Conagra Brands)"},
  {"name":"wheat","category":"grain","taste":"sweet umami","cuisines":["Global"],"isJunk":False,"junkReason":""},
  {"name":"wheat baguette","category":"baked","taste":"sweet umami","cuisines":["French"],"isJunk":False,"junkReason":""},
  {"name":"wheat biscuit","category":"baked","taste":"sweet","cuisines":["British","Australian","American"],"isJunk":False,"junkReason":""},
]

inp = json.load(open('.ralph/audit_batches/batch_36.json', encoding='utf-8'))
assert len(data) == len(inp), f'LENGTH MISMATCH {len(data)} vs {len(inp)}'
for i,(d,r) in enumerate(zip(data,inp)):
    if d['name'] != r['name']:
        print(f'NAME MISMATCH at {i}: got {repr(d["name"])} expected {repr(r["name"])}')
        d['name'] = r['name']

with open('.ralph/audit_batches/batch_36.out.json','w',encoding='utf-8') as f:
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
