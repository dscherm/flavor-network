// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';

vi.mock('../../hooks/useAuth.js', () => ({ default: () => ({ user: { uid: 'secret-uid' }, loading: false, authError: null, loginWithGoogle: vi.fn(), loginWithApple: vi.fn() }) }));
vi.mock('../../hooks/useUserProfile.js', () => ({ default: () => ({ profile: {}, saveInvention: vi.fn() }) }));
vi.mock('../ShareImages.jsx', () => ({ default: () => null }));
import ShareReport from '../ShareReport.jsx';
import SharedRecipePage from '../SharedRecipePage.jsx';

const ID = 'abcdefghjk';
beforeEach(() => { try { localStorage.clear(); } catch { /* none */ } });
afterEach(() => cleanup());

const fill = (reason = 'spam', note = '') => {
  fireEvent.click(screen.getByTestId('report-open'));
  fireEvent.change(screen.getByTestId('report-reason'), { target: { value: reason } });
  if (note) fireEvent.change(screen.getByTestId('report-note'), { target: { value: note } });
};

describe('ShareReport', () => {
  it('sends only shareId, reason, note and at, then says thanks', async () => {
    const send = vi.fn(async () => {});
    render(<ShareReport shareId={ID} sendReport={send} />);
    fill('offensive', 'rude');
    fireEvent.click(screen.getByTestId('report-send'));
    expect((await screen.findByTestId('report-thanks')).textContent).toBe('Thanks. The report was sent.');
    const sent = send.mock.calls[0][0];
    expect(Object.keys(sent).sort()).toEqual(['at', 'note', 'reason', 'shareId']);
    expect(sent).toMatchObject({ shareId: ID, reason: 'offensive', note: 'rude' });
  });
  it('asks for a reason before sending', () => {
    const send = vi.fn();
    render(<ShareReport shareId={ID} sendReport={send} />);
    fireEvent.click(screen.getByTestId('report-open'));
    fireEvent.click(screen.getByTestId('report-send'));
    expect(screen.getByTestId('report-error').textContent).toBe('Pick a reason first.');
    expect(send).not.toHaveBeenCalled();
  });
  it('refuses the fourth report from one browser in a day with a plain sentence', async () => {
    const send = vi.fn(async () => {});
    for (let i = 0; i < 3; i++) {
      render(<ShareReport shareId={ID} sendReport={send} />);
      fill();
      fireEvent.click(screen.getByTestId('report-send'));
      await screen.findByTestId('report-thanks');
      cleanup();
    }
    render(<ShareReport shareId={ID} sendReport={send} />);
    fill();
    fireEvent.click(screen.getByTestId('report-send'));
    expect((await screen.findByTestId('report-error')).textContent).toBe('You have already sent 3 reports today. Please try again tomorrow.');
    expect(send).toHaveBeenCalledTimes(3);
  });
  it('keeps the note and says so when sending fails, and does not count the failed attempt', async () => {
    const send = vi.fn(async () => { throw new Error('offline'); });
    render(<ShareReport shareId={ID} sendReport={send} />);
    fill('spam', 'my note');
    fireEvent.click(screen.getByTestId('report-send'));
    expect((await screen.findByTestId('report-error')).textContent).toMatch(/could not be sent/);
    expect(screen.getByTestId('report-note').value).toBe('my note');
    expect(JSON.parse(localStorage.getItem('nf-share-reports') || '{"count":0}').count).toBe(0);
  });
});

const DOC = { kind: 'cocktail', name: 'Grandma Sour', owner: 'u1', createdAt: 1, removed: false, by: null, lines: [{ key: 'bourbon', amount: '2 oz' }], bars: [] };
const NEGRONI = { canonical: 'Negroni', name: 'Negroni', ingredients: ['gin', 'campari', 'sweet vermouth'], family_id: 1, build: 'stir' };

describe('Report link placement', () => {
  it('appears on a user copy and sends nothing about the signed-in reporter', async () => {
    const send = vi.fn(async () => {});
    render(<SharedRecipePage route={{ id: ID }} loadShared={async () => DOC} loadNodes={async () => new Map()} loadData={async () => ({})} sendReport={send} />);
    await waitFor(() => expect(screen.getByTestId('report-open')).toBeTruthy());
    fill('spam');
    fireEvent.click(screen.getByTestId('report-send'));
    await screen.findByTestId('report-thanks');
    expect(JSON.stringify(send.mock.calls[0][0])).not.toContain('secret-uid');
  });
  it('never appears on a built-in recipe page', async () => {
    const data = async () => ({ cocktails: [NEGRONI], families: [] });
    render(<SharedRecipePage route={{ kind: 'cocktail', slug: 'negroni' }} loadData={data} loadNodes={async () => new Map()} loadShared={vi.fn()} />);
    await screen.findByTestId('shared-name');
    expect(screen.queryByTestId('report-open')).toBeNull();
    expect(screen.queryByTestId('shared-report-slot')).toBeNull();
  });
});
