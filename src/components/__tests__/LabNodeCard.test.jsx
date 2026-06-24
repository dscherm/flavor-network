import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import LabNodeCard from '../LabNodeCard.jsx';

describe('LabNodeCard', () => {
  it('renders a cocktail card with cluster, ingredients, prep, cousins + bridges', () => {
    render(
      <LabNodeCard
        kind="cocktail"
        name="Negroni"
        clusterName="Bitter Stirred"
        clusterColor="#fb7185"
        clusterTag="Aperitivo"
        details={[{ label: 'Glass', value: 'Rocks' }, { label: 'Build', value: 'Stirred' }, { label: 'Ice', value: '' }]}
        ingredients={['Gin', 'Campari', 'Sweet Vermouth']}
        prep="Stir with ice, strain over a large cube, garnish with orange."
        likeThis={[{ name: 'Boulevardier', similarity: 0.9, color: '#fb7185' }]}
        bridges={[{ name: 'Martinez', family_name: 'Old-School', color: '#06b6d4' }]}
        onSelect={() => {}}
        onClose={() => {}}
      />,
    );
    expect(screen.getByTestId('lab-node-card')).toHaveAttribute('data-kind', 'cocktail');
    expect(screen.getByRole('heading', { name: 'Negroni' })).toBeInTheDocument();
    expect(screen.getByTestId('lab-node-card-cluster')).toHaveTextContent('Bitter Stirred');
    const ings = screen.getByTestId('lab-node-card-ingredients');
    expect(ings).toHaveTextContent('Gin');
    expect(ings).toHaveTextContent('Campari');
    expect(screen.getByText(/Stir with ice/)).toBeInTheDocument();
    expect(screen.getByTestId('lab-node-card-like-this')).toHaveTextContent('Boulevardier');
    expect(screen.getByTestId('lab-node-card-bridges')).toHaveTextContent('Martinez');
    // Empty detail values are dropped.
    expect(screen.getByText(/Glass:/)).toBeInTheDocument();
    expect(screen.queryByText(/Ice:/)).not.toBeInTheDocument();
  });

  it('renders a sauce card with measured ingredients + pairs-with, no bridges', () => {
    render(
      <LabNodeCard
        kind="sauce"
        name="Béchamel"
        clusterName="Béchamel"
        clusterColor="#86efac"
        clusterTag="MOTHER"
        details={[{ label: 'Cuisine', value: 'French' }]}
        ingredients={[{ name: 'Butter', measure: '2 tbsp' }, { name: 'Flour', measure: '2 tbsp' }, { name: 'Milk', measure: '2 cups' }]}
        prep="Cook a white roux, whisk in warm milk, simmer until nappe."
        likeThis={[{ name: 'Mornay', similarity: 0.8, color: '#86efac' }]}
        pairsWith={['Lasagna', 'Gratin']}
        onSelect={() => {}}
        onClose={() => {}}
      />,
    );
    expect(screen.getByTestId('lab-node-card')).toHaveAttribute('data-kind', 'sauce');
    const ings = screen.getByTestId('lab-node-card-ingredients');
    expect(ings).toHaveTextContent('Butter');
    expect(ings).toHaveTextContent('2 tbsp');
    expect(screen.getByTestId('lab-node-card-like-this')).toHaveTextContent('Mornay');
    expect(screen.getByTestId('lab-node-card-pairs-with')).toHaveTextContent('Lasagna');
    expect(screen.queryByTestId('lab-node-card-bridges')).not.toBeInTheDocument();
  });

  it('renders an already-numbered prep as clean steps (no double numbering)', () => {
    render(
      <LabNodeCard
        kind="cocktail" name="Old Fashioned" clusterName="Boozy" clusterColor="#fb7185"
        ingredients={['Bourbon']}
        prep={'1. Muddle sugar with bitters.\n2. Add bourbon and ice.\n3. Stir and garnish.'}
        onClose={() => {}}
      />,
    );
    const prep = screen.getByTestId('lab-node-card-prep');
    expect(prep.tagName).toBe('OL');
    const items = prep.querySelectorAll('li');
    expect(items).toHaveLength(3);
    // The original "1." enumerator is stripped; our own marker provides "1.".
    expect(items[0].textContent).toContain('Muddle sugar with bitters.');
    expect(items[0].textContent).not.toMatch(/1\.\s*1\./);
  });

  it('Back fires onClose; tapping a cousin fires onSelect', () => {
    const onClose = vi.fn();
    const onSelect = vi.fn();
    render(
      <LabNodeCard
        kind="cocktail" name="Negroni" clusterName="Bitter" clusterColor="#fb7185"
        ingredients={['Gin']}
        likeThis={[{ name: 'Boulevardier', color: '#fb7185' }]}
        onSelect={onSelect} onClose={onClose}
      />,
    );
    fireEvent.click(screen.getByTestId('lab-node-card-back'));
    expect(onClose).toHaveBeenCalled();
    fireEvent.click(screen.getByTestId('labcard-chip-boulevardier'));
    expect(onSelect).toHaveBeenCalledWith('Boulevardier');
  });
});
