import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { SmartAddItem } from '../SmartAddItem';
import { useAllItems, useCreateMasterItem, useMasterItemNames } from '@/api/items';
import { useAddToList, useDeleteListItem } from '@/api/list';
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

describe('SmartAddItem quick accept integration', () => {
  const mockUseMasterItemNames = useMasterItemNames as jest.Mock;
  const mockUseAllItems = useAllItems as jest.Mock;
  const mockUseCreateMasterItem = useCreateMasterItem as jest.Mock;
  const mockUseAddToList = useAddToList as jest.Mock;
  const mockUseDeleteListItem = useDeleteListItem as jest.Mock;
  const mockUseMetadata = useMetadata as jest.Mock;
  const mockUseWordAliases = useWordAliases as jest.Mock;
  const mockUseUndo = useUndo as jest.Mock;
  const mockUseMyProfile = useMyProfile as jest.Mock;
  const mockUseVocabulary = useVocabulary as jest.Mock;

  const addItem = jest.fn();
  const createMasterItem = jest.fn();
  const pushAction = jest.fn();

  const setItems = (items: any[]) => {
    mockUseAllItems.mockReturnValue({ data: items });
    mockUseMasterItemNames.mockReturnValue({
      data: items.map((item) => ({
        id: item.id,
        name: item.name,
        default_qty: item.default_qty ?? null,
        alternate_qtys: item.alternate_qtys ?? [],
        aliases: item.aliases ?? [],
      })),
    });
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    addItem.mockResolvedValue({ parent: { id: 'list-1' }, entry: { id: 'entry-1' } });
    createMasterItem.mockResolvedValue({ id: 'master-new' });

    setItems([
      {
        id: 'master-1',
        name: 'Milk',
        default_qty: '1',
        default_category_id: 'cat-1',
        alternate_qtys: [],
        aliases: [],
        item_store_preferences: [],
      },
      {
        id: 'master-2',
        name: 'Milkshake',
        default_qty: '1',
        default_category_id: 'cat-1',
        alternate_qtys: [],
        aliases: [],
        item_store_preferences: [],
      },
    ]);

    mockUseCreateMasterItem.mockReturnValue({ mutateAsync: createMasterItem });
    mockUseAddToList.mockReturnValue({ mutateAsync: addItem });
    mockUseDeleteListItem.mockReturnValue({ mutateAsync: jest.fn() });
    mockUseMetadata.mockReturnValue({
      data: {
        stores: [{ id: 'store-1', name: 'Safeway', color_code: '#2563eb' }],
        categories: [{ id: 'cat-1', name: 'Other' }],
      },
    });
    mockUseWordAliases.mockReturnValue({ data: new Map<string, string>() });
    mockUseUndo.mockReturnValue({ pushAction });
    mockUseMyProfile.mockReturnValue({
      data: {
        warning_preferences: {
          avoided: 'toast_and_badge',
          unavailable: 'toast_and_badge',
          non_preferred: 'badge_only',
          non_standard_qty: 'badge_only',
        },
        quick_accept_settings: null,
      },
    });
    mockUseVocabulary.mockReturnValue({ data: undefined });
  });

  afterEach(() => {
    act(() => {
      jest.runOnlyPendingTimers();
    });
    jest.useRealTimers();
  });

  it('Enter adds top master match', async () => {
    render(<SmartAddItem activeStoreId="store-1" />);

    fireEvent.changeText(screen.getByPlaceholderText('Add item...'), 'milk');
    fireEvent(screen.getByPlaceholderText('Add item...'), 'submitEditing');

    await waitFor(() => {
      expect(addItem).toHaveBeenCalledWith(
        expect.objectContaining({
          item_id: 'master-1',
          name: 'Milk',
        })
      );
    });
  });

  it('Enter adds one-off when no master match', async () => {
    setItems([]);
    render(<SmartAddItem activeStoreId="store-1" />);

    fireEvent.changeText(screen.getByPlaceholderText('Add item...'), 'Dragonfruit');
    fireEvent(screen.getByPlaceholderText('Add item...'), 'submitEditing');

    await waitFor(() => {
      expect(addItem).toHaveBeenCalledWith(
        expect.objectContaining({
          item_id: null,
          name: 'Dragonfruit',
        })
      );
    });
  });

  it('Enter no-op for empty query', () => {
    render(<SmartAddItem activeStoreId="store-1" />);

    fireEvent(screen.getByPlaceholderText('Add item...'), 'submitEditing');

    expect(addItem).not.toHaveBeenCalled();
  });

  it('input clears after Enter add', async () => {
    render(<SmartAddItem activeStoreId="store-1" />);

    const input = screen.getByPlaceholderText('Add item...');
    fireEvent.changeText(input, 'milk');
    fireEvent(input, 'submitEditing');

    await waitFor(() => {
      expect(addItem).toHaveBeenCalled();
    });

    expect(screen.getByPlaceholderText('Add item...').props.value).toBe('');
  });

  it('Always-on first-row highlight shown and second row not highlighted', async () => {
    render(<SmartAddItem activeStoreId="store-1" />);

    fireEvent.changeText(screen.getByPlaceholderText('Add item...'), 'milk');

    await waitFor(() => {
      expect(screen.getByTestId('smart-add-result-row-0')).toBeTruthy();
      expect(screen.getByTestId('smart-add-result-row-1')).toBeTruthy();
    });

    const firstStyle = StyleSheet.flatten(screen.getByTestId('smart-add-result-row-0').props.style);
    const secondStyle = StyleSheet.flatten(screen.getByTestId('smart-add-result-row-1').props.style);

    expect(firstStyle.backgroundColor).toBe('#eff6ff');
    expect(secondStyle.backgroundColor).not.toBe('#eff6ff');
  });

  it('armed styles after delay', async () => {
    render(<SmartAddItem activeStoreId="store-1" />);

    fireEvent.changeText(screen.getByPlaceholderText('Add item...'), 'milk');

    await waitFor(() => {
      expect(screen.getByTestId('smart-add-result-row-0')).toBeTruthy();
    });

    act(() => {
      jest.advanceTimersByTime(1500);
    });

    const searchBarStyle = StyleSheet.flatten(screen.getByTestId('smart-add-search-bar').props.style);
    const topRowStyle = StyleSheet.flatten(screen.getByTestId('smart-add-result-row-0').props.style);

    expect(searchBarStyle.borderColor).toBe('#bfdbfe');
    expect(topRowStyle.backgroundColor).toBe('#dbeafe');
    expect(topRowStyle.borderLeftWidth).toBe(3);
    expect(topRowStyle.borderLeftColor).toBe('#2563eb');
  });

  it('trigger-word typed while armed adds top result', async () => {
    render(<SmartAddItem activeStoreId="store-1" />);

    fireEvent.changeText(screen.getByPlaceholderText('Add item...'), 'milk');
    act(() => {
      jest.advanceTimersByTime(1500);
    });

    fireEvent.changeText(screen.getByPlaceholderText('Add item...'), 'milk done');

    await waitFor(() => {
      expect(addItem).toHaveBeenCalledWith(
        expect.objectContaining({
          item_id: 'master-1',
        })
      );
    });
  });

  it('trigger-word typed while idle does not auto-add and remains literal text', () => {
    render(<SmartAddItem activeStoreId="store-1" />);

    fireEvent.changeText(screen.getByPlaceholderText('Add item...'), 'milk done');

    expect(addItem).not.toHaveBeenCalled();
    expect(screen.getByPlaceholderText('Add item...').props.value).toBe('milk done');
  });

  it('custom profile trigger word works', async () => {
    mockUseMyProfile.mockReturnValue({
      data: {
        warning_preferences: {
          avoided: 'toast_and_badge',
          unavailable: 'toast_and_badge',
          non_preferred: 'badge_only',
          non_standard_qty: 'badge_only',
        },
        quick_accept_settings: {
          trigger_word: 'go',
          arming_delay_ms: 1000,
        },
      },
    });

    render(<SmartAddItem activeStoreId="store-1" />);

    fireEvent.changeText(screen.getByPlaceholderText('Add item...'), 'milk');
    act(() => {
      jest.advanceTimersByTime(1000);
    });

    fireEvent.changeText(screen.getByPlaceholderText('Add item...'), 'milk go');

    await waitFor(() => {
      expect(addItem).toHaveBeenCalledWith(
        expect.objectContaining({
          item_id: 'master-1',
        })
      );
    });
  });

  it('X clear disarms and clears input', () => {
    render(<SmartAddItem activeStoreId="store-1" />);

    fireEvent.changeText(screen.getByPlaceholderText('Add item...'), 'milk');
    act(() => {
      jest.advanceTimersByTime(1500);
    });

    expect(StyleSheet.flatten(screen.getByTestId('smart-add-search-bar').props.style).borderColor).toBe('#bfdbfe');

    fireEvent.press(screen.getByTestId('smart-add-clear-button'));

    expect(screen.getByPlaceholderText('Add item...').props.value).toBe('');
    expect(StyleSheet.flatten(screen.getByTestId('smart-add-search-bar').props.style).borderColor).toBe('#e5e7eb');
  });
});
