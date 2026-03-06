import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SmartAddItem } from '../SmartAddItem';
import { useSearchItems, useCreateMasterItem } from '@/api/items';
import { useAddToList, useDeleteListItem } from '@/api/list';
import { useMetadata } from '@/api/metadata';
import { useUndo } from '@/api/undoContext';

jest.mock('@/api/items');
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

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseSearchItems.mockImplementation((query: string) => ({
      data: query.length >= 2
        ? [{
            id: 'master-1',
            name: 'Milk',
            default_qty: '2',
            default_store_id: 'store-1',
            default_category_id: 'cat-1',
            alternate_qtys: [],
            item_stores: [],
          }]
        : [],
    }));
    mockUseCreateMasterItem.mockReturnValue({ mutateAsync: jest.fn() });
    mockUseAddToList.mockReturnValue({ mutateAsync: jest.fn() });
    mockUseDeleteListItem.mockReturnValue({ mutateAsync: jest.fn() });
    mockUseMetadata.mockReturnValue({
      data: {
        stores: [{ id: 'store-1', name: 'Market' }],
        categories: [{ id: 'cat-other', name: 'Other' }],
      },
    });
    mockUseUndo.mockReturnValue({
      pushAction,
    });
  });

  it('renders the search input', async () => {
    render(<SmartAddItem />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Add item...')).toBeTruthy();
    });
  });

  it('commit add undo uses the latest id after redo', async () => {
    const addItem = jest.fn()
      .mockResolvedValueOnce({ id: 'item-1' })
      .mockResolvedValueOnce({ id: 'item-2' });
    const deleteItem = jest.fn().mockResolvedValue(undefined);
    mockUseAddToList.mockReturnValue({ mutateAsync: addItem });
    mockUseDeleteListItem.mockReturnValue({ mutateAsync: deleteItem });

    render(<SmartAddItem />);

    fireEvent.changeText(screen.getByPlaceholderText('Add item...'), 'Mi');
    fireEvent.press(screen.getByText('Milk'));

    await waitFor(() => {
      expect(pushAction).toHaveBeenCalledTimes(1);
    });

    const action = pushAction.mock.calls[0][0];
    await action.undo();
    expect(deleteItem).toHaveBeenNthCalledWith(1, 'item-1');

    await action.redo();
    expect(addItem).toHaveBeenCalledTimes(2);

    await action.undo();
    expect(deleteItem).toHaveBeenNthCalledWith(2, 'item-2');
  });

  it('one-off add undo uses the latest id after redo', async () => {
    const addItem = jest.fn()
      .mockResolvedValueOnce({ id: 'item-1' })
      .mockResolvedValueOnce({ id: 'item-2' });
    const deleteItem = jest.fn().mockResolvedValue(undefined);
    mockUseSearchItems.mockImplementation(() => ({ data: [] }));
    mockUseAddToList.mockReturnValue({ mutateAsync: addItem });
    mockUseDeleteListItem.mockReturnValue({ mutateAsync: deleteItem });

    render(<SmartAddItem />);

    fireEvent.changeText(screen.getByPlaceholderText('Add item...'), 'Dragonfruit');
    fireEvent.press(screen.getByText('Add "Dragonfruit" (One-time)'));

    await waitFor(() => {
      expect(pushAction).toHaveBeenCalledTimes(1);
    });

    const action = pushAction.mock.calls[0][0];
    await action.undo();
    expect(deleteItem).toHaveBeenNthCalledWith(1, 'item-1');

    await action.redo();
    expect(addItem).toHaveBeenCalledTimes(2);

    await action.undo();
    expect(deleteItem).toHaveBeenNthCalledWith(2, 'item-2');
  });
});
