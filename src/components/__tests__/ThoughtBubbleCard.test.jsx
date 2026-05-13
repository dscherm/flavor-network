import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ThoughtBubbleCard from '../ThoughtBubbleCard.jsx';

describe('ThoughtBubbleCard', () => {
  it('renders the label in the closed state', () => {
    render(
      <ThoughtBubbleCard
        bubbleKey="cuisine"
        label="Goes with a cuisine"
        selected={false}
        expanded={false}
        onToggleExpand={() => {}}
      >
        <div data-testid="child">child content</div>
      </ThoughtBubbleCard>,
    );
    expect(screen.getByText('Goes with a cuisine')).toBeInTheDocument();
  });

  it('renders children inside the disclosure when expanded=true', () => {
    render(
      <ThoughtBubbleCard
        bubbleKey="cuisine"
        label="Goes with a cuisine"
        selected={false}
        expanded={true}
        onToggleExpand={() => {}}
      >
        <div data-testid="child">child content</div>
      </ThoughtBubbleCard>,
    );
    const details = document.querySelector('details[data-bubble-key="cuisine"]');
    expect(details).toBeTruthy();
    expect(details.open).toBe(true);
    expect(screen.getByTestId('child')).toBeInTheDocument();
  });

  it('shows the summary chip on desktop when selected and not expanded', () => {
    render(
      <ThoughtBubbleCard
        bubbleKey="season"
        label="Goes with a season"
        selected={true}
        summaryChip="summer"
        expanded={false}
        onToggleExpand={() => {}}
      >
        <div />
      </ThoughtBubbleCard>,
    );
    expect(screen.getByText('summer')).toBeInTheDocument();
  });

  it('hides the summary chip when expanded', () => {
    render(
      <ThoughtBubbleCard
        bubbleKey="season"
        label="Goes with a season"
        selected={true}
        summaryChip="summer"
        expanded={true}
        onToggleExpand={() => {}}
      >
        <div />
      </ThoughtBubbleCard>,
    );
    // Summary chip is conditionally rendered only when (!expanded);
    // when expanded the chip should not appear.
    expect(screen.queryByText('summer')).toBeNull();
  });

  it('fires onToggleExpand when summary is clicked', () => {
    const onToggle = vi.fn();
    render(
      <ThoughtBubbleCard
        bubbleKey="cuisine"
        label="Goes with a cuisine"
        selected={false}
        expanded={false}
        onToggleExpand={onToggle}
      >
        <div />
      </ThoughtBubbleCard>,
    );
    const summary = document.querySelector('summary');
    fireEvent.click(summary);
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('summary is keyboard-focusable (default <summary> behavior)', () => {
    render(
      <ThoughtBubbleCard
        bubbleKey="cuisine"
        label="Goes with a cuisine"
        selected={false}
        expanded={false}
        onToggleExpand={() => {}}
      >
        <div />
      </ThoughtBubbleCard>,
    );
    const summary = document.querySelector('summary');
    summary.focus();
    expect(document.activeElement).toBe(summary);
  });

  it('aria-expanded reflects the expanded prop', () => {
    const { rerender } = render(
      <ThoughtBubbleCard
        bubbleKey="cuisine"
        label="Goes with a cuisine"
        selected={false}
        expanded={false}
        onToggleExpand={() => {}}
      >
        <div />
      </ThoughtBubbleCard>,
    );
    expect(document.querySelector('summary').getAttribute('aria-expanded')).toBe('false');
    rerender(
      <ThoughtBubbleCard
        bubbleKey="cuisine"
        label="Goes with a cuisine"
        selected={false}
        expanded={true}
        onToggleExpand={() => {}}
      >
        <div />
      </ThoughtBubbleCard>,
    );
    expect(document.querySelector('summary').getAttribute('aria-expanded')).toBe('true');
  });

  it('exposes selected state via data-selected attr', () => {
    render(
      <ThoughtBubbleCard
        bubbleKey="cuisine"
        label="Goes with a cuisine"
        selected={true}
        expanded={false}
        onToggleExpand={() => {}}
      >
        <div />
      </ThoughtBubbleCard>,
    );
    const details = document.querySelector('details[data-bubble-key="cuisine"]');
    expect(details.getAttribute('data-selected')).toBe('true');
  });
});
