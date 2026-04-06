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

describe('ItemsScreen F85 parsed quantity payloads', () => {
  const createMutateAsync = jest.fn();
  const updateMutateAsync = jest.fn();
  const pushAction = jest.fn();

  const item = {
    id: 'item-1',
    name: 'Peanut Butter',
    short_name: 'PB',
    default_qty: '16oz',
    default_category_id: 'cat-1',
    alternate_qtys: ['1 lb', 'blah'],
    item_store_preferences: [],
    category: { name: 'Pantry' },
    created_at: '2026-03-01T00:00:00.000Z',
  };

  beforeEach(() => {
    jest.clearAllMocks();

    createMutateAsync.mockResolvedValue({ id: 'new-item-1' });
    updateMutateAsync.mockResolvedValue({ id: 'item-1' });

    mockUseAllItems.mockReturnValue({ data: [item], isLoading: false, error: null });
    mockUseCreateMasterItem.mockReturnValue({ mutateAsync: createMutateAsync });
    mockUseUpdateMasterItem.mockReturnValue({ mutateAsync: updateMutateAsync });
    mockUseWordAliases.mockReturnValue({ data: new Map<string, string>() });
    mockUseMetadata.mockReturnValue({
      data: {
        stores: [{ id: 'store-1', name: 'Market', color_code: '#2563eb' }],
        categories: [{ id: 'cat-1', name: 'Pantry' }],
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

  it('passes default_qty_parsed to createItem on save', async () => {
    renderScreen();

    fireEvent.press(screen.getByTestId('open-new-item-modal-btn'));
    fireEvent.changeText(screen.getByPlaceholderText('e.g. Milk'), 'Broth');
    fireEvent.changeText(screen.getByPlaceholderText('e.g. 1 gal'), '2 cans');
    fireEvent.press(screen.getByTestId('item-modal-save-btn'));

    await waitFor(() => {
      expect(createMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          default_qty_parsed: {
            count: 2,
            packageType: 'can',
            packagePlural: 'cans',
            sizeQty: null,
            sizeUnit: null,
            sizeDescriptive: null,
          },
        })
      );
    });
  });

  it('normalizes default_qty to formatQuantity output when parsed', async () => {
    renderScreen();

    fireEvent.press(screen.getByTestId('open-new-item-modal-btn'));
    fireEvent.changeText(screen.getByPlaceholderText('e.g. Milk'), 'Broth');
    fireEvent.changeText(screen.getByPlaceholderText('e.g. 1 gal'), '2 Cans');
    fireEvent.press(screen.getByTestId('item-modal-save-btn'));

    await waitFor(() => {
      expect(createMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          default_qty: '2 cans',
        })
      );
    });
  });

  it('passes null default_qty_parsed when qty is blank', async () => {
    renderScreen();

    fireEvent.press(screen.getByTestId('open-new-item-modal-btn'));
    fireEvent.changeText(screen.getByPlaceholderText('e.g. Milk'), 'Broth');
    fireEvent.changeText(screen.getByPlaceholderText('e.g. 1 gal'), '');
    fireEvent.press(screen.getByTestId('item-modal-save-btn'));

    await waitFor(() => {
      expect(createMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          default_qty_parsed: null,
        })
      );
    });
  });

  it('passes raw default_qty text when unparseable', async () => {
    renderScreen();

    fireEvent.press(screen.getByTestId('open-new-item-modal-btn'));
    fireEvent.changeText(screen.getByPlaceholderText('e.g. Milk'), 'Broth');
    fireEvent.changeText(screen.getByPlaceholderText('e.g. 1 gal'), 'a lot');
    fireEvent.press(screen.getByTestId('item-modal-save-btn'));

    await waitFor(() => {
      expect(createMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          default_qty: 'a lot',
          default_qty_parsed: null,
        })
      );
    });
  });

  it('passes index-aligned alternate_qtys_parsed', async () => {
    renderScreen();

    fireEvent.press(screen.getByTestId('open-new-item-modal-btn'));
    fireEvent.changeText(screen.getByPlaceholderText('e.g. Milk'), 'Broth');
    fireEvent.changeText(screen.getByPlaceholderText('e.g. 1/2 gal, 2 gal'), '1 lb, 2 cans');
    fireEvent.press(screen.getByTestId('item-modal-save-btn'));

    await waitFor(() => {
      expect(createMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          alternate_qtys_parsed: [
            {
              count: null,
              packageType: null,
              packagePlural: null,
              sizeQty: 1,
              sizeUnit: 'lb',
              sizeDescriptive: null,
            },
            {
              count: 2,
              packageType: 'can',
              packagePlural: 'cans',
              sizeQty: null,
              sizeUnit: null,
              sizeDescriptive: null,
            },
          ],
        })
      );
    });
  });

  it('normalizes parseable alternate_qtys entries', async () => {
    renderScreen();

    fireEvent.press(screen.getByTestId('open-new-item-modal-btn'));
    fireEvent.changeText(screen.getByPlaceholderText('e.g. Milk'), 'Broth');
    fireEvent.changeText(screen.getByPlaceholderText('e.g. 1/2 gal, 2 gal'), '2 Cans, 1 lb');
    fireEvent.press(screen.getByTestId('item-modal-save-btn'));

    await waitFor(() => {
      expect(createMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          alternate_qtys: ['2 cans', '1lb'],
        })
      );
    });
  });

  it('passes null element for unparseable alt qty', async () => {
    renderScreen();

    fireEvent.press(screen.getByTestId('open-new-item-modal-btn'));
    fireEvent.changeText(screen.getByPlaceholderText('e.g. Milk'), 'Broth');
    fireEvent.changeText(screen.getByPlaceholderText('e.g. 1/2 gal, 2 gal'), '1 lb, blah');
    fireEvent.press(screen.getByTestId('item-modal-save-btn'));

    await waitFor(() => {
      expect(createMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          alternate_qtys_parsed: [
            expect.objectContaining({ sizeQty: 1, sizeUnit: 'lb' }),
            null,
          ],
        })
      );
    });
  });

  it('passes raw text for unparseable alternate_qty element', async () => {
    renderScreen();

    fireEvent.press(screen.getByTestId('open-new-item-modal-btn'));
    fireEvent.changeText(screen.getByPlaceholderText('e.g. Milk'), 'Broth');
    fireEvent.changeText(screen.getByPlaceholderText('e.g. 1/2 gal, 2 gal'), '1 lb, blah');
    fireEvent.press(screen.getByTestId('item-modal-save-btn'));

    await waitFor(() => {
      expect(createMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          alternate_qtys: ['1lb', 'blah'],
        })
      );
    });
  });

  it('passes default_qty_parsed to updateItem on edit save', async () => {
    renderScreen();

    fireEvent.press(screen.getByText('Peanut Butter — 16oz'));
    fireEvent.changeText(screen.getByDisplayValue('16oz'), '2 cans');
    fireEvent.press(screen.getByTestId('item-modal-save-btn'));

    await waitFor(() => {
      expect(updateMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'item-1',
          default_qty_parsed: {
            count: 2,
            packageType: 'can',
            packagePlural: 'cans',
            sizeQty: null,
            sizeUnit: null,
            sizeDescriptive: null,
          },
        })
      );
    });
  });

  it('restores parsed snapshot values in undo action', async () => {
    renderScreen();

    fireEvent.press(screen.getByText('Peanut Butter — 16oz'));
    fireEvent.changeText(screen.getByDisplayValue('16oz'), '2 cans');
    fireEvent.press(screen.getByTestId('item-modal-save-btn'));

    await waitFor(() => {
      expect(pushAction).toHaveBeenCalled();
    });

    const action = pushAction.mock.calls[0][0];
    await action.undo();

    expect(updateMutateAsync).toHaveBeenLastCalledWith(
      expect.objectContaining({
        id: 'item-1',
        default_qty_parsed: {
          count: null,
          packageType: null,
          packagePlural: null,
          sizeQty: 16,
          sizeUnit: 'oz',
          sizeDescriptive: null,
        },
        alternate_qtys_parsed: [
          {
            count: null,
            packageType: null,
            packagePlural: null,
            sizeQty: 1,
            sizeUnit: 'lb',
            sizeDescriptive: null,
          },
          null,
        ],
      })
    );
  });
});
