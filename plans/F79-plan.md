# Implementation Plan: F79 Quantity Units System

## Files to Modify

- `supabase/full_schema.sql` —
  1. **Remove old units schema block** — delete the legacy `-- 6. UNITS` table definition and its old public-read RLS policy section.
  2. **Update existing tables to match migration** — remove `default_unit_id UUID REFERENCES units(id) ON DELETE SET NULL` from `items` and remove `unit_id UUID REFERENCES units(id) ON DELETE SET NULL` from `list_items`.
  3. **Add quantity JSONB columns** — add `quantity_parsed JSONB NULL` to `list_items`; add `default_qty_parsed JSONB NULL` and `alternate_qtys_parsed JSONB[] NULL` to `items`.
  4. **Add new household-scoped vocabulary tables + policies** — add full schema blocks for `units`, `packages`, and `size_descriptors` with `household_id` FK to `households(id) ON DELETE CASCADE`, `canonical`, `aliases TEXT[] NOT NULL DEFAULT '{}'`, indexes on `household_id`, RLS enabled, and `FOR ALL TO authenticated` policies using `household_id = get_my_household_id()` in both `USING` and `WITH CHECK`.
  5. **Ensure:** no unrelated table definitions, policies, or ordering outside F79 schema requirements are modified.

- `client/components/SmartAddItem.tsx` —
  1. **Switch parser vocabulary source to API hook with fallback** — add `useVocabulary` import and hook usage: `const { data: vocabulary } = useVocabulary();`, derive `const vocab = vocabulary ?? DEFAULT_VOCABULARY;` outside memos.
  2. **Update parse memos to use household vocabulary** — change `parseResult` to `parseInput(query, vocab, masterItemNames)` with deps `[query, vocab, masterItemNames]`; change `parseCandidate` to `assembleCandidate(groupTokens(classifyTokens(tokenize(query), vocab)))` with deps `[query, vocab]`.
  3. **Ensure:** keep `DEFAULT_VOCABULARY` import for loading fallback, preserve parser flow/UI behavior, and do not change parser implementation files.

- `client/components/UserAvatar.tsx` —
  1. **Rename settings menu label** — replace menu text `Settings` with `General` while keeping the same trigger behavior for opening existing settings modal state.
  2. **Add Sizes & Packages menu action** — add new menu row labeled `Sizes & Packages` in the avatar menu list, positioned alongside existing menu actions; tapping closes menu and sets `sizesAndPackagesVisible` true.
  3. **Mount new modal component** — import `SizesAndPackages` and conditionally render it after existing `Settings` conditional with `visible={sizesAndPackagesVisible}` and `onClose={() => setSizesAndPackagesVisible(false)}`.
  4. **Ensure:** existing avatar/menu open-close behavior, logout flow, and settings modal toggling remain unchanged.

- `client/components/Settings.tsx` —
  1. **Rename internal modal title** — update the displayed title text from `Settings` to `General` only.
  2. **Ensure:** modal safe-area/scroll behavior and all existing settings controls remain unchanged.

- `client/app/auth.tsx` —
  1. **Add vocabulary seeding helper using defaults** — add `DEFAULT_VOCABULARY` import and helper `seedVocabularyForHousehold(householdId: string): Promise<void>` that inserts mapped rows into `units`, `packages`, and `size_descriptors` using existing module-level `supabase` import (no dynamic re-import).
  2. **Seed after new profile creation in multi-household branch** — in `ensureProfile`, after successful profile insert for newly created household (`if (hh)` path), call `await seedVocabularyForHousehold(hh.id);`.
  3. **Ensure:** single-household flow remains unchanged and existing auth/profile creation order stays intact apart from adding post-profile seed call in the multi-household create path.

- `client/components/__tests__/UserAvatar-test.tsx` —
  1. **Extend avatar menu assertions** — add tests to verify `General` appears and `Settings` does not, and `Sizes & Packages` appears.
  2. **Add navigation behavior coverage** — add tests that pressing `Sizes & Packages` renders `SizesAndPackages` (mocked) and pressing `General` opens Settings.
  3. **Ensure:** existing passing test cases are retained; only additive coverage changes.

- `client/components/__tests__/SmartAddItem-parser-test.tsx` —
  1. **Add hook-driven vocabulary parsing test** — mock `useVocabulary` with custom package token (e.g., `punnet`) and assert parsing reflects `packageType: 'punnet'` for input like `2 punnets strawberries`.
  2. **Add fallback parsing test** — mock `useVocabulary` returning `undefined`; assert standard fallback vocabulary still parses (e.g., `2 cans` -> `packageType: 'can'`).
  3. **Ensure:** parser tests remain focused on observable parse outcomes without changing parser internals.

## New Files

- `supabase/migrations/20250101000014_f79_quantity_units_system.sql` — apply the exact F79 migration steps in order:
  1. `DROP POLICY IF EXISTS "Public read units" ON units;`
  2. `ALTER TABLE items DROP COLUMN IF EXISTS default_unit_id;`
  3. `ALTER TABLE list_items DROP COLUMN IF EXISTS unit_id;`
  4. `DROP TABLE IF EXISTS units;`
  5. Create new household-scoped `units`, `packages`, `size_descriptors` tables with `canonical`, `aliases`, indexes.
  6. Enable RLS and create `Household members can manage ...` policies for all three tables.
  7. Add `list_items.quantity_parsed JSONB NULL`, `items.default_qty_parsed JSONB NULL`, `items.alternate_qtys_parsed JSONB[] NULL`.
  8. Seed all existing households via `DO $$ ... FOR hh_id IN SELECT id FROM households LOOP ...` inserts with exact defaults and `ON CONFLICT (household_id, canonical) DO NOTHING`.

- `client/api/vocabulary.ts` — new API module exporting `VocabularyType`, `VocabRow`, `VocabularyData`, and hooks:
  1. `useVocabulary` query with key `['vocabulary', householdId]`, `enabled: !!householdId`, `staleTime: 1000 * 60 * 5`, and three parallel selects:
     `supabase.from('units').select('id, canonical, aliases').eq('household_id', householdId).order('canonical')`
     `supabase.from('packages').select('id, canonical, aliases').eq('household_id', householdId).order('canonical')`
     `supabase.from('size_descriptors').select('id, canonical, aliases').eq('household_id', householdId).order('canonical')`
     returning `{ units, packages, sizeDescriptors }`.
  2. CRUD mutations: create/update/delete with household guard `if (!householdId) throw new Error('No household ID found')`, insert payload includes `household_id`, update/delete include `.eq('household_id', householdId)`.
  3. Reset mutation: delete all rows for `type + household`, then insert mapped `DEFAULT_VOCABULARY` seed entries (`units`, `packages`, `sizeDescriptors` mapping for `size_descriptors`).
  4. All mutation success handlers invalidate vocabulary cache (`queryClient.invalidateQueries({ queryKey: ['vocabulary'] })`, affecting `['vocabulary', householdId]`).

- `client/components/SizesAndPackages.tsx` — full-screen modal drill-down:
  1. Props: `{ visible: boolean; onClose: () => void }`.
  2. Internal state: `activeScreen: VocabularyType | null`; reset to `null` whenever modal closes.
  3. Menu screen (when `activeScreen === null`): header title `Sizes & Packages`, close button (`testID="sizes-packages-close"`), and three nav rows with test IDs `vocab-nav-units`, `vocab-nav-packages`, `vocab-nav-sizes` setting `activeScreen` to `units`, `packages`, `size_descriptors`.
  4. Management screen rendering: when `activeScreen` is set, render `<VocabularyManagement type={activeScreen} onBack={() => setActiveScreen(null)} onClose={onClose} />` inside same modal.
  5. Apply safe-area insets and scrollable menu content per modal/full-screen requirements.

- `client/components/VocabularyManagement.tsx` — per-type management UI:
  1. Props: `{ type: VocabularyType; onBack: () => void; onClose: () => void }`; title map: `units -> Units`, `packages -> Packages`, `size_descriptors -> Sizes`.
  2. Data/mutations: `useVocabulary`, `useCreateVocabularyEntry(type)`, `useUpdateVocabularyEntry(type)`, `useDeleteVocabularyEntry(type)`, `useResetVocabularyToDefaults(type)`; derive entries from `vocabulary?.[type === 'size_descriptors' ? 'sizeDescriptors' : type] ?? []`.
  3. Main layout: header with back/title/close, FlatList of entries (row tap opens edit), add button, reset button + inline reset confirmation block with Cancel/Reset.
  4. Add/Edit dialog (`Modal` transparent fade): canonical input, alias chips, `[+ Add alias]` inline alias input behavior (submit on return/blur), edit-only Trash2 trigger showing inline delete confirmation with Cancel delete/Delete.
  5. Save behavior: trim canonical; no-op when empty; create vs update based on `editingEntry`; close dialog on success. Delete behavior: only for edit mode, then close dialog.
  6. Use inline confirmations (no `Alert.alert`) for delete and reset.

- `client/api/__tests__/vocabulary-test.ts` — hook tests covering all spec scenarios:
  1. `useVocabulary`: fetches three tables, disabled when householdId null, staleTime 5 minutes.
  2. `useCreateVocabularyEntry`: payload shape for all three types, null household guard, invalidation on success.
  3. `useUpdateVocabularyEntry`: updates canonical+aliases with `.eq('id', ...)` and `.eq('household_id', ...)`, null household guard, invalidation.
  4. `useDeleteVocabularyEntry`: deletes by id+household, null household guard, invalidation.
  5. `useResetVocabularyToDefaults`: delete-before-insert sequencing and exact seed payload for each type, null household guard, invalidation.
  6. Use established Supabase mocking pattern from `metadata-test.ts` and per-test `QueryClient` lifecycle conventions.

- `client/components/__tests__/SizesAndPackages-test.tsx` — component tests for drill-down container:
  1. Menu renders three nav rows by testID.
  2. Navigating each row shows expected management title (`Units`, `Packages`, `Sizes`).
  3. Back returns to menu.
  4. Close button calls `onClose` from both menu and management screens.

- `client/components/__tests__/VocabularyManagement-test.tsx` — component tests for CRUD/reset UI:
  1. List rendering of all entries.
  2. Add dialog open and save create behavior.
  3. Edit dialog prefill and update behavior.
  4. Trash2 reveals delete confirmation; confirm delete invokes mutation; cancel delete hides confirmation but keeps dialog.
  5. Reset confirmation show/cancel/confirm behavior and reset mutation call.
  6. Alias add/remove chip behaviors.
  7. Save disabled when canonical input is blank.

## Patterns Applying
- Realtime Mutation Tracking: No — vocabulary mutations target `units`, `packages`, `size_descriptors`, not `list_items`.
- Household Guard: Yes — all vocabulary inserts/mutations must throw `No household ID found` when `householdId` is null and scope writes by household.
- Undo Registration: No — spec explicitly says settings-level vocabulary changes do not register undo/redo.

## Ambiguities / Questions
- `auth.tsx` helper snippet includes `const { supabase } = await import('../lib/supabase');` but also states not to re-import dynamically and to use existing module-level import directly. Plan follows the explicit note (module-level import only).
