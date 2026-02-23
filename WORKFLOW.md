# Development Workflow

This document describes the end-to-end development process for this project, including the roles of Claude and Gemini, the tracking system, and how to handle every common scenario.

## Philosophy

This project uses two distinct roles:

- **Claude** — architecture, design, planning, and code review. Claude understands intent, makes decisions about structure, and specifies exactly what the implementor should build and test.
- **Implementor** (Gemini, aider, or similar tool) — implementation and testing. The implementor writes code and tests to spec and reports back when all tests pass.

The clean separation matters: implementation tools work best with precise instructions. Claude provides those instructions in the form of specs. This prevents architectural drift, keeps patterns consistent, and ensures nothing falls through the cracks.

---

## Tracking System

Four files and one external service work together:

| Location | Purpose | Updated by |
|----------|---------|------------|
| `PLAN.md` | Feature registry — every feature has a row with ID, status, spec link, and GitHub issue link | Claude (during `/spec`, `/review`, and ship) |
| `specs/F[NNN]-[slug].md` | Full implementation spec — everything Gemini needs to build a feature | Claude (via `/spec`) |
| `BACKLOG.md` | Small deferred tasks and non-blocking findings — items too small for a spec | Claude (during `/spec` and `/review`) |
| `CODING.md` | Coding conventions and patterns — the implementor's reference for every implementation | Claude (when new patterns are established) |
| `GEMINI.md` | Gemini-specific invocation guide | Claude (when Gemini workflow changes) |
| `AGENT.md` | Behavioral rules for all implementation agents | Claude (when scope discipline changes) |
| GitHub Issues | Formal record linked to commits — audit trail and commit cross-referencing | Claude (via `gh` CLI, automated in commands) |

### Feature IDs vs GitHub Issue Numbers

These are two independent numbering sequences that are linked but not the same.

**Feature IDs** (F001, F002, …) are assigned by us:
- Sequential, feature-only — every spec gets the next number regardless of what else is in GitHub
- Stable — an F-number never changes once assigned
- Used in: spec filenames, PLAN.md rows, spec headers, BACKLOG.md references

**GitHub Issue Numbers** (#1, #2, …) are assigned by GitHub:
- Sequential across *all* issue types — features, bugs, questions, anything filed in the repo
- Used in: commit messages (`closes #1`), PR descriptions, GitHub's audit trail

F001 happened to become issue #1 because it was the first issue in a fresh repo. But F002 might become issue #5 if three bugs were filed in between. The PLAN.md table and the spec header always record both, so you can find the relationship:

```
| F001 | List Interaction Modes | Specced | specs/F001-list-interactions.md | #1 |
```

**Commit messages use the GitHub issue number** so that GitHub auto-closes the issue on merge:
```
git commit -m "feat: implement interaction modes (closes #1)"
```

---

## Feature Lifecycle

```
Idea → [Design] → Specced → In Progress → In Review → Done
```

| Status | Meaning | Files updated |
|--------|---------|---------------|
| Backlog | Planned but not yet specced | PLAN.md row added |
| Specced | Spec written, GitHub issue open, ready for Gemini | spec file created, PLAN.md updated, issue created |
| In Progress | Gemini is implementing | (Gemini working) |
| In Review | Gemini submitted, Claude reviewing | PLAN.md updated, issue comment added |
| Done | Review passed, merged | PLAN.md updated to Done, GitHub issue closed |

---

## Use Cases

### 1. New Feature That Already Has a Design Doc

When the feature is in `PLAN.md` as Backlog and has a corresponding design doc in `docs/design/`:

**In Claude:**
```
/spec Multi-User Trip Management
```

Claude will:
1. Read `docs/design/multi-user-trips.md` and `DESIGN.md`
2. Assign the next F-number (e.g. F002)
3. Write `specs/F002-multi-user-trips.md`
4. Create GitHub issue `gh issue create --title "F002: Multi-User Trip Management" ...`
5. Update `PLAN.md` row from `Backlog` to `Specced`
6. Append any deferred items to `BACKLOG.md`

**Hand to implementor** using `specs/F002-multi-user-trips.md` + `AGENT.md` + `CODING.md` (see [Handing Off to the Implementor](#handing-off-to-the-implementor)).

---

### 2. New Feature That Needs Design First

When you have an idea but no design doc yet, have a design conversation with Claude before running `/spec`.

**In Claude:**
```
I want to add price tracking — log what items cost at each store so we
can estimate trip totals. How should this work?
```

Claude will discuss the design, ask clarifying questions, and produce a design. Once you're happy with the direction:
```
That looks good. Can you write that up as a design doc in docs/design/
and then run /spec for it?
```

Claude writes `docs/design/price-tracking.md` first, then produces the spec.

---

### 3. Handing Off to the Implementor

#### Review Levels

Each spec has a `**Review Level:**` header — **Light** or **Full**. The spec author sets this; you don't need to judge it yourself.

| | Light | Full |
|---|---|---|
| **When** | 1–2 files, no new files, no schema changes, existing patterns only | 3+ files, new files, schema changes, or new patterns |
| **Flow** | Implement → tests → `/review` → commit | Plan → (optional Claude review) → implement → tests → `/review` → commit |

**Light workflow:**
```
./implement F001
  ↓
Tests pass
  ↓
Claude /review F001
  ↓
Commit
```

**Full workflow — same-session path:**
```
./implement F001 --plan          # implementor writes plan, waits for "approved"
  ↓
Optionally: ask Claude Code "Review plans/F001-plan.md against the spec"
  ↓
Type "approved" in the implementor's chat to proceed with implementation
  ↓
Tests pass → Claude /review F001 → commit
```

**Full workflow — new-session path:**
```
./implement F001 --plan          # writes plans/F001-plan.md, then exit
  ↓
Optionally: ask Claude Code "Review plans/F001-plan.md against the spec"
  ↓
./implement F001 --plan-approved # fresh session using the approved plan
  ↓
Tests pass → Claude /review F001 → commit
```

#### Reviewing the Plan (Full Level)

After `./implement F[NNN] --plan` writes `plans/F[NNN]-plan.md`, ask Claude Code to review it before approving:

```
Review plans/F001-plan.md against the spec
```

Claude will read both files and check:
- **Scope**: correct files listed? no extras beyond spec?
- **Patterns**: Realtime Mutation Tracking, Household Guard, Undo Registration correctly identified?
- **Constraints**: nothing contradicts the "What the Implementor Should NOT Change" section?
- **Ambiguities**: any questions the implementor flagged that need answering before implementation starts?

**Example:**
```
You: Review plans/F001-plan.md against the spec

Claude: ✅ Files: all 4 files from spec listed, no extras
        ✅ New files: UserAvatar.tsx listed with correct purpose
        ✅ Patterns: Household Guard N/A (no new inserts), Undo N/A (local state + sign-out)
        ✅ Constraints: modal.tsx correctly excluded
        ⚠️  Ambiguity flagged: implementor asked about backdrop z-index — answer before approving
```

**This is scope/approach only — not a code review.** Claude is checking the plan matches the spec, not the code. The full pattern and test check happens later with `/review`.

**To approve after plan review:**
- Same-session: type `approved` in the implementor's chat window
- New-session: `./implement F001 --plan-approved`

---

#### Automated (recommended)

Use the `implement` script from the project root — it finds the spec, extracts the file list, and runs the right command:

```bash
./implement F001                        # Gemini CLI (default) — Light level
./implement F001 --plan                 # Full level: write plan first
./implement F001 --plan-approved        # Full level: implement with approved plan
./implement F001 --tool aider           # aider (interactive)
./implement F001 --tool aider --model claude-sonnet-4-5
```

#### Tool Selection

| Tool | Best when |
|------|-----------|
| **Gemini CLI** | Quick, hands-off run; context auto-loaded via `.gemini/settings.json` |
| **aider** | Incremental watching, model switching, or mid-spec resume |
| **Copy-paste** | Web interfaces (AI Studio) where no CLI is available |

#### Manual Gemini CLI

`GEMINI.md`, `AGENT.md`, and `CODING.md` are auto-loaded via `.gemini/settings.json`. Just point at the spec:

```bash
gemini "Implement specs/F001-list-interactions.md. Run npm test from client/ when done. List all files changed and paste the test output."
```

#### Manual aider

`AGENT.md` and `CODING.md` are auto-loaded via `.aider.conf.yml`. Pass the spec as `--read` and list the files to edit:

```bash
aider --model <model-flag> \
  --read specs/F001-list-interactions.md \
  client/app/(tabs)/index.tsx \
  client/lib/household.tsx
```

See `AIDER.md` for full setup and model selection.

#### Copy-paste (web UI only — not needed for CLI tools)

Paste in this order:
1. Full contents of `AGENT.md`
2. Full contents of `CODING.md`
3. Full contents of `specs/F[NNN]-[slug].md`
4. Contents of the specific files the spec says to modify

End with:
> "Implement the spec following the conventions in AGENT.md and CODING.md. Run all tests and confirm they pass. List every file you changed."

**What the implementor should return:**
- Every changed file (diff or full contents)
- Test output confirming all tests pass
- Any spec sections that couldn't be implemented as written, with explanation

#### Mid-Implementation Handoff

If implementation stops mid-spec (context limit, model switch, or session break):

1. The implementor updates `plans/F[NNN]-progress.md` with current state and displays it
2. To resume, run the same `./implement` command — the new session reads `plans/F[NNN]-progress.md` and self-orients; no user guidance needed
3. The `/review` step happens only after the full spec is complete

You can optionally make a WIP commit to save partial work, but this doesn't affect how the implementor resumes.

---

### 4. Reviewing the Implementation

> **This is post-code review** — it happens after the implementor reports back with passing tests, not during the plan step. For plan review, see [Reviewing the Plan](#reviewing-the-plan-full-level) above.

Once the implementor reports back (all tests passing, files listed), run in Claude Code:

```
/review F001
```

Or with the diff/output pasted directly:
```
/review [paste implementor's output here]
```

Claude will:
1. Check all mandatory patterns (household guard, undo registration, realtime tracking, etc.)
2. Check test coverage against the spec's Tests to Write section
3. Post a review comment on the GitHub issue
4. Append non-blocking findings to `BACKLOG.md`
5. Update PLAN.md status to `In Review` (if passing) or keep `In Progress` (if blocking issues)

**If blocking issues exist:** Share Claude's review with Gemini for fixes, then re-review.

**If review passes:** Proceed to ship (see below).

---

### 5. Shipping a Feature

Once review passes:

1. Commit the implementation with the GitHub issue number:
   ```bash
   git commit -m "feat: implement list interaction modes and header consolidation (closes #1)"
   ```

2. Close the issue and update PLAN.md:
   ```bash
   gh issue close 1 --comment "Implemented and reviewed."
   ```
   Then update the PLAN.md row status from `In Review` to `Done`.

3. Push:
   ```bash
   git push
   ```

---

### 6. Bug Fix

Bugs don't get F-numbers or spec files — they're too small and usually don't require architectural decisions.

1. File a GitHub issue directly:
   ```bash
   gh issue create --title "Avatar menu doesn't close on web" --label "bug"
   ```

2. If the fix is simple, describe it to the implementor directly with `AGENT.md` + `CODING.md` as context (no spec needed).

3. Commit referencing the issue:
   ```bash
   git commit -m "fix: close avatar menu on backdrop press on web (closes #4)"
   ```

4. If investigating the bug reveals a design decision is needed, escalate to Claude before handing to Gemini.

---

### 7. Small Cleanup or Deferred Task

Items in `BACKLOG.md` are tasks too small for a spec. Handle them by:

1. Pick an item from `BACKLOG.md`
2. Describe it to the implementor with `AGENT.md` + `CODING.md` as context
3. Commit with a reference to what it came from:
   ```bash
   git commit -m "chore: remove dead modal.tsx (deferred from F001)"
   ```
4. Check the item off in `BACKLOG.md`

If a backlog item turns out to be larger than expected, promote it:
```
This modal.tsx cleanup actually needs a full Settings screen.
Can you spec that out as a new feature?
```
Then run `/spec Settings Screen` and it becomes F007 (or whatever is next).

---

### 8. Adding an Item to the Backlog Directly

When you notice something that should be fixed but doesn't need immediate attention, add it to `BACKLOG.md` manually:

```markdown
## Tech Debt
- [ ] Migrate items screen to use same consolidated header pattern as F001
```

No GitHub issue needed for backlog items — they're lightweight by design.

---

### 9. Updating CODING.md

When a new coding pattern is established that implementors need to follow on future features, update `CODING.md` to document it. This typically happens when:
- A new mandatory pattern is introduced (e.g. a new provider that must be wrapped)
- A new React Query key convention is added
- A pattern is deprecated or changed

Tell Claude:
```
We've established that all new screens need to wrap with FooProvider.
Can you add that to CODING.md?
```

Claude will add it to the Mandatory Coding Patterns section so all future specs and implementation sessions pick it up.

---

## Quick Reference

| Task | Do this |
|------|---------|
| Spec a new feature | `/spec [feature name]` in Claude |
| Hand off to implementor (Light) | `./implement F001` (or `--tool aider`, `--model <model>`) |
| Hand off to implementor (Full) | `./implement F001 --plan`, then `--plan-approved` after review |
| Review the plan (Full level) | Ask Claude Code: `Review plans/F[NNN]-plan.md against the spec` |
| Review the implementation | `/review F001` in Claude Code (after tests pass) |
| Ship a feature | Commit with `closes #N`, run `gh issue close N`, update PLAN.md |
| File a bug | `gh issue create --label "bug"` |
| Handle a backlog item | Describe to implementor directly with `AGENT.md` + `CODING.md` as context |
| Promote backlog to feature | `/spec [description]` in Claude |
| Update coding conventions | Ask Claude to update `CODING.md` |
| See all features and status | Open `PLAN.md` |
| See small deferred items | Open `BACKLOG.md` |
| See GitHub issues | `gh issue list` or https://github.com/marvinmednick/grocerylist/issues |

---

## File Reference

| File | Read when |
|------|-----------|
| `WORKFLOW.md` | Learning or explaining the process (this file) |
| `CLAUDE.md` | Starting a Claude session — project guidance and architecture |
| `AGENT.md` | Starting any implementation session — behavioral rules for all tools |
| `CODING.md` | Starting any implementation session — coding conventions and patterns |
| `GEMINI.md` | Starting a Gemini session — Gemini-specific invocation |
| `AIDER.md` | Starting an aider session — aider setup and model selection |
| `PLAN.md` | Checking feature status or finding the right spec |
| `BACKLOG.md` | Looking for small tasks to clean up |
| `specs/F[NNN]-*.md` | Implementing or reviewing a specific feature |
| `DESIGN.md` | Understanding full system architecture before designing a feature |
| `docs/design/[feature].md` | Deep dive on a specific feature's design |
