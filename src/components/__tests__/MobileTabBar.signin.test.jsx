// @vitest-environment jsdom
// WEBLINK-11 (2026-08-01). Reported from an iPhone: "There's not an option
// to sign in anywhere on the app." That was accurate. The bottom bar showed
// only Make / Labs / How-to, and the sole route to sign-in was
// Labs -> Profile -> scroll to the bottom of ProfilePanel — under a menu
// that reads as cocktail/sauce/recipe labs, behind a row described as
// "Saved recipes & insights". Nothing on that path said "sign in".
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import MobileTabBar from '../MobileTabBar.jsx';

function mount(props = {}) {
  const onTabChange = vi.fn();
  render(
    <MobileTabBar
      activeTab="make"
      onTabChange={onTabChange}
      onOpenHowItWorks={vi.fn()}
      {...props}
    />,
  );
  return { onTabChange };
}

describe('MobileTabBar — signed-out sign-in affordance', () => {
  it('shows a top-level Sign in when there is no user', () => {
    mount({ user: null });
    expect(screen.getByTestId('tabbar-signin')).toBeInTheDocument();
    expect(screen.getByLabelText('Sign in')).toBeInTheDocument();
  });

  it('Sign in goes to the screen that actually has the buttons', () => {
    const { onTabChange } = mount({ user: null });
    fireEvent.click(screen.getByTestId('tabbar-signin'));
    expect(onTabChange).toHaveBeenCalledWith('profile');
  });

  it('hides it once signed in, keeping the bar three-wide', () => {
    mount({ user: { uid: 'abc' } });
    expect(screen.queryByTestId('tabbar-signin')).toBeNull();
  });

  it('relabels the Labs popover row for a signed-out user', () => {
    mount({ user: null });
    fireEvent.click(screen.getByTestId('tabbar-labs'));
    const row = screen.getByTestId('tabbar-labs-item-profile');
    expect(row).toHaveTextContent('Sign in');
    expect(row).toHaveTextContent(/import from links/i);
  });

  it('restores the Profile labelling once signed in', () => {
    mount({ user: { uid: 'abc' } });
    fireEvent.click(screen.getByTestId('tabbar-labs'));
    const row = screen.getByTestId('tabbar-labs-item-profile');
    expect(row).toHaveTextContent('Profile');
    expect(row).toHaveTextContent(/Saved recipes/i);
  });

  it('leaves the other tabs untouched in both states', () => {
    mount({ user: null });
    expect(screen.getByTestId('tabbar-make')).toBeInTheDocument();
    expect(screen.getByTestId('tabbar-labs')).toBeInTheDocument();
  });
});
