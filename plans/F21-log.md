# F21 Feature Log

## 2026-03-23 — Specced

- **Spec:** `specs/F21-items-screen-enhancements.md`
- **GitHub Issue:** #73
- **Review Level:** Full
- **Scope:** Add sort pills (A→Z, Z→A, Newest, Oldest), a Recently Added filter toggle (last 7 days, ANDs with text search, auto-sets sort to Newest), and a "New" badge on item cards for recently created items. Adds `SortOption` type and `created_at` to `MasterItem`; updates `useAllItems` to accept a sort parameter.
- **Closes on ship:** #64, #73
- **Note:** F21 originally batched #44 (Free-form Input Parsing) with #64 — #44 was split out and remains under F14.

## 2026-03-23 — Review 1 (Passed)
- **Result:** Passed — no blocking issues
- **Tests:** 20/20 passed (228/230 suite-wide; 2 pre-existing flaky act() failures in unrelated files)
- **Non-blocking:** Pre-existing flaky failures (`sends short_name`, `modal header shows owner name`) show as unexpected in check-tests but are unrelated to F21 and pass when run in isolation
