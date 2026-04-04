import {
  useCreateVocabularyEntry,
  useDeleteVocabularyEntry,
  useResetVocabularyToDefaults,
  useUpdateVocabularyEntry,
  useVocabulary,
} from '@/api/vocabulary';
import { useHousehold } from '@/lib/household';
import { supabase } from '@/lib/supabase';
import { DEFAULT_VOCABULARY } from '@/lib/vocabulary';

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

describe('vocabulary hooks', () => {
  const mockUseHousehold = useHousehold as jest.Mock;
  const mockFrom = supabase.from as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    mockUseMutation.mockImplementation((options: any) => ({
      mutateAsync: async (args: any) => {
        const result = await options.mutationFn(args);
        if (options.onSuccess) options.onSuccess(result, args, undefined);
        return result;
      },
      isPending: false,
    }));

    mockUseQuery.mockImplementation((options: any) => options);
  });

  it('fetches units, packages, size_descriptors for the household', async () => {
    mockUseHousehold.mockReturnValue({ householdId: 'hh-1' });

    const unitsOrder = jest.fn().mockResolvedValue({ data: [{ id: 'u1', canonical: 'cup', aliases: ['cups'] }], error: null });
    const unitsEq = jest.fn().mockReturnValue({ order: unitsOrder });
    const unitsSelect = jest.fn().mockReturnValue({ eq: unitsEq });

    const packagesOrder = jest.fn().mockResolvedValue({ data: [{ id: 'p1', canonical: 'can', aliases: ['cans'] }], error: null });
    const packagesEq = jest.fn().mockReturnValue({ order: packagesOrder });
    const packagesSelect = jest.fn().mockReturnValue({ eq: packagesEq });

    const sizesOrder = jest.fn().mockResolvedValue({ data: [{ id: 's1', canonical: 'large', aliases: ['lg'] }], error: null });
    const sizesEq = jest.fn().mockReturnValue({ order: sizesOrder });
    const sizesSelect = jest.fn().mockReturnValue({ eq: sizesEq });

    mockFrom.mockImplementation((table: string) => {
      if (table === 'units') return { select: unitsSelect };
      if (table === 'packages') return { select: packagesSelect };
      return { select: sizesSelect };
    });

    const query = useVocabulary();
    const result = await query.queryFn();

    expect(mockFrom).toHaveBeenCalledWith('units');
    expect(mockFrom).toHaveBeenCalledWith('packages');
    expect(mockFrom).toHaveBeenCalledWith('size_descriptors');
    expect(result).toEqual({
      units: [{ id: 'u1', canonical: 'cup', aliases: ['cups'] }],
      packages: [{ id: 'p1', canonical: 'can', aliases: ['cans'] }],
      sizeDescriptors: [{ id: 's1', canonical: 'large', aliases: ['lg'] }],
    });
  });

  it('is disabled when householdId is null', () => {
    mockUseHousehold.mockReturnValue({ householdId: null });

    const query = useVocabulary();

    expect(query.enabled).toBe(false);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('uses staleTime of 5 minutes', () => {
    mockUseHousehold.mockReturnValue({ householdId: 'hh-1' });

    const query = useVocabulary();

    expect(query.staleTime).toBe(300000);
  });

  it('inserts with household_id, canonical, aliases for units', async () => {
    mockUseHousehold.mockReturnValue({ householdId: 'hh-1' });

    const single = jest.fn().mockResolvedValue({ data: { id: 'u1' }, error: null });
    const select = jest.fn().mockReturnValue({ single });
    const insert = jest.fn().mockReturnValue({ select });
    mockFrom.mockReturnValue({ insert });

    const mutation = useCreateVocabularyEntry('units');
    await mutation.mutateAsync({ canonical: 'cup', aliases: ['cups'] });

    expect(insert).toHaveBeenCalledWith({ household_id: 'hh-1', canonical: 'cup', aliases: ['cups'] });
    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['vocabulary'] });
  });

  it('inserts with household_id, canonical, aliases for packages', async () => {
    mockUseHousehold.mockReturnValue({ householdId: 'hh-1' });

    const single = jest.fn().mockResolvedValue({ data: { id: 'p1' }, error: null });
    const select = jest.fn().mockReturnValue({ single });
    const insert = jest.fn().mockReturnValue({ select });
    mockFrom.mockReturnValue({ insert });

    const mutation = useCreateVocabularyEntry('packages');
    await mutation.mutateAsync({ canonical: 'can', aliases: ['cans'] });

    expect(insert).toHaveBeenCalledWith({ household_id: 'hh-1', canonical: 'can', aliases: ['cans'] });
  });

  it('inserts with household_id, canonical, aliases for size_descriptors', async () => {
    mockUseHousehold.mockReturnValue({ householdId: 'hh-1' });

    const single = jest.fn().mockResolvedValue({ data: { id: 's1' }, error: null });
    const select = jest.fn().mockReturnValue({ single });
    const insert = jest.fn().mockReturnValue({ select });
    mockFrom.mockReturnValue({ insert });

    const mutation = useCreateVocabularyEntry('size_descriptors');
    await mutation.mutateAsync({ canonical: 'large', aliases: ['lg'] });

    expect(insert).toHaveBeenCalledWith({ household_id: 'hh-1', canonical: 'large', aliases: ['lg'] });
  });

  it('useCreateVocabularyEntry throws when householdId is null', async () => {
    mockUseHousehold.mockReturnValue({ householdId: null });

    const mutation = useCreateVocabularyEntry('units');

    await expect(mutation.mutateAsync({ canonical: 'cup', aliases: [] })).rejects.toThrow('No household ID found');
  });

  it('updates canonical and aliases, filtered by id and household_id', async () => {
    mockUseHousehold.mockReturnValue({ householdId: 'hh-1' });

    const single = jest.fn().mockResolvedValue({ data: { id: 'u1' }, error: null });
    const select = jest.fn().mockReturnValue({ single });
    const eqHousehold = jest.fn().mockReturnValue({ select });
    const eqId = jest.fn().mockReturnValue({ eq: eqHousehold });
    const update = jest.fn().mockReturnValue({ eq: eqId });
    mockFrom.mockReturnValue({ update });

    const mutation = useUpdateVocabularyEntry('units');
    await mutation.mutateAsync({ id: 'u1', canonical: 'cup', aliases: ['cups'] });

    expect(update).toHaveBeenCalledWith({ canonical: 'cup', aliases: ['cups'] });
    expect(eqId).toHaveBeenCalledWith('id', 'u1');
    expect(eqHousehold).toHaveBeenCalledWith('household_id', 'hh-1');
    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['vocabulary'] });
  });

  it('useUpdateVocabularyEntry throws when householdId is null', async () => {
    mockUseHousehold.mockReturnValue({ householdId: null });

    const mutation = useUpdateVocabularyEntry('units');

    await expect(mutation.mutateAsync({ id: 'u1', canonical: 'cup', aliases: [] })).rejects.toThrow('No household ID found');
  });

  it('deletes by id and household_id', async () => {
    mockUseHousehold.mockReturnValue({ householdId: 'hh-1' });

    const eqHousehold = jest.fn().mockResolvedValue({ error: null });
    const eqId = jest.fn().mockReturnValue({ eq: eqHousehold });
    const del = jest.fn().mockReturnValue({ eq: eqId });
    mockFrom.mockReturnValue({ delete: del });

    const mutation = useDeleteVocabularyEntry('units');
    await mutation.mutateAsync('u1');

    expect(eqId).toHaveBeenCalledWith('id', 'u1');
    expect(eqHousehold).toHaveBeenCalledWith('household_id', 'hh-1');
    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['vocabulary'] });
  });

  it('useDeleteVocabularyEntry throws when householdId is null', async () => {
    mockUseHousehold.mockReturnValue({ householdId: null });

    const mutation = useDeleteVocabularyEntry('units');

    await expect(mutation.mutateAsync('u1')).rejects.toThrow('No household ID found');
  });

  it('deletes all entries for type+household then re-inserts seed data for units', async () => {
    mockUseHousehold.mockReturnValue({ householdId: 'hh-1' });

    const callOrder: string[] = [];
    const deleteEq = jest.fn().mockImplementation(() => {
      callOrder.push('delete');
      return Promise.resolve({ error: null });
    });
    const deleteFn = jest.fn().mockReturnValue({ eq: deleteEq });

    const insertFn = jest.fn().mockImplementation((payload) => {
      callOrder.push('insert');
      return Promise.resolve({ error: null, payload });
    });

    mockFrom.mockImplementation(() => ({
      delete: deleteFn,
      insert: insertFn,
    }));

    const mutation = useResetVocabularyToDefaults('units');
    await mutation.mutateAsync();

    expect(callOrder).toEqual(['delete', 'insert']);
    expect(insertFn).toHaveBeenCalledWith(
      DEFAULT_VOCABULARY.units.map((entry) => ({
        household_id: 'hh-1',
        canonical: entry.canonical,
        aliases: entry.aliases,
      }))
    );
    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['vocabulary'] });
  });

  it('re-inserts seed data for packages', async () => {
    mockUseHousehold.mockReturnValue({ householdId: 'hh-1' });

    const deleteEq = jest.fn().mockResolvedValue({ error: null });
    const deleteFn = jest.fn().mockReturnValue({ eq: deleteEq });
    const insertFn = jest.fn().mockResolvedValue({ error: null });
    mockFrom.mockReturnValue({ delete: deleteFn, insert: insertFn });

    const mutation = useResetVocabularyToDefaults('packages');
    await mutation.mutateAsync();

    expect(insertFn).toHaveBeenCalledWith(
      DEFAULT_VOCABULARY.packages.map((entry) => ({
        household_id: 'hh-1',
        canonical: entry.canonical,
        aliases: entry.aliases,
      }))
    );
  });

  it('re-inserts seed data for size_descriptors', async () => {
    mockUseHousehold.mockReturnValue({ householdId: 'hh-1' });

    const deleteEq = jest.fn().mockResolvedValue({ error: null });
    const deleteFn = jest.fn().mockReturnValue({ eq: deleteEq });
    const insertFn = jest.fn().mockResolvedValue({ error: null });
    mockFrom.mockReturnValue({ delete: deleteFn, insert: insertFn });

    const mutation = useResetVocabularyToDefaults('size_descriptors');
    await mutation.mutateAsync();

    expect(insertFn).toHaveBeenCalledWith(
      DEFAULT_VOCABULARY.sizeDescriptors.map((entry) => ({
        household_id: 'hh-1',
        canonical: entry.canonical,
        aliases: entry.aliases,
      }))
    );
  });

  it('useResetVocabularyToDefaults throws when householdId is null', async () => {
    mockUseHousehold.mockReturnValue({ householdId: null });

    const mutation = useResetVocabularyToDefaults('units');

    await expect(mutation.mutateAsync()).rejects.toThrow('No household ID found');
  });
});
