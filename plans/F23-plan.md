# Implementation Plan: F23 Store Dropdown in Edit Modals

## Files to Modify

- `client/components/SmartAddItem.tsx` —
  1. **Add dropdown state and imports** — add `ChevronDown` to `lucide-react-native` imports, add `useSafeAreaInsets` import from `react-native-safe-area-context`, add `const insets = useSafeAreaInsets()`, and add `const [editStoreDropdownOpen, setEditStoreDropdownOpen] = useState(false);` for modal-local dropdown visibility.
  2. **Reset dropdown on modal open** — in `onEditAdd()`, keep existing `setEditStoreId(...)` behavior and add `setEditStoreDropdownOpen(false)` in the same open-path so the dropdown is closed each time the modal opens.
  3. **Replace store pill UI with in-document dropdown UI** — replace the existing store block (`Store` label + `tagsContainer` pills) with the spec structure: `edit-store-dropdown-trigger` trigger row, selected store color dot + name when `editStoreId` is set, `No store` placeholder when empty, and conditional dropdown menu with `edit-store-option-none` first plus mapped `edit-store-${store.id}` options; close dropdown after selecting any option.
  4. **Apply modal safe-area requirements** — apply `paddingTop: insets.top` on the outermost modal content container and `paddingBottom: insets.bottom` on the bottom action-row container in the Add Detail modal.
  5. **Add Cancel action in master-item Add Detail path** — add a gray compact `Cancel` button in the same action row, positioned left of existing Add/Save, right-justified with the row; on press, run the same close + reset behavior as the modal X button.
  6. **Add dropdown styles exactly as specified** — add `dropdownTrigger`, `dropdownValue`, `dropdownPlaceholder`, `dropdownMenu`, `dropdownOption`, `storeColorDot`, `storeNameText` using the exact values from the spec.
  7. **Ensure:** keep existing add/save submit behavior unchanged (store value passed through exactly as before); keep quantity chip/tag styling and behavior intact (`tagsContainer`, `tag`, `tagActive`, `tagInactive`, `tagTextActive`, `tagTextInactive` remain and are not removed).

- `client/app/(tabs)/index.tsx` —
  1. **Add dropdown state and imports** — add `ChevronDown` to icon imports, add `useSafeAreaInsets` import and `const insets = useSafeAreaInsets()`, and add `const [editStoreDropdownOpen, setEditStoreDropdownOpen] = useState(false);`.
  2. **Reset dropdown when opening edit modal** — in `openEditModal()`, keep `setEditStoreId(item.store_id || '')` and add `setEditStoreDropdownOpen(false)` in the same modal-open sequence.
  3. **Replace store pills with dropdown UI in Edit Item modal** — replace current store pills section with the spec dropdown structure and behavior: trigger (`edit-store-dropdown-trigger`), `No store` placeholder, open/close toggle on trigger, menu with top `edit-store-option-none`, and mapped `edit-store-${store.id}` options that set store and close menu.
  4. **Apply modal safe-area requirements** — apply `paddingTop: insets.top` to the modal outer content container and `paddingBottom: insets.bottom` on the edit modal action row container.
  5. **Add dropdown styles exactly as specified** — add `dropdownTrigger`, `dropdownValue`, `dropdownPlaceholder`, `dropdownMenu`, `dropdownOption`, `storeColorDot`, `storeNameText` with the exact spec values.
  6. **Ensure:** keep existing edit-save flow and undo behavior untouched; keep quantity chip/tag styles and behavior unchanged.

- `client/components/__tests__/SmartAddItem-test.tsx` —
  1. **Add dropdown-render test** — verify Add Detail modal renders `edit-store-dropdown-trigger` instead of store pills UI.
  2. **Add dropdown-open test** — tap trigger and assert `edit-store-option-none` plus all `edit-store-${id}` options are visible.
  3. **Add store-select test** — select a store option, assert options close, and trigger text updates to selected store name.
  4. **Add clear-store test** — with preselected store, select `edit-store-option-none`, assert dropdown closes and trigger shows `No store`.
  5. **Add toggle-close test** — tap trigger to open, tap trigger again, assert `edit-store-option-none` is absent.
  6. **Add Cancel-button presence test** — in master-item Add Detail modal path, assert `Cancel` button is present in action row.
  7. **Add Cancel reset behavior test** — change store selection, press `Cancel`, assert modal closes; reopen and assert selection reset to original value.
  8. **Ensure:** do not replace existing tests; preserve current wrappers/mocks and extend only with F23 scenarios.

- `client/app/(tabs)/__tests__/index-interactions-test.tsx` —
  1. **Add dropdown-trigger render test** — open Edit Item modal and assert `edit-store-dropdown-trigger` exists.
  2. **Add dropdown-open options test** — tap trigger and assert `edit-store-option-none` and all store options render.
  3. **Add store-select close test** — select a store option and assert menu closes and trigger text updates.
  4. **Add clear-store test** — from pre-set store state, choose `edit-store-option-none` and assert trigger shows `No store`.
  5. **Ensure:** keep existing interaction tests intact and only append F23 cases.

## New Files

None.

## Patterns Applying
- Realtime Mutation Tracking: No — no new `list_items` mutations are introduced; this feature only changes modal UI controls and local state.
- Household Guard: No — no new inserts or household-scoped writes are added.
- Undo Registration: No — no new user-initiated list mutation path is added; existing add/save flows already own undo behavior.

## Ambiguities / Questions
- None.
