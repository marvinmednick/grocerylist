import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { SmartAddItem } from '../SmartAddItem';
import { useSearchItems, useCreateMasterItem } from '@/api/items';
import { useAddToList, useDeleteListItem } from '@/api/list';
import { useMetadata } from '@/api/metadata';
import { useUndo } from '@/api/undoContext';

jest.mock('@/api/items', () => {
  const actual = jest.requireActual('@/api/items');
  return {
    ...actual,
    useSearchItems: jest.fn(),
    useCreateMasterItem: jest.fn(),
  };
});
jest.mock('@/api/list');
jest.mock('@/api/metadata');
jest.mock('@/api/undoContext');

describe('SmartAddItem', () => {
  const mockUseSearchItems = useSearchItems as jest.Mock;
  const mockUseCreateMasterItem = useCreateMasterItem as jest.Mock;
  const mockUseAddToList = useAddToList as jest.Mock;
  const mockUseDeleteListItem = useDeleteListItem as jest.Mock;
  const mockUseMetadata = useMetadata as jest.Mock;
  const mockUseUndo = useUndo as jest.Mock;

  const pushAction = jest.fn();
  const addItem = jest.fn();

  const baseItem = {
    id: 'master-1',
    name: 'Milk',
    default_qty: '1 gal',
    default_category_id: 'cat-1',
    alternate_qtys: [],
    item_store_preferences: [],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    addItem.mockResolvedValue({ id: 'list-1' });

    mockUseSearchItems.mockImplementation((query: string) => ({
      data: query.length >= 2 ? [baseItem] : [],
    }));
    mockUseCreateMasterItem.mockReturnValue({ mutateAsync: jest.fn() });
    mockUseAddToList.mockReturnValue({ mutateAsync: addItem });
    mockUseDeleteListItem.mockReturnValue({ mutateAsync: jest.fn() });
    mockUseMetadata.mockReturnValue({
      data: {
        stores: [
          { id: 'store-1', name: 'Market', color_code: '#2563eb' },
          { id: 'store-2', name: 'Alt Market', color_code: '#16a34a' },
        ],
        categories: [{ id: 'cat-1', name: 'Other' }],
      },
    });
    mockUseUndo.mockReturnValue({ pushAction });
  });

  it('does not render store pills in dropdown rows', async () => {
    render(<SmartAddItem activeStoreId="store-1" />);

    fireEvent.changeText(screen.getByPlaceholderText('Add item...'), 'Mi');

    await waitFor(() => {
      expect(screen.getByText('Milk')).toBeTruthy();
    });

    expect(screen.queryByText(/Store:/)).toBeNull();
  });

  it('uses activeStoreId for quick-add store_id', async () => {
    render(<SmartAddItem activeStoreId="store-1" />);

    fireEvent.changeText(screen.getByPlaceholderText('Add item...'), 'Mi');
    fireEvent.press(await screen.findByText('Milk'));

    await waitFor(() => {
      expect(addItem).toHaveBeenCalledWith(
        expect.objectContaining({
          store_id: 'store-1',
        })
      );
    });
  });

  it('uses activeStoreId for one-off add store_id', async () => {
    mockUseSearchItems.mockImplementation(() => ({ data: [] }));
    render(<SmartAddItem activeStoreId="store-1" />);

    fireEvent.changeText(screen.getByPlaceholderText('Add item...'), 'Dragonfruit');
    fireEvent.press(screen.getByText('Add "Dragonfruit" (One-time)'));

    await waitFor(() => {
      expect(addItem).toHaveBeenCalledWith(
        expect.objectContaining({
          store_id: 'store-1',
        })
      );
    });
  });

  it('defaults edit modal store to activeStoreId', async () => {
    render(<SmartAddItem activeStoreId="store-1" />);

    fireEvent.changeText(screen.getByPlaceholderText('Add item...'), 'Mi');
    fireEvent.press(await screen.findByTestId('edit-add-master-1'));

    const activeStoreTag = await screen.findByTestId('edit-store-store-1');
    const style = StyleSheet.flatten(activeStoreTag.props.style);
    expect(style.backgroundColor).toBe('#2563eb');
  });

  it('generates avoided warning when item has avoided status at active store', async () => {
    mockUseSearchItems.mockImplementation((query: string) => ({
      data:
        query.length >= 2
          ? [
              {
                ...baseItem,
                item_store_preferences: [
                  {
                    store_id: 'store-1',
                    status: 'avoided',
                    comment: 'bad quality',
                    store: { id: 'store-1', name: 'Market', color_code: '#2563eb' },
                  },
                ],
              },
            ]
          : [],
    }));

    render(<SmartAddItem activeStoreId="store-1" />);

    fireEvent.changeText(screen.getByPlaceholderText('Add item...'), 'Mi');
    fireEvent.press(await screen.findByText('Milk'));

    await waitFor(() => {
      expect(addItem).toHaveBeenCalledWith(
        expect.objectContaining({
          warnings: expect.arrayContaining([
            expect.objectContaining({ type: 'avoided', comment: 'bad quality' }),
          ]),
        })
      );
    });
  });

  it('generates non_preferred warning when preferred stores exist elsewhere', async () => {
    mockUseSearchItems.mockImplementation((query: string) => ({
      data:
        query.length >= 2
          ? [
              {
                ...baseItem,
                item_store_preferences: [
                  {
                    store_id: 'store-2',
                    status: 'preferred',
                    comment: null,
                    store: { id: 'store-2', name: 'Alt Market', color_code: '#16a34a' },
                  },
                ],
              },
            ]
          : [],
    }));

    render(<SmartAddItem activeStoreId="store-1" />);

    fireEvent.changeText(screen.getByPlaceholderText('Add item...'), 'Mi');
    fireEvent.press(await screen.findByText('Milk'));

    await waitFor(() => {
      expect(addItem).toHaveBeenCalledWith(
        expect.objectContaining({
          warnings: expect.arrayContaining([
            expect.objectContaining({ type: 'non_preferred' }),
          ]),
        })
      );
    });
  });

  it('generates non_standard_qty warning', async () => {
    render(<SmartAddItem activeStoreId="store-1" />);

    fireEvent.changeText(screen.getByPlaceholderText('Add item...'), 'Mi');
    fireEvent.press(await screen.findByTestId('edit-add-master-1'));

    fireEvent.changeText(screen.getByDisplayValue('1 gal'), '3');
    fireEvent.press(screen.getByText('Add to List'));

    await waitFor(() => {
      expect(addItem).toHaveBeenCalledWith(
        expect.objectContaining({
          warnings: expect.arrayContaining([
            expect.objectContaining({ type: 'non_standard_qty', entered: '3' }),
          ]),
        })
      );
    });
  });

  it('generates no warnings for one-off items', async () => {
    mockUseSearchItems.mockImplementation(() => ({ data: [] }));
    render(<SmartAddItem activeStoreId="store-1" />);

    fireEvent.changeText(screen.getByPlaceholderText('Add item...'), 'Dragonfruit');
    fireEvent.press(screen.getByText('Add "Dragonfruit" (One-time)'));

    await waitFor(() => {
      expect(addItem).toHaveBeenCalledWith(
        expect.objectContaining({
          warnings: [],
        })
      );
    });
  });

  it('renders an "Other" chip in the qty pill row for each result item', async () => {
    render(<SmartAddItem activeStoreId="store-1" />);

    fireEvent.changeText(screen.getByPlaceholderText('Add item...'), 'Mi');

    await waitFor(() => {
      expect(screen.getByText('Milk')).toBeTruthy();
    });

    expect(screen.getByText('Other')).toBeTruthy();
  });

  it('opens the freeform qty input when "Other" chip is tapped', async () => {
    render(<SmartAddItem activeStoreId="store-1" />);

    fireEvent.changeText(screen.getByPlaceholderText('Add item...'), 'Mi');
    fireEvent.press(await screen.findByText('Other'));

    expect(screen.getByPlaceholderText('e.g. 3 lbs')).toBeTruthy();
  });

  it('confirms freeform qty via Return and adds with that qty', async () => {
    render(<SmartAddItem activeStoreId="store-1" />);

    fireEvent.changeText(screen.getByPlaceholderText('Add item...'), 'Mi');
    fireEvent.press(await screen.findByText('Other'));
    const input = screen.getByPlaceholderText('e.g. 3 lbs');
    fireEvent.changeText(input, '3 lbs');
    fireEvent(input, 'submitEditing');
    fireEvent.press(screen.getByText('Milk'));

    await waitFor(() => {
      expect(addItem).toHaveBeenCalledWith(
        expect.objectContaining({
          quantity: '3 lbs',
        })
      );
    });
  });

  it('shows the typed custom value as the active "Other" chip label after confirm', async () => {
    render(<SmartAddItem activeStoreId="store-1" />);

    fireEvent.changeText(screen.getByPlaceholderText('Add item...'), 'Mi');
    fireEvent.press(await screen.findByText('Other'));
    const input = screen.getByPlaceholderText('e.g. 3 lbs');
    fireEvent.changeText(input, '1 qt');
    fireEvent(input, 'submitEditing');

    expect(screen.getByText('1 qt')).toBeTruthy();
    expect(screen.queryByText('Other')).toBeNull();
  });

  it('does nothing when Return is pressed on empty "Other" input', async () => {
    render(<SmartAddItem activeStoreId="store-1" />);

    fireEvent.changeText(screen.getByPlaceholderText('Add item...'), 'Mi');
    fireEvent.press(await screen.findByText('Other'));
    const input = screen.getByPlaceholderText('e.g. 3 lbs');
    fireEvent.changeText(input, '');
    fireEvent(input, 'submitEditing');
    fireEvent.press(screen.getByText('Milk'));

    await waitFor(() => {
      expect(addItem).toHaveBeenCalledWith(
        expect.objectContaining({
          quantity: '1 gal',
        })
      );
    });
  });

  it('resets "Other" chip label when a predefined chip is selected after custom qty', async () => {
    render(<SmartAddItem activeStoreId="store-1" />);

    fireEvent.changeText(screen.getByPlaceholderText('Add item...'), 'Mi');
    fireEvent.press(await screen.findByText('Other'));
    const input = screen.getByPlaceholderText('e.g. 3 lbs');
    fireEvent.changeText(input, '1 qt');
    fireEvent(input, 'submitEditing');

    expect(screen.getByText('1 qt')).toBeTruthy();
    fireEvent.press(screen.getByText('1 gal'));

    expect(screen.getByText('Other')).toBeTruthy();
    expect(screen.queryByText('1 qt')).toBeNull();
  });
});
