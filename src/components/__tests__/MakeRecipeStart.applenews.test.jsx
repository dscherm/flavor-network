// @vitest-environment jsdom
// WEBLINK-17: the Apple News fallback panel, the "Found on" line for a
// resolved link, and the ?import= hand-off (initialImportUrl).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const scrapeRecipeMock = vi.fn();
vi.mock('firebase/functions', () => ({
  httpsCallable: vi.fn(() => scrapeRecipeMock),
}));
vi.mock('../../firebase.js', () => ({ functions: { __mock: true } }));

const loginWithGoogle = vi.fn();
const loginWithApple = vi.fn();
let authState = { user: { uid: 'test-user' }, loading: false };
vi.mock('../../hooks/useAuth.js', () => ({
  default: () => ({ authError: null, ...authState, loginWithGoogle, loginWithApple, logout: vi.fn() }),
}));

import MakeRecipeStart, { SHORTCUT_DOC_URL } from '../MakeRecipeStart.jsx';
import { webSearchHref } from '../AppleNewsFallback.jsx';

const NODES = new Map([['miso', {}], ['pork', {}], ['eggplant', {}]]);

function mount(props = {}) {
  const utils = render(
    <MakeRecipeStart
      setRecipeHandoff={vi.fn()}
      setRecipeMounted={vi.fn()}
      setActiveTab={vi.fn()}
      setCookbookPickerMode={vi.fn()}
      nodes={NODES}
      {...props}
    />,
  );
  return utils;
}

async function parse(url) {
  fireEvent.click(screen.getByTestId('make-card-weblink'));
  fireEvent.change(screen.getByTestId('make-weblink-url-input'), { target: { value: url } });
  fireEvent.click(screen.getByTestId('make-weblink-parse-btn'));
}

const APPLE = 'https://apple.news/KcFmm7QLuNEyYYYM2Bm9Z_w';
const FALLBACK = {
  status: 'error',
  errorMessage: "Apple News links don't include the original recipe page…",
  appleNews: {
    title: 'Miso Pork and Eggplant Stir-Fry',
    publisher: "America's Test Kitchen",
    paywalled: true,
    searchQuery: "Miso Pork and Eggplant Stir-Fry America's Test Kitchen",
    reason: 'no-confident-match',
  },
};

beforeEach(() => {
  scrapeRecipeMock.mockReset();
  authState = { user: { uid: 'test-user' }, loading: false };
});

describe('Apple News fallback panel', () => {
  it('names the recipe and publisher and says why', async () => {
    scrapeRecipeMock.mockResolvedValueOnce({ data: FALLBACK });
    mount();
    await parse(APPLE);
    const found = await screen.findByTestId('make-weblink-applenews-found');
    expect(found).toHaveTextContent("We found Miso Pork and Eggplant Stir-Fry from America's Test Kitchen");
    expect(found.querySelector('strong')).toHaveTextContent('Miso Pork and Eggplant Stir-Fry');
    const why = screen.getByTestId('make-weblink-applenews-why');
    expect(why).toHaveTextContent(/Apple News doesn't share the original recipe link/);
    expect(why).toHaveTextContent(/subscriber-only/);
    // Replaces the dead-end error panel.
    expect(screen.queryByTestId('make-weblink-error')).toBeNull();
  });

  it('omits the subscriber line for a free publisher', async () => {
    scrapeRecipeMock.mockResolvedValueOnce({
      data: { ...FALLBACK, appleNews: { ...FALLBACK.appleNews, publisher: 'Delish', paywalled: false } },
    });
    mount();
    await parse(APPLE);
    expect(await screen.findByTestId('make-weblink-applenews-why')).not.toHaveTextContent(/subscriber/);
  });

  it('"Find it on the web" is a new-tab link to a web search for title + publisher', async () => {
    scrapeRecipeMock.mockResolvedValueOnce({ data: FALLBACK });
    mount();
    await parse(APPLE);
    const a = await screen.findByTestId('make-weblink-applenews-search');
    expect(a.tagName).toBe('A');
    expect(a).toHaveAttribute('target', '_blank');
    expect(a.getAttribute('rel')).toMatch(/noopener/);
    expect(a).toHaveAttribute('href', webSearchHref(FALLBACK.appleNews.searchQuery));
    expect(a.getAttribute('href')).toContain(encodeURIComponent("Miso Pork and Eggplant Stir-Fry America's Test Kitchen"));
  });

  it('shows the Open-in-Safari tip', async () => {
    scrapeRecipeMock.mockResolvedValueOnce({ data: FALLBACK });
    mount();
    await parse(APPLE);
    expect(await screen.findByTestId('make-weblink-applenews-tip')).toHaveTextContent(/Share → Open in Safari/);
  });

  it('the paste box imports the pasted link', async () => {
    scrapeRecipeMock.mockResolvedValueOnce({ data: FALLBACK });
    scrapeRecipeMock.mockResolvedValueOnce({
      data: { status: 'ok', title: 'Miso Pork', ingredients: [{ raw: 'miso', noun: 'miso' }], finalUrl: 'https://example.com/r' },
    });
    mount();
    await parse(APPLE);
    const box = await screen.findByTestId('make-weblink-applenews-paste');
    expect(screen.getByTestId('make-weblink-applenews-import')).toBeDisabled();
    fireEvent.change(box, { target: { value: 'https://example.com/r' } });
    fireEvent.click(screen.getByTestId('make-weblink-applenews-import'));
    await screen.findByTestId('make-weblink-preview');
    expect(scrapeRecipeMock).toHaveBeenLastCalledWith({ url: 'https://example.com/r' });
  });

  it('offers the publisher link when Apple linked one we could not read', async () => {
    scrapeRecipeMock.mockResolvedValueOnce({
      data: {
        ...FALLBACK,
        appleNews: {
          title: 'Vanilla Milkshake', publisher: 'Allrecipes', paywalled: false,
          searchQuery: 'Vanilla Milkshake Allrecipes', reason: 'publisher-page-failed',
          publisherUrl: 'https://www.allrecipes.com/recipe/48974/vanilla-milkshake-i/',
        },
      },
    });
    mount();
    await parse(APPLE);
    const a = await screen.findByTestId('make-weblink-applenews-publisher');
    expect(a).toHaveTextContent('Open it on allrecipes.com');
    expect(screen.getByTestId('make-weblink-applenews-why')).toHaveTextContent(/blocks automatic imports/);
  });

  it('back returns to the picker', async () => {
    scrapeRecipeMock.mockResolvedValueOnce({ data: FALLBACK });
    mount();
    await parse(APPLE);
    fireEvent.click(await screen.findByTestId('make-weblink-applenews-back'));
    expect(screen.getByTestId('make-card-weblink')).toBeInTheDocument();
  });

  it('a non-Apple failure still shows the plain error panel', async () => {
    scrapeRecipeMock.mockResolvedValueOnce({ data: { status: 'error', errorMessage: 'No recipe markup found on this page.' } });
    mount();
    await parse('https://example.com/x');
    expect(await screen.findByTestId('make-weblink-error')).toBeInTheDocument();
    expect(screen.queryByTestId('make-weblink-applenews')).toBeNull();
  });
});

describe('resolved Apple News link', () => {
  it('the preview says where the recipe was found', async () => {
    scrapeRecipeMock.mockResolvedValueOnce({
      data: {
        status: 'ok', title: 'Southern Thai Fried Chicken (Gai Tod Hat Yai)',
        ingredients: [{ raw: '1 lb pork', noun: 'pork' }],
        finalUrl: 'https://www.epicurious.com/recipes/food/views/southern-thai-fried-chicken-gai-tod-hat-yai',
        resolvedFrom: 'apple.news', publisherHost: 'epicurious.com',
      },
    });
    mount();
    await parse(APPLE);
    expect(await screen.findByTestId('make-weblink-found-on')).toHaveTextContent('Found on epicurious.com');
  });

  it('no "Found on" line for an ordinary link', async () => {
    scrapeRecipeMock.mockResolvedValueOnce({
      data: { status: 'ok', title: 'R', ingredients: [{ raw: 'pork', noun: 'pork' }], finalUrl: 'https://example.com/r' },
    });
    mount();
    await parse('https://example.com/r');
    await screen.findByTestId('make-weblink-preview');
    expect(screen.queryByTestId('make-weblink-found-on')).toBeNull();
  });
});

describe('?import= hand-off (initialImportUrl)', () => {
  const LINK = 'https://apple.news/KZrKwE9isOtqUF7Y9dIy3GQ';

  it('opens the web-link step with the URL filled in and starts the parse', async () => {
    scrapeRecipeMock.mockResolvedValueOnce({ data: FALLBACK });
    const onImportConsumed = vi.fn();
    mount({ initialImportUrl: LINK, onImportConsumed });
    await waitFor(() => expect(scrapeRecipeMock).toHaveBeenCalledWith({ url: LINK }));
    expect(scrapeRecipeMock).toHaveBeenCalledTimes(1);
    expect(onImportConsumed).toHaveBeenCalledTimes(1);
  });

  it('signed out: queues the parse behind the sign-in panel, then resumes', async () => {
    authState = { user: null, loading: false };
    scrapeRecipeMock.mockResolvedValueOnce({ data: FALLBACK });
    const { rerender } = mount({ initialImportUrl: LINK });
    expect(await screen.findByTestId('make-weblink-signin')).toBeInTheDocument();
    expect(screen.getByTestId('make-weblink-url-input')).toHaveValue(LINK);
    expect(scrapeRecipeMock).not.toHaveBeenCalled();

    authState = { user: { uid: 'now-signed-in' }, loading: false };
    rerender(
      <MakeRecipeStart
        setRecipeHandoff={vi.fn()} setRecipeMounted={vi.fn()} setActiveTab={vi.fn()}
        setCookbookPickerMode={vi.fn()} nodes={NODES} initialImportUrl={LINK}
      />,
    );
    await waitFor(() => expect(scrapeRecipeMock).toHaveBeenCalledWith({ url: LINK }));
    expect(scrapeRecipeMock).toHaveBeenCalledTimes(1);
  });

  it('ignores a non-http(s) value (no call)', async () => {
    mount({ initialImportUrl: 'javascript:alert(1)' });
    await screen.findByTestId('make-weblink-error');
    expect(scrapeRecipeMock).not.toHaveBeenCalled();
  });

  it('does nothing without a value', () => {
    mount();
    expect(screen.getByTestId('make-card-weblink')).toBeInTheDocument();
    expect(scrapeRecipeMock).not.toHaveBeenCalled();
  });
});

describe('Share-from-Apple-News help', () => {
  it('the web-link step links the Shortcut doc', () => {
    mount();
    fireEvent.click(screen.getByTestId('make-card-weblink'));
    expect(screen.getByTestId('make-weblink-share-help')).toBeInTheDocument();
    const a = screen.getByTestId('make-weblink-share-help-link');
    expect(a).toHaveAttribute('href', SHORTCUT_DOC_URL);
    expect(SHORTCUT_DOC_URL).toMatch(/docs\/apple-news-shortcut\.md$/);
  });
});
