// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import ConsentBanner from '../ConsentBanner.jsx';
import UsageSetting from '../UsageSetting.jsx';
import PrivacyPage from '../PrivacyPage.jsx';
import { CONSENT_KEY, __resetUsageForTests } from '../../data/usage.js';

const loader = vi.fn(async () => null);

beforeEach(() => {
  cleanup();
  window.localStorage.clear();
  loader.mockClear();
  __resetUsageForTests({ loader, isLocal: () => false });
});

describe('ConsentBanner', () => {
  it('shows when unanswered and Yes persists and hides it', () => {
    const { unmount } = render(<ConsentBanner />);
    expect(screen.getByText(/Anonymous usage data, no ads/)).toBeTruthy();
    expect(screen.getByRole('link', { name: /what is collected/i }).getAttribute('href')).toBe('/privacy');
    fireEvent.click(screen.getByRole('button', { name: 'Yes' }));
    expect(window.localStorage.getItem(CONSENT_KEY)).toBe('yes');
    expect(screen.queryByTestId('consent-banner')).toBeNull();
    unmount();
    render(<ConsentBanner />);
    expect(screen.queryByTestId('consent-banner')).toBeNull();
  });

  it('No persists, hides it, and loads nothing', () => {
    render(<ConsentBanner />);
    fireEvent.click(screen.getByRole('button', { name: 'No' }));
    expect(window.localStorage.getItem(CONSENT_KEY)).toBe('no');
    expect(screen.queryByTestId('consent-banner')).toBeNull();
    expect(loader).not.toHaveBeenCalled();
  });
});

describe('UsageSetting (Profile)', () => {
  it('reflects the stored answer and changes it', () => {
    window.localStorage.setItem(CONSENT_KEY, 'yes');
    render(<UsageSetting />);
    const sw = screen.getByRole('switch');
    expect(sw.getAttribute('aria-checked')).toBe('true');
    fireEvent.click(sw);
    expect(window.localStorage.getItem(CONSENT_KEY)).toBe('no');
    expect(sw.getAttribute('aria-checked')).toBe('false');
    fireEvent.click(sw);
    expect(window.localStorage.getItem(CONSENT_KEY)).toBe('yes');
  });

  it('is off when unanswered', () => {
    render(<UsageSetting />);
    expect(screen.getByRole('switch').getAttribute('aria-checked')).toBe('false');
  });
});

describe('PrivacyPage', () => {
  it('renders signed out with what is collected and never sent', () => {
    render(<PrivacyPage />);
    expect(screen.getByTestId('privacy-page')).toBeTruthy();
    expect(screen.getByText(/Google Analytics/)).toBeTruthy();
    expect(screen.getByText(/What is never sent/)).toBeTruthy();
    expect(screen.getByText(/Not asked yet/)).toBeTruthy();
  });
  it('says a shared picture is public and the original photo is never uploaded', () => {
    render(<PrivacyPage />);
    const t = screen.getByTestId('privacy-pictures').textContent;
    expect(t).toMatch(/original\s+photo is never uploaded/);
    expect(t).toMatch(/public to anyone who has the link/);
  });
});
