# Grocery App — Feature Registry

## Active Features

| ID | Feature | Status | Spec | Issue |
|----|---------|--------|------|-------|
| F2 | Multi-User Trip Management | Done | [specs/F2-multi-user-trips.md](specs/F2-multi-user-trips.md) · [design](docs/design/F2-multi-user-trips.md) | [#4](https://github.com/marvinmednick/grocerylist/issues/4) |
| F3 | Recipes & Bundles | Backlog | — | [#5](https://github.com/marvinmednick/grocerylist/issues/5) |
| F4 | Fuzzy Matching | Backlog | — | [#6](https://github.com/marvinmednick/grocerylist/issues/6) |
| F5 | Duplicate Entry Handling | Backlog | — | [#7](https://github.com/marvinmednick/grocerylist/issues/7) |
| F6 | Quantity Units System | Backlog | — | [#8](https://github.com/marvinmednick/grocerylist/issues/8) |
| F7 | Settings Screen | Done | [specs/F7-settings.md](specs/F7-settings.md) · [design](docs/design/F7-settings.md) | [#9](https://github.com/marvinmednick/grocerylist/issues/9) |
| F8 | Enhanced Shopping Mode (Store Focus) | Backlog | — | [#10](https://github.com/marvinmednick/grocerylist/issues/10) |
| F10 | Dark Mode Visual Implementation | Backlog | — | [#27](https://github.com/marvinmednick/grocerylist/issues/27) |
| F11 | Trip Notes | Backlog | — | [#40](https://github.com/marvinmednick/grocerylist/issues/40) |
| F9 | Trip History View | Done | [specs/F9-trip-history.md](specs/F9-trip-history.md) · [design](docs/design/F9-trip-history.md) | [#11](https://github.com/marvinmednick/grocerylist/issues/11) |
| F12 | Smart Entry Model | Done | [specs/F12-smart-entry-model.md](specs/F12-smart-entry-model.md) · [design](docs/design/F12-smart-entry-model.md) | [#42](https://github.com/marvinmednick/grocerylist/issues/42) |
| F13 | List Display Density & Warnings | Done | [specs/F13-list-display-warnings.md](specs/F13-list-display-warnings.md) · [design](docs/design/F13-list-display-warnings.md) | [#43](https://github.com/marvinmednick/grocerylist/issues/43) |
| F14 | Free-form Input Parsing | Backlog | — | [#44](https://github.com/marvinmednick/grocerylist/issues/44) |
| F15 | Freeform Qty "Other" Chip | Done | [specs/F15-freeform-qty-other-chip.md](specs/F15-freeform-qty-other-chip.md) · [design](docs/design/F15-freeform-qty-other-chip.md) | [#58](https://github.com/marvinmednick/grocerylist/issues/58) |
| F16 | Store Preferences UI Redesign | Done | [specs/F16-store-preferences-ui.md](specs/F16-store-preferences-ui.md) · [design](docs/design/F16-store-preferences-ui.md) | [#61](https://github.com/marvinmednick/grocerylist/issues/61) |
| F17 | Item Entry Flow Polish | Done | [specs/F17-item-entry-polish.md](specs/F17-item-entry-polish.md) | [#67](https://github.com/marvinmednick/grocerylist/issues/67) |

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
