# Design: Duplicate Entry Handling
<!-- ID: F78 | Status: Draft | Blocked on: F103 -->

## Overview

When a user tries to add an item that already exists on the active shopping list, the app should surface a resolution dialog instead of silently creating a duplicate row. The user can merge quantities (sum or multi-pack), keep the addition as a separate quantity instance, enter a freeform quantity, or cancel. When the matching item exists at a different store, a move-between-stores option is also offered. For items already purchased on the current or another user's trip, the dialog is informational with fresh-add or cancel only.

This feature also introduces a passive duplicate indicator in the SmartAddItem dropdown so the user can see at a glance which candidate matches are already on the list.

## Blocked On

**F103 — List Item / Quantity Model Refactor** (#103). F78 is designed on the post-refactor data model where a `list_items` row holds per-item fields (item_id, name, category, store_id, warnings) and references N quantity entries. All of the merge/duplicate outcomes below assume that model. Do **not** implement F78 until F103 ships.

## User Scenarios

- User adds "Chicken Breast 1.5 lb" to the list, then tries to add "Chicken Breast 1.5 lb" again — resolution dialog offers structured merge ("3 lb" sum or "2 × 1.5 lb" multi-pack), duplicate-as-separate-entry, freeform, or cancel.
- User has "Milk" on the list at Store A, then adds "Milk" while Store B is the active store — dialog surfaces the cross-store situation and offers merge-there, move-to-here, duplicate-here, or cancel.
- User is mid-trip at Store A, already checked off "Eggs," and forgets — adds "Eggs" again. The dialog informs them eggs were already purchased on this trip and offers add-fresh or cancel only (merge into a purchased entry is not allowed).
- Another household member is on their own trip at a different store and has already purchased "Bread"; the current user adds "Bread" — dialog informs them and offers add-fresh or cancel.
- User types in the add field and sees a minimal indicator next to candidate matches that are already on the list, before even attempting to add.

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
1. **Passive (typing-time)** — in the SmartAddItem dropdown, mark candidate rows that are already present on the list with a minimal indicator. No interaction required.
2. **Active (add-time)** — when the user commits an add via any path (manual, autocomplete, voice), run the duplicate check and present the resolution dialog if a match is found.

**Rationale:** Passive indication improves awareness without interrupting flow — the user sees duplicates coming before they commit. Active detection is the enforcement point. Both run on every add path; the passive indicator is a UI affordance, the active dialog is the control.

**Alternatives considered:** Active-only (no dropdown indicator) — rejected because users often don't realize an item is already on the list until after adding; the passive mark is a zero-cost hint. Passive-only — rejected because it relies on the user reading the dropdown every time.

### Action matrix by target state

**Decision:**

| Target state | Dialog actions |
|---|---|
| Active, same store | Sum · Multi-pack (when applicable) · Duplicate · Freeform · Cancel |
| Active, different store | Merge-at-other-store · Move-to-this-store · Duplicate-here · Freeform · Cancel |
| Purchased, same trip ongoing (same store) | Add fresh · Cancel |
| Purchased, other user's trip (any store) | Inform · Add fresh · Cancel |

**Rationale:** Merging into a purchased entry is semantically wrong — the user already paid for that quantity; adding to it changes the historical record. Fresh-add respects the purchase; cancel is the escape hatch. Cross-store gets a third option (move) because that's a common intent ("I decided to buy it at the other store after all"). The other-user case is informational because it's usually legitimate (co-shopping) and shouldn't block.

**Alternatives considered:** "Un-purchase and merge" for the same-trip purchased case — rejected as semantically odd and likely to mask real duplicates.

### Merge presentations

**Decision:** The dialog offers structured merge options whose results round-trip through `QuantityParsed`. Presentations are computed per case:

| Input case | Structured options offered |
|---|---|
| Same size ("1.5 lb" + "1.5 lb") | Sum → "3 lb" · Multi-pack → `{ count: 2, sizeQty: 1.5, sizeUnit: "lb" }` |
| Different sizes, same unit ("1 lb" + "2 lb") | Sum → "3 lb" (no multi-pack form; terms differ) |
| Pure counts ("3" + "2") | Sum → "5" |
| Packages, same ("2 boxes" + "1 box") | Sum count → "3 boxes" |
| Convertible units ("1 lb" + "16 oz") | None in V1 — freeform or duplicate only |
| Incompatible units ("1 lb" + "2 each") | None — freeform or duplicate only |
| One empty | Use non-empty as the merged value |

**Rationale:** Staying within the structured quantity model keeps merged entries editable and parseable. Multi-pack is a first-class form in `QuantityParsed` (`count + sizeQty + sizeUnit`), not a display hack. When no structured form exists, the user chooses between Duplicate (creates a second quantity entry under the same logical item) or Freeform (edits the existing entry with raw text).

**Alternatives considered:** Concatenated text ("1 lb + 2 lb") as a structured merge — rejected because it's lossy and non-reparseable. If the user wants "two separate pieces," the semantic equivalent is Duplicate, which preserves each quantity as its own entry under one logical item.

### Merge vs Duplicate — data effect (post-F103 model)

**Decision:**

| Dialog option | Data effect |
|---|---|
| Sum / Multi-pack / Freeform (parseable or raw) | Edit the existing quantity entry — one entry, updated qty |
| Duplicate | Append a new quantity entry to the same logical `list_items` row — N+1 entries |
| Cancel | No change |

**Rationale:** F103 models a `list_items` row as "one logical item with N quantity instances." Merge edits an existing instance; Duplicate adds another. Both outcomes live under one logical item, which means item-level fields (warnings, category, store_id) stay canonical and duplicates render adjacent because they share a parent.

**Alternatives considered:** Pre-F103 render-time adjacency on two separate `list_items` rows — rejected in favor of waiting for F103 because the two-row model denormalizes item-level fields and makes drag/sort/warning semantics awkward (see F103 issue body for full rationale).

### Cross-store detection

**Decision:** When the user adds an item at Store B and a logical `list_items` row already exists for that `item_id` at Store A, the dialog surfaces the cross-store situation and offers:
- **Merge at Store A** — apply the chosen quantity combination to the existing row at A; no row at B.
- **Move to Store B** — change `store_id` on the existing logical row from A to B (quantities carry along).
- **Duplicate at Store B** — create a new logical `list_items` row at B with the new quantity entry.
- **Freeform / Cancel** — as usual.

**Rationale:** All three cross-store intents are real: "actually buying it at A," "changed my mind, buying at B instead," "buying at both stores." User should decide explicitly.

**Alternatives considered:** Auto-move if the existing row has no purchased entries — rejected as too clever; the user is better served by explicit choice.

### Scope of add paths

**Decision:** Duplicate detection fires for **all** add paths — manual typing, autocomplete selection, voice trigger, any future entry method. The check lives in the add mutation (or a wrapper invoked by SmartAddItem before calling the mutation).

**Rationale:** The duplicate state is the same regardless of how the user got to the add action; the UX should be too.

**Alternatives considered:** Manual-only — rejected as inconsistent and error-prone.

### Undo / redo

**Decision:** Each dialog outcome registers its own undo action:
- **Sum / Multi-pack / Freeform (edit existing)** — undo restores the previous quantity on the edited entry.
- **Duplicate (append entry)** — undo removes the appended entry; redo re-appends with the same data (using the entry id tracker pattern if the new id changes on re-insert).
- **Move (cross-store)** — undo restores the previous `store_id` on the logical row.
- **Cancel** — no undo needed.

**Rationale:** Consistent with the existing undo pattern in the app. Each action is atomic from the user's perspective and should be reversible.

### Passive indicator styling

**Decision:** Minimal glyph on matching SmartAddItem dropdown rows. Exact styling deferred to Pass 2 UI (Pass 2 is open pending F103 completion — see "Open Questions").

**Rationale:** The semantic decision ("show a mark") is settled; the visual decision (dot, check, icon, color) can wait until implementation-time without affecting data model or architecture.

### Sorting and adjacency

**Decision:** Duplicate quantity entries within one logical `list_items` row are rendered adjacent by virtue of sharing a parent (F103 flattens items × quantities). No render-time adjacency grouping layer is needed; this falls out of the refactor.

**Rationale:** See F103 issue body for the full refactor motivation. Adjacency as a grouping invariant is handled at the data layer, not at render.

**Alternatives considered:** Two-row Alt A model with render-time grouping — rejected as part of the F103 decision.

## Out of Scope

- **Unit conversion** (lb ↔ oz, ml ↔ l, g ↔ kg) for merge. Convertible-but-different-unit cases offer no structured merge in V1; user picks Duplicate or Freeform. Becomes a BACKLOG candidate at spec time.
- **Fuzzy one-off match** beyond case/trim (and later, F79 vocabulary normalization). Defer to post-F83.
- **Grouped-checkbox UI** (one product header with N sub-checkboxes under it). F103 explicitly keeps rendering flat — one quantity = one row. Revisit as a standalone feature if the flat model proves insufficient.
- **Split-off-one-quantity-to-another-store** (explicit UX for moving just one of several quantities to a different store). Noted in F103 as out of scope; would be a follow-up feature. The cross-store Duplicate-here path in the dialog partially covers this intent (add fresh at the new store), but physically splitting an existing quantity is a separate action.

## Open Questions

**Pass 2 — UI decisions (deferred until closer to implementation):**

- **Dialog style.** Full modal (like Settings) vs bottom sheet vs inline pill replacement above the input. Today the app uses full-screen modals for dialogs; the duplicate dialog may want a smaller footprint given it's a quick decision point.
- **Button layout and wording.** Merge vs Duplicate vs Move vs Cancel — exact labels, visual hierarchy (primary action styling), and whether Merge and Duplicate sit on separate rows or share a row.
- **Merge preview format.** How to render the comparison between "Sum" and "Multi-pack" options so the user can judge at a glance (side-by-side buttons with label + value, or a two-row stacked layout).
- **Cross-store callout.** When the match is at a different store, how is the store difference surfaced in the dialog (color dot, banner, inline text)?
- **Passive indicator glyph.** Specific icon, color, and position within the SmartAddItem dropdown row. Options: subtle dot, checkmark, or "on list" label; single vs state-differentiated (active vs purchased).
- **"Already on list" states in the dropdown.** Single indicator regardless of state vs different glyphs for active/purchased/different-store. Earlier decision: **minimal** — single indicator. Confirm glyph and color at Pass 2.

These decisions should be made after F103 lands, during F78's `/spec` pass, so that they can account for any UX implications that emerge from the refactor.

## Revision History

- 2026-04-15: Initial design. Decisions captured; Pass 2 UI deferred. Blocked on F103 (#103).
