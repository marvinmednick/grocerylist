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
- Out of scope / resolved: backfill of existing rows (data wipe acceptable per #85); `quantityEquals` DEFAULT_VOCABULARY fixed pre-commit
- [x] `SmartAddItem.tsx:161,473` — `quantityEquals` calls pass `DEFAULT_VOCABULARY` instead of `vocab`. Fixed. (found in F79 review)
- [x] write-time population of `list_items.quantity_parsed`, `items.default_qty_parsed`, `items.alternate_qtys_parsed` — specced as F85
- [x] explicit `plural` field on packages table + `formatQuantity` cleanup — bundled into F85 spec

### From F85
- [x] Inline list item quantity edits do not update `quantity_parsed` — promoted to #86
- [x] `formatQuantity` suppresses count=1 with no package type — promoted to #87

### From F90
- [ ] Realtime subscription for `word_aliases` — not needed V1; React Query invalidation sufficient. (deferred from F90)
- [ ] Fuzzy matching on alias entries — F77 scope. (deferred from F90)

### From F91
- [x] Bulk import/export — promoted to #92 (broadened scope: aliases, master items, history)
- [x] Real-time collaboration on aliases — discarded (not useful for the product)

### For F83 (Fuzzy Matching Design)
- [ ] Consider substring prefix matching at minimum length (3-4 chars) as one fuzzy strategy alongside Levenshtein, n-grams, etc. Abbreviations screen search currently uses strict prefix matching; F83 should evaluate broadening this as part of a cohesive fuzzy search design. (noted during F91 review)

### From Doc Audit (2026-03-23)
- [ ] `UserAvatar.tsx:38` uses absolute-positioned overlay (same pattern as the pre-F22 WarningBadge). Risk: clipping by parent containers with `overflow: hidden`, Z-index conflicts with other overlays, and keyboard-open behavior may push it off-screen. Low urgency — address in a future UI polish pass.

