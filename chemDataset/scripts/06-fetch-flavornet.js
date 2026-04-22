// FlavorNet scraper for flavornet.org — aroma compounds with odor descriptors.
//
// Endpoint: GET http://www.flavornet.org/flavornet.html
//   Single static HTML page. Table rows: CAS, Name, Descriptor, Retention Index.
//   Per-compound detail page: /compound/<id>.html (carries the same data plus
//   the sensory threshold; we don't need the detail page for the base merge).
//
// Strategy: fetch the index once, cache to raw/flavornet/flavornet.html,
// regex out the table rows. Compounds WITHOUT a SMILES are kept here as
// CAS→descriptor — scripts/07-fetch-pubchem-smiles.js fills in SMILES later
// from the CAS. Output schema:
//   { compounds: { <cas>: {cas, name, descriptor, retention_index} },
//     _fetched_at, _source_count }
//
// Rate limit: 1 req (the whole page is one GET). No pagination.
// Idempotent: re-runs reuse the cached HTML. Delete raw/flavornet/ to refresh.
//
// Run:  node scripts/06-fetch-flavornet.js   (or  npm run flavornet )

import path from 'node:path';
import { promises as fs } from 'node:fs';
import {
  RAW, PROCESSED, ensureDir, writeJson, fetchText,
} from './common.js';

const RAW_DIR = path.join(RAW, 'flavornet');
const INDEX_URL = 'http://www.flavornet.org/flavornet.html';

async function getIndexHtml() {
  const cachePath = path.join(RAW_DIR, 'flavornet.html');
  try {
    return await fs.readFile(cachePath, 'utf8');
  } catch {
    // not cached
  }
  const text = await fetchText(INDEX_URL, { retries: 3, delayMs: 2000 });
  await ensureDir(RAW_DIR);
  await fs.writeFile(cachePath, text);
  return text;
}

// Parse the table rows out of the index HTML.
// The published page is a 4-column <table>: CAS | Name | Descriptor | RI.
// This regex is defensive: matches any <tr> with 4 <td> cells and trims tags.
function parseRows(html) {
  const out = [];
  const rowRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  const cellRe = /<td[^>]*>([\s\S]*?)<\/td>/gi;
  let rm;
  while ((rm = rowRe.exec(html)) !== null) {
    const cells = [];
    let cm;
    while ((cm = cellRe.exec(rm[1])) !== null) {
      cells.push(stripTags(cm[1]).trim());
    }
    if (cells.length >= 3 && /^\d+-\d+-\d+$/.test(cells[0])) {
      out.push({
        cas: cells[0],
        name: cells[1],
        descriptor: cells[2],
        retention_index: cells[3] ? Number(cells[3]) || null : null,
      });
    }
  }
  return out;
}

function stripTags(s) {
  return s.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ');
}

async function main() {
  console.log('[flavornet] fetching index page');
  const html = await getIndexHtml();
  const rows = parseRows(html);
  console.log(`[flavornet] parsed ${rows.length} rows`);
  if (rows.length === 0) {
    console.error('[flavornet] FAILED: 0 rows parsed. HTML layout may have changed.');
    console.error('           Inspect raw/flavornet/flavornet.html and update parseRows().');
    process.exit(1);
  }

  const compounds = {};
  for (const r of rows) {
    compounds[r.cas] = r;
  }

  const out = {
    compounds,
    _fetched_at: new Date().toISOString(),
    _source_count: Object.keys(compounds).length,
    _source_url: INDEX_URL,
  };
  const outPath = path.join(PROCESSED, 'flavornet.json');
  await writeJson(outPath, out);
  console.log(`[flavornet] wrote ${outPath} with ${out._source_count} compounds`);
  console.log('[flavornet] next step: node scripts/07-fetch-pubchem-smiles.js');
}

main().catch((err) => {
  console.error('[flavornet] ERROR', err);
  process.exit(1);
});
