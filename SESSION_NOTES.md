# Session Notes

Rolling session log — accumulates across sessions and is committed with content. Never cleared.

Use `/update-worklog` to auto-generate an entry from git analysis if entries were missed.

**Entry format:**
```
---
### YYYY-MM-DD HH:MM — [Step/task description]
- **Completed**: [What was done]
- **Findings**: [Key context, discoveries, or reasoning worth preserving — things that help reconstruct the train of thought. Omit field if nothing notable.]
- **Design decisions**: [Any decisions made; "none" if clean]
- **Design review**: [Findings from /design-review; "none" if not triggered]
- **Next**: [Next steps]
```

**Always append after every workflow step completion** — spec, review, design, complete, resolve, investigate, triage. Even if everything was clean and all fields are "none", the entry records that the step happened and what was worked on.

---
### 2026-03-12 08:30 - Completed F12 and F13, reviewed #39, triage backlog
- **Completed**:
  - Reviewed #39 (move useUpdateMasterItem test to items-test.ts) — passed
  - Completed F12: closed #42, updated PLAN.md to Done, added shipped entry to F12 log
  - Completed F13: closed #43, updated PLAN.md to Done, added shipped entry to F13 log
  - Triaged full backlog: 1 fix-now applied (`as any` → `as Error` in items.tsx:185), 8 items promoted to GitHub Issues (#47–#54), 3 completed items removed
  - Updated `commands/complete.md`: scoped backlog triage to completing feature; push is non-blocking
  - Committed unified command architecture (shared commands/, Codex skills, WORKFLOW.md updates)
- **Tests**: 146 passed, 0 failed
- **Next**: Push when ready; #39 test move still uncommitted in working tree
---
### 2026-03-22 11:09 - Issue triage, new issues, batch planning
- **Completed**: Closed #17 (already done); created #68 (warnings in edit modal), #69 (warning toast bug); created feature:F18–F21 labels; labelled 13 issues as batched; added F18–F21 to PLAN.md
- **Next**: Spec F18 (warning system) first — contains a bug (#69)
---
### 2026-03-22 11:18 - Document label scheme, filters, and shell aliases
- **Completed**: Created gh-aliases.sh (project root, sourceable); added §10 Issue Filtering to WORKFLOW.md; extended §9 with feature batch label docs; updated Quick Reference and File Reference tables
- **Next**: Spec F18 (warning system)
---
### 2026-03-22 14:20 - F18 spec written
- **Completed**: specs/F18-warning-system-improvements.md; GitHub #70 created; PLAN.md updated (F18 → Specced); BACKLOG.md updated (#50 deferred); plans/F18-log.md created
- **Next**: Implementor runs ./implement F18 --plan
---
### 2026-03-22 14:30 - Wrote F19 spec (Store Management UI)
- **Completed**: specs/F19-store-management-ui.md, plans/F19-log.md; updated PLAN.md status to Specced
- **Next**: Implement F19 or ship F18 first
---
### 2026-03-23 19:31 - Fixed flaky act() test failures (FlatList/DraggableFlatList mocks)
- **Completed**: Added synchronous mocks for FlatList and DraggableFlatList to jest.setup.js. Eliminates VirtualizedList's internal setTimeout firing outside act() during tests.
- **Tests**: 230 passed, 0 failed (was intermittently 228/230 due to flakiness)
- **Next**: Commit when ready
---
### 2026-03-23 21:34 - F22 complete
- **Completed**: WarningBadge modal fix shipped. Implementation in c6f7c8b; tests and tracking in this session.
- **Tests**: 230 passed, 0 failed
- **Next**: F23 implementation
---
### 2026-03-24 — Workflow enhancement: SESSION_NOTES, /design-review, design-history
- **Completed**: Renamed WORK_LOG.md → SESSION_NOTES.md with updated format/protocol; created commands/design-review.md (standardized consistency check); created docs/design-history.md (seeded with 3 F22/flaky-test decisions); added Session Startup + SESSION_NOTES sections to CLAUDE.md; added /design-review trigger steps to spec/review/complete/resolve/investigate/triage commands; updated WORKFLOW.md tracking table, quick reference, and file reference
- **Design decisions**: SESSION_NOTES replaces WORK_LOG naming to avoid WORKFLOW.md confusion; design-review embedded in workflow steps (not time-triggered); two-level learning capture (specific vs general principle) in design-history.md
- **Design review**: n/a — this work IS the design review process enhancement
- **Next**: F23 implementation; parent CLAUDE.md Pattern A/B split deferred

---
### 2026-03-24 12:00 — /review F23
- **Completed**: Code review of F23 (Store Dropdown in Edit Modals)
- **Findings**: Clean pass. All 4 files match spec exactly. Dropdown trigger + menu implemented in both SmartAddItem and index.tsx. Safe-area insets applied to both modals. Cancel button added to SmartAddItem master-item action row. closeEditModal helper centralizes reset logic and is called by both X button and Cancel button. 241/241 tests pass.
- **Design decisions**: none
- **Design review**: not triggered — patterns followed, no new patterns established
- **Next**: Ready to ship (#74)

---
### 2026-03-31 — F44 design: quantity storage, vocabulary architecture, feature chain
- **Completed**: Continued F44 design conversation. Created cross-cutting architecture doc (`docs/design/vocabulary-and-quantity-architecture.md`). Resolved Open Q#2 and Q#3. Fixed stale F14/F4 references. Expanded F79 and F77 scope. Created F83 (#83 — vocabulary definition flow). Added implementation order to PLAN.md.
- **Findings**: Initial decision was text storage for alternate_qtys and list_items.quantity. Broadening to architectural view reversed this — structured storage is the right long-term choice because the parser is a normalization layer, not a one-shot utility. Multiple downstream consumers need structure (F78 merge, F76 scaling, warnings, pill pre-selection). Serialize/deserialize cost is manageable either way, so the tiebreaker is architectural consistency. Units should be curated (settings UI, not on-the-fly); packages and size descriptors are household-extensible on-the-fly. The existing `units` table and `unit_id` columns are unused placeholders from initial scaffolding.
- **Design decisions**: Structured quantity storage (architectural target); text is interim until F79. Vocabulary tables are household-scoped. Units editable via settings only; packages/size descriptors extensible on-the-fly via definition flow. User interaction model: two-category dropdown (known + fuzzy), one-off quick-add (frictionless), clarify/define modal (deliberate vocabulary definition). Implementation order: F44 → F79 → F77/F83 → F78/F76.
- **Design review**: not triggered
- **Next**: Continue F44 design — remaining open questions: Pass 5 precedence rules (Q#1), UI decisions (Q#4), store prefix ambiguity (Q#5)

---
### 2026-03-31 18:00 — F44 design: resolved Q#1 (Pass 5 precedence rules)
- **Completed**: Resolved Open Q#1 — Pass 5 now returns ranked interpretations instead of single winner. Updated `ParsedInput` with `orphans[]` field and wrapped in `ParseResult` with `rawInput`. Partially resolved Q#4 (orphan display). Updated design doc Pass 5, Pass 6, Open Questions, Design Decisions, and revision history.
- **Findings**: Single-output longest-match silently discards valid shorter interpretations — the user has no way to pick an alternative. Ranked output respects "user always confirms" principle. Orphan tokens (NAME tokens left over from shorter matches) should not disqualify interpretations — in free-form input, users often include words that don't match master items (e.g., "large green avocado" when only "Large Avocado" exists). Orphan tolerance avoids penalizing messy input.
- **Design decisions**: Pass 5 returns `ParseResult { interpretations: ParsedInput[], rawInput: string }`. Ranking: longest name match first. Orphans carried in `orphans[]`, never disqualify. Dropdown shows orphans struck-through. One-off add uses `rawInput`.
- **Design review**: not triggered
- **Next**: Continue F44 design — remaining open questions: UI decisions (Q#4 — real-time parse feedback, store hint locking, error surfacing), store prefix ambiguity (Q#5)

---
### 2026-04-01 — F44 design: resolved Q#4 (UI decisions) and Q#5 (store prefix ambiguity)
- **Completed**: Resolved all remaining open questions. Added full Dropdown UI section to design doc covering qty pills, store pills, edit modal enhancements, and parse feedback model. Added three new design decisions. All open questions now resolved.
- **Findings**: Key insight: pills ARE the parse feedback — no need for a separate parse display UI. For qty, always show all defaults/alternates (never filter based on parsed input) to avoid hiding close matches the user might want. Sort by partial-match relevance instead. Store pills only appear when @hint is present — this avoids clutter on every row while giving feedback when the user explicitly asks for it. Store prefix ambiguity (Q#5) resolved by showing multiple matches as pills — the UI handles disambiguation, no algorithm needed. "Other" replaces pills with text input (not expands underneath) — keeps row height stable. Two-row pill cap is a reasonable starting point; can tighten to one row later since overflow mechanism is the same.
- **Design decisions**: Qty pills: show parsed value (selected) + all defaults/alternates sorted partial-match-first, two-row cap, `...` overflow to edit modal. Other: replaces pills with text input pre-filled with parsed value, `✕` to return. Store pills: only on @hint, live-updating prefix match, single line with `...` overflow. Edit modal: filtered store list with `▸ More` expansion, qty text input pre-filled with parsed value. Parse feedback: pills are the feedback, no separate display. Partial match = string prefix (becomes structured comparison under F79).
- **Design review**: not triggered
- **Next**: All F44 open questions resolved. Ready for final read-through and DRAFT notice removal, then `/spec`.

---
### 2026-04-01 — F44/architecture: consistency review fixes
- **Completed**: Addressed four consistency issues from external review. Added interim serialization format for pre-F79 text storage. Simplified \d+-pack to literal package string. Removed multi-word unit aliases. Revised principle #1 wording. Reformatted vocabulary seed tables for spec-time review. Updated architecture doc principle references.
- **Findings**: Interim text serialization was a real gap — F44 produces structured output but needs a canonical format for the TEXT columns until F79. Format: `[countx] [sizeQty+sizeUnit] [packageType]`. The \d+-pack decomposition into multiplier + "pack" was premature — F44 doesn't need the multiplier, and downstream features (F78/F76) can extract it later. Multi-word unit aliases (fl oz) were impossible to recognize given whitespace tokenization — removed rather than adding multi-token handling complexity. "User always confirms" was misleading — pre-selected pills don't require explicit per-field confirmation, they require visibility and overridability.
- **Design decisions**: Interim serialization format defined. \d+-pack stored as literal string. Multi-word units removed from V1 seeds. Principle #1 revised to "every inference is visible and overridable." All vocabulary tables reformatted with categories and marked for spec-time review.
- **Design review**: not triggered
- **Next**: F44 design complete. Ready for DRAFT notice removal and `/spec`.

---
### 2026-04-03 — F44 spec written
- **Completed**: specs/F44-freeform-input-parsing.md written; PLAN.md updated (Backlog → Specced); plans/F44-log.md created; BACKLOG.md updated with 6 deferred items; design doc DRAFT notice removed; GitHub issue #44 updated with spec link and acceptance criteria.
- **Findings**: Vocabulary storage decision: in-memory constants for F44 (F79 moves to DB tables). Rationale: parser needs to be fast (every keystroke), vocabulary is static in F44, and the interface (Vocabulary parameter) is swappable without changing the parser. `useAllItems` has a 100-item limit and includes store preferences/categories — a new `useMasterItemNames()` hook (lighter query, no limit) is the right data source for Pass 5. `useSearchItems` is kept as-is for other consumers; F44 adds a parallel parser-driven flow.
- **Design decisions**: In-memory vocabulary for F44 (not DB tables). New `useMasterItemNames()` hook as parser data source. Parser as pure injected-dependency module (no React hooks). `useSearchItems` unchanged.
- **Design review**: not triggered — all patterns follow existing conventions; no new persistent patterns introduced
- **Next**: Implementor runs `./implement F44 --plan`, then `/review-plan F44`

---
### 2026-04-03 — F44 review 2 (Passed)
- **Completed**: Full review pass. 326/326 tests. PLAN.md → In Review. GitHub #44 labeled in-review. 4 non-blocking items added to BACKLOG.md.
- **Findings**: No blocking issues. Clean architecture: parser/formatter/vocabulary in lib/, SmartAddItem as consumer only. `MasterItemRef` duplicate and `formatCount` no-op are the only code-quality gaps.
- **Design decisions**: none
- **Next**: Ship when ready — `git add` untracked files and commit

---
### 2026-04-03 — F44 hotfix: prefix fallback for partial-name discovery
- **Completed**: Fixed critical runtime regression in SmartAddItem.tsx — partial-name input (e.g. "Chick") never matched master items after F44 landed.
- **Findings**: F44 replaced `useSearchItems` (prefix matching) with parser bag-of-words exact matching. "Chick" → `["chick"]` ≠ `["chicken"]` → no interpretations → only one-off row shown. No DB changes needed — `masterItemNames` data was loading fine. The spec deferred prefix/subset matching to F77, but the implementation removed the existing fallback without a substitute.
- **Design decisions**: Added `prefixFallbackInterpretations` in SmartAddItem: when parser returns zero interpretations and query ≥ 2 chars, filter `masterItemNames` in-memory by name prefix and synthesize minimal `ParsedInput` rows (all qty fields null). Parser fires first; fallback only activates when parser finds nothing. This is an F44 fix, not F77 work — F77 will add richer substring/contains matching inside the parser itself.
- **Next**: Re-test "Chick" → should show "Chicken" row; verify structured queries like "2 8oz cans chicken broth" still show parser-driven rows.

---
### 2026-04-03 — F79 design: Quantity Units System
- **Completed**: Full design session for F79. Design doc written at `docs/design/F79-quantity-units-system.md`. PLAN.md updated to `Designed`. UI guidelines updated with two new patterns.
- **Findings**: Four distinct "quantity" contexts clarified: (1) vocabulary lookup tables, (2) in-memory parser output, (3) list_items quantity storage, (4) items qty presets. Contexts 3 and 4 share the same `ParsedInput` JSONB shape. Vocabulary token / name prefix collision surfaced — "can" classified as PACKAGE suppresses "Canola Oil" from name search. Filed as #84, noted as known limitation.
- **Design decisions**: Vocabulary tables are household-scoped (all three types); existing `units` table dropped and replaced. JSONB for both `list_items.quantity_parsed` and `items` qty fields; existing TEXT columns kept as display cache/fallback. Qty not used for item search or ranking. Avatar menu gains "Sizes & Packages" second item (vocabulary management); "Settings" renamed "General". Vocabulary drill-down screen → 3 sub-screens (Units, Packages, Sizes) with full CRUD + Reset to Defaults (full replace). Editable alias chips in edit form. Display uses canonical/abbreviated form always.
- **Design review**: not triggered
- **Next**: `/spec F79` when ready to implement

---
---
### 2026-04-04 — F79 spec written
- **Completed**: `specs/F79-quantity-units-system.md`; PLAN.md updated (Designed → Specced); `plans/F79-log.md` created; BACKLOG.md updated with 4 deferred items; GitHub #79 updated with spec link and acceptance criteria.
- **Findings**: `parseCandidate` in SmartAddItem (used for prefix fallback) also uses `DEFAULT_VOCABULARY` directly — both the `parseResult` and `parseCandidate` memos need to be updated to use the DB-backed vocabulary. `VocabularyData` is compatible with the existing `Vocabulary` type from vocabulary.ts since `VocabRow` adds `id` to `VocabEntry` — no mapping needed when passing to `parseInput`. Write-time JSONB population deferred: JSONB columns are created but remain NULL until a future spec populates them at add-item time (required by F78). `formatQuantity`'s plural lookup still uses `DEFAULT_VOCABULARY` — noted as deferred (low impact until custom packages with non-obvious plurals are added).
- **Design decisions**: none (all decisions from design session; spec faithfully translates to implementation instructions)
- **Design review**: not triggered — all patterns follow established conventions (F19 store management precedent for inline delete confirm; Settings.tsx for full-screen modal; established chip pattern for editable aliases)
- **Next**: Implementor runs `./implement F79 --plan`, then `/review-plan F79`

---
### 2026-04-04 — F79 /review-impl
- **Completed**: Full review of F79 implementation (vocabulary tables, API hooks, UI components, tests). 366/366 tests pass. Migration applied via `npm run db:push`.
- **Findings**: One non-blocking gap — `SmartAddItem.tsx:161,473` calls `quantityEquals(parsedQty, option, DEFAULT_VOCABULARY)` rather than `vocab` (the `vocabulary ?? DEFAULT_VOCABULARY` local already in scope). Parser and `parseCandidate` memos correctly use `vocab`; these two comparison calls were missed. Added to BACKLOG alongside the `formatQuantity` deferred gap.
- **Design decisions**: none
- **Design review**: not triggered — no pattern violations or new patterns
- **Next**: Merge when ready; next in chain is F77 (fuzzy matching) or F78 (duplicate detection)

---
### 2026-04-04 — F85 /review-impl
- **Completed**: Full review of F85 implementation (packages plural column, parser pipeline, QuantityParsed, write-path population, VocabularyManagement UI). 401/401 tests pass. Migration 20250101000015 applied after review.
- **Findings**: One blocking finding resolved during session — migration was pending. Implementation was otherwise clean: all four SmartAddItem add paths populate `quantity_parsed`, items.tsx undo snapshot captures parsed pre-edit values, `formatQuantity` no longer depends on `DEFAULT_VOCABULARY`, `VocabularyManagement` plural input correctly auto-fills and respects manual override. No pattern violations.
- **Design decisions**: none
- **Design review**: not triggered — no new patterns introduced
- **Next**: Ready to ship. Run `/complete F85` when merging.

---
### 2026-04-04 — F85 /complete
- **Completed**: F85 shipped. Two commits (feat + chore workflow protocol). Issue #85 closed. PLAN.md → Done. Backlog triaged: #86 (inline edit quantity_parsed gap) and #87 (formatQuantity count=1 suppression) promoted to GitHub Issues. Architecture doc updated to reflect write-time normalization model (was stale). SESSION_NOTES at 189 lines but all entries < 90 days — no archive needed.
- **Design decisions**: none
- **Design review**: updated `vocabulary-and-quantity-architecture.md` — removed "display strings rendered from structure at display time" (stale pre-F85 language); replaced with accurate write-time normalization model.
- **Next**: Fix #87 (formatQuantity count=1 suppression).

---
### 2026-04-04 — F85 /review-impl (Review 2, Passed)
- **Completed**: Review 2 passed. 407/407 tests. PLAN.md → In Review. GitHub issue labeled in-review.
- **Findings**: Normalization correctly implemented via shared `normalizeQuantityText(raw, parsed)` helper in both SmartAddItem.tsx and items.tsx — returns `formatQuantity(parsed)` when parsed and non-empty, falls back to raw text otherwise. Empty-normalization guard (`normalized.length > 0 ? normalized : rawText`) handles count-only quantities like "1" that format to empty string. All four SmartAddItem add paths and all items.tsx write paths correctly normalize. Undo snapshot in items.tsx restores old TEXT values directly (not re-normalized) which is correct — those were already normalized at the time they were saved. Also introduced Needs Fixes workflow protocol: progress file `## Needs Fixes` section, AGENT.md protocol, WORKFLOW.md section.
- **Design decisions**: none beyond prior session
- **Design review**: not triggered
- **Next**: Run `/complete F85` to ship.

---
### 2026-04-04 — F85 Needs Fixes (post-review design clarification)
- **Completed**: Reopened F85 as Needs Fixes. Updated spec with Display Model section and write-time normalization requirement. Updated PLAN.md status and F85 log.
- **Findings**: After review passed, discussion clarified that write paths were not normalizing `quantity` TEXT to `formatQuantity(quantity_parsed)` — they were storing raw user input. This means "2 Cans" and "2 cans" could display differently despite identical structured data. The fix: when `quantity_parsed` is non-null, set `quantity = formatQuantity(quantity_parsed)` at write time. One-off items (null parsed) still store raw text as-is. Applies to all three write paths: SmartAddItem `quantity`, Items screen `default_qty`, and each `alternate_qtys[]` element.
- **Design decisions**: `quantity` TEXT is the display field (no display-side code changes needed), kept in sync with structured data at write time. This model is fixed — changes require a new spec.
- **Design review**: not triggered
- **Next**: Implementor applies normalization fix; re-run tests; re-review.

---
### 2026-04-04 — F85 /spec
- **Completed**: Renamed GitHub issue #85 to "F85: Structured Quantity Data Conversion"; registered F85 in PLAN.md; wrote `specs/F85-structured-quantity-conversion.md`.
- **Findings**: Issue #85 had a scope expansion comment added during F79 review: explicit `plural TEXT NOT NULL` column on the `packages` table must be bundled with F85 because `formatQuantity` still depends on `getPlural()`/`DEFAULT_VOCABULARY` — the vocabulary-injection problem can't be closed without it. The plural column change cascades through: `VocabEntry` interface, `DEFAULT_VOCABULARY.packages` (move plurals out of aliases), `lookupPackageEntry()` (new), parser token value shape (`PackageValue { canonical, plural }`), `CandidateFields.packagePlural`, `ParsedInput.packagePlural`, `QuantityFields.packagePlural`, and `VocabularyManagement` UI (new "Plural form" input for packages). This is a broader change than the issue description implied.
- **Design decisions**: `QuantityParsed` type defined as `Required<QuantityFields>` with `packagePlural: string | null` included. `getPlural` deprecated (not deleted). n-pack tokens get `packagePlural: null` (no vocabulary entry). `alternate_qtys_parsed` is index-aligned with `alternate_qtys` (null element for unparseable entries). Undo snapshot in items.tsx captures parsed forms of old values so JSONB columns are correctly restored on undo.
- **Design review**: not triggered — all patterns follow established conventions
- **Next**: Implementor runs `./implement F85 --plan`, then `/review-plan F85`

---
### 2026-04-04 — /resolve 87 — formatQuantity count=1 suppression
- **Completed**: Applied fix to #87. Changed `showCount` no-package branch from `count !== null && count !== 1` to `count !== null`. Simplified `normalizeQuantityText` in SmartAddItem.tsx and items.tsx (removed empty-string guard, now returns `formatQuantity(parsed)` directly). Added two tests: `formatQuantity({ count: 1, packageType: null })` → `"1"` and `parseQuantityText('1', vocab)` → `{ count: 1, ... }`. 409/409 tests passing.
- **Design decisions**: none — fix was agreed in prior session
- **Design review**: not triggered — contained one-line bug fix, no broader pattern implications
- **Next**: Commit and close #87.

---
### 2026-04-04 — /resolve 88 — exact match suppresses subset/prefix results
- **Completed**: Fixed #88. Removed `parseResult.interpretations.length > 0` guard from `prefixFallbackInterpretations` memo so prefix fallback always runs when `query.length >= 2`. Replaced either/or merge at line 462 with merge + deduplicate-by-matchedItemId, parser results ranked first. Added "Chicken" to `DISCOVERY_MASTER_ITEM_REFS` and new test: typing "chicken" (exact parser match) must also show "Chicken Breast" and "Chicken Broth" (subset matches). Updated "milk" test comment. 410/410 tests passing.
- **Design decisions**: none — fix is a straightforward application of architecture principle #6 ("Context sorts, never filters")
- **Design review**: not triggered — contained fix within SmartAddItem.tsx, no broader pattern implications
- **Next**: Commit and close #88.

---
### 2026-04-05 — /resolve 89 — parser partial-matches rank above better prefix fallback matches
- **Completed**: Fixed #89. Split `rankedInterpretations` into three tiers: (1) parser results with 0 orphans, (2) prefix fallback results, (3) parser results with ≥1 orphan. Added "Chicken Boneless Skinless" to DISCOVERY_MASTER_ITEM_REFS and new ordering test. 411/411 tests passing.
- **Findings**: `consumeTokens` requires ALL item name tokens to appear in the input, so "Chicken Boneless Skinless" (3 tokens) is never matched by the parser for "Chicken Boneless" input (missing "skinless"). It can only be discovered via prefix fallback. The prior merge order (all parser results first) incorrectly placed the partial "Chicken" match above the better fallback result.
- **Design decisions**: none — ranking rule follows naturally from "more input explained = better match"
- **Design review**: not triggered — contained local sort change, no new patterns
- **Next**: Session complete.

---
### 2026-04-05 — /design F90 — Token & Item Alias System (Pass 1 + Pass 2)
- **Completed**: Full design for F90 — both functional/data decisions (Pass 1) and UI design (Pass 2). Design doc written at `docs/design/F90-token-item-alias-system.md`. Updated `docs/design/ui-guidelines.md` Decision Log with 4 new entries. Restructured architecture doc (`docs/design/vocabulary-and-quantity-architecture.md`) — removed project-planning sections (scope boundaries table, implementation order), replaced with "Architectural Dependencies" section. Narrowed F77 GitHub issue scope (aliases moved to F90). Updated PLAN.md feature chain.
- **Findings**: F90 was split from F77 after recognizing that aliases are a substantial independent body of work. Key insight: token aliases (word-level, composable) and item aliases (product-level, alternate names) are complementary — both needed. The abbreviations management screen unified two surfaces (general management + item-launched definition) into one screen with different entry states (empty search vs. pre-populated search from item words). Search creates placeholder rows for words without aliases, doubling as the "add new" mechanism.
- **Design decisions**: (1) Token aliases household-scoped and global, table starts empty. (2) Additive expansion — parser tries all 2^N combinations of original + expanded tokens. (3) Vocabulary classification takes priority over alias expansion. (4) "Abbreviations" as separate avatar menu item (not under "Sizes & Packages"). (5) Single abbreviations screen for both management and definition, with toggle between canonical→aliases and alias→canonical views. (6) OR search semantics, placeholder rows for unmatched words. (7) Inline live-updating conflict warnings. (8) Item edit modal gets read-only "Active Abbreviations" section + "Define Abbreviations" launch button. (9) Architecture doc cleaned up — planning content removed, architectural constraints retained.
- **Design review**: not triggered
- **Next**: Review design doc. Then `/spec F90` when ready to implement.

---
### 2026-04-06 — /review-impl F90 (Data + Parser)
- **Completed**: Full implementation review of F90. All 436 tests pass. Three issues found and fixed during review: (1) migration RLS policies missing `TO authenticated` — fixed in migration file before `supabase db push`; (2) vacuous test rewritten to exercise actual parser; (3) full_schema.sql section numbering corrected. Migration applied to remote. PLAN.md updated to In Review. GitHub #90 commented and labeled `in-review`.
- **Findings**: Implementation faithfully follows spec. Parser changes (expandAliases, resolveNames flattened lookup, parseInputInternal cross-variant dedup) are correct. All 4 SmartAddItem addItem call sites handle match_metadata appropriately. Prefix fallback correctly expands aliases and matches against item aliases. Seed data has 567 rows (exceeds 400-500 target). The migration policy omission (`TO authenticated`) was caught before push — no runtime impact since it was fixed pre-deployment.
- **Design decisions**: none
- **Design review**: not triggered — clean review, all patterns followed
- **Next**: Ship F90 via `/complete F90`, then begin F91 implementation

---
### 2026-04-06 — /spec F91 (Alias System UI)
- **Completed**: `specs/F91-alias-system-ui.md` written; PLAN.md updated (Backlog → Specced); `plans/F91-log.md` created; BACKLOG.md updated with 2 deferred items; GitHub #91 updated with spec link and acceptance criteria; `docs/design/F91-alias-system-ui.md` pointer file created (points to F90 design doc UI Design section).
- **Findings**: Design doc consistency check passed — UserAvatar menu structure, VocabularyManagement dialog pattern, items.tsx modal layout all match. Key implementation detail: `word_aliases` stores one row per alias (alias→canonical), not one row per canonical word. The edit dialog's Save must diff original vs. current chips and issue individual create/delete calls per alias row. The `useUpdateMasterItem` already spreads `...updates` to `.update()`, so adding `aliases` to the type signature is sufficient — no mutation logic changes. The `useWordAliasesForWords` helper (new in F91) reverses the alias→canonical Map to canonical→alias[] for display in the Active Abbreviations section.
- **Design decisions**: none — all decisions from F90 design doc; spec faithfully translates to implementation instructions
- **Design review**: not triggered — all patterns follow established conventions (VocabularyManagement as reference for edit dialog; SizesAndPackages for full-screen modal with drill-down; editable alias chips from F79)
- **Next**: Implement F90 first (`./implement F90 --plan`), then F91

---
### 2026-04-05 — /spec F90 (Phase A: Data + Parser)
- **Completed**: `specs/F90-token-item-alias-system.md` written; PLAN.md updated (Designed → Specced); `plans/F90-log.md` created; BACKLOG.md updated with 5 deferred items (Phase B UI, item alias CRUD, realtime subscription, fuzzy matching); GitHub #90 updated with spec link and acceptance criteria.
- **Findings**: Design doc was fully consistent with codebase — all referenced files, functions, and interfaces exist as documented. Key implementation details: `parseInput` gets optional 4th arg `wordAliases: Map<string, string>` for backward compatibility; `resolveNames` uses flattened lookup array (canonical entries before alias entries for dedup preference); `MasterItemRef` is duplicated in parser.ts and items.ts — both need `aliases: string[]` added (existing backlog item to deduplicate not addressed). The `prefixFallbackInterpretations` memo in SmartAddItem needs both token alias expansion AND item alias matching — two orthogonal changes in the same memo. Seed script targets ~400–500 (word, suggestion) pairs via re-runnable `INSERT ... ON CONFLICT DO NOTHING`.
- **Design decisions**: none — all decisions from design doc; spec faithfully translates to implementation instructions
- **Design review**: not triggered — all patterns follow established conventions (parser extension follows F44/F85 precedent; React Query hooks follow F79 vocabulary pattern; migration follows existing numbering)
- **Next**: Implementor runs `./implement F90 --plan`, then `/review-plan F90`

---
### 2026-04-01 — F44 design: unified quantity format, comparison rules
- **Completed**: Collapsed separate serialization and display formats into single natural-language format. Defined equality comparison via structured field comparison. Defined partial matching via raw input prefix. Clarified `Nx` is input-only.
- **Findings**: The initial design had a separate `Nx` serialization format for internal storage, which caused inconsistencies — `2x` leaked into display and broke partial matching (serialized `2x` doesn't prefix-match `2lb`). The root issue: trying to make the stored TEXT string self-describing was unnecessary because the parser can re-interpret any stored string. Collapsing to one natural-language format (same for storage and display) eliminated the inconsistencies. Equality comparison parses both sides to structured fields — more robust than string comparison since `"2 loaves"` and `"2 loaf"` compare as equal. Partial matching stays on raw text (user input vs. DB string) since it's a UI heuristic, not a semantic operation.
- **Design decisions**: Single natural-language quantity format for storage and display (`2 loaves`, `2 8oz cans`). `Nx` is input-only, never stored. Equality: parse both sides, compare structured fields. Partial match: raw input prefix against raw DB strings. Pill labels: parseable values rendered, legacy values as-is.
- **Design review**: not triggered
- **Next**: F44 design complete. Ready for DRAFT notice removal and `/spec`.

---
### 2026-04-06 — /review-plan F91, /review-impl F91, /complete F91
- **Completed**: Full lifecycle for F91 Alias System UI — plan review (approved with minor additions), implementation review (passed with non-blocking fixes), fixes applied, feature shipped.
- **Findings**: Search behavior discussion led to three decisions: (1) prefix matching is correct for alias lookup, substring matching deferred to F83 fuzzy design; (2) cross-matching (both views search canonical+alias) is good UX — toggle controls display format, not search scope; (3) alias match highlighting in canonical view makes cross-matches self-explanatory. Identified gap in test strategy: unit tests on individual pieces (parser, component rendering) don't catch bugs at integration seams (merge/dedup/ranking). Added 4 composition scenario tests and CODING.md guideline requiring them for pipeline features.
- **Design decisions**: Prefix matching for alias search (not substring). Cross-matching kept with alias highlighting. Punctuation allowed in aliases (only whitespace rejected). Composition test guideline added to CODING.md. F83 backlog note for substring matching consideration.
- **Design review**: CODING.md updated with Composition Scenario Tests section. No DESIGN.md changes needed.
- **Next**: Push when ready. F91 complete — alias system (data + parser + UI) fully shipped.

---
### 2026-04-06 — /design F77, /spec F77
- **Completed**: Design and spec for F77 Fuzzy Matching in Smart Add. Full design conversation resolved all functional and UI questions.
- **Findings**: Key design pivot: fuzzy matching works at the **token level** within name resolution, not as a separate item-level fallback pass. User's insight: "chicken rest boneless" should fuzzy-match "rest"→"breast" and rank Chicken Breast Boneless Skinless first — a post-parser fallback wouldn't fire because exact matches already exist. This eliminated the two-section dropdown concept entirely. Vocab and alias fuzzy matching included in V1 scope (originally deferred) because mobile keyboard typos affect all word types, and incremental cost is low once Levenshtein function exists.
- **Design decisions**: Token-level fuzzy (not item-level). Single ranked list (dropped two-section dropdown). Scoring: exact=2, fuzzy=1, orphan=0. Plural normalization via suffix stripping before edit distance. Edit distance thresholds: 1 for 3-4 char words, 2 for 5+. Fuzzy applied to vocab lookups (Pass 2), alias keys, and name resolution. Visual indicator for fuzzy matches deferred to backlog.
- **Design review**: No novel UI patterns — all changes are in matching logic.
- **Next**: `/review-plan F77` then implementation. Review Level: Full.

---
### 2026-04-06 — /review-plan F77, /review-impl F77
- **Completed**: Plan review identified 4 gaps (fuzzyCount semantics ambiguity, test cases summarized not enumerated, prefix expression imprecise, spurious migration entry); corrected plan written to `plans/F77-plan-approved.md`. Implementation review passed — all 506 tests pass. PLAN.md updated to In Review. GitHub #77 commented and labeled `in-review`.
- **Findings**: Implementor added `localAlignmentDistance` (windowed Levenshtein for length-delta=2 words) to meet spec's `"rest" vs "breast" → 1` requirement — standard Levenshtein gives 2 for that pair. Vocabulary fuzzy lookups correctly use `levenshteinDistanceStrict` with first-char guards to prevent false positives (e.g., "rest" incorrectly fuzzy-matching a vocab word). `bestFuzzyMatch` utility is exported but unused in production code (only tested). `fuzzyCount` semantics correctly implemented: plural normalization = exact (score 2, fuzzyCount 0), edit-distance = fuzzy (score 1, fuzzyCount 1).
- **Design decisions**: none
- **Design review**: not triggered — clean review, no pattern violations or new patterns
- **Next**: Ship F77 via `/complete F77`.

---
### 2026-04-06 — /complete #93 (alias commit UX + iOS Define Abbreviations modal flow)
- **Completed**: Reviewed and shipped bug fix for #93. Commit `0020c60`. Issue closed. 508/508 tests pass.
- **Findings**: Two non-blocking issues identified during review: (1) `commitAlias` has redundant guard logic after refactor to use `commitPendingAliasInput` — could be simplified; (2) `onBlur` firing when edit modal hides may cause alias input row to disappear after Abbreviations round-trip on real iOS devices (test passes because mock doesn't trigger real blur). Fix for #2: restore `showAliasInput(true)` in the `onClose` callback when `newAliasInput` has pending text. Both items are cosmetic/edge-case — core bugs are correctly fixed.
- **Design decisions**: none
- **Design review**: not triggered — localized bug fix, no new patterns
- **Next**: Address non-blocking items from review if desired. 1 commit unpushed.
