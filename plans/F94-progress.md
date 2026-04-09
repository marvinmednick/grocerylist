## Progress Log

### Files
- ✅ `client/lib/parser.ts` — Added `normalizeVoiceInput` with word-to-number normalization and `at`→`@` store hint normalization using store-name prefix matching.
- ✅ `client/components/SmartAddItem.tsx` — Normalized query via `normalizeVoiceInput` before `parseInput` and `tokenize`, and preserved original query for one-off `rawInput`.
- ✅ `client/lib/__tests__/parser-test.ts` — Added `parseInput` integration tests that normalize voice input before parsing for count/package and store-hint extraction.
- ✅ `client/components/__tests__/SmartAddItem-parser-test.tsx` — Added parser composition tests for `"milk at Safeway"` store pills and `"two milk"` quantity pill rendering.
- ✅ `client/lib/__tests__/normalizeVoiceInput-test.ts` — Added unit coverage for word-number mappings, `at`→`@` store hints, prefix/case rules, and combined edge cases.

### Issues
- None

### Status
Complete

### Entries
- Completed `client/lib/parser.ts`: exported `normalizeVoiceInput`, added module-level voice word-number lookup, and applied two-pass normalization without changing parse pipeline signatures.
- Completed `client/components/SmartAddItem.tsx`: added `storeNamesList` memo, normalized parser inputs in `parseResult`/`parseCandidate`, and kept one-off row text bound to original user query.
- Completed `client/lib/__tests__/parser-test.ts`: added normalization + parse integration coverage for `"two cans chicken broth"` and `"milk at safeway"` flows.
- Completed `client/components/__tests__/SmartAddItem-parser-test.tsx`: added voice normalization composition coverage for `"milk at Safeway"` store hint conversion and `"two milk"` qty extraction.
- Completed `client/lib/__tests__/normalizeVoiceInput-test.ts`: added full normalization unit matrix for mapped words, store hints, and combined edge behavior.
- Updated `client/components/__tests__/SmartAddItem-parser-test.tsx`: fixed voice-qty test to target a row-specific test ID and avoid ambiguous duplicate `"Qty: "` labels.
