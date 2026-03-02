# Implementation Plan: F2 Multi-User Trip Management

## Files to Modify

- `client/lib/household.tsx` —
  1. **Context Type Expansion** — add `userId: string | null` to `HouseholdContextType`.
  2. **Query Result Shape** — in `['my_profile']` query, return `{ ...data, userId: session.user.id }` after selecting `household_id, display_name, display_name_short, color` from `profiles` by `session.user.id`.
  3. **Provider Value Wiring** — expose `userId: profileData?.userId ?? null` in the context value alongside existing household/profile fields.
  4. **Ensure:** existing `householdId`, `displayName`, `displayNameShort`, `avatarColor`, and loading semantics remain unchanged.

- `client/api/list.ts` —
  1. **List Item Type Update** — add `purchased_by: string | null` to `ListItem` so the existing `select('*')` query shape is represented.
  2. **Toggle Purchased Attribution** — update `useTogglePurchased` to capture `userId` from `useHousehold()` at hook initialization and send exact payload:
     `purchased_by: is_purchased ? userId : null` together with `is_purchased` and `purchased_at`.
  3. **End Trip Signature + Filtering** — update `useEndTrip` args to `{ store_id?: string; user_id?: string }`; set trip insert `user_id` as `targetUserId ?? currentAuthUser?.id ?? null`; add conditional archival filter `if (targetUserId) query = query.eq('purchased_by', targetUserId)` while preserving existing purchased/unarchived/store filters.
  4. **Ensure:** existing `['shopping_list']` invalidation, household guard in `useEndTrip`, and realtime mutation tracking wrappers (`incrementLocalMutation`/`decrementLocalMutation` in `finally`) remain intact.

- `client/api/profile.ts` —
  1. **New Interface** — add `HouseholdMember` with fields `id`, `display_name`, `display_name_short`, `color`.
  2. **New Hook** — add `useHouseholdMembers(householdId)` using query key `['household_members', householdId]`, stale time `5 * 60 * 1000`, and exact query:
     `supabase.from('profiles').select('id, display_name, display_name_short, color').eq('household_id', householdId!)`.
  3. **Null Household Behavior** — return `[]` or disable query when `householdId` is null so callers always have safe array semantics.
  4. **Ensure:** do not modify existing `useUpdateProfile`, `useHouseholdName`, or `useHouseholdMemberColors` behavior.

- `client/app/auth.tsx` —
  1. **Palette Constant** — add module-level `PROFILE_COLOR_PALETTE` with exact ordered colors:
     `#2563eb`, `#16a34a`, `#ea580c`, `#9333ea`, `#dc2626`, `#0d9488`, `#db2777`.
  2. **Exported Picker Helper** — add `export async function pickProfileColor(householdId: string): Promise<string>` that selects existing household profile colors, computes first unused palette entry, and falls back to `#2563eb` when all seven are used.
  3. **Profile Creation Wiring** — in `ensureProfile`, call `pickProfileColor(hh.id)` before inserting and include `color` in the inserted profile payload for both single and multi household mode branches.
  4. **Ensure:** existing auth/session checks, household creation/lookup flow, and profile upsert behavior outside color assignment remain unchanged.

- `client/app/(tabs)/index.tsx` —
  1. **Member Data + Current User Inputs** — import `useHouseholdMembers` and consume `userId` from `useHousehold()`; build `memberMap` via `useMemo(new Map(members.map(m => [m.id, m])))`.
  2. **Checkbox Rendering Helper** — replace hardcoded purchased/unchecked icons with local `renderCheckbox(item)` used in both shopping-mode `Pressable` and planning-mode checkbox:
     - unchecked: `<Circle size={24} color="#d1d5db" />`
     - purchased by current user or `purchased_by === null`: outlined `<CheckCircle2 size={24} color={avatarColor ?? '#2563eb'} />`
     - purchased by another user: filled 32x32 colored circle (`memberMap` color fallback `#6b7280`) with centered white `<Check size={16} color="white" />`
  3. **End Trip Router Logic** — update `handleEndTrip(storeId?, storeName?)` to compute distinct non-null purchasers from purchased items in scope, then:
     - 0 purchasers: no-op
     - 1 purchaser (or only null purchasers): existing Platform-guarded Alert confirm path and single `endTrip({ store_id })`
     - 2+ purchasers: build `TripUser[]`, set modal context state, open modal, skip Alert
  4. **Multi-Trip Modal State + Handler** — add
     `isMultiTripModalVisible` and `multiTripContext` state; implement `handleEndSelectedTrips(selectedUserIds)` to:
     - run `Promise.all(selectedUserIds.map(userId => endTrip({ store_id: multiTripContext.storeId === 'other' ? undefined : multiTripContext.storeId, user_id: userId })))`
     - collect created trip IDs
     - register one `pushAction` with label `Ended N trips at [StoreName]` (or all stores equivalent), undo via `Promise.all(revertArchival({ trip_id }))`, redo via same per-user `endTrip` calls
     - close/reset modal state
  5. **Modal Render Placement** — render `<MultiTripModal>` near existing modal area with `storeName={multiTripContext?.storeName ?? 'All Stores'}`, `users={multiTripContext?.users ?? []}`, confirm/cancel handlers.
  6. **Ensure:** existing list rendering, sort/group behavior, toggle/edit/add flows, and single-user end-trip undo semantics remain unchanged.

## New Files

- `supabase/migrations/20250101000006_add_purchased_by_to_list_items.sql` — add schema change exactly:
  `ALTER TABLE list_items ADD COLUMN IF NOT EXISTS purchased_by UUID REFERENCES profiles(id);`

- `client/components/MultiTripModal.tsx` — presentational modal component with props:
  - `visible`, `storeName`, `users`, `onConfirm`, `onCancel`
  - `TripUser` fields: `userId`, `displayName`, `displayNameShort`, `color`, `itemCount`
  Required behavior:
  - internal `selectedUserIds: Set<string>` initialized to all users when modal becomes visible
  - header text `End Trips at [StoreName]` plus close button
  - user rows with test IDs `multi-trip-user-row-{userId}` and checkbox `multi-trip-checkbox-{userId}`
  - initials badge (32x32 colored circle, white initials using `displayNameShort?.slice(0, 2).toUpperCase()` fallback to first 2 chars of `displayName` before `@`)
  - item count label `(N items)`
  - footer buttons with test IDs `multi-trip-cancel`, `multi-trip-confirm`
  - confirm disabled when no users selected
  - root test ID `multi-trip-modal`

- `client/components/__tests__/MultiTripModal-test.tsx` — tests:
  - renders all users with names and item counts
  - all users selected by default
  - tapping row toggles selection
  - confirm button disabled when no users selected
  - onConfirm receives selected IDs only
  - onCancel called from Cancel
  - initials badge uses `user.color`

- `client/api/__tests__/list-f2-test.ts` — tests:
  - `useTogglePurchased` sets `purchased_by` to current `userId` when checking
  - `useTogglePurchased` clears `purchased_by` to `null` when unchecking
  - realtime mutation tracking increment/decrement occurs around toggle mutation
  - `useEndTrip` adds `.eq('purchased_by', user_id)` only when `user_id` provided
  - `useEndTrip` omits purchased_by filter when `user_id` omitted
  - `shopping_trips` insert uses provided `user_id`
  - household guard throws when `householdId` is null

- `client/api/__tests__/profile-f2-test.ts` — tests:
  - `useHouseholdMembers` returns rows with `id, display_name, display_name_short, color`
  - null household path returns empty array or disabled query behavior

- `client/app/__tests__/auth-color-test.tsx` — tests exported `pickProfileColor`:
  - empty household -> `#2563eb`
  - first unused color selection (blue+green used -> `#ea580c`)
  - all seven used -> wraps to `#2563eb`

- `client/app/(tabs)/__tests__/index-f2-test.tsx` — tests with wrapper `SafeAreaProvider + QueryClientProvider + UndoProvider + HouseholdProvider`, and mocked household/members data:
  - checkbox renders current-user outlined style with `avatarColor`
  - checkbox renders other-user filled style with other member color
  - unchecked renders gray circle
  - single purchaser end-trip path uses `Alert.alert` and not modal
  - multi-purchaser path opens `MultiTripModal` and not Alert
  - confirm in modal calls `endTrip` once per selected user
  - deselected user is not archived (no `endTrip` call for that user)
  - one combined `pushAction` call after multi-user end trip with label containing `N trips`

## Patterns Applying
- Realtime Mutation Tracking: Yes — `useTogglePurchased` and `useEndTrip` mutate `list_items`; wrappers must remain and still surround Supabase writes.
- Household Guard: Yes — `useEndTrip` keeps household insert guard (`No household ID found`); `useTogglePurchased` is update-only and does not require an insert guard.
- Undo Registration: Yes — end-trip flows in `index.tsx` must keep single-user undo and add one combined undo action for multi-user trip endings.

## Ambiguities / Questions
- None.
