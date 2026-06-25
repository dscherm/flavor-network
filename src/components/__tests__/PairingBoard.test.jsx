// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import PairingBoard from '../PairingBoard.jsx';

afterEach(cleanup);

const PARTNERS = [
  { name: 'basil',  strength: 0.9, node: { name: 'basil',  taste: 'bitter' } },
  { name: 'lemon',  strength: 0.8, node: { name: 'lemon',  taste: 'sour' } },
  { name: 'onion',  strength: 0.7, node: { name: 'onion',  taste: 'pungent' } },
];

describe('PairingBoard', () => {
  it('renders an accessible button per partner', () => {
    render(<PairingBoard center="garlic" partners={PARTNERS} lens="affinity" />);
    expect(screen.getByRole('button', { name: 'basil' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'lemon' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'onion' })).toBeTruthy();
  });

  it('clicking a partner fires onSelectPartner with its name', () => {
    const onSelectPartner = vi.fn();
    render(<PairingBoard center="garlic" partners={PARTNERS} onSelectPartner={onSelectPartner} />);
    fireEvent.click(screen.getByRole('button', { name: 'lemon' }));
    expect(onSelectPartner).toHaveBeenCalledWith('lemon');
  });

  it('labels the partner list with the center ingredient', () => {
    render(<PairingBoard center="garlic" partners={PARTNERS} />);
    expect(screen.getByRole('list', { name: /partners of garlic/i })).toBeTruthy();
  });

  it('renders without crashing for an empty partner set', () => {
    const { container } = render(<PairingBoard center="garlic" partners={[]} lens="aroma" />);
    expect(container.querySelectorAll('button')).toHaveLength(0);
  });

  it('does not crash when switching lenses (re-layout)', () => {
    const { rerender } = render(<PairingBoard center="garlic" partners={PARTNERS} lens="affinity" />);
    rerender(<PairingBoard center="garlic" partners={PARTNERS} lens="aroma" />);
    rerender(<PairingBoard center="garlic" partners={PARTNERS} lens="taste" />);
    expect(screen.getByRole('button', { name: 'basil' })).toBeTruthy();
  });

  it('accepts P3 bridges + highlightGroup props without crashing', () => {
    render(
      <PairingBoard
        center="garlic" partners={PARTNERS} lens="season"
        bridges={[{ a: 'basil', b: 'lemon' }]} highlightGroup="Summer"
      />,
    );
    expect(screen.getByRole('button', { name: 'basil' })).toBeTruthy();
  });

  it('exposes a details affordance per partner that fires onPeek', () => {
    const onPeek = vi.fn();
    render(<PairingBoard center="garlic" partners={PARTNERS} onPeek={onPeek} />);
    fireEvent.click(screen.getByRole('button', { name: /details for onion/i }));
    expect(onPeek).toHaveBeenCalledWith('onion');
  });
});
