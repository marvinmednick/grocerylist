import { classifyDuplicateState, findDuplicate } from '@/lib/duplicateDetection';
import type { ListItem, QuantityEntry } from '@/api/list';

function makeEntry(overrides: Partial<QuantityEntry> = {}): QuantityEntry {
  return {
    id: 'entry-1',
    list_item_id: 'parent-1',
    quantity: '1',
    quantity_parsed: null,
    store_id: 'store-1',
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

function makeListItem(overrides: Partial<ListItem> = {}): ListItem {
  return {
    id: 'parent-1',
    name: 'Milk',
    item_id: 'item-1',
    category_id: null,
    store_id: 'store-1',
    added_at: '2026-01-01T00:00:00.000Z',
    added_by: null,
    archived_at: null,
    quantities: [makeEntry()],
    ...overrides,
  };
}

describe('duplicateDetection', () => {
  it('returns match when item_id matches active list item', () => {
    const listItems = [makeListItem({ item_id: 'item-1' })];
    expect(findDuplicate('item-1', 'Milk', listItems)?.id).toBe('parent-1');
  });

  it('returns null when item_id is not on the list', () => {
    const listItems = [makeListItem({ item_id: 'item-1' })];
    expect(findDuplicate('item-2', 'Milk', listItems)).toBeNull();
  });

  it('matches one-off by name case-insensitively', () => {
    const listItems = [makeListItem({ item_id: null, name: 'Milk' })];
    expect(findDuplicate(null, 'milk', listItems)?.id).toBe('parent-1');
  });

  it('matches one-off by name with extra whitespace trimmed', () => {
    const listItems = [makeListItem({ item_id: null, name: 'milk' })];
    expect(findDuplicate(null, ' milk ', listItems)?.id).toBe('parent-1');
  });

  it('does not match one-off to master item', () => {
    const listItems = [makeListItem({ item_id: 'item-1', name: 'Milk' })];
    expect(findDuplicate(null, 'milk', listItems)).toBeNull();
  });

  it('returns match for purchased-but-not-archived items', () => {
    const listItems = [makeListItem({ quantities: [makeEntry({ is_purchased: true, archived_at: null })] })];
    expect(findDuplicate('item-1', 'Milk', listItems)?.id).toBe('parent-1');
  });

  it('does not match archived items', () => {
    const listItems = [makeListItem({ archived_at: '2026-01-03T00:00:00.000Z' })];
    expect(findDuplicate('item-1', 'Milk', listItems)).toBeNull();
  });

  it('classifies active same-store correctly', () => {
    const item = makeListItem({ store_id: 'store-parent', quantities: [makeEntry({ is_purchased: false, store_id: 'store-1' })] });
    expect(classifyDuplicateState(item, 'store-1', 'user-1')).toBe('active-same-store');
  });

  it('classifies active different-store correctly', () => {
    const item = makeListItem({ store_id: 'store-parent', quantities: [makeEntry({ is_purchased: false, store_id: 'store-1' })] });
    expect(classifyDuplicateState(item, 'store-2', 'user-1')).toBe('active-different-store');
  });

  it('classifies active same-store using entry store_id even when parent store_id differs', () => {
    const item = makeListItem({
      store_id: 'store-A',
      quantities: [makeEntry({ is_purchased: false, store_id: 'store-B' })],
    });
    expect(classifyDuplicateState(item, 'store-B', 'user-1')).toBe('active-same-store');
  });

  it('classifies purchased same-trip correctly', () => {
    const item = makeListItem({ quantities: [makeEntry({ is_purchased: true, purchased_by: 'user-1' })] });
    expect(classifyDuplicateState(item, 'store-1', 'user-1')).toBe('purchased-same-trip');
  });
});
