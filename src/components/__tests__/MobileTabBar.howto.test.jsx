// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import MobileTabBar from '../MobileTabBar.jsx';

afterEach(cleanup);

describe('MobileTabBar — top-level How-to button', () => {
  it('renders a How-to button and fires onOpenHowItWorks on every screen', () => {
    const onOpenHowItWorks = vi.fn();
    render(
      <MobileTabBar
        activeTab="make"
        onTabChange={vi.fn()}
        onSelectLab={vi.fn()}
        onOpenHowItWorks={onOpenHowItWorks}
      />,
    );
    const btn = screen.getByTestId('tabbar-howto');
    expect(btn).toBeTruthy();
    fireEvent.click(btn);
    expect(onOpenHowItWorks).toHaveBeenCalled();
  });
});
