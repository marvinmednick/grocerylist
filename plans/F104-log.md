# F104 Feature Log

## 2026-04-20 — Specced
- **Spec:** `specs/F104-per-entry-store-id.md`
- **GitHub Issue:** #104
- **Review Level:** Full
- **Scope:** Move `store_id` from `list_items` to `list_item_quantities` so each quantity entry owns its store independently. Includes a DB migration (add column, backfill, null out parent), updated list grouping (by entry store instead of parent store), edit modal writes to entry, drag-to-reorder updates entry, End Trip filters entries directly, and duplicate detection reads active entry's store. `list_items.store_id` is deprecated (always NULL) but not dropped.
- **Closes on ship:** #104

## 2026-04-20 — Review 1 (Passed)
- **Result:** Passed — no blocking issues
- **Tests:** 644/644 passed, 0 skipped
- **Non-blocking:** none

## 2026-04-20 — Shipped
- **Commit:** `feat: per-entry store ID migration (#104)`
- **Closed:** #104
