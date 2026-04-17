import type { ListItem, QuantityEntry } from '@/api/list';

let nextId = 1;

const generateId = (prefix: string) => `${prefix}-${nextId++}`;

export const makeQuantityEntry = (overrides: Partial<QuantityEntry> = {}): QuantityEntry => ({
  id: overrides.id ?? generateId('entry'),
  list_item_id: overrides.list_item_id ?? generateId('parent'),
  quantity: overrides.quantity ?? '1',
  quantity_parsed: overrides.quantity_parsed ?? null,
  is_purchased: overrides.is_purchased ?? false,
  purchased_at: overrides.purchased_at ?? null,
  purchased_by: overrides.purchased_by ?? null,
  trip_id: overrides.trip_id ?? null,
  archived_at: overrides.archived_at ?? null,
  added_at: overrides.added_at ?? new Date().toISOString(),
  added_by: overrides.added_by ?? null,
  household_id: overrides.household_id ?? 'household-1',
});

export const makeListItem = (overrides: Partial<ListItem> = {}): ListItem => {
  const parentId = overrides.id ?? generateId('parent');
  const quantities = overrides.quantities
    ?? [makeQuantityEntry({ list_item_id: parentId })];

  return {
    id: parentId,
    name: overrides.name ?? 'Milk',
    item_id: overrides.item_id ?? 'master-item-1',
    category_id: overrides.category_id ?? null,
    store_id: overrides.store_id ?? null,
    warnings: overrides.warnings ?? [],
    match_metadata: overrides.match_metadata ?? null,
    added_at: overrides.added_at ?? new Date().toISOString(),
    added_by: overrides.added_by ?? null,
    archived_at: overrides.archived_at ?? null,
    store: overrides.store,
    category: overrides.category,
    master_item: overrides.master_item ?? null,
    quantities,
  };
};

