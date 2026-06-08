export interface AppColors {
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  textDisabled: string;
  background: string;
  surface: string;
  surfaceRaised: string;
  border: string;
  primary: string;
  primaryForeground: string;
  destructiveText: string;
  destructiveSurface: string;
  successText: string;
  buttonSecondary: string;
  buttonSecondaryText: string;
  inputBorder: string;
  modalOverlay: string;
  star: string;
  destructiveBorder: string;
  successSurface: string;
  successBorder: string;
  primarySurface: string;
  primaryBorder: string;
  primarySurfaceActive: string;
  undoBadge: string;
  redoBadge: string;
}

export const lightColors: AppColors = {
  textPrimary: '#111827',
  textSecondary: '#374151',
  textMuted: '#6b7280',
  textDisabled: '#9ca3af',
  background: '#ffffff',
  surface: '#ffffff',
  surfaceRaised: '#f3f4f6',
  border: '#e5e7eb',
  primary: '#2563eb',
  primaryForeground: '#ffffff',
  destructiveText: '#991b1b',
  destructiveSurface: '#fee2e2',
  successText: '#166534',
  buttonSecondary: '#e5e7eb',
  buttonSecondaryText: '#374151',
  inputBorder: '#d1d5db',
  modalOverlay: 'rgba(0,0,0,0.5)',
  star: '#fbbf24',
  destructiveBorder: '#fecaca',
  successSurface: '#dcfce7',
  successBorder: '#bbf7d0',
  primarySurface: '#eff6ff',
  primaryBorder: '#bfdbfe',
  primarySurfaceActive: '#dbeafe',
  undoBadge: '#ef4444',
  redoBadge: '#10b981',
};

export const darkColors: AppColors = {
  textPrimary: '#f9fafb',
  textSecondary: '#d1d5db',
  textMuted: '#9ca3af',
  textDisabled: '#4b5563',
  background: '#111827',
  surface: '#1f2937',
  surfaceRaised: '#374151',
  border: '#374151',
  primary: '#3b82f6',
  primaryForeground: '#ffffff',
  destructiveText: '#fca5a5',
  destructiveSurface: '#450a0a',
  successText: '#86efac',
  buttonSecondary: '#374151',
  buttonSecondaryText: '#d1d5db',
  inputBorder: '#4b5563',
  modalOverlay: 'rgba(0,0,0,0.7)',
  star: '#fbbf24',
  destructiveBorder: '#7f1d1d',
  successSurface: '#052e16',
  successBorder: '#14532d',
  primarySurface: '#172554',
  primaryBorder: '#1e40af',
  primarySurfaceActive: '#1e3a8a',
  undoBadge: '#ef4444',
  redoBadge: '#10b981',
};

const tintColorLight = '#2563eb';
const tintColorDark = '#3b82f6';

export default {
  light: {
    text: lightColors.textPrimary,
    background: lightColors.background,
    tint: tintColorLight,
    tabIconDefault: '#ccc',
    tabIconSelected: tintColorLight,
  },
  dark: {
    text: darkColors.textPrimary,
    background: darkColors.background,
    tint: tintColorDark,
    tabIconDefault: '#ccc',
    tabIconSelected: tintColorDark,
  },
};
