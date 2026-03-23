import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { WarningCallout } from '../WarningCallout';
import type { Warning } from '@/api/items';

describe('WarningCallout', () => {
  it('renders nothing when warnings array is empty', () => {
    render(<WarningCallout warnings={[]} />);
    expect(screen.queryByTestId('warning-callout')).toBeNull();
  });

  it('renders one row for an avoided warning', () => {
    const warnings: Warning[] = [{ type: 'avoided', store_id: 'store-1', store_name: 'Trader Joes' }];
    render(<WarningCallout warnings={warnings} />);
    expect(screen.getByText('Avoided at Trader Joes')).toBeTruthy();
  });

  it('renders one row for an unavailable warning', () => {
    const warnings: Warning[] = [{ type: 'unavailable', store_id: 'store-1', store_name: 'Market' }];
    render(<WarningCallout warnings={warnings} />);
    expect(screen.getByText('Unavailable at Market')).toBeTruthy();
  });

  it('renders one row for a non_preferred warning', () => {
    const warnings: Warning[] = [{ type: 'non_preferred', preferred_stores: ['Main', 'Alt'] }];
    render(<WarningCallout warnings={warnings} />);
    expect(screen.getByText('Preferred at: Main, Alt')).toBeTruthy();
  });

  it('renders one row for a non_standard_qty warning', () => {
    const warnings: Warning[] = [{ type: 'non_standard_qty', entered: '3', standard: ['1', '2'] }];
    render(<WarningCallout warnings={warnings} />);
    expect(screen.getByText('Qty 3 is non-standard (usual: 1, 2)')).toBeTruthy();
  });

  it('renders multiple rows when multiple warnings are present', () => {
    const warnings: Warning[] = [
      { type: 'avoided', store_id: 'store-1', store_name: 'Trader Joes' },
      { type: 'non_standard_qty', entered: '3', standard: ['1', '2'] },
    ];
    render(<WarningCallout warnings={warnings} />);
    expect(screen.getByText('Avoided at Trader Joes')).toBeTruthy();
    expect(screen.getByText('Qty 3 is non-standard (usual: 1, 2)')).toBeTruthy();
  });
});
