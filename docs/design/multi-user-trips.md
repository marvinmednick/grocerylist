# Multi-User Shopping Trips

## Problem

The shopping list is shared across a household, but shopping trips may not be. Two use cases:

1. **Shopping together:** Two people at the same store, both checking off items from the shared list. They want to end one combined trip.
2. **Shopping separately:** Two people at different stores (or at different times). Each needs to end their trip independently without affecting the other's active items.

## Design

### Schema Change: `purchased_by` on `list_items`

```sql
ALTER TABLE list_items ADD COLUMN purchased_by UUID REFERENCES auth.users(id);
```

Set `purchased_by` to the current user's ID when `is_purchased` flips to `true`. Clear it when unchecked.

This is the only schema change required. No new tables.

### Schema Change: User Profile Enhancements

The `profiles` table already has `display_name` (set to email at signup). Additional columns:

```sql
ALTER TABLE profiles ADD COLUMN display_name_short TEXT;  -- e.g. "Mike", editable in settings
ALTER TABLE profiles ADD COLUMN color TEXT;               -- e.g. "#10b981", assigned or chosen
```

- **`display_name_short`**: A short name shown on checked-off items and in trip dialogs. Editable via a settings screen. Falls back to the first part of email if not set.
- **`color`**: The color used for that user's check-off indicators. Auto-assigned from a palette on profile creation, or user-chosen in settings.

### UI: Color-Coded Check-Offs

When an item is checked off, the checkbox/check icon uses the `purchased_by` user's color instead of the current single green color. This makes it immediately visible who is buying what:

- Person A checks off "Milk" → green checkmark
- Person B checks off "Eggs" → blue checkmark

The color is looked up from the `profiles` table via the `purchased_by` field. The current user's own check-offs still feel natural (their assigned color), while other household members' check-offs are visually distinct.

### UI: User Display Names

- **Settings screen**: Add a "Display Name" field so users can set a short name (e.g. "Mike" instead of "mike@email.com").
- **Checked items**: Optionally show a small initial/avatar next to checked items from other users.
- **Trip dialogs**: Show the user's display name when listing active trips.

### UI: End Trip Flow

The end-trip flow stays simple in the common case and only adds complexity when there's genuine ambiguity.

#### Determining "Active Trips"

Active trips are **inferred**, not explicit. No "Start Trip" button is needed. The system groups purchased-but-not-archived items by `(store_id, purchased_by)`. Each distinct combination is an active trip.

#### Flow

1. User taps "End Trip" on a store header (or the global "End All" button).
2. System queries distinct `purchased_by` values on purchased, non-archived items at that store.
3. **One person has purchased items →** Archive immediately (current behavior, no dialog).
4. **Multiple people have purchased items →** Show a selection dialog.

#### Multi-Trip Dialog

Shown only when multiple users have purchased items at the same store:

```
End Trips at Costco
─────────────────────────────
[x] Mike's trip (4 items)
[x] Sarah's trip (2 items)
─────────────────────────────
[Cancel]          [End Selected Trips]
```

- Each row shows the user's display name and item count.
- Multiple rows can be selected (default: all selected).
- "End Selected Trips" creates one `shopping_trips` record per user (or one combined record if all are selected — TBD based on history/analytics needs).

#### Global "End All" Button

Same logic but across all stores:
- If only one user has purchased items → archive all, no dialog.
- If multiple users → show dialog grouped by store + user.

### Undo Behavior

- "End Trip" undo works as before: reverts the archival and deletes the trip record.
- If multiple trips were ended at once, the undo reverts all of them as a single action.

## Implementation Order

1. Add `purchased_by` column (migration)
2. Set `purchased_by` in `useTogglePurchased` mutation
3. Add `display_name_short` and `color` to profiles (migration)
4. Auto-assign color on profile creation
5. Add display name editing to settings screen
6. Color-code check-off icons by `purchased_by` user's color
7. Update end-trip logic to detect multi-user and show dialog
8. Update undo to handle multi-trip archival

## Future Considerations

- **Shopping Mode**: An explicit "I'm shopping at X" session that auto-sets the store filter and tracks time. The `purchased_by` data from this design feeds naturally into that feature.
- **Trip History**: With `purchased_by` on items and per-user trip records, you can show "Your trips" vs "Household trips" in history views.
- **Analytics**: "Who buys what most often" — useful for smart default assignments.
