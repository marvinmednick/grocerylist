import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import ItemsScreen from '../items';
import { useAllItems, useCreateMasterItem, useUpdateMasterItem } from '@/api/items';
import { useMetadata } from '@/api/metadata';

jest.mock('@/api/items');
jest.mock('@/api/metadata');
jest.mock('@/api/undoContext', () => ({
  useUndo: () => ({
    undoLastAction: jest.fn(),
    redoLastAction: jest.fn(),
    canUndo: false,
    canRedo: false,
    undoStack: [],
    redoStack: [],
  }),
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
const mockUseMetadata = useMetadata as jest.Mock;

const safeAreaMetrics = {
  insets: { top: 44, bottom: 34, left: 0, right: 0 },
  frame: { x: 0, y: 0, width: 390, height: 844 },
};

describe('ItemsScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAllItems.mockReturnValue({ data: [], isLoading: false, error: null });
    mockUseCreateMasterItem.mockReturnValue({ mutate: jest.fn() });
    mockUseUpdateMasterItem.mockReturnValue({ mutate: jest.fn() });
    mockUseMetadata.mockReturnValue({ data: { stores: [], categories: [] } });
  });

  it('renders header actions (undo, redo, avatar)', () => {
    render(
      <SafeAreaProvider initialMetrics={safeAreaMetrics}>
        <ItemsScreen />
      </SafeAreaProvider>
    );

    expect(screen.getByTestId('header-undo-button')).toBeTruthy();
    expect(screen.getByTestId('header-redo-button')).toBeTruthy();
    expect(screen.getByText('Avatar Stub')).toBeTruthy();
  });
});
