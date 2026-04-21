import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { DuplicateResolutionDialog } from '@/components/DuplicateResolutionDialog';
import type { ListItem, QuantityEntry } from '@/api/list';
import type { CombineOption } from '@/lib/quantityFormat';

jest.mock('react-native-safe-area-context', () => {
  const actual = jest.requireActual('react-native-safe-area-context');
  return {
    ...actual,
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  };
});

function makeEntry(overrides: Partial<QuantityEntry> = {}): QuantityEntry {
  return {
    id: 'entry-1',
    list_item_id: 'parent-1',
    quantity: '1.5 lb',
    quantity_parsed: null,
    is_purchased: false,
    purchased_at: null,
    purchased_by: null,
    trip_id: null,
    archived_at: null,
    added_at: '2026-01-01T00:00:00.000Z',
    added_by: null,
    household_id: 'household-1',
    ...overrides,
  };
}

function makeMatch(overrides: Partial<ListItem> = {}): ListItem {
  return {
    id: 'parent-1',
    name: 'Chicken Breast',
    item_id: 'item-1',
    category_id: null,
    store_id: 'store-1',
    store: { name: 'Safeway', color_code: '#2563eb' },
    added_at: '2026-01-01T00:00:00.000Z',
    added_by: null,
    archived_at: null,
    quantities: [makeEntry()],
    ...overrides,
  };
}

function makeCombineOptions(): CombineOption[] {
  return [
    {
      type: 'sum',
      label: '3 lb',
      result: {
        count: null,
        packageType: null,
        packagePlural: null,
        sizeQty: 3,
        sizeUnit: 'lb',
        sizeDescriptive: null,
      },
    },
  ];
}

function renderDialog(overrides: Partial<React.ComponentProps<typeof DuplicateResolutionDialog>> = {}) {
  const onCombine = jest.fn();
  const onAddNew = jest.fn();
  const onCustom = jest.fn();
  const onDismiss = jest.fn();

  render(
    <DuplicateResolutionDialog
      match={makeMatch()}
      incomingName="Chicken Breast"
      incomingQuantity="1.5 lb"
      incomingStoreId="store-1"
      combineOptions={makeCombineOptions()}
      duplicateState="active-same-store"
      storeName="Safeway"
      incomingStoreName="Safeway"
      onCombine={onCombine}
      onAddNew={onAddNew}
      onCustom={onCustom}
      onDismiss={onDismiss}
      {...overrides}
    />
  );

  return { onCombine, onAddNew, onCustom, onDismiss };
}

describe('DuplicateResolutionDialog', () => {
  it('renders summary line with existing quantity and store', () => {
    renderDialog();
    expect(screen.getByText('You already have 1.5 lb at Safeway')).toBeTruthy();
  });

  it('shows Combine buttons for active same-store duplicate', () => {
    renderDialog();
    expect(screen.queryByText('Combine as:')).toBeNull();
    expect(screen.getByText('Combine as 3 lb')).toBeTruthy();
  });

  it('hides Combine section for purchased items', () => {
    renderDialog({
      duplicateState: 'purchased-same-trip',
      combineOptions: makeCombineOptions(),
      match: makeMatch({ quantities: [makeEntry({ is_purchased: true })] }),
    });
    expect(screen.queryByText(/Combine as/)).toBeNull();
  });

  it('shows per-store combine buttons for cross-store duplicate', () => {
    renderDialog({
      duplicateState: 'active-different-store',
      incomingStoreId: 'store-2',
      incomingStoreName: 'Costco',
    });
    expect(screen.getByText('Combine as 3 lb at Safeway')).toBeTruthy();
    expect(screen.getByText('Combine as 3 lb at Costco')).toBeTruthy();
  });

  it('shows only Custom and Cancel in the bottom row', () => {
    renderDialog();
    expect(screen.getByText('Custom')).toBeTruthy();
    expect(screen.getByText('Cancel')).toBeTruthy();
    expect(screen.queryByText('Add New')).toBeNull();
  });

  it('switches to custom input mode when Custom tapped', () => {
    renderDialog();
    fireEvent.press(screen.getByTestId('duplicate-custom'));
    expect(screen.getByTestId('duplicate-custom-input')).toBeTruthy();
    expect(screen.queryByText('Combine as 3 lb')).toBeNull();
  });

  it('returns to main view when Cancel tapped in custom mode', () => {
    renderDialog();
    fireEvent.press(screen.getByTestId('duplicate-custom'));
    fireEvent.press(screen.getByText('Cancel'));
    expect(screen.getByText('Combine as 3 lb')).toBeTruthy();
  });

  it('dismisses dialog when ✕ tapped', () => {
    const { onDismiss } = renderDialog();
    fireEvent.press(screen.getByTestId('duplicate-dialog-close'));
    expect(onDismiss).toHaveBeenCalled();
  });

  it('calls onCombine with correct option when combine button tapped', () => {
    const { onCombine } = renderDialog();
    fireEvent.press(screen.getByText('Combine as 3 lb'));
    expect(onCombine).toHaveBeenCalledWith(expect.objectContaining({ type: 'sum' }));
  });

  it('calls onCombine with the existing store id for cross-store combine', () => {
    const { onCombine } = renderDialog({
      duplicateState: 'active-different-store',
      incomingStoreId: 'store-2',
      incomingStoreName: 'Costco',
    });
    fireEvent.press(screen.getByText('Combine as 3 lb at Safeway'));
    expect(onCombine).toHaveBeenCalledWith(expect.objectContaining({ type: 'sum' }), 'store-1');
  });

  it('calls onCombine with the incoming store id for cross-store combine', () => {
    const { onCombine } = renderDialog({
      duplicateState: 'active-different-store',
      incomingStoreId: 'store-2',
      incomingStoreName: 'Costco',
    });
    fireEvent.press(screen.getByText('Combine as 3 lb at Costco'));
    expect(onCombine).toHaveBeenCalledWith(expect.objectContaining({ type: 'sum' }), 'store-2');
  });

  it('calls onAddNew when Add a separate is tapped', () => {
    const { onAddNew } = renderDialog();
    fireEvent.press(screen.getByTestId('duplicate-add-separate'));
    expect(onAddNew).toHaveBeenCalled();
  });

  it('calls onCustom with input text when Confirm tapped in custom mode', () => {
    const { onCustom } = renderDialog();
    fireEvent.press(screen.getByTestId('duplicate-custom'));
    fireEvent.changeText(screen.getByTestId('duplicate-custom-input'), '4lb');
    fireEvent.press(screen.getByText('Confirm'));
    expect(onCustom).toHaveBeenCalledWith('4lb');
  });

  it('calls onDismiss when Cancel tapped from main view', () => {
    const { onDismiss } = renderDialog();
    fireEvent.press(screen.getByTestId('duplicate-cancel'));
    expect(onDismiss).toHaveBeenCalled();
  });

  it('shows the same-store add-separate label with quantity', () => {
    renderDialog();
    expect(screen.getByText('Add a separate 1.5 lb item')).toBeTruthy();
  });

  it('shows the cross-store add-separate label with the incoming store name', () => {
    renderDialog({
      duplicateState: 'active-different-store',
      incomingStoreId: 'store-2',
      incomingStoreName: 'Costco',
    });
    expect(screen.getByText('Add a separate 1.5 lb at Costco')).toBeTruthy();
  });

  it('shows the add-separate label without quantity when quantity is empty', () => {
    renderDialog({
      incomingQuantity: '',
    });
    expect(screen.getByText('Add a separate item')).toBeTruthy();
  });

  it('shows the purchased-same-trip add-separate label without a store suffix', () => {
    renderDialog({
      duplicateState: 'purchased-same-trip',
      match: makeMatch({ quantities: [makeEntry({ is_purchased: true })] }),
      incomingStoreName: 'Costco',
    });
    expect(screen.getByText('Add a separate 1.5 lb item')).toBeTruthy();
    expect(screen.queryByText('Add a separate 1.5 lb at Costco')).toBeNull();
  });

  it('shows the purchased-other-user add-separate label without combine options', () => {
    renderDialog({
      duplicateState: 'purchased-other-user',
      match: makeMatch({ quantities: [makeEntry({ is_purchased: true })] }),
    });
    expect(screen.getByText('Add a separate 1.5 lb item')).toBeTruthy();
    expect(screen.queryByText(/Combine as/)).toBeNull();
  });

  it('never renders the old Combine as heading', () => {
    renderDialog();
    expect(screen.queryByText('Combine as:')).toBeNull();
  });
});
