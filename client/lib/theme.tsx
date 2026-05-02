import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useColorScheme } from '@/components/useColorScheme';
import type { AppColors } from '@/constants/Colors';
import { darkColors, lightColors } from '@/constants/Colors';

export type ThemePreference = 'system' | 'light' | 'dark';

interface AppThemeContextType {
  themePreference: ThemePreference;
  isDark: boolean;
  setThemePreference: (pref: ThemePreference) => void;
}

const STORAGE_KEY = '@app_theme_pref';

const AppThemeContext = createContext<AppThemeContextType | undefined>(undefined);

export const AppThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const deviceScheme = useColorScheme();
  const [themePreference, setThemePref] = useState<ThemePreference>('system');

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((saved) => {
      if (saved === 'light' || saved === 'dark' || saved === 'system') {
        setThemePref(saved);
      }
    });
  }, []);

  const isDark =
    themePreference === 'system' ? deviceScheme === 'dark' : themePreference === 'dark';

  const setThemePreference = (pref: ThemePreference) => {
    setThemePref(pref);
    AsyncStorage.setItem(STORAGE_KEY, pref);
  };

  return (
    <AppThemeContext.Provider value={{ themePreference, isDark, setThemePreference }}>
      {children}
    </AppThemeContext.Provider>
  );
};

export const useAppTheme = () => {
  const context = useContext(AppThemeContext);
  if (!context) {
    throw new Error('useAppTheme must be used within AppThemeProvider');
  }
  return context;
};

export const useThemeColors = (): { colors: AppColors } => {
  const { isDark } = useAppTheme();
  return { colors: isDark ? darkColors : lightColors };
};
