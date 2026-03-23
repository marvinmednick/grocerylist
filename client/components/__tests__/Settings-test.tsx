import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useHousehold } from '@/lib/household';
import { Settings } from '../Settings';
import { useHouseholdMemberColors, useHouseholdName, useMyProfile, useUpdateProfile } from '@/api/profile';
import { useAppTheme } from '@/lib/theme';

jest.mock('@/api/profile');
jest.mock('@/lib/theme', () => ({
  useAppTheme: jest.fn(),
}));
jest.mock('@/lib/household', () => {
  const actual = jest.requireActual('@/lib/household');
  return {
    ...actual,
    useHousehold: jest.fn(),
  };
});

const mockUseHousehold = useHousehold as jest.Mock;
const mockUseHouseholdMemberColors = useHouseholdMemberColors as jest.Mock;
const mockUseHouseholdName = useHouseholdName as jest.Mock;
const mockUseMyProfile = useMyProfile as jest.Mock;
const mockUseUpdateProfile = useUpdateProfile as jest.Mock;
const mockUseAppTheme = useAppTheme as jest.Mock;

const mutate = jest.fn();
const toggleTheme = jest.fn();
const safeAreaMetrics = {
  insets: { top: 44, bottom: 34, left: 0, right: 0 },
  frame: { x: 0, y: 0, width: 390, height: 844 },
};

const createWrapper = () => {
  return ({ children }: { children: React.ReactNode }) => (
    <SafeAreaProvider initialMetrics={safeAreaMetrics}>
      {children}
    </SafeAreaProvider>
  );
};

describe('Settings', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseHousehold.mockReturnValue({
      displayName: 'Alice',
      displayNameShort: 'Ali',
      avatarColor: '#2563eb',
      householdId: 'house-1',
    });
    mockUseHouseholdMemberColors.mockReturnValue({ data: [] });
    mockUseHouseholdName.mockReturnValue({ data: 'The Smiths', isLoading: false });
    mockUseMyProfile.mockReturnValue({
      data: {
        warning_preferences: {
          avoided: 'toast_and_badge',
          unavailable: 'toast_and_badge',
          non_preferred: 'badge_only',
          non_standard_qty: 'badge_only',
        },
      },
    });
    mockUseUpdateProfile.mockReturnValue({ mutate });
    mockUseAppTheme.mockReturnValue({ isDark: false, toggleTheme });
  });

  it('pre-fills display name from profile', () => {
    render(<Settings visible={true} onClose={jest.fn()} />, { wrapper: createWrapper() });
    expect(screen.getByDisplayValue('Alice')).toBeTruthy();
  });

  it('pre-fills short name from profile', () => {
    render(<Settings visible={true} onClose={jest.fn()} />, { wrapper: createWrapper() });
    expect(screen.getByDisplayValue('Ali')).toBeTruthy();
  });

  it('renders exactly 7 color circles', () => {
    render(<Settings visible={true} onClose={jest.fn()} />, { wrapper: createWrapper() });
    expect(screen.getAllByTestId(/settings-color-/)).toHaveLength(7);
  });

  it('updates selected color ring and clears previous selection', () => {
    render(<Settings visible={true} onClose={jest.fn()} />, { wrapper: createWrapper() });

    const blue = screen.getByTestId('settings-color-#2563eb');
    const green = screen.getByTestId('settings-color-#16a34a');

    const blueBefore = StyleSheet.flatten(blue.props.style);
    const greenBefore = StyleSheet.flatten(green.props.style);
    expect(blueBefore.borderColor).toBe('white');
    expect(greenBefore.borderColor).toBe('transparent');

    fireEvent.press(green);

    const blueAfter = StyleSheet.flatten(screen.getByTestId('settings-color-#2563eb').props.style);
    const greenAfter = StyleSheet.flatten(screen.getByTestId('settings-color-#16a34a').props.style);
    expect(blueAfter.borderColor).toBe('transparent');
    expect(greenAfter.borderColor).toBe('white');
  });

  it('shows warning when selected color is used by another member', () => {
    mockUseHouseholdMemberColors.mockReturnValue({ data: ['#16a34a'] });
    render(<Settings visible={true} onClose={jest.fn()} />, { wrapper: createWrapper() });

    fireEvent.press(screen.getByTestId('settings-color-#16a34a'));
    expect(screen.getByText('Another member uses this color')).toBeTruthy();
  });

  it('does not show warning when selected color is not in member colors', () => {
    mockUseHouseholdMemberColors.mockReturnValue({ data: ['#dc2626'] });
    render(<Settings visible={true} onClose={jest.fn()} />, { wrapper: createWrapper() });

    fireEvent.press(screen.getByTestId('settings-color-#16a34a'));
    expect(screen.queryByText('Another member uses this color')).toBeNull();
  });

  it('calls mutate with display_name, display_name_short, color on save', () => {
    render(<Settings visible={true} onClose={jest.fn()} />, { wrapper: createWrapper() });

    fireEvent.changeText(screen.getByTestId('settings-display-name-input'), 'Alice Cooper');
    fireEvent.changeText(screen.getByTestId('settings-short-name-input'), 'AC');
    fireEvent.press(screen.getByTestId('settings-color-#16a34a'));
    fireEvent.press(screen.getByTestId('settings-save-button'));

    expect(mutate).toHaveBeenCalledWith({
      display_name: 'Alice Cooper',
      display_name_short: 'AC',
      color: '#16a34a',
      warning_preferences: {
        avoided: 'toast_and_badge',
        unavailable: 'toast_and_badge',
        non_preferred: 'badge_only',
        non_standard_qty: 'badge_only',
      },
    });
  });

  it('toggles dark mode from switch', () => {
    render(<Settings visible={true} onClose={jest.fn()} />, { wrapper: createWrapper() });
    fireEvent(screen.getByTestId('settings-dark-mode-switch'), 'valueChange', true);
    expect(toggleTheme).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when X button is pressed', () => {
    const onClose = jest.fn();
    render(<Settings visible={true} onClose={onClose} />, { wrapper: createWrapper() });
    fireEvent.press(screen.getByTestId('settings-close-button'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('renders household name from useHouseholdName', () => {
    render(<Settings visible={true} onClose={jest.fn()} />, { wrapper: createWrapper() });
    expect(screen.getByText('The Smiths')).toBeTruthy();
  });

  it('renders Warnings section with four warning type rows', () => {
    render(<Settings visible={true} onClose={jest.fn()} />, { wrapper: createWrapper() });
    expect(screen.getByText('Store Avoidance')).toBeTruthy();
    expect(screen.getByText('Store Unavailable')).toBeTruthy();
    expect(screen.getByText('Non-Preferred Store')).toBeTruthy();
    expect(screen.getByText('Non-Standard Qty')).toBeTruthy();
  });

  it('renders segmented controls with correct options', () => {
    render(<Settings visible={true} onClose={jest.fn()} />, { wrapper: createWrapper() });
    expect(screen.getByTestId('warning-pref-avoided-toast_and_badge')).toBeTruthy();
    expect(screen.getByTestId('warning-pref-avoided-badge_only')).toBeTruthy();
    expect(screen.getByTestId('warning-pref-avoided-off')).toBeTruthy();
    expect(screen.getAllByText('Toast + Badge').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Badge').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Off').length).toBeGreaterThan(0);
  });

  it('renders only Badge/Off for non_preferred type', () => {
    render(<Settings visible={true} onClose={jest.fn()} />, { wrapper: createWrapper() });
    expect(screen.getByTestId('warning-pref-non_preferred-badge_only')).toBeTruthy();
    expect(screen.getByTestId('warning-pref-non_preferred-off')).toBeTruthy();
    expect(screen.queryByTestId('warning-pref-non_preferred-toast_and_badge')).toBeNull();
  });

  it('selects the correct default segment based on profile data', () => {
    render(<Settings visible={true} onClose={jest.fn()} />, { wrapper: createWrapper() });

    const avoidedSelected = StyleSheet.flatten(
      screen.getByTestId('warning-pref-avoided-toast_and_badge').props.style
    );
    const nonPreferredSelected = StyleSheet.flatten(
      screen.getByTestId('warning-pref-non_preferred-badge_only').props.style
    );
    const unavailableOff = StyleSheet.flatten(
      screen.getByTestId('warning-pref-unavailable-off').props.style
    );

    expect(avoidedSelected.backgroundColor).toBe('#2563eb');
    expect(nonPreferredSelected.backgroundColor).toBe('#2563eb');
    expect(unavailableOff.backgroundColor).toBe('#f3f4f6');
  });
});
