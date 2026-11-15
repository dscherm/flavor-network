// @vitest-environment jsdom
// SHARE-6: the public page for /r/<id> (a user's published copy).
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';

vi.mock('../../hooks/useAuth.js', () => ({ default: () => ({ user: null, loading: false, authError: null, loginWithGoogle: vi.fn(), loginWithApple: vi.fn() }) }));
vi.mock('../../hooks/useUserProfile.js', () => ({ default: () => ({ profile: {}, saveInvention: vi.fn() }) }));
import SharedRecipePage from '../SharedRecipePage.jsx';

const ID = 'abcdefghjk';
const DOC = {
  kind: 'cocktail', name: 'Grandma Sour', owner: 'u1', createdAt: 1, removed: false, by: null,
  lines: [{ key: 'bourbon', amount: '2 oz' }, { key: 'lemon juice', amount: '1 oz' }],
  method: 'Shake with ice.\nStrain.', glass: 'Rocks', category: 'sours', bars: [],
};
const loadNodes = async () => new Map();
const loadData = vi.fn(async () => ({}));
afterEach(() => { cleanup(); vi.clearAllMocks(); });

const page = (doc, extra = {}) => render(<SharedRecipePage route={{ id: ID }} loadShared={vi.fn(async () => doc)} loadNodes={loadNodes} loadData={loadData} {...extra} />);

describe('SharedRecipePage /r/<id>', () => {
  it('renders the whole recipe signed out, with no name when none was chosen', async () => {
    page(DOC);
    expect((await screen.findByTestId('shared-name')).textContent).toBe('Grandma Sour');
    expect(screen.getAllByTestId('shared-line').map((l) => l.textContent)).toEqual(['2 ozbourbon', '1 ozlemon juice']);
    expect(screen.getByTestId('shared-method').textContent).toContain('Shake with ice.');
    expect(screen.getByTestId('shared-glass').textContent).toBe('Glass: Rocks');
    expect(screen.queryByTestId('shared-by')).toBeNull();
    expect(screen.getByTestId('shared-save')).toBeTruthy();
    expect(screen.getByTestId('shared-own')).toBeTruthy();
  });

  it('shows "Shared by" only when a name was chosen', async () => {
    page({ ...DOC, by: 'Dan' });
    expect((await screen.findByTestId('shared-by')).textContent).toBe('Shared by Dan');
  });

  it('leaves an empty slot for the Report link, only on a user copy', async () => {
    page(DOC);
    const slot = await screen.findByTestId('shared-report-slot');
    expect(slot.childElementCount).toBe(0);
    cleanup();
    const cocktail = { canonical: 'Negroni', name: 'Negroni', ingredients: ['gin', 'campari', 'sweet vermouth'], family_id: 1, build: 'stir' };
    render(<SharedRecipePage route={{ kind: 'cocktail', slug: 'negroni' }} loadData={async () => ({ cocktails: [cocktail], families: [] })} loadNodes={loadNodes} loadShared={vi.fn()} />);
    expect((await screen.findByTestId('shared-name')).textContent).toBe('Negroni');
    expect(screen.queryByTestId('shared-report-slot')).toBeNull();
  });

  it('a removed or missing share says it is no longer shared', async () => {
    page(null);
    expect(await screen.findByTestId('shared-gone')).toBeTruthy();
    cleanup();
    page({ ...DOC, removed: true });
    expect(await screen.findByTestId('shared-gone')).toBeTruthy();
    expect(screen.getByText('This recipe is no longer shared')).toBeTruthy();
  });

  it('a failed read says it is no longer shared rather than crashing', async () => {
    render(<SharedRecipePage route={{ id: ID }} loadShared={async () => { throw new Error('offline'); }} loadNodes={loadNodes} />);
    expect(await screen.findByTestId('shared-gone')).toBeTruthy();
  });

  it('wrong-typed documents do not crash the page', async () => {
    const bads = ['oops', 42, [], { kind: 5, name: [], lines: {} }, { ...DOC, lines: 'x' }, { ...DOC, name: { a: 1 } }, { ...DOC, kind: 'wine' }];
    for (const bad of bads) {
      page(bad);
      expect(await screen.findByTestId('shared-gone')).toBeTruthy();
      cleanup();
    }
  });

  it('hostile text is rendered as text, never as markup', async () => {
    page({
      ...DOC,
      name: '<img src=x onerror=alert(1)>',
      by: '<script>alert(2)</script>',
      method: '<b>bold</b>',
      lines: [{ key: '"><svg onload=alert(3)>', amount: '<i>1</i>' }, { key: 'x'.repeat(500), amount: 'y'.repeat(500) }],
    });
    const name = await screen.findByTestId('shared-name');
    expect(name.textContent).toBe('<img src=x onerror=alert(1)>');
    const root = screen.getByTestId('shared-page');
    expect(root.querySelector('img')).toBeNull();
    expect(root.querySelector('script')).toBeNull();
    expect(root.querySelector('svg[onload]')).toBeNull();
    expect(root.querySelector('b')).toBeNull();
    expect(screen.getByTestId('shared-by').textContent).toBe('Shared by <script>alert(2)</script>');
    expect(screen.getAllByTestId('shared-line')[1].textContent.length).toBeLessThan(200);
  });

  it('an id link never loads built-in data, and a built-in link never reads Firestore', async () => {
    const loadShared = vi.fn(async () => DOC);
    render(<SharedRecipePage route={{ id: ID }} loadShared={loadShared} loadData={loadData} loadNodes={loadNodes} />);
    await screen.findByTestId('shared-name');
    expect(loadShared).toHaveBeenCalledWith(ID);
    expect(loadData).not.toHaveBeenCalled();
    cleanup();
    loadShared.mockClear();
    render(<SharedRecipePage route={{ kind: 'cocktail', slug: 'nope' }} loadShared={loadShared} loadData={async () => ({ cocktails: [], families: [] })} loadNodes={loadNodes} />);
    await screen.findByTestId('shared-gone');
    expect(loadShared).not.toHaveBeenCalled();
  });

  it('the share id is lower-cased before the read', async () => {
    const loadShared = vi.fn(async () => DOC);
    render(<SharedRecipePage route={{ id: 'ABCDEFGHJK' }} loadShared={loadShared} loadNodes={loadNodes} />);
    await waitFor(() => expect(loadShared).toHaveBeenCalledWith('abcdefghjk'));
  });
});
