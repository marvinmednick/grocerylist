# Implementation Plan: F99 Quick-Accept: Enter Key + Voice Trigger

## Files to Modify

- `supabase/full_schema.sql` —
  1. **Profiles column addition** — add `quick_accept_settings JSONB DEFAULT '{"trigger_word": "enter", "arming_delay_ms": 1500}',` to the `profiles` table definition immediately after `warning_preferences`, matching the spec's exact default payload.
  2. **Ensure:** keep all existing schema definitions, constraints, and ordering intact aside from this explicit column addition.

- `client/api/profile.ts` —
  1. **Quick Accept types/constants** — add `QuickAcceptSettings` with exact fields `trigger_word: string` and `arming_delay_ms: number`, plus `DEFAULT_QUICK_ACCEPT_SETTINGS` with exact defaults `'enter'` and `1500`.
  2. **Profile shape updates** — extend `MyProfile` with `quick_accept_settings: QuickAcceptSettings | null`.
  3. **Update payload updates** — extend `UpdateProfilePayload` with optional `quick_accept_settings?: QuickAcceptSettings`.
  4. **Mutation payload wiring** — update `useUpdateProfile` so `quick_accept_settings` is destructured and included in `.update()` exactly following the existing `warning_preferences` pattern.
  5. **Ensure:** preserve existing warning preference behavior, profile query behavior, and mutation return/invalidation patterns.

- `client/components/SmartAddItem.tsx` —
  1. **Hook/profile defaults wiring** — import `useQuickAcceptState` and `DEFAULT_QUICK_ACCEPT_SETTINGS`; derive `const quickAcceptSettings = myProfile?.quick_accept_settings ?? DEFAULT_QUICK_ACCEPT_SETTINGS;`.
  2. **Top-result accept action** — add `onAcceptTop` after `onOneOffAdd` with exact behavior: no-op on `query.trim().length === 0`; if `rankedInterpretations.length > 0` then inspect first interpretation, compute `topRowKey = getRowKey(topInterpretation, 0)`, fetch `fullItem` via `masterDetailsById.get(topInterpretation.matchedItemId)` when present, call `await onCommitAdd(fullItem, topInterpretation, topRowKey)` when found, otherwise fall through to `await onOneOffAdd()`.
  3. **State machine integration** — instantiate hook with exact options `{ triggerWord: quickAcceptSettings.trigger_word, armingDelayMs: quickAcceptSettings.arming_delay_ms, query, onAcceptTop }` and consume `isArmed`, `handleTextChange`, `handleSubmitEditing`.
  4. **TextInput behavior** — replace `onChangeText={setQuery}` with `onChangeText={(text) => setQuery(handleTextChange(text))}`; add `onSubmitEditing={handleSubmitEditing}` and `returnKeyType="done"`.
  5. **Clear-button reset path** — update X button handler to `setQuery(handleTextChange(''))` so timer is cleared and armed state resets.
  6. **Armed visual state on search bar** — apply `style={[styles.searchBar, isArmed && styles.searchBarArmed]}`.
  7. **Top-row highlighting** — in results map, apply `topResultHighlight` always for index `0`, and additionally `topResultArmed` for index `0` when armed.
  8. **Style additions** — add `topResultHighlight`, `topResultArmed`, and `searchBarArmed` with exact colors/border values from spec (`#eff6ff`, `#dbeafe`, `#2563eb`, `#bfdbfe`).
  9. **Ensure:** keep existing ranking/dedup behavior, add/undo wiring via `onCommitAdd`/`onOneOffAdd`, modal/edit behavior, and existing list interactions unchanged.

- `client/components/Settings.tsx` —
  1. **Type import** — import `type QuickAcceptSettings` and `DEFAULT_QUICK_ACCEPT_SETTINGS` from `@/api/profile`.
  2. **Local state** — add `triggerWord` and `armingDelay` state initialized from `DEFAULT_QUICK_ACCEPT_SETTINGS`.
  3. **Profile sync on open** — in existing visible-sync effect, set state from `myProfile?.quick_accept_settings` fallback to defaults.
  4. **Validation** — add `const triggerWordValid = /^[a-zA-Z]+$/.test(triggerWord);`.
  5. **Save payload extension** — include `quick_accept_settings` in `mutate` with exact transform/clamp behavior: `trigger_word: triggerWord.toLowerCase().trim()` and `arming_delay_ms: Math.max(500, Math.min(5000, parseInt(armingDelay, 10) || 1500))`.
  6. **UI section insertion** — add a `Quick Accept` section between existing `App` and `Warnings` sections with these exact elements:
     - `<Text style={styles.label}>Trigger Word</Text>` label before the trigger word input
     - `Trigger Word` `TextInput` with exact props: `testID="settings-trigger-word-input"`, `value={triggerWord}`, `onChangeText={setTriggerWord}`, `style={styles.input}`, `autoCapitalize="none"`, `autoCorrect={false}`, `placeholder="e.g. enter"`, `placeholderTextColor="#9ca3af"`
     - Invalid helper text `Must be a single word (letters only)` rendered with `styles.colorWarning` when `!triggerWordValid && triggerWord.length > 0`
     - `<Text style={styles.label}>Arming Delay (ms)</Text>` label before the arming delay input
     - `Arming Delay (ms)` numeric `TextInput` with exact props: `testID="settings-arming-delay-input"`, `value={armingDelay}`, `onChangeText={setArmingDelay}`, `style={styles.input}`, `keyboardType="numeric"`, `placeholder="1500"`, `placeholderTextColor="#9ca3af"`
     - Existing style tokens (`section`, `sectionTitle`, `label`, `input`, `colorWarning`) reused
  7. **Ensure:** preserve current settings modal safe-area/scroll behavior, existing profile fields save path, and existing warnings/dark mode controls.

## New Files

- `supabase/migrations/20250101000017_f99_quick_accept_settings.sql` — add migration:
  `ALTER TABLE profiles ADD COLUMN IF NOT EXISTS quick_accept_settings JSONB DEFAULT '{"trigger_word": "enter", "arming_delay_ms": 1500}';`

- `client/lib/useQuickAcceptState.ts` — implement Idle/Armed state machine hook with exact contract:
  - options: `triggerWord`, `armingDelayMs`, `query`, `onAcceptTop`
  - returns: `isArmed`, `handleTextChange`, `handleSubmitEditing`
  - behavior:
    1. clear existing timer on every `handleTextChange`
    2. if currently armed and last whitespace-delimited token equals trigger (case-insensitive), call `onAcceptTop`, disarm, and return `''`
    3. otherwise disarm, start timer only when `text.trim().length > 0`, arm after `armingDelayMs`
    4. `handleSubmitEditing` calls `onAcceptTop` only when `query.trim().length > 0`
    5. clear timer on unmount
  - implementation detail: use ref mirrors for state/read freshness (`isArmedRef` and fresh query read for submit path) to avoid stale closure behavior.

- `client/lib/__tests__/useQuickAcceptState-test.ts` — unit tests for all spec scenarios:
  1. starts idle
  2. arms after delay
  3. timer resets on each input change
  4. disarms on new input after armed
  5. submit calls accept when query non-empty
  6. submit no-op when query empty
  7. armed trigger-word last token calls accept
  8. armed trigger detection returns empty string
  9. trigger not detected while idle
  10. trigger match is case-insensitive
  11. substring last token does not match trigger
  12. empty text does not start timer
  13. unmount clears timer safely

- `client/components/__tests__/SmartAddItem-quickaccept-test.tsx` — SmartAddItem integration tests with full hook/mutation mocking pattern and fake timers:
  1. Enter adds top master match
  2. Enter adds one-off when no master match
  3. Enter no-op for empty query
  4. input clears after Enter add
  5. Always-on first-row highlight shown (`#eff6ff`): type "milk", wait for results, assert the first result row's style includes the `topResultHighlight` background color (`#eff6ff`), AND assert the second result row (when present) does NOT include the `topResultHighlight` style — explicit negative assertion required.
  6. armed styles after delay (`topResultArmed` + `searchBarArmed`)
  7. trigger-word typed while armed adds top result
  8. trigger-word typed while idle does not auto-add and remains literal text
  9. custom profile trigger word works
  10. X clear disarms and clears input
  - include `useMyProfile` mock coverage for `quick_accept_settings` defaults/custom values.

## Patterns Applying
- Realtime Mutation Tracking: No — no new `api/list.ts` mutations; quick accept routes through existing add handlers.
- Household Guard: No — no new insert mutation introduced in this feature scope.
- Undo Registration: No — inherited via existing `onCommitAdd` / `onOneOffAdd` paths that already register undo.

## Ambiguities / Questions
- None
