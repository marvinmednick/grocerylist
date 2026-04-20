# Implementation Plan: F104 Per-Entry Store ID

## Files to Modify

- `supabase/full_schema.sql` —
  1. **Reflect the schema move from parent to entry** — add `store_id UUID REFERENCES stores(id) ON DELETE SET NULL` to the `list_item_quantities` table definition immediately after `quantity_parsed`, and annotate `list_items.store_id` inline as `-- deprecated: always NULL as of F104; store lives on list_item_quantities`.
  2. **Ensure:** Keep the existing `list_items.store_id` column, foreign key, and surrounding table order intact; do not change RLS, indexes other than the spec-defined new entry index in the migration, or any unrelated schema blocks.

- `client/api/list.ts` —
  1. **Move the store join to quantity entries in `useShoppingList`** — replace the parent select with the spec-defined nested query:
     `.select(\`
       *,
       category:categories!category_id(name, sort_order),
       master_item:items!item_id(short_name, default_qty, alternate_qtys),
       quantities:list_item_quantities!list_item_id(*, store:stores!store_id(name, color_code))
     \`)`
     and remove `store:stores!store_id(name, color_code)` from the top-level parent select.
  2. **Update exported interfaces exactly as specced** — add `store_id: string | null` and optional `store?: { name: string; color_code: string }` to `QuantityEntry`; keep `ListItem.store_id` but mark it deprecated in-place and remove `store?: { name: string; color_code: string }` from `ListItem`.
  3. **Route add flows to entry-level store data** — in `useAddToList`, remove `store_id` from the `list_items` insert object and add `store_id: newItem.store_id ?? null` to the `list_item_quantities` insert object; keep `ListItemInsert.store_id` so callers still pass a store through the same API.
  4. **Extend entry-level hooks for per-entry store edits** — add `storeId: string | null` to `useAddQuantityEntry` args and insert `store_id: storeId`; add `store_id?: string | null` to `useUpdateQuantityEntry`; remove `store_id` from `useUpdateListItemFields` so it accepts only `name` and `category_id`.
  5. **Change `useEndTrip` to filter entries directly** — replace the parent-ID lookup with the spec-defined `list_item_quantities` update chain:
     `supabase.from('list_item_quantities').update({ archived_at: new Date().toISOString(), trip_id: trip.id }).eq('is_purchased', true).is('archived_at', null)`
     then conditionally add `.eq('store_id', store_id)` and `.eq('purchased_by', targetUserId)` before `.select()`.
  6. **Ensure:** Preserve realtime mutation tracking wrappers, existing household guards on inserts, `['shopping_list']` invalidation behavior, archived-entry filtering, and all non-store list behavior.

- `client/api/trips.ts` —
  1. **Join stores from entries in `useTripItems`** — replace the parent-level select with:
     `.select(\`
       id,
       name,
       quantities:list_item_quantities!list_item_id(*, store:stores!store_id(name, color_code))
     \`)`
     while keeping `.not('archived_at', 'is', null)`, `.eq('quantities.trip_id', tripId)`, and `.order('name', { ascending: true })`.
  2. **Build `TripItem` from entry fields** — when flattening, set `store_id: entry.store_id` and `store: entry.store`, and stop relying on `parentRecord.store_id` / `parentRecord.store`.
  3. **Ensure:** Keep trip history query keys, trip item ordering, and quantity/name mapping unchanged.

- `client/lib/duplicateDetection.ts` —
  1. **Compare incoming store against the active entry** — in `classifyDuplicateState`, keep the current active-entry lookup but return `activeEntry.store_id === incomingStoreId ? 'active-same-store' : 'active-different-store'`.
  2. **Ensure:** Leave one-off/master duplicate matching and purchased-state classification logic unchanged outside the store source swap.

- `client/app/(tabs)/index.tsx` —
  1. **Regroup flat list data by entry store** — change `FlatListItem` header rows to `{ type: 'header'; id; title; storeId; entries: Array<{ parent: ListItem; entry: QuantityEntry }> }`, build groups from `parent.quantities`, and use `entry.store_id || 'other'` / `entry.store?.name || 'Other'` / `entry.store?.color_code ?? null` when producing headers and items.
  2. **Update store-aware header behavior** — change the `hasPurchased` header check from `item.parents.some(...)` to `item.entries.some(({ entry }) => entry.is_purchased)` so section actions operate on grouped entries.
  3. **Load and save the edit modal store at the entry level** — in `openEditModal`, set `editStoreId(entry.store_id || '')`; in `handleSaveEdit`, split parent and entry snapshots into:
     `parentSnapshot = { name: editingParent.name, category_id: editingParent.category_id }`,
     `parentUpdates = { name: editName, category_id: editingParent.category_id }`,
     `entrySnapshot = { quantity: editingEntry.quantity, store_id: editingEntry.store_id }`,
     `entryUpdates = { quantity: editQty || null, store_id: editStoreId || null }`,
     then call `updateListItemFields` only for parent changes and `updateQuantityEntry` for entry changes; mirror that split in undo/redo.
  4. **Move delete/undo reconstruction to the entry store** — when `handleDelete` rebuilds a removed row via `addItem`, pass `store_id: entryToDelete.store_id` instead of `parentToDelete.store_id`.
  5. **Move drag-and-drop store edits to the entry hook** — in `onDragEnd`, compare against `draggedEntry.store_id`, update with `await updateQuantityEntry({ id: entryId, store_id: newStoreId === 'other' ? null : newStoreId })`, and register undo/redo with the same entry-level store source.
  6. **Filter end-trip candidates by `entry.store_id`** — in `handleEndTrip`, use `if (storeId === 'other') return !entry.store_id; return entry.store_id === storeId;` when scoping purchased entries before the confirmation flow.
  7. **Ensure:** Keep screen-level undo registration, multi-user trip flow, modal safe-area/scroll behavior, optimistic drag UI syncing via `localFlatData`, and all non-store editing fields unchanged.

- `client/components/SmartAddItem.tsx` —
  1. **Switch duplicate combine store moves to entry updates** — in `handleDuplicateCombine`, read `const previousStoreId = targetEntry.store_id`, compute `shouldMoveStore` from that value, and replace every `updateListItemFields({ id: duplicateMatch.id, store_id: ... })` call with `updateQuantityEntry({ id: targetEntry.id, store_id: ... })`.
  2. **Pass `storeId` when adding a second same-store entry** — in `handleDuplicateAddNew`, call `addQuantityEntry({ listItemId: duplicateMatch.id, quantity: normalizedQty, quantityParsed: pendingAdd.quantityParsed, storeId: pendingAdd.storeId })` and carry the same `storeId` through redo.
  3. **Drop the now-unused parent-store mutation hook if F104 removes the last call site** — remove the `useUpdateListItemFields` import and hook wiring only if no other SmartAddItem path still needs it after the combine change.
  4. **Ensure:** Preserve existing duplicate dialog branching, quantity combine/custom logic, mutable tracker redo handling, quick-accept behavior, and all non-store add flows.

- `client/lib/__tests__/duplicateDetection-test.ts` —
  1. **Update test fixtures for per-entry stores** — add `store_id` to `makeEntry`, stop relying on parent `store_id` for active duplicate classification, and keep enough parent data to prove entry values win.
  2. **Add the three F104 duplicate-state cases** — cover matching `entry.store_id`, differing `entry.store_id`, and the parent-vs-entry precedence case where parent `store_id = 'store-A'`, active entry `store_id = 'store-B'`, and incoming `'store-B'` still returns `'active-same-store'`.
  3. **Ensure:** Keep the existing duplicate lookup and purchased classification tests intact.

- `BACKLOG.md` —
  1. **Append deferred follow-ups under `### From F104`** — add the two spec-defined deferred items: formal `list_items.store_id` drop in a future cleanup migration, and warning recomputation / relocation from parent rows to entry rows.
  2. **Ensure:** Do not rewrite unrelated backlog sections or reorder existing items.

## New Files

- `supabase/migrations/20250101000020_f104_per_entry_store_id.sql` — add the exact migration from the spec:
  `ALTER TABLE list_item_quantities ADD COLUMN store_id UUID REFERENCES stores(id) ON DELETE SET NULL;`
  `CREATE INDEX list_item_quantities_store_idx ON list_item_quantities(store_id);`
  copy parent `store_id` values into entries with the provided `UPDATE ... FROM list_items li` statement, then `UPDATE list_items SET store_id = NULL;`, all wrapped in `BEGIN;` / `COMMIT;`.

- `client/api/__tests__/list-f104-test.tsx` — add focused hook tests for the F104 API changes.
  Tests to include:
  - `it('useAddToList stores store_id on entry, not parent')`
  - `it('useAddToList with null store_id stores null on entry')`
  - `it('useAddQuantityEntry stores store_id on entry')`
  - `it('useUpdateQuantityEntry accepts store_id update')`
  - `it('useUpdateListItemFields does not accept store_id')`
  - `it('useEndTrip with store_id filters entries directly by store_id, not via parent IDs')`
  - `it('useEndTrip without store_id archives all purchased entries across all stores')`
  - `it('useAddQuantityEntry throws when householdId is null')`
  Mocks required:
  - `@/lib/household` for `householdId`
  - `@/lib/supabase` for `auth.getUser`, `auth.getSession`, `from`, and `rpc`
  - `@tanstack/react-query` for `useMutation`, `useQuery`, and `useQueryClient`
  - query/mutation chain mocks for `list_items`, `list_item_quantities`, and `shopping_trips`
  Type coverage:
  - use a compile-time assertion pattern (for example `// @ts-expect-error`) to confirm `useUpdateListItemFields` no longer accepts `store_id`.

- `client/components/__tests__/SmartAddItem-f104-test.tsx` — add focused SmartAddItem coverage for the per-entry store behavior.
  Tests to include:
  - `it('handleDuplicateAddNew same-store passes storeId to addQuantityEntry')`
  - `it('handleDuplicateCombine moves store via updateQuantityEntry not updateListItemFields')`
  Mocks required:
  - `@/api/items` (`useAllItems`, `useCreateMasterItem`, `useMasterItemNames`)
  - `@/api/list` (`useAddQuantityEntry`, `useAddToList`, `useDeleteListItem`, `useUpdateQuantityEntry`, and, for the negative assertion, `useUpdateListItemFields` if still imported)
  - `@/api/metadata`, `@/api/aliases`, `@/api/undoContext`, `@/api/profile`, `@/api/vocabulary`
  - `react-native-safe-area-context` inset mock
  Interaction coverage:
  - drive the duplicate dialog through the same-store Add New path and assert `storeId: 'store-1'`
  - drive the active-different-store Combine path and assert `updateQuantityEntry` receives `store_id` while `updateListItemFields` is not called with `store_id`

## Patterns Applying
- Realtime Mutation Tracking: Yes — the touched hooks still write `list_item_quantities`, so `incrementLocalMutation()` / `decrementLocalMutation()` must remain around `useAddToList`, `useAddQuantityEntry`, `useUpdateQuantityEntry`, and `useEndTrip`.
- Household Guard: Yes — `useAddToList` and `useAddQuantityEntry` still insert into household-scoped tables and must keep the early `if (!householdId) throw new Error('No household ID found')`; the migration itself does not need a guard.
- Undo Registration: Yes — shopping-list edit, delete, drag-to-reorder, end-trip, and SmartAdd duplicate flows already register undo/redo, and every store-related closure must switch from parent `store_id` sources/calls to entry `store_id` sources/calls.

## Ambiguities / Questions
- None.
