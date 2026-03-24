# Implementation Plan: F21 Items Screen Enhancements (Approved)

## Files to Modify

- `client/api/items.ts` —
  1. **Extend `MasterItem` shape with `created_at`** — add `created_at: string` to the exported interface so item records used by the screen and tests include creation timestamps for recent-item logic.
  2. **Add shared sort type** — export `SortOption = 'name_asc' | 'name_desc' | 'created_desc' | 'created_asc'` for reuse by both the hook and the items screen.
  3. **Update `useAllItems` hook signature, key, and ordering** — change signature to `useAllItems(searchTerm: string = '', sort: SortOption = 'name_asc')`; change query key to `['all_items', searchTerm, sort]`; keep existing `.select(...)` shape and apply `.order(...)` exactly as:
     - `name_asc` -> `order('name', { ascending: true })`
     - `name_desc` -> `order('name', { ascending: false })`
     - `created_desc` -> `order('created_at', { ascending: false })`
     - `created_asc` -> `order('created_at', { ascending: true })`
     Keep `ilike('name', `%${searchTerm}%`)` behavior and `limit(100)` flow unchanged.
  4. **Extend existing hook tests in `client/api/__tests__/items-test.ts`** — add coverage for default name ascending order, name descending order, created_at descending order, and sort presence in query key (`['all_items', '', 'name_desc']`).
  5. **Ensure:** existing select joins (`category:categories!default_category_id(name)` and nested `item_store_preferences(... store:stores(...))`), existing staleTime value, and existing create/update invalidation behavior remain unchanged.

- `client/app/(tabs)/items.tsx` —
  1. **Add sort/filter state and hook usage** — import `SortOption`; add `sort` state defaulting to `'name_asc'` and `recentOnly` boolean state defaulting to `false`; update `useAllItems` call to `useAllItems(search, sort)`.
  2. **Add recent-window constants and helpers** — define `RECENT_DAYS = 7` and `RECENT_MS = RECENT_DAYS * 24 * 60 * 60 * 1000` above the component; add `isNewItem(item)` inside the component that compares `Date.now()` against `new Date(item.created_at).getTime()`.
  3. **Add derived list and toggle behavior** — compute `displayedItems` as `recentOnly ? (items ?? []).filter(isNewItem) : (items ?? [])`; add `handleRecentToggle` that sets `sort` to `'created_desc'` when toggling from off->on, then flips `recentOnly`.
  4. **Insert controls row below search bar and before error/loading/list content** — add 4 sort pills with testIDs `sort-pill-name_asc`, `sort-pill-name_desc`, `sort-pill-created_desc`, `sort-pill-created_asc`, plus `recent-toggle`; each sort pill calls `setSort(option)` and applies active styles when selected; Recent pill calls `handleRecentToggle` and applies active styles when enabled.
  5. **Wire list + card UI updates** — switch FlatList data from `items` to `displayedItems`; inside each card's `itemInfo` view, render a `New` badge as a sibling after `badgeRow` only when `isNewItem(item)` is true.
  6. **Add specified styles** — add `controlsRow`, `sortPill`, `sortPillActive`, `sortPillText`, `sortPillTextActive`, `newBadge`, and `newBadgeText` with the exact values from the spec.
  7. **Add new screen tests in `client/app/(tabs)/__tests__/items-sort-filter-test.tsx`** — verify control rendering, sort interaction (`useAllItems` called with `'created_desc'`), Recent filter behavior (within 7 days only, toggle off restores all, AND with search), Recent auto-sets sort to Newest, and New badge visibility for recent vs older items.
  8. **Ensure:** existing search behavior, existing modals/interactions on the Items screen, and unrelated flows (SmartAddItem/list APIs/other screens) remain untouched.

## New Files

- `client/app/(tabs)/__tests__/items-sort-filter-test.tsx` — new Items screen interaction test file covering all scenarios listed in spec "Tests to Write": sort pill rendering and interaction, Recent toggle filtering and sort side-effect, Recent+search AND behavior, and New badge presence/absence based on `created_at` age; uses the existing items-screen test mock pattern (`useAllItems`, `useMetadata`, `useUndo`, `SafeAreaProvider`).

## Patterns Applying
- Realtime Mutation Tracking: No — feature only changes read query ordering/filtering and UI state; no `list_items` mutations.
- Household Guard: No — no inserts are introduced.
- Undo Registration: No — sort/filter toggles are local UI state and do not mutate persisted list data.
