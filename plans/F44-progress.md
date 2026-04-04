## Progress Log

### Files
- ✅ `client/lib/vocabulary.ts` — added vocabulary interfaces, seed constants, case-insensitive lookup helpers, and plural resolver
- ✅ `client/lib/parser.ts` — implemented all parser passes, exported interfaces, and fixed quoted-token name resolution by splitting NAME tokens into bag-of-words components
- ✅ `client/lib/quantityFormat.ts` — added quantity formatter, parser-backed quantity equality, partial-match helper, and adjusted implied-count behavior for size+package formatting
- ✅ `client/api/items.ts` — added `useMasterItemNames` query and invalidation updates for create/update mutations
- ✅ `client/components/SmartAddItem.tsx` — switched to parser-driven rows, added orphan/store-hint/qty parsing UI, inline Other editor, and hint-aware edit modal defaults
- ✅ `client/lib/__tests__/parser-test.ts` — added parser pass coverage and end-to-end parse cases from spec
- ✅ `client/lib/__tests__/vocabulary-test.ts` — added vocabulary helper tests
- ✅ `client/lib/__tests__/quantityFormat-test.ts` — added formatting/equality/prefix-match quantity tests
- ✅ `client/components/__tests__/SmartAddItem-parser-test.tsx` — added parser integration tests and updated orphan assertion for multiple interpretation rows
- ✅ `client/components/__tests__/SmartAddItem-test.tsx` — migrated existing SmartAddItem tests to parser-era item hooks (`useMasterItemNames` + `useAllItems`)

### Issues
- None

### Status
Complete
