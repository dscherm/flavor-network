// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// Mock the Firebase imports before MakeRecipeStart is loaded so its
// imports of `httpsCallable` + `functions` resolve to the test doubles.
const scrapeRecipeMock = vi.fn();
vi.mock('firebase/functions', () => ({
  httpsCallable: vi.fn(() => scrapeRecipeMock),
}));
vi.mock('../../firebase.js', () => ({
  functions: { __mock: true },
}));

// WEBLINK-4: auth state now gates the parse. Default to signed-in so the
// existing flow tests are unaffected; the signed-out tests below override it
// via authState.
const loginWithGoogle = vi.fn();
const loginWithApple = vi.fn();
let authState = { user: { uid: 'test-user' }, loading: false };
vi.mock('../../hooks/useAuth.js', () => ({
  default: () => ({ ...authState, loginWithGoogle, loginWithApple, logout: vi.fn() }),
}));

import MakeRecipeStart, { describeServerFailure } from '../MakeRecipeStart.jsx';

const SAMPLE_NODES = new Map([
  ['tomato', {}], ['basil', {}], ['garlic', {}], ['olive oil', {}],
  ['parmesan', {}], ['pasta', {}], ['salt', {}], ['pepper', {}],
]);

function mountPicker(overrides = {}) {
  const setters = {
    setRecipeHandoff: vi.fn(),
    setRecipeMounted: vi.fn(),
    setActiveTab: vi.fn(),
    setCookbookPickerMode: vi.fn(),
    nodes: SAMPLE_NODES,
    ...overrides,
  };
  render(<MakeRecipeStart {...setters} />);
  return setters;
}

beforeEach(() => {
  scrapeRecipeMock.mockReset();
  loginWithGoogle.mockReset();
  loginWithApple.mockReset();
  authState = { user: { uid: 'test-user' }, loading: false };
});

describe('MakeRecipeStart — MAKE-WEBLINK-UI (4th picker option)', () => {
  it('weblink card renders with the spec copy', () => {
    mountPicker();
    expect(screen.getByTestId('make-card-weblink')).toBeInTheDocument();
    expect(screen.getByText('From a web link')).toBeInTheDocument();
    expect(screen.getByText('Paste a recipe URL; we extract the ingredients')).toBeInTheDocument();
  });

  it('clicking the weblink card reveals the URL input', () => {
    mountPicker();
    expect(screen.queryByTestId('make-weblink-input')).toBeNull();
    fireEvent.click(screen.getByTestId('make-card-weblink'));
    expect(screen.getByTestId('make-weblink-input')).toBeInTheDocument();
    expect(screen.getByTestId('make-weblink-url-input')).toBeInTheDocument();
  });

  it('invalid URL → error state with retry affordance (no scrapeRecipe call)', async () => {
    mountPicker();
    fireEvent.click(screen.getByTestId('make-card-weblink'));
    const input = screen.getByTestId('make-weblink-url-input');
    fireEvent.change(input, { target: { value: 'not a url' } });
    fireEvent.click(screen.getByTestId('make-weblink-parse-btn'));
    await waitFor(() => {
      expect(screen.getByTestId('make-weblink-error')).toBeInTheDocument();
    });
    expect(scrapeRecipeMock).not.toHaveBeenCalled();
  });

  it('empty URL → error state (no scrapeRecipe call)', async () => {
    mountPicker();
    fireEvent.click(screen.getByTestId('make-card-weblink'));
    fireEvent.click(screen.getByTestId('make-weblink-parse-btn'));
    await waitFor(() => {
      expect(screen.getByTestId('make-weblink-error')).toBeInTheDocument();
    });
    expect(scrapeRecipeMock).not.toHaveBeenCalled();
  });

  it('valid URL → calls scrapeRecipe + renders preview on success', async () => {
    scrapeRecipeMock.mockResolvedValueOnce({
      data: {
        status: 'ok',
        title: 'Sample Pasta',
        ingredients: [
          { raw: '1 cup pasta', noun: 'pasta', quantity: 1, unit: 'cup' },
          { raw: '2 cloves garlic', noun: 'garlic', quantity: 2, unit: 'cloves' },
          { raw: 'pinch of salt', noun: 'salt' },
        ],
        finalUrl: 'https://example.com/pasta',
      },
    });
    mountPicker();
    fireEvent.click(screen.getByTestId('make-card-weblink'));
    fireEvent.change(screen.getByTestId('make-weblink-url-input'), {
      target: { value: 'https://example.com/pasta' },
    });
    fireEvent.click(screen.getByTestId('make-weblink-parse-btn'));
    await waitFor(() => {
      expect(screen.getByTestId('make-weblink-preview')).toBeInTheDocument();
    });
    expect(scrapeRecipeMock).toHaveBeenCalledTimes(1);
    expect(scrapeRecipeMock).toHaveBeenCalledWith({ url: 'https://example.com/pasta' });
    expect(screen.getByText('Sample Pasta')).toBeInTheDocument();
  });

  it('preview renders one row per parsed ingredient with input + matched name', async () => {
    scrapeRecipeMock.mockResolvedValueOnce({
      data: {
        status: 'ok',
        title: 'Quick Salad',
        ingredients: [
          { raw: '1 cup tomato', noun: 'tomato', quantity: 1, unit: 'cup' },
          { raw: '1 tbsp olive oil', noun: 'olive oil', quantity: 1, unit: 'tbsp' },
          { raw: '1 mystery thing', noun: 'mystery thing', quantity: 1 },
        ],
        finalUrl: 'https://example.com/salad',
      },
    });
    mountPicker();
    fireEvent.click(screen.getByTestId('make-card-weblink'));
    fireEvent.change(screen.getByTestId('make-weblink-url-input'), {
      target: { value: 'https://example.com/salad' },
    });
    fireEvent.click(screen.getByTestId('make-weblink-parse-btn'));
    await waitFor(() => {
      expect(screen.getByTestId('make-weblink-preview')).toBeInTheDocument();
    });
    expect(screen.getByTestId('make-weblink-row-0')).toBeInTheDocument();
    expect(screen.getByTestId('make-weblink-row-1')).toBeInTheDocument();
    expect(screen.getByTestId('make-weblink-row-2')).toBeInTheDocument();
    // First two rows matched → checked + enabled. Third unmatched → disabled.
    expect(screen.getByTestId('make-weblink-row-0')).toBeChecked();
    expect(screen.getByTestId('make-weblink-row-2')).toBeDisabled();
  });

  it('"Add to bowl" fires recipeHandoff with source="make-weblink" + matched names', async () => {
    scrapeRecipeMock.mockResolvedValueOnce({
      data: {
        status: 'ok',
        title: 'Tomato Toast',
        ingredients: [
          { raw: 'tomato', noun: 'tomato' },
          { raw: 'basil', noun: 'basil' },
        ],
        finalUrl: 'https://example.com/toast',
      },
    });
    const s = mountPicker();
    fireEvent.click(screen.getByTestId('make-card-weblink'));
    fireEvent.change(screen.getByTestId('make-weblink-url-input'), {
      target: { value: 'https://example.com/toast' },
    });
    fireEvent.click(screen.getByTestId('make-weblink-parse-btn'));
    await waitFor(() => {
      expect(screen.getByTestId('make-weblink-preview')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('make-weblink-add-btn'));
    expect(s.setRecipeHandoff).toHaveBeenCalledTimes(1);
    const payload = s.setRecipeHandoff.mock.calls[0][0];
    expect(payload.source).toBe('make-weblink');
    expect(payload.ingredients).toEqual(expect.arrayContaining(['tomato', 'basil']));
    expect(payload.title).toBe('Tomato Toast');
    expect(payload.sourceUrl).toBe('https://example.com/toast');
    expect(s.setActiveTab).toHaveBeenCalledWith('recipe');
  });

  it('server error response → error state with retry', async () => {
    scrapeRecipeMock.mockResolvedValueOnce({
      data: {
        status: 'error',
        errorMessage: 'No Recipe schema found on this page.',
      },
    });
    mountPicker();
    fireEvent.click(screen.getByTestId('make-card-weblink'));
    fireEvent.change(screen.getByTestId('make-weblink-url-input'), {
      target: { value: 'https://example.com/notarecipe' },
    });
    fireEvent.click(screen.getByTestId('make-weblink-parse-btn'));
    await waitFor(() => {
      expect(screen.getByTestId('make-weblink-error')).toBeInTheDocument();
    });
    expect(screen.getByText(/No Recipe schema/)).toBeInTheDocument();
  });

  // ===== MAKE-WEBLINK-MATCH-V2 — editable matched names =====

  it('v2: each matched row renders an editable input prefilled with the auto-match', async () => {
    scrapeRecipeMock.mockResolvedValueOnce({
      data: {
        status: 'ok',
        title: 'Quick Pasta',
        ingredients: [
          { raw: '1 cup tomato', noun: 'tomato' },
          { raw: '1 cup basil', noun: 'basil' },
        ],
        finalUrl: 'https://example.com/pasta',
      },
    });
    mountPicker();
    fireEvent.click(screen.getByTestId('make-card-weblink'));
    fireEvent.change(screen.getByTestId('make-weblink-url-input'), {
      target: { value: 'https://example.com/pasta' },
    });
    fireEvent.click(screen.getByTestId('make-weblink-parse-btn'));
    await waitFor(() => {
      expect(screen.getByTestId('make-weblink-preview')).toBeInTheDocument();
    });
    const row0 = screen.getByTestId('make-weblink-row-name-0');
    const row1 = screen.getByTestId('make-weblink-row-name-1');
    expect(row0).toHaveValue('tomato');
    expect(row1).toHaveValue('basil');
  });

  it('v2: editing a row to a known dictionary name keeps it included; payload uses the edit', async () => {
    scrapeRecipeMock.mockResolvedValueOnce({
      data: {
        status: 'ok',
        title: 'Test',
        ingredients: [{ raw: '1 cup tomato', noun: 'tomato' }],
        finalUrl: 'https://example.com/x',
      },
    });
    const s = mountPicker();
    fireEvent.click(screen.getByTestId('make-card-weblink'));
    fireEvent.change(screen.getByTestId('make-weblink-url-input'), {
      target: { value: 'https://example.com/x' },
    });
    fireEvent.click(screen.getByTestId('make-weblink-parse-btn'));
    await waitFor(() => expect(screen.getByTestId('make-weblink-preview')).toBeInTheDocument());

    fireEvent.change(screen.getByTestId('make-weblink-row-name-0'), {
      target: { value: 'basil' },
    });
    expect(screen.getByTestId('make-weblink-row-0')).toBeChecked();

    fireEvent.click(screen.getByTestId('make-weblink-add-btn'));
    expect(s.setRecipeHandoff).toHaveBeenCalledTimes(1);
    expect(s.setRecipeHandoff.mock.calls[0][0].ingredients).toEqual(['basil']);
  });

  it('v2: editing a row to an unknown name auto-unchecks it', async () => {
    scrapeRecipeMock.mockResolvedValueOnce({
      data: {
        status: 'ok',
        title: 'Test',
        ingredients: [{ raw: '1 cup tomato', noun: 'tomato' }],
        finalUrl: 'https://example.com/x',
      },
    });
    mountPicker();
    fireEvent.click(screen.getByTestId('make-card-weblink'));
    fireEvent.change(screen.getByTestId('make-weblink-url-input'), {
      target: { value: 'https://example.com/x' },
    });
    fireEvent.click(screen.getByTestId('make-weblink-parse-btn'));
    await waitFor(() => expect(screen.getByTestId('make-weblink-preview')).toBeInTheDocument());

    fireEvent.change(screen.getByTestId('make-weblink-row-name-0'), {
      target: { value: 'xyzzy-not-real' },
    });
    expect(screen.getByTestId('make-weblink-row-0')).not.toBeChecked();
    // Amber warning hint visible.
    expect(screen.getByText(/not in dictionary/i)).toBeInTheDocument();
  });

  it('v2: editing an unmatched row to a known name auto-includes it', async () => {
    scrapeRecipeMock.mockResolvedValueOnce({
      data: {
        status: 'ok',
        title: 'Test',
        ingredients: [
          { raw: 'mystery thing', noun: 'mystery thing' },
        ],
        finalUrl: 'https://example.com/x',
      },
    });
    const s = mountPicker();
    fireEvent.click(screen.getByTestId('make-card-weblink'));
    fireEvent.change(screen.getByTestId('make-weblink-url-input'), {
      target: { value: 'https://example.com/x' },
    });
    fireEvent.click(screen.getByTestId('make-weblink-parse-btn'));
    await waitFor(() => expect(screen.getByTestId('make-weblink-preview')).toBeInTheDocument());

    // Starts as unmatched + unchecked.
    expect(screen.getByTestId('make-weblink-row-0')).not.toBeChecked();
    fireEvent.change(screen.getByTestId('make-weblink-row-name-0'), {
      target: { value: 'garlic' },
    });
    expect(screen.getByTestId('make-weblink-row-0')).toBeChecked();
    fireEvent.click(screen.getByTestId('make-weblink-add-btn'));
    expect(s.setRecipeHandoff.mock.calls[0][0].ingredients).toEqual(['garlic']);
  });

  it('v2: reset-to-auto button restores the original cascade result', async () => {
    scrapeRecipeMock.mockResolvedValueOnce({
      data: {
        status: 'ok',
        title: 'Test',
        ingredients: [{ raw: '1 cup tomato', noun: 'tomato' }],
        finalUrl: 'https://example.com/x',
      },
    });
    mountPicker();
    fireEvent.click(screen.getByTestId('make-card-weblink'));
    fireEvent.change(screen.getByTestId('make-weblink-url-input'), {
      target: { value: 'https://example.com/x' },
    });
    fireEvent.click(screen.getByTestId('make-weblink-parse-btn'));
    await waitFor(() => expect(screen.getByTestId('make-weblink-preview')).toBeInTheDocument());

    fireEvent.change(screen.getByTestId('make-weblink-row-name-0'), {
      target: { value: 'basil' },
    });
    expect(screen.getByTestId('make-weblink-row-name-0')).toHaveValue('basil');
    // Reset button only renders after an edit.
    fireEvent.click(screen.getByTestId('make-weblink-row-reset-0'));
    expect(screen.getByTestId('make-weblink-row-name-0')).toHaveValue('tomato');
    expect(screen.getByTestId('make-weblink-row-0')).toBeChecked();
  });

  it('thrown error (e.g. unauthenticated) → error state with the message', async () => {
    scrapeRecipeMock.mockRejectedValueOnce(new Error('Sign in to import recipes from a URL.'));
    mountPicker();
    fireEvent.click(screen.getByTestId('make-card-weblink'));
    fireEvent.change(screen.getByTestId('make-weblink-url-input'), {
      target: { value: 'https://example.com/x' },
    });
    fireEvent.click(screen.getByTestId('make-weblink-parse-btn'));
    await waitFor(() => {
      expect(screen.getByTestId('make-weblink-error')).toBeInTheDocument();
    });
    expect(screen.getByText(/Sign in/)).toBeInTheDocument();
  });
});

// ===== WEBLINK-4 — auth is resolved BEFORE the spinner =====
//
// Previously handleParseUrl entered STAGE.PARSING and called the callable
// without knowing whether the user was signed in, so a signed-out user
// watched a 25s spinner and then landed on a dead-end error screen.

describe('MakeRecipeStart — WEBLINK-4 auth gate', () => {
  function pasteUrl(value = 'https://example.com/pasta') {
    fireEvent.click(screen.getByTestId('make-card-weblink'));
    fireEvent.change(screen.getByTestId('make-weblink-url-input'), { target: { value } });
    fireEvent.click(screen.getByTestId('make-weblink-parse-btn'));
  }

  it('signed out: offers sign-in without firing the callable or the spinner', async () => {
    authState = { user: null, loading: false };
    mountPicker();
    pasteUrl();

    await waitFor(() => {
      expect(screen.getByTestId('make-weblink-signin')).toBeInTheDocument();
    });
    expect(scrapeRecipeMock).not.toHaveBeenCalled();
    expect(screen.queryByTestId('make-weblink-parsing')).toBeNull();
    expect(screen.queryByTestId('make-weblink-error')).toBeNull();
  });

  it('signed out: the typed URL survives, and Sign in is wired up', async () => {
    authState = { user: null, loading: false };
    mountPicker();
    pasteUrl('https://example.com/keepme');

    await waitFor(() => expect(screen.getByTestId('make-weblink-signin')).toBeInTheDocument());
    expect(screen.getByTestId('make-weblink-url-input')).toHaveValue('https://example.com/keepme');

    fireEvent.click(screen.getByTestId('make-weblink-signin-google'));
    expect(loginWithGoogle).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByTestId('make-weblink-signin-apple'));
    expect(loginWithApple).toHaveBeenCalledTimes(1);
  });

  it('resumes the queued parse automatically once sign-in resolves', async () => {
    scrapeRecipeMock.mockResolvedValueOnce({
      data: {
        status: 'ok',
        title: 'Resumed Pasta',
        ingredients: [{ raw: '1 cup tomato', noun: 'tomato' }],
        finalUrl: 'https://example.com/pasta',
      },
    });
    authState = { user: null, loading: false };
    const { rerender } = render(
      <MakeRecipeStart
        setRecipeHandoff={vi.fn()}
        setRecipeMounted={vi.fn()}
        setActiveTab={vi.fn()}
        setCookbookPickerMode={vi.fn()}
        nodes={SAMPLE_NODES}
      />,
    );
    fireEvent.click(screen.getByTestId('make-card-weblink'));
    fireEvent.change(screen.getByTestId('make-weblink-url-input'), {
      target: { value: 'https://example.com/pasta' },
    });
    fireEvent.click(screen.getByTestId('make-weblink-parse-btn'));
    await waitFor(() => expect(screen.getByTestId('make-weblink-signin')).toBeInTheDocument());
    expect(scrapeRecipeMock).not.toHaveBeenCalled();

    // Sign-in completes -> onAuthStateChanged delivers a user.
    authState = { user: { uid: 'now-signed-in' }, loading: false };
    rerender(
      <MakeRecipeStart
        setRecipeHandoff={vi.fn()}
        setRecipeMounted={vi.fn()}
        setActiveTab={vi.fn()}
        setCookbookPickerMode={vi.fn()}
        nodes={SAMPLE_NODES}
      />,
    );

    await waitFor(() => expect(screen.getByTestId('make-weblink-preview')).toBeInTheDocument());
    expect(scrapeRecipeMock).toHaveBeenCalledWith({ url: 'https://example.com/pasta' });
    expect(screen.getByText('Resumed Pasta')).toBeInTheDocument();
  });

  it('waits for auth to resolve rather than assuming signed-out', async () => {
    authState = { user: null, loading: true };
    mountPicker();
    pasteUrl();

    // Auth hasn't answered yet — neither prompt for sign-in nor call out.
    await waitFor(() => expect(screen.queryByTestId('make-weblink-parsing')).toBeNull());
    expect(screen.queryByTestId('make-weblink-signin')).toBeNull();
    expect(scrapeRecipeMock).not.toHaveBeenCalled();
  });

  it('signed in: parses immediately, no sign-in prompt', async () => {
    scrapeRecipeMock.mockResolvedValueOnce({
      data: { status: 'ok', title: 'X', ingredients: [{ raw: 'tomato', noun: 'tomato' }], finalUrl: 'https://example.com/x' },
    });
    mountPicker();
    pasteUrl('https://example.com/x');
    await waitFor(() => expect(screen.getByTestId('make-weblink-preview')).toBeInTheDocument());
    expect(screen.queryByTestId('make-weblink-signin')).toBeNull();
  });

  it('invalid URL still errors before any auth consideration', async () => {
    authState = { user: null, loading: false };
    mountPicker();
    pasteUrl('not a url');
    await waitFor(() => expect(screen.getByTestId('make-weblink-error')).toBeInTheDocument());
    expect(screen.queryByTestId('make-weblink-signin')).toBeNull();
  });
});

describe('describeServerFailure — WEBLINK-4 error copy', () => {
  it('tells the user a site refused us, and to try elsewhere', () => {
    expect(describeServerFailure('HTTP 402 fetching https://x.com (site blocked the import; reader proxy also failed)'))
      .toMatch(/blocked the import/i);
    expect(describeServerFailure('HTTP 403 fetching https://x.com')).toMatch(/different site|by hand/i);
  });

  it('passes the no-markup message through — it already says what to do', () => {
    const msg = 'No recipe markup found on this page — it has no recipe card we can read.';
    expect(describeServerFailure(msg)).toBe(msg);
  });

  it('falls back when the server says nothing useful', () => {
    expect(describeServerFailure('')).toMatch(/Could not parse a recipe/);
    expect(describeServerFailure(undefined)).toMatch(/Could not parse a recipe/);
  });

  it('distinguishes the two failures the user will actually hit', () => {
    const blocked = describeServerFailure('HTTP 402 fetching https://x.com');
    const noMarkup = describeServerFailure('No recipe markup found on this page.');
    expect(blocked).not.toBe(noMarkup);
  });
});

// WEBLINK-8: Apple News gets its own branch, keyed on the structured
// appleNews field rather than on prose, so a future edit to the generic
// fallbacks can't silently swallow it.
describe('describeServerFailure — Apple News (WEBLINK-8)', () => {
  const APPLE_MSG =
    'Apple News links don\'t include the original recipe page, so we can\'t read the '
    + 'ingredients for “Miso Pork and Eggplant Stir-Fry” from America\'s Test Kitchen.';

  it('passes the Apple News message through with the recipe named', () => {
    const out = describeServerFailure(APPLE_MSG, {
      appleNews: { title: 'Miso Pork and Eggplant Stir-Fry', publisher: "America's Test Kitchen" },
    });
    expect(out).toContain('Miso Pork and Eggplant Stir-Fry');
    expect(out).toContain("America's Test Kitchen");
  });

  it('does not fall through to the generic blocked-site copy', () => {
    const out = describeServerFailure(APPLE_MSG, { appleNews: { title: 'X', publisher: 'Y' } });
    expect(out).not.toMatch(/refuses automated requests/);
    expect(out).not.toMatch(/Could not parse a recipe/);
  });

  it('still renders something useful if the message is missing', () => {
    const out = describeServerFailure('', { appleNews: { title: null, publisher: null } });
    expect(out).toMatch(/Apple News/);
  });

  it('leaves non-Apple failures on their existing branches', () => {
    expect(describeServerFailure('HTTP 402 fetching https://x.com', { fetchPath: 'proxy' }))
      .toMatch(/blocked the import/i);
    expect(describeServerFailure('No recipe markup found on this page.', {}))
      .toMatch(/No recipe markup/);
  });
});
