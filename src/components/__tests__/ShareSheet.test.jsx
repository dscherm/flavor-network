// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { ShareSheet, ShareButton } from '../ShareSheet.jsx';
import LabNodeCard from '../LabNodeCard.jsx';
import { SHARE_OWN_ENABLED } from '../../data/shareTargets.js';
import { shareLinkFor, resolveBuiltIn, parseSharePath } from '../../data/sharedRecipe.js';
import { loadCodexV2 } from '../../data/cocktailCodexV2.js';
import { loadSauceCodex } from '../../data/sauceCodex.js';
import { SEED_RECIPES } from '../../data/seedRecipes.js';
import { RECIPE_DETAILS } from '../../data/seedRecipeDetails.js';

const recipe = { kind: 'cocktail', name: 'Tom & Jerry\'s "Special" \u{1F378}' };
const base = { open: true, onClose: () => {}, recipe, link: '/r/cocktail/negroni', origin: 'https://neuralflavor.web.app' };

afterEach(() => {
  cleanup();
  delete navigator.share;
  vi.restoreAllMocks();
});

describe('ShareSheet', () => {
  it('calls navigator.share with title, text and absolute url', async () => {
    navigator.share = vi.fn().mockResolvedValue(undefined);
    render(<ShareSheet {...base} />);
    fireEvent.click(screen.getByTestId('share-native'));
    expect(navigator.share).toHaveBeenCalledWith({
      title: recipe.name,
      text: `${recipe.name}, on Neural Flavor`,
      url: 'https://neuralflavor.web.app/r/cocktail/negroni',
    });
  });

  it('ignores a cancelled native share', async () => {
    navigator.share = vi.fn().mockRejectedValue(Object.assign(new Error('x'), { name: 'AbortError' }));
    render(<ShareSheet {...base} />);
    fireEvent.click(screen.getByTestId('share-native'));
    await waitFor(() => expect(navigator.share).toHaveBeenCalled());
    expect(screen.queryByTestId('share-copy-fallback')).toBeNull();
  });

  it('without navigator.share the fallback buttons still render', () => {
    render(<ShareSheet {...base} />);
    expect(screen.queryByTestId('share-native')).toBeNull();
    expect(screen.getByTestId('share-copy')).toBeTruthy();
    for (const k of ['x', 'facebook', 'pinterest', 'whatsapp']) {
      const a = screen.getByTestId(`share-${k}`);
      expect(a.getAttribute('target')).toBe('_blank');
      expect(a.getAttribute('rel')).toBe('noopener noreferrer');
      expect(a.getAttribute('href')).toContain(encodeURIComponent('https://neuralflavor.web.app/r/cocktail/negroni'));
    }
  });

  it('Copy link writes the absolute link and confirms', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    render(<ShareSheet {...base} />);
    fireEvent.click(screen.getByTestId('share-copy'));
    await waitFor(() => expect(screen.getByTestId('share-copy-status').textContent).toBe('Link copied'));
    expect(writeText).toHaveBeenCalledWith('https://neuralflavor.web.app/r/cocktail/negroni');
  });

  it('a clipboard failure shows the link as selectable text', async () => {
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: vi.fn().mockRejectedValue(new Error('no')) }, configurable: true });
    render(<ShareSheet {...base} />);
    fireEvent.click(screen.getByTestId('share-copy'));
    const field = await screen.findByTestId('share-link-field');
    expect(field.value).toBe('https://neuralflavor.web.app/r/cocktail/negroni');
    expect(field.readOnly).toBe(true);
    expect(screen.getByTestId('share-copy-status').textContent).toBe('');
  });

  it('closes on Escape, backdrop and the close button', () => {
    const onClose = vi.fn();
    render(<ShareSheet {...base} onClose={onClose} />);
    fireEvent.keyDown(window, { key: 'Escape' });
    fireEvent.click(screen.getByTestId('share-backdrop'));
    fireEvent.click(screen.getByTestId('share-close'));
    expect(onClose).toHaveBeenCalledTimes(3);
  });

  it('renders the images slot', () => {
    render(<ShareSheet {...base} imagesSlot={<span>pics</span>} />);
    expect(screen.getByTestId('share-images-slot').textContent).toBe('pics');
  });

  it('an own item gets no link and no network buttons', () => {
    render(<ShareSheet {...base} ownItem onPublish={() => {}} />);
    expect(screen.getByTestId('share-own')).toBeTruthy();
    expect(screen.queryByTestId('share-copy')).toBeNull();
    expect(screen.queryByTestId('share-x')).toBeNull();
  });

  it('loads no script', () => {
    render(<ShareSheet {...base} />);
    expect(document.querySelectorAll('script[src]').length).toBe(0);
  });
});

describe('ShareButton', () => {
  it('opens the sheet', () => {
    render(<ShareButton recipe={recipe} link="/r/dish/risotto-saffron" origin="https://x.app" />);
    expect(screen.queryByTestId('share-sheet')).toBeNull();
    fireEvent.click(screen.getByTestId('share-button'));
    expect(screen.getByTestId('share-sheet')).toBeTruthy();
  });
  it('shows nothing for a built-in item with no link, and a button for an own item now the flag is on', () => {
    expect(SHARE_OWN_ENABLED).toBe(true);
    const { container } = render(<ShareButton recipe={recipe} link="" />);
    expect(container.querySelector('button')).toBeNull();
    cleanup();
    render(<ShareButton recipe={recipe} ownItem link="" />);
    expect(screen.getByTestId('share-button')).toBeTruthy();
  });
  it('LabNodeCard shows Share only when given a share link', () => {
    const { rerender } = render(<LabNodeCard name="Negroni" share={null} onClose={() => {}} />);
    expect(screen.queryByTestId('card-share')).toBeNull();
    rerender(<LabNodeCard name="Negroni" share={{ link: '/r/cocktail/negroni', recipe }} onClose={() => {}} />);
    expect(screen.getByTestId('card-share')).toBeTruthy();
  });
});

describe('links on built-in cards resolve to the same recipe', () => {
  const codexRaw = JSON.parse(readFileSync('public/data/cocktail_codex_v2.json', 'utf8'));
  const sauceRaw = JSON.parse(readFileSync('public/data/sauce_augment.json', 'utf8'));
  const data = { cocktails: codexRaw.cocktails, families: codexRaw.families, sauces: sauceRaw.sauces, dishes: SEED_RECIPES, dishDetails: RECIPE_DETAILS };

  it('cocktails (the nodes the Cocktail Lab card shows)', () => {
    const lab = loadCodexV2(codexRaw);
    const nodes = [...lab.byCanonical.values()];
    expect(nodes.length).toBeGreaterThan(100);
    for (const name of ['Negroni', 'Daiquiri', 'Margarita', 'Manhattan']) {
      const node = nodes.find((c) => c.name === name);
      expect(node, name).toBeTruthy();
      const route = parseSharePath(shareLinkFor('cocktail', node));
      expect(resolveBuiltIn(route.kind, route.slug, data)?.name).toBe(node.name);
    }
    // every distinct node round-trips to a recipe (two codex rows repeat verbatim)
    for (const node of nodes) {
      const route = parseSharePath(shareLinkFor('cocktail', node));
      expect(resolveBuiltIn(route.kind, route.slug, data)?.name, node.name).toBe(node.name);
    }
  });

  it('sauces (the graph nodes the Sauce Lab card shows)', async () => {
    vi.stubGlobal('fetch', async () => ({ ok: true, json: async () => sauceRaw }));
    const codex = await loadSauceCodex();
    vi.unstubAllGlobals();
    const nodes = [...codex.nodes.values()];
    expect(nodes.length).toBeGreaterThan(50);
    for (const node of nodes) {
      const route = parseSharePath(shareLinkFor('sauce', node));
      expect(resolveBuiltIn(route.kind, route.slug, data)?.name, node.name).toBe(node.name);
    }
  });

  it('dishes (Cookbook SEED_RECIPES)', () => {
    for (const d of SEED_RECIPES) {
      const route = parseSharePath(shareLinkFor('dish', d));
      expect(resolveBuiltIn(route.kind, route.slug, data)?.name, d.id).toBe(d.name);
    }
  });
});
