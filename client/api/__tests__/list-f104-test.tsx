import * as React from 'react';
import { useAddQuantityEntry, useAddToList, useEndTrip, useUpdateListItemFields, useUpdateQuantityEntry } from '../list';
import { useHousehold } from '@/lib/household';
import { supabase } from '@/lib/supabase';

const mockInvalidateQueries = jest.fn();
const mockUseMutation = jest.fn();
const mockUseQuery = jest.fn();

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
  },
}));

jest.mock('@tanstack/react-query', () => ({
  useQuery: (options: unknown) => mockUseQuery(options),
  useMutation: (options: unknown) => mockUseMutation(options),
  useQueryClient: () => ({
    invalidateQueries: mockInvalidateQueries,
  }),
}));

const mockUseHousehold = useHousehold as jest.Mock;
const mockFrom = supabase.from as jest.Mock;
const mockRpc = supabase.rpc as jest.Mock;
const mockGetUser = supabase.auth.getUser as jest.Mock;
const mockGetSession = supabase.auth.getSession as jest.Mock;

describe('list F104 hooks', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockUseHousehold.mockReturnValue({
      householdId: 'household-1',
      userId: 'user-1',
    });

    mockUseMutation.mockImplementation((options: any) => ({
      mutateAsync: async (args: any) => {
        const result = await options.mutationFn(args);
        if (options.onSuccess) {
          options.onSuccess(result, args, undefined);
        }
        return result;
      },
      options,
    }));
    mockUseQuery.mockImplementation((options: any) => options);
    mockGetUser.mockResolvedValue({ data: { user: { id: 'auth-user' } } });
    mockGetSession.mockResolvedValue({ data: { session: { user: { id: 'auth-user' } } } });
    mockRpc.mockResolvedValue({ error: null });
  });

  it('useAddToList stores store_id on entry, not parent', async () => {
    const parentInsert = jest.fn();
    const entryInsert = jest.fn();

    mockFrom.mockImplementation((table: string) => {
      if (table === 'list_items') {
        return {
          insert: (payload: unknown) => {
            parentInsert(payload);
            return {
              select: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({ data: { id: 'parent-1' }, error: null }),
              }),
            };
          },
        };
      }

      if (table === 'list_item_quantities') {
        return {
          insert: (payload: unknown) => {
            entryInsert(payload);
            return {
              select: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({ data: { id: 'entry-1' }, error: null }),
              }),
            };
          },
        };
      }

      return {};
    });

    const mutation = useAddToList();
    await mutation.mutateAsync({ name: 'Milk', quantity: '1 gal', store_id: 'store-1' });

    expect(parentInsert).toHaveBeenCalledWith(
      expect.not.objectContaining({ store_id: expect.anything() })
    );
    expect(entryInsert).toHaveBeenCalledWith(
      expect.objectContaining({ list_item_id: 'parent-1', store_id: 'store-1' })
    );
  });

  it('useAddToList with null store_id stores null on entry', async () => {
    const entryInsert = jest.fn();

    mockFrom.mockImplementation((table: string) => {
      if (table === 'list_items') {
        return {
          insert: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({ data: { id: 'parent-1' }, error: null }),
            }),
          }),
        };
      }

      if (table === 'list_item_quantities') {
        return {
          insert: (payload: unknown) => {
            entryInsert(payload);
            return {
              select: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({ data: { id: 'entry-1' }, error: null }),
              }),
            };
          },
        };
      }

      return {};
    });

    const mutation = useAddToList();
    await mutation.mutateAsync({ name: 'Milk', quantity: '1 gal', store_id: null });

    expect(entryInsert).toHaveBeenCalledWith(expect.objectContaining({ store_id: null }));
  });

  it('useAddQuantityEntry stores store_id on entry', async () => {
    const entryInsert = jest.fn();

    mockFrom.mockReturnValue({
      insert: (payload: unknown) => {
        entryInsert(payload);
        return {
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: { id: 'entry-2' }, error: null }),
          }),
        };
      },
    });

    const mutation = useAddQuantityEntry();
    await mutation.mutateAsync({
      listItemId: 'parent-1',
      quantity: '2',
      quantityParsed: null,
      storeId: 'store-2',
    });

    expect(entryInsert).toHaveBeenCalledWith(
      expect.objectContaining({ list_item_id: 'parent-1', store_id: 'store-2' })
    );
  });

  it('useUpdateQuantityEntry accepts store_id update', async () => {
    const updatePayloads: unknown[] = [];

    mockFrom.mockReturnValue({
      update: (payload: unknown) => {
        updatePayloads.push(payload);
        return {
          eq: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({ data: { id: 'entry-1' }, error: null }),
            }),
          }),
        };
      },
    });

    const mutation = useUpdateQuantityEntry();
    await mutation.mutateAsync({ id: 'entry-1', store_id: 'store-3' });

    expect(updatePayloads).toEqual([expect.objectContaining({ store_id: 'store-3' })]);
  });

  it('useUpdateListItemFields does not accept store_id', () => {
    type UpdateListItemFieldsArgs = Parameters<ReturnType<typeof useUpdateListItemFields>['mutateAsync']>[0];

    const validArgs: UpdateListItemFieldsArgs = { id: 'parent-1', name: 'Milk', category_id: null };
    expect(validArgs).toEqual({ id: 'parent-1', name: 'Milk', category_id: null });

    // @ts-expect-error F104 removes store_id from parent field updates
    const invalidArgs: UpdateListItemFieldsArgs = { id: 'parent-1', store_id: 'store-1' };
    expect(invalidArgs).toBeDefined();
  });

  it('useEndTrip with store_id filters entries directly by store_id, not via parent IDs', async () => {
    const eqCalls: Array<[string, unknown]> = [];
    const isCalls: Array<[string, unknown]> = [];

    mockFrom.mockImplementation((table: string) => {
      if (table === 'shopping_trips') {
        return {
          insert: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({ data: { id: 'trip-1' }, error: null }),
            }),
          }),
        };
      }

      if (table === 'list_item_quantities') {
        return {
          update: jest.fn().mockReturnValue({
            eq: jest.fn().mockImplementation((column: string, value: unknown) => {
              eqCalls.push([column, value]);
              return {
                eq: jest.fn().mockImplementation((nextColumn: string, nextValue: unknown) => {
                  eqCalls.push([nextColumn, nextValue]);
                  return {
                    select: jest.fn().mockResolvedValue({ data: [{ id: 'entry-1' }], error: null }),
                  };
                }),
                is: jest.fn().mockImplementation((columnName: string, valueName: unknown) => {
                  isCalls.push([columnName, valueName]);
                  return {
                    eq: jest.fn().mockImplementation((nextColumn: string, nextValue: unknown) => {
                      eqCalls.push([nextColumn, nextValue]);
                      return {
                        eq: jest.fn().mockImplementation((finalColumn: string, finalValue: unknown) => {
                          eqCalls.push([finalColumn, finalValue]);
                          return {
                            select: jest.fn().mockResolvedValue({ data: [{ id: 'entry-1' }], error: null }),
                          };
                        }),
                        select: jest.fn().mockResolvedValue({ data: [{ id: 'entry-1' }], error: null }),
                      };
                    }),
                    select: jest.fn().mockResolvedValue({ data: [{ id: 'entry-1' }], error: null }),
                  };
                }),
              };
            }),
          }),
        };
      }

      throw new Error(`Unexpected table ${table}`);
    });

    const mutation = useEndTrip();
    await mutation.mutateAsync({ store_id: 'store-1', user_id: 'user-2' });

    expect(eqCalls).toContainEqual(['is_purchased', true]);
    expect(isCalls).toContainEqual(['archived_at', null]);
    expect(eqCalls).toContainEqual(['store_id', 'store-1']);
    expect(eqCalls).toContainEqual(['purchased_by', 'user-2']);
    expect(mockFrom).not.toHaveBeenCalledWith('list_items');
  });

  it('useEndTrip without store_id archives all purchased entries across all stores', async () => {
    const eqCalls: Array<[string, unknown]> = [];

    mockFrom.mockImplementation((table: string) => {
      if (table === 'shopping_trips') {
        return {
          insert: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({ data: { id: 'trip-2' }, error: null }),
            }),
          }),
        };
      }

      if (table === 'list_item_quantities') {
        const chain: {
          eq: jest.Mock;
          is: jest.Mock;
          select: jest.Mock;
        } = {
          eq: jest.fn(),
          is: jest.fn(),
          select: jest.fn().mockResolvedValue({ data: [{ id: 'entry-2' }], error: null }),
        };

        chain.eq.mockImplementation((column: string, value: unknown) => {
          eqCalls.push([column, value]);
          return chain;
        });
        chain.is.mockReturnValue(chain);

        return {
          update: jest.fn().mockReturnValue(chain),
        };
      }

      throw new Error(`Unexpected table ${table}`);
    });

    const mutation = useEndTrip();
    await mutation.mutateAsync();

    expect(eqCalls).toContainEqual(['is_purchased', true]);
    expect(eqCalls.some(([column]) => column === 'store_id')).toBe(false);
  });

  it('useAddQuantityEntry throws when householdId is null', async () => {
    mockUseHousehold.mockReturnValue({ householdId: null, userId: 'user-1' });

    const mutation = useAddQuantityEntry();
    await expect(
      mutation.mutateAsync({
        listItemId: 'parent-1',
        quantity: '1',
        quantityParsed: null,
        storeId: 'store-1',
      })
    ).rejects.toThrow('No household ID found');
  });
});
