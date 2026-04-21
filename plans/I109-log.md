# Duplicate dialog: no combine option when existing qty is plain count and incoming has package type

GitHub: [#109](https://github.com/marvinmednick/grocerylist/issues/109)
Workflow: resolve (no spec, no progress file)

---

## 2026-04-20 — Resolved

- **Fix:** Updated `combineQuantities()` to combine plain counts with packaged quantities by inheriting the package metadata from the packaged side, and suppressed size-less same-package multipack duplicates.
- **Path:** Path A — bug investigation
- **Files changed:** `client/lib/quantityFormat.ts`, `client/lib/__tests__/combineQuantities-test.ts`
- **Tests:** 655/655 passed
