# Implementation Plan (Approved): F16 Store Preferences UI Redesign
> Updated after review: simplified comment UX, removed +/- buttons and comment modal, changed N/A → Unavailable pill label.

## Pre-flight
Run `npx supabase db push` before testing — migration `20250101000012` must be applied or neutral+comment rows will silently wipe all preferences at runtime.

## Files to Modify

- `supabase/full_schema.sql` —
  Update `item_store_preferences.status` CHECK to:
  `status TEXT NOT NULL CHECK (status IN ('preferred', 'avoided', 'unavailable', 'neutral'))`

- `client/api/items.ts` —
  Change `ItemStorePreference.status` and `StorePreferenceInput.status` to include `'neutral'`. No other changes.

- `client/app/(tabs)/items.tsx` —

  1. **Update `STATUS_OPTIONS`** — change `N/A` label to `Unavailable`:
     ```typescript
     { label: 'Unavailable', value: 'unavailable' }
     ```

  2. **Remove `STATUS_LABELS` constant** — no longer needed.

  3. **State: remove 4 variables** (from previous implementation):
     `selectedCommentStoreId`, `commentDropdownOpen`, `editingCommentStoreId`, `editingCommentText`

  4. **State: keep 2, do NOT add `pendingCommentText`**:
     - Keep: `selectedPrefStoreId`, `prefDropdownOpen`
     - The comment TextInput binds directly to `storePreferences`; no buffer needed.

  5. **Reset both in `openModal()`** alongside existing resets.

  6. **Store dropdown `onPress` handler** — just set store and close (no comment populate):
     ```typescript
     onPress={() => {
       setSelectedPrefStoreId(store.id);
       setPrefDropdownOpen(false);
     }}
     ```

  7. **Update `updateStoreStatus()`** — spread existing entry to preserve comment:
     ```typescript
     const updateStoreStatus = (storeId: string, status: PreferenceStatus) => {
       setStorePreferences((prev) => ({
         ...prev,
         [storeId]: { ...prev[storeId], status },
       }));
     };
     ```

  8. **Update `buildStorePreferencesPayload()`**:
     ```typescript
     .filter(([, pref]) => pref.status !== 'neutral' || (pref.comment?.trim().length ?? 0) > 0)
     .map(([store_id, pref]) => ({
       store_id,
       status: pref.status as PreferenceStatus,
       comment: pref.comment || null,
     }))
     ```

  9. **Remove** `handleSaveComment()`, `handleDeleteComment()`, and do NOT add `handleApplyComment()`.

  10. **No comment-specific save function needed** — `updateStoreComment` is called directly from the TextInput `onChangeText`.

  11. **Replace status pills section** — remove `+`/`−` buttons; pill tap calls `updateStoreStatus` directly:
      ```tsx
      {STATUS_OPTIONS.map((option) => {
        const selected = selectedPrefStatus === option.value;
        return (
          <TouchableOpacity
            key={`pref-pill-${option.value}`}
            testID={`pref-status-pill-${option.value}`}
            onPress={() => {
              if (!selectedPrefStoreId) return;
              updateStoreStatus(selectedPrefStoreId, option.value);
            }}
            style={[styles.segment, selected ? styles.segmentSelected : styles.segmentUnselected]}
          >
            <Text style={[styles.segmentText, selected ? styles.segmentTextSelected : styles.segmentTextUnselected]}>
              {option.label}
            </Text>
          </TouchableOpacity>
        );
      })}
      ```

  12. **Add inline comment section** (rendered only when `selectedPrefStoreId` is non-empty, below the pills). No Save Comment button — `onChangeText` writes to `storePreferences` directly:
      ```tsx
      {selectedPrefStoreId ? (
        <View>
          <Text style={styles.label}>Comment</Text>
          <TextInput
            testID="inline-comment-input"
            style={styles.modalInput}
            value={storePreferences[selectedPrefStoreId]?.comment ?? ''}
            onChangeText={(text) => updateStoreComment(selectedPrefStoreId, text)}
            onFocus={() => setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100)}
            placeholder="Add a note about this store..."
            placeholderTextColor="#9ca3af"
            multiline
          />
        </View>
      ) : null}
      ```
      Add `const scrollViewRef = useRef<ScrollView>(null)` near other refs, and attach `ref={scrollViewRef}` to the modal `ScrollView`.

  13. **Summary: use STATUS_OPTIONS labels** for group headers (`Pref.:`, `Avoid:`, `Unavailable:`).

  14. **Remove** the separate Store Comments sub-section with its own dropdown and Add Comment button.

  15. **Keep** the read-only All Store Comments list at the bottom. Make rows tappable to select the store in the preference dropdown (call `setSelectedPrefStoreId(store.id)` only — comment field reads from `storePreferences` automatically).

  16. **Remove the sibling comment edit `<Modal>` entirely.**

  17. **Do NOT add `saveCommentBtn` / `saveCommentBtnText` styles** — no Save Comment button exists.

  18. **Ensure:** `updateStoreComment()`, `initializeStorePreferences()`, `handleSave()` unchanged except the payload update above.

- `client/api/__tests__/items-test.ts` —
  Tests for neutral+comment rows via mutation mocks (test indirectly via supabase insert call assertions):
  - neutral+comment row IS included in `item_store_preferences` insert
  - neutral+empty-comment row is NOT included
  - `useCreateMasterItem` handles neutral-status rows with comments
  - `useUpdateMasterItem` re-insert includes neutral+comment rows

## New Files

- `client/app/__tests__/ItemsScreen-store-prefs-test.tsx` — all spec-defined test cases:
  - renders dropdown and 4 status pills including "Unavailable" (not "N/A")
  - comment field absent before store selected; present after
  - shows "No comments yet." empty state
  - tapping a status pill immediately updates preference
  - tapping `—` clears preference
  - no `pref-apply` or `pref-clear` testIDs exist (assert absent)
  - comment field shows existing comment for selected store
  - typing in comment field immediately updates storePreferences (no Save Comment button)
  - no `save-comment-btn` testID exists (assert absent)
  - clearing comment and saving modal removes it from All Store Comments list
  - tapping summary store name selects it; comment field reflects that store's comment
  - tapping comment row selects store; comment field reflects that store's comment
  - save payload includes neutral+comment rows; excludes neutral+empty rows
  Required mocks: `useAllItems`, `useCreateMasterItem`, `useUpdateMasterItem`, `useMetadata`, `useUndo`, `useHousehold`, ≥2 stores.

## Pre-existing Files (No Changes Needed)

- `supabase/migrations/20250101000012_f16_store_prefs_ui.sql` — already created. Apply with `npx supabase db push`.

## Patterns Applying

- **Realtime Mutation Tracking:** No
- **Household Guard:** Yes — indirectly via existing mutations; no new insert paths
- **Undo Registration:** No change — existing item-level undo unchanged
