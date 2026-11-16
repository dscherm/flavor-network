// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import RecipePicture from '../RecipePicture.jsx';
import { ChalkCancelled } from '../../data/chalkFilter.js';
import { CutoutError } from '../../data/chalkCutout.js';

function makeFilter() {
  const runs = [];
  const cuts = [];
  const f = {
    runs,
    cuts,
    loadPhoto: vi.fn(async () => ({ data: new Uint8ClampedArray(8 * 6 * 4), width: 8, height: 6 })),
    runChalk: vi.fn((image, settings, opts = {}) => {
      const run = { image, settings, mask: opts.mask, cancel: vi.fn() };
      run.promise = new Promise((resolve, reject) => {
        run.resolve = () => resolve({ data: new Uint8ClampedArray(image.width * image.height * 4), width: image.width, height: image.height });
        run.reject = reject;
      });
      run.cancel.mockImplementation(() => run.reject(new ChalkCancelled()));
      runs.push(run);
      return { promise: run.promise, cancel: run.cancel };
    }),
    findSubject: vi.fn((image, opts = {}) => {
      const cut = { image, opts, cancel: vi.fn() };
      cut.promise = new Promise((resolve, reject) => { cut.resolve = resolve; cut.reject = reject; });
      cut.cancel.mockImplementation(() => cut.reject(new ChalkCancelled()));
      cuts.push(cut);
      return { promise: cut.promise, cancel: cut.cancel };
    }),
    toCanvas: vi.fn(() => document.createElement('canvas')),
    encodeChalk: vi.fn(async () => ({ blob: new Blob(['x'], { type: 'image/jpeg' }), mime: 'image/jpeg', w: 600, h: 600, bytes: 1 })),
  };
  return f;
}

const photo = () => new File(['x'], 'p.jpg', { type: 'image/jpeg' });
const cutButton = () => screen.getByRole('button', { name: /Remove background|Cancel cut-out/ });

async function openPhoto(filter) {
  const onChange = vi.fn();
  render(<RecipePicture kind="dish" onChange={onChange} filter={filter} debounceMs={0} />);
  fireEvent.click(screen.getByRole('radio', { name: 'A photo as chalk' }));
  fireEvent.change(screen.getByLabelText('Photo to turn into chalk'), { target: { files: [photo()] } });
  await waitFor(() => expect(filter.runs.length).toBe(1));
  filter.runs[0].resolve();
  await waitFor(() => expect(screen.getByRole('button', { name: 'Use this picture' })).not.toBeDisabled());
  return onChange;
}

let fetchSpy;
beforeEach(() => {
  URL.createObjectURL = vi.fn(() => 'blob:fake');
  URL.revokeObjectURL = vi.fn();
  fetchSpy = vi.fn(async () => { throw new Error('the picture chooser must not fetch'); });
  vi.stubGlobal('fetch', fetchSpy);
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('RecipePicture: Remove background (PICTURE-8)', () => {
  it('asks for nothing until the button is tapped; the first drawing has no mask; the limits are stated', async () => {
    const filter = makeFilter();
    await openPhoto(filter);
    expect(filter.findSubject).not.toHaveBeenCalled();
    expect(filter.runs[0].mask).toBeUndefined();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(screen.getByTestId('picture-cut-limits').textContent).toMatch(/Clear glass and busy backgrounds may cut badly/);
    expect(screen.getByTestId('picture-cut-limits').textContent).toMatch(/5 MB/);
    expect(cutButton()).toHaveAttribute('aria-pressed', 'false');
  });

  it('on a tap: shows the stages, then draws with the subject map, and never fetches by itself', async () => {
    const filter = makeFilter();
    await openPhoto(filter);
    fireEvent.click(cutButton());
    expect(filter.findSubject).toHaveBeenCalledTimes(1);
    const sent = filter.cuts[0].image;
    expect(sent.width).toBeGreaterThan(0);
    expect(screen.getByTestId('picture-cutting').textContent).toMatch(/Finding the subject/);
    filter.cuts[0].opts.onStage('loading');
    await waitFor(() => expect(screen.getByTestId('picture-cutting').textContent).toMatch(/about 5 MB, first time only/));
    expect(cutButton().textContent).toBe('Cancel cut-out');
    const mask = new Float32Array(sent.width * sent.height).fill(1);
    filter.cuts[0].resolve(mask);
    await waitFor(() => expect(filter.runs.length).toBe(2));
    expect(filter.runs[1].mask).toBe(mask);
    expect(screen.queryByTestId('picture-cutting')).toBeNull();
    expect(cutButton()).toHaveAttribute('aria-pressed', 'true');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('keeps the mask on later changes, and tapping again turns it off', async () => {
    const filter = makeFilter();
    await openPhoto(filter);
    fireEvent.click(cutButton());
    const mask = new Float32Array(48).fill(1);
    filter.cuts[0].resolve(mask);
    await waitFor(() => expect(filter.runs.length).toBe(2));
    filter.runs[1].resolve();
    fireEvent.click(screen.getByRole('button', { name: 'Adjust' }));
    fireEvent.change(document.getElementById('picture-slider-weight'), { target: { value: '7' } });
    await waitFor(() => expect(filter.runs.length).toBe(3));
    expect(filter.runs[2].mask).toBe(mask);
    expect(filter.runs[2].settings.weight).toBe(7);
    fireEvent.click(cutButton());
    await waitFor(() => expect(filter.runs.length).toBe(4));
    expect(filter.runs[3].mask).toBeUndefined();
    expect(cutButton()).toHaveAttribute('aria-pressed', 'false');
    // turning it on again reuses the map: no second search
    fireEvent.click(cutButton());
    await waitFor(() => expect(filter.runs.length).toBe(5));
    expect(filter.runs[4].mask).toBe(mask);
    expect(filter.findSubject).toHaveBeenCalledTimes(1);
  });

  it('cancel: stops the search, draws without a cut-out, no sentence', async () => {
    const filter = makeFilter();
    await openPhoto(filter);
    fireEvent.click(cutButton());
    fireEvent.click(cutButton());
    expect(filter.cuts[0].cancel).toHaveBeenCalled();
    await waitFor(() => expect(filter.runs.length).toBe(2));
    expect(filter.runs[1].mask).toBeUndefined();
    expect(screen.queryByTestId('picture-cutting')).toBeNull();
    expect(screen.queryByTestId('picture-message')).toBeNull();
    expect(cutButton()).toHaveAttribute('aria-pressed', 'false');
  });

  const failures = [
    ['no-wasm', /This browser can't run the cut-out, so the whole picture is drawn/],
    ['nothing', /couldn't find a clear subject in this photo, so the whole picture is drawn/],
    ['load', /cut-out couldn't run on this device, so the whole picture is drawn/],
    ['run', /cut-out couldn't run on this device, so the whole picture is drawn/],
  ];
  it.each(failures)('failure %s: its sentence, drawn without a cut-out, saving still works', async (code, sentence) => {
    const filter = makeFilter();
    const onChange = await openPhoto(filter);
    fireEvent.click(cutButton());
    filter.cuts[0].reject(new CutoutError(code));
    await waitFor(() => expect(screen.getByTestId('picture-message').textContent).toMatch(sentence));
    expect(screen.getByTestId('picture-message').textContent).toMatch(/You can still save it/);
    expect(cutButton()).toHaveAttribute('aria-pressed', 'false');
    await waitFor(() => expect(filter.runs.length).toBe(2));
    expect(filter.runs[1].mask).toBeUndefined();
    filter.runs[1].resolve();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Use this picture' })).not.toBeDisabled());
    fireEvent.click(screen.getByRole('button', { name: 'Use this picture' }));
    await waitFor(() => expect(onChange).toHaveBeenCalledTimes(1));
  });

  it('a search that throws at once (an unknown error) falls back with the general sentence', async () => {
    const filter = makeFilter();
    await openPhoto(filter);
    filter.findSubject.mockImplementation(() => { throw new Error('boom'); });
    fireEvent.click(cutButton());
    await waitFor(() => expect(screen.getByTestId('picture-message').textContent).toMatch(/cut-out couldn't run on this device/));
    await waitFor(() => expect(filter.runs.length).toBe(2));
  });

  it('saving while the cut-out is on stores only the picture: no cut-out setting or map', async () => {
    const filter = makeFilter();
    const onChange = await openPhoto(filter);
    fireEvent.click(cutButton());
    filter.cuts[0].resolve(new Float32Array(48).fill(1));
    await waitFor(() => expect(filter.runs.length).toBe(2));
    filter.runs[1].resolve();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Use this picture' })).not.toBeDisabled());
    fireEvent.click(screen.getByRole('button', { name: 'Use this picture' }));
    await waitFor(() => expect(onChange).toHaveBeenCalledTimes(1));
    const out = onChange.mock.calls[0][0];
    expect(Object.keys(out).sort()).toEqual(['blob', 'h', 'kind', 'mime', 'w']);
    expect(out.mime).toBe('image/jpeg');
    expect(JSON.stringify(Object.keys(filter.encodeChalk.mock.calls[0]))).toBe('["0"]');
  });

  it('choosing a different photo drops the old cut-out', async () => {
    const filter = makeFilter();
    await openPhoto(filter);
    fireEvent.click(cutButton());
    filter.cuts[0].resolve(new Float32Array(48).fill(1));
    await waitFor(() => expect(filter.runs.length).toBe(2));
    fireEvent.change(screen.getByLabelText('Photo to turn into chalk'), { target: { files: [photo()] } });
    await waitFor(() => expect(filter.runs.length).toBe(3));
    expect(filter.runs[2].mask).toBeUndefined();
    expect(cutButton()).toHaveAttribute('aria-pressed', 'false');
  });

  it('unmounting while searching cancels the search', async () => {
    const filter = makeFilter();
    await openPhoto(filter);
    fireEvent.click(cutButton());
    cleanup();
    expect(filter.cuts[0].cancel).toHaveBeenCalled();
  });
});
