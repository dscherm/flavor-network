import json

data = [
  {"name":"homogenized milk","category":"dairy","taste":"sweet","cuisines":["Global"],"isJunk":False,"junkReason":""},
  {"name":"honey","category":"sweetener","taste":"sweet","cuisines":["Global"],"isJunk":False,"junkReason":""},
  {"name":"honey crisp apple","category":"fruit","taste":"sweet sour","cuisines":["American"],"isJunk":False,"junkReason":""},
  {"name":"honey ham","category":"protein","taste":"salty umami","cuisines":["Spanish","German","American","Southern US"],"isJunk":False,"junkReason":""},
  {"name":"honey maid","category":"baked","taste":"sweet","cuisines":["American"],"isJunk":True,"junkReason":"Branded product (Honey Maid is a registered trademark of Mondelez/Nabisco)"},
  {"name":"honey mustard","category":"condiment","taste":"sweet pungent","cuisines":["American","German"],"isJunk":False,"junkReason":""},
  {"name":"honey nut","category":"confection","taste":"sweet","cuisines":["Turkish","Lebanese","Greek"],"isJunk":False,"junkReason":""},
  {"name":"honey syrup","category":"sweetener","taste":"sweet","cuisines":["Global"],"isJunk":False,"junkReason":""},
  {"name":"honeydew","category":"fruit","taste":"sweet","cuisines":["Global"],"isJunk":False,"junkReason":""},
  {"name":"honeydew melon","category":"fruit","taste":"sweet","cuisines":["Global"],"isJunk":False,"junkReason":""},
  {"name":"hops","category":"other","taste":"bitter","cuisines":["German","British","Belgian"],"isJunk":False,"junkReason":""},
  {"name":"hops oil","category":"fat","taste":"bitter","cuisines":["German","British"],"isJunk":False,"junkReason":""},
  {"name":"hormel chili","category":"condiment","taste":"spicy umami","cuisines":["American"],"isJunk":True,"junkReason":"Branded prepared product (Hormel is a registered trademark); canned chili is a prepared dish"},
  {"name":"hormel chili with bean","category":"condiment","taste":"spicy umami","cuisines":["American"],"isJunk":True,"junkReason":"Branded prepared product (Hormel registered trademark); prepared dish not a single ingredient"},
  {"name":"hormel chili without bean","category":"condiment","taste":"spicy umami","cuisines":["American"],"isJunk":True,"junkReason":"Branded prepared product (Hormel registered trademark); prepared dish not a single ingredient"},
  {"name":"hormel real bacon bit","category":"protein","taste":"salty umami","cuisines":["American"],"isJunk":True,"junkReason":"Branded product (Hormel Real Bacon Bits is a registered trademark of Hormel Foods)"},
  {"name":"horseradish","category":"condiment","taste":"spicy pungent","cuisines":["Russian","Polish","German","British"],"isJunk":False,"junkReason":""},
  {"name":"horseradish cream","category":"condiment","taste":"spicy pungent","cuisines":["British","German","Russian","Polish"],"isJunk":False,"junkReason":""},
  {"name":"horseradish mustard","category":"condiment","taste":"spicy pungent","cuisines":["German","American","Russian"],"isJunk":False,"junkReason":""},
  {"name":"horseradish root","category":"aromatic","taste":"spicy pungent","cuisines":["Russian","Polish","German","British"],"isJunk":False,"junkReason":""},
  {"name":"horseradish sauce","category":"condiment","taste":"spicy pungent","cuisines":["British","Russian","Polish","German"],"isJunk":False,"junkReason":""},
  {"name":"hot sauce","category":"condiment","taste":"spicy sour","cuisines":["American","Caribbean","Mexican"],"isJunk":False,"junkReason":""},
  {"name":"hotsauce","category":"condiment","taste":"spicy sour","cuisines":["American","Caribbean","Mexican"],"isJunk":False,"junkReason":""},
  {"name":"huitlacoche","category":"umami","taste":"umami","cuisines":["Mexican"],"isJunk":False,"junkReason":""},
  {"name":"hyacinth","category":"other","taste":"pungent","cuisines":["Persian","Moroccan"],"isJunk":False,"junkReason":""},
  {"name":"hyssop oil","category":"fat","taste":"bitter pungent","cuisines":["French","Moroccan"],"isJunk":False,"junkReason":""},
  {"name":"ice cream","category":"dairy","taste":"sweet","cuisines":["Global"],"isJunk":False,"junkReason":""},
  {"name":"iceberg lettuce","category":"vegetable","taste":"astringent","cuisines":["American"],"isJunk":False,"junkReason":""},
  {"name":"iceburg lettuce","category":"vegetable","taste":"astringent","cuisines":["American"],"isJunk":False,"junkReason":""},
  {"name":"iced tea","category":"liquid","taste":"bitter astringent","cuisines":["American","Southern US"],"isJunk":False,"junkReason":""},
  {"name":"icing","category":"confection","taste":"sweet","cuisines":["American","British"],"isJunk":False,"junkReason":""},
  {"name":"idaho potatoe","category":"vegetable","taste":"sweet","cuisines":["American"],"isJunk":False,"junkReason":""},
  {"name":"imitation crab","category":"protein","taste":"salty umami","cuisines":["Japanese","American"],"isJunk":False,"junkReason":""},
  {"name":"imitation crabmeat","category":"protein","taste":"salty umami","cuisines":["Japanese","American"],"isJunk":False,"junkReason":""},
  {"name":"instant beef bouillon","category":"umami","taste":"salty umami","cuisines":["Global"],"isJunk":False,"junkReason":""},
  {"name":"instant beef bouillon granule","category":"umami","taste":"salty umami","cuisines":["Global"],"isJunk":False,"junkReason":""},
  {"name":"instant brown rice","category":"grain","taste":"sweet","cuisines":["Chinese","Japanese","Korean","Thai","Indian"],"isJunk":False,"junkReason":""},
  {"name":"instant butterscotch pudding","category":"confection","taste":"sweet","cuisines":["American","British"],"isJunk":False,"junkReason":""},
  {"name":"instant chicken","category":"umami","taste":"salty umami","cuisines":["Global"],"isJunk":False,"junkReason":""},
  {"name":"instant chicken bouillon","category":"umami","taste":"salty umami","cuisines":["Global"],"isJunk":False,"junkReason":""},
  {"name":"instant chocolate","category":"sweetener","taste":"sweet bitter","cuisines":["American"],"isJunk":False,"junkReason":""},
  {"name":"instant chocolate pudding","category":"confection","taste":"sweet bitter","cuisines":["American"],"isJunk":False,"junkReason":""},
  {"name":"instant chocolate pudding mix","category":"confection","taste":"sweet bitter","cuisines":["American"],"isJunk":False,"junkReason":""},
  {"name":"instant cocoa","category":"sweetener","taste":"sweet bitter","cuisines":["American","Mexican"],"isJunk":False,"junkReason":""},
  {"name":"instant coconut cream pudding","category":"confection","taste":"sweet","cuisines":["American","Thai","Filipino"],"isJunk":False,"junkReason":""},
  {"name":"instant coconut pudding","category":"confection","taste":"sweet","cuisines":["American","Filipino","Caribbean"],"isJunk":False,"junkReason":""},
  {"name":"instant dry milk","category":"dairy","taste":"sweet","cuisines":["Global"],"isJunk":False,"junkReason":""},
  {"name":"instant lemon pudding","category":"confection","taste":"sweet sour","cuisines":["American","British"],"isJunk":False,"junkReason":""},
  {"name":"instant lemonade","category":"liquid","taste":"sweet sour","cuisines":["American"],"isJunk":False,"junkReason":""},
  {"name":"instant mashed potato","category":"vegetable","taste":"sweet","cuisines":["American","British"],"isJunk":False,"junkReason":""},
  {"name":"instant mashed potatoe","category":"vegetable","taste":"sweet","cuisines":["American","British"],"isJunk":False,"junkReason":""},
  {"name":"instant onion","category":"aromatic","taste":"pungent","cuisines":["Global"],"isJunk":False,"junkReason":""},
  {"name":"instant pistachio pudding","category":"confection","taste":"sweet","cuisines":["American"],"isJunk":False,"junkReason":""},
  {"name":"instant pistachio pudding mix","category":"confection","taste":"sweet","cuisines":["American"],"isJunk":False,"junkReason":""},
  {"name":"instant polenta","category":"grain","taste":"sweet","cuisines":["Italian"],"isJunk":False,"junkReason":""},
  {"name":"instant rice","category":"grain","taste":"sweet","cuisines":["Chinese","Japanese","Korean","Thai","Indian"],"isJunk":False,"junkReason":""},
  {"name":"instant sugar","category":"sweetener","taste":"sweet","cuisines":["Global"],"isJunk":False,"junkReason":""},
  {"name":"instant vanilla","category":"sweetener","taste":"sweet","cuisines":["Global"],"isJunk":False,"junkReason":""},
  {"name":"instant vanilla pudding","category":"confection","taste":"sweet","cuisines":["American"],"isJunk":False,"junkReason":""},
  {"name":"instant vanilla pudding mix","category":"confection","taste":"sweet","cuisines":["American"],"isJunk":False,"junkReason":""},
  {"name":"instant white rice","category":"grain","taste":"sweet","cuisines":["Chinese","Japanese","Korean","Thai","Indian"],"isJunk":False,"junkReason":""},
  {"name":"instant yeast","category":"thickener","taste":"bitter","cuisines":["Global"],"isJunk":False,"junkReason":""},
  {"name":"irish cream","category":"liqueur","taste":"sweet","cuisines":["British"],"isJunk":False,"junkReason":""},
  {"name":"irish cream liqueur","category":"liqueur","taste":"sweet","cuisines":["British"],"isJunk":False,"junkReason":""},
  {"name":"irish moss","category":"thickener","taste":"astringent","cuisines":["Caribbean","British"],"isJunk":False,"junkReason":""},
  {"name":"irish potatoe","category":"vegetable","taste":"sweet","cuisines":["American","British"],"isJunk":False,"junkReason":""},
  {"name":"italian bread","category":"baked","taste":"sweet","cuisines":["Italian"],"isJunk":False,"junkReason":""},
  {"name":"italian bread crumb","category":"baked","taste":"sweet","cuisines":["Italian"],"isJunk":False,"junkReason":""},
  {"name":"italian cheese","category":"dairy","taste":"umami salty","cuisines":["Italian"],"isJunk":False,"junkReason":""},
  {"name":"italian cheese blend","category":"dairy","taste":"umami salty","cuisines":["Italian"],"isJunk":False,"junkReason":""},
  {"name":"italian chicken sausage","category":"protein","taste":"salty umami","cuisines":["Italian","American"],"isJunk":False,"junkReason":""},
  {"name":"italian dressing","category":"condiment","taste":"sour pungent","cuisines":["Italian","American"],"isJunk":False,"junkReason":""},
  {"name":"italian eggplant","category":"vegetable","taste":"bitter astringent","cuisines":["Italian","Turkish","Greek","Lebanese"],"isJunk":False,"junkReason":""},
  {"name":"italian flavored bread crumb","category":"baked","taste":"sweet","cuisines":["Italian"],"isJunk":False,"junkReason":""},
  {"name":"italian frying pepper","category":"vegetable","taste":"sweet bitter","cuisines":["Italian"],"isJunk":False,"junkReason":""},
  {"name":"italian green bean","category":"vegetable","taste":"astringent sweet","cuisines":["Italian"],"isJunk":False,"junkReason":""},
  {"name":"italian parsley leave","category":"herb","taste":"bitter pungent","cuisines":["Italian","French","Lebanese","Turkish"],"isJunk":False,"junkReason":""},
  {"name":"italian pepper","category":"vegetable","taste":"sweet bitter","cuisines":["Italian"],"isJunk":False,"junkReason":""},
  {"name":"italian plum","category":"fruit","taste":"sweet sour","cuisines":["Italian","French"],"isJunk":False,"junkReason":""},
  {"name":"italian plum tomatoe","category":"vegetable","taste":"sweet sour umami","cuisines":["Italian"],"isJunk":False,"junkReason":""},
  {"name":"italian pork sausage","category":"protein","taste":"salty umami","cuisines":["Italian"],"isJunk":False,"junkReason":""},
  {"name":"italian roma tomatoe","category":"vegetable","taste":"sweet sour umami","cuisines":["Italian"],"isJunk":False,"junkReason":""},
  {"name":"italian salad dressing","category":"condiment","taste":"sour pungent","cuisines":["Italian","American"],"isJunk":False,"junkReason":""},
  {"name":"italian salad dressing mix","category":"condiment","taste":"sour pungent","cuisines":["Italian","American"],"isJunk":False,"junkReason":""},
  {"name":"italian sauce","category":"condiment","taste":"sweet sour umami","cuisines":["Italian"],"isJunk":False,"junkReason":""},
  {"name":"italian sausage","category":"protein","taste":"salty umami","cuisines":["Italian"],"isJunk":False,"junkReason":""},
  {"name":"italian sausage link","category":"protein","taste":"salty umami","cuisines":["Italian"],"isJunk":False,"junkReason":""},
  {"name":"italian seasoned bread crumb","category":"baked","taste":"sweet","cuisines":["Italian"],"isJunk":False,"junkReason":""},
  {"name":"italian seasoning","category":"seasoning","taste":"pungent bitter","cuisines":["Italian","American"],"isJunk":False,"junkReason":""},
  {"name":"italian stewed tomatoe","category":"vegetable","taste":"sweet sour umami","cuisines":["Italian"],"isJunk":False,"junkReason":""},
  {"name":"italian sweet sausage","category":"protein","taste":"salty umami","cuisines":["Italian"],"isJunk":False,"junkReason":""},
  {"name":"italian tomato","category":"vegetable","taste":"sweet sour umami","cuisines":["Italian"],"isJunk":False,"junkReason":""},
  {"name":"italian tomatoe","category":"vegetable","taste":"sweet sour umami","cuisines":["Italian"],"isJunk":False,"junkReason":""},
  {"name":"italian turkey sausage","category":"protein","taste":"salty umami","cuisines":["Italian","American"],"isJunk":False,"junkReason":""},
  {"name":"italian zesty","category":"condiment","taste":"sour pungent","cuisines":["Italian","American"],"isJunk":True,"junkReason":"Vague marketing descriptor, not a specific ingredient"},
  {"name":"italian-style salad dressing","category":"condiment","taste":"sour pungent","cuisines":["Italian","American"],"isJunk":False,"junkReason":""},
  {"name":"italian-style stewed tomatoe","category":"vegetable","taste":"sweet sour umami","cuisines":["Italian"],"isJunk":False,"junkReason":""},
  {"name":"italian-style tomatoe","category":"vegetable","taste":"sweet sour umami","cuisines":["Italian"],"isJunk":False,"junkReason":""},
  {"name":"jack cheese","category":"dairy","taste":"umami sweet","cuisines":["American","Tex-Mex","Mexican"],"isJunk":False,"junkReason":""},
  {"name":"jackfruit","category":"fruit","taste":"sweet","cuisines":["Filipino","Indian","Thai","Malaysian"],"isJunk":False,"junkReason":""},
]

inp = json.load(open('.ralph/audit_batches/batch_18.json', encoding='utf-8'))
assert len(data) == len(inp), f'LENGTH MISMATCH {len(data)} vs {len(inp)}'
for i,(d,r) in enumerate(zip(data,inp)):
    if d['name'] != r['name']:
        print(f'NAME MISMATCH at {i}: got {repr(d["name"])} expected {repr(r["name"])}')
        d['name'] = r['name']

with open('.ralph/audit_batches/batch_18.out.json','w',encoding='utf-8') as f:
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
