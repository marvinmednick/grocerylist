import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface AppThemeContextType {
  isDark: boolean;
  toggleTheme: () => void;
}

const AppThemeContext = createContext<AppThemeContextType | undefined>(undefined);

export const AppThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const loadTheme = async () => {
      const savedTheme = await AsyncStorage.getItem('@app_theme');
      setIsDark(savedTheme === 'dark');
    };

    loadTheme();
  }, []);

  const toggleTheme = () => {
    setIsDark((prev) => {
      const nextIsDark = !prev;
      const newValue = nextIsDark ? 'dark' : 'light';
      AsyncStorage.setItem('@app_theme', newValue);
      return nextIsDark;
    });
  };

  return (
    <AppThemeContext.Provider value={{ isDark, toggleTheme }}>
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
