import json

data = [
  {"name":"pancake batter","category":"baked","taste":"sweet","cuisines":["American","French","Scandinavian"],"isJunk":False,"junkReason":""},
  {"name":"pancake mix","category":"baked","taste":"sweet","cuisines":["American"],"isJunk":False,"junkReason":""},
  {"name":"pancake syrup","category":"sweetener","taste":"sweet","cuisines":["American"],"isJunk":False,"junkReason":""},
  {"name":"pandan","category":"herb","taste":"sweet pungent","cuisines":["Filipino","Indonesian","Malaysian","Thai","Vietnamese"],"isJunk":False,"junkReason":""},
  {"name":"paneer","category":"dairy","taste":"sweet umami","cuisines":["Indian","Pakistani"],"isJunk":False,"junkReason":""},
  {"name":"paneer cheese","category":"dairy","taste":"sweet umami","cuisines":["Indian","Pakistani"],"isJunk":False,"junkReason":""},
  {"name":"panela cheese","category":"dairy","taste":"sweet umami","cuisines":["Mexican"],"isJunk":False,"junkReason":""},
  {"name":"panko","category":"baked","taste":"sweet","cuisines":["Japanese","Korean"],"isJunk":False,"junkReason":""},
  {"name":"panko breadcrumb","category":"baked","taste":"sweet","cuisines":["Japanese","Korean"],"isJunk":False,"junkReason":""},
  {"name":"panko crumb","category":"baked","taste":"sweet","cuisines":["Japanese","Korean"],"isJunk":False,"junkReason":""},
  {"name":"papaya","category":"fruit","taste":"sweet sour","cuisines":["Filipino","Thai","Caribbean","Indian","Mexican"],"isJunk":False,"junkReason":""},
  {"name":"paprika","category":"spice","taste":"spicy sweet","cuisines":["Hungarian","Spanish","Turkish","Moroccan"],"isJunk":False,"junkReason":""},
  {"name":"paprika powder","category":"spice","taste":"spicy sweet","cuisines":["Hungarian","Spanish","Turkish","Moroccan"],"isJunk":False,"junkReason":""},
  {"name":"pared apple","category":"fruit","taste":"sweet sour","cuisines":["American","British"],"isJunk":False,"junkReason":""},
  {"name":"parmesan","category":"dairy","taste":"umami salty","cuisines":["Italian"],"isJunk":False,"junkReason":""},
  {"name":"parmesian cheese","category":"dairy","taste":"umami salty","cuisines":["Italian"],"isJunk":False,"junkReason":""},
  {"name":"parmigiano cheese","category":"dairy","taste":"umami salty","cuisines":["Italian"],"isJunk":False,"junkReason":""},
  {"name":"parmigiano-reggiano cheese","category":"dairy","taste":"umami salty","cuisines":["Italian"],"isJunk":False,"junkReason":""},
  {"name":"parsley","category":"herb","taste":"bitter pungent","cuisines":["Italian","French","Lebanese","Turkish","Greek"],"isJunk":False,"junkReason":""},
  {"name":"parsley flake","category":"herb","taste":"bitter pungent","cuisines":["Italian","French","Lebanese","Turkish"],"isJunk":False,"junkReason":""},
  {"name":"parsley root","category":"vegetable","taste":"bitter pungent","cuisines":["German","Polish","French"],"isJunk":False,"junkReason":""},
  {"name":"parsley stem","category":"herb","taste":"bitter pungent","cuisines":["Italian","French","Lebanese","Turkish"],"isJunk":False,"junkReason":""},
  {"name":"parsnip","category":"vegetable","taste":"sweet pungent","cuisines":["British","German","Scandinavian","French"],"isJunk":False,"junkReason":""},
  {"name":"party rye bread","category":"baked","taste":"sweet","cuisines":["German","Scandinavian","American"],"isJunk":False,"junkReason":""},
  {"name":"passion fruit","category":"fruit","taste":"sour sweet","cuisines":["Brazilian","Caribbean","Australian","Filipino"],"isJunk":False,"junkReason":""},
  {"name":"passion fruit juice","category":"liquid","taste":"sour sweet","cuisines":["Brazilian","Caribbean","Australian"],"isJunk":False,"junkReason":""},
  {"name":"passion fruit pulp","category":"fruit","taste":"sour sweet","cuisines":["Brazilian","Caribbean","Australian","Filipino"],"isJunk":False,"junkReason":""},
  {"name":"passion fruit puree","category":"fruit","taste":"sour sweet","cuisines":["Brazilian","Caribbean","Australian"],"isJunk":False,"junkReason":""},
  {"name":"pasta","category":"grain","taste":"sweet","cuisines":["Italian"],"isJunk":False,"junkReason":""},
  {"name":"pasta cooking water","category":"liquid","taste":"salty","cuisines":["Italian"],"isJunk":False,"junkReason":""},
  {"name":"pasta dough","category":"grain","taste":"sweet","cuisines":["Italian"],"isJunk":False,"junkReason":""},
  {"name":"pasta noodle","category":"grain","taste":"sweet","cuisines":["Italian"],"isJunk":False,"junkReason":""},
  {"name":"pasta of choice","category":"grain","taste":"sweet","cuisines":["Italian"],"isJunk":True,"junkReason":"Vague generic descriptor, not a specific ingredient"},
  {"name":"pasta sauce","category":"condiment","taste":"sweet sour umami","cuisines":["Italian"],"isJunk":False,"junkReason":""},
  {"name":"pasta sheet","category":"grain","taste":"sweet","cuisines":["Italian"],"isJunk":False,"junkReason":""},
  {"name":"pasta shell","category":"grain","taste":"sweet","cuisines":["Italian"],"isJunk":False,"junkReason":""},
  {"name":"pasta water","category":"liquid","taste":"salty","cuisines":["Italian"],"isJunk":False,"junkReason":""},
  {"name":"paste","category":"other","taste":"umami","cuisines":["Global"],"isJunk":True,"junkReason":"Overly generic — not a single identifiable ingredient"},
  {"name":"pastry","category":"baked","taste":"sweet","cuisines":["French","American","British"],"isJunk":False,"junkReason":""},
  {"name":"pastry cream","category":"dairy","taste":"sweet","cuisines":["French"],"isJunk":False,"junkReason":""},
  {"name":"pastry flour","category":"grain","taste":"sweet","cuisines":["Global"],"isJunk":False,"junkReason":""},
  {"name":"pastry pie shell","category":"baked","taste":"sweet","cuisines":["American","British","French"],"isJunk":False,"junkReason":""},
  {"name":"pats butter","category":"fat","taste":"sweet","cuisines":["French","American","British"],"isJunk":False,"junkReason":""},
  {"name":"pats of butter","category":"fat","taste":"sweet","cuisines":["French","American","British"],"isJunk":False,"junkReason":""},
  {"name":"pawpaw","category":"fruit","taste":"sweet","cuisines":["American","Caribbean","West African"],"isJunk":False,"junkReason":""},
  {"name":"pea","category":"vegetable","taste":"sweet","cuisines":["British","Indian","French"],"isJunk":False,"junkReason":""},
  {"name":"pea pod","category":"vegetable","taste":"sweet astringent","cuisines":["Chinese","Japanese","British"],"isJunk":False,"junkReason":""},
  {"name":"pea shoot","category":"vegetable","taste":"sweet bitter","cuisines":["Chinese","British"],"isJunk":False,"junkReason":""},
  {"name":"peach","category":"fruit","taste":"sweet sour","cuisines":["American","French","Italian"],"isJunk":False,"junkReason":""},
  {"name":"peach gelatin","category":"confection","taste":"sweet sour","cuisines":["American"],"isJunk":False,"junkReason":""},
  {"name":"peach halve","category":"fruit","taste":"sweet sour","cuisines":["American"],"isJunk":False,"junkReason":""},
  {"name":"peach jello","category":"confection","taste":"sweet sour","cuisines":["American"],"isJunk":True,"junkReason":"Branded product (Jell-O is a registered trademark of Kraft Heinz)"},
  {"name":"peach juice","category":"liquid","taste":"sweet sour","cuisines":["American"],"isJunk":False,"junkReason":""},
  {"name":"peach pie filling","category":"condiment","taste":"sweet sour","cuisines":["American"],"isJunk":False,"junkReason":""},
  {"name":"peach preserve","category":"condiment","taste":"sweet","cuisines":["American","British"],"isJunk":False,"junkReason":""},
  {"name":"peach schnapp","category":"liqueur","taste":"sweet","cuisines":["German","American"],"isJunk":False,"junkReason":""},
  {"name":"peach yogurt","category":"dairy","taste":"sweet sour","cuisines":["American","Global"],"isJunk":False,"junkReason":""},
  {"name":"peache","category":"fruit","taste":"sweet sour","cuisines":["American","French","Italian"],"isJunk":False,"junkReason":""},
  {"name":"peanut","category":"nut","taste":"umami sweet","cuisines":["West African","Thai","Indonesian","Vietnamese","Chinese"],"isJunk":False,"junkReason":""},
  {"name":"peanut brittle","category":"confection","taste":"sweet umami","cuisines":["American","Southern US"],"isJunk":False,"junkReason":""},
  {"name":"peanut butter","category":"condiment","taste":"umami sweet","cuisines":["American","West African","Thai"],"isJunk":False,"junkReason":""},
  {"name":"peanut oil","category":"fat","taste":"sweet","cuisines":["Chinese","West African","American","Thai"],"isJunk":False,"junkReason":""},
  {"name":"peanut sauce","category":"condiment","taste":"umami sweet spicy","cuisines":["Thai","Indonesian","Vietnamese","West African"],"isJunk":False,"junkReason":""},
  {"name":"pear","category":"fruit","taste":"sweet sour","cuisines":["French","Italian","British"],"isJunk":False,"junkReason":""},
  {"name":"pear brandy","category":"spirit","taste":"sweet bitter","cuisines":["French","German","Swiss"],"isJunk":False,"junkReason":""},
  {"name":"pear halve","category":"fruit","taste":"sweet sour","cuisines":["French","American"],"isJunk":False,"junkReason":""},
  {"name":"pear juice","category":"liquid","taste":"sweet sour","cuisines":["French","German","American"],"isJunk":False,"junkReason":""},
  {"name":"pear nectar","category":"liquid","taste":"sweet sour","cuisines":["French","German"],"isJunk":False,"junkReason":""},
  {"name":"pearl","category":"fruit","taste":"sweet sour","cuisines":["French","American","British"],"isJunk":False,"junkReason":""},
  {"name":"pearl barley","category":"grain","taste":"sweet umami","cuisines":["British","German","Scandinavian","Russian"],"isJunk":False,"junkReason":""},
  {"name":"pearl onion","category":"aromatic","taste":"pungent sweet","cuisines":["French","Italian","American"],"isJunk":False,"junkReason":""},
  {"name":"pearl sugar","category":"sweetener","taste":"sweet","cuisines":["Scandinavian","Belgian","French"],"isJunk":False,"junkReason":""},
  {"name":"pearl tapioca","category":"thickener","taste":"sweet","cuisines":["Thai","Filipino","Chinese"],"isJunk":False,"junkReason":""},
  {"name":"pecan","category":"nut","taste":"sweet bitter","cuisines":["American","Southern US"],"isJunk":False,"junkReason":""},
  {"name":"pecan meat","category":"nut","taste":"sweet bitter","cuisines":["American","Southern US"],"isJunk":False,"junkReason":""},
  {"name":"pecan nut","category":"nut","taste":"sweet bitter","cuisines":["American","Southern US"],"isJunk":False,"junkReason":""},
  {"name":"peck pear","category":"fruit","taste":"sweet sour","cuisines":["French","American","British"],"isJunk":False,"junkReason":""},
  {"name":"pecorino","category":"dairy","taste":"umami salty","cuisines":["Italian"],"isJunk":False,"junkReason":""},
  {"name":"pecorino cheese","category":"dairy","taste":"umami salty","cuisines":["Italian"],"isJunk":False,"junkReason":""},
  {"name":"pecorino romano cheese","category":"dairy","taste":"umami salty","cuisines":["Italian"],"isJunk":False,"junkReason":""},
  {"name":"peg corn","category":"vegetable","taste":"sweet","cuisines":["American","Mexican"],"isJunk":False,"junkReason":""},
  {"name":"peg white corn","category":"vegetable","taste":"sweet","cuisines":["American","Mexican"],"isJunk":False,"junkReason":""},
  {"name":"penne pasta","category":"grain","taste":"sweet","cuisines":["Italian"],"isJunk":False,"junkReason":""},
  {"name":"peppadew pepper","category":"chili","taste":"sweet spicy","cuisines":["South African"],"isJunk":False,"junkReason":""},
  {"name":"pepper","category":"spice","taste":"spicy pungent","cuisines":["Global"],"isJunk":False,"junkReason":""},
  {"name":"pepper bacon","category":"protein","taste":"salty umami spicy","cuisines":["American","Southern US"],"isJunk":False,"junkReason":""},
  {"name":"pepper c. baccatum","category":"chili","taste":"spicy pungent","cuisines":["Peruvian","Brazilian"],"isJunk":False,"junkReason":""},
  {"name":"pepper c. chinense","category":"chili","taste":"spicy pungent","cuisines":["Caribbean","Peruvian","Brazilian"],"isJunk":False,"junkReason":""},
  {"name":"pepper cheese","category":"dairy","taste":"spicy umami","cuisines":["American","Tex-Mex"],"isJunk":False,"junkReason":""},
  {"name":"pepper jelly","category":"condiment","taste":"sweet spicy","cuisines":["American","Southern US"],"isJunk":False,"junkReason":""},
  {"name":"pepper oil","category":"fat","taste":"spicy","cuisines":["Chinese","Korean","Indian"],"isJunk":False,"junkReason":""},
  {"name":"pepper powder","category":"spice","taste":"spicy pungent","cuisines":["Global"],"isJunk":False,"junkReason":""},
  {"name":"pepper sauce","category":"condiment","taste":"spicy sour","cuisines":["American","Caribbean","Mexican"],"isJunk":False,"junkReason":""},
  {"name":"peppercorn","category":"spice","taste":"spicy pungent","cuisines":["Global"],"isJunk":False,"junkReason":""},
  {"name":"pepperjack cheese","category":"dairy","taste":"spicy umami","cuisines":["American","Tex-Mex"],"isJunk":False,"junkReason":""},
  {"name":"peppermint candie","category":"confection","taste":"sweet pungent","cuisines":["American","British"],"isJunk":False,"junkReason":""},
  {"name":"peppermint candy","category":"confection","taste":"sweet pungent","cuisines":["American","British"],"isJunk":False,"junkReason":""},
  {"name":"peppermint flavoring","category":"spice","taste":"sweet pungent","cuisines":["American","Global"],"isJunk":False,"junkReason":""},
  {"name":"peppermint ice cream","category":"dairy","taste":"sweet pungent","cuisines":["American"],"isJunk":False,"junkReason":""},
  {"name":"peppermint oil","category":"fat","taste":"sweet pungent","cuisines":["American","Global"],"isJunk":False,"junkReason":""},
]

inp = json.load(open('.ralph/audit_batches/batch_25.json', encoding='utf-8'))
assert len(data) == len(inp), f'LENGTH MISMATCH {len(data)} vs {len(inp)}'
for i,(d,r) in enumerate(zip(data,inp)):
    if d['name'] != r['name']:
        print(f'NAME MISMATCH at {i}: got {repr(d["name"])} expected {repr(r["name"])}')
        d['name'] = r['name']

with open('.ralph/audit_batches/batch_25.out.json','w',encoding='utf-8') as f:
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
