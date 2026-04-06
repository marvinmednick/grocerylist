# F90 Feature Log

## 2026-04-05 — Specced (Phase A)
- **Spec:** `specs/F90-token-item-alias-system.md`
- **GitHub Issue:** #90
- **Review Level:** Full
- **Scope:** Phase A of Token & Item Alias System — database schema (word_aliases, abbreviation_suggestions, items.aliases, list_items.match_metadata), migrations, RLS, seed script, React Query hooks, parser token alias expansion step, item alias flattening in Pass 5, ParsedInput extensions (canonicalName, matchedVia), SmartAddItem integration. Phase B (UI) will be a separate spec.
- **Closes on ship:** #90

## 2026-04-06 — Review 1 (Passed)
- **Result:** Passed — no blocking issues remaining
- **Tests:** 436/436 passed
- **Fixes applied during review:**
  - Migration RLS policies: added `TO authenticated` to `word_aliases` and `abbreviation_suggestions` policies (fixed before `supabase db push`)
  - Vacuous test `'sets matchedVia to name for unmatched items'` rewritten to exercise actual parser code
  - `full_schema.sql` section 7 label corrected from "ITEMS (Master Database)" to "WORD ALIASES & ABBREVIATION SUGGESTIONS"
- **Non-blocking:** none remaining
