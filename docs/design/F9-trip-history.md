# Design: Trip History View
<!-- ID: F9 | Status: Specced -->

## Overview

Users end shopping trips regularly, archiving purchased items and creating a `shopping_trips` record. This data exists but has no UI. This feature adds a History tab showing past trips in reverse-chronological order, with a drill-down modal for the items on each trip. It is read-only — no mutations, no undo, no realtime tracking.

## User Scenarios

- "I want to see what I bought last week at Safeway" — tap the History tab, find the trip row, tap to see the item list.
- "How many things did Sarah buy on her Costco run?" — trip rows for other users show their name and item count.

---

## Design Decisions

### 1. Navigation: Third Tab

**Decision:** History is a third tab in the tab bar, after Items. FontAwesome `history` icon.

**Rationale:** Trip history is a top-level destination, not a drill-down from another screen. Consistent with how Shopping List and Items are presented.

**Alternatives considered:** Modal/sheet triggered from the Shopping List header — rejected; history is a peer destination, not subordinate to the list.

**UI tier:** Established — follows tab bar pattern from ui-guidelines §1.

---

### 2. Trip List: FlatList, Most Recent First

**Decision:** Standard `FlatList` of trip rows, ordered by `ended_at` descending. Tapping a row opens the detail modal.

**UI tier:** Established — read-only list uses `FlatList` per ui-guidelines §6.

---

### 3. Trip Row Layout — Option C (owner only for others)

**Decision:** Each row shows store name, formatted end date, and item count. The trip owner's name is shown **only when the trip belongs to someone other than the current user.**

```
│  Safeway          Jan 15, 2025   >  │   ← your trip; no owner shown
│  12 items                            │

│  Costco           Jan 12, 2025   >  │   ← someone else's trip
│  Sarah · 8 items                     │
```

- Store name: `trip.store?.name` or `"All Stores"` when `primary_store_id` is null
- Date: `new Date(trip.ended_at).toLocaleDateString()` (e.g. "Jan 15, 2025")
- Item count: `trip.list_items.length` + `" items"`
- Owner (others only): `owner.display_name_short` or fallback to first segment of `owner.display_name` before `@`; prefixed with `" · "` before the item count

**Rationale:** Your own trips don't need a name label — the absence of a name means "mine." Showing owner only for others keeps the list clean for single-user households (no labels ever) while being informative in multi-user households.

**Alternatives considered:**
- Always show owner name (Option A/B) — adds noise for single-user households and for your own trips
- Never show owner — loses multi-user context

**UI tier:** Extension of established list row pattern; conditional owner display is novel for this app — recorded in ui-guidelines Decision Log.

---

### 4. Detail Modal

**Decision:** React Native `<Modal>` (established pattern, ui-guidelines §7). Triggered by tapping a trip row.

- **Header (your trip):** `"Safeway — Jan 15, 2025"`
- **Header (other user's trip):** `"Safeway — Jan 15, 2025 · Sarah"`
- Owner name appended at the end with `" · "` separator, same fallback logic as the list row
- Close button: top right (established pattern)
- Content: `FlatList` of items showing `name` and `quantity`
- Multi-store items: show `item.store?.name` in parentheses when it differs from the trip's primary store
- Loading and empty states inside the modal

**UI tier:** Established Modal pattern; owner suffix in header follows the `" · "` separator convention established in the trip row.

---

### 5. Schema: `user_id` on `shopping_trips`

**Decision:** Add `user_id UUID REFERENCES profiles(id)` to `shopping_trips`. Set it to `currentUserId` in `useEndTrip` on every trip creation.

**Reference `profiles(id)` not `auth.users(id)`** — this exposes the FK to PostgREST, enabling the Supabase join `owner:profiles!user_id(display_name_short, display_name)` in the trip history query.

**Why now:** F9 needs trip owner to display it. F2 also needs this column (one record per user). Adding it in F9 means F2's schema work is already done when F2 is implemented. The column is nullable so existing trip records are unaffected.

**Migration:** New file required — `ALTER TABLE shopping_trips ADD COLUMN user_id UUID REFERENCES profiles(id);`

**Alternatives considered:** Infer owner from `purchased_by` on `list_items` — requires a subquery or separate fetch per trip; noisier and not needed once `user_id` is on the trip record directly.

---

### 6. Supabase Query Shape

**Trip list** (`useTripHistory`):
```typescript
supabase
  .from('shopping_trips')
  .select(`
    id,
    started_at,
    ended_at,
    primary_store_id,
    user_id,
    store:stores!primary_store_id(name),
    owner:profiles!user_id(display_name_short, display_name),
    list_items(id)
  `)
  .not('ended_at', 'is', null)
  .order('ended_at', { ascending: false })
```

**Trip items** (`useTripItems`) — unchanged from original spec:
```typescript
supabase
  .from('list_items')
  .select(`id, name, quantity, store_id, store:stores!store_id(name)`)
  .eq('trip_id', tripId)
  .order('name', { ascending: true })
```

**TypeScript interface additions:**
```typescript
export interface TripSummary {
  id: string;
  started_at: string;
  ended_at: string;
  primary_store_id: string | null;
  user_id: string | null;
  store: { name: string } | null;
  owner: { display_name_short: string | null; display_name: string } | null;
  list_items: { id: string }[];
}
```

---

### 7. "Is this mine?" check

The component compares `trip.user_id` against the current user's ID from Supabase auth (`supabase.auth.getUser()` or the session). If they match, suppress the owner display. If `user_id` is null (legacy trips before the migration), suppress the owner display (treat as own trip).

---

### 8. No Undo, No Realtime, No Mutations

Read-only screen. Do not call `pushAction`, `incrementLocalMutation`, or `decrementLocalMutation`. RLS on `shopping_trips` and `list_items` handles household scoping — no household guard needed on queries.

---

## Out of Scope

- Re-adding items from history to the active list (requires UX design + mutation)
- Filtering/searching by store or date range
- Trip statistics (total items, most frequent items)
- Pagination (V1 loads all trips; acceptable at typical household volume)
- "Your trips" vs. "All trips" filter toggle

---

## Open Questions

None. All design decisions resolved.

---

## Spec Impact

The existing `specs/F9-trip-history.md` was written before this design doc. It is **out of date** in the following areas:

1. **Schema** — spec assumed no schema changes; `user_id` on `shopping_trips` is now required
2. **`useEndTrip` update** — spec did not include updating `useEndTrip` to set `user_id`
3. **Trip row** — spec did not include owner display
4. **Modal header** — spec did not include owner suffix
5. **`TripSummary` interface** — missing `user_id` and `owner` fields
6. **`useTripHistory` query** — missing `user_id`, `owner:profiles!user_id(...)` joins

**`/spec F9` should be re-run** before implementation to produce an updated spec reflecting these decisions.

---

## Revision History

- 2026-02-27: Initial design doc created (feature was previously Specced without a design doc); added trip owner display (Option C — shown only for other users), schema change `user_id` on `shopping_trips`, modal header owner suffix
