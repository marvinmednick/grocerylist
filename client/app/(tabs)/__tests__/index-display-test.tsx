import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
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
import { useVocabulary } from '@/api/vocabulary';
import { makeListItem, makeQuantityEntry } from '@/api/__tests__/_helpers/listItemMock';

jest.mock('@/api/list');
jest.mock('@/api/undoContext', () => {
  const actual = jest.requireActual('@/api/undoContext');
  return { ...actual, useUndo: jest.fn() };
});
jest.mock('@/api/metadata');
jest.mock('@/api/profile');
jest.mock('@/api/vocabulary');
jest.mock('@/lib/household', () => ({
  HouseholdProvider: ({ children }: { children: React.ReactNode }) => children,
  useHousehold: jest.fn(),
}));
jest.mock('@/components/WarningBadge', () => ({
  WarningBadge: ({ warnings }: { warnings: unknown[] }) => {
    const { View } = require('react-native');
    return <View testID={`warning-badge-${warnings.length}`} />;
  },
}));

const mockUseShoppingList = useShoppingList as jest.Mock;
const mockUseTogglePurchased = useTogglePurchased as jest.Mock;
const mockUseUpdateListItemFields = useUpdateListItemFields as jest.Mock;
const mockUseUpdateQuantityEntry = useUpdateQuantityEntry as jest.Mock;
const mockUseAddToList = useAddToList as jest.Mock;
const mockUseDeleteListItem = useDeleteListItem as jest.Mock;
const mockUseEndTrip = useEndTrip as jest.Mock;
const mockUseRevertArchival = useRevertArchival as jest.Mock;
const mockUseUndo = useUndo as jest.Mock;
const mockUseMetadata = useMetadata as jest.Mock;
const mockUseHouseholdMembers = useHouseholdMembers as jest.Mock;
const mockUseHousehold = useHousehold as jest.Mock;
const mockUseVocabulary = useVocabulary as jest.Mock;

const safeAreaMetrics = {
  insets: { top: 44, bottom: 34, left: 0, right: 0 },
  frame: { x: 0, y: 0, width: 390, height: 844 },
};

describe('ShoppingListScreen display density', () => {
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

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: Infinity } },
    });

    jest.clearAllMocks();
    mockUseTogglePurchased.mockReturnValue({ mutateAsync: jest.fn() });
    mockUseUpdateListItemFields.mockReturnValue({ mutateAsync: jest.fn() });
    mockUseUpdateQuantityEntry.mockReturnValue({ mutateAsync: jest.fn() });
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
    mockUseHousehold.mockReturnValue({ householdId: 'h1', isLoading: false, userId: 'u1', avatarColor: '#2563eb' });
    mockUseVocabulary.mockReturnValue({ data: undefined });
  });

  afterEach(() => {
    queryClient.clear();
  });

  const buildItem = (overrides: Record<string, unknown> = {}) =>
    makeListItem({
      id: '1',
      name: 'Milk',
      store_id: 's1',
      category_id: 'c1',
      store: { name: 'Corner Shop', color_code: '#000000' },
      category: { name: 'Dairy', sort_order: 1 },
      quantities: [makeQuantityEntry({ id: 'entry-1', list_item_id: '1', quantity: '2L', is_purchased: false, purchased_by: null })],
      ...overrides,
    });

  it('renders item name on line 1 and qty/category/store on line 2', () => {
    mockUseShoppingList.mockReturnValue({
      data: [
        buildItem(),
      ],
      isLoading: false,
    });

    render(<ShoppingListScreen />, { wrapper });

    expect(screen.getByText('Milk')).toBeTruthy();
    expect(screen.getByText('2L · Dairy · Corner Shop')).toBeTruthy();
  });

  it('uses short_name when master_item.short_name is set', () => {
    mockUseShoppingList.mockReturnValue({
      data: [
        buildItem({
          name: 'Peanut Butter',
          item_id: 'm1',
          master_item: { short_name: 'PB' },
          store: { name: 'Market', color_code: '#000000' },
          category: { name: 'Pantry', sort_order: 1 },
          quantities: [makeQuantityEntry({ id: 'entry-1', list_item_id: '1', quantity: '16oz', is_purchased: false, purchased_by: null })],
        }),
      ],
      isLoading: false,
    });

    render(<ShoppingListScreen />, { wrapper });

    expect(screen.getByText('PB')).toBeTruthy();
    expect(screen.queryByText('Peanut Butter')).toBeNull();
  });

  it('falls back to name when short_name is null', () => {
    mockUseShoppingList.mockReturnValue({
      data: [
        buildItem({
          name: 'Peanut Butter',
          item_id: 'm1',
          master_item: { short_name: null },
          store: { name: 'Market', color_code: '#000000' },
          category: { name: 'Pantry', sort_order: 1 },
          quantities: [makeQuantityEntry({ id: 'entry-1', list_item_id: '1', quantity: '16oz', is_purchased: false, purchased_by: null })],
        }),
      ],
      isLoading: false,
    });

    render(<ShoppingListScreen />, { wrapper });
    expect(screen.getByText('Peanut Butter')).toBeTruthy();
  });

  it('shows warning badges when warnings array is non-empty', () => {
    mockUseShoppingList.mockReturnValue({
      data: [
        buildItem({
          item_id: 'm1',
          warnings: [{ type: 'avoided' }],
          store: { name: 'Market', color_code: '#000000' },
          category: { name: 'Dairy', sort_order: 1 },
          quantities: [makeQuantityEntry({ id: 'entry-1', list_item_id: '1', quantity: '1L', is_purchased: false, purchased_by: null })],
        }),
      ],
      isLoading: false,
    });

    render(<ShoppingListScreen />, { wrapper });
    expect(screen.getByTestId('warning-badge-1')).toBeTruthy();
  });

  it('does not render pencil icon column', () => {
    mockUseShoppingList.mockReturnValue({
      data: [
        buildItem({
          store: { name: 'Market', color_code: '#000000' },
          category: { name: 'Dairy', sort_order: 1 },
          quantities: [makeQuantityEntry({ id: 'entry-1', list_item_id: '1', quantity: '1L', is_purchased: false, purchased_by: null })],
        }),
      ],
      isLoading: false,
    });

    render(<ShoppingListScreen />, { wrapper });
    expect(screen.queryByTestId('pencil-icon')).toBeNull();
  });

  it('applies strikethrough to purchased items', () => {
    mockUseShoppingList.mockReturnValue({
      data: [
        buildItem({
          store: { name: 'Market', color_code: '#000000' },
          category: { name: 'Dairy', sort_order: 1 },
          quantities: [makeQuantityEntry({ id: 'entry-1', list_item_id: '1', quantity: '1L', is_purchased: true, purchased_by: 'u1' })],
        }),
      ],
      isLoading: false,
    });

    render(<ShoppingListScreen />, { wrapper });

    const name = screen.getByText('Milk');
    const style = StyleSheet.flatten(name.props.style);
    expect(style.textDecorationLine).toBe('line-through');
  });
});
