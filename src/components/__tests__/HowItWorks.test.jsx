import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import HowItWorks from '../HowItWorks.jsx';

describe('HowItWorks — gestures section (HELP-3)', () => {
  it('documents the 3D interaction grammar when open', () => {
    render(<HowItWorks isOpen onClose={vi.fn()} showButton={false} />);
    const sec = screen.getByTestId('howitworks-gestures');
    expect(sec).toHaveTextContent('Getting around');
    expect(sec).toHaveTextContent(/orbit/i);
    expect(sec).toHaveTextContent(/pinch/i);
    expect(sec).toHaveTextContent(/press & hold/i);
    expect(sec).toHaveTextContent(/Esc/);
    expect(sec).toHaveTextContent(/arrow keys/i);
  });

  it('explains filter stacking, pull-strength, and the Particles toggle (HELP-4)', () => {
    render(<HowItWorks isOpen onClose={vi.fn()} showButton={false} />);
    expect(screen.getByText('stack')).toBeInTheDocument();
    expect(screen.getByText('pull-strength')).toBeInTheDocument();
    expect(screen.getByText('Particles')).toBeInTheDocument();
  });

  it('renders nothing of the modal body when closed', () => {
    render(<HowItWorks isOpen={false} onClose={vi.fn()} showButton={false} />);
    expect(screen.queryByTestId('howitworks-gestures')).toBeNull();
  });

  it('the explore-network teaser closes the card and fires onExploreNetwork', () => {
    const onClose = vi.fn();
    const onExploreNetwork = vi.fn();
    render(<HowItWorks isOpen onClose={onClose} onExploreNetwork={onExploreNetwork} showButton={false} />);
    fireEvent.click(screen.getByTestId('howitworks-explore-network'));
    expect(onClose).toHaveBeenCalled();
    expect(onExploreNetwork).toHaveBeenCalled();
  });
});
