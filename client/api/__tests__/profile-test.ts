import { useHouseholdMemberColors, useHouseholdName, useUpdateProfile } from '../profile';
import { supabase } from '@/lib/supabase';

const mockInvalidateQueries = jest.fn();
const mockUseMutation = jest.fn();
const mockUseQuery = jest.fn();

jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: jest.fn(),
    },
    from: jest.fn(),
  },
}));

jest.mock('@tanstack/react-query', () => ({
  useMutation: (options: any) => mockUseMutation(options),
  useQuery: (options: any) => mockUseQuery(options),
  useQueryClient: () => ({ invalidateQueries: mockInvalidateQueries }),
}));

const mockGetSession = supabase.auth.getSession as jest.Mock;
const mockFrom = supabase.from as jest.Mock;

describe('profile hooks', () => {
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
    mockUseQuery.mockImplementation((options: any) => options);
  });

  it('useUpdateProfile sends exact profiles update payload', async () => {
    const eq = jest.fn().mockResolvedValue({ data: [{ id: 'u1' }], error: null });
    const update = jest.fn().mockReturnValue({ eq });
    mockFrom.mockReturnValue({ update });
    mockGetSession.mockResolvedValue({ data: { session: { user: { id: 'user-1' } } } });

    const mutation = useUpdateProfile();
    await mutation.mutateAsync({
      display_name: 'Alice',
      display_name_short: 'Ali',
      color: '#2563eb',
    });

    expect(mockFrom).toHaveBeenCalledWith('profiles');
    expect(update).toHaveBeenCalledWith({
      display_name: 'Alice',
      display_name_short: 'Ali',
      color: '#2563eb',
    });
    expect(eq).toHaveBeenCalledWith('id', 'user-1');
  });

  it('useUpdateProfile invalidates my_profile query key on success', async () => {
    const eq = jest.fn().mockResolvedValue({ data: [{ id: 'u1' }], error: null });
    const update = jest.fn().mockReturnValue({ eq });
    mockFrom.mockReturnValue({ update });
    mockGetSession.mockResolvedValue({ data: { session: { user: { id: 'user-1' } } } });

    const mutation = useUpdateProfile();
    await mutation.mutateAsync({
      display_name: 'Alice',
      display_name_short: 'Ali',
      color: '#2563eb',
    });

    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['my_profile'] });
  });

  it('useHouseholdName returns household name from households', async () => {
    const single = jest.fn().mockResolvedValue({ data: { name: 'The Smiths' }, error: null });
    const eq = jest.fn().mockReturnValue({ single });
    const select = jest.fn().mockReturnValue({ eq });
    mockFrom.mockReturnValue({ select });

    const query = useHouseholdName('house-1') as any;
    const result = await query.queryFn();

    expect(query.queryKey).toEqual(['household_name', 'house-1']);
    expect(query.enabled).toBe(true);
    expect(mockFrom).toHaveBeenCalledWith('households');
    expect(result).toBe('The Smiths');
  });

  it('useHouseholdMemberColors returns other member colors list', async () => {
    const neq = jest.fn().mockResolvedValue({
      data: [{ color: '#16a34a' }, { color: '#dc2626' }, { color: null }],
      error: null,
    });
    const eq = jest.fn().mockReturnValue({ neq });
    const select = jest.fn().mockReturnValue({ eq });
    mockFrom.mockReturnValue({ select });
    mockGetSession.mockResolvedValue({ data: { session: { user: { id: 'user-1' } } } });

    const query = useHouseholdMemberColors('house-1') as any;
    const result = await query.queryFn();

    expect(query.queryKey).toEqual(['household_member_colors', 'house-1']);
    expect(query.enabled).toBe(true);
    expect(mockFrom).toHaveBeenCalledWith('profiles');
    expect(result).toEqual(['#16a34a', '#dc2626']);
  });

  it('useHouseholdMemberColors is disabled when householdId is null', () => {
    const query = useHouseholdMemberColors(null) as any;

    expect(query.queryKey).toEqual(['household_member_colors', null]);
    expect(query.enabled).toBe(false);
    expect(mockFrom).not.toHaveBeenCalled();
  });
});
