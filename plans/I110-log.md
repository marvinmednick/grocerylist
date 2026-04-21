# SmartAdd: make full result row selectable outside qty/store pills

GitHub: [#110](https://github.com/marvinmednick/grocerylist/issues/110)
Workflow: resolve (no spec, no progress file)

---

## 2026-04-20 — Resolved

- **Fix:** Made the SmartAdd result row main body the quick-add tap target so background taps in the qty section accept the item while qty pills and the chevron keep their own actions.
- **Path:** Path A — bug investigation
- **Files changed:** `client/components/SmartAddItem.tsx`, `client/components/__tests__/SmartAddItem-test.tsx`
- **Tests:** 658/658 passed

---

## 2026-04-20 — Review 1 (Passed)
- **Result:** Passed — no blocking issues
- **Tests:** 658/658 passed
- **Non-blocking:** none
