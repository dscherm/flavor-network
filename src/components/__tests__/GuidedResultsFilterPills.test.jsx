import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import GuidedResultsFilterPills from '../GuidedResultsFilterPills.jsx';

describe('GuidedResultsFilterPills', () => {
  it('renders 4 pills with current selection aria-checked correctly', () => {
    render(
      <GuidedResultsFilterPills current="taste" onSelect={vi.fn()} />,
    );

    const pills = screen.getAllByRole('radio');
    expect(pills).toHaveLength(4);

    // 'taste' pill is checked
    const tastePill = screen.getByRole('radio', { name: /taste/i });
    expect(tastePill).toHaveAttribute('aria-checked', 'true');

    // all others are unchecked
    const aromaPill  = screen.getByRole('radio', { name: /aroma/i });
    const seasonPill = screen.getByRole('radio', { name: /season/i });
    const regionPill = screen.getByRole('radio', { name: /region/i });
    expect(aromaPill).toHaveAttribute('aria-checked', 'false');
    expect(seasonPill).toHaveAttribute('aria-checked', 'false');
    expect(regionPill).toHaveAttribute('aria-checked', 'false');
  });

  it('tapping a different pill fires onSelect with that type exactly once', () => {
    const onSelect = vi.fn();
    render(
      <GuidedResultsFilterPills current="taste" onSelect={onSelect} />,
    );

    const aromaPill = screen.getByRole('radio', { name: /aroma/i });
    fireEvent.click(aromaPill);

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith('aroma');
  });

  it('single-select semantics: only one pill has aria-checked="true"', () => {
    render(
      <GuidedResultsFilterPills current="cuisine" onSelect={vi.fn()} />,
    );

    const pills = screen.getAllByRole('radio');
    const checkedPills = pills.filter(
      (p) => p.getAttribute('aria-checked') === 'true',
    );
    expect(checkedPills).toHaveLength(1);
  });

  it('tapping the active pill does NOT fire onSelect', () => {
    const onSelect = vi.fn();
    render(
      <GuidedResultsFilterPills current="aroma" onSelect={onSelect} />,
    );

    const aromaPill = screen.getByRole('radio', { name: /aroma/i });
    fireEvent.click(aromaPill);

    expect(onSelect).not.toHaveBeenCalled();
  });
});
