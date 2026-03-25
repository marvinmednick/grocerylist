## Progress Log

### Files
- ✅ `client/components/SmartAddItem.tsx` — Replaced store pills with in-modal dropdown UI, added dropdown open/close state reset on modal open, added safe-area insets to modal container/actions, added master-item Cancel button with close/reset behavior, and used exact `— No store —` option text.
- ✅ `client/app/(tabs)/index.tsx` — Replaced Edit Item store pills with dropdown trigger/menu, reset dropdown state on modal open, applied safe-area inset padding on modal container/actions, and used exact `— No store —` option text.
- ✅ `client/components/__tests__/SmartAddItem-test.tsx` — Updated existing modal store assertions for dropdown behavior, added F23 tests for dropdown open/select/clear/toggle plus master-item Cancel presence/reset behavior, and mocked `useSafeAreaInsets` for test compatibility.
- ✅ `client/app/(tabs)/__tests__/index-interactions-test.tsx` — Added F23 interaction coverage for dropdown trigger rendering, options visibility, selecting a store, and clearing to No store in Edit Item modal.

### Issues
- None

### Status
Complete
