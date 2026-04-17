import * as React from 'react';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import {
  useAddToList,
  useDeleteListItem,
  useEndTrip,
  useRevertArchival,
  useShoppingList,
  useTogglePurchased,
  useUpdateListItemFields,
  useUpdateQuantityEntry,
  type ListItem,
  __resetLocalMutationCount,
} from '../list';
import { useHousehold } from '@/lib/household';
import { supabase } from '@/lib/supabase';
import { makeListItem, makeQuantityEntry } from './_helpers/listItemMock';

const queryCache = new Map<string, unknown>();
const mockInvalidateQueries = jest.fn();
const mockCancelQueries = jest.fn();
const mockSetQueryData = jest.fn();
const mockGetQueryData = jest.fn();
const mockUseMutation = jest.fn();
const mockUseQuery = jest.fn();

const queryKeyToString = (queryKey: unknown) => JSON.stringify(queryKey);

jest.mock('@/lib/household', () => ({
  useHousehold: jest.fn(),
}));

jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: jest.fn(),
      getSession: jest.fn(),
    },
    from: jest.fn(),
    rpc: jest.fn(),
    channel: jest.fn(),
    removeChannel: jest.fn(),
  },
}));

jest.mock('@tanstack/react-query', () => ({
  useQuery: (options: unknown) => mockUseQuery(options),
  useMutation: (options: unknown) => mockUseMutation(options),
  useQueryClient: () => ({
    invalidateQueries: mockInvalidateQueries,
    cancelQueries: mockCancelQueries,
    setQueryData: mockSetQueryData,
    getQueryData: mockGetQueryData,
  }),
}));

const mockUseHousehold = useHousehold as jest.Mock;
const mockFrom = supabase.from as jest.Mock;
const mockRpc = supabase.rpc as jest.Mock;
const mockGetUser = supabase.auth.getUser as jest.Mock;
const mockGetSession = supabase.auth.getSession as jest.Mock;
const mockChannel = supabase.channel as jest.Mock;

const makeChannelMock = (callbacks?: Array<(payload: any) => void>) => {
  const channelObj: {
    on: jest.Mock;
    subscribe: jest.Mock;
  } = {
    on: jest.fn(),
    subscribe: jest.fn().mockReturnValue({ id: `chan-${Math.random()}` }),
  };

  channelObj.on.mockImplementation((_event, _config, callback) => {
    callbacks?.push(callback);
    return channelObj;
  });

  return channelObj;
};

describe('list F103 hooks', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
    __resetLocalMutationCount();
    queryCache.clear();

    mockUseHousehold.mockReturnValue({
      householdId: 'household-1',
      userId: 'user-1',
    });

    mockCancelQueries.mockResolvedValue(undefined);
    mockGetQueryData.mockImplementation((queryKey: unknown) => queryCache.get(queryKeyToString(queryKey)));
    mockSetQueryData.mockImplementation((queryKey: unknown, updaterOrValue: unknown) => {
      const key = queryKeyToString(queryKey);
      const previous = queryCache.get(key);
      const next =
        typeof updaterOrValue === 'function'
          ? (updaterOrValue as (old: unknown) => unknown)(previous)
          : updaterOrValue;
      queryCache.set(key, next);
    });
    mockUseMutation.mockImplementation((options: any) => ({
      mutateAsync: async (args: any) => {
        const result = await options.mutationFn(args);
        if (options.onSuccess) options.onSuccess(result, args, undefined);
        return result;
      },
      options,
    }));
    mockUseQuery.mockImplementation((options: any) => options);
    mockChannel.mockImplementation(() => makeChannelMock());

    mockGetUser.mockResolvedValue({ data: { user: { id: 'auth-user' } } });
    mockGetSession.mockResolvedValue({ data: { session: { user: { id: 'auth-user' } } } });
    mockRpc.mockResolvedValue({ error: null });
  });

  it('useTogglePurchased updates the target entry in the shopping_list cache optimistically', async () => {
    mockFrom.mockReturnValue({
      update: jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({ error: null }),
      }),
    });

    const hook: any = useTogglePurchased();
    const options = hook.options;
    const parent = makeListItem({
      id: 'parent-1',
      quantities: [
        makeQuantityEntry({ id: 'q1', list_item_id: 'parent-1', is_purchased: false }),
        makeQuantityEntry({ id: 'q2', list_item_id: 'parent-1', is_purchased: false }),
      ],
    });
    queryCache.set(queryKeyToString(['shopping_list']), [parent]);

    await options.onMutate({ id: 'q2', is_purchased: true });

    const cache = queryCache.get(queryKeyToString(['shopping_list'])) as ListItem[];
    expect(cache[0].quantities.find((q) => q.id === 'q2')?.is_purchased).toBe(true);
    expect(cache[0].quantities.find((q) => q.id === 'q1')?.is_purchased).toBe(false);
  });

  it('useTogglePurchased rolls back on server error', async () => {
    mockFrom.mockReturnValue({
      update: jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({ error: null }),
      }),
    });

    const hook: any = useTogglePurchased();
    const options = hook.options;
    const previous = [makeListItem({ id: 'parent-1', quantities: [makeQuantityEntry({ id: 'q1', list_item_id: 'parent-1' })] })];
    queryCache.set(queryKeyToString(['shopping_list']), previous);

    const context = await options.onMutate({ id: 'q1', is_purchased: true });
    options.onError(new Error('boom'), { id: 'q1', is_purchased: true }, context);

    expect(queryCache.get(queryKeyToString(['shopping_list']))).toEqual(previous);
  });

  it('useAddToList inserts parent then entry; rolls back parent if entry insert fails', async () => {
    const parentSingle = jest.fn().mockResolvedValue({ data: { id: 'parent-1' }, error: null });
    const entrySingle = jest.fn().mockResolvedValue({ data: null, error: new Error('entry failed') });
    const parentDeleteEq = jest.fn().mockResolvedValue({ error: null });

    mockFrom.mockImplementation((table: string) => {
      if (table === 'list_items') {
        return {
          insert: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({ single: parentSingle }),
          }),
          delete: jest.fn().mockReturnValue({ eq: parentDeleteEq }),
        };
      }
      if (table === 'list_item_quantities') {
        return {
          insert: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({ single: entrySingle }),
          }),
        };
      }
      return {};
    });

    const mutation = useAddToList();
    await expect(mutation.mutateAsync({ name: 'Milk', quantity: '1' })).rejects.toThrow('entry failed');
    expect(parentDeleteEq).toHaveBeenCalledWith('id', 'parent-1');
  });

  it('useAddToList throws when householdId is null', async () => {
    mockUseHousehold.mockReturnValue({ householdId: null, userId: 'user-1' });
    const mutation = useAddToList();
    await expect(mutation.mutateAsync({ name: 'Milk' })).rejects.toThrow('No household ID found');
  });

  it('useDeleteListItem deletes the entry and leaves the parent when siblings remain', async () => {
    const entrySingle = jest.fn().mockResolvedValue({ data: { list_item_id: 'parent-1' }, error: null });
    const countNeq = jest.fn().mockResolvedValue({ count: 1, error: null });
    const entryDeleteEq = jest.fn().mockResolvedValue({ error: null });
    const parentDeleteEq = jest.fn().mockResolvedValue({ error: null });

    mockFrom.mockImplementation((table: string) => {
      if (table === 'list_item_quantities') {
        return {
          select: jest.fn().mockImplementation((selection: string, options?: { count?: string; head?: boolean }) => {
            if (selection === 'list_item_id') {
              return {
                eq: jest.fn().mockReturnValue({ single: entrySingle }),
              };
            }
            if (selection === '*' && options?.count === 'exact' && options?.head === true) {
              const countQuery = {
                eq: jest.fn(),
                is: jest.fn(),
                neq: countNeq,
              };
              countQuery.eq.mockReturnValue(countQuery);
              countQuery.is.mockReturnValue(countQuery);
              return countQuery;
            }
            return {};
          }),
          delete: jest.fn().mockReturnValue({ eq: entryDeleteEq }),
        };
      }
      if (table === 'list_items') {
        return { delete: jest.fn().mockReturnValue({ eq: parentDeleteEq }) };
      }
      return {};
    });

    const mutation = useDeleteListItem();
    const result = await mutation.mutateAsync({ entryId: 'entry-1' });

    expect(result.parentDeleted).toBe(false);
    expect(parentDeleteEq).not.toHaveBeenCalled();
  });

  it('useDeleteListItem deletes the entry and the parent when no active siblings remain', async () => {
    const entrySingle = jest.fn().mockResolvedValue({ data: { list_item_id: 'parent-1' }, error: null });
    const countNeq = jest.fn().mockResolvedValue({ count: 0, error: null });
    const entryDeleteEq = jest.fn().mockResolvedValue({ error: null });
    const parentDeleteEq = jest.fn().mockResolvedValue({ error: null });

    mockFrom.mockImplementation((table: string) => {
      if (table === 'list_item_quantities') {
        return {
          select: jest.fn().mockImplementation((selection: string, options?: { count?: string; head?: boolean }) => {
            if (selection === 'list_item_id') {
              return {
                eq: jest.fn().mockReturnValue({ single: entrySingle }),
              };
            }
            if (selection === '*' && options?.count === 'exact' && options?.head === true) {
              const countQuery = {
                eq: jest.fn(),
                is: jest.fn(),
                neq: countNeq,
              };
              countQuery.eq.mockReturnValue(countQuery);
              countQuery.is.mockReturnValue(countQuery);
              return countQuery;
            }
            return {};
          }),
          delete: jest.fn().mockReturnValue({ eq: entryDeleteEq }),
        };
      }
      if (table === 'list_items') {
        return { delete: jest.fn().mockReturnValue({ eq: parentDeleteEq }) };
      }
      return {};
    });

    const mutation = useDeleteListItem();
    const result = await mutation.mutateAsync({ entryId: 'entry-1' });

    expect(result.parentDeleted).toBe(true);
    expect(parentDeleteEq).toHaveBeenCalledWith('id', 'parent-1');
  });

  it('useEndTrip archives matching entries and calls archive_empty_list_items', async () => {
    const tripSingle = jest.fn().mockResolvedValue({ data: { id: 'trip-1' }, error: null });

    const parentQuery = {
      eq: jest.fn(),
      is: jest.fn(),
      then: (resolve: (value: { data: Array<{ id: string }>; error: null }) => unknown) =>
        resolve({ data: [{ id: 'parent-1' }], error: null }),
    };
    parentQuery.eq.mockReturnValue(parentQuery);
    parentQuery.is.mockReturnValue(parentQuery);

    const entriesQuery = {
      eq: jest.fn(),
      is: jest.fn(),
      in: jest.fn(),
      select: jest.fn().mockResolvedValue({ data: [{ id: 'entry-1' }], error: null }),
    };
    entriesQuery.eq.mockReturnValue(entriesQuery);
    entriesQuery.is.mockReturnValue(entriesQuery);
    entriesQuery.in.mockReturnValue(entriesQuery);

    mockFrom.mockImplementation((table: string) => {
      if (table === 'shopping_trips') {
        return {
          insert: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({ single: tripSingle }),
          }),
        };
      }
      if (table === 'list_items') {
        return { select: jest.fn().mockReturnValue(parentQuery) };
      }
      if (table === 'list_item_quantities') {
        return { update: jest.fn().mockReturnValue(entriesQuery) };
      }
      return {};
    });

    const mutation = useEndTrip();
    await mutation.mutateAsync({ store_id: 'store-1', user_id: 'user-2' });

    expect(entriesQuery.eq).toHaveBeenCalledWith('is_purchased', true);
    expect(entriesQuery.eq).toHaveBeenCalledWith('purchased_by', 'user-2');
    expect(mockRpc).toHaveBeenCalledWith('archive_empty_list_items');
  });

  it('useRevertArchival clears archived_at and trip_id on entries and clears archived_at on parents', async () => {
    const selectEq = jest.fn().mockResolvedValue({
      data: [{ list_item_id: 'parent-1' }, { list_item_id: 'parent-2' }],
      error: null,
    });
    const updateEq = jest.fn().mockResolvedValue({ error: null });
    const parentUpdateIn = jest.fn().mockResolvedValue({ error: null });
    const tripDeleteEq = jest.fn().mockResolvedValue({ error: null });

    mockFrom.mockImplementation((table: string) => {
      if (table === 'list_item_quantities') {
        return {
          select: jest.fn().mockReturnValue({ eq: selectEq }),
          update: jest.fn().mockReturnValue({ eq: updateEq }),
        };
      }
      if (table === 'list_items') {
        return { update: jest.fn().mockReturnValue({ in: parentUpdateIn }) };
      }
      if (table === 'shopping_trips') {
        return { delete: jest.fn().mockReturnValue({ eq: tripDeleteEq }) };
      }
      return {};
    });

    const mutation = useRevertArchival();
    await mutation.mutateAsync({ trip_id: 'trip-1' });

    expect(updateEq).toHaveBeenCalledWith('trip_id', 'trip-1');
    expect(parentUpdateIn).toHaveBeenCalledWith('id', ['parent-1', 'parent-2']);
    expect(tripDeleteEq).toHaveBeenCalledWith('id', 'trip-1');
  });

  it('incrementLocalMutation/decrementLocalMutation wrap all new mutations', async () => {
    jest.useFakeTimers();
    const timeoutSpy = jest.spyOn(global, 'setTimeout');

    mockFrom.mockReturnValue({
      update: jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({ error: null }),
      }),
    });
    await useTogglePurchased().mutateAsync({ id: 'entry-1', is_purchased: true });

    mockFrom.mockReturnValue({
      update: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: {}, error: null }),
          }),
        }),
      }),
    });
    await useUpdateListItemFields().mutateAsync({ id: 'parent-1', name: 'New Name' });
    await useUpdateQuantityEntry().mutateAsync({ id: 'entry-1', quantity: '2' });

    expect(timeoutSpy).toHaveBeenCalled();
    jest.runAllTimers();
  });

  it('realtime subscription is created on both list_items and list_item_quantities', () => {
    mockUseQuery.mockReturnValue({ data: [] });

    renderHook(() => useShoppingList(jest.fn()));

    expect(mockChannel).toHaveBeenCalledWith('public:list_items');
    expect(mockChannel).toHaveBeenCalledWith('public:list_item_quantities');
  });

  it('remote toast looks up parent name from cache for list_item_quantities events', async () => {

    const onRemoteChange = jest.fn();
    queryCache.set(queryKeyToString(['shopping_list']), [makeListItem({ id: 'parent-1', name: 'Milk' })]);
    const callbacks: Array<(payload: any) => void> = [];
    mockChannel.mockImplementation(() => makeChannelMock(callbacks));

    renderHook(() => useShoppingList(onRemoteChange));
    await waitFor(() => expect(callbacks).toHaveLength(2));

    act(() => {
      callbacks[1]({ eventType: 'UPDATE', new: { list_item_id: 'parent-1' }, old: null });
    });

    expect(onRemoteChange).toHaveBeenCalledWith('UPDATE', 'Milk');
  });

  it('remote toast falls back to undefined name when parent is not in cache for child events', async () => {

    const onRemoteChange = jest.fn();
    queryCache.set(queryKeyToString(['shopping_list']), []);
    const callbacks: Array<(payload: any) => void> = [];
    mockChannel.mockImplementation(() => makeChannelMock(callbacks));

    renderHook(() => useShoppingList(onRemoteChange));
    await waitFor(() => expect(callbacks).toHaveLength(2));

    act(() => {
      callbacks[1]({ eventType: 'UPDATE', new: { list_item_id: 'parent-missing' }, old: null });
    });

    expect(onRemoteChange).toHaveBeenCalledWith('UPDATE', undefined);
  });
});
