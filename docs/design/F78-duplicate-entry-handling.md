# Design: Duplicate Entry Handling
<!-- ID: F78 | Status: Designed -->

## Overview

When a user tries to add an item that already exists on the active shopping list, the app should surface a resolution dialog instead of silently creating a duplicate row. The user can combine quantities (sum or multi-pack), keep the addition as a separate quantity instance, enter a freeform quantity, or cancel. When the matching item exists at a different store, a move-between-stores option is also offered. For items already purchased on the current or another user's trip, the dialog is informational with fresh-add or cancel only.

This feature also introduces a passive duplicate indicator in the SmartAddItem dropdown so the user can see at a glance which candidate matches are already on the list.

## User Scenarios

- User adds "Chicken Breast 1.5 lb" to the list, then tries to add "Chicken Breast 1.5 lb" again — resolution dialog offers structured combine ("3 lb" sum or "2 × 1.5 lb" multi-pack), add-new, custom, or cancel.
- User has "Milk" on the list at Store A, then adds "Milk" while Store B is the active store — dialog surfaces the cross-store situation and offers combine-at-A, combine-at-B, add-new, custom, or cancel.
- User is mid-trip at Store A, already checked off "Eggs," and forgets — adds "Eggs" again. The dialog informs them eggs were already purchased on this trip and offers add-new or cancel only (combine into a purchased entry is not allowed).
- Another household member is on their own trip at a different store and has already purchased "Bread"; the current user adds "Bread" — dialog informs them and offers add-new or cancel.
- User types in the add field and sees a small "on list" label next to candidate matches that are already on the list, before even attempting to add.

## Design Decisions

### Detection scope

**Decision:** Check against both active (`is_purchased=false`) and purchased-but-not-archived (`is_purchased=true`, `archived_at IS NULL`) entries. The resolution paths differ by state.

**Rationale:** A purchased entry is still on the current list. Re-adding a just-purchased item is a real scenario (user forgot, or another user bought it elsewhere). Silently creating a duplicate hides the situation; informing the user lets them make an explicit choice.

**Alternatives considered:** Check active only — rejected because it would silently create apparent duplicates when the target is already checked off.

### Match criteria

**Decision:** Two classes of match:
- **Master items** — same `item_id`.
- **One-offs** (`item_id IS NULL`) — normalized name match: case-insensitive + trimmed. When F79 (Vocabulary Normalization) ships, also apply vocabulary-based normalization (singular/plural, synonyms).

**Rationale:** Master-item matching is unambiguous via id. For one-offs, exact string matching is too brittle; case/whitespace normalization is cheap and correct. F79 normalization is strictly additive — match more things without changing the match rule for already-matching cases.

**Alternatives considered:** Fuzzy matching for one-offs (Levenshtein) — rejected for V1, risks false positives; revisit once F83 fuzzy-search design exists.

### Detection timing — two moments

**Decision:**
1. **Passive (typing-time)** — in the SmartAddItem dropdown, mark candidate rows that are already present on the list with a small "on list" label. No interaction required.
2. **Active (add-time)** — when the user commits an add via any path (manual, autocomplete, voice), run the duplicate check and present the resolution dialog if a match is found.

**Rationale:** Passive indication improves awareness without interrupting flow — the user sees duplicates coming before they commit. Active detection is the enforcement point. Both run on every add path; the passive indicator is a UI affordance, the active dialog is the control.

**Alternatives considered:** Active-only (no dropdown indicator) — rejected because users often don't realize an item is already on the list until after adding; the passive mark is a zero-cost hint. Passive-only — rejected because it relies on the user reading the dropdown every time.

### Action matrix by target state

**Decision:**

| Target state | Dialog actions |
|---|---|
| Active, same store | Combine (sum) · Combine (multi-pack, when applicable) · Add New · Custom · Cancel |
| Active, different store | Combine at store A (sum) · Combine at store B (sum) · Add New · Custom · Cancel |
| Purchased, same trip ongoing (same store) | Add New · Custom · Cancel |
| Purchased, other user's trip (any store) | Add New · Custom · Cancel |

**Rationale:** Combining into a purchased entry is semantically wrong — the user already paid for that quantity; adding to it changes the historical record. Add-new respects the purchase; cancel is the escape hatch. Cross-store gets per-store combine options because both intents are real ("keep it at the original store" vs "move it to this store"). The other-user case is informational because it's usually legitimate (co-shopping) and shouldn't block.

**Alternatives considered:** "Un-purchase and combine" for the same-trip purchased case — rejected as semantically odd and likely to mask real duplicates.

### Combine presentations

**Decision:** The dialog offers structured combine options whose results round-trip through `QuantityParsed`. Presentations are computed per case:

| Input case | Structured options offered |
|---|---|
| Same size ("1.5 lb" + "1.5 lb") | Sum → "3 lb" · Multi-pack → "2 × 1.5 lb" |
| Different sizes, same unit ("1 lb" + "2 lb") | Sum → "3 lb" (no multi-pack form; terms differ) |
| Pure counts ("3" + "2") | Sum → "5" |
| Packages, same ("2 boxes" + "1 box") | Sum count → "3 boxes" |
| Convertible units ("1 lb" + "16 oz") | None in V1 — custom or add-new only |
| Incompatible units ("1 lb" + "2 each") | None — custom or add-new only |
| One empty | Use non-empty as the combined value |

**Cross-store simplification:** Cross-store combine options show only the sum form (no multi-pack), one per store on separate lines. This keeps the dialog clean — multi-pack is a same-store refinement.

**Rationale:** Staying within the structured quantity model keeps combined entries editable and parseable. Multi-pack is a first-class form in `QuantityParsed` (`count + sizeQty + sizeUnit`), not a display hack. When no structured form exists, the user chooses between Add New (creates a second quantity entry under the same logical item) or Custom (edits the existing entry with raw text).

**Alternatives considered:** Concatenated text ("1 lb + 2 lb") as a structured combine — rejected because it's lossy and non-reparseable. If the user wants "two separate pieces," the semantic equivalent is Add New, which preserves each quantity as its own entry under one logical item.

### Combine vs Add New — data effect (post-F103 model)

**Decision:**

| Dialog option | Data effect |
|---|---|
| Combine (sum / multi-pack) | Edit the existing quantity entry — one entry, updated qty |
| Custom (parseable or raw) | Edit the existing quantity entry with user-entered value |
| Add New | Append a new quantity entry to the same logical `list_items` row — N+1 entries |
| Cancel | No change |

**Rationale:** F103 models a `list_items` row as "one logical item with N quantity instances." Combine edits an existing instance; Add New adds another. Both outcomes live under one logical item, which means item-level fields (warnings, category, store_id) stay canonical and duplicates render adjacent because they share a parent.

**Alternatives considered:** Pre-F103 render-time adjacency on two separate `list_items` rows — rejected in favor of waiting for F103 because the two-row model denormalizes item-level fields and makes drag/sort/warning semantics awkward (see F103 issue body for full rationale).

### Cross-store detection

**Decision:** When the user adds an item at Store B and a logical `list_items` row already exists for that `item_id` at Store A, the dialog surfaces the cross-store situation with per-store combine options:
- **Combine at Store A** — apply the sum to the existing row at A; no row at B. Effectively "keep it where it is, just increase the quantity."
- **Combine at Store B** — move the existing row from A to B (change `store_id`) and apply the sum. Effectively "move it here and combine."
- **Add New** — create a new `list_items` row at B with the new quantity entry. Item exists at both stores.
- **Custom / Cancel** — as usual.

**Rationale:** All three cross-store intents are real: "actually buying it at A," "changed my mind, buying at B instead," "buying at both stores." User should decide explicitly.

**Alternatives considered:** Auto-move if the existing row has no purchased entries — rejected as too clever; the user is better served by explicit choice.

### Scope of add paths

**Decision:** Duplicate detection fires for **all** add paths — manual typing, autocomplete selection, voice trigger, any future entry method. The check lives in the add mutation (or a wrapper invoked by SmartAddItem before calling the mutation).

**Rationale:** The duplicate state is the same regardless of how the user got to the add action; the UX should be too.

**Alternatives considered:** Manual-only — rejected as inconsistent and error-prone.

### Undo / redo

**Decision:** Each dialog outcome registers its own undo action:
- **Combine (edit existing)** — undo restores the previous quantity on the edited entry.
- **Custom (edit existing)** — undo restores the previous quantity on the edited entry.
- **Add New (append entry)** — undo removes the appended entry; redo re-appends with the same data (using the entry id tracker pattern if the new id changes on re-insert).
- **Cross-store combine at B (move + edit)** — undo restores the previous `store_id` and quantity on the logical row.
- **Cancel** — no undo needed.

**Rationale:** Consistent with the existing undo pattern in the app. Each action is atomic from the user's perspective and should be reversible.

### Dialog style — bottom-anchored dialog modal

**Decision:** The duplicate resolution dialog uses the 7a dialog modal pattern but anchored to the **bottom** of the screen instead of centered. The overlay style changes `justifyContent` from `'center'` to `'flex-end'`. The card slides up from the bottom.

**Rationale:** Bottom-anchoring keeps the SmartAddItem search area and the top of the list visible behind the dimmed backdrop, giving the user visual context for the duplicate they're resolving. The dialog is a quick-decision picker (not a form), so it benefits from being close to where the user's attention already is (they just tapped an add action near the bottom). KAV + ScrollView from the 7a pattern handle the keyboard case when Custom input is active.

**Alternatives considered:** Centered dialog (standard 7a) — rejected because it fully obscures the list and search context, forcing the summary line to restate information already visible on screen. Full-screen modal (7b) — rejected as too heavy for a quick decision.

**New pattern — update ui-guidelines.md:** Bottom-anchored dialog modal. This is a novel position for this app; all existing dialog modals are centered. Justified here by the contextual nature of the dialog. The centered 7a pattern remains the default for form/edit modals.

### Dialog layout — hybrid button arrangement

**Decision:** The dialog body has two sections:

1. **Summary line** — conversational: "You already have 1.5 lb at Safeway"
2. **Combine section** (when applicable) — labeled "Combine as:" with action buttons:
   - Same-store: compact buttons on one line (e.g., `[ 3 lb ]  [ 2 × 1.5 lb ]`)
   - Cross-store: one button per line, each showing result + store (e.g., `[ 3 lb at Safeway ]` / `[ 3 lb at Costco ]`)
3. **Always-present bottom row** — three compact buttons on one line: `[ Add New ]  [ Custom ]  [ Cancel ]`

**Button styling:** Uniform — all action buttons use the same light styling (gray-100 background `#f3f4f6`, dark text `#374151`). Cancel is text-only (no background, gray text `#6b7280`). Position and grouping provide visual hierarchy, not color differentiation.

**Rationale:** Uniform styling avoids visual noise when there are 4-6 buttons and no single "right" answer — the correct choice depends entirely on user intent. The iOS action sheet pattern validates this: uniform buttons, positional grouping, only Cancel is visually distinct. The "Combine as:" label and whitespace separation provide the hierarchy.

**Alternatives considered:** Progressive visual weight (blue primary, outline secondary, text tertiary) — rejected as too busy for a dialog with 4-6 options where no action is objectively primary.

### Custom button interaction

**Decision:** Tapping "Custom" replaces the Combine section with an inline text input + Confirm button. Cancel in the custom-input state returns to the main dialog view (restores Combine options). The ✕ close button on the title bar always dismisses the entire dialog.

**Rationale:** The user can explore the custom input without losing access to the other options — Cancel is a "go back," not a "dismiss." The ✕ remains the universal escape hatch for the entire dialog.

### Query restoration on dismiss

**Decision:** When the user dismisses the dialog (via ✕ or Cancel from the main view), the SmartAddItem search query is restored to what the user had typed before the add attempt. The user returns to seeing their search results and can pick a different item or retry without retyping.

**Rationale:** The add action currently clears the query (`setQuery('')`). Without restoration, dismissing the dialog leaves the user at an empty search bar, forcing them to retype. Saving and restoring the query preserves flow.

### Passive indicator styling

**Decision:** Small "on list" text label, muted gray (`#9ca3af`), displayed on SmartAddItem dropdown rows where the candidate item already exists on the active shopping list. Single indicator regardless of state (active, purchased, different store) — the dialog handles nuance once the user commits the add.

**Position:** Right side of the `resultTitleRow`, after the item name and any orphan tokens.

**Rationale:** Text is unambiguous — no icon-meaning learning required. Muted gray keeps it subtle and non-intrusive. Single-state keeps the dropdown clean; the duplicate dialog provides full context once the user acts.

**Alternatives considered:** Icon (lucide check or dot) — rejected as requiring users to learn icon meaning. State-differentiated indicators — rejected as adding complexity to the dropdown for information that's better surfaced in the dialog.

### Sorting and adjacency

**Decision:** Duplicate quantity entries within one logical `list_items` row are rendered adjacent by virtue of sharing a parent (F103 flattens items × quantities). No render-time adjacency grouping layer is needed; this falls out of the refactor.

**Rationale:** See F103 issue body for the full refactor motivation. Adjacency as a grouping invariant is handled at the data layer, not at render.

**Alternatives considered:** Two-row Alt A model with render-time grouping — rejected as part of the F103 decision.

## Out of Scope

- **Unit conversion** (lb ↔ oz, ml ↔ l, g ↔ kg) for combine. Convertible-but-different-unit cases offer no structured combine in V1; user picks Add New or Custom. Becomes a BACKLOG candidate at spec time.
- **Fuzzy one-off match** beyond case/trim (and later, F79 vocabulary normalization). Defer to post-F83.
- **Grouped-checkbox UI** (one product header with N sub-checkboxes under it). F103 explicitly keeps rendering flat — one quantity = one row. Revisit as a standalone feature if the flat model proves insufficient.
- **Split-off-one-quantity-to-another-store** (explicit UX for moving just one of several quantities to a different store). Noted in F103 as out of scope; would be a follow-up feature. The cross-store Add New path in the dialog partially covers this intent (add fresh at the new store), but physically splitting an existing quantity is a separate action.
- **Multi-pack combine options in cross-store dialogs** — cross-store shows sum-only per store to keep the dialog clean. Multi-pack is a same-store refinement.

## Open Questions

None — all design decisions resolved.

## Revision History

- 2026-04-15: Initial design. Pass 1 (functional/data) decisions captured; Pass 2 UI deferred. Blocked on F103 (#103).
- 2026-04-19: Pass 2 UI decisions resolved. F103 blocker cleared. Bottom-anchored dialog modal, hybrid button layout (combine section + always-present bottom row), uniform button styling, conversational summary line, "on list" passive indicator, query restoration on dismiss, custom-input inline replacement with back-to-main Cancel. Status → Designed.
