# Implementation Plan: F9 Trip History View

## Files to Modify

- `client/app/(tabs)/_layout.tsx` —
  1. **Add History Tab Screen** — Add a third `Tabs.Screen` with `name="history"`, title `"History"`, and `TabBarIcon` `"history"`, positioned after the existing `items` tab.
  2. **Ensure:** keep existing `index` and `items` tab options and behavior unchanged.

- `client/api/list.ts` —
  1. **Update `useEndTrip` Insert Payload** — In `useEndTrip`, call `supabase.auth.getUser()` before inserting `shopping_trips`, then include `user_id: user?.id ?? null` in the insert payload.
  2. **Preserve Existing End-Trip Flow** — Keep current household guard, realtime mutation tracking wrapper, trip creation/update flow, and existing return behavior intact.
  3. **Ensure:** do not modify other hooks or functions in `list.ts`; do not change undo behavior in calling screens.

## New Files

- `supabase/migrations/20250101000005_add_user_id_to_shopping_trips.sql` — Add nullable `user_id UUID REFERENCES profiles(id)` to `shopping_trips` using `ADD COLUMN IF NOT EXISTS`.

- `client/api/trips.ts` — Add `TripSummary` and `TripItem` interfaces plus:
  - `useTripHistory()` querying completed `shopping_trips` with joins for primary store, owner profile, and `list_items(id)`, ordered by `ended_at` descending, enabled only when `householdId` exists.
  - `useTripItems(tripId)` querying archived `list_items` for a selected trip with store join, ordered by name, enabled only when `tripId` is present.

- `client/app/(tabs)/history.tsx` — Implement read-only History tab screen:
  - Fetch current user id on mount via `supabase.auth.getUser()` and store as local state.
  - Render history list rows with store fallback (`All Stores`), formatted end date, item count, and conditional owner label for non-current-user trips only.
  - Open a slide modal on row press; modal header includes owner only for other-user trips.
  - Use `useTripItems(selectedTrip?.id ?? null)` for modal details, showing item name + quantity and conditional per-item store label when different from selected trip primary store.
  - Include loading and empty states in both screen and modal; close button resets selected trip to `null`.

- `client/app/(tabs)/__tests__/history-test.tsx` — Add history screen tests from spec:
  - loading indicator while history loads
  - empty state message
  - one row per trip
  - store display and `All Stores` fallback
  - formatted end date
  - item count
  - no owner shown for own trips
  - owner short name shown for other-user trips
  - fallback to email prefix when `display_name_short` missing
  - `user_id: null` treated as own trip
  - row press opens modal
  - own-trip modal header excludes owner
  - other-user modal header includes owner
  - modal item list rendering
  - close button dismisses modal
  Required mocks: `@/api/trips` hooks and `@/lib/supabase` `auth.getUser`.

- `client/api/__tests__/list-test.ts` — Add/initialize tests for `useEndTrip` user attribution:
  - sets `user_id` to authenticated user id when `auth.getUser()` returns a user
  - sets `user_id` to `null` when `auth.getUser()` returns no user
  Required mocks: Supabase `auth.getUser`, `from('shopping_trips').insert`, and chain behavior needed by `useEndTrip`.

## Patterns Applying

- Realtime Mutation Tracking: No — history feature itself is read-only; `useEndTrip` keeps existing tracking unchanged.
- Household Guard: Yes — `useEndTrip` insert remains household-guarded; new trip queries are read-only.
- Undo Registration: No — no new undoable actions; existing undo registration for end trip remains unchanged in caller.

## Ambiguities / Questions

- `history.tsx` date formatting is specified as `toLocaleDateString()` with example `"Jan 15, 2025"`; tests should assert using a deterministic expected value strategy (locale/timezone-safe) to avoid environment-dependent failures.
