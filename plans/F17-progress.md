## Progress Log

### Files
- ✅ `client/components/SmartAddItem.tsx` — Added one-off qty chips/popover, split one-off edit modal actions, implemented one-off edit add with undo tracker, and wired null-category/qty reset handling per plan.
- ✅ `client/app/(tabs)/index.tsx` — Added `editQtyChips` derivation in `openEditModal` and rendered conditional “Usual Quantities” chips under edit quantity input.
- ✅ `client/api/list.ts` — Expanded `useShoppingList` master-item join to include `default_qty` and `alternate_qtys`, and updated `ListItem.master_item` typing.
- ✅ `client/app/(tabs)/items.tsx` — Stopped default category preselect for new items, added “None” category chip, saved `default_category_id` as null when unset, and added category chip testIDs for deterministic modal assertions.
- ✅ `client/components/__tests__/SmartAddItem-test.tsx` — Added one-off edit action coverage, one-off qty chip/popover payload checks, and null-category assertions; updated selectors for disambiguated qty chips.
- ✅ `client/app/(tabs)/__tests__/index-interactions-test.tsx` — Added edit-modal usual-qty chip coverage for master-backed items and absence checks for one-off items.
- ✅ `client/app/(tabs)/__tests__/items-test.tsx` — Added category “None” chip behavior tests for new-item defaults, null payload persistence, and active-state toggling using explicit category chip testIDs.

### Issues
- None

### Status
Complete
