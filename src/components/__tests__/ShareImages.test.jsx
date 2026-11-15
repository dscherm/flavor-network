// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import ShareImages from '../ShareImages.jsx';
import { ShareSheet } from '../ShareSheet.jsx';
import { resolveBuiltIn } from '../../data/sharedRecipe.js';
import { SEED_RECIPES } from '../../data/seedRecipes.js';
import { RECIPE_DETAILS } from '../../data/seedRecipeDetails.js';

const LINK = '/r/dish/beef-bolognese';
const data = { dishes: SEED_RECIPES, dishDetails: RECIPE_DETAILS };
const recipe = resolveBuiltIn('dish', 'beef-bolognese', data);
const fakeFiles = (n = 1) => Array.from({ length: n }, (_, i) => new File([new Uint8Array([1, 2, 3])], `beef-bolognese-card-${i + 1}.png`, { type: 'image/png' }));
// Real (non-placeholder) taste values for every ingredient, so the draw rule (FLAVOR-2) lets the chart through.
const NODES = new Map(recipe.lines.map((l, i) => [l.label || l.key, { gnnProbs: { sweet: 0.9 - i * 0.05, sour: 0.1 + i * 0.03, bitter: 0.1, salty: 0.1, umami: 0.8 } }]));

function setup(over = {}) {
  const renderFiles = over.renderFiles || vi.fn(async ({ count }) => fakeFiles(count === 'set' ? 3 : 1));
  const utils = render(<ShareImages link={LINK} recipe={recipe} nodes={NODES} origin="https://neuralflavor.web.app" renderFiles={renderFiles} {...over} />);
  return { renderFiles, ...utils };
}

afterEach(() => {
  cleanup();
  delete navigator.share;
  delete navigator.canShare;
  vi.restoreAllMocks();
});

describe('ShareImages', () => {
  it('draws ahead of the tap with the printed link, the chart bars and the chosen format', async () => {
    const { renderFiles } = setup();
    await waitFor(() => expect(renderFiles).toHaveBeenCalled());
    const arg = renderFiles.mock.calls[0][0];
    expect(arg.link).toBe('neuralflavor.web.app/r/dish/beef-bolognese');
    expect(arg.count).toBe('one');
    expect(arg.format).toBe('portrait');
    expect(arg.bars.length).toBeGreaterThan(0);
    fireEvent.click(screen.getByTestId('share-choice-format-tall'));
    fireEvent.click(screen.getByTestId('share-choice-count-set'));
    await waitFor(() => expect(renderFiles.mock.calls.at(-1)[0]).toMatchObject({ count: 'set', format: 'tall' }));
  });

  it('with navigator.canShare({ files }) true, Share images calls navigator.share with the files', async () => {
    navigator.canShare = vi.fn(() => true);
    navigator.share = vi.fn().mockResolvedValue(undefined);
    setup();
    const btn = await screen.findByText('Share images');
    await waitFor(() => expect(screen.getByTestId('share-images-action')).not.toBeDisabled());
    fireEvent.click(btn);
    expect(navigator.canShare).toHaveBeenCalledWith({ files: expect.any(Array) });
    expect(navigator.share).toHaveBeenCalledTimes(1);
    const arg = navigator.share.mock.calls[0][0];
    expect(arg.files).toHaveLength(1);
    expect(arg.files[0].type).toBe('image/png');
    expect(arg.title).toBe(recipe.name);
  });

  it('ignores a cancelled share', async () => {
    navigator.canShare = () => true;
    navigator.share = vi.fn().mockRejectedValue(Object.assign(new Error('x'), { name: 'AbortError' }));
    setup();
    await waitFor(() => expect(screen.getByTestId('share-images-action')).not.toBeDisabled());
    fireEvent.click(screen.getByTestId('share-images-action'));
    await waitFor(() => expect(navigator.share).toHaveBeenCalled());
    expect(screen.getByTestId('share-images-status').textContent).not.toMatch(/could not/i);
  });

  for (const [name, setupNav] of [['canShare absent', () => {}], ['canShare false', () => { navigator.canShare = () => false; }]]) {
    it(`${name}: Download images is offered and downloads each file`, async () => {
      setupNav();
      navigator.share = vi.fn();
      const created = [];
      const revoked = [];
      URL.createObjectURL = vi.fn((f) => { created.push(f.name); return `blob:${f.name}`; });
      URL.revokeObjectURL = vi.fn((u) => revoked.push(u));
      const clicks = [];
      vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function click() { clicks.push(this.download); });
      setup();
      const btn = await screen.findByText('Download images');
      expect(screen.queryByText('Share images')).toBeNull();
      fireEvent.click(screen.getByTestId('share-choice-count-set'));
      await waitFor(() => expect(screen.getByTestId('share-images-action')).not.toBeDisabled());
      await waitFor(() => expect(screen.getByTestId('share-images-action').textContent).toBe('Download images'));
      fireEvent.click(screen.getByTestId('share-images-action'));
      expect(navigator.share).not.toHaveBeenCalled();
      expect(clicks).toEqual(['beef-bolognese-card-1.png', 'beef-bolognese-card-2.png', 'beef-bolognese-card-3.png']);
      expect(created).toHaveLength(3);
      expect(btn).toBeTruthy();
    });
  }

  it('Copy caption copies the name, the full link and two hashtags', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    setup();
    fireEvent.click(screen.getByTestId('share-caption'));
    await waitFor(() => expect(writeText).toHaveBeenCalled());
    const text = writeText.mock.calls[0][0];
    expect(text).toContain('Beef Bolognese');
    expect(text).toContain('https://neuralflavor.web.app/r/dish/beef-bolognese');
    expect(text).toContain('#neuralflavor');
    expect(text).toContain('#cooking');
    await waitFor(() => expect(screen.getByTestId('share-caption-status').textContent).toBe('Caption copied'));
  });

  it('the Story line is there and its button copies the link', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    setup();
    expect(screen.getByTestId('share-images').textContent).toContain('Posting a Story? Copy the link and add it as a link sticker.');
    fireEvent.click(screen.getByTestId('share-story-copy'));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith('https://neuralflavor.web.app/r/dish/beef-bolognese'));
  });

  it('a drawing failure shows one plain line and leaves Copy link and the caption working', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    render(
      <ShareSheet open onClose={() => {}} recipe={recipe} link={LINK} origin="https://neuralflavor.web.app"
        imagesSlot={<ShareImages link={LINK} recipe={recipe} nodes={NODES} origin="https://neuralflavor.web.app" renderFiles={async () => { throw new Error('canvas broke'); }} />} />,
    );
    await waitFor(() => expect(screen.getByTestId('share-images-status').textContent).toMatch(/Could not draw the pictures/));
    expect(screen.getByTestId('share-images-action')).toBeDisabled();
    fireEvent.click(screen.getByTestId('share-copy'));
    await waitFor(() => expect(screen.getByTestId('share-copy-status').textContent).toBe('Link copied'));
    expect(writeText).toHaveBeenCalledWith('https://neuralflavor.web.app/r/dish/beef-bolognese');
    fireEvent.click(screen.getByTestId('share-caption'));
    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(2));
  });

  it('with no flavor data the cards are drawn without bars', async () => {
    const { renderFiles } = setup({ nodes: null });
    await waitFor(() => expect(renderFiles).toHaveBeenCalled());
    expect(renderFiles.mock.calls[0][0].bars).toEqual([]);
  });

  it('loads the recipe from the link when none is given, and renders nothing for a non-built-in link', async () => {
    const loadData = vi.fn(async () => data);
    const renderFiles = vi.fn(async () => fakeFiles());
    render(<ShareImages link={LINK} nodes={null} loadData={loadData} renderFiles={renderFiles} origin="https://neuralflavor.web.app" />);
    await waitFor(() => expect(renderFiles).toHaveBeenCalled());
    expect(loadData).toHaveBeenCalledWith('dish');
    cleanup();
    const { container } = render(<ShareImages link="/r/ab12cd" nodes={null} renderFiles={renderFiles} />);
    expect(container.textContent).toBe('');
  });

  it('the share sheet mounts it by default for a built-in link and not for an own item', async () => {
    const renderFiles = vi.fn(async () => fakeFiles());
    expect(renderFiles).not.toHaveBeenCalled();
    render(<ShareSheet open onClose={() => {}} recipe={recipe} link={LINK} origin="https://neuralflavor.web.app" />);
    expect(screen.getByTestId('share-images')).toBeTruthy();
    cleanup();
    render(<ShareSheet open onClose={() => {}} recipe={recipe} ownItem onPublish={() => {}} />);
    expect(screen.queryByTestId('share-images')).toBeNull();
  });
});
