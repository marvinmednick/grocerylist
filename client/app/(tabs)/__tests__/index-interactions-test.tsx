import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import ShoppingListScreen from '../index';
import { useShoppingList, useTogglePurchased, useUpdateListItem, useAddToList, useDeleteListItem, useEndTrip, useRevertArchival } from '@/api/list';
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
    mockUseHousehold.mockReturnValue({ householdId: 'h1', isLoading: false });
  });

  afterEach(() => {
    queryClient.clear();
  });

  it('defaults to shopping mode on mount', () => {
    render(<ShoppingListScreen />, { wrapper });
    expect(screen.getByTestId('cart-icon-container')).toBeTruthy();
    expect(screen.getByTestId('pencil-icon')).toBeTruthy();
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
});
