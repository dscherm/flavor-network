// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import LabsPanel from '../LabsPanel.jsx';

afterEach(cleanup);

describe('LabsPanel', () => {
  it('renders a card for each of the five labs', () => {
    render(<LabsPanel onPick={vi.fn()} />);
    expect(screen.getByTestId('labs-panel')).toBeTruthy();
    for (const id of ['cocktail', 'sauce', 'cookbook', 'pairing', 'recipe']) {
      expect(screen.getByTestId(`labs-card-${id}`)).toBeTruthy();
    }
  });

  it('clicking a lab card fires onPick with that lab id', () => {
    const onPick = vi.fn();
    render(<LabsPanel onPick={onPick} />);
    fireEvent.click(screen.getByTestId('labs-card-pairing'));
    expect(onPick).toHaveBeenCalledWith('pairing');
    fireEvent.click(screen.getByTestId('labs-card-cocktail'));
    expect(onPick).toHaveBeenCalledWith('cocktail');
  });
});
