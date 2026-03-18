# F15 Feature Log

## 2026-03-16 — Specced

- **Spec:** `specs/F15-freeform-qty-other-chip.md`
- **Design:** `docs/design/F15-freeform-qty-other-chip.md`
- **GitHub Issue:** #58
- **Review Level:** Full
- **Scope:** Adds an "Other" chip at the end of the qty pill row in SmartAddItem. Tapping it opens an absolutely-positioned floating text input popover. Confirmed via Return key; sets selection.qty for that add only (use-once, not persisted to item).

## 2026-03-16 — Review 1 (Passed)
- **Result:** Passed — no blocking issues
- **Tests:** 14/14 passed (8 pre-existing + 6 new F15 tests)
- **Non-blocking:** none
- **Suggestions:** Verify popover visual on device — dropdown has `overflow: 'hidden'`; inline rendering should be fine but worth a quick check

## 2026-03-17 — Shipped
- **Commit:** `feat: add "Other" chip with freeform qty popover to add flow (closes #58)`
- **Closes:** #58
