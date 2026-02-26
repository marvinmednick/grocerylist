# Implementation Plan: F1 List Interaction Modes & Header Consolidation

## Files to Modify

- `client/app/(tabs)/_layout.tsx` —
  - In the `Tabs.Screen` configuration for `name="index"`:
    - Add `headerShown: false` to `options` to remove the Expo tab header.
    - Remove the entire `headerRight` property (the `Link` to `/modal`, its `Pressable`, and the `FontAwesome info-circle` icon).
  - Leave the `items` tab configuration unchanged.

- `client/app/(tabs)/index.tsx` —
  1. **Header Consolidation**
     - Replace the existing `globalHeader` (currently title + undo/redo) with a new consolidated header containing:
       - Left: `Text` title `"Shopping List"`.
       - Right (in order):
         1. Mode toggle button (`TouchableOpacity`)
         2. Undo button (existing logic + badge)
         3. Redo button (existing logic + badge)
         4. `UserAvatar` component
     - Keep existing undo/redo behavior and badge rendering unchanged.

  2. **Interaction Mode State**
     - Add:
       ```ts
       const [interactionMode, setInteractionMode] = useState<'shopping' | 'planning'>('shopping');
       ```
     - Mode toggle button:
       - Shows `ShoppingCart` (cart) icon when in `'shopping'`
       - Shows `Pencil` icon when in `'planning'`
       - On press: toggles between the two modes.

  3. **Refactor `renderItem` for `type: 'item'`**
     - Keep `ScaleDecorator`, `DraggableFlatList`, `onDragEnd`, and grip handle behavior unchanged.

     - **Shopping mode**:
       - Replace separate checkbox/name `TouchableOpacity` with a single `Pressable` wrapping:
         - Checkbox
         - Name + quantity text
         - Category column
         - New small `Pencil` edit icon (placed immediately before grip handle)
       - `Pressable`:
         - `onPress={() => handleToggle(listItem)}`
         - `onLongPress={() => openEditModal(listItem)}`
       - Grip handle:
         - Remains separate
         - `onLongPress={drag}` unchanged
       - Ensure the pressable area excludes the grip handle so drag behavior remains unaffected.

     - **Planning mode**:
       - Preserve current behavior:
         - `TouchableOpacity` on checkbox → `handleToggle`
         - `TouchableOpacity` on name → `openEditModal`
       - Do NOT render the pencil edit icon.
       - Grip handle unchanged.

  4. Ensure:
     - Edit modal logic (`isEditModalVisible`) remains unchanged.
     - Undo registration in `handleToggle`, `handleSaveEdit`, `handleDelete`, and `onDragEnd` is untouched.
     - `handleEndTrip` logic is untouched.

- `client/lib/household.tsx` —
  1. Update `HouseholdContextType` to:
     ```ts
     interface HouseholdContextType {
       householdId: string | null;
       displayName: string | null;
       displayNameShort: string | null;
       avatarColor: string | null;
       isLoading: boolean;
     }
     ```

  2. Change React Query key:
     - From: `['household_id']`
     - To: `['my_profile']`

  3. Update Supabase query:
     ```ts
     .select('household_id, display_name, display_name_short, color')
     ```

  4. Map query result into context values:
     - `householdId`
     - `displayName`
     - `displayNameShort`
     - `avatarColor`

  5. Ensure:
     - `householdId` remains available exactly as before for existing consumers.
     - `staleTime` remains `Infinity`.

## New Files

- `client/components/UserAvatar.tsx` —
  - Uses `useHousehold()` to read:
    - `displayName`
    - `displayNameShort`
    - `avatarColor`
  - Derives avatar letter:
    - First letter of `displayNameShort`
    - Else first letter of `displayName`
    - Else `'?'`
  - Background color:
    - `avatarColor`
    - Fallback `#2563eb`
  - Local state:
    ```ts
    const [menuVisible, setMenuVisible] = useState(false);
    ```
  - Renders:
    - Circular `TouchableOpacity` avatar button.
    - When `menuVisible`:
      - Full-screen transparent `Pressable` backdrop (dismisses menu).
      - Absolutely positioned `View` menu aligned top-right.
        - Non-interactive display name text.
        - `TouchableOpacity` "Sign Out" row.
  - Sign Out handler:
    - `await supabase.auth.signOut()`
    - `queryClient.clear()`
    - `router.replace('/auth')`
  - Styling via `StyleSheet.create()` only.

- `client/components/__tests__/UserAvatar-test.tsx` —
  Tests:
  - Renders first letter of `displayNameShort`.
  - Falls back to first letter of `displayName`.
  - Renders `'?'` if both null.
  - Uses default color `#2563eb` when `avatarColor` is null.
  - Opens menu on avatar press.
  - Closes menu when backdrop pressed.
  - Calls `supabase.auth.signOut` and `queryClient.clear` on Sign Out.
  - Mock:
    - `useHousehold`
    - `supabase.auth.signOut`
    - `useQueryClient`
    - `useRouter`

- `client/app/(tabs)/__tests__/index-interactions-test.tsx` —
  Tests:
  - Defaults to shopping mode (cart icon active).
  - Mode toggle switches to planning (pencil icon active).
  - Shopping mode:
    - Single tap on row calls `togglePurchased`.
    - Long press on row opens edit modal.
    - Pencil icon is visible.
  - Planning mode:
    - Tap name opens edit modal.
    - Tap checkbox calls `togglePurchased`.
    - Pencil icon not rendered.
  - Mock:
    - `useShoppingList`
    - `useTogglePurchased`
    - `useUpdateListItem`
    - `useAddToList`
    - `useDeleteListItem`
    - `useEndTrip`
    - `useRevertArchival`
    - `useUndo`
    - `useMetadata`
    - `useHousehold`
  - Wrap with `QueryClientProvider`, `UndoProvider`, and `HouseholdProvider`.

- `client/lib/__tests__/household-test.tsx` —
  Tests:
  - Mock Supabase `from('profiles').select().eq().single()` returning:
    - `household_id`
    - `display_name`
    - `display_name_short`
    - `color`
  - Assert:
    - `householdId`
    - `displayName`
    - `displayNameShort`
    - `avatarColor`
  - Confirm query key is `['my_profile']`.

- `supabase/migrations/20260223000000_add_profile_display_fields.sql` —
  ```sql
  ALTER TABLE profiles
    ADD COLUMN IF NOT EXISTS display_name_short TEXT,
    ADD COLUMN IF NOT EXISTS color TEXT DEFAULT '#2563eb';
  ```

## Patterns Applying

- Realtime Mutation Tracking: No — no new `list_items` writes introduced.
- Household Guard: No — no new inserts.
- Undo Registration: No — interaction mode and sign-out are not undoable.

## Ambiguities / Questions

- None.
