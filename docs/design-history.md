# Design History

Running log of architectural and design decisions — what changed, when, why, and what principle it generalizes to. For current state, see `DESIGN.md`, `CODING.md`, and `docs/design/ui-guidelines.md`.

Updated via `/design-review` at the end of each workflow step that produces a design decision or change.

---

## 2026-03-23 — Overlay pattern: Modal replaces absolute-positioned popover (source: F22)

**Changed**: `WarningBadge.tsx` — replaced inline popover using absolute positioning with hardcoded -300px offsets with a `<Modal>` component using `animationType="fade"` and `transparent` backdrop.

**Replaces**: Absolute-positioned `<View>` overlay with hardcoded pixel offsets (the pre-F22 approach also present in `UserAvatar.tsx` at the time).

**Why**: Absolute positioning with hardcoded offsets breaks with parent containers using `overflow: hidden`, causes z-index conflicts with other overlays, and can be displaced by keyboard-open state. Modal sidesteps all three issues.

**Generalized principle**: Absolute-positioned overlays with hardcoded px offsets are fragile. Any overlay dialog (popover, detail card, menu) should use `<Modal>` with a transparent backdrop instead.

**Scope applied**: WarningBadge fixed in F22. UserAvatar absolute-positioned menu overlay identified and fixed in the same session (the menu `<View>` was also converted to `<Pressable>` to stop tap-through).

**Codified in**: CODING.md §7 (Modal/Full-Screen View Requirements, point 4 — nested Pressable pattern)

---

## 2026-03-23 — Nested Pressable for overlay modal backdrop/card separation (source: F22)

**Changed**: Established pattern for overlay dialogs with a tappable backdrop: outer `<Pressable>` (backdrop, `onPress={onClose}`) wrapping inner `<Pressable>` (card, `onPress={e => e.stopPropagation()}`).

**Replaces**: Using a plain `<View>` as the modal card container, which allows taps on static content inside the card to bubble up to the backdrop and close the modal unexpectedly.

**Why**: A `<View>` has no tap handling — taps on text or non-interactive content inside it bubble to the outer Pressable, closing the modal unintentionally. The inner `<Pressable>` with `stopPropagation()` prevents this without requiring `onPress` on every child.

**Generalized principle**: For any transparent modal with a dimmed backdrop: outer Pressable = backdrop close, inner Pressable = card with stopPropagation. Applies to alert dialogs, detail popovers, and any center/overlay dialog.

**Scope applied**: Applied to WarningBadge modal in F22. Does not apply to slide-up form modals that fill the screen (those don't have a separate backdrop layer).

**Codified in**: CODING.md §7 point 4

---

## 2026-03-23 — FlatList and DraggableFlatList must be synchronously mocked in tests (source: flaky test fix during F21)

**Changed**: Added synchronous mocks for `FlatList` and `react-native-draggable-flatlist` in `client/jest.setup.js`.

**Replaces**: Relying on the real React Native FlatList implementation in tests, which uses `VirtualizedList` internally. `VirtualizedList._updateCellsToRender` schedules a `setTimeout` that fires after the test's assertion phase, outside `act()`. The `console.error` this produces is converted to a thrown error by jest.setup.js's `console.error` fail policy.

**Why**: The setTimeout fires outside `act()` non-deterministically, causing intermittent test failures (228–230/230 pass). Mocking both components with synchronous renderers eliminates the timer entirely.

**Generalized principle**: Any component that uses React Native's `VirtualizedList` under the hood (FlatList, SectionList, DraggableFlatList) must be mocked synchronously in Jest tests to prevent out-of-act() timer failures.

**Scope applied**: Both mocks added to jest.setup.js, applying globally to all tests. `DraggableFlatList` also required mocking because it wraps FlatList and its `ScaleDecorator` uses `CellProvider` context provided by FlatList internals.

**Codified in**: `client/jest.setup.js` (the mocks are the implementation)

---

## 2026-04-06 — No stacked native modals + flush pending sub-inputs on Save (source: #93 bug fix)

**Changed**: Added two new modal rules to ui-guidelines.md (§7d, §7e), CODING.md §7 (points 5-6), and the §7c compliance checklist.

**Problem 1 — Stacked modals**: `items.tsx` opened the Abbreviations `<Modal>` while the edit item `<Modal>` was still visible. iOS silently drops the second modal, so "Define Abbreviations" did nothing on iOS.

**Problem 2 — Data loss on Save**: The alias `TextInput` inside the edit modal committed only via `onSubmitEditing`. The `onBlur` handler cleared the input, so tapping Save (which triggers blur before the save handler) lost the typed alias.

**Generalized principles**:
1. Never present a second `<Modal>` while one is active — close first, open second, use a resume flag to restore on return.
2. `handleSave` must flush all pending sub-inputs (alias chips, tag editors, inline add fields) before building the payload. `onBlur` must not destructively clear uncommitted user input.

**Codified in**: `docs/design/ui-guidelines.md` §7c checklist, §7d, §7e; `CODING.md` §7 points 5-6; Decision Log entries

---

## 2026-04-20 — Bottom-anchored dialog + uniform choice buttons + passive "on list" indicator (source: F78)

**Changed**: Three new UI patterns established by `DuplicateResolutionDialog` and the SmartAddItem dropdown.

**Pattern 1 — Bottom-anchored contextual dialog**: `DuplicateResolutionDialog` uses `justifyContent: 'flex-end'` instead of `'center'`. Card slides up from the bottom, keeping the list and search bar visible behind the dimmed backdrop so the user retains context while choosing.
**Replaces**: Centered modal (still default for form/edit modals — bottom-anchored is specifically for quick-decision dialogs where surrounding context matters).
**Generalized principle**: When the dialog requires the user to assess surrounding screen content to make a choice, anchor it to the bottom rather than center.

**Pattern 2 — Uniform button styling for 4+ choice dialogs**: All resolution actions (Combine options, Add New, Custom) use identical gray-100 background / dark text buttons. Cancel is text-only. Position and grouping provide hierarchy; color does not.
**Replaces**: Primary/secondary button distinction (filled primary + outlined secondary), which is appropriate when one action is objectively correct.
**Generalized principle**: When the right choice depends on user intent rather than a clear "best" action, uniform button weight avoids misleading visual hierarchy.

**Pattern 3 — Passive "on list" indicator**: SmartAddItem dropdown shows muted gray `#9ca3af` "on list" text on the right side of result rows for items already on the active list. Single state regardless of active vs. purchased.
**Replaces**: No prior indicator — items already on list showed identically to items not on list.
**Generalized principle**: Search results that can have list-state context should expose it passively (no badge, no color, minimal footprint) rather than blocking or re-routing the add flow.

**Scope applied**: All three patterns applied in F78; centered modal remains the default for all other dialogs.
**Codified in**: `docs/design/ui-guidelines.md` (3 new entries: bottom-anchored dialog modal, uniform button styling for choice dialogs, "on list" passive indicator)
