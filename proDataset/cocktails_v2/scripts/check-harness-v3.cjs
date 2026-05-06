const r = require('../raw/corpus_v3.json');
const must = [
  'Martini', 'Negroni', 'Manhattan', 'Daiquiri', 'Old Fashioned',
  'Boulevardier', 'Sazerac', 'Margarita', 'Whiskey Sour', 'Sidecar',
  'Rob Roy', 'Vesper', 'Gibson', 'Aviation', "Bee's Knees",
  'Mai Tai', 'Jungle Bird', 'Mint Julep', 'Bellini', 'Gin and Tonic',
  'Vieux Carré', 'Last Word', 'Hanky Panky', 'Trinidad Sour', 'Paper Plane',
  'Bloody Mary', 'Penicillin', 'Naked and Famous',
];
const norm = (n) => n.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[‘’'`]/g, '').replace(/[^\w\s-]/g, '').replace(/\s+/g, ' ').trim();
const have = new Set(r.cocktails.map((c) => c.name_canonical));
let hits = 0;
for (const n of must) {
  const present = have.has(norm(n));
  if (present) hits++;
  console.log('  ' + (present ? '✓' : '✗') + ' ' + n);
}
console.log('---');
console.log(`${hits}/${must.length} validation harness present in corpus_v3`);
console.log(`Total: ${r.cocktails.length}, IBA: ${r.cocktails.filter(c=>c.iba_official).length}`);
