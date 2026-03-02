# Design: Multi-User Shopping Trips
<!-- ID: F2 | Status: Designed -->

## Overview

The shopping list is shared across a household, but shopping trips may not be. Two people may shop at the same store together, or at different stores independently. This feature makes it visible who checked off what, allows trips to be ended per-user when multiple people are shopping simultaneously, and lays the groundwork for meaningful trip history per user.

## User Scenarios

- **Shopping together:** Two people at the same store, both checking off items. They want to end one combined trip — or each end their own portion if preferred.
- **Shopping separately:** Two people at different stores (or different times). Each needs to end their trip independently without affecting the other's active items.
- **At a glance:** A user wants to know at a glance which checked items they got vs. which their household partner got.

---

## Design Decisions

### 1. Schema: `purchased_by` on `list_items`

**Decision:** Add `purchased_by UUID REFERENCES profiles(id)` to `list_items`. Set it when `is_purchased` flips to `true`; clear it when unchecked.

**Rationale:** This is the minimum change needed to know who checked off what. No new tables required. The FK references `profiles(id)` (not `auth.users(id)`) so that PostgREST can resolve the join — the same approach used for `shopping_trips.user_id` in F9.

**Status:** Migration not yet written. Requires a new migration file.

---

### 2. Schema: Profile columns `display_name_short` and `color`

**Decision:** Both columns already exist on `profiles` via migration `20250101000004_add_profile_display_fields.sql`.
- `display_name_short TEXT` — short name shown in dialogs and as the source for initials
- `color TEXT DEFAULT '#2563eb'` — user's assigned identity color

**Status:** Schema is done. Client code already uses these columns: `lib/household.tsx` fetches both and exposes them as `displayNameShort` and `avatarColor` via `useHousehold()`. F7 (Done) wires them into `UserAvatar` and the Settings screen (color picker + name editing).

---

### 3. User Identity Color System

**Decision:** Each profile has a stable assigned color (stored in `profiles.color`). Colors are:
- Auto-assigned at profile creation from a predefined palette, picking the first color not already in use by another household member
- User-changeable in Settings (F7)
- Shown consistently on all devices — color has stable identity (B is always green on everyone's screen)

**Conflict behavior:** If a user picks a color already used by a household member, show a soft warning in Settings: *"[Name] is already using this color — your items may look similar to theirs."* Do not block the change.

**Profile color palette** (assigned in this order, cycling if exhausted):

| # | Color | Hex | Tailwind |
|---|-------|-----|----------|
| 1 | Blue | `#2563eb` | blue-600 |
| 2 | Green | `#16a34a` | green-600 |
| 3 | Orange | `#ea580c` | orange-600 |
| 4 | Purple | `#9333ea` | purple-600 |
| 5 | Red | `#dc2626` | red-600 |
| 6 | Teal | `#0d9488` | teal-600 |
| 7 | Pink | `#db2777` | pink-600 |

When a new profile is created, loop through this list and assign the first color not already held by another member of the same household.

---

### 4. "Mine vs. Others" Visual Identification on Checked Items

**Decision:** Inverted checkbox style for other users' items. No initials badge, no extra space required.

| | Style | Effect |
|---|---|---|
| **Current user** | Outlined circle, checkmark in their profile color, white background | Standard checkbox feel — familiar, "normal" |
| **Other users** | Filled circle in their profile color, white checkmark | Visually inverted — immediately distinct |

Example for a two-person household (user = green, wife = blue):
- User's checked items: green outlined circle with green check on white
- Wife's checked items: blue filled circle with white check

This works for any number of users — each person's color is unique (see §3), and the filled/outlined distinction immediately separates "mine" from "not mine" regardless of color.

**Alternatives considered:**
- Color + 2-char initials badge overlapping checkbox — rejected; checkbox area too small for legible initials (~24px, font would be ~7px)
- Initials at trailing edge of row — adds visual clutter; the inversion accomplishes the same distinction without extra elements
- Color-only, no style inversion — less distinct, relies entirely on users knowing their own color
- "Me = always blue" (viewer-relative) — rejected because colors lose cross-device identity and conflict resolution gets complex with 3+ users

---

### 5. Trip Records: One Per User

**Decision:** When multiple users end a trip at the same time, create one `shopping_trips` record per user (archiving only their purchased items into their record). This means a store session with two people produces two trip records.

**Rationale:** Enables per-user trip history ("Your trips" vs. "All household trips"). Makes F9 (Trip History) more meaningful. One combined record would lose the per-user breakdown.

**Alternatives considered:** One combined record for joint trips — rejected because it loses per-user history granularity.

---

### 6. End Trip Flow

**Active trips are inferred** — no "Start Trip" button. The system groups purchased-but-not-archived items by `(store_id, purchased_by)`. Each distinct combination is an active trip.

**Flow:**

1. User taps "End Trip" on a store header (or the global "End All").
2. System queries distinct `purchased_by` values on purchased, non-archived items at that store.
3. **One user has purchased items** → archive immediately, no dialog (current behavior unchanged).
4. **Multiple users have purchased items** → show the multi-user selection modal.

**Multi-user selection modal** (React Native `<Modal>`, not `Alert.alert`):

```
End Trips at Costco
─────────────────────────────
[x]  MS  Mike's trip    (4 items)
[x]  SJ  Sarah's trip   (2 items)
─────────────────────────────
[Cancel]        [End Selected Trips]
```

- Each row shows the user's initials badge (their color + 2-char initials), display name, and item count
- All rows selected by default
- User can deselect to leave someone else's trip active
- "End Selected Trips" creates one `shopping_trips` record per selected user

**Global "End All":** Same logic but across all stores. Multi-user dialog groups by store if multiple stores are involved.

**UI decision:** React Native `<Modal>` component (not `Alert.alert`) — needed for checkbox rows with color badges. Follows the established modal pattern from ui-guidelines §7.

---

### 7. Undo Behavior

- If one user's trip is ended: undo reverts that one archival and deletes the one trip record (existing behavior).
- If multiple users' trips are ended simultaneously: undo reverts all of them as a single action (single `pushAction` with a combined undo function).

---

### 8. Profile Color Resolution on the Shopping List

**Decision:** Use a dedicated `useHouseholdMembers` hook (Option B) rather than joining purchaser profiles inline on the `useShoppingList` query (Option A).

`useHouseholdMembers` fetches all profiles for the household once with a long `staleTime`. The component builds a `Map<userId, { color, displayNameShort }>` and looks up each item's `purchased_by` at render time:

```typescript
// One cached query
const { data: members } = useHouseholdMembers();
const memberMap = new Map(members.map(m => [m.id, m]));

// Per item render
const purchaserColor = item.purchased_by
  ? memberMap.get(item.purchased_by)?.color
  : null;
```

**Rationale:** `useHouseholdMembers` serves double duty — it provides colors for the shopping list checkboxes *and* names/colors/initials for the end-trip selection modal (§6). With Option A, a separate member query would still be needed for the modal, so you end up with two queries anyway. Option B fetches profiles once and reuses the result everywhere. At typical household size (2–4 people), the cached query is essentially free.

**Alternatives considered:** Option A (inline join on `useShoppingList`) — simpler wiring, but returns profile data once per purchased item (redundant), and still requires a separate members query for the end-trip modal.

**New hook:** `useHouseholdMembers` — new function in `api/profile.ts`. Fetches `id, display_name_short, display_name, color` for all profiles with matching `household_id`. React Query key: `['household_members', householdId]`.

---

## F7 Dependency

**F7 is Done.** The dependency is fully satisfied:
- `display_name_short` and `color` are editable in the Settings screen
- `useHousehold()` already exposes both as `displayNameShort` and `avatarColor`
- Color auto-assignment at profile creation is the one remaining F2 implementation item (see Implementation Order step 3)

---

## Out of Scope

- **Shopping Mode** (explicit "I'm shopping at X" session) — deferred; `purchased_by` data feeds naturally into it
- **Per-user trip analytics** ("who buys what most often") — deferred to a future analytics feature
- **"Your trips" vs. "All trips" filter in history** — deferred to a future F9 enhancement

---

## Open Questions

None. All design decisions resolved.

---

## Implementation Order

1. Migration: add `purchased_by UUID REFERENCES profiles(id)` to `list_items`
2. Update `useTogglePurchased` to set `purchased_by: currentUserId` on check, `null` on uncheck
3. Update profile creation in `auth.tsx` to auto-assign a color from the palette
4. Add `useHouseholdMembers` hook to `api/profile.ts`; use it on the shopping list screen to build a `Map<userId, { color, displayNameShort }>` for purchased item rendering
5. Render checked items: current user → outlined checkbox in their color; others → filled checkbox in their color with white check
6. Update `useEndTrip` to detect multiple purchasers and surface the selection modal
7. Update undo to handle multi-trip archival (one `pushAction` covering N records)
8. ~~[F7] Display name and color editing in Settings~~ — **Done** (shipped with F7)

---

## Revision History

- 2025-01-01: Initial design (multi-user-trips.md)
- 2026-02-27: Updated — renamed to F2 convention; resolved all open questions: one-record-per-user trips, fixed profile colors with 7-color palette, "mine vs. others" via inverted checkbox style (outlined = mine, filled+inverted = others; no badges or extra space), multi-user dialog confirmed as Modal, F7 dependency scoped as graceful degradation
- 2026-03-01: Updated — corrected `purchased_by` FK to reference `profiles(id)` (not `auth.users(id)`) for PostgREST join compatibility; added §8 profile color resolution (Option B: `useHouseholdMembers` hook, serves both shopping list and end-trip modal); updated §2 status (F7 Done, columns already in use); updated F7 Dependency section; marked Implementation Order step 8 as done
