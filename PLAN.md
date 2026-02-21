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
- [x] **Household Infrastructure:** `households` and `profiles` tables with `household_id` on all user-scoped tables. Single-household mode (`EXPO_PUBLIC_HOUSEHOLD_MODE=single`) assigns all users to one default household. Household-scoped RLS policies via `get_my_household_id()` helper function. Profile creation on signup and first sign-in.
- [x] **Household-Scoped RLS:** All user data (items, list_items, item_stores, shopping_trips) protected by household-scoped RLS policies. Global tables (stores, categories, units) remain shared.
- [x] **Realtime Toast Notifications:** Remote changes from other household members trigger animated toast notifications. Local mutation tracking prevents self-triggered toasts.
- [x] **Sign-Out Cache Clear:** `queryClient.clear()` on sign-out wipes cached household_id and all stale data.

## 🚀 Current Focus (Next Steps)
1.  **Multi-User Trip Management:** (`docs/design/multi-user-trips.md`)
    - Add `purchased_by` to `list_items` — tracks who checked off each item.
    - Color-coded check-off icons per user (color from `profiles.color`).
    - User display names (`profiles.display_name_short`) — editable in settings.
    - Smart end-trip: single-user → immediate, multi-user at same store → selection dialog.
2.  **Recipes & Bundles:**
    - Ability to define a "Recipe" (group of items).
    - "Staging" UI: Select a recipe, check/uncheck ingredients, then add all to list at once.
3.  **Fuzzy Matching:**
    - Improve search logic with Levenshtein distance for "Did you mean?" suggestions.
4.  **Duplicate Entry Handling:**
    - Detect when an item being added is already on the active list.
    - Scenarios: Same store match, different store match, quantity variations.
    - User Options: "Update/Merge Quantities", "Add as Duplicate", or "Cancel".
5.  **Quantity Units System:**
    - Create a master list of common units (lbs, oz, cans, bags, etc.).
    - Allow items to define a default unit (e.g., Ground Beef defaults to 'lbs').
    - UI: Provide a picker for units while still allowing free-form text for the quantity value (e.g., "2-2.5").

## 🛠 Future Features (Backlog)
- [ ] **Multi-Household Management:** Invite/join UI for switching households. Infrastructure already in place — only needs `EXPO_PUBLIC_HOUSEHOLD_MODE=multi` and a UI for entering household codes or accepting invites.
- [ ] **Sorting & Reordering:** Manual drag-and-drop or category-based sorting within stores.
- [ ] **Aisle/Store Mapping:** Order items based on store layout.
- [ ] **Price Tracking:** Log prices per item/store for total trip estimation.
- [ ] **Offline Mode:** Local persistence for use in stores with poor reception.