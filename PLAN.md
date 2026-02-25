# Grocery App — Feature Registry

## Active Features

| ID | Feature | Status | Spec | Issue |
|----|---------|--------|------|-------|
| F001 | List Interaction Modes & Header Consolidation | In Review | [specs/F001-list-interactions.md](specs/F001-list-interactions.md) | [#1](https://github.com/marvinmednick/grocerylist/issues/1) |
| F002 | Multi-User Trip Management | Backlog | [docs/design/multi-user-trips.md](docs/design/multi-user-trips.md) | — |
| F003 | Recipes & Bundles | Backlog | — | — |
| F004 | Fuzzy Matching | Backlog | — | — |
| F005 | Duplicate Entry Handling | Backlog | — | — |
| F006 | Quantity Units System | Backlog | — | — |

**Statuses:** `Backlog` → `Specced` → `In Progress` → `In Review` → `Done`

## Future Features (Unscheduled)

| Feature | Notes |
|---------|-------|
| Multi-Household Management | Infrastructure ready; needs invite/join UI. Activate with `EXPO_PUBLIC_HOUSEHOLD_MODE=multi` |
| Sorting & Reordering | Manual or category-based sorting within stores |
| Aisle/Store Mapping | Order items based on store layout |
| Price Tracking | Log prices per item/store for trip total estimates |
| Offline Mode | Local persistence for poor-reception stores |

## Completed

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
