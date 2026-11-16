// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within, cleanup } from '@testing-library/react';
import RecipePicture from '../RecipePicture.jsx';
import { PictureArt, picturesFor, allPictureIds, isPictureId } from '../pictureArt.jsx';
import { DISH_ART_KINDS } from '../chalkArt.jsx';
import { CHALK_DEFAULTS, ChalkCancelled } from '../../data/chalkFilter.js';
import { cropSize, cropCentre } from '../../data/pictureCrop.js';

function makeFilter({ failLoad = false } = {}) {
  const runs = [];
  const f = {
    runs,
    loadPhoto: vi.fn(async () => {
      if (failLoad) throw new Error('decode');
      return { data: new Uint8ClampedArray(8 * 6 * 4), width: 8, height: 6 };
    }),
    runChalk: vi.fn((image, settings, { onProgress } = {}) => {
      const run = { image, settings, cancel: vi.fn(), onProgress };
      run.promise = new Promise((resolve, reject) => {
        run.resolve = () => resolve({ data: new Uint8ClampedArray(image.width * image.height * 4), width: image.width, height: image.height });
        run.reject = reject;
      });
      run.cancel.mockImplementation(() => run.reject(new ChalkCancelled()));
      runs.push(run);
      return { promise: run.promise, cancel: run.cancel };
    }),
    toCanvas: vi.fn(() => document.createElement('canvas')),
    encodeChalk: vi.fn(async () => ({ blob: new Blob(['x'], { type: 'image/jpeg' }), mime: 'image/jpeg', w: 600, h: 600, bytes: 1 })),
  };
  return f;
}

const photo = () => new File(['x'], 'p.jpg', { type: 'image/jpeg' });

async function choosePhoto(filter, props = {}) {
  const onChange = vi.fn();
  render(<RecipePicture kind="cocktail" onChange={onChange} filter={filter} debounceMs={0} {...props} />);
  fireEvent.click(screen.getByRole('radio', { name: 'A photo as chalk' }));
  fireEvent.change(screen.getByLabelText('Photo to turn into chalk'), { target: { files: [photo()] } });
  await waitFor(() => expect(filter.runs.length).toBe(1));
  return onChange;
}

beforeEach(() => {
  URL.createObjectURL = vi.fn(() => 'blob:fake');
  URL.revokeObjectURL = vi.fn();
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('pictureArt registry', () => {
  it('pins the ids so a rename cannot orphan stored pictures', () => {
    expect(picturesFor('cocktail').map((p) => p.id)).toEqual([
      'glass:coupe', 'glass:rocks', 'glass:highball', 'glass:flute', 'glass:martini', 'glass:mug',
    ]);
    expect(picturesFor('sauce').map((p) => p.id)).toEqual(['sauce:pan', 'sauce:jar', 'sauce:bowl', 'sauce:bottle']);
    expect(picturesFor('dish').map((p) => p.id)).toEqual([
      'dish:soup', 'dish:noodles', 'dish:pasta', 'dish:rice', 'dish:curry', 'dish:stew', 'dish:grill', 'dish:fish',
      'dish:salad', 'dish:wok', 'dish:taco', 'dish:sandwich', 'dish:wrap', 'dish:dumpling', 'dish:dip', 'dish:tapas',
      'dish:baguette', 'dish:skillet', 'dish:pizza', 'dish:bake', 'dish:dessert', 'dish:veg', 'dish:plate',
    ]);
    expect(DISH_ART_KINDS.map((k) => `dish:${k}`)).toEqual(picturesFor('dish').map((p) => p.id));
  });

  it('draws every id, with a name for each', () => {
    for (const id of allPictureIds()) {
      const { container, unmount } = render(<PictureArt id={id} size={40} />);
      expect(container.querySelector('svg'), id).not.toBeNull();
      expect(container.querySelector('svg').getAttribute('data-picture') || container.querySelector('svg').getAttribute('data-kind'), id).toBeTruthy();
      expect(isPictureId(id)).toBe(true);
      unmount();
    }
    for (const kind of ['dish', 'cocktail', 'sauce']) {
      for (const p of picturesFor(kind)) expect(p.label.length).toBeGreaterThan(2);
    }
  });

  it('draws the fallback, never throws, for unknown or malformed ids', () => {
    for (const id of ['nope:x', 'glass:teapot', 'dish:unknown', 'glass', '', undefined, null, 7]) {
      const { container, unmount } = render(<PictureArt id={id} />);
      expect(container.querySelector('[data-picture="fallback"]'), String(id)).not.toBeNull();
      expect(isPictureId(id)).toBe(false);
      unmount();
    }
  });

  it('tints glasses with the drink colour', () => {
    const { container } = render(<PictureArt id="glass:flute" color="#ff0000" />);
    expect(container.querySelector('[data-part="liquid"]').getAttribute('fill')).toBe('#ff0000');
  });
});

describe('pictureCrop', () => {
  it('centre-crops to a square or 4:3 and leaves the original alone', () => {
    expect(cropSize(400, 300, 'square')).toEqual({ width: 300, height: 300 });
    expect(cropSize(300, 400, 'landscape')).toEqual({ width: 300, height: 225 });
    expect(cropSize(800, 300, 'landscape')).toEqual({ width: 400, height: 300 });
    const data = new Uint8ClampedArray(4 * 2 * 4);
    for (let x = 0; x < 4; x += 1) data[x * 4] = x + 1;
    const img = { data, width: 4, height: 2 };
    const out = cropCentre(img, 'square');
    expect([out.width, out.height]).toEqual([2, 2]);
    expect(out.data[0]).toBe(2);
    expect(img.width).toBe(4);
  });
});

describe('RecipePicture', () => {
  it('has a radio group of three choices with roving focus and arrow keys', () => {
    render(<RecipePicture kind="dish" onChange={() => {}} />);
    const group = screen.getByRole('radiogroup', { name: 'Picture for this recipe' });
    const radios = within(group).getAllByRole('radio');
    expect(radios.map((r) => r.textContent)).toEqual(['A drawing', 'A photo as chalk', 'No picture']);
    expect(radios.filter((r) => r.tabIndex === 0)).toHaveLength(1);
    fireEvent.click(radios[0]);
    fireEvent.keyDown(radios[0], { key: 'ArrowRight' });
    expect(screen.getByRole('radio', { name: 'A photo as chalk' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: 'A photo as chalk' }).tabIndex).toBe(0);
  });

  it('shows the right drawings per kind and returns a stable id', () => {
    const onChange = vi.fn();
    const { unmount } = render(<RecipePicture kind="cocktail" onChange={onChange} />);
    fireEvent.click(screen.getByRole('radio', { name: 'A drawing' }));
    const grid = screen.getByTestId('picture-grid');
    expect(within(grid).getAllByRole('radio').map((b) => b.getAttribute('aria-label'))).toEqual(
      ['Coupe', 'Rocks glass', 'Highball', 'Flute', 'Martini glass', 'Mug'],
    );
    fireEvent.click(within(grid).getByRole('radio', { name: 'Flute' }));
    expect(onChange).toHaveBeenCalledWith({ kind: 'icon', icon: 'glass:flute' });
    unmount();

    render(<RecipePicture kind="sauce" onChange={onChange} value={{ kind: 'icon', icon: 'sauce:jar' }} />);
    const sauce = screen.getByTestId('picture-grid');
    expect(within(sauce).getAllByRole('radio')).toHaveLength(4);
    expect(within(sauce).getByRole('radio', { name: 'Jar' })).toHaveAttribute('aria-checked', 'true');
    cleanup();

    render(<RecipePicture kind="dish" onChange={onChange} value={{ kind: 'icon', icon: 'dish:pasta' }} />);
    expect(within(screen.getByTestId('picture-grid')).getAllByRole('radio')).toHaveLength(DISH_ART_KINDS.length);
  });

  it('"No picture" returns null', () => {
    const onChange = vi.fn();
    render(<RecipePicture kind="dish" onChange={onChange} value={{ kind: 'icon', icon: 'dish:pasta' }} />);
    fireEvent.click(screen.getByRole('radio', { name: 'No picture' }));
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it('a chosen photo is drawn at the defaults and shown', async () => {
    const f = makeFilter();
    await choosePhoto(f);
    expect(f.runs[0].settings).toEqual(CHALK_DEFAULTS);
    expect(screen.getByTestId('picture-drawing')).toHaveTextContent('Drawing');
    f.runs[0].onProgress(0.5);
    await waitFor(() => expect(screen.getByTestId('picture-drawing')).toHaveTextContent('50%'));
    f.runs[0].resolve();
    await waitFor(() => expect(screen.queryByTestId('picture-drawing')).toBeNull());
    expect(screen.getByTestId('picture-preview').querySelector('canvas')).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Use this picture' })).toBeEnabled();
    expect(f.runs[0].image.width).toBe(6);
    expect(f.runs[0].image.height).toBe(6);
  });

  it('Adjust reveals six labelled sliders; a change re-runs and cancels the previous run; Reset restores defaults', async () => {
    const f = makeFilter();
    await choosePhoto(f);
    f.runs[0].resolve();
    await waitFor(() => expect(screen.queryByTestId('picture-drawing')).toBeNull());
    expect(screen.queryByTestId('picture-sliders')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Adjust' }));
    for (const name of ['Line weight', 'Fine detail', 'Shading', 'Colour', 'Chalk grain', 'Focus']) {
      expect(screen.getByLabelText(name)).toHaveAttribute('type', 'range');
    }
    expect(screen.getByLabelText('Focus')).toHaveValue('0');
    expect(screen.getByText('Fade the background')).toBeInTheDocument();
    expect(screen.getByLabelText('Shading')).toHaveValue('110');
    expect(screen.getByTestId('picture-slider-shading-value')).toHaveTextContent('110');

    fireEvent.change(screen.getByLabelText('Shading'), { target: { value: '60' } });
    await waitFor(() => expect(f.runs.length).toBe(2));
    expect(f.runs[1].settings.shading).toBe(60);
    // the second run starts while the first has not finished: the first is cancelled
    fireEvent.change(screen.getByLabelText('Colour'), { target: { value: '90' } });
    await waitFor(() => expect(f.runs.length).toBe(3));
    expect(f.runs[1].cancel).toHaveBeenCalled();
    expect(f.runs[2].settings).toMatchObject({ shading: 60, colour: 90 });
    // a cancelled run is not an error
    await Promise.resolve();
    expect(screen.queryByTestId('picture-message')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
    await waitFor(() => expect(f.runs.length).toBe(4));
    expect(f.runs[3].settings).toEqual(CHALK_DEFAULTS);
    expect(screen.getByLabelText('Shading')).toHaveValue('110');
  });

  it('Focus re-runs with focus in the settings, cancels the previous run, and Reset returns it to 0', async () => {
    const f = makeFilter();
    await choosePhoto(f);
    expect(f.runs[0].settings.focus).toBe(0);
    fireEvent.click(screen.getByRole('button', { name: 'Adjust' }));
    fireEvent.change(screen.getByLabelText('Focus'), { target: { value: '50' } });
    await waitFor(() => expect(f.runs.length).toBe(2));
    expect(f.runs[1].settings.focus).toBe(50);
    expect(f.runs[1].settings).toMatchObject({ weight: 5, grain: 5 });
    fireEvent.change(screen.getByLabelText('Focus'), { target: { value: '80' } });
    await waitFor(() => expect(f.runs.length).toBe(3));
    expect(f.runs[1].cancel).toHaveBeenCalled();
    expect(f.runs[2].settings.focus).toBe(80);
    expect(screen.getByTestId('picture-slider-focus-value')).toHaveTextContent('80');
    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
    await waitFor(() => expect(f.runs.length).toBe(4));
    expect(f.runs[3].settings.focus).toBe(0);
    expect(screen.getByLabelText('Focus')).toHaveValue('0');
  });

  it('the crop choice re-runs on a centre crop', async () => {
    const f = makeFilter();
    await choosePhoto(f);
    fireEvent.click(screen.getByRole('button', { name: 'Landscape' }));
    await waitFor(() => expect(f.runs.length).toBe(2));
    expect([f.runs[1].image.width, f.runs[1].image.height]).toEqual([8, 6]);
  });

  it('Use this picture returns the encoded result', async () => {
    const f = makeFilter();
    const onChange = await choosePhoto(f);
    expect(screen.getByRole('button', { name: 'Use this picture' })).toBeDisabled();
    f.runs[0].resolve();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Use this picture' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'Use this picture' }));
    await waitFor(() => expect(onChange).toHaveBeenCalledTimes(1));
    const arg = onChange.mock.calls[0][0];
    expect(arg).toMatchObject({ kind: 'chalk', mime: 'image/jpeg', w: 600, h: 600 });
    expect(arg.blob).toBeInstanceOf(Blob);
    expect(Object.keys(arg).sort()).toEqual(['blob', 'h', 'kind', 'mime', 'w']);
  });

  it('an unreadable file gets one plain sentence and the chooser stays usable', async () => {
    const f = makeFilter({ failLoad: true });
    render(<RecipePicture kind="cocktail" onChange={() => {}} filter={f} debounceMs={0} />);
    fireEvent.click(screen.getByRole('radio', { name: 'A photo as chalk' }));
    fireEvent.change(screen.getByLabelText('Photo to turn into chalk'), { target: { files: [photo()] } });
    await waitFor(() => expect(screen.getByTestId('picture-message')).toHaveTextContent("That file can't be opened as a picture here."));
    expect(f.runChalk).not.toHaveBeenCalled();
    f.loadPhoto.mockImplementationOnce(async () => ({ data: new Uint8ClampedArray(8 * 6 * 4), width: 8, height: 6 }));
    fireEvent.change(screen.getByLabelText('Photo to turn into chalk'), { target: { files: [photo()] } });
    await waitFor(() => expect(f.runs.length).toBe(1));
    expect(screen.queryByTestId('picture-message')).toBeNull();
    fireEvent.click(screen.getByRole('radio', { name: 'A drawing' }));
    expect(screen.getByTestId('picture-grid')).toBeInTheDocument();
  });

  it('picking another photo cancels the running conversion', async () => {
    const f = makeFilter();
    await choosePhoto(f);
    fireEvent.change(screen.getByLabelText('Photo to turn into chalk'), { target: { files: [photo()] } });
    await waitFor(() => expect(f.runs.length).toBe(2));
    expect(f.runs[0].cancel).toHaveBeenCalled();
  });

  it('revokes object URLs when the value changes and on unmount, and cancels a running job', async () => {
    const f = makeFilter();
    const blob = new Blob(['a']);
    const { rerender, unmount } = render(<RecipePicture kind="dish" onChange={() => {}} filter={f} value={{ kind: 'chalk', blob, mime: 'image/jpeg', w: 1, h: 1 }} />);
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('picture-current')).toHaveAttribute('src', 'blob:fake');
    rerender(<RecipePicture kind="dish" onChange={() => {}} filter={f} value={null} />);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:fake');
    unmount();

    const f2 = makeFilter();
    render(<RecipePicture kind="dish" onChange={() => {}} filter={f2} debounceMs={0} value={{ kind: 'chalk', blob, mime: 'image/jpeg', w: 1, h: 1 }} />);
    fireEvent.change(screen.getByLabelText('Photo to turn into chalk'), { target: { files: [photo()] } });
    await waitFor(() => expect(f2.runs.length).toBe(1));
    cleanup();
    expect(f2.runs[0].cancel).toHaveBeenCalled();
    expect((URL.revokeObjectURL).mock.calls.length).toBeGreaterThanOrEqual(2);
  });
});
