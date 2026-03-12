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
    from: jest.fn(),
  },
}));

jest.mock('@tanstack/react-query', () => ({
  useMutation: (options: any) => mockUseMutation(options),
  useQueryClient: () => ({ invalidateQueries: mockInvalidateQueries }),
}));

const mockUseHousehold = useHousehold as jest.Mock;
const mockFrom = supabase.from as jest.Mock;

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
