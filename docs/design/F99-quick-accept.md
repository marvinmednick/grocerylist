# Design: Quick-Accept — Enter Key + Voice Trigger
<!-- ID: F99 | Status: Designed -->

## Overview

SmartAddItem's search dropdown currently requires tapping a result row to add it. F99 adds two accelerated paths: (1) pressing Enter/Return on the keyboard immediately adds the top-ranked result, and (2) speaking a configurable trigger word after a pause ("armed" state) adds the top-ranked result. This improves voice-typing workflows where tapping is awkward and speeds up keyboard-driven entry.

## User Scenarios

- **Voice-typing user:** Says "two pounds chicken", pauses, sees Chicken Breast highlighted as top result, says "enter" → item added without touching the screen.
- **Keyboard user:** Types "milk", sees Milk as top result, presses Enter → item added without reaching for the dropdown.
- **One-off item:** Types "dragonfruit" (no master match), presses Enter → one-off item added with current qty.
- **Fast talker:** Says "two pounds chicken enter" all at once (no pause) → "enter" stays as literal text in search bar, no add fires. User sees results, pauses, then says "enter" to confirm.

## Design Decisions

### Settings storage — `profiles` table (synced)
**Decision:** Add `quick_accept_settings` JSONB column to `profiles` with defaults `{"trigger_word": "enter", "arming_delay_ms": 1500}`.
**Rationale:** Users with multiple devices benefit from synced settings. The arming delay and trigger word are personal preferences that should follow the user. Low risk — same pattern as `warning_preferences`.
**Alternatives considered:** AsyncStorage (client-only, simpler, no migration) — rejected because multi-device sync is worth the small migration cost. Hybrid (delay in AsyncStorage, trigger word in profiles) — unnecessary complexity.

### Top-ranked result definition
**Decision:** Index 0 of `rankedInterpretations` (merged parser + prefix fallback results, sorted by match quality score). When no master-item results exist, the one-off "Add" row is the top result.
**Rationale:** Matches exactly what the user sees in the dropdown — the first row is what gets added.

### Programmatic add — reuse existing handlers
**Decision:** Quick-accept calls `onCommitAdd(item, interpretation, rowKey)` for master items or `onOneOffAdd()` for one-off items. No new mutation logic.
**Rationale:** Both handlers already manage undo/redo registration, warning computation, household scoping, and `clearAndClose()`. Reusing them ensures behavioral parity with tapping a row.

### Trigger word detection — SmartAddItem level
**Decision:** Detection happens in the `onChangeText` flow within SmartAddItem, using simple whitespace splitting on the raw query to check the last token. Not in the parser or normalizeVoiceInput.
**Rationale:** The trigger word is a UI-level concern — it depends on armed state and causes a side-effect (firing the add). The parser is a pure function that shouldn't know about UI state. A separate utility function was considered but the logic is simple enough (last whitespace-delimited token comparison) that extraction would be premature.

### State machine — Idle/Armed with timer
**Decision:**
```
Idle  ──(timer expires)──▶  Armed
  ▲                           │
  │   input changes           │  input changes + last token = trigger
  │   (reset timer)           │  → strip trigger, fire add
  └───────────────────────────┘

Enter key (any state) → fire add immediately
```

- Timer resets on every `onChangeText`.
- Armed state only reached after `armingDelayMs` of input inactivity.
- Trigger word only fires when Armed — if spoken before arming, stays as literal text.
- Enter key bypasses arming entirely — immediate add.

**Rationale:** The arming delay gives the user time to see and confirm what they're about to accept. The two-path design (Enter for keyboard, trigger word for voice) matches the input modalities — keyboard users have a physical key, voice users need a spoken equivalent.

**Voice keyboard behavior (verified):** iOS dictation and Android voice keyboard deliver text as complete words/phrases to `onChangeText`, not character-by-character. The trigger word arrives atomically in a single event, so detection while Armed works reliably. Keyboard users typing the trigger word letter-by-letter would disarm on each keystroke — but they should use the Enter key instead.

### Enter key — `returnKeyType="done"`
**Decision:** Use `returnKeyType="done"` on the search TextInput, with `onSubmitEditing` wired to fire the add.
**Rationale:** Cross-platform safe. "Add" is not a valid `returnKeyType` option on iOS. "Done" is familiar and unambiguous. The visual highlight on the top result makes the meaning clear.

### Visual highlight — two-tier system (new pattern)
**Decision:**
- **Always-on:** Top result row gets subtle background `#eff6ff` (blue-50) — signals "this is what Enter would add"
- **Armed:** Top result row shifts to `#dbeafe` (blue-100) with `3px` left border in `#2563eb` (blue-600) — signals "trigger word will now fire"
- **Search box:** Background shifts from white to `#eff6ff` (blue-50) when armed — draws attention to state change at the input, where the user is looking

**Rationale:** The search box is where attention naturally sits during input, making it the most intuitive place for the armed indicator. The top result highlight is continuous (always knows what would be added) while the search box color is state-dependent (armed vs not). Separating the two signals avoids ambiguity.

**New pattern — update ui-guidelines.md:** Pre-selected/highlighted dropdown row with two visual tiers. Armed-state search box background tint.

### Trigger word constraints
**Decision:** Must be a single word — letters only, no spaces or punctuation. Case-insensitive matching. Configurable in Settings (default: "enter").
**Rationale:** Single-word constraint ensures reliable whitespace-delimited detection. Letters-only prevents accidental matches with punctuation or numbers in quantity input.

### Hook architecture
**Decision:** Extract state machine into `client/lib/useQuickAcceptState.ts` custom hook, consumed by SmartAddItem.
**Rationale:** Separates timer/state logic from the already-large SmartAddItem component. Enables isolated unit testing of the state machine. Follows the project's pattern of placing custom hooks in `client/lib/` (e.g., `household.tsx`, `theme.tsx`).

## Out of Scope

- Multiple trigger words or trigger phrases
- Voice-specific APIs (e.g., `@react-native-voice/voice`) — relies on standard TextInput `onChangeText`
- Trigger word for actions other than "add top result" (e.g., "delete", "undo")
- Arming animation or pulse effects — may revisit if static tint is insufficient feedback

## Open Questions

None — all design decisions are resolved. Ready for `/spec`.
