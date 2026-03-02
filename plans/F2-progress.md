## Progress Log

### Entries
- ✅ `client/lib/household.tsx` — Added `userId` to household context/query result and exposed it via provider value while keeping existing profile fields/loading behavior unchanged.
- ✅ `client/api/list.ts` — Added `purchased_by` to `ListItem`, updated toggle mutation to write `purchased_by` from household `userId`, and extended `useEndTrip` with optional `user_id` filtering + trip attribution while preserving invalidation and mutation tracking.
- ✅ `client/api/profile.ts` — Added `HouseholdMember` and new `useHouseholdMembers` query with key `['household_members', householdId]`, 5-minute stale time, exact select fields, and null-household safe empty-array behavior.
- ✅ `client/app/auth.tsx` — Added profile color palette + exported `pickProfileColor(householdId)` helper and wired profile inserts in both household modes to assign `color` using first-unused palette fallback logic.
- ✅ `client/app/(tabs)/index.tsx` — Added member-aware checkbox rendering, multi-user end-trip branching, `MultiTripModal` integration, and combined multi-trip undo/redo handling while preserving existing single-trip flow.
- ✅ `supabase/migrations/20250101000006_add_purchased_by_to_list_items.sql` — Added `purchased_by` column on `list_items` referencing `profiles(id)` with `IF NOT EXISTS`.
- ✅ `client/components/MultiTripModal.tsx` — Added modal UI for multi-user trip ending with default-all selection, per-row toggles, initials badge, required test IDs, and confirm/cancel actions.
- ✅ `client/components/__tests__/MultiTripModal-test.tsx` — Added coverage for rendering, default selection, row toggle behavior, disabled confirm state, onConfirm payload, cancel action, and initials badge color usage.
- ✅ `client/api/__tests__/list-f2-test.tsx` — Added F2 hook tests for toggle `purchased_by` payloads, end-trip user filtering/insert behavior, mutation decrement timer path, and household guard.
- ✅ `client/api/__tests__/profile-f2-test.tsx` — Added tests for `useHouseholdMembers` query shape and null-household safe behavior.
- ✅ `client/app/__tests__/auth-color-test.tsx` — Added tests for `pickProfileColor` default, first-unused selection, and full-palette fallback behavior.
- ✅ `client/app/(tabs)/__tests__/index-f2-test.tsx` — Added screen tests for checkbox variants, single vs multi purchaser end-trip routing, selected-user archival calls, and combined undo registration label.
- ✅ `client/app/(tabs)/__tests__/index-interactions-test.tsx` — Updated existing interaction tests to mock `useHouseholdMembers` so new household-members query integration remains deterministic.

### Issues
- None

### Status
Complete
