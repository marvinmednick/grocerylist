# Backlog

**This is a short-lived inbox, not a permanent list.** Items land here during `/spec` and `/review-impl` when it's not the right moment to stop and handle them. After every feature ship or bug fix commit, triage this file: fix items now, promote them to GitHub Issues, or discard them. The goal is an empty backlog after each triage.

See WORKFLOW.md §8 (Backlog Triage) for the full process.

---

### From F44
- [ ] Database-backed vocabulary tables (household-scoped, with management UI) — requires F79 scope. (deferred from F44)
- [x] Plural normalization in bag-of-words matching ("breasts" → "breast") — implemented in F77.
- [ ] Fraction support (`1/2 lb`) in parser — not supported V1. (deferred from F44)
- [x] Word-quantities (`a dozen`, `half a pound`) in parser — promoted to #94 (broadened scope: all word-to-number normalization for voice input).
- [x] Multi-word store hints (`@harris teeter`) — promoted to #98 (F98).
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
- [x] Fuzzy matching on alias entries — implemented in F77.

### From F91
- [x] Bulk import/export — promoted to #92 (broadened scope: aliases, master items, history)
- [x] Real-time collaboration on aliases — discarded (not useful for the product)

### From F77
- [ ] Visual indicator for non-exact matches (fuzzy-corrected words, alias-expanded words) in dropdown rows — subtle styling to help users understand why a result appeared. (deferred from F77 design)
- [ ] `bestFuzzyMatch` exported from `fuzzyMatch.ts` but unused in production code — remove or document as utility. (found in F77 review)

### For F83 (Fuzzy Matching Design)
- [ ] Consider substring prefix matching at minimum length (3-4 chars) as one fuzzy strategy alongside Levenshtein, n-grams, etc. Abbreviations screen search currently uses strict prefix matching; F83 should evaluate broadening this as part of a cohesive fuzzy search design. (noted during F91 review)

### Dirty-State Save (from #95 review)
- [ ] `app/(tabs)/index.tsx` edit-item modal — add dirty-state Save per §7f. Apply when this modal is next modified.
- [ ] `components/Abbreviations.tsx` edit dialog — add dirty-state Save per §7f. Apply when this component is next modified.
- [ ] `components/VocabularyManagement.tsx` edit dialogs (units, packages, sizes) — add dirty-state Save per §7f. Apply when this component is next modified.

### From F103
- [ ] `handleDelete` undo creates a new parent via `addItem()` even when `parentDeleted` is false — works now (single-entry only) but will create duplicate parents when F78 multi-entry arrives. Revisit undo for partial-entry delete in F78 spec. (found in F103 review)

### From F94
- [ ] "a dozen" → "1 dozen" normalization — the word "a" is too ambiguous to normalize globally. (deferred from F94)
- [ ] Quoted-region awareness in `normalizeVoiceInput` — currently "at" inside quotes is also transformed. Not a practical issue for voice input. (deferred from F94)

### From Doc Audit (2026-03-23)
- [ ] `UserAvatar.tsx:38` uses absolute-positioned overlay (same pattern as the pre-F22 WarningBadge). Risk: clipping by parent containers with `overflow: hidden`, Z-index conflicts with other overlays, and keyboard-open behavior may push it off-screen. Low urgency — address in a future UI polish pass.

### From F99
- [x] `useQuickAcceptState.ts` — consolidated `isArmed`/`isArmedRef` behind `setArmed(next)` helper in Review 2 fix-up.
- [x] SmartAddItem-quickaccept-test.tsx non-null non-default profile test — discarded; duplicates the custom-profile test's code path.

### From F78
- [ ] Unit conversion for combine (lb ↔ oz, ml ↔ l, g ↔ kg) — V1 treats convertible-but-different units as incompatible; custom or add-new only. (deferred from F78)
- [ ] Fuzzy one-off name matching beyond case/trim — deferred to post-F83. (deferred from F78)
- [ ] Grouped-checkbox UI (one product header with N sub-checkboxes) — F103 keeps flat rendering; revisit if flat model proves insufficient. (deferred from F78)
- [x] Add direct unit test for `useAddQuantityEntry` household guard (parallel to `list-f103-test.tsx` `useAddToList` coverage). Fixed.
- [x] Add component test covering duplicate dialog Cancel/✕ restoring `savedQuery` in SmartAddItem. Fixed.
- [x] Add end-to-end component test for cross-store Add New (new `list_items` parent at incoming store). Fixed.
- [x] `formatCombineOption` sum output ("3lb") has no space while multipack ("2 × 1.5 lb") does — inconsistent inside the duplicate dialog; unify spacing. Fixed.

### From F104
- [x] `list_items.store_id` column formal DROP — promoted to #106.
- [x] Warnings stale-store problem — promoted to #107.

### From F107
- [x] `index.tsx:handleSaveEdit` always passes `store_id` in `entryUpdates` — fixed in F107 commit (diff-only update implemented).
- [x] `dedupeWarnings` uses `JSON.stringify` for dedup — promoted to #111.

