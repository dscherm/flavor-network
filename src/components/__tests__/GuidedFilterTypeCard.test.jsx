import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import GuidedFilterTypeCard from '../GuidedFilterTypeCard.jsx';

describe('GuidedFilterTypeCard', () => {
  it('renders heading, 4 pills, and a disabled Got-it button', () => {
    render(<GuidedFilterTypeCard onCommit={vi.fn()} />);

    expect(
      screen.getByText('Discover pairings that are…'),
    ).toBeInTheDocument();

    // 4 pills by role=radio
    const pills = screen.getAllByRole('radio');
    expect(pills).toHaveLength(4);

    // Got-it is disabled on initial render
    const btn = screen.getByRole('button', { name: /got it/i });
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute('aria-disabled', 'true');
  });

  it('clicking a pill highlights it and enables Got-it', () => {
    render(<GuidedFilterTypeCard onCommit={vi.fn()} />);

    const tastePill = screen.getByRole('radio', { name: /a taste/i });
    fireEvent.click(tastePill);

    expect(tastePill).toHaveAttribute('aria-checked', 'true');

    const btn = screen.getByRole('button', { name: /got it/i });
    expect(btn).not.toBeDisabled();
    expect(btn).toHaveAttribute('aria-disabled', 'false');
  });

  it('clicking Got-it fires onCommit with the chosen type exactly once', () => {
    const onCommit = vi.fn();
    render(<GuidedFilterTypeCard onCommit={onCommit} />);

    const aromaPill = screen.getByRole('radio', { name: /an aroma/i });
    fireEvent.click(aromaPill);

    const btn = screen.getByRole('button', { name: /got it/i });
    fireEvent.click(btn);

    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith('aroma');
  });

  it('single-select: second pill click deselects the first', () => {
    render(<GuidedFilterTypeCard onCommit={vi.fn()} />);

    const tastePill = screen.getByRole('radio', { name: /a taste/i });
    const seasonPill = screen.getByRole('radio', { name: /in season/i });

    fireEvent.click(tastePill);
    expect(tastePill).toHaveAttribute('aria-checked', 'true');

    fireEvent.click(seasonPill);
    expect(seasonPill).toHaveAttribute('aria-checked', 'true');
    expect(tastePill).toHaveAttribute('aria-checked', 'false');

    // All other pills must also be unchecked
    const aromaPill = screen.getByRole('radio', { name: /an aroma/i });
    const cuisinePill = screen.getByRole('radio', { name: /from a region/i });
    expect(aromaPill).toHaveAttribute('aria-checked', 'false');
    expect(cuisinePill).toHaveAttribute('aria-checked', 'false');
  });

  it('a11y: pill group has role=radiogroup + aria-label; Got-it carries aria-disabled', () => {
    render(<GuidedFilterTypeCard onCommit={vi.fn()} />);

    const group = screen.getByRole('radiogroup');
    expect(group).toHaveAttribute('aria-label', 'Filter type');

    const btn = screen.getByRole('button', { name: /got it/i });
    // Initially disabled
    expect(btn).toHaveAttribute('aria-disabled', 'true');

    // After selection, aria-disabled flips
    fireEvent.click(screen.getByRole('radio', { name: /from a region/i }));
    expect(btn).toHaveAttribute('aria-disabled', 'false');
  });

  it('G1 measurable AC: pill icon container resolves to 48px width and height', () => {
    const { container } = render(<GuidedFilterTypeCard onCommit={vi.fn()} />);

    // Each pill has a data-filter-icon span that holds the 48px icon wrapper
    const iconWrappers = container.querySelectorAll('[data-filter-icon]');
    expect(iconWrappers).toHaveLength(4);

    iconWrappers.forEach((wrapper) => {
      // Inline style sets width/height to 48 (numeric px value)
      expect(wrapper.style.width).toBe('48px');
      expect(wrapper.style.height).toBe('48px');
    });
  });

  it('no auto-advance: onCommit is NOT called after pill selection without Got-it click', () => {
    vi.useFakeTimers();
    const onCommit = vi.fn();
    render(<GuidedFilterTypeCard onCommit={onCommit} />);

    fireEvent.click(screen.getByRole('radio', { name: /a taste/i }));

    vi.advanceTimersByTime(5000);

    expect(onCommit).not.toHaveBeenCalled();
    vi.useRealTimers();
  });
});
