import json

data = [
  {"name":"triticale","category":"grain","taste":"sweet umami bitter","cuisines":["German","Scandinavian","Eastern European"],"isJunk":False,"junkReason":""},
  {"name":"trout","category":"protein","taste":"umami salty","cuisines":["American","Scandinavian","British","French"],"isJunk":False,"junkReason":""},
  {"name":"truffle","category":"vegetable","taste":"umami pungent","cuisines":["French","Italian"],"isJunk":False,"junkReason":""},
  {"name":"truffle oil","category":"fat","taste":"umami pungent","cuisines":["French","Italian"],"isJunk":False,"junkReason":""},
  {"name":"tuna","category":"protein","taste":"umami salty","cuisines":["Japanese","Spanish","Italian","American","Mediterranean"],"isJunk":False,"junkReason":""},
  {"name":"tuna fish","category":"protein","taste":"umami salty","cuisines":["Japanese","Spanish","Italian","American","Portuguese"],"isJunk":False,"junkReason":""},
  {"name":"turbinado sugar","category":"sweetener","taste":"sweet","cuisines":["Global"],"isJunk":False,"junkReason":""},
  {"name":"turkey","category":"protein","taste":"umami salty","cuisines":["American","Southern US","British","Mexican"],"isJunk":False,"junkReason":""},
  {"name":"turkey bacon","category":"protein","taste":"umami salty","cuisines":["American","British"],"isJunk":False,"junkReason":""},
  {"name":"turkey breast","category":"protein","taste":"umami salty","cuisines":["American","Southern US","British"],"isJunk":False,"junkReason":""},
  {"name":"turkey breast cutlet","category":"protein","taste":"umami salty","cuisines":["American","Southern US","Italian"],"isJunk":False,"junkReason":""},
  {"name":"turkey breast halve","category":"protein","taste":"umami salty","cuisines":["American","Southern US"],"isJunk":False,"junkReason":""},
  {"name":"turkey breast tenderloin","category":"protein","taste":"umami salty","cuisines":["American","Southern US"],"isJunk":False,"junkReason":""},
  {"name":"turkey broth","category":"liquid","taste":"umami salty","cuisines":["American","French"],"isJunk":False,"junkReason":""},
  {"name":"turkey carcass","category":"protein","taste":"umami salty","cuisines":["American","Southern US","British"],"isJunk":False,"junkReason":""},
  {"name":"turkey cutlet","category":"protein","taste":"umami salty","cuisines":["American","Southern US","Italian"],"isJunk":False,"junkReason":""},
  {"name":"turkey dripping","category":"fat","taste":"umami salty","cuisines":["American","British"],"isJunk":False,"junkReason":""},
  {"name":"turkey drumstick","category":"protein","taste":"umami salty","cuisines":["American","Southern US"],"isJunk":False,"junkReason":""},
  {"name":"turkey giblet","category":"protein","taste":"umami salty","cuisines":["American","Southern US","British"],"isJunk":False,"junkReason":""},
  {"name":"turkey gravy","category":"condiment","taste":"umami salty","cuisines":["American","British"],"isJunk":False,"junkReason":""},
  {"name":"turkey gravy mix","category":"condiment","taste":"umami salty","cuisines":["American","British"],"isJunk":False,"junkReason":""},
  {"name":"turkey ham","category":"protein","taste":"umami salty","cuisines":["American","Southern US"],"isJunk":False,"junkReason":""},
  {"name":"turkey italian sausage","category":"protein","taste":"umami salty spicy","cuisines":["Italian","American"],"isJunk":False,"junkReason":""},
  {"name":"turkey kielbasa","category":"protein","taste":"umami salty spicy","cuisines":["Polish","American"],"isJunk":False,"junkReason":""},
  {"name":"turkey leg","category":"protein","taste":"umami salty","cuisines":["American","Southern US"],"isJunk":False,"junkReason":""},
  {"name":"turkey meat","category":"protein","taste":"umami salty","cuisines":["American","Southern US","British"],"isJunk":False,"junkReason":""},
  {"name":"turkey meatball","category":"protein","taste":"umami salty","cuisines":["Italian","American"],"isJunk":False,"junkReason":""},
  {"name":"turkey neck","category":"protein","taste":"umami salty","cuisines":["American","Southern US","Caribbean"],"isJunk":False,"junkReason":""},
  {"name":"turkey pepperoni","category":"protein","taste":"umami salty spicy","cuisines":["Italian","American"],"isJunk":False,"junkReason":""},
  {"name":"turkey sausage","category":"protein","taste":"umami salty spicy","cuisines":["American","Italian","German"],"isJunk":False,"junkReason":""},
  {"name":"turkey stock","category":"liquid","taste":"umami salty","cuisines":["American","French","British"],"isJunk":False,"junkReason":""},
  {"name":"turkey tenderloin","category":"protein","taste":"umami salty","cuisines":["American","Southern US"],"isJunk":False,"junkReason":""},
  {"name":"turkey thigh","category":"protein","taste":"umami salty","cuisines":["American","Southern US"],"isJunk":False,"junkReason":""},
  {"name":"turmeric","category":"spice","taste":"bitter pungent","cuisines":["Indian","Thai","Indonesian","Malaysian","Moroccan"],"isJunk":False,"junkReason":""},
  {"name":"turnip","category":"vegetable","taste":"bitter sweet pungent","cuisines":["British","American","French","Scandinavian","Chinese"],"isJunk":False,"junkReason":""},
  {"name":"type cheese","category":"dairy","taste":"umami salty","cuisines":["Global"],"isJunk":True,"junkReason":"Parse artifact — incomplete descriptor, not a specific ingredient"},
  {"name":"ucuhuba","category":"fat","taste":"sweet pungent","cuisines":["Brazilian"],"isJunk":False,"junkReason":""},
  {"name":"udon noodle","category":"grain","taste":"sweet umami","cuisines":["Japanese","Korean"],"isJunk":False,"junkReason":""},
  {"name":"udon noodles","category":"grain","taste":"sweet umami","cuisines":["Japanese","Korean"],"isJunk":False,"junkReason":""},
  {"name":"unbaked pie crust","category":"baked","taste":"sweet","cuisines":["American","British"],"isJunk":False,"junkReason":""},
  {"name":"unbeaten egg","category":"protein","taste":"umami","cuisines":["Global"],"isJunk":False,"junkReason":""},
  {"name":"unblanched almond","category":"nut","taste":"sweet bitter","cuisines":["Moroccan","Indian","Spanish","French","Middle Eastern"],"isJunk":False,"junkReason":""},
  {"name":"unbleached bread","category":"baked","taste":"sweet umami","cuisines":["American","British","German"],"isJunk":False,"junkReason":""},
  {"name":"unbleached flour","category":"grain","taste":"sweet","cuisines":["Global"],"isJunk":False,"junkReason":""},
  {"name":"unbleached white flour","category":"grain","taste":"sweet","cuisines":["Global"],"isJunk":False,"junkReason":""},
  {"name":"uncle ben's rice","category":"grain","taste":"sweet umami","cuisines":["American","Global"],"isJunk":True,"junkReason":"Branded product (Uncle Ben's is a registered trademark of Mars, Inc.)"},
  {"name":"unflavored gelatin","category":"thickener","taste":"umami","cuisines":["Global"],"isJunk":False,"junkReason":""},
  {"name":"unflavored gelatin powder","category":"thickener","taste":"umami","cuisines":["Global"],"isJunk":False,"junkReason":""},
  {"name":"unflavored gelatine","category":"thickener","taste":"umami","cuisines":["Global"],"isJunk":False,"junkReason":""},
  {"name":"unflavored powdered gelatin","category":"thickener","taste":"umami","cuisines":["Global"],"isJunk":False,"junkReason":""},
  {"name":"unflavored yogurt","category":"dairy","taste":"sour sweet","cuisines":["Indian","Turkish","Greek","Lebanese","Middle Eastern"],"isJunk":False,"junkReason":""},
  {"name":"unpeeled apple","category":"fruit","taste":"sweet sour","cuisines":["American","British","French"],"isJunk":False,"junkReason":""},
  {"name":"unrefined coconut oil","category":"fat","taste":"sweet","cuisines":["Indian","Thai","Filipino","Indonesian","Pacific Islander"],"isJunk":False,"junkReason":""},
  {"name":"unrefined sugar","category":"sweetener","taste":"sweet","cuisines":["Global"],"isJunk":False,"junkReason":""},
  {"name":"unsalted","category":"other","taste":"sweet","cuisines":["Global"],"isJunk":True,"junkReason":"Parse artifact — adjective, not a specific ingredient"},
  {"name":"unsalted cashew","category":"nut","taste":"sweet umami","cuisines":["Indian","Thai","Vietnamese","Chinese","Brazilian"],"isJunk":False,"junkReason":""},
  {"name":"unsalted macadamia nut","category":"nut","taste":"sweet umami","cuisines":["Australian","Hawaiian","Pacific Islander"],"isJunk":False,"junkReason":""},
  {"name":"unsalted margarine","category":"fat","taste":"sweet","cuisines":["Global"],"isJunk":False,"junkReason":""},
  {"name":"unsalted peanut","category":"nut","taste":"umami sweet","cuisines":["West African","Thai","Indonesian","Vietnamese","Chinese"],"isJunk":False,"junkReason":""},
  {"name":"unsalted pistachio","category":"nut","taste":"sweet umami","cuisines":["Turkish","Persian","Lebanese","Indian","Moroccan"],"isJunk":False,"junkReason":""},
  {"name":"unsweetened almond milk","category":"liquid","taste":"sweet","cuisines":["Global"],"isJunk":False,"junkReason":""},
  {"name":"unsweetened applesauce","category":"condiment","taste":"sweet sour","cuisines":["American","German","Eastern European"],"isJunk":False,"junkReason":""},
  {"name":"unsweetened chocolate","category":"confection","taste":"bitter","cuisines":["American","French","Belgian"],"isJunk":False,"junkReason":""},
  {"name":"unsweetened coconut","category":"nut","taste":"sweet","cuisines":["Thai","Indonesian","Malaysian","Indian","Caribbean"],"isJunk":False,"junkReason":""},
  {"name":"unsweetened coconut cream","category":"liquid","taste":"sweet","cuisines":["Thai","Indonesian","Malaysian","Filipino","Indian"],"isJunk":False,"junkReason":""},
  {"name":"unsweetened coconut flake","category":"nut","taste":"sweet","cuisines":["Thai","Indonesian","Malaysian","Indian","Caribbean"],"isJunk":False,"junkReason":""},
  {"name":"unsweetened coconut milk","category":"liquid","taste":"sweet","cuisines":["Thai","Indonesian","Malaysian","Filipino","Indian"],"isJunk":False,"junkReason":""},
  {"name":"unsweetened pineapple","category":"fruit","taste":"sweet sour","cuisines":["Pacific Islander","Filipino","Caribbean","Hawaiian"],"isJunk":False,"junkReason":""},
  {"name":"unsweetened soymilk","category":"liquid","taste":"sweet","cuisines":["Chinese","Japanese","Global"],"isJunk":False,"junkReason":""},
  {"name":"valencia orange","category":"citrus","taste":"sweet sour","cuisines":["Spanish","Mediterranean","American"],"isJunk":False,"junkReason":""},
  {"name":"vanilla","category":"spice","taste":"sweet","cuisines":["Mexican","French","American","Global"],"isJunk":False,"junkReason":""},
  {"name":"vanilla almond milk","category":"liquid","taste":"sweet","cuisines":["American","Global"],"isJunk":False,"junkReason":""},
  {"name":"vanilla bean ice cream","category":"confection","taste":"sweet","cuisines":["American","French"],"isJunk":False,"junkReason":""},
  {"name":"vanilla bean paste","category":"spice","taste":"sweet","cuisines":["Mexican","French","American","Global"],"isJunk":False,"junkReason":""},
  {"name":"vanilla cake","category":"baked","taste":"sweet","cuisines":["American","French","British"],"isJunk":False,"junkReason":""},
  {"name":"vanilla cake mix","category":"baked","taste":"sweet","cuisines":["American"],"isJunk":False,"junkReason":""},
  {"name":"vanilla caramel","category":"confection","taste":"sweet","cuisines":["French","American","British"],"isJunk":False,"junkReason":""},
  {"name":"vanilla chip","category":"confection","taste":"sweet","cuisines":["American"],"isJunk":False,"junkReason":""},
  {"name":"vanilla cream","category":"dairy","taste":"sweet","cuisines":["French","American","British"],"isJunk":False,"junkReason":""},
  {"name":"vanilla creme","category":"confection","taste":"sweet","cuisines":["French","American","British"],"isJunk":False,"junkReason":""},
  {"name":"vanilla custard","category":"dairy","taste":"sweet","cuisines":["French","British","Australian"],"isJunk":False,"junkReason":""},
  {"name":"vanilla essence","category":"spice","taste":"sweet","cuisines":["Mexican","French","American","Global"],"isJunk":False,"junkReason":""},
  {"name":"vanilla flavor","category":"spice","taste":"sweet","cuisines":["Mexican","French","American","Global"],"isJunk":False,"junkReason":""},
  {"name":"vanilla flavoring","category":"spice","taste":"sweet","cuisines":["Mexican","French","American","Global"],"isJunk":False,"junkReason":""},
  {"name":"vanilla frosting","category":"confection","taste":"sweet","cuisines":["American","British"],"isJunk":False,"junkReason":""},
  {"name":"vanilla ice cream","category":"confection","taste":"sweet","cuisines":["American","French","Global"],"isJunk":False,"junkReason":""},
  {"name":"vanilla ice milk","category":"confection","taste":"sweet","cuisines":["American"],"isJunk":False,"junkReason":""},
  {"name":"vanilla icing","category":"confection","taste":"sweet","cuisines":["American","British"],"isJunk":False,"junkReason":""},
  {"name":"vanilla instant pudding","category":"confection","taste":"sweet","cuisines":["American"],"isJunk":False,"junkReason":""},
  {"name":"vanilla instant pudding mix","category":"confection","taste":"sweet","cuisines":["American"],"isJunk":False,"junkReason":""},
  {"name":"vanilla nonfat yogurt","category":"dairy","taste":"sweet sour","cuisines":["American"],"isJunk":False,"junkReason":""},
  {"name":"vanilla oil","category":"fat","taste":"sweet","cuisines":["Mexican","French","American"],"isJunk":False,"junkReason":""},
  {"name":"vanilla paste","category":"spice","taste":"sweet","cuisines":["Mexican","French","American","Global"],"isJunk":False,"junkReason":""},
  {"name":"vanilla pie filling","category":"condiment","taste":"sweet","cuisines":["American"],"isJunk":False,"junkReason":""},
  {"name":"vanilla pod","category":"spice","taste":"sweet","cuisines":["Mexican","French","Global"],"isJunk":False,"junkReason":""},
  {"name":"vanilla powder","category":"spice","taste":"sweet","cuisines":["Mexican","French","American","Global"],"isJunk":False,"junkReason":""},
  {"name":"vanilla protein powder","category":"other","taste":"sweet","cuisines":["American","Global"],"isJunk":True,"junkReason":"Supplement product, not a culinary food ingredient"},
  {"name":"vanilla pudding","category":"confection","taste":"sweet","cuisines":["American","British","French"],"isJunk":False,"junkReason":""},
  {"name":"vanilla pudding mix","category":"confection","taste":"sweet","cuisines":["American"],"isJunk":False,"junkReason":""},
  {"name":"vanilla sauce","category":"condiment","taste":"sweet","cuisines":["French","German","American"],"isJunk":False,"junkReason":""},
]

inp = json.load(open('.ralph/audit_batches/batch_35.json', encoding='utf-8'))
assert len(data) == len(inp), f'LENGTH MISMATCH {len(data)} vs {len(inp)}'
for i,(d,r) in enumerate(zip(data,inp)):
    if d['name'] != r['name']:
        print(f'NAME MISMATCH at {i}: got {repr(d["name"])} expected {repr(r["name"])}')
        d['name'] = r['name']

with open('.ralph/audit_batches/batch_35.out.json','w',encoding='utf-8') as f:
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
