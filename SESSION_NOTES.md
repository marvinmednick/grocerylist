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
