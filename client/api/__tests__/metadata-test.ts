import { useCreateStore } from '../metadata';
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
  useQuery: jest.fn(),
  useMutation: (options: any) => mockUseMutation(options),
  useQueryClient: () => ({ invalidateQueries: mockInvalidateQueries }),
}));

const mockUseHousehold = useHousehold as jest.Mock;
const mockFrom = supabase.from as jest.Mock;

describe('useCreateStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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

  it('useCreateStore throws when householdId is null', async () => {
    mockUseHousehold.mockReturnValue({ householdId: null });

    const mutation = useCreateStore();

    await expect(
      mutation.mutateAsync({ name: 'Market', color_code: '#2563eb' })
    ).rejects.toThrow('No household ID found');
  });

  it('useCreateStore inserts with household_id', async () => {
    mockUseHousehold.mockReturnValue({ householdId: 'household-1' });

    const single = jest.fn().mockResolvedValue({ data: { id: 'store-1' }, error: null });
    const select = jest.fn().mockReturnValue({ single });
    const insert = jest.fn().mockReturnValue({ select });
    mockFrom.mockReturnValue({ insert });

    const mutation = useCreateStore();
    await mutation.mutateAsync({ name: 'Market', color_code: '#2563eb' });

    expect(insert).toHaveBeenCalledWith({
      name: 'Market',
      color_code: '#2563eb',
      household_id: 'household-1',
    });
    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['metadata'] });
  });
});
