import { useEndTrip, useTogglePurchased } from '../list';
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

describe('F2 list hooks', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
    if (!global.setTimeout) {
      (global as any).setTimeout = () => 0 as unknown as ReturnType<typeof setTimeout>;
    }
    mockUseHousehold.mockReturnValue({ householdId: 'household-1', userId: 'user-123' });
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

  it('useTogglePurchased sets purchased_by to current user when checking', async () => {
    const single = jest.fn().mockResolvedValue({ data: { id: 'item-1' }, error: null });
    const select = jest.fn().mockReturnValue({ single });
    const eq = jest.fn().mockReturnValue({ select });
    const update = jest.fn().mockReturnValue({ eq });
    mockFrom.mockReturnValue({ update });

    const mutation = useTogglePurchased();
    await mutation.mutateAsync({ id: 'item-1', is_purchased: true });

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        is_purchased: true,
        purchased_by: 'user-123',
      })
    );
  });

  it('useTogglePurchased clears purchased_by when unchecking', async () => {
    const single = jest.fn().mockResolvedValue({ data: { id: 'item-1' }, error: null });
    const select = jest.fn().mockReturnValue({ single });
    const eq = jest.fn().mockReturnValue({ select });
    const update = jest.fn().mockReturnValue({ eq });
    mockFrom.mockReturnValue({ update });

    const mutation = useTogglePurchased();
    await mutation.mutateAsync({ id: 'item-1', is_purchased: false });

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        is_purchased: false,
        purchased_by: null,
        purchased_at: null,
      })
    );
  });

  it('runs mutation tracking decrement timer around toggle mutation', async () => {
    jest.useFakeTimers();
    const setTimeoutSpy = jest.spyOn(global, 'setTimeout');
    const single = jest.fn().mockResolvedValue({ data: { id: 'item-1' }, error: null });
    const select = jest.fn().mockReturnValue({ single });
    const eq = jest.fn().mockReturnValue({ select });
    const update = jest.fn().mockReturnValue({ eq });
    mockFrom.mockReturnValue({ update });

    const mutation = useTogglePurchased();
    await mutation.mutateAsync({ id: 'item-1', is_purchased: true });

    expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 500);
  });

  it('useEndTrip adds purchased_by filter only when user_id is provided', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'auth-user' } } });

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

    const mutation = useEndTrip();
    await mutation.mutateAsync({ store_id: 'store-1', user_id: 'user-2' });

    expect(listItemsQuery.eq).toHaveBeenCalledWith('purchased_by', 'user-2');
  });

  it('useEndTrip omits purchased_by filter when user_id is omitted', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'auth-user' } } });

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

    const mutation = useEndTrip();
    await mutation.mutateAsync({ store_id: 'store-1' });

    expect(listItemsQuery.eq).not.toHaveBeenCalledWith('purchased_by', expect.anything());
  });

  it('shopping_trips insert uses provided user_id', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'auth-user' } } });

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

    mockFrom.mockImplementation((table: string) => {
      if (table === 'shopping_trips') {
        return { insert: shoppingTripsInsert };
      }
      if (table === 'list_items') {
        return { update: jest.fn().mockReturnValue(listItemsQuery) };
      }
      return {};
    });

    const mutation = useEndTrip();
    await mutation.mutateAsync({ user_id: 'target-user' });

    expect(shoppingTripsInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'target-user',
      })
    );
  });

  it('throws when householdId is null', async () => {
    mockUseHousehold.mockReturnValue({ householdId: null, userId: 'user-123' });

    const mutation = useEndTrip();

    await expect(mutation.mutateAsync({})).rejects.toThrow('No household ID found');
  });
});
