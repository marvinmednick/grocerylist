# Implementation Plan: F22 WarningBadge Modal Fix (Approved)

## Files to Modify

- `client/components/WarningBadge.tsx` —
  1. **Replace Inline Popover With Modal** — keep `isOpen` / `setIsOpen` state and the existing badge trigger behavior, then remove the inline popover subtree (`<View style={styles.popover}>...</View>`) and the old backdrop (`<Pressable style={styles.overlay} ...>`) and replace with a `Modal` rendered immediately after the trigger `</TouchableOpacity>`, using `visible={isOpen}`, `animationType="fade"`, `transparent={true}`, and `onRequestClose={() => setIsOpen(false)}`.
  2. **Update Modal Content Structure** — inside the modal, render a full-screen press target backdrop (`testID="warning-modal-backdrop"`) that closes on press, a centered card with a header (`Warnings` title + close `X` button with `testID="warning-modal-close"`), and warning rows mapped from `warningDetails` using the exact icon branching by `detail.warning.type` (`avoided` -> `AlertTriangle`, `unavailable` -> `XCircle`, `non_preferred` -> `Info`, else `HelpCircle`) and `key={`${detail.warning.type}-${index}`}`.
  3. **Adjust Imports and Styles** — add `Modal` to the React Native imports; **keep `Pressable`** (it is used in the modal backdrop — the spec's import note to remove it is incorrect); add `X` to the lucide import line; remove the old inline-popover style objects (`overlay`, `popover`) and add modal styles with the spec-defined values:
     - `modalBackdrop`: `{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center', padding: 32 }`
     - `modalCard`: `{ backgroundColor: '#ffffff', borderRadius: 12, padding: 16, width: '100%', maxWidth: 320 }`
     - `modalCardHeader`: `{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }`
     - `modalCardTitle`: `{ fontSize: 14, fontWeight: '600', color: '#111827' }`
     - `modalRow`: `{ flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 8 }`
     - `modalRowText`: `{ flex: 1, fontSize: 13, color: '#374151', lineHeight: 18 }`
  4. **Do not change:** badge trigger icon/count rendering logic; `WarningCallout.tsx`; `api/items.ts` `getWarningText`.

- `client/components/__tests__/WarningBadge-test.tsx` —
  1. **Update open test** — replace "shows popover with detail text on badge tap": press `testID="warning-badge-trigger"`; assert `testID="warning-modal-close"` is present and warning text is visible.
  2. **Update backdrop-close test** — replace "dismisses popover on outside tap": open modal; press `testID="warning-modal-backdrop"`; assert warning text is no longer visible.
  3. **Add new X-button close test** — "closes warning modal when X button is pressed": open modal; press `testID="warning-modal-close"`; assert warning text is gone.
  4. **Remove** the old `warning-popover-overlay` test (uses removed testID).
  5. **Preserve** all existing smoke/icon tests unchanged (empty/undefined render, icon testID tests, type-migration smoke test).

## New Files

- None.

## Files to Skip

- `client/components/SmartAddItem.tsx` — `maxHeight: '85%'` fix already applied; no changes needed.
- `client/app/(tabs)/index.tsx` — `maxHeight: '85%'` fix already applied; no changes needed.

## Patterns Applying
- Realtime Mutation Tracking: No — this feature only changes component display and component tests.
- Household Guard: No — no insert mutation is introduced or modified.
- Undo Registration: No — no shopping-list user mutation flow is added or changed.
