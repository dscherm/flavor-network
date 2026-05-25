import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import TierBadge from '../TierBadge.jsx';

describe('TierBadge', () => {
  it('renders Tier-2 superscript with accessible label', () => {
    render(<TierBadge tier={2} />);
    const badge = screen.getByLabelText('Tier-2 taste');
    expect(badge.tagName).toBe('SUP');
    expect(badge.textContent).toBe('²');
  });

  it('renders Tier-3 superscript with accessible label', () => {
    render(<TierBadge tier={3} />);
    const badge = screen.getByLabelText('Tier-3 mouthfeel');
    expect(badge.textContent).toBe('³');
  });

  it('renders pill variant when variant="pill"', () => {
    render(<TierBadge tier={2} variant="pill" />);
    const badge = screen.getByLabelText('Tier-2 taste');
    expect(badge.tagName).toBe('SPAN');
    expect(badge.textContent).toBe('T2');
  });

  it('renders nothing for an unknown tier', () => {
    const { container } = render(<TierBadge tier={5} />);
    expect(container.firstChild).toBeNull();
  });
});
