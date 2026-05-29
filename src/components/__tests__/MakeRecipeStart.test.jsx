// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import MakeRecipeStart from '../MakeRecipeStart.jsx';

function mountPicker(overrides = {}) {
  const setters = {
    setRecipeHandoff: vi.fn(),
    setRecipeMounted: vi.fn(),
    setActiveTab: vi.fn(),
    setCookbookPickerMode: vi.fn(),
    ...overrides,
  };
  render(<MakeRecipeStart {...setters} />);
  return setters;
}

describe('MakeRecipeStart — 3-card picker (MAKE-PICKER §2)', () => {
  beforeEach(() => {
    if (typeof globalThis.ResizeObserver === 'undefined') {
      globalThis.ResizeObserver = class {
        observe() {} unobserve() {} disconnect() {}
      };
    }
  });

  it('renders 3 cards in spec order: existing, scratch, photo', () => {
    mountPicker();
    const cards = screen.getAllByRole('button');
    expect(cards.length).toBeGreaterThanOrEqual(3);
    expect(cards[0]).toHaveAttribute('data-testid', 'make-card-existing');
    expect(cards[1]).toHaveAttribute('data-testid', 'make-card-scratch');
    expect(cards[2]).toHaveAttribute('data-testid', 'make-card-photo');
  });

  it('card copy matches §2.3 exactly', () => {
    mountPicker();
    expect(screen.getByText('Existing recipe')).toBeInTheDocument();
    expect(screen.getByText('Pick from your Cookbook')).toBeInTheDocument();
    expect(screen.getByText('Start from scratch')).toBeInTheDocument();
    expect(screen.getByText('Empty Recipe Lab')).toBeInTheDocument();
    expect(screen.getByText('Upload a photo')).toBeInTheDocument();
    expect(
      screen.getByText(
        "We'll add the image; you fill in ingredients (parsing coming later)",
      ),
    ).toBeInTheDocument();
  });

  it('aria-label on each card is "${title}. ${subtitle}"', () => {
    mountPicker();
    expect(screen.getByLabelText('Existing recipe. Pick from your Cookbook')).toBeInTheDocument();
    expect(screen.getByLabelText('Start from scratch. Empty Recipe Lab')).toBeInTheDocument();
    expect(
      screen.getByLabelText(
        "Upload a photo. We'll add the image; you fill in ingredients (parsing coming later)",
      ),
    ).toBeInTheDocument();
  });

  it('container is role=region aria-label="Make a recipe"', () => {
    mountPicker();
    expect(screen.getByRole('region', { name: 'Make a recipe' })).toBeInTheDocument();
  });

  it('clicking "existing" sets cookbookPickerMode="make" + activeTab="cookbook"', () => {
    const s = mountPicker();
    fireEvent.click(screen.getByTestId('make-card-existing'));
    expect(s.setCookbookPickerMode).toHaveBeenCalledWith('make');
    expect(s.setActiveTab).toHaveBeenCalledWith('cookbook');
    expect(s.setRecipeHandoff).not.toHaveBeenCalled();
  });

  it('clicking "scratch" emits recipeHandoff with empty bowl + source="make-scratch"', () => {
    const s = mountPicker();
    fireEvent.click(screen.getByTestId('make-card-scratch'));
    expect(s.setRecipeHandoff).toHaveBeenCalledTimes(1);
    const payload = s.setRecipeHandoff.mock.calls[0][0];
    expect(payload.source).toBe('make-scratch');
    expect(payload.ingredients).toEqual([]);
    expect(payload.image).toBeNull();
    expect(payload.recipeType).toBeNull();
    expect(typeof payload.ts).toBe('number');
    expect(s.setRecipeMounted).toHaveBeenCalledWith(true);
    expect(s.setActiveTab).toHaveBeenCalledWith('recipe');
  });

  it('clicking "photo" opens the file picker (does not emit handoff yet)', () => {
    const s = mountPicker();
    const input = screen.getByTestId('make-photo-input');
    const clickSpy = vi.spyOn(input, 'click');
    fireEvent.click(screen.getByTestId('make-card-photo'));
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(s.setRecipeHandoff).not.toHaveBeenCalled();
  });

  it('picking an image emits recipeHandoff with image=<File> + source="make-photo"', () => {
    const s = mountPicker();
    const input = screen.getByTestId('make-photo-input');
    const file = new File(['x'], 'dish.png', { type: 'image/png' });
    fireEvent.change(input, { target: { files: [file] } });
    expect(s.setRecipeHandoff).toHaveBeenCalledTimes(1);
    const payload = s.setRecipeHandoff.mock.calls[0][0];
    expect(payload.source).toBe('make-photo');
    expect(payload.image).toBe(file);
    expect(payload.ingredients).toEqual([]);
    expect(s.setRecipeMounted).toHaveBeenCalledWith(true);
    expect(s.setActiveTab).toHaveBeenCalledWith('recipe');
  });

  it('cancelling the file picker (no file) is a NO-OP', () => {
    const s = mountPicker();
    const input = screen.getByTestId('make-photo-input');
    fireEvent.change(input, { target: { files: [] } });
    expect(s.setRecipeHandoff).not.toHaveBeenCalled();
    expect(s.setRecipeMounted).not.toHaveBeenCalled();
  });

  it('picking a non-image (e.g. text/plain) is a NO-OP', () => {
    const s = mountPicker();
    const input = screen.getByTestId('make-photo-input');
    const txt = new File(['x'], 'notes.txt', { type: 'text/plain' });
    fireEvent.change(input, { target: { files: [txt] } });
    expect(s.setRecipeHandoff).not.toHaveBeenCalled();
  });

  it('first focus on mount lands on the existing card', () => {
    mountPicker();
    expect(document.activeElement).toBe(screen.getByTestId('make-card-existing'));
  });
});
