// SuperSweetDB — original host (webdocs.cs.ualberta.ca/SuperSweetDB) is offline
// and no Wayback Machine mirror is reachable (checked 2026-04-15).
// Falling back to ChemTasteDB sweet subset: filter processed/chemtastedb.json
// to compounds whose taste label contains "sweet".
//
// Output: processed/supersweetdb.json
//   { compounds: { <id>: { name, smiles, intensity, source_taste } },
//     _fetched_at, _source: "chemtastedb-fallback", _source_count }
//
// Intensity: ChemTasteDB lacks explicit intensity values, so we emit null.
// Downstream blend code already treats null intensity as "unknown".

import path from 'node:path';
import { PROCESSED, ensureDir, writeJson, readJson } from './common.js';

async function main() {
  await ensureDir(PROCESSED);

  const ctdb = await readJson(path.join(PROCESSED, 'chemtastedb.json'));
  const src = ctdb.compounds || {};

  const compounds = {};
  for (const [id, c] of Object.entries(src)) {
    const taste = (c.taste || '').toLowerCase();
    if (!taste.includes('sweet')) continue;
    compounds[id] = {
      name: c.name || null,
      smiles: c.smiles || null,
      intensity: null,
      source_taste: c.taste,
    };
  }

  const out = {
    compounds,
    _fetched_at: new Date().toISOString(),
    _source: 'chemtastedb-fallback',
    _source_count: { compounds: Object.keys(compounds).length },
  };
  await writeJson(path.join(PROCESSED, 'supersweetdb.json'), out);
  console.log(`[supersweetdb] done (chemtastedb fallback): ${Object.keys(compounds).length} sweet-containing compounds`);
}

main().catch(err => { console.error(err); process.exit(1); });
