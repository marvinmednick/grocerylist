# Backlog

**This is a short-lived inbox, not a permanent list.** Items land here during `/spec` and `/review-impl` when it's not the right moment to stop and handle them. After every feature ship or bug fix commit, triage this file: fix items now, promote them to GitHub Issues, or discard them. The goal is an empty backlog after each triage.

See WORKFLOW.md §8 (Backlog Triage) for the full process.

---

### From F44
- [ ] Database-backed vocabulary tables (household-scoped, with management UI) — requires F79 scope. (deferred from F44)
- [ ] Plural normalization in bag-of-words matching ("breasts" → "breast") — requires stemming logic. (deferred from F44, owned by F77)
- [ ] Fraction support (`1/2 lb`) in parser — not supported V1. (deferred from F44)
- [ ] Word-quantities (`a dozen`, `half a pound`) in parser — not supported V1. (deferred from F44)
- [ ] Multi-word store hints (`@harris teeter`) — single-word @hint only in V1. (deferred from F44)
- [ ] `alternate_qtys` audit — verify existing alternate_qtys values parse cleanly against F44 vocabulary seeds; flag gaps. (deferred from F44, to be done during F44 implementation)
- [ ] `MasterItemRef` duplicated in `lib/parser.ts` and `api/items.ts` — one should import from the other to prevent silent drift. (found in F44 review)
- [ ] `formatCount` in `quantityFormat.ts` has two identical branches; the `isInteger` check is a no-op — simplify to one branch. (found in F44 review)
- [ ] `@co`-style multi-store match (multiple store pills shown simultaneously) not tested in SmartAddItem-parser-test. (found in F44 review)
- [ ] Edit modal qty pre-fill and store `▸ More` expansion are untested. (found in F44 review)

## Deferred from Specs

### From F16
- [x] Comment row separator: fixed hyphen → em dash in item card name display (`items.tsx`). Summary label trailing space was already clean.


### From F18
- [x] WarningBadge popover overlay uses hardcoded -300px offsets — replaced with Modal in F22. (deferred from F18, issue #50)
- [x] `DEFAULT_WARNING_PREFS` duplication → promoted to GitHub #72. (found in F18 review)

_(Store dropdown filter → promoted to GitHub #62. Visual feedback for re-assigned preference → discarded, pill state provides sufficient feedback.)_

### From F79
- [ ] Write-time population of `list_items.quantity_parsed` JSONB when adding items via SmartAddItem — JSONB column exists but is always NULL until this is implemented. Required by F78 (duplicate detection). (deferred from F79)
- [ ] Write-time population of `items.default_qty_parsed` and `items.alternate_qtys_parsed` when editing master items — same rationale as above. (deferred from F79)
- [ ] Backfill `quantity_parsed` for existing `list_items` rows — requires app-side parsing; impractical in migration SQL. (deferred from F79)
- [ ] `formatQuantity` in `quantityFormat.ts` uses `DEFAULT_VOCABULARY` for plural lookup — custom household package plurals will not be recognized. Low impact until households add custom packages with non-obvious plurals. (deferred from F79)

### From Doc Audit (2026-03-23)
- [ ] `UserAvatar.tsx:38` uses absolute-positioned overlay (same pattern as the pre-F22 WarningBadge). Risk: clipping by parent containers with `overflow: hidden`, Z-index conflicts with other overlays, and keyboard-open behavior may push it off-screen. Low urgency — address in a future UI polish pass.

