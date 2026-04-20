# Implementation Plan: F78 Duplicate Entry Handling

## Files to Modify

- `client/api/list.ts` —
  1. **Add `useAddQuantityEntry` mutation hook for existing parents** — implement the `list_item_quantities` insert shape exactly as spec-defined:
     `.from('list_item_quantities').insert({ list_item_id: listItemId, quantity, quantity_parsed: quantityParsed, added_by: addedBy, household_id: householdId }).select().single()`; include `if (!householdId) throw new Error('No household ID found')` before insert.
  2. **Apply required mutation patterns to the new hook** — wrap the mutation body with `incrementLocalMutation()`/`decrementLocalMutation()` (in `try/finally`) and invalidate `['shopping_list']` on success/settled per existing list mutation patterns.
  3. **Confirm exported types** — keep `ListItem` and `QuantityEntry` exported (already present) and only adjust exports if needed for the new dialog/detection imports.
  4. **Ensure:** Do not change `useAddToList` behavior, query shapes, undo context behavior, or introduce new query keys.

- `client/lib/quantityFormat.ts` —
  1. **Add combine result types** — define `CombineOption` (`type: 'sum' | 'multipack'`, `result: QuantityParsed`, `label`) and `CombineOptions` (`options: CombineOption[]`) matching spec contract.
  2. **Implement `combineQuantities(existing, incoming)` using spec algorithm order** —
     - one/both empty -> single sum option with non-empty value,
     - pure counts -> summed `count`,
     - same `sizeUnit` with no `packageType` -> sum; include multipack only when `sizeQty` equal,
     - same `packageType` -> sum counts (`null` treated as `1`); multipack only when `sizeQty` + `sizeUnit` + `count` identical,
     - incompatible or convertible-but-different units (e.g. `lb`/`oz`) -> `null`.
  3. **Implement `formatCombineOption(option)`** — sum uses existing `formatQuantity(option.result)`; multipack formats as `"{count} × {sizeQty} {sizeUnit}"` for dialog button text.
  4. **Ensure:** Keep existing parse/format helpers unchanged for non-F78 behavior.

- `client/components/SmartAddItem.tsx` —
  1. **Extend props and derived list state** — add `listItems: ListItem[]` to `SmartAddItemProps`; build memoized `onListItemIds` set from `listItems` and `isOnList(itemId)` helper for matched master items.
  2. **Add passive "on list" dropdown indicator** — in `resultTitleRow`, render muted `on list` text after name/orphan tokens when `isOnList(interpretation.matchedItemId)` is true; skip one-off indicator path.
  3. **Add duplicate flow state** — add `duplicateMatch`, `pendingAdd`, and saved-query state/ref used to preserve and restore current search text.
  4. **Wrap all five add entry points with duplicate detection** — before executing each add path (`onCommitAdd`, `onOneOffAdd`, `onAcceptTop`, `onSaveEdited`, `onOneOffEditAdd`), call `findDuplicate(itemId, name, listItems)`; when matched, capture pending add payload (including `forwardAction`) and show dialog instead of mutating.
  5. **Implement dialog action handlers in SmartAddItem** — wire handlers for same-store combine, cross-store combine-at-target-store (store move + quantity update), same-store add-new (`useAddQuantityEntry`), cross-store add-new (`useAddToList`), custom quantity update (`parseQuantityText` + `normalizeQuantityText`), and dismiss/cancel restore behavior.
  6. **Register undo per spec matrix** — use labels and inverse/redo operations exactly from spec (`Combined {name}`, `Updated {name}`, `Added {name} ({qty})`, `Added {name}`); apply mutable tracker pattern for add-new redo IDs.
  7. **Render and wire `DuplicateResolutionDialog`** — pass match/incoming data, computed combine options, duplicate state, and callbacks; on successful actions call `clearAndClose()`, on dismiss restore saved query.
  8. **Ensure:** Preserve existing non-duplicate add flows when no match is found, maintain quick-accept and edit-before-add behavior, and do not alter unrelated ranking/parser behavior.

- `client/app/(tabs)/index.tsx` —
  1. **Pass active list data into SmartAddItem** — provide `listItems` from `useShoppingList` to `SmartAddItem` so passive indicator and add-time detection use existing cache data.
  2. **Ensure:** Keep current screen data flow, undo wiring, and list rendering unchanged.

- `client/components/__tests__/SmartAddItem-test.tsx` —
  1. **Add passive indicator tests** — cover "on list" visible when `matchedItemId` exists in `listItems` and absent otherwise.
  2. **Add duplicate interception test** — when a duplicate exists, assert resolution dialog appears and direct add mutation is not called.
  3. **Add undo pattern tests for dialog outcomes** — verify `pushAction` registration for Combine and Add New labels after action callbacks.
  4. **Ensure:** Keep existing SmartAddItem test scenarios passing without changing non-F78 assertions.

## New Files

- `client/lib/duplicateDetection.ts` — add pure `findDuplicate` (master by `item_id`; one-off by case-insensitive trimmed name), `classifyDuplicateState` (`active-same-store`, `active-different-store`, `purchased-same-trip`, `purchased-other-user`), and related exported types (`DuplicateMatch`, `DuplicateState`, `CombineOptions` linkage).
- `client/components/DuplicateResolutionDialog.tsx` — add bottom-anchored (`justifyContent: 'flex-end'`) transparent modal with title/close, summary line, conditional combine section, inline custom mode, always-present bottom action row, cross-store per-line combine layout, and uniform gray button styling with text-only cancel.
- `client/lib/__tests__/duplicateDetection-test.ts` — implement spec-listed unit cases: item_id match/null, one-off case+trim behavior, one-off vs master non-match, purchased active detection, archived exclusion, and duplicate-state classification scenarios.
- `client/lib/__tests__/combineQuantities-test.ts` — implement spec-listed quantity combine cases: pure counts, same-unit sum, same-size multipack option, same-unit different-size sum-only, package sum, incompatible null, convertible-but-different null, one-empty fallback, and `formatCombineOption` sum/multipack rendering.
- `client/components/__tests__/DuplicateResolutionDialog-test.tsx` — implement spec-listed dialog component cases: summary rendering, combine visibility rules by state, cross-store button labels, bottom-row actions, custom mode transitions, dismiss behavior, and callback invocation assertions for combine/add-new/custom/cancel.

## Patterns Applying
- Realtime Mutation Tracking: Yes — new `useAddQuantityEntry` writes `list_item_quantities`, so it must use `incrementLocalMutation`/`decrementLocalMutation`.
- Household Guard: Yes — `useAddQuantityEntry` inserts into household-scoped `list_item_quantities` and must throw when `householdId` is null.
- Undo Registration: Yes — all duplicate dialog mutation outcomes initiated from shopping list add flow must call `pushAction` with spec-defined labels/inverse behavior.

## Ambiguities / Questions
- `purchased-other-user` classification requires identifying whether the purchased match belongs to another user, but the state inputs listed for `classifyDuplicateState(match, incomingStoreId)` do not explicitly include current user id; implementation will use available `ListItem/QuantityEntry` purchaser fields and existing current-user context in SmartAddItem for final dialog copy/action routing.
