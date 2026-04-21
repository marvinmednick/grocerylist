# Implementation Plan: F108 Add New as Inline Duplicate Option
<!-- Approved plan — corrects "in" → "at" for cross-store combine labels throughout -->

## Files to Modify

- `client/components/DuplicateResolutionDialog.tsx` —
  1. **Replace visibility flags for the non-custom options area** — remove `showCombine` and define:
     `const showOptions = !customMode;`
     `const showCombineOptions = !!combineOptions && combineOptions.length > 0 && duplicateState.startsWith('active-');`
     so the options list is always shown outside custom mode, while combine buttons remain limited to active duplicate states.
  2. **Compute the inline add-separate label in-component** — add `addSeparateLabel` (pure `useMemo` or inline) using the spec's exact cases:
     `duplicateState` starting with `purchased-` => `"Add a separate [qty] item"` or `"Add a separate item"` when `incomingQuantity` is empty;
     `active-different-store` with `incomingStoreName` => `"Add a separate [qty] at [incomingStoreName]"` or `"Add a separate item at [incomingStoreName]"`;
     all other cases => `"Add a separate [qty] item"` or `"Add a separate item"`.
     `[qty]` must be ` ${incomingQuantity}` only when `incomingQuantity` is non-empty.
  3. **Restructure the normal-mode options list** — when `showOptions`, render one `<View style={styles.optionsList}>` that contains:
     full-width same-store combine buttons labeled `"Combine as ${option.label}"` calling `onCombine(option)`;
     cross-store combine buttons for each option labeled `"Combine as ${option.label} at ${existingStoreName}"` and `"Combine as ${option.label} at ${incomingStoreName ?? 'target store'}"` with `onCombine(option, match?.store_id ?? null)` and `onCombine(option, incomingStoreId)` respectively (second button only when `incomingStoreId` is present);
     and one always-present full-width `<TouchableOpacity testID="duplicate-add-separate">` that renders `addSeparateLabel` and calls `onAddNew`.
  4. **Simplify the bottom action row** — remove the existing `duplicate-add-new` button and leave only:
     `duplicate-custom` as an `actionButton` that sets `customMode` true, and
     `duplicate-cancel` that calls `handleDismiss`.
  5. **Remove the combine section heading** — delete the `"Combine as:"` label JSX and its `sectionLabel` style usage.
  6. **Update styles only where the spec requires** — add `optionsList: { gap: 8, marginBottom: 16 }`; remove `combineRow`, `crossStoreActions`, `crossStoreRow`, and `sectionLabel`; keep `actionButton`, `section`, `bottomRow`, modal structure, safe-area padding, summary text, and custom-mode controls unchanged.
  7. **Ensure:** keep `summaryText` behavior, `handleDismiss` reset behavior, `handleCustomConfirm` trimming/confirm flow, modal/backdrop/ScrollView safe-area behavior, and all callback signatures unchanged. Do not change `SmartAddItem.tsx`, duplicate detection logic, `CombineOption` shape, or the custom-mode flow beyond hiding the normal options list while custom mode is active.

- `client/components/__tests__/DuplicateResolutionDialog-test.tsx` —
  1. **Refresh stale assertions for the renamed/repositioned actions** — update the existing tests to assert:
     `"Combine as 3 lb"` is present for active same-store and `"Combine as:"` is absent;
     cross-store renders `"Combine as 3 lb at Safeway"` and `"Combine as 3 lb at Costco"` (preposition is "at", not "in");
     the bottom row contains `Custom` and `Cancel` but not `Add New`;
     the Add New callback test uses `duplicate-add-separate`;
     and returning from custom mode shows `"Combine as 3 lb"` (updated label).
  2. **Add coverage for the new add-separate labels by duplicate state** — add distinct tests for:
     `"Add a separate 1.5 lb item"` in `active-same-store`;
     `"Add a separate 1.5 lb at Costco"` in `active-different-store` with `incomingStoreName="Costco"`;
     `"Add a separate item"` when `incomingQuantity=""`;
     `"Add a separate 1.5 lb item"` for `purchased-same-trip` without any `at Costco` text;
     and `"Add a separate 1.5 lb item"` for `purchased-other-user`.
  3. **Add coverage for structural changes** — add tests that `"Combine as:"` never renders, tapping `duplicate-add-separate` calls `onAddNew`, and purchased states render no combine buttons (`queryByText(/Combine as/)` is null).
  4. **Preserve combine callback coverage** — keep the combine-tap tests verifying `onCombine` receives the same `CombineOption` and store ID behavior as before, but update the queried button text to `"Combine as 3 lb"` (same-store) or `"Combine as 3 lb at Safeway"` (cross-store).
  5. **Ensure:** keep the existing render helper, fixture factories, safe-area mock, and non-spec tests (summary text, close button, custom confirm, cancel dismiss) intact except where label/text assertions must change for this UI update.

## New Files

- None.

## Patterns Applying
- Realtime Mutation Tracking: No — this is a UI-only dialog change and does not modify `api/list.ts` mutations.
- Household Guard: No — no inserts or other household-scoped mutations are added or changed.
- Undo Registration: No — `onAddNew`, `onCombine`, and `onCustom` stay owned by the parent flow; this dialog only changes presentation.
