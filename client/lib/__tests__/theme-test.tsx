import React from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Text, TouchableOpacity } from 'react-native';

jest.unmock('@/lib/theme');

import { AppThemeProvider, useAppTheme, useThemeColors } from '@/lib/theme';
import { useColorScheme } from '@/components/useColorScheme';

jest.mock('@/components/useColorScheme', () => ({
  useColorScheme: jest.fn(),
}));

const mockUseColorScheme = useColorScheme as jest.Mock;
const mockAsyncStorage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;

function ThemeProbe() {
  const { themePreference, isDark, setThemePreference } = useAppTheme();
  const { colors } = useThemeColors();

  return (
    <>
      <Text testID="theme-preference">{themePreference}</Text>
      <Text testID="is-dark">{String(isDark)}</Text>
      <Text testID="background-color">{colors.background}</Text>
      <TouchableOpacity testID="set-dark" onPress={() => setThemePreference('dark')}>
        <Text>Set dark</Text>
      </TouchableOpacity>
      <TouchableOpacity testID="set-light" onPress={() => setThemePreference('light')}>
        <Text>Set light</Text>
      </TouchableOpacity>
    </>
  );
}

describe('theme provider', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseColorScheme.mockReturnValue('light');
    mockAsyncStorage.getItem.mockResolvedValue(null);
    mockAsyncStorage.setItem.mockResolvedValue();
  });

  it('defaults themePreference to "system" on mount with no stored value', async () => {
    render(
      <AppThemeProvider>
        <ThemeProbe />
      </AppThemeProvider>
    );

    expect(screen.getByTestId('theme-preference').props.children).toBe('system');
    await act(async () => {});
    expect(screen.getByTestId('theme-preference').props.children).toBe('system');
  });

  it('resolves isDark to false when system preference and device is light', async () => {
    render(
      <AppThemeProvider>
        <ThemeProbe />
      </AppThemeProvider>
    );

    await act(async () => {});
    expect(screen.getByTestId('is-dark').props.children).toBe('false');
  });

  it('setThemePreference("dark") sets isDark to true regardless of device scheme', async () => {
    render(
      <AppThemeProvider>
        <ThemeProbe />
      </AppThemeProvider>
    );

    await act(async () => {
      fireEvent.press(screen.getByTestId('set-dark'));
    });

    expect(screen.getByTestId('is-dark').props.children).toBe('true');
  });

  it('setThemePreference("light") sets isDark to false even when device is dark', async () => {
    mockUseColorScheme.mockReturnValue('dark');

    render(
      <AppThemeProvider>
        <ThemeProbe />
      </AppThemeProvider>
    );

    await act(async () => {
      fireEvent.press(screen.getByTestId('set-light'));
    });

    expect(screen.getByTestId('is-dark').props.children).toBe('false');
  });

  it('setThemePreference calls AsyncStorage.setItem with key @app_theme_pref', async () => {
    render(
      <AppThemeProvider>
        <ThemeProbe />
      </AppThemeProvider>
    );

    await act(async () => {
      fireEvent.press(screen.getByTestId('set-dark'));
    });

    expect(mockAsyncStorage.setItem).toHaveBeenCalledWith('@app_theme_pref', 'dark');
  });

  it('loads themePreference from AsyncStorage on mount', async () => {
    mockAsyncStorage.getItem.mockResolvedValue('dark');

    render(
      <AppThemeProvider>
        <ThemeProbe />
      </AppThemeProvider>
    );

    await act(async () => {});
    expect(screen.getByTestId('is-dark').props.children).toBe('true');
  });

  it('useThemeColors returns colors.background "#ffffff" when isDark is false', async () => {
    render(
      <AppThemeProvider>
        <ThemeProbe />
      </AppThemeProvider>
    );

    await act(async () => {});
    expect(screen.getByTestId('background-color').props.children).toBe('#ffffff');
  });

  it('useThemeColors returns colors.background "#111827" when isDark is true', async () => {
    mockUseColorScheme.mockReturnValue('dark');
    mockAsyncStorage.getItem.mockResolvedValue('dark');

    render(
      <AppThemeProvider>
        <ThemeProbe />
      </AppThemeProvider>
    );

    await act(async () => {});
    expect(screen.getByTestId('background-color').props.children).toBe('#111827');
  });
});
