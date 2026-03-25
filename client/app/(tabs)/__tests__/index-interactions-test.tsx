import React from 'react';
import { act, render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import ShoppingListScreen from '../index';
import { useShoppingList, useTogglePurchased, useUpdateListItem, useAddToList, useDeleteListItem, useEndTrip, useRevertArchival } from '@/api/list';
import { useItemById } from '@/api/items';
import { useUndo } from '@/api/undoContext';
import { useMetadata } from '@/api/metadata';
import { useHouseholdMembers } from '@/api/profile';
import { useHousehold } from '@/lib/household';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { UndoProvider } from '@/api/undoContext';
import { HouseholdProvider } from '@/lib/household';
import { SafeAreaProvider } from 'react-native-safe-area-context';

// Mock all the hooks
jest.mock('@/api/list');
jest.mock('@/api/items', () => {
  const actual = jest.requireActual('@/api/items');
  return {
    ...actual,
    useItemById: jest.fn(),
  };
});
jest.mock('@/api/undoContext', () => {
  const original = jest.requireActual('@/api/undoContext');
  return {
    ...original,
    useUndo: jest.fn(),
  };
});
jest.mock('@/api/metadata');
jest.mock('@/api/profile');
jest.mock('@/lib/household', () => ({
  HouseholdProvider: ({ children }: { children: React.ReactNode }) => children,
  useHousehold: jest.fn(),
}));
jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: jest.fn().mockResolvedValue({ data: { session: null } }),
      signOut: jest.fn(),
    },
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn().mockReturnThis(),
  },
}));

const mockUseShoppingList = useShoppingList as jest.Mock;
const mockUseTogglePurchased = useTogglePurchased as jest.Mock;
const mockUseUpdateListItem = useUpdateListItem as jest.Mock;
const mockUseAddToList = useAddToList as jest.Mock;
const mockUseDeleteListItem = useDeleteListItem as jest.Mock;
const mockUseEndTrip = useEndTrip as jest.Mock;
const mockUseRevertArchival = useRevertArchival as jest.Mock;
const mockUseItemById = useItemById as jest.Mock;
const mockUseUndo = useUndo as jest.Mock;
const mockUseMetadata = useMetadata as jest.Mock;
const mockUseHouseholdMembers = useHouseholdMembers as jest.Mock;
const mockUseHousehold = useHousehold as jest.Mock;

const safeAreaMetrics = { insets: { top: 44, bottom: 34, left: 0, right: 0 }, frame: { x: 0, y: 0, width: 390, height: 844 } };

describe('ShoppingListScreen Interactions', () => {
  let queryClient: QueryClient;

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <SafeAreaProvider initialMetrics={safeAreaMetrics}>
      <QueryClientProvider client={queryClient}>
        <UndoProvider>
          <HouseholdProvider>{children}</HouseholdProvider>
        </UndoProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );

  const mockItems = [
    {
      id: '1',
      name: 'Milk',
      quantity: '1L',
      is_purchased: false,
      store_id: 'store1',
      store: { name: 'Grocery Store' },
      category: { name: 'Dairy' },
    },
  ];

  const mockMutateAsync = jest.fn();

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: Infinity } },
    });
    jest.clearAllMocks();
    mockUseShoppingList.mockReturnValue({ data: mockItems, isLoading: false });
    mockUseTogglePurchased.mockReturnValue({ mutateAsync: mockMutateAsync });
    mockUseUpdateListItem.mockReturnValue({ mutateAsync: jest.fn() });
    mockUseAddToList.mockReturnValue({ mutateAsync: jest.fn() });
    mockUseDeleteListItem.mockReturnValue({ mutateAsync: jest.fn() });
    mockUseEndTrip.mockReturnValue({ mutateAsync: jest.fn() });
    mockUseRevertArchival.mockReturnValue({ mutateAsync: jest.fn() });
    mockUseItemById.mockReturnValue({ data: null });
    mockUseUndo.mockReturnValue({
      undoLastAction: jest.fn(),
      redoLastAction: jest.fn(),
      pushAction: jest.fn(),
      canUndo: false,
      canRedo: false,
      undoStack: [],
      redoStack: [],
    });
    mockUseMetadata.mockReturnValue({ data: { stores: [], categories: [] } });
    mockUseHouseholdMembers.mockReturnValue({ data: [] });
    mockUseHousehold.mockReturnValue({
      displayName: 'Alice',
      displayNameShort: 'Al',
      avatarColor: '#2563eb',
      householdId: 'h1',
      isLoading: false,
    });
  });

  afterEach(() => {
    queryClient.clear();
  });

  it('defaults to shopping mode on mount', () => {
    render(<ShoppingListScreen />, { wrapper });
    expect(screen.getByTestId('cart-icon-container')).toBeTruthy();
    expect(screen.queryByTestId('pencil-icon')).toBeNull();
  });

  it('mode toggle switches from shopping to planning', () => {
    render(<ShoppingListScreen />, { wrapper });
    fireEvent.press(screen.getByTestId('mode-toggle'));
    expect(screen.getByTestId('pencil-icon-toggle-container')).toBeTruthy();
    expect(screen.queryByTestId('pencil-icon')).toBeNull();
  });

  it('shopping mode: single tap on item row calls togglePurchased', () => {
    render(<ShoppingListScreen />, { wrapper });
    fireEvent.press(screen.getByTestId('item-pressable-1'));
    expect(mockMutateAsync).toHaveBeenCalledWith(expect.objectContaining({ id: '1', is_purchased: true }));
  });

  it('undo of uncheck restores original purchased_by', async () => {
    const itemWithPurchasedBy = { ...mockItems[0], is_purchased: true, purchased_by: 'user-B' };
    mockUseShoppingList.mockReturnValue({ data: [itemWithPurchasedBy], isLoading: false });
    const mockPushAction = jest.fn();
    mockUseUndo.mockReturnValue({
      undoLastAction: jest.fn(),
      redoLastAction: jest.fn(),
      pushAction: mockPushAction,
      canUndo: false,
      canRedo: false,
      undoStack: [],
      redoStack: [],
    });

    render(<ShoppingListScreen />, { wrapper });
    fireEvent.press(screen.getByTestId('item-pressable-1')); // uncheck (newStatus=false)

    await waitFor(() => expect(mockPushAction).toHaveBeenCalledTimes(1));
    const { undo } = mockPushAction.mock.calls[0][0];
    await undo();

    // Undo of an uncheck should re-check with the original purchaser, not the current user
    expect(mockMutateAsync).toHaveBeenLastCalledWith(
      expect.objectContaining({ id: '1', is_purchased: true, purchased_by_override: 'user-B' })
    );
  });

  it('shopping mode: long press on item row opens edit modal', () => {
    render(<ShoppingListScreen />, { wrapper });
    fireEvent(screen.getByTestId('item-pressable-1'), 'onLongPress');
    expect(screen.getByText('Edit Item')).toBeTruthy();
  });

  it('planning mode: tap on item name opens edit modal', () => {
    render(<ShoppingListScreen />, { wrapper });
    fireEvent.press(screen.getByTestId('mode-toggle')); // Switch to planning
    fireEvent.press(screen.getByTestId('name-1'));
    expect(screen.getByText('Edit Item')).toBeTruthy();
  });

  it('planning mode: checkbox tap calls togglePurchased', () => {
    render(<ShoppingListScreen />, { wrapper });
    fireEvent.press(screen.getByTestId('mode-toggle')); // Switch to planning
    fireEvent.press(screen.getByTestId('checkbox-1'));
    expect(mockMutateAsync).toHaveBeenCalledWith(expect.objectContaining({ id: '1', is_purchased: true }));
  });

  it('shows usual quantity chips for master-backed items and chip tap updates edit quantity', async () => {
    jest.useFakeTimers();
    mockUseShoppingList.mockReturnValue({
      data: [
        {
          id: '1',
          item_id: 'master-1',
          name: 'Milk',
          quantity: '1L',
          is_purchased: false,
          store_id: 'store1',
          store: { name: 'Grocery Store' },
          category: { name: 'Dairy' },
          master_item: { short_name: null, default_qty: '1 gal', alternate_qtys: ['2 gal'] },
        },
      ],
      isLoading: false,
    });

    render(<ShoppingListScreen />, { wrapper });
    fireEvent(screen.getByTestId('item-pressable-1'), 'onLongPress');

    expect(await screen.findByText('Usual Quantities')).toBeTruthy();
    expect(screen.getByText('1 gal')).toBeTruthy();
    expect(screen.getByText('2 gal')).toBeTruthy();

    fireEvent.press(screen.getByText('2 gal'));
    expect(screen.getByDisplayValue('2 gal')).toBeTruthy();

    act(() => {
      jest.runOnlyPendingTimers();
    });
    jest.useRealTimers();
  });

  it('does not show usual quantity chips for one-off list items', async () => {
    mockUseShoppingList.mockReturnValue({
      data: [
        {
          id: '1',
          item_id: null,
          name: 'One-off Milk',
          quantity: '1',
          is_purchased: false,
          store_id: 'store1',
          store: { name: 'Grocery Store' },
          category: { name: 'Dairy' },
          master_item: null,
        },
      ],
      isLoading: false,
    });

    render(<ShoppingListScreen />, { wrapper });
    fireEvent(screen.getByTestId('item-pressable-1'), 'onLongPress');

    await waitFor(() => {
      expect(screen.getByText('Edit Item')).toBeTruthy();
    });
    expect(screen.queryByText('Usual Quantities')).toBeNull();
  });

  it('shows warning callout in List Edit modal for master-linked item warnings', async () => {
    mockUseShoppingList.mockReturnValue({
      data: [
        {
          id: '1',
          item_id: 'master-1',
          name: 'Milk',
          quantity: '1L',
          is_purchased: false,
          store_id: 'store1',
          store: { name: 'Grocery Store' },
          category: { name: 'Dairy' },
          master_item: { short_name: null, default_qty: '1L', alternate_qtys: ['2L'] },
        },
      ],
      isLoading: false,
    });
    mockUseItemById.mockReturnValue({
      data: {
        id: 'master-1',
        default_qty: '1L',
        alternate_qtys: ['2L'],
        item_store_preferences: [
          {
            store_id: 'store1',
            status: 'avoided',
            comment: null,
            store: { id: 'store1', name: 'Grocery Store', color_code: '#2563eb' },
          },
        ],
      },
    });

    render(<ShoppingListScreen />, { wrapper });
    fireEvent(screen.getByTestId('item-pressable-1'), 'onLongPress');

    expect(await screen.findByText('Avoided at Grocery Store')).toBeTruthy();
  });

  it('does not show warning callout in List Edit modal for one-off list items', async () => {
    mockUseShoppingList.mockReturnValue({
      data: [
        {
          id: '1',
          item_id: null,
          name: 'One-off Milk',
          quantity: '1',
          is_purchased: false,
          store_id: 'store1',
          store: { name: 'Grocery Store' },
          category: { name: 'Dairy' },
          master_item: null,
        },
      ],
      isLoading: false,
    });

    render(<ShoppingListScreen />, { wrapper });
    fireEvent(screen.getByTestId('item-pressable-1'), 'onLongPress');

    await waitFor(() => {
      expect(screen.getByText('Edit Item')).toBeTruthy();
    });
    expect(screen.queryByTestId('warning-callout')).toBeNull();
  });

  it('renders store dropdown trigger in the Edit Item modal', async () => {
    mockUseMetadata.mockReturnValue({
      data: {
        stores: [
          { id: 'store1', name: 'Grocery Store', color_code: '#2563eb' },
          { id: 'store2', name: 'Farm Stand', color_code: '#16a34a' },
        ],
        categories: [],
      },
    });

    render(<ShoppingListScreen />, { wrapper });
    fireEvent(screen.getByTestId('item-pressable-1'), 'onLongPress');

    expect(await screen.findByTestId('edit-store-dropdown-trigger')).toBeTruthy();
  });

  it('opens store dropdown and shows all store options', async () => {
    mockUseMetadata.mockReturnValue({
      data: {
        stores: [
          { id: 'store1', name: 'Grocery Store', color_code: '#2563eb' },
          { id: 'store2', name: 'Farm Stand', color_code: '#16a34a' },
        ],
        categories: [],
      },
    });

    render(<ShoppingListScreen />, { wrapper });
    fireEvent(screen.getByTestId('item-pressable-1'), 'onLongPress');
    fireEvent.press(await screen.findByTestId('edit-store-dropdown-trigger'));

    expect(screen.getByTestId('edit-store-option-none')).toBeTruthy();
    expect(screen.getByTestId('edit-store-store1')).toBeTruthy();
    expect(screen.getByTestId('edit-store-store2')).toBeTruthy();
  });

  it('selects a store and closes the dropdown', async () => {
    mockUseMetadata.mockReturnValue({
      data: {
        stores: [
          { id: 'store1', name: 'Grocery Store', color_code: '#2563eb' },
          { id: 'store2', name: 'Farm Stand', color_code: '#16a34a' },
        ],
        categories: [],
      },
    });

    render(<ShoppingListScreen />, { wrapper });
    fireEvent(screen.getByTestId('item-pressable-1'), 'onLongPress');
    fireEvent.press(await screen.findByTestId('edit-store-dropdown-trigger'));
    fireEvent.press(screen.getByTestId('edit-store-store2'));

    await waitFor(() => {
      expect(screen.queryByTestId('edit-store-option-none')).toBeNull();
    });
    expect(screen.getByText('Farm Stand')).toBeTruthy();
  });

  it('clears store selection via No store option', async () => {
    mockUseMetadata.mockReturnValue({
      data: {
        stores: [
          { id: 'store1', name: 'Grocery Store', color_code: '#2563eb' },
          { id: 'store2', name: 'Farm Stand', color_code: '#16a34a' },
        ],
        categories: [],
      },
    });

    render(<ShoppingListScreen />, { wrapper });
    fireEvent(screen.getByTestId('item-pressable-1'), 'onLongPress');
    fireEvent.press(await screen.findByTestId('edit-store-dropdown-trigger'));
    fireEvent.press(screen.getByTestId('edit-store-option-none'));

    await waitFor(() => {
      expect(screen.queryByTestId('edit-store-option-none')).toBeNull();
    });
    expect(screen.getByText('No store')).toBeTruthy();
  });
});
