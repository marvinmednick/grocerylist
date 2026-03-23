# F20 Feature Log

## 2026-03-22 — Specced

- **Spec:** `specs/F20-test-quality-sweep.md`
- **GitHub Issue:** #71
- **Review Level:** Full
- **Scope:** Four batched test quality fixes: update stale `useHousehold` mock in `index-interactions-test.tsx`, remove `Settings.tsx` `renderInline` prop and update tests to use the Modal code path, add global End All button multi-purchaser modal test to `index-f2-test.tsx`, add `useUpdateMasterItem` household guard and two error-path tests to `items-test.ts`.
- **Closes on ship:** #12, #28, #33, #51

## 2026-03-22 — Review 1 (Passed)
- **Result:** Passed — no blocking issues
- **Tests:** 200/200 passed
- **Non-blocking:** none
- **Note:** All changes implemented alongside F18 and present in committed code

## 2026-03-22 — Shipped
- **Commit:** `feat: warning system improvements (refs #70, #47, #68, #69)` (F20 changes bundled with F18 commit)
- **Closed:** #71, #12, #28, #33, #51
