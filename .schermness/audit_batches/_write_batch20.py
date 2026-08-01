import json

data = [
  {"name":"lasagna noodle","category":"grain","taste":"sweet","cuisines":["Italian"],"isJunk":False,"junkReason":""},
  {"name":"laurel","category":"herb","taste":"pungent bitter","cuisines":["Mediterranean","French","Turkish"],"isJunk":False,"junkReason":""},
  {"name":"lavendar","category":"herb","taste":"sweet pungent","cuisines":["French","Moroccan","Provencal"],"isJunk":False,"junkReason":""},
  {"name":"lavender","category":"herb","taste":"sweet pungent","cuisines":["French","Moroccan"],"isJunk":False,"junkReason":""},
  {"name":"lavender honey","category":"sweetener","taste":"sweet","cuisines":["French","Moroccan"],"isJunk":False,"junkReason":""},
  {"name":"lavender oil","category":"fat","taste":"sweet pungent","cuisines":["French","Moroccan"],"isJunk":False,"junkReason":""},
  {"name":"leaf","category":"other","taste":"bitter astringent","cuisines":["Global"],"isJunk":True,"junkReason":"Overly generic — not a single identifiable ingredient"},
  {"name":"leaf basil","category":"herb","taste":"pungent sweet","cuisines":["Italian","French","Thai"],"isJunk":False,"junkReason":""},
  {"name":"leaf lettuce","category":"vegetable","taste":"astringent bitter","cuisines":["American","Global"],"isJunk":False,"junkReason":""},
  {"name":"leaf lettuce leave","category":"vegetable","taste":"astringent bitter","cuisines":["American","Global"],"isJunk":False,"junkReason":""},
  {"name":"leaf linden","category":"herb","taste":"sweet pungent","cuisines":["French","German","Eastern European"],"isJunk":False,"junkReason":""},
  {"name":"leaf oregano","category":"herb","taste":"pungent bitter","cuisines":["Italian","Greek","Turkish","Mexican"],"isJunk":False,"junkReason":""},
  {"name":"leaf spinach","category":"vegetable","taste":"bitter astringent","cuisines":["Global"],"isJunk":False,"junkReason":""},
  {"name":"leaf thyme","category":"herb","taste":"pungent bitter","cuisines":["French","Italian","Cajun/Creole","British"],"isJunk":False,"junkReason":""},
  {"name":"leafy green","category":"vegetable","taste":"bitter astringent","cuisines":["Global"],"isJunk":True,"junkReason":"Overly generic — not a single identifiable ingredient"},
  {"name":"lean bacon","category":"protein","taste":"salty umami","cuisines":["American","British","Southern US"],"isJunk":False,"junkReason":""},
  {"name":"lean beef","category":"protein","taste":"umami","cuisines":["American","Argentine","German"],"isJunk":False,"junkReason":""},
  {"name":"lean beef chuck","category":"protein","taste":"umami","cuisines":["American","Argentine"],"isJunk":False,"junkReason":""},
  {"name":"lean beef stew meat","category":"protein","taste":"umami","cuisines":["American","Argentine","French"],"isJunk":False,"junkReason":""},
  {"name":"lean chicken","category":"protein","taste":"umami","cuisines":["Global"],"isJunk":False,"junkReason":""},
  {"name":"lean grnd beef","category":"protein","taste":"umami","cuisines":["American","Argentine","German"],"isJunk":False,"junkReason":""},
  {"name":"lean hamburger","category":"protein","taste":"umami","cuisines":["American"],"isJunk":False,"junkReason":""},
  {"name":"lean lamb","category":"protein","taste":"umami","cuisines":["Australian","Greek","Turkish","Moroccan","Indian"],"isJunk":False,"junkReason":""},
  {"name":"lean pork","category":"protein","taste":"umami","cuisines":["Chinese","German","Filipino","Vietnamese"],"isJunk":False,"junkReason":""},
  {"name":"lean pork chop","category":"protein","taste":"umami","cuisines":["American","German","Chinese"],"isJunk":False,"junkReason":""},
  {"name":"lean pork loin","category":"protein","taste":"umami","cuisines":["American","German","Chinese"],"isJunk":False,"junkReason":""},
  {"name":"lean sausage","category":"protein","taste":"salty umami","cuisines":["American","German"],"isJunk":False,"junkReason":""},
  {"name":"lean steak","category":"protein","taste":"umami","cuisines":["American","Argentine"],"isJunk":False,"junkReason":""},
  {"name":"lean stew beef","category":"protein","taste":"umami","cuisines":["American","Argentine","French"],"isJunk":False,"junkReason":""},
  {"name":"lean stewing beef","category":"protein","taste":"umami","cuisines":["American","Argentine","British"],"isJunk":False,"junkReason":""},
  {"name":"lean turkey","category":"protein","taste":"umami","cuisines":["American","Southern US"],"isJunk":False,"junkReason":""},
  {"name":"leaves lettuce","category":"vegetable","taste":"astringent bitter","cuisines":["American","Global"],"isJunk":False,"junkReason":""},
  {"name":"leek","category":"aromatic","taste":"pungent sweet","cuisines":["French","British","Scandinavian"],"isJunk":False,"junkReason":""},
  {"name":"leek soup mix","category":"condiment","taste":"pungent umami","cuisines":["British","French"],"isJunk":False,"junkReason":""},
  {"name":"leftover mashed potatoe","category":"vegetable","taste":"sweet","cuisines":["American","British"],"isJunk":True,"junkReason":"Prepared dish leftover form, not a distinct ingredient"},
  {"name":"leftover turkey","category":"protein","taste":"umami","cuisines":["American","Southern US"],"isJunk":True,"junkReason":"Prepared dish leftover form, not a distinct ingredient"},
  {"name":"lemon","category":"citrus","taste":"sour","cuisines":["Global"],"isJunk":False,"junkReason":""},
  {"name":"lemon balm","category":"herb","taste":"sour sweet","cuisines":["French","German","Moroccan"],"isJunk":False,"junkReason":""},
  {"name":"lemon basil","category":"herb","taste":"pungent sour","cuisines":["Italian","Thai"],"isJunk":False,"junkReason":""},
  {"name":"lemon butter","category":"fat","taste":"sour sweet","cuisines":["French","Australian","British"],"isJunk":False,"junkReason":""},
  {"name":"lemon cake","category":"baked","taste":"sweet sour","cuisines":["British","American"],"isJunk":False,"junkReason":""},
  {"name":"lemon cake mix","category":"baked","taste":"sweet sour","cuisines":["American"],"isJunk":False,"junkReason":""},
  {"name":"lemon concentrate","category":"citrus","taste":"sour","cuisines":["Global"],"isJunk":False,"junkReason":""},
  {"name":"lemon curd","category":"condiment","taste":"sour sweet","cuisines":["British","Australian"],"isJunk":False,"junkReason":""},
  {"name":"lemon dressing","category":"condiment","taste":"sour","cuisines":["Greek","Italian","Mediterranean"],"isJunk":False,"junkReason":""},
  {"name":"lemon extract","category":"spice","taste":"sour","cuisines":["Global"],"isJunk":False,"junkReason":""},
  {"name":"lemon filling","category":"condiment","taste":"sour sweet","cuisines":["American","British"],"isJunk":False,"junkReason":""},
  {"name":"lemon flavor","category":"spice","taste":"sour","cuisines":["Global"],"isJunk":False,"junkReason":""},
  {"name":"lemon flavored gelatin","category":"confection","taste":"sweet sour","cuisines":["American"],"isJunk":False,"junkReason":""},
  {"name":"lemon flavoring","category":"spice","taste":"sour","cuisines":["Global"],"isJunk":False,"junkReason":""},
  {"name":"lemon frosting","category":"confection","taste":"sweet sour","cuisines":["American","British"],"isJunk":False,"junkReason":""},
  {"name":"lemon gelatin","category":"confection","taste":"sweet sour","cuisines":["American"],"isJunk":False,"junkReason":""},
  {"name":"lemon glaze","category":"condiment","taste":"sweet sour","cuisines":["American","British"],"isJunk":False,"junkReason":""},
  {"name":"lemon instant pudding","category":"confection","taste":"sweet sour","cuisines":["American"],"isJunk":False,"junkReason":""},
  {"name":"lemon instant pudding mix","category":"confection","taste":"sweet sour","cuisines":["American"],"isJunk":False,"junkReason":""},
  {"name":"lemon jello","category":"confection","taste":"sweet sour","cuisines":["American"],"isJunk":True,"junkReason":"Branded product (Jell-O is a registered trademark of Kraft Heinz)"},
  {"name":"lemon juice","category":"citrus","taste":"sour","cuisines":["Global"],"isJunk":False,"junkReason":""},
  {"name":"lemon juice concentrate","category":"citrus","taste":"sour","cuisines":["Global"],"isJunk":False,"junkReason":""},
  {"name":"lemon juice freshly squeezed","category":"citrus","taste":"sour","cuisines":["Global"],"isJunk":False,"junkReason":""},
  {"name":"lemon juice from","category":"citrus","taste":"sour","cuisines":["Global"],"isJunk":True,"junkReason":"Parse artifact — incomplete ingredient name"},
  {"name":"lemon juice from concentrate","category":"citrus","taste":"sour","cuisines":["Global"],"isJunk":False,"junkReason":""},
  {"name":"lemon juice of","category":"citrus","taste":"sour","cuisines":["Global"],"isJunk":True,"junkReason":"Parse artifact — incomplete ingredient name"},
  {"name":"lemon juice only","category":"citrus","taste":"sour","cuisines":["Global"],"isJunk":True,"junkReason":"Parse artifact — qualifier phrase, not a distinct ingredient"},
  {"name":"lemon juice salt","category":"acid","taste":"sour salty","cuisines":["Global"],"isJunk":False,"junkReason":""},
  {"name":"lemon juiced","category":"citrus","taste":"sour","cuisines":["Global"],"isJunk":False,"junkReason":""},
  {"name":"lemon oil","category":"fat","taste":"sour","cuisines":["Italian","French","Global"],"isJunk":False,"junkReason":""},
  {"name":"lemon pepper","category":"seasoning","taste":"sour spicy","cuisines":["American","Global"],"isJunk":False,"junkReason":""},
  {"name":"lemon pie filling","category":"condiment","taste":"sour sweet","cuisines":["American","British"],"isJunk":False,"junkReason":""},
  {"name":"lemon pudding","category":"confection","taste":"sweet sour","cuisines":["American","British"],"isJunk":False,"junkReason":""},
  {"name":"lemon pudding mix","category":"confection","taste":"sweet sour","cuisines":["American","British"],"isJunk":False,"junkReason":""},
  {"name":"lemon rind","category":"citrus","taste":"sour bitter","cuisines":["Global"],"isJunk":False,"junkReason":""},
  {"name":"lemon rind strip","category":"citrus","taste":"sour bitter","cuisines":["Global"],"isJunk":False,"junkReason":""},
  {"name":"lemon sauce","category":"condiment","taste":"sour sweet","cuisines":["Chinese","Greek","Italian"],"isJunk":False,"junkReason":""},
  {"name":"lemon sherbet","category":"confection","taste":"sour sweet","cuisines":["American","British"],"isJunk":False,"junkReason":""},
  {"name":"lemon soda","category":"mixer","taste":"sweet sour","cuisines":["American","Italian"],"isJunk":False,"junkReason":""},
  {"name":"lemon sorbet","category":"confection","taste":"sour sweet","cuisines":["Italian","French"],"isJunk":False,"junkReason":""},
  {"name":"lemon supreme cake mix","category":"baked","taste":"sweet sour","cuisines":["American"],"isJunk":False,"junkReason":""},
  {"name":"lemon syrup","category":"sweetener","taste":"sweet sour","cuisines":["Global"],"isJunk":False,"junkReason":""},
  {"name":"lemon thyme","category":"herb","taste":"pungent sour","cuisines":["French","Italian","British"],"isJunk":False,"junkReason":""},
  {"name":"lemon twist","category":"citrus","taste":"sour bitter","cuisines":["Global"],"isJunk":False,"junkReason":""},
  {"name":"lemon verbena","category":"herb","taste":"sour sweet","cuisines":["French","Moroccan","Argentine"],"isJunk":False,"junkReason":""},
  {"name":"lemon verbena leave","category":"herb","taste":"sour sweet","cuisines":["French","Moroccan","Argentine"],"isJunk":False,"junkReason":""},
  {"name":"lemon vinaigrette","category":"condiment","taste":"sour","cuisines":["French","Greek","Italian"],"isJunk":False,"junkReason":""},
  {"name":"lemon wedge","category":"citrus","taste":"sour","cuisines":["Global"],"isJunk":False,"junkReason":""},
  {"name":"lemon wheel","category":"citrus","taste":"sour","cuisines":["Global"],"isJunk":False,"junkReason":""},
  {"name":"lemon yogurt","category":"dairy","taste":"sour sweet","cuisines":["Greek","Turkish","American"],"isJunk":False,"junkReason":""},
  {"name":"lemon zest freshly","category":"citrus","taste":"sour bitter","cuisines":["Global"],"isJunk":False,"junkReason":""},
  {"name":"lemon zested","category":"citrus","taste":"sour bitter","cuisines":["Global"],"isJunk":False,"junkReason":""},
  {"name":"lemon-lime","category":"citrus","taste":"sour","cuisines":["Global"],"isJunk":False,"junkReason":""},
  {"name":"lemon-lime beverage","category":"mixer","taste":"sweet sour","cuisines":["American","Global"],"isJunk":False,"junkReason":""},
  {"name":"lemon-lime soda","category":"mixer","taste":"sweet sour","cuisines":["American","Global"],"isJunk":False,"junkReason":""},
  {"name":"lemon-lime soft drink","category":"mixer","taste":"sweet sour","cuisines":["American","Global"],"isJunk":False,"junkReason":""},
  {"name":"lemon-pepper seasoning","category":"seasoning","taste":"sour spicy","cuisines":["American","Global"],"isJunk":False,"junkReason":""},
  {"name":"lemonade","category":"liquid","taste":"sweet sour","cuisines":["American","Global"],"isJunk":False,"junkReason":""},
  {"name":"lemongrass","category":"aromatic","taste":"sour pungent","cuisines":["Thai","Vietnamese","Indonesian","Malaysian"],"isJunk":False,"junkReason":""},
  {"name":"lemons juice","category":"citrus","taste":"sour","cuisines":["Global"],"isJunk":False,"junkReason":""},
  {"name":"lentil","category":"protein","taste":"umami","cuisines":["Indian","Ethiopian","Turkish","Lebanese","French"],"isJunk":False,"junkReason":""},
  {"name":"lesueur pea","category":"vegetable","taste":"sweet","cuisines":["American"],"isJunk":True,"junkReason":"Branded product (Le Sueur is a registered trademark of B&G Foods/Green Giant)"},
  {"name":"lettuce","category":"vegetable","taste":"astringent bitter","cuisines":["Global"],"isJunk":False,"junkReason":""},
  {"name":"lettuce leaf","category":"vegetable","taste":"astringent bitter","cuisines":["Global"],"isJunk":False,"junkReason":""},
]

inp = json.load(open('.ralph/audit_batches/batch_20.json', encoding='utf-8'))
assert len(data) == len(inp), f'LENGTH MISMATCH {len(data)} vs {len(inp)}'
for i,(d,r) in enumerate(zip(data,inp)):
    if d['name'] != r['name']:
        print(f'NAME MISMATCH at {i}: got {repr(d["name"])} expected {repr(r["name"])}')
        d['name'] = r['name']

with open('.ralph/audit_batches/batch_20.out.json','w',encoding='utf-8') as f:
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
