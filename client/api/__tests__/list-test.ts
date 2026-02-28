import { useEndTrip } from '../list';
import { useHousehold } from '@/lib/household';
import { supabase } from '@/lib/supabase';

const mockInvalidateQueries = jest.fn();
const mockUseMutation = jest.fn();

jest.mock('@/lib/household', () => ({
  useHousehold: jest.fn(),
}));

jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: jest.fn(),
    },
    from: jest.fn(),
  },
}));

jest.mock('@tanstack/react-query', () => ({
  useQuery: jest.fn(),
  useMutation: (options: any) => mockUseMutation(options),
  useQueryClient: () => ({ invalidateQueries: mockInvalidateQueries }),
}));

const mockUseHousehold = useHousehold as jest.Mock;
const mockGetUser = supabase.auth.getUser as jest.Mock;
const mockFrom = supabase.from as jest.Mock;

const setupSupabaseMocks = () => {
  const shoppingTripsSingle = jest.fn().mockResolvedValue({ data: { id: 'trip-1' }, error: null });
  const shoppingTripsSelect = jest.fn().mockReturnValue({ single: shoppingTripsSingle });
  const shoppingTripsInsert = jest.fn().mockReturnValue({ select: shoppingTripsSelect });

  const listItemsQuery = {
    eq: jest.fn(),
    is: jest.fn(),
    select: jest.fn().mockResolvedValue({ data: [], error: null }),
  };
  listItemsQuery.eq.mockReturnValue(listItemsQuery);
  listItemsQuery.is.mockReturnValue(listItemsQuery);
  const listItemsUpdate = jest.fn().mockReturnValue(listItemsQuery);

  mockFrom.mockImplementation((table: string) => {
    if (table === 'shopping_trips') {
      return { insert: shoppingTripsInsert };
    }

    if (table === 'list_items') {
      return { update: listItemsUpdate };
    }

    return {};
  });

  return {
    shoppingTripsInsert,
  };
};

describe('useEndTrip', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseHousehold.mockReturnValue({ householdId: 'household-1' });
    mockUseMutation.mockImplementation((options: any) => ({
      mutateAsync: options.mutationFn,
    }));
  });

  it('sets user_id when ending a trip', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-123' } } });
    const { shoppingTripsInsert } = setupSupabaseMocks();

    const mutation = useEndTrip();
    await mutation.mutateAsync({});

    expect(shoppingTripsInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'user-123',
      })
    );
  });

  it('sets user_id to null when auth returns no user', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const { shoppingTripsInsert } = setupSupabaseMocks();

    const mutation = useEndTrip();
    await mutation.mutateAsync({});

    expect(shoppingTripsInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: null,
      })
    );
  });
});
