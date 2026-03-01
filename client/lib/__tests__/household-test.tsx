import React from 'react';
import { renderHook, waitFor } from '@testing-library/react-native';
import { HouseholdProvider, useHousehold } from '../household';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

// Mock supabase
jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: jest.fn(),
    },
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn().mockReturnThis(),
  },
}));

describe('HouseholdProvider', () => {
  let queryClient: QueryClient;

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <HouseholdProvider>{children}</HouseholdProvider>
    </QueryClientProvider>
  );

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: Infinity } },
    });
    jest.clearAllMocks();
  });

  afterEach(() => {
    queryClient.clear();
  });

  it('exposes displayName, displayNameShort, avatarColor from profile query', async () => {
    const mockSession = { user: { id: 'user1' } };
    const mockProfile = {
      household_id: 'h1',
      display_name: 'Jane Smith',
      display_name_short: 'JS',
      color: '#ff0000',
    };

    (supabase.auth.getSession as jest.Mock).mockResolvedValue({ data: { session: mockSession } });
    (supabase.from as jest.Mock).mockReturnValue({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: mockProfile, error: null }),
    });

    const { result } = renderHook(() => useHousehold(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.householdId).toBe('h1');
    expect(result.current.displayName).toBe('Jane Smith');
    expect(result.current.displayNameShort).toBe('JS');
    expect(result.current.avatarColor).toBe('#ff0000');
  });

  it('still exposes householdId', async () => {
    const mockSession = { user: { id: 'user1' } };
    const mockProfile = {
      household_id: 'h1',
      display_name: null,
      display_name_short: null,
      color: null,
    };

    (supabase.auth.getSession as jest.Mock).mockResolvedValue({ data: { session: mockSession } });
    (supabase.from as jest.Mock).mockReturnValue({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: mockProfile, error: null }),
    });

    const { result } = renderHook(() => useHousehold(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.householdId).toBe('h1');
  });
});
