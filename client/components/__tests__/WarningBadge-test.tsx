import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { WarningBadge } from '../WarningBadge';
import type { Warning } from '@/api/items';

describe('WarningBadge', () => {
  it('renders nothing when warnings is empty', () => {
    render(<WarningBadge warnings={[]} />);
    expect(screen.queryByTestId('warning-badge-trigger')).toBeNull();
  });

  it('renders nothing when warnings is undefined', () => {
    render(<WarningBadge warnings={undefined} />);
    expect(screen.queryByTestId('warning-badge-trigger')).toBeNull();
  });

  it('renders AlertTriangle icon for avoided warning', () => {
    render(<WarningBadge warnings={[{ type: 'avoided' }]} />);
    expect(screen.getAllByTestId('warning-icon-avoided')).toHaveLength(1);
  });

  it('renders XCircle icon for unavailable warning', () => {
    render(<WarningBadge warnings={[{ type: 'unavailable' }]} />);
    expect(screen.getAllByTestId('warning-icon-unavailable')).toHaveLength(1);
  });

  it('renders multiple icons for multiple warnings', () => {
    render(
      <WarningBadge
        warnings={[
          { type: 'avoided' },
          { type: 'unavailable' },
        ]}
      />
    );

    expect(screen.getAllByTestId('warning-icon-avoided')).toHaveLength(1);
    expect(screen.getAllByTestId('warning-icon-unavailable')).toHaveLength(1);
  });

  it('shows modal with detail text on badge tap', () => {
    render(
      <WarningBadge
        warnings={[{ type: 'avoided', store_name: 'Main Market', comment: 'not fresh' }]}
      />
    );

    fireEvent.press(screen.getByTestId('warning-badge-trigger'));
    expect(screen.getByTestId('warning-modal-close')).toBeTruthy();
    expect(screen.getByText('Avoided at Main Market — not fresh')).toBeTruthy();
  });

  it('dismisses modal on backdrop tap', () => {
    render(
      <WarningBadge
        warnings={[{ type: 'non_standard_qty', entered: '3', standard: ['1', '2'] }]}
      />
    );

    fireEvent.press(screen.getByTestId('warning-badge-trigger'));
    expect(screen.getByText('Qty 3 is non-standard (usual: 1, 2)')).toBeTruthy();

    fireEvent.press(screen.getByTestId('warning-modal-backdrop'));
    expect(screen.queryByText('Qty 3 is non-standard (usual: 1, 2)')).toBeNull();
  });

  it('closes warning modal when X button is pressed', () => {
    render(
      <WarningBadge
        warnings={[{ type: 'non_standard_qty', entered: '3', standard: ['1', '2'] }]}
      />
    );

    fireEvent.press(screen.getByTestId('warning-badge-trigger'));
    expect(screen.getByText('Qty 3 is non-standard (usual: 1, 2)')).toBeTruthy();

    fireEvent.press(screen.getByTestId('warning-modal-close'));
    expect(screen.queryByText('Qty 3 is non-standard (usual: 1, 2)')).toBeNull();
  });

  it('accepts Warning type from api/items without type errors', () => {
    const warning: Warning = {
      type: 'avoided',
      store_id: 'store-1',
      store_name: 'Main Market',
      comment: 'seasonal issue',
    };

    render(<WarningBadge warnings={[warning]} />);
    expect(screen.getByTestId('warning-badge-trigger')).toBeTruthy();
  });
});
