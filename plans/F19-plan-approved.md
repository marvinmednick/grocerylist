# Implementation Plan: F19 Store Management UI

## Files to Modify

- `supabase/full_schema.sql` —
  1. **Update `shopping_trips.primary_store_id` FK behavior** — change the table definition so `primary_store_id` uses `REFERENCES stores(id) ON DELETE SET NULL` (instead of plain `REFERENCES stores(id)`), matching the migration and allowing store deletion when trips reference that store.
  2. **Ensure:** no unrelated schema/table definitions, constraints, or policies are changed.

- `client/api/metadata.ts` —
  1. **Add `useUpdateStore` mutation export** — implement `mutationFn` with exact payload `{ id, name, color_code }`, enforce `if (!householdId) throw new Error('No household ID found')`, run `supabase.from('stores').update({ name, color_code }).eq('id', id).eq('household_id', householdId).select().single()`, throw on error, return data.
  2. **Add `useDeleteStore` mutation export** — implement delete mutation `supabase.from('stores').delete().eq('id', storeId).eq('household_id', householdId)` with the same household guard and error handling.
  3. **Add `useStoreCascadeInfo(storeId)` query export** — use `queryKey: ['store-cascade', storeId]`; if no `storeId`, return `{ itemPrefsCount: 0, activeListItemsCount: 0 }`; fetch counts in parallel with `Promise.all` using:
     - `supabase.from('item_store_preferences').select('id', { count: 'exact', head: true }).eq('store_id', storeId)`
     - `supabase.from('list_items').select('id', { count: 'exact', head: true }).eq('store_id', storeId).is('archived_at', null)`
     and return counts with nullish fallback to `0`; set `enabled: !!storeId` and `staleTime: 0`.
  4. **Invalidate exact query keys on success** — `useUpdateStore` invalidates `['metadata']`; `useDeleteStore` invalidates both `['metadata']` and `['shopping_list']`.
  5. **Ensure:** existing metadata queries/mutations keep current signatures and behavior; no unrelated query key or API pattern changes.

- `client/components/StoreSelector.tsx` —
  1. **Add store edit entry point in dropdown rows** — add right-side `Pencil` icon button (`testID=edit-store-btn-{storeId}`) inside each row while preserving current row tap-to-select behavior; tapping pencil opens edit modal for that store.
  2. **Add edit modal state + hooks** — add `isEditModalOpen`, `editingStore`, `editStoreName`, `editStoreColor`, `showDeleteConfirm`; wire `useUpdateStore`, `useDeleteStore`, `useStoreCascadeInfo(showDeleteConfirm ? editingStore?.id ?? null : null)`, and `useUndo`.
  3. **Implement modal open/close handlers** — `openEditModal` pre-fills name/color from selected store, resets delete confirm state, closes dropdown, opens modal; `closeEditModal` resets edit/delete state and closes modal.
  4. **Implement save flow with undo** — `handleUpdateStore` trims name, exits on empty/missing store, captures `prev` and `next`, calls `updateStoreMutation.mutateAsync(next)`, then `pushAction` with label `Renamed store to ${next.name}` and undo/redo calling `mutateAsync(prev|next)`, then closes modal.
  5. **Implement delete flow and active-store fallback** — `handleDeleteStore` calls `deleteStoreMutation.mutateAsync(deletedId)`; if deleted store equals `activeStoreId`, call `onStoreChange(remaining[0].id)` or `onStoreChange('')` when none remain; close modal; do not register undo for delete.
  6. **Add inline delete confirmation section inside edit modal** — header uses left `Trash2` red pill, centered title, right close button; tapping trash reveals confirm section below color picker with cascade impact text (uses counts or `Loading...`), `Cancel delete` to hide section, and red `Delete` button to execute deletion.
  7. **Add/adjust styles exactly for new UI pieces** — `editStoreBtn`, `deleteConfirmSection`, `deleteConfirmText`, `deleteConfirmActions`, `cancelDeleteBtn`, `cancelDeleteBtnText`, `deleteBtn`, `deleteBtnText`, `trashPill` with spec-defined values.
  8. **Ensure:** existing create-store modal behavior, dropdown open/close behavior, active-store checkmark rendering, and store selection callback behavior remain unchanged outside the new edit/delete paths.

- `client/app/(tabs)/items.tsx` —
  1. **Add preference store filter state + threshold constant** — add `prefStoreFilterText` state and `STORE_FILTER_THRESHOLD = 6`.
  2. **Add derived filtered store list** — compute `allPrefStores = metadata?.stores ?? []` and `filteredPrefStores` using case-insensitive `includes` against `prefStoreFilterText.toLowerCase()`.
  3. **Reset filter on modal/dropdown close paths** — in `openModal()` set `setPrefStoreFilterText('')` and `setPrefDropdownOpen(false)`; wherever pref dropdown closes (`setPrefDropdownOpen(false)`), also reset filter text.
  4. **Replace pref dropdown menu block** — render filter input (`testID='pref-store-filter-input'`, `autoFocus`, placeholder `Filter stores...`) only when `allPrefStores.length > STORE_FILTER_THRESHOLD`; render options from `filteredPrefStores`; on selection set store id, close dropdown, and clear filter; render `No stores match` when empty.
  5. **Add styles for filter UX** — add `storeFilterInput` and `noStoresText` style entries with exact spec values.
  6. **Ensure:** existing item edit modal save/cancel flows, preferred-store selection semantics, and unrelated item form fields remain untouched.

- `client/components/__tests__/StoreSelector-test.tsx` —
  1. **Extend tests for edit icon rendering** — assert each store row exposes `testID=edit-store-btn-{storeId}` when dropdown is open.
  2. **Add edit modal open behavior tests** — pressing edit button opens modal, shows current store name pre-filled, and closes dropdown.
  3. **Add update flow tests** — changing name + Save calls `useUpdateStore.mutateAsync` with updated payload, closes modal, and calls `pushAction` with label containing new name.
  4. **Add delete confirm tests** — Trash2 reveals confirm section, cascade counts render after load, `Cancel delete` hides section, `Delete` calls `useDeleteStore.mutateAsync` with store id, and modal closes.
  5. **Add active-store fallback tests** — deleting active store switches to first remaining store id; deleting only store calls `onStoreChange('')`.
  6. **Ensure:** existing store selector tests for current behaviors remain valid and are only updated where UI structure changes require it.

## New Files

- `supabase/migrations/20250101000013_f19_store_management.sql` — apply FK fix exactly:
  - `ALTER TABLE shopping_trips DROP CONSTRAINT IF EXISTS shopping_trips_primary_store_id_fkey;`
  - `ALTER TABLE shopping_trips ADD CONSTRAINT shopping_trips_primary_store_id_fkey FOREIGN KEY (primary_store_id) REFERENCES stores(id) ON DELETE SET NULL;`

- `client/api/__tests__/metadata-store-mutations-test.ts` — test new metadata hooks:
  - `useUpdateStore`: updates `name`/`color_code` with `id` + `household_id` filters, throws on null household, invalidates `['metadata']`.
  - `useDeleteStore`: deletes by store id with household filter, throws on null household, invalidates `['metadata']` and `['shopping_list']`.
  - `useStoreCascadeInfo`: returns both counts from parallel queries, returns zeros when storeId is null/disabled, validates `staleTime: 0` behavior.
  - Include required mocks for Supabase chain responses, household context (`householdId` present/null), and query client invalidation assertions.

- `client/app/(tabs)/__tests__/items-store-filter-test.tsx` — test pref dropdown filter behavior:
  - No filter input with 6 stores.
  - Filter input appears with 7 stores.
  - Case-insensitive filtering (`"saf"`), clear filter restores all options, empty result shows `No stores match`.
  - Selecting store closes dropdown and resets filter text.
  - Include required render wrapper providers (`QueryClientProvider`, `UndoProvider`, `HouseholdProvider`) and metadata mocks to control store counts.

## Patterns Applying
- Realtime Mutation Tracking: No — F19 adds mutations in `client/api/metadata.ts` (`stores` table), not `api/list.ts` `list_items` mutations.
- Household Guard: Yes — `useUpdateStore` and `useDeleteStore` are household-scoped writes and must throw `No household ID found` when `householdId` is null, and filter with `.eq('household_id', householdId)`.
- Undo Registration: Yes — store rename/recolor in `StoreSelector` must register `pushAction` after successful update; store delete intentionally does not register undo per spec.
