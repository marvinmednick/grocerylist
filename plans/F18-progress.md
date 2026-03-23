## Progress Log

### Files
- ✅ `client/api/items.ts` — added shared `getWarningText` formatter and `useItemById(itemId)` query hook with the approved query shape/key.
- ✅ `client/api/list.ts` — replaced inline warnings typing with imported canonical `Warning[]`.
- ✅ `client/components/WarningBadge.tsx` — removed local warning model/formatter and now uses shared `Warning` + `getWarningText`.
- ✅ `client/components/WarningCallout.tsx` — added inline warning callout component with warning rows, icon mapping, and shared warning text.
- ✅ `client/components/SmartAddItem.tsx` — added profile-driven warning toast callback support and Add Detail warning callout rendering for master items; fixed one-off flow toast skip and safe profile-query fallback for tests.
- ✅ `client/app/(tabs)/index.tsx` — added lazy master-item detail query for edit modal, warning callout, and warning toast variant support.
- ✅ `client/components/__tests__/WarningBadge-test.tsx` — added type-migration smoke test using `Warning` from `api/items`.
- ✅ `client/components/__tests__/WarningCallout-test.tsx` — added full callout rendering coverage for each warning type and empty state.
- ✅ `client/components/__tests__/SmartAddItem-test.tsx` — added Add Detail warning callout coverage and warning-toast preference behavior tests.
- ✅ `client/app/(tabs)/__tests__/index-interactions-test.tsx` — added List Edit warning callout tests for master-linked vs one-off list items.
- ✅ `BACKLOG.md` — verified required deferred F18 line already present exactly; no content change needed.

### Issues
- None

### Status
Complete
