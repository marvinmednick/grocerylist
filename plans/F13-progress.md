## Progress Log

### Files
- ✅ `client/api/list.ts` — added `warnings` and `master_item.short_name` to `ListItem`; updated shopping-list select join for `master_item:items!item_id(short_name)`
- ✅ `client/app/(tabs)/index.tsx` — switched shopping/planning rows to two-line layout with short-name precedence, inline metadata, warning-badge slot, and removed category/pencil columns
- ✅ `client/components/Toast.tsx` — added `variant` API with warning amber styles and variant-based default durations (4s warning, 3s default)
- ✅ `client/components/Settings.tsx` — added Warnings section with per-type segmented controls, defaults/profile hydration, and save payload persistence for `warning_preferences`
- ✅ `client/app/(tabs)/items.tsx` — added modal `Short Name (optional)` field, edit/create initialization, and save payload normalization to `short_name: shortName || null`
- ✅ `client/api/items.ts` — added nullable `short_name` to `MasterItem` and create/update mutation payload types
- ✅ `client/api/profile.ts` — exported `WarningPreferences`, added profile update support for `warning_preferences`, and added `useMyProfile` read hook including warning preferences
- ✅ `supabase/full_schema.sql` — added `profiles.warning_preferences`, `items.short_name`, and `list_items.warnings` columns in CREATE TABLE definitions
- ✅ `supabase/migrations/20250101000010_f13_display_warnings.sql` — created F13 migration adding `short_name`, `warnings`, and `warning_preferences` columns with defaults
- ✅ `client/components/WarningBadge.tsx` — created warning icon badge component with type-specific icons, detail-popover text templates, and outside-tap dismissal overlay
- ✅ `client/components/__tests__/WarningBadge-test.tsx` — added coverage for empty/undefined rendering, icon mapping, popover details, and outside-tap dismiss
- ✅ `client/components/__tests__/Toast-test.tsx` — added coverage for default/warning styles and variant default durations
- ✅ `client/app/(tabs)/__tests__/index-display-test.tsx` — added row density tests for two-line rendering, short-name behavior, warning badge presence, no pencil column, and strikethrough
- ✅ `client/components/__tests__/Settings-test.tsx` — added warnings section coverage, segmented option constraints, and profile-default selected state assertions
- ✅ `client/app/(tabs)/__tests__/items-test.tsx` — added short-name modal rendering/prefill/payload assertions
- ✅ `client/app/(tabs)/__tests__/index-interactions-test.tsx` — updated legacy expectation to match F13 removal of row pencil-icon column

### Issues
- None

### Status
Complete


### Update Entries
- ✅ `client/api/list.ts` completed: list query now returns warning payloads and short names for row rendering.
- ✅ `client/app/(tabs)/index.tsx` completed: rows now render name + metadata lines, with warning badge between text and drag handle.
- ✅ `client/components/Toast.tsx` completed: warning variant now applies amber appearance and 4000ms default timeout.
- ✅ `client/api/profile.ts` completed: warning preferences now flow through profile query/update API.
- ✅ `client/components/Settings.tsx` completed: warning preference controls now render and persist with profile saves.
- ✅ `client/api/items.ts` completed: API payloads now accept and persist `short_name`.
- ✅ `client/app/(tabs)/items.tsx` completed: modal now captures and submits optional short names for master items.
- ✅ `client/components/WarningBadge.tsx` completed: warning badges now render icons and dismissible popover details.
- ✅ `supabase/full_schema.sql` completed: full schema now includes all F13 warning/short-name columns.
- ✅ `supabase/migrations/20250101000010_f13_display_warnings.sql` completed: migration file created with the approved SQL changes.
- ✅ `client/components/__tests__/WarningBadge-test.tsx` completed: all required WarningBadge behaviors are covered.
- ✅ `client/components/__tests__/Toast-test.tsx` completed: toast variant styling and timeout defaults are covered.
- ✅ `client/app/(tabs)/__tests__/index-display-test.tsx` completed: shopping-list row display density behavior is validated.
- ✅ `client/components/__tests__/Settings-test.tsx` completed: warning settings UI/options/defaults are validated.
- ✅ `client/app/(tabs)/__tests__/items-test.tsx` completed: short-name modal and mutation payload behavior is validated.
- ✅ `client/components/Toast.tsx` adjusted: added `testID=\"toast-container\"` to support reliable style assertions in tests.
- ✅ `client/components/WarningBadge.tsx` adjusted: wrapped icons in testable views and aligned avoided-text template with spec punctuation.
- ✅ `client/components/__tests__/Toast-test.tsx` adjusted: now asserts styles via `toast-container` testID.
- ✅ `client/components/__tests__/WarningBadge-test.tsx` adjusted: now uses deterministic icon queries and updated avoided detail text assertion.
- ✅ `client/components/__tests__/Settings-test.tsx` adjusted: save payload expectation now includes `warning_preferences`; segment label assertions handle repeated labels.
- ✅ `client/app/(tabs)/__tests__/index-interactions-test.tsx` adjusted: removed stale expectation for deleted row pencil icon.
