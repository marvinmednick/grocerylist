## Progress Log

### Files
- ✅ `client/components/DuplicateResolutionDialog.tsx` — replaced the normal-mode options area with inline combine/add-separate actions, updated add-separate labels by duplicate state, removed the separate Add New bottom action, and kept custom mode, summary text, and modal safe-area behavior unchanged.
- ✅ `client/components/__tests__/DuplicateResolutionDialog-test.tsx` — updated stale combine/add-new assertions, added add-separate label coverage by duplicate state, verified the old heading is gone, and preserved combine callback and dismiss/custom-flow coverage.
- ✅ `client/components/__tests__/SmartAddItem-f104-test.tsx` — updated dependent suite assertions to use `duplicate-add-separate` and the new `Combine as ... at ...` cross-store button labels required by the dialog change.
- ✅ `client/components/__tests__/SmartAddItem-test.tsx` — updated dependent duplicate-resolution assertions to use the inline add-separate control and the new `Combine as ...` labels in same-store and cross-store flows.

### Issues
- None

### Status
Complete
