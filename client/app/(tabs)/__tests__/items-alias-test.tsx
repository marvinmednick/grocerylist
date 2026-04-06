import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import ItemsScreen from '../items';
import { useAllItems, useCreateMasterItem, useUpdateMasterItem } from '@/api/items';
import { useWordAliases } from '@/api/aliases';
import { useMetadata } from '@/api/metadata';
import { useUndo } from '@/api/undoContext';
import { useVocabulary } from '@/api/vocabulary';

jest.mock('@/api/items');
jest.mock('@/api/metadata');
jest.mock('@/api/undoContext');
jest.mock('@/api/vocabulary');
jest.mock('@/api/aliases', () => {
  const actual = jest.requireActual('@/api/aliases');
  return {
    ...actual,
    useWordAliases: jest.fn(),
  };
});
jest.mock('@/components/Abbreviations', () => ({
  Abbreviations: ({ visible, initialSearch }: { visible: boolean; initialSearch?: string }) => {
    const { Text } = require('react-native');
    return visible ? <Text>Abbrev Modal: {initialSearch}</Text> : null;
  },
}));
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

describe('ItemsScreen alias behavior', () => {
  const createMutateAsync = jest.fn();
  const updateMutateAsync = jest.fn();
  const pushAction = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    createMutateAsync.mockResolvedValue({ id: 'new-item-1' });
    updateMutateAsync.mockResolvedValue({ id: 'item-1' });

    mockUseAllItems.mockReturnValue({
      data: [
        {
          id: 'item-1',
          name: 'Chicken Breast',
          short_name: null,
          default_qty: '1 lb',
          default_category_id: 'cat-1',
          alternate_qtys: [],
          aliases: ['Tenders'],
          created_at: '2026-03-01T00:00:00.000Z',
          item_store_preferences: [],
          category: { name: 'Protein' },
        },
      ],
      isLoading: false,
      error: null,
    });

    mockUseCreateMasterItem.mockReturnValue({ mutateAsync: createMutateAsync });
    mockUseUpdateMasterItem.mockReturnValue({ mutateAsync: updateMutateAsync });
    mockUseWordAliases.mockReturnValue({
      data: new Map<string, string>([
        ['chk', 'chicken'],
        ['tndr', 'tenders'],
      ]),
    });
    mockUseMetadata.mockReturnValue({
      data: {
        stores: [{ id: 'store-1', name: 'Market', color_code: '#2563eb' }],
        categories: [{ id: 'cat-1', name: 'Protein' }],
      },
    });
    mockUseUndo.mockReturnValue({
      pushAction,
      undoLastAction: jest.fn(),
      redoLastAction: jest.fn(),
      canUndo: false,
      canRedo: false,
      undoStack: [],
      redoStack: [],
    });
    mockUseVocabulary.mockReturnValue({ data: undefined });
  });

  const renderScreen = () =>
    render(
      <SafeAreaProvider initialMetrics={safeAreaMetrics}>
        <ItemsScreen />
      </SafeAreaProvider>
    );

  it('renders existing alias chips, allows remove/add, saves aliases, and undo restores original aliases', async () => {
    renderScreen();

    fireEvent.press(screen.getByText('Chicken Breast — 1 lb'));
    expect(screen.getByText('Tenders')).toBeTruthy();

    fireEvent.press(screen.getAllByText('×')[0]);
    expect(screen.queryByText('Tenders')).toBeNull();

    fireEvent.press(screen.getByTestId('item-add-alias-trigger'));
    fireEvent.changeText(screen.getByTestId('item-new-alias-input'), 'Cutlets');
    fireEvent(screen.getByTestId('item-new-alias-input'), 'submitEditing');
    expect(screen.getByText('Cutlets')).toBeTruthy();

    fireEvent.press(screen.getByTestId('item-modal-save-btn'));
    await waitFor(() => {
      expect(updateMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'item-1',
          aliases: ['Cutlets'],
        })
      );
    });

    const action = pushAction.mock.calls[0][0];
    await action.undo();
    expect(updateMutateAsync).toHaveBeenLastCalledWith(
      expect.objectContaining({
        id: 'item-1',
        aliases: ['Tenders'],
      })
    );
  });

  it('new item modal starts with empty aliases and only add alias action', () => {
    renderScreen();

    fireEvent.press(screen.getByTestId('open-new-item-modal-btn'));
    expect(screen.getByTestId('item-add-alias-trigger')).toBeTruthy();
    expect(screen.queryByText('Tenders')).toBeNull();
    expect(screen.queryByText('Active Abbreviations')).toBeNull();
    expect(screen.queryByText('Define Abbreviations')).toBeNull();
  });

  it('shows Active Abbreviations rows including words from item aliases and empty state when none', () => {
    renderScreen();

    fireEvent.press(screen.getByText('Chicken Breast — 1 lb'));
    expect(screen.getByText('chicken → chk')).toBeTruthy();
    expect(screen.getByText('tenders → tndr')).toBeTruthy();

    fireEvent.press(screen.getAllByText('×')[0]);
    expect(screen.queryByText('tenders → tndr')).toBeNull();
  });

  it('opens Define Abbreviations with initial search words from item name and aliases', () => {
    renderScreen();

    fireEvent.press(screen.getByText('Chicken Breast — 1 lb'));
    fireEvent.press(screen.getByTestId('define-abbreviations-button'));

    expect(screen.getByText('Abbrev Modal: chicken breast tenders')).toBeTruthy();
  });
});
