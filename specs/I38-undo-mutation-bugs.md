# Issue Fix: #38 Batch — Undo/Mutation System Bugs
<!-- GitHub: #38 | Status: Specced -->
<!-- Closes: #18, #19, #20, #21 -->

**Review Level:** Light

## Overview

Four small bugs in the undo/mutation system, fixed in one pass. All root causes are confirmed. No exported interface changes. No new test files required — add assertions to existing test files where noted.

---

## Bug 1 — End Trip undo uses stale trip_id (closes #18)

### Root Cause

`doEndTrip` in `index.tsx` captures `result.trip.id` at undo-registration time. When the user redoes the End Trip, `endTrip()` creates a **new** trip row with a **new** ID, but the undo closure still holds the original ID. A subsequent undo calls `revertArchival` with the stale ID, which either targets a deleted row or the wrong trip.

Note: `handleEndSelectedTrips` (the multi-user path) already handles this correctly — it reassigns `tripIds` inside the redo closure. Only the single-user `doEndTrip` needs fixing.

### File to Modify

**`client/app/(tabs)/index.tsx`**

1. Locate `doEndTrip` (~line 188). Replace the `pushAction` block with the mutable tracker pattern:

```ts
// BEFORE
const result = await endTrip({ store_id: storeId === 'other' ? undefined : storeId });
if (result?.trip?.id) {
  pushAction({
    label: `Ended trip ${storeName || 'All'}`,
    undo: async () => { await revertArchival({ trip_id: result.trip.id }); },
    redo: async () => { await endTrip({ store_id: storeId === 'other' ? undefined : storeId }); }
  });
}

// AFTER
const result = await endTrip({ store_id: storeId === 'other' ? undefined : storeId });
if (result?.trip?.id) {
  const tripTracker = { currentId: result.trip.id };
  pushAction({
    label: `Ended trip ${storeName || 'All'}`,
    undo: async () => { await revertArchival({ trip_id: tripTracker.currentId }); },
    redo: async () => {
      const r = await endTrip({ store_id: storeId === 'other' ? undefined : storeId });
      if (r?.trip?.id) tripTracker.currentId = r.trip.id;
    }
  });
}
```

### Tests

In **`client/app/(tabs)/__tests__/index-f2-test.tsx`** (or the nearest end-trip test file), add a test case:

- Mock `useEndTrip` to return a trip object with `id: 'trip-1'` on first call and `id: 'trip-2'` on second call
- Trigger end trip → undo → redo → undo
- Assert that the second undo calls `revertArchival` with `trip_id: 'trip-2'` (the new ID), not `trip_id: 'trip-1'`

---

## Bug 2 — useUpdateMasterItem silently ignores item_stores errors (closes #19)

### Root Cause

`useUpdateMasterItem` in `items.ts` awaits the `item_stores` delete and insert calls but discards the returned `{ data, error }` object entirely. If either operation fails (RLS violation, constraint error, network issue), `onSuccess` fires anyway, queries are invalidated, and the UI shows success while store associations are partially or incorrectly written.

### File to Modify

**`client/api/items.ts`**

1. Locate the store sync block inside `useUpdateMasterItem` (~line 147). Destructure and throw on error for both calls:

```ts
// BEFORE
if (store_ids) {
  await supabase.from('item_stores').delete().eq('item_id', id);

  if (store_ids.length > 0) {
    const links = store_ids.map(sid => ({ ... }));
    await supabase.from('item_stores').insert(links);
  }
}

// AFTER
if (store_ids) {
  const { error: deleteError } = await supabase.from('item_stores').delete().eq('item_id', id);
  if (deleteError) throw deleteError;

  if (store_ids.length > 0) {
    const links = store_ids.map(sid => ({ ... }));
    const { error: insertError } = await supabase.from('item_stores').insert(links);
    if (insertError) throw insertError;
  }
}
```

### Tests

In the nearest existing items mutation test file, add a test case:

- Mock the `item_stores` delete call to return `{ error: { message: 'RLS violation' } }`
- Call `useUpdateMasterItem` with a `store_ids` array
- Assert that the mutation throws / enters error state rather than calling `onSuccess`

---

## Bug 3 — SmartAddItem undo uses stale list_item ID after redo (closes #20)

### Root Cause

Both `onCommitAdd` and `onOneOffAdd` in `SmartAddItem.tsx` capture `result.id` at undo-registration time. When the user redoes the add, `forwardAction()` inserts a **new** row with a **new** ID, but the undo closure still holds the original. A subsequent undo calls `deleteItem` with the stale ID, targeting a row that no longer exists.

### File to Modify

**`client/components/SmartAddItem.tsx`**

Apply the mutable tracker pattern to **both** add paths:

1. **`onCommitAdd`** (~line 71):

```ts
// BEFORE
const result = await forwardAction();
pushAction({
  label: `Added ${name} (${selection.qty})`,
  undo: async () => { await deleteItem(result.id); },
  redo: async () => { await forwardAction(); }
});

// AFTER
const result = await forwardAction();
const tracker = { currentId: result.id };
pushAction({
  label: `Added ${name} (${selection.qty})`,
  undo: async () => { await deleteItem(tracker.currentId); },
  redo: async () => {
    const r = await forwardAction();
    tracker.currentId = r.id;
  }
});
```

2. **`onOneOffAdd`** (~line 98):

```ts
// BEFORE
const result = await forwardAction();
pushAction({
  label: `Added ${name}`,
  undo: async () => { await deleteItem(result.id); },
  redo: async () => { await forwardAction(); }
});

// AFTER
const result = await forwardAction();
const tracker = { currentId: result.id };
pushAction({
  label: `Added ${name}`,
  undo: async () => { await deleteItem(tracker.currentId); },
  redo: async () => {
    const r = await forwardAction();
    tracker.currentId = r.id;
  }
});
```

### Tests

In **`client/components/__tests__/SmartAddItem-test.tsx`**, add test cases for both add paths:

- Mock `useAddToList` to return `{ id: 'item-1' }` on first call and `{ id: 'item-2' }` on second call
- Add item → undo → redo → undo
- Assert that the second undo calls `deleteItem` with `'item-2'` (the new ID), not `'item-1'`
- Write one test for `onCommitAdd` (selecting from the autocomplete dropdown) and one for `onOneOffAdd` (quick-adding an unrecognised query)

---

## Bug 4 — Realtime delete toasts always show undefined item name (closes #21)

### Root Cause

Supabase realtime DELETE events place the deleted record in `payload.old` and set `payload.new` to `{}`. The realtime callback in `list.ts` unconditionally reads `payload.new` for all event types, so `itemName` is always `undefined` on deletes.

### File to Modify

**`client/api/list.ts`**

1. Locate the realtime callback (~line 49). Change the record resolution to branch on event type:

```ts
// BEFORE
const record = (payload.new as Record<string, unknown>) || {};
const itemName = (record.name as string) || undefined;

// AFTER
const record = (payload.eventType === 'DELETE'
  ? payload.old
  : payload.new) as Record<string, unknown> || {};
const itemName = (record.name as string) || undefined;
```

### Tests

No existing test covers the realtime callback directly. If there is an existing test file for `list.ts` realtime behaviour, add a case:

- Simulate a DELETE payload with `payload.old = { name: 'Milk' }` and `payload.new = {}`
- Assert that `onRemoteChange` is called with `('DELETE', 'Milk')`

If no such test file exists, this case is low-risk enough to skip — do not create a new test file just for this.

---

## What the Implementor Should NOT Change

- `handleEndSelectedTrips` in `index.tsx` — already uses the correct mutable tracker pattern; do not touch it
- `handleDelete` in `index.tsx` — already uses the correct tracker pattern; do not touch it
- `useEndTrip` in `api/list.ts` — no changes needed there; the fix is at the call site in `index.tsx`
- Any other undo registrations not listed above

---

## Implementation Commands

```bash
./implement I38
```
