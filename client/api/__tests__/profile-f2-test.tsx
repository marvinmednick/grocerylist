import { useHouseholdMembers } from '../profile';
import { supabase } from '@/lib/supabase';

const mockUseQuery = jest.fn();

jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: jest.fn(),
  },
}));

jest.mock('@tanstack/react-query', () => ({
  useMutation: jest.fn(),
  useQuery: (options: any) => mockUseQuery(options),
  useQueryClient: jest.fn(),
}));

const mockFrom = supabase.from as jest.Mock;

describe('useHouseholdMembers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseQuery.mockImplementation((options: any) => options);
  });

  it('returns rows with id, display_name, display_name_short, color', async () => {
    const eq = jest.fn().mockResolvedValue({
      data: [
        {
          id: 'user-1',
          display_name: 'Alice',
          display_name_short: 'AL',
          color: '#2563eb',
        },
      ],
      error: null,
    });
    const select = jest.fn().mockReturnValue({ eq });
    mockFrom.mockReturnValue({ select });

    const query = useHouseholdMembers('household-1') as any;
    const result = await query.queryFn();

    expect(query.queryKey).toEqual(['household_members', 'household-1']);
    expect(query.enabled).toBe(true);
    expect(query.staleTime).toBe(5 * 60 * 1000);
    expect(select).toHaveBeenCalledWith('id, display_name, display_name_short, color');
    expect(eq).toHaveBeenCalledWith('household_id', 'household-1');
    expect(result).toEqual([
      {
        id: 'user-1',
        display_name: 'Alice',
        display_name_short: 'AL',
        color: '#2563eb',
      },
    ]);
  });

  it('null household path is disabled and returns empty array', async () => {
    const query = useHouseholdMembers(null) as any;
    const result = await query.queryFn();

    expect(query.queryKey).toEqual(['household_members', null]);
    expect(query.enabled).toBe(false);
    expect(result).toEqual([]);
    expect(mockFrom).not.toHaveBeenCalled();
  });
});
