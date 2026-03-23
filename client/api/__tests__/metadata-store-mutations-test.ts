import { useDeleteStore, useStoreCascadeInfo, useUpdateStore } from '../metadata';
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
    from: jest.fn(),
  },
}));

jest.mock('@tanstack/react-query', () => ({
  useQuery: (options: any) => mockUseQuery(options),
  useMutation: (options: any) => mockUseMutation(options),
  useQueryClient: () => ({ invalidateQueries: mockInvalidateQueries }),
}));

const mockUseHousehold = useHousehold as jest.Mock;
const mockFrom = supabase.from as jest.Mock;

describe('metadata store mutations', () => {
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

    mockUseQuery.mockImplementation((options: any) => ({
      queryFn: options.queryFn,
      queryKey: options.queryKey,
      enabled: options.enabled,
      staleTime: options.staleTime,
    }));
  });

  it('useUpdateStore updates name/color and invalidates metadata', async () => {
    const single = jest.fn().mockResolvedValue({ data: { id: 'store-1' }, error: null });
    const select = jest.fn().mockReturnValue({ single });
    const eqHousehold = jest.fn().mockReturnValue({ select });
    const eqId = jest.fn().mockReturnValue({ eq: eqHousehold });
    const update = jest.fn().mockReturnValue({ eq: eqId });

    mockFrom.mockReturnValue({ update });

    const mutation = useUpdateStore();
    await mutation.mutateAsync({ id: 'store-1', name: 'Fresh Market', color_code: '#16a34a' });

    expect(update).toHaveBeenCalledWith({ name: 'Fresh Market', color_code: '#16a34a' });
    expect(eqId).toHaveBeenCalledWith('id', 'store-1');
    expect(eqHousehold).toHaveBeenCalledWith('household_id', 'household-1');
    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['metadata'] });
  });

  it('useUpdateStore throws when householdId is null', async () => {
    mockUseHousehold.mockReturnValue({ householdId: null });

    const mutation = useUpdateStore();

    await expect(
      mutation.mutateAsync({ id: 'store-1', name: 'Fresh Market', color_code: '#16a34a' })
    ).rejects.toThrow('No household ID found');
  });

  it('useDeleteStore deletes by store/household and invalidates metadata + shopping list', async () => {
    const eqHousehold = jest.fn().mockResolvedValue({ error: null });
    const eqId = jest.fn().mockReturnValue({ eq: eqHousehold });
    const del = jest.fn().mockReturnValue({ eq: eqId });

    mockFrom.mockReturnValue({ delete: del });

    const mutation = useDeleteStore();
    await mutation.mutateAsync('store-1');

    expect(del).toHaveBeenCalled();
    expect(eqId).toHaveBeenCalledWith('id', 'store-1');
    expect(eqHousehold).toHaveBeenCalledWith('household_id', 'household-1');
    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['metadata'] });
    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['shopping_list'] });
  });

  it('useDeleteStore throws when householdId is null', async () => {
    mockUseHousehold.mockReturnValue({ householdId: null });

    const mutation = useDeleteStore();

    await expect(mutation.mutateAsync('store-1')).rejects.toThrow('No household ID found');
  });

  it('useStoreCascadeInfo returns both cascade counts and uses staleTime 0', async () => {
    const prefEq = jest.fn().mockResolvedValue({ count: 4, error: null });
    const prefSelect = jest.fn().mockReturnValue({ eq: prefEq });

    const listIs = jest.fn().mockResolvedValue({ count: 2, error: null });
    const listEq = jest.fn().mockReturnValue({ is: listIs });
    const listSelect = jest.fn().mockReturnValue({ eq: listEq });

    mockFrom.mockImplementation((table: string) => {
      if (table === 'item_store_preferences') {
        return { select: prefSelect };
      }
      if (table === 'list_items') {
        return { select: listSelect };
      }
      return {};
    });

    const query = useStoreCascadeInfo('store-1');
    const result = await query.queryFn();

    expect(query.queryKey).toEqual(['store-cascade', 'store-1']);
    expect(query.enabled).toBe(true);
    expect(query.staleTime).toBe(0);
    expect(prefSelect).toHaveBeenCalledWith('id', { count: 'exact', head: true });
    expect(prefEq).toHaveBeenCalledWith('store_id', 'store-1');
    expect(listSelect).toHaveBeenCalledWith('id', { count: 'exact', head: true });
    expect(listEq).toHaveBeenCalledWith('store_id', 'store-1');
    expect(listIs).toHaveBeenCalledWith('archived_at', null);
    expect(result).toEqual({ itemPrefsCount: 4, activeListItemsCount: 2 });
  });

  it('useStoreCascadeInfo returns zeros and disabled query when storeId is null', async () => {
    const query = useStoreCascadeInfo(null);

    expect(query.queryKey).toEqual(['store-cascade', null]);
    expect(query.enabled).toBe(false);
    expect(query.staleTime).toBe(0);
    await expect(query.queryFn()).resolves.toEqual({ itemPrefsCount: 0, activeListItemsCount: 0 });
  });
});
