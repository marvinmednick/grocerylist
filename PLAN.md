# Grocery App - Project Plan & Status

## ✅ Completed (MVP Phase)
- [x] **Project Scaffolding:** Expo (React Native) + TypeScript + NativeWind (partial) + StyleSheet.
- [x] **Database Design:** Relational schema for Items, Stores, Categories, and List Items.
- [x] **Authentication:** Supabase Auth (Sign In / Sign Up) with route protection.
- [x] **Active Shopping List:** Grouped by store, checkbox toggle, real-time sync.
- [x] **Smart Add Component:** Autocomplete from Master DB, "Quick Add" with defaults, "Edit Before Add" modal, and One-off items.
- [x] **Master Library View:** Searchable list of all known items (Tab 2).
- [x] **Infrastructure:** Git initialized, `.env` configured, Supabase connected.

## 🚀 Current Focus (Next Steps)
1.  **"Shopping Trip" Workflow:** 
    - Implementation of "Start Trip" and "End Trip".
    - "Cleanup" logic: When ending a trip, what happens to unbought items? (Keep, Delete, or Move to next trip).
2.  **Master Item Editing:**
    - Allow users to edit existing items in the "Items" tab (change default store, rename, etc.).
3.  **Database Security (RLS):**
    - Enable Row Level Security in Supabase so users only see their own family/user lists.

## 🛠 Future Features (Backlog)
- [ ] **Recipes & Bundles:** Add groups of items to the list at once (with the "Staging/Review" modal).
- [ ] **Fuzzy Matching:** Improved "Did you mean?" logic for typos in the search bar.
- [ ] **Usual Quantities:** Dropdown in Edit Modal populated by historical usage for that item.
- [ ] **Retroactive Trips:** Log a trip that happened in the past (Cleanup for "forgot to check off" scenario).
- [ ] **Family Sharing:** Ability to invite another user to see the same list.

## 📝 User Workflows (Target Scenarios)
1.  **The Quick Add:** Type "Mi", tap "Milk", item appears in Safeway section immediately.
2.  **The One-Off:** Type "Sunscreen", tap "Add One-time", item appears in "Other" section; not saved to DB.
3.  **The New Favorite:** Type "Dragonfruit", hit Edit icon, assign "Produce" and "Whole Foods", tap "Save". Item is now in DB for next time.
4.  **The Cleanup:** Tap "End Trip" button. System asks: "You didn't get Eggs. Keep them on the list?" User says Yes. Eggs remain, everything else is archived.
