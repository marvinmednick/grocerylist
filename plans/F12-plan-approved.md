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
  3. **UI replacement in modal** — replace "Associated Stores" toggle+star with per-store status segmented control and conditional comment field. Each store row layout:
     ```
     [Color dot 10px] Store Name
     [—] [Pref.] [Avoid] [N/A]    ← segmented control (same pattern as Settings.tsx warning prefs)
     [Comment: ___________]        ← shown when status is not neutral
     ```
     Segment labels: "—" (neutral), "Pref." (preferred), "Avoid" (avoided), "N/A" (unavailable). Default state for all stores is neutral.
  4. **Item card store badge update** — replace `item.store?.name || 'Any Store'` (which used the removed `stores!default_store_id` join) with the preferred store from `item_store_preferences`:
     ```tsx
     const preferredStore = item.item_store_preferences?.find(p => p.status === 'preferred');
     // In the badge:
     <Text style={styles.badgeText}>{preferredStore?.store?.name || 'Any Store'}</Text>
     ```
  5. **Undo registration for item saves** — import `useUndo`, switch save path to `mutateAsync`, capture old snapshot (including `store_preferences`) before save, then `pushAction` with `Edited ${name}` and undo/redo closures that call `updateItem({ id, ...oldSnapshot })` and `updateItem({ id, ...newPayload })`.
  6. **Ensure:** preserve existing item modal validation, create/edit/delete flows outside F12 preference model changes, and existing provider architecture.

- `client/components/__tests__/SmartAddItem-test.tsx` —
  1. `it('does not render store pills in dropdown rows')` → type query, verify no "Store:" label or store pills in results
  2. `it('uses activeStoreId for quick-add store_id')` → set activeStoreId='store-1', quick-add an item, assert addItem called with `store_id: 'store-1'`
  3. `it('uses activeStoreId for one-off add store_id')` → set activeStoreId='store-1', add one-off, assert addItem called with `store_id: 'store-1'`
  4. `it('defaults edit modal store to activeStoreId')` → tap edit on an item, assert the store picker shows activeStoreId as selected
  5. `it('generates avoided warning when item has avoided status at active store')` → mock search result with item_store_preferences `[{ store_id: 'store-1', status: 'avoided', comment: 'bad quality' }]`, set activeStoreId='store-1', quick-add, assert addItem called with warnings containing `{ type: 'avoided', comment: 'bad quality' }`
  6. `it('generates non_preferred warning when preferred stores exist elsewhere')` → mock preferences with preferred at store-2, activeStoreId='store-1', assert warning with `type: 'non_preferred'`
  7. `it('generates non_standard_qty warning')` → mock item with default_qty='1 gal', add with qty='3', assert warning with `type: 'non_standard_qty'`
  8. `it('generates no warnings for one-off items')` → add one-off, assert addItem called with `warnings: []`
  9. **Ensure:** keep existing test wrapper/provider patterns and existing SmartAddItem behaviors not in scope.

- `client/app/(tabs)/__tests__/items-test.tsx` —
  1. `it('renders status selector for each store in edit modal')` → open edit modal, assert segmented controls are visible for each store
  2. `it('sets preference to preferred when tapped')` → tap "Pref." segment for a store, save, assert mutation payload includes `store_preferences` with `status: 'preferred'`
  3. `it('shows comment field when non-neutral status selected')` → select "Avoid" for a store, assert comment TextInput appears
  4. `it('registers undo action on item save')` → mock pushAction, save item edits, assert pushAction called with label containing "Edited"
  5. **Ensure:** preserve existing tests for unrelated items-tab features.

## New Files

- `client/lib/activeStore.ts` — AsyncStorage helpers:
  - `loadActiveStoreId(): Promise<string | null>` reads key `@active_store_id`
  - `saveActiveStoreId(id: string): Promise<void>` writes key `@active_store_id`

- `client/components/StoreSelector.tsx` — header selector component that:
  - accepts `activeStoreId` and `onStoreChange(storeId)`
  - internally uses `useMetadata` and `useCreateStore`
  - renders active store name in `store.color_code`, `fontSize: 20`, `fontWeight: '700'`, plus gray `" ▾"`; fallback `"Select Store ▾"` in gray when no active store or no stores exist
  - opens absolute dropdown below the selector with rows: `[10px color dot] + store name + checkmark icon on active store row`
  - final dropdown row: `"+ Add new store"` in blue-600
  - closes on outside tap via full-screen transparent `Pressable` behind the dropdown
  - includes store creation modal (`<Modal animationType="slide" transparent={true}>`):
    - Title: `"New Store"`
    - Name: `TextInput`
    - Color: row of 30px colored circles using exact `STORE_COLORS` palette; selected circle shows white inner ring via 2px border (same pattern as Settings profile color picker)
    - `"Add"` button (blue-600, disabled when name empty): calls `useCreateStore` → `onStoreChange(newStore.id)` → closes modal
    - `"Cancel"` button: closes modal without action

- `supabase/migrations/20250101000011_f12_smart_entry_model.sql` — migration implementing exact spec SQL:
  - add/backfill/enforce `stores.household_id`
  - replace global store uniqueness with `(name, household_id)` and add indexes
  - replace stores read policy with household-scoped CRUD policies
  - create `item_store_preferences` table + indexes + RLS policy
  - migrate preferred rows from `item_stores` and `items.default_store_id`
  - drop `item_stores` table and `items.default_store_id` column

- `client/lib/__tests__/activeStore-test.ts` — tests:
  - `it('returns null when no stored value')` → mock AsyncStorage.getItem returning null, assert returns null
  - `it('returns stored store ID')` → mock AsyncStorage.getItem returning 'store-123', assert returns 'store-123'
  - `it('saves store ID to AsyncStorage')` → call saveActiveStoreId('store-456'), assert AsyncStorage.setItem called with `('@active_store_id', 'store-456')`
  - Required mocks: AsyncStorage get/set behavior.

- `client/components/__tests__/StoreSelector-test.tsx` — tests:
  - `it('renders the active store name')` → pass stores list and activeStoreId, assert store name is displayed
  - `it('shows dropdown chevron')` → assert ▾ text is present
  - `it('opens dropdown on press')` → press the selector, assert store list items appear
  - `it('shows checkmark on active store')` → open dropdown, assert checkmark on the active store row
  - `it('calls onStoreChange when a store is selected')` → open dropdown, tap a different store, assert callback called with that store's ID
  - `it('shows Add new store option')` → open dropdown, assert "+ Add new store" text is visible
  - `it('opens creation modal when Add new store tapped')` → tap "+ Add new store", assert creation modal is visible (name input present)
  - `it('calls useCreateStore with name and color')` → fill name, select color, tap Add, assert the mutation was called with correct args
  - Required mocks: metadata hook response, create-store mutation hook, modal/dropdown interactions.

- `client/api/__tests__/metadata-test.ts` — tests:
  - `it('useCreateStore throws when householdId is null')` → mock useHousehold returning null, assert mutation rejects with `'No household ID found'`
  - `it('useCreateStore inserts with household_id')` → mock householdId, call mutation, assert supabase insert includes `household_id`
  - Required mocks: `useHousehold` return values and Supabase insert chain.

## Patterns Applying
- Realtime Mutation Tracking: Yes — no new `list_items` mutation is introduced, but SmartAddItem still writes to `list_items`; implementation must preserve existing `useAddToList` local mutation tracking behavior untouched.
- Household Guard: Yes — required for new `useCreateStore` insert and existing `useCreateMasterItem`/`useUpdateMasterItem` preference inserts into household-scoped tables.
- Undo Registration: Yes — existing add-item undo remains, plus new requirement to register undo for item saves in `client/app/(tabs)/items.tsx` using `mutateAsync` and snapshot-based undo/redo.

## Ambiguities / Questions
- None.
