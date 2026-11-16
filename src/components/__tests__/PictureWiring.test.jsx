// @vitest-environment jsdom
// PICTURE-4: the picture chooser in the save step of an invent panel and when editing, and PictureView
// (a drawing, a chalk picture read lazily, an unknown id, the small-size rule).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import InventSauce from '../InventSauce.jsx';
import PictureView, { clearPictureCache, MIN_PICTURE_SIZE } from '../PictureView.jsx';
import { ShareOwnContext } from '../shareOwnContext.js';
import { buildCategoryMap } from '../../data/saucePantry.js';

const meta = [
  { name: 'butter', category: 'Fat' }, { name: 'olive oil', category: 'Fat' },
  { name: 'flour', category: 'Thickener' }, { name: 'milk', category: 'Liquid' }, { name: 'cream', category: 'Liquid' },
  { name: 'garlic', category: 'Aromatic' }, { name: 'nutmeg', category: 'Seasoning' },
];
const catMap = buildCategoryMap(meta);
const families = [{ id: 0, name: 'Béchamel', color: '#f5f0d6' }];
const sauces = [{ name: 'Béchamel', family_id: 0, ingredients: ['butter', 'flour', 'milk', 'nutmeg'], proteins: ['chicken'] }];
const P = 'sauce-invent';
const L = `${P}-list`;


const renderPanel = (props = {}) => render(
  <InventSauce kitchen={['butter', 'cream', 'garlic']} sauces={sauces} families={families} meta={meta} catMap={catMap} wineStyles={null} onClose={vi.fn()} {...props} />,
);
const start = (text) => {
  fireEvent.change(screen.getByTestId(`${P}-start-input`), { target: { value: text } });
  fireEvent.click(screen.getByTestId(`${P}-start-go`));
};
const addIng = (text) => {
  fireEvent.change(screen.getByTestId(`${L}-add-input`), { target: { value: text } });
  fireEvent.click(screen.getByTestId(`${L}-add`));
};
const named = (name = 'My butter sauce') => {
  start('butter');
  addIng('cream');
  fireEvent.change(screen.getByTestId(`${P}-namesave-name`), { target: { value: name } });
};
const pick = (id) => {
  fireEvent.click(screen.getByTestId(`${P}-namesave-picture-open`));
  fireEvent.click(screen.getByRole('radio', { name: 'A drawing' }));
  fireEvent.click(screen.getByRole('radio', { name: id }));
};

beforeEach(() => { clearPictureCache(); });
afterEach(() => { cleanup(); });

describe('invent panel: the picture in the save step', () => {
  it('a recipe without a picture sends no picture key and shows only a quiet "Add a picture (optional)" row', async () => {
    const onSave = vi.fn().mockResolvedValue({ status: 'saved', message: 'Saved' });
    renderPanel({ onSave });
    named();
    expect(screen.getByTestId(`${P}-namesave-picture-open`).textContent).toBe('Add a picture (optional)');
    fireEvent.click(screen.getByTestId(`${P}-namesave-save`));
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect('picture' in onSave.mock.calls[0][0]).toBe(false);
  });

  it('choosing a drawing saves it with the item', async () => {
    const onSave = vi.fn().mockResolvedValue({ status: 'saved', message: 'Saved' });
    renderPanel({ onSave });
    named();
    pick('Jar');
    fireEvent.click(screen.getByTestId(`${P}-namesave-picture-done`));
    expect(screen.getByTestId(`${P}-namesave-picture-open`).textContent).toBe('Change the picture');
    expect(screen.getByTestId(`${P}-namesave-picture-thumb`)).toBeTruthy();
    fireEvent.click(screen.getByTestId(`${P}-namesave-save`));
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave.mock.calls[0][0].picture).toEqual({ kind: 'icon', icon: 'sauce:jar' });
  });

  it('a failed picture write shows ONE plain line and the item is still reported saved', async () => {
    const reason = 'The picture could not be saved, so it was left out. You can add it again later.';
    const onSave = vi.fn().mockResolvedValue({ status: 'saved', message: 'Saved to your sauces', pictureReason: reason });
    renderPanel({ onSave });
    named();
    pick('Saucepan');
    fireEvent.click(screen.getByTestId(`${P}-namesave-save`));
    const note = await screen.findByTestId(`${P}-namesave-picture-note`);
    expect(note.textContent).toBe(reason);
    expect(screen.getAllByTestId(`${P}-namesave-picture-note`)).toHaveLength(1);
    expect(screen.getByTestId(`${P}-namesave-status`).getAttribute('data-status')).toBe('saved');
  });
});

describe('editing a saved item: the picture it has, changed and cleared', () => {
  const edit = (picture) => ({
    id: 'inv-9', name: 'Old sauce', baseline: { category: null }, picture,
    lines: [{ key: 'butter', amount: '2 tbsp' }, { key: 'cream', amount: '1 cup' }],
  });

  it('keeps the item\'s own picture when untouched (no picture key is sent), and shows it', async () => {
    const onSave = vi.fn().mockResolvedValue({ status: 'saved', message: 'Saved' });
    renderPanel({ onSave, editItem: edit({ kind: 'icon', icon: 'sauce:bowl', v: 1 }) });
    expect(screen.getByTestId(`${P}-namesave-picture-open`).textContent).toBe('Change the picture');
    expect(screen.getByTestId(`${P}-namesave-picture-thumb`).querySelector('[data-picture="sauce:bowl"]')).toBeTruthy();
    fireEvent.click(screen.getByTestId(`${P}-namesave-save`));
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect('picture' in onSave.mock.calls[0][0]).toBe(false);
  });

  it('changes it', async () => {
    const onSave = vi.fn().mockResolvedValue({ status: 'saved', message: 'Saved' });
    renderPanel({ onSave, editItem: edit({ kind: 'icon', icon: 'sauce:bowl', v: 1 }) });
    fireEvent.click(screen.getByTestId(`${P}-namesave-picture-open`));
    expect(screen.getByRole('radio', { name: 'Bowl' }).getAttribute('aria-checked')).toBe('true');
    fireEvent.click(screen.getByRole('radio', { name: 'Bottle' }));
    fireEvent.click(screen.getByTestId(`${P}-namesave-save`));
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave.mock.calls[0][0].picture).toEqual({ kind: 'icon', icon: 'sauce:bottle' });
  });

  it('clears it with "No picture" (null, not a missing key)', async () => {
    const onSave = vi.fn().mockResolvedValue({ status: 'saved', message: 'Saved' });
    renderPanel({ onSave, editItem: edit({ kind: 'icon', icon: 'sauce:bowl', v: 1 }) });
    fireEvent.click(screen.getByTestId(`${P}-namesave-picture-open`));
    fireEvent.click(screen.getByRole('radio', { name: 'No picture' }));
    fireEvent.click(screen.getByTestId(`${P}-namesave-save`));
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave.mock.calls[0][0].picture).toBeNull();
  });
});

describe('PictureView', () => {
  const ctx = { auth: { user: { uid: 'u1' } } };
  const wrap = (ui) => <ShareOwnContext.Provider value={ctx}>{ui}</ShareOwnContext.Provider>;

  it('draws a drawing from the registry, with no read', () => {
    const load = vi.fn();
    render(<PictureView picture={{ kind: 'icon', icon: 'glass:coupe' }} size={96} load={load} />);
    expect(screen.getByTestId('picture-view').getAttribute('data-picture-kind')).toBe('icon');
    expect(document.querySelector('[data-picture="glass:coupe"]')).toBeTruthy();
    expect(load).not.toHaveBeenCalled();
  });

  it('an id the registry does not know draws the neutral fallback, not an error', () => {
    render(<PictureView picture={{ kind: 'icon', icon: 'glass:nope' }} size={96} />);
    expect(document.querySelector('[data-picture="fallback"]')).toBeTruthy();
  });

  it('a chalk picture is read when the card mounts (not before), once, and shown', async () => {
    const load = vi.fn().mockResolvedValue({ dataUrl: 'data:image/jpeg;base64,AAAA', w: 600, h: 600 });
    expect(load).not.toHaveBeenCalled();
    const { unmount } = render(wrap(<PictureView picture={{ kind: 'chalk', v: 5 }} itemId="inv-1" size={96} load={load} />));
    expect(screen.getByTestId('picture-view').getAttribute('data-picture-kind')).toBe('loading');
    await waitFor(() => expect(screen.getByTestId('picture-view').getAttribute('data-picture-kind')).toBe('chalk'));
    expect(screen.getByTestId('picture-view').querySelector('img').getAttribute('src')).toBe('data:image/jpeg;base64,AAAA');
    expect(load).toHaveBeenCalledTimes(1);
    expect(load.mock.calls[0][0]).toMatchObject({ itemId: 'inv-1', uid: 'u1' });
    unmount();
    // A second card for the same item and version comes from memory.
    render(wrap(<PictureView picture={{ kind: 'chalk', v: 5 }} itemId="inv-1" size={96} load={load} />));
    await waitFor(() => expect(screen.getByTestId('picture-view').getAttribute('data-picture-kind')).toBe('chalk'));
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('a changed picture (new version) is read again', async () => {
    const load = vi.fn().mockResolvedValue({ dataUrl: 'data:image/jpeg;base64,AAAA', w: 600, h: 600 });
    const { rerender } = render(wrap(<PictureView picture={{ kind: 'chalk', v: 1 }} itemId="inv-1" size={96} load={load} />));
    await waitFor(() => expect(load).toHaveBeenCalledTimes(1));
    rerender(wrap(<PictureView picture={{ kind: 'chalk', v: 2 }} itemId="inv-1" size={96} load={load} />));
    await waitFor(() => expect(load).toHaveBeenCalledTimes(2));
  });

  it('a shared copy is read by share id and needs no account', async () => {
    const load = vi.fn().mockResolvedValue({ dataUrl: 'data:image/jpeg;base64,BBBB', w: 600, h: 600 });
    render(<PictureView picture={{ kind: 'chalk' }} shareId="abcde23456" size={96} load={load} />);
    await waitFor(() => expect(screen.getByTestId('picture-view').getAttribute('data-picture-kind')).toBe('chalk'));
    expect(load.mock.calls[0][0]).toMatchObject({ shareId: 'abcde23456' });
  });

  it('a chalk picture that cannot be read draws nothing once the read is over (no broken image)', async () => {
    const load = vi.fn().mockResolvedValue(null);
    render(wrap(<PictureView picture={{ kind: 'chalk', v: 1 }} itemId="inv-2" size={96} load={load} />));
    await waitFor(() => expect(screen.queryByTestId('picture-view')).toBeNull());
    expect(document.querySelector('img')).toBeNull();
  });

  it('draws nothing below the small-size limit (the drawings turn into faint shapes under 40px)', () => {
    expect(MIN_PICTURE_SIZE).toBe(40);
    const { container } = render(<PictureView picture={{ kind: 'icon', icon: 'dish:pasta' }} size={24} />);
    expect(container.firstChild).toBeNull();
    cleanup();
    render(<PictureView picture={{ kind: 'icon', icon: 'dish:pasta' }} size={40} />);
    expect(screen.getByTestId('picture-view')).toBeTruthy();
  });

  it('nothing for an item with no picture', () => {
    const { container } = render(<PictureView picture={null} size={96} />);
    expect(container.firstChild).toBeNull();
  });
});
