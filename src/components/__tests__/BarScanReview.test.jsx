// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { useState } from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import BarScanReview from '../BarScanReview.jsx';

const roles = { gin: { role: 'spirit' }, campari: { role: 'amaro_liqueur' } };
const names = new Set(['gin', 'campari', 'lime']);
const row = (o) => ({ id: o.barKey || `?:${o.label}`, type: 't', confidence: 'high', inBar: false, checked: o.confidence ? o.confidence === 'high' : true, editable: false, ...o });

function Harness({ rows0, other0 = [], bar = [], onAdd = vi.fn(), ...rest }) {
  const [rows, setRows] = useState(rows0);
  const [other, setOther] = useState(other0);
  return <BarScanReview rows={rows} other={other} bar={bar} names={names} roles={roles} vocab={['gin']}
    onRowsChange={setRows} onOtherChange={setOther} onAdd={onAdd} onAnother={vi.fn()} onCancel={vi.fn()} {...rest} />;
}

describe('BarScanReview', () => {
  it('shows the guidance line, a row per bottle and Add N counting checked rows', () => {
    render(<Harness rows0={[row({ label: 'Forij Gin', barKey: 'gin' }), row({ label: 'Campari', barKey: 'campari' }), row({ label: 'Mystery', barKey: '', checked: false, confidence: 'low', editable: true })]} />);
    expect(screen.getByText('One shelf at a time, labels facing you.')).toBeInTheDocument();
    expect(screen.getAllByTestId('bar-scan-row')).toHaveLength(3);
    expect(screen.getByTestId('bar-scan-add')).toHaveTextContent('Add 2 to my bar');
  });

  it('medium and low show "not sure"; high does not', () => {
    render(<Harness rows0={[row({ label: 'A', barKey: 'gin' }), row({ label: 'B', barKey: 'campari', confidence: 'medium', checked: false })]} />);
    expect(screen.getAllByTestId('bar-scan-unsure')).toHaveLength(1);
  });

  it('already-in-bar rows are disabled and not counted', () => {
    render(<Harness bar={['gin']} rows0={[row({ label: 'Forij Gin', barKey: 'gin' }), row({ label: 'Campari', barKey: 'campari' })]} />);
    const rows = screen.getAllByTestId('bar-scan-row');
    expect(rows[0]).toHaveTextContent('already in your bar');
    expect(within(rows[0]).getByTestId('bar-scan-check')).toBeDisabled();
    expect(screen.getByTestId('bar-scan-add')).toHaveTextContent('Add 1 to my bar');
  });

  it('a row with no bar name is shown as editable, unchecked and unticking-disabled until named', () => {
    const onAdd = vi.fn();
    render(<Harness onAdd={onAdd} rows0={[row({ label: 'Mystery', barKey: '', checked: false, confidence: 'low', editable: true })]} />);
    const check = screen.getByTestId('bar-scan-check');
    expect(check).toBeDisabled();
    expect(check.checked).toBe(false);
    expect(screen.getByTestId('bar-scan-add')).toBeDisabled();
    fireEvent.change(screen.getByTestId('bar-scan-name'), { target: { value: 'gin' } });
    expect(screen.getByTestId('bar-scan-check')).not.toBeDisabled();
    fireEvent.click(screen.getByTestId('bar-scan-check'));
    expect(screen.getByTestId('bar-scan-add')).toHaveTextContent('Add 1 to my bar');
    fireEvent.click(screen.getByTestId('bar-scan-add'));
    expect(onAdd.mock.calls[0][0].map((r) => r.barKey)).toEqual(['gin']);
  });

  it('a typed name that is not alcohol leaves the row unnamed', () => {
    render(<Harness rows0={[row({ label: 'X', barKey: 'campari', editable: true, confidence: 'medium', checked: true })]} />);
    fireEvent.change(screen.getByTestId('bar-scan-name'), { target: { value: 'lime juice' } });
    expect(screen.getByTestId('bar-scan-check')).toBeDisabled();
    expect(screen.getByTestId('bar-scan-add')).toBeDisabled();
  });

  it('Add N hands over only the checked rows, and unticking removes one', () => {
    const onAdd = vi.fn();
    render(<Harness onAdd={onAdd} rows0={[row({ label: 'Forij Gin', barKey: 'gin' }), row({ label: 'Campari', barKey: 'campari' })]} />);
    fireEvent.click(screen.getAllByTestId('bar-scan-check')[0]);
    fireEvent.click(screen.getByTestId('bar-scan-add'));
    expect(onAdd).toHaveBeenCalledTimes(1);
    expect(onAdd.mock.calls[0][0].map((r) => r.barKey)).toEqual(['campari']);
  });

  it('Also spotted items start unticked and are handed over separately', () => {
    const onAdd = vi.fn();
    render(<Harness onAdd={onAdd} rows0={[row({ label: 'Gin', barKey: 'gin' })]} other0={[{ label: 'lime', kitchenKey: 'lime', checked: false }]} />);
    const box = within(screen.getByTestId('bar-scan-other')).getByTestId('bar-scan-other-check');
    expect(box.checked).toBe(false);
    fireEvent.click(box);
    fireEvent.click(screen.getByTestId('bar-scan-add'));
    expect(onAdd.mock.calls[0][1].map((o) => o.kitchenKey)).toEqual(['lime']);
  });

  it('only kitchen items ticked still enables the button', () => {
    render(<Harness rows0={[]} other0={[{ label: 'lime', kitchenKey: 'lime', checked: true }]} />);
    expect(screen.getByTestId('bar-scan-add')).not.toBeDisabled();
  });

  it('a long list gets the gentle untick note; a short one does not', () => {
    const many = Array.from({ length: 26 }, (_, i) => row({ label: `B${i}`, barKey: `k${i}` }));
    const { unmount } = render(<Harness rows0={many} />);
    expect(screen.getByTestId('bar-scan-long-note')).toBeInTheDocument();
    unmount();
    render(<Harness rows0={many.slice(0, 5)} />);
    expect(screen.queryByTestId('bar-scan-long-note')).toBeNull();
  });

  it('checkboxes are 44px targets', () => {
    render(<Harness rows0={[row({ label: 'Gin', barKey: 'gin' })]} />);
    const c = screen.getByTestId('bar-scan-check');
    expect(c.style.width).toBe('44px');
    expect(c.style.height).toBe('44px');
  });
});
