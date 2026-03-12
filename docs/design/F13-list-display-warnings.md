# Design: List Display Density & Warnings
<!-- ID: F13 | Status: Designed -->

## Overview

Redesign the shopping list item row for better phone screen density using a multi-line layout. Add a `short_name` field to master items for compact display. Implement a warning badge and toast system for store avoidance, unavailability, non-preferred stores, and non-standard quantities. Warning presentation is configurable per type in Settings.

## User Scenarios

- **Dense list view**: User scrolls through 30 items on a phone. Each row shows the item name prominently on line 1, with qty/category/store as smaller secondary text on line 2. More items visible per screen.
- **Short name**: User sets "PB" as the short name for "Peanut Butter, Creamy, Jif 16oz". List shows "PB" on line 1 with full context on line 2.
- **Warning badge**: User sees a small amber triangle on "Salmon" indicating it's avoided at the current store. Tapping the badge shows detail.
- **Warning toast**: After adding "Salmon" to an avoided store, a toast appears: "Salmon is avoided at Walmart — not fresh".
- **Settings control**: User who finds warnings annoying goes to Settings → Warnings → sets all to "Off".

## Design Decisions

### Multi-Line Item Row Layout
**Decision:** Replace the current single-line 48px row with a two-line layout:
```
[Checkbox] [ Primary Name              ] [Warning Badge] [Drag]
           [ qty · category · store     ]
```
- **Line 1:** `short_name` (if set) or `name`, ~15px font-weight 500, color `#111827`
- **Line 2:** Secondary info in 12px muted text (`#6b7280`), dot-separated: quantity, category, store name
- **Row height:** Auto from content (~52-56px), not fixed
- **Pencil edit icon removed:** Tap the row text area to edit (already works in planning mode)
- **Warning badge:** Right-aligned, before drag handle

**Rationale:** Current single-line truncates useful info. Multi-line shows everything without truncation while keeping the row compact.
**Note:** This is a **novel pattern** — first multi-line list row in the app.

### Warning Badge Visual
**Decision:** Small icons (14px) from lucide-react-native, with distinct shape AND color per warning type:

| Warning Type | Icon | Color | Hex |
|--------------|------|-------|-----|
| Avoided store | `AlertTriangle` | Amber | `#f59e0b` (amber-500) |
| Unavailable store | `XCircle` | Red | `#ef4444` (red-500) |
| Non-preferred store | `Info` | Blue-gray | `#6b7280` (gray-500) |
| Non-standard qty | `HelpCircle` | Blue-gray | `#6b7280` (gray-500) |

- Multiple badges can appear (e.g., avoided + non-standard qty) — shown as adjacent icons
- Tapping a badge shows a tooltip or small popover with the warning detail and comment (if any)

**Rationale:** Different shapes ensure accessibility (not relying on color alone). Different colors provide at-a-glance severity.
**Note:** This is a **novel pattern** — first warning/caution visual state in the app. Establishes the amber/red warning palette.

### Warning Badge Tap Behavior
**Decision:** Tapping a warning badge shows a small popover/tooltip with the warning detail text (e.g., "Avoided at Walmart — not fresh"). Dismiss by tapping outside.
**Rationale:** Keeps the row clean while making detail accessible. Avoids navigating away from the list.
**Note:** This is a **novel pattern** — first tooltip/popover in the app. Keep it simple: absolutely-positioned view near the badge, light shadow, dismiss on tap-outside.

### Warning Toast
**Decision:** Reuse existing `components/Toast.tsx` with warning-specific styling:
- **Background:** Amber tint for warnings (vs. default for remote changes) — to visually distinguish from remote-change toasts
- **Duration:** 4 seconds (slightly longer than 3s remote toast)
- **Content:** Single toast combining all warnings from one add operation. Includes comments if present.
- **Example:** "Salmon is avoided at Walmart — not fresh. Quantity 3 is non-standard (usual: 1 lb, 2 lb)."

**Rationale:** Single toast avoids notification overload. Amber background creates visual distinction from informational remote-change toasts.
**Note:** Extension of existing Toast component — new trigger and optional amber styling variant.

### Warning Preferences in Settings
**Decision:** New "Warnings" section in Settings screen. Each warning type has a segmented control with three options:

| Warning Type | Options | Default |
|--------------|---------|---------|
| Store avoidance | Toast + Badge / Badge only / Off | Toast + Badge |
| Store unavailable | Toast + Badge / Badge only / Off | Toast + Badge |
| Non-preferred store | Badge only / Off | Badge only |
| Non-standard qty | Toast + Badge / Badge only / Off | Badge only |

Stored in `profiles.warning_preferences` JSONB column (see F12 design doc for format).
**Rationale:** Extension of existing Settings layout. Per-user via profiles table so preferences sync across devices.

### `short_name` Field
**Decision:** Add `short_name TEXT` (nullable) to `items` table. When set, used as line 1 text in list view. Falls back to `name` when null.
**Editing:** In the Items tab master item edit modal — new "Short name" text field. Not editable from the shopping list.
**Rationale:** User-defined only for v1. No auto-generation. Keeps it simple.

### Preference/Avoidance Management UI (Items Tab)
**Decision:** Replace the current multi-store tag + star UI in the master item edit modal with:
- Section header: "Store Preferences"
- List of stores from the household
- Each store row: `[Color dot] [Store name] [Status selector]`
- Status options: (none) / Preferred / Avoided / Unavailable — shown as a small segmented control or tap-to-cycle
- When Preferred or Avoided is selected: a comment text input appears below that row
- Only stores with a non-neutral status are saved to `item_store_preferences`

**Rationale:** Extension of existing store management UI in the items modal. Richer than the old star-toggle but same location.

## Out of Scope
- Auto-generated short names / abbreviations (v1 is user-defined only)
- Entry flow changes (F12)
- Input parsing (F14)
- Warning badge animations or progressive disclosure beyond tap-to-detail

## Open Questions
_(None — all questions resolved during design session)_
