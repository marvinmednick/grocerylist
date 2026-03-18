# Design: Freeform Qty "Other" Chip
<!-- ID: F15 | Status: Designed -->

## Overview
The qty chip row in the SmartAddItem dropdown shows predefined quantities (`default_qty` + `alternate_qtys`) as quick-select chips. This feature adds an "Other" chip at the end of that row. Tapping it opens a small floating popover with a `TextInput`, letting the user type any quantity they want. Confirming with Return sets that qty as the selection for the item — same as tapping a predefined chip — and dismisses the popover.

The goal is to remove the need to open the full edit modal just to enter a non-standard quantity.

## User Scenarios
A shopper sees "Milk" with chips `1 gal` and `½ gal`, but wants `1 qt`. They tap "Other", type `1 qt`, press Return, and the chip row now shows `1 qt` as the active selection. Tapping the item name adds it to the list with that quantity.

## Design Decisions

### Scope: inline pill row only
**Decision:** The "Other" chip is added to the inline qty pill row inside each dropdown result row. The full edit modal (opened via the ChevronRight button) already has a freeform `TextInput` for qty — it is unchanged.
**Rationale:** The edit modal is already the "full edit" path. This feature targets the faster quick-add path where opening a modal is friction.
**Alternatives considered:** Also replacing the modal's TextInput with chips — deferred; out of scope.

### Popover style: absolutely positioned floating card
**Decision:** Tapping "Other" opens a small absolutely-positioned card anchored near the chip row, containing a single `TextInput`. Dismissed when the user presses Return (keyboard Done/Return action).
**Rationale:** Matches the user's stated intent for a lightweight interaction. The dropdown lives near the top of the screen, so the keyboard is unlikely to cover the popover in practice. Consistent in spirit with the F13 badge tooltip pattern (absolutely positioned overlay).
**Caveat for implementor:** Test on device. If the keyboard covers the popover in any layout configuration, fall back to a mini bottom-sheet modal (same pattern as the existing edit modal overlay, but with only a TextInput and no title/buttons).
**Alternatives considered:** Mini bottom-sheet modal — more robust keyboard handling but heavier feel; Option A preferred by user.
**New pattern — update ui-guidelines.md:** First absolutely-positioned interactive input popover in the app.

### Confirmation: keyboard Return key only
**Decision:** The user confirms the freeform qty by pressing Return/Done on the keyboard. No explicit "OK" button in the popover.
**Rationale:** Minimal UI; fast flow; Return is the natural confirmation for a single-field input.
**Alternatives considered:** Visible "OK" button — adds clarity but adds tap and visual weight.

### Chip label: "Other"
**Decision:** The chip is labeled `Other`.
**Rationale:** Plain, unambiguous. Consistent with the text style of the other chips.
**Alternatives considered:** `Custom`, `…`, pencil icon — all less immediately legible.

### State: freeform value replaces selection.qty
**Decision:** When the user confirms a freeform qty, it calls `toggleSelection(item.id, { qty: value })` — the same path as tapping a predefined chip. No new state fields.
**Rationale:** Keeps the data flow uniform. The "Other" chip becomes active (highlighted) showing the typed value as its label once confirmed.
**Alternatives considered:** Separate `customQty` state field — unnecessary complexity.

### One-off items: out of scope
**Decision:** The one-off row ("Add 'X' (One-time)") does not get qty selection in this feature. It continues to add with qty `'1'`.
**Rationale:** One-off items have no `alternate_qtys` and the row has a different layout. A separate decision/feature if qty selection for one-offs is ever needed.

## Out of Scope
- Saving the typed qty back to the item's `alternate_qtys` — explicitly deferred (user confirmed use-once only)
- Qty selection for one-off item adds
- Changes to the full edit modal's qty field
- Freeform qty entry on already-added list items (editing in place)

## Open Questions
None — ready for `/spec`.
