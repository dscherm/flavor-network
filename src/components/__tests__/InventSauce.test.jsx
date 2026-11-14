// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';
import fs from 'node:fs';
import path from 'node:path';
import InventSauce from '../InventSauce.jsx';
import { buildCategoryMap } from '../../data/saucePantry.js';
import { proteinIngredient } from '../../data/sauceWines.js';
import { AXES } from '../../data/recipeProfileAnalysis.js';

const meta = [
  { name: 'butter', category: 'Fat' }, { name: 'olive oil', category: 'Fat' },
  { name: 'flour', category: 'Thickener' }, { name: 'egg yolk', category: 'Thickener' },
  { name: 'milk', category: 'Liquid' }, { name: 'cream', category: 'Liquid' }, { name: 'chicken stock', category: 'Liquid' },
  { name: 'lemon juice', category: 'Acid' }, { name: 'white wine vinegar', category: 'Acid' }, { name: 'tomato', category: 'Acid' },
  { name: 'shallot', category: 'Aromatic' }, { name: 'garlic', category: 'Aromatic' }, { name: 'onion', category: 'Aromatic' },
  { name: 'tarragon', category: 'Herb' }, { name: 'nutmeg', category: 'Seasoning' }, { name: 'cumin', category: 'Seasoning' },
];
const catMap = buildCategoryMap(meta);
const families = [
  { id: 0, name: 'Béchamel', color: '#f5f0d6' }, { id: 1, name: 'Velouté', color: '#e8c989' }, { id: 2, name: 'Espagnole', color: '#a05a2c' },
  { id: 3, name: 'Hollandaise', color: '#f3d44e' }, { id: 4, name: 'Tomato', color: '#d94a3d' },
];
const sauces = [
  { name: 'Hollandaise', family_id: 3, ingredients: ['egg yolk', 'butter', 'lemon juice', 'salt'], proteins: ['salmon', 'eggs'] },
  { name: 'Béarnaise', family_id: 3, ingredients: ['egg yolk', 'butter', 'white wine vinegar', 'shallot', 'tarragon'], proteins: ['beef', 'salmon'] },
  { name: 'Béchamel', family_id: 0, ingredients: ['butter', 'flour', 'milk', 'nutmeg'], proteins: ['chicken'] },
  { name: 'Marinara', family_id: 4, ingredients: ['olive oil', 'tomato', 'garlic'], proteins: ['chicken'] },
];
const wineJson = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../../public/data/wine_styles.json'), 'utf8'));
const wineStyles = { families: wineJson._meta?.families || [], wines: wineJson.wines };

const PANTRY = ['butter', 'egg yolk', 'lemon', 'shallot', 'cream', 'tomato', 'garlic'];
const P = 'sauce-invent';
const L = `${P}-list`;

function renderInvent(props = {}) {
  return render(<InventSauce kitchen={PANTRY} sauces={sauces} families={families} meta={meta} catMap={catMap}
    wineStyles={null} onClose={vi.fn()} {...props} />);
}
const start = (text) => {
  fireEvent.change(screen.getByTestId(`${P}-start-input`), { target: { value: text } });
  fireEvent.click(screen.getByTestId(`${P}-start-go`));
};
const addIng = (text) => {
  fireEvent.change(screen.getByTestId(`${L}-add-input`), { target: { value: text } });
  fireEvent.click(screen.getByTestId(`${L}-add`));
};
const listKeys = () => screen.queryAllByTestId(`${L}-line`).map((e) => e.getAttribute('data-key'));
const suggestKeys = () => screen.queryAllByTestId(`${P}-suggest-item`).map((e) => e.getAttribute('data-key'));
const chooseTechnique = (id) => {
  fireEvent.click(screen.getByTestId(`${P}-category-toggle`));
  fireEvent.click(screen.getByTestId(`${P}-category-option-${id}`));
};

describe('InventSauce — starts empty, the cook chooses', () => {
  it('opens on the main-ingredient question only', () => {
    renderInvent();
    expect(screen.getByTestId(`${P}-start`)).toHaveTextContent('What is the sauce built on?');
    // Pantry items that can anchor a sauce come first.
    const keys = screen.getAllByTestId(`${P}-start-option`).map((e) => e.getAttribute('data-key'));
    expect(keys).toEqual(expect.arrayContaining(['butter', 'cream', 'tomato']));
    expect(keys).not.toContain('egg yolk');
    for (const id of ['list', 'category', 'hint', 'checklist', 'suggest', 'profile', 'namesave', 'proteins', 'card']) {
      expect(screen.queryByTestId(`${P}-${id}`)).toBeNull();
    }
    expect(screen.queryByTestId(`${L}-line`)).toBeNull();
  });

  it('after picking butter the list is exactly [butter] and the name box is empty', () => {
    renderInvent({ onSave: vi.fn() });
    fireEvent.click(screen.getAllByTestId(`${P}-start-option`).find((e) => e.getAttribute('data-key') === 'butter'));
    expect(listKeys()).toEqual(['butter']);
    expect(screen.getByTestId(`${P}-namesave-name`)).toHaveValue('');
    expect(screen.getByTestId(`${P}-namesave-name`)).toHaveAttribute('placeholder', 'Name your sauce');
    // Nothing was filled in for any technique: no checklist, no hint, no method.
    expect(screen.queryByTestId(`${P}-checklist`)).toBeNull();
    expect(screen.queryByTestId(`${P}-hint`)).toBeNull();
    expect(screen.queryByTestId(`${P}-method`)).toBeNull();
    expect(screen.getByTestId(`${P}-category-toggle`)).toHaveTextContent('A particular technique? (optional)');
  });

  it('a typed main ingredient answers step 1 too', () => {
    renderInvent();
    start('Tomato');
    expect(listKeys()).toEqual(['tomato']);
  });

  it('lists the ten techniques with a one-line blurb each, plus "No particular technique"', () => {
    renderInvent();
    start('butter');
    fireEvent.click(screen.getByTestId(`${P}-category-toggle`));
    const opts = screen.getByTestId(`${P}-category-options`);
    expect(within(opts).getAllByRole('button')).toHaveLength(11);
    expect(within(opts).getByTestId(`${P}-category-option-Hollandaise`)).toHaveTextContent('Emulsion');
    expect(within(opts).getByTestId(`${P}-category-option-Hollandaise`)).toHaveTextContent('butter or oil held in egg yolk: rich, glossy');
    expect(screen.getByTestId(`${P}-category-none`)).toHaveTextContent('No particular technique');
  });
});

describe('InventSauce — recommendation and checklist', () => {
  it('with no technique, egg yolk + lemon juice recommends Emulsion, applied only on Accept', () => {
    renderInvent();
    start('egg yolk');
    expect(screen.queryByTestId(`${P}-hint`)).toBeNull(); // one ingredient is not enough
    addIng('lemon juice');
    const hint = screen.getByTestId(`${P}-hint`);
    expect(hint).toHaveTextContent('This looks like an Emulsion');
    expect(screen.queryByTestId(`${P}-checklist`)).toBeNull();
    expect(screen.queryByTestId(`${P}-method`)).toBeNull();
    expect(listKeys()).toEqual(['egg yolk', 'lemon juice']);
    fireEvent.click(screen.getByTestId(`${P}-hint-accept`));
    expect(screen.queryByTestId(`${P}-hint`)).toBeNull();
    expect(screen.getByTestId(`${P}-checklist`)).toHaveTextContent('An Emulsion needs');
    expect(listKeys()).toEqual(['lemon juice', 'egg yolk'].sort((a, b) => listKeys().indexOf(a) - listKeys().indexOf(b)));
    expect(listKeys().sort()).toEqual(['egg yolk', 'lemon juice']);
    expect(screen.getByTestId(`${P}-category-toggle`)).toHaveTextContent('Emulsion');
  });

  it('Not now hides the recommendation until the list changes', () => {
    renderInvent();
    start('egg yolk');
    addIng('lemon juice');
    fireEvent.click(screen.getByTestId(`${P}-hint-dismiss`));
    expect(screen.queryByTestId(`${P}-hint`)).toBeNull();
    expect(screen.queryByTestId(`${P}-checklist`)).toBeNull();
    addIng('butter');
    expect(screen.getByTestId(`${P}-hint`)).toBeInTheDocument();
  });

  it('with Emulsion chosen and no egg yolk the emulsifier is unticked with its why, and nothing is filled in', () => {
    renderInvent();
    start('butter');
    chooseTechnique('Hollandaise');
    expect(listKeys()).toEqual(['butter']);
    expect(screen.getByTestId(`${P}-checklist-item-fat`)).toHaveAttribute('data-done', 'true');
    const emu = screen.getByTestId(`${P}-checklist-item-emulsifier`);
    expect(emu).toHaveAttribute('data-done', 'false');
    expect(emu).toHaveAttribute('data-required', 'true');
    expect(screen.getByTestId(`${P}-checklist-why-emulsifier`)).toHaveTextContent('its lecithin holds the fat in the water');
    expect(screen.getByTestId(`${P}-checklist-why-acid`)).toBeInTheDocument();
    // Opening the part shows options; still nothing added until a tap.
    fireEvent.click(screen.getByTestId(`${P}-checklist-open-emulsifier`));
    const opts = within(screen.getByTestId(`${P}-checklist-options-emulsifier`)).getAllByTestId(`${P}-checklist-option`);
    expect(opts.map((o) => o.getAttribute('data-key'))).toContain('egg yolk');
    expect(listKeys()).toEqual(['butter']);
    fireEvent.click(opts.find((o) => o.getAttribute('data-key') === 'egg yolk'));
    expect(listKeys()).toEqual(['butter', 'egg yolk']);
    expect(screen.getByTestId(`${P}-checklist-item-emulsifier`)).toHaveAttribute('data-done', 'true');
    expect(screen.queryByTestId(`${P}-checklist-why-emulsifier`)).toBeNull();
  });

  it('every required part of every technique has a plain why', async () => {
    const { INVENT_STYLES } = await import('../../data/inventSauce.js');
    for (const s of INVENT_STYLES) {
      expect(s.blurb, s.id).toBeTruthy();
      for (const sl of s.slots.filter((x) => x.required)) expect(sl.why, `${s.id}/${sl.id}`).toBeTruthy();
    }
  });

  it('method, wine and the closest sauce appear only once a technique is set', () => {
    renderInvent({ wineStyles, onSelectSauce: vi.fn() });
    start('butter');
    addIng('egg yolk');
    addIng('lemon juice');
    fireEvent.click(within(screen.getByTestId(`${P}-proteins`)).getByRole('button', { name: 'salmon' }));
    expect(screen.queryByTestId(`${P}-wine`)).toBeNull();
    expect(screen.queryByTestId(`${P}-method`)).toBeNull();
    expect(screen.queryByTestId(`${P}-nearest`)).toBeNull();
    fireEvent.click(screen.getByTestId(`${P}-hint-accept`));
    expect(screen.getByTestId(`${P}-method`)).toHaveTextContent(/lecithin/);
    expect(screen.getByTestId(`${P}-wine`)).toHaveTextContent('wine with salmon');
    expect(within(screen.getByTestId(`${P}-nearest`)).getByRole('button')).toHaveTextContent(/Hollandaise|Béarnaise/);
    // With a required part missing there is no method yet.
    fireEvent.click(screen.getByTestId(`${L}-remove-egg yolk`));
    expect(screen.getByTestId(`${P}-method`)).toHaveTextContent(/Add the parts it still needs/);
  });
});

describe('InventSauce — the list', () => {
  it('adds by typing, refuses a duplicate with its reason, removes', () => {
    renderInvent();
    start('butter');
    addIng('garlic');
    expect(listKeys()).toEqual(['butter', 'garlic']);
    addIng('garlic');
    expect(screen.getByTestId(`${L}-notice`)).toHaveTextContent(/already/);
    expect(listKeys()).toEqual(['butter', 'garlic']);
    fireEvent.click(screen.getByTestId(`${L}-remove-garlic`));
    expect(listKeys()).toEqual(['butter']);
  });

  it('amounts are suggestions the cook can edit, and the edit survives other changes', () => {
    renderInvent();
    start('butter');
    expect(screen.getByTestId(`${L}-amount-butter`)).toHaveValue('3 tbsp');
    chooseTechnique('Hollandaise');
    expect(screen.getByTestId(`${L}-amount-butter`)).toHaveValue('½ cup (115 g), melted');
    fireEvent.change(screen.getByTestId(`${L}-amount-butter`), { target: { value: '100 g' } });
    addIng('garlic');
    expect(screen.getByTestId(`${L}-amount-butter`)).toHaveValue('100 g');
  });

  it('marks a line not in the pantry and offers same-role, same-kind stand-ins the cook owns; tapping replaces', () => {
    renderInvent({ kitchen: ['butter', 'shallot'] });
    start('butter');
    addIng('onion');
    const rows = screen.getAllByTestId(`${L}-line`);
    expect(rows.find((r) => r.getAttribute('data-key') === 'butter')).toHaveAttribute('data-have', 'true');
    expect(rows.find((r) => r.getAttribute('data-key') === 'onion')).toHaveAttribute('data-have', 'false');
    fireEvent.click(screen.getByTestId(`${L}-need-onion`));
    const opts = within(screen.getByTestId(`${L}-replacements-onion`)).getAllByTestId(`${L}-replace-option`);
    expect(opts.map((o) => o.getAttribute('data-key'))).toEqual(['shallot']);
    fireEvent.click(opts[0]);
    expect(listKeys()).toEqual(['butter', 'shallot']);
  });

  it('with a technique, stand-ins must fit the same part (a starch cannot stand in for the emulsifier)', () => {
    renderInvent({ kitchen: ['butter', 'flour', 'lemon'] });
    start('butter');
    addIng('egg yolk');
    chooseTechnique('Hollandaise');
    fireEvent.click(screen.getByTestId(`${L}-need-egg yolk`));
    expect(screen.getByTestId(`${L}-no-replacements-egg yolk`)).toBeInTheDocument();
  });

  it('"Only what I have" limits suggestions to the pantry', () => {
    renderInvent({ kitchen: ['butter', 'tomato', 'garlic'], assumeBasics: false });
    start('butter');
    const all = suggestKeys();
    expect(all).toEqual(expect.arrayContaining(['tomato', 'garlic']));
    expect(all.some((k) => !['tomato', 'garlic'].includes(k))).toBe(true);
    fireEvent.click(screen.getByTestId(`${P}-pantry-only`));
    expect(suggestKeys().sort()).toEqual(['garlic', 'tomato']);
  });

  it('suggests pantry items first, and adds one only on a tap', () => {
    renderInvent({ kitchen: ['butter', 'garlic'], assumeBasics: false });
    start('butter');
    expect(suggestKeys()[0]).toBe('garlic');
    expect(listKeys()).toEqual(['butter']);
    fireEvent.click(screen.getAllByTestId(`${P}-suggest-item`)[0]);
    expect(listKeys()).toEqual(['butter', 'garlic']);
  });

  it('choosing what it is for re-ranks the suggestions', () => {
    const prot = proteinIngredient('chicken');
    const pairingIndex = { strength: new Map([['tomato|butter', 0.2], [`garlic|${prot}`, 0.9]]) };
    renderInvent({ kitchen: ['butter'], assumeBasics: false, pairingIndex });
    start('butter');
    const before = suggestKeys();
    expect(before.indexOf('tomato')).toBeLessThan(before.indexOf('garlic'));
    fireEvent.click(within(screen.getByTestId(`${P}-proteins`)).getByRole('button', { name: 'chicken' }));
    const after = suggestKeys();
    expect(after.indexOf('garlic')).toBeLessThan(after.indexOf('tomato'));
  });

  it('with a technique the suggestions lead with what an unticked required part needs', () => {
    renderInvent({ kitchen: ['butter', 'egg yolk'], assumeBasics: false });
    start('butter');
    chooseTechnique('Hollandaise');
    expect(suggestKeys()[0]).toBe('egg yolk');
  });
});

describe('InventSauce — flavor profile', () => {
  it('renders for the list, naming what has no data', () => {
    const probs = (o) => ({ ...Object.fromEntries(AXES.map((a) => [a, 0])), ...o });
    const nodes = new Map([['butter', { gnnProbs: probs({ sweet: 0.5, odor_fatty: 0.8 }) }], ['tomato', { gnnProbs: probs({ sour: 0.7, umami: 0.4 }) }]]);
    renderInvent({ nodes });
    start('butter');
    addIng('tomato');
    addIng('cumin');
    expect(screen.getByTestId(`${P}-profile`)).toBeInTheDocument();
    expect(screen.getByTestId(`${P}-profile-bar-sour`)).toBeInTheDocument();
    expect(screen.getByTestId(`${P}-profile-summary`)).toHaveTextContent(/This sauce/);
    expect(screen.getByTestId(`${P}-profile-uncounted`)).toHaveTextContent('cumin');
  });

  it('still renders with no profile data at all', () => {
    renderInvent({ nodes: null });
    start('butter');
    expect(screen.getByTestId(`${P}-profile`)).toBeInTheDocument();
  });
});

describe('InventSauce — name and save', () => {
  it('has no save row without onSave', () => {
    renderInvent();
    start('butter');
    expect(screen.queryByTestId(`${P}-namesave`)).toBeNull();
  });

  it('Save is disabled until there is a name and two ingredients; onSave gets name, lines, technique and protein', async () => {
    const onSave = vi.fn().mockResolvedValue({ status: 'saved' });
    renderInvent({ onSave });
    start('butter');
    const save = screen.getByTestId(`${P}-namesave-save`);
    expect(save).toBeDisabled();
    fireEvent.change(screen.getByTestId(`${P}-namesave-name`), { target: { value: 'My butter sauce' } });
    expect(save).toBeDisabled(); // one ingredient
    addIng('egg yolk');
    addIng('lemon juice');
    fireEvent.click(within(screen.getByTestId(`${P}-proteins`)).getByRole('button', { name: 'salmon' }));
    chooseTechnique('Hollandaise');
    expect(save).not.toBeDisabled();
    fireEvent.click(save);
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    const arg = onSave.mock.calls[0][0];
    expect(arg).toMatchObject({ kind: 'sauce', name: 'My butter sauce', category: 'Hollandaise', protein: 'salmon' });
    expect(arg.id).toBeUndefined();
    expect(arg.lines.map((l) => l.key).sort()).toEqual(['butter', 'egg yolk', 'lemon juice']);
    expect(arg.lines.find((l) => l.key === 'butter')).toMatchObject({ amount: '½ cup (115 g), melted', role: 'Fat' });
    expect(arg.method).toMatch(/lecithin/);
    await waitFor(() => expect(screen.getByTestId(`${P}-namesave-status`)).toHaveAttribute('data-status', 'saved'));
  });

  it('with no technique the category is null and there is no method', async () => {
    const onSave = vi.fn().mockResolvedValue({ status: 'signin', message: 'Sign in first.' });
    renderInvent({ onSave });
    start('butter');
    addIng('garlic');
    fireEvent.change(screen.getByTestId(`${P}-namesave-name`), { target: { value: 'Garlic butter' } });
    fireEvent.click(screen.getByTestId(`${P}-namesave-save`));
    await waitFor(() => expect(onSave).toHaveBeenCalled());
    expect(onSave.mock.calls[0][0].category).toBeNull();
    expect(onSave.mock.calls[0][0].method).toBeUndefined();
    expect(onSave.mock.calls[0][0].protein).toBeUndefined();
    await waitFor(() => expect(screen.getByTestId(`${P}-namesave-status`)).toHaveTextContent('Sign in first.'));
  });

  it('a rejected save shows an error and keeps the build', async () => {
    const onSave = vi.fn().mockRejectedValue(new Error('offline'));
    renderInvent({ onSave });
    start('butter');
    addIng('garlic');
    fireEvent.change(screen.getByTestId(`${P}-namesave-name`), { target: { value: 'x' } });
    fireEvent.click(screen.getByTestId(`${P}-namesave-save`));
    await waitFor(() => expect(screen.getByTestId(`${P}-namesave-status`)).toHaveAttribute('data-status', 'error'));
    expect(listKeys()).toEqual(['butter', 'garlic']);
  });

  it('editItem opens on that sauce with its name and calls onSave with the same id', async () => {
    const onSave = vi.fn().mockResolvedValue({ status: 'saved' });
    renderInvent({
      onSave,
      editItem: {
        id: 'inv-1', name: 'Gran’s hollandaise', baseline: { category: 'Hollandaise', protein: 'salmon' },
        lines: [{ key: 'butter', amount: '100 g', role: 'Fat' }, { key: 'egg yolk', amount: '3', role: 'Thickener' }, { key: 'lemon juice', amount: '', role: 'Acid' }],
      },
    });
    expect(screen.queryByTestId(`${P}-start`)).toBeNull();
    expect(listKeys().sort()).toEqual(['butter', 'egg yolk', 'lemon juice']);
    expect(screen.getByTestId(`${P}-namesave-name`)).toHaveValue('Gran’s hollandaise');
    expect(screen.getByTestId(`${L}-amount-butter`)).toHaveValue('100 g');
    expect(screen.getByTestId(`${P}-checklist`)).toHaveTextContent('An Emulsion needs');
    expect(within(screen.getByTestId(`${P}-proteins`)).getByRole('button', { name: 'salmon' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByTestId(`${P}-namesave-save`));
    await waitFor(() => expect(onSave).toHaveBeenCalled());
    expect(onSave.mock.calls[0][0]).toMatchObject({ id: 'inv-1', name: 'Gran’s hollandaise', category: 'Hollandaise', protein: 'salmon' });
  });
});

describe('InventSauce — exits and the seed', () => {
  it('Open in Recipe Notebook passes the list and the protein', () => {
    const onOpenRecipeLab = vi.fn();
    renderInvent({ onOpenRecipeLab });
    start('butter');
    addIng('tarragon');
    fireEvent.click(within(screen.getByTestId(`${P}-proteins`)).getByRole('button', { name: 'salmon' }));
    fireEvent.click(screen.getByTestId(`${P}-notebook`));
    const arg = onOpenRecipeLab.mock.calls[0][0];
    expect(arg).toEqual(['butter', 'tarragon', proteinIngredient('salmon')]);
  });

  it('Start over returns to step 1, cleared', () => {
    renderInvent({ onSave: vi.fn() });
    start('butter');
    addIng('egg yolk');
    fireEvent.change(screen.getByTestId(`${P}-namesave-name`), { target: { value: 'x' } });
    chooseTechnique('Hollandaise');
    fireEvent.click(screen.getByTestId(`${P}-restart`));
    expect(screen.getByTestId(`${P}-start`)).toBeInTheDocument();
    expect(screen.queryByTestId(`${L}-line`)).toBeNull();
    expect(screen.queryByTestId(`${P}-checklist`)).toBeNull();
    start('tomato');
    expect(listKeys()).toEqual(['tomato']);
    expect(screen.getByTestId(`${P}-category-toggle`)).not.toHaveTextContent('Emulsion');
  });

  it('Back closes; an empty pantry is said so', () => {
    const onClose = vi.fn();
    renderInvent({ onClose, kitchen: [] });
    expect(screen.getByTestId(`${P}-source`)).toHaveTextContent('Your pantry is empty');
    fireEvent.click(screen.getByTestId(`${P}-close`));
    expect(onClose).toHaveBeenCalled();
  });

  it('opens from a search seed with the searched ingredients as the list, and the best-fit style only recommended', () => {
    renderInvent({ seed: { styleId: 'Tomato', protein: 'chicken', pinned: [{ key: 'garlic', source: 'search' }, { key: 'tomato', source: 'search' }] } });
    expect(screen.queryByTestId(`${P}-start`)).toBeNull();
    expect(listKeys()).toEqual(['tomato', 'garlic']); // the anchor goes first
    expect(within(screen.getByTestId(`${P}-proteins`)).getByRole('button', { name: 'chicken' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId(`${L}`)).toHaveTextContent('from your search');
    expect(screen.queryByTestId(`${P}-checklist`)).toBeNull(); // not applied
    expect(screen.getByTestId(`${P}-hint`)).toHaveTextContent('Tomato simmer');
  });

  it('a seed that names a sauce applies its technique', () => {
    renderInvent({ seed: { styleId: 'Hollandaise', fromName: true, pinned: ['egg yolk', 'butter', 'lemon juice'].map((key) => ({ key, source: 'search' })) } });
    expect(listKeys().sort()).toEqual(['butter', 'egg yolk', 'lemon juice']);
    expect(screen.getByTestId(`${P}-checklist`)).toHaveTextContent('An Emulsion needs');
    expect(screen.queryByTestId(`${P}-hint`)).toBeNull();
  });

  it('a seed with only a protein still asks step 1 and keeps the protein', () => {
    renderInvent({ seed: { styleId: 'Béchamel', protein: 'chicken', pinned: [] } });
    expect(screen.getByTestId(`${P}-start`)).toBeInTheDocument();
    start('cream');
    expect(within(screen.getByTestId(`${P}-proteins`)).getByRole('button', { name: 'chicken' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('never calls fillRequired', async () => {
    const src = fs.readFileSync(path.resolve(__dirname, '../InventSauce.jsx'), 'utf8');
    expect(src).not.toMatch(/fillRequired\(/);
    expect(src).not.toMatch(/InventSlots/);
  });
});
