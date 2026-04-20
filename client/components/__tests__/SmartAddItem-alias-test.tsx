import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SmartAddItem } from '@/components/SmartAddItem';
import { useWordAliases } from '@/api/aliases';
import { useAllItems, useCreateMasterItem, useMasterItemNames } from '@/api/items';
import { useAddToList, useDeleteListItem } from '@/api/list';
import { useMetadata } from '@/api/metadata';
import { useUndo } from '@/api/undoContext';
import { useMyProfile } from '@/api/profile';
import { useVocabulary } from '@/api/vocabulary';
import { parseInput } from '@/lib/parser';

jest.mock('@/api/aliases', () => ({
  useWordAliases: jest.fn(),
}));

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
jest.mock('@/api/vocabulary');

jest.mock('@/lib/parser', () => {
  const actual = jest.requireActual('@/lib/parser');
  return {
    ...actual,
    parseInput: jest.fn(actual.parseInput),
  };
});

jest.mock('react-native-safe-area-context', () => {
  const actual = jest.requireActual('react-native-safe-area-context');
  return {
    ...actual,
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  };
});

describe('SmartAddItem alias behavior', () => {
  const mockUseWordAliases = useWordAliases as jest.Mock;
  const mockUseMasterItemNames = useMasterItemNames as jest.Mock;
  const mockUseAllItems = useAllItems as jest.Mock;
  const mockUseCreateMasterItem = useCreateMasterItem as jest.Mock;
  const mockUseAddToList = useAddToList as jest.Mock;
  const mockUseDeleteListItem = useDeleteListItem as jest.Mock;
  const mockUseMetadata = useMetadata as jest.Mock;
  const mockUseUndo = useUndo as jest.Mock;
  const mockUseMyProfile = useMyProfile as jest.Mock;
  const mockUseVocabulary = useVocabulary as jest.Mock;
  const mockParseInput = parseInput as jest.Mock;

  const addItem = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    addItem.mockResolvedValue({ parent: { id: 'list-1' }, entry: { id: 'entry-1' } });

    mockUseWordAliases.mockReturnValue({ data: new Map<string, string>() });
    mockUseMasterItemNames.mockReturnValue({
      data: [
        {
          id: 'chicken-breast',
          name: 'Chicken Breast',
          default_qty: '1 lb',
          alternate_qtys: ['2 lb'],
          aliases: [],
        },
        {
          id: 'chicken-breast-strips',
          name: 'Chicken Breast Strips',
          default_qty: '1 lb',
          alternate_qtys: ['2 lb'],
          aliases: ['Chicken Tenders'],
        },
      ],
    });
    mockUseAllItems.mockReturnValue({
      data: [
        {
          id: 'chicken-breast',
          name: 'Chicken Breast',
          short_name: null,
          default_qty: '1 lb',
          alternate_qtys: ['2 lb'],
          default_category_id: 'cat-1',
          created_at: '2024-01-01T00:00:00.000Z',
          item_store_preferences: [],
        },
        {
          id: 'chicken-breast-strips',
          name: 'Chicken Breast Strips',
          short_name: null,
          default_qty: '1 lb',
          alternate_qtys: ['2 lb'],
          default_category_id: 'cat-1',
          created_at: '2024-01-01T00:00:00.000Z',
          item_store_preferences: [],
        },
      ],
    });
    mockUseCreateMasterItem.mockReturnValue({ mutateAsync: jest.fn() });
    mockUseAddToList.mockReturnValue({ mutateAsync: addItem });
    mockUseDeleteListItem.mockReturnValue({ mutateAsync: jest.fn() });
    mockUseMetadata.mockReturnValue({
      data: {
        stores: [{ id: 'store-1', name: 'Safeway', color_code: '#2563eb' }],
        categories: [{ id: 'cat-1', name: 'Other' }],
      },
    });
    mockUseUndo.mockReturnValue({ pushAction: jest.fn() });
    mockUseMyProfile.mockReturnValue({ data: { warning_preferences: {} } });
    mockUseVocabulary.mockReturnValue({ data: undefined });
    mockParseInput.mockImplementation(jest.requireActual('@/lib/parser').parseInput);
  });

  it('passes wordAliases to parseInput and shows expanded results', async () => {
    const aliases = new Map<string, string>([['chk', 'chicken']]);
    mockUseWordAliases.mockReturnValue({ data: aliases });

    render(<SmartAddItem activeStoreId="store-1" />);

    fireEvent.changeText(screen.getByPlaceholderText('Add item...'), 'chk');

    await waitFor(() => {
      expect(mockParseInput).toHaveBeenCalledWith(
        'chk',
        expect.any(Object),
        expect.any(Array),
        aliases
      );
    });

    expect(await screen.findByText('Chicken Breast')).toBeTruthy();
  });

  it('shows alias-matched item name in dropdown', async () => {
    mockParseInput.mockReturnValue({
      rawInput: 'chicken tenders',
      interpretations: [
        {
          name: 'Chicken Tenders',
          canonicalName: 'Chicken Breast Strips',
          matchedItemId: 'chicken-breast-strips',
          matchedVia: 'alias',
          count: null,
          packageType: null,
          packagePlural: null,
          sizeDescriptive: null,
          sizeQty: null,
          sizeUnit: null,
          storeHint: null,
          orphans: [],
        },
      ],
    });

    render(<SmartAddItem activeStoreId="store-1" />);

    fireEvent.changeText(screen.getByPlaceholderText('Add item...'), 'chicken tenders');

    expect(await screen.findByText('Chicken Tenders')).toBeTruthy();
    expect(screen.queryByText('Chicken Breast Strips')).toBeNull();
  });

  it('includes match_metadata when adding alias-matched item', async () => {
    mockParseInput.mockReturnValue({
      rawInput: 'chicken tenders',
      interpretations: [
        {
          name: 'Chicken Tenders',
          canonicalName: 'Chicken Breast Strips',
          matchedItemId: 'chicken-breast-strips',
          matchedVia: 'alias',
          count: null,
          packageType: null,
          packagePlural: null,
          sizeDescriptive: null,
          sizeQty: null,
          sizeUnit: null,
          storeHint: null,
          orphans: [],
        },
      ],
    });

    render(<SmartAddItem activeStoreId="store-1" />);

    fireEvent.changeText(screen.getByPlaceholderText('Add item...'), 'chicken tenders');
    fireEvent.press(await screen.findByText('Chicken Tenders'));

    await waitFor(() => {
      expect(addItem).toHaveBeenCalledWith(
        expect.objectContaining({
          match_metadata: {
            matchedName: 'Chicken Tenders',
            canonicalName: 'Chicken Breast Strips',
            matchedVia: 'alias',
          },
        })
      );
    });
  });

  it('omits match_metadata when adding canonical-matched item', async () => {
    mockParseInput.mockReturnValue({
      rawInput: 'chicken breast',
      interpretations: [
        {
          name: 'Chicken Breast',
          canonicalName: 'Chicken Breast',
          matchedItemId: 'chicken-breast',
          matchedVia: 'name',
          count: null,
          packageType: null,
          packagePlural: null,
          sizeDescriptive: null,
          sizeQty: null,
          sizeUnit: null,
          storeHint: null,
          orphans: [],
        },
      ],
    });

    render(<SmartAddItem activeStoreId="store-1" />);

    fireEvent.changeText(screen.getByPlaceholderText('Add item...'), 'chicken breast');
    fireEvent.press(await screen.findByText('Chicken Breast'));

    await waitFor(() => {
      expect(addItem).toHaveBeenCalledWith(
        expect.objectContaining({
          match_metadata: undefined,
        })
      );
    });
  });

  it('prefix fallback expands aliases before matching', async () => {
    mockUseWordAliases.mockReturnValue({ data: new Map<string, string>([['chk', 'chicken']]) });
    mockParseInput.mockReturnValue({ rawInput: 'chk', interpretations: [] });

    render(<SmartAddItem activeStoreId="store-1" />);

    fireEvent.changeText(screen.getByPlaceholderText('Add item...'), 'chk');

    expect(await screen.findByText('Chicken Breast')).toBeTruthy();
  });

  it('prefix fallback matches against item aliases', async () => {
    mockParseInput.mockReturnValue({ rawInput: 'tender', interpretations: [] });

    render(<SmartAddItem activeStoreId="store-1" />);

    fireEvent.changeText(screen.getByPlaceholderText('Add item...'), 'tender');

    expect(await screen.findByText('Chicken Tenders')).toBeTruthy();
  });
});
