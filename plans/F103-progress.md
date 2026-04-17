## Progress Log

### Files
- ✅ `supabase/migrations/20250101000019_f103_list_item_quantities.sql` — Added child table, indexes, RLS policy/realtime publication update, scoped dedup+split migration logic, dropped per-quantity parent columns, and added `archive_empty_list_items()` SECURITY DEFINER function.
- ✅ `supabase/full_schema.sql` — Updated canonical schema to new parent/entry model, added `list_item_quantities` table/indexes/RLS/realtime entry, and included `archive_empty_list_items()` function definition.
- ✅ `client/api/list.ts` — Refactored shopping-list types/query to parent+entries, added dual-table realtime handling, moved toggle/delete/end-trip/revert logic to `list_item_quantities`, split update hooks, and changed add flow to parent+entry with parent rollback on step-2 failure.
- ✅ `client/app/(tabs)/index.tsx` — Migrated list rendering/actions to parent+entry rows, retargeted toggle/edit/delete/drag/end-trip logic to entry vs parent hooks, and preserved existing UI behavior with entry-sourced purchased/quantity state.
- ✅ `client/api/trips.ts` — Reworked trip-item fetch to use nested `quantities:list_item_quantities` with child `trip_id` filtering and flattened entry rows for history consumers.
- ✅ `client/app/(tabs)/history.tsx` — Kept history presentation unchanged while making trip-item row rendering compatible with flattened entry-derived quantity values.
- ✅ `client/api/__tests__/_helpers/listItemMock.ts` — Added shared `makeListItem`/`makeQuantityEntry` fixture helpers with parent+entry defaults for F103 test migrations.
- ✅ `client/api/__tests__/list-toggle-optimistic-test.tsx` — Migrated optimistic toggle assertions to nested entry updates on `parent.quantities` and entry-targeted ids/table expectations.
- ✅ `client/api/__tests__/list-f2-test.tsx` — Updated F2 hook tests for entry-targeted toggles and `useEndTrip`’s new parent-id lookup + child-table archival + RPC path.
- ✅ `client/api/__tests__/list-test.ts` — Updated end-trip unit mocks to new parent-id selection and child-entry archival flow with RPC call support.
- ✅ `client/api/__tests__/list-f103-test.tsx` — Added new F103 API coverage for nested optimistic updates, split add/delete/end/revert mutations, and dual-table realtime behavior.
- ✅ `client/app/(tabs)/__tests__/index-display-test.tsx` — Migrated list fixtures and hook mocks to parent+entry data and split update hooks while preserving display assertions.
- ✅ `client/app/(tabs)/__tests__/index-f2-test.tsx` — Updated F2 screen fixtures/mocks for entry ids and split update hooks, including other-user checkbox test ids.
- ✅ `client/app/(tabs)/__tests__/index-interactions-test.tsx` — Migrated interaction fixtures/test ids to entry-level rows and updated hook mocks to `useUpdateListItemFields` + `useUpdateQuantityEntry`.
- ✅ `client/app/(tabs)/__tests__/index-f103-test.tsx` — Added new F103 screen tests covering row-per-entry rendering and entry-targeted toggle/edit/delete/end-trip behavior.
- ✅ `client/app/(tabs)/__tests__/history-test.tsx` — Updated trip-item fixture ids to entry-oriented identifiers for compatibility with flattened entry history rows.
- ✅ `client/components/__tests__/MultiTripModal-test.tsx` — Updated wording to align with entry-count semantics while preserving modal behavior checks.
- ✅ `client/api/trips.ts` — Needs-fixes follow-up: changed trip summary history embed from `list_items(id)` to `list_item_quantities(id)` and aligned `TripSummary` with the new child-table count source.
- ✅ `client/app/(tabs)/history.tsx` — Needs-fixes follow-up: switched trip summary item counts to `list_item_quantities.length` so history rows use the valid child-table join.
- ✅ `client/api/__tests__/list-f103-test.tsx` — Needs-fixes follow-up: unskipped the two child-table realtime toast tests and made them wait for subscription setup before firing the quantity-table callbacks.
- ✅ `client/app/(tabs)/__tests__/history-test.tsx` — Needs-fixes follow-up: renamed trip-summary fixtures to `list_item_quantities` so history-screen tests cover the corrected child-table item count.
- ✅ `client/app/(tabs)/__tests__/index-f103-test.tsx` — Needs-fixes follow-up: unskipped the checkbox and end-trip scenarios and wrapped them in async test synchronization so they assert after UI/query updates settle.
- ✅ `client/api/__tests__/list-f103-test.tsx` — Needs-fixes follow-up: flushed the fake timer used by the mutation-counter test so the module-level realtime suppression counter resets before the newly unskipped toast tests run.
- ✅ `client/app/(tabs)/__tests__/index-f103-test.tsx` — Needs-fixes follow-up: pulled the delete/undo test’s notifyManager timer tick inside `act()` so it stays stable in the full suite, not only when run alone.

### Issues
- `npm`/`node` are not available in this execution environment (`npm --prefix client test --watchAll=false` failed with `npm: command not found`), so test verification is blocked locally.

### Status
Complete — 17/17 files done
