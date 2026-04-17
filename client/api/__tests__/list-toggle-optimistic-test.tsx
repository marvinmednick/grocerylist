import { useTogglePurchased, type ListItem } from '../list';
import { useHousehold } from '@/lib/household';
import { supabase } from '@/lib/supabase';
import { makeListItem, makeQuantityEntry } from './_helpers/listItemMock';

const mockUseMutation = jest.fn();

const queryCache = new Map<string, unknown>();
const mockCancelQueries = jest.fn();
const mockGetQueryData = jest.fn();
const mockSetQueryData = jest.fn();
const mockInvalidateQueries = jest.fn();

const queryKeyToString = (queryKey: unknown) => JSON.stringify(queryKey);

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
  useMutation: (options: unknown) => mockUseMutation(options),
  useQueryClient: () => ({
    cancelQueries: mockCancelQueries,
    getQueryData: mockGetQueryData,
    setQueryData: mockSetQueryData,
    invalidateQueries: mockInvalidateQueries,
  }),
}));

const mockUseHousehold = useHousehold as jest.Mock;
const mockFrom = supabase.from as jest.Mock;

type ToggleMutationArgs = {
  id: string;
  is_purchased: boolean;
  purchased_by_override?: string | null;
};

type ToggleMutationOptions = {
  mutationFn: (args: ToggleMutationArgs) => Promise<void>;
  onMutate: (args: ToggleMutationArgs) => Promise<{ previous: ListItem[] | undefined }>;
  onError: (_err: unknown, _vars: ToggleMutationArgs, context?: { previous?: ListItem[] }) => void;
  onSettled: (_data?: unknown, _error?: unknown, _vars?: ToggleMutationArgs, _context?: unknown) => void;
};

describe('useTogglePurchased optimistic updates', () => {
  let latestMutationOptions: ToggleMutationOptions;
  type CacheListItem = ListItem;

  const setShoppingListCache = (items: CacheListItem[]) => {
    queryCache.set(queryKeyToString(['shopping_list']), items);
  };

  const getShoppingListCache = () =>
    queryCache.get(queryKeyToString(['shopping_list'])) as CacheListItem[] | undefined;

  beforeEach(() => {
    jest.clearAllMocks();
    queryCache.clear();
    jest.useRealTimers();

    mockUseHousehold.mockReturnValue({ userId: 'user-123' });

    mockCancelQueries.mockResolvedValue(undefined);
    mockGetQueryData.mockImplementation((queryKey: unknown) => queryCache.get(queryKeyToString(queryKey)));
    mockSetQueryData.mockImplementation((queryKey: unknown, updaterOrValue: unknown) => {
      const cacheKey = queryKeyToString(queryKey);
      const previous = queryCache.get(cacheKey);
      const nextValue =
        typeof updaterOrValue === 'function'
          ? (updaterOrValue as (old: unknown) => unknown)(previous)
          : updaterOrValue;
      queryCache.set(cacheKey, nextValue);
    });
    mockUseMutation.mockImplementation((options: ToggleMutationOptions) => {
      latestMutationOptions = options;
      return {
        mutateAsync: options.mutationFn,
      };
    });
  });

  it('optimistically updates cache when checking an item', async () => {
    useTogglePurchased();

    setShoppingListCache([
      makeListItem({
        id: 'item-1',
        quantities: [
          makeQuantityEntry({
            id: 'entry-1',
            list_item_id: 'item-1',
            is_purchased: false,
            purchased_by: null,
            purchased_at: null,
          }),
        ],
      }),
    ]);

    await latestMutationOptions.onMutate({ id: 'entry-1', is_purchased: true });

    const updatedEntry = getShoppingListCache()?.[0].quantities[0];
    expect(updatedEntry?.is_purchased).toBe(true);
    expect(updatedEntry?.purchased_by).toBe('user-123');
    expect(updatedEntry?.purchased_at).toEqual(expect.any(String));
    expect(new Date(updatedEntry?.purchased_at as string).toString()).not.toBe('Invalid Date');
  });

  it('optimistically clears purchased fields when unchecking an item', async () => {
    useTogglePurchased();

    setShoppingListCache([
      makeListItem({
        id: 'item-1',
        quantities: [
          makeQuantityEntry({
            id: 'entry-1',
            list_item_id: 'item-1',
            is_purchased: true,
            purchased_by: 'user-123',
            purchased_at: '2026-04-13T10:00:00.000Z',
          }),
        ],
      }),
    ]);

    await latestMutationOptions.onMutate({ id: 'entry-1', is_purchased: false });

    const updatedEntry = getShoppingListCache()?.[0].quantities[0];
    expect(updatedEntry?.is_purchased).toBe(false);
    expect(updatedEntry?.purchased_at).toBeNull();
    expect(updatedEntry?.purchased_by).toBeNull();
  });

  it('uses purchased_by_override in optimistic cache when provided', async () => {
    useTogglePurchased();

    setShoppingListCache([
      makeListItem({
        id: 'item-1',
        quantities: [
          makeQuantityEntry({
            id: 'entry-1',
            list_item_id: 'item-1',
            is_purchased: false,
            purchased_by: null,
          }),
        ],
      }),
    ]);

    await latestMutationOptions.onMutate({
      id: 'entry-1',
      is_purchased: true,
      purchased_by_override: 'user-B',
    });

    const updatedEntry = getShoppingListCache()?.[0].quantities[0];
    expect(updatedEntry?.purchased_by).toBe('user-B');
  });

  it('restores previous snapshot on error after optimistic update', async () => {
    useTogglePurchased();

    const initialState: CacheListItem[] = [makeListItem({
      id: 'item-1',
      quantities: [
        makeQuantityEntry({
          id: 'entry-1',
          list_item_id: 'item-1',
          is_purchased: false,
          purchased_by: null,
          purchased_at: null,
        }),
      ],
    })];
    setShoppingListCache(initialState);

    const context = await latestMutationOptions.onMutate({ id: 'entry-1', is_purchased: true });
    expect(getShoppingListCache()?.[0].quantities[0].is_purchased).toBe(true);

    latestMutationOptions.onError(new Error('boom'), { id: 'entry-1', is_purchased: true }, context);

    expect(getShoppingListCache()).toEqual(initialState);
  });

  it('invalidates shopping_list on onSettled for success and error paths', () => {
    useTogglePurchased();

    latestMutationOptions.onSettled(undefined, null, { id: 'entry-1', is_purchased: true }, undefined);
    latestMutationOptions.onSettled(undefined, new Error('boom'), { id: 'entry-1', is_purchased: true }, undefined);

    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['shopping_list'] });
    expect(mockInvalidateQueries).toHaveBeenCalledTimes(2);
  });

  it('mutationFn updates via eq(id) without calling select or single', async () => {
    useTogglePurchased();

    const select = jest.fn();
    const single = jest.fn();
    const eq = jest.fn().mockResolvedValue({ error: null, select, single });
    const update = jest.fn().mockReturnValue({ eq });

    mockFrom.mockReturnValue({ update });

    await latestMutationOptions.mutationFn({ id: 'entry-1', is_purchased: true });

    expect(mockFrom).toHaveBeenCalledWith('list_item_quantities');
    expect(eq).toHaveBeenCalledWith('id', 'entry-1');
    expect(select).not.toHaveBeenCalled();
    expect(single).not.toHaveBeenCalled();
  });
});
