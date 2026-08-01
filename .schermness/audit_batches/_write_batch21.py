import json

data = [
  {"name":"lettuce leave","category":"vegetable","taste":"astringent bitter","cuisines":["American","Global"],"isJunk":False,"junkReason":""},
  {"name":"lillet","category":"liqueur","taste":"sweet bitter","cuisines":["French"],"isJunk":False,"junkReason":""},
  {"name":"lillet blanc","category":"liqueur","taste":"sweet bitter","cuisines":["French"],"isJunk":False,"junkReason":""},
  {"name":"lima bean","category":"protein","taste":"umami sweet","cuisines":["American","Peruvian","Caribbean"],"isJunk":False,"junkReason":""},
  {"name":"limburger cheese","category":"dairy","taste":"salty umami pungent","cuisines":["German","Belgian"],"isJunk":False,"junkReason":""},
  {"name":"lime","category":"citrus","taste":"sour","cuisines":["Mexican","Thai","Vietnamese","Caribbean","Peruvian"],"isJunk":False,"junkReason":""},
  {"name":"lime flavored gelatin","category":"confection","taste":"sweet sour","cuisines":["American"],"isJunk":False,"junkReason":""},
  {"name":"lime gelatin","category":"confection","taste":"sweet sour","cuisines":["American"],"isJunk":False,"junkReason":""},
  {"name":"lime jello","category":"confection","taste":"sweet sour","cuisines":["American"],"isJunk":True,"junkReason":"Branded product (Jell-O is a registered trademark of Kraft Heinz)"},
  {"name":"lime juice","category":"citrus","taste":"sour","cuisines":["Mexican","Thai","Vietnamese","Caribbean","Peruvian"],"isJunk":False,"junkReason":""},
  {"name":"lime juice freshly squeezed","category":"citrus","taste":"sour","cuisines":["Mexican","Thai","Vietnamese","Caribbean"],"isJunk":False,"junkReason":""},
  {"name":"lime juiced","category":"citrus","taste":"sour","cuisines":["Mexican","Thai","Vietnamese","Caribbean"],"isJunk":False,"junkReason":""},
  {"name":"lime leaf","category":"herb","taste":"sour bitter","cuisines":["Thai","Indonesian","Malaysian","Vietnamese"],"isJunk":False,"junkReason":""},
  {"name":"lime leave","category":"herb","taste":"sour bitter","cuisines":["Thai","Indonesian","Malaysian","Vietnamese"],"isJunk":False,"junkReason":""},
  {"name":"lime rind","category":"citrus","taste":"sour bitter","cuisines":["Mexican","Thai","Caribbean","Peruvian"],"isJunk":False,"junkReason":""},
  {"name":"lime sherbet","category":"confection","taste":"sour sweet","cuisines":["American"],"isJunk":False,"junkReason":""},
  {"name":"lime soda","category":"mixer","taste":"sweet sour","cuisines":["American","Global"],"isJunk":False,"junkReason":""},
  {"name":"lime wedge","category":"citrus","taste":"sour","cuisines":["Mexican","Thai","Vietnamese","Caribbean"],"isJunk":False,"junkReason":""},
  {"name":"lime wheel","category":"citrus","taste":"sour","cuisines":["Mexican","Thai","Caribbean"],"isJunk":False,"junkReason":""},
  {"name":"limeade","category":"liquid","taste":"sweet sour","cuisines":["American","Mexican"],"isJunk":False,"junkReason":""},
  {"name":"limeade concentrate","category":"liquid","taste":"sweet sour","cuisines":["American","Mexican"],"isJunk":False,"junkReason":""},
  {"name":"linden","category":"herb","taste":"sweet pungent","cuisines":["French","German","Eastern European"],"isJunk":False,"junkReason":""},
  {"name":"lingonberry","category":"fruit","taste":"sour bitter","cuisines":["Scandinavian","Russian","Polish"],"isJunk":False,"junkReason":""},
  {"name":"linguica sausage","category":"protein","taste":"salty umami","cuisines":["Portuguese","Brazilian","Cajun/Creole"],"isJunk":False,"junkReason":""},
  {"name":"linguine noodle","category":"grain","taste":"sweet","cuisines":["Italian"],"isJunk":False,"junkReason":""},
  {"name":"linguine pasta","category":"grain","taste":"sweet","cuisines":["Italian"],"isJunk":False,"junkReason":""},
  {"name":"linseed","category":"nut","taste":"bitter sweet","cuisines":["Global"],"isJunk":False,"junkReason":""},
  {"name":"liqourice","category":"spice","taste":"sweet bitter","cuisines":["Turkish","Greek","Iranian"],"isJunk":False,"junkReason":""},
  {"name":"liqueur","category":"liqueur","taste":"sweet bitter","cuisines":["French","Global"],"isJunk":True,"junkReason":"Overly generic — not a single identifiable ingredient"},
  {"name":"liquid butter","category":"fat","taste":"sweet","cuisines":["Global"],"isJunk":False,"junkReason":""},
  {"name":"liquid cheese","category":"dairy","taste":"umami salty","cuisines":["American"],"isJunk":False,"junkReason":""},
  {"name":"liquid crab boil","category":"seasoning","taste":"spicy pungent","cuisines":["Cajun/Creole","Southern US"],"isJunk":False,"junkReason":""},
  {"name":"liquid egg","category":"protein","taste":"umami","cuisines":["Global"],"isJunk":False,"junkReason":""},
  {"name":"liquid egg substitute","category":"protein","taste":"umami","cuisines":["American"],"isJunk":False,"junkReason":""},
  {"name":"liquid fruit pectin","category":"thickener","taste":"astringent","cuisines":["Global"],"isJunk":False,"junkReason":""},
  {"name":"liquid honey","category":"sweetener","taste":"sweet","cuisines":["Global"],"isJunk":False,"junkReason":""},
  {"name":"liquid oil","category":"fat","taste":"sweet","cuisines":["Global"],"isJunk":True,"junkReason":"Overly generic — not a single identifiable ingredient"},
  {"name":"liquid pepper sauce","category":"condiment","taste":"spicy sour","cuisines":["American","Caribbean","Mexican"],"isJunk":False,"junkReason":""},
  {"name":"liquid smoke","category":"seasoning","taste":"umami","cuisines":["American","Southern US"],"isJunk":False,"junkReason":""},
  {"name":"liquid smoke flavoring","category":"seasoning","taste":"umami","cuisines":["American","Southern US"],"isJunk":False,"junkReason":""},
  {"name":"litchi","category":"fruit","taste":"sweet","cuisines":["Chinese","Thai","Vietnamese","Filipino"],"isJunk":False,"junkReason":""},
  {"name":"lite coconut milk","category":"liquid","taste":"sweet","cuisines":["Thai","Indonesian","Malaysian","Filipino"],"isJunk":False,"junkReason":""},
  {"name":"lite cream cheese","category":"dairy","taste":"sour umami","cuisines":["American"],"isJunk":False,"junkReason":""},
  {"name":"lite salt","category":"seasoning","taste":"salty","cuisines":["Global"],"isJunk":False,"junkReason":""},
  {"name":"littleneck clam","category":"protein","taste":"salty umami","cuisines":["American","Italian","Portuguese"],"isJunk":False,"junkReason":""},
  {"name":"live lobster","category":"protein","taste":"salty umami","cuisines":["French","American"],"isJunk":False,"junkReason":""},
  {"name":"loaves bread","category":"baked","taste":"sweet","cuisines":["Global"],"isJunk":False,"junkReason":""},
  {"name":"loaves white bread","category":"baked","taste":"sweet","cuisines":["American","Global"],"isJunk":False,"junkReason":""},
  {"name":"lobster","category":"protein","taste":"salty umami","cuisines":["French","American","Australian"],"isJunk":False,"junkReason":""},
  {"name":"lobster meat","category":"protein","taste":"salty umami","cuisines":["French","American","Australian"],"isJunk":False,"junkReason":""},
  {"name":"locatelli cheese","category":"dairy","taste":"umami salty","cuisines":["Italian"],"isJunk":False,"junkReason":""},
  {"name":"loganberry","category":"fruit","taste":"sour sweet","cuisines":["British","American"],"isJunk":False,"junkReason":""},
  {"name":"loin pork chop","category":"protein","taste":"umami","cuisines":["American","Chinese","German"],"isJunk":False,"junkReason":""},
  {"name":"loin roast","category":"protein","taste":"umami","cuisines":["American","German","French"],"isJunk":False,"junkReason":""},
  {"name":"long bean","category":"vegetable","taste":"sweet astringent","cuisines":["Chinese","Vietnamese","Thai","Filipino"],"isJunk":False,"junkReason":""},
  {"name":"long grain brown rice","category":"grain","taste":"sweet","cuisines":["American","Indian","Chinese"],"isJunk":False,"junkReason":""},
  {"name":"long grain wild rice","category":"grain","taste":"sweet","cuisines":["American"],"isJunk":False,"junkReason":""},
  {"name":"long pepper","category":"spice","taste":"spicy bitter","cuisines":["Indian","Indonesian","Moroccan"],"isJunk":False,"junkReason":""},
  {"name":"long red chili","category":"chili","taste":"spicy pungent","cuisines":["Thai","Vietnamese","Indonesian","Indian"],"isJunk":False,"junkReason":""},
  {"name":"long red chili pepper","category":"chili","taste":"spicy pungent","cuisines":["Thai","Vietnamese","Indonesian","Indian"],"isJunk":False,"junkReason":""},
  {"name":"long red chilie","category":"chili","taste":"spicy pungent","cuisines":["Thai","Vietnamese","Indonesian","Indian"],"isJunk":False,"junkReason":""},
  {"name":"long-grain rice","category":"grain","taste":"sweet","cuisines":["Chinese","Indian","Thai","American"],"isJunk":False,"junkReason":""},
  {"name":"long-grain white rice","category":"grain","taste":"sweet","cuisines":["Chinese","Indian","Thai","American"],"isJunk":False,"junkReason":""},
  {"name":"longan","category":"fruit","taste":"sweet","cuisines":["Chinese","Thai","Vietnamese"],"isJunk":False,"junkReason":""},
  {"name":"longhorn cheese","category":"dairy","taste":"umami sweet","cuisines":["American","Tex-Mex"],"isJunk":False,"junkReason":""},
  {"name":"loose sausage","category":"protein","taste":"salty umami","cuisines":["American","British"],"isJunk":False,"junkReason":""},
  {"name":"loquat","category":"fruit","taste":"sweet sour","cuisines":["Chinese","Japanese","Spanish"],"isJunk":False,"junkReason":""},
  {"name":"lotu","category":"vegetable","taste":"sweet astringent","cuisines":["Chinese","Japanese","Korean"],"isJunk":False,"junkReason":""},
  {"name":"lotus root","category":"vegetable","taste":"sweet astringent","cuisines":["Chinese","Japanese","Korean","Vietnamese"],"isJunk":False,"junkReason":""},
  {"name":"lovage","category":"herb","taste":"pungent bitter","cuisines":["British","German","Italian"],"isJunk":False,"junkReason":""},
  {"name":"low-sugar","category":"other","taste":"sweet","cuisines":["Global"],"isJunk":True,"junkReason":"Descriptor/label modifier, not a specific ingredient"},
  {"name":"lump butter","category":"fat","taste":"sweet","cuisines":["French","British"],"isJunk":False,"junkReason":""},
  {"name":"lump crab","category":"protein","taste":"salty umami","cuisines":["American","Cajun/Creole"],"isJunk":False,"junkReason":""},
  {"name":"lump crabmeat","category":"protein","taste":"salty umami","cuisines":["American","Cajun/Creole"],"isJunk":False,"junkReason":""},
  {"name":"lump of butter","category":"fat","taste":"sweet","cuisines":["French","British"],"isJunk":False,"junkReason":""},
  {"name":"lupine","category":"protein","taste":"bitter umami","cuisines":["Italian","Moroccan","Egyptian"],"isJunk":False,"junkReason":""},
  {"name":"lychee","category":"fruit","taste":"sweet","cuisines":["Chinese","Thai","Vietnamese","Filipino"],"isJunk":False,"junkReason":""},
  {"name":"maca powder","category":"other","taste":"bitter sweet","cuisines":["Peruvian"],"isJunk":False,"junkReason":""},
  {"name":"macadamia","category":"nut","taste":"sweet","cuisines":["Pacific Islander","Australian"],"isJunk":False,"junkReason":""},
  {"name":"macadamia nut","category":"nut","taste":"sweet","cuisines":["Pacific Islander","Australian"],"isJunk":False,"junkReason":""},
  {"name":"macaroni","category":"grain","taste":"sweet","cuisines":["Italian","American"],"isJunk":False,"junkReason":""},
  {"name":"macaroni noodle","category":"grain","taste":"sweet","cuisines":["Italian","American"],"isJunk":False,"junkReason":""},
  {"name":"macaroni pasta","category":"grain","taste":"sweet","cuisines":["Italian","American"],"isJunk":False,"junkReason":""},
  {"name":"mace","category":"spice","taste":"pungent sweet","cuisines":["Indonesian","Indian","Caribbean"],"isJunk":False,"junkReason":""},
  {"name":"made pie crust","category":"baked","taste":"sweet","cuisines":["American"],"isJunk":False,"junkReason":""},
  {"name":"madeira wine","category":"liquid","taste":"sweet sour bitter","cuisines":["Portuguese","French","British"],"isJunk":False,"junkReason":""},
  {"name":"mahleb","category":"spice","taste":"bitter sweet","cuisines":["Turkish","Lebanese","Greek"],"isJunk":False,"junkReason":""},
  {"name":"maitake","category":"vegetable","taste":"umami","cuisines":["Japanese","Chinese"],"isJunk":False,"junkReason":""},
  {"name":"maitake mushroom","category":"vegetable","taste":"umami","cuisines":["Japanese","Chinese","Korean"],"isJunk":False,"junkReason":""},
  {"name":"makrut lime leave","category":"herb","taste":"sour bitter","cuisines":["Thai","Indonesian","Malaysian"],"isJunk":False,"junkReason":""},
  {"name":"malibu coconut rum","category":"spirit","taste":"sweet","cuisines":["Caribbean"],"isJunk":True,"junkReason":"Branded product (Malibu is a registered trademark of Pernod Ricard)"},
  {"name":"malt","category":"grain","taste":"sweet bitter","cuisines":["British","German","Belgian"],"isJunk":False,"junkReason":""},
  {"name":"malt vinegar","category":"acid","taste":"sour","cuisines":["British","Australian"],"isJunk":False,"junkReason":""},
  {"name":"malt whisky","category":"spirit","taste":"bitter","cuisines":["British","Scottish"],"isJunk":False,"junkReason":""},
  {"name":"manchego cheese","category":"dairy","taste":"umami salty","cuisines":["Spanish"],"isJunk":False,"junkReason":""},
  {"name":"mandarin","category":"citrus","taste":"sweet sour","cuisines":["Chinese","Japanese","Spanish"],"isJunk":False,"junkReason":""},
  {"name":"mandarin juice","category":"citrus","taste":"sweet sour","cuisines":["Chinese","Spanish","Global"],"isJunk":False,"junkReason":""},
  {"name":"mandarin orange","category":"citrus","taste":"sweet sour","cuisines":["Chinese","Japanese","Spanish"],"isJunk":False,"junkReason":""},
  {"name":"mandarin orange section","category":"citrus","taste":"sweet sour","cuisines":["Chinese","Japanese","American"],"isJunk":False,"junkReason":""},
  {"name":"mango","category":"fruit","taste":"sweet sour","cuisines":["Indian","Thai","Filipino","Caribbean","Mexican"],"isJunk":False,"junkReason":""},
]

inp = json.load(open('.ralph/audit_batches/batch_21.json', encoding='utf-8'))
assert len(data) == len(inp), f'LENGTH MISMATCH {len(data)} vs {len(inp)}'
for i,(d,r) in enumerate(zip(data,inp)):
    if d['name'] != r['name']:
        print(f'NAME MISMATCH at {i}: got {repr(d["name"])} expected {repr(r["name"])}')
        d['name'] = r['name']

with open('.ralph/audit_batches/batch_21.out.json','w',encoding='utf-8') as f:
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
