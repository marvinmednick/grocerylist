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

// Silence the warning: Animated: `useNativeDriver` is not supported because the native animated module is missing.
jest.mock('react-native-reanimated', () => {
  const Reanimated = require('react-native-reanimated/mock');
  Reanimated.default.call = () => {};
  return Reanimated;
});
