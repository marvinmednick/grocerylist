# Grocery App — Feature Registry

> **Feature numbering convention (from 2026-03-30):** Feature IDs match their GitHub issue number (F44 = issue #44). Features F1–F23 predate this convention and retain their original numbers. Backlog features F3–F11 and F24 were renumbered in March 2026; old issues are closed with "superseded by" comments pointing to the new ones.
>
> **Input & vocabulary feature chain:** F44 → F79 → F90 → F91 → F77 / F83 → F78/F76. See [vocabulary-and-quantity-architecture.md](docs/design/vocabulary-and-quantity-architecture.md) for dependencies and rationale.

## Active Features

| ID | Feature | Status | Spec | Issue |
|----|---------|--------|------|-------|
| F2 | Multi-User Trip Management | Done | [specs/F2-multi-user-trips.md](specs/F2-multi-user-trips.md) · [design](docs/design/F2-multi-user-trips.md) | [#4](https://github.com/marvinmednick/grocerylist/issues/4) |
| F76 | Recipes & Bundles | Backlog | — | [#76](https://github.com/marvinmednick/grocerylist/issues/76) |
| F77 | Fuzzy Matching in Smart Add | Done | [specs/F77-fuzzy-matching.md](specs/F77-fuzzy-matching.md) · [design](docs/design/F77-fuzzy-matching.md) | [#77](https://github.com/marvinmednick/grocerylist/issues/77) |
| F78 | Duplicate Entry Handling | Backlog | — | [#78](https://github.com/marvinmednick/grocerylist/issues/78) |
| F79 | Quantity Units System | Done | [specs/F79-quantity-units-system.md](specs/F79-quantity-units-system.md) · [design](docs/design/F79-quantity-units-system.md) | [#79](https://github.com/marvinmednick/grocerylist/issues/79) |
| F7 | Settings Screen | Done | [specs/F7-settings.md](specs/F7-settings.md) · [design](docs/design/F7-settings.md) | [#9](https://github.com/marvinmednick/grocerylist/issues/9) |
| F83 | Vocabulary Definition Flow | Backlog | — | [#83](https://github.com/marvinmednick/grocerylist/issues/83) |
| F85 | Structured Quantity Data Conversion | Done | [specs/F85-structured-quantity-conversion.md](specs/F85-structured-quantity-conversion.md) | [#85](https://github.com/marvinmednick/grocerylist/issues/85) |
| F90 | Token & Item Alias System (Data + Parser) | Done | [specs/F90-token-item-alias-system.md](specs/F90-token-item-alias-system.md) · [design](docs/design/F90-token-item-alias-system.md) | [#90](https://github.com/marvinmednick/grocerylist/issues/90) |
| F91 | Alias System UI | Done | [specs/F91-alias-system-ui.md](specs/F91-alias-system-ui.md) · [design](docs/design/F90-token-item-alias-system.md) | [#91](https://github.com/marvinmednick/grocerylist/issues/91) |
| F80 | Enhanced Shopping Mode (Store Focus) | Backlog | — | [#80](https://github.com/marvinmednick/grocerylist/issues/80) |
| F81 | Dark Mode Visual Implementation | Backlog | — | [#81](https://github.com/marvinmednick/grocerylist/issues/81) |
| F82 | Trip Notes | Backlog | — | [#82](https://github.com/marvinmednick/grocerylist/issues/82) |
| F9 | Trip History View | Done | [specs/F9-trip-history.md](specs/F9-trip-history.md) · [design](docs/design/F9-trip-history.md) | [#11](https://github.com/marvinmednick/grocerylist/issues/11) |
| F12 | Smart Entry Model | Done | [specs/F12-smart-entry-model.md](specs/F12-smart-entry-model.md) · [design](docs/design/F12-smart-entry-model.md) | [#42](https://github.com/marvinmednick/grocerylist/issues/42) |
| F13 | List Display Density & Warnings | Done | [specs/F13-list-display-warnings.md](specs/F13-list-display-warnings.md) · [design](docs/design/F13-list-display-warnings.md) | [#43](https://github.com/marvinmednick/grocerylist/issues/43) |
| F44 | Free-form Input Parsing | Done | [specs/F44-freeform-input-parsing.md](specs/F44-freeform-input-parsing.md) · [design](docs/design/F44-freeform-input-parsing.md) | [#44](https://github.com/marvinmednick/grocerylist/issues/44) |
| F15 | Freeform Qty "Other" Chip | Done | [specs/F15-freeform-qty-other-chip.md](specs/F15-freeform-qty-other-chip.md) · [design](docs/design/F15-freeform-qty-other-chip.md) | [#58](https://github.com/marvinmednick/grocerylist/issues/58) |
| F16 | Store Preferences UI Redesign | Done | [specs/F16-store-preferences-ui.md](specs/F16-store-preferences-ui.md) · [design](docs/design/F16-store-preferences-ui.md) | [#61](https://github.com/marvinmednick/grocerylist/issues/61) |
| F17 | Item Entry Flow Polish | Done | [specs/F17-item-entry-polish.md](specs/F17-item-entry-polish.md) | [#67](https://github.com/marvinmednick/grocerylist/issues/67) |
| F18 | Warning System Improvements | Done | [specs/F18-warning-system-improvements.md](specs/F18-warning-system-improvements.md) | [#70](https://github.com/marvinmednick/grocerylist/issues/70) |
| F19 | Store Management UI | Done | [specs/F19-store-management-ui.md](specs/F19-store-management-ui.md) | [#53](https://github.com/marvinmednick/grocerylist/issues/53) [#54](https://github.com/marvinmednick/grocerylist/issues/54) [#62](https://github.com/marvinmednick/grocerylist/issues/62) |
| F20 | Test Quality Sweep | Done | [specs/F20-test-quality-sweep.md](specs/F20-test-quality-sweep.md) | [#71](https://github.com/marvinmednick/grocerylist/issues/71) |
| F21 | Items Screen Enhancements | Done | [specs/F21-items-screen-enhancements.md](specs/F21-items-screen-enhancements.md) | [#73](https://github.com/marvinmednick/grocerylist/issues/73) [#64](https://github.com/marvinmednick/grocerylist/issues/64) |
| F22 | WarningBadge Modal Fix | Done | [specs/F22-warning-badge-modal.md](specs/F22-warning-badge-modal.md) | [#50](https://github.com/marvinmednick/grocerylist/issues/50) |
| F23 | Store Dropdown in Edit Modals | Done | [specs/F23-store-dropdown-edit-modals.md](specs/F23-store-dropdown-edit-modals.md) | [#74](https://github.com/marvinmednick/grocerylist/issues/74) |
| F75 | Backend Logging & Diagnostics | Backlog | — | [#75](https://github.com/marvinmednick/grocerylist/issues/75) |
| F96 | Swipe Actions on Shopping List Rows | Backlog | — | [#96](https://github.com/marvinmednick/grocerylist/issues/96) |
| F94 | Voice Input Parser Normalization | Done | [specs/F94-voice-input-normalization.md](specs/F94-voice-input-normalization.md) | [#94](https://github.com/marvinmednick/grocerylist/issues/94) |
| F98 | Multi-Word Store Name Matching | Backlog | — | [#98](https://github.com/marvinmednick/grocerylist/issues/98) |
| F99 | Quick-Accept: Enter Key + Voice Trigger | In Review | [specs/F99-quick-accept.md](specs/F99-quick-accept.md) · [design](docs/design/F99-quick-accept.md) | [#99](https://github.com/marvinmednick/grocerylist/issues/99) |

**Statuses:** `Backlog` → `Designed` → `Specced` → `In Progress` → `Needs Fixes` → `In Review` → `Done`
(`Designed` is optional — features with clear requirements can go `Backlog` → `Specced` directly)
(`Needs Fixes` = review found blocking issues, implementor must act; `In Review` = review passed, ready to ship)

## Future Features (Unscheduled)

| Feature | Notes |
|---------|-------|
| Multi-Household Management | Infrastructure ready; needs invite/join UI. Activate with `EXPO_PUBLIC_HOUSEHOLD_MODE=multi` |
| Sorting & Reordering | Manual or category-based sorting within stores |
| Aisle/Store Mapping | Order items based on store layout |
| Price Tracking | Log prices per item/store for trip total estimates |
| Offline Mode | Local persistence for poor-reception stores |

## Completed

- F1 — List Interaction Modes & Header Consolidation ([#1](https://github.com/marvinmednick/grocerylist/issues/1), [spec](specs/F1-list-interactions.md))
- Project scaffolding (Expo + TypeScript + StyleSheet)
- Database schema (items, stores, categories, list_items, trips)
- Authentication (Supabase Auth, route protection, session persistence)
- Active shopping list (grouped by store, checkbox toggle, realtime sync)
- Smart Add component (autocomplete, quick add, edit-before-add, one-off items)
- Master item library (searchable, add/edit)
- Multi-quantity support (`alternate_qtys`, quick-select chips)
- Trip workflow (store-specific end trip, global end trip, archival)
- Global undo/redo system (command pattern, 100-action stack)
- In-list editing (name, qty, store)
- Deletion with undo
- Drag-and-drop reordering (cross-store, with undo)
- Active selection search (inline qty/store pills before adding)
- Multi-store management (link items to multiple stores, set default)
- Household infrastructure (households + profiles tables, single/multi mode, RLS)
- Realtime toast notifications (remote changes, self-mutation suppression)
- Sign-out cache clear
