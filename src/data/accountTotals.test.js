import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  countProfiles, countShared, countReports, buildTotals, formatTotals, checkTarget, main, parseArgs,
} from '../../scripts/accountTotals.mjs';

const SECRETS = ['Grandma Sour', 'bourbon', 'ada@example.com', 'Ada Lovelace', 'uid-ada-123', 'k3m9x0q2ab', 'secret note'];

const profiles = [
  {
    displayName: 'Ada Lovelace', email: 'ada@example.com', uid: 'uid-ada-123',
    cocktails: [{ id: 'x', name: 'Grandma Sour', lines: [{ key: 'bourbon' }], sharedFrom: 'k3m9x0q2ab' }, { id: 'y', name: 'Grandma Sour 2' }],
    sauces: [], recipes: [{ id: 'z', name: 'secret note' }],
  },
  { email: 'empty@example.com', cocktails: [], sauces: [], recipes: [] },
  { sauces: [{ id: 's', name: 'Grandma Sour', sharedFrom: 'sauce/bechamel' }] },
];
const shared = [
  { kind: 'cocktail', removed: false, name: 'Grandma Sour', owner: 'uid-ada-123' },
  { kind: 'recipe', removed: true }, { kind: 'recipe', removed: false }, { kind: 'bogus', removed: false },
];
const reports = [{ reason: 'spam', note: 'secret note', shareId: 'k3m9x0q2ab' }, { reason: 'weird' }, { reason: 'other' }];

const totals = () => buildTotals({
  profiles: countProfiles(profiles), shared: countShared(shared), reports: countReports(reports),
  scans: { codes: 2, scansTotal: 9 }, reads: 3,
});

describe('counting', () => {
  it('counts accounts, saved items and items saved from a shared link', () => {
    const p = countProfiles(profiles);
    expect(p.accounts).toBe(3);
    expect(p.accountsWithSaved).toBe(2);
    expect(p.savedItems).toEqual({ cocktail: 2, sauce: 1, recipe: 1 });
    expect(p.savedFromSharedLink).toEqual({ cocktail: 1, sauce: 1, recipe: 0 });
  });
  it('counts live and removed shares per kind, ignoring unknown kinds', () => {
    expect(countShared(shared)).toEqual({
      live: { cocktail: 1, sauce: 0, recipe: 1 }, removed: { cocktail: 0, sauce: 0, recipe: 1 },
    });
  });
  it('counts reports in total and by known reason', () => {
    const r = countReports(reports);
    expect(r.total).toBe(3);
    expect(r.byReason.spam).toBe(1);
    expect(r.byReason.other).toBe(1);
  });
  it('is safe on empty or malformed input', () => {
    expect(countProfiles(null).accounts).toBe(0);
    expect(countProfiles([null, { recipes: 'x' }]).accountsWithSaved).toBe(0);
    expect(countShared(undefined).live.recipe).toBe(0);
  });
});

describe('output privacy', () => {
  it('contains only fixed labels and numbers, and none of the fixture strings', () => {
    const text = formatTotals(totals());
    for (const s of SECRETS) expect(text).not.toContain(s);
    for (const line of text.split('\n')) expect(line).toMatch(/^[A-Za-z][A-Za-z ()-]*(?: \/ [A-Za-z-]+)?: \d+$/);
  });
  it('the JSON form has numbers as every leaf and none of the fixture strings', () => {
    const json = JSON.stringify(totals());
    for (const s of SECRETS) expect(json).not.toContain(s);
    const leaves = [];
    const walk = (o) => Object.values(o).forEach((v) => (typeof v === 'object' ? walk(v) : leaves.push(v)));
    walk(totals());
    expect(leaves.every((v) => typeof v === 'number')).toBe(true);
  });
});

describe('target check', () => {
  it('refuses a real project without --live', () => {
    const r = checkTarget({ project: 'neuralflavor', emulatorHost: undefined, live: false });
    expect(r.ok).toBe(false);
    expect(r.message).toMatch(/--live/);
  });
  it('allows a real project only with --live', () => {
    expect(checkTarget({ project: 'neuralflavor', live: true })).toEqual({ ok: true, target: 'live' });
  });
  it('allows the emulator with a demo- project, refuses an emulator host with a real id', () => {
    expect(checkTarget({ project: 'demo-x', emulatorHost: '127.0.0.1:8080', live: false }).target).toBe('emulator');
    expect(checkTarget({ project: 'neuralflavor', emulatorHost: '127.0.0.1:8080', live: true }).ok).toBe(false);
  });
  it('main refuses (exit 2) without --live and reads nothing', async () => {
    const lines = [];
    const code = await main([], {}, (l) => lines.push(l));
    expect(code).toBe(2);
    expect(lines.join('\n')).toMatch(/Refusing/);
  });
  it('main --dry-run prints totals from the fixture with no network', async () => {
    const lines = [];
    expect(await main(['--dry-run'], {}, (l) => lines.push(l))).toBe(0);
    expect(lines[0]).toMatch(/^Accounts \(profile documents\): 3\n/);
  });
  it('parses flags', () => {
    expect(parseArgs(['--live', '--json', '--project', 'p'])).toMatchObject({ live: true, json: true, project: 'p' });
  });
});

describe('read-only', () => {
  it('the script source has no write or delete call', () => {
    const src = readFileSync('scripts/accountTotals.mjs', 'utf8')
      .split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');
    expect(src).not.toMatch(/\.(set|add|update|delete|create)\(|\.batch\(|runTransaction|bulkWriter|recursiveDelete/);
  });
});
