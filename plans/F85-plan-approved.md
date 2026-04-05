# Implementation Plan: F85 Structured Quantity Data Conversion (Approved)

## Files to Modify

- `supabase/migrations/20250101000015_f85_packages_plural.sql` —
  1. **Add `plural` column and backfill existing rows** — apply the exact migration sequence: `ALTER TABLE packages ADD COLUMN plural TEXT;` then `UPDATE packages SET plural = COALESCE(aliases[1], canonical || 's');`.
  2. **Enforce not-null and remove redundant alias storage** — run `ALTER TABLE packages ALTER COLUMN plural SET NOT NULL;` then `UPDATE packages SET aliases = array_remove(aliases, plural);`.
  3. **Ensure:** do not modify `20250101000014_f79_quantity_units_system.sql` or any unrelated migration logic.

- `supabase/full_schema.sql` —
  1. **Update packages schema definition** — add `plural TEXT NOT NULL` to the `packages` table definition.
  2. **Align seed package aliases with plural column** — remove leading-plural values from `aliases` in package seed entries and keep non-plural aliases (for example `pkg`) in `aliases`.
  3. **Ensure:** preserve all other table definitions, policies, and seed data outside F85 package plural adjustments.

- `client/lib/vocabulary.ts` —
  1. **Extend vocabulary types for explicit package plural** — add `plural?: string` to `VocabEntry` and add exported `PackageEntry { canonical: string; plural: string; }`.
  2. **Reshape `DEFAULT_VOCABULARY.packages`** — move plural strings out of `aliases` into `plural` for all package entries, leaving only non-plural aliases in `aliases`.
  3. **Update token lookup behavior** — in private `lookup(token, entries)`, match `entry.canonical`, then `entry.plural`, then `entry.aliases`.
  4. **Add package-entry lookup API** — implement `lookupPackageEntry(token, vocabulary)` exactly returning `{ canonical, plural }` with fallback plural `entry.plural ?? `${entry.canonical}s``.
  5. **Deprecate old plural helper** — keep `getPlural` but add JSDoc `@deprecated Use packagePlural field from QuantityFields instead`.
  6. **Ensure:** existing canonical lookup behavior remains compatible for current callers like `lookupPackage('cans', vocabulary) -> 'can'`.

- `client/lib/parser.ts` —
  1. **Adopt structured package token value** — add file-local `PackageValue { canonical: string; plural: string | null; }`, replace `lookupPackage` import/usage with `lookupPackageEntry` and classify `PACKAGE` token values as `{ canonical, plural }`.
  2. **Normalize n-pack token value shape** — in pass3d (`4-pack` path), store `value: { canonical: token.raw.toLowerCase(), plural: null }`.
  3. **Propagate plural through SIZED_PACKAGE and candidate assembly** — for pass3b output include `packagePlural`; in `assembleCandidate`, set `candidate.packagePlural` for both `PACKAGE` and `SIZED_PACKAGE`.
  4. **Extend parse output interfaces** — add `packagePlural: string | null` to `CandidateFields` and `ParsedInput`, initialize to null in `assembleCandidate`, and propagate in `resolveNames` interpretations.
  5. **Ensure:** parsing pass flow (passes 1–6) and tokenization behavior stay unchanged apart from package token value shape and new propagated field.

- `client/lib/quantityFormat.ts` —
  1. **Update quantity field contract** — add `packagePlural?: string | null` to `QuantityFields` and export `type QuantityParsed = Required<QuantityFields>`.
  2. **Remove vocabulary dependency in formatter** — drop `DEFAULT_VOCABULARY` and `getPlural` from the import (change to `import { type Vocabulary } from '@/lib/vocabulary'`) and compute plural in `formatQuantity` as `effectiveCount !== null && effectiveCount > 1 ? (fields.packagePlural ?? `${packageType}s`) : packageType`.
  3. **Export parser utility** — add exported `parseQuantityText(text, vocabulary): QuantityParsed | null` using `tokenize -> classifyTokens -> groupTokens -> assembleCandidate`; return null for empty/whitespace or all-null quantity fields (count, packageType, sizeQty, sizeUnit, sizeDescriptive all null).
  4. **Ensure:** existing output formatting behavior is preserved for non-package and singular cases.

- `client/api/vocabulary.ts` —
  1. **Add plural to row model and query shape** — extend `VocabRow` with `plural?: string`, and change packages select to `supabase.from('packages').select('id, canonical, aliases, plural')`.
  2. **Extend create/update mutation params for packages** — add `plural?: string` to create/update param types and include payload `plural` when `type === 'packages'`.
  3. **Update default reset payload for packages** — in `useResetVocabularyToDefaults`, insert packages with `plural: (entry as { plural?: string }).plural ?? `${entry.canonical}s``.
  4. **Ensure:** existing household guard, query key usage (`['vocabulary', householdId]`), and invalidation behavior remain unchanged.

- `client/api/__tests__/vocabulary-test.ts` —
  1. **Update package mutation expectations for plural payloads** — adjust the packages create test to call `mutateAsync({ canonical, aliases, plural })` and assert `insert` receives `{ household_id, canonical, aliases, plural }`.
  2. **Add package update payload coverage** — extend update-mutation assertions for `type === 'packages'` so `update` receives `{ canonical, aliases, plural }` while units remain unchanged.
  3. **Update package reset-defaults expectation** — assert `useResetVocabularyToDefaults('packages')` reinserts `plural: (entry as { plural?: string }).plural ?? `${entry.canonical}s`` alongside `canonical` and `aliases`.
  4. **Ensure:** unit and size-descriptor tests still verify their payloads do not gain package-only fields.

- `client/api/list.ts` —
  1. **Allow parsed quantity on list inserts** — import `QuantityParsed` and add `quantity_parsed?: QuantityParsed | null` to `ListItemInsert`.
  2. **Ensure:** mutation flow and realtime mutation tracking wrappers remain unchanged.

- `client/api/items.ts` —
  1. **Allow parsed quantity fields on create/update** — import `QuantityParsed`; add `default_qty_parsed?: QuantityParsed | null` and `alternate_qtys_parsed?: (QuantityParsed | null)[] | null` to both create and update parameter types.
  2. **Ensure:** existing mutation logic and payload spreading behavior stay unchanged.

- `client/app/auth.tsx` —
  1. **Seed package plural values** — in `seedVocabularyForHousehold`, include `plural: entry.plural ?? `${entry.canonical}s`` in `packages` insert mapping.
  2. **Ensure:** auth/profile sequencing and non-package seed behavior remain unchanged.

- `client/components/VocabularyManagement.tsx` —
  1. **Add package plural input state and lifecycle** — add `pluralInput` state and manual-edit tracking state; initialize in add/edit open handlers (`''` for add, `entry.plural ?? ''` for edit).
  2. **Auto-fill plural default while respecting manual override** — when canonical changes for `type === 'packages'`, auto-fill `${canonicalInput}s` only until plural is manually edited.
  3. **Render conditional required field** — show labeled `Plural form` input only for packages, placeholder `e.g. cans`, reuse existing alias input styling, and disable Save when plural is empty for packages.
  4. **Pass plural through mutations** — include `plural: pluralInput` in create/update mutation calls for packages only.
  5. **Ensure:** non-package dialog behavior, alias UI behavior, and existing modal structure remain unchanged.

- `client/components/SmartAddItem.tsx` —
  1. **Add parsed-quantity helper from interpretations** — import `parseQuantityText`, `QuantityParsed`; add `extractQuantityParsed(interpretation)` returning null for all-null quantity fields and otherwise `{ count, packageType, packagePlural: packagePlural ?? null, sizeQty, sizeUnit, sizeDescriptive }`.
  2. **Populate `quantity_parsed` on all add-to-list write paths** — set `quantity_parsed` in these four `addItem()` call sites:
     - `onCommitAdd`: `extractQuantityParsed(interpretation)`
     - `onOneOffAdd`: `parseQuantityText(oneOffQty, vocab)`
     - `onOneOffEditAdd`: `parseQuantityText(editQty, vocab)`
     - `onSaveEdited` `addItem()` path: `parseQuantityText(editQty, vocab)`
  3. **Populate parsed default qty for new master-item creation in edit-save path** — in `onSaveEdited` branch that calls `createMasterItem`, pass `default_qty_parsed: parseQuantityText(editQty, vocab)`.
  4. **Ensure:** existing undo registration, forward/redo flow, and add/edit UX behavior remain unchanged.

- `client/app/(tabs)/items.tsx` —
  1. **Load vocabulary for parsing** — import `useVocabulary` from `@/api/vocabulary`; import `DEFAULT_VOCABULARY` from `@/lib/vocabulary`; import `parseQuantityText` from `@/lib/quantityFormat` (import `QuantityParsed` only if needed for an explicit local type annotation — omit it if TypeScript infers the type to avoid unused-import lint errors); add `const { data: vocabulary } = useVocabulary(); const vocab = vocabulary ?? DEFAULT_VOCABULARY;`.
  2. **Compute parsed payload on save** — in `handleSave`, build `altQtyArray` and `parsedPayload` exactly as specified:
     - `default_qty_parsed: parseQuantityText(qty, vocab)`
     - `alternate_qtys_parsed: altQtyArray.length > 0 ? altQtyArray.map((q) => parseQuantityText(q, vocab)) : null`
     then spread into create/update payload.
  3. **Extend undo snapshot with parsed pre-edit fields** — in `oldSnapshot`, add parsed fields from old values:
     - `default_qty_parsed: parseQuantityText(editingItem.default_qty || '', vocab)`
     - `alternate_qtys_parsed: (editingItem.alternate_qtys ?? []).length > 0 ? (editingItem.alternate_qtys ?? []).map((q) => parseQuantityText(q, vocab)) : null`
  4. **Ensure:** existing undo action registration and item save/edit behavior remain unchanged apart from adding parsed fields.

- `client/lib/__tests__/parser-test.ts` —
  1. **Update package token-value assertions** — replace plain string expectations with `{ canonical, plural }` expectations where `PACKAGE` token value is asserted.
  2. **Add packagePlural propagation coverage** — add tests for `assembleCandidate` on `"2 cans"`, `"2 8oz cans"`, and `"4-pack"` null plural case.
  3. **Add resolve output coverage** — verify `resolveNames` includes `packagePlural` in `ParsedInput` for `"2 cans broth"`.
  4. **Ensure:** existing parser behavior tests still validate current pass logic.

- `client/lib/__tests__/vocabulary-test.ts` —
  1. **Cover plural-aware package lookup contract** — keep `lookupPackage('can', DEFAULT_VOCABULARY) -> 'can'` and `lookupPackage('cans', DEFAULT_VOCABULARY) -> 'can'` assertions so the moved plural storage remains backward-compatible.
  2. **Add `lookupPackageEntry` coverage** — assert canonical input and plural input both return `{ canonical: 'can', plural: 'cans' }`, and include an irregular example such as `{ canonical: 'loaf', plural: 'loaves' }`.
  3. **Retain deprecated plural-helper coverage** — keep `getPlural('can', DEFAULT_VOCABULARY)` / `getPlural('loaf', DEFAULT_VOCABULARY)` assertions so the deprecated helper remains correct until follow-up removal.
  4. **Ensure:** unit and size-descriptor helper tests remain unchanged.

- `client/lib/__tests__/quantityFormat-test.ts` —
  1. **Update `formatQuantity` cases to explicit plural input** — use cases specified in the spec, including irregular plural (`loaf/loaves`) and null-fallback (`12-pack`).
  2. **Add `parseQuantityText` describe block** — add all required cases:
     - empty/whitespace/no-signal -> `null`
     - bare count (`2`, `1.5`)
     - unit-only (`16oz`)
     - package canonical/plural (`can`, `cans`)
     - count+package (`2 cans`)
     - sized package (`16oz bottle`)
     - count+size+package (`2 8oz cans`)
     - irregular plural (`2 loaves`, `loaves`)
     - descriptor+package (`large can`)
     - n-pack (`4-pack` with `packagePlural: null`)
  3. **Ensure:** existing normalization and comparable-quantity behavior remains intact.

- `client/components/__tests__/SmartAddItem-test.tsx` —
  1. **Add quantity_parsed quick-add assertion** — verify quick-add passes parsed object including `packagePlural`.
  2. **Add null parsed assertion for empty interpretation** — verify all-null interpretation sends `quantity_parsed: null`.
  3. **Add one-off parseable qty assertion** — verify one-off add with `"2 cans"` sends non-null `quantity_parsed`.
  4. **Ensure:** existing SmartAddItem behavioral tests remain unchanged.

- `client/components/__tests__/VocabularyManagement-test.tsx` —
  1. **Add conditional plural field visibility tests** — show for `type="packages"`, hide for `type="units"`.
  2. **Add default and manual-override behavior tests** — canonical input auto-fills plural with `+s`; manual plural edits are preserved after canonical changes.
  3. **Add create payload assertion** — save new package entry and assert `createEntry.mutate` gets `{ canonical: 'sleeve', plural: 'sleeves', aliases: [] }`.
  4. **Ensure:** existing vocabulary-management CRUD/reset tests continue to pass.

- `BACKLOG.md` —
  1. **Append deferred item under "Deferred from Specs"** — add exact unchecked item:
     `Inline list item quantity edits do not update quantity_parsed — useUpdateListItem skips structured write. F78 can re-parse text column as fallback. (deferred from F85)`
  2. **Ensure:** do not alter unrelated backlog sections.

## New Files

- `client/app/(tabs)/__tests__/items-f85-test.tsx` — new test file covering parsed quantity payloads for create/edit flows, index-aligned `alternate_qtys_parsed`, null entries for unparseable alt quantities, and undo restoration of parsed snapshot values.
- `supabase/migrations/20250101000015_f85_packages_plural.sql` — migration adding `packages.plural`, backfilling from `aliases[1]` or `canonical || 's'`, enforcing NOT NULL, and removing stored plural from aliases.

## Patterns Applying
- Realtime Mutation Tracking: No — F85 adds parsed fields and vocabulary schema/plumbing but does not introduce new `list_items` mutation hooks; existing tracking wrappers remain in place.
- Household Guard: Yes — vocabulary/table writes remain household-scoped; updated vocabulary create/update/reset and existing insert paths must continue throwing `No household ID found` when required.
- Undo Registration: Yes — Items screen edit flow already registers undo; F85 extends undo snapshot payload to include `default_qty_parsed` and `alternate_qtys_parsed` so undo restores pre-edit JSONB values.
