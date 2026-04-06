import {
  useCreateWordAlias,
  useDeleteWordAlias,
  useWordAliases,
} from '../aliases';
import { useHousehold } from '@/lib/household';
import { supabase } from '@/lib/supabase';

const mockInvalidateQueries = jest.fn();
const mockUseQuery = jest.fn();
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
  useQuery: (options: any) => mockUseQuery(options),
  useMutation: (options: any) => mockUseMutation(options),
  useQueryClient: () => ({ invalidateQueries: mockInvalidateQueries }),
}));

const mockUseHousehold = useHousehold as jest.Mock;
const mockFrom = supabase.from as jest.Mock;

describe('aliases hooks', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockUseHousehold.mockReturnValue({ householdId: 'household-1', userId: 'user-1' });
    mockUseQuery.mockImplementation((options: any) => options);
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

  it('useWordAliases returns empty map when no aliases exist', async () => {
    const order = jest.fn().mockResolvedValue({ data: [], error: null });
    const eq = jest.fn().mockReturnValue({ order });
    const select = jest.fn().mockReturnValue({ eq });
    mockFrom.mockReturnValue({ select });

    const query = useWordAliases();
    const result = await query.queryFn();

    expect(result).toEqual(new Map());
    expect(select).toHaveBeenCalledWith('id, alias, canonical');
  });

  it('useWordAliases builds alias→canonical map from query results', async () => {
    const order = jest.fn().mockResolvedValue({
      data: [
        { id: '1', alias: 'chk', canonical: 'chicken' },
        { id: '2', alias: 'brst', canonical: 'breast' },
      ],
      error: null,
    });
    const eq = jest.fn().mockReturnValue({ order });
    const select = jest.fn().mockReturnValue({ eq });
    mockFrom.mockReturnValue({ select });

    const query = useWordAliases();
    const result = await query.queryFn();

    expect(result.get('chk')).toBe('chicken');
    expect(result.get('brst')).toBe('breast');
  });

  it('useCreateWordAlias throws when householdId is null', async () => {
    mockUseHousehold.mockReturnValue({ householdId: null, userId: 'user-1' });

    const mutation = useCreateWordAlias();

    await expect(
      mutation.mutateAsync({ alias: 'chk', canonical: 'chicken' })
    ).rejects.toThrow('No household ID found');
  });

  it('useDeleteWordAlias throws when householdId is null', async () => {
    mockUseHousehold.mockReturnValue({ householdId: null, userId: 'user-1' });

    const mutation = useDeleteWordAlias();

    await expect(mutation.mutateAsync('alias-id')).rejects.toThrow('No household ID found');
  });

  it('useCreateWordAlias invalidates word_aliases query key', async () => {
    const single = jest.fn().mockResolvedValue({ data: { id: 'alias-1' }, error: null });
    const select = jest.fn().mockReturnValue({ single });
    const insert = jest.fn().mockReturnValue({ select });
    mockFrom.mockReturnValue({ insert });

    const mutation = useCreateWordAlias();
    await mutation.mutateAsync({ alias: 'CHK', canonical: 'Chicken' });

    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['word_aliases'] });
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        household_id: 'household-1',
        alias: 'chk',
        canonical: 'chicken',
        created_by: 'user-1',
      })
    );
  });
});
