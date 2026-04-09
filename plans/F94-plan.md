# Implementation Plan: F94 Voice Input Parser Normalization

## Files to Modify

- `client/lib/parser.ts` —
  1. **Add `normalizeVoiceInput` before `tokenize`** — add exported `normalizeVoiceInput(input: string, storeNames: string[]): string` near the top of the file (before `tokenize`), operating on the raw input string and returning the transformed string.
  2. **Add module-level word-to-number lookup table and apply first-pass replacement** — define a non-exported lowercase lookup constant in `parser.ts` with exact mappings: `zero→0`, `one→1`, `two→2`, `three→3`, `four→4`, `five→5`, `six→6`, `seven→7`, `eight→8`, `nine→9`, `ten→10`, `eleven→11`, `twelve→12`, `half→0.5`, `quarter→0.25`, `dozen→12`; apply case-insensitive whole-word replacement only, left-to-right one pass, independent lookup per word.
  3. **Add second-pass `"at" → "@"` store hint normalization** — split on whitespace, scan tokens for case-insensitive `at`, and when next token exists and is a case-insensitive prefix (minimum 1 char) of any `storeNames` entry, replace `at nextToken` with `@nextToken` and skip the consumed next token; if no match or no next token, keep `at` unchanged.
  4. **Ensure:** do not change `parseInput` signature, `ParseResult`/`ParsedInput` interfaces, existing `@` sigil handling in `classifyTokens`, or `tokenize` behavior.

- `client/components/SmartAddItem.tsx` —
  1. **Add store names memo source for normalization** — add:
     `const storeNamesList = useMemo(() => { return (metadata?.stores || []).map((s) => s.name); }, [metadata?.stores]);`
  2. **Normalize query before parse pipeline entry points** — in `parseResult` memo, call `normalizeVoiceInput(query, storeNamesList)` before `parseInput`; in `parseCandidate` memo, call `normalizeVoiceInput(query, storeNamesList)` before `tokenize`.
  3. **Preserve original query for one-off row text** — after parsing normalized input, override `rawInput` to original query (`return { ...result, rawInput: query };`) so the Add-as-one-off display remains un-normalized.
  4. **Ensure:** keep current SmartAddItem ranking/merge/dedup flow intact and preserve existing UI behavior except for voice normalization effects.

- `client/lib/__tests__/parser-test.ts` —
  1. **Add `parseInput` integration assertions with normalization pre-step** — under existing `describe('parseInput')`, add:
     - `parses voice input "two cans chicken broth" with word-number normalization` (normalize then parse; assert `count=2`, `packageType="can"`, name matches `"Chicken Broth"`)
     - `parses "milk at safeway" with "at" store hint normalization` (normalize with `['Safeway']`, parse, assert `storeHint="safeway"` and name matches `"Milk"`).
  2. **Ensure:** existing parser tests and expectations remain unchanged outside the two new cases.

- `client/components/__tests__/SmartAddItem-parser-test.tsx` —
  1. **Add SmartAddItem composition scenarios for normalized voice inputs** — add:
     - `shows store pill when user types "milk at Safeway"` using existing store mocks (assert Safeway pill renders using the same pattern as existing `@safeway` assertions)
     - `shows parsed qty from voice input "two milk"` (assert qty pill `2` renders).
  2. **Ensure:** keep real parser composition style (no parser spy/mock), existing store mock fixtures, and existing parser-composition assertions unchanged.

## New Files

- `client/lib/__tests__/normalizeVoiceInput-test.ts` — unit tests for `normalizeVoiceInput` covering all spec-listed cases:
  - word-to-number: `"two milk"→"2 milk"`, `"three cans chicken broth"→"3 cans chicken broth"`, `"half pound salmon"→"0.5 pound salmon"`, `"dozen eggs"→"12 eggs"`, `"twelve"→"12"`, case-insensitivity (`"Two Pounds"→"2 Pounds"`), no substring corruption (`"attend"`, `"fourteen"` unchanged), multi-number (`"two dozen"→"2 12"`), unchanged passthrough when no mappings.
  - `at` store hint: `"milk at Safeway"→"milk @Safeway"` with `['Safeway']`, `"2 lbs chicken at Costco"→"2 lbs chicken @Costco"` with `['Safeway','Costco']`, unmatched store leaves `at`, terminal `"chicken at"` unchanged, prefix match `"milk at saf"→"milk @saf"`, case-insensitive `at` (`"milk AT safeway"→"milk @safeway"`), empty store list leaves `at`, existing `@` input unchanged.
  - combined/edge: `"two lbs chicken at Costco"→"2 lbs chicken @Costco"`, empty input returns `""`.

## Patterns Applying
- Realtime Mutation Tracking: No — feature is parser/input normalization only; no `list_items` writes or mutations.
- Household Guard: No — no inserts into household-scoped tables.
- Undo Registration: No — no shopping-list user mutation is introduced.

## Ambiguities / Questions
- None.
