# F99 — Quick-Accept: Enter Key + Voice Trigger

> **Design:** [docs/design/F99-quick-accept.md](../docs/design/F99-quick-accept.md)
> **Issue:** [#99](https://github.com/marvinmednick/grocerylist/issues/99)
> **Closes on ship:** #99

## Overview

Add two accelerated ways to accept the top-ranked result in SmartAddItem's dropdown: (1) pressing Enter/Return on the keyboard, and (2) speaking a configurable trigger word after the system "arms" (input settles). Both fire the same action as tapping the top result row.

## Acceptance Criteria

1. **Enter key** — pressing Enter/Return on the search TextInput adds the top-ranked master-item result (or one-off if no master matches). Works immediately regardless of armed state. No-op when query is empty.
2. **Armed state** — after `armingDelayMs` of input inactivity, the system enters Armed state. Visual: search box background shifts to `#eff6ff` (blue-50), top result row shifts to `#dbeafe` (blue-100) with 3px left border `#2563eb` (blue-600).
3. **Always-on highlight** — the first result row always has a subtle background `#eff6ff` (blue-50), regardless of armed state.
4. **Voice trigger** — when Armed and the last whitespace-delimited token of new input matches the trigger word (case-insensitive), the trigger word is stripped and the top result is added. If not Armed, the trigger word stays as literal search text.
5. **Timer reset** — every input change resets the arming timer and disarms.
6. **Settings** — trigger word (default: "enter", single word, letters only) and arming delay (default: 1500ms, range 500–5000) configurable in Settings, persisted to `profiles.quick_accept_settings` (synced across devices).
7. **Undo** — all adds via Enter/trigger go through existing `onCommitAdd`/`onOneOffAdd`, so undo/redo works automatically.

## Files to Modify

### New Files

| File | Purpose |
|------|---------|
| `supabase/migrations/20250101000017_f99_quick_accept_settings.sql` | Add `quick_accept_settings` JSONB column to `profiles` |
| `client/lib/useQuickAcceptState.ts` | Idle/Armed state machine hook |
| `client/lib/__tests__/useQuickAcceptState-test.ts` | Hook unit tests |
| `client/components/__tests__/SmartAddItem-quickaccept-test.tsx` | Integration tests |

### Modified Files

| File | Changes |
|------|---------|
| `supabase/full_schema.sql` | Add `quick_accept_settings` column to `profiles` table definition |
| `client/api/profile.ts` | Add `QuickAcceptSettings` interface, extend `MyProfile` and `UpdateProfilePayload` |
| `client/components/SmartAddItem.tsx` | Integrate hook, add `onAcceptTop`, wire `onSubmitEditing`, apply visual styles |
| `client/components/Settings.tsx` | Add "Quick Accept" settings section |

---

## Implementation Details

### 1. Database Migration

**File:** `supabase/migrations/20250101000017_f99_quick_accept_settings.sql`

```sql
-- F99: Quick-Accept settings (Enter key + voice trigger)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS quick_accept_settings JSONB
  DEFAULT '{"trigger_word": "enter", "arming_delay_ms": 1500}';
```

**File:** `supabase/full_schema.sql` — add after `warning_preferences` (line ~25):

```sql
quick_accept_settings JSONB DEFAULT '{"trigger_word": "enter", "arming_delay_ms": 1500}',
```

No RLS changes needed — existing profile policies cover read/update on the row.

### 2. Profile API

**File:** `client/api/profile.ts`

Add after `WarningPreferences` interface (line ~17):

```typescript
export interface QuickAcceptSettings {
  trigger_word: string;
  arming_delay_ms: number;
}

export const DEFAULT_QUICK_ACCEPT_SETTINGS: QuickAcceptSettings = {
  trigger_word: 'enter',
  arming_delay_ms: 1500,
};
```

Extend `MyProfile`:
```typescript
quick_accept_settings: QuickAcceptSettings | null;
```

Extend `UpdateProfilePayload`:
```typescript
quick_accept_settings?: QuickAcceptSettings;
```

Update `useUpdateProfile` — add `quick_accept_settings` to the destructured params and the `.update()` call (follows the exact same pattern as `warning_preferences`).

### 3. State Machine Hook

**File:** `client/lib/useQuickAcceptState.ts`

```typescript
import { useEffect, useRef, useState } from 'react';

interface UseQuickAcceptStateOptions {
  triggerWord: string;
  armingDelayMs: number;
  query: string;
  onAcceptTop: () => void;
}

interface UseQuickAcceptStateReturn {
  isArmed: boolean;
  handleTextChange: (text: string) => string;
  handleSubmitEditing: () => void;
}
```

**State:** `isArmed` boolean via `useState`, timer via `useRef<ReturnType<typeof setTimeout> | null>`.

**`handleTextChange(text: string) → string`:**
1. Clear any existing timer.
2. If `isArmed` is `true`:
   - Split `text` on whitespace. Get last token.
   - If last token matches `triggerWord` (case-insensitive, compare via `.toLowerCase()`):
     - Call `onAcceptTop()`.
     - Set `isArmed = false`.
     - Return `''` (empty — `clearAndClose` inside the add handler will also clear the query).
3. Set `isArmed = false`.
4. If `text.trim().length > 0`:
   - Start new timer for `armingDelayMs`. On expiry: set `isArmed = true`.
5. Return `text` unchanged.

**`handleSubmitEditing()`:**
1. If `query.trim().length === 0`: return (no-op).
2. Call `onAcceptTop()`.

**Cleanup:** `useEffect` with empty deps returning a function that clears the timer on unmount.

**Important implementation note:** The `isArmed` state read inside `handleTextChange` must use a ref mirror (e.g., `isArmedRef.current`) to avoid stale closure issues, since `handleTextChange` is called from `onChangeText` which may close over an old `isArmed` value. Pattern:

```typescript
const [isArmed, setIsArmed] = useState(false);
const isArmedRef = useRef(false);
// Keep ref in sync:
useEffect(() => { isArmedRef.current = isArmed; }, [isArmed]);
// In handleTextChange, read isArmedRef.current instead of isArmed
```

Similarly, `query` for the empty check in `handleSubmitEditing` should use a ref or be passed as a parameter.

### 4. SmartAddItem Integration

**File:** `client/components/SmartAddItem.tsx`

**a) Imports** — add at top:
```typescript
import { useQuickAcceptState } from '@/lib/useQuickAcceptState';
import { DEFAULT_QUICK_ACCEPT_SETTINGS } from '@/api/profile';
```

**b) Read settings** — after `myProfile` (near line 136):
```typescript
const quickAcceptSettings = myProfile?.quick_accept_settings ?? DEFAULT_QUICK_ACCEPT_SETTINGS;
```

**c) `onAcceptTop` function** — place after `onOneOffAdd` (around line 467). Regular async function (not `useCallback` — matches existing handler pattern in this file):

```typescript
const onAcceptTop = async () => {
  if (query.trim().length === 0) return;
  if (rankedInterpretations.length > 0) {
    const topInterpretation = rankedInterpretations[0];
    const topRowKey = getRowKey(topInterpretation, 0);
    const fullItem = topInterpretation.matchedItemId
      ? masterDetailsById.get(topInterpretation.matchedItemId)
      : null;
    if (fullItem) {
      await onCommitAdd(fullItem, topInterpretation, topRowKey);
      return;
    }
  }
  await onOneOffAdd();
};
```

Both `onCommitAdd` and `onOneOffAdd` already call `clearAndClose()` internally and register undo actions.

**d) Hook instantiation** — after `onAcceptTop`:
```typescript
const { isArmed, handleTextChange, handleSubmitEditing } = useQuickAcceptState({
  triggerWord: quickAcceptSettings.trigger_word,
  armingDelayMs: quickAcceptSettings.arming_delay_ms,
  query,
  onAcceptTop,
});
```

**e) TextInput changes** (line ~655):

Replace:
```tsx
onChangeText={setQuery}
```
With:
```tsx
onChangeText={(text) => setQuery(handleTextChange(text))}
onSubmitEditing={handleSubmitEditing}
returnKeyType="done"
```

**f) Search bar armed style** (line ~653):

Replace:
```tsx
<View style={styles.searchBar}>
```
With:
```tsx
<View style={[styles.searchBar, isArmed && styles.searchBarArmed]}>
```

**g) Top result highlight** — in the `rankedInterpretations.map` (line ~728):

Replace:
```tsx
<View key={rowKey} style={styles.resultRowComplex}>
```
With:
```tsx
<View key={rowKey} style={[
  styles.resultRowComplex,
  index === 0 && styles.topResultHighlight,
  index === 0 && isArmed && styles.topResultArmed,
]}>
```

**h) X clear button** (line ~664) — also reset armed state:

Replace:
```tsx
<TouchableOpacity onPress={() => setQuery('')} style={styles.clearBtn}>
```
With:
```tsx
<TouchableOpacity onPress={() => setQuery(handleTextChange(''))} style={styles.clearBtn}>
```

This ensures the hook clears the timer and disarms when the user taps X.

### 5. Style Additions

**File:** `client/components/SmartAddItem.tsx` — add to `StyleSheet.create()`:

```typescript
topResultHighlight: {
  backgroundColor: '#eff6ff',       // blue-50 — always on for first result
},
topResultArmed: {
  backgroundColor: '#dbeafe',       // blue-100 — replaces blue-50 when armed
  borderLeftWidth: 3,
  borderLeftColor: '#2563eb',       // blue-600
},
searchBarArmed: {
  backgroundColor: '#eff6ff',       // blue-50 — replaces gray-100 (#f3f4f6) when armed
  borderColor: '#bfdbfe',           // blue-200 — subtle border shift to reinforce state
},
```

### 6. Settings UI

**File:** `client/components/Settings.tsx`

**a) Import:**
```typescript
import { type QuickAcceptSettings, DEFAULT_QUICK_ACCEPT_SETTINGS } from '@/api/profile';
```

**b) State** — add after `warningPrefs` state (line ~81):
```typescript
const [triggerWord, setTriggerWord] = useState(DEFAULT_QUICK_ACCEPT_SETTINGS.trigger_word);
const [armingDelay, setArmingDelay] = useState(String(DEFAULT_QUICK_ACCEPT_SETTINGS.arming_delay_ms));
```

**c) Sync from profile** — add to the `useEffect` that syncs on `visible` (line ~83):
```typescript
setTriggerWord(myProfile?.quick_accept_settings?.trigger_word ?? DEFAULT_QUICK_ACCEPT_SETTINGS.trigger_word);
setArmingDelay(String(myProfile?.quick_accept_settings?.arming_delay_ms ?? DEFAULT_QUICK_ACCEPT_SETTINGS.arming_delay_ms));
```

**d) Validation:**
```typescript
const triggerWordValid = /^[a-zA-Z]+$/.test(triggerWord);
```

**e) Update `handleSave`** (line ~97) — add `quick_accept_settings` to the `mutate` call:
```typescript
const handleSave = () => {
  mutate({
    display_name: nameInput,
    display_name_short: shortNameInput,
    color: selectedColor,
    warning_preferences: warningPrefs,
    quick_accept_settings: {
      trigger_word: triggerWord.toLowerCase().trim(),
      arming_delay_ms: Math.max(500, Math.min(5000, parseInt(armingDelay, 10) || 1500)),
    },
  });
};
```

**f) UI section** — add between the "App" section (Dark Mode) and the "Warnings" section. Insert after line ~177 (closing `</View>` of App section):

```tsx
<View style={styles.section}>
  <Text style={styles.sectionTitle}>Quick Accept</Text>

  <Text style={styles.label}>Trigger Word</Text>
  <TextInput
    testID="settings-trigger-word-input"
    value={triggerWord}
    onChangeText={setTriggerWord}
    style={styles.input}
    autoCapitalize="none"
    autoCorrect={false}
    placeholder="e.g. enter"
    placeholderTextColor="#9ca3af"
  />
  {!triggerWordValid && triggerWord.length > 0 && (
    <Text style={styles.colorWarning}>Must be a single word (letters only)</Text>
  )}

  <Text style={styles.label}>Arming Delay (ms)</Text>
  <TextInput
    testID="settings-arming-delay-input"
    value={armingDelay}
    onChangeText={setArmingDelay}
    style={styles.input}
    keyboardType="numeric"
    placeholder="1500"
    placeholderTextColor="#9ca3af"
  />
</View>
```

Uses existing styles: `section`, `sectionTitle`, `label`, `input`, `colorWarning`. No new styles needed for the Settings section.

---

## Edge Cases

| Case | Behavior |
|------|----------|
| Empty query + Enter | No-op (guard at top of `onAcceptTop`) |
| Query is only the trigger word (e.g., "enter") | Results were computed from "enter" as search text; trigger fires with whatever the top result was; query clears |
| Voice says "chicken enter" all at once (no pause) | Timer never fires before "enter" arrives → Idle → "enter" stays as literal text |
| Keyboard types e-n-t-e-r letter by letter | Each letter disarms; use the Enter key instead |
| X clear button while armed | `handleTextChange('')` clears timer, disarms |
| Edit modal open + Enter pressed | `onSubmitEditing` is only on the main search TextInput; modal TextInputs are separate |
| Trigger word appears mid-text (not last token) | Not matched — only the last whitespace-delimited token is checked |
| `rankedInterpretations[0]` has no `matchedItemId` in `masterDetailsById` | Falls through to `onOneOffAdd()` — same as if there were no master matches |

---

## Tests to Write

### Hook Unit Tests

**File:** `client/lib/__tests__/useQuickAcceptState-test.ts`

Use `renderHook` from `@testing-library/react-hooks` (or `@testing-library/react-native`). Use `jest.useFakeTimers()` for timer control.

1. **`it('starts in idle state')`** — render hook, assert `isArmed` is `false`.

2. **`it('transitions to armed after delay expires')`** — call `handleTextChange('milk')`, advance timers by `armingDelayMs`, assert `isArmed` is `true`.

3. **`it('resets timer on each handleTextChange call')`** — call `handleTextChange('mi')`, advance 1000ms, call `handleTextChange('mil')`, advance 1000ms (2000ms total but only 1000ms since last input), assert `isArmed` is `false`. Advance remaining 500ms, assert `isArmed` is `true`.

4. **`it('disarms on new input after being armed')`** — arm the hook (text + advance timer), then call `handleTextChange('milk 2')`, assert `isArmed` is `false`.

5. **`it('calls onAcceptTop on handleSubmitEditing when query is non-empty')`** — provide `query: 'milk'`, call `handleSubmitEditing`, assert `onAcceptTop` was called once.

6. **`it('does not call onAcceptTop on handleSubmitEditing when query is empty')`** — provide `query: ''`, call `handleSubmitEditing`, assert `onAcceptTop` was not called.

7. **`it('detects trigger word as last token when armed and calls onAcceptTop')`** — arm the hook, then call `handleTextChange('milk enter')`, assert `onAcceptTop` was called.

8. **`it('returns empty string when trigger word is detected')`** — arm the hook, call `const result = handleTextChange('milk enter')`, assert `result === ''`.

9. **`it('does not detect trigger word when not armed')`** — call `handleTextChange('milk enter')` without arming, assert `onAcceptTop` was not called, assert returned text is `'milk enter'`.

10. **`it('matches trigger word case-insensitively')`** — arm the hook, call `handleTextChange('milk ENTER')`, assert `onAcceptTop` was called.

11. **`it('does not match trigger word as substring of last token')`** — arm the hook, call `handleTextChange('milk center')`, assert `onAcceptTop` was not called.

12. **`it('does not start timer when text is empty')`** — call `handleTextChange('')`, advance timers by 5000ms, assert `isArmed` is `false`.

13. **`it('clears timer on unmount')`** — render hook, call `handleTextChange('milk')`, unmount, advance timers, assert no errors and `isArmed` was not set to `true`.

### SmartAddItem Integration Tests

**File:** `client/components/__tests__/SmartAddItem-quickaccept-test.tsx`

Follow the mock setup pattern from `SmartAddItem-test.tsx` — mock all hooks (`useAllItems`, `useAddToList`, `useMetadata`, `useUndo`, `useMyProfile`, etc.), use `setItems()` helper, use `jest.useFakeTimers()`.

Add `useMyProfile` mock to include `quick_accept_settings`:
```typescript
mockUseMyProfile.mockReturnValue({
  data: {
    warning_preferences: { /* ... defaults ... */ },
    quick_accept_settings: { trigger_word: 'enter', arming_delay_ms: 1500 },
  },
});
```

14. **`it('adds top master item result when Enter is pressed')`** — type "milk", fire `onSubmitEditing` on the search input, assert `addItem` was called with `expect.objectContaining({ name: 'Milk', item_id: 'master-1' })`.

15. **`it('adds one-off item when Enter is pressed and no master matches')`** — type "xyzzy" (no matching items), fire `onSubmitEditing`, assert `addItem` was called with `expect.objectContaining({ name: 'xyzzy', item_id: null })`.

16. **`it('does not add when Enter is pressed with empty query')`** — fire `onSubmitEditing` without typing, assert `addItem` was not called.

17. **`it('clears input after Enter adds item')`** — type "milk", fire `onSubmitEditing`, await, assert input value is `''`.

18. **`it('shows always-on highlight on the first result row')`** — type "milk", wait for results, query the first result row's style — assert it includes the `topResultHighlight` background color (`#eff6ff`). The second result row (if any) should not have it.

19. **`it('shows armed highlight on top result and search bar after delay')`** — type "milk", advance timers by 1500ms, assert: first result row has `topResultArmed` background (`#dbeafe`), search bar has `searchBarArmed` background (`#eff6ff`).

20. **`it('fires add when trigger word is typed while armed')`** — type "milk", advance timers past arming delay, then change text to "milk enter", assert `addItem` was called with Milk.

21. **`it('does not fire trigger when not armed')`** — type "milk enter" in one step (no timer advance), assert `addItem` was not called, assert input shows "milk enter".

22. **`it('uses custom trigger word from profile settings')`** — mock `useMyProfile` with `quick_accept_settings: { trigger_word: 'go', arming_delay_ms: 1500 }`, type "milk", advance timer, type "milk go", assert `addItem` was called.

23. **`it('X clear button disarms')`** — type "milk", advance timer (armed), press X clear button, assert input is empty and search bar does not have armed style.

---

## Patterns Checklist

| Pattern | Applies? | How |
|---------|----------|-----|
| Realtime mutation tracking | No | No new mutations — reuses existing `onCommitAdd`/`onOneOffAdd` |
| Household guard | No | No new mutations |
| Undo registration | No (inherited) | `onCommitAdd`/`onOneOffAdd` already register undo |
| React Query invalidation | No | No new mutations |
| Platform-specific dialogs | No | No alerts |
| StyleSheet.create() | Yes | All new styles in SmartAddItem's stylesheet |
| Safe area insets | No | No new modals |

---

## Implementation Commands

### Gemini

```bash
GEMINI_FLASH=gemini-2.5-flash-preview-05-20 && \
gemini-cli --model $GEMINI_FLASH \
  "Read AGENT.md and CODING.md first. Then read specs/F99-quick-accept.md and implement all changes described. Start with the migration, then profile API, then the hook, then SmartAddItem integration, then Settings UI, then tests." \
  --files AGENT.md CODING.md specs/F99-quick-accept.md \
  supabase/migrations/20250101000017_f99_quick_accept_settings.sql \
  supabase/full_schema.sql \
  client/api/profile.ts \
  client/lib/useQuickAcceptState.ts \
  client/components/SmartAddItem.tsx \
  client/components/Settings.tsx \
  client/lib/__tests__/useQuickAcceptState-test.ts \
  client/components/__tests__/SmartAddItem-quickaccept-test.tsx \
  client/components/__tests__/SmartAddItem-test.tsx \
  docs/design/F99-quick-accept.md
```

### aider

```bash
aider \
  supabase/full_schema.sql \
  client/api/profile.ts \
  client/lib/useQuickAcceptState.ts \
  client/components/SmartAddItem.tsx \
  client/components/Settings.tsx \
  client/lib/__tests__/useQuickAcceptState-test.ts \
  client/components/__tests__/SmartAddItem-quickaccept-test.tsx \
  --read AGENT.md CODING.md specs/F99-quick-accept.md docs/design/F99-quick-accept.md \
  --read client/components/__tests__/SmartAddItem-test.tsx \
  --message "Implement F99 per specs/F99-quick-accept.md. Create the migration file supabase/migrations/20250101000017_f99_quick_accept_settings.sql. Follow all patterns in CODING.md."
```

### Copy-paste (manual)

Key files to create:
1. `supabase/migrations/20250101000017_f99_quick_accept_settings.sql`
2. `client/lib/useQuickAcceptState.ts`
3. `client/lib/__tests__/useQuickAcceptState-test.ts`
4. `client/components/__tests__/SmartAddItem-quickaccept-test.tsx`

Key files to modify:
1. `supabase/full_schema.sql` — add column to profiles
2. `client/api/profile.ts` — add QuickAcceptSettings type + extend payload
3. `client/components/SmartAddItem.tsx` — integrate hook + styles
4. `client/components/Settings.tsx` — add Quick Accept section
