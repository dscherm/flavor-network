import json

data = [
  {"name":"mango juice","category":"liquid","taste":"sweet sour","cuisines":["Indian","Thai","Filipino","Caribbean","Mexican"],"isJunk":False,"junkReason":""},
  {"name":"mango powder","category":"spice","taste":"sour","cuisines":["Indian","Pakistani"],"isJunk":False,"junkReason":""},
  {"name":"mango puree","category":"fruit","taste":"sweet sour","cuisines":["Indian","Thai","Filipino","Caribbean","Mexican"],"isJunk":False,"junkReason":""},
  {"name":"mango salsa","category":"condiment","taste":"sweet sour spicy","cuisines":["Mexican","Caribbean","Tex-Mex"],"isJunk":False,"junkReason":""},
  {"name":"mangoe","category":"fruit","taste":"sweet sour","cuisines":["Indian","Thai","Filipino","Caribbean","Mexican"],"isJunk":False,"junkReason":""},
  {"name":"manila clam","category":"protein","taste":"salty umami","cuisines":["Japanese","Italian","Portuguese"],"isJunk":False,"junkReason":""},
  {"name":"manzanilla olive","category":"vegetable","taste":"salty bitter","cuisines":["Spanish","Italian","Greek"],"isJunk":False,"junkReason":""},
  {"name":"maple bacon","category":"protein","taste":"salty umami sweet","cuisines":["American","Canadian","Southern US"],"isJunk":False,"junkReason":""},
  {"name":"maple sugar","category":"sweetener","taste":"sweet","cuisines":["American","Canadian"],"isJunk":False,"junkReason":""},
  {"name":"maple syrup","category":"sweetener","taste":"sweet","cuisines":["American","Canadian"],"isJunk":False,"junkReason":""},
  {"name":"maraschino cherry","category":"fruit","taste":"sweet","cuisines":["American","Italian"],"isJunk":False,"junkReason":""},
  {"name":"maraschino cherry halve","category":"fruit","taste":"sweet","cuisines":["American","Italian"],"isJunk":False,"junkReason":""},
  {"name":"maraschino cherry juice","category":"liquid","taste":"sweet","cuisines":["American"],"isJunk":False,"junkReason":""},
  {"name":"maraschino liqueur","category":"liqueur","taste":"sweet bitter","cuisines":["Italian","French"],"isJunk":False,"junkReason":""},
  {"name":"marcona almond","category":"nut","taste":"sweet bitter","cuisines":["Spanish","Moroccan"],"isJunk":False,"junkReason":""},
  {"name":"margarine","category":"fat","taste":"sweet","cuisines":["Global"],"isJunk":False,"junkReason":""},
  {"name":"margarine like spread","category":"fat","taste":"sweet","cuisines":["Global"],"isJunk":False,"junkReason":""},
  {"name":"marinara sauce","category":"condiment","taste":"sweet sour umami","cuisines":["Italian","American"],"isJunk":False,"junkReason":""},
  {"name":"marjoram","category":"herb","taste":"pungent bitter","cuisines":["Italian","Greek","Turkish","German"],"isJunk":False,"junkReason":""},
  {"name":"marsala wine","category":"liquid","taste":"sweet sour bitter","cuisines":["Italian"],"isJunk":False,"junkReason":""},
  {"name":"marshmallow","category":"confection","taste":"sweet","cuisines":["American"],"isJunk":False,"junkReason":""},
  {"name":"marshmallow cream","category":"confection","taste":"sweet","cuisines":["American"],"isJunk":False,"junkReason":""},
  {"name":"marshmallow whip","category":"confection","taste":"sweet","cuisines":["American"],"isJunk":False,"junkReason":""},
  {"name":"masa harina","category":"grain","taste":"sweet","cuisines":["Mexican","Tex-Mex"],"isJunk":False,"junkReason":""},
  {"name":"mascarpone","category":"dairy","taste":"sweet","cuisines":["Italian"],"isJunk":False,"junkReason":""},
  {"name":"mascarpone cheese","category":"dairy","taste":"sweet","cuisines":["Italian"],"isJunk":False,"junkReason":""},
  {"name":"mashed banana","category":"fruit","taste":"sweet","cuisines":["Caribbean","Filipino","Pacific Islander"],"isJunk":False,"junkReason":""},
  {"name":"mashed cooked sweet potatoe","category":"vegetable","taste":"sweet","cuisines":["American","Southern US"],"isJunk":False,"junkReason":""},
  {"name":"mashed overripe banana","category":"fruit","taste":"sweet","cuisines":["Caribbean","Filipino","Pacific Islander"],"isJunk":False,"junkReason":""},
  {"name":"mashed potatoe","category":"vegetable","taste":"sweet","cuisines":["American","British","French"],"isJunk":False,"junkReason":""},
  {"name":"mashed ripe banana","category":"fruit","taste":"sweet","cuisines":["Caribbean","Filipino","Pacific Islander"],"isJunk":False,"junkReason":""},
  {"name":"mashed sweet potato","category":"vegetable","taste":"sweet","cuisines":["American","Southern US"],"isJunk":False,"junkReason":""},
  {"name":"mashed sweet potatoe","category":"vegetable","taste":"sweet","cuisines":["American","Southern US"],"isJunk":False,"junkReason":""},
  {"name":"mastic","category":"spice","taste":"bitter pungent","cuisines":["Greek","Turkish","Lebanese"],"isJunk":False,"junkReason":""},
  {"name":"mastic gum","category":"spice","taste":"bitter pungent","cuisines":["Greek","Turkish","Lebanese"],"isJunk":False,"junkReason":""},
  {"name":"matcha","category":"other","taste":"bitter astringent","cuisines":["Japanese","Korean"],"isJunk":False,"junkReason":""},
  {"name":"matcha green tea powder","category":"other","taste":"bitter astringent","cuisines":["Japanese","Korean"],"isJunk":False,"junkReason":""},
  {"name":"matcha powder","category":"other","taste":"bitter astringent","cuisines":["Japanese","Korean"],"isJunk":False,"junkReason":""},
  {"name":"matchstick carrot","category":"vegetable","taste":"sweet","cuisines":["French","Vietnamese","Chinese","Korean"],"isJunk":False,"junkReason":""},
  {"name":"mate","category":"liquid","taste":"bitter astringent","cuisines":["Argentine","Brazilian","Uruguayan"],"isJunk":False,"junkReason":""},
  {"name":"matzo cake meal","category":"baked","taste":"sweet","cuisines":["Israeli","American"],"isJunk":False,"junkReason":""},
  {"name":"maui onion","category":"aromatic","taste":"sweet pungent","cuisines":["American","Pacific Islander"],"isJunk":False,"junkReason":""},
  {"name":"mayo","category":"condiment","taste":"sour sweet","cuisines":["American","Global"],"isJunk":False,"junkReason":""},
  {"name":"mayonnaise","category":"condiment","taste":"sour sweet","cuisines":["American","French","Global"],"isJunk":False,"junkReason":""},
  {"name":"mcbutter","category":"condiment","taste":"sweet","cuisines":["American"],"isJunk":True,"junkReason":"Branded product (McButter is a registered trademark of Alberto-Culver)"},
  {"name":"meal flour","category":"grain","taste":"sweet","cuisines":["Global"],"isJunk":False,"junkReason":""},
  {"name":"meat","category":"protein","taste":"umami","cuisines":["Global"],"isJunk":True,"junkReason":"Overly generic — not a single identifiable ingredient"},
  {"name":"meat broth","category":"liquid","taste":"umami salty","cuisines":["French","Global"],"isJunk":False,"junkReason":""},
  {"name":"meat sauce","category":"condiment","taste":"umami salty","cuisines":["Italian","American"],"isJunk":False,"junkReason":""},
  {"name":"meatball","category":"protein","taste":"umami salty","cuisines":["Italian","Swedish","American"],"isJunk":True,"junkReason":"Prepared dish/compound food, not a single raw ingredient"},
  {"name":"meatloaf","category":"protein","taste":"umami salty","cuisines":["American","German"],"isJunk":True,"junkReason":"Prepared dish, not a single raw ingredient"},
  {"name":"medjool date","category":"fruit","taste":"sweet","cuisines":["Moroccan","Persian","Lebanese","Israeli"],"isJunk":False,"junkReason":""},
  {"name":"medlar","category":"fruit","taste":"sweet sour astringent","cuisines":["British","Iranian","Turkish"],"isJunk":False,"junkReason":""},
  {"name":"mein noodle","category":"grain","taste":"sweet","cuisines":["Chinese","Korean","Vietnamese"],"isJunk":False,"junkReason":""},
  {"name":"melon","category":"fruit","taste":"sweet","cuisines":["Global"],"isJunk":False,"junkReason":""},
  {"name":"melon liqueur","category":"liqueur","taste":"sweet","cuisines":["Japanese","French"],"isJunk":False,"junkReason":""},
  {"name":"melting cheese","category":"dairy","taste":"umami salty","cuisines":["French","Italian","American"],"isJunk":False,"junkReason":""},
  {"name":"mentha oil","category":"fat","taste":"sweet pungent","cuisines":["Moroccan","Indian"],"isJunk":False,"junkReason":""},
  {"name":"meringue powder","category":"other","taste":"sweet","cuisines":["French","British","American"],"isJunk":False,"junkReason":""},
  {"name":"mexican cheese","category":"dairy","taste":"umami salty","cuisines":["Mexican","Tex-Mex"],"isJunk":False,"junkReason":""},
  {"name":"mexican groundcherry","category":"fruit","taste":"sweet sour","cuisines":["Mexican","Peruvian"],"isJunk":False,"junkReason":""},
  {"name":"mexico chile","category":"chili","taste":"spicy pungent","cuisines":["Mexican"],"isJunk":False,"junkReason":""},
  {"name":"mexicorn","category":"vegetable","taste":"sweet spicy","cuisines":["American","Tex-Mex"],"isJunk":True,"junkReason":"Branded product (Mexicorn is a registered product of Green Giant/B&G Foods)"},
  {"name":"mezcal","category":"spirit","taste":"bitter spicy","cuisines":["Mexican"],"isJunk":False,"junkReason":""},
  {"name":"mild cheese","category":"dairy","taste":"umami sweet","cuisines":["British","American"],"isJunk":False,"junkReason":""},
  {"name":"milk","category":"dairy","taste":"sweet","cuisines":["Global"],"isJunk":False,"junkReason":""},
  {"name":"milk cheese","category":"dairy","taste":"umami salty","cuisines":["Global"],"isJunk":False,"junkReason":""},
  {"name":"milk chocolate","category":"confection","taste":"sweet bitter","cuisines":["Global"],"isJunk":False,"junkReason":""},
  {"name":"milk chocolate chip","category":"confection","taste":"sweet bitter","cuisines":["American"],"isJunk":False,"junkReason":""},
  {"name":"milk chocolate frosting","category":"confection","taste":"sweet bitter","cuisines":["American"],"isJunk":False,"junkReason":""},
  {"name":"milk chocolate kisse","category":"confection","taste":"sweet bitter","cuisines":["American"],"isJunk":True,"junkReason":"Branded product (Hershey Kisses is a registered trademark of Hershey Company)"},
  {"name":"milk chocolate morsel","category":"confection","taste":"sweet bitter","cuisines":["American"],"isJunk":False,"junkReason":""},
  {"name":"milk fat","category":"fat","taste":"sweet","cuisines":["Global"],"isJunk":False,"junkReason":""},
  {"name":"milk powder","category":"dairy","taste":"sweet","cuisines":["Global"],"isJunk":False,"junkReason":""},
  {"name":"milk ricotta","category":"dairy","taste":"sweet","cuisines":["Italian"],"isJunk":False,"junkReason":""},
  {"name":"milk ricotta cheese","category":"dairy","taste":"sweet","cuisines":["Italian"],"isJunk":False,"junkReason":""},
  {"name":"milk yogurt","category":"dairy","taste":"sour sweet","cuisines":["Indian","Turkish","Greek","Lebanese"],"isJunk":False,"junkReason":""},
  {"name":"milkshake","category":"liquid","taste":"sweet","cuisines":["American"],"isJunk":False,"junkReason":""},
  {"name":"milky","category":"other","taste":"sweet","cuisines":["Global"],"isJunk":True,"junkReason":"Descriptor/adjective, not a specific ingredient"},
  {"name":"millet","category":"grain","taste":"sweet","cuisines":["Indian","West African","Ethiopian","Chinese"],"isJunk":False,"junkReason":""},
  {"name":"millet flour","category":"grain","taste":"sweet","cuisines":["Indian","West African","Ethiopian"],"isJunk":False,"junkReason":""},
  {"name":"milliliters milk","category":"dairy","taste":"sweet","cuisines":["Global"],"isJunk":True,"junkReason":"Measurement unit artifact — not a distinct ingredient"},
  {"name":"miniature marshmallow","category":"confection","taste":"sweet","cuisines":["American"],"isJunk":False,"junkReason":""},
  {"name":"mint","category":"herb","taste":"pungent astringent","cuisines":["Turkish","Lebanese","Moroccan","Vietnamese","Greek","Indian"],"isJunk":False,"junkReason":""},
  {"name":"mint chocolate chip","category":"confection","taste":"sweet bitter pungent","cuisines":["American"],"isJunk":False,"junkReason":""},
  {"name":"mint chocolate chip ice cream","category":"dairy","taste":"sweet bitter pungent","cuisines":["American"],"isJunk":False,"junkReason":""},
  {"name":"mint flake","category":"herb","taste":"pungent astringent","cuisines":["Turkish","Lebanese","Moroccan","Greek"],"isJunk":False,"junkReason":""},
  {"name":"mint jelly","category":"condiment","taste":"sweet pungent","cuisines":["British","American"],"isJunk":False,"junkReason":""},
  {"name":"mint leaf","category":"herb","taste":"pungent astringent","cuisines":["Turkish","Lebanese","Moroccan","Vietnamese","Greek","Indian"],"isJunk":False,"junkReason":""},
  {"name":"mint sauce","category":"condiment","taste":"sour pungent","cuisines":["British","Indian"],"isJunk":False,"junkReason":""},
  {"name":"mint syrup","category":"sweetener","taste":"sweet pungent","cuisines":["American","Moroccan"],"isJunk":False,"junkReason":""},
  {"name":"minute rice","category":"grain","taste":"sweet","cuisines":["American"],"isJunk":True,"junkReason":"Branded product (Minute Rice is a registered trademark of Riviana Foods)"},
  {"name":"mirin","category":"liquid","taste":"sweet","cuisines":["Japanese","Korean"],"isJunk":False,"junkReason":""},
  {"name":"miso","category":"umami","taste":"umami salty","cuisines":["Japanese","Korean"],"isJunk":False,"junkReason":""},
  {"name":"mixed bean","category":"protein","taste":"umami","cuisines":["Mexican","Indian","American"],"isJunk":False,"junkReason":""},
  {"name":"mixed berry","category":"fruit","taste":"sweet sour","cuisines":["Global"],"isJunk":False,"junkReason":""},
  {"name":"mixed cheese","category":"dairy","taste":"umami salty","cuisines":["Italian","French","American"],"isJunk":False,"junkReason":""},
  {"name":"mixed lettuce","category":"vegetable","taste":"astringent bitter","cuisines":["American","Global"],"isJunk":False,"junkReason":""},
  {"name":"mixed mushroom","category":"vegetable","taste":"umami","cuisines":["Chinese","Japanese","Korean","Italian"],"isJunk":False,"junkReason":""},
  {"name":"mixed nut","category":"nut","taste":"sweet bitter","cuisines":["Global"],"isJunk":False,"junkReason":""},
]

inp = json.load(open('.ralph/audit_batches/batch_22.json', encoding='utf-8'))
assert len(data) == len(inp), f'LENGTH MISMATCH {len(data)} vs {len(inp)}'
for i,(d,r) in enumerate(zip(data,inp)):
    if d['name'] != r['name']:
        print(f'NAME MISMATCH at {i}: got {repr(d["name"])} expected {repr(r["name"])}')
        d['name'] = r['name']

with open('.ralph/audit_batches/batch_22.out.json','w',encoding='utf-8') as f:
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
