import React from 'react';
import { renderHook, waitFor, act } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppThemeProvider, useAppTheme } from '../theme';

const mockGetItem = AsyncStorage.getItem as jest.Mock;
const mockSetItem = AsyncStorage.setItem as jest.Mock;

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <AppThemeProvider>{children}</AppThemeProvider>
);

describe('AppThemeProvider', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('defaults isDark to false when storage value is null', async () => {
    mockGetItem.mockResolvedValue(null);
    const { result } = renderHook(() => useAppTheme(), { wrapper });

    await waitFor(() => {
      expect(mockGetItem).toHaveBeenCalledWith('@app_theme');
    });
    expect(result.current.isDark).toBe(false);
  });

  it('sets isDark true when storage value is dark', async () => {
    mockGetItem.mockResolvedValue('dark');
    const { result } = renderHook(() => useAppTheme(), { wrapper });

    await waitFor(() => {
      expect(result.current.isDark).toBe(true);
    });
  });

  it('writes dark when toggling from light mode', async () => {
    mockGetItem.mockResolvedValue(null);
    const { result } = renderHook(() => useAppTheme(), { wrapper });

    await waitFor(() => {
      expect(mockGetItem).toHaveBeenCalledWith('@app_theme');
    });

    act(() => {
      result.current.toggleTheme();
    });

    expect(mockSetItem).toHaveBeenCalledWith('@app_theme', 'dark');
  });

  it('writes light when toggling from dark mode', async () => {
    mockGetItem.mockResolvedValue('dark');
    const { result } = renderHook(() => useAppTheme(), { wrapper });

    await waitFor(() => {
      expect(result.current.isDark).toBe(true);
    });

    act(() => {
      result.current.toggleTheme();
    });

    expect(mockSetItem).toHaveBeenCalledWith('@app_theme', 'light');
  });
});
