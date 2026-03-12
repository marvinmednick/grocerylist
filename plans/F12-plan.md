# Implementation Plan: F12 Smart Entry Model

## Files to Modify

- `supabase/full_schema.sql` —
  1. **Mirror the migration end-state exactly** — update schema definitions so `stores` includes `household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE`, `items` no longer has `default_store_id`, `item_stores` is removed, and `item_store_preferences` exists with:
     - `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
     - `item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE`
     - `store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE`
     - `status TEXT NOT NULL CHECK (status IN ('preferred', 'avoided', 'unavailable'))`
     - `comment TEXT`
     - `household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE`
     - `UNIQUE (item_id, store_id)`
  2. **Update constraints/policies/indexes to match spec** — `stores` uniqueness becomes `UNIQUE (name, household_id)` (not global name), include `stores_household_idx`, `item_store_preferences_item_idx`, `item_store_preferences_household_idx`, and RLS policies:
     - `"Household members can read stores"` (`USING (household_id = get_my_household_id())`)
     - `"Household members can insert stores"` (`WITH CHECK (household_id = get_my_household_id())`)
     - `"Household members can update stores"` (`USING (household_id = get_my_household_id())`)
     - `"Household members can delete stores"` (`USING (household_id = get_my_household_id())`)
     - `"Household members can manage item_store_preferences"` (`FOR ALL`, both `USING` and `WITH CHECK` on `household_id = get_my_household_id()`)
  3. **Ensure:** keep unrelated schema objects unchanged; only reflect F12-delivered DB state.

- `client/api/metadata.ts` —
  1. **Household-scoped metadata query** — import/use `useHousehold`, change key from `['metadata']` to `['metadata', householdId]`, add `enabled: !!householdId`, change stores query to:
     ```typescript
     supabase.from('stores').select('*').eq('household_id', householdId!).order('name')
     ```
  2. **Staleness and creation support** — reduce metadata `staleTime` to 5 minutes and add `useCreateStore` mutation:
     ```typescript
     supabase.from('stores')
       .insert({ name, color_code, household_id: householdId })
       .select()
       .single()
     ```
     with household guard (`if (!householdId) throw new Error('No household ID found')`) and invalidation of `['metadata']`.
  3. **Ensure:** preserve existing metadata shape for categories/units and existing non-store behavior.

- `client/api/items.ts` —
  1. **Type/interface replacement** — update `MasterItem` to remove `default_store_id`, `store?`, `item_stores?`; add `item_store_preferences?`, plus new exported interfaces:
     - `ItemStorePreference`
     - `StorePreferenceInput`
  2. **Query joins update** — update both `useSearchItems` and `useAllItems` select strings to:
     ```typescript
     .select(`
       *,
       category:categories!default_category_id(name),
       item_store_preferences(
         store_id, status, comment,
         store:stores(id, name, color_code)
       )
     `)
     ```
     and remove both old joins (`store:stores!default_store_id(...)` and `item_stores(...)`).
  3. **Create/update mutation payload changes** — replace `store_ids` with `store_preferences`; remove `default_store_id` usage; in create/update write `item_store_preferences` rows with `{ item_id, store_id, status, comment, household_id }`; update flow deletes existing preferences then inserts new rows on update.
  4. **Warning computation export** — add exported `Warning` type and `computeWarnings(preferences, activeStoreId, quantity, defaultQty, alternateQtys)` implementing exact warning rules:
     - active avoided -> `{ type: 'avoided', store_id, store_name, comment }`
     - active unavailable -> `{ type: 'unavailable', store_id, store_name, comment }`
     - preferred stores exist but active store not preferred -> `{ type: 'non_preferred', preferred_stores }`
     - quantity not in `[defaultQty, ...alternateQtys]` -> `{ type: 'non_standard_qty', entered, standard }`
  5. **Ensure:** keep household guards on household-scoped inserts, query invalidation keys (`['items']`, `['all_items']`, plus existing `['shopping_list']` invalidation where present), and existing non-F12 item behavior.

- `client/api/list.ts` —
  1. **Insert interface extension only** — add `warnings` to `ListItemInsert` so list insert payload accepts warning JSON written by SmartAddItem.
  2. **Ensure:** do not modify shopping-list query behavior, realtime mutation tracking wrappers (`incrementLocalMutation`/`decrementLocalMutation`), or existing mutation semantics.

- `client/components/SmartAddItem.tsx` —
  1. **Active-store driven adds** — add `activeStoreId` prop and remove `storeId` from selection state. Use `activeStoreId` for quick-add, one-off add, and edit-before-add default store.
  2. **Dropdown row cleanup** — remove store pill rendering from search rows (no inline store chips/`Store:` labels in dropdown).
  3. **Warnings-on-add integration** — before each master-item add, call:
     ```typescript
     const warnings = computeWarnings(
       item.item_store_preferences,
       activeStoreId,
       selection.qty,
       item.default_qty,
       item.alternate_qtys,
     );
     await addItem({ ...payload, warnings });
     ```
     and for one-off adds send `warnings: []`.
  4. **Edit modal defaults** — default edit-before-add store picker to `activeStoreId` while still allowing user change inside modal.
  5. **Ensure:** preserve existing undo registration for add actions, existing add flows, and existing disabled/loading behaviors.

- `client/app/(tabs)/index.tsx` —
  1. **Active store state lifecycle** — add `activeStoreId` state, load/save via new `loadActiveStoreId`/`saveActiveStoreId` helpers, default to first metadata store when no saved value exists, and persist on selection changes.
  2. **Header replacement** — replace `<Text style={styles.globalTitle}>Shopping List</Text>` with:
     ```tsx
     <StoreSelector activeStoreId={activeStoreId} onStoreChange={handleStoreChange} />
     ```
  3. **Pass active store through add UI** — update SmartAddItem usage to:
     ```tsx
     <SmartAddItem disabled={isHouseholdLoading} activeStoreId={activeStoreId} />
     ```
  4. **Metadata wiring check** — ensure existing edit modal store list continues using `metadata?.stores` from updated metadata hook.
  5. **Ensure:** do not alter list rendering, trip workflow, undo/redo behavior, or non-F12 actions on this screen.

- `client/app/(tabs)/items.tsx` —
  1. **Preference-state model swap** — replace old associated-store selection state (`selectedStoreIds` / `storeId`) with:
     ```typescript
     const [storePreferences, setStorePreferences] = useState<
       Record<string, { status: 'neutral' | 'preferred' | 'avoided' | 'unavailable'; comment: string }>
     >({});
     ```
  2. **Edit modal initialization/save payload updates** — on edit open, initialize from `item.item_store_preferences`; on save build:
     ```typescript
     const store_preferences = Object.entries(storePreferences)
       .filter(([_, pref]) => pref.status !== 'neutral')
       .map(([store_id, pref]) => ({
         store_id,
         status: pref.status,
         comment: pref.comment || null,
       }));
     ```
     remove `default_store_id` and `store_ids`, pass `store_preferences` to create/update mutations.
  3. **UI replacement in modal** — replace "Associated Stores" toggle+star with per-store status segmented control (`—`, `Pref.`, `Avoid`, `N/A`) and conditional comment field shown when status is non-neutral; include color dot + store name row per store.
  4. **Undo registration for item saves** — switch save path to `mutateAsync`, capture old snapshot (including `store_preferences`) before save, then `pushAction` with `Edited ${name}` and undo/redo closures that call `updateItem({ id, ...oldSnapshot })` and `updateItem({ id, ...newPayload })`.
  5. **Ensure:** preserve existing item modal validation, create/edit/delete flows outside F12 preference model changes, and existing provider architecture.

- `client/components/__tests__/SmartAddItem-test.tsx` —
  1. **Remove-store-pill coverage** — assert dropdown results no longer render store pill UI.
  2. **Active store routing coverage** — assert quick-add and one-off add call `addItem` with `store_id: activeStoreId`.
  3. **Edit default coverage** — assert edit-before-add modal defaults store picker to `activeStoreId`.
  4. **Warning generation coverage** — add explicit tests for avoided, non_preferred, non_standard_qty, and one-off no-warning payload (`warnings: []`) using `item_store_preferences` fixtures.
  5. **Ensure:** keep existing test wrapper/provider patterns and existing SmartAddItem behaviors not in scope.

- `client/app/(tabs)/__tests__/items-test.tsx` —
  1. **Preference UI rendering tests** — assert status selector per store appears in edit modal and comment field toggles for non-neutral status.
  2. **Payload mapping test** — assert selecting preferred (or other statuses) yields `store_preferences` payload entries with exact `status` and `comment` mapping.
  3. **Undo-on-save test** — mock `pushAction` and assert called with label containing `Edited` after save.
  4. **Ensure:** preserve existing tests for unrelated items-tab features.

## New Files

- `client/lib/activeStore.ts` — AsyncStorage helpers:
  - `loadActiveStoreId(): Promise<string | null>` reads key `@active_store_id`
  - `saveActiveStoreId(id: string): Promise<void>` writes key `@active_store_id`

- `client/components/StoreSelector.tsx` — header selector component that:
  - accepts `activeStoreId` and `onStoreChange(storeId)`
  - internally uses `useMetadata` and `useCreateStore`
  - renders active store name in `store.color_code`, `fontSize: 20`, `fontWeight: '700'`, plus gray `" ▾"`; fallback `"Select Store ▾"` gray
  - opens absolute dropdown with rows `[10px color dot] + store name + active checkmark`
  - has final `+ Add new store` row in blue-600
  - closes on outside tap via full-screen transparent `Pressable`
  - includes modal (`Modal animationType="slide" transparent={true}`) with name input, color picker using exact `STORE_COLORS` palette, Add button disabled when name empty, and Add flow (`useCreateStore` -> `onStoreChange(newStore.id)` -> close)

- `supabase/migrations/20250101000011_f12_smart_entry_model.sql` — migration implementing exact spec SQL:
  - add/backfill/enforce `stores.household_id`
  - replace global store uniqueness with `(name, household_id)` and add indexes
  - replace stores read policy with household-scoped CRUD policies
  - create `item_store_preferences` table + indexes + RLS policy
  - migrate preferred rows from `item_stores` and `items.default_store_id`
  - drop `item_stores` table and `items.default_store_id` column

- `client/lib/__tests__/activeStore-test.ts` — tests:
  - returns null when no stored value
  - returns stored store ID
  - saves store ID to AsyncStorage with `('@active_store_id', value)`
  Required mocks: AsyncStorage get/set behavior.

- `client/components/__tests__/StoreSelector-test.tsx` — tests:
  - renders active store name
  - shows chevron `▾`
  - opens dropdown on press
  - shows checkmark on active store
  - calls `onStoreChange` when store selected
  - shows `+ Add new store`
  - opens creation modal
  - calls `useCreateStore` with name and color
  Required mocks: metadata hook response, create-store mutation hook, modal/dropdown interactions.

- `client/api/__tests__/metadata-test.ts` — tests:
  - `useCreateStore` throws when `householdId` is null with `'No household ID found'`
  - `useCreateStore` inserts with `household_id`
  Required mocks: `useHousehold` return values and Supabase insert chain.

## Patterns Applying
- Realtime Mutation Tracking: Yes — no new `list_items` mutation is introduced, but SmartAddItem still writes to `list_items`; implementation must preserve existing `useAddToList` local mutation tracking behavior untouched.
- Household Guard: Yes — required for new `useCreateStore` insert and existing `useCreateMasterItem`/`useUpdateMasterItem` preference inserts into household-scoped tables.
- Undo Registration: Yes — existing add-item undo remains, plus new requirement to register undo for item saves in `client/app/(tabs)/items.tsx` using `mutateAsync` and snapshot-based undo/redo.

## Ambiguities / Questions
- None.
