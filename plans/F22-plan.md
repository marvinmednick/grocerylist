# Implementation Plan: F22 WarningBadge Modal Fix

## Files to Modify

- `client/components/WarningBadge.tsx` —
  1. **Replace Inline Popover With Modal** — keep `isOpen` / `setIsOpen` state and the existing badge trigger behavior, then remove the inline popover subtree (`<View style={styles.popover}>...</View>`) and replace it with a `Modal` rendered immediately after the trigger `</TouchableOpacity>`, using `visible={isOpen}`, `animationType="fade"`, `transparent={true}`, and `onRequestClose={() => setIsOpen(false)}`.
  2. **Update Modal Content Structure** — inside the modal, render a full-screen press target backdrop that closes on press, a centered card with a header (`Warnings` title + close `X` button with `testID="warning-modal-close"`), and warning rows mapped from `warningDetails` using the exact icon branching by `detail.warning.type` (`avoided` -> `AlertTriangle`, `unavailable` -> `XCircle`, `non_preferred` -> `Info`, else `HelpCircle`) and `key={`${detail.warning.type}-${index}`}`.
  3. **Adjust Imports and Styles** — add `Modal` to the React Native imports; remove the old inline-popover style objects (`overlay`, `popover`) and add modal styles with the spec-defined values: `modalBackdrop`, `modalCard`, `modalCardHeader`, `modalCardTitle`, `modalRow`, `modalRowText`; add `X` to the lucide import line.
  4. **Ensure:** keep badge trigger icon/count rendering logic unchanged; do not modify `WarningCallout.tsx`; do not modify `api/items.ts` `getWarningText` behavior.

- `client/components/__tests__/WarningBadge-test.tsx` —
  1. **Update Open/Close Tests For Modal UI** — replace inline popover assertions with modal-based assertions: tap `testID="warning-badge-trigger"` and assert modal content appears (`testID="warning-modal-close"` and warning text), then assert close behavior via backdrop close path and via `X` close button.
  2. **Remove Inline Popover-Specific Expectations** — delete/replace tests that depend on the old inline popover structure and old overlay behavior.
  3. **Preserve Existing Type-Migration Smoke Coverage** — keep the existing smoke test validating `Warning` type migration from `api/items`.
  4. **Ensure:** keep tests focused on externally visible behavior (open, content shown, close) and avoid asserting removed internal structure.

## New Files

- None.

## Patterns Applying
- Realtime Mutation Tracking: No — this feature only changes component display and component tests.
- Household Guard: No — no insert mutation is introduced or modified.
- Undo Registration: No — no shopping-list user mutation flow is added or changed.

## Ambiguities / Questions
- The spec’s sample modal JSX does not include a backdrop `testID`, while the test guidance references pressing `warning-popover-overlay` "if present" and also says to remove tests referencing that inline popover identifier. Plan assumption: use a modal-close path that is deterministic in tests (preferably a dedicated modal backdrop test ID) while fully removing dependence on the old inline popover structure.
- The spec notes `SmartAddItem.tsx` and `app/(tabs)/index.tsx` `maxHeight` fixes were already directly patched and should be verified then skipped if present. Plan assumption: perform verification-only check during implementation; no edits unless the fix is unexpectedly missing.
