import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SmartAddItem } from '../SmartAddItem';
import { useAllItems, useCreateMasterItem, useMasterItemNames } from '@/api/items';
import {
  useAddQuantityEntry,
  useAddToList,
  useDeleteListItem,
  useUpdateListItemFields,
  useUpdateQuantityEntry,
} from '@/api/list';
import { useMetadata } from '@/api/metadata';
import { useWordAliases } from '@/api/aliases';
import { useUndo } from '@/api/undoContext';
import { useMyProfile } from '@/api/profile';
import { useVocabulary } from '@/api/vocabulary';

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
jest.mock('@/api/aliases');
jest.mock('@/api/undoContext');
jest.mock('@/api/profile');
jest.mock('@/api/vocabulary');
jest.mock('react-native-safe-area-context', () => {
  const actual = jest.requireActual('react-native-safe-area-context');
  return {
    ...actual,
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  };
});

describe('SmartAddItem F104', () => {
  const mockUseMasterItemNames = useMasterItemNames as jest.Mock;
  const mockUseAllItems = useAllItems as jest.Mock;
  const mockUseCreateMasterItem = useCreateMasterItem as jest.Mock;
  const mockUseAddQuantityEntry = useAddQuantityEntry as jest.Mock;
  const mockUseAddToList = useAddToList as jest.Mock;
  const mockUseDeleteListItem = useDeleteListItem as jest.Mock;
  const mockUseUpdateQuantityEntry = useUpdateQuantityEntry as jest.Mock;
  const mockUseUpdateListItemFields = useUpdateListItemFields as jest.Mock;
  const mockUseMetadata = useMetadata as jest.Mock;
  const mockUseWordAliases = useWordAliases as jest.Mock;
  const mockUseUndo = useUndo as jest.Mock;
  const mockUseMyProfile = useMyProfile as jest.Mock;
  const mockUseVocabulary = useVocabulary as jest.Mock;

  const pushAction = jest.fn();
  const addItem = jest.fn();
  const addQuantityEntry = jest.fn();
  const updateQuantityEntry = jest.fn();
  const updateListItemFields = jest.fn();

  const baseItem = {
    id: 'master-1',
    name: 'Milk',
    default_qty: '1 gal',
    default_category_id: 'cat-1',
    alternate_qtys: [],
    item_store_preferences: [],
  };

  const duplicateListItem = {
    id: 'list-parent-1',
    name: 'Milk',
    item_id: 'master-1',
    category_id: 'cat-1',
    store_id: null,
    added_at: '2026-01-01T00:00:00.000Z',
    added_by: 'user-1',
    archived_at: null,
    quantities: [
      {
        id: 'entry-existing-1',
        list_item_id: 'list-parent-1',
        quantity: '1 gal',
        quantity_parsed: {
          count: null,
          packageType: null,
          packagePlural: null,
          sizeQty: 1,
          sizeUnit: 'gal',
          sizeDescriptive: null,
        },
        store_id: 'store-1',
        store: { name: 'Market', color_code: '#2563eb' },
        is_purchased: false,
        purchased_at: null,
        purchased_by: null,
        trip_id: null,
        archived_at: null,
        added_at: '2026-01-01T00:00:00.000Z',
        added_by: 'user-1',
        household_id: 'household-1',
      },
    ],
  };

  beforeEach(() => {
    jest.clearAllMocks();

    mockUseMasterItemNames.mockReturnValue({
      data: [
        {
          id: baseItem.id,
          name: baseItem.name,
          default_qty: baseItem.default_qty,
          alternate_qtys: baseItem.alternate_qtys,
        },
      ],
    });
    mockUseAllItems.mockReturnValue({ data: [baseItem] });
    mockUseCreateMasterItem.mockReturnValue({ mutateAsync: jest.fn() });
    mockUseAddQuantityEntry.mockReturnValue({ mutateAsync: addQuantityEntry });
    mockUseAddToList.mockReturnValue({ mutateAsync: addItem });
    mockUseDeleteListItem.mockReturnValue({ mutateAsync: jest.fn() });
    mockUseUpdateQuantityEntry.mockReturnValue({ mutateAsync: updateQuantityEntry });
    mockUseUpdateListItemFields.mockReturnValue({ mutateAsync: updateListItemFields });
    mockUseMetadata.mockReturnValue({
      data: {
        stores: [
          { id: 'store-1', name: 'Market', color_code: '#2563eb' },
          { id: 'store-2', name: 'Alt Market', color_code: '#16a34a' },
        ],
        categories: [{ id: 'cat-1', name: 'Other' }],
      },
    });
    mockUseWordAliases.mockReturnValue({ data: new Map<string, string>() });
    mockUseUndo.mockReturnValue({ pushAction });
    mockUseMyProfile.mockReturnValue({
      data: {
        id: 'user-1',
        warning_preferences: {
          avoided: 'toast_and_badge',
          unavailable: 'toast_and_badge',
          non_preferred: 'badge_only',
          non_standard_qty: 'badge_only',
        },
      },
    });
    mockUseVocabulary.mockReturnValue({ data: undefined });

    addItem.mockResolvedValue({ parent: { id: 'list-1' }, entry: { id: 'entry-1' } });
    addQuantityEntry.mockResolvedValue({ id: 'entry-new' });
    updateQuantityEntry.mockResolvedValue({});
    updateListItemFields.mockResolvedValue({});
  });

  it('handleDuplicateAddNew same-store passes storeId to addQuantityEntry', async () => {
    render(<SmartAddItem activeStoreId="store-1" listItems={[duplicateListItem as any]} />);

    fireEvent.changeText(screen.getByPlaceholderText('Add item...'), 'milk');
    fireEvent.press(await screen.findByText('Milk'));
    fireEvent.press(await screen.findByTestId('duplicate-add-new'));

    await waitFor(() => {
      expect(addQuantityEntry).toHaveBeenCalledWith(
        expect.objectContaining({
          listItemId: 'list-parent-1',
          quantity: '1 gal',
          storeId: 'store-1',
        })
      );
    });
  });

  it('handleDuplicateCombine moves store via updateQuantityEntry not updateListItemFields', async () => {
    render(<SmartAddItem activeStoreId="store-2" listItems={[duplicateListItem as any]} />);

    fireEvent.changeText(screen.getByPlaceholderText('Add item...'), 'milk');
    fireEvent.press(await screen.findByText('Milk'));
    fireEvent.press(await screen.findByText('2 gal at Alt Market'));

    await waitFor(() => {
      expect(updateQuantityEntry).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'entry-existing-1', store_id: 'store-2' })
      );
    });
    expect(updateListItemFields).not.toHaveBeenCalled();
  });
});
