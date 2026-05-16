// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import SwipeDeckCard from '../SwipeDeckCard.jsx';

const makeCards = () => [
  { key: 'a', title: 'First card', body: <div>card-a-body</div> },
  { key: 'b', title: 'Second card', body: <div>card-b-body</div>, required: true, canAdvance: true },
  { key: 'c', title: 'Third card', body: <div>card-c-body</div> },
];

describe('SwipeDeckCard', () => {
  it('renders one card at a time with title + body', () => {
    render(<SwipeDeckCard cards={makeCards()} />);
    expect(screen.getByText('First card')).toBeInTheDocument();
    expect(screen.getByText('card-a-body')).toBeInTheDocument();
    expect(screen.queryByText('Second card')).toBeNull();
  });

  it('Yes advances to next card', async () => {
    render(<SwipeDeckCard cards={makeCards()} />);
    fireEvent.click(screen.getByTestId('swipe-deck-yes-a'));
    // After 220ms transition, the next card should appear.
    await new Promise((r) => setTimeout(r, 260));
    expect(screen.getByText('Second card')).toBeInTheDocument();
  });

  it('No advances and skips the card (calls onNo)', async () => {
    const onNoA = vi.fn();
    const cards = makeCards();
    cards[0].onNo = onNoA;
    render(<SwipeDeckCard cards={cards} />);
    fireEvent.click(screen.getByTestId('swipe-deck-no-a'));
    expect(onNoA).toHaveBeenCalled();
    await new Promise((r) => setTimeout(r, 260));
    expect(screen.getByText('Second card')).toBeInTheDocument();
  });

  it('required cards have no No button', () => {
    // Second card is required. Skip the first card to reach it.
    render(<SwipeDeckCard cards={makeCards()} />);
    fireEvent.click(screen.getByTestId('swipe-deck-yes-a'));
    return new Promise((r) => setTimeout(r, 260)).then(() => {
      expect(screen.getByText('Second card')).toBeInTheDocument();
      expect(screen.queryByTestId('swipe-deck-no-b')).toBeNull();
      // Yes button still present.
      expect(screen.queryByTestId('swipe-deck-yes-b')).toBeInTheDocument();
    });
  });

  it('completes (calls onComplete) after the last card', async () => {
    const onComplete = vi.fn();
    render(<SwipeDeckCard cards={makeCards()} onComplete={onComplete} />);
    // Advance through all 3 cards via Yes (b is required but canAdvance=true).
    fireEvent.click(screen.getByTestId('swipe-deck-yes-a'));
    await new Promise((r) => setTimeout(r, 260));
    fireEvent.click(screen.getByTestId('swipe-deck-yes-b'));
    await new Promise((r) => setTimeout(r, 260));
    fireEvent.click(screen.getByTestId('swipe-deck-yes-c'));
    await new Promise((r) => setTimeout(r, 260));
    expect(onComplete).toHaveBeenCalled();
  });

  it('shows progress indicator with active dot tracking idx', () => {
    const { container } = render(<SwipeDeckCard cards={makeCards()} />);
    // Progress indicator uses class .w-6 on active, .w-3 on inactive.
    const activeDot = container.querySelector('.w-6.bg-cyan-300');
    expect(activeDot).toBeTruthy();
  });

  it('aria-live announces card changes', async () => {
    const { container } = render(<SwipeDeckCard cards={makeCards()} />);
    const live = container.querySelector('[aria-live="polite"]');
    expect(live).toBeTruthy();
    // Initial announcement.
    await new Promise((r) => setTimeout(r, 30));
    expect(live.textContent).toMatch(/First card.*1 of 3/);
  });

  it('empty cards array renders fallback', () => {
    render(<SwipeDeckCard cards={[]} />);
    expect(screen.getByText('No cards available.')).toBeInTheDocument();
  });
});
