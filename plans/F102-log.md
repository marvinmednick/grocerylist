# F102 — Optimistic Toggle for Checkboxes — Log

## 2026-04-13 — Spec written
- **Trigger:** User reported ~500ms lag on shopping list checkbox toggles
- **Root cause:** No optimistic update — UI waits for server round-trip + refetch before updating
- **Fix approach:** Add `onMutate` optimistic cache update to `useTogglePurchased`, drop unnecessary `.select().single()` from mutation
- **Spec:** specs/F102-optimistic-toggle.md
- **Issue:** #102

## 2026-04-14 — Review 1 (Passed)
- **Result:** Passed — no blocking issues
- **Tests:** 570/570 passed
- **Non-blocking:** none
