## Progress Log

### Files
- ✅ `client/lib/parser.ts` — extended parser types/signature for aliases, added `expandAliases`, added alias-aware name resolution, and deduped pooled variant interpretations by item with canonical preference at equal coverage.
- ✅ `client/api/items.ts` — added `aliases` to `MasterItemRef` and included `aliases` in `useMasterItemNames` select shape.
- ✅ `client/api/aliases.ts` — added hooks for word alias and abbreviation suggestion queries plus alias CRUD mutations with household guards and word_aliases invalidation.
- ✅ `client/api/list.ts` — added optional alias `match_metadata` typing for list inserts and list row shape.
- ✅ `client/components/SmartAddItem.tsx` — wired `useWordAliases` into `parseInput`, added alias-aware prefix fallback against canonical names and item aliases, and conditionally passed alias `match_metadata` in add flows.
- ✅ `supabase/migrations/20250101000016_f90_alias_system.sql` — added alias system schema objects: `word_aliases`, `abbreviation_suggestions`, `items.aliases`, and `list_items.match_metadata` with required indexes/RLS policies.
- ✅ `supabase/seeds/abbreviation_suggestions.sql` — added re-runnable curated abbreviation seed dataset with INSERT values and `ON CONFLICT DO NOTHING`.
- ✅ `supabase/full_schema.sql` — synced full schema with new alias tables/columns plus RLS enablement and policies.
- ✅ `client/lib/__tests__/parser-alias-test.ts` — added parser alias coverage for token expansion, canonical/alias resolution, deterministic canonical preference, and parsed output field checks.
- ✅ `client/api/__tests__/aliases-test.ts` — added hook tests for alias-map query behavior, household guards, and cache invalidation on create.
- ✅ `client/components/__tests__/SmartAddItem-alias-test.tsx` — added SmartAddItem integration tests for parser wiring, alias dropdown labels, metadata persistence, and alias-aware prefix fallback.

### Issues
- None

### Status
Complete
