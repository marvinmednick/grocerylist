# F100 — Voice Trigger Word: Android Streaming Dictation Fix

> **Issue:** [#100](https://github.com/marvinmednick/grocerylist/issues/100)
> **Closes on ship:** #100
> **Parent feature:** F99

## Overview

On Android, voice dictation streams partial text updates (e.g., `"\nPop"` → `"\nPopcorn"`) rather than delivering the final word atomically. The quick-accept state machine disarms on the first partial token, so the full trigger word is missed. Additionally, "enter" (the current default) is intercepted by Android's IME as a key action, producing newlines instead of literal text.

## Root Cause

In `useQuickAcceptState.ts`, `handleTextChange` unconditionally calls `setArmed(false)` (line 86) when the last token doesn't exactly match the trigger word. With streaming dictation:

1. Armed state is active, user says "popcorn" (trigger word)
2. First partial arrives: `"\nPop"` → last token `"pop"` ≠ `"popcorn"` → **disarms**
3. Full word arrives: `"\nPopcorn"` → last token `"popcorn"` = trigger, but **no longer armed**

## Changes

### 1. Prefix Tolerance in State Machine

**File:** `client/lib/useQuickAcceptState.ts`

In `handleTextChange`, after the trigger-word match check (line 77–84) and before the unconditional disarm (line 86), add a prefix check:

```typescript
// After the existing trigger match block (lines 77-84)...

const isPrefixOfTrigger =
  normalizedTrigger.length > 0 &&
  lastToken.length > 0 &&
  normalizedTrigger.startsWith(lastToken);

if (isArmedBefore && isPrefixOfTrigger) {
  debugLog('stay_armed_prefix', { text, lastToken, triggerWord: normalizedTrigger });
  prevTextRef.current = text;
  return text;
}

// Existing disarm logic continues below...
setArmed(false);
```

**Behavior:** When armed and the last token is a prefix of the trigger word (e.g., "pop" is a prefix of "popcorn"), stay armed and return the text unchanged. The timer is already cleared at the top of `handleTextChange`, and no new timer is scheduled — the system just waits for the next update to complete the word.

**Edge case — "pop" as real input:** If the user genuinely types "pop" as an item while armed, the system stays armed briefly. On the next input change (any non-prefix text), it disarms normally. If no further input comes, the user is still armed but the trigger never fires — no incorrect add.

### 2. Default Trigger Word Change

**File:** `client/api/profile.ts`

Change the default trigger word from `'enter'` to `'done'`:

```typescript
export const DEFAULT_QUICK_ACCEPT_SETTINGS: QuickAcceptSettings = {
  trigger_word: 'done',     // was 'enter' — Android IME intercepts "enter" as key action
  arming_delay_ms: 1500,
};
```

**File:** `supabase/migrations/20250101000018_f100_default_trigger_word.sql` (new)

```sql
-- F100: Change default trigger word from "enter" to "done"
-- Update existing rows that still have the original default
UPDATE profiles
SET quick_accept_settings = jsonb_set(
  quick_accept_settings,
  '{trigger_word}',
  '"done"'
)
WHERE quick_accept_settings->>'trigger_word' = 'enter';

-- Update column default for new profiles
ALTER TABLE profiles
ALTER COLUMN quick_accept_settings
SET DEFAULT '{"trigger_word": "done", "arming_delay_ms": 1500}';
```

**File:** `supabase/full_schema.sql`

Update the `profiles` table default:

```sql
quick_accept_settings JSONB DEFAULT '{"trigger_word": "done", "arming_delay_ms": 1500}',
```

### 3. Settings UI — IME Warning Hint

**File:** `client/components/Settings.tsx`

Below the trigger word input and its existing validation message, add a hint:

```tsx
<Text style={styles.helperText}>
  Avoid "enter", "tab", "delete" — Android voice may interpret these as key actions.
</Text>
```

Add `helperText` style (if it doesn't already exist):

```typescript
helperText: {
  fontSize: 12,
  color: '#6b7280',   // gray-500
  marginTop: 2,
  marginBottom: 8,
},
```

---

## Files to Modify

| File | Change |
|------|--------|
| `client/lib/useQuickAcceptState.ts` | Add prefix tolerance when armed |
| `client/api/profile.ts` | Default trigger word → `'done'` |
| `supabase/migrations/20250101000018_f100_default_trigger_word.sql` | **New** — migrate existing defaults, update column default |
| `supabase/full_schema.sql` | Update default in schema |
| `client/components/Settings.tsx` | Add IME warning hint text + `helperText` style |
| `client/lib/__tests__/useQuickAcceptState-test.ts` | Add streaming dictation tests |

---

## Tests to Write

**File:** `client/lib/__tests__/useQuickAcceptState-test.ts`

Add these tests to the existing test suite:

1. **`it('stays armed when last token is a prefix of trigger word')`** — arm the hook (type "milk", advance timer). Call `handleTextChange('milk pop')` where trigger word is "popcorn". Assert `isArmed` is still `true`.

2. **`it('accepts trigger after prefix partial arrives (streaming dictation)')`** — arm the hook. Call `handleTextChange('milk pop')` (prefix — stays armed). Then call `handleTextChange('milk popcorn')` (full match). Assert `onAcceptTop` was called and return value is `''`.

3. **`it('disarms after prefix when non-prefix text follows')`** — arm the hook. Call `handleTextChange('milk pop')` (prefix — stays armed). Then call `handleTextChange('milk popular')` (not a prefix, not a match). Assert `isArmed` is `false` and `onAcceptTop` was not called.

4. **`it('handles leading newlines in streaming dictation')`** — arm the hook. Call `handleTextChange('milk \npopcorn')` with trigger word "popcorn". Assert `onAcceptTop` was called (the `\n` is handled by existing `split(/\s+/)` tokenization since `\s` matches newlines).

5. **`it('prefix check is case-insensitive')`** — arm the hook with trigger word "Popcorn". Call `handleTextChange('milk Pop')`. Assert `isArmed` is still `true`. Then call `handleTextChange('milk POPCORN')`. Assert `onAcceptTop` was called.

6. **`it('single-character prefix keeps armed')`** — arm the hook with trigger word "done". Call `handleTextChange('milk d')`. Assert `isArmed` is still `true`.

7. **`it('does not stay armed for prefix when not already armed')`** — without arming, call `handleTextChange('milk pop')` with trigger "popcorn". Assert `isArmed` is `false` (prefix check only applies when already armed).

All tests use the existing `renderHook` + `jest.useFakeTimers()` pattern already in the file. For tests needing trigger word "popcorn", pass `triggerWord: 'popcorn'` in the hook options.

---

## Patterns Checklist

| Pattern | Applies? | How |
|---------|----------|-----|
| Household guard | No | No new mutations |
| Undo registration | No | No behavior change to add flow |
| StyleSheet.create() | Yes | `helperText` style in Settings |
| DB migration | Yes | Default trigger word change |

---

## Implementation Commands

### Gemini

```bash
GEMINI_FLASH=gemini-2.5-flash-preview-05-20 && \
gemini-cli --model $GEMINI_FLASH \
  "Read AGENT.md and CODING.md first. Then read specs/F100-voice-trigger-android-fix.md and implement all changes described. The key change is in useQuickAcceptState.ts — add prefix tolerance. Also update the default trigger word and add tests." \
  --files AGENT.md CODING.md specs/F100-voice-trigger-android-fix.md \
  client/lib/useQuickAcceptState.ts \
  client/lib/__tests__/useQuickAcceptState-test.ts \
  client/api/profile.ts \
  client/components/Settings.tsx \
  supabase/full_schema.sql \
  supabase/migrations/20250101000018_f100_default_trigger_word.sql
```

### aider

```bash
aider \
  client/lib/useQuickAcceptState.ts \
  client/lib/__tests__/useQuickAcceptState-test.ts \
  client/api/profile.ts \
  client/components/Settings.tsx \
  supabase/full_schema.sql \
  --read AGENT.md CODING.md specs/F100-voice-trigger-android-fix.md \
  --message "Implement F100 per specs/F100-voice-trigger-android-fix.md. Create migration file supabase/migrations/20250101000018_f100_default_trigger_word.sql. Follow all patterns in CODING.md."
```
