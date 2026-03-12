## In-Flight Features

| ID | Feature | Status | Notes |
|----|---------|--------|-------|
| F12 | Smart Entry Model | In Review (passed) | Ready to ship with F13 |
| F13 | List Display Density & Warnings | In Review (passed) | Ready to ship with F12 |

---
### 2026-02-22 21:49 - Implement Light/Full review levels
- **Completed**: Added review level system across 7 files:
  - `implement` — added --plan, --plan-approved flags; review level reminder display
  - `AGENT.md` — added Plan Mode section with plan file format and approval flow
  - `specs/F001-list-interactions.md` — added Review Level: Full header + Full-level Implementation Commands
  - `.claude/commands/spec.md` — added review level criteria + both level Implementation Commands templates
  - `WORKFLOW.md` — added Light/Full comparison table + both approval paths in section 3
  - `GEMINI.md` — added note on --plan and --plan-approved flags
  - `plans/` directory created (empty, ready for plan files)
- **Tests**: No tests — workflow/config changes only
- **Next**: Verify plan step works end-to-end when running F001
---
### 2026-03-08 18:44 - Design F12 + F13 + F14 registration
- **Completed**: Joint design session for Smart Entry Model (F12) and List Display Density & Warnings (F13)
  - Registered F12 (#42), F13 (#43), F14 (#44) in PLAN.md
  - Wrote `docs/design/F12-smart-entry-model.md` — active store selector, item_store_preferences table, warning storage, store household scoping
  - Wrote `docs/design/F13-list-display-warnings.md` — multi-line row layout, warning badges, toast system, short_name field
  - Updated `docs/design/ui-guidelines.md` — semantic warning colors, 7 new patterns in Decision Log
  - Split free-form input parsing to F14 (separate feature)
- **Tests**: No tests — design docs only
- **Next**: `/spec F12` and `/spec F13` when ready to implement
---
### 2026-03-08 18:54 - Spec'd F13 List Display Density & Warnings
- **Completed**: Wrote full implementation spec at specs/F13-list-display-warnings.md
- **Scope**: Multi-line item rows, warning badge component, toast warning variant, Settings warnings section, short_name field, schema migration
- **Files**: 7 files to modify, 2 new files, 3 DB columns added
- **Tests**: 5 test files specified with ~20 test cases
- **Updated**: PLAN.md (F13 → Specced), GitHub issue #43 (added spec link + acceptance criteria)
- **Next**: Implementation via `./implement F13 --plan` or `/spec F12` to spec the second feature
---
### 2026-03-11 13:25 - Reviewed F13 implementation
- **Completed**: Full review of F13 (List Display Density & Warnings)
- **Result**: Needs fixes — one blocking, two non-blocking
- **Blocking**: 3 spec-required test cases missing from items-test.tsx (short_name modal rendering, prefill, and payload tests)
- **Non-blocking**: Duplicate Warning type (WarningBadge vs api/items.ts), `as any` in items.tsx:185
- **Actions**: Posted GitHub comment on #43, added non-blocking items to BACKLOG.md, reverted PLAN.md F13 status to In Progress
- **Next**: Implementor adds the 3 missing items-test short_name tests; re-run review when fixed
---
### 2026-03-11 13:33 - Reviewed F12 implementation
- **Completed**: Full review of F12 (Smart Entry Model) — PASSED
- **Result**: Pass — no blocking issues
- **Non-blocking**: SmartAddItem any types, computeWarnings behavioral delta vs spec, StoreSelector color palette (already in BACKLOG as fixed), StoreSelectorProps string vs string|null
- **Actions**: Posted GitHub comment on #42, added in-review label, updated PLAN.md F12 to In Review, appended 3 new items to BACKLOG.md
- **Next**: Ship F12 + F13 (after F13 short_name tests are added)
---
### 2026-03-11 13:35 - Fixed F13 blocking test gap
- **Completed**: Added 3 missing tests to client/app/(tabs)/__tests__/items-test.tsx
  - renders Short Name input in edit modal
  - populates short_name from item data when editing
  - sends short_name in update payload
- **Tests**: 146 passed, 0 failed (was 143)
- **Next**: F13 and F12 are both In Review — ready to commit and ship
---
### 2026-03-11 13:48 - Fixed Settings layout bugs #45 and #46
- **Completed**: Settings.tsx — replaced View with ScrollView, added useSafeAreaInsets
  - #45: ScrollView with flex:1 / flexGrow:1 / paddingBottom:24 — all sections now reachable
  - #46: paddingTop: insets.top || 20 applied inline — header no longer overlaps status bar
- **Tests**: 146 passed, 0 failed
- **Next**: Commit F12 + F13 + bug fixes
---
### 2026-03-11 17:04 - Workflow improvements: session continuity & test efficiency
- **Completed**: Implemented all workflow improvement changes:
  - `check-tests` — persists raw output to `.last-test-output.txt`, adds pass count to summary line
  - `.gitignore` — added `.last-test-output.txt`
  - `PLAN.md` — added `Needs Fixes` status to legend
  - `WORKFLOW.md` — added `Needs Fixes` to feature lifecycle table; added `plans/F[N]-log.md` to tracking system table; clarified `plans/F[N]-progress.md` is implementor-only
  - `CLAUDE.md` — updated Tracking System table with new files and status vocabulary
  - `.claude/commands/review.md` — now uses `./check-tests --show-known`; sets `Needs Fixes` vs `In Review` status; writes entry to `plans/F[N]-log.md`
  - `.claude/commands/spec.md` — creates `plans/F[N]-log.md` with Specced entry
  - `.claude/commands/complete.md` — appends Shipped entry to `plans/F[N]-log.md`
  - `plans/F12-log.md` — created with Specced + Review 1 (passed) entries
  - `plans/F13-log.md` — created with Specced + Review 1 (needs fixes) + Review 2 (passed) entries
  - `WORK_LOG.md` — added In-Flight Features table at top
- **Tests**: No tests — workflow/config/docs changes only
- **Next**: Commit these changes; then ship F12 + F13
