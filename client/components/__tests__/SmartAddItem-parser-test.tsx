import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SmartAddItem } from '@/components/SmartAddItem';
import { useAllItems, useCreateMasterItem, useMasterItemNames, type MasterItem, type MasterItemRef } from '@/api/items';
import { useAddToList, useDeleteListItem } from '@/api/list';
import { useMetadata } from '@/api/metadata';
import { useUndo } from '@/api/undoContext';
import { useMyProfile } from '@/api/profile';

jest.mock('@/api/items', () => {
  const actual = jest.requireActual('@/api/items');
  return {
    ...actual,
    useMasterItemNames: jest.fn(),
    useAllItems: jest.fn(),
    useCreateMasterItem: jest.fn(),
  };
});
jest.mock('@/api/list');
jest.mock('@/api/metadata');
jest.mock('@/api/undoContext');
jest.mock('@/api/profile');
jest.mock('react-native-safe-area-context', () => {
  const actual = jest.requireActual('react-native-safe-area-context');
  return {
    ...actual,
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  };
});

describe('SmartAddItem parser integration', () => {
  const mockUseMasterItemNames = useMasterItemNames as jest.Mock;
  const mockUseAllItems = useAllItems as jest.Mock;
  const mockUseCreateMasterItem = useCreateMasterItem as jest.Mock;
  const mockUseAddToList = useAddToList as jest.Mock;
  const mockUseDeleteListItem = useDeleteListItem as jest.Mock;
  const mockUseMetadata = useMetadata as jest.Mock;
  const mockUseUndo = useUndo as jest.Mock;
  const mockUseMyProfile = useMyProfile as jest.Mock;

  const addItem = jest.fn();
  const createMasterItem = jest.fn();
  const pushAction = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    addItem.mockResolvedValue({ id: 'list-1' });
    createMasterItem.mockResolvedValue({ id: 'master-new' });

    mockUseMasterItemNames.mockReturnValue({
      data: [
        { id: 'master-1', name: 'Milk', default_qty: '1', alternate_qtys: ['2', '1lb'] },
        { id: 'large-avocado', name: 'Large Avocado', default_qty: '1', alternate_qtys: [] },
        { id: 'avocado', name: 'Avocado', default_qty: '1', alternate_qtys: [] },
      ],
    });

    mockUseAllItems.mockReturnValue({
      data: [
        {
          id: 'master-1',
          name: 'Milk',
          default_qty: '1',
          alternate_qtys: ['2', '1lb'],
          default_category_id: 'cat-1',
          item_store_preferences: [],
        },
        {
          id: 'large-avocado',
          name: 'Large Avocado',
          default_qty: '1',
          alternate_qtys: [],
          default_category_id: 'cat-1',
          item_store_preferences: [],
        },
        {
          id: 'avocado',
          name: 'Avocado',
          default_qty: '1',
          alternate_qtys: [],
          default_category_id: 'cat-1',
          item_store_preferences: [],
        },
      ],
    });

    mockUseCreateMasterItem.mockReturnValue({ mutateAsync: createMasterItem });
    mockUseAddToList.mockReturnValue({ mutateAsync: addItem });
    mockUseDeleteListItem.mockReturnValue({ mutateAsync: jest.fn() });
    mockUseMetadata.mockReturnValue({
      data: {
        stores: [
          { id: 'store-1', name: 'Safeway', color_code: '#2563eb' },
          { id: 'store-2', name: 'Costco', color_code: '#16a34a' },
          { id: 'store-3', name: 'Country Market', color_code: '#ef4444' },
        ],
        categories: [{ id: 'cat-1', name: 'Other' }],
      },
    });
    mockUseUndo.mockReturnValue({ pushAction });
    mockUseMyProfile.mockReturnValue({ data: { warning_preferences: {} } });
  });

  it('shows parsed qty pre-selected on pill', async () => {
    render(<SmartAddItem activeStoreId="store-2" />);

    fireEvent.changeText(screen.getByPlaceholderText('Add item...'), '2 milk');
    fireEvent.press(await screen.findByText('Milk'));

    await waitFor(() => {
      expect(addItem).toHaveBeenCalledWith(
        expect.objectContaining({
          quantity: '2',
        })
      );
    });
  });

  it('shows orphan tokens struck-through', async () => {
    render(<SmartAddItem activeStoreId="store-2" />);

    fireEvent.changeText(screen.getByPlaceholderText('Add item...'), 'large green avocado');

    const orphanTokens = await screen.findAllByText('green');
    orphanTokens.forEach((orphan) => {
      expect(orphan.props.style).toEqual(expect.objectContaining({ textDecorationLine: 'line-through' }));
    });
  });

  it('shows store pills when @hint present', async () => {
    render(<SmartAddItem activeStoreId="store-2" />);

    fireEvent.changeText(screen.getByPlaceholderText('Add item...'), 'milk @safe');

    expect(await screen.findByText('Store: ')).toBeTruthy();
    expect(screen.getByText('Safeway')).toBeTruthy();
  });

  it('does not show store pills without @hint', () => {
    render(<SmartAddItem activeStoreId="store-2" />);

    fireEvent.changeText(screen.getByPlaceholderText('Add item...'), 'milk');

    expect(screen.queryByText('Store: ')).toBeNull();
  });

  it('shows one-off add row with rawInput', () => {
    render(<SmartAddItem activeStoreId="store-2" />);

    fireEvent.changeText(screen.getByPlaceholderText('Add item...'), 'purple yam');

    expect(screen.getByText('Add "purple yam" (One-time)')).toBeTruthy();
  });

  it('Other replaces pills with text input', async () => {
    render(<SmartAddItem activeStoreId="store-2" />);

    fireEvent.changeText(screen.getByPlaceholderText('Add item...'), '2 milk');
    fireEvent.press(await screen.findByTestId('result-qty-chip-other-master-1'));

    expect(screen.getByPlaceholderText('e.g. 3 lbs')).toBeTruthy();
  });

  it('✕ returns to pill view', async () => {
    render(<SmartAddItem activeStoreId="store-2" />);

    fireEvent.changeText(screen.getByPlaceholderText('Add item...'), '2 milk');
    fireEvent.press(await screen.findByTestId('result-qty-chip-other-master-1'));
    fireEvent.press(screen.getByTestId('qty-other-close-master-1'));

    await waitFor(() => {
      expect(screen.queryByPlaceholderText('e.g. 3 lbs')).toBeNull();
    });
  });
});

// Mock data typed against the exported interfaces — TypeScript enforces alignment with the real
// Supabase query shape. If the interface changes, these objects will fail to compile.
const DISCOVERY_MASTER_ITEM_REFS: MasterItemRef[] = [
  { id: 'milk', name: 'Milk', default_qty: '1 gal', alternate_qtys: ['2'] },
  { id: 'chicken-breast', name: 'Chicken Breast', default_qty: '1 lb', alternate_qtys: ['2 lb'] },
  { id: 'chicken-broth', name: 'Chicken Broth', default_qty: '1 can', alternate_qtys: ['2 cans'] },
  { id: 'bone-broth', name: 'Organic Bone Broth', default_qty: '1 carton', alternate_qtys: [] },
];

const DISCOVERY_ALL_ITEMS: MasterItem[] = DISCOVERY_MASTER_ITEM_REFS.map((ref) => ({
  ...ref,
  short_name: null,
  default_category_id: 'cat-1',
  created_at: '2024-01-01T00:00:00Z',
  item_store_preferences: [],
}));

describe('SmartAddItem prefix fallback discovery', () => {
  const mockUseMasterItemNames = useMasterItemNames as jest.Mock;
  const mockUseAllItems = useAllItems as jest.Mock;
  const mockUseCreateMasterItem = useCreateMasterItem as jest.Mock;
  const mockUseAddToList = useAddToList as jest.Mock;
  const mockUseDeleteListItem = useDeleteListItem as jest.Mock;
  const mockUseMetadata = useMetadata as jest.Mock;
  const mockUseUndo = useUndo as jest.Mock;
  const mockUseMyProfile = useMyProfile as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    mockUseMasterItemNames.mockReturnValue({ data: DISCOVERY_MASTER_ITEM_REFS });
    mockUseAllItems.mockReturnValue({ data: DISCOVERY_ALL_ITEMS });
    mockUseCreateMasterItem.mockReturnValue({ mutateAsync: jest.fn().mockResolvedValue({ id: 'new' }) });
    mockUseAddToList.mockReturnValue({ mutateAsync: jest.fn().mockResolvedValue({ id: 'list-1' }) });
    mockUseDeleteListItem.mockReturnValue({ mutateAsync: jest.fn() });
    mockUseMetadata.mockReturnValue({
      data: {
        stores: [
          { id: 'store-1', name: 'Safeway', color_code: '#2563eb' },
          { id: 'store-2', name: 'Costco', color_code: '#16a34a' },
        ],
        categories: [{ id: 'cat-1', name: 'Other' }],
      },
    });
    mockUseUndo.mockReturnValue({ pushAction: jest.fn() });
    mockUseMyProfile.mockReturnValue({ data: { warning_preferences: {} } });
  });

  it('shows multi-word items when a partial prefix of any word is typed', async () => {
    render(<SmartAddItem activeStoreId="store-1" />);
    fireEvent.changeText(screen.getByPlaceholderText('Add item...'), 'chick');

    expect(await screen.findByText('Chicken Breast')).toBeTruthy();
    expect(screen.getByText('Chicken Broth')).toBeTruthy();
  });

  it('shows item when the partial prefix matches a non-first word', async () => {
    render(<SmartAddItem activeStoreId="store-1" />);
    fireEvent.changeText(screen.getByPlaceholderText('Add item...'), 'bone');

    expect(await screen.findByText('Organic Bone Broth')).toBeTruthy();
  });

  it('strips count from query before matching', async () => {
    render(<SmartAddItem activeStoreId="store-1" />);
    fireEvent.changeText(screen.getByPlaceholderText('Add item...'), '1 chick');

    expect(await screen.findByText('Chicken Breast')).toBeTruthy();
    expect(screen.getByText('Chicken Broth')).toBeTruthy();
  });

  it('strips store hint from query before matching', async () => {
    render(<SmartAddItem activeStoreId="store-1" />);
    fireEvent.changeText(screen.getByPlaceholderText('Add item...'), 'chick @safe');

    expect(await screen.findByText('Chicken Breast')).toBeTruthy();
    expect(screen.getByText('Chicken Broth')).toBeTruthy();
  });

  it('requires all name tokens to match — narrows results as more words are typed', async () => {
    render(<SmartAddItem activeStoreId="store-1" />);
    fireEvent.changeText(screen.getByPlaceholderText('Add item...'), 'chick bro');

    expect(await screen.findByText('Chicken Broth')).toBeTruthy();
    expect(screen.queryByText('Chicken Breast')).toBeNull();
  });

  it('shows no fallback rows when input has no name tokens', async () => {
    render(<SmartAddItem activeStoreId="store-1" />);
    fireEvent.changeText(screen.getByPlaceholderText('Add item...'), '2 oz @safeway');

    expect(screen.queryByText('Chicken Breast')).toBeNull();
    expect(screen.queryByText('Milk')).toBeNull();
    expect(screen.getByText('Add "2 oz @safeway" (One-time)')).toBeTruthy();
  });

  it('parser exact match takes precedence and exact name shows via parser row', async () => {
    // "milk" exact-matches "Milk" via bag-of-words; no fallback needed.
    // Verifies the two paths produce the same visible result so a future refactor
    // doesn't accidentally lose the item.
    render(<SmartAddItem activeStoreId="store-1" />);
    fireEvent.changeText(screen.getByPlaceholderText('Add item...'), 'milk');

    expect(await screen.findByText('Milk')).toBeTruthy();
  });
});
