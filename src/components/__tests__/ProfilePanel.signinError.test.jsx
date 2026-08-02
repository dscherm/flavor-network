// @vitest-environment jsdom
// WEBLINK-14 (2026-08-02). Reported from the TestFlight build: "I click the
// sign in buttons in the ios app and nothing happens."
//
// useAuth has exposed authError since WEBLINK-10, and the weblink sign-in
// panel renders it — but ProfilePanel, where these buttons actually live,
// never received it. App.jsx did not even destructure authError from
// useAuth. So a failed sign-in set the error and nothing displayed it,
// which on a phone is indistinguishable from a dead button.
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import ProfilePanel from '../ProfilePanel.jsx';

function mount(props = {}) {
  render(
    <ProfilePanel
      // Must match useUserProfile's DEFAULT_PROFILE shape — these are
      // arrays that get spread into Sets/Maps downstream, not objects.
      profile={{
        cuisines: [], ingredients: [], recipes: [],
        cocktails: [], sauces: [], pairings: [], quizAnswers: null,
      }}
      actions={{}}
      ingredientList={[]}
      cuisines={[]}
      onClose={vi.fn()}
      user={null}
      onLogin={vi.fn()}
      onLoginWithApple={vi.fn()}
      onLogout={vi.fn()}
      {...props}
    />,
  );
}

describe('ProfilePanel — sign-in failures must be visible (WEBLINK-14)', () => {
  it('renders the auth error next to the sign-in buttons', () => {
    mount({ authError: 'Sign-in was blocked by the browser. Try again.' });
    const err = screen.getByTestId('profile-signin-error');
    expect(err).toHaveTextContent(/blocked by the browser/i);
    expect(err).toHaveAttribute('role', 'alert');
  });

  it('shows nothing when there is no error', () => {
    mount({ authError: null });
    expect(screen.queryByTestId('profile-signin-error')).toBeNull();
  });

  it('does not render the error block once signed in', () => {
    // Signed-in users see the account section, not the sign-in buttons.
    mount({ user: { uid: 'abc' }, authError: 'stale error' });
    expect(screen.queryByTestId('profile-signin-error')).toBeNull();
  });
});
