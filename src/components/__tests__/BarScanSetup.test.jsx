// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import BarScanSetup from '../BarScanSetup.jsx';
import { loadScanKey, loadScanCode, saveScanKey } from '../../data/barScan.js';

const KEY = 'AIzaSyD-SECRETKEY-1234567890abcdefg';
const CODE = 'friend-code-SECRET99';

beforeEach(() => localStorage.clear());
afterEach(() => vi.restoreAllMocks());

describe('BarScanSetup', () => {
  it('says for each choice where the photo goes and what stays on the device', () => {
    render(<BarScanSetup />);
    const code = screen.getByTestId('bar-scan-code-block');
    expect(code).toHaveTextContent('I have a code');
    expect(code).toHaveTextContent("app owner's Google key, through this app's server, and is not stored");
    const key = screen.getByTestId('bar-scan-key-block');
    expect(key).toHaveTextContent('Use my own Google key');
    expect(key).toHaveTextContent('It is free');
    expect(key).toHaveTextContent('stays on this device and is sent only to Google');
    expect(key).toHaveTextContent("straight to Google, and Google's terms for your key apply");
    expect(key).toHaveTextContent('about 20 scans a day');
  });

  it("the intro says how to connect, and never talks of paying", () => {
    const { container } = render(<BarScanSetup />);
    expect(container).toHaveTextContent("Reading labels uses Google's photo reader. Choose how to connect to it; you only do this once.");
    expect(container.textContent).not.toMatch(/pay/i);
  });

  it('links to the key page in a new tab with noopener', () => {
    render(<BarScanSetup />);
    const a = screen.getByTestId('bar-scan-key-link');
    expect(a).toHaveAttribute('href', 'https://aistudio.google.com/apikey');
    expect(a).toHaveAttribute('target', '_blank');
    expect(a.getAttribute('rel')).toMatch(/noopener/);
    expect(a).toHaveTextContent('Get a key from Google AI Studio');
  });

  it('the key box is a password field with autocomplete off', () => {
    render(<BarScanSetup />);
    const input = screen.getByTestId('bar-scan-key-input');
    expect(input).toHaveAttribute('type', 'password');
    expect(input).toHaveAttribute('autocomplete', 'off');
  });

  it('a bad code or key is refused with a message and nothing is saved', () => {
    const onSaved = vi.fn();
    render(<BarScanSetup onSaved={onSaved} />);
    fireEvent.change(screen.getByTestId('bar-scan-code-input'), { target: { value: 'short' } });
    fireEvent.click(screen.getByTestId('bar-scan-code-save'));
    expect(screen.getByTestId('bar-scan-setup-error')).toBeInTheDocument();
    fireEvent.change(screen.getByTestId('bar-scan-key-input'), { target: { value: 'has spaces inside the key value' } });
    fireEvent.click(screen.getByTestId('bar-scan-key-save'));
    expect(loadScanCode()).toBe('');
    expect(loadScanKey()).toBe('');
    expect(onSaved).not.toHaveBeenCalled();
  });

  it('saving a code stores it, masks it, empties the box and continues', () => {
    const onSaved = vi.fn();
    const { container } = render(<BarScanSetup onSaved={onSaved} />);
    fireEvent.change(screen.getByTestId('bar-scan-code-input'), { target: { value: CODE } });
    fireEvent.click(screen.getByTestId('bar-scan-code-save'));
    expect(loadScanCode()).toBe(CODE);
    expect(onSaved).toHaveBeenCalledWith('code');
    expect(screen.getByTestId('bar-scan-masked').textContent.endsWith(CODE.slice(-4))).toBe(true);
    expect(container.innerHTML).not.toContain(CODE);
    expect(screen.getByTestId('bar-scan-code-input').value).toBe('');
  });

  it('saving a key masks it everywhere in the DOM and drops a saved code', () => {
    localStorage.setItem('fn-scan-code', CODE);
    const onSaved = vi.fn();
    const { container } = render(<BarScanSetup onSaved={onSaved} />);
    fireEvent.change(screen.getByTestId('bar-scan-key-input'), { target: { value: KEY } });
    fireEvent.click(screen.getByTestId('bar-scan-key-save'));
    expect(loadScanKey()).toBe(KEY);
    expect(loadScanCode()).toBe('');
    expect(onSaved).toHaveBeenCalledWith('key');
    expect(container.innerHTML).not.toContain(KEY);
    expect(container.innerHTML).not.toContain(KEY.slice(0, 12));
    expect(within(screen.getByTestId('bar-scan-saved')).getByTestId('bar-scan-masked').textContent).toContain(KEY.slice(-4));
  });

  it('shows what is saved and Remove clears it', () => {
    saveScanKey(KEY);
    render(<BarScanSetup />);
    expect(screen.getByTestId('bar-scan-saved')).toHaveTextContent('own Google key');
    fireEvent.click(screen.getByTestId('bar-scan-remove'));
    expect(loadScanKey()).toBe('');
    expect(screen.queryByTestId('bar-scan-saved')).toBeNull();
  });

  it('never writes the key or code to the console', () => {
    const spies = ['log', 'info', 'warn', 'error', 'debug'].map((m) => vi.spyOn(console, m).mockImplementation(() => {}));
    render(<BarScanSetup />);
    fireEvent.change(screen.getByTestId('bar-scan-key-input'), { target: { value: KEY } });
    fireEvent.click(screen.getByTestId('bar-scan-key-save'));
    for (const s of spies) expect(s).not.toHaveBeenCalled();
  });
});
