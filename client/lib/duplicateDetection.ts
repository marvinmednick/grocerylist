import type { ListItem } from '@/api/list';

export type DuplicateMatch = ListItem;

export type DuplicateState =
  | 'active-same-store'
  | 'active-different-store'
  | 'purchased-same-trip'
  | 'purchased-other-user';

function normalizeOneOffName(name: string): string {
  return name.trim().toLowerCase();
}

function isParentActiveForDuplicate(item: ListItem): boolean {
  if (item.archived_at) {
    return false;
  }

  return item.quantities.some((entry) => !entry.archived_at);
}

export function findDuplicate(itemId: string | null, itemName: string, listItems: ListItem[]): DuplicateMatch | null {
  if (itemId) {
    return listItems.find((item) => isParentActiveForDuplicate(item) && item.item_id === itemId) ?? null;
  }

  const normalizedName = normalizeOneOffName(itemName);
  if (!normalizedName) {
    return null;
  }

  return (
    listItems.find(
      (item) =>
        isParentActiveForDuplicate(item) &&
        item.item_id === null &&
        normalizeOneOffName(item.name) === normalizedName
    ) ?? null
  );
}

export function classifyDuplicateState(
  match: ListItem,
  incomingStoreId: string | null,
  currentUserId: string | null | undefined
): DuplicateState {
  const activeEntry = match.quantities.find((entry) => !entry.archived_at && !entry.is_purchased);
  if (activeEntry) {
    return activeEntry.store_id === incomingStoreId ? 'active-same-store' : 'active-different-store';
  }

  const purchasedEntries = match.quantities.filter((entry) => !entry.archived_at && entry.is_purchased);
  const hasOtherUserPurchase = purchasedEntries.some(
    (entry) => !!entry.purchased_by && !!currentUserId && entry.purchased_by !== currentUserId
  );

  return hasOtherUserPurchase ? 'purchased-other-user' : 'purchased-same-trip';
}
