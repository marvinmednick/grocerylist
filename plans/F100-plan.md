# Implementation Plan: F100 Voice Trigger Word: Android Streaming Dictation Fix

## Files to Modify

- `client/lib/useQuickAcceptState.ts` —
  1. **Add Prefix Tolerance While Armed** — in `handleTextChange`, keep the existing exact trigger-word match block first, then insert:
     `const isPrefixOfTrigger = normalizedTrigger.length > 0 && lastToken.length > 0 && normalizedTrigger.startsWith(lastToken);`
     and when `isArmedBefore && isPrefixOfTrigger`, call `debugLog('stay_armed_prefix', { text, lastToken, triggerWord: normalizedTrigger });`, set `prevTextRef.current = text`, and `return text` before the existing unconditional disarm path.
  2. **Preserve Existing Timer/Flow Behavior** — rely on the existing timer clear at the top of `handleTextChange` and do not schedule a new timer in the prefix path; state machine waits for the next text update.
  3. **Ensure:** keep existing exact trigger acceptance behavior, disarm behavior for non-prefix/non-match updates, tokenization semantics (including newline handling via whitespace split), and callback/return contracts unchanged.

- `client/api/profile.ts` —
  1. **Update App-Level Default Trigger Word** — change `DEFAULT_QUICK_ACCEPT_SETTINGS.trigger_word` from `'enter'` to `'done'` while keeping `arming_delay_ms: 1500`.
  2. **Ensure:** keep `QuickAcceptSettings` shape, exports, and non-trigger default values unchanged.

- `supabase/full_schema.sql` —
  1. **Update Profiles Default JSONB** — change `profiles.quick_accept_settings` default from `{"trigger_word": "enter", "arming_delay_ms": 1500}` to `{"trigger_word": "done", "arming_delay_ms": 1500}`.
  2. **Ensure:** keep table structure, non-related defaults, constraints, and SQL formatting/patterns intact.

- `client/components/Settings.tsx` —
  1. **Add IME Warning Hint Under Trigger Input** — render helper text directly below the trigger word input and existing validation message:
     `Avoid "enter", "tab", "delete" — Android voice may interpret these as key actions.`
  2. **Add/Use `helperText` Style** — ensure a `StyleSheet.create()` style entry with:
     `fontSize: 12`, `color: '#6b7280'`, `marginTop: 2`, `marginBottom: 8`.
  3. **Ensure:** keep existing settings validation rules, save behavior, modal layout/safe-area/scroll behavior, and all unrelated Settings UI behavior unchanged.

- `client/lib/__tests__/useQuickAcceptState-test.ts` —
  1. **Add Prefix-Armed Persistence Test** — `it('stays armed when last token is a prefix of trigger word')`: arm first, then `handleTextChange('milk pop')` with trigger `'popcorn'`, assert `isArmed === true`.
  2. **Add Streaming Partial->Full Acceptance Test** — `it('accepts trigger after prefix partial arrives (streaming dictation)')`: armed -> `'milk pop'` then `'milk popcorn'`, assert `onAcceptTop` called and return value `''`.
  3. **Add Prefix Then Non-Prefix Disarm Test** — `it('disarms after prefix when non-prefix text follows')`: armed -> `'milk pop'` then `'milk popular'`, assert `isArmed === false` and `onAcceptTop` not called.
  4. **Add Leading Newline Streaming Test** — `it('handles leading newlines in streaming dictation')`: armed -> `'milk \npopcorn'`, assert accept callback called.
  5. **Add Case-Insensitive Prefix/Match Test** — `it('prefix check is case-insensitive')`: trigger `'Popcorn'`, input `'milk Pop'` keeps armed, then `'milk POPCORN'` accepts.
  6. **Add Single-Character Prefix Test** — `it('single-character prefix keeps armed')`: trigger `'done'`, input `'milk d'` keeps armed.
  7. **Add Not-Armed Prefix Guard Test** — `it('does not stay armed for prefix when not already armed')`: input `'milk pop'` with trigger `'popcorn'` without arming first, assert `isArmed === false`.
  8. **Ensure:** keep existing fake timer setup (`jest.useFakeTimers()`), existing `renderHook` harness, and pre-existing test scenarios/assertions unchanged.

## New Files

- `supabase/migrations/20250101000018_f100_default_trigger_word.sql` — migrate existing `profiles.quick_accept_settings->>'trigger_word' = 'enter'` rows to `"done"` via `jsonb_set`, then `ALTER TABLE profiles ALTER COLUMN quick_accept_settings SET DEFAULT '{"trigger_word": "done", "arming_delay_ms": 1500}'`.

## Patterns Applying
- Realtime Mutation Tracking: No — no `list_items` mutation logic changes.
- Household Guard: No — no insert mutations are added/changed.
- Undo Registration: No — no shopping-list user mutation flow changes.

## Ambiguities / Questions
- None
