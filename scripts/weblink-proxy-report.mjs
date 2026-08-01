#!/usr/bin/env node
/**
 * weblink-proxy-report.mjs — how much does recipe import depend on the proxy?
 *
 * Three of the six recipe sites verified on 2026-07-31 (allrecipes,
 * seriouseats, simplyrecipes) only import because r.jina.ai is up and free.
 * That is a real fragility: if the proxy starts rate-limiting or goes paid,
 * those sites break and nothing else in the system notices. The thing worth
 * having before that happens is the trend, not the incident.
 *
 * handleScrape emits one `[scrape] outcome {...}` line per request carrying
 * host, fetchPath, parseStrategy and duration. This reads them back.
 *
 *   node scripts/weblink-proxy-report.mjs
 *   node scripts/weblink-proxy-report.mjs --project neuralflavor
 *
 * Reads from `firebase functions:log`, which keeps a limited window — run it
 * periodically rather than expecting full history.
 */
import { execSync } from 'node:child_process';

const args = process.argv.slice(2);
const project = valueFor('--project') ?? 'neuralflavor';

// The project id is interpolated into a shelled-out command on Windows.
// Firebase project ids are [a-z0-9-] only, so anything else is rejected
// rather than passed through to cmd.exe.
if (!/^[a-z0-9][a-z0-9-]{0,60}$/.test(project)) {
  console.error(`Refusing to run: --project ${JSON.stringify(project)} is not a valid Firebase project id.`);
  process.exit(1);
}

function valueFor(flag) {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : undefined;
}

function fetchLogLines() {
  try {
    // Node 20+ refuses to spawn a .cmd without a shell (the CVE-2024-27980
    // fix) and throws EINVAL, so this has to go through a shell on Windows.
    // Passing an args ARRAY with shell:true is separately deprecated
    // (DEP0190) because the array is concatenated rather than escaped — so
    // build the command as one string instead. `project` is the only
    // interpolated value and is validated against [a-z0-9-] above.
    return execSync(
      `npx firebase functions:log --only scrapeRecipe --project ${project}`,
      { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] },
    ).split('\n');
  } catch (err) {
    console.error('Could not read function logs. Is the Firebase CLI authenticated?');
    console.error(String(err.message ?? err).split('\n')[0]);
    process.exit(1);
  }
}

/** Pull the JSON payload out of each `[scrape] outcome {...}` line. */
function parseOutcomes(lines) {
  const out = [];
  for (const line of lines) {
    const at = line.indexOf('[scrape] outcome');
    if (at === -1) continue;
    const brace = line.indexOf('{', at);
    if (brace === -1) continue;
    try {
      out.push(JSON.parse(line.slice(brace)));
    } catch {
      // Truncated or interleaved log line — skip rather than abort the report.
    }
  }
  return out;
}

function pct(n, total) {
  return total === 0 ? '  0%' : `${String(Math.round((n / total) * 100)).padStart(3)}%`;
}

const outcomes = parseOutcomes(fetchLogLines());

if (outcomes.length === 0) {
  console.log('No [scrape] outcome lines in the current log window.');
  console.log('Either no imports have run since the telemetry shipped, or the window rolled over.');
  process.exit(0);
}

const byHost = new Map();
for (const o of outcomes) {
  const h = byHost.get(o.host) ?? { direct: 0, proxy: 0, failed: 0, total: 0, ms: [] };
  h.total += 1;
  if (!o.ok) h.failed += 1;
  if (o.fetchPath === 'proxy') h.proxy += 1;
  else if (o.fetchPath === 'direct') h.direct += 1;
  if (typeof o.ms === 'number') h.ms.push(o.ms);
  byHost.set(o.host, h);
}

const totals = { direct: 0, proxy: 0, failed: 0, total: outcomes.length };
for (const h of byHost.values()) {
  totals.direct += h.direct;
  totals.proxy += h.proxy;
  totals.failed += h.failed;
}

const rows = [...byHost.entries()].sort((a, b) => b[1].proxy - a[1].proxy || b[1].total - a[1].total);

console.log(`\nRecipe import — ${outcomes.length} request(s) in the log window\n`);
console.log(`  ${'host'.padEnd(28)} ${'n'.padStart(4)} ${'direct'.padStart(7)} ${'proxy'.padStart(7)} ${'failed'.padStart(7)}  median`);
console.log(`  ${'-'.repeat(28)} ${'-'.repeat(4)} ${'-'.repeat(7)} ${'-'.repeat(7)} ${'-'.repeat(7)}  ------`);
for (const [host, h] of rows) {
  const sorted = h.ms.slice().sort((a, b) => a - b);
  const median = sorted.length ? `${(sorted[Math.floor(sorted.length / 2)] / 1000).toFixed(1)}s` : '—';
  console.log(
    `  ${host.slice(0, 28).padEnd(28)} ${String(h.total).padStart(4)} ` +
    `${pct(h.direct, h.total)}    ${pct(h.proxy, h.total)}    ${pct(h.failed, h.total)}   ${median}`,
  );
}

const proxyShare = totals.proxy / totals.total;
console.log(`\n  overall: ${pct(totals.direct, totals.total)} direct, ${pct(totals.proxy, totals.total)} proxy, ${pct(totals.failed, totals.total)} failed`);

// The number that matters. A proxy share creeping upward means more origins
// are refusing us directly, so more of the feature rests on one free service.
if (proxyShare >= 0.5) {
  console.log('\n  ⚠ Over half of imports depend on r.jina.ai. A single provider outage');
  console.log('    would break most of this feature. Worth a second provider or a');
  console.log('    conversation about paying for a supported one.');
} else if (proxyShare > 0) {
  console.log(`\n  ${Math.round(proxyShare * 100)}% of imports depend on r.jina.ai staying available.`);
}

const heuristic = outcomes.filter((o) => o.parseStrategy === 'heuristic').length;
if (heuristic > 0) {
  console.log(`\n  ${heuristic} import(s) fell through to the class-name heuristic — the guessiest`);
  console.log('    parser. A rising count means sites are dropping structured data.');
}
console.log('');
