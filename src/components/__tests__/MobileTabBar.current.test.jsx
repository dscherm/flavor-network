// @vitest-environment jsdom
// LOOK-4: in the bottom tab bar only the current tab carries the Accent; the current tab is also
// marked by a drawn underline, a heavier label and aria-current. Sign in is current on the
// signed-out profile page (Labs is not).
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import MobileTabBar from '../MobileTabBar.jsx';
import { ACCENT } from '../inventUi.jsx';

const toRgb = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
};
const ACCENT_RGB = toRgb(ACCENT);

function mount(props = {}) {
  return render(<MobileTabBar activeTab="cocktail" onTabChange={vi.fn()} onOpenHowItWorks={vi.fn()} onHome={vi.fn()} user={null} {...props} />);
}
const ids = ['tabbar-home', 'tabbar-signin', 'tabbar-labs', 'tabbar-howto'];
const accented = () => ids.filter((id) => { const b = screen.queryByTestId(id); return b && b.style.color === ACCENT_RGB; });
const current = () => ids.filter((id) => screen.queryByTestId(id)?.getAttribute('aria-current') === 'page');

describe('MobileTabBar current tab', () => {
  it('on a lab screen only Labs is current and accented, with a drawn underline', () => {
    mount({ activeTab: 'cocktail' });
    expect(accented()).toEqual(['tabbar-labs']);
    expect(current()).toEqual(['tabbar-labs']);
    expect(screen.getByTestId('tabbar-labs').querySelector('[data-chalk="underline"]')).not.toBeNull();
    expect(screen.getByTestId('tabbar-labs').querySelector('span').style.fontWeight).toBe('600');
    expect(screen.getByTestId('tabbar-labs').textContent).toContain('Labs');
  });

  it('signed out on the profile page, Sign in is current and Labs is not', () => {
    mount({ activeTab: 'profile', user: null });
    expect(accented()).toEqual(['tabbar-signin']);
    expect(current()).toEqual(['tabbar-signin']);
  });

  it('signed in on the profile page, Labs is current', () => {
    mount({ activeTab: 'profile', user: { uid: 'u' } });
    expect(current()).toEqual(['tabbar-labs']);
  });

  it('with no current screen nothing carries the Accent', () => {
    mount({ activeTab: 'network' });
    expect(accented()).toEqual([]);
    expect(current()).toEqual([]);
  });

  it('How-to is never current, and reports its sheet through aria-expanded', () => {
    mount({ activeTab: 'cocktail', howItWorksOpen: true });
    expect(screen.getByTestId('tabbar-howto').getAttribute('aria-current')).toBeNull();
    expect(screen.getByTestId('tabbar-howto').getAttribute('aria-expanded')).toBe('true');
  });

  it('every tab is a drawn icon (aria-hidden) beside a label, and no tab uses a stock svg', () => {
    mount();
    for (const id of ids) {
      const b = screen.getByTestId(id);
      expect(b.querySelectorAll('svg[data-icon]').length).toBe(1);
      expect(b.getAttribute('aria-label')).toBeTruthy();
    }
  });

  it('the open Labs menu marks the current lab and puts the drawn help icon on How it works', () => {
    mount({ activeTab: 'sauce' });
    fireEvent.click(screen.getByTestId('tabbar-labs'));
    expect(screen.getByTestId('tabbar-labs-item-sauce').getAttribute('aria-current')).toBe('page');
    expect(screen.getByTestId('tabbar-labs-item-cocktail').getAttribute('aria-current')).toBeNull();
    expect(screen.getByTestId('tabbar-labs-item-how-it-works').querySelector('svg[data-icon="help"]')).not.toBeNull();
  });
});
