import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { StoreSelector } from '../StoreSelector';
import { useCreateStore, useMetadata } from '@/api/metadata';

jest.mock('@/api/metadata');

describe('StoreSelector', () => {
  const mockUseMetadata = useMetadata as jest.Mock;
  const mockUseCreateStore = useCreateStore as jest.Mock;
  const createStore = jest.fn();

  const stores = [
    { id: 'store-1', name: 'Market', color_code: '#2563eb' },
    { id: 'store-2', name: 'Alt Market', color_code: '#16a34a' },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    createStore.mockResolvedValue({ id: 'store-3', name: 'New Store' });

    mockUseMetadata.mockReturnValue({
      data: {
        stores,
        categories: [],
      },
    });

    mockUseCreateStore.mockReturnValue({ mutateAsync: createStore });
  });

  it('renders the active store name', () => {
    render(<StoreSelector activeStoreId="store-1" onStoreChange={jest.fn()} />);

    expect(screen.getByText('Market')).toBeTruthy();
  });

  it('shows dropdown chevron', () => {
    render(<StoreSelector activeStoreId="store-1" onStoreChange={jest.fn()} />);

    expect(screen.getByText(' ▾')).toBeTruthy();
  });

  it('opens dropdown on press', () => {
    render(<StoreSelector activeStoreId="store-1" onStoreChange={jest.fn()} />);

    fireEvent.press(screen.getByTestId('store-selector-trigger'));

    expect(screen.getByText('Alt Market')).toBeTruthy();
  });

  it('shows checkmark on active store', () => {
    render(<StoreSelector activeStoreId="store-1" onStoreChange={jest.fn()} />);

    fireEvent.press(screen.getByTestId('store-selector-trigger'));

    expect(screen.getByTestId('active-store-check-store-1')).toBeTruthy();
  });

  it('calls onStoreChange when a store is selected', () => {
    const onStoreChange = jest.fn();
    render(<StoreSelector activeStoreId="store-1" onStoreChange={onStoreChange} />);

    fireEvent.press(screen.getByTestId('store-selector-trigger'));
    fireEvent.press(screen.getByText('Alt Market'));

    expect(onStoreChange).toHaveBeenCalledWith('store-2');
  });

  it('shows Add new store option', () => {
    render(<StoreSelector activeStoreId="store-1" onStoreChange={jest.fn()} />);

    fireEvent.press(screen.getByTestId('store-selector-trigger'));

    expect(screen.getByText('+ Add new store')).toBeTruthy();
  });

  it('opens creation modal when Add new store tapped', () => {
    render(<StoreSelector activeStoreId="store-1" onStoreChange={jest.fn()} />);

    fireEvent.press(screen.getByTestId('store-selector-trigger'));
    fireEvent.press(screen.getByText('+ Add new store'));

    expect(screen.getByTestId('new-store-name-input')).toBeTruthy();
  });

  it('calls useCreateStore with name and color', async () => {
    const onStoreChange = jest.fn();
    render(<StoreSelector activeStoreId="store-1" onStoreChange={onStoreChange} />);

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
});
