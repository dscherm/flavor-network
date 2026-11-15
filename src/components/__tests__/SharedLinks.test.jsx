// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import SharedLinks from '../SharedLinks.jsx';

const SHARES = [
  { id: 'abcdefghjk', kind: 'cocktail', name: 'Grandma Sour', createdAt: Date.UTC(2026, 10, 15) },
  { id: 'mnpqrstuvw', kind: 'sauce', name: '<b>Hot</b> sauce', createdAt: 0 },
];
const getDb = async () => ({ fake: 'db' });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('SharedLinks (Profile)', () => {
  it('renders nothing when there are no shares', () => {
    const { container } = render(<SharedLinks shares={[]} />);
    expect(container.firstChild).toBeNull();
    const again = render(<SharedLinks shares={undefined} />);
    expect(again.container.firstChild).toBeNull();
  });

  it('lists each live share with its name and link, names as plain text', () => {
    render(<SharedLinks shares={SHARES} origin="https://neuralflavor.web.app" getDb={getDb} />);
    const rows = screen.getAllByTestId('shared-link-row');
    expect(rows).toHaveLength(2);
    expect(rows[0].textContent).toContain('Grandma Sour');
    expect(rows[0].textContent).toContain('https://neuralflavor.web.app/r/abcdefghjk');
    expect(rows[1].textContent).toContain('<b>Hot</b> sauce');
    expect(rows[1].querySelector('b')).toBeNull();
  });

  it('Copy link copies the absolute link', async () => {
    const writeText = vi.fn(async () => {});
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    render(<SharedLinks shares={SHARES} origin="https://neuralflavor.web.app" getDb={getDb} />);
    fireEvent.click(screen.getAllByTestId('shared-link-copy')[0]);
    await waitFor(() => expect(writeText).toHaveBeenCalledWith('https://neuralflavor.web.app/r/abcdefghjk'));
    expect((await screen.findByTestId('shared-link-status')).textContent).toBe('Link copied');
  });

  it('Unshare asks first; Keep it cancels without touching anything', () => {
    const unshareFn = vi.fn();
    render(<SharedLinks shares={SHARES} getDb={getDb} unshareFn={unshareFn} />);
    fireEvent.click(screen.getAllByTestId('shared-link-unshare')[0]);
    expect(screen.getByTestId('shared-link-confirm')).toBeTruthy();
    fireEvent.click(screen.getByTestId('shared-link-keep'));
    expect(screen.queryByTestId('shared-link-confirm')).toBeNull();
    expect(unshareFn).not.toHaveBeenCalled();
  });

  it('confirming marks it removed through the store and tells the profile to drop it', async () => {
    const unshareFn = vi.fn(async () => {});
    const onRemoved = vi.fn();
    render(<SharedLinks shares={SHARES} getDb={getDb} unshareFn={unshareFn} onRemoved={onRemoved} />);
    fireEvent.click(screen.getAllByTestId('shared-link-unshare')[0]);
    fireEvent.click(screen.getByTestId('shared-link-confirm'));
    await waitFor(() => expect(onRemoved).toHaveBeenCalledWith('abcdefghjk'));
    expect(unshareFn).toHaveBeenCalledWith({ fake: 'db' }, 'abcdefghjk');
  });

  it('a failed unshare says so and keeps the entry', async () => {
    const onRemoved = vi.fn();
    render(<SharedLinks shares={SHARES} getDb={getDb} unshareFn={async () => { throw new Error('offline'); }} onRemoved={onRemoved} />);
    fireEvent.click(screen.getAllByTestId('shared-link-unshare')[0]);
    fireEvent.click(screen.getByTestId('shared-link-confirm'));
    expect((await screen.findByTestId('shared-link-status')).textContent).toMatch(/still live/);
    expect(onRemoved).not.toHaveBeenCalled();
  });
});
