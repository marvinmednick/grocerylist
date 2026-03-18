# Implementation Plan: F15 Freeform Qty "Other" Chip

## Files to Modify

- `client/components/SmartAddItem.tsx` —
  1. **Add popover state fields** — add:
     ```typescript
     const [otherQtyPopoverItemId, setOtherQtyPopoverItemId] = useState<string | null>(null);
     const [otherQtyInput, setOtherQtyInput] = useState('');
     ```
  2. **Append an "Other" chip after predefined qty chips** — after the existing `.map()` that renders `[item.default_qty || '1', ...(item.alternate_qtys || [])]`, append one chip whose label is `selection.qty` when `selection.qty` is not in the predefined list, otherwise `"Other"`.
  3. **Apply active/inactive styling logic for custom qty** — use `styles.pillActiveBlue` + `styles.pillTextActive` when the chip is showing a custom value; otherwise use `styles.inlinePill` + `styles.inlinePillText`.
  4. **Wire "Other" chip press behavior** — on press, set `otherQtyPopoverItemId = item.id`, set `otherQtyInput = ''`, and do not call `toggleSelection` at press time.
  5. **Render conditional popover directly below qty row in `resultMainSection`** — when `otherQtyPopoverItemId === item.id`, render:
     ```tsx
     <View style={styles.otherQtyPopover}>
       <TextInput
         style={styles.otherQtyInput}
         value={otherQtyInput}
         onChangeText={setOtherQtyInput}
         placeholder="e.g. 3 lbs"
         placeholderTextColor="#9ca3af"
         autoFocus
         returnKeyType="done"
         onSubmitEditing={() => {
           const trimmed = otherQtyInput.trim();
           if (trimmed) {
             toggleSelection(item.id, { qty: trimmed });
           }
           setOtherQtyPopoverItemId(null);
         }}
       />
     </View>
     ```
  6. **Add popover styles to `StyleSheet.create`** — add:
     ```typescript
     otherQtyPopover: {
       marginTop: 6,
       backgroundColor: '#f9fafb',
       borderRadius: 8,
       borderWidth: 1,
       borderColor: '#e5e7eb',
       paddingHorizontal: 8,
       paddingVertical: 4,
     },
     otherQtyInput: {
       fontSize: 13,
       color: '#111827',
       height: 32,
     },
     ```
  7. **Reset popover state in `clearAndClose`** — add:
     ```typescript
     setOtherQtyPopoverItemId(null);
     setOtherQtyInput('');
     ```
  8. **Ensure:** keep existing `toggleSelection` -> `getSelection` -> `onCommitAdd` flow unchanged; do not change one-off row behavior, full edit modal behavior, or any `api/` mutation/query logic.

- `client/components/__tests__/SmartAddItem-test.tsx` —
  1. **Add chip presence test** — `it('renders an "Other" chip in the qty pill row for each result item')` using the spec flow (`type 'Mi'`, wait for `Milk`, assert `screen.getByText('Other')`).
  2. **Add popover open test** — `it('opens the freeform qty input when "Other" chip is tapped')` asserting `TextInput` placeholder `"e.g. 3 lbs"` appears after tapping `Other`.
  3. **Add submit-and-add custom qty test** — `it('confirms freeform qty via Return and adds with that qty')` using `fireEvent(input, 'submitEditing')` or `fireEvent.submitEditing(input)`, then quick-add via `Milk`, and assert `addItem` called with `quantity: '3 lbs'`.
  4. **Add custom label replacement test** — `it('shows the typed custom value as the active "Other" chip label after confirm')` asserting `screen.getByText('1 qt')` and `screen.queryByText('Other')` is `null`.
  5. **Add empty submit no-op test** — `it('does nothing when Return is pressed on empty "Other" input')` asserting quick-add still uses default quantity `'1 gal'`.
  6. **Add revert-to-Other test after predefined selection** — `it('resets "Other" chip label when a predefined chip is selected after custom qty')` asserting label reverts to `Other` and custom label is gone.
  7. **Fixture handling for alternates** — keep existing `baseItem` for these tests (`alternate_qtys: []` is acceptable); if any future test needs alternates, use a dedicated fixture like `{ ...baseItem, alternate_qtys: ['½ gal'] }`.
  8. **Ensure:** preserve existing SmartAddItem test setup, mocks, and unrelated test cases.

## New Files

- None.

## Patterns Applying
- Realtime Mutation Tracking: No — this feature adds only UI state/selection behavior in `SmartAddItem`; no new mutation path is introduced.
- Household Guard: No — no new household-scoped insert mutation is added.
- Undo Registration: No — no new shopping-list mutation is added; existing add flow already handles undo.

## Ambiguities / Questions
- None.
