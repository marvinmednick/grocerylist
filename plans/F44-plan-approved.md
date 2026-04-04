# Implementation Plan: F44 Free-form Input Parsing (Approved)

## Files to Modify

- `client/components/SmartAddItem.tsx` —
  1. **Replace dropdown data source with parser-driven interpretations** — replace `useSearchItems(query)`-driven matching with `parseInput(query, vocabulary, masterItems)` where `vocabulary` is `DEFAULT_VOCABULARY` (imported constant from `client/lib/vocabulary.ts`), `masterItems` comes from `useMasterItemNames()`, and stores come from existing metadata hook; keep fallback behavior: show nothing when `query.length < 2` or when parser yields no interpretations and no name words.
  2. **Wire new parser/master-name dependencies** — add hook usage for `useMasterItemNames()` and import `DEFAULT_VOCABULARY` as a constant (no `useVocabulary()` hook — vocabulary is in-memory for F44); import parser utilities needed for qty handling (`formatQuantity`, `quantityEquals`, `isPartialMatch`); keep existing add mutations and undo registration paths unchanged.
  3. **Render ranked `ParseResult.interpretations` rows** — each interpretation renders item name, matched/unmatched styling, and chevron edit trigger; one-off row remains at bottom for non-empty query and uses `ParseResult.rawInput`.
  4. **Add orphan token presentation** — render `interpretation.orphans` as struck-through muted text immediately after the matched/candidate item name.
  5. **Add store hint pill row** — when `interpretation.storeHint` is present, prefix-match stores using `store.name.toLowerCase().startsWith(hint.toLowerCase())`; render unresolved muted hint for 0 matches, single pre-selected pill for 1 match, or multiple pills with first pre-selected for 2+; apply one-line cap with `...` overflow opening edit modal.
  6. **Rework qty pill logic with parsed context** — compute parsed quantity from interpretation fields using `formatQuantity`, pre-select exact existing pill matches via `quantityEquals(parsedQty, alternate, DEFAULT_VOCABULARY)`, inject parsed qty as first selected pill when no exact match, sort remaining pills by `isPartialMatch` against raw typed qty text, append `Other`, apply 2-row cap and `...` overflow behavior that opens edit modal.
  7. **Replace F15 floating Other popover pattern with inline editor** — tapping `Other` swaps the full qty pill row with inline `TextInput` prefilled from parsed qty (or empty), auto-focuses, supports Return submit, and includes `✕` dismiss restoring pill view.
  8. **Enhance edit modal with parsed defaults and hint-aware store ordering** — prefill qty text input with parsed quantity string; in store picker, show hint matches first and add `▸ More` expansion for remaining stores while keeping matched stores pinned above non-matches after expansion.
  9. **Ensure:** existing add-item/create-item mutation behavior, existing undo pushAction flow, existing realtime/household behavior, and overall routing/tab structure remain unchanged; no changes to `api/list.ts`, `api/undoContext.tsx`, `lib/household.tsx`, or schema.

- `client/api/items.ts` —
  1. **Add lightweight master-name query hook** — implement `useMasterItemNames()` with query key `['master_item_names']`, query shape `supabase.from('items').select('id, name, default_qty, alternate_qtys').order('name')` (no limit — RLS scopes to household), and `staleTime: 5 * 60 * 1000`. Returns `MasterItemRef[]`.
  2. **Update mutation invalidation coverage** — in `useCreateMasterItem` and `useUpdateMasterItem` `onSuccess`, invalidate `['master_item_names']` alongside existing `['items']` and `['all_items']` invalidations.
  3. **Ensure:** keep `useAllItems` and `useSearchItems` APIs/behavior intact; do not change household guard semantics, mutation payloads, or unrelated query keys.

## New Files

- `client/lib/parser.ts` — pure multi-pass parser module with no hooks/Supabase side effects. Export all parser passes and interfaces exactly as specified: `parseInput`, `tokenize`, `classifyTokens`, `groupTokens`, `assembleCandidate`, `resolveNames`, plus interfaces `Token`, `ClassifiedToken`, `GroupedToken`, `CandidateFields`, `ParsedInput`, `ParseResult`, `MasterItemRef`. Implement pass behavior exactly as spec: classification priority, iterative grouping loop (max 10 iterations, `console.warn()` when iterations > 4), candidate assembly rules, bag-of-words resolution with dual-candidacy size descriptors, longest-match ranking, and `rawInput` passthrough.

- `client/lib/vocabulary.ts` — vocabulary contracts and seed constants. Define `VocabEntry`, `Vocabulary`, `DEFAULT_VOCABULARY` with all listed units/packages/size descriptors and aliases, plus lookup helpers `lookupUnit`, `lookupPackage`, `lookupSizeDescriptor` (case-insensitive canonical+alias matching), and `getPlural` (first alias differing from canonical, else canonical + `s`).

- `client/lib/quantityFormat.ts` — interim quantity text utilities. Define `QuantityFields` and implement:
  - `formatQuantity(fields: QuantityFields): string` — with required ordering and implied-count rules: count omitted when null or 1 EXCEPT when packageType is present (always show `1 can` even when count is null/implied)
  - `quantityEquals(a: string, b: string, vocabulary: Vocabulary): boolean` — parses both strings through parser passes 1-4 (vocabulary parameter required for token classification), compares structured fields with numeric tolerance `0.001` and null-safe equality
  - `isPartialMatch(userInput: string, dbString: string): boolean` — implemented as `dbString.toLowerCase().startsWith(userInput.toLowerCase())`

- `client/lib/__tests__/parser-test.ts` — parser unit suite.
  Test cases from spec:
  - `splits on whitespace`
  - `handles quoted strings as single tokens`
  - `handles double-quoted strings`
  - `handles empty input`
  - `trims extra whitespace`
  - `classifies numbers`
  - `classifies count sigils`
  - `classifies store hints`
  - `classifies compound tokens`
  - `classifies standalone units`
  - `classifies packages`
  - `classifies N-pack pattern`
  - `classifies size descriptors`
  - `classifies unrecognized tokens as NAME`
  - `is case-insensitive for vocabulary lookups`
  - `merges NUMBER + UNIT into QUANTITATIVE_SIZE`
  - `converts COMPOUND to QUANTITATIVE_SIZE`
  - `merges QUANTITATIVE_SIZE + PACKAGE into SIZED_PACKAGE`
  - `reclassifies NUMBER before SIZED_PACKAGE as COUNT`
  - `reclassifies NUMBER before PACKAGE as COUNT`
  - `produces identical output for fused and spaced forms`
  - `stabilizes within 4 iterations for all V1 inputs`
  - `warns when iterations exceed 4`
  - `extracts count from COUNT token`
  - `extracts bare NUMBER as count when no package`
  - `extracts store hint`
  - `extracts quantitative size`
  - `extracts descriptive size`
  - `collects remaining tokens as nameWords`
  - `extracts all fields from complex input`
  - `matches exact bag-of-words`
  - `matches word-order-independent`
  - `generates dual-candidacy interpretations with size descriptor`
  - `carries orphan tokens`
  - `returns empty interpretations when nothing matches`
  - `ranks by longest name match`
  - `is case-insensitive`
  - `parses "2 milk"`
  - `parses "milk @safeway"`
  - `parses "2 8oz cans chicken broth"`
  - `parses "2 8 oz cans chicken broth"`
  - `parses "2x 8oz cans chicken broth @safeway"`
  - `parses "1.5 lb chicken @costco"`
  - `parses "large avocado" with multiple interpretations`
  - `parses "large green avocado" with orphans`
  - `parses "2 loaves bread"`
  - `parses "3 12-pack Coke"`
  - `parses quoted input correctly`
  - `returns rawInput in ParseResult`
  - `handles input with no matches gracefully`
  Mocks required:
  - `console.warn` spy for iteration warning assertions.
  - No Supabase/React hooks mocks (pure module tests).

- `client/lib/__tests__/vocabulary-test.ts` — vocabulary helper tests.
  Test cases from spec:
  - `lookupUnit finds canonical`
  - `lookupUnit finds alias`
  - `lookupUnit is case-insensitive`
  - `lookupUnit returns null for unknown`
  - `lookupPackage finds canonical and aliases`
  - `lookupSizeDescriptor works`
  - `getPlural returns plural form`
  Mocks required:
  - None (pure function tests).

- `client/lib/__tests__/quantityFormat-test.ts` — quantity formatting/equality tests.
  Test cases from spec (with corrections applied):
  - `formats count only` → `{count: 2}` → `"2"`
  - `formats size only` → `{sizeQty: 1.5, sizeUnit: "lb"}` → `"1.5lb"`
  - `formats descriptive size` → `{sizeDescriptive: "large"}` → `"large"`
  - `formats count + package` → `{count: 2, packageType: "loaf"}` → `"2 loaves"`
  - `formats count 1 + package` → `{count: 1, packageType: "can"}` → `"1 can"`
  - `formats size + package` → `{sizeQty: 32, sizeUnit: "oz", packageType: "box"}` → `"32oz box"`
  - `formats all fields` → `{count: 2, sizeQty: 8, sizeUnit: "oz", packageType: "can"}` → `"2 8oz cans"`
  - `formats N-pack with count` → `{count: 3, packageType: "12-pack"}` → `"3 12-packs"`
  - `shows implied count 1 with package when count is null` → `{count: null, packageType: "can"}` → `"1 can"` (rule: packageType present → always show count, even when null/implied)
  - `quantityEquals matches equivalent forms` → `quantityEquals("2 loaves", "2 loaf", DEFAULT_VOCABULARY)` → `true`
  - `quantityEquals matches fused/spaced` → `quantityEquals("1.5 lb", "1.5lb", DEFAULT_VOCABULARY)` → `true`
  - `quantityEquals rejects different quantities` → `quantityEquals("2 cans", "3 cans", DEFAULT_VOCABULARY)` → `false`
  - `isPartialMatch checks prefix` → `isPartialMatch("2", "2lb")` → `true`
  - `isPartialMatch rejects non-prefix` → `isPartialMatch("1.5", "1lb")` → `false`
  Mocks required:
  - None (pure function tests; uses parser/vocabulary modules directly; pass `DEFAULT_VOCABULARY` to `quantityEquals` calls).

- `client/components/__tests__/SmartAddItem-parser-test.tsx` — UI integration tests for parser-driven SmartAddItem rendering/interaction.
  Test cases from spec:
  - `shows parsed qty pre-selected on pill`
  - `shows orphan tokens struck-through`
  - `shows store pills when @hint present`
  - `does not show store pills without @hint`
  - `shows one-off add row with rawInput`
  - `Other replaces pills with text input`
  - `✕ returns to pill view`
  Mocks required:
  - `@/api/items` hook mocks for `useMasterItemNames` data.
  - Existing SmartAddItem dependency mocks (metadata/stores, add/edit mutations, household/query providers per project test wrapper pattern — QueryClient + UndoProvider + HouseholdProvider).
  - Prefer real parser behavior over parser spies where practical.

## Patterns Applying
- Realtime Mutation Tracking: No — F44 introduces parser/read/UI behavior only; no new `list_items` mutation paths are added.
- Household Guard: No — new logic reads household-scoped `items` via existing RLS-scoped query; no new inserts requiring guard are introduced.
- Undo Registration: No — add/delete/edit mutation registrations in SmartAddItem remain existing behavior; F44 only changes preselection/parsing inputs.
