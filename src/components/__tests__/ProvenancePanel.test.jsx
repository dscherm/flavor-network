import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ProvenancePanel from '../ProvenancePanel.jsx';

describe('ProvenancePanel', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders dialog when open=true', () => {
    render(<ProvenancePanel open={true} onClose={() => {}} />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true');
  });

  it('does not render dialog when open=false', () => {
    render(<ProvenancePanel open={false} onClose={() => {}} />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('lists all 7 data sources', () => {
    render(<ProvenancePanel open={true} onClose={() => {}} />);
    expect(screen.getByText('RecipeNLG')).toBeInTheDocument();
    expect(screen.getByText('TheMealDB')).toBeInTheDocument();
    expect(screen.getByText('TheCocktailDB')).toBeInTheDocument();
    expect(screen.getByText('FlavorDB')).toBeInTheDocument();
    expect(screen.getByText('GNN')).toBeInTheDocument();
    expect(screen.getByText('ChemTastesDB v2.1')).toBeInTheDocument();
    expect(screen.getByText('Ground truth')).toBeInTheDocument();
  });

  it('close button fires onClose', () => {
    const onClose = vi.fn();
    render(<ProvenancePanel open={true} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: /close/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('Escape key fires onClose', () => {
    const onClose = vi.fn();
    render(<ProvenancePanel open={true} onClose={onClose} />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
