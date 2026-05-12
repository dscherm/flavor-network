import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import InsightChip, { insightSentence } from '../InsightChip.jsx';

describe('insightSentence', () => {
  it('returns null when filterStack is empty', () => {
    expect(insightSentence({ filterStack: [] })).toBeNull();
  });

  it('cooccurrence-dominant template (pull < 0.30) with a single filter', () => {
    const out = insightSentence({
      filterStack: ['cuisine'],
      pullStrength: 0.1,
      visibleCount: 412,
      morphAxis: 'cuisine',
      bucketCounts: { European: 100, Americas: 80, 'East Asian': 50, 'SE Asian': 0 },
    });
    expect(out).toBe(
      'Layout shows cooccurrence pairings within cuisine buckets. 3 buckets, 412 ingredients.',
    );
  });

  it('tension template (0.30 ≤ pull ≤ 0.70) is pull-range only', () => {
    const out = insightSentence({
      filterStack: ['cuisine'],
      pullStrength: 0.5,
      visibleCount: 412,
      morphAxis: 'cuisine',
      bucketCounts: { European: 100 },
    });
    expect(out).toBe('Tension layout — strong pairings resist the pull.');
  });

  it('bucket-dominant template (pull > 0.70) names the largest bucket', () => {
    const out = insightSentence({
      filterStack: ['aroma'],
      pullStrength: 0.9,
      visibleCount: 412,
      morphAxis: 'aromas',
      bucketCounts: { Fruity: 120, Floral: 40, Green: 60 },
    });
    expect(out).toBe('Layout shows aroma bucket structure. Largest: Fruity (120).');
  });

  it('multi-filter template overrides pull and surfaces intersection + densest bucket', () => {
    const out = insightSentence({
      filterStack: ['cuisine', 'season', 'aroma'],
      pullStrength: 0.4,
      visibleCount: 27,
      morphAxis: 'aromas',
      bucketCounts: { Fruity: 14, Green: 8, Floral: 5 },
    });
    expect(out).toBe('27 ingredients match Cuisine × Season × Aroma. Densest: Fruity (14).');
  });

  it('singular ingredient uses "matches" instead of "match"', () => {
    const out = insightSentence({
      filterStack: ['cuisine', 'aroma'],
      pullStrength: 0.5,
      visibleCount: 1,
      morphAxis: 'aromas',
      bucketCounts: { Fruity: 1 },
    });
    expect(out).toBe('1 ingredient matches Cuisine × Aroma. Densest: Fruity (1).');
  });

  it('scope-only stack with null morphAxis falls back to a generic cooccurrence line', () => {
    const out = insightSentence({
      filterStack: ['cocktail-scope'],
      pullStrength: 0.1,
      visibleCount: 200,
      morphAxis: null,
      bucketCounts: null,
    });
    expect(out).toBe('Layout shows cooccurrence pairings. 200 ingredients.');
  });

  it('bucket-dominant gracefully degrades when bucketCounts are missing', () => {
    const out = insightSentence({
      filterStack: ['aroma'],
      pullStrength: 0.9,
      visibleCount: 0,
      morphAxis: 'aromas',
      bucketCounts: null,
    });
    expect(out).toBe('Layout shows bucket structure.');
  });
});

describe('InsightChip render', () => {
  it('renders nothing when filterStack is empty', () => {
    const { container } = render(<InsightChip filterStack={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders the derived sentence as a note for assistive tech', () => {
    render(
      <InsightChip
        filterStack={['cuisine']}
        pullStrength={0.1}
        visibleCount={412}
        morphAxis="cuisine"
        bucketCounts={{ European: 100, Americas: 80 }}
      />,
    );
    const note = screen.getByRole('note');
    expect(note).toHaveAttribute('aria-label', 'Layout insight');
    expect(note).toHaveTextContent(
      'Layout shows cooccurrence pairings within cuisine buckets. 2 buckets, 412 ingredients.',
    );
  });
});
