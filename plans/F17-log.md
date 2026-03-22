# F17 Feature Log

## 2026-03-22 — Specced

- **Spec:** `specs/F17-item-entry-polish.md`
- **GitHub Issue:** #67
- **Review Level:** Full
- **Scope:** Batches four item entry flow fixes: one-off edit modal two-button split (#63), qty chip row on the one-off create row (#59), alternate qty chips in the in-list edit modal (#60), and null-category defaults + "None" chip in Items screen (#65). No schema changes; all UI is an extension of established patterns.
- **Closes on ship:** #63, #59, #60, #65

## 2026-03-22 — Review 1 (Passed)

- **Result:** Passed — no blocking issues
- **Tests:** 181/181 passed (18 new tests added across 4 test files)
- **Non-blocking:** `index.tsx:565` Usual Quantities wrapper uses inline `style={{ marginBottom: 16 }}` instead of StyleSheet.create() — fixed in triage commit

## 2026-03-22 — Shipped

- **Commit:** `feat: item entry flow polish (closes #63, #59, #60, #65, #67)`
- **Closes:** #63, #59, #60, #65, #67
