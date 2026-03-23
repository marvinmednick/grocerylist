# F21 Feature Log

## 2026-03-23 — Specced

- **Spec:** `specs/F21-items-screen-enhancements.md`
- **GitHub Issue:** #73
- **Review Level:** Full
- **Scope:** Add sort pills (A→Z, Z→A, Newest, Oldest), a Recently Added filter toggle (last 7 days, ANDs with text search, auto-sets sort to Newest), and a "New" badge on item cards for recently created items. Adds `SortOption` type and `created_at` to `MasterItem`; updates `useAllItems` to accept a sort parameter.
- **Closes on ship:** #64, #73
- **Note:** F21 originally batched #44 (Free-form Input Parsing) with #64 — #44 was split out and remains under F14.
