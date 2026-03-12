import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { WarningBadge } from '../WarningBadge';

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

  it('shows popover with detail text on badge tap', () => {
    render(
      <WarningBadge
        warnings={[{ type: 'avoided', store_name: 'Main Market', comment: 'not fresh' }]}
      />
    );

    fireEvent.press(screen.getByTestId('warning-badge-trigger'));
    expect(screen.getByText('Avoided at Main Market — not fresh')).toBeTruthy();
  });

  it('dismisses popover on outside tap', () => {
    render(
      <WarningBadge
        warnings={[{ type: 'non_standard_qty', entered: '3', standard: ['1', '2'] }]}
      />
    );

    fireEvent.press(screen.getByTestId('warning-badge-trigger'));
    expect(screen.getByText('Qty 3 is non-standard (usual: 1, 2)')).toBeTruthy();

    fireEvent.press(screen.getByTestId('warning-popover-overlay'));
    expect(screen.queryByText('Qty 3 is non-standard (usual: 1, 2)')).toBeNull();
  });
});
