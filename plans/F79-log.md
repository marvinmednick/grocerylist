# F79 Feature Log

## 2026-03-31 — Designed
- **Design doc:** `docs/design/F79-quantity-units-system.md`
- **Scope:** Move vocabulary (units, packages, size descriptors) from in-memory constants to household-scoped DB tables. Add JSONB quantity columns to `list_items` and `items`. Add vocabulary management UI ("Sizes & Packages") accessible from the avatar menu.

## 2026-04-04 — Specced
- **Spec:** `specs/F79-quantity-units-system.md`
- **GitHub Issue:** #79
- **Review Level:** Full
- **Scope:** Database migration (drop old `units` table, create three household-scoped vocabulary tables, add JSONB quantity columns); `useVocabulary()` hook + CRUD mutations; SmartAddItem parser integration swap; UserAvatar menu updates (rename "Settings"→"General", add "Sizes & Packages"); `SizesAndPackages` and `VocabularyManagement` components; vocabulary seed on new household creation.
- **Closes on ship:** #79

## 2026-04-04 — Review 1 (Passed)
- **Result:** Passed — no blocking issues
- **Tests:** 366/366 passed
- **Non-blocking:** `SmartAddItem.tsx:161,473` — `quantityEquals` calls pass `DEFAULT_VOCABULARY` instead of `vocab`; custom vocabulary not used for pill deduplication. Fixed before commit.

## 2026-04-04 — Shipped
- **Commit:** `feat: F79 — vocabulary tables, Sizes & Packages UI, parser integration refs #79`
- **Closed:** #79
