## Progress Log

### Files
- ✅ `supabase/full_schema.sql` — added entry-level `list_item_quantities.store_id` and marked parent `list_items.store_id` deprecated in-place
- ✅ `client/api/list.ts` — moved store joins and mutations to quantity entries, kept parent store_id deprecated, and changed end-trip filtering to target entries directly
- ✅ `client/api/trips.ts` — trip history items now flatten store_id and store joins from archived quantity entries
- ✅ `client/lib/duplicateDetection.ts` — active duplicate classification now compares the incoming store to the active quantity entry store_id
- ✅ `client/app/(tabs)/index.tsx` — regrouped rows by entry store and moved edit/delete/drag/end-trip store behavior to quantity entries
- ✅ `client/components/SmartAddItem.tsx` — duplicate combine/add-new flows now move and create stores on quantity entries, and the dialog receives the active entry store name
- ✅ `client/components/DuplicateResolutionDialog.tsx` — store-name fallback now resolves from the target quantity entry instead of the removed parent store join
- ✅ `client/lib/__tests__/duplicateDetection-test.ts` — fixtures now carry entry store_id and cover same-store, different-store, and parent-vs-entry precedence cases
- ✅ `BACKLOG.md` — already contained the required `From F104` deferred items; no edit was needed
- ✅ `supabase/migrations/20250101000020_f104_per_entry_store_id.sql` — added the entry store_id column, index, backfill, and parent null-out migration exactly as specced
- ✅ `client/api/__tests__/list-f104-test.tsx` — added focused hook tests for entry-level store writes, removed parent store updates, and direct end-trip entry filtering
- ✅ `client/components/__tests__/SmartAddItem-f104-test.tsx` — added duplicate-flow tests for same-store Add New and cross-store Combine using entry store mutations
- ✅ `client/components/__tests__/SmartAddItem-f104-test.tsx` — narrowed the same-store Add New assertion to the F104 storeId contract so the test only checks the intended behavior
- ✅ `client/api/__tests__/_helpers/listItemMock.ts` — updated shared test fixtures to project legacy parent store seeds onto quantity entries for F104-compatible screen tests
- ✅ `client/api/__tests__/list-f104-test.tsx` — refined the end-trip query-chain mock so the direct-entry filter test matches the actual fluent Supabase API
- ✅ `client/components/__tests__/SmartAddItem-test.tsx` — updated the legacy duplicate fixture so existing dialog tests seed store_id and store on the active entry

### Issues
- Added one unplanned test-helper update so existing screen tests continue seeding store data in an F104-compatible shape without changing production behavior.

### Status
Complete — 13 files handled
