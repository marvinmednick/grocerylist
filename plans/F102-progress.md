## Progress Log

### Files
- ✅ `client/api/list.ts` — Replaced `useTogglePurchased` with optimistic `onMutate`/`onError`/`onSettled`, kept mutation tracking, and removed `.select().single()` so the mutation ends at `.eq('id', id)`.
- ✅ `client/api/__tests__/list-toggle-optimistic-test.tsx` — Added focused optimistic-cache tests for check/uncheck/override, rollback sequencing, settled invalidation, and mutation-chain verification that `.select()`/`.single()` are not used.

### Issues
- None

### Status
Complete — `npm --prefix client test --watchAll=false` passing
