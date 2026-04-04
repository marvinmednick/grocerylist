# Implementation Plan: F79 Quantity Units System (Approved)

## Files to Modify

- `supabase/full_schema.sql` —
  1. **Remove old units schema block** — delete the legacy `-- 6. UNITS` table definition and its old public-read RLS policy section.
  2. **Update existing tables to match migration** — remove `default_unit_id UUID REFERENCES units(id) ON DELETE SET NULL` from `items` and remove `unit_id UUID REFERENCES units(id) ON DELETE SET NULL` from `list_items`.
  3. **Add quantity JSONB columns** — add `quantity_parsed JSONB NULL` to `list_items`; add `default_qty_parsed JSONB NULL` and `alternate_qtys_parsed JSONB[] NULL` to `items`.
  4. **Add new household-scoped vocabulary tables + policies** — add full schema blocks for `units`, `packages`, and `size_descriptors` with `household_id` FK to `households(id) ON DELETE CASCADE`, `canonical`, `aliases TEXT[] NOT NULL DEFAULT '{}'`, indexes on `household_id`, RLS enabled, and `FOR ALL TO authenticated` policies using `household_id = get_my_household_id()` in both `USING` and `WITH CHECK`.
  5. **Ensure:** no unrelated table definitions, policies, or ordering outside F79 schema requirements are modified.

- `client/components/SmartAddItem.tsx` —
  1. **Switch parser vocabulary source to API hook with fallback** — add `useVocabulary` import and hook usage: `const { data: vocabulary } = useVocabulary();`, derive `const vocab = vocabulary ?? DEFAULT_VOCABULARY;` outside (and before) the `parseResult` and `parseCandidate` memos.
  2. **Update parse memos to use household vocabulary** — change `parseResult` to `parseInput(query, vocab, masterItemNames)` with deps `[query, vocab, masterItemNames]`; change `parseCandidate` to `assembleCandidate(groupTokens(classifyTokens(tokenize(query), vocab)))` with deps `[query, vocab]`.
  3. **Ensure:** keep `DEFAULT_VOCABULARY` import for loading fallback, preserve parser flow/UI behavior, and do not change parser implementation files.

- `client/components/UserAvatar.tsx` —
  1. **Rename settings menu label** — replace menu text `Settings` with `General` while keeping the same trigger behavior for opening existing settings modal state.
  2. **Add Sizes & Packages menu action** — add new menu row labeled `Sizes & Packages` **positioned between the "General" row and the "Sign Out" row**; tapping closes menu and sets `sizesAndPackagesVisible` true. Add `const [sizesAndPackagesVisible, setSizesAndPackagesVisible] = useState(false);` alongside existing state.
  3. **Mount new modal component** — import `SizesAndPackages` and conditionally render it after existing `Settings` conditional with `visible={sizesAndPackagesVisible}` and `onClose={() => setSizesAndPackagesVisible(false)}`.
  4. **Ensure:** existing avatar/menu open-close behavior, logout flow, and settings modal toggling remain unchanged.

- `client/components/Settings.tsx` —
  1. **Rename internal modal title** — update the displayed title text from `Settings` to `General` only.
  2. **Ensure:** modal safe-area/scroll behavior and all existing settings controls remain unchanged.

- `client/app/auth.tsx` —
  1. **Add vocabulary seeding helper using defaults** — add `DEFAULT_VOCABULARY` import from `../lib/vocabulary` and add helper `async function seedVocabularyForHousehold(householdId: string): Promise<void>` that inserts mapped rows into `units`, `packages`, and `size_descriptors`. Use the existing **module-level `supabase` import** — do not use dynamic `await import(...)`.
  2. **Seed after new profile creation in multi-household branch** — in `ensureProfile`, after the profile insert in the `if (hh)` block for the newly created household, call `await seedVocabularyForHousehold(hh.id);`.
  3. **Ensure:** single-household flow remains unchanged and existing auth/profile creation order stays intact apart from adding the post-profile seed call in the multi-household create path.

- `client/components/__tests__/UserAvatar-test.tsx` —
  1. **Extend avatar menu assertions** — add tests to verify `General` appears and `Settings` does not, and `Sizes & Packages` appears.
  2. **Add navigation behavior coverage** — add tests that pressing `Sizes & Packages` renders `SizesAndPackages` (mocked) and pressing `General` opens Settings.
  3. **Ensure:** existing passing test cases are retained; only additive coverage changes.

- `client/components/__tests__/SmartAddItem-parser-test.tsx` —
  1. **Add hook-driven vocabulary parsing test** — mock `useVocabulary` with custom package token (e.g., `punnet`) and assert parsing reflects `packageType: 'punnet'` for input like `2 punnets strawberries`.
  2. **Add fallback parsing test** — mock `useVocabulary` returning `undefined`; assert standard fallback vocabulary still parses (e.g., `2 cans` → `packageType: 'can'`).
  3. **Ensure:** parser tests remain focused on observable parse outcomes without changing parser internals.

## New Files

- `supabase/migrations/20250101000014_f79_quantity_units_system.sql` — apply the exact F79 migration steps in order:
  1. `DROP POLICY IF EXISTS "Public read units" ON units;`
  2. `ALTER TABLE items DROP COLUMN IF EXISTS default_unit_id;`
  3. `ALTER TABLE list_items DROP COLUMN IF EXISTS unit_id;`
  4. `DROP TABLE IF EXISTS units;`
  5. Create new household-scoped `units`, `packages`, `size_descriptors` tables with `canonical`, `aliases TEXT[] NOT NULL DEFAULT '{}'`, indexes on `household_id`, RLS enabled.
  6. Create `"Household members can manage ..."` `FOR ALL TO authenticated` policies for all three tables.
  7. Add `list_items.quantity_parsed JSONB NULL`, `items.default_qty_parsed JSONB NULL`, `items.alternate_qtys_parsed JSONB[] NULL`.
  8. Seed all existing households via `DO $$ ... FOR hh_id IN SELECT id FROM households LOOP ...` with the complete `DEFAULT_VOCABULARY` seed values and `ON CONFLICT (household_id, canonical) DO NOTHING`.

- `client/api/vocabulary.ts` — new API module exporting `VocabularyType`, `VocabRow`, `VocabularyData`, and hooks:
  1. `useVocabulary` query with key `['vocabulary', householdId]`, `enabled: !!householdId`, `staleTime: 1000 * 60 * 5`, and three parallel selects:
     ```
     supabase.from('units').select('id, canonical, aliases').eq('household_id', householdId).order('canonical')
     supabase.from('packages').select('id, canonical, aliases').eq('household_id', householdId).order('canonical')
     supabase.from('size_descriptors').select('id, canonical, aliases').eq('household_id', householdId).order('canonical')
     ```
     returning `{ units, packages, sizeDescriptors }`.
  2. CRUD mutations: create/update/delete with household guard `if (!householdId) throw new Error('No household ID found')`, insert payload includes `household_id`, update/delete include `.eq('household_id', householdId)`.
  3. Reset mutation: delete all rows for `type + household`, then insert mapped `DEFAULT_VOCABULARY` seed entries (`sizeDescriptors` key maps to `size_descriptors` table type).
  4. All mutation `onSuccess` handlers call `queryClient.invalidateQueries({ queryKey: ['vocabulary'] })`.

- `client/components/SizesAndPackages.tsx` — full-screen modal drill-down:
  1. Props: `{ visible: boolean; onClose: () => void }`.
  2. Internal state: `activeScreen: VocabularyType | null`; reset to `null` via `useEffect` whenever `visible` becomes `false`.
  3. Menu screen (when `activeScreen === null`): header title `Sizes & Packages`, close button (`testID="sizes-packages-close"`), and three nav rows with test IDs `vocab-nav-units`, `vocab-nav-packages`, `vocab-nav-sizes` that set `activeScreen` to `'units'`, `'packages'`, `'size_descriptors'` respectively.
  4. Management screen rendering: when `activeScreen` is set, render `<VocabularyManagement type={activeScreen} onBack={() => setActiveScreen(null)} onClose={onClose} />` inside the same modal (not a new modal).
  5. Apply `useSafeAreaInsets` for top padding on the menu screen.

- `client/components/VocabularyManagement.tsx` — per-type management UI:
  1. Props: `{ type: VocabularyType; onBack: () => void; onClose: () => void }`. Title map: `units → 'Units'`, `packages → 'Packages'`, `size_descriptors → 'Sizes'`.
  2. Data/mutations: `useVocabulary`, `useCreateVocabularyEntry(type)`, `useUpdateVocabularyEntry(type)`, `useDeleteVocabularyEntry(type)`, `useResetVocabularyToDefaults(type)`; derive entries from `vocabulary?.[type === 'size_descriptors' ? 'sizeDescriptors' : type] ?? []`.
  3. Main layout: header with back/title/close, FlatList of entries (row tap opens edit dialog), Add button, Reset to Defaults button. Below the Reset button, when `showResetConfirm` is true, show inline confirmation: **"Reset [Type] to defaults? This will remove any custom entries and restore the standard list."** with `[Cancel]` and `[Reset]` (red) buttons. No `Alert.alert`.
  4. Add/Edit dialog rendered as `<Modal animationType="fade" transparent={true}>` (established dialog pattern §7a):
     - **Title:** `editingEntry ? 'Edit Entry' : 'Add Entry'`
     - Header: Trash2 pill (left side, shown only when `editingEntry !== null`), title centered, X close right
     - Canonical text input
     - Alias chips: each shows `[alias ×]`; tap × removes alias; `[+ Add alias]` button sets `showNewAliasInput = true` and renders an auto-focused `TextInput`; pressing Return or blurring commits the alias (if non-empty) and hides the input
     - When `showDeleteConfirm` is true (Trash2 tapped), show inline confirmation: **"Delete [canonical]? This cannot be undone."** with `[Cancel delete]` and `[Delete]` (red) buttons
     - Action row: `[Cancel]` and `[Save]`; Save disabled when `canonicalInput.trim()` is empty
  5. Save behavior: trim canonical; no-op when empty; create vs update based on `editingEntry`; close dialog on success. Delete: mutate then close dialog.
  6. All confirmations inline — no `Alert.alert` anywhere in this component.

- `client/api/__tests__/vocabulary-test.ts` — hook tests covering all spec scenarios. Use established Supabase mocking pattern from `metadata-test.ts`:
  1. `useVocabulary`: fetches three tables in parallel, disabled when `householdId` is null, `staleTime` is 5 minutes (300 000 ms).
  2. `useCreateVocabularyEntry`: correct insert payload shape (with `household_id`) for `units`, `packages`, and `size_descriptors`; throws when `householdId` is null; invalidates `['vocabulary']` on success.
  3. `useUpdateVocabularyEntry`: updates `canonical` and `aliases` with `.eq('id', ...)` and `.eq('household_id', ...)`; throws when `householdId` is null; invalidates on success.
  4. `useDeleteVocabularyEntry`: deletes by `id` and `household_id`; throws when `householdId` is null; invalidates on success.
  5. `useResetVocabularyToDefaults`: delete fires before insert (sequential, not parallel); insert payload for `units` matches `DEFAULT_VOCABULARY.units`; insert payload for `packages` matches `DEFAULT_VOCABULARY.packages`; insert payload for `size_descriptors` matches `DEFAULT_VOCABULARY.sizeDescriptors`; throws when `householdId` is null; invalidates on success.

- `client/components/__tests__/SizesAndPackages-test.tsx` — component tests for drill-down container:
  1. Menu renders three nav rows by testID (`vocab-nav-units`, `vocab-nav-packages`, `vocab-nav-sizes`).
  2. Tapping each row shows expected management title (`Units`, `Packages`, `Sizes`).
  3. Tapping back returns to menu (nav rows visible again).
  4. `testID="sizes-packages-close"` calls `onClose` from the menu screen.
  5. Close button calls `onClose` from the management screen.

- `client/components/__tests__/VocabularyManagement-test.tsx` — component tests for CRUD/reset UI:
  1. All entries from mocked `useVocabulary` are rendered in the list.
  2. Add button opens dialog with empty canonical input and title `Add Entry`.
  3. Filling canonical and pressing Save calls `createEntry.mutateAsync` with the correct shape.
  4. Tapping an existing entry opens dialog pre-filled with its canonical and aliases, title `Edit Entry`.
  5. Editing canonical and pressing Save calls `updateEntry.mutateAsync`.
  6. Tapping Trash2 in edit dialog reveals delete confirmation text `"Delete [canonical]? This cannot be undone."`.
  7. Pressing Delete in confirmation calls `deleteEntry.mutateAsync` with the entry's id.
  8. Pressing Cancel delete hides confirmation but keeps dialog open.
  9. Pressing Reset to Defaults shows confirmation text `"Reset [Type] to defaults? This will remove any custom entries and restore the standard list."`.
  10. Pressing Reset in confirmation calls `resetToDefaults.mutateAsync`.
  11. Pressing Cancel hides reset confirmation.
  12. Pressing `[+ Add alias]` and submitting an alias adds it as a chip.
  13. Pressing × on an alias chip removes it.
  14. Save button is disabled when canonical input is empty.

## Patterns Applying

- **Realtime Mutation Tracking:** No — vocabulary mutations target `units`, `packages`, `size_descriptors`, not `list_items`.
- **Household Guard:** Yes — all vocabulary inserts/mutations must throw `'No household ID found'` when `householdId` is null and scope writes with `.eq('household_id', householdId)`.
- **Undo Registration:** No — spec explicitly states settings-level vocabulary changes do not register undo/redo.

## Resolved Ambiguities

- **`auth.tsx` dynamic import:** The spec snippet erroneously showed `const { supabase } = await import('../lib/supabase')` inside `seedVocabularyForHousehold`. This is wrong — use the existing module-level `supabase` import at the top of `auth.tsx` directly. No dynamic import.
