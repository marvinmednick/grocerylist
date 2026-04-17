# Design: List Item / Quantity Model Refactor
<!-- ID: F103 | Status: Designed -->

## Overview

Split the current `list_items` table into two: a parent `list_items` row that holds per-item fields (identity, name, store, category, warnings) and a new child `list_item_quantities` table that holds per-quantity fields (the quantity text, purchase state, trip linkage). A single logical list item can then hold one or more quantity entries.

F103 is a pure refactor — no user-visible behavior change. Every existing list item migrates to a single-entry parent; every visible row still renders the same way. Multi-entry items only appear once F78 (Duplicate Entry Handling) ships and routes duplicate adds through a "merge" or "duplicate-as-entry" path.

## User Scenarios

F103 has no end-user scenarios of its own. It is the data-model prerequisite that makes the following F78 scenarios coherent and cheap to implement:

- User has "Chicken Breast 1.5 lb" on the list and adds "Chicken Breast 1.5 lb" again; F78 offers "duplicate as a separate quantity" which appends an entry to the existing logical item rather than creating a second coincident row.
- Drag moves a logical item between stores; if that item has multiple quantity entries, they all move together because they share a parent `store_id` — no render-time adjacency glue.
- Warnings for a given item at a given store are computed once, stored once on the parent, displayed once — not duplicated across sibling rows.

See `docs/design/F78-duplicate-entry-handling.md` for the UI scenarios that consume this model.

## Design Decisions

### Storage shape — child table (not JSONB)

**Decision:** Introduce `list_item_quantities` as a separate child table keyed by `list_item_id`. Each row is one quantity entry. Do not use a JSONB array column on `list_items`.

**Rationale:**
- **Concurrency.** The natural Supabase JS add/update pattern is read-modify-write. With JSONB, two users toggling different entries on the same parent row would each fetch the array, modify their entry, and write the full array back — losing one user's change. A child-table row per entry turns independent per-entry actions back into independent row writes, which Postgres handles safely via row-level locking (same pattern as today).
- **Trip archival.** Entries archive individually (some purchased, others not). A row-level UPDATE on `list_item_quantities` is natural; JSONB would force per-entry `archived_at` and `trip_id` fields inside the array, bloating it, and every archival query would need `jsonb_array_elements` unnesting.
- **Realtime granularity.** Postgres emits one event per row change. Child-table rows give per-entry realtime events; JSONB gives full-row replacement and forces the client to diff the array.
- **Query ergonomics.** Simple SQL columns support indexes, `WHERE is_purchased = true`, joins to `shopping_trips`, etc. JSONB equivalents are awkward.

**Alternatives considered:** JSONB `quantities` column on `list_items` — rejected for the reasons above. Simpler migration and one fewer RLS surface weren't enough to offset the concurrency/archival complexity.

### Parent row lifecycle — archive parent when last entry archives

**Decision:** Keep `archived_at` on `list_items`. When the last non-archived entry of a parent archives (via end-trip), set the parent's `archived_at` in the same transaction. When a user deletes the last non-archived entry of a parent, delete the parent in the same transaction. `useRevertArchival` reverses both.

**Rationale:** Trip history (F9) renders archived `list_items` rows directly; preserving parent `archived_at` keeps those queries working unchanged. The alternative (no parent `archived_at`, filter active list via `EXISTS` join) would require rewriting every query that filters by archived state.

**Alternatives considered:** Delete parent when last entry archives — rejected because trip history needs the parent's name, store, category, and warnings for archived entries; keeping the parent alive (just archived) preserves those. Leave parent untouched and filter via join — rejected for query-shape churn across F9 and anywhere else that currently reads `list_items`.

### Unique invariant on `(item_id, store_id, household_id)` — deferred to F78

**Decision:** F103's migration does NOT add a unique index on `(item_id, store_id, household_id) WHERE archived_at IS NULL AND item_id IS NOT NULL`. That index lands with F78, paired with the duplicate-resolution dialog that knows how to respond to a `unique_violation`.

**Rationale:** Adding the constraint before the UI exists creates a regression window: any double-add between F103 and F78 would fail with an unhandled database error. Current behavior (silent duplicate creation) is strictly better than that until F78 ships the dialog.

F103's migration **does** do a one-time dedup sweep on existing data: for each `(item_id, store_id, household_id)` group of active parent rows, pick the earliest-`added_at` parent as keeper and convert the remaining rows into additional entries under that keeper. This leaves the data cleanly shaped for F78 and exercises the multi-entry path with real data before F78 depends on it.

F78's own migration re-runs the same sweep (to clean up any duplicates that accumulated between F103 and F78) before creating the unique index.

**Alternatives considered:** Add the index in F103 — rejected per the regression-window reason above.

### Query shape — from parent, embed quantities (Option B)

**Decision:** `useShoppingList` queries `list_items` and embeds `quantities:list_item_quantities!list_item_id(*)`. The client receives one object per logical item with a nested array of entries.

**Rationale:** The logical item is the primary entity for grouping, sorting, duplicate detection, drag, warning display, and item-level edits. Only toggle and per-quantity edit act on an individual entry. Putting the parent at the root of the response matches the more common access pattern and guarantees sibling entries render adjacent (they fall out of an inner loop, not from a server-ordered flat list).

**Alternatives considered:** Query `list_item_quantities` with embedded parent (1:1 row-to-render mapping). Rejected because sibling adjacency would require server-side ordering by `list_item_id`, and any future sort (alpha by item name, by category) would need to pre-group by parent and re-expand — which is just Option B with extra steps.

### Column split

**Decision:**

`list_items` (parent) keeps:
`id`, `item_id`, `name`, `category_id`, `store_id`, `warnings`, `match_metadata`, `added_at`, `added_by`, `household_id`, `archived_at`, `created_at`.

`list_item_quantities` (child) holds:
`id`, `list_item_id` (FK, `ON DELETE CASCADE`), `quantity`, `quantity_parsed`, `is_purchased`, `purchased_at`, `purchased_by`, `trip_id`, `archived_at`, `added_at`, `added_by`, `household_id`, `created_at`.

Both tables carry `household_id` for RLS. `added_at`/`added_by` appear on both: parent = when the logical item first appeared on the list; entry = when this specific quantity entry was created (matters for duplicate-append via F78). `trip_id` lives on the entry — individual entries archive into individual trips.

**Rationale:** Every field ends up on the side that describes its semantic owner. Per-item facts (what the item *is*, where it lives, what warnings apply to it here) stay on the parent; per-quantity facts (how much, whether it's been bought, by whom, under which trip) live on the entry.

### Realtime subscriptions — both tables, client-side name lookup

**Decision:** Subscribe to both `list_items` and `list_item_quantities` realtime channels. Both invalidate `['shopping_list']` and run through the existing `localMutationCount` suppression. Add the child table to the realtime publication in the migration.

For the remote-change toast, **do not** denormalize `name` onto `list_item_quantities`. Instead, on a remote `list_item_quantities` event, look up the parent name via the client-side React Query cache (`queryClient.getQueryData(['shopping_list'])` → find by `list_item_id` → read `name`). Fall back to a generic `"List updated"` message if the parent is not yet in cache (rare transient; self-correcting on the next refetch).

**Rationale:**
- **Two subscriptions:** toggle and quantity-edit events fire on the child table only. Without that subscription, remote toggles would leave the local list stale until a manual refetch.
- **Client-side name lookup:** the parent is almost always already in cache for any event concerning an item the user can see. Zero extra queries, preserves named toasts in ~100% of practical cases, and avoids introducing a duplicated `name` field that would need to be kept in sync on every parent rename. F103's motivation is to group records as "one item, many entries" — adding a denormalized name column to the entries works against that grouping principle for a feature (toast text) that doesn't justify the invariant cost.

**Alternatives considered:**
- Extra SELECT on each remote entry event — rejected; the cache already has the name.
- Denormalize `name` onto each entry — rejected; re-introduces the parallel-update hazard F103 closes, for zero rendering benefit (Option B's query already embeds the parent everywhere else).
- Generic toast for child events — rejected; named toast is preserved trivially via cache lookup.

### Migration — single atomic migration

**Decision:** One migration file (`supabase/migrations/20250101000019_f103_list_item_quantities.sql`) performs, in order:

1. `CREATE TABLE list_item_quantities (...)` with FK to `list_items` (`ON DELETE CASCADE`), household-scoped RLS policy, household index.
2. `ALTER PUBLICATION supabase_realtime ADD TABLE list_item_quantities`.
3. **Dedup sweep:** for each `(item_id, store_id, household_id)` group in `list_items` where `archived_at IS NULL AND item_id IS NOT NULL` with more than one row, pick the earliest-`added_at` row as keeper; insert child entries for all rows (keeper + duplicates), copying per-quantity fields; delete the non-keeper parent rows.
4. **Split:** for each remaining `list_items` row, insert one `list_item_quantities` row carrying the per-quantity fields.
5. `ALTER TABLE list_items DROP COLUMN quantity, quantity_parsed, is_purchased, purchased_at, purchased_by, trip_id`.
6. Update `supabase/full_schema.sql` to reflect the new shape.

**Rationale:** The schema change is coupled to the client rewrite; both ship together, so a single atomic migration is simpler than a multi-phase (dual-write, backfill, drop) strategy. The dedup step is idempotent data cleanup that exercises the multi-entry path with real data before F78 depends on it.

**Alternatives considered:** Multi-phase migration — unnecessary for a small-household app where schema + client version ship together.

### Mutation targeting (post-refactor)

| Action | Targets | Parent-side side effect |
|---|---|---|
| Toggle purchased | entry id | none |
| Edit qty | entry id | none |
| Edit name / category / store | parent id | none |
| Drag to another store | parent id | all sibling entries follow |
| Delete row | entry id | if last active entry of parent, delete parent |
| End trip | entries (archive matching) | set parent `archived_at` when no active entries remain |
| Revert trip archival | entries (clear `archived_at`, `trip_id`) | clear parent `archived_at` |

### Rewrite scope

**`client/api/list.ts`:**
- `useShoppingList` — change query shape to `list_items` with embedded `quantities`; add second realtime subscription on `list_item_quantities`; update toast handler to look up parent name from cache for child-table events.
- `useTogglePurchased` — target entry id (`list_item_quantities.id`); optimistic cache update walks parents to find the entry.
- `useAddToList` — insert parent then first entry (two statements wrapped in an RPC or sequential awaits; fall back to client-side rollback on entry-insert failure).
- `useUpdateListItem` — split into two hooks: one for parent fields (name, store, category), one for entry fields (quantity).
- `useDeleteListItem` — delete entry; check remaining entries; if none active, delete parent. Undo restores both when needed.
- `useEndTrip` — archive entries per scope; set `archived_at` on parents whose entries are all now archived (one `UPDATE ... WHERE NOT EXISTS` statement).
- `useRevertArchival` — clear `archived_at`/`trip_id` on entries AND clear parents' `archived_at` where linked.

**`client/app/(tabs)/index.tsx`:**
- `FlatListItem` item variant becomes `{ type: 'item'; id: string; data: { parent: ListItem; entry: QuantityEntry } }`.
- `flatData` — outer loop by store, inner loop `parent.quantities.filter(e => !e.archived_at).forEach(...)`.
- `handleToggle` — pass `entry.id`; undo snapshots `entry.purchased_by`.
- `handleDelete`, `handleSaveEdit` — split parent vs entry updates; undo restores each side.
- `onDragEnd` — update `parent.store_id`; sibling entries follow on refetch.
- Edit modal — name/store fields save to parent, quantity field saves to the entry being edited.

**Undo:**
- Every undoable action targets either a parent id or an entry id. Actions that create entries (add, duplicate-via-F78, undo-of-delete) use the existing `tracker` pattern on the entry id.

**Tests:**
- All `list_items` mocks update to the new shape (parent + nested quantities).
- New tests for: parent archival on last-entry-archive, parent delete on last-entry-delete, cross-store drag moving siblings together, realtime name-from-cache toast lookup, migration dedup correctness.
- Expect to touch most of the ~570 existing tests, most by mock-shape change only.

## Out of Scope

- **Duplicate detection UI / dialog.** That is F78 (`docs/design/F78-duplicate-entry-handling.md`). F103 provides the data model F78 needs; F78 provides the UI and the unique index.
- **Unique index on `(item_id, store_id, household_id)`.** Deferred to F78 per the rationale in the "Unique invariant" decision above.
- **"Split one quantity off to another store" UX.** In the refactored model, drag moves all entries of a logical item together. Splitting a single entry to a different store is a separate action (long-press menu or dedicated UI) and is not in scope for F103 or F78.
- **Per-quantity grouped checkbox rendering** (one header per parent with N sub-checkboxes). Rendering stays flat — one entry = one row, visually indistinguishable from today.
- **Multi-phase / blue-green schema migration.** Not needed for a small-household app where schema and client ship together.
- **Historical trip-history re-shaping.** Archived parent + entry rows are still readable by existing trip-history queries after the migration; no separate rewrite of F9 is planned as part of F103.

## Open Questions

None. All decisions resolved; ready for `/spec F103`.

## Revision History

- 2026-04-15: Initial design. All decisions resolved. Blocks F78.
