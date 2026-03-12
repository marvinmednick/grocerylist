# Backlog

**This is a short-lived inbox, not a permanent list.** Items land here during `/spec` and `/review` when it's not the right moment to stop and handle them. After every feature ship or bug fix commit, triage this file: fix items now, promote them to GitHub Issues, or discard them. The goal is an empty backlog after each triage.

See WORKFLOW.md §8 (Backlog Triage) for the full process.

---

## Found in Review

- [ ] `Warning` type is defined in both `api/items.ts` and `components/WarningBadge.tsx` — WarningBadge should import the type from `api/items.ts` (F12 ships the stable type) — (found in F13 review, unblocked by F12)
- [ ] `SmartAddItem.tsx` uses `any` for item parameters (`item: any`, `updates: any`, `useState<any>`) — replace with `MasterItem` from `api/items.ts` — (found in F12 review)
- [ ] `computeWarnings` generates `non_standard_qty` warning when `alternateQtys` exist but `default_qty` is null; spec would not (gates on `quantity && defaultQty`). Edge case; may be more correct, but worth confirming intent — (found in F12 review)
- [ ] `(error as any).message` in `items.tsx:185` — replace with `(error as Error).message` — (found in F13 review)

- [ ] WarningBadge popover overlay uses hardcoded -300px offsets — consider `StyleSheet.absoluteFillObject` with Portal for more robust full-screen overlay (found in F13 review)
- [x] STORE_COLORS palette in StoreSelector uses 7 profile colors — expand to 10 store-specific colors per spec (found in F12 review) — fixed
- [x] `items.tsx` uses `any` types for editingItem, initializeStorePreferences param, and preference iteration — should use `MasterItem` (found in F12 review) — fixed
- [x] `supabase/full_schema.sql` not updated to reflect F12 migration changes (found in F12 review) — already done by implementor

## Deferred from Specs

- [ ] Auto-selection of active store based on location or time — future enhancement. (deferred from F12)
- [ ] Store editing UI (rename, change color) — no edit UI included in F12. (deferred from F12)
- [ ] Store deletion UI with cascade warnings — no delete UI included in F12. (deferred from F12)
