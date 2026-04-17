import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { MultiTripModal, TripUser } from '../MultiTripModal';

const safeAreaMetrics = {
  insets: { top: 44, bottom: 34, left: 0, right: 0 },
  frame: { x: 0, y: 0, width: 390, height: 844 },
};

const users: TripUser[] = [
  {
    userId: 'user-1',
    displayName: 'Alice',
    displayNameShort: 'AL',
    color: '#16a34a',
    itemCount: 3,
  },
  {
    userId: 'user-2',
    displayName: 'bob@example.com',
    displayNameShort: null,
    color: '#dc2626',
    itemCount: 1,
  },
];

describe('MultiTripModal', () => {
  const onConfirm = jest.fn();
  const onCancel = jest.fn();

  const renderModal = () =>
    render(
      <SafeAreaProvider initialMetrics={safeAreaMetrics}>
        <MultiTripModal visible storeName="Market" users={users} onConfirm={onConfirm} onCancel={onCancel} />
      </SafeAreaProvider>
    );

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    act(() => {
      jest.runOnlyPendingTimers();
    });
    jest.useRealTimers();
  });

  it('renders all users with names and entry counts', () => {
    renderModal();

    expect(screen.getByText('Alice')).toBeTruthy();
    expect(screen.getByText('(3 items)')).toBeTruthy();
    expect(screen.getByText('bob@example.com')).toBeTruthy();
    expect(screen.getByText('(1 items)')).toBeTruthy();
  });

  it('selects all users by default', () => {
    renderModal();

    fireEvent.press(screen.getByTestId('multi-trip-confirm'));

    expect(onConfirm).toHaveBeenCalledWith(['user-1', 'user-2']);
  });

  it('tapping row toggles selection', () => {
    renderModal();

    fireEvent.press(screen.getByTestId('multi-trip-user-row-user-2'));
    fireEvent.press(screen.getByTestId('multi-trip-confirm'));

    expect(onConfirm).toHaveBeenCalledWith(['user-1']);
  });

  it('confirm button is disabled when no users selected', () => {
    renderModal();

    fireEvent.press(screen.getByTestId('multi-trip-user-row-user-1'));
    fireEvent.press(screen.getByTestId('multi-trip-user-row-user-2'));

    expect(screen.getByTestId('multi-trip-confirm')).toBeDisabled();
  });

  it('onConfirm receives selected IDs only', () => {
    renderModal();

    fireEvent.press(screen.getByTestId('multi-trip-user-row-user-1'));
    fireEvent.press(screen.getByTestId('multi-trip-confirm'));

    expect(onConfirm).toHaveBeenCalledWith(['user-2']);
  });

  it('calls onCancel from Cancel button', () => {
    renderModal();

    fireEvent.press(screen.getByTestId('multi-trip-cancel'));

    expect(onCancel).toHaveBeenCalled();
  });

  it('uses user color on initials badge', () => {
    renderModal();

    expect(screen.getByTestId('multi-trip-initials-user-1')).toHaveStyle({ backgroundColor: '#16a34a' });
  });
});
