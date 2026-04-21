import React from 'react';
import { Alert } from 'react-native';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import ShoppingListScreen from '../index';
import {
  useAddToList,
  useDeleteListItem,
  useEndTrip,
  useRevertArchival,
  useShoppingList,
  useTogglePurchased,
  useUpdateListItemFields,
  useUpdateQuantityEntry,
} from '@/api/list';
import { useUndo } from '@/api/undoContext';
import { useMetadata } from '@/api/metadata';
import { useHouseholdMembers } from '@/api/profile';
import { HouseholdProvider, useHousehold } from '@/lib/household';
import { UndoProvider } from '@/api/undoContext';
import { makeListItem, makeQuantityEntry } from '@/api/__tests__/_helpers/listItemMock';
import { loadActiveStoreId, saveActiveStoreId } from '@/lib/activeStore';

jest.mock('@/api/list');
jest.mock('@/api/metadata');
jest.mock('@/api/profile');
jest.mock('@/api/undoContext', () => {
  const actual = jest.requireActual('@/api/undoContext');
  return { ...actual, useUndo: jest.fn() };
});
jest.mock('@/lib/household', () => ({
  HouseholdProvider: ({ children }: { children: React.ReactNode }) => children,
  useHousehold: jest.fn(),
}));
jest.mock('@/lib/activeStore', () => ({
  loadActiveStoreId: jest.fn(),
  saveActiveStoreId: jest.fn(),
}));

const mockUseShoppingList = useShoppingList as jest.Mock;
const mockUseTogglePurchased = useTogglePurchased as jest.Mock;
const mockUseUpdateListItemFields = useUpdateListItemFields as jest.Mock;
const mockUseUpdateQuantityEntry = useUpdateQuantityEntry as jest.Mock;
const mockUseDeleteListItem = useDeleteListItem as jest.Mock;
const mockUseAddToList = useAddToList as jest.Mock;
const mockUseEndTrip = useEndTrip as jest.Mock;
const mockUseRevertArchival = useRevertArchival as jest.Mock;
const mockUseUndo = useUndo as jest.Mock;
const mockUseMetadata = useMetadata as jest.Mock;
const mockUseHouseholdMembers = useHouseholdMembers as jest.Mock;
const mockUseHousehold = useHousehold as jest.Mock;
const mockLoadActiveStoreId = loadActiveStoreId as jest.Mock;
const mockSaveActiveStoreId = saveActiveStoreId as jest.Mock;

const safeAreaMetrics = {
  insets: { top: 44, bottom: 34, left: 0, right: 0 },
  frame: { x: 0, y: 0, width: 390, height: 844 },
};

describe('ShoppingListScreen F103', () => {
  let queryClient: QueryClient;
  const togglePurchased = jest.fn();
  const updateListItemFields = jest.fn();
  const updateQuantityEntry = jest.fn();
  const deleteItem = jest.fn();
  const addItem = jest.fn();
  const endTrip = jest.fn();
  const revertArchival = jest.fn();
  const pushAction = jest.fn();

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <SafeAreaProvider initialMetrics={safeAreaMetrics}>
      <QueryClientProvider client={queryClient}>
        <UndoProvider>
          <HouseholdProvider>{children}</HouseholdProvider>
        </UndoProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );

  const buildParent = () =>
    makeListItem({
      id: 'parent-1',
      name: 'Milk',
      store_id: 'store-1',
      store: { name: 'Store One', color_code: '#000000' },
      category: { name: 'Dairy', sort_order: 1 },
      quantities: [
        makeQuantityEntry({ id: 'q1', list_item_id: 'parent-1', quantity: '1L', is_purchased: false }),
        makeQuantityEntry({ id: 'q2', list_item_id: 'parent-1', quantity: '2L', is_purchased: true, purchased_by: 'user-2' }),
      ],
    });

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: Infinity } },
    });
    jest.clearAllMocks();

    mockUseShoppingList.mockReturnValue({ data: [buildParent()], isLoading: false });
    mockUseTogglePurchased.mockReturnValue({ mutateAsync: togglePurchased });
    mockUseUpdateListItemFields.mockReturnValue({ mutateAsync: updateListItemFields });
    mockUseUpdateQuantityEntry.mockReturnValue({ mutateAsync: updateQuantityEntry });
    mockUseDeleteListItem.mockReturnValue({ mutateAsync: deleteItem });
    mockUseAddToList.mockReturnValue({ mutateAsync: addItem });
    mockUseEndTrip.mockReturnValue({ mutateAsync: endTrip });
    mockUseRevertArchival.mockReturnValue({ mutateAsync: revertArchival });
    mockUseUndo.mockReturnValue({
      undoLastAction: jest.fn(),
      redoLastAction: jest.fn(),
      pushAction,
      canUndo: false,
      canRedo: false,
      undoStack: [],
      redoStack: [],
    });
    mockUseMetadata.mockReturnValue({ data: { stores: [], categories: [] } });
    mockUseHouseholdMembers.mockReturnValue({
      data: [
        { id: 'user-1', display_name: 'Alice', display_name_short: 'AL', color: '#0ea5e9' },
        { id: 'user-2', display_name: 'Bob', display_name_short: 'BO', color: '#dc2626' },
      ],
    });
    mockUseHousehold.mockReturnValue({
      householdId: 'house-1',
      userId: 'user-1',
      avatarColor: '#0ea5e9',
      isLoading: false,
    });
    mockLoadActiveStoreId.mockResolvedValue(null);
    mockSaveActiveStoreId.mockResolvedValue(undefined);

    endTrip.mockResolvedValue({ trip: { id: 'trip-1' }, items: [] });
    deleteItem.mockResolvedValue({ entryId: 'q1', listItemId: 'parent-1', parentDeleted: true });
    addItem.mockResolvedValue({ parent: { id: 'parent-new' }, entry: { id: 'entry-new' } });
  });

  afterEach(() => {
    queryClient.clear();
  });

  it('renders one row per entry of each parent', () => {
    render(<ShoppingListScreen />, { wrapper });
    expect(screen.getByTestId('checkbox-q1')).toBeTruthy();
    expect(screen.getByTestId('checkbox-q2')).toBeTruthy();
    expect(screen.getAllByText('Milk').length).toBeGreaterThan(1);
  });

  it('clicking checkbox on entry q2 toggles q2 only', async () => {
    render(<ShoppingListScreen />, { wrapper });
    await act(async () => {
      fireEvent.press(screen.getByTestId('checkbox-q2'));
    });
    await waitFor(() => expect(togglePurchased).toHaveBeenCalledWith(expect.objectContaining({ id: 'q2' })));
    expect(togglePurchased).not.toHaveBeenCalledWith(expect.objectContaining({ id: 'q1' }));
  });

  it('editing name saves via useUpdateListItemFields; editing quantity saves via useUpdateQuantityEntry', async () => {
    render(<ShoppingListScreen />, { wrapper });

    fireEvent(screen.getByTestId('item-pressable-q1'), 'onLongPress');
    fireEvent.changeText(screen.getByDisplayValue('Milk'), 'Whole Milk');
    fireEvent.press(screen.getByText('Save'));
    await waitFor(() => expect(updateListItemFields).toHaveBeenCalled());
    expect(updateQuantityEntry).not.toHaveBeenCalled();

    updateListItemFields.mockClear();
    updateQuantityEntry.mockClear();
    fireEvent(screen.getByTestId('item-pressable-q1'), 'onLongPress');
    fireEvent.changeText(screen.getByDisplayValue('1L'), '3L');
    fireEvent.press(screen.getByText('Save'));
    await waitFor(() => expect(updateQuantityEntry).toHaveBeenCalledWith(expect.objectContaining({ id: 'q1', quantity: '3L' })));
    expect(updateQuantityEntry).toHaveBeenCalledWith({
      id: 'q1',
      quantity: '3L',
    });
    expect(updateListItemFields).not.toHaveBeenCalled();
  });

  it('editing both name and quantity pushes a single undo action covering both', async () => {
    render(<ShoppingListScreen />, { wrapper });

    fireEvent(screen.getByTestId('item-pressable-q1'), 'onLongPress');
    fireEvent.changeText(screen.getByDisplayValue('Milk'), 'Whole Milk');
    fireEvent.changeText(screen.getByDisplayValue('1L'), '3L');
    fireEvent.press(screen.getByText('Save'));

    await waitFor(() => expect(pushAction).toHaveBeenCalledTimes(1));
    const action = pushAction.mock.calls[0][0];
    await action.undo();
    expect(updateListItemFields.mock.invocationCallOrder[0]).toBeLessThan(updateQuantityEntry.mock.invocationCallOrder[0]);
  });

  it('deleting the only entry of a parent deletes both via useDeleteListItem', async () => {
    render(<ShoppingListScreen />, { wrapper });

    fireEvent(screen.getByTestId('item-pressable-q1'), 'onLongPress');
    await act(async () => {
      fireEvent.press(screen.getByTestId('modal-delete-button'));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    await waitFor(() => expect(deleteItem).toHaveBeenCalledWith({ entryId: 'q1' }));
    const action = pushAction.mock.calls[0][0];
    await act(async () => {
      await action.undo();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    await waitFor(() => expect(addItem).toHaveBeenCalled());
  });

  it('end-trip archives matching entries and archives parents via handleEndTrip', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons) => {
      const endTripButton = buttons?.find((button) => button.text === 'End Trip');
      void endTripButton?.onPress?.();
    });

    render(<ShoppingListScreen />, { wrapper });

    await act(async () => {
      fireEvent.press(screen.getByText('End Trip'));
    });
    await waitFor(() => {
      expect(endTrip).toHaveBeenCalledWith(expect.objectContaining({ store_id: 'store-1' }));
    });
    alertSpy.mockRestore();
  });
});
