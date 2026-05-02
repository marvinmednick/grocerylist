import React from 'react';
import { StyleSheet } from 'react-native';
import { render, screen } from '@testing-library/react-native';
import { Toast } from '../Toast';

describe('Toast', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it('renders with default dark styling when no variant', () => {
    render(<Toast message="Hello" visible={true} onDismiss={jest.fn()} />);

    const styles = StyleSheet.flatten(screen.getByTestId('toast-container').props.style);
    expect(styles.backgroundColor).toBe('#111827');
  });

  it('renders with amber styling when variant is warning', () => {
    render(<Toast message="Heads up" visible={true} onDismiss={jest.fn()} variant="warning" />);

    const styles = StyleSheet.flatten(screen.getByTestId('toast-container').props.style);
    expect(styles.backgroundColor).toBe('#fffbeb');
    expect(styles.borderColor).toBe('#fbbf24');
    expect(styles.borderWidth).toBe(1);
  });

  it('uses 4000ms duration for warning variant when no duration specified', () => {
    const onDismiss = jest.fn();
    render(<Toast message="Warn" visible={true} onDismiss={onDismiss} variant="warning" />);

    jest.advanceTimersByTime(3999);
    expect(onDismiss).not.toHaveBeenCalled();

    jest.advanceTimersByTime(201);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('uses 3000ms duration for default variant when no duration specified', () => {
    const onDismiss = jest.fn();
    render(<Toast message="Default" visible={true} onDismiss={onDismiss} />);

    jest.advanceTimersByTime(2999);
    expect(onDismiss).not.toHaveBeenCalled();

    jest.advanceTimersByTime(201);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
