import { useCreateMasterItem, useUpdateMasterItem } from '../items';
import { useHousehold } from '@/lib/household';
import { supabase } from '@/lib/supabase';

const mockInvalidateQueries = jest.fn();
const mockUseMutation = jest.fn();

jest.mock('@/lib/household', () => ({
  useHousehold: jest.fn(),
}));

jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: jest.fn(),
  },
}));

jest.mock('@tanstack/react-query', () => ({
  useMutation: (options: any) => mockUseMutation(options),
  useQueryClient: () => ({ invalidateQueries: mockInvalidateQueries }),
}));

const mockUseHousehold = useHousehold as jest.Mock;
const mockFrom = supabase.from as jest.Mock;

const setupMockMutation = () => {
  mockUseMutation.mockImplementation((options: any) => ({
    mutateAsync: async (args: any) => {
      const result = await options.mutationFn(args);
      if (options.onSuccess) {
        options.onSuccess(result, args, undefined);
      }
      return result;
    },
  }));
};

describe('items mutations', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseHousehold.mockReturnValue({ householdId: 'household-1' });
    setupMockMutation();
  });

  it('useCreateMasterItem inserts neutral status rows when a comment-only preference is provided', async () => {
    const itemsSingle = jest.fn().mockResolvedValue({ data: { id: 'item-1' }, error: null });
    const itemsSelect = jest.fn().mockReturnValue({ single: itemsSingle });
    const itemsInsert = jest.fn().mockReturnValue({ select: itemsSelect });

    const prefInsert = jest.fn().mockResolvedValue({ error: null });

    mockFrom.mockImplementation((table: string) => {
      if (table === 'items') {
        return { insert: itemsInsert };
      }

      if (table === 'item_store_preferences') {
        return { insert: prefInsert };
      }

      return {};
    });

    const mutation = useCreateMasterItem();

    await mutation.mutateAsync({
      name: 'Milk',
      store_preferences: [
        { store_id: 'store-1', status: 'neutral', comment: 'Only if on sale' },
        { store_id: 'store-2', status: 'preferred', comment: null },
      ],
    });

    expect(prefInsert).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          item_id: 'item-1',
          store_id: 'store-1',
          status: 'neutral',
          comment: 'Only if on sale',
          household_id: 'household-1',
        }),
      ])
    );
  });

  it('useCreateMasterItem throws when householdId is null', async () => {
    mockUseHousehold.mockReturnValue({ householdId: null });

    const mutation = useCreateMasterItem();

    await expect(
      mutation.mutateAsync({
        name: 'Milk',
      })
    ).rejects.toThrow('No household ID found');

    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('useUpdateMasterItem re-inserts neutral status rows with comments', async () => {
    const itemsSingle = jest.fn().mockResolvedValue({ data: { id: 'item-1' }, error: null });
    const itemsSelect = jest.fn().mockReturnValue({ single: itemsSingle });
    const itemsEq = jest.fn().mockReturnValue({ select: itemsSelect });
    const itemsUpdate = jest.fn().mockReturnValue({ eq: itemsEq });

    const storesDeleteEq = jest.fn().mockResolvedValue({ error: null });
    const storesDelete = jest.fn().mockReturnValue({ eq: storesDeleteEq });
    const storesInsert = jest.fn().mockResolvedValue({ error: null });

    mockFrom.mockImplementation((table: string) => {
      if (table === 'items') {
        return { update: itemsUpdate };
      }

      if (table === 'item_store_preferences') {
        return { delete: storesDelete, insert: storesInsert };
      }

      return {};
    });

    const mutation = useUpdateMasterItem();

    await mutation.mutateAsync({
      id: 'item-1',
      name: 'Milk',
      store_preferences: [
        { store_id: 'store-1', status: 'neutral', comment: 'Backup option' },
        { store_id: 'store-2', status: 'avoided', comment: null },
      ],
    });

    expect(storesInsert).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          item_id: 'item-1',
          store_id: 'store-1',
          status: 'neutral',
          comment: 'Backup option',
          household_id: 'household-1',
        }),
      ])
    );
    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['items'] });
    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['all_items'] });
    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['shopping_list'] });
  });

  it('useUpdateMasterItem throws when item_store_preferences delete fails', async () => {
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

  it('useUpdateMasterItem throws when householdId is null', async () => {
    mockUseHousehold.mockReturnValue({ householdId: null });

    const mutation = useUpdateMasterItem();

    await expect(
      mutation.mutateAsync({
        id: 'item-1',
        name: 'Milk',
      })
    ).rejects.toThrow('No household ID found');

    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('useUpdateMasterItem surfaces items update failure', async () => {
    const itemsSingle = jest.fn().mockResolvedValue({ data: null, error: { message: 'update failed' } });
    const itemsSelect = jest.fn().mockReturnValue({ single: itemsSingle });
    const itemsEq = jest.fn().mockReturnValue({ select: itemsSelect });
    const itemsUpdate = jest.fn().mockReturnValue({ eq: itemsEq });

    mockFrom.mockImplementation((table: string) => {
      if (table === 'items') {
        return { update: itemsUpdate };
      }

      return {};
    });

    const mutation = useUpdateMasterItem();

    await expect(
      mutation.mutateAsync({
        id: 'item-1',
        name: 'Milk',
      })
    ).rejects.toMatchObject({ message: 'update failed' });

    expect(mockInvalidateQueries).not.toHaveBeenCalled();
  });

  it('useUpdateMasterItem surfaces item_store_preferences insert failure', async () => {
    const itemsSingle = jest.fn().mockResolvedValue({ data: { id: 'item-1' }, error: null });
    const itemsSelect = jest.fn().mockReturnValue({ single: itemsSingle });
    const itemsEq = jest.fn().mockReturnValue({ select: itemsSelect });
    const itemsUpdate = jest.fn().mockReturnValue({ eq: itemsEq });

    const storesDeleteEq = jest.fn().mockResolvedValue({ error: null });
    const storesDelete = jest.fn().mockReturnValue({ eq: storesDeleteEq });
    const storesInsert = jest.fn().mockResolvedValue({ error: { message: 'insert failed' } });

    mockFrom.mockImplementation((table: string) => {
      if (table === 'items') {
        return { update: itemsUpdate };
      }

      if (table === 'item_store_preferences') {
        return { delete: storesDelete, insert: storesInsert };
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
    ).rejects.toMatchObject({ message: 'insert failed' });

    expect(mockInvalidateQueries).not.toHaveBeenCalled();
  });
});
