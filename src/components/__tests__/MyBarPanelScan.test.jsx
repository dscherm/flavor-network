// @vitest-environment jsdom
// "Add from a photo" in My bar (BARPHOTO-4). The scan is injected (the `scan`
// prop), so nothing here touches the network, the canvas or Firebase.
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { useState } from 'react';
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';
import MyBarPanel from '../MyBarPanel.jsx';
import { buildPairingIndex } from '../../data/recipePairingMatch.js';
import { ScanError } from '../../data/barScan.js';

const ing = (raw) => ({ raw });
const negroni = { name: 'Negroni', ingredients_raw: [ing('1 oz Gin'), ing('1 oz Sweet vermouth'), ing('1 oz Campari')] };
const manhattan = { name: 'Manhattan', ingredients_raw: [ing('2 oz Rye'), ing('1 oz Sweet vermouth'), ing('2 dashes Angostura bitters')] };
const roles = {
  gin: { role: 'spirit' }, rye: { role: 'spirit' },
  'sweet vermouth': { role: 'vermouth' }, campari: { role: 'amaro_liqueur' }, 'angostura bitters': { role: 'bitter' },
};
const index = buildPairingIndex([], Object.keys(roles));

describe('MyBarPanel: add from a photo', () => {
  const KEY = 'AIzaSyD-SECRETKEY-1234567890abcdefg';
  const CODE = 'friend-code-SECRET99';
  const file = new File(['x'], 'shelf.jpg', { type: 'image/jpeg' });
  const result = {
    bottles: [
      { label: 'Forij Gin', type: 'gin', key: 'gin', confidence: 'high' },
      { label: 'Campari', type: 'aperitivo', key: 'campari', confidence: 'high' },
      { label: 'Rye?', type: 'rye whiskey', key: 'rye', confidence: 'medium' },
      { label: 'Mystery Bottle', type: 'thing', key: '', confidence: 'low' },
    ],
    other: ['lime'],
  };
  let pickerClicks;

  beforeEach(() => {
    localStorage.clear();
    pickerClicks = vi.spyOn(HTMLInputElement.prototype, 'click');
  });
  afterEach(() => vi.restoreAllMocks());

  function Photo({ scan = vi.fn(async () => result), onBar = vi.fn(), onKitchen = vi.fn(), bar0 = [], ...rest }) {
    const [bar, setBar] = useState(bar0);
    const [kitchen, setKitchen] = useState([]);
    return (
      <>
        <MyBarPanel bar={bar} onChange={(b) => { onBar(b); setBar(b); }} kitchen={kitchen}
          onKitchenChange={(k) => { onKitchen(k); setKitchen(k); }}
          cocktails={[negroni, manhattan]} roles={roles} pairingIndex={index} scan={scan} {...rest} />
        <output data-testid="bar-out">{bar.join(',')}</output>
        <output data-testid="kitchen-out">{kitchen.join(',')}</output>
      </>
    );
  }
  const pick = () => fireEvent.change(screen.getByTestId('my-bar-photo-input'), { target: { files: [file] } });
  const withKey = () => localStorage.setItem('fn-gemini-key', KEY);
  const fileInputClicks = () => pickerClicks.mock.calls.length;

  it('nothing saved: the button opens the set-up card with both choices, not the picker', () => {
    render(<Photo />);
    fireEvent.click(screen.getByTestId('my-bar-photo'));
    expect(screen.getByTestId('bar-scan-setup')).toBeInTheDocument();
    expect(screen.getByTestId('bar-scan-code-block')).toBeInTheDocument();
    expect(screen.getByTestId('bar-scan-key-block')).toBeInTheDocument();
    expect(fileInputClicks()).toBe(0);
  });

  it('saving a code or a key then opens the picker; Remove returns to the set-up card', () => {
    render(<Photo />);
    fireEvent.click(screen.getByTestId('my-bar-photo'));
    fireEvent.change(screen.getByTestId('bar-scan-code-input'), { target: { value: CODE } });
    fireEvent.click(screen.getByTestId('bar-scan-code-save'));
    expect(fileInputClicks()).toBe(1);
    expect(screen.queryByTestId('bar-scan-setup')).toBeNull();
    fireEvent.click(screen.getByTestId('my-bar-scan-change'));
    fireEvent.click(screen.getByTestId('bar-scan-remove'));
    expect(localStorage.getItem('fn-scan-code')).toBeNull();
    fireEvent.click(screen.getByText('Not now'));
    fireEvent.click(screen.getByTestId('my-bar-photo'));
    expect(screen.getByTestId('bar-scan-setup')).toBeInTheDocument();
    fireEvent.change(screen.getByTestId('bar-scan-key-input'), { target: { value: KEY } });
    fireEvent.click(screen.getByTestId('bar-scan-key-save'));
    expect(fileInputClicks()).toBe(2);
  });

  it('with something saved the button opens the picker directly, and the picker takes images', () => {
    withKey();
    render(<Photo />);
    expect(screen.getByTestId('my-bar-photo-input')).toHaveAttribute('accept', 'image/*');
    fireEvent.click(screen.getByTestId('my-bar-photo'));
    expect(fileInputClicks()).toBe(1);
    expect(screen.queryByTestId('bar-scan-setup')).toBeNull();
  });

  it('shows a busy state, then the review; nothing is added until "Add N to my bar"', async () => {
    withKey();
    let release;
    const scan = vi.fn(() => new Promise((r) => { release = () => r(result); }));
    const onBar = vi.fn();
    render(<Photo scan={scan} onBar={onBar} />);
    pick();
    expect(await screen.findByText('Reading the labels…')).toBeInTheDocument();
    expect(scan).toHaveBeenCalledTimes(1);
    expect(scan.mock.calls[0][0]).toMatchObject({ file, key: KEY, code: '' });
    expect(Array.isArray(scan.mock.calls[0][0].vocab)).toBe(true);
    release();
    await screen.findByTestId('bar-scan-review');
    expect(screen.queryByTestId('my-bar-scan-busy')).toBeNull();
    const rows = screen.getAllByTestId('bar-scan-row');
    expect(rows).toHaveLength(4);
    expect(within(rows[0]).getByTestId('bar-scan-check').checked).toBe(true);
    expect(within(rows[2]).getByTestId('bar-scan-check').checked).toBe(false);
    expect(within(rows[3]).getByTestId('bar-scan-name')).toBeInTheDocument();
    expect(onBar).not.toHaveBeenCalled();
    expect(screen.getByTestId('bar-out').textContent).toBe('');
    fireEvent.click(screen.getByTestId('bar-scan-add'));
    expect(onBar).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('bar-out').textContent).toBe('gin,campari');
    expect(screen.queryByTestId('bar-scan-review')).toBeNull();
    expect(screen.getByTestId('my-bar-scan-note')).toHaveTextContent('Added 2 to your bar');
  });

  it('Cancel adds nothing; an unticked row is not added', async () => {
    withKey();
    const onBar = vi.fn(); const onKitchen = vi.fn();
    render(<Photo onBar={onBar} onKitchen={onKitchen} />);
    pick();
    await screen.findByTestId('bar-scan-review');
    fireEvent.click(screen.getByTestId('bar-scan-cancel'));
    expect(onBar).not.toHaveBeenCalled();
    expect(onKitchen).not.toHaveBeenCalled();
    expect(screen.queryByTestId('bar-scan-review')).toBeNull();
    pick();
    await screen.findByTestId('bar-scan-review');
    fireEvent.click(screen.getAllByTestId('bar-scan-check')[0]);
    fireEvent.click(screen.getByTestId('bar-scan-add'));
    expect(screen.getByTestId('bar-out').textContent).toBe('campari');
  });

  it('checked "also spotted" items go to the kitchen, not the bar', async () => {
    withKey();
    render(<Photo />);
    pick();
    await screen.findByTestId('bar-scan-review');
    const lime = screen.getByTestId('bar-scan-other-check');
    expect(lime.checked).toBe(false);
    fireEvent.click(lime);
    fireEvent.click(screen.getByTestId('bar-scan-add'));
    expect(screen.getByTestId('kitchen-out').textContent).toBe('lime');
    expect(screen.getByTestId('bar-out').textContent).toBe('gin,campari');
  });

  it('an unnamed bottle can be named in the list and then added', async () => {
    withKey();
    render(<Photo />);
    pick();
    await screen.findByTestId('bar-scan-review');
    fireEvent.change(screen.getByLabelText('Bar name for Mystery Bottle'), { target: { value: 'sweet vermouth' } });
    const rows = screen.getAllByTestId('bar-scan-row');
    fireEvent.click(within(rows[3]).getByTestId('bar-scan-check'));
    fireEvent.click(screen.getByTestId('bar-scan-add'));
    expect(screen.getByTestId('bar-out').textContent).toBe('gin,campari,sweet vermouth');
  });

  it('bottles already in the bar are flagged and not added twice', async () => {
    withKey();
    render(<Photo bar0={['gin']} />);
    pick();
    await screen.findByTestId('bar-scan-review');
    expect(screen.getAllByTestId('bar-scan-row')[0]).toHaveTextContent('already in your bar');
    fireEvent.click(screen.getByTestId('bar-scan-add'));
    expect(screen.getByTestId('bar-out').textContent).toBe('gin,campari');
  });

  it('"Add another photo" merges the second result without duplicates', async () => {
    withKey();
    const second = {
      bottles: [
        { label: 'Campari Bitter', type: 'aperitivo', key: 'campari', confidence: 'high' },
        { label: 'Tanqueray', type: 'gin', key: 'gin', confidence: 'high' },
        { label: 'Sweet', type: 'sweet vermouth', key: 'sweet vermouth', confidence: 'high' },
      ],
      other: ['lime'],
    };
    const scan = vi.fn().mockResolvedValueOnce(result).mockResolvedValueOnce(second);
    render(<Photo scan={scan} />);
    pick();
    await screen.findByTestId('bar-scan-review');
    fireEvent.click(screen.getAllByTestId('bar-scan-check')[0]); // the user unticks gin
    fireEvent.click(screen.getByTestId('bar-scan-another'));
    expect(fileInputClicks()).toBe(1);
    pick();
    await waitFor(() => expect(screen.getAllByTestId('bar-scan-row')).toHaveLength(5));
    expect(screen.getAllByTestId('bar-scan-other-check')).toHaveLength(1);
    expect(screen.getAllByTestId('bar-scan-check')[0].checked).toBe(false);
  });

  const failures = [
    [new ScanError('bad-key'), /Google did not accept that key/, true],
    [new ScanError('bad-code'), /isn't valid/, true],
    [new ScanError('daily-limit'), /allowance for today is used up/, false],
    [new ScanError('offline'), /Couldn't reach/, false],
    [new ScanError('busy'), /busy/, false],
  ];
  for (const [err, re, fix] of failures) {
    it(`${err.kind}: shows its own message and the manual bar still works`, async () => {
      withKey();
      render(<Photo scan={vi.fn(async () => { throw err; })} />);
      pick();
      const alert = await screen.findByRole('alert');
      expect(alert).toHaveTextContent(re);
      expect(!!screen.queryByTestId('my-bar-scan-fix')).toBe(fix);
      fireEvent.change(screen.getByTestId('my-bar-input'), { target: { value: 'gin' } });
      fireEvent.click(screen.getByTestId('my-bar-add'));
      expect(screen.getByTestId('bar-out').textContent).toBe('gin');
    });
  }

  it('a rejected key offers "Change key or code", which opens the set-up card', async () => {
    withKey();
    render(<Photo scan={vi.fn(async () => { throw new ScanError('bad-key'); })} />);
    pick();
    fireEvent.click(await screen.findByTestId('my-bar-scan-fix'));
    expect(screen.getByTestId('bar-scan-setup')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('an empty result says so and offers nothing to add', async () => {
    withKey();
    render(<Photo scan={vi.fn(async () => ({ bottles: [], other: [] }))} />);
    pick();
    expect(await screen.findByTestId('my-bar-scan-note')).toHaveTextContent("I couldn't read any labels — try closer, with more light.");
    expect(screen.queryByTestId('bar-scan-review')).toBeNull();
    expect(screen.getByTestId('bar-out').textContent).toBe('');
  });

  it('an unexpected error reads as unreadable and does not echo the key', async () => {
    withKey();
    render(<Photo scan={vi.fn(async () => { throw new Error(`boom ${KEY}`); })} />);
    pick();
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('could not use');
    expect(alert.textContent).not.toContain(KEY);
  });

  it('the key is masked in the DOM after saving and never reaches the console', async () => {
    const spies = ['log', 'info', 'warn', 'error', 'debug'].map((m) => vi.spyOn(console, m).mockImplementation(() => {}));
    const { container } = render(<Photo />);
    fireEvent.click(screen.getByTestId('my-bar-photo'));
    fireEvent.change(screen.getByTestId('bar-scan-key-input'), { target: { value: KEY } });
    fireEvent.click(screen.getByTestId('bar-scan-key-save'));
    pick();
    await screen.findByTestId('bar-scan-review');
    fireEvent.click(screen.getByTestId('my-bar-scan-change'));
    expect(screen.getByTestId('bar-scan-masked').textContent.endsWith(KEY.slice(-4))).toBe(true);
    expect(container.innerHTML).not.toContain(KEY);
    for (const s of spies) expect(s).not.toHaveBeenCalled();
  });
});
