import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import ItemsScreen from '../items';
import { useAllItems, useCreateMasterItem, useUpdateMasterItem } from '@/api/items';
import { useWordAliases } from '@/api/aliases';
import { useMetadata } from '@/api/metadata';
import { useUndo } from '@/api/undoContext';
import { useVocabulary } from '@/api/vocabulary';

jest.mock('@/api/items');
jest.mock('@/api/aliases', () => {
  const actual = jest.requireActual('@/api/aliases');
  return {
    ...actual,
    useWordAliases: jest.fn(),
  };
});
jest.mock('@/api/metadata');
jest.mock('@/api/undoContext');
jest.mock('@/api/vocabulary');
jest.mock('@/components/UserAvatar', () => ({
  UserAvatar: () => {
    const { Text } = require('react-native');
    return <Text>Avatar Stub</Text>;
  },
}));

const mockUseAllItems = useAllItems as jest.Mock;
const mockUseCreateMasterItem = useCreateMasterItem as jest.Mock;
const mockUseUpdateMasterItem = useUpdateMasterItem as jest.Mock;
const mockUseWordAliases = useWordAliases as jest.Mock;
const mockUseMetadata = useMetadata as jest.Mock;
const mockUseUndo = useUndo as jest.Mock;
const mockUseVocabulary = useVocabulary as jest.Mock;

const safeAreaMetrics = {
  insets: { top: 44, bottom: 34, left: 0, right: 0 },
  frame: { x: 0, y: 0, width: 390, height: 844 },
};

const buildStores = (count: number) =>
  Array.from({ length: count }).map((_, index) => ({
    id: `store-${index + 1}`,
    name: `Store ${index + 1}`,
    color_code: '#2563eb',
  }));

describe('ItemsScreen store preference filter', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    mockUseAllItems.mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
    });
    mockUseCreateMasterItem.mockReturnValue({ mutateAsync: jest.fn().mockResolvedValue({ id: 'item-1' }) });
    mockUseUpdateMasterItem.mockReturnValue({ mutateAsync: jest.fn().mockResolvedValue({ id: 'item-1' }) });
    mockUseWordAliases.mockReturnValue({ data: new Map<string, string>() });
    mockUseUndo.mockReturnValue({
      pushAction: jest.fn(),
      undoLastAction: jest.fn(),
      redoLastAction: jest.fn(),
      canUndo: false,
      canRedo: false,
      undoStack: [],
      redoStack: [],
    });
    mockUseVocabulary.mockReturnValue({ data: undefined });
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

  const openPrefDropdown = () => {
    fireEvent.press(screen.getByTestId('open-new-item-modal-btn'));
    fireEvent.press(screen.getByTestId('pref-store-dropdown-trigger'));
  };

  it('does not show filter input when there are 6 stores', () => {
    mockUseMetadata.mockReturnValue({
      data: {
        stores: buildStores(6),
        categories: [],
      },
    });

    renderScreen();
    openPrefDropdown();

    expect(screen.queryByTestId('pref-store-filter-input')).toBeNull();
  });

  it('shows filter input when there are 7 stores', () => {
    mockUseMetadata.mockReturnValue({
      data: {
        stores: buildStores(7),
        categories: [],
      },
    });

    renderScreen();
    openPrefDropdown();

    expect(screen.getByTestId('pref-store-filter-input')).toBeTruthy();
  });

  it('filters stores case-insensitively, restores on clear, and shows empty-state copy', () => {
    mockUseMetadata.mockReturnValue({
      data: {
        stores: [
          { id: 'store-1', name: 'Safeway', color_code: '#2563eb' },
          { id: 'store-2', name: 'SAFE Mart', color_code: '#16a34a' },
          { id: 'store-3', name: 'Corner Market', color_code: '#ea580c' },
          ...buildStores(4).map((store, index) => ({ ...store, id: `extra-${index + 1}` })),
        ],
        categories: [],
      },
    });

    renderScreen();
    openPrefDropdown();

    fireEvent.changeText(screen.getByTestId('pref-store-filter-input'), 'saf');

    expect(screen.getByTestId('pref-store-option-store-1')).toBeTruthy();
    expect(screen.getByTestId('pref-store-option-store-2')).toBeTruthy();
    expect(screen.queryByTestId('pref-store-option-store-3')).toBeNull();

    fireEvent.changeText(screen.getByTestId('pref-store-filter-input'), '');
    expect(screen.getByTestId('pref-store-option-store-3')).toBeTruthy();

    fireEvent.changeText(screen.getByTestId('pref-store-filter-input'), 'zzz');
    expect(screen.getByText('No stores match')).toBeTruthy();
  });

  it('resets filter text when dropdown closes via store selection', () => {
    mockUseMetadata.mockReturnValue({
      data: {
        stores: [
          { id: 'store-1', name: 'Safeway', color_code: '#2563eb' },
          { id: 'store-2', name: 'Corner Market', color_code: '#16a34a' },
          ...buildStores(5).map((store, index) => ({ ...store, id: `extra-${index + 1}` })),
        ],
        categories: [],
      },
    });

    renderScreen();
    openPrefDropdown();

    fireEvent.changeText(screen.getByTestId('pref-store-filter-input'), 'saf');
    fireEvent.press(screen.getByTestId('pref-store-option-store-1'));

    fireEvent.press(screen.getByTestId('pref-store-dropdown-trigger'));
    expect(screen.getByTestId('pref-store-filter-input').props.value).toBe('');
  });
});
