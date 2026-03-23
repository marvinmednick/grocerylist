# Implementation Plan: F20 Test Quality Sweep

## Files to Modify

- `client/app/(tabs)/__tests__/index-interactions-test.tsx` —
  1. **Expand `mockUseHousehold` return shape in `beforeEach`** — update the existing `mockUseHousehold.mockReturnValue(...)` to include `displayName: 'Alice'`, `displayNameShort: 'Al'`, and `avatarColor: '#2563eb'` alongside `householdId: 'h1'` and `isLoading: false`.
  2. **Ensure:** no other test logic, assertions, wrappers, or mocked hook behavior in this file is changed.

- `client/components/Settings.tsx` —
  1. **Remove `renderInline` from props interface** — delete `renderInline?: boolean` from `SettingsProps`.
  2. **Remove `renderInline` from function props destructuring** — delete `renderInline = false` and keep the remaining props unchanged.
  3. **Simplify visibility guard** — replace `if (!visible && !renderInline)` with `if (!visible) return null;`.
  4. **Delete inline-render branch** — remove the `if (renderInline)` conditional return so the component no longer bypasses `<Modal>`.
  5. **Preserve modal rendering path** — keep the `<Modal visible={visible} ...>` wrapper as the only visible render path when `visible` is true.
  6. **Ensure:** all Settings modal content, handlers, safe-area/scroll behavior, and existing callbacks remain unchanged apart from removing the inline escape hatch.

- `client/components/__tests__/Settings-test.tsx` —
  1. **Remove `renderInline={true}` from every Settings render call** — update each `render(<Settings ... renderInline={true} />...)` to `render(<Settings visible={true} onClose={...} />...)` with no `renderInline` prop.
  2. **Ensure:** all existing test cases, assertions, mock setup, and test structure remain unchanged aside from prop removal.

- `client/app/(tabs)/__tests__/index-f2-test.tsx` —
  1. **Add global End All multi-purchaser interaction test** — append a test at the end of `describe('ShoppingListScreen F2 behaviors', ...)` that:
     - Mocks `mockUseShoppingList.mockReturnValue({ data: [buildItem({ id: 'item-1', purchased_by: 'user-1' }), buildItem({ id: 'item-2', purchased_by: 'user-2', name: 'Bread' })], isLoading: false })`
     - Spies on `Alert.alert` with `jest.spyOn(Alert, 'alert').mockImplementation(() => {})`
     - Renders `ShoppingListScreen`, presses `'End All Shopping Trips'`, asserts `alertSpy` was not called, and asserts `screen.getByTestId('multi-trip-modal')` exists
     - Restores the spy with `alertSpy.mockRestore()`
  2. **Ensure:** existing F2 tests and existing button/modal behavior assertions remain untouched.

- `client/api/__tests__/items-test.ts` —
  1. **Add household guard test for `useUpdateMasterItem`** — after the existing delete-failure test in `describe('items mutations', ...)`, add a test that sets `mockUseHousehold.mockReturnValue({ householdId: null })`, runs `mutation.mutateAsync({ id: 'item-1', name: 'Milk' })`, expects `rejects.toThrow('No household ID found')`, and verifies `mockFrom` was not called.
  2. **Add `items.update()` failure propagation test** — add a test that mocks the `items` chain as `update -> eq -> select -> single` returning `{ data: null, error: { message: 'update failed' } }`, expects `rejects.toMatchObject({ message: 'update failed' })`, and verifies `mockInvalidateQueries` was not called.
  3. **Add `item_store_preferences.insert()` failure propagation test** — add a test that:
     - Mocks `items.update(...).eq(...).select(...).single()` success returning `{ data: { id: 'item-1' }, error: null }`
     - Mocks `item_store_preferences.delete(...).eq(...)` success returning `{ error: null }`
     - Mocks `item_store_preferences.insert(...)` failure returning `{ error: { message: 'insert failed' } }`
     - Calls `mutation.mutateAsync({ id: 'item-1', name: 'Milk', store_preferences: [{ store_id: 'store-1', status: 'preferred', comment: null }] })`
     - Expects `rejects.toMatchObject({ message: 'insert failed' })` and `mockInvalidateQueries` not called
  4. **Ensure:** production API code in `client/api/items.ts` is not modified; only test coverage is added.

## New Files

- None.

## Patterns Applying
- Realtime Mutation Tracking: No — this feature does not add or change `api/list.ts` `list_items` mutations.
- Household Guard: Yes — tests explicitly verify existing `useUpdateMasterItem` guard behavior when `householdId` is null.
- Undo Registration: No — no shopping-list user mutation flow is being added/changed.

## Ambiguities / Questions
- None.
