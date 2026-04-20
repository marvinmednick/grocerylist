# F78 Feature Log

## 2026-04-19 — Specced
- **Spec:** `specs/F78-duplicate-entry-handling.md`
- **GitHub Issue:** #78
- **Review Level:** Full
- **Scope:** Detect duplicate items at add time and present a resolution dialog (combine, add new, custom, cancel). Includes passive "on list" indicator in SmartAddItem dropdown, bottom-anchored dialog modal, cross-store and purchased-item handling, and full undo support.
- **Closes on ship:** #78

## 2026-04-19 — Plan Reviewed
- **Plan draft:** `plans/F78-plan.md`
- **Approved plan:** `plans/F78-plan-approved.md`
- **Corrections:** (1) Removed misplaced `CombineOptions` type from `duplicateDetection.ts` description — belongs in `quantityFormat.ts`. (2) Added `currentUserId` param to `classifyDuplicateState` + `id` field to `MyProfile` interface in `api/profile.ts`.
- **Ambiguities resolved:** All — `purchased-other-user` classification now uses `myProfile.id`.

## 2026-04-19 — Review 1 (Needs Fixes)
- **Result:** Needs Fixes — 3 blocking issues (all test-related)
- **Blocking:** (1) 7 existing test files missing `useAddQuantityEntry` mock — 167 failures. (2) 3 SmartAddItem test files missing `listItems` prop. (3) DuplicateResolutionDialog test `onCombine` assertion expects spurious `undefined` second arg — 1 failure.
- **Non-blocking:** none
- **Next:** Add `useAddQuantityEntry` mock + `listItems={[]}` prop to affected test files; fix `onCombine` assertion in DuplicateResolutionDialog test.

## 2026-04-20 — Review 2 (Passed)
- **Result:** Passed — no blocking issues
- **Tests:** 629/629 passed (54 suites)
- **Verified:** household guard on `useAddQuantityEntry`, local mutation tracking wraps insert in try/finally, all undo closures snapshot pre-mutation state, redo uses mutable `tracker.currentEntryId` for Add-New flows (same-store + cross-store), `['shopping_list']` invalidation, StyleSheet-only styling, `<Modal>` used (no Alert), no migrations required, "on list" indicator wired from `listItems` prop, dialog dismissal restores `savedQuery`.
- **Non-blocking:**
  - No direct unit test for `useAddQuantityEntry` household guard (existing pattern, e.g. `list-f103-test.tsx:196`, covers this for sibling hooks — add a parallel test).
  - No component test covering the Cancel/✕ query-restore path (`dismissDuplicateDialog` restores `savedQuery`).
  - Cross-store Add New flow (creates a new parent via `useAddToList`) is covered only by classification unit tests — no end-to-end component test.
  - `formatCombineOption` sum output ("3lb") has no space between qty and unit, while the multipack output ("2 × 1.5 lb") does — inherited from existing `formatQuantity` but inconsistent within the dialog; worth a small formatter pass.
- **Next:** Ship. Non-blocking items logged in BACKLOG.md.
