import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import FilterPillRow from '../FilterPillRow.jsx';

describe('FilterPillRow — Particles pill (HELP-4)', () => {
  it('renders the particle toggle as "Particles", not the misleading "None"', () => {
    render(<FilterPillRow filterStack={[]} onToggle={vi.fn()} onToggleNone={vi.fn()} />);
    expect(screen.getByText('Particles')).toBeInTheDocument();
    expect(screen.queryByText('None')).toBeNull();
  });

  it('keeps the accurate aria-label and fires onToggleNone', () => {
    const onToggleNone = vi.fn();
    render(<FilterPillRow filterStack={[]} onToggle={vi.fn()} onToggleNone={onToggleNone} />);
    const pill = screen.getByLabelText('Toggle particles flowing across the network');
    expect(pill).toHaveTextContent('Particles');
    fireEvent.click(pill);
    expect(onToggleNone).toHaveBeenCalledTimes(1);
  });

  it('reflects particlesOverride as the checked state', () => {
    const { rerender } = render(<FilterPillRow filterStack={[]} onToggleNone={vi.fn()} particlesOverride={false} />);
    expect(screen.getByLabelText('Toggle particles flowing across the network')).toHaveAttribute('aria-checked', 'false');
    rerender(<FilterPillRow filterStack={[]} onToggleNone={vi.fn()} particlesOverride />);
    expect(screen.getByLabelText('Toggle particles flowing across the network')).toHaveAttribute('aria-checked', 'true');
  });
});
