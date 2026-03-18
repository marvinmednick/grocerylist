import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import ItemsScreen from '../items';
import { useAllItems, useCreateMasterItem, useUpdateMasterItem } from '@/api/items';
import { useMetadata } from '@/api/metadata';
import { useUndo } from '@/api/undoContext';

jest.mock('@/api/items');
jest.mock('@/api/metadata');
jest.mock('@/api/undoContext');
jest.mock('@/components/UserAvatar', () => ({
  UserAvatar: () => {
    const { Text } = require('react-native');
    return <Text>Avatar Stub</Text>;
  },
}));

const mockUseAllItems = useAllItems as jest.Mock;
const mockUseCreateMasterItem = useCreateMasterItem as jest.Mock;
const mockUseUpdateMasterItem = useUpdateMasterItem as jest.Mock;
const mockUseMetadata = useMetadata as jest.Mock;
const mockUseUndo = useUndo as jest.Mock;

const safeAreaMetrics = {
  insets: { top: 44, bottom: 34, left: 0, right: 0 },
  frame: { x: 0, y: 0, width: 390, height: 844 },
};

describe('ItemsScreen', () => {
  const createMutateAsync = jest.fn();
  const updateMutateAsync = jest.fn();
  const pushAction = jest.fn();

  beforeEach(() => {
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
          item_store_preferences: [
            {
              store_id: 'store-2',
              status: 'preferred',
              comment: null,
              store: { id: 'store-2', name: 'Alt Market' },
            },
          ],
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
      pushAction,
      undoLastAction: jest.fn(),
      redoLastAction: jest.fn(),
      canUndo: false,
      canRedo: false,
      undoStack: [],
      redoStack: [],
    });
  });

  const renderScreen = () =>
    render(
      <SafeAreaProvider initialMetrics={safeAreaMetrics}>
        <ItemsScreen />
      </SafeAreaProvider>
    );

  it('renders status selector for each store in edit modal', () => {
    renderScreen();

    fireEvent.press(screen.getByText('Peanut Butter - 16oz'));

    expect(screen.getByTestId('store-pref-store-1-neutral')).toBeTruthy();
    expect(screen.getByTestId('store-pref-store-1-preferred')).toBeTruthy();
    expect(screen.getByTestId('store-pref-store-2-neutral')).toBeTruthy();
    expect(screen.getByTestId('store-pref-store-2-preferred')).toBeTruthy();
  });

  it('sets preference to preferred when tapped', async () => {
    renderScreen();

    fireEvent.press(screen.getByText('Peanut Butter - 16oz'));
    fireEvent.press(screen.getByTestId('store-pref-store-1-preferred'));
    fireEvent.press(screen.getByText('Save'));

    await waitFor(() => {
      expect(updateMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'item-1',
          store_preferences: expect.arrayContaining([
            expect.objectContaining({ store_id: 'store-1', status: 'preferred' }),
          ]),
        })
      );
    });
  });

  it('shows comment field when non-neutral status selected', () => {
    renderScreen();

    fireEvent.press(screen.getByText('Peanut Butter - 16oz'));
    fireEvent.press(screen.getByTestId('store-pref-store-1-avoided'));

    expect(screen.getByTestId('store-pref-comment-store-1')).toBeTruthy();
  });

  it('registers undo action on item save', async () => {
    renderScreen();

    fireEvent.press(screen.getByText('Peanut Butter - 16oz'));
    fireEvent.changeText(screen.getByDisplayValue('Peanut Butter'), 'Peanut Butter Crunchy');
    fireEvent.press(screen.getByText('Save'));

    await waitFor(() => {
      expect(pushAction).toHaveBeenCalledWith(
        expect.objectContaining({
          label: expect.stringContaining('Edited'),
        })
      );
    });
  });

  it('renders Short Name input in edit modal', () => {
    renderScreen();

    fireEvent.press(screen.getByText('Peanut Butter - 16oz'));

    expect(screen.getByText('Short Name (optional)')).toBeTruthy();
    expect(screen.getByDisplayValue('PB')).toBeTruthy();
  });

  it('populates short_name from item data when editing', () => {
    renderScreen();

    fireEvent.press(screen.getByText('Peanut Butter - 16oz'));

    expect(screen.getByDisplayValue('PB')).toBeTruthy();
  });

  it('sends short_name in update payload', async () => {
    renderScreen();

    fireEvent.press(screen.getByText('Peanut Butter - 16oz'));
    fireEvent.changeText(screen.getByDisplayValue('PB'), 'PButter');
    fireEvent.press(screen.getByText('Save'));

    await waitFor(() => {
      expect(updateMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'item-1',
          short_name: 'PButter',
        })
      );
    });
  });
});
