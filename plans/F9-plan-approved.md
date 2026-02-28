# Implementation Plan: F9 Trip History View

## Files to Modify

- `client/app/(tabs)/_layout.tsx` —
  1. **Add History Tab Screen** — Add a third `<Tabs.Screen name="history">` with `title: 'History'`
     and `tabBarIcon: ({ color }) => <TabBarIcon name="history" color={color} />`, positioned after
     the existing `items` `<Tabs.Screen>` entry.
  2. **Ensure:** existing `index` and `items` tab `name`, `title`, and `tabBarIcon` options must not
     change.

- `client/api/list.ts` —
  1. **Update `useEndTrip` Insert Payload** — Inside `mutationFn`, after the `if (!householdId)
     throw` guard and before the `incrementLocalMutation()` call, add:
     `const { data: { user } } = await supabase.auth.getUser();`
     Then include `user_id: user?.id ?? null` in the `shopping_trips` insert payload.
  2. **Ensure:** the household guard, `incrementLocalMutation` / `decrementLocalMutation` wrapping,
     all other insert fields, undo registration in calling screens, and all other hooks and functions
     in `list.ts` remain unchanged.

## New Files

- `supabase/migrations/20250101000005_add_user_id_to_shopping_trips.sql` — Adds nullable
  `user_id UUID REFERENCES profiles(id)` column to `shopping_trips` using
  `ALTER TABLE shopping_trips ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES profiles(id);`
  References `profiles(id)` (not `auth.users`) so PostgREST exposes the FK for the owner join.

- `client/api/trips.ts` — Two TypeScript interfaces and two React Query hooks:
  - `TripSummary` interface: `id`, `started_at`, `ended_at`, `primary_store_id`, `user_id`,
    `store: { name: string } | null`, `owner: { display_name_short: string | null; display_name: string } | null`,
    `list_items: { id: string }[]`
  - `TripItem` interface: `id`, `name`, `quantity`, `store_id`, `store: { name: string } | null`
  - `useTripHistory()` — query key `['trip_history']`; uses `useHousehold()` to get `householdId`;
    enabled only when `!!householdId`; fetches from `shopping_trips` with exact select:
    ```
    id,
    started_at,
    ended_at,
    primary_store_id,
    user_id,
    store:stores!primary_store_id(name),
    owner:profiles!user_id(display_name_short, display_name),
    list_items(id)
    ```
    filtered with `.not('ended_at', 'is', null)` and ordered by `ended_at` descending.
  - `useTripItems(tripId: string | null)` — query key `['trip_items', tripId]`; enabled only when
    `!!tripId`; fetches from `list_items` with exact select:
    ```
    id,
    name,
    quantity,
    store_id,
    store:stores!store_id(name)
    ```
    filtered with `.eq('trip_id', tripId)` and ordered by `name` ascending.

- `client/app/(tabs)/history.tsx` — Read-only History tab screen:
  - On mount, call `supabase.auth.getUser()` in a `useEffect` and store the user id in
    `currentUserId` state.
  - Call `useTripHistory()` for the trip list; call `useTripItems(selectedTrip?.id ?? null)` for
    the modal (disabled when no trip selected).
  - Render a `FlatList` of trip rows. Each row shows:
    - Store name: `trip.store?.name ?? 'All Stores'`
    - Date: `new Date(trip.ended_at).toLocaleDateString()`
    - Item count + conditional owner: if `trip.user_id === currentUserId` or `trip.user_id` is
      null, show `"N items"`. Otherwise show
      `"· [ownerName] · N items"` where
      `ownerName = trip.owner?.display_name_short ?? trip.owner?.display_name?.split('@')[0] ?? 'Unknown'`
    - A right-facing chevron icon.
  - Tapping a row sets `selectedTrip` to open the detail modal.
  - List loading state: `<ActivityIndicator>` while `isLoading` is true.
  - List empty state: centred `"No past trips yet"` when `data` is an empty array.
  - Detail modal: React Native `<Modal animationType="slide">`, visible when `selectedTrip !== null`.
    - Header title: `"[storeName] — [date]"` for own trips; `"[storeName] — [date] · [ownerName]"`
      for other users' trips. `storeName = selectedTrip.store?.name ?? 'All Stores'`.
    - Close button top-right; sets `selectedTrip` to `null`.
    - `FlatList` of `TripItem` rows showing `item.name` and `item.quantity`.
    - Each item row also shows `item.store?.name` in parentheses when `item.store_id` differs from
      `selectedTrip.primary_store_id`.
    - Loading and empty states inside the modal.

- `client/app/(tabs)/__tests__/history-test.tsx` — History screen tests. Mocks: `@/api/trips`
  module (all hooks) and `@/lib/supabase` `auth.getUser` (return fixed `userId`). Follow mock
  pattern from `index-interactions-test.tsx`.
  - `it('shows a loading indicator while trip history is loading')` → mock `useTripHistory`
    returning `{ data: undefined, isLoading: true }`; assert `ActivityIndicator` rendered
  - `it('shows empty state when there are no past trips')` → mock returning
    `{ data: [], isLoading: false }`; assert `"No past trips yet"` present
  - `it('renders a row for each past trip')` → mock two trips; assert two rows rendered
  - `it('displays store name from trip data')` → mock trip with `store: { name: 'Safeway' }`;
    assert `"Safeway"` visible
  - `it('displays "All Stores" when primary_store_id is null')` → mock trip with `store: null`;
    assert `"All Stores"` visible
  - `it('displays formatted end date')` → mock trip with known `ended_at`; assert
    `new Date(ended_at).toLocaleDateString()` visible (self-consistent locale assertion)
  - `it('displays item count')` → mock trip with 3 items in `list_items`; assert `"3 items"` visible
  - `it('does not show owner name for current user trips')` → mock trip with `user_id` matching mock
    auth user; assert owner name NOT present in that row
  - `it('shows owner display_name_short for other users trips')` → mock trip with different
    `user_id` and `owner: { display_name_short: 'Sarah', display_name: 'sarah@test.com' }`;
    assert `"Sarah"` visible in row
  - `it('falls back to email prefix when display_name_short is null')` → mock trip with different
    `user_id` and `owner: { display_name_short: null, display_name: 'sarah@test.com' }`;
    assert `"sarah"` visible in row
  - `it('treats user_id null trips as own trips')` → mock trip with `user_id: null`; assert owner
    name NOT present
  - `it('opens detail modal when a trip row is pressed')` → `fireEvent.press` on row; assert modal
    becomes visible
  - `it('modal header shows store and date for own trip without owner')` → open modal for own trip;
    assert header does NOT contain owner name
  - `it('modal header shows owner name for other users trip')` → open modal for other user's trip;
    assert owner name present in header
  - `it('shows trip items in the detail modal')` → mock `useTripItems` with two items; open modal;
    assert both item names visible
  - `it('closes the modal when the close button is pressed')` → open modal, press close; assert
    modal no longer visible

- `client/api/__tests__/list-test.ts` — New file (does not exist yet; no JSX so `.ts` extension).
  Tests for `useEndTrip` user attribution. Required mocks: `supabase.auth.getUser`,
  `from('shopping_trips').insert`, and chain behavior needed by `useEndTrip`.
  - `it('sets user_id when ending a trip')` → mock `supabase.auth.getUser()` to return
    `{ data: { user: { id: 'user-123' } } }`; call `useEndTrip` mutationFn; assert
    `supabase.from('shopping_trips').insert` was called with `user_id: 'user-123'`
  - `it('sets user_id to null when auth returns no user')` → mock `getUser` returning
    `{ data: { user: null } }`; assert insert called with `user_id: null`

## Patterns Applying

- Realtime Mutation Tracking: No — history screen is read-only; `useEndTrip` retains its existing
  `incrementLocalMutation` / `decrementLocalMutation` wrapping unchanged.
- Household Guard: Partial — `useEndTrip` insert already has the household guard; new trip queries
  use `enabled: !!householdId` (read-only, no insert guard needed).
- Undo Registration: No — no new undoable actions; existing undo registration for end trip in the
  calling screen is unchanged.
- React Query Keys: `['trip_history']` (useTripHistory), `['trip_items', tripId]` (useTripItems).
  No existing keys need invalidation — the history screen has no mutations.

## Ambiguities / Questions

- None.
