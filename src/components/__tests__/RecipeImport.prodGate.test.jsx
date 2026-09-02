import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import RecipeImport from '../RecipeImport.jsx';

// /api/recipe/import exists only behind the Vite dev proxy. Outside dev the
// component must not offer the upload at all (see the comment in the source).
afterEach(() => vi.unstubAllEnvs());

describe('RecipeImport production gate', () => {
  it('hides the uploader and says where it works when not in dev', () => {
    vi.stubEnv('DEV', false);
    render(<RecipeImport onSave={() => {}} />);
    expect(screen.queryByRole('button', { name: /import recipe/i })).toBeNull();
    expect(screen.getByText(/runs locally with the API server/i)).toBeInTheDocument();
  });

  it('shows the uploader in dev', () => {
    vi.stubEnv('DEV', true);
    render(<RecipeImport onSave={() => {}} />);
    expect(screen.getByRole('button', { name: /import recipe/i })).toBeInTheDocument();
  });
});
