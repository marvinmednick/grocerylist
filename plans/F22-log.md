# F22 Feature Log

## 2026-03-23 — Review 1 (Passed)
- **Result:** Passed — no blocking issues
- **Tests:** 230/230 passed
- **Non-blocking:** X icon at size=16 vs spec's size=18 (cosmetic); modal card uses nested Pressable with stopPropagation instead of spec's View — functionally better (prevents tap-through)

## 2026-03-23 — Shipped
- **Commit:** `fix: correct X icon size in WarningBadge; stop tap-through in UserAvatar menu` (c6f7c8b)
- **Closed:** #50
