import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StoreSelector } from '../StoreSelector';
import {
  useCreateStore,
  useDeleteStore,
  useMetadata,
  useStoreCascadeInfo,
  useUpdateStore,
} from '@/api/metadata';
import { useUndo } from '@/api/undoContext';

jest.mock('@/api/metadata');
jest.mock('@/api/undoContext');

describe('StoreSelector', () => {
  const mockUseMetadata = useMetadata as jest.Mock;
  const mockUseCreateStore = useCreateStore as jest.Mock;
  const mockUseUpdateStore = useUpdateStore as jest.Mock;
  const mockUseDeleteStore = useDeleteStore as jest.Mock;
  const mockUseStoreCascadeInfo = useStoreCascadeInfo as jest.Mock;
  const mockUseUndo = useUndo as jest.Mock;

  const createStore = jest.fn();
  const updateStore = jest.fn();
  const deleteStore = jest.fn();
  const pushAction = jest.fn();

  const stores = [
    { id: 'store-1', name: 'Market', color_code: '#2563eb' },
    { id: 'store-2', name: 'Alt Market', color_code: '#16a34a' },
  ];
  const safeAreaMetrics = {
    insets: { top: 44, bottom: 34, left: 0, right: 0 },
    frame: { x: 0, y: 0, width: 390, height: 844 },
  };

  beforeEach(() => {
    jest.clearAllMocks();

    createStore.mockResolvedValue({ id: 'store-3', name: 'New Store' });
    updateStore.mockResolvedValue({ id: 'store-1' });
    deleteStore.mockResolvedValue({});

    mockUseMetadata.mockReturnValue({
      data: {
        stores,
        categories: [],
      },
    });

    mockUseCreateStore.mockReturnValue({ mutateAsync: createStore });
    mockUseUpdateStore.mockReturnValue({ mutateAsync: updateStore });
    mockUseDeleteStore.mockReturnValue({ mutateAsync: deleteStore });
    mockUseStoreCascadeInfo.mockImplementation((storeId: string | null) => ({
      data: storeId
        ? {
            itemPrefsCount: 4,
            activeListItemsCount: 1,
          }
        : undefined,
    }));
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

  const renderSelector = (activeStoreId = 'store-1', onStoreChange = jest.fn()) =>
    render(
      <SafeAreaProvider initialMetrics={safeAreaMetrics}>
        <StoreSelector activeStoreId={activeStoreId} onStoreChange={onStoreChange} />
      </SafeAreaProvider>
    );

  it('renders the active store name', () => {
    renderSelector();

    expect(screen.getByText('Market')).toBeTruthy();
  });

  it('shows dropdown chevron', () => {
    renderSelector();

    expect(screen.getByText(' ▾')).toBeTruthy();
  });

  it('opens dropdown on press', () => {
    renderSelector();

    fireEvent.press(screen.getByTestId('store-selector-trigger'));

    expect(screen.getByText('Alt Market')).toBeTruthy();
  });

  it('shows checkmark on active store', () => {
    renderSelector();

    fireEvent.press(screen.getByTestId('store-selector-trigger'));

    expect(screen.getByTestId('active-store-check-store-1')).toBeTruthy();
  });

  it('calls onStoreChange when a store is selected', () => {
    const onStoreChange = jest.fn();
    renderSelector('store-1', onStoreChange);

    fireEvent.press(screen.getByTestId('store-selector-trigger'));
    fireEvent.press(screen.getByText('Alt Market'));

    expect(onStoreChange).toHaveBeenCalledWith('store-2');
  });

  it('shows Add new store option', () => {
    renderSelector();

    fireEvent.press(screen.getByTestId('store-selector-trigger'));

    expect(screen.getByText('+ Add new store')).toBeTruthy();
  });

  it('opens creation modal when Add new store tapped', () => {
    renderSelector();

    fireEvent.press(screen.getByTestId('store-selector-trigger'));
    fireEvent.press(screen.getByText('+ Add new store'));

    expect(screen.getByTestId('new-store-name-input')).toBeTruthy();
  });

  it('calls useCreateStore with name and color', async () => {
    const onStoreChange = jest.fn();
    renderSelector('store-1', onStoreChange);

    fireEvent.press(screen.getByTestId('store-selector-trigger'));
    fireEvent.press(screen.getByText('+ Add new store'));

    fireEvent.changeText(screen.getByTestId('new-store-name-input'), 'Corner Shop');
    fireEvent.press(screen.getByTestId('store-color-#16a34a'));
    fireEvent.press(screen.getByText('Add'));

    await waitFor(() => {
      expect(createStore).toHaveBeenCalledWith({
        name: 'Corner Shop',
        color_code: '#16a34a',
      });
    });

    expect(onStoreChange).toHaveBeenCalledWith('store-3');
  });

  it('renders edit buttons for each store row', () => {
    renderSelector();

    fireEvent.press(screen.getByTestId('store-selector-trigger'));

    expect(screen.getByTestId('edit-store-btn-store-1')).toBeTruthy();
    expect(screen.getByTestId('edit-store-btn-store-2')).toBeTruthy();
  });

  it('opens edit modal with prefilled name and closes dropdown', () => {
    renderSelector();

    fireEvent.press(screen.getByTestId('store-selector-trigger'));
    fireEvent.press(screen.getByTestId('edit-store-btn-store-2'));

    expect(screen.getByDisplayValue('Alt Market')).toBeTruthy();
    expect(screen.queryByText('+ Add new store')).toBeNull();
  });

  it('updates store and registers undo action', async () => {
    renderSelector();

    fireEvent.press(screen.getByTestId('store-selector-trigger'));
    fireEvent.press(screen.getByTestId('edit-store-btn-store-2'));
    fireEvent.changeText(screen.getByTestId('edit-store-name-input'), 'Neighborhood Market');
    fireEvent.press(screen.getByText('Save'));

    await waitFor(() => {
      expect(updateStore).toHaveBeenCalledWith({
        id: 'store-2',
        name: 'Neighborhood Market',
        color_code: '#16a34a',
      });
    });

    expect(pushAction).toHaveBeenCalledWith(
      expect.objectContaining({
        label: 'Renamed store to Neighborhood Market',
      })
    );
    await waitFor(() => {
      expect(screen.queryByTestId('edit-store-name-input')).toBeNull();
    });
  });

  it('shows delete confirm with cascade counts and supports cancel/delete', async () => {
    renderSelector();

    fireEvent.press(screen.getByTestId('store-selector-trigger'));
    fireEvent.press(screen.getByTestId('edit-store-btn-store-2'));

    fireEvent.press(screen.getByTestId('edit-store-trash-btn'));
    expect(
      screen.getByText(
        'Deleting Alt Market will remove preferences for 4 item(s) and unassign 1 active list item(s). This cannot be undone.'
      )
    ).toBeTruthy();

    fireEvent.press(screen.getByText('Cancel delete'));
    expect(screen.queryByText('Delete')).toBeNull();

    fireEvent.press(screen.getByTestId('edit-store-trash-btn'));
    fireEvent.press(screen.getByText('Delete'));

    await waitFor(() => {
      expect(deleteStore).toHaveBeenCalledWith('store-2');
    });

    expect(screen.queryByTestId('edit-store-name-input')).toBeNull();
  });

  it('switches active store to first remaining when deleting current active store', async () => {
    const onStoreChange = jest.fn();

    renderSelector('store-1', onStoreChange);

    fireEvent.press(screen.getByTestId('store-selector-trigger'));
    fireEvent.press(screen.getByTestId('edit-store-btn-store-1'));
    fireEvent.press(screen.getByTestId('edit-store-trash-btn'));
    fireEvent.press(screen.getByText('Delete'));

    await waitFor(() => {
      expect(onStoreChange).toHaveBeenCalledWith('store-2');
    });
  });

  it('clears active store when deleting the only store', async () => {
    const onStoreChange = jest.fn();

    mockUseMetadata.mockReturnValue({
      data: {
        stores: [{ id: 'store-1', name: 'Only Store', color_code: '#2563eb' }],
        categories: [],
      },
    });

    renderSelector('store-1', onStoreChange);

    fireEvent.press(screen.getByTestId('store-selector-trigger'));
    fireEvent.press(screen.getByTestId('edit-store-btn-store-1'));
    fireEvent.press(screen.getByTestId('edit-store-trash-btn'));
    fireEvent.press(screen.getByText('Delete'));

    await waitFor(() => {
      expect(onStoreChange).toHaveBeenCalledWith('');
    });
  });
});
