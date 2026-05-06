const r = require('../raw/corpus_v3.json');
const c = r.cocktails.find((x) => x.name === 'Vieux Carré');
console.log('Stored canonical:', JSON.stringify(c?.name_canonical));
console.log('Length:', c?.name_canonical?.length);
const norm = (s) =>
  s.toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[‘’'`]/g, '')
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
console.log('Harness normed:', JSON.stringify(norm('Vieux Carré')));
console.log('Match:', c?.name_canonical === norm('Vieux Carré'));
