// Mock Async Storage
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

// Mock Supabase
jest.mock('./lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: jest.fn(() => Promise.resolve({ data: { session: null }, error: null })),
      onAuthStateChange: jest.fn(() => ({
        data: { subscription: { unsubscribe: jest.fn() } },
      })),
      signInWithPassword: jest.fn(),
      signUp: jest.fn(),
      signOut: jest.fn(),
    },
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      single: jest.fn().mockReturnThis(),
      is: jest.fn().mockReturnThis(),
      ilike: jest.fn().mockReturnThis(),
    })),
    channel: jest.fn(() => ({
      on: jest.fn().mockReturnThis(),
      subscribe: jest.fn().mockReturnThis(),
    })),
    removeChannel: jest.fn(),
  },
}));

// Mock theme hooks globally for components that now call useThemeColors().
jest.mock('./lib/theme', () => ({
  AppThemeProvider: ({ children }) => children,
  useAppTheme: jest.fn(() => ({
    isDark: false,
    themePreference: 'light',
    setThemePreference: jest.fn(),
  })),
  useThemeColors: jest.fn(() => ({
    colors: {
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
    },
  })),
}));

// Mock Expo Router
jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
  }),
  useSegments: () => [],
  Stack: {
    Screen: jest.fn(() => null),
  },
  Tabs: {
    Screen: jest.fn(() => null),
  },
}));

// Make React Query state notifications synchronous so they always land inside
// the current act() boundary. Without this, notifyManager's default setTimeout
// scheduler can fire after the test's act() ends, causing spurious
// "not wrapped in act()" console.error failures.
const { notifyManager } = require('@tanstack/query-core');
notifyManager.setScheduler(cb => cb());

// Fail tests on unexpected console.warn or console.error output.
// Known third-party noise is explicitly allowed below; everything else throws so
// it shows up as a test failure rather than silent output.
//
// To allow a new warning: add an args[0].includes('...') guard above the throw.
const originalWarn = console.warn;
console.warn = (...args) => {
  // react-native-draggable-flatlist uses the old JSX transform
  if (typeof args[0] === 'string' && args[0].includes('outdated JSX transform')) return;
  throw new Error(`Unexpected console.warn: ${String(args[0])}`);
};

const originalError = console.error;
console.error = (...args) => {
  throw new Error(`Unexpected console.error: ${String(args[0])}`);
};

// Mock FlatList with a synchronous renderer to avoid VirtualizedList's internal
// setTimeout-based cell-rendering updates firing outside act() in tests.
jest.mock('react-native/Libraries/Lists/FlatList', () => {
  const React = require('react');
  const MockFlatList = ({ data, renderItem, ListEmptyComponent, contentContainerStyle }) => {
    if (!data || data.length === 0) {
      if (!ListEmptyComponent) return null;
      return React.createElement(
        React.Fragment,
        null,
        typeof ListEmptyComponent === 'function'
          ? React.createElement(ListEmptyComponent)
          : ListEmptyComponent
      );
    }
    return React.createElement(
      React.Fragment,
      null,
      data.map((item, index) => renderItem({ item, index, separators: {} }))
    );
  };
  MockFlatList.displayName = 'FlatList';
  return { __esModule: true, default: MockFlatList };
});

// Mock DraggableFlatList — tests don't exercise drag-and-drop, and the real
// implementation depends on CellProvider context that breaks when FlatList is mocked.
jest.mock('react-native-draggable-flatlist', () => {
  const React = require('react');
  const MockDraggableFlatList = ({ data, renderItem, ListHeaderComponent, ListFooterComponent }) => {
    return React.createElement(
      React.Fragment,
      null,
      ListHeaderComponent ? React.createElement(ListHeaderComponent) : null,
      (data ?? []).map((item, index) =>
        renderItem({ item, index, drag: jest.fn(), isActive: false, getIndex: () => index })
      ),
      ListFooterComponent ? React.createElement(ListFooterComponent) : null
    );
  };
  MockDraggableFlatList.displayName = 'DraggableFlatList';
  const ScaleDecorator = ({ children }) => children;
  ScaleDecorator.displayName = 'ScaleDecorator';
  return { __esModule: true, default: MockDraggableFlatList, ScaleDecorator };
});

// Silence the warning: Animated: `useNativeDriver` is not supported because the native animated module is missing.
jest.mock('react-native-reanimated', () => {
  const Reanimated = require('react-native-reanimated/mock');
  Reanimated.default.call = () => {};
  return Reanimated;
});
