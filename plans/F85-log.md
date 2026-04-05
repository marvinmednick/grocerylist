# F85 Feature Log

## 2026-04-04 — Specced
- **Spec:** `specs/F85-structured-quantity-conversion.md`
- **GitHub Issue:** #85
- **Review Level:** Full
- **Scope:** Populate `list_items.quantity_parsed`, `items.default_qty_parsed`, and `items.alternate_qtys_parsed` at write time (SmartAddItem + Items screen). Bundled: add explicit `plural TEXT NOT NULL` column to `packages` table; thread `packagePlural` through vocabulary → parser → `QuantityFields` → JSONB; fix `formatQuantity` to use field-based plural instead of `DEFAULT_VOCABULARY`; add "Plural form" input to VocabularyManagement UI for packages; export `parseQuantityText()` from `quantityFormat.ts`.
- **Closes on ship:** #85

## 2026-04-04 — Review 1 (Passed)
- **Result:** Passed — no blocking issues
- **Tests:** 401/401 passed
- **Non-blocking:** none

## 2026-04-04 — Needs Fixes (post-review design clarification)
- **Blocking:** Write-time normalization of `quantity` TEXT missing. When `quantity_parsed` is non-null, `quantity` must be set to `formatQuantity(quantity_parsed)` — not the raw user input. Without this, display is inconsistent (e.g. "2 Cans" vs "2 cans" for identical parsed data). Applies to all three write paths: SmartAddItem (`quantity`), Items screen (`default_qty`, each `alternate_qtys[]` element).
- **Spec updated:** Display Model section added; SmartAddItem and items.tsx write-path sections updated with normalization logic; Acceptance Criteria and Tests to Write expanded.
- **Status:** Needs Fixes → implementor must apply normalization before F85 can ship.

## 2026-04-04 — Review 2 (Passed)
- **Result:** Passed — no blocking issues
- **Tests:** 407/407 passed
- **Non-blocking:** none

## 2026-04-04 — Shipped
- **Commit:** `feat: F85 — structured quantity data conversion refs #85`
- **Closed:** #85
