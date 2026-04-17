# Implementation Plan (Approved): F103 List Item / Quantity Model Refactor

> Corrections applied vs `plans/F103-plan.md`:
> 1. Test file extension `.tsx` for `list-f103-test` (JSX wrapper required).
> 2. Dedup scope explicitly limited to `archived_at IS NULL AND item_id IS NOT NULL`.
> 3. Keeper-selection rule codified: earliest-`added_at`, ties broken by `id ASC`.
> 4. `useEndTrip` empty-parents short-circuit: skip the entry UPDATE and return `{ trip, items: [] }` when the parent-ID list is empty under a store filter.
> 5. RLS policy name specified: `"Household members can manage list_item_quantities"`.
> 6. New test helper `client/api/__tests__/_helpers/listItemMock.ts` added to reduce churn across 8 updated test files.

## Files to Modify

- `supabase/full_schema.sql` —
  1. **Reflect post-migration schema exactly** — remove `quantity`, `quantity_parsed`, `is_purchased`, `purchased_at`, `purchased_by`, and `trip_id` from `list_items`; add full `list_item_quantities` table definition with columns from the spec.
  2. **Add indexes/RLS/realtime/function definitions** — include `list_item_quantities_list_item_idx`, `list_item_quantities_household_idx`, `list_item_quantities_active_idx`, RLS policy named **`"Household members can manage list_item_quantities"`** (`household_id = get_my_household_id()` in both USING and WITH CHECK), publication membership, and `archive_empty_list_items()` as `SECURITY DEFINER`.
  3. **Ensure:** Keep existing unrelated schema/RLS/function definitions unchanged, and do not introduce the deferred unique index on `(item_id, store_id, household_id)`.

- `client/api/list.ts` —
  1. **Refactor list types to parent + entry model** — add `QuantityEntry` interface and update `ListItem` to include `quantities: QuantityEntry[]`; remove parent-level `quantity`, `is_purchased`, `purchased_by`, and `trip_id` fields. Keep `archived_at` on parent.
  2. **Update `useShoppingList` query shape and post-processing** — use:
     `.select(`
     `  *,`
     `  store:stores!store_id(name, color_code),`
     `  category:categories!category_id(name, sort_order),`
     `  master_item:items!item_id(short_name, default_qty, alternate_qtys),`
     `  quantities:list_item_quantities!list_item_id(*)`
     `)`
     with `.is('archived_at', null)` and `.order('added_at', { ascending: false })`; then filter nested entries client-side via `parent.quantities = parent.quantities.filter(q => !q.archived_at)`.
  3. **Expand realtime subscription handling to both tables** — subscribe to `public:list_items` and `public:list_item_quantities`; both invalidate `['shopping_list']` and use existing local-mutation suppression; list-item events keep `payload.new.name`/`payload.old.name`; child-table events resolve item name from `queryClient.getQueryData<ListItem[]>(['shopping_list'])` by `list_item_id`, passing `undefined` when not found.
  4. **Retarget mutation hooks to correct table/entity boundaries** —
     - `useTogglePurchased`: update `list_item_quantities` by entry `id` (accepts `purchased_by_override` as today); optimistic update walks nested `quantities` to flip only the matching entry.
     - `useAddToList`: sequential insert (`list_items` then `list_item_quantities`), include `household_id` guard, rollback orphan parent on step-2 failure, return `{ parent, entry }`. Wrap both inserts in a single `incrementLocalMutation` / `decrementLocalMutation` pair (outer try/finally).
     - split `useUpdateListItem` into `useUpdateListItemFields` (parent fields: `name`, `store_id`, `category_id`) and `useUpdateQuantityEntry` (entry field: `quantity`, optionally `quantity_parsed`).
     - `useDeleteListItem`: accept `{ entryId }`, count non-archived siblings, delete entry, delete parent when sibling count is zero, return `{ entryId, listItemId, parentDeleted }`.
     - `useEndTrip`: create trip, fetch parent IDs matching store scope, **if parent-ID list is empty under a store filter, short-circuit and return `{ trip, items: [] }` without issuing the entry UPDATE**; otherwise archive matching entries in `list_item_quantities` (scoped by parent ids + `is_purchased = true` + `archived_at IS NULL` + optional `purchased_by`), then call `supabase.rpc('archive_empty_list_items')`.
     - `useRevertArchival`: fetch distinct parent IDs from entries linked to the trip, clear entry `archived_at` + `trip_id` for the trip, clear parent `archived_at` for those parent IDs, then delete trip.
  5. **Preserve required mutation patterns** — wrap every write touching `list_items` or `list_item_quantities` with one `incrementLocalMutation`/`decrementLocalMutation` pair per mutation body; keep existing query-key invalidation behavior (`['shopping_list']` and trip keys where currently applied).
  6. **Ensure:** Do not change undo context APIs, do not introduce new React Query keys, and keep caller-facing `ListItemInsert` input shape unchanged.

- `client/app/(tabs)/index.tsx` —
  1. **Change flat row model to parent+entry rows** — update `FlatListItem` to `{ type: 'item'; id: string; data: { parent: ListItem; entry: QuantityEntry } }` and build `flatData` by store-grouped parents expanded across `parent.quantities`; use `entry.id` for row keys.
  2. **Retarget row actions to entry vs parent mutations** —
     - checkbox toggle uses `togglePurchased({ id: entry.id, is_purchased: !entry.is_purchased })` with pre-mutation snapshot of `entry.purchased_by` for undo (pass via `purchased_by_override` in the undo call).
     - delete uses `deleteItem({ entryId: entry.id })` and handles `parentDeleted` on undo/redo with tracker ids (`{ entryId, listItemId }`). When `parentDeleted` is true, undo re-creates the parent then the entry via `addItem({...})`.
     - drag uses `updateListItemFields({ id: parent.id, store_id: newStoreId })` and snapshots original `parent.store_id`; sibling entries follow on refetch.
  3. **Split edit-save behavior and undo composition** — `openEditModal(parent, entry)`; on save, call `updateListItemFields` only if parent fields changed and `updateQuantityEntry` only if quantity changed; when both changed, push **one** combined undo action that restores parent first then entry (redo re-applies in the same order).
  4. **Update end-trip selection/count logic to entry-level purchase state** — move checks/maps/filters from parent fields to `listItems.flatMap(p => p.quantities)` while preserving parent store scoping (entries don't carry `store_id`; look up via the entry's parent).
  5. **Preserve rendered behavior parity** — keep warning badge display, secondary text behavior, check-color semantics, and multi-user identity rendering visually unchanged while sourcing purchased/quantity fields from `entry`.
  6. **Ensure:** Do not alter UI styling/component hierarchy beyond data-path refactors needed for the new model.

- `client/api/trips.ts` —
  1. **Migrate trip-history queries off parent per-quantity fields** — replace reads of `list_items.trip_id`, `list_items.is_purchased`, `list_items.purchased_at`, `list_items.purchased_by`, and `list_items.quantity` with nested `quantities:list_item_quantities!list_item_id(*)` usage.
  2. **Apply new archived trip query shape** — use archived parent filter plus child-trip filter (`.not('archived_at', 'is', null)` and `.eq('quantities.trip_id', tripId)`), then aggregate/display data from entries rather than removed parent columns.
  3. **Ensure:** Keep existing trip query keys/invalidation contracts and response semantics expected by history UI.

- `client/app/(tabs)/history.tsx` —
  1. **Update rendering/derived data to nested entry fields** — replace any direct usage of removed parent fields (quantity, purchase/timing/user metadata, trip linkage) with values sourced from relevant `quantities` entries.
  2. **Maintain archived-trip presentation parity** — preserve existing visual behavior and grouping while adapting selectors/transforms to the parent+entries payload.
  3. **Ensure:** No UI redesign; only data-access migration required for F103 compatibility.

- `client/api/__tests__/list-test.ts` —
  1. **Migrate `ListItem` fixtures to new shape** — remove parent per-quantity fields and add `quantities: [...]` entries in all mocks/assertions. Use the new `makeListItem` helper.
  2. **Adjust expectations for split hooks and table targets** — update assertions where mutations now write `list_item_quantities` or split across new hooks.
  3. **Ensure:** Keep original non-F103 test intent and coverage unchanged beyond shape/table migration.

- `client/api/__tests__/list-f2-test.tsx` —
  1. **Update shopping list mock rows to parent+entries shape** — convert purchased/quantity scenarios to entry-level fixtures via `makeListItem`.
  2. **Ensure:** Preserve F2 behavior assertions while adapting ids/fields to entry-level mutation targets.

- `client/api/__tests__/list-toggle-optimistic-test.tsx` —
  1. **Retarget optimistic-cache assertions to nested entry updates** — verify only the targeted entry in `parent.quantities` changes and rollback restores prior nested state.
  2. **Ensure:** Keep optimistic lifecycle checks (`cancelQueries`, rollback, invalidate) on `['shopping_list']` intact.

- `client/app/(tabs)/__tests__/index-display-test.tsx` —
  1. **Convert list fixtures and display expectations to row-per-entry model** — parent display fields remain shared; purchased/quantity indicators source from each entry.
  2. **Ensure:** Preserve existing display contract coverage and avoid introducing visual/spec changes.

- `client/app/(tabs)/__tests__/index-f2-test.tsx` —
  1. **Migrate item fixtures and action expectations to entry-targeted ids** — update toggle/delete/edit assertions to entry ids where applicable.
  2. **Ensure:** Keep F2 scenario intent unchanged.

- `client/app/(tabs)/__tests__/index-interactions-test.tsx` —
  1. **Refactor interaction fixtures to parent+entry shape** — include multi-entry cases where interactions depend on row identity.
  2. **Update interaction assertions for split mutations** — verify parent-field vs entry-field mutation hooks are called in the correct scenarios.
  3. **Ensure:** Keep all existing interaction behavior checks (undo flows, drag, modal save behavior) aligned with current UX.

- `client/app/(tabs)/__tests__/history-test.tsx` —
  1. **Update archived-row fixtures and assertions** — consume entry-level trip/purchase/quantity data while preserving expected history output.
  2. **Ensure:** No broadened scope beyond data-shape migration.

- `client/components/__tests__/MultiTripModal-test.tsx` —
  1. **Migrate list-item-like test structures to nested entries** — adjust fixture helpers and expectations where purchased/trip metadata is read.
  2. **Ensure:** Preserve component behavior assertions; only fixture/data-path updates.

## New Files

- `supabase/migrations/20250101000019_f103_list_item_quantities.sql` — perform the migration in one transaction:
  1. Create `list_item_quantities` table and the three indexes (`list_item_quantities_list_item_idx`, `list_item_quantities_household_idx`, `list_item_quantities_active_idx`).
  2. Enable RLS and create policy `"Household members can manage list_item_quantities"` (`household_id = get_my_household_id()` in both USING and WITH CHECK).
  3. `ALTER PUBLICATION supabase_realtime ADD TABLE list_item_quantities`.
  4. **Dedup sweep (scoped):** applies only to rows where `archived_at IS NULL AND item_id IS NOT NULL` (i.e., **active master-item rows only** — one-offs and archived rows are NOT deduped). For each `(item_id, store_id, household_id)` group with >1 row, the **keeper is the earliest-`added_at` row, with ties broken by `id ASC`**. Insert a `list_item_quantities` entry for every row in the group (keeper + duplicates) carrying their per-quantity fields; then DELETE the non-keeper parent rows.
  5. **Split:** for every remaining `list_items` row (active or archived), insert one `list_item_quantities` row carrying its per-quantity fields.
  6. `ALTER TABLE list_items DROP COLUMN quantity, quantity_parsed, is_purchased, purchased_at, purchased_by, trip_id`.
  7. Create `archive_empty_list_items()` `SECURITY DEFINER` function — single SQL UPDATE of `list_items SET archived_at = NOW() WHERE archived_at IS NULL AND NOT EXISTS (SELECT 1 FROM list_item_quantities q WHERE q.list_item_id = list_items.id AND q.archived_at IS NULL)`.

- `client/api/__tests__/_helpers/listItemMock.ts` — new test utility. Exports `makeListItem(overrides)` that returns a `ListItem` with sensible defaults and `quantities: [makeQuantityEntry()]` (single default entry). Also exports `makeQuantityEntry(overrides)` returning a `QuantityEntry` with `is_purchased: false`, `archived_at: null`, and a generated id. Used across all 8 migrated test files to reduce churn.

- `client/api/__tests__/list-f103-test.tsx` — **`.tsx` extension** because tests use `renderHook` with a `QueryClientProvider`/`UndoProvider`/`HouseholdProvider` wrapper (JSX). Spec-defined tests:
  1. optimistic nested-entry cache update for `useTogglePurchased`
  2. rollback on toggle error
  3. `useAddToList` parent-then-entry + parent rollback on entry insert failure
  4. household guard rejection for `useAddToList`
  5. `useDeleteListItem` keeps parent when siblings remain
  6. `useDeleteListItem` deletes parent when no siblings remain
  7. `useEndTrip` archives entries and calls `archive_empty_list_items`
  8. `useRevertArchival` clears entry and parent archival state then deletes trip
  9. mutation counter wraps all six new/changed mutations
  10. realtime subscriptions created for both tables
  11. child-table toast resolves parent name from cache
  12. child-table toast falls back to `undefined` name when parent missing
  Required mocks: Supabase query chains for `list_items`/`list_item_quantities`/`shopping_trips`/`rpc`, React Query cache client, household context, auth user, and remote-change callback plumbing.

- `client/app/(tabs)/__tests__/index-f103-test.tsx` — add spec-defined screen tests:
  1. renders one row per entry for a parent
  2. toggling q2 checkbox targets q2 only
  3. name-only edit uses `useUpdateListItemFields`; quantity-only edit uses `useUpdateQuantityEntry`
  4. editing both pushes one undo action and undo runs both inverse mutations in order
  5. drag updates parent store via `useUpdateListItemFields` and does not attempt entry `store_id`
  6. deleting only entry calls `useDeleteListItem` with `entryId` and undo restores parent+entry
  7. end trip passes expected scope to `useEndTrip` from purchased entries
  Required mocks: list API hooks (`useShoppingList`, `useTogglePurchased`, `useUpdateListItemFields`, `useUpdateQuantityEntry`, `useDeleteListItem`, `useEndTrip`, `useAddToList`), undo provider `pushAction`, household/profile context as needed, and drag/list interaction shims used by existing index tests.

## Patterns Applying
- Realtime Mutation Tracking: Yes — F103 adds/changes writes on both `list_items` and `list_item_quantities` (`useAddToList`, `useTogglePurchased`, `useUpdateListItemFields`, `useUpdateQuantityEntry`, `useDeleteListItem`, `useEndTrip`, `useRevertArchival`), all requiring `incrementLocalMutation` / `decrementLocalMutation` wrapping. `useAddToList` uses a single outer pair across both inserts.
- Household Guard: Yes — `useAddToList` now performs a second insert into `list_item_quantities` and must still throw `'No household ID found'` before inserts when `householdId` is null.
- Undo Registration: Yes — shopping-list screen actions remain user-initiated mutations and must register undo with updated targets/snapshots: entry toggle (snapshot `entry.purchased_by`), parent edit (snapshot parent fields), entry quantity edit (snapshot `entry.quantity`), combined edit save (single `pushAction` covering both), delete with tracker ids (`{ entryId, listItemId, parentDeleted }`), drag store move (snapshot `parent.store_id`), and end-trip tracker handling.

## Ambiguities / Questions
- None.
