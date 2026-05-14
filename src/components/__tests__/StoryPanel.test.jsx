// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import StoryPanel from '../StoryPanel.jsx';

const baseStory = {
  causalSentence: 'Our pairing engine ranked this from recipe co-occurrence in 50,312 pairings.',
  annotativeSentence: null,
  isAnnotativeCompoundUsedByRuntime: false,
  citationsIfAny: [],
  surpriseAxesMatched: [],
};

describe('StoryPanel', () => {
  it('renders causal sentence when story is supplied', () => {
    render(<StoryPanel story={baseStory} />);
    expect(screen.getByTestId('story-causal').textContent).toMatch(/50,312 pairings/);
  });

  it('does not render annotative sentence when null', () => {
    render(<StoryPanel story={baseStory} />);
    expect(screen.queryByTestId('story-annotative')).toBeNull();
    expect(screen.queryByTestId('story-annotation-disclaimer')).toBeNull();
  });

  it('renders annotative sentence when non-null', () => {
    const story = {
      ...baseStory,
      annotativeSentence: 'Both share limonene (citrus, fresh).',
      isAnnotativeCompoundUsedByRuntime: true,
    };
    render(<StoryPanel story={story} />);
    expect(screen.getByTestId('story-annotative').textContent).toMatch(/limonene/);
  });

  it('renders the disclaimer chip iff isAnnotativeCompoundUsedByRuntime === false AND annotative non-null', () => {
    // Case 1: annotative present + not used → chip renders
    const { rerender } = render(
      <StoryPanel
        story={{
          ...baseStory,
          annotativeSentence: 'Both share limonene.',
          isAnnotativeCompoundUsedByRuntime: false,
        }}
      />,
    );
    expect(screen.getByTestId('story-annotation-disclaimer')).toBeInTheDocument();

    // Case 2: annotative present + used → chip does NOT render
    rerender(
      <StoryPanel
        story={{
          ...baseStory,
          annotativeSentence: 'Both share limonene.',
          isAnnotativeCompoundUsedByRuntime: true,
        }}
      />,
    );
    expect(screen.queryByTestId('story-annotation-disclaimer')).toBeNull();

    // Case 3: annotative null → chip does NOT render
    rerender(<StoryPanel story={baseStory} />);
    expect(screen.queryByTestId('story-annotation-disclaimer')).toBeNull();
  });

  it('renders citation chips with correct external link attributes', () => {
    const story = {
      ...baseStory,
      citationsIfAny: [
        { ref: 'Flavor Bible p. 281', url: 'https://example.com/fb-281' },
      ],
    };
    render(<StoryPanel story={story} />);
    const chip = screen.getByTestId('story-citation-chip');
    expect(chip.tagName).toBe('A');
    expect(chip.getAttribute('href')).toBe('https://example.com/fb-281');
    expect(chip.getAttribute('target')).toBe('_blank');
    expect(chip.getAttribute('rel')).toMatch(/noopener/);
    expect(chip.getAttribute('rel')).toMatch(/noreferrer/);
  });

  it('renders citation as plain span when no URL is supplied', () => {
    const story = {
      ...baseStory,
      citationsIfAny: [{ ref: 'Chef-cite: Bourdain', url: null }],
    };
    render(<StoryPanel story={story} />);
    const chip = screen.getByTestId('story-citation-chip');
    expect(chip.tagName).toBe('SPAN');
  });

  it('renders surprise badges for each matched axis', () => {
    const story = {
      ...baseStory,
      surpriseAxesMatched: ['cross-cuisine', 'cross-aroma', 'absent-from-books'],
    };
    render(<StoryPanel story={story} />);
    expect(screen.getByTestId('story-surprise-cross-cuisine')).toBeInTheDocument();
    expect(screen.getByTestId('story-surprise-cross-aroma')).toBeInTheDocument();
    expect(screen.getByTestId('story-surprise-absent-from-books')).toBeInTheDocument();
  });

  it('container has aria-live="polite" for screen-reader announcements', () => {
    render(<StoryPanel story={baseStory} />);
    const panel = screen.getByTestId('story-panel');
    expect(panel.getAttribute('aria-live')).toBe('polite');
  });

  it('returns null when story is missing', () => {
    const { container } = render(<StoryPanel story={null} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders pair label when pair is provided', () => {
    render(<StoryPanel story={baseStory} pair={{ ingredientA: 'salmon', ingredientB: 'dill' }} />);
    const panel = screen.getByTestId('story-panel');
    expect(panel.getAttribute('aria-label')).toMatch(/salmon \+ dill/);
  });
});
