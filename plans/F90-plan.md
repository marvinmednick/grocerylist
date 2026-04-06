# Implementation Plan: F90 Token & Item Alias System — Phase A (Data + Parser)

## Files to Modify

- `client/lib/parser.ts` —
  1. **Extend parser interfaces and function signature** — add `aliases: string[]` to `MasterItemRef`; add `canonicalName: string` and `matchedVia: 'name' | 'alias'` to `ParsedInput`; extend `parseInput` signature to `parseInput(input, vocabulary, masterItems, wordAliases?)` where `wordAliases` is optional and defaults to an empty `Map`.
  2. **Add `expandAliases(candidate, wordAliases)`** — implement alias expansion over `candidate.nameWords` using alias lookup by `word.toLowerCase()` and produce cartesian variants (original + expanded token per expandable word); return `[candidate]` unchanged when no token aliases match.
  3. **Extend `resolveNames` to include item aliases** — flatten each `MasterItemRef` into lookup entries for canonical name first, then each alias, using fields `{ id, lookupName, canonicalName, matchedVia, default_qty, alternate_qtys }`; preserve deterministic canonical-preferred behavior at equal coverage by ordering canonical entries before alias entries.
  4. **Update parse pipeline with alias variants and result selection** — call `expandAliases` after `assembleCandidate`, run `resolveNames` for each variant, pool interpretations, dedup by `matchedItemId` while preferring fewer orphans and canonical over alias at equal coverage, then keep existing ranking behavior.
  5. **Set new fields in unmatched/fallback parser outputs** — whenever `matchedItemId === null`, ensure `canonicalName: name` and `matchedVia: 'name'` are populated.
  6. **Ensure:** keep tokenization/classification pass behavior unchanged (especially vocabulary Pass 2 precedence, e.g. `can` as PACKAGE), keep backwards compatibility when `wordAliases` is omitted, and do not change `Vocabulary`/`DEFAULT_VOCABULARY`.

- `client/api/items.ts` —
  1. **Keep `MasterItemRef` in sync with parser copy** — add `aliases: string[]`.
  2. **Expand select shape for master item names** — change `useMasterItemNames` select string to exactly `'id, name, default_qty, alternate_qtys, aliases'`.
  3. **Ensure:** keep existing query key (`['master_item_names']`), ordering, and invalidation behavior unchanged.

- `client/api/list.ts` —
  1. **Extend insert payload type** — add optional `match_metadata?: { matchedName: string; canonicalName: string; matchedVia: 'alias' } | null` to `ListItemInsert`.
  2. **Extend list item row type** — add optional `match_metadata?: { matchedName: string; canonicalName: string; matchedVia: 'alias' } | null` to `ListItem`.
  3. **Ensure:** do not change current list query `.select('* ...')` behavior, mutation flow, household guard, undo integration, or realtime mutation tracking wrappers.

- `client/components/SmartAddItem.tsx` —
  1. **Wire word aliases into parsing** — import and call `useWordAliases`, defaulting to `new Map<string, string>()` while query data is unavailable, and pass aliases as the 4th argument to `parseInput` in `parseResult` memo.
  2. **Upgrade prefix fallback matching** — expand typed name tokens with token aliases before prefix checks; for each token, match on original and expanded forms; evaluate prefixes against canonical item words and each entry in `item.aliases`; for alias hits, set interpretation `name` to alias text, `canonicalName` to item canonical name, `matchedVia: 'alias'`; for canonical hits set `matchedVia: 'name'` and `name === canonicalName`.
  3. **Populate alias match metadata on add flows** — in all four `addItem` call sites, include `match_metadata: { matchedName: interpretation.name, canonicalName: interpretation.canonicalName, matchedVia: 'alias' }` only when `interpretation.matchedVia === 'alias'`; omit for canonical matches.
  4. **Fill new fields on unmatched fallback interpretations** — ensure fallback interpretations always set `canonicalName: name` and `matchedVia: 'name'`.
  5. **Ensure:** keep existing dropdown rendering path (`interpretation.name`), undo registration behavior, and add/edit interaction flows intact.

- `supabase/full_schema.sql` —
  1. **Add F90 schema objects and columns** — include `word_aliases` table (with household scoping columns/indexes/policy), `abbreviation_suggestions` table with select-readable policy, `items.aliases TEXT[] NOT NULL DEFAULT '{}'`, and `list_items.match_metadata JSONB`.
  2. **Ensure:** keep all existing non-F90 schema, policies, and seed content unchanged.

## New Files

- `client/api/aliases.ts` — React Query hooks for alias data:
  - `useWordAliases`: query `word_aliases` with exact shape/order:
    `supabase.from('word_aliases').select('id, alias, canonical').eq('household_id', householdId).order('canonical')`
    return `Map<string, string>` alias→canonical; query key `['word_aliases', householdId]`; `staleTime: 5 * 60 * 1000`; enabled only when `householdId` is truthy.
  - `useAbbreviationSuggestions`: query
    `supabase.from('abbreviation_suggestions').select('word, suggestion').order('word')`
    return `Map<string, string[]>`; query key `['abbreviation_suggestions']`; `staleTime: Infinity`; read-only, on-demand.
  - `useCreateWordAlias`: household guard (`if (!householdId) throw new Error('No household ID found')`), insert payload exactly `{ household_id: householdId, alias: alias.toLowerCase().trim(), canonical: canonical.toLowerCase().trim(), created_by: userId }`, invalidate `['word_aliases']`.
  - `useUpdateWordAlias`: update `word_aliases` row, invalidate `['word_aliases']`.
  - `useDeleteWordAlias`: household guard + household-scoped delete, invalidate `['word_aliases']`.

- `supabase/migrations/20250101000016_f90_alias_system.sql` — migration implementing exactly:
  - `word_aliases` table, unique index `(household_id, LOWER(alias))`, household index, RLS enabled, policy `"Users can access their household's word aliases"` with `USING (household_id = get_my_household_id())`.
  - `abbreviation_suggestions` table `(word, suggestion)` PK, RLS enabled, policy `"Anyone can read abbreviation suggestions"` for `SELECT USING (true)`.
  - `ALTER TABLE items ADD COLUMN aliases TEXT[] NOT NULL DEFAULT '{}';`
  - `ALTER TABLE list_items ADD COLUMN match_metadata JSONB;`

- `supabase/seeds/abbreviation_suggestions.sql` — re-runnable seed data file:
  - add top SQL comment noting dataset is curated for common grocery abbreviations.
  - use `INSERT ... ON CONFLICT DO NOTHING`.
  - populate ~200–300 words and ~400–500 `(word, suggestion)` pairs, covering proteins, produce, dairy, bakery, preparations/qualifiers, modifiers, and other common grocery words listed in spec.

- `client/lib/__tests__/parser-alias-test.ts` — parser alias test suite with required cases:
  - `expandAliases returns single variant when no aliases match`
  - `expandAliases returns 2 variants for one expandable token`
  - `expandAliases returns 4 variants for two expandable tokens`
  - `expandAliases ignores tokens not in alias map`
  - `expands token alias and matches master item`
  - `composes multiple token aliases`
  - `partial expansion produces results with orphans`
  - `backward compatible — no wordAliases arg works like before`
  - `matches item via alias name`
  - `matches item via canonical name when both exist`
  - `prefers canonical match over alias match at equal coverage`
  - `token expansion applies to item alias words`
  - `sets canonicalName to master item name for all matches`
  - `sets matchedVia to name for unmatched items`
  Required mocks/setup: inline test vocabulary/master items fixtures; no network/supabase mocks needed.

- `client/api/__tests__/aliases-test.ts` — alias hook tests with required cases:
  - `useWordAliases returns empty map when no aliases exist`
  - `useWordAliases builds alias→canonical map from query results`
  - `useCreateWordAlias throws when householdId is null`
  - `useDeleteWordAlias throws when householdId is null`
  - `useCreateWordAlias invalidates word_aliases query key`
  Required mocks/setup: `@/lib/supabase` chain mocks (`from/select/eq/order/insert/update/delete/select/single` as needed), household context mock (`useHousehold`), auth/user mock if mutation payload includes `created_by`, per-test `QueryClient` wrapper with `gcTime: Infinity`.

- `client/components/__tests__/SmartAddItem-alias-test.tsx` — SmartAddItem alias integration tests with required cases:
  - `passes wordAliases to parseInput and shows expanded results`
  - `shows alias-matched item name in dropdown`
  - `includes match_metadata when adding alias-matched item`
  - `omits match_metadata when adding canonical-matched item`
  - `prefix fallback expands aliases before matching`
  - `prefix fallback matches against item aliases`
  Required mocks/setup: mock `useWordAliases`, `useMasterItemNames`, and list add mutation hook(s) used by SmartAddItem; provide React Query + Undo + Household providers in test wrapper; mock parser output only where isolation is needed.

## Patterns Applying
- Realtime Mutation Tracking: No — no new realtime-subscribed table mutations are introduced; `word_aliases` is not realtime-subscribed and `list_items` tracking wrappers already exist.
- Household Guard: Yes — all `word_aliases` mutations must enforce `if (!householdId) throw new Error('No household ID found')`.
- Undo Registration: No — alias CRUD is settings/vocabulary configuration and explicitly excluded from undo; existing SmartAddItem undo behavior remains unchanged.

## Ambiguities / Questions
- None.
