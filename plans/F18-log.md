# F18 Feature Log

## 2026-03-22 — Specced

- **Spec:** `specs/F18-warning-system-improvements.md`
- **GitHub Issue:** #70
- **Review Level:** Full
- **Scope:** Three improvements to the warning system: (1) deduplicate the `Warning` type by removing the local copy from `WarningBadge.tsx` and importing from `api/items`; (2) show inline `WarningCallout` in the Add Detail modal and List Edit modal so users see active warnings before committing an add or edit; (3) fire a `variant='warning'` toast after any add where the user's `warning_preferences` specifies `toast_and_badge` for the triggered warning type.
- **Closes on ship:** #47, #68, #69
- **Deferred:** #50 (WarningBadge -300px overlay) — moved to BACKLOG; see deferred items in spec.

## 2026-03-22 — Review 1 (Passed)
- **Result:** Passed — no blocking issues
- **Tests:** 196/196 passed
- **Non-blocking:** `DEFAULT_WARNING_PREFS` duplicated in `SmartAddItem.tsx` and `Settings.tsx` — added to BACKLOG for extraction to `api/profile.ts`

## 2026-03-22 — Shipped
- **Commit:** `feat: warning system improvements (refs #70, #47, #68, #69)`
- **Closed:** #70, #47, #68, #69
- **iOS fixes applied post-review:** keyboard dismiss before modal open, toast 400ms delay, maxHeight 85% on modal, action row button layout (Cancel removed, Save to Master & Add → Save & Add)
