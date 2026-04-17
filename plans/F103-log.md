# F103 Feature Log

## 2026-04-15 — Designed
- **Design:** `docs/design/F103-list-item-quantity-refactor.md`
- **GitHub Issue:** #103
- **Blocks:** F78 (Duplicate Entry Handling)
- **Scope:** Split `list_items` into a parent table (per-item fields) and a new `list_item_quantities` child table (per-quantity fields). Pure refactor — no user-visible behavior change. Existing rows migrate to single-entry parents; multi-entry items arrive with F78.
- **Key decisions:** Child table (not JSONB). Parent `archived_at` bookkeeping preserves F9 trip-history queries. Unique index on `(item_id, store_id, household_id)` deferred to F78 to avoid regression window. Query from `list_items` with embedded `quantities` (Option B). Two realtime channels; remote toast uses client-side cache lookup to get parent name (no name denormalization onto entries). Single atomic migration with one-time dedup sweep of existing active master-item duplicates.

## 2026-04-15 — Specced
- **Spec:** `specs/F103-list-item-quantity-refactor.md`
- **GitHub Issue:** #103
- **Review Level:** Full
- **Scope:** Add migration `20250101000019_f103_list_item_quantities.sql` (create child table + RLS + realtime publication + `archive_empty_list_items()` SECURITY DEFINER function + dedup + split + drop old columns). Rewrite `client/api/list.ts` (new `QuantityEntry` type, new `ListItem` shape with embedded quantities, dual realtime subscriptions with cache-based name lookup, `useTogglePurchased`/`useAddToList`/`useDeleteListItem`/`useEndTrip`/`useRevertArchival` updated, split `useUpdateListItem` into `useUpdateListItemFields` + `useUpdateQuantityEntry`). Rewrite `client/app/(tabs)/index.tsx` flatData/handlers/onDragEnd. Update `client/api/trips.ts` and `client/app/(tabs)/history.tsx` for archived queries that reference per-quantity fields. Update all tests that mock `ListItem` shape (~7+ files explicitly listed).
- **Closes on ship:** #103

## 2026-04-16 — Review 1 (Needs Fixes)
- **Result:** Needs Fixes — 3 blocking issues
- **Tests:** 585/596 passed (4 F103 tests skipped, 7 pre-existing skips)
- **Blocking:**
  1. `useTripHistory` broken FK join: `list_items(id)` embed in trip summary query relies on dropped `list_items.trip_id` FK; must change to `list_item_quantities(id)`. Runtime failure on history screen.
  2. 4 spec-required F103 tests are `it.skip`'d: remote toast cache lookup (×2 in list-f103-test.tsx), checkbox q2 toggle and end-trip (×2 in index-f103-test.tsx).
  3. Migration `20250101000019` not applied to remote (local-only per `supabase migration list`).
- **Non-blocking:**
  - `handleDelete` undo for multi-entry parents uses `addItem()` which creates duplicate parent when `parentDeleted=false` — only reachable after F78 ships. Added to BACKLOG.
- **Next:** Fix B1 (`useTripHistory` query + `TripSummary` interface + history.tsx item count), unskip and fix B2 tests, apply migration to remote.

## 2026-04-16 — Review 2 (Passed)
- **Result:** Passed — no blocking issues
- **Tests:** 589/596 passed (7 pre-existing skips from helper module)
- **Non-blocking:** none new (Review 1 NB item already in BACKLOG)

## 2026-04-17 — Shipped
- **Commit:** `feat: F103 list item / quantity model refactor (#103)`
- **Closed:** #103
