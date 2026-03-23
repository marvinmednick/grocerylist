# Implementation Plan: F18 Warning System Improvements

## Files to Modify

- `client/api/items.ts` —
  1. **Centralize warning text helper (#47)** — export `getWarningText(warning: Warning): string` from this file by moving the existing logic from `WarningBadge.tsx` unchanged so both badge and toast/callout paths share one canonical formatter.
  2. **Add item-by-id query hook for List Edit modal (#68)** — add `useItemById(itemId: string | null)` using the exact Supabase query shape:
     ```ts
     supabase
       .from('items')
       .select(`
         *,
         category:categories!default_category_id(name),
         item_store_preferences(
           store_id, status, comment,
           store:stores(id, name, color_code)
         )
       `)
       .eq('id', itemId)
       .single()
     ```
     Use React Query key `['item', itemId]` and enable only when `itemId` is non-null.
  3. **Ensure:** keep existing `Warning` union shape, existing item list/search hooks, and existing invalidation behavior for write hooks untouched.

- `client/api/list.ts` —
  1. **Type `ListItem.warnings` with canonical warning union (#47)** — replace the current loose inline warnings type with imported `Warning[]` from `@/api/items`.
  2. **Ensure:** do not change shopping-list query fields/joins, realtime mutation tracking, household behavior, or any mutation logic.

- `client/components/WarningBadge.tsx` —
  1. **Remove duplicate warning model (#47)** — delete the local `Warning` interface and import `Warning` from `@/api/items`.
  2. **Use shared warning text function (#47)** — remove local `getWarningText` and import `getWarningText` from `@/api/items`.
  3. **Ensure:** preserve existing badge rendering behavior, icon/color mapping, and deferred `-300px` overlay approach (no overlay refactor in F18).

- `client/components/SmartAddItem.tsx` —
  1. **Add warning toast callback + profile source (#69)** — add prop `onWarningToast?: (message: string) => void` and read user preferences via `useMyProfile()` from `@/api/profile`.
  2. **Render Add Detail warning callout in modal body (#68)** — inside the Add Detail modal, render `<WarningCallout>` below modal title and above modal `ScrollView`, with warnings computed reactively from `selectedItem.item_store_preferences`, `editStoreId`, and `editQty`; only render for master items (no callout for one-off items).
  3. **Trigger warning toast on add flows with warning prefs (#69)** — in `onCommitAdd` and `onSaveEdited`, after add succeeds, evaluate produced warnings against `warning_preferences`; if any warning type preference is `toast_and_badge`, call `onWarningToast` with a non-empty message and rely on parent toast variant support. Explicitly keep behavior where toast can fire even if inline warning was visible.
  4. **Skip one-off warning toasts (#69)** — keep `onOneOffAdd` and `onOneOffEditAdd` without warning toast checks because one-off items have no master `item_store_preferences`.
  5. **Ensure:** preserve existing add/edit flows, undo registration semantics, and modal safe-area/scroll behavior.

- `client/app/(tabs)/index.tsx` —
  1. **Fetch master item details lazily for List Edit modal (#68)** — add `useItemById(editingItem?.item_id ?? null)` and gate usage so the query is only relevant when the List Edit modal is open and the row is master-linked (`item_id` present).
  2. **Render List Edit warning callout in modal body (#68)** — in the List Edit modal, place `<WarningCallout>` below title and above `ScrollView`, computing warnings from fetched `item_store_preferences`, `editStoreId`, and `editQty`; do not render for one-off list items.
  3. **Support warning toast variant in local toast state (#69)** — extend toast state to `{ visible: boolean; message: string; variant: 'default' | 'warning' }` with default variant `'default'`, pass `variant={toast.variant}` to `<Toast>`, and pass `onWarningToast` to `<SmartAddItem>` to set warning toasts.
  4. **Ensure:** do not modify trip/list mutation behavior, existing undo hooks, or unrelated screen flows.

- `client/components/__tests__/WarningBadge-test.tsx` —
  1. **Type-migration smoke test (#47)** — add `it('accepts Warning type from api/items without type errors')` using a discriminated-union `Warning` object and assert render succeeds.
  2. **Ensure:** keep existing WarningBadge behavior tests unchanged.

- `client/components/__tests__/SmartAddItem-test.tsx` —
  1. **Add Detail callout visibility tests (#68)** — add tests that warning callout appears for master item with matching warning and is absent for one-off Add Detail.
  2. **Warning toast preference tests (#69)** — add tests for `onWarningToast` behavior:
     - quick-add triggers toast when pref is `toast_and_badge`
     - quick-add does not trigger for `badge_only`
     - quick-add does not trigger for `off`
     - Add Detail save triggers toast when warning exists and pref is `toast_and_badge`
  3. **Ensure:** extend existing test setup/mocks (including profile + search item mocks) without rewriting unrelated SmartAddItem tests.

- `client/app/(tabs)/__tests__/index-interactions-test.tsx` —
  1. **List Edit warning callout tests (#68)** — add tests that callout appears for master-linked items with warnings and does not appear for one-off list items.
  2. **Ensure:** preserve existing wrappers/providers and unrelated interaction assertions.

- `BACKLOG.md` —
  1. **Record deferred #50 item** — append exactly:
     ```
     - [ ] WarningBadge popover overlay uses hardcoded -300px offsets — proper fix needs Portal library or parent-level popover lifting. (deferred from F18, issue #50)
     ```
  2. **Ensure:** do not edit unrelated backlog entries.

## New Files

- `client/components/WarningCallout.tsx` — add inline warnings callout component with `warnings: Warning[]`; return `null` when empty; render one row per warning using `getWarningText(warning)` and matching icon mapping (`AlertTriangle`/amber, `XCircle`/red, `Info`/gray, `HelpCircle`/gray at 14px). Use `StyleSheet.create()` only and required styles: light amber background `#fffbeb`, amber border `#fbbf24`, `borderRadius: 10`, `padding: 12`, `marginBottom: 16`, warning text at 12px in `#92400e`.

- `client/components/__tests__/WarningCallout-test.tsx` — add all spec test cases:
  - `it('renders nothing when warnings array is empty')`
  - `it('renders one row for an avoided warning')` with text `Avoided at Trader Joes`
  - `it('renders one row for an unavailable warning')`
  - `it('renders one row for a non_preferred warning')` with `Preferred at` text
  - `it('renders one row for a non_standard_qty warning')` with qty warning text
  - `it('renders multiple rows when multiple warnings are present')`

## Patterns Applying

- Realtime Mutation Tracking: No — no new `list_items` write hooks are introduced in `api/list.ts`; behavior remains in existing mutations.
- Household Guard: No — this feature adds read/query typing and UI behavior only; no new insert mutation hooks.
- Undo Registration: No — spec explicitly states no new mutations and existing undo registrations in SmartAddItem remain unchanged.

## Ambiguities / Questions

- `useItemById` enabling: spec says hook is enabled when `itemId` is non-null and in `index.tsx` says use only when List Edit modal is open. Implementation should apply both conditions together in the screen usage (`isEditModalVisible && !!editingItem?.item_id`) while keeping hook API generic.
