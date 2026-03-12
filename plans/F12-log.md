# F12 Feature Log

## 2026-03-08 — Specced
- **Spec:** `specs/F12-smart-entry-model.md`
- **GitHub Issue:** #42
- **Review Level:** Full
- **Scope:** Active-store selector, household-scoped stores, item_store_preferences table replacing item_stores, warning computation on add, store creation flow

## 2026-03-11 — Review 1 (Passed)
- **Result:** Passed — no blocking issues
- **Tests:** 146/146 passed
- **Non-blocking:** SmartAddItem `as any` casts, computeWarnings behavioral delta vs spec, StoreSelector color palette, StoreSelectorProps string vs string|null
