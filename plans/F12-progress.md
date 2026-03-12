## Progress Log

### Files
- ✅ `supabase/full_schema.sql` — updated to F12 end-state with household-scoped stores, `item_store_preferences`, new indexes, and new stores/preferences RLS policies
- ✅ `client/api/metadata.ts` — scoped metadata stores by household, keyed metadata by household, and added `useCreateStore` with household guard/invalidation
- ✅ `client/api/items.ts` — migrated item/store model to `item_store_preferences`, updated create/update payloads, and added `computeWarnings`
- ✅ `client/api/list.ts` — extended list insert payload type with warning JSON support
- ✅ `client/components/SmartAddItem.tsx` — switched add flows to active-store behavior, removed dropdown store pills, and attached warning generation on adds
- ✅ `client/app/(tabs)/index.tsx` — added persisted active-store state, header StoreSelector, and SmartAddItem activeStore wiring
- ✅ `client/app/(tabs)/items.tsx` — replaced store association UI/state with store preferences and added edit-save undo registration
- ✅ `client/lib/activeStore.ts` — added AsyncStorage helpers for loading/saving active store ID
- ✅ `client/components/StoreSelector.tsx` — added active-store dropdown selector with create-store modal and outside-tap dismissal
- ✅ `supabase/migrations/20250101000011_f12_smart_entry_model.sql` — added F12 migration for household stores, preference table/policies, and legacy-model data migration cleanup
- ✅ `client/components/__tests__/SmartAddItem-test.tsx` — added F12 coverage for active store behavior, warning generation, and dropdown store-pill removal
- ✅ `client/app/(tabs)/__tests__/items-test.tsx` — added F12 coverage for per-store status selector behavior and save undo registration
- ✅ `client/lib/__tests__/activeStore-test.ts` — added AsyncStorage helper tests for load/save active store ID
- ✅ `client/components/__tests__/StoreSelector-test.tsx` — added selector dropdown/create-modal interaction tests with create-store mutation assertions
- ✅ `client/api/__tests__/metadata-test.ts` — added `useCreateStore` household-guard and insert payload tests

### Issues
- None

### Status
Complete

### Update Entries
- ✅ Initialized progress tracking for F12 implementation.
- ✅ `supabase/full_schema.sql` completed: removed `items.default_store_id`/`item_stores`, added `item_store_preferences`, household-scoped `stores`, and matching policy/index/seed updates.
- ✅ `client/api/metadata.ts` completed: metadata now queries household stores with `enabled` gating and includes `useCreateStore` mutation support.
- ✅ `client/api/items.ts` completed: joins and mutations now use `item_store_preferences`, and warning computation was exported for SmartAddItem.
- ✅ `client/api/list.ts` completed: `ListItemInsert` now accepts warning payloads without changing list mutation behavior.
- ✅ `client/lib/activeStore.ts` completed: added `loadActiveStoreId` and `saveActiveStoreId` using `@active_store_id`.
- ✅ `client/components/StoreSelector.tsx` completed: store picker/dropdown and in-flow store creation modal are implemented with metadata + create-store hooks.
- ✅ `client/components/SmartAddItem.tsx` completed: adds now use `activeStoreId`, warning payloads are computed for master items, and dropdown store pills were removed.
- ✅ `client/app/(tabs)/index.tsx` completed: active store is persisted/restored and passed through header selector + SmartAddItem.
- ✅ `client/app/(tabs)/items.tsx` completed: per-store preference controls now drive save payloads, item cards use preferred-store badge, and edit saves register undo/redo.
- ✅ `supabase/migrations/20250101000011_f12_smart_entry_model.sql` completed: migration now backfills/enforces store household scope, creates preference model, migrates legacy links, and removes old schema pieces.
- ✅ `client/components/SmartAddItem.tsx` adjusted: added test IDs for edit buttons/store tags to support deterministic modal-default assertions.
- ✅ `client/app/(tabs)/items.tsx` adjusted: added test IDs for per-store segmented controls and comment field visibility assertions.
- ✅ `client/components/StoreSelector.tsx` adjusted: added active-row checkmark test ID for selector dropdown assertions.
- ✅ `client/components/__tests__/SmartAddItem-test.tsx` completed: added all F12 SmartAddItem behavior tests (active store, warnings, and no store pills).
- ✅ `client/lib/__tests__/activeStore-test.ts` completed: added AsyncStorage helper unit tests.
- ✅ `client/components/__tests__/StoreSelector-test.tsx` completed: added dropdown/checkmark/store-creation behavior tests.
- ✅ `client/api/__tests__/metadata-test.ts` completed: verified household guard and insert payload for `useCreateStore`.
- ✅ `client/app/(tabs)/__tests__/items-test.tsx` completed: verified per-store status control behavior and undo action registration on save.
