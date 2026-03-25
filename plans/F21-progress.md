## Progress Log

### Files
- ✅ `client/api/items.ts` — added `created_at` to `MasterItem`, exported `SortOption`, and updated `useAllItems(searchTerm, sort)` to use sort-aware query key and ordering.
- ✅ `client/app/(tabs)/items.tsx` — added sort/recent state, controls row, recent filtering + auto-sort behavior, switched list to `displayedItems`, and added the conditional `New` badge for recent items.
- ✅ `client/api/__tests__/items-test.ts` — extended tests to cover `useAllItems` default and explicit sort ordering plus sort inclusion in the query key.
- ✅ `client/app/(tabs)/__tests__/items-sort-filter-test.tsx` — added screen tests for sort controls, active default, sort changes, Recent toggle behavior, Recent+search AND logic, and New badge visibility.

### Issues
- None

### Status
Complete
