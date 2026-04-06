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

const DAY_MS = 24 * 60 * 60 * 1000;
const FIXED_NOW = Date.parse('2026-03-23T12:00:00.000Z');

type TestItem = {
  id: string;
  name: string;
  created_at: string;
};

const buildItem = ({ id, name, created_at }: TestItem) => ({
  id,
  name,
  created_at,
  short_name: null,
  default_qty: null,
  alternate_qtys: [],
  default_category_id: null,
  category: { name: 'Pantry' },
  item_store_preferences: [],
});

const sortItems = (items: ReturnType<typeof buildItem>[], sort: string) => {
  const sorted = [...items];
  if (sort === 'name_asc') sorted.sort((a, b) => a.name.localeCompare(b.name));
  else if (sort === 'name_desc') sorted.sort((a, b) => b.name.localeCompare(a.name));
  else if (sort === 'created_desc') sorted.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  else if (sort === 'created_asc') sorted.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  return sorted;
};

describe('ItemsScreen sort and recent filters', () => {
  let sourceItems: ReturnType<typeof buildItem>[];

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Date, 'now').mockReturnValue(FIXED_NOW);
    sourceItems = [
      buildItem({ id: '1', name: 'Apple', created_at: new Date(FIXED_NOW - DAY_MS).toISOString() }),
      buildItem({ id: '2', name: 'Banana', created_at: new Date(FIXED_NOW - 8 * DAY_MS).toISOString() }),
    ];

    mockUseAllItems.mockImplementation((search: string = '', sort: string = 'name_asc') => {
      const searchTerm = search.toLowerCase();
      const filtered = sourceItems.filter((item) => item.name.toLowerCase().includes(searchTerm));
      return {
        data: sortItems(filtered, sort),
        isLoading: false,
        error: null,
      };
    });
    mockUseCreateMasterItem.mockReturnValue({ mutateAsync: jest.fn().mockResolvedValue({ id: 'item-1' }) });
    mockUseUpdateMasterItem.mockReturnValue({ mutateAsync: jest.fn().mockResolvedValue({ id: 'item-1' }) });
    mockUseWordAliases.mockReturnValue({ data: new Map<string, string>() });
    mockUseMetadata.mockReturnValue({
      data: {
        stores: [{ id: 'store-1', name: 'Market', color_code: '#2563eb' }],
        categories: [{ id: 'cat-1', name: 'Pantry' }],
      },
    });
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
    jest.restoreAllMocks();
  });

  const renderScreen = () =>
    render(
      <SafeAreaProvider initialMetrics={safeAreaMetrics}>
        <ItemsScreen />
      </SafeAreaProvider>
    );

  it('renders four sort pills and Recent toggle below search bar', () => {
    renderScreen();

    expect(screen.getByTestId('sort-pill-name_asc')).toBeTruthy();
    expect(screen.getByTestId('sort-pill-name_desc')).toBeTruthy();
    expect(screen.getByTestId('sort-pill-created_desc')).toBeTruthy();
    expect(screen.getByTestId('sort-pill-created_asc')).toBeTruthy();
    expect(screen.getByTestId('recent-toggle')).toBeTruthy();
  });

  it('A→Z pill is active by default', () => {
    renderScreen();

    const activePill = screen.getByTestId('sort-pill-name_asc');
    const styles = Array.isArray(activePill.props.style) ? activePill.props.style : [activePill.props.style];
    const hasActiveBackground = styles.some((entry: { backgroundColor?: string }) => entry?.backgroundColor === '#2563eb');

    expect(hasActiveBackground).toBe(true);
  });

  it('tapping a sort pill changes active sort', async () => {
    renderScreen();

    fireEvent.press(screen.getByTestId('sort-pill-created_desc'));

    await waitFor(() => {
      expect(mockUseAllItems).toHaveBeenLastCalledWith('', 'created_desc');
    });
  });

  it('tapping Recent toggle filters to items created within 7 days', () => {
    renderScreen();
    expect(screen.getByText('Apple')).toBeTruthy();
    expect(screen.getByText('Banana')).toBeTruthy();

    fireEvent.press(screen.getByTestId('recent-toggle'));

    expect(screen.getByText('Apple')).toBeTruthy();
    expect(screen.queryByText('Banana')).toBeNull();
  });

  it('Recent toggle auto-sets sort to Newest', async () => {
    renderScreen();

    fireEvent.press(screen.getByTestId('recent-toggle'));

    await waitFor(() => {
      expect(mockUseAllItems).toHaveBeenLastCalledWith('', 'created_desc');
    });
  });

  it('tapping Recent toggle again shows all items', () => {
    renderScreen();

    fireEvent.press(screen.getByTestId('recent-toggle'));
    expect(screen.queryByText('Banana')).toBeNull();

    fireEvent.press(screen.getByTestId('recent-toggle'));
    expect(screen.getByText('Banana')).toBeTruthy();
  });

  it('Recent filter ANDs with text search', () => {
    sourceItems = [
      buildItem({ id: '1', name: 'Milk Recent Match', created_at: new Date(FIXED_NOW - DAY_MS).toISOString() }),
      buildItem({ id: '2', name: 'Milk Old Match', created_at: new Date(FIXED_NOW - 8 * DAY_MS).toISOString() }),
      buildItem({ id: '3', name: 'Bread Recent NonMatch', created_at: new Date(FIXED_NOW - DAY_MS).toISOString() }),
    ];
    renderScreen();

    fireEvent.changeText(screen.getByPlaceholderText('Search your library...'), 'milk');
    fireEvent.press(screen.getByTestId('recent-toggle'));

    expect(screen.getByText('Milk Recent Match')).toBeTruthy();
    expect(screen.queryByText('Milk Old Match')).toBeNull();
    expect(screen.queryByText('Bread Recent NonMatch')).toBeNull();
  });

  it('shows New badge for items created within 7 days', () => {
    sourceItems = [
      buildItem({ id: '1', name: 'Recent Item', created_at: new Date(FIXED_NOW).toISOString() }),
    ];
    renderScreen();

    expect(screen.getByText('New')).toBeTruthy();
  });

  it('does not show New badge for items created more than 7 days ago', () => {
    sourceItems = [
      buildItem({ id: '1', name: 'Old Item', created_at: new Date(FIXED_NOW - 8 * DAY_MS).toISOString() }),
    ];
    renderScreen();

    expect(screen.queryByText('New')).toBeNull();
  });
});
