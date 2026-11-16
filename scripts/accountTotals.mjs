#!/usr/bin/env node
// USAGE-3. Totals from the account records: numbers and fixed labels only, no content.
//
// Run by the OWNER with their own Google login (Application Default Credentials):
//   gcloud auth application-default login
//   npm run totals -- --live
// Nothing here writes: the only Firestore calls are get() and count()/sum() aggregations.
// The builder never ran it against the live project; tests use fixtures and the local emulator.
//
// Flags:  --live            allow a real (non-emulator) project; without it the script refuses
//         --json            print the totals as JSON instead of text
//         --dry-run         print totals for a built-in made-up fixture; touches nothing
//         --project <id>    project id (default: neuralflavor)
// Emulator: set FIRESTORE_EMULATOR_HOST (e.g. 127.0.0.1:8080) and a `demo-` project id.
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const KINDS = Object.freeze(['cocktail', 'sauce', 'recipe']);
export const PROFILE_FIELDS = Object.freeze({ cocktail: 'cocktails', sauce: 'sauces', recipe: 'recipes' });
export const REPORT_REASONS = Object.freeze(['offensive', 'spam', 'private', 'not-recipe', 'other']);
export const DEFAULT_PROJECT = 'neuralflavor';

const zeroByKind = () => ({ cocktail: 0, sauce: 0, recipe: 0 });
const list = (v) => (Array.isArray(v) ? v : []);

/** Pure. profiles: array of profile document data. Returns counts only. */
export function countProfiles(profiles) {
  const savedItems = zeroByKind();
  const fromShared = zeroByKind();
  let accounts = 0;
  let withSaved = 0;
  for (const p of Array.isArray(profiles) ? profiles : []) {
    accounts += 1;
    let any = false;
    for (const kind of KINDS) {
      const items = list(p?.[PROFILE_FIELDS[kind]]);
      savedItems[kind] += items.length;
      for (const it of items) if (it && typeof it.sharedFrom === 'string' && it.sharedFrom) fromShared[kind] += 1;
      if (items.length) any = true;
    }
    if (any) withSaved += 1;
  }
  return { accounts, accountsWithSaved: withSaved, savedItems, savedFromSharedLink: fromShared };
}

/** Pure. shared: array of shared documents' data (kind, removed). */
export function countShared(shared) {
  const live = zeroByKind();
  const removed = zeroByKind();
  for (const s of Array.isArray(shared) ? shared : []) {
    const bucket = s?.removed === true ? removed : live;
    if (KINDS.includes(s?.kind)) bucket[s.kind] += 1;
  }
  return { live, removed };
}

/** Pure. reports: array of report documents' data (reason). */
export function countReports(reports) {
  const byReason = Object.fromEntries(REPORT_REASONS.map((r) => [r, 0]));
  let total = 0;
  for (const r of Array.isArray(reports) ? reports : []) {
    total += 1;
    if (byReason[r?.reason] !== undefined) byReason[r.reason] += 1;
  }
  return { total, byReason };
}

const sum = (o) => Object.values(o).reduce((a, b) => a + b, 0);

/** Pure. Assemble the totals object from the parts (every leaf is a number). */
export function buildTotals({ profiles, shared, reports, scans, reads = 0 }) {
  return {
    accounts: profiles.accounts,
    accountsWithSaved: profiles.accountsWithSaved,
    savedItems: { ...profiles.savedItems, total: sum(profiles.savedItems) },
    savedFromSharedLink: { ...profiles.savedFromSharedLink, total: sum(profiles.savedFromSharedLink) },
    sharedLinksLive: { ...shared.live, total: sum(shared.live) },
    sharedLinksRemoved: { ...shared.removed, total: sum(shared.removed) },
    reportsWaiting: { total: reports.total, ...reports.byReason },
    inviteCodeScans: { codes: scans?.codes ?? 0, scansTotal: scans?.scansTotal ?? 0 },
    documentsRead: reads,
  };
}

const LABELS = [
  ['accounts', 'Accounts (profile documents)'],
  ['accountsWithSaved', 'Accounts with at least one saved item'],
];
const GROUPS = [
  ['savedItems', 'Saved items'],
  ['savedFromSharedLink', 'Saved from a shared link'],
  ['sharedLinksLive', 'Shared links live'],
  ['sharedLinksRemoved', 'Shared links removed'],
  ['reportsWaiting', 'Reports waiting'],
  ['inviteCodeScans', 'Invite-code photo scans'],
];

/** Pure. Text lines: "Label: 12" and "Label / sub: 3" only. */
export function formatTotals(t) {
  const out = [];
  for (const [k, label] of LABELS) out.push(`${label}: ${t[k]}`);
  for (const [k, label] of GROUPS) {
    for (const [sub, n] of Object.entries(t[k])) out.push(`${label} / ${sub}: ${n}`);
  }
  out.push(`Documents read: ${t.documentsRead}`);
  return out.join('\n');
}

/** Pure. Decide whether the run may go ahead. */
export function checkTarget({ project, emulatorHost, live }) {
  const onEmulator = !!emulatorHost && String(project).startsWith('demo-');
  if (emulatorHost && !String(project).startsWith('demo-')) {
    return { ok: false, message: `FIRESTORE_EMULATOR_HOST is set but project "${project}" is not a demo- project. Refusing.` };
  }
  if (onEmulator) return { ok: true, target: 'emulator' };
  if (!live) {
    return {
      ok: false,
      message: `Refusing: "${project}" is not a local emulator project and --live was not given. `
        + 'This script reads the real database only when you pass --live yourself.',
    };
  }
  return { ok: true, target: 'live' };
}

export const READ_PLAN = [
  'profiles: every document, once (saved items live inside the profile document; only the three list fields are fetched). Cost: one read per account.',
  'shared: 6 count queries (live and removed, per kind). Cost: about 1 read each.',
  'shareReports: 6 count queries (total and per reason). Cost: about 1 read each.',
  'scanCodes: 1 count query; barScans: 1 sum query. Cost: about 1 read each.',
  'Nothing is written. No document content is printed.',
];

export const DRY_RUN_FIXTURE = {
  profiles: [
    { cocktails: [{ id: 'a' }, { id: 'b', sharedFrom: 'cocktail/negroni' }], sauces: [], recipes: [{ id: 'c' }] },
    { cocktails: [], sauces: [], recipes: [] },
    { sauces: [{ id: 'd', sharedFrom: 'k3m9x0q2ab' }] },
  ],
  shared: [
    { kind: 'cocktail', removed: false }, { kind: 'recipe', removed: false }, { kind: 'sauce', removed: true },
  ],
  reports: [{ reason: 'spam' }, { reason: 'other' }],
  scans: { codes: 2, scansTotal: 7 },
};

/** Thin reader. db is an Admin SDK Firestore; `agg` is the SDK's AggregateField. Only reads. */
export async function readTotals(db, agg) {
  let reads = 0;
  const snap = await db.collection('profiles').select('cocktails', 'sauces', 'recipes').get();
  reads += snap.size;
  const profiles = snap.docs.map((d) => {
    const x = d.data();
    return { cocktails: x.cocktails, sauces: x.sauces, recipes: x.recipes };
  });
  const count = async (q) => { reads += 1; return (await q.count().get()).data().count; };

  const sharedParts = { live: zeroByKind(), removed: zeroByKind() };
  for (const kind of KINDS) {
    sharedParts.live[kind] = await count(db.collection('shared').where('kind', '==', kind).where('removed', '==', false));
    sharedParts.removed[kind] = await count(db.collection('shared').where('kind', '==', kind).where('removed', '==', true));
  }
  const byReason = {};
  for (const r of REPORT_REASONS) byReason[r] = await count(db.collection('shareReports').where('reason', '==', r));
  const reports = { total: await count(db.collection('shareReports')), byReason };

  reads += 1;
  const sumSnap = await db.collection('barScans').aggregate({ total: agg.sum('count') }).get();
  const scans = { codes: await count(db.collection('scanCodes')), scansTotal: sumSnap.data().total || 0 };

  return buildTotals({ profiles: countProfiles(profiles), shared: sharedParts, reports, scans, reads });
}

export function parseArgs(argv) {
  const a = { live: false, json: false, dryRun: false, project: DEFAULT_PROJECT };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--live') a.live = true;
    else if (argv[i] === '--json') a.json = true;
    else if (argv[i] === '--dry-run') a.dryRun = true;
    else if (argv[i] === '--project') { a.project = argv[i + 1]; i += 1; }
  }
  return a;
}

export async function main(argv, env = process.env, log = console.log) {
  const args = parseArgs(argv);
  const emit = (t) => log(args.json ? JSON.stringify(t, null, 2) : formatTotals(t));
  if (args.dryRun) {
    const t = buildTotals({
      profiles: countProfiles(DRY_RUN_FIXTURE.profiles),
      shared: countShared(DRY_RUN_FIXTURE.shared),
      reports: countReports(DRY_RUN_FIXTURE.reports),
      scans: DRY_RUN_FIXTURE.scans,
    });
    emit(t);
    return 0;
  }
  const project = args.project;
  const gate = checkTarget({ project, emulatorHost: env.FIRESTORE_EMULATOR_HOST, live: args.live });
  if (!gate.ok) { log(gate.message); return 2; }
  log(`Target: ${gate.target} (${project}). It will read:`);
  for (const l of READ_PLAN) log(`  - ${l}`);

  // firebase-admin lives in functions/, so resolve it from there rather than adding a root dependency.
  const req = createRequire(fileURLToPath(new URL('../functions/package.json', import.meta.url)));
  const { initializeApp, getApps } = req('firebase-admin/app');
  const { getFirestore, AggregateField } = req('firebase-admin/firestore');
  if (getApps().length === 0) initializeApp({ projectId: project });
  const t = await readTotals(getFirestore(), AggregateField);
  emit(t);
  return 0;
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  main(process.argv.slice(2)).then((code) => process.exit(code), (e) => {
    console.error(`Failed: ${e?.code || ''} ${e?.message || e}`.trim());
    process.exit(1);
  });
}
