# F77 Feature Log

## 2026-04-06 — Designed
- **Design doc:** `docs/design/F77-fuzzy-matching.md`
- **Scope:** Token-level fuzzy matching integrated into parser pipeline — edit distance on name words, vocab tokens, and alias keys; plural normalization; match quality scoring (exact=2, fuzzy=1, orphan=0). No dropdown UI changes.
- **Key decisions:** Single ranked list (dropped two-section dropdown). Fuzzy matching at word level, not item level. Plural normalization runs before edit distance.

## 2026-04-06 — Specced
- **Spec:** `specs/F77-fuzzy-matching.md`
- **GitHub Issue:** #77
- **Review Level:** Full
- **Scope:** New `fuzzyMatch.ts` utility, fuzzy fallbacks in vocabulary lookups and alias expansion, updated `resolveNames` and `consumeTokens` in parser, updated SmartAddItem merge ranking. No UI changes.
- **Closes on ship:** #77

## 2026-04-06 — Review 1 (Passed)
- **Result:** Passed — no blocking issues
- **Tests:** 506/506 passed
- **Non-blocking:** `bestFuzzyMatch` exported from `fuzzyMatch.ts` but unused in production code — (found in F77 review)
- **Implementation notes:** Implementor added `localAlignmentDistance` (relaxed Levenshtein for length-delta=2) to meet spec requirement of `"rest" vs "breast" → 1`. Vocabulary lookups use `levenshteinDistanceStrict` with first-char guards to prevent false positives — both are sound refinements.
