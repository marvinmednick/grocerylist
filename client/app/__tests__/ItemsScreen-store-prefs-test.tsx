import React from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import ItemsScreen from '../(tabs)/items';
import { useAllItems, useCreateMasterItem, useUpdateMasterItem } from '@/api/items';
import { useMetadata } from '@/api/metadata';
import { useUndo } from '@/api/undoContext';
import { useHousehold } from '@/lib/household';

jest.mock('@/api/items');
jest.mock('@/api/metadata');
jest.mock('@/api/undoContext');
jest.mock('@/lib/household', () => ({
  useHousehold: jest.fn(),
}));
jest.mock('@/components/HeaderActions', () => ({
  HeaderActions: () => null,
}));
jest.mock('react-native/Libraries/Lists/VirtualizedList', () => {
  const React = require('react');
  const { View } = require('react-native');
  return class MockVirtualizedList extends React.Component<any> {
    render() {
      const items = this.props.data ?? [];
      return (
        <View>
          {items.map((item: any, index: number) => this.props.renderItem({ item, index }))}
          {this.props.ListEmptyComponent || null}
        </View>
      );
    }
  };
});

const mockUseAllItems = useAllItems as jest.Mock;
const mockUseCreateMasterItem = useCreateMasterItem as jest.Mock;
const mockUseUpdateMasterItem = useUpdateMasterItem as jest.Mock;
const mockUseMetadata = useMetadata as jest.Mock;
const mockUseUndo = useUndo as jest.Mock;
const mockUseHousehold = useHousehold as jest.Mock;

const safeAreaMetrics = {
  insets: { top: 44, bottom: 34, left: 0, right: 0 },
  frame: { x: 0, y: 0, width: 390, height: 844 },
};

describe('ItemsScreen store preferences redesign', () => {
  const createMutateAsync = jest.fn();
  const updateMutateAsync = jest.fn();

  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();

    createMutateAsync.mockResolvedValue({ id: 'item-2' });
    updateMutateAsync.mockResolvedValue({ id: 'item-1' });

    mockUseAllItems.mockReturnValue({
      data: [
        {
          id: 'item-1',
          name: 'Peanut Butter',
          short_name: 'PB',
          default_qty: '16oz',
          default_category_id: 'cat-1',
          alternate_qtys: [],
          item_store_preferences: [],
          category: { name: 'Pantry' },
        },
      ],
      isLoading: false,
      error: null,
    });

    mockUseCreateMasterItem.mockReturnValue({ mutateAsync: createMutateAsync });
    mockUseUpdateMasterItem.mockReturnValue({ mutateAsync: updateMutateAsync });
    mockUseMetadata.mockReturnValue({
      data: {
        stores: [
          { id: 'store-1', name: 'Market', color_code: '#2563eb' },
          { id: 'store-2', name: 'Alt Market', color_code: '#16a34a' },
        ],
        categories: [{ id: 'cat-1', name: 'Pantry' }],
      },
    });
    mockUseUndo.mockReturnValue({
      pushAction: jest.fn(),
      undoLastAction: jest.fn(),
      redoLastAction: jest.fn(),
      canUndo: false,
      canRedo: false,
      undoStack: [],
      redoStack: [],
    });
    mockUseHousehold.mockReturnValue({ householdId: 'h1', isLoading: false });
  });

  afterEach(() => {
    act(() => {
      jest.runOnlyPendingTimers();
    });
    jest.useRealTimers();
  });

  const renderScreen = () =>
    render(
      <SafeAreaProvider initialMetrics={safeAreaMetrics}>
        <ItemsScreen />
      </SafeAreaProvider>
    );

  const openEditModal = () => {
    fireEvent.press(screen.getByText('Peanut Butter - 16oz'));
  };

  const selectPreferenceStore = (storeId: string) => {
    fireEvent.press(screen.getByTestId('pref-store-dropdown-trigger'));
    fireEvent.press(screen.getByTestId(`pref-store-option-${storeId}`));
  };

  it('renders store dropdown and 4 status pills including Unavailable', () => {
    renderScreen();
    openEditModal();

    expect(screen.getByTestId('pref-store-dropdown-trigger')).toBeTruthy();
    expect(screen.getByText('—')).toBeTruthy();
    expect(screen.getByText('Pref.')).toBeTruthy();
    expect(screen.getByText('Avoid')).toBeTruthy();
    expect(screen.getByText('Unavailable')).toBeTruthy();
    expect(screen.queryByText('N/A')).toBeNull();
  });

  it('comment field is not visible before a store is selected', () => {
    renderScreen();
    openEditModal();

    expect(screen.queryByTestId('inline-comment-input')).toBeNull();
  });

  it('comment field appears after a store is selected', () => {
    renderScreen();
    openEditModal();
    selectPreferenceStore('store-1');

    expect(screen.getByTestId('inline-comment-input')).toBeTruthy();
  });

  it('shows empty state when no comments exist', () => {
    renderScreen();
    openEditModal();

    expect(screen.getByText('No comments yet.')).toBeTruthy();
  });

  it('tapping a status pill immediately updates preference without a save button', () => {
    renderScreen();
    openEditModal();
    selectPreferenceStore('store-1');

    fireEvent.press(screen.getByTestId('pref-status-pill-preferred'));

    expect(screen.getByText('Pref.: ')).toBeTruthy();
  });

  it('tapping — clears preference for selected store', () => {
    renderScreen();
    openEditModal();
    selectPreferenceStore('store-1');

    fireEvent.press(screen.getByTestId('pref-status-pill-preferred'));
    expect(screen.getByText('Pref.: ')).toBeTruthy();

    fireEvent.press(screen.getByTestId('pref-status-pill-neutral'));
    expect(screen.queryByText('Pref.: ')).toBeNull();
  });

  it('no + or − buttons are rendered', () => {
    renderScreen();
    openEditModal();

    expect(screen.queryByTestId('pref-apply')).toBeNull();
    expect(screen.queryByTestId('pref-clear')).toBeNull();
  });

  it('comment field populates with existing comment when store is selected', () => {
    mockUseAllItems.mockReturnValue({
      data: [
        {
          id: 'item-1',
          name: 'Peanut Butter',
          short_name: 'PB',
          default_qty: '16oz',
          default_category_id: 'cat-1',
          alternate_qtys: [],
          item_store_preferences: [
            {
              store_id: 'store-2',
              status: 'neutral',
              comment: 'Only if organic',
              store: { id: 'store-2', name: 'Alt Market', color_code: '#16a34a' },
            },
          ],
          category: { name: 'Pantry' },
        },
      ],
      isLoading: false,
      error: null,
    });

    renderScreen();
    openEditModal();
    selectPreferenceStore('store-2');

    expect(screen.getByTestId('inline-comment-input').props.value).toBe('Only if organic');
  });

  it('typing in comment field immediately updates storePreferences and shows in All Store Comments list', () => {
    renderScreen();
    openEditModal();
    selectPreferenceStore('store-1');

    fireEvent.changeText(screen.getByTestId('inline-comment-input'), 'Only on sale');

    expect(screen.getByText('Market — "Only on sale"')).toBeTruthy();
  });

  it('no Save Comment button is rendered', () => {
    renderScreen();
    openEditModal();
    selectPreferenceStore('store-1');

    expect(screen.queryByTestId('save-comment-btn')).toBeNull();
  });

  it('clearing comment field and saving modal removes comment from All Store Comments list', async () => {
    renderScreen();
    openEditModal();
    selectPreferenceStore('store-1');

    fireEvent.changeText(screen.getByTestId('inline-comment-input'), 'Only on sale');
    expect(screen.getByText('Market — "Only on sale"')).toBeTruthy();

    fireEvent.changeText(screen.getByTestId('inline-comment-input'), '');
    expect(screen.queryByText('Market — "Only on sale"')).toBeNull();

    await act(async () => {
      fireEvent.press(screen.getByTestId('item-modal-save-btn'));
    });

    expect(updateMutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'item-1',
        store_preferences: [],
      })
    );
  });

  it('tapping store name in summary selects it in dropdown and populates comment field', () => {
    renderScreen();
    openEditModal();
    selectPreferenceStore('store-1');

    fireEvent.press(screen.getByTestId('pref-status-pill-preferred'));
    fireEvent.changeText(screen.getByTestId('inline-comment-input'), 'Only if discounted');

    fireEvent.press(screen.getByTestId('summary-store-store-1'));

    const dropdown = screen.getByTestId('pref-store-dropdown-trigger');
    expect(within(dropdown).getByText('Market')).toBeTruthy();
    expect(screen.getByTestId('inline-comment-input').props.value).toBe('Only if discounted');
  });

  it('tapping a comment row selects that store in dropdown', () => {
    renderScreen();
    openEditModal();

    selectPreferenceStore('store-1');
    fireEvent.changeText(screen.getByTestId('inline-comment-input'), 'Row one comment');

    selectPreferenceStore('store-2');
    fireEvent.changeText(screen.getByTestId('inline-comment-input'), 'Temporary');
    fireEvent.press(screen.getByTestId('comment-row-store-1'));

    const dropdown = screen.getByTestId('pref-store-dropdown-trigger');
    expect(within(dropdown).getByText('Market')).toBeTruthy();
    expect(screen.getByTestId('inline-comment-input').props.value).toBe('Row one comment');
  });

  it('save payload includes neutral rows with non-empty comment and excludes neutral rows with empty comment', async () => {
    renderScreen();
    openEditModal();

    selectPreferenceStore('store-1');
    fireEvent.changeText(screen.getByTestId('inline-comment-input'), 'Only if discounted');

    selectPreferenceStore('store-2');
    fireEvent.changeText(screen.getByTestId('inline-comment-input'), '');

    await act(async () => {
      fireEvent.press(screen.getByTestId('item-modal-save-btn'));
    });

    expect(updateMutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'item-1',
        store_preferences: [{ store_id: 'store-1', status: 'neutral', comment: 'Only if discounted' }],
      })
    );
  });
});
