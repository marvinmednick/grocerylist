## Progress Log

### Files
- ✅ `supabase/migrations/20250101000014_f79_quantity_units_system.sql` — Added F79 migration: dropped legacy units schema usage, created household-scoped vocabulary tables/policies, added quantity JSONB columns, and seeded defaults for all households.
- ✅ `supabase/full_schema.sql` — Replaced legacy units schema with household-scoped vocabulary tables, removed deprecated unit FK columns, added parsed quantity columns, updated RLS policies, and aligned seed data with F79 defaults.
- ✅ `client/api/vocabulary.ts` — Added household-scoped vocabulary query and CRUD/reset hooks with required household guard, table scoping, default reset mapping, and vocabulary query invalidation.
- ✅ `client/components/SmartAddItem.tsx` — Switched parser vocabulary source to `useVocabulary()` with `DEFAULT_VOCABULARY` fallback while preserving existing parser/UI flow.
- ✅ `client/components/UserAvatar.tsx` — Renamed menu item to `General`, inserted `Sizes & Packages` action between General and Sign Out, and mounted `SizesAndPackages` modal state/rendering.
- ✅ `client/components/Settings.tsx` — Updated modal title text from `Settings` to `General` only.
- ✅ `client/components/SizesAndPackages.tsx` — Added full-screen modal drill-down with three nav rows, close action, active screen switching, and safe-area top padding.
- ✅ `client/components/VocabularyManagement.tsx` — Added per-type vocabulary management UI with list, add/edit dialog, alias chip editing, inline delete confirm, and inline reset-to-defaults confirm using vocabulary hooks.
- ✅ `client/app/auth.tsx` — Added household vocabulary seeding helper using `DEFAULT_VOCABULARY` and invoked it after new profile creation in multi-household mode.
- ✅ `client/components/__tests__/UserAvatar-test.tsx` — Extended avatar menu coverage for `General` label, `Sizes & Packages` visibility, and modal-opening behavior for both menu actions.
- ✅ `client/components/__tests__/SmartAddItem-parser-test.tsx` — Added parser integration coverage for hook-provided custom vocabulary and fallback-to-default vocabulary behavior.
- ✅ `client/components/__tests__/SizesAndPackages-test.tsx` — Added drill-down modal tests for menu rows, per-type navigation, back navigation, and close actions from menu/management screens.
- ✅ `client/components/__tests__/VocabularyManagement-test.tsx` — Added CRUD/reset/alias-management UI tests including dialog state, inline confirmations, and save-disable behavior.
- ✅ `client/api/__tests__/vocabulary-test.ts` — Added hook tests for vocabulary query config, household guards, CRUD/reset query shapes, reset ordering, seed payloads, and invalidation.
- ✅ `client/components/__tests__/SmartAddItem-test.tsx` — Added `useVocabulary` mock to keep existing SmartAddItem tests isolated from React Query provider requirements.
- ✅ `client/app/(tabs)/__tests__/index-display-test.tsx` — Added `useVocabulary` mock to prevent extra async query updates from SmartAddItem during screen rendering tests.
- ✅ `client/app/(tabs)/__tests__/index-f2-test.tsx` — Added `useVocabulary` mock to prevent SmartAddItem query side effects in end-trip behavior tests.
- ✅ `client/components/__tests__/VocabularyManagement-test.tsx` — Tightened assertions for duplicate alias text and disabled state lookup to match rendered element structure.
- ✅ `client/components/__tests__/VocabularyManagement-test.tsx` — Adjusted alias-removal assertion to account for the remaining list-row alias text after chip removal.

### Issues
- None

### Status
Complete
