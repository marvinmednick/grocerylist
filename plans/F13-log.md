# F13 Feature Log

## 2026-03-08 — Specced
- **Spec:** `specs/F13-list-display-warnings.md`
- **GitHub Issue:** #43
- **Review Level:** Full
- **Scope:** Multi-line item rows with short_name, warning badge component, toast warning variant, Settings warnings section, schema migration (short_name, warnings, warning_preferences columns)

## 2026-03-11 — Review 1 (Needs Fixes)
- **Result:** Needs Fixes — 1 blocking issue
- **Blocking:** 3 spec-required test cases missing from items-test.tsx (short_name modal rendering, prefill, and payload assertions)
- **Non-blocking:** Warning type duplicated across WarningBadge and api/items.ts; `as any` cast in items.tsx:185
- **Next:** Implementor adds the 3 missing short_name tests; re-review

## 2026-03-11 — Review 2 (Passed)
- **Result:** Passed — no blocking issues
- **Tests:** 146/146 passed
- **Non-blocking:** (none new)

## 2026-03-11 — Shipped
- **Commit:** `feat: implement F12 smart entry model and F13 list display warnings (closes #42, closes #43)`
- **Closes:** #43
