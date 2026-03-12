# Implementation Plan: F13 List Display Density & Warnings

## Files to Modify

- `client/api/list.ts` —
  1. **Extend `ListItem` data shape for warnings + short names** — add `warnings?: Array<{ type: string; store_id?: string; store_name?: string; comment?: string | null; preferred_stores?: string[]; entered?: string; standard?: string[]; }>` and `master_item?: { short_name: string | null }` to the `ListItem` interface so shopping list rows can render warning badges and compact names.
  2. **Update shopping list join select exactly as specified** — change the existing `.select()` in `useShoppingList` to:
     ```typescript
     .select(`
       *,
       store:stores!store_id(name, color_code),
       category:categories!category_id(name, sort_order),
       master_item:items!item_id(short_name)
     `)
     ```
  3. **Ensure:** do not modify any `list_items` mutation functions, mutation tracking (`incrementLocalMutation` / `decrementLocalMutation`), undo registration behavior, or existing query key usage (`['shopping_list']`).

- `client/app/(tabs)/index.tsx` —
  1. **Replace fixed single-line row with two-line content in both shopping and planning branches** — convert row layout to:
     - line 1: `listItem.master_item?.short_name || listItem.name`
     - line 2: dot-joined metadata from `[listItem.quantity, listItem.category?.name, listItem.store?.name].filter(Boolean).join(' · ')`
     with text in a vertical `textContent` view (`flex: 1`).
  2. **Integrate warning badge placement and visibility** — render `<WarningBadge warnings={listItem.warnings} />` between text content and drag handle when warnings exist (`listItem.warnings?.length > 0`).
  3. **Remove category and pencil icon columns from both modes** — remove separate `colCategory` and `colEditIcon` render blocks; keep existing edit trigger semantics on text area (`onPress` in planning, `onLongPress` in shopping).
  4. **Apply style updates from spec** — change `itemRow` from `height: 48` to `minHeight: 48` + `paddingVertical: 6`; add/adjust `nameText` (`fontSize: 15`, `fontWeight: '500'`, `color: '#111827'`) and `secondaryText` (`fontSize: 12`, `color: '#6b7280'`, `marginTop: 2`). Remove `colCategory` and `colEditIcon` style definitions.
  5. **Ensure:** preserve checkbox behavior, drag/reorder interaction, existing mode toggles, purchased strikethrough behavior, and all non-row list logic.

- `client/components/Toast.tsx` —
  1. **Add warning variant API** — extend props with `variant?: 'default' | 'warning'`.
  2. **Apply warning visual and timing behavior** — for `variant === 'warning'`, use container `#fffbeb` background + `1px` border `#fbbf24`, text `#92400e`, and default duration `4000`; keep default variant current styling and `3000` fallback. Implementation:
     ```typescript
     const containerStyle = variant === 'warning' ? styles.warningContainer : styles.container;
     const textStyle = variant === 'warning' ? styles.warningText : styles.text;
     const effectiveDuration = duration ?? (variant === 'warning' ? 4000 : 3000);
     ```
  3. **Ensure:** keep current visibility lifecycle and dismiss callback behavior unchanged.

- `client/components/Settings.tsx` —
  1. **Add warning preferences defaults and local state** — use:
     ```typescript
     const DEFAULT_WARNING_PREFS: WarningPreferences = {
       avoided: 'toast_and_badge',
       unavailable: 'toast_and_badge',
       non_preferred: 'badge_only',
       non_standard_qty: 'badge_only',
     };
     ```
     initialize from profile `warning_preferences` with fallback to defaults.
  2. **Render new `Warnings` section after existing `App` section** — include rows for `Store Avoidance`, `Store Unavailable`, `Non-Preferred Store`, and `Non-Standard Qty`.
  3. **Add per-type segmented controls with exact option constraints** — `Toast + Badge | Badge | Off` for `avoided`, `unavailable`, `non_standard_qty`; `Badge | Off` only for `non_preferred`; selected segment style `backgroundColor: '#2563eb'` + white text, unselected `backgroundColor: '#f3f4f6'` + `color: '#374151'`.
  4. **Persist via existing profile save flow** — include `warning_preferences` in the current `useUpdateProfile` save payload; keep save action bundled with other settings updates.
  5. **Ensure:** do not alter unrelated settings behavior, existing save button semantics, or profile fields outside F13 scope.

- `client/app/(tabs)/items.tsx` —
  1. **Add `Short Name (optional)` input in edit/create modal** — place field between `Item Name` and `Default Quantity`:
     ```tsx
     <Text style={styles.label}>Short Name (optional)</Text>
     <TextInput
       style={styles.modalInput}
       value={shortName}
       onChangeText={setShortName}
       placeholder="e.g. PB, OJ"
     />
     ```
  2. **Add state and modal initialization rules** — add `const [shortName, setShortName] = useState('');`; on edit set from `item.short_name || ''`; on create reset to `''`.
  3. **Include short name in save payload with null-empty normalization** — send `short_name: shortName || null` in create/update payloads.
  4. **Ensure:** preserve all existing master-item validation, modal open/close behavior, and existing save/delete actions.

- `client/api/items.ts` —
  1. **Add `short_name` to `MasterItem` interface** — include nullable field: `short_name?: string | null`.
  2. **Include `short_name` in create/update mutation payload types and write payloads** — ensure inserts/updates can persist the modal field from Items tab.
  3. **Ensure:** preserve household guard, query invalidation keys (`['items']`, `['all_items']`, and existing list invalidations when applicable), and existing item-store update flows.

- `client/api/profile.ts` —
  1. **Export warning preference type** — add and export:
     ```typescript
     export interface WarningPreferences {
       avoided: 'toast_and_badge' | 'badge_only' | 'off';
       unavailable: 'toast_and_badge' | 'badge_only' | 'off';
       non_preferred: 'badge_only' | 'off';
       non_standard_qty: 'toast_and_badge' | 'badge_only' | 'off';
     }
     ```
  2. **Add `warning_preferences` to profile read data shape** — ensure profile query returns this field (included through existing `*` select).
  3. **Add `warning_preferences?: WarningPreferences` to profile update payload** — wire through `useUpdateProfile` mutation and keep profile query invalidation behavior after updates.
  4. **Ensure:** preserve all existing profile query/mutation behavior unrelated to warning preferences.

- `supabase/full_schema.sql` —
  1. **Reflect new F13 columns in table definitions** — add `short_name TEXT` to `items` CREATE TABLE, `warnings JSONB DEFAULT '[]'` to `list_items` CREATE TABLE, and `warning_preferences JSONB DEFAULT '...'` to `profiles` CREATE TABLE, so full schema matches migrations for new deployments.
  2. **Ensure:** do not alter unrelated tables, policies, constraints, or existing seed/reference data content.

- `client/components/__tests__/Settings-test.tsx` —
  1. **Add Warnings section coverage** — assert all four warning-type row labels render: "Store Avoidance", "Store Unavailable", "Non-Preferred Store", "Non-Standard Qty".
  2. **Add segmented control option coverage** — assert `Toast + Badge`, `Badge`, `Off` segments for `avoided` type.
  3. **Add constrained-option coverage for `non_preferred`** — assert only `Badge` and `Off` segments (no `Toast + Badge`).
  4. **Add profile-default selection coverage** — verify correct selected segment state when profile provides default preferences.
  5. **Ensure:** preserve existing settings tests and provider/mocking patterns.

- `client/app/(tabs)/__tests__/items-test.tsx` —
  1. **Add Short Name modal field rendering test** — verify "Short Name" label and input appear in edit modal.
  2. **Add edit-prefill test** — verify modal populates `short_name` from existing item data (`'PB'`).
  3. **Add update payload test** — verify save mutation receives `short_name` field in payload.
  4. **Ensure:** keep existing items-tab test cases and mocks intact.

## New Files

- `supabase/migrations/20250101000010_f13_display_warnings.sql` — apply exact schema changes:
  - `ALTER TABLE items ADD COLUMN IF NOT EXISTS short_name TEXT;`
  - `ALTER TABLE list_items ADD COLUMN IF NOT EXISTS warnings JSONB DEFAULT '[]';`
  - `ALTER TABLE profiles ADD COLUMN IF NOT EXISTS warning_preferences JSONB DEFAULT '{ "avoided": "toast_and_badge", "unavailable": "toast_and_badge", "non_preferred": "badge_only", "non_standard_qty": "badge_only" }';`

- `client/components/WarningBadge.tsx` — new warning icon/popup component:
  - accepts `warnings: Warning[]` where `Warning` includes `type`, `store_id?`, `store_name?`, `comment?`, `preferred_stores?`, `entered?`, `standard?`
  - renders nothing for empty/undefined warnings
  - maps warning types to exact icons/colors (`AlertTriangle #f59e0b`, `XCircle #ef4444`, `Info #6b7280`, `HelpCircle #6b7280`) at 14px
  - shows absolutely positioned popover with these exact detail string templates:
    - `avoided`: `"Avoided at {store_name} — {comment}"` (omit comment suffix if null). Use `warning.store_name || warning.store_id || 'a store'` for store name.
    - `unavailable`: `"Unavailable at {store_name}"`. Same store name fallback.
    - `non_preferred`: `"Preferred at: {preferred_stores.join(', ')}"`
    - `non_standard_qty`: `"Qty {entered} is non-standard (usual: {standard.join(', ')})"`
  - includes full-screen transparent overlay `Pressable` for outside-tap dismissal
  - uses spec popover style (`right: 0`, `top: '100%'`, white background, `borderRadius: 8`, `padding: 12`, shadow/elevation, `minWidth: 200`, `maxWidth: 280`, `zIndex: 1000`)

- `client/components/__tests__/WarningBadge-test.tsx` — cover all required warning-badge behaviors:
  - empty warnings renders nothing
  - undefined warnings renders nothing
  - `avoided` maps to `AlertTriangle`
  - `unavailable` maps to `XCircle`
  - multiple warnings render multiple icons
  - tapping badge shows popover detail text (including comment content)
  - tapping outside overlay dismisses popover
  Required mocks: icon rendering/testID strategy as needed for lucide icons and RN press interactions.

- `client/components/__tests__/Toast-test.tsx` — cover variant styling and duration defaults:
  - default dark styling without variant
  - amber warning styling with `variant="warning"`
  - warning variant defaults to `4000ms` auto-dismiss when `duration` omitted
  - default variant uses `3000ms` when `duration` omitted
  Required setup: jest fake timers for timeout assertions.

- `client/app/(tabs)/__tests__/index-display-test.tsx` — add shopping list display-density row tests:
  - line 1 name + line 2 `qty/category/store` metadata rendering
  - short-name precedence (`master_item.short_name`) over `name`
  - fallback to `name` when short name is null
  - warning badge presence when warnings non-empty
  - absence of pencil icon column
  - purchased item strikethrough on name text
  Required mocks: shopping-list data hooks, mode state, and any drag list dependencies already used in index tests.

## Patterns Applying
- Realtime Mutation Tracking: No — F13 adds no new `list_items` writes; only list query shape/interface changes in `api/list.ts`.
- Household Guard: Yes — `items` create/update remains household-scoped via existing guards; no new household-scoped insertion paths are introduced.
- Undo Registration: No — no new shopping-list user mutations are added; warning preferences save in Settings remains non-undoable per spec.
