# Implementation Plan: F77 Fuzzy Matching in Smart Add

## Files to Modify

- `client/lib/vocabulary.ts` —
  1. **Add fuzzy fallback in existing lookup helpers** — in `lookupUnit`, `lookupPackage`, `lookupPackageEntry`, and `lookupSizeDescriptor`, keep existing exact lookup behavior first; when exact lookup returns `null`, run fuzzy matching across canonical values, aliases, and plural forms using `levenshteinDistance` from `client/lib/fuzzyMatch.ts`, and only accept the closest candidate within threshold.
  2. **Add new exported fuzzy lookup helpers** — add `fuzzyLookupUnit(token: string, vocabulary: Vocabulary)`, `fuzzyLookupPackageEntry(token: string, vocabulary: Vocabulary)`, and `fuzzyLookupSizeDescriptor(token: string, vocabulary: Vocabulary)` returning the same output types as the existing exact helpers.
  3. **Ensure:** existing exact lookup semantics remain unchanged; existing exports used by parser/tests continue working; no API hook/query/mutation logic is introduced.

- `client/lib/parser.ts` —
  1. **Wire fuzzy utility imports** — import `levenshteinDistance`, `editDistanceThreshold`, and `normalizePlural` from `client/lib/fuzzyMatch.ts`, plus `fuzzyLookupUnit`, `fuzzyLookupPackageEntry`, and `fuzzyLookupSizeDescriptor` from `client/lib/vocabulary.ts`.
  2. **Extend token classification fallback path** — in `classifyTokens`, after exact classification fails and before assigning `NAME`, run fuzzy lookups in required order: `unit -> package -> size descriptor`; first fuzzy match wins.
  3. **Add fuzzy/plural-aware token consumption** — replace/extend `consumeTokens` with a fuzzy-aware variant (`consumeTokensFuzzy`) that attempts, in order, (a) exact token match, (b) plural-normalized exact match (`normalizePlural`), (c) edit-distance fuzzy match within `editDistanceThreshold`; return `ConsumeResult` including `fuzzyCount`. **Important:** `fuzzyCount` counts only edit-distance matches. Plural-normalized matches count as exact (score 2), not fuzzy — they do NOT increment `fuzzyCount`.
  4. **Update name resolution pipeline** — in `resolveNames`, use the fuzzy-aware consume result, carry `fuzzyCount` into produced interpretations, and update dedup/preference logic to the score-based model.
  5. **Add fuzzy alias-key expansion fallback** — in `expandAliases`, when `wordAliases.get(word)` is undefined, scan alias keys linearly (20–100 keys) and select closest key within threshold by edit distance.
  6. **Add and export ranking score function** — implement/export `matchQualityScore(interpretation: ParsedInput)` with exact formula:
     `exactCount * 2 + interpretation.fuzzyCount * 1`, where `exactCount = splitName(interpretation.name).length - interpretation.orphans.length - interpretation.fuzzyCount`.
  7. **Update preference/sort functions** —
     - `isPreferredInterpretation`: compare score first, then lower `fuzzyCount`, then prefer `matchedVia === 'name'`.
     - `parseInputInternal` final sort: score descending, then name token count descending.
  8. **Extend parsed interpretation shape** — add `fuzzyCount: number` to `ParsedInput` (0 when all matches are exact or plural-normalized).
  9. **Ensure:** parser output shape remains otherwise compatible; existing parsing behavior for exact inputs remains intact; no React/UI/API changes are introduced in this file.

- `client/components/SmartAddItem.tsx` —
  1. **Upgrade prefix fallback matching tiers** — in `prefixFallbackInterpretations`, keep current exact prefix check (`word.startsWith(token)`) and add two fallback tiers when prefix fails: (a) plural-normalized prefix — `normalizePlural(word).startsWith(normalizePlural(token))`, (b) edit-distance match within threshold.
  2. **Track fuzzy usage in fallback results** — compute fuzzy/plural usage per fallback interpretation and set `fuzzyCount` on returned `ParsedInput` results. Only edit-distance matches increment `fuzzyCount`; plural-normalized prefix matches do not.
  3. **Replace 3-tier concat ranking with unified score sort** — merge parser and fallback interpretations, dedup by `matchedItemId` keeping highest-quality interpretation, then sort with `matchQualityScore` descending and name token count descending.
  4. **Ensure:** dropdown UI structure/rendering is unchanged (no new sections/dividers/visual states); `useSearchItems` remains untouched; only ranking/matching behavior changes.

- `client/lib/__tests__/vocabulary-test.ts` —
  1. **Extend with fuzzy vocabulary test cases** — add tests for `fuzzyLookupUnit`, `fuzzyLookupPackageEntry`, and `fuzzyLookupSizeDescriptor` with exact cases from spec:
     - `"ounze" -> "oz"`
     - `"poumd" -> "lb"` (via alias `"pound"`)
     - exact match still works
     - unrelated token returns `null`
     - `"botles" -> { canonical: "bottle", plural: "bottles" }`
     - `"bunc" -> { canonical: "bunch", plural: "bunches" }`
     - `"larg" -> "large"`
     - `"smal" -> "small"`
  2. **Ensure:** existing tests in this file are not modified and continue to pass unchanged.

- `client/components/__tests__/SmartAddItem-parser-test.tsx` —
  1. **Extend composition scenarios for fuzzy pipeline integration** — add the five required composition tests:
     - `"chicken rest boneless"` ranks `Chicken Breast Boneless Skinless` first
     - `"2 botles olive oil"` shows `Olive Oil` with parsed quantity/package semantics
     - `"chicken breasts"` matches `Chicken Breast`
     - `"chk"` fuzzy alias key matching with alias `"chkn" -> "chicken"` and no exact `"chk"`
     - exact-vs-fuzzy ranking case where exact interpretation ranks higher
  2. **Ensure:** tests use composition style (real parser, mocked data hooks only), and existing composition tests remain unchanged.

## New Files

- `client/lib/fuzzyMatch.ts` — pure utility module implementing:
  - `levenshteinDistance(a: string, b: string): number`
  - `editDistanceThreshold(wordLength: number): number` with rules:
    - `< 3 => 0`
    - `3-4 => 1`
    - `>= 5 => 2`
  - `isFuzzyMatch(a: string, b: string): boolean` (threshold based on shorter word length; both words must be length `>= 3`)
  - `bestFuzzyMatch(query: string, candidates: string[]): string | null` (smallest edit distance within threshold; tie-break by shorter candidate)
  - `normalizePlural(word: string): string` with ordered rules:
    - `-ies -> -y`
    - `-ves -> -f` (known grocery patterns)
    - `-es -> remove`
    - `-s -> remove`
    while preserving words where normalized output would be `< 3` chars.

- `client/lib/__tests__/fuzzyMatch-test.ts` — unit tests for all fuzzy utility functions. Individual test cases:
  - `levenshteinDistance: identical strings → 0`
  - `levenshteinDistance: single char difference → 1`
  - `levenshteinDistance: "chiken" vs "chicken" → 1`
  - `levenshteinDistance: "rest" vs "breast" → 1`
  - `levenshteinDistance: "botles" vs "bottle" → 2` (transposition)
  - `levenshteinDistance: completely different strings → high distance`
  - `editDistanceThreshold: word length 1-2 → 0`
  - `editDistanceThreshold: word length 3-4 → 1`
  - `editDistanceThreshold: word length 5+ → 2`
  - `isFuzzyMatch: "rest" vs "breast" → true (distance 1, len 4-6)`
  - `isFuzzyMatch: "abc" vs "xyz" → false (distance 3, exceeds threshold)`
  - `isFuzzyMatch: "be" vs "breast" → false (< 3 chars)`
  - `bestFuzzyMatch: finds closest match among candidates`
  - `bestFuzzyMatch: returns null when no candidate within threshold`
  - `bestFuzzyMatch: prefers shorter candidate on tie`
  - `normalizePlural: "breasts" → "breast"`
  - `normalizePlural: "tomatoes" → "tomato"`
  - `normalizePlural: "cherries" → "cherry"`
  - `normalizePlural: "loaves" → "loaf"`
  - `normalizePlural: "chicken" → "chicken" (no change)`
  - `normalizePlural: "us" → "us" (too short to normalize)`
  - `normalizePlural: "gas" → "gas" (would produce "ga", too short)`

- `client/lib/__tests__/parser-fuzzy-test.ts` — parser-focused unit tests for fuzzy matching. Individual test cases:
  - `resolveNames: fuzzy matches "rest" to "breast" in "Chicken Breast"` — assert matchedItemId present, orphans empty, fuzzyCount === 1
  - `resolveNames: plural-normalized "breasts" matches "Chicken Breast" with fuzzyCount 0` — plural normalization counts as exact, not fuzzy
  - `resolveNames: exact match scores higher than fuzzy match for same item` — provide both "chicken breast" (exact) and "chicken brest" (fuzzy), verify exact ranks first
  - `resolveNames: fuzzy match produces fewer orphans than no-fuzzy path` — "chicken rest boneless" against "Chicken Breast Boneless Skinless": 0 orphans, fuzzyCount=1
  - `resolveNames: short words (< 3 chars) are not fuzzy-matched` — "to" does not fuzzy-match "tomato"
  - `classifyTokens: "botles" fuzzy-matches "bottle" → PACKAGE` — verify classified token type is PACKAGE, not NAME
  - `classifyTokens: "ounze" fuzzy-matches "ounce" → UNIT`
  - `classifyTokens: "larg" fuzzy-matches "large" → SIZE_DESCRIPTIVE`
  - `classifyTokens: exact vocab match still takes priority over fuzzy` — "can" still classified as PACKAGE (exact), not fuzzy-matched to something else
  - `expandAliases: fuzzy alias key "chk" matches alias "chkn"→"chicken"` — verify expansion produces variant with "chicken"
  - `expandAliases: exact alias key still preferred over fuzzy` — "chk" has exact alias "chk"→"chicken" — no fuzzy scan needed
  - `parseInput: scoring ranks all-exact above mixed-fuzzy` — two items, one matched all-exact and one with 1 fuzzy token — exact first
  - `parseInput: scoring ranks mixed-fuzzy above orphan-heavy` — item with 0 orphans + 1 fuzzy beats item with 1 orphan + 0 fuzzy

## Patterns Applying
- Realtime Mutation Tracking: No — feature is parser/ranking read-path only; no `list_items` mutations.
- Household Guard: No — no inserts into household-scoped tables.
- Undo Registration: No — no user-initiated mutations are added/changed.

## Ambiguities / Questions
- None.
