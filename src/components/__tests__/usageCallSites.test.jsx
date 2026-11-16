// @vitest-environment jsdom
// USAGE-2: call sites report through usageEvents.js. The analytics loader is a fake handle (the real
// module is never imported), so each assertion is on exactly what would have been sent.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, renderHook, act, cleanup } from '@testing-library/react';
import InventCocktail from '../InventCocktail.jsx';
import PrivacyPage from '../PrivacyPage.jsx';
import LabsPanel from '../LabsPanel.jsx';
import { buildPairingIndex } from '../../data/recipePairingMatch.js';
import { buildRolePool } from '../../data/cocktailRiff.js';
import { EVENTS } from '../../data/usageEvents.js';
import { setConsent, __resetUsageForTests } from '../../data/usage.js';
import { useNoResultSearch } from '../../hooks/useUsage.js';
import useSaveInvention from '../../hooks/useSaveInvention.js';

let handle;
const sent = () => handle.logEvent.mock.calls.map(([n, p]) => [n, p]);
const named = (n) => sent().filter(([e]) => e === n);
const flush = () => act(async () => { await new Promise((r) => setTimeout(r, 0)); });

beforeEach(() => {
  window.localStorage.clear();
  handle = { logEvent: vi.fn(), setEnabled: vi.fn() };
  __resetUsageForTests({ loader: async () => handle, isLocal: () => false });
  setConsent('yes');
});
afterEach(() => { cleanup(); vi.useRealTimers(); __resetUsageForTests(); });

const roles = {
  gin: { role: 'spirit' }, bourbon: { role: 'spirit' }, 'lemon juice': { role: 'sour' }, 'simple syrup': { role: 'sweet' },
  'sweet vermouth': { role: 'vermouth' }, campari: { role: 'amaro_liqueur' },
};
const index = buildPairingIndex([
  { source: 'gin', target: 'campari', strength: 0.8, known: true },
  { source: 'campari', target: 'sweet vermouth', strength: 0.9, known: true },
  { source: 'gin', target: 'lemon juice', strength: 0.6, known: true },
], Object.keys(roles));
const pool = buildRolePool(roles, index.names);
const families = [{ id: 2, name: 'Sour Family', color: '#a16207' }, { id: 4, name: 'Aromatic Stirred', color: '#7c3aed' }, { id: 3, name: 'Boozy Sippers', color: '#92400e' }];
const byId = (id) => screen.getByTestId(id);
const submit = (inputId, text) => {
  fireEvent.change(byId(inputId), { target: { value: text } });
  fireEvent.submit(byId(inputId).closest('form'));
};

describe('invent panel (cocktail)', () => {
  const mount = () => render(<InventCocktail bar={['gin']} cocktails={[]} families={families} roles={roles} pool={pool}
    pairingIndex={index} nodes={new Map()} onClose={vi.fn()} onSave={vi.fn()} />);

  it('reports invent_started once, style chosen, named and an unrecognised typed ingredient, never the name or the lines', async () => {
    mount();
    submit('invent-start-input', 'gin');
    await flush();
    expect(named('invent_started')).toEqual([['invent_started', { lab: 'cocktail' }]]);
    expect(named('ingredient_unrecognised')).toEqual([]);

    submit('invent-list-add-input', 'Zzyzx Unobtainium');
    await flush();
    expect(named('ingredient_unrecognised')).toEqual([['ingredient_unrecognised', { lab: 'cocktail', text: 'zzyzx unobtainium' }]]);

    submit('invent-list-add-input', 'campari');
    fireEvent.click(byId('invent-category-toggle'));
    fireEvent.click(byId('invent-category-option-2'));
    await flush();
    expect(named('invent_style_chosen')).toEqual([['invent_style_chosen', { lab: 'cocktail' }]]);

    const nameBox = byId('invent-namesave-name');
    fireEvent.change(nameBox, { target: { value: "Grandma's Secret Sour" } });
    fireEvent.blur(nameBox);
    fireEvent.blur(nameBox);
    await flush();
    expect(named('invent_named')).toEqual([['invent_named', { lab: 'cocktail' }]]);
    expect(named('invent_started')).toHaveLength(1);
    expect(JSON.stringify(sent())).not.toMatch(/Grandma|secret sour|campari"/i);
  });
});

describe('invent_saved', () => {
  it('fires when a save is written, including a save that completes after sign-in, and not on a failed write', async () => {
    const saveInvention = vi.fn(() => ({ ok: true }));
    const userProfile = { saveInvention };
    const INPUT = { name: 'Dusk', category: 3, lines: [{ key: 'bourbon', amount: '2 oz' }] };
    const view = renderHook((p) => useSaveInvention(p), { initialProps: { kind: 'sauce', userProfile, auth: { user: null } } });
    await act(async () => { await view.result.current.onSave(INPUT); });
    await flush();
    expect(named('invent_saved')).toEqual([]);
    view.rerender({ kind: 'sauce', userProfile, auth: { user: { uid: 'u1' } } });
    await flush();
    expect(named('invent_saved')).toEqual([['invent_saved', { lab: 'sauce' }]]);

    saveInvention.mockReturnValueOnce({ ok: false, reason: 'no' });
    await act(async () => { await view.result.current.onSave(INPUT); });
    await flush();
    expect(named('invent_saved')).toHaveLength(1);
  });

  it('an onSaved callback replaces it (a shared page reports shared_saved instead)', async () => {
    const onSaved = vi.fn();
    const view = renderHook(() => useSaveInvention({ kind: 'recipe', userProfile: { saveInvention: () => ({ ok: true }) }, auth: { user: { uid: 'u' } }, onSaved }));
    await act(async () => { await view.result.current.onSave({ name: 'x', lines: [] }); });
    await flush();
    expect(onSaved).toHaveBeenCalledTimes(1);
    expect(named('invent_saved')).toEqual([]);
  });
});

describe('search_no_result', () => {
  it('fires once for a settled query, not per keystroke, and again only after the box was cleared', async () => {
    vi.useFakeTimers();
    const view = renderHook(({ term, none }) => useNoResultSearch('cocktail', term, none), { initialProps: { term: '', none: false } });
    for (const t of ['g', 'gi', 'gin', 'gin, c', 'gin, cu']) {
      view.rerender({ term: t, none: true });
      await act(async () => { await vi.advanceTimersByTimeAsync(300); });
    }
    expect(handle.logEvent).not.toHaveBeenCalled();
    await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
    vi.useRealTimers();
    await flush();
    expect(named('search_no_result')).toEqual([['search_no_result', { lab: 'cocktail', term: 'gin, cu' }]]);

    vi.useFakeTimers();
    view.rerender({ term: 'gin, cu', none: true });
    await act(async () => { await vi.advanceTimersByTimeAsync(3000); });
    vi.useRealTimers();
    await flush();
    expect(named('search_no_result')).toHaveLength(1);

    vi.useFakeTimers();
    view.rerender({ term: '', none: false });
    view.rerender({ term: 'gin, cu', none: true });
    await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
    vi.useRealTimers();
    await flush();
    expect(named('search_no_result')).toHaveLength(2);
  });

  it('a search with results reports nothing', async () => {
    vi.useFakeTimers();
    renderHook(() => useNoResultSearch('sauce', 'tomato', false));
    await act(async () => { await vi.advanceTimersByTimeAsync(5000); });
    vi.useRealTimers();
    await flush();
    expect(handle.logEvent).not.toHaveBeenCalled();
  });
});

describe('privacy page', () => {
  it('names both typed-text events and lists every event in the catalogue', () => {
    render(<PrivacyPage />);
    const page = byId('privacy-page').textContent;
    expect(page).toContain('search_no_result');
    expect(page).toContain('ingredient_unrecognised');
    expect(page).toMatch(/a search that found nothing/);
    expect(page).toMatch(/ingredient name the app did not recognise/);
    const listed = screen.getAllByTestId('privacy-event').map((li) => li.dataset.event).sort();
    expect(listed).toEqual(Object.keys(EVENTS).sort());
  });
});

describe('privacy links', () => {
  it('the Labs menu links to the privacy page', () => {
    render(<LabsPanel onPick={vi.fn()} />);
    expect(byId('labs-privacy-link').getAttribute('href')).toBe('/privacy');
  });
});
