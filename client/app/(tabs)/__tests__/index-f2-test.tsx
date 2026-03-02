import React from 'react';
import { Alert, Platform } from 'react-native';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import ShoppingListScreen from '../index';
import {
  useAddToList,
  useDeleteListItem,
  useEndTrip,
  useRevertArchival,
  useShoppingList,
  useTogglePurchased,
  useUpdateListItem,
} from '@/api/list';
import { useUndo } from '@/api/undoContext';
import { useMetadata } from '@/api/metadata';
import { useHousehold } from '@/lib/household';
import { useHouseholdMembers } from '@/api/profile';
import { CheckCircle2, Circle } from 'lucide-react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { UndoProvider } from '@/api/undoContext';
import { HouseholdProvider } from '@/lib/household';
import { SafeAreaProvider } from 'react-native-safe-area-context';

jest.mock('@/api/list');
jest.mock('@/api/profile');
jest.mock('@/api/undoContext', () => {
  const original = jest.requireActual('@/api/undoContext');
  return {
    ...original,
    useUndo: jest.fn(),
  };
});
jest.mock('@/api/metadata');
jest.mock('@/lib/household', () => ({
  HouseholdProvider: ({ children }: { children: React.ReactNode }) => children,
  useHousehold: jest.fn(),
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
const mockUseHousehold = useHousehold as jest.Mock;
const mockUseHouseholdMembers = useHouseholdMembers as jest.Mock;

const safeAreaMetrics = {
  insets: { top: 44, bottom: 34, left: 0, right: 0 },
  frame: { x: 0, y: 0, width: 390, height: 844 },
};

const buildItem = (overrides: Record<string, any> = {}) => ({
  id: 'item-1',
  name: 'Milk',
  quantity: '1L',
  is_purchased: true,
  purchased_by: null,
  archived_at: null,
  store_id: 'store-1',
  store: { name: 'Grocery Store' },
  category: { name: 'Dairy' },
  ...overrides,
});

describe('ShoppingListScreen F2 behaviors', () => {
  let queryClient: QueryClient;
  const mockToggle = jest.fn();
  const mockEndTrip = jest.fn();
  const mockRevertArchival = jest.fn();
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

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: Infinity } },
    });
    jest.clearAllMocks();
    Object.defineProperty(Platform, 'OS', {
      configurable: true,
      get: () => 'ios',
    });

    mockUseShoppingList.mockReturnValue({ data: [buildItem()], isLoading: false });
    mockUseTogglePurchased.mockReturnValue({ mutateAsync: mockToggle });
    mockUseUpdateListItem.mockReturnValue({ mutateAsync: jest.fn() });
    mockUseAddToList.mockReturnValue({ mutateAsync: jest.fn() });
    mockUseDeleteListItem.mockReturnValue({ mutateAsync: jest.fn() });
    mockUseEndTrip.mockReturnValue({ mutateAsync: mockEndTrip });
    mockUseRevertArchival.mockReturnValue({ mutateAsync: mockRevertArchival });
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
    mockUseHousehold.mockReturnValue({
      householdId: 'house-1',
      userId: 'user-1',
      avatarColor: '#0d9488',
      isLoading: false,
    });
    mockUseHouseholdMembers.mockReturnValue({
      data: [
        { id: 'user-1', display_name: 'Alice', display_name_short: 'AL', color: '#0d9488' },
        { id: 'user-2', display_name: 'Bob', display_name_short: 'BO', color: '#dc2626' },
      ],
    });
    mockEndTrip.mockResolvedValue({ trip: { id: 'trip-1' }, items: [] });
    mockRevertArchival.mockResolvedValue(undefined);
  });

  afterEach(() => {
    queryClient.clear();
  });

  it('checkbox renders current-user outlined style with avatarColor', () => {
    const view = render(<ShoppingListScreen />, { wrapper });

    const icon = view.UNSAFE_getByType(CheckCircle2);
    expect(icon.props.color).toBe('#0d9488');
  });

  it('checkbox renders other-user filled style with other member color', () => {
    mockUseShoppingList.mockReturnValue({
      data: [buildItem({ purchased_by: 'user-2' })],
      isLoading: false,
    });

    render(<ShoppingListScreen />, { wrapper });

    expect(screen.getByTestId('other-user-checkbox-item-1')).toHaveStyle({ backgroundColor: '#dc2626' });
  });

  it('unchecked checkbox renders gray circle', () => {
    mockUseShoppingList.mockReturnValue({
      data: [buildItem({ is_purchased: false })],
      isLoading: false,
    });

    const view = render(<ShoppingListScreen />, { wrapper });

    const icon = view.UNSAFE_getByType(Circle);
    expect(icon.props.color).toBe('#d1d5db');
  });

  it('single purchaser end-trip path uses Alert.alert and not modal', () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});

    render(<ShoppingListScreen />, { wrapper });
    fireEvent.press(screen.getByText('End Trip'));

    expect(alertSpy).toHaveBeenCalled();
    expect(screen.queryByTestId('multi-trip-modal')).toBeNull();
  });

  it('multi-purchaser path opens modal and not Alert', () => {
    mockUseShoppingList.mockReturnValue({
      data: [
        buildItem({ id: 'item-1', purchased_by: 'user-1' }),
        buildItem({ id: 'item-2', purchased_by: 'user-2', name: 'Bread' }),
      ],
      isLoading: false,
    });
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});

    render(<ShoppingListScreen />, { wrapper });
    fireEvent.press(screen.getByText('End Trip'));

    expect(alertSpy).not.toHaveBeenCalled();
    expect(screen.getByTestId('multi-trip-modal')).toBeTruthy();
  });

  it('confirm in modal calls endTrip once per selected user', async () => {
    mockUseShoppingList.mockReturnValue({
      data: [
        buildItem({ id: 'item-1', purchased_by: 'user-1' }),
        buildItem({ id: 'item-2', purchased_by: 'user-2', name: 'Bread' }),
      ],
      isLoading: false,
    });

    render(<ShoppingListScreen />, { wrapper });
    fireEvent.press(screen.getByText('End Trip'));
    fireEvent.press(screen.getByTestId('multi-trip-confirm'));

    await waitFor(() => {
      expect(mockEndTrip).toHaveBeenCalledWith(expect.objectContaining({ user_id: 'user-1' }));
      expect(mockEndTrip).toHaveBeenCalledWith(expect.objectContaining({ user_id: 'user-2' }));
    });
  });

  it('deselected user is not archived', async () => {
    mockUseShoppingList.mockReturnValue({
      data: [
        buildItem({ id: 'item-1', purchased_by: 'user-1' }),
        buildItem({ id: 'item-2', purchased_by: 'user-2', name: 'Bread' }),
      ],
      isLoading: false,
    });

    render(<ShoppingListScreen />, { wrapper });
    fireEvent.press(screen.getByText('End Trip'));
    fireEvent.press(screen.getByTestId('multi-trip-user-row-user-2'));
    fireEvent.press(screen.getByTestId('multi-trip-confirm'));

    await waitFor(() => {
      expect(mockEndTrip).toHaveBeenCalledWith(expect.objectContaining({ user_id: 'user-1' }));
      expect(mockEndTrip).not.toHaveBeenCalledWith(expect.objectContaining({ user_id: 'user-2' }));
    });
  });

  it('pushes one combined undo action after multi-user end trip', async () => {
    mockUseShoppingList.mockReturnValue({
      data: [
        buildItem({ id: 'item-1', purchased_by: 'user-1' }),
        buildItem({ id: 'item-2', purchased_by: 'user-2', name: 'Bread' }),
      ],
      isLoading: false,
    });

    render(<ShoppingListScreen />, { wrapper });
    fireEvent.press(screen.getByText('End Trip'));
    fireEvent.press(screen.getByTestId('multi-trip-confirm'));

    await waitFor(() => {
      expect(pushAction).toHaveBeenCalledTimes(1);
      expect(pushAction).toHaveBeenCalledWith(
        expect.objectContaining({
          label: expect.stringContaining('2 trips'),
        })
      );
    });
  });
});
