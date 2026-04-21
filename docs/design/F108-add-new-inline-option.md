# Design: Add New as Inline Duplicate Option
<!-- ID: F108 | Status: Designed -->

## Overview

The duplicate resolution dialog currently places "Add New" in a separate bottom button row, visually isolated from the combine options above. This feature moves it into the options list as a peer action with a descriptive label ("Add a separate 1.5 gal item"), giving the user a unified vertical list of all mutually exclusive choices. The bottom row retains only Custom and Cancel. The change applies to all four dialog states.

## User Scenarios

- User adds "Milk 1 gal" when Milk is already on the list at the same store — sees all choices in one place: "Combine as 2 gal", "Combine as 2 × 1 gal", "Add a separate 1 gal item", then Custom / Cancel below.
- User adds "Milk 1 gal" at Market when Milk already exists at Alt Market — sees three vertical options: "Combine as 2 gal in Alt Market", "Combine as 2 gal in Market", "Add a separate 1 gal at Market", then Custom / Cancel.
- User adds an item that was already purchased on this trip — sees "Add a separate 1 gal item" as the only option, then Custom / Cancel.

## Design Decisions

### Option layout: vertical list, one per line

**Decision:** Every option — combine and add-separate — is rendered as a full-width button on its own line. No horizontal chip row.

**Rationale:** The user's original request called for all options to be in "the list of options." Full-width vertical rows make each choice equally visible, support longer label strings (especially cross-store labels with store names), and avoid text truncation in wrapped chip layouts. The previous horizontal chip row was appropriate for short, symmetric labels ("2 gal", "2 × 1.5 gal"), but becomes awkward once one option reads "Add a separate 1 gal at Market."

**Alternatives considered:** Keep combine options horizontal + add "Add a separate" on its own full-width line below them — rejected for inconsistency; mixing horizontal chips and full-width buttons in the same section looks unpolished.

### Section label: removed

**Decision:** Drop the "Combine as:" section label entirely. The action is embedded in each button label.

**Rationale:** When options were unlabeled quantity chips ("3 gal", "2 × 1.5 gal"), a header was needed to explain they were combine actions. With descriptive labels ("Combine as 3 gal", "Add a separate 1 gal item"), the header is redundant.

**Alternatives considered:** Retain "Combine as:" above combine options, "Add new:" above the add option — rejected as visual clutter when the labels are already self-describing.

### Button label format

**Decision:**

| Context | Button label |
|---------|-------------|
| Same-store combine | `Combine as [qty]` |
| Cross-store combine, at existing store | `Combine as [qty] at [existing store]` |
| Cross-store combine, at incoming store | `Combine as [qty] at [incoming store]` |
| Add separate, same store | `Add a separate [qty] item` |
| Add separate, cross-store | `Add a separate [qty] at [incoming store]` |
| No incoming quantity (any) | `Add a separate item` / `Add a separate item at [incoming store]` |
| Purchased state (any) | `Add a separate [qty] item` (same as same-store; no store qualifier) |

**Rationale:** Both combine and add-separate use "at [store]" — consistent grammar that reads naturally for all actions. The incoming store (current active store) is always the store for the Add Separate option — you are adding this new entry where you are currently shopping.

**Alternatives considered:** Using "in [store]" for combine and "at [store]" for add-separate — rejected for inconsistency; "at" reads correctly for both actions and the distinction is too subtle to justify mixing prepositions. Always show store name even for same-store — rejected; the summary line already contextualizes the store, and repeating it on every option adds noise when there's no ambiguity.

### Cross-store "Add a separate" always at the incoming (current) store

**Decision:** In the different-store active case, "Add a separate [qty] at [store]" always specifies the incoming store (where the user is currently shopping), not the existing entry's store.

**Rationale:** The user is in the context of their current store; adding a separate item means adding it at the store they're actively shopping at. If they wanted to add at the other store, they'd switch the active store first.

### Custom and Cancel remain on the bottom row

**Decision:** The bottom row (`[ Custom ]  Cancel`) is unchanged. Custom opens the inline text input (custom quantity edit), which is a different interaction mode from the choice options and belongs in its own area.

**Rationale:** Custom requires an additional input step (text field + Confirm), not a single tap. Keeping it separate prevents the options list from growing unbounded and signals that Custom is a "something else" escape hatch rather than a peer choice.

### Button styling: uniform (unchanged from F78)

**Decision:** All option buttons use the established uniform style: `backgroundColor: '#f3f4f6'`, `borderRadius: 8`, `paddingHorizontal: 16`, `paddingVertical: 10`, dark text. No visual differentiation between combine and add-separate options.

**Rationale:** F78 established "uniform button styling for choice dialogs" — when no action is objectively primary, uniform styling lets position and label carry the hierarchy. This feature does not change that principle; it only changes button text and layout.

## Out of Scope

- Changing when "Add a separate" is offered (same cases as today per F78's action matrix)
- Custom inline mode behavior
- Multi-target picker (F105) — showing multiple matching duplicates

## Open Questions

None — ready for `/spec`.
