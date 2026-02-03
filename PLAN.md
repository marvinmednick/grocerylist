# Grocery App - Project Plan & Status

## ✅ Completed (MVP + Core Enhancements)
- [x] **Project Scaffolding:** Expo (React Native) + TypeScript + StyleSheet (Robust Layout).
- [x] **Database Design:** Relational schema for Items, Stores, Categories, List Items, and Trips.
- [x] **Authentication:** Supabase Auth (Sign In / Sign Up) with route protection and session persistence.
- [x] **Active Shopping List:** Grouped by store, checkbox toggle, real-time sync via Supabase Channels.
- [x] **Smart Add Component:** Autocomplete from Master DB, "Quick Add" with defaults, "Edit Before Add" modal, and One-off items.
- [x] **Master Library View:** Searchable list of all known items with Add/Edit capabilities.
- [x] **Multi-Quantity Support:** Save `alternate_qtys` in Master DB; show as quick-select chips in the Add modal.
- [x] **Detailed Trip Workflow:** 
    - Store-specific "End Trip" buttons in headers.
    - Global "End All Shopping Trips" footer.
    - Items remain crossed out until archived.
    - `archived_at` and `trip_id` linkage for history and integrity.
- [x] **Global Undo & Redo System:** Command-pattern based stack (last 100 actions). Covers Adds, Toggles, Edits, Deletes, Trip Archivals, and Drag-and-Drop moves.
- [x] **In-List Editing:** Tap item name to change Qty, Store, or Name post-addition.
- [x] **Deletion:** Trash icon in Edit modal with full Undo restoration.
- [x] **Drag and Drop Reordering:** Long-press to move items between store sections with automatic database re-assignment.
- [x] **Active Selection Search:** Configure quantity and store via inline pills before adding to list.
- [x] **Multi-Store Management:** Link items to multiple stores and designate defaults in the Master Library.
- [x] **Visual Polish:** Consistent `Description - Quantity` formatting and centered mobile-responsive layout.

## 🚀 Current Focus (Next Steps)
1.  **Recipes & Bundles:**
    - Ability to define a "Recipe" (group of items).
    - "Staging" UI: Select a recipe, check/uncheck ingredients, then add all to list at once.
2.  **Database Security (RLS):**
    - Finalize Supabase RLS policies to ensure user privacy and multi-tenancy.
3.  **Fuzzy Matching:**
    - Improve search logic with Levenshtein distance for "Did you mean?" suggestions.
4.  **Duplicate Entry Handling:**
    - Detect when an item being added is already on the active list.
    - Scenarios: Same store match, different store match, quantity variations.
    - User Options: "Update/Merge Quantities", "Add as Duplicate", or "Cancel".

## 🛠 Future Features (Backlog)
- [ ] **Family Sharing:** Invite another user to a shared list/household.
- [ ] **Sorting & Reordering:** Manual drag-and-drop or category-based sorting within stores.
- [ ] **Aisle/Store Mapping:** Order items based on store layout.
- [ ] **Price Tracking:** Log prices per item/store for total trip estimation.
- [ ] **Offline Mode:** Local persistence for use in stores with poor reception.