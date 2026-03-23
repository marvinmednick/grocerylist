## Progress Log

### Files
- ✅ `supabase/migrations/20250101000013_f19_store_management.sql` — added migration to set `shopping_trips.primary_store_id` FK to `ON DELETE SET NULL`
- ✅ `supabase/full_schema.sql` — updated `shopping_trips.primary_store_id` reference to `ON DELETE SET NULL`
- ✅ `client/api/metadata.ts` — added `useUpdateStore`, `useDeleteStore`, and `useStoreCascadeInfo` with household guards, parallel count query, and exact key invalidation
- ✅ `client/components/StoreSelector.tsx` — added per-row edit button, edit modal with rename undo + delete confirm cascade flow, active-store fallback on delete, and defensive cascade hook handling for legacy test mocks
- ✅ `client/app/(tabs)/items.tsx` — added preference store filter threshold/input, filtered options + empty state, and filter reset on open/close/selection
- ✅ `client/api/__tests__/metadata-store-mutations-test.ts` — added mutation/cascade hook tests for update, delete, household guard, invalidation, and staleTime/count behavior
- ✅ `client/components/__tests__/StoreSelector-test.tsx` — extended coverage for edit buttons, edit modal open/save, delete confirm/cascade flow, and active-store fallback deletes
- ✅ `client/app/(tabs)/__tests__/items-store-filter-test.tsx` — added threshold/filter/reset tests for preference store dropdown in item modal and wrapped timers in `act` to avoid async `FlatList` warnings
- ✅ `client/app/(tabs)/__tests__/index-interactions-test.tsx` — stabilized one existing async interaction test by flushing pending timers in `act` to satisfy strict console-error policy

### Issues
- Expanded one pre-existing test file outside the F19 plan to fix a newly surfaced async `act(...)` warning required by the full-suite test run.

### Status
Complete
