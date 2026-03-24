# F23 Feature Log

## 2026-03-23 — Specced

- **Spec:** `specs/F23-store-dropdown-edit-modals.md`
- **GitHub Issue:** #74
- **Review Level:** Light
- **Scope:** Replace store pill selectors in SmartAddItem's "Add Detail" modal and index.tsx's "Edit Item" modal with an in-document dropdown (trigger + menu), consistent with the existing dropdown in items.tsx. Adds a "— No store —" option to allow clearing the store. Also brings both modals into compliance with the modal pattern standard: safe-area insets (`paddingTop: insets.top`, `paddingBottom: insets.bottom`) on outermost containers, and a Cancel button in SmartAddItem's master-item action row (currently missing).
- **Closes on ship:** #74
