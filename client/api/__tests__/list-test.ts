import { useEndTrip } from '../list';
import { useUpdateMasterItem } from '../items';
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

describe('useUpdateMasterItem', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseHousehold.mockReturnValue({ householdId: 'household-1' });
    mockUseMutation.mockImplementation((options: any) => ({
      mutateAsync: async (args: any) => {
        const result = await options.mutationFn(args);
        if (options.onSuccess) {
          options.onSuccess(result, args, undefined);
        }
        return result;
      },
    }));
  });

  it('throws when item_store_preferences delete fails', async () => {
    const itemsSingle = jest.fn().mockResolvedValue({ data: { id: 'item-1' }, error: null });
    const itemsSelect = jest.fn().mockReturnValue({ single: itemsSingle });
    const itemsEq = jest.fn().mockReturnValue({ select: itemsSelect });
    const itemsUpdate = jest.fn().mockReturnValue({ eq: itemsEq });

    const storesDeleteEq = jest.fn().mockResolvedValue({ error: { message: 'RLS violation' } });
    const storesDelete = jest.fn().mockReturnValue({ eq: storesDeleteEq });

    mockFrom.mockImplementation((table: string) => {
      if (table === 'items') {
        return { update: itemsUpdate };
      }

      if (table === 'item_store_preferences') {
        return { delete: storesDelete };
      }

      return {};
    });

    const mutation = useUpdateMasterItem();

    await expect(
      mutation.mutateAsync({
        id: 'item-1',
        name: 'Milk',
        store_preferences: [{ store_id: 'store-1', status: 'preferred', comment: null }],
      })
    ).rejects.toMatchObject({ message: 'RLS violation' });

    expect(mockInvalidateQueries).not.toHaveBeenCalled();
  });
});
