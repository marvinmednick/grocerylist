# Design: Smart Entry Model
<!-- ID: F12 | Status: Designed -->

## Overview

Replace per-item store selection with an always-active store context that determines where items are added. Shift master item store data from a single `default_store_id` to a richer preference/avoidance model (`item_store_preferences`). Make stores household-scoped and add a store creation UI. Generate warnings at add time (stored on `list_items`) when items are added to avoided, unavailable, or non-preferred stores, or with non-standard quantities.

## User Scenarios

- **Quick add**: User selects "Costco" as active store, types "milk", taps to add → milk goes to Costco section with no extra taps.
- **Store switch**: User finishes Costco items, taps store selector, switches to "Safeway", continues adding.
- **Avoidance warning**: User adds "Salmon" at Walmart. Salmon is marked "avoided" at Walmart (comment: "not fresh"). Toast appears: "Salmon is avoided at Walmart — not fresh." Badge appears on the list item.
- **Non-preferred soft badge**: User adds "Bread" at Costco. Bread has Safeway as preferred. Small badge on the list item indicating a preferred store exists elsewhere. No toast.
- **New store**: User taps store selector → "+ Add new store" → modal to create "Sprouts" with a color → Sprouts becomes active store.

## Design Decisions

### Active Store Storage
**Decision:** AsyncStorage (per-device, session-persistent)
**Rationale:** The active store is a local shopping context ("I'm at Costco right now"), not something that needs to sync across devices. Matches the existing theme preference pattern in `lib/theme.tsx`.
**Alternatives considered:** React state (too ephemeral — resets on reload), Supabase profiles column (unnecessary network writes on every store switch).

### Active Store Selector Placement
**Decision:** Replaces "Shopping List" title text in the global header. Displays as store name in store's `color_code` with a ▾ dropdown chevron. Tap opens store picker dropdown.
**Rationale:** The title is decorative — users know what screen they're on from the tab. Active store is more actionable information in that space.
**Layout:**
```
[ Active Store ▾ ] [ Shopping/Planning | Undo | Redo | Avatar ]
[ ============ SmartAddItem ======================== ]
```
Store name font: ~18-20px (smaller than the old 28px title, still prominent).

### Store Selector Dropdown
**Decision:** Dropdown list below the selector showing all household stores + "+ Add new store" option.
**Format:** Each row shows store color dot + store name. Checkmark on currently active store. Tap to select and dismiss. Tap outside to dismiss without change.

### Store Creation
**Decision:** Modal (not inline in dropdown). Name field + color picker (row of color dots) + "Add" button. New store becomes the active store after creation.
**Rationale:** Modal is consistent with the established creation pattern (master items, etc.) and gives room for the color picker.

### Stores Become Household-Scoped
**Decision:** Add `household_id` column to `stores` table. Add RLS policies matching other household-scoped tables. Update `api/metadata.ts` to filter by household. Reduce stale time (stores are now mutable per-household).
**Migration:** Assign existing global store rows to all existing households (or to the single default household in single-household mode).
**Rationale:** User-created stores like "My Local Deli" should not appear for other households.

### `default_store_id` Removal
**Decision:** Remove `default_store_id` column from `items` table. Migrate existing values into `item_store_preferences` rows with `status = 'preferred'`.
**Rationale:** The active store model replaces per-item default store. Store relationships are now richer (preferred/avoided/unavailable) and live in a dedicated table.

### Item Store Preferences Table
**Decision:** New `item_store_preferences` table replaces `item_stores`:

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID | PK |
| `item_id` | UUID | FK → items, ON DELETE CASCADE |
| `store_id` | UUID | FK → stores, ON DELETE CASCADE |
| `status` | TEXT | `'preferred'`, `'avoided'`, `'unavailable'` |
| `comment` | TEXT | Nullable — "bad quality", "cheapest here", etc. |
| `household_id` | UUID | FK → households |
| **unique** | | `(item_id, store_id)` |

- No row for an item×store pair = neutral (available, no preference)
- Only stores with an explicit opinion get a row
- Comment is optional on any status

**Migration:** Existing `item_stores` rows with `is_preferred = true` → `item_store_preferences` with `status = 'preferred'`. Non-preferred `item_stores` rows are dropped (they represented "available at" which is now the default for all stores). Drop `item_stores` table after migration.
**Rationale:** Three separate tables was considered but a single table with a status enum is simpler — one join, comment lives next to the status it explains.

### Warning Generation (F12 scope — display handled by F13)
**Decision:** F12 populates `list_items.warnings` JSONB at add time. F13 (now implemented) handles all display: `WarningBadge` component, badge tap popovers, amber warning toasts, and the `warning_preferences` Settings UI.

**F12's responsibility:** When an item is added to the list, generate the warnings array based on `item_store_preferences` and quantity data, and write it to the `warnings` column.

**Schema columns already exist** (created by F13 migration `20250101000010`):
- `list_items.warnings` — JSONB, default `'[]'`
- `profiles.warning_preferences` — JSONB with per-type settings

**Warning format** (written by F12, read by F13):
```json
[
  { "type": "avoided", "store_id": "...", "comment": "not fresh" },
  { "type": "unavailable", "store_id": "...", "comment": null },
  { "type": "non_preferred", "preferred_stores": ["Safeway", "Costco"] },
  { "type": "non_standard_qty", "entered": "3", "standard": ["1 gal", "1/2 gal"] }
]
```

**Trigger rules:**
| Situation | Generated warning type |
|-----------|----------------------|
| Added to `avoided` store | `"avoided"` |
| Added to `unavailable` store | `"unavailable"` |
| Preferred stores exist, added elsewhere | `"non_preferred"` |
| Quantity not in `default_qty` or `alternate_qtys` | `"non_standard_qty"` |

**Rationale:** Storing at add time captures the warning context (which may change later). Avoids re-computing on every render.

### Preference/Avoidance Management UI
**Decision:** In the Items tab master item edit modal. Current multi-store association UI (store tags with star icon) is replaced with:
- List of stores, each with a status selector (neutral / preferred / avoided / unavailable)
- Comment field appears when preferred or avoided is selected
- Undo registered for status changes

### Undo/Redo
- Active store changes: **no undo** (navigation/context action, not data mutation)
- Adding items: undo as before (existing pattern)
- Changing item_store_preferences: **undo** registered (data mutation)

### Household Scoping
- `item_store_preferences` — household-scoped (has `household_id` column + RLS)
- `stores` — becomes household-scoped (new `household_id` column + RLS)
- Active store — local (AsyncStorage), no scoping needed
- All other existing scoping unchanged

## Out of Scope
- Free-form input parsing (registered as F14)
- Batch/voice multi-item entry (future feature)
- Warning display, badge rendering, toast styling, and warning preferences Settings UI — **delivered by F13**
- Auto-selection of active store based on location or time

## F13 Dependency
F13 (List Display Density & Warnings) is in review and has already implemented the warning display layer:
- `WarningBadge.tsx` — per-type icon + color badges with tap-to-popover
- Warning toast styling (amber variant of `Toast.tsx`, 4s duration)
- `warning_preferences` column on `profiles` + Settings UI toggle
- `warnings` JSONB column on `list_items`

F12 is the **producer** (generates warning data at add time); F13 is the **consumer** (renders it). No display work needed in F12.

## Open Questions
_(None — all questions resolved during design session)_

## Revision History
- 2025-xx-xx: Initial design
- 2026-03-10: Updated — clarified F13 overlap. F13 now delivers the warning display layer (badges, toasts, preferences UI). F12 scope narrowed to warning *generation* at add time. Removed duplicate warning preference/display decisions that F13 has implemented.
