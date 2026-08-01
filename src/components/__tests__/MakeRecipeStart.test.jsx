// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

// WEBLINK-4: MakeRecipeStart now reads auth state to decide whether the URL
// import can run. Stub it signed-in so these picker tests stay hermetic and
// don't reach real Firebase Auth.
vi.mock('../../hooks/useAuth.js', () => ({
  default: () => ({
    user: { uid: 'test-user' },
    loading: false,
    authError: null,
    loginWithGoogle: vi.fn(),
    loginWithApple: vi.fn(),
    logout: vi.fn(),
  }),
}));

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

describe('MakeRecipeStart — 4-card picker (MAKE-PICKER §2 + MAKE-WEBLINK-UI)', () => {
  beforeEach(() => {
    if (typeof globalThis.ResizeObserver === 'undefined') {
      globalThis.ResizeObserver = class {
        observe() {} unobserve() {} disconnect() {}
      };
    }
    // jsdom may not provide URL.createObjectURL — stub it so the
    // preview flow (MAKE-PHOTO-PREVIEW-BEFORE-COMMIT) is exercisable.
    if (typeof URL.createObjectURL !== 'function') {
      URL.createObjectURL = vi.fn(() => 'blob:mock-url');
    }
    if (typeof URL.revokeObjectURL !== 'function') {
      URL.revokeObjectURL = vi.fn();
    }
  });

  it('renders 4 cards in spec order: existing, scratch, photo, weblink', () => {
    mountPicker();
    const cards = screen.getAllByRole('button');
    expect(cards.length).toBeGreaterThanOrEqual(4);
    expect(cards[0]).toHaveAttribute('data-testid', 'make-card-existing');
    expect(cards[1]).toHaveAttribute('data-testid', 'make-card-scratch');
    expect(cards[2]).toHaveAttribute('data-testid', 'make-card-photo');
    expect(cards[3]).toHaveAttribute('data-testid', 'make-card-weblink');
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
        "We'll attach the image; you add ingredients by hand",
      ),
    ).toBeInTheDocument();
  });

  it('aria-label on each card is "${title}. ${subtitle}"', () => {
    mountPicker();
    expect(screen.getByLabelText('Existing recipe. Pick from your Cookbook')).toBeInTheDocument();
    expect(screen.getByLabelText('Start from scratch. Empty Recipe Lab')).toBeInTheDocument();
    expect(
      screen.getByLabelText(
        "Upload a photo. We'll attach the image; you add ingredients by hand",
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

  it('picking an image stages the photo into preview (no handoff yet — MAKE-PHOTO-PREVIEW-BEFORE-COMMIT)', () => {
    const s = mountPicker();
    const input = screen.getByTestId('make-photo-input');
    const file = new File(['x'], 'dish.png', { type: 'image/png' });
    fireEvent.change(input, { target: { files: [file] } });
    // Preview should render, but NO handoff yet — user must confirm.
    expect(screen.getByTestId('make-photo-preview')).toBeInTheDocument();
    expect(s.setRecipeHandoff).not.toHaveBeenCalled();
    expect(s.setActiveTab).not.toHaveBeenCalled();
  });

  it('confirming the preview commits the handoff with image=<File> + source="make-photo"', () => {
    const s = mountPicker();
    const input = screen.getByTestId('make-photo-input');
    const file = new File(['x'], 'dish.png', { type: 'image/png' });
    fireEvent.change(input, { target: { files: [file] } });
    fireEvent.click(screen.getByTestId('make-photo-preview-confirm'));
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

  it('picking a non-image (e.g. text/plain) does not commit a handoff', () => {
    const s = mountPicker();
    const input = screen.getByTestId('make-photo-input');
    const txt = new File(['x'], 'notes.txt', { type: 'text/plain' });
    fireEvent.change(input, { target: { files: [txt] } });
    expect(s.setRecipeHandoff).not.toHaveBeenCalled();
  });

  // ===== MAKE-PHOTO-NON-IMAGE-FEEDBACK =====

  it('picking a non-image surfaces an inline friendly error (was silent no-op)', () => {
    mountPicker();
    const input = screen.getByTestId('make-photo-input');
    const txt = new File(['x'], 'notes.txt', { type: 'text/plain' });
    fireEvent.change(input, { target: { files: [txt] } });
    const err = screen.getByTestId('make-photo-error');
    expect(err).toBeInTheDocument();
    expect(err.textContent).toMatch(/jpg|png|heic/i);
    expect(err.getAttribute('role')).toBe('alert');
  });

  it('error includes the picked file type so the user understands what went wrong', () => {
    mountPicker();
    const input = screen.getByTestId('make-photo-input');
    const pdf = new File(['%PDF'], 'recipe.pdf', { type: 'application/pdf' });
    fireEvent.change(input, { target: { files: [pdf] } });
    expect(screen.getByTestId('make-photo-error').textContent).toMatch(/application\/pdf/);
  });

  it('"Try again" button re-opens the file picker', () => {
    mountPicker();
    const input = screen.getByTestId('make-photo-input');
    const txt = new File(['x'], 'notes.txt', { type: 'text/plain' });
    fireEvent.change(input, { target: { files: [txt] } });
    const clickSpy = vi.spyOn(input, 'click');
    fireEvent.click(screen.getByTestId('make-photo-error-retry'));
    expect(clickSpy).toHaveBeenCalledTimes(1);
  });

  it('successful image pick after a non-image pick clears the error', () => {
    mountPicker();
    const input = screen.getByTestId('make-photo-input');
    fireEvent.change(input, { target: { files: [new File(['x'], 'notes.txt', { type: 'text/plain' })] } });
    expect(screen.getByTestId('make-photo-error')).toBeInTheDocument();
    fireEvent.change(input, { target: { files: [new File(['x'], 'dish.png', { type: 'image/png' })] } });
    expect(screen.queryByTestId('make-photo-error')).toBeNull();
  });

  it('cancelling the picker (no file) does not clear an existing error', () => {
    mountPicker();
    const input = screen.getByTestId('make-photo-input');
    fireEvent.change(input, { target: { files: [new File(['x'], 'notes.txt', { type: 'text/plain' })] } });
    expect(screen.getByTestId('make-photo-error')).toBeInTheDocument();
    // Simulate cancel — onChange fires with files: [].
    fireEvent.change(input, { target: { files: [] } });
    expect(screen.getByTestId('make-photo-error')).toBeInTheDocument();
  });

  // ===== MAKE-PHOTO-PREVIEW-BEFORE-COMMIT =====

  it('preview replaces the card list once an image is picked', () => {
    mountPicker();
    expect(screen.getByTestId('make-card-existing')).toBeInTheDocument();
    fireEvent.change(screen.getByTestId('make-photo-input'), {
      target: { files: [new File(['x'], 'dish.png', { type: 'image/png' })] },
    });
    expect(screen.getByTestId('make-photo-preview')).toBeInTheDocument();
    // Cards no longer rendered while preview is up.
    expect(screen.queryByTestId('make-card-existing')).toBeNull();
    expect(screen.queryByTestId('make-card-photo')).toBeNull();
  });

  it('preview renders the chosen image via createObjectURL', () => {
    const createSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:preview-url');
    mountPicker();
    const file = new File(['x'], 'dish.png', { type: 'image/png' });
    fireEvent.change(screen.getByTestId('make-photo-input'), { target: { files: [file] } });
    expect(createSpy).toHaveBeenCalledWith(file);
    const img = screen.getByTestId('make-photo-preview-img');
    expect(img).toHaveAttribute('src', 'blob:preview-url');
    createSpy.mockRestore();
  });

  it('"Pick another" clears the preview AND re-opens the file picker', () => {
    const s = mountPicker();
    const input = screen.getByTestId('make-photo-input');
    fireEvent.change(input, { target: { files: [new File(['x'], 'dish.png', { type: 'image/png' })] } });
    expect(screen.getByTestId('make-photo-preview')).toBeInTheDocument();
    const clickSpy = vi.spyOn(input, 'click');
    fireEvent.click(screen.getByTestId('make-photo-preview-pick-another'));
    expect(screen.queryByTestId('make-photo-preview')).toBeNull();
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(s.setRecipeHandoff).not.toHaveBeenCalled();
  });

  it('"Pick another" revokes the previous object URL (no leak)', () => {
    const revokeSpy = vi.spyOn(URL, 'revokeObjectURL');
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:first');
    mountPicker();
    fireEvent.change(screen.getByTestId('make-photo-input'), {
      target: { files: [new File(['x'], 'dish.png', { type: 'image/png' })] },
    });
    fireEvent.click(screen.getByTestId('make-photo-preview-pick-another'));
    expect(revokeSpy).toHaveBeenCalledWith('blob:first');
    revokeSpy.mockRestore();
  });

  it('picking a new image (after Pick another) replaces the preview with the new file', () => {
    vi.spyOn(URL, 'createObjectURL')
      .mockReturnValueOnce('blob:first')
      .mockReturnValueOnce('blob:second');
    mountPicker();
    const input = screen.getByTestId('make-photo-input');
    fireEvent.change(input, { target: { files: [new File(['1'], 'first.png', { type: 'image/png' })] } });
    expect(screen.getByTestId('make-photo-preview-img')).toHaveAttribute('src', 'blob:first');
    fireEvent.change(input, { target: { files: [new File(['2'], 'second.png', { type: 'image/png' })] } });
    expect(screen.getByTestId('make-photo-preview-img')).toHaveAttribute('src', 'blob:second');
  });

  it('clicking the Photo card clears any prior non-image error before opening picker', () => {
    mountPicker();
    const input = screen.getByTestId('make-photo-input');
    fireEvent.change(input, { target: { files: [new File(['x'], 'notes.txt', { type: 'text/plain' })] } });
    expect(screen.getByTestId('make-photo-error')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('make-card-photo'));
    expect(screen.queryByTestId('make-photo-error')).toBeNull();
  });

  it('first focus on mount lands on the existing card', () => {
    mountPicker();
    expect(document.activeElement).toBe(screen.getByTestId('make-card-existing'));
  });
});
