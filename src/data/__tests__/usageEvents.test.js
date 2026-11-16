// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { EVENTS, usage, buildParams, TEXT_MAX } from '../usageEvents.js';
import { setConsent, __resetUsageForTests } from '../usage.js';
import { noteTypedIngredient } from '../usageIngredient.js';

const ROOT = process.cwd();
const flush = () => new Promise((r) => setTimeout(r, 0));

let handle;
function consentYes() {
  handle = { logEvent: vi.fn(), setEnabled: vi.fn() };
  __resetUsageForTests({ loader: async () => handle, isLocal: () => false });
  setConsent('yes');
}

beforeEach(() => {
  window.localStorage.clear();
  __resetUsageForTests();
});

// What each helper must send for a fully valid call.
const CASES = [
  ['lab_opened', () => usage.labOpened('cocktail'), { lab: 'cocktail' }],
  ['invent_started', () => usage.inventStarted('sauce'), { lab: 'sauce' }],
  ['invent_style_chosen', () => usage.inventStyleChosen('recipe'), { lab: 'recipe' }],
  ['invent_named', () => usage.inventNamed('cocktail'), { lab: 'cocktail' }],
  ['invent_saved', () => usage.inventSaved('sauce'), { lab: 'sauce' }],
  ['share_sheet_opened', () => usage.shareSheetOpened({ kind: 'cocktail', origin: 'built_in', slug: 'negroni' }), { kind: 'cocktail', origin: 'built_in', slug: 'negroni' }],
  ['share_link_created', () => usage.shareLinkCreated('dish'), { kind: 'dish' }],
  ['shared_page_opened', () => usage.sharedPageOpened({ kind: 'sauce', origin: 'built_in', slug: 'bechamel' }), { kind: 'sauce', origin: 'built_in', slug: 'bechamel' }],
  ['shared_saved', () => usage.sharedSaved({ kind: 'dish', origin: 'own' }), { kind: 'dish', origin: 'own' }],
  ['shared_signup', () => usage.sharedSignup({ kind: 'cocktail', origin: 'built_in' }), { kind: 'cocktail', origin: 'built_in' }],
  ['search_no_result', () => usage.searchNoResult('cookbook', '  Gin, Cucumber '), { lab: 'cookbook', term: 'gin, cucumber' }],
  ['ingredient_unrecognised', () => usage.ingredientUnrecognised('bar', 'Dragonfruit Gin'), { lab: 'bar', text: 'dragonfruit gin' }],
  ['scan_started', () => usage.scanStarted('key'), { route: 'key' }],
  ['scan_succeeded', () => usage.scanSucceeded('code', 12), { route: 'code', count: 12 }],
  ['scan_kept', () => usage.scanKept('key', 9), { route: 'key', count: 9 }],
  ['signin_started', () => usage.signinStarted('google'), { provider: 'google' }],
  ['signin_completed', () => usage.signinCompleted('apple'), { provider: 'apple' }],
];

describe('the catalogue follows Google Analytics rules', () => {
  const names = Object.keys(EVENTS);
  it('has at least the events the task lists', () => {
    expect(names.length).toBe(17);
  });
  it.each(names)('%s: name, params and enum values are valid', (name) => {
    expect(name).toMatch(/^[a-z][a-z0-9_]*$/);
    expect(name.length).toBeLessThanOrEqual(40);
    expect(name).not.toMatch(/^(firebase_|google_|ga_)/);
    const params = Object.entries(EVENTS[name].params);
    expect(params.length).toBeLessThanOrEqual(25);
    for (const [p, spec] of params) {
      expect(p).toMatch(/^[a-z][a-z0-9_]*$/);
      expect(p.length).toBeLessThanOrEqual(40);
      expect(p).not.toMatch(/^(firebase_|google_|ga_)/);
      if (spec.type === 'enum') for (const v of spec.values) expect(String(v).length).toBeLessThanOrEqual(100);
    }
    expect(EVENTS[name].plain.length).toBeGreaterThan(10);
    expect(EVENTS[name].fires.length).toBeGreaterThan(10);
  });
  it('typed text is capped at 60, inside the 100-character GA limit', () => {
    expect(TEXT_MAX).toBe(60);
  });
  it('no param is named like an identity field', () => {
    for (const def of Object.values(EVENTS)) {
      for (const p of Object.keys(def.params)) expect(['uid', 'user_id', 'email', 'name', 'display_name', 'id']).not.toContain(p);
    }
  });
});

describe('helpers send exactly the allowed params', () => {
  it('covers every catalogue event', () => {
    expect(CASES.map((c) => c[0]).sort()).toEqual(Object.keys(EVENTS).sort());
  });

  it.each(CASES)('%s', async (name, call, expected) => {
    consentYes();
    call();
    await flush();
    expect(handle.logEvent).toHaveBeenCalledTimes(1);
    expect(handle.logEvent).toHaveBeenCalledWith(name, expected);
    expect(Object.keys(expected).sort()).toEqual(Object.keys(EVENTS[name].params).filter((p) => p in expected).sort());
  });

  it('sends nothing, and never loads analytics, without a Yes or after a No', async () => {
    for (const answer of [null, 'no']) {
      window.localStorage.clear();
      const loader = vi.fn(async () => ({ logEvent: vi.fn(), setEnabled: vi.fn() }));
      __resetUsageForTests({ loader, isLocal: () => false });
      if (answer) setConsent(answer);
      for (const [, call] of CASES) call();
      await flush();
      expect(loader).not.toHaveBeenCalled();
    }
  });

  it('drops the whole event for an unknown enum value or a missing required param', async () => {
    consentYes();
    usage.labOpened('definitely-not-a-lab');
    usage.inventSaved(null);
    usage.scanSucceeded('key', 'many');
    usage.searchNoResult('cocktail', '   ');
    usage.signinStarted('facebook');
    await flush();
    expect(handle.logEvent).not.toHaveBeenCalled();
  });

  it('never throws, whatever it is handed', () => {
    expect(() => {
      usage.shareSheetOpened(undefined);
      usage.sharedSaved(null);
      usage.ingredientUnrecognised({}, { toString() { throw new Error('x'); } });
      usage.labOpened(Symbol('s'));
    }).not.toThrow();
  });
});

describe('a user recipe never leaks', () => {
  const OWN = {
    kind: 'cocktail', origin: 'own', slug: 'my-secret-recipe',
    name: "Grandma's Secret Sour", id: 'abcdefghjk', shareId: 'abcdefghjk', uid: 'u-123', email: 'a@b.c', nickname: 'Chef Dan',
    lines: [{ key: 'bourbon', amount: '2 oz' }], method: 'shake it', by: 'Dan',
  };
  const BAD = ["Grandma's Secret Sour", 'abcdefghjk', 'u-123', 'a@b.c', 'Chef Dan', 'bourbon', 'shake it', 'my-secret-recipe'];

  it('share and shared-page helpers keep only kind and origin for an own recipe', async () => {
    consentYes();
    usage.shareSheetOpened(OWN);
    usage.sharedPageOpened(OWN);
    usage.sharedSaved(OWN);
    usage.sharedSignup(OWN);
    usage.shareLinkCreated(OWN.kind);
    await flush();
    expect(handle.logEvent.mock.calls).toEqual([
      ['share_sheet_opened', { kind: 'cocktail', origin: 'own' }],
      ['shared_page_opened', { kind: 'cocktail', origin: 'own' }],
      ['shared_saved', { kind: 'cocktail', origin: 'own' }],
      ['shared_signup', { kind: 'cocktail', origin: 'own' }],
      ['share_link_created', { kind: 'cocktail' }],
    ]);
    expect(JSON.stringify(handle.logEvent.mock.calls)).not.toMatch(new RegExp(BAD.map((b) => b.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')));
  });

  it('invent helpers take only the lab, so the name and lines cannot travel', async () => {
    consentYes();
    usage.inventNamed({ ...OWN, lab: 'cocktail' });
    usage.inventSaved(OWN);
    await flush();
    expect(handle.logEvent).not.toHaveBeenCalled();
    usage.inventNamed('cocktail');
    await flush();
    expect(handle.logEvent.mock.calls).toEqual([['invent_named', { lab: 'cocktail' }]]);
  });

  it('a built-in slug is sent; the same slug is dropped once origin is own', () => {
    expect(buildParams('shared_page_opened', { kind: 'dish', origin: 'built_in', slug: 'pad-thai' })).toEqual({ kind: 'dish', origin: 'built_in', slug: 'pad-thai' });
    expect(buildParams('shared_page_opened', { kind: 'dish', origin: 'own', slug: 'pad-thai' })).toEqual({ kind: 'dish', origin: 'own' });
    expect(buildParams('shared_page_opened', { kind: 'dish', origin: 'built_in', slug: 'Has Spaces & Caps' })).toEqual({ kind: 'dish', origin: 'built_in' });
  });
});

describe('typed text', () => {
  it('is trimmed, lowercased, squeezed and cut to 60 characters', () => {
    const long = `  ${'Ab '.repeat(40)} `;
    const p = buildParams('search_no_result', { lab: 'cocktail', term: long });
    expect(p.term.length).toBeLessThanOrEqual(60);
    expect(p.term).toBe(p.term.toLowerCase());
    expect(p.term).toBe(p.term.trim());
    expect(buildParams('ingredient_unrecognised', { lab: 'bar', text: 'x'.repeat(200) }).text).toHaveLength(60);
  });
  it('anything that looks like an address is not sent at all', () => {
    expect(buildParams('search_no_result', { lab: 'sauce', term: 'dan@example.com' })).toBeNull();
    expect(buildParams('ingredient_unrecognised', { lab: 'recipe', text: 'see https://x.test/y' })).toBeNull();
  });
  it('noteTypedIngredient reports only a name the list does not resolve, and only with a list loaded', async () => {
    consentYes();
    const names = new Set(['gin', 'lime', 'tomato']);
    noteTypedIngredient('recipe', 'Tomatoes', names);
    noteTypedIngredient('recipe', 'gin', names);
    noteTypedIngredient('recipe', 'Unobtainium', names);
    noteTypedIngredient('recipe', 'Unobtainium', new Set());
    noteTypedIngredient('recipe', 'Unobtainium', null);
    await flush();
    expect(handle.logEvent.mock.calls).toEqual([['ingredient_unrecognised', { lab: 'recipe', text: 'unobtainium' }]]);
  });
});

describe('the code and docs/usage-data.md list the same events', () => {
  const doc = fs.readFileSync(path.join(ROOT, 'docs', 'usage-data.md'), 'utf8');
  const section = doc.split(/^## /m).find((s) => s.startsWith('Events')) || '';
  const rows = section.split('\n').filter((l) => /^\|\s*`[a-z0-9_]+`\s*\|/.test(l));
  const docEvents = new Map(rows.map((l) => {
    const cells = l.split('|').map((c) => c.trim()).filter((c, i, a) => i > 0 && i < a.length);
    const name = /`([a-z0-9_]+)`/.exec(cells[0])[1];
    const params = [...(cells[2] || '').matchAll(/`([a-z0-9_]+)`/g)].map((m) => m[1]);
    return [name, params];
  }));

  it('the table has a row per event, no more and no fewer', () => {
    expect([...docEvents.keys()].sort()).toEqual(Object.keys(EVENTS).sort());
  });
  it('every event lists exactly the params the code allows', () => {
    for (const [name, def] of Object.entries(EVENTS)) {
      expect([...(docEvents.get(name) || [])].sort(), name).toEqual(Object.keys(def.params).sort());
    }
  });
  it('the "fires when" text in the table is the catalogue text', () => {
    for (const l of rows) {
      const cells = l.split('|').map((c) => c.trim());
      const name = /`([a-z0-9_]+)`/.exec(cells[1])[1];
      expect(cells[2], name).toBe(EVENTS[name].fires);
    }
  });
  it('tells the owner which dimensions to register and which events to mark as key events', () => {
    expect(doc).toMatch(/Custom definitions/);
    expect(doc).toMatch(/key event/i);
    const registered = new Set([...doc.split('## Owner steps')[1].matchAll(/^\s*\|\s*`([a-z_]+)`\s*\|/gm)].map((m) => m[1]));
    const allParams = new Set(Object.values(EVENTS).flatMap((d) => Object.keys(d.params)));
    for (const p of allParams) {
      if (p === 'count') expect(doc).toMatch(/custom metric for `count`/i);
      else expect(registered.has(p), `dimension for ${p}`).toBe(true);
    }
  });
});

describe('track() is only called from usageEvents.js', () => {
  function walk(dir, out = []) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) { if (e.name !== '__tests__' && e.name !== 'node_modules') walk(p, out); } else if (/\.(js|jsx)$/.test(e.name) && !/\.test\./.test(e.name)) out.push(p);
    }
    return out;
  }
  it('no other source file imports track from usage.js', () => {
    const offenders = walk(path.join(ROOT, 'src')).filter((f) => {
      const norm = f.split(path.sep).join('/');
      if (norm.endsWith('src/data/usageEvents.js') || norm.endsWith('src/data/usage.js')) return false;
      const s = fs.readFileSync(f, 'utf8');
      return /import\s*\{[^}]*\btrack\b[^}]*\}\s*from\s*['"][^'"]*\/usage(\.js)?['"]/.test(s) || /\blogEvent\s*\(/.test(s);
    });
    expect(offenders).toEqual([]);
  });
});
