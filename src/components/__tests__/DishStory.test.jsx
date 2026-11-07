// @vitest-environment jsdom
// STORIES-1 — the "About this dish" section renders with and without a story,
// with and without a photo, in the Cookbook popup and on a lab card.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, within, waitFor, fireEvent } from '@testing-library/react';
import DishStory from '../DishStory.jsx';
import LabNodeCard from '../LabNodeCard.jsx';
import { RecipeDetail } from '../CookbookLab.jsx';
import { SEED_RECIPES } from '../../data/seedRecipes.js';
import { loadDishStories, storyFor, _resetDishStories } from '../../data/dishStories.js';

vi.mock('../MultiAxisRadarStack.jsx', () => ({ default: () => null }));

const PHOTO = {
  src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a1/Paella.jpg/500px-Paella.jpg',
  w: 500, h: 375,
  page: 'https://commons.wikimedia.org/wiki/File:Paella.jpg',
  artist: 'Jane Cook',
  license: 'CC BY-SA 4.0',
  licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0',
};
const DATA = {
  _meta: {},
  recipes: { paella: { title: 'Paella', text: 'Paella is a rice dish from Valencia.', url: 'https://en.wikipedia.org/wiki/Paella', photo: PHOTO } },
  sauces: { Béchamel: { title: 'Béchamel sauce', text: 'Béchamel is a French mother sauce.', url: 'https://en.wikipedia.org/wiki/B%C3%A9chamel_sauce' } },
  cocktails: {},
  wines: {},
};

beforeEach(() => {
  _resetDishStories(null);
  if (typeof globalThis.ResizeObserver === 'undefined') {
    globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  }
});
afterEach(() => { _resetDishStories(null); vi.unstubAllGlobals(); });

describe('dishStories loader', () => {
  it('fetches once, caches, and looks items up by kind', async () => {
    const fetchImpl = vi.fn(async () => ({ ok: true, json: async () => DATA }));
    await Promise.all([loadDishStories(fetchImpl), loadDishStories(fetchImpl)]);
    await loadDishStories(fetchImpl);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl.mock.calls[0][0]).toMatch(/data\/dish_stories\.json$/);
    expect(storyFor('recipe', 'paella').title).toBe('Paella');
    expect(storyFor('sauce', 'Béchamel').text).toMatch(/mother sauce/);
    expect(storyFor('cocktail', 'Negroni')).toBeNull();
    expect(storyFor('recipe', 'toString')).toBeNull(); // no prototype leaks
  });
  it('is fail-safe: a 404 or a network error means no stories, and a later call retries', async () => {
    expect(await loadDishStories(async () => ({ ok: false }))).toBeNull();
    expect(await loadDishStories(async () => { throw new Error('offline'); })).toBeNull();
    expect(storyFor('recipe', 'paella')).toBeNull();
    await loadDishStories(async () => ({ ok: true, json: async () => DATA }));
    expect(storyFor('recipe', 'paella')).not.toBeNull();
  });
});

describe('<DishStory>', () => {
  it('renders photo, story and full credit line', () => {
    render(<DishStory kind="recipe" story={DATA.recipes.paella} name="Paella" />);
    const sec = screen.getByRole('region', { name: 'About this dish' });
    const img = within(sec).getByRole('img', { name: 'Photo of paella' });
    expect(img).toHaveAttribute('loading', 'lazy');
    expect(img).toHaveAttribute('width', '500');
    expect(img).toHaveAttribute('height', '375');
    // fixed aspect box before the image loads → no layout jump
    expect(screen.getByTestId('dish-story-photo')).toHaveAttribute('data-aspect', '1.333');
    expect(sec).toHaveTextContent('Paella is a rice dish from Valencia.');
    const credit = screen.getByTestId('dish-story-credit');
    expect(credit).toHaveTextContent('Text: Wikipedia (CC BY-SA) · Photo: Jane Cook, CC BY-SA 4.0');
    expect(within(credit).getByRole('link', { name: 'Wikipedia' })).toHaveAttribute('href', DATA.recipes.paella.url);
    expect(within(credit).getByRole('link', { name: 'Jane Cook' })).toHaveAttribute('href', PHOTO.page);
    expect(within(credit).getByRole('link', { name: 'CC BY-SA 4.0' })).toHaveAttribute('href', PHOTO.licenseUrl);
  });
  it('story without a photo: text and text credit only', () => {
    render(<DishStory kind="sauce" story={DATA.sauces['Béchamel']} />);
    expect(screen.getByRole('region', { name: 'About this sauce' })).toBeInTheDocument();
    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.getByTestId('dish-story-credit')).toHaveTextContent(/^Text: Wikipedia \(CC BY-SA\)$/);
  });
  it('drops the photo (keeps the text) when the image fails to load', () => {
    render(<DishStory kind="recipe" story={DATA.recipes.paella} name="Paella" />);
    fireEvent.error(screen.getByRole('img'));
    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.getByTestId('dish-story-text')).toBeInTheDocument();
  });
  it('renders nothing when there is no story', () => {
    const { container } = render(<DishStory kind="cocktail" story={null} />);
    expect(container).toBeEmptyDOMElement();
  });
  it('loads lazily from the shared file when no story is passed', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => DATA })));
    render(<DishStory kind="recipe" storyKey="paella" name="Paella" />);
    expect(await screen.findByRole('img', { name: 'Photo of paella' })).toBeInTheDocument();
  });
});

describe('cards with and without a story', () => {
  const paella = SEED_RECIPES.find((r) => r.id === 'paella');
  const ctx = { graph: { nodes: new Map(paella.ingredients.map((n) => [n, { name: n }])) } };

  it('Cookbook popup shows "About this dish" when the recipe has a story', async () => {
    _resetDishStories(DATA);
    render(<RecipeDetail recipe={paella} ctx={ctx} onClose={() => {}} />);
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByRole('region', { name: 'About this dish' })).toHaveTextContent('rice dish');
    expect(within(dialog).getByRole('img', { name: 'Photo of paella' })).toBeInTheDocument();
  });
  it('Cookbook popup renders cleanly without a story', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false })));
    const bolo = SEED_RECIPES.find((r) => r.id === 'beef-bolognese');
    render(<RecipeDetail recipe={bolo} ctx={ctx} onClose={() => {}} />);
    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalled());
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.queryByTestId('dish-story')).toBeNull();
  });
  it('sauce card (LabNodeCard child) with and without a story', () => {
    _resetDishStories(DATA);
    const card = (name) => (
      <LabNodeCard kind="sauce" name={name} ingredients={['butter', 'flour', 'milk']} onSelect={() => {}} onClose={() => {}}>
        <DishStory kind="sauce" storyKey={name} name={name} />
      </LabNodeCard>
    );
    const { unmount } = render(card('Béchamel'));
    expect(screen.getByRole('region', { name: 'About this sauce' })).toHaveTextContent('mother sauce');
    unmount();
    render(card('House Sauce'));
    expect(screen.getByTestId('lab-node-card')).toBeInTheDocument();
    expect(screen.queryByTestId('dish-story')).toBeNull();
  });
});
