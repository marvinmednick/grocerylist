# Implementation Plan: F16 Store Preferences UI Redesign

## Files to Modify

- `supabase/full_schema.sql` —
  1. **Expand status CHECK constraint** — update `item_store_preferences.status` constraint in table definition to `status TEXT NOT NULL CHECK (status IN ('preferred', 'avoided', 'unavailable', 'neutral'))` so schema source-of-truth matches migration behavior.
  2. **Ensure:** table structure, other constraints, and unrelated schema definitions remain unchanged.

- `client/api/items.ts` —
  1. **Update status union types** — change `ItemStorePreference.status` and `StorePreferenceInput.status` from `'preferred' | 'avoided' | 'unavailable'` to `'preferred' | 'avoided' | 'unavailable' | 'neutral'`.
  2. **Ensure:** `computeWarnings()` logic is not modified and continues ignoring neutral status entries as-is.

- `client/app/(tabs)/items.tsx` —
  1. **Add state for dual dropdowns and comment editor modal** — add:
     - `selectedPrefStoreId`, `prefDropdownOpen`
     - `selectedCommentStoreId`, `commentDropdownOpen`
     - `editingCommentStoreId`, `editingCommentText`
     Reset all six inside `openModal()` alongside existing modal state resets.
  2. **Adjust store preference state update semantics** — update `updateStoreStatus(storeId, status)` to only set status and remove neutral comment-clearing behavior:
     - `setStorePreferences((prev) => ({ ...prev, [storeId]: { ...prev[storeId], status } }))`
  3. **Update save payload filter to preserve neutral+comment rows** — in `buildStorePreferencesPayload()`, use:
     - `.filter(([, pref]) => pref.status !== 'neutral' || (pref.comment?.trim().length ?? 0) > 0)`
     - `.map(([store_id, pref]) => ({ store_id, status: pref.status as PreferenceStatus, comment: pref.comment || null }))`
     This enforces: persist non-neutral rows and neutral rows with non-empty comment; exclude neutral+empty comment.
  4. **Replace Store Preferences UI block with redesigned sub-section** — replace current `storePreferenceContainer` section with:
     - Preference store dropdown row (`TouchableOpacity`) showing color dot + store name (or `Select store...`) + `ChevronDown`; toggles `prefDropdownOpen`.
     - Expanded dropdown list when open (all stores, color dot + name); selecting store sets `selectedPrefStoreId` and closes dropdown.
     - Four status pills (`—`, `Pref.`, `Avoid`, `N/A`) reflecting `storePreferences[selectedPrefStoreId]?.status ?? 'neutral'`; active style `#2563eb` + white text, inactive `#f3f4f6` + `#374151`.
     - `+` action (`Plus`, blue, 20) applies selected store + current pill status and closes dropdown; no-op when no store selected.
     - `−` action (`Minus`, gray, 20) sets selected store status to `'neutral'` and preserves comment; no-op when no store selected.
     - Read-only grouped summary lines from current `storePreferences`:
       - `Preferred: ...`, `Avoid: ...`, `N/A: ...`
       - Include only stores where status is `preferred`, `avoided`, `unavailable`.
       - Alphabetically sort store names within each group.
       - Render group line only when non-empty.
       - Store names in summary are tappable and call `setSelectedPrefStoreId(storeId)`.
  5. **Add Store Comments sub-section below preference summary** —
     - Independent comment store dropdown using `selectedCommentStoreId` / `commentDropdownOpen` with same visual behavior.
     - `Add Comment` button disabled when `selectedCommentStoreId === ''`; enabled opens comment modal with:
       - `setEditingCommentStoreId(selectedCommentStoreId)`
       - `setEditingCommentText('')`
     - Comment list from stores whose `storePreferences[store.id]?.comment?.trim().length > 0`; each row shows `Store — "comment"` + `ChevronRight` and opens modal prefilled with existing comment.
     - Empty state text: `No comments added yet.` when no comment rows exist.
  6. **Add comment edit Modal as sibling of item edit Modal** — at same JSX level (not nested) with:
     - `visible={editingCommentStoreId !== null}`, `animationType="slide"`, `transparent={true}`.
     - `KeyboardAvoidingView` overlay (`behavior={Platform.OS === 'ios' ? 'padding' : 'height'}`).
     - Header: destructive delete pill button (`Trash2`, style `backgroundColor: '#fee2e2', padding: 8, borderRadius: 8`) on left; current store name title center; close (`X`) on right.
     - Scrollable body (`ScrollView keyboardShouldPersistTaps="handled"`) and multiline `TextInput` (`placeholder="Add a note about this store..."`, `placeholderTextColor="#9ca3af"`, minHeight 80).
     - Footer actions: Cancel and Save.
     - Handlers:
       - `handleSaveComment()` updates comment via `updateStoreComment(editingCommentStoreId, editingCommentText)` and closes modal.
       - `handleDeleteComment()` sets comment to empty string via `updateStoreComment(editingCommentStoreId, '')` and closes modal.
  7. **Update icon imports/constants** — add `Trash2`, `ChevronDown`, `ChevronRight`, `Minus` to `lucide-react-native` imports and remove/replace old `STATUS_OPTIONS` structure as needed by new UI.
  8. **Ensure:** keep `updateStoreComment()`, `initializeStorePreferences()`, and `handleSave()` behavior unchanged except for the explicit payload update above; do not alter unrelated item editing logic.

- `client/api/__tests__/items-test.ts` —
  1. **Add payload filter tests for neutral comments** — verify payload builder behavior includes neutral rows with non-empty comment and excludes neutral rows with empty comment.
  2. **Add mutation payload tests** — verify:
     - `useCreateMasterItem` inserts neutral status rows when comment exists.
     - `useUpdateMasterItem` re-insert payload after delete includes neutral+comment rows.
  3. **Ensure:** existing mutation, warning, and invalidation coverage remains intact.

## New Files

- `client/app/__tests__/ItemsScreen-store-prefs-test.tsx` — test redesigned Store Preferences and Store Comments UI. Include all spec-defined tests:
  - renders Store Preferences section with store dropdown and 4 status pills
  - renders Store Comments section with separate dropdown and Add Comment button
  - shows empty state text when no comments exist
  - selecting a store in preference dropdown pre-fills neutral status (`—` active)
  - pressing `+` saves selected store/status and shows summary entry
  - pressing `−` resets selected store to neutral and removes summary entry
  - tapping store name in summary selects it in preference dropdown
  - summary only shows non-neutral stores
  - Add Comment disabled when no store selected
  - Add Comment opens comment modal with empty field
  - tapping comment row opens modal pre-filled
  - Save updates comment in state
  - Delete clears comment and closes modal
  Required mocks/setup: `useAllItems`, `useCreateMasterItem`, `useUpdateMasterItem`, `useMetadata`, `useUndo`, `useHousehold`, and metadata with at least two stores.

## Patterns Applying

- Realtime Mutation Tracking: No — feature updates item-level preference UI/state and item mutations; no `api/list.ts` `list_items` mutation path.
- Household Guard: Yes — indirectly via existing `useCreateMasterItem` / `useUpdateMasterItem` insert flows; tests should preserve this expectation.
- Undo Registration: No change — existing item-level undo behavior remains unchanged; no new per-preference undo actions.

## Ambiguities / Questions

- Spec inconsistency: `New Files` says `None`, but `Tests to Write` requires new file `client/app/__tests__/ItemsScreen-store-prefs-test.tsx`. Plan assumes this test file should be created.
- `buildStorePreferencesPayload` ownership note: spec requests payload tests in `client/api/__tests__/items-test.ts` even though payload builder is described in `client/app/(tabs)/items.tsx`. Plan assumes tests should validate the effective mutation payload behavior (not direct export from screen file) unless existing test helpers already expose a payload builder in `items.ts`.
