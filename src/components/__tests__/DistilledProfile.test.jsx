/**
 * DistilledProfile.test.jsx — locks the ingredient-level distilled-profile chips.
 *
 * Locks:
 *   - renders aroma + taste chips from the profile
 *   - null / empty profile renders nothing
 *   - low_confidence terms (taste "salty", aroma via "odor_spicy") get the
 *     dashed/dimmed treatment; normal terms stay solid
 *   - chef vs llm-distilled provenance caption
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import DistilledProfile from '../DistilledProfile.jsx';

afterEach(() => cleanup());

describe('DistilledProfile', () => {
  it('renders nothing for null or empty profile', () => {
    const { container: c1 } = render(<DistilledProfile profile={null} />);
    expect(c1.firstChild).toBeNull();
    const { container: c2 } = render(<DistilledProfile profile={{ aromas: [], tastes: [] }} />);
    expect(c2.firstChild).toBeNull();
  });

  it('renders aroma and taste chips', () => {
    const { getByText } = render(
      <DistilledProfile profile={{ aromas: ['fruity', 'green'], tastes: ['sweet', 'sour'], source: 'llm-distilled', low_confidence: [] }} />
    );
    expect(getByText('fruity')).toBeTruthy();
    expect(getByText('green')).toBeTruthy();
    expect(getByText('sweet')).toBeTruthy();
    expect(getByText('sour')).toBeTruthy();
  });

  it('dims low-confidence terms (salty taste + odor_spicy aroma) and keeps others solid', () => {
    const { getByText } = render(
      <DistilledProfile profile={{ aromas: ['spicy', 'woody'], tastes: ['salty', 'umami'], source: 'llm-distilled', low_confidence: ['salty', 'odor_spicy'] }} />
    );
    expect(getByText('spicy').style.borderStyle).toBe('dashed');   // odor_spicy flagged
    expect(getByText('salty').style.borderStyle).toBe('dashed');   // salty flagged
    expect(getByText('woody').style.borderStyle).toBe('solid');    // normal
    expect(getByText('umami').style.borderStyle).toBe('solid');    // normal
  });

  it('shows chef vs distilled provenance', () => {
    const { getByText, rerender, queryByText } = render(
      <DistilledProfile profile={{ aromas: ['fruity'], tastes: ['sweet'], source: 'chef', low_confidence: [] }} />
    );
    expect(getByText(/Chef-curated/i)).toBeTruthy();
    rerender(<DistilledProfile profile={{ aromas: ['fruity'], tastes: ['sweet'], source: 'llm-distilled', low_confidence: [] }} />);
    expect(getByText(/Distilled flavor profile/i)).toBeTruthy();
    expect(queryByText(/Chef-curated/i)).toBeNull();
  });
});
