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

**Decision:** Add `purchased_by UUID REFERENCES auth.users(id)` to `list_items`. Set it when `is_purchased` flips to `true`; clear it when unchecked.

**Rationale:** This is the minimum change needed to know who checked off what. No new tables required.

**Status:** Migration not yet written. Requires a new migration file.

---

### 2. Schema: Profile columns `display_name_short` and `color`

**Decision:** Both columns already exist on `profiles` via migration `20250101000004_add_profile_display_fields.sql`.
- `display_name_short TEXT` — short name shown in dialogs and as the source for initials
- `color TEXT DEFAULT '#2563eb'` — user's assigned identity color

**Status:** Schema is done. Client code does not yet use these columns.

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

**Decision:** Two-signal approach — color alone is insufficient (color-blind users, ambiguous with 3+ people):

- **Current user's checked items:** their profile color on the checkbox/check icon. No initials badge. *"Mine — no label needed."*
- **Other users' checked items:** their profile color on the checkbox/check icon + a small circular initials badge (2 characters, white text on their color).

**Initials derivation:** Computed client-side from `display_name_short`:
- Take the first letter of each word, limit to 2 characters (e.g. "Mike Smith" → "MS")
- If only one word, take first 2 characters (e.g. "Mike" → "MI")
- If `display_name_short` is not set, fall back to the first 2 characters of the email prefix

**User control over initials:** The user sets/changes their initials indirectly by editing `display_name_short` in Settings (F7). There is no separate `initials` column — derivation happens at render time. This keeps the schema simple and lets users set display names like "MJ" if they want specific 2-char initials.

**Alternatives considered:**
- Separate `initials` column — rejected as unnecessary complexity; display_name_short gives equivalent control
- Color-only identification — rejected as insufficient for color-blind users and ambiguous when 3+ people are shopping
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

## F7 Dependency

The following F2 features require a Settings screen (F7):
- Editing `display_name_short` (which controls initials)
- Editing profile `color`

**F2 can ship without F7** with graceful degradation:
- Display names in the multi-trip dialog fall back to email prefix
- Colors are auto-assigned and unchangeable until F7 ships
- Initials are auto-derived and unchangeable until F7 ships

This means F2 and F7 are independent but complementary. F2 ships full functionality; F7 adds personalization on top.

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

1. Migration: add `purchased_by UUID REFERENCES auth.users(id)` to `list_items`
2. Update `useTogglePurchased` to set `purchased_by: currentUserId` on check, `null` on uncheck
3. Update profile creation in `auth.tsx` to auto-assign a color from the palette
4. Fetch `purchased_by` user's profile (color, display_name_short) in the shopping list query
5. Color-code check-off icons by `purchased_by` profile color
6. Show initials badge for items purchased by other users (not current user)
7. Update `useEndTrip` to detect multiple purchasers and surface the selection modal
8. Update undo to handle multi-trip archival (one `pushAction` covering N records)
9. [F7] Display name and color editing in Settings

---

## Revision History

- 2025-01-01: Initial design (multi-user-trips.md)
- 2026-02-27: Updated — renamed to F2 convention; resolved all open questions: one-record-per-user trips, fixed profile colors with 7-color palette, "mine vs. others" via color + initials badge (no separate initials column), multi-user dialog confirmed as Modal, F7 dependency scoped as graceful degradation
