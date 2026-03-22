# F16 Feature Log

## 2026-03-17 — Specced

- **Spec:** `specs/F16-store-preferences-ui.md`
- **Design Doc:** `docs/design/F16-store-preferences-ui.md`
- **GitHub Issue:** #61
- **Review Level:** Full
- **Scope:** Redesign the store preferences section in the item edit modal. Replaces the all-stores segmented-button layout with two sub-sections: a compact preference assignment UI (store dropdown + status pills + add/remove + summary) and a separate comment management UI (store dropdown + add button + comment list + sibling comment edit modal). Includes a schema migration to allow `neutral` status rows in `item_store_preferences` so comments can exist independent of preference status.

## 2026-03-18 — Review 1 (Needs Fixes)
- **Result:** Needs Fixes — 1 blocking issue + UX revision from review feedback
- **Blocking:** Migration `20250101000012` not applied to remote; neutral rows rejected by DB CHECK, silently wiping all preferences on save
- **UX changes from review:**
  - Removed `+`/`−` buttons — pill tap sets preference directly
  - Changed `N/A` pill label to `Unavailable`
  - Removed separate comment sub-section (own dropdown + Add Comment + modal)
  - Replaced with inline comment field below pills, tied to selected store
  - Added `Save Comment` button; removed comment edit Modal entirely
  - State simplified from 6 new variables to 3
- **Non-blocking (backlogged):** Summary comma separators, em dash in comment rows, pill-tap-before-plus behavior (resolved by removing + button)
- **Next:** Apply migration (`npx supabase db push`), re-implement per updated spec/approved plan

## 2026-03-19 — UX Revision (pre-Review 2)

- Removed "Save Comment" button — comment now saves with modal Save; `onChangeText` calls `updateStoreComment` directly
- Removed `pendingCommentText` state — down to 2 state variables (`selectedPrefStoreId`, `prefDropdownOpen`)
- Added keyboard scroll fix: `scrollViewRef` on `ScrollView` + `scrollToEnd` on comment `onFocus`
- Updated spec, design doc, approved plan, and ui-guidelines.md to reflect both changes

## 2026-03-19 — Review 2 (Passed)
- **Result:** Passed — no blocking issues
- **Tests:** 169/169 passed
- **Migration:** `20250101000012` applied to remote ✅
- **Non-blocking:** Comment row uses ` - ` (hyphen) not ` — ` (em dash); summary label trailing space in JSX
- **Status:** In Review — ready to ship
