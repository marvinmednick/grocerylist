# F44 Feature Log

## 2026-04-03 — Review 2 (Passed)
- **Result:** Passed — no blocking issues
- **Tests:** 326/326 passed
- **Note:** Prefix fallback added during review to fix runtime regression — partial-name input (e.g., "chick") never matched multi-word master items because bag-of-words requires exact token set equality. Fix uses parser-extracted name tokens + word-level prefix matching, activated only when parser finds no exact interpretations. 7 new tests cover this path.
- **Non-blocking:** `MasterItemRef` duplicate in parser.ts + api/items.ts; `formatCount` no-op branch; `@co` multi-store test case missing; edit modal behaviors untested; two trailing whitespace chars

## 2026-04-03 — Specced
- **Spec:** `specs/F44-freeform-input-parsing.md`
- **GitHub Issue:** #44
- **Review Level:** Full
- **Scope:** Multi-pass parser (6 passes) that extracts item name, count, package type, size, and store hint from free-form text input. Integrates into SmartAddItem to pre-select qty pills and show store pills. Establishes in-memory vocabulary constants (units, packages, size descriptors) that F79 will move to household-scoped DB tables.
- **Closes on ship:** #44
