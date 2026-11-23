// @vitest-environment jsdom
// LOOK-9 contract tests (blind): the share sheet for a built-in dish, the share-image format choice, and an open
// HelpBubble. Written from plan.md (LOOK-9 AC-1, AC-2) and the approved brief .schermness/design/LOOK-9.md
// (sections 3.10, 3.11, 7 "Primary per view", 9). No file under src/ was read; render setups reused from
// src/components/__tests__/ShareSheet.test.jsx (share-native / share-copy), ShareImages.test.jsx (renderFiles stub,
// share-choice-format-tall, charts flag forced on) and HelpBubble.test.jsx (help-bubble opens the popover).
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { primaries, expectOnePrimary, expectNoOtherAccentFill, expectSelectedNotFilled } from './helpers.js';

vi.mock('../../../src/data/shareTargets.js', async (orig) => ({ ...(await orig()), SHARE_CHARTS_ENABLED: true }));

import { ShareSheet } from '../../../src/components/ShareSheet.jsx';
import ShareImages from '../../../src/components/ShareImages.jsx';
import HelpBubble from '../../../src/components/HelpBubble.jsx';
import { resolveBuiltIn } from '../../../src/data/sharedRecipe.js';
import { SEED_RECIPES } from '../../../src/data/seedRecipes.js';
import { RECIPE_DETAILS } from '../../../src/data/seedRecipeDetails.js';

const LINK = '/r/dish/beef-bolognese';
const ORIGIN = 'https://neuralflavor.web.app';
const recipe = resolveBuiltIn('dish', 'beef-bolognese', { dishes: SEED_RECIPES, dishDetails: RECIPE_DETAILS });
const NODES = new Map(recipe.lines.map((l, i) => [l.label || l.key, { taste: i % 2 ? 'umami salty' : 'sweet sour' }]));
const renderFiles = () => vi.fn(async ({ count }) => Array.from({ length: count === 'set' ? 3 : 1 },
  (_, i) => new File([new Uint8Array([1, 2, 3])], `card-${i + 1}.png`, { type: 'image/png' })));

function sheet() {
  const images = <ShareImages link={LINK} recipe={recipe} nodes={NODES} origin={ORIGIN} renderFiles={renderFiles()} />;
  return render(<ShareSheet open onClose={() => {}} recipe={recipe} link={LINK} origin={ORIGIN} imagesSlot={images} />);
}

afterEach(() => {
  cleanup();
  delete navigator.share;
  delete navigator.canShare;
  vi.restoreAllMocks();
});

describe('LOOK-9 share sheet, built-in dish', () => {
  // Covers: AC-1
  it('with navigator.share: exactly one primary, the native Share button, filled with the accent', async () => {
    navigator.share = vi.fn().mockResolvedValue(undefined);
    sheet();
    await waitFor(() => expect(screen.getByTestId('share-native')).toBeTruthy());
    const p = expectOnePrimary(expect, document.body, 'share sheet, native share');
    expect(p.getAttribute('data-testid')).toBe('share-native');
  });

  // Covers: AC-1
  it('without navigator.share: exactly one primary, Copy link, filled with the accent', async () => {
    sheet();
    await waitFor(() => expect(screen.getByTestId('share-copy')).toBeTruthy());
    expect(screen.queryByTestId('share-native')).toBeNull();
    const p = expectOnePrimary(expect, document.body, 'share sheet, no native share');
    expect(p.getAttribute('data-testid')).toBe('share-copy');
  });

  // Covers: AC-2
  it('nothing other than the primary has an accent background, a chosen image format included (aria-pressed, not filled)', async () => {
    navigator.share = vi.fn().mockResolvedValue(undefined);
    sheet();
    const tall = await screen.findByTestId('share-choice-format-tall');
    fireEvent.click(tall);
    expectSelectedNotFilled(expect, screen.getByTestId('share-choice-format-tall'), 'Story or TikTok format choice');
    fireEvent.click(screen.getByTestId('share-choice-count-set'));
    expectSelectedNotFilled(expect, screen.getByTestId('share-choice-count-set'), 'Set of 3 choice');
    expectNoOtherAccentFill(expect, document.body, 'share sheet, tall + set chosen');
    expect(primaries(document.body)).toHaveLength(1);
  });

  // Covers: AC-2
  it('"Link copied" leaves no accent fill behind', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    sheet();
    fireEvent.click(screen.getByTestId('share-copy'));
    await waitFor(() => expect(screen.getByTestId('share-copy-status').textContent).toBe('Link copied'));
    expectNoOtherAccentFill(expect, document.body, 'share sheet, link copied');
  });
});

describe('LOOK-9 HelpBubble', () => {
  // Covers: AC-1
  it('an open HelpBubble has no primary and no accent background', () => {
    const { container } = render(<HelpBubble variant="chalk" title="Wine list" body={['Tap a wine to open its card.']} />);
    fireEvent.click(screen.getByTestId('help-bubble'));
    expect(screen.getByTestId('help-bubble-popover')).toBeTruthy();
    expect(primaries(document.body)).toHaveLength(0);
    expectNoOtherAccentFill(expect, container, 'HelpBubble open');
  });
});
