import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SmartAddItem } from '../SmartAddItem';
import { useAllItems, useCreateMasterItem, useMasterItemNames } from '@/api/items';
import { useAddToList, useDeleteListItem } from '@/api/list';
import { useMetadata } from '@/api/metadata';
import { useUndo } from '@/api/undoContext';
import { useMyProfile } from '@/api/profile';

jest.mock('@/api/items', () => {
  const actual = jest.requireActual('@/api/items');
  return {
    ...actual,
    useMasterItemNames: jest.fn(),
    useAllItems: jest.fn(),
    useCreateMasterItem: jest.fn(),
  };
});
jest.mock('@/api/list');
jest.mock('@/api/metadata');
jest.mock('@/api/undoContext');
jest.mock('@/api/profile');
jest.mock('react-native-safe-area-context', () => {
  const actual = jest.requireActual('react-native-safe-area-context');
  return {
    ...actual,
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  };
});

describe('SmartAddItem', () => {
  const mockUseMasterItemNames = useMasterItemNames as jest.Mock;
  const mockUseAllItems = useAllItems as jest.Mock;
  const mockUseCreateMasterItem = useCreateMasterItem as jest.Mock;
  const mockUseAddToList = useAddToList as jest.Mock;
  const mockUseDeleteListItem = useDeleteListItem as jest.Mock;
  const mockUseMetadata = useMetadata as jest.Mock;
  const mockUseUndo = useUndo as jest.Mock;
  const mockUseMyProfile = useMyProfile as jest.Mock;

  const pushAction = jest.fn();
  const addItem = jest.fn();
  const createMasterItem = jest.fn();

  const baseItem = {
    id: 'master-1',
    name: 'Milk',
    default_qty: '1 gal',
    default_category_id: 'cat-1',
    alternate_qtys: [],
    item_store_preferences: [],
  };

  const setItems = (items: any[]) => {
    mockUseAllItems.mockReturnValue({ data: items });
    mockUseMasterItemNames.mockReturnValue({
      data: items.map((item) => ({
        id: item.id,
        name: item.name,
        default_qty: item.default_qty ?? null,
        alternate_qtys: item.alternate_qtys ?? [],
      })),
    });
  };

  beforeEach(() => {
    jest.clearAllMocks();
    addItem.mockResolvedValue({ id: 'list-1' });
    createMasterItem.mockResolvedValue({ id: 'master-2' });

    setItems([baseItem]);
    mockUseCreateMasterItem.mockReturnValue({ mutateAsync: createMasterItem });
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
    mockUseMyProfile.mockReturnValue({
      data: {
        warning_preferences: {
          avoided: 'toast_and_badge',
          unavailable: 'toast_and_badge',
          non_preferred: 'badge_only',
          non_standard_qty: 'badge_only',
        },
      },
    });
  });

  it('does not render store pills in dropdown rows', async () => {
    render(<SmartAddItem activeStoreId="store-1" />);

    fireEvent.changeText(screen.getByPlaceholderText('Add item...'), 'milk');

    await waitFor(() => {
      expect(screen.getByText('Milk')).toBeTruthy();
    });

    expect(screen.queryByText(/Store:/)).toBeNull();
  });

  it('uses activeStoreId for quick-add store_id', async () => {
    render(<SmartAddItem activeStoreId="store-1" />);

    fireEvent.changeText(screen.getByPlaceholderText('Add item...'), 'milk');
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
    setItems([]);
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

    fireEvent.changeText(screen.getByPlaceholderText('Add item...'), 'milk');
    fireEvent.press(await screen.findByTestId('edit-add-master-1'));

    expect(await screen.findByTestId('edit-store-dropdown-trigger')).toBeTruthy();
    expect(screen.getByText('Market')).toBeTruthy();
  });

  it('renders store dropdown trigger instead of store pills in the Add Detail modal', async () => {
    render(<SmartAddItem activeStoreId="store-1" />);

    fireEvent.changeText(screen.getByPlaceholderText('Add item...'), 'milk');
    fireEvent.press(await screen.findByTestId('edit-add-master-1'));

    expect(await screen.findByTestId('edit-store-dropdown-trigger')).toBeTruthy();
    expect(screen.queryByTestId('edit-store-option-none')).toBeNull();
  });

  it('opens the store dropdown when trigger is tapped', async () => {
    render(<SmartAddItem activeStoreId="store-1" />);

    fireEvent.changeText(screen.getByPlaceholderText('Add item...'), 'milk');
    fireEvent.press(await screen.findByTestId('edit-add-master-1'));
    fireEvent.press(await screen.findByTestId('edit-store-dropdown-trigger'));

    expect(screen.getByTestId('edit-store-option-none')).toBeTruthy();
    expect(screen.getByTestId('edit-store-store-1')).toBeTruthy();
    expect(screen.getByTestId('edit-store-store-2')).toBeTruthy();
  });

  it('selects a store and closes dropdown on option tap', async () => {
    render(<SmartAddItem activeStoreId="store-1" />);

    fireEvent.changeText(screen.getByPlaceholderText('Add item...'), 'milk');
    fireEvent.press(await screen.findByTestId('edit-add-master-1'));
    fireEvent.press(await screen.findByTestId('edit-store-dropdown-trigger'));
    fireEvent.press(screen.getByTestId('edit-store-store-2'));

    await waitFor(() => {
      expect(screen.queryByTestId('edit-store-option-none')).toBeNull();
    });
    expect(screen.getByText('Alt Market')).toBeTruthy();
  });

  it('clears store and closes dropdown when "No store" is tapped', async () => {
    render(<SmartAddItem activeStoreId="store-1" />);

    fireEvent.changeText(screen.getByPlaceholderText('Add item...'), 'milk');
    fireEvent.press(await screen.findByTestId('edit-add-master-1'));
    fireEvent.press(await screen.findByTestId('edit-store-dropdown-trigger'));
    fireEvent.press(screen.getByTestId('edit-store-option-none'));

    await waitFor(() => {
      expect(screen.queryByTestId('edit-store-option-none')).toBeNull();
    });
    expect(screen.getByText('No store')).toBeTruthy();
  });

  it('toggles dropdown closed when trigger is tapped again', async () => {
    render(<SmartAddItem activeStoreId="store-1" />);

    fireEvent.changeText(screen.getByPlaceholderText('Add item...'), 'milk');
    fireEvent.press(await screen.findByTestId('edit-add-master-1'));
    fireEvent.press(await screen.findByTestId('edit-store-dropdown-trigger'));
    expect(screen.getByTestId('edit-store-option-none')).toBeTruthy();

    fireEvent.press(screen.getByTestId('edit-store-dropdown-trigger'));
    expect(screen.queryByTestId('edit-store-option-none')).toBeNull();
  });

  it('renders a Cancel button in the master-item Add Detail modal action row', async () => {
    render(<SmartAddItem activeStoreId="store-1" />);

    fireEvent.changeText(screen.getByPlaceholderText('Add item...'), 'milk');
    fireEvent.press(await screen.findByTestId('edit-add-master-1'));

    expect(await screen.findByText('Cancel')).toBeTruthy();
  });

  it('Cancel button dismisses the Add Detail modal and resets form state', async () => {
    render(<SmartAddItem activeStoreId="store-1" />);

    fireEvent.changeText(screen.getByPlaceholderText('Add item...'), 'milk');
    fireEvent.press(await screen.findByTestId('edit-add-master-1'));
    fireEvent.press(await screen.findByTestId('edit-store-dropdown-trigger'));
    fireEvent.press(screen.getByTestId('edit-store-store-2'));
    expect(screen.getByText('Alt Market')).toBeTruthy();

    fireEvent.press(screen.getByText('Cancel'));
    await waitFor(() => {
      expect(screen.queryByTestId('edit-store-dropdown-trigger')).toBeNull();
    });

    fireEvent.press(await screen.findByTestId('edit-add-master-1'));
    expect(await screen.findByText('Market')).toBeTruthy();
  });

  it('generates avoided warning when item has avoided status at active store', async () => {
    setItems([
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
    ]);

    render(<SmartAddItem activeStoreId="store-1" />);

    fireEvent.changeText(screen.getByPlaceholderText('Add item...'), 'milk');
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
    setItems([
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
    ]);

    render(<SmartAddItem activeStoreId="store-1" />);

    fireEvent.changeText(screen.getByPlaceholderText('Add item...'), 'milk');
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

    fireEvent.changeText(screen.getByPlaceholderText('Add item...'), 'milk');
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

  it('shows warning callout in Add Detail modal for master item warnings', async () => {
    setItems([
      {
        ...baseItem,
        item_store_preferences: [
          {
            store_id: 'store-1',
            status: 'avoided',
            comment: null,
            store: { id: 'store-1', name: 'Market', color_code: '#2563eb' },
          },
        ],
      },
    ]);

    render(<SmartAddItem activeStoreId="store-1" />);
    fireEvent.changeText(screen.getByPlaceholderText('Add item...'), 'milk');
    fireEvent.press(await screen.findByTestId('edit-add-master-1'));

    expect(await screen.findByText('Avoided at Market')).toBeTruthy();
  });

  it('does not show warning callout in Add Detail modal for one-off item', async () => {
    setItems([]);

    render(<SmartAddItem activeStoreId="store-1" />);
    fireEvent.changeText(screen.getByPlaceholderText('Add item...'), 'Dragonfruit');
    fireEvent.press(screen.getByTestId('edit-add-one-off'));

    await waitFor(() => {
      expect(screen.getByText('Add to List')).toBeTruthy();
    });
    expect(screen.queryByTestId('warning-callout')).toBeNull();
  });

  it('quick-add triggers warning toast when preference is toast_and_badge', async () => {
    const onWarningToast = jest.fn();
    setItems([
      {
        ...baseItem,
        item_store_preferences: [
          {
            store_id: 'store-1',
            status: 'avoided',
            comment: null,
            store: { id: 'store-1', name: 'Market', color_code: '#2563eb' },
          },
        ],
      },
    ]);

    render(<SmartAddItem activeStoreId="store-1" onWarningToast={onWarningToast} />);
    fireEvent.changeText(screen.getByPlaceholderText('Add item...'), 'milk');
    fireEvent.press(await screen.findByText('Milk'));

    await waitFor(() => {
      expect(onWarningToast).toHaveBeenCalledWith(expect.stringContaining('Avoided at Market'));
    });
  });

  it('quick-add does not trigger warning toast when preference is badge_only', async () => {
    const onWarningToast = jest.fn();
    mockUseMyProfile.mockReturnValue({
      data: {
        warning_preferences: {
          avoided: 'badge_only',
          unavailable: 'toast_and_badge',
          non_preferred: 'badge_only',
          non_standard_qty: 'badge_only',
        },
      },
    });
    setItems([
      {
        ...baseItem,
        item_store_preferences: [
          {
            store_id: 'store-1',
            status: 'avoided',
            comment: null,
            store: { id: 'store-1', name: 'Market', color_code: '#2563eb' },
          },
        ],
      },
    ]);

    render(<SmartAddItem activeStoreId="store-1" onWarningToast={onWarningToast} />);
    fireEvent.changeText(screen.getByPlaceholderText('Add item...'), 'milk');
    fireEvent.press(await screen.findByText('Milk'));

    await waitFor(() => {
      expect(addItem).toHaveBeenCalled();
    });
    expect(onWarningToast).not.toHaveBeenCalled();
  });

  it('quick-add does not trigger warning toast when preference is off', async () => {
    const onWarningToast = jest.fn();
    mockUseMyProfile.mockReturnValue({
      data: {
        warning_preferences: {
          avoided: 'off',
          unavailable: 'toast_and_badge',
          non_preferred: 'badge_only',
          non_standard_qty: 'badge_only',
        },
      },
    });
    setItems([
      {
        ...baseItem,
        item_store_preferences: [
          {
            store_id: 'store-1',
            status: 'avoided',
            comment: null,
            store: { id: 'store-1', name: 'Market', color_code: '#2563eb' },
          },
        ],
      },
    ]);

    render(<SmartAddItem activeStoreId="store-1" onWarningToast={onWarningToast} />);
    fireEvent.changeText(screen.getByPlaceholderText('Add item...'), 'milk');
    fireEvent.press(await screen.findByText('Milk'));

    await waitFor(() => {
      expect(addItem).toHaveBeenCalled();
    });
    expect(onWarningToast).not.toHaveBeenCalled();
  });

  it('Add Detail save triggers warning toast when warning exists and preference is toast_and_badge', async () => {
    const onWarningToast = jest.fn();
    setItems([
      {
        ...baseItem,
        item_store_preferences: [
          {
            store_id: 'store-1',
            status: 'avoided',
            comment: null,
            store: { id: 'store-1', name: 'Market', color_code: '#2563eb' },
          },
        ],
      },
    ]);

    render(<SmartAddItem activeStoreId="store-1" onWarningToast={onWarningToast} />);
    fireEvent.changeText(screen.getByPlaceholderText('Add item...'), 'milk');
    fireEvent.press(await screen.findByTestId('edit-add-master-1'));
    fireEvent.press(await screen.findByText('Add to List'));

    await waitFor(() => {
      expect(onWarningToast).toHaveBeenCalledWith(expect.stringContaining('Avoided at Market'));
    });
  });

  it('generates no warnings for one-off items', async () => {
    setItems([]);
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

  it('renders scoped "Other" chips for both result and one-off rows', async () => {
    render(<SmartAddItem activeStoreId="store-1" />);

    fireEvent.changeText(screen.getByPlaceholderText('Add item...'), 'milk');

    await waitFor(() => {
      expect(screen.getByText('Milk')).toBeTruthy();
    });

    expect(screen.getByTestId('result-qty-chip-other-master-1')).toBeTruthy();
    expect(screen.getByTestId('one-off-qty-chip-other')).toBeTruthy();
  });

  it('opens the freeform qty input when "Other" chip is tapped', async () => {
    render(<SmartAddItem activeStoreId="store-1" />);

    fireEvent.changeText(screen.getByPlaceholderText('Add item...'), 'milk');
    fireEvent.press(await screen.findByTestId('result-qty-chip-other-master-1'));

    expect(screen.getByPlaceholderText('e.g. 3 lbs')).toBeTruthy();
  });

  it('confirms freeform qty via Return and adds with that qty', async () => {
    render(<SmartAddItem activeStoreId="store-1" />);

    fireEvent.changeText(screen.getByPlaceholderText('Add item...'), 'milk');
    fireEvent.press(await screen.findByTestId('result-qty-chip-other-master-1'));
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

    fireEvent.changeText(screen.getByPlaceholderText('Add item...'), 'milk');
    fireEvent.press(await screen.findByTestId('result-qty-chip-other-master-1'));
    const input = screen.getByPlaceholderText('e.g. 3 lbs');
    fireEvent.changeText(input, '1 qt');
    fireEvent(input, 'submitEditing');

    expect(screen.getByText('1 qt')).toBeTruthy();
  });

  it('does nothing when Return is pressed on empty "Other" input', async () => {
    render(<SmartAddItem activeStoreId="store-1" />);

    fireEvent.changeText(screen.getByPlaceholderText('Add item...'), 'milk');
    fireEvent.press(await screen.findByTestId('result-qty-chip-other-master-1'));
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

    fireEvent.changeText(screen.getByPlaceholderText('Add item...'), 'milk');
    fireEvent.press(await screen.findByTestId('result-qty-chip-other-master-1'));
    const input = screen.getByPlaceholderText('e.g. 3 lbs');
    fireEvent.changeText(input, '1 qt');
    fireEvent(input, 'submitEditing');

    expect(screen.getByText('1 qt')).toBeTruthy();
    fireEvent.press(screen.getByText('1 gal'));

    expect(screen.getByTestId('result-qty-chip-other-master-1')).toBeTruthy();
    expect(screen.queryByText('1 qt')).toBeNull();
  });

  it('shows two actions in one-off edit modal and one for master edit modal', async () => {
    render(<SmartAddItem activeStoreId="store-1" />);

    fireEvent.changeText(screen.getByPlaceholderText('Add item...'), 'Dragonfruit');
    fireEvent.press(screen.getByTestId('edit-add-one-off'));

    expect(await screen.findByText('Add to List')).toBeTruthy();
    expect(screen.getByText('Save & Add')).toBeTruthy();
    expect(screen.queryByText('Cancel')).toBeNull();

    fireEvent.changeText(screen.getByPlaceholderText('Add item...'), 'milk');
    fireEvent.press(await screen.findByTestId('edit-add-master-1'));

    expect(await screen.findByText('Add to List')).toBeTruthy();
    expect(screen.queryByText('Save & Add')).toBeNull();
    expect(screen.getByText('Cancel')).toBeTruthy();
  });

  it('one-off edit Add to List uses null item_id and does not create master item', async () => {
    setItems([]);
    render(<SmartAddItem activeStoreId="store-1" />);

    fireEvent.changeText(screen.getByPlaceholderText('Add item...'), 'Dragonfruit');
    fireEvent.press(screen.getByTestId('edit-add-one-off'));
    fireEvent.press(await screen.findByText('Add to List'));

    await waitFor(() => {
      expect(addItem).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Dragonfruit',
          item_id: null,
          category_id: null,
        })
      );
    });
    expect(createMasterItem).not.toHaveBeenCalled();
  });

  it('one-off edit Save & Add creates master item then adds with non-null item_id', async () => {
    setItems([]);
    render(<SmartAddItem activeStoreId="store-1" />);

    fireEvent.changeText(screen.getByPlaceholderText('Add item...'), 'Dragonfruit');
    fireEvent.press(screen.getByTestId('edit-add-one-off'));
    fireEvent.press(await screen.findByText('Save & Add'));

    await waitFor(() => {
      expect(createMasterItem).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Dragonfruit',
        })
      );
    });
    expect(addItem).toHaveBeenCalledWith(
      expect.objectContaining({
        item_id: 'master-2',
      })
    );
  });

  it('shows one-off qty chips and quick add defaults to quantity 1 with null category', async () => {
    setItems([]);
    render(<SmartAddItem activeStoreId="store-1" />);

    fireEvent.changeText(screen.getByPlaceholderText('Add item...'), 'Dragonfruit');

    expect(screen.getByTestId('one-off-qty-chip-1')).toBeTruthy();
    expect(screen.getByTestId('one-off-qty-chip-other')).toBeTruthy();

    fireEvent.press(screen.getByText('Add "Dragonfruit" (One-time)'));

    await waitFor(() => {
      expect(addItem).toHaveBeenCalledWith(
        expect.objectContaining({
          quantity: '1',
          category_id: null,
        })
      );
    });
  });

  it('one-off qty other chip submit updates quick add quantity payload', async () => {
    setItems([]);
    render(<SmartAddItem activeStoreId="store-1" />);

    fireEvent.changeText(screen.getByPlaceholderText('Add item...'), 'Dragonfruit');
    fireEvent.press(screen.getByTestId('one-off-qty-chip-other'));
    fireEvent.changeText(screen.getByPlaceholderText('e.g. 3 lbs'), '3 lbs');
    fireEvent(screen.getByPlaceholderText('e.g. 3 lbs'), 'submitEditing');
    fireEvent.press(screen.getByText('Add "Dragonfruit" (One-time)'));

    await waitFor(() => {
      expect(addItem).toHaveBeenCalledWith(
        expect.objectContaining({
          quantity: '3 lbs',
        })
      );
    });
  });

  it('one-off edit Add to List keeps category null when unset', async () => {
    setItems([]);
    render(<SmartAddItem activeStoreId="store-1" />);

    fireEvent.changeText(screen.getByPlaceholderText('Add item...'), 'Dragonfruit');
    fireEvent.press(screen.getByTestId('edit-add-one-off'));
    fireEvent.press(await screen.findByText('Add to List'));

    await waitFor(() => {
      expect(addItem).toHaveBeenCalledWith(
        expect.objectContaining({
          category_id: null,
        })
      );
    });
  });
});
