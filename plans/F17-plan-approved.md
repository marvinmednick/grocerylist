# Implementation Plan: F17 Item Entry Flow Polish (Approved)

## Files to Modify

- `client/components/SmartAddItem.tsx` —
  1. **Split one-off edit modal actions (#63)** — keep the existing two-button row for master items (`selectedItem?.id` exists): `[Cancel] [Add to List]` with `onSaveEdited`. For one-off items (`!selectedItem?.id`), render `[Cancel] [Add to List] [Save to Master & Add]` in `styles.modalActions`, where:
     - `Add to List` calls new `onOneOffEditAdd()`
     - `Save to Master & Add` keeps current `onSaveEdited()` behavior (create master item, then add)
     - Secondary button styling uses existing `cancelBtn` + `cancelText`.
  2. **Implement `onOneOffEditAdd()` undo-safe one-off add (#63)** — call `addItem` with exact args:
     - `item_id: null`
     - `quantity: editQty`
     - `store_id: editStoreId || null`
     - `category_id: editCategoryId || null`
     Register `pushAction` with `label: \`Added ${itemName}\`` and mutable tracker pattern:
     - `undo`: `await deleteItem(tracker.currentId)`
     - `redo`: re-call add with same args and set `tracker.currentId = result.id`
     Then call `clearAndClose()`.
  3. **Add one-off qty chip + popover flow on create row (#59)** — add state:
     - `oneOffQty` default `'1'`
     - `oneOffQtyPopoverOpen` boolean
     Restructure `createMain` wrapper from `TouchableOpacity` to `View`, move add tap handler to text-only `TouchableOpacity`, and add inline pills under text:
     - `"1"` chip: `testID="one-off-qty-chip-1"`, active when `oneOffQty === '1'`, sets `'1'`
     - `"Other"` chip: `testID="one-off-qty-chip-other"`, active when `oneOffQty !== '1'`, label shows current custom qty when set (otherwise `"Other"`), opens popover on tap
     Render `styles.otherQtyPopover` when open with `TextInput` (`autoFocus`, `returnKeyType="done"`, placeholder `"e.g. 3 lbs"`), set `oneOffQty` on non-empty submit, close popover.
  4. **Wire one-off qty/category/null handling fixes (#59, #65)** — update:
     - `onOneOffAdd()` to send `quantity: oneOffQty` (not hardcoded `'1'`)
     - `onOneOffAdd()` to send `category_id: null`
     - `onEditAdd()` category default to `setEditCategoryId(item.default_category_id || '')`
     - `onSaveEdited()` to send `default_category_id: editCategoryId || null`
     - `clearAndClose()` to reset `oneOffQty = '1'` and `oneOffQtyPopoverOpen = false`
  5. **Ensure:** keep master-item add/edit flows, existing modal layout patterns, store/category selectors, and existing undo behavior untouched except for the explicit new one-off edit path.

- `client/app/(tabs)/index.tsx` —
  1. **Add in-list edit qty chips state and derivation (#60)** — add `editQtyChips: string[]` state. In `openEditModal(item: ListItem)`, compute exactly:
     ```typescript
     const masterDefaultQty = item.master_item?.default_qty ?? null;
     const masterAltQtys = item.master_item?.alternate_qtys ?? [];
     const chips = masterDefaultQty
       ? [masterDefaultQty, ...masterAltQtys]
       : masterAltQtys;
     setEditQtyChips(chips);
     ```
     One-off items (`item.item_id === null`, `master_item` null) naturally produce `[]`.
  2. **Render chip section below Quantity input in edit modal (#60)** — inside modal `ScrollView`, after qty `TextInput`, conditionally render `"Usual Quantities"` section only when `editQtyChips.length > 0`; map chips to `TouchableOpacity` that calls `setEditQty(chip)` and uses existing styles:
     - `styles.tagsContainer`
     - `styles.tag`, `styles.tagActive`, `styles.tagInactive`
     - `styles.tagTextActive`, `styles.tagTextInactive`
  3. **Ensure:** keep edit modal safe-area/scroll behavior, save/cancel handlers, and existing item edit mutation flow unchanged.

- `client/api/list.ts` —
  1. **Expand `useShoppingList` master item join shape (#60)** — change select fragment from:
     - `master_item:items!item_id(short_name)`
     to:
     - `master_item:items!item_id(short_name, default_qty, alternate_qtys)`
  2. **Update `ListItem.master_item` type (#60)** — set to:
     - `master_item?: { short_name: string | null; default_qty: string | null; alternate_qtys: string[] | null } | null;`
  3. **Ensure:** keep existing query key usage, `.is('archived_at', null)` filtering, realtime subscription behavior, and mutation patterns unchanged.

- `client/app/(tabs)/items.tsx` —
  1. **Stop default category preselect for new items (#65)** — in `openModal` new-item branch, change to `setCategoryId('')`.
  2. **Add `"None"` category chip before mapped categories (#65)** — prepend chip with `key="none"`, `onPress={() => setCategoryId('')}`, and active/inactive styles tied to `categoryId === ''`, then render existing category chips unchanged.
  3. **Persist null category on save (#65)** — in `handleSave`, set `default_category_id: categoryId || null`.
  4. **Ensure:** keep existing edit-mode prefill behavior, item save flow, and list-row display logic (including `"Uncategorized"` fallback) unchanged.

- `client/components/__tests__/SmartAddItem-test.tsx` —
  1. **Add #63 coverage (one-off edit actions)** —
     - one-off edit modal shows `Cancel`, `Add to List`, `Save to Master & Add`
     - one-off `Add to List` sends `item_id: null` and does not call `createMasterItem`
     - one-off `Save to Master & Add` calls `createMasterItem` then `addItem` with non-null `item_id`
     - master-item edit modal still shows only `Cancel` + `Add to List`
  2. **Add #59 coverage (one-off qty chips/popover)** — use `testID` selectors to disambiguate one-off chips from master-item chips when both rows are visible:
     - one-off row shows chips via `getByTestId('one-off-qty-chip-1')` and `getByTestId('one-off-qty-chip-other')`
     - tapping `one-off-qty-chip-other`, entering `'3 lbs'`, pressing Return, then tapping "Add "X" (One-time)" makes `addItem` send `quantity: '3 lbs'`
     - default quick-add (no custom chip selected) sends `quantity: '1'`
  3. **Add #65 coverage (null categories)** —
     - one-off quick-add sends `category_id: null`
     - one-off edit modal `Add to List` sends `category_id: null` when category unset
     - opening one-off edit path does not imply category selection (assert via resulting null category payload)
  4. **Ensure:** extend existing tests/mocks; do not rewrite unrelated SmartAddItem test coverage.

- `client/app/(tabs)/__tests__/index-interactions-test.tsx` —
  1. **Add #60 qty-chip rendering coverage** —
     - master item with `master_item: { short_name: null, default_qty: '1 gal', alternate_qtys: ['2 gal'] }` shows `"Usual Quantities"` with both chips
     - tapping a chip updates qty `TextInput` value
     - one-off item (`item_id: null`, `master_item: null`) shows no `"Usual Quantities"` section
  2. **Ensure:** keep existing interaction tests and list-screen wrappers/providers unchanged.

- `client/app/(tabs)/__tests__/items-test.tsx` —
  1. **Add #65 category-none behavior coverage** —
     - `"None"` chip appears first/visible in category picker
     - `"None"` chip is active by default for new item modal
     - saving with `"None"` selected passes `default_category_id: null` to `createMasterItem`
     - tapping real category chip deactivates `"None"`
  2. **Ensure:** keep existing Items screen tests and existing metadata/create/update mocks intact, only extending assertions for category defaults/chip state.

## New Files

None.

## Patterns Applying

- Realtime Mutation Tracking: No (new logic calls existing `useAddToList`, which already wraps `list_items` writes with local mutation tracking).
- Household Guard: No (no new insert mutations are introduced in API hooks; household guard behavior remains in existing hook implementations).
- Undo Registration: Yes (new `onOneOffEditAdd()` must register `pushAction` with mutable ID tracker for redo-created row IDs).

## Ambiguities / Questions

- None.
